/* ---------------- Effects ---------------- */
FX.register({ id:'fx-scanbar', name:'Scanner bar', cat:'fx', desc:'Lamp sweeps the frame on a loop, smearing what it passes and processing what it has scanned.',
  params:[ S('dir','Direction',DIRS4,0), I('passes','Passes per loop',1,1,8), R('width','Bar width',.06,.005,.4), R('smear','Smear',.5,0,1), R('glow','Glow',.8,0,3), S('behind','Scanned area',['Unchanged','Inverted','One-bit','Tinted']), T('ease','Ease the sweep',true), C('color','Lamp','#c9f5e4') ],
  fs:`vec4 fx(vec2 uv){
  int dm = int(p_dir + .5);
  float coord = dm == 0 ? 1. - uv.y : dm == 1 ? uv.x : dm == 2 ? uv.y : 1. - uv.x;
  float ph = fract(uLoop * max(floor(p_passes), 1.));
  if (p_ease > .5) ph = ph * ph * (3. - 2. * ph);
  float w = p_width;
  float pos = mix(-w, 1. + w, ph);
  float d = coord - pos;
  float inside = 1. - smoothstep(0., w, abs(d));
  float sc = mix(coord, clamp(pos, 0., 1.), inside * p_smear);
  vec2 st = uv;
  if (dm == 0) st.y = 1. - sc; else if (dm == 1) st.x = sc; else if (dm == 2) st.y = sc; else st.x = 1. - sc;
  vec3 col = texture(uInput, st).rgb;
  float behind = 1. - smoothstep(-.002, .002, d);
  int bm = int(p_behind + .5);
  vec3 proc = bm == 1 ? 1. - col : bm == 2 ? vec3(step(.5, luma(col))) : bm == 3 ? luma(col) * p_color * 1.3 : col;
  col = mix(col, proc, behind);
  float across = (dm == 0 || dm == 2) ? uv.x * uRes.x : uv.y * uRes.y;
  float streak = hash12(vec2(floor(across * .5), floor(uTime * 24.)));
  float glow = exp(-pow(d / max(w * .5, 1e-4), 2.));
  float core = 1. - smoothstep(0., 2.5 / min(uRes.x, uRes.y), abs(d));
  col += p_color * (glow * .6 * (.75 + .25 * streak) + core) * p_glow;
  return vec4(col, 1.);
}` });

FX.register({ id:'fx-slitscan', name:'Slit scan', cat:'fx', feedback:true, nonLocal:true, desc:'Photo-finish time smear: one slit of live pixels is dragged across the frame over time.',
  params:[ S('dir','Flow',['Right','Left','Up','Down']), R('slit','Slit position',.3,0,1), R('speed','Speed (px/frame)',10,.5,40,.5) ],
  fs:`vec4 fx(vec2 uv){
  int dm = int(p_dir + .5);
  float px = max(p_speed, .1) / (dm < 2 ? uRes.x : uRes.y);
  float coord = dm == 0 ? uv.x : dm == 1 ? 1. - uv.x : dm == 2 ? uv.y : 1. - uv.y;
  if (coord <= p_slit) return vec4(texture(uInput, uv).rgb, 1.);
  vec2 shift = dm == 0 ? vec2(px, 0.) : dm == 1 ? vec2(-px, 0.) : dm == 2 ? vec2(0., px) : vec2(0., -px);
  return vec4(texture(uPrev, uv - shift).rgb, 1.);
}` });

FX.register({ id:'fx-scanstretch', name:'Scan stretch', cat:'fx', desc:'Pixels freeze at a jagged scan line and stretch beyond it, like moving the original on a scanner.',
  params:[ S('dir','Direction',DIRS4,0), R('position','Position',.55,0,1), R('amount','Stretch',1,0,1), R('noise','Jaggedness',.05,0,.4), R('detail','Jag detail',6,.5,40), T('animate','Move with loop',true), R('travel','Travel',.3,0,1) ],
  fs:`vec4 fx(vec2 uv){
  int dm = int(p_dir + .5);
  float coord = dm == 0 ? 1. - uv.y : dm == 1 ? uv.x : dm == 2 ? uv.y : 1. - uv.x;
  float other = (dm == 0 || dm == 2) ? uv.x : uv.y;
  float pos = p_position + (p_animate > .5 ? sin(uLoop * TAU) * p_travel * .5 : 0.);
  float lp = pos + (vnoise(vec2(other * p_detail * 4., floor(uTime * 12.))) - .5) * p_noise;
  float sc = coord > lp ? lp + (coord - lp) * (1. - p_amount) : coord;
  vec2 st = uv;
  if (dm == 0) st.y = 1. - sc; else if (dm == 1) st.x = sc; else if (dm == 2) st.y = sc; else st.x = 1. - sc;
  return vec4(texture(uInput, clamp(st, 0., 1.)).rgb, 1.);
}` });

