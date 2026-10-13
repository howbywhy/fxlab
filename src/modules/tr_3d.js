/* ---------------- Transitions: 3d ---------------- */

/* Shared ray-cast kit for the 3D transitions below. Each shader compiles on its own,
   so the GLSL is stamped into every fs with the module's prefix rather than living in
   the prelude.
   World: the frame is the plane z = 0, x in [-aspect, aspect], y in [-1, 1]; the camera
   sits at (0, 0, -F) looking down +z, so a quad lying on the frame plane at rest lands
   exactly on the frame (p = 0 is A, p = 1 is B).
   Canonical transforms (sw = swap x/y, fx, fy = mirror) let one piece of geometry serve
   four directions: rays go in through toC, texture coordinates come back through fromC. */
const tr3d = k => `
struct ${k}Hit { float t; vec2 st; float front; float cov; };
vec3 ${k}ry(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 ${k}rx(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
vec3 ${k}rz(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }
float ${k}focal(float persp){ return mix(9., 1.7, clamp(persp, 0., 1.)); }
vec3 ${k}ray(vec2 uv, float F){ vec2 n = (uv - .5) * 2.; return vec3(n.x * aspect(), n.y, F); }
vec3 ${k}toC(vec3 rd, bool sw, bool fx, bool fy){ if (sw) rd.xy = rd.yx; if (fx) rd.x = -rd.x; if (fy) rd.y = -rd.y; return rd; }
vec2 ${k}fromC(vec2 tc, bool sw, bool fx, bool fy){ if (fy) tc.y = 1. - tc.y; if (fx) tc.x = 1. - tc.x; if (sw) tc = tc.yx; return tc; }
/* ray against the quad c +- u +- v; aa marks which edges (-u, +u, -v, +v) are softened.
   Edges shared with a neighbouring quad stay hard so no background leaks through the seam. */
${k}Hit ${k}quadE(vec3 ro, vec3 rd, vec3 c, vec3 u, vec3 v, vec4 aa){
  ${k}Hit h; h.t = -1.; h.st = vec2(0.); h.front = 1.; h.cov = 0.;
  vec3 n = cross(u, v);
  float dn = dot(rd, n);
  if (abs(dn) < 1e-9) return h;
  float t = dot(c - ro, n) / dn;
  if (t <= 1e-4) return h;
  vec3 q = ro + rd * t - c;
  float s = dot(q, u) / dot(u, u), w = dot(q, v) / dot(v, v);
  float lu = length(u), lv = length(v);
  float px = t * 2. / uRes.y * max(uPx, 1.);
  vec4 d = vec4((1. + s) * lu, (1. - s) * lu, (1. + w) * lv, (1. - w) * lv) / px;
  vec4 lim = mix(vec4(0.), vec4(-.5), aa);
  if (any(lessThan(d, lim))) return h;
  vec4 e = mix(vec4(1e3), d + .5, aa);
  h.cov = clamp(min(min(e.x, e.y), min(e.z, e.w)), 0., 1.);
  h.t = t; h.st = clamp(vec2(s, w) * .5 + .5, 0., 1.); h.front = dn > 0. ? 1. : -1.;
  return h;
}
${k}Hit ${k}quad(vec3 ro, vec3 rd, vec3 c, vec3 u, vec3 v){ return ${k}quadE(ro, rd, c, u, v, vec4(1.)); }
/* paint a hit over what is there if it is nearer */
void ${k}over(inout vec3 col, inout float z, ${k}Hit h, vec3 c){ if (h.t > 0. && h.t < z){ col = mix(col, c, h.cov); z = h.t; } }
/* how directly a quad faces the camera: 1 flat on, 0 edge on */
float ${k}face(vec3 u, vec3 v){ return abs(normalize(cross(u, v)).z); }
`;

/* ---- Card flip ---- */
FX.register({ id:'tr-card-flip', name:'Card flip', cat:'transition', search:['3d', 'flip over', 'turn', 'rotate', 'card'],
  desc:'The whole frame turns over like a card in perspective, with A on the front and B on the back.',
  params:[ S('axis','Turns about',['Upright axis','Level axis'],0), R('persp','Perspective',.45,0,1), R('lift','Lift',.35,0,1), R('shade','Shading',.5,0,1), R('shadow','Shadow',.5,0,1), C('bg','Behind','#0e0f10','ground') ],
  fs: tr3d('cf') + `vec4 fx(vec2 uv){
  float F = cffocal(p_persp);
  vec3 ro = vec3(0., 0., -F), rd = cfray(uv, F);
  float th = uProgress * PI;
  float up = sin(uProgress * PI);
  float zc = p_lift * up * 1.6;
  bool lvl = p_axis > .5;
  vec3 u = vec3(aspect(), 0., 0.), v = vec3(0., 1., 0.);
  if (lvl) v = cfrx(v, -th); else u = cfry(u, th);
  /* the bed: background, with a soft shadow where the lifted card hangs over it */
  vec3 col = p_bg;
  float sz = 1. / (1. + zc / F);
  vec2 cq = centered(uv) - vec2(.03, -.04) * up * p_lift;
  vec2 hb = vec2(aspect() * .5 * (lvl ? 1. : max(abs(cos(th)), .25)), .5 * (lvl ? max(abs(cos(th)), .25) : 1.)) * sz;
  float sd = sdRoundBox(cq, hb, .02);
  col *= 1. - p_shadow * .6 * up * (1. - smoothstep(-.05, .12 + .1 * p_lift, sd));
  float z = 1e9;
  cfHit h = cfquad(ro, rd, vec3(0., 0., zc), u, v);
  if (h.t > 0.){
    vec2 st = h.st;
    vec3 c = h.front > 0. ? texture(uA, st).rgb : texture(uB, lvl ? vec2(st.x, 1. - st.y) : vec2(1. - st.x, st.y)).rgb;
    float f = cfface(u, v);
    c *= 1. - p_shade * .55 * (1. - f);
    c += vec3(pow(1. - f, 4.)) * p_shade * .25;
    cfover(col, z, h, c);
  }
  return vec4(col, 1.);
}` });

