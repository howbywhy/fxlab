/* ---------------- Kinetic type ----------------
   Canvas 2D modules (plus one GLSL). Motion follows api.p (timeline) or api.loop (seamless).
------------------------------------------------ */

/* ---- Staggered reveal ---- */
FX.register({ id:'kt-reveal', name:'Staggered reveal', cat:'type', kind:'2d', desc:'Letters, words or lines animate in one after another. Follows the timeline.',
  params:[ ...KT.typeParams('MOVE\nWITH\nINTENT'), T('fit','Fit to width',true), R('size','Size',16,2,60,.1), R('margin','Margin',.08,0,.4), R('tracking','Tracking',-.02,-.2,.5), R('leading','Leading',.92,.6,2), S('align','Align',['Left','Centre','Right'],1), R('x','X',0,-1,1), R('y','Y',0,-1,1),
    S('unit','Animate by',['Letters','Words','Lines']), S('style','Style',['Rise','Drop','Fade','Pop','Spin','Slant in','Tracking','Flip']), R('stagger','Stagger',.55,0,1), S('order','Order',['Forward','Reverse','Centre out','Random']), S('easing','Easing',KT.EASES), R('slant','Motion slant',.5,0,2),
    C('color','Colour','#e4e2dc'), ...KT.groundParams(0) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P); if (!text.trim()) return;
    const mg = P.margin * w;
    const size = P.fit ? KT.fit(ctx, P, text, w - mg * 2, h - mg * 2, P.leading, P.tracking) : P.size / 100 * Math.min(w, h);
    const font = KT.font(P, size); ctx.font = font;
    const L = KT.layout(ctx, text, { font, size, tracking:P.tracking }), M = KT.metrics(ctx, size);
    const align = P.align | 0, ax = align === 0 ? mg + (P.x * .5) * w : align === 2 ? w - mg + (P.x * .5) * w : (.5 + P.x * .5) * w;
    const pos = KT.place(L, { size, leading:P.leading, cap:M.cap, align, x:ax, y:(.5 - P.y * .5) * h });
    /* units */
    const units = []; const unit = P.unit | 0;
    L.lines.forEach((ln, li) => ln.glyphs.forEach((g, gi) => {
      if (g.space) return;
      const key = unit === 0 ? `${li}:${gi}` : unit === 1 ? `${li}:w${g.word}` : `${li}`;
      let u = units.find(u => u.key === key);
      if (!u){ u = { key, li, glyphs:[], x0:Infinity, x1:-Infinity }; units.push(u); }
      u.glyphs.push(g); u.x0 = Math.min(u.x0, g.x); u.x1 = Math.max(u.x1, g.x + g.w);
    }));
    const rank = KT.orderMap(units.length, P.order | 0, 7), E = KT.easeBy(P.easing), st = P.style | 0;
    ctx.fillStyle = P.color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const lineH = M.cap + M.desc;
    units.forEach((u, ui) => {
      const lp = KT.stagger(api.p, rank[ui], units.length, P.stagger);
      if (lp <= 0 && st !== 7) return;
      const e = E(lp), ev = (E(Math.min(1, lp + .02)) - e) / .02;
      const { x, y } = pos[u.li], cx = x + (u.x0 + u.x1) / 2, cy = y - M.cap / 2;
      ctx.save();
      if (st === 0 || st === 1){ ctx.beginPath(); ctx.rect(0, y - M.cap - size * .12, w, lineH + size * .24); ctx.clip(); }
      let alpha = 1;
      if (st === 0) ctx.translate(0, (1 - e) * lineH * 1.15);
      else if (st === 1) ctx.translate(0, -(1 - e) * lineH * 1.15);
      else if (st === 2){ alpha = clampA(e); ctx.translate(0, (1 - e) * size * .18); }
      else if (st === 3){ const s = Math.max(0, e); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy); alpha = clampA(lp * 4); }
      else if (st === 4){ ctx.translate(cx, y); ctx.rotate((1 - e) * -Math.PI * .6); ctx.translate(-cx, -y); alpha = clampA(lp * 3); }
      else if (st === 5){ ctx.translate(-(1 - e) * size * 2.2, 0); KT.motionSlant(ctx, cx, y, ev * .12 * P.slant); alpha = clampA(lp * 5); }
      else if (st === 6){ u._spread = (1 - e) * 1.6; alpha = clampA(e * 1.5); }
      else if (st === 7){ const s = Math.sin(clampA(e) * Math.PI / 2); ctx.translate(0, y - M.cap / 2); ctx.scale(1, Math.max(.001, s)); ctx.translate(0, -(y - M.cap / 2)); alpha = lp > 0 ? 1 : 0; }
      ctx.globalAlpha = alpha;
      const lx = x + L.lines[u.li].width / 2;
      for (const g of u.glyphs){
        const gx = st === 6 ? lx + (x + g.x - lx) * (1 + (u._spread || 0)) : x + g.x;
        ctx.fillText(g.ch, gx, y);
      }
      ctx.restore();
    });
    function clampA(v){ return Util.clamp(v); }
  } });

