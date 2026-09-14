/* ---------------- Creative coding ----------------
   Generative systems that make the base frame. Feedback-based ones build up
   over time, so let them run a second or two before judging them.
--------------------------------------------------- */

/* ---- Flow field ---- */
FX.register({ id:'gen-flow', name:'Flow field', cat:'generator', feedback:true, nonLocal:true, desc:'Ink carried along a noise flow field, leaving painted trails. Colour it from image A.',
  params:[ R('scale','Field scale',2.2,.3,8), R('speed','Flow speed',1,0,4), R('curl','Curl',1,0,3), R('drift','Drift',.35,0,2), R('fade','Fade',.02,.002,.3,.001), R('inject','New ink',.45,0,1), S('source','Ink from',['Colour','Image A','Two colours']), R('grain','Grain',.15,0,1),
    C('c1','Ink','#ff5a36'), C('c2','Second ink','#c9f5e4'), C('bg','Ground','#141516') ],
  fs:`vec2 field(vec2 p){
  float n = fbm(p * p_scale + vec2(uLoop * TAU * .12 * p_speed, 0.));
  float m = fbm(p * p_scale * 1.07 + vec2(9.2, 4.7) - uLoop * .2);
  float a = (n - .5) * TAU * 2. * p_curl + (m - .5) * TAU * .5;
  return vec2(cos(a), sin(a)) + vec2(0., -p_drift * .4);
}
vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  vec2 v = field(c) * (.9 + .6 * p_speed) / uRes.y * 3.2;
  vec4 pv = texture(uPrev, uv - v);
  vec3 prev = pv.a < .5 ? p_bg : pv.rgb;
  vec3 bg = p_bg;
  vec3 col = mix(prev, bg, p_fade);
  /* seed new ink where the field converges */
  float seed = hash12(floor(uv * uRes / 3.) + floor(uTime * 30.));
  float birth = step(1. - p_inject * .012, seed);
  vec3 ink = p_source < .5 ? p_c1 : p_source < 1.5 ? texture(uA, uv).rgb : mix(p_c1, p_c2, smoothstep(-.4, .4, c.x + fbm(c * 2.) - .5));
  col = mix(col, ink, birth);
  col += (hash12(uv * uRes + floor(uTime * 24.)) - .5) * p_grain * .05;
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Ink bleed ---- */
FX.register({ id:'gen-ink', name:'Ink bleed', cat:'generator', feedback:true, nonLocal:true, desc:'Drops of ink spreading and bleeding into wet paper, with grain and edge darkening.',
  params:[ R('spread','Spread',1,.2,3), R('drops','Drops',.7,0,1), R('size','Drop size',.08,.01,.3), R('gravity','Gravity',.2,-1,1), R('turbulence','Turbulence',.5,0,2), R('dry','Drying',.01,0,.15,.001), R('edge','Edge darkening',.5,0,1),
    S('source','Drops from',['Colour','Image A'], 0), C('ink','Ink','#2b2f6b','ink'), C('ink2','Second ink','#ff5a36','accent'), C('paper','Paper','#efece2','ground') ],
  fs:`vec4 fx(vec2 uv){
  vec2 px = 1. / uRes * p_spread;
  vec2 warp = (vec2(fbm(uv * 4. + uLoop), fbm(uv * 4. + 7.3 - uLoop)) - .5) * p_turbulence * px * 3.;
  vec2 q = uv + warp + vec2(0., -p_gravity * px.y * .8);
  vec4 p0 = texture(uPrev, q);
  vec3 c = p0.rgb * .2;
  c += texture(uPrev, q + vec2(px.x, 0.)).rgb * .2;
  c += texture(uPrev, q - vec2(px.x, 0.)).rgb * .2;
  c += texture(uPrev, q + vec2(0., px.y)).rgb * .2;
  c += texture(uPrev, q - vec2(0., px.y)).rgb * .2;
  if (p0.a < .5) c = p_paper;
  c = mix(c, p_paper, p_dry);
  /* new drops */
  float t = floor(uTime * 3.);
  for (int i = 0; i < 3; i++){
    vec2 h = hash22(vec2(t + float(i) * 17.3, 4.1));
    if (h.x > p_drops) continue;
    vec2 dp = hash22(vec2(t * 3.7 + float(i), 9.1));
    float r = p_size * (.4 + hash12(vec2(t, float(i))) * .9);
    float d = length((uv - dp) * vec2(aspect(), 1.));
    float m = smoothstep(r, r * .55, d);
    vec3 ink = p_source > .5 ? texture(uA, uv).rgb : mix(p_ink, p_ink2, step(.5, hash12(vec2(t, float(i) + 3.))));
    c = mix(c, ink, m);
  }
  float l = luma(c), e = fwidth(l) * 6. * p_edge;
  c *= 1. - clamp(e, 0., .5);
  c += (hash12(uv * uRes) - .5) * .03;
  return vec4(clamp(c, 0., 1.), 1.);
}` });

/* ---- Automata ---- */
FX.register({ id:'gen-cells', name:'Automata', cat:'generator', feedback:true, nonLocal:true, desc:'A cellular automaton on a coarse grid — life, growth, dissolve or ripple — with fading trails.',
  params:[ R('cell','Cell size',26,3,80,1), S('rule','Rule',['Life','Growth','Dissolve','Ripple'],0), R('density','Seed density',.28,.02,.9), R('rate','Steps per second',6,1,30,1), R('trail','Trails',.55,0,.98), R('spark','Random births',.12,0,1), T('grid','Grid lines',false),
    C('on','Live','#c9f5e4'), C('off','Ground','#141516'), C('fade','Trail colour','#3b6f5e') ],
  fs:`/* state is packed into the alpha channel: alive, step parity, trail */
float packA(float alive, float parity, float trail){ return (1. + alive * 128. + parity * 64. + floor(clamp(trail, 0., 1.) * 62. + .5)) / 255.; }
float aliveAt(vec2 id, vec2 cs){ float A = max(floor(texture(uPrev, (id + .5) * cs / uRes).a * 255. + .5) - 1., 0.); return floor(A / 128.); }
vec4 fx(vec2 uv){
  vec2 cs = vec2(max(p_cell, 2.));
  vec2 id = floor(uv * uRes / cs);
  float raw = floor(texture(uPrev, (id + .5) * cs / uRes).a * 255. + .5);
  float A = max(raw - 1., 0.);
  float alive = floor(A / 128.);
  float rest = A - alive * 128.;
  float stored = floor(rest / 64.);
  float trail = (rest - stored * 64.) / 62.;
  float parity = mod(floor(uTime * p_rate), 2.);
  if (raw < .5){ alive = step(1. - p_density, hash12(id + 1.7)); trail = alive; }
  else if (abs(stored - parity) > .5){
    float n = 0.;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
      if (i == 0 && j == 0) continue;
      n += aliveAt(id + vec2(i, j), cs);
    }
    int r = int(p_rule + .5);
    float born = 0., survive = 0.;
    if (r == 0){ born = step(2.5, n) * step(n, 3.5); survive = step(1.5, n) * step(n, 3.5); }
    else if (r == 1){ born = step(2.5, n) * step(n, 3.5); survive = step(3.5, n); }
    else if (r == 2){ born = step(3.5, n) * step(n, 4.5); survive = step(2.5, n) * step(n, 3.5); }
    else { born = step(1.5, n) * step(n, 2.5); survive = step(.5, n) * step(n, 2.5) + step(4.5, n) * step(n, 5.5); }
    alive = clamp(mix(born, survive, alive), 0., 1.);
    alive = max(alive, step(1. - p_spark * .006, hash12(id + floor(uTime * p_rate) * 3.1)));
    trail = max(alive, trail * p_trail);
  }
  vec3 col = mix(mix(p_off, p_fade, trail), p_on, alive);
  if (p_grid > .5){
    vec2 f = fract(uv * uRes / cs);
    float g = min(min(f.x, f.y), min(1. - f.x, 1. - f.y));
    col = mix(col, p_off, (1. - smoothstep(0., 1.5 / max(p_cell, 2.), g)) * .45);
  }
  return vec4(col, packA(alive, parity, trail));
}` });

/* ---- Interference ---- */
FX.register({ id:'gen-waves', name:'Interference', cat:'generator', desc:'Overlapping wave sources interfering — plasma, contour rings or hard bands. Loops seamlessly.',
  params:[ I('sources','Sources',4,1,8), R('freq','Frequency',30,2,80), R('spread','Spread',.62,.05,1), I('speed','Loops per cycle',1,0,6), S('style','Style',['Smooth','Bands','Contours','Dots'],0), I('steps','Band count',6,2,40), R('warp','Warp',.2,0,2),
    C('c1','Low','#141516'), C('c2','High','#c9f5e4'), C('c3','Peak','#ff5a36'), R('mix3','Peak amount',.35,0,1) ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = centered(uv);
  vec2 orbit = vec2(cos(uLoop * TAU), sin(uLoop * TAU)) * .35;   /* orbit the noise so the loop closes */
  p += (vec2(fbm(p * 2. + orbit), fbm(p * 2. + 5.1 - orbit)) - .5) * p_warp;
  float sum = 0.;
  int n = int(p_sources + .5);
  for (int i = 0; i < 8; i++){
    if (i >= n) break;
    float fi = float(i), a = TAU * fi / float(n) + uLoop * TAU * p_speed;   /* whole cycles per loop */
    vec2 s = vec2(cos(a), sin(a)) * p_spread;
    sum += sin(length(p - s) * p_freq - uLoop * TAU * p_speed);
  }
  float v = sum / float(n) * .5 + .5;
  int st = int(p_style + .5);
  if (st == 1) v = floor(v * p_steps) / max(p_steps - 1., 1.);
  else if (st == 2){ float g = fract(v * p_steps); v = 1. - smoothstep(0., .06 + uPx * .002, min(g, 1. - g)); }
  else if (st == 3){ vec2 g = fract(p * p_steps * 2.) - .5; v = 1. - smoothstep(v * .48, v * .48 + .05, length(g)); }
  vec3 col = mix(p_c1, p_c2, clamp(v, 0., 1.));
  col = mix(col, p_c3, smoothstep(.75, 1., v) * p_mix3);
  return vec4(col, 1.);
}` });

