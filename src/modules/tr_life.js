/* ---------------- Transitions: life ----------------
   Original A-to-B transitions taken from biology: cells, skins, flocks,
   shells, threads and the eye itself. Each is a pure function of uv and
   uProgress (uTime only for living texture); small fixed loops only. */

/* ---- Cell division ---- */
FX.register({ id:'tr-mitosis', name:'Cell division', cat:'transition', family:'life',
  search:['mitosis', 'cleavage', 'embryo', 'metaball', 'blob', 'organic', 'split', 'biology'],
  desc:'A rounds into a cell and divides, again and again, and B shows in the gaps between the daughter cells until they shrink away.',
  params:[ I('gens','Divisions',3,1,4), R('membrane','Membrane',.55,0,1), R('wobble','Wobble',.35,0,1), R('bulge','Cell lens',.35,0,1), R('jitter','Irregularity',.5,0,1), R('shadow','Shadow on B',.4,0,1) ],
  fs:`float mit_k(vec2 d, float K){ float q = max(0., 1. - dot(d, d) / (K * K)); return q * q; }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  int G = int(clamp(p_gens, 1., 4.) + .5);
  float fg = float(G);
  float s = p * (fg + 1.1);
  int k = min(int(floor(s)), G - 1);
  float f = clamp(s - float(k), 0., 1.);
  float e = f * f * (3. - 2. * f);
  float shrink = smoothstep(fg, fg + 1.1, s);
  vec2 x = centered(uv);
  float ar = aspect();
  /* the membrane wobbles a little, like a living cell */
  float wob = p_wobble * .035 * sin(PI * p) * (fbm(x * 5. + vec2(uTime * .15, 0.)) - .5);
  int n = 1 << (k + 1);
  float F = 0., best = 0.;
  vec2 bc = vec2(0.); float bK = 1.;
  for (int j = 0; j < 32; j++){
    if (j >= n) break;
    vec2 c = vec2(0.); float ex = ar * .5, ey = .5; int pre = 1;
    for (int l = 0; l <= 4; l++){
      if (l > k) break;
      int bit = (j >> (k - l)) & 1;
      float sg = bit == 1 ? 1. : -1.;
      float amt = l < k ? 1. : e;
      float ja = (hash12(vec2(float(pre), float(l) + 3.1)) - .5) * .7 * p_jitter;
      vec2 dir; float off;
      if (ex >= ey){ dir = vec2(1., 0.); off = ex * .5; ex *= .5; } else { dir = vec2(0., 1.); off = ey * .5; ey *= .5; }
      float jl = 1. + (hash12(vec2(float(pre), 9.7 + float(l))) - .5) * .35 * p_jitter;
      c += sg * amt * off * jl * (rot(ja) * dir);
      pre = pre * 2 + bit;
    }
    float hc = sqrt(ex * ey);
    float Kc = 1.5 * hc;
    float Kp = k == 0 ? 1.18 : Kc * 1.4142;
    float K = mix(Kp, Kc, e) * (1. - shrink) + 1e-4;
    float w = mix(.5, 1., e);
    vec2 d = x - c + wob;
    float v = w * mit_k(d, K);
    F += v;
    if (v > best){ best = v; bc = c; bK = K; }
  }
  float t = .3;
  float aa = fwidth(F) * 1.2 + 1e-4;
  float inC = smoothstep(t - aa, t + aa, F);
  /* inside a cell: A, gently magnified toward the cell's centre */
  float lensAmt = p_bulge * .18 * sin(PI * p) * (1. - smoothstep(0., bK, length(x - bc)));
  vec2 xs = x - (x - bc) * lensAmt;
  vec3 a = texture(uA, uncentered(xs)).rgb;
  float rim = 1. - smoothstep(0., .22, F - t);
  float on = sin(PI * min(p * 1.6, 1.));
  vec3 cell = a * (1. - p_membrane * .55 * rim * on);
  float hl = 1. - smoothstep(0., .06, abs(F - t - .06));
  cell += p_membrane * .18 * hl * on;
  /* the cells cast a soft shadow on B */
  float sh = smoothstep(0., t, F) * (1. - inC);
  vec3 b = B * (1. - p_shadow * .6 * sh);
  return vec4(mix(b, cell, inC), 1.);
}` });

