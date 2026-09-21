# Build the setup-and-run PDF that ships alongside fxlab.html.
#
#     python3 tools/guide.py [out.pdf]
#
# Needs reportlab (pip install reportlab). Keep this in step with the app:
# when a feature changes, update the matching row here too.
import sys
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Preformatted, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm

INK = colors.HexColor('#1c1d20'); MUTED = colors.HexColor('#5d6066'); RULE = colors.HexColor('#d9dbdd'); ACC = colors.HexColor('#2f7a63'); CODEBG = colors.HexColor('#f1f3f2')
h1 = ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=INK, spaceAfter=2)
sub = ParagraphStyle('sub', fontName='Helvetica', fontSize=10.5, leading=15, textColor=MUTED, spaceAfter=10)
h2 = ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=11.5, leading=15, textColor=ACC, spaceBefore=12, spaceAfter=4)
body = ParagraphStyle('b', fontName='Helvetica', fontSize=9.6, leading=14, textColor=INK, spaceAfter=5)
cell = ParagraphStyle('c', parent=body, spaceAfter=0)
cellk = ParagraphStyle('ck', parent=cell, fontName='Helvetica-Bold')
code = ParagraphStyle('code', fontName='Courier', fontSize=8.4, leading=11, textColor=INK)

def tbl(rows, widths):
    t = Table([[Paragraph(a, cellk), Paragraph(b, cell)] for a, b in rows], colWidths=widths)
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'), ('LINEBELOW',(0,0),(-1,-1),.5,RULE), ('TOPPADDING',(0,0),(-1,-1),4), ('BOTTOMPADDING',(0,0),(-1,-1),5), ('LEFTPADDING',(0,0),(-1,-1),0)]))
    return t

def footer(c, d):
    c.saveState(); c.setFont('Helvetica', 8); c.setFillColor(MUTED)
    c.drawString(20*mm, 12*mm, 'fxlab v0.9 · setup and run guide'); c.drawRightString(A4[0]-20*mm, 12*mm, str(d.page)); c.restoreState()

import pathlib
OUT = sys.argv[1] if len(sys.argv) > 1 else str(pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'fxlab-setup-guide.pdf')
doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=18*mm, bottomMargin=20*mm, title='fxlab setup and run guide', author='fxlab')
W = A4[0] - 40*mm
s = []
s += [Paragraph('fxlab', h1), Paragraph('A browser-based library for exploring image and video languages: transitions, image treatments, masking, textures, generative visuals and data, with exports for social and print.', sub)]

s += [Paragraph('1. Open it', h2),
      Paragraph('There is nothing to install. Put <b>fxlab.html</b> anywhere, for example a Tools folder, and double-click it. It opens in your default browser and runs offline.', body),
      Paragraph('Use a current <b>Chrome</b> or <b>Safari</b>; Edge and Firefox also work. Hardware acceleration must be on, because fxlab runs on WebGL2. In Chrome, check Settings, System, “Use graphics acceleration when available”.', body)]

