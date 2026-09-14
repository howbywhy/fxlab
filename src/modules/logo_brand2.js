/* ---------------- Logo & brand II ----------------
   Identity-system logo motion: stings, lockups, construction,
   colourways, end cards and GLSL logo effects.
--------------------------------------------------- */

/* ---- Logo sting ---- */
FX.register({ id:'lg-sting', name:'Logo sting', cat:'logo', kind:'2d', desc:'The logo builds itself: slices, blocks, iris, split halves or a scan. Follows the timeline.', search:['reveal'],
  params:[ L('logo','Logo'), R('size','Width',55,5,100,.1), R('y','Y',0,-1,1), S('style','Build',['Slices','Blocks','Iris','Split halves','Scan']), I('pieces','Pieces',9,2,40), S('dir','Direction',['Alternate','From left','From right']), R('stagger','Stagger',.55,0,1), S('easing','Easing',KT.EASES,4), R('slant','Motion slant',.8,0,3),
    T('tint','Tint logo',true), C('color','Logo colour','#e4e2dc'), C('accent','Accent','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const src = P.tint ? Assets.tinted(P.logo, P.color) : Assets.image(P.logo); if (!src) return;
    const [lw, lh] = Brand.size(ctx, P, 'logo', w, h, P.size / 100); const x0 = w / 2 - lw / 2, y0 = (.5 - P.y * .5) * h - lh / 2;
    const E = KT.easeBy(P.easing), n = Math.max(2, P.pieces | 0), style = P.style | 0, sw = src.width, sh = src.height;
    if (style === 0){
      for (let i = 0; i < n; i++){
        const lp = KT.stagger(api.p, i, n, P.stagger); if (lp <= 0) continue;
        const e = E(lp), ev = (E(Math.min(1, lp + .02)) - e) / .02;
        const dir = (P.dir | 0) === 0 ? (i % 2 ? 1 : -1) : (P.dir | 0) === 1 ? -1 : 1;
        const sy = i / n * sh, shh = sh / n + 1, dy = y0 + i / n * lh;
        ctx.save(); ctx.translate(dir * (1 - e) * w * .8, 0); KT.motionSlant(ctx, w / 2, dy, -dir * ev * .03 * P.slant);
        ctx.drawImage(src, 0, sy, sw, Math.min(shh, sh - sy), x0, dy, lw, Math.min(lh / n + 1, y0 + lh - dy)); ctx.restore();
        if (e < .98){ ctx.fillStyle = P.accent; ctx.fillRect(dir < 0 ? x0 + lw * e - lw * .02 + dir * (1 - e) * w * .8 : x0 + dir * (1 - e) * w * .8, dy, lw * .02, lh / n); }
      }
    } else if (style === 1){
      const cols = n, rows = Math.max(1, Math.round(n * lh / lw)), rank = KT.orderMap(cols * rows, 3, 11);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++){
        const k = r * cols + c, lp = KT.stagger(api.p, rank[k], cols * rows, P.stagger); if (lp <= 0) continue;
        const s = KT.ease.back(lp), cw = lw / cols, ch = lh / rows, cx = x0 + (c + .5) * cw, cy = y0 + (r + .5) * ch;
        ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
        if (lp < 1){ ctx.fillStyle = P.accent; ctx.globalAlpha = 1 - lp; ctx.fillRect(-cw / 2, -ch / 2, cw, ch); ctx.globalAlpha = 1; }
        ctx.drawImage(src, c / cols * sw, r / rows * sh, sw / cols, sh / rows, -cw / 2 - .5, -ch / 2 - .5, cw + 1, ch + 1); ctx.restore();
      }
    } else if (style === 2){
      const e = E(api.p), R = Math.hypot(lw, lh) / 2 * 1.05 * e, cx = w / 2, cy = y0 + lh / 2;
      if (api.p > 0 && api.p < 1){ ctx.strokeStyle = P.accent; ctx.lineWidth = Math.min(w, h) * .02 * (1 - e); ctx.beginPath(); ctx.arc(cx, cy, R + ctx.lineWidth, 0, KT.TAU); ctx.stroke(); }
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Math.max(0, R), 0, KT.TAU); ctx.clip(); const s = 1.25 - .25 * e; ctx.translate(cx, cy); ctx.scale(s, s); ctx.drawImage(src, -lw / 2, -lh / 2, lw, lh); ctx.restore();
    } else if (style === 3){
      [-1, 1].forEach((d, i) => {
        const lp = KT.stagger(api.p, i, 2, P.stagger * .5); if (lp <= 0) return;
        const e = E(lp), ev = (E(Math.min(1, lp + .02)) - e) / .02;
        ctx.save(); ctx.translate(d * (1 - e) * w * .7, 0); KT.motionSlant(ctx, w / 2, y0 + lh / 2, -d * ev * .03 * P.slant);
        if (d < 0) ctx.drawImage(src, 0, 0, sw / 2, sh, x0, y0, lw / 2, lh); else ctx.drawImage(src, sw / 2, 0, sw / 2, sh, x0 + lw / 2, y0, lw / 2, lh);
        ctx.restore();
      });
    } else {
      const e = E(api.p), line = y0 + lh * e;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, line); ctx.clip(); ctx.drawImage(src, x0, y0, lw, lh); ctx.restore();
      if (api.p > 0 && api.p < 1){ const g = ctx.createLinearGradient(0, line - lh * .08, 0, line); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, P.accent); ctx.fillStyle = g; ctx.globalAlpha = .6; ctx.fillRect(x0 - lw * .1, line - lh * .08, lw * 1.2, lh * .08); ctx.globalAlpha = 1; ctx.fillStyle = P.accent; ctx.fillRect(x0 - lw * .1, line - 1, lw * 1.2, Math.max(2, h * .004)); }
    }
  } });