FX.register({ id:'fx-scangrid', name:'Scan grid', cat:'fx', desc:'Laser line leaves a fading measurement grid and tint in its wake.',
  params:[ I('passes','Passes per loop',1,1,8), R('grid','Grid size (px)',48,8,300,1), R('trail','Trail',.25,.01,1), R('gridAmt','Grid strength',.6,0,1), R('tint','Tint',.25,0,1), R('glow','Glow',1,0,4), C('color','Laser','#c9f5e4') ],
  fs:`vec4 fx(vec2 uv){
  vec3 col = texture(uInput, uv).rgb;
  float ph = fract(uLoop * max(floor(p_passes), 1.));
  float d = uv.y - (1. - ph);
  float trail = d > 0. ? exp(-d / max(p_trail, 1e-3)) : 0.;
  vec2 g = uv * uRes / p_grid; vec2 dd = min(fract(g), 1. - fract(g)) * p_grid;
  float gridM = 1. - smoothstep(max(.5, uPx * .5), max(.5, uPx * .5) + uPx, min(dd.x, dd.y));
  float lineM = 1. - smoothstep(max(1., uPx), max(1., uPx) * 3., abs(d) * uRes.y);
  float glowM = exp(-abs(d) * uRes.y / (p_glow * 25. + 1.));
  col = mix(col, col * .6 + p_color * .4, trail * p_tint);
  col += p_color * (gridM * trail * p_gridAmt + lineM + glowM * .5 * p_glow);
  return vec4(col, 1.);
}` });

