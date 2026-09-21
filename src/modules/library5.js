/* ---------------- Library, fifth pass ----------------
   More of the staples an image language is built from: generators that stand
   on their own as grounds (waves, fractals, foil, cloth, paper), transitions
   with a physical feel (tearing, burning, turning), a few more ways to mix two
   images, and overlays made of nothing but shapes. */

const L5 = {
  /* a cyclic three-colour ramp: t wraps, so a moving phase never shows a seam */
  ramp3: `vec3 ramp3(float t, vec3 a, vec3 b, vec3 c){
  t = fract(t) * 3.;
  return t < 1. ? mix(a, b, smoothstep(0., 1., t)) : t < 2. ? mix(b, c, smoothstep(0., 1., t - 1.)) : mix(c, a, smoothstep(0., 1., t - 2.));
}`,
};

/* ================= Generators ================= */

FX.register({ id:'gen-chladni', name:'Chladni plate', cat:'generator', search:['cymatics', 'sand', 'vibration', 'standing wave', 'resonance', 'sound'],
  desc:'The figures sand makes on a vibrating plate: nodal lines that fold into new patterns as the mode changes. Loops seamlessly.',
  params:[ S('style','Style',['Sand lines','Fine sand','Bands'],0), I('n','Mode A',3,1,12), I('m','Mode B',5,1,12), R('morph','Morph',.85,0,1), R('detail','Overtone',.25,0,1), R('width','Line width (px)',3.5,.5,14), R('grain','Grain',.5,0,1), C('bg','Ground','#141516','ground'), C('fg','Sand','#e4e2dc','ink'), C('hi','Accent','#ff5a36','accent') ],
  fs:`float plate(vec2 q, float w){
  float n = p_n, m = p_m;
  float a = cos(n * PI * q.x) * cos(m * PI * q.y);
  float b = cos(m * PI * q.x) * cos(n * PI * q.y);
  float c = cos((n + 2.) * PI * q.x) * cos((m + 1.) * PI * q.y);
  return a + w * b + p_detail * .6 * c * sin(uLoop * TAU);
}
vec4 fx(vec2 uv){
  vec2 q = centered(uv) / aspect() + .5;
  float w = cos(uLoop * TAU) * p_morph + (1. - p_morph);
  float f = plate(q, w);
  float g = length(vec2(dFdx(f), dFdy(f))) + 1e-5;
  float d = abs(f) / g;
  int s = int(p_style + .5);
  vec3 col = p_bg;
  float lw = p_width * .5;
  float line = 1. - smoothstep(lw - 1., lw + 1., d);
  if (s == 0){
    col = mix(p_bg, p_fg, line);
  } else if (s == 1){
    float dens = exp(-abs(f) * 9. / max(p_width * .18, .05));
    vec2 px = floor(uv * uRes / max(uPx, 1.));
    float n1 = hash12(px + 7.);
    float n2 = hash12(floor(px * .5) + 91.);
    float dust = step(1. - dens * (.35 + .65 * p_grain), n1) * (.6 + .4 * n2);
    col = mix(p_bg, p_fg, dust);
    col += p_hi * exp(-abs(f) * 4.) * .12;
  } else {
    float sgn = smoothstep(-1.5, 1.5, f / g);
    vec3 side = mix(p_bg, mix(p_bg, p_hi, .55), sgn);
    col = mix(side, p_fg, line);
  }
  col += (hash12(uv * uRes) - .5) * .05 * p_grain;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'gen-fractal', name:'Fractal', cat:'generator', search:['julia', 'mandelbrot', 'newton', 'complex', 'math'],
  desc:'Julia sets, the Mandelbrot set or Newton basins, coloured through your palette. The Julia form breathes over the loop.',
  params:[ S('kind','Set',['Julia','Mandelbrot','Newton'],0), R('form','Form',.31,0,1), R('breathe','Breathe',.5,0,1), R('zoom','Zoom',1,.3,40), R('x','Centre X',0,-1.5,1.5), R('y','Centre Y',0,-1.5,1.5), R('bands','Colour bands',2.2,.3,8), I('iter','Detail',64,16,160), C('c1','Ground','#141516','ground'), C('c2','Colour','#ff5a36','accent'), C('c3','Light','#e4e2dc','ink') ],
  fs:`${L5.ramp3}
vec4 fx(vec2 uv){
  vec2 p = centered(uv) * 2.6 / p_zoom + vec2(p_x, p_y);
  int k = int(p_kind + .5);
  int N = int(p_iter);
  vec3 col = p_c1;
  if (k < 2){
    vec2 z, c;
    if (k == 0){
      float a = p_form * TAU;
      c = .7885 * vec2(cos(a), sin(a)) + p_breathe * .04 * vec2(cos(uLoop * TAU), sin(uLoop * TAU));
      z = p;
    } else { c = p; z = vec2(0.); }
    float it = 0.; bool esc = false;
    for (int i = 0; i < 160; i++){
      if (i >= N) break;
      z = vec2(z.x * z.x - z.y * z.y, 2. * z.x * z.y) + c;
      if (dot(z, z) > 256.){ esc = true; break; }
      it += 1.;
    }
    if (esc){
      float sm = it - log2(log2(dot(z, z))) + 4.;
      float t = sm / 22. * p_bands + uLoop * (k == 1 ? 1. : 0.);
      col = ramp3(t, p_c1, p_c2, p_c3);
      col = mix(p_c1, col, smoothstep(0., 4., sm));
    }
  } else {
    /* Newton's method on z^3 - 1, relaxed a little so the basins slide over the loop */
    vec2 z = p * 1.1;
    vec2 rel = vec2(1. + p_breathe * .18 * cos(uLoop * TAU), p_breathe * .18 * sin(uLoop * TAU));
    float it = 0.;
    for (int i = 0; i < 160; i++){
      if (i >= N) break;
      vec2 z2 = vec2(z.x * z.x - z.y * z.y, 2. * z.x * z.y);
      vec2 z3 = vec2(z2.x * z.x - z2.y * z.y, z2.x * z.y + z2.y * z.x);
      vec2 num = z3 - vec2(1., 0.), den = 3. * z2;
      vec2 q = vec2(num.x * den.x + num.y * den.y, num.y * den.x - num.x * den.y) / max(dot(den, den), 1e-6);
      vec2 nz = z - vec2(rel.x * q.x - rel.y * q.y, rel.x * q.y + rel.y * q.x);
      if (dot(nz - z, nz - z) < 1e-7){ z = nz; break; }
      z = nz; it += 1.;
    }
    float root = fract(atan(z.y, z.x) / TAU + 1. / 6.) * 3.;
    vec3 rc = root < 1. ? p_c2 : root < 2. ? p_c3 : mix(p_c1, p_c2, .4);
    col = mix(p_c1, rc, clamp(1.1 - it * .045 * p_bands, .12, 1.));
  }
  return vec4(col, 1.);
}` });

FX.register({ id:'gen-aurora', name:'Aurora', cat:'generator', search:['northern lights', 'sky', 'glow', 'night', 'curtain'],
  desc:'Curtains of light with fine vertical rays hanging over a night sky. Loops seamlessly.',
  params:[ I('layers','Curtains',3,1,5), R('height','Height',.55,.15,1), R('rays','Ray fineness',40,8,140,1), R('sway','Sway',.6,0,1.5), R('stars','Stars',.5,0,1), R('horizon','Base line',.28,0,.8), C('bg','Sky','#0b1020','ground'), C('c1','Lower light','#3dffb4','accent'), C('c2','Upper light','#8a5cff','accent2') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = vec2(uv.x * aspect(), uv.y);
  float ph = uLoop * TAU;
  vec3 sky = p_bg * (1. + .7 * (1. - uv.y) * (1. - uv.y));
  vec3 glow = vec3(0.);
  for (int i = 0; i < 5; i++){
    if (i >= int(p_layers)) break;
    float fi = float(i);
    vec2 o = vec2(cos(ph + fi * 2.1), sin(ph + fi * 2.1)) * p_sway;
    float bend = fbm(vec2(c.x * 1.3 + fi * 4.7, 1.3) + o * .6) - .5;
    float base = p_horizon + fi * .06 + bend * .55 * p_sway + .05 * sin(c.x * 3. + ph + fi);
    float d = uv.y - base;
    float ray = vnoise(vec2(c.x * p_rays * (1. + fi * .13) + fi * 9., 1.7) + vec2(0., o.y));
    float ray2 = vnoise(vec2(c.x * p_rays * .31 + fi * 3., 4.) + o);
    float body = smoothstep(-.015, .02, d) * exp(-max(d, 0.) / (p_height * (.16 + .05 * fi)));
    float rayAmt = mix(.35, 1., ray) * mix(.55, 1., ray2);
    float top = smoothstep(0., p_height * .9, d);
    vec3 lc = mix(p_c1, p_c2, clamp(top * 1.4, 0., 1.));
    float hem = exp(-pow(d / .012, 2.)) * .7;
    glow += lc * (body * rayAmt * .85 + hem * .35) * (1. - fi * .12);
  }
  vec3 col = 1. - (1. - sky) * (1. - clamp(glow, 0., 1.));
  vec2 g = uv * uRes / max(uPx, 1.) / 26.;
  vec2 gi = floor(g);
  float sh = hash12(gi);
  vec2 sp = hash22(gi + 3.) * .7 + .15;
  float star = step(1. - .06 * p_stars, sh) * (1. - smoothstep(0., .07, length(fract(g) - sp)));
  star *= .5 + .5 * sin(ph + sh * 60.);
  col += star * (1. - clamp(max(glow.g, glow.r) * 2., 0., 1.)) * .9;
  return vec4(col, 1.);
}` });

