/* ---------------- Data visuals ----------------
   Canvas 2D modules that read the loaded table (Data.current()). Until you load
   your own, they draw a real sample, so each looks like something the moment
   it is added. No axes, no labels: these make marks, not charts to be read.
   With "follow the playhead" on they draw on with the loop, and close it.
------------------------------------------------ */
const DV = {
  box(P, w, h){ const m = P.margin * Math.min(w, h); return { x:m, y:m, w:w - m * 2, h:h - m * 2 }; },
  /* a column resampled to N steps, 0–1, softened by a moving average */
  series(col, N, smooth){
    const v = new Float32Array(N);
    for (let i = 0; i < N; i++) v[i] = Data.norm(col, Data.at(col, N > 1 ? i / (N - 1) : 0));
    const k = Math.round(smooth * N * .05);
    if (!k) return v;
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++){ let s = 0, c = 0; for (let j = -k; j <= k; j++){ const x = i + j; if (x < 0 || x >= N) continue; const wt = k + 1 - Math.abs(j); s += v[x] * wt; c += wt; } out[i] = s / c; }
    return out;
  },
  trace(ctx, pts){
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    const l = pts[pts.length - 1]; ctx.lineTo(l[0], l[1]);
  },
  /* series colour: ink, ink → accent across the series, or from the palette */
  tone(P, k, n){
    if (P.colour === 0) return P.c1;
    if (P.colour === 2) return Sketch.paletteColor(k, 3, Sketch.mixHex(P.c1, P.c2, n > 1 ? k / (n - 1) : 1));
    return Sketch.mixHex(P.c1, P.c2, n > 1 ? k / (n - 1) : 1);
  },
  ramp(P, t){
    if (P.ramp === 1) return t < .5 ? Sketch.mixHex(P.c1, P.cm, t * 2) : Sketch.mixHex(P.cm, P.c2, t * 2 - 1);
    return Sketch.mixHex(P.c1, P.c2, t);
  },
  colorParams: () => [ C('c1','Low','#2d5a7b'), C('cm','Middle','#efe6d8'), C('c2','High','#ff5a36','accent'), S('ramp','Ramp',['Two colour','Three colour'],1) ],
};