/* ---- Lockup ---- */
FX.register({ id:'lg-lockup', name:'Lockup', cat:'logo', kind:'2d', desc:'Symbol and wordmark animate into a lockup with correct clear space, horizontal or stacked. Optional guides.',
  params:[ L('symbol','Symbol','symbol'), L('wordmark','Wordmark','wordmark'), S('arrange','Arrangement',['Horizontal','Stacked']), R('size','Width',72,10,100,.1), R('symbolScale','Symbol scale',1.4,.3,4), R('gap','Clear space (× symbol)',.3,0,1.5),
    S('entry','Entrance',['Symbol, then wordmark','Together','Wordmark first']), S('easing','Easing',KT.EASES,4), T('guides','Show clear space',false), T('tint','Tint',true),
    C('color','Logo colour','#e4e2dc'), C('accent','Guides','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const get = k => P.tint ? Assets.tinted(P[k], P.color) : Assets.image(P[k]);
    const sym = get('symbol'), wm = get('wordmark'); if (!sym && !wm) return;
    const E = KT.easeBy(P.easing), horiz = (P.arrange | 0) === 0;
    const wmH = 100, wmW = wm ? wmH * wm.width / wm.height : 0, sH = sym ? wmH * P.symbolScale : 0, sW = sym ? sH * sym.width / sym.height : 0;
    const gap = P.gap * (sym ? sW : wmH);
    let W0 = horiz ? sW + (sym && wm ? gap : 0) + wmW : Math.max(sW, wmW), H0 = horiz ? Math.max(sH, wmH) : sH + (sym && wm ? gap : 0) + wmH;
    let k = P.size / 100 * w / W0; if (H0 * k > h * .8) k = h * .8 / H0;
    const cx = w / 2, cy = h / 2;
    const symFinal = horiz ? [cx - W0 * k / 2 + sW * k / 2, cy] : [cx, cy - H0 * k / 2 + sH * k / 2];
    const wmFinal = horiz ? [cx + W0 * k / 2 - wmW * k / 2, cy] : [cx, cy + H0 * k / 2 - wmH * k / 2];
    const ent = P.entry | 0, p = api.p;
    const sIn = E(Util.clamp(ent === 2 ? (p - .45) / .4 : p / .4)), move = E(Util.clamp(ent === 1 ? 1 : ent === 2 ? 1 : (p - .3) / .4)), wIn = E(Util.clamp(ent === 1 ? p / .5 : ent === 2 ? p / .45 : (p - .5) / .45));
    if (P.guides && p > 0){
      const mgx = gap * k, bx = cx - W0 * k / 2 - mgx, by = cy - H0 * k / 2 - mgx, bw = W0 * k + mgx * 2, bh = H0 * k + mgx * 2;
      ctx.save(); ctx.globalAlpha = Util.clamp(p * 3) * .9; ctx.strokeStyle = P.accent; ctx.lineWidth = Math.max(1, w * .0015); ctx.setLineDash([w * .008, w * .006]);
      ctx.strokeRect(bx, by, bw, bh); ctx.strokeRect(cx - W0 * k / 2, cy - H0 * k / 2, W0 * k, H0 * k); ctx.setLineDash([]);
      ctx.fillStyle = P.accent; ctx.font = `500 ${Math.max(9, w * .014)}px ${Util.fonts[2]}`; ctx.textBaseline = 'bottom'; ctx.fillText(`CLEAR SPACE ${P.gap.toFixed(2)}×`, bx, by - w * .006);
      [[bx, by], [bx + bw - mgx, by], [bx, by + bh - mgx], [bx + bw - mgx, by + bh - mgx]].forEach(([x, y]) => { ctx.globalAlpha = .25; ctx.fillRect(x, y, mgx, mgx); });
      ctx.restore();
    }
    if (wm && wIn > 0){
      const [fx, fy] = wmFinal, ww = wmW * k, wh = wmH * k;
      ctx.save(); ctx.beginPath();
      if (horiz) ctx.rect(fx - ww / 2 - (sym ? gap * k * .5 : 0), fy - wh, ww * 1.2, wh * 2); else ctx.rect(fx - ww, fy - wh / 2 - gap * k * .5, ww * 2, wh * 1.5);
      ctx.clip();
      const off = (1 - wIn) * (horiz ? -ww : -wh * 1.6);
      ctx.drawImage(wm, fx - ww / 2 + (horiz ? off : 0), fy - wh / 2 + (horiz ? 0 : off), ww, wh); ctx.restore();
    }
    if (sym && sIn > 0){
      const startX = wm && ent === 0 ? cx : symFinal[0], startY = wm && ent === 0 ? cy : symFinal[1];
      const x = startX + (symFinal[0] - startX) * move, y = startY + (symFinal[1] - startY) * move, s = (.6 + .4 * sIn);
      ctx.save(); ctx.globalAlpha = Util.clamp(sIn * 2); ctx.translate(x, y); ctx.scale(s, s); ctx.drawImage(sym, -sW * k / 2, -sH * k / 2, sW * k, sH * k); ctx.restore();
    }
  } });

/* ---- Construction ---- */
FX.register({ id:'lg-construct', name:'Construction grid', cat:'logo', kind:'2d', desc:'Brand-guideline style: the logo with keylines, grid, bounding box and clear space drawing in.',
  params:[ L('logo','Logo','symbol'), R('size','Width',50,10,90,.1), S('grid','Guides',['Square grid','Circles & keylines','Both']), I('divisions','Grid divisions',8,2,24), R('clear','Clear space',.2,0,.6), T('labels','Labels',true), X('caption','Caption','CONSTRUCTION'),
    S('easing','Easing',KT.EASES,4), T('tint','Tint logo',true), C('color','Logo colour','#e4e2dc'), C('accent','Guide colour','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const src = P.tint ? Assets.tinted(P.logo, P.color) : Assets.image(P.logo); if (!src) return;
    const [lw, lh] = Brand.size(ctx, P, 'logo', w, h, P.size / 100), x0 = (w - lw) / 2, y0 = (h - lh) / 2, E = KT.easeBy(P.easing), p = api.p;
    const lineW = Math.max(1, Math.min(w, h) * .0016), grid = P.grid | 0, cs = P.clear * Math.max(lw, lh);
    ctx.strokeStyle = P.accent; ctx.lineWidth = lineW;
    const seg = (x1, y1, x2, y2, e) => { if (e <= 0) return; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + (x2 - x1) * e, y1 + (y2 - y1) * e); ctx.stroke(); };
    const g1 = E(Util.clamp(p / .45)), n = P.divisions | 0;
    ctx.globalAlpha = .5;
    if (grid !== 1) for (let i = 0; i <= n; i++){ const e = E(Util.clamp(p / .45 - i / n * .5)); seg(x0 + lw * i / n, y0 - cs, x0 + lw * i / n, y0 + lh + cs, e); seg(x0 - cs, y0 + lh * i / n, x0 + lw + cs, y0 + lh * i / n, e); }
    if (grid !== 0){
      const cx = w / 2, cy = h / 2, R = Math.max(lw, lh) / 2;
      [1, .618, .382].forEach((r, i) => { const e = E(Util.clamp(p / .5 - i * .15)); if (e > 0){ ctx.beginPath(); ctx.arc(cx, cy, R * r, -Math.PI / 2, -Math.PI / 2 + KT.TAU * e); ctx.stroke(); } });
      seg(x0 - cs, y0 - cs, x0 + lw + cs, y0 + lh + cs, g1); seg(x0 + lw + cs, y0 - cs, x0 - cs, y0 + lh + cs, g1);
    }
    ctx.globalAlpha = 1;
    const b = E(Util.clamp((p - .15) / .4));
    ctx.setLineDash([lineW * 5, lineW * 4]);
    if (b > 0){ ctx.strokeRect(x0 - cs * b, y0 - cs * b, lw + cs * 2 * b, lh + cs * 2 * b); }
    ctx.setLineDash([]);
    if (b > 0) ctx.strokeRect(x0, y0, lw, lh);
    const li = E(Util.clamp((p - .35) / .4));
    if (li > 0){ ctx.save(); ctx.globalAlpha = li; ctx.drawImage(src, x0, y0, lw, lh); ctx.restore(); }
    const la = Util.clamp((p - .55) / .3);
    if (P.labels && la > 0){
      const fs = Math.max(9, Math.min(w, h) * .018); ctx.font = `500 ${fs}px ${Util.fonts[2]}`; ctx.fillStyle = P.accent; ctx.globalAlpha = la;
      ctx.textBaseline = 'bottom'; ctx.textAlign = 'left'; ctx.fillText(String(P.caption || '').toUpperCase(), x0 - cs, y0 - cs - fs * .6);
      ctx.textAlign = 'right'; ctx.fillText(`${Math.round(lw / w * 100)}% W`, x0 + lw + cs, y0 - cs - fs * .6);
      ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText(`X = ${P.clear.toFixed(2)}`, x0 - cs, y0 + lh + cs + fs * .6);
      ctx.fillRect(x0 - cs, y0 + lh + cs + fs * 2, cs, Math.max(2, lineW * 2));
      ctx.globalAlpha = 1;
    }
  } });

/* ---- Logo ring ---- */
FX.register({ id:'lg-ring', name:'Logo ring', cat:'logo', kind:'2d', desc:'Copies of a logo orbiting in rings, upright or facing out, with tilt and pulse. Loops seamlessly.', search:['repeat'],
  params:[ L('logo','Logo','symbol'), I('count','Per ring',8,2,40), I('rings','Rings',1,1,5), R('radius','Radius',.34,.05,.6), R('size','Logo size',10,2,40,.1), I('turns','Turns per loop',1,0,4), T('alternate','Alternate direction',true), S('facing','Facing',['Upright','Outward']), R('tilt','Tilt',0,0,.9), R('pulse','Pulse',.2,0,1),
    L('centre','Centre logo',false), R('centreSize','Centre size',22,0,80,.1), T('palette','Colours from palette',false), T('tint','Tint',true), C('color','Colour','#e4e2dc'), C('accent','Alternate','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const mn = Math.min(w, h), cx = w / 2, cy = h / 2, items = [];
    const base = Assets.image(P.logo); if (!base) return;
    for (let r = 0; r < (P.rings | 0); r++){
      const n = Math.max(2, P.count | 0) + r * 4, rad = (P.radius - r * .09) * mn; if (rad <= 0) break;
      const dir = P.alternate && r % 2 ? -1 : 1;
      for (let i = 0; i < n; i++){ const a = (i / n + api.loop * (P.turns | 0) * dir / 1) * KT.TAU - Math.PI / 2; items.push({ a, rad, i, r, depth:Math.sin(a) }); }
    }
    const tilt = P.tilt;
    const draw = it => {
      const x = cx + Math.cos(it.a) * it.rad, y = cy + Math.sin(it.a) * it.rad * (1 - tilt);
      const col = P.palette ? Brand.paletteColor(it.i + it.r * 10, 2, P.color) : (it.i % 2 ? P.accent : P.color);
      const src = P.tint ? Assets.tinted(P.logo, col) : base;
      const s = (1 + P.pulse * .3 * Math.sin(api.loop * KT.TAU * 2 + it.i)) * (tilt ? .75 + .25 * (it.depth * .5 + .5) : 1);
      const lw = P.size / 100 * mn * s, lh = lw * src.height / src.width;
      ctx.save(); ctx.translate(x, y); if ((P.facing | 0) === 1) ctx.rotate(it.a + Math.PI / 2);
      if (tilt) ctx.globalAlpha = .4 + .6 * (it.depth * .5 + .5);
      ctx.drawImage(src, -lw / 2, -lh / 2, lw, lh); ctx.restore();
    };
    const centre = () => { const c = Assets.image(P.centre); if (!c || P.centreSize <= 0) return; const cw = P.centreSize / 100 * mn, ch = cw * c.height / c.width; ctx.drawImage(P.tint ? Assets.tinted(P.centre, P.color) : c, cx - cw / 2, cy - ch / 2, cw, ch); };
    if (tilt){ items.filter(i => i.depth < 0).forEach(draw); centre(); items.filter(i => i.depth >= 0).forEach(draw); }
    else { items.forEach(draw); centre(); }
  } });

/* ---- Colourways ---- */
FX.register({ id:'lg-colourways', name:'Colourways', cat:'logo', kind:'2d', desc:'The logo across your colourways: cutting on the beat, as a grid, or split screen. Uses the System tab colourways (or the palette).',
  params:[ L('logo','Logo'), S('mode','Mode',['Cycle on the beat','Grid of all','Split screen']), I('beats','Beats per loop (0 = brand)',0,0,32), S('cut','Change',['Hard cut','Wipe','Slide']), R('size','Logo width',50,5,100,.1), T('names','Show names',false), S('easing','Easing',KT.EASES,4) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api;
    let cws = Assets.identity && Assets.identity.colourways.length ? Assets.identity.colourways : null;
    if (!cws){ const pal = Assets.palette.length ? Assets.palette : [{ hex:'#141516', name:'Night' }, { hex:'#e4e2dc', name:'Paper' }]; cws = pal.map(c => ({ name:c.name, ground:c.hex, ink:Identity.readable(c.hex) })); }
    const n = cws.length, mode = P.mode | 0, E = KT.easeBy(P.easing), fs = Math.max(10, Math.min(w, h) * .022);
    const panel = (cw, x, y, pw, ph, alpha = 1) => {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, pw, ph); ctx.clip(); ctx.globalAlpha = alpha;
      ctx.fillStyle = cw.ground; ctx.fillRect(x, y, pw, ph);
      const src = Assets.tinted(P.logo, cw.ink);
      if (src){ let lw = pw * P.size / 100, lh = lw * src.height / src.width; if (lh > ph * .8){ lh = ph * .8; lw = lh * src.width / src.height; } ctx.drawImage(src, x + (pw - lw) / 2, y + (ph - lh) / 2, lw, lh); }
      if (P.names){ ctx.fillStyle = cw.ink; ctx.font = `500 ${fs}px ${Util.fonts[2]}`; ctx.textBaseline = 'bottom'; ctx.textAlign = 'left'; ctx.fillText(String(cw.name || '').toUpperCase(), x + fs, y + ph - fs); }
      ctx.restore();
    };
    if (mode === 0){
      const B = KT.beats(P), f = api.loop * B, i = Math.floor(f) % n, prev = (i - 1 + n) % n, lt = E(Util.clamp((f - Math.floor(f)) / .3)), cut = P.cut | 0;
      if (cut === 0 || lt >= 1) panel(cws[i], 0, 0, w, h);
      else if (cut === 1){ panel(cws[prev], 0, 0, w, h); panel(cws[i], 0, 0, w * lt, h); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w * lt, h); ctx.clip(); panel(cws[i], 0, 0, w, h); ctx.restore(); }
      else { ctx.save(); ctx.translate(-w * lt, 0); panel(cws[prev], 0, 0, w, h); ctx.translate(w, 0); panel(cws[i], 0, 0, w, h); ctx.restore(); }
    } else if (mode === 1){
      const cols = Math.ceil(Math.sqrt(n * w / h)), rows = Math.ceil(n / cols), pw = w / cols, ph = h / rows;
      ctx.fillStyle = cws[0].ground; ctx.fillRect(0, 0, w, h);
      cws.forEach((cw, k) => { const lp = KT.stagger(api.p, k, n, .5); if (lp <= 0) return; const e = E(lp); const x = (k % cols) * pw, y = Math.floor(k / cols) * ph; ctx.save(); ctx.beginPath(); ctx.rect(x, y + ph * (1 - e), pw, ph * e); ctx.clip(); panel(cw, x, y, pw, ph); ctx.restore(); });
    } else {
      const pw = w / n;
      cws.forEach((cw, k) => { const lp = KT.stagger(api.p, k, n, .4), e = E(lp); ctx.save(); ctx.beginPath(); ctx.rect(k * pw, 0, pw, h); ctx.clip(); ctx.translate(0, (1 - e) * h); panel(cw, 0, 0, w, h); ctx.restore(); });
    }
  } });

