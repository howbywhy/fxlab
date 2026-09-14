/* ---------------- Mix & mask (A + B) ---------------- */
FX.register({ id:'mx-blend', name:'Blend modes', cat:'mix', desc:'Composite B onto A with Photoshop-style blend modes.', search:['combine'],
  params:[ S('mode','Mode',BLENDS,2), R('amount','Opacity',1,0,1), T('swap','Swap layers') ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  if (p_swap > .5){ vec3 t = a; a = b; b = t; }
  return vec4(mix(a, blendMode(a, b, int(p_mode + .5)), p_amount), 1.);
}` });

FX.register({ id:'mx-luma', name:'Luma mask', cat:'mix', desc:'Brightness of one image decides where the other shows.', search:['combine', 'window'],
  params:[ S('source','Matte from',['A','B']), R('threshold','Threshold',.5,0,1), R('soft','Softness',.1,0,.5), T('invert','Invert') ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float l = p_source < .5 ? luma(a) : luma(b);
  if (p_invert > .5) l = 1. - l;
  float s = max(p_soft, 1e-3);
  return vec4(mix(a, b, smoothstep(p_threshold - s, p_threshold + s, l)), 1.);
}` });

FX.register({ id:'mx-shape', name:'Shape mask', cat:'mix', desc:'B inside a shape over A. Can grow, pulse or spin over the loop.', search:['combine', 'window'],
  params:[ S('shape','Shape',['Circle','Rectangle','Rounded','Ring','Triangle','Diamond']), R('size','Size',.3,0,1.2), R('ratio','Width ratio',1,.1,4), R('x','X',0,-1,1), R('y','Y',0,-1,1), R('rotation','Rotation',0,-180,180,1), R('feather','Feather',.003,0,.3), S('animate','Animate',['None','Grow with timeline','Pulse','Spin']), T('invert','Invert'), R('stroke','Outline',0,0,.03), C('color','Outline colour','#ffffff') ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = centered(uv) - vec2(p_x * aspect() * .5, p_y * .5);
  int an = int(p_animate + .5);
  float size = p_size; float ang = radians(p_rotation);
  if (an == 1) size *= uProgress;
  if (an == 2) size *= .85 + .15 * sin(uLoop * TAU * 2.);
  if (an == 3) ang += uLoop * TAU;
  p = rot(ang) * p;
  int s = int(p_shape + .5); float d;
  if (s == 0) d = length(p) - size;
  else if (s == 1) d = sdRoundBox(p, vec2(size * p_ratio, size), 0.);
  else if (s == 2) d = sdRoundBox(p, vec2(size * p_ratio, size), size * .35 * min(p_ratio, 1.));
  else if (s == 3) d = abs(length(p) - size) - size * .18;
  else if (s == 4) d = sdTri(p, size);
  else d = (abs(p.x) + abs(p.y) - size) * .7071;
  float f = max(p_feather, 1e-3);
  float m = 1. - smoothstep(-f, f, d);
  if (p_invert > .5) m = 1. - m;
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m);
  if (p_stroke > 0.) col = mix(col, p_color, 1. - smoothstep(0., 1.5 / uRes.y, abs(d) - p_stroke));
  return vec4(col, 1.);
}` });

FX.register({ id:'mx-type', name:'Type mask', cat:'mix', desc:'Knock B (or a colour) through live type over A.', search:['combine', 'window'],
  params:[ X('text','Text','TYPE\nMASK',true), F('font','Font'), X('customFont','Installed font',''), S('weight','Weight',Util.weights,4), R('size','Size',30,2,100), R('tracking','Tracking',-.02,-.2,.5), R('leading','Leading',.9,.5,2), R('x','X',0,-1,1), R('y','Y',0,-1,1), T('upper','Uppercase',true), S('fill','Fill with',['Image B','Colour']), C('color','Colour','#c9f5e4'), T('invert','Invert') ],
  aux(ctx, P, w, h){
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff';
    const txt = P.upper ? P.text.toUpperCase() : P.text;
    Util.textBlock(ctx, txt, { size:P.size / 100 * Math.min(w, h), weight:Util.weights[P.weight|0], family:Util.family(P), tracking:P.tracking, leading:P.leading, x:(.5 + P.x * .5) * w, y:(.5 - P.y * .5) * h });
  },
  fs:`vec4 fx(vec2 uv){
  float m = texture(uAux, uv).r;
  if (p_invert > .5) m = 1. - m;
  vec3 b = p_fill < .5 ? texture(uB, uv).rgb : p_color;
  return vec4(mix(texture(uA, uv).rgb, b, m), 1.);
}` });

FX.register({ id:'mx-gradient', name:'Gradient mask', cat:'mix', desc:'Linear or radial blend between A and B, with a wavy or noisy edge, dithering and a bright seam.', search:['combine'],
  params:[ S('type','Type',['Linear','Radial']), R('angle','Angle',90,-180,180,1), R('position','Position',.5,-.5,1.5), R('soft','Softness',.25,0,1), T('animate','Sweep with timeline'),
    S('edge','Edge',['Smooth','Waved','Noisy','Stepped'],0), R('edgeAmount','Edge amount',.35,0,2), R('edgeScale','Edge scale',4,.5,20), I('steps','Steps',8,2,40), R('dither','Dither',0,0,1), R('line','Seam line',0,0,.06), C('lineColor','Seam colour','#ffffff','accent') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = centered(uv); float d;
  if (p_type < .5){
    vec2 dir = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
    float ext = abs(dir.x) * aspect() * .5 + abs(dir.y) * .5;
    d = dot(c, dir) / ext * .5 + .5;
  } else d = length(c) / (length(vec2(aspect(), 1.)) * .5);
  int em = int(p_edge + .5);
  if (em == 1) d += sin(atan(c.y, c.x) * p_edgeScale + uLoop * TAU) * p_edgeAmount * .06 + sin(c.x * p_edgeScale * 6.) * p_edgeAmount * .03;
  else if (em == 2) d += (fbm(c * p_edgeScale + uLoop) - .5) * p_edgeAmount * .35;
  else if (em == 3) d = floor(d * p_steps) / max(p_steps, 1.);
  d += (bayer8(uv * uRes) - .5) * p_dither * .08;
  float s = max(p_soft * .5, 1e-3);
  float pos = p_animate > .5 ? mix(1. + s, -s, uProgress) : p_position;
  float m2 = smoothstep(pos - s, pos + s, d);
  vec3 col = mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m2);
  if (p_line > .001) col = mix(col, p_lineColor, 1. - smoothstep(0., p_line, abs(d - pos)));
  return vec4(col, 1.);
}` });

