/* ---------------- Treatments (process uInput) ---------------- */
FX.register({ id:'trt-adjust', name:'Adjust', cat:'treatment', desc:'Exposure, contrast, saturation, hue, temperature, posterise, invert.',
  params:[ R('brightness','Brightness',0,-1,1), R('contrast','Contrast',1,0,3), R('saturation','Saturation',1,0,3), R('hue','Hue',0,-180,180,1), R('gamma','Gamma',1,.2,3), R('temp','Temperature',0,-1,1), I('posterize','Posterise',0,0,16), R('invert','Invert',0,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  c = pow(max(c, 0.), vec3(1. / p_gamma));
  c += p_brightness;
  c = (c - .5) * p_contrast + .5;
  vec3 hsv = rgb2hsv(clamp(c, 0., 1.));
  c = hsv2rgb(vec3(fract(hsv.x + p_hue / 360.), clamp(hsv.y * p_saturation, 0., 1.), hsv.z));
  c += vec3(p_temp, p_temp * .2, -p_temp) * .12;
  c = clamp(c, 0., 1.);
  if (p_posterize > 1.5) c = floor(c * (p_posterize - 1.) + .5) / (p_posterize - 1.);
  c = mix(c, 1. - c, p_invert);
  return vec4(c, 1.);
}` });

FX.register({ id:'trt-duotone', name:'Duotone', cat:'treatment', desc:'Map shadows and highlights to two inks.',
  params:[ C('dark','Shadows','#1b1f4a'), C('light','Highlights','#ff8a5c'), R('contrast','Contrast',1.2,0,3), R('bias','Midpoint',0,-.5,.5), R('amount','Amount',1,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  float l = clamp((luma(c) - .5) * p_contrast + .5 + p_bias, 0., 1.);
  return vec4(mix(c, mix(p_dark, p_light, l), p_amount), 1.);
}` });

FX.register({ id:'trt-tritone', name:'Gradient map', cat:'treatment', desc:'Three-stop gradient map across the tonal range.',
  params:[ C('c1','Shadows','#0d0f1a'), C('c2','Mids','#7a3cff'), C('c3','Highlights','#c9f5e4'), R('contrast','Contrast',1,0,3), R('amount','Amount',1,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  float l = clamp((luma(c) - .5) * p_contrast + .5, 0., 1.);
  vec3 g = l < .5 ? mix(p_c1, p_c2, l * 2.) : mix(p_c2, p_c3, l * 2. - 1.);
  return vec4(mix(c, g, p_amount), 1.);
}` });

FX.register({ id:'trt-threshold', name:'Threshold', cat:'treatment', desc:'One-bit cut with softness and noisy edges.',
  params:[ R('level','Level',.5,0,1), R('soft','Softness',.02,0,.3), R('noise','Edge noise',0,0,.5), C('dark','Dark','#0f0f10'), C('light','Light','#efece4') ],
  fs:`vec4 fx(vec2 uv){
  float l = luma(texture(uInput, uv).rgb) + (hash12(uv * uRes) - .5) * p_noise;
  float s = max(p_soft, 1e-3);
  return vec4(mix(p_dark, p_light, smoothstep(p_level - s, p_level + s, l)), 1.);
}` });

FX.register({ id:'trt-dither', name:'Dither', cat:'treatment', desc:'Ordered Bayer or noise dithering at chunky pixel sizes.',
  params:[ R('pixel','Pixel size',3,1,24,1), S('matrix','Pattern',['Bayer 2×2','Bayer 4×4','Bayer 8×8','Noise']), I('levels','Levels',2,2,16), R('contrast','Contrast',1,0,3), T('mono','Two-colour',true), C('dark','Dark','#131313'), C('light','Light','#e8e4d8'), T('animate','Animate noise') ],
  fs:`vec4 fx(vec2 uv){
  float px = max(1., p_pixel);
  vec2 cell = floor(uv * uRes / px);
  vec3 c = texture(uInput, (cell + .5) * px / uRes).rgb;
  c = (c - .5) * p_contrast + .5;
  int m = int(p_matrix + .5);
  float th = m == 0 ? bayer2(cell) : m == 1 ? bayer4(cell) : m == 2 ? bayer8(cell) : hash12(cell + floor(uTime * 12.) * p_animate);
  float lv = max(p_levels - 1., 1.);
  if (p_mono > .5){ float q = floor(luma(c) * lv + th) / lv; return vec4(mix(p_dark, p_light, clamp(q, 0., 1.)), 1.); }
  return vec4(clamp(floor(c * lv + th) / lv, 0., 1.), 1.);
}` });

FX.register({ id:'trt-halftone', name:'Halftone', cat:'treatment', desc:'Screened dots, lines or squares. Mono or CMYK.', search:['print'],
  params:[ R('cell','Cell size',9,3,60,1), R('angle','Angle',45,-90,90,1), S('shape','Shape',['Dot','Line','Square']), R('contrast','Contrast',1.1,0,3), T('cmyk','CMYK'), R('k','Black plate',.35,0,1), C('ink','Ink','#141414'), C('paper','Paper','#f2efe6') ],
  fs:`float ht(vec2 uv, float ang, int ch, int shape){
  vec2 p = rot(ang) * (uv * uRes) / p_cell;
  vec2 id = floor(p) + .5; vec2 f = p - id;
  vec3 c = texture(uInput, (rot(-ang) * (id * p_cell)) / uRes).rgb;
  float v = ch == 0 ? 1. - luma(c) : ch == 1 ? 1. - c.r : ch == 2 ? 1. - c.g : ch == 3 ? 1. - c.b : 1. - max(max(c.r, c.g), c.b);
  v = clamp((v - .5) * p_contrast + .5, 0., 1.);
  float d, r;
  if (shape == 0){ d = length(f); r = sqrt(v) * .7071; }
  else if (shape == 1){ d = abs(f.y); r = v * .5; }
  else { d = max(abs(f.x), abs(f.y)); r = sqrt(v) * .5; }
  float aa = .75 / p_cell;
  return 1. - smoothstep(r - aa, r + aa, d);
}
vec4 fx(vec2 uv){
  float a = radians(p_angle); int s = int(p_shape + .5);
  if (p_cmyk > .5){
    float cc = ht(uv, a + radians(15.), 1, s), mm = ht(uv, a + radians(75.), 2, s), yy = ht(uv, a, 3, s), kk = ht(uv, a + radians(45.), 4, s) * p_k;
    vec3 col = p_paper * vec3(1. - cc, 1. - mm, 1. - yy) * (1. - kk);
    return vec4(col, 1.);
  }
  return vec4(mix(p_paper, p_ink, ht(uv, a, 0, s)), 1.);
}` });

FX.register({ id:'trt-pixelate', name:'Mosaic', cat:'treatment', desc:'Pixel blocks or round tiles with optional grout.',
  params:[ R('size','Block size',16,2,120,1), S('shape','Shape',['Square','Round']), R('gap','Gap',0,0,.45), C('bg','Grout','#0d0d0e') ],
  fs:`vec4 fx(vec2 uv){
  float s = max(p_size, 1.);
  vec2 g = uv * uRes / s; vec2 cell = floor(g); vec2 f = fract(g) - .5;
  vec3 c = texture(uInput, (cell + .5) * s / uRes).rgb;
  float d = p_shape < .5 ? max(abs(f.x), abs(f.y)) : length(f);
  float edge = .5 - p_gap; float aa = .75 / s;
  float m = (p_shape < .5 && p_gap <= 0.) ? 1. : 1. - smoothstep(edge - aa, edge + aa, d);
  return vec4(mix(p_bg, c, m), 1.);
}` });

FX.register({ id:'trt-ascii', name:'ASCII', cat:'treatment', desc:'Rebuilds the frame from characters.',
  params:[ F('font','Font','Helvetica','text'), R('cell','Cell size',12,4,48,1), S('charset','Characters',['Classic',  'Dense', 'Blocks', 'Binary', 'Dots']), S('colorMode','Colour',['From image','Single ink']), C('fg','Ink','#c9f5e4'), C('bg','Ground','#0c0d0e'), R('contrast','Contrast',1.2,0,3), R('boost','Colour boost',1.3,.5,3), T('invert','Invert') ],
  auxSize(P){ const sets = [' .:-=+*#%@', ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$', ' ░▒▓█', ' 01', ' ·•●']; return [sets[P.charset|0].length * 64, 64]; },
  aux(ctx, P, w, h){
    const sets = [' .:-=+*#%@', ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$', ' ░▒▓█', ' 01', ' ·•●'];
    const chars = [...sets[P.charset|0]];
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.font = `500 52px ${Util.family(P)}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    chars.forEach((ch, i) => ctx.fillText(ch, i * 64 + 32, 34));
    return [chars.length, 64, 0, 0];
  },
  fs:`vec4 fx(vec2 uv){
  float cs = max(p_cell, 4.);
  vec2 grid = uRes / cs;
  vec2 cell = floor(uv * grid); vec2 f = fract(uv * grid);
  vec3 c = texture(uInput, (cell + .5) / grid).rgb;
  float l = clamp((luma(c) - .5) * p_contrast + .5, 0., 1.);
  if (p_invert > .5) l = 1. - l;
  float n = max(uAuxInfo.x, 1.);
  float idx = min(floor(l * n), n - 1.);
  float lod = max(0., log2(uAuxInfo.y / cs));
  float g = textureLod(uAux, vec2((idx + f.x) / n, f.y), lod).r;
  vec3 ink = p_colorMode < .5 ? c * p_boost : p_fg;
  return vec4(mix(p_bg, ink, g), 1.);
}` });

FX.register({ id:'trt-grain', name:'Film grain', cat:'treatment', desc:'Animated grain, mono or colour, weighted to the midtones.', search:['texture'],
  params:[ R('amount','Amount',.08,0,.5), R('size','Size',1.5,1,6), T('mono','Mono',true), T('animate','Animate',true), R('mids','Midtone weight',.5,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  vec2 g = floor(uv * uRes / max(p_size, 1.));
  float fr = p_animate > .5 ? mod(floor(uTime * 24.), 97.) : 0.;
  vec2 k = g + fr * 17.13;
  vec3 n = p_mono > .5 ? vec3(hash12(k)) : vec3(hash12(k), hash12(k + 5.1), hash12(k + 9.7));
  float w = mix(1., 1. - abs(luma(c) - .5) * 2., p_mids);
  return vec4(clamp(c + (n - .5) * p_amount * (.4 + w), 0., 1.), 1.);
}` });

FX.register({ id:'trt-vignette', name:'Vignette', cat:'treatment', desc:'Darken or tint the edges.',
  params:[ R('amount','Amount',.6,0,1), R('radius','Radius',.55,0,1.5), R('soft','Softness',.5,.01,1.5), C('color','Colour','#000000') ],
  fs:`vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  float d = length(centered(uv)) / (length(vec2(aspect(), 1.)) * .5);
  return vec4(mix(c, p_color, smoothstep(p_radius, p_radius + p_soft, d) * p_amount), 1.);
}` });

FX.register({ id:'trt-blur', name:'Blur', cat:'treatment', desc:'Soft disc blur in output pixels.',
  params:[ R('radius','Radius',12,0,120,.5), T('gauss','Gaussian falloff',true) ],
  fs:`vec4 fx(vec2 uv){
  vec3 acc = vec3(0.); float ws = 0.;
  for (int i = 0; i < 64; i++){
    float fi = float(i); float rr = sqrt((fi + .5) / 64.) * p_radius; float a = fi * 2.39996;
    float w = p_gauss > .5 ? exp(-2. * rr * rr / max(p_radius * p_radius, 1e-3)) : 1.;
    acc += texture(uInput, uv + vec2(cos(a), sin(a)) * rr / uRes).rgb * w; ws += w;
  }
  return vec4(acc / ws, 1.);
}` });

FX.register({ id:'trt-bloom', name:'Bloom', cat:'treatment', desc:'Highlights bleed light into their surroundings.',
  params:[ R('threshold','Threshold',.65,0,1), R('radius','Radius',30,2,150,1), R('intensity','Intensity',1,0,4), C('tint','Tint','#ffffff') ],
  fs:`vec4 fx(vec2 uv){
  vec3 base = texture(uInput, uv).rgb; vec3 acc = vec3(0.);
  for (int i = 0; i < 48; i++){
    float fi = float(i); float rr = sqrt((fi + .5) / 48.) * p_radius; float a = fi * 2.39996;
    vec3 s = texture(uInput, uv + vec2(cos(a), sin(a)) * rr / uRes).rgb;
    acc += max(s - p_threshold, 0.) * exp(-3. * rr * rr / (p_radius * p_radius));
  }
  return vec4(base + acc / 48. * p_intensity * 4. * p_tint, 1.);
}` });

FX.register({ id:'trt-edges', name:'Line art', cat:'treatment', desc:'Sobel edge detection as ink lines, neon or overlay.',
  params:[ R('width','Line width',1.2,.5,6), R('strength','Strength',2.5,0,10), S('mode','Style',['Ink on paper','Neon','Over image']), C('line','Line','#141414'), C('bg','Paper','#f2efe6') ],
  fs:`float L(vec2 uv){ return luma(texture(uInput, uv).rgb); }
vec4 fx(vec2 uv){
  vec2 e = p_width / uRes;
  float tl = L(uv + vec2(-e.x, e.y)), t = L(uv + vec2(0., e.y)), tr = L(uv + e);
  float l = L(uv - vec2(e.x, 0.)), r = L(uv + vec2(e.x, 0.));
  float bl = L(uv - e), b = L(uv - vec2(0., e.y)), br = L(uv + vec2(e.x, -e.y));
  float gx = -tl - 2. * l - bl + tr + 2. * r + br;
  float gy = -bl - 2. * b - br + tl + 2. * t + tr;
  float g = clamp(length(vec2(gx, gy)) * p_strength, 0., 1.);
  vec3 src = texture(uInput, uv).rgb; int m = int(p_mode + .5);
  vec3 col = m == 0 ? mix(p_bg, p_line, g) : m == 1 ? src * g * 1.8 : mix(src, p_line, g);
  return vec4(col, 1.);
}` });

FX.register({ id:'trt-riso', name:'Riso print', cat:'treatment', desc:'Two misregistered spot inks with stochastic grain.',
  params:[ C('ink1','Ink 1','#ff48b0'), C('ink2','Ink 2','#0078bf'), C('paper','Paper','#f3efe4'), R('offset','Misregistration',4,0,30), R('density','Density',1,0,2), R('grain','Grain',.7,0,1), R('gsize','Grain size',1.5,1,5) ],
  fs:`vec4 fx(vec2 uv){
  vec2 off = vec2(p_offset) / uRes * vec2(1., -.6);
  vec3 c1 = texture(uInput, uv + off).rgb, c2 = texture(uInput, uv - off).rgb;
  float d1 = clamp((1. - c1.g) * p_density, 0., 1.), d2 = clamp((1. - c2.r) * p_density, 0., 1.);
  vec2 g = floor(uv * uRes / p_gsize);
  d1 = mix(d1, step(hash12(g), d1), p_grain);
  d2 = mix(d2, step(hash12(g + 31.7), d2), p_grain);
  vec3 col = p_paper;
  col = mix(col, col * p_ink1, d1);
  col = mix(col, col * p_ink2, d2);
  return vec4(col, 1.);
}` });

FX.register({ id:'trt-photocopy', name:'Photocopy', cat:'treatment', desc:'Blown-out toner, streaks and flicker.', search:['print'],
  params:[ R('contrast','Contrast',3,1,8), R('exposure','Exposure',.05,-.5,.5), R('noise','Toner noise',.25,0,1), R('streaks','Streaks',.6,0,1), R('flicker','Flicker',.5,0,1), C('ink','Toner','#111111'), C('paper','Paper','#ecebe6') ],
  fs:`vec4 fx(vec2 uv){
  float fr = floor(uTime * 12. * p_flicker);
  float l = luma(texture(uInput, uv).rgb);
  l = clamp((l - .5) * p_contrast + .5 + p_exposure + (hash12(vec2(fr, 3.)) - .5) * .08 * p_flicker, 0., 1.);
  float n = hash12(uv * uRes + fr);
  float v = smoothstep(.45, .55, l + (n - .5) * p_noise);
  float streak = vnoise(vec2(uv.x * 90., fr * .7)) * vnoise(vec2(uv.x * 400., uv.y * 1.5 + fr));
  v *= 1. - step(.55, streak) * p_streaks;
  float dust = step(.9985, hash12(floor(uv * uRes / 2.) + fr * 3.));
  return vec4(mix(p_ink, p_paper, clamp(v - dust, 0., 1.)), 1.);
}` });
