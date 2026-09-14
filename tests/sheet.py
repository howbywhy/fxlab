"""Render a contact sheet so you can look at modules instead of guessing.

    python3 tests/sheet.py out.png kt-morph kt-liquid trt-hatch
    python3 tests/sheet.py out.png --cat type --time 1.9 --size 1080x1350

Each module is rendered as a base or a stack layer over source A, depending on
its category, after 30 warm-up frames so feedback modules have built up.
"""
import argparse, base64, io, sys
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
from helpers import launch, load_assets

JS = """([ids, t, W, H]) => {
  const f = window.fxlab, E = f.Engine;
  f.App.playing = false; f.App.exporting = true;
  f.state.W = W; f.state.H = H; E.setSize(W, H, .4);
  const out = [];
  for (const id of ids){
    const m = f.FX.byId[id]; if (!m) continue;
    const role = CATS.find(c => c.id === m.cat).role;
    E.resetFeedback(f.state.stack);
    const inst = f.makeInst(id);
    if (role === 'base'){ f.state.base = inst; f.state.stack = []; }
    else { f.state.base = f.makeInst('src-a'); f.state.stack = [inst]; }
    for (let i = 30; i >= 0; i--) f.renderAt(t - i / 30);
    out.push([id, E.canvas.toDataURL('image/jpeg', .85)]);
  }
  return out;
}"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('ids', nargs='*')
    ap.add_argument('--cat', help='render a whole category instead (type, fx, treatment…)')
    ap.add_argument('--time', type=float, default=1.5)
    ap.add_argument('--size', default='1080x1350')
    ap.add_argument('--cols', type=int, default=6)
    a = ap.parse_args()
    W, H = (int(v) for v in a.size.split('x'))
    with sync_playwright() as p:
        browser, page, errors = launch(p)
        load_assets(page)
        ids = a.ids
        if a.cat:
            ids = page.evaluate('(c) => FX.modules.filter(m => m.cat === c).map(m => m.id)', a.cat)
        if not ids:
            ids = page.evaluate('() => FX.modules.map(m => m.id)')
        shots = page.evaluate(JS, [ids, a.time, W, H])
        browser.close()
    if errors:
        print('page errors:', errors[:3])
    cols = min(a.cols, max(1, len(shots)))
    tw, th = 240, int(240 * H / W) + 22
    rows = (len(shots) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * tw, rows * th), (30, 30, 30))
    draw = ImageDraw.Draw(sheet)
    for i, (mid, url) in enumerate(shots):
        im = Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))).resize((tw - 6, int((tw - 6) * H / W)))
        x, y = (i % cols) * tw, (i // cols) * th
        sheet.paste(im, (x + 3, y + 3))
        draw.text((x + 4, y + th - 17), mid, fill=(230, 230, 230))
    sheet.save(a.out)
    print(f'ok    sheet · {len(shots)} modules → {a.out}')


if __name__ == '__main__':
    sys.exit(main())
