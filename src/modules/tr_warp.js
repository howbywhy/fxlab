/* ---------------- Transitions: warp ----------------
   Distortion-led transitions: the picture bends, folds, flows or breaks into cells
   while A becomes B. Every one is exactly A at p=0 and exactly B at p=1. */

FX.register({ id:'tr-mosaic-fade', name:'Mosaic crossfade', cat:'transition', search:['pixelate', 'pixelize', 'hexagon', 'hex', 'blocks', 'mosaic'],
  desc:'The picture coarsens into square or hexagonal cells, crossfades while it is at its coarsest, then sharpens up as B.',
  params:[ S('shape','Cells',['Square','Hexagon'],0), R('cells','Coarsest cells',14,3,60,1), I('steps','Steps',0,0,24), R('soft','Crossfade width',.35,0,1), R('jitter','Cell stagger',.25,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float t = 1. - abs(p * 2. - 1.);
  if (p_steps > .5) t = ceil(t * p_steps - 1e-4) / p_steps;
  if (t <= 0.) return vec4(p < .5 ? texture(uA, uv).rgb : texture(uB, uv).rgb, 1.);
  float cells = exp(mix(log(uRes.y), log(p_cells), pow(t, .7)));
  vec2 q = centered(uv) * cells;
  vec2 ctr;
  if (int(p_shape + .5) == 1){
    vec2 r = vec2(1., 1.7320508), h = r * .5;
    vec2 a = mod(q, r) - h, b = mod(q - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    ctr = q - gv;
  } else ctr = floor(q) + .5;
  vec2 st = uncentered(ctr / cells);
  float w = max(p_soft, .002) * .5;
  float m = smoothstep(.5 - w, .5 + w, p + (hash12(floor(ctr * 2.) + 7.) - .5) * p_jitter * .5 * t);
  return vec4(mix(texture(uA, st).rgb, texture(uB, st).rgb, m), 1.);
}` });

FX.register({ id:'tr-swirl', name:'Swirl', cat:'transition', search:['twirl', 'vortex', 'twist', 'whirlpool', 'twister'],
  desc:'The middle of the frame winds up like water down a drain, and B unwinds out of it.',
  params:[ R('turns','Twist',1.25,-4,4), R('radius','Radius',.75,.2,1.5), R('pull','Pull in',.35,0,1), S('unwind','B unwinds',['Same way','Back the other way'],0), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1) ],
  fs:`vec2 swirl_at(vec2 c, vec2 o, float k, float pull){
  vec2 q = c - o; float r = length(q);
  float f = max(0., (p_radius - r) / p_radius); f *= f;
  q = rot(f * k * TAU) * q;
  q *= 1. + pull * f * 1.4;
  return mirrorUv(uncentered(q + o));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float e = sin(p * PI); e = e * e * (3. - 2. * e);
  vec2 c = centered(uv);
  vec2 o = vec2(p_x * aspect() * .5, p_y * .5);
  float kb = int(p_unwind + .5) == 1 ? -p_turns : p_turns;
  vec3 A = texture(uA, swirl_at(c, o, p_turns * e, p_pull * e)).rgb;
  vec3 B = texture(uB, swirl_at(c, o, kb * e, p_pull * e)).rgb;
  return vec4(mix(A, B, smoothstep(.3, .7, p)), 1.);
}` });

FX.register({ id:'tr-kaleido-through', name:'Kaleidoscope through', cat:'transition', nonLocal:true, search:['kaleidoscope', 'mirror', 'tunnel', 'fold'],
  desc:'A folds into a turning kaleidoscope, the images change over while it is fully folded, and it opens out again as B.',
  params:[ I('segments','Segments',6,2,16), R('spin','Spin',.35,-2,2), R('zoom','Zoom',.7,.4,3), R('fold','Fold speed',.6,.1,1) ],
  fs:`vec2 kaleido_uv(vec2 c, float spin, float z){
  float seg = TAU / max(p_segments, 2.);
  float a = atan(c.y, c.x) + spin;
  a = mod(a, seg); a = abs(a - seg * .5);
  vec2 q = vec2(cos(a), sin(a)) * length(c) / z;
  return mirrorUv(uncentered(q));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float tent = 1. - abs(p * 2. - 1.);
  float f = smoothstep(0., p_fold, tent);
  vec2 c = centered(uv);
  float far = length(vec2(aspect(), 1.)) * .5;
  float R = f * (far + .12);
  float r = length(c);
  /* the fold opens from the middle as a widening disc, so nothing is ever ghosted */
  float inside = smoothstep(R, R - .1, r) * step(.001, f);
  float spin = (p - .5) * p_spin * TAU;
  float z = mix(1., p_zoom, f);
  vec2 kuv = kaleido_uv(c, spin, z);
  float m = smoothstep(.45, .55, p);
  vec3 plain = p < .5 ? texture(uA, uv).rgb : texture(uB, uv).rgb;
  vec3 folded = mix(texture(uA, kuv).rgb, texture(uB, kuv).rgb, m);
  vec3 col = mix(plain, folded, inside);
  col *= 1. - .2 * smoothstep(.06, 0., abs(r - R + .05)) * step(.001, f) * (1. - step(far + .05, R));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-flyeye', name:'Fly eye', cat:'transition', search:['compound eye', 'lens array', 'insect', 'facets'],
  desc:'The frame breaks into a field of tiny lenses with split colour edges, and B comes into focus through them.',
  params:[ R('lenses','Lenses',9,3,40,1), R('size','Lens strength',.05,0,.15), R('sep','Colour split',.3,0,1.5) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = centered(uv) * p_lenses * TAU;
  vec2 d = p_size * vec2(cos(c.x), sin(c.y)) / vec2(aspect(), 1.);
  vec2 da = d * p, db = d * (1. - p);
  vec3 A = vec3(texture(uA, uv + da * (1. - p_sep)).r, texture(uA, uv + da).g, texture(uA, uv + da * (1. + p_sep)).b);
  vec3 B = vec3(texture(uB, uv + db * (1. - p_sep)).r, texture(uB, uv + db).g, texture(uB, uv + db * (1. + p_sep)).b);
  return vec4(mix(A, B, smoothstep(.2, .8, p)), 1.);
}` });

FX.register({ id:'tr-colour-morph', name:'Colour morph', cat:'transition', search:['morph', 'displace', 'warp', 'colour displacement'],
  desc:'Each picture is pushed around by its own colours, so the two slide into one another along their light and shade.',
  params:[ S('field','Pushed by',['Red and green','Brightness','Hue']), R('amount','Strength',.2,0,.6), R('cross','Cross-over',.5,.15,1) ],
  fs:`vec2 cmorph_dir(vec3 c, int m){
  if (m == 1) return vec2(0., luma(c) * 2. - 1.);
  if (m == 2){ vec3 h = rgb2hsv(c); return vec2(cos(h.x * TAU), sin(h.x * TAU)) * h.y; }
  return (c.rg + c.b) - 1.;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  int m = int(p_field + .5);
  vec2 oa = cmorph_dir(texture(uA, uv).rgb, m), ob = cmorph_dir(texture(uB, uv).rgb, m);
  vec2 o = (oa + ob) * .5 * p_amount / vec2(aspect(), 1.);
  vec3 A = texture(uA, mirrorUv(uv + o * p)).rgb;
  vec3 B = texture(uB, mirrorUv(uv - o * (1. - p))).rgb;
  return vec4(mix(A, B, smoothstep(.5 - p_cross * .5, .5 + p_cross * .5, p)), 1.);
}` });

FX.register({ id:'tr-displace-fade', name:'Displacement crossfade', cat:'transition', search:['displacement map', 'hover effect', 'distort', 'warp'],
  desc:'A pattern pulls A one way and pushes B in from the other while they fade, like the hover effect on a portfolio site.',
  params:[ S('map','Pattern',['Cloud','Stripes','Blocks','Swirl']), R('amount','Strength',.35,0,1), R('angle','Angle',45,-180,180,1), R('scale','Pattern size',3,.5,12), R('lead','Pattern leads',.4,0,1) ],
  fs:`float disp_map(vec2 c, int m){
  vec2 q = c * p_scale;
  if (m == 1) return .5 + .5 * sin((q.x + q.y) * 6.);
  if (m == 2) return hash12(floor(q * 2.));
  if (m == 3){ float a = atan(c.y, c.x), r = length(c); return .5 + .5 * sin(a * 3. + r * p_scale * 6.); }
  return fbm(q + 3.1);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = centered(uv);
  float d = disp_map(c, int(p_map + .5));
  float an = radians(p_angle);
  vec2 da = vec2(cos(an), sin(an)), db = -da;
  vec2 k = vec2(1. / aspect(), 1.) * p_amount * d;
  vec3 A = texture(uA, mirrorUv(uv + da * k * p)).rgb;
  vec3 B = texture(uB, mirrorUv(uv + db * k * (1. - p))).rgb;
  float m = smoothstep(0., 1., p * (1. + p_lead) - d * p_lead);
  return vec4(mix(A, B, m), 1.);
}` });

FX.register({ id:'tr-stripe-shear', name:'Stripe shear', cat:'transition', search:['sliced glass', 'strips', 'streak', 'shear'],
  desc:'Thin strips each slip by their own ramp, so A shears apart in a fine sawtooth and B settles back into place.',
  params:[ R('strips','Strips',40,4,160,1), R('amount','Shear',.2,0,.6), R('angle','Strip angle',90,-90,180,1), R('push','Push angle',45,-180,180,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = centered(uv);
  float a = radians(p_angle);
  vec2 n = vec2(-sin(a), cos(a));
  float d = fract(dot(c, n) * p_strips);
  float b = radians(p_push);
  vec2 dir = vec2(cos(b), sin(b)) / vec2(aspect(), 1.);
  vec3 A = texture(uA, mirrorUv(uv + dir * d * pow(p, 1.6) * p_amount)).rgb;
  vec3 B = texture(uB, mirrorUv(uv - dir * (1. - d) * pow(1. - p, 1.6) * p_amount)).rgb;
  return vec4(mix(A, B, smoothstep(.25, .75, p)), 1.);
}` });

FX.register({ id:'tr-revolve', name:'Revolve', cat:'transition', nonLocal:true, search:['spin', 'swirl zoom', 'vortex', 'revolve'],
  desc:'The frame spins, swells and bends around the middle with motion blur, and comes out of the turn as B.',
  params:[ S('dir','Turn',['Anticlockwise','Clockwise']), R('spin','Spin',.3,0,1), R('zoom','Zoom',2.2,1,4), R('swirl','Swirl',2.8,0,6), R('barrel','Bulge',.38,0,1.2), I('blur','Motion blur',12,1,24) ],
  fs:`vec2 revolve_uv(vec2 c, float e, float extra){
  float r = length(c);
  float sgn = int(p_dir + .5) == 1 ? -1. : 1.;
  float ang = sgn * (p_spin * TAU * e + p_swirl * e * pow(max(0., 1. - r), 1.55) + extra);
  vec2 q = rot(ang) * c;
  q /= pow(p_zoom, e);
  q *= 1. + p_barrel * e * dot(q, q);
  return mirrorUv(uncentered(q));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float e = sin(p * PI); e = e * e * (3. - 2. * e);
  vec2 c = centered(uv);
  float m = smoothstep(.42, .58, p);
  float spread = .35 * sin(p * PI) * p_spin;
  int n = int(p_blur + .5);
  vec3 acc = vec3(0.);
  for (int i = 0; i < 24; i++){
    if (i >= n) break;
    float t = n > 1 ? float(i) / float(n - 1) - .5 : 0.;
    vec2 s = revolve_uv(c, e, t * spread);
    acc += mix(texture(uA, s).rgb, texture(uB, s).rgb, m);
  }
  return vec4(acc / float(n), 1.);
}` });

FX.register({ id:'tr-zoom-rings', name:'Zoom rings', cat:'transition', search:['telescope', 'concentric', 'circles', 'rings'],
  desc:'Concentric rings each zoom at their own rate and change over one after another, so the frame telescopes into B.',
  params:[ I('rings','Rings',4,2,10), R('zoom','Zoom',.25,0,.8), R('stagger','Stagger',.5,0,.9), S('order','Order',['Outside in','Inside out']), R('edge','Ring edge',.35,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = centered(uv);
  float maxR = length(vec2(aspect(), 1.)) * .5;
  float n = max(p_rings, 1.);
  float fr = length(c) / maxR * n;
  float i = min(floor(fr), n - 1.);
  float o = i / max(n - 1., 1.);
  if (int(p_order + .5) == 0) o = 1. - o;
  float lp = clamp((p - o * p_stagger) / (1. - p_stagger), 0., 1.);
  float k = p_zoom * (i + 1.) / n;
  vec3 A = texture(uA, uncentered(c * (1. - k * lp))).rgb;
  vec3 B = texture(uB, uncentered(c * (1. + k * (1. - lp)))).rgb;
  vec3 col = mix(A, B, smoothstep(.3, .7, lp));
  float busy = sin(lp * PI);
  float edge = smoothstep(.0, .06, fract(fr)) * smoothstep(1., .94, fract(fr));
  col *= 1. - p_edge * busy * (1. - edge) * .6;
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-dream-wave', name:'Dream wave', cat:'transition', search:['dreamy', 'flashback', 'wavy', 'memory', 'dream sequence'],
  desc:'The picture wobbles in a slow wave and softens to haze as it drifts into B, the old dream-sequence dissolve.',
  params:[ R('amp','Wave',.04,0,.15), R('freq','Waves',10,1,40,1), S('axis','Wave runs',['Across','Down']), R('haze','Haze',.35,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  bool down = int(p_axis + .5) == 1;
  float x = down ? uv.y : uv.x;
  float oa = p_amp * p * cos(p_freq * (p + x));
  float ob = -p_amp * (1. - p) * cos(p_freq * ((1. - p) + x));
  vec2 ua = uv + (down ? vec2(oa, 0.) : vec2(0., oa));
  vec2 ub = uv + (down ? vec2(ob, 0.) : vec2(0., ob));
  vec3 col = mix(texture(uA, mirrorUv(ua)).rgb, texture(uB, mirrorUv(ub)).rgb, smoothstep(.15, .85, p));
  float e = sin(p * PI);
  vec3 soft = (texture(uA, mirrorUv(ua + vec2(.006, .004))).rgb + texture(uB, mirrorUv(ub - vec2(.006, .004))).rgb) * .5;
  col = mix(col, soft, e * p_haze * .5);
  col += (1. - col) * e * p_haze * .35 * smoothstep(.2, 1., luma(col));
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-zoom-sweep', name:'Zoom sweep', cat:'transition', search:['cross warp', 'directional warp', 'crosswarp', 'stretch'],
  desc:'A front sweeps across the frame; behind it A has rushed away into the distance and B has flown up out of it.',
  params:[ S('front','Front',['Straight','Circle']), R('dir','Direction',0,-180,180,1), R('soft','Softness',.6,.05,1.5), R('rough','Ragged edge',0,0,1), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = centered(uv);
  vec2 o = vec2(p_x * aspect() * .5, p_y * .5);
  float t;
  if (int(p_front + .5) == 1){
    vec2 ext = vec2(aspect() * .5, .5);
    float far = length(abs(o) + ext);
    t = length(c - o) / far;
  } else {
    float a = radians(p_dir); vec2 d = vec2(cos(a), sin(a));
    float ext = abs(d.x) * aspect() * .5 + abs(d.y) * .5;
    t = (dot(c, d) + ext) / (2. * ext);
  }
  t = clamp(t + (fbm(c * 4. + 1.7) - .5) * p_rough * .5, 0., 1.);
  float x = smoothstep(0., 1., (p * (1. + p_soft) - t) / p_soft);
  vec2 ctr = int(p_front + .5) == 1 ? o : vec2(0.);
  vec3 A = texture(uA, uncentered((c - ctr) * (1. - x) + ctr)).rgb;
  vec3 B = texture(uB, uncentered((c - ctr) * x + ctr)).rgb;
  return vec4(mix(A, B, x), 1.);
}` });

FX.register({ id:'tr-lens-pass', name:'Lens pass-through', cat:'transition', search:['magnifier', 'bulge', 'loupe', 'magnifying glass', 'fisheye'],
  desc:'A magnifying lens crosses the frame, showing B enlarged inside it and leaving B behind it as it goes.',
  params:[ R('dir','Direction',0,-180,180,1), R('radius','Lens size',.32,.1,.7), R('strength','Magnify',.6,0,.95), R('chroma','Colour fringe',.4,0,1.5), R('rim','Rim',.5,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = centered(uv);
  float a = radians(p_dir); vec2 d = vec2(cos(a), sin(a));
  float ext = abs(d.x) * aspect() * .5 + abs(d.y) * .5;
  float R = p_radius;
  float s = mix(-ext - R * 2., ext + R, p);
  vec2 lc = d * s;
  float along = dot(c, d) - s;
  vec3 col = along < 0. ? texture(uB, uv).rgb : texture(uA, uv).rgb;
  vec2 q = (c - lc) / R; float r = length(q);
  if (r < 1.){
    float k = 1. - p_strength * (1. - r * r);
    vec2 base = lc + (c - lc) * k;
    vec2 off = (c - lc) * p_chroma * .06 * r * r;
    col = vec3(texture(uB, mirrorUv(uncentered(base + off))).r, texture(uB, mirrorUv(uncentered(base))).g, texture(uB, mirrorUv(uncentered(base - off))).b);
    col *= 1. - p_rim * .45 * smoothstep(.75, 1., r);
    col += p_rim * .25 * smoothstep(.2, 0., length(q - vec2(-.35, .4)));
  }
  float ring = smoothstep(.02, 0., abs(r - 1.) * R);
  col = mix(col, col * .5, ring * p_rim);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-lens-distort', name:'Lens distortion', cat:'transition', nonLocal:true, search:['barrel', 'fisheye', 'pinch', 'bulge', 'warp'],
  desc:'A swells into a fisheye with colour fringing, hands over at the peak, and B relaxes back to flat.',
  params:[ S('shape','Shape',['Bulge','Pinch']), R('amount','Distortion',1.2,0,3), R('zoom','Zoom',.35,0,1), R('chroma','Colour fringe',.012,0,.06), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float e = sin(p * PI); e = e * e * (3. - 2. * e);
  vec2 o = vec2(p_x * aspect() * .5, p_y * .5);
  vec2 c = centered(uv) - o;
  float sg = int(p_shape + .5) == 1 ? -.45 : 1.;
  float k = p_amount * e * sg * 2.;
  float r2 = dot(c, c);
  /* corners stay roughly put; the middle swells (bulge) or shrinks (pinch) */
  vec2 q = c * (1. + k * r2) / (1. + k * .4) / (1. + p_zoom * e);
  float ch = p_chroma * e;
  float m = smoothstep(.44, .56, p);
  vec3 col;
  for (int i = 0; i < 3; i++){
    float sc = 1. + (float(i) - 1.) * ch * 4. * sqrt(r2);
    vec2 s = mirrorUv(uncentered(q * sc + o));
    vec3 v = mix(texture(uA, s).rgb, texture(uB, s).rgb, m);
    col[i] = v[i];
  }
  col *= 1. - e * .35 * smoothstep(.3, .9, sqrt(r2)) * step(0., sg);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-glass-wipe', name:'Glass wipe', cat:'transition', search:['refraction', 'water', 'wipe', 'glass'],
  desc:'A soft wipe whose edge behaves like poured glass, bending both pictures by their own light and shade as it passes.',
  params:[ R('dir','Direction',90,-180,180,1), R('soft','Softness',.22,.04,.6), R('amount','Bend',.06,0,.2), S('map','Bent by',['Outgoing image','Incoming image','Both']), R('chroma','Colour split',.4,0,1.5) ],
  fs:`float gw_h(vec2 uv, int m){
  /* a blurred mip of the picture is the glass's height, so the bend follows forms, not grain */
  float a = luma(textureLod(uA, uv, 4.).rgb), b = luma(textureLod(uB, uv, 4.).rgb);
  return m == 0 ? a : m == 1 ? b : (a + b) * .5;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = centered(uv);
  float a = radians(p_dir); vec2 d = vec2(cos(a), sin(a));
  float ext = abs(d.x) * aspect() * .5 + abs(d.y) * .5;
  float s = mix(-ext - p_soft * 1.2, ext + p_soft * 1.2, p);
  int m = int(p_map + .5);
  vec2 px = vec2(.012 / aspect(), .012);
  float h = gw_h(uv, m);
  vec2 g = vec2(gw_h(uv + vec2(px.x, 0.), m) - gw_h(uv - vec2(px.x, 0.), m), gw_h(uv + vec2(0., px.y), m) - gw_h(uv - vec2(0., px.y), m)) / .024;
  float dd = dot(c, d) - s + (h - .5) * p_soft * .5;
  float bump = 1. - smoothstep(0., p_soft, abs(dd));
  bump = bump * bump * (3. - 2. * bump);
  vec2 off = (g * .15 + d * .6 * smoothstep(-p_soft, p_soft, -dd)) * p_amount * bump / vec2(aspect(), 1.);
  vec2 co = off * p_chroma * .5;
  vec3 A = vec3(texture(uA, mirrorUv(uv + off + co)).r, texture(uA, mirrorUv(uv + off)).g, texture(uA, mirrorUv(uv + off - co)).b);
  vec3 B = vec3(texture(uB, mirrorUv(uv + off + co)).r, texture(uB, mirrorUv(uv + off)).g, texture(uB, mirrorUv(uv + off - co)).b);
  float mm = smoothstep(p_soft * .3, -p_soft * .3, dd);
  vec3 col = mix(A, B, mm);
  col += .1 * pow(bump, 6.);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-curl-flow', name:'Curl flow', cat:'transition', search:['liquid', 'smoke', 'paint', 'fluid', 'marble', 'curl noise'],
  desc:'A swirls away along a slow current like paint stirred in water, and B is drawn back out of the same current.',
  params:[ R('amount','Flow',.4,0,1), R('scale','Eddy size',2,.5,8), I('steps','Smoothness',6,1,12), R('seed','Seed',0,0,100,1), R('cross','Cross-over',.4,.1,1) ],
  fs:`vec2 curl_v(vec2 q){
  float e = .05;
  float n1 = vnoise(q + vec2(0., e)) + .5 * vnoise(q * 2.1 + vec2(0., e) + 9.);
  float n2 = vnoise(q - vec2(0., e)) + .5 * vnoise(q * 2.1 - vec2(0., e) + 9.);
  float n3 = vnoise(q + vec2(e, 0.)) + .5 * vnoise(q * 2.1 + vec2(e, 0.) + 9.);
  float n4 = vnoise(q - vec2(e, 0.)) + .5 * vnoise(q * 2.1 - vec2(e, 0.) + 9.);
  return vec2(n1 - n2, -(n3 - n4)) / (2. * e);
}
vec2 curl_adv(vec2 c, float amt, int n){
  float st = amt / float(n);
  for (int i = 0; i < 12; i++){
    if (i >= n) break;
    c += curl_v(c * p_scale + p_seed * 1.37) * st / p_scale;
  }
  return c;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 c = centered(uv);
  int n = int(p_steps + .5);
  float k = p_amount * 1.4;
  vec3 A = texture(uA, mirrorUv(uncentered(curl_adv(c, k * p, n)))).rgb;
  vec3 B = texture(uB, mirrorUv(uncentered(curl_adv(c, -k * (1. - p), n)))).rgb;
  return vec4(mix(A, B, smoothstep(.5 - p_cross * .5, .5 + p_cross * .5, p)), 1.);
}` });

FX.register({ id:'tr-droplet', name:'Droplet', cat:'transition', search:['ripple', 'drop', 'water', 'splash', 'pond'],
  desc:'A drop lands and one ring spreads out across the frame, bending the picture at its crest and leaving B behind it.',
  params:[ R('wave','Wavelength',.05,.01,.2), R('amp','Strength',.03,0,.1), R('trail','Ripple trail',.25,.05,.8), R('shine','Shine',.4,0,1), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 o = vec2(p_x * aspect() * .5, p_y * .5);
  vec2 c = centered(uv);
  vec2 q = c - o; float r = length(q);
  vec2 dir = r > 0. ? q / r : vec2(0.);
  float far = length(abs(o) + vec2(aspect() * .5, .5));
  float R = mix(-p_wave * 2., far + p_trail, p);
  float x = r - R;
  float env = smoothstep(p_wave * 1.5, 0., x) * smoothstep(-p_trail, 0., x);
  float wv = sin(x / p_wave * TAU);
  vec2 off = dir * wv * env * p_amp / vec2(aspect(), 1.);
  vec2 s = mirrorUv(uv + off);
  float m = smoothstep(p_wave * .25, -p_wave * .25, x);
  vec3 col = mix(texture(uA, s).rgb, texture(uB, s).rgb, m);
  col += p_shine * .25 * env * max(0., cos(x / p_wave * TAU - 1.)) * env;
  col *= 1. - p_shine * .15 * env * max(0., -wv);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-flow-morph', name:'Flow morph', cat:'transition', search:['morph cut', 'smooth cut', 'flow', 'jump cut'],
  desc:'A and B nudge their shapes toward each other while they dissolve, a soft morph that hides a jump cut.',
  params:[ R('amount','Strength',1,0,2), R('reach','Reach',.06,.01,.15), R('cross','Cross-over',.6,.1,1) ],
  fs:`float fm_d(vec2 uv){ return luma(texture(uB, uv).rgb) - luma(texture(uA, uv).rgb); }
float fm_blur(vec2 uv, vec2 r){
  return (fm_d(uv) * 2. + fm_d(uv + vec2(r.x, 0.)) + fm_d(uv - vec2(r.x, 0.)) + fm_d(uv + vec2(0., r.y)) + fm_d(uv - vec2(0., r.y))) / 6.;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec2 r = vec2(p_reach / aspect(), p_reach);
  vec2 g = vec2(fm_blur(uv + vec2(r.x, 0.), r) - fm_blur(uv - vec2(r.x, 0.), r), fm_blur(uv + vec2(0., r.y), r) - fm_blur(uv - vec2(0., r.y), r));
  float gl = length(g);
  vec2 f = gl > 1e-4 ? g / gl * smoothstep(0., .3, gl) * r * p_amount : vec2(0.);
  vec3 A = texture(uA, mirrorUv(uv - f * p)).rgb;
  vec3 B = texture(uB, mirrorUv(uv + f * (1. - p))).rgb;
  return vec4(mix(A, B, smoothstep(.5 - p_cross * .5, .5 + p_cross * .5, p)), 1.);
}` });

FX.register({ id:'tr-slice-offset', name:'Sliced offsets', cat:'transition', search:['slices', 'strips', 'hover distortion', 'slice'],
  desc:'The frame is cut into bands that sway sideways in a rolling wave, and each band changes to B as it swings back.',
  params:[ I('slices','Slices',12,2,48), R('amp','Sway',.12,0,.5), R('wave','Wave',3,0,10), R('delay','Band delay',.4,0,.9), S('axis','Bands',['Rows','Columns']) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  bool cols = int(p_axis + .5) == 1;
  float across = cols ? uv.x : uv.y;
  float n = max(p_slices, 1.);
  float i = floor(across * n);
  float o = i / max(n - 1., 1.);
  float e = sin(p * PI);
  float sh = sin(o * p_wave * PI + p * TAU) * p_amp * e;
  vec2 off = cols ? vec2(0., sh) : vec2(sh, 0.);
  vec2 s = mirrorUv(uv + off);
  float th = .5 + (o - .5) * p_delay;
  float m = smoothstep(th - .04, th + .04, p);
  return vec4(mix(texture(uA, s).rgb, texture(uB, s).rgb, m), 1.);
}` });

FX.register({ id:'tr-edge-stretch', name:'Stretch reveal', cat:'transition', search:['pixel stretch', 'streak', 'smear', 'edge stretch', 'wipe'],
  desc:'B wipes in while its leading row of pixels is dragged out ahead of it in long, uneven streaks over A.',
  params:[ S('dir','Direction',DIRS4,0), R('length','Streak length',.35,0,1), R('jitter','Unevenness',.6,0,1), R('fine','Streak detail',60,4,240,1), R('fade','Fade into A',.5,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  int d = int(p_dir + .5);
  /* along: 0 where the wipe starts, 1 where it ends; across: position along the front */
  float along = d == 0 ? 1. - uv.y : d == 1 ? uv.x : d == 2 ? uv.y : 1. - uv.x;
  float across = (d == 0 || d == 2) ? uv.x : uv.y;
  float env = sin(p * PI);
  float f = p;
  float L = p_length * env * (1. - p_jitter * vnoise(vec2(across * p_fine, 3.)) - p_jitter * .3 * hash12(vec2(floor(across * p_fine * 4.), 5.)));
  float x = along - f;
  vec3 col;
  if (x <= 0.) col = texture(uB, uv).rgb;
  else {
    float fe = max(f - 1. / max(uRes.x, uRes.y), 0.);
    vec2 edge = d == 0 ? vec2(uv.x, 1. - fe) : d == 1 ? vec2(fe, uv.y) : d == 2 ? vec2(uv.x, fe) : vec2(1. - fe, uv.y);
    vec3 streak = texture(uB, edge).rgb;
    float k = L > 0. ? clamp(x / L, 0., 1.) : 1.;
    float cover = 1. - smoothstep(1. - p_fade * .9 - .02, 1., k);
    col = mix(texture(uA, uv).rgb, streak, cover * step(x, L + 1e-5));
  }
  return vec4(col, 1.);
}` });