s += [Paragraph('2. Make something', h2), tbl([
  ('Tabs', 'Work moves left to right: <b>Images</b>, <b>Combine</b>, <b>Finish</b>, <b>Data</b>, <b>Colour</b>, <b>Language</b>, <b>Export</b>. The stage, timeline and Undo stay where they are; only the panel beside them changes. Keys <b>1</b> to <b>7</b> switch tabs. A small number on a tab counts the layers switched on inside it. Hover a value name and drag it to change the value (Shift ×10, Alt ×0.1); double-click resets it.'),
  ('Size', 'Pick a size above the stage, such as Instagram 4:5 or Story/Reel 9:16, or type your own. Turn on Safe zones to see where platform UI will sit. Preview quality is there too: 35–50% keeps playback smooth, and exports always render at full size.'),
  ('Images', 'Drop images or video onto the stage: the first file loads into A and the second into B, or click a picture. Until then a stand-in photograph is used. Use the A and B tabs to give each image its Fill/Fit, Zoom, X/Y and its own <b>Prepare</b> list: treatments and Reframe applied to that image before the two are combined. Double-click a control name to reset it.'),
  ('Combine', 'Choose how the images meet: one image on its own, a transition, a mix or mask, or a generated field. Timing (direction, easing and hold) lives on this tab, and the curve is drawn on the timeline.'),
  ('Finish', 'Layers that run in order over the combined frame: grade, print, texture, optics, overlays and Data visuals. <b>Add to Finish</b> opens a search list with kind filters; choosing a module closes it. Drag a card header to reorder, the eye switches a layer off, the icons duplicate and remove. Each module shows its first six controls; the rest sit under <b>More controls</b>.'),
  ('Find a module', '<b>⌘K</b> or <b>/</b> (or the Find a module button) searches every module and puts it in the right place: how images meet goes to Combine, everything else to Finish.'),
  ('Original', 'Hold <b>Hold for original</b> above the stage to see plain image A, then let go to come back.'),
  ('Timeline', 'Length and fps sit under the stage; direction, easing and hold are on the Combine tab. A → B plays once, A → B → A returns to the start.'),
  ('Transparency', 'Every colour control has an opacity slider next to it, plus a transparent swatch. Tick <b>Transparent background</b> on the Export tab and anything showing the background colour becomes see-through; the stage shows a checkerboard. PNG and PNG sequence exports then carry an alpha channel. MP4 can’t hold transparency, so use a PNG sequence for editing software.'),
  ('Generators', 'Creative-coding bases: flow fields, ink bleed, cellular automata, interference, blobs, a raymarched 3D solid, spirograph orbits, networks, op stripes, spirals, and Scribble, which redraws image A as pen work. Feedback-based ones (flow, ink, automata) build up over a second or two — let them run.'),
  ('Textures', 'Treatments that make things physical: surface (canvas, linen, concrete, crumpled paper, metal, scratches), cross-hatch engraving, painterly, letterpress, foil, film stock, and Palette map, which snaps any image to your palette. <b>Levels &amp; curves</b>, <b>Sharpen</b> and <b>Colour range</b> cover the basics of grading, and <b>Noise texture</b> makes a surface from nothing.'),
  ('Randomise', 'Picks a random Combine and Finish. Prepare lists stay put. When you have a palette, it uses your colours. The arrow beside it chooses which stages and categories it may change.'),
], [28*mm, W-28*mm])]

s += [Paragraph('3. Images and palette', h2),
      Paragraph('The <b>Images</b> tab holds an image library; the <b>Colour</b> tab holds the palette. Drop in images, or a zip of them; fxlab unpacks the zip and keeps what it can use.', body), tbl([
  ('What it keeps', 'Images: SVG, PNG, JPG, WebP, GIF. SVG wins over a PNG of the same image. Fonts, Illustrator, EPS and PDF files are skipped.'),
  ('Palette', 'On the Colour tab: add, rename and remove colours, or press <b>Pull colours from image A</b> (or B) to take the five main colours of the frame on the stage. Single-colour SVGs add their colour automatically. Palette swatches appear under every colour control.'),
  ('Library', 'Hover an image for actions: <b>A</b> or <b>B</b> uses it as a source (transparent areas take the background colour).'),
  ('Where they live', 'In this browser on this computer, not inside fxlab.html. Projects remember which images they use.'),
  ('Kits', '<b>Save kit</b> downloads images and palette as one .fxkit file. Drop it into Assets in another browser or on another machine to restore everything. If a browser won’t keep assets for local files, the Assets tab says so; open your kit each session.'),
], [28*mm, W-28*mm])]

s += [Paragraph('4. Colour roles and motion', h2),
      Paragraph('The <b>Colour</b> tab also holds colourways and motion tokens. Modules link to colour roles instead of fixed values, so changing a role restyles everything that uses it.', body), tbl([
  ('Colourways', 'Sets of four roles: Ground, Ink, Accent and Accent 2. Click a strip to switch colourway; every linked module follows. Contrast between ink and ground is shown as you edit.'),
  ('Linking', 'In any colour control, the I, G, A and A2 chips link it to a role (the label turns mint and shows an arrow). Picking a fixed colour unlinks it.'),
  ('Motion', 'Brand easing (with a custom curve option) and beat (pulses per loop). Modules and the timeline set to Brand use them.'),
  ('Saved looks', 'Save the current composition under a name; apply, update or delete it from its thumbnail. Nothing ships pre-made: a look is only ever something you found.'),
  ('Batch', 'On the Export tab, <b>Set up a batch</b> renders compositions × sizes × colourways, as MP4s or PNG stills, into one zip. Saved looks and colourways travel inside .fxkit kits.'),
], [28*mm, W-28*mm])]