/* ---- Doors (covers the doorway variant: B arrives from depth over a glossy floor) ---- */
FX.register({ id:'tr-gate-doors', name:'Doors', cat:'transition', search:['3d', 'doorway', 'gate', 'gate fold', 'open', 'split'],
  desc:'A splits down the middle and swings open away from you like a pair of doors, while B comes forward through the doorway.',
  params:[ S('split','Split',['Vertical','Horizontal'],0), R('depth','B starts back',.45,0,1), R('reflect','Floor reflection',.3,0,1), R('persp','Perspective',.55,0,1), R('shade','Door shading',.55,0,1), C('bg','Behind','#0e0f10','ground') ],
  fs: tr3d('gd') + `vec4 fx(vec2 uv){
  float F = gdfocal(p_persp);
  float p = uProgress;
  vec3 ro = vec3(0., 0., -F), rd = gdray(uv, F);
  float asp = aspect();
  /* B: a flat card that travels forward from depth, standing on the floor y = -1 */
  float zb = p_depth * 5. * (1. - smoothstep(.15, 1., p));
  float fog = clamp(zb / 4., 0., 1.) * .6;
  vec3 col = p_bg; float z = 1e9;
  if (rd.y < 0. && p_reflect > 0.){
    float tf = (-1. - ro.y) / rd.y;
    vec3 P = ro + rd * tf, r2 = rd * vec3(1., -1., 1.);
    gdHit hr = gdquad(P, r2, vec3(0., 0., zb), vec3(asp, 0., 0.), vec3(0., 1., 0.));
    vec3 c = col;
    if (hr.t > 0.) c = mix(col, mix(texture(uB, hr.st).rgb, p_bg, fog), p_reflect * hr.cov * exp(-hr.st.y * 3.5));
    col = c;
  }
  gdHit hb = gdquad(ro, rd, vec3(0., 0., zb), vec3(asp, 0., 0.), vec3(0., 1., 0.));
  if (hb.t > 0.) gdover(col, z, hb, mix(texture(uB, hb.st).rgb, p_bg, fog));
  /* the two doors, built for a vertical split; a horizontal split swaps axes */
  bool sw = p_split > .5;
  vec3 rc = gdtoC(rd, sw, false, false);
  float ex = sw ? 1. : asp, ey = sw ? asp : 1.;
  float th = smoothstep(0., .75, p) * PI * .5;
  vec3 uL = vec3(cos(th), 0., sin(th)) * ex * .5;
  vec3 uR = vec3(cos(th), 0., -sin(th)) * ex * .5;
  vec3 v = vec3(0., ey, 0.);
  /* the inner edges meet at the split, so keep them hard while the doors are shut */
  float inner = step(.002, p);
  gdHit hl = gdquadE(ro, rc, vec3(-ex, 0., 0.) + uL, uL, v, vec4(1., inner, 1., 1.));
  gdHit hr = gdquadE(ro, rc, vec3(ex, 0., 0.) - uR, uR, v, vec4(inner, 1., 1., 1.));
  float f = gdface(uL, v);
  float lit = mix(1., f * f * .9 + .1, p_shade);
  if (hl.t > 0.){
    vec2 tc = gdfromC(vec2(hl.st.x * .5, hl.st.y), sw, false, false);
    vec3 c = texture(uA, tc).rgb * lit * (hl.front > 0. ? 1. : .35);
    gdover(col, z, hl, c);
  }
  if (hr.t > 0.){
    vec2 tc = gdfromC(vec2(.5 + hr.st.x * .5, hr.st.y), sw, false, false);
    vec3 c = texture(uA, tc).rgb * lit * (hr.front > 0. ? 1. : .35);
    gdover(col, z, hr, c);
  }
  return vec4(col, 1.);
}` });

/* ---- Book flip ---- */
FX.register({ id:'tr-book-flip', name:'Book flip', cat:'transition', search:['3d', 'page', 'book', 'spine', 'hinge', 'calendar'],
  desc:'Half of A lifts on a centre spine and turns over like a stiff page, carrying half of B on its back.',
  params:[ S('dir','Turns',['Right to left','Left to right','Bottom to top','Top to bottom'],0), R('persp','Perspective',.5,0,1), R('shade','Page shading',.5,0,1), R('shadow','Spine shadow',.5,0,1) ],
  fs: tr3d('bf') + `vec4 fx(vec2 uv){
  float F = bffocal(p_persp);
  float p = uProgress;
  int dm = int(p_dir + .5);
  bool sw = dm >= 2, fx = dm == 1 || dm == 2, fy = false;
  float asp = aspect();
  float ex = sw ? 1. : asp, ey = sw ? asp : 1.;
  vec3 ro = vec3(0., 0., -F), rd = bftoC(bfray(uv, F), sw, fx, fy);
  float th = p * PI;
  /* the flat spread underneath: A's left half until it is covered, B's right half once uncovered */
  float t0 = F / rd.z;
  vec2 P = (ro + rd * t0).xy;
  vec2 tc0 = vec2(P.x / ex * .5 + .5, P.y / ey * .5 + .5);
  vec3 col = P.x < 0. ? texture(uA, bffromC(tc0, sw, fx, fy)).rgb : texture(uB, bffromC(tc0, sw, fx, fy)).rgb;
  /* the lifted page darkens the spread near the spine on the side it leans over */
  float lean = P.x > 0. ? max(cos(th), 0.) : max(-cos(th), 0.);
  col *= 1. - p_shadow * .55 * sin(th) * (1. - smoothstep(0., ex * (.15 + .85 * lean), abs(P.x)));
  float z = 1e9;
  vec3 u = vec3(cos(th), 0., -sin(th)) * ex * .5, v = vec3(0., ey, 0.);
  bfHit h = bfquadE(ro, rd, u, u, v, vec4(0., 1., 1., 1.));
  if (h.t > 0.){
    vec2 tc = h.front > 0. ? vec2(.5 + h.st.x * .5, h.st.y) : vec2(.5 - h.st.x * .5, h.st.y);
    vec3 c = h.front > 0. ? texture(uA, bffromC(tc, sw, fx, fy)).rgb : texture(uB, bffromC(tc, sw, fx, fy)).rgb;
    float f = bfface(u, v);
    c *= mix(1., .55 + .45 * f, p_shade);
    c *= 1. - p_shade * .25 * (1. - h.st.x) * sin(th);
    bfover(col, z, h, c);
  }
  return vec4(col, 1.);
}` });