FX.register({ id:'dv-lines', name:'Data lines', cat:'data', kind:'2d', nonLocal:true, search:['data', 'chart'],
  desc:'Columns of the table as lines, areas, ridges or a stream. Draws on with the playhead.',
  params:[ Col('a','Column 1',0), Col('b','Column 2',1), Col('c','Column 3',2), I('series','Series',2,1,3), S('style','Style',['Line','Area','Ridgeline','Stream'],1),
    R('height','Height',.42,.1,1), R('smooth','Smoothing',.5,0,1), R('weight','Line weight',3,.5,12,.1), R('fill','Fill opacity',.5,0,1),
    R('margin','Margin',.08,0,.3), R('y','Position',0,-.5,.5), T('follow','Draw on with the playhead',true),
    S('colour','Colour',['Ink','Ink to accent','From palette'],1), C('c1','Ink','#f4efe6','ink'), C('c2','Accent','#ff5a36','accent'), ...Sketch.groundParams(0) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), n = Math.max(1, P.series | 0);
    const cols = [P.a, P.b, P.c].slice(0, n).map((nm, i) => Data.pick(nm, i, 'number', t)).filter(Boolean);
    if (!cols.length) return;
    const b = DV.box(P, w, h), u = P.follow ? Data.u(api) : 1, N = Math.min(Math.max(t.rows, 2), 320), unit = Math.min(w, h) / 1000;
    const S = cols.map(c => DV.series(c, N, P.smooth)), H = b.h * P.height, yc = h / 2 - P.y * h, style = P.style | 0;
    const X = i => b.x + b.w * i / (N - 1);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, b.x + b.w * u + 1, h); ctx.clip();
    ctx.lineJoin = ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, P.weight * unit * 1.6);
    if (style === 3){
      const tot = new Float32Array(N); S.forEach(s => s.forEach((v, i) => { tot[i] += v; }));
      const sc = H / Math.max(...tot, 1e-6), cum = new Float32Array(N);
      S.forEach((s, k) => {
        const top = [], bot = [];
        for (let i = 0; i < N; i++){ const y0 = yc - tot[i] * sc / 2 + cum[i] * sc; top.push([X(i), y0]); bot.push([X(i), y0 + s[i] * sc]); cum[i] += s[i]; }
        ctx.beginPath(); DV.trace(ctx, top); const r = bot.slice().reverse(); ctx.lineTo(r[0][0], r[0][1]); DV.trace(ctx, r); ctx.closePath();
        ctx.globalAlpha = .35 + P.fill * .65; ctx.fillStyle = DV.tone(P, k, S.length); ctx.fill();
      });
    } else {
      const order = style === 2 ? S.map((_, k) => k) : S.map((_, k) => S.length - 1 - k);
      order.forEach(k => {
        const s = S[k], base = style === 2 ? yc + H / 2 - (S.length > 1 ? k / (S.length - 1) : 0) * H * .55 : yc + H / 2, amp = style === 2 ? H * .5 : H;
        const pts = Array.from(s, (v, i) => [X(i), base - v * amp]);
        const col = DV.tone(P, k, S.length);
        if (style > 0){
          ctx.beginPath(); DV.trace(ctx, pts); ctx.lineTo(X(N - 1), base); ctx.lineTo(X(0), base); ctx.closePath();
          ctx.globalAlpha = style === 2 ? .92 : P.fill; ctx.fillStyle = style === 2 ? ((P.ground | 0) === 1 ? P.bg : 'rgba(12,12,16,.62)') : col; ctx.fill();
        }
        if (style !== 1 || P.fill < .98){ ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.beginPath(); DV.trace(ctx, pts); ctx.stroke(); }
      });
    }
    ctx.restore(); ctx.globalAlpha = 1;
  } });

FX.register({ id:'dv-dots', name:'Data points', cat:'data', kind:'2d', nonLocal:true, search:['data', 'scatter'],
  desc:'One dot per row, placed, sized and coloured by columns. Latitude and longitude make a map.',
  params:[ S('xmode','X position',['Column','Row order'],0), Col('x','X column',0,'axis'), Col('y','Y column',0), Col('size','Size column',1), Col('shade','Colour column',2,'any'),
    S('shape','Shape',['Circle','Ring','Square','Cross'],0), R('dot','Dot size',1.1,.2,5,.05), R('range','Size variation',.6,0,1), R('opacity','Opacity',.8,.1,1), R('jitter','Jitter',0,0,1),
    R('margin','Margin',.08,0,.3), T('follow','Reveal with the playhead',false), S('colour','Colour',['Ink','Ramp by column','Category'],1),
    ...DV.colorParams(), ...Sketch.groundParams(0) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), n = t.rows, b = DV.box(P, w, h), unit = Math.min(w, h) / 1000;
    /* with nothing chosen, a table with longitude and latitude draws a map; otherwise an axis column runs along X */
    const geo = !P.x && !P.y ? Data.geo(t) : null;
    const cx = P.xmode === 1 ? null : geo ? geo.x : Data.pick(P.x, 0, 'axis', t), cy = geo ? geo.y : Data.pick(P.y, 0, 'number', t), cs = Data.pick(P.size, 1, 'number', t), cc = Data.pick(P.shade, 2, 'any', t);
    if (!cy) return;
    const u = P.follow ? Data.u(api) : 1, shape = P.shape | 0, mode = P.colour | 0, base = 7 * unit * P.dot;
    for (let i = 0; i < n; i++){
      const a = n > 1 ? i / (n - 1) : 0, vis = P.follow ? Util.clamp((u - a) * 24) : 1;
      if (vis <= 0) continue;
      const jx = (Sketch.rnd(i, 1) - .5) * P.jitter * 40 * unit, jy = (Sketch.rnd(i, 2) - .5) * P.jitter * 40 * unit;
      const x = b.x + b.w * (cx ? Data.norm01(cx, i) : a) + jx, y = b.y + b.h * (1 - Data.norm01(cy, i)) + jy;
      const s = base * (1 + (cs ? Data.norm01(cs, i) : .5) * P.range * 3);
      ctx.globalAlpha = P.opacity * vis;
      const col = mode === 0 || !cc ? P.c2 : mode === 2 ? `hsl(${(cc.v[i] * 137.5) % 360} 62% 66%)` : DV.ramp(P, Data.norm01(cc, i));
      ctx.fillStyle = ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, s * .28);
      ctx.beginPath();
      if (shape === 0) ctx.arc(x, y, s, 0, Sketch.TAU), ctx.fill();
      else if (shape === 1) ctx.arc(x, y, s, 0, Sketch.TAU), ctx.stroke();
      else if (shape === 2) ctx.fillRect(x - s, y - s, s * 2, s * 2);
      else { ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  } });

