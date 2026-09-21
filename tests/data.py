"""Data layer: parsing, type inference, caps, binding, projects, and the data modules.

    python3 tests/data.py           # offline: samples, parsers, binding, projects, rendering
    python3 tests/data.py --live    # also fetch each curated public source from a file:// page

The live check needs a network and can fail when a provider changes; it is not part of run_all.
"""
import pathlib, sys
from playwright.sync_api import sync_playwright
from helpers import launch, load_assets, report

HERE = pathlib.Path(__file__).resolve().parent
JS = (HERE / 'data_check.js').read_text()
JS_LIVE = (HERE / 'data_live.js').read_text()


def main():
    live = '--live' in sys.argv
    with sync_playwright() as p:
        browser, page, errors = launch(p)
        load_assets(page)
        res = page.evaluate(JS)
        extra = f"{res['drawn']} module×sample renders"
        bad = list(res['bad']) + list(errors)
        if live:
            lv = page.evaluate(JS_LIVE)
            bad += lv['bad']
            extra += ' · live: ' + ', '.join(lv['out'])
        browser.close()
    return report('data', bad, extra)


if __name__ == '__main__':
    sys.exit(main())