/* ---- Swing ---- */
FX.register({ id:'tr-hinge-swing', name:'Swing', cat:'transition', search:['3d', 'fall', 'pivot', 'drape', 'hinge', 'fall over', 'flap'],
  desc:'A swings away on a hinge along one edge until it is edge on, showing B beneath it; drape lets the sheet ripple as it goes.',
  params:[ S('hinge','Hinge',['Top','Bottom','Left','Right'],0), R('drape','Drape',.3,0,1), R('persp','Perspective',.7,0,1), R('shade','Shading',.6,0,1), R('shadow','Shadow on B',.5,0,1) ],
  fs: tr3d('hs') + `vec4 fx(vec2 uv){
  float F = hsfocal(p_persp);
  float p = uProgress;
  int hm = int(p_hinge + .5);
  bool sw = hm >= 2, fx = false, fy = hm == 1 || hm == 2;
  float asp = aspect();
  float ex = sw ? 1. : asp, ey = sw ? asp : 1.;
  vec3 ro = vec3(0., 0., -F), rd = hstoC(hsray(uv, F), sw, fx, fy);
  float t0 = F / rd.z;
  vec2 P = (ro + rd * t0).xy;
  vec2 tc0 = vec2(P.x / ex * .5 + .5, P.y / ey * .5 + .5);
  vec3 col = texture(uB, hsfromC(tc0, sw, fx, fy)).rgb;
  /* the lifting sheet shades B most near the hinge */
  col *= 1. - p_shadow * .6 * sin(p * PI) * smoothstep(-ey, ey, P.y) * (1. - p * .5);
  float z = 1e9;
  /* the sheet is twelve strips hanging from the hinge; the free end lags behind, then catches up */
  const int N = 12;
  float L = 2. * ey / float(N);
  vec3 top = vec3(0., ey, 0.);
  float lag = p_drape * .7;
  for (int i = 0; i < N; i++){
    float a = (float(i) + .5) / float(N);
    float pl = clamp(p * (1. + lag) - lag * a, 0., 1.);
    /* past upright by a fifth so the sheet ends edge on or facing away, never lying across the top */
    float phi = pl * PI * .62 + p_drape * .45 * sin(a * 5. - p * 7.) * sin(p * PI) * a;
    vec3 d = vec3(0., -cos(phi), sin(phi));
    vec3 c = top + d * L * .5, u = vec3(ex, 0., 0.), v = -d * L * .5;
    float last = i == N - 1 ? 1. : 0.;
    hsHit h = hsquadE(ro, rd, c, u, v, vec4(1., 1., last, 0.));
    if (h.front < 0.) h.t = -1.;
    if (h.t > 0.){
      float ty = 1. - (float(i) + 1. - h.st.y) / float(N);
      vec3 s = texture(uA, hsfromC(vec2(h.st.x, ty), sw, fx, fy)).rgb;
      /* shade from the bend at this exact point so the strips don't band */
      float ac = (float(i) + 1. - h.st.y) / float(N);
      float pc = clamp(p * (1. + lag) - lag * ac, 0., 1.);
      float phc = pc * PI * .62 + p_drape * .45 * sin(ac * 5. - p * 7.) * sin(p * PI) * ac;
      float lit = mix(1., pow(max(cos(phc), 0.), 1.2), p_shade);
      s *= h.front > 0. ? lit : .35 * lit;
      hsover(col, z, h, s);
    }
    top += d * L;
  }
  return vec4(col, 1.);
}` });

/* ---- Tilt back (with an optional sheen sweep, the Prestige look) ---- */
FX.register({ id:'tr-tilt-back', name:'Tilt back', cat:'transition', search:['3d', 'prestige', 'tilt', 'perspective', 'lay down', 'sheen', 'fall back'],
  desc:'A tips back on its bottom edge and fades into the dark while B tips up out of it, with an optional sheen passing over both.',
  params:[ S('hinge','Hinge',['Bottom','Top'],0), R('angle','Tilt',62,20,85,1), R('persp','Perspective',.55,0,1), R('sheen','Sheen',.25,0,1), C('glint','Sheen colour','#ffe2a8',false), C('bg','Fog colour','#0e0f10','ground') ],
  fs: tr3d('tb') + `vec4 fx(vec2 uv){
  float F = tbfocal(p_persp);
  float p = uProgress;
  bool fy = p_hinge > .5;
  float asp = aspect();
  vec3 ro = vec3(0., 0., -F), rd = tbtoC(tbray(uv, F), false, false, fy);
  float ang = radians(p_angle);
  float pa = smoothstep(0., .65, p), pb = 1. - smoothstep(.3, 1., p);
  vec3 col = p_bg; float z = 1e9;
  vec3 hinge = vec3(0., -1., 0.), u = vec3(asp, 0., 0.);
  /* A leans away from the camera, B leans towards it and comes upright */
  vec3 dA = vec3(0., cos(pa * ang), sin(pa * ang)), dB = vec3(0., cos(pb * ang * .55), -sin(pb * ang * .55));
  float aA = 1. - smoothstep(.35, .75, p), aB = smoothstep(.25, .6, p);
  tbHit ha = tbquad(ro, rd, hinge + dA, u, dA);
  tbHit hb = tbquad(ro, rd, hinge + dB, u, dB);
  /* the sheen is a soft diagonal band that crosses each sheet while it moves */
  float sweepA = smoothstep(0., .62, p) * 2.6 - .8, sweepB = smoothstep(.38, 1., p) * 2.6 - .8;
  if (ha.t > 0.){
    vec2 tc = tbfromC(ha.st, false, false, fy);
    vec3 c = texture(uA, tc).rgb;
    float band = exp(-pow((ha.st.x * .4 + ha.st.y * .6 - sweepA) * 5., 2.));
    c += p_glint * band * p_sheen * .8 * sin(pa * PI);
    c = mix(c, p_bg, pa * .35);
    ha.cov *= aA;
    tbover(col, z, ha, c);
  }
  if (hb.t > 0. && aB > 0.){
    vec2 tc = tbfromC(hb.st, false, false, fy);
    vec3 c = texture(uB, tc).rgb;
    float band = exp(-pow((hb.st.x * .4 + hb.st.y * .6 - sweepB) * 5., 2.));
    c += p_glint * band * p_sheen * .8 * sin(pb * PI);
    c = mix(c, p_bg, pb * .35);
    /* B is in front of A; blend it over without hiding A where it is still faint */
    col = mix(col, c, hb.cov * aB);
  }
  return vec4(col, 1.);
}` });

/* ---- Revolving door ---- */
FX.register({ id:'tr-revolving-door', name:'Revolving door', cat:'transition', search:['3d', 'rotate', 'switch', 'door', 'turn', 'pivot'],
  desc:'A and B are two wings of a revolving door turning on an upright axis: A swings away into the depth as B swings round into place.',
  params:[ S('side','Axis',['Left','Right','Top','Bottom'],0), R('offset','Axis position',0,0,.5), R('persp','Perspective',.5,0,1), R('shade','Shading',.6,0,1), C('bg','Behind','#0e0f10','ground') ],
  fs: tr3d('rv') + `vec4 fx(vec2 uv){
  float p = uProgress;
  int sm = int(p_side + .5);
  bool sw = sm >= 2, fx = sm == 1 || sm == 2, fy = false;
  float asp = aspect();
  float ex = sw ? 1. : asp, ey = sw ? asp : 1.;
  float o = clamp(p_offset, 0., .5);
  float L1 = 2. * ex * (1. - o), L0 = 2. * ex * o;
  /* keep the camera clear of the wing that swings towards it */
  float F = max(rvfocal(p_persp), L1 + .4);
  vec3 ro = vec3(0., 0., -F), rd = rvtoC(rvray(uv, F), sw, fx, fy);
  vec3 ax = vec3(-ex + L0, 0., 0.);
  float th = p * PI * .5;
  vec3 dA = vec3(cos(th), 0., sin(th)), dB = vec3(sin(th), 0., -cos(th));
  vec3 v = vec3(0., ey, 0.);
  vec3 col = p_bg; float z = 1e9;
  /* four half-wings: A and B each reach both ways from the axis */
  for (int i = 0; i < 4; i++){
    bool isB = i >= 2;
    float sg = (i == 0 || i == 2) ? 1. : -1.;
    float Ln = sg > 0. ? L1 : L0;
    if (Ln < 1e-3) continue;
    vec3 d = (isB ? dB : dA) * sg;
    vec3 u = d * Ln * .5;
    rvHit h = rvquadE(ro, rd, ax + u, u, v, vec4(0., 1., 1., 1.));
    if (h.t > 0.){
      float s = h.st.x * Ln;
      vec2 tc = vec2(o + sg * s / (2. * ex), h.st.y);
      vec3 c = isB ? texture(uB, rvfromC(tc, sw, fx, fy)).rgb : texture(uA, rvfromC(tc, sw, fx, fy)).rgb;
      /* A's short wing ends up pointing at the camera; let it go so the last frame is B */
      if (!isB && sg < 0.) h.cov *= 1. - smoothstep(.65, 1., p);
      /* likewise B's long wing starts out pointing at the camera when the axis sits inside the frame */
      if (isB && sg > 0. && o > 0.) h.cov *= smoothstep(0., .35, p);
      float f = rvface(u, v);
      c *= 1. - p_shade * .7 * (1. - f);
      rvover(col, z, h, c);
    }
  }
  return vec4(col, 1.);
}` });

