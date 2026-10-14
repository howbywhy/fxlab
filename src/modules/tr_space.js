/* ---------------- Transitions: space ---------------- */
/* Architecture, rooms and the frame as a place you stand in. Every one is a pure
   function of uv and uProgress. Where a ray is cast, the camera sits at (0, 0, -F)
   looking down +z at the frame plane z = 0 (x in [-aspect, aspect], y in [-1, 1]), so
   a picture lying on that plane lands exactly on the frame. Effects that colour the
   picture are scaled by envelopes that are zero at p = 0 and p = 1. */

/* ---- Camera obscura ---- */
FX.register({ id:'tr-obscura', name:'Camera obscura', cat:'transition', family:'space', nonLocal:true,
  search:['pinhole', 'upside down', 'inverted', 'dark room', 'projection', 'camera obscura'],
  desc:'The room goes dark, B is thrown onto it upside down through a pinhole, then turns upright and sharpens as the room light goes.',
  params:[ R('dark','Room darkness',.8,0,1), R('aperture','Pinhole blur',.5,0,1), R('surface','Falls on the room',.6,0,1), R('warm','Warmth',.5,0,1), R('vignette','Falloff',.6,0,1) ],
  fs:`vec3 ob_b(vec2 q, float blur){
  vec3 s = texture(uB, uncentered(q)).rgb;
  if (blur < .0005) return s;
  /* a disc of taps: the wider the hole, the softer the image */
  for (int i = 0; i < 14; i++){
    float a = float(i) * 2.39996, r = sqrt((float(i) + .5) / 14.) * blur;
    s += texture(uB, uncentered(q + vec2(cos(a), sin(a)) * r)).rgb;
  }
  return s / 15.;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb;
  float f = smoothstep(.38, .92, p);
  float th = PI * (1. - f);
  float s = 1. - .16 * sin(PI * f);
  vec2 q = rot(th) * centered(uv) / s;
  vec2 bu = uncentered(q);
  float e = min(min(bu.x, 1. - bu.x), min(bu.y, 1. - bu.y));
  float inside = f >= 1. ? 1. : smoothstep(-.001, .003, e);
  float blur = p_aperture * .028 * (1. - smoothstep(.55, .95, p));
  vec3 Bp = ob_b(q, blur) * inside;
  /* how much of the obscura character is left: none by the end */
  float k = 1. - smoothstep(.6, 1., p);
  vec3 soft = mix(vec3(luma(Bp)), Bp, .75) * .85 + .04;
  Bp = mix(Bp, soft * mix(vec3(1.), vec3(1.08, .96, .8), p_warm), k);
  vec2 c = centered(uv);
  float vig = pow(clamp(1. - dot(c, c) * .85, 0., 1.), 2.);
  Bp *= mix(1., vig, k * p_vignette);
  /* the projection lands on the room: pale surfaces catch it, dark ones swallow it */
  Bp *= mix(1., .35 + 1.1 * luma(A), k * p_surface);
  float amb = mix(1., .06 + .5 * (1. - p_dark), smoothstep(0., .35, p)) * (1. - smoothstep(.62, .95, p));
  float lit = smoothstep(.1, .45, p) * mix(.75, 1., smoothstep(.55, 1., p));
  vec3 room = A * amb * mix(vec3(1.), vec3(.8, .85, 1.), smoothstep(0., .35, p) * k);
  return vec4(clamp(room + Bp * lit, 0., 1.), 1.);
}` });

