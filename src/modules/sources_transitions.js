/* ---------------- Sources ---------------- */
FX.register({ id:'src-a', name:'Image A', cat:'source', desc:'Source A on its own.', params:[],
  fs:`vec4 fx(vec2 uv){ return vec4(texture(uA, uv).rgb, 1.); }` });
FX.register({ id:'src-b', name:'Image B', cat:'source', desc:'Source B on its own.', params:[],
  fs:`vec4 fx(vec2 uv){ return vec4(texture(uB, uv).rgb, 1.); }` });

/* ---------------- Transitions (A → B, driven by uProgress) ---------------- */
FX.register({ id:'tr-crossfade', name:'Crossfade', cat:'transition', desc:'Straight dissolve, or dip through a colour.',
  params:[ T('dip','Dip to colour'), C('color','Colour','#000000') ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb; float p = uProgress;
  if (p_dip > .5){ vec3 c = p < .5 ? mix(a, p_color, p * 2.) : mix(p_color, b, (p - .5) * 2.); return vec4(c, 1.); }
  return vec4(mix(a, b, p), 1.);
}` });

FX.register({ id:'tr-scanner', name:'Scanner', cat:'transition', desc:'Flatbed scan bar sweeps across, smearing pixels and leaving B behind it.',
  params:[ S('dir','Direction',DIRS4,0), R('width','Bar width',.08,.005,.4), R('glow','Glow',.9,0,3), R('stretch','Smear',.65,0,1), C('color','Lamp','#c9f5e4') ],
  fs:`vec4 fx(vec2 uv){
  int m = int(p_dir + .5);
  float coord = m == 0 ? 1. - uv.y : m == 1 ? uv.x : m == 2 ? uv.y : 1. - uv.x;
  float w = p_width;
  float pos = mix(-w * 2., 1. + w * 2., uProgress);
  float d = coord - pos;
  float inside = 1. - smoothstep(0., w, abs(d));
  float cc = clamp(pos, 0., 1.);
  float sc = mix(coord, cc, inside * p_stretch);
  vec2 st = uv;
  if (m == 0) st.y = 1. - sc; else if (m == 1) st.x = sc; else if (m == 2) st.y = sc; else st.x = 1. - sc;
  vec3 a = texture(uA, st).rgb, b = texture(uB, st).rgb;
  float reveal = 1. - smoothstep(-w * .25, w * .25, d);
  vec3 col = mix(a, b, reveal);
  float across = (m == 0 || m == 2) ? uv.x * uRes.x : uv.y * uRes.y;
  float streak = hash12(vec2(floor(across * .5), floor(uTime * 24.)));
  float glow = exp(-pow(d / max(w * .5, 1e-4), 2.));
  float core = 1. - smoothstep(0., 2.5 / min(uRes.x, uRes.y), abs(d));
  col += p_color * (glow * .6 * (.7 + .3 * streak) + core) * p_glow;
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-wipe', name:'Wipe', cat:'transition', desc:'Hard or soft edge at any angle, with a straight, waved, torn, stepped or zigzag edge and an optional edge line.',
  params:[ R('angle','Angle',0,-180,180,1), R('soft','Softness',.02,0,.5), R('line','Edge line',0,0,.05), C('color','Line colour','#ffffff','accent'),
    S('edge','Edge shape',['Straight','Waved','Torn','Stepped','Zigzag'],0), R('edgeAmount','Edge amount',.4,0,2), R('edgeScale','Edge scale',6,.5,40), I('steps','Steps',10,2,60), R('push','Push B in',0,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec2 dir = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 c = centered(uv);
  float ext = abs(dir.x) * aspect() * .5 + abs(dir.y) * .5;
  float d = dot(c, dir);
  vec2 perp = vec2(-dir.y, dir.x);
  float along = dot(c, perp);
  int em = int(p_edge + .5);
  if (em == 1) d -= sin(along * p_edgeScale * 3.) * p_edgeAmount * .06;
  else if (em == 2) d -= (fbm(vec2(along * p_edgeScale, 3.1)) - .5) * p_edgeAmount * .3 + (fbm(vec2(along * p_edgeScale * 6., 7.7)) - .5) * p_edgeAmount * .05;
  else if (em == 3) d -= (floor(fract(along * p_steps * .5) * 2.) - .5) * p_edgeAmount * .08;
  else if (em == 4) d -= (abs(fract(along * p_edgeScale * .5) - .5) * 2. - .5) * p_edgeAmount * .1;
  float s = max(p_soft * .5, 1e-4);
  float edge = mix(-ext - s - p_line - p_edgeAmount * .2, ext + s + p_line + p_edgeAmount * .2, uProgress);
  float bAmt = 1. - smoothstep(edge - s, edge + s, d);
  vec2 bUv = uv + dir * (1. - uProgress) * p_push * .25 / vec2(aspect(), 1.);
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, bUv).rgb, bAmt);
  if (p_line > 0.) col = mix(col, p_color, 1. - smoothstep(p_line, p_line + 1.5 / uRes.y, abs(d - edge)));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-iris', name:'Iris', cat:'transition', desc:'Shape opens (or closes) from any point.', search:['reveal'],
  params:[ S('shape','Shape',['Circle','Square','Diamond']), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1), R('soft','Softness',.01,0,.3), T('inv','Close instead') ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 o = vec2(p_x * ar * .5, p_y * .5);
  vec2 c = centered(uv) - o;
  int s = int(p_shape + .5);
  vec2 e = vec2(ar * .5, .5) + abs(o);
  float maxR = s == 0 ? length(e) : s == 1 ? max(e.x, e.y) : e.x + e.y;
  float d = s == 0 ? length(c) : s == 1 ? max(abs(c.x), abs(c.y)) : abs(c.x) + abs(c.y);
  float sf = max(p_soft, 1e-3);
  float pp = p_inv > .5 ? 1. - uProgress : uProgress;
  float r = mix(-sf, maxR + sf, pp);
  float inside = 1. - smoothstep(r - sf, r + sf, d);
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  return vec4(p_inv > .5 ? mix(b, a, inside) : mix(a, b, inside), 1.);
}` });

FX.register({ id:'tr-clock', name:'Clock wipe', cat:'transition', desc:'Radial sweep, with multiple blades.',
  params:[ R('start','Start angle',0,-180,180,1), I('blades','Blades',1,1,12), R('soft','Softness',.01,0,.2) ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float ang = fract((atan(c.x, c.y) + radians(p_start)) / TAU);
  ang = fract(ang * max(floor(p_blades), 1.));
  float s = max(p_soft, 1e-3);
  float m = 1. - smoothstep(uProgress * (1. + s) - s, uProgress * (1. + s), ang);
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-push', name:'Push / slide', cat:'transition', desc:'B pushes A out, slides over it, or A slides away.',
  params:[ S('dir','Direction',['Left','Right','Up','Down']), S('mode','Mode',['Push','Slide over','Reveal']), R('blur','Motion blur',.5,0,1) ],
  fs:`vec3 pushAt(vec2 uv, float p){
  int d = int(p_dir + .5); int mode = int(p_mode + .5);
  vec2 dir = d == 0 ? vec2(-1, 0) : d == 1 ? vec2(1, 0) : d == 2 ? vec2(0, 1) : vec2(0, -1);
  vec2 ua = mode == 1 ? uv : uv - dir * p;
  vec2 ub = mode == 2 ? uv : uv + dir * (1. - p);
  bool inB = all(greaterThanEqual(ub, vec2(0.))) && all(lessThanEqual(ub, vec2(1.)));
  bool inA = all(greaterThanEqual(ua, vec2(0.))) && all(lessThanEqual(ua, vec2(1.)));
  if (mode == 2) return inA ? texture(uA, ua).rgb : texture(uB, ub).rgb;
  return inB ? texture(uB, ub).rgb : texture(uA, ua).rgb;
}
vec4 fx(vec2 uv){
  float spread = p_blur * sin(uProgress * PI) * .06;
  vec3 acc = vec3(0.);
  for (int i = 0; i < 10; i++){ float k = float(i) / 9. - .5; acc += pushAt(uv, clamp(uProgress + k * spread, 0., 1.)); }
  return vec4(acc / 10., 1.);
}` });

FX.register({ id:'tr-zoom', name:'Zoom through', cat:'transition', desc:'Radial zoom blur that punches through into B.',
  params:[ R('amount','Strength',.8,0,2), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress; float strength = sin(p * PI) * p_amount;
  vec2 ctr = vec2(.5) + vec2(p_x, p_y) * .5;
  vec3 acc = vec3(0.);
  float sw = smoothstep(.35, .65, p);
  for (int i = 0; i < 24; i++){
    float k = float(i) / 23.;
    vec2 st = (uv - ctr) * (1. - strength * k * .45) + ctr;
    acc += mix(texture(uA, st).rgb, texture(uB, st).rgb, sw);
  }
  return vec4(acc / 24., 1.);
}` });

