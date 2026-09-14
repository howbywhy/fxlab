/* ---------------- Kinetic type III ----------------
   Outline-level type (via Glyphs), variable axes, warps, specimens,
   particles and captions.
---------------------------------------------------- */

/* shared: fit + place a multi-line block and return glyph outlines positioned on the frame */
const TypeBlock = {
  cache:new Map(),
  get(ctx, P, text, w, h, o = {}){
    const mg = (o.margin ?? .1) * w, leading = o.leading ?? .95;
    const size = o.size || KT.fit(ctx, P, text, w - mg * 2, h - mg * 2, leading, o.tracking || 0);
    const key = [text, Util.family(P), P.weight, Math.round(size * 4), leading, o.tracking || 0, w, h, o.align ?? 1].join('|');
    let b = TypeBlock.cache.get(key);
    if (!b){
      const L = Glyphs.layout(ctx, P, text, size, { tracking:o.tracking || 0 });
      const pos = KT.place({ lines:L.lines }, { size, leading, cap:L.cap, align:o.align ?? 1, x:(o.align ?? 1) === 0 ? mg : (o.align ?? 1) === 2 ? w - mg : w / 2, y:h / 2 });
      const glyphs = [];
      L.lines.forEach((ln, li) => ln.glyphs.forEach((g, gi) => { if (g.space) return; glyphs.push({ ch:g.ch, li, gi, word:g.word, ox:pos[li].x + g.x, oy:pos[li].y, w:g.w, contours:g.contours }); }));
      b = { size, cap:L.cap, glyphs, lines:L.lines, pos };
      TypeBlock.cache.set(key, b); if (TypeBlock.cache.size > 40) TypeBlock.cache.delete(TypeBlock.cache.keys().next().value);
    }
    return b;
  },
};

