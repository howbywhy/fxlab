/* ---------------- Kinetic type II ----------------
   Identity-system type: taglines, emphasis, layouts, lower thirds,
   rhythm and repetition. Brand roles and motion tokens apply.
--------------------------------------------------- */

/* ---- Typewriter ---- */
FX.register({ id:'kt-typewriter', name:'Typewriter', cat:'type', kind:'2d', desc:'Types text with a cursor. Type it all on the timeline, or cycle lines: type, hold, delete.',
  params:[ X('text','Text','We move with intent.\nWe play with purpose.\nWe show up.',true), F('font','Font','Mono','text'), S('weight','Weight',Util.weights,1), T('upper','Uppercase',false),
    S('mode','Mode',['Type all on timeline','Cycle lines']), R('size','Size',6,1,30,.1), R('margin','Margin',.1,0,.4), R('leading','Leading',1.25,.8,2.5), S('align','Align',['Left','Centre','Right']), R('y','Y',0,-1,1),
    S('cursor','Cursor',['Bar','Block','Underscore','None']), T('blink','Blink while idle',true), R('jitter','Human timing',.4,0,1), R('hold','Hold',.35,0,.8),
    C('color','Colour','#e4e2dc'), C('accent','Cursor colour','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const size = P.size / 100 * Math.min(w, h), mg = P.margin * w;
    ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size);
    const src = KT.text(P), cycle = (P.mode | 0) === 1;
    const phrases = cycle ? src.split('\n').filter(Boolean) : [src];
    if (!phrases.length) return;
    let lines, shown, typing = false;
    if (!cycle){
      lines = KT.wrap(ctx, src, w - mg * 2);
      const total = lines.join('').length;
      const jit = t => t + Math.sin(t * 37.1) * P.jitter * .02;
      shown = Math.round(Util.clamp(jit(api.p)) * total); typing = shown > 0 && shown < total;
    } else {
      const n = phrases.length, f = api.loop * n, i = Math.floor(f) % n, lt = f - Math.floor(f);
      lines = KT.wrap(ctx, phrases[i], w - mg * 2);
      const total = lines.join('').length, typeEnd = (1 - P.hold) * .7, delEnd = typeEnd + P.hold;
      const jit = t => Util.clamp(t + Math.sin(t * 41.3 + i) * P.jitter * .04);
      if (lt < typeEnd){ shown = Math.round(jit(lt / typeEnd) * total); typing = true; }
      else if (lt < delEnd) shown = total;
      else { shown = Math.round((1 - Util.clamp((lt - delEnd) / Math.max(.01, 1 - delEnd))) * total); typing = true; }
    }
    const lh = size * P.leading, top = (.5 - P.y * .5) * h - (lines.length - 1) * lh / 2 + M.cap / 2;
    const align = P.align | 0;
    let left = shown, cx = 0, cy = top;
    ctx.fillStyle = P.color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    lines.forEach((ln, li) => {
      const full = ctx.measureText(ln).width, x0 = align === 0 ? mg : align === 2 ? w - mg - full : (w - full) / 2;
      const part = ln.slice(0, Math.max(0, Math.min(ln.length, left)));
      const y = top + li * lh;
      if (left > 0 || li === 0){ ctx.fillText(part, x0, y); cx = x0 + ctx.measureText(part).width; cy = y; }
      left -= ln.length;
    });
    const cur = P.cursor | 0; if (cur === 3) return;
    if (P.blink && !typing && Math.floor(api.t * 2.2) % 2) return;
    ctx.fillStyle = P.accent;
    const cw = ctx.measureText('M').width;
    if (cur === 0) ctx.fillRect(cx + size * .06, cy - M.cap - size * .08, Math.max(2, size * .08), M.cap + size * .22);
    else if (cur === 1) ctx.fillRect(cx + size * .04, cy - M.cap - size * .06, cw * .9, M.cap + size * .18);
    else ctx.fillRect(cx + size * .04, cy + size * .08, cw * .9, Math.max(2, size * .08));
  } });

