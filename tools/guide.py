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
s += [Paragraph('fxlab', h1), Paragraph('A browser-based lab for transitions, image treatments, masking, generative visuals and effects, with exports sized for social.', sub)]

s += [Paragraph('1. Open it', h2),
      Paragraph('There is nothing to install. Put <b>fxlab.html</b> anywhere, for example a Tools folder, and double-click it. It opens in your default browser and runs offline.', body),
      Paragraph('Use a current <b>Chrome</b> or <b>Safari</b>; Edge and Firefox also work. Hardware acceleration must be on, because fxlab runs on WebGL2. In Chrome, check Settings, System, “Use graphics acceleration when available”.', body)]

s += [Paragraph('2. Make something', h2), tbl([
  ('Size', 'Pick a preset top left, such as Instagram 4:5 or Story/Reel 9:16, or type your own size. Turn on Safe zones to see where platform UI will sit.'),
  ('Prepare', 'Drop images or video onto the stage: the first file loads into A and the second into B. You can also click a thumbnail on the right. Each source has Fill/Fit, Zoom and X/Y; double-click a slider to reset it. Prepare A/B can add Treatments or Reframe to that source before it is combined.'),
  ('Combine', 'Choose one module from Sources, Transitions, Mix &amp; mask or Generators. This makes the starting frame from A and B.'),
  ('Finish', 'Add Treatments, Effects, Overlays, type or logos. They run in order on the combined frame. Drag a card header to reorder. The eye turns a layer off without deleting it. The icons duplicate and remove.'),
  ('Timeline', 'Length sets the loop. A → B plays once; A → B → A returns to the start. Easing and Hold shape transitions, and the curve on the timeline shows the result.'),
  ('Preview', 'Lower preview quality (35–50%) keeps playback smooth. Exports always render at full size.'),
  ('Transparency', 'Every colour control has an opacity slider next to it, plus a transparent swatch. Tick <b>Transparent background</b> under Prepare and anything showing the letterbox colour becomes see-through; the stage shows a checkerboard. PNG and PNG sequence exports then carry an alpha channel. MP4 can’t hold transparency, so use a PNG sequence for editing software.'),
  ('Type &amp; logos', 'Kinetic type (42 modules) and Logo &amp; brand (13) add to Finish. Set Ground to Colour for a clean background, or Over frame to sit over your image. In text, wrap words in *stars* for Emphasis.'),
  ('Outline type', 'Morph, Liquid type, Outline dots and Type specimen work on the letter outlines themselves, traced from any font. The first frame with new letters can take a moment while outlines are traced; after that they are cached.'),
  ('Variable fonts', 'Drop a variable font into Assets and it gets a VAR badge. Variable axes and Type specimen then use its real weight and width axes; other fonts get a close imitation.'),
  ('Generators', 'Creative-coding bases: flow fields, ink bleed, cellular automata, interference, blobs, a raymarched 3D solid, spirograph orbits, networks, op stripes, spirals, and Scribble, which redraws image A as pen work. Feedback-based ones (flow, ink, automata) build up over a second or two — let them run.'),
  ('Textures', 'Treatments that make things physical: surface (canvas, linen, concrete, crumpled paper, metal, scratches), cross-hatch engraving, painterly, letterpress, foil and Brand palette, which snaps any image to your brand colours.'),
  ('Randomise', 'Picks a random Combine and Finish. Prepare lists stay put. When you have a palette, it uses your brand colours.'),
], [28*mm, W-28*mm])]

s += [Paragraph('3. Fonts, logos and colours', h2),
      Paragraph('Open the <b>Assets</b> tab on the left. Drop in font files, logos, or a whole brand-asset zip; fxlab unpacks the zip and keeps what it can use.', body), tbl([
  ('What it keeps', 'Fonts: OTF, TTF, WOFF, WOFF2. When the same font comes in several formats, it keeps the desktop OTF/TTF. Logos: SVG, PNG, JPG, WebP; SVG wins over a PNG of the same logo. Illustrator, EPS and PDF files are skipped.'),
  ('Palette', 'Single-colour SVG logos add their colour to the palette automatically, named from the file (for example “Rally Red”). You can also add, rename and remove colours. Palette swatches appear under every colour control.'),
  ('Fonts', 'Every font and text module lists your fonts first. Star a font to make it the default for new type modules.'),
  ('Logos', 'Hover a logo for three actions: <b>A</b> or <b>B</b> uses it as a source (transparent areas take the Letterbox colour), and <b>+</b> adds it as a Logo layer. Logo modules also have a Logo picker.'),
  ('Where they live', 'In this browser on this computer, not inside fxlab.html, so licensed fonts stay with you. Projects remember which fonts and logos they use.'),
  ('Kits', '<b>Save kit</b> downloads fonts, logos and palette as one .fxkit file. Drop it into Assets in another browser or on another machine to restore everything. If a browser won’t keep assets for local files, the Assets tab says so; open your kit each session.'),
], [28*mm, W-28*mm])]

