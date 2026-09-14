"""Library search: designer-language queries find useful modules and Looks.

    python3 tests/search.py
"""
import sys
from playwright.sync_api import sync_playwright
from helpers import launch, load_assets, report

# Must-find sets. Extra hits are allowed; a missing id fails.
EXPECT = {
    'distort':  {'modules': ['fx-warp', 'fx-displace', 'fx-polar', 'fx-lens'],
                 'looks': ['s-liquid']},
    'print':    {'modules': ['trt-press', 'trt-riso', 'trt-halftone', 'trt-hatch'],
                 'looks': ['s-cutup', 's-pattern', 's-hatched']},
    'combine':  {'modules': ['mx-type', 'mx-blend', 'fx-matte'],
                 'looks': ['s-pattern', 's-flowfield', 's-cut', 's-states']},
    'prepared': {'modules': [],
                 'looks': ['s-cut', 's-states']},
    'window':   {'modules': ['fx-matte', 'kt-knockout', 'mx-type'],
                 'looks': ['s-opart', 's-knockout', 's-pattern']},
    'logo':     {'modules': ['lg-ripple', 'mx-logo', 'lg-sting'],
                 'looks': ['s-ripple', 's-sting']},
    'scan':     {'modules': ['tr-scanner', 'fx-slitscan', 'fx-scanbar'],
                 'looks': ['s-scan']},
    'repeat':   {'modules': ['fx-tile', 'fx-kaleido', 'lg-pattern'],
                 'looks': ['s-kaleido']},
    'texture':  {'modules': ['trt-surface', 'trt-grain', 'ovl-scratches'],
                 'looks': ['s-hatched']},
    'reveal':   {'modules': ['kt-reveal', 'lg-sting', 'tr-iris'],
                 'looks': ['s-headline', 's-sting']},
    'feedback': {'modules': ['fx-echo', 'fx-melt', 'fx-datamosh'],
                 'looks': ['s-solid']},
    'crop':     {'modules': ['fx-reframe'], 'looks': []},
    'zoom':     {'modules': ['fx-reframe'], 'looks': []},
    'pan':      {'modules': ['fx-reframe'], 'looks': []},
}


def main():
    with sync_playwright() as p:
        browser, page, errors = launch(p)
        load_assets(page)
        tagged = page.evaluate('() => FX.modules.filter(m => m.search && m.search.length).length')
        bad = list(errors)
        for q, exp in EXPECT.items():
            res = page.evaluate('q => fxlab.searchLibrary(q)', q)
            for mid in exp['modules']:
                if mid not in res['modules']:
                    bad.append(f'{q}: missing module {mid} (got {len(res["modules"])})')
            for lid in exp['looks']:
                if lid not in res['looks']:
                    bad.append(f'{q}: missing look {lid} (got {res["looks"]})')
        if tagged < 30:
            bad.append(f'expected search metadata on ~40 modules, got {tagged}')
        browser.close()
    return report('search', bad, f'{len(EXPECT)} queries · {tagged} tagged modules')


if __name__ == '__main__':
    sys.exit(main())
