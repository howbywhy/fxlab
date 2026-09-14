"""Run the whole suite. Use this before saying a change works.

    python3 tests/run_all.py
"""
import subprocess, sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent
SUITE = ['render_all.py', 'looks.py', 'seams.py', 'tiles.py', 'compositions.py', 'exports.py', 'search.py', 'lifecycle.py']


def main():
    code = 0
    for name in SUITE:
        r = subprocess.run([sys.executable, str(HERE / name)])
        code |= r.returncode
    print('\nall passed' if code == 0 else '\nsomething failed')
    return code


if __name__ == '__main__':
    sys.exit(main())
