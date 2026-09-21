/* ---------------- Data visuals, third set ----------------
   Chords and sunbursts that count rows into groups, bump ribbons, small
   multiples, horizon strips, a dot-matrix display, an oscilloscope, a dotted
   globe, cells, comets, an isometric city, a rose, and two that rework the
   incoming image.
   Same rules as the earlier sets: no axes, no labels, real sample data until you
   load your own, whole cycles of the loop for anything that moves, and every
   layout is whole-frame (nonLocal). A table with one column, or only categories,
   still draws something.
------------------------------------------------ */
const dv3Clamp = Util.clamp;
const DV3 = {
  /* a plain column by name or position, or a category column when the table has no plain numbers */
  col: (name, i, t, kind = 'number') => Data.pick(name, i, kind, t) || Data.pick(name, i, 'any', t) || Data.pick(name, i, 'axis', t) || (t.cols.find(c => c.v) || null),
  /* two columns for a scatter: longitude and latitude when nothing is chosen and the table has them */
  xy(P, t){
    const g = DV2.xy(P, t); if (g.cx && g.cy) return g;
    return { cx:DV3.col(P.x, 0, t), cy:DV3.col(P.y, 1, t), geo:false };
  },
  /* the table's value columns, up to n. Empty when it has none. */
  nums(t, n){
    let c = Data.usable(t, 'number'); if (!c.length) c = t.cols.filter(x => x.v);
    return c.slice(0, Math.max(1, n | 0));
  },
  /* which of K groups each row falls in. Numbers by equal count or equal width, categories by name. */
  groups(col, K, equalCount){
    const n = col.v.length, g = new Int16Array(n); K = Math.max(1, K | 0);
    if (col.type === 'category'){
      const m = col.cats.length; for (let i = 0; i < n; i++) g[i] = m <= K ? col.v[i] : Math.min(K - 1, Math.floor(col.v[i] * K / m));
      return { g, n:Math.min(K, m) };
    }
    const rk = equalCount ? DV2.rank(col) : null;
    for (let i = 0; i < n; i++) g[i] = Math.min(K - 1, Math.floor((rk ? rk[i] : Data.norm01(col, i)) * K));
    return { g, n:K };
  },
  /* several series from a table that may have one column: lagged copies stand in for the missing ones */
  series(t, count){
    const list = DV3.nums(t, count);
    if (!list.length) return [];
    if (list.length >= 2 || count < 2) return list.map(c => x => DV2.val(c, x));
    const c = list[0]; return Array.from({ length:count }, (_, k) => x => DV2.val(c, DV2.tri(x * .6 + k * .11)));
  },
};

/* ---- chord: rows counted into groups and joined by ribbons ---- */
FX.register({ id:'dv-chord', name:'Data chord', cat:'data', kind:'2d', nonLocal:true, search:['data', 'chord', 'arc', 'network', 'flow', 'circular', 'ribbons', 'relationships', 'sankey'],
  desc:'Rows sorted into groups round a ring, joined by ribbons. Two columns pair groups across the ring; with one, each row links to the next.',
  params:[ Col('a','From column',0,'any'), Col('b','To column',1,'any'), S('link','Join',['Column to column','Row to next row'],0), I('groups','Groups',6,2,14), S('bins','Sort numbers by',['Equal width','Equal count'],0),
    S('style','Style',['Ribbons','Threads'],0), R('reach','Radius',.36,.15,.48), R('ring','Ring width',.028,0,.1), R('gap','Gap between groups',.045,0,.25), R('opacity','Opacity',.7,.05,1), R('pull','Pull to the centre',.8,0,1), R('weight','Thread weight',1,.3,4,.1),
    I('spin','Rotations per loop',0,-3,3), T('follow','Draw with the playhead',false), ...DV2.colors('#4f7fb5'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), a = DV3.col(P.a, 0, t, 'any'); if (!a) return;
    const b = DV3.col(P.b, 1, t, 'any'), N = t.rows, K = P.groups | 0, u = DV2.u(P, api), R0 = Math.min(w, h), unit = R0 / 1000;
    const bip = !!b && b !== a && (P.link | 0) === 0, ga = DV3.groups(a, K, P.bins === 1), gb = bip ? DV3.groups(b, K, P.bins === 1) : ga;
    const NN = bip ? ga.n + gb.n : ga.n, lim = P.follow ? Math.max(2, Math.round(N * u)) : N;
    const links = new Map(), wt = new Float64Array(NN), rowU = [], rowV = [];
    for (let i = 0; i < lim; i++){
      if (!bip && i >= N - 1) break;
      const p = ga.g[i], q = bip ? ga.n + gb.g[i] : ga.g[i + 1]; rowU.push(p); rowV.push(q);
      const key = p * NN + q; links.set(key, (links.get(key) || 0) + 1); wt[p]++; wt[q]++;
    }
    const live = []; for (let i = 0; i < NN; i++) if (wt[i] > 0) live.push(i);
    if (!live.length) return;
    let total = 0; live.forEach(i => { total += wt[i]; });
    const gapA = P.gap * Sketch.TAU / live.length, extra = bip ? gapA * 2 : 0, k = Math.max(.1, Sketch.TAU - gapA * live.length - extra * 2) / total;
    const a0 = new Float64Array(NN), a1 = new Float64Array(NN); let cur = -Math.PI / 2 + (bip ? Math.PI * .5 : 0);
    live.forEach(i => { if (bip && i === ga.n) cur += extra; a0[i] = cur; cur += wt[i] * k; a1[i] = cur; cur += gapA; });
    const rr = R0 * P.reach, rw = R0 * P.ring, tone = i => NN > 1 ? i / (NN - 1) : .5;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(api.loop * Sketch.TAU * (P.spin | 0)); ctx.lineJoin = ctx.lineCap = 'round';
    if ((P.style | 0) === 1){
      ctx.lineWidth = Math.max(.6, P.weight * unit); ctx.globalAlpha = Math.min(1, P.opacity * .45);
      const pt = (i, f) => { const an = a0[i] + (a1[i] - a0[i]) * f; return [Math.cos(an) * rr, Math.sin(an) * rr]; };
      for (let r = 0; r < rowU.length; r++){
        const p = rowU[r], q = rowV[r], A = pt(p, Sketch.rnd(r, 3)), B = pt(q, Sketch.rnd(r, 8));
        ctx.strokeStyle = DV2.ramp(P, tone(p)); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo((A[0] + B[0]) / 2 * (1 - P.pull), (A[1] + B[1]) / 2 * (1 - P.pull), B[0], B[1]); ctx.stroke();
      }
    } else {
      /* each node's ribbons sit in order of where they go, which keeps them from tangling */
      const slots = {}, ends = new Map();
      const add = (n, o, key, side) => { if (!ends.has(n)) ends.set(n, []); ends.get(n).push([o, key, side]); };
      links.forEach((c, key) => { const p = Math.floor(key / NN), q = key % NN; add(p, q, key, 0); add(q, p, key, 1); });
      ends.forEach((list, node) => {
        list.sort((x, y) => ((y[0] - node + NN) % NN) - ((x[0] - node + NN) % NN)); let c = a0[node];
        list.forEach(([, key, side]) => { const s = links.get(key) * k; slots[key + ':' + side] = [c, c + s]; c += s; });
      });
      ctx.globalAlpha = P.opacity;
      links.forEach((c, key) => {
        const p = Math.floor(key / NN), q = key % NN, s = slots[key + ':0'], e = slots[key + ':1'], ri = rr - Math.max(2, rw * .35);
        const A = [Math.cos((s[0] + s[1]) / 2) * ri, Math.sin((s[0] + s[1]) / 2) * ri], B = [Math.cos((e[0] + e[1]) / 2) * ri, Math.sin((e[0] + e[1]) / 2) * ri];
        const gr = ctx.createLinearGradient(A[0], A[1], B[0], B[1]); gr.addColorStop(0, DV2.ramp(P, tone(p))); gr.addColorStop(1, DV2.ramp(P, tone(q)));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, ri, s[0], s[1]);
        const qx = (A[0] + B[0]) / 2 * (1 - P.pull), qy = (A[1] + B[1]) / 2 * (1 - P.pull);
        ctx.quadraticCurveTo(qx, qy, Math.cos(e[0]) * ri, Math.sin(e[0]) * ri); ctx.arc(0, 0, ri, e[0], e[1]);
        ctx.quadraticCurveTo(qx, qy, Math.cos(s[0]) * ri, Math.sin(s[0]) * ri); ctx.closePath(); ctx.fill();
      });
    }
    ctx.globalAlpha = 1;
    if (rw > .5) live.forEach(i => { ctx.strokeStyle = DV2.ramp(P, tone(i)); ctx.lineWidth = rw; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(0, 0, rr + rw * .5, a0[i], Math.max(a0[i] + .001, a1[i])); ctx.stroke(); });
    ctx.restore();
  } });