FX.register({ id:'fx-rgbsplit', name:'RGB split', cat:'fx', desc:'Chromatic offset, linear or radial, with optional jitter.',
  params:[ R('amount','Offset (px)',16,0,80,.5), R('angle','Angle',0,-180,180,1), T('radial','Radial'), R('jitter','Jitter',0,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float a = p_amount / uRes.y;
  vec2 dir = p_radial > .5 ? centered(uv) * 2. : vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  if (p_jitter > 0.) a *= 1. + (hash12(vec2(floor(uTime * 15.), 3.)) - .5) * 2. * p_jitter;
  vec2 o = dir * a * vec2(1. / aspect(), 1.);
  return vec4(texture(uInput, uv + o).r, texture(uInput, uv).g, texture(uInput, uv - o).b, 1.);
}` });

FX.register({ id:'fx-glitch', name:'Glitch', cat:'fx', nonLocal:true, desc:'Row tears, block displacement, inversions and colour crush.',
  params:[ R('amount','Intensity',.5,0,1), R('rate','Rate',12,1,60,1), I('rows','Row bands',40,4,200), R('blocks','Block grid',16,4,60,1), R('split','RGB split (px)',12,0,60) ],
  fs:`vec4 fx(vec2 uv){
  float fr = floor(uTime * p_rate);
  vec2 id = floor(uv * vec2(p_blocks * aspect(), p_blocks) + vec2(0., hash12(vec2(fr, 1.)) * 3.));
  float h = hash12(id + fr * 1.37);
  float on = step(1. - p_amount * .6, h);
  vec2 st = uv;
  st.x += on * (hash12(id + fr + 2.) - .5) * .25;
  float rowId = floor(uv.y * p_rows);
  st.x += step(1. - p_amount * .5, hash12(vec2(rowId, fr))) * (hash12(vec2(rowId, fr + 9.)) - .5) * .15;
  float sp = p_split * (on + .15) / uRes.x;
  vec3 col = vec3(texture(uInput, st + vec2(sp, 0.)).r, texture(uInput, st).g, texture(uInput, st - vec2(sp, 0.)).b);
  col = mix(col, 1. - col, step(.97, h) * on);
  col = mix(col, floor(col * 3.) / 3., step(.93, h) * on);
  return vec4(col, 1.);
}` });

FX.register({ id:'fx-crt', name:'CRT', cat:'fx', desc:'Curved glass, scanlines, aperture grille and flicker.',
  params:[ R('curve','Curvature',.35,0,1.5), R('lineSize','Line pitch (px)',4,2,16,1), R('scanlines','Scanlines',.5,0,1), R('mask','Aperture mask',.3,0,1), R('vignette','Vignette',.6,0,1), R('flicker','Flicker',.3,0,1), R('bright','Brightness',.15,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = uv * 2. - 1.;
  vec2 cc = c + c * (c.yx * c.yx) * p_curve * .3;
  vec2 st = cc * .5 + .5;
  if (any(lessThan(st, vec2(0.))) || any(greaterThan(st, vec2(1.)))) return vec4(0., 0., 0., 1.);
  vec3 col = texture(uInput, st).rgb;
  float sl = .5 + .5 * sin(st.y * uRes.y / p_lineSize * TAU);
  col *= mix(1., .35 + .65 * sl, p_scanlines);
  float mx = mod(floor(uv.x * uRes.x / max(p_lineSize * .75, 1.)), 3.);
  vec3 mk = mx < 1. ? vec3(1., .7, .7) : mx < 2. ? vec3(.7, 1., .7) : vec3(.7, .7, 1.);
  col *= mix(vec3(1.), mk, p_mask);
  col *= 1. + p_flicker * (hash12(vec2(floor(uTime * 30.), 1.)) - .5) * .25;
  col *= mix(1., 1. - smoothstep(.4, 1.45, length(cc)), p_vignette);
  return vec4(col * (1. + p_bright), 1.);
}` });

FX.register({ id:'fx-vhs', name:'VHS', cat:'fx', nonLocal:true, desc:'Tape wobble, tracking tear, chroma bleed and noise.',
  params:[ R('wobble','Wobble',.5,0,2), R('tracking','Tracking',.5,0,2), R('bleed','Chroma bleed (px)',4,0,20), R('noise','Noise',.08,0,.4) ],
  fs:`vec4 fx(vec2 uv){
  float t = uTime;
  float wob = (vnoise(vec2(uv.y * 8., t * 6.)) - .5) * .004 * p_wobble;
  float bpos = fract(-t * .2);
  float inBand = 1. - smoothstep(0., .04, abs(uv.y - bpos));
  wob += inBand * (hash12(vec2(floor(uv.y * uRes.y * .5), floor(t * 30.))) - .5) * .03 * p_tracking;
  vec2 st = vec2(uv.x + wob, uv.y);
  float Y = dot(texture(uInput, st).rgb, vec3(.299, .587, .114));
  vec2 IQ = vec2(0.);
  for (int i = 0; i < 8; i++){
    vec3 s = texture(uInput, st - vec2(float(i) * p_bleed / uRes.x, 0.)).rgb;
    IQ += vec2(dot(s, vec3(.596, -.274, -.322)), dot(s, vec3(.211, -.523, .312)));
  }
  IQ /= 8.;
  vec3 col = vec3(Y + .956 * IQ.x + .621 * IQ.y, Y - .272 * IQ.x - .647 * IQ.y, Y - 1.106 * IQ.x + 1.703 * IQ.y);
  col += (hash12(uv * uRes + floor(t * 30.)) - .5) * p_noise;
  col += inBand * p_tracking * .08;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'fx-pixelsort', name:'Pixel drag', cat:'fx', nonLocal:true, desc:'Bright (or dark) pixels drag into streaks, like a pixel sort.',
  params:[ S('dir','Streak direction',['Down','Up','Right','Left']), R('threshold','Threshold',.6,0,1), R('length','Length (px)',120,4,600,1), R('random','Length variation',.5,0,1), R('fade','Fade',.3,0,1), T('invert','Drag darks') ],
  fs:`vec4 fx(vec2 uv){
  int dm = int(p_dir + .5);
  vec2 dir = dm == 0 ? vec2(0., -1.) : dm == 1 ? vec2(0., 1.) : dm == 2 ? vec2(1., 0.) : vec2(-1., 0.);
  float line = dm < 2 ? floor(uv.x * uRes.x / 2.) : floor(uv.y * uRes.y / 2.);
  float len = p_length * (1. - p_random * hash12(vec2(line, 4.)));
  vec2 stepv = -dir / uRes * len / 32.;
  vec3 col = texture(uInput, uv).rgb; float cl = luma(col);
  for (int i = 1; i <= 32; i++){
    vec3 s = texture(uInput, uv + stepv * float(i)).rgb; float l = luma(s);
    bool pass = p_invert > .5 ? (l < p_threshold && l < cl) : (l > p_threshold && l > cl);
    if (pass){ col = mix(col, s, 1. - float(i) / 33. * p_fade); cl = luma(col); }
  }
  return vec4(col, 1.);
}` });

FX.register({ id:'fx-echo', name:'Echo trails', cat:'fx', feedback:true, nonLocal:true, desc:'Feedback trails that zoom, rotate and shift hue each frame.',
  params:[ S('mode','Mode',['Lighten','Mix','Screen','Difference']), R('decay','Persistence',.9,0,.99), R('zoom','Zoom',1.01,.9,1.1,.001), R('rotate','Rotate',0,-3,3,.05), R('dx','Drift X',0,-1,1), R('dy','Drift Y',0,-1,1), R('hue','Hue shift',0,-10,10,.1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 cur = texture(uInput, uv).rgb;
  vec2 c = rot(radians(p_rotate)) * centered(uv) / p_zoom;
  vec2 st = uncentered(c) - vec2(p_dx, p_dy) * .01;
  vec3 prev = texture(uPrev, st).rgb;
  if (p_hue != 0.){ vec3 h = rgb2hsv(prev); h.x = fract(h.x + p_hue / 360.); prev = hsv2rgb(h); }
  prev *= p_decay;
  int m = int(p_mode + .5);
  vec3 col = m == 0 ? max(cur, prev) : m == 1 ? mix(cur, prev, p_decay) : m == 2 ? 1. - (1. - cur) * (1. - prev) : abs(cur - prev);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'fx-warp', name:'Wave warp', cat:'fx', desc:'Sine or noise displacement. Loops seamlessly.', search:['distort'],
  params:[ S('type','Type',['Sine','Noise']), S('axis','Axis',['Horizontal','Vertical','Both'],2), R('amount','Amount',.3,0,2), R('freq','Frequency',3,.2,30), I('speed','Cycles per loop',1,0,8) ],
  fs:`vec4 fx(vec2 uv){
  float ph = uLoop * TAU * p_speed;
  vec2 off;
  if (p_type < .5) off = vec2(sin(uv.y * p_freq * TAU + ph), sin(uv.x * p_freq * TAU + ph));
  else { vec2 lo = vec2(cos(ph), sin(ph)) * .5; vec2 q = centered(uv) * p_freq * .5; off = vec2(fbm(q + lo), fbm(q + vec2(3.1, 7.7) - lo)) * 2. - 1.; }
  int ax = int(p_axis + .5);
  if (ax == 0) off.y = 0.; else if (ax == 1) off.x = 0.;
  return vec4(texture(uInput, mirrorUv(uv + off * p_amount * .05)).rgb, 1.);
}` });

FX.register({ id:'fx-kaleido', name:'Kaleidoscope', cat:'fx', nonLocal:true, desc:'Mirrored segments with rotation and spin.', search:['repeat'],
  params:[ I('segments','Segments',6,1,24), R('rotate','Rotation',0,-180,180,1), I('spin','Spins per loop',0,-4,4), R('zoom','Zoom',1,.2,4), R('x','Offset X',0,-1,1), R('y','Offset Y',0,-1,1) ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float r = length(c);
  float a = atan(c.y, c.x) + radians(p_rotate) + uLoop * TAU * p_spin;
  float seg = TAU / max(floor(p_segments), 1.);
  a = mod(a, seg); a = abs(a - seg * .5);
  vec2 q = vec2(cos(a), sin(a)) * r / p_zoom;
  return vec4(texture(uInput, mirrorUv(uncentered(q) + vec2(p_x, p_y) * .25)).rgb, 1.);
}` });

FX.register({ id:'fx-tile', name:'Mirror & tile', cat:'fx', nonLocal:true, desc:'Mirror halves or quarters, or repeat into a scrolling grid.',
  params:[ S('mode','Mode',['Mirror X','Mirror Y','Quad mirror','Tile grid']), I('tiles','Tiles',3,1,20), T('mirror','Mirror alternate tiles',true), I('scroll','Scroll per loop',0,-6,6), T('flip','Flip side') ],
  fs:`vec4 fx(vec2 uv){
  int m = int(p_mode + .5); vec2 st = uv;
  vec2 u2 = p_flip > .5 ? 1. - uv : uv;
  if (m == 0) st.x = .5 - abs(u2.x - .5);
  else if (m == 1) st.y = .5 - abs(u2.y - .5);
  else if (m == 2) st = .5 - abs(u2 - .5);
  else {
    vec2 g = vec2(max(p_tiles, 1.));
    vec2 q = uv * g + vec2(uLoop * p_scroll, 0.);
    st = fract(q);
    if (p_mirror > .5){ vec2 id = floor(q); st = mix(st, 1. - st, mod(id, 2.)); }
  }
  return vec4(texture(uInput, st).rgb, 1.);
}` });

FX.register({ id:'fx-motionblur', name:'Motion blur', cat:'fx', desc:'Directional, zoom or spin blur.',
  params:[ S('type','Type',['Directional','Zoom','Spin']), R('amount','Amount',.3,0,2), R('angle','Angle',0,-180,180,1), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1) ],
  fs:`vec4 fx(vec2 uv){
  int m = int(p_type + .5); vec3 acc = vec3(0.);
  vec2 ctr = vec2(.5) + vec2(p_x, p_y) * .5;
  for (int i = 0; i < 32; i++){
    float k = float(i) / 31. - .5; vec2 st;
    if (m == 0) st = uv + vec2(cos(radians(p_angle)), sin(radians(p_angle))) * k * p_amount * .1 * vec2(1. / aspect(), 1.);
    else if (m == 1) st = (uv - ctr) * (1. - k * p_amount * .3) + ctr;
    else { vec2 c = (uv - ctr) * vec2(aspect(), 1.); c = rot(k * p_amount * .3) * c; st = c / vec2(aspect(), 1.) + ctr; }
    acc += texture(uInput, st).rgb;
  }
  return vec4(acc / 32., 1.);
}` });

