/* ---------------- Library, fourth pass ----------------
   Treatments and effects that art direction asks for by name: grades,
   film and print processes, drawn and painted looks, display and
   compression artefacts, lens and warp effects. Sizes are written for a
   1080x1350 frame and scale with the output height. */

const L4 = {
  /* soft disc blur, radius as a fraction of frame height (24 golden-angle taps) */
  blur:`
vec3 l4blur(vec2 uv, float r){
  vec3 a = vec3(0.);
  for (int i = 0; i < 24; i++){
    float fi = float(i);
    float rr = sqrt((fi + .5) / 24.) * r;
    float an = fi * 2.39996;
    a += texture(uInput, uv + vec2(cos(an) / aspect(), sin(an)) * rr).rgb;
  }
  return a / 24.;
}`,
  /* noise that changes over the loop but closes on itself: two hashed frames
     cross-faded with equal-energy weights, so the last frame leads into the first */
  noiseT:`
float l4noiseT(vec2 p, float frames){
  float k = uLoop * frames;
  float a = floor(k);
  float f = fract(k) * PI * .5;
  float b = mod(a + 1., frames);
  return (hash12(p + a * 17.13) - .5) * cos(f) + (hash12(p + b * 17.13) - .5) * sin(f);
}`,
  /* one pixel of the 1350px design height, as a fraction of frame height */
  px:`
const float L4PX = 1. / 1350.;
vec2 l4asp(){ return vec2(1. / aspect(), 1.); }`,
};

/* ================= TREATMENTS ================= */

/* ---- Colour wheels ---- */
FX.register({ id:'trt-grade', name:'Colour wheels', cat:'treatment', search:['grade', 'lift gamma gain', 'teal orange', 'vibrance', 'colour grade'],
  desc:'Grades the shadows, midtones and highlights with a colour each, the way a colourist works the three wheels.',
  params:[ C('lift','Shadows','#2b7f96','accent2'), C('gamma','Midtones','#948a82',false), C('gain','Highlights','#ffb070','accent'), R('strength','Strength',.55,0,1.5), R('contrast','Contrast',1.08,.5,1.8), R('saturation','Saturation',1,0,2), R('vibrance','Vibrance',.35,0,1.5) ],
  fs:`vec3 l4chroma(vec3 c){ return c - luma(c); }
vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  float k = p_strength;
  float l = luma(c);
  c += l4chroma(p_lift) * k * .8 * (1. - l) * (1. - l);
  c = pow(max(c, 0.), vec3(1.) - l4chroma(p_gamma) * k * 1.1);
  c *= vec3(1.) + l4chroma(p_gain) * k * 1.1;
  c = (c - .5) * p_contrast + .5;
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float ll = luma(c);
  c = mix(vec3(ll), c, p_saturation * (1. + p_vibrance * (1. - clamp(sat, 0., 1.))));
  return vec4(clamp(c, 0., 1.), 1.);
}` });

/* ---- Recover detail ---- */
FX.register({ id:'trt-recover', name:'Recover detail', cat:'treatment', nonLocal:true, search:['dehaze', 'shadows highlights', 'clarity', 'local contrast', 'hdr'],
  desc:'Opens up dark areas, pulls back bright ones, cuts haze and adds local contrast, working from how bright each neighbourhood is.',
  params:[ R('shadows','Open shadows',.35,0,1), R('highs','Recover highlights',.4,0,1), R('haze','Cut haze',.2,0,1), R('clarity','Local contrast',.3,0,2), R('reach','Reach',.035,.005,.15) ],
  fs:L4.blur + `
vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  vec3 b = l4blur(uv, p_reach);
  float l = luma(c), lb = luma(b);
  float veil = min(b.r, min(b.g, b.b)) * p_haze;
  c = (c - veil) / (1. - veil);
  c *= exp2(p_shadows * 1.3 * (1. - smoothstep(0., .6, lb)));
  c *= exp2(-p_highs * 1.1 * smoothstep(.4, 1., lb));
  float mid = 1. - pow(abs(luma(c) * 2. - 1.), 2.);
  c *= 1. + clamp(l - lb, -.15, .15) * p_clarity * 2.2 * (.4 + mid);
  c = c / (1. + max(c - .9, 0.) * .8);
  return vec4(clamp(c, 0., 1.), 1.);
}` });

/* ---- Cross-process ---- */
FX.register({ id:'trt-crossprocess', name:'Cross-process', cat:'treatment', search:['lomo', 'film', 'grade', 'toy camera'],
  desc:'Slide film developed in the wrong chemistry: each channel gets its own hard curve, so shadows and highlights split into different colours.',
  params:[ S('cast','Cast',['Green and yellow','Magenta','Teal and orange'],0), R('amount','Amount',.9,0,1), R('contrast','Contrast',.9,0,1.5), R('saturation','Saturation',1.25,0,2), R('vignette','Edge falloff',.4,0,1) ],
  fs:`float l4chan(float x, vec3 q, float con){
  x = pow(clamp(x, 0., 1.), q.x);
  x = mix(x, x * x * (3. - 2. * x), con);
  return q.y + (q.z - q.y) * x;
}
vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  int m = int(p_cast + .5);
  vec3 qr, qg, qb;
  if (m == 0){ qr = vec3(.82, 0., 1.); qg = vec3(.9, 0., 1.); qb = vec3(1.2, .14, .68); }
  else if (m == 1){ qr = vec3(.9, .1, 1.); qg = vec3(1.3, 0., .82); qb = vec3(.82, .1, 1.); }
  else { qr = vec3(.85, 0., 1.); qg = vec3(1.05, .05, .88); qb = vec3(1.25, .12, .8); }
  vec3 o = vec3(l4chan(c.r, qr, p_contrast), l4chan(c.g, qg, p_contrast), l4chan(c.b, qb, p_contrast));
  o = mix(c, o, p_amount);
  o = mix(vec3(luma(o)), o, p_saturation);
  float d = length(centered(uv)) / (length(vec2(aspect(), 1.)) * .5);
  o *= 1. - p_vignette * smoothstep(.45, 1.05, d) * .7;
  return vec4(clamp(o, 0., 1.), 1.);
}` });

