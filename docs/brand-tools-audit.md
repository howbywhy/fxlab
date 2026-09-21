# Brand-tools audit, Are.na findings, and what was built from them

Sources: `docs/research/brand_tools_landscape.md`, `docs/research/arena.md`, `docs/research/premium_craft.md`. Each was gathered with web search and, for Are.na, the public API via curl. Where a report says something is unsourced or unverified, this document says so too.

## 1. What the research found

**Brand tools split into layers, and nothing sits where fxlab does.** Guideline platforms (Frontify, Bynder, Brandfolder, Canva) govern use with locked template elements, allowed colours and approval. Token pipelines (Figma variables, Tokens Studio, W3C DTCG, stable since October 2025) carry colour and type. Shader tools (Unicorn Studio, Paper Shaders) ship treatments as embeddable code. Studios hand-build a tool per identity: Field's IBM Quantum generator (three metaphoric controls) and Adidas system, the Config 2026 dither tool that gave hundreds of headshots one treatment. The report found nothing that *discovers* a treatment from real imagery and then packages it as a small reusable tool. That is a single-source, inferred gap, not market evidence: no data on demand, and Figma is reported (one secondary source) to be shipping generative shaders itself.

**Consistency is protected by restriction or by a few meaningful controls.** Canva and Frontify lock elements. The generative tools expose two or three concept-named parameters. fxlab had neither a lock/range layer nor a way to name a control after what it does to the picture. A saved project was, in the report's words, still a preset, not a language.

**Only tokens travel honestly.** Colour and motion export cleanly as DTCG. A shader stack has no token type; a LUT captures only per-pixel colour. The honest carrier for the rest is a recipe plus a runtime, with the fidelity limit stated.

**Are.na is a moodboard culture.** Across 29 searches (746 channels) and 17 sampled channels (4,361 blocks): curation is overwhelmingly image-led (dither, grain, textures, glitch, gradients with noise, information aesthetics). Code-side channels are link lists led by github.com, shadertoy.com, openprocessing.org and iquilezles.org. Technique mentions (lower bounds, titles are mostly filenames): dither 62 blocks / 7 channels, tiling and pattern 52/11, data viz 46/7, grain and noise 31/7, SDF and raymarch 21/3, scan 20/9, glitch 20/8, ASCII 20/6, fluid 18/3, halftone 17/8, droste 16/4, riso 14/4. "Masking" did not turn up as a channel family, so it reads as a fxlab strength or an unsearched term, not a demand signal.

**Premium is craft, not decoration.** Sourced: animation under 300 ms with nothing animated on high-frequency or keyboard actions; press at `scale(.97)`; Radix tooltips at 700 ms; tabular numerals; a 2 px focus ring; WCAG 4.5:1 text, 3:1 controls, 24 px targets; NN/g's 0.1/1/10 s feedback thresholds. Unsourced (inference only): scrubbable fields with modifiers, elevation values, onboarding, library design, anti-patterns.

## 2. Audit: fxlab against the findings

| Finding | fxlab before | Done in this pass | Still open |
| --- | --- | --- | --- |
| Discover a look, then package it as a tool | Projects and saved looks only | **Language tab**: name and rule, pinned controls with ranges, seeded exploration, and export as a standalone **tool**, a **board**, a **recipe** and **tokens** | Tools need fxlab's renderer, so they need WebGL2 and are ~0.5 MB |
| A lock/range layer | None | Pins carry a label and a range; a control can be held still; a tool shows only pinned controls | No approval, versioning or "check this asset against the language" |
| Concept-named controls | Technical control names | Every pin is renamed in the Language tab; the guide says to name for effect, not mechanism | No suggested names |
| Tokens honest about limits | Palette and motion existed only inside the app | DTCG 2025.10 export (colour object, `cubicBezier`, `duration`), checked against the spec text; the file says treatments are not expressible | No token *import* to set the palette |
| Reference boards as material | Only local files | **Are.na import** (one public channel, on request): pictures as A or B, palette pooled from the board; a channel link also loads in the Data tab as a table | Public channels only; v2 API (tokenless); no token support |
| Are.na's most-collected looks | Bayer, noise dither; dot halftone | **Error diffusion** (Floyd–Steinberg, Atkinson, Sierra, Stucki, Jarvis; the CPU-only kind the research says a shader can't do) and **stippling** | See section 4 |
| Choose a module by sight | Names and one line | Thumbnails of every module, arrow-key navigation, a Recent list | Thumbnails use the stand-in photograph, not the person's image |
| Premium craft checklist | Contrast fails; no motion tokens; 18 px slider hit areas; no scrubbing | Items 1–5, 7, 8 and 12 of the research checklist, and item 11 in part (below) | Tooltips (9), export ETA (10), the Geist role-model colour tokens (6), a row-by-row alignment audit (11) |