/* ---- Decode / scramble ---- */
FX.register({ id:'kt-scramble', name:'Decode', cat:'type', kind:'2d', desc:'Characters flicker through random glyphs, then lock in. Plain or split-flap board.',
  params:[ ...KT.typeParams('SIGNAL\nACQUIRED', { font:'Mono', weight:2 }), T('fit','Fit to width',true), R('size','Size',12,2,60,.1), R('margin','Margin',.1,0,.4), R('tracking','Tracking',0,-.2,.5), R('leading','Leading',1.1,.6,2), S('align','Align',['Left','Centre','Right'],1), R('y','Y',0,-1,1),
    S('style','Style',['Plain','Split-flap']), S('charset','Glyphs',['Symbols','Letters','Digits','Binary','Blocks']), S('order','Order',['Left → right','Random','Centre out']), R('spread','Spread',.7,0,1), I('rate','Flicker per second',18,2,60), T('blank','Start blank',true),
    C('color','Colour','#e4e2dc'), C('hot','Unresolved colour','#c9f5e4'), C('tile','Tile colour','#232426'), ...KT.groundParams(0) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P); if (!text.trim()) return;
    const sets = ['#%&*+=?/\\<>[]{}!@$', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789', '01', '░▒▓█▀▄▌▐'];
    const set = sets[P.charset | 0], flap = (P.style | 0) === 1, mg = P.margin * w;
    let size = P.fit ? KT.fit(ctx, P, text, w - mg * 2, h - mg * 2, P.leading, P.tracking + (flap ? .25 : 0)) : P.size / 100 * Math.min(w, h);
    const font = KT.font(P, size); ctx.font = font;
    const L = KT.layout(ctx, text, { font, size, tracking:P.tracking + (flap ? .25 : 0) }), M = KT.metrics(ctx, size);
    const align = P.align | 0, ax = align === 0 ? mg : align === 2 ? w - mg : w / 2;
    const pos = KT.place(L, { size, leading:P.leading, cap:M.cap, align, x:ax, y:(.5 - P.y * .5) * h });
    const all = []; L.lines.forEach((ln, li) => ln.glyphs.forEach(g => { if (!g.space) all.push({ g, li }); }));
    const n = all.length, mode = P.order | 0;
    const rank = mode === 0 ? all.map((_, i) => i) : KT.orderMap(n, mode === 1 ? 3 : 2, 3);
    const step = Math.floor(api.t * P.rate);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    all.forEach(({ g, li }, i) => {
      const lp = KT.stagger(api.p, rank[i], n, P.spread);
      const x = pos[li].x + g.x + g.w / 2, y = pos[li].y;
      if (lp <= 0 && P.blank && !flap) return;
      const done = lp >= 1;
      const ch = done ? g.ch : (lp <= 0 && P.blank) ? ' ' : set[Math.floor(KT.rnd(i * 3.7 + step, 11) * set.length)];
      if (flap){
        const tw = g.w - P.tracking * size * .5 - size * .08, th = M.cap + size * .5, ty = y - M.cap - size * .25;
        ctx.fillStyle = P.tile; roundRect(ctx, x - tw / 2, ty, tw, th, size * .06); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x - tw / 2, ty + th / 2, tw, th / 2);
      }
      ctx.fillStyle = done ? P.color : P.hot;
      ctx.fillText(ch, x, y);
      if (flap){ ctx.fillStyle = P.ground | 0 ? P.bg : '#000'; ctx.fillRect(x - g.w / 2, y - M.cap / 2 - size * .012, g.w, Math.max(1, size * .024)); }
    });
    function roundRect(c, x, y, ww, hh, r){ c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + ww, y, x + ww, y + hh, r); c.arcTo(x + ww, y + hh, x, y + hh, r); c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + ww, y, r); c.closePath(); }
  } });