/* ---- 3D swap ---- */
FX.register({ id:'tr-card-swap', name:'3D swap', cat:'transition', search:['3d', 'swap', 'perspective', 'gallery', 'reflection', 'cards', 'page swing'],
  desc:'A and B stand as cards on a glossy floor: A turns away and slides off to one side as B swings round from the other and comes forward.',
  params:[ S('dir','B comes from',['Right','Left'],0), R('depth','Depth',.6,0,1), R('turn','Turn',45,0,70,1), R('reflect','Floor reflection',.35,0,1), R('persp','Perspective',.55,0,1), C('bg','Behind','#0e0f10','ground') ],
  fs: tr3d('cs') + `
/* card k (0 = A, 1 = B) at progress p: where it stands, how it is turned */
void cscard(float k, float p, float asp, out vec3 c, out vec3 u){
  float s = k < .5 ? p : 1. - p;
  float sg = k < .5 ? -1. : 1.;
  float bump = sin(s * PI);
  float zz = p_depth * 3.5 * (bump * .6 + s * 1.1) + (k < .5 ? step(.5, p) : step(p, .5)) * .05;
  c = vec3(sg * asp * 1.45 * smoothstep(0., 1., s), 0., zz);
  u = csry(vec3(asp, 0., 0.), sg * radians(p_turn) * bump * -1.);
}
vec3 csdraw(vec3 ro, vec3 rd, float p, float asp, vec3 col, out float z){
  z = 1e9;
  vec3 cA, uA2, cB, uB2;
  cscard(0., p, asp, cA, uA2); cscard(1., p, asp, cB, uB2);
  vec3 v = vec3(0., 1., 0.);
  csHit ha = csquad(ro, rd, cA, uA2, v), hb = csquad(ro, rd, cB, uB2, v);
  /* paint the further card first so edges blend over the right thing */
  bool aFirst = ha.t > hb.t;
  for (int j = 0; j < 2; j++){
    bool isA = (j == 0) == aFirst;
    csHit h = hb;
    if (isA) h = ha;
    if (h.t > 0.){
      vec2 tc = csfromC(h.st, false, p_dir > .5, false);
      vec3 c = isA ? texture(uA, tc).rgb : texture(uB, tc).rgb;
      float sh = 1. - .4 * (1. - csface(isA ? uA2 : uB2, v));
      c *= h.front > 0. ? sh : .3;
      if (h.t < z){ col = mix(col, c, h.cov); z = h.t; }
    }
  }
  return col;
}
vec4 fx(vec2 uv){
  float F = csfocal(p_persp);
  float p = uProgress;
  float asp = aspect();
  bool fx = p_dir > .5;
  vec3 ro = vec3(0., 0., -F), rd = cstoC(csray(uv, F), false, fx, false);
  vec3 col = p_bg; float z;
  float zf = 1e9;
  if (rd.y < 0. && p_reflect > 0.){
    zf = (-1. - ro.y) / rd.y;
    vec3 P = ro + rd * zf; float zr;
    vec3 rc = csdraw(P, rd * vec3(1., -1., 1.), p, asp, p_bg, zr);
    float fade = zr < 1e8 ? exp(-zr * abs(rd.y) * 1.5) : 0.;
    col = mix(p_bg, rc, p_reflect * fade);
  }
  float zc;
  vec3 cc = csdraw(ro, rd, p, asp, col, zc);
  if (zc < zf) col = cc;
  return vec4(col, 1.);
}` });

/* ---- Stereo cards ---- */
FX.register({ id:'tr-stereo-cards', name:'Stereo cards', cat:'transition', search:['view-master', 'reel', 'carousel', 'slide', 'rounded', 'cards'],
  desc:'A shrinks into a rounded card, the next card on the reel turns into place carrying B, and B grows back to fill the frame.',
  params:[ R('size','Card size',.78,.5,.95), R('round','Corner radius',.12,0,.4), R('curve','Reel curve',.55,0,1), R('shadow','Shadow',.5,0,1), C('bg','Behind','#0e0f10','ground') ],
  fs:`
/* one card: rounded rect of half-size h in frame units, rotated about the reel hub */
float stcard(vec2 q, vec2 hb, float r){ return sdRoundBox(q, hb, r); }
vec4 fx(vec2 uv){
  float p = uProgress;
  float asp = aspect();
  vec2 q = centered(uv);
  float k = smoothstep(0., .3, p) * (1. - smoothstep(.7, 1., p));
  if (k <= 0.) return vec4(p < .5 ? texture(uA, uv).rgb : texture(uB, uv).rgb, 1.);
  float sc = mix(1., p_size, k);
  float r = p_round * .5 * k * min(asp, 1.);
  float s = smoothstep(.25, .75, p);
  vec2 hb = vec2(asp, 1.) * .5 * sc;
  /* the reel: cards sit on a wheel whose hub is below the frame; curve 0 is a straight slide */
  float R = mix(40., 1.4, p_curve);
  float gap = .06;
  float step0 = (asp * sc + gap) / R;
  vec2 hub = vec2(0., -R);
  vec3 col = p_bg;
  float px = 1.5 / uRes.y * max(uPx, 1.);
  /* soft shadow first, then each card */
  for (int i = 0; i < 2; i++){
    float ang = (float(i) - s) * step0;
    vec2 lq = rot(ang) * (q - hub) + hub;
    float d = stcard(lq - vec2(.015, -.02) * k, hb, r);
    col *= 1. - p_shadow * .6 * k * (1. - smoothstep(-.02, .06, d));
  }
  for (int i = 0; i < 2; i++){
    float ang = (float(i) - s) * step0;
    vec2 lq = rot(ang) * (q - hub) + hub;
    float d = stcard(lq, hb, r);
    vec2 tuv = lq / (vec2(asp, 1.) * sc) + .5;
    vec3 c = i == 0 ? texture(uA, clamp(tuv, 0., 1.)).rgb : texture(uB, clamp(tuv, 0., 1.)).rgb;
    col = mix(col, c, 1. - smoothstep(-px, px, d));
  }
  return vec4(col, 1.);
}` });

