"""Deterministic multi-module composition regression.

Renders a small matrix of named stacks through the real engine path, then
compares each frame to a committed golden PNG. This is a guardrail for later
composition-engine work — not a visual-quality suite.

    python3 tests/compositions.py            # compare against goldens
    python3 tests/compositions.py --write    # regenerate goldens (inspect them)

Each row is a different architectural interaction. Wall-clock grain / flicker
modules are avoided; times and timeline settings are pinned.
"""
import argparse, base64, io, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
from helpers import ROOT, launch, load_assets, report

HERE = Path(__file__).resolve().parent
GOLDEN = HERE / 'goldens' / 'compositions'
ACTUAL = Path('/tmp/fxlab-compositions')

# Output size used for every row. quality=1 so preview scale cannot add noise.
W, H = 480, 600
COMMON = dict(W=W, H=H, quality=1, duration=4, loopMode='once', easing='Linear', hold=0, t=1.6, warmup=0)

# A pixel is "changed" if any channel differs by more than PIXEL. A row fails
# if the changed fraction exceeds PCT. SwiftShader + Canvas 2D text should be
# bit-stable at quality=1; these numbers only cover hairline AA drift.
PIXEL = 8
PCT = 0.4
# "Did something": stack vs base-only must differ on at least this fraction.
ALTER_PCT = 2.0