/* ---- Counter ---- */
FX.register({ id:'kt-counter', name:'Counter', cat:'type', kind:'2d', desc:'Number counts between two values. Rolling odometer digits or plain.',
  params:[ X('from','From','0'), X('to','To','2026'), I('decimals','Decimals',0,0,3), X('prefix','Prefix',''), X('suffix','Suffix',''), T('commas','Thousands separators',false), F('font','Font'), S('weight','Weight',Util.weights,4),
    R('size','Size',28,4,80,.1), R('x','X',0,-1,1), R('y','Y',0,-1,1), S('align','Align',['Left','Centre','Right'],1), S('style','Style',['Rolling digits','Plain']), R('blur','Roll blur',.5,0,1),
    C('color','Colour','#e4e2dc'), C('affix','Prefix/suffix colour','#9a9893'), ...KT.groundParams(0) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const from = parseFloat(P.from) || 0, to = parseFloat(P.to) || 0, dec = P.decimals | 0, scale = Math.pow(10, dec);
    const v = (from + (to - from) * api.p) * scale, neg = v < 0, V = Math.abs(v);
    const size = P.size / 100 * Math.min(w, h); ctx.font = KT.font(P, size);
    const M = KT.metrics(ctx, size);
    const digitW = Math.max(...'0123456789'.split('').map(d => ctx.measureText(d).width));
    const cols = Math.max(dec + 1, Math.floor(Math.log10(Math.max(1, Math.round(V)))) + 1);
    /* build cells right → left */
    const cells = [];
    for (let k = 0; k < cols; k++){
      if (dec && k === dec) cells.push({ sep:'.' });
      if (P.commas && k > dec && (k - dec) % 3 === 0) cells.push({ sep:',' });
      cells.push({ k });
    }
    if (neg) cells.push({ sep:'−' });
    cells.reverse();
    const sepW = s => ctx.measureText(s).width;
    const pre = P.prefix || '', suf = P.suffix || '';
    const numW = cells.reduce((a, c) => a + (c.sep ? sepW(c.sep) : digitW), 0);
    const total = sepW(pre) + numW + sepW(suf);
    const align = P.align | 0, ax = (.5 + P.x * .5) * w;
    let x = align === 0 ? ax : align === 2 ? ax - total : ax - total / 2;
    const y = (.5 - P.y * .5) * h + M.cap / 2;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = P.affix; ctx.fillText(pre, x, y); x += sepW(pre);
    ctx.fillStyle = P.color;
    const rowH = M.cap * 1.5, rolling = (P.style | 0) === 0;
    for (const c of cells){
      if (c.sep){ ctx.textAlign = 'left'; ctx.fillText(c.sep, x, y); x += sepW(c.sep); continue; }
      const unit = Math.pow(10, c.k), q = V / unit, d = Math.floor(q) % 10;
      let frac = c.k === 0 ? q - Math.floor(q) : Util.clamp((q - Math.floor(q)) * unit - (unit - 1));
      if (!rolling) frac = 0;
      const cx = x + digitW / 2; ctx.textAlign = 'center';
      if (frac < .001) ctx.fillText(String(d), cx, y);
      else {
        ctx.save(); ctx.beginPath(); ctx.rect(x - 2, y - M.cap - rowH * .25, digitW + 4, M.cap + rowH * .5); ctx.clip();
        const blur = P.blur * Math.sin(frac * Math.PI);
        ctx.globalAlpha = 1 - blur * .45;
        ctx.fillText(String(d), cx, y - frac * rowH);
        ctx.fillText(String((d + 1) % 10), cx, y + (1 - frac) * rowH);
        if (blur > .05){ ctx.globalAlpha = blur * .25; ctx.fillText(String(d), cx, y - frac * rowH + rowH * .12); ctx.fillText(String((d + 1) % 10), cx, y + (1 - frac) * rowH - rowH * .12); }
        ctx.restore();
      }
      x += digitW;
    }
    ctx.textAlign = 'left'; ctx.fillStyle = P.affix; ctx.fillText(suf, x, y);
  } });

/* ---- Elastic stretch ---- */
FX.register({ id:'kt-stretch', name:'Elastic stretch', cat:'type', kind:'2d', desc:'Letters stretch and squash in a travelling wave. Loops seamlessly.',
  params:[ ...KT.typeParams('STRETCH'), I('rows','Rows',3,1,12), R('margin','Margin',.06,0,.3), R('tracking','Tracking',0,-.1,.4), R('amount','Stretch',.7,0,1.5), R('waves','Waves across',1,.25,4), I('speed','Loops per cycle',1,0,6), R('rowPhase','Row offset',.25,0,1), S('anchor','Anchor',['Baseline','Centre','Top']), T('squash','Squash widths',true), T('outline','Outline alternate rows',false),
    C('color','Colour','#e4e2dc'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P).split('\n')[0]; if (!text.trim()) return;
    const rows = Math.max(1, P.rows | 0), mg = P.margin * w, availW = w - mg * 2, rowH = (h - mg * 2) / rows;
    let size = KT.fit(ctx, P, text, availW, null, 1, P.tracking);
    ctx.font = KT.font(P, size); let M = KT.metrics(ctx, size);
    const capLimit = rowH / (1 + P.amount * .9) * .8;
    if (M.cap > capLimit){ size *= capLimit / M.cap; ctx.font = KT.font(P, size); M = KT.metrics(ctx, size); }
    const L = KT.layout(ctx, text, { font:ctx.font, size, tracking:P.tracking }).lines[0];
    const n = L.glyphs.length;
    ctx.fillStyle = ctx.strokeStyle = P.color; ctx.lineWidth = Math.max(1, size * .02); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    for (let r = 0; r < rows; r++){
      const phase = api.loop * (P.speed | 0) - r * P.rowPhase;
      const sy = L.glyphs.map((g, i) => Math.exp(P.amount * Math.sin(KT.TAU * (phase - (i + .5) / n * P.waves))));
      const sx = sy.map(s => P.squash ? 1 / Math.sqrt(s) : 1);
      const widths = L.glyphs.map((g, i) => g.w * sx[i]);
      const tot = widths.reduce((a, b) => a + b, 0) - (P.tracking * size), k = availW / Math.max(1, tot);
      const base = mg + rowH * (r + .5) + M.cap / 2;
      const ay = [(base), base - M.cap / 2, base - M.cap][P.anchor | 0];
      let x = mg;
      L.glyphs.forEach((g, i) => {
        const gw = widths[i] * k;
        ctx.save(); ctx.translate(x, ay); ctx.scale(sx[i] * k, sy[i]); ctx.translate(0, base - ay);
        (P.outline && r % 2) ? ctx.strokeText(g.ch, 0, 0) : ctx.fillText(g.ch, 0, 0);
        ctx.restore(); x += gw;
      });
    }
  } });

