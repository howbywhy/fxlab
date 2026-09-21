# Premium craft for a dark, dense, sliders-heavy creative browser tool

Scope note: I fetched about 19 pages. Several fetches failed or returned thin content (Material 3 site, Carbon, Apple HIG numbers, Figma/Raycast/Rive/Framer write-ups not reached). Anything not cited below is marked as inference or listed in Gaps. The fetch tool summarises pages with a small model, so treat exact quotes as paraphrase.

## 1. Motion: durations, easing, what not to animate

### Takeaway
Premium tools feel fast because high-frequency interactions have little or no animation. Overlays and panels sit at about 150-250 ms with ease-out or decelerate curves. Reduced-motion should remove spatial movement and keep fades.

### Cited Findings
- UI animations should generally stay under 300 ms. A 180 ms select feels more responsive than a 400 ms one. — [Emil Kowalski, You don't need animations](https://emilkowal.ski/ui/you-dont-need-animations); [7 practical animation tips](https://emilkowal.ski/ui/7-practical-animation-tips)
- Never animate keyboard-initiated actions. Features used hundreds of times a day (hover effects, list interactions) should have no animation. Raycast is cited as having none on repeated open. — [Emil Kowalski](https://emilkowal.ski/ui/you-dont-need-animations)
- Press feedback: `scale(0.97)` on `:active`. Use ease-out for enter/exit, avoid ease-in. Enter popovers from `scale(0.9+)`, not `scale(0)`. Set `transform-origin` to the trigger, not the centre (Radix exposes a CSS variable for this). — [Emil Kowalski, 7 tips](https://emilkowal.ski/ui/7-practical-animation-tips)
- Tooltips: an initial delay, then subsequent tooltips open with no delay and no animation. — [Emil Kowalski, 7 tips](https://emilkowal.ski/ui/7-practical-animation-tips)
- Material 3 duration tokens: short 50/100/150/200 ms, medium 250/300/350/400, long 450-600, extra-long 700-1000. Standard easing `cubic-bezier(0.2,0,0,1)`, decelerate `(0,0,0,1)` for entrances, accelerate `(0.3,0,1,1)` for exits, emphasized-decelerate `(0.05,0.7,0.1,1)`, emphasized-accelerate `(0.3,0,0.8,0.15)`. Duration should grow with the distance or area travelled. — [Material Components Android motion doc](https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Motion.md)
- Radix tooltip defaults: `delayDuration` 700 ms, `skipDelayDuration` 300 ms. Keyboard focus opens the tooltip with no delay, and Escape closes it. — [Radix Tooltip](https://www.radix-ui.com/primitives/docs/components/tooltip)
- prefers-reduced-motion targets vestibular triggers (scaling, panning, large movement). The guidance is to reduce or replace them with gentler alternatives such as opacity, not to remove all animation. — [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- Keep colour, fade and opacity changes. Remove springs, cursor-tracking effects and canvas animation. Write CSS animation-off by default and enable it inside `@media (prefers-reduced-motion: no-preference)`. Also read the setting in JS. — [Josh Comeau](https://www.joshwcomeau.com/react/prefers-reduced-motion/)
- Apple HIG on motion (purposeful, not on frequent interactions, test with Reduce Motion): the fetch tool's summary was generic and included "300-500 ms", which I could not verify. Treat as unverified. — [Apple HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion)

### Inferences
- Suggested tokens for fxlab (my synthesis, not sourced as a set): hover colour/background 80-120 ms linear or ease-out, or none on list rows; press 80 ms; popover/menu 120-160 ms `cubic-bezier(0.2,0,0,1)`; drawer or panel collapse 180-240 ms same curve; exit shorter than enter. Tab underline/segment thumb 150 ms.
- Do not animate: slider value updates or thumb tracking during drag, canvas/preview responses to parameters, number-field scrubbing, anything triggered by keyboard shortcuts, Cmd-K open, list filtering results, tooltip changes after the first.
- Reduced motion for a tool whose product is motion: apply it to the chrome only. Keep the user's canvas playback (it is the work), but offer a paused-by-default option and remove chrome transforms (scale, slide) in favour of opacity.

### Gaps
- Linear, Vercel, Framer Motion, Carbon exact motion tokens: not retrieved (Carbon fetch returned nothing usable).

## 2. Typography and density

### Takeaway
I found little directly citable numeric guidance for dense-UI type scales. The sourced parts are tabular numerals, Linear's alignment emphasis and WCAG target sizes. The rest is inference.

### Cited Findings
- `font-variant-numeric: tabular-nums` (OpenType `tnum`) makes digits equal width. `slashed-zero` maps to `zero`. — [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)
- Linear treats pixel-level alignment of labels, icons and buttons in sidebar and tabs as something users "feel after a few minutes". It uses a display cut for headings and the regular cut for body text. — [Linear, How we redesigned the UI](https://linear.app/now/how-we-redesigned-the-linear-ui)
- WCAG 2.2 target size minimum: 24x24 CSS px, or spacing such that 24 px circles centred on undersized targets do not overlap. — [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

### Inferences
- Values in Geist Mono with `tabular-nums` (Geist Mono is already fixed-width, but apply to Geist values too, e.g. timecodes). Labels 11-12 px regular in a mid grey, values 11-12 px in a brighter grey. Reserve caps for tiny section headers only, with about +0.04-0.06em tracking. Avoid caps on control labels.
- Control height 24 px (matches WCAG minimum) for dense rows, 28 px for selects/buttons, radii 4-6 px consistently. Use a 4-px grid with 8-px gaps between modules. Slider thumb hit area should be at least 24 px even if the visible thumb is smaller.

### Gaps
- Specific type scales and letter-spacing values from Linear/Figma/Geist: not found.

## 3. Surface, colour, contrast, neutrality

### Takeaway
Layer by lightness with quiet borders, keep chrome neutral, and reserve the accent for state. Geist's 10-step scale is a usable model.

### Cited Findings
- Vercel Geist colour scales: steps 100/200/300 are default/hover/active backgrounds, 400/500/600 default/hover/active borders, 700/800 high-contrast backgrounds, 900 secondary text and 1000 primary text. — [Vercel Geist colors](https://vercel.com/geist/colors)
- Linear generates themes from three variables (base, accent, contrast) in LCH for perceptual uniformity, and got its neutral look by limiting how much of the chrome hue entered the calculations. — [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)
- WCAG: body text 4.5:1, large text 3:1 ([1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)); UI component boundaries/states and focus indicators 3:1 against adjacent colours; disabled controls exempt ([1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
- `color-mix()` allows deriving hover/border tones from one token, including mixing with transparent. — [MDN color-mix](https://developer.mozilla.org/en-US/docs/Web/CSS/color-mix) (fetch failed; syntax from memory, verify).

### Inferences
- Adopt the Geist role model for tokens (bg / hover / active / border / hover-border / text-2 / text-1). Keep panels one lightness step above ground, as fxlab already does (#1a1b1d over #232426 is inverted: the panel is darker than the ground, which is fine if deliberate but check that raised things such as popovers are lighter).
- Borders: white at 6-10% alpha rather than solid grey, so they adapt to each surface. Avoid shadows on panels; use them only for floating layers (menus, palette). A 1 px inner top highlight at about 4% white on raised surfaces is a common pattern I have seen but did not source.
- Accent: mint only on active tab, focused control, slider fill and selection. Fill rest states in neutral. Keep the accent at 3:1 or better against the panel, and use a 2 px focus ring with 2 px offset. Keep surrounding chrome desaturated and avoid tinted greys near the canvas.

### Gaps
- No source found for elevation-by-lightness numbers or inner-highlight practice.

## 4. Controls

### Takeaway
Direct-manipulation number fields and disciplined tooltips carry most of the perceived quality, but I could not retrieve primary sources for Figma, Rive or Raycast behaviour.

### Cited Findings
- Tooltip conventions: Radix 700 ms open delay with 300 ms skip window; opens instantly on keyboard focus. — [Radix](https://www.radix-ui.com/primitives/docs/components/tooltip)
- Tooltips are microcontent, must not carry essential task information, should persist while the cursor remains, and should be reachable by keyboard. — [NN/g](https://www.nngroup.com/articles/tooltip-guidelines/)

### Inferences (unsourced, from common practice)
- Scrub on label drag with pointer lock; Shift = 10x, Alt = 0.1x; double-click label or value resets to default; Up/Down arrows nudge by step, Shift+arrow by 10x; click value to type; Enter commits and Escape reverts. Show a distinct "modified from default" dot so reset is discoverable. Slider thumb 12-14 px visible with a 24 px hit area; fill from default value for bipolar params. `kbd` chips in menus and tooltips, e.g. tooltip text plus a shortcut chip after the label. Cmd-K palette: fuzzy match, recent first, grouped, arrow/Enter/Esc, no animation.

### Gaps
- Sourcing for all of the above is a gap.

## 5. Perceived performance and feedback

### Takeaway
Use the 0.1 / 1 / 10 s thresholds to pick the feedback type.

### Cited Findings
- 0.1 s feels instant (no feedback besides the result); 1 s keeps flow but is noticed; 10 s is the attention limit. Under 2 s a busy cursor suffices, 2-10 s a subtle indicator, over 10 s percent-done with an option to cancel. — [NN/g response times](https://www.nngroup.com/articles/response-times-3-important-limits/)
- Under 1 s show no loading indicator. Spinners suit a single module, skeletons suit full-page loads, and progress bars are recommended past 10 s. Skeletons are wrong for downloads and conversions. — [NN/g skeleton screens](https://www.nngroup.com/articles/skeleton-screens/)

### Inferences
- Video/print export: determinate progress with frame count, ETA and cancel. Show inline status in the top bar, and a toast only on completion with an action (Reveal/Download). Reserve fixed-size thumbnail boxes to avoid layout shift, and fade them in over 100-150 ms when ready. Undo should be an inline "Undone: <action>" note rather than a modal.

### Gaps
- No source for toast vs inline conventions or optimistic updates.

## 6. Empty states, onboarding, libraries, identity, anti-patterns

### Takeaway
No sourced material retrieved for these; I only offer inference.

### Inferences
- First five minutes: open with sample content already loaded and a look applied; one dismissible hint per surface, never a modal tour. Library: live or cached thumbnails per module, arrow-key navigation, recents and favourites pinned at the top, counts per category. Identity: a simple wordmark in Geist, a version string in the About panel, a short changelog. Anti-patterns: gradients and glows on chrome, animated hover on every row, saturated accent everywhere, mixed radii, inconsistent control heights, layout shift when values change width, tooltips on everything, emoji or decorative illustration.

### Gaps
- No primary sources reviewed on Raycast, Arc, Figma, Rive, Framer, Cavalry, Refactoring UI or Josh Comeau's non-motion writing.

## Prioritised checklist (impact-to-effort, highest first)

1. Tabular numerals (`font-variant-numeric: tabular-nums`) on every value, timecode and readout, so nothing jitters while dragging. [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)
2. Motion tokens in CSS variables: 100 / 160 / 220 ms with `cubic-bezier(0.2,0,0,1)`; no transitions on slider drag, canvas, list hover, keyboard actions. [Emil](https://emilkowal.ski/ui/you-dont-need-animations), [M3](https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Motion.md)
3. Global `@media (prefers-reduced-motion: reduce)` block removing transforms and slides, keeping fades. [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
4. Consistent 2 px `:focus-visible` ring in the accent with offset, at 3:1 or better against the panel. [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
5. Number fields: label-drag scrub, Shift/Alt modifiers, double-click reset, arrow nudging, type-to-edit (inference; standard in creative tools).
6. Token the colour system on the Geist role model (bg/hover/active/border/text-2/text-1), with 6-10% alpha borders and no stray hues. [Geist](https://vercel.com/geist/colors)
7. Audit contrast: text 4.5:1, control boundaries and thumbs 3:1; make sure 2 px tracks and dim labels pass. [WCAG](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
8. Hit areas at least 24 px for thumbs, toggles and rail tabs, even where the visual is smaller. [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
9. Tooltips with 500-700 ms delay, instant on focus, none-delay hopping between neighbours, with `kbd` chips for shortcuts. [Radix](https://www.radix-ui.com/primitives/docs/components/tooltip)
10. Export feedback: determinate progress with cancel past 2-10 s; toast only on completion. [NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/)
11. Fix control heights (24/28) and one radius set, and audit alignment of labels and values row by row. [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)
12. Library: reserved-size thumbnails, keyboard navigation, recents; Cmd-K with no open animation (inference).
