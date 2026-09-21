# Working on fxlab

Read `README.md` first for the architecture. This file is about how to work
here: the conventions the codebase already follows, and what "done" means.

## What fxlab is

A **library for exploring and finding art-directed digital identity languages**
in images and video, and (later) extracting the ones worth keeping as small
tools that reproduce them.

A language, in the sense studios use it, is a small set of constants and a large
space of variation: a grade, a way two images meet, a texture that claims the
frame, a rule for how time writes the image. fxlab is where you find the
constants by working on real material. See `docs/art-directed-identity-languages.md`
for the research behind this and `docs/research/` for the raw notes.

Modules are **verbs that combine**:

- how two images meet: transitions, mix & mask
- how a photograph is rewritten: treatments (grade, screen, dither, print)
- how a surface claims the frame: texture, grain, glass, foil
- how time writes the image: scans, echoes, melts, datamosh
- how a field is generated: creative-code generators
- how the work is held: overlays, reframe
- how it is driven: data. A table's columns can drive any range control, or be
  drawn directly by the Data visuals

If a module is a finished artefact with fields to fill in (an event poster, a
business card, a scoreboard, a logo sting), it doesn't belong. The test: could
this be the base of a hundred different pieces of work, or is it one piece of
work with the words swapped?

**Typography and logos are out.** They are applications of a language, not the
language, and the library used to sit on 58 modules that made them the centre.
There are no type modules, no font or logo assets, no glyph tracing. **There are
no shipped presets either**: a saved look is something a person found, never
something we hand them. Don't add starter looks, templates or a "pick a look"
entry point. Colour roles and motion tokens stay; they are language material.

The app boots to a photograph with an empty Finish. Keep it that way: the first
thing anyone sees is an image being directed, not an effect stack.

## Working on the UI

One tab per task, in the order the work goes: **Images** (sources and Prepare),
**Combine**, **Finish**, **Data**, **Colour**, **Language**, **Export**. The stage,
timeline and Undo are constant; only the panel beside them changes. Keys 1–7 switch tabs, and
⌘K or `/` opens the module picker for everything.

- The module picker is a drawer over the panel (`#lib`), opened by an Add or
  Change button and closed when a module is chosen. It is never a hidden mode.
  Don't add a persistent Library pane back.
- Each tab shows what its task needs and nothing else. If a control belongs to a
  task, put it in that tab (timing is in Combine, the background is in Export).
- A tab's badge counts what is switched on inside it. If a new feature can hide
  state on another tab, give it a badge.
- Modules show their first six controls; the rest sit under "More controls". Set
  `primary: n` on `FX.register` to change how many.
- Every control needs a name a screen reader can read (`aria-label` or a label),
  and every drag control needs a typed alternative. `tests/workspaces.py` checks
  both at 1280×800 and 1440×900, which are the sizes to design for.
- Empty states offer an action (load a sample, add a layer), never a blank pane.
- Don't introduce presets, templates or "start from a look". Sample *data* is
  fine; a sample *composition* is not.

### Craft rules (from `docs/research/premium_craft.md`)

- Numbers use tabular numerals; nothing shifts width while a value changes.
- Motion uses the tokens in `:root` (`--t-fast` 100ms, `--t-base` 160ms, `--t-slow`
  220ms, `--ease`). Nothing animates on slider drag, keyboard actions, canvas or
  list hover. Under `prefers-reduced-motion` all UI motion is off; the stage stays live.
- Focus is a 2px ring in the accent. Hit areas are at least 24px, even where the
  visual is smaller.
- Contrast: text at least 4.5:1 and control edges and tracks at least 3:1 against the
  panel. `--faint` and `--lamp-dim` were raised for this; don't dim them again.
- Range labels scrub: drag, Shift ×10, Alt ×0.1, double-click resets, a dot marks a
  value changed from its default.
- Chrome stays colour-neutral so the picture is judged correctly; the accent marks
  interaction, orange marks data links.

### Reference boards (Are.na)

`src/arena.js` loads one public channel the person names, on request, through Are.na's
tokenless v2 API. Pictures go to A or B from memory, are never written to the library,
a project, a kit or a tool, and link back to the channel. Only `images.are.na` URLs
are ever fetched, whatever the data says; titles are shown as text. Are.na's terms
forbid bulk collection: no crawling, no caching across sessions, no bundling. Keep it
that way. `tests/arena.py` mocks the API and image host and needs no network.

### Languages and tools

