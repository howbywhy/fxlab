/* ---------------- Image editing and texture tools ----------------
   The basics a grade or a texture is built from: levels and curves, sharpening,
   a targeted colour range, a focus falloff, and a noise generator.
------------------------------------------------ */
FX.register({ id:'trt-curves', name:'Levels & curves', cat:'treatment', search:['grade', 'contrast', 'tone'],
  desc:'Black and white points, midtones, and a curve you shape in the shadows, mids and highlights.',
  params:[ R('black','Black point',.02,0,.6), R('white','White point',.98,.4,1), R('gamma','Midtones',1,.3,3), R('scurve','Contrast curve',.45,-1,1),
    R('shadows','Shadows',0,-1,1), R('mids','Midtones lift',0,-1,1), R('highs','Highlights',0,-1,1), S('mode','Apply to',['All channels','Luminance only','Red','Green','Blue'],0) ],
  fs:`float curve(float x){
  x = clamp((x - p_black) / max(p_white - p_black, .002), 0., 1.);
  x = pow(x, 1. / max(p_gamma, .05));
  float sc = x * x * (3. - 2. * x);
  x = p_scurve >= 0. ? mix(x, sc, p_scurve) : clamp(x + (x - sc) * -p_scurve, 0., 1.);
  float seg = x * 4., i = min(floor(seg), 3.), t = seg - i; t = t * t * (3. - 2. * t);
  float a = i < .5 ? 0. : i < 1.5 ? p_shadows : i < 2.5 ? p_mids : p_highs;
  float b = i < .5 ? p_shadows : i < 1.5 ? p_mids : i < 2.5 ? p_highs : 0.;
  return clamp(x + mix(a, b, t) * .15, 0., 1.);
}
vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  int m = int(p_mode + .5);
  if (m == 0) c = vec3(curve(c.r), curve(c.g), curve(c.b));
  else if (m == 1){ float l = luma(c); c = c + (curve(l) - l); }
  else if (m == 2) c.r = curve(c.r);
  else if (m == 3) c.g = curve(c.g);
  else c.b = curve(c.b);
  return vec4(clamp(c, 0., 1.), 1.);
}` });

FX.register({ id:'trt-sharpen', name:'Sharpen', cat:'treatment', search:['detail', 'clarity', 'crisp'],
  desc:'Brings out edges and fine detail. Turn on midtones only for a broader, local-contrast lift.',
  params:[ R('amount','Amount',1.2,0,4), R('radius','Radius (px)',1.4,.4,16), R('threshold','Ignore small detail',.02,0,.2), T('luma','Luminance only',true), T('clarity','Midtones only',false) ],
  fs:`vec4 fx(vec2 uv){
  vec2 px = p_radius / uRes;
  vec3 c = texture(uInput, uv).rgb;
  vec3 b = c * .25;
  b += (texture(uInput, uv + vec2(px.x, 0.)).rgb + texture(uInput, uv - vec2(px.x, 0.)).rgb + texture(uInput, uv + vec2(0., px.y)).rgb + texture(uInput, uv - vec2(0., px.y)).rgb) * .125;
  b += (texture(uInput, uv + px).rgb + texture(uInput, uv - px).rgb + texture(uInput, uv + vec2(px.x, -px.y)).rgb + texture(uInput, uv + vec2(-px.x, px.y)).rgb) * .0625;
  vec3 d = c - b;
  float ld = luma(d);
  if (p_luma > .5) d = vec3(ld);
  d *= p_threshold > .0001 ? smoothstep(p_threshold, p_threshold * 2. + .01, abs(ld)) : 1.;
  if (p_clarity > .5) d *= 1. - abs(luma(c) - .5) * 1.6;
  return vec4(clamp(c + d * p_amount, 0., 1.), 1.);
}` });

FX.register({ id:'trt-selective', name:'Colour range', cat:'treatment', search:['hue', 'colour', 'isolate'],
  desc:'Picks a range of hues and shifts, saturates or darkens only those, or isolates them in grey.',
  params:[ R('hue','Target hue',20,0,360,1), R('width','Range width',50,5,180,1), R('soft','Softness',30,1,90,1), R('shift','Shift hue',-35,-180,180,1), R('sat','Saturation',.35,-1,1), R('light','Lightness',0,-1,1),
    T('isolate','Grey everything else',false), T('show','Show the selection',false) ],
  fs:`vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  vec3 hsv = rgb2hsv(c);
  float d = abs(hsv.x - p_hue / 360.); d = min(d, 1. - d) * 360.;
  float m = (1. - smoothstep(p_width * .5, p_width * .5 + max(p_soft, 1.), d)) * smoothstep(.04, .18, hsv.y);
  if (p_show > .5) return vec4(vec3(m), 1.);
  hsv.x = fract(hsv.x + p_shift / 360. * m + 1.);
  hsv.y = clamp(hsv.y * (1. + p_sat * m), 0., 1.);
  hsv.z = clamp(hsv.z * (1. + p_light * m), 0., 1.);
  vec3 o = hsv2rgb(hsv);
  if (p_isolate > .5) o = mix(vec3(luma(c)), o, m);
  return vec4(o, 1.);
}` });

