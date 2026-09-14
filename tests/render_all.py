"""Compile and render every module. Catches shader errors, JS errors and GL errors.

    python3 tests/render_all.py
"""
import sys
from playwright.sync_api import sync_playwright
from helpers import launch, load_assets, report

JS = """() => {
  const f = window.fxlab; f.App.playing = false;
  const bad = {};
  for (const m of f.FX.modules){
    const role = CATS.find(c => c.id === m.cat).role;
    f.Engine.resetFeedback(f.state.stack);
    if (role === 'base'){ f.state.base = f.makeInst(m.id); f.state.stack = []; }
    else { f.state.base = f.makeInst('src-a'); f.state.stack = [f.makeInst(m.id)]; }
    try { f.renderAt(1.1); f.renderAt(1.2); } catch (e){ bad[m.id] = String(e).slice(0, 200); }
    if (f.Engine.errors[m.id]) bad[m.id] = f.Engine.errors[m.id].slice(0, 300);
    const gl = f.Engine.gl.getError(); if (gl) bad[m.id] = (bad[m.id] || '') + ' glError ' + gl;
  }
  return { count: f.FX.modules.length, bad };
}"""


def main():
    with sync_playwright() as p:
        browser, page, errors = launch(p)
        load_assets(page)
        res = page.evaluate(JS)
        browser.close()
    code = report('render_all', res['bad'] or errors, f"{res['count']} modules")
    return code


if __name__ == '__main__':
    sys.exit(main())