FX.register({ id:'mx-noise', name:'Organic mask', cat:'mix', desc:'Warped, flowing noise matte. Loops seamlessly.', search:['combine'],
  params:[ R('scale','Scale',2.5,.3,12), R('warp','Warp',1.5,0,5), R('speed','Drift',.6,0,3), R('threshold','Coverage',.5,.1,.9), R('soft','Softness',.04,0,.3) ],
  fs:`vec4 fx(vec2 uv){
  vec2 q = centered(uv) * p_scale;
  vec2 lo = vec2(cos(uLoop * TAU), sin(uLoop * TAU)) * p_speed;
  vec2 w = vec2(fbm(q + lo), fbm(q + vec2(5.2, 1.3) - lo.yx));
  float n = fbm(q + w * p_warp + lo * .3);
  float s = max(p_soft, 1e-3);
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, smoothstep(p_threshold - s, p_threshold + s, n)), 1.);
}` });

FX.register({ id:'mx-strips', name:'Split strips', cat:'mix', desc:'Alternating strips of A and B that slide against each other.', search:['combine'],
  params:[ I('count','Strips',6,1,40), R('angle','Angle',0,-90,90,1), R('slide','Slide',.5,0,2), T('offsetLoop','Slide with loop',true) ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = rot(radians(p_angle)) * centered(uv);
  float id = floor((c.x / aspect() + .5) * max(p_count, 1.));
  bool odd = mod(id, 2.) > .5;
  float off = p_slide * .1 * (p_offsetLoop > .5 ? sin(uLoop * TAU) : 1.);
  return vec4(odd ? texture(uB, mirrorUv(uv - vec2(0., off))).rgb : texture(uA, mirrorUv(uv + vec2(0., off))).rgb, 1.);
}` });

FX.register({ id:'mx-displace', name:'Displace by B', cat:'mix', desc:'A is pushed around by the brightness or contours of B.', search:['combine', 'distort', 'displace'],
  params:[ S('mode','Mode',['Brightness','Contours']), R('amount','Amount',.4,0,2), R('angle','Angle',45,-180,180,1), R('showB','Show B',0,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 bc = texture(uB, uv).rgb; float l = luma(bc);
  vec2 ex = vec2(3. / uRes.x, 0.), ey = vec2(0., 3. / uRes.y);
  float lx = luma(texture(uB, uv + ex).rgb) - luma(texture(uB, uv - ex).rgb);
  float ly = luma(texture(uB, uv + ey).rgb) - luma(texture(uB, uv - ey).rgb);
  vec2 off = p_mode < .5 ? (l - .5) * vec2(cos(radians(p_angle)), sin(radians(p_angle))) : vec2(lx, ly) * 4.;
  vec3 col = texture(uA, mirrorUv(uv + off * p_amount * .2)).rgb;
  return vec4(mix(col, blendMode(col, bc, 3), p_showB), 1.);
}` });