s += [Paragraph('5. Data', h2),
      Paragraph('The <b>Data</b> tab turns a table into visuals. A built-in sample is used until you load your own, so nothing is empty.', body), tbl([
  ('Load', 'Pick a built-in sample (they work offline), choose or drop a CSV, TSV, JSON, GeoJSON or newline-delimited JSON file, paste text, or fetch an address. Up to 2000 rows and 24 columns are kept; longer tables are thinned evenly and it says so.'),
  ('From the web', 'Thirteen public sources are listed (earthquakes, weather, air quality, waves, GDP, exchange rates, artworks, bike stations…), all checked to work from a local file with no key. Any other address works if the server lets web pages read it. If not, download the file and drop it in.'),
  ('API keys', 'Under <b>Needs an API key?</b> send a key as a header. It stays in this tab and is never saved in a project; a key written in the address is blanked when you save. Some servers refuse custom headers from web pages.'),
  ('Columns', 'Each column is shown with its range and shape. Columns that run one way (time, year) are marked <b>axis</b>: they place rows rather than being plotted as values.'),
  ('Playhead', 'Decides which row is read as the timeline plays: forward and back (loops cleanly), forward then jump, follow the transition, or a fixed row.'),
  ('Link a control', 'Hover any slider and press its link button. Choose a column, see its shape and range, set the output range, and flip it if needed. The control turns orange and follows the data. <b>Linked controls</b> on the Data tab lists them all.'),
  ('Draw it', 'Data visuals are Finish layers: lines, areas, ridges and streams; points and maps; columns and warming stripes; rings; grids. Set Ground to Colour for a chart on its own, or leave it over the frame.'),
  ('Saving', 'A project keeps the table (thinned to the caps above) and every link, so it opens the same way.'),
], [28*mm, W-28*mm])]

s += [Paragraph('6. Language', h2),
      Paragraph('A visual language is a few constants and a bounded space of variation. Everything in the composition is a constant unless you <b>pin</b> it. The <b>Language</b> tab is where you say what it is and hand it on.', body), tbl([
  ('Pin', 'Hover any control and press its pin. Pinned controls are the ones a tool will show. Name each after what it does to the picture (“Heat”, “Coarseness”), and set its lowest and highest value. A control can be held still while you explore. <b>Suggest controls</b> pins one defining control per layer to start from.'),
  ('Rule', 'A name and one or two sentences: what never changes, and what is allowed to. It travels with every export.'),
  ('Explore', 'A seed walks the pinned ranges reproducibly: the same seed gives the same six variations in any browser. <b>How far</b> sets how much they wander. Press a picture to take it; Undo puts it back.'),
  ('Tool', 'One HTML file with the composition locked and only your pinned controls shown. Someone drops in an image, adjusts, shuffles and exports a still, video or frames. It stores nothing in their browser.'),
  ('Board', 'A PNG of the language as it stands and seven seeded variations, with the palette and each control’s range.'),
  ('Recipe', 'The whole composition as JSON, including any data table and links. Opens in fxlab.'),
  ('Tokens', 'Colour roles, palette, easing and length as W3C design tokens for Figma, Style Dictionary and code. A stack of treatments and textures cannot be written as tokens, so it is not in them.'),
  ('What travels', 'The tool and the recipe carry everything exactly but need a browser with WebGL2. Images are not stored; a tool starts with stand-ins.'),
], [28*mm, W-28*mm])]