/* ---- Passing cloud (cuttlefish chromatophores) ---- */
FX.register({ id:'tr-passing-cloud', name:'Passing cloud', cat:'transition', family:'life',
  search:['cuttlefish', 'chromatophore', 'cephalopod', 'octopus', 'squid', 'skin', 'pigment', 'freckles', 'wave'],
  desc:'Dark bands ripple across the skin like a cuttlefish’s passing cloud, its pigment sacs swelling and closing, and the skin under them turns from A to B.',
  params:[ R('size','Sac size',.018,.008,.06,.001), I('bands','Bands',3,1,8), R('dark','Pigment density',.8,0,1), C('pig','Pigment','#2b160c',false), R('angle','Direction',-20,-180,180,1), R('curve','Band curve',.4,0,1) ],
  fs:`float pc_u(vec2 x, vec2 dir, vec2 nrm){ float b = dot(x, nrm); return dot(x, dir) - p_curve * .5 * b * b + .03 * (fbm(x * 4.) - .5); }
float pc_e(float q, float nb){ float qc = clamp(q, 0., 1.); return step(0., q) * step(q, 1.) * sin(PI * qc) * (.5 - .5 * cos(TAU * nb * qc)); }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec2 x = centered(uv);
  float an = radians(p_angle);
  vec2 dir = vec2(cos(an), sin(an));
  vec2 nrm = vec2(-dir.y, dir.x);
  float span = .5 * (abs(dir.x) * aspect() + abs(dir.y)) + .1;
  float nb = float(int(p_bands + .5));
  float L = .7;
  float head = mix(-span - .1, span + L + .25, p);
  float qq = (head - pc_u(x, dir, nrm)) / L;
  float E = pc_e(qq, nb);
  float swap = smoothstep(.42, .58, qq);
  vec3 skin = mix(A, B, swap);
  /* chromatophore sacs on a jittered grid; each one opens with the passing band */
  float sz = p_size;
  vec2 g = x / sz;
  vec2 id0 = floor(g);
  float cover = 0.;
  vec3 pc = p_pig;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 id = id0 + vec2(i, j);
    vec2 h = hash22(id);
    vec2 c = id + .5 + (h - .5) * .7;
    float Ec = pc_e((head - pc_u(c * sz, dir, nrm)) / L, nb);
    Ec = pow(Ec, .8) * (.75 + .5 * h.y);
    vec2 d = g - c;
    float ang = atan(d.y, d.x);
    float star = 1. + .1 * sin(ang * 6. + h.x * 20.) * Ec;
    float rr = (.05 + .72 * Ec) * star;
    float dd = length(d);
    float aa = fwidth(dd) + 1e-4;
    float m = (1. - smoothstep(rr - aa - .08, rr + aa, dd)) * step(.001, Ec);
    /* three pigments, as in real skin: the chosen one, a warm red and a yellow */
    float hk = hash12(id + 7.);
    vec3 tone = hk < .7 ? p_pig : hk < .92 ? vec3(.55, .16, .06) : vec3(.85, .55, .12);
    tone *= 1. - .35 * (1. - dd / max(rr, 1e-3));
    pc = m > cover ? tone : pc;
    cover = max(cover, m * (.6 + .4 * Ec));
  }
  vec3 col = skin * (1. - .25 * E * p_dark);
  col = mix(col, pc, cover * p_dark);
  return vec4(col, 1.);
}` });