FX.register({ id:'mx-halftone', name:'Halftone mix', cat:'mix', desc:'Dots sized by A reveal B through them.', search:['combine', 'print'],
  params:[ R('cells','Density',60,8,240,1), R('angle','Angle',45,-90,90,1), T('invert','Invert'), S('under','Between dots',['Image A','Colour']), C('color','Colour','#f2efe6') ],
  fs:`vec4 fx(vec2 uv){
  vec2 c = rot(radians(p_angle)) * (uv * vec2(aspect(), 1.) * p_cells);
  vec2 f = fract(c) - .5;
  vec3 a = texture(uA, uv).rgb;
  float l = luma(a); if (p_invert > .5) l = 1. - l;
  float r = sqrt(l) * .7; float d = length(f);
  float aa = .75 * p_cells / uRes.y;
  float m = 1. - smoothstep(r - aa, r + aa, d);
  return vec4(mix(p_under < .5 ? a : p_color, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'mx-chroma', name:'Chroma key', cat:'mix', desc:'Key a colour out of B and place it over A.', search:['combine'],
  params:[ C('key','Key colour','#ff5a36'), R('tolerance','Tolerance',.16,0,.6), R('soft','Softness',.08,0,.4), R('spill','Spill removal',.6,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec2 ck = vec2(dot(p_key, vec3(-.169, -.331, .5)), dot(p_key, vec3(.5, -.419, -.081)));
  vec2 cb = vec2(dot(b, vec3(-.169, -.331, .5)), dot(b, vec3(.5, -.419, -.081)));
  float d = distance(ck, cb);
  float m = smoothstep(p_tolerance, p_tolerance + max(p_soft, 1e-3), d);
  vec3 bs = mix(b, vec3(luma(b)), (1. - smoothstep(p_tolerance, p_tolerance + .25, d)) * p_spill);
  return vec4(mix(a, bs, m), 1.);
}` });

FX.register({ id:'mx-channels', name:'Channel swap', cat:'mix', desc:'Build each RGB channel from A or B.', search:['combine'],
  params:[ S('r','Red from',['A','B'],0), S('g','Green from',['A','B'],1), S('b','Blue from',['A','B'],0) ],
  fs:`vec4 fx(vec2 uv){
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  return vec4(p_r < .5 ? a.r : b.r, p_g < .5 ? a.g : b.g, p_b < .5 ? a.b : b.b, 1.);
}` });