/* ---- Split reveal ---- */
FX.register({ id:'kt-split', name:'Split reveal', cat:'type', kind:'2d', desc:'A headline splits open along its middle to reveal a second line inside the gap.',
  params:[ ...KT.typeParams('OPEN UP'), X('sub','Inside line','the line behind the headline'), F('subFont','Inside font','Helvetica','text'), R('margin','Margin',.08,0,.3), R('open','Open',.9,.2,2.5), R('shift','Halves offset',.05,0,.5), S('drive','Motion',['Timeline','Loop open & close']), S('easing','Easing',KT.EASES,4), R('slant','Motion slant',.6,0,2), T('band','Band in gap',true),
    C('ink','Headline','#e4e2dc'), C('bg2','Inside line','#141516'), C('mark','Band','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P).split('\n')[0]; if (!text.trim()) return;
    const mg = P.margin * w, size = KT.fit(ctx, P, text, w - mg * 2, null);
    ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size);
    const E = KT.easeBy(P.easing);
    const raw = (P.drive | 0) === 1 ? .5 - .5 * Math.cos(api.loop * KT.TAU) : api.p;
    const e = E(Util.clamp(raw)), ev = (E(Util.clamp(raw + .02)) - e) / .02;
    const cx = w / 2, base = h / 2 + M.cap / 2, cut = h / 2, gap = e * M.cap * P.open, dx = e * P.shift * w;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (gap > .5){
      if (P.band){ ctx.fillStyle = P.mark; ctx.fillRect(0, cut - gap / 2, w, gap); }
      ctx.save(); ctx.beginPath(); ctx.rect(0, cut - gap / 2, w, gap); ctx.clip();
      const subF = { ...P, font:P.subFont, weight:2 };
      let ss = gap * .42; ctx.font = KT.font(subF, ss);
      const sw = ctx.measureText(P.sub).width; if (sw > w - mg * 2) ss *= (w - mg * 2) / sw;
      ctx.font = KT.font(subF, ss); const sm = KT.metrics(ctx, ss);
      ctx.fillStyle = P.bg2; ctx.globalAlpha = Util.clamp((e - .3) * 2);
      ctx.fillText(P.sub, cx, cut + sm.cap / 2); ctx.restore();
    }
    ctx.font = KT.font(P, size); ctx.fillStyle = P.ink;
    [[-1, 0, cut - gap / 2], [1, cut + gap / 2, h]].forEach(([dir, y0, y1]) => {
      ctx.save(); ctx.beginPath(); ctx.rect(0, y0, w, y1 - y0); ctx.clip();
      ctx.translate(dir * dx, dir * gap / 2);
      KT.motionSlant(ctx, cx, cut, -dir * ev * .03 * P.slant);
      ctx.fillText(text, cx, base); ctx.restore();
    });
  } });