/* ---- Murmuration ---- */
FX.register({ id:'tr-murmuration', name:'Murmuration', cat:'transition', family:'life', nonLocal:true,
  search:['flock', 'starlings', 'birds', 'swarm', 'particles', 'school', 'swirl', 'gather'],
  desc:'A breaks into a flock of specks that gathers into a single turning murmuration over the sky, then spreads back out as B.',
  params:[ I('birds','Birds across',50,24,160), R('size','Flock size',.42,.2,.8), R('swirl','Swirl',.6,0,1.5), R('shape','Shape change',.5,0,1), R('dark','Silhouette',.85,0,1), C('sky','Sky','#d8d4cc',false), R('skymix','Sky over picture',.45,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  float env = smoothstep(0., .42, p) * (1. - smoothstep(.58, 1., p));
  float ee = env * env * (3. - 2. * env);
  vec2 x = centered(uv);
  float ar = aspect();
  /* the flock's centre drifts, its outline breathes and stretches */
  vec2 c0 = vec2(.08 * sin(p * 5.), .06 * cos(p * 4.)) * ee;
  vec2 dx = x - c0;
  float th = atan(dx.y, dx.x);
  vec2 cs = vec2(cos(th), sin(th));
  float nz = vnoise(cs * 1.4 + vec2(p * 3., 1.7)) - .5;
  float st = 1. + .5 * p_shape * cos(2. * th - p * 4.);
  float k = mix(1., p_size * st * (1. + .9 * p_shape * nz), ee);
  vec2 s = dx / k;
  float sw = p_swirl * ee * 2.4 * (1. - smoothstep(0., .8, length(s)));
  s = rot(sw) * s;
  vec2 su = uncentered(s);
  /* birds are cells in the flock's own space; outside the frame there are none */
  float Nb = floor(p_birds);
  vec2 g = su * vec2(Nb, Nb / ar);
  vec2 id = floor(g);
  float h = hash12(id);
  vec2 f = fract(g) - .5 - (hash22(id + 3.) - .5) * .5 * ee;
  float inside = step(0., su.x) * step(su.x, 1.) * step(0., su.y) * step(su.y, 1.);
  /* the flock thins out toward its edges instead of ending on a line */
  vec2 eu = min(su, 1. - su);
  float edgeD = min(eu.x * ar, eu.y);
  inside *= mix(1., step(hash12(id + 11.), smoothstep(0., .18, edgeD) * 1.1 - .05), smoothstep(0., .15, ee));
  float rr = mix(.75, .2 + .14 * h, ee);
  float dd = max(abs(f.x), abs(f.y)) * (1. - ee) + length(f * vec2(1., 1.6 + h)) * ee;
  float aa = fwidth(dd) + 1e-4;
  float bird = (1. - smoothstep(rr - aa, rr + aa, dd)) * inside;
  bird = mix(inside, bird, smoothstep(0., .12, ee));
  float flip = step(mix(.35, .65, h), p);
  vec3 bc = mix(texture(uA, su).rgb, texture(uB, su).rgb, flip);
  bc = mix(bc, bc * .08, p_dark * ee);
  vec3 ha = vec3(0.), hb = vec3(0.);
  for (int i = 0; i < 12; i++){
    float fi = float(i) + .5;
    vec2 o = sqrt(fi / 12.) * .05 * vec2(cos(fi * 2.39996), sin(fi * 2.39996)) / vec2(ar, 1.);
    ha += texture(uA, uv + o).rgb; hb += texture(uB, uv + o).rgb;
  }
  vec3 haze = mix(ha, hb, smoothstep(.3, .7, p)) / 12.;
  vec3 sky = mix(mix(A, B, p), mix(haze, p_sky, p_skymix), smoothstep(0., .3, ee));
  return vec4(mix(sky, bc, bird), 1.);
}` });

/* ---- Bioluminescence ---- */
FX.register({ id:'tr-bioluminescence', name:'Bioluminescence', cat:'transition', family:'life',
  search:['glow', 'plankton', 'night sea', 'dinoflagellate', 'sparkle', 'phosphorescence', 'neon', 'dark'],
  desc:'A sinks into a night sea, B is traced in glowing plankton where its light and edges are, and then B surfaces through the glow.',
  params:[ C('glow','Glow','#38f2d0',false), R('density','Plankton',.55,.05,1), R('speck','Speck size (px)',4,1,10), R('haze','Glow haze',.6,0,1), R('drift','Drift',.5,0,1), R('night','Darkness',.9,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  float dark = smoothstep(0., .35, p) * (1. - smoothstep(.62, .95, p)) * p_night;
  float lit = smoothstep(.15, .45, p) * (1. - smoothstep(.7, .98, p));
  float surf = smoothstep(.5, 1., p);
  vec3 night = mix(A, B, smoothstep(.4, .6, p)) * vec3(.35, .5, .75);
  vec3 base = mix(mix(A, B, surf), night * (1. - .9 * p_night), dark);
  vec2 x = centered(uv);
  /* the water drifts slowly, so the plankton wanders */
  vec2 wv = p_drift * .02 * vec2(fbm(x * 3. + uTime * .08), fbm(x * 3. + 4.3 - uTime * .07)) * sin(PI * p);
  vec2 su = uv + wv;
  float lb = luma(texture(uB, su).rgb);
  /* a small ring for edges, a wide ring for the local mean, so the glow follows B's light */
  float lbb = 0., lm = 0.;
  float jr = hash12(floor(uv * uRes)) * TAU;
  for (int i = 0; i < 8; i++){
    vec2 dv = vec2(cos(float(i) * .785), sin(float(i) * .785));
    lbb += luma(texture(uB, su + dv * 3. / uRes).rgb);
  }
  for (int i = 0; i < 16; i++){
    float fi = float(i) + .5;
    vec2 dv = sqrt(fi / 16.) * vec2(cos(fi * 2.4 + jr), sin(fi * 2.4 + jr));
    lm += luma(texture(uB, su + dv * .2 / vec2(aspect(), 1.)).rgb);
  }
  lbb /= 8.; lm /= 16.;
  float edge = clamp(abs(lb - lbb) * 8., 0., 1.);
  float want = clamp(smoothstep(.0, .22, lb - lm + .03) + edge * 1.5, 0., 1.);
  want *= want;
  vec2 px = su * uRes / max(p_speck * 2.2, 1.);
  vec2 id = floor(px), f = fract(px) - .5;
  vec2 hh = hash22(id);
  vec2 jo = (hash22(id + 5.3) - .5) * .6;
  float dd = length(f - jo);
  float on = step(hh.x, p_density * smoothstep(.15, .5, p));
  float tw = .6 + .4 * sin(uTime * (2. + 3. * hh.y) + hh.x * TAU);
  float spk = (1. - smoothstep(.1, .4, dd)) * on * tw * (.04 + want);
  float halo = p_haze * want * .5;
  vec3 g = p_glow * (spk * 2.2 + halo) * lit;
  return vec4(base + g * (1. - .5 * surf), 1.);
}` });

/* ---- Diatom ---- */
FX.register({ id:'tr-diatom', name:'Diatom', cat:'transition', family:'life',
  search:['radiolaria', 'microscope', 'silica', 'pores', 'symmetry', 'radial', 'lattice', 'plankton', 'shell'],
  desc:'A turns to the glass shell of a diatom, rows of pores open from the centre out in radial symmetry, and B shows through them until the glass is gone.',
  params:[ I('fold','Symmetry',9,3,24), I('rows','Pore rings',20,8,48), R('glass','Glass',.6,0,1), R('relief','Relief',.6,0,1), R('spin','Turn',.3,0,1), R('stagger','Stagger',.4,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  vec2 x = rot(p_spin * .5 * (p - .5)) * centered(uv);
  float r = length(x);
  float th = atan(x.y, x.x);
  float n = floor(p_fold);
  float sec = TAU / n;
  float tf = abs(mod(th + sec * .5, sec) - sec * .5);
  float Rm = length(vec2(aspect(), 1.)) * .5;
  float dr = Rm / floor(p_rows);
  float ri = floor(r / dr);
  float rc = (ri + .5) * dr;
  float a = tf * rc / dr + mod(ri, 2.) * .5;
  float ai = floor(a);
  vec2 loc = vec2(r - rc, (fract(a) - .5) * dr);
  float dd = length(loc);
  float h = hash12(vec2(ri, ai + floor((th + sec * .5) / sec) * 97.));
  float t0 = .08 + (rc / Rm) * .5 + h * .14 * p_stagger;
  float o = clamp((p - t0) / .3, 0., 1.);
  o = o * o * (3. - 2. * o);
  float pr = dr * (.04 + .76 * o) * step(.001, o);
  /* the plain central area and the radial ribs stay glass longest */
  float rib = (sec * .5 - tf) * r;
  float ribw = dr * .16;
  pr *= smoothstep(dr * .8, dr * 1.6, r);
  float fill = smoothstep(.86, 1., p);
  float aa = fwidth(dd) + 1e-5;
  float pore = 1. - smoothstep(pr - aa, pr + aa, dd);
  pore *= smoothstep(ribw * (1. - fill) - aa, ribw * (1. - fill) + aa, rib);
  pore = max(pore, fill);
  float env = smoothstep(0., .2, p) * (1. - fill);
  /* the glass takes on B's tone as the pores open, so the ribs never read as dark lines */
  vec3 Ag = mix(A, B, smoothstep(.35, .85, p));
  vec3 gl = vec3(luma(Ag)) * vec3(.93, 1., 1.03) * .85 + .12;
  vec3 sil = mix(Ag, gl, p_glass * env);
  /* a raised lip around each pore, lit from the upper left */
  float lip = smoothstep(pr + dr * .16, pr, dd) * step(pr, dd) * step(.001, o);
  vec2 ld = normalize(vec2(-.6, .8));
  vec2 gdir = loc / max(dd, 1e-5);
  float lit = dot(gdir, ld);
  sil += p_relief * .22 * lip * lit * env;
  /* ribs read as thicker, brighter glass rather than lines drawn on top */
  float ribOn = smoothstep(.05, .35, p) * env;
  sil = mix(sil, sil * .9 + .1, p_relief * .6 * (1. - smoothstep(0., ribw * 1.5, rib)) * ribOn);
  sil *= 1. - p_relief * .12 * smoothstep(ribw * 1.5, ribw * 3., rib) * (1. - smoothstep(ribw * 3., ribw * 5., rib)) * ribOn;
  vec3 col = mix(sil, B * (1. - .25 * (1. - fill) * smoothstep(pr * .4, pr, dd)), pore);
  return vec4(col, 1.);
}` });

/* ---- Mycelium ---- */
FX.register({ id:'tr-mycelium', name:'Mycelium', cat:'transition', family:'life',
  search:['fungus', 'hyphae', 'threads', 'branching', 'roots', 'network', 'spores', 'mould'],
  desc:'Fine white threads branch out from a few spores, forking as they go, and B grows in along them until the mat closes over A.',
  params:[ I('spores','Spores',3,1,5), I('threads','Threads per spore',7,3,16), R('wander','Wander',.75,0,1), R('weight','Thread weight (px)',1.4,.5,4), C('hypha','Thread colour','#f4f1e8',false), R('glow','Thread glow',.5,0,1) ],
  fs:`float my_ang(float c, float N){ return (c + .5) / N * TAU; }
float my_wrap(float a){ return mod(a + PI, TAU) - PI; }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  vec2 x = centered(uv);
  float ar = aspect();
  float px = 1. / uRes.y;
  float step1 = .085;
  float best = 0., line = 0., tipGlow = 0.;
  int ns = int(clamp(p_spores, 1., 5.) + .5);
  for (int sp = 0; sp < 5; sp++){
    if (sp >= ns) break;
    float fs = float(sp);
    vec2 org = ns == 1 ? vec2(0.) : (hash22(vec2(fs, 4.2)) - .5) * vec2(ar, 1.) * .78;
    vec2 d = x - org;
    float r = length(d);
    float th = atan(d.y, d.x) + hash12(vec2(fs, 1.)) * TAU;
    vec2 cs = vec2(cos(th), sin(th));
    th += p_wander * .9 * (fbm(cs * 1.2 + r * 5. + fs * 7.) - .5) * (1. - exp(-r * 6.));
    float lv = floor(r / step1), f = fract(r / step1);
    float N0 = floor(p_threads);
    float Np = N0 * exp2(min(lv, 4.)), Nc = N0 * exp2(min(lv + 1., 4.));
    float split = Nc > Np ? 1. : 0.;
    float cc = floor(mod(th, TAU) / TAU * Nc);
    float dmin = 1e3, cbest = 0.;
    for (int k = -1; k <= 1; k++){
      float c = mod(cc + float(k), Nc);
      float par = split > .5 ? floor(c / 2.) : c;
      float ac = my_ang(c, Nc), ap = my_ang(par, Np);
      float e = smoothstep(0., .75, f);
      float am = ap + my_wrap(ac - ap) * (split > .5 ? e : 1.);
      float dd = abs(my_wrap(th - am)) * r;
      if (dd < dmin){ dmin = dd; cbest = c; }
    }
    /* each thread has its own reach, so the edge of the colony is ragged */
    float reach = p * 1.55 - .08 - hash12(vec2(cbest + lv * 13., fs)) * .18;
    float grown = step(r, reach);
    float tip = 1. - smoothstep(0., .04, abs(reach - r));
    float wpx = p_weight * px * .5;
    float core = (1. - smoothstep(wpx, wpx + px * 1.2, dmin)) * grown;
    float W = max(0., reach - r) * .09;
    float m = (1. - smoothstep(W, W + px * 2., dmin)) * grown;
    best = max(best, m);
    line = max(line, core * (1. - smoothstep(.04, .3, reach - r)));
    tipGlow = max(tipGlow, tip * grown * (1. - smoothstep(0., px * 8., dmin)));
  }
  float fill = smoothstep(.82, 1., p);
  best = max(best, fill);
  vec3 col = mix(A, B, best);
  float halo = p_glow * .35 * tipGlow;
  col = mix(col, p_hypha, clamp(line * .9 + halo, 0., 1.) * (1. - fill));
  return vec4(col, 1.);
}` });

/* ---- Wing scales ---- */
FX.register({ id:'tr-wing-scales', name:'Wing scales', cat:'transition', family:'life',
  search:['butterfly', 'moth', 'scales', 'iridescent', 'structural colour', 'shingle', 'mosaic', 'flip'],
  desc:'A settles into the shingled scales of a butterfly wing, each scale tips over to B with a flash of structural colour, and the scales melt back into the picture.',
  params:[ R('size','Scale size',.026,.012,.07,.001), R('sheen','Iridescence',.7,0,1), S('order','Order',['Light of B','Diagonal','From centre'],0), R('ridges','Ridges',.4,0,1), R('mosaic','Mosaic',1,0,1), C('membrane','Membrane','#121212','ground') ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec2 x = centered(uv);
  float h = p_size, w = h * .95;
  float jr = floor(x.y / h);
  float L = 1.8 * h, hw = w * .5;
  float found = 0.; vec2 lc = vec2(0.), sc = vec2(0.), sid = vec2(0.);
  /* the row above hangs over this one, so it is tested first */
  for (int k = 2; k >= 0; k--){
    float j = jr + float(k);
    float off = mod(j, 2.) * .5;
    float i = floor(x.x / w + off);
    vec2 sock = vec2((i + .5 - off) * w, j * h);
    vec2 q = x - sock;
    q.y = -q.y;
    float tl = hash12(vec2(i, j)) - .5;
    q = rot(tl * .12) * q;
    float teeth = .012 * h * (1. - abs(cos(q.x / hw * PI * 1.5)));
    float d = sdRoundBox(q - vec2(0., L * .5), vec2(hw * .92, L * .5), hw * .8) - teeth * smoothstep(L * .6, L, q.y);
    if (d < 0. && q.y > -h * .1){ found = 1.; lc = q; sid = vec2(i, j); sc = sock + vec2(0., -L * .62); break; }
  }
  vec2 scu = uncentered(sc);
  float hb = luma(texture(uB, scu).rgb);
  int ord = int(p_order + .5);
  float o = ord == 0 ? 1. - hb : ord == 1 ? (sc.x / aspect() - sc.y) * .5 + .5 : length(sc) / .64;
  o = clamp(o * .8 + hash12(sid + 5.) * .2, 0., 1.);
  float t0 = .2 + o * .45;
  float fl = clamp((p - t0) / .14, 0., 1.);
  float phi = fl * PI;
  float side = step(.5, fl);
  float env = smoothstep(.02, .18, p) * (1. - smoothstep(.82, .98, p)) * p_mosaic;
  /* the scale turns on its long axis, so it narrows to an edge at the halfway point */
  float cw = abs(cos(phi));
  float inS = found * step(abs(lc.x), hw * max(cw, .04) * 1.02);
  vec3 ca = texture(uA, scu).rgb, cb = texture(uB, scu).rgb;
  vec3 sCol = mix(ca, cb, side);
  float along = clamp(lc.y / L, 0., 1.);
  sCol *= .78 + .3 * along;
  sCol *= 1. - p_ridges * .18 * (.5 + .5 * sin(lc.x / hw * 26.));
  float edgeOn = pow(sin(phi), 3.);
  vec3 film = hsv2rgb(vec3(fract(.5 + .22 * fl + .1 * along), .45, .95));
  sCol = mix(sCol, film * (.5 + .7 * luma(sCol)), p_sheen * edgeOn * .7);
  float glint = p_sheen * .25 * pow(max(0., sin(phi * 2. + along * 2.)), 6.) * step(.001, fl) * step(fl, .999);
  sCol += glint;
  /* where a scale has turned edge-on, the scale under it shows, in shadow */
  vec3 under = mix(cb, ca, step(fl, .5)) * .55;
  vec3 mos = mix(found > .5 ? under : p_membrane, sCol, inS);
  vec3 img = mix(A, B, side * found + (1. - found) * step(.5, p));
  return vec4(mix(img, mos, env), 1.);
}` });

/* ---- Camouflage ---- */
FX.register({ id:'tr-camouflage', name:'Camouflage', cat:'transition', family:'life',
  search:['hidden', 'blend in', 'disruptive', 'frequency', 'texture', 'colour transfer', 'mimicry', 'crypsis'],
  desc:'B first appears only as texture inside A’s colours, hidden like an animal against its ground, then takes its own colour patch by patch.',
  params:[ R('radius','Colour scale',.05,.01,.12,.001), R('detail','Detail strength',1.2,.3,2.5), R('patch','Patch size',.5,.1,1), S('order','Patches',['Disruptive','Soft'],0), R('lag','Colour lag',.5,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  vec3 la = vec3(0.), lb = vec3(0.);
  vec2 sc = vec2(p_radius) / vec2(aspect(), 1.);
  for (int i = 0; i < 18; i++){
    float fi = float(i) + .5;
    vec2 o = sqrt(fi / 18.) * vec2(cos(fi * 2.39996), sin(fi * 2.39996)) * sc;
    la += texture(uA, uv + o).rgb; lb += texture(uB, uv + o).rgb;
  }
  la /= 18.; lb /= 18.;
  vec3 dA = A - la, dB = B - lb;
  vec2 x = centered(uv);
  float s = 2.2 / p_patch;
  vec2 wq = x * s + .35 * vec2(fbm(x * s * .7 + 3.), fbm(x * s * .7 + 8.));
  float n = fbm(wq);
  int ord = int(p_order + .5);
  float t1 = mix(.25, .45, p_lag);
  float q = clamp((p - t1) / (1. - t1 - .05), 0., 1.);
  float thr = mix(.85, .1, q);
  float aa = ord == 0 ? fwidth(n) + 1e-4 : .08;
  float mLow = smoothstep(thr - aa, thr + aa, n);
  mLow = max(mLow, smoothstep(.9, 1., p));
  /* B's texture comes first, carried on A's colour */
  float ds = smoothstep(.03, t1, p);
  vec3 det = mix(dA, dB * p_detail, ds);
  det = mix(det, dB, mLow);
  vec3 low = mix(la, lb, mLow);
  return vec4(clamp(low + det, 0., 1.), 1.);
}` });

/* ---- Cilia ---- */
FX.register({ id:'tr-cilia', name:'Cilia', cat:'transition', family:'life',
  search:['hairs', 'beating', 'conveyor', 'metachronal', 'ratchet', 'push', 'fur', 'wave'],
  desc:'A carpet of fine hairs beats in rippling waves and passes the picture along stroke by stroke, carrying A out and B in.',
  params:[ I('strokes','Strokes',6,2,12), R('ripple','Ripple',.6,0,1), R('angle','Direction',0,-180,180,1), R('hair','Hair density',.8,0,1), R('length','Hair length',.8,.2,1.2), R('show','Hair visibility',.5,0,1) ],
  fs:`float ci_seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 x = centered(uv);
  float ar = aspect();
  float an = radians(p_angle);
  vec2 dir = vec2(cos(an), sin(an)), nrm = vec2(-dir.y, dir.x);
  /* the push distance is a whole frame along the direction */
  float span = abs(dir.x) * ar + abs(dir.y);
  float n = floor(p_strokes);
  float ph = dot(x, nrm) * 2.2 + dot(x, dir) * 1.2;
  /* power stroke fast, recovery slow; the phase ripples across the carpet */
  float amp = p_ripple * .9;
  float D = p - amp * sin(TAU * (n * p - ph)) / (TAU * n) + amp * sin(-TAU * ph) / (TAU * n) * (1. - p) - amp * sin(TAU * (n - ph)) / (TAU * n) * p;
  vec2 s = x - dir * D * span;
  vec2 su = uncentered(s);
  vec3 col;
  if (su.x >= 0. && su.x <= 1. && su.y >= 0. && su.y <= 1.) col = texture(uA, su).rgb;
  else col = texture(uB, uncentered(s + dir * span)).rgb;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  /* the hairs themselves, beating in the same wave */
  float env = sin(PI * p) * p_show;
  float cs = mix(.03, .008, p_hair);
  vec2 g = x / cs;
  vec2 id0 = floor(g);
  float dmin = 1e3, hl = 0.;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 id = id0 + vec2(i, j);
    vec2 bse = id + .5 + (hash22(id) - .5) * .8;
    vec2 bx = bse * cs;
    float bph = dot(bx, nrm) * 2.2 + dot(bx, dir) * 1.2;
    float st = fract(n * p - bph);
    float sw = st < .3 ? mix(-1., 1., smoothstep(0., .3, st)) : mix(1., -1., smoothstep(.3, 1., st));
    float a = an + sw * .9 + (hash12(id) - .5) * .4;
    vec2 tipv = vec2(cos(a), sin(a)) * p_length * 1.5;
    /* the recovery stroke bends the hair; the power stroke keeps it straight */
    vec2 mid = tipv * .5 + nrm * (st < .3 ? 0. : .25 * sin(PI * st));
    float d = min(ci_seg(g, bse, bse + mid), ci_seg(g, bse + mid, bse + tipv));
    if (d < dmin){ dmin = d; hl = .5 + .5 * sw; }
  }
  float wv = max(.06, .7 * uPx / (cs * uRes.y));
  float aa = fwidth(dmin) + 1e-4;
  float hair = 1. - smoothstep(wv - aa, wv + aa, dmin);
  vec3 hc = col * (.7 + .6 * hl) + .04;
  /* the waves read as broad bands where the hairs all lean the same way */
  float band = sin(TAU * (n * p - ph));
  col *= 1. + .12 * band * env;
  col = mix(col, hc, hair * env);
  col *= 1. - .18 * env * (1. - smoothstep(0., wv * 4., dmin)) * (1. - hair);
  return vec4(col, 1.);
}` });

/* ---- Blink ---- */
FX.register({ id:'tr-blink', name:'Blink', cat:'transition', family:'life',
  search:['eye', 'eyelid', 'pov', 'wake up', 'close eyes', 'cut', 'point of view', 'vision'],
  desc:'The eyelids close on A, light glows warm through them, and they open on B, which comes into focus.',
  params:[ S('flutter','Opening',['Once','Flutter'],1), R('curve','Lid curve',.45,0,.5), R('soft','Lid softness',.5,0,1), C('lid','Lid colour','#3a1008',false), R('glow','Light through lids',.6,0,1), R('focus','Focus pull',.6,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  float c1 = smoothstep(0., .4, p);
  float o = p < .5 ? 1. - c1 * c1 : smoothstep(.5, 1., p);
  if (p >= .4 && p < .5) o = 0.;
  if (int(p_flutter + .5) == 1) o *= 1. - .55 * exp(-pow((p - .74) / .055, 2.));
  vec2 x = centered(uv);
  float X = x.x / max(aspect(), .5) * .8;
  float sw = .006 + .05 * p_soft;
  /* closed, the lids overlap a little so no light gets between them */
  float yU = mix(-.04 - 2. * sw, .64, o) - p_curve * X * X * o;
  float yL = mix(-.04 + 2. * sw, -.64, o) + p_curve * .6 * X * X * o;
  float lid = max(smoothstep(yU - sw, yU + sw, x.y), smoothstep(yL + sw, yL - sw, x.y));
  /* B comes back soft and pulls into focus */
  float bl = p_focus * .02 * (1. - smoothstep(.5, .95, p));
  vec3 bb = B;
  if (bl > 0.){
    bb = vec3(0.);
    for (int i = 0; i < 12; i++){
      float fi = float(i) + .5;
      vec2 off = sqrt(fi / 12.) * vec2(cos(fi * 2.39996), sin(fi * 2.39996)) * bl / vec2(aspect(), 1.);
      bb += texture(uB, uv + off).rgb;
    }
    bb /= 12.;
  }
  vec3 scene = p < .45 ? A : bb;
  /* light through the lids: a warm red glow lit by the scene's brightness */
  vec3 avg = p < .45 ? A : B;
  vec3 lc = p_lid * (.45 + 1.6 * p_glow * luma(avg)) + p_glow * .06 * vec3(1., .3, .15) * (1. - abs(x.y) * 1.5);
  /* a shadow under each lid edge, as the lashes and lid cast it */
  float shadow = max(smoothstep(yU - sw - .07, yU - sw, x.y), smoothstep(yL + sw + .05, yL + sw, x.y));
  scene *= 1. - .45 * shadow * (1. - o * o);
  float vig = (1. - o) * .6 * smoothstep(.2, .7, length(x));
  scene *= 1. - vig;
  return vec4(mix(scene, lc, lid), 1.);
}` });