/* ---------------- Generators ---------------- */
FX.register({ id:'gen-field', name:'Colour field', cat:'generator', desc:'Solid, linear, radial, conic or three-stop colour, with banding, grain and a soft glow. A clean base for overlays.',
  params:[ S('mode','Type',['Solid','Linear','Radial','Conic','Three stop'],1), C('c1','Colour 1','#1a1b1d','ground'), C('c2','Colour 2','#5f8c7e','accent'), C('c3','Colour 3','#e4e2dc','ink'), R('angle','Angle',90,-180,180,1), R('position','Centre',0,-1,1), R('spread','Spread',1,.2,3),
    I('steps','Banding (0 = smooth)',0,0,24), R('dither','Dither',.25,0,1), R('grain','Grain',.05,0,.5), R('glow','Glow',0,0,1), I('speed','Drift loops',0,0,6) ],
  fs:`vec4 fx(vec2 uv){
  int m = int(p_mode + .5); vec2 p = centered(uv);
  p -= vec2(p_position * .5 * aspect(), 0.);
  float t = 0.;
  vec2 dir = vec2(cos(radians(p_angle)), sin(radians(p_angle)));
  float ext = (abs(dir.x) * aspect() * .5 + abs(dir.y) * .5) * p_spread;
  if (m == 1 || m == 4) t = dot(p, dir) / max(ext, 1e-4) * .5 + .5;
  else if (m == 2) t = length(p) / max(length(vec2(aspect(), 1.)) * .5 * p_spread, 1e-4);
  else if (m == 3) t = fract(atan(p.y, p.x) / TAU + radians(p_angle) / TAU);
  if (p_speed > .5) t += uLoop * float(int(p_speed));
  t = m == 3 ? fract(t) : clamp(t, 0., 1.);
  float d = (bayer8(uv * uRes) - .5) * p_dither * (p_steps > .5 ? 1.4 / max(p_steps, 1.) : .04);
  t = clamp(t + d, 0., 1.);
  if (p_steps > .5) t = floor(t * p_steps) / max(p_steps - 1., 1.);
  vec3 c;
  if (m == 0) c = p_c1;
  else if (m == 4) c = t < .5 ? mix(p_c1, p_c2, t * 2.) : mix(p_c2, p_c3, (t - .5) * 2.);
  else c = mix(p_c1, p_c2, t);
  if (p_glow > .001){
    float g = 1. - smoothstep(0., .55 * p_spread, length(p));
    c = mix(c, p_c3, g * p_glow);
  }
  c += (hash12(uv * uRes + floor(uTime * 24.)) - .5) * p_grain * .12;
  return vec4(clamp(c, 0., 1.), 1.);
}` });

FX.register({ id:'gen-mesh', name:'Mesh gradient', cat:'generator', desc:'Four-colour flowing gradient with grain. Loops seamlessly.',
  params:[ C('c1','Colour 1','#ff5a36'), C('c2','Colour 2','#ffd2a8'), C('c3','Colour 3','#2b2f6b'), C('c4','Colour 4','#c9f5e4'), R('scale','Scale',1.4,.2,5), R('warp','Warp',.9,0,3), R('speed','Drift',.5,0,2), R('grain','Grain',.05,0,.3) ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = centered(uv);
  vec2 lo = vec2(cos(uLoop * TAU), sin(uLoop * TAU)) * p_speed;
  float n1 = fbm(p * p_scale + lo), n2 = fbm(p * p_scale * .8 + vec2(4.1, 1.7) - lo.yx);
  vec2 q = p + (vec2(n1, n2) - .5) * p_warp;
  float g1 = smoothstep(-.6, .6, q.x), g2 = smoothstep(-.5, .5, q.y);
  vec3 col = mix(mix(p_c3, p_c4, g1), mix(p_c1, p_c2, g1), g2);
  col += (hash12(uv * uRes + floor(uTime * 24.)) - .5) * p_grain;
  return vec4(col, 1.);
}` });

FX.register({ id:'gen-warp', name:'Domain warp', cat:'generator', desc:'Marbled fbm with optional contour lines. Loops seamlessly.',
  params:[ C('c1','Dark','#101113'), C('c2','Light','#e4e2dc'), R('scale','Scale',2,.3,8), R('warp','Warp',3,0,8), R('speed','Drift',.4,0,2), I('lines','Contours',14,0,60), R('width','Line softness',.08,.01,.5) ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = centered(uv) * p_scale;
  vec2 lo = vec2(cos(uLoop * TAU), sin(uLoop * TAU)) * p_speed;
  vec2 q = vec2(fbm(p + lo), fbm(p + vec2(5.2, 1.3) - lo));
  vec2 r = vec2(fbm(p + 4. * q + vec2(1.7, 9.2) + lo * .5), fbm(p + 4. * q + vec2(8.3, 2.8) - lo * .5));
  float n = fbm(p + p_warp * r);
  float v = n;
  if (p_lines > 0.){ float band = .5 + .5 * sin(n * p_lines * TAU); v = smoothstep(.5 - p_width, .5 + p_width, band); }
  return vec4(mix(p_c1, p_c2, v), 1.);
}` });