/* ---- Logo assemble ---- */
const assembleCache = new Map();
FX.register({ id:'lg-assemble', name:'Logo assemble', cat:'logo', kind:'2d', desc:'The logo as particles that fly in from scattered, edge or burst positions and lock into shape.', search:['reveal'],
  params:[ L('logo','Logo'), R('size','Width',60,10,100,.1), I('res','Detail',70,20,160), S('from','Start',['Scattered','From the edges','Burst from centre','Rain']), R('stagger','Stagger',.6,0,1), S('easing','Easing',KT.EASES,4), S('shape','Particle',['Square','Round']), R('dot','Particle size',.9,.2,1.5),
    S('colour','Colour',['Logo colours','Single colour','Palette']), C('color','Colour','#e4e2dc'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const a = Assets.get(P.logo), src = Assets.image(P.logo); if (!src || !a) return;
    const cols = P.res | 0, rows = Math.max(1, Math.round(cols * src.height / src.width)), key = a.id + cols;
    let pts = assembleCache.get(key);
    if (!pts){
      const c = document.createElement('canvas'); c.width = cols; c.height = rows; const x = c.getContext('2d', { willReadFrequently:true }); x.drawImage(src, 0, 0, cols, rows);
      const d = x.getImageData(0, 0, cols, rows).data; pts = [];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++){ const k = (j * cols + i) * 4; if (d[k + 3] > 100) pts.push({ i, j, col:`rgb(${d[k]},${d[k + 1]},${d[k + 2]})` }); }
      assembleCache.set(key, pts); if (assembleCache.size > 12) assembleCache.delete(assembleCache.keys().next().value);
    }
    const [lw, lh] = Brand.size(ctx, P, 'logo', w, h, P.size / 100), cell = lw / cols, x0 = (w - lw) / 2, y0 = (h - lh) / 2;
    const E = KT.easeBy(P.easing), from = P.from | 0, n = pts.length, round = (P.shape | 0) === 1, ds = cell * P.dot;
    ctx.fillStyle = P.color;
    pts.forEach((pt, k) => {
      const order = from === 3 ? pt.j / rows + KT.rnd(k, 1) * .15 : from === 2 ? Math.hypot(pt.i / cols - .5, pt.j / rows - .5) : KT.rnd(k, 7);
      const lp = KT.stagger(api.p, order * (n - 1), n, P.stagger); if (lp <= 0 && from !== 0) return;
      const e = E(Util.clamp(lp)), tx = x0 + (pt.i + .5) * cell, ty = y0 + (pt.j + .5) * cell;
      let sx, sy;
      if (from === 0){ sx = KT.rnd(k, 3) * w; sy = KT.rnd(k, 5) * h; }
      else if (from === 1){ const ang = KT.rnd(k, 9) * KT.TAU, R = Math.hypot(w, h) * .6; sx = w / 2 + Math.cos(ang) * R; sy = h / 2 + Math.sin(ang) * R; }
      else if (from === 2){ sx = w / 2; sy = h / 2; }
      else { sx = tx; sy = -cell * 4 - KT.rnd(k, 2) * h * .3; }
      const x = sx + (tx - sx) * e, y = sy + (ty - sy) * e, s = ds * (from === 2 ? .3 + .7 * e : 1);
      const mode = P.colour | 0;
      if (mode === 0) ctx.fillStyle = pt.col; else if (mode === 2) ctx.fillStyle = Brand.paletteColor(k, 4, P.color);
      if (from === 0 && lp <= 0) ctx.globalAlpha = .35; else ctx.globalAlpha = 1;
      if (round){ ctx.beginPath(); ctx.arc(x, y, s / 2, 0, KT.TAU); ctx.fill(); } else ctx.fillRect(x - s / 2, y - s / 2, s, s);
    });
    ctx.globalAlpha = 1;
  } });