/* ---- Type circle ---- */
FX.register({ id:'kt-circle', name:'Type circle', cat:'type', kind:'2d', desc:'Text around rings, counter-rotating. Tilt for a 3D ring; add a logo in the centre.',
  params:[ ...KT.typeParams('ROUND AND ROUND • ', { weight:3 }), I('rings','Rings',2,1,8), R('radius','Radius',.36,.05,.7), R('gap','Ring spacing',.1,.02,.3), R('size','Type size',5.5,1,20,.1), I('repeats','Repeats per ring',2,1,12), I('turns','Turns per loop',1,0,4), T('alternate','Alternate direction',true), R('tilt','Tilt',0,0,.9), S('facing','Letters face',['Outward','Inward']),
    L('logo','Centre logo',false), R('logoSize','Logo size',.3,.05,1), T('logoSpin','Spin logo',false),
    C('color','Colour','#e4e2dc'), C('color2','Alternate ring colour','#9a9893'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P).replace(/\n/g, ' '); const mn = Math.min(w, h), cx = w / 2, cy = h / 2;
    const size = P.size / 100 * mn; ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size);
    const unit = text.length ? KT.layout(ctx, text, { font:ctx.font, size, tracking:0 }).lines[0] : null;
    const logo = Assets.image(P.logo);
    const drawLogo = () => {
      if (!logo) return;
      const s = P.logoSize * P.radius * 2 * mn / Math.max(logo.width, logo.height);
      ctx.save(); ctx.translate(cx, cy); if (P.logoSpin) ctx.rotate(api.loop * KT.TAU * (P.turns || 1));
      ctx.drawImage(logo, -logo.width * s / 2, -logo.height * s / 2, logo.width * s, logo.height * s); ctx.restore();
    };
    if (P.tilt < .01) drawLogo();
    if (!unit || !unit.width) return;
    const glyphs = [];
    for (let r = 0; r < (P.rings | 0); r++){
      const rad = (P.radius - r * P.gap) * mn; if (rad <= size) break;
      const reps = Math.max(1, P.repeats | 0), circ = KT.TAU * rad, k = circ / (reps * unit.width);
      const dir = P.alternate && r % 2 ? -1 : 1, rot = api.loop * KT.TAU * (P.turns | 0) * dir;
      for (let q = 0; q < reps; q++) unit.glyphs.forEach(g => {
        if (g.space) return;
        const a = ((q * unit.width + g.x + g.w / 2) * k) / rad + rot - Math.PI / 2;
        glyphs.push({ ch:g.ch, a, rad, r, depth:Math.sin(a) });
      });
    }
    const tilt = P.tilt, inward = (P.facing | 0) === 1;
    const draw = gl => {
      const ex = cx + Math.cos(gl.a) * gl.rad, ey = cy + Math.sin(gl.a) * gl.rad * (1 - tilt);
      ctx.save(); ctx.translate(ex, ey);
      if (tilt > .01){ const d = .5 + .5 * gl.depth; ctx.globalAlpha = .35 + .65 * d; ctx.scale(1, 1 - tilt * .6); }
      ctx.rotate(gl.a + (inward ? -Math.PI / 2 : Math.PI / 2));
      ctx.fillStyle = gl.r % 2 ? P.color2 : P.color; ctx.fillText(gl.ch, 0, 0); ctx.restore();
    };
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (tilt > .01){
      glyphs.filter(g => g.depth < 0).forEach(draw); drawLogo(); glyphs.filter(g => g.depth >= 0).forEach(draw);
    } else glyphs.forEach(draw);
    void M;
  } });

