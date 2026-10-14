/* ---------------- Transitions: matter ----------------
   A becomes B by way of a material doing what it does: liquid metal pooling,
   ferrofluid in a field, metal heating and cooling, oil thinning on water,
   rust, gold leaf, sand, charcoal, fogged glass, wet paint, wax and bleach.
   Most of them read the tones of A and B, so every pair of pictures moves
   differently. Each is a pure function of uv and uProgress; small fixed loops. */

FX.register({ id:'tr-mercury-pool', name:'Mercury pool', cat:'transition', family:'matter', nonLocal:true,
  search:['liquid metal', 'chrome', 'quicksilver', 'mirror', 'flood', 'droplets', 'beads'],
  desc:'Liquid metal floods the low, dark ground of A first, mirrors B in its surface, then beads up and rolls off B.',
  params:[ R('bead','Bead size',.13,.04,.25), R('warp','Reflection warp',.06,0,.15), C('tint','Metal tint','#d3d8df',false), R('shine','Highlight',.8,0,1.5), R('relief','Pool relief',.5,0,1) ],
  fs:`float mp_h(vec2 uv){
  vec2 r = vec2(3.) / uRes;
  return (luma(texture(uA, uv).rgb) * 2. + luma(texture(uA, uv + vec2(r.x, 0.)).rgb) + luma(texture(uA, uv - vec2(r.x, 0.)).rgb)
    + luma(texture(uA, uv + vec2(0., r.y)).rgb) + luma(texture(uA, uv - vec2(0., r.y)).rgb)) / 6.;
}
/* signed distance to the beads, in cell units: smooth union of shrinking discs */
float mp_beads(vec2 c, float s, float q2){
  vec2 q = c / s, i = floor(q), f = fract(q);
  float d = 1e3;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 o = vec2(float(x), float(y));
    vec2 pt = o + .5 + (hash22(i + o) - .5) * .8;
    float lb = luma(texture(uB, uncentered((i + pt) * s)).rgb);
    float t = clamp(q2 * 1.45 - lb * .35 - hash12(i + o + 9.) * .1, 0., 1.);
    float r = mix(.85, 0., t * t * (3. - 2. * t)) * (.75 + .25 * hash12(i + o + 3.));
    float dd = length(f - pt) - r;
    float k = .12;
    float hh = clamp(.5 + .5 * (d - dd) / k, 0., 1.);
    d = mix(d, dd, hh) - k * hh * (1. - hh);
  }
  /* the unbroken sheet tears open in patches before the beads separate */
  float sh = q2 / .3 - .15 - vnoise(q * .6 + 7.) * .9;
  float hh = clamp(.5 + .5 * (d - sh) / .3, 0., 1.);
  return mix(d, sh, hh) - .3 * hh * (1. - hh);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  vec2 c = centered(uv);
  float aa = 1.5 / uRes.y;
  float cover; vec3 n; vec3 under;
  if (p < .5){
    /* phase one: a level rises over A's tones read as height, dark ground first */
    float h = mp_h(uv) + (fbm(c * 6.) - .5) * .08;
    float L = mix(-.06, 1.1, clamp(p / .47, 0., 1.));
    float depth = L - h;
    cover = smoothstep(-aa * 6., aa * 6., depth);
    vec2 e = vec2(4.) / uRes;
    vec2 g = vec2(mp_h(uv + vec2(e.x, 0.)) - mp_h(uv - vec2(e.x, 0.)), mp_h(uv + vec2(0., e.y)) - mp_h(uv - vec2(0., e.y)));
    /* the meniscus curls down to meet the ground; deep pools are flatter */
    float lip = exp(-max(depth, 0.) * 22.);
    n = normalize(vec3(-g * (8. + 30. * lip) * p_relief - normalize(g + 1e-5) * lip * .9, 1.));
    under = A;
  } else {
    /* phase two: surface tension pulls the sheet into beads that shrink away, B's bright ground last */
    float s = max(p_bead, .01), q2 = (p - .5) / .5;
    float d = mp_beads(c, s, q2);
    float st = .012;
    float dx = mp_beads(c + vec2(st * s, 0.), s, q2) - d, dy = mp_beads(c + vec2(0., st * s), s, q2) - d;
    cover = 1. - smoothstep(-aa / s * 1.5, aa / s * 1.5, d);
    /* a dome profile over the distance field gives each bead its rounded top */
    float hd = max(-d, 0.);
    float slope = min(.9 / sqrt(hd * 3. + .05), 3.) * (1. - smoothstep(.12, .7, hd));
    n = normalize(vec3(vec2(dx, dy) / st * slope, 1.));
    under = B;
  }
  /* chrome: a bright overhead and a dark floor with a sharp horizon, mixed with a warped mirror of B */
  vec3 refl = texture(uB, uv + n.xy * p_warp).rgb;
  float env = mix(.2, .97, smoothstep(-.75, .45, n.y + (luma(refl) - .5) * .3)) * (.55 + .45 * n.z);
  vec3 metal = p_tint * mix(vec3(env), refl * 1.05, .5);
  vec3 L = normalize(vec3(-.5, .6, .65));
  float spec = pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 60.);
  metal += spec * p_shine;
  return vec4(clamp(mix(under, metal, cover), 0., 1.), 1.);
}` });

