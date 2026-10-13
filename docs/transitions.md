# Transition catalogue

The 192 transitions added in October 2026, by file. The 29 older ones live in `sources_transitions.js` and `library2/3/5.js`. Research behind them: gl-transitions (all 125), ffmpeg xfade (58 modes), Codrops and web motion libraries, the transition lists of Premiere, After Effects, Resolve, Final Cut, Keynote, PowerPoint and CapCut, plus original ideas from physics, print, optics, data and nature.

## Blends and light (`tr_blend.js`, 24)

- **Hue crossfade** `tr-hue-fade`: Crossfades through hue, saturation and value instead of RGB, so colours travel round the wheel rather than going muddy.
- **Greyscale dip** `tr-grey-dip`: A drains to grey, the greys cross, and B comes back up into colour.
- **Channel stagger fade** `tr-channel-fade`: Red, green and blue each crossfade on their own clock, so the frame passes through colour casts on the way to B.
- **Blend-mode bridge** `tr-blend-bridge`: A turns into a blend of A and B, holds there, then resolves into B.
- **Colour-distance reveal** `tr-colour-distance`: Pixels where A and B already agree switch first, and the most different areas follow last.
- **Difference-paced fade** `tr-diff-fade`: Each pixel fades at its own rate, set by how far A and B are apart there, so the dissolve runs unevenly across the frame.
- **Additive dissolve** `tr-additive`: Both images are added together, so the frame brightens through the middle instead of dipping.
- **Non-additive dissolve** `tr-nonadditive`: The brighter of the two images wins at each pixel, so B’s highlights break through first and its darks arrive last.
- **Film dissolve** `tr-film-dissolve`: Crossfades in light rather than in screen values, as an optical printer would, so the middle holds its brightness.
- **Highlights-first dissolve** `tr-tonal-dissolve`: A soft dissolve keyed on tone: the incoming highlights (or shadows) rise first and the rest of the range follows smoothly.
- **Subtractive dissolve** `tr-subtractive`: The two images subtract into each other, so the frame darkens and deepens through the middle.
- **Exposure flash** `tr-exposure-flash`: Exposure climbs until the highlights burn out to white, B is swapped in under the glare, then it comes back down.
- **Flash frame** `tr-flash-frame`: A hard cut hidden under a burst of white, a colour or a negative that decays into B.
- **Cross blur** `tr-cross-blur`: A drifts out of focus while it dissolves into an equally soft B, which then sharpens.
- **Bokeh dissolve** `tr-bokeh`: Both images melt out of focus into bright discs of light, then B pulls back into focus.
- **Light rays** `tr-light-rays`: The bright parts of both images throw rays out from a light point, peaking as A dissolves into B.
- **Light leak** `tr-light-leak`: Soft warm light spills across the frame and drifts, peaking over the cut, with a dissolve underneath.
- **Bloom dissolve** `tr-bloom`: Highlights swell into a soft glow and the exposure lifts, carrying A over into B before both settle.
- **Tinted wash** `tr-tint-wash`: A colour washes over both images through the dissolve without hiding them, like a gel in front of the lens.
- **Edge glow** `tr-edge-glow`: A strips down to glowing outlines on dark, the outlines cross into B’s, and B fills back in behind them.
- **Sheen sweep** `tr-sheen`: A soft band of light glides across at an angle and B is swapped in beneath it as it passes.
- **Ken Burns crossfade** `tr-ken-burns`: A keeps creeping in as it fades, and B arrives already moving and settles to its full frame.
- **Glow-edge dissolve** `tr-glow-dissolve`: B opens through soft noise with a clean glowing rim in two colours at the edge, light rather than burnt.
- **Spin flash** `tr-spin-flash`: A zooms in and turns slightly as it brightens to a flash, and B unwinds out of the light.

## Geometric and pattern wipes (`tr_wipes.js`, 26)

