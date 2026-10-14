# Transition catalogue

The 302 transitions added in October 2026, by file: 192 in the first round and 110 in the second. The 29 older ones live in `sources_transitions.js` and `library2/3/5.js`. Research behind them: gl-transitions (all 125), ffmpeg xfade (58 modes), Codrops and web motion libraries, the transition lists of Premiere, After Effects, Resolve, Final Cut, Keynote, PowerPoint and CapCut, plus original ideas from physics, print, optics, data and nature.

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

## Round 2

110 more, invented rather than collected: each one is a new rule for how A becomes B, and many are driven by the two pictures themselves (their tones, edges, colours and structure), so they look different on every pair.

## Film and animation (`tr_cinema.js`, 18)

- **Dolly zoom** `tr-dolly-zoom`: The subject holds its size while everything around it looms towards the lens, and B comes out of the reverse move.
- **Step printing** `tr-step-print`: The push is printed in steps, each frame held and smeared into the next, so the move stutters and trails like a step-printed chase.
- **Bi-pack matte** `tr-bipack-matte`: B is printed in through a high-contrast matte cut from its own tones, and the matte and counter-matte never quite line up, so every edge carries a matte line.
- **Stop trick** `tr-stop-trick`: The camera stops, part of the picture is swapped, the camera starts again: B replaces A in a few hard jumps, each with a jolt and a flare where things changed.
- **Glass shot** `tr-glass-shot`: B is painted on a pane of glass in front of the lens: it comes in as a matte painting along a soft, wandering seam, then the painting goes live.
- **Multiplane** `tr-multiplane`: A comes apart into painted planes by tone, the camera trucks through them so each plane sweeps past at its own speed, and B is the backdrop behind.
- **Hidden cut** `tr-hidden-cut`: The camera drifts into the darkest part of A until shadow fills the frame, and the cut is hidden there before it pulls out of the darkest part of B.
- **Rotoscope** `tr-rotoscope`: Both pictures are traced into flat cels, and the cel shapes melt from A’s outlines into B’s before the photograph returns.
- **Silhouette and gel** `tr-silhouette-gel`: A drops to a black silhouette against a coloured gel, the silhouette reshapes into B’s dark shapes as the gel changes colour, and B is lit back up.
- **Zoetrope** `tr-zoetrope`: The picture is seen through the slits of a spinning drum, each slit a few frames further on, so the change from A to B runs across the frame.
- **Metric montage** `tr-metric-montage`: A and B are intercut in ever shorter shots that slow again at the end, and each cut reframes the picture, like a Soviet montage sequence.
- **Ratio change** `tr-ratio-change`: The frame closes down to a wide letterbox, B arrives anamorphically squeezed and opens out across it, then the frame opens back to full height.
- **Onion skin** `tr-onion-skin`: On the animator’s lightbox A turns into a red pencil drawing, B is traced over it in blue, and B is painted back in once the sheets line up.
- **Changeover** `tr-changeover`: Two projectors share the screen: A’s runs down flickering as its lamp goes warm, while B’s comes up out of rack, frame lines rolling past, until it is racked into place.
- **Painted emulsion** `tr-painted-emulsion`: Every frame is painted over by hand in dyes taken from B, each one differently, flickering between the two pictures until B comes through.
- **Scratched leader** `tr-scratched-leader`: A sinks into black emulsion and B is scratched back through it in lines that run along the film and boil from frame to frame, B’s highlights first.
- **One-point** `tr-one-point`: A folds into perfect mirror symmetry as the camera pushes down the centre line, and B unfolds out of the same symmetry.
- **Rear projection** `tr-rear-projection`: B comes up as a back-projected plate behind A’s foreground, soft and hot in the middle, until the foreground walks off and the plate becomes the picture.

## Geometry and maths (`tr_maths.js`, 12)

