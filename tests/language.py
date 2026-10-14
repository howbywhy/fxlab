"""Language: pins, seeded variation, tokens, recipe, board, and a real tool built and opened.

    python3 tests/language.py
"""
import os, pathlib, sys, tempfile
from playwright.sync_api import sync_playwright
from helpers import launch, report

SETUP = """() => { const F = window.fxlab, S = F.state;
  F.App.playing = false; S.base = F.makeInst('src-a');
  S.stack = [F.makeInst('trt-duotone'), F.makeInst('trt-halftone'), F.makeInst('trt-press')]; F.refresh();
  const m = F.Language.meta(); m.name = 'Slow print'; m.rule = 'Duotone, screened, pressed. Only coarseness and ink may change.'; m.seed = 12345; }"""

JS = """() => {
  const F = window.fxlab, L = F.Language, S = F.state, bad = [];
  const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(msg + ': got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); };
  const ok = (c, msg) => { if (!c) bad.push(msg); };
  const [duo, half, press] = S.stack, mh = F.FX.byId['trt-halftone'];
  const cell = mh.params.find(p => p.id === 'cell'), shape = mh.params.find(p => p.id === 'shape'), cmyk = mh.params.find(p => p.id === 'cmyk');

  /* pins */
  L.toggle(half, cell); L.toggle(half, shape); L.toggle(half, cmyk);
  eq(L.exposed().map(e => e.p.id), ['cell', 'shape', 'cmyk'], 'pinned controls');
  L.toggle(half, cmyk); eq(L.exposed().length, 2, 'unpin');
  ok(half.expose.cell.label === 'Cell size', 'default label is the control name');
  const saved = JSON.parse(JSON.stringify(F.projectFromState()));
  ok(saved.stack[1].expose && saved.stack[1].expose.cell, 'pins are saved with the layer');
  ok(saved.language && saved.language.name === 'Slow print', 'language name is saved');
  F.loadProject(JSON.stringify(saved));
  eq(L.exposed().map(e => e.p.id), ['cell', 'shape'], 'pins come back');
  ok(L.meta().name === 'Slow print', 'language name comes back');
  const h2 = S.stack[1];

  /* variation: same seed, same result; bounded; strength 0 stays; locks hold; whole numbers stay whole */
  h2.expose.cell.lo = 6; h2.expose.cell.hi = 20; h2.params.cell = 9;
  const snap = L.snapshot();
  const a = L.variation(777, 3, 1, snap).map(c => [c.id, c.v]), b = L.variation(777, 3, 1, snap).map(c => [c.id, c.v]);
  eq(a, b, 'same seed and k give the same variation');
  ok(JSON.stringify(a) !== JSON.stringify(L.variation(778, 3, 1, snap).map(c => [c.id, c.v])), 'a different seed differs');
  let inRange = true, whole = true; const seen = new Set();
  for (let k = 1; k <= 60; k++){ const v = L.variation(k * 31, k, 1, snap).find(c => c.id === 'cell').v; seen.add(v); if (v < 6 || v > 20) inRange = false; if (!Number.isInteger(v)) whole = false; }
  ok(inRange, 'variations stay inside the pinned range'); ok(whole, 'a whole-number control stays whole'); ok(seen.size > 5, 'variations actually vary: ' + seen.size);
  eq(L.variation(5, 2, 0, snap).find(c => c.id === 'cell').v, 9, 'strength 0 stays put');
  h2.expose.cell.lock = true; ok(!L.variation(5, 2, 1, snap).some(c => c.id === 'cell'), 'a held control does not move'); delete h2.expose.cell.lock;
  const before = h2.params.cell; L.apply(L.variation(99, 4, 1, snap)); L.restore(snap); eq(h2.params.cell, before, 'restore puts values back');
  eq([L.parseSeed(L.seedString(987654)), L.parseSeed('zz9'), L.parseSeed('')], [987654, parseInt('zz9', 36), null], 'seed round-trip');

  /* suggest */
  S.stack.forEach(i => { delete i.expose; });
  const n = L.suggest(); ok(n >= 2 && n <= 6, 'suggest pins a few controls: ' + n);
  ok(L.exposed().every(e => e.m.cat !== 'source'), 'suggest skips sources');

  /* tokens follow the W3C 2025.10 shapes */
  const t = L.tokens(); JSON.parse(JSON.stringify(t));
  const col = t.colour.accent.$value;
  ok(col.colorSpace === 'srgb' && col.components.length === 3 && col.components.every(x => x >= 0 && x <= 1) && /^#[0-9a-f]{6}$/.test(col.hex), 'colour token shape ' + JSON.stringify(col));
  ok(t.colour.$type === 'color', 'colour group type');
  ok(t.motion.easing.$type === 'cubicBezier' && t.motion.easing.$value.length === 4 && t.motion.easing.$value.every(Number.isFinite), 'easing token');
  eq(Object.keys(t.motion.duration.$value).sort(), ['unit', 'value'], 'duration token shape'); ok(['s', 'ms'].includes(t.motion.duration.$value.unit), 'duration unit');
  ok(/not expressible|cannot|can’t|aren’t/i.test(t.$description), 'tokens say what they cannot carry');

  /* recipe */
  const r = L.recipe(); ok(r.app === 'fxlab-language' && r.project.stack.length === 3 && r.controls.length === L.count(), 'recipe shape');
  ok(r.controls.every(c => c.label && c.module), 'recipe lists each control with its label');

  /* the tab */
  F.showWorkspace('language');
  ok(document.querySelectorAll('#languageBody .lang-row').length === L.count(), 'Language tab lists the pinned controls');
  ok(document.getElementById('languageBody').textContent.includes('What stays fixed'), 'Language tab shows the constants');
  return { bad, controls: L.count() };
}"""