/* ---- Expired film ---- */
FX.register({ id:'trt-expired', name:'Expired film', cat:'treatment', search:['polaroid', 'instant', 'faded', 'light leak', 'aged', 'vintage'],
  desc:'Old stock with a colour cast, lifted blacks, uneven fog in patches and a strip of light struck in along one edge.',
  params:[ R('age','Age',.6,0,1), C('cast','Cast','#5fa08a','accent2'), R('fog','Fog patches',.5,0,1), C('fogc','Fog colour','#ff7a3d','accent'), R('strike','Light strike',.55,0,1), S('side','Strike edge',['Left','Right','Top','Bottom','Left and right'],0), R('drift','Dye drift',.4,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec2 g = uv * vec2(aspect(), 1.);
  float ph = uLoop * TAU;
  float shift = p_drift * p_age * .0016;
  vec3 c = vec3(texture(uInput, uv + vec2(shift / aspect(), shift * .5)).r, texture(uInput, uv).g, texture(uInput, uv - vec2(shift / aspect(), shift * .5)).b);
  float l = luma(c);
  c = c * (1. - .32 * p_age) + .1 * p_age;
  vec3 cc = p_cast - luma(p_cast);
  c += cc * p_age * (.9 - l * .6);
  float n = fbm(g * 2.2 + vec2(cos(ph), sin(ph)) * .04 + 3.);
  float f = smoothstep(.42, .78, n) * p_fog;
  c = 1. - (1. - c) * (1. - p_fogc * f * .55);
  float s = p_side < .5 ? uv.x : p_side < 1.5 ? 1. - uv.x : p_side < 2.5 ? 1. - uv.y : p_side < 3.5 ? uv.y : min(uv.x, 1. - uv.x);
  float wob = fbm(vec2(uv.y * 5., uv.x * 5.) + 9.);
  float st = exp(-s / (.05 + .07 * wob)) * (.6 + .8 * wob) * p_strike;
  c = 1. - (1. - c) * (1. - mix(p_fogc, vec3(1., .9, .7), .35) * st);
  return vec4(clamp(c, 0., 1.), 1.);
}` });

/* ---- Overprint ---- */
FX.register({ id:'trt-overprint', name:'Overprint', cat:'treatment', search:['screenprint', 'silkscreen', 'misregistration', 'spot colour', 'separations', 'poster'],
  desc:'Splits the frame into three flat spot-colour plates that overlap where they meet, each one slightly out of register.',
  params:[ C('ink1','Plate 1','#ff4fa3','accent'), C('ink2','Plate 2','#1f7fd6','accent2'), C('ink3','Key plate','#1b1a2e','ink'), C('paper','Paper','#f3eee2','ground'), R('cover','Coverage',0,-.3,.3), R('soft','Edge softness',.04,0,.4), I('bands','Tones per plate',2,1,4), R('reg','Misregistration',.5,0,1.5) ],
  fs:L4.px + `
float l4plate(float d, float bias, float soft, float bands){
  float x = clamp(d + bias, 0., .9999) * bands;
  return (floor(x) + smoothstep(.5 - soft, .5 + soft, fract(x))) / bands;
}
vec4 fx(vec2 uv){
  float s = .012 * p_reg;
  float ph = uLoop * TAU;
  vec2 a = l4asp();
  vec2 o1 = vec2(cos(.4), sin(.4)) * s * (1. + .12 * sin(ph));
  vec2 o2 = vec2(cos(2.6), sin(2.6)) * s * (1. + .12 * sin(ph + 2.));
  vec2 o3 = vec2(cos(4.5), sin(4.5)) * s * .5 * (1. + .12 * sin(ph + 4.));
  vec3 s1 = texture(uInput, uv + o1 * a).rgb;
  vec3 s2 = texture(uInput, uv + o2 * a).rgb;
  vec3 s3 = texture(uInput, uv + o3 * a).rgb;
  float bd = float(int(p_bands + .5));
  float c1 = l4plate(1. - s1.g, p_cover, p_soft, bd);
  float c2 = l4plate(1. - s2.r, p_cover, p_soft, bd);
  float c3 = l4plate(smoothstep(.6, .1, luma(s3)), p_cover, p_soft, 1.);
  vec3 col = p_paper * (.965 + .035 * vnoise(uv * uRes / 3.));
  col *= mix(vec3(1.), p_ink1, c1);
  col *= mix(vec3(1.), p_ink2, c2);
  col *= mix(vec3(1.), p_ink3, c3);
  return vec4(col, 1.);
}` });

/* ---- Sun print ---- */
FX.register({ id:'trt-cyanotype', name:'Sun print', cat:'treatment', search:['cyanotype', 'blueprint', 'chemical', 'photogram', 'alternative process'],
  desc:'A cyanotype: one ink on brushed-on coating, with mottled density and an uneven painted border where the chemistry stops.',
  params:[ R('exposure','Exposure',.1,-1,1), R('contrast','Contrast',1.35,.5,2.5), C('ink','Ink','#1b4f9a','accent2'), C('paper','Paper','#f2efe2',false), R('border','Brushed border',.5,0,1), R('mottle','Mottling',.5,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec2 g = uv * vec2(aspect(), 1.);
  float t = luma(texture(uInput, uv).rgb);
  t = clamp((t - .5) * p_contrast + .5 + p_exposure * .5, 0., 1.);
  float mott = fbm(g * 4. + 2.);
  float streak = vnoise(vec2(g.x * 2.5, g.y * 70.));
  t = clamp(t + (mott - .5) * p_mottle * .35 + (streak - .5) * p_mottle * .14, 0., 1.);
  vec3 deep = p_ink * .42;
  vec3 c = mix(deep, p_ink, smoothstep(0., .45, t));
  c = mix(c, p_paper, smoothstep(.4, 1., t));
  float fibre = vnoise(uv * uRes / 2.) * .06;
  vec2 e = min(uv, 1. - uv) * vec2(aspect(), 1.);
  float edge = min(e.x, e.y) + (fbm(g * 7.) - .5) * p_border * .06;
  float w = p_border * .06;
  float coat = p_border < .01 ? 1. : smoothstep(w * .5, w * .5 + .008, edge);
  float rim = p_border < .01 ? 0. : smoothstep(w * .5, w * .5 + .004, edge) * (1. - smoothstep(w * .5 + .004, w * .5 + .02, edge));
  c = mix(p_paper, c, coat);
  c = mix(c, p_ink * .6, rim * .35);
  c *= 1. - fibre * (1. - coat * .5);
  return vec4(c, 1.);
}` });

/* ---- Cel shade ---- */
FX.register({ id:'trt-cel', name:'Cel shade', cat:'treatment', search:['toon', 'posterise', 'cartoon', 'flat colour', 'ink lines', 'animation'],
  desc:'Flattens the frame into a few steps of light with the colour kept, and draws a dark line where the shapes meet.',
  params:[ I('bands','Steps of light',4,2,8), R('soft','Edge softness',.08,0,.4), R('boost','Colour boost',1.25,.5,2), R('flatten','Flatten',3,0,10,.5), R('line','Line weight',2,0,6,.25), R('sens','Line sensitivity',.22,.05,.6), C('inkc','Line colour','#141516','ink') ],
  fs:L4.px + `
vec4 fx(vec2 uv){
  vec2 a = l4asp();
  float r = max(p_flatten, .5) * L4PX;
  vec3 c = vec3(0.);
  for (int i = 0; i < 12; i++){
    float fi = float(i);
    float rr = sqrt((fi + .5) / 12.) * r;
    float an = fi * 2.39996;
    c += texture(uInput, uv + vec2(cos(an), sin(an)) * rr * a).rgb;
  }
  c /= 12.;
  if (p_flatten < .25) c = texture(uInput, uv).rgb;
  float l = luma(c);
  float n = float(int(p_bands + .5));
  float x = l * n;
  float bl = (floor(x) + smoothstep(.5 - p_soft, .5 + p_soft, fract(x))) / n;
  c *= bl / max(l, .03);
  c = mix(vec3(luma(c)), c, p_boost);
  c = clamp(c, 0., 1.);
  float k = max(max(p_line, .5) * L4PX * 1.4, max(p_flatten * .5, 1.) * L4PX);
  float tl = luma(texture(uInput, uv + vec2(-k, k) * a).rgb), tc = luma(texture(uInput, uv + vec2(0., k) * a).rgb), tr = luma(texture(uInput, uv + vec2(k, k) * a).rgb);
  float ml = luma(texture(uInput, uv + vec2(-k, 0.) * a).rgb), mr = luma(texture(uInput, uv + vec2(k, 0.) * a).rgb);
  float bl2 = luma(texture(uInput, uv + vec2(-k, -k) * a).rgb), bc = luma(texture(uInput, uv + vec2(0., -k) * a).rgb), br = luma(texture(uInput, uv + vec2(k, -k) * a).rgb);
  float gx = (tr + 2. * mr + br) - (tl + 2. * ml + bl2);
  float gy = (tl + 2. * tc + tr) - (bl2 + 2. * bc + br);
  float ln = p_line < .1 ? 0. : smoothstep(p_sens, p_sens + .12, length(vec2(gx, gy)));
  return vec4(mix(c, p_inkc, ln), 1.);
}` });

/* ---- Charcoal ---- */
FX.register({ id:'trt-charcoal', name:'Charcoal', cat:'treatment', nonLocal:true, search:['drawing', 'chalk', 'pencil', 'sketch', 'smudge'],
  desc:'A charcoal drawing: dark tones dragged along a flowing stroke direction, catching on the tooth of the paper.',
  params:[ R('smudge','Smudge',16,0,50,1), R('tooth','Paper tooth',4,1,10,.5), R('pressure','Pressure',1.5,.5,3), R('lines','Outlines',.45,0,1.5), R('angle','Stroke angle',35,-90,90,1), T('reverse','Light strokes on dark'), C('inkc','Charcoal','#171614','ink'), C('paper','Paper','#e9e3d5','ground') ],
  fs:L4.px + `
vec4 fx(vec2 uv){
  vec2 a = l4asp();
  vec2 g = uv * vec2(aspect(), 1.);
  float an = radians(p_angle) + (fbm(g * 2.5 + 4.) - .5) * 2.2;
  vec2 dir = vec2(cos(an), sin(an));
  float sm = p_smudge * L4PX;
  float acc = 0.;
  for (int i = 0; i < 12; i++){
    float f = float(i) / 11. - .5;
    acc += luma(texture(uInput, uv + dir * a * f * sm * 2.).rgb);
  }
  acc /= 12.;
  float k = 2. * L4PX;
  float gx = luma(texture(uInput, uv + vec2(k, 0.) * a).rgb) - luma(texture(uInput, uv - vec2(k, 0.) * a).rgb);
  float gy = luma(texture(uInput, uv + vec2(0., k) * a).rgb) - luma(texture(uInput, uv - vec2(0., k) * a).rgb);
  float edge = length(vec2(gx, gy));
  float d = p_reverse > .5 ? acc : 1. - acc;
  d = clamp((d - .5) * p_pressure + .5 + edge * p_lines * 1.5, 0., 1.);
  vec2 pg = g * 1350. / p_tooth;
  float tooth = mix(vnoise(pg), vnoise(pg * 2.7 + 9.), .5);
  float streak = vnoise(rot(an) * pg * vec2(.12, 1.) + 5.);
  float tx = mix(tooth, streak, .35);
  float cov = smoothstep(tx * .8 - .14, tx * .8 + .24, d);
  cov *= .55 + .45 * d;
  return vec4(mix(p_paper, p_inkc, clamp(cov, 0., 1.)), 1.);
}` });

/* ---- Watercolour ---- */
FX.register({ id:'trt-watercolour', name:'Watercolour', cat:'treatment', nonLocal:true, search:['wash', 'painting', 'gouache', 'ink wash', 'bleed'],
  desc:'Thin transparent washes that bleed past their edges, pool darker at the boundary and settle into the grain of the paper.',
  params:[ R('wash','Wash',9,1,30,.5), R('wobble','Bleed',.6,0,1.5), R('edges','Pigment edges',.7,0,2), R('blooms','Blooms',.3,0,1), R('gran','Granulation',.55,0,1.5), R('paint','Paint',.9,.2,1), C('paper','Paper','#f7f2e7',false) ],
  fs:L4.px + L4.blur + `
vec4 fx(vec2 uv){
  vec2 a = l4asp();
  vec2 g = uv * vec2(aspect(), 1.);
  vec2 w = (vec2(fbm(g * 5.), fbm(g * 5. + 31.)) - .5) * p_wobble * .022;
  vec2 u2 = uv + w * a;
  float r = p_wash * L4PX;
  vec3 c = l4blur(u2, r);
  vec3 c2 = l4blur(u2, r * 2.4 + 6. * L4PX);
  float edge = length(c - c2);
  c *= 1. - p_edges * clamp(edge * 2.6, 0., .55);
  float n = fbm(g * 3.2 + 7.);
  float op = p_paint * (1. - p_blooms * .55 + p_blooms * .9 * smoothstep(.3, .7, n));
  c = clamp(c * 1.06, 0., 1.);
  vec3 col = p_paper * mix(vec3(1.), pow(c, vec3(1.18)), clamp(op, 0., 1.));
  vec2 pg = g * 1350. / 2.4;
  float gr = vnoise(pg) * .6 + vnoise(pg * 2.3 + 4.) * .4;
  col *= 1. - p_gran * (gr - .5) * .35 * (1. - luma(c) * .7);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Retro palettes ---- */
const L4Pal = (() => {
  const P = [
    ['Game Boy', ['0f380f', '306230', '8bac0f', '9bbc0f']],
    ['PICO-8', ['000000', '1d2b53', '7e2553', '008751', 'ab5236', '5f574f', 'c2c3c7', 'fff1e8', 'ff004d', 'ffa300', 'ffec27', '00e436', '29adff', '83769c', 'ff77a8', 'ffccaa']],
    ['Commodore 64', ['000000', 'ffffff', '68372b', '70a4b2', '6f3d86', '588d43', '352879', 'b8c76f', '6f4f25', '433900', '9a6759', '444444', '6c6c6c', '9ad284', '6c5eb5', '959595']],
    ['CGA', ['000000', '55ffff', 'ff55ff', 'ffffff']],
    ['ZX Spectrum', ['000000', '0000d7', 'd70000', 'd700d7', '00d700', '00d7d7', 'd7d700', 'd7d7d7', '0000ff', 'ff0000', 'ff00ff', '00ff00', '00ffff', 'ffff00', 'ffffff']],
    ['Teletext', ['000000', 'ff0000', '00ff00', 'ffff00', '0000ff', 'ff00ff', '00ffff', 'ffffff']],
    ['Apple II', ['000000', '722640', '40337f', 'e434fe', '0e5940', '808080', '1b9afe', 'bfb3ff', '404c00', 'e4650d', 'f1a6bf', '1bcb01', 'bfcc80', '8dd9bf', 'ffffff']],
    ['Black and white', ['000000', 'ffffff']],
  ];
  const flat = [], off = [], cnt = [];
  P.forEach(([, cols]) => { off.push(flat.length); cnt.push(cols.length); cols.forEach(h => flat.push(h)); });
  const v = h => { const n = parseInt(h, 16); return `vec3(${((n >> 16) & 255) / 255},${((n >> 8) & 255) / 255},${(n & 255) / 255})`; };
  return {
    names: P.map(p => p[0]),
    glsl: `const vec3 L4PAL[${flat.length}] = vec3[${flat.length}](${flat.map(v).join(',')});
const int L4OFF[${off.length}] = int[${off.length}](${off.join(',')});
const int L4CNT[${cnt.length}] = int[${cnt.length}](${cnt.join(',')});
vec3 l4nearest(vec3 c, int p){
  vec3 best = L4PAL[L4OFF[p]];
  float bd = 1e9;
  for (int i = 0; i < 16; i++){
    if (i >= L4CNT[p]) break;
    vec3 q = L4PAL[L4OFF[p] + i];
    vec3 d = (q - c) * vec3(.9, 1.2, .7);
    float dd = dot(d, d);
    if (dd < bd){ bd = dd; best = q; }
  }
  return best;
}`,
  };
})();

FX.register({ id:'trt-retro', name:'Retro palette', cat:'treatment', search:['pixel art', '8-bit', 'game boy', 'commodore', 'c64', 'pico-8', 'cga', 'spectrum', 'dither', 'low res'],
  desc:'Rebuilds the frame in the fixed palette of an old machine, at chunky pixels, with an ordered dither between the colours.',
  params:[ S('palette','Palette',L4Pal.names,0), I('cells','Pixels across',150,40,400), S('dither','Dither',['None','Bayer 4','Bayer 8'],2), R('amount','Dither amount',.55,0,1.5), R('contrast','Contrast',1.15,.5,2), R('exposure','Brightness',0,-.4,.4) ],
  fs:L4Pal.glsl + `
vec4 fx(vec2 uv){
  vec2 grid = vec2(p_cells, floor(p_cells / aspect()));
  vec2 id = floor(uv * grid);
  vec2 cuv = (id + .5) / grid;
  vec2 h = .28 / grid;
  vec3 c = (texture(uInput, cuv + h * vec2(1., 1.)).rgb + texture(uInput, cuv + h * vec2(-1., 1.)).rgb + texture(uInput, cuv + h * vec2(1., -1.)).rgb + texture(uInput, cuv - h).rgb) * .25;
  c = clamp((c - .5) * p_contrast + .5 + p_exposure, 0., 1.);
  float th = 0.;
  if (p_dither > 1.5) th = bayer8(id) - .5;
  else if (p_dither > .5) th = bayer4(id) - .5;
  c += th * p_amount * .35;
  return vec4(l4nearest(c, int(p_palette + .5)), 1.);
}` });

/* ---- Compression damage ---- */
FX.register({ id:'trt-compress', name:'Compression damage', cat:'treatment', nonLocal:true, search:['jpeg', 'jpg', 'artefact', 'glitch', 'blocky', 'low quality', 'macroblock'],
  desc:'Image compression pushed too far: flat blocks, banded tones, colour smeared across wider blocks and fuzz around edges.',
  params:[ R('quality','Quality',.3,0,1), I('block','Block size',12,4,40), R('chroma','Colour smear',.8,0,1), R('ring','Edge fuzz',.5,0,1.5) ],
  fs:`vec3 rgb2ycc(vec3 c){ return vec3(dot(c, vec3(.299, .587, .114)), dot(c, vec3(-.1687, -.3313, .5)), dot(c, vec3(.5, -.4187, -.0813))); }
vec3 ycc2rgb(vec3 y){ return vec3(y.x + 1.402 * y.z, y.x - .34414 * y.y - .71414 * y.z, y.x + 1.772 * y.y); }
vec4 fx(vec2 uv){
  vec2 px = uv * uRes;
  float bs = max(p_block * uRes.x / 1080., 2.);
  vec2 blk = floor(px / bs);
  vec2 bc = (blk + .5) * bs / uRes;
  vec2 q = .25 * bs / uRes;
  vec3 c = texture(uInput, uv).rgb;
  vec3 yc = rgb2ycc(c);
  float ym = (rgb2ycc(texture(uInput, bc + q * vec2(1., 1.)).rgb).x + rgb2ycc(texture(uInput, bc + q * vec2(-1., 1.)).rgb).x + rgb2ycc(texture(uInput, bc + q * vec2(1., -1.)).rgb).x + rgb2ycc(texture(uInput, bc - q).rgb).x) * .25;
  float flatness = (1. - p_quality) * (1. - p_quality);
  float lv = mix(5., 64., p_quality);
  float y = mix(yc.x, ym, flatness * .85);
  float off = (hash12(blk + 3.7) - .5) * (1. - p_quality) * .5;
  y = floor(y * lv + .5 + off) / lv;
  float cs = bs * (1. + p_chroma);
  vec2 cb = (floor(px / (cs * 2.)) + .5) * cs * 2. / uRes;
  vec2 qc = cs * .5 / uRes;
  vec3 c0 = rgb2ycc(texture(uInput, cb + qc * vec2(1., 1.)).rgb) + rgb2ycc(texture(uInput, cb + qc * vec2(-1., 1.)).rgb) + rgb2ycc(texture(uInput, cb + qc * vec2(1., -1.)).rgb) + rgb2ycc(texture(uInput, cb - qc).rgb);
  vec2 chr = mix(yc.yz, c0.yz * .25, p_chroma);
  float lvc = mix(6., 40., p_quality);
  chr = floor(chr * lvc + .5) / lvc;
  float edge = abs(yc.x - ym);
  y += (hash12(floor(px) + blk * 7.) - .5) * edge * p_ring * 1.6;
  return vec4(clamp(ycc2rgb(vec3(y, chr)), 0., 1.), 1.);
}` });

/* ---- Display pixels ---- */
FX.register({ id:'trt-subpixel', name:'Display pixels', cat:'treatment', nonLocal:true, search:['led', 'lcd', 'rgb', 'screen', 'matrix', 'subpixel', 'monitor', 'billboard', 'pixel grid'],
  desc:'Shows the frame on a display up close: red, green and blue stripes, phosphor dots or round LEDs, with a dark gap between pixels.',
  params:[ S('mode','Display',['RGB stripes','Phosphor dots','Round LEDs'],0), I('cells','Pixels across',90,30,300), R('gap','Gap',.2,0,.6), R('sep','Colour separation',.6,0,1), R('glow','Glow',.5,0,1.2), R('gain','Brightness',1.5,.6,3), C('back','Gap colour','#050607','ground') ],
  fs:L4.blur + `
vec4 fx(vec2 uv){
  vec2 cellN = vec2(p_cells, p_cells / aspect());
  vec2 cp = uv * cellN;
  vec2 id = floor(cp), f = fract(cp);
  vec2 cuv = (id + .5) / cellN;
  vec2 h = .22 / cellN;
  vec3 col = (texture(uInput, cuv + h * vec2(1., 1.)).rgb + texture(uInput, cuv + h * vec2(-1., 1.)).rgb + texture(uInput, cuv + h * vec2(1., -1.)).rgb + texture(uInput, cuv - h).rgb) * .25;
  float gp = p_gap * .5;
  int m = int(p_mode + .5);
  vec3 mask = vec3(0.);
  float aa = .06;
  if (m == 0){
    float sx = f.x * 3.;
    float si = floor(sx);
    float lx = fract(sx);
    float w = 1. - smoothstep(.5 - p_gap * .5 - aa, .5 - p_gap * .5 + aa, abs(lx - .5));
    float vy = 1. - smoothstep(.5 - gp - aa, .5 - gp + aa, abs(f.y - .5));
    mask = mix(vec3(1.), vec3(si < .5 ? 1. : 0., si > .5 && si < 1.5 ? 1. : 0., si > 1.5 ? 1. : 0.), p_sep) * w * vy;
  } else if (m == 1){
    float rr = .24 * (1. - p_gap * .4);
    vec2 pr = vec2(.27, .3), pg = vec2(.73, .3), pb = vec2(.5, .74);
    vec3 dm = vec3(1. - smoothstep(rr - aa, rr + aa, length(f - pr)), 1. - smoothstep(rr - aa, rr + aa, length(f - pg)), 1. - smoothstep(rr - aa, rr + aa, length(f - pb)));
    mask = mix(vec3(max(dm.r, max(dm.g, dm.b))), dm, p_sep);
  } else {
    float r = .5 - gp;
    mask = vec3(1. - smoothstep(r - aa, r + aa, length(f - .5)));
  }
  vec3 lit = col * mask * p_gain;
  vec3 bl = l4blur(uv, 2.6 / p_cells);
  return vec4(clamp(p_back + lit + bl * p_glow * .55, 0., 1.), 1.);
}` });

/* ---- Solarise ---- */
FX.register({ id:'trt-solarise', name:'Solarise', cat:'treatment', search:['sabattier', 'darkroom', 'invert', 'mackie line', 'psychedelic'],
  desc:'The darkroom trick of flashing the print mid-development: light tones fold back to dark, with a thin line where they turn.',
  params:[ R('thresh','Fold point',.5,.15,.9), R('depth','Depth',1,0,1.5), S('mode','Fold',['Each colour','Brightness only'],0), R('line','Edge line',.5,0,1), R('saturation','Colour',1,0,2) ],
  fs:L4.px + `
float l4fold(float x, float t, float depth){
  float over = max(x - t, 0.);
  float soft = .5 * (over + sqrt(over * over + .0009)) - .015;
  return x - soft * (1. + depth * t / (1. - t));
}
vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  float l = luma(c);
  vec3 o;
  if (p_mode < .5){
    o = vec3(l4fold(c.r, p_thresh, p_depth), l4fold(c.g, p_thresh, p_depth), l4fold(c.b, p_thresh, p_depth));
  } else {
    float f = l4fold(l, p_thresh, p_depth);
    o = c * f / max(l, .04);
  }
  o = mix(vec3(luma(o)), o, p_saturation);
  vec2 a = l4asp(); float k = 1.5 * L4PX;
  float gx = luma(texture(uInput, uv + vec2(k, 0.) * a).rgb) - luma(texture(uInput, uv - vec2(k, 0.) * a).rgb);
  float gy = luma(texture(uInput, uv + vec2(0., k) * a).rgb) - luma(texture(uInput, uv - vec2(0., k) * a).rgb);
  float near = 1. - smoothstep(0., .18, abs(l - p_thresh));
  float ln = smoothstep(.02, .12, length(vec2(gx, gy))) * near;
  o *= 1. - ln * p_line * .8;
  return vec4(clamp(o, 0., 1.), 1.);
}` });

/* ---- Black and white ---- */
FX.register({ id:'trt-mono', name:'Black & white', cat:'treatment', nonLocal:true, search:['monochrome', 'greyscale', 'grayscale', 'filter', 'infrared', 'channel mixer', 'toned'],
  desc:'Black and white through a coloured filter, as on film: a red filter darkens skies, a green one lightens leaves, infrared turns foliage white.',
  params:[ S('filter','Filter',['None','Yellow','Orange','Red','Green','Blue','Infrared'],2), R('contrast','Contrast',1.25,.5,2.5), R('lift','Exposure',0,-.5,.5), R('glow','Glow',0,0,1), C('shadow','Shadows','#0b0b0d',false), C('high','Highlights','#f6f2ea',false), R('tone','Tone',1,0,1) ],
  fs:L4.blur + `
vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  int f = int(p_filter + .5);
  vec3 w = vec3(.30, .59, .11);
  if (f == 1) w = vec3(.45, .5, .05);
  else if (f == 2) w = vec3(.68, .38, -.06);
  else if (f == 3) w = vec3(.95, .2, -.15);
  else if (f == 4) w = vec3(.05, .88, .07);
  else if (f == 5) w = vec3(-.05, .12, .93);
  else if (f == 6) w = vec3(-.4, 1.3, .1);
  float g = dot(c, w);
  if (p_glow > .01){
    vec3 b = l4blur(uv, .03);
    float bg = dot(b, w);
    g = g + max(bg - .55, 0.) * p_glow * 1.4 + (bg - g) * p_glow * .25;
  }
  g = clamp((g - .5) * p_contrast + .5 + p_lift, 0., 1.);
  return vec4(mix(vec3(g), mix(p_shadow, p_high, g), p_tone), 1.);
}` });

/* ================= EFFECTS ================= */

/* ---- Bokeh ---- */
FX.register({ id:'fx-bokeh', name:'Bokeh', cat:'fx', nonLocal:true, search:['lens blur', 'depth of field', 'defocus', 'aperture', 'out of focus', 'highlights'],
  desc:'Defocus in the shape of a lens aperture: bright points swell into discs, hexagons or rings while the centre can stay sharp.',
  params:[ R('size','Size',3.5,0,10,.1), R('boost','Highlight discs',1.6,0,4), S('shape','Aperture',['Disc','Hexagon','Pentagon','Ring'],0), R('sharp','Sharp centre',.5,0,1), R('turn','Turn',0,0,60,1) ],
  fs:`float l4poly(float a, float n){
  float seg = TAU / n;
  return cos(PI / n) / cos(mod(a, seg) - seg * .5);
}
vec4 fx(vec2 uv){
  vec2 p = centered(uv);
  float rr = length(p) / (length(vec2(aspect(), 1.)) * .5);
  float m = mix(1., smoothstep(.1, .75, rr), p_sharp);
  float R = p_size / 100. * m;
  int sh = int(p_shape + .5);
  float sides = sh == 1 ? 6. : sh == 2 ? 5. : 0.;
  vec3 acc = vec3(0.);
  float ws = 0.;
  for (int i = 0; i < 64; i++){
    float fi = float(i);
    float r = sqrt((fi + .5) / 64.);
    float a = fi * 2.39996 + radians(p_turn);
    float k = sides > 0. ? l4poly(a, sides) : 1.;
    vec2 o = vec2(cos(a) / aspect(), sin(a)) * r * k * R;
    vec3 s = texture(uInput, uv + o).rgb;
    float w = 1. + p_boost * 6. * smoothstep(.55, 1., luma(s));
    if (sh == 3) w *= .3 + 1.6 * smoothstep(.5, 1., r);
    acc += s * w;
    ws += w;
  }
  return vec4(acc / ws, 1.);
}` });

/* ---- Swirl & bulge ---- */
FX.register({ id:'fx-swirl', name:'Swirl & bulge', cat:'fx', nonLocal:true, search:['twirl', 'vortex', 'pinch', 'magnify', 'distort', 'whirl'],
  desc:'Twists, swells or squeezes a round patch of the frame, and can breathe in and out over the loop.',
  params:[ S('mode','Mode',['Swirl','Bulge','Pinch','Swirl and bulge'],0), R('amount','Amount',1.6,-3,3), R('radius','Radius',.6,.1,1.4), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1), R('pulse','Breathe',.5,0,1), I('spin','Turns per loop',0,-3,3) ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = centered(uv) - vec2(p_x * .5 * aspect(), p_y * .5);
  float amt = mix(1., .5 + .5 * cos(uLoop * TAU), p_pulse);
  float r = length(p) / p_radius;
  float f = 1. - smoothstep(0., 1., r);
  int m = int(p_mode + .5);
  float k = clamp(p_amount * .4, -.92, .92) * amt * f * f;
  if (m == 0 || m == 3){
    float a = p_amount * amt * f * f * PI * .6 + float(p_spin) * uLoop * TAU * f;
    p = rot(a) * p;
  }
  if (m == 1 || m == 3) p *= 1. - k;
  if (m == 2) p *= 1. + k;
  vec2 s = uncentered(p + vec2(p_x * .5 * aspect(), p_y * .5));
  return vec4(texture(uInput, mirrorUv(s)).rgb, 1.);
}` });