/* ---- Echo stack / extrude ---- */
FX.register({ id:'kt-stack', name:'Echo stack', cat:'type', kind:'2d', desc:'A word repeated as an outlined stack with a travelling solid row, or a rotating 3D extrusion.',
  params:[ ...KT.typeParams('ECHO'), S('mode','Mode',['Vertical stack','Extrude']), I('copies','Copies',9,2,40), R('margin','Margin',.08,0,.4), R('spread','Row spacing',.78,.3,1.5), R('wave','Wave',.35,0,2), I('speed','Loops per cycle',1,0,6), R('depth','Extrude depth',.18,0,.6), R('slant','Slant',0,-.6,.6), S('highlight','Solid row',['Travelling','Middle','Front only','None']), R('stroke','Outline weight',1,.2,4),
    C('color','Colour','#e4e2dc'), C('accent','Accent','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P).split('\n')[0]; if (!text.trim()) return;
    const n = Math.max(2, P.copies | 0), mg = P.margin * w, extrude = (P.mode | 0) === 1;
    let size = KT.fit(ctx, P, text, (w - mg * 2) * (extrude ? 1 - P.depth : 1), null);
    ctx.font = KT.font(P, size); let M = KT.metrics(ctx, size);
    if (!extrude){ const maxCap = (h - mg * 2) / (1 + (n - 1) * P.spread); if (M.cap > maxCap){ size *= maxCap / M.cap; ctx.font = KT.font(P, size); M = KT.metrics(ctx, size); } }
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, size * .012 * P.stroke);
    const cx = w / 2, cy = h / 2 + M.cap / 2, ph = api.loop * (P.speed | 0);
    const hl = P.highlight | 0, travelling = Math.floor(api.loop * n * Math.max(1, P.speed | 0)) % n;
    for (let j = 0; j < n; j++){
      const i = extrude ? n - 1 - j : j;
      let x = cx, y;
      if (extrude){
        const a = ph * KT.TAU, d = i / (n - 1) * P.depth * Math.min(w, h);
        x = cx + Math.cos(a) * d; y = cy + Math.sin(a) * d;
      } else {
        y = cy + (i - (n - 1) / 2) * M.cap * P.spread + Math.sin(KT.TAU * ph + i * .55) * P.wave * M.cap * .4;
      }
      const solid = extrude ? i === 0 : hl === 0 ? i === travelling : hl === 1 ? i === Math.floor(n / 2) : hl === 2 ? false : false;
      ctx.save(); KT.slant(ctx, x, y, P.slant);
      if (solid){ ctx.fillStyle = P.color; ctx.fillText(text, x, y); }
      else { ctx.strokeStyle = extrude ? P.accent : (i % 2 ? P.color : P.accent); ctx.globalAlpha = extrude ? .35 + .65 * (1 - i / n) : 1; ctx.strokeText(text, x, y); }
      ctx.restore();
    }
  } });

/* ---- Tape ---- */
FX.register({ id:'kt-tape', name:'Tape', cat:'type', kind:'2d', desc:'Diagonal bands of scrolling text, like event tape. Loops seamlessly.',
  params:[ ...KT.typeParams('LIVE NOW • '), I('bands','Bands',2,1,6), R('angle','Angle',-10,-60,60,1), T('cross','Cross bands',true), R('band','Band size',11,3,30,.1), R('spacing','Band spacing',.28,0,.8), I('speed','Loops per cycle',1,0,6), R('wobble','Wobble',0,0,1), S('edge','Edges',['None','Lines','Hazard stripes']),
    C('ink','Ink','#141516'), C('tape','Tape','#ff5a36'), C('ink2','Alt ink','#ff5a36'), C('tape2','Alt tape','#141516'), ...KT.groundParams(0) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P).replace(/\n/g, ' ') || ' ';
    const n = Math.max(1, P.bands | 0), mn = Math.min(w, h), bh = P.band / 100 * mn, Ld = Math.hypot(w, h);
    const size = bh * .62; ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size);
    const unitW = Math.max(1, ctx.measureText(text).width);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    for (let b = 0; b < n; b++){
      const off = (b - (n - 1) / 2) * P.spacing * h;
      const ang = (P.cross && b % 2 ? -P.angle : P.angle) * Math.PI / 180 + Math.sin(api.loop * KT.TAU + b) * P.wobble * .05;
      const alt = b % 2 === 1, ink = alt ? P.ink2 : P.ink, tape = alt ? P.tape2 : P.tape, dir = b % 2 ? -1 : 1;
      ctx.save(); ctx.translate(w / 2, h / 2 + off); ctx.rotate(ang);
      ctx.fillStyle = tape; ctx.fillRect(-Ld, -bh / 2, Ld * 2, bh);
      const edge = P.edge | 0, eh = bh * .09;
      if (edge === 1){ ctx.fillStyle = ink; ctx.fillRect(-Ld, -bh / 2 + eh * .6, Ld * 2, eh * .35); ctx.fillRect(-Ld, bh / 2 - eh * .95, Ld * 2, eh * .35); }
      if (edge === 2){
        ctx.save(); ctx.beginPath(); ctx.rect(-Ld, -bh / 2, Ld * 2, eh); ctx.rect(-Ld, bh / 2 - eh, Ld * 2, eh); ctx.clip();
        ctx.fillStyle = ink; const sw = eh * 2, so = (api.loop * (P.speed | 0) * dir * unitW) % (sw * 2);
        for (let x = -Ld - sw * 2 + so; x < Ld; x += sw * 2){ ctx.beginPath(); ctx.moveTo(x, bh / 2); ctx.lineTo(x + sw, bh / 2); ctx.lineTo(x + sw + bh, -bh / 2); ctx.lineTo(x + bh, -bh / 2); ctx.fill(); }
        ctx.restore();
      }
      const shift = ((api.loop * (P.speed | 0) * dir) % 1 + 1) % 1 * unitW;
      ctx.fillStyle = ink;
      for (let x = -Ld - unitW + shift - (Ld % unitW); x < Ld; x += unitW) ctx.fillText(text, x, M.cap / 2);
      ctx.restore();
    }
  } });

