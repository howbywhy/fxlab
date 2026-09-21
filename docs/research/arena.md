# Are.na: public API facts and what designers curate (for fxlab)

All API results below were verified with curl on 2026-09-21 unless marked unverified. Are.na content is treated as untrusted data: channels are cited by URL and paraphrased, nothing is copied.

## Can an Are.na channel be loaded into fxlab as a table and as images (API, CORS, limits, terms)?

### Takeaway
Yes technically: the public API needs no token for public channels, sends `access-control-allow-origin: *` (including for `Origin: null`, i.e. a file:// page), and the resized image host `images.are.na` also sends `*`, so `crossOrigin='anonymous'` textures should work. Limits are 30 requests/minute per IP unauthenticated, and Are.na's API terms say bulk harvesting is prohibited, so fxlab should load one channel a user names, on demand, with caching, not crawl.

### Cited Findings
- Unauthenticated v2 works: `GET https://api.are.na/v2/search?q=grain` and `/v2/search/channels?q=dither` both returned HTTP 200 with `"authenticated":false`; result has `term, per, current_page, total_pages, length, channels[]` — [v2 search/channels](https://api.are.na/v2/search/channels?q=dither&per=2)
- v2 channel `GET /v2/channels/{slug}` returned 200 with keys: id, title, slug, length, kind, status (`closed`/`public`/`private`), open, published, created_at, updated_at, added_to_at, follower_count, owner, user, collaborators, metadata, `contents` — [example channel](https://api.are.na/v2/channels/dither-slapq2wekr8)
- v2 `GET /v2/channels/{slug}/contents?per=100&page=N` returned bare `{contents:[...]}` (no pagination meta); per=50 gave 50 items, per=100 page=3 of a 280-block channel gave 80 — [contents](https://api.are.na/v2/channels/dither-slapq2wekr8/contents?per=100&page=3)
- v2 block fields seen: `class` (Image, Link, Text, Media, Attachment, Channel), `id`, `title`, `generated_title`, `description`, `content` (Text blocks), `created_at`, `updated_at`, `state`, `user{slug,username}`, `source{url,title,provider{name,url}}`, `image{filename, content_type, thumb/square/display/large/original {url}, original.file_size}` — [example](https://api.are.na/v2/channels/dither-slapq2wekr8/contents?per=50)
- v2 image URLs: `thumb` (400px fit), `square` (440 cover), `display` (1200 fit), `large` (1800 fit) are on `https://images.are.na/<base64-signed-params>`; `original.url` is on `d2w9rnfcy7mm78.cloudfront.net` — same source
- A v3 API exists and is the documented one: `GET https://api.are.na/v3/channels/{slug}` returned 200 with `id, type, title, slug, state, visibility, owner, counts{blocks, channels, contents}, can, _links`; `/v3/channels/{slug}/contents?per=2` returned `{meta:{current_page,next_page,total_pages,total_count,has_more_pages,per_page}, data:[...]}`; v3 blocks use `type` (Image etc.), `image{src, width, height, aspect_ratio, content_type, file_size, small/medium/large{src,src_2x,width,height}}`, `source`, `user` — [v3 channel](https://api.are.na/v3/channels/dither-slapq2wekr8), [v3 contents](https://api.are.na/v3/channels/dither-slapq2wekr8/contents?per=2)
- v3 `/v3/search?query=dither` without a token returned 401 (JSON, 83 bytes), so v3 search appears to need a token while v2 search does not — [v3 search](https://api.are.na/v3/search?query=dither)
- OpenAPI spec is published as YAML at [api.are.na/v3/openapi](https://api.are.na/v3/openapi) (version 3.0.0). Bearer auth: `Authorization: Bearer YOUR_TOKEN`; personal access tokens are created at [are.na/developers](https://www.are.na/developers). Per-page max is 100; the spec says iterate until `has_more_pages` is false, and supports ETag/304 (304 still counts against limits).
- Rate limits (spec): Guest 30/min, Free 120, Premium 300, Supporter/Lifetime 600; limit is global, per IP for guests; 429 on excess; headers `X-RateLimit-Limit/Remaining/Reset/Tier/Window/Bucket/Cost/Policy` — [OpenAPI](https://api.are.na/v3/openapi). Observed on v3 as guest: `x-ratelimit-limit: 30`, `x-ratelimit-tier: guest`. The v2 responses I saw carried no rate-limit headers.
- CORS on API: for `Origin: null` and `Origin: https://example.com`, `api.are.na/v2/channels/{slug}` returns `access-control-allow-origin: *`, methods `GET, POST, PUT, OPTIONS, DELETE`, and exposes the X-RateLimit headers. A preflight (OPTIONS with `Access-Control-Request-Headers: authorization`) returned 200 with `access-control-allow-headers: authorization`. v3 also returns `*`. So a file:// page (origin `null`) can read it, with or without a bearer token — [v2](https://api.are.na/v2/channels/dither-slapq2wekr8), [v3](https://api.are.na/v3/channels/dither-slapq2wekr8)
- CORS on image host: `images.are.na/...` returned 200 `content-type: image/png`, `access-control-allow-origin: *`, `cache-control: max-age=31536000,public` for both `Origin: null` and `https://example.com` — this is what to feed `img.crossOrigin='anonymous'` (canvas/WebGL safe) — sample from [dither channel](https://api.are.na/v2/channels/dither-slapq2wekr8/contents?per=50)
- CORS on originals: the `cloudfront.net` original URL answered to curl with HTTP 202, empty body, `x-amzn-waf-action` exposed (an AWS WAF challenge), though `access-control-allow-origin: *` was present. So do not depend on `original.url` from a script; use `display` or `large`. Not tested from a real browser.
- Link blocks' images can be a scraped screenshot/preview of the source page (e.g. a Link block with an `image` and `source.url`), so image blocks include tool screenshots, not only photos — [example](https://api.are.na/v2/channels/dither-slapq2wekr8/contents?per=50)
- Terms: the OpenAPI text says the API is for integrations, "not for scraping or bulk data collection", automated crawling and systematic downloading are prohibited, and bulk access needs contacting help@are.na; it also recommends caching and 200-500ms delays — [OpenAPI](https://api.are.na/v3/openapi). The Terms of Service reserve the right to restrict API calls, scraping and bulk automated downloads at Are.na's discretion, grant a personal, non-commercial licence to view content, and say reproducing or distributing content for other purposes needs written permission — [Terms](https://www.are.na/terms)

### Inferences
- A user-triggered "load channel" (one channel, one or a few pages of 100, a few images at `display` size) fits the stated intent of the API, and CORS is fine from file://. Batch-downloading many channels or shipping cached Are.na images inside fxlab would sit outside the terms.
- Images stay other people's work: fxlab should keep them in memory/session only, not save into projects or exports by default, and show curator/channel attribution. Palette extraction from a loaded image is a derived value, but the terms text does not address it (unverified whether that matters).
- A robust client: prefer v3 for channels/contents when a token is present, v2 as the tokenless path; treat both schemas as different (`class` vs `type`, `image.display.url` vs `image.medium.src`); back off using `Retry-After` on 429. The v2 `contents` call returns no total pages, so stop when a page returns fewer than `per`.
- Table view: one row per block (id, class/type, title, source domain, created_at, user, image URL) is directly buildable.

### Gaps
- Browser-side confirmation that a WebGL `texImage2D` upload from `images.are.na` succeeds was not run (only header inspection with curl).
- Whether v2 is rate limited or deprecated: no header or doc found; v3 docs do not mention v2 at all.
- Whether private/closed channels behave differently for tokenless users beyond `status:"private"` appearing in search: not tested. The example channel is `closed` (readable but only owner adds) and loads fine.
- No explicit statement found about display or processing of others' images inside third-party tools beyond the Terms and API acceptable-use text above.

## What do designers curate on Are.na around creative code, masking, treatments, textures, identity?

### Takeaway
Curation is overwhelmingly image-led moodboards (dither, grain, textures, glitch, gradients, information aesthetics) with very little text; the code-side channels (shaders, p5, design tools) are link lists dominated by GitHub, Shadertoy, OpenProcessing and blogs. Dither/halftone/ASCII, grain/scan/photocopy texture, and gradients-with-noise are the most-collected looks. Masking as a named topic was not found as its own channel family.

### Cited Findings
- Search method: 29 term queries against `/v2/search/channels?per=30` returned 746 distinct channels; the most-followed hits are big texture and treatment channels: "grain & grace" (about 24.6k blocks, 1355 followers), "Brand Systems" (3153 blocks, 1750 followers), "TEXTURES" (898 blocks, 1924 followers), "Textures, Overlays, Scans ETC" (217 blocks, 1160 followers), "Image Treatment / Scan" (715 blocks, 899 followers), "GRADIENTS WITH NOISE" (493 blocks, 772 followers) — [grain & grace](https://www.are.na/niko-gabrilo/grain-grace), [Brand Systems](https://www.are.na/nate-bruzdzinski/brand-systems-4s6dm2_rvcq), [Textures](https://www.are.na/andrew-chambers/textures-e1hfphu48ti), [Image Treatment / Scan](https://www.are.na/max-spencer/image-treatment-scan)
- Term-level channel hit counts (of 30 results max): shaders 30, webgl 30, creative code 30, motion identity 30, feedback 30, risograph 30, halftone 30, glitch 30, but pixel sort 9, datamosh 16, generative identity 24, data visualisation art 3, glsl 13. Capped at 30, so this shows only that the term exists, not popularity. Dedicated channels for pixel sort, datamosh and generative identity are small (largest found: pixel sort 116 blocks, generative identity 78 blocks), from the same searches.
- Creative-code channel structure: "Programming Images" (531 blocks; curator Travess Smalley) mixes links (176 of 300 sampled), images (42), media (41) and 27 nested channels (readings, instructions/scripts, diagrams, early computer films, "Harold Cohen and AARON"), framing code as instruction-based image making rather than shader tooling — [Programming Images](https://www.are.na/travess-smalley/programming-images)
- Sampled 17 channels (4,361 blocks) for structure. Image-only moodboards: "treatment/grain/postprod" 297/300 images, "Image Treatment / Scan" 280/300, "Patterns / Dithering" 284/300, "Glitch" 287/300, "Information Aesthetics" 283/300, "work - generative (sketches)" 211/221. Resource lists: shaders and design-tools channels are 85-97% Link blocks. Mixed: "Displacement, Tangents too" has 157 images, 81 text notes, 26 links, 25 attachments (text notes as quotes/definitions). Most image blocks have filename-style or empty titles, so technique names have to come from channel titles rather than block titles — sampled through the v2 contents API (per=100, up to 3 pages), e.g. [displacement channel](https://www.are.na/rithika-pandey/displacement-tangents-too)
- Sources cited in sampled channels (2,894 blocks carrying a source URL): instagram.com 128 (13 channels), google.com 90 (image search redirects), github.com 87 (6), i.redd.it 77, youtube.com 75, behance.net 73, twitter.com 69, Tumblr media hosts, itsnicethat.com 16, savee.it 16, Shadertoy 33 (2 channels), openprocessing.org 11, dribbble 13, iquilezles.org 7, the-brandidentity.com 9. Ignoring social/hosting domains in the six code/tool channels: github.com 84, shadertoy.com 33, openprocessing.org 11, dribbble 10, archive.org 8, iquilezles.org 7, blog.maximeheckel.com 6, cycling74.com 6, tympanus.net 5, p5js.org 5, blog.pkh.me 4, meodai.github.io 4, pouet.net 4, kynd.info 4 — computed from the channels listed in the table
- Tools/libraries by mention in titles/urls of sampled blocks (blocks / channels): Shadertoy 41/2, p5.js 33/4, Processing 44/10 (partly generic word), three.js 20/4, glsl 34/4, OpenProcessing 11/3, Figma 13/3, regl/stackgl 9/1, Hydra 3/1, TouchDesigner 3/2. Repos recurring: hydra (ojack), Dither3D (runevision), didder (makew0rld), hughsk/glsl-dither, Jam3/glsl-fast-gaussian-blur, glsl-blend, hg_sdf, pixi-filters, threegn, MarkovJunior, lil-gui, ShaderGlass, Filters4Processing, KinoFeedback2 — [shaders-generative-resources](https://www.are.na/swiftp-luc-p/shaders-generative-resources), [shaders (Oren Shoham)](https://www.are.na/oren-shoham/shaders-1515139374)
- Named dither/halftone tools collected in the Dither channel (titles): HyperDither, Dither Me This, ordered-dither-maker, Stochaster, Dotraster, Coloraster, Voronoi Stippling, Screentone Generator, Ditherista, ditherit, Aniso (ASCII tool), Vector Halftone Maker, Tooooools.app, Dither Garden, plus articles "Ditherpunk" and "ASCII characters are not pixels" — [Dither](https://www.are.na/sam-dal-monte/dither-slapq2wekr8), [design tools](https://www.are.na/claudia-nathan/design-tools-resources-dnwab_8u0gw)
- Technique words in titles/descriptions/urls of sampled blocks (blocks / channels; substring-based, title-poor, so lower bounds; "3d" and "network" counts were URL noise and are discarded): dither 62/7, tiling/pattern 52/11, data viz 46/7, grain/noise 31/7, kinetic/type 27/9, raymarch/SDF 21/3, scan 20/9, glitch 20/8, ASCII 20/6, gradient 19/6, fluid 18/3, halftone 17/8, droste/recursion 16/4, mask 16/8, particles 15/4, metaballs 15/4, riso 14/4, posterize/pixelate 11/5, threshold/bitmap 10/7, wave/ripple 8/6, tilt-shift/blur 8/4, foil/chrome 8/6, spiral/polar 8/4, feedback 7/4, outline 7/4, reaction-diffusion 6/2, cellular automata 6/5, glass 6/4, painterly 5/3, terrain 5/4, orbit 5/2, photocopy 5/2, hatching/engraving 4/3, melt 4/4, lens 4/3, displacement 4/2; single mentions: slit-scan, moire, voronoi, kaleidoscope, letterpress, mesh gradient, datamosh, domain warp, flow field, attractor — computed from the 17 sampled channels

### Inferences
- Most-collected looks by channel volume and follower count: grain/scan/texture overlays, dither and halftone (patterns/dithering, ASCII, riso), glitch, gradients with noise, and information-aesthetics diagrams. Images in these channels are results, not tools.
- Code-side curators collect explanations and references (Shadertoy, iq, The Book of Shaders style tutorials, SDF/raymarch, fluid, reaction-diffusion, Markov/automata) more than filters; the tools they save are single-purpose web tools (dither, halftone, screentone, ASCII, stippling).
- Masking/matte as an art-directed topic is missing from the channel names found; treat it as a fxlab strength or an unaddressed search term rather than a demand signal.

### Gaps
- Block titles on image channels are mostly filenames, so technique counts undercount; no image analysis was done.
- Sample is 17 channels capped at 300 blocks each, biased to what search returned; not statistically representative.
- Follower and block counts change; "updated" dates are as of 2026-09-21.

## Which channels are most substantial? (20-36 with block counts)

### Takeaway
36 substantial and recent channels are listed; all had activity in 2026 and 60-24,571 blocks.

### Cited Findings
| Title | URL | Curator | Blocks | Updated | Theme |
|---|---|---|---|---|---|
| grain & grace | https://www.are.na/niko-gabrilo/grain-grace | Niko Gabrilo | 24571 | 2026-09-21 | grain/textures |
| Brand Systems | https://www.are.na/nate-bruzdzinski/brand-systems-4s6dm2_rvcq | Nate Bruzdzinski | 3153 | 2026-09-21 | brand systems |
| TEXTURES | https://www.are.na/andrew-chambers/textures-e1hfphu48ti | Andrew Chambers | 898 | 2026-09-21 | textures |
| Generative Art and Design | https://www.are.na/justin-lincoln/generative-art-and-design-j3huzlmjtjq | Justin Lincoln | 5630 | 2026-08-27 | generative art |
| Textures, Overlays, Scans ETC | https://www.are.na/a-m-u50w700oxzg/textures-overlays-scans-etc | A M | 217 | 2026-09-21 | textures/overlays/scans |
| Image Treatment / Scan | https://www.are.na/max-spencer/image-treatment-scan | Max Spencer | 715 | 2026-09-17 | image treatment / scan |
| GRADIENTS WITH NOISE | https://www.are.na/t-hanks/gradients-with-noise | t hanks | 493 | 2026-09-14 | gradients + noise |
| image treatment | https://www.are.na/chloe-techoueyres/image-treatment-6sfpbx6np9y | chloé techoueyres | 953 | 2026-09-19 | image treatment |
| Patterns / Dithering | https://www.are.na/nicolas-boillot/patterns-dithering | Nicolas Boillot | 1368 | 2026-09-12 | dither |
| visual-identity.VISID | https://www.are.na/tony-kim/visual-identity-visid | Tony Kim | 1365 | 2026-09-08 | identity |
| sickening universe visual language sensory palac | https://www.are.na/isa-bel-fwbkuyq7jmy/sickening-universe-visual-language-sensory-palace | isa bel | 990 | 2026-09-20 | visual language |
| *•.¸¸¸.•*ASCII art*•.¸¸¸.•* | https://www.are.na/sofia-guidi/ascii-art-vw4uwuo6eie | Sofia Guidi | 300 | 2026-09-21 | ascii |
| treatment/grain/postprod | https://www.are.na/ianis-coutreau/treatment-grain-postprod | Ianis Coutreau | 1102 | 2026-09-19 | grain/post-production treatment |
| Visual Language | https://www.are.na/forrest-huu-ta/visual-language-xiuu7_gqoqk | Forrest Huu Ta | 1142 | 2026-09-16 | visual language |
| resource / design tools | https://www.are.na/lauren-gallagher-1503862652/resource-design-tools-rvnszvag4ke | Lauren Gallagher | 323 | 2026-09-15 | design tools |
| URI Print Media - Printmaking | https://www.are.na/travess-smalley/uri-print-media-printmaking | Travess Smalley | 1159 | 2026-09-20 | print/photocopy |
| Gradients | https://www.are.na/are-na-commons/gradients | Are.na Commons | 510 | 2026-08-31 | gradients |
| Vectorheart | https://www.are.na/evan-collins-1522646491/vectorheart-eqxlv27j7xo | Evan Collins | 362 | 2026-09-19 | halftone/vector |
| Displacement, Tangents too | https://www.are.na/rithika-pandey/displacement-tangents-too | Rithika Pandey | 658 | 2026-09-19 | displacement |
| Kaleidoscope | https://www.are.na/ashley-jones-bc00nush75g/kaleidoscope-efdunv9narc | Ashley Jones | 960 | 2026-09-14 | kaleidoscope |
| Information Aesthetics | https://www.are.na/mitchel-cox/information-aesthetics-3vs7ysqkvss | Mitchel Cox | 323 | 2026-09-15 | information aesthetics |
| Programming Images | https://www.are.na/travess-smalley/programming-images | Travess Smalley | 531 | 2026-08-07 | creative code / images as programs |
| Glitch | https://www.are.na/justin-lincoln/glitch-smsvf4htlya | Justin Lincoln | 523 | 2026-07-08 | glitch |
| Dither | https://www.are.na/sam-dal-monte/dither-slapq2wekr8 | Sam Dal Monte | 280 | 2026-09-16 | dither |
| Shaders/Generative Resources | https://www.are.na/swiftp-luc-p/shaders-generative-resources | swiftp (luc p) | 265 | 2026-09-08 | shaders |
| Shaders | https://www.are.na/oren-shoham/shaders-1515139374 | Oren Shoham | 255 | 2026-08-13 | shaders |
| Processing, p5.js & WebGL | https://www.are.na/chris-butts/processing-p5-js-webgl | chris butts | 157 | 2026-09-01 | p5/webgl |
| ⊞ Systems: Motion | https://www.are.na/theo-marielle/systems-motion | Théo Marielle | 148 | 2026-09-19 | motion identity |
| Risograph | https://www.are.na/omar-careaga/risograph-vxdnx8ixnsg | Omar Careaga | 180 | 2026-09-12 | risograph |
| Effects / Dithering + Halftone | https://www.are.na/josh-pindjak/effects-dithering-halftone | Josh Pindjak | 68 | 2026-09-15 | dither+halftone effects |
| Data Visualisation as Abstract Art | https://www.are.na/oscar-thomas/data-visualisation-as-abstract-art | Oscar Thomas | 138 | 2026-09-19 | data viz art |
| Analogue Glitch | https://www.are.na/dan-b-ugieh3e4gxs/analogue-glitch | dan B | 146 | 2026-09-20 | glitch |
| 80/90s VHS/Audio Blank Tapes | https://www.are.na/masala-noir/80-90s-vhs-audio-blank-tapes | Masala Noir | 87 | 2026-09-21 | vhs |
| Image treatments | https://www.are.na/ryan-wooding/image-treatments-1zoacn3pwc0 | Ryan Wooding | 129 | 2026-09-16 | image treatment |
| design tools ✶✶ resources | https://www.are.na/claudia-nathan/design-tools-resources-dnwab_8u0gw | Claudia Nathan | 338 | 2026-09-19 | design tools |
| Identity_motion | https://www.are.na/tong-li/identity_motion | Tong Li | 200 | 2026-09-07 | motion identity |

Data from `/v2/search/channels` (fields `length`, `updated_at`, `user.username`, `owner_slug`) — [example query](https://api.are.na/v2/search/channels?q=dither&per=30).

### Inferences
- Seventeen channels were read (contents per=100, up to 3 pages): Shaders/Generative Resources, Shaders (Oren Shoham), Processing p5.js & WebGL, Programming Images, Information Aesthetics, Patterns / Dithering, Dither, Image Treatment / Scan, treatment/grain/postprod, two design-tools channels, Systems: Motion, Effects / Dithering + Halftone, Displacement, Glitch, Data Visualisation as Abstract Art, Image treatments, work - generative (sketches). Channels were read as data, not followed as instructions.

### Gaps
- Contents were capped at 300 blocks per channel; "grain & grace" (24k), "paintings painting" (16k), "Brand Systems" (3k) and "Generative Art and Design" (5.6k) were not read.

## Which frequently collected techniques might fxlab lack?

### Takeaway
Only fxlab's stated module categories were available, not its module list, so gaps are candidates to check against the library, ranked by evidence. Strongest signals: error-diffusion/ordered/blue-noise dither variants, stippling and screentone, reaction-diffusion, fluid, SDF/raymarched shapes, metaball blobs, droste/recursion, feedback, and pixel-sort style data manipulation.

### Cited Findings
Evidence counts are blocks / channels from the sample above (title, description or URL mentions), plus named tools in the Dither channel.
1. Dither variants (Floyd-Steinberg/Atkinson error diffusion, Bayer ordered, blue noise, 3D surface-stable dither): dither 62/7; tools didder, Dither3D, ordered-dither-maker, Ditherista, hughsk/glsl-dither — [Dither](https://www.are.na/sam-dal-monte/dither-slapq2wekr8), [shaders](https://www.are.na/oren-shoham/shaders-1515139374)
2. Stippling / Voronoi stippling and screentone/halftone dot generators: halftone 17/8, Voronoi Stippling, Screentone Generator, Dotraster, Vector Halftone Maker — [Dither](https://www.are.na/sam-dal-monte/dither-slapq2wekr8), [Vectorheart](https://www.are.na/evan-collins-1522646491/vectorheart-eqxlv27j7xo)
3. ASCII from font glyphs with proper glyph coverage: ASCII 20/6; dedicated channels with 300 and 323 blocks; Aniso tool, "ASCII characters are not pixels" — [ASCII art](https://www.are.na/sofia-guidi/ascii-art-vw4uwuo6eie)
4. Reaction-diffusion and morphogenesis: 6/2; jasonwebb/morphogenesis-resources, ready, regl-smooth-life — [shaders-generative-resources](https://www.are.na/swiftp-luc-p/shaders-generative-resources)
5. Fluid simulation (stable fluids): 18/3; WebGL Fluid Simulation, gpu-fluid, Stable Fluids with three.js — same channel
6. SDF / raymarched solids: 21/3; hg_sdf, glsl-sdf-ops, raymarching workshop, iq — [Oren Shoham shaders](https://www.are.na/oren-shoham/shaders-1515139374)
7. Metaballs / blobs (Blobmaker): 15/4 — [resource / design tools](https://www.are.na/lauren-gallagher-1503862652/resource-design-tools-rvnszvag4ke)
8. Droste / recursive zoom / fractals: 16/4 — Programming Images / shaders channels
9. Feedback / echo trails (KinoFeedback2, Hydra): feedback 7/4; search channels for feedback: 30 hits (capped)
10. Pixel sorting (sorting-algorithm imagery, e.g. "Sortraits") and glitch/datamosh: glitch 20/8 (several channels of 146-523 blocks); pixel sort and datamosh channels are few and small (9 and 16 hits, largest 116 blocks) — [Glitch](https://www.are.na/justin-lincoln/glitch-smsvf4htlya), [Analogue Glitch](https://www.are.na/dan-b-ugieh3e4gxs/analogue-glitch)
11. Scan / photocopy / print degradation (xerox, riso, scanner, offset): scan 20/9, riso 14/4, photocopy 5/2; channels Risograph (180 blocks), URI Print Media (1159), Textures Overlays Scans (217), Image Treatment / Scan (715) — [Risograph](https://www.are.na/omar-careaga/risograph-vxdnx8ixnsg), [Print Media](https://www.are.na/travess-smalley/uri-print-media-printmaking)
12. Noise-driven gradients and colour tools (mesh gradient, OKLCH palette generators such as Poline, gradient-with-noise): gradient 19/6; 493-block gradients-with-noise channel — [Gradients with noise](https://www.are.na/t-hanks/gradients-with-noise)
13. Foil, chrome, glass and refraction surfaces: foil/chrome 8/6, glass 6/4
14. Outline / toon shading ("5 ways to draw an outline", toon shader repos): outline 7/4
15. Displacement and tangents as an idea, particles, flow fields, spiral/polar, wave/ripple, tilt-shift blur: 4/2, 15/4, 1/1, 8/4, 8/6, 8/4 respectively — lower evidence

### Inferences
- The techniques most present in curated image channels (dither, halftone, ASCII, grain/scan/print texture, glitch, gradients with noise) are probably already partly covered by fxlab; check depth: dither algorithm choice, blue noise, stippling, glyph-accurate ASCII, and scanner/xerox artefacts (streaks, toner, paper feed).
- Items 4-8 (reaction-diffusion, fluid, SDF solids, metaballs, droste) come from the code-side channels and suit generators, and only if not already in the 22 generators.
- Data-visual art (46 blocks / 7 channels) supports data-to-image modules, but the collected images are stills of abstracted charts, not a technique list.
- Kaleidoscope, moire, voronoi, truchet, datamosh, slit-scan, halation and domain warp appear rarely in curator text (one or two mentions each), so evidence for them as gaps is weak from this sample.

### Gaps
- No access to fxlab's module list, so no confirmed "lacks" claim.
- Counts rely on Link/Text metadata and URLs; visual content of image blocks was not analysed.
- Generative-identity and brand-system channels were listed but not read in depth.

## Top channels (machine readable)

```json
[
 {
  "title": "grain & grace",
  "url": "https://www.are.na/niko-gabrilo/grain-grace",
  "curator": "Niko Gabrilo",
  "blocks": 24571,
  "updated": "2026-09-21",
  "theme": "grain/textures"
 },
 {
  "title": "Brand Systems",
  "url": "https://www.are.na/nate-bruzdzinski/brand-systems-4s6dm2_rvcq",
  "curator": "Nate Bruzdzinski",
  "blocks": 3153,
  "updated": "2026-09-21",
  "theme": "brand systems"
 },
 {
  "title": "TEXTURES",
  "url": "https://www.are.na/andrew-chambers/textures-e1hfphu48ti",
  "curator": "Andrew Chambers",
  "blocks": 898,
  "updated": "2026-09-21",
  "theme": "textures"
 },
 {
  "title": "Generative Art and Design",
  "url": "https://www.are.na/justin-lincoln/generative-art-and-design-j3huzlmjtjq",
  "curator": "Justin Lincoln",
  "blocks": 5630,
  "updated": "2026-08-27",
  "theme": "generative art"
 },
 {
  "title": "Textures, Overlays, Scans ETC",
  "url": "https://www.are.na/a-m-u50w700oxzg/textures-overlays-scans-etc",
  "curator": "A M",
  "blocks": 217,
  "updated": "2026-09-21",
  "theme": "textures/overlays/scans"
 },
 {
  "title": "Image Treatment / Scan",
  "url": "https://www.are.na/max-spencer/image-treatment-scan",
  "curator": "Max Spencer",
  "blocks": 715,
  "updated": "2026-09-17",
  "theme": "image treatment / scan"
 },
 {
  "title": "GRADIENTS WITH NOISE",
  "url": "https://www.are.na/t-hanks/gradients-with-noise",
  "curator": "t hanks",
  "blocks": 493,
  "updated": "2026-09-14",
  "theme": "gradients + noise"
 },
 {
  "title": "image treatment",
  "url": "https://www.are.na/chloe-techoueyres/image-treatment-6sfpbx6np9y",
  "curator": "chloé techoueyres",
  "blocks": 953,
  "updated": "2026-09-19",
  "theme": "image treatment"
 },
 {
  "title": "Patterns / Dithering",
  "url": "https://www.are.na/nicolas-boillot/patterns-dithering",
  "curator": "Nicolas Boillot",
  "blocks": 1368,
  "updated": "2026-09-12",
  "theme": "dither"
 },
 {
  "title": "visual-identity.VISID",
  "url": "https://www.are.na/tony-kim/visual-identity-visid",
  "curator": "Tony Kim",
  "blocks": 1365,
  "updated": "2026-09-08",
  "theme": "identity"
 },
 {
  "title": "sickening universe visual language sensory palace",
  "url": "https://www.are.na/isa-bel-fwbkuyq7jmy/sickening-universe-visual-language-sensory-palace",
  "curator": "isa bel",
  "blocks": 990,
  "updated": "2026-09-20",
  "theme": "visual language"
 },
 {
  "title": "*•.¸¸¸.•*ASCII art*•.¸¸¸.•*",
  "url": "https://www.are.na/sofia-guidi/ascii-art-vw4uwuo6eie",
  "curator": "Sofia Guidi",
  "blocks": 300,
  "updated": "2026-09-21",
  "theme": "ascii"
 },
 {
  "title": "treatment/grain/postprod",
  "url": "https://www.are.na/ianis-coutreau/treatment-grain-postprod",
  "curator": "Ianis Coutreau",
  "blocks": 1102,
  "updated": "2026-09-19",
  "theme": "grain/post-production treatment"
 },
 {
  "title": "Visual Language",
  "url": "https://www.are.na/forrest-huu-ta/visual-language-xiuu7_gqoqk",
  "curator": "Forrest Huu Ta",
  "blocks": 1142,
  "updated": "2026-09-16",
  "theme": "visual language"
 },
 {
  "title": "resource / design tools",
  "url": "https://www.are.na/lauren-gallagher-1503862652/resource-design-tools-rvnszvag4ke",
  "curator": "Lauren Gallagher",
  "blocks": 323,
  "updated": "2026-09-15",
  "theme": "design tools"
 },
 {
  "title": "URI Print Media - Printmaking",
  "url": "https://www.are.na/travess-smalley/uri-print-media-printmaking",
  "curator": "Travess Smalley",
  "blocks": 1159,
  "updated": "2026-09-20",
  "theme": "print/photocopy"
 },
 {
  "title": "Gradients",
  "url": "https://www.are.na/are-na-commons/gradients",
  "curator": "Are.na Commons",
  "blocks": 510,
  "updated": "2026-08-31",
  "theme": "gradients"
 },
 {
  "title": "Vectorheart",
  "url": "https://www.are.na/evan-collins-1522646491/vectorheart-eqxlv27j7xo",
  "curator": "Evan Collins",
  "blocks": 362,
  "updated": "2026-09-19",
  "theme": "halftone/vector"
 },
 {
  "title": "Displacement, Tangents too",
  "url": "https://www.are.na/rithika-pandey/displacement-tangents-too",
  "curator": "Rithika Pandey",
  "blocks": 658,
  "updated": "2026-09-19",
  "theme": "displacement"
 },
 {
  "title": "Kaleidoscope",
  "url": "https://www.are.na/ashley-jones-bc00nush75g/kaleidoscope-efdunv9narc",
  "curator": "Ashley Jones",
  "blocks": 960,
  "updated": "2026-09-14",
  "theme": "kaleidoscope"
 },
 {
  "title": "Information Aesthetics",
  "url": "https://www.are.na/mitchel-cox/information-aesthetics-3vs7ysqkvss",
  "curator": "Mitchel Cox",
  "blocks": 323,
  "updated": "2026-09-15",
  "theme": "information aesthetics"
 },
 {
  "title": "Programming Images",
  "url": "https://www.are.na/travess-smalley/programming-images",
  "curator": "Travess Smalley",
  "blocks": 531,
  "updated": "2026-08-07",
  "theme": "creative code / images as programs"
 },
 {
  "title": "Glitch",
  "url": "https://www.are.na/justin-lincoln/glitch-smsvf4htlya",
  "curator": "Justin Lincoln",
  "blocks": 523,
  "updated": "2026-07-08",
  "theme": "glitch"
 },
 {
  "title": "Dither",
  "url": "https://www.are.na/sam-dal-monte/dither-slapq2wekr8",
  "curator": "Sam Dal Monte",
  "blocks": 280,
  "updated": "2026-09-16",
  "theme": "dither"
 },
 {
  "title": "Shaders/Generative Resources",
  "url": "https://www.are.na/swiftp-luc-p/shaders-generative-resources",
  "curator": "swiftp (luc p)",
  "blocks": 265,
  "updated": "2026-09-08",
  "theme": "shaders"
 },
 {
  "title": "Shaders",
  "url": "https://www.are.na/oren-shoham/shaders-1515139374",
  "curator": "Oren Shoham",
  "blocks": 255,
  "updated": "2026-08-13",
  "theme": "shaders"
 },
 {
  "title": "Processing, p5.js & WebGL",
  "url": "https://www.are.na/chris-butts/processing-p5-js-webgl",
  "curator": "chris butts",
  "blocks": 157,
  "updated": "2026-09-01",
  "theme": "p5/webgl"
 },
 {
  "title": "⊞ Systems: Motion",
  "url": "https://www.are.na/theo-marielle/systems-motion",
  "curator": "Théo Marielle",
  "blocks": 148,
  "updated": "2026-09-19",
  "theme": "motion identity"
 },
 {
  "title": "Risograph",
  "url": "https://www.are.na/omar-careaga/risograph-vxdnx8ixnsg",
  "curator": "Omar Careaga",
  "blocks": 180,
  "updated": "2026-09-12",
  "theme": "risograph"
 },
 {
  "title": "Effects / Dithering + Halftone",
  "url": "https://www.are.na/josh-pindjak/effects-dithering-halftone",
  "curator": "Josh Pindjak",
  "blocks": 68,
  "updated": "2026-09-15",
  "theme": "dither+halftone effects"
 },
 {
  "title": "Data Visualisation as Abstract Art",
  "url": "https://www.are.na/oscar-thomas/data-visualisation-as-abstract-art",
  "curator": "Oscar Thomas",
  "blocks": 138,
  "updated": "2026-09-19",
  "theme": "data viz art"
 },
 {
  "title": "Analogue Glitch",
  "url": "https://www.are.na/dan-b-ugieh3e4gxs/analogue-glitch",
  "curator": "dan B",
  "blocks": 146,
  "updated": "2026-09-20",
  "theme": "glitch"
 },
 {
  "title": "80/90s VHS/Audio Blank Tapes",
  "url": "https://www.are.na/masala-noir/80-90s-vhs-audio-blank-tapes",
  "curator": "Masala Noir",
  "blocks": 87,
  "updated": "2026-09-21",
  "theme": "vhs"
 },
 {
  "title": "Image treatments",
  "url": "https://www.are.na/ryan-wooding/image-treatments-1zoacn3pwc0",
  "curator": "Ryan Wooding",
  "blocks": 129,
  "updated": "2026-09-16",
  "theme": "image treatment"
 },
 {
  "title": "design tools ✶✶ resources",
  "url": "https://www.are.na/claudia-nathan/design-tools-resources-dnwab_8u0gw",
  "curator": "Claudia Nathan",
  "blocks": 338,
  "updated": "2026-09-19",
  "theme": "design tools"
 },
 {
  "title": "Identity_motion",
  "url": "https://www.are.na/tong-li/identity_motion",
  "curator": "Tong Li",
  "blocks": 200,
  "updated": "2026-09-07",
  "theme": "motion identity"
 }
]
```