FX.register({ id:'dv-columns', name:'Data columns', cat:'data', kind:'2d', nonLocal:true, search:['data', 'bars', 'stripes'],
  desc:'A column as bars, stripes, needles or steps, coloured by value. Stripes make the classic warming pattern.',
  params:[ Col('value','Column',0), Col('shade','Colour by',1), S('style','Style',['Bars','Stripes','Needles','Steps'],1), I('count','Bars',90,6,300), R('gap','Gap',.15,0,.9), R('round','Rounding',.4,0,1),
    R('height','Height',.6,.05,1), S('align','Align',['Bottom','Centre','Top'],0), S('orient','Direction',['Vertical','Horizontal'],0), R('margin','Margin',.06,0,.3), R('y','Position',0,-.5,.5),
    S('colour','Colour',['Ink','By the column','By the colour column'],1), T('sort','Sort by value',false), T('follow','Reveal with the playhead',false),
    C('ink','Ink','#f4efe6','ink'), ...DV.colorParams(), ...Sketch.groundParams(0) ],
  draw(ctx, api){
    const P = api.params; let { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), col = Data.pick(P.value, 0, 'number', t), cs = Data.pick(P.shade, 1, 'number', t);
    if (!col) return;
    const N = Math.max(2, P.count | 0), style = P.style | 0, unit = Math.min(w, h) / 1000, u = P.follow ? Data.u(api) : 1;
    const val = Array.from({ length:N }, (_, j) => Data.norm(col, Data.at(col, (j + .5) / N)));
    const shade = P.colour === 2 && cs ? Array.from({ length:N }, (_, j) => Data.norm(cs, Data.at(cs, (j + .5) / N))) : val;
    const idx = val.map((_, j) => j); if (P.sort) idx.sort((a, b) => val[b] - val[a]);
    ctx.save();
    if (P.orient === 1){ ctx.translate(w, 0); ctx.rotate(Math.PI / 2); [w, h] = [h, w]; }
    const b = DV.box(P, w, h), bw = b.w / N, gap = style === 1 ? P.gap * .3 : P.gap, cw = Math.max(.5, bw * (1 - gap));
    const H = style === 1 ? b.h : b.h * P.height, yc = h / 2 - P.y * h;
    let px = null;
    idx.forEach((j, k) => {
      const vis = P.follow ? Util.clamp((u - k / N) * 20) : 1; if (vis <= 0) return;
      const v = val[j], x = b.x + k * bw + (bw - cw) / 2;
      const len = style === 1 ? H : Math.max(1 * unit, v * H);
      const y0 = P.align === 0 ? yc + H / 2 - len : P.align === 1 ? yc - len / 2 : yc - H / 2;
      ctx.globalAlpha = vis; ctx.fillStyle = ctx.strokeStyle = P.colour === 0 ? P.ink : DV.ramp(P, shade[j]);
      if (style === 3){ if (!px) px = [[x, y0 + len]]; px.push([x, y0], [x + cw, y0]); }
      else if (style === 2){ ctx.lineWidth = Math.max(1, cw * .22); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + cw / 2, y0 + len); ctx.lineTo(x + cw / 2, y0); ctx.stroke(); ctx.beginPath(); ctx.arc(x + cw / 2, y0, ctx.lineWidth * 1.4, 0, Sketch.TAU); ctx.fill(); }
      else { const r = style === 1 ? 0 : Math.min(cw / 2, len / 2) * P.round; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y0, cw, len, r) : ctx.rect(x, y0, cw, len); ctx.fill(); }
    });
    if (style === 3 && px){ const base = P.align === 0 ? yc + H / 2 : yc; ctx.globalAlpha = 1; ctx.fillStyle = P.colour === 0 ? P.ink : DV.ramp(P, .8); ctx.beginPath(); ctx.moveTo(px[0][0], base); px.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(px[px.length - 1][0], base); ctx.closePath(); ctx.fill(); }
    ctx.restore(); ctx.globalAlpha = 1;
  } });