The **Language** tab is what the product is for. A language is the composition (the
constants) plus a few **pinned** controls (`inst.expose`) each with a name and range
(the variation). A seed walks the ranges reproducibly (`Language.variation`, integer
hash, so a seed means the same in every browser). It exports a **tool** (the app
opened on a recipe: composition locked, only pinned controls shown), a **board**
(PNG of variations), the **recipe** (JSON) and **tokens** (W3C DTCG 2025.10, colour
and motion only: treatments can't be tokens, and the UI says so).

- `./build.sh` embeds a gzip of the app in itself (`window.__FXLAB_SELF`) so the app
  can make tools. Never put a literal closing script tag in a source file; it ends
  the script in the browser.
- A tool is read-only: it stores nothing in the browser (`PLAYER_RECIPE`), hides
  every editing surface (`.player`, `data-editor`), and can't make tools itself.
- Recipe text goes into a JSON script tag with `<` escaped. Keep it that way.
- Module thumbnails are generated: after adding or changing a module run
  `./build.sh && python3 tools/thumbs.py && ./build.sh`; `tests/thumbs.py` fails if
  one is missing.

## Build and test

```sh
./build.sh                 # → dist/fxlab.html (the only deliverable)
python3 tests/run_all.py   # before claiming anything works
```

Never hand-edit `dist/fxlab.html` — it is generated. Add a new source file to
the `cat` list in `build.sh` in dependency order (helpers before the modules
that use them).

After any change: run `tests/render_all.py` at minimum. After a new module:
`render_all`, `seams` (if it loops) and `tiles` (if it samples neighbours).
After a composition-engine change: `tests/compositions.py` as well.
After Library search or `search:` metadata changes: `tests/search.py`.
After Data changes: `tests/data.py` (add `--live` to fetch every curated public
source from a `file://` page; it needs a network and is not part of `run_all`).
After UI changes: `tests/workspaces.py`, and look at the tabs at 1280×800.
After Language or tool changes: `tests/language.py`. After adding a module: regenerate thumbnails (see below).
**Look at the output** with `tests/sheet.py` before saying it works — most bugs
here are visual, not thrown errors. Goldens in `tests/goldens/` are regenerated
with `tests/compositions.py --write`; look at them before committing them.

## Writing a module

```js
FX.register({
  id:'fx-my-thing',             // category prefix: tr- mx- gen- trt- fx- ovl-
  name:'My thing',              // sentence case, plain words
  cat:'fx',                     // see CATS in src/registry.js
  desc:'What it does, in one sentence a designer would say out loud.',
  params:[ R('amount','Amount',.5,0,1), C('color','Colour','#ff5a36','accent') ],
  fs:`vec4 fx(vec2 uv){
    vec3 c = texture(uInput, uv).rgb;
    return vec4(mix(c, c * p_color, p_amount), 1.);
  }`,
});
```

- Params become uniforms `p_<id>`; colours also get `p_<id>_a` for opacity.
- Helpers: `R` range, `I` whole number, `C` colour, `T` toggle, `S` select,
  `X` text (for overlays that print a readout), `Col` a column of the loaded data.
- Canvas 2D modules use `kind:'2d'` and `draw(ctx, api)`. `api` gives
  `w h W H t p loop dur fps params input sample`. `api.input` is the incoming
  processed frame (`HTMLCanvasElement`, preview- or tile-sized), or `null` on
  a base with no input. The engine also pre-paints it before `draw()`.
- Whole-frame samplers set `nonLocal: true` on `FX.register` so print skips
  tiling. Example: `FX.register({ id:'fx-kaleido', nonLocal:true, … })`.
- Optional `search: ['print', 'window']` adds invisible keywords for the
  Library search. Technical `cat` and designer-intent search are separate.
  Only add words a designer would type that name/desc would miss.
- GLSL helpers live in the prelude in `src/glsl.js` (`luma fbm hash12 rot
  centered aspect blendMode bayer8 backdrop`…). Add there, not per module.
- Canvas 2D modules use `Sketch` (`Sketch.rnd`, `Sketch.TAU`, `Sketch.ground`,
  `Sketch.groundParams`, `Sketch.paletteColor`). Shared colour maths lives in
  `Util` (`Util.hexToRgb`). Don't paste a helper into a module.

### Data

`Data.current()` is the loaded table, or a built-in sample when nothing is
loaded, so a Data module never opens empty. `Data.pick(name, index, kind)` gives
a column (kinds: `'number'` plottable values, `'axis'` time-like, `'any'`
including categories), `Data.at(col, u)` reads it at 0–1 along its rows and
`Data.norm(col, x)` maps a value to 0–1. Time and monotonic columns are *axes*:
auto-pick skips them as values. Any range control can be linked to a column
(`inst.bind`), resolved in `Data.bind` before the module sees its params.
Rows are capped at 2000 and columns at 24. API keys are never saved in projects.
Data modules are `kind:'2d'`, follow the playhead through `Data.u(api)`, and
close their loop (the default playhead runs forward and back).

### Defaults matter

A module is judged on how it looks the moment it's added. Pick defaults that
make something worth looking at straight away, at 1080×1350 with the
placeholder sources (a dusk landscape and a lit still life — real tonal range,
no lettering). Fit sizes to the frame rather than hard-coding pixels.
Exception: `fx-reframe` defaults to identity (scale 1, X 0, Y 0). A framing
utility must not crop the work just by being added.

### Motion

- Loop-based motion: drive from `uLoop` (`api.loop` in 2D) in **whole cycles**.
- Timeline motion: drive from `uProgress` (`api.p`), which already has the
  project easing and hold applied.
- Rhythm: modules with a `beats` param fall back to the brand beat when it is 0
  (`Identity.beat()`).
- Anything that reseeds from wall-clock time (grain, jagged edges) can't close a
  loop against a busy image. If that is by design, add it to `EXPECTED` in
  `tests/seams.py` with the reason.

### Colour roles

Colour params can link to colour roles (ink, ground, accent, accent2), and new
instances link automatically. Modules always receive resolved values. Pin a role
with `C('bg','Ground','#141516','ground')`, or opt out with `false` when the
module needs a literal (paper, pen inks).

## House style

- **Code:** two-space indent, single quotes, no semicolon-free lines, small
  helpers over clever one-liners. Comments explain *why*, not what.
- **UI copy and module descriptions:** plain British English, lower-key than
  marketing. "Presses the artwork into the paper", not "Stunning letterpress
  effect". No exclamation marks. Say what a control does in the fewest words
  that are still accurate.
- **Errors the user sees:** say what happened and what to do next.
- Keep `src/registry.js`'s header comment accurate — it's the authoring guide
  users read inside the file.

## Honesty rules for this project

- Don't claim a module works without rendering it and looking at it.
- If something is capped, approximate or broken in a case, say so in the reply
  and, where the user would hit it, in the UI or the guide.
- When removing or renaming a module, remember old projects reference it by id:
  they open with that layer skipped and a message. That's fine; don't silently
  alias ids.
- What can and can't be reproduced elsewhere is a real limit, not a detail: a
  LUT carries colour only, CSS filters and Lottie drop most effects. The only
  faithful extraction is a versioned recipe plus a small replay runtime. Say so.

## Current shape (keep this roughly up to date)

250 modules (each with a picker thumbnail): 64 effects, 49 treatments, 44 generators, 29 transitions,
17 mix & mask, 14 overlays, 31 data visuals, 2 sources. Nineteen of the effects are vector (SVG) effects
that redraw the geometry of an SVG source; two generators are simulations (`feedback:'float'`: half-float
state, `steps` per frame, and an optional `show` pass that turns state into colour). No starter looks. Optional Prepare lists
(`sources.A.process` / `sources.B.process`) run treatments and `fx-reframe` only
(`FX.laneEligible`) on each fitted source before the base. The inspector reads
Prepare → Combine → Finish; those names are UI only. The picker can draw thumbnails from your image A ("On my image"), tooltips are a small shared system (any `title` becomes one), and Language versions are named snapshots of pinned values saved with the project. Randomise is scoped to
those stages (and Finish categories); unchecked state is preserved; scope is
session/local UI, not saved in projects. Undo/Redo is snapshot-based,
session-only, coalesced for continuous controls. Library search matches name,
description, category, and optional `search` keywords. Saved looks are the
user's own snapshots (System tab) and feed batch export. Projects have a `name`
(missing / Untitled → unnamed). Exports: PNG (with optional alpha), PNG
sequence, MP4, print PDF/PNG and ink separations. An optional export folder
uses the File System Access API and falls back to downloads. Hosted
`dist/index.html` is the same app; IndexedDB data stays on that device.

## Where it should go next

From `docs/art-directed-identity-languages.md`; inference unless marked there.
Data is in; what it still lacks is per-parameter smoothing, categorical columns
driving choices and palettes, and a way to keep a fetched table fresh. Consolidate
rather than add: one screening module with a pattern selector
(halftone, Bayer, blue noise, line, ring, ASCII share one threshold engine);
transitions as matte source × edge style × motion; a CPU error-diffusion path;
seed as its own object, separate from a named look, with lock and mutate on
Randomise; a portability report per layer. Known soft spots: `trt-riso` then
`trt-press`, and `trt-hatch` → `trt-press` → `fx-rgbsplit`, differ by 1.5–2.7k
px between tiled and single-pass renders (`tests/tiles.py`, threshold 2000).