FX.register({ id:'fx-lens', name:'Lens', cat:'fx', desc:'Barrel or pincushion distortion with chromatic fringing.',
  params:[ R('amount','Distortion',.4,-1,2), R('zoom','Zoom',1.1,.5,2), R('chroma','Fringing',.5,0,3), T('crop','Black outside',true) ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = centered(uv); float r2 = dot(p, p);
  float k = p_amount, ca = p_chroma * .02;
  vec2 q = p * (1. + k * r2) / p_zoom;
  vec2 qr = p * (1. + (k + ca) * r2) / p_zoom, qb = p * (1. + (k - ca) * r2) / p_zoom;
  vec3 col = vec3(texture(uInput, uncentered(qr)).r, texture(uInput, uncentered(q)).g, texture(uInput, uncentered(qb)).b);
  vec2 s = uncentered(q);
  float outside = step(1., max(abs(s.x - .5), abs(s.y - .5)) * 2.);
  return vec4(mix(col, vec3(0.), outside * p_crop), 1.);
}` });

FX.register({ id:'fx-polar', name:'Polar', cat:'fx', nonLocal:true, desc:'Wrap the frame into a circle, or unwrap it into a strip.', search:['distort'],
  params:[ S('mode','Mode',['Wrap to circle','Unwrap']), I('repeat','Repeats',1,1,12), I('spin','Spins per loop',0,-4,4), R('zoom','Zoom',1,.2,3), T('flip','Flip radius') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  if (p_mode < .5){
    float a = atan(c.y, c.x) / TAU + .5;
    float r = length(c) * 2. / p_zoom;
    vec2 st = vec2(fract(a * p_repeat + uLoop * p_spin), p_flip > .5 ? 1. - r : r);
    return vec4(texture(uInput, mirrorUv(st)).rgb, 1.);
  }
  float a = (uv.x - .5) * TAU / p_repeat + uLoop * p_spin * TAU; float r = (p_flip > .5 ? 1. - uv.y : uv.y) * .5 * p_zoom;
  return vec4(texture(uInput, mirrorUv(uncentered(vec2(cos(a), sin(a)) * r))).rgb, 1.);
}` });