/* ---- GLSL logo effects ---- */
FX.register({ id:'lg-glass', name:'Logo glass', cat:'logo', desc:'The logo as a pane of glass that bends the image behind it, with a bright rim.', search:['distort'], ...logoAux,
  params:[ L('logo','Logo','symbol'), R('size','Logo width',55,5,100,.1), R('refract','Refraction',.05,0,.25), R('soft','Softness',3,0,6), R('rim','Rim light',.6,0,2), R('tint','Tint',0,0,1), C('color','Tint colour','#ff5a36'), S('motion','Motion',['None','Float','Breathe']) ],
  fs:`vec4 fx(vec2 uv){
  vec2 q = uv;
  if (p_motion > .5 && p_motion < 1.5) q.y -= .015 * sin(uLoop * TAU);
  if (p_motion > 1.5) q = (q - .5) / (1. + .04 * sin(uLoop * TAU)) + .5;
  float L = p_soft;
  vec2 ts = 1. / vec2(textureSize(uAux, 0)) * pow(2., L) * 1.5;
  float m = textureLod(uAux, q, L).r;
  float gx = textureLod(uAux, q + vec2(ts.x, 0.), L).r - textureLod(uAux, q - vec2(ts.x, 0.), L).r;
  float gy = textureLod(uAux, q + vec2(0., ts.y), L).r - textureLod(uAux, q - vec2(0., ts.y), L).r;
  vec2 g = vec2(gx, gy);
  vec3 col = texture(uInput, uv - g * p_refract * 4.).rgb;
  col = mix(col, col * p_color * 1.4, p_tint * m);
  float rim = clamp(length(g) * 2.5, 0., 1.) * p_rim;
  float spec = clamp(dot(normalize(g + 1e-5), normalize(vec2(-.6, .8))), 0., 1.) * rim;
  col += vec3(spec) * .8 + vec3(rim) * .15;
  return vec4(col, 1.);
}` });

