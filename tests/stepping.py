"""[ and ] step a layer through the modules from the keyboard.

    python3 tests/stepping.py
"""
import sys
from playwright.sync_api import sync_playwright
from helpers import launch, report


def main():
    bad = []
    with sync_playwright() as p:
        browser, page, errors = launch(p, viewport=(1280, 800))
        f = page.evaluate
        stack = lambda: f("() => window.fxlab.state.stack.map(i => i.id)")
        pool = f("""() => { const { FX } = window.fxlab, out = [];
          for (const c of CATS) if (c.role === 'stack') for (const m of FX.modules) if (m.cat === c.id) out.push(m.id);
          return out; }""")

        # Finish: an empty Finish gets a layer, then ] and [ walk picker order and wrap
        page.keyboard.press('3'); page.keyboard.press('BracketRight')
        if stack() != [pool[0]]: bad.append(f'] on empty Finish gave {stack()}')
        page.keyboard.press('BracketRight'); page.keyboard.press('BracketRight')
        if stack() != [pool[2]]: bad.append(f'two more ] gave {stack()}, wanted {pool[2]}')
        page.keyboard.press('BracketLeft')
        if stack() != [pool[1]]: bad.append(f'[ gave {stack()}, wanted {pool[1]}')
        page.keyboard.press('BracketLeft'); page.keyboard.press('BracketLeft')
        if stack() != [pool[-1]]: bad.append(f'[ past the start gave {stack()}, wanted {pool[-1]}')
        toast = f("() => document.getElementById('toast').textContent")
        if 'Finish' not in toast: bad.append(f'no toast naming the layer: {toast!r}')

        # Shift jumps to the first module of the next category
        page.keyboard.press('Shift+BracketRight')
        if stack() != [pool[0]]: bad.append(f'Shift+] from the last category should wrap to {pool[0]}, gave {stack()}')
        page.keyboard.press('Shift+BracketRight')
        first_cat = f("id => window.fxlab.FX.byId[id].cat", pool[0])
        nxt = f("() => window.fxlab.FX.byId[window.fxlab.state.stack[0].id].cat")
        if nxt == first_cat: bad.append(f'Shift+] stayed in {nxt}')

        # with two layers, the one you touched is the one that steps
        page.click('[data-add="finish"]'); page.click('#libList .item[data-id="trt-grain"]')
        before = stack()
        page.click('#secStack .card:nth-child(1) .nm')
        page.keyboard.press('BracketRight')
        after = stack()
        if after[1] != 'trt-grain' or after[0] == before[0]: bad.append(f'touched layer 1 but {before} became {after}')

        # a run of steps undoes in one go
        page.wait_for_timeout(1100)
        base = stack()
        for _ in range(4): page.keyboard.press('BracketRight')
        page.wait_for_timeout(1100)
        page.keyboard.press('Control+z')
        if stack() != base: bad.append(f'undo after a run gave {stack()}, wanted {base}')

        # Combine steps the base; Images steps Prepare on the open source
        page.keyboard.press('2'); b0 = f("() => window.fxlab.state.base.id")
        page.keyboard.press('BracketRight')
        if f("() => window.fxlab.state.base.id") == b0: bad.append('] in Combine did not change the base')
        page.keyboard.press('1'); page.keyboard.press('BracketRight')
        proc = f("() => window.fxlab.state.sources[window.fxlab.App.srcTab].process.map(i => i.id)")
        ok = f("ids => ids.every(id => window.fxlab.FX.laneEligible(window.fxlab.FX.byId[id]))", proc)
        if len(proc) != 1 or not ok: bad.append(f'] in Images gave Prepare {proc}')

        # not while typing
        page.keyboard.press('3'); page.keyboard.press('/'); page.keyboard.type('[]')
        if f("() => document.getElementById('search').value") != '[]': bad.append('brackets were swallowed in the search field')
        page.keyboard.press('Escape')

        page.wait_for_timeout(300)
        bad += [e for e in errors if 'WebGL' not in e]
        browser.close()
    return report('stepping', bad, '[ ] and Shift in Finish, Combine and Images; undo; typing')


if __name__ == '__main__':
    sys.exit(main())