**Contrast audit (measured).** `--faint` text was 3.2:1 on the panel, `--lamp-dim` 4.5:1 only on the darkest surface, and control borders and slider tracks were 1.4–1.7:1 against a 3:1 target. Raised `--muted`, `--faint`, `--lamp-dim`, and added `--ctl` for control edges and tracks.

**Premium checklist, as implemented:** tabular numerals everywhere; motion tokens (100/160/220 ms, `cubic-bezier(.2,0,0,1)`) with no motion on slider drag, keyboard or canvas; a global reduced-motion block; a 2 px accent focus ring; label-drag scrubbing (Shift ×10, Alt ×0.1, double-click reset, a dot when changed from default, Shift+arrow nudging); 24 px hit areas; consistent 4 px control radius; picker thumbnails, arrow keys and recents. Not done: custom tooltips (native `title` remains), export ETA and estimated time, the Geist role-model colour tokens, control heights were not audited row by row.

## 3. What Are.na means for the library

Implemented because the evidence and the gap agree: error diffusion and stippling. Dither is the most-collected technique by a wide margin; fxlab had ordered and noise dither only. Everything else in the ranked list was checked against the existing 125 modules:

| Collected on Are.na | fxlab has | Verdict |
| --- | --- | --- |
| Dither (variants) | Bayer, noise, blue-ish noise, **error diffusion** | Covered. Not covered: 3D-stable (temporally coherent) dither |
| Halftone, screentone | Halftone (dot, line, square, CMYK), mosaic, hatch | Covered. Screentone patterns (manga tones) are not |
| Stippling | **Stipple** | Covered |
| Grain, scan, xerox, riso | Grain, film, photocopy, riso, press, surface, scratches, scanbar/slitscan | Covered |
| Glitch, datamosh, pixel sort, VHS/CRT | All present | Covered |
| ASCII | ASCII (three system faces) | Weak point: glyph-accurate matching |
| Gradients with noise | Mesh gradient, noise texture, domain warp, colour field | Covered |
| Droste, feedback, echo, metaballs, SDF solid | All present | Covered |
| Reaction-diffusion, fluid | None | **Gap.** Needs float feedback buffers; the engine's feedback is 8-bit, which kills slow diffusion |
| Tiling and pattern | Mirror and tile, Truchet | Partly: no brick or hex tilings |
| Data viz | Five data visuals and linking | Covered |

## 4. Recommendations, in order

1. **Float feedback buffers**, then reaction-diffusion and a fluid generator. The largest remaining technical gap the research names, and it also fixes banding in long feedback chains.
2. **Check an image against a language.** The one governance feature that needs no backend: drop an image into a tool and report which pinned values it sits inside. Turns a tool from a generator into a guardrail.
3. **Shareable state in the URL** for tools hosted on a static site (a recipe in the fragment). Unsourced idea; worth prototyping because it removes the file-passing step.
4. **Token import** (DTCG in) to seed the palette and motion from an existing system, so fxlab joins a pipeline instead of only feeding it.
5. **Live previews on the person's own image** in the picker (thumbnails currently use the stand-in). The GPU work is small; the cost is per-module render time.
6. **3D-stable dither and screentone patterns**, the two dither-adjacent techniques with clear evidence and no coverage.
7. **Language versions**: named snapshots of a language, with a diff of which pins moved. Local only, as the research scopes a no-backend tool.
8. **A tooltip system** with shortcut chips and the 700 ms / instant-on-focus behaviour.
9. **Real user testing** of the tab structure, the Language tab wording and the tool. Nothing here has been used by anyone else yet.

## 5. Limits of this work

- The brand-tools report did not cover Cavalry, Jitter, Spline, TouchDesigner, Zeroheight, Brandpad, Coolors, Khroma or Adobe Color, and did not open guideline pages to see how image treatment is shown. Its market claims come from vendor and third-party pages.
- Are.na counts are lower bounds from titles and URLs; no image analysis was done, and the three largest channels were not opened. The sample is what search returned.
- Are.na's terms allow personal viewing and forbid bulk collection; nothing in them addresses processing images in a third-party tool. The import therefore loads one named channel on request, keeps pictures in memory only, links back to the channel, and never saves an image in a project, kit or tool. Whether palette extraction is acceptable is unaddressed by the terms.
- The tool format was tested by building one and opening it in a fresh page, but only in Chromium with software WebGL. It has not been tried in Safari or Firefox, or on a machine with a different GPU.
- "Premium" is judged here by a research checklist and by looking at screenshots. It is not a substitute for someone else looking at it.