/* ---- bump: series changing places, as ribbons ---- */
FX.register({ id:'dv-bump', name:'Data bump', cat:'data', kind:'2d', nonLocal:true, search:['data', 'bump', 'rank', 'slope', 'ribbons', 'lines', 'overtake', 'metro'],
  desc:'Columns ranked against each other at a run of moments, each one a ribbon that weaves up and down as it overtakes the rest.',
  params:[ I('series','Series',5,2,10), I('steps','Moments',8,3,24), R('thick','Ribbon thickness',.16,.05,.9), R('flat','Flat stretch',.3,0,.8), R('sharp','Sharpness of the swap',.7,0,1), S('ends','Ends',['Round','Dots','Square'],0),
    R('gap','Outline',1,0,6,.1), R('margin','Margin',.09,0,.3), T('follow','Draw along with the playhead',false), ...DV2.colors('#3e7cb1'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), S = DV3.series(t, P.series | 0), K = S.length; if (!K) return;
    const bx = DV.box(P, w, h), unit = Math.min(w, h) / 1000, M = P.steps | 0, u = DV2.u(P, api), rowH = bx.h / K, colW = bx.w / (M - 1);
    const rank = Array.from({ length:K }, () => new Float32Array(M));
    for (let s = 0; s < M; s++){
      const order = S.map((f, k) => [f(s / (M - 1)), k]).sort((p, q) => q[0] - p[0] || p[1] - q[1]);
      order.forEach(([, k], r) => { rank[k][s] = r; });
    }
    const flat = colW * P.flat * .5, ease = x => { const e = x * x * (3 - 2 * x); return (1 - P.sharp) * x + P.sharp * e; };
    const bg = (P.ground | 0) === 1 ? P.bg : 'rgba(10,10,12,.7)';
    ctx.save(); if (P.follow){ ctx.beginPath(); ctx.rect(0, 0, bx.x + bx.w * u + bx.w * .04, h); ctx.clip(); }
    ctx.lineJoin = 'round';
    const paths = S.map((_, k) => {
      const pts = [];
      for (let s = 0; s < M; s++){
        const x = bx.x + s * colW, y = bx.y + (rank[k][s] + .5) * rowH;
        if (s === 0) pts.push([x, y]); else {
          const px = bx.x + (s - 1) * colW, py = bx.y + (rank[k][s - 1] + .5) * rowH, x0 = px + flat, x1 = x - flat;
          for (let j = 1; j <= 14; j++){ const f = j / 14; pts.push([x0 + (x1 - x0) * f, py + (y - py) * ease(f)]); }
        }
        pts.push([x + (s === M - 1 ? 0 : flat), y]);
      }
      return pts;
    });
    const stroke = (pts, wd, col) => { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineCap = P.ends === 2 ? 'butt' : 'round'; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); };
    const wd = Math.max(1.5, rowH * P.thick);
    /* ribbons furthest from the middle rank go down first, so the busy middle stays legible */
    const order = S.map((_, k) => k).sort((p, q) => Math.abs(rank[q][M >> 1] - (K - 1) / 2) - Math.abs(rank[p][M >> 1] - (K - 1) / 2));
    order.forEach(k => { if (P.gap > 0) stroke(paths[k], wd + P.gap * unit * 3, bg); stroke(paths[k], wd, DV2.ramp(P, K > 1 ? k / (K - 1) : .5)); });
    if ((P.ends | 0) === 1) order.forEach(k => {
      for (let s = 0; s < M; s++){ ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx.x + s * colW, bx.y + (rank[k][s] + .5) * rowH, wd * .3, 0, Sketch.TAU); ctx.fill(); }
    });
    ctx.restore();
  } });