- **Barn door** `tr-barndoor`: B opens out from a centre line, or closes in from both edges, at any angle.
- **Bow-tie** `tr-bowtie`: Two triangles grow in from opposite edges and meet at their points.
- **Box wipe** `tr-boxwipe`: A frame-shaped box grows out of a corner, an edge or the centre, its corners rounding off as it fills.
- **Iris through colour** `tr-irisdip`: An iris closes on A over a flat colour, holds, then opens again on B.
- **Corner curve** `tr-cornercurve`: B sweeps in from a corner behind a curved front that hugs the two far edges last.
- **Rose wipe** `tr-rosewipe`: B blooms open through deep petals, with a second layer turning the other way.
- **Wobble iris** `tr-wobbleiris`: A soft-edged blob opens from a point, its outline wobbling as it grows, with an optional scorched rim.
- **Spiral wipe** `tr-spiralwipe`: B unrolls along a spiral ribbon from the centre out, or winds in from the edge.
- **Rings wipe** `tr-ringswipe`: Concentric rings each sweep round like a clock hand, alternate rings turning opposite ways.
- **Ring blinds** `tr-ringblinds`: Blinds bent into concentric rings or spokes, each slat opening from its middle in turn.
- **Checker wipe** `tr-checker`: Half the squares of a checkerboard wipe across, then the other half follow.
- **Comb wipe** `tr-combwipe`: Bands wipe or slide in from alternate sides and interlock like the teeth of a comb.
- **Random bars** `tr-randombars`: Full-width bars, or blocks, switch to B one by one in random order.
- **Box path** `tr-boxpath`: A grid of boxes fills with B along a path, spiralling in or out or snaking row by row.
- **Paint splatter** `tr-splatter`: Ragged splats of B land one after another, spread and run together until A is covered.
- **Bubble reveal** `tr-bubbles`: Circles of B open at scattered points, swell and merge until they fill the frame.
- **Gradient wipe** `tr-gradientwipe`: B arrives through a built-in gradient map, from the darkest tone of the map to the lightest.
- **Staircase sweep** `tr-staircase`: A diagonal wipe built from thin staggered lines, so the edge climbs like a staircase.
- **Jaws** `tr-jaws`: A splits along a toothed line and the two halves pull apart to show B.
- **Grid iris** `tr-gridiris`: Every cell of a grid opens on its own, as doors, a shutter, a clock hand or a corner box, in a wave.
- **Chevron wipe** `tr-chevron`: A pointed front pushes across with a few chevron stripes of B running ahead of it.
- **Wedge wipe** `tr-wedge`: A wedge opens both ways at once from a centre line until it closes behind the far side.
- **Crosshatch spread** `tr-crosshatch`: B shoots out from a point along random horizontal and vertical lines, then the gaps fill in.
- **Noise-broken wipe** `tr-noisewipe`: A straight wipe whose front breaks up into islands and inlets of noise as it passes.
- **Shape zoom-through** `tr-shapezoom`: A shape opens in A and the camera flies through it into B.
- **Light wipe** `tr-lightwipe`: A glowing front opens out as a circle, doors, a box or a diamond, lighting the edge where A turns into B.

## Moves and camera (`tr_moves.js`, 21)