- **Droste descent** `tr-droste-descent`: B opens as a picture hanging inside A, with B inside B again, and the camera falls through the frame into it.
- **Loxodrome** `tr-loxodrome`: Both pictures stream along spiralling lines from a source to a sink: A drains into its brightest area while B pours out of its own.
- **Riemann roll** `tr-riemann-roll`: The picture is treated as a sphere seen from above: it rolls over, A slides away to the far side and B comes round from the point at infinity.
- **Apollonian gasket** `tr-apollonian`: The frame is packed with kissing circles, each tangent to its neighbours, and B fills them from the largest down to the smallest.
- **Julia matte** `tr-julia-matte`: The two pictures’ average colours choose a Julia set; B closes in from far outside it, along its filigree edge, and the set itself goes last.
- **Hybrid image** `tr-hybrid-image`: B’s fine detail arrives first over A’s broad shapes and colour, then the broad shapes hand over too, like a hybrid image seen from further and further away.
- **Hyperbolic glide** `tr-hyperbolic-glide`: We pull back to find A is one tile of an endless hyperbolic floor in a Poincaré disc, glide across to the B tile next door, and settle into it.
- **Globe turn** `tr-globe-turn`: The flat picture is read as a world map and curls up into a globe, the globe turns, and B unrolls from its far side as a map again.
- **Vanishing line** `tr-vanishing-line`: A lies down as an endless floor and B hangs as an endless ceiling; the horizon where both run to infinity crosses the frame.
- **Phyllotaxis** `tr-phyllotaxis`: The frame becomes a sunflower head, seeds set by the golden angle; B fills it seed by seed from the middle outward, with its bright seeds a little ahead.
- **Voronoi to Delaunay** `tr-voronoi-dual`: A settles into flat Voronoi cells, each cell flips to its dual Delaunay triangles coloured from B, and the facets resolve into B.
- **Cat map** `tr-cat-map`: Arnold’s cat map treats the frame as a torus: A is stretched and folded around it into fine diagonal ribbons, and B unfolds out of ribbons running the other way.

## Living systems (`tr_life.js`, 14)

- **Cell division** `tr-mitosis`: A rounds into a cell and divides, again and again, and B shows in the gaps between the daughter cells until they shrink away.
- **Passing cloud** `tr-passing-cloud`: Dark bands ripple across the skin like a cuttlefish’s passing cloud, its pigment sacs swelling and closing, and the skin under them turns from A to B.
- **Murmuration** `tr-murmuration`: A breaks into a flock of specks that gathers into a single turning murmuration over the sky, then spreads back out as B.
- **Bioluminescence** `tr-bioluminescence`: A sinks into a night sea, B is traced in glowing plankton where its light and edges are, and then B surfaces through the glow.
- **Diatom** `tr-diatom`: A turns to the glass shell of a diatom, rows of pores open from the centre out in radial symmetry, and B shows through them until the glass is gone.
- **Mycelium** `tr-mycelium`: Fine white threads branch out from a few spores, forking as they go, and B grows in along them until the mat closes over A.
- **Wing scales** `tr-wing-scales`: A settles into the shingled scales of a butterfly wing, each scale tips over to B with a flash of structural colour, and the scales melt back into the picture.
- **Camouflage** `tr-camouflage`: B first appears only as texture inside A’s colours, hidden like an animal against its ground, then takes its own colour patch by patch.
- **Cilia** `tr-cilia`: A carpet of fine hairs beats in rippling waves and passes the picture along stroke by stroke, carrying A out and B in.
- **Blink** `tr-blink`: The eyelids close on A, light glows warm through them, and they open on B, which comes into focus.
- **Moult** `tr-moult`: A clouds over like a snake’s old skin, its scales standing out, then the skin peels back and bunches up to show B fresh underneath.
- **Heartbeat** `tr-heartbeat`: The frame thumps like a heart, lub-dub, swelling on each beat, and every beat pumps B a little further out from the centre.
- **Afterimage** `tr-afterimage`: A is held until the eye tires of it, the frame goes to a plain wall where A lingers as its own complementary ghost, and B rises through the fading ghost.
- **Slime mould** `tr-physarum`: B spreads like a slime mould: a fan-shaped front of fine veins that prunes itself to a few thick tubes, which swell, feeding on the light parts of B first.

## Materials (`tr_matter.js`, 12)

- **Mercury pool** `tr-mercury-pool`: Liquid metal floods the low, dark ground of A first, mirrors B in its surface, then beads up and rolls off B.
- **Ferrofluid** `tr-ferrofluid`: Black magnetic fluid gathers on the bright areas first and rises into a field of spikes that draws the picture in relief, then drains to show B.
- **Incandescence** `tr-incandescent`: A heats until it glows, its brightest parts first, holds as an ember picture, then cools into B with B’s darkest parts cooling first.
- **Oil slick** `tr-oil-slick`: A drop of oil spreads over A, its colour fringes travelling outwards as the film thins, and B lies under it once it has gone clear.
- **Rust bloom** `tr-rust-bloom`: Corrosion starts in the dark crevices of A and blooms across it, then eats through in holes where B shows.
- **Gold leaf** `tr-gold-leaf`: Sheets of gold leaf are laid over A one by one, pressed with its relief, then rubbed through to B, darkest parts first.
- **Wind ripples** `tr-wind-ripple`: Wind combs A into sand ripples that march downwind and bend around its shapes, and B settles into the troughs until the ripples flatten.
- **Charcoal rubbing** `tr-charcoal-rubbing`: A sheet of paper goes over A and charcoal is rubbed across it, picking up B’s relief, then the paper is lifted away.
- **Wiped glass** `tr-wiped-glass`: Breath fogs the glass over A, then a hand wipes it clear in sweeps, leaving finger streaks, beaded edges and drips, with B behind.
- **Wet paint** `tr-wet-paint`: B is brushed on as a wet coat, dark and glossy, then dries patchily to matt, its lightest parts first.
- **Poured wax** `tr-poured-wax`: B is poured down over A as molten wax in rounded tongues, warm and translucent where it is fresh and setting opaque behind.
- **Bleach** `tr-bleach-out`: Bleach spatters across A and its darks lift through rust to cream as the spots spread, then B develops out of the pale, darks first.

