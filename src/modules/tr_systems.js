/* ---------------- Transitions: systems ----------------
   Original A-to-B transitions built on data, nature, time and design systems.
   Each is a pure function of uv and uProgress; small fixed loops only. */

/* ---- Data and computation ---- */

FX.register({ id:'tr-contour-terraces', name:'Contour terraces', cat:'transition', nonLocal:true,
  search:['topographic', 'contour', 'map', 'isoline', 'elevation', 'cartographic', 'hypsometric'],
  desc:'A is drawn as a contour map of its own tones, then every band fills with B at once, like terraces flooding.',
  params:[ I('count','Contours',12,4,40), R('weight','Line weight (px)',1.4,.5,4), C('line','Line colour','#141516','ground'), R('tint','Band shading',.22,0,.5), R('blur','Smoothing (px)',4,0,10) ],
  fs:`float ctr_l(vec2 uv, vec2 o){ return luma(texture(uA, uv + o).rgb); }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 r = vec2(p_blur) / uRes, r2 = r * .7071;
  float L = ctr_l(uv, vec2(0.)) * 2.
    + ctr_l(uv, vec2(r.x, 0.)) + ctr_l(uv, vec2(-r.x, 0.)) + ctr_l(uv, vec2(0., r.y)) + ctr_l(uv, vec2(0., -r.y))
    + ctr_l(uv, r2) + ctr_l(uv, -r2) + ctr_l(uv, vec2(r2.x, -r2.y)) + ctr_l(uv, vec2(-r2.x, r2.y));
  L /= 10.;
  float h = L * p_count, f = fract(h), band = floor(h);
  float fw = max(fwidth(h), 1e-4);
  float on = smoothstep(0., .22, p) * (1. - smoothstep(.8, 1., p));
  float wpx = max(p_weight / max(uPx, 1e-3), .8);
  float line = 1. - smoothstep(wpx * .5 - .5, wpx * .5 + .5, min(f, 1. - f) / fw);
  float q = clamp((p - .25) / .7, 0., 1.) * 1.06;
  float fill = clamp((q - f) / fw + .5, 0., 1.);
  fill = max(fill * step(1e-4, q), smoothstep(.96, 1., p));
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec3 col = mix(a, b, fill);
  col *= 1. - p_tint * mod(band, 2.) * on;
  col = mix(col, p_line, line * on * .92);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-hilbert-path', name:'Hilbert path', cat:'transition',
  search:['space filling', 'curve', 'snake', 'maze', 'path', 'grid', 'generative'],
  desc:'B is laid in along one unbroken space-filling curve that snakes through the whole frame without crossing itself.',
  params:[ I('order','Order',5,3,7), R('head','Head length',.06,.005,.25), R('round','Cell rounding',.6,0,1), T('path','Draw the path',true), R('trail','Path trail',.15,.01,1), R('weight','Path weight (px)',2,.5,6), C('color','Path colour','#ff5a36','accent') ],
  fs:`int hil_d(ivec2 q, int n){
  int d = 0, s = n / 2;
  for (int i = 0; i < 8; i++){
    if (s < 1) break;
    q = q & ivec2(2 * s - 1);
    int rx = (q.x & s) > 0 ? 1 : 0, ry = (q.y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry == 0){ if (rx == 1) q = ivec2(2 * s - 1) - q; q = q.yx; }
    s /= 2;
  }
  return d;
}
float hil_seg(vec2 p, vec2 b){ float h = clamp(dot(p, b) / dot(b, b), 0., 1.); return length(p - b * h); }
vec4 fx(vec2 uv){
  float p = uProgress;
  int n = 1 << int(clamp(p_order, 3., 7.) + .5);
  float N = float(n);
  float side = max(aspect(), 1.);
  vec2 g = (centered(uv) / side + .5) * N;
  ivec2 cell = clamp(ivec2(floor(g)), ivec2(0), ivec2(n - 1));
  vec2 lc = g - vec2(cell) - .5;
  int d = hil_d(cell, n);
  float total = N * N;
  float H = max(p_head, .002);
  float head = p * (1. + H);
  float loc = clamp((head - float(d) / total) / H, 0., 1.);
  float e = loc * loc * (3. - 2. * loc);
  float hb = .5 * e + .02 * e;
  float box = sdRoundBox(lc, vec2(hb), .5 * (1. - e) * p_round * hb * 2.);
  float aa = 1.5 / (uRes.y / N * max(1. / max(uPx, 1e-3), .2));
  float inB = 1. - smoothstep(-aa, aa, box);
  inB = loc <= 0. ? 0. : max(inB, step(.999, loc));
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, inB);
  if (p_path > .5 && loc > 0.){
    float dm = 1e3, trail = 0.;
    ivec2 dirs[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
    for (int k = 0; k < 4; k++){
      ivec2 nb = cell + dirs[k];
      if (nb.x < 0 || nb.y < 0 || nb.x >= n || nb.y >= n) continue;
      int d2 = hil_d(nb, n);
      if (abs(d2 - d) != 1) continue;
      float t2 = float(d2) / total;
      if (d2 > d && head - t2 < 0.) continue;
      dm = min(dm, hil_seg(lc, vec2(dirs[k]) * .5));
    }
    trail = 1. - smoothstep(0., p_trail, head - H - float(d) / total);
    dm = min(dm, length(lc) + (loc < 1. && d > 0 ? 0. : 1e3));
    float wv = max(p_weight, uPx) / uRes.y * N * side * .5;
    float px1 = uPx / uRes.y * N * side;
    float ln = 1. - smoothstep(wv - px1 * .5, wv + px1 * .5, dm);
    col = mix(col, p_color, ln * trail * (1. - smoothstep(.9, 1., p)));
  }
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-quadtree', name:'Quadtree', cat:'transition', nonLocal:true,
  search:['subdivide', 'blocks', 'compression', 'mosaic', 'adaptive', 'content aware', 'pixelate'],
  desc:'A breaks down into big flat blocks wherever there is little detail, then B refines back in square by square.',
  params:[ I('depth','Finest level',7,4,8), R('sens','Detail sensitivity',.5,0,1), R('border','Border opacity',.35,0,1), C('bcolor','Border colour','#e4e2dc','ink'), S('leaf','Block colour',['Average','Centre'],0) ],
  fs:`vec3 qt_tex(int w, vec2 uv){ return w == 0 ? texture(uA, uv).rgb : texture(uB, uv).rgb; }
vec4 fx(vec2 uv){
  float p = uProgress;
  float ph = p < .5 ? smoothstep(0., .44, p) : 1. - smoothstep(.56, 1., p);
  float swap = smoothstep(.45, .55, p);
  int w = p < .5 ? 0 : 1;
  float T = ph >= .999 ? 1e6 : ph * ph * ph / (1. - ph) * mix(.003, .0003, p_sens);
  int maxL = int(clamp(p_depth, 4., 8.) + .5);
  float ar = aspect();
  vec2 c = centered(uv);
  vec3 raw = qt_tex(w, uv);
  vec3 col = raw; float edge = 1e3, cs = 0.; bool coarse = false;
  for (int k = 2; k <= 8; k++){
    float s = 1. / exp2(float(k));
    vec2 o = floor(c / s) * s;
    vec2 fc = (c - o) / s;
    if (k >= maxL){ break; }
    vec2 u0 = uncentered(o + s * vec2(.25, .25)), u1 = uncentered(o + s * vec2(.75, .25));
    vec2 u2 = uncentered(o + s * vec2(.25, .75)), u3 = uncentered(o + s * vec2(.75, .75));
    vec3 t0 = qt_tex(w, u0), t1 = qt_tex(w, u1), t2 = qt_tex(w, u2), t3 = qt_tex(w, u3);
    float l0 = luma(t0), l1 = luma(t1), l2 = luma(t2), l3 = luma(t3);
    float m = (l0 + l1 + l2 + l3) * .25;
    float v = ((l0 - m) * (l0 - m) + (l1 - m) * (l1 - m) + (l2 - m) * (l2 - m) + (l3 - m) * (l3 - m)) * .25;
    if (v <= T || k == 2 && T > 1e5){
      vec3 avg = p_leaf > .5 ? qt_tex(w, uncentered(o + s * .5)) : (t0 + t1 + t2 + t3) * .25;
      if (swap > 0. && swap < 1.){
        int w2 = 1 - w;
        vec3 o2 = p_leaf > .5 ? qt_tex(w2, uncentered(o + s * .5)) : (qt_tex(w2, u0) + qt_tex(w2, u1) + qt_tex(w2, u2) + qt_tex(w2, u3)) * .25;
        avg = w == 0 ? mix(avg, o2, swap) : mix(o2, avg, swap);
      }
      col = avg; coarse = true; cs = s;
      edge = min(min(fc.x, 1. - fc.x), min(fc.y, 1. - fc.y)) * s;
      break;
    }
  }
  if (coarse){
    float px = max(uPx, 1.) / uRes.y;
    float bl = 1. - smoothstep(px * .5, px * 1.5, edge);
    col = mix(col, p_bcolor, bl * p_border * smoothstep(0., .15, ph) * smoothstep(.015, .07, cs));
  }
  float keep = smoothstep(0., .04, p) * (1. - smoothstep(.96, 1., p));
  vec3 ends = p < .5 ? texture(uA, uv).rgb : texture(uB, uv).rgb;
  return vec4(mix(ends, col, keep), 1.);
}` });

FX.register({ id:'tr-rule-ninety', name:'Rule 90 bloom', cat:'transition',
  search:['cellular automaton', 'sierpinski', 'fractal', 'pascal', 'generative', 'pixel', 'triangle'],
  desc:'B grows down the frame as a Sierpinski triangle of cells, generation by generation, then the gaps fill in.',
  params:[ R('cell','Cell size (px)',9,3,30), R('seed','Seed position',.5,0,1), S('origin','Grows from',['Top','Centre, both ways'],0), R('delay','Fill delay',.3,.05,.6), R('glow','Newborn glow',.6,0,1), C('color','Glow colour','#ff5a36','accent') ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 g = uv * uRes / max(p_cell, 1.);
  vec2 dims = ceil(uRes / max(p_cell, 1.));
  int cx = int(floor(g.x)), x0 = int(floor(p_seed * (dims.x - 1.) + .5));
  float rowF = floor((1. - uv.y) * uRes.y / max(p_cell, 1.));
  float rows = dims.y;
  if (p_origin > .5){ float mid = floor(rows * .5); rowF = abs(rowF - mid); rows = mid + 1.; }
  int t = int(rowF), x = cx - x0;
  bool alive = false;
  if (abs(x) <= t && ((t + x) & 1) == 0){ int a = (t + x) / 2, b = (t - x) / 2; alive = (a & b) == 0; }
  float span = 1. - p_delay;
  float gen = rowF / rows;
  float tb = gen * span * .96;
  float j = hash12(floor(g) + 3.1);
  float wide = abs(float(x)) / max(dims.x, 1.);
  float td = p_delay + (gen * .72 + wide * .22 + j * .03) * span * .97;
  float on = (alive ? step(tb, p) : step(td, p)) * step(1e-4, p);
  float age = (p - tb) / max(span, .05) * rows;
  float glow = alive ? (1. - smoothstep(0., 6., age)) * on : 0.;
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, on);
  col = mix(col, p_color, glow * p_glow * .75 * (1. - smoothstep(.85, 1., p)));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-sketch-wash', name:'Line drawing and wash', cat:'transition',
  search:['watercolour', 'sketch', 'pen', 'drawing', 'illustration', 'paper', 'ink'],
  desc:'A fades to paper, B is sketched in as pen lines, then a watercolour wash floods colour into it.',
  params:[ R('thresh','Line threshold',.12,.04,.6), C('ink','Line colour','#2b2b2b',false), C('paper','Paper','#f1ece2',false), R('pool','Wash edge darkening',.22,0,.5), R('grain','Granulation',.15,0,.4), R('ox','Start X',.2,0,1), R('oy','Start Y',.7,0,1) ],
  fs:`float sw_l(vec2 uv){ return luma(texture(uB, uv).rgb); }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 px = 1.5 / uRes;
  float tl = sw_l(uv + vec2(-px.x, px.y)), tc = sw_l(uv + vec2(0., px.y)), tr = sw_l(uv + px);
  float ml = sw_l(uv - vec2(px.x, 0.)), mr = sw_l(uv + vec2(px.x, 0.));
  float bl = sw_l(uv - px), bc = sw_l(uv - vec2(0., px.y)), br = sw_l(uv + vec2(px.x, -px.y));
  float gx = (tr + 2. * mr + br) - (tl + 2. * ml + bl), gy = (tl + 2. * tc + tr) - (bl + 2. * bc + br);
  float e = length(vec2(gx, gy));
  float ink = smoothstep(p_thresh, p_thresh * 1.8, e);
  vec2 c = centered(uv), o = centered(vec2(p_ox, p_oy));
  float d = length(c - o) + .2 * fbm(uv * 3.);
  float pen = smoothstep(-.03, .03, smoothstep(.06, .62, p) * 1.7 - d);
  float p2 = clamp((p - .32) / .68, 0., 1.);
  float wf = p2 * 1.9 - d - .3 * fbm(uv * 4. + 5.) + .02;
  float wash = smoothstep(-.04, .04, wf);
  float rim = exp(-abs(wf) * 28.) * smoothstep(0., .04, wf + .04);
  float fin = 1. - smoothstep(.84, 1., p);
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec3 paper = p_paper * (1. - .04 * fbm(uv * 40.) * fin);
  vec3 col = mix(a, paper, smoothstep(0., .3, p));
  float gran = 1. - p_grain * (vnoise(uv * uRes / 7.) * .7 + vnoise(uv * uRes / 2.) * .3) * fin;
  vec3 wc = mix(b, mix(paper, b, .8), fin * .7) * gran * (1. - p_pool * rim * fin);
  col = mix(col, wc, wash);
  col = mix(col, p_ink, ink * pen * fin * (1. - wash * .45));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-posterise-relay', name:'Posterise relay', cat:'transition',
  search:['posterize', 'levels', 'bit depth', 'reduce', 'graphic', 'two tone', 'stepped'],
  desc:'A drops colour levels step by step down to a few tones, cuts to B at its starkest, then B builds back up to full colour.',
  params:[ I('min','Fewest levels',3,2,8), S('mode','Mode',['Tones','Channels','Two colours'],0), I('steps','Stepped time',12,0,30), C('dark','Shadow colour','#141516','ground'), C('light','Highlight colour','#ff5a36','accent') ],
  fs:`vec3 pr_q(vec3 c, float n){ return floor(c * (n - 1.) + .5) / (n - 1.); }
vec4 fx(vec2 uv){
  float p = uProgress;
  if (p_steps > .5) p = floor(p * p_steps + .5) / p_steps;
  bool isA = p < .5;
  float e = isA ? p * 2. : (1. - p) * 2.;
  e = e * e * (3. - 2. * e);
  vec3 src = isA ? texture(uA, uv).rgb : texture(uB, uv).rgb;
  if (e <= 0.) return vec4(src, 1.);
  float n = floor(exp2(mix(8., log2(max(p_min, 2.)), e)) + .5);
  vec3 col;
  int md = int(p_mode + .5);
  if (md == 0){ float l = max(luma(src), .02); col = clamp(src * pr_q(vec3(l), n).x / l, 0., 1.); col = mix(col, pr_q(col, n + 1.), .5); }
  else if (md == 1) col = pr_q(src, n);
  else {
    float l = pr_q(vec3(luma(src)), n).x;
    vec3 duo = mix(p_dark, p_light, l);
    col = mix(pr_q(src, n), duo, smoothstep(0., .5, e));
  }
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-duotone-bridge', name:'Duotone bridge', cat:'transition',
  search:['duotone', 'two colour', 'brand colours', 'tritone', 'monotone', 'palette'],
  desc:'Both images pass through two brand colours, so the cut happens in duotone and colour returns on B.',
  params:[ C('dark','Shadow colour','#141516','ground'), C('light','Highlight colour','#ff5a36','accent'), T('tri','Add a mid colour'), C('mid','Mid colour','#c9f5e4','accent2'), R('hold','Hold length',.4,0,.8), S('swap','Swap',['By tone','Crossfade'],0) ],
  fs:`vec3 db_duo(vec3 c){
  float l = smoothstep(.04, .94, luma(c));
  if (p_tri > .5) return l < .5 ? mix(p_dark, p_mid, l * 2.) : mix(p_mid, p_light, l * 2. - 1.);
  return mix(p_dark, p_light, l);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float edge = (1. - p_hold) * .5;
  float inA = smoothstep(0., max(edge, .01), p);
  float outB = 1. - smoothstep(1. - max(edge, .01), 1., p);
  float local = clamp((p - edge * .6) / max(1. - edge * 1.2, .05), 0., 1.);
  float m;
  if (p_swap < .5){ float lb = luma(b); m = smoothstep(lb - .18, lb + .18, local * 1.36 - .18); }
  else m = smoothstep(0., 1., local);
  vec3 da = mix(a, db_duo(a), inA), dbb = mix(b, db_duo(b), outB);
  if (p >= 1.) m = 1.;
  return vec4(mix(da, dbb, m), 1.);
}` });

FX.register({ id:'tr-pinscreen', name:'Pinscreen', cat:'transition', nonLocal:true,
  search:['alexeieff', 'pins', 'shadow', 'relief', 'animation', 'tactile', 'monochrome'],
  desc:'Thousands of pins push in and out, casting shadows that draw A, then B, like an old pinscreen.',
  params:[ R('spacing','Pin spacing (px)',12,4,24), R('angle','Light angle',35,0,360,1), R('len','Shadow length',1.6,.5,3), R('ret','Colour return',.8,.6,.95), C('light','Board','#ece8df',false), C('shade','Shadow','#141516','ground') ],
  fs:`float ps_seg(vec2 p, vec2 b){ float h = clamp(dot(p, b) / max(dot(b, b), 1e-6), 0., 1.); return length(p - b * h); }
vec4 fx(vec2 uv){
  float p = uProgress;
  float s = max(p_spacing, 2.);
  vec2 g = uv * uRes / s;
  vec2 cell = floor(g);
  vec2 ld = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  vec2 sd = -ld;
  vec2 st = vec2(sd.x >= 0. ? 1. : -1., sd.y >= 0. ? 1. : -1.);
  float wave = p * 1.5 - .25;
  float shadow = 0., head = 0.;
  for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++){
    vec2 cc = cell - st * vec2(float(i), float(j));
    vec2 cu = (cc + .5) * s / uRes;
    float diag = dot(cu - .5, normalize(vec2(1., -1.))) * .7 + .5;
    float k = smoothstep(diag - .12, diag + .12, wave);
    float la = luma(texture(uA, cu).rgb), lb = luma(texture(uB, cu).rgb);
    float h = smoothstep(.08, .92, 1. - mix(la, lb, k));
    vec2 rp = g - (cc + .5);
    float L = h * p_len;
    float dd = ps_seg(rp, sd * L);
    float r = .06 + .26 * h;
    shadow = max(shadow, (1. - smoothstep(r - .07, r + .07, dd)) * smoothstep(0., .25, h));
    if (i == 0 && j == 0) head = 1. - smoothstep(.12, .2, length(rp + ld * .04));
  }
  vec3 mono = mix(p_light, p_shade, shadow * .92);
  mono = mix(mono, p_light * 1.05, head * .7);
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec3 col = mix(a, mono, smoothstep(0., .2, p));
  col = mix(col, b, smoothstep(p_ret, 1., p));
  return vec4(col, 1.);
}` });

/* ---- Nature ---- */

FX.register({ id:'tr-frost-thaw', name:'Frost and thaw', cat:'transition', nonLocal:true,
  search:['ice', 'freeze', 'winter', 'frozen', 'melt', 'cold', 'seasonal'],
  desc:'Frost creeps in from the edges and freezes A over, then thaws in clear patches to show B.',
  params:[ C('frost','Frost colour','#eaf4fa',false), R('branch','Branching',.7,0,1.5), S('origin','Grows from',['Edges','Corners','Centre'],0), R('blur','Ice blur',.01,0,.03), R('thaw','Thaw starts',.5,.3,.8) ],
  fs:`float fr_ridge(vec2 q){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a * (1. - abs(vnoise(q) * 2. - 1.)); q = q * 2.07 + 7.3; a *= .5; } return v; }
vec4 fx(vec2 uv){
  float p = uProgress, ts = p_thaw, ar = aspect();
  vec2 c = centered(uv);
  int om = int(p_origin + .5);
  float e;
  if (om == 0) e = min(min(c.x + ar * .5, ar * .5 - c.x), min(c.y + .5, .5 - c.y));
  else if (om == 1){ vec2 k = vec2(ar * .5, .5) - abs(c); e = length(k) * .6; }
  else e = length(c) * .6;
  float rd = fr_ridge(vec2(c.x, c.y) * 7.);
  float D = e - p_branch * .12 * rd;
  float f = mix(-.1, .56, clamp(p / ts, 0., 1.));
  float frozen = 1. - smoothstep(f - .012, f + .012, D);
  float rim = exp(-abs(D - f) * 120.) * step(p, ts + .05);
  vec3 a = texture(uA, uv).rgb;
  vec2 r = vec2(p_blur) / vec2(ar, 1.);
  vec3 ab = (a + texture(uA, uv + vec2(r.x, 0.)).rgb + texture(uA, uv - vec2(r.x, 0.)).rgb + texture(uA, uv + vec2(0., r.y)).rgb + texture(uA, uv - vec2(0., r.y)).rgb) * .2;
  float needle = pow(fr_ridge(rot(.6) * c * 26.), 6.) * 2.;
  float sp = step(.988, hash12(floor(uv * uRes / 2.)));
  vec3 ice = mix(ab, p_frost, .3 + .22 * pow(rd, 2.)) + p_frost * needle * .2 + sp * .25;
  vec3 col = mix(a, ice, frozen);
  col += p_frost * rim * .6 * frozen;
  float q = (p - ts) / (1. - ts) * 1.25 - .06;
  float n = fbm(uv * vec2(ar, 1.) * 3. + 4.);
  float hole = 1. - smoothstep(q - .012, q + .012, n);
  float men = exp(-abs(n - q) * 140.) * step(ts, p);
  vec2 rf = (vec2(fbm(uv * 9.), fbm(uv * 9. + 3.)) - .5) * .03 * men;
  vec3 b = texture(uB, uv + rf).rgb;
  col = mix(col, b, hole);
  col += vec3(1.) * men * .22 * (1. - smoothstep(.9, 1., p));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-rain-glass', name:'Rain on glass', cat:'transition', nonLocal:true,
  search:['raindrops', 'droplets', 'window', 'wet', 'weather', 'lens', 'condensation'],
  desc:'Raindrops land on the glass, each holding a tiny upside-down B, until they run together and B is everywhere.',
  params:[ R('density','Drop density',8,3,30), R('size','Drop size',.75,.1,1), T('inv','Upside-down in each drop',true), R('refract','Refraction',.5,0,1), R('fog','Dew fog',.3,0,.7) ],
  fs:`vec4 rg_drop(vec2 q, float sc, float seed, float p){
  vec2 base = floor(q * sc);
  vec4 best = vec4(-1e3, 0., 0., 1.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 id = base + vec2(float(i), float(j));
    vec2 h = hash22(id + seed);
    vec2 ce = (id + .5 + (h - .5) * .5) / sc;
    float ta = hash12(id * 1.7 + seed) * .55;
    float r0 = (.12 + .26 * hash12(id + seed * 3.1)) * p_size * 1.6 / sc;
    float r = r0 * smoothstep(ta, ta + .1, p) + smoothstep(.5, .98, p) * 1.3 / sc;
    float dep = r - length(q - ce);
    if (dep > best.x) best = vec4(dep, ce, r);
  }
  return best;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = centered(uv);
  vec4 d1 = rg_drop(c, p_density, 0., p), d2 = rg_drop(c, p_density * 2.4, 11., p);
  vec4 d = d1.x > 0. ? d1 : d2;
  vec3 a = texture(uA, uv).rgb;
  float fogA = p_fog * smoothstep(0., .3, p);
  float speck = step(.93, hash12(floor(uv * uRes / 3.))) * .08;
  vec3 col = mix(a, vec3(luma(a)) * .75 + .22 + speck, fogA);
  float pxu = 1.2 / uRes.y;
  if (d.x > -pxu){
    float L = 1. - smoothstep(.55, .92, p);
    vec2 lc = (c - d.yz) / max(d.w, 1e-4);
    float ll = min(length(lc), 1.);
    float z = sqrt(1. - ll * ll);
    vec2 lens = p_inv > .5 ? d.yz - (c - d.yz) * 1.6 : d.yz + (c - d.yz) * .55;
    lens += lc * (1. - z) * p_refract * d.w * 1.5;
    vec2 bq = mix(c, lens, L);
    vec3 b = texture(uB, clamp(uncentered(bq), 0., 1.)).rgb;
    b *= 1. - smoothstep(.55, 1., ll) * .45 * L;
    b += exp(-dot(lc - vec2(-.32, .38), lc - vec2(-.32, .38)) * 40.) * .7 * L;
    float m = smoothstep(-pxu, pxu, d.x) * step(1e-6, d.w);
    col = mix(col, b, m);
  }
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-tide-line', name:'Tide line', cat:'transition', nonLocal:true,
  search:['wave', 'sea', 'beach', 'shore', 'water', 'surf', 'coastal'],
  desc:'B comes in like a tide, surging up the beach and drawing back a few times, leaving wet sand before it covers everything.',
  params:[ I('surges','Surges',3,1,5), R('foam','Foam width',.02,0,.06), R('wet','Wet sand',.55,0,1), R('refract','Refraction',.012,0,.03), S('dir','Comes in from',['Bottom','Left','Top','Right'],0) ],
  fs:`float td_shore(float t, float across){
  return t * 1.26 - .13 + .085 * sin(t * PI * p_surges * 2.) * (1. - t) + .035 * (fbm(vec2(across * 4., t * 2.)) - .5) + .018 * sin(across * 7. + t * 4.);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  int dm = int(p_dir + .5);
  float x = dm == 0 ? uv.y : dm == 1 ? uv.x : dm == 2 ? 1. - uv.y : 1. - uv.x;
  float across = (dm == 0 || dm == 2) ? uv.x : uv.y;
  float s = td_shore(p, across);
  float hi = s;
  for (int k = 1; k <= 6; k++) hi = max(hi, td_shore(max(p - float(k) * .045, 0.), across));
  float pxu = 1.5 / uRes.y;
  float water = smoothstep(-pxu, pxu, s - x);
  float wetM = smoothstep(-pxu, pxu, hi - x) * (1. - water) * step(.001, p);
  vec3 a = texture(uA, uv).rgb;
  vec3 wetA = a * (1. - p_wet * .45);
  wetA = mix(vec3(luma(wetA)), wetA, 1. + p_wet * .4);
  float sheen = pow(vnoise(vec2(across * 40., x * 160.)), 6.) * p_wet;
  vec3 col = mix(a, wetA + sheen * .5, wetM);
  float fin = 1. - p;
  vec2 g = vec2(fbm(uv * 7. + vec2(0., p * 2.)), fbm(uv * 7. + vec2(5.2, p * 2.))) - .5;
  vec3 b = texture(uB, uv + g * p_refract * fin * 2.).rgb;
  float depth = s - x;
  b = mix(b, mix(b, vec3(.9, .96, .97), .35), exp(-max(depth, 0.) * 25.) * fin);
  b += pow(vnoise(vec2(across * 18., x * 110.) + p * 6.), 14.) * .7 * fin;
  float lace = smoothstep(.42, .62, fbm(vec2(across * 22., (x - s) * 70. + 3.)));
  float band = 1. - smoothstep(0., max(p_foam, 1e-4), depth);
  float foam = band * (.55 + .45 * lace) * water * fin;
  b = mix(b, vec3(.97, .98, .97), foam);
  col = mix(col, b, water);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-craquelure', name:'Craquelure', cat:'transition', nonLocal:true,
  search:['crack', 'mud', 'varnish', 'dry', 'shatter', 'plates', 'aged'],
  desc:'A dries and cracks like old varnish, the plates curl and drop away, and B is underneath.',
  params:[ R('plate','Plate size',.12,.04,.4), R('rough','Crack roughness',.5,0,1), R('curl','Curl shadow',.35,0,.6), R('rand','Fall randomness',.7,0,1), T('fine','Fine cracks',true) ],
  fs:`vec4 cq_vor(vec2 q, float jit){
  vec2 i = floor(q), f = fract(q);
  float f1 = 8., f2 = 8.; vec2 best = vec2(0.);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 o = vec2(float(x), float(y));
    vec2 pt = o + .5 + (hash22(i + o) - .5) * jit;
    float d = length(pt - f);
    if (d < f1){ f2 = f1; f1 = d; best = i + pt; } else if (d < f2) f2 = d;
  }
  return vec4(f1, f2, best);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float sc = 1. / max(p_plate, .01);
  vec2 q = centered(uv) * sc;
  float jit = .55 + .4 * p_rough;
  vec2 wob = (vec2(vnoise(q * 3.), vnoise(q * 3. + 9.)) - .5) * .18 * p_rough;
  vec4 v = cq_vor(q + wob, jit);
  vec2 ce = v.zw;
  float h = hash12(ce * 3.7);
  float dist = length(ce / sc) / .65;
  float tf = .42 + mix(clamp(dist, 0., 1.), h, p_rand) * .36;
  float fall = smoothstep(tf, tf + .2, p);
  float sh = max(1. - fall, .001);
  vec2 qs = ce + rot((h - .5) * fall * .9) * (q - ce) / sh;
  vec4 v2 = cq_vor(qs + wob, jit);
  bool same = length(v2.zw - ce) < 1e-3;
  float ed = (v2.y - v2.x) * .5;
  float w = .075 * smoothstep(0., .4, p);
  float pxq = 1.5 * sc / uRes.y / sh;
  float plateM = same && fall < .999 ? (w <= 0. ? 1. : smoothstep(w - pxq, w + pxq, ed)) : 0.;
  if (p_fine > .5 && plateM > 0. && p > .1){
    vec4 v3 = cq_vor(qs * 2.7 + 7.1, jit);
    float wf = .03 * smoothstep(.1, .45, p);
    plateM *= smoothstep(wf - pxq * 2.7, wf + pxq * 2.7, (v3.y - v3.x) * .5);
  }
  vec3 b = texture(uB, uv).rgb;
  float crackShade = p_curl * (1. - smoothstep(0., .16, ed)) * (1. - fall) * smoothstep(0., .3, p);
  b *= 1. - crackShade;
  vec3 a = texture(uA, clamp(uncentered(qs / sc), 0., 1.)).rgb;
  float lift = smoothstep(.0, .22, ed);
  a *= mix(1. - .3 * smoothstep(0., .4, p), 1., lift) * (1. - fall * .55);
  vec3 col = mix(b, a, plateM);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-growth-rings', name:'Growth rings', cat:'transition',
  search:['tree rings', 'wood', 'timber', 'annual', 'radial', 'sweep', 'age'],
  desc:'B grows out ring by ring like the rings of a tree, each ring sweeping round before the next begins.',
  params:[ R('spacing','Ring spacing',.035,.01,.1), R('warp','Warp',.05,0,.15), T('sweep','Sweep round each ring',true), R('late','Latewood line',.45,0,1), R('x','Centre X',-.16,-1,1), R('y','Centre Y',.1,-1,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, ar = aspect();
  vec2 off = vec2(p_x * ar * .5, p_y * .5);
  vec2 c = centered(uv) - off;
  float R = length(c) + p_warp * (fbm(uv * vec2(ar, 1.) * 3.) - .5) * 2.;
  R = max(R, 0.);
  float sp = max(p_spacing, .005);
  float Rmax = length(vec2(ar * .5, .5) + abs(off)) + p_warp + sp;
  float N = ceil(Rmax / sp);
  float k = floor(R / sp), fr = fract(R / sp);
  float D = min(.35, 3. / N);
  float st = k / N * (1. - D);
  float local = clamp((p - st) / D, 0., 1.);
  float on;
  if (p_sweep > .5){
    float ang = fract((atan(c.y, c.x) + PI) / TAU + k * .137);
    float arcPx = max(R * TAU, .05) * uRes.y;
    on = clamp((local - ang) * arcPx / 1.5 + .5, 0., 1.);
    on = local >= 1. ? 1. : local <= 0. ? 0. : on;
  } else on = smoothstep(0., 1., local);
  float fin = 1. - smoothstep(.8, 1., p);
  vec3 b = texture(uB, uv).rgb;
  float pxs = max(uPx, 1.) / uRes.y / sp;
  float lw = 1. - smoothstep(pxs * .6, pxs * 2., 1. - fr);
  b *= 1. - (p_late * lw * .55 + .06 * smoothstep(.55, .95, fr)) * fin;
  return vec4(mix(texture(uA, uv).rgb, b, on), 1.);
}` });

FX.register({ id:'tr-leaf-veins', name:'Leaf veins', cat:'transition',
  search:['botanical', 'leaf', 'venation', 'network', 'organic', 'plant', 'branching'],
  desc:'B flows in through a network of leaf veins, from the midrib out, then fills the small cells between them.',
  params:[ R('spacing','Vein spacing',.11,.04,.3), R('angle','Vein angle',50,20,80,1), R('ter','Fine vein scale',.045,.015,.1), R('line','Vein line',.35,0,1), R('delay','Fill delay',.25,0,.5), C('color','Vein line colour','#141516','ground') ],
  fs:`vec2 lv_vor(vec2 q){
  vec2 i = floor(q), f = fract(q); float f1 = 8., f2 = 8.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 o = vec2(float(x), float(y));
    float d = length(o + .5 + (hash22(i + o) - .5) * .85 - f);
    if (d < f1){ f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return vec2(f1, f2);
}
float lv_tm(float y){ return max(y + .56, 0.) * .34; }
vec4 fx(vec2 uv){
  float p = uProgress;
  float pt = p * 1.14;
  vec2 c = centered(uv);
  float th = radians(p_angle), xa = abs(c.x);
  float y0c = c.y - xa / tan(th) + .35 * xa * xa;
  float sp = p_spacing;
  float r = y0c / sp;
  float y0 = (floor(r) + .5) * sp;
  float perp = abs(fract(r) - .5) * sp * sin(th);
  float along = xa / sin(th);
  float Tm = lv_tm(c.y);
  float Ts = lv_tm(y0) + along * .45;
  float Tf = lv_tm(y0c) + along * .45;
  float wm = .011 * clamp((pt - Tm) / .08, 0., 1.);
  float ws = .0055 * clamp((pt - Ts) / .06, 0., 1.) * (1. - .5 * clamp(along / .7, 0., 1.));
  vec2 vt = lv_vor(c / p_ter);
  float et = (vt.y - vt.x) * .5;
  float wt = .07 * clamp((pt - Tf - .06) / .08, 0., 1.);
  float px = 1.2 / uRes.y;
  float vm = (1. - smoothstep(wm - px, wm + px, xa)) * step(.0002, wm);
  float vs = (1. - smoothstep(ws - px, ws + px, perp)) * step(.0002, ws);
  float vtm = 1. - smoothstep(wt - .02, wt + .02, et);
  vtm *= step(.001, wt);
  float grow = clamp((pt - Tf - .06 - p_delay) / .26, 0., 1.);
  float ar = 1. - smoothstep(grow * .6 - .02, grow * .6 + .02, .5 - et);
  ar = grow >= 1. ? 1. : ar * step(.001, grow);
  float inB = max(max(vm, vs), max(vtm, ar));
  inB = max(inB, smoothstep(.96, 1., p));
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, inB);
  float fin = 1. - smoothstep(.8, 1., p);
  float lm = (1. - smoothstep(0., px * 1.2, xa)) * step(.0005, wm);
  float ls = (1. - smoothstep(0., px * 1., perp)) * step(.0005, ws);
  float lt = (1. - smoothstep(0., .012, et)) * step(.001, wt) * .6;
  col = mix(col, p_color, max(max(lm, ls), lt) * p_line * fin);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-smoke-lift', name:'Smoke lift', cat:'transition', nonLocal:true,
  search:['smoke', 'vapour', 'evaporate', 'drift', 'atmospheric', 'mist', 'dissolve'],
  desc:'A lifts off the page like smoke, curling upward and thinning to show B.',
  params:[ R('lift','Lift',.35,0,1), R('curl','Curl',.6,0,1.5), R('soft','Softness',.1,.02,.3), S('dir','Drifts',['Up','Down','Left','Right'],0), T('sharpen','B comes into focus',true) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  int dm = int(p_dir + .5);
  vec2 up = dm == 0 ? vec2(0., 1.) : dm == 1 ? vec2(0., -1.) : dm == 2 ? vec2(-1., 0.) : vec2(1., 0.);
  vec2 side = vec2(up.y, -up.x);
  float h = dot(uv - .5, up) + .5;
  float n1 = fbm(uv * 3. + vec2(p * 1.3, -p));
  float curlx = (n1 - .5) * p_curl;
  float la = luma(texture(uA, uv).rgb);
  vec2 off = (side * curlx + up) * p * p * p_lift * (.5 + la);
  float pre = 1. - smoothstep(-p_soft, p_soft, p * 1.55 - fbm(uv * 4. - up * p * 2.) - (1. - h) * .3 - .05);
  off += up * (1. - pre) * pre * .5 * p_lift + side * (n1 - .5) * (1. - pre) * .08 * p_curl;
  vec3 a = texture(uA, uv - off).rgb;
  a = mix(a, vec3(luma(a)) * .85 + .14, smoothstep(.0, .7, p) * .55);
  float s = p_soft;
  float alpha = 1. - smoothstep(-s, s, p * 1.55 - fbm(uv * 4. - up * p * 2.) - (1. - h) * .3 - .05);
  float wisp = smoothstep(.0, .5, alpha) * (1. - smoothstep(.5, 1., alpha));
  vec2 r = p_sharpen > .5 ? vec2((1. - p) * .006) / vec2(aspect(), 1.) : vec2(0.);
  vec3 b = (texture(uB, uv).rgb * 2. + texture(uB, uv + vec2(r.x, 0.)).rgb + texture(uB, uv - vec2(r.x, 0.)).rgb + texture(uB, uv + vec2(0., r.y)).rgb + texture(uB, uv - vec2(0., r.y)).rgb) / 6.;
  vec3 col = mix(b, a, alpha);
  col += wisp * .12 * (1. - p);
  if (p <= 0.) col = texture(uA, uv).rgb;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Time ---- */

/* Pulses run on clock time, not progress, so the strobe rate is fixed in seconds whatever
   the duration and easing. Capped at 3 a second (one pulse = one flash) for photosensitive viewers. */
FX.register({ id:'tr-duty-cycle', name:'Duty cycle', cat:'transition',
  search:['strobe', 'flicker', 'pulse', 'pwm', 'beat', 'rhythm', 'flash cut'],
  desc:'A and B strobe against each other, with B holding a little longer on each pulse until it is all that is left. Never more than three pulses a second.',
  params:[ R('rate','Pulses a second',2,.5,3), I('bands','Bands',6,0,32), R('offset','Band offset',.5,0,1), S('axis','Bands',['Horizontal','Vertical'],0) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float rate = clamp(p_rate, .1, 3.);
  float ph = uTime * rate;
  if (p_bands > .5){
    float coord = p_axis < .5 ? 1. - uv.y : uv.x;
    float band = floor(coord * p_bands);
    ph += band / p_bands * p_offset;
  }
  float onB = fract(ph) < p ? 1. : 0.;
  if (p >= 1.) onB = 1.;
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, onB), 1.);
}` });

FX.register({ id:'tr-cast-shadow', name:'Cast shadow', cat:'transition',
  search:['sundial', 'gnomon', 'shadow', 'sunset', 'bauhaus', 'primitive', 'light'],
  desc:'A simple shape sits in the frame as the light drops towards it, and its lengthening shadow carries B across the whole frame.',
  params:[ S('shape','Shape',['Circle','Square','Triangle'],0), R('size','Size',.13,.05,.35), R('az','Light from',200,0,360,1), R('pen','Penumbra',.2,0,.6), R('tint','Shadow depth',.35,0,.6), R('x','Position X',0,-1,1), R('y','Position Y',-.1,-1,1) ],
  fs:`float cs_sd(vec2 q, float r){
  int s = int(p_shape + .5);
  if (s == 0) return length(q) - r;
  if (s == 1) return sdRoundBox(q, vec2(r * .86), r * .06);
  return sdTri(vec2(q.x, -q.y), r * 1.05);
}
vec4 fx(vec2 uv){
  float p = uProgress, ar = aspect();
  vec2 c = centered(uv);
  vec2 o = vec2(p_x * ar * .5, p_y * .5);
  float r = p_size * smoothstep(0., .14, p);
  float az = radians(p_az);
  vec2 ld = vec2(cos(az), sin(az));
  float drop = smoothstep(.06, 1., p);
  float rr = max(p_size, .02);
  float D = rr * (1. + 12. * (1. - drop) * (1. - drop)) - rr * 1.2 * smoothstep(.88, 1., drop);
  vec2 lp = o + ld * D;
  float L = .12 + 3.6 * drop * drop;
  float k = mix(48., 3., p_pen);
  vec2 rd = lp - c; float tot = length(rd); rd /= max(tot, 1e-5);
  float maxT = min(tot, L);
  float res = 1., t = .003;
  float sd0 = cs_sd(c - o, r);
  if (r > 1e-4){
    for (int i = 0; i < 40; i++){
      if (t >= maxT) break;
      float h = cs_sd(c + rd * t - o, r);
      if (h < .0004){ res = 0.; break; }
      res = min(res, k * h / t);
      t += clamp(h, .004, .12);
    }
  }
  float far = smoothstep(maxT * .82, maxT, t) * step(maxT, tot - 1e-4);
  float sh = (1. - clamp(res, 0., 1.)) * step(1e-4, r);
  sh *= 1. - far * (1. - step(.5, 1. - res));
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float fin = 1. - smoothstep(.82, 1., p);
  vec3 bs = b * (1. - p_tint * fin);
  vec3 col = mix(a, bs, sh);
  float px = 1.2 / uRes.y;
  float inObj = 1. - smoothstep(-px, px, sd0);
  vec2 e = vec2(.002, 0.);
  vec2 nrm = normalize(vec2(cs_sd(c - o + e, r) - cs_sd(c - o - e, r), cs_sd(c - o + e.yx, r) - cs_sd(c - o - e.yx, r)) + 1e-6);
  vec3 objC = b * (1. + .12 * dot(nrm, ld) * fin);
  objC += exp(-abs(sd0) / (px * 1.6)) * max(dot(nrm, ld), 0.) * .5 * fin;
  col = mix(col, objC, inObj * step(1e-4, r));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Design systems ---- */

FX.register({ id:'tr-grid-reflow', name:'Grid reflow', cat:'transition', nonLocal:true,
  search:['responsive', 'columns', 'layout', 'grid', 'editorial', 'panels', 'reflow'],
  desc:'The columns of A narrow and give way as the columns of B open up beside them, like a responsive grid reflowing.',
  params:[ I('cols','Columns',5,2,24), R('gutter','Gutter (px)',10,0,40), R('stagger','Stagger',.5,0,.9), S('content','Content',['Squash','Crop'],0), S('axis','Axis',['Columns','Rows'],0), C('bg','Gutter colour','#141516','ground') ],
  fs:`float gr_w(int k, int n, float p){
  int i = k < n ? k : k - n;
  float fn = float(n);
  float t0 = fn > 1. ? float(i) / (fn - 1.) * p_stagger : 0.;
  float e = smoothstep(t0, t0 + 1. - p_stagger, p);
  return k < n ? e : 1. - e;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  int n = int(clamp(p_cols, 2., 24.) + .5);
  bool rowsAx = p_axis > .5;
  float x = rowsAx ? 1. - uv.y : uv.x;
  float W = 0.;
  for (int k = 0; k < 48; k++){ if (k >= 2 * n) break; W += gr_w(k, n, p); }
  float target = x * W, acc = 0., w = 0.; int slot = 2 * n - 1; float s0 = 0.;
  for (int k = 0; k < 48; k++){
    if (k >= 2 * n) break;
    w = gr_w(k, n, p);
    if (target < acc + w || k == 2 * n - 1){ slot = k; s0 = acc; break; }
    acc += w;
  }
  float local = clamp((target - s0) / max(w, 1e-5), 0., 1.);
  bool isB = slot < n;
  int i = isB ? slot : slot - n;
  float fn = float(n);
  float u;
  if (p_content < .5) u = (float(i) + local) / fn;
  else u = float(i) / fn + (target - s0) / W;
  vec2 st = rowsAx ? vec2(uv.x, 1. - u) : vec2(u, uv.y);
  vec3 col = isB ? texture(uB, st).rgb : texture(uA, st).rgb;
  float span = rowsAx ? uRes.y : uRes.x;
  float bell = sin(PI * p); float g = p_gutter * bell * bell * .5 / span * smoothstep(0., .25, w * fn);
  float dEdge = min((target - s0), (s0 + w - target)) / W;
  bool frameEdge = (slot == 0 && target - s0 < (s0 + w - target)) || (slot == 2 * n - 1 && target - s0 > (s0 + w - target));
  if (!frameEdge && g > 0.) col = mix(col, p_bg, 1. - smoothstep(g - .5 / span, g + .5 / span, dEdge));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-baseline-set', name:'Baseline set', cat:'transition',
  search:['typesetting', 'lines', 'baseline grid', 'editorial', 'caret', 'leading', 'rows'],
  desc:'B is set in line by line along a baseline grid, like type being set, without any letters.',
  params:[ R('leading','Leading (px)',40,8,120), R('stagger','Stagger',.6,0,1), R('xh','x-height',.5,.3,.8), R('ragged','Ragged edge',.22,0,.5), C('caret','Caret colour','#ff5a36','accent'), T('rtl','Right to left') ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float l = max(p_leading, 2.) / uRes.y;
  float yy = (1. - uv.y) / l;
  float r = floor(yy), ly = fract(yy);
  float rows = ceil(1. / l);
  float S = p_stagger * 1.4;
  float pr = clamp(p * (1. + S) - r / rows * S, 0., 1.);
  float x = p_rtl > .5 ? 1. - uv.x : uv.x;
  float len = 1. - p_ragged * hash12(vec2(r, 4.7));
  float hx = smoothstep(0., .6, pr) * len;
  float g = smoothstep(.55, 1., pr);
  float xl = mix(hx, 1.02, smoothstep(.6, 1., pr));
  float base = .74, xt = base - p_xh * .55;
  float top = mix(xt, -.01, g), bot = mix(base, 1.01, g);
  float pxl = 1. / max(p_leading, 2.);
  float pxx = 1. / uRes.x;
  float inBand = smoothstep(top - pxl, top + pxl, ly) * (1. - smoothstep(bot - pxl, bot + pxl, ly));
  float inX = 1. - smoothstep(xl - pxx, xl + pxx, x);
  float m = inBand * inX * step(1e-4, pr);
  if (pr >= 1.) m = 1.;
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m);
  float cw = max(2., uPx * 1.5) / uRes.x;
  float caretOn = step(1e-4, pr) * (1. - smoothstep(.55, .62, pr));
  float cy = step(xt - .14, ly) * step(ly, base + .04);
  float cx = 1. - smoothstep(cw * .5, cw * .5 + pxx, abs(x - hx - cw * .5));
  col = mix(col, p_caret, cx * cy * caretOn);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-modular-fill', name:'Modular fill', cat:'transition', nonLocal:true,
  search:['swiss', 'modular grid', 'layout', 'panels', 'mosaic', 'editorial', 'boxes'],
  desc:'The frame divides into a modular grid of different-sized fields, and each one brings B in from its own direction.',
  params:[ I('cols','Modules across',4,2,12), I('depth','Split depth',3,1,5), R('stagger','Stagger',.55,0,.9), R('gutter','Gutter (px)',12,0,30), S('motion','Motion',['Slide','Scale','Wipe'],0), C('bg','Gutter colour','#141516','ground'), I('seed','Layout seed',3,1,99) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float cols = floor(p_cols + .5), rows = max(1., floor(cols / aspect() + .5));
  vec2 dims = vec2(cols, rows);
  vec2 m = vec2(uv.x, 1. - uv.y) * dims;
  vec2 lo = vec2(0.), hi = dims; float id = 1.;
  for (int k = 0; k < 5; k++){
    if (float(k) >= p_depth) break;
    vec2 sz = hi - lo;
    if (sz.x < 2. && sz.y < 2.) break;
    float hh = hash12(vec2(id * 1.37, p_seed * 7.1));
    bool ax = sz.x > sz.y ? true : sz.y > sz.x ? false : hh > .5;
    if (ax && sz.x < 2.) ax = false; if (!ax && sz.y < 2.) ax = true;
    float a = ax ? sz.x : sz.y;
    float cut = (ax ? lo.x : lo.y) + 1. + floor(fract(hh * 13.7) * (a - 1.));
    if ((ax ? m.x : m.y) < cut){ if (ax) hi.x = cut; else hi.y = cut; id = id * 2.; }
    else { if (ax) lo.x = cut; else lo.y = cut; id = id * 2. + 1.; }
  }
  vec2 sz = hi - lo;
  vec2 lp = (m - lo) / sz;
  float h1 = hash12(vec2(id, p_seed + 31.)), h2 = hash12(vec2(id + 9., p_seed));
  float t0 = h1 * p_stagger;
  float e = smoothstep(t0, t0 + 1. - p_stagger, p);
  int dd = int(floor(h2 * 4.));
  vec2 dv = dd == 0 ? vec2(1., 0.) : dd == 1 ? vec2(-1., 0.) : dd == 2 ? vec2(0., 1.) : vec2(0., -1.);
  int mo = int(p_motion + .5);
  bool useB; vec2 sp = lp;
  if (mo == 0){
    vec2 la = lp - dv * e;
    if (la.x >= 0. && la.x <= 1. && la.y >= 0. && la.y <= 1.){ useB = false; sp = la; }
    else { useB = true; sp = lp - dv * (e - 1.); }
  } else if (mo == 1){
    vec2 q = abs(lp - .5);
    useB = max(q.x, q.y) < e * .5;
    if (useB) sp = .5 + (lp - .5) / max(e, 1e-3) * mix(.85, 1., e);
  } else {
    float cd = dot(lp - .5, dv) + .5;
    useB = cd > 1. - e;
  }
  if (e >= 1.){ useB = true; sp = lp; }
  vec2 mm = lo + clamp(sp, 0., 1.) * sz;
  vec2 su = vec2(mm.x / dims.x, 1. - mm.y / dims.y);
  vec3 col = useB ? texture(uB, su).rgb : texture(uA, su).rgb;
  vec2 pxm = dims / uRes;
  float gw = p_gutter * .5 * sin(PI * p);
  vec2 dl = (m - lo) / pxm, dh = (hi - m) / pxm;
  float dE = 1e5;
  if (lo.x > 0.) dE = min(dE, dl.x); if (lo.y > 0.) dE = min(dE, dl.y);
  if (hi.x < dims.x) dE = min(dE, dh.x); if (hi.y < dims.y) dE = min(dE, dh.y);
  if (gw > 0.) col = mix(col, p_bg, 1. - smoothstep(gw - .7, gw + .7, dE));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-quasicrystal', name:'Quasicrystal', cat:'transition',
  search:['penrose', 'aperiodic', 'tiling', 'geometric', 'pattern', 'islamic', 'rosette', 'mathematical'],
  desc:'A never-repeating lattice of rosettes spreads out from the centre, B fills its cells, then the lattice lines fade.',
  params:[ R('scale','Scale',7,3,20), S('sym','Symmetry',['5-fold','7-fold','8-fold'],0), R('lattice','Lattice in the order',.4,0,.8), C('seam','Line colour','#e4e2dc','ink'), R('weight','Line weight (px)',1.4,0,4), R('glint','Glint',.3,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  int sm = int(p_sym + .5);
  int n = sm == 0 ? 5 : sm == 1 ? 7 : 8;
  float fn = float(n);
  vec2 c = centered(uv);
  vec2 q = c * p_scale * TAU;
  float F = 0.;
  for (int i = 0; i < 8; i++){
    if (i >= n) break;
    float ang = PI * float(i) / fn;
    F += cos(dot(q, vec2(cos(ang), sin(ang))));
  }
  F /= fn;
  float rad = clamp(length(c) / .68, 0., 1.);
  float key = mix(rad, F * .5 + .5, p_lattice);
  float edge = p * 1.12 - .06;
  float fk = max(fwidth(key), 1e-4);
  float m = clamp((edge - key) / fk + .5, 0., 1.);
  m = max(m, smoothstep(.95, 1., p));
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec3 col = mix(a, b, m);
  float front = exp(-abs(edge - key) * 18.) * p_glint * (1. - smoothstep(.85, 1., p)) * smoothstep(0., .08, p);
  col += front * .35;
  float fw = max(fwidth(F), 1e-4);
  float wp = p_weight / max(uPx, 1e-3);
  float ln = (1. - smoothstep(wp * .5 - .5, wp * .5 + .5, abs(F) / fw)) * step(.01, p_weight);
  float vis = smoothstep(0., .18, p) * (1. - smoothstep(.75, 1., p));
  float near = 1. - smoothstep(.0, .25, key - edge);
  col = mix(col, p_seam, ln * vis * near * .8);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-truchet-flow', name:'Truchet flow', cat:'transition',
  search:['truchet', 'tiles', 'maze', 'tubes', 'pattern', 'arcs', 'modular'],
  desc:'B flows through the frame along a maze of curving tubes made from quarter-circle tiles, then the tubes swell and merge.',
  params:[ R('tile','Tile size (px)',72,16,200), R('width','Tube width',.12,.04,.3), S('style','Tiles',['Arcs','Diagonals'],0), R('outline','Outline (px)',1.5,0,4), S('order','Order',['From the centre','Random','Left to right'],0), C('line','Outline colour','#141516','ground') ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float ts = max(p_tile, 4.);
  vec2 g = uv * uRes / ts;
  vec2 cell = floor(g), l = fract(g);
  float h = hash12(cell + .5), h2 = hash12(cell * 1.31 + 7.7);
  if (h > .5) l.x = 1. - l.x;
  float dist, ang, maxW;
  if (p_style < .5){
    float a1 = abs(length(l) - .5), a2 = abs(length(l - 1.) - .5);
    if (a1 < a2){ dist = a1; ang = atan(l.y, l.x) / (PI * .5); }
    else { dist = a2; ang = atan(1. - l.y, 1. - l.x) / (PI * .5); }
    maxW = .52;
  } else {
    dist = abs(l.x - l.y) * .7071; ang = (l.x + l.y) * .5; maxW = .72;
  }
  if (h2 > .5) ang = 1. - ang;
  int om = int(p_order + .5);
  vec2 cu = (cell + .5) * ts / uRes;
  float o = om == 0 ? clamp(length(centered(cu)) / .66, 0., 1.) : om == 1 ? hash12(cell + 3.3) : clamp(cu.x, 0., 1.);
  float ts0 = o * .45;
  float flow = clamp((p - ts0) / .22, 0., 1.);
  float w = mix(p_width, maxW, smoothstep(.45, .93, p));
  float aa = max(uPx, 1.) / ts;
  float inT = 1. - smoothstep(w - aa, w + aa, dist);
    float inF = flow >= 1. ? 1. : clamp((flow - ang) / (aa * 2.) + .5, 0., 1.) * step(1e-4, flow);
  float m = inT * inF;
  if (p >= 1.) m = 1.;
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m);
  float ow = p_outline / ts;
  float ol = (1. - smoothstep(ow * .5, ow * .5 + aa, abs(dist - w))) * step(.01, p_outline) * inF;
  col = mix(col, p_line, ol * (1. - smoothstep(.78, .93, p)));
  return vec4(col, 1.);
}` });
