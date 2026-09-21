/* ---------------- Data visuals, second set ----------------
   Denser, more graphic ways to draw a table: ridgelines, spirals, radial
   heat, flow fields, contour maps, constellations, halos, mark fields, packed
   circles, threads, and two that work on the incoming image.
   Same rules as the first set: no axes, no labels, real sample data until you
   load your own, whole cycles of the loop for anything that moves. Every
   layout is a whole-frame layout, so they are marked nonLocal for print.
------------------------------------------------ */
const DV2 = {
  /* a folded 0–1 → 0–1 → 0 wave: lets a plain series close into a ring without a jump */
  tri: u => 1 - Math.abs(2 * (u - Math.floor(u)) - 1),
  ground: () => Sketch.groundParams(1, '#101113'),
  colors: (lo = '#3f74a8') => [ C('c1','Low',lo), C('cm','Middle','#f0e8da'), C('c2','High','#ff5a36','accent'), S('ramp','Ramp',['Two colour','Three colour'],1) ],
  /* one 0–1 sample of a column at position u along the table */
  val: (col, u) => Data.norm(col, Data.at(col, Util.clamp(u))),
  /* the ramp as a 256-step table of [r, g, b] and 'rgb()' strings, cached on its colours */
  lut(P){
    const key = [P.c1, P.cm, P.c2, P.ramp].join('|');
    if (DV2._lutKey === key) return DV2._lut;
    const A = Util.hexToRgb(P.c1), M = Util.hexToRgb(P.cm), B = Util.hexToRgb(P.c2), out = { rgb:[], css:[] };
    for (let i = 0; i < 256; i++){
      const t = i / 255; let a = A, b = B, k = t;
      if (P.ramp === 1){ if (t < .5){ a = A; b = M; k = t * 2; } else { a = M; b = B; k = t * 2 - 1; } }
      const c = [0, 1, 2].map(j => Math.round(a[j] + (b[j] - a[j]) * k));
      out.rgb.push(c); out.css.push(`rgb(${c[0]},${c[1]},${c[2]})`);
    }
    DV2._lutKey = key; DV2._lut = out; return out;
  },
  ramp(P, t){ return DV2.lut(P).css[Math.round(Util.clamp(t) * 255)]; },
  /* the playhead's position along the table, or 1 when following is off */
  u: (P, api) => P.follow ? Data.u(api) : 1,
  /* rows picked evenly, at most n of them */
  pickRows(t, n){
    const N = Math.max(1, Math.min(t.rows, n)), out = new Array(N);
    for (let i = 0; i < N; i++) out[i] = N > 1 ? Math.round(i * (t.rows - 1) / (N - 1)) : 0;
    return out;
  },
  /* two columns for a scatter: the chosen ones, or longitude and latitude when nothing is chosen and the table has them */
  xy(P, t){
    const geo = !P.x && !P.y ? Data.geo(t) : null;
    return geo ? { cx:geo.x, cy:geo.y, geo:true } : { cx:Data.pick(P.x, 0, 'number', t), cy:Data.pick(P.y, 1, 'number', t), geo:false };
  },
  /* each row's rank in a column, 0–1: flattens a lopsided column so its threads fill the height (cached per column) */
  rank(col){
    if (col._rank && col._rankFor === col.v) return col._rank;
    const n = col.v.length, order = Array.from({ length:n }, (_, i) => i).sort((a, b) => col.v[a] - col.v[b]), r = new Float32Array(n);
    order.forEach((i, k) => { r[i] = n > 1 ? k / (n - 1) : .5; });
    col._rank = r; col._rankFor = col.v; return r;
  },
  /* smooth 2D value noise, seeded */
  noise(x, y, seed){
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const h = (a, b) => Sketch.rnd(a * 57 + b * 131, seed), a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  },
  /* a series resampled to a fixed length, and a reader that interpolates it */
  reader(col, N, smooth){
    const S = DV.series(col, N, smooth);
    return x => { const f = Util.clamp(x) * (N - 1), i = Math.floor(f); return S[i] + (S[Math.min(N - 1, i + 1)] - S[i]) * (f - i); };
  },
};
const dv2Clamp = Util.clamp;

/* ---- ridges: many windows of one column, stacked and hiding each other ---- */
FX.register({ id:'dv-ridges', name:'Data ridges', cat:'data', kind:'2d', nonLocal:true, search:['data', 'ridgeline', 'joy division', 'pulsar', 'unknown pleasures', 'waves', 'lines'],
  desc:'One column sliced into many overlapping windows and stacked as ridgelines, each hiding the ones behind.',
  params:[ Col('a','Column',0), I('ridges','Ridges',46,8,120), R('window','Window',.3,.05,.8), R('height','Height',.2,.03,.6), R('taper','Edge taper',.75,0,1), R('persp','Perspective',.3,0,1),
    R('smooth','Smoothing',.35,0,1), R('weight','Line weight',1.7,.4,6,.1), T('solid','Hide lines behind',true), S('colour','Colour',['Ink','By ridge peak','By ridge position'],1),
    C('ink','Ink','#f4efe6','ink'), R('margin','Margin',.09,0,.3), R('y','Position',0,-.5,.5), T('follow','Rise with the playhead',false), ...DV2.colors('#5f8fc2'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), col = Data.pick(P.a, 0, 'number', t); if (!col) return;
    const b = DV.box(P, w, h), unit = Math.min(w, h) / 1000, u = DV2.u(P, api), K = Math.max(2, P.ridges | 0), M = 160;
    const at = DV2.reader(col, Math.min(1600, Math.max(400, t.rows * 4)), P.smooth);
    const amp = b.h * P.height, top = b.y + amp - P.y * h, span = b.h - amp;
    ctx.lineJoin = ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, P.weight * unit);
    for (let k = 0; k < K; k++){
      const rise = P.follow ? dv2Clamp((u * (K + 10) - k) / 10) : 1; if (rise <= 0) continue;
      const kk = k / (K - 1), y0 = top + span * kk, s0 = (1 - P.window) * kk, sx = 1 - P.persp * (1 - kk) * .45;
      const pts = []; let peak = 0;
      for (let i = 0; i < M; i++){
        const x = i / (M - 1), env = 1 + (Math.pow(Math.sin(Math.PI * x), 1.3) - 1) * P.taper, v = at(s0 + x * P.window) * env;
        peak = Math.max(peak, v);
        pts.push([b.x + b.w * (.5 + (x - .5) * sx), y0 - v * amp * rise * (.5 + .5 * sx)]);
      }
      ctx.beginPath(); DV.trace(ctx, pts);
      if (P.solid){ ctx.lineTo(pts[M - 1][0], h + 4); ctx.lineTo(pts[0][0], h + 4); ctx.closePath(); ctx.fillStyle = P.bg; ctx.fill(); ctx.beginPath(); DV.trace(ctx, pts); }
      ctx.strokeStyle = P.colour === 0 ? P.ink : DV2.ramp(P, P.colour === 1 ? peak : kk);
      ctx.stroke();
    }
  } });

