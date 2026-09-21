"""Vector (SVG) sources and the vector effects.

Loads test SVGs as source A, renders every fx-svg-* module, and checks that a source SVG is
drawn at the size the frame needs instead of being stretched from a fixed raster.

    python3 tests/svg.py
"""
import sys, tempfile, pathlib
from playwright.sync_api import sync_playwright
from helpers import launch, report

# path, circle, rect, polygon, a transform, a viewBox with a negative origin.
BASIC = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 300 300">
  <path d="M0 0 C60 -40 120 40 180 0 S 200 90 100 120 Q 40 150 0 100 Z" fill="#ff5a36" stroke="#141516" stroke-width="4"/>
  <circle cx="150" cy="150" r="40" fill="none" stroke="#3b8f8c" stroke-width="5"/>
  <rect x="-30" y="150" width="70" height="50" rx="8" fill="#f4b942"/>
  <g transform="translate(200 20) rotate(25)"><polygon points="0,0 60,10 40,60 -10,50" fill="#7b5cff" stroke="#000" stroke-width="3"/></g>
  <line x1="-40" y1="-40" x2="240" y2="-30" stroke="#000" stroke-width="2"/>
  <polyline points="10,220 40,190 70,225 100,190" fill="none" stroke="#ff5a36" stroke-width="3"/>
