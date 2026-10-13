/* ---------------- Transitions: physics ---------------- */
/* Physics and optics handovers. Every one is a pure function of uv and uProgress:
   distortions and light are scaled by an envelope that is zero at p = 0 and p = 1,
   and masks run from fully closed to fully open, so cuts on either side are clean. */

/* ---- Lens pass ---- */
FX.register({ id:'tr-lens-swell', name:'Lens swell', cat:'transition', nonLocal:true, search:['magnify', 'loupe', 'magnifying glass', 'refraction', 'glass ball'],
  desc:'A glass lens drifts across A showing B magnified through it, then swells until B is all that is left.',
  params:[ R('size','Lens size',.24,.05,.5), R('mag','Magnification',1.6,1,3), R('refract','Dome bend',.35,0,1), R('disp','Colour fringe',.012,0,.05,.001), R('angle','Path angle',20,0,360,1), R('rim','Rim light',.4,0,1) ],
  fs:`vec3 lenspass_b(vec2 uv){ return texture(uB, mirrorUv(uv)).rgb; }
vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  vec2 dir = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  float ext = abs(dir.x) * asp * .5 + abs(dir.y) * .5;
  vec2 c = mix(-dir * (ext + p_size + .06), vec2(0.), smoothstep(0., .62, p));
  float grow = smoothstep(.45, 1., p);
  float R = p_size + grow * grow * 1.3;
  float k = 1. - grow;
  vec2 q = centered(uv) - c;
  float d = length(q) / R;
  vec3 A = texture(uA, uv).rgb;
  if (d >= 1.){
    /* soft contact shadow just outside the glass */
    float sh = exp(-(d - 1.) * 14.) * .35 * k * smoothstep(0., .1, p);
    return vec4(A * (1. - sh), 1.);
  }
  float z = sqrt(1. - d * d);
  float m = mix(p_mag, 1., smoothstep(.3, 1., p));
  vec2 lq = q / m + q * (1. - z) * p_refract * k;
  vec2 fr = normalize(q + 1e-5) * p_disp * (1. - z) * k * 4.;
  vec2 cuv = uncentered(c + lq);
  vec3 B = vec3(lenspass_b(cuv + fr / vec2(asp, 1.)).r, lenspass_b(cuv).g, lenspass_b(cuv - fr / vec2(asp, 1.)).b);
  float rim = pow(1. - z, 6.) * p_rim * k;
  float spec = pow(max(0., dot(normalize(vec3(q / R, z)), normalize(vec3(-.4, .5, 1.)))), 40.) * p_rim * k;
  B = B * (1. - .25 * pow(1. - z, 3.) * k) + rim * .8 + spec * .6;
  /* a hairline edge keeps the glass round against busy pictures */
  float edge = smoothstep(.985, 1., d) * k;
  return vec4(clamp(mix(B, A * .7, edge), 0., 1.), 1.);
}` });