- **Squeeze to a line** `tr-squeeze-line`: A squeezes down to a thin bright line and goes, with the colour channels tearing slightly as it closes.
- **Stretch** `tr-axis-stretch`: B stretches in from one side while A squashes up to make room, so the two share the frame until A is gone.
- **Split slide** `tr-split-slide`: The frame splits into two halves that slide in opposite directions, taking A away or bringing B in.
- **Scaled push** `tr-scaled-push`: Both pictures pull back a little while B pushes A out of frame, then B settles to full size.
- **Picture fly-off** `tr-card-fly`: A shrinks into a card with a soft shadow, then flies off or tucks into a corner to leave B.
- **Scale and fade** `tr-scale-fade`: A eases back and fades while B settles in from slightly larger, or the picture zooms in before it hands over.
- **Whip pan** `tr-whip-pan`: The camera whips sideways in a blur of motion, A streaks out and B lands in place.
- **Spin blur** `tr-spin-blur`: The frame spins about its centre in a rotary blur and comes out of the turn on B.
- **Dutch roll** `tr-dutch-roll`: The camera rolls onto a tilt while it pushes across, then levels out on B.
- **Zoom punch** `tr-zoom-punch`: The camera punches in on A and keeps going, so B arrives small and grows into the frame, or the reverse.
- **Spin away** `tr-spin-away`: A spins and shrinks to nothing over B, or B spins in out of the centre, like the old newspaper spin.
- **Mosaic pan** `tr-mosaic-pan`: The camera pulls back over a wall of tiles, pans across a few of them and lands on B.
- **Bounce drop** `tr-bounce-drop`: B drops in over A and bounces to rest, casting a soft shadow that tightens as it lands.
- **Fling** `tr-fling`: A is flicked off the frame along a curve, trailing a motion blur, and leaves B underneath.
- **Parallax slide** `tr-parallax-slide`: A slides out while its picture lags behind inside the frame, and B slides in the same way, like a parallax slideshow.
- **Stacked card** `tr-stacked-card`: B slides in on top while A steps back, darkens and rounds its corners, like a card going under a stack.
- **Card carousel** `tr-card-carousel`: A shrinks into a card, slides along a row as B comes in beside it, and B grows back to full frame.
- **Velocity stretch** `tr-velocity-stretch`: A push where both pictures stretch along the move at full speed and snap back as they land, with the seam bowing like a sheet.
- **Flag sheet** `tr-flag-sheet`: The two pictures travel across like sheets of fabric, rippling with a travelling wave and lit across the folds.
- **Match zoom** `tr-match-zoom`: Zooms into a point on A and out of a matching point on B, with the two points held together through the dissolve.
- **Window grow** `tr-window-grow`: B opens as a small window and grows to fill the frame while its picture settles inside, as on a scrolling hero or a thumbnail opening.

## Panels and staggers (`tr_panels.js`, 13)

- **Panel cover** `tr-panel-cover`: Solid panels sweep across to cover A, then carry on off the far edge to uncover B.
- **Shutter split** `tr-shutter-split`: The frame splits down the middle and the halves slide apart, close over it, or close through a colour.
- **Strip slide** `tr-strip-slide`: B arrives in strips that slide in one after another, from alternating sides if you like, at any angle.
- **Band rise** `tr-band-rise`: The frame is cut into bands and inside each one B rises into place behind its own edge, band after band.
- **Shape overlays** `tr-shape-overlay`: Layers of colour rise with a soft, uneven curved edge to cover A, then sweep on to leave B.
- **Drip cover** `tr-drip-cover`: Thick drips run down the frame and merge, through a colour or straight into B.
- **Skew panel** `tr-skew-panel`: A slanted panel sweeps across and B follows it in, sheared at first and straightening as it lands.
- **Curtains** `tr-curtain-draw`: A becomes two cloth curtains that gather into folds as they are drawn aside to show B.
- **Shred** `tr-shred-fall`: A is cut into strips that drop away one by one, tipping as they fall, to leave B.
- **Tile shrink** `tr-tile-shrink`: A breaks into a grid of tiles that shrink and turn away in a wave, or B arrives as tiles that grow to fill the frame.
- **Honeycomb pop** `tr-honeycomb`: Hexagonal cells pull in and pop back out as B, rippling out from a point.
- **Glitter** `tr-glitter`: Small diamond or triangle facets flip over from A to B in a ragged wave, catching the light edge-on.
- **Triangle shards** `tr-tri-shards`: A breaks into a lattice of triangles that spin down to nothing at random, and B grows back out of the same lattice.

## 3D (`tr_3d.js`, 17)

