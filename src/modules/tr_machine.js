/* ---------------- Transitions: machine ---------------- */
/* How computers and devices make pictures. Each one undoes A by the machine's
   own process and builds B the same way: codec blocks, interlaced loading,
   depth buffers, mip levels, phosphor, e-paper, sensor mosaics, indexed
   palettes. Every one starts exactly on A and ends exactly on B; the machine
   shows only in the middle of the move. Sizes are counted across the frame,
   so the look holds at any output size. */

/* ---- JPEG coefficients ---- */
FX.register({ id:'tr-dct-zigzag', name:'JPEG coefficients', cat:'transition', family:'machine', nonLocal:true,
  search:['jpeg', 'dct', 'compression', 'codec', 'blocks', 'zig-zag', 'artefacts', 'quality', 'cosine'],
  desc:'A loses its detail coefficient by coefficient in 8×8 blocks, the way JPEG throws it away, each block swaps to B at its coarsest, and B is rebuilt the same way.',
  params:[ I('blocks','Blocks across',22,6,60), R('chroma','Colour lag',3,1,8,.1), R('quant','Quantisation',.5,0,1), R('spread','Block stagger',.16,0,.4), I('floor','Fewest coefficients',3,1,10) ],
  fs:`vec3 dct_ycc(vec3 c){ return vec3(dot(c, vec3(.299, .587, .114)), dot(c, vec3(-.1687, -.3313, .5)), dot(c, vec3(.5, -.4187, -.0813))); }
vec3 dct_rgb(vec3 y){ return vec3(y.x + 1.402 * y.z, y.x - .34414 * y.y - .71414 * y.z, y.x + 1.772 * y.y); }
/* position of coefficient (u, v) in JPEG's zig-zag scan */
int dct_rank(int u, int v){
  int d = u + v;
  int before = d <= 7 ? d * (d + 1) / 2 : 64 - (15 - d) * (16 - d) / 2;
  int xmin = max(0, d - 7), xmax = min(d, 7);
  int pos = (d % 2 == 0) ? u - xmin : xmax - u;
  return before + pos;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 px = uv * uRes;
  float bs = uRes.x / p_blocks;
  vec2 bi = floor(px / bs);
  /* each block swaps from A to B at its own moment, while it is down to one flat colour */
  float tb = .5 + (hash12(bi + 3.7) - .5) * p_spread;
  bool useB = p >= tb;
  float s = useB ? (1. - p) / max(1. - tb, 1e-3) : p / max(tb, 1e-3);
  vec3 exact = useB ? texture(uB, uv).rgb : texture(uA, uv).rgb;
  if (s <= 0.) return vec4(exact, 1.);
  float k = clamp((s - .1) / .82, 0., 1.);
  /* most of the time is spent on the last dozen coefficients, where the cosine patterns show */
  float K = floor(p_floor + (64. - p_floor) * pow(1. - k, 3.) + .5);
  float Kc = max(1., floor(K / p_chroma + .5));
  vec3 f[64];
  for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++){
    vec2 q = (bi * bs + (vec2(i, 7 - j) + .5) * bs / 8.) / uRes;
    vec3 c = useB ? texture(uB, q).rgb : texture(uA, q).rgb;
    f[j * 8 + i] = dct_ycc(c);
  }
  float cs[64];
  for (int u = 0; u < 8; u++) for (int x = 0; x < 8; x++) cs[u * 8 + x] = cos(float(2 * x + 1) * float(u) * PI / 16.);
  /* separable forward DCT: rows here, columns inside the reconstruction */
  vec3 G[64];
  for (int u = 0; u < 8; u++) for (int y = 0; y < 8; y++){
    vec3 acc = vec3(0.);
    for (int x = 0; x < 8; x++) acc += f[y * 8 + x] * cs[u * 8 + x];
    G[u * 8 + y] = acc;
  }
  vec2 l = (px - bi * bs) / bs * 8. - .5;
  l.y = 7. - l.y;
  float bx[8], by[8];
  for (int u = 0; u < 8; u++){ bx[u] = cos((2. * l.x + 1.) * float(u) * PI / 16.); by[u] = cos((2. * l.y + 1.) * float(u) * PI / 16.); }
  vec3 rec = vec3(0.);
  for (int v = 0; v < 8; v++) for (int u = 0; u < 8; u++){
    int r = dct_rank(u, v);
    if (float(r) >= K) continue;
    vec3 F = vec3(0.);
    for (int y = 0; y < 8; y++) F += G[u * 8 + y] * cs[v * 8 + y];
    float cu = u == 0 ? .70710678 : 1., cv = v == 0 ? .70710678 : 1.;
    F *= cu * cv * .25;
    /* coarser steps for the higher frequencies, as a quality table would */
    float qs = p_quant * .09 * (1. + float(u + v) * .6) * k;
    if (qs > 1e-4 && r > 0) F = floor(F / qs + .5) * qs;
    float wc = float(r) < Kc ? 1. : 0.;
    rec += F * vec3(1., wc, wc) * cu * cv * .25 * bx[u] * by[v];
  }
  vec3 col = clamp(dct_rgb(rec), 0., 1.);
  col = mix(exact, col, smoothstep(0., .1, s));
  return vec4(col, 1.);
}` });