/* ---- multiples: a grid of tiny sparklines ---- */
FX.register({ id:'dv-multiples', name:'Data multiples', cat:'data', kind:'2d', nonLocal:true, search:['data', 'sparklines', 'small multiples', 'grid', 'tiles', 'charts', 'panels'],
  desc:'A grid of small plots. Each column of the grid is a column of the table, each row a stretch of time, all on the same scale.',
  params:[ I('cols','Across',4,1,10), I('rows','Down',6,1,16), S('style','Style',['Line','Area','Bars','Dots'],1), S('scale','Scale',['Whole column','Each cell'],0), R('gap','Gap',.2,0,.6), R('weight','Line weight',2,.5,8,.1), T('dot','Mark the last value',true),
    S('colour','Colour',['By column','By average','Ink'],0), C('ink','Ink','#f4efe6','ink'), R('margin','Margin',.07,0,.3), T('follow','Reveal with the playhead',false), ...DV2.colors('#4a7fb0'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), cols = DV3.nums(t, 12); if (!cols.length) return;
    const bx = DV.box(P, w, h), unit = Math.min(w, h) / 1000, u = DV2.u(P, api), NC = P.cols | 0, NR = P.rows | 0, cw = bx.w / NC, ch = bx.h / NR, gx = cw * P.gap * .5, gy = ch * P.gap * .5, style = P.style | 0;
    const M = 40, total = NC * NR, W = Math.max(1, Math.ceil(NC / cols.length)); ctx.lineJoin = ctx.lineCap = 'round';
    for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++){
      const k = r * NC + c, vis = P.follow ? dv3Clamp((u - k / total) * 20) : 1; if (vis <= 0) continue;
      /* with more grid columns than table columns, the extra ones read later stretches of the same column */
      const col = cols[c % cols.length], win = Math.floor(c / cols.length), s0 = (win * NR + r) / (NR * W), s1 = s0 + 1 / (NR * W), vals = new Float32Array(M);
      let lo = 1, hi = 0, sum = 0;
      for (let i = 0; i < M; i++){ vals[i] = DV2.val(col, s0 + (s1 - s0) * i / (M - 1)); lo = Math.min(lo, vals[i]); hi = Math.max(hi, vals[i]); sum += vals[i]; }
      const avg = sum / M, x0 = bx.x + c * cw + gx, y0 = bx.y + r * ch + gy, cw2 = cw - gx * 2, ch2 = ch - gy * 2, span = hi - lo;
      const nv = i => P.scale === 1 ? (span > 1e-6 ? (vals[i] - lo) / span : .5) : vals[i];
      const tone = P.colour === 2 ? P.ink : DV2.ramp(P, P.colour === 0 ? (cols.length > 1 ? .12 + .88 * (c % cols.length) / (cols.length - 1) : .8) : avg);
      ctx.globalAlpha = vis; ctx.fillStyle = ctx.strokeStyle = tone; ctx.lineWidth = Math.max(1, P.weight * unit);
      const X = i => x0 + cw2 * i / (M - 1), Y = i => y0 + ch2 * (1 - nv(i) * .92 - .04);
      if (style === 2){ const bw = cw2 / M * .72; for (let i = 0; i < M; i++){ const y = Y(i); ctx.fillRect(X(i) - bw / 2, y, bw, y0 + ch2 - y); } }
      else if (style === 3){ for (let i = 0; i < M; i += 2){ ctx.beginPath(); ctx.arc(X(i), Y(i), Math.max(.8, P.weight * unit * .8), 0, Sketch.TAU); ctx.fill(); } }
      else {
        ctx.beginPath(); ctx.moveTo(X(0), Y(0)); for (let i = 1; i < M; i++) ctx.lineTo(X(i), Y(i));
        if (style === 1){ ctx.stroke(); ctx.lineTo(X(M - 1), y0 + ch2); ctx.lineTo(X(0), y0 + ch2); ctx.closePath(); ctx.globalAlpha = vis * .55; ctx.fill(); ctx.globalAlpha = vis; } else ctx.stroke();
      }
      if (P.dot){ ctx.beginPath(); ctx.arc(X(M - 1), Y(M - 1), Math.max(1.6, P.weight * unit * 1.5), 0, Sketch.TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  } });

/* ---- horizon: strips folded into bands ---- */
FX.register({ id:'dv-horizon', name:'Data horizon', cat:'data', kind:'2d', nonLocal:true, search:['data', 'horizon', 'strips', 'bands', 'stripes', 'lines', 'layers', 'time series'],
  desc:'Dense strips, each a column folded into layered bands, so a long series fits a thin line of colour. Above the average and below it use the two ends of the ramp.',
  params:[ I('strips','Strips',9,1,24), I('bands','Bands',3,1,6), R('window','Stretch shown',.5,.08,1), R('gap','Gap',.1,0,.6), T('fold','Fold around the average',true), R('smooth','Smoothing',.15,0,1), I('scroll','Scroll per loop',1,0,4),
    R('margin','Margin',.07,0,.3), T('follow','Draw along with the playhead',false), ...DV2.colors('#3f74a8'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), cols = DV3.nums(t, 8); if (!cols.length) return;
    const bx = DV.box(P, w, h), u = DV2.u(P, api), K = P.strips | 0, B = P.bands | 0, M = 240, sh = bx.h / K, hh = sh * (1 - P.gap), scroll = api.loop * (P.scroll | 0), W = Math.ceil(K / cols.length);
    ctx.save(); if (P.follow){ ctx.beginPath(); ctx.rect(0, 0, bx.x + bx.w * u + 1, h); ctx.clip(); }
    for (let k = 0; k < K; k++){
      const col = cols[k % cols.length], win = Math.floor(k / cols.length), at = DV2.reader(col, Math.min(900, Math.max(300, t.rows * 3)), P.smooth);
      const y0 = bx.y + k * sh + (sh - hh) / 2 + hh, span = P.window * (W > 1 ? .7 : 1), off = W > 1 ? win / W * (1 - span) : 0, vs = new Float32Array(M);
      /* the strip is read through a window that slides with the loop and folds back at the ends, so it closes */
      for (let i = 0; i < M; i++) vs[i] = at(DV2.tri((off + span * i / (M - 1)) * .5 + scroll));
      for (const sign of P.fold ? [1, -1] : [1]){
        for (let bnd = 0; bnd < B; bnd++){
          ctx.beginPath(); ctx.moveTo(bx.x, y0);
          for (let i = 0; i < M; i++) ctx.lineTo(bx.x + bx.w * i / (M - 1), y0 - dv3Clamp((P.fold ? sign * (vs[i] - .5) * 2 : vs[i]) * B - bnd) * hh);
          ctx.lineTo(bx.x + bx.w, y0); ctx.closePath();
          ctx.fillStyle = DV2.ramp(P, P.fold ? .5 + sign * (.12 + .38 * (bnd + 1) / B) : (bnd + 1) / B); ctx.fill();
        }
      }
    }
    ctx.restore();
  } });

/* ---- dot matrix: lamps lit to the value ---- */
FX.register({ id:'dv-led', name:'Data dot matrix', cat:'data', kind:'2d', nonLocal:true, search:['data', 'led', 'dot matrix', 'display', 'equaliser', 'equalizer', 'pixels', 'bars', 'retro'],
  desc:'A panel of round lamps, lit up to the value of a column, with the unlit ones left faintly on. Scrolls with the loop.',
  params:[ Col('a','Column',0), Col('b','Second column',1), S('style','Style',['Bars from the bottom','Centred','Two columns'],0), I('across','Lamps across',44,12,90), R('gap','Gap',.3,.05,.7), R('lit','Lamp size',1,.5,1.3), R('dim','Unlit lamps',.1,0,.4), R('glow','Glow',.5,0,1),
    R('smooth','Smoothing',.35,0,1), I('scroll','Scroll per loop',1,0,4), S('colour','Colour',['By height','One colour'],0), R('margin','Margin',.07,0,.3), T('follow','Light up with the playhead',false), ...DV2.colors('#3fa06b'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), a = DV3.col(P.a, 0, t), b = DV3.col(P.b, 1, t) || a; if (!a) return;
    const bx = DV.box(P, w, h), u = DV2.u(P, api), NC = P.across | 0, cell = bx.w / NC, NR = Math.max(4, Math.floor(bx.h / cell)), oy = bx.y + (bx.h - NR * cell) / 2, style = P.style | 0;
    const ra = DV2.reader(a, Math.min(900, Math.max(300, t.rows * 3)), P.smooth), rb = DV2.reader(b, 600, P.smooth), scroll = api.loop * (P.scroll | 0), rad = cell * (1 - P.gap) * .5 * P.lit;
    for (let c = 0; c < NC; c++){
      const vis = P.follow ? dv3Clamp((u - c / NC) * 14) : 1, x = bx.x + (c + .5) * cell, va = ra(DV2.tri(c / NC * .5 + scroll)) * vis, vb = rb(DV2.tri(c / NC * .5 + scroll + .33)) * vis;
      for (let r = 0; r < NR; r++){
        const f = (NR - 1 - r) / (NR - 1), y = oy + (r + .5) * cell;
        const lit = style === 0 ? f <= va : style === 1 ? Math.abs(f - .5) * 2 <= va : (f <= va * .5 || 1 - f <= vb * .5), col = DV2.ramp(P, P.colour === 1 ? .85 : f);
        if (lit){
          if (P.glow > 0){ ctx.globalAlpha = .16 * P.glow; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, rad * 2, 0, Sketch.TAU); ctx.fill(); }
          ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, rad, 0, Sketch.TAU); ctx.fill();
        } else if (P.dim > 0){ ctx.globalAlpha = P.dim; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, rad * .9, 0, Sketch.TAU); ctx.fill(); }
      }
    }
    ctx.globalAlpha = 1;
  } });