/* ---- spiral: the table wound outwards, a bar per sample ---- */
FX.register({ id:'dv-spiral', name:'Data spiral', cat:'data', kind:'2d', nonLocal:true, search:['data', 'spiral', 'radial', 'time', 'lupi', 'circular'],
  desc:'The table wound onto a spiral, oldest at the centre. Values set the length of each bar or the size of each dot.',
  params:[ Col('a','Column',0), Col('shade','Colour by',0), S('style','Style',['Bars','Ribbon','Dots'],0), R('turns','Turns',7,1,20,.1), I('count','Samples',600,120,1400), R('inner','Inner radius',.07,0,.4), R('reach','Reach',.46,.1,.7),
    R('gap','Gap',.14,0,.8), R('bias','Length range',.9,.1,1), R('gamma','Contrast',1,.3,3), R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1), I('spin','Rotations per loop',0,-4,4),
    T('follow','Wind on with the playhead',false), ...DV2.colors('#4d7fb0'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), col = Data.pick(P.a, 0, 'number', t), cs = Data.pick(P.shade, 0, 'number', t) || col; if (!col) return;
    const R0 = Math.min(w, h), u = DV2.u(P, api), N = P.count | 0, style = P.style | 0, cx = (.5 + P.x * .5) * w, cy = (.5 - P.y * .5) * h;
    const r0 = R0 * P.inner, pitch = (R0 * P.reach - r0) / P.turns, spin = api.loop * Sketch.TAU * (P.spin | 0);
    const shown = P.follow ? Math.max(2, Math.round(N * u)) : N;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(spin - Math.PI / 2);
    const pos = (f, off) => { const a = f * P.turns * Sketch.TAU, r = r0 + f * P.turns * pitch + off; return [Math.cos(a) * r, Math.sin(a) * r]; };
    const val = i => Math.pow(DV2.val(col, (Math.min(N - 1, i) + .5) / N), P.gamma), tone = i => DV2.val(cs, (i + .5) / N), lenOf = v => pitch * P.bias * (.08 + v * .92);
    for (let i = 0; i < shown; i++){
      const v = val(i), f = i / N;
      ctx.fillStyle = ctx.strokeStyle = DV2.ramp(P, Math.pow(tone(i), P.gamma));
      if (style === 0){
        const [x0, y0] = pos(f, 0), [x1, y1] = pos(f, lenOf(v)), arc = (r0 + f * P.turns * pitch) * Sketch.TAU * P.turns / N;
        ctx.lineWidth = Math.max(1, arc * (1 - P.gap)); ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      } else if (style === 1){
        const f2 = (i + 1.2) / N, a = pos(f, 0), c = pos(f, lenOf(v)), a2 = pos(f2, 0), c2 = pos(f2, lenOf(val(i + 1)));
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(a2[0], a2[1]); ctx.closePath(); ctx.fill();
      } else {
        const [x1, y1] = pos(f, pitch * .5 * P.bias + (v - .5) * pitch * .35), rr = Math.max(.8, pitch * (.06 + v * .32) * (1 - P.gap * .5));
        ctx.beginPath(); ctx.arc(x1, y1, rr, 0, Sketch.TAU); ctx.fill();
      }
    }
    ctx.restore();
  } });

/* ---- dial: rings of cells, one ring per wrap of the column ---- */
FX.register({ id:'dv-dial', name:'Data dial', cat:'data', kind:'2d', nonLocal:true, search:['data', 'radial', 'heatmap', 'calendar', 'year', 'circular'],
  desc:'The table wrapped into concentric rings of cells, like a year drawn as a dial. Colour follows the value.',
  params:[ Col('a','Column',0), Col('b','Size column',1), S('style','Style',['Cells','Ticks','Dots'],0), I('rings','Rings (0 fits the table)',0,0,60), I('sectors','Cells per ring',24,6,180), R('inner','Inner radius',.12,0,.4), R('reach','Reach',.46,.1,.7),
    R('gap','Gap',.07,0,.7), R('sizing','Size by second column',0,0,1), R('gamma','Contrast',1,.3,3), R('start','Start angle',0,0,1), S('order','Newest at',['Outside','Inside'],0), I('spin','Rotations per loop',0,-4,4),
    T('follow','Fill in with the playhead',false), ...DV2.colors(), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), col = Data.pick(P.a, 0, 'number', t), c2 = Data.pick(P.b, 1, 'number', t); if (!col) return;
    const R0 = Math.min(w, h), u = DV2.u(P, api), NS = P.sectors | 0, NR = P.rings ? P.rings | 0 : Math.max(1, Math.min(60, Math.ceil(t.rows / NS))), total = P.rings ? NR * NS : t.rows, style = P.style | 0;
    const r0 = R0 * P.inner, rw = (R0 * P.reach - r0) / NR, spin = api.loop * Sketch.TAU * (P.spin | 0), da = Sketch.TAU / NS, g = P.gap * .5;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(spin + P.start * Sketch.TAU - Math.PI / 2);
    for (let r = 0; r < NR; r++){
      const ring = P.order === 1 ? NR - 1 - r : r, rin = r0 + r * rw, rm = rin + rw * .5;
      for (let s = 0; s < NS; s++){
        const n = ring * NS + s; if (n >= total) continue; const f = n / (total - 1 || 1), vis = P.follow ? dv2Clamp((u - f) * 30) : 1; if (vis <= 0) continue;
        const v = Math.pow(DV2.val(col, f), P.gamma), sz = c2 ? 1 - P.sizing + P.sizing * (.2 + .8 * DV2.val(c2, f)) : 1, a0 = s * da, am = a0 + da / 2;
        ctx.globalAlpha = vis; ctx.fillStyle = ctx.strokeStyle = DV2.ramp(P, v);
        if (style === 0){
          const shrink = (1 - sz) * rw * .3, rr0 = rin + rw * g + shrink, rr1 = rin + rw - rw * g - shrink, ag = da * g;
          ctx.beginPath(); ctx.arc(0, 0, rr1, a0 + ag * .5, a0 + da - ag * .5); ctx.arc(0, 0, rr0, a0 + da - ag * .5, a0 + ag * .5, true); ctx.closePath(); ctx.fill();
        } else if (style === 1){
          const ln = rw * (.15 + .85 * v) * .5 * (1 - P.gap * .3);
          ctx.lineWidth = Math.max(1, rm * da * (1 - P.gap) * .6); ctx.lineCap = 'round'; ctx.beginPath();
          ctx.moveTo(Math.cos(am) * (rm - ln), Math.sin(am) * (rm - ln)); ctx.lineTo(Math.cos(am) * (rm + ln), Math.sin(am) * (rm + ln)); ctx.stroke();
        } else {
          const rr = Math.min(rw, rm * da) * .5 * (1 - P.gap) * (.25 + .75 * sz * (.4 + v * .6));
          ctx.beginPath(); ctx.arc(Math.cos(am) * rm, Math.sin(am) * rm, Math.max(.6, rr), 0, Sketch.TAU); ctx.fill();
        }
      }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  } });