/* ---- Adam7 / interlaced GIF passes ---- */
FX.register({ id:'tr-interlace-passes', name:'Interlaced load', cat:'transition', family:'machine',
  search:['png', 'adam7', 'gif', 'interlaced', 'progressive', 'loading', 'download', 'web', 'pixels', 'dial-up'],
  desc:'B loads over A the way an interlaced PNG or GIF does: coarse passes sweep down the frame, each doubling the detail, until the full picture lands.',
  params:[ S('mode','Scheme',['PNG Adam7 (7 passes)','GIF rows (4 passes)'],0), I('across','Pixels across',96,24,320), S('fill','Unloaded pixels',['Stretched (as browsers draw)','Left showing A'],0), R('overlap','Pass overlap',.35,0,.8), T('line','Show the loading line',true) ],
  fs:`const vec4 ADAM_G[7] = vec4[7](vec4(0, 0, 8, 8), vec4(4, 0, 8, 8), vec4(0, 4, 4, 8), vec4(2, 0, 4, 4), vec4(0, 2, 2, 4), vec4(1, 0, 2, 2), vec4(0, 1, 1, 2));
const vec2 ADAM_S[7] = vec2[7](vec2(8, 8), vec2(4, 8), vec2(4, 4), vec2(2, 4), vec2(2, 2), vec2(1, 2), vec2(1, 1));
const vec4 GIF_G[4] = vec4[4](vec4(0, 0, 1, 8), vec4(0, 4, 1, 8), vec4(0, 2, 1, 4), vec4(0, 1, 1, 2));
const vec2 GIF_S[4] = vec2[4](vec2(1, 8), vec2(1, 4), vec2(1, 2), vec2(1, 1));
vec4 fx(vec2 uv){
  float p = uProgress;
  bool gif = p_mode > .5;
  int np = gif ? 4 : 7;
  float ps = uRes.x / p_across;
  float rows = ceil(uRes.y / ps);
  float c = floor(uv.x * uRes.x / ps), r = floor((1. - uv.y) * uRes.y / ps);
  /* np passes plus a last full-resolution sweep, evenly spaced and overlapping a little */
  float n = float(np + 1);
  float L = .92 / (n - (n - 1.) * p_overlap);
  float stepT = L * (1. - p_overlap);
  vec3 col = texture(uA, uv).rgb;
  float lineGlow = 0.;
  for (int k = 0; k < 7; k++){
    if (k >= np) break;
    vec4 g = gif ? GIF_G[k] : ADAM_G[k];
    vec2 sz = gif ? GIF_S[k] : ADAM_S[k];
    float t0 = .04 + float(k) * stepT;
    float sweep = clamp((p - t0) / L, 0., 1.) * 1.02;
    float mx = mod(c - g.x, g.z), my = mod(r - g.y, g.w);
    bool cover = p_fill < .5 ? (mx < sz.x && my < sz.y) : (mx < .5 && my < .5);
    float sr = r - my;
    if (cover && (sr + .5) / rows < sweep)
      col = texture(uB, vec2((c - mx + .5) * ps / uRes.x, 1. - (sr + .5) * ps / uRes.y)).rgb;
    if (sweep > 0. && sweep < 1.) lineGlow = max(lineGlow, exp(-abs((r + .5) / rows - sweep) * rows * .9));
  }
  float t0 = .04 + float(np) * stepT;
  float sweep = clamp((p - t0) / L, 0., 1.) * 1.02;
  if (1. - uv.y < sweep) col = texture(uB, uv).rgb;
  if (sweep > 0. && sweep < 1.) lineGlow = max(lineGlow, exp(-abs(1. - uv.y - sweep) * rows * .9));
  if (p_line > .5) col = mix(col, vec3(1.), .35 * lineGlow * step(.001, p) * step(p, .999));
  return vec4(col, 1.);
}` });

