/* ---------------- Transitions: signal ----------------
   Signal, fracture and print: chroma, static, tape, glitch, shatter,
   crush, particles and screened cuts. Every one returns A exactly at
   p = 0 and B exactly at p = 1, so they can sit on a hard cut. */

FX.register({ id:'tr-chroma-dissolve', name:'Chromatic dissolve', cat:'transition', search:['rgb split', 'chromatic aberration', 'prism', 'colour fringe', 'lens', 'dispersion'],
  desc:'A crossfade where both pictures split into colour fringes that peak in the middle, A pulling one way and B the other.',
  params:[ R('amount','Split',1,0,2), S('mode','Spread',['From the centre','Along an angle'],0), R('angle','Angle',0,-180,180,1), S('fringe','Fringe',['Spectrum','Red, green, blue'],0) ],
  fs:`vec3 chroma_w(float t){ return hsv2rgb(vec3(t * .72, 1., 1.)); }
vec4 fx(vec2 uv){
  float p = uProgress;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  float s = sin(p * PI) * p_amount * .07;
  vec2 c = centered(uv);
  vec2 dir = p_mode < .5 ? c * 1.6 : vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 off = dir * s / vec2(aspect(), 1.);
  bool rgb = p_fringe > .5;
  vec3 a = vec3(0.), b = vec3(0.), ws = vec3(0.);
  for (int i = 0; i < 9; i++){
    if (rgb && i > 2) break;
    float t = rgb ? float(i) * .5 : float(i) / 8.;
    vec3 w = rgb ? vec3(i == 0 ? 1. : 0., i == 1 ? 1. : 0., i == 2 ? 1. : 0.) : chroma_w(t);
    float k = (t - .5) * 2.;
    a += texture(uA, uv + off * k).rgb * w;
    b += texture(uB, uv - off * k).rgb * w;
    ws += w;
  }
  a /= ws; b /= ws;
  return vec4(mix(a, b, smoothstep(.15, .85, p)), 1.);
}` });

FX.register({ id:'tr-rgb-slide', name:'RGB split slide', cat:'transition', search:['chromatic', 'whip', 'swipe', 'carousel', 'slideshow', 'aberration'],
  desc:'B pushes A out of frame, with red, green and blue running at slightly different speeds so the fast middle fringes.',
  params:[ S('dir','Direction',['Left','Right','Up','Down'],0), S('mode','Mode',['Push','Slide over'],0), R('amount','Split',.7,0,2), R('blur','Motion blur',.4,0,1) ],
  fs:`vec3 rgbslide_at(vec2 uv, float p){
  int d = int(p_dir + .5);
  vec2 dir = d == 0 ? vec2(-1., 0.) : d == 1 ? vec2(1., 0.) : d == 2 ? vec2(0., 1.) : vec2(0., -1.);
  vec2 ua = p_mode > .5 ? uv : uv - dir * p;
  vec2 ub = uv + dir * (1. - p);
  bool inB = all(greaterThanEqual(ub, vec2(0.))) && all(lessThanEqual(ub, vec2(1.)));
  return inB ? texture(uB, ub).rgb : texture(uA, ua).rgb;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  float v = sin(p * PI);
  float split = v * p_amount * .06;
  float blur = v * p_blur * .05;
  vec3 col = vec3(0.);
  for (int i = 0; i < 5; i++){
    float j = (float(i) / 4. - .5) * blur;
    col += vec3(rgbslide_at(uv, clamp(p + split + j, 0., 1.)).r,
                rgbslide_at(uv, clamp(p + j, 0., 1.)).g,
                rgbslide_at(uv, clamp(p - split + j, 0., 1.)).b);
  }
  return vec4(col / 5., 1.);
}` });

