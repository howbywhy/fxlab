/* ---------------- Simulations ----------------
   Generators that keep state between frames in half-float textures (feedback:'float'),
   so slow change survives. They run forward in time: scrubbing the timeline backwards
   or exporting starts them again from the seed, as the other feedback modules do.
   Without EXT_color_buffer_float the state falls back to 8-bit and reads as banded blobs;
   the description says so.
------------------------------------------------ */
FX.register({ id:'gen-reaction', name:'Reaction-diffusion', cat:'generator', feedback:'float', nonLocal:true, steps:p => p.speed,
  search:['turing', 'coral', 'growth', 'organic'],
  desc:'Two chemicals feeding and eating each other grow spots, stripes and coral. Needs a graphics card with float textures; without one it looks coarse.',
  params:[ S('pattern','Pattern',['Coral','Spots','Stripes','Worms','Mitosis'],0), R('scale','Grain size',1,.5,3,.05), I('speed','Speed',24,1,48),
    S('seed','Grows from',['Scattered seeds','Image A brightness','Centre'],0), R('relief','Relief',.6,0,1), C('c1','Ground','#0d1a24','ground'), C('c2','Mid','#3b8f8c'), C('c3','Edge','#f4efe6','ink') ],
  fs:`
vec2 rdParams(){
  int k = int(p_pattern + .5);
  if (k == 1) return vec2(.0367, .0649);
  if (k == 2) return vec2(.0545, .062);
  if (k == 3) return vec2(.078, .061);
  if (k == 4) return vec2(.0367, .0649) + vec2(.0, -.0047);
  return vec2(.0545, .0620) - vec2(.0075, .0);
}
vec4 fx(vec2 uv){
  vec4 s = texture(uPrev, uv);
  vec2 px = p_scale / uRes;
  if (s.a < .5){
    float b = 0.;
    if (p_seed < .5){
      vec2 g = uv * 22.; vec2 id = floor(g), f = fract(g) - .5;
      vec2 j = (hash22(id) - .5) * .7;
      b = step(.55, hash12(id + 3.7)) * step(length(f - j), .16 + .1 * hash12(id));
    }
    else if (p_seed < 1.5) b = step(.55, luma(texture(uA, uv).rgb)) * step(.5, hash12(floor(uv * uRes * .5)));
    else b = step(length((uv - .5) * vec2(aspect(), 1.)), .06);
    return vec4(1. - b * .5, b, 0., 1.);
  }
  vec2 lap = -s.rg;
  lap += (texture(uPrev, uv + vec2(px.x, 0.)).rg + texture(uPrev, uv - vec2(px.x, 0.)).rg + texture(uPrev, uv + vec2(0., px.y)).rg + texture(uPrev, uv - vec2(0., px.y)).rg) * .2;
  lap += (texture(uPrev, uv + px).rg + texture(uPrev, uv - px).rg + texture(uPrev, uv + vec2(px.x, -px.y)).rg + texture(uPrev, uv + vec2(-px.x, px.y)).rg) * .05;
  vec2 fk = rdParams();
  float abb = s.r * s.g * s.g;
  float A = s.r + (1. * lap.x - abb + fk.x * (1. - s.r));
  float B = s.g + (.5 * lap.y + abb - (fk.x + fk.y) * s.g);
  return vec4(clamp(A, 0., 1.), clamp(B, 0., 1.), 0., 1.);
}`,
  show:`vec4 fx(vec2 uv){
  vec2 px = 1. / uRes;
  float v = texture(uPrev, uv).g;
  float dx = texture(uPrev, uv + vec2(px.x, 0.)).g - texture(uPrev, uv - vec2(px.x, 0.)).g;
  float dy = texture(uPrev, uv + vec2(0., px.y)).g - texture(uPrev, uv - vec2(0., px.y)).g;
  float t = smoothstep(.05, .38, v);
  vec3 c = mix(p_c1, p_c2, t);
  c = mix(c, p_c3, smoothstep(.55, .95, t));
  c += p_relief * (dx * -2.2 + dy * 2.2) * vec3(1.);
  return vec4(clamp(c, 0., 1.), 1.);
}` });

/* Not a full fluid solve (no pressure projection): a velocity field stirred by moving points
   and a curl-noise wind. Each pixel remembers where it started, and the pattern is drawn from
   that, so bands stay crisp instead of fading as dye would. Image A can be marbled the same way. */
FX.register({ id:'gen-marble-ink', name:'Marbled ink', cat:'generator', feedback:'float', nonLocal:true, steps:2,
  search:['fluid', 'liquid', 'suminagashi', 'marbling', 'swirl', 'warp'],
  desc:'Bands or an image carried by swirling currents and folded into marbling. An approximation of fluid, not a physical solve.',
  params:[ R('swirl','Swirl',1,.2,3,.05), R('stir','Stirrers',.6,0,1), R('drag','Drag',.985,.9,.999,.001), R('bands','Bands',7,2,20,.5), R('sharp','Edge sharpness',.8,0,1), S('dye','Pattern',['Marbled bands','Image A'],0),
    C('c1','Paper','#f0e9dc','ground'), C('c2','Ink','#1d2b53','ink'), C('c3','Second ink','#ff5a36','accent') ],
  fs:`
vec2 curl(vec2 p){
  float e = .01;
  float n1 = fbm(p + vec2(0., e)), n2 = fbm(p - vec2(0., e)), n3 = fbm(p + vec2(e, 0.)), n4 = fbm(p - vec2(e, 0.));
  return vec2(n1 - n2, -(n3 - n4)) / (2. * e);
}
vec4 fx(vec2 uv){
  vec4 s = texture(uPrev, uv);
  if (s.a < .25) return vec4(0., 0., uv.x, .5 + .5 * uv.y);
  vec2 px = 1. / uRes;
  vec4 a = texture(uPrev, uv - s.rg * px * 90.);
  vec2 vel = a.rg * p_drag + curl(uv * 1.6 + vec2(0., uTime * .03)) * p_swirl * .00007;
  for (int i = 0; i < 3; i++){
    float f = float(i);
    vec2 c = vec2(.5) + .32 * vec2(cos(uLoop * 6.2832 * (1. + f) + f * 2.1), sin(uLoop * 6.2832 * (1. + f) + f * 1.3));
    vec2 dd = (uv - c) * vec2(aspect(), 1.);
    float m = exp(-dot(dd, dd) * 60.) * p_stir;
    vel += normalize(vec2(-dd.y, dd.x) + 1e-4) * m * .00016 * (mod(f, 2.) < .5 ? 1. : -1.);
  }
  return vec4(clamp(vel, -.5, .5), a.b, a.a);
}`,
  show:`vec4 fx(vec2 uv){
  vec4 s = texture(uPrev, uv);
  vec2 o = vec2(s.b, s.a * 2. - 1.);
  if (p_dye > .5) return vec4(texture(uA, clamp(o, 0., 1.)).rgb, 1.);
  float d = o.x * p_bands + .6 * sin(o.y * 5.) + .3 * sin(o.x * 9. + o.y * 3.);
  float f = abs(fract(d) - .5) * 2.;
  float edge = mix(.5, .04, p_sharp);
  float m = smoothstep(.5 - edge, .5 + edge, f);
  vec3 ink = mix(p_c2, p_c3, step(.5, fract(floor(d) * .5)));
  return vec4(mix(p_c1, ink, m), 1.);
}` });