s += [Paragraph('4. Build the identity system', h2),
      Paragraph('The <b>System</b> tab turns your assets into a system. Modules link to brand roles instead of fixed values, so changing a role restyles everything that uses it. When you import brand assets, fxlab sets up a starting system for you.', body), tbl([
  ('Colourways', 'Sets of four roles: Ground, Ink, Accent and Accent 2. Click a strip to switch colourway; every linked module follows. Contrast between ink and ground is shown as you edit.'),
  ('Linking', 'In any colour control, the I, G, A and A2 chips link it to a role (the label turns mint and shows an arrow). Picking a fixed colour unlinks it. Font and logo pickers have Brand roles at the top: Display, Text, Primary logo, Symbol, Wordmark.'),
  ('Motion', 'Brand easing (with a custom curve option), slant (how far things lean into their speed) and beat (pulses per loop). Modules and the timeline set to Brand use them.'),
  ('Looks', 'Save the current composition as a look; apply, update or delete looks from their thumbnails. 17 starter looks teach how primitives combine (mix, matte, transition under a stack, generator as a base, type on an image, logo as form, Prepare A/B then combine…). They link to your roles, so they come out on-brand.'),
  ('Export', '<b>Export looks × sizes × colourways</b> renders every combination, as MP4s or PNG stills, into one zip. Looks, colourways and roles travel inside .fxkit kits.'),
], [28*mm, W-28*mm])]

s += [Paragraph('5. Print', h2),
      Paragraph('Choose a print size from the size menu (A6–A1, US Letter, Tabloid, posters, DL, business cards) or click <b>Print…</b>. The stage becomes the full sheet including bleed, with the trim line dashed and the safe area dotted.', body), tbl([
  ('Document', 'Set trim size in mm, orientation, bleed (3 mm is standard; 2 mm for cards) and a safe margin. Keep text and logos inside the dotted line.'),
  ('PDF', 'Exports at 150–600 dpi, rendered in tiles so large posters work, with TrimBox and BleedBox set. Crop marks and a slug line are optional.'),
  ('PNG', 'Same render as a PNG with its dpi recorded, for placing in InDesign or sending to a printer.'),
  ('Separations', 'Pick up to four inks and a paper colour. fxlab exports one greyscale plate per ink (black = full ink), plus a composite preview and an inks list, ready for riso or screen printing. Turn on ink preview (with optional misregistration) to see the result on the stage first.'),
  ('Keep in mind', 'Colour is RGB: for litho/CMYK jobs, let your printer or InDesign convert the PDF. Whole-frame effects (Kaleidoscope, Mirror/tile, Polar, Pixel drag, VHS, Glitch, trails, Extruded, Collage) print in one pass at a capped size; the dialog tells you. Long stacks of neighbour-sampling effects can differ by a few pixels right at the sheet edge, which falls inside the bleed and is trimmed. Photos print at their own resolution.'),
  ('Print looks', 'Starter looks include a specimen poster and a riso pattern. The Print texture treatment adds paper, grain, ink spread and misregistration.'),
], [28*mm, W-28*mm])]

s += [Paragraph('6. Export', h2), tbl([
  ('PNG', 'The current frame at full output size.'),
  ('Video', 'An MP4 file, rendered frame by frame, so it’s exact and doesn’t need to run in real time. Chrome and Safari encode H.264, which Instagram, TikTok and LinkedIn accept. If a browser has no H.264 encoder, fxlab saves VP9 and tells you.'),
  ('Sequence', 'Numbered PNG frames in a zip, for After Effects, Premiere, Resolve or ffmpeg.'),
  ('Projects', 'Save writes a small .json file with your size, timeline, base and stack settings. Open restores it. Photos and video aren’t stored in the file, so drop them back in; fonts and logos come back from Assets.'),
], [28*mm, W-28*mm])]

s += [Paragraph('Shortcuts', h2), Paragraph('<b>Space</b> play/pause · <b>Left/Right arrow</b> step one frame · <b>Home</b> back to start · double-click a parameter name to reset it', body)]

sec4 = [Paragraph('7. Add your own modules', h2),
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
  ('params', 'R range · I whole number · C colour · T toggle · S select · X text · F font · L logo. Number, colour, toggle and select params become uniforms named <b>p_&lt;id&gt;</b>.'),
  ('Roles', 'Params can hold role links (role:ink, role:display, role:symbol). Modules receive resolved values, so draw code never changes.'),
  ('Outlines', '<b>Glyphs.layout(ctx, P, text, size)</b> returns every glyph with its traced outline points, for your own outline effects.'),
  ('Helpers', 'In Canvas 2D modules, <b>Util.family(P)</b> gives the chosen font and <b>Assets.image(P.logo)</b> the chosen logo. <b>KT</b> has text layout, fit-to-width, stagger and easing helpers; <b>Brand</b> draws tinted logos and picks palette colours.'),
  ('Time', '<b>uProgress</b> is the eased transition (0 to 1). <b>uLoop</b> is the raw loop phase; drive motion with cos/sin(uLoop × TAU) so loops are seamless. <b>uRes</b> is the output size in pixels.'),
  ('Errors', 'If a shader doesn’t compile, the message and line number appear on the stage and the rest of the app keeps running. The comment at the top of the script lists every uniform and helper.'),
], [22*mm, W-22*mm])]
doc.build(s, onFirstPage=footer, onLaterPages=footer)

print('ok    guide →', OUT)