FX.register({ id:'tr-ferrofluid', name:'Ferrofluid', cat:'transition', family:'matter', nonLocal:true,
  search:['magnet', 'magnetic', 'spikes', 'black liquid', 'gloss', 'oil', 'field'],
  desc:'Black magnetic fluid gathers on the bright areas first and rises into a field of spikes that draws the picture in relief, then drains to show B.',
  params:[ R('spacing','Spike spacing',.05,.02,.1), R('height','Spike height',1,0,1.6), R('gloss','Gloss',.9,0,1.5), C('fluid','Fluid colour','#0b0b0d',false), R('mirror','Picks up the picture',.6,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  vec2 c = centered(uv);
  float F = smoothstep(0., .42, p) * (1. - smoothstep(.56, .9, p));
  float sw = smoothstep(.4, .6, p);
  /* hex lattice: nearest spike centre */
  float s = max(p_spacing, .005);
  vec2 q = c / s;
  vec2 r = vec2(1., 1.7320508), h = r * .5;
  vec2 a = mod(q, r) - h, b = mod(q - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 cuv = uncentered((q - g) * s);
  float field = mix(luma(texture(uA, cuv).rgb), luma(texture(uB, cuv).rgb), sw);
  float fieldHere = mix(luma(A), luma(B), sw);
  /* the fluid comes to the bright (strong-field) areas first and leaves them last */
  float lead = F * 1.4 - (1. - fieldHere) * .9 + (fbm(c * 5. + 2.) - .5) * .2;
  float cover = smoothstep(0., .04, lead);
  float grow = smoothstep(.05, .45, lead);
  /* spike height follows the field, so the picture reads as a relief of spikes */
  float fs_ = smoothstep(.12, .8, field);
  float H = p_height * grow * (.04 + 1.3 * fs_ * fs_);
  float dn = length(g) / .58;
  float prof = max(1. - dn, 0.);
  vec2 dir = g / max(length(g), 1e-4);
  float slope = H * 2.4 * pow(prof, .5) * step(dn, 1.);
  vec3 n = normalize(vec3(dir * slope, 1.));
  float rim = 1. - smoothstep(0., .08, lead);
  vec2 lg = vec2(dFdx(lead), dFdy(lead));
  n = normalize(n + vec3(-lg / max(length(lg), 1e-6) * rim * 1.2, 0.));
  /* two soft studio lights and a mirrored picture on the steep flanks */
  vec3 V = vec3(0., 0., 1.);
  vec3 L1 = normalize(vec3(-.5, .7, .6)), L2 = normalize(vec3(.75, -.25, .55));
  float sp = pow(max(dot(reflect(-L1, n), V), 0.), 24.) * .9 + pow(max(dot(reflect(-L2, n), V), 0.), 16.) * .35;
  float fres = pow(1. - n.z, 1.5);
  vec3 envS = texture(uB, uv + n.xy * .08).rgb * (1. - sw) + texture(uA, uv + n.xy * .08).rgb * sw;
  vec3 col = p_fluid + envS * (.22 + .6 * fres) * p_mirror + sp * p_gloss * vec3(.92, .95, 1.);
  vec3 under = mix(A, B, sw);
  return vec4(clamp(mix(under, col, cover), 0., 1.), 1.);
}` });

FX.register({ id:'tr-incandescent', name:'Incandescence', cat:'transition', family:'matter', nonLocal:true,
  search:['heat', 'glow', 'forge', 'ember', 'molten', 'blackbody', 'hot metal', 'combustion', 'fire'],
  desc:'A heats until it glows, its brightest parts first, holds as an ember picture, then cools into B with B’s darkest parts cooling first.',
  params:[ R('peak','Peak heat',.72,.4,1), R('glow','Glow',1,0,1.6), R('bloom','Bloom',.5,0,1), R('scale','Scale on the surface',.3,0,1), R('order','Tone order',.7,0,1) ],
  fs:`vec3 inc_bb(float t){
  t = clamp(t, 0., 1.);
  return vec3(smoothstep(.02, .42, t), pow(smoothstep(.22, .82, t), 1.4) * .92, smoothstep(.62, 1., t) * .85);
}
float inc_heat(vec2 uv, float p){
  float k = p_order;
  if (p < .5){
    float q = p / .5;
    float l = luma(texture(uA, uv).rgb);
    float on = clamp(q * (1. + k) - (1. - l) * k, 0., 1.);
    return on * on * (3. - 2. * on) * p_peak * (.18 + .82 * l * l);
  }
  float q = (p - .5) / .5;
  float lb = luma(texture(uB, uv).rgb), la = luma(texture(uA, uv).rgb);
  float l = mix(la, lb, smoothstep(0., .35, q));
  float off = clamp(q * (1. + k) - lb * k, 0., 1.);
  return (1. - off * off * (3. - 2. * off)) * p_peak * (.18 + .82 * l * l);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  vec2 c = centered(uv);
  float T = inc_heat(uv, p);
  /* oxide scale breaks up the glow the way it does on forged metal */
  float sc = fbm(c * 34. + 3.);
  T *= 1. - p_scale * .45 * smoothstep(.45, .75, sc) * smoothstep(.0, .3, T);
  float halo = 0.;
  for (int i = 0; i < 8; i++){
    float ang = float(i) * .785398 + .3;
    vec2 o = vec2(cos(ang), sin(ang)) * .025 / vec2(aspect(), 1.);
    halo += inc_heat(uv + o, p);
  }
  halo /= 8.;
  vec3 base = p < .5 ? A : B;
  float hot = smoothstep(0., .3, T);
  vec3 col = base * (1. - hot * .92);
  col += inc_bb(T) * p_glow * (.35 + .65 * hot);
  col += inc_bb(halo * .8) * p_bloom * .45 * halo;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-oil-slick', name:'Oil slick', cat:'transition', family:'matter', nonLocal:true,
  search:['thin film', 'interference', 'iridescent', 'petrol', 'rainbow', 'puddle', 'anodised', 'spill'],
  desc:'A drop of oil spreads over A, its colour fringes travelling outwards as the film thins, and B lies under it once it has gone clear.',
  params:[ R('x','Drop X',.5,0,1), R('y','Drop Y',.42,0,1), R('order','Fringe orders',3.2,1,8), R('follow','Follows the picture',.5,0,1), R('strength','Film strength',.7,0,1), R('swirl','Swirl',.5,0,1) ],
  fs:`vec3 oil_film(float d){
  /* thin-film interference for red, green and blue: d is optical thickness in ~micrometres */
  vec3 lam = vec3(.65, .532, .45);
  return .5 - .5 * cos(TAU * 2. * d / lam);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  float ar = aspect();
  vec2 c = centered(uv), o = centered(vec2(p_x, p_y));
  vec2 w = vec2(fbm(c * 3. + 1.), fbm(c * 3. + 7.)) - .5;
  float r = length(c - o + w * .12 * p_swirl);
  float far = length(vec2(ar * .5, .5) + abs(o)) + .15;
  float R = far * pow(smoothstep(0., .62, p), .7);
  float edgeN = (fbm(vec2(atan(c.y - o.y, c.x - o.x) * 2., p * 2.)) - .5) * .08;
  float inside = 1. - smoothstep(-.004, .004, r - R - edgeN * R);
  float q = clamp((p - .05) / .95, 0., 1.);
  float L = mix(luma(A), luma(B), smoothstep(.3, .7, p));
  float swirl = fbm(c * 4. + w * 2. * p_swirl + p * .6);
  float th = (1. - q) * (1. - q) * p_order * .55 * (1.15 - .6 * clamp(r / max(R, 1e-3), 0., 1.));
  th *= mix(1., .55 + .9 * L, p_follow) * (.75 + .5 * swirl);
  /* a thicker lip where the spreading edge gathers oil */
  float lip = exp(-abs(r - R) * 70.) * (1. - q);
  th += lip * .25;
  vec3 fr = oil_film(th);
  float s = smoothstep(.03, .22, th) * inside * p_strength;
  /* oil darkens what is under it and reflects its own fringes on top */
  vec3 col = mix(B, B * .4 + fr * (.25 + .35 * luma(B)) + fr * fr * .18, s);
  col += lip * .2 * inside;
  return vec4(clamp(mix(A, col, inside), 0., 1.), 1.);
}` });

FX.register({ id:'tr-rust-bloom', name:'Rust bloom', cat:'transition', family:'matter', nonLocal:true,
  search:['corrosion', 'oxidise', 'patina', 'verdigris', 'decay', 'weathered', 'metal', 'age'],
  desc:'Corrosion starts in the dark crevices of A and blooms across it, then eats through in holes where B shows.',
  params:[ S('metal','Corrosion',['Rust','Verdigris'],0), R('grain','Grain',.6,0,1), R('pits','Pit scale',7,2,16), R('hole','Hole edge',.5,0,1), R('keep','Keeps A’s tones',.65,0,1) ],
  fs:`vec3 rb_ramp(float t, int m){
  t = clamp(t, 0., 1.);
  vec3 a, b, c, d;
  if (m == 0){ a = vec3(.13, .06, .035); b = vec3(.36, .14, .06); c = vec3(.62, .27, .1); d = vec3(.8, .48, .2); }
  else { a = vec3(.1, .2, .17); b = vec3(.2, .42, .36); c = vec3(.38, .64, .54); d = vec3(.66, .84, .74); }
  return t < .33 ? mix(a, b, t / .33) : t < .66 ? mix(b, c, (t - .33) / .33) : mix(c, d, (t - .66) / .34);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  int m = int(p_metal + .5);
  vec2 c = centered(uv);
  float la = luma(A);
  /* corrosion order: noise for pitting, A's darkness for crevices */
  float K = fbm(c * p_pits) * .6 + la * .45 + (vnoise(c * p_pits * 5.) - .5) * .12;
  float lev = mix(-.05, 1.08, clamp(p / .55, 0., 1.));
  float rust = smoothstep(lev, lev - .06, K);
  float front = exp(-abs(K - lev) * 45.) * step(p, .55);
  float gr = vnoise(c * 260.) * .5 + vnoise(c * 90. + 4.) * .5;
  float t = mix(.5, gr, p_grain) * .7 + (lev - K) * .6;
  vec3 cr = rb_ramp(t, m);
  cr = mix(cr, cr * (.35 + 1.3 * la), p_keep);
  cr *= 1. - .35 * smoothstep(.62, .8, vnoise(c * p_pits * 9. + 1.));
  vec3 col = mix(A, cr, rust);
  col *= 1. - front * .45;
  /* holes eat through where B is brightest, with a scorched oxide ring */
  float lb = luma(B);
  float Hf = fbm(c * p_pits * .8 + 11.) * .7 + (1. - lb) * .35 + (vnoise(c * 60.) - .5) * .1 * p_hole;
  float hl = mix(-.05, 1.1, smoothstep(.45, .97, p));
  float hole = smoothstep(hl, hl - .015, Hf);
  float ring = smoothstep(hl + .06 * (.3 + p_hole), hl, Hf) * (1. - hole);
  col = mix(col, rb_ramp(.05, m) * .6, ring * .8);
  col = mix(col, B, hole);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-gold-leaf', name:'Gold leaf', cat:'transition', family:'matter', nonLocal:true,
  search:['gilding', 'gilt', 'metallic', 'foil', 'luxury', 'leaf', 'burnish', 'shine'],
  desc:'Sheets of gold leaf are laid over A one by one, pressed with its relief, then rubbed through to B, darkest parts first.',
  params:[ R('size','Leaf size',.14,.06,.35), C('gold','Gold','#d4a548',false), R('crinkle','Crinkle',.5,0,1), R('relief','Relief',.6,0,1), R('angle','Rubbing angle',20,-90,90) ],
  fs:`float gld_ridge(vec2 q){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a * abs(vnoise(q) * 2. - 1.); q = q * 2.1 + 5.3; a *= .5; } return v; }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  vec2 c = centered(uv);
  float s = p_size;
  vec2 q = c / s, i = floor(q);
  float lay = -1., seam = 1e3; vec2 lc = vec2(0.);
  /* the topmost leaf laid so far wins; leaves overlap their neighbours a little */
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 id = i + vec2(float(x), float(y));
    float t = hash12(id + 2.) * .4 + .02;
    if (t > p) continue;
    float k = clamp((p - t) / .05, 0., 1.);
    vec2 jit = (hash22(id) - .5) * .12;
    vec2 lp = rot((hash12(id + 7.) - .5) * .12) * (q - id - .5 - jit) * mix(.9, 1., k);
    float d = sdRoundBox(lp, vec2(.56), .01);
    if (d < 0. && t > lay){ lay = t; seam = -d; lc = lp; }
  }
  if (lay < 0.) return vec4(A, 1.);
  vec2 e = vec2(2.) / uRes;
  float gx = luma(texture(uA, uv + vec2(e.x, 0.)).rgb) - luma(texture(uA, uv - vec2(e.x, 0.)).rgb);
  float gy = luma(texture(uA, uv + vec2(0., e.y)).rgb) - luma(texture(uA, uv - vec2(0., e.y)).rgb);
  float cr = gld_ridge(lc * 3. + lay * 40.) + gld_ridge(c * 30.) * .4;
  vec2 cn = vec2(dFdx(cr), dFdy(cr)) * uRes.y * .0025;
  vec3 n = normalize(vec3(-vec2(gx, gy) * 9. * p_relief - cn * p_crinkle * 1.4, 1.));
  vec3 L = normalize(vec3(-.4, .55, .7));
  float dif = .55 + .55 * dot(n, L);
  float spec = pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 18.);
  float la = luma(A);
  vec3 gold = p_gold * (.3 + .75 * dif) * (.5 + .75 * la) + spec * mix(p_gold, vec3(1.), .5) * .9;
  gold *= 1. - .35 * (1. - smoothstep(0., .03, seam));
  /* rubbing through: B's dark areas first, along the rubbing direction */
  vec2 rd = rot(radians(p_angle)) * c;
  float streak = vnoise(vec2(rd.x * 1.5, rd.y * 22.)) * .7 + vnoise(vec2(rd.x * 4., rd.y * 70.)) * .3;
  float lb = luma(B);
  float W = lb * .6 + streak * .4;
  float rl = mix(-.05, 1.08, smoothstep(.45, .97, p));
  float worn = smoothstep(rl, rl - .05, W);
  float burn = smoothstep(rl + .08, rl, W) * (1. - worn);
  gold += burn * .25 * mix(p_gold, vec3(1.), .6);
  return vec4(clamp(mix(gold, B, worn), 0., 1.), 1.);
}` });

FX.register({ id:'tr-wind-ripple', name:'Wind ripples', cat:'transition', family:'matter', nonLocal:true,
  search:['sand', 'dunes', 'desert', 'wind', 'drift', 'ripples', 'beach', 'aeolian'],
  desc:'Wind combs A into sand ripples that march downwind and bend around its shapes, and B settles into the troughs until the ripples flatten.',
  params:[ R('angle','Wind angle',75,-90,90), R('wave','Ripple spacing',.05,.015,.12), R('height','Ripple height',.8,0,1.5), R('bend','Bends around the picture',.6,0,1.5), R('grain','Grain',.4,0,1), C('sand','Sand','#d6b88c',false), R('sandy','Sand colour',.5,0,1) ],
  fs:`float wr_h(vec2 c, float p, float bendL){
  vec2 r = rot(radians(p_angle)) * c;
  float ph = r.x / max(p_wave, .004) + bendL * p_bend * 3. + (fbm(r * vec2(.9, 1.4) + 3.) - .5) * 2.4;
  ph -= p * 4.;
  float f = fract(ph);
  /* gentle windward slope, steep lee face */
  return f < .78 ? f / .78 : 1. - (f - .78) / .22;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  vec2 c = centered(uv);
  float amp = pow(sin(PI * p), .8) * p_height;
  float bendL = mix(luma(A), luma(B), smoothstep(.3, .7, p));
  float h = wr_h(c, p, bendL);
  vec2 wd = rot(-radians(p_angle)) * vec2(1., 0.);
  vec2 ofs = wd * (h - .5) * .012 * amp / vec2(aspect(), 1.);
  vec3 a = texture(uA, uv + ofs).rgb, b = texture(uB, uv + ofs).rgb;
  /* troughs fill with B first; the fill level rises until the ripples are buried */
  float lev = smoothstep(.12, .9, p) * 1.25 - .1;
  float fill = smoothstep(lev + .04, lev - .04, h + (vnoise(c * 80.) - .5) * .1);
  vec3 col = mix(a, b, fill);
  float sl = (h - wr_h(c - wd * .002, p, bendL)) * 3.;
  float shade = clamp(sl, -1., 1.);
  float lee = smoothstep(.0, .3, -sl);
  col *= 1. + amp * (.25 * shade - .25 * lee);
  float g = hash12(floor(uv * uRes / max(uPx, 1.)));
  col += (g - .5) * .14 * p_grain * amp;
  col = mix(col, p_sand * (.45 + .75 * luma(col)), amp * p_sandy);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-charcoal-rubbing', name:'Charcoal rubbing', cat:'transition', family:'matter', nonLocal:true,
  search:['frottage', 'rubbing', 'graphite', 'pencil', 'paper', 'drawing', 'texture', 'tracing'],
  desc:'A sheet of paper goes over A and charcoal is rubbed across it, picking up B’s relief, then the paper is lifted away.',
  params:[ R('angle','Stroke angle',35,-90,90), R('width','Stroke width',.16,.05,.35), C('paper','Paper','#ece7dc',false), C('charcoal','Charcoal','#1f1e1d',false), R('tooth','Paper tooth',.6,0,1) ],
  fs:`float cr_l(vec2 uv){ return luma(texture(uB, uv).rgb); }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  vec2 c = centered(uv);
  float ar = aspect();
  /* paper lays over A, still faintly showing it through */
  float lay = smoothstep(.0, .18, p);
  vec3 paper = p_paper * (.9 + .12 * luma(A));
  /* rubbing: broad strokes sweep back and forth, each one a band along the stroke angle */
  vec2 r = rot(radians(p_angle)) * c;
  float wdt = max(p_width, .01);
  float band = floor(r.y / wdt), bv = fract(r.y / wdt);
  float span = ar * .7 + .7;
  float t0 = .12 + hash12(vec2(band, 3.)) * .26;
  float dirn = mod(band, 2.) < 1. ? 1. : -1.;
  float along = (r.x * dirn + span * .5) / span;
  float head = (p - t0) / .22;
  float pass = smoothstep(along - .15, along + .02, head) * smoothstep(-.02, .1, bv) * smoothstep(1.02, .9, bv);
  /* later passes build the tone up evenly */
  float build = smoothstep(.38, .72, p);
  float rub = clamp(pass * .7 + build * .6, 0., 1.);
  /* frottage: B's dark and edged areas stand proud and take the charcoal */
  vec2 e = vec2(1.5) / uRes;
  float lb = cr_l(uv);
  float ed = abs(cr_l(uv + vec2(e.x, 0.)) - cr_l(uv - vec2(e.x, 0.))) + abs(cr_l(uv + vec2(0., e.y)) - cr_l(uv - vec2(0., e.y)));
  float relief = clamp((1. - lb) * 1.05 + ed * 3., 0., 1.);
  vec2 px = uv * uRes / max(uPx, 1.);
  float tooth = mix(.55, vnoise(px * .5) * .65 + vnoise(px * .16) * .35, p_tooth);
  float grain = vnoise(vec2(r.x * 6., r.y * 260.)) * .5 + vnoise(vec2(r.x * 18., r.y * 700.)) * .5;
  /* charcoal catches the paper's tooth first, then fills in where the pressure and relief are high */
  float amt = rub * (.04 + pow(relief, 1.6) * 1.1);
  float ch = smoothstep(.08, .7, amt + (tooth - .5) * .55 + (grain - .5) * .3 * rub);
  vec3 col = mix(A, paper, lay * .92);
  col = mix(col, p_charcoal, ch * .9);
  /* the sheet is peeled up from the bottom edge, with a shadow under the lifting edge */
  float lift = smoothstep(.74, .99, p) * 1.15;
  float y = 1. - uv.y + (vnoise(vec2(uv.x * 4., 1.)) - .5) * .03;
  float off = smoothstep(lift - .004, lift + .004, y);
  float sh = (1. - off) * exp(-abs(y - lift) * 30.) * smoothstep(0., .2, lift);
  vec3 under = B * (1. - .4 * sh);
  return vec4(clamp(mix(under, col, off), 0., 1.), 1.);
}` });

