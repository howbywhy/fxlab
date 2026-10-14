/* ---------------- Transitions: maths ----------------
   Geometry and mathematics made visible: conformal maps, recursion, hyperbolic and
   spherical space, projective planes, fractals, phyllotaxis and dual graphs.
   Each is a pure function of uv and uProgress. Distortions ride an envelope that is
   zero at p = 0 and p = 1, so both cuts are clean. */

/* ---- Droste descent: nested frames, the camera falls one level ---- */
FX.register({ id:'tr-droste-descent', name:'Droste descent', cat:'transition', family:'maths', nonLocal:true,
  search:['droste', 'recursive', 'picture in picture', 'escher', 'infinite zoom', 'mise en abyme', 'print gallery'],
  desc:'B opens as a picture hanging inside A, with B inside B again, and the camera falls through the frame into it.',
  params:[ R('scale','Inner picture size',.42,.2,.6), R('turn','Turn per level (°)',14,-40,40,1), R('frame','Frame line (px)',3,0,12), C('line','Frame colour','#f2efe8','ink'), R('shadow','Shadow',.45,0,1) ],
  fs:`bool drs_in(vec2 l, vec2 hs){ return abs(l.x) <= hs.x && abs(l.y) <= hs.y; }
vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  float env = smoothstep(0., .3, p) * (1. - smoothstep(.7, 1., p));
  float h = p_scale * env;
  float Z = smoothstep(.22, .78, p);
  if (h < 1e-3) return vec4(Z < .5 ? texture(uA, uv).rgb : texture(uB, uv).rgb, 1.);
  float phi = radians(p_turn);
  vec2 hs = vec2(asp * .5, .5);
  vec2 q = centered(uv);
  vec2 w = rot(Z * phi) * q * pow(h, Z);
  /* find the deepest nested frame that holds w; level -1 is the frame around A */
  int n = -1;
  for (int k = 0; k < 14; k++){
    float m = float(n + 1);
    vec2 l = rot(-m * phi) * w / pow(h, m);
    if (!drs_in(l, hs)) break;
    n++;
  }
  float fn = float(n);
  vec2 l = rot(-fn * phi) * w / pow(h, fn);
  vec2 suv = mirrorUv(l / vec2(asp, 1.) + .5);
  vec3 col = n <= 0 ? texture(uA, suv).rgb : texture(uB, suv).rgb;
  float toScreen = pow(h, fn - Z) * uRes.y;          /* level-local units to render pixels */
  float px = 1. / max(uPx, 1e-3);
  /* the next picture down casts a soft shadow on this one */
  vec2 l1 = rot(-(fn + 1.) * phi) * w / pow(h, fn + 1.);
  float out1 = length(max(abs(l1) - hs, 0.)) * pow(h, fn + 1. - Z) * uRes.y;
  col *= 1. - p_shadow * .55 * exp(-out1 / (18. * px)) * env;
  /* a thin mount around every inner picture */
  if (n >= 1 && p_frame > 0.){
    float d = min(hs.x - abs(l.x), hs.y - abs(l.y)) * toScreen;
    float lw = max(p_frame * px, .8);
    col = mix(col, p_line, (1. - smoothstep(lw - .75, lw + .75, d)) * smoothstep(0., .1, env));
  }
  return vec4(col, 1.);
}` });