FX.register({ id:'dv-rings', name:'Data rings', cat:'data', kind:'2d', nonLocal:true, search:['data', 'radial', 'circular'],
  desc:'Rows around a circle, radius by value. Petals, spikes, an area or dots, with up to three rings.',
  params:[ Col('a','Column 1',0), Col('b','Column 2',1), Col('c','Column 3',2), I('rings','Rings',1,1,3), S('style','Style',['Petals','Spikes','Area','Dots'],2), R('inner','Inner radius',.16,0,.6), R('reach','Reach',.3,.05,.6),
    R('smooth','Smoothing',.4,0,1), R('weight','Line weight',2.5,.5,12,.1), R('fill','Fill opacity',.45,0,1), T('mirror','Mirror left and right',false), I('spin','Rotations per loop',0,-4,4),
    R('x','Centre X',0,-1,1), R('y','Centre Y',0,-1,1), T('follow','Draw round with the playhead',false),
    S('colour','Colour',['Ink','Ink to accent','From palette'],1), C('c1','Ink','#f4efe6','ink'), C('c2','Accent','#ff5a36','accent'), ...Sketch.groundParams(0) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), R0 = Math.min(w, h), n = Math.max(1, P.rings | 0);
    const cols = [P.a, P.b, P.c].slice(0, n).map((nm, i) => Data.pick(nm, i, 'number', t)).filter(Boolean);
    if (!cols.length) return;
    const N = Math.min(Math.max(t.rows, 8), 360), unit = R0 / 1000, u = P.follow ? Data.u(api) : 1, style = P.style | 0;
    const cx = (.5 + P.x * .5) * w, cy = (.5 - P.y * .5) * h, spin = api.loop * Sketch.TAU * (P.spin | 0);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(spin - Math.PI / 2); ctx.lineJoin = ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, P.weight * unit * 1.6);
    cols.forEach((c, k) => {
      const s = DV.series(c, N, P.smooth), col = DV.tone(P, k, cols.length);
      const r0 = R0 * (P.inner + k * P.reach * .18), rr = R0 * P.reach;
      const shown = Math.max(2, Math.round(N * u)), ang = i => (P.mirror ? (i / (N - 1)) * Math.PI : (i / N) * Sketch.TAU), rad = i => r0 + s[i] * rr;
      const pt = (i, m) => { const a = ang(i) * (m ? -1 : 1); return [Math.cos(a) * rad(i), Math.sin(a) * rad(i)]; };
      ctx.fillStyle = ctx.strokeStyle = col;
      for (const m of P.mirror ? [0, 1] : [0]){
        const pts = []; for (let i = 0; i < shown; i++) pts.push(pt(i, m));
        if (style === 2){
          ctx.beginPath(); DV.trace(ctx, pts); if (!P.mirror) ctx.closePath(); ctx.globalAlpha = P.fill; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
        } else for (let i = 0; i < shown; i += style === 3 ? 1 : Math.max(1, Math.round(N / 120))){
          const a = ang(i) * (m ? -1 : 1), x0 = Math.cos(a) * r0, y0 = Math.sin(a) * r0, [x1, y1] = pt(i, m);
          if (style === 0){ ctx.globalAlpha = .55; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + Math.sin(a) * rr * .12, (y0 + y1) / 2 - Math.cos(a) * rr * .12, x1, y1); ctx.stroke(); ctx.globalAlpha = 1; }
          else if (style === 1){ ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
          else { ctx.globalAlpha = .55 + s[i] * .45; ctx.beginPath(); ctx.arc(x1, y1, ctx.lineWidth * (.7 + s[i] * 1.6), 0, Sketch.TAU); ctx.fill(); ctx.globalAlpha = 1; }
        }
      }
    });
    ctx.restore(); ctx.globalAlpha = 1;
  } });