FX.register({ id:'fx-tiltshift', name:'Tilt-shift', cat:'fx', search:['blur', 'focus', 'depth', 'miniature'],
  desc:'Keeps a band (or a circle) in focus and blurs away from it, like a miniature.',
  params:[ S('shape','Focus',['Band','Circle'],0), R('amount','Blur (px)',22,0,48,.5), R('focus','Sharp area',.22,0,1), R('falloff','Falloff',.35,.02,1), R('angle','Angle',0,-90,90,1), R('x','Centre X',0,-1,1), R('y','Centre Y',.1,-1,1), R('bokeh','Bright highlights',.5,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = centered(uv) - vec2(p_x * .5 * aspect(), p_y * .5);
  p = rot(radians(p_angle)) * p;
  float d = p_shape < .5 ? abs(p.y) : length(p);
  float k = smoothstep(p_focus * .5, p_focus * .5 + p_falloff, d);
  float r = k * p_amount;
  if (r < .4) return vec4(texture(uInput, uv).rgb, 1.);
  vec3 acc = vec3(0.); float ws = 0.;
  for (int i = 0; i < 28; i++){
    float a = float(i) * 2.39996, rr = sqrt((float(i) + .5) / 28.) * r;
    vec3 s = texture(uInput, uv + vec2(cos(a), sin(a)) * rr / uRes).rgb;
    float l = luma(s), w = mix(1., 1. + l * l * 5., p_bokeh);
    acc += s * w; ws += w;
  }
  return vec4(acc / ws, 1.);
}` });

FX.register({ id:'gen-noise', name:'Noise texture', cat:'generator', search:['texture', 'cells', 'grain'],
  desc:'Soft, ridged or cellular noise as a colour field — a starting surface for grades, mattes and prints. Loops seamlessly.',
  params:[ S('type','Noise',['Soft','Ridged','Billow','Cells','Cell edges'],0), R('scale','Scale',3.2,.5,24), I('detail','Detail',4,1,6), R('warp','Warp',.35,0,2), R('contrast','Contrast',1.25,.3,4),
    I('speed','Loops per cycle',1,0,4), R('drift','Drift',.5,0,2), S('colour','Colour',['Two colour','Three colour','Black and white'],1), C('c1','Shadow','#1a1620'), C('c2','Middle','#8a5a6e'), C('c3','Light','#f4d9b8') ],
  fs:`float nz(vec2 p, float t){
  float v = 0., a = .5;
  for (int i = 0; i < 6; i++){
    if (float(i) >= p_detail) break;
    float n = vnoise(p + vec2(cos(t), sin(t)) * p_drift * (1. + float(i) * .4));
    n = p_type < .5 ? n : p_type < 1.5 ? 1. - abs(n * 2. - 1.) : abs(n * 2. - 1.);
    v += a * n; p = p * 2.03 + 17.1; a *= .5;
  }
  return v / (1. - pow(.5, max(p_detail, 1.)));
}
vec2 cell(vec2 p, float t){
  vec2 ip = floor(p), fp = fract(p); float f1 = 9., f2 = 9.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 g = vec2(float(x), float(y)), h = hash22(ip + g);
    vec2 o = .5 + .5 * sin(t + TAU * h) * p_drift * .5 + (h - .5) * (1. - p_drift * .25);
    float d = length(g + o - fp);
    if (d < f1){ f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return vec2(f1, f2);
}
vec4 fx(vec2 uv){
  vec2 p = centered(uv) * p_scale;
  float t = uLoop * TAU * floor(p_speed);
  p += p_warp * (vec2(vnoise(p * .7 + 3.1 + vec2(cos(t), sin(t))), vnoise(p * .7 - 7.3 + vec2(sin(t), cos(t)))) - .5) * 2.;
  float v;
  if (p_type < 2.5) v = nz(p, t);
  else { vec2 c = cell(p, t); v = p_type < 3.5 ? 1. - c.x * 1.2 : clamp((c.y - c.x) * 2.4, 0., 1.); }
  v = clamp((v - .5) * p_contrast + .5, 0., 1.);
  vec3 col = p_colour > 1.5 ? vec3(v) : p_colour < .5 ? mix(p_c1, p_c3, v) : (v < .5 ? mix(p_c1, p_c2, v * 2.) : mix(p_c2, p_c3, v * 2. - 1.));
  return vec4(col, 1.);
}` });

/* Error diffusion pushes each pixel's rounding error onto its neighbours, so it can't run in a fragment shader.
   It runs on a small copy of the frame in JavaScript, then scales up with hard pixels. */
const DIFFUSE = {
  fs:[[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]],
  atkinson:[[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]],
  sierra:[[1, 0, 2], [-1, 1, 1], [0, 1, 1]],
  stucki:[[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]],
  jarvis:[[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]],
};
FX.register({ id:'trt-diffuse', name:'Error diffusion', cat:'treatment', kind:'2d', nonLocal:true, search:['dither', 'print', 'texture', 'atkinson'],
  desc:'True dithering: each pixel’s rounding error spreads to its neighbours. Atkinson gives the classic soft-contrast look.',
  params:[ S('method','Method',['Floyd–Steinberg','Atkinson','Sierra Lite','Stucki','Jarvis'],1), R('pixel','Pixel size',3,1,12,1), I('levels','Levels',2,2,8), R('contrast','Contrast',1.15,.3,3), T('serpentine','Serpentine scan',true), T('mono','Two colours',true), C('dark','Dark','#131313'), C('light','Light','#e8e4d8') ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; if (!api.input) return;
    const px = Math.max(1, Math.round(P.pixel * w / api.W)), cw = Math.ceil(w / px), ch = Math.ceil(h / px);
    const small = document.createElement('canvas'); small.width = cw; small.height = ch;
    const sx = small.getContext('2d', { willReadFrequently:true }); sx.drawImage(api.input, 0, 0, cw, ch);
    const d = sx.getImageData(0, 0, cw, ch), src = d.data, L = Math.max(2, P.levels | 0) - 1, mono = !!P.mono;
    const kernel = DIFFUSE[['fs', 'atkinson', 'sierra', 'stucki', 'jarvis'][P.method | 0] || 'atkinson'], div = kernel.reduce((s, k) => s + k[2], 0), total = P.method == 1 ? 8 : div;
    const nch = mono ? 1 : 3, buf = new Float32Array(cw * ch * nch);
    for (let i = 0; i < cw * ch; i++){
      const r = src[i * 4] / 255, g = src[i * 4 + 1] / 255, b = src[i * 4 + 2] / 255;
      if (mono) buf[i] = Util.clamp(((.2126 * r + .7152 * g + .0722 * b) - .5) * P.contrast + .5);
      else { buf[i * 3] = Util.clamp((r - .5) * P.contrast + .5); buf[i * 3 + 1] = Util.clamp((g - .5) * P.contrast + .5); buf[i * 3 + 2] = Util.clamp((b - .5) * P.contrast + .5); }
    }
    const dark = Util.hexToRgb(P.dark), light = Util.hexToRgb(P.light);
    for (let y = 0; y < ch; y++){
      const rev = P.serpentine && (y & 1), x0 = rev ? cw - 1 : 0, x1 = rev ? -1 : cw, step = rev ? -1 : 1;
      for (let x = x0; x !== x1; x += step){
        for (let c = 0; c < nch; c++){
          const i = (y * cw + x) * nch + c, old = buf[i], q = Math.round(Util.clamp(old) * L) / L, err = old - q;
          buf[i] = q;
          for (const [dx, dy, wt] of kernel){
            const nx = x + dx * (rev ? -1 : 1), ny = y + dy;
            if (nx < 0 || nx >= cw || ny >= ch) continue;
            buf[(ny * cw + nx) * nch + c] += err * wt / total;
          }
        }
      }
    }
    for (let i = 0; i < cw * ch; i++){
      if (mono){ const q = Util.clamp(buf[i]); for (let c = 0; c < 3; c++) src[i * 4 + c] = dark[c] + (light[c] - dark[c]) * q; }
      else for (let c = 0; c < 3; c++) src[i * 4 + c] = Util.clamp(buf[i * 3 + c]) * 255;
      src[i * 4 + 3] = 255;
    }
    sx.putImageData(d, 0, 0);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(small, 0, 0, cw * px, ch * px); ctx.restore();
  } });

FX.register({ id:'trt-stipple', name:'Stipple', cat:'treatment', search:['dither', 'print', 'dots', 'texture', 'pointillism'],
  desc:'Redraws the frame as scattered dots, thicker where it is dark, like pen stippling.',
  params:[ R('size','Cell size',6,3,40,.5), R('dot','Dot size',.85,.2,1.4), R('contrast','Contrast',1.4,.3,3), R('gamma','Density curve',1,.4,2.5), R('jitter','Randomness',1,0,1), T('vary','Vary dot size',true), I('seed','Seed',3,1,99), S('colour','Ink',['One ink','From the image']), C('ink','Ink','#141414'), C('paper','Paper','#f2efe6') ],
  fs:`vec4 fx(vec2 uv){
  float cs = max(p_size, 2.);
  vec2 p = uv * uRes / cs, id = floor(p);
  float m = 0.; vec3 inkc = p_ink;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 nid = id + vec2(float(i), float(j));
    vec2 cc = nid + .5 + (hash22(nid + p_seed * 11.7) - .5) * p_jitter * .9;
    vec3 col = texture(uInput, cc * cs / uRes).rgb;
    float tone = 1. - clamp((luma(col) - .5) * p_contrast + .5, 0., 1.);
    float rr = p_dot * .5 * mix(.6, 1.4, tone) * (p_vary > .5 ? mix(.6, 1., hash12(nid + 3.3 + p_seed)) : 1.);
    float keep = step(hash12(nid * 1.37 + p_seed * 7.1), pow(tone, p_gamma));
    float d = length(cc - p), aa = fwidth(d) + .002;
    float cov = keep * (1. - smoothstep(rr - aa, rr + aa, d));
    if (cov > m){ m = cov; inkc = p_colour < .5 ? p_ink : col * .55; }
  }
  return vec4(mix(p_paper, inkc, m), 1.);
}` });