JS2 = """async () => {
  const F = window.fxlab, L = F.Language, bad = [], ok = (c, m) => { if (!c) bad.push(m); };
  F.renderAt(F.App.t);
  const sig = L.signature(F.Engine.canvas);
  ok(L.STATS.every(s => Number.isFinite(sig[s.id])), 'signature has every measurement ' + JSON.stringify(sig));
  const env = L.envelope([sig, { ...sig, luma:sig.luma * .9 }]);
  ok(L.check(F.Engine.canvas, env).out === 0, 'an image sits inside its own envelope');
  const noise = document.createElement('canvas'); noise.width = 96; noise.height = 96; const x = noise.getContext('2d'), d = x.createImageData(96, 96);
  for (let i = 0; i < d.data.length; i += 4){ const v = Math.random() * 255; d.data[i] = v; d.data[i + 1] = 255 - v; d.data[i + 2] = v * .5; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0);
  const c = L.check(noise, env); ok(c.out >= 1 && c.rows.some(r => !r.ok), 'white noise is flagged as outside: ' + c.out);
  /* the recipe travels in a link and comes back the same */
  const rec = JSON.parse(JSON.stringify(L.recipe())), link = await L.link(rec);
  ok(/#lang=[\\w-]+$/.test(link.url), 'link shape');
  const back = await L.fromHash('#' + link.url.split('#')[1]);
  ok(JSON.stringify(back) === JSON.stringify(rec), 'a link round-trips the recipe');
  ok((await L.fromHash('#nothing')) === null, 'an unrelated hash is ignored');
  let threw = false; try { L.importTokens({ hello:1 }); } catch { threw = true; } ok(threw, 'a file with no tokens is refused');
  /* versions: keep, change, diff, restore */
  const v1 = L.saveVersion('First'); const ex0 = L.exposed()[0], was = ex0.inst.params[ex0.p.id];
  ex0.inst.params[ex0.p.id] = ex0.p.type === 'range' ? (was === ex0.p.max ? ex0.p.min : ex0.p.max) : was;
  ok(L.diffVersion(v1).length === 1, 'a version knows what moved: ' + L.diffVersion(v1).length);
  L.restoreVersion(v1); ok(ex0.inst.params[ex0.p.id] === was && !L.diffVersion(v1).length, 'restore puts the version back');
  ok(L.versions().length === 1 && v1.name === 'First', 'versions are listed');
  /* tokens in: roles by name, the rest to the palette, easing */
  const r = L.importTokens({ $type:'color', brand:{ ground:{ $value:'#101820' }, ink:{ $value:{ colorSpace:'srgb', components:[.9, .9, .9], hex:'#e6e6e6' } }, accent:{ $value:'#fa4616' }, swatch:{ blue:{ $value:'#3355ff' } } },
    ease:{ $type:'cubicBezier', $value:[.2, 0, 0, 1] } });
  const cw = F.Assets.identity.colourways[0];
  ok(cw.ground === '#101820' && cw.accent === '#fa4616' && cw.ink === '#e6e6e6', 'roles set from names: ' + JSON.stringify(cw));
  ok(F.Assets.palette.some(c => c.hex === '#3355ff'), 'other colours go to the palette');
  ok(F.Assets.identity.motion.ease === 5 && F.Assets.identity.motion.bezier[0] === .2, 'easing read');
  ok(r.roles.length === 3 && r.colours === 4, 'summary ' + JSON.stringify(r));
  return { bad };
}"""