FX.register({ id:'tr-pixel', name:'Pixel dissolve', cat:'transition', desc:'Resolution collapses into blocks that flip to B at random.',
  params:[ R('min','Coarsest cells',14,2,80,1), R('spread','Randomness',.6,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float t = 1. - abs(p * 2. - 1.);
  float cells = mix(uRes.y, p_min, pow(t, .5));
  vec2 grid = vec2(cells * aspect(), cells);
  vec2 id = floor(uv * grid);
  vec2 st = (id + .5) / grid;
  float thr = mix(.5, .2 + hash12(id) * .6, p_spread);
  return vec4(mix(texture(uA, st).rgb, texture(uB, st).rgb, step(thr, p)), 1.);
}` });

FX.register({ id:'tr-glitch', name:'Glitch cut', cat:'transition', desc:'Row tears, block shifts and RGB split peak mid-transition.',
  params:[ R('amount','Intensity',.8,0,1.5), R('rate','Flicker rate',18,1,60,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress; float amt = sin(p * PI) * p_amount;
  float seed = floor(uTime * p_rate);
  float rows = mix(8., 40., hash12(vec2(seed, 1.)));
  float row = floor(uv.y * rows);
  vec2 off = vec2((hash12(vec2(row, seed)) - .5) * amt * .35 * step(.55, hash12(vec2(row, seed + 7.))), 0.);
  vec2 blk = floor(uv * vec2(12., 20.));
  off.x += step(1. - amt * .45, hash12(blk + seed)) * (hash12(blk + seed + 3.) - .5) * .2;
  vec2 st = uv + off; float ca = amt * .02;
  vec3 a = vec3(texture(uA, st + vec2(ca, 0)).r, texture(uA, st).g, texture(uA, st - vec2(ca, 0)).b);
  vec3 b = vec3(texture(uB, st + vec2(ca, 0)).r, texture(uB, st).g, texture(uB, st - vec2(ca, 0)).b);
  float thr = hash12(vec2(row, 91.));
  float mv = clamp((p - thr * .6) / .4, 0., 1.);
  float jitter = (hash12(vec2(row, seed + 5.)) - .5) * amt;
  return vec4(mix(a, b, step(.5, mv + jitter)), 1.);
}` });

FX.register({ id:'tr-dissolve', name:'Luma / burn dissolve', cat:'transition', desc:'Pixels switch in order of brightness or noise, with a burning edge.',
  params:[ S('source','Order by',['Luma of A','Luma of B','Noise']), R('scale','Noise scale',3,.5,20), R('soft','Softness',.05,0,.4), T('invert','Reverse order'), R('edge','Burn edge',.03,0,.2), C('color','Edge colour','#ff7a2a') ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  int src = int(p_source + .5);
  float n = src == 0 ? luma(a) : src == 1 ? luma(b) : clamp((fbm(centered(uv) * p_scale + 3.1) - .2) / .6, 0., 1.);
  if (p_invert > .5) n = 1. - n;
  float s = max(p_soft, 1e-3);
  float thr = mix(-s - p_edge, 1. + s + p_edge, uProgress);
  float bAmt = 1. - smoothstep(thr - s, thr + s, n);
  vec3 col = mix(a, b, bAmt);
  if (p_edge > 0.){
    float e = 1. - smoothstep(0., p_edge, abs(n - thr - s));
    col = mix(col, p_color, e * step(.001, uProgress) * step(uProgress, .999));
  }
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-blinds', name:'Blinds', cat:'transition', desc:'Venetian slats at any angle, staggered across the frame.',
  params:[ I('count','Slats',12,1,60), R('angle','Angle',90,-180,180,1), R('stagger','Stagger',.5,0,.9), T('center','Open from centre') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = rot(radians(p_angle)) * centered(uv);
  float n = max(p_count, 1.);
  float f = fract(c.x * n);
  float idx = floor(c.x * n);
  float order = clamp(((idx + .5) / n) / length(vec2(aspect(), 1.)) + .5, 0., 1.);
  float st = clamp(p_stagger, 0., .9);
  float lp = clamp((uProgress - order * st) / (1. - st), 0., 1.);
  float aa = n * fwidth(c.x);
  float g = p_center > .5 ? abs(f - .5) * 2. : f;
  float edge = mix(-aa, 1. + aa, lp);
  float m = 1. - smoothstep(edge - aa, edge + aa, g);
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'tr-tiles', name:'Tile flip', cat:'transition', desc:'Grid of tiles flip or scale from A to B in sequence.',
  params:[ I('tiles','Rows',6,1,30), S('pattern','Order',['Diagonal','Radial','Random']), S('mode','Motion',['Flip','Scale']), R('stagger','Stagger',.6,0,.95), C('color','Gap colour','#111111') ],
  fs:`vec4 fx(vec2 uv){
  vec2 grid = vec2(max(1., floor(p_tiles * aspect() + .5)), max(p_tiles, 1.));
  vec2 id = floor(uv * grid); vec2 f = fract(uv * grid);
  vec2 idn = (id + .5) / grid;
  int pat = int(p_pattern + .5);
  float o = pat == 0 ? idn.x * .5 + (1. - idn.y) * .5 : pat == 1 ? length(idn - .5) * 1.4142 : hash12(id + 13.);
  float st = clamp(p_stagger, 0., .95);
  float lp = clamp((uProgress - o * st) / (1. - st), 0., 1.);
  float s = lp < .5 ? 1. - lp * 2. : lp * 2. - 1.;
  s = s * s * (3. - 2. * s);
  vec2 q = f - .5;
  vec2 sc = int(p_mode + .5) == 0 ? vec2(max(s, 1e-3), 1.) : vec2(max(s, 1e-3));
  vec2 ql = q / sc;
  if (any(greaterThan(abs(ql), vec2(.5)))) return vec4(p_color, 1.);
  vec2 tuv = (id + ql + .5) / grid;
  return vec4(lp < .5 ? texture(uA, tuv).rgb : texture(uB, tuv).rgb, 1.);
}` });

FX.register({ id:'tr-ripple', name:'Liquid ripple', cat:'transition', desc:'Concentric ripple distorts outward as B floods in.',
  params:[ R('amp','Amplitude',1,0,3), R('freq','Frequency',30,2,120,1), R('speed','Speed',8,0,30) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress; float t = sin(p * PI);
  vec2 c = centered(uv); float d = length(c);
  vec2 dir = d > 0. ? c / d : vec2(0.);
  float wave = sin(d * p_freq - uTime * p_speed) * t * p_amp * .03;
  vec2 st = uv + dir * wave * vec2(1. / aspect(), 1.);
  float m = smoothstep(0., 1., clamp(p * 1.6 - d * .55, 0., 1.));
  return vec4(mix(texture(uA, st).rgb, texture(uB, st).rgb, m), 1.);
}` });

FX.register({ id:'tr-bars', name:'Colour bars', cat:'transition', desc:'Staggered bars sweep in to cover A, then pull away to reveal B.',
  params:[ I('count','Bars',5,1,24), S('dir','Direction',['Top → bottom','Left → right']), R('stagger','Stagger',.35,0,.9), C('color','Colour 1','#c9f5e4'), C('color2','Colour 2','#1a1b1d') ],
  fs:`vec4 fx(vec2 uv){
  float n = max(p_count, 1.);
  bool vert = p_dir < .5;
  float across = vert ? uv.x : 1. - uv.y;
  float along = vert ? 1. - uv.y : uv.x;
  float id = floor(across * n);
  float st = clamp(p_stagger, 0., .9);
  float o = id / max(n - 1., 1.);
  float lp = clamp((uProgress - o * st) / (1. - st), 0., 1.);
  float head = clamp(lp * 2., 0., 1.), tail = clamp(lp * 2. - 1., 0., 1.);
  head = head * head * (3. - 2. * head); tail = tail * tail * (3. - 2. * tail);
  if (along < tail) return vec4(texture(uB, uv).rgb, 1.);
  if (along < head) return vec4(mod(id, 2.) < .5 ? p_color : p_color2, 1.);
  return vec4(texture(uA, uv).rgb, 1.);
}` });

FX.register({ id:'tr-dots', name:'Dot grid reveal', cat:'transition', desc:'Halftone dots grow outward from a point until B is whole.',
  params:[ R('cells','Rows',18,3,80,1), S('shape','Shape',['Circle','Square']), R('x','Origin X',0,-1,1), R('y','Origin Y',0,-1,1), R('stagger','Stagger',.6,0,.9) ],
  fs:`vec4 fx(vec2 uv){
  float ar = aspect();
  vec2 grid = vec2(p_cells * ar, p_cells);
  vec2 id = floor(uv * grid); vec2 f = fract(uv * grid) - .5;
  vec2 idn = (id + .5) / grid;
  vec2 org = vec2(.5 + p_x * .5, .5 + p_y * .5);
  float o = clamp(length((idn - org) * vec2(ar, 1.)) / length(vec2(ar, 1.)), 0., 1.);
  float st = clamp(p_stagger, 0., .9);
  float lp = clamp((uProgress - o * st) / (1. - st), 0., 1.);
  bool sq = p_shape > .5;
  float d = sq ? max(abs(f.x), abs(f.y)) : length(f);
  float r = lp * (sq ? .51 : .72);
  float aa = .75 * grid.y / uRes.y;
  float m = lp >= 1. ? 1. : 1. - smoothstep(r - aa, r + aa, d);
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });
