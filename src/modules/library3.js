/* ---------------- Library, third pass ----------------
   Screens, engraving, tilings and glass: parts of an image language that
   repeat, rather than one-off filters. Shared GLSL lives in L3 below. */

const L3 = {
  /* a 64x64 blue-noise threshold tile (void-and-cluster), built once and shared.
     Blue noise has no clumps or lines, so a dither made from it reads as fine grain
     and holds still when it is anchored to the screen. */
  blueNoise(){
    if (L3._bn) return L3._bn;
    const N = 64, M = N * N, R = 5, sig = 1.5;
    const ker = [];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) ker.push([dx, dy, Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig))]);
    const e = new Float32Array(M), on = new Uint8Array(M), rank = new Float32Array(M);
    const splat = (i, s) => { const x = i % N, y = (i / N) | 0; for (const [dx, dy, w] of ker) e[((y + dy + N) % N) * N + ((x + dx + N) % N)] += s * w; };
    const tight = () => { let b = -1, bi = 0; for (let i = 0; i < M; i++) if (on[i] && e[i] > b){ b = e[i]; bi = i; } return bi; };
    const voidAt = () => { let b = 1e9, bi = 0; for (let i = 0; i < M; i++) if (!on[i] && e[i] < b){ b = e[i]; bi = i; } return bi; };
    let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    let ones = 0;
    while (ones < M * .1){ const i = (rnd() * M) | 0; if (!on[i]){ on[i] = 1; splat(i, 1); ones++; } }
    for (let it = 0; it < 3000; it++){
      const c = tight(); on[c] = 0; splat(c, -1);
      const v = voidAt();
      on[v] = 1; splat(v, 1);
      if (v === c) break;
    }
    const on0 = on.slice(), e0 = e.slice();
    for (let r = ones - 1; r >= 0; r--){ const c = tight(); on[c] = 0; splat(c, -1); rank[c] = r; }
    on.set(on0); e.set(e0);
    for (let r = ones; r < M; r++){ const v = voidAt(); rank[v] = r; on[v] = 1; splat(v, 1); }
    return (L3._bn = rank);
  },
  /* GLSL shared by several modules (prepend inside fs) */
  common:`
float l3line(float f, float w, float aa){ return 1. - smoothstep(w - aa, w + aa, abs(f - .5)); }
float l3seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
`,
};

/* ---- Screentone ---- */
FX.register({ id:'trt-screentone', name:'Screentone', cat:'treatment', search:['manga', 'comic', 'print', 'halftone', 'tone', 'dots'],
  desc:'Manga screentone: the frame is cut into a few flat tones, each laid down as dots, lines, hatching or checks.',
  params:[ S('pattern','Pattern',['Tone ladder','Dots','Lines','Cross-hatch','Checks'],0), I('tones','Tones',4,2,8), R('scale','Screen size',64,16,160,1), R('angle','Angle',45,-90,90,1), R('contrast','Contrast',1.25,.4,3), R('bias','Lighter / darker',0,-.4,.4), T('smooth','Continuous tone',false), I('drift','Drift (cells per loop)',0,0,8), S('colour','Ink',['One ink','From the image'],0), C('ink','Ink','#141516','ink'), C('paper','Paper','#efece4','ground') ],
  fs:`float dotsCov(vec2 g, float lv, float aa){
  vec2 f = fract(g);
  if (lv < .5){ float r = sqrt(lv / PI); return 1. - smoothstep(r - aa, r + aa, length(f - .5)); }
  float r = sqrt((1. - lv) / PI); return smoothstep(r - aa, r + aa, length(abs(f - .5) - .5));
}
float linesCov(vec2 g, float lv, float aa){
  float w = lv * .5;
  return max(1. - smoothstep(w - aa, w + aa, abs(fract(g.y) - .5)), smoothstep(.94, 1., lv));
}
float hatchCov(vec2 g, float lv, float aa){
  float a = 1. - smoothstep(min(lv, .5) * .5 - aa, min(lv, .5) * .5 + aa, abs(fract(g.y) - .5));
  float wb = max(2. * lv - 1., 0.) * .5;
  float b = wb > 0. ? 1. - smoothstep(wb - aa, wb + aa, abs(fract(g.x) - .5)) : 0.;
  return lv < .02 ? 0. : max(a, b);
}
float checksCov(vec2 g, float lv){
  vec2 q = floor(g * 2.);
  return step(bayer4(q) + .03, lv);
}
vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  vec2 g = rot(radians(p_angle)) * c * p_scale;
  g.x += uLoop * p_drift;
  float aa = length(fwidth(g)) * .7 + .001;
  float r = min(.35 / p_scale, .012);
  vec2 ax = vec2(r / aspect(), 0.), ay = vec2(0., r);
  vec3 avg = (texture(uInput, uv).rgb * 2. + texture(uInput, uv + ax).rgb + texture(uInput, uv - ax).rgb + texture(uInput, uv + ay).rgb + texture(uInput, uv - ay).rgb) / 6.;
  float t = clamp((1. - luma(avg) - .5) * p_contrast + .5 + p_bias, 0., 1.);
  float n = float(int(p_tones + .5));
  float lv = p_smooth > .5 ? t : floor(t * n + .5) / n;
  int pat = int(p_pattern + .5);
  float cov;
  if (pat == 0){
    if (lv < .4) cov = dotsCov(g, lv * 1.25, aa);
    else if (lv < .74) cov = linesCov(g, lv, aa);
    else cov = hatchCov(g, lv, aa);
  }
  else if (pat == 1) cov = dotsCov(g, lv, aa);
  else if (pat == 2) cov = linesCov(g, lv, aa);
  else if (pat == 3) cov = hatchCov(g, lv, aa);
  else cov = checksCov(g, lv);
  if (lv <= 0.) cov = 0.;
  vec3 ink = p_colour < .5 ? p_ink : mix(p_ink, avg * avg * 1.4, .85);
  return vec4(mix(p_paper, ink, cov), 1.);
}` });

/* ---- Stable dither ---- */
FX.register({ id:'trt-stabledither', name:'Stable dither', cat:'treatment', kind:'gl', search:['dither', 'blue noise', 'bayer', 'pixel', 'retro', 'stable', 'still'],
  desc:'Dithering from a fixed blue-noise or Bayer tile that stays put on the screen, so moving images do not swim. It can shimmer or slide in whole cycles.',
  params:[ S('pattern','Pattern',['Blue noise','Bayer'],0), S('look','Look',['Ink on paper','Ink, accent and paper','Image colour'],0), R('pixel','Pixel size',4,1,16,1), I('levels','Colours per channel',3,2,6), R('contrast','Contrast',1.1,.4,2.5), S('motion','Motion',['Still','Shimmer','Slide'],0), I('cycles','Cycles per loop',1,1,4), C('ink','Ink','#141516','ink'), C('mid','Middle','#ff5a36','accent'), C('paper','Paper','#efece4','ground') ],
  aux(ctx){
    const r = L3.blueNoise(), im = ctx.createImageData(64, 64);
    for (let i = 0; i < 4096; i++){ const v = Math.round(r[i] / 4095 * 255); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    ctx.putImageData(im, 0, 0);
  },
  auxSize(){ return [64, 64]; },
  fs:`float thresh(ivec2 q){
  if (p_pattern > .5) return (bayer8(vec2(q)) * 64. + .5) / 64.;
  return (texelFetch(uAux, ivec2(q.x & 63, q.y & 63), 0).r * 255. + .5) / 256.;
}
vec4 fx(vec2 uv){
  float H = 1080. / p_pixel;
  vec2 cells = vec2(floor(H * aspect()), floor(H));
  vec2 gp = floor(uv * cells);
  vec3 src = texture(uInput, (gp + .5) / cells).rgb;
  src = clamp((src - .5) * p_contrast + .5, 0., 1.);
  int mo = int(p_motion + .5);
  ivec2 q = ivec2(gp);
  float th = thresh(q);
  if (mo == 1) th = fract(th + uLoop * p_cycles);
  else if (mo == 2){ int o = int(floor(uLoop * p_cycles * 64.)); q += ivec2(o, o / 2); th = thresh(q); }
  int lk = int(p_look + .5);
  vec3 col;
  if (lk == 0) col = mix(p_ink, p_paper, step(th, luma(src)));
  else if (lk == 1){
    float v = luma(src) * 2.; float k = floor(v + th);
    col = k < .5 ? p_ink : (k < 1.5 ? p_mid : p_paper);
  } else {
    float L = float(int(p_levels + .5)) - 1.;
    col = floor(src * L + th) / L;
  }
  return vec4(col, 1.);
}` });

/* ---- Colour ramp ---- */
FX.register({ id:'trt-ramp', name:'Colour ramp', cat:'treatment', search:['gradient map', 'thermal', 'x-ray', 'heat', 'posterise', 'false colour', 'tone'],
  desc:'Maps brightness onto a five-colour ramp, smooth or in flat bands. Brand colours, or a heat-camera, x-ray, sunset or night-vision ramp.',
  params:[ S('preset','Ramp',['Brand colours','Thermal','X-ray','Sunset','Night vision'],0), I('steps','Flat bands (0 = smooth)',0,0,12), R('contrast','Contrast',1.1,.3,3), R('mid','Midpoint',.5,.15,.85), R('grit','Grain',.02,0,.15), R('amount','Amount',1,0,1), C('c1','Darkest','#0d0f1a','ground'), C('c2','Dark','#3b2a8f','accent2'), C('c3','Middle','#ff5a36','accent'), C('c4','Light','#ffc98a', false), C('c5','Lightest','#f4efe6','ink') ],
  fs:`vec3 ramp(float t, int pre){
  vec3 a, b, c, d, e;
  if (pre == 1){ a = vec3(.02, 0., .06); b = vec3(.24, .02, .5); c = vec3(.85, .1, .3); d = vec3(1., .65, .05); e = vec3(1., 1., .85); }
  else if (pre == 2){ a = vec3(.01, .03, .07); b = vec3(.05, .2, .32); c = vec3(.3, .6, .75); d = vec3(.75, .93, .98); e = vec3(1.); t = 1. - t; }
  else if (pre == 3){ a = vec3(.08, .03, .2); b = vec3(.5, .1, .45); c = vec3(.95, .3, .3); d = vec3(1., .72, .3); e = vec3(1., .95, .8); }
  else if (pre == 4){ a = vec3(0., .02, 0.); b = vec3(0., .2, .05); c = vec3(.1, .6, .2); d = vec3(.5, .95, .5); e = vec3(.9, 1., .9); }
  else { a = p_c1; b = p_c2; c = p_c3; d = p_c4; e = p_c5; }
  float s = t * 4.;
  vec3 col = mix(a, b, smoothstep(0., 1., clamp(s, 0., 1.)));
  col = mix(col, c, smoothstep(0., 1., clamp(s - 1., 0., 1.)));
  col = mix(col, d, smoothstep(0., 1., clamp(s - 2., 0., 1.)));
  return mix(col, e, smoothstep(0., 1., clamp(s - 3., 0., 1.)));
}
vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  float l = luma(c);
  l = clamp((l - p_mid) * p_contrast + .5, 0., 1.);
  l += (hash12(floor(uv * vec2(aspect(), 1.) * 1080.)) - .5) * p_grit;
  l = clamp(l, 0., 1.);
  float n = float(int(p_steps + .5));
  if (n > 1.5) l = floor(min(l, .9999) * n) / (n - 1.);
  return vec4(mix(c, ramp(clamp(l, 0., 1.), int(p_preset + .5)), p_amount), 1.);
}` });

/* ---- Local threshold ---- */
FX.register({ id:'trt-trace', name:'Trace', cat:'treatment', search:['xerox', 'photocopy', 'threshold', 'stencil', 'lineart', 'two tone'],
  desc:'Cuts the frame to two tones against its own local average, so detail survives in shadows and highlights. Like a copy of a copy.',
  params:[ R('detail','Detail scale',3,.5,10), R('level','Level',.38,0,1), R('edges','Edge boost',1.2,0,4), R('soft','Softness',.03,.002,.3), R('toner','Toner grain',.25,0,1), C('ink','Toner','#141516','ink'), C('paper','Paper','#efece4','ground') ],
  fs:`vec4 fx(vec2 uv){
  float r = p_detail * .004;
  vec2 k = vec2(r / aspect(), r);
  float mean = 0., wsum = 0.;
  for (int i = 0; i < 12; i++){
    float a = float(i) * 2.39996, d = sqrt((float(i) + .5) / 12.);
    float w = 1.;
    mean += luma(texture(uInput, uv + vec2(cos(a), sin(a)) * d * k).rgb) * w; wsum += w;
  }
  mean /= wsum;
  float l = luma(texture(uInput, uv).rgb);
  /* detail is the difference from the neighbourhood; the level keeps large flat areas from going to mush */
  float v = (l - mean) * (3. + p_edges * 5.) + (l - p_level) * .9;
  v += (fbm(uv * uRes * .35) - .5) * p_toner * .5;
  float t = smoothstep(-p_soft * 3., p_soft * 3., v);
  return vec4(mix(p_ink, p_paper, t), 1.);
}` });

/* ---- Engraving ---- */
FX.register({ id:'trt-engrave', name:'Line engraving', cat:'treatment', nonLocal:true, search:['banknote', 'currency', 'etching', 'linocut', 'print', 'scanlines', 'joy division'],
  desc:'Redraws the image as a single set of engraved lines whose weight follows the tone and whose path bends with the picture, banknote style.',
  params:[ S('mode','Lines',['Straight, bent by tone','Concentric rings','Spiral groove'],0), R('lines','Line count',80,20,240,1), R('angle','Angle',20,-90,90,1), R('relief','Relief',2.5,0,10), R('weight','Line weight',1.2,.2,2), R('contrast','Contrast',1.3,.4,3), T('cross','Cross-cut in the darks',true), C('ink','Ink','#1a2a24','ink'), C('paper','Paper','#e9e4d2','ground') ],
  fs:`float tone(vec2 uv, float rad){
  vec2 k = vec2(rad / aspect(), rad);
  float s = 0., w = 0.;
  for (int i = 0; i < 16; i++){
    float a = float(i) * 2.39996, d = sqrt((float(i) + .5) / 16.);
    s += luma(texture(uInput, uv + vec2(cos(a), sin(a)) * d * k).rgb); w += 1.;
  }
  return s / w;
}
vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float lf = clamp((luma(texture(uInput, uv).rgb) - .5) * p_contrast + .5, 0., 1.);
  float lb = clamp((tone(uv, .012) - .5) * p_contrast + .5, 0., 1.);
  float a = radians(p_angle);
  vec2 dir = vec2(cos(a), sin(a)), nrm = vec2(-dir.y, dir.x);
  int m = int(p_mode + .5);
  float s;
  if (m == 0) s = dot(c, nrm) * p_lines - p_relief * lb * 2.;
  else if (m == 1) s = length(c) * p_lines * .8 - p_relief * lb * 2.;
  else s = length(c) * p_lines * .8 + atan(c.y, c.x) / TAU * 3. - p_relief * lb * 2.;
  float f = fract(s);
  float aa = fwidth(s) * .75 + .002;
  float w = clamp((1. - lf) * p_weight * .6, 0., .52);
  float ink = w > .002 ? 1. - smoothstep(w - aa, w + aa, abs(f - .5)) : 0.;
  if (p_cross > .5 && m == 0){
    float s2 = dot(c, dir) * p_lines * .8 - p_relief * lb;
    float w2 = clamp((.4 - lf) * p_weight * .9, 0., .45);
    float ink2 = w2 > .002 ? 1. - smoothstep(w2 - aa, w2 + aa, abs(fract(s2) - .5)) : 0.;
    ink = max(ink, ink2);
  }
  return vec4(mix(p_paper, p_ink, ink), 1.);
}` });

/* ---- Tiling ---- */
FX.register({ id:'gen-tiling', name:'Tiling', cat:'generator', search:['pattern', 'brick', 'hexagon', 'triangle', 'herringbone', 'weave', 'isometric', 'tile', 'mosaic'],
  desc:'A repeating tiling — brick, hexagon, triangle, herringbone, basketweave or tumbling cubes — with every tile coloured from the brand palette. Tiles can reshuffle on a loop.',
  params:[ S('pattern','Tiling',['Brick','Hexagon','Triangle','Herringbone','Basketweave','Cubes'],1), R('size','Tile size',7,2,24), R('gap','Grout',.06,0,.4), I('colours','Colours in use',3,1,4), R('tone','Tone variation',.18,0,.6), R('bevel','Pillow',.22,0,1), R('angle','Angle',0,-90,90,1), I('shuffle','Reshuffles per loop',0,0,6), R('grain','Surface grain',.05,0,.3), C('bg','Grout','#141516','ground'), C('c1','Tile 1','#ff5a36','accent'), C('c2','Tile 2','#e4e2dc','ink'), C('c3','Tile 3','#2b3a8f','accent2'), C('c4','Tile 4','#c9b99a', false) ],
  fs:L3.common + `vec2 gid; float gedge; float gshade;
void tiling(vec2 p, int pat){
  gshade = 1.;
  if (pat == 0){
    float row = floor(p.y);
    vec2 q = vec2(p.x * .5 + .5 * mod(row, 2.), p.y);
    vec2 i = floor(q), f = fract(q);
    gid = vec2(i.x, row);
    gedge = min(min(f.x, 1. - f.x) * 2., min(f.y, 1. - f.y));
  } else if (pat == 1 || pat == 5){
    const vec2 s = vec2(1., 1.7320508);
    vec4 hC = floor(vec4(p, p - vec2(.5, 1.)) / s.xyxy) + .5;
    vec4 h = vec4(p - hC.xy * s, p - (hC.zw + .5) * s);
    vec4 r = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy) : vec4(h.zw, hC.zw + .5);
    vec2 hp = abs(r.xy);
    float dh = .5 - max(dot(hp, s * .5), hp.x);
    gid = r.zw; gedge = dh;
    if (pat == 5){
      float ang = atan(r.y, r.x);
      float face = (ang > PI / 6. && ang < 5. * PI / 6.) ? 0. : ((ang > -PI / 2. && ang <= PI / 6.) ? 1. : 2.);
      float R = .5773503;
      float dv = min(min(l3seg(r.xy, vec2(0.), R * vec2(.8660254, .5)), l3seg(r.xy, vec2(0.), R * vec2(-.8660254, .5))), l3seg(r.xy, vec2(0.), vec2(0., -R)));
      gedge = min(dh, dv);
      gshade = face < .5 ? 1.18 : (face < 1.5 ? .78 : .5);
    }
  } else if (pat == 2){
    float b = p.y * 1.1547005, a = p.x - .5 * b;
    vec2 cell = floor(vec2(a, b)), f = fract(vec2(a, b));
    float up = step(1., f.x + f.y);
    gid = cell * 2. + up;
    float d = up < .5 ? min(min(f.x, f.y), 1. - f.x - f.y) : min(min(1. - f.x, 1. - f.y), f.x + f.y - 1.);
    gedge = d * .866 * 1.7;
  } else if (pat == 3){
    vec2 a = floor(p);
    float d = mod(a.x - a.y, 4.);
    vec2 anchor = a; bool horiz = true;
    if (d > .5 && d < 1.5) anchor = a - vec2(1., 0.);
    else if (d > 1.5 && d < 2.5){ anchor = a - vec2(0., 1.); horiz = false; }
    else if (d > 2.5) horiz = false;
    vec2 lp = p - anchor, sz = horiz ? vec2(2., 1.) : vec2(1., 2.);
    gedge = min(min(lp.x, sz.x - lp.x), min(lp.y, sz.y - lp.y));
    gid = anchor + (horiz ? vec2(0.) : vec2(.5, .5));
  } else {
    vec2 B = floor(p / 2.), f = p - B * 2.;
    bool horiz = mod(B.x + B.y, 2.) < .5;
    float k = horiz ? floor(f.y) : floor(f.x);
    vec2 bl = horiz ? vec2(0., k) : vec2(k, 0.), sz = horiz ? vec2(2., 1.) : vec2(1., 2.);
    vec2 lp = f - bl;
    gedge = min(min(lp.x, sz.x - lp.x), min(lp.y, sz.y - lp.y));
    gid = B * 4. + bl + (horiz ? vec2(0.) : vec2(.5, .5));
    gshade = horiz ? 1. : .86;
  }
}
vec4 fx(vec2 uv){
  vec2 c = rot(radians(p_angle)) * centered(uv);
  vec2 p = c * p_size + 40.;
  tiling(p, int(p_pattern + .5));
  float h0 = hash12(gid * 1.31 + 3.7);
  float S = float(int(p_shuffle + .5));
  float st = S > .5 ? mod(floor(uLoop * S + h0), S) : 0.;
  float h = hash12(gid + st * vec2(7.13, 3.7) + 11.1);
  int n = int(p_colours + .5);
  float k = floor(min(h * float(n), float(n) - .001));
  vec3 col = k < .5 ? p_c1 : (k < 1.5 ? p_c2 : (k < 2.5 ? p_c3 : p_c4));
  if (int(p_pattern + .5) != 5) col *= 1. + (hash12(gid * 2.7 + 5.) - .5) * p_tone * 2.;
  else col *= 1. + (hash12(gid * 2.7 + 5.) - .5) * p_tone;
  col *= gshade;
  float aa = fwidth(gedge) * .8 + .0008;
  float hw = p_gap * .5;
  col *= 1. - p_bevel * .55 * (1. - smoothstep(hw, hw + .22, gedge));
  col *= 1. + (hash12(floor(uv * uRes)) - .5) * p_grain;
  float m = smoothstep(hw - aa, hw + aa, gedge);
  if (p_gap <= 0.) m = 1.;
  return vec4(mix(p_bg, clamp(col, 0., 1.), m), 1.);
}` });

const TILING_GLSL = FX.byId['gen-tiling'].fs.split('vec4 fx(')[0];

/* ---- Ridge lines ---- */
FX.register({ id:'gen-ridges', name:'Ridge lines', cat:'generator', search:['joy division', 'unknown pleasures', 'waveform', 'signal', 'lines', 'pulsar'],
  desc:'Rows of lines that rise into peaks and hide the ones behind. The peaks come from noise, from image A, or both. Loops seamlessly.',
  params:[ S('source','Peaks from',['Noise','Image A','Noise and image A'],0), I('lines','Lines',46,10,110), R('height','Peak height',.16,.02,.4), R('rough','Roughness',1,.3,3), R('focus','Peak zone',.85,0,1), R('weight','Line weight',.75,.2,2.5), R('move','Movement',1,0,3), T('grad','Blend to accent down the frame',false), C('bg','Ground','#141516','ground'), C('ink','Line','#efece4','ink'), C('accent','Accent','#ff5a36','accent'), C('fill','Fill under lines','#141516','ground') ],
  fs:`float heightAt(float x, float k, float yb){
  int m = int(p_source + .5);
  float env = 1. - pow(abs(2. * x - 1.), 2.4 - p_focus * 1.4);
  env = mix(1., env, p_focus);
  float hn = 0.;
  if (m != 1){
    vec2 circ = vec2(cos(uLoop * TAU), sin(uLoop * TAU)) * p_move;
    float n = vnoise(vec2(x * 4.3 * p_rough, k * .55) + circ) * .62 + vnoise(vec2(x * 11. * p_rough, k * .9 + 7.) + circ * 1.7) * .38;
    hn = pow(clamp((n - .28) / .6, 0., 1.), 2.);
    hn *= env;
  }
  if (m != 0){
    float a = luma(texture(uA, vec2(x, clamp(yb, 0., 1.))).rgb);
    hn = m == 1 ? a * a : hn * .55 + a * a * .9;
  }
  return hn;
}
vec4 fx(vec2 uv){
  float N = float(int(p_lines + .5));
  float yTop = .9 - p_height * .3, yBot = .07;
  float sp = (yTop - yBot) / (N - 1.);
  float th = p_weight * sp * .16;
  float y = uv.y, aa = 1.3 / uRes.y;
  vec3 col = p_bg;
  float kstart = min(N - 1., floor((yTop - (y - p_height)) / sp));
  for (int i = 0; i < 60; i++){
    float k = kstart - float(i);
    if (k < 0.) break;
    float yb = yTop - k * sp;
    float yc = yb + heightAt(uv.x, k, yb) * p_height;
    if (y < yc + th){
      vec3 lc = p_grad > .5 ? mix(p_ink, p_accent, k / (N - 1.)) : p_ink;
      col = mix(p_fill, lc, 1. - smoothstep(th - aa, th + aa, abs(y - yc)));
      break;
    }
  }
  return vec4(col, 1.);
}` });

/* ---- Topography ---- */
FX.register({ id:'gen-topo', name:'Topography', cat:'generator', search:['map', 'contour', 'terrain', 'elevation', 'lines'],
  desc:'A survey map of an invented landscape: contour lines with heavier index lines, tinted heights, a shoreline and light hill shading. Loops seamlessly.',
  params:[ S('style','Style',['Tinted map','Flat bands','Lines only'],0), I('contours','Contours',16,4,40), R('scale','Scale',1.6,.5,5), R('warp','Warp',.5,0,1.5), R('sea','Sea level',.2,0,.6), R('shade','Hill shading',.35,0,1), R('weight','Line weight',1,.3,2.5), R('move','Movement',.6,0,2), C('bg','Low ground','#efece4','ground'), C('hi','High ground','#ff5a36','accent'), C('sea_c','Sea','#2b3a8f','accent2'), C('ink','Lines','#141516','ink') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv) * p_scale + 7.3;
  vec2 o = vec2(cos(uLoop * TAU), sin(uLoop * TAU)) * p_move * .5;
  vec2 w = vec2(fbm(c * .8 + o + 3.1), fbm(c * .8 - o + 7.7));
  float h = fbm(c + (w - .5) * p_warp * 3. + o);
  float hn = clamp((h - .26) / .5, 0., 1.);
  float x = hn * float(int(p_contours + .5));
  float fl = floor(x), fr = fract(x);
  float dx = max(fwidth(x), 1e-4);
  float line = 1. - smoothstep(0., 1., min(fr, 1. - fr) / dx / (p_weight * .9) - .3);
  float idx = mod(floor(x + .5), 5.) < .5 ? 1. : 0.;
  float line2 = 1. - smoothstep(0., 1., min(fr, 1. - fr) / dx / (p_weight * 1.9) - .3);
  line = max(line * .8, line2 * idx);
  int st = int(p_style + .5);
  float k = clamp((hn - p_sea) / max(1. - p_sea, .01), 0., 1.);
  vec3 col = p_bg;
  if (st == 0) col = mix(p_bg, p_hi, k * k * .9 + k * .1);
  else if (st == 1){ float n = float(int(p_contours + .5)); col = mix(p_bg, p_hi, floor(k * n) / n); }
  float shore = 1. - smoothstep(0., 1., abs(hn - p_sea) / (dx / float(int(p_contours + .5))) / (p_weight * .9) - .3);
  if (st != 2){
    if (hn < p_sea) col = mix(p_sea_c, p_sea_c * .6 + p_bg * .2, hn / max(p_sea, .01));
    vec2 g = vec2(dFdx(hn), dFdy(hn)) / max(fwidth(hn), 1e-5);
    float lit = dot(normalize(g + 1e-5), normalize(vec2(-.7, .7))) * clamp(length(g) * .3, 0., 1.);
    if (hn >= p_sea) col += lit * p_shade * .14;
  }
  if (hn < p_sea) line = 0.;
  col = mix(col, p_ink, max(line, shore));
  return vec4(col, 1.);
}` });

/* ---- Screened gradient ---- */
FX.register({ id:'gen-screen', name:'Screened gradient', cat:'generator', search:['halftone', 'gradient', 'dots', 'lines', 'print', 'stripe'],
  desc:'A gradient built entirely from a print screen: dots, lines, squares, diamonds or crosses that swell and shrink across the frame. Loops seamlessly.',
  params:[ S('type','Gradient',['Linear','Radial','Conic','Wave','Noise'],0), S('shape','Mark',['Dots','Lines','Squares','Diamonds','Crosses'],0), R('cells','Screen size',34,8,120,1), R('angle','Screen angle',45,-90,90,1), R('dir','Gradient direction',90,-180,180,1), R('repeat','Repeats',1,.5,6), I('speed','Loops per cycle',1,0,4), R('contrast','Contrast',1.2,.4,3), R('soft','Softness',0,0,1), T('stagger','Stagger rows',false), T('colour','Colour follows tone',false), C('bg','Ground','#141516','ground'), C('ink','Ink','#efece4','ink'), C('accent','Accent','#ff5a36','accent') ],
  fs:`float cov(vec2 f, float v, int shape, float aa){
  v = clamp(v, 0., 1.);
  if (v <= .002) return 0.;
  if (shape == 0){
    if (v < .5){ float r = sqrt(v / PI); return 1. - smoothstep(r - aa, r + aa, length(f - .5)); }
    float r = sqrt((1. - v) / PI); return smoothstep(r - aa, r + aa, length(abs(f - .5) - .5));
  }
  if (shape == 1){ return max(1. - smoothstep(v * .5 - aa, v * .5 + aa, abs(f.y - .5)), smoothstep(.94, 1., v)); }
  if (shape == 2){ float r = sqrt(v) * .5; return 1. - smoothstep(r - aa, r + aa, max(abs(f.x - .5), abs(f.y - .5))); }
  if (shape == 3){ float r = sqrt(v) * .7071; return 1. - smoothstep(r - aa, r + aa, abs(f.x - .5) + abs(f.y - .5)); }
  vec2 q = abs(f - .5); float w = v * .5;
  return 1. - smoothstep(w - aa, w + aa, min(q.x, q.y));
}
float field(vec2 c){
  int t = int(p_type + .5);
  float a = radians(p_dir);
  float base;
  if (t == 0) base = dot(c, vec2(cos(a), sin(a))) * .5 + .5;
  else if (t == 1) base = length(c) * 1.2;
  else if (t == 2) base = atan(c.y, c.x) / TAU + .5;
  else if (t == 3) return .5 + .5 * sin(dot(c, vec2(cos(a), sin(a))) * 3. * p_repeat + uLoop * TAU * p_speed);
  else { vec2 o = vec2(cos(uLoop * TAU), sin(uLoop * TAU)) * float(int(p_speed + .5)) * .35; return clamp((fbm(c * 1.6 * p_repeat + o + 4.) - .25) * 2., 0., 1.); }
  float ph = fract(base * p_repeat * .5 + uLoop * p_speed);
  return 1. - abs(ph * 2. - 1.);
}
vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float ca = radians(p_angle);
  vec2 g = rot(ca) * c * p_cells;
  if (p_stagger > .5) g.x += .5 * mod(floor(g.y), 2.);
  vec2 cellc = floor(g) + .5;
  if (p_stagger > .5) cellc.x -= .5 * mod(floor(g.y), 2.);
  vec2 cc = rot(-ca) * cellc / p_cells;
  float v = clamp((field(cc) - .5) * p_contrast + .5, 0., 1.);
  float aa = length(fwidth(g)) * .7 + .001 + p_soft * .35;
  float m = cov(fract(g), v, int(p_shape + .5), aa);
  vec3 ink = p_colour > .5 ? mix(p_ink, p_accent, v) : p_ink;
  return vec4(mix(p_bg, ink, m), 1.);
}` });

/* ---- Gel ---- */
FX.register({ id:'gen-gel', name:'Gel blobs', cat:'generator', search:['jelly', 'glass', 'liquid', 'metaball', 'lit', 'soft', '3d', 'blob'],
  desc:'Soft lit blobs that merge like gel, with a glossy highlight, a glowing rim and a shadow on the ground. Loops seamlessly.',
  params:[ I('count','Blobs',7,2,12), R('size','Size',.1,.04,.3), R('travel','Travel',.34,0,.7), I('speed','Loops per cycle',1,0,4), R('merge','Gooeyness',.55,.1,1), R('gloss','Gloss',.8,0,1.5), R('light','Light direction',125,-180,180,1), R('glow','Rim glow',.6,0,1.5), R('shadow','Shadow',.5,0,1), C('bg','Ground','#141516','ground'), C('c1','Gel','#ff5a36','accent'), C('c2','Inner light','#ffb27a','accent2'), C('hi','Highlight','#fff4e6','ink') ],
  fs:`vec3 field(vec2 p){
  float f = 0.; vec2 grad = vec2(0.);
  int n = int(p_count + .5);
  float gs = mix(1.15, 1.9, p_merge);
  for (int i = 0; i < 12; i++){
    if (i >= n) break;
    float fi = float(i);
    vec2 h = hash22(vec2(fi, 5.3));
    float cyc = floor(1. + h.x * 2.);
    float a = uLoop * TAU * p_speed * cyc + h.y * TAU;
    vec2 c = vec2(cos(a + fi), sin(a * 2. + fi * 1.7)) * p_travel * (.4 + h.x * .7);
    float r = p_size * (.55 + h.y * .8) * gs;
    vec2 d = p - c;
    float q = dot(d, d) / (r * r);
    if (q < 1.){
      float w = (1. - q); w = w * w * w;
      f += w; grad += -6. * (1. - q) * (1. - q) / (r * r) * d;
    }
  }
  return vec3(f, grad);
}
vec4 fx(vec2 uv){
  vec2 p = centered(uv);
  vec3 fv = field(p); float f = fv.x; vec2 g = fv.yz;
  float t = .28;
  float z = sqrt(max(f - t, 0.));
  vec3 col = p_bg * (1. - .25 * length(p)) ;
  /* shadow on the ground, offset away from the light */
  float la = radians(p_light);
  vec2 ld = vec2(cos(la), sin(la));
  float fs = field(p + ld * .05).x;
  col *= 1. - p_shadow * .55 * smoothstep(t * .3, t * 1.8, fs) * (1. - smoothstep(t, t + .1, f));
  /* glow around the gel */
  col += p_c1 * .35 * p_glow * smoothstep(.02, t, f) * (1. - smoothstep(t, t + .06, f));
  if (f > t){
    vec2 gz = g / (2. * max(z, .04));
    vec3 n = normalize(vec3(-gz * .16, 1.));
    vec3 L = normalize(vec3(ld * .6, .8));
    float diff = clamp(dot(n, L) * .5 + .5, 0., 1.);
    vec3 base = mix(p_c1 * .55, p_c2, clamp(z * 1.6, 0., 1.));
    vec3 c = base * (.45 + .75 * diff);
    float rim = pow(1. - clamp(n.z, 0., 1.), 2.5);
    c += p_c2 * rim * p_glow * .9;
    vec3 H = normalize(L + vec3(0., 0., 1.));
    c += p_hi * pow(clamp(dot(n, H), 0., 1.), 60. - p_gloss * 30.) * p_gloss;
    float edge = smoothstep(t, t + .015, f);
    col = mix(col, c, edge);
  }
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Material ---- */
FX.register({ id:'gen-material', name:'Material', cat:'generator', search:['wood', 'marble', 'terrazzo', 'paper', 'clouds', 'texture', 'stone', 'surface'],
  desc:'A flat, designed surface: wood grain, marble veining, terrazzo chips, handmade paper or soft clouds, coloured from the brand palette. Loops seamlessly.',
  params:[ S('kind','Material',['Marble','Terrazzo','Wood','Paper','Clouds'],0), R('scale','Scale',1,.3,4), R('warp','Warp',1,0,2.5), R('contrast','Contrast',1,.3,2), R('angle','Angle',30,-90,90,1), R('move','Movement',.5,0,2), R('grain','Grain',.06,0,.3), C('c1','Base','#efece4','ground'), C('c2','Dark','#141516','ink'), C('c3','Accent','#ff5a36','accent'), C('c4','Accent 2','#2b3a8f','accent2') ],
  fs:`vec3 marble(vec2 q, vec2 o){
  float n = fbm(q * .9 + o) * p_warp * 3.6;
  float v = q.x * .6 + q.y * .35 + n;
  float w = 1. - abs(sin(v * 2.3));
  float mask = smoothstep(.15, .55, fbm(q * .8 + o * .6 + 9.));
  float soft = pow(w, 4.) * .4;
  float sharp = pow(w, 26.) * (.4 + .6 * fbm(q * 3. + 2.));
  float w2 = 1. - abs(sin(v * 5.1 + fbm(q * 2. + o) * 5.));
  float thin = pow(w2, 30.) * .55 * smoothstep(.35, .8, fbm(q * 1.3 + 4.));
  float cloud = fbm(q * .7 + 3.);
  vec3 col = mix(p_c1, p_c4, smoothstep(.35, .8, cloud) * .22);
  col = mix(col, p_c3, smoothstep(.55, .9, fbm(q * .9 + o + 9.)) * .18);
  float d = clamp((soft * mask + sharp * mask + thin) * p_contrast, 0., 1.);
  return mix(col, p_c2, d);
}
vec3 terrazzo(vec2 q, vec2 o){
  vec3 col = p_c1 * (.96 + .08 * fbm(q * 4.));
  for (int layer = 0; layer < 2; layer++){
    float sc = layer == 0 ? 1.3 : 4.2;
    vec2 g = q * sc + float(layer) * 11.;
    vec2 ip = floor(g), fp = fract(g);
    float best = 3.; vec3 bc = col;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
      vec2 gc = vec2(i, j);
      vec2 h = hash22(ip + gc + float(layer) * 3.7);
      vec2 pt = gc + .2 + h * .6;
      vec2 d = fp - pt;
      float hh = hash12(ip + gc + 21. + float(layer));
      if (hh < (layer == 0 ? .22 : .45)) continue;
      float ang = atan(d.y, d.x);
      float pn = 4. + floor(hh * 4.);
      float a2 = mod(ang + hh * 40., TAU / pn) - PI / pn;
      float rr = (layer == 0 ? .36 : .17) * (.5 + hh * .8) * (cos(PI / pn) / cos(a2)) * .9;
      float e = length(d) / rr;
      if (e < best){
        best = e;
        float ci = fract(hh * 7.31);
        vec3 chip = ci < .3 ? p_c2 : (ci < .55 ? p_c3 : (ci < .8 ? p_c4 : mix(p_c1, p_c2, .35)));
        bc = chip * (.9 + .2 * hash12(ip + gc + 5.));
      }
    }
    float aa = fwidth(best) * .9 + .01;
    col = mix(col, bc, (1. - smoothstep(1. - aa, 1. + aa, best)) * mix(1., .9, p_contrast * .0));
  }
  return col;
}
vec3 wood(vec2 q, vec2 o){
  float n = fbm(vec2(q.x * .6, q.y * .22) + o + 3.) * 2.4 * p_warp;
  float r = length(vec2(q.x + 3., q.y * .1)) + n * .6;
  float ring = fract(r * 3.4);
  float late = smoothstep(.5, .96, ring) * (1. - smoothstep(.96, 1., ring));
  float streak = vnoise(vec2(q.x * 38., q.y * 1.1) + o * .3);
  float pore = step(.86, vnoise(vec2(q.x * 60., q.y * 6.))) * .35;
  vec3 col = mix(p_c1, mix(p_c1, p_c3, .55), late * .8);
  col = mix(col, p_c2, clamp((late * .45 + (streak - .5) * .35 + pore * .5) * p_contrast, 0., 1.) * .8);
  return col;
}
vec3 paper(vec2 q, vec2 o){
  vec3 col = p_c1;
  vec2 wq = q + (vec2(fbm(q * 2.), fbm(q * 2. + 3.)) - .5) * .9;
  float f1 = vnoise(rot(.4) * wq * vec2(60., 4.));
  float f2 = vnoise(rot(-.9) * wq * vec2(45., 3.) + 5.);
  float fib = smoothstep(.55, .95, f1) + smoothstep(.6, .95, f2) * .8;
  float blotch = fbm(q * .8 + o) - .5;
  col *= 1. + blotch * .16 * p_warp + (f1 - .5) * .06;
  col = mix(col, mix(p_c1, p_c2, .45), clamp(fib * .3 * p_contrast, 0., 1.));
  float fleck = step(.9965, hash12(floor(q * 85.))) * (.4 + .6 * hash12(floor(q * 85.) + 3.));
  col = mix(col, p_c3, fleck * .6);
  float speck = step(.9985, hash12(floor(q * 140.) + 9.));
  return mix(col, p_c2, speck * .7);
}
vec3 clouds(vec2 q, vec2 o){
  float a = fbm(q * .9 + o);
  float b = fbm(q * .9 + a * 2.2 * p_warp + o.yx + 5.);
  float c = smoothstep(.3, .78, b);
  vec3 col = mix(p_c1, p_c4, c * .85 * p_contrast);
  col = mix(col, p_c3, smoothstep(.5, .85, a) * c * .8);
  col = mix(col, p_c2, smoothstep(.62, .95, b) * .35 * p_contrast);
  return col;
}
vec4 fx(vec2 uv){
  int k = int(p_kind + .5);
  float sf = k == 0 ? 2.4 : (k == 1 ? 6. : (k == 2 ? 3.2 : (k == 3 ? 2.4 : 1.6)));
  vec2 q = rot(radians(p_angle)) * centered(uv) * p_scale * sf + 5.;
  vec2 o = vec2(cos(uLoop * TAU), sin(uLoop * TAU)) * p_move * .5;
  vec3 col = k == 0 ? marble(q, o) : (k == 1 ? terrazzo(q, o) : (k == 2 ? wood(q, o) : (k == 3 ? paper(q, o) : clouds(q, o))));
  col *= 1. + (hash12(floor(uv * uRes) + .5) - .5) * p_grain;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Guilloche ---- */
FX.register({ id:'gen-guilloche', name:'Guilloche', cat:'generator', search:['banknote', 'currency', 'rosette', 'spirograph', 'security', 'lines', 'moire'],
  desc:'Banknote-style engine turning: fine lines that ripple through each other into rosettes, waves or a woven lattice. Loops seamlessly.',
  params:[ S('mode','Pattern',['Rosette','Waves','Lattice'],0), R('density','Line density',42,16,140,1), I('lobes','Lobes',8,2,40), R('amp','Ripple',3.2,0,12), R('twist','Twist',.35,0,1.6), R('weight','Line weight',.42,.15,.9), I('turns','Turns per loop',1,0,3), S('colour','Colour',['Ink','Ink to accent','Split fountain'],1), C('bg','Ground','#141516','ground'), C('ink','Ink','#efece4','ink'), C('accent','Accent','#ff5a36','accent'), C('accent2','Accent 2','#2b3a8f','accent2') ],
  fs:`float waveSet(vec2 c, int m, float ph, float N){
  float s;
  if (m == 0){
    float r = length(c), th = atan(c.y, c.x);
    float A = p_amp * smoothstep(0., .3, r);
    s = r * N;
    for (int i = 0; i < 3; i++) s = r * N - A * sin(p_lobes * th + ph + s * p_twist);
  } else {
    s = c.y * N;
    float fr = p_lobes * 1.5;
    for (int i = 0; i < 3; i++) s = c.y * N - p_amp * sin(c.x * fr + ph + s * p_twist);
  }
  return s;
}
vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  int m = int(p_mode + .5);
  float ph = uLoop * TAU * float(int(p_turns + .5));
  float N = p_density;
  float ink;
  float aa0;
  {
    float s = waveSet(m == 2 ? rot(.5) * c : c, m == 2 ? 1 : m, ph, N);
    float w = p_weight * .5, aa = fwidth(s) * .7 + .002;
    ink = 1. - smoothstep(w - aa, w + aa, abs(fract(s) - .5));
    if (m == 2){
      float s2 = waveSet(rot(-.5) * c, 1, -ph, N);
      float aa2 = fwidth(s2) * .7 + .002;
      ink = max(ink, 1. - smoothstep(w - aa2, w + aa2, abs(fract(s2) - .5)));
    }
  }
  int cm = int(p_colour + .5);
  vec3 lc = p_ink;
  if (cm == 1) lc = mix(p_ink, p_accent, smoothstep(.0, .75, length(c)));
  else if (cm == 2){ float y = uv.y; lc = y > .66 ? mix(p_accent, p_ink, smoothstep(.66, .78, y)) : (y > .33 ? mix(p_accent2, p_accent, smoothstep(.33, .45, y)) : p_accent2); lc = mix(lc, p_ink, smoothstep(.0, .12, .12 - y) * .0); }
  return vec4(mix(p_bg, lc, ink), 1.);
}` });

/* ---- Fluted glass wipe ---- */
FX.register({ id:'tr-reeded', name:'Reeded glass', cat:'transition', search:['fluted', 'ribbed', 'glass', 'wipe', 'refraction'],
  desc:'A band of reeded glass sweeps across. A shows through the ribs ahead of it and B behind it, each rib bending the picture as it passes.',
  params:[ R('dir','Wipe direction',0,-180,180,1), R('angle','Rib angle',90,-90,180,1), R('count','Ribs',34,6,120,1), R('band','Glass width',.4,.08,1), R('strength','Bend',.05,0,.2), R('chroma','Colour split',.4,0,1.5), R('shine','Shine',.5,0,1.5), R('stagger','Rib lag',.5,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float wa = radians(p_dir), fa = radians(p_angle);
  vec2 wd = vec2(cos(wa), sin(wa)), fn = vec2(-sin(fa), cos(fa));
  float ext = abs(wd.x) * aspect() * .5 + abs(wd.y) * .5;
  float s = mix(-ext - p_band, ext + p_band, uProgress);
  float d = dot(c, wd) - s;
  float f = fract(dot(c, fn) * p_count) - .5;
  float g = 1. - smoothstep(0., p_band, abs(d));
  g *= g * (3. - 2. * g);
  vec2 off = fn / vec2(aspect(), 1.) * (-f) * p_strength * g * 2.;
  float m = smoothstep(-.004, .004, -(d + f * p_band * p_stagger));
  vec2 co = off * p_chroma * .6;
  vec3 A = vec3(texture(uA, uv + off + co).r, texture(uA, uv + off).g, texture(uA, uv + off - co).b);
  vec3 B = vec3(texture(uB, uv + off + co).r, texture(uB, uv + off).g, texture(uB, uv + off - co).b);
  vec3 col = mix(A, B, m);
  float rib = pow(abs(f) * 2., 7.);
  col *= 1. - g * rib * .35;
  col += g * p_shine * .22 * pow(smoothstep(.05, .45, f), 3.) * (1. - pow(abs(f) * 2., 6.));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Dither reveal ---- */
FX.register({ id:'tr-screenreveal', name:'Screen reveal', cat:'transition', search:['dither', 'halftone', 'bayer', 'dissolve', 'pixel', 'threshold', 'ordered'],
  desc:'B arrives through a fixed dither or print screen: ordered dots, noise, lines or diamonds switch over in strict pattern, optionally following the tones of B.',
  params:[ S('pattern','Screen',['Bayer','Fine noise','Halftone dots','Lines','Diamonds'],0), R('pixel','Pixel size',5,1,24,1), R('follow','Follow the tones of B',0,0,1), R('sweep','Sweep',.4,0,1.5), R('dir','Sweep direction',0,-180,180,1), R('edge','Edge line',0,0,1), C('edgeColor','Edge colour','#ff5a36','accent') ],
  fs:`float pat(vec2 gp, int k){
  if (k == 0) return (bayer8(gp) * 64. + .5) / 64.;
  if (k == 1) return fract(52.9829189 * fract(dot(gp, vec2(.06711056, .00583715))));
  vec2 f = fract(rot(.7854) * gp / 7.);
  if (k == 2) return clamp(length(f - .5) * 1.4142, 0., 1.);
  if (k == 3) return abs(fract(gp.y / 6.) - .5) * 2.;
  return clamp(abs(fract(gp.x / 8.) - .5) + abs(fract(gp.y / 8.) - .5), 0., 1.) * 1.;
}
vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float H = 1080. / p_pixel;
  vec2 cells = vec2(floor(H * aspect()), floor(H));
  vec2 gp = floor(uv * cells);
  vec2 cuv = (gp + .5) / cells;
  vec3 A = texture(uA, cuv).rgb, B = texture(uB, cuv).rgb;
  float th = pat(gp, int(p_pattern + .5));
  th = mix(th, 1. - luma(B), p_follow);
  float a = radians(p_dir);
  float ext = abs(cos(a)) * aspect() * .5 + abs(sin(a)) * .5;
  float pos = dot(c, vec2(cos(a), sin(a))) / (2. * ext) + .5;
  float lim = uProgress * (1. + p_sweep) - pos * p_sweep;
  float m = step(th, lim);
  vec3 col = mix(A, B, m);
  float near = 1. - smoothstep(0., .07, abs(th - lim));
  col = mix(col, p_edgeColor, near * p_edge * step(.001, uProgress) * step(uProgress, .999));
  return vec4(col, 1.);
}` });

/* ---- Displacement swap ---- */
FX.register({ id:'tr-morph', name:'Melt through', cat:'transition', search:['displace', 'liquid', 'swap', 'warp', 'smear', 'morph'],
  desc:'Each image is pushed around by the brightness of the other while they trade places, so highlights of B drag A away with them.',
  params:[ S('mode','Push',['One direction','Outward','Twist'],0), R('dir','Direction',90,-180,180,1), R('amount','Amount',.25,0,.8), I('taps','Smoothness',10,1,24), R('curve','Contrast',1.4,.4,3), R('hold','Cross-over',.5,.2,.8) ],
  fs:`vec2 pushDir(vec2 c, int m){
  if (m == 0){ float a = radians(p_dir); return vec2(cos(a), sin(a)); }
  if (m == 1) return normalize(c + 1e-4);
  return vec2(-c.y, c.x) / max(length(c), .05) * .6;
}
vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float k = uProgress;
  vec2 dir = pushDir(c, int(p_mode + .5)) / vec2(aspect(), 1.);
  vec3 A = vec3(0.), B = vec3(0.);
  float la = (pow(luma(texture(uA, uv).rgb), p_curve) - .5), lb = (pow(luma(texture(uB, uv).rgb), p_curve) - .5);
  int n = int(p_taps + .5);
  for (int i = 0; i < 24; i++){
    if (i >= n) break;
    float t = (float(i) + .5) / float(n);
    vec2 pa = uv + dir * lb * p_amount * 2. * k * t;
    vec2 pb = uv - dir * la * p_amount * 2. * (1. - k) * t;
    A += texture(uA, clamp(pa, 0., 1.)).rgb;
    B += texture(uB, clamp(pb, 0., 1.)).rgb;
  }
  A /= float(n); B /= float(n);
  float m = smoothstep(p_hold - .25, p_hold + .25, k);
  return vec4(mix(A, B, m), 1.);
}` });

/* ---- Ink bleed ---- */
FX.register({ id:'tr-bleed', name:'Ink bleed', cat:'transition', search:['ink', 'spread', 'stain', 'organic', 'reveal', 'watercolour', 'blot'],
  desc:'B seeps in from a few points like ink into paper, with a ragged edge and a darker rim where the ink has pooled.',
  params:[ I('seeds','Drops',4,1,9), R('rough','Ragged edge',.55,0,1.5), R('rim','Ink rim',.6,0,1.5), R('rimWidth','Rim width',.02,.004,.08), R('soak','Soak',.3,0,1), I('seed','Seed',3,1,99), C('ink','Rim ink','#141516','ink') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float d = 9.;
  int n = int(p_seeds + .5);
  for (int i = 0; i < 9; i++){
    if (i >= n) break;
    vec2 h = hash22(vec2(float(i) + p_seed * 7.7, 1.3));
    vec2 sp = (h - .5) * vec2(aspect() * .9, .9);
    float w = .8 + .5 * hash12(vec2(float(i), p_seed));
    d = min(d, length(c - sp) * w);
  }
  float nz = fbm(c * 5. + p_seed) - .5;
  float nz2 = fbm(c * 17. + 3.) - .5;
  d += nz * p_rough * .5 + nz2 * p_rough * .12;
  float R = uProgress * 1.35;
  float e = d - R;
  float inside = 1. - smoothstep(-.012 - p_soak * .04, .004, e);
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 col = mix(A, B, inside);
  float rim = exp(-pow(e / p_rimWidth, 2.)) * (.6 + .8 * (nz2 + .5));
  float wet = (1. - smoothstep(0., p_rimWidth * 4., e)) * step(0., e) * .0;
  col = mix(col, p_ink, clamp(rim * p_rim, 0., 1.) * step(.001, uProgress) * (1. - smoothstep(.9, 1., uProgress)));
  return vec4(col, 1.);
}` });

/* ---- Cell mix ---- */
FX.register({ id:'mx-cellmix', name:'Cell mix', cat:'mix', search:['mosaic', 'tiles', 'random', 'brick', 'hexagon', 'combine', 'checker'],
  desc:'A and B share the frame cell by cell — bricks, hexagons, triangles, herringbone or weave — with a chosen share going to B. Cells can reshuffle on a loop.',
  params:[ S('pattern','Cells',['Bricks','Hexagons','Triangles','Herringbone','Basketweave'],1), R('size','Cell size',6,2,24), R('share','Share of B',.5,0,1), R('gap','Gap',.03,0,.3), R('angle','Angle',0,-90,90,1), I('shuffle','Reshuffles per loop',0,0,6), S('other','Other cells',['Image A','A, darkened','Colour'],0), C('bg','Gap','#141516','ground'), C('fill','Colour','#ff5a36','accent') ],
  fs:TILING_GLSL + `vec4 fx(vec2 uv){
  vec2 c = rot(radians(p_angle)) * centered(uv);
  tiling(c * p_size + 40., int(p_pattern + .5));
  float h0 = hash12(gid * 1.31 + 3.7);
  float S = float(int(p_shuffle + .5));
  float st = S > .5 ? mod(floor(uLoop * S + h0), S) : 0.;
  float h = hash12(gid + st * vec2(7.13, 3.7) + 11.1);
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  int o = int(p_other + .5);
  vec3 other = o == 0 ? A : (o == 1 ? A * .35 : p_fill);
  vec3 col = h < p_share ? B : other;
  float aa = fwidth(gedge) * .8 + .0008;
  float m = p_gap <= 0. ? 1. : smoothstep(p_gap * .5 - aa, p_gap * .5 + aa, gedge);
  return vec4(mix(p_bg, col, m), 1.);
}` });