/* ---- Moult ---- */
FX.register({ id:'tr-moult', name:'Moult', cat:'transition', family:'life',
  search:['shed', 'snake', 'skin', 'peel', 'reptile', 'scales', 'ecdysis', 'renewal'],
  desc:'A clouds over like a snake’s old skin, its scales standing out, then the skin peels back and bunches up to show B fresh underneath.',
  params:[ R('size','Scale size',.035,.012,.08,.001), R('cloud','Clouding',.55,0,1), R('relief','Scale relief',.6,0,1), R('angle','Peel direction',-90,-180,180,1), R('bunch','Bunching',.6,0,1), C('milk','Old skin','#c9d2d6',false) ],
  fs:`float mo_h(vec2 x, float s){ vec2 q = rot(.785398) * x / s; q.x *= .75; vec2 f = fract(q) - .5; return 1. - 2. * max(abs(f.x), abs(f.y)); }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  vec2 x = centered(uv);
  float an = radians(p_angle);
  vec2 dir = vec2(cos(an), sin(an)), nrm = vec2(-dir.y, dir.x);
  float span = .5 * (abs(dir.x) * aspect() + abs(dir.y));
  float u = dot(x, dir);
  float v = dot(x, nrm);
  float f0 = -span - .02;
  float pe = smoothstep(.3, 1., p);
  float bw = .02 + .12 * p_bunch;
  float front = mix(f0, span + bw + .06, pe) + .03 * (fbm(vec2(v * 6., 1.)) - .5);
  float cl = smoothstep(0., .3, p);
  vec3 col;
  if (u < front){
    /* fresh skin: a little richer and glossier, settling as it dries */
    float fr = 1. - smoothstep(.7, 1., p);
    vec3 bs = mix(vec3(luma(B)), B, 1. + .25 * fr);
    float gloss = exp(-pow((u - front + .12) * 9., 2.)) * .18 * fr;
    col = bs + gloss;
  } else {
    float s = u;
    float bunch = 0.;
    float bwe = min(bw, front - f0 + .001);
    if (u < front + bwe){
      /* everything already peeled is crumpled into the band ahead of the front */
      float t = (u - front) / bwe;
      s = mix(f0, front + bwe, t * t);
      bunch = 1. - t;
    }
    vec2 sx = dir * s + nrm * v;
    vec3 a = texture(uA, uncentered(sx)).rgb;
    float hgt = mo_h(sx, p_size);
    float e = .002;
    float gx = mo_h(sx + vec2(e, 0.), p_size) - hgt, gy = mo_h(sx + vec2(0., e), p_size) - hgt;
    float lit = clamp(.5 - (gx * -.6 + gy * .8) / e * p_size * .25, 0., 1.);
    vec3 milky = mix(a, p_milk * (.55 + .6 * luma(a)), p_cloud * cl);
    milky *= 1. + p_relief * cl * (lit - .5) * .5;
    milky *= 1. - p_relief * cl * .25 * (1. - smoothstep(0., .14, hgt));
    float wr = .5 + .5 * sin(s * 140. + fbm(vec2(v * 9., s * 4.)) * 6.);
    milky *= 1. - bunch * .35 * wr;
    milky += bunch * .15 * smoothstep(.7, 1., wr);
    float lip = 1. - smoothstep(0., .012, u - front);
    milky = mix(milky, p_milk, lip * .5 * step(.001, pe));
    col = milky;
    float sh = exp(-(u - front) * 30.) * step(.001, pe);
    col *= 1. - .0 * sh;
  }
  float shadow = exp(-max(front - u, 0.) * 40.) * step(u, front) * step(.001, pe) * (1. - smoothstep(.9, 1., p));
  col *= 1. - .35 * shadow;
  return vec4(col, 1.);
}` });