FX.register({ id:'gen-voronoi', name:'Cells', cat:'generator', desc:'Animated Voronoi. Colour cells from a palette or from image A.',
  params:[ R('scale','Density',6,1,40), S('mode','Style',['Cells','Edges','Distance']), T('image','Colour from A'), C('c1','Colour 1','#1a1b1d'), C('c2','Colour 2','#c9f5e4'), C('line','Line colour','#0d0e0f'), R('edge','Line width',.05,0,.4) ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = centered(uv) * p_scale;
  vec2 ip = floor(p), fp = fract(p);
  float d1 = 8., d2 = 8.; vec2 cid = vec2(0.), cpos = vec2(0.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 g = vec2(i, j); vec2 o = hash22(ip + g);
    o = .5 + .45 * sin(uLoop * TAU + TAU * o);
    vec2 r = g + o - fp; float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; cid = ip + g; cpos = ip + g + o; } else if (d < d2) d2 = d;
  }
  d1 = sqrt(d1); d2 = sqrt(d2);
  float edge = d2 - d1;
  vec3 cellCol = p_image > .5 ? texture(uA, clamp(uncentered(cpos / p_scale), 0., 1.)).rgb : mix(p_c1, p_c2, hash12(cid));
  int m = int(p_mode + .5); vec3 col;
  if (m == 0) col = mix(p_line, cellCol, smoothstep(0., max(p_edge, 1e-3), edge));
  else if (m == 1) col = mix(p_c2, p_c1, smoothstep(0., max(p_edge, 1e-3), edge));
  else col = mix(p_image > .5 ? cellCol : p_c2, p_c1, clamp(d1, 0., 1.));
  return vec4(col, 1.);
}` });

FX.register({ id:'gen-truchet', name:'Truchet', cat:'generator', desc:'Tiled arcs, diagonals or pulsing rings that re-tile over the loop.',
  params:[ R('cells','Rows',10,2,60,1), S('mode','Tile',['Arcs','Diagonals','Rings']), R('width','Line width',.08,.01,.4), R('speed','Changes per loop',2,0,8,1), C('fg','Line','#e4e2dc'), C('bg','Ground','#1a1b1d'), R('seed','Seed',1,0,100,1) ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = uv * vec2(aspect(), 1.) * p_cells;
  vec2 id = floor(p), f = fract(p) - .5;
  float h = hash12(id + p_seed * 7.13);
  float k = floor(uLoop * p_speed * 4. + h * 4.);
  float flip = step(.5, fract(h * 7.13 + k * .5));
  if (flip > .5) f.x = -f.x;
  int m = int(p_mode + .5); float d;
  if (m == 0){ vec2 cc = (f.x + f.y > 0.) ? vec2(.5) : vec2(-.5); d = abs(length(f - cc) - .5); }
  else if (m == 1) d = abs(f.x - f.y) * .7071;
  else d = abs(length(f) - .35 * (.55 + .45 * sin((uLoop * max(p_speed, 1.) + h) * TAU)));
  float aa = .75 * p_cells / uRes.y;
  float l = 1. - smoothstep(p_width * .5 - aa, p_width * .5 + aa, d);
  return vec4(mix(p_bg, p_fg, l), 1.);
}` });

