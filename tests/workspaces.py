"""The task-based UI: layout, tabs, keyboard, the picker drawer, compare, and the Data workflow.

    python3 tests/workspaces.py
"""
import sys
from playwright.sync_api import sync_playwright
from helpers import launch, report

TABS = ['images', 'combine', 'finish', 'data', 'colour', 'language', 'export']


def run(viewport):
    bad = []
    with sync_playwright() as p:
        browser, page, errors = launch(p, viewport=viewport)
        f = lambda js, arg=None: page.evaluate(js, arg) if arg is not None else page.evaluate(js)
        vw, vh = viewport

        # ---- layout: the things that made the old screen hard to use
        m = f("""() => { const r = id => document.getElementById(id).getBoundingClientRect();
          return { doc: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight,
            exportBtn: r('btnExportGo'), stage: r('stageWrap'), panel: r('panel'), rail: r('rail'), time: r('time'),
            tabs: ['Images','Combine','Finish','Data','Colour','Language','Export'].map(n => r('tab' + n)) }; }""")
        if m['doc'] > vw or m['docH'] > vh: bad.append(f"{vw}x{vh}: page scrolls ({m['doc']}x{m['docH']})")
        if m['exportBtn']['right'] > vw or m['exportBtn']['left'] < 0: bad.append(f"{vw}x{vh}: Export button off screen")
        if m['stage']['width'] < vw * .5: bad.append(f"{vw}x{vh}: stage only {m['stage']['width']:.0f}px wide")
        if m['time']['bottom'] > vh + 1: bad.append(f"{vw}x{vh}: timeline cut off")
        if any(t['bottom'] > vh or t['width'] < 40 for t in m['tabs']): bad.append(f"{vw}x{vh}: a tab is cut off")

        # ---- tabs: one panel at a time, aria in step, keyboard 1-6
        for i, t in enumerate(TABS):
            page.click(f'#tab{t.capitalize()}')
            st = f("""() => ({ on:[...document.querySelectorAll('.ws.on')].map(x => x.id),
                sel:[...document.querySelectorAll('.rail-btn')].filter(b => b.getAttribute('aria-selected') === 'true').map(b => b.dataset.ws) })""")
            if st['on'] != ['ws' + t.capitalize()] or st['sel'] != [t]: bad.append(f'tab {t}: {st}')
        page.evaluate("() => document.activeElement && document.activeElement.blur()")
        for i, t in enumerate(TABS, 1):
            page.keyboard.press(str(i))
            if f("() => window.fxlab.state && document.querySelector('.ws.on').id") != 'ws' + t.capitalize(): bad.append(f'key {i} did not open {t}')
        page.keyboard.press('1')

        # ---- picker drawer: opens from Add, filters, closes on choose, lands in the right tab
        page.click('#tabFinish'); page.click('[data-add="finish"]')
        d = f("""() => ({ open:document.getElementById('lib').classList.contains('open'), title:document.getElementById('libCtxTitle').textContent,
            focus:document.activeElement && document.activeElement.id, chips:[...document.querySelectorAll('#libChips button')].map(b => b.textContent),
            items:document.querySelectorAll('#libList .item').length })""")
        if not d['open'] or d['title'] != 'Add to Finish' or d['focus'] != 'search': bad.append(f'picker open state {d}')
        if 'Effects' not in d['chips'] or 'Data' not in d['chips'] or 'Transitions' in d['chips']: bad.append(f"picker chips {d['chips']}")
        page.click('#libChips button:has-text("Data")')
        ids = f("() => [...document.querySelectorAll('#libList .item')].map(e => e.dataset.id)")
        if not ids or any(not i.startswith('dv-') for i in ids): bad.append(f'Data chip shows {ids}')
        page.fill('#search', 'grain'); ids = f("() => [...document.querySelectorAll('#libList .item')].map(e => e.dataset.id)")
        page.click('#libChips button:has-text("All")')
        ids = f("() => [...document.querySelectorAll('#libList .item')].map(e => e.dataset.id)")
        if 'trt-grain' not in ids: bad.append('search "grain" did not find film grain')
        page.click('#libList .item[data-id="trt-grain"]')
        f("() => { window.fxlab.state.stack[0].params.animate = false; }")   # grain reseeds from wall-clock time; hold it still for the compare check
        s = f("() => ({ open:document.getElementById('lib').classList.contains('open'), stack:window.fxlab.state.stack.map(i => i.id), badge:document.getElementById('badgeFinish').textContent })")
        if s['open'] or s['stack'] != ['trt-grain'] or s['badge'] != '1': bad.append(f'after choosing: {s}')
        # Escape closes; Find-a-module routes by kind
        page.click('#btnAdd'); page.keyboard.press('Escape')
        if f("() => document.getElementById('lib').classList.contains('open')"): bad.append('Escape did not close the picker')
        page.keyboard.press('Control+k'); page.fill('#search', 'wipe'); page.click('#libList .item[data-id="tr-wipe"]')
        s = f("() => ({ ws:document.querySelector('.ws.on').id, base:window.fxlab.state.base.id })")
        if s != {'ws': 'wsCombine', 'base': 'tr-wipe'}: bad.append(f'a base module chosen from search: {s}')
        page.keyboard.press('Control+k'); page.fill('#search', 'halftone'); page.click('#libList .item[data-id="trt-halftone"]')
        s = f("() => ({ ws:document.querySelector('.ws.on').id, stack:window.fxlab.state.stack.map(i => i.id) })")
        if s != {'ws': 'wsFinish', 'stack': ['trt-grain', 'trt-halftone']}: bad.append(f'a stack module chosen from search: {s}')

        # ---- hold to compare shows the plain image A, then lets go
        f("() => { const f = window.fxlab; f.App.playing = false; f.App.t = 1.0; f.renderAt(1.0); }")   # the app loop also renders at App.t, so pin it
        px = lambda: page.evaluate("""() => { const E = window.fxlab.Engine, gl = E.gl, a = new Uint8Array(E.rw * E.rh * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, E.rw, E.rh, gl.RGBA, gl.UNSIGNED_BYTE, a); let s = 0; for (let i = 0; i < a.length; i += 97) s = (s * 31 + a[i]) >>> 0; return s; }""")
        with_fx = px()
        cmp = page.locator('#btnCompare').bounding_box()
        page.mouse.move(cmp['x'] + 10, cmp['y'] + 10); page.mouse.down(); page.wait_for_timeout(120)
        f("() => window.fxlab.renderAt(1.0)"); held = px()
        page.mouse.up(); page.wait_for_timeout(120); f("() => window.fxlab.renderAt(1.0)"); back = px()
        if held == with_fx: bad.append('hold-to-compare did not change the picture')
        if back != with_fx: bad.append('the picture did not come back after compare')
        if f("() => window.fxlab.state.stack.length") != 2: bad.append('compare changed the layers')

        # ---- Data: samples, errors, paste, link / unlink, save
        page.click('#tabData')
        page.click('#dataBody .item[data-id="sample-quakes"]')
        n = f("() => window.fxlab.Data.table && window.fxlab.Data.table.name")
        if n != 'Earthquakes, past week': bad.append(f'sample not loaded: {n}')
        page.click('button:has-text("Paste text")'); page.fill('#dataBody textarea', '{"a":')
        page.click('button:has-text("Use this text")')
        if 'isn’t valid' not in f("() => (document.querySelector('#dataBody .errbox') || {}).textContent || ''"): bad.append('bad JSON gave no plain error')
        page.fill('#dataBody textarea', 'day,visits,mood\n1,10,happy\n2,14,calm\n3,9,happy\n4,21,calm')
        page.click('button:has-text("Use this text")')
        n = f("() => window.fxlab.Data.table && window.fxlab.Data.table.cols.map(c => c.name + ':' + c.type).join()")
        if n != 'day:number,visits:number,mood:category': bad.append(f'pasted table columns {n}')
        page.click('#dataBody .item[data-id="add-dv-dots"]')
        if f("() => window.fxlab.state.stack.map(i => i.id).pop()") != 'dv-dots' or f("() => document.querySelector('.ws.on').id") != 'wsFinish': bad.append('Draw it did not add a data visual to Finish')
        # link a slider from Finish
        f("() => { const F = window.fxlab; F.state.stack = [F.makeInst('trt-halftone')]; F.refresh(); }")
        page.click('#tabFinish')
        row = page.locator('#secStack .prm', has_text='Cell size').first
        row.hover(); row.locator('.lk').click()
        pop = page.locator('#secStack .bindpop')
        if pop.count() != 1: bad.append('link popover did not open')
        else:
            page.select_option('#secStack .bindpop select', 'visits')
            st = f("""() => { const i = window.fxlab.state.stack[0]; const r = document.querySelector('#secStack .prm.bound');
              return { bind:i.bind, bound:!!r, disabled:r && r.querySelector('input[type=range]').disabled, badge:document.getElementById('badgeData').textContent }; }""")
            if not st['bind'] or st['bind']['cellSize' if 'cellSize' in st['bind'] else 'cell']['col'] != 'visits' or not st['bound'] or not st['disabled']: bad.append(f'link state {st}')
            if st['badge'] != '1': bad.append(f"Data badge {st['badge']}")
            vals = f("""() => { const F = window.fxlab, m = F.FX.byId['trt-halftone'], i = F.state.stack[0], D = F.Data;
              D.play.mode = 'loop'; const a = D.bind(m, i, i.params, { loop:0, p:0 }).cell, b = D.bind(m, i, i.params, { loop:.999, p:1 }).cell; D.play.mode = 'pingpong'; return [a, b]; }""")
            if vals[0] == vals[1]: bad.append(f'linked control did not move with the data: {vals}')
            saved = f("() => JSON.stringify(window.fxlab.projectFromState())")
            if '"bind"' not in saved or '"table"' not in saved: bad.append('link or table missing from the saved project')
            page.click('#tabData')
            if 'Halftone · Cell size' not in f("() => document.getElementById('dataBody').textContent"): bad.append('linked controls list is missing the link')
            page.click('#dataBody button:has-text("Unlink")')
            if f("() => !!window.fxlab.state.stack[0].bind") or f("() => document.getElementById('badgeData').textContent") != '': bad.append('Unlink left a link behind')

        # ---- a CSV dropped on the stage lands in the Data tab
        page.evaluate("""() => { const dt = new DataTransfer(); dt.items.add(new File(['x,y\\n1,2\\n2,4\\n3,8\\n4,9'], 'dropped.csv', { type:'text/csv' }));
          window.dispatchEvent(new DragEvent('drop', { bubbles:true, cancelable:true, dataTransfer:dt })); }""")
        page.wait_for_timeout(300)
        if f("() => window.fxlab.Data.table && window.fxlab.Data.table.name") != 'dropped': bad.append('a dropped CSV did not load')

        # ---- Export tab: the buttons are where a person will look
        page.click('#tabExport')
        for b in ['btnPng', 'btnVideo', 'btnSeq', 'btnPrint', 'btnFolder']:
            if not page.locator('#' + b).is_visible(): bad.append(f'{b} not visible in Export')

        # ---- every control has a name a screen reader can read
        for t in TABS:
            page.click(f'#tab{t.capitalize()}')
            un = f("""() => [...document.querySelectorAll('.ws.on input:not([type=hidden]), .ws.on select, .ws.on textarea, .ws.on button, #top button, #stagebar input, #stagebar select, #stagebar button')]
              .filter(e => e.offsetParent !== null).filter(e => {
                const name = e.getAttribute('aria-label') || e.title || (e.labels && e.labels.length && e.labels[0].textContent.trim()) || (e.tagName === 'BUTTON' && e.textContent.trim()) || (e.closest('label') && e.closest('label').textContent.trim());
                return !name; }).map(e => e.tagName + '#' + e.id + '.' + e.className).slice(0, 5)""")
            if un: bad.append(f'{t}: unnamed controls {un}')
        browser.close()
        bad += [e for e in errors if 'favicon' not in e]
    return bad


def main():
    bad = []
    for vp in [(1280, 800), (1440, 900)]:
        bad += run(vp)
    return report('workspaces', bad, '1280×800 and 1440×900')


if __name__ == '__main__':
    sys.exit(main())
