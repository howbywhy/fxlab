# fxlab

A browser-based lab for transitions, motion, kinetic type, creative coding,
textures, effects and overlays — with a brand identity system on top, and
exports for social, video and print.

Everything builds into **one self-contained `fxlab.html`** you open by
double-clicking. No server, no install, works offline. The same file can be
hosted (Vercel) so you can open the app on another computer. Hosting is the
app only — it does not sync projects, assets or Looks.

```sh
./build.sh                 # → dist/fxlab.html (and dist/index.html for hosts)
python3 tests/run_all.py   # render every module, look, export and print path
python3 tools/guide.py     # → dist/fxlab-setup-guide.pdf
```

## Local

```sh
./build.sh
open dist/fxlab.html       # or double-click it
```

Projects have a name (Save asks once; Save As… renames). Exports can go to a
folder you choose (Chrome / Edge, File System Access API). If that API is
missing or permission is denied, files download as usual.

## Hosted (Vercel)

This is app hosting only. No login, no cloud projects, no cloud assets.

Vercel runs `./build.sh` and serves `dist/` (`index.html` is a copy of
`fxlab.html`). Connect the git repo, or:

```sh
npx vercel
```

`vercel.json` sets the build command and output directory. There is no npm
app runtime.

Open the hosted URL in a browser. It is the same self-contained app.

**Cross-computer:** fonts, logos, palette, user Looks and the export-folder
handle live in **that browser’s IndexedDB**. Opening the URL on another
computer does not transfer them. Save a project (`.fxlab.json`) and a kit
(`.fxkit`) and import them there. Do not expect cloud sync.

## How it works

Each frame is built the same way:

```
sources A/B  →  optional Prepare A/B  →  base / combine  →  stack / finish  →  canvas
```

- Optional `sources.A.process` / `sources.B.process` **prepare** each fitted
  source before the base. Eligible modules (`FX.laneEligible`): Treatments and
  `fx-reframe` only. Not a second stack, not a precomp, not independently timed.
  Empty lists are a no-op — `uA`/`uB` stay the fit.
- Source **fit / zoom / x / y** is how the file first sits in the frame.
  `fx-reframe` in Prepare is a later creative crop in that source's chain.
- **Base** modules (sources, transitions, mix & mask, generators) read `uA`/`uB`
  (fitted, or prepared) and make the starting frame.
- **Stack** modules (kinetic type, logo & brand, treatments, effects, overlays)
  read `uInput` — the result of everything above them — and run top to bottom.
  They can still sample the bound A/B (`fx-matte` does this) but not a second
  processed layer from the stack.
- A Look owns Prepare the same way it owns the stack. Missing `process` means
  `[]`. Changing the photograph keeps the lane; randomise does not put modules
  in lanes.
- Modules are either **GLSL** (a fragment function `fx(uv)`) or **Canvas 2D**
  (`kind:'2d'` with a `draw(ctx, api)`). 2D stack modules receive the incoming
  processed frame as `api.input` (the current preview or print-tile buffer).
  The engine also pre-paints that frame before `draw()` runs.
- The inspector is three persistent stages: **Prepare**, **Combine**,
  **Finish**. Internally those are still `sources.A/B.process`, `state.base`
  and `state.stack`. The Library can filter to the stage you are adding to.
- The Library lists starter Looks above modules. Search matches names,
  descriptions, category labels, and optional invisible `search` keywords.
  Technical categories stay; those keywords are designer language, not a
  second taxonomy.
- `fx-reframe` crops, pans and scales the current processed frame. It
  defaults to identity so adding it does not change the picture.

## Source layout

| File | What it holds |
| --- | --- |
| `src/head.html` | The whole UI: markup and CSS. The build appends the script to it. |
| `src/registry.js` | `FX.register`, categories, param helpers (`R I C T S X F L`), `Util`. The header comment is the module-authoring guide that ships to users. |
| `src/glsl.js` | Vertex shader, GLSL prelude (helpers, uniforms), fragment assembly, tile-safe sampling. |
| `src/engine.js` | WebGL2 renderer: program cache, ping-pong targets, feedback buffers, aux canvases, the Canvas 2D path, tiled rendering for print. |
| `src/assets.js` | Fonts, logos and palette in IndexedDB; zip and `.fxkit` reading; font-name parsing. |
| `src/identity.js` | Brand roles (colourways, type, logos), motion tokens, role resolution. |
| `src/kt.js` | `KT` type helpers (layout, fit, stagger, easing, wrap) and `Brand` logo helpers. |
| `src/glyphs.js` | Glyph outline tracing (marching squares) and variable-axis detection. |
| `src/modules/*.js` | The library. One file per group; `custom.js` is the user's paste-in block. |
| `src/looks.js` | Starter looks (compositions, not templates). |
| `src/print.js` | Print documents, tiled rendering, PDF/PNG writers, ink separations. |
| `src/app.js` | State, UI, timeline, projects, exports. |
| `src/*_ui.js` | Assets tab, System tab, Print dialog. |
| `src/vendor/` | mp4-muxer (MIT), inlined for MP4 export. |

`build.sh` concatenates these in order; the order matters because modules use
helpers defined earlier.

## Testing

The tests drive the built file in headless Chromium with a software GL backend,
so they run anywhere.

```sh
python3 tests/render_all.py   # every module compiles and renders
python3 tests/looks.py        # every starter look applies
python3 tests/seams.py        # looping modules end where they started
python3 tests/tiles.py        # tiled print output matches a single-pass render
python3 tests/exports.py      # PNG, PNG sequence and MP4 come out as real files
python3 tests/compositions.py # named stacks vs committed golden frames
python3 tests/search.py       # designer-language Library search
python3 tests/lifecycle.py    # Prepare A/B load, Looks and stale-state
python3 tests/sheet.py out.png --cat type    # look at the work, don't guess
```

Put a brand-asset zip in `tests/assets/` (git-ignored), or loose files in that
folder and its subfolders, and the tests import them first, so fonts, logos
and brand roles get exercised.

## Things that will bite you

- **Preview vs output.** `uRes` is the output size; the preview may render
  smaller. Use `uPx` (output px per rendered px) for anything hairline.
- **Tiled print.** Print renders in tiles, so a module that samples far outside
  its own pixel needs `nonLocal: true` on `FX.register` or it will seam.
  `tests/tiles.py` catches this.
- **Loops.** Drive motion from `uLoop` in whole cycles. Random per-item speeds
  break the loop; `tests/seams.py` catches that.
- **Brand roles.** Colour, font and logo params resolve from role links before
  modules see them. A module that wants dark ink on light paper must opt out
  with `C('ink', 'Ink', '#141516', false)`.
- **Feedback and aux.** `feedback:true` gives `uPrev`; check its alpha to detect
  an unwritten buffer and seed from it. `aux()` draws a whole-frame helper
  canvas, even when rendering one tile.

## Licence

mp4-muxer is MIT (see the header in `src/vendor/`). The rest is yours.
