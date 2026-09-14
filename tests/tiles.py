"""Check tiled print rendering matches a single full-resolution render.

Print exports render in tiles, so any effect that samples outside its tile can
show a seam. This renders a stack both ways and counts differing pixels.
A few hundred is anti-aliasing noise; thousands means the stack needs
`nonLocal: true` on the module (declared on FX.register).

    python3 tests/tiles.py                       # local stack + nonLocal flags
    python3 tests/tiles.py gen-stripes trt-blur  # base first, then stack layers
"""
import sys
from playwright.sync_api import sync_playwright
from helpers import launch, load_assets, report

DEFAULT = ['tr-scanner', 'trt-halftone', 'kt-slice', 'lg-logo', 'trt-press', 'kt-morph', 'lg-dots']

# Union of the two lists that used to stamp the flag. The test fails if any
# of these lose `nonLocal: true` on FX.register.
NONLOCAL = [
    'fx-kaleido', 'fx-tile', 'fx-polar', 'fx-pixelsort', 'fx-slitscan',
    'fx-echo', 'fx-vhs', 'fx-glitch', 'gen-particles', 'kt-3d', 'kt-collage',
    'fx-melt', 'fx-datamosh', 'gen-flow', 'gen-ink', 'gen-cells', 'fx-droste',
    'gen-scribble', 'fx-streak', 'fx-shadow', 'fx-shockwave', 'fx-reframe',
]
# Whole-frame modules: tiled vs single-pass must disagree, or the flag is a lie.
NONLOCAL_STACKS = [
    ['src-a', 'fx-kaleido'],
    ['src-a', 'fx-polar'],
    ['src-a', 'fx-shadow'],
]

JS = """(stack) => {
  const f = window.fxlab, E = f.Engine, S = f.state;
  f.App.playing = false; f.App.exporting = true;
  S.W = 600; S.H = 750; S.base = f.makeInst(stack[0]); S.stack = stack.slice(1).map(id => f.makeInst(id));
  const FW = 1200, FH = 1500, t = 1.2, T = 512, M = 64, TS = T + 2 * M;
  E.setSize(S.W, S.H, 2); f.renderAt(t);
  const ref = new Uint8Array(FW * FH * 4); E.read(E.last, ref);
  E.enterTiles(FW, FH, TS);
  const buf = new Uint8Array(TS * TS * 4); let diff = 0, worst = 0;
  for (let ty = 0; ty < FH; ty += T) for (let tx = 0; tx < FW; tx += T){
    E.setTile(tx - M, ty - M); f.renderAt(t); E.read(E.last, buf);
    for (let r = ty; r < Math.min(FH, ty + T); r++){
      const br = (ty - M) + TS - 1 - r;
      for (let c = tx; c < Math.min(FW, tx + T); c++){
        const bi = (br * TS + (c - tx + M)) * 4, oi = ((FH - 1 - r) * FW + c) * 4;
        const d = Math.abs(ref[oi] - buf[bi]) + Math.abs(ref[oi+1] - buf[bi+1]) + Math.abs(ref[oi+2] - buf[bi+2]);
        if (d > 30) diff++;
        worst = Math.max(worst, d);
      }
    }
  }
  E.exitTiles(); E.setSize(S.W, S.H, .5);
  return { diff, worst };
}"""

JS_FLAGS = """(ids) => {
  const missing = [];
  for (const id of ids){
    const m = FX.byId[id];
    if (!m) missing.push(id + ' (unknown)');
    else if (!m.nonLocal) missing.push(id);
  }
  return { missing, flagged: FX.modules.filter(m => m.nonLocal).map(m => m.id) };
}"""


def main():
    custom = sys.argv[1:]
    with sync_playwright() as p:
        browser, page, errors = launch(p)
        load_assets(page)
        if custom:
            res = page.evaluate(JS, custom)
            browser.close()
            fails = errors or ([] if res['diff'] < 2000 else [f"{res['diff']} pixels differ (worst {res['worst']})"])
            return report('tiles', fails, f"{res['diff']} px differ · {' → '.join(custom)}")

        flags = page.evaluate(JS_FLAGS, NONLOCAL)
        fails = list(errors)
        if flags['missing']:
            fails.append(f"nonLocal flag missing on {flags['missing']}")

        local = page.evaluate(JS, DEFAULT)
        if local['diff'] >= 2000:
            fails.append(f"local stack {local['diff']} px differ (worst {local['worst']})")

        notes = [f"{local['diff']} px differ · {' → '.join(DEFAULT)}"]
        for stack in NONLOCAL_STACKS:
            got = page.evaluate(JS, stack)
            notes.append(f"{' → '.join(stack)} {got['diff']} px")
            if got['diff'] < 2000:
                fails.append(
                    f"{' → '.join(stack)} tiled almost identically ({got['diff']} px) "
                    f"— nonLocal module is not exercising whole-frame sampling"
                )
        browser.close()
        return report('tiles', fails, ' · '.join(notes) + f" · {len(NONLOCAL)} flags")


if __name__ == '__main__':
    sys.exit(main())
