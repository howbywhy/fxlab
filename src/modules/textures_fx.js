/* ---------------- Textures & effects ---------------- */

/* ---- Surface texture ---- */
FX.register({ id:'trt-surface', name:'Surface texture', cat:'treatment', desc:'Lays a physical surface over the frame — canvas, linen, concrete, crumpled paper, brushed metal or scratches.',
  params:[ S('kind','Surface',['Canvas','Linen','Concrete','Crumpled paper','Brushed metal','Scratches','Stucco'],0), R('scale','Scale',1,.2,6), R('amount','Amount',.5,0,1.5), R('relief','Relief',.5,0,2), R('angle','Angle',30,-180,180,1), S('blend','Blend',['Overlay','Multiply','Soft light','Screen'],0), T('colorise','Tint to paper',false), C('paper','Paper','#efece2') ],
  fs:`float surf(vec2 uv){
  int k = int(p_kind + .5);
  vec2 p = uv * uRes / 240. * p_scale;
  vec2 r = rot(radians(p_angle)) * p;
  if (k == 0){ float a = sin(r.x * 190.) * .5 + .5, b = sin(r.y * 190.) * .5 + .5; return mix(a, b, .5) * .6 + fbm(p * 22.) * .4; }
  if (k == 1){ float a = sin(r.x * 260. + fbm(p * 30.) * 2.) * .5 + .5; float b = sin(r.y * 150. + fbm(p * 18.) * 2.) * .5 + .5; return a * .55 + b * .45; }
  if (k == 2){ return fbm(p * 9.) * .6 + fbm(p * 40.) * .4; }
  if (k == 3){ float f = fbm(p * 3.2); float c = abs(fbm(p * 6. + f * 2.) - .5) * 2.; return 1. - pow(c, .55); }
  if (k == 4){ return vnoise(vec2(r.x * 900., r.y * 4.)) * .7 + fbm(p * 12.) * .3; }
  if (k == 5){ float s = 0.; for (int i = 0; i < 4; i++){ vec2 q = rot(float(i) * 1.9 + radians(p_angle)) * p; s = max(s, smoothstep(.97, 1., vnoise(vec2(q.x * 500., q.y * 2.5 + float(i) * 13.)))); } return .5 + s * .5; }
  return fbm(p * 14.) * .5 + abs(fbm(p * 5.) - .5);
}
vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  float e = 1.4 / max(uRes.x, 1.);
  float s = surf(uv);
  float sx = surf(uv + vec2(e, 0.)) - surf(uv - vec2(e, 0.));
  float sy = surf(uv + vec2(0., e)) - surf(uv - vec2(0., e));
  float light = clamp(.5 + (sx * .7 - sy * .7) * 26. * p_relief, 0., 1.);
  float t = mix(s, light, clamp(p_relief, 0., 1.) * .6);
  vec3 tex = vec3(t);
  if (p_colorise > .5) tex *= p_paper / max(luma(p_paper), .04);
  int b = int(p_blend + .5);
  vec3 mixed = b == 0 ? blendMode(c, tex, 3) : b == 1 ? c * tex * 1.6 : b == 2 ? blendMode(c, tex, 4) : blendMode(c, tex, 2);
  return vec4(clamp(mix(c, mixed, p_amount), 0., 1.), 1.);
}` });