FX.register({ id:'lg-ripple', name:'Logo ripple', cat:'logo', desc:'Logo silhouettes pulse outward in rings, outline or solid bands. Loops seamlessly.', search:['repeat'], ...logoAux,
  params:[ L('logo','Logo','symbol'), R('size','Logo width',24,3,60,.1), I('count','Rings',5,1,16), R('ratio','Ring spacing',1.45,1.05,2), R('thick','Line weight',.025,.005,.2,.001), T('solid','Solid bands',false), I('speed','Loops per cycle',1,1,6),
    C('ink','Ink','#e4e2dc'), C('accent','Alternate','#ff5a36'), ...KT.groundParams(1) ],
  fs:`float maskAt(vec2 uv, float s){ vec2 q = (uv - .5) / s + .5; if (any(lessThan(q, vec2(0.))) || any(greaterThan(q, vec2(1.)))) return 0.; return texture(uAux, q).r; }
vec4 fx(vec2 uv){
  vec3 col = mix(texture(uInput, uv).rgb, p_bg, p_ground < .5 ? 0. : p_bg_a);
  float ph = fract(uLoop * p_speed);
  int n = int(p_count);
  for (int j = 17; j >= 0; j--){
    int k = j - 2;
    if (k >= n) continue;
    float kk = float(k) + ph * 2.;
    float s = pow(p_ratio, kk);
    float a = maskAt(uv, s);
    float band = p_solid > .5 ? a : clamp(a - maskAt(uv, s * (1. - p_thick * 2.)), 0., 1.);
    float parity = mod(float(k) + 2., 2.);
    vec3 c = parity < .5 ? p_ink : p_accent;
    float fade = 1. - smoothstep(float(n) - 2., float(n), kk);
    fade *= smoothstep(0., .6, kk);
    col = mix(col, c, band * fade);
  }
  return vec4(col, 1.);
}` });