/* ---- flow: streamlines through a field the data bends ---- */
FX.register({ id:'dv-flow', name:'Data flow', cat:'data', kind:'2d', nonLocal:true, search:['data', 'flow', 'field', 'streamlines', 'particles', 'wind', 'curl', 'generative'],
  desc:'Thousands of fine lines drift through a field. One column bends it left to right, another top to bottom.',
  params:[ Col('a','Bends across',0), Col('b','Bends down',1), I('lines','Lines',1500,200,4000), I('steps','Length',56,8,160), R('scale','Field scale',1.3,.3,4), R('steer','Data bend',.6,0,1.5), R('twist','Turbulence',.5,0,1), R('smooth','Smoothing',.6,0,1),
    R('motion','Motion',.6,0,2), R('weight','Line weight',1,.3,4,.1), R('opacity','Opacity',.55,.05,1), R('seed','Seed',3,0,50,1), S('colour','Colour',['Ink','By direction','By data'],2), C('ink','Ink','#f4efe6','ink'),
    R('margin','Margin',.04,0,.3), T('follow','Grow with the playhead',false), ...DV2.colors('#4a86c0'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), A = Data.pick(P.a, 0, 'number', t), B = Data.pick(P.b, 1, 'number', t) || A; if (!A) return;
    const b = DV.box(P, w, h), unit = Math.min(w, h) / 1000, u = DV2.u(P, api), seed = P.seed | 0, ph = api.loop * Sketch.TAU, asp = b.w / b.h;
    const GW = 72, GH = 90, vx = new Float32Array(GW * GH), vy = new Float32Array(GW * GH), tone = new Float32Array(GW * GH);
    const ca = Math.cos(ph) * P.motion, sa = Math.sin(ph) * P.motion, av = new Float32Array(GW), bv = new Float32Array(GH);
    const sa_ = DV.series(A, GW, P.smooth), sb_ = DV.series(B, GH, P.smooth);
    for (let i = 0; i < GW; i++) av[i] = sa_[i];
    for (let j = 0; j < GH; j++) bv[j] = sb_[j];
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++){
      const x = i / (GW - 1), y = j / (GH - 1), nx = x * asp * P.scale, ny = y * P.scale;
      const n = DV2.noise(nx + ca, ny + sa, seed) * .65 + DV2.noise(nx * 2.1 - sa, ny * 2.1 + ca, seed + 9) * .35;
      const th = (av[i] - .5) * P.steer * Math.PI * 1.7 + (bv[j] - .5) * P.steer * Math.PI * 1.7 + (n - .5) * P.twist * Math.PI * 4;
      vx[j * GW + i] = Math.cos(th); vy[j * GW + i] = Math.sin(th); tone[j * GW + i] = (av[i] + bv[j]) / 2;
    }
    const look = (a, x, y) => {
      const fx = x * (GW - 1), fy = y * (GH - 1), i = Math.min(GW - 2, Math.floor(fx)), j = Math.min(GH - 2, Math.floor(fy)), tx = fx - i, ty = fy - j, k = j * GW + i;
      return (a[k] * (1 - tx) + a[k + 1] * tx) * (1 - ty) + (a[k + GW] * (1 - tx) + a[k + GW + 1] * tx) * ty;
    };
    const NB = 14, paths = Array.from({ length:NB }, () => new Path2D()), L = P.lines | 0, steps = Math.max(2, Math.round((P.steps | 0) * (P.follow ? Math.max(.05, u) : 1)));
    const ds = .0055, cols = Math.max(1, Math.ceil(Math.sqrt(L * asp))), rows = Math.ceil(L / cols);
    for (let n = 0; n < L; n++){
      const gi = n % cols, gj = Math.floor(n / cols);
      let x = (gi + .1 + Sketch.rnd(n, seed + 1) * .8) / cols, y = (gj + .1 + Sketch.rnd(n, seed + 2) * .8) / rows;
      const bucket = P.colour === 0 ? 0 : Math.min(NB - 1, Math.floor((P.colour === 1 ? Math.atan2(look(vy, x, y), look(vx, x, y)) / Math.PI * .5 + .5 : look(tone, x, y)) * NB));
      const path = paths[bucket]; path.moveTo(b.x + x * b.w, b.y + y * b.h);
      for (let s = 0; s < steps; s++){
        const dx = look(vx, x, y), dy = look(vy, x, y), m = Math.hypot(dx, dy) || 1;
        x += dx / m * ds / asp; y += dy / m * ds;
        if (x < 0 || x > 1 || y < 0 || y > 1) break;
        path.lineTo(b.x + x * b.w, b.y + y * b.h);
      }
    }
    ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(.6, P.weight * unit); ctx.globalAlpha = P.opacity;
    paths.forEach((p, k) => { ctx.strokeStyle = P.colour === 0 ? P.ink : DV2.ramp(P, k / (NB - 1)); ctx.stroke(p); });
    ctx.globalAlpha = 1;
  } });