/* ---- Propelled scroll ---- */
FX.register({ id:'kt-propel', name:'Propelled scroll', cat:'type', kind:'2d', desc:'Huge type that moves in bursts on the beat, leaning into each push. Loops seamlessly.',
  params:[ ...KT.typeParams('FORWARD • '), I('rows','Rows',3,1,8), R('size','Row fill',.8,.3,1.2), I('beats','Beats per loop (0 = brand)',0,0,16), S('easing','Easing',KT.EASES,4), R('slant','Motion slant',1,0,3), T('outline','Outline alternate rows',true), R('stroke','Outline weight',1,.2,4),
    C('ink','Ink','#e4e2dc'), C('accent','Alternate rows','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P).replace(/\n/g, ' ') || ' ';
    const rows = Math.max(1, P.rows | 0), rowH = h / rows, B = KT.beats(P), E = KT.easeBy(P.easing);
    let size = 100; ctx.font = KT.font(P, size); let M = KT.metrics(ctx, size);
    size = size * rowH * P.size / Math.max(1, M.cap * 1.05); ctx.font = KT.font(P, size); M = KT.metrics(ctx, size);
    const unitW = Math.max(1, ctx.measureText(text).width);
    const f = api.loop * B, beat = Math.floor(f), lt = f - beat, e = E(lt), ev = (E(Math.min(1, lt + .02)) - e) / .02;
    const travel = (beat + e) / B;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.lineWidth = Math.max(1, size * .012 * P.stroke); ctx.lineJoin = 'round';
    for (let r = 0; r < rows; r++){
      const dir = r % 2 ? 1 : -1, y = (r + .5) * rowH + M.cap / 2;
      const shift = ((travel * dir) % 1 + 1) % 1 * unitW;
      const alt = r % 2 === 1;
      ctx.save(); KT.motionSlant(ctx, w / 2, y - M.cap / 2, dir * ev * .05 * P.slant);
      ctx.fillStyle = ctx.strokeStyle = alt ? P.accent : P.ink;
      for (let x = shift - unitW * 2; x < w + unitW; x += unitW) (P.outline && alt) ? ctx.strokeText(text, x, y) : ctx.fillText(text, x, y);
      ctx.restore();
    }
  } });

/* ---- Breathe ---- */
FX.register({ id:'kt-breathe', name:'Breathe', cat:'type', kind:'2d', desc:'Type that breathes: weight, tracking, outline-to-fill or scale, per letter or all together.',
  params:[ ...KT.typeParams('BREATHE'), S('mode','Breathe',['Weight','Tracking','Outline ↔ fill','Scale']), R('amount','Amount',.6,0,1.5), R('waves','Letter wave',1,0,4), I('speed','Loops per cycle',1,1,6), R('margin','Margin',.1,0,.4), I('rows','Rows',1,1,8), R('rowPhase','Row offset',.2,0,1),
    C('ink','Ink','#e4e2dc'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P).split('\n')[0]; if (!text.trim()) return;
    const rows = Math.max(1, P.rows | 0), mg = P.margin * w, mode = P.mode | 0;
    const fitW = (w - mg * 2) / (mode === 1 ? 1 + P.amount * .5 : 1);
    let size = KT.fit(ctx, P, text, fitW, null); ctx.font = KT.font(P, size); let M = KT.metrics(ctx, size);
    const rowH = (h - mg * 2) / rows; if (M.cap > rowH * .75){ size *= rowH * .75 / M.cap; ctx.font = KT.font(P, size); M = KT.metrics(ctx, size); }
    const L = KT.layout(ctx, text, { font:ctx.font, size, tracking:0 }).lines[0], n = L.glyphs.length;
    ctx.fillStyle = ctx.strokeStyle = P.ink; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
    for (let r = 0; r < rows; r++){
      const y = mg + rowH * (r + .5) + M.cap / 2;
      const wave = i => .5 + .5 * Math.sin(KT.TAU * (api.loop * P.speed - r * P.rowPhase - (i + .5) / n * P.waves * .5));
      if (mode === 1){
        const tr = L.glyphs.map((g, i) => wave(i) * P.amount * size * .5);
        let total = L.width + tr.slice(0, -1).reduce((a, b) => a + b, 0), x = (w - total) / 2;
        L.glyphs.forEach((g, i) => { ctx.fillText(g.ch, x, y); x += g.w + tr[i]; });
        continue;
      }
      const x0 = (w - L.width) / 2;
      L.glyphs.forEach((g, i) => {
        const k = wave(i), x = x0 + g.x;
        if (mode === 0){ ctx.lineWidth = k * P.amount * size * .08 + .01; ctx.fillText(g.ch, x, y); if (k * P.amount > .02) ctx.strokeText(g.ch, x, y); }
        else if (mode === 2){ ctx.lineWidth = Math.max(1, size * .014); ctx.globalAlpha = Util.clamp(k * 1.4 - .2); ctx.fillText(g.ch, x, y); ctx.globalAlpha = 1; ctx.strokeText(g.ch, x, y); }
        else { const s = 1 - P.amount * .6 * (1 - k); ctx.save(); ctx.translate(x + g.w / 2, y - M.cap / 2); ctx.scale(s, s); ctx.fillText(g.ch, -g.w / 2, M.cap / 2); ctx.restore(); }
      });
    }
  } });

/* ---- Cascade ---- */
FX.register({ id:'kt-cascade', name:'Cascade', cat:'type', kind:'2d', desc:'Letters drop in and bounce into place, hold, then fall away. Loops.', search:['reveal'],
  params:[ ...KT.typeParams('LANDING'), R('margin','Margin',.08,0,.4), R('leading','Leading',.95,.6,2), S('order','Order',['Forward','Reverse','Centre out','Random']), R('stagger','Stagger',.6,0,1), R('bounce','Bounce',.7,0,1), R('spin','Tumble',.3,0,1), R('hold','Hold',.35,0,.8), S('exit','Exit',['Fall','Rise','Fade','None']),
    T('alternate','Alternate colours',false), C('ink','Ink','#e4e2dc'), C('accent','Alternate','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P); if (!text.trim()) return;
    const mg = P.margin * w, size = KT.fit(ctx, P, text, w - mg * 2, h - mg * 2, P.leading);
    ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size);
    const L = KT.layout(ctx, text, { font:ctx.font, size, tracking:0 });
    const pos = KT.place(L, { size, leading:P.leading, cap:M.cap, align:1, x:w / 2, y:h / 2 });
    const all = []; L.lines.forEach((ln, li) => ln.glyphs.forEach(g => { if (!g.space) all.push({ g, li }); }));
    const n = all.length, rank = KT.orderMap(n, P.order | 0, 5), inEnd = (1 - P.hold) * .55, outStart = inEnd + P.hold, exit = P.exit | 0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    all.forEach(({ g, li }, i) => {
      const x = pos[li].x + g.x + g.w / 2, y = pos[li].y;
      const lpIn = KT.stagger(api.loop / Math.max(.01, inEnd), rank[i], n, P.stagger);
      const lpOut = exit === 3 ? 0 : KT.stagger((api.loop - outStart) / Math.max(.01, 1 - outStart), rank[i], n, P.stagger);
      if (lpIn <= 0) return;
      const eIn = P.bounce * KT.ease.bounce(lpIn) + (1 - P.bounce) * KT.ease.expo(lpIn);
      let dy = -(1 - eIn) * (y + size), rot = (1 - lpIn) * P.spin * (KT.rnd(i, 2) - .5) * 4, alpha = 1;
      if (lpOut > 0){
        if (exit === 0){ dy += lpOut * lpOut * (h - y + size * 2); rot += lpOut * P.spin * (KT.rnd(i, 4) - .5) * 3; }
        else if (exit === 1) dy -= KT.ease.inOut(lpOut) * (y + size * 2);
        else alpha = 1 - lpOut;
      }
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y + dy - M.cap / 2); ctx.rotate(rot);
      ctx.fillStyle = P.alternate && i % 2 ? P.accent : P.ink; ctx.fillText(g.ch, 0, M.cap / 2); ctx.restore();
    });
  } });