FX.register({ id:'lg-dots', name:'Logo dot matrix', cat:'logo', desc:'The logo rebuilt from a grid of dots that pulse, twinkle or sweep.', ...logoAux,
  params:[ L('logo','Logo'), R('size','Logo width',70,5,100,.1), R('cell','Cell (px)',18,4,80,1), S('shape','Dot',['Round','Square','Cross']), S('wave','Motion',['Still','Radial pulse','Diagonal sweep','Twinkle']), R('amount','Motion amount',.6,0,1), R('off','Empty dots',.12,0,1),
    C('ink','Dots','#e4e2dc'), C('accent','Empty dots','#ff5a36'), ...KT.groundParams(1) ],
  fs:`vec4 fx(vec2 uv){
  vec3 col = mix(texture(uInput, uv).rgb, p_bg, p_ground < .5 ? 0. : p_bg_a);
  vec2 px = uv * uRes, cell = vec2(p_cell);
  vec2 id = floor(px / cell), f = fract(px / cell) - .5;
  vec2 cuv = (id + .5) * cell / uRes;
  float m = textureLod(uAux, cuv, log2(max(1., p_cell * float(textureSize(uAux, 0).x) / uRes.x))).r;
  float w = 1.;
  if (p_wave > .5 && p_wave < 1.5) w = .5 + .5 * sin(TAU * (uLoop - length(cuv - .5) * 2.));
  else if (p_wave > 1.5 && p_wave < 2.5) w = .5 + .5 * sin(TAU * (uLoop - (cuv.x + cuv.y) * .5));
  else if (p_wave > 2.5) w = .5 + .5 * sin(TAU * (uLoop + hash12(id)));
  float r = .45 * mix(1., w, p_amount);
  float d = p_shape < .5 ? length(f) : p_shape < 1.5 ? max(abs(f.x), abs(f.y)) : min(max(abs(f.x) * 3., abs(f.y)), max(abs(f.x), abs(f.y) * 3.)) * .6;
  float aa = 1.5 / p_cell;
  float on = (1. - smoothstep(r * m - aa, r * m + aa, d)) * step(.05, m);
  float empty = (1. - smoothstep(.12 - aa, .12 + aa, d)) * p_off * (1. - step(.05, m));
  col = mix(col, p_accent, empty);
  col = mix(col, p_ink, on);
  return vec4(col, 1.);
}` });