ROWS = [
    {
        'name': 'mix-type-press-frame',
        'why': 'mix base → 2D type over frame → print treatment → overlay',
        'alters': True,
        'base': {'id': 'mx-shape'},
        'stack': [
            {'id': 'kt-tape'},
            {'id': 'trt-press'},
            {'id': 'ovl-frame'},
        ],
    },
    {
        'name': 'gen-logo-press',
        'why': 'generator + brand-linked logo + print treatment',
        'alters': True,
        'brand': True,
        'base': {'id': 'gen-stripes'},
        'stack': [
            {'id': 'lg-logo', 'params': {'size': 48, 'entry': 0, 'motion': 0}},
            {'id': 'trt-press'},
        ],
    },
    {
        'name': 'wipe-polar-type',
        'why': 'transition mid-wipe + nonLocal polar + 2D type over the result',
        'alters': True,
        't': 2.0,
        'base': {'id': 'tr-wipe'},
        'stack': [
            {'id': 'fx-polar'},
            {'id': 'kt-fit', 'params': {'ground': 0, 'motion': 4}},
        ],
    },
    {
        'name': 'echo-letterbox',
        'why': 'feedback effect with preroll, then a GLSL overlay',
        'alters': True,
        'warmup': 30,
        'base': {'id': 'src-a'},
        'stack': [
            {'id': 'fx-echo', 'params': {'zoom': 1.045, 'rotate': .8, 'decay': .92}},
            {'id': 'ovl-letterbox'},
        ],
    },
    {
        'name': 'duotone-type',
        'why': 'GLSL treatment then Canvas 2D type drawn over the incoming frame',
        'alters': True,
        'base': {'id': 'src-a'},
        'stack': [
            {'id': 'trt-duotone'},
            {'id': 'kt-fit', 'params': {'ground': 0, 'motion': 4, 'text': 'ON\nTHE\nIMAGE'}},
        ],
    },
    {
        'name': 'kaleido-grid',
        'why': 'nonLocal whole-frame sampler (print.js list) under an overlay',
        'alters': True,
        'base': {'id': 'src-a'},
        'stack': [
            {'id': 'fx-kaleido'},
            {'id': 'ovl-grid'},
        ],
    },
    {
        'name': 'brand-logo-type',
        'why': 'brand-role logo and type over source A — protects asset loading',
        'alters': True,
        'brand': True,
        'base': {'id': 'src-a'},
        'stack': [
            {'id': 'kt-fit', 'params': {'ground': 0, 'motion': 4, 'text': 'PLAY\nTOGETHER'}},
            {'id': 'lg-logo', 'params': {'size': 22, 'y': -.82, 'entry': 0, 'motion': 0}},
        ],
    },
    {
        'name': 'look-knockout',
        'why': 'one starter look through applyLook (look application path)',
        'alters': True,
        'look': 's-knockout',
        't': 2.1,
    },
    {
        'name': 'matte-split-processed',
        'why': 'treated generator, then raw B through a stack-level split — not a base mix',
        'alters': True,
        'vsUpstream': True,
        'vsMix': {'id': 'mx-gradient', 'params': {'type': 0, 'angle': 90, 'position': .5, 'soft': .06, 'animate': 0, 'edge': 0}},
        'base': {'id': 'gen-stripes'},
        'stack': [
            {'id': 'trt-duotone'},
            {'id': 'fx-matte', 'params': {
                'replace': 1, 'mode': 0, 'position': .5, 'angle': 90, 'soft': .06, 'amount': 1, 'invert': 0,
            }},
            {'id': 'ovl-frame'},
        ],
    },
    {
        'name': 'matte-luma-kaleido',
        'why': 'kaleido of A, then raw-A luma punches Source B through the processed frame',
        'alters': True,
        'vsUpstream': True,
        'vsMix': {'id': 'mx-luma', 'params': {'source': 0, 'threshold': .45, 'soft': .08, 'invert': 0}},
        'base': {'id': 'src-a'},
        'stack': [
            {'id': 'fx-kaleido'},
            {'id': 'fx-matte', 'params': {
                'replace': 1, 'mode': 1, 'from': 0, 'threshold': .45, 'soft': .08, 'amount': 1, 'invert': 0,
            }},
        ],
    },
    {
        'name': 'input-hud-feed',
        'why': 'Canvas 2D HUD samples api.input: processed frame appears again as a scaled inset',
        'alters': True,
        'vsUpstream': 'ovl-hud',
        'base': {'id': 'gen-stripes'},
        'stack': [
            {'id': 'trt-duotone'},
            {'id': 'ovl-hud', 'params': {
                'feed': True, 'rec': False, 'crosshair': False, 'meta': False,
                'label': 'FEED', 'margin': 6, 'bracket': 5, 'stroke': 3,
            }},
        ],
    },
    {
        'name': 'grade-then-reframe',
        'why': 'halftone the frame, then crop — proves fx-reframe samples processed uInput',
        'alters': True,
        'vsUpstream': 'fx-reframe',
        'base': {'id': 'src-a'},
        'stack': [
            {'id': 'trt-halftone', 'params': {'cell': 14, 'cmyk': False}},
            {'id': 'fx-reframe', 'params': {'scale': 2.8, 'x': .42, 'y': .55}},
        ],
    },
    {
        'name': 'reframe-then-grade',
        'why': 'same crop first, then halftone — order changes the screen relative to the letter',
        'alters': True,
        'vsUpstream': 'trt-halftone',
        'base': {'id': 'src-a'},
        'stack': [
            {'id': 'fx-reframe', 'params': {'scale': 2.8, 'x': .42, 'y': .55}},
            {'id': 'trt-halftone', 'params': {'cell': 14, 'cmyk': False}},
        ],
    },
    {
        'name': 'empty-lanes-identity',
        'why': 'explicit empty source process must match pre-lane grade-then-reframe',
        'compare_to': 'grade-then-reframe',
        'alters': True,
        'vsUpstream': 'fx-reframe',
        'processA': [],
        'processB': [],
        'base': {'id': 'src-a'},
        'stack': [
            {'id': 'trt-halftone', 'params': {'cell': 14, 'cmyk': False}},
            {'id': 'fx-reframe', 'params': {'scale': 2.8, 'x': .42, 'y': .55}},
        ],
    },
    {
        'name': 'lane-treated-tiles',
        'why': 'processed A and processed B meet through existing tr-tiles',
        'alters': True,
        'vsRaw': True,
        't': 2.0,
        'processA': [{'id': 'trt-splittone', 'params': {
            'shadow': '#0a1c4a', 'mid': '#2a5080', 'high': '#c8e8ff',
            'shadowAmt': 1.2, 'midAmt': .8, 'highAmt': 1.1,
            'saturation': .05, 'contrast': 1.4, 'exposure': .05,
        }}],
        'processB': [{'id': 'trt-riso', 'params': {
            'ink1': '#ff2d6a', 'ink2': '#ffe14a', 'paper': '#fff6d8',
            'offset': 8, 'density': 1.4, 'grain': .85, 'gsize': 2,
        }}],
        'base': {'id': 'tr-tiles', 'params': {'tiles': 5, 'pattern': 0, 'mode': 0, 'stagger': .55}},
        'stack': [{'id': 'ovl-letterbox', 'params': {'amount': .1, 'animate': False}}],
    },
    {
        'name': 'lane-reframe-mix',
        'why': 'independently processed A/B through a mix base — not a transition hack',
        'vsRaw': True,
        'processA': [
            {'id': 'fx-reframe', 'params': {'scale': 2.6, 'x': .35, 'y': .45}},
            {'id': 'trt-duotone', 'params': {'dark': '#1a0a28', 'light': '#ff6a2a', 'contrast': 1.6, 'amount': 1}},
        ],
        'processB': [{'id': 'trt-threshold', 'params': {
            'level': .45, 'dark': '#102018', 'light': '#e8ffe0',
        }}],
        'base': {'id': 'mx-gradient', 'params': {
            'type': 0, 'angle': 90, 'position': .5, 'soft': .08, 'animate': 0, 'edge': 0,
        }},
        'stack': [],
    },
]

