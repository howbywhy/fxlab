# Creative coding and data visualisation as a source of art-directable visual languages for identity systems

Scope note: about 18 tool calls, mostly search snippets plus five page fetches. Several key questions (per-technique parameter tables, Ikeda/Anadol/Universal Everything/Field.io, Stripe/Vercel gradients, Eurovision, Dia, seeding and parameter-count guidance) could not be sourced in this pass and are listed under Gaps. Where a technique claim rests on general knowledge rather than a fetched source, it sits under Inferences and is labelled as such.

## 1. Core generative techniques, visual signatures, key parameters; essential vs derivative

### Takeaway
The best-sourced technique here is the flow field (Hobbs), whose few parameters (grid resolution, step length, curve length, angle distortion, seed-point strategy) are a good model for how to expose any generator. Noise (fBm plus domain warping) and Worley/cellular noise are the shader-side primitives, and Lygia is a ready-made catalogue of them.

### Cited Findings
- Flow fields are a grid of angles covering the canvas. Curves are traced by stepping along the local angle. Hobbs calls them "incredibly powerful and flexible" and returns to them repeatedly. — [Tyler Hobbs, Flow Fields](https://www.tylerxhobbs.com/words/flow-fields)
- Hobbs's practical parameters, from the fetched essay:
  - Grid resolution is about 0.5% of image width.
  - Grid bounds extend about 50% beyond the canvas so curves can turn back into view.
  - Step length is about 0.1–0.5% of image width, to avoid visible kinks.
  - Curve length changes the character a lot. Short curves give a "fur" texture with patchy light and dark. Long curves give fluid, eye-leading lines.
  — [Tyler Hobbs, Flow Fields](https://www.tylerxhobbs.com/words/flow-fields)
- The angle field is usually Perlin noise (adjust octave detail and scale). Quantising angles to multiples of π/10 or π/4 gives "sculpted, rocky" forms. — [Tyler Hobbs, Flow Fields](https://www.tylerxhobbs.com/words/flow-fields)
- Refinements: stop curves on collision with existing ones for even spacing, perturb the grid between drawing rounds, and distort the angles around embedded objects so lines flow around them. — [Tyler Hobbs, Flow Fields](https://www.tylerxhobbs.com/words/flow-fields)
- Start-point strategy changes the look. A regular grid is structured but stiff, random placement is loose but clumpy, and circle packing is balanced with relaxed variation. — [Tyler Hobbs, Flow Fields](https://www.tylerxhobbs.com/words/flow-fields)
- Hobbs's Fidenza (2021) is described as showing mastery of both the flow-field algorithm and generative algorithm design. — [Right Click Save, via search](https://www.rightclicksave.com/article/tyler-hobbs-on-qql-and-the-future-of-generative-art)
- fBm is a sum of noise octaves with frequency increasing and amplitude decreasing. — [The Book of Shaders: fBm](https://thebookofshaders.com/13/)
- Domain warping replaces f(p) with f(g(p)). Inigo Quilez's canonical recipe is q = fBm(p), r = fBm(p + q), result = fBm(p + r). — [Inigo Quilez, warp](https://iquilezles.org/articles/warp/); summary at [mysimulator.uk](https://www.mysimulator.uk/generative-art/domain-warping/)
- Worley (cellular) noise was optimised for GPU by Stefan Gustavson, using a 2x2 rather than 3x3 neighbourhood. It returns F1/F2 distances and can be domain-warped for cracked-rock or organic-cell looks. — [Book of Shaders: More noise](https://thebookofshaders.com/12/); [Sangil Lee on cellular noise](https://sangillee.com/2025-04-18-cellular-noises/)
- Lygia (GLSL, HLSL, Metal, WGSL, CUDA) has a `generative/` folder containing cnoise, curl, fbm, gnoise, noised (value noise plus derivatives), pnoise, psrdnoise, random, snoise, srandom, voronoi, voronoise, wavelet and worley. — [Lygia generative](https://lygia.xyz/generative); [GitHub](https://github.com/patriciogonzalezvivo/lygia)
- Casey Reas's Software Structures (2004) translated Sol LeWitt's instruction-based wall drawings into generative software. The Process series (2004 on) links conceptual and process art to code. — [Whitney](https://whitney.org/exhibitions/software-structures); [reas.com/process](https://reas.com/process)
- Vera Molnár is cited as a pioneer of computational experiment methodology that led to frameworks like Processing and p5.js. — [search summary of Reas/Processing sources](https://reas.com/)

### Inferences
- Unsourced general knowledge, to be verified before the report treats it as fact. A candidate "essential vs derivative" split:
  - **Essential primitives**: value/simplex/Worley noise and fBm, domain warping, curl/flow fields, grid/tiling with per-cell variation (Truchet, modular), Voronoi/Delaunay, halftone/dither/ASCII/mosaic mappings, particles, moiré/interference (pure math, cheap on GPU).
  - **Derivative or niche**: L-systems, strange attractors and reaction-diffusion (expensive, hard to art-direct, but very recognisable), and circle packing (mostly a spacing strategy, as Hobbs uses it for start points).
- Hobbs's flow-field parameters are a template for the "small set of meaningful parameters" idea: density, step, length, angle-quantisation, seed strategy. Each maps to a visible change in texture.
- Image-driven variants (flow field where the angle comes from image gradient or luminance, particles seeded by brightness) follow directly from "distort angles around objects". That is the natural fxlab bridge between generators and the existing `uInput` image pipeline.
- Quantising angles is a cheap way to turn an organic generator into an art-directed one. It has one parameter and a strong stylistic effect.

### Gaps
- No fetched source for Truchet, cellular automata, reaction-diffusion (Gray-Scott feed/kill), L-systems, circle packing, strange attractors or moiré parameter ranges. Not researched in this pass.
- No sourced ranking of which techniques are "essential". The split above is inference only.

## 2. Landmark practitioners and what makes their work art-directed

### Takeaway
Across the sources, art direction comes from constrained systems: authored instructions, a small vocabulary and deliberate curation of outputs. Reas works from written instructions, Hobbs polishes one algorithm deeply, and Bremer lets the visual appeal lead while still hinting at the data.

### Cited Findings
- Reas co-created Processing (2001, with Ben Fry). His practice centres on writing software to generate images, connected to conceptual and systems-based art. — [reas.com](https://reas.com/); [Bitforms bio](https://www.bitforms.art/wp-content/uploads/2024/07/reas_bio.pdf)
- Software Structures used text instructions in the LeWitt manner, from which Reas and collaborators produced 26 software pieces. This shows one written rule set yielding many different outputs. — [Whitney](https://whitney.org/exhibitions/software-structures)
- Hobbs notes many programmers reach for flow fields early but few polish their use. His craft is in tuning and variation, not the algorithm itself. — [Flow Fields](https://www.tylerxhobbs.com/words/flow-fields)
- Nadieh Bremer (Visual Cinnamon) has an astronomy and data-science background. She moves toward data art when the need to explain is relaxed, focusing on visual appeal and the feeling evoked while still alluding subtly to trends in the data. — [Visual Cinnamon, About](https://www.visualcinnamon.com/about/)
- Moritz Stefaner (Truth & Beauty) praises Bremer's "relentless creative explorations, pushing past the obvious". — [Visual Cinnamon](https://www.visualcinnamon.com/)
- Bremer's book: CHART: Designing Creative Data Visualizations from Charts to Art. — [Visual Cinnamon, CHART](https://www.visualcinnamon.com/chart/)

### Inferences
- The recurring art-direction levers, inferred from the above: (1) one deeply tuned algorithm rather than many shallow ones, (2) an authored constraint set (palette, density range, angle vocabulary), (3) curation of outputs rather than accepting every seed, (4) data used as a subtle influence, not a literal chart.
- For fxlab, "instruction-like" presets (a named look with fixed ranges) mirror Reas's LeWitt-style structures.

### Gaps
- Not researched: Zach Lieberman, Manolo Gamboa Naon, Accurat, Ben Fry/Fathom, Refik Anadol, Universal Everything, Field.io, Ryoji Ikeda, Nervous System, fxhash/Art Blocks curation. No fetched sources; the report should not attribute specific claims to them from this file.

## 3. Dataviz principles that transfer; data-driven identities and their constraints

### Takeaway
Bertin's variables, Cleveland–McGill ranking and ColorBrewer scale types give a ready vocabulary for mapping data fields to visual variables. Data-driven identities keep consistency by fixing most of the system (grid, logo skeleton, palette) and opening only one or a few elements to data.

### Cited Findings
- Bertin (Semiology of Graphics, 1967) defines position (x, y) plus six retinal variables: shape, size, orientation, value (brightness), colour and texture (granularity). They are independent of position. — [Towards Data Science summary](https://towardsdatascience.com/data-visualization-explained-part-2-an-introduction-to-visual-variables/); [arXiv 2307.10089](https://arxiv.org/pdf/2307.10089)
- Bertin's four perceptual qualities are associative, selective, ordered and quantitative. They determine which variable suits which data type. — [Towards Data Science](https://towardsdatascience.com/data-visualization-explained-part-2-an-introduction-to-visual-variables/)
- Cleveland–McGill ranking, most to least accurate: position along a common scale; positions along nonaligned scales; length, direction, angle; area; volume, curvature; shading, colour. — [Information Visuals](https://www.informationvisuals.com/information-design-theory/elementary-perceptual-tasks); [Kennedy Elliott summary](https://medium.com/@kennelliott/39-studies-about-human-perception-in-30-minutes-4728f9e31a73)
- ColorBrewer (Brewer, Harrower, Penn State, 2002) has three scheme types:
  - Sequential: lightness steps dominate, for ordered low-to-high data.
  - Diverging: light midpoint, dark contrasting hues at extremes, for a meaningful midpoint.
  - Qualitative: hue differences with subtle lightness differences, for categories.
  Colourblind-safe options are offered. — [ColorBrewer](https://colorbrewer2.org/); [Penn State GEOG 486](https://courses.ems.psu.edu/geog486/node/878); [Wikipedia](https://en.wikipedia.org/wiki/ColorBrewer)
- Viridis is perceptually uniform, robust to colour blindness and prints well in greyscale. Cividis (Nuñez, Anderton, Renslow) is optimised to look effectively identical to colour-blind and non-colour-blind viewers. — [viridis vignette (CRAN)](https://cran.r-project.org/web/packages/viridis/vignettes/intro-to-viridis.html); [PLOS One](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0199239); [cmap docs](https://cmap-docs.readthedocs.io/catalog/sequential/cividis:cividis/)
- Data humanism (Lupi, manifesto 2017) says data is a placeholder for reality. It grew out of Dear Data (with Stefanie Posavec). An arXiv paper characterises 13 principles, including small data, imperfect data, subjective data, data to depict complexity (layering for depth with accessibility), data drawing, and design-driven data. — [Giorgia Lupi](http://giorgialupi.com/data-humanism-my-manifesto-for-a-new-data-wold); [German Design Council](https://www.german-design-council.de/en/design-perspectives/article-detail/giorgia-lupi-data-humanism); [arXiv 2509.00440](https://arxiv.org/html/2509.00440v1)
- Nordkyn tourism site: the logo updates every five minutes from Norwegian Meteorological Institute weather data (Neue Design). — [Run Design](https://www.rundesign.it/logo-nordkyn/), summarised via search; [ResearchGate figure credit NeueDesign](https://www.researchgate.net/figure/Logotipo-para-promocionar-el-turismo-en-la-peninsula-de-NordkynImagen-NeueDesign_fig2_220010195)
- Other data-driven brand examples listed by Patrik Hübner: Philharmonie Luxembourg (live sound), BRUTE wine (weather), Lexus NX 100 Thieves (esports statistics), Polkadot (community input), The Pulse (real-time streams). Stated principle: opening up at least one identity element gives the brand a "living character", within predetermined guidelines. Recognisability despite variation works "like a playlist". — [Patrik Hübner, Dynamic identities](https://www.patrik-huebner.com/datadesigndictionary/dynamic-identities/)
- MIT Media Lab (Pentagram, 2014): a 7x7-grid ML monogram, based on Richard The's earlier 25th-anniversary logo, extended with the same grid to glyphs for 23 research groups. Fixed identity plus per-group variation. — [Pentagram](https://www.pentagram.com/work/mit-media-lab); [Dezeen](https://www.dezeen.com/2014/10/29/pentagram-mit-media-lab-rebrand-visual-identity/)
- Spotify Wrapped is an annual year-in-review since 2016. An It's Nice That piece is titled "No grid, no rules", on the 2023 identity. Contents not fetched. — [Wikipedia](https://en.wikipedia.org/wiki/Spotify_Wrapped); [It's Nice That](https://www.itsnicethat.com/features/spotify-wrapped-campaign-identity-2023-graphic-design-301123)

### Inferences
- Transferable mapping rule: map ordered or quantitative fields to position, length or value, and categorical fields to hue, shape or texture. Avoid area or colour for precise quantities (Cleveland–McGill and Bertin). For identity work precision matters less than legibility of pattern, so lower-ranked channels (texture, density, rhythm) are acceptable.
- Constraint pattern behind consistency, inferred from MIT Media Lab, Nordkyn and Hübner: fixed grid or skeleton, fixed palette, bounded parameter ranges, and a fixed logo lockup, with data driving only a small number of variables.
- Default colour handling in a tool should offer sequential (viridis-like), diverging and categorical modes, and let brand palettes be interpolated as sequential ramps with a lightness check. Interpolation in a perceptual space (OKLab or similar) is a reasonable implementation choice; not sourced here.

### Gaps
- Not sourced: Tufte principles, Eurovision, Dia, Wikipedia-derived identities, Stripe/Vercel gradient systems (search returned nothing relevant), details of Spotify Wrapped's system, and Ryoji Ikeda's data-as-texture work.
- The Nordkyn claim comes from secondary summaries; the original Neue Design page was not fetched.

## 4. Practical creative-code engineering

### Takeaway
WebGL2 remains the safe baseline (about 98% coverage). WebGPU compute is now in Chrome, Edge and Safari 26, but Firefox has it disabled by default as of mid-2026 per one secondary source, so compute-based particles need a WebGL2 fallback. Lygia and the Book of Shaders are the reusable shader sources.

### Cited Findings
- WebGL2 is shipped in Chrome, Edge, Firefox and Safari at about 98% of global browser usage. — [Cinevva, WebGPU vs WebGL 2026](https://app.cinevva.com/guides/webgpu-vs-webgl-games); [TestMu](https://www.testmuai.com/learning-hub/webgl-2-browser-compatibility/)
- WebGL2 has no compute shaders. The usual workaround is transform feedback or float textures with `texelFetch`. The Khronos WebGL2 Compute spec is described as obsolete. — [Cinevva](https://app.cinevva.com/guides/webgpu-vs-webgl-games)
- Safari 26 (September 2025) shipped WebGPU. Firefox has it disabled by default as of mid-2026 (secondary source, verify before relying on it). — [Cinevva](https://app.cinevva.com/guides/webgpu-vs-webgl-games); [Webo360](https://webo360solutions.com/blog/webgpu-browser-support/)
- Lygia is granular, multi-language and designed to be included function by function; it includes a `noised` function returning value noise plus derivatives. — [Lygia](https://lygia.xyz/generative/noised); [GitHub](https://github.com/patriciogonzalezvivo/lygia)
- Hobbs suggests specifying sizes as fractions of image width (0.5%, 0.1–0.5%). — [Flow Fields](https://www.tylerxhobbs.com/words/flow-fields)

### Inferences
- fxlab's existing conventions already match: fractional sizing, GLSL prelude helpers (`fbm hash12`), and Canvas 2D for path-based generators such as flow-field curves. A flow-field or particle generator is naturally a `kind:'2d'` module; noise, Worley, warping and moiré are natural fragment shaders. This is inference from the CLAUDE.md, not from external sources.
- Seeded PRNG plus the noise-offset from a seed is the standard reproducibility approach (general knowledge, not sourced in this pass). Loops need noise sampled on a circle in (x, y, cos, sin) space to give whole-cycle motion; this matches fxlab's `uLoop` rule.
- Parameter budget: Hobbs's flow field needs roughly five to six meaningful controls. That is a reasonable working upper bound for a single generator, but no source states a rule.

### Gaps
- No source found on how many parameters is "too many", on seeding conventions in fxhash/Art Blocks, on p5/three/regl/OGL/PixiJS trade-offs, or on measured performance limits.

## 5. Data input for a browser tool

### Takeaway
The dataviz tool convention is: upload or paste a table, bind columns to channels, and reference fields by name. Vega-Lite's encoding model (field plus type per channel) is the cleanest mental model to copy.

### Cited Findings
- Vega-Lite specs are simple mappings of data variables to encoding channels (x, y, colour, size, and so on). Each mapping names a field and a type, e.g. `"x": {"field": "customer", "type": "ordinal"}`. — [Vega-Lite Encoding](https://vega.github.io/vega-lite/docs/encoding.html); [Vega-Lite intro](https://vega.github.io/vega-lite/tutorials/getting_started.html)
- In Flourish, you upload data, then point the data binding at named columns. Its Vega-Lite template lets the encoding field names refer to bound columns. — [Flourish blog](https://flourish.studio/blog/vega-lite-in-flourish/); [Flourish Vega-Lite](https://app.flourish.studio/@tim/vega-lite)
- Data humanism principles favour small, personal datasets and imperfect data as meaningful signal, which suits a designer-facing tool better than big-data pipelines. — [arXiv 2509.00440](https://arxiv.org/html/2509.00440v1)

### Inferences
- Suggested design for a paste-in table: auto-detect column types (quantitative, ordinal, categorical, temporal) and propose default bindings using Bertin/Cleveland ordering (first numeric to length or size, second numeric to value, categorical to hue or pattern). Ship a few small built-in datasets (say 12 to 60 rows) tuned to look good on first use; this follows the CLAUDE.md "defaults matter" rule.
- Normalise each bound field to 0..1 with an optional clamp and a choice of linear, log or rank scale, so any dataset gives a usable result.
- Constrain outputs to brand-role colours and bounded ranges so that any data gives an on-brand result (the Hübner constraint pattern).

### Gaps
- Nothing fetched on Datawrapper's import behaviour, CSV/JSON parsing edge cases, or sample datasets that look good. No sourced guidance on sensible defaults.