FX.register({ id:'gen-foil', name:'Holographic foil', cat:'generator', search:['iridescent', 'holo', 'hologram', 'rainbow', 'thin film', 'oil slick', 'metallic'],
  desc:'Crinkled iridescent foil that shifts colour as it tilts. Blend the brand colours with a full spectrum. Loops seamlessly.',
  params:[ R('scale','Scale',1.3,.3,6), R('crinkle','Crinkle',.35,0,1), R('bands','Colour bands',1.4,.3,6), R('spectrum','Full spectrum',.3,0,1), R('sparkle','Sparkle',.4,0,1), R('speed','Drift',.5,0,2), C('c1','Shadow','#0e1012','ground'), C('c2','Colour','#ff5a36','accent'), C('c3','Colour 2','#5cc8ff','accent2'), C('c4','Highlight','#f2efe6','ink') ],
  fs:`float foilH(vec2 p, vec2 lo){
  vec2 w = vec2(fbm(p * .8 + lo), fbm(p * .8 + vec2(4.3, 1.9) - lo.yx)) - .5;
  return fbm(p + w * 2.2 + lo * .4) + (vnoise(p * 4. + w * 3.) - .5) * p_crinkle * .35;
}
vec4 fx(vec2 uv){
  vec2 p = centered(uv) * p_scale;
  vec2 lo = vec2(cos(uLoop * TAU), sin(uLoop * TAU)) * p_speed;
  float e = 2. / uRes.y * p_scale;
  float h = foilH(p, lo);
  vec2 gr = vec2(foilH(p + vec2(e, 0.), lo) - foilH(p - vec2(e, 0.), lo), foilH(p + vec2(0., e), lo) - foilH(p - vec2(0., e), lo)) / (2. * e) * .35;
  vec3 n = normalize(vec3(-gr, 1.));
  float tilt = n.x * .7 + n.y * .5 + h * p_bands * 1.2 + uLoop;
  float f = fract(tilt) * 4.;
  vec3 brand = f < 1. ? mix(p_c1, p_c2, smoothstep(0., 1., f)) : f < 2. ? mix(p_c2, p_c3, smoothstep(1., 2., f)) : f < 3. ? mix(p_c3, mix(p_c4, p_c3, .3), smoothstep(2., 3., f)) : mix(mix(p_c4, p_c3, .3), p_c1, smoothstep(3., 4., f));
  vec3 rainbow = .55 + .4 * cos(TAU * (tilt + vec3(0., .33, .67)));
  vec3 col = mix(brand, rainbow, p_spectrum);
  col *= .6 + .55 * dot(n, normalize(vec3(-.3, .5, .8)));
  col += p_c4 * pow(max(dot(n, normalize(vec3(.2, .4, 1.))), 0.), 30.) * .4;
  float glint = hash12(floor(uv * uRes / max(uPx, 1.) * .5));
  col += p_c4 * step(.996 - .01 * p_sparkle, glint) * p_sparkle * (.5 + .5 * sin(uLoop * TAU + glint * 90.));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'gen-caustics', name:'Caustics', cat:'generator', search:['water', 'pool', 'light', 'underwater', 'ripple', 'reflection'],
  desc:'Sunlight net on the floor of a swimming pool. Loops seamlessly.',
  params:[ R('scale','Scale',3,.8,10), R('sharp','Sharpness',7,2,16), R('bright','Brightness',1.1,.2,2.5), R('depth','Depth tint',.5,0,1), I('speed','Drift',1,1,3), C('c1','Water','#0d2a3a','ground'), C('c2','Light','#c9f5e4','ink'), C('c3','Tint','#3fb6c8','accent') ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = mod(centered(uv) * TAU * p_scale * .5, TAU) - 250.;
  vec2 i = p; float c = 1.; float inten = .005;
  float ph = uLoop * TAU * p_speed;
  for (int n = 0; n < 5; n++){
    float k = n == 0 ? -2. : n == 1 ? -1. : n == 2 ? 1. : n == 3 ? 2. : 1.;
    float t = ph * k + float(n) * 1.3;
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1. / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  c /= 5.;
  c = 1.17 - pow(c, 1.4);
  float net = clamp(pow(abs(c), p_sharp) * p_bright, 0., 1.);
  float vig = 1. - p_depth * .55 * length(centered(uv));
  vec3 col = mix(p_c1, p_c3, .35 * p_depth + .15 * fbm(centered(uv) * 2. + uLoop)) * vig;
  col = mix(col, p_c2, net) + p_c2 * net * net * .25;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'gen-sunburst', name:'Sunburst', cat:'generator', search:['rays', 'radial', 'burst', 'poster', 'comic', 'starburst', 'fan'],
  desc:'Rays fanning out from a point, from flat poster wedges to twisting spokes. Loops seamlessly.',
  params:[ I('rays','Rays',24,4,90), R('balance','Ray width',.5,.1,.9), R('twist','Twist',0,-3,3), R('wobble','Wobble',.15,0,1), I('spin','Spin (steps per loop)',1,-4,4), S('colours','Colours',['Two','Three','Fade out'],2), R('glow','Centre glow',.6,0,1), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1), C('c1','Ground','#141516','ground'), C('c2','Ray','#e4e2dc','ink'), C('c3','Accent','#ff5a36','accent') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv) - vec2(p_x * aspect() * .5, p_y * .5);
  float r = length(c);
  float a = atan(c.y, c.x) / TAU;
  float n = p_rays;
  vec2 dir = c / max(r, 1e-4);
  a += p_twist * r * .5;
  a += p_wobble * (fbm(dir * 3. + r * 2. + 1.) - .5) * .12;
  float k = a * n + uLoop * p_spin;
  float id = floor(k);
  float f = fract(k);
  float aaw = clamp(n / (TAU * max(r, 1e-3)) * uPx / uRes.y * 1.4, 1e-4, .5);
  float wedge = smoothstep(0., aaw, f) * (1. - smoothstep(p_balance, p_balance + aaw, f));
  int m = int(p_colours + .5);
  vec3 ray = p_c2;
  if (m == 1){ float t = mod(id, 3.); ray = t < 1. ? p_c2 : t < 2. ? p_c3 : mix(p_c2, p_c3, .5); }
  vec3 col = mix(p_c1, ray, wedge);
  if (m == 2) col = mix(p_c1, mix(p_c3, p_c2, smoothstep(0., .6, r)), wedge * clamp(.3 + r * 1.6, 0., 1.));
  col = mix(col, p_c3, exp(-r * r * 9.) * p_glow * .55);
  col = mix(col, p_c2, exp(-r * r * 90.) * p_glow);
  return vec4(col, 1.);
}` });