/* ---- terrain: the table as a height map, drawn as contours ---- */
let dv2Cv = null;
FX.register({ id:'dv-terrain', name:'Data terrain', cat:'data', kind:'2d', nonLocal:true, search:['data', 'contours', 'map', 'topographic', 'density', 'relief', 'isolines'],
  desc:'Rows piled up into a height map and drawn as contour lines. Quake positions make a density map; other tables become relief.',
  params:[ S('source','Source',['Automatic','Points','Table as relief'],0), Col('x','X column',0), Col('y','Y column',1), Col('size','Weight column',2), I('levels','Contours',16,4,40), R('spread','Point spread',.7,.1,1.5), R('smooth','Smoothing',.7,0,1),
    R('weight','Line weight',1.2,.4,4,.1), R('fill','Fill',.25,0,1), R('gamma','Contrast',.75,.3,2), T('index','Heavier every fifth line',true), R('margin','Margin',.06,0,.3), T('follow','Build up with the playhead',false), ...DV2.colors('#2f5f8f'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), b = DV.box(P, w, h), unit = Math.min(w, h) / 1000, u = DV2.u(P, api);
    const GW = dv2Clamp(Math.round(b.w / 9), 40, 130), GH = dv2Clamp(Math.round(b.h / 9), 40, 160), g = new Float32Array(GW * GH);
    const { cx, cy, geo } = DV2.xy(P, t), cw = Data.pick(P.size, 2, 'number', t);
    const mode = P.source | 0, points = mode === 1 || (mode === 0 && geo);
    if (points){
      if (!cx || !cy) return;
      const idx = DV2.pickRows(t, 1600), rk = Math.max(2, Math.round(Math.min(GW, GH) * .12 * P.spread)), lim = P.follow ? Math.max(1, Math.round(idx.length * u)) : idx.length, sig = rk * .5;
      for (let n = 0; n < lim; n++){
        const i = idx[n], px = Data.norm01(cx, i) * (GW - 1), py = (1 - Data.norm01(cy, i)) * (GH - 1), wt = .3 + .7 * (cw ? Data.norm01(cw, i) : .5);
        for (let j = Math.max(0, Math.floor(py - rk)); j <= Math.min(GH - 1, Math.ceil(py + rk)); j++) for (let k = Math.max(0, Math.floor(px - rk)); k <= Math.min(GW - 1, Math.ceil(px + rk)); k++){
          const d2 = ((k - px) * (k - px) + (j - py) * (j - py)) / (sig * sig); if (d2 < 9) g[j * GW + k] += wt * Math.exp(-d2 * .5);
        }
      }
    } else {
      /* each column is a lane across the frame; values blend smoothly from lane to lane, so the contours follow the table like a weather chart */
      let lanes = Data.usable(t, 'number').slice(0, 6); if (!lanes.length) return;
      if (lanes.length < 2) lanes = [lanes[0], lanes[0]];
      const J = lanes.length, rd = lanes.map(c => DV.series(c, GW, .3));
      for (let k = 0; k < GW; k++){
        const vis = P.follow ? dv2Clamp((u - k / (GW - 1)) * 12 + 1) : 1;
        for (let j = 0; j < GH; j++){
          const f = j / (GH - 1) * (J - 1), l = Math.min(J - 2, Math.floor(f)), e = f - l, m = e * e * (3 - 2 * e);
          g[j * GW + k] = (rd[l][k] * (1 - m) + rd[l + 1][k] * m) * vis;
        }
      }
    }
    /* soften, then scale to 0–1 */
    const rad = Math.round(P.smooth * 3);
    if (rad > 0) for (let pass = 0; pass < 2; pass++){
      const o = new Float32Array(g.length);
      for (let j = 0; j < GH; j++) for (let k = 0; k < GW; k++){ let s = 0, c = 0; for (let d = -rad; d <= rad; d++){ const kk = pass ? k : k + d, jj = pass ? j + d : j; if (kk < 0 || kk >= GW || jj < 0 || jj >= GH) continue; s += g[jj * GW + kk]; c++; } o[j * GW + k] = s / c; }
      g.set(o);
    }
    let mx = 1e-6; for (let i = 0; i < g.length; i++) mx = Math.max(mx, g[i]);
    for (let i = 0; i < g.length; i++) g[i] = Math.pow(g[i] / mx, P.gamma);
    const sx = b.w / (GW - 1), sy = b.h / (GH - 1);
    if (P.fill > 0){
      if (!dv2Cv){ dv2Cv = document.createElement('canvas'); dv2Cv.ctx = dv2Cv.getContext('2d'); }
      dv2Cv.width = GW; dv2Cv.height = GH;
      const im = dv2Cv.ctx.createImageData(GW, GH), lut = DV2.lut(P).rgb;
      for (let i = 0; i < g.length; i++){ const k = i % GW, j = (i - k) / GW, e = dv2Clamp(Math.min(k, GW - 1 - k, j, GH - 1 - j) / 8), c = lut[Math.round(g[i] * 255)], a = dv2Clamp(g[i] * 2.2) * P.fill * e * e * (3 - 2 * e); im.data[i * 4] = c[0]; im.data[i * 4 + 1] = c[1]; im.data[i * 4 + 2] = c[2]; im.data[i * 4 + 3] = a * 255; }
      dv2Cv.ctx.putImageData(im, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(dv2Cv, b.x, b.y, b.w, b.h);
    }
    const L = P.levels | 0; ctx.lineCap = 'round';
    for (let li = 0; li < L; li++){
      const lv = (li + 1) / (L + 1), big = P.index && li % 5 === 4;
      ctx.strokeStyle = DV2.ramp(P, Math.min(1, lv * 1.05 + .05)); ctx.lineWidth = Math.max(.7, P.weight * unit * (big ? 1.9 : 1)); ctx.globalAlpha = big ? 1 : .8;
      ctx.beginPath();
      for (let j = 0; j < GH - 1; j++) for (let k = 0; k < GW - 1; k++){
        const a = g[j * GW + k], bb = g[j * GW + k + 1], c = g[(j + 1) * GW + k + 1], d = g[(j + 1) * GW + k], m = (a > lv ? 8 : 0) | (bb > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
        if (m === 0 || m === 15) continue;
        const T = () => [k + (lv - a) / ((bb - a) || 1e-6), j], Rr = () => [k + 1, j + (lv - bb) / ((c - bb) || 1e-6)], Bt = () => [k + (lv - d) / ((c - d) || 1e-6), j + 1], Lf = () => [k, j + (lv - a) / ((d - a) || 1e-6)];
        const seg = (p, q) => { const P1 = p(), P2 = q(); ctx.moveTo(b.x + P1[0] * sx, b.y + P1[1] * sy); ctx.lineTo(b.x + P2[0] * sx, b.y + P2[1] * sy); };
        switch (m){
          case 1: case 14: seg(Lf, Bt); break; case 2: case 13: seg(Bt, Rr); break; case 3: case 12: seg(Lf, Rr); break;
          case 4: case 11: seg(T, Rr); break; case 5: seg(T, Lf); seg(Bt, Rr); break; case 6: case 9: seg(T, Bt); break;
          case 7: case 8: seg(T, Lf); break; case 10: seg(T, Rr); seg(Lf, Bt); break;
        }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } });

/* ---- constellation: points joined to their neighbours ---- */
FX.register({ id:'dv-constellation', name:'Data constellation', cat:'data', kind:'2d', nonLocal:true, search:['data', 'network', 'scatter', 'points', 'stars', 'map', 'graph', 'nodes'],
  desc:'Rows as points, each joined to its nearest neighbours by a fine line that fades with distance. Size and colour follow other columns.',
  params:[ Col('x','X column',0), Col('y','Y column',1), Col('size','Size column',2), Col('shade','Colour column',3), I('points','Points',320,30,600), I('links','Links per point',3,0,6), R('reach','Longest link',.2,.02,.5), R('dot','Dot size',1.4,.3,4,.05),
    R('line','Line weight',1,.3,4,.1), R('drift','Drift',.5,0,1), R('margin','Margin',.08,0,.3), T('follow','Reveal with the playhead',false), ...DV2.colors('#4a86c0'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), b = DV.box(P, w, h), unit = Math.min(w, h) / 1000, u = DV2.u(P, api), { cx, cy } = DV2.xy(P, t);
    if (!cx || !cy) return;
    const cs = Data.pick(P.size, 2, 'number', t), cc = Data.pick(P.shade, 3, 'number', t) || cs || cx, idx = DV2.pickRows(t, P.points | 0), N = idx.length, ph = api.loop * Sketch.TAU;
    const px = new Float32Array(N), py = new Float32Array(N), sz = new Float32Array(N), tn = new Float32Array(N), vis = new Float32Array(N);
    for (let n = 0; n < N; n++){
      const i = idx[n], f = N > 1 ? n / (N - 1) : 0, dx = Math.cos(ph + Sketch.rnd(n, 1) * 6.28) * P.drift * .008, dy = Math.sin(ph + Sketch.rnd(n, 2) * 6.28) * P.drift * .008;
      px[n] = dv2Clamp(Data.norm01(cx, i) + dx, 0, 1); py[n] = dv2Clamp(1 - Data.norm01(cy, i) + dy, 0, 1);
      sz[n] = cs ? Data.norm01(cs, i) : .5; tn[n] = Data.norm01(cc, i); vis[n] = P.follow ? dv2Clamp((u - f) * 24) : 1;
    }
    const reach = P.reach, K = P.links | 0, asp = b.w / b.h; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(.6, P.line * unit * .9);
    for (let n = 0; n < N; n++){
      if (vis[n] <= 0 || K === 0) continue;
      const near = [];
      for (let m = 0; m < N; m++){ if (m === n) continue; const d = Math.hypot((px[m] - px[n]) * asp, py[m] - py[n]) / Math.max(1, asp); if (d < reach) near.push([d, m]); }
      near.sort((a, c) => a[0] - c[0]);
      for (let k = 0; k < Math.min(K, near.length); k++){
        const [d, m] = near[k]; ctx.globalAlpha = (1 - d / reach) * .8 * Math.min(vis[n], vis[m]); if (ctx.globalAlpha <= .01) continue;
        ctx.strokeStyle = DV2.ramp(P, (tn[n] + tn[m]) / 2); ctx.beginPath(); ctx.moveTo(b.x + px[n] * b.w, b.y + py[n] * b.h); ctx.lineTo(b.x + px[m] * b.w, b.y + py[m] * b.h); ctx.stroke();
      }
    }
    for (let n = 0; n < N; n++){
      if (vis[n] <= 0) continue;
      ctx.globalAlpha = vis[n]; ctx.fillStyle = DV2.ramp(P, tn[n]); ctx.beginPath(); ctx.arc(b.x + px[n] * b.w, b.y + py[n] * b.h, Math.max(.9, unit * P.dot * (1.4 + sz[n] * 6)), 0, Sketch.TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } });

/* ---- halo: rings pushed out of shape by the data ---- */
FX.register({ id:'dv-halo', name:'Data halo', cat:'data', kind:'2d', nonLocal:true, search:['data', 'radial', 'rings', 'pulsar', 'waves', 'concentric', 'oscilloscope', 'orbit'],
  desc:'Concentric rings pushed out of round by a column, each reading it from a different starting point. A radial ridgeline.',
  params:[ Col('a','Column',0), I('rings','Rings',44,6,100), R('inner','Inner radius',.05,0,.3), R('reach','Reach',.32,.1,.5), R('amp','Displacement',.55,0,1.5), R('offset','Ring offset',.45,0,2), R('smooth','Smoothing',.4,0,1),
    R('weight','Line weight',1.5,.4,6,.1), T('solid','Hide lines behind',true), S('colour','Colour',['Ink','By ring','By displacement'],1), C('ink','Ink','#f4efe6','ink'), I('spin','Turns per loop',1,-4,4),
    R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1), T('follow','Open out with the playhead',false), ...DV2.colors('#5f8fc2'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), col = Data.pick(P.a, 0, 'number', t); if (!col) return;
    const R0 = Math.min(w, h), unit = R0 / 1000, u = DV2.u(P, api), K = P.rings | 0, M = 200, at = DV2.reader(col, 720, P.smooth);
    const cx = (.5 + P.x * .5) * w, cy = (.5 - P.y * .5) * h, shift = api.loop * (P.spin | 0);
    ctx.save(); ctx.translate(cx, cy); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, P.weight * unit);
    for (let k = K - 1; k >= 0; k--){
      const kk = k / (K - 1), grow = P.follow ? dv2Clamp((u * (K + 8) - (K - 1 - k)) / 8) : 1; if (grow <= 0) continue;
      const rb = R0 * (P.inner + (P.reach - P.inner) * kk) * grow, pts = []; let peak = 0;
      for (let i = 0; i < M; i++){
        const a = i / M, v = at(DV2.tri(a + k * P.offset / K + shift)); peak = Math.max(peak, v);
        const r = rb + v * R0 * P.amp * .12 * (.35 + kk * 1.1) * grow, th = a * Sketch.TAU - Math.PI / 2;
        pts.push([Math.cos(th) * r, Math.sin(th) * r]);
      }
      pts.push(pts[0]);
      ctx.beginPath(); DV.trace(ctx, pts);
      if (P.solid){ ctx.closePath(); ctx.fillStyle = P.bg; ctx.fill(); }
      ctx.strokeStyle = P.colour === 0 ? P.ink : DV2.ramp(P, P.colour === 1 ? kk : peak); ctx.stroke();
    }
    ctx.restore();
  } });

/* ---- marks: a field of little marks steered by three columns ---- */
FX.register({ id:'dv-marks', name:'Data mark field', cat:'data', kind:'2d', nonLocal:true, search:['data', 'field', 'pattern', 'grid', 'angle', 'texture', 'generative', 'marks'],
  desc:'A grid of small marks. One column sets the angle, another the length, a third the colour, read across the frame in a sweep, a ripple or a swirl.',
  params:[ Col('angle','Angle',0), Col('size','Length',1), Col('shade','Colour',0), S('mark','Mark',['Line','Line and dot','Arc','Plus','Triangle'],0), S('sweep','Read as',['Sweep','Ripple from centre','Swirl'],0), I('cols','Columns',24,6,64), R('dir','Sweep direction',.12,0,1),
    R('turn','Angle range',.7,0,1), R('base','Base angle',.05,0,1), R('len','Length',1.05,.2,1.6), R('lenRange','Length range',.6,0,1), R('weight','Weight',4,.5,12,.1), R('decor','Decorrelate',.5,0,1), R('cycles','Waves across',1.5,.25,5,.05),
    I('scroll','Scroll per loop',1,0,4), R('margin','Margin',.06,0,.3), T('follow','Reveal with the playhead',false), ...DV2.colors('#4a86c0'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), ca = Data.pick(P.angle, 0, 'number', t), cl = Data.pick(P.size, 1, 'number', t) || ca, cc = Data.pick(P.shade, 0, 'number', t) || ca; if (!ca) return;
    const b = DV.box(P, w, h), unit = Math.min(w, h) / 1000, u = DV2.u(P, api), NC = P.cols | 0, cell = b.w / NC, NR = Math.max(1, Math.floor(b.h / cell)), oy = b.y + (b.h - NR * cell) / 2;
    const dir = P.dir * Sketch.TAU, dxv = Math.cos(dir), dyv = Math.sin(dir), scroll = api.loop * (P.scroll | 0), sweep = P.sweep | 0, total = NC * NR, ar = b.h / b.w;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++){
      const fx = (i + .5) / NC - .5, fy = ((j + .5) * cell + oy - b.y) / b.h - .5, k = j * NC + i, fyy = fy * ar;
      let s;
      if (sweep === 0) s = (fx * dxv + fyy * dyv) * P.cycles * .7 + .5;
      else if (sweep === 1) s = Math.hypot(fx, fyy) * P.cycles * 1.1;
      else s = Math.atan2(fyy, fx) / Sketch.TAU * Math.max(1, Math.round(P.cycles)) + Math.hypot(fx, fyy) * P.cycles * .8;
      const uu = DV2.tri(s + scroll), va = DV2.val(ca, uu), vl = DV2.val(cl, DV2.tri(uu + .29 * P.decor)), vc = DV2.val(cc, DV2.tri(uu + .57 * P.decor));
      const vis = P.follow ? dv2Clamp((u - k / total) * 30) : 1; if (vis <= 0) continue;
      const ang = (P.base + va * P.turn) * Sketch.TAU, L = cell * P.len * .5 * (1 - P.lenRange + P.lenRange * (.15 + .85 * vl)), x = b.x + (i + .5) * cell, y = oy + (j + .5) * cell;
      const c = Math.cos(ang), s2 = Math.sin(ang);
      ctx.globalAlpha = vis; ctx.strokeStyle = ctx.fillStyle = DV2.ramp(P, vc); ctx.lineWidth = Math.max(1, P.weight * unit); ctx.beginPath();
      switch (P.mark | 0){
        case 0: ctx.moveTo(x - c * L, y - s2 * L); ctx.lineTo(x + c * L, y + s2 * L); ctx.stroke(); break;
        case 1: ctx.moveTo(x - c * L, y - s2 * L); ctx.lineTo(x + c * L, y + s2 * L); ctx.stroke(); ctx.beginPath(); ctx.arc(x + c * L, y + s2 * L, ctx.lineWidth * 1.2, 0, Sketch.TAU); ctx.fill(); break;
        case 2: ctx.arc(x, y, L * .8, ang, ang + Math.PI * (.5 + vl)); ctx.stroke(); break;
        case 3: ctx.moveTo(x - c * L, y - s2 * L); ctx.lineTo(x + c * L, y + s2 * L); ctx.moveTo(x + s2 * L, y - c * L); ctx.lineTo(x - s2 * L, y + c * L); ctx.stroke(); break;
        default: ctx.moveTo(x + c * L, y + s2 * L); ctx.lineTo(x + Math.cos(ang + 2.5) * L * .8, y + Math.sin(ang + 2.5) * L * .8); ctx.lineTo(x + Math.cos(ang - 2.5) * L * .8, y + Math.sin(ang - 2.5) * L * .8); ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  } });

/* ---- pack: rows as circles packed together, or as a treemap ---- */
const DV2pack = {
  cache:{ key:'', out:null },
  circles(items, gap){
    const placed = [];
    for (const it of items){
      const r = it.r; let best = null;
      if (!placed.length) best = { x:0, y:0 };
      else for (let s = 0; s < 1400 && !best; s++){
        const rad = r * .2 + s * r * .045 * (1 + s * .0012), a = s * 2.399963, x = Math.cos(a) * rad, y = Math.sin(a) * rad;
        let ok = true; for (let q = 0; q < placed.length; q++){ const p = placed[q], dx = p.x - x, dy = p.y - y, m = p.r + r + gap; if (dx * dx + dy * dy < m * m){ ok = false; break; } }
        if (ok) best = { x, y };
      }
      if (best) placed.push({ ...it, x:best.x, y:best.y });
    }
    let ext = 1; placed.forEach(p => { ext = Math.max(ext, Math.hypot(p.x, p.y) + p.r); });
    return { items:placed, ext };
  },
  treemap(items, x, y, w, h){
    const total = items.reduce((s, i) => s + i.a, 0) || 1, k = w * h / total, rects = [], rest = items.map(i => ({ ...i, a:Math.max(1e-6, i.a * k) }));
    let X = x, Y = y, W = w, H = h, row = [];
    const sum = r => r.reduce((s, i) => s + i.a, 0);
    const worst = (r, side) => { const s = sum(r), mx = Math.max(...r.map(i => i.a)), mn = Math.min(...r.map(i => i.a)); return Math.max(side * side * mx / (s * s), s * s / (side * side * mn)); };
    const lay = () => {
      const s = sum(row);
      if (W >= H){ const cw = s / H; let yy = Y; row.forEach(r => { const rh = r.a / cw; rects.push({ ...r, x:X, y:yy, w:cw, h:rh }); yy += rh; }); X += cw; W -= cw; }
      else { const rh = s / W; let xx = X; row.forEach(r => { const cw = r.a / rh; rects.push({ ...r, x:xx, y:Y, w:cw, h:rh }); xx += cw; }); Y += rh; H -= rh; }
      row = [];
    };
    while (rest.length){
      const side = Math.min(W, H), nx = rest[0];
      if (!row.length || worst([...row, nx], side) <= worst(row, side)) row.push(rest.shift()); else lay();
    }
    if (row.length) lay();
    return rects;
  },
};
FX.register({ id:'dv-pack', name:'Data pack', cat:'data', kind:'2d', nonLocal:true, search:['data', 'bubbles', 'circles', 'treemap', 'packing', 'proportion', 'blocks'],
  desc:'Every row as a circle, packed tight, or as a block in a treemap. Area follows the value, colour follows another column.',
  params:[ Col('size','Size column',0), Col('shade','Colour column',1), S('style','Style',['Circles','Treemap'],0), I('count','Rows',140,20,300), R('gap','Gap',.08,0,.5), R('range','Size range',.8,.1,1), R('round','Rounding',.25,0,1), S('look','Fill',['Solid','Outline'],0),
    R('gamma','Contrast',1,.3,3), R('margin','Margin',.07,0,.3), T('follow','Reveal with the playhead',false), ...DV2.colors(), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), cs = Data.pick(P.size, 0, 'number', t), cc = Data.pick(P.shade, 1, 'number', t) || cs; if (!cs) return;
    const b = DV.box(P, w, h), unit = Math.min(w, h) / 1000, u = DV2.u(P, api), idx = DV2.pickRows(t, P.count | 0), style = P.style | 0;
    const mk = i => { const v = Data.norm01(cs, i), a = (1 - P.range) + P.range * (.04 + v); return { v, tone:Data.norm01(cc, i), a, r:Math.sqrt(a) }; };
    const items = idx.map(mk).sort((a, c) => c.v - a.v);
    const key = [t.name, Data.version, t.rows, cs.name, P.count, P.style, P.gap, P.range, Math.round(b.w), Math.round(b.h)].join('|');
    let lay = DV2pack.cache.key === key ? DV2pack.cache.out : null;
    if (!lay){
      if (style === 0){ const c = DV2pack.circles(items.map(i => ({ ...i, r:i.r * 10 })), P.gap * 10), sc = Math.min(b.w, b.h) / 2 / c.ext; lay = c.items.map(p => ({ ...p, x:p.x * sc, y:p.y * sc, r:p.r * sc })); }
      else lay = DV2pack.treemap(items, b.x, b.y, b.w, b.h);
      DV2pack.cache = { key, out:lay };
    }
    const total = lay.length;
    lay.forEach((p, n) => {
      const vis = P.follow ? dv2Clamp((u - n / total) * 26) : 1; if (vis <= 0) return;
      ctx.globalAlpha = vis; ctx.fillStyle = ctx.strokeStyle = DV2.ramp(P, Math.pow(p.tone, P.gamma)); ctx.lineWidth = Math.max(1.2, 2 * unit); ctx.beginPath();
      if (style === 0) ctx.arc(w / 2 + p.x, h / 2 + p.y, Math.max(.5, p.r * (.6 + .4 * vis)), 0, Sketch.TAU);
      else { const g = P.gap * Math.min(p.w, p.h) * .5, rr = Math.min(p.w, p.h) * .5 * P.round, ww = Math.max(1, p.w - g * 2), hh = Math.max(1, p.h - g * 2); if (ctx.roundRect) ctx.roundRect(p.x + g, p.y + g, ww, hh, rr); else ctx.rect(p.x + g, p.y + g, ww, hh); }
      if (P.look === 1) ctx.stroke(); else ctx.fill();
    });
    ctx.globalAlpha = 1;
  } });

/* ---- strands: every row a thread through the columns ---- */
FX.register({ id:'dv-strands', name:'Data strands', cat:'data', kind:'2d', nonLocal:true, search:['data', 'parallel', 'threads', 'lines', 'curves', 'bundle', 'flow', 'bremer'],
  desc:'Every row as one fine curve threaded through the columns. Where rows agree the threads bunch into bands.',
  params:[ Col('shade','Colour by',0,'axis'), I('count','Rows',360,40,900), I('axes','Columns',6,2,8), S('style','Curve',['Smooth','Straight'],0), R('tension','Tension',.5,.1,.9), R('weight','Line weight',1.3,.3,4,.1), R('opacity','Opacity',.5,.03,1),
    T('even','Even out the spread',true), T('glow','Additive glow',true), T('guides','Column guides',false), R('spread','Height',.86,.3,1), R('margin','Margin',.08,0,.3), T('follow','Draw with the playhead',false), ...DV2.colors('#4a86c0'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), cols = Data.usable(t, 'number').slice(0, P.axes | 0); if (cols.length < 1) return;
    const cshade = Data.pick(P.shade, 0, 'axis', t), b = DV.box(P, w, h), unit = Math.min(w, h) / 1000, u = DV2.u(P, api), idx = DV2.pickRows(t, P.count | 0), N = idx.length, A = cols.length;
    const yb = b.y + b.h * (1 - P.spread) / 2, hh = b.h * P.spread, X = a => A > 1 ? b.x + b.w * a / (A - 1) : b.x + b.w / 2;
    if (P.guides){ ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = Math.max(1, unit); ctx.beginPath(); for (let a = 0; a < A; a++){ ctx.moveTo(X(a), yb); ctx.lineTo(X(a), yb + hh); } ctx.stroke(); }
    ctx.lineWidth = Math.max(.6, P.weight * unit); ctx.lineJoin = ctx.lineCap = 'round';
    if (P.glow) ctx.globalCompositeOperation = 'lighter';
    for (let n = 0; n < N; n++){
      const f = N > 1 ? n / (N - 1) : 0, vis = P.follow ? dv2Clamp((u - f) * 24) : 1; if (vis <= 0) continue;
      const i = idx[n], pts = cols.map((c, a) => [X(a), yb + hh * (1 - (P.even ? DV2.rank(c)[i] : Data.norm01(c, i)))]);
      ctx.strokeStyle = DV2.ramp(P, cshade ? Data.norm01(cshade, i) : f); ctx.globalAlpha = P.opacity * vis; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      if (A === 1) ctx.lineTo(pts[0][0] + 1, pts[0][1]);
      for (let a = 1; a < A; a++){
        const p = pts[a - 1], q = pts[a];
        if (P.style === 1) ctx.lineTo(q[0], q[1]);
        else { const dx = (q[0] - p[0]) * P.tension; ctx.bezierCurveTo(p[0] + dx, p[1], q[0] - dx, q[1], q[0], q[1]); }
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  } });

/* ---- two that work on the incoming image ---- */
FX.register({ id:'dv-shift', name:'Data shift', cat:'data', kind:'2d', nonLocal:true, search:['data', 'glitch', 'displace', 'slices', 'strips', 'distort', 'image'],
  desc:'Cuts the image into strips and slides each one by the data. The column reads down or across the frame and can scroll with the loop.',
  params:[ Col('a','Column',0), S('axis','Strips',['Rows slide sideways','Columns slide up and down'],1), I('strips','Strips',120,6,240), R('amount','Amount',.12,0,.6), R('smooth','Smoothing',.3,0,1),
    I('scroll','Scroll per loop',1,0,4), R('centre','Centre the shift',1,0,1), T('wrap','Wrap round the edge',true), T('follow','Shift with the playhead',false) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api, src = api.input; if (!src) return;
    const t = Data.current(), col = Data.pick(P.a, 0, 'number', t); if (!col) return;
    const N = P.strips | 0, vert = (P.axis | 0) === 1, u = DV2.u(P, api), at = DV2.reader(col, 512, P.smooth), amt = P.amount * (P.follow ? u : 1), scroll = api.loop * (P.scroll | 0);
    const len = vert ? h : w, across = vert ? w : h;
    for (let i = 0; i < N; i++){
      const a0 = Math.floor(i * across / N), a1 = Math.floor((i + 1) * across / N), th = a1 - a0; if (th < 1) continue;
      const v = at(DV2.tri(i / N * .5 + scroll)), off = (v - .5 * P.centre) * amt * len * 2;
      if (P.wrap) ctx.clearRect(vert ? a0 : 0, vert ? 0 : a0, vert ? th : w, vert ? h : th);
      for (const k of P.wrap ? [-1, 0, 1] : [0]){
        const d = off + k * len;
        if (vert) ctx.drawImage(src, a0, 0, th, h, a0, d, th, h); else ctx.drawImage(src, 0, a0, w, th, d, a0, w, th);
      }
    }
  } });

let dv2Scan = null;
FX.register({ id:'dv-relief', name:'Data relief', cat:'data', kind:'2d', nonLocal:true, search:['data', 'ridgeline', 'image', 'halftone', 'line screen', 'scanlines', 'portrait', 'joy division'],
  desc:'Redraws the incoming image as ridgelines, light areas standing tall. A column decides how tall each line stands.',
  params:[ Col('a','Height by',0), I('lines','Lines',80,16,140), R('height','Height',.1,.01,.3), R('data','Data influence',.6,0,1), R('smooth','Smoothing',.25,0,1), R('weight','Line weight',1.5,.4,5,.1), R('gamma','Contrast',1.3,.4,3),
    T('invert','Dark areas stand tall',false), T('solid','Hide lines behind',true), S('colour','Colour',['Ink','Average of the image','By data'],1), C('ink','Ink','#f4efe6','ink'), C('bg','Ground colour','#0f1012'), R('margin','Margin',.04,0,.3),
    T('follow','Rise with the playhead',false), ...DV2.colors('#5f8fc2') ],
  draw(ctx, api){
    const P = api.params, { w, h } = api, src = api.input;
    const t = Data.current(), col = Data.pick(P.a, 0, 'number', t), b = DV.box(P, w, h), unit = Math.min(w, h) / 1000, u = DV2.u(P, api);
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
    const L = P.lines | 0, M = 150; if (!src) return;
    if (!dv2Scan){ dv2Scan = document.createElement('canvas'); dv2Scan.ctx = dv2Scan.getContext('2d', { willReadFrequently:true }); }
    if (dv2Scan.width !== M || dv2Scan.height !== L){ dv2Scan.width = M; dv2Scan.height = L; }
    dv2Scan.ctx.imageSmoothingQuality = 'high'; dv2Scan.ctx.clearRect(0, 0, M, L); dv2Scan.ctx.drawImage(src, b.x, b.y, b.w, b.h, 0, 0, M, L);
    const px = dv2Scan.ctx.getImageData(0, 0, M, L).data, S = col ? DV.series(col, L, P.smooth) : null, amp = b.h * P.height * 2.2, step = b.h / L;
    ctx.lineJoin = ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, P.weight * unit);
    for (let j = 0; j < L; j++){
      const rise = P.follow ? dv2Clamp((u * (L + 8) - j) / 8) : 1; if (rise <= 0) continue;
      const mod = 1 - P.data + P.data * (S ? .25 + S[j] * 1.1 : 1), y0 = b.y + (j + .8) * step, pts = []; let r = 0, g = 0, bl = 0;
      for (let i = 0; i < M; i++){
        const k = (j * M + i) * 4, lum = (px[k] * .299 + px[k + 1] * .587 + px[k + 2] * .114) / 255, v = Math.pow(P.invert ? 1 - lum : lum, P.gamma);
        r += px[k]; g += px[k + 1]; bl += px[k + 2]; pts.push([b.x + b.w * i / (M - 1), y0 - v * amp * mod * rise]);
      }
      ctx.beginPath(); DV.trace(ctx, pts);
      if (P.solid){ ctx.lineTo(pts[M - 1][0], h + 4); ctx.lineTo(pts[0][0], h + 4); ctx.closePath(); ctx.fillStyle = P.bg; ctx.fill(); ctx.beginPath(); DV.trace(ctx, pts); }
      ctx.strokeStyle = P.colour === 0 ? P.ink : P.colour === 2 ? DV2.ramp(P, S ? S[j] : j / L) : `rgb(${Math.min(255, Math.round(r / M * 1.2 + 45))},${Math.min(255, Math.round(g / M * 1.2 + 45))},${Math.min(255, Math.round(bl / M * 1.2 + 45))})`;
      ctx.stroke();
    }
  } });