/* ---- Slice shift ---- */
FX.register({ id:'fx-sliceshift', name:'Slice shift', cat:'fx', nonLocal:true, search:['glitch', 'displace', 'strips', 'offset', 'block displacement', 'tear'],
  desc:'Cuts the frame into bands of uneven width and slides them sideways, smoothly or in whole steps, so the picture breaks and reassembles each loop.',
  params:[ S('dir','Direction',['Horizontal bands','Vertical bands'],0), I('slices','Slices',16,4,60), R('shift','Shift',.14,0,.6), R('cover','Bands moving',.65,0,1), I('steps','Snap to steps',0,0,12), R('split','Colour split',.3,0,1), T('wrap','Wrap around',true) ],
  fs:`vec4 fx(vec2 uv){
  bool vert = p_dir > .5;
  float a = vert ? uv.x : uv.y;
  float N = p_slices;
  float cell = floor(a * N);
  float sub = step(hash12(vec2(cell, 3.7)), .45);
  float id = sub > .5 ? floor(a * N * 3.) + 1000. : cell;
  float moving = step(hash12(vec2(id, 9.1)), p_cover);
  float k = 1. + floor(hash12(vec2(id, 5.5)) * 3.);
  float ph = hash12(vec2(id, 7.7));
  float w = sin(TAU * (k * uLoop + ph));
  if (p_steps > .5) w = floor(w * p_steps + .5) / p_steps;
  float off = w * p_shift * moving * (.4 + .6 * hash12(vec2(id, 2.2)));
  vec2 o = vert ? vec2(0., off) : vec2(off, 0.);
  vec2 oc = o * p_split * .35;
  vec2 s = uv + o;
  vec2 sr = s + oc, sb = s - oc;
  if (p_wrap > .5){ s = fract(s); sr = fract(sr); sb = fract(sb); }
  else { s = mirrorUv(s); sr = mirrorUv(sr); sb = mirrorUv(sb); }
  return vec4(texture(uInput, sr).r, texture(uInput, s).g, texture(uInput, sb).b, 1.);
}` });