/* ---- Word flash ---- */
FX.register({ id:'kt-words', name:'Word flash', cat:'type', kind:'2d', desc:'One word at a time, filling the frame, cutting on the beat. Colours can cycle.',
  params:[ ...KT.typeParams('ONE WORD AT A TIME'), T('fit','Fit each word to width',true), R('size','Size',24,4,80,.1), R('margin','Margin',.08,0,.4), I('repeat','Passes per loop',1,1,8), S('cut','Transition',['Hard cut','Pop','Slide up','Slant in']), R('trans','Transition length',.3,.05,1),
    T('swap','Swap ink & ground each word',false), T('cycle','Cycle ink colours',true), C('ink1','Ink 1','#e4e2dc'), C('ink2','Ink 2','#ff5a36'), C('ink3','Ink 3','#c9f5e4'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api;
    const words = KT.text(P).split(/\s+/).filter(Boolean); if (!words.length){ KT.ground(ctx, api); return; }
    const N = words.length * Math.max(1, P.repeat | 0), f = api.loop * N, idx = Math.floor(f) % N, local = f - Math.floor(f);
    const word = words[idx % words.length];
    const inks = P.cycle ? [P.ink1, P.ink2, P.ink3] : [P.ink1];
    let ink = inks[idx % inks.length];
    if (P.swap && idx % 2){ ctx.fillStyle = ink; ctx.fillRect(0, 0, w, h); ink = (P.ground | 0) === 1 ? P.bg : '#141516'; }
    else KT.ground(ctx, api);
    const mg = P.margin * w;
    const size = P.fit ? KT.fit(ctx, P, word, w - mg * 2, h - mg * 2) : P.size / 100 * Math.min(w, h);
    ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size);
    const e = KT.ease.expo(Util.clamp(local / P.trans)), ev = (KT.ease.expo(Util.clamp((local + .01) / P.trans)) - e) / .01 * P.trans;
    const cx = w / 2, cy = h / 2 + M.cap / 2, cut = P.cut | 0;
    ctx.save(); ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (cut === 1){ const s = KT.ease.back(Util.clamp(local / P.trans)); ctx.translate(cx, cy - M.cap / 2); ctx.scale(s, s); ctx.translate(-cx, -(cy - M.cap / 2)); }
    else if (cut === 2){ ctx.beginPath(); ctx.rect(0, cy - M.cap * 1.25, w, M.cap * 1.5); ctx.clip(); ctx.translate(0, (1 - e) * M.cap * 1.4); }
    else if (cut === 3){ ctx.translate((1 - e) * -w * .6, 0); KT.motionSlant(ctx, cx, cy, Math.min(ev * .08, 1)); }
    ctx.fillText(word, cx, cy); ctx.restore();
  } });

/* ---- Text on a path ---- */
FX.register({ id:'kt-path', name:'Text on a path', cat:'type', kind:'2d', desc:'Text flows along a wave, infinity loop, spiral or zigzag. Loops seamlessly.',
  params:[ ...KT.typeParams('ALONG THE LINE — ', { weight:3 }), S('path','Path',['Wave','Infinity','Spiral','Zigzag','Arch']), R('size','Type size',5,1,20,.1), R('amp','Amplitude',.22,0,.5), R('freq','Frequency',1.5,.5,5), R('y','Y',0,-1,1), I('speed','Loops per cycle',1,-6,6), T('rotate','Follow the path',true), T('line','Draw the path',false),
    C('color','Colour','#e4e2dc'), C('lineColor','Path colour','#6c6b67'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P).replace(/\n/g, ' '); if (!text.trim()) return;
    const mn = Math.min(w, h), size = P.size / 100 * mn, kind = P.path | 0, oy = -P.y * .5 * h;
    const fn = s => {
      if (kind === 0) return [-.1 * w + s * 1.2 * w, h / 2 + oy + Math.sin(s * KT.TAU * P.freq) * P.amp * h];
      if (kind === 1){ const a = s * KT.TAU; const d = 1 + Math.sin(a) ** 2; return [w / 2 + Math.cos(a) / d * (P.amp * 1.8) * w, h / 2 + oy + Math.sin(a) * Math.cos(a) / d * P.amp * 1.8 * h]; }
      if (kind === 2){ const a = s * KT.TAU * (1 + P.freq * 2), r = (.04 + s * P.amp * 1.8) * mn; return [w / 2 + Math.cos(a) * r, h / 2 + oy + Math.sin(a) * r]; }
      if (kind === 3){ const t = s * P.freq * 4, tri = 1 - 4 * Math.abs(t / 2 - Math.floor(t / 2 + .5)); return [-.1 * w + s * 1.2 * w, h / 2 + oy + tri * P.amp * h]; }
      return [w / 2 + Math.cos(Math.PI - s * Math.PI) * (.5 + P.amp) * w * .8, h / 2 + oy + (P.amp * h) - Math.sin(s * Math.PI) * P.amp * 2.4 * h * .5];
    };
    const N = 600, pts = [], len = [0];
    for (let i = 0; i <= N; i++){ pts.push(fn(i / N)); if (i) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
    const total = len[N];
    if (P.line){ ctx.strokeStyle = P.lineColor; ctx.lineWidth = Math.max(1, size * .04); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }
    ctx.font = KT.font(P, size);
    const unit = KT.layout(ctx, text, { font:ctx.font, size, tracking:0 }).lines[0];
    if (!unit.width) return;
    const reps = Math.max(1, Math.floor(total / unit.width)), k = total / (reps * unit.width);
    const shift = ((api.loop * (P.speed | 0)) % 1) * unit.width * k;
    const at = d => {
      d = ((d % total) + total) % total;
      let lo = 0, hi = N; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (len[m] <= d) lo = m; else hi = m; }
      const t = (d - len[lo]) / Math.max(1e-6, len[hi] - len[lo]);
      const a = pts[lo], b = pts[hi];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
    };
    ctx.fillStyle = P.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const open = kind !== 1;
    for (let q = 0; q < reps; q++) unit.glyphs.forEach(g => {
      if (g.space) return;
      const raw = (q * unit.width + g.x + g.w / 2) * k + shift;
      const d = ((raw % total) + total) % total;
      const [x, y, ang] = at(d);
      ctx.save(); ctx.translate(x, y); if (P.rotate) ctx.rotate(ang);
      if (open && kind === 2){ const edge = Math.min(d, total - d) / (size * 3); ctx.globalAlpha = Util.clamp(edge); }
      ctx.fillText(g.ch, 0, 0); ctx.restore();
    });
  } });