/* ---- Word roller ---- */
FX.register({ id:'kt-roller', name:'Word roller', cat:'type', kind:'2d', desc:'A fixed phrase with a slot that rolls through words on the beat: “We are [bold / playful / together]”.',
  params:[ X('prefix','Fixed phrase','WE ARE'), X('words','Rolling words (one per line)','BOLD\nPLAYFUL\nRELENTLESS\nTOGETHER',true), F('font','Font'), S('weight','Weight',Util.weights,4), T('upper','Uppercase',true),
    S('layout','Layout',['Stacked','Inline']), R('margin','Margin',.08,0,.3), S('roll','Change',['Roll up','Flip','Slide','Cut','Scramble']), I('beats','Beats per loop (0 = one per word)',0,0,16), S('easing','Easing',KT.EASES,4), T('box','Box behind word',false),
    C('ink','Phrase','#e4e2dc'), C('accent','Words','#ff5a36'), C('bg2','Box text','#141516'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const up = s => P.upper ? s.toUpperCase() : s;
    const words = String(P.words).split('\n').map(s => up(s.trim())).filter(Boolean); if (!words.length) return;
    const prefix = up(P.prefix || ''), mg = P.margin * w, stacked = (P.layout | 0) === 0;
    const B = (P.beats | 0) || words.length, f = api.loop * B, bi = Math.floor(f) % B, lt = f - Math.floor(f);
    const cur = words[bi % words.length], prev = words[(bi - 1 + words.length) % words.length];
    const E = KT.easeBy(P.easing), dur = .35, e = E(Util.clamp(lt / dur));
    let size;
    if (stacked) size = Math.min(KT.fit(ctx, P, words.reduce((a, b) => a.length >= b.length ? a : b), w - mg * 2, (h - mg * 2) / 2.4), prefix ? KT.fit(ctx, P, prefix, w - mg * 2, null) : 1e9);
    else size = KT.fit(ctx, P, prefix + ' ' + words.reduce((a, b) => { ctx.font = KT.font(P, 100); return ctx.measureText(a).width >= ctx.measureText(b).width ? a : b; }), w - mg * 2, h * .5);
    ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size), lh = M.cap * 1.35;
    const wW = s => ctx.measureText(s).width, space = wW(' ');
    const slotW = wW(prev) + (wW(cur) - wW(prev)) * e;
    let px, py, sx, sy;
    if (stacked){ py = h / 2 - lh * .1; sy = py + lh; px = w / 2; sx = w / 2; }
    else { const tot = wW(prefix) + space + slotW; px = (w - tot) / 2; sx = px + wW(prefix) + space; py = sy = h / 2 + M.cap / 2; }
    ctx.textBaseline = 'alphabetic';
    if (prefix){ ctx.fillStyle = P.ink; ctx.textAlign = stacked ? 'center' : 'left'; ctx.fillText(prefix, px, py); }
    const slotX = stacked ? sx - slotW / 2 : sx;
    if (P.box){ ctx.fillStyle = P.accent; ctx.fillRect(slotX - size * .12, sy - M.cap - size * .14, slotW + size * .24, M.cap + size * .28); }
    const col = P.box ? P.bg2 : P.accent, roll = P.roll | 0;
    ctx.save(); ctx.beginPath(); ctx.rect(slotX - size, sy - M.cap - size * .2, slotW + size * 2, M.cap + size * .4); ctx.clip();
    ctx.fillStyle = col; ctx.textAlign = 'left';
    const draw = (s, dy, a = 1, sc = 1) => { ctx.save(); ctx.globalAlpha = a; ctx.translate(slotX + (slotW - wW(s)) / 2, sy - M.cap / 2 + dy); ctx.scale(1, sc); ctx.fillText(s, 0, M.cap / 2); ctx.restore(); };
    if (e >= 1 || roll === 3) draw(cur, 0);
    else if (roll === 0){ draw(prev, -e * lh); draw(cur, (1 - e) * lh); }
    else if (roll === 1){ if (e < .5) draw(prev, 0, 1, Math.cos(e * Math.PI)); else draw(cur, 0, 1, -Math.cos(e * Math.PI)); }
    else if (roll === 2){ ctx.translate(-e * slotW * .6, 0); draw(prev, 0, 1 - e); ctx.translate(slotW * .6, 0); draw(cur, 0, e); }
    else {
      const chars = '#%&*+=?/<>ABCDEFGHJKMNPRSTWXYZ', step = Math.floor(api.t * 24), n = cur.length, done = Math.floor(e * n);
      draw([...cur].map((c, i) => i < done || c === ' ' ? c : chars[Math.floor(KT.rnd(i + step, 9) * chars.length)]).join(''), 0);
    }
    ctx.restore();
  } });