/* ---- Lenticular ---- */
FX.register({ id:'mx-lenticular', name:'Lenticular', cat:'mix', search:['lenticular', 'strips', 'flip', 'parallax', 'interlace', 'slats'],
  desc:'A and B interleaved in fine strips under a lens, as on a lenticular print. Tilting on the loop swings one image into the other. Loops seamlessly.',
  params:[ R('count','Strips',52,8,200,1), R('angle','Strip angle',0,-90,180,1), I('speed','Tilts per loop',1,0,4), R('tilt','Tilt range',.5,0,1), R('lens','Lens stretch',.5,0,1), R('edge','Strip edge',.3,0,1), R('soft','Softness',.15,.02,.5) ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float a = radians(p_angle);
  vec2 n = vec2(cos(a), sin(a));
  float u = dot(c, n) * p_count;
  float ph = .5 + .5 * sin(uLoop * TAU * p_speed) * p_tilt * 2. ;
  ph = clamp(ph, 0., 1.);
  float cell = floor(u), f = fract(u);
  /* each strip is a lens: what it shows shifts across the strip, and stretches toward the split */
  float split = ph;
  float mB = smoothstep(split - p_soft, split + p_soft, f);
  vec2 off = n / vec2(aspect(), 1.) * ((f - .5) * p_lens * .8 / p_count);
  vec3 A = texture(uA, uv - off * (1. - mB)).rgb, B = texture(uB, uv + off * mB).rgb;
  vec3 col = mix(B, A, mB);
  float e = pow(abs(f - .5) * 2., 6.);
  col *= 1. - e * p_edge * .3;
  col += (1. - smoothstep(0., .1, abs(f - split))) * p_edge * .05;
  return vec4(col, 1.);
}` });

/* ---- Fluted glass ---- */
FX.register({ id:'fx-fluted', name:'Fluted glass', cat:'fx', nonLocal:true, search:['reeded', 'ribbed', 'glass', 'refraction', 'lens', 'pane', 'distort'],
  desc:'The frame seen through moulded glass: fluted ribs, rippled waves, diamond panes or hex bubbles, with a colour fringe and a highlight on each rib.',
  params:[ S('kind','Glass',['Fluted','Rippled','Diamond panes','Hex bubbles'],0), R('count','Ribs across',30,6,120,1), R('angle','Angle',0,-90,180,1), R('bend','Bend',.75,0,2), R('chroma','Colour split',.5,0,2), R('frost','Frost',.15,0,1), R('shine','Shine',.55,0,1.5), R('edge','Rib edge',.5,0,1.5), I('slide','Glass slides per loop',0,0,6) ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float a = radians(p_angle);
  vec2 n = vec2(cos(a), sin(a));
  int k = int(p_kind + .5);
  vec2 off = vec2(0.); float edge = 0., hi = 0.;
  if (k == 0){
    float f = fract(dot(c, n) * p_count + uLoop * p_slide) - .5;
    off = -n * f;
    edge = pow(abs(f) * 2., 8.);
    hi = pow(clamp(1. - abs(f - .26) * 7., 0., 1.), 2.);
  } else if (k == 1){
    float u = dot(c, n) * p_count * .5 + uLoop * p_slide * .5;
    off = n * sin(u * TAU) * .5;
    hi = pow(clamp(cos(u * TAU + .6) * .5 + .5, 0., 1.), 8.);
    edge = 0.;
  } else if (k == 2){
    mat2 R = rot(a - 1.5708 + .7854);
    vec2 f = fract(R * c * p_count * .7 + uLoop * p_slide) - .5;
    off = -(transpose(R) * f);
    edge = pow(max(abs(f.x), abs(f.y)) * 2., 8.);
    hi = pow(clamp(1. - abs(f.x + f.y * .5 - .2) * 5., 0., 1.), 2.) * .8;
  } else {
    const vec2 s = vec2(1., 1.7320508);
    vec2 p = rot(a - 1.5708) * c * p_count * .6 + vec2(uLoop * p_slide, 0.);
    vec4 hC = floor(vec4(p, p - vec2(.5, 1.)) / s.xyxy) + .5;
    vec4 h = vec4(p - hC.xy * s, p - (hC.zw + .5) * s);
    vec2 hl = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
    off = -transpose(rot(a - 1.5708)) * hl * 1.6;
    edge = pow(clamp(max(dot(abs(hl), s * .5), abs(hl).x) * 2., 0., 1.), 8.);
    hi = pow(clamp(1. - length(hl - vec2(.12, .16)) * 5., 0., 1.), 2.);
  }
  vec2 d = off / p_count * p_bend / vec2(aspect(), 1.);
  vec2 t = vec2(-n.y, n.x) / vec2(aspect(), 1.) * p_frost * .012;
  vec3 col = vec3(0.);
  for (int i = -2; i <= 2; i++){
    vec2 q = uv + d + t * float(i);
    vec2 cs = d * p_chroma * .18;
    col += vec3(texture(uInput, q + cs).r, texture(uInput, q).g, texture(uInput, q - cs).b);
  }
  col /= 5.;
  col *= 1. - edge * p_edge * .3;
  col += hi * p_shine * .16;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Shards ---- */
FX.register({ id:'fx-shards', name:'Shatter', cat:'fx', nonLocal:true, search:['broken glass', 'fracture', 'crack', 'mirror', 'facets', 'cut'],
  desc:'The frame breaks into shards that each slip and tilt a little, with dark cracks between them. Shards get smaller toward a point of impact.',
  params:[ R('shards','Shards',5,2,14), R('impact','Impact focus',.6,0,1), R('shift','Slip',.03,0,.12), R('tilt','Tilt',.08,0,.4), R('tone','Tone per shard',.25,0,.8), R('crack','Crack width',.05,0,.2), R('move','Movement',.4,0,1), I('seed','Seed',5,1,99), C('crackColor','Cracks','#0b0b0c','ink') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  float r = length(c);
  vec2 cw = c / max(r, 1e-4) * pow(r + .001, .6) * 1.5;
  vec2 pw = mix(c, cw, p_impact);
  vec2 g = pw * p_shards + p_seed * 1.7;
  vec2 ip = floor(g), fp = fract(g);
  float d1 = 9., d2 = 9.; vec2 pt1 = vec2(0.), id1 = vec2(0.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 gc = vec2(i, j);
    vec2 pt = gc + .15 + hash22(ip + gc + 3.1) * .7;
    float d = length(fp - pt);
    if (d < d1){ d2 = d1; d1 = d; pt1 = pt; id1 = ip + gc; } else if (d < d2) d2 = d;
  }
  float e = d2 - d1;
  vec2 v = (fp - pt1) / p_shards / mix(1., .6, p_impact);
  float h = hash12(id1 + 17.), h2 = hash12(id1 + 3.3);
  float mv = 1. + p_move * sin(uLoop * TAU + h * TAU);
  float tl = (h - .5) * 2. * p_tilt * mv;
  vec2 sh = (hash22(id1 + 9.) - .5) * 2. * p_shift * mv;
  vec2 sc = c + (rot(tl) * v - v) + sh;
  vec3 col = texture(uInput, sc / vec2(aspect(), 1.) + .5).rgb;
  col *= 1. + (h2 - .5) * 2. * p_tone * .5;
  float aa = fwidth(e) + .002;
  float w = p_crack * .5;
  float line = 1. - smoothstep(w, w + aa * 1.5, e);
  float glint = (1. - smoothstep(w, w * 4. + aa, e)) * step(.6, h2) * .16;
  col += glint;
  col = mix(col, p_crackColor, line * .92);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Print marks ---- */
FX.register({ id:'ovl-printmarks', name:'Print marks', cat:'overlay', search:['crop marks', 'registration', 'colour bars', 'proof', 'slug', 'trim', 'bleed'],
  desc:'The furniture of a press proof: paper margin, crop marks, registration targets, CMYK colour bars and a grey wedge.',
  params:[ R('margin','Margin',.07,.03,.14), T('band','Paper margin',true), T('crops','Crop marks',true), T('reg','Registration targets',true), T('bars','Colour bars',true), T('wedge','Grey wedge',true), R('line','Line weight',1,.5,3), C('paper','Paper','#f4f1ea','ground'), C('mark','Marks','#141516','ink') ],
  fs:L3.common + `vec3 barColor(int i){
  if (i == 0) return vec3(0., .68, .94);
  if (i == 1) return vec3(.93, 0., .55);
  if (i == 2) return vec3(1., .95, 0.);
  if (i == 3) return vec3(.05);
  if (i == 4) return vec3(.93, .11, .14);
  if (i == 5) return vec3(0., .65, .32);
  return vec3(.18, .19, .6);
}
vec4 fx(vec2 uv){
  vec3 col = texture(uInput, uv).rgb;
  float A = aspect(), m = p_margin;
  vec2 P = vec2(uv.x * A, uv.y);
  bool inside = P.x > m && P.x < A - m && P.y > m && P.y < 1. - m;
  if (p_band > .5 && !inside) col = p_paper;
  float hw = p_line * .0007, aa = 1.2 / uRes.y;
  float mk = 0.;
  if (p_crops > .5){
    float g = m * .16, L = m * .62;
    for (int i = 0; i < 4; i++){
      float sx = float(i & 1), sy = float(i >> 1);
      vec2 corner = vec2(sx > .5 ? A - m : m, sy > .5 ? 1. - m : m);
      float dx = sx > .5 ? 1. : -1., dy = sy > .5 ? 1. : -1.;
      float d = min(l3seg(P, corner + vec2(dx * g, 0.), corner + vec2(dx * (g + L), 0.)), l3seg(P, corner + vec2(0., dy * g), corner + vec2(0., dy * (g + L))));
      mk = max(mk, 1. - smoothstep(hw, hw + aa, d));
    }
  }
  if (p_reg > .5){
    float r = m * .22;
    for (int i = 0; i < 4; i++){
      vec2 rc = i == 0 ? vec2(A * .5, m * .5) : (i == 1 ? vec2(A * .5, 1. - m * .5) : (i == 2 ? vec2(m * .5, .5) : vec2(A - m * .5, .5)));
      vec2 q = P - rc;
      float ring = abs(length(q) - r);
      float cross = min(abs(q.x) + (abs(q.y) > r * 1.6 ? 9. : 0.), abs(q.y) + (abs(q.x) > r * 1.6 ? 9. : 0.));
      float dot_ = length(q) - r * .28;
      mk = max(mk, 1. - smoothstep(hw, hw + aa, min(ring, cross)));
      mk = max(mk, 1. - smoothstep(0., aa, dot_));
    }
  }
  col = mix(col, p_mark, mk);
  float s = m * .34;
  if (p_bars > .5){
    vec2 q = P - vec2(A * .5 + m * 1.1, m * .5 - s * .5);
    if (q.x > 0. && q.x < s * 7. && q.y > 0. && q.y < s){ col = barColor(int(q.x / s)); }
  }
  if (p_wedge > .5){
    vec2 q = P - vec2(A * .5 + m * 1.1, 1. - m * .5 - s * .5);
    if (q.x > 0. && q.x < s * 8. && q.y > 0. && q.y < s){ col = vec3(float(int(q.x / s)) / 7.); }
    vec2 q2 = P - vec2(A * .5 - m * 1.1 - s * 8., 1. - m * .5 - s * .5);
    if (q2.x > 0. && q2.x < s * 8. && q2.y > 0. && q2.y < s){ col = vec3(1. - float(int(q2.x / s)) / 7.); }
  }
  return vec4(col, 1.);
}` });

/* ---- Screen edge ---- */
FX.register({ id:'ovl-screenedge', name:'Screened edge', cat:'overlay', search:['halftone', 'vignette', 'dots', 'fade', 'border', 'print'],
  desc:'The edges of the frame dissolve into a print screen — dots, lines or squares that thicken toward the border like a halftone vignette.',
  params:[ S('shape','Shape',['Frame','Oval'],1), S('mark','Mark',['Dots','Lines','Squares'],0), R('reach','Reach',.32,.05,.8), R('cells','Screen size',48,12,140,1), R('angle','Angle',45,-90,90,1), R('curve','Falloff',1.2,.4,3), R('soft','Softness',0,0,1), T('clean','Solid at the very edge',false), C('ink','Ink','#141516','ink') ],
  fs:`float cov(vec2 f, float v, int shape, float aa){
  v = clamp(v, 0., 1.);
  if (v <= .002) return 0.;
  if (shape == 0){
    if (v < .5){ float r = sqrt(v / PI); return 1. - smoothstep(r - aa, r + aa, length(f - .5)); }
    float r = sqrt((1. - v) / PI); return smoothstep(r - aa, r + aa, length(abs(f - .5) - .5));
  }
  if (shape == 1) return max(1. - smoothstep(v * .5 - aa, v * .5 + aa, abs(f.y - .5)), smoothstep(.94, 1., v));
  float r = sqrt(v) * .5; return 1. - smoothstep(r - aa, r + aa, max(abs(f.x - .5), abs(f.y - .5)));
}
vec4 fx(vec2 uv){
  vec3 col = texture(uInput, uv).rgb;
  vec2 c = centered(uv);
  float A = aspect();
  float t;
  if (p_shape < .5){
    float d = min(min(uv.x * A, (1. - uv.x) * A), min(uv.y, 1. - uv.y));
    t = 1. - clamp(d / p_reach, 0., 1.);
  } else {
    float r = length(c / vec2(A * .5, .5));
    t = 1. - clamp((1. - r) / (p_reach * 1.6), 0., 1.);
  }
  float v = pow(t, p_curve);
  if (p_clean > .5) v = mix(v, 1., smoothstep(.9, 1., t));
  vec2 g = rot(radians(p_angle)) * c * p_cells;
  float aa = length(fwidth(g)) * .7 + .001 + p_soft * .3;
  float m = cov(fract(g), v, int(p_mark + .5), aa);
  return vec4(mix(col, p_ink, m), 1.);
}` });
