"""Apply every starter look and render it.

    python3 tests/looks.py
"""
import sys
from playwright.sync_api import sync_playwright
from helpers import launch, load_assets, report

JS = """() => {
  const f = window.fxlab; f.App.playing = false; const bad = [];
  for (const lk of f.STARTER_LOOKS){
    f.applyLook(lk.data);
    try { f.renderAt(f.state.duration * .7); } catch (e){ bad.push(lk.id + ': ' + e); }
    for (const i of [f.state.base, ...f.state.stack]) if (f.Engine.errors[i.id]) bad.push(lk.id + ' → ' + i.id);
    const lane = k => (lk.data.sources && lk.data.sources[k] && lk.data.sources[k].process || []).map(i => i.id);
    const got = k => (f.state.sources[k].process || []).map(i => i.id);
    if (lane('A').join() !== got('A').join() || lane('B').join() !== got('B').join())
      bad.push(lk.id + ': Prepare lanes ' + got('A') + '/' + got('B') + ' ≠ look data');
  }
  return { count: f.STARTER_LOOKS.length, bad };
}"""


def main():
    with sync_playwright() as p:
        browser, page, errors = launch(p)
        load_assets(page)
        res = page.evaluate(JS)
        browser.close()
    return report('looks', res['bad'] or errors, f"{res['count']} looks")


if __name__ == '__main__':
    sys.exit(main())