/* ---- Morph ---- */
const morphCache = new Map();
FX.register({ id:'kt-morph', name:'Morph', cat:'type', kind:'2d', desc:'Words melt into one another, outline by outline. Letters split and merge when word lengths differ.',
  params:[ X('text','Words (one per line)','PLAY\nPAUSE\nREPEAT',true), F('font','Font'), S('weight','Weight',Util.weights,4), T('upper','Uppercase',true), R('margin','Margin',.1,0,.4), R('hold','Hold',.35,0,.9), S('easing','Easing',KT.EASES,4), I('detail','Outline detail',90,24,240),
    T('outline','Outline only',false), R('stroke','Line weight',1.2,.2,6), T('shift','Colour shift while morphing',true), C('ink','Ink','#e4e2dc'), C('accent','Morph colour','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const words = KT.text(P).split('\n').map(s => s.trim()).filter(Boolean); if (!words.length) return;
    const n = words.length, f = api.loop * n, i = Math.floor(f) % n, lt = f - Math.floor(f);
    const A = words[i], B = words[(i + 1) % n], E = KT.easeBy(P.easing);
    const e = n === 1 ? 0 : E(Util.clamp((lt - P.hold) / Math.max(.01, 1 - P.hold)));
    const mg = P.margin * w;
    const size = Math.min(...words.map(wd => KT.fit(ctx, P, wd, w - mg * 2, h - mg * 2)));
    const N = Math.max(24, P.detail | 0), key = [A, B, Util.family(P), P.weight, N].join('|');
    let slots = morphCache.get(key);
    if (!slots){ slots = buildMorph(ctx, P, A, B, N); morphCache.set(key, slots); if (morphCache.size > 24) morphCache.delete(morphCache.keys().next().value); }
    const k = size / 100, cx = w / 2, cy = h / 2;
    ctx.fillStyle = ctx.strokeStyle = P.shift ? KT.mixHex(P.ink, P.accent, Math.sin(e * Math.PI)) : P.ink;
    ctx.lineWidth = Math.max(1, size * .01 * P.stroke); ctx.lineJoin = 'round';
    if (e <= .001 || e >= .999){
      /* at rest: crisp native text */
      const word = e <= .001 ? A : B;
      ctx.font = KT.font(P, 100); const cap100 = KT.metrics(ctx, 100).cap; ctx.font = KT.font(P, size);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      P.outline ? ctx.strokeText(word, cx, cy + cap100 * k / 2) : ctx.fillText(word, cx, cy + cap100 * k / 2);
      return;
    }
    for (const slot of slots){
      const path = new Path2D();
      for (const pr of slot){
        const a = pr.a, b = pr.b;
        for (let j = 0; j < N; j++){ const x = cx + (a[j * 2] + (b[j * 2] - a[j * 2]) * e) * k, y = cy + (a[j * 2 + 1] + (b[j * 2 + 1] - a[j * 2 + 1]) * e) * k; j ? path.lineTo(x, y) : path.moveTo(x, y); }
        path.closePath();
      }
      P.outline ? ctx.stroke(path) : ctx.fill(path, 'evenodd');
    }
    function buildMorph(ctx, P, wa, wb, N){
      const lay = word => { const L = Glyphs.layout(ctx, P, word, 100), ln = L.lines[0], M = L.cap; return ln.glyphs.filter(g => !g.space).map(g => ({ contours:g.contours.map(c => { const o = new Float32Array(c.length); for (let q = 0; q < c.length; q += 2){ o[q] = c[q] + g.x - ln.width / 2; o[q + 1] = c[q + 1] + M / 2; } return o; }) })); };
      const ga = lay(wa), gb = lay(wb), M = Math.max(ga.length, gb.length, 1);
      const pick = (arr, s) => arr.length ? arr[arr.length === 1 ? 0 : Math.round(s * (arr.length - 1) / Math.max(1, M - 1))] : { contours:[] };
      const prep = g => g.contours.map(c => ({ pts:Glyphs.resample(c, N), area:Glyphs.area(c) })).sort((x, y) => Math.abs(y.area) - Math.abs(x.area));
      const out = [];
      for (let s = 0; s < M; s++){
        const ca = prep(pick(ga, s)), cb = prep(pick(gb, s)), pairs = [];
        const K = Math.max(ca.length, cb.length);
        for (let q = 0; q < K; q++){
          let a = ca[q], b = cb[q];
          const collapse = src => { const [x, y] = Glyphs.centroid(src.pts), o = new Float32Array(N * 2); for (let j = 0; j < N; j++){ o[j * 2] = x; o[j * 2 + 1] = y; } return { pts:o, area:0 }; };
          if (!a && !b) continue;
          if (!a) a = collapse(b); if (!b) b = collapse(a);
          let bp = b.pts;
          if (a.area && b.area && Math.sign(a.area) !== Math.sign(b.area)){ const r = new Float32Array(N * 2); for (let j = 0; j < N; j++){ r[j * 2] = bp[(N - 1 - j) * 2]; r[j * 2 + 1] = bp[(N - 1 - j) * 2 + 1]; } bp = r; }
          let best = 0, bd = Infinity;
          for (let off = 0; off < N; off++){ let d = 0; for (let j = 0; j < N; j += 3){ const jb = (j + off) % N; const dx = a.pts[j * 2] - bp[jb * 2], dy = a.pts[j * 2 + 1] - bp[jb * 2 + 1]; d += dx * dx + dy * dy; if (d > bd) break; } if (d < bd){ bd = d; best = off; } }
          const al = new Float32Array(N * 2); for (let j = 0; j < N; j++){ const jb = (j + best) % N; al[j * 2] = bp[jb * 2]; al[j * 2 + 1] = bp[jb * 2 + 1]; }
          pairs.push({ a:a.pts, b:al });
        }
        out.push(pairs);
      }
      return out;
    }
  } });

/* ---- Liquid ---- */
const liquidCache = new Map();
FX.register({ id:'kt-liquid', name:'Liquid type', cat:'type', kind:'2d', desc:'Outlines that wobble, boil like hand-drawn animation, melt and drip, wave, or push away from a moving magnet.', search:['distort'],
  params:[ ...KT.typeParams('LIQUID'), R('margin','Margin',.1,0,.4), R('leading','Leading',.95,.6,2), S('mode','Mode',['Wobble','Boil (hand-drawn)','Melt with timeline','Wave','Magnet']), R('amount','Amount',.5,0,2), R('scale','Noise scale',1,.2,4), I('speed','Loops per cycle',1,1,6), I('fps','Boil rate',12,2,30),
    T('outline','Outline only',false), R('stroke','Line weight',1.2,.2,6), C('ink','Ink','#e4e2dc'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P); if (!text.trim()) return;
    const B = TypeBlock.get(ctx, P, text, w, h, { margin:P.margin, leading:P.leading });
    const size = B.size, spacing = Math.max(1.5, size * .012);
    let res = liquidCache.get(B);
    if (!res){
      res = B.glyphs.map(g => g.contours.map(c => { const n = Math.max(16, Math.round(Glyphs.length(c) / spacing)); const r = Glyphs.resample(c, n); for (let j = 0; j < r.length; j += 2){ r[j] += g.ox; r[j + 1] += g.oy; } return r; }));
      liquidCache.set(B, res); if (liquidCache.size > 16) liquidCache.delete(liquidCache.keys().next().value);
    }
    const mode = P.mode | 0, amt = P.amount, sc = P.scale, TAU = KT.TAU, ph = api.loop * (P.speed | 0) * TAU;
    const top = h / 2 - (B.lines.length * size * P.leading) / 2, bottom = h - top;
    const step = Math.floor(api.t * P.fps), melt = 1 - KT.ease.inOut(Util.clamp(api.p));
    const fx = w / 2 + Math.sin(ph) * w * .35, fy = h / 2 + Math.cos(ph * 2) * B.cap * .4;
    ctx.fillStyle = ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(1, size * .01 * P.stroke); ctx.lineJoin = 'round';
    for (const glyph of res){
      const path = new Path2D();
      for (const c of glyph){
        for (let j = 0; j < c.length; j += 2){
          let x = c[j], y = c[j + 1]; const u = x / size, v = y / size;
          if (mode === 0){ x += Glyphs.noise(u * sc * 3 + Math.cos(ph) * 1.3, v * sc * 3 + Math.sin(ph) * 1.3) * amt * size * .05; y += Glyphs.noise(u * sc * 3 + 17 + Math.sin(ph) * 1.3, v * sc * 3 + Math.cos(ph) * 1.3) * amt * size * .05; }
          else if (mode === 1){ x += Glyphs.noise(u * sc * 7 + step * 7.13, v * sc * 7) * amt * size * .018; y += Glyphs.noise(u * sc * 7 + 31, v * sc * 7 + step * 5.71) * amt * size * .018; }
          else if (mode === 2){ const d = Math.pow(Math.max(0, Glyphs.noise(u * sc * 5, 3.7) * .5 + .5), 2.2), t = Util.clamp((y - top) / Math.max(1, bottom - top)); y += d * t * t * amt * size * 1.6 * melt; x += Glyphs.noise(u * 20, v * 3) * melt * amt * size * .01; }
          else if (mode === 3){ y += Math.sin(u * sc * 3 - ph) * amt * size * .08; x += Math.cos(v * sc * 4 - ph) * amt * size * .015; }
          else { const dx = x - fx, dy = y - fy, d = Math.hypot(dx, dy) || 1, f = Math.exp(-Math.pow(d / (size * .55), 2)) * amt * size * .28; x += dx / d * f; y += dy / d * f; }
          j ? path.lineTo(x, y) : path.moveTo(x, y);
        }
        path.closePath();
      }
      P.outline ? ctx.stroke(path) : ctx.fill(path, 'evenodd');
    }
  } });

/* ---- Outline dots ---- */
const dotsCache = new Map();
FX.register({ id:'kt-dots', name:'Outline dots', cat:'type', kind:'2d', desc:'Type traced in dots, dashes, crosses or stitches that travel around the letters, with optional halftone or hatch fill.',
  params:[ ...KT.typeParams('STITCH'), R('margin','Margin',.1,0,.4), R('leading','Leading',.95,.6,2), S('style','Marks',['Dots','Dashes','Crosses','Stitches']), R('spacing','Spacing',1,.3,4), R('mark','Mark size',.5,.1,1.5), I('speed','Loops per cycle',1,-6,6),
    S('fill','Fill',['None','Halftone dots','Hatch lines']), R('density','Fill density',1,.3,3), T('draw','Draw on with timeline',false), T('underlay','Faint outline underlay',false),
    C('ink','Marks','#e4e2dc'), C('accent','Fill','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P); if (!text.trim()) return;
    const B = TypeBlock.get(ctx, P, text, w, h, { margin:P.margin, leading:P.leading }), size = B.size;
    const gap = size * .035 * P.spacing, ms = size * .014 * P.mark * P.spacing, style = P.style | 0;
    const frac = ((api.loop * (P.speed | 0)) % 1 + 1) % 1, reveal = P.draw ? Util.clamp(api.p) : 1;
    const fullPath = new Path2D(); B.glyphs.forEach(g => fullPath.addPath(Glyphs.path(g.contours, g.ox, g.oy)));
    const fillMode = P.fill | 0;
    if (fillMode){
      ctx.save(); ctx.clip(fullPath, 'evenodd'); ctx.fillStyle = ctx.strokeStyle = P.accent; ctx.globalAlpha = reveal;
      const pitch = size * .045 / P.density;
      if (fillMode === 1){ for (let y = 0; y < h + pitch; y += pitch) for (let x = ((Math.round(y / pitch)) % 2) * pitch / 2; x < w + pitch; x += pitch){ const r = pitch * (.18 + .22 * (.5 + .5 * Math.sin(x / w * 6 + y / h * 4 - api.loop * KT.TAU))); ctx.beginPath(); ctx.arc(x, y, r, 0, KT.TAU); ctx.fill(); } }
      else { ctx.lineWidth = Math.max(1, pitch * .22); ctx.beginPath(); const off = frac * pitch; for (let d = -h - pitch + off; d < w + h; d += pitch){ ctx.moveTo(d, 0); ctx.lineTo(d + h, h); } ctx.stroke(); }
      ctx.restore();
    }
    if (P.underlay){ ctx.strokeStyle = P.ink; ctx.globalAlpha = .18; ctx.lineWidth = 1; ctx.stroke(fullPath); ctx.globalAlpha = 1; }
    ctx.fillStyle = ctx.strokeStyle = P.ink; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, ms * .9);
    for (const g of B.glyphs) for (const c of g.contours){
      const L = Glyphs.length(c), n = Math.max(3, Math.round(L / gap)), stp = L / n, m = c.length;
      const shown = Math.floor(n * reveal);
      let seg = 0, acc = 0, i0 = 0;
      for (let k = 0; k < shown; k++){
        const target = (k + frac) * stp;
        let j = (i0 + 2) % m; seg = Math.hypot(c[j] - c[i0], c[j + 1] - c[i0 + 1]);
        while (acc + seg < target && i0 < m - 2){ acc += seg; i0 += 2; j = (i0 + 2) % m; seg = Math.hypot(c[j] - c[i0], c[j + 1] - c[i0 + 1]); }
        const t = seg > 0 ? (target - acc) / seg : 0;
        const x = g.ox + c[i0] + (c[j] - c[i0]) * t, y = g.oy + c[i0 + 1] + (c[j + 1] - c[i0 + 1]) * t;
        const tx = (c[j] - c[i0]) / (seg || 1), ty = (c[j + 1] - c[i0 + 1]) / (seg || 1);
        if (style === 0){ ctx.beginPath(); ctx.arc(x, y, ms, 0, KT.TAU); ctx.fill(); }
        else if (style === 1){ const l = stp * .32; ctx.beginPath(); ctx.moveTo(x - tx * l, y - ty * l); ctx.lineTo(x + tx * l, y + ty * l); ctx.stroke(); }
        else if (style === 2){ const l = ms * 1.3; ctx.beginPath(); ctx.moveTo(x - l, y - l); ctx.lineTo(x + l, y + l); ctx.moveTo(x + l, y - l); ctx.lineTo(x - l, y + l); ctx.stroke(); }
        else { const l = stp * .38, nx = -ty, ny = tx; ctx.beginPath(); ctx.moveTo(x - tx * l - nx * ms, y - ty * l - ny * ms); ctx.lineTo(x + tx * l + nx * ms, y + ty * l + ny * ms); ctx.stroke(); }
      }
    }
  } });

/* ---- Inline & neon ---- */
FX.register({ id:'kt-inline', name:'Inline & neon', cat:'type', kind:'2d', desc:'Concentric inline strokes that pulse outward, glowing neon tubes that flicker, or a retro stacked shadow.',
  params:[ ...KT.typeParams('INLINE'), R('margin','Margin',.12,0,.4), R('leading','Leading',1,.6,2), S('style','Style',['Inline stack','Neon','Retro shadow']), I('lines','Lines',4,1,12), R('gap','Line spacing',1,.3,3), S('motion','Motion',['None','Pulse outward','Flicker']), I('speed','Loops per cycle',1,1,6),
    C('ink','Ink','#e4e2dc'), C('accent','Accent','#ff5a36'), C('accent2','Second accent','#c9f5e4'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P); if (!text.trim()) return;
    const style = P.style | 0, lines = Math.max(1, P.lines | 0);
    const mg = P.margin * w, size = KT.fit(ctx, P, text, w - mg * 2 - (style === 2 ? lines * w * .012 : 0), h - mg * 2, P.leading);
    ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size);
    const Lx = KT.layout(ctx, text, { font:ctx.font, size, tracking:0 }), pos = KT.place(Lx, { size, leading:P.leading, cap:M.cap, align:1, x:w / 2, y:h / 2 });
    const bg = (P.ground | 0) === 1 ? P.bg : '#141516';
    const each = fn => Lx.lines.forEach((ln, i) => fn(ln.str, pos[i].x, pos[i].y));
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    const stepW = size * .018 * P.gap, motion = P.motion | 0;
    if (style === 0){
      const ph = motion === 1 ? ((api.loop * P.speed) % 1) * 2 : 0;
      for (let k = lines + 2; k >= 0; k--){
        const r = (k + ph % 2) * stepW; if (r <= 0) continue;
        const band = k % 2 === 0; if (k > lines + ph){ continue; }
        ctx.lineWidth = r * 2; ctx.strokeStyle = band ? P.ink : bg;
        if (motion === 1) ctx.globalAlpha = Util.clamp(lines + 1 - (k + ph)) ;
        each((s, x, y) => ctx.strokeText(s, x, y)); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = P.accent; each((s, x, y) => ctx.fillText(s, x, y));
    } else if (style === 1){
      const step = Math.floor(api.t * 14);
      const on = motion === 2 ? (KT.rnd(step, 3) > .12 ? 1 : .25) : 1;
      ctx.shadowColor = P.accent; ctx.lineWidth = Math.max(1.5, size * .03);
      [[28, .5], [12, .8]].forEach(([blur, a]) => { ctx.shadowBlur = size * blur / 200; ctx.globalAlpha = a * on; ctx.strokeStyle = P.accent; each((s, x, y) => ctx.strokeText(s, x, y)); });
      ctx.shadowBlur = 0; ctx.globalAlpha = on; ctx.lineWidth = Math.max(1, size * .01); ctx.strokeStyle = P.accent2; each((s, x, y) => ctx.strokeText(s, x, y));
      ctx.globalAlpha = 1;
    } else {
      const ang = motion === 1 ? api.loop * KT.TAU * P.speed : Math.PI / 4, d = stepW * 1.4;
      for (let k = lines; k >= 1; k--){ ctx.fillStyle = k % 2 ? P.accent : P.accent2; each((s, x, y) => ctx.fillText(s, x + Math.cos(ang) * d * k, y + Math.sin(ang) * d * k)); }
      ctx.fillStyle = P.ink; each((s, x, y) => ctx.fillText(s, x, y));
      ctx.lineWidth = Math.max(1, size * .008); ctx.strokeStyle = bg; each((s, x, y) => ctx.strokeText(s, x, y));
    }
  } });

/* ---- Shatter ---- */
FX.register({ id:'kt-shatter', name:'Shatter', cat:'type', kind:'2d', desc:'Letters break into shards that fly apart and snap back together.',
  params:[ ...KT.typeParams('SHATTER'), R('margin','Margin',.1,0,.4), R('leading','Leading',.95,.6,2), I('shards','Shard density',4,2,12), R('force','Force',1,0,3), R('spin','Spin',1,0,3), S('drive','Motion',['Assemble with timeline','Explode with timeline','Burst & return (loop)']), S('origin','Direction',['From centre','Upward','Sideways']), T('gravity','Gravity',true), S('easing','Easing',KT.EASES,4),
    C('ink','Ink','#e4e2dc'), C('accent','Shard tint','#ff5a36'), R('tint','Tinted shards',.25,0,1), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P); if (!text.trim()) return;
    const mg = P.margin * w, size = KT.fit(ctx, P, text, w - mg * 2, h - mg * 2, P.leading);
    ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size);
    const Lx = KT.layout(ctx, text, { font:ctx.font, size, tracking:0 }), pos = KT.place(Lx, { size, leading:P.leading, cap:M.cap, align:1, x:w / 2, y:h / 2 });
    const E = KT.easeBy(P.easing), drive = P.drive | 0;
    let e = drive === 0 ? E(api.p) : drive === 1 ? 1 - E(api.p) : 1 - Math.pow(Math.sin(api.loop * Math.PI), 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    if (e >= .999){ ctx.fillStyle = P.ink; Lx.lines.forEach((ln, i) => ctx.fillText(ln.str, pos[i].x, pos[i].y)); return; }
    const d = 1 - e, cols = Math.max(2, P.shards | 0);
    let gi = 0;
    Lx.lines.forEach((ln, li) => ln.glyphs.forEach(g => {
      if (g.space) return; gi++;
      const gx = pos[li].x + g.x, gy = pos[li].y, bw = g.w + size * .1, bh = M.cap + M.desc + size * .2;
      const rows = Math.max(2, Math.round(cols * bh / Math.max(1, bw)));
      const vx = (i, j) => gx - size * .05 + bw * (i + (i > 0 && i < cols ? (KT.rnd(gi * 131 + i * 7 + j * 13, 1) - .5) * .8 : 0)) / cols;
      const vy = (i, j) => gy - M.cap - size * .1 + bh * (j + (j > 0 && j < rows ? (KT.rnd(gi * 71 + i * 17 + j * 3, 2) - .5) * .8 : 0)) / rows;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++){
        const p00 = [vx(i, j), vy(i, j)], p10 = [vx(i + 1, j), vy(i + 1, j)], p01 = [vx(i, j + 1), vy(i, j + 1)], p11 = [vx(i + 1, j + 1), vy(i + 1, j + 1)];
        const flip = KT.rnd(gi + i * 3 + j * 5, 4) > .5;
        const tris = flip ? [[p00, p10, p11], [p00, p11, p01]] : [[p00, p10, p01], [p10, p11, p01]];
        tris.forEach((tri, t) => {
          const id = gi * 1000 + j * 50 + i * 2 + t;
          const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
          const o = P.origin | 0;
          let dx = cx - w / 2, dy = cy - h / 2; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
          if (o === 1){ dx = (KT.rnd(id, 5) - .5) * .8; dy = -1; } else if (o === 2){ dx = cx < w / 2 ? -1 : 1; dy = (KT.rnd(id, 5) - .5) * .8; }
          dx += (KT.rnd(id, 6) - .5) * .9; dy += (KT.rnd(id, 7) - .5) * .9;
          const dist = P.force * size * (1 + KT.rnd(id, 8) * 2.2) * d;
          const ox = dx * dist, oy = dy * dist + (P.gravity ? d * d * size * 1.5 * P.force : 0), rot = (KT.rnd(id, 9) - .5) * 6 * P.spin * d;
          ctx.save(); ctx.translate(cx + ox, cy + oy); ctx.rotate(rot); ctx.translate(-cx, -cy);
          ctx.beginPath(); ctx.moveTo(tri[0][0], tri[0][1]); ctx.lineTo(tri[1][0], tri[1][1]); ctx.lineTo(tri[2][0], tri[2][1]); ctx.closePath(); ctx.clip();
          ctx.fillStyle = KT.rnd(id, 10) < P.tint * d * 2 ? P.accent : P.ink; ctx.fillText(g.ch, gx, gy); ctx.restore();
        });
      }
    }));
  } });