/* ---- Emphasis ---- */
FX.register({ id:'kt-emphasis', name:'Emphasis', cat:'type', kind:'2d', desc:'Mark words with *asterisks* and they get highlighted, underlined, circled, recoloured or set in a second font.',
  params:[ X('text','Text (wrap words in *stars*)','Play *harder*.\nRecover *better*.',true), F('font','Font'), F('emFont','Emphasis font','Serif','text'), S('weight','Weight',Util.weights,4), T('upper','Uppercase',false),
    S('style','Emphasis',['Highlighter','Underline draw','Circle scribble','Colour','Font swap','Box invert']), T('slantEm','Slant emphasised words',false), R('margin','Margin',.08,0,.3), R('leading','Leading',1.05,.7,2), S('align','Align',['Left','Centre','Right'],1),
    S('reveal','Reveal',['Words rise','Fade','None']), R('stagger','Stagger',.5,0,1), S('easing','Easing',KT.EASES,4),
    C('ink','Ink','#e4e2dc'), C('em','Emphasis colour','#ff5a36'), C('mark','Mark colour','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const src = P.upper ? String(P.text).toUpperCase() : String(P.text);
    const style = P.style | 0, mg = P.margin * w, E = KT.easeBy(P.easing);
    const emP = { ...P, font:P.emFont };
    const fontFor = (em, s) => KT.font(em && style === 4 ? emP : P, s);
    const lines = src.split('\n').map(l => { const toks = []; KT.emph(l).forEach(seg => seg.text.split(/(\s+)/).forEach(t => { if (t) toks.push({ t, em:seg.em, space:/^\s+$/.test(t) }); })); return toks; });
    const measure = s => { let maxW = 0; lines.forEach(toks => { let x = 0; toks.forEach(k => { ctx.font = fontFor(k.em, s); x += ctx.measureText(k.t).width; }); maxW = Math.max(maxW, x); }); return maxW; };
    let size = 100; const mw = measure(size) || 1; size = size * (w - mg * 2) / mw;
    ctx.font = fontFor(false, size); let M = KT.metrics(ctx, size);
    const blockH = lines.length * size * P.leading; if (blockH > h - mg * 2){ size *= (h - mg * 2) / blockH; ctx.font = fontFor(false, size); M = KT.metrics(ctx, size); }
    const lh = size * P.leading, top = h / 2 - (lines.length - 1) * lh / 2 + M.cap / 2, align = P.align | 0;
    const words = [];
    lines.forEach((toks, li) => {
      let x = 0; const placed = toks.map(k => { ctx.font = fontFor(k.em, size); const wd = ctx.measureText(k.t).width; const o = { ...k, x, w:wd }; x += wd; return o; });
      const x0 = align === 0 ? mg : align === 2 ? w - mg - x : (w - x) / 2;
      placed.forEach(k => { if (!k.space) words.push({ ...k, x:x0 + k.x, y:top + li * lh }); });
    });
    const n = words.length, rev = P.reveal | 0;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    words.forEach((k, i) => {
      const lp = rev === 2 ? 1 : KT.stagger(Util.clamp(api.p * 1.35), i, n, P.stagger), e = E(lp);
      const mp = Util.clamp((api.p - .45) / .45), me = E(mp);
      if (lp <= 0) return;
      ctx.save();
      if (rev === 0){ ctx.beginPath(); ctx.rect(k.x - size, k.y - M.cap - size * .3, k.w + size * 2, M.cap + size * .6); ctx.clip(); ctx.translate(0, (1 - e) * (M.cap + size * .3)); }
      else if (rev === 1) ctx.globalAlpha = e;
      ctx.font = fontFor(k.em, size);
      let fill = P.ink;
      if (k.em){
        if (style === 0 && me > 0){ ctx.save(); ctx.fillStyle = P.mark; ctx.translate(k.x, k.y); ctx.rotate(-.02); KT.roundRect(ctx, -size * .08, -M.cap - size * .1, (k.w + size * .16) * me, M.cap + size * .26, size * .06); ctx.fill(); ctx.restore(); }
        if (style === 1 && me > 0){ ctx.strokeStyle = P.mark; ctx.lineWidth = size * .07; ctx.beginPath(); ctx.moveTo(k.x, k.y + size * .14); ctx.lineTo(k.x + k.w * me, k.y + size * .14 + Math.sin(me * 3) * size * .02); ctx.stroke(); }
        if (style === 2 && me > 0){
          ctx.strokeStyle = P.mark; ctx.lineWidth = size * .045; ctx.beginPath();
          const cx = k.x + k.w / 2, cy = k.y - M.cap / 2, rx = k.w / 2 + size * .25, ry = M.cap * .95;
          for (let s = 0; s <= me * 1.15; s += .01){ const a = -Math.PI * .8 + s * KT.TAU, wob = 1 + Math.sin(s * 9) * .03 + s * .06; const px = cx + Math.cos(a) * rx * wob, py = cy + Math.sin(a) * ry * wob; s ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.stroke();
        }
        if (style === 5 && me > 0){ ctx.fillStyle = P.mark; ctx.fillRect(k.x - size * .1, k.y - M.cap - size * .12, k.w + size * .2, M.cap + size * .3); fill = (P.ground | 0) === 1 ? P.bg : '#141516'; }
        if (style === 3 || style === 4) fill = style === 3 ? (me > .01 ? KT.mixHex(P.ink, P.em, me) : P.ink) : P.em;
        if (style === 0 && me > .5) fill = (P.ground | 0) === 1 ? P.bg : P.ink;
      }
      ctx.fillStyle = fill;
      if (k.em && P.slantEm) KT.slant(ctx, k.x, k.y, .2 * (style === 3 ? me : 1));
      ctx.fillText(k.t, k.x, k.y); ctx.restore();
    });
  } });

/* ---- Type tunnel ---- */
FX.register({ id:'kt-tunnel', name:'Type tunnel', cat:'type', kind:'2d', desc:'A word repeated at ever-larger sizes, zooming endlessly toward you. Loops seamlessly.',
  params:[ ...KT.typeParams('DEEPER'), R('ratio','Step scale',1.45,1.1,3), I('speed','Steps per loop',2,-8,8), R('twist','Twist per step',0,-45,45,1), T('knockout','Knock out behind each copy',true), R('pad','Knockout padding',.25,0,1), R('x','Vanishing X',0,-1,1), R('y','Vanishing Y',0,-1,1), T('outline','Outline alternate',true), T('alternate','Alternate colours',true), R('stroke','Outline weight',1,.2,4),
    C('ink','Ink','#e4e2dc'), C('accent','Alternate','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P).split('\n')[0]; if (!text.trim()) return;
    const base = KT.fit(ctx, P, text, w * .9, null); ctx.font = KT.font(P, 100); const M = KT.metrics(ctx, 100);
    let sp = P.speed | 0; if ((P.outline || P.alternate) && sp % 2) sp += sp > 0 ? 1 : -1;
    const phase = api.loop * sp, cx = (.5 + P.x * .5) * w, cy = (.5 - P.y * .5) * h;
    const kMin = Math.floor(Math.log(4 / base) / Math.log(P.ratio)) - 1, kMax = Math.ceil(Math.log(Math.hypot(w, h) * 3 / base) / Math.log(P.ratio)) + 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    for (let k = kMax; k >= kMin; k--){
      const kk = k + (phase % 1 + 1) % 1, idx = k - Math.floor(phase);
      const s = base * Math.pow(P.ratio, kk - 2); if (s < 2) continue;
      const odd = ((idx % 2) + 2) % 2 === 1;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(kk * P.twist * Math.PI / 180);
      ctx.font = KT.font(P, s); ctx.fillStyle = ctx.strokeStyle = P.alternate && odd ? P.accent : P.ink;
      const big = base * Math.pow(P.ratio, 1.5);
      ctx.globalAlpha = Util.clamp((s - 2) / 12) * (1 - Util.clamp((s - big) / (big * (P.ratio - 1))));
      if (ctx.globalAlpha <= .001){ ctx.restore(); continue; }
      const y = M.cap / 100 * s / 2;
      if (P.knockout){ const tw = ctx.measureText(text).width, cap = M.cap / 100 * s, pd = cap * P.pad; ctx.save(); ctx.fillStyle = (P.ground | 0) === 1 ? P.bg : '#000'; ctx.fillRect(-tw / 2 - pd, -cap / 2 - pd, tw + pd * 2, cap + pd * 2); ctx.restore(); }
      if (P.outline && odd){ ctx.lineWidth = Math.max(1, s * .012 * P.stroke); ctx.strokeText(text, 0, y); } else ctx.fillText(text, 0, y);
      ctx.restore();
    }
  } });

/* ---- LED board ---- */
const ledCache = new Map();
FX.register({ id:'kt-led', name:'LED board', cat:'type', kind:'2d', desc:'Text as a dot-matrix scoreboard: static, scrolling or switching on dot by dot.',
  params:[ ...KT.typeParams('GAME ON'), I('dots','Dot rows',15,6,48), R('gap','Dot gap',.25,0,.7), S('shape','Dot shape',['Round','Square']), S('motion','Motion',['Static','Scroll left','Scroll right','Switch on']), I('speed','Loops per cycle',1,1,6), R('offLevel','Unlit dots',.12,0,.6), T('glow','Glow',true),
    C('on','Lit colour','#ff5a36'), C('off','Unlit colour','#e4e2dc'), ...KT.groundParams(1, '#0d0d0e') ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P).replace(/\n/g, ' '); if (!text.trim()) return;
    const rowsTxt = Math.max(6, P.dots | 0);
    const key = [text, Util.family(P), P.weight, rowsTxt, Assets.version].join('|');
    let bmp = ledCache.get(key);
    if (!bmp){
      const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently:true });
      const fs = rowsTxt * 1.25; x.font = KT.font(P, fs); const tw = Math.ceil(x.measureText(text).width) + 2;
      c.width = tw; c.height = rowsTxt; x.font = KT.font(P, fs); x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
      const cap = x.measureText('H').actualBoundingBoxAscent || fs * .72; x.fillText(text, 1, (rowsTxt + cap) / 2);
      const d = x.getImageData(0, 0, tw, rowsTxt).data, bits = new Uint8Array(tw * rowsTxt);
      for (let i = 0; i < bits.length; i++) bits[i] = d[i * 4 + 3] > 110 ? 1 : 0;
      let x0 = tw, x1 = 0; for (let yy = 0; yy < rowsTxt; yy++) for (let xx = 0; xx < tw; xx++) if (bits[yy * tw + xx]){ x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); }
      bmp = { bits, w:tw, h:rowsTxt, x0:Math.min(x0, x1), x1 }; ledCache.set(key, bmp); if (ledCache.size > 30) ledCache.delete(ledCache.keys().next().value);
    }
    const motion = P.motion | 0, scrolling = motion === 1 || motion === 2;
    const inkW = bmp.x1 - bmp.x0 + 1;
    const rowsView = rowsTxt + 4, pitch = h / rowsView * Math.min(1, scrolling ? 1 : (w / (inkW + 4)) / (h / rowsView));
    const cols = Math.ceil(w / pitch), rows = Math.ceil(h / pitch), r = pitch * (1 - P.gap) / 2;
    const offY = Math.floor((rows - rowsTxt) / 2);
    const period = inkW + Math.max(6, Math.round(cols * .15));
    const shift = scrolling ? Math.floor(api.loop * P.speed * period) * (motion === 1 ? 1 : -1) : 0;
    const startX = scrolling ? 0 : Math.floor((cols - inkW) / 2);
    const lit = (cx, cy) => {
      const by = cy - offY; if (by < 0 || by >= bmp.h) return 0;
      let bx = scrolling ? (((cx + shift) % period) + period) % period : cx - startX;
      if (bx < 0 || bx >= inkW) return 0;
      return bmp.bits[by * bmp.w + bx + bmp.x0];
    };
    const dot = (x, y, rr) => { if ((P.shape | 0) === 1) ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); else { ctx.beginPath(); ctx.arc(x, y, rr, 0, KT.TAU); ctx.fill(); } };
    if (P.offLevel > 0){ ctx.globalAlpha = P.offLevel; ctx.fillStyle = P.off; for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) if (!lit(cx, cy)) dot((cx + .5) * pitch, (cy + .5) * pitch, r); }
    ctx.fillStyle = P.on;
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++){
      if (!lit(cx, cy)) continue;
      if (motion === 3 && KT.rnd(cx * 57 + cy * 13, 3) > api.p * 1.05) continue;
      const x = (cx + .5) * pitch, y = (cy + .5) * pitch;
      if (P.glow){ ctx.globalAlpha = .22; dot(x, y, r * 1.9); }
      ctx.globalAlpha = 1; dot(x, y, r);
    }
    ctx.globalAlpha = 1;
  } });

