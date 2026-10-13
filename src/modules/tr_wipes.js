/* ---------------- Transitions: wipes ----------------
   Geometric and pattern wipes. Each builds a mask m (0 = A, 1 = B) from uProgress;
   WIPE_END pins the mask to exactly A at p = 0 and exactly B at p = 1, so a cut
   on either end never shows a stray pixel of the other image. */
const WIPE_END = 'if (uProgress <= 0.) m = 0.; if (uProgress >= 1.) m = 1.;';
const WIPE_ANCHORS = ['Centre','Top left','Top','Top right','Right','Bottom right','Bottom','Bottom left','Left'];

FX.register({ id:'tr-barndoor', name:'Barn door', cat:'transition', search:['split', 'doors', 'centre split', 'open', 'close'],
  desc:'B opens out from a centre line, or closes in from both edges, at any angle.',
  params:[ R('angle','Angle',0,0,180,1), S('mode','Mode',['Open from centre','Close from edges'],0), R('soft','Softness',.01,0,.3), R('line','Edge line',.004,0,.04), C('color','Line colour','#ffffff','accent') ],
  fs:`vec4 fx(vec2 uv){
  vec2 n = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  float ext = abs(n.x) * aspect() * .5 + abs(n.y) * .5;
  float d = abs(dot(centered(uv), n));
  float s = max(p_soft * .5, 1e-4);
  float pad = s + p_line;
  float m, edge;
  if (p_mode < .5){ edge = mix(-pad, ext + pad, uProgress); m = 1. - smoothstep(edge - s, edge + s, d); }
  else { edge = mix(ext + pad, -pad, uProgress); m = smoothstep(edge - s, edge + s, d); }
  ${WIPE_END}
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m);
  if (p_line > 0. && uProgress > 0. && uProgress < 1.) col = mix(col, p_color, 1. - smoothstep(p_line * .5, p_line * .5 + 1.5 / uRes.y, abs(d - edge)));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-bowtie', name:'Bow-tie', cat:'transition', search:['triangles', 'hourglass', 'wipe'],
  desc:'Two triangles grow in from opposite edges and meet at their points.',
  params:[ S('axis','From',['Left and right','Top and bottom'],0), R('meet','Meeting point',.5,.15,.85), T('inv','Reverse'), R('soft','Softness',.01,0,.2), R('line','Edge line',0,0,.03), C('color','Line colour','#ffffff','accent') ],
  fs:`vec4 fx(vec2 uv){
  bool hz = p_axis < .5;
  float u = hz ? uv.x : 1. - uv.y;
  float v = abs((hz ? uv.y : uv.x) - .5);
  float a = clamp(p_meet, .05, .95);
  float f = min(u / (2. * a), (1. - u) / (2. * (1. - a))) + v;
  float s = max(p_soft * .5, 1e-4);
  float pad = s + p_line;
  float m, t;
  if (p_inv < .5){ t = mix(-pad, 1. + pad, uProgress); m = 1. - smoothstep(t - s, t + s, f); }
  else { t = mix(1. + pad, -pad, uProgress); m = smoothstep(t - s, t + s, f); }
  ${WIPE_END}
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m);
  if (p_line > 0. && uProgress > 0. && uProgress < 1.) col = mix(col, p_color, 1. - smoothstep(p_line * .5, p_line * .5 + fwidth(f) * 1.5, abs(f - t)));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-boxwipe', name:'Box wipe', cat:'transition', search:['inset', 'centre wipe', 'corner wipe', 'clip-path', 'rectangle', 'reveal'],
  desc:'A frame-shaped box grows out of a corner, an edge or the centre, its corners rounding off as it fills.',
  params:[ S('anchor','Grows from',WIPE_ANCHORS,1), R('round','Corner rounding',.35,0,1), R('soft','Softness',.004,0,.2), R('line','Edge line',.004,0,.04), C('color','Line colour','#ffffff','accent'), T('inv','Shrink A instead') ],
  fs:`vec2 box_anchor(int k){
  if (k == 1) return vec2(0., 1.); if (k == 2) return vec2(.5, 1.); if (k == 3) return vec2(1., 1.);
  if (k == 4) return vec2(1., .5); if (k == 5) return vec2(1., 0.); if (k == 6) return vec2(.5, 0.);
  if (k == 7) return vec2(0., 0.); if (k == 8) return vec2(0., .5); return vec2(.5);
}
vec4 fx(vec2 uv){
  float ar = aspect();
  float pp = p_inv > .5 ? 1. - uProgress : uProgress;
  vec2 ctr = mix(box_anchor(int(p_anchor + .5)), vec2(.5), pp);
  float s = max(p_soft * .5, 1e-4);
  vec2 q = (uv - ctr) * vec2(ar, 1.);
  vec2 b = .5 * pp * vec2(ar, 1.) + (s * 2. + p_line) * pp;
  float r = min(b.x, b.y) * p_round * (1. - pp);
  float d = sdRoundBox(q, b, r);
  float inside = 1. - smoothstep(-s, s, d);
  float m = p_inv > .5 ? 1. - inside : inside;
  ${WIPE_END}
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m);
  if (p_line > 0. && uProgress > 0. && uProgress < 1.) col = mix(col, p_color, 1. - smoothstep(p_line * .5, p_line * .5 + 1.5 / uRes.y, abs(d)));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-irisdip', name:'Iris through colour', cat:'transition', search:['circle crop', 'iris out', 'iris in', 'cartoon', 'dip'],
  desc:'An iris closes on A over a flat colour, holds, then opens again on B.',
  params:[ S('shape','Shape',['Circle','Frame-shaped box','Diamond'],0), C('color','Colour','#0e0f10','ground'), R('hold','Hold on colour',.12,0,.6), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1), R('soft','Softness',.004,0,.2) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 o = vec2(p_x * ar * .5, p_y * .5);
  vec2 c = centered(uv) - o;
  vec2 e = vec2(ar * .5, .5) + abs(o);
  int s = int(p_shape + .5);
  float d, maxR;
  if (s == 0){ d = length(c); maxR = length(e); }
  else if (s == 1){ vec2 k = c / vec2(ar, 1.); d = max(abs(k.x), abs(k.y)); maxR = max(e.x / ar, e.y); }
  else { d = abs(c.x) + abs(c.y); maxR = e.x + e.y; }
  float h = clamp(p_hold, 0., .9);
  float p = uProgress;
  float span = .5 - h * .5;
  float q = p < .5 ? 1. - clamp(p / span, 0., 1.) : clamp((p - .5 - h * .5) / span, 0., 1.);
  float sf = max(p_soft, 1e-3);
  float r = mix(-sf, maxR + sf, q);
  float m = 1. - smoothstep(r - sf, r + sf, d);
  vec3 img = p < .5 ? texture(uA, uv).rgb : texture(uB, uv).rgb;
  if (p <= 0. || p >= 1.) m = 1.;
  return vec4(mix(p_color, img, m), 1.);
}` });

