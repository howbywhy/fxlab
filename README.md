# fxlab

A browser-based library for exploring and finding art-directed digital identity
languages in images and video: how two images meet, how a photograph is
rewritten, how a surface claims the frame, how time writes the image, how a
field is generated, how data drives it. Stills, motion and print come out of
the same work.

A language is a few constants and a large space of variation. fxlab is where
you find the constants by working on real material. Typography, logos and
presets are deliberately not part of it — see `docs/art-directed-identity-languages.md`
for the research and the reasoning.

Everything builds into **one self-contained `fxlab.html`** you open by
double-clicking. No server, no install, works offline. The same file can be
hosted (Vercel) so you can open the app on another computer. Hosting is the
app only — it does not sync projects, assets or saved looks.

```sh
./build.sh                 # → dist/fxlab.html (and dist/index.html for hosts)
python3 tests/run_all.py   # render every module, loop, export and print path
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

**Cross-computer:** images, palette, saved looks and the export-folder
handle live in **that browser’s IndexedDB**. Opening the URL on another
computer does not transfer them. Save a project (`.fxlab.json`) and a kit
(`.fxkit`) and import them there. Do not expect cloud sync.

## How it works

The screen is one tab per task: **Images**, **Combine**, **Finish**, **Data**,
**Colour**, **Language**, **Export**. The stage, timeline and Undo stay put; the panel changes.

**Poster** (switch at the top left) is a separate, lightweight layout tool for
stills and collage: drop or paste images, add text and shapes, then move, scale,
rotate, blend and adjust each layer. Pictures can be cut out (erase and restore
brushes, colour key, crop), given torn, scissor or deckle edges with a paper rim,
a sticker outline, clipped inside another layer, and take any FX Lab treatment or
effect. Marks layers take pencil, charcoal, marker, spray, ink and stipple brushes.
It exports PNG or JPEG at up to 3× and saves `.fxposter.json` files that carry
their images.

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
- **Stack** modules (treatments, effects, overlays)
  read `uInput` — the result of everything above them — and run top to bottom.
  They can still sample the bound A/B (`fx-matte` does this) but not a second
  processed layer from the stack.
- A saved look owns Prepare the same way it owns the stack. Missing `process` means
  `[]`. Changing the photograph keeps the lane. Randomise is scoped (Prepare /
  Combine / Finish, plus Finish categories) and never adds ineligible modules
  to Prepare. Unchecked stages stay as they are. Scope is a UI preference,
  not project content. Undo / Redo (⌘Z / Ctrl+Z) covers composition edits
  as one snapshot each; slider drags coalesce; history is session-only.
- **Data**: one table at a time (`src/data.js`), loaded from a sample, a file,
  pasted text or an address. Any range control can be linked to a column
  (`inst.bind`), and the Data visuals (`dv-*`) draw the table directly. Rows are
  capped at 2000, columns at 24, and API keys are never saved in a project.
- Modules are either **GLSL** (a fragment function `fx(uv)`) or **Canvas 2D**
  (`kind:'2d'` with a `draw(ctx, api)`). 2D stack modules receive the incoming
  processed frame as `api.input` (the current preview or print-tile buffer).
  The engine also pre-paints that frame before `draw()` runs.
- The inspector is three persistent stages: **Prepare**, **Combine**,
  **Finish**. Internally those are still `sources.A/B.process`, `state.base`
  and `state.stack`. The Library can filter to the stage you are adding to.
- The Library lists modules only; nothing ships pre-made. Search matches names,
  descriptions, category labels, and optional invisible `search` keywords.
  Technical categories stay; those keywords are designer language, not a
  second taxonomy.
- `fx-reframe` crops, pans and scales the current processed frame. It
  defaults to identity so adding it does not change the picture.

## Source layout

| File | What it holds |
| --- | --- |
| `src/head.html` | The whole UI: markup and CSS. The build appends the script to it. |
| `src/registry.js` | `FX.register`, categories, param helpers (`R I C T S X`), `Util`. The header comment is the module-authoring guide that ships to users. |
| `src/glsl.js` | Vertex shader, GLSL prelude (helpers, uniforms), fragment assembly, tile-safe sampling. |
| `src/engine.js` | WebGL2 renderer: program cache, ping-pong targets, feedback buffers, aux canvases, the Canvas 2D path, tiled rendering for print. |
| `src/assets.js` | Images and palette in IndexedDB; zip and `.fxkit` reading. |
| `src/identity.js` | Colour roles (colourways), motion tokens, role resolution. |
| `src/sketch.js` | `Sketch` helpers for Canvas 2D modules: seeded random, ground, palette picks, colour mixing. |
| `src/data.js`, `src/data_samples.js` | Table parsing (CSV, JSON, GeoJSON, columnar), type inference, sampling, control linking, API fetch; real sample datasets and the curated public sources. |
| `src/modules/*.js` | The library. One file per group; `custom.js` is the user's paste-in block. |
| `src/print.js` | Print documents, tiled rendering, PDF/PNG writers, ink separations. |
| `src/app.js` | State, UI, timeline, projects, exports. |
| `src/language.js`, `src/language_ui.js` | Pinned controls, seeded variation, recipe, tokens and the tool builder; the Language tab, the language board, and the tool (player) mode. |
| `src/arena.js` | Load a public Are.na channel as reference pictures (A/B, pooled palette); one channel, on request, nothing saved. |
| `src/thumbs.js` | Generated by `tools/thumbs.py`: a small WebP of every module for the picker. Don't edit by hand. |
| `src/workspace_ui.js`, `src/data_ui.js` | The tab rail and router, Export tab, hold-to-compare; the Data tab and the control-link popover. |
| `src/*_ui.js` | Image library and palette, Colour tab (colourways, motion, saved looks), Print dialog. |
| `src/vendor/` | mp4-muxer (MIT), inlined for MP4 export. |

`build.sh` concatenates these in order; the order matters because modules use
helpers defined earlier.

## Testing

The tests drive the built file in headless Chromium with a software GL backend,
so they run anywhere.

```sh
python3 tests/render_all.py   # every module compiles and renders
python3 tests/seams.py        # looping modules end where they started
python3 tests/tiles.py        # tiled print output matches a single-pass render
python3 tests/exports.py      # PNG, PNG sequence and MP4 come out as real files
python3 tests/compositions.py # named stacks vs committed golden frames
python3 tests/search.py       # designer-language Library search
python3 tests/lifecycle.py    # Prepare A/B load, saved looks and stale-state
python3 tests/data.py         # parsers, binding, projects, every data module on every sample
python3 tests/workspaces.py   # tabs, picker, keyboard, compare, the Data workflow, layout at 1280×800
python3 tests/language.py     # pins, seeds, tokens, recipe, board, and a real tool built and opened
python3 tests/arena.py        # Are.na import against a mocked API and image host
python3 tests/thumbs.py       # every module has a picker thumbnail
python3 tests/sheet.py out.png --cat treatment    # look at the work, don't guess
```

Put images (or a zip of them) in `tests/assets/` (git-ignored), or loose files
in that folder and its subfolders, and the tests import them first, so the
asset paths get exercised.

## Things that will bite you

- **Preview vs output.** `uRes` is the output size; the preview may render
  smaller. Use `uPx` (output px per rendered px) for anything hairline.
- **Tiled print.** Print renders in tiles, so a module that samples far outside
  its own pixel needs `nonLocal: true` on `FX.register` or it will seam.
  `tests/tiles.py` catches this.
- **Loops.** Drive motion from `uLoop` in whole cycles. Random per-item speeds
  break the loop; `tests/seams.py` catches that.
- **Colour roles.** Colour params resolve from role links before
  modules see them. A module that wants dark ink on light paper must opt out
  with `C('ink', 'Ink', '#141516', false)`.
- **Feedback and aux.** `feedback:true` gives `uPrev`; check its alpha to detect
  an unwritten buffer and seed from it. `aux()` draws a whole-frame helper
  canvas, even when rendering one tile.

- **Data caps.** More than 2000 rows are thinned evenly (the last row always
  survives) and the Data tab says so. Columns past 24 are dropped.
- **Data from the web.** A page opened from a file can only read servers that
  allow it (CORS). `python3 tests/data.py --live` checks the curated list. Keys go
  in headers and stay in memory; a key in a URL is blanked when a project is saved.
- **Time and year columns are axes.** They place rows, so auto-pick never plots
  them as values.

- **Tools.** `./build.sh` writes the app with a gzip of itself inside, so it can make
  tools. `dist/fxlab.html` is about 1 MB; a tool is about half that (no thumbnails).
- **Never write a literal closing script tag in source**: it ends the script early.

## Licence

mp4-muxer is MIT (see the header in `src/vendor/`). The rest is yours.