TOOL_JS = """() => {
  const F = window.fxlab, bad = [];
  if (!document.body.classList.contains('player')) bad.push('not in tool mode');
  const tabs = [...document.querySelectorAll('.rail-btn')].filter(b => b.offsetParent).map(b => b.dataset.ws);
  if (JSON.stringify(tabs) !== JSON.stringify(['controls', 'images', 'export'])) bad.push('tool tabs are ' + tabs);
  for (const id of ['btnAdd', 'btnOpen', 'btnSave', 'btnSaveAs', 'randWrap', 'tabCombine', 'tabFinish', 'tabColour', 'tabLanguage'])
    if (document.getElementById(id).offsetParent) bad.push(id + ' is visible in a tool');
  if (F.Assets.persistent) bad.push('a tool must not persist assets');
  return { bad, rows: document.querySelectorAll('#controlsBody .block:nth-of-type(2) .prm').length, title: document.title, rule: document.getElementById('ctlRule').textContent };
}"""

PX = """() => { const E = window.fxlab.Engine, gl = E.gl, a = new Uint8Array(E.rw * E.rh * 4); window.fxlab.renderAt(window.fxlab.App.t); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, E.rw, E.rh, gl.RGBA, gl.UNSIGNED_BYTE, a); let s = 0; for (let i = 0; i < a.length; i += 61) s = (s * 31 + a[i]) >>> 0; return s; }"""