## Sky and weather (`tr_sky.js`, 16)

- **Eclipse** `tr-sky-eclipse`: A dark moon slides across the sun, the light drains from A, the corona flares at totality and B comes back as the moon moves off.
- **Aurora** `tr-sky-aurora`: Night falls on A and folded curtains of light ripple across it; B shows through wherever they glow, until it is all lit.
- **Golden hour** `tr-sky-golden-hour`: The sun sets across A, raking over its forms in warm light down to blue hour, then rises on B from the other side.
- **Lightning** `tr-sky-lightning`: A storm darkens A, a bolt comes down, and B is what the flashes light up.
- **Fog bank** `tr-sky-fog-bank`: Fog rolls in from the far distance, swallows A, and lifts off B from the foreground back.
- **Cloud shadow** `tr-sky-cloud-shadow`: Cloud shadows drift over a sunlit A; under them B waits in flat overcast light, and when the sky clears again it is B in the sun.
- **Terminator line** `tr-sky-terminator`: Night sweeps across the frame on a curved line, through dusk and dark with the lights coming on, and dawn breaks behind it on B.
- **Star trails** `tr-sky-star-trails`: Night falls and the sky turns: the lights of A streak into arcs around the pole, and unwind as B.
- **Rainbow** `tr-sky-rainbow`: A rainbow rises out of the ground and widens across the sky; inside the bow the light is brighter and it is B.
- **Snowfall** `tr-sky-snow-settle`: Snow falls and settles on every ledge and ridge of A until it is buried, then melts off B, darkest parts first.
- **Monsoon** `tr-sky-monsoon`: A sheet of heavy rain sweeps across and leaves B soaked and gleaming behind it, then it dries.
- **Dust storm** `tr-sky-haboob`: A towering wall of dust rolls over A, the light goes ochre and flat, and B is there when it has passed.
- **Day for night** `tr-sky-day-for-night`: A goes to night by its own tones, shadows first and reds before blues, with its brightest spots left burning; B wakes highlights first.
- **Fata Morgana** `tr-sky-fata-morgana`: The horizon of A towers up into stacked, flipped copies of itself, as in a sea or desert mirage, and B settles out of the same towers.
- **Day to night slices** `tr-sky-time-slices`: The frame is cut into slices of time, each a little later in the day, so A goes through dusk and night and comes out as B in the morning.
- **Contrail** `tr-sky-contrail`: A plane draws thin white lines across A that spread and drift in the wind, and B shows through as the trails widen into cloud.

## Machines and codecs (`tr_machine.js`, 14)

- **JPEG coefficients** `tr-dct-zigzag`: A loses its detail coefficient by coefficient in 8×8 blocks, the way JPEG throws it away, each block swaps to B at its coarsest, and B is rebuilt the same way.
- **Interlaced load** `tr-interlace-passes`: B loads over A the way an interlaced PNG or GIF does: coarse passes sweep down the frame, each doubling the detail, until the full picture lands.
- **Z-fighting** `tr-zfight`: A and B become two surfaces at the same depth and fight for every pixel in shimmering bands, until B comes out in front.
- **Mip streaming** `tr-mip-stream`: Streaming tiles drop A down its mip levels and pull B back up them, each tile popping a level at its own moment.
- **Phosphor persistence** `tr-phosphor`: The tube switches off and A fades on its phosphors, red and green lingering longest, while the beam paints B back in two interlaced fields.
- **E-paper refresh** `tr-eink`: An e-paper page refresh: A drops to grey ink, flashes through its negative, black and white, and B settles with a ghost of A before its colour comes up.
- **LED wall switch** `tr-led-cabinets`: A video wall switches input cabinet by cabinet along its data chain, its diodes showing through, each panel a little off in colour until the wall settles on B.
- **Split-flap board** `tr-split-flap`: The frame becomes a split-flap board: every tile clatters through a few pieces of picture before it lands on B, more turns where the two pictures differ most.
- **Palette swap** `tr-palette-swap`: A drops to indexed colour, its palette is swapped for B's entry by entry (or cycled through it), then B's index map takes over tone by tone.
- **Bitrate climb** `tr-bitrate-climb`: B is sent as a cheap update to A: the blocks that changed most arrive first as a flat colour shift, and the detail comes through in coarse steps as the bitrate climbs.
- **Shading modes** `tr-shading-modes`: The frame is drawn as a triangle mesh: A drops from textured to smooth to flat shading to wireframe, and B builds back up the same pipeline, triangle by triangle down the frame.
- **Progressive render** `tr-path-trace`: Like a path tracer restarting: A breaks into a coarse, noisy few samples a pixel with stray fireflies, and B converges out of the grain.
- **Raw sensor** `tr-raw-sensor`: A goes back to raw sensor data, dark and green behind its colour filter mosaic, the readout swaps in B row by row, and it is demosaiced and white-balanced back into a photograph.
- **Blur-up placeholder** `tr-blurhash`: A melts into the handful of soft cosine waves a web placeholder keeps of it, the waves trade over one by one into B's, and B loads in on top.

