# Working on fxlab

Read `README.md` first for the architecture. This file is about how to work
here: the conventions the codebase already follows, and what "done" means.

## What fxlab is

A **library**, not a template kit. Modules are building blocks that combine —
transitions, motion, kinetic type, creative coding, textures, effects, overlays.
If a module is a finished artefact with fields to fill in (an event poster, a
business card, a scoreboard), it doesn't belong; several were removed for
exactly that reason. The test: could this be the base of a hundred different
pieces of work, or is it one piece of work with the words swapped?

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
**Look at the output** with `tests/sheet.py` before saying it works — most bugs
here are visual, not thrown errors.

## Writing a module

```js
FX.register({
  id:'fx-my-thing',             // category prefix: tr- mx- gen- trt- fx- ovl- kt- lg-
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
  `X` text, `F` font, `L` logo.
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
- Type modules use `KT` (`KT.fit`, `KT.layout`, `KT.stagger`, `KT.ground`,
  `KT.wrap`); spatial type uses `KT.cam` (`rotate`, `project`, `point`).
  Logo modules use `Brand` and `Assets.image/tinted`.
- Outline-level type uses `Glyphs.layout`, which traces contours from any font.

### Defaults matter

A module is judged on how it looks the moment it's added. Pick defaults that
make something worth looking at straight away, at 1080×1350 with the
placeholder sources. Fit sizes to the frame rather than hard-coding pixels.
Exception: `fx-reframe` defaults to identity (scale 1, X 0, Y 0). A framing
utility must not crop the work just by being added.

### Motion

- Loop-based motion: drive from `uLoop` (`api.loop` in 2D) in **whole cycles**.
- Timeline motion: drive from `uProgress` (`api.p`), which already has the
  project easing and hold applied.
- Rhythm: `KT.beats(P.beats)` falls back to the brand beat when set to 0.
- Slant/lean: `KT.motionSlant` so it scales with the brand motion token.

### Brand roles

Colour, font and logo params can link to brand roles, and new instances link
automatically. Modules always receive resolved values. Pin a role with
`C('bg','Ground','#141516','ground')`, or opt out with `false` when the module
needs a literal (paper, pen inks).

## House style

- **Code:** two-space indent, single quotes, no semicolon-free lines, small
  helpers over clever one-liners. Comments explain *why*, not what.
- **UI copy and module descriptions:** plain British English, lower-key than
  marketing. "Letters drop in and bounce into place", not "Stunning kinetic
  letter animation". No exclamation marks. Say what a control does in the
  fewest words that are still accurate.
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

## Current shape (keep this roughly up to date)

176 modules: 45 kinetic type, 30 effects, 25 treatments, 22 generators,
19 transitions, 13 logo & brand, 12 mix & mask, 8 overlays, 2 sources.
17 starter looks. Optional Prepare lists (`sources.A.process` /
`sources.B.process`) run treatments and `fx-reframe` only (`FX.laneEligible`)
on each fitted source before the base. Looks own those lists the same way
they own the stack. The inspector reads Prepare → Combine → Finish; those
names are UI only. Library search matches name, description, category, and
optional `search` keywords on modules and Looks. Projects have a `name`
(missing / Untitled → unnamed). Exports: PNG (with optional alpha), PNG
sequence, MP4, print PDF/PNG and ink separations. An optional export folder
uses the File System Access API and falls back to downloads. Hosted
`dist/index.html` is the same app; IndexedDB data stays on that device.
