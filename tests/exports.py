"""Export a PNG, a PNG sequence and an MP4, and check the files are real.

    python3 tests/exports.py
"""
import os, sys, tempfile, zipfile
from playwright.sync_api import sync_playwright
from helpers import launch, report

SETUP = """() => { const f = window.fxlab;
  f.state.duration = 1; f.state.fps = 24; f.state.W = 540; f.state.H = 676;
  f.setProjectName('Bounce Qualifier 01'); f.refresh(); }"""


def save(page, selector, path, timeout=180000):
    with page.expect_download(timeout=timeout) as d:
        page.click(selector)
    d.value.save_as(path)
    return d.value.suggested_filename


def main():
    out = tempfile.mkdtemp()
    fails = []
    with sync_playwright() as p:
        browser, page, errors = launch(p, downloads=True)
        page.evaluate(SETUP)
        png = os.path.join(out, 'still.png')
        png_name = save(page, '#btnPng', png)
        if os.path.getsize(png) < 5000:
            fails.append('PNG looks empty')
        if 'bounce-qualifier-01' not in png_name:
            fails.append(f'PNG name was {png_name}')
        zp = os.path.join(out, 'seq.zip')
        save(page, '#btnSeq', zp)
        z = zipfile.ZipFile(zp)
        if len(z.namelist()) != 24 or z.testzip():
            fails.append(f'sequence has {len(z.namelist())} frames')
        vid = os.path.join(out, 'clip.mp4')
        name = save(page, '#btnVideo', vid)
        if os.path.getsize(vid) < 20000:
            fails.append(f'video looks empty ({name})')
        if page.evaluate('() => fxlab.fileStem()') != 'bounce-qualifier-01':
            fails.append('fileStem drifted')
        if 'bounce-qualifier-01' not in name:
            fails.append(f'video name was {name}')
        browser.close()
    return report('exports', fails or errors, out)


if __name__ == '__main__':
    sys.exit(main())