FX.register({ id:'gen-ledwall', name:'LED wall', cat:'generator', search:['pixel', 'lattice', 'lamps', 'dots', 'screen', 'display', 'grid'],
  desc:'A lattice of lamps lit by a moving pattern, or by image A. Loops seamlessly.',
  params:[ S('pattern','Pattern',['Plasma','Waves','Radial'],0), R('cols','Lamps across',34,8,120,1), S('shape','Lamp',['Round','Square','Diamond'],0), R('size','Lamp size',.78,.2,1), R('glow','Glow',.5,0,1), I('steps','Brightness steps',0,0,10), T('image','Light from image A'), C('bg','Ground','#0e0f10','ground'), C('c1','Low','#2b2f6b','accent2'), C('c2','Mid','#ff5a36','accent'), C('c3','High','#f2efe6','ink') ],
  fs:`vec4 fx(vec2 uv){
  vec2 grid = vec2(p_cols, p_cols / aspect());
  vec2 g = uv * grid;
  vec2 id = floor(g), f = fract(g) - .5;
  vec2 cuv = (id + .5) / grid;
  vec2 pc = centered(cuv);
  float ph = uLoop * TAU;
  int pat = int(p_pattern + .5);
  float v;
  if (pat == 0) v = fbm(pc * 2.6 + vec2(cos(ph), sin(ph)) * .8);
  else if (pat == 1) v = .5 + .5 * sin(pc.x * 7. + pc.y * 3.5 - ph) * (.6 + .4 * cos(pc.y * 5. + ph));
  else v = .5 + .5 * sin(length(pc) * 14. - ph);
  if (pat == 0) v = smoothstep(.25, .75, v);
  vec3 lamp;
  if (p_image > .5){ lamp = texture(uA, cuv).rgb; v = luma(lamp); }
  else {
    if (p_steps > .5) v = floor(v * p_steps + .5) / p_steps;
    lamp = v < .5 ? mix(p_c1, p_c2, smoothstep(0., .5, v)) : mix(p_c2, p_c3, smoothstep(.5, 1., v));
  }
  if (p_steps > .5 && p_image > .5) lamp = floor(lamp * p_steps + .5) / p_steps;
  int sh = int(p_shape + .5);
  float d = sh == 0 ? length(f) : sh == 1 ? max(abs(f.x), abs(f.y)) : (abs(f.x) + abs(f.y)) * .7071;
  float r = p_size * .5 * (.7 + .3 * clamp(v * 1.2, 0., 1.));
  float aaw = .7 * grid.y / uRes.y;
  float m = 1. - smoothstep(r - aaw, r + aaw, d);
  vec3 col = p_bg + lamp * exp(-d * d * 14.) * p_glow * .35 * v;
  col = mix(col, lamp, m);
  return vec4(col, 1.);
}` });

FX.register({ id:'gen-textile', name:'Woven cloth', cat:'generator', search:['gingham', 'houndstooth', 'tartan', 'plaid', 'check', 'fabric', 'pattern', 'stripe', 'pinstripe', 'weave'],
  desc:'Gingham, houndstooth, tartan or pinstripe, woven thread by thread so the cloth reads up close.',
  params:[ S('pattern','Pattern',['Gingham','Houndstooth','Tartan','Pinstripe'],2), R('density','Thread density',70,24,200,1), R('scale','Pattern size',1,.5,3), R('relief','Thread relief',.7,0,1), R('ripple','Ripple',.3,0,1), I('drift','Drift (repeats per loop)',0,0,3), C('c1','Light','#e4e2dc','ink'), C('c2','Colour','#c8402a','accent'), C('c3','Dark','#1a1b1d','ground') ],
  fs:`vec3 tartan(float t){
  t = mod(t, 48.); t = t < 24. ? t : 47. - t;
  if (t < 10.) return p_c2;
  if (t < 14.) return p_c3;
  if (t < 16.) return p_c2;
  if (t < 18.) return p_c1;
  return p_c3;
}
vec3 thread(int k, float t){
  if (k == 0) return mod(t, 16.) < 8. ? p_c1 : p_c2;
  if (k == 1) return mod(t, 8.) < 4. ? p_c3 : p_c1;
  if (k == 2) return tartan(t);
  return mod(t, 20.) < 2. ? p_c1 : mix(p_c3, p_c2, .18);
}
vec4 fx(vec2 uv){
  int k = int(p_pattern + .5);
  vec2 p = uv * vec2(aspect(), 1.) * p_density / p_scale;
  float period = k == 0 ? 16. : k == 1 ? 8. : k == 2 ? 48. : 20.;
  p.x += uLoop * period * p_drift;
  vec2 id = floor(p), f = fract(p);
  bool pin = k == 3 && mod(id.x, 20.) < 2.;
  bool warp = k == 0 ? mod(id.x + id.y, 2.) < 1. : k == 3 ? (pin || mod(id.x + id.y, 4.) < 3.) : mod(id.x + id.y, 4.) < 2.;
  vec3 col = warp ? thread(k, id.x) : (k == 3 ? mix(p_c3, p_c2, .18) : thread(k, id.y));
  float across = warp ? f.x : f.y, along = warp ? f.y : f.x;
  float round1 = sin(across * PI);
  float dive = sin(along * PI);
  float lit = mix(1., .62 + .38 * pow(round1, .6), p_relief) * mix(1., .55 + .45 * pow(dive, .5), p_relief);
  float fib = hash12(floor(p * vec2(warp ? 1. : 5., warp ? 5. : 1.)) + id * .37);
  lit *= .92 + .16 * fib * p_relief;
  vec2 c = centered(uv);
  lit *= 1. + p_ripple * .22 * sin(c.x * 4. + c.y * 2.5 + uLoop * TAU) ;
  return vec4(clamp(col * lit, 0., 1.), 1.);
}` });