/* ---- Lens flare ---- */
FX.register({ id:'fx-flare', name:'Lens flare', cat:'fx', search:['light', 'sun', 'glare', 'anamorphic', 'ghosts', 'streak', 'cinematic'],
  desc:'A light source in the frame throws a glow, a horizontal streak and a line of ghost discs through the middle, added over the picture.',
  params:[ R('x','Light X',.55,-1,1), R('y','Light Y',.5,-1,1), R('size','Size',.6,.15,1.4), R('streak','Streak',.7,0,1.5), I('ghosts','Ghosts',4,0,6), R('power','Strength',1,0,2), R('drift','Drift',.5,0,2), C('tint','Flare','#ffb36b','accent'), C('tint2','Ghosts','#6bb8ff','accent2') ],
  fs:`vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  vec2 p = centered(uv);
  float ph = uLoop * TAU;
  vec2 L = vec2(p_x * .5 * aspect(), p_y * .5) + p_drift * .05 * vec2(cos(ph), sin(ph));
  vec2 d = p - L;
  float dist = length(d);
  float S = p_size;
  vec3 add = vec3(0.);
  add += p_tint * (exp(-dist / (.05 * S)) * 1.3 + exp(-dist / (.3 * S)) * .3);
  float sk = exp(-abs(d.y) / (.003 + .006 * S)) * exp(-abs(d.x) / (p_streak * .9 + .01));
  add += mix(p_tint, vec3(1.), .35) * sk * .8;
  for (int i = 0; i < 6; i++){
    if (float(i) >= p_ghosts) break;
    float fi = float(i);
    float k = .3 + fi * .38 + .1 * hash12(vec2(fi, 4.));
    vec2 gp = -L * k;
    float gr = (.04 + .035 * hash12(vec2(fi, 2.))) * (.5 + S);
    float gd = length(p - gp);
    float disc = (1. - smoothstep(gr * .8, gr, gd)) * .16;
    float ring = exp(-pow((gd - gr) / (gr * .14), 2.)) * .3;
    vec3 gc = mix(p_tint, p_tint2, fract(fi * .43 + .1));
    add += gc * (disc + ring);
  }
  add += mix(p_tint2, p_tint, .5) * exp(-pow((dist - .3 * S) / (.01 + .02 * S), 2.)) * .12;
  add *= p_power;
  return vec4(1. - (1. - c) * (1. - clamp(add, 0., 1.)), 1.);
}` });

