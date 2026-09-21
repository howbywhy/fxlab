"""Library search: designer-language queries find useful modules.

    python3 tests/search.py
"""
import sys
from playwright.sync_api import sync_playwright
from helpers import launch, load_assets, report

# Must-find sets. Extra hits are allowed; a missing id fails.
EXPECT = {
    'distort':  ['fx-warp', 'fx-displace', 'fx-polar', 'fx-lens'],
    'print':    ['trt-press', 'trt-riso', 'trt-halftone', 'trt-hatch'],
    'combine':  ['mx-blend', 'fx-matte'],
    'window':   ['fx-matte', 'mx-shape'],
    'scan':     ['tr-scanner', 'fx-slitscan', 'fx-scanbar'],
    'repeat':   ['fx-tile', 'fx-kaleido'],
    'texture':  ['trt-surface', 'trt-grain', 'ovl-scratches'],
    'feedback': ['fx-echo', 'fx-melt', 'fx-datamosh'],
    'crop':     ['fx-reframe'],
    'zoom':     ['fx-reframe'],
    'pan':      ['fx-reframe'],
}


def main():
    with sync_playwright() as p:
        browser, page, errors = launch(p)
        load_assets(page)
        tagged = page.evaluate('() => FX.modules.filter(m => m.search && m.search.length).length')
        bad = list(errors)
        for q, exp in EXPECT.items():
            res = page.evaluate('q => fxlab.searchLibrary(q)', q)
            for mid in exp:
                if mid not in res['modules']:
                    bad.append(f'{q}: missing module {mid} (got {len(res["modules"])})')
        if tagged < 15:
            bad.append(f'expected search metadata on ~20 modules, got {tagged}')
        browser.close()
    return report('search', bad, f'{len(EXPECT)} queries · {tagged} tagged modules')


if __name__ == '__main__':
    sys.exit(main())