FX.register({ id:'gen-crumple', name:'Crumpled paper', cat:'generator', search:['paper', 'crease', 'fold', 'wrinkle', 'texture', 'foil', 'tin'],
  desc:'A sheet of paper folded over itself in every direction, with a lamp circling so the facets catch the light in turn. Loops seamlessly.',
  params:[ R('scale','Fold frequency',2.2,.8,5), R('relief','Relief',.7,.1,1.5), R('crease','Creases',.7,0,1), R('bend','Bend',.5,0,1), R('gloss','Gloss',.2,0,1), R('grain','Paper grain',.4,0,1), C('paper','Paper','#e4e2dc','ink'), C('shade','Shadow','#3b3d40','ground'), C('tint','Light tint','#ffd9b8','accent') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  vec2 q = c + (vec2(fbm(c * 1.6), fbm(c * 1.6 + 8.)) - .5) * .35 * p_bend;
  vec2 grad = vec2(0.);
  float crease = 0.;
  float pw = uPx / uRes.y * 1.5;
  for (int i = 0; i < 14; i++){
    float fi = float(i);
    vec2 hh = hash22(vec2(fi, 3.7));
    float a = hh.x * PI;
    vec2 d = vec2(cos(a), sin(a));
    float f = p_scale * (.5 + hh.y * 1.6) * (1. + .0 * fi);
    float x = dot(q, d) * f + hash12(vec2(fi, 9.1)) * 5.;
    float fr = fract(x);
    float amp = .55 + .45 * hash12(vec2(fi, 1.3));
    grad += (fr < .5 ? 1. : -1.) * d * f * amp;
    float kink = min(min(fr, abs(fr - .5)), 1. - fr) / f;
    crease += (1. - smoothstep(0., pw * 2. + .006, kink)) * amp * .55;
  }
  vec3 n = normalize(vec3(-grad * p_relief * .085, 1.));
  float ang = uLoop * TAU;
  vec3 L = normalize(vec3(cos(ang) * .8, sin(ang) * .8 + .2, .7));
  float diff = clamp(dot(n, L) / L.z, 0., 1.5);
  vec3 lightCol = mix(p_paper, p_paper * p_tint * 1.05, .3);
  vec3 col = mix(p_shade, lightCol, smoothstep(.05, 1.15, diff));
  col += pow(max(dot(n, normalize(L + vec3(0., 0., 1.))), 0.), 40.) * p_gloss * .5;
  col *= 1. - clamp(crease, 0., 1.) * p_crease * .35;
  col *= 1. + (fbm(c * 70.) - .5) * .3 * p_grain;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'gen-cubes', name:'Tumbling blocks', cat:'generator', search:['isometric', 'cubes', 'hexagon', 'escher', 'pattern', '3d', 'qbert', 'rhombus'],
  desc:'An isometric field of cubes whose faces trade colours, so the blocks seem to turn. Loops seamlessly.',
  params:[ R('density','Cube size',6,2,18), R('order','Randomness',.6,0,1), I('turns','Turns per loop',1,1,4), R('line','Line width (px)',2,0,8), R('shading','Face shading',.3,0,1), R('soft','Turn softness',.12,.02,.6), C('c1','Top','#e4e2dc','ink'), C('c2','Side','#ff5a36','accent'), C('c3','Side 2','#1a1b1d','ground'), C('edge','Line','#0e0f10','ground') ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = centered(uv) * p_density;
  vec2 s = vec2(1.7320508, 3.);
  vec2 offB = vec2(.8660254, 1.5);
  vec2 ia = floor((p + s * .5) / s), ib = floor((p - offB + s * .5) / s);
  vec2 ha = p - ia * s, hb = p - offB - ib * s;
  bool useA = dot(ha, ha) < dot(hb, hb);
  vec2 h = useA ? ha : hb;
  vec2 id = useA ? ia * 2. : ib * 2. + 1.;
  float ang = degrees(atan(h.y, h.x));
  int face = (ang > 30. && ang <= 150.) ? 0 : (ang > 150. || ang <= -90.) ? 1 : 2;
  float q = mix(id.x * .11 + id.y * .07, hash12(id + .5), p_order) + uLoop * p_turns;
  float t = fract(q) * 3.;
  float base = floor(t);
  float m = smoothstep(1. - p_soft, 1., fract(t));
  int c0 = int(mod(float(face) + base, 3.)), c1i = int(mod(float(face) + base + 1., 3.));
  vec3 a = c0 == 0 ? p_c1 : c0 == 1 ? p_c2 : p_c3;
  vec3 b = c1i == 0 ? p_c1 : c1i == 1 ? p_c2 : p_c3;
  vec3 col = mix(a, b, m);
  col *= face == 0 ? 1. : face == 1 ? 1. - .22 * p_shading : 1. - .42 * p_shading;
  float dHex = .8660254 - max(max(abs(h.x), abs(dot(h, vec2(.5, .8660254)))), abs(dot(h, vec2(-.5, .8660254))));
  float dIn = 9.;
  for (int i = 0; i < 3; i++){
    float a0 = radians(30. + 120. * float(i));
    vec2 dr = vec2(cos(a0), sin(a0));
    if (dot(h, dr) > 0.) dIn = min(dIn, abs(dot(h, vec2(-dr.y, dr.x))));
  }
  float pxw = p_density / uRes.y * uPx;
  float lw = p_line * .5 * pxw;
  float l = 1. - smoothstep(lw - pxw * .7, lw + pxw * .7, min(dHex, dIn));
  col = mix(col, p_edge, l * step(.01, p_line));
  return vec4(col, 1.);
}` });

FX.register({ id:'gen-bulge', name:'Bulge grid', cat:'generator', search:['vasarely', 'op art', 'sphere', 'lens', 'dots', 'optical', 'bulge', 'riley'],
  desc:'A flat grid of dots or squares swollen by a sphere that wanders through it, in the manner of Vasarely. Loops seamlessly.',
  params:[ S('shape','Shape',['Circle','Square','Diamond','Ring'],0), R('cells','Cells across',14,4,40,1), R('bulge','Bulge',.82,0,.97), R('radius','Sphere size',.75,.2,1.4), R('travel','Travel',.35,0,1), R('fill','Fill',.82,.2,1), T('alt','Alternate colours',true), C('bg','Ground','#141516','ground'), C('c1','Shape','#e4e2dc','ink'), C('c2','Shape 2','#ff5a36','accent') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float ph = uLoop * TAU;
  vec2 ctr = vec2(cos(ph), sin(ph * 2.)) * p_travel * .3;
  vec2 d = c - ctr;
  float r = length(d);
  float R = p_radius;
  float k = r < R ? 1. - p_bulge * pow(1. - r / R, 2.) : 1.;
  vec2 q = ctr + d * k;
  vec2 g = q * p_cells;
  vec2 id = floor(g), f = fract(g) - .5;
  vec2 fw = fwidth(g);
  float aaw = max(max(fw.x, fw.y), 1e-4) * .8;
  int s = int(p_shape + .5);
  float dist = s == 0 ? length(f) : s == 1 ? max(abs(f.x), abs(f.y)) : (abs(f.x) + abs(f.y)) * .7071;
  float rad = p_fill * .5;
  float m = s == 3 ? 1. - smoothstep(rad * .22 - aaw, rad * .22 + aaw, abs(length(f) - rad * .8)) : 1. - smoothstep(rad - aaw, rad + aaw, dist);
  vec3 sc = (p_alt > .5 && mod(id.x + id.y, 2.) > .5) ? p_c2 : p_c1;
  float shade = 1. - .25 * smoothstep(.0, R, r) * 0.;
  return vec4(mix(p_bg, sc * shade, m), 1.);
}` });

FX.register({ id:'gen-silk', name:'Satin folds', cat:'generator', search:['fabric', 'cloth', 'curtain', 'drape', 'ribbon', 'wave', 'sheen', 'gradient'],
  desc:'Soft folds of satin catching a low light, from deep shadow to a hard sheen. Loops seamlessly.',
  params:[ R('folds','Folds',3.6,.8,9), R('turb','Turbulence',1.2,0,2.5), R('angle','Angle',-28,-90,90,1), R('depth','Depth',.8,.3,2), R('sheen','Sheen',.7,0,1.5), R('speed','Drift',1,0,2), C('c1','Shadow','#0e1012','ground'), C('c2','Fabric','#5f8c7e','accent'), C('c3','Highlight','#f2efe6','ink') ],
  fs:`float silk(vec2 p){
  float ph = uLoop * TAU * p_speed;
  vec2 q = rot(radians(p_angle)) * p;
  float w = q.x * p_folds * 2.5 + sin(q.y * 1.6 + ph) * p_turb + sin(q.y * 3.3 - ph * 2. + q.x * .7) * p_turb * .35;
  return sin(w) * .6 + sin(w * .5 + q.y * .9 + ph) * .5;
}
vec4 fx(vec2 uv){
  vec2 p = centered(uv) * 1.4;
  float e = 2. / uRes.y;
  float h = silk(p);
  vec2 gr = vec2(silk(p + vec2(e, 0.)) - silk(p - vec2(e, 0.)), silk(p + vec2(0., e)) - silk(p - vec2(0., e))) / (2. * e) * .2 * p_depth;
  vec3 n = normalize(vec3(-gr, 1.));
  vec3 L = normalize(vec3(-.5, .6, .62));
  float diff = clamp(dot(n, L), 0., 1.);
  float s = clamp(diff * 1.5 - .25 + h * .08, 0., 1.);
  vec3 col = s < .55 ? mix(p_c1, p_c2, smoothstep(0., .55, s)) : mix(p_c2, p_c3, smoothstep(.55, 1.2, s) * .55);
  vec3 H = normalize(L + vec3(0., 0., 1.));
  col += p_c3 * pow(max(dot(n, H), 0.), 46.) * p_sheen * .9;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ================= Transitions ================= */

FX.register({ id:'tr-sortwipe', name:'Sort wipe', cat:'transition', search:['pixel sort', 'glitch', 'streak', 'datamosh', 'stretch'],
  desc:'A band of stretched, sorted pixel streaks sweeps across and leaves B behind it.',
  params:[ S('dir','Direction',DIRS4,1), R('band','Band width',.4,.05,.9), R('streak','Streak length',.6,.05,1), R('cols','Streak width (px)',5,1,40,1), S('sort','Keeps',['Brightest','Darkest'],0), R('hard','Hard edge',.6,0,1) ],
  fs:`vec3 streak(sampler2D tex, vec2 uv, vec2 dir, float len){
  vec3 best = texture(tex, uv).rgb; float bl = luma(best);
  float sgn = p_sort < .5 ? 1. : -1.;
  for (int i = 1; i < 14; i++){
    vec3 c = texture(tex, clamp(uv - dir * len * float(i) / 13., 0., 1.)).rgb;
    float l = luma(c) * sgn;
    if (l > bl * sgn){ best = c; bl = luma(c); }
  }
  return best;
}
vec4 fx(vec2 uv){
  int m = int(p_dir + .5);
  vec2 dir = m == 0 ? vec2(0., -1.) : m == 1 ? vec2(1., 0.) : m == 2 ? vec2(0., 1.) : vec2(-1., 0.);
  float coord = m == 0 ? 1. - uv.y : m == 1 ? uv.x : m == 2 ? uv.y : 1. - uv.x;
  float across = (m == 0 || m == 2) ? uv.x * uRes.x : uv.y * uRes.y;
  float w = p_band;
  float f = mix(-w * .5, 1. + w * .5, uProgress);
  float t = (coord - f) / w * 2.;
  float col1 = hash12(vec2(floor(across / max(p_cols * uPx, 1.)), 4.));
  float col2 = hash12(vec2(floor(across / max(p_cols * uPx, 1.)), 17.));
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  if (t >= 1.) return vec4(a, 1.);
  if (t <= -1.) return vec4(b, 1.);
  float len = p_streak * (1. - abs(t) * .55) * (.35 + .65 * col2) * .5;
  float toB = t + (col1 - .5) * (1. - p_hard) * 2.4;
  vec3 sa = streak(uA, uv, dir, len), sb = streak(uB, uv, dir, len);
  float k = smoothstep(.02 * (1. - p_hard), .02 + .3 * (1. - p_hard), -toB + .0);
  k = mix(k, step(0., -toB), p_hard);
  return vec4(mix(sa, sb, k), 1.);
}` });

FX.register({ id:'tr-starwipe', name:'Shape burst', cat:'transition', search:['iris', 'star', 'hexagon', 'triangle', 'cross', 'flower', 'reveal'],
  desc:'B opens through a star, hexagon, triangle, cross or flower that grows from any point and can turn as it goes.',
  params:[ S('shape','Shape',['Star','Hexagon','Triangle','Cross','Flower'],0), I('points','Points',5,3,12), R('spin','Turn',72,-360,360,1), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1), R('soft','Softness',.01,0,.3), R('line','Edge line',0,0,.05), C('color','Line colour','#ffffff','accent'), T('inv','Close instead') ],
  fs:`float sdStar(vec2 p, float r, float n, float m){
  float an = PI / n, en = PI / m;
  vec2 acs = vec2(cos(an), sin(an)), ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2. * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0., r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}
float shapeD(vec2 p, int s){
  if (s == 0) return sdStar(p, 1., max(p_points, 3.), 2.6 + p_points * .12);
  if (s == 1) return sdStar(p, 1., 6., 2.);
  if (s == 2) return sdStar(p, 1., 3., 2.);
  if (s == 3){ vec2 q = abs(p); return min(max(q.x - .3, q.y - 1.), max(q.x - 1., q.y - .3)); }
  float a = atan(p.y, p.x);
  return length(p) - (.72 + .28 * cos(a * max(p_points, 3.)));
}
vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 o = vec2(p_x * ar * .5, p_y * .5);
  vec2 c = centered(uv) - o;
  vec2 e = vec2(ar * .5, .5) + abs(o);
  float maxR = length(e) * 2.1;
  float pp = p_inv > .5 ? 1. - uProgress : uProgress;
  float sf = max(p_soft, 1e-3);
  float rad = mix(1e-3, maxR, pp * pp * (3. - 2. * pp) * .0 + pp);
  c = rot(radians(p_spin) * pp) * c;
  float d = shapeD(c / rad, int(p_shape + .5)) * rad;
  float inside = 1. - smoothstep(-sf, sf, d);
  if (pp <= 0.) inside = 0.;
  if (pp >= 1.) inside = 1.;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec3 col = p_inv > .5 ? mix(b, a, inside) : mix(a, b, inside);
  if (p_inv > .5) col = mix(a, b, 1. - inside);
  if (p_line > 0. && pp > 0. && pp < 1.) col = mix(col, p_color, 1. - smoothstep(p_line, p_line + 1.5 / uRes.y, abs(d)));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-depthslide', name:'Depth slide', cat:'transition', search:['parallax', 'push', 'slide', '3d', 'layers'],
  desc:'B slides in over A, with brighter parts of each image travelling further than darker ones so the frame seems to have depth.',
  params:[ S('dir','Direction',['Left','Right','Up','Down'],0), S('mode','Mode',['Push','Cover'],0), R('depth','Depth',.35,0,1.5), R('shadow','Edge shadow',.5,0,1), R('blur','Motion blur',.3,0,1) ],
  fs:`vec3 layer(sampler2D tex, vec2 uv, vec2 off){
  float l = luma(texture(tex, mirrorUv(uv + off)).rgb);
  float k = 1. + p_depth * (l - .5) * 1.4;
  return texture(tex, mirrorUv(uv + off * k)).rgb;
}
vec3 frame(vec2 uv, float p){
  int d = int(p_dir + .5);
  vec2 dir = d == 0 ? vec2(-1., 0.) : d == 1 ? vec2(1., 0.) : d == 2 ? vec2(0., 1.) : vec2(0., -1.);
  float along = d == 0 ? uv.x : d == 1 ? 1. - uv.x : d == 2 ? 1. - uv.y : uv.y;
  float edge = 1. - p;
  bool cover = p_mode > .5;
  vec3 b = layer(uB, uv, dir * -(1. - p) * -1. * 1.);
  vec3 a = layer(uA, uv, cover ? vec2(0.) : dir * p * -1.);
  vec3 col = along > edge ? b : a;
  float sh = cover ? exp(-(along - edge) * 14.) : exp(-abs(along - edge) * 14.);
  col *= 1. - p_shadow * .5 * sh * step(0., edge - along + .0001) * (cover ? 0. : 1.);
  if (cover && along <= edge) col *= 1. - p_shadow * .55 * exp(-(edge - along) * 12.);
  return col;
}
vec4 fx(vec2 uv){
  float spread = p_blur * sin(uProgress * PI) * .05;
  vec3 acc = vec3(0.);
  for (int i = 0; i < 8; i++){ float k = float(i) / 7. - .5; acc += frame(uv, clamp(uProgress + k * spread, 0., 1.)); }
  return vec4(acc / 8., 1.);
}` });

FX.register({ id:'tr-relay', name:'Channel relay', cat:'transition', search:['rgb split', 'chromatic', 'colour split', 'aberration', 'swap'],
  desc:'Red, green and blue each hand over from A to B at a slightly different moment, fringing the frame in colour on the way.',
  params:[ S('style','Style',['Fade','Wipe','Slide'],1), R('sep','Stagger',.2,0,1), R('angle','Angle',0,-180,180,1), R('shift','Fringe',.6,0,2), R('soft','Softness',.08,0,.5) ],
  fs:`vec4 fx(vec2 uv){
  vec2 dir = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 c = centered(uv);
  float ext = abs(dir.x) * aspect() * .5 + abs(dir.y) * .5;
  float pos = dot(c, dir) / ext * .5 + .5;
  int st = int(p_style + .5);
  vec3 out3;
  float s = max(p_soft, 1e-3);
  float fringe = sin(uProgress * PI) * p_shift * .03;
  for (int i = 0; i < 3; i++){
    float k = float(i) - 1.;
    float pc = clamp(uProgress * (1. + p_sep) + k * .5 * p_sep * (uProgress * 2. - 1.) * 0. - (float(i) * .5 * p_sep), 0., 1.);
    pc = clamp((uProgress - float(i) * .5 * p_sep * .5) / (1. - p_sep * .5), 0., 1.);
    vec2 o = dir * fringe * k / vec2(aspect(), 1.);
    float a = texture(uA, uv + o).r, b = texture(uB, uv + o).r;
    if (i == 1){ a = texture(uA, uv + o).g; b = texture(uB, uv + o).g; }
    if (i == 2){ a = texture(uA, uv + o).b; b = texture(uB, uv + o).b; }
    float m;
    if (st == 0) m = smoothstep(0., 1., pc);
    else if (st == 1) m = 1. - smoothstep(mix(-s, 1. + s, pc) - s, mix(-s, 1. + s, pc) + s, pos);
    else {
      vec2 sh = -dir * (1. - pc) * .5 / vec2(aspect(), 1.);
      float bb = i == 0 ? texture(uB, uv + sh + o).r : i == 1 ? texture(uB, uv + sh + o).g : texture(uB, uv + sh + o).b;
      float inside = 1. - smoothstep(mix(-s, 1. + s, pc) - .002, mix(-s, 1. + s, pc) + .002, pos);
      out3[i] = mix(a, bb, inside);
      continue;
    }
    out3[i] = mix(a, b, m);
  }
  return vec4(out3, 1.);
}` });

FX.register({ id:'tr-tear', name:'Paper tear', cat:'transition', search:['torn', 'rip', 'paper', 'edge', 'reveal'],
  desc:'A has been torn away along a ragged edge, leaving a white paper rim and a soft shadow on B.',
  params:[ R('angle','Angle',90,-180,180,1), R('rough','Roughness',.6,0,1.5), R('scale','Tear scale',5,1,20), R('rim','Paper rim (px)',14,0,60,1), R('shadow','Shadow',.6,0,1), R('fibre','Fibres',.6,0,1), C('paper','Paper','#f2efe6','ink') ],
  fs:`float tearOff(float along){
  return ((fbm(vec2(along * p_scale, 3.1)) - .5) * .32 + (fbm(vec2(along * p_scale * 7., 7.7)) - .5) * .06 + (vnoise(vec2(along * 90., 1.)) - .5) * .008) * p_rough;
}
vec4 fx(vec2 uv){
  vec2 dir = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 c = centered(uv);
  float ext = abs(dir.x) * aspect() * .5 + abs(dir.y) * .5;
  float d = dot(c, dir);
  float along = dot(c, vec2(-dir.y, dir.x));
  float jag = tearOff(along);
  float edge = mix(-ext - .2, ext + .2, 1. - uProgress);
  float e = (d - edge - jag) ;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float px = uPx / uRes.y;
  float rimW = p_rim * px;
  vec3 col = b;
  float shade = exp(-max(-e, 0.) / (.03 + .03 * p_shadow)) * p_shadow * .6;
  if (e > 0.) shade = 0.;
  col *= 1. - shade * step(e, 0.);
  if (e > 0.){
    float fib = hash12(floor(vec2(along * uRes.y / max(uPx, 1.) * .9, e * uRes.y / max(uPx, 1.) * .3)));
    float rimEdge = rimW * (.6 + .8 * fbm(vec2(along * 40., 2.)) ) * (1. + p_fibre * (fib - .5));
    if (e < rimEdge){
      float sh = smoothstep(0., rimEdge, e);
      col = p_paper * (.9 + .1 * fib * p_fibre) * (1. - .12 * sh);
    } else col = a;
  }
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-burn', name:'Film burn', cat:'transition', search:['flash', 'light leak', 'overexposed', 'fire', 'gate', 'flare'],
  desc:'A burn eats through A with a white-hot edge that cools through orange to char, and a flash of overexposure as B arrives.',
  params:[ R('angle','Direction',60,-180,180,1), R('scale','Grain of the burn',2.4,.6,8), R('width','Heat width',.22,.04,.6), R('flash','Flash',.6,0,1.5), R('jitter','Gate jitter',.35,0,1), C('hot','Core','#fff4d6','ink'), C('flame','Flame','#ff7a2a','accent'), C('char','Char','#2a0a05','ground') ],
  fs:`vec4 fx(vec2 uv){
  float seed = floor(uProgress * 36.);
  vec2 jit = (hash22(vec2(seed, 2.)) - .5) * p_jitter * .008 * sin(uProgress * PI);
  vec2 u = uv + jit;
  vec2 dir = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 c = centered(u);
  float ext = abs(dir.x) * aspect() * .5 + abs(dir.y) * .5;
  float g = dot(c, dir) / ext * .5 + .5;
  float n = fbm(c * p_scale + 3.7) * .75 + fbm(c * p_scale * 3.) * .25;
  float field = g * .55 + n * .6;
  float front = mix(-p_width - .1, 1.15 + p_width, uProgress);
  float d = field - front;
  vec3 a = texture(uA, u).rgb, b = texture(uB, u).rgb;
  vec3 col;
  float w = p_width;
  if (d < -w) col = b;
  else if (d > w * .6) col = a * (1. - .5 * exp(-(d - w * .6) * 10.));
  else {
    float t = clamp((d + w) / (w * 1.6), 0., 1.);
    vec3 heat = t < .33 ? mix(p_hot, p_flame, t / .33) : mix(p_flame, p_char, (t - .33) / .67);
    float alpha = smoothstep(.0, .12, t) * (1. - smoothstep(.85, 1., t));
    vec3 under = t < .5 ? b : a;
    col = mix(under, heat, clamp(alpha + (t < .12 ? 1. : 0.), 0., 1.));
    col += p_hot * exp(-abs(t - .12) * 14.) * .5;
  }
  float fl = pow(sin(uProgress * PI), 6.) * p_flash;
  float flick = .85 + .15 * hash12(vec2(seed, 9.));
  col = col * (1. + fl * flick * .6) + mix(p_flame, p_hot, .5) * fl * .55;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-cube', name:'Cube turn', cat:'transition', search:['3d', 'rotate', 'box', 'spin', 'flip'],
  desc:'The frame becomes one face of a cube that turns to show B on the next face, in perspective.',
  params:[ S('dir','Turns towards',['Left','Right','Up','Down'],0), R('persp','Perspective',3,1.4,8), R('shade','Face shading',.55,0,1), R('gap','Edge line',.0,0,.03), C('bg','Behind','#0e0f10','ground') ],
  fs:`vec4 fx(vec2 uv){
  int dm = int(p_dir + .5);
  bool vert = dm >= 2;
  float sgn = (dm == 0 || dm == 2) ? 1. : -1.;
  float ho = vert ? uRes.x / uRes.y : uRes.y / uRes.x;
  vec2 ndc = (uv - .5) * 2.;
  vec2 r = vert ? vec2(ndc.y, ndc.x) : ndc;
  float Zf = p_persp;
  float cz = Zf + 1.;
  float th = uProgress * PI * .5 * sgn;
  float cs = cos(th), sn = sin(th);
  vec3 o = vec3(0., 0., -cz), d = vec3(r.x, r.y * ho, Zf);
  /* rotate the ray into the cube's own frame */
  vec3 ol = vec3(cs * o.x - sn * o.z, o.y, sn * o.x + cs * o.z);
  vec3 dl = vec3(cs * d.x - sn * d.z, d.y, sn * d.x + cs * d.z);
  float best = 1e9; vec3 col = p_bg; float face = -1.; vec2 fuv = vec2(0.);
  if (dl.z > 1e-5){
    float s = (-1. - ol.z) / dl.z; vec3 P = ol + s * dl;
    if (s > 0. && abs(P.x) <= 1. && abs(P.y) <= ho){ best = s; face = 0.; fuv = vec2(P.x * .5 + .5, P.y / ho * .5 + .5); }
  }
  if (abs(dl.x) > 1e-5 && dl.x * sgn < 0.){
    float s = (sgn - ol.x) / dl.x; vec3 P = ol + s * dl;
    if (s > 0. && s < best && abs(P.z) <= 1. && abs(P.y) <= ho){ best = s; face = 1.; fuv = vec2(P.z * sgn * .5 + .5, P.y / ho * .5 + .5); }
  }
  if (face < 0.) return vec4(p_bg, 1.);
  vec2 su = vert ? vec2(fuv.y, fuv.x) : fuv;
  vec3 tex = face < .5 ? texture(uA, su).rgb : texture(uB, su).rgb;
  float lit = face < .5 ? 1. - p_shade * .5 * abs(sin(th)) : 1. - p_shade * .5 * abs(cos(th));
  col = tex * lit;
  if (p_gap > 0.){
    float ed = min(min(fuv.x, 1. - fuv.x), .5);
    col = mix(col, p_bg, 1. - smoothstep(p_gap, p_gap + .004, ed));
  }
  return vec4(col, 1.);
}` });

/* ================= Mix & mask ================= */

FX.register({ id:'mx-diff', name:'Difference map', cat:'mix', search:['combine', 'compare', 'subtract', 'exclusion', 'delta', 'change'],
  desc:'Shows where A and B disagree: as a palette-mapped heat map, as raw colour difference, or as an exclusion blend.',
  params:[ S('style','Style',['Palette map','Raw difference','Exclusion'],0), R('gain','Gain',2.2,.4,8), R('under','Keep A beneath',.0,0,1), C('c1','Same','#141516','ground'), C('c2','Some','#ff5a36','accent'), C('c3','Most','#f2efe6','ink') ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  int s = int(p_style + .5);
  vec3 col;
  if (s == 0){
    float d = clamp(length(abs(a - b)) / 1.732 * p_gain, 0., 1.);
    col = d < .5 ? mix(p_c1, p_c2, smoothstep(0., .5, d)) : mix(p_c2, p_c3, smoothstep(.5, 1., d));
  } else if (s == 1) col = clamp(abs(a - b) * p_gain, 0., 1.);
  else col = clamp(mix(a, a + b - 2. * a * b, min(p_gain * .5, 1.)), 0., 1.);
  return vec4(mix(col, mix(a, col, .6), p_under), 1.);
}` });

FX.register({ id:'mx-split', name:'Split screen', cat:'mix', search:['combine', 'panels', 'checker', 'divide', 'bands', 'compare'],
  desc:'A and B share the frame as bands, a checkerboard, rings or a circle cut through a split, with an optional gap line. The split can slide over the loop.',
  params:[ S('layout','Layout',['Bands','Checker','Rings','Circle in half'],0), I('count','Divisions',2,1,16), R('angle','Angle',0,-90,90,1), R('slide','Slide',0,0,1), R('gap','Gap (px)',0,0,24,.5), C('gapc','Gap colour','#141516','ground'), T('swap','Swap') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  int l = int(p_layout + .5);
  float sl = p_slide * .25 * sin(uLoop * TAU);
  vec2 q = rot(radians(p_angle)) * c;
  float n = max(p_count, 1.);
  float v, edge;
  if (l == 0){
    float x = (q.x / aspect() + .5 + sl) * n;
    v = mod(floor(x), 2.); edge = min(fract(x), 1. - fract(x)) / n * aspect();
  } else if (l == 1){
    vec2 g = vec2(q.x / aspect() + .5 + sl, q.y + .5) * n;
    v = mod(floor(g.x) + floor(g.y), 2.);
    vec2 f = min(fract(g), 1. - fract(g)) / n;
    edge = min(f.x * aspect(), f.y);
  } else if (l == 2){
    float x = (length(c) * 1.6 + sl * 2.) * n;
    v = mod(floor(x), 2.); edge = min(fract(x), 1. - fract(x)) / n / 1.6;
  } else {
    float x = q.x + sl * aspect();
    float inC = step(length(c), .3 + n * .02);
    v = mod(step(0., x) + inC, 2.);
    edge = min(abs(x), abs(length(c) - (.3 + n * .02)));
    edge = inC > .5 ? min(abs(x), abs(length(c) - (.3 + n * .02))) : abs(x);
  }
  if (p_swap > .5) v = 1. - v;
  vec3 col = v > .5 ? texture(uB, uv).rgb : texture(uA, uv).rgb;
  float gw = p_gap * .5 * uPx / uRes.y;
  if (p_gap > 0.) col = mix(p_gapc, col, smoothstep(gw, gw + uPx / uRes.y, edge));
  return vec4(col, 1.);
}` });

FX.register({ id:'mx-spotlight', name:'Searchlight', cat:'mix', search:['combine', 'spot', 'reveal', 'vignette', 'torch', 'lamp', 'window'],
  desc:'B shows only inside one or more soft lights that wander across A, which falls into shadow around them. Loops seamlessly.',
  params:[ I('lights','Lights',1,1,4), R('size','Size',.28,.05,.8), R('soft','Softness',.35,.02,1), R('travel','Travel',.6,0,1.2), R('dim','Shadow',.75,0,1), R('halo','Halo',.35,0,1), C('halo_c','Halo colour','#ffd9a8','accent'), T('swap','B in shadow instead') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float ph = uLoop * TAU;
  float m = 0., ring = 0.;
  for (int i = 0; i < 4; i++){
    if (i >= int(p_lights)) break;
    float fi = float(i);
    vec2 ctr = vec2(cos(ph + fi * 1.9) * aspect() * .35, sin(ph * 2. + fi * 1.1) * .32) * p_travel + vec2(0., 0.);
    float d = length(c - ctr);
    m = max(m, 1. - smoothstep(p_size * (1. - p_soft), p_size * (1. + p_soft * .5), d));
    ring = max(ring, exp(-pow((d - p_size) / (.05 + p_size * .2 * p_soft), 2.)));
  }
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec3 inside = p_swap > .5 ? a : b;
  vec3 outside = (p_swap > .5 ? b : a) * (1. - p_dim);
  vec3 col = mix(outside, inside, m);
  col += p_halo_c * ring * p_halo * .35 * (1. - m * .5);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'mx-contour', name:'Contour mix', cat:'mix', search:['combine', 'edges', 'outline', 'line', 'trace'],
  desc:'The edges found in A are drawn in B, over A itself or a flat colour.',
  params:[ R('width','Line width (px)',3,.5,14,.5), R('thresh','Sensitivity',.85,0,1), R('soft','Softness',.25,0,1), R('dim','Darken A',.55,0,1), S('under','Beneath',['Image A','Colour'],0), C('color','Colour','#141516','ground') ],
  fs:`float lum(vec2 u){ return luma(texture(uA, clamp(u, 0., 1.)).rgb); }
vec4 fx(vec2 uv){
  vec2 e = vec2(p_width * uPx) / uRes;
  float tl = lum(uv + vec2(-e.x, e.y)), t = lum(uv + vec2(0., e.y)), tr = lum(uv + e);
  float l = lum(uv - vec2(e.x, 0.)), r = lum(uv + vec2(e.x, 0.));
  float bl = lum(uv - e), bt = lum(uv - vec2(0., e.y)), br = lum(uv + vec2(e.x, -e.y));
  float gx = (tr + 2. * r + br) - (tl + 2. * l + bl), gy = (tl + 2. * t + tr) - (bl + 2. * bt + br);
  float g = length(vec2(gx, gy)) * .5;
  float thr = (1. - p_thresh) * .5 + .02;
  float m = smoothstep(thr, thr + .02 + p_soft * .3, g);
  vec3 a = texture(uA, uv).rgb;
  vec3 base = p_under < .5 ? a * (1. - p_dim) : p_color;
  return vec4(mix(base, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'mx-hue', name:'Hue mask', cat:'mix', search:['combine', 'colour range', 'selective', 'key', 'swap'],
  desc:'B replaces the parts of A that fall in a range of hue, or everything outside it.',
  params:[ R('hue','Hue',30,0,360,1), R('range','Range',45,5,180,1), R('sat','Minimum colour',.2,0,1), R('soft','Softness',.3,0,1), T('outside','Outside the range instead'), R('keep','Keep A detail',.25,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec3 h = rgb2hsv(a);
  float dh = abs(fract(h.x - p_hue / 360. + .5) - .5) * 360.;
  float s = max(p_range * p_soft, .5);
  float inR = 1. - smoothstep(p_range - s, p_range + s, dh);
  inR *= smoothstep(p_sat - .08, p_sat + .08, h.y) * smoothstep(.04, .12, h.z);
  float m = p_outside > .5 ? 1. - inR : inR;
  vec3 bb = mix(b, b * (.6 + .8 * luma(a)), p_keep);
  return vec4(mix(a, bb, m), 1.);
}` });

/* ================= Overlays ================= */

FX.register({ id:'ovl-filmstrip', name:'Film strip', cat:'overlay', search:['sprocket', 'negative', 'cinema', '35mm', 'contact sheet', 'frame'],
  desc:'Sprocket holes down the edges and dark bars between frames, so the picture reads as cut lengths of film. Can scroll a whole number of frames per loop.',
  params:[ S('axis','Strips',['Left & right','Top & bottom'],0), R('width','Strip width',.075,.03,.16), I('holes','Holes per frame',4,2,8), I('frames','Frames',3,1,8), R('gap','Frame gap (px)',10,0,60,1), I('scroll','Scroll (frames per loop)',0,0,4), R('opacity','Opacity',1,0,1), C('base','Film','#0e0f10','ground'), C('hole','Holes','#e4e2dc','ink') ],
  fs:`vec4 fx(vec2 uv){
  vec3 col = texture(uInput, uv).rgb;
  bool vert = p_axis < .5;
  vec2 px = uv * uRes;
  float along = vert ? px.y : px.x, across = vert ? px.x : px.y;
  float alongLen = vert ? uRes.y : uRes.x, acrossLen = vert ? uRes.x : uRes.y;
  float sw = p_width * acrossLen;
  float frameL = alongLen / p_frames;
  float s = along + p_scroll * uLoop * frameL;
  float pitch = frameL / p_holes;
  float inStrip = min(across, acrossLen - across);
  float band = 1. - smoothstep(sw - uPx, sw, inStrip);
  band = inStrip < sw ? 1. : 0.;
  vec2 hp = vec2(inStrip - sw * .5, mod(s, pitch) - pitch * .5);
  float hd = sdRoundBox(hp, vec2(sw * .2, min(pitch * .27, sw * .3)), sw * .07);
  float hole = 1. - smoothstep(-uPx * .5, uPx * .5, hd);
  vec3 strip = mix(p_base, p_hole, hole);
  float gapPx = p_gap;
  float fd = abs(mod(s, frameL) - .0);
  fd = min(mod(s, frameL), frameL - mod(s, frameL));
  float bar = (1. - smoothstep(gapPx * .5 - uPx * .5, gapPx * .5 + uPx * .5, fd)) * step(.5, p_gap);
  vec3 out3 = mix(col, p_base, bar * p_opacity);
  float edge = smoothstep(sw - uPx * 1.5, sw, inStrip) * step(inStrip, sw);
  out3 = mix(out3, strip, band * p_opacity);
  out3 = mix(out3, mix(out3, p_hole, .35), (1. - smoothstep(0., uPx * 1.2, abs(inStrip - sw * .96))) * band * p_opacity * .6);
  return vec4(out3, 1.);
}` });

FX.register({ id:'ovl-viewfinder', name:'Viewfinder', cat:'overlay', search:['camera', 'focus', 'crosshair', 'hud', 'autofocus', 'level', 'frame lines'],
  desc:'Frame corners, a focus box that hunts across the picture, a centre cross and a level line. Shapes only, no text. Loops seamlessly.',
  params:[ R('corner','Frame corners',.05,0,.15), R('margin','Margin',.045,.01,.15), R('focus','Focus box',.09,0,.3), R('hunt','Focus hunt',.25,0,1), R('level','Level line',.5,0,1), T('thirds','Thirds ticks',true), R('weight','Line weight (px)',2,.5,8,.5), R('opacity','Opacity',.85,0,1), C('color','Colour','#f2efe6','ink'), C('lock','Focus colour','#ff5a36','accent') ],
  fs:`float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
vec4 fx(vec2 uv){
  vec3 col = texture(uInput, uv).rgb;
  vec2 W = uRes; float m = min(W.x, W.y);
  vec2 p = (uv - .5) * W;
  float ph = uLoop * TAU;
  float hw = max(p_weight * .5, uPx * .5);
  float d = 1e5, dl = 1e5;
  /* frame corners */
  vec2 h = W * .5 - m * p_margin;
  float L = m * p_corner;
  vec2 q = abs(p);
  vec2 s = vec2(1.);
  d = min(d, seg(q, h, h - vec2(L, 0.)));
  d = min(d, seg(q, h, h - vec2(0., L)));
  /* thirds ticks along the frame */
  if (p_thirds > .5){
    float t = m * .012;
    for (int i = 0; i < 2; i++){
      float fx_ = (float(i) - .5) * W.x / 3. + (float(i) - .5) * 0.;
      float tx = (i == 0 ? -1. : 1.) * W.x / 6.;
      d = min(d, seg(p, vec2(tx * 2., h.y), vec2(tx * 2., h.y - t * 2.)));
      d = min(d, seg(p, vec2(tx * 2., -h.y), vec2(tx * 2., -h.y + t * 2.)));
    }
    for (int i = 0; i < 2; i++){
      float ty = (i == 0 ? -1. : 1.) * W.y / 6.;
      d = min(d, seg(p, vec2(h.x, ty * 2.), vec2(h.x - m * .024, ty * 2.)));
      d = min(d, seg(p, vec2(-h.x, ty * 2.), vec2(-h.x + m * .024, ty * 2.)));
    }
  }
  /* centre cross */
  d = min(d, seg(p, vec2(-m * .014, 0.), vec2(m * .014, 0.)));
  d = min(d, seg(p, vec2(0., -m * .014), vec2(0., m * .014)));
  /* level line: two arms and a centre notch, tilting a little */
  if (p_level > .01){
    float tilt = sin(ph) * .05 * p_level;
    vec2 dir = vec2(cos(tilt), sin(tilt));
    vec2 nrm = vec2(-dir.y, dir.x);
    d = min(d, seg(p, dir * m * .16, dir * m * .3));
    d = min(d, seg(p, -dir * m * .16, -dir * m * .3));
    d = min(d, seg(p, dir * m * .3, dir * m * .3 + nrm * m * .012));
    d = min(d, seg(p, -dir * m * .3, -dir * m * .3 + nrm * m * .012));
  }
  /* focus box, hunting, then locking on the loop's start */
  vec2 fc = vec2(cos(ph), sin(ph * 2.)) * vec2(W.x * .16, W.y * .1) * p_hunt;
  float breathe = 1. + .14 * sin(ph * 3.) * p_hunt;
  float fs = m * p_focus * breathe;
  vec2 f = abs(p - fc);
  float arm = fs * .38;
  float df = min(seg(f, vec2(fs, fs), vec2(fs - arm, fs)), seg(f, vec2(fs, fs), vec2(fs, fs - arm)));
  float a1 = 1. - smoothstep(hw, hw + uPx, d);
  float a2 = (1. - smoothstep(hw, hw + uPx, df)) * step(.5, p_focus * 100.);
  col = mix(col, p_color, a1 * p_opacity);
  col = mix(col, p_lock, a2 * p_opacity);
  return vec4(col, 1.);
}` });

FX.register({ id:'ovl-tape', name:'Masking tape', cat:'overlay', search:['sticky', 'washi', 'label', 'scrapbook', 'pinned', 'collage'],
  desc:'Torn-ended strips of translucent tape holding the frame down at the corners, along the top or across it.',
  params:[ S('layout','Layout',['Corners','Top strip','Cross','Sides'],0), R('width','Tape width',.05,.02,.12), R('length','Length',.2,.08,.45), R('angle','Angle',38,0,90,1), R('opacity','Opacity',.82,.2,1), R('shadow','Shadow',.5,0,1), R('wear','Torn ends',.5,0,1), C('tape','Tape','#e8dcb0','accent') ],
  fs:`float tapeD(vec2 p, vec2 ctr, float ang, float hl, float hw){
  vec2 q = rot(-ang) * (p - ctr);
  float zig = (abs(fract(q.y / hw * 1.7 + .3) - .5) * 2. - .5) * hw * .3 * p_wear;
  float dx = abs(q.x) - (hl + zig);
  float dy = abs(q.y) - hw;
  return max(dx, dy);
}
float tapeSet(vec2 p, float m, vec2 half_){
  float hl = p_length * m * .5, hw = p_width * m * .5;
  float a = radians(p_angle);
  int l = int(p_layout + .5);
  float d = 1e5;
  if (l == 0){
    d = min(d, tapeD(p, vec2(-half_.x, half_.y), a, hl, hw));
    d = min(d, tapeD(p, vec2(half_.x, half_.y), -a, hl, hw));
    d = min(d, tapeD(p, vec2(-half_.x, -half_.y), -a, hl, hw));
    d = min(d, tapeD(p, vec2(half_.x, -half_.y), a, hl, hw));
  } else if (l == 1) d = tapeD(p, vec2(0., half_.y), radians(p_angle * .08 - 1.), hl * 1.5, hw);
  else if (l == 2){
    d = min(d, tapeD(p, vec2(0.), a, hl * 3., hw));
    d = min(d, tapeD(p, vec2(0.), -a, hl * 3., hw));
  } else {
    d = min(d, tapeD(p, vec2(-half_.x, 0.), radians(90. + p_angle * .1), hl * 1.6, hw));
    d = min(d, tapeD(p, vec2(half_.x, 0.), radians(90. - p_angle * .1), hl * 1.6, hw));
  }
  return d;
}
vec4 fx(vec2 uv){
  vec3 col = texture(uInput, uv).rgb;
  vec2 W = uRes; float m = min(W.x, W.y);
  vec2 p = (uv - .5) * W;
  vec2 half_ = W * .5 * .97;
  float d = tapeSet(p, m, half_);
  float ds = tapeSet(p - vec2(m * .004, -m * .008) * 1., m, half_);
  float body = 1. - smoothstep(-uPx * .5, uPx * .5, d);
  float sh = (1. - smoothstep(0., m * .012, ds)) * (1. - body) * p_shadow * .35;
  col *= 1. - sh;
  vec2 g = uv * uRes / max(uPx, 1.);
  float fibre = vnoise(vec2(g.x * .08, g.y * .9)) * .5 + vnoise(g * .5) * .5;
  vec3 tape = p_tape * (.9 + .16 * fibre);
  tape = mix(tape, col * 1.05 + p_tape * .25, .4);
  float rim = 1. - smoothstep(0., m * .004, -d);
  tape += rim * .06;
  col = mix(col, tape, body * p_opacity);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'ovl-creases', name:'Paper folds', cat:'overlay', search:['crease', 'fold', 'paper', 'map', 'poster', 'worn', 'texture'],
  desc:'The frame as a sheet that has been folded into panels: each panel catches the light a little differently, with worn creases and paper grain.',
  params:[ I('cols','Columns',2,1,6), I('rows','Rows',3,1,8), R('shade','Panel shading',.35,0,1), R('crease','Crease',.6,0,1), R('wear','Wear',.5,0,1), R('grain','Paper grain',.25,0,1), C('light','Light','#ffffff','ink'), C('dark','Shadow','#1a1b1d','ground') ],
  fs:`vec4 fx(vec2 uv){
  vec3 col = texture(uInput, uv).rgb;
  vec2 grid = vec2(p_cols, p_rows);
  vec2 g = uv * grid;
  vec2 id = floor(g), f = fract(g);
  float tilt = (hash12(id + 3.) - .5);
  float lamp = tilt + (f.x - .5) * (hash12(id + 9.) - .5) * .6 + (f.y - .5) * (hash12(id + 21.) - .5) * .6;
  vec3 shaded = lamp > 0. ? mix(col, p_light, lamp * p_shade * .5) : mix(col, p_dark, -lamp * p_shade * .7);
  col = mix(col, shaded, 1.);
  vec2 px = uv * uRes;
  vec2 dpx = min(f, 1. - f) * (uRes / grid);
  float dist = min(dpx.x, dpx.y);
  bool inner = (dpx.x < dpx.y ? (id.x > 0. && f.x < .5) || (id.x < p_cols - 1. && f.x >= .5) : (id.y > 0. && f.y < .5) || (id.y < p_rows - 1. && f.y >= .5));
  if (inner){
    float w = max(uPx, 1.);
    float wearN = smoothstep(.35, .75, fbm(px / max(uPx, 1.) * .03 + 4.) ) ;
    float line = 1. - smoothstep(0., 1.4 * w, dist);
    float soft = 1. - smoothstep(0., 9. * w, dist);
    float side = (dpx.x < dpx.y ? (f.x < .5 ? -1. : 1.) : (f.y < .5 ? -1. : 1.));
    col = mix(col, p_dark, soft * .18 * p_crease * (side > 0. ? 1. : .0));
    col = mix(col, p_light, soft * .12 * p_crease * (side < 0. ? 1. : .0));
    col = mix(col, mix(p_dark, p_light, .5 + .5 * wearN * p_wear), line * p_crease * (.35 + .4 * wearN * p_wear));
  }
  float gr = fbm(px / max(uPx, 1.) * .5) * .6 + hash12(floor(px / max(uPx, 1.))) * .4;
  col = mix(col, col * (.82 + .3 * gr), p_grain);
  return vec4(clamp(col, 0., 1.), 1.);
}` });