FX.register({ id:'fx-leak', name:'Light leak', cat:'fx', desc:'Drifting warm light screened over the frame. Loops seamlessly.',
  params:[ C('c1','Colour 1','#ff6a2b'), C('c2','Colour 2','#ffd36e'), R('amount','Amount',.7,0,2), R('angle','Direction',30,-180,180,1), R('spread','Spread',.8,0,2) ],
  fs:`vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  vec2 p = centered(uv);
  vec2 lo = vec2(cos(uLoop * TAU), sin(uLoop * TAU)) * .6;
  float n = fbm(p * 1.2 + lo);
  float g = smoothstep(.2, 1., n + dot(p, vec2(cos(radians(p_angle)), sin(radians(p_angle)))) * p_spread + .1);
  vec3 leak = mix(p_c1, p_c2, fbm(p * 2. - lo)) * g * p_amount;
  return vec4(1. - (1. - c) * (1. - clamp(leak, 0., 1.)), 1.);
}` });

FX.register({ id:'fx-matte', name:'Matte', cat:'fx', desc:'Reveal source A, source B or a colour through a holdable split, luma key or shape, over the current frame.', search:['window', 'mask', 'combine'],
  params:[
    S('replace','Replace with',['Source A','Source B','Colour'],1), C('color','Colour','#ff5a36','accent'),
    S('mode','Matte',['Split','Luma','Shape']), T('invert','Invert'), R('amount','Amount',1,0,1),
    R('position','Position',.5,0,1), R('angle','Angle',90,-180,180,1), R('soft','Softness',.06,0,.5),
    S('from','Luma from',['Source A','Source B']), R('threshold','Threshold',.5,0,1),
    S('shape','Shape',['Circle','Box','Rounded']), R('size','Size',.38,0,1.2), R('x','X',0,-1,1), R('y','Y',0,-1,1),
  ],
  fs:`vec4 fx(vec2 uv){
  vec3 cur = texture(uInput, uv).rgb;
  int r = int(p_replace + .5);
  vec3 repl = r == 0 ? texture(uA, uv).rgb : r == 1 ? texture(uB, uv).rgb : p_color;
  int mode = int(p_mode + .5);
  float m, s = max(p_soft, 1e-3);
  if (mode == 0){
    vec2 dir = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
    float ext = abs(dir.x) * aspect() * .5 + abs(dir.y) * .5;
    float d = dot(centered(uv), dir) / max(ext, 1e-4) * .5 + .5;
    m = smoothstep(p_position - s, p_position + s, d);
  } else if (mode == 1){
    float l = luma((p_from < .5 ? texture(uA, uv) : texture(uB, uv)).rgb);
    m = smoothstep(p_threshold - s, p_threshold + s, l);
  } else {
    vec2 p = centered(uv) - vec2(p_x * aspect() * .5, p_y * .5);
    int sh = int(p_shape + .5);
    float d = sh == 0 ? length(p) - p_size
      : sdRoundBox(p, vec2(p_size), sh == 2 ? p_size * .35 : 0.);
    m = 1. - smoothstep(-s, s, d);
  }
  if (p_invert > .5) m = 1. - m;
  return vec4(mix(cur, repl, m * p_amount), 1.);
}` });