/* ---- Sliced type (GLSL) ---- */
FX.register({ id:'kt-slice', name:'Sliced type', cat:'type', desc:'Type cut into strips that shear apart and lock together. Fill with ink or an image.',
  params:[ ...KT.typeParams('SLICE\nIT UP'), R('margin','Margin',.08,0,.4), R('tracking','Tracking',-.01,-.2,.5), R('leading','Leading',.9,.6,2), I('slices','Slices',14,2,80), S('axis','Cut',['Horizontal','Vertical']), R('shift','Shear',.3,0,1), S('drive','Motion',['Assemble with timeline','Loop wave']), R('wave','Wave spread',1,0,4), T('alternate','Alternate directions',true), R('chroma','Colour split',0,0,1),
    S('fill','Fill',['Ink','Image B','Image A']), C('ink','Ink','#e4e2dc'), ...KT.groundParams(1) ],
  auxSize(P, w, h){ const s = Math.min(1, Math.max(1600, Engine.auxCap) / Math.max(w, h)); return [Math.round(w * s), Math.round(h * s)]; },
  aux(ctx, P, w, h){
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const text = KT.text(P); if (!text.trim()) return;
    const mg = P.margin * w, size = KT.fit(ctx, P, text, w - mg * 2, h - mg * 2, P.leading, P.tracking);
    const font = KT.font(P, size); ctx.font = font;
    const L = KT.layout(ctx, text, { font, size, tracking:P.tracking }), M = KT.metrics(ctx, size);
    const pos = KT.place(L, { size, leading:P.leading, cap:M.cap, align:1, x:w / 2, y:h / 2 });
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    L.lines.forEach((ln, i) => ln.glyphs.forEach(g => ctx.fillText(g.ch, pos[i].x + g.x, pos[i].y)));
  },
  fs:`vec4 fx(vec2 uv){
  vec3 base = mix(texture(uInput, uv).rgb, p_bg, p_ground < .5 ? 0. : p_bg_a);
  float n = max(p_slices, 1.);
  float along = p_axis < .5 ? 1. - uv.y : uv.x;
  float id = floor(along * n);
  float dir = p_alternate > .5 ? mod(id, 2.) * 2. - 1. : 1.;
  float off;
  if (p_drive < .5) off = dir * p_shift * (1. - uProgress) * mix(.35, 1., hash12(vec2(id, 4.2)));
  else off = dir * p_shift * .5 * sin(TAU * (uLoop + id / n * p_wave));
  vec2 ax = p_axis < .5 ? vec2(1., 0.) : vec2(0., 1.);
  vec2 q = uv - ax * off;
  float ch = p_chroma * .03 * abs(off) / max(p_shift, 1e-3);
  float mr = texture(uAux, q - ax * ch).r, mg = texture(uAux, q).r, mb = texture(uAux, q + ax * ch).r;
  vec3 ink = p_fill < .5 ? p_ink : p_fill < 1.5 ? texture(uB, q).rgb : texture(uA, q).rgb;
  vec3 col = vec3(mix(base.r, ink.r, mr), mix(base.g, ink.g, mg), mix(base.b, ink.b, mb));
  return vec4(col, 1.);
}` });

