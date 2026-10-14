/* ---------------- Transitions: reading ---------------- */
/* Transitions that read both pictures and let their content decide the change:
   where it starts, what goes first, which way it moves. The same module gives a
   different move on every pair of images. Regional statistics come from low mip
   levels (textureLod), which are free blurs of the sources. Every one starts
   exactly on A and ends exactly on B. */

FX.register({ id:'tr-hue-family', name:'Hue families', cat:'transition', family:'reading', search:['colour', 'hue', 'palette', 'by colour', 'segment', 'colour wheel'],
  desc:'The picture changes over one colour family at a time, from the start hue out to its opposite on the wheel, so every pair of images hands over in its own order.',
  params:[ S('read','Read colours from',['B','A','Both'],2), R('start','Start hue',30,0,360,1), I('families','Families',6,2,12), R('group','Grouping',.6,0,1), S('greys','Greys and neutrals',['Go last','Go first']), R('region','Region size',4,1,7,.1), R('soft','Softness',.12,.02,.4), R('glow','Glow',.35,0,1) ],
  fs:`vec3 huefam_hsv(sampler2D t, vec2 uv){
  vec2 o = exp2(p_region) / vec2(textureSize(t, 0)) * .5;
  return rgb2hsv(.5 * (textureLod(t, uv + o, p_region).rgb + textureLod(t, uv - o, p_region).rgb));
}
/* when this colour's family turns: families step out from the start hue to its complement; greys wait at one end */
float huefam_ord(vec3 h, out float grey){
  float n = max(p_families, 2.);
  /* distance round the wheel from the start hue, both ways, so there is no seam where the wheel wraps */
  float hue = abs(fract(h.x - p_start / 360. + .5) - .5) * 2.;
  float key = mix(hue, min(floor(hue * n) / (n - 1.), 1.), p_group);
  grey = clamp(2. - smoothstep(.05, .2, h.y) - smoothstep(.04, .15, h.z), 0., 1.);
  return p_greys < .5 ? mix(key * .82, .82 + .18 * h.z, grey) : mix(.18 + key * .82, .18 * h.z, grey);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 ha = huefam_hsv(uA, uv), hb = huefam_hsv(uB, uv);
  float ga, gb;
  float oa = huefam_ord(ha, ga), ob = huefam_ord(hb, gb);
  int r = int(p_read + .5);
  /* reading both: the more colourful picture has the bigger say, and the blend stays continuous */
  float wb = r == 0 ? 1. : r == 1 ? 0. : (hb.y + .02) / (ha.y + hb.y + .04);
  float ord = mix(oa, ob, wb), grey = mix(ga, gb, wb);
  ord = clamp(ord + .05 * (luma(textureLod(uB, uv, 1.).rgb) - .5), 0., 1.);
  float w = p_soft;
  float m = smoothstep(0., 1., (p * (1. + w) - ord) / w);
  vec3 col = mix(A, B, m);
  /* each family lights up in its own hue while it turns */
  float rim = 4. * m * (1. - m) * (1. - grey);
  vec3 tint = mix(hsv2rgb(vec3(ha.x, .75, 1.)), hsv2rgb(vec3(hb.x, .75, 1.)), wb);
  col = 1. - (1. - col) * (1. - rim * p_glow * .55 * tint);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-contour-fill', name:'Contours then fill', cat:'transition', family:'reading', search:['line drawing', 'outline', 'edges', 'sketch', 'flood', 'contour'],
  desc:'B’s own contours are drawn over A, strongest first, and then its colour floods out from the lines, busy areas before open ones.',
  params:[ S('ink','Lines in',['B’s own colour, deepened','Ink']), C('inkc','Ink','#151515','ink'), R('weight','Line weight',1.2,.5,4,.1), R('detail','Line detail',.5,0,1), R('spread','Fill softness',.65,0,1), R('wobble','Front texture',.4,0,1) ],
  fs:`float cf_l(vec2 uv, float l){ return luma(textureLod(uB, uv, l).rgb); }
float cf_grad(vec2 uv, float l, vec2 o){
  return length(vec2(cf_l(uv + vec2(o.x, 0.), l) - cf_l(uv - vec2(o.x, 0.), l), cf_l(uv + vec2(0., o.y), l) - cf_l(uv - vec2(0., o.y), l)));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec2 tx = 1. / vec2(textureSize(uB, 0));
  /* the drawing: B's gradient at near full resolution */
  float e = cf_grad(uv, .5, tx * p_weight);
  float thr = mix(.22, .04, p_detail);
  float strength = clamp(e / (thr * 4.), 0., 1.);
  float draw = smoothstep(0., .42, p);
  float line = smoothstep(thr, thr * 1.8, e) * smoothstep(0., .08, draw - (1. - strength) * .9);
  /* how busy the neighbourhood is, read at four scales: busy places fill first, open sky last */
  float D = cf_grad(uv, 2., tx * 4.) * .7 + cf_grad(uv, 3., tx * 8.) * .9 + cf_grad(uv, 4., tx * 16.) * 1.1 + cf_grad(uv, 5., tx * 32.) * 1.3;
  float ord = 1. - clamp(D * 2.2, 0., 1.);
  ord = clamp(ord + p_wobble * .25 * (fbm(centered(uv) * 9.) - .5), 0., 1.);
  float w = mix(.05, .45, p_spread);
  float fillT = smoothstep(.22, .97, p);
  float m = smoothstep(0., 1., (fillT * (1. + w) - ord) / w);
  vec3 ink = p_ink < .5 ? B * B * .55 : p_inkc;
  vec3 col = mix(A, B, m);
  float fade = 1. - smoothstep(.72, 1., p);
  col = mix(col, ink, line * fade * (1. - .5 * m));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-luma-parallax', name:'Luma parallax', cat:'transition', family:'reading', nonLocal:true, search:['depth', '3d', 'relief', 'parallax', '2.5d', 'depth map'],
  desc:'Both pictures are read as relief from their own light and shade, the camera drifts over them, and the layers hand over nearest first.',
  params:[ R('depth','Depth',.06,0,.15,.001), S('move','Camera',['Drift up','Drift across','Circle']), S('near','Near is',['Bright','Dark']), S('order','Hand over',['Nearest first','Farthest first']), R('level','Relief smoothness',3,1,6,.1), R('light','Relief light',.5,0,1), R('soft','Softness',.18,.04,.5) ],
  fs:`float lp_h(sampler2D t, vec2 uv){ float l = luma(textureLod(t, clamp(uv, 0., 1.), p_level).rgb); return p_near < .5 ? l : 1. - l; }
/* parallax occlusion: walk the view ray down through the height field until it is under the surface */
vec2 lp_march(sampler2D t, vec2 uv, vec2 view, out float hit){
  vec2 cur = uv + view * .5;
  float layer = 1., h = lp_h(t, cur), ph = h, pl = layer;
  vec2 prev = cur;
  for (int i = 0; i < 16; i++){
    if (layer <= h) break;
    prev = cur; ph = h; pl = layer;
    cur -= view / 16.; layer -= 1. / 16.;
    h = lp_h(t, cur);
  }
  /* refine between the last two layers */
  float a = h - layer, b = ph - pl;
  float k = abs(a - b) > 1e-5 ? clamp(a / (a - b), 0., 1.) : 0.;
  hit = mix(h, ph, k);
  return mix(cur, prev, k);
}
vec3 lp_shade(sampler2D t, vec2 q, vec3 c, float env){
  vec2 e = exp2(p_level) / vec2(textureSize(t, 0));
  float h = lp_h(t, q);
  vec2 g = vec2(lp_h(t, q + vec2(e.x, 0.)) - h, lp_h(t, q + vec2(0., e.y)) - h);
  float lit = dot(g, normalize(vec2(-1., 1.))) * 6.;
  return c * (1. + p_light * env * clamp(lit, -.6, .6));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float env = sin(PI * p);
  int mv = int(p_move + .5);
  vec2 dir = mv == 0 ? vec2(0., -1.) : mv == 1 ? vec2(1., 0.) : vec2(cos(p * TAU), sin(p * TAU));
  vec2 view = dir * p_depth * env / vec2(aspect(), 1.);
  float ha, hb;
  vec2 qa = lp_march(uA, uv, view, ha), qb = lp_march(uB, uv, view, hb);
  vec3 A = texture(uA, clamp(qa, 0., 1.)).rgb, B = texture(uB, clamp(qb, 0., 1.)).rgb;
  A = lp_shade(uA, qa, A, env); B = lp_shade(uB, qb, B, env);
  float z = .5 * (ha + hb);
  float ord = p_order < .5 ? 1. - z : z;
  float w = p_soft;
  float m = smoothstep(0., 1., (p * (1. + w) - ord) / w);
  return vec4(clamp(mix(A, B, m), 0., 1.), 1.);
}` });

FX.register({ id:'tr-salient-first', name:'Salient first', cat:'transition', family:'reading', nonLocal:true, search:['saliency', 'focus', 'subject', 'eye', 'attention', 'contrast'],
  desc:'Whatever catches the eye in B arrives first, as islands that spread, and the quiet background settles in last.',
  params:[ S('read','Read from',['B, what arrives','A, what leaves','Both']), R('scale','Island size',3,1,5,.1), R('gain','Contrast',1,.3,3), R('soft','Softness',.18,.05,.5), R('halo','Halo',.4,0,1) ],
  fs:`float sal_s(sampler2D t, vec2 uv){
  float L = p_scale;
  vec3 c1 = textureLod(t, uv, L).rgb, c2 = textureLod(t, uv, L + 1.5).rgb, c3 = textureLod(t, uv, L + 3.).rgb;
  vec3 g = textureLod(t, vec2(.5), 12.).rgb;
  /* centre against surround at two scales, how unlike the whole frame it is, and colourfulness */
  float s = length(c1 - c3) * 1.2 + length(c2 - c3) * .8 + length(c1 - g) * .6 + rgb2hsv(c1).y * .25;
  return s;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  int r = int(p_read + .5);
  float s = r == 0 ? sal_s(uB, uv) : r == 1 ? sal_s(uA, uv) : max(sal_s(uA, uv), sal_s(uB, uv));
  float ord = 1. - smoothstep(.05, .9, s * p_gain);
  ord = clamp(ord * .92 + .08 * luma(textureLod(uB, uv, 1.).rgb), 0., 1.);
  float w = p_soft;
  float m = smoothstep(0., 1., (p * (1. + w) - ord) / w);
  vec3 col = mix(A, B, m);
  float rim = 4. * m * (1. - m);
  col = 1. - (1. - col) * (1. - p_halo * .35 * rim * (.4 + .6 * B));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-grade-match', name:'Grade match', cat:'transition', family:'reading', nonLocal:true, search:['colour match', 'grade', 'colour transfer', 'match cut', 'lut', 'harmonise'],
  desc:'The two pictures meet on a shared grade measured from both, swap where their tones agree, and then B releases into its own colour.',
  params:[ S('meet','Meet',['In the middle','A takes B’s grade first','B arrives in A’s grade']), R('strength','Match strength',1,0,1), R('soft','Swap softness',.25,.05,.6), R('level','Sample detail',4,2,6,.1) ],
  fs:`void gm_stats(sampler2D t, out vec3 mu, out vec3 sd){
  vec3 s = vec3(0.), s2 = vec3(0.);
  for (int i = 0; i < 16; i++){
    vec2 q = fract(.5 + float(i) * vec2(.7548776662, .5698402910));
    vec3 c = textureLod(t, q, p_level).rgb;
    s += c; s2 += c * c;
  }
  mu = s / 16.; sd = sqrt(max(s2 / 16. - mu * mu, 1e-4));
}
vec3 gm_xfer(vec3 c, vec3 m0, vec3 s0, vec3 m1, vec3 s1){ return clamp((c - m0) * clamp(s1 / s0, .3, 3.) + m1, 0., 1.); }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  vec3 ma, sa, mb, sb;
  gm_stats(uA, ma, sa); gm_stats(uB, mb, sb);
  int mode = int(p_meet + .5);
  float G = mode == 0 ? smoothstep(0., 1., p) : mode == 1 ? smoothstep(0., .45, p) : smoothstep(.55, 1., p);
  float c0 = mode == 0 ? .2 : mode == 1 ? .42 : .03;
  float span = mode == 0 ? .6 : .55;
  vec3 Ag = mix(A, gm_xfer(A, ma, sa, mb, sb), G * p_strength);
  vec3 Bg = mix(B, gm_xfer(B, mb, sb, ma, sa), (1. - G) * p_strength);
  /* with the grades matched, the swap starts where the two tones already agree */
  float ord = clamp(abs(luma(Ag) - luma(Bg)) * 2.5, 0., 1.);
  float w = p_soft;
  float t = clamp((p - c0) / span, 0., 1.);
  float m = smoothstep(0., 1., (t * (1. + w) - ord) / w);
  return vec4(mix(Ag, Bg, m), 1.);
}` });

FX.register({ id:'tr-scale-relay', name:'Scale relay', cat:'transition', family:'reading', search:['frequency', 'cross synthesis', 'detail', 'colour first', 'structure', 'blur'],
  desc:'B’s light and colour arrive first and its detail last, so the middle is A’s drawing in B’s colour; or the other way round.',
  params:[ S('order','Order',['Light and colour first','Detail first']), R('stagger','Stagger',.6,0,1), R('coarse','Coarse level',5,3,7,.1), R('boost','Detail boost',.35,0,1) ],
  fs:`/* a mip level read through four rotated taps, so the coarse grid of the mip does not show */
vec3 sr_low(sampler2D t, vec2 uv, float l){
  vec2 o = exp2(l) / vec2(textureSize(t, 0)) * .5;
  return (textureLod(t, uv + vec2(o.x, o.y * .3), l).rgb + textureLod(t, uv - vec2(o.x, o.y * .3), l).rgb
        + textureLod(t, uv + vec2(-o.x * .3, o.y), l).rgb + textureLod(t, uv + vec2(o.x * .3, -o.y), l).rgb) * .25;
}
float sr_win(float p, float k){
  float st = p_stagger * .35;
  return smoothstep(k * st, k * st + 1. - 2. * st, p);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a0 = texture(uA, uv).rgb, b0 = texture(uB, uv).rgb;
  float lm = p_coarse - 2.5;
  vec3 a1 = sr_low(uA, uv, lm), b1 = sr_low(uB, uv, lm);
  vec3 a2 = sr_low(uA, uv, p_coarse), b2 = sr_low(uB, uv, p_coarse);
  bool cf = p_order < .5;
  float wc = sr_win(p, cf ? 0. : 2.), wm = sr_win(p, 1.), wf = sr_win(p, cf ? 2. : 0.);
  float boost = 1. + p_boost * sin(PI * p);
  vec3 col = mix(a2, b2, wc) + (mix(a1 - a2, b1 - b2, wm) + mix(a0 - a1, b0 - b1, wf)) * boost;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-palette-borrow', name:'Palette borrow', cat:'transition', family:'reading', nonLocal:true, search:['gradient map', 'palette', 'recolour', 'colour transfer', 'duotone'],
  desc:'B appears painted in A’s colours, each tone taking the colour A gives that tone, and then its own colours come through.',
  params:[ R('sharp','Palette sharpness',.55,0,1), S('release','Own colour returns',['Lights first','Shadows first','All at once']), R('hold','Hold',.25,0,.6), R('soft','Softness',.2,.05,.5) ],
  fs:`vec3 pb_paint(float lb){
  vec3 acc = vec3(0.); float ws = 0.;
  float sig = mix(.12, .025, p_sharp);
  for (int i = 0; i < 24; i++){
    vec2 q = fract(.5 + float(i) * vec2(.7548776662, .5698402910));
    vec3 c = textureLod(uA, q, 3.).rgb;
    float d = luma(c) - lb;
    float w = exp(-d * d / (sig * sig)) + 1e-5;
    acc += c * w; ws += w;
  }
  vec3 c = acc / ws;
  float lc = luma(c);
  c = mix(vec3(lc), c, 1.3);
  return clamp(c * (lb + .02) / (lc + .02), 0., 1.);
}
float pb_win(float p, float a, float b, float ord, float w){
  float t = clamp((p - a) / (b - a), 0., 1.);
  return smoothstep(0., 1., (t * (1. + w) - ord) / w);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  float lb = luma(B);
  vec3 P = pb_paint(lb);
  float w = p_soft;
  /* B's drawing comes in through A's palette, darks first */
  float m1 = pb_win(p, 0., .55 - p_hold * .5, clamp(lb, 0., 1.), w);
  int rl = int(p_release + .5);
  float ord2 = rl == 0 ? 1. - lb : rl == 1 ? lb : .5;
  float m2 = pb_win(p, .45 + p_hold * .5, 1., clamp(ord2, 0., 1.), rl == 2 ? 1. : w);
  return vec4(mix(mix(A, P, m1), B, m2), 1.);
}` });

FX.register({ id:'tr-least-difference', name:'Least difference', cat:'transition', family:'reading', nonLocal:true, search:['seam', 'hidden cut', 'wipe', 'match', 'seamless'],
  desc:'A wipe whose edge lingers where the two pictures agree and races across where they differ, so the seam hides in what they share.',
  params:[ S('dir','Direction',DIRS4,1), S('linger','Edge lingers where',['The pictures agree','The pictures differ']), R('pull','Content pull',3,0,8), R('soft','Softness',.04,.005,.2,.001), R('line','Seam light',.3,0,1) ],
  fs:`float ld_cost(vec2 uv){
  vec3 a = textureLod(uA, uv, 4.).rgb, b = textureLod(uB, uv, 4.).rgb;
  float d = clamp(length(a - b) * 1.4, 0., 1.);
  float k = p_linger < .5 ? 1. - d : d;
  return .12 + p_pull * k * k;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  int m = int(p_dir + .5);
  /* s runs along the wipe from its starting edge; the cross coordinate stays fixed */
  float s = m == 0 ? 1. - uv.y : m == 1 ? uv.x : m == 2 ? uv.y : 1. - uv.x;
  float tot = 0., part = 0.;
  for (int i = 0; i < 20; i++){
    float si = (float(i) + .5) / 20.;
    vec2 q = m == 0 ? vec2(uv.x, 1. - si) : m == 1 ? vec2(si, uv.y) : m == 2 ? vec2(uv.x, si) : vec2(1. - si, uv.y);
    float c = ld_cost(q + vec2(0., .004));
    c = .5 * (c + ld_cost(q - vec2(0., .004)));
    tot += c;
    part += c * clamp(s * 20. - float(i), 0., 1.);
  }
  float T = part / tot;
  float w = p_soft;
  float x = p * (1. + 2. * w) - w - T;
  float k = smoothstep(-w, w, x);
  vec3 col = mix(A, B, k);
  float px = abs(x) / max(fwidth(T), 1e-6);
  col += p_line * sin(PI * p) * exp(-px * .6) * .8;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-light-flood', name:'Light flood', cat:'transition', family:'reading', nonLocal:true, search:['flood fill', 'pour', 'spread', 'light', 'brightest', 'glow'],
  desc:'B pours out from its own brightest point and spreads across the frame, running fast through tones like the light and slowly through what is unlike it.',
  params:[ S('from','Pours from',['Brightest point of B','Brightest point of A','Darkest point of B']), R('hold','Tone hold',2,0,6), R('soft','Softness',.06,.01,.2), R('glow','Glow',.5,0,1) ],
  fs:`vec2 lf_seed(sampler2D t, bool dark){
  vec2 acc = vec2(0.); float ws = 0.;
  for (int j = 0; j < 5; j++) for (int i = 0; i < 5; i++){
    vec2 q = (vec2(i, j) + .5) / 5.;
    float l = luma(textureLod(t, q, 5.).rgb);
    if (dark) l = 1. - l;
    float w = exp(20. * l);
    acc += q * w; ws += w;
  }
  return acc / ws;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  int f = int(p_from + .5);
  vec2 seed = f == 1 ? lf_seed(uA, false) : lf_seed(uB, f == 2);
  vec2 asp = vec2(aspect(), 1.);
  /* arrival time: the distance from the seed, stretched wherever the tone differs from the tone at the seed,
     so the light runs through its own tones first and is held back at what is unlike it */
  float ls = luma(f == 1 ? textureLod(uA, seed, 4.).rgb : textureLod(uB, seed, 4.).rgb);
  float l = luma(f == 1 ? textureLod(uA, uv, 3.).rgb : textureLod(uB, uv, 3.).rgb);
  float dist = length((uv - seed) * asp);
  float dmax = max(max(length(seed * asp), length((seed - vec2(1., 0.)) * asp)), max(length((seed - vec2(0., 1.)) * asp), length((seed - vec2(1.)) * asp)));
  float T = clamp(dist / dmax * (1. + p_hold * abs(l - ls)) / (1. + p_hold * .5), 0., 1.);
  float w = p_soft;
  float x = p * (1. + 2. * w) - w - T;
  float k = smoothstep(-w, w, x);
  vec3 col = mix(A, B, k);
  float g = exp(-abs(x) / (w * 1.2)) * sin(PI * p) * p_glow;
  col = 1. - (1. - col) * (1. - g * (.35 + .65 * B));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-grain-smear', name:'Grain smear', cat:'transition', family:'reading', nonLocal:true, search:['brush', 'streak', 'flow', 'line integral', 'painterly', 'smear'],
  desc:'A is brushed out along the run of its own forms and B is brushed back in along its, as if the paint were still wet.',
  params:[ R('length','Smear length',.16,0,.3,.005), S('along','Brush',['Along the forms','Across the forms']), R('level','Grain scale',4,1,6,.1), R('cross','Cross-over',.5,.1,1) ],
  fs:`/* the gradient as a doubled angle, so opposite gradients agree on the same line */
vec2 gs_tensor(sampler2D t, vec2 uv){
  vec2 e = exp2(p_level) / vec2(textureSize(t, 0));
  float gx = luma(textureLod(t, uv + vec2(e.x, 0.), p_level).rgb) - luma(textureLod(t, uv - vec2(e.x, 0.), p_level).rgb);
  float gy = luma(textureLod(t, uv + vec2(0., e.y), p_level).rgb) - luma(textureLod(t, uv - vec2(0., e.y), p_level).rgb);
  return vec2(gx * gx - gy * gy, 2. * gx * gy);
}
vec3 gs_smear(sampler2D t, vec2 uv, vec2 d){
  vec3 acc = vec3(0.); float ws = 0.;
  for (int i = 0; i < 12; i++){
    float u = (float(i) + .5) / 12. - .5;
    float w = 1. - abs(u) * 1.2;
    acc += texture(t, clamp(uv + d * u, 0., 1.)).rgb * w; ws += w;
  }
  return acc / ws;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 j = mix(gs_tensor(uA, uv), gs_tensor(uB, uv), smoothstep(.2, .8, p));
  float a = .5 * atan(j.y, j.x + 1e-7);
  if (p_along < .5) a += PI * .5;
  float conf = smoothstep(0., .002, length(j));
  vec2 d = mix(vec2(1., 0.), vec2(cos(a), sin(a)), conf) / vec2(aspect(), 1.) * p_length * sin(PI * p);
  vec3 A = p > 0. ? gs_smear(uA, uv, d) : texture(uA, uv).rgb;
  vec3 B = p < 1. ? gs_smear(uB, uv, d) : texture(uB, uv).rgb;
  return vec4(mix(A, B, smoothstep(.5 - p_cross * .5, .5 + p_cross * .5, p)), 1.);
}` });

FX.register({ id:'tr-codec-morph', name:'Codec morph', cat:'transition', family:'reading', nonLocal:true, search:['motion vectors', 'datamosh', 'prediction', 'blocks', 'compression', 'codec'],
  desc:'B is first rebuilt from blocks of A, each moved to where it best matches, as a video codec would predict it, and then the real B refreshes block by block.',
  params:[ R('block','Block size',.05,.02,.15,.001), R('reach','Search reach',.16,.03,.35,.005), S('refresh','Refresh',['Random order','Worst matches first']), R('edges','Block edges',.25,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 asp = vec2(aspect(), 1.);
  vec2 cp = centered(uv) / p_block;
  vec2 cell = floor(cp);
  vec2 cc = uncentered((cell + .5) * p_block);
  vec2 hb = vec2(p_block * .25) / asp;
  float L = max(log2(p_block * float(textureSize(uB, 0).y)) - 1.5, 0.);
  /* B's block described by two quarter-block averages; look for the place in A that matches it */
  vec3 d1 = textureLod(uB, clamp(cc - hb, 0., 1.), L).rgb, d2 = textureLod(uB, clamp(cc + hb, 0., 1.), L).rgb;
  vec2 best = vec2(0.);
  float bs = 1e9;
  for (int i = 0; i < 17; i++){
    vec2 o = vec2(0.);
    if (i > 0){
      float fi = float(i - 1);
      float r = fi < 8. ? .5 : 1.;
      float an = fi * PI * .25 + (fi < 8. ? 0. : PI * .125);
      o = vec2(cos(an), sin(an)) * r * p_reach / asp;
    }
    vec2 q = cc + o;
    vec3 e1 = textureLod(uA, clamp(q - hb, 0., 1.), L).rgb - d1, e2 = textureLod(uA, clamp(q + hb, 0., 1.), L).rgb - d2;
    float sc = dot(e1, e1) + dot(e2, e2) + .002 * dot(o * asp, o * asp) / (p_reach * p_reach);
    if (sc < bs){ bs = sc; best = o; }
  }
  float mv = smoothstep(0., .55, p);
  vec3 P = texture(uA, clamp(uv + best * mv, 0., 1.)).rgb;
  vec3 B = texture(uB, uv).rgb;
  float r = p_refresh < .5 ? hash12(cell + 7.3) : 1. - smoothstep(0., .25, bs);
  float s0 = mix(.42, .84, r);
  float k = smoothstep(s0, s0 + .14, p);
  vec3 col = mix(P, B, k);
  vec2 f = fract(cp);
  float edge = 1. - smoothstep(0., .04, min(min(f.x, 1. - f.x), min(f.y, 1. - f.y)));
  col *= 1. - p_edges * .35 * edge * sin(PI * p) * (1. - k);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-figure-ground', name:'Figure and ground', cat:'transition', family:'reading', nonLocal:true, search:['subject', 'background', 'foreground', 'cut out', 'clean plate', 'segmentation', 'shadow'],
  desc:'Reads each picture’s subject against its own background: A’s subject is lifted out to leave bare ground, the ground changes over, and B’s subject lands on it with a soft shadow.',
  params:[ R('thresh','Figure threshold',.16,.04,.5), R('stagger','Stagger',.5,0,1), R('shadow','Shadow',.5,0,1), R('drop','Drop',.05,0,.12,.001), R('mottle','Ground texture',.5,0,1) ],
  fs:`/* the ground as if the frame held nothing: a Coons patch stretched between the picture's own edges */
vec3 fg_plate(sampler2D t, vec2 uv){
  float e = .03, L = 5.;
  vec2 u = clamp(uv, e, 1. - e);
  vec3 l = textureLod(t, vec2(e, u.y), L).rgb, r = textureLod(t, vec2(1. - e, u.y), L).rgb;
  vec3 b = textureLod(t, vec2(u.x, e), L).rgb, tp = textureLod(t, vec2(u.x, 1. - e), L).rgb;
  vec3 c00 = textureLod(t, vec2(e), L).rgb, c10 = textureLod(t, vec2(1. - e, e), L).rgb;
  vec3 c01 = textureLod(t, vec2(e, 1. - e), L).rgb, c11 = textureLod(t, vec2(1. - e), L).rgb;
  float x = uv.x, y = uv.y;
  return clamp((1. - x) * l + x * r + (1. - y) * b + y * tp
       - ((1. - x) * (1. - y) * c00 + x * (1. - y) * c10 + (1. - x) * y * c01 + x * y * c11), 0., 1.);
}
float fg_fig(sampler2D t, vec2 uv, vec3 plate){
  vec3 c = textureLod(t, clamp(uv, 0., 1.), 3.).rgb;
  return smoothstep(p_thresh * .5, p_thresh * 1.5, length(c - plate));
}
/* a generous version of the subject, so a lifted subject leaves no rim behind */
float fg_hole(sampler2D t, vec2 uv, vec3 plate){
  vec3 c = textureLod(t, clamp(uv, 0., 1.), 4.5).rgb;
  return max(fg_fig(t, uv, plate), smoothstep(p_thresh * .3, p_thresh * .8, length(c - plate)));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 pa = fg_plate(uA, uv), pb = fg_plate(uB, uv);
  float fa = fg_fig(uA, uv, pa), fb = fg_fig(uB, uv, pb);
  float st = p_stagger * .25;
  /* three overlapping stages: A's subject out, ground over, B's subject in */
  float out_ = smoothstep(.04, .4 - st * .4, p);
  /* the ground changes over where the two bare plates already agree first */
  float gord = clamp(length(pa - pb) * 1.6 * (1. - p_mottle * .5) + p_mottle * .7 * (fbm(centered(uv) * 4. + 3.) - .25), 0., 1.);
  float gt = smoothstep(.2 - st * .3, .62 + st * .1, p);
  float gnd = smoothstep(0., 1., (gt * 1.3 - gord) / .3);
  float land = smoothstep(.58 + st * .2, .74 + st * .2, p);
  float fall = 1. - smoothstep(.58 + st * .2, .96, p);
  vec3 E = mix(pa, pb, gnd);                       /* the bare ground, between the two plates */
  vec3 A = texture(uA, uv).rgb;
  vec3 aHole = mix(A, E, out_ * fg_hole(uA, uv, pa));
  vec2 dv = vec2(0., p_drop) * fall * fall;
  float fbD = fg_fig(uB, uv - dv, pb);
  vec3 Bd = texture(uB, clamp(uv - dv, 0., 1.)).rgb;
  vec3 bGround = mix(texture(uB, uv).rgb, E, fg_hole(uB, uv, pb));
  vec3 col = mix(aHole, bGround, gnd);
  col = mix(col, Bd, fg_hole(uB, uv - dv, pb) * land);
  /* B's subject casts a soft shadow down and to the right while it is in the air */
  vec2 off = vec2(.02 / aspect(), -.026) + dv;
  float sh = fg_fig(uB, uv - off, pb) * (1. - fbD * land);
  col *= 1. - p_shadow * .5 * sh * land * smoothstep(1., .9, p) * (.4 + 6. * length(dv));
  col = mix(col, texture(uB, uv).rgb, smoothstep(.9, 1., p));
  return vec4(clamp(col, 0., 1.), 1.);
}` });