/* Framing the current processed frame. Default is identity: adding it must
   not change the picture. Scale around the centre; X/Y pan the picture
   (positive X right, positive Y up). nonLocal: a crop samples far from the
   output pixel, so tiled print would seam. */
FX.register({ id:'fx-reframe', name:'Reframe', cat:'fx', nonLocal:true,
  desc:'Crop, scale and position the current frame.',
  search:['crop', 'zoom', 'pan', 'frame'],
  params:[
    R('scale','Scale',1,.25,6),
    R('x','X',0,-1,1),
    R('y','Y',0,-1,1),
    S('edge','Outside',['Background','Clamp']),
  ],
  fs:`vec4 fx(vec2 uv){
  float s = max(p_scale, 1e-4);
  vec2 st = (uv - .5) / s + .5 - vec2(p_x, p_y) * .5;
  if (p_edge < .5 && (any(lessThan(st, vec2(0.))) || any(greaterThan(st, vec2(1.)))))
    return vec4(backdrop(uv), 1.);
  return vec4(texture(uInput, st).rgb, 1.);
}` });

/* ---------------- Overlays ---------------- */
FX.register({ id:'ovl-hud', name:'Camera HUD', cat:'overlay', kind:'2d', noRandom:true, desc:'Corner brackets, REC, timecode and a label.',
  params:[ C('color','Colour','#e4e2dc'), R('margin','Margin',5,0,20), R('bracket','Bracket size',6,1,20), R('stroke','Line weight',3,1,10), R('textSize','Text size',26,8,80,1), X('label','Label','SCAN 01'), T('rec','REC indicator',true), T('crosshair','Crosshair',true), T('meta','Size readout',true), T('feed','Incoming frame') ],
  draw(ctx, api){
    const P = api.params, { w, h } = api;
    const u = Math.min(w, h) / 1080, mn = Math.min(w, h);
    const m = P.margin / 100 * mn, L = P.bracket / 100 * mn, inset = L * .35;
    ctx.strokeStyle = ctx.fillStyle = P.color; ctx.lineWidth = Math.max(1, P.stroke * u);
    ctx.beginPath();
    [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); });
    if (P.crosshair){ const cx = w / 2, cy = h / 2, s = L * .4; ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy); ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s); }
    ctx.stroke();
    const fs = P.textSize * u;
    ctx.font = `500 ${fs}px ${Util.fonts[2]}`;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    const tx = m + inset, ty = m + inset;
    if (P.rec){
      if (Math.floor(api.t * 2) % 2 === 0){ ctx.fillStyle = '#ff3b2f'; ctx.beginPath(); ctx.arc(tx + fs * .38, ty + fs * .5, fs * .34, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = P.color; ctx.fillText('REC', tx + fs * 1.05, ty);
    }
    ctx.textAlign = 'right'; ctx.fillText(P.label, w - m - inset, ty);
    const fr = Math.floor(api.t * api.fps + 1e-6);
    const tc = [Math.floor(api.t / 3600), Math.floor(api.t / 60) % 60, Math.floor(api.t) % 60, fr % api.fps].map(n => String(n).padStart(2, '0')).join(':');
    ctx.textBaseline = 'bottom'; ctx.textAlign = 'left'; ctx.fillText(tc, tx, h - m - inset);
    if (P.meta){ ctx.textAlign = 'right'; ctx.fillText(`${api.W}×${api.H}`, w - m - inset, h - m - inset); }
    /* optional picture-in-picture of the incoming composition — proves api.input is readable */
    if (P.feed && api.input){
      const fw = w * .4, fh = h * .4, fx = w - m - fw, fy = h * .52;
      ctx.drawImage(api.input, 0, 0, api.input.width, api.input.height, fx, fy, fw, fh);
      ctx.strokeRect(fx, fy, fw, fh);
    }
  } });

