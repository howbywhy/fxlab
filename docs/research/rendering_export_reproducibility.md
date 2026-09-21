# Rendering, export and reproducibility for a browser WebGL2/Canvas creative tool

Research date: September 2026. About 15 tool calls; several sub-topics were not reached and are listed under Gaps. Items marked "training knowledge" in Inferences are not URL-verified.

## 1. Video/animation export in the browser

### Takeaway
WebCodecs `VideoEncoder` plus a JS muxer (mediabunny, successor-style library covering MP4/WebM/MOV/MKV etc.) is the deterministic, frame-accurate route. `MediaRecorder` is real-time and produces WebM without duration or seek cues, so it is unsuitable for exact output. H.264 in MP4 is the safe delivery codec for social platforms; alpha video is only practical as VP9 WebM (Chrome/Firefox) or HEVC-alpha (Safari).

### Cited Findings
- Mediabunny is a TypeScript, dependency-free library for reading, writing and converting media in the browser; it handles MP4, MOV, WebM, MKV, MP3, WAV, OGG, FLAC, TS and others, and uses WebCodecs for hardware-accelerated encode/decode. It includes audio resampling and up/downmixing. — [Mediabunny intro](https://mediabunny.dev/guide/introduction)
- `VideoEncoder.configure()` has `alpha: "discard" (default) | "keep"`, `latencyMode: "quality" | "realtime"` (realtime may drop frames), `bitrateMode: constant | variable | quantizer`, `hardwareAcceleration` hint, and `scalabilityMode`. Default `alpha` discards transparency, so it must be set explicitly. — [MDN VideoEncoder.configure](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/configure)
- Codec strings must be fully specified (e.g. `avc1.4d0034`, `vp09.00.40.08.00`). Field data from 1.1M+ sessions in 2026 says H.264 and VP9 are effectively universal for WebCodecs encoding, while AV1/HEVC encode are not; the source recommends AVC or VP9 as the encoding safety net. — [WebCodecs Fundamentals 2026 dataset](https://webcodecsfundamentals.org/datasets/codec-analysis-2026/); [MDN codec selection](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection)
- MediaRecorder WebM from Chrome is written as a live stream: no Duration element, no Cues, so `duration` reads `Infinity` and seeking must decode from the start. Frames are delivered in real time and dropped if encoding lags, giving inconsistent frame rates. Remuxing fixes metadata only, not timing. — [Remotion: fixing a MediaRecorder video](https://www.remotion.dev/docs/webcodecs/fix-mediarecorder-video); [Mozilla bug 1385699](https://bugzilla.mozilla.org/show_bug.cgi?id=1385699); [w3c/mediacapture-record #177](https://github.com/w3c/mediacapture-record/issues/177)
- Alpha video: Chrome plays VP8/VP9 WebM with alpha; the pixel format must include alpha (`yuva420p`) or transparency is dropped. Safari does not render WebM alpha (shows black) and needs HEVC-with-alpha in MP4/MOV. — [Chrome for Developers: alpha transparency in video](https://developer.chrome.com/blog/alpha-transparency-in-chrome-video); [SuperGeekery summary](https://supergeekery.com/blog/transparent-video-in-chrome-edge-firefox-and-safari-circa-2022) (secondary, 2022/2024)
- YouTube recommended upload: MP4, moov atom at front, no edit lists; H.264 High profile, 2 consecutive B-frames, closed GOP, CABAC; GOP of half the frame rate; AAC-LC (or Opus) at 48 kHz; BT.709 tags for transfer, primaries and matrix. SDR bitrates at 24-30 fps: 1080p 8 Mbps, 1440p 16, 4K 35-45; at 48-60 fps: 1080p 12, 4K 53-68. Stereo audio 384 kbps. — [YouTube Help](https://support.google.com/youtube/answer/1722171)
- Social specs (secondary/aggregator sources, not platform-primary): H.264 MP4 is the common denominator; Reels/TikTok 1080x1920 (9:16); 30 fps safest; 10-15 Mbps for 1080p30 quoted; Reels roughly 14% (about 250 px) top and bottom padding; TikTok avoid bottom ~20% for UI. Both platforms re-encode on upload. — [Project Aeon](https://project-aeon.com/blogs/social-media-video-specs-essential-guide-for-2025); [The Post Flow](https://thepostflow.com/post-production/post-production-workflows/export-settings-youtube-instagram-tiktok/); [Koro Reels dimensions](https://getkoro.app/blog/instagram-reels-dimensions)

### Inferences
- Deterministic export loop: for frame i, set `t = i / fps` (never `performance.now()`), render, `new VideoFrame(canvas, {timestamp: i*1e6/fps})`, `encoder.encode(frame, {keyFrame: i % gop === 0})`, `frame.close()`; back-pressure on `encodeQueueSize`. This is the recommended pattern from general WebCodecs practice (training knowledge; the MDN page fetched did not document the `keyFrame` option).
- For looping stickers/social clips, keyframe interval of about 1-2 s and fast-start MP4 (mediabunny writes this by default in fast-start mode, unverified) matches YouTube guidance.
- Chrome-only VP9 alpha plus Safari HEVC-alpha implies offering "transparent video" as an explicit, caveated option, with PNG sequence as the universal alpha route.
- Odd dimensions are rejected by H.264 encoders (must be even, often multiples of 2/16); crop or pad (training knowledge).
- Audio, if ever added, is best encoded with WebCodecs `AudioEncoder` (AAC or Opus) and muxed by mediabunny; offline rendering via `OfflineAudioContext` keeps it deterministic (training knowledge).

### Gaps
- ffmpeg.wasm size/threading (SharedArrayBuffer/COOP-COEP) and licence status: not researched.
- GIF/APNG/animated WebP/AVIF encoders and their palette/alpha limits: not researched.
- ProRes 4444 in browser: no evidence found; WebCodecs has no ProRes encoder to my knowledge (unverified). ProRes would need server-side or ffmpeg.wasm.
- Primary TikTok, Instagram and LinkedIn spec pages not fetched; only aggregators.
- Whether mediabunny's canvas-source API and fast-start behaviour: only intro page read.
- ZIP streaming for PNG sequences (e.g. fflate/zip.js, File System Access API): not researched.

## 2. Still export and print

### Takeaway
The browser gives sRGB (or Display P3) 8-bit RGB PNG/JPEG/WebP; CMYK, ICC-embedded output, PDF/X and true spot separations are outside canvas capabilities and need a purpose-built pipeline. Large output is done by tiling; 4096 is the only texture-size guarantee on many mobile devices.

### Cited Findings
- WebGL minimums: `MAX_TEXTURE_SIZE` and `MAX_RENDERBUFFER_SIZE` guaranteed only at 4096; Safari on iPhone has hit 4096 limits in the wild; a 2020 statistic said 99% of devices support 4096 but about 50% more. iOS Safari enforces a WebGL heap of roughly 300-500 MB; total page memory 2-3 GB. Reported limits can still crash if fully used. — [WebGL Fundamentals cross-platform issues](https://webglfundamentals.org/webgl/lessons/webgl-cross-platform-issues.html); [face-api.js issue 204](https://github.com/justadudewhohacks/face-api.js/issues/204); [Wonderland Engine on Safari WebGL](https://wonderlandengine.com/news/webgl-performance-safari-apple-vision-pro/) (mixed-quality, older sources)
- Canvas stores premultiplied alpha; `getImageData` round-trips quantise RGB where alpha is low (alpha 2 leaves only 0/128/255 levels). PNG stores straight alpha. Prefer `canvas.toBlob()` directly over manual readback plus custom encoder; some video software wrongly treats PNG as premultiplied. — [dev.to: getImageData premultiplied alpha](https://dev.to/yoya/canvas-getimagedata-premultiplied-alpha-150b); [webgl-dev-list thread](https://groups.google.com/g/webgl-dev-list/c/-Fnsi15Mzug)
- Canvas 2D supports `colorType: "float16"` (default `unorm8`) and `colorSpace` `srgb`/`display-p3`. — [MDN getContext](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext) (the "widely available" baseline label covers getContext generally; MDN itself notes the newer options have more limited support)
- JPEG XL: Chrome 145 (Feb 2026) and Firefox 152 (June 2026) contain a decoder but behind flags/prefs, per secondary sources; Safari has shipped it since 2023. Expected Chrome default-on in H2 2026 is a prediction, not confirmed. — [Core Web Vitals: JXL](https://www.corewebvitals.io/pagespeed/jpeg-xl-core-web-vitals-support); [The Image CDN](https://theimagecdn.com/docs/jpeg-xl-explained) (secondary sources; conflicting figures on share)

### Inferences
- Print flow that fits a single-file tool (training knowledge, not verified this session): render tiles (e.g. 2048x2048 with overlap only if effects sample neighbours, hence `nonLocal` handling), stitch into a strip-based PNG encoder or PDF writer, and embed pixel density (`pHYs` chunk) for DPI. Bleed is added by extending the render area, not by scaling.
- 8-bit banding in gradients is best countered by adding blue-noise/triangular dither (about 1 LSB) in the final shader pass and rendering intermediates in `RGBA16F`; canvas 2D `float16` helps only on the canvas side. Export 16-bit PNG would need a custom encoder from float readback (`readPixels` to `Uint16Array`/`Float32Array`, then encode with e.g. UPNG/fflate) — canvas `toBlob` is always 8-bit.
- CMYK: no browser API. Honest approach is RGB deliverable plus ink separations as grayscale/1-bit plates (which fxlab already offers), with the caveat that colour conversion and profile handling occur in the print shop's RIP/Acrobat/Photoshop. PDF/X and ICC embedding would require a PDF writer that can embed an OutputIntent.

### Gaps
- No sources fetched on PDF/X, ICC embedding in PNG/JPEG from browsers, spot colour/DeviceN in PDF, bleed/trim conventions, or WebP/AVIF encoder quality via `toBlob` (browser support for `image/avif` encoding is not confirmed here).
- Real-world `MAX_TEXTURE_SIZE` distribution for 2026 devices not found.

## 3. Colour management on the web

### Takeaway
Canvas can be created in Display P3 and float16, and HDR output is emerging (Chrome), but deliverables should default to sRGB with explicit conversion; wide-gamut preview vs sRGB output needs a gamut warning or conversion step.

### Cited Findings
- Canvas 2D `getContext('2d', {colorSpace:'display-p3', colorType:'float16'})` is supported by the spec/MDN. — [MDN getContext](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext)
- HDR canvas (Chromium proposals/explainers): WebGL `drawingBufferStorage(RGBA16F,…)`, `drawingBufferColorSpace`, and `drawingBufferToneMapping({mode:'extended'})`; Canvas 2D `configureHighDynamicRange({mode:'extended'})` with `rec2100-hlg`. WebGPU shipped an `extended` tone-mapping mode in canvas configuration (Chrome 129 era). Treat WebGL/2D HDR API names as explainer-stage, not settled. — [webgl-hdr explainer](https://github.com/ccameron-chromium/webgl-hdr/blob/master/EXPLAINER.md); [webgpu-hdr explainer](https://github.com/ccameron-chromium/webgpu-hdr/blob/main/EXPLAINER.md); [Chrome 129 WebGPU](https://developer.chrome.com/blog/new-in-webgpu-129)
- YouTube expects BT.709 tags for SDR uploads. — [YouTube Help](https://support.google.com/youtube/answer/1722171)
- W3C DTCG 2025.10 colour tokens support Display P3, Oklch and CSS Color 4 spaces via `colorSpace`, `components`, optional `alpha` and `hex` fallback. — [DTCG format](https://www.designtokens.org/tr/drafts/format/)

### Inferences
- Linear-light blending: do blends/blur/glow in linear (`RGBA16F` or sRGB-decode on sample with `SRGB8_ALPHA8`) and encode on the last pass; mixing in gamma space is the usual source of dark fringes (training knowledge). Whichever choice fxlab makes should be documented per module because it changes pixels.
- Tag exported video as BT.709 (VideoEncoder `colorSpace` in config/VideoFrame) to avoid platform colour shifts; a P3 canvas exported without conversion to an sRGB-tagged file would look oversaturated.
- Previewing on a P3 monitor while the canvas is sRGB is fine (browser converts); previewing P3 content and exporting sRGB needs clipping/gamut-mapping awareness.

### Gaps
- Browser support matrix for canvas `colorSpace`/`float16` and WebGL `drawingBufferColorSpace` (Safari/Firefox) not verified.
- OpenColorIO (OCIO/OCIO config, ACES) not researched.

## 4. Determinism and reproducibility

### Takeaway
Same recipe gives same pixels only within a device/driver class. Use integer hash noise and a seeded PRNG, fixed timestep, and resolution-independent parameters; test with per-platform baselines and tolerance-based comparison.

### Cited Findings
- Trig, pow, sqrt and similar results can differ between CPU and GPU and between GPUs; texture filtering precision is hardware-specific and produced visible differences across phones; `highp` is mandated in fragment shaders in GLSL ES 3.0 (WebGL2) but `mediump` behaves differently and iOS float textures need `highp sampler2D`. — [WebGL Fundamentals: precision issues](https://webglfundamentals.org/webgl/lessons/webgl-precision-issues.html); [Half-float filtering on mobile GPUs](https://keaukraine.medium.com/filtering-of-half-float-textures-on-different-mobile-gpus-6be3c277f55e); [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
- Playwright `toHaveScreenshot()` captures until two consecutive frames match, names baselines by browser and OS, offers `maxDiffPixels` (and threshold options), a `stylePath` to hide dynamic elements, and warns baselines must be produced in the environment they are compared in. — [Playwright snapshots](https://playwright.dev/docs/test-snapshots)
- Google's Chrome canvas 2D text/AA rendering is OS-dependent (implied by the Playwright OS-specific baselines note above).

### Inferences
- "Same recipe, same pixels" guarantee, practical version: (1) all randomness from a hash of (seed, integer coords/frame) using integer ops (`uint` in GLSL ES 3.00), avoiding `fract(sin(dot))` hashes, which are precision-sensitive; (2) no wall-clock; time `t` derived from frame index; (3) noise domain coordinates in normalised units of output height/width, not pixels, so preview and export agree (resolution independence); avoid pixel-size-dependent kernel counts or scale kernel radii and sample counts with output size; (4) fix loop `dur` and frame count to whole cycles; (5) record recipe version, seed and build hash in project JSON. Guarantee bit-exactness only per GPU/driver; otherwise promise "visually identical within tolerance".
- Regression testing: golden images per platform, compared with pixelmatch or SSIM with a tolerance, plus tile-vs-whole-frame comparisons (fxlab already has `tiles`/`seams` tests). Perceptual hash is useful for coarse "same look" checks across GPUs. (pixelmatch/SSIM/pHash docs not fetched; training knowledge.)
- Software rasterisation (SwiftShader/`--use-angle=swiftshader`) in headless CI gives stable baselines but will differ from real GPUs (training knowledge).

### Gaps
- No verified source on pixelmatch parameters, SSIM libraries or perceptual hashing.
- No measured cross-GPU pixel-difference magnitudes.

## 5. Portable look formats

### Takeaway
A shader chain can only be baked into a 3D LUT if it is a pure per-pixel colour transform; anything spatial, temporal or textural cannot. For everything else, export a versioned JSON recipe, and map palette/motion to DTCG tokens (Figma variables can hold colours and numbers but not durations/easings).

### Cited Findings
- LUT baking: colour-only operations (curves, wheels, lift/gamma/gain, HSL, colour-space transforms) bake accurately; spatial (blur, sharpen), temporal (denoise, motion blur) and texture-adding effects (grain, flares) cannot. 33-point cubes lose accuracy versus formulas; tetrahedral interpolation helps; 65-point is more precise; common sizes are 17, 33, 64/65. — [Nobe LutBake](https://timeinpixels.com/nobe-lutbake/); [Blackmagic forum](https://forum.blackmagicdesign.com/viewtopic.php?f=21&t=216677); [Frame.io LUTs 101](https://blog.frame.io/2019/08/12/luts-101/)
- Adobe `.cube` specification PDF (Kodi wiki mirror) returned 403; not read. — [link](https://kodi.wiki/images/e/ea/Adobe-Cube-LUT-Specification.pdf)
- DTCG Format Module 2025.10 is the first stable version (announced 28 Oct 2025); backed by 24+ organisations incl. Adobe, Google, Microsoft, Figma; reference implementations in Style Dictionary, Tokens Studio, Terrazzo. — [DTCG announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)
- DTCG types include color, dimension, duration (ms/s), cubicBezier, number, fontFamily, fontWeight, transition, shadow, gradient, typography; `$value`, `$type`, `$description`, `$extensions` (reverse-domain keys), `$deprecated`, `$extends`; aliases via `{group.token}` and JSON Pointer `$ref`; circular references are errors. — [DTCG format](https://www.designtokens.org/tr/drafts/format/)
- Figma variables are Color, Number, String, Boolean with modes; DTCG import/export exists via plugins; Tokens Studio does not support duration/cubicBezier because Figma has no animation variables. — [Atomize: Figma tokens guide](https://atomize.tools/blog/figma-design-tokens-guide/); [Figma DTCG plugin](https://www.figma.com/community/plugin/1602387835479491374/dtcg-design-token-manager) (secondary/community)
- WebGPU: Chrome/Edge since April 2023, Firefox 141 (Windows, July 2025; macOS Apple Silicon at 145), Safari 26 (Sept 2025). — [web.dev](https://web.dev/blog/webgpu-supported-major-browsers); [gpuweb implementation status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)

### Inferences
- Bakeable subset in fxlab: per-pixel colour modules (grades, duotone, palette maps, curves) with no neighbour sampling, noise, time or resolution dependence. Bake by rendering an identity 3D lattice (33³ or 65³) through the chain and writing `.cube` (red fastest, per Adobe convention, training knowledge, unverified here). Show a warning listing non-bakeable layers. Provide a 1D shaper for HDR/log if needed. Also export `.cube` for both input-referred sRGB and a "Rec.709" tagged variant.
- Ordering caveat: LUT is only exact if the chain's colour ops are order-only-relative-to-other-per-pixel-ops; a spatial effect before a colour grade makes the grade bakeable only if the LUT is applied after those effects.
- CSS/SVG filter approximations: `feColorMatrix`, `feComponentTransfer`, `feTurbulence` cover a small subset; treat as best-effort export, not exact (training knowledge).
- GLSL export: ship the module `fs` plus prelude helpers as a self-contained snippet; WGSL needs translation (e.g. tint/naga) since GLSL ES to WGSL is not 1:1 (training knowledge). WebGPU migration is feasible now given browser support but changes canvas colour and readback semantics.
- Project schema: include `schemaVersion`, module ids with per-module version, seed, canvas size, and a `migrations[]` table; unknown ids kept but skipped, matching fxlab's existing policy.
- Motion tokens: DTCG `duration` and `cubicBezier` can carry brand motion; Figma cannot consume them, so round-trip via DTCG JSON rather than Figma variables.

### Gaps
- Lottie limits (no shaders, no custom blend/effects beyond built-ins), OpenColorIO, ACES: not researched.
- Adobe `.cube` spec details not read (403); DaVinci/Premiere/Resolve import quirks unverified.
- `$extensions` conventions for colour-space beyond CSS Color 4 not checked.

## 6. Performance

### Takeaway
Mobile GPUs impose tight limits (texture size, WebGL heap), so scale preview quality separately from export resolution and avoid full-precision paths on low-end devices.

### Cited Findings
- Guaranteed 4096 limits, 300-500 MB WebGL heap on iOS, and `mediump` speed versus `highp` support (see sections 2 and 4). — sources as above.
- `willReadFrequently: true` on canvas 2D forces software rendering (saves memory for repeated `getImageData`); `desynchronized` reduces latency. — [MDN getContext](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext)
- MDN's WebGL best practices page covers use of precision, avoiding sync stalls and readback; not individually extracted. — [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)

### Inferences
- Use `KHR_parallel_shader_compile` to compile programs without blocking, compile lazily per module and cache programs by source hash; ping-pong two framebuffers and only allocate more for feedback modules; drop preview scale (0.5x-0.75x) during interaction and re-render full-quality on idle (training knowledge; not checked against docs this session).
- Never call `readPixels` per frame during preview; use it only on export (async via PBO/`fenceSync` if needed).

### Gaps
- No sourced benchmarks for shader-compile caching, `KHR_parallel_shader_compile` support table, or preview scaling heuristics.
