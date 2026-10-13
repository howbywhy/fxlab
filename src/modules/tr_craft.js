/* ---------------- Transitions: craft ---------------- */
/* Print rooms, darkrooms, folding tables and looms: each one is a way a made
   object carries A to B. They all start exactly on A and end exactly on B;
   the craft lives in the middle of the move. */

FX.register({ id:'tr-screenprint', name:'Screenprint pass', cat:'transition', search:['screen print', 'silkscreen', 'squeegee', 'cmyk', 'misregistration', 'poster', 'pull', 'ink'],
  desc:'B is printed onto fresh paper one ink at a time, each pulled across by a squeegee and slightly out of register until it settles.',
  params:[ S('inks','Inks',['Tonal layers from B','Process (CMY)'],0), S('dir','Pull',DIRS4,0), R('stagger','Pass stagger',.2,0,.33), R('misreg','Misregistration',.012,0,.04,.001), R('mesh','Screen mesh',.5,0,1), C('paper','Paper','#f4f0e6',false) ],
  fs:`float screenprint_coord(vec2 uv, int m){ return m == 0 ? 1. - uv.y : m == 1 ? uv.x : m == 2 ? uv.y : 1. - uv.x; }
vec4 fx(vec2 uv){
  float p = uProgress;
  int m = int(p_dir + .5);
  bool tonal = p_inks < .5;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec3 col = mix(a, p_paper, smoothstep(0., .18, p));
  float coord = screenprint_coord(uv, m);
  float T0 = .1, span = .76;
  float dur = span * (1. - 2. * p_stagger);
  /* every ink drifts out of register as it goes down, then all of them snap home together */
  float settle = 1. - smoothstep(.72, .9, p);
  float mesh = 1. - p_mesh * .22 * (.5 + .5 * sin(uv.x * uRes.x * .55) * sin(uv.y * uRes.y * .55));
  float px = 1. / uRes.y;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float s0 = T0 + fi * p_stagger * span;
    float t = clamp((p - s0) / max(dur, 1e-3), 0., 1.);
    float pos = mix(-.03, 1.03, t);
    float behind = pos - coord;
    float laid = smoothstep(-1.5 * px, 1.5 * px, behind);
    float bead = 1. + .3 * exp(-max(behind, 0.) * 70.) * step(t, .999);
    vec2 off = vec2(cos(fi * 2.4 + .7), sin(fi * 2.4 + .7)) * p_misreg * settle;
    vec3 bs = texture(uB, clamp(uv + off, 0., 1.)).rgb;
    if (tonal){
      /* a reduction print: light tone, then mid tone, then the key, each a flat opaque layer in B's own hues */
      float thr = .86 - fi * .28, lev = .8 - fi * .29;
      float ls = luma(bs);
      float cov = smoothstep(thr + .015, thr - .015, ls) * laid;
      vec3 ink = bs * (lev / max(ls, .04));
      ink = clamp(mix(vec3(luma(ink)), ink, 1.35), 0., 1.);
      col = mix(col, ink * mesh * (1. - .06 * (bead - 1.)), cov);
    } else {
      /* process inks are filters: cyan takes red, magenta takes green, yellow takes blue */
      float cov = clamp((1. - bs[i]) * laid * mesh * bead, 0., 1.);
      vec3 f = vec3(1.); f[i] = 1. - cov * .96;
      col *= f;
    }
    /* the squeegee blade: a soft shadow ahead of it and a wet glint on its edge */
    float on = sin(PI * t);
    col *= 1. - .22 * on * exp(-max(-behind, 0.) * 55.) * step(behind, 0.);
    col += vec3(.16) * on * exp(-abs(behind) * uRes.y * .35);
  }
  col = mix(col, b, smoothstep(.86, 1., p));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-riso-drum', name:'Riso drum', cat:'transition', nonLocal:true, search:['risograph', 'riso', 'duotone', 'zine', 'grain', 'fluoro', 'spot colour', 'print'],
  desc:'A fresh sheet feeds in over A carrying B in grainy, streaky spot ink, the second drum lays its colour on top, and then the grain clears to the photograph.',
  params:[ C('first','First ink','#ff48b0','accent'), C('second','Second ink','#3255a4','accent2'), R('grain','Grain (px)',2,1,5,.5), R('starve','Streaks',.35,0,.8), R('misreg','Misregistration',.006,0,.02,.0005), C('paper','Paper','#f3efe6',false) ],
  fs:`float riso_ink(vec2 su, float cov, float seed){
  vec2 cell = floor(su * uRes / p_grain);
  float starve = 1. - p_starve * smoothstep(.35, .75, fbm(vec2(su.x * 40., seed)));
  return step(hash12(cell + seed * 37.), cov * starve);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  /* the sheet's leading edge comes down from the top and carries its print with it */
  float feed = smoothstep(0., .42, p);
  float edge = feed * 1.02;
  float fromTop = 1. - uv.y;
  float settle = 1. - smoothstep(.6, .9, p);
  vec2 su = vec2(uv.x + .004 * (uv.y - .5) * settle, uv.y - 1. + min(edge, 1.));
  float onSheet = step(fromTop, edge);
  float l1 = luma(texture(uB, clamp(su, 0., 1.)).rgb);
  float l2 = luma(texture(uB, clamp(su + vec2(p_misreg, -p_misreg * .6) * settle, 0., 1.)).rgb);
  float c1 = smoothstep(.95, .3, l1) * .92;
  float c2 = smoothstep(.62, .1, l2);
  /* the second drum passes over the sheet once it has settled */
  float pass2 = mix(-.03, 1.03, smoothstep(.36, .7, p));
  float sFromTop = 1. - su.y;
  float k1 = riso_ink(su, c1, 1.);
  float k2 = riso_ink(su + vec2(p_misreg, -p_misreg * .6) * settle, c2, 7.) * step(sFromTop, pass2);
  vec3 sheet = p_paper * mix(vec3(1.), p_first, k1) * mix(vec3(1.), p_second, k2);
  sheet *= .96 + .04 * hash12(floor(su * uRes * .5) + 3.);
  vec3 col = mix(a * (1. - .45 * exp(-max(fromTop - edge, 0.) * 28.) * step(.001, feed) * (1. - feed * feed)), sheet, onSheet);
  /* the grain dissolves cell by cell into the photograph */
  float r = smoothstep(.7, 1., p) * 1.3 - .15;
  float h = hash12(floor(uv * uRes / (p_grain * 1.5)) + 91.);
  col = mix(col, b, smoothstep(h - .15, h + .15, r));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-deboss', name:'Blind deboss', cat:'transition', search:['emboss', 'deboss', 'letterpress', 'blind emboss', 'paper', 'stationery', 'foil', 'press', 'packaging'],
  desc:'A turns to blank paper with B pressed into it, and then the ink floods into the impression, darkest parts first.',
  params:[ R('depth','Depth',1.5,0,4), R('light','Light angle',135,-180,180,1), R('soft','Flood softness',.1,.02,.3), R('hold','Blind hold',.5,.25,.75), C('paper','Paper','#efebe2',false) ],
  fs:`float deboss_h(vec2 uv){ return luma(texture(uB, clamp(uv, 0., 1.)).rgb); }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float lb = luma(b);
  /* two scales of slope: a fine edge for the bite of the plate, a broad one for the cushion of the paper */
  vec2 e1 = vec2(2., 0.) / uRes.y, e2 = vec2(7., 0.) / uRes.y;
  vec2 g1 = vec2(deboss_h(uv + e1.xy) - deboss_h(uv - e1.xy), deboss_h(uv + e1.yx) - deboss_h(uv - e1.yx));
  vec2 g2 = vec2(deboss_h(uv + e2.xy) - deboss_h(uv - e2.xy), deboss_h(uv + e2.yx) - deboss_h(uv - e2.yx));
  vec2 g = g1 * 1.1 + g2 * .9;
  vec3 n = normalize(vec3(g * p_depth * 2.4, 1.));
  vec3 L = normalize(vec3(cos(radians(p_light)), sin(radians(p_light)), .9));
  /* clamped so a hard edge in B reads as a crisp bevel, not a black rule */
  float shade = clamp(dot(n, L) - L.z, -.22, .22);
  float press = smoothstep(.04, .4, p);
  float lift = 1. - smoothstep(.82, 1., p);
  vec3 paper = p_paper * (.97 + .03 * vnoise(uv * uRes.y * .35));
  vec3 col = mix(a, paper, smoothstep(0., .3, p));
  /* the impression: dark parts of B sit lowest and catch a little shade at rest */
  float sink = (1. - lb) * .07 * p_depth / 1.5;
  col *= 1. + (shade * 1.4 - sink) * press * lift;
  /* ink floods the deepest parts first */
  float f = (p - p_hold) / max(.94 - p_hold, .01);
  float front = mix(-p_soft - .02, 1. + p_soft + .02, clamp(f, 0., 1.));
  float depthOrder = 1. - lb;
  float cov = smoothstep(-p_soft, p_soft, front - (1. - depthOrder));
  float wet = exp(-abs(front - (1. - depthOrder)) / max(p_soft * .35, .005)) * step(0., f) * step(f, 1.);
  vec3 inked = b * (1. + shade * 1.4 * press * lift * .6) * (1. - .18 * wet);
  col = mix(col, inked, cov);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-cyanotype', name:'Cyanotype exposure', cat:'transition', search:['cyanotype', 'sun print', 'blueprint', 'prussian blue', 'alternative process', 'photogram', 'botanical'],
  desc:'A fades to a blue sun print, B exposes in Prussian blue on brush-coated paper, shadows first, and then its colour washes back in.',
  params:[ C('blue','Prussian','#1e3a6e',false), C('paper','Paper','#f2eedf',false), R('curve','Exposure curve',1.4,.5,3), R('rough','Coating roughness',.05,0,.15,.005), R('ret','Colour return',.75,.55,.92) ],
  fs:`vec3 cyanotype_tone(vec3 c, float k){ return mix(p_blue, p_paper, pow(clamp(luma(c), 0., 1.), k)); }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec3 ca = cyanotype_tone(a, p_curve), cb = cyanotype_tone(b, p_curve);
  vec3 col = mix(a, ca, smoothstep(0., .28, p));
  /* exposure: B's shadows go blue first as the threshold falls */
  float ex = clamp((p - .26) / max(p_ret - .3, .05), 0., 1.);
  float thr = mix(1.12, -.12, ex);
  float n = fbm(uv * vec2(aspect(), 1.) * 9.);
  float darkness = 1. - luma(b) + (n - .5) * .12;
  float exposed = smoothstep(thr - .12, thr + .12, darkness);
  col = mix(col, cb, exposed * step(.26, p));
  /* brush-coated edge: raw paper creeps in from the border while the print is out of the wash */
  vec2 c = centered(uv);
  float edgeDist = min(.5 * aspect() - abs(c.x), .5 - abs(c.y));
  float brush = fbm(vec2(uv.x * 4., uv.y * 30.)) * .7 + fbm(uv * 60.) * .3;
  float coat = smoothstep(0., .01, edgeDist - (.012 + p_rough * (.25 + brush)));
  float mid = smoothstep(.1, .32, p) * (1. - smoothstep(p_ret - .02, p_ret + .08, p));
  col = mix(col, p_paper * (.96 + .04 * brush), (1. - coat) * mid);
  /* the wash: colour returns in watery patches */
  float w = clamp((p - p_ret) / max(1. - p_ret, .01), 0., 1.);
  float wn = fbm(uv * vec2(aspect(), 1.) * 3. + 4.);
  float r = w * 1.5 - .25;
  col = mix(col, b, smoothstep(wn - .25, wn + .25, r));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-darkroom', name:'Darkroom tray', cat:'transition', search:['darkroom', 'developer', 'safelight', 'analogue', 'film', 'photographic print', 'develop', 'chemical'],
  desc:'Under a red safelight A bleaches to blank paper and B develops out of it, shadows first, while the developer sloshes across the tray.',
  params:[ R('safelight','Safelight',.6,0,1), R('slosh','Slosh',.06,0,.2,.005), R('gamma','Shadows lead',1.5,.5,3), R('angle','Slosh direction',30,-180,180,1), C('paper','Paper','#f5f2ec',false) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec2 c = centered(uv);
  vec2 dir = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  float bell = sin(PI * clamp((p - .2) / .7, 0., 1.));
  /* the developer is a slow standing wave rocking across the tray */
  float wave = sin(dot(c, dir) * 6. + p * 11.) + .5 * sin(dot(c, vec2(-dir.y, dir.x)) * 4. - p * 7.);
  float t = (p - .22) / .6 + p_slosh * wave * bell;
  float D = 1. - luma(b);
  float dev = clamp(t * (.55 + p_gamma * D), 0., 1.);
  float density = D * smoothstep(0., 1., dev);
  vec3 mono = p_paper * (1. - density);
  vec3 col = mix(a, p_paper, smoothstep(.02, .22, p));
  col = mix(col, mono, smoothstep(.2, .26, p));
  /* a glint where the meniscus passes */
  col += vec3(.1, .05, .04) * smoothstep(.85, 1., sin(dot(c, dir) * 6. + p * 11. - 1.1)) * bell * p_slosh * 8.;
  /* colour returns as the room lights come up */
  float lights = smoothstep(.84, 1., p);
  col = mix(col, b, lights);
  float red = p_safelight * smoothstep(0., .14, p) * (1. - lights);
  col *= mix(vec3(1.), vec3(1., .33, .27), red);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-paper-fold', name:'Paper fold', cat:'transition', nonLocal:true, search:['fold', 'origami', 'crease', 'letter', 'sheet', 'paper', 'stationery', 'folding carton'],
  desc:'A folds in half along a crease like a sheet of paper, then in half again, and the folded packet slides away to leave B.',
  params:[ S('folds','Folds',['One','Two'],1), R('angle','Crease angle',0,-90,90,1), R('back','Show-through',.6,0,1), R('crease','Crease shadow',.45,0,1), R('shadow','Drop shadow',.5,0,1), C('paper','Paper','#f6f3ec',false) ],
  fs:`vec3 fold_front(vec2 x){ return texture(uA, uncentered(x)).rgb; }
/* the back of the sheet: paper with A showing through faintly, mirrored because it is seen from behind */
vec3 fold_back(vec2 x){ vec3 a = texture(uA, uncentered(x)).rgb; return mix(p_paper * .97, mix(p_paper, a, .45) * .95, p_back); }
float fold_rim(vec2 x){ vec2 q = vec2(.5 * aspect(), .5) - abs(x); return min(q.x, q.y); }
bool fold_in(vec2 x){ return fold_rim(x) >= 0.; }
float fold_ease(float t){ t = clamp(t, 0., 1.); return t < .5 ? 4. * t * t * t : 1. - pow(-2. * t + 2., 3.) / 2.; }
/* inverts up to two orthographic folds: the newest flap is on top, so it is tested first */
bool fold_at(vec2 x, bool two, float ph1, float ph2, vec2 n1, vec2 n2, out vec3 col, out float light){
  light = 1.;
  col = vec3(0.);
  float rim = 1.;
  if (two && ph2 > 0.){
    float c2 = cos(ph2), s2 = dot(x, n2);
    if (abs(c2) > 1e-3){
      float d = s2 / c2;
      vec2 xp = x + (d - s2) * n2;
      if (d > 0. && fold_in(xp) && dot(xp, n1) <= 0.){
        /* the face of this flap is the back of the first flap; turned over, it is the back of the sheet */
        col = c2 > 0. ? fold_back(xp - 2. * dot(xp, n1) * n1) : fold_back(xp);
        light = c2 > 0. ? 1. - .35 * sin(ph2) : .93 + .07 * sin(ph2);
        light *= 1. - .12 * sin(ph2) * (1. - smoothstep(0., .006, min(fold_rim(xp), -dot(xp, n1))));
        return true;
      }
    }
    if (s2 <= 0. && fold_in(x) && dot(x, n1) <= 0.){
      col = fold_back(x - 2. * dot(x, n1) * n1);
      light = (1. - p_crease * .5 * sin(ph2) * exp(-abs(s2) * 16.)) * (1. - .12 * (1. - smoothstep(0., .006, min(fold_rim(x), -dot(x, n1)))));
      return true;
    }
    return false;
  }
  float c1 = cos(ph1), s1 = dot(x, n1);
  if (abs(c1) > 1e-3){
    float d = s1 / c1;
    vec2 xp = x + (d - s1) * n1;
    if (d > 0. && fold_in(xp)){
      col = c1 > 0. ? fold_front(xp) : fold_back(xp);
      light = c1 > 0. ? 1. - .4 * sin(ph1) : .93 + .07 * sin(ph1);
      light *= 1. - .12 * sin(ph1) * (1. - smoothstep(0., .006, min(fold_rim(xp), d)));
      return true;
    }
  }
  if (s1 <= 0. && fold_in(x)){
    col = fold_front(x);
    light = 1. - p_crease * .55 * sin(ph1) * exp(-abs(s1) * 12.);
    return true;
  }
  return false;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  bool two = p_folds > .5;
  vec3 bcol = texture(uB, uv).rgb;
  float tf1 = two ? p / .34 : p / .5;
  float tf2 = two ? (p - .34) / .34 : -1.;
  float te = clamp(two ? (p - .68) / .32 : (p - .5) / .5, 0., 1.);
  float ph1 = PI * fold_ease(tf1), ph2 = tf2 > 0. ? PI * fold_ease(tf2) : 0.;
  /* the packet lifts, shrinks a little and slides off the bottom */
  float ex = te * te * (3. - 2. * te);
  float sc = 1. - .18 * ex;
  vec2 shift = vec2(.08 * ex, -1.3 * ex * ex);
  float tilt = -.12 * ex;
  vec2 n1 = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 n2 = vec2(-n1.y, n1.x);
  vec3 col; float light;
  vec2 x = rot(-tilt) * (centered(uv) - shift) / sc;
  if (fold_at(x, two, ph1, ph2, n1, n2, col, light)) return vec4(col * light, 1.);
  /* B is the table; the lifted sheet throws a soft shadow onto it */
  float lift = max(min(sin(ph1) + sin(ph2) + ex * 2., 1.), .45 * smoothstep(0., .03, p)) * (1. - te);
  vec3 dc; float dl; float sh = 0.;
  for (int k = 0; k < 6; k++){
    vec2 o = vec2(.012, -.02) * (1. + float(k)) * (.4 + lift);
    vec2 xs = rot(-tilt) * (centered(uv) - shift - o) / sc;
    sh += fold_at(xs, two, ph1, ph2, n1, n2, dc, dl) ? 1. : 0.;
  }
  return vec4(bcol * (1. - sh / 6. * p_shadow * .8 * smoothstep(0., .15, lift)), 1.);
}` });

FX.register({ id:'tr-accordion-pleat', name:'Accordion pleat', cat:'transition', nonLocal:true, search:['concertina', 'pleat', 'fold', 'brochure', 'zigzag', 'leaflet', 'fan fold'],
  desc:'A concertinas into pleats and folds away to one side while B unfolds from the other.',
  params:[ I('pleats','Pleats',10,4,40), R('contrast','Light',.38,0,.6), R('depth','Depth',.2,0,.4,.005), S('dir','A folds towards',['Right','Left'],0), C('bg','Behind','#141516','ground') ],
  fs:`vec3 pleat_sheet(sampler2D s, float local, float y, float alpha, out float inside){
  float N = p_pleats;
  float f = local * N;
  float i = floor(f), u = fract(f);
  /* valleys sit on alternate creases, further from the eye, so they shrink and the zigzag shows top and bottom */
  float ridge = mod(i, 2.) < .5 ? u : 1. - u;
  float sa = sin(alpha);
  float sy = 1. - p_depth * sa * (1. - ridge);
  float yy = (y - .5) / sy + .5;
  inside = step(0., yy) * step(yy, 1.) * step(0., local) * step(local, 1.);
  vec3 c = texture(s, vec2(local, clamp(yy, 0., 1.))).rgb;
  float face = mod(i, 2.) < .5 ? 1. : -1.;
  float lit = 1. + p_contrast * sa * face;
  float crease = 1. - .35 * sa * (1. - smoothstep(0., .06, min(u, 1. - u))) * step(.5, 1. - ridge);
  return c * lit * crease;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float x = p_dir < .5 ? uv.x : 1. - uv.x;
  /* projected width of each sheet is the cosine of its fold angle */
  float wa = 1. - p, wb = p;
  float alphaA = acos(clamp(wa, 0., 1.)), alphaB = acos(clamp(wb, 0., 1.));
  float ins = 0.;
  vec3 col = p_bg;
  if (x >= p){
    float local = (x - p) / max(wa, 1e-4);
    vec3 c = pleat_sheet(uA, p_dir < .5 ? local : 1. - local, uv.y, alphaA, ins);
    col = mix(p_bg, c, ins);
  } else {
    float local = x / max(wb, 1e-4);
    vec3 c = pleat_sheet(uB, p_dir < .5 ? local : 1. - local, uv.y, alphaB, ins);
    col = mix(p_bg, c, ins);
  }
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-loom', name:'Loom', cat:'transition', search:['weave', 'woven', 'textile', 'thread', 'fabric', 'twill', 'warp', 'weft', 'cloth'],
  desc:'B is woven into A thread by thread, each weft passing over and under the warp before the cloth relaxes into B.',
  params:[ R('width','Thread width (px)',12,4,40,1), S('pattern','Weave',['Plain','Twill','Satin'],1), R('stagger','Stagger',.5,0,.9), R('shade','Thread shading',.3,0,.6), R('gap','Gap',.1,0,.3) ],
  fs:`bool loom_over(float i, float j, int pat){
  if (pat == 0) return mod(i + j, 2.) < .5;
  if (pat == 1) return mod(i + j, 4.) < 2.;
  return mod(i * 2. + j, 5.) > .5;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec2 P = uv * uRes / p_width;
  vec2 id = floor(P), f = fract(P);
  float rows = uRes.y / p_width;
  float fromTop = 1. - (id.y + .5) / rows;
  int pat = int(p_pattern + .5);
  bool over = loom_over(id.x, id.y, pat);
  float tex = smoothstep(0., .14, p) * (1. - smoothstep(.84, 1., p));
  /* each weft row is shuttled across in turn, alternating direction like a real pick */
  float span = .66 * p_stagger;
  float s0 = .12 + fromTop * span;
  float dur = .7 - span;
  float t = clamp((p - s0) / max(dur, .02), 0., 1.);
  float x = mod(id.y, 2.) < .5 ? uv.x : 1. - uv.x;
  float head = mix(-.04, 1.04, t);
  bool weftB = x < head;
  /* the warp is re-threaded from the top, a little behind the shuttle */
  float warpFront = mix(-.05, 1.05, clamp((p - .2) / .62, 0., 1.));
  bool warpB = (1. - uv.y) < warpFront;
  float g = p_gap * .5 * tex;
  float inWeft = smoothstep(g - .04, g + .04, f.y) * smoothstep(g - .04, g + .04, 1. - f.y);
  float inWarp = smoothstep(g - .04, g + .04, f.x) * smoothstep(g - .04, g + .04, 1. - f.x);
  vec3 weft = weftB ? b : a, warp = warpB ? b : a;
  float sh = p_shade * tex;
  /* round threads: lit along the middle, falling off to each side, dipping where they pass under */
  float cyW = 1. - sh * pow(2. * f.y - 1., 2.) * 1.2;
  float cyV = 1. - sh * pow(2. * f.x - 1., 2.) * 1.2;
  float dipW = 1. - sh * .5 * pow(abs(2. * f.x - 1.), 6.);
  float dipV = 1. - sh * .5 * pow(abs(2. * f.y - 1.), 6.);
  weft *= cyW * dipW; warp *= cyV * dipV;
  vec3 hole = mix(a, b, step(.5, p)) * (1. - .7 * tex);
  vec3 top = over ? weft : warp, under = over ? warp : weft;
  float topM = over ? inWeft : inWarp, underM = over ? inWarp : inWeft;
  vec3 col = mix(mix(hole, under * (1. - .25 * tex), underM), top, topM);
  /* a small bright shuttle at the head of each moving row */
  float tip = exp(-abs(x - head) * uRes.x / p_width * 1.2) * step(.001, t) * step(t, .999) * inWeft;
  col += vec3(.18) * tip * tex;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-tesserae', name:'Tesserae', cat:'transition', search:['mosaic', 'tiles', 'roman', 'stone', 'grout', 'heritage', 'flip tiles'],
  desc:'A sets into a mosaic of stone tiles, the tiles turn over one by one to B, and then the grout sinks away into the photograph.',
  params:[ R('size','Tile size (px)',30,8,80,1), R('jitter','Hand-set',.35,0,1), R('grout','Grout (px)',3,0,8,.5), R('rand','Flip randomness',.7,0,1), C('groutColor','Grout','#e8e4dc',false) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float env = smoothstep(0., .28, p) * (1. - smoothstep(.8, .98, p));
  vec2 P = uv * uRes / p_size;
  vec2 id = floor(P);
  vec2 h2 = hash22(id + 3.1);
  float h = hash12(id + 7.7);
  /* a diagonal pass, broken up by chance */
  vec2 cuv = (id + .5) * p_size / uRes;
  float order = mix((1. - cuv.y) * .6 + cuv.x * .4, h, p_rand);
  float ft = .3 + .42 * order;
  float fl = clamp((p - ft) / .12, 0., 1.);
  float sx = abs(cos(PI * fl)), sc = 1. - .12 * sin(PI * fl);
  bool side = fl > .5;
  float ang = (hash12(id + 1.3) - .5) * .3 * p_jitter * env;
  vec2 off = (h2 - .5) * .14 * p_jitter * env;
  vec2 q = rot(ang) * (fract(P) - .5 - off);
  vec2 qs = q / vec2(max(sx, 1e-3), 1.) / sc;
  float halfSize = .5 - p_grout / p_size * .5 * env;
  float d = sdRoundBox(qs, vec2(halfSize), .08 * env * p_size / 30.);
  vec2 suv = (id + .5 + rot(-ang) * qs + off) * p_size / uRes;
  vec3 src = side ? texture(uB, suv).rgb : texture(uA, suv).rgb;
  vec3 flat_ = side ? texture(uB, cuv).rgb : texture(uA, cuv).rgb;
  vec3 tile = mix(src, flat_, .8 * env);
  /* stone: a little variation tile to tile, a faint texture, and light catching the top edge */
  float stone = 1. + ((h - .5) * .1 + (vnoise(qs * 9. + id) - .5) * .08) * env;
  float bevel = 1. + .14 * env * smoothstep(-.12, 0., d) * (qs.y > 0. ? 1. : -.6);
  tile *= stone * bevel * (1. - .3 * sin(PI * fl) * (1. - sx));
  vec3 grout = p_groutColor * (.9 + .1 * vnoise(uv * uRes * .25)) * (1. - .3 * smoothstep(.06, 0., d));
  float px = 1. / p_size;
  vec3 col = mix(tile, grout, smoothstep(-px, px, d));
  if (env <= 0.) col = p < .5 ? texture(uA, uv).rgb : texture(uB, uv).rgb;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-leaded-light', name:'Leaded light', cat:'transition', nonLocal:true, search:['stained glass', 'church window', 'rose window', 'glass', 'lead', 'came', 'cathedral', 'voronoi'],
  desc:'B lights up pane by pane like stained glass, spreading out from the centre of the window, and then the leading melts away.',
  params:[ R('size','Pane size',.1,.03,.3,.005), R('lead','Lead (px)',5,0,12,.5), R('refract','Refraction',.02,0,.06,.001), R('glow','Glow',.35,0,1), S('order','Order',['From the centre','Scattered','Top to bottom'],0), C('leadColor','Lead','#1a1a1a',false) ],
  fs:`vec2 leaded_point(vec2 cell){ return cell + .15 + .7 * hash22(cell + 11.); }
vec4 fx(vec2 uv){
  float p = uProgress;
  float env = smoothstep(0., .22, p) * (1. - smoothstep(.8, 1., p));
  vec2 x = centered(uv) / p_size;
  vec2 base = floor(x);
  /* nearest pane centre */
  vec2 best = vec2(0.); float bd = 1e9;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 c = leaded_point(base + vec2(i, j));
    float d = dot(x - c, x - c);
    if (d < bd){ bd = d; best = c; }
  }
  /* distance to the nearest edge between panes */
  float edge = 1e9;
  vec2 bc = floor(best);
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++){
    vec2 c = leaded_point(bc + vec2(i, j));
    vec2 dc = c - best;
    float l2 = dot(dc, dc);
    if (l2 > 1e-6) edge = min(edge, dot(.5 * (best + c) - x, dc) * inversesqrt(l2));
  }
  vec2 cuv = uncentered(best * p_size);
  int om = int(p_order + .5);
  float ord = om == 0 ? clamp(length(best * p_size) / .75, 0., 1.) : om == 1 ? hash12(bc + 5.) : 1. - clamp(cuv.y, 0., 1.);
  float ts = .2 + .55 * ord + (hash12(bc + 2.) - .5) * .06;
  bool lit = p > ts;
  vec2 r = (hash22(bc + 9.) - .5) * p_refract * env;
  vec3 src = lit ? texture(uB, clamp(uv + r, 0., 1.)).rgb : texture(uA, clamp(uv + r, 0., 1.)).rgb;
  vec3 mean = lit ? texture(uB, clamp(cuv, 0., 1.)).rgb : texture(uA, clamp(cuv, 0., 1.)).rgb;
  /* glass: colour gathered toward the pane's own, richer, brighter towards the middle of each pane */
  vec3 glass = mix(src, mean, .35 * env);
  vec3 hsv = rgb2hsv(glass);
  hsv.y = clamp(hsv.y * (1. + .7 * env), 0., 1.);
  glass = hsv2rgb(hsv);
  float edgePx = edge * p_size * uRes.y;
  glass *= 1. + p_glow * env * smoothstep(0., p_size * uRes.y * .4, edgePx) * .45;
  glass *= 1. + .4 * env * exp(-max(p - ts, 0.) * 22.) * step(ts, p);
  vec3 col = mix(src, glass, env);
  /* the lead came, with a soft highlight along its crown */
  float w = p_lead * .5 * env;
  float lm = clamp((w - edgePx) / 1.2 + .5, 0., 1.) * min(env * 8., 1.);
  float crown = 1. - clamp(edgePx / max(w, .01), 0., 1.);
  vec3 lead = p_leadColor * (1. + .9 * crown * crown) + vec3(.05) * crown;
  col = mix(col, lead, lm);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-cross-stitch', name:'Cross stitch', cat:'transition', search:['embroidery', 'needlework', 'stitch', 'aida', 'pixel', 'handmade', 'sampler', 'thread'],
  desc:'B is stitched in row by row as small coloured crosses on cloth, and then the stitches resolve into the photograph.',
  params:[ R('size','Stitch size (px)',14,6,40,1), R('thick','Thread thickness',.34,.15,.45), I('levels','Thread colours',8,2,16), S('order','Order',['Rows','Scattered','From the centre'],0), C('cloth','Cloth','#f3efe5',false) ],
  fs:`float stitch_seg(vec2 q, vec2 a, vec2 b, float len, out float along){
  vec2 ab = b - a;
  float t = clamp(dot(q - a, ab) / dot(ab, ab), 0., len);
  along = t;
  return length(q - a - ab * t);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec2 P = uv * uRes / p_size;
  vec2 id = floor(P), q = fract(P);
  vec2 cells = uRes / p_size;
  float row = cells.y - 1. - id.y;
  float xx = (id.x + .5) / cells.x;
  int om = int(p_order + .5);
  vec2 cuv = (id + .5) / cells;
  float ord = om == 0 ? (row + (mod(row, 2.) < .5 ? xx : 1. - xx)) / cells.y
            : om == 1 ? hash12(id + 4.)
            : clamp(length(centered(cuv)) / .7, 0., 1.);
  float lt = (p - .12 - ord * .58) / .12;
  /* aida: an even weave with a hole at every corner the needle goes through */
  /* the cloth is laid out a little ahead of the needle */
  float ordC = om == 0 ? 1. - uv.y : ord;
  float cloth = smoothstep(-.14, .0, (p - .02) - ordC * .58) * smoothstep(0., .06, p) * (1. - smoothstep(.86, 1., p));
  vec2 cq = abs(q - .5);
  float hole = smoothstep(.17, .1, length(.5 - cq));
  float weave = 1. - .05 * (sin(q.x * PI * 2.) * sin(q.y * PI * 2.));
  vec3 aida = p_cloth * weave * (1. - .45 * hole);
  vec3 col = mix(a, aida, cloth);
  vec3 th = texture(uB, cuv).rgb;
  /* a limited box of threads: tone is stepped, hue is kept */
  vec3 hs = rgb2hsv(th);
  hs.z = floor(hs.z * p_levels + .5) / p_levels;
  hs.y = floor(hs.y * p_levels * .5 + .5) / (p_levels * .5);
  th = hsv2rgb(hs);
  float r = p_thick * .5;
  float in1 = .07, in2 = .93;
  float al1, al2;
  float l1 = smoothstep(0., 1., clamp(lt * 2., 0., 1.));
  float l2 = smoothstep(0., 1., clamp(lt * 2. - 1., 0., 1.));
  float d1 = stitch_seg(q, vec2(in1), vec2(in2), l1, al1);
  float d2 = stitch_seg(q, vec2(in2, in1), vec2(in1, in2), l2, al2);
  float px = 1. / p_size;
  if (l1 > 0.){
    /* thread shadow on the cloth */
    float sd = stitch_seg(q - vec2(.04, -.05), vec2(in1), vec2(in2), l1, al1);
    col *= 1. - .25 * smoothstep(r + .08, r - .02, sd) * cloth;
    d1 = stitch_seg(q, vec2(in1), vec2(in2), l1, al1);
    float m1 = smoothstep(r + px, r - px, d1);
    float s1 = (1. - .55 * pow(d1 / r, 2.)) * (.84 + .16 * sin(al1 * 60. + d1 * 30.));
    col = mix(col, th * s1, m1);
  }
  if (l2 > 0.){
    float m2 = smoothstep(r + px, r - px, d2);
    float s2 = (1. - .55 * pow(d2 / r, 2.)) * (.84 + .16 * sin(al2 * 60. - d2 * 30.));
    col = mix(col, th * s2 * 1.04, m2);
  }
  col = mix(col, b, smoothstep(.84, 1., p));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-marbled-drop', name:'Marbled drop', cat:'transition', nonLocal:true, search:['marbling', 'suminagashi', 'ink drop', 'bookbinding', 'endpaper', 'rings', 'liquid'],
  desc:'Drops of B land on A as if it were floating marbling ink, pushing A outward into fine rings, until the last drop covers the frame.',
  params:[ I('drops','Drops',7,2,16), R('size','Drop size',.5,.1,1), R('spread','Spread',.5,0,1), R('ring','Ring line',.25,0,1), S('layout','Layout',['Scattered','In a line','Spiral'],0) ],
  fs:`vec2 marble_centre(float k, float n, int lay){
  if (lay == 1) return vec2((k / max(n - 1., 1.) - .5) * aspect() * .8 * (.3 + p_spread), 0.);
  if (lay == 2){ float ang = k * 2.39996; return vec2(cos(ang), sin(ang)) * sqrt(k / n) * .45 * (.3 + p_spread); }
  return (hash22(vec2(k, 4.2)) - .5) * vec2(aspect(), 1.) * .95 * (.25 + .75 * p_spread);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  int lay = int(p_layout + .5);
  float n = p_drops;
  vec2 x = centered(uv);
  vec3 b = texture(uB, uv).rgb;
  float lineW = 1.5 / uRes.y;
  float line = 0.;
  /* the exact marbling map, inverted: walk the drops from newest to oldest */
  for (int i = 15; i >= 0; i--){
    float k = float(i);
    if (k > n - 1.) continue;
    bool last = k > n - 1.5;
    float s0 = last ? .5 : k / max(n - 1., 1.) * .45;
    float d = last ? .5 : .4;
    float t = clamp((p - s0) / d, 0., 1.);
    if (t <= 0.) continue;
    float R = last ? 1.2 : (.06 + .1 * hash12(vec2(k, 8.))) * (.4 + 1.2 * p_size);
    float r = R * (last ? t * t * (3. - 2. * t) : 1. - pow(1. - t, 2.5));
    vec2 c = last ? marble_centre(k, n, lay) * .5 : marble_centre(k, n, lay);
    vec2 dv = x - c;
    float L = length(dv);
    if (L < r){
      /* a darker rim where the ink has gathered at the drop's edge */
      float rim = exp(-(r - L) / (lineW * 2.)) * p_ring;
      vec3 col = b * (1. - .55 * rim);
      return vec4(col * (1. - .6 * line), 1.);
    }
    line = max(line, exp(-(L - r) / lineW) * p_ring);
    x = c + dv * sqrt(max(1. - r * r / (L * L), 0.));
  }
  vec3 a = texture(uA, uncentered(x)).rgb;
  return vec4(a * (1. - .6 * line), 1.);
}` });

FX.register({ id:'tr-ebru-comb', name:'Ebru comb', cat:'transition', nonLocal:true, search:['marbling', 'ebru', 'feather', 'comb', 'nonpareil', 'bookbinding', 'pattern', 'chevron'],
  desc:'Stripes of B are laid into A and combed through, like Turkish paper marbling, into feathered chevrons that settle into B.',
  params:[ R('spacing','Tine spacing',.08,.02,.3,.005), R('strength','Comb strength',.15,0,.4,.005), R('sharp','Sharpness',.02,.005,.1,.001), R('freq','Stripes',10,3,40,.5), R('angle','Comb direction',-90,-180,180,1), T('back','Comb back',false) ],
  fs:`float ebru_tine(vec2 x, vec2 perp, float shift){ float f = fract(dot(x, perp) / p_spacing + shift); return abs(f - .5) * p_spacing; }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 m = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 perp = vec2(-m.y, m.x);
  vec2 c = centered(uv);
  /* the comb is dragged through and then the pattern relaxes into B */
  float alpha = p_strength * pow(sin(PI * p), .8) * (1. - smoothstep(.7, 1., p) * .6);
  float lam = p_sharp;
  /* tines move parallel to themselves, so distance to a tine is unchanged and the inverse is exact */
  vec2 x = c - m * alpha * lam / (ebru_tine(c, perp, 0.) + lam);
  if (p_back > .5) x = x + m * alpha * lam / (ebru_tine(x, perp, .5) + lam);
  float share = smoothstep(.04, .94, p);
  float s = fract(dot(x, m) * p_freq);
  float w = fwidth(dot(x, m) * p_freq) * 1.5 + .002;
  float mB = smoothstep(share + w, share - w, s);
  if (share >= .999) mB = 1.;
  if (share <= .001) mB = 0.;
  /* a thin dark line where the two inks meet */
  float edgeL = (1. - smoothstep(0., w * 2., abs(s - share))) * sin(PI * share) * .35;
  vec2 su = uncentered(x);
  vec3 a = texture(uA, clamp(su, 0., 1.)).rgb, b = texture(uB, clamp(su, 0., 1.)).rgb;
  vec3 col = mix(a, b, mB) * (1. - edgeL);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-engraving-relay', name:'Engraving relay', cat:'transition', search:['engraving', 'banknote', 'guilloche', 'etching', 'hatching', 'security print', 'line art', 'intaglio'],
  desc:'A turns into a banknote-style engraving, the hatching turns and redraws itself as B, and then the colour comes back.',
  params:[ R('spacing','Line spacing (px)',9,3,24,.5), R('from','Angle from',30,-90,90,1), R('to','Angle to',-30,-90,90,1), R('wave','Guilloché wave',.4,0,2), C('ink','Ink','#1b2a3a',false), C('paper','Paper','#f6f3ea',false) ],
  fs:`float engrave_lines(vec2 c, float ang, float l, float sp){
  vec2 dir = vec2(cos(radians(ang)), sin(radians(ang)));
  vec2 perp = vec2(-dir.y, dir.x);
  float s = dot(c, perp) * uRes.y / sp + p_wave * sin(dot(c, dir) * 14.) * 1.5;
  float dist = abs(fract(s) - .5);
  float w = .5 * clamp(1. - l, 0., 1.);
  float aa = fwidth(s) * .75 + .01;
  /* fades out as the cut gets thinner than the antialiasing, so blank paper stays blank */
  return (1. - smoothstep(w - aa, w + aa, dist)) * smoothstep(0., aa, w);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec2 c = centered(uv);
  float e = smoothstep(0., .22, p) * (1. - smoothstep(.78, 1., p));
  float k = smoothstep(.22, .78, p);
  float ang = mix(p_from, p_to, k * k * (3. - 2. * k));
  float l = mix(luma(a), luma(b), smoothstep(.3, .7, p));
  l = pow(clamp(l, 0., 1.), .9);
  float ink = engrave_lines(c, ang, l, p_spacing);
  /* deep shadows get a second, crossing cut */
  float cross_ = engrave_lines(c, ang + 75., clamp(l / .35, 0., 1.), p_spacing * 1.1);
  ink = max(ink, cross_);
  vec3 eng = mix(p_paper, p_ink, ink);
  vec3 col = mix(p < .5 ? a : b, eng, e);
  return vec4(col, 1.);
}` });