FX.register({ id:'tr-tv-static', name:'TV static cut', cat:'transition', search:['noise', 'snow', 'interference', 'channel change', 'analogue', 'broadcast'],
  desc:'A hard cut hidden behind a burst of television static, in coloured blocks or fine grey snow.',
  params:[ S('style','Static',['Colour blocks','Snow'],0), R('size','Block size',.025,.004,.1), R('peak','Coverage',1,.2,1.2), R('bright','Brightness',.85,.2,1.5), R('rate','Flicker rate',24,1,60,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 img = p < .5 ? texture(uA, uv).rgb : texture(uB, uv).rgb;
  if (p <= 0. || p >= 1.) return vec4(img, 1.);
  float seed = floor(uTime * p_rate) * 13.1 + floor(p * 48.) * 7.3;
  float tent = 1. - abs(2. * p - 1.);
  vec3 n; float cover;
  if (p_style < .5){
    vec2 grid = vec2(aspect(), 1.) / p_size;
    vec2 id = floor(uv * grid);
    n = vec3(hash12(id + seed), hash12(id + seed + 31.7), hash12(id + seed + 63.1));
    n = mix(n, vec3(luma(n)), .35) * p_bright;
    cover = step(hash12(id * 1.37 + 5.), tent * 1.2 * p_peak - .1);
  } else {
    vec2 px = floor(uv * uRes / max(uPx, 1.) / vec2(1.5, 1.));
    float g = hash12(px + seed);
    float roll = .75 + .5 * smoothstep(.9, 1., sin((uv.y + seed * .037) * 9.));
    n = vec3(g * g * 1.3) * roll * p_bright;
    cover = smoothstep(.05, .65, tent * p_peak);
    img *= 1. - cover * .5;
    cover *= .92;
  }
  return vec4(mix(img, n, cover), 1.);
}` });

FX.register({ id:'tr-static-band', name:'Static band wipe', cat:'transition', search:['noise', 'interference', 'scan', 'signal', 'tear'],
  desc:'A straight wipe with a band of static riding the edge, widest in the middle of the move.',
  params:[ S('dir','Direction',DIRS4,1), R('span','Band width',.35,0,1), R('noise','Static',1,0,1), R('tear','Row jitter',.4,0,1), T('colour','Colour static') ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  int m = int(p_dir + .5);
  vec2 dv = m == 0 ? vec2(0., -1.) : m == 1 ? vec2(1., 0.) : m == 2 ? vec2(0., 1.) : vec2(-1., 0.);
  float e = m == 0 ? 1. - uv.y : m == 1 ? uv.x : m == 2 ? uv.y : 1. - uv.x;
  float across = (m == 0 || m == 2) ? uv.x * uRes.x : uv.y * uRes.y;
  float span = p_span * sqrt(max(sin(p * PI), 0.)) * .5;
  float band = smoothstep(p - span, p, e) * (1. - smoothstep(p, p + span, e));
  float seed = floor(uTime * 30.) + floor(p * 60.) * 3.1;
  float row = floor(across / (3. * max(uPx, 1.)));
  float off = (hash12(vec2(row, seed)) - .5) * p_tear * band * .12;
  vec2 st = uv + dv * off;
  float es = e + off;
  vec3 col = es < p ? texture(uB, st).rgb : texture(uA, st).rgb;
  vec2 cell = floor(uv * uRes / (2. * max(uPx, 1.)));
  vec3 n = p_colour > .5 ? vec3(hash12(cell + seed), hash12(cell + seed + 17.), hash12(cell + seed + 41.))
                         : vec3(hash12(cell + seed));
  n *= .7 + .6 * hash12(vec2(row * .37, seed));
  return vec4(mix(col, n, band * p_noise), 1.);
}` });

FX.register({ id:'tr-lost-signal', name:'Lost signal', cat:'transition', search:['tracking', 'analogue', 'tv', 'interference', 'crt', 'dropout'],
  desc:'The picture loses its signal for a moment: lines tear sideways, colour drains and scanlines show, and B comes back in its place.',
  params:[ I('lines','Lines',120,20,400), R('amount','Tracking',.6,0,1), R('drift','Shift',.6,0,1.5), R('scan','Scanlines',.35,0,1), R('fade','Signal loss',.5,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  float t = sin(p * PI);
  float seed = floor(p * 20.);
  float row = floor(uv.y * p_lines);
  float trk = step(1. - .2 * p_amount * t, hash12(vec2(row, seed)));
  float band = floor(uv.y * 7. + seed * .37);
  trk = max(trk, step(1. - .25 * p_amount * t * t, hash12(vec2(band, seed + 4.))));
  float shift = (sin(uv.y * 7. + p * 30.) * .5 + hash12(vec2(row, seed + 9.)) - .5) * p_drift * .08 * t * trk;
  shift += sin(uv.y * 40. + p * 50.) * .003 * t * p_drift;
  vec2 st = uv + vec2(shift, 0.);
  float m = smoothstep(.3, .7, p);
  vec3 a = texture(uA, st).rgb, b = texture(uB, st).rgb;
  vec3 col = mix(a, b, m);
  col = mix(col, vec3(luma(col)), p_fade * t);
  col *= 1. - p_fade * t * .3;
  col = mix(col, vec3(.6 + .4 * hash12(vec2(floor(uv.x * 80.), row + seed))), trk * .35 * t);
  float sl = .5 + .5 * sin(uv.y * uRes.y / max(uPx, 1.) / 3. * TAU);
  col *= 1. - p_scan * t * .5 * sl;
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-vhs-roll', name:'VHS roll', cat:'transition', search:['vertical hold', 'tape', 'vhs', 'analogue', 'retro', 'roll'],
  desc:'The tape loses vertical hold and the picture rolls, with a black blanking bar, until B settles into place.',
  params:[ I('rolls','Rolls',2,1,5), R('bar','Blanking bar',.1,0,.3), R('noise','Noise',.5,0,1), R('scan','Scanlines',.4,0,1), R('bleed','Colour bleed',.5,0,1) ],
  fs:`vec3 vhs_tape(sampler2D tex, vec2 st, float bleed){
  vec3 c = texture(tex, st).rgb;
  vec3 smear = vec3(0.);
  for (int i = 0; i < 5; i++) smear += texture(tex, st + vec2(float(i) * bleed * .006, 0.)).rgb;
  smear /= 5.;
  float l = luma(c);
  return vec3(l) + (smear - vec3(luma(smear)));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  float t = sin(p * PI);
  float R = max(p_rolls, 1.);
  float H = 1. + p_bar;
  float s = p * R * H + sin(p * 80.) * .004 * t;
  float pos = uv.y + s;
  float k = floor(pos / H);
  float local = pos - k * H;
  float seed = floor(p * 60.) + floor(uTime * 24.) * .17;
  float skew = (1. - smoothstep(0., .07, local)) * .05 * t;
  skew += (hash12(vec2(floor(uv.y * 240.), seed)) - .5) * .004 * t * p_noise;
  vec3 col;
  if (local > 1.){
    float bl = (local - 1.) / max(p_bar, 1e-4);
    col = vec3(.015);
    col += vec3(.55) * step(.55, bl) * step(bl, .62) * step(.5, fract(uv.x * 22. + seed * .3));
  } else {
    vec2 st = vec2(uv.x + skew, local);
    bool isB = k >= R - .5;
    vec3 raw = isB ? texture(uB, st).rgb : texture(uA, st).rgb;
    col = mix(raw, isB ? vhs_tape(uB, st, p_bleed * t * 2.) : vhs_tape(uA, st, p_bleed * t * 2.), t);
  }
  float g = hash12(floor(uv * uRes / (2. * max(uPx, 1.))) + seed);
  col += (g - .5) * .3 * p_noise * t;
  float drop = step(1. - .012 * p_noise * t, hash12(vec2(floor(uv.y * 300.), floor(uv.x * 12.) + seed)));
  col = mix(col, vec3(.95), drop);
  float sl = .5 + .5 * sin(uv.y * uRes.y / max(uPx, 1.) / 3. * TAU);
  col *= 1. - p_scan * t * .45 * sl;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-flicker-glitch', name:'Flicker glitch', cat:'transition', search:['glitch', 'stutter', 'strobe', 'flash', 'rgb split', 'ghost'],
  desc:'The cut flickers back and forth between A and B a few times before it commits, with colour ghosts and shifted blocks on each flash.',
  params:[ I('steps','Flicker steps',24,6,60), R('rgb','RGB offset',.9,0,2), R('ghost','Ghost',.75,0,1), R('blocks','Block shift',.5,0,1), R('scan','Scanlines',.3,0,1) ],
  fs:`vec3 flick_split(sampler2D tex, vec2 st, float ca){
  return vec3(texture(tex, st + vec2(ca, 0.)).r, texture(tex, st).g, texture(tex, st - vec2(ca, 0.)).b);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  float key = floor(p * p_steps);
  float r = hash12(vec2(key, 3.7));
  bool showB = r < smoothstep(.12, .88, p);
  float t = sin(p * PI);
  float inten = t * (.45 + .55 * hash12(vec2(key, 9.1)));
  vec2 blk = floor(uv * vec2(8., 26.));
  float on = step(1. - .35 * inten * p_blocks, hash12(blk + key * 1.31));
  vec2 st = uv + vec2((hash12(blk + key + 2.) - .5) * .18 * on, 0.);
  float ca = .014 * p_rgb * inten;
  vec3 col = showB ? flick_split(uB, st, ca) : flick_split(uA, st, ca);
  float gl = .03 * inten;
  float oL = showB ? luma(texture(uA, st - vec2(gl, 0.)).rgb) : luma(texture(uB, st - vec2(gl, 0.)).rgb);
  float oR = showB ? luma(texture(uA, st + vec2(gl, 0.)).rgb) : luma(texture(uB, st + vec2(gl, 0.)).rgb);
  float gk = p_ghost * inten * .6;
  col.r = mix(col.r, max(col.r, oL), gk);
  col.gb = mix(col.gb, max(col.gb, vec2(oR)), gk);
  float sl = .5 + .5 * sin(uv.y * uRes.y / max(uPx, 1.) / 3. * TAU);
  col *= 1. - p_scan * inten * .6 * sl;
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-datamosh-strips', name:'Datamosh strips', cat:'transition', search:['datamosh', 'glitch', 'tear', 'compression', 'corrupt', 'residue'],
  desc:'Bars and slits of the frame tear sideways and leave stale copies of A behind, as if the file had been corrupted between the two shots.',
  params:[ I('bars','Bars',42,4,120), I('slits','Slits',18,0,60), R('tear','Tear',.18,0,.5), R('chroma','Chroma split',.5,0,2), R('residue','Residue',.6,0,1), R('flash','Flash',.2,0,1) ],
  fs:`vec3 mosh_tex(bool useB, vec2 st, float ca){
  st = mirrorUv(st);
  if (useB) return vec3(texture(uB, st + vec2(ca, 0.)).r, texture(uB, st).g, texture(uB, st - vec2(ca, 0.)).b);
  return vec3(texture(uA, st + vec2(ca, 0.)).r, texture(uA, st).g, texture(uA, st - vec2(ca, 0.)).b);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  float burst = pow(max(sin(p * PI), 0.), .42);
  float seed = floor(p * 30.);
  float yw = uv.y + (vnoise(vec2(uv.y * 5., seed)) - .5) * .15;
  float row = floor(yw * p_bars);
  float act = step(1. - burst * .55, hash12(vec2(row, seed)));
  float dx = (hash12(vec2(row, seed + 3.)) - .5) * 2. * p_tear * act * burst;
  float sl = floor((uv.x + (vnoise(vec2(uv.x * 4., seed + 9.)) - .5) * .2) * max(p_slits, 1.));
  float sact = p_slits > .5 ? step(1. - burst * .25, hash12(vec2(sl, seed + 11.))) : 0.;
  float dy = (hash12(vec2(sl, seed + 13.)) - .5) * p_tear * .6 * sact * burst;
  vec2 st = uv + vec2(dx, dy);
  bool useB = p > hash12(vec2(row, 71.)) * .5 + .25;
  bool stale = act > .5 && hash12(vec2(row, seed + 21.)) < p_residue && p < .9;
  float ca = .032 * p_chroma * burst * (.3 + .7 * max(act, sact));
  vec3 col = stale ? mosh_tex(false, uv + vec2(dx * .25, 0.), ca) : mosh_tex(useB, st, ca);
  col += (hash12(floor(uv * uRes / (2. * max(uPx, 1.))) + seed) - .5) * .1 * burst;
  col *= 1. - .13 * burst * step(.5, fract(uv.y * uRes.y / max(uPx, 1.) / 4.));
  float fl = step(.82, hash12(vec2(seed, 5.))) * p_flash * burst;
  col = mix(col, vec3(1.), fl * .8);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-shatter', name:'Shatter', cat:'transition', search:['glass', 'fracture', 'break', 'shards', 'smash', 'explode'],
  desc:'A cracks from an impact point and breaks into pieces that spin and fall away to show B behind.',
  params:[ I('rows','Rows of pieces',7,3,10), R('x','Impact X',0,-1,1), R('y','Impact Y',.2,-1,1), R('force','Force',.6,0,2), R('gravity','Gravity',.8,0,2), R('spin','Spin',1,0,3), R('stagger','Stagger',.6,0,.9) ],
  fs:`vec2 shatter_seed(vec2 id){ return id + .5 + (hash22(id + 7.) - .5) * .8; }
vec2 shatter_cell(vec2 g){
  vec2 b = floor(g), best = b; float bd = 1e9;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 id = b + vec2(i, j); float d = length(g - shatter_seed(id));
    if (d < bd){ bd = d; best = id; }
  }
  return best;
}
float shatter_edge(vec2 g, vec2 id){
  vec2 s0 = shatter_seed(id); float md = 1e9;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    if (i == 0 && j == 0) continue;
    vec2 s1 = shatter_seed(id + vec2(i, j));
    md = min(md, dot(.5 * (s0 + s1) - g, normalize(s1 - s0)));
  }
  return md;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 b0 = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(b0, 1.);
  float ar = aspect();
  float n = max(p_rows, 1.);
  vec2 cnt = vec2(floor(n * ar + .5), n);
  vec2 half_ = vec2(ar, 1.) * .5;
  vec2 x = centered(uv);
  vec2 imp = vec2(p_x, p_y) * half_;
  float crack = .15;
  float st = clamp(p_stagger, 0., .9);
  float dur = (1. - crack) * (1. - st);
  float maxD = length(vec2(ar, 1.));
  float bestL = -1.; vec2 hitQ = vec2(0.), hitId = vec2(0.); float hitTilt = 1., hitRot = 0., hitO = 0.;
  for (int iy = -1; iy < 11; iy++){
    if (float(iy) > cnt.y) break;
    for (int ix = -1; ix < 21; ix++){
      if (float(ix) > cnt.x) break;
      vec2 id = vec2(ix, iy);
      vec2 sx = shatter_seed(id) / n - half_;
      float o = clamp(length(sx - imp) / maxD * 1.3, 0., 1.) * .85 + hash12(id + 3.) * .15;
      float l = clamp((p - crack - o * st * (1. - crack)) / dur, 0., 1.);
      if (l >= 1.) continue;
      vec2 h = hash22(id + 1.) - .5;
      vec2 dv = normalize(sx - imp + h * .3 + 1e-4);
      vec2 T = dv * p_force * (.25 * l + .6 * l * l) + vec2(0., -1.) * p_gravity * 1.4 * l * l;
      float k = 1. - .8 * l * l;
      float th = h.x * 2. * p_spin * l * 2.2;
      float cosT = max(abs(cos(h.y * p_spin * l * 4.)), .08);
      vec2 d = x - sx - T;
      if (length(d) > 1.35 / n * k) continue;
      vec2 loc = rot(-th) * d;
      loc.x /= cosT;
      vec2 q = sx + loc / k;
      vec2 qu = uncentered(q);
      if (any(lessThan(qu, vec2(0.))) || any(greaterThan(qu, vec2(1.)))) continue;
      vec2 gq = (q + half_) * n;
      if (distance(shatter_cell(gq), id) > .5) continue;
      if (l > bestL){ bestL = l; hitQ = q; hitId = id; hitTilt = cosT; hitRot = th; hitO = o; }
    }
  }
  if (bestL < 0.) return vec4(b0 * (1. - .25 * smoothstep(crack, 1., p) * (1. - smoothstep(.7, 1., p))), 1.);
  vec3 col = texture(uA, uncentered(hitQ)).rgb;
  float ed = shatter_edge((hitQ + half_) * n, hitId) / n * uRes.y / max(uPx, 1.);
  float cw = clamp(p / crack * 1.6 - hitO * 1.4, 0., 1.);
  if (bestL <= 0.){
    col *= 1. - .75 * cw * (1. - smoothstep(.6, 1.6, ed));
    col += .35 * cw * (1. - smoothstep(1.6, 2.8, ed)) * smoothstep(.6, 1.6, ed);
  } else {
    float shade = .75 + .25 * hitTilt + .12 * sin(hitRot * 1.7);
    col = col * shade + .45 * (1. - smoothstep(.8, 2.2, ed));
    col *= 1. - smoothstep(.8, 1., bestL);
    col += b0 * smoothstep(.8, 1., bestL);
  }
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-crush', name:'Crush', cat:'transition', search:['crumple', 'paper ball', 'scrunch', 'bin', 'fold'],
  desc:'A crumples into a faceted ball of paper and shrinks away to a point, leaving B.',
  params:[ I('facets','Facets',9,4,30), R('crumple','Crumple',1,.2,1.5), R('x','Into X',0,-1,1), R('y','Into Y',0,-1,1), R('shade','Shading',.7,0,1), R('shadow','Shadow',.5,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 b = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(b, 1.);
  float ar = aspect();
  vec2 half_ = vec2(ar, 1.) * .5;
  float c = smoothstep(0., .55, p) * p_crumple;
  float s = 1. - smoothstep(.12, 1., p);
  vec2 org = vec2(p_x, p_y) * half_;
  vec2 x = centered(uv);
  vec2 y = rot(-c * .6) * (x - org * (1. - s)) / max(s, 1e-3);
  float k = 1. - .42 * min(c, 1.);
  float ang = atan(y.y, y.x);
  float d = sdRoundBox(y, half_ * k, min(c, 1.) * .5 * k);
  d += (vnoise(vec2(ang * 2.4 + 3., c * 2.)) - .5) * .12 * min(c, 1.);
  float aa = 1.5 * max(uPx, 1.) / uRes.y / max(s, 1e-3);
  float inside = 1. - smoothstep(-aa, aa, d);
  float sh = (1. - smoothstep(0., .12, d)) * p_shadow * .55 * min(c, 1.);
  vec3 col = b * (1. - sh * (1. - inside));
  if (inside <= 0.) return vec4(col, 1.);
  vec2 g = y * p_facets / k;
  vec2 bc = floor(g), id = bc; float f1 = 1e9, f2 = 1e9;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 cid = bc + vec2(i, j);
    float dd = length(g - cid - .5 - (hash22(cid) - .5) * .9);
    if (dd < f1){ f2 = f1; f1 = dd; id = cid; } else if (dd < f2) f2 = dd;
  }
  vec2 sheet = y / k + (hash22(id + 9.) - .5) * c * .05;
  vec3 a = texture(uA, clamp(uncentered(sheet), 0., 1.)).rgb;
  vec3 nrm = normalize(vec3((hash22(id + 5.) - .5) * 2.4 * c, 1.));
  vec3 lt = normalize(vec3(-.45, .6, .7));
  float dif = dot(nrm, lt) / lt.z;
  float ridge = 1. - smoothstep(0., .12, f2 - f1);
  vec3 crumpled = a * mix(1., dif, p_shade) * (1. - ridge * .35 * min(c, 1.) * p_shade) + ridge * .08 * min(c, 1.);
  return vec4(mix(col, clamp(crumpled, 0., 1.), inside), 1.);
}` });

FX.register({ id:'tr-blow-away', name:'Blow away', cat:'transition', search:['particles', 'dust', 'disintegrate', 'wind', 'sand', 'thanos', 'dissolve'],
  desc:'A breaks into fine particles that lift off in a gust, edge first, and drift away over B.',
  params:[ R('size','Particle size (px)',8,2,40,1), R('angle','Direction',20,-180,180,1), R('dist','Distance',.7,.1,2), R('turb','Turbulence',.5,0,1.5), R('life','Particle life',.45,.1,.9), R('rough','Ragged edge',.6,0,1) ],
  fs:`vec2 blow_dir(){ return vec2(cos(radians(p_angle)), sin(radians(p_angle))); }
vec2 blow_D(vec2 id, float cs, out float a){
  vec2 dir = blow_dir();
  vec2 cc = (id + .5) * cs;
  float ext = abs(dir.x) * aspect() * .5 + abs(dir.y) * .5;
  float o = 1. - (dot(cc, dir) / ext * .5 + .5);
  float n = vnoise(cc * 5. + 2.) - .5 + (hash12(id) - .5) * .5;
  float t0 = clamp(o * (1. - p_rough * .3) + n * p_rough * .5, 0., 1.) * (1. - p_life);
  a = clamp((uProgress - t0) / p_life, 0., 1.);
  vec2 perp = vec2(-dir.y, dir.x);
  float w = vnoise(cc * 3. + vec2(a * 3., 7.)) - .5;
  return dir * p_dist * a * a * (.6 + .8 * hash12(id + 3.)) + perp * w * p_turb * a * .5 + (hash22(id + 11.) - .5) * a * .12 * p_turb;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 b = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(b, 1.);
  vec2 x = centered(uv);
  float cs = max(p_size, 1.) / uRes.y;
  vec2 dir = blow_dir();
  float bestA = 2.; vec2 bestId = vec2(0.);
  for (int j = 0; j < 4; j++){
    vec2 y = x - dir * p_dist * float(j) / 3.;
    float a;
    for (int it = 0; it < 4; it++) y = x - blow_D(floor(y / cs), cs, a);
    vec2 base = floor(y / cs);
    for (int v = -1; v <= 1; v++) for (int u = -1; u <= 1; u++){
      vec2 id = base + vec2(u, v);
      vec2 D = blow_D(id, cs, a);
      if (a >= 1.) continue;
      vec2 ctr = (id + .5) * cs + D;
      float hw = a <= 0. ? cs * .5 : cs * .5 * (1. - a * .5);
      if (max(abs(x.x - ctr.x), abs(x.y - ctr.y)) <= hw && a < bestA){ bestA = a; bestId = id; }
    }
    if (bestA <= 0.) break;
  }
  if (bestA > 1.) return vec4(b, 1.);
  if (bestA <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  vec3 pc = texture(uA, clamp(uncentered((bestId + .5) * cs), 0., 1.)).rgb;
  float alpha = 1. - smoothstep(.4, 1., bestA);
  return vec4(mix(b, pc * (1. + .25 * bestA), alpha), 1.);
}` });

FX.register({ id:'tr-wind-streaks', name:'Wind streaks', cat:'transition', search:['wind', 'streak', 'scanline wipe', 'speed lines', 'smear'],
  desc:'B blows in on fine horizontal streaks that run ahead of the edge, each line at its own pace, smearing the picture as it passes.',
  params:[ S('dir','Direction',DIRS4,1), R('size','Streak length',.35,.02,1), R('row','Row height (px)',3,1,40,1), R('smear','Smear',.6,0,1), R('soft','Softness',.15,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  int m = int(p_dir + .5);
  vec2 dv = m == 0 ? vec2(0., -1.) : m == 1 ? vec2(1., 0.) : m == 2 ? vec2(0., 1.) : vec2(-1., 0.);
  float e = m == 0 ? 1. - uv.y : m == 1 ? uv.x : m == 2 ? uv.y : 1. - uv.x;
  float across = (m == 0 || m == 2) ? uv.x * uRes.x : uv.y * uRes.y;
  float row = floor(across / max(p_row * max(uPx, 1.) / max(uPx, 1.), 1.));
  float r = mix(hash12(vec2(row, 5.)), vnoise(vec2(row * .06, 1.)), .45);
  float S = p_size;
  float v = (1. - e) * (1. - S) + S * r - p * (1. + S);
  float m2 = smoothstep(0., -S * max(p_soft, .03), v);
  float zone = exp(-abs(v) / max(S * .5, 1e-3)) * p_smear * sin(p * PI);
  vec3 a = vec3(0.), b = vec3(0.);
  for (int i = 0; i < 8; i++){
    vec2 st = uv - dv * zone * .18 * float(i) / 7.;
    a += texture(uA, st).rgb; b += texture(uB, st).rgb;
  }
  a /= 8.; b /= 8.;
  vec3 col = mix(a, b, m2);
  col += vec3(.12) * zone * (1. - abs(m2 - .5) * 2.);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-halftone-morph', name:'Halftone morph', cat:'transition', search:['halftone', 'print', 'screen', 'dots', 'newsprint', 'am screen'],
  desc:'The picture breaks into a halftone screen whose dots swell until they touch, swap to B underneath, and shrink back into the new photograph.',
  params:[ R('cell','Dot size',.022,.006,.06), R('angle','Screen angle',45,0,90,1), S('style','Dots',['Colour on paper','Ink on paper','Colour on black'],0), C('ink','Ink','#16171a','ink'), C('paper','Paper','#f2efe6','ground'), R('spread','Stagger',.3,0,.6) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  float h = smoothstep(0., .3, p) * (1. - smoothstep(.7, 1., p));
  mat2 R = rot(radians(p_angle));
  vec2 g = R * centered(uv) / p_cell;
  vec2 id = floor(g), f = fract(g) - .5;
  vec2 cc = clamp(uncentered(transpose(R) * ((id + .5) * p_cell)), 0., 1.);
  float tc = .5 + (hash12(id) - .5) * p_spread;
  bool useB = p > tc;
  vec3 src = useB ? texture(uB, cc).rgb : texture(uA, cc).rgb;
  float L = luma(src);
  int st = int(p_style + .5);
  float r = st == 1 ? sqrt(1. - L) * .62 : sqrt(L) * .62;
  float grow = 1. - smoothstep(0., .3, abs(p - tc));
  r = mix(r, st == 1 ? .5 : .74, grow);
  float aa = max(uPx, 1.) / (p_cell * uRes.y);
  float dotm = 1. - smoothstep(r - aa, r + aa, length(f));
  vec3 bg = st == 2 ? vec3(.02) : p_paper;
  vec3 ink = st == 1 ? p_ink : src;
  vec3 ht = mix(bg, ink, dotm);
  vec3 under = useB ? texture(uB, uv).rgb : texture(uA, uv).rgb;
  return vec4(mix(under, ht, h), 1.);
}` });

FX.register({ id:'tr-glyph-grid', name:'Glyph grid', cat:'transition', search:['ascii', 'character', 'terminal', 'dot matrix', 'mosaic', 'code'],
  desc:'The frame turns into a grid of small marks, bars, dots or blocks set by brightness, which scramble and resolve into B.',
  params:[ I('rows','Rows',24,8,140), S('glyph','Marks',['Bars','Dots','Blocks'],1), S('colour','Colour',['From the image','Ink on ground'],0), C('ink','Ink','#e8e6df','ink'), C('ground','Ground','#121314','ground'), R('scramble','Scramble',.5,0,1) ],
  fs:`float glyph_mark(vec2 f, float L, int kind){
  if (kind == 0){
    float n = floor(L * 4.99);
    float k = floor((f.y + .5) * 4.);
    float lit = step(k + .5, n) * step(abs(f.x), .36);
    return lit * step(abs(fract((f.y + .5) * 4.) - .5), .22);
  }
  if (kind == 1){
    vec2 q = floor((f + .5) * 3.);
    float idx = q.x + q.y * 3.;
    float order = fract(idx * .618 + .1);
    float lit = step(order, L * 1.05 - .02);
    return lit * (1. - smoothstep(.36, .44, length(fract((f + .5) * 3.) - .5)));
  }
  vec2 q = floor((f + .5) * 2.);
  float order = q.x + (1. - q.y) * 2.;
  order = order == 1. ? 3. : order == 3. ? 1. : order;
  float lit = step(order + .5, L * 4.99);
  vec2 qq = abs(fract((f + .5) * 2.) - .5);
  return lit * step(max(qq.x, qq.y), .42);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  float h = smoothstep(0., .28, p) * (1. - smoothstep(.72, 1., p));
  float rows = max(p_rows, 1.);
  vec2 g = centered(uv) * rows;
  vec2 id = floor(g), f = fract(g) - .5;
  vec2 cc = clamp(uncentered((id + .5) / rows), 0., 1.);
  float tc = .5 + (hash12(id) - .5) * .3;
  bool useB = p > tc;
  vec3 src = useB ? texture(uB, cc).rgb : texture(uA, cc).rgb;
  float L = luma(src);
  if (abs(p - tc) < .1 * p_scramble) L = hash12(id + floor(p * 90.));
  float mk = glyph_mark(f, L, int(p_glyph + .5));
  vec3 ink = p_colour < .5 ? clamp(src / max(max(src.r, max(src.g, src.b)), .25) * .95, 0., 1.) : p_ink;
  vec3 gl = mix(p_colour < .5 ? src * .12 : p_ground, ink, mk);
  vec3 under = useB ? texture(uB, uv).rgb : texture(uA, uv).rgb;
  return vec4(mix(under, gl, h), 1.);
}` });

FX.register({ id:'tr-comic-pop', name:'Comic pop', cat:'transition', search:['comic', 'pop art', 'ben-day', 'burst', 'cartoon', 'halftone', 'starburst'],
  desc:'A turns to flat print colour with ink lines and dots, a starburst punches through, and B arrives the same way before settling back to a photograph.',
  params:[ I('levels','Colour levels',4,2,8), R('dot','Dot size (px)',10,3,40,1), R('line','Ink lines',.7,0,1), I('spikes','Burst points',14,6,30), C('burst','Burst','#ffd23a','accent'), C('burst2','Burst dots','#ff3b30','accent2'), C('ink','Ink','#111111','ink') ],
  fs:`vec3 comic_look(bool useB, vec2 uv, float amt){
  vec3 c = useB ? texture(uB, uv).rgb : texture(uA, uv).rgb;
  if (amt <= 0.) return c;
  vec2 o = 1.5 * max(uPx, 1.) / uRes;
  float lx = useB ? luma(texture(uB, uv + vec2(o.x, 0.)).rgb) - luma(texture(uB, uv - vec2(o.x, 0.)).rgb)
                  : luma(texture(uA, uv + vec2(o.x, 0.)).rgb) - luma(texture(uA, uv - vec2(o.x, 0.)).rgb);
  float ly = useB ? luma(texture(uB, uv + vec2(0., o.y)).rgb) - luma(texture(uB, uv - vec2(0., o.y)).rgb)
                  : luma(texture(uA, uv + vec2(0., o.y)).rgb) - luma(texture(uA, uv - vec2(0., o.y)).rgb);
  float lv = max(p_levels, 2.) - 1.;
  vec3 hsv = rgb2hsv(c);
  hsv.y = min(hsv.y * 1.35, 1.);
  hsv.z = floor(hsv.z * lv + .5) / lv;
  vec3 q = hsv2rgb(hsv);
  vec2 pxc = rot(radians(45.)) * (uv * uRes / max(uPx, 1.)) / max(p_dot / max(uPx, 1.), 1.);
  float dr = length(fract(pxc) - .5);
  float tone = 1. - luma(c);
  float dots = 1. - smoothstep(.5 * sqrt(tone) * .9 - .06, .5 * sqrt(tone) * .9 + .06, dr);
  q *= 1. - dots * .35;
  float edge = smoothstep(.05, .18, length(vec2(lx, ly))) * p_line;
  q = mix(q, p_ink, edge);
  return mix(c, q, amt);
}
float comic_star(vec2 c, float R, float n, float turn){
  float a = atan(c.y, c.x) + turn;
  float t = abs(fract(a / TAU * n) - .5) * 2.;
  return length(c) - R * (1. + .45 * t);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  if (p <= 0.) return vec4(texture(uA, uv).rgb, 1.);
  if (p >= 1.) return vec4(texture(uB, uv).rgb, 1.);
  float bump = exp(-pow((p - .5) / .12, 2.));
  vec2 st = (uv - .5) * (1. - .06 * bump) + .5;
  bool useB = p >= .5;
  float amt = useB ? 1. - smoothstep(.68, 1., p) : smoothstep(0., .3, p);
  vec3 col = comic_look(useB, st, amt);
  vec2 c = centered(uv);
  float n = max(p_spikes, 3.);
  float maxR = length(vec2(aspect(), 1.)) * .5 + .02;
  float Ro = maxR * smoothstep(.28, .5, p);
  float Ri = maxR * 1.05 * smoothstep(.5, .72, p);
  float dOut = Ro > 0. ? comic_star(c, Ro, n, 0.) : 1.;
  float dIn = Ri > 0. ? comic_star(c, Ri, n, PI / n) : 1.;
  float aa = 1.5 * max(uPx, 1.) / uRes.y;
  float inStar = (1. - smoothstep(-aa, aa, dOut)) * smoothstep(-aa, aa, dIn);
  if (inStar > 0.){
    vec2 pxc = rot(radians(15.)) * c * uRes.y / max(p_dot * 1.6, 1.);
    float rr = length(c) / max(maxR * 1.45, 1e-3);
    float dot2 = 1. - smoothstep(.22 * rr + .05, .22 * rr + .1, length(fract(pxc) - .5));
    vec3 fill = mix(p_burst, p_burst2, dot2);
    float lw = min(6. * max(uPx, 1.) / uRes.y, Ro * .06);
    float outline = 1. - smoothstep(lw, lw + aa, min(abs(dOut), Ri > 0. ? abs(dIn) : 1.));
    fill = mix(fill, p_ink, outline);
    col = mix(col, fill, inStar);
  }
  return vec4(col, 1.);
}` });
