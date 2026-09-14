"""Shared helpers for the fxlab browser tests.

Everything runs against dist/fxlab.html in a headless Chromium with a software
GL backend, so the tests work on a machine with no GPU. Build first:

    ./build.sh && python3 tests/render_all.py
"""
import os, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist' / 'fxlab.html'
URL = DIST.as_uri()
_ASSET_SUFFIXES = ('.zip', '.otf', '.ttf', '.woff', '.woff2', '.svg', '.png', '.fxkit')
ASSETS = [str(p) for p in sorted((ROOT / 'tests' / 'assets').rglob('*'))
          if p.is_file() and p.suffix.lower() in _ASSET_SUFFIXES]

CHROME_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']


def launch(playwright, viewport=(1440, 900), downloads=False):
    """Headless Chromium with WebGL2 on SwiftShader. Returns (browser, page, errors)."""
    if not DIST.exists():
        sys.exit('dist/fxlab.html is missing — run ./build.sh first')
    browser = playwright.chromium.launch(args=CHROME_ARGS)
    ctx = browser.new_context(viewport={'width': viewport[0], 'height': viewport[1]},
                              accept_downloads=downloads)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(f'PAGEERROR: {e}'))
    page.on('console', lambda m: errors.append(m.text)
            if m.type == 'error' and '403' not in m.text else None)
    page.goto(URL)
    page.wait_for_timeout(1200)
    return browser, page, errors


def load_assets(page, paths=None):
    """Import fonts/logos (recursive tests/assets/ scan) so brand roles are exercised."""
    paths = paths or ASSETS
    if not paths:
        return 0
    page.set_input_files('#fileAssets', paths)
    page.wait_for_function('() => window.fxlab.Assets.list.length > 0', timeout=90000)
    page.wait_for_timeout(400)
    return page.evaluate('() => window.fxlab.Assets.list.length')


def report(name, failures, extra=''):
    """Print a one-line result and return the process exit code."""
    if failures:
        print(f'FAIL  {name}: {failures}')
        return 1
    print(f'ok    {name}{" · " + extra if extra else ""}')
    return 0