/* ---- Conveyor ---- */
FX.register({ id:'tr-conveyor', name:'Conveyor', cat:'transition', search:['3d', 'gallery', 'clothesline', 'rail', 'cards', 'reflection', 'pan'],
  desc:'A steps back onto a rail as a card, the rail carries it off while B comes along behind it, and B steps forward to fill the frame.',
  params:[ S('dir','Travels',['Right to left','Left to right'],0), R('depth','Step back',.45,.1,1), R('angle','Rail angle',22,-40,40,1), R('swing','Swing',.35,0,1), R('reflect','Floor reflection',.3,0,1), R('persp','Perspective',.5,0,1), C('bg','Behind','#0e0f10','ground') ],
  fs: tr3d('cv') + `
vec3 cvdraw(vec3 ro, vec3 rd, float p, float asp, vec3 col, out float z){
  z = 1e9;
  float k = smoothstep(0., .28, p) * (1. - smoothstep(.72, 1., p));
  float s = smoothstep(.22, .78, p);
  float ang = radians(p_angle) * k;
  vec3 rail = vec3(cos(ang), 0., sin(ang));
  vec3 base = vec3(0., 0., p_depth * 3.5 * k);
  float spacing = asp * 2.25;
  /* the cards hang from a point above their centre and lag behind the rail's acceleration */
  float sw = p_swing * .28 * sin(s * TAU) * k;
  vec3 v0 = vec3(0., 1., 0.);
  for (int i = 0; i < 2; i++){
    float off = (float(i) - s) * spacing;
    vec3 c = base + rail * off;
    vec3 u = cvry(vec3(asp, 0., 0.), -ang);
    vec3 pivot = c + vec3(0., 1., 0.);
    vec3 uu = cvrz(u, sw), vv = cvrz(v0, sw);
    vec3 cc = pivot + cvrz(vec3(0., -1., 0.), sw);
    cvHit h = cvquad(ro, rd, cc, uu, vv);
    if (h.t > 0.){
      vec2 tc = cvfromC(h.st, false, p_dir > .5, false);
      vec3 t = i == 0 ? texture(uA, tc).rgb : texture(uB, tc).rgb;
      t *= h.front > 0. ? 1. - .35 * (1. - cvface(uu, vv)) : .3;
      cvover(col, z, h, t);
    }
  }
  return col;
}
vec4 fx(vec2 uv){
  float F = cvfocal(p_persp);
  float p = uProgress;
  float asp = aspect();
  vec3 ro = vec3(0., 0., -F), rd = cvtoC(cvray(uv, F), false, p_dir > .5, false);
  vec3 col = p_bg; float zf = 1e9;
  if (rd.y < 0. && p_reflect > 0.){
    zf = (-1. - ro.y) / rd.y;
    float zr;
    vec3 rc = cvdraw(ro + rd * zf, rd * vec3(1., -1., 1.), p, asp, p_bg, zr);
    float fade = zr < 1e8 ? exp(-zr * abs(rd.y) * 1.5) : 0.;
    col = mix(p_bg, rc, p_reflect * fade);
  }
  float zc;
  vec3 cc = cvdraw(ro, rd, p, asp, col, zc);
  if (zc < zf) col = cc;
  return vec4(col, 1.);
}` });

/* ---- Orbit ---- */
FX.register({ id:'tr-orbit', name:'Orbit', cat:'transition', search:['3d', 'carousel', 'ferris wheel', 'ring', 'rotate', 'box', 'cards'],
  desc:'A and B ride a ring that turns in depth, so A travels round and away while B comes round to the front.',
  params:[ S('path','Ring',['Carousel','Ferris wheel'],0), S('facing','Cards face',['The camera','Outwards'],1), R('spread','Spacing',75,40,180,1), R('persp','Perspective',.5,0,1), R('shade','Shading',.5,0,1), C('bg','Behind','#0e0f10','ground') ],
  fs: tr3d('ob') + `vec4 fx(vec2 uv){
  float F = obfocal(p_persp);
  float p = uProgress;
  float asp = aspect();
  bool fer = p_path > .5;
  vec3 ro = vec3(0., 0., -F), rd = obray(uv, F);
  /* swap axes for the ferris wheel so one ring serves both */
  if (fer) rd.xy = rd.yx;
  float ex = fer ? 1. : asp, ey = fer ? asp : 1.;
  float D = radians(p_spread);
  /* ring radius: neighbouring cards clear each other with a little room */
  float R = max(ex * 1.04 / sin(min(D, PI * .9) * .5), ex * 1.2);
  vec3 ctr = vec3(0., 0., R);
  vec3 col = p_bg; float z = 1e9;
  obHit hs[2];
  vec3 us[2];
  for (int i = 0; i < 2; i++){
    float ph = (float(i) - p) * D;
    vec3 c = ctr + vec3(R * sin(ph), 0., -R * cos(ph));
    vec3 u = vec3(ex, 0., 0.);
    if (p_facing > .5) u = obry(u, -ph);
    us[i] = u;
    hs[i] = obquad(ro, rd, c, u, vec3(0., ey, 0.));
  }
  int first = hs[0].t > hs[1].t ? 0 : 1;
  for (int j = 0; j < 2; j++){
    int i = j == 0 ? first : 1 - first;
    obHit h = hs[i];
    if (h.t > 0.){
      vec2 tc = fer ? h.st.yx : h.st;
      vec3 c = i == 0 ? texture(uA, tc).rgb : texture(uB, tc).rgb;
      float f = obface(us[i], vec3(0., ey, 0.));
      c *= mix(1., .35 + .65 * f, p_shade) * (h.front > 0. ? 1. : .3);
      /* cards further round the ring sink into the background */
      float far = clamp((h.t * F - F) / (R * 2.), 0., 1.);
      c = mix(c, p_bg, far * p_shade * .6);
      obover(col, z, h, c);
    }
  }
  return vec4(col, 1.);
}` });

