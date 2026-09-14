/* ---------------- Library additions ---------------- */

/* ---- Page turn ---- */
FX.register({ id:'tr-curl', name:'Page turn', cat:'transition', desc:'A sheet peels back to reveal B, with a lit curl at the fold, a shadow on the page beneath and a choice of what the back shows.',
  params:[ R('angle','Direction',150,-180,180,1), R('radius','Curl softness',.1,.01,.4), R('shadow','Shadow',.6,0,1.5), R('shine','Sheen',.7,0,2), S('back','Back of the page',['Mirror of A','Colour','Image B','Darkened A'],0), C('paper','Back colour','#e4e2dc','ink'), R('corner','Corner peel',.4,0,1.5), R('curlDark','Curl shading',.5,0,1.5) ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float a = radians(p_angle);
  vec2 dir = vec2(cos(a), sin(a));
  float ext = abs(dir.x) * aspect() * .5 + abs(dir.y) * .5;
  float d = dot(c, dir);
  float bend = p_corner * .3 * dot(c, vec2(-dir.y, dir.x));
  float edge = mix(ext + .02, -ext - .02, uProgress) + bend;   /* the fold sweeps in, peeling A away */
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  float r = max(p_radius, .01);
  if (d <= edge){
    /* still flat: darken it a little where the flap hangs over */
    float over = smoothstep(0., r * 2., edge - d);
    float sh = (1. - over) * p_shadow * .5;
    return vec4(A * (1. - sh), 1.);
  }
  /* past the fold: the sheet is folded back on itself */
  float over = d - edge;
  vec2 qc = c - dir * over * 2.;
  vec2 q = qc / vec2(aspect(), 1.) + .5;
  bool onFlap = all(greaterThanEqual(q, vec2(0.))) && all(lessThanEqual(q, vec2(1.)));
  if (!onFlap){
    /* revealed B, with the flap's shadow falling on it */
    float sh = smoothstep(r * 3., 0., over - (ext + edge)) * p_shadow * .45;
    return vec4(B * (1. - sh), 1.);
  }
  int bm = int(p_back + .5);
  vec3 back = bm == 0 ? texture(uA, q).rgb : bm == 1 ? p_paper : bm == 2 ? texture(uB, q).rgb : texture(uA, q).rgb * .55;
  /* shade the curl: dark right at the fold, bright a little past it */
  float curl = clamp(over / r, 0., 1.);
  back *= mix(1. - p_curlDark * .55, 1., smoothstep(0., 1., curl));
  back += vec3(pow(1. - abs(curl * 2. - .6), 6.)) * p_shine * .4;
  return vec4(clamp(back, 0., 1.), 1.);
}` });

/* ---- Shape grid ---- */
FX.register({ id:'tr-shapes', name:'Shape grid', cat:'transition', desc:'B arrives through a grid of growing shapes — circles, squares, diamonds, crosses or triangles — in waves.',
  params:[ R('count','Grid count',9,2,60), S('shape','Shape',['Circle','Square','Diamond','Cross','Triangle'],0), S('order','Order',['Diagonal','Left to right','Centre out','Random','Rows'],0), R('spread','Wave spread',.6,0,1), R('rotate','Rotate shapes',0,-180,180,1), R('overshoot','Overshoot',1.15,1,2),
    T('outline','Outline first',false), R('line','Outline weight',.06,.01,.3), C('color','Outline colour','#ff5a36','accent') ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = uv * vec2(aspect(), 1.) * p_count;
  vec2 id = floor(p), f = fract(p) - .5;
  float cols = p_count * aspect();
  float o;
  int om = int(p_order + .5);
  vec2 n = vec2(id.x / max(cols, 1.), id.y / max(p_count, 1.));
  if (om == 0) o = (n.x + n.y) * .5;
  else if (om == 1) o = n.x;
  else if (om == 2) o = length(n - .5) * 1.4;
  else if (om == 3) o = hash12(id);
  else o = n.y;
  float local = clamp((uProgress * (1. + p_spread) - o * p_spread) / max(1. - 0., 1e-3), 0., 1.);
  float rad = local * .72 * p_overshoot;
  vec2 q = rot(radians(p_rotate)) * f;
  int sm = int(p_shape + .5);
  float dist;
  if (sm == 0) dist = length(q);
  else if (sm == 1) dist = max(abs(q.x), abs(q.y));
  else if (sm == 2) dist = abs(q.x) + abs(q.y);
  else if (sm == 3) dist = min(max(abs(q.x) * .35, abs(q.y)), max(abs(q.x), abs(q.y) * .35));
  else dist = sdTri(q * 1.6, .55) * .5 + .25;
  float aa = fwidth(dist) * 1.2 + .002;
  float m = 1. - smoothstep(rad - aa, rad + aa, dist);
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m);
  if (p_outline > .5){
    float ring = (1. - smoothstep(rad + p_line, rad + p_line + aa, dist)) - (1. - smoothstep(rad, rad + aa, dist));
    col = mix(col, p_color, clamp(ring, 0., 1.) * (1. - local));
  }
  return vec4(col, 1.);
}` });