FX.register({ id:'tr-wiped-glass', name:'Wiped glass', cat:'transition', family:'matter', nonLocal:true,
  search:['condensation', 'fog', 'misted', 'steam', 'window', 'breath', 'mirror', 'wipe', 'hand'],
  desc:'Breath fogs the glass over A, then a hand wipes it clear in sweeps, leaving finger streaks, beaded edges and drips, with B behind.',
  params:[ I('sweeps','Sweeps',4,2,7), R('fog','Fog',.85,.2,1), R('streaks','Finger streaks',.5,0,1), R('drips','Drips',.6,0,1), R('blur','Fog blur',.022,0,.04) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  vec2 c = centered(uv);
  float ar = aspect();
  /* breath: fog blooms out from just below the centre */
  float fr = length((c - vec2(0., -.08)) * vec2(.8, 1.)) + (fbm(c * 4.) - .5) * .25;
  float fogOn = smoothstep(fr * .9 - .04, fr * .9 + .02, smoothstep(0., .2, p) * 1.1);
  vec2 rb = vec2(p_blur) / vec2(ar, 1.);
  /* the scene behind changes from A to B while the fog hides it */
  float sw = smoothstep(.13, .23, p);
  vec3 ab = mix(A, B, sw) * .2;
  for (int i = 0; i < 8; i++){
    float an = float(i) * .785398;
    vec2 o = uv + vec2(cos(an), sin(an)) * rb;
    ab += mix(texture(uA, o).rgb, texture(uB, o).rgb, sw) * .1;
  }
  float speck = smoothstep(.6, .95, vnoise(uv * uRes / max(uPx, 1.) * .7)) * .6;
  vec3 fogged = mix(ab, vec3(.86, .88, .9), .55 * p_fog) + speck * .06 * p_fog;
  /* sweeps: bands from top to bottom, alternating direction, along a gently curved path */
  float N = floor(p_sweeps + .5);
  float clear = 0., bead = 0., drip = 0.;
  float bh = 1.3 / N;
  for (int k = 0; k < 7; k++){
    if (float(k) >= N) break;
    float fk = float(k);
    float t0 = .24 + fk / N * .62, dur = .62 / N * 1.2;
    float hd = clamp((p - t0) / dur, 0., 1.);
    if (hd <= 0.) continue;
    float dirn = mod(fk, 2.) < 1. ? 1. : -1.;
    float xn = c.x / ar + .5;
    float xs = dirn > 0. ? xn : 1. - xn;
    float yc = .5 - (fk + .5) / N + .04 * sin(xs * 3.1 + fk * 1.7);
    float dy = c.y - yc;
    float hb = bh * .5;
    float behind = smoothstep(hd * 1.15 - .04, hd * 1.15 - .1, xs);
    float inBand = smoothstep(hb, hb - .012, abs(dy));
    float fing = abs(sin((dy / hb) * 2. * PI + fk));
    float st = 1. - p_streaks * .5 * smoothstep(.9, 1., fing) * (1. - smoothstep(.55, .95, p));
    clear = max(clear, inBand * behind * st);
    bead = max(bead, exp(-abs(abs(dy) - hb) * 420.) * behind * (1. - clear * .7));
    /* drips run down from the lower edge of each sweep, longer the longer ago it was wiped */
    float colm = floor(xn * 40.);
    float hx = hash12(vec2(colm, fk));
    if (hx > 1. - p_drips * .22){
      float age = clamp(p - t0 - xs * dur, 0., 1.);
      float len = age * (.3 + hx * .5);
      float xc = abs(fract(xn * 40.) - .5);
      float yd = (yc - hb) - c.y;
      drip = max(drip, smoothstep(.16, .06, xc) * step(0., yd) * smoothstep(len, len - .01, yd) * behind);
    }
  }
  bead *= 1. - clear;
  drip *= 1. - clear;
  float fade = 1. - smoothstep(.9, 1., p);
  float fogAmt = fogOn * (1. - clear) * fade;
  vec3 base = mix(A, B, sw);
  vec3 col = mix(base, fogged, fogAmt);
  col += vec3(.22) * bead * fogOn * fade;
  col = mix(col, B * 1.06 + .03, drip * fogOn * .85 * fade);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-wet-paint', name:'Wet paint', cat:'transition', family:'matter', nonLocal:true,
  search:['paint', 'gloss', 'drying', 'coat', 'lacquer', 'varnish', 'emulsion', 'brush'],
  desc:'B is brushed on as a wet coat, dark and glossy, then dries patchily to matt, its lightest parts first.',
  params:[ S('dir','Brushed from',['Left','Top','Right','Bottom'],0), R('wet','Wet darkening',.5,0,.8), R('gloss','Gloss',.8,0,1.5), R('brush','Brush marks',.6,0,1), R('patch','Patchy drying',.5,0,1) ],
  fs:`float wp_br(float x, float y, float res){ return vnoise(vec2(x * 3., y * res * .05)) * .6 + vnoise(vec2(x * 7., y * res * .14)) * .4; }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  int dm = int(p_dir + .5);
  float x = dm == 0 ? uv.x : dm == 1 ? 1. - uv.y : dm == 2 ? 1. - uv.x : uv.y;
  float y = dm == 0 || dm == 2 ? uv.y : uv.x;
  float res = (dm == 0 || dm == 2 ? uRes.y : uRes.x) / max(uPx, 1.);
  /* brush marks: streaks along the stroke, with a slope for the light to catch */
  float br = wp_br(x, y, res);
  float st = 2. / res;
  float slope = (wp_br(x, y + st, res) - wp_br(x, y - st, res)) / (2. * st) / res * 3.;
  float front = smoothstep(.02, .55, p) * 1.22 - .1 + (vnoise(vec2(y * 6., 2.)) - .5) * .07 + (br - .5) * .03;
  float coat = smoothstep(front + .006, front - .006, x);
  /* wet edge: a darker bead of paint along the leading edge */
  float edge = exp(-abs(x - front) * 160.) * coat;
  float lb = luma(B);
  float bias = lb * .6 + fbm(uv * vec2(aspect(), 1.) * 3.5 + 3.) * p_patch * .7;
  float s0 = .32 + (1. - clamp(bias, 0., 1.)) * .42;
  float dry = smoothstep(s0, s0 + .24, p);
  float wet = 1. - dry;
  vec3 wb = mix(vec3(lb), B, 1. + .6 * wet);
  wb = clamp(wb, 0., 1.) * (1. - p_wet * wet);
  /* gloss: a broad soft window reflection plus the brush ridges catching it */
  float win = smoothstep(.35, .0, abs(x * .6 - y * .8 + .25 - p * .5)) ;
  float ridge = clamp(slope * p_brush, -1., 1.);
  float spec = win * (.35 + .65 * smoothstep(.0, .8, ridge)) + pow(max(ridge, 0.), 3.) * .25;
  wb += spec * p_gloss * .5 * wet;
  wb *= 1. - edge * .35;
  return vec4(clamp(mix(A, wb, coat), 0., 1.), 1.);
}` });

FX.register({ id:'tr-poured-wax', name:'Poured wax', cat:'transition', family:'matter', nonLocal:true,
  search:['wax', 'candle', 'molten', 'pour', 'viscous', 'resin', 'flow', 'drip'],
  desc:'B is poured down over A as molten wax in rounded tongues, warm and translucent where it is fresh and setting opaque behind.',
  params:[ I('lobes','Tongues',6,2,14), R('clear','Molten clarity',.3,0,1), R('set','Setting distance',.22,.05,.6), C('heat','Molten colour','#f4c27e',false), R('lip','Lip highlight',.7,0,1) ],
  fs:`float pw_front(float x, float p){
  /* viscous tongues: rounded lobes of different lengths, smoothly joined */
  float n = floor(p_lobes + .5);
  float k = x * n, i = floor(k), f = fract(k) - .5;
  float l0 = hash12(vec2(i, 3.)), l1 = hash12(vec2(i + 1., 3.)), lm = hash12(vec2(i - 1., 3.));
  float lob = l0 - f * f * 1.6;
  lob = max(lob, mix(lm, l1, step(0., f)) - (.5 - abs(f)) * (.5 - abs(f)) * 1.6 - .25);
  float amp = .16 * smoothstep(0., .25, p) * (1. - smoothstep(.7, .92, p));
  return smoothstep(0., .86, p) * 1.32 - .16 + (lob - .5) * amp;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  float x = uv.x, d = 1. - uv.y;
  float f = pw_front(x, p);
  float aa = 1.5 / uRes.y;
  float behind = f - d;
  float cover = smoothstep(-aa, aa, behind);
  /* rounded lip: a cylinder profile over the last stretch of the flow */
  float lt = clamp(behind / .05, 0., 1.);
  float slope = sqrt(max(1. - lt, 0.)) * 1.8;
  float df = (pw_front(x + .002, p) - pw_front(x - .002, p)) / .004;
  vec2 nd = normalize(vec2(-df * aspect(), 1.));
  vec3 n = normalize(vec3(nd * slope, 1.));
  vec3 under = texture(uA, uv - n.xy * .025 * vec2(1. / aspect(), 1.)).rgb;
  float set_ = max(clamp(behind / max(p_set, .01), 0., 1.), smoothstep(.82, 1., p));
  float op = mix(1. - p_clear, 1., set_ * set_);
  vec3 molten = mix(under, B, op);
  float warm = (1. - set_) * (1. - smoothstep(.85, 1., p));
  molten = mix(molten, molten * p_heat * 1.2 + p_heat * .08, warm * .6);
  vec3 L = normalize(vec3(-.3, .75, .6));
  molten *= mix(1., .7 + .45 * dot(n, L), 1. - smoothstep(.85, 1., p));
  float spec = pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 24.) * (1. - lt * lt);
  molten += spec * p_lip * .7 * (1. - smoothstep(.85, 1., p));
  /* a soft shadow just ahead of the flow */
  vec3 ahead = A * (1. - .3 * exp(-max(-behind, 0.) * 90.));
  return vec4(clamp(mix(ahead, molten, cover), 0., 1.), 1.);
}` });

FX.register({ id:'tr-bleach-out', name:'Bleach', cat:'transition', family:'matter', nonLocal:true,
  search:['bleach', 'chemical', 'denim', 'stain', 'splash', 'discharge', 'fade', 'lift'],
  desc:'Bleach spatters across A and its darks lift through rust to cream as the spots spread, then B develops out of the pale, darks first.',
  params:[ I('spots','Spots',10,3,24), R('spread','Spread',.6,.2,1), C('rust','Lifted colour','#b8642e',false), C('pale','Pale','#efe6d6',false), R('ring','Spot rings',.6,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  vec2 c = centered(uv);
  float ar = aspect();
  float E = 0., rim = 0.;
  /* ragged spot edges: the liquid wicks unevenly through the fibres */
  float wob = (fbm(c * 14.) - .5) * .07 + (vnoise(c * 60.) - .5) * .015;
  for (int i = 0; i < 24; i++){
    if (float(i) >= p_spots) break;
    vec2 o = (hash22(vec2(float(i), 4.1)) - .5) * vec2(ar, 1.) * .95;
    float t = hash12(vec2(float(i), 9.3)) * .3;
    float age = max(p - t, 0.);
    float R = p_spread * .6 * sqrt(age) * (.6 + .6 * hash12(vec2(float(i), 2.)));
    float d = length(c - o) + wob;
    float inside = smoothstep(R, R - .006, d) * step(1e-4, age);
    E = max(E, inside * clamp(age * 4. - (d / max(R, 1e-3)) * .5, 0., 1.));
    rim = max(rim, exp(-abs(d - R) * 140.) * step(1e-4, age) * step(d, R + .01));
  }
  /* the whole surface catches up so the end is clean */
  float all_ = smoothstep(.3, .62, p);
  E = max(E, all_ * smoothstep(-.2, .2, fbm(c * 3. + 1.) - (1. - all_ * 1.3)));
  float la = luma(A);
  /* darks lift furthest: they pass through the rust colour before reaching pale */
  float e1 = smoothstep(0., .45, E) * (1. - la * .4);
  float e2 = smoothstep(.4, 1., E);
  vec3 col = mix(A, p_rust * (.45 + .8 * la), e1 * .9);
  col = mix(col, p_pale * (.86 + .18 * la), e2);
  col = mix(col, p_rust * .7, rim * p_ring * .55 * (1. - all_));
  /* B's darks develop first, the way a print comes up in the tray */
  float dev = smoothstep(.5, .95, p);
  float key = luma(B) * .65 + fbm(c * 5. + 2.) * .35;
  float dn = smoothstep(key - .05, key + .12, dev * 1.15);
  col = mix(col, B, max(dn, smoothstep(.95, 1., p)));
  return vec4(clamp(col, 0., 1.), 1.);
}` });