/* ---- Heartbeat ---- */
FX.register({ id:'tr-heartbeat', name:'Heartbeat', cat:'transition', family:'life',
  search:['pulse', 'lub dub', 'beat', 'thump', 'rhythm', 'pump', 'cardiac', 'throb'],
  desc:'The frame thumps like a heart, lub-dub, swelling on each beat, and every beat pumps B a little further out from the centre.',
  params:[ I('beats','Heartbeats',2,1,4), R('swell','Swell',.5,0,1), R('flush','Flush',.4,0,1), C('flushc','Flush colour','#b0201a',false), R('edge','Front softness',.3,0,1), R('wobble','Front wobble',.5,0,1) ],
  fs:`float hb_k(float d){ return d <= 0. ? 0. : d * 38. * exp(1. - d * 38.); }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A0 = texture(uA, uv).rgb, B0 = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A0, 1.);
  if (p >= 1.) return vec4(B0, 1.);
  int nb = int(clamp(p_beats, 1., 4.) + .5);
  float fn = float(nb);
  float per = .72 / fn;
  float K = 0., R = 0., tot = 0., ring = 0.;
  vec2 x = centered(uv);
  float r = length(x);
  for (int i = 0; i < 8; i++){
    if (i >= nb * 2) break;
    float bi = floor(float(i) / 2.);
    float dub = mod(float(i), 2.);
    float t = .1 + bi * per + dub * .11;
    float w = dub > .5 ? .7 : 1.;
    float k = hb_k(p - t) * w;
    K += k;
    R += w * smoothstep(t, t + .07, p);
    tot += w;
    float rw = (p - t) * 3.2;
    ring += w * step(t, p) * exp(-pow((r - rw) * 18., 2.)) * exp(-(p - t) * 9.);
  }
  float fade = 1. - smoothstep(.88, 1., p);
  K *= fade; ring *= fade;
  float Rmax = length(vec2(aspect(), 1.)) * .5 + .08;
  float front = Rmax * R / tot;
  /* each beat swells the middle of the frame */
  float sw = p_swell * .07 * K * exp(-r * r * 3.);
  vec2 xs = x * (1. - sw) * (1. - .015 * p_swell * ring);
  vec2 su = uncentered(xs);
  vec3 A = texture(uA, su).rgb, B = texture(uB, su).rgb;
  float th = atan(x.y, x.x);
  float wob = p_wobble * .03 * (fbm(vec2(cos(th), sin(th)) * 2. + p * 2.) - .5) * (1. - R / tot);
  float soft = .004 + .05 * p_edge;
  float m = 1. - smoothstep(front - soft, front + soft, r + wob);
  vec3 col = mix(A, B, m);
  float rim = exp(-pow((r + wob - front) / (soft + .01), 2.)) * (1. - R / tot) * step(.001, R);
  col *= 1. - .3 * rim;
  col = mix(col, col * (1. - p_flush) + p_flushc * p_flush * (.4 + luma(col)), clamp(K * .5 + ring * .6, 0., 1.) * p_flush);
  return vec4(col, 1.);
}` });

