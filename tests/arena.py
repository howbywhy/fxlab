"""Are.na references: link parsing, loading a channel, using pictures as A/B, palette, errors, and hostile data.

The API and image host are mocked, so this needs no network and never touches Are.na.

    python3 tests/arena.py
"""
import io, json, sys
from playwright.sync_api import sync_playwright
from PIL import Image
from helpers import launch, report


def png(rgb):
    b = io.BytesIO(); Image.new('RGB', (64, 48), rgb).save(b, 'PNG'); return b.getvalue()


def block(i, cls='Image', host='images.are.na', title=None):
    u = lambda k: f'https://{host}/{k}/{i}.png'
    return {'id': i, 'class': cls, 'title': title or f'Picture {i}', 'user': {'slug': 'maker', 'username': 'Maker'},
            'source': {'url': f'https://example.com/{i}'},
            'image': {'square': {'url': u('sq')}, 'thumb': {'url': u('th')}, 'display': {'url': u('di')}, 'large': {'url': u('lg')}}}


CHANNEL = {'title': 'Slow print', 'slug': 'slow-print', 'length': 5, 'status': 'public', 'user': {'slug': 'someone', 'username': 'Someone'},
           'contents': [block(1), block(2), {'id': 3, 'class': 'Text', 'title': 'a note', 'content': 'words'},
                        block(4, host='evil.example', title='<img src=x onerror=window.__pwned=1>'), block(5, title='<b>bold</b>')]}

JS = """() => {
  const A = window.fxlab.Arena, bad = [], eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(m + ': got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); };
  eq(['https://www.are.na/someone/slow-print', 'https://are.na/someone/slow-print?x=1', 'https://www.are.na/channels/slow-print', 'slow-print'].map(A.slugOf), ['slow-print', 'slow-print', 'slow-print', 'slow-print'], 'slugs');
  eq(['', 'https://example.com/a/b', 'https://www.are.na/block/123', 'https://www.are.na/someone', 'not a link!', 'javascript:alert(1)'].map(A.slugOf), ['', '', '', '', '', ''], 'things that are not channels');
  return bad;
}"""


