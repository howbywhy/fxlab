/* ---------------- Transitions: panels ---------------- */
/* Panels, curtains and staggered strips: the frame is covered or cut into pieces that move on their
   own clocks. Every module returns exactly A at progress 0 and exactly B at progress 1. */

FX.register({ id:'tr-panel-cover', name:'Panel cover', cat:'transition', family:'panels', search:['page transition', 'curtain', 'overlay', 'barba', 'swup', 'cover'],
  desc:'Solid panels sweep across to cover A, then carry on off the far edge to uncover B.',
  params:[ S('dir','Direction',DIRS4,1), I('layers','Layers',2,1,3), R('lag','Layer lag',.18,0,.4), R('hold','Hold',.1,0,.5), R('drift','Image drift',.08,0,.4),
    C('color','Panel','#141516','ground'), C('color2','Panel 2','#ff5a36','accent'), C('color3','Panel 3','#c9f5e4','accent2') ],
  fs:`float pc_ease(float t){ t = clamp(t, 0., 1.); return t < .5 ? 4. * t * t * t : 1. - pow(-2. * t + 2., 3.) / 2.; }
vec4 fx(vec2 uv){
  int m = int(p_dir + .5);
  vec2 dir = m == 0 ? vec2(0., -1.) : m == 1 ? vec2(1., 0.) : m == 2 ? vec2(0., 1.) : vec2(-1., 0.);
  float t = m == 0 ? 1. - uv.y : m == 1 ? uv.x : m == 2 ? uv.y : 1. - uv.x;
  float p = uProgress;
  float L = clamp(floor(p_layers + .5), 1., 3.);
  float lag = min(p_lag, .9 / max(L - 1., 1.));
  float ph = .5 - p_hold * .5;
  /* cover phase: bottom layer leads; uncover phase: top layer leaves first, so a colour edge shows both ways */
  float P1 = clamp(p / ph, 0., 1.), P2 = clamp((p - .5 - p_hold * .5) / ph, 0., 1.);
  float span = 1. - (L - 1.) * lag;
  vec3 col = vec3(0.); bool hit = false;
  for (int k = 2; k >= 0; k--){
    float fk = float(k);
    if (fk > L - 1. || hit) continue;
    float head = pc_ease((P1 - fk * lag) / span);
    float tail = pc_ease((P2 - (L - 1. - fk) * lag) / span);
    if (t < head && t >= tail && head > 0. && tail < 1.){
      int j = int(L - 1. - fk);
      col = j == 0 ? p_color : j == 1 ? p_color2 : p_color3; hit = true;
    }
  }
  if (hit) return vec4(col, 1.);
  vec2 off = dir * p_drift * .25;
  if (p < .5) return vec4(texture(uA, uv - off * pc_ease(p * 2.)).rgb, 1.);
  return vec4(texture(uB, uv + off * (1. - pc_ease(p * 2. - 1.))).rgb, 1.);
}` });