- **Card flip** `tr-card-flip`: The whole frame turns over like a card in perspective, with A on the front and B on the back.
- **Doors** `tr-gate-doors`: A splits down the middle and swings open away from you like a pair of doors, while B comes forward through the doorway.
- **Book flip** `tr-book-flip`: Half of A lifts on a centre spine and turns over like a stiff page, carrying half of B on its back.
- **Swing** `tr-hinge-swing`: A swings away on a hinge along one edge until it is edge on, showing B beneath it; drape lets the sheet ripple as it goes.
- **Tilt back** `tr-tilt-back`: A tips back on its bottom edge and fades into the dark while B tips up out of it, with an optional sheen passing over both.
- **Revolving door** `tr-revolving-door`: A and B are two wings of a revolving door turning on an upright axis: A swings away into the depth as B swings round into place.
- **3D swap** `tr-card-swap`: A and B stand as cards on a glossy floor: A turns away and slides off to one side as B swings round from the other and comes forward.
- **Stereo cards** `tr-stereo-cards`: A shrinks into a rounded card, the next card on the reel turns into place carrying B, and B grows back to fill the frame.
- **Conveyor** `tr-conveyor`: A steps back onto a rail as a card, the rail carries it off while B comes along behind it, and B steps forward to fill the frame.
- **Orbit** `tr-orbit`: A and B ride a ring that turns in depth, so A travels round and away while B comes round to the front.
- **Origami** `tr-origami`: A is folded in half, then in half again, like a sheet of paper, and the folded square flies off to leave B.
- **Fan fold** `tr-fan-fold`: A pleats into a row of hinged panels that fold up like a fan and collapse against one edge, uncovering B.
- **Ribbon twist** `tr-ribbon-twist`: The frame turns over in a twisting ribbon that runs across it, A on one side and B on the other, either smooth or in slats.
- **Clone spin** `tr-clone-spin`: A pulls back into a grid of small copies that spin on the spot, turn into copies of B, and gather back into one frame.
- **Cube grid** `tr-cube-grid`: The frame is a wall of small cubes; each one turns a quarter to bring a face of B round, in a wave across the grid.
- **Corner roll** `tr-corner-roll`: A swings out of the frame on a pivot at one corner, like a door turning flat on the wall, and B is there behind it.
- **Reflection floor** `tr-reflection-floor`: A steps back onto a glossy floor and sinks through it while B rises up out of the floor in its place, then steps forward.

## Distortion (`tr_warp.js`, 19)

- **Mosaic crossfade** `tr-mosaic-fade`: The picture coarsens into square or hexagonal cells, crossfades while it is at its coarsest, then sharpens up as B.
- **Swirl** `tr-swirl`: The middle of the frame winds up like water down a drain, and B unwinds out of it.
- **Kaleidoscope through** `tr-kaleido-through`: A folds into a turning kaleidoscope, the images change over while it is fully folded, and it opens out again as B.
- **Fly eye** `tr-flyeye`: The frame breaks into a field of tiny lenses with split colour edges, and B comes into focus through them.
- **Colour morph** `tr-colour-morph`: Each picture is pushed around by its own colours, so the two slide into one another along their light and shade.
- **Displacement crossfade** `tr-displace-fade`: A pattern pulls A one way and pushes B in from the other while they fade, like the hover effect on a portfolio site.
- **Stripe shear** `tr-stripe-shear`: Thin strips each slip by their own ramp, so A shears apart in a fine sawtooth and B settles back into place.
- **Revolve** `tr-revolve`: The frame spins, swells and bends around the middle with motion blur, and comes out of the turn as B.
- **Zoom rings** `tr-zoom-rings`: Concentric rings each zoom at their own rate and change over one after another, so the frame telescopes into B.
- **Dream wave** `tr-dream-wave`: The picture wobbles in a slow wave and softens to haze as it drifts into B, the old dream-sequence dissolve.
- **Zoom sweep** `tr-zoom-sweep`: A front sweeps across the frame; behind it A has rushed away into the distance and B has flown up out of it.
- **Lens pass-through** `tr-lens-pass`: A magnifying lens crosses the frame, showing B enlarged inside it and leaving B behind it as it goes.
- **Lens distortion** `tr-lens-distort`: A swells into a fisheye with colour fringing, hands over at the peak, and B relaxes back to flat.
- **Glass wipe** `tr-glass-wipe`: A soft wipe whose edge behaves like poured glass, bending both pictures by their own light and shade as it passes.
- **Curl flow** `tr-curl-flow`: A swirls away along a slow current like paint stirred in water, and B is drawn back out of the same current.
- **Droplet** `tr-droplet`: A drop lands and one ring spreads out across the frame, bending the picture at its crest and leaving B behind it.
- **Flow morph** `tr-flow-morph`: A and B nudge their shapes toward each other while they dissolve, a soft morph that hides a jump cut.
- **Sliced offsets** `tr-slice-offset`: The frame is cut into bands that sway sideways in a rolling wave, and each band changes to B as it swings back.
- **Stretch reveal** `tr-edge-stretch`: B wipes in while its leading row of pixels is dragged out ahead of it in long, uneven streaks over A.