def main():
    bad = []
    with sync_playwright() as p:
        browser, page, errors = launch(p, downloads=True)
        page.evaluate(SETUP)
        res = page.evaluate(JS)
        bad += res['bad']
        bad += page.evaluate(JS2)['bad']

        # board: a real PNG comes out
        page.evaluate("() => { const F = window.fxlab; F.state.stack.forEach(i => delete i.expose); F.Language.suggest(); F.refresh(); }")
        with page.expect_download(timeout=120000) as d:
            page.evaluate("() => window.fxlab.exportBoard()")
        out = tempfile.mkdtemp(); png = os.path.join(out, 'board.png'); d.value.save_as(png)
        if os.path.getsize(png) < 20000 or 'slow-print-board' not in d.value.suggested_filename: bad.append(f'board looks wrong: {d.value.suggested_filename} {os.path.getsize(png)}')
        if page.evaluate("() => window.fxlab.Engine.errors && Object.keys(window.fxlab.Engine.errors).length"): bad.append('board left a module error')
        st = page.evaluate("() => ({ W:window.fxlab.state.W, H:window.fxlab.state.H, ex:window.fxlab.App.exporting })")
        if st['W'] != 1080 or st['H'] != 1350 or st['ex']: bad.append(f'board did not restore the frame {st}')

        # the Language tab: rename a control, explore, take a variation
        page.click('#tabLanguage'); page.wait_for_selector('#languageBody .varigrid button', timeout=20000)
        n = page.locator('#languageBody .varigrid button').count()
        if n != 6: bad.append(f'{n} variations shown')
        first = page.locator('#languageBody .lang-row input[type=text]').first
        first.fill('Heat'); first.press('Enter'); first.blur()
        if 'Heat' not in page.evaluate("() => JSON.stringify(window.fxlab.Language.recipe().controls)"): bad.append('renaming a control did not reach the recipe')
        before = page.evaluate("() => JSON.stringify(window.fxlab.Language.snapshot().map(s => s.v))")
        page.locator('#languageBody .varigrid button').nth(2).click(); page.wait_for_timeout(200)
        after = page.evaluate("() => JSON.stringify(window.fxlab.Language.snapshot().map(s => s.v))")
        if before == after: bad.append('taking a variation changed nothing')
        page.keyboard.press('Control+z')
        if page.evaluate("() => JSON.stringify(window.fxlab.Language.snapshot().map(s => s.v))") != before: bad.append('undo did not put the variation back')

        # a hostile rule and name must not break the tool page
        page.evaluate("() => { const m = window.fxlab.Language.meta(); m.name = 'A <b>bold</b> & \\\\\"quoted\\\\\" name'; m.rule = '</script><img src=x onerror=window.__pwned=1>'; }")
        html = page.evaluate("async () => await window.fxlab.Language.tool()")
        tool = pathlib.Path(out) / 'tool.html'; tool.write_text(html)
        if len(html) > 1_700_000: bad.append(f'the tool is {len(html)//1024} KB')
        if 'const THUMBS = {};' not in html: bad.append('the tool still carries module thumbnails')

        tp = browser.new_page(viewport={'width': 1280, 'height': 800}); terrs = []
        tp.on('pageerror', lambda e: terrs.append(str(e))); tp.on('console', lambda m: terrs.append(m.text) if m.type == 'error' else None)
        tp.goto(tool.as_uri()); tp.wait_for_timeout(1500)
        tr = tp.evaluate(TOOL_JS); bad += tr['bad']
        if tr['rows'] < 2: bad.append(f"the tool shows {tr['rows']} controls")
        if tp.evaluate("() => window.__pwned") or tp.locator('img[src="x"]').count(): bad.append('a hostile rule ran or rendered inside the tool')
        if '</script>' not in tr['rule']: bad.append('the rule text was not shown literally')
        # a control moves the picture; shuffle stays in range; reset returns
        base = tp.evaluate(PX)
        slider = tp.locator('#controlsBody .block:nth-of-type(2) input[type=range]').first
        slider.evaluate("el => { el.value = el.min; el.dispatchEvent(new Event('input', { bubbles:true })); }")
        low = tp.evaluate(PX)
        slider.evaluate("el => { el.value = el.max; el.dispatchEvent(new Event('input', { bubbles:true })); }")
        high = tp.evaluate(PX)
        if len({base, low, high}) < 2: bad.append('moving a tool control did not change the picture')
        tp.click('#controlsBody button:has-text("Shuffle")')
        rng = tp.evaluate("() => window.fxlab.Language.exposed().every(e => { if (e.p.type !== 'range') return true; const b = window.fxlab.Language.bounds(e), v = e.inst.params[e.p.id]; return v >= Math.min(b.lo, b.hi) - 1e-9 && v <= Math.max(b.lo, b.hi) + 1e-9; })")
        if not rng: bad.append('shuffle left the pinned range')
        # a tool cannot make tools, and says why
        msg = tp.evaluate("async () => { try { await window.fxlab.Language.tool(); return 'built'; } catch (e) { return e.message; } }")
        if 'can’t make tools' not in msg: bad.append(f'tool-in-tool message: {msg}')
        tp.click('#tabExport')
        for b in ['btnPng', 'btnVideo', 'btnSeq']:
            if not tp.locator('#' + b).is_visible(): bad.append(f'{b} not available in the tool')
        # a link opens the same language as a tool, and leaves this browser's kit alone
        url = page.evaluate("async () => (await window.fxlab.Language.link(window.fxlab.Language.recipe())).url")
        lp = browser.new_page(viewport={'width': 1280, 'height': 800}); lerrs = []
        lp.on('pageerror', lambda e: lerrs.append(str(e)))
        lp.goto(url); lp.wait_for_function("() => document.body.classList.contains('player')", timeout=15000)
        lr = lp.evaluate("() => ({ n:window.fxlab.Language.count(), name:window.fxlab.Language.meta().name, persist:window.fxlab.Assets.persistent })")
        if lr['n'] < 2 or lr['persist'] or 'quoted' not in lr['name']: bad.append(f'link opened wrong: {lr}')
        bad += lerrs
        bad += [e for e in terrs if 'favicon' not in e]
        browser.close()
        bad += [e for e in errors if 'favicon' not in e]
    return report('language', bad, f"{res['controls']} pins · tool built and opened")


if __name__ == '__main__':
    sys.exit(main())