/* ---- Anamorphic resolve ---- */
FX.register({ id:'tr-anamorph', name:'Anamorphic resolve', cat:'transition', family:'space', nonLocal:true,
  search:['anamorphosis', 'street art', 'pavement art', 'viewpoint', 'perspective', 'trompe l’oeil', 'illusion'],
  desc:'B is painted across A’s wall so that it only makes sense from one spot, and the camera walks to that spot until it resolves.',
  params:[ R('side','Viewpoint across',.7,-1,1), R('height','Viewpoint height',-.6,-1,1), R('near','Viewpoint closeness',.55,0,1), R('persp','Perspective',.5,0,1), R('wall','Wall shows through',.35,0,1), C('bg','Beyond the wall','#101112','ground') ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  float F = mix(5., 1.8, p_persp);
  vec2 n = (uv - .5) * 2.;
  /* the spot B was painted from, and where it looks */
  vec3 V = vec3(p_side * asp * 1.25, p_height * 1.15, -F * mix(.6, .22, p_near));
  vec3 T = vec3(-p_side * asp * .12, -p_height * .12, 0.);
  float e = smoothstep(.12, .92, p);
  e = e * e * (3. - 2. * e);
  vec3 P = mix(vec3(0., 0., -F), V, e) + vec3(0., .12, -.25) * sin(PI * e) * F * .5;
  vec3 tg = mix(vec3(0.), T, e);
  vec3 fw = normalize(tg - P), up = vec3(0., 1., 0.);
  vec3 rt = normalize(cross(up, fw)), uu = cross(fw, rt);
  vec3 rd = rt * n.x * asp + uu * n.y + fw * F;
  if (rd.z <= 1e-5) return vec4(p_bg, 1.);
  vec3 W = P + rd * (-P.z / rd.z);
  /* the wall: A on the frame, the wall carries on darker beyond it */
  vec2 wu = vec2(W.x / asp, W.y) * .5 + .5;
  float out_ = max(max(-wu.x, wu.x - 1.), max(-wu.y, wu.y - 1.));
  vec3 wall = texture(uA, mirrorUv(wu)).rgb * (1. - smoothstep(0., .25, out_) * .7);
  wall = mix(wall, p_bg, smoothstep(.15, .6, out_));
  /* project the wall point back into the painter's view */
  vec3 Vf = normalize(T - V), Vr = normalize(cross(up, Vf)), Vu = cross(Vf, Vr);
  vec3 d = W - V;
  float dz = dot(d, Vf);
  vec2 pv = vec2(dot(d, Vr) / dz * F / asp, dot(d, Vu) / dz * F) * .5 + .5;
  if (p >= 1.) pv = uv;
  vec2 fw2 = fwidth(pv) + 1e-6;
  vec2 ed = min(pv, 1. - pv) / fw2;
  float paint = clamp(min(ed.x, ed.y) + .5, 0., 1.) * step(0., dz) * smoothstep(0., .22, p);
  vec3 B = texture(uB, clamp(pv, 0., 1.)).rgb;
  float k = 1. - smoothstep(.75, 1., p);
  B = mix(B, B * (.7 + .6 * luma(wall)), p_wall * k);
  return vec4(mix(wall, B, paint), 1.);
}` });

/* ---- Enfilade ---- */
FX.register({ id:'tr-enfilade', name:'Enfilade', cat:'transition', family:'space', nonLocal:true,
  search:['doorway', 'rooms', 'corridor', 'walk through', 'gallery', 'palace', 'doors in a line'],
  desc:'A doorway opens in A onto a line of rooms, each a step closer to B, and the camera walks through them until B fills the frame.',
  params:[ I('rooms','Rooms',3,1,5), R('door','Doorway size',.5,.25,.8), R('arch','Arched top',.6,0,1), R('gap','Room depth',.5,.1,1), R('shade','Depth shading',.45,0,1), R('jamb','Jamb shadow',.5,0,1) ],
  fs:`/* distance outside the doorway (negative inside), in wall units; the doorway stands on the floor */
float en_door(vec2 P, float o){
  float hw = aspect() * p_door * .62 * o, top = mix(-1., .5 + .4 * p_door, o);
  float r = hw * p_arch;
  float bh = max(top - r, -1.);
  vec2 q = P - vec2(0., (bh - 1.) * .5);
  float box = sdRoundBox(q, vec2(hw, (bh + 1.) * .5 + .002), 0.);
  float cap = length(P - vec2(0., bh)) - hw;
  cap = P.y > bh ? max(cap, abs(P.x) - hw) : 1e3;
  float sq = P.y > bh ? max(abs(P.x) - hw, P.y - top) : 1e3;
  return min(box, mix(sq, cap, step(.001, r)));
}
vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  float F = 2.2;
  int N = int(p_rooms + .5);
  float gap = p_gap * 2.6;
  /* the last room is deep enough that the camera is through every doorway before B fills the frame */
  float zB = float(N - 1) * gap + F + gap * .5;
  vec2 n = (uv - .5) * 2.;
  float o0 = smoothstep(0., .2, p);
  float cz = mix(-F, zB - F, smoothstep(.1, 1., p));
  vec3 rd = vec3(n.x * asp, n.y, F);
  for (int k = 0; k < 5; k++){
    if (k >= N) break;
    float zk = float(k) * gap;
    if (zk <= cz + 1e-4) continue;
    vec2 P = rd.xy * ((zk - cz) / F);
    float o = k == 0 ? o0 : 1.;
    float dd = en_door(P, o);
    if (dd > 0.){
      /* the first half of the rooms are A's, the rest already B's */
      vec2 wu = mirrorUv(vec2(P.x / asp, P.y) * .5 + .5);
      vec3 c = k * 2 < N ? texture(uA, wu).rgb : texture(uB, wu).rgb;
      float sh = pow(1. - p_shade * .5, float(k));
      float jamb = 1. - p_jamb * .55 * exp(-dd / .05) * o;
      return vec4(c * sh * jamb, 1.);
    }
  }
  vec2 P = rd.xy * ((zB - cz) / F);
  vec2 bu = vec2(P.x / asp, P.y) * .5 + .5;
  if (p >= 1.) bu = uv;
  float sh = pow(1. - p_shade * .5, float(N));
  sh = mix(sh, 1., smoothstep(.55, 1., p));
  return vec4(texture(uB, clamp(bu, 0., 1.)).rgb * sh, 1.);
}` });

/* ---- Window light ---- */
FX.register({ id:'tr-blind-light', name:'Window light', cat:'transition', family:'space',
  search:['blinds', 'venetian', 'sunlight', 'shadow', 'louvres', 'window', 'afternoon light', 'room'],
  desc:'Sun through a window falls across the room in bars, B is whatever the light lands on, and the blinds open until the room is all light.',
  params:[ S('kind','Window',['Venetian blinds','Upright louvres','Window panes'],0), I('slats','Slats',9,3,24), R('angle','Light angle',-28,-80,80,1), R('key','Keystone',.45,0,1), R('soft','Softness',.35,0,1), R('relief','Bends over the picture',.4,0,1), R('room','Room in shadow',.5,0,1), C('sun','Sunlight','#ffd9a8',false) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec2 q = centered(uv);
  /* light from a window up and to one side, thrown in perspective onto the wall */
  vec2 q2 = rot(radians(p_angle)) * q;
  float w = 1. + p_key * .9 * (q2.y + q2.x * .35);
  vec2 s = q2 / max(w, .2);
  /* the bars bend over the forms of both pictures, as light does over a relief */
  s.y += p_relief * .05 * (luma(A) * (1. - p) + luma(B) * p - .5);
  s.x += p_relief * .03 * (luma(B) - .5) * sin(PI * p);
  float drift = p * .35;
  int kd = int(p_kind + .5);
  float N = p_slats;
  float sw = smoothstep(.05, .92, p);
  float so = mix(.015, .2, p_soft) * (.6 + .5 * w);
  float thr = sw * (1. + 2. * so);
  float fr1 = fract((kd == 1 ? s.x : s.y) * N * .9 + drift);
  float lit = 1. - smoothstep(thr - so, thr, fr1);
  if (kd == 2){
    /* glazing bars across both ways */
    float fr2 = fract(s.x * N * .55 + drift * .6);
    float bar = mix(.18, -.02, sw);
    float m = smoothstep(bar - so * .5, bar + so * .5, min(fr1, 1. - fr1) * 2.) * smoothstep(bar - so * .5, bar + so * .5, min(fr2, 1. - fr2) * 2.);
    lit = sw >= 1. ? 1. : m * smoothstep(0., .15, p);
  }
  /* the patch of light on the wall: the footprint of the window, growing as the sun comes round */
  float g = smoothstep(.0, .85, p);
  vec2 fp = s - vec2(-.25, .1) * (1. - g);
  float foot = 1. - smoothstep(-.05, .05 + so, sdRoundBox(fp, vec2(.15 + 1.6 * g, .12 + 1.5 * g), .05));
  lit *= sw >= 1. ? 1. : foot;
  float k = sin(PI * p);
  vec3 sun = mix(vec3(1.), p_sun * 1.35, k);
  vec3 litc = B * sun + p_sun * .12 * k * lit;
  float amb = 1. - p_room * .65 * smoothstep(0., .3, p) * (1. - smoothstep(.75, 1., p));
  vec3 dark = A * amb * mix(vec3(1.), vec3(.82, .88, 1.), k * p_room);
  return vec4(clamp(mix(dark, litc, lit), 0., 1.), 1.);
}` });