/* ---- Origami ---- */
FX.register({ id:'tr-origami', name:'Origami', cat:'transition', search:['3d', 'fold', 'paper', 'airplane', 'fold up', 'crease'],
  desc:'A is folded in half, then in half again, like a sheet of paper, and the folded square flies off to leave B.',
  params:[ S('dir','First fold',['Right over left','Left over right'],0), C('paper','Paper','#e9e4d8',false), R('show','Show-through',.6,0,1), R('persp','Perspective',.55,0,1), R('shade','Fold shading',.55,0,1) ],
  fs: tr3d('og') + `
/* the back of the sheet: paper, with a little of the print showing through */
vec3 ogback(vec2 sheet, bool fx){
  vec3 a = texture(uA, ogfromC(sheet, false, fx, false)).rgb;
  return p_paper * mix(1., .55 + .45 * luma(a), p_show);
}
vec4 fx(vec2 uv){
  float F = ogfocal(p_persp);
  float p = uProgress;
  float asp = aspect();
  bool fx = p_dir > .5;
  vec3 ro = vec3(0., 0., -F), rd = ogtoC(ogray(uv, F), false, fx, false);
  float ex = asp, ey = 1.;
  float f1 = smoothstep(0., .34, p), f2 = smoothstep(.33, .64, p), f3 = smoothstep(.62, 1., p);
  /* B lies flat underneath everything */
  float t0 = F / rd.z;
  vec2 P = (ro + rd * t0).xy;
  vec3 col = texture(uB, ogfromC(vec2(P.x / ex, P.y / ey) * .5 + .5, false, fx, false)).rgb;
  /* the folded paper lifts slightly off B and shades it */
  vec2 hs = f2 <= 0. ? vec2(ex * .5, ey) : vec2(ex * .5, ey * .5);
  vec2 hc = f2 <= 0. ? vec2(-ex * .5, 0.) : vec2(-ex * .5, ey * .5);
  float sdp = sdRoundBox(P - hc - vec2(.03, -.04), hs, .01);
  col *= 1. - p_shade * .5 * smoothstep(0., .15, p) * (1. - f3) * (1. - smoothstep(-.04, .12, sdp));
  float z = 1e9;
  vec3 X = vec3(1., 0., 0.), Y = vec3(0., 1., 0.);
  if (f2 <= 0.){
    /* first fold: the right half swings over the left about the centre line */
    float th = f1 * PI;
    ogHit h0 = ogquadE(ro, rd, vec3(-ex * .5, 0., 0.), X * ex * .5, Y * ey, vec4(1., f1 > 0. ? 1. : 0., 1., 1.));
    if (h0.t > 0.) ogover(col, z, h0, texture(uA, ogfromC(vec2(h0.st.x * .5, h0.st.y), false, fx, false)).rgb);
    vec3 d = vec3(cos(th), 0., -sin(th));
    vec3 u = d * ex * .5;
    ogHit h1 = ogquadE(ro, rd, u, u, Y * ey, vec4(f1 > 0. ? 1. : 0., 1., 1., 1.));
    if (h1.t > 0.){
      vec2 sh = vec2(.5 + h1.st.x * .5, h1.st.y);
      vec3 c = h1.front > 0. ? texture(uA, ogfromC(sh, false, fx, false)).rgb : ogback(sh, fx);
      c *= mix(1., .45 + .55 * ogface(u, Y), p_shade);
      ogover(col, z, h1, c);
    }
    /* the fold casts a soft shadow onto the half it is about to cover */
    col *= 1. - p_shade * .35 * sin(th) * step(P.x, 0.) * step(z, 1e8) * smoothstep(-ex, 0., P.x * cos(th));
  } else if (f3 <= 0.){
    /* second fold: the bottom of the folded half comes up over the top */
    float th = f2 * PI;
    ogHit h2 = ogquadE(ro, rd, vec3(-ex * .5, ey * .5, -.003), X * ex * .5, Y * ey * .5, vec4(1., 1., f2 > 0. ? 1. : 0., 1.));
    if (h2.t > 0.) ogover(col, z, h2, ogback(vec2(1. - h2.st.x * .5, .5 + h2.st.y * .5), fx));
    vec3 d = vec3(0., -cos(th), -sin(th));
    vec3 v = -d * ey * .5;
    ogHit h3 = ogquadE(ro, rd, vec3(-ex * .5, 0., -.004) - v, X * ex * .5, v, vec4(1., 1., 1., 1.));
    if (h3.t > 0.){
      vec2 sh = h3.front > 0. ? vec2(1. - h3.st.x * .5, h3.st.y * .5) : vec2(h3.st.x * .5, h3.st.y * .5);
      vec3 c = ogback(sh, fx) * mix(1., .45 + .55 * ogface(X, v), p_shade);
      ogover(col, z, h3, c);
    }
  } else {
    /* the folded square lifts, banks and flies off up and away */
    float e = f3 * f3;
    vec3 c0 = vec3(-ex * .5, ey * .5, -.004) + vec3(ex * 2.4, ey * 1.8, 2.5) * e;
    float roll = e * 1.1, pitch = f3 * 1.2;
    vec3 u = ogrx(ogrz(X * ex * .5, roll), pitch), v = ogrx(ogrz(-Y * ey * .5, roll), pitch);
    ogHit h4 = ogquad(ro, rd, c0, u, v);
    if (h4.t > 0.){
      vec3 c = h4.front > 0. ? ogback(vec2(h4.st.x * .5, (1. - h4.st.y) * .5), fx) : texture(uA, ogfromC(vec2(h4.st.x * .5, .5 + h4.st.y * .5), false, fx, false)).rgb;
      c *= mix(1., .5 + .5 * ogface(u, v), p_shade);
      ogover(col, z, h4, c);
    }
  }
  return vec4(col, 1.);
}` });

/* ---- Fan fold ---- */
FX.register({ id:'tr-fan-fold', name:'Fan fold', cat:'transition', search:['3d', 'accordion', 'fold', 'pleat', 'concertina', 'zigzag'],
  desc:'A pleats into a row of hinged panels that fold up like a fan and collapse against one edge, uncovering B.',
  params:[ I('panels','Panels',6,2,14), S('dir','Collapses to',['Left','Right','Top','Bottom'],0), R('persp','Perspective',.55,0,1), R('shade','Fold shading',.6,0,1) ],
  fs: tr3d('ff') + `vec4 fx(vec2 uv){
  float F = fffocal(p_persp);
  float p = uProgress;
  int dm = int(p_dir + .5);
  bool sw = dm >= 2, fx = dm == 1, fy = false;
  if (dm == 3) fx = true;
  float asp = aspect();
  float ex = sw ? 1. : asp, ey = sw ? asp : 1.;
  vec3 ro = vec3(0., 0., -F), rd = fftoC(ffray(uv, F), sw, fx, fy);
  vec3 col = texture(uB, uv).rgb;
  float z = 1e9;
  float N = max(p_panels, 1.);
  float w = 2. * ex / N;
  float th = p * PI * .5;
  /* light from the left, so alternate pleats catch it and turn away from it */
  vec3 Ld = normalize(vec3(-.6, .25, -1.));
  for (int i = 0; i < 14; i++){
    if (float(i) >= N) break;
    float x0 = -ex + float(i) * w * cos(th);
    bool even = (i / 2) * 2 == i;
    float z0 = even ? 0. : -w * sin(th), z1 = even ? -w * sin(th) : 0.;
    vec3 P0 = vec3(x0, 0., z0), P1 = vec3(x0 + w * cos(th), 0., z1);
    vec3 u = (P1 - P0) * .5, v = vec3(0., ey, 0.);
    ffHit h = ffquadE(ro, rd, (P0 + P1) * .5, u, v, vec4(i == 0 ? 1. : 0., float(i) >= N - 1. ? 1. : 0., 1., 1.));
    if (h.t > 0.){
      vec2 tc = vec2((float(i) + h.st.x) / N, h.st.y);
      vec3 c = texture(uA, fffromC(tc, sw, fx, fy)).rgb;
      vec3 n = normalize(cross(u, v));
      float lam = .5 + .5 * dot(-n, Ld);
      c *= mix(1., lam * 1.25, p_shade * sin(th) * 1.2);
      ffover(col, z, h, clamp(c, 0., 1.));
    }
  }
  return vec4(col, 1.);
}` });

