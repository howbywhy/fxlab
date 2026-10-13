/* ---------------- Transitions: moves ----------------
   Camera moves and moving frames: squeezes, stretches, slides, cards, whips,
   spins and zooms. Everything is driven by uProgress, and each one is checked
   to be exactly A at 0 and exactly B at 1. */

FX.register({ id:'tr-squeeze-line', name:'Squeeze to a line', cat:'transition', search:['tv off', 'collapse', 'crt', 'squash'],
  desc:'A squeezes down to a thin bright line and goes, with the colour channels tearing slightly as it closes.',
  params:[ S('axis','Squeeze to',['Horizontal line','Vertical line']), S('mode','Mode',['A closes over B','A closes, B opens']),
    R('sep','Colour tearing',.04,0,.15), R('glow','Line glow',.6,0,1), C('bg','Ground','#0d0d0e','ground') ],
  fs:`float squeeze_t(vec2 uv){ return p_axis < .5 ? uv.y : uv.x; }
vec2 squeeze_set(vec2 uv, float t){ return p_axis < .5 ? vec2(uv.x, t) : vec2(t, uv.y); }
/* the image squeezed to thickness s about the centre line; inside is its soft-edged coverage */
vec3 squeeze_layer(sampler2D tex, vec2 uv, float s, float sep, out float inside){
  s = max(s, 1e-4);
  float t = (squeeze_t(uv) - .5) / s + .5;
  float px = 1. / ((p_axis < .5 ? uRes.y : uRes.x) * s);
  inside = clamp(.5 + min(t, 1. - t) / px, 0., 1.);
  float r = texture(tex, squeeze_set(uv, clamp(t + sep, 0., 1.))).r;
  float g = texture(tex, squeeze_set(uv, clamp(t, 0., 1.))).g;
  float b = texture(tex, squeeze_set(uv, clamp(t - sep, 0., 1.))).b;
  return vec3(r, g, b);
}
vec4 fx(vec2 uv){
  float p = uProgress, inside, s, env;
  vec3 col;
  if (p_mode < .5){
    s = 1. - p;
    vec3 a = squeeze_layer(uA, uv, s, p_sep * p, inside);
    inside *= smoothstep(0., .004, s);
    col = mix(texture(uB, uv).rgb, a, inside);
    env = (1. - smoothstep(.9, 1., p));
  } else {
    s = abs(1. - 2. * p);
    vec3 c = p < .5 ? squeeze_layer(uA, uv, s, p_sep * (1. - s), inside) : squeeze_layer(uB, uv, s, p_sep * (1. - s), inside);
    col = mix(p_bg, c, inside);
    env = 1.;
  }
  /* the line flares as the picture gets thin, like a set switching off */
  float thin = 1. - s;
  float d = abs(squeeze_t(uv) - .5);
  float w = .002 + .03 * s;
  col += p_glow * env * thin * thin * (exp(-d / w) * .9 + exp(-d / (w * 6.)) * .25);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-axis-stretch', name:'Stretch', cat:'transition', search:['squeeze', 'accordion', 'squash', 'stretch in', 'stretch over'],
  desc:'B stretches in from one side while A squashes up to make room, so the two share the frame until A is gone.',
  params:[ S('dir','From',['Left','Right','Top','Bottom']), S('anchor','Anchor',['Edge','Centre']), R('shade','Fold shading',.4,0,1) ],
  fs:`vec4 fx(vec2 uv){
  int d = int(p_dir + .5);
  bool vert = d >= 2, flip = d == 1 || d == 2;
  float u = vert ? uv.y : uv.x;
  if (flip) u = 1. - u;
  float p = uProgress, su, seam;
  bool inB;
  if (p_anchor < .5){
    inB = u < p;
    su = inB ? u / max(p, 1e-4) : (u - p) / max(1. - p, 1e-4);
    seam = abs(u - p);
  } else {
    float h = abs(u - .5);
    inB = h < p * .5;
    su = inB ? .5 + (u - .5) / max(p, 1e-4) : (u < .5 ? u / max(1. - p, 1e-4) : 1. - (1. - u) / max(1. - p, 1e-4));
    seam = abs(h - p * .5);
  }
  if (flip) su = 1. - su;
  vec2 st = vert ? vec2(uv.x, su) : vec2(su, uv.y);
  vec3 col = inB ? texture(uB, st).rgb : texture(uA, st).rgb;
  /* whichever image is squashed falls into shade near the shared edge, like a folding sheet */
  float k = inB ? 1. - p : p;
  col *= 1. - p_shade * .7 * k * exp(-seam * 6.);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-split-slide', name:'Split slide', cat:'transition', search:['split', 'swap', 'halves', 'slide'],
  desc:'The frame splits into two halves that slide in opposite directions, taking A away or bringing B in.',
  params:[ S('axis','Split',['Left | right','Top / bottom']), S('motion','Halves move',['Past each other','Apart']),
    S('mode','Mode',['A slides away','B slides in','Both']), R('shadow','Shadow',.4,0,1), R('blur','Motion blur',.4,0,1) ],
  fs:`bool split_ok(vec2 s, float side){
  if (any(lessThan(s, vec2(0.))) || any(greaterThan(s, vec2(1.)))) return false;
  float sd = p_axis < .5 ? step(.5, s.x) : step(.5, s.y);
  return sd == side;
}
vec3 split_frame(vec2 uv, float p){
  bool vsplit = p_axis < .5;
  float side = vsplit ? step(.5, uv.x) : step(.5, uv.y);
  float sg = side * 2. - 1.;
  vec2 d; float L;
  if (p_motion > .5){ d = vsplit ? vec2(sg, 0.) : vec2(0., sg); L = .5; }
  else { d = vsplit ? vec2(0., -sg) : vec2(sg, 0.); L = 1.; }
  vec2 ua = uv - d * L * p, ub = uv - d * L * (p - 1.);
  int mode = int(p_mode + .5);
  float under = 1. - p_shadow * .55 * sin(PI * p);
  if (mode == 0) return split_ok(ua, side) ? texture(uA, ua).rgb : texture(uB, uv).rgb * under;
  if (mode == 1) return split_ok(ub, side) ? texture(uB, ub).rgb : texture(uA, uv).rgb * under;
  return split_ok(ua, side) ? texture(uA, ua).rgb : texture(uB, ub).rgb;
}
vec4 fx(vec2 uv){
  float spread = p_blur * sin(uProgress * PI) * .08;
  vec3 acc = vec3(0.);
  for (int i = 0; i < 10; i++){ float k = float(i) / 9. - .5; acc += split_frame(uv, clamp(uProgress + k * spread, 0., 1.)); }
  return vec4(acc / 10., 1.);
}` });

FX.register({ id:'tr-scaled-push', name:'Scaled push', cat:'transition', search:['push', 'slide', 'zoom out', 'carousel', 'pull back'],
  desc:'Both pictures pull back a little while B pushes A out of frame, then B settles to full size.',
  params:[ S('dir','Direction',['Left','Right','Up','Down']), R('scale','Pull back',.3,0,.7), R('gap','Gap',.05,0,.3),
    R('radius','Corner radius',.03,0,.12), C('bg','Ground','#0d0d0e','ground') ],
  fs:`float spush_mask(vec2 u, float r, float s){
  float asp = aspect();
  float sd = sdRoundBox((u - .5) * vec2(asp, 1.), vec2(asp, 1.) * .5, r);
  return clamp(.5 - sd * uRes.y * s, 0., 1.);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  int d = int(p_dir + .5);
  vec2 dv = d == 0 ? vec2(-1., 0.) : d == 1 ? vec2(1., 0.) : d == 2 ? vec2(0., 1.) : vec2(0., -1.);
  float m = sin(PI * p);
  float s = 1. - p_scale * m;
  vec2 w = (uv - .5) / s + .5;
  float k = 1. + p_gap;
  vec2 ua = w - dv * p * k, ub = ua + dv * k;
  float r = p_radius * m;
  vec3 col = p_bg;
  col = mix(col, texture(uA, ua).rgb, spush_mask(ua, r, s));
  col = mix(col, texture(uB, ub).rgb, spush_mask(ub, r, s));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-card-fly', name:'Picture fly-off', cat:'transition', search:['pop up', 'zoom boxes', 'picture in picture', 'pull back', 'box slide', 'card'],
  desc:'A shrinks into a card with a soft shadow, then flies off or tucks into a corner to leave B.',
  params:[ S('exit','Exit',['Off left','Off right','Off top','Off bottom','Into top left','Into top right','Into bottom left','Into bottom right','Into the centre']),
    R('card','Card size',.62,.3,.9), R('radius','Corner radius',.04,0,.15), R('shadow','Shadow',.6,0,1), T('rev','B arrives as a card',false) ],
  fs:`vec4 fx(vec2 uv){
  bool rev = p_rev > .5;
  float p = rev ? 1. - uProgress : uProgress;
  int e = int(p_exit + .5);
  float asp = aspect();
  vec2 c = vec2(.5);
  float s, rk;
  if (e < 4){
    /* shrink to a card, then leave: the move speeds up as it goes */
    float q1 = smoothstep(0., .45, p), q2 = smoothstep(.38, 1., p);
    q2 *= q2;
    s = mix(1., p_card, q1);
    vec2 dv = e == 0 ? vec2(-1., 0.) : e == 1 ? vec2(1., 0.) : e == 2 ? vec2(0., 1.) : vec2(0., -1.);
    c += dv * q2 * ((1. + s) * .5 + .14);
    rk = q1;
  } else {
    vec2 an = e == 4 ? vec2(0., 1.) : e == 5 ? vec2(1., 1.) : e == 6 ? vec2(0., 0.) : e == 7 ? vec2(1., 0.) : vec2(.5);
    s = 1. - p;
    c = an + (vec2(.5) - an) * s;
    rk = smoothstep(0., .2, p);
  }
  vec2 P = (uv - c) * vec2(asp, 1.);
  vec2 hb = vec2(asp, 1.) * .5 * s;
  float r = min(p_radius * rk, min(hb.x, hb.y));
  float m = clamp(.5 - sdRoundBox(P, hb, r) * uRes.y, 0., 1.);
  vec2 cuv = .5 + (uv - c) / max(s, 1e-4);
  vec3 card = rev ? texture(uB, cuv).rgb : texture(uA, cuv).rgb;
  vec3 under = rev ? texture(uA, uv).rgb : texture(uB, uv).rgb;
  /* soft drop shadow, a touch below the card; off at both ends so the cut frames stay clean */
  float sh = p_shadow * smoothstep(0., .15, p) * (1. - smoothstep(.85, 1., p));
  float d2 = sdRoundBox(P - vec2(0., -.02), hb, r);
  under *= 1. - sh * .75 * (1. - smoothstep(-.01, .07, d2));
  return vec4(mix(under, card, m), 1.);
}` });

FX.register({ id:'tr-scale-fade', name:'Scale and fade', cat:'transition', search:['zoom in', 'zoom out', 'scale in', 'fade through', 'ios', 'settle'],
  desc:'A eases back and fades while B settles in from slightly larger, or the picture zooms in before it hands over.',
  params:[ S('mode','Mode',['Settle','Zoom in, then fade','Zoom through colour']), R('amount','Scale',.12,0,.4),
    R('overlap','Overlap',.5,0,1), C('bg','Ground','#0d0d0e','ground') ],
  fs:`/* m is magnification: above 1 the picture is larger than the frame */
vec2 sfade_uv(vec2 uv, float m){ return .5 + (uv - .5) / m; }
float sfade_in(vec2 q, float m){
  float asp = aspect();
  float sd = sdRoundBox((q - .5) * vec2(asp, 1.), vec2(asp, 1.) * .5, 0.);
  return clamp(.5 - sd * uRes.y * m, 0., 1.);
}
vec4 fx(vec2 uv){
  float p = uProgress, ov = p_overlap;
  int mode = int(p_mode + .5);
  if (mode == 0){
    float ma = 1. - p_amount * p, mb = 1. + p_amount * (1. - p);
    /* A only dims toward the ground; B fades in over it, so the middle never goes muddy */
    float fa = 1. - .7 * p, fb = smoothstep(.5 - ov * .5, .5 + ov * .5 + .001, p);
    vec2 qa = sfade_uv(uv, ma);
    vec3 col = mix(p_bg, texture(uA, qa).rgb, fa * sfade_in(qa, ma));
    col = mix(col, texture(uB, sfade_uv(uv, mb)).rgb, fb);
    return vec4(col, 1.);
  }
  if (mode == 1){
    float z = 1. + p_amount * 4. * smoothstep(0., .9, p);
    float t = smoothstep(.6 - ov * .45, .95, p);
    return vec4(mix(texture(uA, sfade_uv(uv, z)).rgb, texture(uB, uv).rgb, t), 1.);
  }
  float za = 1. + p_amount * 4. * smoothstep(0., .5, p), zb = 1. + p_amount * 4. * (1. - smoothstep(.5, 1., p));
  float fa = 1. - smoothstep(.15, .5 + ov * .15, p), fb = smoothstep(.5 - ov * .15, .85, p);
  vec3 col = mix(p_bg, texture(uA, sfade_uv(uv, za)).rgb, fa);
  col = mix(col, texture(uB, sfade_uv(uv, zb)).rgb, fb);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-whip-pan', name:'Whip pan', cat:'transition', search:['swish', 'swipe', 'whip', 'speed ramp', 'velocity', 'camera', 'pan'],
  desc:'The camera whips sideways in a blur of motion, A streaks out and B lands in place.',
  params:[ S('dir','Direction',['Left','Right','Up','Down']), R('blur','Blur',.6,0,1), R('ramp','Speed ramp',.5,0,1) ],
  fs:`float whip_sig(float x){ return 1. / (1. + exp(-x)); }
/* slow-fast-slow travel; k sets how sharp the ramp is, normalised to run exactly 0 to 1 */
float whip_f(float p, float k){ float a = whip_sig(-k * .5), b = whip_sig(k * .5); return (whip_sig(k * (p - .5)) - a) / (b - a); }
vec3 whip_at(float w, float perp, bool vert, bool flip){
  /* A sits on [0,1) and B on [1,2) of a long strip; each mirrors past its own ends so the blur never runs into black */
  bool isB = w >= 1.;
  float t = isB ? w - 1. : w;
  t = 1. - abs(1. - mod(t, 2.));
  if (flip) t = 1. - t;
  vec2 st = vert ? vec2(perp, t) : vec2(t, perp);
  return isB ? texture(uB, st).rgb : texture(uA, st).rgb;
}
vec4 fx(vec2 uv){
  int d = int(p_dir + .5);
  bool vert = d >= 2, flip = d == 1 || d == 2;
  float a = vert ? uv.y : uv.x;
  if (flip) a = 1. - a;
  float perp = vert ? uv.x : uv.y;
  float p = uProgress, k = 4. + p_ramp * 14.;
  float f = whip_f(p, k);
  float v = (whip_f(p + .002, k) - whip_f(p - .002, k)) / .004;
  float vmax = k * .25 / (whip_sig(k * .5) - whip_sig(-k * .5));
  float L = p_blur * .5 * (v / vmax) * sin(PI * p);
  vec3 acc = vec3(0.);
  float ws = 0.;
  for (int i = 0; i < 28; i++){
    float x = float(i) / 27. - .5;
    float wt = 1. - abs(x) * 1.2;
    acc += whip_at(a + f + x * L, perp, vert, flip) * wt;
    ws += wt;
  }
  return vec4(acc / ws, 1.);
}` });

FX.register({ id:'tr-spin-blur', name:'Spin blur', cat:'transition', search:['spin', 'roll', 'rotate', 'twirl', 'camera'],
  desc:'The frame spins about its centre in a rotary blur and comes out of the turn on B.',
  params:[ R('turn','Turn (degrees)',180,30,720,1), S('dirn','Direction',['Clockwise','Anticlockwise']), R('blur','Blur',.5,0,1), R('zoom','Punch-in',.2,0,.6) ],
  fs:`vec3 spinb_at(vec2 uv, float ang, float m, bool b){
  vec2 st = mirrorUv(uncentered(rot(ang) * centered(uv) / m));
  return b ? texture(uB, st).rgb : texture(uA, st).rgb;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float T = radians(p_turn) * (p_dirn < .5 ? 1. : -1.);
  float env = sin(PI * p);
  float m = 1. + p_zoom * env;
  float x = smoothstep(.42, .58, p);
  /* the arc of the blur follows angular speed, capped so a big turn stays readable */
  float span = p_blur * env * min(abs(T) * .35, 1.1) * sign(T);
  vec3 acc = vec3(0.);
  for (int i = 0; i < 16; i++){
    float o = (float(i) / 15. - .5) * span;
    vec3 c = x < 1. ? spinb_at(uv, T * p + o, m, false) : vec3(0.);
    if (x > 0.) c = mix(c, spinb_at(uv, T * (p - 1.) + o, m, true), x);
    acc += c;
  }
  return vec4(acc / 16., 1.);
}` });

FX.register({ id:'tr-dutch-roll', name:'Dutch roll', cat:'transition', search:['roll', 'tilt', 'camera roll', 'canted', 'push'],
  desc:'The camera rolls onto a tilt while it pushes across, then levels out on B.',
  params:[ S('dir','Direction',['Left','Right']), R('angle','Roll (degrees)',25,0,60,1), R('zoom','Punch-in',.25,0,.6), R('blur','Motion blur',.5,0,1) ],
  fs:`vec3 droll_frame(vec2 uv, float p){
  float env = sin(PI * p);
  float th = radians(p_angle) * env * (p_dir < .5 ? 1. : -1.);
  vec2 q = uncentered(rot(th) * centered(uv) / (1. + p_zoom * env));
  float a = p_dir < .5 ? q.x : 1. - q.x;
  float w = a + p;
  bool isB = w >= 1.;
  float t = 1. - abs(1. - mod(isB ? w - 1. : w, 2.));
  if (p_dir > .5) t = 1. - t;
  vec2 st = vec2(t, 1. - abs(1. - mod(q.y, 2.)));
  return isB ? texture(uB, st).rgb : texture(uA, st).rgb;
}
vec4 fx(vec2 uv){
  float spread = p_blur * sin(uProgress * PI) * .1;
  vec3 acc = vec3(0.);
  for (int i = 0; i < 12; i++){ float k = float(i) / 11. - .5; acc += droll_frame(uv, clamp(uProgress + k * spread, 0., 1.)); }
  return vec4(acc / 12., 1.);
}` });

FX.register({ id:'tr-zoom-punch', name:'Zoom punch', cat:'transition', search:['scale cut', 'zoom in', 'pull in', 'pull back', 'zoom out', 'punch'],
  desc:'The camera punches in on A and keeps going, so B arrives small and grows into the frame, or the reverse.',
  params:[ S('mode','Move',['Punch in','Pull out']), R('scale','Scale',2.2,1.2,5), R('blur','Blur',.5,0,1), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1) ],
  fs:`vec3 zpunch_at(vec2 uv, vec2 c, float lm, bool b){
  vec2 st = mirrorUv(c + (uv - c) * exp(-lm));
  return b ? texture(uB, st).rgb : texture(uA, st).rgb;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = .5 + vec2(p_x, p_y) * .5;
  /* log magnification climbs steadily through the cut: A grows to the scale, B picks up from its inverse */
  float g = log(p_scale) * (p_mode < .5 ? 1. : -1.);
  float la = g * 2. * p, lb = g * (2. * p - 2.);
  float x = smoothstep(.46, .54, p);
  float L = p_blur * abs(g) * .5 * sin(PI * p);
  vec3 acc = vec3(0.);
  for (int i = 0; i < 20; i++){
    float o = (float(i) / 19. - .5) * L;
    vec3 c1 = x < 1. ? zpunch_at(uv, c, la + o, false) : vec3(0.);
    if (x > 0.) c1 = mix(c1, zpunch_at(uv, c, lb + o, true), x);
    acc += c1;
  }
  return vec4(acc / 20., 1.);
}` });

FX.register({ id:'tr-spin-away', name:'Spin away', cat:'transition', search:['newspaper', 'spin', 'rotate', 'vanish', 'shrink'],
  desc:'A spins and shrinks to nothing over B, or B spins in out of the centre, like the old newspaper spin.',
  params:[ S('mode','Mode',['A spins away','B spins in','Both, through the ground']), R('turns','Turns',1,0,4), R('shadow','Shadow',.5,0,1), C('bg','Ground','#0d0d0e','ground') ],
  fs:`/* coverage of a card spun by ang and scaled by s about the centre; st is where it samples its picture */
float saway_card(vec2 uv, float s, float ang, out vec2 st, out float sd){
  s = max(s, 1e-4);
  vec2 Q = rot(-ang) * centered(uv) / s;
  st = uncentered(Q);
  float asp = aspect();
  sd = sdRoundBox(Q, vec2(asp, 1.) * .5, 0.) * s;
  return clamp(.5 - sd * uRes.y, 0., 1.);
}
vec4 fx(vec2 uv){
  float p = uProgress, T = p_turns * TAU, s, ang, m, sd;
  vec2 st;
  vec3 under, card;
  int mode = int(p_mode + .5);
  if (mode == 0){
    s = 1. - p; ang = T * p;
    m = saway_card(uv, s, ang, st, sd);
    card = texture(uA, st).rgb; under = texture(uB, uv).rgb;
  } else if (mode == 1){
    s = p; ang = -T * (1. - p);
    m = saway_card(uv, s, ang, st, sd);
    card = texture(uB, st).rgb; under = texture(uA, uv).rgb;
  } else {
    s = abs(1. - 2. * p); ang = p < .5 ? T * p * 2. : T * (p - 1.) * 2.;
    m = saway_card(uv, s, ang, st, sd);
    card = p < .5 ? texture(uA, st).rgb : texture(uB, st).rgb; under = p_bg;
  }
  float env = 4. * s * (1. - s);
  under *= 1. - p_shadow * .7 * env * (1. - smoothstep(0., .08, sd));
  return vec4(mix(under, card, m), 1.);
}` });

FX.register({ id:'tr-mosaic-pan', name:'Mosaic pan', cat:'transition', search:['wall', 'grid', 'tiles', 'zoom out', 'pan', 'contact sheet'],
  desc:'The camera pulls back over a wall of tiles, pans across a few of them and lands on B.',
  params:[ I('endx','End column',2,-4,4), I('endy','End row',-1,-4,4), R('zoom','Zoom out',3,1.5,6), R('gap','Gap',.3,0,1),
    T('flip','Mirror tiles',true), C('grout','Gap colour','#0d0d0e','ground') ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  vec2 end = vec2(p_endx, p_endy);
  if (end == vec2(0.)) end = vec2(1., 0.);
  float zk = sin(PI * p);
  float z = 1. + (p_zoom - 1.) * zk;
  float pan = smoothstep(.15, .85, p);
  vec2 W = centered(uv) * z / vec2(asp, 1.) + .5 + end * pan;
  vec2 cell = floor(W), lc = fract(W);
  bool isA = cell == vec2(0.), isB = cell == end;
  float h = hash12(cell + 3.17);
  if (!isA && !isB){
    isB = h < .5;
    if (p_flip > .5){ vec2 f = hash22(cell + 7.3); if (f.x < .5) lc.x = 1. - lc.x; if (f.y < .5) lc.y = 1. - lc.y; }
  }
  vec3 col = isB ? texture(uB, lc).rgb : texture(uA, lc).rgb;
  /* tiles away from the start and end sit back a little, so the two that matter read first */
  if (cell != vec2(0.) && cell != end) col *= 1. - .25 * zk * (.5 + .5 * h);
  float d = min(min(lc.x, 1. - lc.x) * asp, min(lc.y, 1. - lc.y));
  float gw = p_gap * .05 * zk;
  float px = z / uRes.y;
  return vec4(mix(p_grout, col, clamp((d - gw * .5) / px + .5, 0., 1.)), 1.);
}` });

FX.register({ id:'tr-bounce-drop', name:'Bounce drop', cat:'transition', search:['drop', 'bounce', 'fall', 'gravity', 'slide in'],
  desc:'B drops in over A and bounces to rest, casting a soft shadow that tightens as it lands.',
  params:[ S('from','Drops from',['Top','Bottom','Left','Right']), I('bounces','Bounces',3,0,6), R('shadow','Shadow',.6,0,1), R('soft','Shadow height',.08,.01,.3) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, n = p_bounces;
  int f = int(p_from + .5);
  /* a runs from the landing edge (0) toward the side B falls from (1) */
  float a = f == 0 ? uv.y : f == 1 ? 1. - uv.y : f == 2 ? 1. - uv.x : uv.x;
  float h = abs(cos(p * PI * (n + .5))) * pow(1. - p, 1.2);
  float ab = a - h;
  if (ab >= 0.){
    vec2 st = f < 2 ? vec2(uv.x, f == 0 ? ab : 1. - ab) : vec2(f == 3 ? ab : 1. - ab, uv.y);
    return texture(uB, st);
  }
  float sh = p_shadow * (1. - h) * exp((a - h) / p_soft);
  return vec4(texture(uA, uv).rgb * (1. - .8 * sh), 1.);
}` });

FX.register({ id:'tr-fling', name:'Fling', cat:'transition', search:['throw', 'toss', 'swipe away', 'flick', 'motion blur', 'card'],
  desc:'A is flicked off the frame along a curve, trailing a motion blur, and leaves B underneath.',
  params:[ S('dir','Fling toward',['Top right','Top left','Bottom right','Bottom left']), R('spin','Spin',.35,0,1), R('blur','Motion blur',.6,0,1), R('shadow','Shadow',.5,0,1) ],
  fs:`/* where the card is at time t: a small wind-up, then an accelerating curve off the frame */
vec3 fling_tap(vec2 uv, float t, vec3 under){
  int d = int(p_dir + .5);
  vec2 sg = vec2(d == 0 || d == 2 ? 1. : -1., d < 2 ? 1. : -1.);
  float e = t * t;
  vec2 E = vec2(1.45, 1.55) * sg, K = vec2(-.12, -.18) * sg;
  vec2 c = 2. * (1. - e) * e * K + e * e * E;
  float ang = p_spin * 1.4 * e * -sg.x * sg.y;
  float sc = 1. - .1 * smoothstep(0., .3, t);
  vec2 Q = rot(-ang) * (centered(uv) - c) / sc;
  float asp = aspect();
  float sd = sdRoundBox(Q, vec2(asp, 1.) * .5, .02 * smoothstep(0., .2, t)) * sc;
  float m = clamp(.5 - sd * uRes.y, 0., 1.);
  float sh = p_shadow * smoothstep(0., .2, t) * (1. - smoothstep(.0, .12, sdRoundBox(rot(-ang) * (centered(uv) - c - vec2(.02, -.03)) / sc, vec2(asp, 1.) * .5, .02) * sc + .02));
  return mix(under * (1. - .6 * sh), texture(uA, uncentered(Q)).rgb, m);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 under = texture(uB, uv).rgb;
  float span = p_blur * .16 * sin(PI * p);
  vec3 acc = vec3(0.);
  for (int i = 0; i < 16; i++){
    float t = clamp(p - float(i) / 15. * span, 0., 1.);
    acc += fling_tap(uv, t, under);
  }
  return vec4(acc / 16., 1.);
}` });

FX.register({ id:'tr-parallax-slide', name:'Parallax slide', cat:'transition', search:['parallax', 'slideshow', 'carousel', 'swiper', 'push'],
  desc:'A slides out while its picture lags behind inside the frame, and B slides in the same way, like a parallax slideshow.',
  params:[ S('dir','Direction',['Left','Right','Up','Down']), R('parallax','Parallax',.5,0,1), R('dim','Dim outgoing',.35,0,1),
    R('shadow','Edge shadow',.4,0,1), R('blur','Motion blur',.25,0,1) ],
  fs:`vec3 pslide_frame(vec2 uv, float p){
  int d = int(p_dir + .5);
  bool vert = d >= 2, flip = d == 1 || d == 2;
  float a = vert ? uv.y : uv.x;
  if (flip) a = 1. - a;
  float perp = vert ? uv.x : uv.y;
  float edge = 1. - p, k = 1. - p_parallax;
  bool isB = a >= edge;
  float t = isB ? a - (1. - p) * k : a + p * k;
  if (flip) t = 1. - t;
  vec2 st = vert ? vec2(perp, t) : vec2(t, perp);
  if (isB) return texture(uB, st).rgb;
  vec3 col = texture(uA, st).rgb * (1. - p_dim * p);
  return col * (1. - p_shadow * .6 * smoothstep(0., .1, p) * exp(-(edge - a) * 14.));
}
vec4 fx(vec2 uv){
  float spread = p_blur * sin(uProgress * PI) * .06;
  vec3 acc = vec3(0.);
  for (int i = 0; i < 8; i++){ float k = float(i) / 7. - .5; acc += pslide_frame(uv, clamp(uProgress + k * spread, 0., 1.)); }
  return vec4(acc / 8., 1.);
}` });

FX.register({ id:'tr-stacked-card', name:'Stacked card', cat:'transition', search:['stack', 'navigation', 'ios', 'sheet', 'cover', 'slide over'],
  desc:'B slides in on top while A steps back, darkens and rounds its corners, like a card going under a stack.',
  params:[ S('dir','B comes from',['Right','Left','Bottom','Top']), R('recede','Recede',.1,0,.3), R('shift','Shift',.25,0,.6), R('dim','Dim',.5,0,1),
    R('radius','Corner radius',.04,0,.1), R('shadow','Shadow',.5,0,1), C('bg','Ground','#0d0d0e','ground') ],
  fs:`float stack_sd(vec2 u, float r){ float asp = aspect(); return sdRoundBox((u - .5) * vec2(asp, 1.), vec2(asp, 1.) * .5, r); }
vec4 fx(vec2 uv){
  float p = uProgress;
  int d = int(p_dir + .5);
  vec2 dv = d == 0 ? vec2(-1., 0.) : d == 1 ? vec2(1., 0.) : d == 2 ? vec2(0., 1.) : vec2(0., -1.);
  vec2 ub = uv + dv * (1. - p);
  float sA = 1. - p_recede * p;
  vec2 ua = .5 + (uv - .5 - dv * p_shift * p) / sA;
  float dA = stack_sd(ua, p_radius * p) * sA;
  vec3 col = mix(p_bg, texture(uA, ua).rgb * (1. - p_dim * p), clamp(.5 - dA * uRes.y, 0., 1.));
  float dB = stack_sd(ub, 0.);
  /* B throws a soft shadow ahead of its leading edge */
  col *= 1. - p_shadow * .6 * smoothstep(0., .15, p) * exp(-max(dB, 0.) * 22.);
  return vec4(mix(col, texture(uB, ub).rgb, clamp(.5 - dB * uRes.y, 0., 1.)), 1.);
}` });

FX.register({ id:'tr-card-carousel', name:'Card carousel', cat:'transition', search:['carousel', 'gallery', 'slider', 'product', 'zoom out'],
  desc:'A shrinks into a card, slides along a row as B comes in beside it, and B grows back to full frame.',
  params:[ S('dir','Direction',['Left','Right']), R('card','Card size',.72,.5,.95), R('radius','Corner radius',.04,0,.12), R('gap','Gap',.06,0,.25),
    R('shadow','Shadow',.4,0,1), C('bg','Ground','#0d0d0e','ground') ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  float q1 = smoothstep(0., .3, p), q2 = smoothstep(.3, .7, p), q3 = smoothstep(.7, 1., p);
  float k = q1 - q3;
  float s = 1. - (1. - p_card) * k;
  float D = s + p_gap, sg = p_dir < .5 ? 1. : -1.;
  vec2 hb = vec2(asp, 1.) * .5 * s;
  float r = min(p_radius * k, min(hb.x, hb.y));
  vec3 col = p_bg;
  for (int i = 0; i < 2; i++){
    vec2 c = vec2(.5 + sg * (float(i) - q2) * D, .5);
    vec2 P = (uv - c) * vec2(asp, 1.);
    float sd = sdRoundBox(P, hb, r);
    col *= 1. - p_shadow * .7 * k * (1. - smoothstep(-.01, .06, sdRoundBox(P - vec2(0., -.015), hb, r)));
    vec2 st = .5 + (uv - c) / s;
    vec3 pic = i == 0 ? texture(uA, st).rgb : texture(uB, st).rgb;
    col = mix(col, pic, clamp(.5 - sd * uRes.y, 0., 1.));
  }
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-velocity-stretch', name:'Velocity stretch', cat:'transition', search:['squash and stretch', 'elastic', 'slideshow', 'rubber', 'speed'],
  desc:'A push where both pictures stretch along the move at full speed and snap back as they land, with the seam bowing like a sheet.',
  params:[ S('dir','Direction',['Left','Right','Up','Down']), R('stretch','Stretch',1.2,0,4), R('bend','Bend',.5,0,1), R('blur','Motion blur',.3,0,1) ],
  fs:`vec3 vstretch_frame(vec2 uv, float p){
  int d = int(p_dir + .5);
  bool vert = d >= 2, flip = d == 1 || d == 2;
  float a = vert ? uv.y : uv.x;
  if (flip) a = 1. - a;
  float perp = vert ? uv.x : uv.y;
  float v = sin(PI * p), e = 1. - p;
  /* the middle of the seam trails the ends, so the edge bows while it moves */
  a += p_bend * .14 * v * sin(PI * perp);
  /* the world is stretched about the seam in proportion to speed */
  float w = 1. + (a - e) / (1. + v * p_stretch);
  bool isB = w >= 1.;
  float t = 1. - abs(1. - mod(isB ? w - 1. : w, 2.));
  if (flip) t = 1. - t;
  vec2 st = vert ? vec2(perp, t) : vec2(t, perp);
  return isB ? texture(uB, st).rgb : texture(uA, st).rgb;
}
vec4 fx(vec2 uv){
  float spread = p_blur * sin(uProgress * PI) * .08;
  vec3 acc = vec3(0.);
  for (int i = 0; i < 10; i++){ float k = float(i) / 9. - .5; acc += vstretch_frame(uv, clamp(uProgress + k * spread, 0., 1.)); }
  return vec4(acc / 10., 1.);
}` });

FX.register({ id:'tr-flag-sheet', name:'Flag sheet', cat:'transition', search:['cloth', 'wave', 'fabric', 'flag', 'ripple slide'],
  desc:'The two pictures travel across like sheets of fabric, rippling with a travelling wave and lit across the folds.',
  params:[ S('dir','Direction',['Left','Right','Up','Down']), R('amp','Wave height',.05,0,.2), R('freq','Waves',2.5,.5,8),
    R('shade','Fold shading',.5,0,1), R('gap','Gap',.04,0,.2), C('bg','Ground','#0d0d0e','ground') ],
  fs:`vec4 fx(vec2 uv){
  int d = int(p_dir + .5);
  bool vert = d >= 2, flip = d == 1 || d == 2;
  float a = vert ? uv.y : uv.x;
  if (flip) a = 1. - a;
  float perp = vert ? uv.x : uv.y;
  float p = uProgress, env = sin(PI * p), g = p_gap * env;
  float w = a + p * (1. + g);
  float ph = (w * p_freq - p * 2.) * TAU;
  /* the cloth hangs from the leading edge, so the wave grows toward the free edge */
  float u = w < 1. + g * .5 ? w : w - 1. - g;
  float hang = .35 + .65 * (1. - abs(u - .5) * 2.);
  float off = p_amp * env * hang * sin(ph);
  float pp = perp + off;
  float lit = 1. + p_shade * env * hang * .5 * cos(ph);
  bool isB = w >= 1. + g * .5;
  float t = isB ? w - 1. - g : w;
  float inside = step(0., t) * step(t, 1.) * step(0., pp) * step(pp, 1.);
  if (flip) t = 1. - t;
  vec2 st = vert ? vec2(pp, t) : vec2(t, pp);
  vec3 pic = isB ? texture(uB, st).rgb : texture(uA, st).rgb;
  return vec4(mix(p_bg, pic * lit, inside), 1.);
}` });

FX.register({ id:'tr-match-zoom', name:'Match zoom', cat:'transition', search:['match cut', 'match on action', 'graphic match', 'zoom'],
  desc:'Zooms into a point on A and out of a matching point on B, with the two points held together through the dissolve.',
  params:[ R('ax','A point X',-.3,-1,1), R('ay','A point Y',.25,-1,1), R('bx','B point X',.1,-1,1), R('by','B point Y',-.05,-1,1),
    R('scale','Zoom',2.5,1,6), R('soft','Dissolve',.35,.05,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 PA = .5 + vec2(p_ax, p_ay) * .5, PB = .5 + vec2(p_bx, p_by) * .5;
  /* the shared point drifts from where it sits in A to where it sits in B */
  vec2 S = mix(PA, PB, smoothstep(0., 1., p));
  float ma = pow(p_scale, p), mb = pow(p_scale, 1. - p);
  float x = smoothstep(.5 - p_soft * .5, .5 + p_soft * .5, p);
  vec3 a = texture(uA, mirrorUv(PA + (uv - S) / ma)).rgb;
  vec3 b = texture(uB, mirrorUv(PB + (uv - S) / mb)).rgb;
  return vec4(mix(a, b, x), 1.);
}` });

FX.register({ id:'tr-window-grow', name:'Window grow', cat:'transition', search:['grid to full', 'shared element', 'flip', 'expand', 'hero', 'scroll reveal', 'thumbnail'],
  desc:'B opens as a small window and grows to fill the frame while its picture settles inside, as on a scrolling hero or a thumbnail opening.',
  params:[ R('size','Start size',.3,.05,.9), R('x','Start X',0,-1,1), R('y','Start Y',0,-1,1), S('fit','B in the window',['Clipped','Whole picture']),
    R('counter','Content scale',.35,0,1), R('radius','Corner radius',.04,0,.2), R('wave','Unfold wave',0,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  vec2 full = vec2(asp, 1.) * .5;
  vec2 c0 = vec2(p_x, p_y) * full * (1. - p_size);
  vec2 P0 = centered(uv);
  /* with a wave, pixels far from the start open later, so the window unfolds rather than scales */
  float lp = p;
  if (p_wave > 0.){
    float dd = clamp(length(P0 - c0) / length(full * 2.), 0., 1.);
    lp = clamp((p - dd * p_wave * .5) / (1. - p_wave * .5), 0., 1.);
  }
  float g = smoothstep(.15, 1., lp);
  float e = mix(p_size * smoothstep(0., .18, lp), 1., g);
  vec2 c = c0 * (1. - g);
  vec2 hb = full * e;
  vec2 P = P0 - c;
  float sd = sdRoundBox(P, hb, min(p_radius * (1. - g), min(hb.x, hb.y)));
  float m = clamp(.5 - sd * uRes.y, 0., 1.);
  float mb = 1. + p_counter * (1. - g);
  vec2 stB = p_fit < .5 ? uncentered(c + P / mb) : uncentered(P / max(e * mb, 1e-4));
  vec3 a = texture(uA, uncentered(P0 / (1. - .04 * g))).rgb * (1. - .45 * g);
  a *= 1. - .45 * smoothstep(0., .15, lp) * (1. - g) * (1. - smoothstep(-.01, .08, sd));
  return vec4(mix(a, texture(uB, stB).rgb, m), 1.);
}` });