/* ---- Label stack ---- */
FX.register({ id:'kt-labels', name:'Label stack', cat:'type', kind:'2d', desc:'Words in pills and tags that pop in one by one and pile up, then clear. Loops.',
  params:[ X('text','Labels (one per line)','PADEL\nCOFFEE\nCOMMUNITY\nSUNDAYS\nGOOD TIMES',true), F('font','Font'), S('weight','Weight',Util.weights,3), T('upper','Uppercase',true),
    S('shape','Shape',['Pill','Rounded','Square','Outline pill']), S('layout','Layout',['Stack','Scatter','Column left']), R('size','Size',6,2,20,.1), R('tilt','Tilt',8,0,30,1), R('hold','Hold',.3,0,.8), I('seed','Seed',3,1,99),
    C('accent','Colour 1','#ff5a36'), C('ink','Colour 2','#e4e2dc'), C('ink3','Colour 3','#c9f5e4'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const labels = KT.text(P).split('\n').map(s => s.trim()).filter(Boolean); if (!labels.length) return;
    const mn = Math.min(w, h), size = P.size / 100 * mn, n = labels.length, seed = P.seed | 0, shape = P.shape | 0, lay = P.layout | 0;
    ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size), padX = size * .55, bh = M.cap + size * .7;
    const cols = [P.accent, P.ink, P.ink3];
    const span = 1 - P.hold;
    const stackH = n * bh * 1.08;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center'; ctx.lineWidth = Math.max(1.5, size * .07);
    labels.forEach((lab, i) => {
      const lp = Util.clamp((api.loop - i / n * span * .8) / .08); if (lp <= 0) return;
      const bw = ctx.measureText(lab).width + padX * 2;
      let x, y;
      if (lay === 0){ x = w / 2 + (KT.rnd(i, seed) - .5) * w * .18; y = h / 2 - stackH / 2 + (i + .5) * bh * 1.08; }
      else if (lay === 1){ x = (.18 + .64 * KT.rnd(i, seed)) * w; y = (.15 + .7 * KT.rnd(i + 30, seed)) * h; }
      else { x = mn * .08 + bw / 2 + KT.rnd(i, seed) * w * .12; y = h * .12 + i * bh * 1.15 + bh / 2; }
      const rot = (KT.rnd(i + 5, seed) - .5) * 2 * P.tilt * Math.PI / 180, s = KT.ease.back(lp);
      const col = cols[i % 3], txt = shape === 3 ? col : Identity.readable(col);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
      const r = shape === 2 ? 0 : shape === 1 ? bh * .22 : bh / 2;
      KT.roundRect(ctx, -bw / 2, -bh / 2, bw, bh, r);
      if (shape === 3){ ctx.strokeStyle = col; ctx.stroke(); } else { ctx.fillStyle = col; ctx.fill(); }
      ctx.fillStyle = txt; ctx.fillText(lab, 0, M.cap / 2); ctx.restore();
    });
  } });