## Signal, fracture and print (`tr_signal.js`, 15)

- **Chromatic dissolve** `tr-chroma-dissolve`: A crossfade where both pictures split into colour fringes that peak in the middle, A pulling one way and B the other.
- **RGB split slide** `tr-rgb-slide`: B pushes A out of frame, with red, green and blue running at slightly different speeds so the fast middle fringes.
- **TV static cut** `tr-tv-static`: A hard cut hidden behind a burst of television static, in coloured blocks or fine grey snow.
- **Static band wipe** `tr-static-band`: A straight wipe with a band of static riding the edge, widest in the middle of the move.
- **Lost signal** `tr-lost-signal`: The picture loses its signal for a moment: lines tear sideways, colour drains and scanlines show, and B comes back in its place.
- **VHS roll** `tr-vhs-roll`: The tape loses vertical hold and the picture rolls, with a black blanking bar, until B settles into place.
- **Flicker glitch** `tr-flicker-glitch`: The cut flickers back and forth between A and B a few times before it commits, with colour ghosts and shifted blocks on each flash.
- **Datamosh strips** `tr-datamosh-strips`: Bars and slits of the frame tear sideways and leave stale copies of A behind, as if the file had been corrupted between the two shots.
- **Shatter** `tr-shatter`: A cracks from an impact point and breaks into pieces that spin and fall away to show B behind.
- **Crush** `tr-crush`: A crumples into a faceted ball of paper and shrinks away to a point, leaving B.
- **Blow away** `tr-blow-away`: A breaks into fine particles that lift off in a gust, edge first, and drift away over B.
- **Wind streaks** `tr-wind-streaks`: B blows in on fine horizontal streaks that run ahead of the edge, each line at its own pace, smearing the picture as it passes.
- **Halftone morph** `tr-halftone-morph`: The picture breaks into a halftone screen whose dots swell until they touch, swap to B underneath, and shrink back into the new photograph.
- **Glyph grid** `tr-glyph-grid`: The frame turns into a grid of small marks, bars, dots or blocks set by brightness, which scramble and resolve into B.
- **Comic pop** `tr-comic-pop`: A turns to flat print colour with ink lines and dots, a starburst punches through, and B arrives the same way before settling back to a photograph.

## Physics and optics (original) (`tr_physics.js`, 21)

