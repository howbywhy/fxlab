# UX/UI best practice for creative and media tools (fxlab IA and interaction redesign)

Scope note: I ran about 24 searches and fetches. Sources below were checked directly (fetched pages or search snippets). Anything not sourced is labelled Inference or listed under Gaps. Several requested topics (Cavalry, Jitter, Figma modes, Blender workspaces, Fitts/Hick, slider scrubbing conventions, laptop panel widths) were not verified and are flagged rather than filled from memory.

## 1. Task-based workspaces (Resolve pages, Affinity personas, Lightroom modules, Photoshop workspaces)

### Takeaway
Mature media tools split by task stage, not by feature type. Resolve uses 7 pages in pipeline order, Affinity Photo 5 to 6 personas, Lightroom Classic 7 modules. All are switched by a persistent, always-visible bar. Nothing I could source covers mode-confusion failures directly, so the risks below are inference.

### Cited Findings
- Resolve has 7 pages (Media, Cut, Edit, Fusion, Color, Fairlight, Deliver), ordered as a left-to-right pipeline, and you switch with tabs at the bottom of the window. — [2 Pop / CalArts](https://2pop.calarts.edu/technicalsupport/davinci-resolve-interface/), [Blackmagic](https://www.blackmagicdesign.com/products/davinciresolve)
- Resolve page purposes: Media imports and organises; Cut is a fast rough edit; Edit is detailed timeline work; Fusion is effects and motion graphics; Color is grading; Deliver exports. Deliver is last and is an output-only page. — [Adorama overview](https://www.adorama.com/alc/davinci-resolve-overview) and the 2 Pop link above.
- Affinity Photo personas: Photo (default), Liquify, Develop, Tone Mapping, Export (a sixth, Panorama, is listed in the official docs). Each is "a specific design environment", and switching is one click, with "the workspace tools and panels changing to that Persona's way of working". Opening a RAW file drops you into Develop automatically. — [Affinity docs](https://s3-eu-west-1.amazonaws.com/affinity-docs/help/photo/en-US.lproj/pages/Introduction/about_Personas.html), [Lenscraft](https://lenscraft.co.uk/photo-editing-tutorials/affinity-photo-personas-explained/)
- Export persona is slice-based, so output is its own workspace. — [iphotography](https://www.iphotography.com/blog/what-is-the-persona-system-in-affinity-photo/)
- Lightroom Classic has 7 modules (Library, Develop, Map, Book, Slideshow, Print, Web). Switching is Cmd/Ctrl+Opt/Alt+1 to 7. Alt-double-click a thumbnail jumps from Library to Develop and back. Users can right-click the module picker to hide modules. — [Adobe community thread](https://community.adobe.com/t5/lightroom/can-t-find-the-options-library-develop-map-book-slideshow-print-and-web/td-p/10039631), [Fstoppers](https://fstoppers.com/lightroom/using-lightroom-classic-modules-no-one-talks-about-625066)
- Photoshop workspaces (Essentials, 3D, Graphic and Web, Motion, Painting, Photography) are panel arrangements over the same document, not different tools. Users can save their own via Window > Workspace > New Workspace. Adobe presents them as reducing clutter for the task at hand. — [Photoshop Essentials](https://www.photoshopessentials.com/basics/photoshop-workspaces/), [PHLEARN](https://phlearn.com/tutorial/how-to-customize-your-workspace-in-photoshop/)
- Progressive disclosure caveat: NN/g says designs beyond 2 disclosure levels "typically have low usability because users often get lost". This applies to nested tabs inside workspaces. — [NN/g](https://www.nngroup.com/articles/progressive-disclosure/)

### Inferences
- Resolve and Affinity show two distinct meanings of "tab": Resolve pages change the whole tool, while Photoshop workspaces only rearrange panels. For fxlab the Photoshop meaning fits better: one project and one stage, with tabs changing the side panels, not the document.
- Observed pattern: 5 to 7 top-level areas, ordered by pipeline, with output last. For fxlab, 4 to 5 tabs fits. Suggested: Sources, Combine, Finish (or Look), Data, Export. Prepare could sit inside Sources because it is per-source. Keep Timeline global rather than its own tab.
- Persistent across tabs: the stage preview, undo history, the timeline transport, and project name. Per-tab: panels and tool options. This matches Lightroom, where the image stays the same object across modules. The stage-persists claim is my synthesis and not stated in the docs.
- Likely failure modes (unsourced): hidden state (a Finish effect active while you are on the Sources tab), so show a small badge or count per tab; and mode confusion, so name tabs by intent and not by tool type. Lightroom and Affinity keep switching to one click plus a keyboard shortcut, which reduces the cost of correcting a wrong tab.

### Gaps
- No verified sources on Cavalry, Jitter, Rive editor mode structure, Figma Design/Dev/Prototype modes, TouchDesigner workspaces or Blender workspace tabs. Mode-confusion research (Raskin-style) was not searched.
- No evidence found on ideal tab counts. The 5 to 7 figure is only what these products happen to do.

## 2. Parameter and module UI (sliders, grouping, pickers, stacks, compare, empty states, undo)

### Takeaway
Sourced evidence covers accessibility constraints on sliders, the 2-level limit for disclosure, and empty-state guidance. Scrubbing, double-click reset and picker patterns are common practice but I did not find primary sources for them.

### Cited Findings
- WCAG 2.2 SC 2.5.8 (Level AA): pointer targets must be at least 24 by 24 CSS px, unless spaced so a 24px circle centred on each does not overlap neighbours, or inline, or an equivalent control exists, or the size is essential. The enhanced 2.5.5 asks 44 by 44. — [W3C Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- WCAG 2.2 SC 2.5.7 (Level AA): anything operated by dragging must also work with a single pointer without dragging. For sliders, W3C suggests click-on-track to set the value, or a text input for exact values. This means every slider needs a number field. — [W3C Understanding 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
- NN/g progressive disclosure: defer advanced options; limit to 2 levels; put frequently used options up front; label secondary areas clearly. It improves learnability, efficiency and error rate for both novices and experts. — [NN/g](https://www.nngroup.com/articles/progressive-disclosure/)
- NN/g empty states: communicate status, provide learning cues ("pull revelations" shown on interaction beat forced tutorials), and offer direct pathways to key tasks, such as an action button or demo data. — [NN/g](https://www.nngroup.com/articles/empty-state-interface-design/)
- Nielsen heuristic 7 (flexibility): shortcuts "hidden from novice users" for experts. Heuristic 3: clearly marked exits with undo and redo. Heuristic 6: recognition over recall. — [NN/g 10 heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- Photoshop and Lightroom both let users save and hide panels or modules, which is an example of user-tailored disclosure. — [Photoshop Essentials](https://www.photoshopessentials.com/basics/photoshop-workspaces/), [Fstoppers](https://fstoppers.com/lightroom/using-lightroom-classic-modules-no-one-talks-about-625066)

### Inferences (design guidance for fxlab)
- Each param row: label, slider, and an editable number field, so 2.5.7 is met and precise entry works. Track click sets the value. Keep the row at least 24px tall.
- For modules with 5 to 15 params: show the top 3 to 5 always ("primary"), put the rest under one "More" fold per module. That is one extra level, within NN/g's 2-level limit. Mark primaries in module metadata, so authors control which appear.
- Empty states should teach by action: an empty Data tab offers "Load a CSV" plus "Use sample data". An empty Finish stack offers "Add an effect" with a search field. This matches NN/g's guidance and honours the no-presets direction, since sample data is not a template look.
- Module picker: search field first, category as filter chips, add-in-place at the current stack position, and a hover live preview on the current frame. This is standard in effects browsers, but I did not source it.
- Per-module: bypass toggle (eye), solo, drag to reorder, and a stage-wide "before/after" hold key. Undo should be snapshot-based and coalesce continuous drags into one step; fxlab already does this per CLAUDE.md.

### Gaps
- No primary source found for scrub-to-change, Shift/Alt fine step, double-click reset, or units display. Figma, Blender and Resolve conventions were not verified.
- No sources retrieved on module-picker thumbnails vs live previews, or reorderable stack design.

## 3. Data-binding UI (Figma variables, Rive, Blender drivers, After Effects, TouchDesigner, Tableau, Vega-Lite, Flourish)

### Takeaway
Every mature system uses one of three patterns: (a) a per-property affordance that opens a picker (Figma), (b) drag from data onto a target (Tableau, TouchDesigner, After Effects pick whip), or (c) a column-to-slot mapping panel (Flourish). All show a distinct visual state on bound properties (Blender purple, TouchDesigner green). For non-programmers, (a) plus (b) together is the safest choice.

### Cited Findings
- Figma: click the property field and press `=` to open the variable picker, or use "Apply styles and variables" in Fill and Stroke. Variables can be scoped so only compatible properties accept them, which "reduces guesswork". Detach with an icon on hover. — [Figma Help: apply variables](https://help.figma.com/hc/en-us/articles/15343107263511-Apply-variables-to-designs), [Figma search summary](https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma)
- Rive data binding: a View Model defines the data, a View Model Instance holds values, and Bindings link them to scene properties (position, colour, size). Properties can be renamed or restructured without breaking bindings. — [Rive docs overview](https://rive.app/docs/editor/data-binding/overview), [Rive blog](https://rive.app/blog/getting-started-with-data-binding)
- Blender drivers: Ctrl+D over a property creates a driver and opens an Edit Driver popover. Driven fields are coloured purple. There is an open bug report that the purple was a source of confusion, and a regression report when it stopped showing. — [Blender manual](https://docs.blender.org/manual/en/latest/animation/drivers/usage.html), [Blender T59808](https://developer.blender.org/T59808), [Blender #108621](https://projects.blender.org/blender/blender/issues/108621)
- After Effects Property Link Pick Whip: drag from one property to another and the expression is generated for you. — [Adobe](https://helpx.adobe.com/after-effects/using/expression-basics.html), [Adobe how-to](https://helpx.adobe.com/lv/after-effects/how-to/link-properties.html)
- TouchDesigner: drag a channel onto a parameter and choose Export CHOP; the parameter turns green. Hovering the dragged channel over a node opens that node's parameter page. — [Derivative CHOP Export](https://derivative.ca/UserGuide/CHOP_Export), [Derivative forum](https://forum.derivative.ca/t/understanding-drag-and-drop-chop-export/742499)
- Tableau Marks card: drag a field onto Color, Size, Shape, Label, Detail. A categorical field on Color gives distinct hues; a numeric field gives a gradient. Size and Shape take one field each; Label, Detail, Tooltip and Color can take several. — [Tableau Help: marks](https://help.tableau.com/current/pro/desktop/en-us/viewparts_marks_markproperties.htm), [Tableau shelves reference](https://help.tableau.com/current/pro/desktop/en-us/buildmanual_shelves.htm)
- Vega-Lite: encoding maps a field to a channel; each field has a type (quantitative, ordinal, nominal, temporal), a scale and optional aggregate. Channels include color, size, opacity, shape, angle, strokeWidth. — [Vega-Lite encoding](https://vega.github.io/vega-lite/docs/encoding.html)
- Flourish: a Data tab has column bindings (Categorical vs Numerical). Categorical drives colour and aggregation, numeric drives position and size. An "Auto set columns" button and automatic data typing pre-fill the bindings on upload. — [Flourish blog](https://flourish.studio/blog/announcing-data-typing/), [Flourish help](https://helpcenter.flourish.studio/hc/en-us/articles/8761545383183-Adding-data-to-a-template)

### Inferences (recommended pattern for fxlab)
- Primary: a small link icon on every bindable parameter (the Figma/Blender per-property model, the least mode-dependent). Click opens a popover with: column picker (only type-compatible columns, per Figma scoping and Vega-Lite types), a sparkline of the column values, min/max readout, output range that defaults to the parameter's own range, invert, and smoothing. Secondary: drag a column chip from the Data tab onto a parameter row, as in Tableau/TouchDesigner, with the row highlighting as a drop target.
- Bound state must be unmistakable and colour-neutral-safe. Blender's purple and TouchDesigner's green both work; but the Blender bug reports suggest testing that the cue is not lost when a field is disabled or overridden. Use icon plus tint, not tint alone (colour-only is also a WCAG problem).
- Auto-assign on load, as Flourish does, so the first result is not blank: pick the first numeric column for one primary parameter, and let the user change it. This fits "defaults matter" in CLAUDE.md.
- Numeric column to slider range (normalise min to max) should be the default mapping; categorical to discrete choices or palette (Tableau behaviour). Time-aware smoothing only matters once rows map to timeline progress.

### Gaps
- Rive editor UI steps for creating a binding were not retrievable (docs page truncated). Datawrapper, Observable and After Effects expression-editor UX were not fetched. No usability research found comparing drag-to-bind and icon-to-bind for non-programmers, so the recommendation is inference.

## 4. Heuristic evaluation checklist

### Takeaway
Use Nielsen's 10, Resnick's principles and WCAG 2.2 as the review rubric. Below is a checklist tied to the sources.

### Cited Findings
- Nielsen's 10: visibility of status; match real world; user control and freedom; consistency and standards; error prevention; recognition over recall; flexibility and efficiency; aesthetic and minimalist design; help recognise, diagnose and recover from errors; help and documentation. — [NN/g](https://www.nngroup.com/articles/ten-usability-heuristics/)
- Resnick et al.'s 12 creativity-support principles include: support exploration (try many alternatives, easy backtracking); low threshold, high ceiling, wide walls; support many paths and styles; make it as simple as possible; choose black boxes carefully; design for designers (tools that make diverse artefacts, not a predefined one). — [Resnick et al., Design Principles for Tools to Support Creative Thinking](http://www.cs.umd.edu/hcil/CST/Papers/designprinciples.htm)
- "Low floor, high ceiling" comes from Papert; "wide walls" was added by Resnick, meaning very general primitives that combine, with multiple paths from floor to ceiling. — [Resnick, Designing for Wide Walls](https://mres.medium.com/designing-for-wide-walls-323bdb4e7277), [search summary](https://www.visualistapp.com/blog/organising-digital-creative-library)
- Shneiderman: creativity tools should let users generate many alternatives, show implications of choices, and track and replay decisions and history. — [CACM](https://cacm.acm.org/research/creativity-support-tools-accelerating-discovery-and-innovation/)
- WCAG 2.2 AA: target size 24px (2.5.8), no drag-only operation (2.5.7). Full spec for focus appearance and contrast was not fetched. — links in section 2.
- Dark UI (Material): surface #121212 rather than black, so elevation and shadows read; text contrast at least 15.8:1 on the base surface (so body text still passes 4.5:1 at the highest elevation); desaturate accent colours because saturated ones "vibrate"; higher elevation means lighter surface. — [Material dark theme](https://m2.material.io/design/color/dark-theme.html)

### Inferences (checklist for fxlab)
1. Status: show "which stage am I in", count of active layers per tab, render or export progress, and a clear bound/unbound state on parameters.
2. Control: undo/redo visible in the top bar, bypass per layer, before/after hold, reset per param and per module.
3. Error prevention: disable or hide incompatible column bindings; explain limits (capped or approximate modules) in place, per CLAUDE.md honesty rules.
4. Recognition over recall: module picker with search; parameter names in plain language; no memorised shortcuts required.
5. Wide walls: modules should combine freely, and data bindings should work on any numeric param. Avoid a separate data-only module family unless it is a real building block.
6. Colour-neutral chrome: keep UI greys neutral (no tint), accent used only for interaction state, so the graded image is judged correctly. This is my inference from Material's desaturation advice, and no source addresses colour-critical work directly.
7. Reduced motion: honour `prefers-reduced-motion` for UI transitions (WCAG technique; not fetched). The stage preview is the work itself and should remain animated, with a pause control.
8. Keyboard: every slider focusable and arrow-adjustable; visible focus ring; tab switching by number keys, as in Lightroom.

### Gaps
- Fitts's law and Hick's law: no source fetched. Common reading (edge-anchored controls are easier to hit; fewer choices at once speed selection) is only background inference.
- WCAG 2.2 focus appearance (2.4.11 and 2.4.13), 1.4.11 non-text contrast at 3:1 and 2.3.3 animation from interactions were not retrieved.
- Cognitive-load research on dense inspectors: not found.

## 5. Layout at 1280x800 to 1440x900

### Takeaway
I found no authoritative source giving panel widths or stage-share targets. What follows is inference only.

### Cited Findings
- Photoshop/Lightroom/Resnick sources support letting users collapse or hide panels and save arrangements. — [Photoshop Essentials](https://www.photoshopessentials.com/basics/photoshop-workspaces/), [Fstoppers](https://fstoppers.com/lightroom/using-lightroom-classic-modules-no-one-talks-about-625066)
- Target size minimum of 24 CSS px constrains row height and icon buttons in dense inspectors. — [W3C 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

### Inferences
- Starting point to test: left panel 240 to 280px, right inspector 300 to 340px, giving the stage about 55 to 60 percent of 1280px (roughly 660 to 740px). Those numbers are my estimate and unverified.
- Below about 1280px wide, collapse the left panel to a rail, so that Library and Assets open as overlays, and keep the inspector. With tabs, only one side panel per tab may be needed, which returns width to the stage.
- Keep the timeline a single strip of about 56 to 72px, expandable, since it applies to every tab.
- Test at 1280x800 with both panels open: the stage should still show a 4:5 (1080x1350) frame at 100 percent of fit, without scrolling the page.

### Gaps
- No sourced numbers from Carbon, HIG or Material on inspector widths. None fetched for Resolve or Figma panel sizes. Requires local usability testing.