/* ---- Z-fighting ---- */
FX.register({ id:'tr-zfight', name:'Z-fighting', cat:'transition', family:'machine',
  search:['depth buffer', 'z-buffer', '3d', 'render', 'flicker', 'coplanar', 'stripes', 'interference'],
  desc:'A and B become two surfaces at the same depth and fight for every pixel in shimmering bands, until B comes out in front.',
  params:[ R('bands','Band density',46,8,160,1), R('relief','Picture relief',.7,0,2), R('bend','Bands follow tone',.6,0,2), R('angle','Floor angle',-12,-90,90,1), R('depth','Perspective',.7,0,1.5), R('shimmer','Shimmer',.3,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float la = luma(a), lb = luma(b);
  vec2 q = centered(uv) * rot(radians(p_angle));
  /* a floor in perspective: depth contours crowd together towards the horizon */
  float persp = 1. / (1. + p_depth * (.55 - q.y));
  float z = p_bands * (q.x * .15 + q.y) * persp + p_bend * 4. * (la + lb);
  /* B starts a full depth step behind A and ends level with it; each picture's tone
     nudges its own depth, so the fight follows the pictures */
  float bell = sin(PI * p);
  float D = mix(1. + p_relief + .02, -p_relief - .02, smoothstep(.04, .96, p));
  D += p_relief * (lb - la) * .98;
  D += p_shimmer * .25 * bell * sin(uTime * 9. + q.y * 30.);
  float qa = floor(z), qb = floor(z + D);
  return vec4(qb <= qa ? b : a, 1.);
}` });

/* ---- Mip streaming ---- */
FX.register({ id:'tr-mip-stream', name:'Mip streaming', cat:'transition', family:'machine', nonLocal:true,
  search:['mipmap', 'texture streaming', 'lod', 'game', 'pop-in', 'loading', 'resolution', 'tiles'],
  desc:'Streaming tiles drop A down its mip levels and pull B back up them, each tile popping a level at its own moment.',
  params:[ I('tiles','Tiles across',5,2,12), I('levels','Lowest level',6,2,8), S('order','Streaming order',['Centre first','Random','Top down'],0), R('spread','Stagger',.45,0,.8), R('tint','Level tint',.15,0,1) ],
  fs:`vec3 mipstream_texel(sampler2D s, vec2 t, float sz){
  vec3 acc = vec3(0.);
  for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) acc += texture(s, clamp((t + (vec2(i, j) + .5) / 3.) * sz / uRes, 0., 1.)).rgb;
  return acc / 9.;
}
/* one mip level, read the way a GPU does: box-averaged texels, bilinearly filtered */
vec3 mipstream_lod(sampler2D s, vec2 uv, float lev, float unit){
  if (lev < .5) return texture(s, uv).rgb;
  float sz = exp2(lev) * unit;
  vec2 t = uv * uRes / sz - .5;
  vec2 i = floor(t), f = fract(t);
  vec3 c00 = mipstream_texel(s, i, sz), c10 = mipstream_texel(s, i + vec2(1, 0), sz);
  vec3 c01 = mipstream_texel(s, i + vec2(0, 1), sz), c11 = mipstream_texel(s, i + vec2(1, 1), sz);
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float ts = uRes.x / p_tiles;
  vec2 ti = floor(uv * uRes / ts);
  vec2 nt = ceil(uRes / ts);
  int o = int(p_order + .5);
  float h = hash12(ti + 11.3);
  float d = o == 1 ? h : o == 2 ? (nt.y - 1. - ti.y + h * .6) / nt.y : length((ti + .5) * ts - uRes * .5) / (length(uRes) * .5) * .85 + h * .15;
  d = clamp(d, 0., 1.);
  float s = clamp((p - d * p_spread) / (1. - p_spread), 0., 1.);
  float tri = 1. - abs(2. * s - 1.);
  float lev = floor(tri * (p_levels + .999));
  float unit = uRes.x / 1080.;
  vec3 col = s < .5 ? mipstream_lod(uA, uv, lev, unit) : mipstream_lod(uB, uv, lev, unit);
  /* the debug view engines use to show which level is resident */
  if (lev > .5){
    vec3 tc = hsv2rgb(vec3(fract(.02 + lev / (p_levels + 1.) * .85), .75, 1.));
    col = mix(col, tc * (.25 + .9 * luma(col)), p_tint);
  }
  return vec4(col, 1.);
}` });

/* ---- Phosphor persistence ---- */
FX.register({ id:'tr-phosphor', name:'Phosphor persistence', cat:'transition', family:'machine',
  search:['crt', 'tube', 'television', 'monitor', 'electron beam', 'scanlines', 'afterglow', 'raster', 'retro'],
  desc:'The tube switches off and A fades on its phosphors, red and green lingering longest, while the beam paints B back in two interlaced fields.',
  params:[ I('lines','Scan lines',180,60,480), R('decay','Afterglow',.5,.1,1), R('mask','Shadow mask',.55,0,1), R('beam','Beam heat',.5,0,1.5), T('interlace','Interlaced fields',true) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float bell = smoothstep(0., .15, p) * (1. - smoothstep(.82, 1., p));
  /* phosphors decay at their own rates: blue goes first, red and green hang on, and bright areas last longest */
  float ta = max(p - .02, 0.) * 3.2 / p_decay;
  vec3 rate = vec3(.55, .8, 2.6) / (.35 + a);
  vec3 ad = a * exp(-ta * rate * .35);
  float y = (1. - uv.y) * p_lines;
  float li = floor(y), fy = fract(y);
  bool il = p_interlace > .5;
  float field = il ? mod(li, 2.) : 0.;
  float t0 = .24 + field * .25;
  float dur = il ? .38 : .55;
  float sweep = clamp((p - t0) / dur, 0., 1.) * 1.03;
  float ly = (li + .5) / p_lines;
  float written = step(ly, sweep) * step(.0001, sweep);
  /* each scan line is a soft beam trace that widens until the lines merge */
  float wdt = mix(.36, 1.6, smoothstep(.6, .95, p));
  float prof = exp(-pow((fy - .5) / wdt, 2.) * 2.);
  prof = mix(prof, 1., smoothstep(.85, 1., p));
  float hot = p_beam * .6 * exp(-max(sweep - ly, 0.) * 30.) * (1. - smoothstep(.85, .97, p)) * written;
  /* thin traces are brighter, as a beam is, so the frame keeps its light */
  float gain = mix(1.55, 1., smoothstep(.7, 1., p));
  vec3 bb = b * prof * gain * (1. + hot * 1.4) + hot * .25 * vec3(.75, .85, 1.) * prof;
  /* the beam itself: a bright trace on the line being written */
  float head = exp(-abs(ly - sweep) * p_lines * .7) * step(sweep, 1.) * step(.0001, sweep) * p_beam * bell;
  vec3 col = mix(ad, bb + ad * .5, written);
  col += head * vec3(.6, .7, .8) * .6;
  /* aperture grille: vertical red, green and blue stripes */
  float m = mod(floor(uv.x * uRes.x / max(uRes.x / 1080. * 1.6, 1.)), 3.);
  vec3 grille = vec3(m < .5 ? 1. : .25, abs(m - 1.) < .5 ? 1. : .25, m > 1.5 ? 1. : .25) * 1.55;
  col *= mix(vec3(1.), grille, p_mask * bell);
  col = mix(col, b, smoothstep(.93, 1., p));
  col = mix(a, col, smoothstep(0., .03, p));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- E-paper refresh ---- */
FX.register({ id:'tr-eink', name:'E-paper refresh', cat:'transition', family:'machine',
  search:['e-ink', 'eink', 'kindle', 'e-reader', 'epaper', 'ghosting', 'flash', 'refresh', 'monochrome'],
  desc:'An e-paper page refresh: A drops to grey ink, flashes through its negative, black and white, and B settles with a ghost of A before its colour comes up.',
  params:[ S('wave','Waveform',['Full refresh (flashing)','Partial update (regions)'],0), I('levels','Grey levels',16,2,32), R('ghost','Ghosting',.25,0,.6), R('grain','Particle grain',.6,0,1), C('ink','Ink','#232323','ink'), C('paper','Paper','#e9e6de','ground') ],
  fs:`/* the image as the panel can show it: a few grey levels, dithered, between ink and paper */
vec3 eink_panel(vec3 c, vec2 px){
  float g = luma(c);
  float n = p_levels - 1.;
  float d = bayer4(px / max(uRes.x / 540., 1.)) - .5;
  g = clamp(floor(g * n + .5 + d * .9) / n, 0., 1.);
  return mix(p_ink, p_paper, g);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 px = uv * uRes;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec3 ea = eink_panel(a, px), eb = eink_panel(b, px);
  bool partial = p_wave > .5;
  /* particles don't all move at once: each small clump switches at its own moment */
  vec2 cell = floor(px / max(uRes.x / 540., 1.));
  float nz = mix(.5, vnoise(cell * .03) * .55 + hash12(cell) * .45, p_grain);
  float sig;
  if (partial){
    /* regions update one after another, with no flashing */
    vec2 rg = floor(uv * vec2(3., 4.));
    float off = hash12(rg + 2.1) * .3;
    sig = clamp((p - .1 - off) / .3, 0., 1.);
  } else sig = clamp((p - .06) / .5, 0., 1.) * 5.;
  /* each state change happens in the first part of its slot, then the panel holds */
  float st = floor(sig) + step(nz, fract(sig) / .4);
  vec3 ghostB = eb - p_ghost * (p_paper - ea) * (partial ? 1.6 : 1.) * (1. - smoothstep(.72, .97, p));
  vec3 col;
  if (partial) col = st < .5 ? ea : ghostB;
  else if (st < .5) col = ea;
  else if (st < 1.5) col = p_ink + p_paper - ea;
  else if (st < 2.5) col = p_ink;
  else if (st < 3.5) col = p_paper;
  else if (st < 4.5) col = p_ink + p_paper - eb;
  else col = ghostB;
  col = mix(a, col, smoothstep(0., .06, p));
  /* colour comes back last, through the same particle grain */
  float back = clamp((p - .76) / .22, 0., 1.);
  col = mix(col, b, step(nz, back * 1.1));
  if (p >= 1.) col = b;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- LED wall cabinets ---- */
FX.register({ id:'tr-led-cabinets', name:'LED wall switch', cat:'transition', family:'machine',
  search:['led', 'video wall', 'jumbotron', 'screen', 'billboard', 'stadium', 'diodes', 'display', 'panels'],
  desc:'A video wall switches input cabinet by cabinet along its data chain, its diodes showing through, each panel a little off in colour until the wall settles on B.',
  params:[ I('cabinets','Cabinets across',4,2,10), I('diodes','Diodes across',76,30,260), S('order','Data chain',['Serpentine','Columns','Random'],0), R('calib','Calibration error',.5,0,1), R('glitch','Mis-mapped frames',.6,0,1), R('led','Diode look',.85,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 px = uv * uRes;
  float cs = uRes.x / p_cabinets;
  float nx = p_cabinets, ny = ceil(uRes.y / cs);
  vec2 ci = vec2(floor(px.x / cs), floor((uRes.y - px.y) / cs));
  int o = int(p_order + .5);
  float idx = o == 0 ? ci.y * nx + (mod(ci.y, 2.) > .5 ? nx - 1. - ci.x : ci.x)
            : o == 1 ? ci.x * ny + (mod(ci.x, 2.) > .5 ? ny - 1. - ci.y : ci.y)
            : hash12(ci + 4.2) * nx * ny;
  float t = .2 + .56 * idx / (nx * ny) + hash12(ci + 9.) * .02;
  float e = smoothstep(0., .18, p) * (1. - smoothstep(.8, .98, p));
  /* diodes: each cell shows one sample of the picture as a lit dot */
  float dp = uRes.x / p_diodes;
  vec2 dc = (floor(px / dp) + .5) * dp;
  vec2 duv = dc / uRes;
  vec2 lc = px / dp - floor(px / dp) - .5;
  float r = length(lc);
  float dot_ = smoothstep(.42, .3, r) * 1.3 + exp(-r * r * 7.) * .4;
  bool isB = p >= t;
  vec2 wrong = vec2(0.);
  /* just after the switch, the receiving card briefly maps the wrong slice of the frame */
  float win = (p - t) / .05;
  if (isB && win < 1.){
    float hh = hash12(ci + floor(win * 3.) + 1.7);
    if (hh < p_glitch) wrong = (floor(hash22(ci + floor(win * 3.)) * 3.) - 1.) * cs / uRes;
  }
  float blank = step(t - .012, p) * step(p, t) * e;
  vec3 exact = isB ? texture(uB, clamp(uv + wrong, 0., 1.)).rgb : texture(uA, uv).rgb;
  vec3 dv = isB ? texture(uB, clamp(duv + wrong, 0., 1.)).rgb : texture(uA, duv).rgb;
  vec3 col = mix(exact, dv * dot_, e * p_led);
  vec3 gain = 1. + p_calib * (vec3(hash12(ci + 1.), hash12(ci + 2.), hash12(ci + 3.)) - .5) * vec3(.22, .16, .26);
  col *= mix(vec3(1.), gain, e);
  /* seams between cabinets */
  vec2 cl = mod(vec2(px.x, uRes.y - px.y), cs);
  float seam = 1. - (1. - smoothstep(0., 2. * uRes.x / 1080., min(cl.x, cl.y))) * .7;
  col *= mix(1., seam, e);
  col *= 1. - blank;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Split-flap board ---- */
FX.register({ id:'tr-split-flap', name:'Split-flap board', cat:'transition', family:'machine', nonLocal:true,
  search:['solari', 'departures', 'flip board', 'station', 'airport', 'mechanical', 'flaps', 'tiles'],
  desc:'The frame becomes a split-flap board: every tile clatters through a few pieces of picture before it lands on B, more turns where the two pictures differ most.',
  params:[ I('cols','Tiles across',12,4,32), R('tall','Tile height',1.3,.6,2), R('flips','Flaps per tile',4,0,10,1), R('stagger','Ripple',.6,0,1), R('gap','Gaps',.5,0,1), C('board','Board','#121212','ink') ],
  fs:`vec3 flap_img(float k, float F, vec2 tile, vec2 L, vec2 nt, vec2 tsz, vec2 uv){
  if (k <= 0. && L.x >= 0.) return texture(uA, (tile * tsz + L * tsz) / uRes * vec2(1., -1.) + vec2(0., 1.)).rgb;
  vec2 src = tile;
  if (k > 0. && k < F) src = floor(hash22(tile * 1.37 + k * 7.13) * nt);
  vec2 q = (src * tsz + L * tsz) / uRes * vec2(1., -1.) + vec2(0., 1.);
  return (k >= F || (k > 0. && k >= F * .5)) ? texture(uB, q).rgb : texture(uA, q).rgb;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float tw = uRes.x / p_cols, th = tw * p_tall;
  vec2 tsz = vec2(tw, th);
  vec2 nt = vec2(p_cols, ceil(uRes.y / th));
  float Y = (1. - uv.y) * uRes.y;
  vec2 tile = vec2(floor(uv.x * uRes.x / tw), floor(Y / th));
  vec2 L = vec2(uv.x * uRes.x / tw - tile.x, Y / th - tile.y);
  vec2 cuv = vec2((tile.x + .5) * tw / uRes.x, 1. - (tile.y + .5) * th / uRes.y);
  /* tiles where the two pictures differ most turn over more flaps */
  float diff = clamp(length(texture(uB, cuv).rgb - texture(uA, cuv).rgb) * 1.6, 0., 1.);
  float F = 1. + floor(p_flips * (.35 + .65 * diff) * (.7 + .6 * hash12(tile + .3)) + .5);
  float maxF = 1. + floor(p_flips * 1.3 + .5);
  float df = min(.06, .55 / maxF);
  float d = mix(hash12(tile + 5.), (tile.x / nt.x + tile.y / nt.y) * .5, p_stagger);
  float t0 = .05 + d * max(.86 - maxF * df, .05);
  float f = (p - t0) / df;
  vec3 col;
  float shade = 1.;
  if (f < 0.) col = texture(uA, uv).rgb;
  else if (f >= F) col = texture(uB, uv).rgb;
  else {
    float k = floor(f), ph = fract(f);
    /* the flap falls under gravity: slow off the top, fast onto the stop */
    float th_ = pow(ph, 1.6) * PI;
    float ct = cos(th_), st = sin(th_);
    if (L.y < .5){
      float dd = .5 - L.y;
      if (ct > 0. && dd < .5 * ct){
        float d0 = dd / ct;
        float sx = 1. + .14 * st * d0 * 2.;
        float lx = .5 + (L.x - .5) / sx;
        if (lx >= 0. && lx <= 1.){ col = flap_img(k, F, tile, vec2(lx, .5 - d0), nt, tsz, uv); shade = 1. - .45 * st; }
        else { col = flap_img(k + 1., F, tile, L, nt, tsz, uv); shade = 1. - .3 * st; }
      } else { col = flap_img(k + 1., F, tile, L, nt, tsz, uv); shade = 1. - .3 * st * (1. - dd * 2.); }
    } else {
      float dd = L.y - .5;
      if (ct < 0. && dd < .5 * -ct){
        float d0 = dd / -ct;
        float sx = 1. + .14 * st * d0 * 2.;
        float lx = .5 + (L.x - .5) / sx;
        if (lx >= 0. && lx <= 1.){ col = flap_img(k + 1., F, tile, vec2(lx, .5 + d0), nt, tsz, uv); shade = .7 + .3 * -ct; }
        else { col = flap_img(k, F, tile, L, nt, tsz, uv); shade = 1. - .35 * st; }
      } else { col = flap_img(k, F, tile, L, nt, tsz, uv); shade = 1. - .35 * st * step(0., -ct); }
    }
  }
  col *= shade;
  /* the board: gaps between tiles and the hinge across each one */
  float e = smoothstep(0., .06, p) * (1. - smoothstep(.93, 1., p));
  float g = p_gap * tw * .05;
  float ed = min(min(L.x, 1. - L.x) * tw, min(L.y, 1. - L.y) * th);
  float gapm = 1. - smoothstep(g, g + 1., ed);
  float hinge = 1. - smoothstep(g * .3, g * .3 + 1., abs(L.y - .5) * th);
  col *= 1. - e * .12 * step(L.y, .5);
  col = mix(col, p_board, e * max(gapm, hinge * .8));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Indexed palette swap ---- */
FX.register({ id:'tr-palette-swap', name:'Palette swap', cat:'transition', family:'machine', nonLocal:true,
  search:['indexed colour', 'palette', 'clut', 'lut', '8-bit', 'gif', 'pixel art', 'colour cycling', 'amiga', 'retro'],
  desc:'A drops to indexed colour, its palette is swapped for B\'s entry by entry (or cycled through it), then B\'s index map takes over tone by tone.',
  params:[ I('colours','Colours',10,3,16), S('move','Palette move',['Swap entries','Cycle through'],0), S('order','Swap order',['Dark to light','Light to dark','Random'],0), R('dither','Dither',.5,0,1), R('cell','Dither pixel',2,1,6,.5) ],
  fs:`vec3 pal_sample(sampler2D s, int i){
  vec2 g = vec2(float(i % 4), float(i / 4));
  return texture(s, (g + .2 + hash22(g + 5.1) * .6) / 4.).rgb;
}
/* sixteen fixed probes of a picture, sorted dark to light, thinned to n entries */
void pal_build(sampler2D s, out vec3 pal[16]){
  vec3 c[16]; float l[16];
  for (int i = 0; i < 16; i++){ c[i] = pal_sample(s, i); l[i] = luma(c[i]); }
  for (int i = 0; i < 15; i++) for (int j = 0; j < 15; j++){
    if (j >= 15 - i) break;
    if (l[j] > l[j + 1]){ float t = l[j]; l[j] = l[j + 1]; l[j + 1] = t; vec3 v = c[j]; c[j] = c[j + 1]; c[j + 1] = v; }
  }
  for (int i = 0; i < 16; i++){
    int k = int(floor(float(i) * 15. / max(p_colours - 1., 1.) + .5));
    pal[i] = c[min(k, 15)];
  }
}
int pal_index(vec3 c, vec3 pal[16]){
  int best = 0; float bd = 1e9;
  for (int i = 0; i < 16; i++){
    if (float(i) >= p_colours) break;
    vec3 d = c - pal[i];
    float dd = dot(d * vec3(.3, .59, .11), d) + .25 * dot(d, d);
    if (dd < bd){ bd = dd; best = i; }
  }
  return best;
}
vec3 pal_get(vec3 pal[16], int i){ vec3 r = pal[0]; for (int k = 0; k < 16; k++) if (k == i) r = pal[k]; return r; }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float cell = max(p_cell * uRes.x / 1080., 1.);
  float bay = bayer8(uv * uRes / cell);
  /* dissolves in and out of indexed colour run through the same ordered dither */
  if (bay >= (p - .02) / .12) return vec4(a, 1.);
  if (bay < (p - .84) / .14) return vec4(b, 1.);
  vec3 PA[16], PB[16];
  pal_build(uA, PA); pal_build(uB, PB);
  vec3 dv = vec3((bay - .5) * p_dither * .22);
  int ia = pal_index(a + dv, PA), ib = pal_index(b + dv, PB);
  float n = p_colours;
  /* B's index map takes over one tone at a time, darkest first */
  float tj = .5 + .28 * float(ib) / n;
  if (p >= tj) return vec4(pal_get(PB, ib), 1.);
  vec3 col;
  float s = clamp((p - .15) / .32, 0., 1.);
  if (p_move > .5){
    /* the palette rotates: A's colours run off one end and B's run in at the other */
    int m = ia + int(floor(s * n + .001));
    col = float(m) < n ? pal_get(PA, m) : pal_get(PB, m - int(n));
  } else {
    int o = int(p_order + .5);
    float r = o == 0 ? float(ia) : o == 1 ? n - 1. - float(ia) : floor(hash12(vec2(float(ia), 3.3)) * n);
    col = s * n > r + .001 ? pal_get(PB, ia) : pal_get(PA, ia);
  }
  return vec4(col, 1.);
}` });

/* ---- Bitrate climb ---- */
FX.register({ id:'tr-bitrate-climb', name:'Bitrate climb', cat:'transition', family:'machine', nonLocal:true,
  search:['codec', 'compression', 'video', 'stream', 'macroblock', 'p-frame', 'low bitrate', 'buffering', 'h.264'],
  desc:'B is sent as a cheap update to A: the blocks that changed most arrive first as a flat colour shift, and the detail comes through in coarse steps as the bitrate climbs.',
  params:[ I('blocks','Macroblocks across',16,6,48), R('coarse','Starting coarseness',1,.3,2), R('chroma','Colour coarseness',2.5,1,5), R('skip','Skipped blocks hold',.5,0,1), T('edges','Show block edges',true) ],
  fs:`vec3 br_ycc(vec3 c){ return vec3(dot(c, vec3(.299, .587, .114)), dot(c, vec3(-.1687, -.3313, .5)), dot(c, vec3(.5, -.4187, -.0813))); }
vec3 br_rgb(vec3 y){ return vec3(y.x + 1.402 * y.z, y.x - .34414 * y.y - .71414 * y.z, y.x + 1.772 * y.y); }
vec4 fx(vec2 uv){
  float p = uProgress;
  float cs = uRes.x / p_blocks;
  vec2 bi = floor(uv * uRes / cs);
  vec3 mA = vec3(0.), mB = vec3(0.);
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++){
    vec2 q = clamp((bi * cs + (vec2(i, j) + .5) * cs / 4.) / uRes, 0., 1.);
    mA += texture(uA, q).rgb; mB += texture(uB, q).rgb;
  }
  mA /= 16.; mB /= 16.;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  /* blocks that changed most get bits first; quiet blocks are skipped and keep A for longer */
  float E = clamp(length(mB - mA) * 2.2, 0., 1.);
  float tb = .05 + (1. - E) * .42 * p_skip + hash12(bi) * .06;
  if (p < tb) return vec4(a, 1.);
  float bits = clamp((p - tb) / max(.93 - tb, .05), 0., 1.) * 7.;
  float st = floor(bits);
  if (st >= 7.) return vec4(b, 1.);
  vec3 base = br_ycc(a + (mB - mA));
  vec3 col;
  if (st < 1.) col = br_rgb(base);
  else {
    float q = .45 * p_coarse * exp2(-(st - 1.));
    vec3 qv = vec3(q, q * p_chroma, q * p_chroma);
    vec3 r = br_ycc(b) - base;
    col = br_rgb(base + floor(r / qv + .5) * qv);
  }
  /* coded blocks don't quite meet their neighbours */
  if (p_edges > .5){
    vec2 l = mod(uv * uRes, cs);
    float ed = min(min(l.x, cs - l.x), min(l.y, cs - l.y));
    col *= 1. - .06 * (1. - st / 7.) * (1. - smoothstep(0., 1.5, ed));
  }
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Shading modes ---- */
FX.register({ id:'tr-shading-modes', name:'Shading modes', cat:'transition', family:'machine', nonLocal:true,
  search:['3d', 'render', 'mesh', 'wireframe', 'polygons', 'low poly', 'gouraud', 'flat shading', 'triangles', 'viewport'],
  desc:'The frame is drawn as a triangle mesh: A drops from textured to smooth to flat shading to wireframe, and B builds back up the same pipeline, triangle by triangle down the frame.',
  params:[ I('cells','Mesh cells across',12,4,40), R('jitter','Vertex jitter',.6,0,.9), R('sweep','Sweep',.5,0,1), R('wire','Line weight',1.4,.5,4,.1), C('ground','Viewport','#16171a','ink') ],
  fs:`vec2 shade_vtx(vec2 ij, float cell){ return (ij + (hash22(ij * 1.31 + 2.7) - .5) * p_jitter * .8) * cell; }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 px = uv * uRes;
  float cell = uRes.x / p_cells;
  vec2 c0 = floor(px / cell);
  vec2 v0 = vec2(0.), v1 = vec2(0.), v2 = vec2(0.);
  vec3 w = vec3(-1.);
  /* find the triangle under this pixel among the neighbouring cells */
  for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++){
    vec2 ij = c0 + vec2(dx, dy);
    vec2 a00 = shade_vtx(ij, cell), a10 = shade_vtx(ij + vec2(1, 0), cell), a01 = shade_vtx(ij + vec2(0, 1), cell), a11 = shade_vtx(ij + vec2(1, 1), cell);
    for (int t = 0; t < 2; t++){
      vec2 A = a00, B = t == 0 ? a10 : a11, C = t == 0 ? a11 : a01;
      float den = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
      float l0 = ((B.y - C.y) * (px.x - C.x) + (C.x - B.x) * (px.y - C.y)) / den;
      float l1 = ((C.y - A.y) * (px.x - C.x) + (A.x - C.x) * (px.y - C.y)) / den;
      vec3 bw = vec3(l0, l1, 1. - l0 - l1);
      if (min(bw.x, min(bw.y, bw.z)) >= -1e-4 && w.x < -.5){ w = bw; v0 = A; v1 = B; v2 = C; }
    }
  }
  if (w.x < -.5) return vec4(p < .5 ? texture(uA, uv).rgb : texture(uB, uv).rgb, 1.);
  vec2 cen = (v0 + v1 + v2) / 3.;
  /* each triangle steps through the eight stages on its own clock, top of the frame first */
  float lead = clamp(1. - cen.y / uRes.y, 0., 1.) * .85 + hash12(floor(cen)) * .15;
  float sk = p_sweep;
  float M = clamp((p * (1. + sk) - sk * lead) * 8., 0., 8.);
  float stg = min(floor(M), 7.);
  bool useB = stg >= 4.;
  int mode = int(useB ? 7. - stg : stg);
  vec3 ex = useB ? texture(uB, uv).rgb : texture(uA, uv).rgb;
  if (mode == 0) return vec4(ex, 1.);
  vec3 c0v = useB ? texture(uB, clamp(v0 / uRes, 0., 1.)).rgb : texture(uA, clamp(v0 / uRes, 0., 1.)).rgb;
  vec3 c1v = useB ? texture(uB, clamp(v1 / uRes, 0., 1.)).rgb : texture(uA, clamp(v1 / uRes, 0., 1.)).rgb;
  vec3 c2v = useB ? texture(uB, clamp(v2 / uRes, 0., 1.)).rgb : texture(uA, clamp(v2 / uRes, 0., 1.)).rgb;
  vec3 cc = useB ? texture(uB, clamp(cen / uRes, 0., 1.)).rgb : texture(uA, clamp(cen / uRes, 0., 1.)).rgb;
  /* distance to the nearest edge, in pixels, from the barycentrics */
  float area2 = abs((v1.x - v0.x) * (v2.y - v0.y) - (v2.x - v0.x) * (v1.y - v0.y));
  float ed = min(min(w.x * area2 / length(v2 - v1), w.y * area2 / length(v0 - v2)), w.z * area2 / length(v1 - v0));
  float lw = p_wire * uRes.x / 1080.;
  float line = 1. - smoothstep(lw * .5, lw * .5 + 1., ed);
  float vd = min(min(length(px - v0), length(px - v1)), length(px - v2));
  float vdot = 1. - smoothstep(lw * 1.6, lw * 1.6 + 1., vd);
  vec3 flat_ = (c0v + c1v + c2v + cc * 3.) / 6.;
  vec3 col;
  if (mode == 1) col = mix(w.x * c0v + w.y * c1v + w.z * c2v, ex, .15) * (1. - .18 * line);
  else if (mode == 2){
    /* flat shading with a little facet light so the mesh reads as surface */
    float lit = .9 + .2 * hash12(floor(cen) + 1.3);
    col = flat_ * lit * (1. - .22 * line);
  } else {
    vec3 lc = mix(flat_, vec3(1.), .25) * 1.15;
    col = mix(p_ground + flat_ * .1, lc, max(line, vdot));
  }
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Progressive render ---- */
FX.register({ id:'tr-path-trace', name:'Progressive render', cat:'transition', family:'machine', nonLocal:true,
  search:['path tracing', 'render', 'noise', 'samples', 'monte carlo', 'cycles', 'converge', 'fireflies', '3d'],
  desc:'Like a path tracer restarting: A breaks into a coarse, noisy few samples a pixel with stray fireflies, and B converges out of the grain.',
  params:[ I('spp','Fewest samples',2,1,8), R('spread','Sample spread',.6,0,2), R('coarse','Coarse start',.6,0,1), R('fire','Fireflies',.5,0,1), T('live','Noise moves',true) ],
  fs:`vec2 pt_gauss(vec2 h){ float r = sqrt(-2. * log(max(h.x, 1e-4))); return r * vec2(cos(TAU * h.y), sin(TAU * h.y)); }
vec4 fx(vec2 uv){
  float p = uProgress;
  float bell = max(sin(PI * p), 0.);
  float wB = smoothstep(.3, .7, p);
  vec2 px = uv * uRes;
  /* the viewport restarts coarse, then refines its resolution as samples arrive */
  float blk = floor(1. + p_coarse * 18. * pow(bell, 3.)) * max(uRes.x / 1080., .5);
  vec2 sp = blk > 1.5 ? (floor(px / blk) + .5) * blk : px;
  int n = int(mix(24., p_spp, pow(bell, .45)) + .5);
  float rad = p_spread * bell * uRes.x * .008;
  float seed = p_live > .5 ? floor(uTime * 24.) : 0.;
  vec3 acc = vec3(0.);
  for (int k = 0; k < 24; k++){
    if (k >= n) break;
    vec2 h = hash22(sp * 1.37 + float(k) * 17.3 + seed * 3.1);
    vec2 h2 = hash22(sp.yx * .91 + float(k) * 5.7 + seed * 1.7);
    vec2 su = (sp + pt_gauss(h) * rad) / uRes;
    vec3 c = h2.x < wB ? texture(uB, su).rgb : texture(uA, su).rgb;
    /* the odd sample finds a light path and comes back far too bright */
    if (h2.y < p_fire * .02 * bell) c = c * 5. + .6;
    acc += c;
  }
  return vec4(clamp(acc / float(n), 0., 1.), 1.);
}` });

/* ---- Raw sensor ---- */
FX.register({ id:'tr-raw-sensor', name:'Raw sensor', cat:'transition', family:'machine', nonLocal:true,
  search:['camera', 'bayer', 'demosaic', 'raw', 'sensor', 'cfa', 'photosites', 'readout', 'white balance', 'debayer'],
  desc:'A goes back to raw sensor data, dark and green behind its colour filter mosaic, the readout swaps in B row by row, and it is demosaiced and white-balanced back into a photograph.',
  params:[ I('sensels','Photosites across',120,40,360), R('cast','Raw cast',.55,0,1), R('gap','Microlens gaps',.35,0,1), T('readline','Show the readout line',true) ],
  fs:`vec3 raw_lin(vec3 c){ return pow(c, vec3(2.2)) * mix(vec3(1.), vec3(.48, 1., .62), p_cast) * 1.25; }
int raw_cfa(vec2 s){ vec2 m = mod(s, 2.); return (m.x < .5 && m.y < .5) ? 0 : (m.x > .5 && m.y > .5) ? 2 : 1; }
vec2 raw_uv(vec2 s, float ss){ return clamp(vec2((s.x + .5) * ss / uRes.x, 1. - (s.y + .5) * ss / uRes.y), 0., 1.); }
float raw_val(bool b, vec2 s, float ss){
  vec3 r = raw_lin(b ? texture(uB, raw_uv(s, ss)).rgb : texture(uA, raw_uv(s, ss)).rgb);
  int c = raw_cfa(s);
  return c == 0 ? r.r : c == 1 ? r.g : r.b;
}
/* a photosite seen on screen: its one channel, lifted so the mosaic reads */
vec3 raw_chan(int c){ return (c == 0 ? vec3(1., .08, .05) : c == 1 ? vec3(.06, 1., .1) : vec3(.05, .15, 1.)) * 1.7; }
/* bilinear demosaic: each channel averaged from the photosites in the 3×3 that carry it */
vec3 raw_demosaic(vec2 s, float ss){
  vec3 acc = vec3(0.), wt = vec3(0.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 q = s + vec2(i, j);
    float w = (i == 0 && j == 0) ? 4. : (i == 0 || j == 0) ? 2. : 1.;
    int cq = raw_cfa(q);
    vec3 ch = vec3(cq == 0 ? 1. : 0., cq == 1 ? 1. : 0., cq == 2 ? 1. : 0.);
    acc += ch * w * raw_val(true, q, ss); wt += ch * w;
  }
  return acc / max(wt, 1e-3);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float ss = uRes.x / p_sensels;
  vec2 pxt = vec2(uv.x * uRes.x, (1. - uv.y) * uRes.y);
  vec2 s = floor(pxt / ss);
  vec2 lc = pxt / ss - s;
  float rows = ceil(uRes.y / ss);
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float h = hash12(s + 7.7);
  /* microlens gaps between photosites while the mosaic is showing */
  float gl = max(abs(lc.x - .5), abs(lc.y - .5));
  float gapm = 1. - p_gap * .6 * smoothstep(.36, .5, gl);
  int c = raw_cfa(s);
  vec3 col;
  if (p < .2){
    vec3 lin = raw_lin(a);
    col = mix(a, lin, smoothstep(.0, .1, p));
    float mos = step(h, (p - .1) / .1);
    col = mix(col, raw_chan(c) * raw_val(false, s, ss) * gapm, mos);
  } else if (p < .6){
    /* rolling readout, top to bottom */
    float sweep = clamp((p - .22) / .36, 0., 1.) * 1.02;
    float r0 = (s.y + .5) / rows;
    bool rb = r0 < sweep;
    col = raw_chan(c) * raw_val(rb, s, ss) * gapm;
    if (p_readline > .5) col += vec3(.9, 1., .9) * .5 * exp(-abs(r0 - sweep) * rows * .8) * step(sweep, 1.) * step(.001, sweep);
  } else if (p < .74){
    float dm = step(h, (p - .6) / .1);
    col = mix(raw_chan(c) * raw_val(true, s, ss) * gapm, raw_demosaic(s, ss) * mix(gapm, 1., .5), dm);
  } else {
    vec3 dm = raw_demosaic(s, ss);
    /* white balance and gamma: undo the cast, back to display light */
    vec3 dev = pow(max(dm / (mix(vec3(1.), vec3(.48, 1., .62), p_cast) * 1.25), 0.), vec3(1. / 2.2));
    col = mix(dm * mix(gapm, 1., .5), dev, smoothstep(.74, .86, p));
    col = mix(col, b, smoothstep(.86, 1., p));
  }
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Blur-up placeholder ---- */
FX.register({ id:'tr-blurhash', name:'Blur-up placeholder', cat:'transition', family:'machine', nonLocal:true,
  search:['blurhash', 'lqip', 'placeholder', 'loading', 'web', 'lazy load', 'colour field', 'cosine', 'gradient'],
  desc:'A melts into the handful of soft cosine waves a web placeholder keeps of it, the waves trade over one by one into B\'s, and B loads in on top.',
  params:[ I('cx','Waves across',4,1,6), I('cy','Waves down',5,1,6), R('trade','Trade length',.36,.1,.6), R('contrast','Field contrast',1.15,.6,2) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float t0 = .2, t1 = .2 + p_trade;
  if (p <= 0.) return vec4(a, 1.);
  if (p >= 1.) return vec4(b, 1.);
  int cx = int(p_cx + .5), cy = int(p_cy + .5);
  /* the field is the picture's lowest cosine components, measured from an 8×8 grid of probes
     in linear light; the transform runs in two separable passes to keep it cheap */
  float cw[48];
  for (int u = 0; u < 6; u++) for (int i = 0; i < 8; i++) cw[u * 8 + i] = cos(PI * float(u) * (float(i) + .5) / 8.);
  vec3 RA[48], RB[48];
  for (int j = 0; j < 8; j++){
    vec3 la[8], lb[8];
    for (int i = 0; i < 8; i++){
      vec2 q = (vec2(i, j) + .5) / 8.;
      la[i] = pow(texture(uA, q).rgb, vec3(2.2)); lb[i] = pow(texture(uB, q).rgb, vec3(2.2));
    }
    for (int u = 0; u < 6; u++){
      vec3 sa = vec3(0.), sb = vec3(0.);
      if (u < cx) for (int i = 0; i < 8; i++){ sa += la[i] * cw[u * 8 + i]; sb += lb[i] * cw[u * 8 + i]; }
      RA[u * 8 + j] = sa; RB[u * 8 + j] = sb;
    }
  }
  vec3 CA[36], CB[36];
  for (int v = 0; v < 6; v++) for (int u = 0; u < 6; u++){
    vec3 sa = vec3(0.), sb = vec3(0.);
    if (u < cx && v < cy) for (int j = 0; j < 8; j++){ sa += RA[u * 8 + j] * cw[v * 8 + j]; sb += RB[u * 8 + j] * cw[v * 8 + j]; }
    CA[v * 6 + u] = sa; CB[v * 6 + u] = sb;
  }
  vec3 fa = vec3(0.), fm = vec3(0.), fb = vec3(0.);
  float K = float(cx * cy);
  for (int v = 0; v < 6; v++) for (int u = 0; u < 6; u++){
    if (u >= cx || v >= cy) continue;
    float nrm = (u == 0 && v == 0 ? 1. : 2. * p_contrast) / 64.;
    float bw = cos(PI * float(u) * uv.x) * cos(PI * float(v) * uv.y);
    /* components trade in order of frequency, the broad ones first */
    float rank = (float(u + v) + float(u) / 7.) / float(cx + cy - 1);
    float tk = mix(t0, t1 - .06, rank);
    float w = smoothstep(tk, tk + .06, p);
    fa += CA[v * 6 + u] * nrm * bw; fb += CB[v * 6 + u] * nrm * bw;
    fm += mix(CA[v * 6 + u], CB[v * 6 + u], w) * nrm * bw;
  }
  vec3 field = pow(max(fm, 0.), vec3(1. / 2.2));
  vec3 col = mix(a, field, smoothstep(.0, t0, p));
  col = mix(col, b, smoothstep(t1 + .04, .98, p));
  return vec4(clamp(col, 0., 1.), 1.);
}` });
