"""Every module has a picker thumbnail, and no thumbnail is left over for a module that's gone.

    python3 tests/thumbs.py     # if it fails: ./build.sh && python3 tools/thumbs.py && ./build.sh
"""
import sys
from playwright.sync_api import sync_playwright
from helpers import launch, report


def main():
    with sync_playwright() as p:
        browser, page, errors = launch(p)
        res = page.evaluate("() => ({ ids: FX.modules.map(m => m.id), have: Object.keys(THUMBS), bad: Object.entries(THUMBS).filter(([k, v]) => !/^UklGR/.test(v)).map(([k]) => k) })")
        # 'On my image': thumbnails redraw from the current picture and the composition is left as it was
        page.evaluate("() => { const F = window.fxlab; F.App.playing = false; F.setLibTarget('finish'); F.App.libLive = true; F.renderLibrary(); }")
        page.wait_for_timeout(2500)
        live = page.evaluate("() => ({ n:[...document.querySelectorAll('#libList .item .th')].filter(t => t.style.backgroundImage.includes('data:image/jpeg')).length, W:window.fxlab.state.W, H:window.fxlab.state.H, ex:window.fxlab.App.exporting })")
        browser.close()
        if live['n'] < 3: errors.append(f"live previews drew {live['n']} thumbnails")
        if live['W'] != 1080 or live['H'] != 1350 or live['ex']: errors.append(f'live previews left the frame changed: {live}')
    bad = list(errors)
    missing = [i for i in res['ids'] if i not in res['have']]
    extra = [i for i in res['have'] if i not in res['ids']]
    if missing: bad.append(f'no thumbnail for {missing}')
    if extra: bad.append(f'thumbnails for modules that no longer exist: {extra}')
    if res['bad']: bad.append(f"not WebP data: {res['bad']}")
    return report('thumbs', bad, f"{len(res['ids'])} modules")


if __name__ == '__main__':
    sys.exit(main())