/* ---- Afterimage ---- */
FX.register({ id:'tr-afterimage', name:'Afterimage', cat:'transition', family:'life',
  search:['retina', 'negative', 'ghost', 'persistence of vision', 'complementary', 'stare', 'optical illusion', 'perception'],
  desc:'A is held until the eye tires of it, the frame goes to a plain wall where A lingers as its own complementary ghost, and B rises through the fading ghost.',
  params:[ R('strength','Ghost strength',.5,0,1), R('soft','Ghost softness',.4,0,1), R('fatigue','Fatigue',.5,0,1), C('wall','Wall','#c8c4bc',false), R('drift','Eye drift',.4,0,1), R('hold','Wall hold',.35,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  float tc = .4;
  float hold = .1 + .25 * p_hold;
  if (p < tc){
    /* the eye adapts: colour and contrast slowly drain from A */
    float f = smoothstep(0., tc, p) * p_fatigue;
    vec3 a = mix(A, vec3(luma(A)), .45 * f);
    a = mix(a, vec3(.5), .18 * f);
    return vec4(a, 1.);
  }
  float d = (p - tc) / (1. - tc);
  /* the ghost drifts a little, as the eye does */
  vec2 dr = p_drift * .012 * vec2(sin(p * 9. + 1.), cos(p * 7.)) * d;
  float bl = .002 + .02 * p_soft;
  vec3 g = vec3(0.);
  for (int i = 0; i < 14; i++){
    float fi = float(i) + .5;
    vec2 o = sqrt(fi / 14.) * vec2(cos(fi * 2.39996), sin(fi * 2.39996)) * bl / vec2(aspect(), 1.);
    g += texture(uA, uv + dr + o).rgb;
  }
  g /= 14.;
  float decay = pow(1. - smoothstep(0., 1., d), 1.6);
  float rise = smoothstep(hold * .7, 1., d);
  vec3 base = mix(p_wall, B, rise);
  /* the complement of A: where A was red the eye now sees cyan, where it was bright it sees dark */
  vec3 neg = (vec3(luma(g)) - g) * 1.6 - (luma(g) - .45) * .6;
  vec3 col = base * (1. + neg * p_strength * decay * 1.4);
  col = mix(col, base, 1. - smoothstep(0., .04, d));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Slime mould ---- */
FX.register({ id:'tr-physarum', name:'Slime mould', cat:'transition', family:'life',
  search:['physarum', 'network', 'tubes', 'veins', 'transport', 'organic', 'foraging', 'blob'],
  desc:'B spreads like a slime mould: a fan-shaped front of fine veins that prunes itself to a few thick tubes, which swell, feeding on the light parts of B first.',
  params:[ S('origin','Origin',['Bottom left','Centre','Bottom','Left'],0), R('scale','Vein scale',.5,0,1), C('tint','Plasmodium','#e8c21a',false), R('tintamt','Tint',.45,0,1), R('stream','Streaming',.5,0,1), R('feed','Feeds on light',.6,0,1) ],
  fs:`float pv_edge(vec2 g){
  vec2 i0 = floor(g); float d1 = 8., d2 = 8.;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 id = i0 + vec2(i, j);
    vec2 c = id + .5 + (hash22(id) - .5) * .85;
    float d = length(g - c);
    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  vec2 x = centered(uv);
  float ar = aspect();
  int o = int(p_origin + .5);
  vec2 org = o == 0 ? vec2(-.5 * ar, -.5) : o == 1 ? vec2(0.) : o == 2 ? vec2(0., -.55) : vec2(-.5 * ar - .05, 0.);
  float dmax = o == 0 ? length(vec2(ar, 1.)) : o == 1 ? length(vec2(ar, 1.)) * .5 : o == 2 ? length(vec2(ar * .5, 1.05)) : ar + .05;
  float lb = luma(B);
  float dN = length(x - org) / dmax + .16 * (fbm(x * 7.) - .5) + .06 * (fbm(x * 22.) - .5);
  dN -= p_feed * .12 * (lb - .5);
  float span = .5;
  float tau = (p * (1. + span + .12) - dN) / span;
  float sc = mix(.6, 1.6, p_scale);
  vec2 xw = x + .03 * vec2(fbm(x * 6.), fbm(x * 6. + 3.)) - .015;
  float ef = pv_edge(xw * 26. / sc);
  float ec = pv_edge(xw * 7.5 / sc + 11.);
  float lf = fwidth(ef) + 1e-4, lc = fwidth(ec) + 1e-4;
  float wF = (.06 + .22 * lb * p_feed) * (1. - smoothstep(.15, .55, tau)) * step(0., tau);
  float fine = 1. - smoothstep(wF - lf, wF + lf, ef);
  fine *= step(.0005, wF);
  float wC = ((.03 + .1 * lb * p_feed) * smoothstep(0., .25, tau) + smoothstep(.35, 1., tau) * .75) * step(0., tau);
  float coarse = (1. - smoothstep(wC - lc, wC + lc, ec)) * step(.0005, wC);
  float sheet = smoothstep(0., .015, tau) * (1. - smoothstep(.025, .08, tau));
  float m = max(max(fine, coarse), sheet);
  m = max(m, smoothstep(.92, 1., tau));
  float young = 1. - smoothstep(.2, .9, tau);
  float strm = p_stream * .12 * sin(dN * 70. - uTime * 3.) * young;
  vec3 bt = mix(B, B * .45 + p_tint * (.35 + .55 * lb), p_tintamt * young) * (1. + strm);
  /* what the mould has passed over is a little spent */
  vec3 a = A * (1. - .15 * smoothstep(0., .3, tau) * young);
  return vec4(mix(a, bt, m), 1.);
}` });