/* ---- scope: a carrier wave the data modulates, or a Lissajous knot ---- */
FX.register({ id:'dv-scope', name:'Data scope', cat:'data', kind:'2d', nonLocal:true, search:['data', 'oscilloscope', 'waveform', 'audio', 'signal', 'lissajous', 'wave', 'sine', 'glow', 'lines'],
  desc:'A fast wave whose height follows a column, like a signal on an oscilloscope. Or a Lissajous knot that swells and thins with the data.',
  params:[ S('mode','Trace',['Waveform','Lissajous'],0), I('traces','Traces',3,1,6), R('freq','Carrier waves',46,4,140,1), R('amp','Height',.2,.03,.45), R('smooth','Smoothing',.3,0,1), I('xf','Knot X cycles',3,1,9), I('yf','Knot Y cycles',2,1,9),
    R('weight','Line weight',1.6,.4,6,.1), R('glow','Glow',.6,0,1), T('envelope','Show the envelope',false), T('grid','Graticule',false), I('scroll','Phase cycles per loop',1,0,4), R('margin','Margin',.06,0,.3), T('follow','Draw with the playhead',false), ...DV2.colors('#4dd0a0'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), S = DV3.series(t, P.traces | 0), K = S.length; if (!K) return;
    const bx = DV.box(P, w, h), unit = Math.min(w, h) / 1000, u = DV2.u(P, api), ph = api.loop * (P.scroll | 0), lw = Math.max(1, P.weight * unit), knot = (P.mode | 0) === 1;
    const rd = S.map((f, k) => { const c = DV3.nums(t, 8)[k % Math.max(1, DV3.nums(t, 8).length)]; return DV2.reader(c, Math.min(800, Math.max(300, t.rows * 3)), P.smooth); });
    if (P.grid){
      ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = Math.max(1, unit); ctx.beginPath();
      for (let i = 0; i <= 10; i++){ ctx.moveTo(bx.x + bx.w * i / 10, bx.y); ctx.lineTo(bx.x + bx.w * i / 10, bx.y + bx.h); }
      for (let j = 0; j <= 12; j++){ ctx.moveTo(bx.x, bx.y + bx.h * j / 12); ctx.lineTo(bx.x + bx.w, bx.y + bx.h * j / 12); }
      ctx.stroke();
    }
    ctx.save(); ctx.lineJoin = ctx.lineCap = 'round'; ctx.globalCompositeOperation = (P.ground | 0) === 1 && P.bg && Util.hexToRgb(P.bg).reduce((s, v) => s + v, 0) < 300 ? 'lighter' : 'source-over';
    const M = knot ? 1400 : 900;
    for (let k = 0; k < K; k++){
      const col = DV2.ramp(P, K > 1 ? k / (K - 1) : .7), pts = [], env = [];
      const lim = P.follow ? Math.max(2, Math.round(M * u)) : M;
      for (let i = 0; i < lim; i++){
        const f = i / (M - 1), e = rd[k](f);
        if (knot){
          const r = .25 + .75 * e, a = Sketch.TAU * (P.xf * f + ph + k * .02), b2 = Sketch.TAU * (P.yf * f);
          pts.push([bx.x + bx.w / 2 + Math.sin(a) * r * bx.w * .46, bx.y + bx.h / 2 + Math.sin(b2) * r * Math.min(bx.h, bx.w * 1.15) * .46]);
        } else {
          const lane = K > 1 ? (k / (K - 1) - .5) * bx.h * .55 * (1 - .12 * Math.min(6, K)) * 1.9 : 0, yc = bx.y + bx.h / 2 + lane, a = bx.h * P.amp * (K > 1 ? .7 : 1);
          pts.push([bx.x + bx.w * f, yc - Math.sin(Sketch.TAU * (P.freq * f + ph + k * .21)) * e * a]); env.push([bx.x + bx.w * f, yc - e * a]);
        }
      }
      const passes = [[6, .07 * P.glow * 3], [3, .18 * P.glow * 2], [1, 1]];
      passes.forEach(([m, al]) => {
        if (al <= 0) return; ctx.strokeStyle = col; ctx.lineWidth = lw * m; ctx.globalAlpha = Math.min(1, al);
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
      });
      if (P.envelope && !knot){
        ctx.globalAlpha = .35; ctx.lineWidth = Math.max(1, lw * .6);
        for (const sg of [1, -1]){ ctx.beginPath(); env.forEach((p, i) => { const yy = sg === 1 ? p[1] : 2 * (bx.y + bx.h / 2 + (K > 1 ? (k / (K - 1) - .5) * bx.h * .55 * (1 - .12 * Math.min(6, K)) * 1.9 : 0)) - p[1]; if (i) ctx.lineTo(p[0], yy); else ctx.moveTo(p[0], yy); }); ctx.stroke(); }
      }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  } });

/* ---- globe: a sphere or map of dots sized by how many rows fall near them ---- */
const dv3Dens = { key:'', out:null };
FX.register({ id:'dv-globe', name:'Data globe', cat:'data', kind:'2d', nonLocal:true, search:['data', 'globe', 'map', 'world', 'earth', 'geo', 'latitude', 'longitude', 'dots', 'density', 'orthographic', 'mercator'],
  desc:'A globe or flat map made of dots, each sized and coloured by how many rows fall near it. Latitude and longitude place them; other tables are spread over the surface.',
  params:[ S('view','View',['Globe','Flat map','Mercator'],0), Col('x','Longitude column',0), Col('y','Latitude column',1), Col('size','Weight column',2), R('spacing','Dot spacing',4.2,2,9,.1), R('spread','Spread',.8,.3,2), R('dot','Dot size',1,.4,1.6,.05), R('base','Empty dots',.3,0,1),
    R('gamma','Contrast',.7,.3,2), R('size_','Size',.44,.2,.6), R('tilt','Tilt',20,-60,60,1), R('lon','Centre longitude',0,-180,180,1), I('spin','Rotations per loop',1,-2,2), R('y_','Position',0,-.5,.5), T('follow','Reveal with the playhead',false), ...DV2.colors('#294f7a'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), { cx, cy, geo } = DV3.xy(P, t); if (!cx || !cy) return;
    const cw = DV3.col(P.size, 2, t), idx = DV2.pickRows(t, 1600), R0 = Math.min(w, h), u = DV2.u(P, api), unit = R0 / 1000, sp = P.spacing, RAD = Math.PI / 180;
    /* dots on an even grid of latitude bands; density is worked out once per table and setting */
    const key = [t.name, Data.version, t.rows, cx.name, cy.name, cw && cw.name, sp, P.spread, geo, P.follow ? Math.round(u * 40) : 0].join('|');
    let D = dv3Dens.key === key ? dv3Dens.out : null;
    if (!D){
      const lat = [], lon = [];
      for (let la = -90 + sp / 2; la < 90; la += sp){ const n = Math.max(1, Math.round(360 / sp * Math.cos(la * RAD))); for (let j = 0; j < n; j++){ lat.push(la); lon.push(-180 + (j + .5) * 360 / n); } }
      const pts = [], lim = P.follow ? Math.max(1, Math.round(idx.length * u)) : idx.length;
      for (let n = 0; n < lim; n++){
        const i = idx[n], lo = geo ? cx.v[i] : (Data.norm01(cx, i) - .5) * 340, la = dv3Clamp(geo ? cy.v[i] : (Data.norm01(cy, i) - .5) * 130, -85, 85);
        if (!Number.isFinite(lo) || !Number.isFinite(la)) continue;
        pts.push([Math.cos(la * RAD) * Math.cos(lo * RAD), Math.cos(la * RAD) * Math.sin(lo * RAD), Math.sin(la * RAD), .35 + .65 * (cw ? Data.norm01(cw, i) : .5)]);
      }
      const sig = sp * RAD * 1.6 * P.spread, cut = Math.cos(Math.min(1.5, sig * 2.6)), dens = new Float32Array(lat.length);
      for (let d = 0; d < lat.length; d++){
        const a = Math.cos(lat[d] * RAD) * Math.cos(lon[d] * RAD), b = Math.cos(lat[d] * RAD) * Math.sin(lon[d] * RAD), c = Math.sin(lat[d] * RAD); let s = 0;
        for (let q = 0; q < pts.length; q++){ const p = pts[q], dot = a * p[0] + b * p[1] + c * p[2]; if (dot < cut) continue; const an = Math.acos(Math.min(1, dot)); s += p[3] * Math.exp(-an * an / (2 * sig * sig)); }
        dens[d] = s;
      }
      let mx = 1e-6; for (let d = 0; d < dens.length; d++) mx = Math.max(mx, dens[d]);
      for (let d = 0; d < dens.length; d++) dens[d] = Math.pow(dens[d] / mx, P.gamma);
      D = { lat, lon, dens }; dv3Dens.key = key; dv3Dens.out = D;
    }
    const view = P.view | 0, lon0 = P.lon + api.loop * 360 * (P.spin | 0), phi0 = P.tilt * RAD, cyc = h / 2 - P.y_ * h, r0 = R0 * P.size_ * 1.06, br = Math.max(.6, sp * .5 * P.dot * (view === 0 ? r0 / R0 * 2.2 : 1));
    const dr = sp * RAD * r0 * .5 * P.dot;
    if (view === 0){
      const g = ctx.createRadialGradient(w / 2 - r0 * .3, cyc - r0 * .3, r0 * .1, w / 2, cyc, r0); g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w / 2, cyc, r0, 0, Sketch.TAU); ctx.fill();
    }
    const bxm = DV.box({ margin:.05 }, w, h), mw = bxm.w, mercY = la => Math.log(Math.tan(Math.PI / 4 + Math.min(80, Math.max(-80, la)) * RAD / 2));
    const order = D.dens.length, list = [];
    for (let d = 0; d < order; d++){
      const la = D.lat[d] * RAD, lo = ((D.lon[d] - lon0 + 540) % 360 - 180) * RAD;
      let X, Y, z = 1;
      if (view === 0){
        const x = Math.cos(la) * Math.sin(lo), y = Math.cos(phi0) * Math.sin(la) - Math.sin(phi0) * Math.cos(la) * Math.cos(lo); z = Math.sin(phi0) * Math.sin(la) + Math.cos(phi0) * Math.cos(la) * Math.cos(lo);
        if (z < -.02) continue; X = w / 2 + x * r0; Y = cyc - y * r0;
      } else if (view === 1){ X = w / 2 + lo / Math.PI * mw / 2; Y = cyc - la / Math.PI * mw / 2; }
      else { if (Math.abs(D.lat[d]) > 80) continue; X = w / 2 + lo / Math.PI * mw / 2; Y = cyc - mercY(D.lat[d]) / Math.PI * mw / 2; }
      list.push([X, Y, z, D.dens[d]]);
    }
    const flatR = sp * RAD * mw / 2 / Math.PI * .5 * P.dot * (view === 2 ? 1 : 1);
    list.forEach(([X, Y, z, v]) => {
      const rad = (view === 0 ? dr : flatR) * (.2 + .8 * Math.pow(v, .8)) * .85 * (view === 0 ? (.45 + .55 * Math.max(0, z)) : 1) * (v < .02 ? .5 + P.base * 1.2 : 1);
      if (rad < .25) return;
      ctx.globalAlpha = v < .02 ? .5 + .3 * P.base : .6 + .4 * v; ctx.fillStyle = DV2.ramp(P, v < .02 ? .18 : .2 + .8 * v); ctx.beginPath(); ctx.arc(X, Y, Math.max(.5 * unit, rad), 0, Sketch.TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
  } });

/* ---- cells: a Voronoi tessellation, each cell a row ---- */
const dv3Cells = { key:'', out:null };
FX.register({ id:'dv-cells', name:'Data cells', cat:'data', kind:'2d', nonLocal:true, search:['data', 'voronoi', 'cells', 'tessellation', 'mosaic', 'stained glass', 'territory', 'map', 'tiles'],
  desc:'Rows as points, each owning the patch of frame nearest to it. Cells are coloured by a column and can be relaxed into an even mosaic.',
  params:[ Col('x','X column',0), Col('y','Y column',1), Col('shade','Colour column',2), I('cells','Cells',110,12,260), I('relax','Relax',2,0,8), T('even','Even out the colours',true), R('gap','Gap',.05,0,.4), R('round','Inset',0,0,.5), S('look','Fill',['Solid','Outline','Solid with outline'],0), R('gamma','Contrast',1,.3,3),
    T('dots','Mark the points',false), R('margin','Margin',.05,0,.3), T('follow','Reveal with the playhead',false), ...DV2.colors('#2f5d8c'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), { cx, cy } = DV3.xy(P, t); if (!cx || !cy) return;
    const cs = DV3.col(P.shade, 2, t) || cx, bx = DV.box(P, w, h), unit = Math.min(w, h) / 1000, u = DV2.u(P, api), idx = DV2.pickRows(t, P.cells | 0), N = idx.length;
    const key = [t.name, Data.version, t.rows, cx.name, cy.name, cs.name, P.even, P.cells, P.relax, Math.round(bx.w), Math.round(bx.h)].join('|');
    let cells = dv3Cells.key === key ? dv3Cells.out : null;
    if (!cells){
      let sx = new Float64Array(N), sy = new Float64Array(N);
      for (let n = 0; n < N; n++){ const i = idx[n]; sx[n] = (.03 + .94 * Data.norm01(cx, i)) * bx.w + (Sketch.rnd(n, 5) - .5) * 2; sy[n] = (.03 + .94 * (1 - Data.norm01(cy, i))) * bx.h + (Sketch.rnd(n, 6) - .5) * 2; }
      const cell = (n) => {
        let poly = [[0, 0], [bx.w, 0], [bx.w, bx.h], [0, bx.h]];
        const order = []; for (let m = 0; m < N; m++) if (m !== n) order.push([(sx[m] - sx[n]) ** 2 + (sy[m] - sy[n]) ** 2, m]);
        order.sort((a, b) => a[0] - b[0]);
        for (const [d2, m] of order){
          /* once every corner is nearer than half the distance to the next point, no further point can cut the cell */
          let far = 0; for (const p of poly) far = Math.max(far, (p[0] - sx[n]) ** 2 + (p[1] - sy[n]) ** 2);
          if (far < d2 / 4) break;
          const nx = sx[m] - sx[n], ny = sy[m] - sy[n], mx = (sx[m] + sx[n]) / 2, my = (sy[m] + sy[n]) / 2, out = [];
          for (let i = 0; i < poly.length; i++){
            const A = poly[i], B = poly[(i + 1) % poly.length], da = (A[0] - mx) * nx + (A[1] - my) * ny, db = (B[0] - mx) * nx + (B[1] - my) * ny;
            if (da <= 0) out.push(A);
            if ((da < 0 && db > 0) || (da > 0 && db < 0)){ const f = da / (da - db); out.push([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]); }
          }
          poly = out; if (poly.length < 3) break;
        }
        return poly;
      };
      let polys;
      for (let it = 0; it <= (P.relax | 0); it++){
        polys = Array.from({ length:N }, (_, n) => cell(n));
        if (it === (P.relax | 0)) break;
        polys.forEach((poly, n) => {
          if (poly.length < 3) return; let a = 0, gx = 0, gy = 0;
          for (let i = 0; i < poly.length; i++){ const A = poly[i], B = poly[(i + 1) % poly.length], cr = A[0] * B[1] - B[0] * A[1]; a += cr; gx += (A[0] + B[0]) * cr; gy += (A[1] + B[1]) * cr; }
          if (Math.abs(a) > 1e-6){ sx[n] += (gx / (3 * a) - sx[n]) * .8; sy[n] += (gy / (3 * a) - sy[n]) * .8; }
        });
      }
      cells = polys.map((poly, n) => ({ poly, x:sx[n], y:sy[n], v:P.even ? DV2.rank(cs)[idx[n]] : Data.norm01(cs, idx[n]) }));
      dv3Cells.key = key; dv3Cells.out = cells;
    }
    ctx.save(); ctx.translate(bx.x, bx.y); ctx.lineJoin = 'round';
    const look = P.look | 0, inset = 1 - P.round;
    cells.forEach((c, n) => {
      const vis = P.follow ? dv3Clamp((u - n / N) * 20) : 1; if (vis <= 0 || c.poly.length < 3) return;
      let gx = 0, gy = 0; c.poly.forEach(p => { gx += p[0]; gy += p[1]; }); gx /= c.poly.length; gy /= c.poly.length;
      const gapPx = P.gap * 30 * unit, k = Math.max(.05, inset);
      ctx.beginPath(); c.poly.forEach((p, i) => { const X = gx + (p[0] - gx) * k, Y = gy + (p[1] - gy) * k; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath();
      ctx.globalAlpha = vis; const col = DV2.ramp(P, Math.pow(c.v, P.gamma));
      if (look !== 1){ ctx.fillStyle = col; ctx.fill(); }
      ctx.lineWidth = Math.max(look === 0 ? gapPx : 1.6 * unit, .5); ctx.strokeStyle = look === 0 ? ((P.ground | 0) === 1 ? P.bg : 'rgba(10,10,12,.85)') : col; if (look !== 0 || gapPx > .5) ctx.stroke();
      if (P.dots){ ctx.fillStyle = look === 1 ? col : '#101113'; ctx.beginPath(); ctx.arc(c.x, c.y, 2.4 * unit, 0, Sketch.TAU); ctx.fill(); }
    });
    ctx.restore(); ctx.globalAlpha = 1;
  } });

/* ---- comets: rows as streaks with tails ---- */
FX.register({ id:'dv-comets', name:'Data comets', cat:'data', kind:'2d', nonLocal:true, search:['data', 'comets', 'particles', 'trails', 'ink', 'drops', 'meteors', 'streaks', 'scatter', 'motion'],
  desc:'Each row a bright head trailing a tail. Position comes from two columns, the length of the tail from a third, its direction from a fourth. They surge along their tails with the loop.',
  params:[ Col('x','X column',0), Col('y','Y column',1), Col('size','Tail column',2), Col('dir','Direction column',3), I('count','Comets',260,20,600), R('tail','Tail length',.16,.02,.4), R('head','Head size',1.5,.3,3,.05), R('base','Direction',.62,0,1), R('range','Direction range',.35,0,1),
    R('surge','Surge',.6,0,1), R('opacity','Opacity',.75,.1,1), T('glow','Glow',true), R('margin','Margin',.07,0,.3), T('follow','Reveal with the playhead',false), ...DV2.colors('#4b86c4'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), { cx, cy } = DV3.xy(P, t); if (!cx || !cy) return;
    const cs = DV3.col(P.size, 2, t) || cx, cd = DV3.col(P.dir, 3, t) || cs, bx = DV.box(P, w, h), unit = Math.min(w, h) / 1000, u = DV2.u(P, api), idx = DV2.pickRows(t, P.count | 0), N = idx.length;
    ctx.save(); if (P.glow && (P.ground | 0) === 1) ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let n = 0; n < N; n++){
      const i = idx[n], vis = P.follow ? dv3Clamp((u - n / N) * 24) : 1; if (vis <= 0) continue;
      const x = bx.x + bx.w * Data.norm01(cx, i), y = bx.y + bx.h * (1 - Data.norm01(cy, i)), sz = Data.norm01(cs, i), tn = Data.norm01(cd, i);
      const ang = (P.base + (tn - .5) * P.range) * Sketch.TAU, dx = Math.cos(ang), dy = Math.sin(ang), L = Math.min(bx.w, bx.h) * P.tail * (.15 + .85 * sz);
      const surge = Math.sin((api.loop + Sketch.rnd(n, 4)) * Sketch.TAU) * P.surge * L * .3, hx = x + dx * surge, hy = y + dy * surge, tx = hx - dx * L, ty = hy - dy * L;
      const col = DV2.ramp(P, tn), rad = Math.max(1.2, unit * P.head * (2 + sz * 5.5));
      const gr = ctx.createLinearGradient(hx, hy, tx, ty), c0 = Util.hexToRgb(P.c1), cc = col; gr.addColorStop(0, cc); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = P.opacity * vis; ctx.strokeStyle = gr; ctx.lineWidth = rad * 1.3; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
      if (P.glow){ ctx.globalAlpha = .18 * P.opacity * vis; ctx.fillStyle = cc; ctx.beginPath(); ctx.arc(hx, hy, rad * 2.6, 0, Sketch.TAU); ctx.fill(); }
      ctx.globalAlpha = P.opacity * vis; ctx.fillStyle = cc; ctx.beginPath(); ctx.arc(hx, hy, rad, 0, Sketch.TAU); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  } });

/* ---- city: an isometric field of blocks ---- */
FX.register({ id:'dv-city', name:'Data city', cat:'data', kind:'2d', nonLocal:true, search:['data', 'isometric', 'city', '3d', 'bars', 'skyline', 'blocks', 'towers', 'columns', 'architecture'],
  desc:'A column read across a square field of isometric blocks, each block as tall as its value. The heights breathe in a slow wave with the loop.',
  params:[ Col('a','Height column',0), Col('b','Colour column',1), I('grid','Blocks each way',16,4,40), R('height','Height',.9,.1,2.2), R('gap','Gap',.14,0,.6), R('wave','Wave',.25,0,1), R('smooth','Smoothing',.25,0,1), R('shade','Side shading',.5,0,.9),
    S('order','Read',['Row by row','Out from the centre'],0), R('y','Position',0,-.5,.5), R('margin','Margin',.05,0,.3), T('follow','Rise with the playhead',false), ...DV2.colors('#2f5d8c'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), a = DV3.col(P.a, 0, t), b = DV3.col(P.b, 1, t) || a; if (!a) return;
    const bx = DV.box(P, w, h), u = DV2.u(P, api), G = P.grid | 0, ra = DV2.reader(a, 800, P.smooth), rb = DV2.reader(b, 800, P.smooth), ph = api.loop * Sketch.TAU;
    const tw = bx.w / G * .98, th = tw * .5, cyb = h / 2 - P.y * h + G * th * .12;
    const mx = Math.max(bx.h * .36 * P.height, 1);
    const cells = [];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++){
      const rad = Math.hypot(i - (G - 1) / 2, j - (G - 1) / 2) / (G * .72), f = P.order === 1 ? dv3Clamp(rad) : (j * G + i + .5) / (G * G);
      const vis = P.follow ? dv3Clamp((u * 1.2 - f) * 8) : 1, breathe = 1 + P.wave * .5 * Math.sin(ph - (i + j) / (G * 2) * Sketch.TAU);
      cells.push({ i, j, v:ra(f), c:rb(f), hh:Math.max(.5, (.04 + ra(f) * .96) * mx * vis * breathe), key:i + j });
    }
    cells.sort((p, q) => p.key - q.key || p.i - q.i);
    const g = 1 - P.gap, k = P.shade;
    cells.forEach(c => {
      const X = w / 2 + (c.i - c.j) * tw / 2, Y = cyb - (G - 1) * th / 2 + (c.i + c.j) * th / 2, hw = tw / 2 * g, hh = th / 2 * g, top = DV2.ramp(P, c.c);
      const poly = (pts, fill) => { ctx.beginPath(); pts.forEach((p, n) => n ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
      const y0 = Y, y1 = Y - c.hh;
      poly([[X - hw, y0], [X, y0 + hh], [X, y1 + hh], [X - hw, y1]], top); poly([[X - hw, y0], [X, y0 + hh], [X, y1 + hh], [X - hw, y1]], `rgba(0,0,0,${k * .55})`);
      poly([[X + hw, y0], [X, y0 + hh], [X, y1 + hh], [X + hw, y1]], top); poly([[X + hw, y0], [X, y0 + hh], [X, y1 + hh], [X + hw, y1]], `rgba(0,0,0,${k * .25})`);
      poly([[X, y1 - hh], [X + hw, y1], [X, y1 + hh], [X - hw, y1]], top); poly([[X, y1 - hh], [X + hw, y1], [X, y1 + hh], [X - hw, y1]], `rgba(255,255,255,${k * .12})`);
    });
  } });

/* ---- rose: wedges whose length follows the data, stacked by column ---- */
FX.register({ id:'dv-rose', name:'Data rose', cat:'data', kind:'2d', nonLocal:true, search:['data', 'rose', 'nightingale', 'coxcomb', 'radar', 'petals', 'polar', 'wedges', 'radial', 'circular'],
  desc:'The table cut into wedges round a circle, each pushed out by its value. Several columns stack up in layers, like a Nightingale rose.',
  params:[ I('layers','Layers',3,1,5), I('wedges','Wedges',48,6,120), S('mode','Layers',['Stacked','Overlaid'],1), T('area','Length by area',true), R('inner','Inner radius',.06,0,.3), R('reach','Reach',.44,.15,.5), R('gap','Gap',.08,0,.6), R('smooth','Smoothing',.2,0,1),
    T('rings','Guide rings',false), I('spin','Rotations per loop',0,-3,3), S('colour','Colour',['By layer','By value'],0), T('follow','Sweep round with the playhead',false), ...DV2.colors('#3f74a8'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), S = DV3.series(t, P.layers | 0), L = S.length; if (!L) return;
    const R0 = Math.min(w, h), unit = R0 / 1000, u = DV2.u(P, api), NW = P.wedges | 0, r0 = R0 * P.inner, r1 = R0 * P.reach, stacked = (P.mode | 0) === 0, lo = P.smooth;
    const cs = DV3.nums(t, 8), rd = S.map((f, k) => DV2.reader(cs[k % cs.length], Math.max(NW * 3, 200), lo));
    const vals = Array.from({ length:L }, (_, k) => Float32Array.from({ length:NW }, (_, i) => S.length && cs.length >= 2 || L === 1 ? rd[k]((i + .5) / NW) : rd[k](DV2.tri((i + .5) / NW * .6 + k * .11))));
    /* a small floor, so a flat column still leaves a ring */
    vals.forEach(v => { for (let i = 0; i < NW; i++) v[i] = .06 + .94 * v[i]; });
    let mx = 1e-6; for (let i = 0; i < NW; i++){ let s = 0; for (let k = 0; k < L; k++){ s = stacked ? s + vals[k][i] : Math.max(s, vals[k][i]); } mx = Math.max(mx, s); }
    const rad = c => P.area ? Math.sqrt(r0 * r0 + (r1 * r1 - r0 * r0) * c) : r0 + (r1 - r0) * c, da = Sketch.TAU / NW, g = P.gap * da * .5, sweep = P.follow ? u * Sketch.TAU : 99;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(api.loop * Sketch.TAU * (P.spin | 0) - Math.PI / 2);
    if (P.rings){ ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = Math.max(1, unit); [.25, .5, .75, 1].forEach(f => { ctx.beginPath(); ctx.arc(0, 0, rad(f), 0, Sketch.TAU); ctx.stroke(); }); }
    for (let i = 0; i < NW; i++){
      const a0 = i * da + g; if (a0 > sweep) break; const a1 = Math.min(sweep, (i + 1) * da - g); let cum = 0;
      const order = stacked ? [...Array(L).keys()] : [...Array(L).keys()].sort((p, q) => vals[q][i] - vals[p][i]);
      order.forEach(k => {
        const v = vals[k][i] / mx, from = stacked ? cum : 0, to = stacked ? cum + v : v; cum = to;
        ctx.fillStyle = DV2.ramp(P, P.colour === 1 ? vals[k][i] : L > 1 ? k / (L - 1) : .75);
        ctx.beginPath(); ctx.arc(0, 0, rad(to), a0, a1); ctx.arc(0, 0, rad(from), a1, a0, true); ctx.closePath(); ctx.fill();
      });
    }
    ctx.restore();
  } });

/* ---- sunburst: rows counted into rings of nested groups ---- */
FX.register({ id:'dv-sunburst', name:'Data sunburst', cat:'data', kind:'2d', nonLocal:true, search:['data', 'sunburst', 'radial', 'hierarchy', 'donut', 'rings', 'proportion', 'pie', 'nested', 'circular'],
  desc:'Rows sorted into groups by one column, then each group split again by the next, in rings. The more rows in a group, the wider its arc.',
  params:[ Col('a','Inner column',0,'any'), Col('b','Middle column',1,'any'), Col('c','Outer column',2,'any'), I('rings','Rings',3,1,3), I('groups','Groups per ring',5,2,9), S('bins','Sort numbers by',['Equal width','Equal count'],0), R('inner','Inner radius',.08,0,.3), R('reach','Reach',.42,.15,.5),
    R('gap','Gap',.03,0,.2), R('fade','Tone change within a group',.22,0,.6), I('spin','Rotations per loop',0,-3,3), T('follow','Sweep round with the playhead',false), ...DV2.colors('#3f74a8'), ...DV2.ground() ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), cols = [P.a, P.b, P.c].slice(0, P.rings | 0).map((nm, i) => DV3.col(nm, i, t, 'any')).filter(Boolean); if (!cols.length) return;
    const R0 = Math.min(w, h), u = DV2.u(P, api), K = P.groups | 0, gr = cols.map(c => DV3.groups(c, K, P.bins === 1)), r0 = R0 * P.inner, rw = (R0 * P.reach - r0) / cols.length, N = t.rows, sweep = P.follow ? u * Sketch.TAU : 99;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(api.loop * Sketch.TAU * (P.spin | 0) - Math.PI / 2);
    /* split the parent's rows by the next column, and give each child a share of the parent's arc */
    const split = (rows, depth, a0, a1, top) => {
      if (depth >= cols.length || !rows.length) return;
      const bins = new Map(); rows.forEach(i => { const g = gr[depth].g[i]; if (!bins.has(g)) bins.set(g, []); bins.get(g).push(i); });
      const keys = [...bins.keys()].sort((p, q) => p - q), gap = Math.min((a1 - a0) / keys.length * .3, P.gap * Sketch.TAU / (1 + depth)); let cur = a0;
      const room = (a1 - a0) - gap * (keys.length - 1) * (keys.length > 1 ? 1 : 0);
      keys.forEach((g, n) => {
        const list = bins.get(g), span = room * list.length / rows.length, s0 = cur, s1 = cur + span; cur += span + gap;
        const tone = depth === 0 ? (gr[0].n > 1 ? g / (gr[0].n - 1) : .7) : dv3Clamp(top + (keys.length > 1 ? n / (keys.length - 1) - .5 : 0) * P.fade);
        if (s0 < sweep){
          ctx.fillStyle = DV2.ramp(P, tone); ctx.beginPath(); ctx.arc(0, 0, r0 + (depth + 1) * rw - rw * .06, s0, Math.min(s1, sweep)); ctx.arc(0, 0, r0 + depth * rw + rw * .06, Math.min(s1, sweep), s0, true); ctx.closePath(); ctx.fill();
        }
        split(list, depth + 1, s0, s1, tone);
      });
    };
    split(Array.from({ length:N }, (_, i) => i), 0, 0, Sketch.TAU, .5);
    ctx.restore();
  } });

/* ---- halftone: the image as marks, sized and angled by the data ---- */
let dv3Scan = null;
FX.register({ id:'dv-halftone', name:'Data halftone', cat:'data', kind:'2d', nonLocal:true, search:['data', 'halftone', 'dots', 'screen', 'print', 'image', 'newsprint', 'hatch', 'stipple', 'mark'],
  desc:'Redraws the incoming image as a screen of marks, larger where it is light. A column swells the marks in some bands of the frame and turns them in others.',
  params:[ Col('a','Column',0), S('mark','Mark',['Dot','Line','Square','Cross'],0), I('cells','Cells across',56,16,120), R('angle','Screen angle',.125,0,.5,.005), R('data','Data influence',.7,0,1), R('twist','Turn the marks',.5,0,1), S('read','Column reads',['Down the frame','Across the frame'],0),
    R('smooth','Smoothing',.3,0,1), R('gain','Mark size',1,.4,1.6,.02), R('gamma','Contrast',1,.4,2.5), T('invert','Dark areas stand large',false), I('scroll','Scroll per loop',1,0,4), S('colour','Colour',['Ink','Image colour','By data'],1), C('ink','Ink','#f4efe6','ink'), C('bg','Ground colour','#101113'),
    ...DV2.colors('#4a86c0') ],
  draw(ctx, api){
    const P = api.params, { w, h } = api, src = api.input;
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h); if (!src) return;
    const t = Data.current(), col = DV3.col(P.a, 0, t); const cs = w / (P.cells | 0), NX = P.cells | 0;
    const sw = 180, sh = Math.max(8, Math.round(sw * h / w));
    if (!dv3Scan){ dv3Scan = document.createElement('canvas'); dv3Scan.ctx = dv3Scan.getContext('2d', { willReadFrequently:true }); }
    if (dv3Scan.width !== sw || dv3Scan.height !== sh){ dv3Scan.width = sw; dv3Scan.height = sh; }
    dv3Scan.ctx.imageSmoothingQuality = 'high'; dv3Scan.ctx.clearRect(0, 0, sw, sh); dv3Scan.ctx.drawImage(src, 0, 0, sw, sh);
    const px = dv3Scan.ctx.getImageData(0, 0, sw, sh).data, at = col ? DV2.reader(col, 400, P.smooth) : null, scroll = api.loop * (P.scroll | 0), th = P.angle * Sketch.TAU, ca = Math.cos(th), sa = Math.sin(th), diag = Math.hypot(w, h), n = Math.ceil(diag / cs / 2) + 1;
    ctx.save(); ctx.lineCap = 'round';
    for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++){
      const gx = i * cs, gy = j * cs, x = w / 2 + gx * ca - gy * sa, y = h / 2 + gx * sa + gy * ca;
      if (x < -cs || x > w + cs || y < -cs || y > h + cs) continue;
      const ix = Math.min(sw - 1, Math.max(0, Math.floor(x / w * sw))), iy = Math.min(sh - 1, Math.max(0, Math.floor(y / h * sh))), k = (iy * sw + ix) * 4;
      const lum = (px[k] * .299 + px[k + 1] * .587 + px[k + 2] * .114) / 255, base = Math.pow(P.invert ? 1 - lum : lum, P.gamma);
      const along = (P.read | 0) === 0 ? y / h : x / w, v = at ? at(DV2.tri(along * .5 + scroll)) : .5;
      const size = cs * .62 * P.gain * base * (1 - P.data + P.data * (.25 + v * 1.25));
      if (size < .35) continue;
      const rot = th + v * P.twist * Math.PI, col2 = P.colour === 0 ? P.ink : P.colour === 2 ? DV2.ramp(P, v) : `rgb(${Math.min(255, px[k] * 1.15 + 20 | 0)},${Math.min(255, px[k + 1] * 1.15 + 20 | 0)},${Math.min(255, px[k + 2] * 1.15 + 20 | 0)})`;
      ctx.fillStyle = ctx.strokeStyle = col2;
      const m = P.mark | 0;
      if (m === 0){ ctx.beginPath(); ctx.arc(x, y, size, 0, Sketch.TAU); ctx.fill(); }
      else if (m === 1){ ctx.lineWidth = Math.max(1, size * .55); ctx.beginPath(); ctx.moveTo(x - Math.cos(rot) * cs * .5, y - Math.sin(rot) * cs * .5); ctx.lineTo(x + Math.cos(rot) * cs * .5, y + Math.sin(rot) * cs * .5); ctx.stroke(); }
      else if (m === 2){ ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillRect(-size, -size, size * 2, size * 2); ctx.restore(); }
      else { ctx.lineWidth = Math.max(1, size * .4); ctx.beginPath(); ctx.moveTo(x - Math.cos(rot) * size, y - Math.sin(rot) * size); ctx.lineTo(x + Math.cos(rot) * size, y + Math.sin(rot) * size); ctx.moveTo(x + Math.sin(rot) * size, y - Math.cos(rot) * size); ctx.lineTo(x - Math.sin(rot) * size, y + Math.cos(rot) * size); ctx.stroke(); }
    }
    ctx.restore();
  } });

/* ---- mosaic: the image pixelated, in bands whose block size follows the data ---- */
let dv3Tile = null;
FX.register({ id:'dv-mosaic', name:'Data mosaic', cat:'data', kind:'2d', nonLocal:true, search:['data', 'pixelate', 'mosaic', 'blocks', 'pixel', 'image', 'censor', 'bands', 'resolution', 'glitch'],
  desc:'Pixelates the incoming image in bands. A column decides how coarse each band is, so the picture comes in and out of focus down the frame.',
  params:[ Col('a','Column',0), S('axis','Bands run',['Across the frame','Down the frame'],0), I('bands','Bands',22,3,60), R('fine','Finest block',.006,.002,.03,.001), R('coarse','Coarsest block',.11,.02,.4,.005), R('smooth','Smoothing',.25,0,1), R('gap','Gap between blocks',0,0,.5), I('scroll','Scroll per loop',1,0,4),
    T('sharp','Sharp edges',false), T('follow','Coarsen with the playhead',false) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api, src = api.input; if (!src) return;
    const t = Data.current(), col = DV3.col(P.a, 0, t), at = col ? DV2.reader(col, 400, P.smooth) : null, u = DV2.u(P, api), scroll = api.loop * (P.scroll | 0), horiz = (P.axis | 0) === 0, N = P.bands | 0;
    const len = horiz ? h : w, across = horiz ? w : h, unit = Math.min(w, h);
    if (!dv3Tile) dv3Tile = document.createElement('canvas');
    ctx.clearRect(0, 0, w, h); ctx.imageSmoothingEnabled = false;
    for (let s = 0; s < N; s++){
      const a0 = Math.round(s * len / N), a1 = Math.round((s + 1) * len / N), band = a1 - a0; if (band < 1) continue;
      const v = at ? at(DV2.tri((s + .5) / N * .5 + scroll)) : .5, bs = unit * (P.fine + (P.coarse - P.fine) * Math.pow(v, 1.2) * (P.follow ? u : 1));
      const nb = Math.max(1, Math.round(band / Math.max(2, bs))), B = band / nb, ncols = Math.max(1, Math.ceil(across / B));
      dv3Tile.width = ncols; dv3Tile.height = nb; const tc = dv3Tile.getContext('2d'); tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
      if (horiz){ tc.drawImage(src, 0, a0, w, band, 0, 0, ncols, nb); ctx.drawImage(dv3Tile, 0, 0, ncols, nb, 0, a0, ncols * B, band); }
      else { tc.drawImage(src, a0, 0, band, h, 0, 0, nb, ncols); ctx.save(); ctx.translate(a0, 0); ctx.drawImage(dv3Tile, 0, 0, nb, ncols, 0, 0, band, ncols * B); ctx.restore(); }
      if (P.gap > 0 && B > 3){
        ctx.fillStyle = 'rgba(0,0,0,.9)'; const gw = Math.max(1, B * P.gap);
        for (let k = 0; k <= ncols; k++) horiz ? ctx.fillRect(k * B - gw / 2, a0, gw, band) : ctx.fillRect(a0, k * B - gw / 2, band, gw);
        for (let k = 0; k <= nb; k++) horiz ? ctx.fillRect(0, a0 + k * B - gw / 2, w, gw) : ctx.fillRect(a0 + k * B - gw / 2, 0, gw, h);
      }
    }
    ctx.imageSmoothingEnabled = true;
  } });