/* ---- Type warp (GLSL) ---- */
FX.register({ id:'kt-warp', name:'Type warp', cat:'type', desc:'Bend type: arch, bulge, flag, twist, fisheye, perspective, ripple, squeeze, or wrap it into a ring.', search:['distort'],
  params:[ ...KT.typeParams('WARPED\nTYPE'), R('margin','Margin',.1,0,.4), R('leading','Leading',.92,.6,2), S('mode','Warp',['Arch','Bulge','Flag','Twist','Fisheye','Perspective','Ripple','Squeeze','Ring']), R('amount','Amount',.6,-1.5,1.5), S('drive','Motion',['Static','Flatten with timeline','Loop wave']), R('freq','Frequency',1,.25,4), I('speed','Loops per cycle',1,0,6), R('ringSize','Ring radius',.36,.1,.5),
    S('fill','Fill',['Ink','Image B','Image A','Gradient']), C('ink','Ink','#e4e2dc'), C('accent','Gradient end','#ff5a36'), ...KT.groundParams(1) ],
  auxSize(P, w, h){ const s = Math.min(1, Math.max(1800, Engine.auxCap) / Math.max(w, h)); return [Math.round(w * s), Math.round(h * s)]; },
  aux(ctx, P, w, h){
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const text = KT.text(P); if (!text.trim()) return [0, 0, 0, 0];
    const ring = (P.mode | 0) === 8;
    const txt = ring ? text.replace(/\n/g, '  ') + '  ' : text;
    const mg = P.margin * w, size = KT.fit(ctx, P, txt, w - (ring ? 0 : mg * 2), h - mg * 2, P.leading);
    const font = KT.font(P, size); ctx.font = font;
    const L = KT.layout(ctx, txt, { font, size, tracking:0 }), M = KT.metrics(ctx, size);
    const pos = KT.place(L, { size, leading:P.leading, cap:M.cap, align:1, x:w / 2, y:h / 2 });
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    L.lines.forEach((ln, i) => ln.glyphs.forEach(g => ctx.fillText(g.ch, pos[i].x + g.x, pos[i].y)));
    const bh = (L.lines.length - 1) * size * P.leading + M.cap + M.desc;
    return [L.maxWidth / w, (bh + size * .15) / h, 0, 0];
  },
  fs:`vec4 fx(vec2 uv){
  vec3 base = mix(texture(uInput, uv).rgb, p_bg, p_ground < .5 ? 0. : p_bg_a);
  float amt = p_amount * (p_drive < .5 ? 1. : p_drive < 1.5 ? (1. - uProgress) : sin(uLoop * TAU));
  float t = uLoop * TAU * p_speed;
  vec2 c = centered(uv), q = uv;
  int m = int(p_mode + .5);
  if (m == 0) q.y -= amt * .22 * (1. - pow(2. * uv.x - 1., 2.));
  else if (m == 1){ float k = 1. + amt * (1. - pow(2. * uv.x - 1., 2.)); q.y = .5 + (uv.y - .5) / max(k, .05); }
  else if (m == 2){ q.y += amt * .05 * sin(uv.x * TAU * p_freq - t); q.x += amt * .012 * sin(uv.y * TAU * p_freq - t); }
  else if (m == 3){ float r = length(c); vec2 d = rot(amt * 3. * (1. - smoothstep(0., .75, r))) * c; q = d / vec2(aspect(), 1.) + .5; }
  else if (m == 4){ float r = length(c); vec2 dir = c / max(r, 1e-5); float nr = pow(r * 1.6, 1. + amt * .8) / 1.6; q = dir * nr / vec2(aspect(), 1.) + .5; }
  else if (m == 5){ float z = 1. + amt * (uv.y - .5) * 1.6; q = vec2(.5 + (uv.x - .5) / max(z, .05), .5 + (uv.y - .5) * (1. + abs(amt) * .15)); }
  else if (m == 6){ float r = length(c); q = uv + (c / max(r, 1e-4)) * amt * .02 * sin(r * 30. * p_freq - t) / vec2(aspect(), 1.); }
  else if (m == 7){ q.x = .5 + (uv.x - .5) / max(.05, 1. + amt * .5 * sin(uv.y * TAU * p_freq + t)); }
  else {
    float r = length(c), a = atan(c.y, c.x);
    float R = p_ringSize, band = max(uAuxInfo.y, .02) * (1. + amt * .5) * .5;
    float tw = max(uAuxInfo.x, .02);
    q.x = .5 + (fract(-a / TAU + .25 + uLoop * p_speed * sign(p_amount + 1e-4)) - .5) * tw;
    q.y = .5 + (r - R) / band * uAuxInfo.y * .5;
  }
  float mask = (any(lessThan(q, vec2(0.))) || any(greaterThan(q, vec2(1.)))) ? 0. : texture(uAux, q).r;
  vec3 ink = p_fill < .5 ? p_ink : p_fill < 1.5 ? texture(uB, uv).rgb : p_fill < 2.5 ? texture(uA, uv).rgb : mix(p_ink, p_accent, clamp(q.y, 0., 1.));
  return vec4(mix(base, ink, mask), 1.);
}` });