## Reads the images (`tr_reading.js`, 12)

- **Hue families** `tr-hue-family`: The picture changes over one colour family at a time, from the start hue out to its opposite on the wheel, so every pair of images hands over in its own order.
- **Contours then fill** `tr-contour-fill`: B’s own contours are drawn over A, strongest first, and then its colour floods out from the lines, busy areas before open ones.
- **Luma parallax** `tr-luma-parallax`: Both pictures are read as relief from their own light and shade, the camera drifts over them, and the layers hand over nearest first.
- **Salient first** `tr-salient-first`: Whatever catches the eye in B arrives first, as islands that spread, and the quiet background settles in last.
- **Grade match** `tr-grade-match`: The two pictures meet on a shared grade measured from both, swap where their tones agree, and then B releases into its own colour.
- **Scale relay** `tr-scale-relay`: B’s light and colour arrive first and its detail last, so the middle is A’s drawing in B’s colour; or the other way round.
- **Palette borrow** `tr-palette-borrow`: B appears painted in A’s colours, each tone taking the colour A gives that tone, and then its own colours come through.
- **Least difference** `tr-least-difference`: A wipe whose edge lingers where the two pictures agree and races across where they differ, so the seam hides in what they share.
- **Light flood** `tr-light-flood`: B pours out from its own brightest point and spreads across the frame, running fast through tones like the light and slowly through what is unlike it.
- **Grain smear** `tr-grain-smear`: A is brushed out along the run of its own forms and B is brushed back in along its, as if the paint were still wet.
- **Codec morph** `tr-codec-morph`: B is first rebuilt from blocks of A, each moved to where it best matches, as a video codec would predict it, and then the real B refreshes block by block.
- **Figure and ground** `tr-figure-ground`: Reads each picture’s subject against its own background: A’s subject is lifted out to leave bare ground, the ground changes over, and B’s subject lands on it with a soft shadow.

## Architecture and space (`tr_space.js`, 12)

- **Camera obscura** `tr-obscura`: The room goes dark, B is thrown onto it upside down through a pinhole, then turns upright and sharpens as the room light goes.
- **Anamorphic resolve** `tr-anamorph`: B is painted across A’s wall so that it only makes sense from one spot, and the camera walks to that spot until it resolves.
- **Enfilade** `tr-enfilade`: A doorway opens in A onto a line of rooms, each a step closer to B, and the camera walks through them until B fills the frame.
- **Window light** `tr-blind-light`: Sun through a window falls across the room in bars, B is whatever the light lands on, and the blinds open until the room is all light.
- **Scenery flats** `tr-stage-flats`: Both pictures are cut into theatre flats along their tones, and the sets run past on tracks at different speeds, A’s going off as B’s come on.
- **Projection mapping** `tr-proj-boxes`: The frame pushes out into a wall of boxes carrying A on their faces, light traces their edges, the faces change to B box by box, and the wall flattens again.
- **Shoji screens** `tr-shoji`: A turns into paper screens, B glows through them from behind, brightest parts first, and then the screens slide apart on their tracks.
- **Light painting** `tr-light-painting`: The room goes to night and a torch beam paints B onto the wall in long-exposure strokes, overlapping and uneven, before the lights come up.
- **Vanishing point** `tr-vanishing`: A folds back into a corridor of itself, its middle becoming the far wall, and the camera walks down it to B waiting at the end.
- **Shop window** `tr-shop-window`: A is a reflection on a sheet of glass and B is behind it; you step closer, the reflection slides away and fades, first where B is brightest.
- **Scrim** `tr-scrim`: A is painted on a theatre gauze; the light moves behind it and B bleeds through the weave, highlights first, then the gauze flies out.
- **Infinity mirror** `tr-infinity-mirror`: A opens into a tunnel of its own reflections between two mirrors; B arrives in the deepest one and is passed forward reflection by reflection.