/* ---- Blobs ---- */
FX.register({ id:'gen-blobs', name:'Blobs', cat:'generator', desc:'Metaballs merging and separating, as solid shapes, outlines or contour rings. Loops seamlessly.',
  params:[ I('count','Blobs',7,2,16), R('size','Size',.11,.03,.5), R('spread','Travel',.34,0,1), I('speed','Loops per cycle',1,0,6), R('threshold','Threshold',1,.3,3), S('style','Style',['Solid','Outline','Contours','Glow'],0), R('line','Line weight',.03,.004,.2),
    T('gradient','Gradient fill',true), C('c1','Fill','#ff5a36'), C('c2','Fill 2','#ffd2a8'), C('bg','Ground','#141516') ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = centered(uv);
  float f = 0.; vec2 grad = vec2(0.);
  int n = int(p_count + .5);
  for (int i = 0; i < 16; i++){
    if (i >= n) break;
    float fi = float(i);
    vec2 h = hash22(vec2(fi, 3.1));
    float cyc = floor(1. + h.x * 2.);                 /* whole cycles keep the loop seamless */
    float a = uLoop * TAU * p_speed * cyc + h.y * TAU;
    vec2 c = vec2(cos(a + fi), sin(a * 2. + fi * 2.1)) * p_spread * (.5 + h.x * .8);
    float r = p_size * (.5 + h.y * .9);
    vec2 d = p - c;
    float dd = max(length(d), 1e-4);
    f += pow(r / dd, 4.);
    grad += -4. * pow(r, 4.) / pow(dd, 6.) * d;
  }
  float v = f / max(p_threshold, .05);
  float aa = max(fwidth(v), 1e-4);
  vec3 fill = mix(p_c1, mix(p_c1, p_c2, clamp(length(p) * 1.4 + v * .1, 0., 1.)), step(.5, p_gradient));
  vec3 col = p_bg;
  int st = int(p_style + .5);
  if (st == 0) col = mix(p_bg, fill, smoothstep(1. - aa, 1. + aa, v));
  else if (st == 1){ float e = abs(v - 1.) / max(aa, 1e-4); col = mix(p_bg, fill, 1. - smoothstep(p_line * 60., p_line * 60. + 1.5, e)); }
  else if (st == 2){ float g = fract(pow(v, .4) * 6.); float gw = max(fwidth(g) * 1.2, .01); col = mix(p_bg, fill, (1. - smoothstep(gw, gw * 2.5, min(g, 1. - g))) * smoothstep(.02, .15, v)); }
  else col = mix(p_bg, fill, clamp(pow(v, .55) * .85, 0., 1.));
  return vec4(col, 1.);
}` });

/* ---- Solid ---- */
FX.register({ id:'gen-solid', name:'Solid', cat:'generator', desc:'A raymarched 3D solid — torus, box, sphere, capsule or knot — turning slowly with brand-coloured light. Loops seamlessly.',
  params:[ S('shape','Shape',['Torus','Rounded box','Sphere','Capsule','Twisted torus'],0), R('size','Size',.9,.3,1.8), R('round','Roundness',.2,0,.5), I('speed','Loops per cycle',1,0,4), R('tiltX','Tilt',.5,-1.5,1.5), R('twist','Twist',0,0,3), S('shading','Shading',['Matte','Metal','Glass','Flat bands'],0), I('bands','Bands',5,2,20),
    C('light','Light','#ffffff'), C('c1','Body','#ff5a36'), C('c2','Shadow','#2b2f6b'), C('bg','Ground','#141516'), T('shadow','Contact shadow',true) ],
  fs:`float sdf(vec3 p){
  float tw = p_twist * 2.;
  if (tw > .001){ float a = p.y * tw; p.xz = rot(a) * p.xz; }
  int s = int(p_shape + .5);
  float sz = p_size;
  if (s == 0) { vec2 q = vec2(length(p.xz) - sz * .62, p.y); return length(q) - sz * .26; }
  if (s == 1) { vec3 d = abs(p) - vec3(sz * .5); return length(max(d, 0.)) + min(max(d.x, max(d.y, d.z)), 0.) - p_round * sz * .5; }
  if (s == 2) return length(p) - sz * .6;
  if (s == 3) { vec3 q = p; q.y -= clamp(q.y, -sz * .35, sz * .35); return length(q) - sz * .3; }
  vec2 q = vec2(length(p.xz) - sz * .6, p.y);
  float a = atan(p.z, p.x) * 2.;
  q = rot(a) * q;
  return length(vec2(abs(q.x) - sz * .12, q.y)) - sz * .1;
}
vec3 nrm(vec3 p){ vec2 e = vec2(.0012, 0.); return normalize(vec3(sdf(p + e.xyy) - sdf(p - e.xyy), sdf(p + e.yxy) - sdf(p - e.yxy), sdf(p + e.yyx) - sdf(p - e.yyx))); }
vec4 fx(vec2 uv){
  vec2 c = centered(uv);
  vec3 ro = vec3(0., 0., 3.2), rd = normalize(vec3(c * 1.6, -1.9));
  float ay = uLoop * TAU * p_speed, ax = p_tiltX;
  mat2 ry = rot(ay), rx = rot(ax);
  vec3 col = p_bg;
  float t = 0., d = 0.; bool hit = false;
  for (int i = 0; i < 72; i++){
    vec3 p = ro + rd * t;
    p.xz = ry * p.xz; p.yz = rx * p.yz;
    d = sdf(p);
    if (d < .002){ hit = true; break; }
    t += d * .85;
    if (t > 7.) break;
  }
  if (hit){
    vec3 p = ro + rd * t; p.xz = ry * p.xz; p.yz = rx * p.yz;
    vec3 n = nrm(p), l = normalize(vec3(.6, .8, .55));
    float diff = clamp(dot(n, l), 0., 1.), fres = pow(1. - clamp(dot(n, -normalize(vec3(rd.x, rd.y, rd.z))), 0., 1.), 3.);
    int sh = int(p_shading + .5);
    vec3 body = mix(p_c2, p_c1, diff);
    if (sh == 1){ float spec = pow(clamp(dot(reflect(-l, n), -rd), 0., 1.), 40.); body = mix(p_c2, p_c1, pow(diff, .6)) + p_light * (spec + fres * .5); }
    else if (sh == 2){ body = mix(p_c1, p_light, fres) * (.5 + diff * .7); }
    else if (sh == 3){ float b = floor(diff * p_bands) / max(p_bands - 1., 1.); body = mix(p_c2, p_c1, b); }
    else body += p_light * pow(clamp(dot(reflect(-l, n), -rd), 0., 1.), 18.) * .35;
    col = body;
  } else if (p_shadow > .5){
    float sh = smoothstep(.9, 0., length(c - vec2(0., -.15)) * 1.5);
    col = mix(p_bg, p_bg * .55, sh * .5);
  }
  return vec4(clamp(col, 0., 1.), 1.);
}` });

/* ---- Orbits ---- */
FX.register({ id:'gen-orbit', name:'Orbits', cat:'generator', kind:'2d', desc:'Spirograph curves drawn live — one long line, rings of points or a chord web. Loops seamlessly.',
  params:[ I('curves','Curves',3,1,12), R('r1','Outer radius',.36,.05,.6), R('r2','Inner radius',.18,.01,.5), R('pen','Pen offset',.22,.01,.6), I('loops','Turns',7,1,60), S('style','Style',['Line','Dots','Chords'],0), R('weight','Line weight',1,.2,6), I('speed','Loops per cycle',1,0,6), R('offset','Curve spacing',.08,0,.4),
    T('draw','Draw on with timeline',false), T('palette','Colours from palette',true), C('c1','Ink','#e4e2dc'), C('c2','Second ink','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const mn = Math.min(w, h), cx = w / 2, cy = h / 2, N = Math.max(1, P.curves | 0);
    const turns = Math.max(1, P.loops | 0), steps = Math.min(6000, turns * 180);
    const reveal = P.draw ? Util.clamp(api.p) : 1, phase = api.loop * (P.speed | 0) * KT.TAU;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let c = 0; c < N; c++){
      const k = c / Math.max(1, N - 1 || 1);
      const R = (P.r1 + c * P.offset * .2) * mn, r = (P.r2 + c * P.offset * .12) * mn * .5, pen = P.pen * mn * .5;
      const col = P.palette ? Brand.paletteColor(c, 4, c % 2 ? P.c2 : P.c1) : (c % 2 ? P.c2 : P.c1);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(phase); ctx.translate(-cx, -cy);   /* spin the whole curve, so the loop closes */
      ctx.strokeStyle = ctx.fillStyle = col; ctx.lineWidth = Math.max(.5, mn * .002 * P.weight);
      const pt = i => {
        const t = i / steps * turns * KT.TAU + c * .3;
        const x = cx + (R - r) * Math.cos(t) + pen * Math.cos((R - r) / Math.max(r, 1e-3) * t);
        const y = cy + (R - r) * Math.sin(t) - pen * Math.sin((R - r) / Math.max(r, 1e-3) * t);
        return [x, y];
      };
      const last = Math.floor(steps * reveal);
      if ((P.style | 0) === 0){
        ctx.beginPath();
        for (let i = 0; i <= last; i++){ const [x, y] = pt(i); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      } else if ((P.style | 0) === 1){
        const every = Math.max(1, Math.round(steps / (60 + turns * 8)));
        for (let i = 0; i <= last; i += every){ const [x, y] = pt(i); ctx.beginPath(); ctx.arc(x, y, ctx.lineWidth * 1.6, 0, KT.TAU); ctx.fill(); }
      } else {
        const nodes = 60 + turns * 4, every = Math.max(1, Math.round(steps / nodes));
        ctx.globalAlpha = .5;
        ctx.beginPath();
        for (let i = 0; i <= last; i += every){ const [x, y] = pt(i); const [x2, y2] = pt((i + every * Math.round(nodes * .38)) % steps); ctx.moveTo(x, y); ctx.lineTo(x2, y2); }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.restore();
      void k;
    }
  } });

/* ---- Network ---- */
FX.register({ id:'gen-nodes', name:'Network', cat:'generator', kind:'2d', desc:'Drifting nodes joined by lines when they come close — constellation, mesh or web. Loops seamlessly.',
  params:[ I('count','Nodes',60,4,300), R('range','Join distance',.26,.03,.6), R('drift','Drift',.4,0,2), I('speed','Loops per cycle',1,1,6), R('dot','Node size',1,0,4), R('line','Line weight',1,.2,5), S('style','Style',['Lines','Triangles','Lines + labels'],0), T('fade','Fade by distance',true), I('seed','Seed',3,1,99),
    T('palette','Colours from palette',false), C('ink','Ink','#e4e2dc'), C('accent','Node colour','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const n = Math.max(4, P.count | 0), mn = Math.min(w, h), seed = P.seed | 0, R = P.range * mn;
    const ph = api.loop * (P.speed | 0) * KT.TAU;
    const pts = [];
    for (let i = 0; i < n; i++){
      const a = KT.rnd(i, seed), b = KT.rnd(i + 91, seed), c = KT.rnd(i + 233, seed);
      const cx1 = 1 + Math.round(c * 2), cy1 = 1 + Math.round(a * 2);   /* whole cycles keep the loop seamless */
      const x = (.06 + .88 * a) * w + Math.cos(ph * cx1 + b * KT.TAU) * P.drift * mn * .06;
      const y = (.06 + .88 * b) * h + Math.sin(ph * cy1 + c * KT.TAU) * P.drift * mn * .06;
      pts.push([x, y, i]);
    }
    ctx.lineWidth = Math.max(.4, mn * .0012 * P.line); ctx.lineJoin = 'round';
    const style = P.style | 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++){
      const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], d = Math.hypot(dx, dy);
      if (d > R) continue;
      const a = P.fade ? 1 - d / R : 1;
      ctx.globalAlpha = a * .85;
      ctx.strokeStyle = P.palette ? Brand.paletteColor(i + j, 6, P.ink) : P.ink;
      if (style === 1 && n <= 140){
        for (let k = j + 1; k < n; k++){
          if (Math.hypot(pts[i][0] - pts[k][0], pts[i][1] - pts[k][1]) > R || Math.hypot(pts[j][0] - pts[k][0], pts[j][1] - pts[k][1]) > R) continue;
          ctx.globalAlpha = a * .12; ctx.fillStyle = ctx.strokeStyle;
          ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.lineTo(pts[k][0], pts[k][1]); ctx.closePath(); ctx.fill();
          break;
        }
        ctx.globalAlpha = a * .5;
      }
      ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const r = mn * .004 * P.dot;
    if (r > .2){
      ctx.fillStyle = P.accent;
      pts.forEach(([x, y, i]) => { if (P.palette) ctx.fillStyle = Brand.paletteColor(i, 2, P.accent); ctx.beginPath(); ctx.arc(x, y, r, 0, KT.TAU); ctx.fill(); });
    }
    if (style === 2){
      ctx.font = `500 ${Math.max(7, mn * .014)}px ${Util.fonts[2]}`; ctx.fillStyle = P.ink; ctx.globalAlpha = .6; ctx.textBaseline = 'middle';
      pts.forEach(([x, y, i]) => { if (i % 4) return; ctx.fillText(String(i).padStart(2, '0'), x + r + mn * .006, y); });
      ctx.globalAlpha = 1;
    }
  } });

/* ---- Op stripes ---- */
FX.register({ id:'gen-stripes', name:'Op stripes', cat:'generator', desc:'Op-art stripes, checks or rings bent by a lens, wave or twist. Loops seamlessly.',
  params:[ S('pattern','Pattern',['Stripes','Checks','Rings','Radial'],0), R('count','Count',24,2,160), R('duty','Thickness',.5,.05,.95), R('angle','Angle',0,-90,90,1), S('warp','Warp',['None','Lens','Wave','Twist','Pinch'],1), R('amount','Warp amount',.6,0,2), I('speed','Loops per cycle',1,0,6), R('softness','Softness',.02,0,.3),
    C('c1','Colour 1','#141516'), C('c2','Colour 2','#e4e2dc'), C('c3','Accent stripe','#ff5a36'), I('accentEvery','Accent every',0,0,24) ],
  fs:`vec4 fx(vec2 uv){
  vec2 p = centered(uv);
  float t = uLoop * TAU * p_speed;
  int wm = int(p_warp + .5);
  if (wm == 1){ float r = length(p); p *= 1. + p_amount * .8 * (1. - smoothstep(0., .85, r)) * (.7 + .3 * sin(t)); }
  else if (wm == 2){ p += vec2(sin(p.y * 6. + t), cos(p.x * 6. - t)) * p_amount * .12; }
  else if (wm == 3){ float r = length(p); p = rot(p_amount * 2.2 * (1. - smoothstep(0., .8, r)) + t * .1) * p; }
  else if (wm == 4){ float r = length(p); p *= pow(max(r, 1e-3), -p_amount * .35); }
  p = rot(radians(p_angle)) * p;
  float v;
  int pm = int(p_pattern + .5);
  if (pm == 0) v = fract(p.x * p_count * .5 + t / TAU);
  else if (pm == 1){ vec2 g = fract(p * p_count * .5 + t / TAU); v = abs(step(.5, g.x) - step(.5, g.y)) > .5 ? .2 : .8; }
  else v = fract(length(p) * p_count * .5 - t / TAU);
  if (pm == 3) v = fract(atan(p.y, p.x) / TAU * p_count * .25 + t / TAU);
  float aa = max(fwidth(v) * 1.2, p_softness * .5) + .0015;
  float m = pm == 1 ? step(.5, v) : smoothstep(p_duty - aa, p_duty + aa, v);
  vec3 col = mix(p_c1, p_c2, m);
  if (p_accentEvery >= 1.){
    float idx = pm == 0 ? floor(p.x * p_count * .5 + t / TAU) : pm == 2 ? floor(length(p) * p_count * .5 - t / TAU) : floor((atan(p.y, p.x) / TAU * p_count * .25) + t / TAU);
    if (mod(idx, p_accentEvery) < .5) col = mix(p_c3, col, m);
  }
  return vec4(col, 1.);
}` });

/* ---- Spiral ---- */
FX.register({ id:'gen-spiral', name:'Spiral', cat:'generator', kind:'2d', desc:'Sunflower spiral of dots, rings or letters that grows outward and breathes. Loops seamlessly.',
  params:[ I('count','Items',420,10,2000), R('spread','Spread',.9,.3,1.6), R('size','Item size',1,.1,4), S('shape','Item',['Dot','Ring','Square','Letters'],0), X('text','Letters','BOUNCE'), F('font','Font'), S('grow','Motion',['Rotate','Grow outward','Breathe','Wave'],0), I('speed','Loops per cycle',1,0,6),
    S('colour','Colour',['Single','Two-tone by ring','From palette','Radial fade'],0), R('sizeFalloff','Size falloff',.5,-1,1), C('c1','Ink','#e4e2dc'), C('c2','Second ink','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const n = Math.max(10, P.count | 0), mn = Math.min(w, h), cx = w / 2, cy = h / 2;
    const GA = Math.PI * (3 - Math.sqrt(5)), ph = api.loop * (P.speed | 0), motion = P.grow | 0;
    const chars = [...String(P.text || 'A')];
    const base = mn * .012 * P.size;
    if ((P.shape | 0) === 3) ctx.textAlign = 'center', ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++){
      let k = (i + .5) / n;
      if (motion === 1) k = (k + ph) % 1;
      const r = Math.sqrt(k) * mn * .48 * P.spread * (motion === 2 ? 1 + .08 * Math.sin(ph * KT.TAU) : 1);
      let a = i * GA + (motion === 0 ? ph * KT.TAU : 0);
      if (motion === 3) a += Math.sin(ph * KT.TAU - k * 6) * .25;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      let s = base * (1 + P.sizeFalloff * (k - .5) * 1.6);
      if (motion === 1) s *= Math.min(1, k * 8) * Math.min(1, (1 - k) * 8);
      if (s <= .15) continue;
      const cm = P.colour | 0;
      ctx.fillStyle = ctx.strokeStyle = cm === 0 ? P.c1 : cm === 1 ? (Math.floor(k * 12) % 2 ? P.c2 : P.c1) : cm === 2 ? Brand.paletteColor(i, 5, P.c1) : P.c1;
      ctx.globalAlpha = cm === 3 ? Util.clamp(1.15 - k) : 1;
      const shape = P.shape | 0;
      if (shape === 0){ ctx.beginPath(); ctx.arc(x, y, s, 0, KT.TAU); ctx.fill(); }
      else if (shape === 1){ ctx.lineWidth = Math.max(.5, s * .35); ctx.beginPath(); ctx.arc(x, y, s, 0, KT.TAU); ctx.stroke(); }
      else if (shape === 2){ ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillRect(-s, -s, s * 2, s * 2); ctx.restore(); }
      else { ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); ctx.font = KT.font(P, s * 3); ctx.fillText(chars[i % chars.length], 0, 0); ctx.restore(); }
    }
    ctx.globalAlpha = 1;
  } });

/* ---- Scribble ---- */
FX.register({ id:'gen-scribble', name:'Scribble', cat:'generator', kind:'2d', nonLocal:true, desc:'Redraws image A as pen work — scribbles, hatching, contour lines or a single continuous line.',
  params:[ S('style','Style',['Scribble','Hatching','Contours','One line'],0), I('strokes','Strokes',1200,50,6000), R('length','Stroke length',1,.2,4), R('weight','Pen weight',1,.2,5), R('threshold','Ink threshold',.5,0,1), T('invert','Draw the lights',true), R('jitter','Looseness',1,0,3), T('draw','Draw on with timeline',true), I('seed','Seed',1,1,99),
    C('ink','Pen','#141516', false), S('ground','Ground',['Over frame','Colour'],1), C('bg','Ground colour','#efece2', false) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api;
    if ((P.ground | 0) === 1){ ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h); }
    const cols = Math.max(8, Math.round(120 * Math.sqrt(w / Math.max(h, 1)))), rows = Math.max(8, Math.round(cols * h / w));
    const data = api.sample('A', cols, rows).data;
    const lum = (x, y) => { const i = (Math.min(rows - 1, Math.max(0, y | 0)) * cols + Math.min(cols - 1, Math.max(0, x | 0))) * 4; return (data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722) / 255; };
    const val = (px, py) => { const v = lum(px / w * cols, py / h * rows); return P.invert ? v : 1 - v; };
    const n = Math.max(50, P.strokes | 0), seed = P.seed | 0, mn = Math.min(w, h);
    const reveal = P.draw ? Util.clamp(api.p) : 1, shown = Math.floor(n * reveal);
    ctx.strokeStyle = P.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(.4, mn * .0012 * P.weight);
    const style = P.style | 0, L = mn * .02 * P.length;
    if (style === 3){
      ctx.beginPath(); let x = w / 2, y = h / 2;
      for (let i = 0; i < shown; i++){
        const a = (KT.rnd(i, seed) - .5) * KT.TAU * .9 + Math.atan2(h / 2 - y, w / 2 - x) * .25;
        const d = L * (.4 + val(x, y) * 2.2);
        x = Util.clamp(x + Math.cos(a) * d, 0, w); y = Util.clamp(y + Math.sin(a) * d, 0, h);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke(); return;
    }
    for (let i = 0; i < shown; i++){
      let x = KT.rnd(i, seed) * w, y = KT.rnd(i + 77, seed) * h;
      let tries = 0;
      while (val(x, y) < P.threshold * .9 && tries++ < 6){ x = KT.rnd(i + tries * 13, seed) * w; y = KT.rnd(i + tries * 31 + 5, seed) * h; }
      const v = val(x, y); if (v < P.threshold * .35) continue;
      ctx.globalAlpha = Util.clamp(.25 + v * .9);
      ctx.beginPath();
      if (style === 0){
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++){ const a = KT.rnd(i * 7 + k, seed) * KT.TAU * P.jitter; x += Math.cos(a) * L * (.5 + v); y += Math.sin(a) * L * (.5 + v); ctx.lineTo(x, y); }
      } else if (style === 1){
        const a = (Math.floor(v * 3) * 40 + 20) * Math.PI / 180 + (KT.rnd(i, seed) - .5) * .1 * P.jitter, l = L * (1 + v * 2);
        ctx.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      } else {
        let cxp = x, cyp = y; ctx.moveTo(cxp, cyp);
        for (let k = 0; k < 26; k++){
          const e = 1.5, gx = val(cxp + e, cyp) - val(cxp - e, cyp), gy = val(cxp, cyp + e) - val(cxp, cyp - e);
          const gl = Math.hypot(gx, gy) || 1e-4;
          cxp += -gy / gl * L * .6 + (KT.rnd(i * 5 + k, seed) - .5) * P.jitter;
          cyp += gx / gl * L * .6 + (KT.rnd(i * 5 + k + 3, seed) - .5) * P.jitter;
          if (cxp < 0 || cyp < 0 || cxp > w || cyp > h) break;
          ctx.lineTo(cxp, cyp);
        }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } });
