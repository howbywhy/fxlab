"""Check that looping modules end where they started.

Renders the first and last frame of the loop and counts pixels that differ.
A few hundred is anti-aliasing; thousands means the motion doesn't close —
usually a per-item speed that isn't a whole number of cycles.

Modules that change on a beat, or that run off wall-clock time (grain,
handheld shake), legitimately differ at the loop point. Those are skipped and
listed as notes, either because they have a `beats` param or because they are
in EXPECTED below. Add to that list only with a reason.

    python3 tests/seams.py                 # everything that should loop
    python3 tests/seams.py kt-tape gen-flow
"""
import sys
from playwright.sync_api import sync_playwright
from helpers import launch, load_assets, report

JS = """({ ids, expected }) => {
  const f = window.fxlab, E = f.Engine;
  f.App.playing = false; f.App.exporting = true;
  f.state.W = 300; f.state.H = 375; E.setSize(300, 375, 1);
  const gl = E.gl, px = () => { const a = new Uint8Array(E.rw * E.rh * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, E.rw, E.rh, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
  const skip = new Set(expected);
  const list = ids && ids.length ? ids : f.FX.modules
    .filter(m => !m.feedback && !m.noRandom)
    .filter(m => !m.params.some(p => p.id === 'beats'))   /* beat-driven: a new beat starts at frame 0 */
    .filter(m => !skip.has(m.id))
    .map(m => m.id);
  const out = {};
  for (const id of list){
    const m = f.FX.byId[id]; if (!m) { out[id] = 'unknown'; continue; }
    const role = CATS.find(c => c.id === m.cat).role;
    E.resetFeedback(f.state.stack);
    if (role === 'base'){ f.state.base = f.makeInst(id); f.state.stack = []; }
    else { f.state.base = f.makeInst('src-a'); f.state.stack = [f.makeInst(id)]; }
    f.renderAt(0); const a = px();
    f.renderAt(f.state.duration - 1e-4); const b = px();
    let moved = 0, seam = 0;
    f.renderAt(f.state.duration / 2); const mid = px();
    for (let i = 0; i < a.length; i += 4){
      if (Math.abs(a[i] - b[i]) > 40) seam++;
      if (Math.abs(a[i] - mid[i]) > 40) moved++;
    }
    /* a few hundred pixels is anti-aliasing on thin lines; only flag a real mismatch */
    if (seam > 1200 && moved > 400) out[id] = seam;
  }
  return out;
}"""


EXPECTED = {
    'kt-cycle': 'flicks to a new random style on the beat',
    'kt-words': 'cuts to the next word at the loop point',
    'kt-labels': 'labels clear and restart',
    'kt-stack': 'the solid row jumps to its next position',
    'lg-stamp': 'stamps clear at the loop point',
    'lg-colourways': 'cuts to the next colourway',
    'fx-scangrid': 'the scan line restarts',
    'trt-film': 'grain, weave and dust run off wall-clock time',
    'fx-shake': 'handheld drift runs off wall-clock time',
    'fx-glitch': 'glitch bursts run off wall-clock time',
    'trt-photocopy': 'flicker runs off wall-clock time',
    'kt-captions': 'the caption resets to the first word',
    'ovl-progress': 'a scrubber tracks position and resets each loop, by design',
    'ovl-scratches': 'dust and scratches flicker runs off wall-clock time',
}


def main():
    ids = sys.argv[1:]
    with sync_playwright() as p:
        browser, page, errors = launch(p)
        load_assets(page)
        res = page.evaluate(JS, {"ids": ids, "expected": list(EXPECTED)})
        browser.close()
    return report('seams', res or errors)


if __name__ == '__main__':
    sys.exit(main())