FX.register({ id:'tr-cornercurve', name:'Corner curve', cat:'transition', search:['hyperbolic', 'diagonal', 'corner wipe', 'diag'],
  desc:'B sweeps in from a corner behind a curved front that hugs the two far edges last.',
  params:[ S('corner','Corner',['Top left','Top right','Bottom right','Bottom left'],0), R('bend','Bend',.8,0,1), R('soft','Softness',.03,0,.3), R('line','Edge line',0,0,.03), C('color','Line colour','#ffffff','accent') ],
  fs:`vec4 fx(vec2 uv){
  int k = int(p_corner + .5);
  float x = (k == 0 || k == 3) ? uv.x : 1. - uv.x;
  float y = (k == 0 || k == 1) ? 1. - uv.y : uv.y;
  float straight = 1. - (x + y) * .5;
  float hyper = sqrt(max((1. - x) * (1. - y), 0.));
  float f = mix(straight, hyper, p_bend);
  float s = max(p_soft * .5, 1e-4);
  float t = mix(1. + s * 2. + p_line, -s * 2. - p_line, uProgress);
  float m = smoothstep(t - s, t + s, f);
  ${WIPE_END}
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m);
  if (p_line > 0. && uProgress > 0. && uProgress < 1.) col = mix(col, p_color, 1. - smoothstep(p_line * .5, p_line * .5 + fwidth(f) * 1.5, abs(f - t)));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-rosewipe', name:'Rose wipe', cat:'transition', search:['flower', 'petals', 'bloom', 'polar', 'iris'],
  desc:'B blooms open through deep petals, with a second layer turning the other way.',
  params:[ I('petals','Petals',5,2,12), R('depth','Petal depth',.7,0,.92), R('turn','Turn',60,-360,360,1), T('layers','Second layer',true), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1), R('soft','Softness',.006,0,.2) ],
  fs:`float rose_petal(float a, float n, float depth){ return 1. - depth * (.5 - .5 * cos(a * n)); }
vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 o = vec2(p_x * ar * .5, p_y * .5);
  vec2 c = centered(uv) - o;
  float maxR = length(vec2(ar * .5, .5) + abs(o));
  float n = floor(p_petals + .5);
  float depth = clamp(p_depth, 0., .92);
  float p = uProgress;
  float sf = max(p_soft, 1e-3);
  float R0 = mix(0., (maxR + sf * 2.) / (1. - depth), pow(p, 1.8));
  float r = length(c);
  float a = atan(c.y, c.x);
  float spin = radians(p_turn) * p;
  float d = r - R0 * rose_petal(a - spin, n, depth);
  if (p_layers > .5) d = min(d, r - R0 * .86 * rose_petal(a + spin + PI / n, n, depth));
  float m = 1. - smoothstep(-sf, sf, d);
  ${WIPE_END}
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-wobbleiris', name:'Wobble iris', cat:'transition', search:['blob', 'organic', 'burn out', 'liquid', 'morph mask'],
  desc:'A soft-edged blob opens from a point, its outline wobbling as it grows, with an optional scorched rim.',
  params:[ I('lobes','Lobes',5,2,12), R('wobble','Wobble',.22,0,.5), R('rim','Rim',.02,0,.08), C('color','Rim colour','#1b0e06',false), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1), R('soft','Softness',.006,0,.1) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 o = vec2(p_x * ar * .5, p_y * .5);
  vec2 c = centered(uv) - o;
  float maxR = length(vec2(ar * .5, .5) + abs(o));
  float p = uProgress;
  float r = length(c);
  vec2 dir = r > 0. ? c / r : vec2(0., 1.);
  float a = atan(c.y, c.x);
  float n = floor(p_lobes + .5);
  float w = .55 * sin(a * n + p * 5.) + .45 * (vnoise(dir * n * .7 + vec2(p * 2.3, p * 1.7)) * 2. - 1.);
  float wob = clamp(p_wobble, 0., .5) * (.35 + .65 * sin(p * PI));
  float sf = max(p_soft, 1e-3);
  float R0 = p * (maxR + p_rim + sf * 2.) / (1. - clamp(p_wobble, 0., .5));
  float d = r - R0 * (1. + wob * w);
  float m = 1. - smoothstep(-sf, sf, d);
  ${WIPE_END}
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m);
  if (p_rim > 0.){
    float scorch = .6 + .4 * fbm(c * 18. + 4.);
    float band = (1. - smoothstep(0., p_rim * scorch, d)) * smoothstep(-sf, sf * 2., d);
    col = mix(col, p_color, band * smoothstep(0., .04, p) * (1. - step(1., p)));
  }
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-spiralwipe', name:'Spiral wipe', cat:'transition', search:['spiral', 'swirl', 'coil', 'radial'],
  desc:'B unrolls along a spiral ribbon from the centre out, or winds in from the edge.',
  params:[ R('turns','Turns',3,1,8), I('arms','Arms',1,1,4), S('dir','Direction',['Outward','Inward'],0), T('ccw','Anticlockwise'), R('soft','Softness',.01,0,.2), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 o = vec2(p_x * ar * .5, p_y * .5);
  vec2 c = centered(uv) - o;
  float maxR = length(vec2(ar * .5, .5) + abs(o));
  float turns = max(p_turns, .5);
  float a = atan(c.y, c.x) / TAU + .5;
  if (p_ccw > .5) a = 1. - a;
  a = fract(a * floor(p_arms + .5));
  float u = length(c) / maxR * turns;
  float n = floor(u - a);
  float F = (n + a + 1.) / (turns + 1.);
  if (p_dir > .5) F = 1. - F;
  float s = max(p_soft * .5, 1e-4);
  float t = mix(-s, 1. + s, uProgress);
  float m = 1. - smoothstep(t - s, t + s, F);
  ${WIPE_END}
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-ringswipe', name:'Rings wipe', cat:'transition', search:['concentric', 'radial', 'clock', 'target'],
  desc:'Concentric rings each sweep round like a clock hand, alternate rings turning opposite ways.',
  params:[ I('rings','Rings',6,2,24), R('stagger','Stagger',.5,0,.9), S('order','Order',['Outer first','Inner first'],0), R('start','Start angle',0,-180,180,1), R('soft','Softness',.01,0,.2), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 o = vec2(p_x * ar * .5, p_y * .5);
  vec2 c = centered(uv) - o;
  float maxR = length(vec2(ar * .5, .5) + abs(o));
  float N = floor(p_rings + .5);
  float i = min(floor(length(c) / maxR * N), N - 1.);
  float ord = i / max(N - 1., 1.);
  if (p_order < .5) ord = 1. - ord;
  float st = clamp(p_stagger, 0., .9);
  float lp = clamp((uProgress - ord * st) / (1. - st), 0., 1.);
  float a = fract(atan(c.x, c.y) / TAU + p_start / 360.);
  if (mod(i, 2.) > .5) a = 1. - a;
  float s = max(p_soft * .5, 1e-4);
  float t = mix(-s, 1. + s, lp);
  float m = 1. - smoothstep(t - s, t + s, a);
  ${WIPE_END}
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-ringblinds', name:'Ring blinds', cat:'transition', search:['radial blinds', 'venetian', 'concentric', 'spokes', 'scale wipe'],
  desc:'Blinds bent into concentric rings or spokes, each slat opening from its middle in turn.',
  params:[ I('count','Slats',10,2,40), S('kind','Pattern',['Rings','Spokes'],0), R('stagger','Stagger',.5,0,.9), S('order','Order',['Centre out','Edge in'],0), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 o = vec2(p_x * ar * .5, p_y * .5);
  vec2 c = centered(uv) - o;
  float maxR = length(vec2(ar * .5, .5) + abs(o));
  float N = floor(p_count + .5);
  bool rings = p_kind < .5;
  float g = rings ? length(c) / maxR * N : (atan(c.y, c.x) / TAU + .5) * N;
  float idx = min(floor(g), N - 1.), f = fract(g);
  float ord = idx / max(N - 1., 1.);
  if (p_order > .5) ord = 1. - ord;
  float st = clamp(p_stagger, 0., .9);
  float lp = clamp((uProgress - ord * st) / (1. - st), 0., 1.);
  float d = abs(f - .5) * 2.;
  float aa = clamp(fwidth(g) * 2., .002, .2);
  float t = mix(-aa, 1. + aa, lp);
  float m = 1. - smoothstep(t - aa, t + aa, d);
  ${WIPE_END}
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-checker', name:'Checker wipe', cat:'transition', search:['checkerboard', 'chessboard', 'squares', 'grid'],
  desc:'Half the squares of a checkerboard wipe across, then the other half follow.',
  params:[ I('rows','Rows',8,2,40), S('dir','Direction',DIRS4,1), R('overlap','Overlap',.2,0,1), R('soft','Softness',.02,0,.3) ],
  fs:`vec4 fx(vec2 uv){
  vec2 grid = vec2(max(1., floor(p_rows * aspect() + .5)), max(p_rows, 1.));
  vec2 id = floor(uv * grid), f = fract(uv * grid);
  float odd = mod(id.x + id.y, 2.);
  float dur = .5 + clamp(p_overlap, 0., 1.) * .5;
  float lp = clamp((uProgress - odd * (1. - dur)) / dur, 0., 1.);
  int k = int(p_dir + .5);
  float coord = k == 0 ? 1. - f.y : k == 1 ? f.x : k == 2 ? f.y : 1. - f.x;
  float s = max(p_soft * .5, fwidth(coord) * .75);
  float t = mix(-s, 1. + s, lp);
  float m = 1. - smoothstep(t - s, t + s, coord);
  ${WIPE_END}
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-combwipe', name:'Comb wipe', cat:'transition', nonLocal:true, search:['band wipe', 'split band', 'interlocking', 'strips'],
  desc:'Bands wipe or slide in from alternate sides and interlock like the teeth of a comb.',
  params:[ I('bands','Bands',7,2,40), R('angle','Angle',0,-90,90,1), S('mode','Motion',['Wipe','Slide in'],1), R('stagger','Stagger',0,0,.8), R('soft','Softness',.004,0,.1) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect(), ang = radians(p_angle);
  float cs = abs(cos(ang)), sn = abs(sin(ang));
  vec2 c = rot(ang) * centered(uv);
  float ext = cs * ar * .5 + sn * .5, ext2 = sn * ar * .5 + cs * .5;
  float N = floor(p_bands + .5);
  float idx = clamp(floor((c.y / (2. * ext2) + .5) * N), 0., N - 1.);
  float sgn = mod(idx, 2.) < .5 ? 1. : -1.;
  float along = c.x / (2. * ext) + .5;
  float al = sgn > 0. ? along : 1. - along;
  float st = clamp(p_stagger, 0., .8);
  float lp = clamp((uProgress - idx / max(N - 1., 1.) * st) / (1. - st), 0., 1.);
  float s = max(p_soft * .5, 1e-4);
  float t = mix(-s, 1. + s, lp);
  float m = 1. - smoothstep(t - s, t + s, al);
  ${WIPE_END}
  vec2 buv = uv;
  if (p_mode > .5) buv = uncentered(rot(-ang) * (c + vec2(sgn * (1. - lp) * 2. * ext, 0.)));
  return vec4(mix(texture(uA, uv).rgb, texture(uB, buv).rgb, m), 1.);
}` });

FX.register({ id:'tr-randombars', name:'Random bars', cat:'transition', search:['random blocks', 'random wipe', 'stripes', 'scanlines'],
  desc:'Full-width bars, or blocks, switch to B one by one in random order.',
  params:[ S('mode','Pattern',['Bars','Blocks'],0), I('count','Count',48,4,200), S('dir','Bars run',['Across','Down'],0), R('fade','Fade per bar',.12,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec2 id;
  if (p_mode < .5) id = vec2(floor((p_dir < .5 ? uv.y : uv.x) * p_count), 0.);
  else { float n = max(2., floor(p_count / 4. + .5)); id = floor(uv * vec2(max(1., floor(n * aspect() + .5)), n)); }
  float h = hash12(id + 7.31);
  float w = max(p_fade, .002);
  float m = clamp((uProgress - h * (1. - w)) / w, 0., 1.);
  ${WIPE_END}
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-boxpath', name:'Box path', cat:'transition', search:['spiral boxes', 'zig-zag blocks', 'snake', 'boustrophedon', 'grid'],
  desc:'A grid of boxes fills with B along a path, spiralling in or out or snaking row by row.',
  params:[ S('path','Path',['Spiral in','Spiral out','Snake by rows','Snake by columns'],0), I('rows','Rows',8,2,24), R('trail','Trail',2,1,12), S('fill','Each box',['Sweeps in','Fades in'],0) ],
  fs:`vec4 fx(vec2 uv){
  float H = max(2., floor(p_rows + .5));
  float W = max(2., floor(H * aspect() + .5));
  float i = min(floor(uv.x * W), W - 1.);
  float j = min(floor((1. - uv.y) * H), H - 1.);
  float fx_ = fract(uv.x * W), fy = 1. - fract(uv.y * H);
  float N = W * H;
  int path = int(p_path + .5);
  float idx, tr;
  if (path <= 1){
    float k = min(min(i, j), min(W - 1. - i, H - 1. - j));
    float before = k * (2. * W + 2. * H - 4.) - 4. * k * (k - 1.);
    float w = W - 2. * k, h = H - 2. * k;
    float x = i - k, y = j - k, pos;
    if (y < .5){ pos = x; tr = fx_; }
    else if (x > w - 1.5){ pos = (w - 1.) + y; tr = fy; }
    else if (y > h - 1.5){ pos = (w - 1.) + (h - 1.) + (w - 1. - x); tr = 1. - fx_; }
    else { pos = 2. * (w - 1.) + (h - 1.) + (h - 1. - y); tr = 1. - fy; }
    idx = before + pos;
    if (path == 1){ idx = N - 1. - idx; tr = 1. - tr; }
  } else if (path == 2){
    bool even = mod(j, 2.) < .5;
    idx = j * W + (even ? i : W - 1. - i); tr = even ? fx_ : 1. - fx_;
  } else {
    bool even = mod(i, 2.) < .5;
    idx = i * H + (even ? j : H - 1. - j); tr = even ? fy : 1. - fy;
  }
  float L = clamp(p_trail, 1., N);
  float lp = clamp((uProgress * (N - 1. + L) - idx) / L, 0., 1.);
  float m;
  if (p_fill < .5){ float aa = max(fwidth(tr), 1e-3); float t = mix(-aa, 1. + aa, lp); m = 1. - smoothstep(t - aa, t + aa, tr); }
  else m = lp;
  ${WIPE_END}
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-splatter', name:'Paint splatter', cat:'transition', search:['splash', 'brush', 'ink', 'paint', 'blot'],
  desc:'Ragged splats of B land one after another, spread and run together until A is covered.',
  params:[ I('count','Splats',16,4,32), R('rough','Roughness',.55,0,1), R('spread','Timing spread',.8,0,.9), R('size','Splat size',.13,.05,.6), I('seed','Seed',1,0,99) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 c = centered(uv);
  float grain = fbm(c * 7. + p_seed * 1.3) - .5;
  float dmin = 1e3;
  for (int i = 0; i < 32; i++){
    if (float(i) >= p_count) break;
    float fi = float(i) + p_seed * 31.;
    vec2 ctr = (hash22(vec2(fi * 1.7, 5.3)) - .5) * vec2(ar, 1.) * 1.05;
    float t0 = hash12(vec2(fi, 9.1)) * clamp(p_spread, 0., .9);
    float lp = clamp((uProgress - t0) / (1. - t0), 0., 1.);
    if (lp <= 0.) continue;
    float base = p_size * (.5 + hash12(vec2(fi, 3.7)));
    float R0 = base * (1. - pow(1. - lp, 4.)) + 1.6 * pow(uProgress, 6.);
    vec2 q = c - ctr;
    float r = length(q);
    vec2 dir = r > 0. ? q / r : vec2(0., 1.);
    float spike = pow(vnoise(dir * 6. + fi * 3.1), 4.);
    float d = r - R0 * (1. + p_rough * (1.1 * spike + .7 * grain));
    dmin = min(dmin, d);
  }
  float aa = 1.5 / uRes.y;
  float m = 1. - smoothstep(-aa, aa, dmin);
  ${WIPE_END}
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-bubbles', name:'Bubble reveal', cat:'transition', search:['circles', 'dots', 'scattered', 'pop', 'reveal'],
  desc:'Circles of B open at scattered points, swell and merge until they fill the frame.',
  params:[ I('count','Bubbles',14,3,32), R('size','Size',.22,.05,.6), R('spread','Timing spread',.6,0,.9), I('seed','Seed',3,0,99), R('line','Rim',.004,0,.03), C('color','Rim colour','#ffffff','accent') ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 c = centered(uv);
  float dmin = 1e3;
  for (int i = 0; i < 32; i++){
    if (float(i) >= p_count) break;
    float fi = float(i) + p_seed * 31.;
    vec2 ctr = (hash22(vec2(fi * 1.3, 2.9)) - .5) * vec2(ar, 1.);
    float t0 = hash12(vec2(fi, 6.1)) * clamp(p_spread, 0., .9);
    float lp = clamp((uProgress - t0) / (1. - t0), 0., 1.);
    if (lp <= 0.) continue;
    float base = p_size * (.5 + hash12(vec2(fi, 8.3)));
    float e = 1. - pow(1. - lp, 3.);
    float R0 = base * e + 1.4 * pow(uProgress, 6.);
    dmin = min(dmin, length(c - ctr) - R0);
  }
  float aa = 1.5 / uRes.y;
  float m = 1. - smoothstep(-aa, aa, dmin);
  ${WIPE_END}
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m);
  if (p_line > 0. && uProgress > 0. && uProgress < 1.) col = mix(col, p_color, 1. - smoothstep(p_line * .5, p_line * .5 + aa, abs(dmin)));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-gradientwipe', name:'Gradient wipe', cat:'transition', search:['gradient map', 'image wipe', 'luma map', 'conic', 'radial', 'threshold'],
  desc:'B arrives through a built-in gradient map, from the darkest tone of the map to the lightest.',
  params:[ S('map','Map',['Linear','Radial','Conic','Spiral','Diamond','Noise','Ripple'],3), R('angle','Angle',30,-180,180,1), R('scale','Scale',1,.5,12), R('soft','Softness',.05,0,.5), T('inv','Invert'), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 o = vec2(p_x * ar * .5, p_y * .5);
  vec2 c = centered(uv) - o;
  vec2 e = vec2(ar * .5, .5) + abs(o);
  float maxR = length(e);
  float ang = radians(p_angle);
  int k = int(p_map + .5);
  float g;
  if (k == 0){ vec2 dir = vec2(cos(ang), sin(ang)); float ext = abs(dir.x) * ar * .5 + abs(dir.y) * .5; g = dot(centered(uv), dir) / (2. * ext) + .5; }
  else if (k == 1) g = length(c) / maxR;
  else if (k == 2) g = fract((atan(c.y, c.x) - ang) / TAU);
  else if (k == 3) g = (fract((atan(c.y, c.x) - ang) / TAU) + length(c) / maxR * p_scale) / (1. + p_scale);
  else if (k == 4){ vec2 q = rot(ang) * c; g = (abs(q.x) + abs(q.y)) / (e.x + e.y) / 1.42; }
  else if (k == 5) g = clamp((fbm(c * p_scale + 3.1) - .2) / .6, 0., 1.);
  else g = .5 - .5 * cos(length(c) / maxR * p_scale * TAU);
  g = clamp(g, 0., 1.);
  if (p_inv > .5) g = 1. - g;
  float s = max(p_soft * .5, 1e-3);
  float t = mix(-s, 1. + s, uProgress);
  float m = 1. - smoothstep(t - s, t + s, g);
  ${WIPE_END}
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-staircase', name:'Staircase sweep', cat:'transition', search:['line sweep', 'stepped', 'diagonal', 'stairs'],
  desc:'A diagonal wipe built from thin staggered lines, so the edge climbs like a staircase.',
  params:[ R('angle','Angle',0,-180,180,1), R('thick','Line thickness',.03,.004,.2), R('slant','Slant',.7,0,2), R('jitter','Jitter',.25,0,1), R('soft','Softness',.002,0,.05) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect(), ang = radians(p_angle);
  float cs = abs(cos(ang)), sn = abs(sin(ang));
  vec2 c = rot(ang) * centered(uv);
  float ext = cs * ar * .5 + sn * .5, ext2 = sn * ar * .5 + cs * .5;
  float th = max(p_thick, .002);
  float row = floor(c.y / th);
  float rowN = clamp((row + .5) * th / (2. * ext2) + .5, 0., 1.);
  float span = p_slant * 2. * ext2;
  float jit = p_jitter * .2;
  float s = max(p_soft * .5, 1e-4);
  float base = mix(-ext - s * 2. - span - jit * .5, ext + s * 2. + jit * .5, uProgress);
  float front = base + rowN * span + (hash12(vec2(row, 4.7)) - .5) * jit;
  float m = 1. - smoothstep(-s, s, c.x - front);
  ${WIPE_END}
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-jaws', name:'Jaws', cat:'transition', nonLocal:true, search:['teeth', 'sawtooth', 'split', 'zipper', 'spikes'],
  desc:'A splits along a toothed line and the two halves pull apart to show B.',
  params:[ I('teeth','Teeth',8,2,40), R('height','Tooth height',.12,0,.4), S('shape','Teeth',['Spikes','Blocks','Waves','Bevelled'],0), R('angle','Angle',0,-90,90,1), R('shadow','Shadow',.5,0,1) ],
  fs:`float jaws_profile(float x, int s){
  float f = fract(x);
  if (s == 0) return 1. - 4. * abs(f - .5);
  if (s == 1) return f < .5 ? 1. : -1.;
  if (s == 2) return sin(x * TAU);
  return clamp((1. - 4. * abs(f - .5)) * 2., -1., 1.);
}
vec4 fx(vec2 uv){
  float ar = aspect(), ang = radians(p_angle);
  float cs = abs(cos(ang)), sn = abs(sin(ang));
  vec2 c = rot(ang) * centered(uv);
  float extX = cs * ar * .5 + sn * .5, extY = sn * ar * .5 + cs * .5;
  float g = jaws_profile((c.x / (2. * extX) + .5) * floor(p_teeth + .5), int(p_shape + .5)) * p_height * .5;
  float D = uProgress * (extY + p_height * .5 + .02);
  float aa = 1.5 / uRes.y;
  float dt = c.y - D - g, db = g - c.y - D;
  float mt = smoothstep(-aa, aa, dt), mb = smoothstep(-aa, aa, db);
  vec3 at = texture(uA, uncentered(rot(-ang) * (c - vec2(0., D)))).rgb;
  vec3 ab = texture(uA, uncentered(rot(-ang) * (c + vec2(0., D)))).rgb;
  vec3 b = texture(uB, uv).rgb;
  float sh = clamp(exp(dt * 30.) + exp(db * 30.), 0., 1.) * p_shadow * .7 * sin(uProgress * PI);
  b *= 1. - sh;
  vec3 col = b * clamp(1. - mt - mb, 0., 1.) + at * mt + ab * mb;
  if (uProgress >= 1.) col = texture(uB, uv).rgb;
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-gridiris', name:'Grid iris', cat:'transition', search:['grid wipe', 'cells', 'doors', 'pinwheel', 'tiles'],
  desc:'Every cell of a grid opens on its own, as doors, a shutter, a clock hand or a corner box, in a wave.',
  params:[ I('rows','Rows',7,2,30), S('shape','Each cell opens as',['Doors','Shutter','Clock','Corner'],2), S('order','Order',['Centre out','Diagonal','Random'],0), R('stagger','Stagger',.6,0,.9), R('tilt','Tilt',0,-45,45,1) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect(), ang = radians(p_tilt);
  float n = max(p_rows, 1.);
  vec2 g = rot(ang) * centered(uv) * n;
  vec2 id = floor(g), f = fract(g) - .5;
  vec2 cc = rot(-ang) * ((id + .5) / n);
  int om = int(p_order + .5);
  float o = om == 0 ? length(cc) / length(vec2(ar * .5, .5)) : om == 1 ? (cc.x / ar - cc.y) * .5 + .5 : hash12(id + 21.7);
  o = clamp(o, 0., 1.);
  float st = clamp(p_stagger, 0., .9);
  float lp = clamp((uProgress - o * st) / (1. - st), 0., 1.);
  int sm = int(p_shape + .5);
  float field = sm == 0 ? abs(f.x) * 2. : sm == 1 ? abs(f.y) * 2. : sm == 2 ? fract(atan(f.x, f.y) / TAU + .5) : max(f.x + .5, .5 - f.y);
  float aa = sm == 2 ? .01 : clamp(fwidth(field) * .75, 1e-3, .1);
  float t = mix(-aa, 1. + aa, lp);
  float m = 1. - smoothstep(t - aa, t + aa, field);
  ${WIPE_END}
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-chevron', name:'Chevron wipe', cat:'transition', search:['arrows', 'arrow wipe', 'v shape', 'pointed'],
  desc:'A pointed front pushes across with a few chevron stripes of B running ahead of it.',
  params:[ R('angle','Direction',0,-180,180,1), R('sharp','Point',.6,0,2), I('arrows','Arrows ahead',3,0,6), R('width','Arrow width',.05,.01,.2), R('soft','Softness',.003,0,.05) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 dir = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 c = centered(uv);
  float along = dot(c, dir), across = dot(c, vec2(-dir.y, dir.x));
  float ext = abs(dir.x) * ar * .5 + abs(dir.y) * .5, extA = abs(dir.y) * ar * .5 + abs(dir.x) * .5;
  float f = along + abs(across) * p_sharp;
  float w = max(p_width, .005);
  float lead = floor(p_arrows + .5) * w * 2.;
  float s = max(p_soft * .5, 5e-4);
  float front = mix(-ext - lead - s * 2., ext + extA * p_sharp + s * 2., uProgress);
  float m = 1. - smoothstep(-s, s, f - front);
  float k = (f - front) / (2. * w);
  float ds = (abs(fract(k) - .25) - .25) * 2. * w;
  float arrow = (1. - smoothstep(-s, s, ds)) * step(0., k) * step(k, floor(p_arrows + .5));
  m = max(m, arrow);
  ${WIPE_END}
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-wedge', name:'Wedge wipe', cat:'transition', search:['fan', 'v wipe', 'radial', 'pie'],
  desc:'A wedge opens both ways at once from a centre line until it closes behind the far side.',
  params:[ R('angle','Angle',90,-180,180,1), I('wedges','Wedges',1,1,8), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1), R('soft','Softness',.006,0,.2) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 c = centered(uv) - vec2(p_x * ar * .5, p_y * .5);
  float a = atan(c.y, c.x) - radians(p_angle);
  float g = abs(fract(a * floor(p_wedges + .5) / TAU + .5) - .5) * 2.;
  float s = max(p_soft * .5, 1e-4);
  float t = mix(-s, 1. + s, uProgress);
  float m = 1. - smoothstep(t - s, t + s, g);
  ${WIPE_END}
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-crosshatch', name:'Crosshatch spread', cat:'transition', search:['lines', 'threads', 'scratch', 'grid lines'],
  desc:'B shoots out from a point along random horizontal and vertical lines, then the gaps fill in.',
  params:[ R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1), R('reach','Reach',2.5,1,8), R('lines','Line width (px)',6,1,24,1), R('fade','Fill at the end',.15,.01,.5) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 c = centered(uv) - vec2(p_x * ar * .5, p_y * .5);
  float lw = max(p_lines, 1.);
  vec2 px = floor(uv * uRes / lw);
  float r = uProgress - min(hash12(vec2(px.y, 1.37)), hash12(vec2(2.71, px.x)));
  float dist = length(c) / max(p_reach, .1);
  float m = mix(step(dist, r), 1., smoothstep(1. - p_fade, 1., uProgress));
  ${WIPE_END}
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-noisewipe', name:'Noise-broken wipe', cat:'transition', search:['organic wipe', 'erode', 'blobs', 'crumble'],
  desc:'A straight wipe whose front breaks up into islands and inlets of noise as it passes.',
  params:[ R('angle','Angle',0,-180,180,1), R('width','Break-up width',.35,.05,1), R('scale','Noise scale',8,1,40), R('line','Edge line',0,0,.1), C('color','Edge colour','#ffd9a0','accent') ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 dir = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 c = centered(uv);
  float ext = abs(dir.x) * ar * .5 + abs(dir.y) * .5;
  float x = dot(c, dir) / (2. * ext) + .5;
  float w = max(p_width, .02);
  float front = mix(-w * .5, 1. + w * .5, uProgress);
  float g = clamp((front - x) / w + .5, 0., 1.);
  float n = clamp((fbm(c * p_scale + 7.) * .8 + fbm(c * p_scale * 4. + 2.) * .2 - .15) / .7, .03, .97);
  float aa = .02;
  float m = smoothstep(n - aa, n + aa, g);
  ${WIPE_END}
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m);
  if (p_line > 0.) col = mix(col, p_color, (1. - smoothstep(0., p_line, abs(g - n))) * step(.001, g) * step(g, .999));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-shapezoom', name:'Shape zoom-through', cat:'transition', nonLocal:true, search:['zoom through', 'mask zoom', 'fly through', 'portal', 'keyhole'],
  desc:'A shape opens in A and the camera flies through it into B.',
  params:[ S('shape','Shape',['Circle','Rounded square','Diamond','Triangle','Hexagon','Plus'],0), R('size','Opening size',.2,.05,.5), R('zoom','Zoom depth',24,4,80), R('spin','Turn',15,-180,180,1), R('rim','Rim',.015,0,.1), C('color','Rim colour','#ffffff','accent') ],
  fs:`float zt_sd(vec2 p, int s){
  if (s == 0) return length(p) - 1.;
  if (s == 1) return sdRoundBox(p, vec2(.88), .32);
  if (s == 2) return (abs(p.x) + abs(p.y) - 1.2) * .7071;
  if (s == 3) return sdTri(p, 1.3);
  if (s == 4){ vec3 k = vec3(-.8660254, .5, .57735); p = abs(p); p -= 2. * min(dot(k.xy, p), 0.) * k.xy; p -= vec2(clamp(p.x, -k.z, k.z), 1.); return length(p) * sign(p.y); }
  vec2 q = abs(p); return min(sdRoundBox(q, vec2(1., .38), .12), sdRoundBox(q, vec2(.38, 1.), .12));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float z = exp(log(max(p_zoom, 1.)) * p * p);
  float open = p_size * smoothstep(0., .35, p);
  float Rs = max(open * z + 4. * pow(max(p - .8, 0.) / .2, 3.), 1e-4);
  vec2 q = rot(radians(p_spin) * p) * centered(uv) / Rs;
  float d = zt_sd(q, int(p_shape + .5)) * Rs;
  float aa = 1.5 / uRes.y;
  float m = 1. - smoothstep(-aa, aa, d);
  ${WIPE_END}
  vec3 a = texture(uA, .5 + (uv - .5) / z).rgb;
  float bz = mix(1.35, 1., p);
  vec3 b = texture(uB, .5 + (uv - .5) / bz).rgb;
  vec3 col = mix(a, b, m);
  float rw = p_rim * Rs / max(p_size, .05);
  if (rw > 0. && p > 0. && p < 1.) col = mix(col, p_color, (1. - smoothstep(rw - aa, rw + aa, d)) * smoothstep(-aa, aa, d));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-lightwipe', name:'Light wipe', cat:'transition', search:['glow wipe', 'light front', 'flare', 'iris', 'doors'],
  desc:'A glowing front opens out as a circle, doors, a box or a diamond, lighting the edge where A turns into B.',
  params:[ S('shape','Shape',['Circle','Doors','Box','Diamond'],0), R('width','Glow width',.07,.01,.3), R('intensity','Intensity',.8,0,4), C('color','Light','#fff1d6','accent2'), T('source','Light takes the image colour'), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 o = vec2(p_x * ar * .5, p_y * .5);
  vec2 c = centered(uv) - o;
  vec2 e = vec2(ar * .5, .5) + abs(o);
  int s = int(p_shape + .5);
  float d, maxR;
  if (s == 0){ d = length(c); maxR = length(e); }
  else if (s == 1){ d = abs(c.x); maxR = e.x; }
  else if (s == 2){ vec2 k = c / vec2(ar, 1.); d = max(abs(k.x), abs(k.y)); maxR = max(e.x / ar, e.y); }
  else { d = abs(c.x) + abs(c.y); maxR = e.x + e.y; }
  float w = max(p_width, .005);
  float p = uProgress;
  float R0 = mix(-w * 3., maxR + w * 3., p);
  float sw = w * .2;
  float m = 1. - smoothstep(R0 - sw, R0 + sw, d);
  ${WIPE_END}
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec3 col = mix(a, b, m);
  float x = (d - R0) / w;
  float glow = (exp(-x * x * 2.) + .25 * exp(x * 1.5) * step(x, 0.)) * p_intensity;
  glow *= smoothstep(0., .04, p) * (1. - smoothstep(.96, 1., p));
  vec3 light = p_source > .5 ? mix(a, b, .5) * 1.6 + .15 : p_color;
  col += light * glow;
  return vec4(clamp(col, 0., 1.), 1.);
}` });