/* ---- Cross-hatch ---- */
FX.register({ id:'trt-hatch', name:'Cross-hatch', cat:'treatment', desc:'Redraws tones as engraved pen hatching, in up to four layers with wobbling lines.', search:['print'],
  params:[ R('pitch','Line pitch',14,2,60), I('layers','Layers',4,1,4), R('angle','First angle',35,-90,90,1), R('spin','Angle between layers',42,0,90,1), R('weight','Line weight',.55,.05,1), R('wobble','Wobble',.35,0,2), R('contrast','Contrast',1.2,.2,4), R('exposure','Exposure',0,-.5,.5), T('keepColor','Keep colour',false), C('ink','Ink','#141516', false), C('paper','Paper','#efece2', false) ],
  fs:`float hatchLayer(vec2 uv, float ang, float lvl, float pitch){
  /* keep lines at least a preview pixel wide, so hatching still reads at low preview quality */
  pitch = max(pitch, uPx * 2.2);
  vec2 p = rot(radians(ang)) * (uv * uRes);
  float wob = (fbm(uv * 7.) - .5) * p_wobble * pitch * .8;
  float v = fract((p.y + wob) / pitch);
  float d = min(v, 1. - v) * pitch;
  float w = max(p_weight * pitch * .5 * lvl, lvl > .01 ? uPx * .45 : 0.);
  float aa = max(uPx * .6, .4);
  return 1. - smoothstep(w - aa, w + aa, d);
}
vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  float l = clamp((luma(c) - .5) * p_contrast + .5 + p_exposure, 0., 1.);
  float dark = 1. - l, ink = 0.;
  int n = int(p_layers + .5);
  for (int i = 0; i < 4; i++){
    if (i >= n) break;
    float thresh = float(i) / float(n) * .78;
    float lvl = clamp((dark - thresh) * 3.2, 0., 1.);
    if (lvl <= .001) continue;
    ink = max(ink, hatchLayer(uv, p_angle + float(i) * p_spin, lvl, p_pitch * (1. + float(i) * .12)));
  }
  ink = max(ink, smoothstep(.85, 1., dark));
  vec3 paper = p_keepColor > .5 ? mix(p_paper, c, .55) : p_paper;
  vec3 inkc = p_keepColor > .5 ? mix(p_ink, c * .6, .5) : p_ink;
  return vec4(mix(paper, inkc, ink), 1.);
}` });

/* ---- Painterly ---- */
FX.register({ id:'trt-paint', name:'Painterly', cat:'treatment', desc:'Kuwahara-style painting: flattens the frame into brush-like patches that keep their edges.',
  params:[ R('radius','Brush size',6,1,14,1), R('detail','Edge detail',.5,0,1), R('strength','Strength',1,0,1), R('texture','Brush texture',.3,0,1), T('outline','Dark outlines',false), R('outlineAmt','Outline strength',.5,0,2) ],
  fs:`vec4 fx(vec2 uv){
  vec3 src = texture(uInput, uv).rgb;
  int R = int(clamp(p_radius, 1., 14.) + .5);
  vec2 px = 1. / uRes;
  vec2 jitter = (vec2(vnoise(uv * 70.), vnoise(uv * 70. + 11.)) - .5) * p_texture * float(R) * px;
  vec3 best = src; float bestVar = 1e9;
  for (int q = 0; q < 4; q++){
    vec2 dir = q == 0 ? vec2(1., 1.) : q == 1 ? vec2(-1., 1.) : q == 2 ? vec2(1., -1.) : vec2(-1., -1.);
    vec3 sum = vec3(0.), sum2 = vec3(0.); float n = 0.;
    for (int j = 0; j <= 14; j++){
      if (j > R) break;
      for (int i = 0; i <= 14; i++){
        if (i > R) break;
        vec3 c = texture(uInput, uv + jitter + dir * vec2(float(i), float(j)) * px * (1. + p_detail)).rgb;
        sum += c; sum2 += c * c; n += 1.;
      }
    }
    vec3 mean = sum / n, varc = abs(sum2 / n - mean * mean);
    float v = varc.r + varc.g + varc.b;
    if (v < bestVar){ bestVar = v; best = mean; }
  }
  vec3 col = mix(src, best, p_strength);
  if (p_outline > .5){
    float e = length(vec2(dFdx(luma(col)), dFdy(luma(col)))) * 26. * p_outlineAmt;
    col *= 1. - clamp(e, 0., .85);
  }
  return vec4(col, 1.);
}` });

