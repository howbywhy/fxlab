/* ---------------- Transitions: sky ----------------
   Sky, light and weather. Each one changes the light the pictures are seen in
   (an eclipse, a storm, fog, the turn of the day) and hands A to B while the
   light is doing it. Pure functions of uv and uProgress: every weather effect is
   scaled by an envelope that is exactly zero at p = 0 and p = 1, so both ends
   are the untouched sources. uv.y runs up from the bottom of the frame, so
   "Y" params here are measured from the bottom too. */

/* ---- Eclipse ---- */
FX.register({ id:'tr-sky-eclipse', name:'Eclipse', cat:'transition', family:'sky', nonLocal:true,
  search:['solar eclipse', 'corona', 'totality', 'diamond ring', 'moon', 'baily', 'dark', 'sun'],
  desc:'A dark moon slides across the sun, the light drains from A, the corona flares at totality and B comes back as the moon moves off.',
  params:[ R('x','Sun X',.5,0,1), R('y','Sun Y',.66,0,1), R('size','Sun size',.11,.04,.3), R('corona','Corona',1,0,2), R('beads','Diamond ring',.8,0,1.5), R('dark','Darkness at totality',.88,0,1), C('glow','Corona colour','#e9efff',false) ],
  fs:`float ecl_fbm1(float a, float r){ return vnoise(vec2(a, r)) * .6 + vnoise(vec2(a * 2.3, r * 2.)) * .3 + vnoise(vec2(a * 5.1, r)) * .1; }
vec4 fx(vec2 uv){
  float p = uProgress, R = p_size, Rm = R * 1.05;
  vec2 q = centered(uv), s = centered(vec2(p_x, p_y));
  /* the moon travels slowly through the middle, so totality holds for a moment */
  float t = 2. * p - 1.;
  float off = sign(t) * max(abs(t) - .1, 0.) / .9 * R * 3.4;
  vec2 dir = normalize(vec2(1., -.28));
  vec2 m = s + dir * off;
  float dm = length(q - m), ds = length(q - s);
  float sep = abs(off);
  /* share of the sun still showing: 1 apart, 0 at totality */
  float L = smoothstep(Rm - R, Rm + R, sep);
  float on = smoothstep(0., .14, p) * (1. - smoothstep(.86, 1., p));
  float tot = 1. - smoothstep(Rm - R, Rm - R + R * .5, sep);
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 img = mix(A, B, smoothstep(.46, .54, p));
  /* eclipse light: dims hard, cools, and darkens the far edges of the sky first */
  float dim = mix(1., 1. - p_dark, pow(1. - L, 1.6)) ;
  float vign = 1. - .35 * (1. - L) * smoothstep(.2, 1.1, length(q - s));
  vec3 lit = img * dim * vign * mix(vec3(1.), vec3(.82, .9, 1.1), 1. - L);
  vec3 col = mix(img, lit, on);
  /* the sun's own disc, where the moon is not over it */
  float sunD = 1. - smoothstep(R - .003, R + .003, ds);
  float mask = smoothstep(Rm - .002, Rm + .002, dm);
  float limbD = sqrt(max(1. - ds * ds / (R * R), 0.));
  col = mix(col, vec3(1., .97, .9) * (.82 + .18 * limbD), sunD * mask * on);
  col += vec3(1., .82, .55) * exp(-max(ds - R, 0.) / (R * .7)) * L * on * .4 * mask;
  /* corona: streamers around the moon's limb, tinted by what B holds around the sun */
  vec2 rel = q - m;
  float ang = atan(rel.y, rel.x);
  float rr = max(dm - Rm, 0.) / R;
  float stream = ecl_fbm1(ang * 3.2 + 4., rr * .6) * ecl_fbm1(ang * 7. + 11., .3);
  float cor = exp(-rr * (2.6 - 1.6 * stream)) * (.45 + 1.4 * stream * stream);
  vec3 tint = mix(p_glow, texture(uB, uncentered(m + normalize(rel + 1e-5) * R * 2.4)).rgb * 1.6 + .2, .3);
  col += tint * cor * mask * tot * p_corona * on;
  /* the moon itself, nearly black with a little earthshine */
  vec3 moon = img * .06 + vec3(.012, .014, .02);
  /* the moon only shows as a disc against the glare of the sun */
  float glare = smoothstep(R * 2.6, R * 1.2, length(m - s));
  col = mix(col, moon, (1. - mask) * on * glare);
  /* diamond ring: the last and first sliver of sun on the far limb */
  float contact = exp(-pow((sep - (Rm - R) - R * .06) / (R * .09), 2.));
  vec2 bead = s - dir * sign(off + 1e-6) * R;
  float beadsAlong = smoothstep(.5, .9, vnoise(vec2(atan(q.y - s.y, q.x - s.x) * 18., 3.)));
  float limb = exp(-abs(ds - R) / (R * .025)) * exp(-length(q - bead) / (R * .55));
  float ring = exp(-length(q - bead) / (R * .22));
  float rays = pow(max(0., 1. - abs(sin(atan(q.y - bead.y, q.x - bead.x) * 2.))), 24.) * exp(-length(q - bead) / (R * 1.6));
  col += vec3(1., .98, .94) * (ring * 1.4 + limb * beadsAlong * 1.6 + rays * .6) * contact * p_beads * on;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Aurora ---- */
FX.register({ id:'tr-sky-aurora', name:'Aurora', cat:'transition', family:'sky', nonLocal:true,
  search:['northern lights', 'aurora borealis', 'polar', 'night sky', 'curtain', 'glow'],
  desc:'Night falls on A and folded curtains of light ripple across it; B shows through wherever they glow, until it is all lit.',
  params:[ I('curtains','Curtains',3,1,5), R('fold','Folding',.6,0,1.5), R('rays','Rays',.7,0,1), R('glow','Glow',1,0,2), R('night','Night',.78,0,1), C('low','Lower colour','#39ffa4',false), C('high','Upper colour','#9a4dff',false) ],
  fs:`float aur_curtain(vec2 q, float k, float p, out float hgt){
  float ph = k * 2.71 + 1.3;
  float base = mix(-.12, .28, fract(k * .618 + .15)) + .1 * sin(p * 3. + ph);
  float x = q.x * (1.6 + k * .3);
  float fold = p_fold * (.09 * sin(x * 2.1 + ph + p * 4.) + .05 * sin(x * 5.3 - ph * 2. - p * 6.) + .04 * (vnoise(vec2(x * 3., ph + p * 2.)) - .5));
  float y = q.y - base - fold;
  /* sharp lower hem, long soft rays upward */
  float hem = y < 0. ? exp(y * 70.) : exp(-y / (.22 + .1 * vnoise(vec2(x * 2., ph))));
  float rays = mix(1., .35 + .9 * vnoise(vec2(x * 46. + p * 3., ph)) * vnoise(vec2(x * 13., ph * 3.)), p_rays);
  hgt = clamp(y / .35, 0., 1.);
  return hem * rays * (.6 + .4 * vnoise(vec2(x * .8 + p, ph * 5.)));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 q = centered(uv);
  float I = 0., H = 0.;
  int n = int(p_curtains + .5);
  for (int k = 0; k < 5; k++){
    if (k >= n) break;
    float h; float c = aur_curtain(q, float(k), p, h);
    I += c; H += c * h;
  }
  H /= max(I, 1e-4);
  I = clamp(I, 0., 1.6);
  float nf = smoothstep(0., .3, p) * (1. - smoothstep(.72, 1., p));
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  /* B comes through the light: the brighter the curtain, the sooner */
  float m = smoothstep(0., 1., p * 2.3 - 1.25 + min(I, 1.) * 1.1);
  m = max(m, smoothstep(.8, 1., p));
  vec3 img = mix(A, B, m);
  vec3 night = img * vec3(.55, .68, .95);
  vec3 col = mix(img, night * (1. - p_night * .85), nf);
  vec3 light = mix(p_low, p_high, smoothstep(.15, .9, H));
  col += light * I * p_glow * .38 * nf;
  col += img * light * I * p_glow * .9 * nf;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Golden hour ---- */
FX.register({ id:'tr-sky-golden-hour', name:'Golden hour', cat:'transition', family:'sky', nonLocal:true,
  search:['sunset', 'sunrise', 'relight', 'golden', 'raking light', 'blue hour', 'time of day', 'warm'],
  desc:'The sun sets across A, raking over its forms in warm light down to blue hour, then rises on B from the other side.',
  params:[ R('angle','Sun direction',200,0,360,1), R('relief','Relief',2.5,0,10), R('warmth','Warmth',.8,0,1), R('blue','Blue hour depth',.7,0,1), R('reach','Shadow side',.55,0,1), C('sky','Blue hour colour','#2b3f6e',false) ],
  fs:`vec3 gh_relight(sampler2D s, vec2 uv, float az, float el, float tw){
  vec2 o = 3.5 / uRes;
  float l = luma(texture(s, uv).rgb);
  float gx = luma(texture(s, uv + vec2(o.x, 0.)).rgb) - luma(texture(s, uv - vec2(o.x, 0.)).rgb)
           + .5 * (luma(texture(s, uv + vec2(o.x * 3., 0.)).rgb) - luma(texture(s, uv - vec2(o.x * 3., 0.)).rgb));
  float gy = luma(texture(s, uv + vec2(0., o.y)).rgb) - luma(texture(s, uv - vec2(0., o.y)).rgb)
           + .5 * (luma(texture(s, uv + vec2(0., o.y * 3.)).rgb) - luma(texture(s, uv - vec2(0., o.y * 3.)).rgb));
  vec3 n = normalize(vec3(-gx * p_relief, -gy * p_relief, 1.));
  vec3 Ld = normalize(vec3(cos(az) * cos(el), sin(az) * cos(el), max(sin(el), .02)));
  float lam = clamp(dot(n, Ld), 0., 1.);
  /* raking: the side of the frame the sun sits on gets the light first */
  float side = dot(centered(uv), vec2(cos(az), sin(az)));
  float rake = smoothstep(-.9, .7, side + (1. - p_reach) * .6);
  vec3 c = texture(s, uv).rgb;
  float lowSun = 1. - smoothstep(.05, .9, el);
  vec3 sun = mix(vec3(1.), mix(vec3(1.18, .86, .55), vec3(1.25, .62, .32), smoothstep(.4, 1., lowSun)), p_warmth * lowSun);
  float k = mix(1., .45 + 1.1 * lam, lowSun) * mix(1., rake * 1.15 + .2, lowSun);
  vec3 lit = c * sun * k;
  /* blue hour: the sun is below the horizon, only sky light is left */
  vec3 blue = mix(vec3(l), p_sky * 1.6, .55) * (.3 + .7 * l);
  return mix(lit, mix(lit, blue, p_blue), tw);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float az = radians(p_angle);
  /* sun elevation falls through A and climbs through B, from the opposite side */
  float ea = 1. - smoothstep(0., .5, p), eb = smoothstep(.5, 1., p);
  float twA = smoothstep(.28, .5, p), twB = 1. - smoothstep(.5, .72, p);
  vec3 a = gh_relight(uA, uv, az, ea * 1.2, twA);
  vec3 b = gh_relight(uB, uv, az + PI, eb * 1.2, twB);
  /* the relight blends in from nothing at each end */
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  a = mix(A, a, smoothstep(0., .25, p));
  b = mix(B, b, 1. - smoothstep(.75, 1., p));
  vec3 col = mix(a, b, smoothstep(.44, .56, p));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Lightning ---- */
FX.register({ id:'tr-sky-lightning', name:'Lightning', cat:'transition', family:'sky', nonLocal:true,
  search:['storm', 'thunder', 'flash', 'bolt', 'strobe', 'weather', 'night'],
  desc:'A storm darkens A, a bolt comes down, and B is what the flashes light up.',
  params:[ R('x','Strike X',.42,0,1), R('branch','Branches',.7,0,1), R('flash','Flash',1,0,2), R('night','Storm darkness',.75,0,1), R('width','Bolt width',.5,.1,1), C('tint','Flash colour','#dfe7ff',false) ],
  fs:`float lt_path(float y, float seed){
  return (vnoise(vec2(y * 5., seed)) - .5) * .22 + (vnoise(vec2(y * 19., seed + 3.)) - .5) * .07 + (vnoise(vec2(y * 70., seed + 7.)) - .5) * .02;
}
float lt_bolt(vec2 q, float x0, float tip, float w, out float glow){
  float y = q.y;
  float dx = q.x - (x0 + lt_path(y, 1.));
  float on = step(tip, y);
  float d = abs(dx);
  float core = exp(-d / (.0016 * w)) * on;
  glow = exp(-d / .06) * smoothstep(tip - .05, tip + .1, y);
  /* two branches leave the main channel and fade out */
  for (int i = 0; i < 2; i++){
    float fi = float(i);
    float y0 = .25 - fi * .28;
    float sd = (fi * 2. - 1.);
    float along = y0 - y;
    if (along > 0. && along < .38 && y > tip){
      float bx = x0 + lt_path(y0, 1.) + sd * along * (.35 + .2 * fi) + lt_path(y, 9. + fi * 4.) * .8;
      float bd = abs(q.x - bx);
      float fade = (1. - along / .38) * p_branch;
      core += exp(-bd / (.0011 * w)) * fade;
      glow += exp(-bd / .05) * fade * .4;
    }
  }
  return core;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 q = centered(uv);
  float x0 = (p_x - .5) * aspect();
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  float nf = smoothstep(0., .3, p) * (1. - smoothstep(.72, 1., p));
  /* three strokes: a fast rise and a quick decay each, the middle one the brightest */
  float f = 0.;
  f += exp(-max(p - .38, 0.) * 55.) * smoothstep(.372, .38, p) * .7;
  f += exp(-max(p - .5, 0.) * 40.) * smoothstep(.492, .5, p) * 1.;
  f += exp(-max(p - .58, 0.) * 45.) * smoothstep(.572, .58, p) * .55;
  f *= p_flash;
  /* the leader feels its way down before the first stroke */
  float tip = mix(.6, -.6, smoothstep(.3, .38, p));
  float glow;
  float core = lt_bolt(q, x0, tip, p_width, glow);
  float vis = clamp(f * 1.6, 0., 1.) + smoothstep(.3, .38, p) * (1. - smoothstep(.38, .4, p)) * .5 + .12 * smoothstep(.38, .42, p) * (1. - smoothstep(.6, .66, p));
  vec3 dark = mix(A, B, smoothstep(.49, .5, p));
  vec3 night = dark * mix(vec3(1.), vec3(.45, .52, .7) * (1. - p_night * .7), nf);
  /* the flash lights B flat and cold, brightest near the strike */
  float near = exp(-abs(q.x - x0) * 1.2);
  vec3 lit = B * p_tint * (1.05 + .5 * near) + p_tint * .04;
  vec3 col = mix(night, lit, clamp(f, 0., 1.) * nf);
  col += p_tint * (core * 1.4 + glow * .2 * (1. - clamp(f, 0., 1.))) * vis * nf;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Fog bank ---- */
FX.register({ id:'tr-sky-fog-bank', name:'Fog bank', cat:'transition', family:'sky', nonLocal:true,
  search:['fog', 'mist', 'haze', 'atmosphere', 'depth', 'cloud', 'weather', 'murk'],
  desc:'Fog rolls in from the far distance, swallows A, and lifts off B from the foreground back.',
  params:[ C('color','Fog colour','#c7ccd2',false), R('depth','Depth from tones',.45,0,1), R('billow','Billow',.5,0,1), R('scatter','Picks up the light',.5,0,1), R('drift','Drift',.5,0,1.5) ],
  fs:`vec3 fog_scat(sampler2D s, vec2 uv){
  /* a wide, jittered ring of taps: the fog glows with the light around it, without ghosts */
  vec3 c = vec3(0.);
  float j = hash12(uv * uRes) * 6.283;
  for (int i = 0; i < 12; i++){
    float a = float(i) * 2.39996 + j;
    float r = .1 + .22 * fract(float(i) * .618);
    c += texture(s, clamp(uv + vec2(cos(a) / aspect(), sin(a)) * r, 0., 1.)).rgb;
  }
  return c / 12.;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float ar = aspect();
  bool second = p >= .5;
  vec3 img = second ? texture(uB, uv).rgb : texture(uA, uv).rgb;
  /* depth: higher in the frame is further away, nudged by tone (pale is usually far) */
  float z = mix(uv.y, luma(img), p_depth) * .85 + .15;
  vec2 w = vec2(uv.x * ar * 2.2 - p * p_drift * 1.6, uv.y * 3.5);
  float bil = fbm(w) - .5;
  z += bil * p_billow * .45;
  float e = 1. - abs(2. * p - 1.);
  float D = 7. * e / max(1. - e, 1e-3);
  float T = exp(-D * max(z, .02) * .55);
  vec3 sc = second ? fog_scat(uB, uv) : fog_scat(uA, uv);
  vec3 fc = mix(p_color, p_color * (.6 + .8 * mix(vec3(luma(sc)), sc, .6)), p_scatter) * (.92 + .16 * bil * p_billow);
  vec3 col = mix(fc, img, T);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Cloud shadow ---- */
FX.register({ id:'tr-sky-cloud-shadow', name:'Cloud shadow', cat:'transition', family:'sky', nonLocal:true,
  search:['clouds', 'shadow', 'overcast', 'sunlight', 'dappled', 'weather', 'landscape', 'wind'],
  desc:'Cloud shadows drift over a sunlit A; under them B waits in flat overcast light, and when the sky clears again it is B in the sun.',
  params:[ R('angle','Wind direction',15,0,360,1), R('scale','Cloud size',1.6,.5,4), R('soft','Shadow softness',.12,.02,.4), R('sun','Sunlight',.6,0,1), R('flat','Overcast flatness',.6,0,1), C('shade','Shade colour','#8fa4c4',false) ],
  fs:`vec3 cs_flat(vec2 uv){
  vec3 c = vec3(0.);
  for (int i = 0; i < 8; i++){
    float a = float(i) * .785;
    c += texture(uB, uv + vec2(cos(a) / aspect(), sin(a)) * .035).rgb;
  }
  return c / 8.;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 q = centered(uv);
  vec2 wd = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 cq = q * p_scale - wd * p * 1.8;
  float cl = fbm(cq * 1.7 + 3.) * .75 + fbm(cq * 4.3 + 9.) * .25;
  float sw = p_soft;
  /* first the clouds close in, then a second sky breaks open */
  float cover = smoothstep(cl + sw, cl - sw, mix(-.15, 1.1, 1. - smoothstep(0., .55, p)) * .85 + .05);
  float cl2 = fbm(cq * 1.5 + 21.) * .8 + fbm(cq * 4. + 2.) * .2;
  float clear = smoothstep(cl2 + sw, cl2 - sw, mix(1.15, -.15, smoothstep(.45, 1., p)) * .85 + .05);
  clear = max(1. - clear, smoothstep(.9, 1., p));
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  /* sunlit: a touch warmer and brighter. overcast: flat, cool and quieter */
  vec3 warm = vec3(1.1, 1.03, .88);
  float sunA = p_sun * smoothstep(0., .2, p);
  float sunB = p_sun * (1. - smoothstep(.8, 1., p));
  vec3 aSun = A * mix(vec3(1.), warm * 1.06, sunA);
  vec3 bSun = B * mix(vec3(1.), warm * 1.06, sunB);
  vec3 bf = mix(B, cs_flat(uv) * .5 + B * .5, p_flat);
  vec3 bOver = bf * mix(vec3(1.), p_shade * .78, p_sun);
  vec3 col = mix(aSun, bOver, cover);
  col = mix(col, bSun, clear * smoothstep(.4, .5, p));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Terminator ---- */
FX.register({ id:'tr-sky-terminator', name:'Terminator line', cat:'transition', family:'sky', nonLocal:true,
  search:['day and night', 'night', 'dusk', 'dawn', 'twilight', 'city lights', 'earth', 'globe', 'time of day'],
  desc:'Night sweeps across the frame on a curved line, through dusk and dark with the lights coming on, and dawn breaks behind it on B.',
  params:[ R('angle','Direction',0,0,360,1), R('curve','Curvature',.6,0,2), R('width','Night width',.55,.15,1.2), R('lights','Lights',.7,0,1.5), C('night','Night colour','#0e1730',false), C('lamp','Light colour','#ffcf8a',false) ],
  fs:`vec3 term_grade(vec3 c, float n){
  /* n: 0 day, .35 golden, .65 blue, 1 night */
  float l = luma(c);
  vec3 gold = mix(c, c * vec3(1.12, .86, .66), .7) * .9;
  vec3 blue = mix(vec3(l), p_night * 3., .55) * (.25 + .5 * l);
  vec3 dark = p_night * (.45 + .9 * l);
  vec3 g = mix(c, gold, smoothstep(0., .35, n));
  g = mix(g, blue, smoothstep(.3, .7, n));
  return mix(g, dark, smoothstep(.65, 1., n));
}
float term_lamps(sampler2D s, vec2 uv){
  /* the brightest parts of the picture become scattered points of light */
  vec2 g = uv * uRes / 5.;
  vec2 cell = floor(g);
  vec2 f = fract(g) - .5;
  vec2 j = hash22(cell) - .5;
  vec2 cu = (cell + .5) * 5. / uRes;
  float l = luma(texture(s, cu).rgb);
  vec2 r = vec2(.03 / aspect(), .03);
  float around = (luma(texture(s, cu + vec2(r.x, 0.)).rgb) + luma(texture(s, cu - vec2(r.x, 0.)).rgb)
                + luma(texture(s, cu + vec2(0., r.y)).rgb) + luma(texture(s, cu - vec2(0., r.y)).rgb)) * .25;
  /* lights gather where the picture has detail: edges and small bright things, not open sky */
  float detail = smoothstep(.03, .12, abs(l - around)) + smoothstep(.8, .95, l) * .5;
  float pt = exp(-dot(f - j * .5, f - j * .5) * 22.);
  return pt * detail * step(.55, hash12(cell)) * (.5 + .5 * hash12(cell + 7.));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 q = centered(uv);
  vec2 d = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 nrm = vec2(-d.y, d.x);
  float ar = aspect();
  float ext = abs(d.x) * ar * .5 + abs(d.y) * .5;
  float perp = dot(q, nrm);
  float s = dot(q, d) - p_curve * .45 * perp * perp;
  float W = p_width;
  /* the centre of the night travels from beyond one edge to beyond the other */
  float c = mix(-ext - W - p_curve * .2, ext + W + .05, p);
  float t = (c - s) / W;
  /* t < -1: A in day; -1..0: A falling into night; 0..1: B rising out of it; > 1: B */
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  float nA = clamp(t + 1., 0., 1.), nB = clamp(1. - t, 0., 1.);
  vec3 lamp = p_lamp * p_lights * 1.4;
  vec3 col;
  if (t < 0.) col = term_grade(A, nA) + lamp * term_lamps(uA, uv) * smoothstep(.55, 1., nA);
  else col = term_grade(B, nB) + lamp * term_lamps(uB, uv) * smoothstep(.55, 1., nB);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Star trails ---- */
FX.register({ id:'tr-sky-star-trails', name:'Star trails', cat:'transition', family:'sky', nonLocal:true,
  search:['long exposure', 'night', 'stars', 'rotation', 'astrophotography', 'circumpolar', 'arcs'],
  desc:'Night falls and the sky turns: the lights of A streak into arcs around the pole, and unwind as B.',
  params:[ R('x','Pole X',.5,0,1), R('y','Pole Y',.86,0,1.5), R('sweep','Sweep',.9,.1,2), R('thresh','Light threshold',.8,0,1), R('stars','Stars',.8,0,1), R('night','Night',.6,0,1) ],
  fs:`vec3 st_src(vec2 uv, float useB){
  vec2 m = mirrorUv(uv);
  return useB > .5 ? texture(uB, m).rgb : texture(uA, m).rgb;
}
float st_star(vec2 uv){
  vec2 g = uv * uRes / 3.;
  vec2 c = floor(g);
  float h = hash12(c);
  return step(.985, h) * (.4 + .6 * hash12(c + 3.)) * exp(-dot(fract(g) - .5, fract(g) - .5) * 6.);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 P = centered(vec2(p_x, p_y));
  vec2 rel = centered(uv) - P;
  float nf = smoothstep(0., .28, p) * (1. - smoothstep(.72, 1., p));
  float S = p_sweep * nf;
  vec3 tr = vec3(0.);
  float stars = 0.;
  for (int j = 0; j < 32; j++){
    float fj = float(j) / 31.;
    vec2 su = uncentered(P + rot(-S * fj) * rel);
    /* earlier in the exposure is further back along the arc; the swap happens half way */
    float when = p - fj * .22 * nf;
    vec3 c = st_src(su, step(.5, when));
    float k = smoothstep(p_thresh, p_thresh + .15, luma(c));
    tr = max(tr, c * k * (1. - fj * .35));
    stars = max(stars, st_star(su) * (1. - fj * .3));
  }
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 img = mix(A, B, smoothstep(.42, .58, p));
  vec3 night = img * mix(vec3(1.), vec3(.4, .48, .7) * (1. - p_night * .8), nf);
  vec3 col = night + (tr * .7 + vec3(.85, .9, 1.) * stars * p_stars * 1.3) * nf;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Rainbow ---- */
FX.register({ id:'tr-sky-rainbow', name:'Rainbow', cat:'transition', family:'sky', nonLocal:true,
  search:['rainbow', 'refraction', 'spectrum', 'arc', 'prism', 'after rain', 'bow'],
  desc:'A rainbow rises out of the ground and widens across the sky; inside the bow the light is brighter and it is B.',
  params:[ R('x','Centre X',.5,0,1), R('y','Centre Y',-.35,-1,.5), R('width','Bow width',.05,.01,.15), R('second','Second bow',.55,0,1), R('bright','Inner brightening',.35,0,1), R('refract','Refraction',.6,0,1) ],
  fs:`vec3 rb_spec(float t){ return clamp(abs(fract(vec3(t) * .85 + vec3(0., .67, .33)) * 6. - 3.) - 1., 0., 1.); }
vec4 fx(vec2 uv){
  float p = uProgress, ar = aspect();
  vec2 C = centered(vec2(p_x, p_y));
  vec2 rel = centered(uv) - C;
  float d = length(rel);
  vec2 rd = rel / max(d, 1e-4);
  /* the bow rises from below the frame until even the far corners are inside it */
  float far = length(vec2(ar * .5, .5) + abs(C)) + .1;
  float near = max(-.5 - C.y, 0.);
  float r = mix(near - .02, far + p_width * 4., p);
  r = mix(r, far + 1., smoothstep(.97, 1., p));
  float w = p_width;
  float on = smoothstep(0., .1, p) * (1. - smoothstep(.85, 1., p));
  vec3 A = texture(uA, uv).rgb;
  float t = (d - (r - w)) / w;
  vec3 col;
  if (t < 0.){
    vec3 B = texture(uB, uv).rgb;
    col = B + B * p_bright * on * smoothstep(-3., -.1, t) * .3 + p_bright * .03 * on;
  } else if (t < 1.){
    /* inside the band each colour sees B pulled by its own amount */
    vec3 sp = rb_spec(t);
    float k = p_refract * .03 * on;
    vec3 Bs = vec3(texture(uB, mirrorUv(uv - rd * k * t / vec2(ar, 1.))).r,
                   texture(uB, mirrorUv(uv - rd * k * .6 / vec2(ar, 1.))).g,
                   texture(uB, mirrorUv(uv - rd * k * (1. - t) / vec2(ar, 1.))).b);
    float edge = smoothstep(0., .25, t) * smoothstep(1., .75, t);
    vec3 band = mix(Bs, A, smoothstep(.3, .9, t));
    col = band * (1. - .12 * edge * on) + sp * edge * .38 * on;
  } else {
    /* Alexander's dark band, then the fainter second bow with its colours reversed */
    float t2 = (d - (r + w * 1.4)) / (w * 1.4);
    float dark = smoothstep(1., 1.3, t) * (1. - smoothstep(-.1, .1, t2));
    col = A * (1. - .18 * dark * on);
    if (t2 > 0. && t2 < 1.){
      float e2 = smoothstep(0., .25, t2) * smoothstep(1., .75, t2);
      col += rb_spec(1. - t2) * e2 * .3 * p_second * on;
    }
  }
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Snowfall ---- */
FX.register({ id:'tr-sky-snow-settle', name:'Snowfall', cat:'transition', family:'sky', nonLocal:true,
  search:['snow', 'winter', 'blanket', 'melt', 'thaw', 'weather', 'cold', 'seasonal'],
  desc:'Snow falls and settles on every ledge and ridge of A until it is buried, then melts off B, darkest parts first.',
  params:[ R('flakes','Flakes',.7,0,1), R('ledges','Settles on ledges',.7,0,1), R('melt','Melt follows tone',.7,0,1), R('sparkle','Sparkle',.5,0,1), C('snow','Snow colour','#f1f4f8',false) ],
  fs:`float sn_l(vec2 uv){ return luma(texture(uA, uv).rgb); }
float sn_flakes(vec2 uv, float p){
  float ar = aspect(), f = 0.;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float sc = 22. + fi * 16.;
    vec2 g = vec2(uv.x * ar, uv.y) * sc;
    g.y += p * (9. + fi * 6.);
    g.x += sin(g.y * .35 + fi * 2.) * .35;
    vec2 c = floor(g);
    vec2 j = hash22(c + fi * 13.);
    vec2 d = fract(g) - .25 - j * .5;
    float r = (.07 + .05 * hash12(c + 5.)) * (1. - fi * .2);
    f = max(f, step(.55, hash12(c + 9. + fi)) * smoothstep(r, r * .3, length(d)) * (1. - fi * .25));
  }
  return f;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 o = vec2(0., 5. / uRes.y);
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  /* a ledge is where the picture turns darker going down: a ridge under sky, a top edge, a shelf */
  float la = luma(A);
  float ledge = clamp((sn_l(uv + o * 3.) - la - .05) * 7., 0., 1.) + clamp((sn_l(uv + o) - sn_l(uv - o) - .04) * 6., 0., 1.);
  float tex = fbm(vec2(uv.x * aspect(), uv.y) * 14.);
  float settle = clamp(p / .5, 0., 1.);
  float need = 1. - p_ledges * clamp(ledge, 0., 1.) * .7 - tex * .3;
  float cover = smoothstep(need - .12, need + .02, settle * 1.15);
  cover = max(cover, smoothstep(.38, .5, p));
  /* melting starts in B's dark parts, which hold the warmth */
  float lb = luma(B);
  float order = mix(.5, 1. - lb, p_melt) * .75 + fbm(vec2(uv.x * aspect(), uv.y) * 6. + 4.) * .25;
  float m = clamp((p - .5) / .5, 0., 1.) * 1.25;
  float melt = smoothstep(order - .08, order, m - .05);
  melt = max(melt, smoothstep(.95, 1., p));
  /* the blanket keeps a little of the shapes it lies on */
  vec3 under = p < .5 ? A : B;
  float sh = luma(under);
  vec3 blanket = p_snow * (.86 + .14 * tex) * mix(vec3(.8, .86, .96), vec3(1.), smoothstep(.1, .7, sh));
  blanket += p_sparkle * step(.985, hash12(floor(uv * uRes / 2.))) * .4;
  vec3 col = p < .5 ? mix(A, blanket, cover) : mix(blanket, B, melt);
  /* a damp darkening where the snow has just gone */
  float wet = (1. - smoothstep(0., .2, m - order)) * melt * step(.5, p) * (1. - smoothstep(.85, 1., p));
  col *= 1. - .18 * wet;
  float fall = smoothstep(0., .1, p) * (1. - smoothstep(.45, .6, p));
  col = mix(col, p_snow, sn_flakes(uv, p) * fall * p_flakes);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Monsoon ---- */
FX.register({ id:'tr-sky-monsoon', name:'Monsoon', cat:'transition', family:'sky', nonLocal:true,
  search:['rain', 'downpour', 'storm', 'wet', 'squall', 'weather', 'shower'],
  desc:'A sheet of heavy rain sweeps across and leaves B soaked and gleaming behind it, then it dries.',
  params:[ R('angle','Direction',0,0,360,1), R('slant','Rain slant',.25,-1,1), R('density','Density',.7,0,1), R('sheet','Sheet width',.5,.1,1), R('wet','Wet darkening',.35,0,.8), R('gloss','Gloss',.5,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, ar = aspect();
  vec2 q = centered(uv);
  vec2 d = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  float ext = abs(d.x) * ar * .5 + abs(d.y) * .5;
  float W = p_sheet;
  float u = dot(q, d);
  float ragged = (fbm(vec2(dot(q, vec2(-d.y, d.x)) * 3., p * 2.)) - .5) * .25;
  float front = mix(-ext - .2, ext + W + .2, smoothstep(0., .85, p));
  float s = front - u + ragged;
  /* s < 0: ahead of the rain. 0..W: under the sheet. > W: behind it */
  float behind = smoothstep(W * .25, W * .75, s);
  float under = smoothstep(-.03, .05, s) * (1. - smoothstep(W * .6, W * 1.3, s));
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 img = mix(A, B, behind);
  /* rain: thin slanted streaks that fall with p */
  vec2 rq = vec2(q.x - q.y * p_slant, q.y);
  float st = vnoise(vec2(rq.x * 260., rq.y * 3. + p * 60.)) * vnoise(vec2(rq.x * 90. + 3., rq.y * 2. + p * 45.));
  float streak = smoothstep(.55 - p_density * .25, .8, st);
  /* wet ground: darker and more saturated, with highlights drawn down like running water */
  float dry = 1. - smoothstep(.7, 1., p);
  float wet = behind * dry;
  float l = luma(img);
  vec3 sat = mix(vec3(l), img, 1.25);
  vec3 wetc = sat * (1. - p_wet);
  float run = vnoise(vec2(uv.x * ar * 120., uv.y * 4. + p * 3.)) * smoothstep(.85, .98, luma(texture(uB, uv + vec2(0., .012)).rgb));
  wetc += run * run * p_gloss * .5;
  vec3 col = mix(img, wetc, wet);
  /* the sheet itself is a grey veil full of streaks */
  float veil = under * smoothstep(0., .1, p) * dry;
  col = mix(col, vec3(.62, .66, .7) * (.6 + .4 * l), veil * .45 * p_density);
  col += streak * (under * .55 + wet * .08) * vec3(.85, .9, .95) * p_density * dry * smoothstep(0., .05, p);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Dust storm ---- */
FX.register({ id:'tr-sky-haboob', name:'Dust storm', cat:'transition', family:'sky', nonLocal:true,
  search:['haboob', 'sandstorm', 'dust', 'desert', 'wall', 'storm', 'ochre', 'weather'],
  desc:'A towering wall of dust rolls over A, the light goes ochre and flat, and B is there when it has passed.',
  params:[ R('angle','Direction',180,0,360,1), R('billow','Billow',.7,0,1), R('depth','Wall depth',.7,.3,1.2), R('grit','Grit',.5,0,1), R('lit','Lit tops',.6,0,1), C('dust','Dust colour','#b8834a',false) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, ar = aspect();
  vec2 q = centered(uv);
  vec2 d = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 n = vec2(-d.y, d.x);
  float ext = abs(d.x) * ar * .5 + abs(d.y) * .5;
  float u = dot(q, d), v = dot(q, n);
  float L = p_depth;
  /* the head billows like cauliflower, a fractal edge that rolls as it comes */
  float bil = (fbm(vec2(v * 2.5, p * 1.5)) - .5) * .5 + (fbm(vec2(v * 7., u * 3. - p * 3.)) - .5) * .18;
  bil *= p_billow;
  float front = mix(-ext - .35, ext + L + .45, p);
  float a = front - u + bil;          /* depth into the wall from its leading edge */
  float inW = smoothstep(-.02, .06, a);
  float tail = smoothstep(L * .55, L + .2, a + (fbm(vec2(v * 3., 5.)) - .5) * .3);
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 img = mix(A, B, smoothstep(L * .45, L * .6, a));
  float thick = inW * (1. - tail);
  float core = smoothstep(0., L * .35, a) * (1. - smoothstep(L * .55, L * .95, a));
  /* inside, colour collapses into the dust and contrast flattens */
  float l = luma(img);
  vec3 seen = mix(img, p_dust * (.6 + .7 * l), .6 * thick);
  float tex = fbm(vec2(v, u) * 6. + vec2(0., -p * 4.));
  vec3 dust = p_dust * (.55 + .55 * tex);
  /* the leading face catches the light along its crests */
  float crest = exp(-max(a, 0.) * 18.) * inW * p_lit * (.6 + .6 * tex);
  vec3 col = mix(seen, dust, core * .88);
  col += p_dust * crest * .8;
  col += (hash12(floor(uv * uRes / 1.5) + floor(p * 40.)) - .5) * p_grit * .18 * thick;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Day for night ---- */
FX.register({ id:'tr-sky-day-for-night', name:'Day for night', cat:'transition', family:'sky',
  search:['night', 'dusk', 'purkinje', 'nightfall', 'dawn', 'twilight', 'time of day', 'darkness'],
  desc:'A goes to night by its own tones, shadows first and reds before blues, with its brightest spots left burning; B wakes highlights first.',
  params:[ C('night','Night colour','#1a2a52',false), R('shift','Reds fade first',.7,0,1), R('lights','Lights stay on',.6,0,1), R('spread','Tonal spread',.7,0,1), R('depth','Depth of night',.82,0,1) ],
  fs:`vec3 dfn_night(vec3 c, float t, float lo){
  /* t: 0 day to 1 night. each channel falls on its own clock: red first, blue last */
  float l = luma(c);
  float sp = p_spread * .45;
  float tt = t * (1. + sp) - sp * lo;
  vec3 lag = vec3(0., .12, .24) * p_shift;
  vec3 k = smoothstep(0., 1., clamp(vec3(tt) * (1. + lag) - lag * .6, 0., 1.));
  vec3 dark = p_night * mix(1.6, .5, p_depth) * (.35 + 1.3 * l);
  vec3 g = mix(c, dark, k);
  /* the brightest spots stay on as warm points */
  float hot = smoothstep(.7, .95, l) * p_lights;
  return mix(g, c * vec3(1.15, .85, .55) * 1.1, hot * smoothstep(.2, 1., t));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  /* A: shadows go first. B: highlights wake first */
  float tA = clamp(p / .5, 0., 1.), tB = clamp((1. - p) / .5, 0., 1.);
  vec3 a = dfn_night(A, tA, 1. - luma(A));
  vec3 b = dfn_night(B, tB, luma(B));
  vec3 col = mix(a, b, smoothstep(.46, .54, p));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Fata Morgana ---- */
FX.register({ id:'tr-sky-fata-morgana', name:'Fata Morgana', cat:'transition', family:'sky', nonLocal:true,
  search:['mirage', 'horizon', 'superior mirage', 'stacked', 'towers', 'refraction', 'sea', 'desert'],
  desc:'The horizon of A towers up into stacked, flipped copies of itself, as in a sea or desert mirage, and B settles out of the same towers.',
  params:[ R('horizon','Horizon height',.42,.1,.9), R('strip','Horizon strip',.05,.01,.2), I('layers','Layers',4,2,9), R('height','Tower height',1.1,.3,1.5), R('shimmer','Shimmer',.4,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float h = p_horizon;
  float e = 1. - abs(2. * p - 1.);
  float H = p_height * pow(e, .8);
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 out0 = p < .5 ? A : B;
  float y = uv.y - h;
  float band = abs(y) / max(H, 1e-4);
  if (band >= 1.) return vec4(out0, 1.);
  /* fold the band into alternating upright and inverted copies of a thin strip around the horizon */
  float s = (y / H) * p_layers;
  float k = floor(s);
  float f = fract(s);
  float tri = mod(k, 2.) < .5 ? f : 1. - f;
  float wob = sin(uv.y * 140. + p * 30.) * .0025 * p_shimmer * e + (vnoise(vec2(uv.y * 40., p * 8.)) - .5) * .006 * p_shimmer * e;
  /* the copies thin out toward the top and bottom of the tower */
  float sy = h + (tri - .5) * 2. * p_strip * (1. - band * .5);
  vec2 su = vec2(uv.x + wob, sy);
  /* each layer changes from A to B on its own beat */
  float beat = hash12(vec2(k, 3.)) * .5 + .25;
  float useB = smoothstep(beat - .06, beat + .06, p);
  vec3 m = mix(texture(uA, su).rgb, texture(uB, su).rgb, useB);
  float seam = 1. - .25 * pow(abs(tri - .5) * 2., 6.);
  m = m * seam * (1. + .12 * e) + .03 * e;
  float edge = smoothstep(1., .7, band);
  return vec4(clamp(mix(out0, m, edge), 0., 1.), 1.);
}` });

/* ---- Day to night slices ---- */
FX.register({ id:'tr-sky-time-slices', name:'Day to night slices', cat:'transition', family:'sky',
  search:['time slice', 'day to night', 'time lapse', 'montage', 'slices', 'hours', 'dusk', 'dawn'],
  desc:'The frame is cut into slices of time, each a little later in the day, so A goes through dusk and night and comes out as B in the morning.',
  params:[ I('slices','Slices',7,2,16), R('angle','Angle',0,0,180,1), R('spread','Spread',.6,0,1), R('gap','Gap lines',.4,0,1), C('night','Night colour','#14213f',false), C('lamp','Light colour','#ffcf8a',false) ],
  fs:`vec3 ts_grade(vec3 c, float n){
  float l = luma(c);
  vec3 gold = mix(c, c * vec3(1.12, .86, .66), .7) * .9;
  vec3 blue = mix(vec3(l), p_night * 3., .55) * (.25 + .55 * l);
  vec3 dark = p_night * (.4 + .9 * l) + p_lamp * smoothstep(.72, .95, l) * .6;
  vec3 g = mix(c, gold, smoothstep(0., .35, n));
  g = mix(g, blue, smoothstep(.3, .7, n));
  return mix(g, dark, smoothstep(.65, 1., n));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 q = centered(uv);
  float a = radians(p_angle);
  vec2 d = vec2(cos(a), sin(a));
  float ext = abs(d.x) * aspect() * .5 + abs(d.y) * .5;
  float u = clamp((dot(q, d) + ext) / (2. * ext), 0., 1.);
  float N = p_slices;
  float i = min(floor(u * N), N - 1.);
  float fu = fract(u * N);
  /* each slice runs the same day, starting a little later than the one before */
  float sp = p_spread;
  float T = clamp(p * (1. + sp) - sp * i / max(N - 1., 1.), 0., 1.);
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 a2 = ts_grade(A, clamp(T * 2., 0., 1.));
  vec3 b2 = ts_grade(B, clamp(2. - T * 2., 0., 1.));
  vec3 col = mix(a2, b2, smoothstep(.47, .53, T));
  float on = smoothstep(0., .08, p) * (1. - smoothstep(.92, 1., p));
  /* a hairline between slices, about a pixel wide at any render size */
  float distPx = min(fu, 1. - fu) / N * 2. * ext * uRes.y / uPx;
  float g = 1. - smoothstep(.5, 1.5, distPx);
  col *= 1. - g * p_gap * .6 * on;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Contrail ---- */
FX.register({ id:'tr-sky-contrail', name:'Contrail', cat:'transition', family:'sky', nonLocal:true,
  search:['vapour trail', 'plane', 'jet', 'line', 'sky', 'spread', 'wind shear'],
  desc:'A plane draws thin white lines across A that spread and drift in the wind, and B shows through as the trails widen into cloud.',
  params:[ R('angle','Heading',18,0,360,1), I('lines','Engines',2,1,4), R('spread','Spread',.6,.1,1), R('waver','Waver',.5,0,1), R('offset','Path offset',.1,-.4,.4), C('vapour','Vapour colour','#f4f6f8',false) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, ar = aspect();
  vec2 q = centered(uv);
  vec2 d = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 n = vec2(-d.y, d.x);
  float ext = abs(d.x) * ar * .5 + abs(d.y) * .5;
  float u = dot(q, d), v = dot(q, n) - p_offset;
  /* the plane crosses in the first part; age is how long ago it passed this point */
  float head = mix(-ext - .05, ext + .05, smoothstep(0., .45, p));
  float age = clamp((head - u) / (2. * ext + .1) * .7 + max(p - .45, 0.) * 1.5, 0., 2.);
  float drawn = step(u, head) * step(.001, p);
  float wav = (fbm(vec2(u * 3., age * 2.)) - .5) * p_waver * .18 * age;
  float m = 0., vap = 0.;
  int L = int(p_lines + .5);
  for (int i = 0; i < 4; i++){
    if (i >= L) break;
    float fi = float(i);
    float lo = (fi - (float(L) - 1.) * .5) * .018;
    float w = .002 + pow(age, 2.4) * p_spread * .9;
    float dv = abs(v - lo - wav) - w;
    float edge = .004 + w * .5;
    float k = (fbm(vec2(u * 9., v * 9. + fi)) - .5) * w * .9;
    m = max(m, (1. - smoothstep(-edge, edge, dv + k)) * drawn);
    vap = max(vap, exp(-max(dv + k, 0.) / (.004 + w * .3)) * drawn);
  }
  m = max(m, smoothstep(.9, 1., p));
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 col = mix(A, B, m);
  /* fresh vapour is bright and dense; it thins out to nothing as it spreads */
  float thin = exp(-age * 3.);
  float on = 1. - smoothstep(.85, 1., p);
  col = mix(col, p_vapour, clamp(vap * (.25 + .75 * thin), 0., 1.) * (.35 + .65 * thin) * on);
  return vec4(clamp(col, 0., 1.), 1.);
}` });