FX.register({ id:'gen-moire', name:'Moiré', cat:'generator', desc:'Two interfering ring or line gratings in orbit.',
  params:[ S('mode','Grating',['Rings','Lines']), R('freq','Frequency',28,4,120,1), R('orbit','Orbit',.12,0,.5), R('angle','Line angle',6,0,45), C('fg','Ink','#e4e2dc'), C('bg','Ground','#141516') ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = centered(uv);
  vec2 lo = vec2(cos(uLoop * TAU), sin(uLoop * TAU));
  float r1, r2;
  if (p_mode < .5){
    r1 = sin(length(p - vec2(-.12, 0.) - lo * p_orbit) * p_freq * TAU);
    r2 = sin(length(p - vec2(.12, 0.) + lo * p_orbit) * p_freq * TAU);
  } else {
    vec2 q1 = rot(radians(p_angle) * lo.y) * p, q2 = rot(-radians(p_angle) * lo.y) * p;
    r1 = sin(q1.x * p_freq * TAU); r2 = sin((q2.x + lo.x * p_orbit * .1) * p_freq * TAU);
  }
  float s1 = smoothstep(-fwidth(r1), fwidth(r1), r1), s2 = smoothstep(-fwidth(r2), fwidth(r2), r2);
  return vec4(mix(p_bg, p_fg, s1 + s2 - 2. * s1 * s2), 1.);
}` });

FX.register({ id:'gen-chrome', name:'Liquid chrome', cat:'generator', desc:'Glossy molten surface shaded from a noise height field.',
  params:[ C('c1','Shadow','#0e1012'), C('c2','Highlight','#d8e4ea'), R('scale','Scale',1.6,.3,6), R('warp','Warp',1.2,0,4), R('depth','Relief',.6,0,2), R('speed','Drift',.5,0,2), R('bands','Reflections',3,0,10) ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = centered(uv) * p_scale;
  vec2 lo = vec2(cos(uLoop * TAU), sin(uLoop * TAU)) * p_speed;
  float h = fbm(p + fbm(p * 1.5 + lo) * p_warp + lo * .3);
  vec3 n = normalize(vec3(-dFdx(h) * uRes.y * p_depth * .25, -dFdy(h) * uRes.y * p_depth * .25, 1.));
  float env = .5 + .5 * sin(n.x * p_bands + n.y * p_bands * .7 + h * 6.);
  vec3 col = mix(p_c1, p_c2, env);
  float spec = pow(max(dot(n, normalize(vec3(.3, .5, 1.))), 0.), 40.);
  col += spec * .6;
  return vec4(col, 1.);
}` });

FX.register({ id:'gen-particles', name:'Image particles', cat:'generator', kind:'2d', nonLocal:true, desc:'Image A rebuilt from particles that scatter and reform.',
  params:[ R('density','Columns',70,10,220,1), R('size','Dot size',.9,.1,2), S('shape','Shape',['Circle','Square']), T('lumaSize','Size by brightness',true), R('scatter','Scatter',.35,0,1.5), S('motion','Motion',['Orbit loop','Explode with timeline','Static']), S('colorMode','Colour',['From image','Single ink']), C('ink','Ink','#e4e2dc'), C('bg','Ground','#111214') ],
  draw(ctx, api){
    const P = api.params, { w, h } = api;
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
    const cols = Math.max(4, Math.round(P.density)), rows = Math.max(4, Math.round(cols * h / w));
    const img = api.sample('A', cols, rows).data;
    const cw = w / cols, ch = h / rows, TAU = Math.PI * 2, loop = api.loop * TAU;
    const amt = P.motion == 0 ? P.scatter * (.5 - .5 * Math.cos(loop)) : P.motion == 1 ? P.scatter * Math.sin(api.p * Math.PI) : P.scatter;
    const reach = Math.min(w, h) * .25, mono = P.colorMode == 1, circle = P.shape == 0;
    if (mono){ ctx.fillStyle = P.ink; ctx.beginPath(); }
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++){
      const i = (y * cols + x) * 4, r = img[i], g = img[i + 1], b = img[i + 2];
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const hs = Util.hash(x * 127.1 + y * 311.7);
      const a = hs * TAU + loop * (hs > .5 ? 1 : -1);
      const d = amt * (.3 + hs * .7) * reach;
      const px = (x + .5) * cw + Math.cos(a) * d, py = (y + .5) * ch + Math.sin(a) * d;
      const s = cw * P.size * (P.lumaSize ? l : 1);
      if (s < .4) continue;
      if (!mono){ ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.beginPath(); }
      if (circle){ ctx.moveTo(px + s / 2, py); ctx.arc(px, py, s / 2, 0, TAU); }
      else ctx.rect(px - s / 2, py - s / 2, s, s);
      if (!mono) ctx.fill();
    }
    if (mono) ctx.fill();
  } });