JS = """(row) => {
  const f = window.fxlab, E = f.Engine, S = f.state;
  f.App.playing = false; f.App.exporting = true;
  S.W = row.W; S.H = row.H; S.duration = row.duration;
  S.loopMode = row.loopMode; S.easing = row.easing; S.hold = row.hold;
  S.bg = '#000000';
  const mk = spec => {
    const inst = f.makeInst(spec.id);
    if (spec.params) Object.assign(inst.params, spec.params);
    return inst;
  };
  if (row.look){
    const lk = f.STARTER_LOOKS.find(l => l.id === row.look);
    if (!lk) return { error: 'unknown look ' + row.look };
    f.applyLook(lk.data, true);
    S.W = row.W; S.H = row.H;
  } else {
    S.base = mk(row.base);
    S.stack = (row.stack || []).map(mk);
  }
  S.sources.A.process = (row.processA || []).map(mk);
  S.sources.B.process = (row.processB || []).map(mk);
  E.setSize(S.W, S.H, row.quality);
  const shoot = t => {
    E.resetFeedback(S.stack);
    const warm = row.warmup | 0;
    for (let i = warm; i >= 0; i--) f.renderAt(t - (warm ? i / 30 : 0));
    return E.canvas.toDataURL('image/png');
  };
  const t = row.t;
  const png = shoot(t);
  let basePng = null, upstreamPng = null, mixPng = null, rawPng = null;
  if (row.alters){
    const saved = S.stack;
    S.stack = [];
    basePng = shoot(t);
    S.stack = saved;
  }
  if (row.vsUpstream){
    const saved = S.stack;
    const cut = typeof row.vsUpstream === 'string' ? row.vsUpstream : 'fx-matte';
    const idx = saved.findIndex(i => i.id === cut);
    S.stack = idx < 0 ? [] : saved.slice(0, idx);
    upstreamPng = shoot(t);
    S.stack = saved;
  }
  if (row.vsMix){
    const savedBase = S.base, savedStack = S.stack;
    S.base = mk(row.vsMix);
    S.stack = [];
    mixPng = shoot(t);
    S.base = savedBase; S.stack = savedStack;
  }
  if (row.vsRaw){
    const savedA = S.sources.A.process, savedB = S.sources.B.process;
    S.sources.A.process = []; S.sources.B.process = [];
    rawPng = shoot(t);
    S.sources.A.process = savedA; S.sources.B.process = savedB;
  }
  const errors = {};
  for (const inst of [S.base, ...S.stack, ...S.sources.A.process, ...S.sources.B.process]){
    if (inst && E.errors[inst.id]) errors[inst.id] = E.errors[inst.id].slice(0, 240);
  }
  const gl = E.gl.getError();
  const logo = [];
  for (const inst of S.stack){
    const P = inst.params;
    for (const k of ['logo', 'symbol', 'wordmark']){
      if (P[k]) logo.push({ id:inst.id, key:k, v:String(P[k]).slice(0, 40) });
    }
  }
  return {
    png, basePng, upstreamPng, mixPng, rawPng, errors, gl,
    stack: [S.base && S.base.id].concat(S.stack.map(i => i.id)),
    logo, images: f.Assets.images().length, fonts: f.Assets.fonts().length,
  };
}"""


def decode_png(url):
    return Image.open(io.BytesIO(base64.b64decode(url.split(',', 1)[1]))).convert('RGB')


def diff_images(act, exp, pixel=PIXEL):
    if act.size != exp.size:
        return {'error': f'size {act.size} vs {exp.size}', 'changed': None}
    aw, ah = act.size
    ap, ep = act.load(), exp.load()
    changed = worst = total = 0
    n = aw * ah
    for y in range(ah):
        for x in range(aw):
            ar, ag, ab = ap[x, y]
            er, eg, eb = ep[x, y]
            d = max(abs(ar - er), abs(ag - eg), abs(ab - eb))
            total += (abs(ar - er) + abs(ag - eg) + abs(ab - eb)) / 3
            if d > worst:
                worst = d
            if d > pixel:
                changed += 1
    return {
        'changed': changed,
        'pct': 100.0 * changed / n,
        'worst': worst,
        'mean': total / n,
        'n': n,
    }