s += [Paragraph('7. Print', h2),
      Paragraph('Choose a print size from the size menu (A6–A1, US Letter, Tabloid, posters, DL, business cards) or click <b>Print…</b>. The stage becomes the full sheet including bleed, with the trim line dashed and the safe area dotted.', body), tbl([
  ('Document', 'Set trim size in mm, orientation, bleed (3 mm is standard; 2 mm for cards) and a safe margin. Keep anything that must survive trimming inside the dotted line.'),
  ('PDF', 'Exports at 150–600 dpi, rendered in tiles so large posters work, with TrimBox and BleedBox set. Crop marks and a slug line are optional.'),
  ('PNG', 'Same render as a PNG with its dpi recorded, for placing in InDesign or sending to a printer.'),
  ('Separations', 'Pick up to four inks and a paper colour. fxlab exports one greyscale plate per ink (black = full ink), plus a composite preview and an inks list, ready for riso or screen printing. Turn on ink preview (with optional misregistration) to see the result on the stage first.'),
  ('Keep in mind', 'Colour is RGB: for litho/CMYK jobs, let your printer or InDesign convert the PDF. Whole-frame effects (Kaleidoscope, Mirror/tile, Polar, Pixel drag, VHS, Glitch, trails) print in one pass at a capped size; the dialog tells you. Long stacks of neighbour-sampling effects can differ by a few pixels right at the sheet edge, which falls inside the bleed and is trimmed. Photos print at their own resolution.'),
  ('Print treatments', 'The Print texture treatment adds paper, grain, ink spread and misregistration. Riso print and Halftone give screened, separated looks.'),
], [28*mm, W-28*mm])]

s += [Paragraph('8. Export', h2), tbl([
  ('PNG', 'The current frame at full output size.'),
  ('Video', 'An MP4 file, rendered frame by frame, so it’s exact and doesn’t need to run in real time. Chrome and Safari encode H.264, which Instagram, TikTok and LinkedIn accept. If a browser has no H.264 encoder, fxlab saves VP9 and tells you.'),
  ('Sequence', 'Numbered PNG frames in a zip, for After Effects, Premiere, Resolve or ffmpeg.'),
  ('Projects', 'Save writes a small .json file with your size, timeline, base and stack settings. Open restores it. Photos and video aren’t stored in the file, so drop them back in; images come back from Assets.'),
], [28*mm, W-28*mm])]

s += [Paragraph('Shortcuts', h2), Paragraph('<b>Space</b> play/pause · <b>Left/Right arrow</b> step one frame · <b>Home</b> back to start · double-click a parameter name to reset it', body)]

sec4 = [Paragraph('9. Add your own modules', h2),
      Paragraph('Open fxlab.html in a text editor and find the block headed <b>YOUR MODULES</b>, near the top of the script. Paste a block like the one below, save, and reload the page. The new module appears in the library with its controls built automatically.', body)]
ex = """FX.register({ id:'fx-my-tint', name:'My tint', cat:'fx',
  desc:'Tints the frame toward a colour.',
  params:[ R('amount','Amount',.5,0,1), C('color','Colour','#ff5a36') ],
  fs:`vec4 fx(vec2 uv){
    vec3 c = texture(uInput, uv).rgb;
    return vec4(mix(c, c * p_color, p_amount), 1.);
  }` });"""
ct = Table([[Preformatted(ex, code)]], colWidths=[W]); ct.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),CODEBG),('LEFTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
s += [KeepTogether(sec4 + [ct]), Spacer(1, 6), tbl([
  ('cat', 'source, transition, mix and generator make the base frame and read <b>uA</b> and <b>uB</b>. treatment, fx and overlay run in the stack and read <b>uInput</b>.'),
  ('params', 'R range · I whole number · C colour · T toggle · S select · X text · Col a data column. Number, colour, toggle and select params become uniforms named <b>p_&lt;id&gt;</b>.'),
  ('Roles', 'Colour params can hold role links (role:ink, role:ground, role:accent, role:accent2). Modules receive resolved values, so draw code never changes.'),
  ('Helpers', 'In Canvas 2D modules, <b>Sketch.rnd</b> gives seeded random numbers, <b>Sketch.ground</b> paints or keeps the ground, and <b>Sketch.paletteColor</b> picks from your palette. <b>Data.current()</b> is the loaded table; <b>Data.pick(name, index)</b> returns a column and <b>Data.at(column, u)</b> reads it at any point along its rows.'),
  ('Time', '<b>uProgress</b> is the eased transition (0 to 1). <b>uLoop</b> is the raw loop phase; drive motion with cos/sin(uLoop × TAU) so loops are seamless. <b>uRes</b> is the output size in pixels.'),
  ('Errors', 'If a shader doesn’t compile, the message and line number appear on the stage and the rest of the app keeps running. The comment at the top of the script lists every uniform and helper.'),
], [22*mm, W-22*mm])]
doc.build(s, onFirstPage=footer, onLaterPages=footer)

print('ok    guide →', OUT)