/* ---- Variable axes ---- */
FX.register({ id:'kt-axes', name:'Variable axes', cat:'type', kind:'2d', desc:'Weight, width and slant waves through the letters. Uses real variable-font axes when the font has them; otherwise imitates them.',
  params:[ ...KT.typeParams('VARIABLE'), R('margin','Margin',.08,0,.4), I('rows','Rows',1,1,8), S('pattern','Pattern',['Wave across letters','All together','Random pulses','Velocity sweep']), R('waves','Waves',1,.25,4), I('speed','Loops per cycle',1,1,6), R('rowPhase','Row offset',.25,0,1),
    R('minW','Lightest weight',100,100,900,1), R('maxW','Heaviest weight',900,100,1000,1), R('widthAmt','Width change',.5,0,1), T('inverse','Heavier letters narrower',true), R('slantAmt','Slant',.3,0,1),
    C('ink','Ink','#e4e2dc'), C('accent','Alternate rows','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P).split('\n')[0]; if (!text.trim()) return;
    const ax = Glyphs.axes(P), fam = Util.family(P), rows = Math.max(1, P.rows | 0), mg = P.margin * w, chars = [...text], n = chars.length;
    const hasStretch = 'fontStretch' in ctx;
    const SK = [['ultra-condensed', .5], ['extra-condensed', .625], ['condensed', .75], ['semi-condensed', .875], ['normal', 1], ['semi-expanded', 1.125], ['expanded', 1.25], ['extra-expanded', 1.5], ['ultra-expanded', 2]];
    ctx.font = `${P.maxW} 100px ${fam}`; const natural = ctx.measureText(text).width || 1;
    let size = 100 * (w - mg * 2) / (natural * (1 + P.widthAmt * .5));
    ctx.font = `400 ${size}px ${fam}`; const M = KT.metrics(ctx, size), rowH = (h - mg * 2) / rows;
    if (M.cap > rowH * .75) size *= rowH * .75 / M.cap;
    const capH = M.cap * size / (size || 1);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    for (let r = 0; r < rows; r++){
      const y = mg + rowH * (r + .5) + capH / 2, pat = P.pattern | 0;
      const phase = api.loop * P.speed - r * P.rowPhase;
      const sweep = Math.sin(phase * KT.TAU), vel = Math.cos(phase * KT.TAU);
      const items = chars.map((ch, i) => {
        let k;
        if (pat === 0) k = .5 + .5 * Math.sin(KT.TAU * (phase - (i + .5) / n * P.waves));
        else if (pat === 1) k = .5 + .5 * Math.sin(KT.TAU * phase);
        else if (pat === 2) k = Math.pow(Math.max(0, Math.sin(KT.TAU * (phase + KT.rnd(i + r * 31, 4)))), 6);
        else k = Math.abs(vel);
        const wt = Math.round(P.minW + (P.maxW - P.minW) * k);
        const sx = 1 + P.widthAmt * .5 * (P.inverse ? (1 - 2 * k) : (2 * k - 1));
        const sl = pat === 3 ? -vel * P.slantAmt * .35 * Identity.slant() : P.slantAmt * .3 * (2 * k - 1);
        ctx.font = `400 ${size}px ${fam}`; if (hasStretch) ctx.fontStretch = 'normal';
        const baseW = ctx.measureText(ch).width;
        ctx.font = `${ax.wght ? wt : 400} ${size}px ${fam}`;
        let kw = 'normal', scale = sx;
        if (ax.wdth && hasStretch){ kw = SK.reduce((a, b) => Math.abs(b[1] - sx) < Math.abs(a[1] - sx) ? b : a)[0]; ctx.fontStretch = kw; const ww = ctx.measureText(ch).width || 1; ctx.fontStretch = 'normal'; ctx.font = `${ax.wght ? wt : 400} ${size}px ${fam}`; ctx.fontStretch = 'normal'; scale = baseW * sx / (ww || 1); }
        const adv = (ax.wdth ? baseW * sx : (ctx.measureText(ch).width) * sx);
        return { ch, wt, kw, scale, sl, adv, k };
      });
      const total = items.reduce((a, b) => a + b.adv, 0);
      let x = (w - total) / 2 + (pat === 3 ? sweep * w * .08 : 0);
      ctx.fillStyle = ctx.strokeStyle = r % 2 ? P.accent : P.ink;
      items.forEach(it => {
        ctx.save();
        ctx.font = `${ax.wght ? it.wt : 400} ${size}px ${fam}`; if (hasStretch) ctx.fontStretch = it.kw;
        ctx.translate(x, y); ctx.transform(1, 0, -it.sl, 1, 0, 0); ctx.scale(it.scale, 1);
        ctx.fillText(it.ch, 0, 0);
        if (!ax.wght && it.wt > 420){ ctx.lineWidth = (it.wt - 400) / 600 * size * .055 / it.scale; ctx.lineJoin = 'round'; ctx.strokeText(it.ch, 0, 0); }
        ctx.restore(); if (hasStretch) ctx.fontStretch = 'normal';
        x += it.adv;
      });
    }
  } });

/* ---- Type specimen ---- */
FX.register({ id:'kt-specimen', name:'Type specimen', cat:'type', kind:'2d', desc:'A living specimen: big glyphs with metric lines and outline points, the character set, a weight or size waterfall and a pangram.',
  params:[ F('font','Font'), S('weight','Weight',Util.weights,3), X('glyphs','Feature glyphs','Aa'), X('title','Title (blank = font name)',''), X('pangram','Pangram','Sphinx of black quartz, judge my vow.'), T('metrics','Metric lines',true), T('points','Outline points',true), T('charset','Character set',true), T('waterfall','Weights / sizes',true),
    I('speed','Highlight loops per cycle',1,0,6), S('easing','Easing',KT.EASES,4), C('ink','Ink','#e4e2dc'), C('accent','Accent','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const E = KT.easeBy(P.easing), mn = Math.min(w, h), mg = mn * .07, land = w > h * 1.1, fam = Util.family(P), wt = Util.weights[P.weight | 0];
    const a = Assets.get(P.font), name = (P.title && P.title.trim()) || (a ? a.name : String(P.font));
    const mono = s => `500 ${s}px ${Util.fonts[2]}`;
    const steps = []; const add = fn => steps.push(fn);
    const labS = Math.max(9, mn * .018);
    /* header */
    add(e => { ctx.font = `${wt} ${mn * .045}px ${fam}`; ctx.fillStyle = P.ink; ctx.globalAlpha = e; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(name, mg, mg); ctx.font = mono(labS); ctx.fillStyle = P.accent; ctx.fillText('TYPE SPECIMEN', mg, mg + mn * .06); ctx.textAlign = 'right'; ctx.fillText(a ? (a.file || '').toUpperCase() : 'SYSTEM FONT', w - mg, mg + mn * .06); });
    /* big glyphs */
    const areaX = mg, areaY = mg + mn * .12, areaW = land ? w * .5 - mg : w - mg * 2, areaH = land ? h - areaY - mg - mn * .08 : h * .4;
    const gtxt = P.glyphs || 'Aa';
    let gs = KT.fit(ctx, { ...P }, gtxt, areaW * .9, areaH * .75, 1);
    ctx.font = `${wt} ${gs}px ${fam}`;
    const mH = ctx.measureText('H').actualBoundingBoxAscent, mx = ctx.measureText('x').actualBoundingBoxAscent, md = ctx.measureText('d').actualBoundingBoxAscent, mp = ctx.measureText('p').actualBoundingBoxDescent;
    const base = areaY + (areaH + mH) / 2 + areaH * .02, gx = areaX + (areaW - ctx.measureText(gtxt).width) / 2;
    if (P.metrics){
      const raw = [['ASCENDER', base - md], ['CAP HEIGHT', base - mH], ['X-HEIGHT', base - mx], ['BASELINE', base], ['DESCENDER', base + mp]];
      const merged = []; raw.forEach(([lab, y]) => { const hit = merged.find(m => Math.abs(m[1] - y) < labS * 1.3); if (hit){ if (lab === 'BASELINE') hit[0] = 'BASELINE'; else if (hit[0] !== 'BASELINE') hit[0] += ' / ' + lab; } else merged.push([lab, y]); });
      merged.forEach(([lab, y], i) => add(e => { i = lab === 'BASELINE' ? 3 : i === 3 ? 2 : i;
        ctx.fillStyle = i === 3 ? P.accent : P.ink; ctx.globalAlpha = i === 3 ? 1 : .45; ctx.fillRect(areaX, y, areaW * e, Math.max(1, mn * .0016));
        ctx.globalAlpha = e; ctx.font = mono(labS * .85); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillStyle = i === 3 ? P.accent : P.ink; ctx.fillText(lab, areaX + areaW, y - labS * .25);
      }));
    }
    add(e => { ctx.font = `${wt} ${gs}px ${fam}`; ctx.fillStyle = P.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = e; ctx.fillText(gtxt, gx, base + (1 - e) * gs * .05); });
    if (P.points){
      add(e => {
        const Lg = Glyphs.layout(ctx, P, gtxt, gs, { weight:wt }).lines[0];
        ctx.strokeStyle = P.accent; ctx.fillStyle = P.accent; ctx.lineWidth = Math.max(1, mn * .0015);
        const ps = Math.max(2, mn * .005);
        Lg.glyphs.forEach(g => { const path = Glyphs.path(g.contours, gx + g.x, base); ctx.globalAlpha = .8 * e; ctx.stroke(path);
          g.contours.forEach(c => { const cnt = Math.floor(c.length / 2 * e); for (let j = 0; j < cnt; j += 1){ ctx.globalAlpha = 1; ctx.fillRect(gx + g.x + c[j * 2] - ps / 2, base + c[j * 2 + 1] - ps / 2, ps, ps); } }); });
      });
    }
    /* charset */
    const setX = land ? w * .5 + mg * .5 : mg, setY = land ? areaY : areaY + areaH + mn * .05, setW = land ? w * .5 - mg * 1.5 : w - mg * 2;
    let belowSet = setY;
    if (P.charset){
      const chars = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&?!@#%'];
      const cols = land ? 12 : 16, cell = setW / cols, rows = Math.ceil(chars.length / cols);
      const hot = Math.floor(api.loop * (P.speed | 0) * chars.length) % chars.length;
      chars.forEach((ch, i) => add(e => {
        const x = setX + (i % cols) * cell, y = setY + Math.floor(i / cols) * cell;
        const isHot = (P.speed | 0) > 0 && i === hot;
        if (isHot){ ctx.fillStyle = P.accent; ctx.globalAlpha = e; ctx.fillRect(x, y, cell, cell); }
        ctx.globalAlpha = e; ctx.font = `${wt} ${cell * .62}px ${fam}`; ctx.fillStyle = isHot ? Identity.readable(P.accent) : P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, x + cell / 2, y + cell / 2 + cell * .04);
      }));
      belowSet = setY + rows * cell + mn * .03;
    }
    /* waterfall */
    if (P.waterfall){
      const ax = Glyphs.axes(P), wy = belowSet;
      add(e => {
        ctx.globalAlpha = e; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = P.ink;
        let x = setX; const hgt = mn * .07;
        if (ax.wght){ [100, 200, 300, 400, 500, 600, 700, 800, 900].forEach(v => { ctx.font = `${v} ${hgt}px ${fam}`; const s = 'Aa'; if (x + ctx.measureText(s).width < setX + setW){ ctx.fillText(s, x, wy + hgt); } x += ctx.measureText(s).width + hgt * .25; }); ctx.font = mono(labS * .85); ctx.fillStyle = P.accent; ctx.fillText('VARIABLE WEIGHT 100–900', setX, wy + hgt + labS * 1.6); }
        else { [.25, .35, .5, .7, 1].forEach(sz => { ctx.font = `${wt} ${hgt * sz}px ${fam}`; const s = 'Aa'; ctx.fillText(s, x, wy + hgt); x += ctx.measureText(s).width + hgt * .3; }); ctx.font = mono(labS * .85); ctx.fillStyle = P.accent; ctx.fillText('SIZE WATERFALL', setX, wy + hgt + labS * 1.6); }
      });
      belowSet = wy + mn * .07 + labS * 3;
    }
    /* pangram */
    add(e => {
      const ps = mn * .032; ctx.font = `${wt} ${ps}px ${fam}`; const lines = KT.wrap(ctx, P.pangram, setW);
      const py = Math.max(belowSet, h - mg - lines.length * ps * 1.25);
      ctx.fillStyle = P.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      lines.forEach((ln, i) => KT.rise(ctx, e, py + i * ps * 1.25 - ps * .1, ps * 1.3, () => ctx.fillText(ln, setX, py + i * ps * 1.25)));
    });
    const n = steps.length;
    steps.forEach((fn, i) => { const lp = KT.stagger(api.p, i, n, .85); if (lp > 0){ ctx.save(); fn(E(lp)); ctx.restore(); } });
  } });

/* ---- Dust ---- */
const dustCache = new Map();
FX.register({ id:'kt-dust', name:'Dust', cat:'type', kind:'2d', desc:'Type dissolves into drifting particles and gathers back, swept by wind, rising, falling or exploding.',
  params:[ ...KT.typeParams('DISSOLVE'), R('margin','Margin',.1,0,.4), R('leading','Leading',.95,.6,2), R('grain','Grain',3,1.5,10,.1), S('direction','Direction',['Wind right','Wind left','Rise','Fall','Explode']), S('order','Order',['Sweep','Random','Centre out']), R('spread','Spread',.7,0,1), R('turbulence','Turbulence',.6,0,2), R('distance','Distance',1,.2,3),
    S('drive','Motion',['Gather with timeline','Dissolve with timeline']), S('shape','Grain shape',['Square','Round']), S('easing','Easing',KT.EASES,4), T('fade','Fade in flight',true),
    C('ink','Ink','#e4e2dc'), C('accent','In flight','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P); if (!text.trim()) return;
    const sp = Math.max(1.5, P.grain * w / 1080), key = [text, Util.family(P), P.weight, P.margin, P.leading, w, h, sp.toFixed(2)].join('|');
    let pts = dustCache.get(key);
    if (!pts){
      const c = document.createElement('canvas'), cw = Math.ceil(w / sp), ch = Math.ceil(h / sp); c.width = cw; c.height = ch;
      const x = c.getContext('2d', { willReadFrequently:true }); x.scale(1 / sp, 1 / sp);
      const mg = P.margin * w, size = KT.fit(x, P, text, w - mg * 2, h - mg * 2, P.leading); x.font = KT.font(P, size);
      const M = KT.metrics(x, size), L = KT.layout(x, text, { font:x.font, size, tracking:0 }), pos = KT.place(L, { size, leading:P.leading, cap:M.cap, align:1, x:w / 2, y:h / 2 });
      x.fillStyle = '#fff'; x.textBaseline = 'alphabetic'; L.lines.forEach((ln, i) => x.fillText(ln.str, pos[i].x, pos[i].y));
      const d = x.getImageData(0, 0, cw, ch).data; pts = [];
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) if (d[(j * cw + i) * 4 + 3] > 120) pts.push((i + .5) * sp, (j + .5) * sp, KT.rnd(i * 7 + j * 131, 3));
      pts = Float32Array.from(pts); dustCache.set(key, pts); if (dustCache.size > 8) dustCache.delete(dustCache.keys().next().value);
    }
    const E = KT.easeBy(P.easing), formed = (P.drive | 0) === 0 ? E(api.p) : 1 - E(api.p), dis = 1 - formed;
    const dir = P.direction | 0, ord = P.order | 0, spread = P.spread, D = P.distance * Math.max(w, h) * .55, tb = P.turbulence * Math.min(w, h) * .12;
    const round = (P.shape | 0) === 1, s = sp * .92;
    const flying = [];
    ctx.fillStyle = P.ink;
    for (let k = 0; k < pts.length; k += 3){
      const hx = pts[k], hy = pts[k + 1], r = pts[k + 2];
      const o = ord === 0 ? (dir === 1 ? 1 - hx / w : dir === 2 ? hy / h : dir === 3 ? 1 - hy / h : hx / w) : ord === 1 ? r : Math.hypot(hx - w / 2, hy - h / 2) / Math.hypot(w / 2, h / 2);
      const local = Util.clamp(dis * (1 + spread) - (1 - o) * spread);
      if (local <= .001){ if (round){ ctx.beginPath(); ctx.arc(hx, hy, s / 2, 0, KT.TAU); ctx.fill(); } else ctx.fillRect(hx - s / 2, hy - s / 2, s, s); continue; }
      const l2 = local * local;
      let dx = 0, dy = 0;
      if (dir === 0) dx = l2 * D; else if (dir === 1) dx = -l2 * D; else if (dir === 2) dy = -l2 * D; else if (dir === 3) dy = l2 * D;
      else { const ex = hx - w / 2, ey = hy - h / 2, el = Math.hypot(ex, ey) || 1; dx = ex / el * l2 * D * (.5 + r); dy = ey / el * l2 * D * (.5 + r); }
      dx += Glyphs.noise(hx * .006 + local * 2, hy * .006 + r * 9) * tb * local * 2;
      dy += Glyphs.noise(hy * .006 + 11 + local * 2, hx * .006) * tb * local * 2;
      flying.push(hx + dx, hy + dy, P.fade ? 1 - l2 : 1);
    }
    ctx.fillStyle = P.accent;
    for (let k = 0; k < flying.length; k += 3){
      ctx.globalAlpha = flying[k + 2]; if (ctx.globalAlpha <= .01) continue;
      if (round){ ctx.beginPath(); ctx.arc(flying[k], flying[k + 1], s / 2, 0, KT.TAU); ctx.fill(); } else ctx.fillRect(flying[k] - s / 2, flying[k + 1] - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  } });

/* ---- Captions ---- */
FX.register({ id:'kt-captions', name:'Captions', cat:'type', kind:'2d', desc:'Social-video captions: a few words at a time with the spoken word highlighted, timed across the loop.',
  params:[ X('text','Transcript','Every rally starts with a single serve and ends with a story you tell for weeks',true), I('perCard','Words per card',3,1,8), F('font','Font'), S('weight','Weight',Util.weights,4), T('upper','Uppercase',true),
    S('position','Position',['Lower','Centre','Upper']), R('size','Size',7,2,20,.1), R('width','Max width',.84,.3,1), S('highlight','Highlight',['Colour','Box','Pop','Underline','Words appear']), S('entry','Card entry',['Pop','Slide up','Cut']), S('timing','Timing',['By word length','Even']),
    T('outline','Outline for legibility',true), R('outlineW','Outline weight',.12,0,.4), C('ink','Text','#ffffff'), C('accent','Highlight','#ff5a36'), C('bg2','Outline / box text','#141516') ],
  draw(ctx, api){
    const P = api.params, { w, h } = api;
    const words = String(P.text).split(/\s+/).filter(Boolean).map(s => P.upper ? s.toUpperCase() : s); if (!words.length) return;
    const wts = words.map(s => (P.timing | 0) === 0 ? s.replace(/[^\p{L}\p{N}]/gu, '').length + 2 : 1), total = wts.reduce((a, b) => a + b, 0);
    let acc = 0; const starts = wts.map(v => { const s = acc / total; acc += v; return s; });
    const t = api.loop; let wi = starts.length - 1; for (let i = 0; i < starts.length; i++) if (starts[i] <= t) wi = i;
    const per = Math.max(1, P.perCard | 0), card = Math.floor(wi / per), c0 = card * per, cw = words.slice(c0, c0 + per);
    const cardStart = starts[c0], cardEnd = c0 + per < starts.length ? starts[c0 + per] : 1, cardLt = (t - cardStart) / Math.max(1e-4, cardEnd - cardStart);
    const mn = Math.min(w, h); let size = P.size / 100 * mn; ctx.font = KT.font(P, size);
    const maxW = P.width * w; const longest = Math.max(...cw.map(s => ctx.measureText(s).width));
    if (longest > maxW){ size *= maxW / longest; ctx.font = KT.font(P, size); }
    const M = KT.metrics(ctx, size), space = ctx.measureText(' ').width, lh = size * 1.18;
    const lines = []; let line = [], lw = 0;
    cw.forEach((s, i) => { const ww = ctx.measureText(s).width; if (line.length && lw + space + ww > maxW){ lines.push({ items:line, w:lw }); line = []; lw = 0; } line.push({ s, ww, i:c0 + i }); lw += (line.length > 1 ? space : 0) + ww; });
    lines.push({ items:line, w:lw });
    const blockH = lines.length * lh, pos = P.position | 0;
    const cy = pos === 0 ? h * .76 : pos === 1 ? h / 2 : h * .22, top = cy - blockH / 2;
    const ent = P.entry | 0, ep = Util.clamp(cardLt / .18), ee = KT.ease.back(ep);
    ctx.save();
    if (ent === 0){ ctx.translate(w / 2, cy); const s = .7 + .3 * ee; ctx.scale(s, s); ctx.translate(-w / 2, -cy); ctx.globalAlpha = Util.clamp(ep * 2); }
    else if (ent === 1){ ctx.translate(0, (1 - KT.ease.expo(ep)) * lh * .6); ctx.globalAlpha = Util.clamp(ep * 2); }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    const hl = P.highlight | 0;
    lines.forEach((ln, li) => {
      let x = (w - ln.w) / 2; const y = top + li * lh + (lh + M.cap) / 2;
      ln.items.forEach(it => {
        const active = it.i === wi, past = it.i < wi;
        if (hl === 4 && it.i > wi){ x += it.ww + space; return; }
        ctx.save();
        let fill = P.ink;
        if (active){
          const wl = Util.clamp((t - starts[it.i]) / Math.max(1e-4, (starts[it.i + 1] ?? 1) - starts[it.i]) * 4);
          if (hl === 0) fill = P.accent;
          if (hl === 1){ ctx.fillStyle = P.accent; KT.roundRect(ctx, x - size * .14, y - M.cap - size * .16, it.ww + size * .28, M.cap + size * .34, size * .12); ctx.fill(); fill = P.bg2; }
          if (hl === 2){ const s = 1 + .14 * KT.ease.back(Util.clamp(wl)); ctx.translate(x + it.ww / 2, y - M.cap / 2); ctx.scale(s, s); ctx.translate(-(x + it.ww / 2), -(y - M.cap / 2)); fill = P.accent; }
          if (hl === 3){ ctx.fillStyle = P.accent; ctx.fillRect(x, y + size * .1, it.ww * KT.ease.expo(wl), Math.max(2, size * .08)); }
          if (hl === 4){ ctx.globalAlpha *= Util.clamp(wl * 2); }
        }
        void past;
        if (P.outline && !(active && hl === 1)){ ctx.strokeStyle = P.bg2; ctx.lineWidth = size * P.outlineW; ctx.strokeText(it.s, x, y); }
        ctx.fillStyle = fill; ctx.fillText(it.s, x, y);
        ctx.restore();
        x += it.ww + space;
      });
    });
    ctx.restore();
  } });