- **Lens swell** `tr-lens-swell`: A glass lens drifts across A showing B magnified through it, then swells until B is all that is left.
- **Event horizon** `tr-event-horizon`: A small black hole passes through and bends A into a bright ring, and B is waiting on the other side of the horizon.
- **Caustic reveal** `tr-caustic`: Light through rippling water plays over A, and B appears where the light pools brightest.
- **Field lines** `tr-field-lines`: B is drawn in along magnetic field lines, which thicken until they meet.
- **Crystal growth** `tr-crystal-growth`: B crystallises in grain by grain, each grain growing from its own seed until they lock together.
- **Heat shimmer** `tr-heat-shimmer`: The air shimmers like tarmac in summer, and B rises through the haze.
- **Soap film** `tr-soap-film`: A soap film slides over A in iridescent swirls, thins out and pops, and B is behind it.
- **Chladni plate** `tr-chladni`: B gathers like sand on a vibrating plate, settling into symmetric nodal patterns that thicken until they fill the frame.
- **Turing bloom** `tr-turing`: B grows in as a living labyrinth, like coral or animal markings, that closes up into the full image.
- **Moiré beat** `tr-moire-beat`: Two fine line screens slide over each other, and B appears through the broad moiré fringes they make.
- **Polariser** `tr-polariser`: Like turning a polarising filter: A dims, stress colours bloom in rainbow streaks, and B comes through as the filter turns.
- **Rack focus** `tr-rack-focus`: The focus pulls off A into soft shaped bokeh, and B racks into sharpness.
- **Focal plane sweep** `tr-focal-sweep`: The focus travels back through the scene, and each part changes to B as the focal plane passes through it.
- **Anamorphic flare** `tr-anamorphic-flare`: A long blue anamorphic streak sweeps across, overexposes the frame and leaves B behind.
- **Rolling shutter whip** `tr-rolling-shutter`: A whip pan on a cheap sensor: the picture skews diagonally as it flicks across to B.
- **Shutter drag** `tr-shutter-drag`: A long exposure smears A into light trails as it drifts off, and B ghosts in through the same exposure.
- **Slit-scan corridor** `tr-slit-scan`: The middle of the frame races ahead in time, so A stretches into streaks and B pulls through.
- **Lenticular flip** `tr-lenticular`: Like tilting a ridged lenticular postcard: A flips to B strip by strip, with that glossy ribbed sheen.
- **Prism sweep** `tr-prism-sweep`: A large glass prism slides across the frame, splitting the light into a spectrum as it carries B in behind it.
- **Kaleidoscope settle** `tr-kaleido-settle`: A turns into a kaleidoscope, the pattern rotates, and when it unfolds again it is B.
- **Fresnel lens** `tr-fresnel-lens`: A flat Fresnel lens slides over A and breaks it into stepped rings, which straighten out as B.

## Print and craft (original) (`tr_craft.js`, 14)

- **Screenprint pass** `tr-screenprint`: B is printed onto fresh paper one ink at a time, each pulled across by a squeegee and slightly out of register until it settles.
- **Riso drum** `tr-riso-drum`: A fresh sheet feeds in over A carrying B in grainy, streaky spot ink, the second drum lays its colour on top, and then the grain clears to the photograph.
- **Blind deboss** `tr-deboss`: A turns to blank paper with B pressed into it, and then the ink floods into the impression, darkest parts first.
- **Cyanotype exposure** `tr-cyanotype`: A fades to a blue sun print, B exposes in Prussian blue on brush-coated paper, shadows first, and then its colour washes back in.
- **Darkroom tray** `tr-darkroom`: Under a red safelight A bleaches to blank paper and B develops out of it, shadows first, while the developer sloshes across the tray.
- **Paper fold** `tr-paper-fold`: A folds in half along a crease like a sheet of paper, then in half again, and the folded packet slides away to leave B.
- **Accordion pleat** `tr-accordion-pleat`: A concertinas into pleats and folds away to one side while B unfolds from the other.
- **Loom** `tr-loom`: B is woven into A thread by thread, each weft passing over and under the warp before the cloth relaxes into B.
- **Tesserae** `tr-tesserae`: A sets into a mosaic of stone tiles, the tiles turn over one by one to B, and then the grout sinks away into the photograph.
- **Leaded light** `tr-leaded-light`: B lights up pane by pane like stained glass, spreading out from the centre of the window, and then the leading melts away.
- **Cross stitch** `tr-cross-stitch`: B is stitched in row by row as small coloured crosses on cloth, and then the stitches resolve into the photograph.
- **Marbled drop** `tr-marbled-drop`: Drops of B land on A as if it were floating marbling ink, pushing A outward into fine rings, until the last drop covers the frame.
- **Ebru comb** `tr-ebru-comb`: Stripes of B are laid into A and combed through, like Turkish paper marbling, into feathered chevrons that settle into B.
- **Engraving relay** `tr-engraving-relay`: A turns into a banknote-style engraving, the hatching turns and redraws itself as B, and then the colour comes back.