/* ---- Lens dirt ---- */
FX.register({ id:'fx-lensdirt', name:'Lens dirt', cat:'fx', nonLocal:true, search:['dust', 'smudge', 'grime', 'bloom', 'glass', 'cinematic'],
  desc:'Smudges, specks and blotches on the front of the lens that only show up when something bright is nearby.',
  params:[ R('dirt','Dirt',1,0,1.5), R('scale','Scale',1.2,.4,4), R('reach','Light reach',.14,.03,.35), R('thresh','Light threshold',.72,0,1), R('power','Strength',.6,0,3), R('base','Always visible',.15,0,.6), C('tint','Light','#ffd9a8','accent') ],
  fs:L4.blur + `
float l4dirt(vec2 g, float sc){
  float b = smoothstep(.52, .8, fbm(g * sc * .9 + 4.));
  vec2 q = g * sc * 6.;
  vec2 id = floor(q), f = fract(q) - .5;
  vec2 o = (hash22(id + 7.) - .5) * .6;
  float rad = .05 + .2 * hash12(id + 3.);
  float sp = step(.55, hash12(id)) * smoothstep(rad, rad * .4, length(f - o));
  vec2 q2 = g * sc * 2.2;
  vec2 id2 = floor(q2), f2 = fract(q2) - .5;
  vec2 o2 = (hash22(id2 + 21.) - .5) * .5;
  float rad2 = .1 + .25 * hash12(id2 + 13.);
  float sp2 = step(.7, hash12(id2 + 5.)) * smoothstep(rad2, rad2 * .3, length(f2 - o2)) * .8;
  float sm = smoothstep(.4, .8, fbm(g * sc * .35 + 11.));
  return clamp(b * .7 + sp + sp2 + sm * .5, 0., 1.);
}
vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  vec2 g = uv * vec2(aspect(), 1.);
  vec3 acc = vec3(0.);
  for (int i = 0; i < 24; i++){
    float fi = float(i);
    float rr = sqrt((fi + .5) / 24.) * p_reach;
    float an = fi * 2.39996;
    vec3 s = texture(uInput, uv + vec2(cos(an) / aspect(), sin(an)) * rr).rgb;
    acc += max(s - p_thresh, 0.) / max(1. - p_thresh, .05);
  }
  vec3 light = acc / 24.;
  float lum = luma(light);
  float dirt = l4dirt(g, p_scale) * p_dirt;
  vec3 add = p_tint * dirt * (lum * 4. * p_power + p_base * .3 * p_power) * (.96 + .04 * cos(uLoop * TAU));
  return vec4(clamp(c + add, 0., 1.), 1.);
}` });

