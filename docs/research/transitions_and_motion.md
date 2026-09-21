# Transitions and motion-identity grammar (image/video transitions, motion systems, WebGL2 implementation)

Scope note: research was capped at ~16 tool calls. Coverage is strong on gl-transitions internals and Material/Carbon tokens, thin on editor-suite inventories (AE/Premiere/DaVinci/CapCut/Jitter), Lottie/Rive parameter sets, studio "motion signature" write-ups and audio sync. Those are flagged under Gaps. Items marked "Inference" are mine, not sourced.

## 1. Fundamental transition families: what is timeless, what is trend-driven, what is used professionally

### Takeaway
Editorial grammar is small and old: cut, dissolve/fade, wipe, match cut, whip pan, smash cut. Editors treat most other effects as signalling devices to be used sparingly. gl-transitions supplies a much larger shader inventory (~106+ entries) that maps onto the same families plus many "effect-y" ones (kaleidoscope, heart, star wipe, cannabis leaf) that are gallery clutter for brand work (inference).

### Cited Findings
- Editorial families named in a mainstream guide: cuts, dissolves/cross dissolves (passage of time, overlap of scenes), wipes ("draws attention to itself", dated but usable creatively), match cuts (link shots by shape, motion or framing), whip pan (blur streaks; flashback, location change, fast pace), smash cut (abrupt jump between very different scenes, for comedy/shock/irony). Principle: the best transition helps the viewer follow without noticing the edit. — [StudioBinder / TechSmith / Wedio results](https://www.studiobinder.com/blog/types-of-editing-transitions-in-film/), [TechSmith](https://www.techsmith.com/blog/ways-to-use-video-transitions/) (via search summary; individual pages not fetched)
- Murch's Rule of Six ranks what makes a good cut: emotion, story, rhythm, eye trace, 2D plane of the frame, 3D space of the action. Emotion is at the top, spatial continuity at the bottom; you sacrifice from the bottom up. Rhythm is "the music of the cut". — [StudioBinder](https://www.studiobinder.com/blog/walter-murch-rule-of-six/), [Go Into The Story](https://gointothestory.blcklst.com/walter-murch-and-the-rule-of-six-cc76785edc24/)
- gl-transitions file listing (first 106 of a truncated GitHub API response) shows these clusters: directional wipes/slides (Directional, directionalwipe, LeftRight, TopBottom, Slides, splitSlideIn*, HorizontalOpen/Close, VerticalOpen/Close, doorway, Fold, Rolls), zoom/blur (CrossZoom, DreamyZoom, SimpleZoom, ZoomLeftWipe, DefocusBlur, LinearBlur), shape reveals (circle, circleopen, CircleCrop, Rectangle, RectangleCrop, Box, StarWipe, heart, BowTie*, pinwheel, Radial, angular), tiles/grids/strips (GridFlip, chessboard, mosaic, Mosaic, hexagonalize, randomsquares, BlockDissolve, TilesWave, PuzzleRight, crosshatch, flyeye), flips/3D (SimpleFlip, BookFlip, cube, InvertedPageCurl, StereoViewer, Revolve_Left, rotateTransition), displacement/warp (displacement, crosswarp, directionalwarp, ripple, WaterDrop, Swirl, morph, perlin), luma/matte (luma, luminance_melt, ColourDistance), pixelate (pixelize, mosaic_transition), glitch/signal (GlitchDisplace, GlitchMemories, StripDatamoshGlitch, TVStatic, old_tv_lost_signal, parametric_glitch, StaticFade, Drop_Zone_Flicker, DoomScreenTransition), light/exposure (FilmBurn, Overexposure, burn, dreamy), colour fades (fade, fadecolor, fadegrayscale, HSVfade, multiply_blend). — [GitHub API listing of gl-transitions/transitions](https://api.github.com/repos/gl-transitions/gl-transitions/contents/transitions)
- Brand/identity work leans on a signature behaviour rather than a transition catalogue: DIA's Pinterest identity centred on a signature motion behaviour ("Pinterest Push") with toolkits so teams can apply it across assets. — [The Brand Identity](https://the-brandidentity.com/project/6-identities-driven-by-motion-featuring-projects-by-landor-fitch-iya-studio-dia-and-more)

### Inferences
- Timeless (editorial, low-risk): cut, cross dissolve, dip to colour, directional push/slide, wipe with soft edge, mask/shape reveal, zoom/scale-through, whip pan (blur push), match cut (needs content alignment, cannot be a pure shader), flash/exposure.
- Trend-driven or gallery-clutter: kaleidoscope, star/heart/cannabis-leaf shapes, cube, page curl, glitch/datamosh, TV static, polka dots, swirl. Glitch and light-leak cycle in and out of fashion; page curl and cube read as 2000s presentation software.
- A workable taxonomy for a library by mechanism (what parameters are shared): (1) mix (dissolve, dip, exposure); (2) geometric matte (wipe, split, iris/shape, radial, strips, tiles); (3) transform (push, slide, zoom, rotate, flip, whip); (4) field-driven matte (luma, noise, displacement, melt); (5) resample/distort (pixelate, ripple, warp, glitch). Mechanism grouping gives consistent parameters (direction, softness, seed, count) better than look-based naming.

### Gaps
- No sourced evidence of which transitions are actually used in professional brand motion versus template galleries; the judgement above is inference. Editor-community surveys or studio breakdowns were not found in this pass.
- Match cut and whip pan need editorial/content alignment; no source examined on how to approximate them procedurally.

## 2. Inventories and parameter sets: gl-transitions, Shadertoy, editors, CapCut, Jitter, Rive, Lottie

### Takeaway
gl-transitions has a minimal contract (from, to, progress, ratio, plus commented-default uniforms) and most parameters are just `softness`/`direction`/`strength`/count. Everything is normalised to progress 0..1 with no built-in easing.

### Cited Findings
- Contract: `progress` (0..1), `ratio` (width/height), `getFromColor(uv)`, `getToColor(uv)`; custom parameters are uniforms with defaults in trailing comments (`uniform float foo; // = 42.0`) because GLSL 1.20 lacks initialisers; "any constant you define" is a candidate parameter. — [gl-transitions README](https://github.com/gl-transitions/gl-transitions)
- `directionalwarp`: `smoothness = 0.1`, `direction = vec2(-1,1)`; direction normalised, edge width by smoothstep, and both images are warped by the mask (`uv-0.5)*(1-m)+0.5`) so the seam bulges rather than just cutting. — [directionalwarp.glsl](https://raw.githubusercontent.com/gl-transitions/gl-transitions/master/transitions/directionalwarp.glsl)
- `displacement`: takes `sampler2D displacementMap` and `strength = 0.5`; from-UV shifts by `progress*d`, to-UV by `-(1-progress)*d`, then a crossfade. Adapted from a Codrops distortion hover effect. — [displacement.glsl](https://raw.githubusercontent.com/gl-transitions/gl-transitions/master/transitions/displacement.glsl)
- `luma`: `sampler2D luma`; `mix(to, from, step(progress, luma.r))`, a hard-edged luma-matte wipe with no softness. — [luma.glsl](https://raw.githubusercontent.com/gl-transitions/gl-transitions/master/transitions/luma.glsl)
- `luminance_melt`: uniforms `direction (true)`, `l_threshold (0.8)`, `above (false)`; matte is content-driven by luminance of the outgoing frame, with simplex noise along x and per-column `rand` for drip raggedness. — [luminance_melt.glsl](https://raw.githubusercontent.com/gl-transitions/gl-transitions/master/transitions/luminance_melt.glsl)
- `CrossZoom`: `strength = 0.4`; internally applies its own easing (exponential in-out to the dissolve, sinusoidal to blur strength), 40 blur samples jittered by `rand(uv)` (per-pixel offset trades banding for grain), weighted `4(p-p²)`. — [CrossZoom.glsl](https://raw.githubusercontent.com/gl-transitions/gl-transitions/master/transitions/CrossZoom.glsl)
- Rive: state-machine transitions with blend durations (e.g. 200ms), cubic-bezier easing and spring physics in the graph editor; Lottie is passive keyframe playback, logic lives in code. — [Rive vs Lottie summaries via search](https://www.rivemasterclass.com/blog/rive-vs-lottie), [LottieFiles blog](https://lottiefiles.com/blog/design-guides-and-tips/best-motion-design-tools-ranked-by-use-case)

### Inferences
- Parameters that recur across the gl-transitions files read: smoothness/edge feather, direction (vec2 or bool), strength/amount, count (grid size, bars), seed (via `rand`), one texture (matte/displacement). Those are the ones worth exposing uniformly; "angle" is a cleaner designer-facing form of direction.
- Easing is deliberately excluded from the shader contract (except CrossZoom's internal shaping), so a host should apply easing to progress once, outside the shader.
- Per-pixel jitter in multi-sample blurs (CrossZoom) is a reusable technique, but it is noise-dependent and must be seeded deterministically for export.

### Gaps
- Not fetched: After Effects, Premiere, DaVinci Resolve, Final Cut, CapCut, Jitter transition lists and their parameters (duration, alignment, direction, feather, border, reverse). No claims made.
- Shadertoy specifics not examined.
- Lottie has no transition concept per se; no source on how it handles scene transitions.
- gl-transitions listing was truncated at 106; the gallery total is not confirmed.

## 3. Motion principles for identity systems: easing, tempo, holds, stagger, looping, tokens, signatures

### Takeaway
Design systems encode motion as a small set of durations plus a few named cubic-beziers with a purpose (standard, enter/decelerate, exit/accelerate, emphasised/expressive). Identity work adds a signature behaviour and a physics/character rule.

### Cited Findings
- Material 3 emphasised easing `cubic-bezier(0.2, 0, 0, 1)`; emphasised-decelerate `(0.05, 0.7, 0.1, 1)`; emphasised-accelerate `(0.3, 0, 0.8, 0.15)`. Durations summarised as 150 / 300 / 600 ms (fast/medium/slow); transitions 300-700 ms with emphasised easing, component animations 100-300 ms, state layers 50-150 ms. — [search summary of m3.material.io](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs); note the direct page fetch failed, and these numbers came through a third-party-influenced search summary, so verify against the page. Material 3 lists additional duration tokens (short1..extra-long4) I did not confirm.
- Carbon: standard easing `cubic-bezier(0.2, 0, 0.38, 0.9)`; two modes, productive (much faster) and expressive; `@carbon/motion` provides standard/entrance/exit curves per mode; six static duration tokens exist, `duration-fast-01` reportedly 70 ms. — [Carbon motion](https://carbondesignsystem.com/elements/motion/overview/), [@carbon/motion](https://github.com/carbon-design-system/carbon/tree/main/packages/motion) (values via search summary; not confirmed on page)
- Apple: springs parameterised by `response` and `dampingFraction`; springs preserve velocity when successive animations hit the same property, which is what makes them interruptible. Example `.spring(response: 0.35, dampingFraction: 0.85)` ≈ duration 0.35, bounce 0.15. — [Apple SwiftUI docs](https://developer.apple.com/documentation/swiftui/animation/spring(response:dampingfraction:blendduration:)), [Apple HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- A brand motion system = principles for speed, rhythm, easing, transitions, style; easing/duration/core dynamics combine into "choreography"; documenting timing, easing and behavioural patterns expresses emotional tone. Studios ship toolkits so behaviour transfers across assets. — [Three Rooms](https://www.threerooms.com/blog/the-rise-of-motion-in-brand-design-why-dynamic-branding-now-defines-modern-identity), [Dawn Creative](https://www.dawncreative.co.uk/insight/building-a-motion-identity/), [International brand motion principles](https://brand.international.com/visual-identity/supporting-elements/motion-principles), [The Brand Identity](https://the-brandidentity.com/project/6-identities-driven-by-motion-featuring-projects-by-landor-fitch-iya-studio-dia-and-more)
- Murch: rhythm and emotion are tightly linked; frantic pace for confusion, slower for peace. — [StudioBinder](https://www.studiobinder.com/blog/walter-murch-rule-of-six/)

### Inferences
- Emotional character of curves (my synthesis, from the token shapes above): strong ease-out/decelerate (Material emphasised-decelerate) reads confident and responsive; symmetric ease-in-out reads calm, editorial; overshoot/back and elastic read playful, and should be capped in transitions since they show as a seam moving backwards; expo in-out reads cinematic and premium.
- A "motion signature" can be encoded as: one duration scale (3-4 values), one hero easing, one accent easing (overshoot or spring), a beat length (BPM/frames), a stagger rule (fixed offset or fraction of duration), and one behaviour verb (push, drop, snap, drift). This mirrors the tokens in Material/Carbon plus DIA's "behaviour" idea.
- Holds matter as much as movement: fast moves with long rests read as confident; constant motion reads as generic. Not sourced.
- Seamless loops require animation over whole cycles (integer multiples) of the loop period; not sourced, standard practice.

### Gaps
- No primary source found for anticipation/follow-through in brand systems (Disney principles) in this pass.
- No confirmed full token tables for Material/Carbon/Apple; no source on IBM/Apple stagger conventions.
- No specific studio "motion signature" write-up with numeric parameters (only qualitative descriptions).

## 4. Making transitions art-directable rather than generic

### Takeaway
The gl-transitions code shows the levers: content-coupled mattes (luminance of the outgoing frame), texture-driven mattes (luma, displacement maps), per-pixel or per-cell randomness with seed, and softness-controlled edges that also warp the image.

### Cited Findings
- Content coupling: `luminance_melt` gates the reveal on outgoing-frame luminance with a threshold and above/below flag. — [luminance_melt.glsl](https://raw.githubusercontent.com/gl-transitions/gl-transitions/master/transitions/luminance_melt.glsl)
- Texture-driven: `luma` and `displacement` accept an arbitrary map, so a designer's texture (grain, halftone, brush, gradient) defines the edge. — [luma.glsl](https://raw.githubusercontent.com/gl-transitions/gl-transitions/master/transitions/luma.glsl), [displacement.glsl](https://raw.githubusercontent.com/gl-transitions/gl-transitions/master/transitions/displacement.glsl)
- Edge behaviour coupled to image: `directionalwarp` scales UVs by the matte so the seam has physical push. — [directionalwarp.glsl](https://raw.githubusercontent.com/gl-transitions/gl-transitions/master/transitions/directionalwarp.glsl)
- Match cut is described as linking shots through shape, motion or framing; it is content-dependent. — [StudioBinder / Wedio via search](https://www.studiobinder.com/blog/types-of-editing-transitions-in-film/)

### Inferences
- A general design: one matte field `m(uv)` in 0..1 (from geometry, noise, luma of A or B, edge detection, or an uploaded texture) combined with a threshold `progress`, a softness width, and an optional edge treatment (grain-dithered, halftone-thresholded, coloured border). This reduces most wipes/reveals/melts to "matte source × edge style × motion of the threshold". Note `luma.glsl`'s `step()` gives a hard edge and `smoothstep(p-s, p+s, m)` with progress remapped to `p*(1+2s)-s` guarantees full coverage at both ends (gl-transitions' directionalwarp uses the analogous `(1+smoothness)` scaling).
- Halftone/grain edges: threshold the matte against a Bayer/blue-noise or halftone dot pattern instead of smoothstep, to get printed-looking reveals. Physical behaviours (drip/melt, drop, ripple) come from advecting UVs by the matte gradient.
- Choosing mattes by relationship to content (luma of A vs B, edges, dominant colour distance as in `ColourDistance`) keeps the result specific to the imagery.

### Gaps
- No studio-sourced examples of grain/halftone-edge transitions were retrieved.

## 5. Technical considerations: A/B shaders, progress vs time, easing, loops, determinism, timeline, audio sync

### Takeaway
gl-transitions' progress-only contract makes shaders pure functions of (A, B, progress, params), which is ideal for deterministic, frame-accurate export; the host owns easing, looping and beat mapping.

### Cited Findings
- Contract is stateless: inputs are the two samplers, `progress` and `ratio`; randomness is `rand(uv)` = `fract(sin(dot(...))*43758.5453)`, a hash of position only. — [gl-transitions README](https://github.com/gl-transitions/gl-transitions), [CrossZoom.glsl](https://raw.githubusercontent.com/gl-transitions/gl-transitions/master/transitions/CrossZoom.glsl)
- `luminance_melt` short-circuits `progress == 0` and `== 1` to return pure A / pure B. — [luminance_melt.glsl](https://raw.githubusercontent.com/gl-transitions/gl-transitions/master/transitions/luminance_melt.glsl)
- Springs are inherently velocity-preserving/interruptible (relevant to live UI, not to fixed export). — [Apple docs](https://developer.apple.com/documentation/swiftui/animation/spring(response:dampingfraction:blendduration:))

### Inferences
- Progress-driven: ease `t` once on the host (`progress = ease(clamp((time - start)/dur))`) with hold segments; shaders never see wall-clock time. Time-driven extras (grain shimmer, glitch flicker) should come from a separate loop phase in whole cycles or from frame index hashed with a seed, never `Date.now()`.
- Determinism for export: derive every random value from (seed, cell/pixel, frame) hashes; avoid `sin`-hash precision differences across GPUs by using integer hashes (PCG) in GLSL ES 3.0 (WebGL2 supports uint ops); render frame N by setting time = N/fps rather than accumulating deltas.
- Guarantee endpoints: at progress 0 output exactly A, at 1 exactly B, with softness ranges scaled so the edge fully clears the frame (see section 4).
- Overshoot easing should be clamped or applied to a transform parameter rather than the mix factor, otherwise mix values outside 0..1 produce colour artefacts.
- Audio/beat sync: convert beat times to frame positions (frame = beat × 60/BPM × fps), align transition start or peak (not end) to the beat; provide a "beats per transition" parameter with a brand-beat fallback. Not sourced.
- Aspect handling: pass `ratio` and correct circles/rotations in aspect space, as gl-transitions provides.

### Gaps
- No sources fetched on WebGL2 determinism across GPUs, video encoding via WebCodecs, or beat detection.
- Lottie/Rive runtime frame determinism not researched.