## Data, nature, time and design systems (original) (`tr_systems.js`, 22)

- **Contour terraces** `tr-contour-terraces`: A is drawn as a contour map of its own tones, then every band fills with B at once, like terraces flooding.
- **Hilbert path** `tr-hilbert-path`: B is laid in along one unbroken space-filling curve that snakes through the whole frame without crossing itself.
- **Quadtree** `tr-quadtree`: A breaks down into big flat blocks wherever there is little detail, then B refines back in square by square.
- **Rule 90 bloom** `tr-rule-ninety`: B grows down the frame as a Sierpinski triangle of cells, generation by generation, then the gaps fill in.
- **Line drawing and wash** `tr-sketch-wash`: A fades to paper, B is sketched in as pen lines, then a watercolour wash floods colour into it.
- **Posterise relay** `tr-posterise-relay`: A drops colour levels step by step down to a few tones, cuts to B at its starkest, then B builds back up to full colour.
- **Duotone bridge** `tr-duotone-bridge`: Both images pass through two brand colours, so the cut happens in duotone and colour returns on B.
- **Pinscreen** `tr-pinscreen`: Thousands of pins push in and out, casting shadows that draw A, then B, like an old pinscreen.
- **Frost and thaw** `tr-frost-thaw`: Frost creeps in from the edges and freezes A over, then thaws in clear patches to show B.
- **Rain on glass** `tr-rain-glass`: Raindrops land on the glass, each holding a tiny upside-down B, until they run together and B is everywhere.
- **Tide line** `tr-tide-line`: B comes in like a tide, surging up the beach and drawing back a few times, leaving wet sand before it covers everything.
- **Craquelure** `tr-craquelure`: A dries and cracks like old varnish, the plates curl and drop away, and B is underneath.
- **Growth rings** `tr-growth-rings`: B grows out ring by ring like the rings of a tree, each ring sweeping round before the next begins.
- **Leaf veins** `tr-leaf-veins`: B flows in through a network of leaf veins, from the midrib out, then fills the small cells between them.
- **Smoke lift** `tr-smoke-lift`: A lifts off the page like smoke, curling upward and thinning to show B.
- **Duty cycle** `tr-duty-cycle`: A and B strobe against each other, with B holding a little longer on each pulse until it is all that is left. Never more than three pulses a second.
- **Cast shadow** `tr-cast-shadow`: A simple shape sits in the frame as the light drops towards it, and its lengthening shadow carries B across the whole frame.
- **Grid reflow** `tr-grid-reflow`: The columns of A narrow and give way as the columns of B open up beside them, like a responsive grid reflowing.
- **Baseline set** `tr-baseline-set`: B is set in line by line along a baseline grid, like type being set, without any letters.
- **Modular fill** `tr-modular-fill`: The frame divides into a modular grid of different-sized fields, and each one brings B in from its own direction.
- **Quasicrystal** `tr-quasicrystal`: A never-repeating lattice of rosettes spreads out from the centre, B fills its cells, then the lattice lines fade.
- **Truchet flow** `tr-truchet-flow`: B flows through the frame along a maze of curving tubes made from quarter-circle tiles, then the tubes swell and merge.