FX.register({ id:'ovl-grid', name:'Grid & marks', cat:'overlay', desc:'Layout grid, registration crosses or dot matrix over the frame.',
  params:[ S('mode','Style',['Lines','Crosses','Dots']), I('cols','Columns',6,1,48), I('rows','Rows',8,1,48), T('square','Square cells'), R('width','Line weight (px)',1.5,.5,8,.5), R('mark','Cross size (px)',10,2,60,1), R('opacity','Opacity',.6,0,1), C('color','Colour','#e4e2dc') ],
  fs:`vec4 fx(vec2 uv){
  vec3 col = texture(uInput, uv).rgb;
  vec2 cs = vec2(uRes.x / max(p_cols, 1.));
  cs.y = p_square > .5 ? cs.x : uRes.y / max(p_rows, 1.);
  vec2 g = uv * uRes / cs;
  vec2 dd = min(fract(g), 1. - fract(g)) * cs;
  float hw = max(p_width * .5, uPx * .5);
  int m = int(p_mode + .5); float v;
  if (m == 0) v = 1. - smoothstep(hw, hw + uPx, min(dd.x, dd.y));
  else if (m == 1) v = (1. - step(p_mark, max(dd.x, dd.y))) * (1. - smoothstep(hw, hw + uPx, min(dd.x, dd.y)));
  else v = 1. - smoothstep(max(p_width, uPx), max(p_width, uPx) + uPx, length(dd));
  return vec4(mix(col, p_color, v * p_opacity), 1.);
}` });

FX.register({ id:'ovl-letterbox', name:'Letterbox', cat:'overlay', desc:'Cinema bars that can close in with the timeline.',
  params:[ R('amount','Bar size',.12,0,.5), S('axis','Bars',['Top & bottom','Sides']), T('animate','Close with timeline'), C('color','Colour','#000000') ],
  fs:`vec4 fx(vec2 uv){
  vec3 col = texture(uInput, uv).rgb;
  float a = p_amount * (p_animate > .5 ? uProgress : 1.);
  float c = p_axis < .5 ? uv.y : uv.x;
  float bar = step(c, a) + step(1. - a, c);
  return vec4(mix(col, p_color, clamp(bar, 0., 1.)), 1.);
}` });

FX.register({ id:'ovl-progress', name:'Progress bar', cat:'overlay', desc:'A scrubber bar tracking timeline progress or loop phase, with an optional handle and tick marks.',
  params:[ S('drive','Drives from',['Timeline progress','Loop phase'],0), S('pos','Position',['Bottom','Top'],0), R('margin','Margin',.06,0,.3), R('thick','Thickness (px)',6,2,32,1), C('track','Track colour','#e4e2dc'), C('fill','Fill colour','#ff5a36','accent'), T('handle','Handle',true), I('ticks','Tick marks',0,0,24), R('opacity','Opacity',1,0,1) ],
  fs:`float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
vec4 fx(vec2 uv){
  vec3 col = texture(uInput, uv).rgb;
  vec2 c = centered(uv);
  float ar = aspect(), hw = max(p_thick * .5, 1.) / uRes.y;
  float y = p_pos < .5 ? -.5 + p_margin : .5 - p_margin;
  vec2 a = vec2(-ar * .5 + p_margin, y), b = vec2(ar * .5 - p_margin, y);
  float dTrack = sdSeg(c, a, b) - hw, aa = fwidth(dTrack) + .0006;
  float mTrack = 1. - smoothstep(0., aa, dTrack);
  float prog = clamp(p_drive < .5 ? uProgress : fract(uLoop), 0., 1.);
  vec2 e = mix(a, b, prog);
  float mFill = 1. - smoothstep(0., aa, sdSeg(c, a, e) - hw);
  vec3 outc = mix(col, p_track, mTrack * p_opacity);
  outc = mix(outc, p_fill, mFill * p_opacity);
  if (p_ticks > .5){
    vec2 dir = normalize(b - a), perp = vec2(-dir.y, dir.x);
    for (int i = 1; i < 24; i++){
      if (float(i) >= p_ticks) break;
      vec2 tp = mix(a, b, float(i) / p_ticks);
      float dTick = sdSeg(c, tp - perp * hw * 2.4, tp + perp * hw * 2.4) - hw * .35;
      outc = mix(outc, p_track, (1. - smoothstep(0., aa, dTick)) * p_opacity);
    }
  }
  if (p_handle > .5) outc = mix(outc, p_fill, (1. - smoothstep(0., aa, length(c - e) - hw * 2.4)) * p_opacity);
  return vec4(outc, 1.);
}` });

