# Comparable tools and exploration UX for a browser-based look library

Scope note: about 20 tool calls were used. Several search snippets were the only source (PDF fetches of Sims, Picbreeder, Sequential Gallery and Shneiderman returned binary and could not be read). Where a claim rests on a search-result summary rather than a read page, it is marked "(snippet)". Tools in the brief that were not researched at all are listed under Gaps.

## 1. What comparable tools do well or badly for exploration, and how they export

### Takeaway
The closest analogues fall into three groups. Code-first sandboxes (Shadertoy, Hydra, Lygia) are strong on sharing and learning by example but weak on structured parameters. Embed-oriented visual shader tools (Paper Shaders, Unicorn Studio) export a small runtime plus config, which is the most direct precedent for fxlab's "reproduce it elsewhere" goal. Preset-based tools (Lightroom, LUT packs, Midjourney --sref) show that a "look" is usually carried as a portable reference (preset, LUT, code) that is lossy against the source tool.

### Cited Findings
- Paper Shaders: "Zero-dependency HTML canvas shaders" installable from npm or designed in Paper. Packages `@paper-design/shaders` (vanilla) and `@paper-design/shaders-react`. Components take colour arrays and parameters (distortion, swirl, speed, scale). Visual designs are exportable as lightweight code. Apache 2.0. Vue and other frameworks are only planned — [GitHub paper-design/shaders](https://github.com/paper-design/shaders)
- Unicorn Studio: export panel offers embed for Framer, Webflow, Figma Sites, React or plain HTML; JSON config export (paid tier) compatible with its SDK, mainly for self-hosting; a ~36kb gzipped runtime; scene props include width, height, scale, dpi, fps; scenes load by `projectId` (cloud) or `jsonFilePath` (self-hosted) — [Unicorn Studio embed docs](https://www.unicorn.studio/docs/embed/), [unicornstudio-react](https://github.com/diegopeixoto/unicornstudio-react) (snippet)
- Shadertoy: public library, forking, comments, likes, permanent URLs, embeds. Export of results (video/image sequence) was weak enough that third-party exporters exist — [Wikipedia: Shadertoy](https://en.wikipedia.org/wiki/Shadertoy), [shadertoy-exporter](https://github.com/KoltesDigital/shadertoy-exporter) (snippet)
- Hydra: browser live-coding, chained syntax such as `osc(20).rotate(0.8).pixelate(20).out()`; Ctrl-Enter runs one line; sketches shared via a built-in share-to-Twitter feature that feeds a community gallery account — [Hydra GitHub](https://github.com/hydra-synth/hydra)
- Lygia: 13 categories (math, space, color, animation, generative, sdf, draw, sample, filter, distort, lighting, geometry, morphological); one function per file with a descriptive header; 30+ examples shown as clickable thumbnails; supports GLSL, HLSL, MSL, WGSL and others; consumable by clone or a resolver URL — [lygia.xyz](https://lygia.xyz/)
- Jitter: browser motion tool; exports MP4/MOV/WebM/GIF/Lottie/ProRes 4444/frame sequence; 300+ remixable templates; claims Lottie export is "1:1" with the editor — [Jitter product](https://jitter.video/product/), [Jitter Lottie](https://jitter.video/lottie-animations/) (snippet, vendor claim)
- Substance 3D Designer: node graph where "exposing" a parameter turns a node control into a graph-level control, so others can customise a graph without understanding its internals — [Adobe: Exposing parameters](https://helpx.adobe.com/substance-3d-designer/substance-model-graphs/exposing-parameters.html). Adjustment layers are not supported in PSD export from Designer, only blend nodes map (snippet) — [Adobe help](https://helpx.adobe.com/substance-3d-designer/substance-compositing-graphs/exposing-a-parameter.html)
- Midjourney: `--seed` reproduces an image only with an identical prompt; Midjourney's own docs put seeds under "Not for Saving Styles" and point to `--sref` codes/references instead; `--sw` sets style-reference strength (0-1000, default 100); random `--sref` resolves to a readable code that can be reused — [Midjourney docs: Style Reference](https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference), [Prompt Architects on seeds](https://prompt-architects.com/blog/236-midjourney-seed-reproducing-a-result) (secondary)

### Inferences
- Paper Shaders and Unicorn Studio are the nearest models for a "replay" export: a small runtime plus a JSON scene/param config, with framework wrappers (React, Framer, Webflow) as the distribution layer. Framework coverage is what adopters ask for first.
- Midjourney's seed-vs-sref split suggests fxlab should keep two separate ideas: a seed (exact reproduction of one output) and a named, portable "look" (transferable to new content). Conflating them causes the confusion Midjourney itself documents.
- Shadertoy and Hydra work because sharing is one action and the artifact is small text. A fxlab look that serialises to a short URL or pasted string would get the same social loop.
- Substance's "expose parameters" idea maps to fxlab Looks: a Look could expose 3 to 6 headline controls above the underlying stack, so exploration happens at a higher level than 176 modules.

### Gaps
- Not researched: TouchDesigner, Cavalry, Rive, Figma variables/plugins, Affinity, Dehancer/FilmConvert, VSCO, Runway/Kaiber, p5.js editor/OpenProcessing, glslViewer, Blender compositor/geometry nodes, Glitchy/Photomosh/dither web tools, Coolors/Poline, Are.na/Pinterest, Framer/Webflow shader components (other than Unicorn embeds). No claims are made about them.

## 2. Interaction patterns and the creativity-support literature

### Takeaway
The literature supports exploring alternatives, keeping history, and making it easy to backtrack (Shneiderman); wide walls as well as low floor and high ceiling (Resnick); and interactive evolution with branching from others' work (Sims, Picbreeder). Slider-only interfaces are a known weak point in high-dimensional parameter spaces, and galleries of perceptually different variants are the established alternative. Examples help but fixate.

### Cited Findings
- Shneiderman's NSF workshop produced 12 principles for creativity support tools; those reported include support for exploring alternatives (with easy backtracking), history-keeping (record and compare alternatives, revert, communicate), support for evaluating alternatives, and exploratory search; the framework is Collect, Relate, Create, Donate — [Shneiderman, Creativity Support Tools (UMD)](https://www.cs.umd.edu/~ben/papers/Shneiderman2006Creativity.pdf), [NSF workshop report](https://www.researchgate.net/publication/220302282_Creativity_Support_Tools_Report_From_a_US_National_Science_Foundation_Sponsored_Workshop) (snippets; PDF unreadable to fetch tool)
- Papert's "low floor, high ceiling" was extended by Resnick with "wide walls": multiple pathways from floor to ceiling, because no single project is meaningful to everyone — [Resnick, Designing for Wide Walls](https://mres.medium.com/designing-for-wide-walls-323bdb4e7277). A natural experiment in the Scratch community found causal evidence that widening walls increased engagement and learning — [Dasgupta, Testing wide walls](https://medium.com/hci-design-at-uw/testing-the-wide-walls-design-principle-in-the-wild-bbb3487fbbb3)
- Karl Sims (1991): images, textures and animations produced by mutating symbolic Lisp expressions, with the user selecting preferred results to steer evolution; time as a variable yields animation; aim was flexible complexity with minimal user knowledge of details — [Sims 1991](https://www.karlsims.com/papers/SimsSiggraph91.pdf) (snippet)
- Picbreeder: online collaborative interactive evolution where users select images to breed, publish them, and branch from others' images; branching plus growing complexity (NEAT) made images proliferate "unlike in any other current IEC systems" — [Secretan et al., CHI 2008](https://dl.acm.org/doi/10.1145/1357054.1357328), [Picbreeder case study](https://pubmed.ncbi.nlm.nih.gov/20964537/) (snippets)
- Design Galleries (SIGGRAPH 1997): present automatically generated, perceptually different outputs from varying a parameter vector; the two technical problems are dispersion (choose parameter vectors whose outputs are well spread) and arrangement (organise for browsing) — [Marks et al.](https://dl.acm.org/doi/abs/10.1145/258734.258887)
- Later work: Design Adjectives (UIST 2020) learns user intent with Gaussian process regression from a few examples to steer which designs a gallery shows, as an alternative to slider-based exploration — [Design Adjectives](https://dl.acm.org/doi/10.1145/3379337.3415866); Sequential Gallery (interactive visual design optimisation) — [arXiv 2005.04107](https://arxiv.org/pdf/2005.04107) (snippet only; results not read)
- Design fixation: Jansson and Smith (1991) found people given an example solution produced designs sharing its features, even when its flaws were pointed out, while producing a similar number of ideas as controls — [Leahy et al. 2020 on provided vs self-generated examples](https://dalyresearch.engin.umich.edu/wp-content/uploads/sites/237/2020/12/Leahy_Daly_McKilligan_Seifert-Design-Fixation-From-Initial-Examples-Provided-Versus-Self-Generated-Ideas.pdf) (snippet); fixation also occurs from self-generated first ideas, and design-heuristic tools can mitigate it (same source)
- Templates: research summary that templates give conceptual and procedural scaffolds for novices but are repeatedly criticised as rigid — [Freeform Templates, arXiv 2305.00937](https://arxiv.org/pdf/2305.00937) (snippet)
- Node vs stack: Substance Designer is node-based with a steeper learning curve than layer-based Photoshop (snippet, tutorial-level source) — [Adobe Substance docs](https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/getting-started/workflow-overview)

### Inferences
- Randomise is Sims/Picbreeder's mutation in weak form. The literature suggests it becomes more useful with (a) lock per parameter or stage, (b) mutation strength control, (c) keeping every result in a browsable history, and (d) "start from this one" branching. fxlab already has scoped Randomise and unchecked-state preservation, which is a form of locking.
- Design Galleries implies random sampling gives clumps of near-identical results; sampling should aim for spread (dispersion), for example by rejecting candidates whose rendered thumbnail is too close to previous ones (luma/colour histogram distance). This is inference; no source tested it on this kind of stack.
- Fixation evidence argues for offering both starting points: a curated Look (fast floor) and a "surprise me / mutate" path, so users are not anchored on the first Look. Presenting several contrasting Looks at once is likely safer than one default.
- History as exploration: Shneiderman's history-keeping and fxlab's session-only snapshot undo cover "revert" but not "compare and keep". Missing pieces are named snapshots/favourites and side-by-side A/B.
- Wide walls argues against one dominant style in the starter Looks; the 17 Looks should span visibly different languages.

### Gaps
- Could not read the Sims, Picbreeder, Sequential Gallery or Shneiderman PDFs, so exact user-study numbers are not available.
- No controlled study found that directly compares presets vs blank slate for visual-effects tools; evidence above is from design-fixation and template literature in adjacent domains.
- No evidence gathered on linear stack vs node graph for exploration specifically; only tool-level descriptions.

## 3. Reproducibility: how a look is serialised and what survives

### Takeaway
Every portable format carries only a subset of a look. 3D LUTs carry colour mapping only; Lottie drops many effects; SVG filters are linear or limited in Safari; Lightroom presets and LUT profiles are different objects. The only high-fidelity target is replaying the same config in the same runtime, so a JSON recipe plus a small open runtime is the primary export, with approximations as secondary and honestly labelled outputs.

### Cited Findings
- 3D LUT: answers "given this colour, what colour" per pixel and cannot add anything depending on position: grain, halation, bloom, vignetting, dust, scratches, light leaks. A film-emulation LUT gives "the colour half of a film look and nothing else" — [Arc: True film emulation](https://www.welcometoarc.com/post/true-film-emulation-building-a-photochemical-pipeline), [HolyGrain](https://www.holygrain.com/blog/what-is-film-emulation-in-digital-cinema/) (snippets)
- Lightroom: does not natively load .cube; presets (.xmp) cannot contain LUTs, LUTs live in profiles; conversion between .cube and .xmp loses features; plugins can export a LUT from Lightroom settings for use in Premiere/Resolve/FCP — [Adobe community thread](https://community.adobe.com/questions-729/converting-photoshop-lightroom-xmp-preset-to-premiere-cube-luts-1629933), [John Ellis Export LUT](https://johnrellis.com/lightroom/exportlut.htm) (snippets)
- Lottie: most After Effects effects silently dropped on export; blending modes, luma mattes and layer effects such as drop shadow unsupported; playback differs across web/iOS/Android/Skottie runtimes; supported features can still be slow — [LottieFiles supported features](https://help.lottiefiles.com/supported-after-effects-features), [Lottie compatibility docs](https://docs.lottiefiles.com/en/integrations/after-effects/09_lottie-compatibility)
- CSS filters are shortcuts of SVG filters. `feColorMatrix` is linear. `feTurbulence` is computationally heavy. Safari's SVG filter support was reported as limited to blur and basic image processing (`feComponentTransfer`, `feColorMatrix`, `feConvolveMatrix`) — [A List Apart: feColorMatrix](https://alistapart.com/article/finessing-fecolormatrix/), [WebPlatform docs](https://webplatform.github.io/docs/svg/tutorials/smarter_svg_filters/), [utilitybend](https://utilitybend.com/blog/revisiting-svg-filters-my-forgotten-powerhouse-for-duotones-noise-and-other-effects/) (snippets; Safari claim is from an older docs page and may be out of date)
- Midjourney: seeds reproduce only with an identical prompt; style codes persist across rerolls — see section 1.
- Paper Shaders and Unicorn Studio ship JSON/props plus a runtime — see section 1.

### Inferences (realistic targets, ranked by fidelity and cost)
1. Config JSON plus a small replay runtime (npm/ES module, drop-in `<script>`, React wrapper). Highest fidelity, because it reuses the same GLSL. Cost: the runtime must be versioned, and old recipes need module-id/version handling (fxlab already skips removed ids with a message).
2. Standalone GLSL/WebGL snippet for a single chain. High fidelity for the shader stages; loses project state, fonts and 2D canvas modules (`kind:'2d'`), which need a JS fallback.
3. `.cube` LUT baked from the colour-only part of the stack (treatments that are per-pixel colour maps). Good for Premiere, Resolve and Lightroom-adjacent workflows; must be described in the UI as "colour only". Modules flagged `nonLocal` or spatial (grain, blur, kaleidoscope) cannot go in.
4. CSS/SVG filter approximations for the web. Only for a handful of modules (colour matrix, blur, simple noise); Safari and performance caveats apply.
5. Video/PNG sequence/alpha (already exported). This is the fidelity fallback for anything else, and works in After Effects and Premiere without translation.
6. After Effects/Premiere effect matching, Figma plugin, Lottie. Poor fit: Lottie drops effects and blending modes; AE has no shader import without third-party plugins. Better documented as a "settings sheet" (human-readable parameter list) than as an automated export.
- Unavoidable gaps: spatial effects cannot be in a LUT; non-deterministic or time-dependent effects need seed and loop rules in the recipe; fonts and logos need embedding or a named substitute; float precision and GPU differences make bit-exact matching unrealistic; per-renderer differences (Lottie runtimes, Safari filters) are outside fxlab's control.
- Useful add-on: a "portability report" listing, for each layer of the current look, which targets it can be exported to (LUT yes/no, CSS yes/no, GLSL yes/no). This makes the fidelity gap visible instead of surprising.

### Gaps
- Not researched: OpenColorIO details, Figma variables/tokens as a serialisation, AE/Premiere effect-preset formats (.ffx/.prfpset), Web Components packaging examples. Only tool-level facts above were gathered.

## 4. Library and catalogue design

### Takeaway
Good creative-code libraries (Lygia) use a shallow, named category tree, one item per file with a self-describing header, and thumbnails that open live examples. Exploratory search is a named requirement in the creativity-support literature, so search should serve intent and not only names.

### Cited Findings
- Lygia: 13 categories, granular one-function-per-file, descriptive headers, clickable thumbnail examples — [lygia.xyz](https://lygia.xyz/)
- Shneiderman lists exploratory search as a principle, noting keyword search alone makes finding relevant prior work hard — [Shneiderman, Creativity Support Tools](https://www.cs.umd.edu/~ben/papers/Shneiderman2006Creativity.pdf) (snippet)
- Design Galleries: arrangement of thumbnails for intuitive browsing is one of the two core problems — [Marks et al.](https://dl.acm.org/doi/abs/10.1145/258734.258887)
- Jitter offers 300+ remixable templates; Hydra relies on a community gallery feed for onboarding — [Jitter](https://jitter.video/product/), [Hydra](https://github.com/hydra-synth/hydra)
- Substance Designer's exposed parameters let a graph be used without understanding its internals — [Adobe](https://helpx.adobe.com/substance-3d-designer/substance-model-graphs/exposing-parameters.html)

### Inferences
- Live thumbnails rendered from the user's own current image (not a stock swatch) are the strongest preview, since a module's look depends heavily on input. Design Galleries and the fixation research both point toward showing several contrasting previews at once.
- fxlab's existing pattern (name, one-sentence desc, invisible `search` keywords, tests/search.py) is consistent with the exploratory-search principle; the gap is intent-level facets (mood, era, "grainy", "print-like") rather than only technical category. This is an inference, not sourced.
- "Learn by example" for modules: each module page/card could show its default plus 2 to 3 contrasting parameter presets, and each Look could list the modules it uses with a click to inspect them. Lygia's header-per-item and example thumbnails suggest a template for authoring docs.
- A contact sheet of every module at defaults (fxlab's `tests/sheet.py` already renders these) doubles as an in-app visual index.

### Gaps
- No sourced study of catalogue-naming conventions in Blender, TouchDesigner, or Substance; not researched.
- Did not verify how Shadertoy, Paper or Unicorn categorise or search their galleries.