/* ---- Sensor noise ---- */
FX.register({ id:'fx-sensor', name:'Sensor noise', cat:'fx', search:['digital noise', 'iso', 'low light', 'camera', 'hot pixels', 'banding', 'grain'],
  desc:'Noise from a small digital sensor pushed too far: colour speckle in the shadows, faint row banding and a few stuck pixels.',
  params:[ R('amount','Amount',.4,0,1.5), R('chroma','Colour noise',.6,0,1.5), R('size','Grain size',1.6,1,5,.1), R('band','Row banding',.35,0,1), R('hot','Hot pixels',.4,0,1.5) ],
  fs:L4.noiseT + `
vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  float cell = max(p_size * uRes.y / 1350., 1.);
  vec2 px = floor(uv * uRes / cell);
  float l = luma(c);
  float sh = mix(.35, 1., 1. - smoothstep(0., .8, l));
  float ln = l4noiseT(px, 12.) * 2.;
  vec3 cn = vec3(l4noiseT(px + 3.1, 12.), l4noiseT(px + 7.7, 12.), l4noiseT(px + 11.3, 12.)) * 2.;
  c += vec3(ln) * p_amount * .3 * sh + (cn - dot(cn, vec3(1. / 3.))) * p_chroma * p_amount * .4 * sh;
  float row = floor(uv.y * uRes.y / cell);
  c += (hash12(vec2(row, 3.)) - .5) * p_band * .07 * (1. - l * .6);
  vec2 fp = floor(uv * uRes);
  float hp = hash12(fp * 1.7 + 5.);
  float on = step(1. - .0012 * p_hot, hp) * step(0., l4noiseT(fp, 6.) + .3);
  vec3 hc = mix(vec3(1.), vec3(hash12(fp + 1.), hash12(fp + 2.), hash12(fp + 3.)) + .3, .7);
  c = mix(c, hc, on * .9);
  return vec4(clamp(c, 0., 1.), 1.);
}` });