FX.register({ id:'dv-grid', name:'Data grid', cat:'data', kind:'2d', nonLocal:true, search:['data', 'heatmap', 'calendar'],
  desc:'A table as a grid of marks: one column wrapped into rows, or every column as a row. Colour and size follow the values.',
  params:[ S('layout','Layout',['Wrap one column','One row per column'],0), Col('a','Column',0), Col('b','Size column',1), I('cols','Columns',24,2,90), I('lines','Columns to show',5,1,8),
    S('shape','Mark',['Square','Circle','Bar','Diamond'],1), R('gap','Gap',.14,0,.7), R('sizing','Size by second column',0,0,1), R('gamma','Contrast',1,.3,3), R('margin','Margin',.06,0,.3), T('follow','Reveal with the playhead',false),
    ...DV.colorParams(), ...Sketch.groundParams(0) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; Sketch.ground(ctx, api);
    const t = Data.current(), b = DV.box(P, w, h), u = P.follow ? Data.u(api) : 1;
    let cells = [], cols, rows;
    if ((P.layout | 0) === 1){
      const list = Data.usable(t, 'number').slice(0, Math.max(1, P.lines | 0)); if (!list.length) return;
      cols = Math.min(t.rows, 160); rows = list.length;
      list.forEach((c, r) => { for (let i = 0; i < cols; i++) cells.push({ v:Data.norm(c, Data.at(c, cols > 1 ? i / (cols - 1) : 0)), s:.7, r, i }); });
    } else {
      const c = Data.pick(P.a, 0, 'number', t), c2 = Data.pick(P.b, 1, 'number', t); if (!c) return;
      cols = Math.max(2, P.cols | 0); const N = Math.min(t.rows, 1500); rows = Math.ceil(N / cols);
      for (let i = 0; i < N; i++) cells.push({ v:Data.norm01(c, Math.floor(i * (t.rows - 1) / Math.max(1, N - 1))), s:c2 ? Data.norm01(c2, Math.floor(i * (t.rows - 1) / Math.max(1, N - 1))) : .7, r:Math.floor(i / cols), i:i % cols });
    }
    const cw = b.w / cols, ch = b.h / rows, m = Math.min(cw, ch), total = cells.length;
    cells.forEach((cell, k) => {
      const vis = P.follow ? Util.clamp((u - k / total) * 30) : 1; if (vis <= 0) return;
      const v = Math.pow(cell.v, P.gamma), sz = m * (1 - P.gap) * (1 - P.sizing + P.sizing * (.25 + cell.s * .75));
      const x = b.x + (cell.i + .5) * cw, y = b.y + (cell.r + .5) * ch;
      ctx.globalAlpha = vis; ctx.fillStyle = DV.ramp(P, v); ctx.beginPath();
      const shape = P.shape | 0;
      if (shape === 1) ctx.arc(x, y, sz / 2, 0, Sketch.TAU);
      else if (shape === 2) ctx.rect(x - sz / 2, y - ch * (1 - P.gap) / 2, sz, ch * (1 - P.gap));
      else if (shape === 3){ ctx.moveTo(x, y - sz / 2); ctx.lineTo(x + sz / 2, y); ctx.lineTo(x, y + sz / 2); ctx.lineTo(x - sz / 2, y); ctx.closePath(); }
      else ctx.rect(x - sz / 2, y - sz / 2, sz, sz);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  } });