FX.register({ id:'tr-shutter-split', name:'Shutter split', cat:'transition', family:'panels', search:['double door', 'split', 'open', 'shutter', 'reveal'],
  desc:'The frame splits down the middle and the halves slide apart, close over it, or close through a colour.',
  params:[ S('mode','Mode',['A opens','B closes in','Through colour'],0), S('axis','Split',['Vertical','Horizontal'],0), R('zoom','Settle zoom',.12,0,.5), R('shadow','Edge shadow',.45,0,1),
    R('line','Seam line',0,0,.02), C('color','Panel colour','#141516','ground') ],
  fs:`float ss_ease(float t){ t = clamp(t, 0., 1.); return t < .5 ? 4. * t * t * t : 1. - pow(-2. * t + 2., 3.) / 2.; }
vec2 ss_zoom(vec2 uv, float z){ return (uv - .5) / (1. + z) + .5; }
vec4 fx(vec2 uv){
  bool vert = p_axis < .5;
  float x = vert ? uv.x : uv.y;
  float side = x < .5 ? -1. : 1.;
  float fromSeam = abs(x - .5);
  int mode = int(p_mode + .5);
  float p = uProgress;
  vec2 axisV = vert ? vec2(1., 0.) : vec2(0., 1.);
  if (mode == 0){
    float o = .5 * ss_ease(p);
    vec2 au = uv - axisV * side * o;
    float inside = step(o, fromSeam);
    vec3 a = texture(uA, au).rgb;
    a *= 1. - p_shadow * .6 * exp(-(fromSeam - o) * 30.) * step(.0001, o);
    vec3 b = texture(uB, ss_zoom(uv, p_zoom * (1. - p))).rgb;
    b *= 1. - p_shadow * .5 * (1. - smoothstep(0., .25, o - fromSeam)) * (1. - p);
    vec3 col = mix(b, a, inside);
    if (p_line > 0. && o > 0. && p < 1.) col = mix(col, p_color, (1. - smoothstep(p_line, p_line + .002, abs(fromSeam - o))) * (1. - p));
    return vec4(col, 1.);
  }
  if (mode == 1){
    float o = .5 * (1. - ss_ease(p));
    vec2 bu = uv + axisV * side * o;
    float inside = fromSeam >= o ? 1. : 0.;
    vec3 a = texture(uA, ss_zoom(uv, -p_zoom * .5 * p)).rgb;
    a *= 1. - p_shadow * .55 * p;
    vec3 b = texture(uB, bu).rgb;
    b *= 1. - p_shadow * .5 * exp(-(fromSeam - o) * 30.) * step(.0001, o);
    vec3 col = mix(a, b, inside);
    if (p_line > 0. && o > 0. && p > 0.) col = mix(col, p_color, (1. - smoothstep(p_line, p_line + .002, abs(fromSeam - o))));
    return vec4(col, 1.);
  }
  /* through colour: two panels close over A, then open again over B */
  float q = p < .5 ? ss_ease(p * 2.) : 1. - ss_ease(p * 2. - 1.);
  float o = .5 * (1. - q);
  vec3 img = p < .5 ? texture(uA, ss_zoom(uv, -p_zoom * .5 * q)).rgb : texture(uB, ss_zoom(uv, p_zoom * q)).rgb;
  img *= 1. - p_shadow * .5 * q * exp(-max(o - fromSeam, 0.) * 8.);
  vec3 pan = p_color * (1. - p_shadow * .35 * exp(-(fromSeam - o) * 40.));
  pan *= 1. - p_shadow * .25 * exp(-fromSeam * 60.) * step(o, .001);
  return vec4(fromSeam >= o && q > 0. ? pan : img, 1.);
}` });

FX.register({ id:'tr-strip-slide', name:'Strip slide', cat:'transition', family:'panels', search:['sliding bands', 'sliding boxes', 'slash slide', 'stagger', 'strips', 'multi-slide'],
  desc:'B arrives in strips that slide in one after another, from alternating sides if you like, at any angle.',
  params:[ I('count','Strips',8,2,40), R('angle','Angle',0,-180,180,1), T('alt','Alternate sides',true), S('order','Order',['In sequence','From centre','Random'],0), R('stagger','Stagger',.5,0,.9),
    S('mode','Mode',['Slide over','Push A out'],0), R('shadow','Edge shadow',.35,0,1) ],
  fs:`float sl_ease(float t){ t = clamp(t, 0., 1.); return 1. - pow(1. - t, 3.); }
vec4 fx(vec2 uv){
  vec2 dir = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 c = centered(uv);
  float ar = aspect();
  float extA = abs(perp.x) * ar * .5 + abs(perp.y) * .5;
  float extL = abs(dir.x) * ar * .5 + abs(dir.y) * .5;
  float n = max(p_count, 1.);
  float across = (dot(c, perp) + extA) / (2. * extA);
  float id = clamp(floor(across * n), 0., n - 1.);
  float ord = id / max(n - 1., 1.);
  int om = int(p_order + .5);
  if (om == 1) ord = abs(ord - .5) * 2.;
  else if (om == 2) ord = hash12(vec2(id, 7.3));
  float st = clamp(p_stagger, 0., .9);
  float q = clamp((uProgress - ord * st) / (1. - st), 0., 1.);
  float e = sl_ease(q);
  if (q >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  if (q <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  float s = (p_alt > .5 && mod(id, 2.) > .5) ? -1. : 1.;
  float along = dot(c, dir) * s;
  float edge = -extL + 2. * extL * e;
  float travel = 2. * extL * (1. - e);
  if (along < edge){
    vec2 cb = c - dir * s * travel;
    vec3 b = texture(uB, mirrorUv(uncentered(cb))).rgb;
    return vec4(b, 1.);
  }
  vec2 ca = p_mode > .5 ? c - dir * s * 2. * extL * e : c;
  vec3 a = texture(uA, mirrorUv(uncentered(ca))).rgb;
  a *= 1. - p_shadow * .6 * exp(-(along - edge) * 25.);
  return vec4(a, 1.);
}` });