/* ---- Prism ---- */
FX.register({ id:'fx-prism', name:'Prism', cat:'fx', nonLocal:true, search:['spectrum', 'rainbow', 'refraction', 'chromatic', 'ghost', 'dispersion'],
  desc:'Smears the frame along a line into a run of copies, each tinted a step further along the spectrum, like light through a prism.',
  params:[ I('copies','Copies',9,2,16), R('spread','Spread',6,0,20,.1), R('angle','Angle',20,-90,90,1), I('spin','Turns per loop',0,-2,2), R('spectrum','Spectrum',1,0,1), R('mix','Amount',.85,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 base = texture(uInput, uv).rgb;
  float n = p_copies;
  float ang = radians(p_angle) + uLoop * TAU * p_spin;
  vec2 dir = vec2(cos(ang) / aspect(), sin(ang)) * p_spread / 100.;
  vec3 acc = vec3(0.), ws = vec3(0.);
  for (int i = 0; i < 16; i++){
    if (float(i) >= n) break;
    float t = float(i) / (n - 1.);
    vec3 tint = mix(vec3(1.), hsv2rgb(vec3(t * .82, 1., 1.)), p_spectrum);
    acc += texture(uInput, uv + dir * (t - .5)).rgb * tint;
    ws += tint;
  }
  vec3 pr = acc / max(ws, vec3(1e-3));
  return vec4(mix(base, pr, p_mix), 1.);
}` });

/* ---- Pleats ---- */
FX.register({ id:'fx-pleats', name:'Pleats', cat:'fx', nonLocal:true, search:['fold', 'accordion', 'mirror', 'strips', 'zigzag', 'paper', 'venetian'],
  desc:'Folds the frame into strips like an accordion: every other strip is turned round, tilted and shaded as if it faced the other way.',
  params:[ S('dir','Direction',['Vertical strips','Horizontal strips'],0), I('strips','Strips',9,2,40), R('fold','Turn round',1,0,1), R('tilt','Tilt',.08,0,.4), R('shade','Shade',.35,0,1), I('slide','Slide per loop',0,-3,3) ],
  fs:`vec4 fx(vec2 uv){
  bool hz = p_dir > .5;
  vec2 q = hz ? uv.yx : uv;
  float N = p_strips;
  float id = floor(q.x * N);
  float f = fract(q.x * N);
  float odd = mod(id, 2.);
  float sgn = odd * 2. - 1.;
  float ff = mix(f, 1. - f, odd * p_fold);
  float sx = (id + ff) / N;
  float sy = q.y + (f - .5) * p_tilt * sgn + p_slide * uLoop * sgn;
  sy = fract(sy);
  vec2 s = hz ? vec2(sy, sx) : vec2(sx, sy);
  vec3 c = texture(uInput, s).rgb;
  float sh = 1. + p_shade * (sgn * .5 + (f - .5) * sgn * .4);
  return vec4(clamp(c * sh, 0., 1.), 1.);
}` });

/* ---- Folded paper ---- */
FX.register({ id:'fx-creases', name:'Folded paper', cat:'fx', search:['fold', 'poster', 'crease', 'paper', 'print', 'worn', 'unfolded'],
  desc:'Makes the frame look like a poster that has been folded and opened again: crease lines, panels that catch the light differently, and worn edges along the folds.',
  params:[ I('cols','Columns',2,1,6), I('rows','Rows',3,1,8), R('crease','Crease',.7,0,1.5), R('panel','Panel tone',.14,0,.4), R('warp','Bend',.4,0,1.5), R('wear','Wear',.5,0,1.5) ],
  fs:`vec4 fx(vec2 uv){
  vec2 grid = vec2(p_cols, p_rows);
  vec2 g = uv * grid;
  vec2 id = floor(g), f = fract(g);
  vec2 alt = vec2(mod(id.x, 2.) * 2. - 1., mod(id.y, 2.) * 2. - 1.);
  vec2 s = uv + vec2((f.x - .5) * alt.x, (f.y - .5) * alt.y) * p_warp * .006;
  vec3 c = texture(uInput, s).rgb;
  float tone = (hash12(id + 4.) - .5) * p_panel * 2.;
  tone += ((f.x - .5) * alt.x * .5 + (f.y - .5) * alt.y * .5) * p_panel * .8;
  c *= 1. + tone;
  vec2 fl = uv * grid;
  vec2 rn = floor(fl + .5);
  vec2 dpx = abs(fl - rn) / grid * vec2(aspect(), 1.);
  float vx = step(.5, rn.x) * step(rn.x, grid.x - .5);
  float vy = step(.5, rn.y) * step(rn.y, grid.y - .5);
  float sx = fl.x - rn.x, sy = fl.y - rn.y;
  float lx = vx * (exp(-pow(dpx.x / .0011, 2.)) * -.35 + exp(-pow((dpx.x - .0035) / .003, 2.)) * .12 * sign(sx));
  float ly = vy * (exp(-pow(dpx.y / .0011, 2.)) * -.35 + exp(-pow((dpx.y - .0035) / .003, 2.)) * .12 * sign(sy));
  c *= 1. + (lx + ly) * p_crease;
  float sc = vnoise(uv * uRes / 2.5);
  float wx = vx * exp(-dpx.x / .004) * smoothstep(.5, .8, sc);
  float wy = vy * exp(-dpx.y / .004) * smoothstep(.5, .8, sc);
  c = mix(c, vec3(.94, .93, .9), clamp((wx + wy) * p_wear * .8, 0., .85));
  return vec4(clamp(c, 0., 1.), 1.);
}` });

/* ---- Double exposure ---- */
FX.register({ id:'fx-doubleexposure', name:'Double exposure', cat:'fx', nonLocal:true, search:['overlay', 'blend', 'silhouette', 'multiple exposure', 'ghost', 'image b'],
  desc:'Lays a second exposure over the frame, from a mirrored copy of itself or from image B, letting it show through the dark areas as on double-exposed film.',
  params:[ S('copy','Second exposure',['Mirrored across','Mirrored down','Turned upside down','Zoomed copy','Image B'],0), S('blend','Blend',['Through the shadows','Screen','Lighten','Multiply','Difference'],0), R('mix','Amount',.85,0,1), R('scale','Scale',1.4,.5,3), R('turn','Turn',0,-180,180,1), R('drift','Drift',.4,0,2), R('tintAmt','Tint',.4,0,1), C('tint','Tint colour','#ff9a5c','accent') ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uInput, uv).rgb;
  vec2 p = centered(uv);
  float ph = uLoop * TAU;
  int m = int(p_copy + .5);
  if (m == 0) p.x = -p.x;
  else if (m == 1) p.y = -p.y;
  else if (m == 2) p = -p;
  p = rot(radians(p_turn)) * p / p_scale;
  p += p_drift * .04 * vec2(cos(ph), sin(ph));
  vec2 s = mirrorUv(uncentered(p));
  vec3 b = m == 4 ? texture(uB, s).rgb : texture(uInput, s).rgb;
  b = mix(b, luma(b) * p_tint * 1.7, p_tintAmt);
  int bm = int(p_blend + .5);
  vec3 o;
  if (bm == 0){
    float w = smoothstep(.75, .2, luma(a));
    o = mix(a, b, w * p_mix);
  } else {
    vec3 x;
    if (bm == 1) x = 1. - (1. - a) * (1. - b);
    else if (bm == 2) x = max(a, b);
    else if (bm == 3) x = a * b * 1.6;
    else x = abs(a - b);
    o = mix(a, x, p_mix);
  }
  return vec4(clamp(o, 0., 1.), 1.);
}` });

/* ---- Block shift ---- */
FX.register({ id:'fx-blockshift', name:'Block shift', cat:'fx', nonLocal:true, search:['glitch', 'displace', 'grid', 'tiles', 'jump', 'blocks', 'pixel'],
  desc:'A grid of blocks where some slide sideways or up and down by whole blocks and back again, with a colour shift on the ones that move.',
  params:[ I('cols','Columns',8,2,30), I('rows','Rows',10,2,40), R('amount','Blocks moving',.4,0,1), I('dist','Distance in blocks',2,1,6), R('colour','Colour shift',.4,0,1), R('edge','Block edge',.25,0,1), I('seed','Pattern',3,0,50) ],
  fs:`vec4 fx(vec2 uv){
  vec2 grid = vec2(p_cols, p_rows);
  vec2 id = floor(uv * grid);
  vec2 f = fract(uv * grid);
  float h = hash12(id + p_seed * 13.7);
  float sel = step(h, p_amount);
  float k = 1. + floor(hash12(id + 5.) * 2.);
  float ph = hash12(id + 9.);
  float w = sin(TAU * (k * uLoop + ph));
  vec2 dv = hash12(id + 3.) < .5 ? vec2(1., 0.) : vec2(0., 1.);
  float st = floor(w * p_dist + .5) * sel;
  vec2 s = mirrorUv(uv + dv * st / grid);
  vec3 c = texture(uInput, s).rgb;
  float moved = abs(st) > .5 ? 1. : 0.;
  c = mix(c, c.gbr, moved * p_colour * (.5 + .5 * hash12(id + 1.)));
  float e = min(min(f.x, 1. - f.x) * aspect() / p_cols, min(f.y, 1. - f.y) / p_rows);
  c *= 1. - moved * p_edge * .5 * (1. - smoothstep(0., .0035, e));
  return vec4(c, 1.);
}` });

/* ---- Reflection ---- */
FX.register({ id:'fx-reflection', name:'Reflection', cat:'fx', nonLocal:true, search:['water', 'mirror', 'floor', 'horizon', 'gloss', 'ripple'],
  desc:'Mirrors the top of the frame into a wet or glossy floor below a horizon line, with ripples, blur and a fade into the floor colour.',
  params:[ R('horizon','Horizon',.66,.15,.9), R('strength','Strength',.85,0,1), R('ripple','Ripple',.5,0,1.5), R('blur','Blur',.4,0,1), R('fade','Fade',.55,0,1), I('waves','Ripples per loop',2,1,4), C('floor','Floor colour','#0d1418','ground') ],
  fs:`vec4 fx(vec2 uv){
  float h = 1. - p_horizon;
  vec3 c = texture(uInput, uv).rgb;
  if (uv.y > h) return vec4(c, 1.);
  float d = h - uv.y;
  float ph = uLoop * TAU * p_waves;
  float rip = sin(uv.y * 90. + ph) * .5 + sin(uv.y * 37. - ph * 1.);
  float ox = rip * p_ripple * .004 * (.2 + d * 3.) * (.6 + .8 * vnoise(vec2(uv.y * 40., uv.x * 3.)));
  vec3 acc = vec3(0.);
  float bl = p_blur * d * .12;
  for (int i = 0; i < 8; i++){
    float t = float(i) / 7. - .5;
    vec2 s = vec2(uv.x + ox, h + d + t * bl);
    acc += texture(uInput, mirrorUv(s)).rgb;
  }
  vec3 r = acc / 8.;
  r = mix(r, p_floor, clamp(p_fade * (.2 + d * 1.8), 0., 1.));
  vec3 o = mix(mix(c, p_floor, .5 * p_fade), r, p_strength);
  float line = exp(-pow(d / .002, 2.)) * .25;
  return vec4(clamp(o + line, 0., 1.), 1.);
}` });