/* ---- Style cycle ---- */
FX.register({ id:'kt-cycle', name:'Style cycle', cat:'type', kind:'2d', desc:'One word flicking through your fonts, colours, outlines and cases on the beat.',
  params:[ ...KT.typeParams('IDENTITY'), I('beats','Beats per loop (0 = brand × 2)',0,0,32), T('fonts','Cycle fonts',true), T('colours','Cycle colourways',true), T('outline','Include outline',true), T('cases','Cycle case',false), T('slant','Include slant',true), R('margin','Margin',.1,0,.4), I('seed','Seed',1,1,99),
    C('ink','Ink','#e4e2dc'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api;
    const B = (P.beats | 0) || Identity.beat() * 2, beat = Math.floor(api.loop * B), seed = P.seed | 0;
    const r = k => KT.rnd(beat * 7 + k, seed);
    const fonts = [P.font, ...Assets.fonts().map(f => 'asset:' + f.id), 'Helvetica', 'Serif', 'Mono'];
    const cws = (Assets.identity && Assets.identity.colourways.length) ? Assets.identity.colourways : [{ ink:P.ink, ground:P.bg }];
    const cw = P.colours ? cws[Math.floor(r(1) * cws.length)] : { ink:P.ink, ground:P.bg };
    if ((P.ground | 0) === 1){ ctx.fillStyle = cw.ground; ctx.fillRect(0, 0, w, h); }
    const fP = { ...P, font:P.fonts ? fonts[Math.floor(r(2) * fonts.length)] : P.font };
    let word = String(P.text).split('\n')[0]; const cs = P.cases ? Math.floor(r(3) * 3) : (P.upper ? 0 : 2);
    word = cs === 0 ? word.toUpperCase() : cs === 1 ? word.toLowerCase() : word;
    const mg = P.margin * w, size = KT.fit(ctx, fP, word, w - mg * 2, h * .5);
    ctx.font = KT.font(fP, size); const M = KT.metrics(ctx, size);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.save(); if (P.slant && r(4) > .6) KT.slant(ctx, w / 2, h / 2, .22 * (r(5) > .5 ? 1 : -1));
    ctx.fillStyle = ctx.strokeStyle = (P.ground | 0) === 1 || P.colours ? cw.ink : P.ink;
    if (P.outline && r(6) > .65){ ctx.lineWidth = Math.max(1, size * .02); ctx.strokeText(word, w / 2, h / 2 + M.cap / 2); } else ctx.fillText(word, w / 2, h / 2 + M.cap / 2);
    ctx.restore();
  } });

/* ---- Outline draw ---- */
FX.register({ id:'kt-trace', name:'Outline draw', cat:'type', kind:'2d', desc:'Letter outlines draw themselves on, then fill in. Follows the timeline.', search:['reveal'],
  params:[ ...KT.typeParams('DRAWN'), R('margin','Margin',.1,0,.4), R('leading','Leading',.95,.6,2), R('stroke','Line weight',1.5,.3,6), R('stagger','Stagger',.4,0,1), R('fillAt','Fill starts',.6,0,1), S('easing','Easing',KT.EASES,3),
    C('ink','Line','#e4e2dc'), C('accent','Fill','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P); if (!text.trim()) return;
    const mg = P.margin * w, size = KT.fit(ctx, P, text, w - mg * 2, h - mg * 2, P.leading);
    ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size);
    const L = KT.layout(ctx, text, { font:ctx.font, size, tracking:0 }), pos = KT.place(L, { size, leading:P.leading, cap:M.cap, align:1, x:w / 2, y:h / 2 });
    const all = []; L.lines.forEach((ln, li) => ln.glyphs.forEach(g => { if (!g.space) all.push({ g, li }); }));
    const E = KT.easeBy(P.easing), dashLen = size * 6;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, size * .008 * P.stroke);
    all.forEach(({ g, li }, i) => {
      const lp = KT.stagger(api.p, i, all.length, P.stagger), x = pos[li].x + g.x, y = pos[li].y;
      if (lp <= 0) return;
      const fill = Util.clamp((lp - P.fillAt) / Math.max(.01, 1 - P.fillAt));
      if (fill > 0){ ctx.globalAlpha = E(fill); ctx.fillStyle = P.accent; ctx.fillText(g.ch, x, y); ctx.globalAlpha = 1; }
      ctx.strokeStyle = P.ink; ctx.setLineDash([dashLen * E(Util.clamp(lp / Math.max(.05, P.fillAt))), dashLen]);
      ctx.strokeText(g.ch, x, y);
    });
    ctx.setLineDash([]);
  } });