def row_spec(row):
    spec = {**COMMON, **row}
    spec['stack'] = row.get('stack', [])
    return spec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true', help='regenerate golden PNGs')
    args = ap.parse_args()
    GOLDEN.mkdir(parents=True, exist_ok=True)
    failures = []
    extras = []

    with sync_playwright() as p:
        browser, page, errors = launch(p)
        n_assets = load_assets(page)
        page.evaluate('() => document.fonts.ready')
        page.wait_for_timeout(200)
        if n_assets < 1:
            failures.append('no test assets loaded — compositions that need logos will be fiction')
        shots = []
        for row in ROWS:
            spec = row_spec(row)
            res = page.evaluate(JS, spec)
            if errors:
                failures.append(f"{row['name']}: page errors {errors[:2]}")
                errors.clear()
            if res.get('error'):
                failures.append(f"{row['name']}: {res['error']}")
                continue
            if res.get('errors'):
                failures.append(f"{row['name']}: module errors {res['errors']}")
                continue
            if res.get('gl'):
                failures.append(f"{row['name']}: glError {res['gl']}")
                continue
            if row.get('brand'):
                if res.get('images', 0) < 1:
                    failures.append(f"{row['name']}: brand row but Assets.images() is empty")
                if not res.get('logo'):
                    failures.append(f"{row['name']}: brand row but no logo/symbol param resolved")
            im = decode_png(res['png'])
            dest = GOLDEN / f"{row.get('compare_to', row['name'])}.png"
            if args.write and not row.get('compare_to'):
                im.save(dest)
                extras.append(row['name'])
            else:
                if not dest.exists():
                    failures.append(f"{row['name']}: missing golden {dest} — run with --write")
                else:
                    got = diff_images(im, Image.open(dest).convert('RGB'))
                    if got.get('error') or got['pct'] > PCT:
                        ACTUAL.mkdir(parents=True, exist_ok=True)
                        actual = ACTUAL / f"{row['name']}.png"
                        im.save(actual)
                        detail = got.get('error') or (
                            '%s px (%.2f%%) differ, worst %s, mean %.2f' % (
                                got['changed'], got['pct'], got['worst'], got['mean']))
                        failures.append('%s: %s · actual %s · expected %s' % (
                            row['name'], detail, actual, dest))
            if row.get('alters') and res.get('basePng'):
                base = decode_png(res['basePng'])
                got = diff_images(im, base)
                if (got.get('pct') or 0) < ALTER_PCT:
                    failures.append(
                        f"{row['name']}: stack is almost identical to its base "
                        f"({got.get('pct', 0):.2f}% changed) — silent no-op?"
                    )
            if row.get('vsUpstream') and res.get('upstreamPng'):
                got = diff_images(im, decode_png(res['upstreamPng']))
                if (got.get('pct') or 0) < ALTER_PCT:
                    failures.append(
                        f"{row['name']}: almost identical to its upstream uInput "
                        f"({got.get('pct', 0):.2f}% changed) — matte is a no-op?"
                    )
            if row.get('vsMix') and res.get('mixPng'):
                got = diff_images(im, decode_png(res['mixPng']))
                if (got.get('pct') or 0) < ALTER_PCT:
                    failures.append(
                        f"{row['name']}: almost identical to a raw A/B mix "
                        f"({got.get('pct', 0):.2f}% changed) — not stack-level?"
                    )
            if row.get('vsRaw') and res.get('rawPng'):
                got = diff_images(im, decode_png(res['rawPng']))
                if (got.get('pct') or 0) < ALTER_PCT:
                    failures.append(
                        f"{row['name']}: almost identical to raw unprocessed A/B "
                        f"({got.get('pct', 0):.2f}% changed) — lanes are a no-op?"
                    )
            shots.append(row['name'])
        browser.close()

    extra = f"{len(shots)} rows"
    if args.write:
        extra += f" · wrote {len(extras)} goldens → {GOLDEN}"
    extra += f" · {n_assets} assets"
    return report('compositions', failures, extra)


if __name__ == '__main__':
    sys.exit(main())