/* ---- Ribbon twist ---- */
FX.register({ id:'tr-ribbon-twist', name:'Ribbon twist', cat:'transition', search:['3d', 'twist', 'flip', 'ribbon', 'slats', 'twirl'],
  desc:'The frame turns over in a twisting ribbon that runs across it, A on one side and B on the other, either smooth or in slats.',
  params:[ S('axis','Runs',['Left to right','Bottom to top'],0), I('slats','Slats',0,0,40), R('stagger','Twist length',.6,0,.95), R('persp','Perspective',.5,0,1), R('shade','Shading',.55,0,1), C('bg','Behind','#0e0f10','ground') ],
  fs:`vec4 fx(vec2 uv){
  float F = mix(9., 1.7, p_persp);
  bool vert = p_axis > .5;
  vec2 c = (uv - .5) * 2. * vec2(aspect(), 1.);
  /* canonical: twist travels along x, each column turns about the horizontal centre line */
  float ey = vert ? aspect() : 1.;
  vec2 q = vert ? c.yx : c;
  float along = vert ? uv.y : uv.x;
  if (p_slats > .5) along = (floor(along * p_slats) + .5) / p_slats;
  float st = clamp(p_stagger, 0., .95);
  float lp = clamp((uProgress - along * st) / (1. - st), 0., 1.);
  float th = lp * PI;
  float cs = cos(th), sn = sin(th);
  /* invert the perspective of a line through the centre turned by th */
  float den = F * cs - q.y * sn;
  vec3 col = p_bg;
  if (abs(den) > 1e-4){
    float yl = q.y * F / den;
    if (abs(yl) <= ey){
      /* yl is the coordinate across the turning line, measured on the ribbon itself */
      vec2 fa = vert ? vec2(yl / ey, c.y) : vec2(c.x / aspect(), yl);
      vec2 fb = vert ? vec2(-yl / ey, c.y) : vec2(c.x / aspect(), -yl);
      vec3 s = cs > 0. ? texture(uA, fa * .5 + .5).rgb : texture(uB, fb * .5 + .5).rgb;
      float f = abs(cs);
      s *= mix(1., .3 + .7 * f, p_shade);
      s += vec3(pow(1. - f, 6.)) * p_shade * .35;
      float px = 2. / uRes.y * max(uPx, 1.);
      col = mix(p_bg, s, clamp((ey - abs(yl)) * abs(den) / F / px + .5, 0., 1.));
    }
  }
  return vec4(col, 1.);
}` });