/* ---- Smear ---- */
FX.register({ id:'tr-smear', name:'Smear', cat:'transition', desc:'A and B smear into each other along one direction, as if dragged — fast in the middle, sharp at both ends.', search:['distort'],
  params:[ R('angle','Direction',0,-180,180,1), R('amount','Smear',.25,0,1), I('samples','Smoothness',20,4,48), R('shift','Travel',.4,0,1.5), S('blend','Meet',['Cut','Blend','Squeeze'],1), R('chroma','Colour split',.35,0,2), R('grain','Grain',.06,0,.5) ],
  fs:`vec4 fx(vec2 uv){
  float a = radians(p_angle);
  vec2 dir = vec2(cos(a), sin(a)) / vec2(aspect(), 1.);
  float speed = sin(uProgress * PI);                     /* fastest through the middle */
  float len = p_amount * speed;
  int n = int(p_samples + .5);
  vec3 acc = vec3(0.); float ws = 0.;
  for (int i = 0; i < 48; i++){
    if (i >= n) break;
    float t = float(i) / float(n - 1) - .5;
    float w = 1. - abs(t) * .6;
    vec2 off = dir * t * len;
    vec2 ca = uv + off + dir * uProgress * p_shift;
    vec2 cb = uv + off - dir * (1. - uProgress) * p_shift;
    vec3 A = texture(uA, ca).rgb, B = texture(uB, cb).rgb;
    float mixK = int(p_blend + .5) == 0 ? step(.5, uProgress) : smoothstep(.35, .65, uProgress + t * .35);
    if (int(p_blend + .5) == 2) mixK = smoothstep(.5 - .5 * (1. - speed), .5 + .5 * (1. - speed), uProgress + t * .2);
    acc += mix(A, B, mixK) * w; ws += w;
  }
  vec3 col = acc / max(ws, 1e-4);
  if (p_chroma > .001){
    vec2 o = dir * len * p_chroma * .08;
    float k = smoothstep(.35, .65, uProgress);
    float r2 = mix(texture(uA, uv + o).r, texture(uB, uv + o).r, k);
    float b2 = mix(texture(uA, uv - o).b, texture(uB, uv - o).b, k);
    float amt = clamp(p_chroma, 0., 1.) * speed;
    col.r = mix(col.r, r2, amt); col.b = mix(col.b, b2, amt);
  }
  col += (hash12(uv * uRes + floor(uTime * 24.)) - .5) * p_grain * speed * .3;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Shake ---- */
FX.register({ id:'fx-shake', name:'Shake', cat:'fx', desc:'Camera shake, punch-in or handheld drift — on the beat, on the timeline, or running all the way through.',
  params:[ S('mode','Shake',['Beat hits','Handheld','Impact (timeline)','Rumble'],0), I('beats','Beats per loop (0 = brand)',0,0,32), R('amount','Amount',.02,0,.15), R('rotate','Rotation',.3,0,2), R('punch','Punch in',.04,0,.4), R('decay','Decay',4,.5,12), R('speed','Speed',1,.2,6), R('blur','Motion blur',.3,0,1), S('edges','Edges',['Zoom in','Mirror','Backdrop'],0) ],
  fs:`vec4 fx(vec2 uv){
  float beats = p_beats < .5 ? 4. : p_beats;
  int m = int(p_mode + .5);
  float env = 1.;
  float t = uTime * p_speed;
  if (m == 0) env = exp(-fract(uLoop * beats) * p_decay);
  else if (m == 2) env = exp(-uProgress * p_decay) ;
  else if (m == 3) env = 1.;
  else env = 1.;
  float nx = (m == 1 || m == 3) ? (vnoise(vec2(t * (m == 3 ? 9. : 1.6), 0.)) - .5) : (hash12(vec2(floor(uLoop * beats), 1.)) - .5);
  float ny = (m == 1 || m == 3) ? (vnoise(vec2(0., t * (m == 3 ? 8. : 1.4) + 3.7)) - .5) : (hash12(vec2(floor(uLoop * beats), 2.)) - .5);
  float nr = (m == 1 || m == 3) ? (vnoise(vec2(t * 1.1 + 9.1, 2.2)) - .5) : (hash12(vec2(floor(uLoop * beats), 3.)) - .5);
  vec2 off = vec2(nx, ny) * p_amount * env * 2.;
  float rotAmt = nr * radians(6.) * p_rotate * env;
  float zoom = 1. + p_punch * env;
  vec2 q = rot(rotAmt) * ((uv - .5) * vec2(aspect(), 1.)) / zoom;
  q = q / vec2(aspect(), 1.) + .5 + off;
  vec3 col;
  int n = p_blur > .001 ? 6 : 1;
  vec3 acc = vec3(0.);
  for (int i = 0; i < 6; i++){
    if (i >= n) break;
    vec2 s = q - off * p_blur * (float(i) / float(max(n - 1, 1)) - .5) * .8;
    if (int(p_edges + .5) == 1) s = mirrorUv(s);
    else if (int(p_edges + .5) == 2 && (any(lessThan(s, vec2(0.))) || any(greaterThan(s, vec2(1.))))){ acc += backdrop(uv); continue; }
    acc += texture(uInput, s).rgb;
  }
  col = acc / float(n);
  return vec4(col, 1.);
}` });

/* ---- Displace ---- */
FX.register({ id:'fx-displace', name:'Displace', cat:'fx', desc:'Pushes the frame around using another image as a map — image B, noise, or the frame\u2019s own brightness.', search:['distort', 'displace'],
  params:[ S('map','Map',['Image B','Noise','Own luminance','Cells'],0), R('amount','Amount',.06,0,.5), R('scale','Map scale',2,.2,12), I('speed','Loops per cycle',1,0,6), S('mode','Direction',['Gradient','Radial','Horizontal','Vertical'],0), R('chroma','Colour split',.3,0,2), R('smooth','Smoothing',1,0,4), T('edges','Show the map edges',false), C('edgeColor','Edge colour','#ff5a36','accent') ],
  fs:`float mapAt(vec2 uv){
  int m = int(p_map + .5);
  if (m == 0) return luma(texture(uB, (uv - .5) / max(p_scale, .05) * 2. + .5).rgb);
  if (m == 1) return fbm(uv * p_scale * 2. + vec2(uLoop * float(int(p_speed)), 0.));
  if (m == 2) return luma(texture(uInput, uv).rgb);
  vec2 p = uv * vec2(aspect(), 1.) * p_scale * 2.;
  vec2 ip = floor(p), fp = fract(p); float d = 8.;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 g = vec2(i, j), o = hash22(ip + g);
    o = .5 + .45 * sin(uLoop * TAU * float(int(p_speed)) + TAU * o);
    d = min(d, length(g + o - fp));
  }
  return d;
}
vec4 fx(vec2 uv){
  vec2 e = vec2(max(p_smooth, .25) * 1.5 / uRes.x, 0.);
  float c0 = mapAt(uv);
  float gx = mapAt(uv + e.xy) - mapAt(uv - e.xy);
  float gy = mapAt(uv + e.yx) - mapAt(uv - e.yx);
  vec2 push;
  int dm = int(p_mode + .5);
  if (dm == 0) push = vec2(gx, gy) * 6.;
  else if (dm == 1) push = normalize(centered(uv) + 1e-5) * (c0 - .5) * 2.;
  else if (dm == 2) push = vec2((c0 - .5) * 2., 0.);
  else push = vec2(0., (c0 - .5) * 2.);
  push *= p_amount;
  vec3 col;
  col.r = texture(uInput, uv - push * (1. + p_chroma * .08)).r;
  col.g = texture(uInput, uv - push).g;
  col.b = texture(uInput, uv - push * (1. - p_chroma * .08)).b;
  if (p_edges > .5){
    float edge = clamp(length(vec2(gx, gy)) * 30., 0., 1.);
    col = mix(col, p_edgeColor, edge * .8);
  }
  return vec4(col, 1.);
}` });

/* ---- Halation ---- */
FX.register({ id:'fx-halation', name:'Halation', cat:'fx', desc:'The warm glow that blooms around bright areas on film, with an optional soft-focus diffusion over the whole frame.',
  params:[ R('threshold','Glow above',.62,0,1), R('radius','Spread',34,4,160,1), R('intensity','Intensity',1,0,4), R('warmth','Warmth',.6,0,1), R('diffusion','Soft focus',.15,0,1), R('halo','Ring',0,0,1), T('protect','Keep highlights crisp',true), C('tint','Glow tint','#ff7a45') ],
  fs:`vec4 fx(vec2 uv){
  vec3 src = texture(uInput, uv).rgb;
  vec3 glow = vec3(0.); float ws = 0., diff = 0.;
  vec3 soft = vec3(0.);
  for (int i = 0; i < 32; i++){
    float fi = float(i);
    float rr = sqrt((fi + .5) / 32.) * p_radius;
    float a = fi * 2.39996 + uv.x * 6.;
    vec2 o = vec2(cos(a), sin(a)) * rr / uRes;
    vec3 c = texture(uInput, uv + o).rgb;
    float w = exp(-2.2 * rr * rr / max(p_radius * p_radius, 1e-3));
    float ring = p_halo > .01 ? mix(1., smoothstep(.55, 1., rr / max(p_radius, 1e-3)) * 2.2, p_halo) : 1.;
    glow += max(c - p_threshold, 0.) * w * ring;
    soft += c * w; ws += w; diff += w;
  }
  glow /= max(ws, 1e-4); soft /= max(diff, 1e-4);
  vec3 warm = mix(vec3(1.), p_tint, p_warmth);
  vec3 col = src;
  if (p_diffusion > .001) col = mix(col, max(col, soft), p_diffusion);
  vec3 add = glow * warm * p_intensity;
  if (p_protect > .5) add *= 1. - smoothstep(.85, 1., luma(src));
  col += add;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Film stock ---- */
FX.register({ id:'trt-film', name:'Film stock', cat:'treatment', desc:'Film emulation: curve and colour cast, halation, grain that sits in the midtones, gate weave, dust and hairs.', search:['texture'],
  params:[ S('stock','Stock',['Neutral','Warm 250D','Cool tungsten','Bleach bypass','Faded print','High contrast B&W'],0), R('exposure','Exposure',0,-1,1), R('contrast','Contrast',1,.2,2.5), R('saturation','Saturation',1,0,2), R('lift','Lifted blacks',.05,0,.3), R('grain','Grain',.35,0,1.5), R('grainSize','Grain size',1.4,.5,4),
    R('halation','Halation',.25,0,1), R('vignette','Vignette',.25,0,1), R('weave','Gate weave',.3,0,2), R('dust','Dust & hairs',.25,0,1), R('flicker','Flicker',.15,0,1) ],
  fs:`vec3 stockGrade(vec3 c, int s){
  if (s == 1) return vec3(c.r * 1.06 + .02, c.g * 1.0, c.b * .92 - .01);
  if (s == 2) return vec3(c.r * .92, c.g * .99, c.b * 1.1 + .02);
  if (s == 3){ float l = luma(c); return mix(vec3(l), c, .45) * 1.12 - .04; }
  if (s == 4){ return mix(c, vec3(.62, .58, .5), .22) * .95 + .04; }
  if (s == 5){ float l = luma(c); return vec3(clamp((l - .5) * 1.5 + .5, 0., 1.)); }
  return c;
}
vec4 fx(vec2 uv){
  float t = floor(uTime * 24.);
  vec2 weave = (vec2(vnoise(vec2(t * .13, 0.)), vnoise(vec2(0., t * .11 + 5.))) - .5) * p_weave * 3. / uRes;
  vec2 q = uv + weave;
  vec3 c = texture(uInput, q).rgb;
  if (p_halation > .001){
    vec3 g = vec3(0.); float ws = 0.;
    for (int i = 0; i < 12; i++){ float fi = float(i); float rr = sqrt((fi + .5) / 12.) * 26.; float a = fi * 2.39996;
      vec3 s = texture(uInput, q + vec2(cos(a), sin(a)) * rr / uRes).rgb;
      float w = exp(-2. * rr * rr / 676.); g += max(s - .6, 0.) * w; ws += w; }
    c += g / max(ws, 1e-4) * vec3(1., .55, .35) * p_halation * 2.2;
  }
  c = stockGrade(c, int(p_stock + .5));
  c = (c - .5) * p_contrast + .5 + p_exposure * .35;
  float l = luma(c);
  c = mix(vec3(l), c, p_saturation);
  c = c * (1. - p_lift) + p_lift;
  float lum = luma(c);
  float gmask = 4. * lum * (1. - lum);                         /* grain lives in the midtones */
  vec2 gp = floor(uv * uRes / max(p_grainSize, .25)) + t;
  c += (hash12(gp) - .5) * p_grain * .22 * (.35 + gmask);
  if (p_vignette > .001){ float v = 1. - smoothstep(.35, 1.05, length(centered(uv)) * 1.5); c *= mix(1., v, p_vignette); }
  if (p_dust > .001){
    vec2 dp = uv * uRes / 3.;
    float sp = step(1. - p_dust * .0016, hash12(floor(dp) + t * 7.));
    float hair = step(.9985, hash12(vec2(floor(uv.x * uRes.x / 2.), t))) * smoothstep(.5, .0, abs(fract(uv.y * 3. + hash12(vec2(t, 1.))) - .5));
    c = mix(c, vec3(step(.5, hash12(vec2(t, 3.)))), clamp(sp + hair * .7, 0., 1.) * .8);
  }
  c *= 1. - (hash12(vec2(t, 9.)) - .5) * p_flicker * .12;
  return vec4(clamp(c, 0., 1.), 1.);
}` });

/* ---- Frosted glass ---- */
FX.register({ id:'trt-glass', name:'Frosted glass', cat:'treatment', desc:'Looks at the frame through glass — frosted, rippled, ribbed, bubbled or cracked ice — with refraction and a bright edge.', search:['distort', 'texture'],
  params:[ S('kind','Glass',['Frosted','Rippled','Ribbed','Bubbled','Cracked ice'],0), R('scale','Scale',3,.3,16), R('refract','Refraction',.03,0,.2), R('blur','Frost',2.5,0,12), R('edge','Edge light',.5,0,3), R('angle','Angle',0,-180,180,1), I('speed','Loops per cycle',0,0,6), R('tint','Tint',.1,0,1), C('tintColor','Tint colour','#c9f5e4','accent2') ],
  fs:`float surf(vec2 uv){
  vec2 p = rot(radians(p_angle)) * centered(uv) * p_scale;
  float t = uLoop * TAU * float(int(p_speed));
  int k = int(p_kind + .5);
  if (k == 0) return fbm(p * 3. + t * .1);
  if (k == 1) return sin(p.x * 6. + sin(p.y * 4. + t) * 2.) * .5 + .5;
  if (k == 2) return fract(p.x * 2.) ;
  if (k == 3){ vec2 ip = floor(p * 1.5), fp = fract(p * 1.5) - .5; float d = 1.; for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){ vec2 g = vec2(i, j); d = min(d, length(fp - g - (hash22(ip + g) - .5) * .6) * 1.6); } return 1. - d; }
  vec2 ip = floor(p), fp = fract(p) - .5; float d1 = 8., d2 = 8.;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){ vec2 g = vec2(i, j); float dd = length(g + hash22(ip + g) - .5 - fp); if (dd < d1){ d2 = d1; d1 = dd; } else d2 = min(d2, dd); }
  return clamp(d2 - d1, 0., 1.);
}
vec4 fx(vec2 uv){
  float e = 1.5 / uRes.x;
  float s = surf(uv);
  float gx = surf(uv + vec2(e, 0.)) - surf(uv - vec2(e, 0.));
  float gy = surf(uv + vec2(0., e)) - surf(uv - vec2(0., e));
  vec2 n = vec2(gx, gy) * 40.;
  vec2 q = uv - n * p_refract * .02;
  vec3 col = vec3(0.); float ws = 0.;
  int steps = p_blur > .05 ? 12 : 1;
  for (int i = 0; i < 12; i++){
    if (i >= steps) break;
    float fi = float(i), rr = sqrt((fi + .5) / 12.) * p_blur, a = fi * 2.39996;
    float w = exp(-1.8 * rr * rr / max(p_blur * p_blur, 1e-3));
    col += texture(uInput, q + vec2(cos(a), sin(a)) * rr / uRes).rgb * w; ws += w;
  }
  col /= max(ws, 1e-4);
  float rim = clamp(length(n) * .5, 0., 1.);
  col += vec3(pow(clamp(dot(normalize(n + 1e-5), normalize(vec2(-.5, .8))), 0., 1.), 3.)) * p_edge * .5;
  col = mix(col, col * p_tintColor * 1.3, p_tint * clamp(s, 0., 1.));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Split tone ---- */
FX.register({ id:'trt-splittone', name:'Split tone', cat:'treatment', desc:'Colours the shadows, midtones and highlights separately — the quickest way to put a photo into your palette.',
  params:[ C('shadow','Shadows','#1c2b3a','ground'), C('mid','Midtones','#7a6a55', false), C('high','Highlights','#f6e9d8','ink'), R('shadowAmt','Shadow strength',.6,0,1.5), R('midAmt','Midtone strength',.25,0,1.5), R('highAmt','Highlight strength',.5,0,1.5),
    R('balance','Balance',0,-.5,.5), R('saturation','Keep colour',.35,0,1), R('contrast','Contrast',1.05,.2,2.5), R('exposure','Exposure',0,-.5,.5) ],
  fs:`vec4 fx(vec2 uv){
  vec3 src = texture(uInput, uv).rgb;
  vec3 c = (src - .5) * p_contrast + .5 + p_exposure;
  float l = clamp(luma(c) + p_balance, 0., 1.);
  float ws = pow(1. - l, 2.), wh = pow(l, 2.), wm = clamp(1. - ws - wh, 0., 1.);
  vec3 toned = vec3(l);
  toned = mix(toned, p_shadow, ws * p_shadowAmt);
  toned = mix(toned, p_mid, wm * p_midAmt);
  toned = mix(toned, p_high, wh * p_highAmt);
  vec3 outc = mix(toned, mix(toned, c, .85), p_saturation);
  return vec4(clamp(outc, 0., 1.), 1.);
}` });

/* ---- Attractor ---- */
FX.register({ id:'gen-attractor', name:'Attractor', cat:'generator', kind:'2d', desc:'A strange attractor traced out point by point — De Jong, Clifford, Lorenz or Hénon. Every seed is a different form.',
  params:[ S('kind','Attractor',['De Jong','Clifford','Lorenz','Hénon'],0), I('points','Points',60000,2000,300000), R('a','A',1.641,-3,3,.001), R('b','B',1.902,-3,3,.001), R('c','C',.316,-3,3,.001), R('d','D',1.525,-3,3,.001),
    R('zoom','Zoom',.32,.05,1.2), R('x','X',0,-1,1), R('y','Y',0,-1,1), R('rotate','Rotate',0,-180,180,1), I('speed','Drift loops',0,0,4), R('drift','Drift amount',.06,0,.5),
    R('opacity','Point opacity',.2,.01,1), R('size','Point size',1,.5,4), S('colour','Colour',['Ink','By speed','From palette'],0), T('draw','Draw on with timeline',false),
    C('ink','Ink','#e4e2dc','ink'), C('accent','Fast points','#ff5a36','accent'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const n = Math.max(2000, P.points | 0), mn = Math.min(w, h), kind = P.kind | 0;
    const drift = P.drift * Math.sin(api.loop * KT.TAU * (P.speed | 0));
    const a = P.a + drift, b = P.b + drift * .6, c = P.c, d = P.d;
    const cx = (.5 + P.x * .5) * w, cy = (.5 - P.y * .5) * h, s = mn * P.zoom;
    const rot = P.rotate * Math.PI / 180, cr = Math.cos(rot), sr = Math.sin(rot);
    const shown = P.draw ? Math.floor(n * Util.clamp(api.p)) : n;
    const mode = P.colour | 0, ps = P.size;
    ctx.globalAlpha = P.opacity; ctx.fillStyle = P.ink;
    let x = .1, y = 0, z = 0, px = 0, py = 0;
    for (let i = 0; i < shown; i++){
      let nx, ny;
      if (kind === 0){ nx = Math.sin(a * y) - Math.cos(b * x); ny = Math.sin(c * x) - Math.cos(d * y); }
      else if (kind === 1){ nx = Math.sin(a * y) + c * Math.cos(a * x); ny = Math.sin(b * x) + d * Math.cos(b * y); }
      else if (kind === 2){ const dt = .008, sg = 10 + a, rh = 28 + b * 2, be = 8 / 3; const dx = sg * (y - x), dy = x * (rh - z) - y, dz = x * y - be * z; nx = x + dx * dt; ny = y + dy * dt; z += dz * dt; }
      else { nx = 1 - a * x * x + y; ny = b * x; }
      px = x; py = y; x = nx; y = ny;
      if (!isFinite(x) || !isFinite(y)){ x = .1; y = 0; z = 0; continue; }
      if (i < 40) continue;
      const vx = kind === 2 ? x * .06 : x, vy = kind === 2 ? z * .06 - 1.2 : y;
      const sx = cx + (vx * cr - vy * sr) * s, sy = cy + (vx * sr + vy * cr) * s;
      if (sx < -10 || sy < -10 || sx > w + 10 || sy > h + 10) continue;
      if (mode === 1){ const v = Util.clamp(Math.hypot(x - px, y - py) * 1.4); ctx.fillStyle = v > .5 ? P.accent : P.ink; }
      else if (mode === 2 && (i & 1023) === 0) ctx.fillStyle = Brand.paletteColor(i >> 10, 3, P.ink);
      ctx.fillRect(sx, sy, ps, ps);
    }
    ctx.globalAlpha = 1;
  } });

/* ---- Branches ---- */
FX.register({ id:'gen-branches', name:'Branches', cat:'generator', kind:'2d', desc:'A recursive branching system — trees, lightning, coral or a root network — that grows in with the timeline.',
  params:[ I('depth','Depth',9,2,13), I('splits','Splits',2,1,4), R('angle','Branch angle',26,2,90,1), R('lengthFalloff','Length falloff',.76,.4,.98), R('thickness','Trunk weight',1.4,.1,6), R('start','Trunk length',.2,.05,.6),
    S('origin','Grows from',['Bottom','Centre','Top','Left','All sides'],0), I('count','Systems',1,1,12), R('spread','Spread',.5,0,1), R('wobble','Wobble',.35,0,2), R('curve','Curl',.2,0,1.5), I('speed','Sway loops',1,0,6), R('sway','Sway',.25,0,2),
    T('draw','Grow with timeline',true), T('leaves','Tips',false), R('leafSize','Tip size',1,.2,4), I('seed','Seed',7,1,99),
    C('ink','Branches','#e4e2dc','ink'), C('accent','Tips','#ff5a36','accent'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const mn = Math.min(w, h), depth = Math.max(2, P.depth | 0), splits = Math.max(1, P.splits | 0), seed = P.seed | 0;
    const grow = P.draw ? Util.clamp(api.p) : 1;
    const sway = Math.sin(api.loop * KT.TAU * (P.speed | 0)) * P.sway;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const tips = [];
    const branch = (x, y, ang, len, d, id) => {
      if (d > depth || len < 1) return;
      const local = Util.clamp((grow * depth - (d - 1)) );
      if (local <= 0) return;
      const curl = (KT.rnd(id, seed) - .5) * P.curve;
      const steps = 6;
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = Math.max(.4, mn * .004 * P.thickness * Math.pow(P.lengthFalloff, d - 1) * 1.5);
      ctx.beginPath(); ctx.moveTo(x, y);
      let cxp = x, cyp = y, a = ang;
      for (let i = 1; i <= steps; i++){
        const f = i / steps * local;
        a = ang + curl * f * 1.4 + sway * f * .25 * (d / depth);
        cxp = x + Math.cos(a) * len * f; cyp = y + Math.sin(a) * len * f;
        ctx.lineTo(cxp, cyp);
      }
      ctx.stroke();
      if (local < 1) return;
      if (d === depth){ tips.push([cxp, cyp, id]); return; }
      for (let k = 0; k < splits; k++){
        const spread = (k - (splits - 1) / 2) * (P.angle * Math.PI / 180) * (splits > 1 ? 2 / (splits - 1 || 1) : 1);
        const wob = (KT.rnd(id * 7 + k, seed) - .5) * P.wobble * .5;
        branch(cxp, cyp, a + spread + wob, len * P.lengthFalloff * (.85 + KT.rnd(id * 3 + k, seed) * .3), d + 1, id * 4 + k + 1);
      }
    };
    const n = Math.max(1, P.count | 0), org = P.origin | 0;
    for (let i = 0; i < n; i++){
      const t = n === 1 ? .5 : i / (n - 1);
      const off = (t - .5) * P.spread;
      let x, y, ang;
      if (org === 0){ x = w * (.5 + off); y = h * 1.02; ang = -Math.PI / 2; }
      else if (org === 1){ x = w / 2; y = h / 2; ang = -Math.PI / 2 + (i / n) * KT.TAU; }
      else if (org === 2){ x = w * (.5 + off); y = -h * .02; ang = Math.PI / 2; }
      else if (org === 3){ x = -w * .02; y = h * (.5 + off); ang = 0; }
      else { x = w / 2; y = h / 2; ang = (i / n) * KT.TAU; }
      branch(x, y, ang, mn * P.start, 1, i + 1);
    }
    if (P.leaves){
      ctx.fillStyle = P.accent;
      tips.forEach(([x, y, id]) => { const r = mn * .006 * P.leafSize * (.6 + KT.rnd(id, seed) * .8); ctx.beginPath(); ctx.arc(x, y, r, 0, KT.TAU); ctx.fill(); });
    }
  } });

/* ---- Wire terrain ---- */
FX.register({ id:'gen-terrain', name:'Wire terrain', cat:'generator', desc:'A wireframe landscape rolling towards you in perspective, with fog and a horizon. Loops seamlessly.',
  params:[ R('height','Height',.35,0,1.2), R('scale','Detail',3,.5,12), R('rows','Rows',60,10,160,1), R('cols','Columns',60,10,160,1), I('speed','Loops per cycle',1,0,6), R('horizon','Horizon',.45,.1,.9), R('camera','Camera height',.25,.02,1),
    R('line','Line weight',1,.2,4), S('style','Style',['Grid','Rows only','Columns only','Contour'],0), R('fog','Fog',.6,0,1), R('valley','Flat valley',.35,0,1),
    C('ink','Lines','#c9f5e4','accent2'), C('bg','Sky','#141516','ground'), C('accent','Peaks','#ff5a36','accent') ],
  fs:`float hgt(vec2 p){
  float v = fbm(p * p_scale);
  float d = abs(p.x);
  v *= mix(1., smoothstep(0., .55, d), p_valley);
  return v * p_height;
}
vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float horizon = p_horizon;
  vec3 sky = p_bg;
  if (uv.y > 1. - horizon) return vec4(sky, 1.);
  /* project the ground plane */
  float yy = (1. - horizon) - uv.y;
  float depth = p_camera / max(yy, 1e-4);
  if (depth > 60.) return vec4(sky, 1.);
  float wx = c.x * depth * 2.;
  /* scroll a whole number of grid cells per loop so the terrain repeats seamlessly */
  float cell = 1. / max(p_rows * .06, 1e-3);
  float wz = depth + uLoop * float(int(p_speed)) * cell;
  vec2 gp = vec2(wx, wz);
  float hh = hgt(gp);
  /* the height shifts the screen position, so sample the grid where it lands */
  float py = uv.y + hh * p_camera / max(depth, 1e-3);
  vec2 g = vec2(gp.x * p_cols * .08, gp.y * p_rows * .06);
  vec2 f = abs(fract(g) - .5);
  float lw = p_line * .5 * (.4 + depth * .06);
  float gx = 1. - smoothstep(0., fwidth(g.x) * lw * 3. + .002, f.x);
  float gy = 1. - smoothstep(0., fwidth(g.y) * lw * 3. + .002, f.y);
  int st = int(p_style + .5);
  float line = st == 0 ? max(gx, gy) : st == 1 ? gy : st == 2 ? gx : (1. - smoothstep(0., .06, abs(fract(hh * 12.) - .5)));
  vec3 col = mix(sky, mix(p_ink, p_accent, clamp(hh / max(p_height, 1e-3), 0., 1.)), line);
  float fog = 1. - exp(-depth * .12 * p_fog);
  col = mix(col, sky, clamp(fog, 0., 1.));
  /* keep the terrain under the horizon */
  col = mix(col, sky, smoothstep(0., .02, py - 1.));
  return vec4(col, 1.);
}` });

/* ---- Column ---- */
FX.register({ id:'kt-column', name:'Column', cat:'type', kind:'2d', desc:'Type stacked in vertical columns, scrolling or revealing letter by letter — like a banner or a spine.',
  params:[ ...KT.typeParams('VERTICAL'), I('columns','Columns',1,1,8), R('size','Size',9,2,28,.1), R('leading','Letter spacing',1.05,.6,2.5), R('margin','Margin',.1,0,.4), S('mode','Motion',['Reveal with timeline','Scroll','Still'],0), I('speed','Loops per cycle',1,-6,6),
    S('align','Columns',['Centred','Spread','From left'],0), T('rotate','Rotate letters',false), R('stagger','Stagger',.4,0,1), S('easing','Easing',KT.EASES,4), T('rule','Rules between columns',false),
    C('ink','Ink','#e4e2dc','ink'), C('accent','Alternate columns','#ff5a36','accent'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P).replace(/\n/g, ' '); if (!text.trim()) return;
    const cols = Math.max(1, P.columns | 0), mn = Math.min(w, h), size = P.size / 100 * mn, mg = P.margin * w;
    ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size);
    const step = size * P.leading, chars = [...text];
    const E = KT.easeBy(P.easing), mode = P.mode | 0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let c = 0; c < cols; c++){
      const x = (P.align | 0) === 0 ? w / 2 + (c - (cols - 1) / 2) * size * 1.6
        : (P.align | 0) === 1 ? mg + (w - mg * 2) * (cols === 1 ? .5 : c / (cols - 1))
        : mg + c * size * 1.6;
      if (P.rule && c > 0){ ctx.strokeStyle = P.ink; ctx.globalAlpha = .18; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - size * .8, mg); ctx.lineTo(x - size * .8, h - mg); ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.fillStyle = c % 2 ? P.accent : P.ink;
      const total = chars.length * step;
      const scroll = mode === 1 ? ((api.loop * (P.speed | 0) + c * .12) % 1 + 1) % 1 * total : 0;
      const top = mode === 1 ? -step : h / 2 - total / 2 + step / 2;
      chars.forEach((ch, i) => {
        if (/\s/.test(ch)) return;
        let y;
        if (mode === 1){ y = ((top + i * step + scroll) % (total + step) + total + step) % (total + step) - step; }
        else y = top + i * step;
        if (y < -step || y > h + step) return;
        let alpha = 1, dy = 0;
        if (mode === 0){ const lp = KT.stagger(api.p, i + c * 2, chars.length + cols * 2, P.stagger); if (lp <= 0) return; const e = E(lp); alpha = Util.clamp(lp * 3); dy = (1 - e) * step * .8; }
        ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y + dy);
        if (P.rotate) ctx.rotate(Math.PI / 2);
        ctx.fillText(ch, 0, M.cap * .04);
        ctx.restore();
      });
    }
    ctx.globalAlpha = 1;
  } });

/* ---- Focus pull ---- */
FX.register({ id:'kt-defocus', name:'Focus pull', cat:'type', desc:'Type that comes into focus, letter by letter or all at once, with a shallow depth of field and a bloom.',
  params:[ ...KT.typeParams('IN FOCUS'), R('margin','Margin',.1,0,.4), R('tracking','Tracking',-.01,-.2,.5), R('leading','Leading',.92,.6,2), R('blur','Blur',14,0,60), S('drive','Motion',['Focus in','Focus out','Breathe'],0), R('stagger','Stagger',.4,0,1), R('bloom','Bloom',.5,0,2), R('chroma','Colour fringe',.3,0,2),
    S('fill','Fill',['Ink','Image B','Image A'],0), C('ink','Ink','#e4e2dc','ink'), ...KT.groundParams(1) ],
  auxSize(P, w, h){ const s = Math.min(1, Math.max(1800, Engine.auxCap) / Math.max(w, h)); return [Math.round(w * s), Math.round(h * s)]; },
  aux(ctx, P, w, h){
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const text = KT.text(P); if (!text.trim()) return;
    const mg = P.margin * w, size = KT.fit(ctx, P, text, w - mg * 2, h - mg * 2, P.leading, P.tracking);
    const font = KT.font(P, size); ctx.font = font;
    const L = KT.layout(ctx, text, { font, size, tracking:P.tracking }), M = KT.metrics(ctx, size);
    const pos = KT.place(L, { size, leading:P.leading, cap:M.cap, align:1, x:w / 2, y:h / 2 });
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    /* red channel: the letters. green channel: a left-to-right ramp, so the shader can stagger them */
    L.lines.forEach((ln, i) => ln.glyphs.forEach(g => {
      const t = Util.clamp((pos[i].x + g.x) / w);
      ctx.fillStyle = `rgb(255,${Math.round(t * 255)},0)`;
      ctx.fillText(g.ch, pos[i].x + g.x, pos[i].y);
    }));
  },
  fs:`vec4 fx(vec2 uv){
  vec3 base = mix(texture(uInput, uv).rgb, p_bg, p_ground < .5 ? 0. : p_bg_a);
  float p = p_drive < .5 ? uProgress : p_drive < 1.5 ? 1. - uProgress : .5 + .5 * sin(uLoop * TAU);
  vec3 acc = vec3(0.); float ws = 0.;
  for (int i = 0; i < 24; i++){
    float fi = float(i);
    float rr = sqrt((fi + .5) / 24.);
    float a = fi * 2.39996;
    vec2 dir = vec2(cos(a), sin(a));
    /* sample the mask, working out this letter's own focus from the green ramp */
    vec2 o = dir * rr * p_blur / uRes;
    vec4 s = texture(uAux, uv + o);
    float local = clamp((p * (1. + p_stagger) - s.g * p_stagger) / max(1. - 0., 1e-3), 0., 1.);
    float radius = (1. - local) * p_blur;
    vec4 s2 = texture(uAux, uv + dir * rr * radius / uRes);
    float w = exp(-2. * rr * rr);
    acc += vec3(s2.r) * w; ws += w;
  }
  float m = acc.r / max(ws, 1e-4);
  float sharp = texture(uAux, uv).r;
  float fringe = p_chroma * .004 * (1. - p);
  float mr = texture(uAux, uv + vec2(fringe, 0.)).r, mb = texture(uAux, uv - vec2(fringe, 0.)).r;
  vec3 ink = p_fill < .5 ? p_ink : p_fill < 1.5 ? texture(uB, uv).rgb : texture(uA, uv).rgb;
  vec3 col = base;
  vec3 mask = vec3(mix(m, mr, .5), m, mix(m, mb, .5));
  col = mix(col, ink, mask);
  col += ink * m * p_bloom * .25 * (1. - p);
  col = mix(col, ink, sharp * p * p);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Type glitch ---- */
FX.register({ id:'kt-glitch', name:'Type glitch', cat:'type', desc:'Type torn into slices that jump, tear and separate into colour channels on the beat.',
  params:[ ...KT.typeParams('BROKEN'), R('margin','Margin',.1,0,.4), R('tracking','Tracking',0,-.2,.5), R('leading','Leading',.92,.6,2), I('beats','Beats per loop (0 = brand)',0,0,32), R('burst','Burst length',.35,.05,1), I('slices','Slices',14,2,60), R('shift','Slice shift',.06,0,.4),
    R('chroma','Colour split',.5,0,3), R('tear','Tear',.4,0,1), R('noise','Noise',.2,0,1), T('ghost','Ghost copies',true),
    C('ink','Ink','#e4e2dc','ink'), C('accent','Glitch colour','#ff5a36','accent'), ...KT.groundParams(1) ],
  auxSize(P, w, h){ const s = Math.min(1, Math.max(1800, Engine.auxCap) / Math.max(w, h)); return [Math.round(w * s), Math.round(h * s)]; },
  aux(ctx, P, w, h){
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const text = KT.text(P); if (!text.trim()) return;
    const mg = P.margin * w, size = KT.fit(ctx, P, text, w - mg * 2, h - mg * 2, P.leading, P.tracking);
    const font = KT.font(P, size); ctx.font = font;
    const L = KT.layout(ctx, text, { font, size, tracking:P.tracking }), M = KT.metrics(ctx, size);
    const pos = KT.place(L, { size, leading:P.leading, cap:M.cap, align:1, x:w / 2, y:h / 2 });
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    L.lines.forEach((ln, i) => ln.glyphs.forEach(g => ctx.fillText(g.ch, pos[i].x + g.x, pos[i].y)));
  },
  fs:`float maskAt(vec2 uv){ if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) return 0.; return texture(uAux, uv).r; }
vec4 fx(vec2 uv){
  vec3 base = mix(texture(uInput, uv).rgb, p_bg, p_ground < .5 ? 0. : p_bg_a);
  float beats = p_beats < .5 ? 4. : p_beats;
  float f = uLoop * beats, idx = floor(f), lt = fract(f);
  float burst = smoothstep(p_burst, 0., lt);
  float slice = floor(uv.y * p_slices);
  float r = hash12(vec2(slice, idx));
  float jump = (r - .5) * 2. * p_shift * burst;
  float tear = step(.75, hash12(vec2(slice + 3., idx * 1.7))) * p_tear * burst * .12;
  vec2 q = uv + vec2(jump + tear, 0.);
  float ch = p_chroma * .012 * burst;
  float mr = maskAt(q + vec2(ch, 0.)), mg2 = maskAt(q), mb = maskAt(q - vec2(ch, 0.));
  vec3 col = base;
  col = mix(col, p_ink * vec3(1., .2, .2) + p_accent * vec3(.6, 0., 0.), mr * .55);
  col = mix(col, p_ink, mg2);
  col = mix(col, mix(p_ink, p_accent, .7), mb * .45 * clamp(p_chroma, 0., 1.));
  if (p_ghost > .5 && burst > .01){
    float g1 = maskAt(uv + vec2(.02, .01) * burst), g2 = maskAt(uv - vec2(.03, .008) * burst);
    col = mix(col, p_accent, max(g1, g2) * .22 * burst);
  }
  if (p_noise > .001){
    float n = hash12(uv * uRes + floor(uTime * 30.));
    col += (n - .5) * p_noise * burst * .5 * step(.4, mg2 + burst * .3);
  }
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Frame ---- */
FX.register({ id:'ovl-frame', name:'Frame', cat:'overlay', desc:'A border with corner marks and an optional caption strip — a clean way to hold a photo or a loop.',
  params:[ R('inset','Inset',.06,0,.3), R('width','Line weight',2,0,12), S('style','Style',['Line','Double line','Corners only','Filled edge','Ticks'],0), R('corner','Corner length',.06,0,.4), R('radius','Corner radius',0,0,.1),
    R('gap','Double gap',.012,.002,.06), I('ticks','Tick count',24,4,80), R('tickLen','Tick length',.012,.002,.06), R('fade','Edge fade',0,0,1), C('color','Colour','#e4e2dc','ink'), R('opacity','Opacity',1,0,1) ],
  fs:`float box(vec2 p, vec2 b, float r){ vec2 d = abs(p) - b + r; return min(max(d.x, d.y), 0.) + length(max(d, 0.)) - r; }
vec4 fx(vec2 uv){
  vec3 col = texture(uInput, uv).rgb;
  vec2 c = centered(uv);
  vec2 b = vec2(aspect(), 1.) * .5 - p_inset;
  float r = p_radius;
  float lw = max(p_width, .001) / uRes.y;
  float d = box(c, b, r);
  float aa = fwidth(d) + .0005;
  float line = 1. - smoothstep(lw, lw + aa, abs(d));
  int st = int(p_style + .5);
  float m = line;
  if (st == 1){ float d2 = box(c, b - p_gap, max(r - p_gap, 0.)); m = max(line, 1. - smoothstep(lw, lw + aa, abs(d2))); }
  else if (st == 2){
    vec2 q = abs(c);
    float nearCorner = step(b.x - p_corner, q.x) * step(b.y - p_corner, q.y);
    float armX = step(b.x - p_corner, q.x) * step(b.y - lw * 2. - aa, q.y);
    float armY = step(b.y - p_corner, q.y) * step(b.x - lw * 2. - aa, q.x);
    m = line * clamp(nearCorner + armX + armY, 0., 1.);
  }
  else if (st == 3){ m = 1. - smoothstep(0., aa, d); m = m * step(0., d + p_corner * .25) ; m = max(line, 1. - smoothstep(-p_corner * .12, -p_corner * .12 + aa, d)); }
  else if (st == 4){
    float perim = 0.;
    vec2 q = abs(c);
    float tx = abs(fract(uv.x * p_ticks) - .5) * 2.;
    float ty = abs(fract(uv.y * p_ticks) - .5) * 2.;
    float onX = step(b.y - lw - p_tickLen, q.y) * step(q.y, b.y + lw) * (1. - smoothstep(.75, .95, tx));
    float onY = step(b.x - lw - p_tickLen, q.x) * step(q.x, b.x + lw) * (1. - smoothstep(.75, .95, ty));
    perim = clamp(onX + onY, 0., 1.);
    m = max(line, perim);
  }
  if (p_fade > .001){
    float f = smoothstep(0., p_fade * .4, -d);
    col = mix(mix(col, backdrop(uv), 1. - f), col, f);
  }
  return vec4(mix(col, p_color, m * p_opacity), 1.);
}` });

/* ---- Edge fade ---- */
FX.register({ id:'ovl-edge', name:'Edge fade', cat:'overlay', desc:'Fades or masks the frame into a shape — rectangle, circle, arch, blob or torn edge — over the backdrop or a colour.',
  params:[ S('shape','Shape',['Rectangle','Circle','Arch','Blob','Torn'],1), R('size','Size',.8,.1,1.4), R('soft','Softness',.12,0,.8), R('radius','Corner radius',.08,0,.5), R('ratio','Shape ratio',1,.3,3), R('x','X',0,-1,1), R('y','Y',0,-1,1), R('rough','Roughness',.35,0,1.5), I('speed','Loops per cycle',0,0,6),
    S('fill','Outside',['Backdrop','Colour','Darken','Blur'],0), C('color','Colour','#141516','ground'), R('blur','Blur amount',8,1,40), T('invert','Invert',false) ],
  fs:`vec4 fx(vec2 uv){
  vec3 col = texture(uInput, uv).rgb;
  vec2 c = centered(uv) - vec2(p_x * .5 * aspect(), -p_y * .5);
  c.x /= max(p_ratio, .05);
  float t = uLoop * TAU * float(int(p_speed));
  int sh = int(p_shape + .5);
  float d;
  if (sh == 0){ vec2 b = vec2(aspect(), 1.) * .5 * p_size; vec2 q = abs(c) - b + p_radius; d = min(max(q.x, q.y), 0.) + length(max(q, 0.)) - p_radius; }
  else if (sh == 1) d = length(c) - p_size * .5;
  else { float rr = p_size * .5;
    if (sh == 2){ vec2 q = c; q.y += rr * .35; float body = max(length(vec2(q.x, min(q.y, 0.))) - rr, q.y - rr * .9); d = body; }
    else if (sh == 3){ float a = atan(c.y, c.x); float wob = 1. + (fbm(vec2(cos(a), sin(a)) * 2. + t * .1) - .5) * p_rough * 1.2; d = length(c) - rr * wob; }
    else { float a = atan(c.y, c.x); float wob = 1. + (fract(sin(a * 9. + t) * 43.) - .5) * p_rough * .5 + (fbm(vec2(a * 3., t * .2)) - .5) * p_rough; d = length(c) - rr * wob; }
  }
  float m = 1. - smoothstep(0., max(p_soft * .5, .0015), d);
  if (p_invert > .5) m = 1. - m;
  vec3 outside;
  int fm = int(p_fill + .5);
  if (fm == 0) outside = backdrop(uv);
  else if (fm == 1) outside = p_color;
  else if (fm == 2) outside = col * .25;
  else {
    vec3 acc = vec3(0.); float ws = 0.;
    for (int i = 0; i < 12; i++){ float fi = float(i), rr = sqrt((fi + .5) / 12.) * p_blur, a = fi * 2.39996;
      float w = exp(-1.6 * rr * rr / max(p_blur * p_blur, 1e-3));
      acc += texture(uInput, uv + vec2(cos(a), sin(a)) * rr / uRes).rgb * w; ws += w; }
    outside = acc / max(ws, 1e-4);
  }
  return vec4(mix(outside, col, m), 1.);
}` });