/* ---- Scenery flats ---- */
FX.register({ id:'tr-stage-flats', name:'Scenery flats', cat:'transition', family:'space', nonLocal:true,
  search:['theatre', 'stage', 'set change', 'wings', 'layers', 'parallax', 'cut-out', 'diorama', 'truck'],
  desc:'Both pictures are cut into theatre flats along their tones, and the sets run past on tracks at different speeds, A’s going off as B’s come on.',
  params:[ I('flats','Flats',4,2,5), S('front','Nearest flat',['Lightest tones','Darkest tones'],0), S('dir','Runs',['To the left','To the right'],0), R('depth','Depth between flats',.6,0,1), R('gap','Gap between sets',.25,0,1), R('smooth','Cut smoothness',.5,0,1), R('stage','Stage light',.5,0,1), C('bg','Stage','#0d0d0e','ground') ],
  fs:`/* which flat a point belongs to: a smoothed tone, cut into bands; flat k holds band k and up */
float sf_band(sampler2D s, vec2 u, float r, float n){
  float l = luma(texture(s, u).rgb) * 2.;
  l += luma(texture(s, u + vec2(r, 0.)).rgb) + luma(texture(s, u - vec2(r, 0.)).rgb);
  l += luma(texture(s, u + vec2(0., r)).rgb) + luma(texture(s, u - vec2(0., r)).rgb);
  l /= 6.;
  if (p_front > .5) l = 1. - l;
  l = smoothstep(.05, .95, l);
  return min(floor(l * n), n - 1.);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float n = p_flats;
  float r = p_smooth * .016 + .002;
  float gap = .04 + p_gap * .6;
  float L = 1. + gap;
  float e = smoothstep(0., 1., p);
  float sgn = p_dir < .5 ? 1. : -1.;
  float bell = sin(PI * p);
  /* nearest flat first; each set runs at its own speed, so they part and close again */
  for (int i = 0; i < 5; i++){
    float k = n - 1. - float(i);
    if (k < 0.) break;
    float a = p_depth * .28 * (k / max(n - 1., 1.) - .35);
    float sc = L * (e + a * sin(PI * e));
    float x = sgn > 0. ? uv.x + sc : uv.x - sc;
    float lightk = 1. - p_stage * bell * .35 * (1. - k / max(n - 1., 1.));
    vec2 su;
    if (x >= 0. && x <= 1.){
      su = vec2(x, uv.y);
      if (k < .5 || sf_band(uA, su, r, n) >= k) return vec4(texture(uA, su).rgb * lightk, 1.);
    }
    float xb = sgn > 0. ? x - L : x + L;
    if (xb >= 0. && xb <= 1.){
      su = vec2(xb, uv.y);
      if (k < .5 || sf_band(uB, su, r, n) >= k) return vec4(texture(uB, su).rgb * lightk, 1.);
    }
  }
  return vec4(p_bg, 1.);
}` });


/* ---- Projection mapping ---- */
FX.register({ id:'tr-proj-boxes', name:'Projection mapping', cat:'transition', family:'space', nonLocal:true,
  search:['projection mapping', 'boxes', 'extrude', 'blocks', 'relief', 'stage', 'video mapping', 'facade'],
  desc:'The frame pushes out into a wall of boxes carrying A on their faces, light traces their edges, the faces change to B box by box, and the wall flattens again.',
  params:[ I('rows','Rows',5,2,12), R('depth','Depth',.5,0,1), R('lines','Edge light',.6,0,1), R('sides','Side shading',.55,0,1), S('order','Order',['From the centre','Random','Top to bottom'],0), C('line','Light','#ffffff','accent') ],
  fs:`float pm_h(vec2 c){ return .25 + .75 * hash12(c + 7.31); }
vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  float bell = sin(PI * p);
  float amp = p_depth * .9 * smoothstep(0., .6, bell);
  vec2 P = centered(uv);
  float rows = p_rows, cs = 1. / rows;
  vec2 cell0 = floor(P / cs);
  vec2 tow = -sign(P + 1e-5);
  float best = -1.; vec2 bq = P; vec2 bcell = cell0; float face = 0.; float edge = 1.;
  /* the nearest surface among boxes whose base sits between this pixel and the centre */
  for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++){
    vec2 c = cell0 + vec2(float(i), float(j)) * tow;
    vec2 lo = c * cs, hi = lo + cs;
    float smax = 1. + amp * pm_h(c);
    /* t = 1 / s runs from 1 (base) to 1 / smax (front face); the box covers this pixel for a range of t */
    float t0 = 1. / smax, t1 = 1.;
    for (int a = 0; a < 2; a++){
      float d = P[a];
      if (abs(d) < 1e-6){ if (lo[a] > 0. || hi[a] < 0.){ t0 = 2.; } continue; }
      float ta = lo[a] / d, tb = hi[a] / d;
      t0 = max(t0, min(ta, tb)); t1 = min(t1, max(ta, tb));
    }
    if (t0 > t1) continue;
    float s = 1. / t0;
    if (s <= best) continue;
    best = s; bcell = c; bq = P * t0;
    face = t0 <= 1. / smax + 1e-5 ? 0. : 1.;
    vec2 e2 = min(bq - lo, hi - bq);
    edge = min(e2.x, e2.y);
  }
  float rnd = hash12(bcell + 3.1);
  vec2 cc = (bcell + .5) * cs;
  float ord = p_order < .5 ? clamp(length(cc) / length(vec2(asp, 1.) * .5), 0., 1.) * .8 + rnd * .2 : (p_order < 1.5 ? rnd : clamp(.5 - cc.y, 0., 1.) * .85 + rnd * .15);
  float sw = step(.3 + ord * .4, p);
  vec2 su = uncentered(bq);
  if (p <= 0.) su = uv;
  if (p >= 1.) su = uv;
  vec3 col = mix(texture(uA, su).rgb, texture(uB, su).rgb, sw);
  /* a little flash as each face changes over */
  float since = p - (.3 + ord * .4);
  col += p_line * exp(-max(since, 0.) * 60.) * step(0., since) * .22 * bell;
  if (face > .5){
    /* the sides: the face colour drawn back along the box, shaded by which way it faces */
    vec2 dp = abs(P);
    float side = dp.x * cs > dp.y * cs ? .7 : (P.y > 0. ? .5 : .9);
    col *= mix(1., side, p_sides);
  }
  float lw = .0025 + .002 * p_lines;
  /* only the rims of the front faces are traced; the sides run back from them */
  float ln = (1. - smoothstep(lw * .4, lw, edge)) * p_line_a * (1. - face);
  col = mix(col, p_line, ln * p_lines * smoothstep(.25, .85, bell));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Shoji ---- */
FX.register({ id:'tr-shoji', name:'Shoji screens', cat:'transition', family:'space', nonLocal:true,
  search:['japanese', 'paper screen', 'sliding door', 'washi', 'lattice', 'translucent', 'backlit'],
  desc:'A turns into paper screens, B glows through them from behind, brightest parts first, and then the screens slide apart on their tracks.',
  params:[ I('panels','Panels',4,2,6), I('lattice','Lattice rows',5,0,12), R('glow','Light through the paper',.7,0,1), R('fibre','Paper fibre',.5,0,1), R('doubled','Doubled paper',.5,0,1), C('wood','Wood','#2a1e16',false), C('paper','Paper','#f2ead8',false) ],
  fs:`vec3 sj_blur(vec2 u){
  vec3 s = texture(uB, u).rgb;
  for (int i = 0; i < 8; i++){
    float a = float(i) * 2.39996, r = sqrt((float(i) + .5) / 8.) * .018;
    s += texture(uB, u + vec2(cos(a), sin(a)) * r / vec2(aspect(), 1.)).rgb;
  }
  return s / 9.;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float N = p_panels, w = 1. / N;
  float ch = smoothstep(0., .2, p);
  float m = smoothstep(.42, 1., p);
  m = m * m;
  /* which panels cover this pixel: inner panels travel further, so they slide over the outer ones */
  int hits = 0; float top = -1.; float lx = 0.; float tw = -1.;
  for (int i = 0; i < 6; i++){
    float fi = float(i);
    if (fi >= N) break;
    float x0 = fi * w;
    bool left = fi + .5 < N * .5;
    float off = left ? -m * (x0 + w) : m * (1. - x0);
    float a = x0 + off;
    if (uv.x < a || uv.x > a + w) continue;
    hits++;
    /* odd panels run on the front track */
    float trk = mod(fi, 2.);
    if (trk > tw){ tw = trk; top = fi; lx = (uv.x - a) / w; }
  }
  vec3 B = texture(uB, uv).rgb;
  if (hits == 0) return vec4(B, 1.);
  vec3 A = texture(uA, uv).rgb;
  vec3 bb = sj_blur(uv);
  /* light comes through the paper where B is bright first */
  float back = smoothstep(.05, .5, p) * p_glow;
  float tb = back * (.25 + .75 * smoothstep(.15, .85, luma(bb)));
  if (hits > 1) tb *= 1. - p_doubled * .6;
  float fib = fbm(uv * vec2(aspect(), 1.) * 60.) * .5 + fbm(uv * vec2(aspect(), 1.) * vec2(8., 180.)) * .5;
  vec3 paperA = mix(A, mix(A, p_paper * (.55 + .5 * luma(A)), .3) + (fib - .5) * .08 * p_fibre, ch);
  vec3 glow = bb * mix(vec3(1.), p_paper, .35) * 1.15 + (fib - .5) * .06 * p_fibre;
  vec3 col = mix(paperA * (1. - tb * .7), glow, tb);
  if (hits > 1) col *= 1. - .12 * p_doubled * ch;
  /* the kumiko lattice and the stiles at the panel edges */
  float y = uv.y;
  float lr = p_lattice;
  float lat = 0.;
  if (lr > .5){
    float gx = abs(fract(lx * 3.) - .5) * 2., gy = abs(fract(y * lr) - .5) * 2.;
    float px = 2. / uRes.x * N * 3., py = 2. / uRes.y * lr;
    lat = max(smoothstep(1. - px * 2.2, 1. - px * .8, gx), smoothstep(1. - py * 2.2, 1. - py * .8, gy));
  }
  float st = 1. - smoothstep(.02, .028, min(lx, 1. - lx));
  float wood = max(lat, st) * ch;
  vec3 wc = p_wood * (1. + tb * .4);
  col = mix(col, wc, wood);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Light painting ---- */
FX.register({ id:'tr-light-painting', name:'Light painting', cat:'transition', family:'space',
  search:['long exposure', 'torch', 'night', 'beam', 'light paint', 'flashlight', 'strokes'],
  desc:'The room goes to night and a torch beam paints B onto the wall in long-exposure strokes, overlapping and uneven, before the lights come up.',
  params:[ I('passes','Strokes',11,3,20), R('width','Beam width',.6,.2,1), R('wobble','Hand wobble',.5,0,1), R('gain','Exposure',.6,0,1), R('night','Night',.85,0,1), C('beam','Beam','#ffe6c2',false) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  float L = p_passes;
  float tau = clamp((p - .12) / .7, 0., 1.);
  float rowH = 1. / L;
  float y = 1. - uv.y;
  float r0 = floor(y * L);
  float E = 0.;
  float head = 0.;
  float sig = rowH * mix(.22, .55, p_width);
  /* the strokes either side of this pixel, each laid down once the beam has passed */
  for (int i = -1; i <= 1; i++){
    float r = r0 + float(i);
    if (r < 0. || r >= L) continue;
    float dir = mod(r, 2.) < .5 ? uv.x : 1. - uv.x;
    float tpx = (r + dir) / L;
    float yc = (r + .5) * rowH + p_wobble * rowH * .22 * (sin(dir * 7. + r * 2.1) + .4 * sin(dir * 17. + r * 5.3));
    float g = exp(-pow(abs(y - yc) / sig, 3.));
    /* the beam lingers unevenly: brighter where the hand slowed */
    float slow = .6 + .8 * vnoise(vec2(dir * 4., r * 3.7));
    E += g * slow * step(tpx, tau);
    float dh = (tau - tpx) * L;
    head += exp(-pow((y - yc) / (sig * .6), 2.)) * exp(-max(dh, 0.) * 30.) * step(0., dh) * step(tau, .9999);
  }
  float paint = 1. - exp(-E * mix(.6, 1.8, p_gain));
  float k = 1. - smoothstep(.8, 1., p);
  float dark = smoothstep(0., .15, p) * p_night * k;
  vec3 night = A * (1. - dark) * mix(vec3(1.), vec3(.6, .7, 1.), dark);
  vec3 lit = B * paint * mix(vec3(1.), p_beam * 1.2, k * .6);
  vec3 col = night + lit * k + head * p_beam * 1.4 * k;
  col = mix(col, B, smoothstep(.8, 1., p));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Vanishing point ---- */
FX.register({ id:'tr-vanishing', name:'Vanishing point', cat:'transition', family:'space', nonLocal:true,
  search:['corridor', 'tunnel', 'dolly', 'one-point perspective', 'room', 'walls', 'hallway', 'fold'],
  desc:'A folds back into a corridor of itself, its middle becoming the far wall, and the camera walks down it to B waiting at the end.',
  params:[ R('depth','Corridor length',.55,.1,1), R('shade','Wall shading',.5,0,1), R('fog','Distance haze',.4,0,1), R('glow','Light at the end',.4,0,1), C('haze','Haze','#0c0d10','ground') ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float Dm = mix(.8, 6., p_depth);
  float Df = Dm * smoothstep(0., .42, p);
  float cam = Dm * smoothstep(.38, 1., p);
  cam = min(cam, Df);
  float D = Df - cam;
  float r = 1. / (1. + D), r0 = 1. / (1. + Df);
  vec2 q = (uv - .5) * 2.;
  float d = max(abs(q.x), abs(q.y));
  float env = smoothstep(0., .25, p) * (1. - smoothstep(.8, 1., p));
  /* the far wall turns from A's middle to B as the camera sets off */
  float fb = smoothstep(.36, .6, p);
  if (d <= r || Df <= 1e-5){
    vec2 w = q / r;
    vec3 A = texture(uA, w * r0 * .5 + .5).rgb;
    vec3 B = texture(uB, w * .5 + .5).rgb;
    if (p >= 1.) B = texture(uB, uv).rgb;
    vec3 c = mix(A, B, fb);
    float lift = p_glow * sin(PI * fb) * .35 * (1. - smoothstep(.0, 1., length(w)) * .5);
    float fogd = 1. - exp(-D * .35);
    c = mix(c, p_haze, p_fog * fogd * env) + lift;
    return vec4(clamp(c, 0., 1.), 1.);
  }
  /* on a wall: how far down the corridor, then back to where that sits in A */
  float zw = cam + 1. / d - 1.;
  float dA = 1. - (1. - r0) * zw / Df;
  vec2 sA = q / d * dA;
  vec3 c = texture(uA, sA * .5 + .5).rgb;
  /* floor catches the light, ceiling sits in shade */
  bool vert = abs(q.x) > abs(q.y);
  float sh = vert ? .78 : (q.y < 0. ? 1. : .58);
  c *= mix(1., sh, p_shade * env);
  float fogd = 1. - exp(-(1. / d - 1.) * .35);
  c = mix(c, p_haze, p_fog * fogd * env);
  /* a soft crease where the walls meet */
  float crease = 1. - abs(abs(q.x) - abs(q.y)) / max(d, 1e-3);
  c *= 1. - .25 * env * p_shade * smoothstep(.97, 1., crease);
  return vec4(c, 1.);
}` });

/* ---- Shop window ---- */
FX.register({ id:'tr-shop-window', name:'Shop window', cat:'transition', family:'space',
  search:['reflection', 'glass', 'window', 'storefront', 'vitrine', 'step closer', 'see through'],
  desc:'A is a reflection on a sheet of glass and B is behind it; you step closer, the reflection slides away and fades, first where B is brightest.',
  params:[ R('parallax','Parallax',.5,0,1), R('ghost','Second reflection',.4,0,1), R('tint','Glass tint',.4,0,1), R('sheen','Sheen',.4,0,1), R('lead','Brightest first',.6,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  float e = smoothstep(0., 1., p);
  float bell = sin(PI * p);
  vec2 c = uv - .5;
  /* stepping closer: the view behind grows into place, the reflection slides off the other way */
  vec2 bu = c / mix(1. + .14 * p_parallax, 1., e) + .5 + vec2(.04, 0.) * p_parallax * (1. - e);
  vec2 au = c * (1. + .1 * p_parallax * e) + .5 - vec2(.12, .015) * p_parallax * e;
  vec3 B = texture(uB, p >= 1. ? uv : clamp(bu, 0., 1.)).rgb;
  vec3 A = texture(uA, mirrorUv(au)).rgb;
  vec3 A2 = texture(uA, mirrorUv(au + vec2(.012, -.006) * (.5 + p_parallax))).rgb;
  /* the glass shows the reflection only where the view behind is dark */
  float R = 1. - smoothstep(.05, .95, p + p_lead * .45 * (luma(B) - .5) * bell);
  float T = smoothstep(0., .8, p);
  vec3 refl = mix(A, max(A, A2 * .8), p_ghost * bell) * R;
  vec3 view = B * T * mix(vec3(1.), vec3(.9, .97, .94), p_tint * bell);
  float sh = exp(-pow(dot(c * vec2(asp, 1.), normalize(vec2(1., .6))) * 4. - mix(-2., 2., e), 2.)) * p_sheen * bell * .25;
  vec3 col = 1. - (1. - view) * (1. - refl);
  return vec4(clamp(col + sh, 0., 1.), 1.);
}` });

/* ---- Scrim ---- */
FX.register({ id:'tr-scrim', name:'Scrim', cat:'transition', family:'space', nonLocal:true,
  search:['theatre', 'gauze', 'bleed through', 'curtain', 'stage', 'fly out', 'weave', 'backlight'],
  desc:'A is painted on a theatre gauze; the light moves behind it and B bleeds through the weave, highlights first, then the gauze flies out.',
  params:[ R('pitch','Weave',.5,0,1), R('open','Open weave',.5,.1,.9), R('bleed','Highlights first',.6,0,1), R('fly','Fly out',.5,0,1), R('sway','Sway',.4,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float fly = smoothstep(mix(.85, .6, p_fly), 1., p);
  /* the gauze rises: its bottom edge lifts out of the top of the frame */
  float bot = fly * 1.08 - .04;
  float sway = p_sway * .004 * sin(uv.y * 6. + p * 7.) * sin(PI * p);
  vec2 gu = vec2(uv.x + sway, uv.y - fly * 1.04);
  vec3 B = texture(uB, uv).rgb;
  float onGauze = smoothstep(bot - .006, bot + .006, uv.y);
  if (p >= 1.) onGauze = 0.;
  vec3 A = texture(uA, gu).rgb;
  vec3 bb = (texture(uB, uv + vec2(.004, 0.)).rgb + texture(uB, uv - vec2(.004, 0.)).rgb + texture(uB, uv + vec2(0., .004)).rgb + texture(uB, uv - vec2(0., .004)).rgb) * .25;
  float front = 1. - smoothstep(.2, .72, p);
  float back = smoothstep(.12, .7, p);
  float bl = clamp(back * (1. + p_bleed) - (1. - luma(bb)) * p_bleed, 0., 1.);
  bl = bl * bl * (3. - 2. * bl);
  /* the weave: threads catch the front light, the holes pass the back light */
  /* never finer than about four pixels a thread, so small previews do not alias */
  float pitch = min(mix(330., 140., p_pitch), uRes.y / (4. * max(uPx, 1.)));
  vec2 wv = gu * vec2(uRes.x / uRes.y, 1.) * pitch;
  float tx = abs(fract(wv.x) - .5) * 2., ty = abs(fract(wv.y) - .5) * 2.;
  float o = p_open;
  float hole = smoothstep(o - .25, o + .05, min(1. - tx, 1. - ty) + .0);
  hole = clamp(hole, 0., 1.) * .7;
  /* the weave only shows once there is light behind it */
  float vis = smoothstep(.1, .6, p) * (1. - smoothstep(.75, 1., p));
  float cov = 1. - hole * mix(vis, 1., step(.75, p));
  vec3 thread = A * front + bb * back * .18;
  vec3 seen = mix(B * bl, thread, cov);
  /* when fully front lit, the gauze reads as the picture itself */
  seen = mix(seen, A, front * (1. - vis));
  vec3 col = mix(B, seen, onGauze);
  /* the batten along the bottom of the gauze */
  col *= 1. - .5 * exp(-abs(uv.y - bot) * 300.) * step(.001, fly) * (1. - step(1., p));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Infinity mirror ---- */
FX.register({ id:'tr-infinity-mirror', name:'Infinity mirror', cat:'transition', family:'space', nonLocal:true,
  search:['mirror room', 'reflections', 'tunnel', 'two mirrors', 'recursion', 'repeat', 'hall of mirrors'],
  desc:'A opens into a tunnel of its own reflections between two mirrors; B arrives in the deepest one and is passed forward reflection by reflection.',
  params:[ I('copies','Reflections',7,3,10), R('depth','Tunnel depth',.5,.1,1), R('curve','Mirrors out of true',.4,0,1), R('tint','Glass tint',.5,0,1), R('bezel','Frame edge',.5,0,1), C('glass','Glass','#bfe0cf',false) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  float bell = sin(PI * p);
  float N = p_copies;
  float g = p_depth * .16 * smoothstep(0., 1., bell);
  vec2 P = centered(uv);
  vec2 drift = vec2(.6, .35) * p_curve * .05 * bell;
  float kk = 0.; vec2 loc = P; float sck = 1.;
  /* the deepest reflection that holds this pixel */
  for (int i = 1; i < 10; i++){
    float k = float(i);
    if (k >= N) break;
    float sc = pow(1. - g, k);
    vec2 c = drift * k * k * .5;
    vec2 l = (P - c) / sc;
    if (abs(l.x) > asp * .5 || abs(l.y) > .5) break;
    kk = k; loc = l; sck = sc;
  }
  vec2 su = uncentered(loc);
  if (p <= 0. || p >= 1.) su = uv;
  /* B starts in the deepest copy and is handed forward */
  float tk = mix(.72, .22, kk / max(N - 1., 1.));
  float sw = smoothstep(tk - .06, tk + .06, p);
  vec3 col = mix(texture(uA, su).rgb, texture(uB, su).rgb, sw);
  /* each bounce loses a little light and takes on the colour of the glass */
  vec3 tint = mix(vec3(1.), pow(p_glass, vec3(kk * .35)) * pow(.93, kk), p_tint * smoothstep(0., .3, bell));
  col *= tint;
  vec2 e = vec2(asp * .5, .5) - abs(loc);
  float edge = min(e.x, e.y) * sck;
  float bz = (1. - smoothstep(.0015, .005, edge)) * step(.5, kk) * p_bezel * smoothstep(0., .3, bell);
  col = mix(col, col * .25, bz);
  return vec4(col, 1.);
}` });
