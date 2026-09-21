# Brand and digital visual-language tooling: landscape for auditing fxlab

Scope note: ~17 tool calls; web search snippets plus four page fetches. Categories and tools with no sourced finding here are listed under Gaps rather than described from memory.

## 1. Which tools do teams use to define and operate a visual identity?

### Takeaway
The market splits into four layers: guideline/asset platforms (Frontify, Bynder, Brandfolder, Canva) that govern use; token pipelines (Figma variables, Tokens Studio, DTCG) that carry colour/type; shader/motion authoring tools (Unicorn Studio, Paper) that ship treatments as embeddable code; and bespoke studio-built generators (Field, Figma Config) that encode one identity as a tool. fxlab sits in the third/fourth layer, but as a general discovery tool rather than a per-client generator.

### Cited Findings
**(a) Guideline / portal platforms**
- Frontify: guidelines have 40+ prebuilt content blocks (colour, type) plus Marketplace blocks; template management lets non-designers generate on-brand material with lockable elements, embedded approval workflows and preconfigured formats. — [Frontify pricing/feature summaries via GetApp](https://www.getapp.com/marketing-software/a/frontify/), [Frontify brand guidelines](https://www.frontify.com/en/brand-guidelines)
- Frontify pricing is quote-based, MAU-metered; third-party estimates ~$1.2-1.8k/yr for small teams, ~$8-15k/yr mid-size (estimates, not vendor-published). — [Vendr](https://www.vendr.com/marketplace/frontify), [Frontify pricing](https://www.frontify.com/en/pricing)
- Frontify positions guidelines as machine-readable context fed to AI tools via an MCP. Bynder markets a Brand Compliance Agent that audits assets against guidelines and a Transformation Agent that preserves the core product visual while changing background/context. Brandfolder's AI is described by third parties as discovery-oriented (tagging, visual search). These are competitor/analyst claims, some from vendor blogs. — [Matchstic 2026 rankings](https://learn.matchstic.com/ai-ready-brand-guidelines-software-the-2026-rankings), [Bynder on AI 2026](https://www.bynder.com/en/blog/human-led-ai-in-2026/)
- Canva Brand Controls: colour control (only brand colours), font control (only brand fonts), design approval before publish/download; Brand Template locks specify which elements can be edited (logo placement, font styles, colour blocks). — [Canva Brand Controls](https://www.canva.com/help/brand-control/), [Canva approval settings](https://www.canva.com/help/manage-approval-settings-for-teams/), [Canva brand management](https://www.canva.com/solutions/brand-management-tools/)
- Tokens Studio: exports tokens as Figma Variables, Styles or both; GitHub/GitLab sync writes DTCG JSON; Style Dictionary then emits CSS/JS/Swift/Kotlin. — [Tokens Studio export](https://docs.tokens.studio/figma/export/), [Tokens Studio token format](https://docs.tokens.studio/manage-settings/token-format), [Palette Daddy guide](https://palettedaddy.com/guides/design-tokens-figma-token-studio)
- Zeroheight, Brandpad, Figma libraries: not researched beyond zeroheight being listed as a DTCG adopter (see section 4).

**(b) Generative / shader / motion tools**
- Unicorn Studio: 75+ effects, AI-assisted creation, variables/presets/events; runs on WebGL 2 via ~50 kB gzipped JS lib; export panel gives snippets/components for Framer, Webflow, Figma Sites, React, HTML; also images/video. Free tier: 10 published scenes, logo on public URLs, no commercial use or code export. Legend: $14/mo annual or $20/mo; unlimited publishes, commercial licence, versioning, custom fonts, 3D models. — [Unicorn Studio FAQ](https://www.unicorn.studio/docs/faqs/), [Embed guide](https://www.unicorn.studio/docs/embed/), [uithings overview](https://uithings.com/what-is-unicorn-studio)
- Paper Shaders: open source (Apache 2.0), 30+ WebGL effects (mesh gradient, noise, halftone, aurora), npm `@paper-design/shaders` (vanilla) and `-react`; design in Paper's editor, export zero-dependency JS. — [npm](https://www.npmjs.com/package/@paper-design/shaders), [GitHub](https://github.com/paper-design/shaders), [designtools.fyi, July 2026](https://designtools.fyi/news/paper-shaders-toolcraft-july-2026)
- The same source reports Figma shipped a competing generative-shader feature at Config 2026 and that Pixel Point released "Toolcraft", a starter kit (sliders, pickers, timeline, canvas scaffolding) for building custom creative tools. — [designtools.fyi](https://designtools.fyi/news/paper-shaders-toolcraft-july-2026)
- Rive vs Lottie: a .lottie file is a zip of animation JSON, assets, and optionally a state machine (dotLottie state machines arrived late 2025); Rive builds logic into the runtime; Rive-to-Lottie conversion may not preserve state machines or runtime controls. — [PkgPulse](https://www.pkgpulse.com/guides/lottie-vs-rive-vs-css-animations-web-animation-formats-2026), [LottieFiles docs](https://docs.lottiefiles.com/en/runtimes/distributions/js/v0.x/state-machines), [Rive masterclass](https://www.rivemasterclass.com/blog/rive-vs-lottie)
- Shaders.com, Shader Gradient, Haikei, Grainient, Cavalry, Jitter, Spline, TouchDesigner, Runway/Firefly: no sourced findings gathered (Gaps).

**(c) Colour explorers**
- Poline: open-source lib generating palettes by interpolating between anchor points (min two, unlimited) in a cartesian mapping of HSL; also a Tokens Studio graph-engine node. — [GitHub](https://github.com/meodai/poline), [Tokens Studio docs](https://documentation.tokens.studio/graph-engine/available-nodes/color/poline)
- Huemint uses machine learning to produce brand colour schemes; Realtime Colors previews a palette on a real website and exports. — [Huemint](https://huemint.com/), [Realtime Colors](https://www.realtimecolors.com/)
- Coolors, Khroma, Adobe Color: only surfaced as search results, no facts read.

**(d) Studio-built tools**
- Field.io x IBM Quantum: generative brand tool whose parameters map to three quantum principles (superposition, entanglement, interference); serves marketing, event and product teams; used at 2023 Quantum Summit to make visuals from attendee location data; outputs across digital, product, projected event lighting, print (badges, invitations) and video. — [Field.io case](https://field.io/work/ibm-quantum-brand-visuals), [ecosystem page](https://field.io/work/ibm-quantum)
- Field.io x Adidas REAL/RAW/FAST: bespoke tool remixes a large content database (campaign photo, video, kinetic type, procedural animation) in real time across multi-screen store clusters, customised per store area and theme; from plug-and-play rollout to bespoke flagships; identity conceived by DIA, system built by Field. — [Field case](https://field.io/work/real-raw-fast-identity-system)
- Figma Config 2026 identity: Brand Studio built tools in Figma Make to codify lo-fi effects (scribbly linework, blurred gradients, oval particles); a dithering tool applied one treatment to hundreds of speaker headshots without hours of manual work; brand wanted "touches of imperfection". — [Figma blog](https://www.figma.com/blog/the-visual-identity-behind-config-2026/)
- Pentagram MIT Media Lab (2014): 7x7 grid generates ML monogram and 23 group sub-logos; a bitmap system rather than software tool. — [Pentagram](https://www.pentagram.com/work/mit-media-lab), [Dezeen](https://www.dezeen.com/2014/10/29/pentagram-mit-media-lab-rebrand-visual-identity/), [Brand New](https://www.underconsideration.com/brandnew/archives/new_logo_and_identity_for_mit_media_lab_by_pentagram.php)
- Studio Dumbar/DEPT, Collins, DixonBaxi: not researched.

### Inferences
- The Config dither tool and IBM tool are precedents for fxlab's exact pitch: a treatment plus a few parameters becomes the identity engine. Both were built one-off per client, so a reusable discovery tool is a plausible gap.
- Nothing found suggests these bespoke tools export a portable "language" beyond assets; the tool itself is the deliverable.

### Gaps
- Who pays and known limits for Field/Config tools: case studies are promotional; no criticism found.
- Cavalry, Jitter, Spline, TouchDesigner, Shaders.com, Haikei, Grainient, Runway/Firefly, Zeroheight, Brandpad details not retrieved.

## 2. What does a visual-language deliverable contain; how are image treatment rules shown?

### Takeaway
Photography/image guides typically specify colour, lighting, composition, editing (preset or LUT), retouching limits and delivery specs. Parameterised treatment (values plus before/after) is rarer in what I found.

### Cited Findings
- Photography style guides cover palette/saturation, lighting, shot lists, props allowed/prohibited, model direction; editing standards name the preset or LUT, retouch boundaries, file format, resolution, colour profile, naming. — [Bettermockups](https://www.bettermockups.com/blogs/resources/brand-photography-guidelines), [SquareShot](https://www.squareshot.com/post/how-to-create-a-photography-style-guide-expert-guide) (blog-level sources, not brand-owned)
- Concrete guideline pages surfaced: ASU art-direction and editing guidance — [ASU](https://brandguide.asu.edu/execution-guidelines/photo-video/art-direction); Illinois photography — [Illinois](https://brand.illinois.edu/visual-identity/photography); Zebra photography PDF — [Zebra](https://www.zebra.com/content/dam/zebra_new_ia/en-us/corporate-and-brand/brand/guide/brand-guide-photography-en-us.pdf). I did not open them, so their before/after or parameter presentation is unverified.

### Inferences
- Rules stated as a LUT/preset name imply the treatment is a portable artefact; a fxlab "recipe" with named parameters and ranges could be a more precise equivalent.

### Gaps
- No verified examples of guideline sites showing image treatment with parameters or before/after (Spotify, Airbnb, Mailchimp, Frontify showcase sites not fetched).
- Texture library, motion principles and generative rules deliverable contents: not sourced.

## 3. How do tools express constants plus variation, and protect consistency?

### Takeaway
Platform tools enforce by restriction (locks, allowed palettes, approval); generative tools enforce by exposing only a few meaningful parameters.

### Cited Findings
- Canva: colour/font restriction, locked template elements, approval gate before publish or download. — [Canva help](https://www.canva.com/help/brand-control/), [Canva approval](https://www.canva.com/help/design-approval-for-enterprise/)
- Frontify: lockable template elements, approvals, preconfigured formats. — [GetApp](https://www.getapp.com/marketing-software/a/frontify/)
- IBM Quantum tool: parameters are a small set of metaphoric controls (three principles), rather than raw technical settings. — [Field](https://field.io/work/ibm-quantum-brand-visuals)
- Unicorn Studio: variables, presets, events for adaptable scenes. — [FAQ/overview](https://uithings.com/what-is-unicorn-studio)
- Config dither: one automated treatment for hundreds of headshots; operators need not understand mechanics. — [Figma blog](https://www.figma.com/blog/the-visual-identity-behind-config-2026/)
- Seeds specifically: no source gathered.

### Inferences
- fxlab's "no presets" stance plus ranges maps onto the "few meaningful parameters" pattern; the missing piece versus Canva/Frontify is a lock/range layer (which params are fixed, which may vary and within what bounds) and a check step. Seeds/reproducibility is likely important but unsourced.

### Gaps
- Seeds, ranges and constraints in shader/generative tools not documented in what I read.

## 4. What do tools export so the language travels; fidelity honesty

### Takeaway
Tokens travel well via DTCG; effects travel as embeddable code or media; animation logic travels poorly between Rive and Lottie. Fidelity caveats are documented mainly for animation formats.

### Cited Findings
- DTCG Design Tokens spec first stable version (2025.10) announced 28 Oct 2025; tokens have `$value` and `$type`, references by path, theming and modern colour spaces; backed by 40+ organisations; support in Style Dictionary, Tokens Studio, Terrazzo, Penpot, Figma, Sketch, Framer, Knapsack, Supernova, zeroheight. — [W3C CG announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/), [spec](https://www.designtokens.org/tr/2025.10/format/)
- Tokens Studio -> Git as DTCG JSON -> Style Dictionary -> platform code. — [Tokens Studio](https://docs.tokens.studio/figma/export/)
- Unicorn Studio: SDK embed, framework components, image/video export. — [Embed guide](https://www.unicorn.studio/docs/embed/)
- Paper Shaders: zero-dependency JS, npm packages. — [npm](https://www.npmjs.com/package/@paper-design/shaders)
- .lottie is a zip container; Rive-to-Lottie conversion may lose state machines and runtime controls. — [PkgPulse](https://www.pkgpulse.com/guides/lottie-vs-rive-vs-css-animations-web-animation-formats-2026), [Rive masterclass](https://www.rivemasterclass.com/blog/rive-vs-lottie)
- Photography guides name a LUT as the treatment carrier. — [Bettermockups](https://www.bettermockups.com/blogs/resources/brand-photography-guidelines)

### Inferences
- fxlab already exports palette and motion tokens; emitting them as DTCG JSON would join the standard pipeline at low cost. Colour/motion tokens are honest to export; shader graphs are not representable in DTCG, so a shader-recipe export (JSON of module ids and params) plus a small runtime would be the honest equivalent. A LUT export would only capture per-pixel colour, not spatial effects (grain, dither, masks); this limit would need to be stated.
- Shareable URLs with encoded state and embed players: not sourced; treat as a design idea.

### Gaps
- DTCG has no shader/texture token type that I found; not verified either way.

## 5. What do brand teams pay for; relevance to a browser-only single-file tool

### Takeaway
Paid platforms sell governance (locks, approval, distribution, AI compliance checks). Most of that needs a backend; the generative-authoring end (free tiers, open source) is where a client-side tool competes.

### Cited Findings
- Paid features named across platforms: lockable templates, approval workflows, brand-compliance AI agents, MCP/AI context, versioning, commercial licence, custom fonts. — [Frontify](https://www.frontify.com/en/brand-guidelines), [Bynder](https://www.bynder.com/en/blog/human-led-ai-in-2026/), [Unicorn FAQ](https://www.unicorn.studio/docs/faqs/)
- Open, free alternatives exist for shader effects (Apache 2.0). — [designtools.fyi](https://designtools.fyi/news/paper-shaders-toolcraft-july-2026)
- Review/community sentiment on what teams love: not gathered.

### Inferences
- In scope for a no-backend tool: local versioning (project JSON), locked/ranged parameters, exportable spec, self-check of an asset against the recipe. Out of scope: user accounts, approval routing, DAM distribution, analytics, hosted embeds.

### Gaps
- Direct user testimony (G2, Reddit, Config talks) not retrieved.

## 6. Gaps a tool like fxlab could credibly fill

### Takeaway
Evidence supports one credible gap: nothing surveyed *discovers* a treatment from real imagery and then packages it as a small reusable tool. Platforms govern, shader tools author, studios hand-build.

### Cited Findings
- Config's team had to build a dither tool for a single event identity; IBM and Adidas needed bespoke tools. — [Figma blog](https://www.figma.com/blog/the-visual-identity-behind-config-2026/), [Field IBM](https://field.io/work/ibm-quantum-brand-visuals), [Field Adidas](https://field.io/work/real-raw-fast-identity-system)
- Figma is now shipping generative shaders natively, which narrows the room for a generic shader authoring tool. — [designtools.fyi](https://designtools.fyi/news/paper-shaders-toolcraft-july-2026) (single secondary source)

### Inferences
- Opportunity: "explore, then freeze" — turn a found look into a locked recipe with declared variable ranges and data-driven parameters (fxlab's data-column driving matches IBM's attendee-data use), exported as project JSON, DTCG-compatible tokens, and a lightweight player.
- Risk: without a lock/range layer and a fidelity statement, a saved project remains a preset, not a language.

### Gaps
- No market evidence on demand or on whether brand teams would accept a single-file tool as system-of-record.