/* ---- Loxodrome: a Moebius flow between two fixed points set by the pictures' light ---- */
FX.register({ id:'tr-loxodrome', name:'Loxodrome', cat:'transition', family:'maths', nonLocal:true,
  search:['mobius', 'möbius', 'spiral', 'conformal', 'complex', 'vortex', 'drain', 'fixed point', 'riemann'],
  desc:'Both pictures stream along spiralling lines from a source to a sink: A drains into its brightest area while B pours out of its own.',
  params:[ R('spiral','Spiral',.9,-3,3), R('flow','Flow',1,0,3), R('follow','Follow the light',.7,0,1), R('sep','Least separation',.35,.15,.7), I('arms','Arms',3,0,8), R('wave','Arm depth',.6,0,2), R('glow','Edge glow',.35,0,1) ],
  fs:`vec2 lox_mul(vec2 a, vec2 b){ return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 lox_div(vec2 a, vec2 b){ return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / max(dot(b, b), 1e-12); }
vec2 lox_light(sampler2D s){
  vec2 acc = vec2(0.); float wsum = 0.;
  for (int j = 0; j < 5; j++) for (int i = 0; i < 4; i++){
    vec2 u = (vec2(i, j) + .5) / vec2(4., 5.);
    float l = luma(texture(s, u).rgb);
    float w = l * l * l * l + 1e-4;
    acc += centered(u) * w; wsum += w;
  }
  return acc / wsum;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a0 = texture(uA, uv).rgb, b0 = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(a0, 1.);
  if (p >= 1.) return vec4(b0, 1.);
  vec2 z1 = mix(vec2(0., -.2), lox_light(uA) * 1.2, p_follow);
  vec2 z2 = mix(vec2(0., .22), lox_light(uB) * 1.2, p_follow);
  vec2 dz = z2 - z1; float dl = length(dz);
  vec2 dir = dl > 1e-4 ? dz / dl : vec2(0., 1.);
  if (dl < p_sep){ vec2 mid = (z1 + z2) * .5; z1 = mid - dir * p_sep * .5; z2 = mid + dir * p_sep * .5; }
  vec2 z = centered(uv);
  vec2 w = lox_div(z - z1, z - z2);
  float rho = .5 * log(max(dot(w, w), 1e-20));
  float th = atan(w.y, w.x);
  /* both pictures travel from the source z2 towards the sink z1 */
  float env = sin(PI * p);
  float dA = p_flow * p, dB = p_flow * (p - 1.);
  vec2 kA = exp(dA) * vec2(cos(dA * p_spiral), sin(dA * p_spiral));
  vec2 kB = exp(dB) * vec2(cos(dB * p_spiral), sin(dB * p_spiral));
  vec2 wa = lox_mul(w, kA), wb = lox_mul(w, kB);
  vec2 za = lox_div(z1 - lox_mul(z2, wa), vec2(1., 0.) - wa);
  vec2 zb = lox_div(z1 - lox_mul(z2, wb), vec2(1., 0.) - wb);
  vec3 A = texture(uA, clamp(uncentered(za), 0., 1.)).rgb;   /* clamped: off-frame streams in as the picture's own edge colour */
  vec3 B = texture(uB, clamp(uncentered(zb), 0., 1.)).rgb;
  /* the interface is a level set of rho, combed into spiral arms */
  float front = 2.4 * log((1. - p) / p);
  float key = rho + p_wave * env * sin(p_arms * th - p_spiral * rho * 1.5);
  float fw = max(fwidth(key), 1e-4);
  float m = clamp((key - front) / fw + .5, 0., 1.);
  vec3 col = mix(A, B, m);
  col += p_glow * env * exp(-abs(key - front) * 6.) * .5 * vec3(1., .97, .92);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Riemann roll: the frame is a sphere and it rolls over ---- */
FX.register({ id:'tr-riemann-roll', name:'Riemann roll', cat:'transition', family:'maths', nonLocal:true,
  search:['sphere', 'mobius', 'möbius', 'stereographic', 'conformal', 'complex', 'roll', 'inside out', 'infinity'],
  desc:'The picture is treated as a sphere seen from above: it rolls over, A slides away to the far side and B comes round from the point at infinity.',
  params:[ R('angle','Roll direction (°)',90,0,360,1), R('twist','Twist',.6,-2,2), R('lines','Graticule',.2,0,1), C('line','Line colour','#f2efe8','ink'), R('limb','Horizon shade',.45,0,1) ],
  fs:`vec2 rr_mul(vec2 a, vec2 b){ return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 rr_div(vec2 a, vec2 b){ return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / max(dot(b, b), 1e-12); }
vec2 rr_cis(float a){ return vec2(cos(a), sin(a)); }
vec4 fx(vec2 uv){
  float p = uProgress;
  if (p <= 0.) return texture(uA, uv);
  if (p >= 1.) return texture(uB, uv);
  float S = length(vec2(aspect(), 1.)) * .5 + .02;   /* the unit circle just holds the frame */
  float env = sin(PI * p);
  float th = PI * smoothstep(0., 1., p);
  vec2 R = rr_cis(radians(p_angle)), Ri = vec2(R.x, -R.y);
  vec2 z = rr_mul(centered(uv) / S, Ri);
  /* a rotation of the Riemann sphere, with a loxodromic twist that vanishes at both ends */
  float c = cos(th * .5), s = sin(th * .5);
  vec2 w = rr_div(c * z - vec2(s, 0.), s * z + vec2(c, 0.));
  w = rr_mul(w, rr_cis(p_twist * env));
  float r2 = dot(w, w);
  vec3 col;
  if (r2 < 1.) col = texture(uA, mirrorUv(uncentered(rr_mul(w, R) * S))).rgb;
  else { vec2 v = rr_div(vec2(-1., 0.), w); col = texture(uB, mirrorUv(uncentered(rr_mul(rr_mul(v, rr_cis(p_twist * env)), R) * S))).rgb; }
  /* shade towards the equator, where the two hemispheres meet */
  float lat = abs(log(max(r2, 1e-12))) * .5;
  float fw = max(fwidth(lat), 1e-5);
  col *= 1. - p_limb * env * exp(-lat * 2.2) * .6;
  col = mix(col, vec3(1.), env * .25 * (1. - smoothstep(0., 2. * fw, lat)));
  /* lines of latitude and longitude of the sphere */
  if (p_lines > 0.){
    float la = log(max(r2, 1e-12)) * .5 / .35, lo = atan(w.y, w.x) / (PI / 8.);
    vec2 g = abs(fract(vec2(la, lo) + .5) - .5) / max(fwidth(vec2(la, lo)), 1e-5);
    float ln = 1. - smoothstep(.5, 1.5, min(g.x, g.y));
    col = mix(col, p_line, ln * p_lines * env);
  }
  return vec4(col, 1.);
}` });

/* ---- Apollonian gasket: kissing circles fill largest first ---- */
FX.register({ id:'tr-apollonian', name:'Apollonian gasket', cat:'transition', family:'maths',
  search:['circles', 'kissing circles', 'fractal', 'packing', 'inversion', 'bubbles', 'gasket', 'recursive'],
  desc:'The frame is packed with kissing circles, each tangent to its neighbours, and B fills them from the largest down to the smallest.',
  params:[ R('size','Size',.56,.35,1.2), R('spin','Spin (°)',0,0,120,1), R('fill','Fill time',.3,.05,.8), R('weight','Line weight (px)',1.5,0,5), C('line','Line colour','#f2efe8','ink'), R('drift','Drift',.15,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  float G = p_size * (1. + p_drift * .25 * p);
  vec2 z = rot(radians(p_spin) + p_drift * .4 * p) * centered(uv) / G;
  const float r3 = .46410162, dd = .53589838;   /* inner radius 2*sqrt3-3, centre distance 1-r */
  vec2 cin[3]; vec2 cdu[3];
  for (int i = 0; i < 3; i++){
    float a = radians(90. + 120. * float(i));
    cin[i] = dd * vec2(cos(a), sin(a));
    float b = a + radians(60.);
    cdu[i] = 2. * vec2(cos(b), sin(b));     /* outer dual circles: centre 2, radius sqrt3 */
  }
  /* walk inwards: while z sits in one of the four curvilinear triangles, invert it in that
     triangle's dual circle; stop once it is inside a gasket circle (or the outer region) */
  float sc = 1., rb = 1.e3, db = length(z) - 1.;
  for (int it = 0; it < 40; it++){
    if (dot(z, z) >= 1.){ rb = 1.e3; db = length(z) - 1.; break; }
    bool hit = false;
    for (int i = 0; i < 3; i++){
      float d = r3 - length(z - cin[i]);
      if (d >= 0.){ rb = r3; db = d; hit = true; }
    }
    if (hit) break;
    float d0 = dot(z, z);
    if (d0 < .0717968){ float k = .0717968 / max(d0, 1e-12); z *= k; sc *= k; continue; }
    for (int i = 0; i < 3; i++){
      vec2 v = z - cdu[i]; float d = dot(v, v);
      if (d < 3.){ float k = 3. / max(d, 1e-12); z = cdu[i] + v * k; sc *= k; break; }
    }
  }
  float rScreen = rb / sc * G;                     /* circle radius in frame heights */
  float t0 = clamp(log(.27 / max(rScreen, 1e-5)) / log(.27 * uRes.y / 1.5), 0., 1.) * (1. - p_fill);
  float u = rb > 100. ? 0. : 1. - db / rb;         /* 0 at the circle's heart, 1 at its rim */
  float grow = (p - t0) / p_fill;
  float m = rb > 100. ? smoothstep(0., p_fill * .5, p) : step(u, grow * 1.02) * step(0., grow);
  m = max(m, smoothstep(.96, 1., p));
  vec3 col = mix(A, B, m);
  float dpx = db / sc * G * uRes.y;
  float lw = max(p_weight / max(uPx, 1e-3), .8);
  float on = smoothstep(0., .12, p) * (1. - smoothstep(.85, 1., p));
  col = mix(col, p_line, (1. - smoothstep(lw * .5 - .5, lw * .5 + .5, dpx)) * on * step(.01, p_weight));
  return vec4(col, 1.);
}` });

/* ---- Julia matte: the pair chooses a Julia set; B arrives from outside towards its edge ---- */
FX.register({ id:'tr-julia-matte', name:'Julia matte', cat:'transition', family:'maths', nonLocal:true,
  search:['fractal', 'julia set', 'mandelbrot', 'filigree', 'escape time', 'complex', 'recursive'],
  desc:'The two pictures’ average colours choose a Julia set; B closes in from far outside it, along its filigree edge, and the set itself goes last.',
  params:[ R('shape','Shape',0,0,360,1), R('zoom','Zoom',1,.5,3), I('iter','Detail',40,12,64), R('angle','Angle (°)',90,0,360,1), R('glow','Edge glow',.5,0,1), R('drift','Drift',.25,0,1) ],
  fs:`vec3 jul_mean(sampler2D s){
  vec3 acc = vec3(0.);
  for (int j = 0; j < 4; j++) for (int i = 0; i < 3; i++) acc += texture(s, (vec2(i, j) + .5) / vec2(3., 4.)).rgb;
  return acc / 12.;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  vec3 ma = rgb2hsv(jul_mean(uA)), mb = rgb2hsv(jul_mean(uB));
  float ang = TAU * (ma.x + mb.x) * .5 + PI * (ma.z - mb.z) + radians(p_shape) + p_drift * .35 * (p - .5);
  vec2 c = .7885 * vec2(cos(ang), sin(ang));
  vec2 z = rot(radians(p_angle)) * centered(uv) * 3.1 / p_zoom;
  int N = int(p_iter);
  float n = -1., trap = 1e3;
  for (int i = 0; i < 64; i++){
    if (i >= N) break;
    z = vec2(z.x * z.x - z.y * z.y, 2. * z.x * z.y) + c;
    trap = min(trap, length(z));
    float r2 = dot(z, z);
    if (r2 > 256.){ n = float(i) - log2(log2(r2) * .5) + 4.; break; }
  }
  /* far outside escapes first; the filled set is ordered by how close its orbit comes to 0 */
  float key = n < 0. ? 1. + .35 * clamp(trap, 0., 1.) : clamp(n / float(N), 0., 1.);
  key = n < 0. ? key : pow(key, .6);
  float front = p * 1.42 - .04;
  float fw = max(fwidth(key), 1e-4);
  float m = clamp((front - key) / fw + .5, 0., 1.);
  vec3 col = mix(A, B, m);
  float env = sin(PI * p);
  col += p_glow * env * exp(-abs(front - key) * 40.) * .45 * vec3(1., .96, .9);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Hybrid image: fine detail hands over before the broad shapes ---- */
FX.register({ id:'tr-hybrid-image', name:'Hybrid image', cat:'transition', family:'maths', nonLocal:true,
  search:['frequency', 'fourier', 'spatial frequency', 'low pass', 'high pass', 'oliva', 'detail', 'perception'],
  desc:'B’s fine detail arrives first over A’s broad shapes and colour, then the broad shapes hand over too, like a hybrid image seen from further and further away.',
  params:[ R('radius','Largest blur (px)',150,30,300), R('detail','Detail boost',1.2,.5,2.5), R('grain','Sample grain',.5,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  /* the crossover radius grows from a pixel to the largest blur, geometrically */
  float s = smoothstep(0., .8, p);
  float rpx = mix(.5, p_radius, s * s) / max(uPx, 1e-3);
  vec2 r = rpx / uRes;
  float jit = hash12(floor(uv * uRes)) * TAU * p_grain;
  vec3 la = A * .2, lb = B * .2; float ws = .2;
  for (int i = 0; i < 22; i++){
    float t = (float(i) + .5) / 22.;
    float ang = float(i) * 2.39996323 + jit;
    vec2 o = vec2(cos(ang), sin(ang)) * sqrt(t) * r;
    float w = exp(-t * 2.);
    la += texture(uA, uv + o).rgb * w;
    lb += texture(uB, uv + o).rgb * w;
    ws += w;
  }
  la /= ws; lb /= ws;
  /* B's detail on A's low frequencies; the low-frequency difference fades out at the end */
  float k = 1. - smoothstep(.62, 1., p);
  vec3 hiB = (B - lb) * mix(1., p_detail, sin(PI * p));
  vec3 col = lb + hiB + (la - lb) * k;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Hyperbolic tiling: pull back to see the Poincare disc, glide to the next tile ---- */
FX.register({ id:'tr-hyperbolic-glide', name:'Hyperbolic glide', cat:'transition', family:'maths', nonLocal:true,
  search:['poincare', 'poincaré', 'hyperbolic', 'escher', 'circle limit', 'tiling', 'non euclidean', 'disc'],
  desc:'We pull back to find A is one tile of an endless hyperbolic floor in a Poincaré disc, glide across to the B tile next door, and settle into it.',
  params:[ S('tiling','Tiling',['Squares, six at a corner','Squares, eight at a corner','Hexagons, four at a corner','Octagons, four at a corner'],0), R('pull','Pull back',.9,.3,.98), R('weight','Line weight (px)',1.5,0,5), C('line','Line colour','#f2efe8','ink'), C('ground','Ground','#121314','ground'), R('depth','Rim fade',.5,0,1) ],
  fs:`vec2 hyp_div(vec2 a, vec2 b){ return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / max(dot(b, b), 1e-12); }
vec2 hyp_mul(vec2 a, vec2 b){ return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  if (p <= 0.) return texture(uA, uv);
  if (p >= 1.) return texture(uB, uv);
  int sel = int(p_tiling + .5);
  float P = sel == 2 ? 6. : sel == 3 ? 8. : 4.;
  float Q = sel == 1 ? 8. : sel == 0 ? 6. : 4.;
  /* edge circles of the central {P,Q} polygon, orthogonal to the unit circle */
  float rho = acosh(cos(PI / Q) / sin(PI / P));
  float xm = tanh(rho * .5);
  float D = .5 * (xm + 1. / xm), r = .5 * (1. / xm - xm);
  float cN = 1. / D;                      /* centre of the neighbouring tile */
  float mx = 0.;
  for (int k = 0; k < 8; k++){
    if (float(k) >= P) break;
    float t = TAU * float(k) / P;
    mx = max(mx, abs(cos(t)) * asp * .5 + abs(sin(t)) * .5);
  }
  float s0 = .97 * xm / mx;               /* the frame fits inside the central tile */
  float env = smoothstep(0., .34, p) * (1. - smoothstep(.66, 1., p));
  float s = mix(s0, p_pull * 2., env);
  float ta = cN * smoothstep(.22, .78, p);
  vec2 z = centered(uv) * s;
  float rz = length(z);
  float der = s;
  vec2 den = vec2(1., 0.) + ta * z;
  vec2 w = hyp_div(z + vec2(ta, 0.), den);
  der *= (1. - ta * ta) / max(dot(den, den), 1e-12);
  int n = 0;
  for (int it = 0; it < 32; it++){
    bool moved = false;
    for (int k = 0; k < 8; k++){
      if (float(k) >= P) break;
      float t = TAU * float(k) / P;
      vec2 ck = D * vec2(cos(t), sin(t));
      vec2 v = w - ck; float d = dot(v, v);
      if (d < r * r){ float kk = r * r / d; w = ck + v * kk; der *= kk; n++; moved = true; break; }
    }
    if (!moved) break;
  }
  bool odd = (n & 1) == 1;
  vec2 l = w; if (odd) l.x = -l.x;
  vec2 suv = mirrorUv(uncentered(l / s0));
  vec3 col = odd ? texture(uB, suv).rgb : texture(uA, suv).rgb;
  /* tile edges, drawn at a constant screen weight */
  float de = 1e3;
  for (int k = 0; k < 8; k++){
    if (float(k) >= P) break;
    float t = TAU * float(k) / P;
    de = min(de, abs(length(w - D * vec2(cos(t), sin(t))) - r));
  }
  float dpx = de / der * uRes.y;
  float lw = max(p_weight / max(uPx, 1e-3), .8);
  float on = smoothstep(0., .15, env);
  col = mix(col, p_line, (1. - smoothstep(lw * .5 - .5, lw * .5 + .5, dpx)) * on * step(.01, p_weight));
  col = mix(col, p_ground, smoothstep(.55, 1., rz) * p_depth * env);
  float rimpx = (1. - rz) / s * uRes.y;
  col = mix(p_ground, col, clamp(rimpx, 0., 1.));
  return vec4(col, 1.);
}` });

/* ---- Globe turn: plate carree curls into an orthographic globe, turns, unrolls ---- */
FX.register({ id:'tr-globe-turn', name:'Globe turn', cat:'transition', family:'maths', nonLocal:true,
  search:['map projection', 'globe', 'sphere', 'orthographic', 'equirectangular', 'world', 'planet', 'rotate'],
  desc:'The flat picture is read as a world map and curls up into a globe, the globe turns, and B unrolls from its far side as a map again.',
  params:[ R('tilt','Tilt (°)',18,-60,60,1), R('shade','Shading',.6,0,1), R('lines','Graticule',.25,0,1), C('line','Line colour','#f2efe8','ink'), C('ground','Ground','#121314','ground') ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  if (p <= 0.) return texture(uA, uv);
  if (p >= 1.) return texture(uB, uv);
  float k = smoothstep(0., .4, p) * (1. - smoothstep(.6, 1., p));
  float lam0 = PI * smoothstep(.28, .72, p);
  vec2 XY = centered(uv) * PI;
  /* projection family: plate carree at k = 0, orthographic at k = 1 */
  float phi = XY.y, lam = XY.x, inside = 1e3;
  if (k > 1e-4){
    float sy = k * XY.y;
    phi = asin(clamp(sy, -1., 1.)) / k;
    float sx = k * XY.x / max(cos(k * phi), 1e-5);
    lam = asin(clamp(sx, -1., 1.)) / k;
    inside = 1. - max(abs(sy), abs(sx));
  }
  vec3 v = vec3(cos(phi) * sin(lam), sin(phi), cos(phi) * cos(lam));
  float nz = v.z;
  float ti = radians(p_tilt) * k;
  v.yz = mat2(cos(ti), sin(ti), -sin(ti), cos(ti)) * v.yz;
  float lon = atan(v.x, v.z) + lam0, lat = asin(clamp(v.y, -1., 1.));
  lon = mod(lon + PI, TAU) - PI;
  float g = mix(1. / asp, 1., k);
  bool front = abs(lon) < PI * .5;
  float lx = front ? lon : mod(lon, TAU) - PI;
  vec2 suv = mirrorUv(vec2(lx * g / PI + .5, lat / PI + .5));
  vec3 col = front ? texture(uA, suv).rgb : texture(uB, suv).rgb;
  float light = mix(1., .25 + .75 * clamp(nz * .8 + .35 * v.y + .2, 0., 1.), p_shade * k * k);
  col *= light;
  col += pow(1. - clamp(nz, 0., 1.), 4.) * .25 * p_shade * k * k;
  if (p_lines > 0.){
    vec2 gq = vec2(lon, lat) / radians(15.);
    vec2 gg = abs(fract(gq + .5) - .5) / max(fwidth(gq), 1e-5);
    col = mix(col, p_line, (1. - smoothstep(.5, 1.5, min(gg.x, gg.y))) * p_lines * k);
  }
  float aa = max(fwidth(inside), 1e-5);
  col = mix(p_ground, col, clamp(inside / aa, 0., 1.));
  return vec4(col, 1.);
}` });

/* ---- Vanishing line: two infinite planes and the horizon between them ---- */
FX.register({ id:'tr-vanishing-line', name:'Vanishing line', cat:'transition', family:'maths', nonLocal:true,
  search:['projective', 'perspective', 'horizon', 'infinite', 'floor', 'ceiling', 'homography', 'vanishing point'],
  desc:'A lies down as an endless floor and B hangs as an endless ceiling; the horizon where both run to infinity crosses the frame.',
  params:[ R('angle','Direction (°)',90,0,360,1), R('haze','Haze',.6,0,1), C('tint','Haze tint','#f4ece0',false), R('tintAmt','Tint amount',.35,0,1), R('line','Horizon glow',.5,0,1) ],
  fs:`vec3 van_mean(){
  vec3 acc = vec3(0.);
  for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++){
    vec2 u = (vec2(i, j) + .5) / 3.;
    acc += texture(uA, u).rgb + texture(uB, u).rgb;
  }
  return acc / 18.;
}
vec4 fx(vec2 uv){
  float p = uProgress, asp = aspect();
  if (p <= 0.) return texture(uA, uv);
  if (p >= 1.) return texture(uB, uv);
  float ang = radians(p_angle);
  vec2 n = vec2(cos(ang), sin(ang)), tv = vec2(-n.y, n.x);
  vec2 q = centered(uv);
  float d = dot(q, n), t = dot(q, tv);
  float ext = abs(n.x) * asp * .5 + abs(n.y) * .5;
  float H = ext * .6 * tan(PI * (.5 - p));
  vec3 col; float ratio;
  if (d < H){
    float dA = -ext;
    ratio = (H - dA) / max(H - d, 1e-5);
    vec2 qq = n * (dA + (d - dA) * ratio) + tv * t * ratio;
    col = texture(uA, clamp(uncentered(qq), 0., 1.)).rgb;
  } else {
    float dB = ext;
    ratio = (dB - H) / max(d - H, 1e-5);
    vec2 qq = n * (dB + (d - dB) * ratio) + tv * t * ratio;
    col = texture(uB, clamp(uncentered(qq), 0., 1.)).rgb;
  }
  float env = sin(PI * p);
  vec3 hz = mix(van_mean() * 1.15 + .05, p_tint, p_tintAmt);
  float fog = (1. - exp(-(ratio - 1.) * mix(.02, .35, p_haze))) * smoothstep(0., .25, env);
  col = mix(col, hz, clamp(fog, 0., 1.));
  float dpx = abs(d - H) * uRes.y;
  col += p_line * env * exp(-dpx / (6. / max(uPx, 1e-3))) * .5;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Phyllotaxis: a sunflower head of cells fills seed by seed ---- */
FX.register({ id:'tr-phyllotaxis', name:'Phyllotaxis', cat:'transition', family:'maths',
  search:['sunflower', 'golden angle', 'fibonacci', 'spiral', 'seeds', 'vogel', 'parastichy', 'botanical'],
  desc:'The frame becomes a sunflower head, seeds set by the golden angle; B fills it seed by seed from the middle outward, with its bright seeds a little ahead.',
  params:[ I('seeds','Seeds',420,80,900), R('fill','Fill time',.3,.05,.7), R('tone','Order by tone',.35,0,1), R('gap','Gap (px)',2,0,8), C('ground','Gap colour','#121314','ground') ],
  fs:`vec2 phy_seed(float n, float N, float R){
  float a = n * 2.39996323;
  return R * sqrt((n + .5) / N) * vec2(cos(a), sin(a));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  float N = floor(p_seeds);
  float R = length(vec2(aspect(), 1.)) * .5 * 1.06;
  vec2 q = centered(uv);
  float r2 = dot(q, q) / (R * R);
  float n0 = r2 * N - .5;
  int W = int(ceil(1.3 * sqrt(PI * N) * sqrt(r2))) + 4;
  W = min(W, 80);
  float d1 = 1e3, d2 = 1e3, n1 = 0.;
  for (int i = 0; i < 161; i++){
    if (i > 2 * W) break;
    float n = floor(n0) + float(i - W);
    if (n < 0.) continue;
    float d = length(q - phy_seed(n, N, R));
    if (d < d1){ d2 = d1; d1 = d; n1 = n; } else if (d < d2) d2 = d;
  }
  vec2 sp = phy_seed(n1, N, R);
  float tone = luma(texture(uB, clamp(uncentered(sp), 0., 1.)).rgb);
  float t0 = mix(min(n1 / N, 1.), 1. - tone, p_tone) * (1. - p_fill);
  float edge = (d2 - d1) * .5;
  float u = d1 / max(d1 + edge, 1e-5);
  float grow = (p - t0) / p_fill;
  float fw = max(fwidth(u), 1e-3);
  float m = clamp((grow * 1.05 - u) / fw + .5, 0., 1.) * step(0., grow);
  vec3 col = mix(A, B, m);
  float env = smoothstep(0., .12, p) * (1. - smoothstep(.82, 1., p));
  float gpx = edge * uRes.y, gw = max(p_gap / max(uPx, 1e-3), .8);
  col = mix(col, p_ground, (1. - smoothstep(gw * .5 - .5, gw * .5 + .5, gpx)) * env * step(.01, p_gap));
  return vec4(col, 1.);
}` });

/* ---- Dual graph: Voronoi cells of A give way to the Delaunay triangles of B ---- */
FX.register({ id:'tr-voronoi-dual', name:'Voronoi to Delaunay', cat:'transition', family:'maths',
  search:['voronoi', 'delaunay', 'triangulation', 'low poly', 'facets', 'dual', 'mesh', 'cells', 'graph'],
  desc:'A settles into flat Voronoi cells, each cell flips to its dual Delaunay triangles coloured from B, and the facets resolve into B.',
  params:[ R('cells','Cells down the frame',12,4,40), R('jitter','Irregularity',.7,0,1), T('smooth','Smooth facets',false), R('weight','Line weight (px)',1.2,0,4), C('line','Line colour','#f2efe8','ink'), R('order','Order by difference',.6,0,1) ],
  fs:`vec2 vd_node(vec2 c){ return c + (hash22(c * 1.37 + 3.1) - .5) * .7 * p_jitter; }
float vd_seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
float vd_cross(vec2 a, vec2 b){ return a.x * b.y - a.y * b.x; }
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 A = texture(uA, uv).rgb, B = texture(uB, uv).rgb;
  if (p <= 0.) return vec4(A, 1.);
  if (p >= 1.) return vec4(B, 1.);
  float Nc = p_cells;
  vec2 g = centered(uv) * Nc;
  /* Voronoi: nearest and second-nearest node */
  vec2 base = floor(g + .5);
  float d1 = 1e3, d2 = 1e3; vec2 n1 = base;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 nd = vd_node(base + vec2(i, j));
    float d = length(g - nd);
    if (d < d1){ d2 = d1; d1 = d; n1 = nd; } else if (d < d2) d2 = d;
  }
  vec2 cellId = floor(n1 + .5);
  vec3 vA = texture(uA, clamp(uncentered(n1 / Nc), 0., 1.)).rgb;
  vec3 vB = texture(uB, clamp(uncentered(n1 / Nc), 0., 1.)).rgb;
  /* Delaunay: each quad of nodes splits along the diagonal that passes the in-circle test */
  vec2 t0 = vec2(0.), t1 = vec2(0.), t2 = vec2(0.); vec3 bw = vec3(1., 0., 0.); bool found = false;
  vec2 f0 = floor(g);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    if (found) break;
    vec2 c = f0 + vec2(i, j);
    vec2 a = vd_node(c), b = vd_node(c + vec2(1, 0)), d = vd_node(c + vec2(1, 1)), e = vd_node(c + vec2(0, 1));
    /* in-circle determinant of e against triangle a, b, d */
    vec2 ae = a - e, be = b - e, de = d - e;
    float det = dot(ae, ae) * vd_cross(be, de) - dot(be, be) * vd_cross(ae, de) + dot(de, de) * vd_cross(ae, be);
    vec2 tr[6];
    if (det > 0.){ tr[0] = a; tr[1] = b; tr[2] = e; tr[3] = b; tr[4] = d; tr[5] = e; }
    else { tr[0] = a; tr[1] = b; tr[2] = d; tr[3] = a; tr[4] = d; tr[5] = e; }
    for (int k = 0; k < 2; k++){
      vec2 P0 = tr[k * 3], P1 = tr[k * 3 + 1], P2 = tr[k * 3 + 2];
      float ar = vd_cross(P1 - P0, P2 - P0);
      vec3 l = vec3(vd_cross(P1 - g, P2 - g), vd_cross(P2 - g, P0 - g), vd_cross(P0 - g, P1 - g)) / ar;
      if (min(l.x, min(l.y, l.z)) >= -1e-4){ t0 = P0; t1 = P1; t2 = P2; bw = l; found = true; break; }
    }
  }
  vec3 dB;
  vec2 cen = (t0 + t1 + t2) / 3.;
  if (p_smooth > .5){
    dB = texture(uB, clamp(uncentered(t0 / Nc), 0., 1.)).rgb * bw.x + texture(uB, clamp(uncentered(t1 / Nc), 0., 1.)).rgb * bw.y + texture(uB, clamp(uncentered(t2 / Nc), 0., 1.)).rgb * bw.z;
  } else dB = texture(uB, clamp(uncentered(cen / Nc), 0., 1.)).rgb;
  /* each Voronoi cell flips at its own moment; cells where A and B already agree go first */
  float diff = clamp(length(vA - vB) * 1.2, 0., 1.);
  float tc = .36 + .28 * mix(hash12(cellId + 7.7), diff, p_order);
  float flip = step(tc, p);
  float f1 = smoothstep(.04, .3, p), f3 = smoothstep(.7, .96, p);
  vec3 col = flip < .5 ? mix(A, vA, f1) : mix(dB, B, f3);
  float lw = max(p_weight / max(uPx, 1e-3), .8);
  float scl = uRes.y / Nc;
  float dv = (d2 - d1) * .5 * scl;
  float dt = min(vd_seg(g, t0, t1), min(vd_seg(g, t1, t2), vd_seg(g, t2, t0))) * scl;
  float on = step(.01, p_weight);
  float lineV = (1. - smoothstep(lw * .5 - .5, lw * .5 + .5, dv)) * f1 * (1. - flip);
  float lineD = (1. - smoothstep(lw * .5 - .5, lw * .5 + .5, dt)) * (1. - f3) * flip;
  col = mix(col, p_line, max(lineV, lineD) * on * .85);
  return vec4(col, 1.);
}` });

/* ---- Cat map: Arnold's torus map stretches A into ribbons and B folds back out ---- */
FX.register({ id:'tr-cat-map', name:'Cat map', cat:'transition', family:'maths', nonLocal:true,
  search:['arnold', 'torus', 'chaos', 'scramble', 'stretch and fold', 'mixing', 'ergodic', 'shear'],
  desc:'Arnold’s cat map treats the frame as a torus: A is stretched and folded around it into fine diagonal ribbons, and B unfolds out of ribbons running the other way.',
  params:[ R('stretch','Stretch',2.2,.5,4), R('cross','Crossover',.16,.02,.4), S('wrap','Seams',['Wrap (true torus)','Mirror'],0) ],
  fs:`vec2 cat_flow(vec2 x, float t){
  /* M = [[2,1],[1,1]] is symmetric, so M^t = sum of lambda^t along its two orthogonal eigenvectors */
  const vec2 e1 = vec2(.85065081, .52573111), e2 = vec2(-.52573111, .85065081);
  float l1 = pow(2.61803399, t), l2 = pow(.38196601, t);
  return e1 * l1 * dot(e1, x) + e2 * l2 * dot(e2, x);
}
vec2 cat_wrap(vec2 u){ return p_wrap < .5 ? fract(u) : mirrorUv(u); }
vec4 fx(vec2 uv){
  float p = uProgress;
  if (p <= 0.) return texture(uA, uv);
  if (p >= 1.) return texture(uB, uv);
  float ta = p_stretch * smoothstep(0., .5, p);
  float tb = -p_stretch * (1. - smoothstep(.5, 1., p));
  vec3 A = texture(uA, cat_wrap(cat_flow(uv - .5, ta) + .5)).rgb;
  vec3 B = texture(uB, cat_wrap(cat_flow(uv - .5, tb) + .5)).rgb;
  float w = smoothstep(.5 - p_cross, .5 + p_cross, p);
  return vec4(mix(A, B, w), 1.);
}` });