def main():
    bad, reqs = [], []
    with sync_playwright() as p:
        browser, page, errors = launch(p)
        state = {'mode': 'ok'}

        def api(route):
            reqs.append(route.request.url)
            m = state['mode']
            if m == 'missing': return route.fulfill(status=404, headers={'access-control-allow-origin': '*'}, body='{}')
            if m == 'private': return route.fulfill(status=401, headers={'access-control-allow-origin': '*'}, body='{}')
            if m == 'busy': return route.fulfill(status=429, headers={'access-control-allow-origin': '*'}, body='{}')
            if m == 'down': return route.abort()
            if '/contents' in route.request.url:
                return route.fulfill(headers={'access-control-allow-origin': '*'}, content_type='application/json', body=json.dumps({'contents': CHANNEL['contents']}))
            return route.fulfill(headers={'access-control-allow-origin': '*'}, content_type='application/json', body=json.dumps(CHANNEL))

        def img(route):
            reqs.append(route.request.url)
            rgb = (220, 40, 40) if '/1.' in route.request.url else (40, 60, 220)
            route.fulfill(headers={'access-control-allow-origin': '*'}, content_type='image/png', body=png(rgb))

        page.route('https://api.are.na/**', api); page.route('https://images.are.na/**', img)
        page.route('https://evil.example/**', lambda r: (reqs.append(r.request.url), r.abort()))
        bad += page.evaluate(JS)

        page.click('#tabImages')
        box = page.locator('#arenaBlock')
        box.locator('input').fill('https://www.are.na/someone/slow-print'); box.locator('button:has-text("Load")').click()
        page.wait_for_selector('#arenaBlock .aimg')
        n = box.locator('.aimg').count()
        if n != 3: bad.append(f'{n} tiles; want the two pictures and the one titled with markup (text and off-host blocks are dropped)')
        if page.evaluate('() => window.__pwned') or page.locator('#arenaBlock img[src="x"]').count(): bad.append('a hostile title ran or rendered as markup')
        if page.locator('#arenaBlock img').count() != 3: bad.append('tiles should be plain lazy images')
        if '<b>bold</b>' not in box.inner_text(): bad.append('titles should be shown as plain text')
        href = box.locator('a:has-text("Open on Are.na")').get_attribute('href')
        if href != 'https://www.are.na/someone/slow-print': bad.append(f'attribution link {href}')
        if 'belong to their makers' not in box.inner_text(): bad.append('missing the attribution note')

        # use a picture as A: it changes the source, and is not saved anywhere
        before = page.evaluate("() => ({ a: window.fxlab.Engine.media.A.el, imgs: window.fxlab.Assets.images().length })")
        box.locator('.aimg').first.hover(); box.locator('.aimg').first.locator('button:has-text("A")').click()
        page.wait_for_function("() => window.fxlab.App.mediaInfo.A && window.fxlab.App.mediaInfo.A.name !== 'Placeholder'", timeout=15000)
        after = page.evaluate("() => ({ name: window.fxlab.App.mediaInfo.A.name, asset: window.fxlab.state.sources.A.asset || null, imgs: window.fxlab.Assets.images().length, proj: JSON.stringify(window.fxlab.projectFromState()) })")
        if after['asset'] or after['imgs'] != before['imgs']: bad.append(f'an Are.na picture reached the library: {after["asset"]} {after["imgs"]}')
        if 'are.na' in after['proj'].lower() or 'images.are' in after['proj']: bad.append('an Are.na link or picture is in the saved project')
        if not after['name'].startswith('Picture 1'): bad.append(f"source name {after['name']}")
        px = page.evaluate("""() => { const E = window.fxlab.Engine; window.fxlab.state.base = window.fxlab.makeInst('src-a'); window.fxlab.state.stack = []; window.fxlab.renderAt(0); const a = new Uint8Array(E.rw * E.rh * 4); E.gl.bindFramebuffer(E.gl.FRAMEBUFFER, null); E.gl.readPixels(0, 0, E.rw, E.rh, E.gl.RGBA, E.gl.UNSIGNED_BYTE, a); const i = (Math.floor(E.rh / 2) * E.rw + Math.floor(E.rw / 2)) * 4; return [a[i], a[i + 1], a[i + 2]]; }""")
        if not (px[0] > 150 and px[1] < 90 and px[2] < 90): bad.append(f'the picture is not on the stage: centre pixel {px}')

        # palette from the board
        pal0 = page.evaluate("() => window.fxlab.Assets.palette.length")
        box.locator('button:has-text("Pull a palette")').click()
        page.wait_for_function("(n) => window.fxlab.Assets.palette.length > n", arg=pal0, timeout=15000)
        cols = page.evaluate("() => window.fxlab.Assets.palette.map(c => c.hex)")
        red = any(int(h[1:3], 16) > 150 and int(h[3:5], 16) < 100 for h in cols); blue = any(int(h[5:7], 16) > 150 and int(h[1:3], 16) < 100 for h in cols)
        if not (red and blue): bad.append(f'palette misses the two board colours: {cols}')

        # a link pasted into the Data tab becomes a table of blocks
        t = page.evaluate("async () => { const t = await window.fxlab.Data.fetchUrl('https://www.are.na/someone/slow-print'); return { rows: t.rows, cols: t.cols.map(c => c.name) }; }")
        if t['rows'] < 3 or 'id' not in t['cols']: bad.append(f'Data from an Are.na link: {t}')
        if not any('/channels/slow-print/contents' in r for r in reqs): bad.append('Data did not use the contents endpoint')

        # errors say what happened
        for mode, want in [('missing', 'couldn’t find that channel'), ('private', 'private'), ('busy', 'too many requests'), ('down', 'couldn’t reach Are.na')]:
            state['mode'] = mode
            box.locator('button:has-text("Clear")').click() if box.locator('button:has-text("Clear")').count() else None
            box.locator('input').fill('https://www.are.na/someone/slow-print'); box.locator('button:has-text("Load")').click()
            page.wait_for_selector('#arenaBlock .errbox')
            msg = box.locator('.errbox').inner_text()
            if want not in msg: bad.append(f'{mode}: {msg}')
        box.locator('input').fill('nonsense!!'); box.locator('button:has-text("Load")').click(); page.wait_for_selector('#arenaBlock .errbox')
        if 'doesn’t look like an Are.na channel' not in box.locator('.errbox').inner_text(): bad.append('a bad link gave no plain message')

        # nothing was ever requested from anywhere but Are.na
        strays = [r for r in reqs if not (r.startswith('https://api.are.na/') or r.startswith('https://images.are.na/'))]
        if strays: bad.append(f'requests outside Are.na: {strays}')
        # a tool must not carry the section
        page.evaluate("() => document.body.classList.add('player')")
        if box.is_visible(): bad.append('the Are.na section shows in a tool')
        browser.close()
        bad += [e for e in errors if 'favicon' not in e and 'Failed to load resource' not in e]
    return report('arena', bad, 'mocked API and images')


if __name__ == '__main__':
    sys.exit(main())