/* ---- Clone spin ---- */
FX.register({ id:'tr-clone-spin', name:'Clone spin', cat:'transition', search:['replicator', 'clones', 'tiles', 'spin', 'grid', 'copies'],
  desc:'A pulls back into a grid of small copies that spin on the spot, turn into copies of B, and gather back into one frame.',
  params:[ I('copies','Copies across',3,2,7), R('spin','Spin',1,0,3), T('alt','Alternate direction',true), R('gap','Gap',.12,0,.4), C('bg','Behind','#0e0f10','ground') ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float asp = aspect();
  float N = max(p_copies, 1.);
  float k = smoothstep(0., .4, p) * (1. - smoothstep(.6, 1., p));
  float zoom = mix(1., N, k);
  vec2 g = (uv - .5) * zoom + .5;
  vec2 cell = floor(g), f = fract(g);
  /* stagger each copy a little so the swap ripples across the grid */
  float h = hash12(cell + 7.);
  float swapAt = .5 + (h - .5) * .16 * k;
  float dirn = (p_alt > .5 && mod(cell.x + cell.y, 2.) > .5) ? -1. : 1.;
  float a = dirn * p_spin * TAU * smoothstep(.12, .88, p);
  float cs = abs(cos(a)), sn = abs(sin(a));
  /* shrink the turning copy so its corners stay inside its own cell */
  float fit = min(asp / (asp * cs + sn), 1. / (asp * sn + cs));
  float sc = fit * (1. - p_gap * k);
  vec2 q = (f - .5) * vec2(asp, 1.);
  q = rot(a) * q / sc;
  vec2 tuv = q / vec2(asp, 1.) + .5;
  float px = zoom / uRes.y * max(uPx, 1.) / sc;
  vec2 dd = (.5 - abs(tuv - .5)) * vec2(asp, 1.);
  float inside = clamp(min(dd.x, dd.y) / px + .5, 0., 1.);
  vec3 c = p < swapAt ? texture(uA, clamp(tuv, 0., 1.)).rgb : texture(uB, clamp(tuv, 0., 1.)).rgb;
  return vec4(mix(p_bg, c, inside), 1.);
}` });

/* ---- Cube grid ---- */
FX.register({ id:'tr-cube-grid', name:'Cube grid', cat:'transition', search:['3d', 'object cube', 'cubes', 'tiles', 'box', 'rotate'],
  desc:'The frame is a wall of small cubes; each one turns a quarter to bring a face of B round, in a wave across the grid.',
  params:[ I('rows','Rows',4,1,16), S('order','Order',['Diagonal','Left to right','Centre out','Random'],0), S('dir','Turns towards',['Left','Right','Up','Down'],0), R('stagger','Stagger',.6,0,.95), R('shade','Shading',.5,0,1), C('bg','Gaps','#0e0f10','ground') ],
  fs: tr3d('cg') + `vec4 fx(vec2 uv){
  float asp = aspect();
  vec2 grid = vec2(max(1., floor(p_rows * asp + .5)), max(p_rows, 1.));
  vec2 id = floor(uv * grid), f = fract(uv * grid);
  vec2 idn = (id + .5) / grid;
  int om = int(p_order + .5);
  float o = om == 0 ? idn.x * .5 + (1. - idn.y) * .5 : om == 1 ? idn.x : om == 2 ? length((idn - .5) * vec2(asp, 1.)) * 1.3 : hash12(id + 3.);
  float st = clamp(p_stagger, 0., .95);
  float lp = clamp((uProgress - o * st) / (1. - st), 0., 1.);
  lp = lp * lp * (3. - 2. * lp);
  float th = lp * PI * .5;
  /* each cell is its own small view of one cube */
  int dm = int(p_dir + .5);
  bool sw = dm >= 2, fx = dm == 1 || dm == 2, fy = false;
  float ta = asp * grid.y / grid.x;
  float ex = sw ? 1. : ta, ey = sw ? ta : 1.;
  float F = 3.2;
  vec2 n = (f - .5) * 2.;
  vec3 ro = vec3(0., 0., -F), rd = cgtoC(vec3(n.x * ta, n.y, F), sw, fx, fy);
  /* the cube pulls in slightly mid-turn so its corners stay inside the cell */
  float k = 1. - .2 * sin(th * 2.);
  vec3 C = vec3(0., 0., ex) * k;
  vec3 col = p_bg; float z = 1e9;
  vec3 v = vec3(0., ey, 0.) * k;
  vec3 uA2 = cgry(vec3(ex, 0., 0.), th) * k, cA = C + cgry(vec3(0., 0., -ex), th) * k;
  vec3 uB2 = cgry(vec3(0., 0., ex), th) * k, cB = C + cgry(vec3(ex, 0., 0.), th) * k;
  cgHit ha = cgquadE(ro, rd, cA, uA2, v, vec4(1., th > 0. ? 0. : 1., 0., 0.));
  cgHit hb = cgquadE(ro, rd, cB, uB2, v, vec4(0., 1., 0., 0.));
  float lit = p_shade * .6;
  if (ha.t > 0. && ha.front > 0.){
    vec2 tl = cgfromC(ha.st, sw, fx, fy);
    cgover(col, z, ha, texture(uA, (id + tl) / grid).rgb * (1. - lit * (1. - cgface(uA2, v))));
  }
  if (hb.t > 0. && hb.front > 0.){
    vec2 tl = cgfromC(hb.st, sw, fx, fy);
    cgover(col, z, hb, texture(uB, (id + tl) / grid).rgb * (1. - lit * (1. - cgface(uB2, v))));
  }
  return vec4(col, 1.);
}` });

/* ---- Corner roll ---- */
FX.register({ id:'tr-corner-roll', name:'Corner roll', cat:'transition', search:['rotate', 'swing', 'pivot', 'roll', 'corner'],
  desc:'A swings out of the frame on a pivot at one corner, like a door turning flat on the wall, and B is there behind it.',
  params:[ S('corner','Pivot',['Bottom left','Bottom right','Top left','Top right'],0), S('turn','Swings',['Downwards','Upwards'],0), R('blur','Motion blur',.35,0,1), R('shadow','Shadow',.5,0,1) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float asp = aspect();
  int cm = int(p_corner + .5);
  vec2 piv = vec2((cm == 0 || cm == 2) ? -asp * .5 : asp * .5, cm < 2 ? -.5 : .5);
  /* the turn that takes the frame out of view past the pivot, signed by corner and choice */
  float sx = piv.x < 0. ? 1. : -1., sy = piv.y < 0. ? 1. : -1.;
  float sg = (p_turn < .5 ? -1. : 1.) * sx * sy;
  vec2 q = centered(uv);
  vec3 B = texture(uB, uv).rgb;
  /* the shadow of A on B, offset and soft */
  vec2 qs = rot(-sg * p * PI * .5) * (q - piv - vec2(.025, -.035) * sin(p * PI)) + piv;
  float dsh = sdRoundBox(qs, vec2(asp, 1.) * .5, 0.);
  vec3 col = B * (1. - p_shadow * .55 * sin(p * PI) * (1. - smoothstep(-.03, .09, dsh)));
  /* A, averaged over a short arc of its own turn for motion blur */
  vec3 acc = vec3(0.); float cov = 0.;
  float spread = p_blur * .12 * sin(p * PI);
  for (int i = 0; i < 9; i++){
    float a = sg * (p + (float(i) / 8. - .5) * spread) * PI * .5;
    vec2 l = rot(a) * (q - piv) + piv;
    vec2 t = l / vec2(asp, 1.) + .5;
    vec2 dd = (.5 - abs(t - .5)) * vec2(asp, 1.);
    float m = clamp(min(dd.x, dd.y) * uRes.y / max(uPx, 1.) + .5, 0., 1.);
    acc += texture(uA, clamp(t, 0., 1.)).rgb * m; cov += m;
  }
  cov /= 9.;
  col = col * (1. - cov) + acc / 9.;
  return vec4(col, 1.);
}` });

/* ---- Reflection floor ---- */
FX.register({ id:'tr-reflection-floor', name:'Reflection floor', cat:'transition', search:['3d', 'reflection', 'mirror', 'floor', 'stage', 'sink', 'rise'],
  desc:'A steps back onto a glossy floor and sinks through it while B rises up out of the floor in its place, then steps forward.',
  params:[ R('depth','Step back',.5,.1,1), R('reflect','Reflection',.4,0,1), R('blur','Floor blur',.3,0,1), R('persp','Perspective',.5,0,1), C('bg','Floor and wall','#0e0f10','ground') ],
  fs: tr3d('rf') + `
vec3 rfdraw(vec3 ro, vec3 rd, float p, float asp, vec3 col, out float z){
  z = 1e9;
  float k = smoothstep(0., .3, p) * (1. - smoothstep(.7, 1., p));
  float s = smoothstep(.25, .75, p);
  vec3 base = vec3(0., 0., p_depth * 3. * k);
  float yA = -2.05 * smoothstep(0., .6, s), yB = -2.05 * (1. - smoothstep(.2, .85, s));
  vec3 u = vec3(asp, 0., 0.), v = vec3(0., 1., 0.);
  /* B rises a step behind A, like a second stage lift, and both come forward together at the end */
  rfHit ha = rfquad(ro, rd, base + vec3(0., yA, 0.), u, v);
  rfHit hb = rfquad(ro, rd, base + vec3(0., yB, .9 * k), u, v);
  if (ha.t > 0. && ha.t * rd.y + ro.y > -1.) rfover(col, z, ha, texture(uA, ha.st).rgb);
  if (hb.t > 0. && hb.t * rd.y + ro.y > -1.) rfover(col, z, hb, texture(uB, hb.st).rgb);
  return col;
}
vec4 fx(vec2 uv){
  float F = rffocal(p_persp);
  float p = uProgress;
  float asp = aspect();
  vec3 ro = vec3(0., 0., -F), rd = rfray(uv, F);
  vec3 col = p_bg; float z;
  vec3 cc = rfdraw(ro, rd, p, asp, col, z);
  if (rd.y < 0.){
    float zf = (-1. - ro.y) / rd.y;
    if (zf < z){
      /* the floor: a few jittered reflected rays soften the mirror the further it is from the cards */
      vec3 P = ro + rd * zf, acc = vec3(0.);
      for (int i = 0; i < 4; i++){
        vec2 j = (hash22(uv * 731. + float(i)) - .5) * p_blur * .06;
        float zr;
        vec3 r2 = rd * vec3(1., -1., 1.) + vec3(j.x, j.y * .3, 0.) * F;
        acc += rfdraw(P, r2, p, asp, p_bg, zr);
      }
      float fade = exp(-(zf * F - F) * .25);
      cc = mix(p_bg, acc * .25, p_reflect * fade);
    }
  }
  return vec4(cc, 1.);
}` });