FX.register({ id:'tr-band-rise', name:'Band rise', cat:'transition', family:'panels', search:['line reveal', 'split text', 'mask reveal', 'stagger', 'rows'],
  desc:'The frame is cut into bands and inside each one B rises into place behind its own edge, band after band.',
  params:[ I('bands','Bands',6,2,30), S('dir','Travel',['Up','Down','Left','Right'],0), S('order','Order',['In sequence','Reverse','From centre','Random'],0), R('stagger','Stagger',.55,0,.9),
    T('push','Push A out',true), R('overshoot','Overshoot',0,0,1) ],
  fs:`float br_ease(float t, float o){
  t = clamp(t, 0., 1.);
  float u = t - 1.;
  float k = 2.5 * o;
  return o > 0. ? 1. + (k + 1.) * u * u * u + k * u * u : 1. - pow(1. - t, 4.);
}
vec4 fx(vec2 uv){
  int d = int(p_dir + .5);
  /* s runs along the travel; bands are cut across it, so each band is a thin slot B travels through */
  float s = d == 0 ? uv.y : d == 1 ? 1. - uv.y : d == 2 ? 1. - uv.x : uv.x;
  float r = d < 2 ? 1. - uv.y : uv.x;
  float n = max(p_bands, 1.);
  float h = 1. / n;
  float id = clamp(floor(s * n), 0., n - 1.);
  float ord = clamp(floor(r * n), 0., n - 1.) / max(n - 1., 1.);
  int om = int(p_order + .5);
  if (om == 1) ord = 1. - ord;
  else if (om == 2) ord = abs(ord - .5) * 2.;
  else if (om == 3) ord = hash12(vec2(id, 3.7));
  float st = clamp(p_stagger, 0., .9);
  float q = clamp((uProgress - ord * st) / (1. - st), 0., 1.);
  if (q <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (q >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  float e = br_ease(q, p_overshoot);
  float lo = id * h;
  float f = (s - lo) / h;
  vec2 tv = d == 0 ? vec2(0., 1.) : d == 1 ? vec2(0., -1.) : d == 2 ? vec2(-1., 0.) : vec2(1., 0.);
  if (f < e){
    float sb = clamp(s + (1. - e) * h, lo, lo + h - 1e-4);
    return vec4(texture(uB, uv + tv * (sb - s)).rgb, 1.);
  }
  float sa = p_push > .5 ? s - e * h : s;
  return vec4(texture(uA, uv + tv * (sa - s)).rgb, 1.);
}` });

FX.register({ id:'tr-shape-overlay', name:'Shape overlays', cat:'transition', family:'panels', search:['page transition', 'curtain', 'wave', 'overlay', 'bezier'],
  desc:'Layers of colour rise with a soft, uneven curved edge to cover A, then sweep on to leave B.',
  params:[ S('dir','Direction',['Up','Down','Left','Right'],0), I('layers','Layers',3,1,3), R('curve','Curve',.35,0,1), R('wobble','Unevenness',.3,0,1), R('lag','Layer lag',.12,0,.3), R('hold','Hold',.06,0,.4),
    C('color','Colour 1','#141516','ground'), C('color2','Colour 2','#ff5a36','accent'), C('color3','Colour 3','#c9f5e4','accent2') ],
  fs:`float so_ease(float t){ t = clamp(t, 0., 1.); return t < .5 ? 4. * t * t * t : 1. - pow(-2. * t + 2., 3.) / 2.; }
/* per-layer delay along the edge: a few random control points, smoothly joined, plus a centre-first bulge */
float so_delay(float x, float layer, float seed){
  float g = x * 3.;
  float i = floor(g), f = fract(g);
  f = f * f * (3. - 2. * f);
  float n = mix(hash12(vec2(i, layer + seed)), hash12(vec2(i + 1., layer + seed)), f);
  return p_curve * (1. - sin(clamp(x, 0., 1.) * PI)) * .6 + p_wobble * n * .4;
}
vec4 fx(vec2 uv){
  int m = int(p_dir + .5);
  float t = m == 0 ? uv.y : m == 1 ? 1. - uv.y : m == 2 ? 1. - uv.x : uv.x;
  float x = m < 2 ? uv.x : uv.y;
  float p = uProgress;
  float L = clamp(floor(p_layers + .5), 1., 3.);
  float ph = .5 - p_hold * .5;
  float P1 = clamp(p / ph, 0., 1.), P2 = clamp((p - .5 - p_hold * .5) / ph, 0., 1.);
  float dmax = p_curve * .6 + p_wobble * .4;
  float span = max(1. - (L - 1.) * p_lag - dmax, .05);
  for (int k = 2; k >= 0; k--){
    float fk = float(k);
    if (fk > L - 1.) continue;
    float head = so_ease((P1 - fk * p_lag - so_delay(x, fk, 1.)) / span);
    float tail = so_ease((P2 - (L - 1. - fk) * p_lag - so_delay(x, fk, 9.)) / span);
    if (P1 > 0. && t < head * 1.001 && t >= tail && tail < 1.){
      int j = int(L - 1. - fk);
      return vec4(j == 0 ? p_color : j == 1 ? p_color2 : p_color3, 1.);
    }
  }
  return vec4(p < .5 ? texture(uA, uv).rgb : texture(uB, uv).rgb, 1.);
}` });

FX.register({ id:'tr-drip-cover', name:'Drip cover', cat:'transition', family:'panels', search:['gooey', 'liquid', 'paint', 'melt', 'blob', 'metaball'],
  desc:'Thick drips run down the frame and merge, through a colour or straight into B.',
  params:[ S('mode','Mode',['Through colour','Straight to B'],0), S('dir','Direction',['Down','Up'],0), I('columns','Drips',7,3,24), R('random','Unevenness',.45,0,.9), R('goo','Merge',.08,0,.25), R('rim','Sheen',.4,0,1),
    C('color','Colour','#ff5a36','accent') ],
  fs:`float dc_smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / max(k, 1e-4), 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
/* signed distance to the merged drips at phase P (0 = none, 1 = frame covered) */
float dc_field(vec2 q, float P, float seed){
  float ar = aspect();
  float n = max(p_columns, 1.);
  float w = ar / n;
  float r = w * .8;
  float ci = floor((q.x + ar * .5) / w);
  float d = 1e3;
  for (int k = -2; k <= 2; k++){
    float i = ci + float(k);
    if (i < 0. || i > n - 1.) continue;
    float xc = -ar * .5 + (i + .5) * w;
    float del = hash12(vec2(i, seed)) * p_random;
    float lq = clamp((P - del) / (1. - p_random), 0., 1.);
    lq = lq * lq * (3. - 2. * lq);
    float front = mix(-r * 1.5, 1. + r * 1.2, lq);
    vec2 v = vec2(q.x - xc, q.y - clamp(q.y, -1., front));
    d = dc_smin(d, length(v) - r, p_goo);
  }
  return d;
}
vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  /* q.y is depth from the edge the drips start at */
  vec2 q = vec2(c.x, p_dir < .5 ? .5 - c.y : c.y + .5);
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float aa = 1.5 / uRes.y;
  if (p_mode > .5){
    if (p <= 0.) return vec4(a, 1.);
    if (p >= 1.) return vec4(b, 1.);
    float d = dc_field(q, p, 3.);
    float m = 1. - smoothstep(-aa, aa, d);
    vec3 col = mix(a, b, m);
    float sheen = exp(-pow((d + .009) / .005, 2.)) * p_rim;
    col = mix(col, vec3(1.), sheen * .35 * m);
    col *= 1. - .35 * p_rim * exp(-max(d, 0.) / .01) * (1. - m);
    return vec4(col, 1.);
  }
  float P = p < .5 ? p * 2. : p * 2. - 1.;
  vec3 under = p < .5 ? a : p_color;
  vec3 over = p < .5 ? p_color : b;
  if (P <= 0.) return vec4(under, 1.);
  float d = dc_field(q, P, p < .5 ? 3. : 11.);
  float m = 1. - smoothstep(-aa, aa, d);
  vec3 top = over;
  if (p < .5){
    float sheen = exp(-pow((d + .009) / .005, 2.)) * p_rim;
    top = mix(top, vec3(1.), sheen * .4);
  }
  vec3 col = mix(under, top, m);
  col *= 1. - .3 * p_rim * exp(-max(d, 0.) / .012) * (1. - m);
  if (p >= 1.) col = b;
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-skew-panel', name:'Skew panel', cat:'transition', family:'panels', search:['diagonal', 'slant', 'agency', 'skew', 'sweep'],
  desc:'A slanted panel sweeps across and B follows it in, sheared at first and straightening as it lands.',
  params:[ S('dir','Direction',['Left → right','Right → left','Bottom → top','Top → bottom'],0), R('angle','Slant',22,-45,45,1), R('skew','Shear',.35,0,1), R('slide','Slide',.3,0,1), R('width','Panel width',.22,0,.6),
    C('color','Panel','#141516','ground') ],
  fs:`vec4 fx(vec2 uv){
  int m = int(p_dir + .5);
  vec2 c = centered(uv);
  float ar = aspect();
  /* rotate the frame so the motion always runs along +x */
  vec2 q = m == 0 ? c : m == 1 ? -c : m == 2 ? vec2(c.y, -c.x) : vec2(-c.y, c.x);
  float ex = m < 2 ? ar * .5 : .5, ey = m < 2 ? .5 : ar * .5;
  vec2 ax = m == 0 ? vec2(1., 0.) : m == 1 ? vec2(-1., 0.) : m == 2 ? vec2(0., 1.) : vec2(0., -1.);
  vec2 ay = vec2(-ax.y, ax.x);
  float sl = tan(radians(p_angle));
  float s = q.x + q.y * sl;
  float ext = ex + ey * abs(sl);
  float p = uProgress;
  float wp = p_width * sin(p * PI);
  float E = mix(-ext, ext + p_width, p);
  vec3 col;
  if (p >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (s < E - wp){
    float k = 1. - p;
    k = k * k;
    vec2 bq = vec2(q.x - p_slide * k * .5 - p_skew * q.y * k, q.y);
    vec2 bc = ax * bq.x + ay * bq.y;
    col = texture(uB, mirrorUv(uncentered(bc))).rgb;
    col *= 1. - .35 * exp(-(E - wp - s) * 18.) * step(.001, wp);
  } else if (s < E){
    col = p_color * (1. - .18 * (s - E + wp) / max(wp, 1e-4));
  } else {
    float k = p * p;
    vec2 aq = vec2(q.x - p_slide * k * .3 + p_skew * .5 * q.y * k, q.y);
    vec2 acn = ax * aq.x + ay * aq.y;
    col = texture(uA, mirrorUv(uncentered(acn))).rgb;
  }
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-curtain-draw', name:'Curtains', cat:'transition', family:'panels', search:['stage', 'theatre', 'drape', 'cloth', 'fabric', 'open'],
  desc:'A becomes two cloth curtains that gather into folds as they are drawn aside to show B.',
  params:[ S('split','Opens',['From centre','To the left','To the right'],0), I('folds','Folds',9,2,24), R('shade','Fold shading',.55,0,1), R('gather','Gather',.6,0,1), R('tint','Cloth tint',0,0,1),
    C('color','Cloth colour','#7a1f24',false) ],
  fs:`/* one curtain: x01 runs from the fixed outer edge (0) to the moving inner edge (1); w is its current width */
vec3 cd_cloth(float x01, float y, float g, float cx0, float sideSign){
  float n = max(p_folds, 1.);
  /* gathering bunches the cloth: the fold phase squeezes in where the cloth is bunched */
  float ph = x01 * n;
  float u = x01 + g * p_gather * sin(ph * TAU) / (TAU * n) * .9;
  float srcX = cx0 + sideSign * u * .5;
  float lit = .5 + .5 * cos(ph * TAU + .6);
  vec3 col = texture(uA, vec2(srcX, y)).rgb;
  col = mix(col, col * p_color * 1.6, p_tint);
  col *= 1. - p_shade * g * (1. - lit) * .75;
  col += p_shade * g * pow(lit, 8.) * .08;
  return col;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 b = texture(uB, uv).rgb;
  if (p >= 1.) return vec4(b, 1.);
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  float e = p * p * (3. - 2. * p);
  float g = smoothstep(0., .5, p);
  /* the tie-back pinches each curtain a little at two thirds height */
  float pinch = 1. - .22 * g * exp(-pow((uv.y - .38) / .22, 2.));
  int sp = int(p_split + .5);
  vec3 col = b;
  float shadow = 0.;
  if (sp == 0){
    float w = .5 * (1. - e) * pinch;
    if (uv.x < w) col = cd_cloth(uv.x / w, uv.y, g, 0., 1.);
    else if (1. - uv.x < w) col = cd_cloth((1. - uv.x) / w, uv.y, g, 1., -1.);
    else shadow = exp(-min(uv.x - w, 1. - uv.x - w) * 22.);
  } else {
    float w = (1. - e) * pinch;
    float x = sp == 1 ? uv.x : 1. - uv.x;
    if (x < w) col = cd_cloth(x / w, uv.y, g, sp == 1 ? 0. : 1., sp == 1 ? 2. : -2.);
    else shadow = exp(-(x - w) * 22.);
  }
  col *= 1. - .5 * shadow * (1. - p);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-shred-fall', name:'Shred', cat:'transition', family:'panels', search:['strips', 'fall', 'paper', 'shredder', 'drop', 'gravity'],
  desc:'A is cut into strips that drop away one by one, tipping as they fall, to leave B.',
  params:[ I('strips','Strips',16,4,60), R('random','Randomness',.6,0,.9), R('tilt','Tilt',.35,0,1), R('sway','Sway',.3,0,1), S('dir','Fall',['Down','Up'],0), R('shade','Edge shade',.35,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 b = texture(uB, uv).rgb;
  if (p >= 1.) return vec4(b, 1.);
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  float ar = aspect();
  vec2 c = centered(uv);
  if (p_dir > .5) c.y = -c.y;
  float n = max(p_strips, 1.);
  float w = ar / n;
  float ci = floor((c.x + ar * .5) / w);
  float st = clamp(p_random, 0., .9);
  /* strips can swing into their neighbours' columns, so test a few either side */
  for (int k = -5; k <= 5; k++){
    float i = ci + float(k);
    if (i < 0. || i > n - 1.) continue;
    float h1 = hash12(vec2(i, 4.1)), h2 = hash12(vec2(i, 8.7)), h3 = hash12(vec2(i, 2.3));
    float q = clamp((p - h1 * st) / (1. - st), 0., 1.);
    if (q <= 0.){ if (k == 0) return vec4(texture(uA, uv).rgb, 1.); continue; }
    float drop = q * q * 1.45;
    float ang = (h2 - .5) * 2. * p_tilt * .5 * q * q;
    vec2 ctr = vec2(-ar * .5 + (i + .5) * w + (h3 - .5) * p_sway * .25 * q * q, -drop);
    vec2 lp = rot(-ang) * (c - ctr);
    if (abs(lp.x) < w * .5 && abs(lp.y) < .5){
      vec2 src = vec2(-ar * .5 + (i + .5) * w + lp.x, lp.y);
      if (p_dir > .5) src.y = -src.y;
      vec3 col = texture(uA, uncentered(src)).rgb;
      float edge = 1. - smoothstep(0., w * .5, w * .5 - abs(lp.x));
      col *= 1. - p_shade * .5 * edge * smoothstep(0., .1, q);
      return vec4(col, 1.);
    }
  }
  return vec4(b * (1. - .25 * (1. - p)), 1.);
}` });

FX.register({ id:'tr-tile-shrink', name:'Tile shrink', cat:'transition', family:'panels', search:['grid', 'mosaic', 'scale down', 'squares', 'stagger'],
  desc:'A breaks into a grid of tiles that shrink and turn away in a wave, or B arrives as tiles that grow to fill the frame.',
  params:[ I('rows','Rows',8,2,30), S('order','Order',['Diagonal','From centre','Random','Rows'],0), S('mode','Mode',['A shrinks away','B grows in'],0), R('turn','Turn',45,-180,180,1), R('round','Rounding',0,0,1), R('stagger','Stagger',.6,0,.95) ],
  fs:`float ts_local(vec2 id, vec2 grid){
  vec2 n = (id + .5) / grid;
  int om = int(p_order + .5);
  float o = om == 0 ? (n.x + 1. - n.y) * .5 : om == 1 ? length((n - .5) * vec2(aspect(), 1.)) / length(vec2(aspect(), 1.) * .5) : om == 2 ? hash12(id + 21.) : 1. - n.y;
  float st = clamp(p_stagger, 0., .95);
  return clamp((uProgress - clamp(o, 0., 1.) * st) / (1. - st), 0., 1.);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(a, 1.);
  if (p >= 1.) return vec4(b, 1.);
  float ar = aspect();
  float rows = max(p_rows, 1.);
  float cs = 1. / rows;
  vec2 grid = vec2(ceil(ar * rows), rows);
  vec2 c = uv * vec2(ar, 1.);
  vec2 own = floor(c / cs);
  bool grow = p_mode > .5;
  for (int k = 0; k < 9; k++){
    vec2 id = own + vec2(float(k == 0 ? 0 : (k - 1) % 3 - 1), float(k == 0 ? 0 : (k - 1) / 3 - 1));
    if (k > 0 && id == own) continue;
    if (id.x < 0. || id.y < 0. || id.x >= grid.x || id.y >= grid.y) continue;
    float q = ts_local(id, grid);
    float e = q * q * (3. - 2. * q);
    float s = grow ? e : 1. - e;
    float ang = radians(p_turn) * (grow ? 1. - e : e);
    if (s <= .001) continue;
    vec2 ctr = (id + .5) * cs;
    vec2 l = rot(ang) * (c - ctr) / s;
    float r = p_round * .5 * cs * (grow ? 1. - e : e);
    if (sdRoundBox(l, vec2(cs * .5), r) <= 0.){
      vec2 src = (ctr + l) / vec2(ar, 1.);
      return vec4(grow ? texture(uB, src).rgb : texture(uA, src).rgb, 1.);
    }
  }
  return vec4(grow ? a : b, 1.);
}` });

FX.register({ id:'tr-honeycomb', name:'Honeycomb pop', cat:'transition', family:'panels', search:['hexagon', 'hex', 'cells', 'pop', 'powerpoint'],
  desc:'Hexagonal cells pull in and pop back out as B, rippling out from a point.',
  params:[ R('size','Cell size',.09,.03,.3), S('order','Order',['From a point','Random','Sweep down'],0), R('x','Origin X',0,-1,1), R('y','Origin Y',0,-1,1), R('stagger','Stagger',.65,0,.95), R('pop','Pop',.5,0,1),
    C('color','Gap','#141516','ground') ],
  fs:`vec4 hc_cell(vec2 p){
  vec2 s = vec2(1., 1.7320508);
  vec4 hC = floor(vec4(p, p - vec2(.5, 1.)) / s.xyxy) + .5;
  vec4 h = vec4(p - hC.xy * s, p - (hC.zw + .5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy) : vec4(h.zw, hC.zw + .5);
}
float hc_sd(vec2 p){ p = abs(p); return max(dot(p, vec2(.5, .8660254)), p.x) - .5; }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(a, 1.);
  if (p >= 1.) return vec4(b, 1.);
  float ar = aspect();
  vec2 c = centered(uv);
  float sz = max(p_size, .01);
  vec4 h = hc_cell(c / sz);
  vec2 ctr = (c / sz - h.xy) * sz;
  vec2 cn = uncentered(ctr);
  int om = int(p_order + .5);
  vec2 org = vec2(p_x * ar * .5, p_y * .5);
  float far = length(vec2(ar * .5, .5) + abs(org));
  float o = om == 0 ? length(ctr - org) / far : om == 1 ? hash12(h.zw * 1.31 + 5.) : 1. - cn.y;
  float st = clamp(p_stagger, 0., .95);
  float q = clamp((p - clamp(o, 0., 1.) * st) / (1. - st), 0., 1.);
  if (q <= 0.) return vec4(a, 1.);
  if (q >= 1.) return vec4(b, 1.);
  bool second = q > .5;
  float t = second ? q * 2. - 1. : q * 2.;
  float s;
  if (second){
    float k = 2.6 * p_pop, u = t - 1.;
    s = 1. + (k + 1.) * u * u * u + k * u * u;
  } else s = 1. - t * t;
  s = max(s, 1e-3);
  float tilt = (second ? 1. - t : t) * p_pop;
  vec2 l = rot(tilt * .5) * h.xy / s;
  float d = hc_sd(l) * s * sz;
  float aa = 1.2 / uRes.y;
  if (d > aa || s < .01) return vec4(p_color, 1.);
  vec2 src = uncentered(ctr + l * sz);
  vec3 img = second ? texture(uB, src).rgb : texture(uA, src).rgb;
  /* a cell catches light as it lifts toward the viewer */
  float lift = second ? max(s - 1., 0.) * 2. + (1. - t) * .3 : t * .3;
  img = mix(img, vec3(1.), lift * p_pop * .4 * smoothstep(-.4, .5, l.y - l.x * .3));
  img *= 1. - .35 * smoothstep(-sz * .12 * s, 0., d) * p_pop * (second ? 1. - t : 1.);
  return vec4(mix(img, p_color, smoothstep(-aa, aa, d)), 1.);
}` });

FX.register({ id:'tr-glitter', name:'Glitter', cat:'transition', family:'panels', search:['sparkle', 'diamonds', 'flip', 'shimmer', 'keynote', 'powerpoint'],
  desc:'Small diamond or triangle facets flip over from A to B in a ragged wave, catching the light edge-on.',
  params:[ S('shape','Facets',['Diamonds','Triangles'],0), R('rows','Rows',16,4,50,1), S('dir','Direction',DIRS4,1), R('random','Raggedness',.6,0,1), R('glint','Glint',.8,0,2),
    C('color','Glint colour','#ffffff',false), R('dim','Gap darkness',.6,0,1) ],
  fs:`/* returns the facet centre (centred coords) in xy and its id in zw; z also says which way a triangle points */
vec4 gt_cell(vec2 c, float sz, int shape){
  if (shape == 0){
    vec2 r = rot(PI * .25) * c / sz;
    vec2 id = floor(r) + .5;
    return vec4(rot(-PI * .25) * id * sz, id);
  }
  vec2 q = c / sz;
  float bb = q.y / .8660254, aa = q.x - .5 * bb;
  vec2 cell = floor(vec2(aa, bb)), f = fract(vec2(aa, bb));
  float up = step(1., f.x + f.y);
  vec2 g = cell + (up > .5 ? vec2(2. / 3.) : vec2(1. / 3.));
  return vec4(vec2(g.x + .5 * g.y, .8660254 * g.y) * sz, cell.x * 2. + up, cell.y);
}
float gt_inside(vec2 l, float sz, int shape, float up){
  if (shape == 0) return abs(l.x) + abs(l.y) - sz * .70710678;
  vec2 t = l / sz;
  if (up > .5) t.y = -t.y;
  return sdTri(t, .5) * sz;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(a, 1.);
  if (p >= 1.) return vec4(b, 1.);
  int shape = int(p_shape + .5);
  float sz = 1. / max(p_rows, 1.) * (shape == 0 ? 1.41421 : 1.);
  vec2 c = centered(uv);
  vec4 cell = gt_cell(c, sz, shape);
  vec2 ctr = cell.xy, l = c - ctr;
  vec2 cn = uncentered(ctr);
  int m = int(p_dir + .5);
  float o = m == 0 ? 1. - cn.y : m == 1 ? cn.x : m == 2 ? cn.y : 1. - cn.x;
  o = clamp(o, 0., 1.) * (1. - p_random * .6) + hash12(cell.zw + 3.7) * p_random * .6;
  float span = .3;
  float q = clamp((p - o * (1. - span)) / span, 0., 1.);
  if (q <= 0.) return vec4(a, 1.);
  if (q >= 1.) return vec4(b, 1.);
  float cf = cos(q * PI);
  float k = max(abs(cf), 1e-3);
  vec2 lf = vec2(l.x / k, l.y);
  float up = shape == 1 ? mod(cell.z, 2.) : 0.;
  float d = gt_inside(lf, sz, shape, up);
  vec3 col;
  if (d > 0.) col = mix(a, b, q) * (1. - p_dim);
  else {
    vec2 src = uncentered(ctr + lf);
    col = cf > 0. ? texture(uA, src).rgb : texture(uB, src).rgb;
    /* the facet darkens as it turns away, and flares as it passes edge-on */
    col *= .55 + .45 * k;
    float edgeOn = pow(1. - k, 5.);
    float sweep = smoothstep(.35, 0., abs(lf.x / sz + (cf > 0. ? .3 : -.3) - .4 * sign(cf) * (1. - k)));
    col += p_color * p_glint * (edgeOn * .9 + sweep * .25 * (1. - k));
  }
  /* a few facets throw a small four-point sparkle as they turn */
  float sp = step(.7, hash12(cell.zw + 9.1)) * pow(sin(q * PI), 6.);
  vec2 sl = abs(l) / sz;
  float star = max(1. - smoothstep(0., .03, sl.x) - smoothstep(0., .5, sl.y), 0.) + max(1. - smoothstep(0., .03, sl.y) - smoothstep(0., .5, sl.x), 0.);
  col += p_color * p_glint * sp * clamp(star, 0., 1.) * .8;
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-tri-shards', name:'Triangle shards', cat:'transition', family:'panels', search:['triangles', 'shatter', 'geometric', 'facets', 'carousel'],
  desc:'A breaks into a lattice of triangles that spin down to nothing at random, and B grows back out of the same lattice.',
  params:[ R('rows','Rows',9,3,30,1), R('random','Randomness',.6,0,.9), R('spin','Spin',.6,0,2), R('jitter','Size jitter',.4,0,1), R('turn','Lattice turn',.08,0,.5), R('dim','Gap darkness',.65,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(a, 1.);
  if (p >= 1.) return vec4(b, 1.);
  float sz = 1. / max(p_rows, 1.) * 1.1547;
  /* the lattice itself turns a little while the shards are in flight */
  mat2 R = rot(p_turn * sin(p * PI));
  vec2 c = R * centered(uv);
  vec2 q = c / sz;
  float bb = q.y / .8660254, aa = q.x - .5 * bb;
  vec2 cell = floor(vec2(aa, bb)), f = fract(vec2(aa, bb));
  float up = step(1., f.x + f.y);
  vec2 g = cell + (up > .5 ? vec2(2. / 3.) : vec2(1. / 3.));
  vec2 ctr = vec2(g.x + .5 * g.y, .8660254 * g.y) * sz;
  vec2 id = vec2(cell.x * 2. + up, cell.y);
  float h1 = hash12(id + 1.3), h2 = hash12(id + 7.9), h3 = hash12(id + 4.4);
  float st = clamp(p_random, 0., .9);
  /* each shard spins down as A on its own clock, then grows back as B on the mirrored curve */
  float lq = clamp((p - h1 * st) / (1. - st), 0., 1.);
  bool isB = lq >= .5;
  float t = isB ? 2. - lq * 2. : lq * 2.;
  if (!isB && t <= 0.) return vec4(a, 1.);
  if (isB && t <= 0.) return vec4(b, 1.);
  float e = t * t * (3. - 2. * t);
  float s = (1. - e) * (1. - p_jitter * .5 * h2 * e);
  float ang = (h3 - .5) * 2. * p_spin * PI * e;
  vec3 gap = mix(a, b, smoothstep(.3, .7, p)) * (1. - p_dim);
  if (s <= .002) return vec4(gap, 1.);
  vec2 l = rot(ang) * (c - ctr) / s;
  vec2 tl = l / sz;
  if (up > .5) tl.y = -tl.y;
  float d = sdTri(tl, .5) * sz * s;
  float aa2 = 1. / uRes.y;
  vec2 src = uncentered(transpose(R) * (ctr + l));
  vec3 img = isB ? texture(uB, src).rgb : texture(uA, src).rgb;
  img *= 1. - .3 * e;
  return vec4(mix(img, gap, smoothstep(-aa2, aa2, d)), 1.);
}` });
