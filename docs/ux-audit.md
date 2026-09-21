# UX audit and redesign

Method: a heuristic evaluation of the previous single-screen UI at 1280×800 (a common laptop size), with measurements taken from the running app, against Nielsen's ten heuristics, Resnick's creativity-support principles and WCAG 2.2 AA. The rubric comes from `docs/research/ux_best_practice.md`. This is an expert review, not user testing: nobody outside this project has used the new layout yet.

## What was wrong (measured on the old UI, 1280×800)

| Finding | Evidence | Heuristic |
| --- | --- | --- |
| The primary action was off screen | 12 buttons in the top bar; the brand was clipped to "f" and **Export video** ran past the right edge | Visibility, efficiency |
| The stage was squeezed | 716 px wide, between a 248 px library and a 316 px inspector | Aesthetic and minimalist design |
| One column held the whole workflow | Prepare, Combine and Finish stacked in the inspector: 114 controls, 2,092 px tall in a 752 px window, so Finish sat two screens down | Cognitive load, recognition over recall |
| Prepare lanes were unusable | Two lanes side by side, about 150 px each; the Duotone card's colour and slider controls were clipped | Error prevention |
| A hidden mode | Clicking "+ Add" silently switched the left pane into an "Add to Prepare A" context; the tab you were on changed under you | User control, consistency |
| Global and local actions were mixed | Undo, Randomise, file, view (preview, safe zones), size and four exports sat in one bar | Match between system and real world |
| Sources, palette and fonts lived apart from where they were used | Assets and System were separate tabs from the stages that use them | Recognition over recall |
| Nothing told you what was switched on elsewhere | A Finish layer could be active while you were looking at Prepare | Visibility of system status |
| No way to compare against the original | Users had to bypass stages one at a time | User control and freedom |
| Empty panes gave no next step | "No finish modules" and nothing else | NN/g empty states |

## What changed

**One tab per task, in working order.** Images, Combine, Finish, Data, Colour, Export in a left rail (keys 1–6). The stage, timeline, Undo and project name stay constant; the panel beside them changes. This follows the pipeline ordering of Resolve's pages and Affinity's personas, but keeps one document and one stage, as Photoshop's workspaces do.

| Old | New |
| --- | --- |
| Library / Assets / System tabs, plus a right inspector | One panel per task, 356 px, controls at full width |
| Prepare A and B side by side | A and B as tabs inside Images, each with a full-width card |
| "Add" switches a hidden Library mode | A drawer over the panel with search and kind chips; choosing a module closes it; Escape or Back leaves |
| 12 top-bar buttons | 9: Undo, Redo, Find a module, Randomise, Open, Save, Save as, Export (and the Randomise scope) |
| Export buttons in the top bar | The Export tab: still, video, frames, print, folder, batch |
| Timing fields in the footer | Length and fps stay under the stage; direction, easing and hold moved to Combine, where transitions are chosen |
| Size, preview, safe zones in the top bar | A bar above the stage, next to what they change |
| No compare | **Hold for original** above the stage |
| Colourways, palette, motion, saved looks, batch export in System | Colour (palette, colourways, motion, saved looks); batch moved to Export |
| A wall of sliders per module | First six controls, then "More controls (n)" (`primary` on a module changes it) |
| Empty panes | A sentence and an action ("Add a layer to grade, print or texture the frame") |
| Nothing shows hidden state | A count or dot on each tab |

**Data, as a first-class task.** The Data tab loads a table (samples, file, paste, address), shows each column with its range and shape, sets the playhead, lists linked controls, and adds Data visuals. Linking follows the per-property pattern of Figma variables and Blender drivers: a link button on every range control opens a popover with the column's sparkline, range, output mapping and invert. A linked control is marked by an icon, an orange tint and a disabled slider, not by colour alone.

## Measured after (same 1280×800, same three finish layers)

| | Before | After |
| --- | --- | --- |
| Stage width | 716 px | 848 px |
| Export reachable | No (clipped) | Yes, in the top bar and its own tab |
| Top-bar buttons | 12 | 9 |
| Controls visible at once | 114 in one 2,092 px column | 30–77 per tab (Images, Combine, Finish), in a 650 px panel |
| Prepare lane width | about 150 px | 320 px |

`tests/workspaces.py` asserts the layout facts at 1280×800 and 1440×900 (no page scroll, Export on screen, stage at least half the width, every tab visible) and that every visible control has an accessible name.

## What this audit did not do

- **No user testing.** The tab count (six) sits at the top of the 4–7 range the research found in other tools; there is no evidence for an ideal number. Whether people find "Colour" or "Data" where they expect is untested.
- **Fitts's and Hick's laws** were not sourced; the layout choices they would inform (edge-anchored rail, few choices per panel) are judgement.
- **Small screens.** Below about 1100 px the panel narrows to 316 px and the rail to 64 px. Nothing has been tuned for tablets or phones.
- **Contrast.** Text and controls keep the existing greys and mint accent. They were not measured against WCAG contrast ratios in this pass.
- **Focus order and screen-reader flow** were checked for names, not by using a screen reader.
- **Reduced motion.** UI transitions are switched off under `prefers-reduced-motion`; the stage stays animated by design.

## Gaps worth closing next

1. **Live previews in the picker.** The picker lists names and one line each. A thumbnail rendered from the current frame would let people choose by sight. This is the biggest remaining recognition-over-recall gap.
2. **Curated primary controls.** The "first six" rule is a heuristic. Setting `primary` per module (the three or four controls that define it) would be better than order alone.
3. **Drag a column onto a control**, as Tableau and TouchDesigner do, alongside the link button. No evidence found on which is easier for non-programmers.
4. **Before/after as a split** as well as a hold.
5. **Data smoothing per link**, and categorical columns driving choices or palettes.
6. **First-run guidance** that teaches by doing (a dismissible, one-step hint on the Images tab), without a tutorial or template.
7. **Saved workspace layout**, as Lightroom and Photoshop allow, if the panel width proves wrong for some screens.