/* ---- Event horizon ---- */
FX.register({ id:'tr-event-horizon', name:'Event horizon', cat:'transition', nonLocal:true, search:['black hole', 'gravity', 'gravitational lens', 'einstein ring', 'space'],
  desc:'A small black hole passes through and bends A into a bright ring, and B is waiting on the other side of the horizon.',
  params:[ R('mass','Mass',.04,.005,.15,.001), R('x','Centre X',.5,0,1), R('y','Centre Y',.5,0,1), R('drift','Drift',.2,0,.5), R('glow','Ring glow',.3,0,1), R('soft','Horizon softness',.01,0,.05,.001) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  vec2 c = centered(vec2(p_x, p_y)) + vec2(p_drift * (.5 - p) * .6, p_drift * (p - .5) * .2);
  vec2 d = centered(uv) - c;
  float r2 = dot(d, d), r = sqrt(r2);
  float M = p_mass * smoothstep(0., .5, p) * (1. + 2.5 * smoothstep(.5, 1., p));
  float swallow = smoothstep(.5, 1., p);
  float rh = .55 * sqrt(M) + swallow * swallow * 1.1;
  vec2 dA = uncentered(c + d - M * d / (r2 + 1e-4));
  vec3 A = texture(uA, mirrorUv(dA)).rgb;
  float bell = sin(PI * p);
  /* Einstein ring: brightest where the deflection maps back onto the hole */
  float er = sqrt(M);
  A += p_glow * bell * exp(-pow((r - er) / (er * .12 + .003), 2.)) * vec3(1., .92, .8);
  vec2 dB = uncentered(c + d + M * d / (r2 + 1e-4) * (1. - p) * .5);
  vec3 B = texture(uB, mirrorUv(dB)).rgb;
  float sw = max(p_soft, .0015);
  /* a dark lip just inside the horizon, fading as B lands */
  float inside = rh - r;
  B *= mix(1., smoothstep(0., rh * .35 + .001, inside), 1. - swallow);
  float m = smoothstep(-sw, sw, inside - sw);
  return vec4(clamp(mix(A, B, m), 0., 1.), 1.);
}` });

/* ---- Caustic reveal ---- */
FX.register({ id:'tr-caustic', name:'Caustic reveal', cat:'transition', search:['water', 'pool', 'dappled light', 'ripple light', 'swimming pool'],
  desc:'Light through rippling water plays over A, and B appears where the light pools brightest.',
  params:[ R('scale','Scale',6,1,12), R('light','Light',.35,0,1.5), R('drift','Drift speed',.3,0,2), R('soft','Edge softness',.14,.01,.3), C('color','Light colour','#cff4ff',false) ],
  fs:`/* pool caustics: the bright web is where a warped cell pattern's edges meet, two layers multiplied */
vec2 caustic_cells(vec2 q){
  vec2 cell = floor(q); float f1 = 9., f2 = 9.;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 id = cell + vec2(i, j);
    vec2 s = id + .5 + .4 * sin(hash22(id) * TAU + uTime * p_drift * 1.3 + uProgress * 3.);
    float d = length(q - s);
    if (d < f1){ f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return vec2(f1, f2 - f1);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 q = centered(uv) * p_scale;
  float t = uTime * p_drift + p * 2.;
  q += (vec2(fbm(q * .6 + t * .3), fbm(q * .6 + 5.2 - t * .25)) - .5) * 1.2;
  vec2 c1 = caustic_cells(q), c2 = caustic_cells(q * 1.6 + 3.7);
  float web = pow(1. - smoothstep(0., .3, c1.y), 5.) + .5 * pow(1. - smoothstep(0., .3, c2.y), 5.);
  web = clamp(web, 0., 1.);
  /* light first runs along the web, then pools out across each cell */
  float field = clamp(1. - c1.y * 1.1, 0., 1.) * .8 + .2 * web;
  float s = p_soft;
  float th = mix(1. + s, -s, p);
  float m = smoothstep(th - s, th + s, field);
  float bell = sin(PI * p);
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 col = mix(A, B, m);
  col *= 1. - .18 * bell * (1. - web);
  col += web * bell * p_light * p_color * .55;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Field lines ---- */
FX.register({ id:'tr-field-lines', name:'Field lines', cat:'transition', search:['magnetic', 'dipole', 'flux', 'iron filings', 'streamlines'],
  desc:'B is drawn in along magnetic field lines, which thicken until they meet.',
  params:[ I('count','Line count',24,6,80), S('layout','Layout',['Dipole','Quadrupole','Scattered'],0), R('sep','Charge spacing',.4,.1,.9), R('hair','Hairline',.6,0,1), R('drift','Drift',.05,0,.2,.001), C('color','Line colour','#ffffff',false) ],
  fs:`float field_psi(vec2 c){
  float lay = p_layout, psi = 0.;
  float rr = .5 * p_sep;
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    if (lay < .5 && i > 1) break;
    vec2 pos; float q;
    if (lay < .5){ pos = vec2(fi * 2. - 1., 0.) * rr; q = fi < .5 ? 1. : -1.; }
    else if (lay < 1.5){ float a = fi * PI * .5 + PI * .25; pos = vec2(cos(a), sin(a)) * rr * 1.2; q = mod(fi, 2.) < .5 ? 1. : -1.; }
    else { pos = (hash22(vec2(fi * 7.1, 3.3)) - .5) * vec2(.7, .9) * (.4 + p_sep); q = mod(fi, 2.) < .5 ? 1. : -1.; }
    pos = rot((uProgress - .5) * p_drift * 6.) * pos;
    vec2 d = c - pos;
    psi += q * atan(d.y, d.x) / TAU;
  }
  return psi;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = centered(uv);
  float v = field_psi(c) * floor(p_count + .5);
  float f = fract(v);
  /* distance to the nearest line, measured symmetrically so lines widen both ways */
  float g = abs(f - .5) * 2.;
  float w = clamp(fwidth(v) * 2., .002, .25);
  float e = mix(-w, 1. + w, smoothstep(.08, 1., p));
  float m = 1. - smoothstep(e - w, e + w, g);
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 col = mix(A, B, m);
  /* a fine line traces each field line first, and a soft rim rides the growing front */
  float hair = 1. - smoothstep(0., w * 1.5, g);
  float front = (1. - smoothstep(0., w * 1.6, abs(g - e))) * step(.002, e) * step(e, .98);
  float env = sin(PI * p);
  col = mix(col, p_color, clamp(hair * smoothstep(0., .12, p) * (1. - smoothstep(.3, .6, p)) + front * .5 * env, 0., 1.) * p_hair);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Crystal growth ---- */
FX.register({ id:'tr-crystal-growth', name:'Crystal growth', cat:'transition', search:['voronoi', 'grain', 'mineral', 'crystallise', 'facets', 'nucleation'],
  desc:'B crystallises in grain by grain, each grain growing from its own seed until they lock together.',
  params:[ R('size','Grain size',.12,.03,.4), R('spread','Nucleation spread',.6,0,1), R('tilt','Facet rotation',4,0,20,.1), R('line','Boundaries',.3,0,1), R('tint','Tint',.05,0,.2,.001), R('glint','Growth glint',.5,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = centered(uv) / p_size;
  vec2 cell = floor(c);
  float f1 = 9., f2 = 9.; vec2 s1 = vec2(0.), id1 = vec2(0.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 id = cell + vec2(i, j);
    vec2 s = id + .15 + .7 * hash22(id);
    float d = length(c - s);
    if (d < f1){ f2 = f1; f1 = d; s1 = s; id1 = id; } else if (d < f2) f2 = d;
  }
  float h = hash12(id1 + 13.7);
  float local = clamp((p - h * p_spread) / max(1. - p_spread, .05), 0., 1.);
  float r = local * local * (3. - 2. * local) * 1.6;
  /* each grain grows as a faceted hexagon, turned to its own lattice angle */
  vec2 v = c - s1;
  float ha = hash12(id1 + 7.7) * PI;
  float hx = 0.;
  for (int k = 0; k < 3; k++){ float a = ha + float(k) * PI / 3.; hx = max(hx, abs(dot(v, vec2(cos(a), sin(a))))); }
  float aa = fwidth(hx) * 1.5 + .002;
  float m = smoothstep(hx, hx + aa, r);
  float ease = smoothstep(0., 1., p);
  float ang = radians(p_tilt) * (hash12(id1 + 2.9) - .5) * 2. * (1. - ease);
  vec2 sc = s1 * p_size;
  vec2 bq = uncentered(sc + rot(ang) * (centered(uv) - sc));
  vec3 B = texture(uB, mirrorUv(bq)).rgb;
  float bell = sin(PI * p);
  B *= 1. + (hash12(id1 + 5.1) - .5) * 2. * p_tint * (1. - ease) * 1.5;
  vec3 A = texture(uA, uv).rgb;
  vec3 col = mix(A, B, m);
  float bd = 1. - smoothstep(0., .05, f2 - f1);
  col = mix(col, col * .55, bd * p_line * m * bell);
  /* a thin bright edge on each grain while it is still growing */
  float gl = (1. - smoothstep(0., aa * 1.5, abs(hx - r))) * smoothstep(.15, .4, r) * (1. - local) * step(f1, f2 - .02);
  col += gl * p_glint * .45 * bell;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Heat shimmer ---- */
FX.register({ id:'tr-heat-shimmer', name:'Heat shimmer', cat:'transition', search:['haze', 'mirage', 'heat haze', 'tarmac', 'summer', 'wobble'],
  desc:'The air shimmers like tarmac in summer, and B rises through the haze.',
  params:[ R('amp','Amplitude',.035,0,.08,.001), R('scale','Scale',6,2,20), R('speed','Rise speed',1.5,0,4), R('vert','Verticality',.3,0,1), S('dir','From',['Bottom','Top','Left','Right'],0), R('soft','Gradient width',.3,.05,.6) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  int dr = int(p_dir + .5);
  /* y: 0 at the source edge, 1 at the far edge; x runs along it */
  vec2 l = dr == 0 ? uv : dr == 1 ? vec2(uv.x, 1. - uv.y) : dr == 2 ? vec2(uv.y, uv.x) : vec2(uv.y, 1. - uv.x);
  float bell = sin(PI * p);
  float t = uTime * p_speed + p * 3.;
  vec2 n = vec2(fbm(vec2(l.x * p_scale, l.y * p_scale * .5 - t)), fbm(vec2(l.x * p_scale + 7.3, l.y * p_scale * .5 - t * 1.1))) - .5;
  vec2 off = vec2(p_vert, 1.) * n * p_amp * bell * mix(1.4, .4, l.y) * 2.;
  vec2 lo = l + off;
  vec2 duv = dr == 0 ? lo : dr == 1 ? vec2(lo.x, 1. - lo.y) : dr == 2 ? vec2(lo.y, lo.x) : vec2(1. - lo.y, lo.x);
  float s = p_soft;
  float m = smoothstep(lo.y - s, lo.y + s, p * (1. + 2. * s) - s);
  vec3 A = texture(uA, duv).rgb, B = texture(uB, duv).rgb;
  vec3 col = mix(A, B, m);
  /* a little lift in the band where the air is hottest */
  float band = exp(-pow((lo.y - (p * (1. + 2. * s) - s)) / (s * .9), 2.));
  col = mix(col, col * 1.06 + .03, band * bell * .6);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Soap film ---- */
FX.register({ id:'tr-soap-film', name:'Soap film', cat:'transition', nonLocal:true, search:['bubble', 'iridescent', 'thin film', 'oil slick', 'pop', 'rainbow'],
  desc:'A soap film slides over A in iridescent swirls, thins out and pops, and B is behind it.',
  params:[ R('strength','Film strength',.35,0,1), R('scale','Swirl scale',3,1,8), R('drain','Drain',.5,0,1), R('x','Burst X',.5,0,1), R('y','Burst Y',.68,0,1), R('burst','Burst time',.42,.3,.9) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = centered(uv);
  float t = p * 1.2 + uTime * .04;
  vec2 w = c * p_scale + vec2(0., t);
  w += (vec2(fbm(w * .8 + vec2(0., t * .6)), fbm(w * .8 + 4.7 - t * .3)) - .5) * 2.2;
  /* film drains downward and thins over time, so the bands crowd at the top */
  float h = .3 + .45 * fbm(w) + (uv.y - .5) * p_drain * -.35 - p * .25;
  float bands = h * 7.;
  vec3 irid = .5 + .5 * cos(TAU * (bands * vec3(1., 1.12, 1.27)) + vec3(0., 1.1, 2.2));
  irid = pow(irid, vec3(1.3));
  float q = clamp((p - p_burst) / (1. - p_burst), 0., 1.);
  float rad = pow(q, 1.15) * 1.4;
  vec2 bp = centered(vec2(p_x, p_y));
  float popped = step(.0001, q);
  float dist = length(c - bp) + (fbm(c * 7.) - .5) * .04;
  float hole = smoothstep(rad, rad - .004, dist) * popped;
  float film = p_strength * smoothstep(0., p_burst * .8, p);
  vec3 A = texture(uA, uv + (vec2(fbm(w + 1.3), fbm(w + 8.1)) - .5) * .01 * film).rgb;
  /* the wall reflects colour by interference: screen it over A, with a faint sheen */
  vec3 F = 1. - (1. - A) * (1. - irid * film * .75);
  F = mix(F, F * .92, film * .5);
  F += film * .08 * smoothstep(.55, .85, fbm(w * 2.3));
  vec3 B = texture(uB, uv).rgb;
  vec3 col = mix(F, B, hole);
  /* the bright rim and a few droplets thrown off as the film retracts */
  float rim = exp(-pow((dist - rad) / .0035, 2.)) * popped * (1. - q);
  vec2 g = floor(uv * uRes / 3.);
  float foam = step(.982, hash12(g)) * smoothstep(.07, 0., dist - rad) * step(rad, dist) * popped * (1. - q);
  col += (rim * .8 + foam * .5) * vec3(1.);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Chladni plate ---- */
FX.register({ id:'tr-chladni', name:'Chladni plate', cat:'transition', search:['sand', 'vibration', 'nodal', 'cymatics', 'sound', 'resonance'],
  desc:'B gathers like sand on a vibrating plate, settling into symmetric nodal patterns that thicken until they fill the frame.',
  params:[ I('mode','Start mode',1,1,5), I('steps','Mode steps',3,1,5), R('grain','Grain',.15,0,.5), R('sand','Sand',.6,0,1), S('shape','Plate',['Square','Round'],0), C('color','Sand colour','#efe6d6',false) ],
  fs:`float chladni_f(vec2 x, float n, float m, float round){
  if (round > .5){
    float r = length(x), a = atan(x.y, x.x);
    return cos(n * a) * cos(m * PI * r * .9) * 1.2;
  }
  return cos(n * PI * x.x) * cos(m * PI * x.y) - cos(m * PI * x.x) * cos(n * PI * x.y);
}
vec2 chladni_mode(float k){
  /* a ladder of plate modes, each more intricate than the last */
  float n = 1. + k, m = 2. + k * 1.6;
  return vec2(n, floor(m + .5));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 x = centered(uv) * 2.;
  float k = (p_mode - 1.) + p * p_steps;
  float k0 = floor(k), kf = smoothstep(.25, .75, fract(k));
  vec2 m0 = chladni_mode(k0), m1 = chladni_mode(k0 + 1.);
  float f = abs(mix(chladni_f(x, m0.x, m0.y, p_shape), chladni_f(x, m1.x, m1.y, p_shape), kf));
  vec2 g = floor(uv * uRes / max(2., uRes.y / 540.));
  float gr = (hash12(g) - .5) * p_grain;
  float e = p * p;
  float w = mix(-p_grain - .02, 2.5 + p_grain, e);
  float m = step(f + gr, w);
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 col = mix(A, B, m);
  /* loose sand drifting toward the nodal lines just outside the filled band */
  float band = (w + .25) - f;
  float dust = step(.55 + .4 * clamp(band * 4., 0., 1.) * 0. + .35 * (1. - clamp(band / .25, 0., 1.)), hash12(g + 3.1)) * step(0., band) * (1. - m);
  col = mix(col, p_color, dust * p_sand * sin(PI * p));
  return vec4(col, 1.);
}` });

/* ---- Turing bloom ---- */
FX.register({ id:'tr-turing', name:'Turing bloom', cat:'transition', search:['reaction diffusion', 'labyrinth', 'coral', 'animal markings', 'organic', 'maze', 'spots'],
  desc:'B grows in as a living labyrinth, like coral or animal markings, that closes up into the full image.',
  params:[ R('wave','Wavelength',.055,.01,.15,.001), S('pattern','Pattern',['Spots','Stripes','Labyrinth'],2), R('warp','Warp',.1,0,.3), R('front','Front strength',1,0,5), S('origin','Origin',['Centre','Bottom','Top','Left'],0), R('rim','Rim',.4,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = centered(uv);
  vec2 w = c + p_warp * (vec2(fbm(c * 3.), fbm(c * 3. + 5.2)) - .5);
  int pat = int(p_pattern + .5);
  int n = pat == 0 ? 3 : pat == 1 ? 2 : 7;
  float k = TAU / p_wave;
  float L = 0.;
  for (int i = 0; i < 7; i++){
    if (i >= n) break;
    float fi = float(i);
    float a = pat == 1 ? fi * 1.2 + .3 : fi * PI / float(n) + (pat == 2 ? (hash12(vec2(fi, 2.)) - .5) * .5 : 0.);
    float ph = pat == 0 ? 0. : hash12(vec2(fi, 9.)) * TAU;
    L += cos(k * dot(w, vec2(cos(a), sin(a))) + ph);
  }
  L = clamp(L / (pat == 0 ? 1.5 : .55 * sqrt(float(n))), -1., 1.);
  int o = int(p_origin + .5);
  vec2 org = o == 0 ? vec2(0.) : o == 1 ? vec2(0., -.55) : o == 2 ? vec2(0., .55) : vec2(-.5 * aspect() - .05, 0.);
  float dmax = o == 0 ? .7 : 1.15;
  float dist = length(c - org) / dmax;
  float fs = p_front;
  float T = mix(1.06, -1.06 - fs, p) + fs * dist;
  float aa = min(fwidth(L) + .01, .05);
  float m = smoothstep(T - aa, T + aa, L);
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 col = mix(A, B, m);
  /* a thin membrane where the pattern meets A */
  float mem = 1. - smoothstep(0., aa * 3. + .04, abs(L - T));
  col = mix(col, col * .45, mem * p_rim * sin(PI * p));
  return vec4(col, 1.);
}` });

/* ---- Moiré beat ---- */
FX.register({ id:'tr-moire-beat', name:'Moiré beat', cat:'transition', search:['moire', 'op art', 'interference', 'line screen', 'optical'],
  desc:'Two fine line screens slide over each other, and B appears through the broad moiré fringes they make.',
  params:[ R('freq','Line frequency',120,40,400,1), R('beat','Beat angle',6,0,30,.1), R('lines','Screen visibility',.5,0,1), R('angle','Base angle',0,-90,90,1), S('shape','Screens',['Lines','Rings'],1), R('band','Edge band',.12,.02,.4) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = centered(uv);
  float f = p_freq;
  float th = radians(p_beat) * mix(.15, 1., p);
  vec2 n0 = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 n1 = rot(th) * n0;
  float g0, g1;
  if (p_shape < .5){ g0 = dot(c, n0) * f; g1 = dot(c, n1) * f; }
  else {
    /* two ring screens whose centres pull apart */
    vec2 o = n0 * radians(p_beat) * .5 * mix(.15, 1., p);
    g0 = length(c - o) * f; g1 = length(c + o) * f;
  }
  float M = .5 + .5 * cos(TAU * (g0 - g1));
  float b = p_band;
  float e = mix(-b, 1. + b, p);
  float m = 1. - smoothstep(e - b, e + b, M);
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 col = mix(A, B, m);
  /* the screens themselves: dark lines that multiply, strongest mid-way and in the edge band */
  float lw = fwidth(g0) * 1.2;
  float l0 = smoothstep(.5 - lw - .18, .5 - .18, abs(fract(g0) - .5));
  float l1 = smoothstep(.5 - lw - .18, .5 - .18, abs(fract(g1) - .5));
  float screen = 1. - (1. - l0 * .8) * (1. - l1 * .8);
  float near = 1. - smoothstep(0., b * 2.5, abs(M - e));
  float vis = p_lines * sin(PI * p) * mix(.35, 1., near);
  col *= 1. - screen * vis * .75;
  return vec4(col, 1.);
}` });

/* ---- Polariser ---- */
FX.register({ id:'tr-polariser', name:'Polariser', cat:'transition', search:['polarizer', 'photoelastic', 'stress', 'filter', 'rainbow', 'birefringence'],
  desc:'Like turning a polarising filter: A dims, stress colours bloom in rainbow streaks, and B comes through as the filter turns.',
  params:[ R('stress','Stress amount',.5,0,2), R('scale','Stress scale',2,.5,8), R('dark','Midpoint darkness',.35,0,.8), R('colour','Colour strength',.35,0,1), R('follow','Follow the picture',.5,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float th = smoothstep(0., 1., p) * PI * .5;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  float c2 = cos(th) * cos(th), s2 = sin(th) * sin(th);
  vec3 base = A * c2 + B * s2;
  float mid = sin(2. * th); mid *= mid;
  base *= 1. - p_dark * mid;
  /* retardation: a streaked stress field, bent by the edges of the picture it passes through */
  vec2 c = centered(uv) * p_scale;
  float lA = luma(A), lB = luma(B);
  float R = (fbm(vec2(c.x * .7, c.y * 1.6) + fbm(c * .8) * 1.5) * 1.6 + p_follow * mix(lA, lB, s2) * 1.2) * p_stress * 3.;
  vec3 lam = vec3(.65, .55, .45);
  vec3 photo = sin(PI * R / lam); photo *= photo;
  /* stress colours ride on the dimmed picture like light through crossed filters */
  vec3 col = base + photo * mid * p_colour * .55 * (.4 + .6 * luma(base));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Rack focus ---- */
FX.register({ id:'tr-rack-focus', name:'Rack focus', cat:'transition', nonLocal:true, search:['focus pull', 'bokeh', 'defocus', 'blur', 'aperture', 'cinematic'],
  desc:'The focus pulls off A into soft shaped bokeh, and B racks into sharpness.',
  params:[ R('blur','Max blur',.03,0,.08,.001), I('blades','Aperture blades',6,0,9), R('boost','Highlight boost',3,0,8), R('breath','Focus breathing',.03,0,.1,.001) ],
  fs:`vec3 rack_gather(sampler2D t, vec2 uv, float r, float scale){
  vec3 acc = vec3(0.); float wsum = 0.;
  float N = p_blades;
  for (int i = 0; i < 24; i++){
    float fi = float(i) + .5;
    float a = fi * 2.39996323;
    float rr = sqrt(fi / 24.);
    /* scale each tap to the edge of an N-sided aperture at its angle */
    if (N >= 3.){ float seg = TAU / N; float am = mod(a, seg) - seg * .5; rr *= cos(PI / N) / cos(am); }
    vec2 o = vec2(cos(a), sin(a)) * rr * r / vec2(aspect(), 1.);
    vec3 s = texture(t, (uv - .5) / scale + .5 + o).rgb;
    float w = 1. + p_boost * pow(luma(s), 4.);
    acc += s * w; wsum += w;
  }
  return acc / wsum;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float bell = sin(PI * p);
  float scale = 1. + p_breath * bell;
  float rA = p_blur * smoothstep(0., .5, p);
  float rB = p_blur * (1. - smoothstep(.5, 1., p));
  float x = smoothstep(.38, .62, p);
  vec3 col = vec3(0.);
  if (x < 1.) col += rack_gather(uA, uv, rA, scale) * (1. - x);
  if (x > 0.) col += rack_gather(uB, uv, rB, scale) * x;
  return vec4(col, 1.);
}` });

/* ---- Focal plane sweep ---- */
FX.register({ id:'tr-focal-sweep', name:'Focal plane sweep', cat:'transition', nonLocal:true, search:['depth of field', 'focus', 'tilt shift', 'depth', 'rack'],
  desc:'The focus travels back through the scene, and each part changes to B as the focal plane passes through it.',
  params:[ S('depth','Depth from',['Brightness and height','Height','Brightness'],0), R('contrast','Depth contrast',1,0,3), R('blur','Max blur',.02,0,.05,.001), R('soft','Swap softness',.06,.01,.2,.001), S('dir','Direction',['Near to far','Far to near'],0) ],
  fs:`float focal_depth(sampler2D t, vec2 uv){
  /* a blurred brightness from a low mip level, so depth follows shapes and not texture */
  float l = luma(textureLod(t, uv, 5.).rgb);
  float h = uv.y;
  int d = int(p_depth + .5);
  float z = d == 0 ? mix(h, 1. - l, .4) : d == 1 ? h : 1. - l;
  z = clamp((z - .5) * p_contrast + .5, 0., 1.);
  return p_dir > .5 ? 1. - z : z;
}
vec3 focal_gather(sampler2D t, vec2 uv, float r){
  vec3 acc = vec3(0.);
  for (int i = 0; i < 16; i++){
    float fi = float(i) + .5;
    float a = fi * 2.39996323;
    vec2 o = vec2(cos(a), sin(a)) * sqrt(fi / 16.) * r / vec2(aspect(), 1.);
    acc += texture(t, uv + o).rgb;
  }
  return acc / 16.;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float z = mix(focal_depth(uA, uv), focal_depth(uB, uv), .5);
  float s = p_soft;
  float f = mix(-s, 1. + s, p);
  float sw = smoothstep(z - s, z + s, f);
  float env = smoothstep(0., .18, p) * (1. - smoothstep(.82, 1., p));
  float r = p_blur * min(abs(z - f) * 2.5, 1.) * env;
  vec3 col = vec3(0.);
  if (sw < 1.) col += focal_gather(uA, uv, r) * (1. - sw);
  if (sw > 0.) col += focal_gather(uB, uv, r) * sw;
  return vec4(col, 1.);
}` });

/* ---- Anamorphic flare ---- */
FX.register({ id:'tr-anamorphic-flare', name:'Anamorphic flare', cat:'transition', nonLocal:true, search:['lens flare', 'streak', 'light leak', 'overexpose', 'flash', 'cinema'],
  desc:'A long blue anamorphic streak sweeps across, overexposes the frame and leaves B behind.',
  params:[ C('color','Streak colour','#6fb7ff',false), R('length','Streak length',1.2,.3,3), R('thresh','Threshold',.75,.4,.95), R('peak','Peak exposure',1.5,0,3), R('angle','Path angle',0,-90,90,1) ],
  fs:`vec3 flare_frame(vec2 uv, float x){ return mix(texture(uA, uv).rgb, texture(uB, uv).rgb, x); }
vec4 fx(vec2 uv){
  float p = uProgress;
  float bell = sin(PI * p);
  float x = smoothstep(.45, .55, p);
  vec3 col = flare_frame(uv, x);
  /* horizontal bloom: thresholded highlights smeared sideways */
  vec3 bloom = vec3(0.);
  float len = p_length * .12;
  for (int i = 0; i < 12; i++){
    float o = (float(i) / 11. - .5) * 2.;
    vec3 s = flare_frame(uv + vec2(o * len / aspect(), 0.), x);
    float b = max(luma(s) - p_thresh, 0.) / (1. - p_thresh);
    bloom += b * exp(-abs(o) * 2.5);
  }
  bloom /= 12.;
  /* the source travels along the path, its streak long and thin */
  vec2 dir = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 c = centered(uv);
  vec2 src = dir * mix(-.9, .9, p) + vec2(0., .05);
  vec2 d = c - src;
  vec2 dl = vec2(dot(d, dir), dot(d, vec2(-dir.y, dir.x)));
  float streak = exp(-abs(dl.y) * 90.) * exp(-abs(dl.x) / (p_length * .5)) * 1.4 + exp(-length(dl * vec2(1., 1.)) * 14.) * .8;
  /* the exposure only blows out in a short window around the cut, which hides it */
  float flash = pow(bell, 8.);
  col *= 1. + p_peak * .35 * flash;
  col += p_color * (bloom + streak) * bell;
  col = mix(col, vec3(.92, .96, 1.), flash * min(p_peak, 2.) * .35);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Rolling shutter whip ---- */
FX.register({ id:'tr-rolling-shutter', name:'Rolling shutter whip', cat:'transition', nonLocal:true, search:['whip pan', 'swish', 'jello', 'skew', 'phone camera', 'cmos'],
  desc:'A whip pan on a cheap sensor: the picture skews diagonally as it flicks across to B.',
  params:[ R('skew','Skew',.25,0,.6), R('blur','Motion blur',.5,0,1), S('dir','Direction',['Left','Right'],0), R('jello','Jello',.01,0,.04,.001), R('sharp','Snap',6,3,20,.1) ],
  fs:`float rs_ease(float t){
  /* exponential in-out: slow off the mark, a blur in the middle, a soft landing */
  float k = p_sharp;
  if (t <= 0.) return 0.; if (t >= 1.) return 1.;
  float z = pow(2., -k);
  return t < .5 ? (pow(2., k * (2. * t - 1.)) - z) / (1. - z) * .5 : 1. - (pow(2., -k * (2. * t - 1.)) - z) / (1. - z) * .5;
}
vec3 rs_strip(float x, float y){
  /* A and B side by side; the view slides along the strip */
  return x < 1. ? texture(uA, vec2(clamp(x, 0., 1.), y)).rgb : texture(uB, vec2(clamp(x - 1., 0., 1.), y)).rgb;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float sk = p_skew;
  /* each row is read out a little later than the one above it */
  float t = clamp(p * (1. + sk) - sk * (1. - uv.y), 0., 1.);
  float o = rs_ease(t);
  float dodt = (rs_ease(t + .01) - rs_ease(t - .01)) / .02;
  float bell = sin(PI * p);
  float x = p_dir < .5 ? uv.x : 1. - uv.x;
  float jx = p_jello * sin(uv.y * 20. + p * 30.) * bell;
  float span = min(dodt * .05 * p_blur, .45) * smoothstep(0., .1, bell);
  vec3 acc = vec3(0.);
  for (int i = 0; i < 9; i++){
    float k = float(i) / 8. - .5;
    float sx = x + o + jx + k * span;
    vec3 s = rs_strip(sx, uv.y);
    if (p_dir > .5) s = sx < 1. ? texture(uA, vec2(1. - clamp(sx, 0., 1.), uv.y)).rgb : texture(uB, vec2(1. - clamp(sx - 1., 0., 1.), uv.y)).rgb;
    acc += s;
  }
  return vec4(acc / 9., 1.);
}` });

/* ---- Shutter drag ---- */
FX.register({ id:'tr-shutter-drag', name:'Shutter drag', cat:'transition', nonLocal:true, search:['long exposure', 'light trails', 'motion blur', 'slow shutter', 'ghost'],
  desc:'A long exposure smears A into light trails as it drifts off, and B ghosts in through the same exposure.',
  params:[ R('window','Exposure',.35,.05,.6), S('motion','Motion',['Pan','Zoom','Rotate'],0), R('boost','Highlight boost',1.5,0,4), R('travel','Travel',.2,0,.4) ],
  fs:`vec3 drag_frame(vec2 uv, float t){
  /* A drifts away over the first half, B drifts in over the second */
  bool isA = t < .5;
  float s = isA ? t * 2. : (t - 1.) * 2.;
  float tr = p_travel * s;
  int m = int(p_motion + .5);
  vec2 c = centered(uv);
  if (m == 0) c.x -= tr;
  else if (m == 1) c /= 1. + tr * 2.5;
  else c = rot(tr * 2.) * c;
  vec2 q = mirrorUv(uncentered(c));
  return isA ? texture(uA, q).rgb : texture(uB, q).rgb;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float W = p_window * sin(PI * p);
  vec3 acc = vec3(0.); float ws = 0.;
  for (int i = 0; i < 12; i++){
    float t = clamp(p + (float(i) / 11. - .5) * W, 0., 1.);
    vec3 s = drag_frame(uv, t);
    float w = 1. + p_boost * luma(s) * luma(s) * 2.;
    acc += s * w; ws += w;
  }
  return vec4(acc / ws, 1.);
}` });

/* ---- Slit-scan corridor ---- */
FX.register({ id:'tr-slit-scan', name:'Slit-scan corridor', cat:'transition', nonLocal:true, search:['stargate', 'time slice', 'tunnel', 'warp', 'hyperspace', '2001'],
  desc:'The middle of the frame races ahead in time, so A stretches into streaks and B pulls through.',
  params:[ R('spread','Time spread',.6,0,2), S('slit','Slit',['Vertical','Horizontal','Radial'],0), R('zoom','Zoom range',2.2,1,8), R('streak','Streaks',.5,0,1) ],
  fs:`float slit_g(vec2 uv){
  int s = int(p_slit + .5);
  if (s == 0) return abs(uv.x - .5) * 2.;
  if (s == 1) return abs(uv.y - .5) * 2.;
  return clamp(length(centered(uv)) / .64, 0., 1.);
}
vec3 slit_frame(vec2 uv, float tau){
  vec2 c = uv - .5;
  /* A flies toward the viewer; B arrives already magnified and settles at full size */
  float a = min(tau * 2., 1.), b = min((1. - tau) * 2., 1.);
  float x = smoothstep(.4, .6, tau);
  vec3 col = vec3(0.);
  if (x < 1.) col += texture(uA, mirrorUv(.5 + c / (1. + (p_zoom - 1.) * a * a))).rgb * (1. - x);
  if (x > 0.) col += texture(uB, mirrorUv(.5 + c / (1. + (p_zoom - 1.) * b * b))).rgb * x;
  return col;
}
vec4 fx(vec2 uv){
  float p = uProgress, K = p_spread;
  int s = int(p_slit + .5);
  vec2 nrm = s == 0 ? vec2(sign(uv.x - .5), 0.) : s == 1 ? vec2(0., sign(uv.y - .5)) : normalize(uv - .5 + 1e-5);
  float len = p_streak * .2 * sin(PI * p) * (.15 + slit_g(uv));
  vec3 acc = vec3(0.);
  for (int i = 0; i < 7; i++){
    vec2 q = uv - nrm * len * float(i) / 6.;
    float tau = clamp(p * (1. + K) - K * slit_g(q), 0., 1.);
    acc += slit_frame(q, tau);
  }
  return vec4(acc / 7., 1.);
}` });

/* ---- Lenticular flip ---- */
FX.register({ id:'tr-lenticular', name:'Lenticular flip', cat:'transition', search:['lenticular', 'postcard', 'tilt card', 'ridged', 'flicker card', 'hologram'],
  desc:'Like tilting a ridged lenticular postcard: A flips to B strip by strip, with that glossy ribbed sheen.',
  params:[ R('width','Lens width',30,6,60,1), R('parallax','Parallax',.5,0,2), R('shine','Highlight',.3,0,1), R('mag','Magnification',.6,0,.9), R('sharp','Flip sharpness',.05,.01,.3,.001) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float px = uv.x * uRes.x / max(p_width * uRes.y / 1350., 2.);
  float li = floor(px), u = fract(px);
  float n = uRes.x / max(p_width * uRes.y / 1350., 2.);
  float lc = (li + .5) / n;
  float bell = sin(PI * p);
  /* each lens magnifies its own sliver of the print, strongest mid-tilt */
  float mg = p_mag * bell * bell;
  float sx = mix(uv.x, lc, mg);
  vec2 q = vec2(sx, uv.y);
  float par = p_parallax;
  float ph = clamp(p * (1. + par) - par * (1. - lc), 0., 1.);
  float sh = p_sharp;
  float m = smoothstep(u - sh, u + sh, ph * (1. + 2. * sh) - sh);
  vec3 A = texture(uA, q).rgb, B = texture(uB, q).rgb;
  vec3 col = mix(A, B, m);
  /* cylinder shading and a specular line that walks across the ribs as the card tilts */
  float cyl = 1. - .35 * pow(abs(u - .5) * 2., 3.) * bell;
  float v = fract(.3 + p * 1.5 + lc * .4);
  float spec = exp(-pow((u - v) / .08, 2.)) * p_shine * bell;
  col = col * cyl + spec * .7;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Prism sweep ---- */
FX.register({ id:'tr-prism-sweep', name:'Prism sweep', cat:'transition', nonLocal:true, search:['spectrum', 'rainbow', 'dispersion', 'glass', 'refraction', 'light split'],
  desc:'A large glass prism slides across the frame, splitting the light into a spectrum as it carries B in behind it.',
  params:[ R('size','Prism size',.5,.2,1.2), R('disp','Dispersion',.03,0,.08,.001), R('band','Spectrum band',.06,0,.15,.001), R('angle','Angle',15,-60,60,1), R('tint','Glass tint',.05,0,.3), S('dir','From',['Bottom','Top','Left','Right'],0) ],
  fs:`vec3 prism_b(vec2 uv){ return texture(uB, mirrorUv(uv)).rgb; }
vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  int dr = int(p_dir + .5);
  vec2 tdir = dr == 0 ? vec2(0., 1.) : dr == 1 ? vec2(0., -1.) : dr == 2 ? vec2(1., 0.) : vec2(-1., 0.);
  float ext = abs(tdir.x) * asp * .5 + abs(tdir.y) * .5;
  float R = p_size;
  float s = mix(-ext - R * 2.1 - p_band, ext + R + p_band + .02, p);
  vec2 c = centered(uv);
  vec2 pc = tdir * s;
  /* the prism points the way it travels */
  float ta = atan(tdir.y, tdir.x) - PI * .5 + radians(p_angle);
  vec2 lp = rot(ta) * (c - pc);
  float d = sdTri(lp, R);
  float behind = dot(c - pc, tdir);
  float inside = 1. - smoothstep(-.002, .002, d);
  float bm = max(inside, step(behind, 0.));
  vec3 A = texture(uA, uv).rgb;
  /* inside the glass B is refracted, each colour bent a different amount */
  vec2 fn = normalize(vec2(dFdx(d), dFdy(d)) + 1e-6);
  float depth = clamp(-d / (R * .5), 0., 1.);
  vec2 off = (tdir * .6 + fn * .4) * p_disp * (.4 + depth) / vec2(asp, 1.);
  vec3 Bin = vec3(prism_b(uv + off).r, prism_b(uv).g, prism_b(uv - off).b);
  Bin = mix(Bin, Bin * vec3(.92, .97, 1.) + .03, p_tint * 3.) ;
  vec3 B = mix(texture(uB, uv).rgb, Bin, inside);
  vec3 col = mix(A, B, bm);
  /* a spectral fan trails the exit face, a hairline marks each edge */
  float out_d = max(d, 0.);
  float fan = (1. - smoothstep(0., p_band, out_d)) * step(behind, 0.) * step(.0001, out_d) * step(.0001, p_band);
  vec3 spec = hsv2rgb(vec3(.8 * out_d / max(p_band, 1e-3), .75, 1.));
  col = mix(col, col * .55 + spec * .6, fan * .7);
  float edge = 1. - smoothstep(0., .003, abs(d));
  col += edge * .45;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Kaleidoscope settle ---- */
FX.register({ id:'tr-kaleido-settle', name:'Kaleidoscope settle', cat:'transition', nonLocal:true, search:['kaleidoscope', 'mirror', 'symmetry', 'mandala', 'hypnotic'],
  desc:'A turns into a kaleidoscope, the pattern rotates, and when it unfolds again it is B.',
  params:[ I('segs','Segments',6,3,16), R('turn','Rotation',90,0,360,1), R('zoom','Zoom at peak',1.3,1,2), R('swap','Swap window',.1,.02,.3), R('x','Centre X',.5,0,1), R('y','Centre Y',.5,0,1) ],
  fs:`vec2 kal_fold(vec2 c, float k, float turn){
  /* fold by reflecting across the mirror lines one after another. The folded map is continuous,
     so sliding each point toward its folded position (k) never opens a seam */
  float N = floor(p_segs + .5);
  float half_ = PI / N;
  vec2 q = rot(turn) * c;
  for (int pass = 0; pass < 3; pass++){
    for (int j = 0; j < 16; j++){
      if (float(j) >= N) break;
      float ph = float(j) * half_;
      vec2 n = j == 0 ? vec2(0., 1.) : vec2(sin(ph), -cos(ph));
      q -= 2. * min(dot(q, n), 0.) * n;
    }
  }
  return mix(c, rot(-turn) * q, k);
}
vec3 kal_sample(sampler2D t, vec2 cen, vec2 c, float k, float turn, float z){
  vec2 q = kal_fold(c, k, turn) / z;
  return texture(t, mirrorUv(uncentered(q + cen))).rgb;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float bell = sin(PI * p);
  float k = bell * bell;
  vec2 cen = centered(vec2(p_x, p_y));
  vec2 c = centered(uv) - cen;
  float z = 1. + (p_zoom - 1.) * bell;
  float turn = radians(p_turn) * p;
  float x = smoothstep(.5 - p_swap * .5, .5 + p_swap * .5, p);
  vec3 col = vec3(0.);
  if (x < 1.) col += kal_sample(uA, cen, c, k, turn, z) * (1. - x);
  if (x > 0.) col += kal_sample(uB, cen, c, k, turn, z) * x;
  return vec4(col, 1.);
}` });

/* ---- Fresnel lens ---- */
FX.register({ id:'tr-fresnel-lens', name:'Fresnel lens', cat:'transition', nonLocal:true, search:['fresnel', 'lighthouse', 'projector', 'rings', 'stepped lens', 'concentric'],
  desc:'A flat Fresnel lens slides over A and breaks it into stepped rings, which straighten out as B.',
  params:[ I('zones','Zones',14,4,40), R('power','Power',2.5,0,6), R('rim','Ring highlight',.3,0,1), R('chroma','Colour fringe',.01,0,.03,.001), R('x','Centre X',.5,0,1), R('y','Centre Y',.5,0,1) ],
  fs:`vec3 fres_s(sampler2D t, vec2 cen, vec2 d, float s){ return texture(t, mirrorUv(uncentered(cen + d * s))).rgb; }
vec4 fx(vec2 uv){
  float p = uProgress;
  float bell = sin(PI * p);
  vec2 cen = centered(vec2(p_x, p_y));
  vec2 d = centered(uv) - cen;
  float r = length(d);
  float zw = .75 / floor(p_zones + .5);
  float fz = fract(r / zw);
  /* each zone is a thin slice of a strong lens, so magnification steps from ring to ring */
  float env = bell * bell * bell * bell;
  float s = 1. / (1. + p_power * (.15 + fz * .55) * env);
  float ch = p_chroma * env * fz * 4.;
  float x = smoothstep(.42, .58, p);
  vec3 col = vec3(0.);
  if (x < 1.) col += vec3(fres_s(uA, cen, d, s * (1. + ch)).r, fres_s(uA, cen, d, s).g, fres_s(uA, cen, d, s * (1. - ch)).b) * (1. - x);
  if (x > 0.) col += vec3(fres_s(uB, cen, d, s * (1. + ch)).r, fres_s(uB, cen, d, s).g, fres_s(uB, cen, d, s * (1. - ch)).b) * x;
  float aa = fwidth(r / zw) * 1.5;
  float ring = smoothstep(1. - aa - .06, 1., fz) ;
  col += ring * p_rim * env * .5;
  col *= 1. - .15 * env * (1. - fz);
  return vec4(clamp(col, 0., 1.), 1.);
}` });
