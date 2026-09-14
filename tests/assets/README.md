# Test assets

Drop a brand-asset zip (fonts and logos) in here — or loose files in this
folder and its subfolders — and the tests will import them before rendering,
so brand roles, asset fonts and logo modules are exercised. Anything in this
folder is ignored by git — these are licensed files.

Accepted: .zip, .fxkit, .otf, .ttf, .woff, .woff2, .svg, .png

The tests run fine with this folder empty; they just fall back to system fonts
and the built-in placeholder images.