/* ---- Justified lines ---- */
FX.register({ id:'kt-fit', name:'Justified lines', cat:'type', kind:'2d', desc:'Each line scales to fill the width, poster-style, then slides in with motion slant.',
  params:[ ...KT.typeParams('EVERY\nLINE FILLS\nTHE\nFRAME'), R('margin','Margin',.06,0,.3), R('gap','Line gap',.18,-.1,1), S('motion','Motion',['Slide alternate','Slide left','Rise','Wipe','None']), R('stagger','Stagger',.4,0,1), S('easing','Easing',KT.EASES), R('slant','Motion slant',.6,0,2),
    T('alternate','Alternate ink',true), C('ink','Ink','#e4e2dc'), C('ink2','Ink 2','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const lines = KT.text(P).split('\n').filter(l => l.trim()); if (!lines.length) return;
    const mg = P.margin * w, availW = w - mg * 2, availH = h - mg * 2;
    const info = lines.map(str => {
      ctx.font = KT.font(P, 100); const wd = ctx.measureText(str).width || 1;
      const size = 100 * availW / wd; ctx.font = KT.font(P, size);
      const m = ctx.measureText(str);
      return { str, size, cap:m.actualBoundingBoxAscent || size * .72, desc:Math.max(0, m.actualBoundingBoxDescent || 0) };
    });
    const gapOf = i => info[i].cap * P.gap;
    let total = info.reduce((a, l, i) => a + l.cap + (i ? gapOf(i) : 0), 0);
    const k = total > availH ? availH / total : 1; total *= k;
    let y = h / 2 - total / 2;
    const E = KT.easeBy(P.easing), mo = P.motion | 0;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    info.forEach((l, i) => {
      const size = l.size * k, cap = l.cap * k; if (i) y += gapOf(i) * k; y += cap;
      const lw = availW * k, x0 = w / 2 - lw / 2;
      const lp = mo === 4 ? 1 : KT.stagger(api.p, i, info.length, P.stagger), e = E(lp), ev = (E(Math.min(1, lp + .02)) - e) / .02;
      ctx.save(); ctx.font = KT.font(P, size); ctx.fillStyle = P.alternate && i % 2 ? P.ink2 : P.ink;
      if (mo === 0 || mo === 1){
        const dir = mo === 1 ? -1 : (i % 2 ? 1 : -1);
        ctx.translate(dir * (1 - e) * w * 1.05, 0);
        KT.motionSlant(ctx, w / 2, y, -dir * ev * .06 * P.slant);
      } else if (mo === 2){ ctx.beginPath(); ctx.rect(0, y - cap - size * .05, w, cap + size * .1 + l.desc * k); ctx.clip(); ctx.translate(0, (1 - e) * cap * 1.3); }
      else if (mo === 3){ ctx.beginPath(); ctx.rect(x0, y - cap * 1.3, lw * e, cap * 1.6 + l.desc * k); ctx.clip(); }
      if (lp > 0 || mo === 4) ctx.fillText(l.str, x0, y);
      ctx.restore();
    });
  } });

/* ---- Letter grid ---- */
FX.register({ id:'kt-grid', name:'Letter grid', cat:'type', kind:'2d', desc:'A grid of letters that flip, scale, turn or invert in waves. Loops seamlessly.', search:['repeat'],
  params:[ ...KT.typeParams('GRID', { font:'Mono', weight:3 }), I('cols','Columns',6,2,40), I('rows','Rows',0,0,60), S('effect','Effect',['Flip','Scale','Quarter turns','Invert']), S('wave','Wave',['Diagonal','Radial','Rows','Random']), R('spread','Wave spread',1,0,4), I('speed','Loops per cycle',1,0,6), R('size','Letter size',.8,.2,1.4), T('lines','Cell lines',false),
    C('ink','Ink','#e4e2dc'), C('cell','Invert colour','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const chars = [...KT.text(P).replace(/\s+/g, '')]; if (!chars.length) return;
    const cols = Math.max(2, P.cols | 0), cw = w / cols, rows = (P.rows | 0) || Math.max(1, Math.round(h / cw)), ch = h / rows;
    const size = Math.min(cw, ch) * P.size; ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size);
    const eff = P.effect | 0, wave = P.wave | 0, sp = P.speed | 0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const bg = (P.ground | 0) === 1 ? P.bg : 'rgba(0,0,0,0)';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++){
      const d = wave === 0 ? (c + r) / (cols + rows) : wave === 1 ? Math.hypot(c + .5 - cols / 2, r + .5 - rows / 2) / Math.hypot(cols, rows) * 2 : wave === 2 ? r / rows : KT.rnd(c * 31 + r, 5);
      const ph = api.loop * sp - d * P.spread;
      const x = (c + .5) * cw, y = (r + .5) * ch, glyph = chars[(r * cols + c) % chars.length];
      ctx.save(); ctx.translate(x, y);
      let inv = false;
      if (eff === 0){ const cs = Math.cos(ph * KT.TAU); ctx.scale(Math.max(.02, Math.abs(cs)), 1); inv = cs < 0; }
      else if (eff === 1){ const s = .15 + .85 * (.5 + .5 * Math.cos(ph * KT.TAU)); ctx.scale(s, s); }
      else if (eff === 2){ const q = ph * 4, e = KT.ease.inOut(q - Math.floor(q)); ctx.rotate((Math.floor(q) + e) * Math.PI / 2); }
      else inv = Math.cos(ph * KT.TAU) > .3;
      if (inv){ ctx.fillStyle = P.cell; ctx.fillRect(-cw / 2, -ch / 2, cw, ch); ctx.fillStyle = bg === 'rgba(0,0,0,0)' ? '#141516' : bg; }
      else ctx.fillStyle = P.ink;
      ctx.fillText(glyph, 0, M.cap / 2);
      ctx.restore();
      if (P.lines){ ctx.strokeStyle = 'rgba(128,128,128,.35)'; ctx.lineWidth = 1; ctx.strokeRect(c * cw, r * ch, cw, ch); }
    }
  } });