</svg>'''

# Hand-exported style: CSS classes, a gradient, relative and arc commands with packed flags,
# a nested transform, and things the effects skip (text, use).
COMPLEX = '''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="400pt" height="300pt" viewBox="-120 -80 400 300">
  <defs><linearGradient id="g"><stop offset="0" stop-color="#2255cc"/><stop offset="1" stop-color="#cc2255"/></linearGradient>
    <style>.a{fill:none;stroke:#e0421f;stroke-width:3}.b{fill:url(#g);stroke:none}</style>
    <path id="p" d="M0 0h10v10z"/></defs>
  <g transform="matrix(.9 .1 -.1 .9 10 5)">
    <path class="a" d="m-100,-60 c40,-30 80,30 120,0 s70,-40 110,10 t60,30 l-10,60 h-60 v20 z"/>
    <path class="b" d="M-90 80a40 40 0 1 1 80 0a40 40 0 1 1-80 0zM-70 80a20 20 0 1 0 40 0a20 20 0 1 0-40 0z" fill-rule="evenodd"/>
    <path class="a" d="M100 90 a30 20 30 0 1 60 10 M100 130 A20 20 0 01 140 150"/>
  </g>
  <use xlink:href="#p"/><text x="0" y="0">skipped</text>
  <ellipse cx="200" cy="-40" rx="30" ry="12" style="fill:#f4b942;stroke:#000;stroke-width:2"/>
</svg>'''

# A flat illustration in the way a designer's export looks: a gradient backdrop, CSS classes, a
# transform, an even-odd ring, overlapping filled shapes, a dashed line. The backdrop rect covers
# the whole artboard, which is the case the window effect has to cope with.
REAL = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2a5b"/><stop offset="1" stop-color="#e2553a"/></linearGradient>
  <style>.ln{fill:none;stroke:#f4efe6;stroke-width:5;stroke-linecap:round}.fl{fill:#f4b942}</style></defs>
  <rect x="40" y="40" width="720" height="920" rx="24" fill="url(#sky)"/>
  <circle cx="400" cy="380" r="170" class="fl"/>
  <path d="M40 700 C160 560 260 560 360 660 S560 720 760 560 L760 960 L40 960Z" fill="#1b1f2b"/>
  <path d="M40 800 C200 700 300 760 420 800 S640 820 760 740 L760 960 L40 960Z" fill="#3b8f8c"/>
  <path d="M120 960 L260 620 L400 960Z" fill="#f4efe6"/>
  <path d="M300 960 L500 560 L700 960Z" fill="#7b5cff"/>
  <path fill-rule="evenodd" d="M560 120a60 60 0 1 0 0.01 0zM560 150a30 30 0 1 1-0.01 0z" fill="#f4efe6"/>
  <g transform="translate(150 250) rotate(-20)"><path d="M0 0 C40 -60 100 -60 140 0 C100 60 40 60 0 0Z" fill="#3b8f8c" stroke="#f4efe6" stroke-width="4"/><path d="M0 0 L140 0" class="ln"/></g>
  <path class="ln" d="M100 120 C200 60 300 180 420 110 S620 100 700 200"/>
  <path class="ln" d="M100 900 L700 900" stroke-dasharray="10 14"/>
  <polygon points="620,820 700,760 740,860 660,900" fill="#e2553a" stroke="#141516" stroke-width="3"/>
</svg>'''

# a hairline, for the sharpness check
HAIR = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <rect width="1000" height="1000" fill="#ffffff"/><line x1="500" y1="0" x2="500" y2="1000" stroke="#000" stroke-width="2"/></svg>'''

JS_LOAD = """async (id) => {
  const a = Assets.images().find(x => x.id === id) || Assets.images().slice(-1)[0];
  useAssetAsSource('A', a.id); return a.id;
}"""

JS_RENDER = """async (ids) => {
  const f = window.fxlab, E = f.Engine, S = f.state, bad = {}, blank = [];
  f.App.playing = false;
  S.W = 540; S.H = 675; E.setSize(S.W, S.H, 1);
  const ready = async () => { for (let i = 0; i < 100; i++){ if ([...SvgFx.cache.values()].every(r => r.state !== 'loading')) return; await new Promise(r => setTimeout(r, 50)); } };
  const px = () => { const b = new Uint8Array(E.last.w * E.last.h * 4); E.read(E.last, b); return b; };
  for (const id of ids){
    E.resetFeedback(S.stack);
    S.base = f.makeInst('src-a'); S.stack = [f.makeInst(id)];
    for (const t of [0.5, 1.6, 2.7]){
      try { f.renderAt(t); await ready(); f.renderAt(t); } catch (e){ bad[id] = String(e).slice(0, 200); }
    }
    if (E.errors[id]) bad[id] = E.errors[id];
    /* ground is #141516: count pixels that differ from it */
    const b = px(); let on = 0;
    for (let i = 0; i < b.length; i += 4) if (Math.abs(b[i] - 20) + Math.abs(b[i + 1] - 21) + Math.abs(b[i + 2] - 22) > 60) on++;
    if (on < 300) blank.push(id + ':' + on);
  }
  return { bad, blank };
}"""

JS_LOOP = """async (ids) => {
  const f = window.fxlab, E = f.Engine, S = f.state, bad = {};
  f.App.playing = false; S.W = 300; S.H = 375; E.setSize(S.W, S.H, 1);
  const ready = async () => { for (let i = 0; i < 100; i++){ if ([...SvgFx.cache.values()].every(r => r.state !== 'loading')) return; await new Promise(r => setTimeout(r, 50)); } };
  const px = () => { const b = new Uint8Array(E.last.w * E.last.h * 4); E.read(E.last, b); return b; };
  for (const id of ids){
    E.resetFeedback(S.stack); S.base = f.makeInst('src-a'); S.stack = [f.makeInst(id)];
    f.renderAt(0); await ready(); f.renderAt(0); const a = px();
    f.renderAt(S.duration - 1e-4); const b = px(); let d = 0;
    for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 40) d++;
    if (d > 1200) bad[id] = d;
  }
  return bad;
}"""

JS_SHARP = """async () => {
  const f = window.fxlab, E = f.Engine, S = f.state;
  f.App.playing = false; S.W = 500; S.H = 500; S.base = f.makeInst('src-a'); S.stack = [];
  S.sources.A.fit = 1; S.sources.A.zoom = 2; S.sources.A.x = 0; S.sources.A.y = 0;
  const out = {};
  for (const q of [1, 4]){
    E.setSize(S.W, S.H, q); f.renderAt(1);
    const w = E.last.w, buf = new Uint8Array(w * E.last.h * 4); E.read(E.last, buf);
    const row = Math.floor(E.last.h / 2) * w * 4; let dark = 0, mid = 0;
    for (let x = 0; x < w; x++){ const v = buf[row + x * 4]; if (v < 40) dark++; else if (v < 215) mid++; }
    out[q] = { w, dark, mid, raster: E.media.A.el.width };
  }
  E.setSize(S.W, S.H, .5);
  return out;
}"""


def main():
    tmp = pathlib.Path(tempfile.mkdtemp())
    files = {'basic.svg': BASIC, 'complex.svg': COMPLEX, 'hair.svg': HAIR, 'real.svg': REAL}
    for n, t in files.items():
        (tmp / n).write_text(t)
    fails = []
    with sync_playwright() as p:
        browser, page, errors = launch(p)
        ids = page.evaluate("() => FX.modules.filter(m => m.id.startsWith('fx-svg-')).map(m => m.id)")
        if len(ids) < 19:
            fails.append(f'expected the vector modules, found {ids}')
        # 1. the sample, with no SVG loaded
        res = page.evaluate(JS_RENDER, ids)
        if res['bad'] or res['blank']:
            fails.append(f'sample: {res}')
        # 2. real SVGs as source A, and as source B
        for n in ('basic.svg', 'complex.svg'):
            page.set_input_files('#fileAssets', [str(tmp / n)])
            page.wait_for_function(f"() => Assets.images().some(a => a.file === '{n}')", timeout=30000)
            page.evaluate("(f) => { const a = Assets.images().find(x => x.file === f); useAssetAsSource('A', a.id); }", n)
            res = page.evaluate(JS_RENDER, ids)
            if res['bad'] or res['blank']:
                fails.append(f'{n}: {res}')
            info = page.evaluate("() => { const r = [...SvgFx.cache.entries()].filter(([k]) => k !== 'sample').map(([k, v]) => [v.state, v.shapes && v.shapes.length, v.skipped]); return r; }")
            print('      parsed', n, info[-1])
        # the illustration: every effect draws it, and every one that loops closes on its first frame
        page.set_input_files('#fileAssets', [str(tmp / 'real.svg')])
        page.wait_for_function("() => Assets.images().some(a => a.file === 'real.svg')", timeout=30000)
        page.evaluate("() => { useAssetAsSource('A', Assets.images().find(x => x.file === 'real.svg').id); }")
        res = page.evaluate(JS_RENDER, ids)
        if res['bad'] or res['blank']:
            fails.append(f'real.svg: {res}')
        # the first eight run on the timeline or have their own loop options; part two loops by default
        first = {'lines', 'hand', 'drawon', 'dots', 'stitch', 'echo', 'warp', 'plotter'}
        loop = page.evaluate(JS_LOOP, [i for i in ids if i[7:] not in first])
        if loop:
            fails.append(f'real.svg loop seam (pixels differing between the first and last frame): {loop}')
        cx = page.evaluate("() => { const r = [...SvgFx.cache.entries()].filter(([k]) => k !== 'sample'); return r.map(([, v]) => v.shapes ? v.shapes.length : -1); }")
        if cx[:2] != [6, 4] or cx[2] < 8:
            fails.append(f'shape counts {cx}, expected [6, 4, 8+]')
        # the source hint appears
        if not page.evaluate("() => /Vector file/.test(document.querySelector('#slots').textContent)"):
            fails.append('no vector hint under the source')
        # 3. sharpness: a 2 unit line stays thin when the frame is rendered large
        page.set_input_files('#fileAssets', [str(tmp / 'hair.svg')])
        page.wait_for_function("() => Assets.images().some(a => a.file === 'hair.svg')", timeout=30000)
        page.evaluate("() => { useAssetAsSource('A', Assets.images().find(x => x.file === 'hair.svg').id); }")
        sh = page.evaluate(JS_SHARP)
        lo, hi = sh['1'], sh['4']
        if hi['raster'] < 4000 or lo['raster'] >= hi['raster']:
            fails.append(f'raster did not grow with the frame: {sh}')
        if hi['dark'] < 7 or hi['mid'] > 2:
            fails.append(f'line went soft at 4x: {sh}')
        errors = [e for e in errors if 'favicon' not in e]
        browser.close()
    return report('svg', fails or errors, f'{len(ids)} vector modules')


if __name__ == '__main__':
    sys.exit(main())
