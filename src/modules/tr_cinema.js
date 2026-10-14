/* ---------------- Transitions: cinema ---------------- */
/* Rules borrowed from the camera, the optical printer, the cutting room, the
   projection booth and the animation stand. Each one is a way film itself
   carries A to B. All start exactly on A and end exactly on B; the craft lives
   in the middle of the move. Frame-to-frame texture (boil, repaint, shutter
   flicker) is keyed on progress, not wall-clock time, so a paused frame shows
   one definite state. */

FX.register({ id:'tr-dolly-zoom', name:'Dolly zoom', cat:'transition', family:'cinema', nonLocal:true, search:['vertigo', 'zolly', 'contra zoom', 'trombone shot', 'hitchcock', 'push', 'perspective'],
  desc:'The subject holds its size while everything around it looms towards the lens, and B comes out of the reverse move.',
  params:[ R('amount','Amount',.55,0,1), S('depth','Depth from',['Distance from the subject','Distance and brightness'],0), R('hold','Subject size',.1,0,.5), R('streak','Streak',.5,0,1), R('fx','Subject X',.5,0,1), R('fy','Subject Y',.5,0,1) ],
  fs:`float dolly_F(float t){ t = max(t, 0.); return t < 1. ? t * t * t - .5 * t * t * t * t : t - .5; }
vec3 dolly_img(sampler2D s, vec2 uv, float e){
  vec2 c = centered(vec2(p_fx, p_fy));
  vec2 d = centered(uv) - c;
  float r = length(d);
  /* how far "behind" the subject this point is: the further, the more it looms */
  float band = .24;
  float w = smoothstep(p_hold, p_hold + band, r);
  float bri = p_depth > .5 ? .35 + .65 * smoothstep(.1, .7, luma(textureLod(s, uv, 4.).rgb)) : 1.;
  float k = p_amount * 3. * e;
  /* magnification rises with distance; integrating it keeps the remap monotonic, so nothing folds */
  float rs = r - bri * k / (1. + k) * band * dolly_F((r - p_hold) / band);
  vec2 dn = d / max(r, 1e-5);
  /* the background moves fastest mid-move, so it streaks along the radius */
  float sl = p_streak * .1 * k / (1. + k) * w;
  vec3 acc = vec3(0.);
  for (int i = 0; i < 7; i++){
    float f = 1. - sl * float(i) / 6.;
    acc += texture(s, clamp(uncentered(c + dn * rs * f), 0., 1.)).rgb;
  }
  return acc / 7.;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float eA = smoothstep(0., .6, p), eB = 1. - smoothstep(.4, 1., p);
  float x = smoothstep(.42, .58, p);
  vec3 col;
  if (x <= 0.) col = dolly_img(uA, uv, eA);
  else if (x >= 1.) col = dolly_img(uB, uv, eB);
  else col = mix(dolly_img(uA, uv, eA), dolly_img(uB, uv, eB), x);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-step-print', name:'Step printing', cat:'transition', family:'cinema', nonLocal:true, search:['step print', 'wong kar-wai', 'stutter', 'smear', 'low frame rate', 'undercrank', 'chungking', 'hong kong'],
  desc:'The push is printed in steps, each frame held and smeared into the next, so the move stutters and trails like a step-printed chase.',
  params:[ I('steps','Steps',8,3,20), S('dir','Move',DIRS4,3), R('smear','Smear',.5,0,1), R('echo','Echo',.45,0,.8), R('lift','Bleach',.25,0,1) ],
  fs:`vec2 step_v(){ int m = int(p_dir + .5); return m == 0 ? vec2(0., -1.) : m == 1 ? vec2(1., 0.) : m == 2 ? vec2(0., 1.) : vec2(-1., 0.); }
vec3 step_frame(vec2 uv, float t){
  /* one exposure of the move: A pushed out, B following it in */
  vec2 v = step_v();
  float s = smoothstep(0., 1., clamp(t, 0., 1.));
  vec2 qa = uv - v * s;
  vec2 qb = uv - v * (s - 1.);
  bool inA = qa.x >= 0. && qa.x <= 1. && qa.y >= 0. && qa.y <= 1.;
  return inA ? texture(uA, qa).rgb : texture(uB, clamp(qb, 0., 1.)).rgb;
}
vec3 step_held(vec2 uv, float tq, float len){
  /* a held frame was shot with an open shutter: it carries the motion of its whole step */
  vec3 acc = vec3(0.);
  for (int i = 0; i < 12; i++) acc += step_frame(uv, tq - len * float(i) / 11.);
  return acc / 12.;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float n = p_steps;
  float tq = floor(p * n + 1e-4) / n;
  float tail = 1. - tq;
  float len = p_smear / n * 1.6 * step(1e-4, tail);
  vec3 col = step_held(uv, tq, len);
  /* the printer laps the previous held frame into this one */
  float e = p_echo * step(1e-4, tail) * step(1e-4, tq);
  if (e > 0.){
    vec3 prev = step_held(uv, tq - 1. / n, len);
    col = mix(col, max(col, prev), e * .8);
    col = mix(col, prev, e * .35);
  }
  /* step-printed footage was duped, so the middle lifts and bleaches a little */
  float env = sin(PI * p);
  col = mix(col, pow(col, vec3(.85)) * .92 + .06, p_lift * env);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-bipack-matte', name:'Bi-pack matte', cat:'transition', family:'cinema', nonLocal:true, search:['optical printer', 'travelling matte', 'matte line', 'counter matte', 'composite', 'bipack', 'special effects'],
  desc:'B is printed in through a high-contrast matte cut from its own tones, and the matte and counter-matte never quite line up, so every edge carries a matte line.',
  params:[ S('from','Matte cut from',['B’s highlights','B’s shadows','A’s highlights','A’s shadows'],0), R('line','Matte line (px)',5,0,16,.5), R('angle','Line angle',35,0,360,1), R('soft','Matte softness',.06,.01,.25), R('fringe','Fringe',1,0,1), R('weave','Printer weave',.4,0,1) ],
  fs:`float bipack_key(vec2 uv){
  int m = int(p_from + .5);
  float l = m < 2 ? luma(textureLod(uB, clamp(uv, 0., 1.), 1.5).rgb) : luma(textureLod(uA, clamp(uv, 0., 1.), 1.5).rgb);
  return (m == 0 || m == 2) ? l : 1. - l;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float s = p_soft;
  /* the exposure threshold walks down through the key's tones */
  float T = mix(1. + s * 1.2, -s * 1.2, smoothstep(.04, .96, p));
  float env = sin(PI * p);
  float ang = radians(p_angle) + p_weave * .8 * sin(p * 9.);
  vec2 off = vec2(cos(ang), sin(ang)) * p_line / uRes * (.6 + .4 * env);
  float m  = smoothstep(T - s, T + s, bipack_key(uv));
  float mc = smoothstep(T - s, T + s, bipack_key(uv + off));
  /* the counter-matte holds A back; where the two disagree the film is either unexposed or doubled */
  vec3 clean = mix(a, b, m);
  vec3 pr = b * m + a * (1. - mc);
  vec3 col = mix(clean, pr, p_fringe);
  /* a little printer gain and lift in the middle, as a dupe generation adds */
  col = mix(col, col * 1.04 + .015, env * .5);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-stop-trick', name:'Stop trick', cat:'transition', family:'cinema', nonLocal:true, search:['méliès', 'melies', 'substitution splice', 'magic', 'jump cut', 'stop motion', 'trick film', 'vanish'],
  desc:'The camera stops, part of the picture is swapped, the camera starts again: B replaces A in a few hard jumps, each with a jolt and a flare where things changed.',
  params:[ I('splices','Splices',5,2,10), S('order','What swaps first',['What changes most','What changes least','Scattered'],0), R('scale','Patch size',.5,0,1), R('jolt','Exposure jolt',.5,0,1), R('jump','Frame jump (px)',6,0,24,.5), R('flare','Flare',.6,0,1) ],
  fs:`float stop_key(vec2 uv){
  vec2 q = centered(uv) * mix(7., 1.6, p_scale);
  float nz = fbm(q + 3.7);
  float d = length(textureLod(uA, uv, 3.).rgb - textureLod(uB, uv, 3.).rgb);
  float dn = smoothstep(.02, .45, d);
  int o = int(p_order + .5);
  float k = o == 0 ? mix(1. - dn, nz, .45) : o == 1 ? mix(dn, nz, .45) : nz;
  return clamp(k, .002, .998);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float n = p_splices;
  float k = floor(p * n + 1e-4);
  float f = p * n - k;
  /* a restart jolt lives only inside splices that are not the last frame */
  float live = step(.5, k) * (1. - step(n - .5, k));
  float dec = exp(-f * 5.) * live;
  vec2 j = (hash22(vec2(k, 7.1)) - .5) * 2. * p_jump / uRes * dec;
  vec2 su = clamp(uv + j, 0., 1.);
  float key = stop_key(su);
  vec3 a = texture(uA, su).rgb, b = texture(uB, su).rgb;
  vec3 col = key < k / n ? b : a;
  /* what has just appeared catches the light, the way a substitution was dressed with a puff */
  float fresh = step((k - 1.) / n, key) * step(key, k / n - 1e-4);
  float edge = smoothstep(.08, 0., abs(key - (k - .5) / n) * n * .25);
  col += p_flare * fresh * dec * (.25 + .35 * edge) * vec3(1., .97, .9);
  /* the restarted camera never comes back at quite the same exposure */
  float ex = 1. + p_jolt * .45 * (hash12(vec2(k, 3.3)) - .3) * dec;
  col *= ex;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-glass-shot', name:'Glass shot', cat:'transition', family:'cinema', nonLocal:true, search:['matte painting', 'glass painting', 'painted backdrop', 'in-camera', 'set extension', 'dawn process'],
  desc:'B is painted on a pane of glass in front of the lens: it comes in as a matte painting along a soft, wandering seam, then the painting goes live.',
  params:[ S('from','Painting comes in',['From the top','From the bottom','From the left','From the right'],0), R('paint','Painterliness',.7,0,1), R('brush','Brush size',.5,0,1), R('wobble','Seam wander',.5,0,1), R('glint','Glass glint',.35,0,1) ],
  fs:`vec3 glass_paint(vec2 uv){
  /* strokes follow a slow direction field; each pixel averages a short dab along its stroke */
  vec2 q = centered(uv) * mix(9., 3., p_brush);
  float a = fbm(q * .5 + 1.3) * TAU * 1.5;
  vec2 dir = vec2(cos(a), sin(a)) * mix(.004, .014, p_brush);
  vec2 jit = (vec2(vnoise(q * 3.1), vnoise(q * 3.1 + 9.)) - .5) * .012 * mix(.5, 1.5, p_brush);
  vec3 acc = vec3(0.);
  for (int i = 0; i < 5; i++){
    float t = float(i) / 4. - .5;
    acc += textureLod(uB, clamp(uv + jit + dir * t * 2., 0., 1.), 1.5).rgb;
  }
  vec3 c = acc / 5.;
  /* a painter mixes a limited set of values, so the tones gather */
  float L = max(luma(c), 1e-3);
  vec3 post = c * (floor(L * 6. + .5) / 6.) / L;
  c = mix(c, mix(c, post, .7), p_paint);
  /* bristle texture runs along each stroke */
  vec2 dn = normalize(dir);
  float tex = vnoise(vec2(dot(q, vec2(-dn.y, dn.x)) * 22., dot(q, dn) * 2.));
  c *= 1. + p_paint * .09 * (tex - .5);
  c = mix(vec3(luma(c)), c, 1. + .15 * p_paint);
  return clamp(c, 0., 1.);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  int m = int(p_from + .5);
  float coord = m == 0 ? 1. - uv.y : m == 1 ? uv.y : m == 2 ? uv.x : 1. - uv.x;
  float across = m < 2 ? uv.x : uv.y;
  float wob = (fbm(vec2(across * 3., 2.1)) - .5) * .22 * p_wobble;
  float soft = .03;
  /* the painting stops on a horizon for a beat, as a glass shot sits, then carries on */
  float tr = smoothstep(0., .3, p) * .5 + smoothstep(.42, .66, p) * .5;
  float seam = mix(-soft - .14, 1. + soft + .14, tr) + wob;
  float paneMask = smoothstep(seam + soft, seam - soft, coord);
  float live = smoothstep(.62, .97, p);
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  vec3 paint = p_paint > 0. ? glass_paint(uv) : b;
  vec3 pane = mix(mix(b, paint, p_paint), b, live);
  /* the pane sits close to the lens, so a reflection drifts across it */
  float env = sin(PI * p);
  vec2 cq = centered(uv);
  float g = exp(-pow((cq.x * .8 + cq.y * .6) - mix(-.9, .9, p), 2.) * 18.);
  pane += p_glint * env * g * vec3(.22, .23, .25);
  vec3 col = mix(a, pane, paneMask);
  /* the blend line darkens slightly where paint feathers onto the plate */
  col *= 1. - .12 * env * (1. - live) * exp(-pow((coord - seam) / soft, 2.));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-multiplane', name:'Multiplane', cat:'transition', family:'cinema', nonLocal:true, search:['multiplane camera', 'disney', 'parallax', 'layers', 'depth', 'cel', 'truck in', 'animation stand'],
  desc:'A comes apart into painted planes by tone, the camera trucks through them so each plane sweeps past at its own speed, and B is the backdrop behind.',
  params:[ I('planes','Planes',4,2,6), S('order','Furthest planes',['Brightest tones','Darkest tones'],0), R('drift','Sideways drift',.5,-1,1), R('defocus','Defocus',.35,0,1), R('accel','Ease in',1.3,.6,2.5) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float N = p_planes;
  float c = (N + .1) * pow(smoothstep(0., .92, p), p_accel);
  vec2 q = centered(uv);
  vec3 col = vec3(0.);
  float acc = 0.;
  for (int j = 0; j < 6; j++){
    if (float(j) >= N || acc >= .999) break;
    float z = float(j) + 1.;
    /* a plane fades as the camera reaches it; until then it grows as distance shrinks */
    float alpha = 1. - smoothstep(z - .55, z - .02, c);
    if (alpha <= 0.) continue;
    float sc = z / max(z - c, .02);
    vec2 off = vec2(p_drift * .35, 0.) * c / z;
    vec2 su = uncentered((q - off) / sc);
    bool inside = su.x >= 0. && su.x <= 1. && su.y >= 0. && su.y <= 1.;
    if (!inside) continue;
    /* each plane holds the tones at or nearer than its own depth; the last one holds everything */
    float l = luma(textureLod(uA, su, 2.).rgb);
    float depth = p_order < .5 ? l : 1. - l;
    /* each plane holds only its own band of tones, so the gaps it leaves open onto B */
    float sw = .025 * smoothstep(0., .25, c);
    float t0 = float(j) / N, t1 = (float(j) + 1.) / N;
    float lo = j == 0 ? 1. : smoothstep(t0 - sw, t0 + sw, depth + 1e-5 + .07);
    float hi = float(j) >= N - 1. ? 1. : smoothstep(t1 + sw, t1 - sw, depth - 1e-5);
    /* nearer planes overlap a little into the next band, so the planes part as shapes, not as hairline cracks */
    if (sw <= 0.){ lo = j == 0 ? 1. : step(t0, depth + .07); hi = float(j) >= N - 1. ? 1. : step(depth, t1 - 1e-6); }
    float cov = lo * hi;
    float lod = p_defocus * 3. * smoothstep(0., 1., c / z);
    vec3 pc = textureLod(uA, su, lod).rgb;
    /* min, not over: neighbouring bands are a partition, so their soft edges add back to one */
    float w = min(cov * alpha, 1. - acc);
    col += pc * w;
    acc += w;
  }
  /* B waits behind the last plane, settling as the camera arrives */
  float sb = mix(1.1, 1., smoothstep(0., 1., p));
  vec3 b = texture(uB, uncentered(q / sb)).rgb;
  col += b * (1. - acc);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-hidden-cut', name:'Hidden cut', cat:'transition', family:'cinema', nonLocal:true, search:['rope', 'invisible cut', 'one take', 'oner', 'stitch', 'black', 'seamless cut', 'push into dark'],
  desc:'The camera drifts into the darkest part of A until shadow fills the frame, and the cut is hidden there before it pulls out of the darkest part of B.',
  params:[ R('push','Push in',.6,0,1), R('drift','Drift to the dark',.85,0,1), R('crush','Shadow spread',.75,0,1), R('hold','Black hold',.08,0,.3) ],
  fs:`vec2 hidden_dark(sampler2D s){
  /* the weighted centre of the picture's darkest areas, from a coarse 4x4 read */
  vec2 acc = vec2(0.); float wt = 0.;
  for (int i = 0; i < 4; i++) for (int k = 0; k < 4; k++){
    vec2 g = (vec2(float(i), float(k)) + .5) / 4.;
    float l = luma(textureLod(s, g, 5.).rgb);
    float w = pow(1. - l, 6.) + 1e-4;
    acc += g * w; wt += w;
  }
  return acc / wt;
}
vec3 hidden_img(sampler2D s, vec2 uv, float e){
  float z = 1. + p_push * 2.6 * e * e;
  vec2 c = mix(vec2(.5), hidden_dark(s), p_drift * smoothstep(0., .7, e));
  vec2 h = vec2(.5 / z);
  c = clamp(c, h, 1. - h);
  vec2 su = c + (uv - .5) / z;
  vec3 col = texture(s, su).rgb;
  /* the shadows spread up through the tones until everything is under them */
  float l = luma(textureLod(s, su, 1.).rgb);
  float th = p_crush * 1.1 * e;
  col *= mix(1., smoothstep(th - .2, th + .35, l), smoothstep(0., .2, e)) * (1. - e * e * e);
  return col;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float h = p_hold * .5;
  float eA = smoothstep(0., .5 - h, p);
  float eB = 1. - smoothstep(.5 + h, 1., p);
  vec3 col = p < .5 ? hidden_img(uA, uv, eA) : hidden_img(uB, uv, eB);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-rotoscope', name:'Rotoscope', cat:'transition', family:'cinema', nonLocal:true, search:['rotoscope', 'cel', 'ink and paint', 'traced', 'animation', 'boil', 'scanner darkly', 'outline', 'morph'],
  desc:'Both pictures are traced into flat cels, and the cel shapes melt from A’s outlines into B’s before the photograph returns.',
  params:[ I('bands','Tones',5,2,9), R('line','Ink line (px)',1.6,0,5,.1), C('ink','Ink','#17130f','ink'), R('boil','Line boil',.5,0,1), R('flat','Flatness',.85,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float env = sin(PI * p);
  /* traced on twos: the line shifts a little on every second frame */
  float fr = floor(p * 48. / 2.);
  vec2 bo = (vec2(vnoise(uv * 9. + fr * 7.31), vnoise(uv * 9. + fr * 3.17 + 40.)) - .5) * p_boil * 5. / uRes.y * env;
  vec2 su = clamp(uv + bo, 0., 1.);
  float m = smoothstep(.22, .78, p);
  float lA = luma(textureLod(uA, su, 2.5).rgb), lB = luma(textureLod(uB, su, 2.5).rgb);
  float f = mix(lA, lB, m);
  float N = p_bands;
  float q = f * N;
  /* band steps are antialiased over a pixel, and over more where the tone is only drifting */
  float fq = fract(q), aw = max(fwidth(q), .08);
  float band = clamp(floor(q) + smoothstep(1. - aw, 1., fq), 0., N - 1.);
  vec3 cA = textureLod(uA, su, 5.).rgb, cB = textureLod(uB, su, 5.).rgb;
  vec3 hue = mix(cA, cB, m);
  float val = (band + .5) / N;
  vec3 fill = clamp(hue / max(luma(hue), .04) * val, 0., 1.);
  vec3 soft = mix(texture(uA, su).rgb, texture(uB, su).rgb, m);
  fill = mix(soft, fill, p_flat);
  float e = min(fract(q), 1. - fract(q));
  float w = max(fwidth(q), 1e-4);
  float line = (1. - smoothstep(p_line * .5, p_line * .5 + 1., e / w)) * step(.01, p_line);
  line *= step(.5, q) * step(q, N - .5);
  /* no line where the tone barely crosses a band edge, or film grain would draw dust */
  line *= smoothstep(.02, .06, fwidth(q));
  vec3 cel = mix(fill, p_ink, line);
  float wA = 1. - smoothstep(0., .26, p), wB = smoothstep(.74, 1., p);
  vec3 col = mix(mix(cel, texture(uA, uv).rgb, wA), texture(uB, uv).rgb, wB);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-silhouette-gel', name:'Silhouette and gel', cat:'transition', family:'cinema', nonLocal:true, search:['silhouette', 'title sequence', 'gel', 'colour field', 'cut-out', 'reiniger', 'shadow play', 'bond titles'],
  desc:'A drops to a black silhouette against a coloured gel, the silhouette reshapes into B’s dark shapes as the gel changes colour, and B is lit back up.',
  params:[ R('thr','Silhouette level',.38,.05,.9), S('gel','Gel colours',['Taken from the pictures','Chosen'],0), C('gel1','First gel','#e2462b','accent'), C('gel2','Second gel','#2c5fd6','accent2'), C('ink','Silhouette','#0d0c0c','ink'), R('glow','Gel glow',.5,0,1) ],
  fs:`vec3 sil_gel(sampler2D s){
  /* the picture's overall colour, pushed to a saturated gel */
  vec3 h = rgb2hsv(textureLod(s, vec2(.5), 9.).rgb);
  return hsv2rgb(vec3(h.x, max(h.y, .72), .92));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float m = smoothstep(.28, .72, p);
  float lA = luma(textureLod(uA, uv, 1.).rgb), lB = luma(textureLod(uB, uv, 1.).rgb);
  float f = mix(lA, lB, m);
  float w = max(fwidth(f), 1e-3) * 1.5;
  float lit = smoothstep(p_thr - w, p_thr + w, f);
  vec3 g1 = p_gel < .5 ? sil_gel(uA) : p_gel1;
  vec3 g2 = p_gel < .5 ? sil_gel(uB) : p_gel2;
  vec3 gel = mix(g1, g2, m);
  vec2 q = centered(uv);
  float r = length(q - vec2(0., .12));
  gel *= mix(1., 1.18 - .7 * r * r, p_glow);
  /* a thin bright rim where the light wraps the silhouette */
  float rim = exp(-pow((f - p_thr) / (w * 3. + .02), 2.)) * .35 * p_glow;
  vec3 g = mix(p_ink, gel, lit) + rim * gel;
  float wA = 1. - smoothstep(0., .3, p), wB = smoothstep(.7, 1., p);
  /* into the silhouette the shadows go first; out of it the light comes up through the tones */
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float tA = smoothstep(wA - .25, wA + .05, lA);
  float tB = smoothstep(1. - wB - .05, 1. - wB + .25, 1. - lB);
  vec3 col = mix(g, a, wA * mix(1., tA, .6));
  col = mix(col, b, wB * mix(1., tB, .6));
  if (p <= 0.) col = a;
  if (p >= 1.) col = b;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-zoetrope', name:'Zoetrope', cat:'transition', family:'cinema', search:['zoetrope', 'praxinoscope', 'pre-cinema', 'slits', 'strobe', 'persistence of vision', 'drum'],
  desc:'The picture is seen through the slits of a spinning drum, each slit a few frames further on, so the change from A to B runs across the frame.',
  params:[ I('slits','Slits',9,4,40), R('width','Slit width',.55,.1,.9), R('spread','Time across the drum',1.2,0,2), R('spin','Spin',1.5,-4,4,.05), R('travel','Movement in the strip',.35,0,.6), R('drum','Drum shading',.6,0,1) ],
  fs:`vec3 zoe_frame(vec2 uv, float q){
  /* the strip inside the drum: A moves off and B moves on */
  float e = smoothstep(0., 1., q);
  vec3 a = texture(uA, clamp(uv + vec2(e * p_travel, 0.), 0., 1.)).rgb;
  vec3 b = texture(uB, clamp(uv - vec2((1. - e) * p_travel, 0.), 0., 1.)).rgb;
  return mix(a, b, e);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float env = sin(PI * p);
  float N = p_slits;
  float spin = p_spin * p;
  float s = uv.x * N + spin;
  float k = floor(s), fr = fract(s);
  /* each slit is a later frame, by where it sits across the drum */
  float h = clamp((k + .5 - spin) / N, 0., 1.);
  float q = clamp(p * (1. + p_spread) - p_spread * h, 0., 1.);
  vec3 img = zoe_frame(uv, q);
  float w = mix(1.25, p_width, smoothstep(0., .22, p) * (1. - smoothstep(.78, 1., p)));
  float d = abs(fr - .5);
  float aa = N / uRes.x * 1.5;
  float vis = 1. - smoothstep(w * .5 - aa, w * .5 + aa, d);
  /* the inside of the drum is dark, with the light falling across its curve */
  vec2 cq = centered(uv);
  float curve = 1. - p_drum * env * .55 * cq.x * cq.x / (aspect() * aspect() * .25);
  float slitShade = 1. - p_drum * env * .35 * smoothstep(.0, .5, d / max(w, .01) * 2. - .4);
  vec3 drum = vec3(.06, .055, .05) * (.6 + .4 * curve) * (1. + .5 * sin(uv.y * PI));
  vec3 col = mix(drum, img * curve * slitShade, vis);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-metric-montage', name:'Metric montage', cat:'transition', family:'cinema', search:['eisenstein', 'montage', 'intercut', 'rapid cutting', 'rhythm', 'soviet', 'reframe', 'cutting'],
  desc:'A and B are intercut in ever shorter shots that slow again at the end, and each cut reframes the picture, like a Soviet montage sequence.',
  params:[ I('cuts','Cut pairs',8,2,20), R('accel','Acceleration',.7,0,.95), R('reframe','Reframing',.6,0,1), R('tilt','Canted angles',.3,0,1), R('flash','Cut flash',.25,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float N = p_cuts;
  /* shots shorten towards the middle and lengthen again */
  float ph = N * (p - p_accel * sin(TAU * p) / TAU);
  float k = floor(ph), c = fract(ph);
  float share = smoothstep(0., 1., p);
  bool isB = c < share;
  float shotT = isB ? c / max(share, 1e-4) : (c - share) / max(1. - share, 1e-4);
  float id = k * 2. + (isB ? 1. : 0.);
  float env = pow(sin(PI * p), .6);
  vec2 hr = hash22(vec2(id, 11.3));
  float sc = 1. + p_reframe * env * (.15 + .75 * hr.x);
  float ang = (hash12(vec2(id, 4.1)) - .5) * .5 * p_tilt * env;
  vec2 q = centered(uv) * rot(ang) / sc;
  /* keep the reframed shot inside the picture */
  vec2 room = vec2(aspect(), 1.) * .5 * (1. - 1. / sc) * .9;
  vec2 o = (hr - .5) * 2. * room;
  vec2 su = clamp(uncentered(q + o), 0., 1.);
  vec3 col = isB ? texture(uB, su).rgb : texture(uA, su).rgb;
  col += p_flash * env * exp(-shotT * 14.) * .5;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-ratio-change', name:'Ratio change', cat:'transition', family:'cinema', search:['aspect ratio', 'letterbox', 'anamorphic', 'scope', 'widescreen', 'desqueeze', 'mommy', 'frame opens'],
  desc:'The frame closes down to a wide letterbox, B arrives anamorphically squeezed and opens out across it, then the frame opens back to full height.',
  params:[ S('ratio','Ratio',['2.39 : 1','2 : 1','1.85 : 1','1 : 1'],0), R('squeeze','Squeeze',2.2,1,4,.05), R('soft','Bar softness',0,0,1), C('bars','Bars','#000000',false) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  int ri = int(p_ratio + .5);
  float target = ri == 0 ? 2.39 : ri == 1 ? 2. : ri == 2 ? 1.85 : 1.;
  float ar = aspect();
  /* visible fraction of the height (letterbox) or of the width (pillarbox) */
  float vis = target >= ar ? ar / target : target / ar;
  bool letter = target >= ar;
  float close = smoothstep(.0, .3, p) * (1. - smoothstep(.7, 1., p));
  float open = mix(1., vis, close);
  float coord = letter ? abs(uv.y - .5) : abs(uv.x - .5);
  float px = (letter ? 1. / uRes.y : 1. / uRes.x) * (1. + 40. * p_soft);
  float frame = 1. - smoothstep(open * .5 - px, open * .5 + px, coord);
  if (close <= 0.) frame = 1.;
  /* B comes in squeezed and opens out sideways to fill the letterbox */
  float u = smoothstep(.3, .68, p);
  float sq = mix(1. / p_squeeze, 1., u);
  float wB = smoothstep(.0, .06, u);
  float dx = uv.x - .5;
  vec2 bu = vec2(.5 + dx / sq, uv.y);
  float inB = (1. - smoothstep(sq * .5 - 1. / uRes.x, sq * .5 + 1. / uRes.x, abs(dx))) * wB;
  vec3 a = texture(uA, uv).rgb;
  vec3 b = texture(uB, clamp(bu, 0., 1.)).rgb;
  if (u >= 1.) inB = 1.;
  vec3 pic = mix(a, b, inB);
  vec3 col = mix(p_bars, pic, frame);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-onion-skin', name:'Onion skin', cat:'transition', family:'cinema', nonLocal:true, search:['lightbox', 'onion skinning', 'pencil test', 'animation', 'tracing', 'in-between', 'drawing', 'line test'],
  desc:'On the animator’s lightbox A turns into a red pencil drawing, B is traced over it in blue, and B is painted back in once the sheets line up.',
  params:[ R('line','Line weight',.55,0,1), C('pa','A pencil','#c8463a',false), C('pb','B pencil','#2d5aa8',false), C('paper','Paper','#f1ede3',false), R('light','Backlight',.5,0,1), R('drift','Sheet drift',.35,0,1) ],
  fs:`float onion_lines(sampler2D s, vec2 uv){
  vec2 d = vec2(1.5) / uRes;
  float lod = 1.;
  float l1 = luma(textureLod(s, clamp(uv + vec2(d.x, 0.), 0., 1.), lod).rgb);
  float l2 = luma(textureLod(s, clamp(uv - vec2(d.x, 0.), 0., 1.), lod).rgb);
  float l3 = luma(textureLod(s, clamp(uv + vec2(0., d.y), 0., 1.), lod).rgb);
  float l4 = luma(textureLod(s, clamp(uv - vec2(0., d.y), 0., 1.), lod).rgb);
  float g = length(vec2(l1 - l2, l3 - l4));
  return smoothstep(.03, mix(.16, .06, p_line), g);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float mv = smoothstep(.2, .8, p);
  vec2 dA = vec2(-.6, 1.) * p_drift * .03 * mv;
  vec2 dB = vec2(.6, -1.) * p_drift * .03 * (1. - mv);
  float eA = onion_lines(uA, uv + dA) * (1. - smoothstep(.5, .82, p));
  float eB = onion_lines(uB, uv + dB) * smoothstep(.18, .5, p);
  /* graphite is grainy, and the lightbox shines through the middle of the sheet */
  float grain = .7 + .3 * hash12(floor(uv * uRes));
  vec2 cq = centered(uv);
  vec3 paper = p_paper * (1. + p_light * (.12 - .3 * dot(cq, cq)));
  vec3 sheet = paper;
  sheet = mix(sheet, sheet * p_pa, eA * grain);
  sheet = mix(sheet, sheet * p_pb * 1.05, eB * grain);
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  /* the photograph sinks into the paper and comes back out of it */
  float wA = 1. - smoothstep(0., .28, p), wB = smoothstep(.72, 1., p);
  vec3 col = mix(sheet, a, wA);
  col = mix(col, b, wB);
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-changeover', name:'Changeover', cat:'transition', family:'cinema', nonLocal:true, search:['projector', 'projection booth', 'reel change', 'shutter flicker', 'lamp', 'douser', 'two projectors', 'out of rack', 'frame line'],
  desc:'Two projectors share the screen: A’s runs down flickering as its lamp goes warm, while B’s comes up out of rack, frame lines rolling past, until it is racked into place.',
  params:[ R('flicker','Shutter flicker',.6,0,1), R('rack','Out of rack',.6,0,1), R('warm','Lamp warmth',.6,0,1), R('weave','Gate weave',.4,0,1), R('strike','Lamp strike',.4,0,1) ],
  fs:`float change_shutter(vec2 uv, float phase, float amt){
  /* a slow shutter blade crosses the gate as a soft dark band */
  float b = .5 + .5 * cos(TAU * (uv.y * 1.3 + uv.x * .25 + phase));
  return 1. - amt * smoothstep(.25, 1., b);
}
float change_rack(vec2 uv, float off, out vec2 su){
  /* out of rack, the gate shows part of one frame, the black frame line, then part of the next */
  float fl = .075;
  float m = mod(uv.y + off, 1. + fl);
  su = vec2(uv.x, clamp(m, 0., 1.));
  float px = 1.5 / uRes.y;
  return 1. - smoothstep(1., 1. + px, m) * (1. - smoothstep(1. + fl - px, 1. + fl, m));
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float LA = 1. - smoothstep(.34, .62, p);
  float LB = smoothstep(.38, .66, p);
  float runA = smoothstep(.05, .5, p);
  float runB = 1. - smoothstep(.55, .95, p);
  vec2 wv = vec2(sin(p * 37.), sin(p * 23. + 1.)) * p_weave * 3. / uRes;
  vec3 a = texture(uA, clamp(uv + wv * runA, 0., 1.)).rgb;
  a *= mix(vec3(1.), vec3(1., .74, .48), p_warm * runA);
  /* as A's machine slows, whole frames start to flicker and the blade shows */
  float fa = floor(p * 30.);
  a *= 1. - p_flicker * runA * .4 * step(.55, hash12(vec2(fa, 1.3)));
  a *= change_shutter(uv, p * 7., p_flicker * .6 * runA);
  /* B rolls through the gate until the projectionist racks it into place */
  float u = 1. - smoothstep(.36, .9, p);
  float off = p_rack * 1.6 * u * u;
  vec2 bs;
  float pic = change_rack(uv + wv * runB, off, bs);
  vec3 b = texture(uB, bs).rgb * pic;
  b *= mix(vec3(1.), vec3(.9, .96, 1.06), .6 * p_warm * runB);
  float strike = p_strike * exp(-pow((p - .48) * 9., 2.));
  b *= 1. + strike;
  b *= change_shutter(uv, -p * 9. + .4, p_flicker * .5 * runB);
  vec3 col = a * LA + b * LB;
  if (p <= 0.) col = texture(uA, uv).rgb;
  if (p >= 1.) col = texture(uB, uv).rgb;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-painted-emulsion', name:'Painted emulsion', cat:'transition', family:'cinema', search:['hand painted film', 'brakhage', 'direct animation', 'dye', 'flicker', 'experimental film', 'aniline', 'scratch'],
  desc:'Every frame is painted over by hand in dyes taken from B, each one differently, flickering between the two pictures until B comes through.',
  params:[ I('rate','Frames',36,8,96), R('dye','Dye',.75,0,1), R('scale','Blot size',.5,0,1), R('sat','Saturation',.8,0,1), R('scratch','Scratches',.5,0,1), R('flick','Exposure flicker',.4,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float fi = floor(p * p_rate);
  float cov = pow(sin(PI * p), .7);
  /* underneath, each frame is one picture or the other, more often B as it goes on */
  bool showB = hash12(vec2(fi, 2.7)) < p;
  if (p <= 0.) showB = false;
  if (p >= 1.) showB = true;
  vec3 col = showB ? texture(uB, uv).rgb : texture(uA, uv).rgb;
  vec2 q = centered(uv) * mix(6., 1.5, p_scale);
  /* film runs vertically, so brushed dye streaks along it */
  q.y *= .55;
  for (int i = 0; i < 3; i++){
    float fl = float(i);
    vec2 sd = hash22(vec2(fi, fl * 13.1)) * 50.;
    float n = fbm(q + sd);
    float mk = smoothstep(.46, .62, n + (fl - 1.) * .04);
    vec3 dc = textureLod(uB, hash22(vec2(fi + fl, 5.)), 3.).rgb;
    vec3 hv = rgb2hsv(dc);
    dc = hsv2rgb(vec3(hv.x + (fl - 1.) * .08, mix(hv.y, 1., p_sat), mix(.75, 1., hv.z)));
    col *= mix(vec3(1.), dc * 1.1, mk * p_dye * cov);
  }
  /* scratched to the clear base: thin bright lines that never sit still */
  float sx = hash12(vec2(fi, 9.4));
  float sw = (hash12(vec2(fi, 1.2)) * .8 + .4) / uRes.x;
  float wav = .006 * sin(uv.y * 23. + fi);
  float ln = exp(-pow((uv.x - sx - wav) / sw, 2.));
  float sx2 = hash12(vec2(fi, 19.8));
  ln += .6 * exp(-pow((uv.x - sx2 + wav) / (sw * 1.6), 2.)) * step(.5, hash12(vec2(fi, 3.)));
  col = mix(col, vec3(.98, .96, .9), clamp(ln, 0., 1.) * p_scratch * cov);
  col *= 1. + p_flick * .3 * (hash12(vec2(fi, 8.8)) - .5) * cov;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-scratched-leader', name:'Scratched leader', cat:'transition', family:'cinema', nonLocal:true, search:['direct animation', 'mclaren', 'len lye', 'scratch film', 'emulsion', 'black leader', 'free radicals', 'etched'],
  desc:'A sinks into black emulsion and B is scratched back through it in lines that run along the film and boil from frame to frame, B’s highlights first.',
  params:[ I('lines','Scratches',30,8,90), R('boil','Boil',.5,0,1), R('wander','Wander',.45,0,1), T('layers','Dye layers show',true), C('emulsion','Emulsion','#0d0b0a',false) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float fr = floor(p * 40.);
  float K = p_lines;
  float x = uv.x * K;
  float reveal = smoothstep(.12, .9, p);
  float lB = luma(textureLod(uB, uv, 2.).rgb);
  float cut = 0., fringe = 0.;
  float px = K / uRes.x;
  for (int o = -1; o <= 1; o++){
    float k = floor(x) + float(o);
    vec2 hk = hash22(vec2(k, 4.2));
    /* scratched by hand, a frame at a time, so the line jitters as well as wanders */
    float jit = (hash12(vec2(k, fr)) - .5) * .35 * p_boil;
    float cx = k + .5 + (hk.x - .5) * .5 + p_wander * .3 * sin(uv.y * (6. + hk.y * 10.) + hk.x * 20.) + jit;
    float t = hk.y * .75;
    float act = smoothstep(t, t + .12, reveal + .45 * (lB - .5));
    float wd = mix(.03, .62, act * act) * act + .5 * smoothstep(.75, 1., reveal);
    float d = abs(x - cx);
    cut = max(cut, (1. - smoothstep(wd - px, wd + px, d)) * step(.001, act));
    fringe = max(fringe, (1. - smoothstep(wd + px, wd * 1.35 + 2.5 * px, d)) * act);
  }
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float emul = smoothstep(0., .3, p);
  vec3 col = mix(a, p_emulsion, emul);
  /* a shallow scratch only takes the top dye layers away, so its edges run yellow and magenta */
  if (p_layers > .5) col = mix(col, mix(vec3(.85, .62, .08), vec3(.7, .12, .45), step(.5, hash12(floor(uv * uRes * .5)))) * (.5 + .5 * lB), fringe * (1. - cut) * .7 * emul);
  col = mix(col, b * 1.05 + .02, cut * emul);
  col = mix(col, b, smoothstep(.92, 1., p));
  return vec4(clamp(col, 0., 1.), 1.);
}` });

FX.register({ id:'tr-one-point', name:'One-point', cat:'transition', family:'cinema', search:['kubrick', 'symmetry', 'one point perspective', 'mirror', 'corridor', 'vanishing point', 'centre framing'],
  desc:'A folds into perfect mirror symmetry as the camera pushes down the centre line, and B unfolds out of the same symmetry.',
  params:[ R('push','Push in',.3,0,1), S('axis','Axis',['Vertical','Horizontal'],0), S('keep','Half kept',['Left or bottom','Right or top'],0), R('hold','Symmetry hold',.2,0,.5) ],
  fs:`vec3 onept_img(sampler2D s, vec2 uv, float f, float z){
  bool vert = p_axis < .5;
  float c = vert ? uv.x : uv.y;
  bool keepLow = p_keep < .5;
  /* the fold seam runs in from the edge to the centre line; beyond it the kept half is mirrored */
  float seam = mix(1., .5, f);
  float cc = keepLow ? c : 1. - c;
  if (cc > seam) cc = 2. * seam - cc;
  c = keepLow ? cc : 1. - cc;
  vec2 fu = vert ? vec2(c, uv.y) : vec2(uv.x, c);
  vec2 su = .5 + (fu - .5) / z;
  return texture(s, clamp(su, 0., 1.)).rgb;
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float h = p_hold * .5;
  float fA = smoothstep(0., .5 - h, p);
  float fB = 1. - smoothstep(.5 + h, 1., p);
  float zA = 1. + p_push * 1.4 * smoothstep(0., .6, p);
  float zB = 1. + p_push * 1.4 * (1. - smoothstep(.4, 1., p));
  float x = smoothstep(.5 - h - .06, .5 + h + .06, p);
  vec3 col;
  if (x <= 0.) col = onept_img(uA, uv, fA, zA);
  else if (x >= 1.) col = onept_img(uB, uv, fB, zB);
  else col = mix(onept_img(uA, uv, fA, zA), onept_img(uB, uv, fB, zB), x);
  return vec4(col, 1.);
}` });

FX.register({ id:'tr-rear-projection', name:'Rear projection', cat:'transition', family:'cinema', nonLocal:true, search:['back projection', 'process shot', 'rear screen', 'plate', 'hotspot', 'driving scene', 'composite'],
  desc:'B comes up as a back-projected plate behind A’s foreground, soft and hot in the middle, until the foreground walks off and the plate becomes the picture.',
  params:[ R('key','Foreground level',.42,.1,.9), R('hot','Hotspot',.6,0,1), R('soft','Plate softness',.5,0,1), S('walk','Foreground leaves',['Sinks out of frame','Walks off left','Walks off right','Fades away'],0), R('edge','Matte edge',.4,0,1) ],
  fs:`float rear_fg(vec2 uv){
  if (uv.x < 0. || uv.x > 1. || uv.y > 1.) return 0.;
  /* near things tend to be low in the frame as well as dark */
  float l = luma(textureLod(uA, uv, 2.).rgb) + (uv.y - .35) * .5;
  return smoothstep(p_key + .05, p_key - .05, l);
}
vec4 fx(vec2 uv){
  float p = uProgress;
  float env = sin(PI * p);
  /* the plate: projected from behind, so it is soft, lifted and brightest in the middle */
  vec3 b = texture(uB, uv).rgb;
  vec3 bs = textureLod(uB, uv, 1.5 * p_soft).rgb;
  vec2 q = centered(uv);
  float hot = 1.22 - .95 * dot(q, q) * p_hot - .1 * (1. - p_hot);
  vec3 plate = mix(bs, vec3(luma(bs)), .15) * .82 + .07;
  plate *= mix(1., hot, p_hot);
  plate = mix(b, plate, smoothstep(0., .25, p) * (1. - smoothstep(.65, 1., p)));
  float reveal = smoothstep(.05, .38, p);
  float leave = smoothstep(.45, .9, p);
  int wk = int(p_walk + .5);
  vec2 sh = wk == 0 ? vec2(0., leave * 1.15) : wk == 1 ? vec2(leave * 1.15, 0.) : wk == 2 ? vec2(-leave * 1.15, 0.) : vec2(0.);
  vec2 fu = uv + sh;
  float fg = rear_fg(fu);
  if (wk == 3) fg *= 1. - leave;
  vec3 a = texture(uA, clamp(fu, 0., 1.)).rgb;
  /* before it leaves, the foreground stays with A's own background, which goes first */
  float showA = mix(1., fg, reveal);
  /* a thin dark matte edge where foreground meets plate */
  float l = luma(textureLod(uA, clamp(fu, 0., 1.), 2.).rgb) + (fu.y - .35) * .5;
  float ed = exp(-pow((l - p_key) / .05, 2.)) * p_edge * env * reveal;
  vec3 col = mix(plate, a, showA);
  col *= 1. - .45 * ed * step(.02, fg);
  if (p >= 1.) col = b;
  return vec4(clamp(col, 0., 1.), 1.);
}` });