FX.register({ id:'ovl-scratches', name:'Dust & scratches', cat:'overlay', desc:'Flickering dust motes and hairline scratches, like a scan of damaged film.', search:['texture'],
  params:[ R('dust','Dust density',.4,0,1), R('dustSize','Dust size',1,.3,3), I('scratches','Scratches',5,0,16), R('scratchWidth','Scratch width (px)',1.2,.4,4), R('flicker','Brightness flicker',.12,0,.5), I('speed','Flicker rate',24,4,80), C('color','Colour','#e4e2dc'), R('opacity','Opacity',.85,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 col = texture(uInput, uv).rgb;
  float fr = mod(floor(uTime * p_speed), 251.);
  float cell = max(4., 260. / max(p_dustSize, .1));
  vec2 g = floor(uv * vec2(cell * aspect(), cell));
  float on = step(1. - p_dust * .1, hash12(g + fr * 13.7));
  vec2 jit = hash22(g + 4.7) - .5;
  vec2 cellPx = (g + .5 + jit * .7) * uRes / vec2(cell * aspect(), cell);
  float r = (.4 + hash12(g + 1.3) * .8) * p_dustSize * 1.4;
  float dust = on * (1. - smoothstep(r, r + uPx, length(uv * uRes - cellPx)));
  float scratch = 0.;
  for (int i = 0; i < 16; i++){
    if (float(i) >= p_scratches) break;
    float s = float(i) * 7.31 + 1.;
    float show = step(.4, hash12(vec2(s, fr)));
    float x = hash12(vec2(s, floor(fr / 5.) + 9.));
    float wob = (hash12(vec2(s * 3.1, uv.y * 6. + fr)) - .5) * .006;
    float d = abs(uv.x - x - wob) * uRes.x;
    scratch = max(scratch, show * (1. - smoothstep(p_scratchWidth * .5, p_scratchWidth * .5 + uPx, d)));
  }
  float flicker = 1. + (hash12(vec2(fr, 4.2)) - .5) * p_flicker;
  vec3 lit = clamp(col * flicker, 0., 1.);
  float mark = clamp(dust + scratch, 0., 1.);
  return vec4(mix(lit, p_color, mark * p_opacity), 1.);
}` });

FX.register({ id:'ovl-confetti', name:'Confetti', cat:'overlay', kind:'2d', desc:'Small shapes tumbling down the frame, each on its own fall. Loops seamlessly.',
  params:[ I('count','Pieces',110,10,240), R('size','Size',1.55,.4,2.5), I('speed','Falls per loop',1,0,6), R('spread','Spread',1,.2,1.6), R('spin','Spin',1,0,3), S('shape','Shape',['Mixed','Rectangle','Ribbon','Circle']), C('c1','Colour 1','#ff5a36','accent'), C('c2','Colour 2','#c9f5e4','accent2'), C('c3','Colour 3','#e4e2dc','ink'), T('palette','Use brand palette',false) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api;
    const n = Math.max(1, P.count | 0), colors = [P.c1, P.c2, P.c3];
    const unit = Math.min(w, h) / 1000, sz = 16 * P.size * unit;
    const fall = api.loop * Math.max(0, P.speed | 0);
    for (let i = 0; i < n; i++){
      const s1 = Util.hash(i * 12.9898), s2 = Util.hash(i * 78.233 + 4), s3 = Util.hash(i * 37.719 + 9);
      const s4 = Util.hash(i * 91.345 + 2), s5 = Util.hash(i * 53.471 + 6);
      const lp = ((fall + s2) % 1 + 1) % 1;
      const x = ((1 - P.spread) / 2 + s1 * P.spread) * w + Math.sin(lp * KT.TAU * 3) * sz * 1.4 * P.spread;
      const y = lp * (h + sz * 3) - sz * 1.5;
      const rot = s3 * KT.TAU + lp * KT.TAU * P.spin * (s5 > .5 ? 1 : -1);
      const shape = P.shape === 0 ? Math.floor(s4 * 3) : P.shape - 1;
      const col = P.palette ? Brand.paletteColor(i, 7, colors[i % 3]) : colors[i % 3];
      const size = sz * (.7 + s2 * .6);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col;
      if (shape === 0) ctx.fillRect(-size / 2, -size / 3, size, size * .66);
      else if (shape === 1) ctx.fillRect(-size / 6, -size * .8, size / 3, size * 1.6);
      else { ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, KT.TAU); ctx.fill(); }
      ctx.restore();
    }
  } });