/* ---- Letterpress ---- */
FX.register({ id:'trt-emboss', name:'Letterpress', cat:'treatment', desc:'Presses the artwork into the paper (or lifts it off) with a bevelled edge and paper grain.', search:['print'],
  params:[ R('depth','Depth',1,0,4), R('spread','Edge width',2,.5,12), R('angle','Light angle',135,-180,180,1), T('deboss','Press in',true), R('keepInk','Keep ink',.35,0,1), R('grain','Paper grain',.25,0,1), C('paper','Paper','#efece2', false), C('shade','Shadow','#b9b4a6', false) ],
  fs:`float mask(vec2 uv){ return 1. - luma(texture(uInput, uv).rgb); }
vec4 fx(vec2 uv){
  vec3 src = texture(uInput, uv).rgb;
  vec2 px = p_spread / uRes;
  float a = radians(p_angle);
  vec2 l = vec2(cos(a), sin(a)) * px;
  float hi = mask(uv - l), lo = mask(uv + l);
  float rel = (hi - lo) * p_depth * (p_deboss > .5 ? -1. : 1.);
  float m = mask(uv);
  vec3 col = p_paper;
  col *= 1. + clamp(rel, 0., 1.) * .35;
  col = mix(col, p_shade, clamp(-rel, 0., 1.) * .85);
  col = mix(col, mix(p_paper, src, .85), m * p_keepInk);
  col *= 1. - m * (p_deboss > .5 ? .06 : 0.) * p_depth;
  col += (hash12(uv * uRes) - .5) * p_grain * .12;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Foil ---- */
FX.register({ id:'trt-foil', name:'Foil', cat:'treatment', desc:'Turns light areas into metallic or holographic foil that catches the light as it moves.', search:['print'],
  params:[ S('kind','Foil',['Gold','Silver','Holographic','Duotone','Oil slick'],0), R('threshold','Foil where',.5,0,1), R('softness','Edge softness',.15,.01,.6), R('shine','Shine',1,0,3), R('bands','Bands',3,.5,12), R('angle','Angle',30,-180,180,1), I('speed','Loops per cycle',1,0,6), R('relief','Relief',.4,0,2), T('invert','Foil the darks',false),
    C('c1','Foil colour 1','#ffd77a'), C('c2','Foil colour 2','#8a6a1e'), C('bg','Behind','#141516') ],
  fs:`vec4 fx(vec2 uv){
  vec3 src = texture(uInput, uv).rgb;
  float l = luma(src);
  float m = smoothstep(p_threshold - p_softness, p_threshold + p_softness, p_invert > .5 ? 1. - l : l);
  vec2 p = rot(radians(p_angle)) * centered(uv);
  float e = 2. / uRes.x;
  float h = luma(texture(uInput, uv).rgb);
  float gx = luma(texture(uInput, uv + vec2(e, 0.)).rgb) - luma(texture(uInput, uv - vec2(e, 0.)).rgb);
  float gy = luma(texture(uInput, uv + vec2(0., e)).rgb) - luma(texture(uInput, uv - vec2(0., e)).rgb);
  float v = p.x * p_bands * 3. + p.y * p_bands + (gx - gy) * p_relief * 24. + uLoop * TAU * p_speed;
  float w = sin(v) * .5 + .5;
  int k = int(p_kind + .5);
  vec3 foil;
  if (k == 2) foil = hsv2rgb(vec3(fract(v / TAU * .5 + h * .3), .55, .55 + .45 * w));
  else if (k == 4) foil = hsv2rgb(vec3(fract(v / TAU * .22 + l * .6), .7, .35 + .6 * w));
  else if (k == 3) foil = mix(p_c2, p_c1, smoothstep(.2, .8, w));
  else { vec3 a = k == 0 ? p_c1 : vec3(.92), b = k == 0 ? p_c2 : vec3(.35); foil = mix(b, a, pow(w, .7)); }
  float spec = pow(w, 12.) * p_shine;
  foil += spec * .6;
  vec3 col = mix(p_bg, foil, m);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Brand palette ---- */
FX.register({ id:'trt-palette', name:'Brand palette', cat:'treatment', desc:'Snaps every colour to the nearest brand colour, with optional dithering — a quick way to make any image on-brand.',
  params:[ C('c1','Colour 1','#141516','ground'), C('c2','Colour 2','#e4e2dc','ink'), C('c3','Colour 3','#ff5a36','accent'), C('c4','Colour 4','#c9f5e4','accent2'), I('count','Colours used',4,2,4), S('dither','Dither',['None','Bayer 4','Bayer 8','Noise'],1), R('amount','Dither amount',.6,0,1.5), R('contrast','Contrast',1,.2,3), R('exposure','Exposure',0,-.5,.5), R('mix','Strength',1,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 src = texture(uInput, uv).rgb;
  vec3 c = clamp((src - .5) * p_contrast + .5 + p_exposure, 0., 1.);
  float d = 0.;
  int dm = int(p_dither + .5);
  if (dm == 1) d = bayer4(uv * uRes) - .5;
  else if (dm == 2) d = bayer8(uv * uRes) - .5;
  else if (dm == 3) d = hash12(uv * uRes + floor(uTime * 24.)) - .5;
  c += d * p_amount * .35;
  vec3 pal[4]; pal[0] = p_c1; pal[1] = p_c2; pal[2] = p_c3; pal[3] = p_c4;
  int n = int(clamp(p_count, 2., 4.) + .5);
  vec3 best = pal[0]; float bd = 1e9;
  for (int i = 0; i < 4; i++){
    if (i >= n) break;
    vec3 dv = c - pal[i];
    float dist = dot(dv * vec3(1.1, 1.25, .9), dv);
    if (dist < bd){ bd = dist; best = pal[i]; }
  }
  return vec4(mix(src, best, p_mix), 1.);
}` });

/* ---- Shockwave ---- */
FX.register({ id:'fx-shockwave', name:'Shockwave', cat:'fx', nonLocal:true, desc:'Rings pulse out from a point, bending the image and flashing an edge. Fires on the beat or once on the timeline.',
  params:[ R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1), S('drive','Fires',['On the beat','Once with the timeline'],0), I('beats','Beats per loop (0 = brand)',0,0,16), I('rings','Rings at once',2,1,6), R('width','Ring width',.16,.01,.5), R('strength','Distortion',.12,0,.3), R('chroma','Colour split',.4,0,2), R('glow','Edge glow',1.4,0,3), R('falloff','Fade with distance',1,0,3), C('edge','Edge colour','#ffffff') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = vec2(.5 + p_x * .5, .5 - p_y * .5);
  vec2 d = (uv - c) * vec2(aspect(), 1.);
  float r = length(d);
  vec2 dir = d / max(r, 1e-4);
  float beats = p_beats < .5 ? 4. : p_beats;
  float amp = 0., ring = 0.;
  int n = int(p_rings + .5);
  for (int i = 0; i < 6; i++){
    if (i >= n) break;
    float phase = p_drive < .5 ? fract(uLoop * beats - float(i) / float(n)) : clamp(uProgress - float(i) * .12, 0., 1.);
    float rad = phase * 1.3;
    float w = max(p_width, .005);
    float m = smoothstep(w, 0., abs(r - rad));
    float decay = (1. - phase) * exp(-r * p_falloff);
    amp += m * decay; ring = max(ring, m * decay);
  }
  vec2 off = dir * amp * p_strength;
  vec3 col;
  col.r = texture(uInput, uv - off * (1. + p_chroma * .1)).r;
  col.g = texture(uInput, uv - off).g;
  col.b = texture(uInput, uv - off * (1. - p_chroma * .1)).b;
  col += p_edge * ring * p_glow * .5;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Recursion ---- */
FX.register({ id:'fx-droste', name:'Recursion', cat:'fx', nonLocal:true, desc:'The frame inside itself, over and over — straight, spiralling or mirrored.',
  params:[ R('zoom','Step size',.55,.1,.95), I('copies','Copies',5,1,12), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1), R('rotate','Rotation per step',0,-90,90,1), S('drive','Motion',['Static','Infinite zoom in','Infinite zoom out'],0), I('speed','Loops per cycle',1,0,6), T('mirror','Mirror each step',false), R('fade','Fade per step',.12,0,.6), R('tint','Tint per step',0,0,1), C('c1','Tint colour','#ff5a36') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = vec2(.5 + p_x * .5, .5 - p_y * .5);
  float drift = p_drive < .5 ? 0. : (p_drive < 1.5 ? uLoop : -uLoop) * p_speed;
  vec3 col = texture(uInput, uv).rgb;
  float a = 1.;
  int n = int(p_copies + .5);
  for (int i = 1; i <= 12; i++){
    if (i > n) break;
    float k = float(i) + drift;
    float s = pow(max(p_zoom, .05), k);
    vec2 q = (uv - c) / s;
    q = rot(radians(p_rotate) * k) * q * vec2(1., 1.);
    q += c;
    if (p_mirror > .5) q = mirrorUv(q);
    if (any(lessThan(q, vec2(0.))) || any(greaterThan(q, vec2(1.)))) continue;
    vec3 inner = texture(uInput, q).rgb;
    inner = mix(inner, p_c1, clamp(p_tint * k * .2, 0., 1.));
    float w = max(1. - p_fade * k, 0.) * a;
    col = mix(col, inner, w * .85);
    a *= .92;
  }
  return vec4(col, 1.);
}` });

/* ---- Long shadow ---- */
FX.register({ id:'fx-shadow', name:'Long shadow', cat:'fx', nonLocal:true, desc:'Casts a long flat shadow, a soft drop shadow or a hard offset block from whatever is light in the frame.',
  params:[ S('style','Shadow',['Long flat','Drop','Hard offset','Extrude'],0), R('angle','Angle',135,-180,180,1), R('length','Length',.38,.01,1), R('softness','Softness',.02,0,.3), R('opacity','Opacity',.72,0,1), R('threshold','From lights above',.45,0,1), T('behind','Behind the frame',true), R('spread','Spread',0,0,.1), C('color','Shadow colour','#141516'), T('fade','Fade out',true) ],
  fs:`float src(vec2 uv){ if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) return 0.; return smoothstep(p_threshold - .12, p_threshold + .12, luma(texture(uInput, uv).rgb)); }
vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  float a = radians(p_angle);
  vec2 dir = vec2(cos(a), -sin(a)) / vec2(aspect(), 1.);
  int st = int(p_style + .5);
  float sh = 0.;
  if (st == 1 || st == 2){
    float d = st == 2 ? p_length * .12 : p_length * .06;
    float soft = max(p_softness, .001);
    if (st == 1){ for (int i = 0; i < 12; i++){ float t = float(i) / 11.; vec2 o = dir * d + (hash22(uv * uRes + float(i)) - .5) * soft; sh += src(uv - o); } sh /= 12.; }
    else sh = src(uv - dir * d);
  } else {
    float steps = 48.;
    float len = p_length * (st == 3 ? .5 : 1.);
    for (int i = 1; i <= 48; i++){
      float t = float(i) / steps;
      float s = src(uv - dir * len * t + vec2(0.) );
      float w = p_fade > .5 ? (1. - t) : 1.;
      sh = max(sh, s * w);
      if (st == 3 && s > .5) sh = max(sh, w);
    }
  }
  sh *= p_opacity;
  vec3 base = p_behind > .5 ? mix(c, p_color, sh * (1. - src(uv))) : mix(c, p_color, sh);
  return vec4(base, 1.);
}` });

/* ---- Outline ---- */
FX.register({ id:'fx-outline', name:'Outline', cat:'fx', desc:'Draws a stroke around shapes and type — solid, double, dotted or glowing — so they stay legible over anything.',
  params:[ R('width','Width',6,.5,24), R('threshold','Shape is above',.5,0,1), S('style','Style',['Solid','Double','Dotted','Glow','Halo only'],0), R('softness','Softness',.5,0,3), R('gap','Gap',0,0,12), I('dots','Dot count',60,6,200), T('inside','Draw inside',false), R('opacity','Opacity',1,0,1), C('color','Stroke','#ff5a36'), C('color2','Second stroke','#e4e2dc') ],
  fs:`float shape(vec2 uv){ if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) return 0.; return smoothstep(p_threshold - .06, p_threshold + .06, luma(texture(uInput, uv).rgb)); }
float ring(vec2 uv, float rad, float w){
  float mx = 0., mn = 1.;
  for (int i = 0; i < 16; i++){
    float a = TAU * float(i) / 16.;
    vec2 o = vec2(cos(a), sin(a)) * rad / uRes;
    float s = shape(uv + o);
    mx = max(mx, s); mn = min(mn, s);
  }
  float here = shape(uv);
  float outside = mx * (1. - here);
  float inside = (1. - mn) * here;
  return p_inside > .5 ? max(outside, inside) : outside;
}
vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  int st = int(p_style + .5);
  float w = p_width;
  float e1 = ring(uv, w + p_gap, w);
  vec3 col = c;
  if (st == 3){
    float g = 0.;
    for (int i = 1; i <= 5; i++) g = max(g, ring(uv, w * float(i) * .9, w) * (1. - float(i) / 6.));
    col = mix(col, p_color, clamp(g * p_opacity * 1.4, 0., 1.));
  } else if (st == 2){
    float a = atan(uv.y - .5, uv.x - .5);
    float dots = step(.0, sin(a * p_dots + uLoop * TAU));
    col = mix(col, p_color, e1 * dots * p_opacity);
  } else if (st == 4){
    col = mix(col, p_color, e1 * p_opacity * (1. - shape(uv)));
  } else {
    col = mix(col, p_color, e1 * p_opacity);
    if (st == 1){ float e2 = ring(uv, w * 2.2 + p_gap * 2., w); col = mix(col, p_color2, clamp(e2 - e1, 0., 1.) * p_opacity); }
  }
  return vec4(col, 1.);
}` });

/* ---- Strobe ---- */
FX.register({ id:'fx-strobe', name:'Strobe', cat:'fx', desc:'Cuts, flashes, inverts or shifts colour on the beat. Use sparingly.',
  params:[ I('beats','Beats per loop (0 = brand)',0,0,32), S('mode','On the beat',['Flash','Invert','Colour flash','Black frame','Hue shift','Posterise'],0), R('amount','Amount',1,0,1), R('hold','Flash length',.2,.02,1), S('shape','Shape',['Snap','Ramp down','Ramp up'],1), R('every','Only every n-th beat',1,1,8,1), C('flash','Flash colour','#ffffff'), R('shift','Hue shift',.3,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  float beats = p_beats < .5 ? 4. : p_beats;
  float f = uLoop * beats;
  float idx = floor(f), lt = fract(f);
  if (mod(idx, max(p_every, 1.)) > .5) return vec4(c, 1.);
  float k = lt < p_hold ? (int(p_shape + .5) == 0 ? 1. : int(p_shape + .5) == 1 ? 1. - lt / p_hold : lt / p_hold) : 0.;
  k *= p_amount;
  int m = int(p_mode + .5);
  vec3 outc = c;
  if (m == 0) outc = mix(c, p_flash, k);
  else if (m == 1) outc = mix(c, 1. - c, k);
  else if (m == 2) outc = mix(c, c * p_flash * 1.8, k);
  else if (m == 3) outc = mix(c, vec3(0.), k);
  else if (m == 4){ vec3 h = rgb2hsv(c); h.x = fract(h.x + p_shift * k); outc = mix(c, hsv2rgb(h), 1.); }
  else { float lv = max(2., 8. - k * 6.); outc = floor(c * lv) / (lv - 1.); }
  return vec4(clamp(outc, 0., 1.), 1.);
}` });

/* ---- Light streaks ---- */
FX.register({ id:'fx-streak', name:'Light streaks', cat:'fx', nonLocal:true, desc:'Anamorphic streaks pulled out of the bright areas — horizontal flares, crosses or stars.',
  params:[ R('threshold','Streak above',.65,0,1), R('length','Length',.25,.02,1), S('shape','Shape',['Horizontal','Vertical','Cross','Star','Diagonal'],0), R('angle','Angle',0,-90,90,1), R('intensity','Intensity',1,0,3), R('falloff','Falloff',2.5,.5,8), R('chroma','Colour spread',.4,0,2), C('tint','Tint','#9fd8ff'), T('keep','Keep the frame',true) ],
  fs:`vec3 streak(vec2 uv, vec2 dir){
  vec3 s = vec3(0.); float wsum = 0.;
  for (int i = 1; i <= 24; i++){
    float t = float(i) / 24.;
    float w = exp(-t * p_falloff);
    vec2 o = dir * t * p_length;
    vec3 a = texture(uInput, uv + o).rgb, b = texture(uInput, uv - o).rgb;
    vec3 m = max(a - p_threshold, 0.) + max(b - p_threshold, 0.);
    vec3 tintc = mix(vec3(1.), p_tint, t * p_chroma);
    s += m * w * tintc; wsum += w;
  }
  return s / max(wsum, 1e-4);
}
vec4 fx(vec2 uv){
  vec3 c = texture(uInput, uv).rgb;
  float a = radians(p_angle);
  vec2 h = rot(a) * vec2(1., 0.) / vec2(aspect(), 1.), v = rot(a) * vec2(0., 1.);
  int s = int(p_shape + .5);
  vec3 acc = vec3(0.);
  if (s == 0) acc = streak(uv, h);
  else if (s == 1) acc = streak(uv, v);
  else if (s == 2) acc = streak(uv, h) + streak(uv, v);
  else if (s == 3){ acc = streak(uv, h) + streak(uv, v) + streak(uv, normalize(h + v) * .8) + streak(uv, normalize(h - v) * .8); acc *= .7; }
  else acc = streak(uv, normalize(h + v));
  vec3 col = (p_keep > .5 ? c : vec3(0.)) + acc * p_intensity;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Melt ---- */
FX.register({ id:'fx-melt', name:'Melt', cat:'fx', feedback:true, nonLocal:true, desc:'The image runs and drips like wet paint, in any direction, building up over time.', search:['feedback'],
  params:[ R('speed','Flow speed',1,0,4), S('direction','Direction',['Down','Up','Left','Right','Toward the centre'],0), R('variation','Drip variation',.7,0,2), R('threshold','Melt the darks above',0,0,1), R('smear','Smear',.35,0,1), R('decay','Return to the frame',.12,0,1), T('freeze','Freeze with the timeline',false), R('grain','Grain',.05,0,.5) ],
  fs:`vec4 fx(vec2 uv){
  vec3 src = texture(uInput, uv).rgb;
  vec4 pv = texture(uPrev, uv);
  if (pv.a < .5) return vec4(src, 1.);
  float run = p_freeze > .5 ? (1. - uProgress) : 1.;
  float sp = p_speed * run * 1.6 / uRes.y;
  float var = .4 + fbm(vec2(uv.x * 40., 3.1)) * p_variation * 2.2;
  int d = int(p_direction + .5);
  vec2 dir = d == 0 ? vec2(0., -1.) : d == 1 ? vec2(0., 1.) : d == 2 ? vec2(1., 0.) : d == 3 ? vec2(-1., 0.) : normalize(vec2(.5) - uv + 1e-4);
  vec3 pulled = texture(uPrev, uv + dir * sp * var).rgb;
  float l = luma(pulled);
  float take = smoothstep(p_threshold - .1, p_threshold + .3, 1. - l);
  vec3 col = mix(pv.rgb, pulled, clamp(.35 + p_smear * .6, 0., 1.) * take);
  col = mix(col, src, p_decay * .25);
  col += (hash12(uv * uRes + floor(uTime * 24.)) - .5) * p_grain * .08;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Datamosh ---- */
FX.register({ id:'fx-datamosh', name:'Datamosh', cat:'fx', feedback:true, nonLocal:true, desc:'Blocks of the frame smear and lag behind, like a broken video stream. Fires on the beat.', search:['feedback'],
  params:[ R('block','Block size',24,4,120,1), R('amount','Smear',.6,0,1), I('beats','Beats per loop (0 = brand)',0,0,32), R('burst','Burst length',.35,.05,1), R('drift','Drift',1,0,4), R('colour','Colour rot',.3,0,1), R('keyframe','Refresh',.25,0,1), T('edges','Block edges',false) ],
  fs:`vec4 fx(vec2 uv){
  vec3 src = texture(uInput, uv).rgb;
  vec4 pv = texture(uPrev, uv);
  if (pv.a < .5) return vec4(src, 1.);
  float beats = p_beats < .5 ? 4. : p_beats;
  float f = uLoop * beats, lt = fract(f), idx = floor(f);
  float burstK = step(lt, p_burst) * p_amount;
  vec2 bs = vec2(max(p_block, 2.)) / uRes;
  vec2 id = floor(uv / bs);
  vec2 mv = (hash22(id + idx * 7.3) - .5) * 2. * p_drift * bs * (1. + p_amount * 2.);
  float keep = step(hash12(id + idx * 3.1), 1. - p_keyframe);
  vec3 moshed = texture(uPrev, uv - mv * burstK).rgb;
  if (p_colour > .001){ vec3 h = rgb2hsv(moshed); h.x = fract(h.x + hash12(id + idx) * p_colour * burstK); moshed = hsv2rgb(h); }
  vec3 col = mix(src, moshed, burstK * keep);
  if (p_edges > .5){
    vec2 fr = fract(uv / bs);
    float e = min(min(fr.x, fr.y), min(1. - fr.x, 1. - fr.y));
    col = mix(col, col * .6, (1. - smoothstep(0., .04, e)) * burstK * keep);
  }
  return vec4(col, 1.);
}` });