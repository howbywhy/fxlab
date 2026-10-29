/* ---------------- Poster: still images made from layers ----------------
   A separate mode beside Motion. Drop pictures in and arrange them as layers:
   move, scale, rotate, opacity, blend, a few adjustments and a shadow, plus
   text and shape layers. Image layers can take FX Lab treatments and effects,
   rendered once through the motion engine and cached, so the poster itself is
   plain Canvas 2D and exports at any scale.

   The poster has its own document, undo and save file (.fxposter.json); it never
   touches the motion project. It autosaves to this browser's IndexedDB.
------------------------------------------------------------------------ */
const Poster = (() => {
  const P = {
    doc:{ W:1080, H:1350, sizeId:'ig-portrait', bg:'#ffffff', transparent:false, name:'', layers:[] },
    sel:null, media:Object.create(null), view:{ k:1, ox:0, oy:0, fit:true }, dirty:true, on:false,
    exportFmt:'png', exportScale:1, guides:[],
  };
  let seq = 1, mseq = 1;
  const uid = () => 'l' + (seq++) + Math.random().toString(36).slice(2, 6);
  const mid = () => 'm' + (mseq++) + Math.random().toString(36).slice(2, 6);
  const DEG = Math.PI / 180;
  const BLENDS = [
    ['source-over', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'],
    ['darken', 'Darken'], ['lighten', 'Lighten'], ['color-dodge', 'Colour dodge'], ['color-burn', 'Colour burn'],
    ['hard-light', 'Hard light'], ['soft-light', 'Soft light'], ['difference', 'Difference'], ['exclusion', 'Exclusion'],
    ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Colour'], ['luminosity', 'Luminosity'],
  ];
  /* system font stacks only: fxlab ships no fonts */
  const FONTS = [
    ['sans', 'Sans', 'ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif'],
    ['serif', 'Serif', 'ui-serif, Georgia, "Times New Roman", serif'],
    ['mono', 'Mono', 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'],
    ['condensed', 'Condensed', '"Helvetica Neue Condensed", "Arial Narrow", "Roboto Condensed", sans-serif-condensed, sans-serif'],
    ['rounded', 'Rounded', 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", sans-serif'],
    ['custom', 'A font on this computer…', ''],
  ];
  const POSTER_SIZES = [
    ...SIZES.filter(s => s.w),
    { id:'a4-150', label:'A4 portrait · 150 dpi', w:1240, h:1754 },
    { id:'a3-150', label:'A3 portrait · 150 dpi', w:1754, h:2480 },
    { id:'a2-150', label:'A2 portrait · 150 dpi', w:2480, h:3508 },
    { id:'a4-300', label:'A4 portrait · 300 dpi', w:2480, h:3508 },
    { id:'letter-150', label:'US Letter · 150 dpi', w:1275, h:1650 },
    { id:'tabloid-150', label:'Tabloid 11×17 · 150 dpi', w:1650, h:2550 },
    { id:'custom', label:'Custom', w:0, h:0 },
  ];
  const MAX_SIDE = 8192, MEDIA_CAP = 4096, FX_CAP = 2048;
  const ADJ0 = { brightness:100, contrast:100, saturate:100, hue:0, blur:0 };
  const SHADOW0 = { on:false, color:'#000000', alpha:.45, blur:40, x:0, y:16 };

  /* ---------- layers ---------- */
  function baseLayer(type, name){
    return { id:uid(), type, name, x:P.doc.W / 2, y:P.doc.H / 2, sx:1, sy:1, rot:0, flipX:false, flipY:false,
      opacity:1, blend:'source-over', visible:true, locked:false, adjust:{ ...ADJ0 }, shadow:{ ...SHADOW0 } };
  }
  const measure = document.createElement('canvas').getContext('2d');
  function fontOf(t){
    const f = FONTS.find(x => x[0] === t.font) || FONTS[0];
    const fam = t.font === 'custom' ? `"${String(t.custom || 'Helvetica').replace(/["\\]/g, '')}", ${FONTS[0][2]}` : f[2];
    return `${t.italic ? 'italic ' : ''}${t.weight} ${t.size}px ${fam}`;
  }
  function textLines(t){ return String(t.upper ? t.text.toUpperCase() : t.text).split('\n'); }
  function setTextCtx(ctx, t){
    ctx.font = fontOf(t);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(t.tracking || 0) * t.size / 1000}px`;
    ctx.textBaseline = 'alphabetic';
  }
  /* natural, unscaled size of a layer's box */
  function size(L){
    if (L.type === 'image') return { w:L.image.w, h:L.image.h };
    if (L.type === 'shape') return { w:L.shape.w, h:L.shape.h };
    const t = L.text; setTextCtx(measure, t);
    const lines = textLines(t);
    const w = Math.max(t.size * .3, ...lines.map(s => measure.measureText(s || ' ').width));
    return { w:Math.ceil(w + t.size * .1), h:Math.ceil(t.size * (t.leading * (lines.length - 1) + 1.2)) };
  }
  const cur = () => P.doc.layers.find(l => l.id === P.sel) || null;
  const labelFor = (type, name) => { const n = P.doc.layers.filter(l => l.type === type).length + 1; return name || `${type === 'image' ? 'Image' : type === 'text' ? 'Text' : 'Shape'} ${n}`; };

  function addLayer(L, at){
    P.doc.layers.push(L); P.sel = L.id;
    if (at){ L.x = at.x; L.y = at.y; }
    touch(); renderPanels();
    return L;
  }
  function fitScale(w, h, frac){ return Math.min(P.doc.W * frac / w, P.doc.H * frac / h); }
  function addImageLayer(m, at, name){
    const L = baseLayer('image', labelFor('image', name));
    L.image = { media:m.id, w:m.w, h:m.h }; L.fx = [];
    const s = Math.min(1, fitScale(m.w, m.h, .8)); L.sx = L.sy = s;
    return addLayer(L, at);
  }
  function addText(){
    const L = baseLayer('text', labelFor('text'));
    L.text = { text:'Text', font:'sans', custom:'', size:Math.round(P.doc.W / 8), weight:700, italic:false, color:'#111111', align:'left', tracking:0, leading:1.05, upper:false };
    hist.record(() => addLayer(L));
  }
  function addShape(kind){
    const L = baseLayer('shape', labelFor('shape', kind === 'ellipse' ? 'Ellipse' : 'Rectangle'));
    const s = Math.round(Math.min(P.doc.W, P.doc.H) * .4);
    L.shape = { kind, w:s, h:s, fill:'#e8442e', radius:0 };
    hist.record(() => addLayer(L));
  }

  /* ---------- media ---------- */
  function capCanvas(src, w, h, cap){
    const s = Math.min(1, cap / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  function loadImageURL(url){
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file could not be read as an image')); i.src = url; });
  }
  async function mediaFromBlob(blob, name, id){
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImageURL(url);
      let w = img.naturalWidth, h = img.naturalHeight, el = img;
      const svg = /svg/.test(blob.type) || /\.svg$/i.test(name || '');
      if (svg){ if (!w || !h){ w = 1024; h = 1024; } const s = 2048 / Math.max(w, h); el = capCanvas(img, w * s, h * s, 2048); w = el.width; h = el.height; }
      else if (Math.max(w, h) > MEDIA_CAP){ el = capCanvas(img, w, h, MEDIA_CAP); w = el.width; h = el.height; }
      const m = { id:id || mid(), el, w, h, name:name || 'image', blob };
      P.media[m.id] = m;
      return m;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  const canvasToBlob = (c, type = 'image/png', q) => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Canvas export failed')), type, q));
  async function addFiles(files, at){
    const imgs = [...files].filter(f => /^image\//.test(f.type) || /\.svg$/i.test(f.name));
    const project = [...files].find(f => /\.fxposter\.json$/i.test(f.name) || (f.type === 'application/json' && !imgs.length));
    if (project && !imgs.length){ openText(await project.text()); return; }
    if (!imgs.length){ toast('Poster takes images: PNG, JPEG, WebP, GIF or SVG.', true); return; }
    hist.begin();
    let i = 0;
    for (const f of imgs){
      try {
        const m = await mediaFromBlob(f, f.name);
        const off = at ? { x:at.x + i * 24, y:at.y + i * 24 } : null;
        addImageLayer(m, off, f.name.replace(/\.[a-z0-9]+$/i, '')); i++;
      } catch (e){ toast(`${f.name}: ${e.message}`, true); }
    }
    hist.end();
  }
  /* the motion composition as it is now, at full size, as a picture */
  async function addMotionFrame(){
    if (!Engine.gl) return;
    let c;
    App.exporting = true;
    try {
      Engine.setSize(state.W, state.H, 1); resetAllFeedback(); renderAt(App.t);
      c = document.createElement('canvas'); c.width = Engine.canvas.width; c.height = Engine.canvas.height;
      c.getContext('2d').drawImage(Engine.canvas, 0, 0);
    } finally { Engine.setSize(state.W, state.H, state.quality); resetAllFeedback(); App.exporting = false; markDirty(); }
    const blob = await canvasToBlob(c);
    const m = { id:mid(), el:c, w:c.width, h:c.height, name:'Motion frame', blob };
    P.media[m.id] = m;
    hist.record(() => addImageLayer(m, null, 'Motion frame'));
    toast(`Added the Motion frame at ${c.width}×${c.height}`);
  }

  /* ---------- effects: FX Lab modules on an image layer ----------
     Rendered through the motion engine at up to FX_CAP px, once per change, and
     cached. The engine is borrowed and put back exactly as it was. */
  const fxEligible = m => m && (m.cat === 'treatment' || m.cat === 'fx') && !m.feedback && !/^fx-svg-/.test(m.id);
  const bakes = new Map();
  let bakeTimer = 0;
  const fxKey = L => L.image.media + '|' + JSON.stringify((L.fx || []).filter(i => i.on).map(i => [i.id, i.params]));
  function bakedFor(L){
    if (L.type !== 'image' || !L.fx || !L.fx.some(i => i.on)) return null;
    const b = bakes.get(L.id), key = fxKey(L);
    if (!b || b.key !== key){ clearTimeout(bakeTimer); bakeTimer = setTimeout(bakeAll, 90); }
    return b ? b.canvas : null;
  }
  function bakeAll(){
    for (const L of P.doc.layers){
      if (L.type !== 'image' || !L.fx || !L.fx.some(i => i.on)) continue;
      const key = fxKey(L), b = bakes.get(L.id);
      if (b && b.key === key) continue;
      try { bakes.set(L.id, { key, canvas:bake(L, b && b.canvas) }); }
      catch (e){ console.error(e); toast(`Couldn’t apply that effect: ${e.message || e}`, true); }
    }
    P.dirty = true;
  }
  function bake(L, reuse){
    const m = P.media[L.image.media]; if (!m) return null;
    const src = Math.max(m.w, m.h) > FX_CAP ? capCanvas(m.el, m.w, m.h, FX_CAP) : m.el;
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
    const saved = { ...Engine.media.A }, savedBack = Engine.backColor, savedCheck = Engine.backCheck, on = { ...App.stageOn };
    const temp = {
      sizeId:'custom', W:w, H:h, quality:1, bg:'#000000', duration:state.duration, fps:state.fps,
      sources:{ A:{ fit:0, zoom:1, x:0, y:0, process:[] }, B:state.sources.B }, base:makeInst('src-a'),
      stack:L.fx.filter(i => i.on), print:null, transparent:false,
    };
    const c = reuse && reuse.width === w && reuse.height === h ? reuse : document.createElement('canvas');
    App.exporting = true;
    try {
      Engine.setSize(w, h, 1); Engine.resetFeedback(temp.stack);
      Engine.setMedia('A', src, w, h, false);
      Engine.backColor = [0, 0, 0]; Engine.backCheck = false; App.stageOn.prepare = App.stageOn.finish = true;
      Engine.frame(temp, 0, { t:0, p:1, loop:0, dur:state.duration, fps:state.fps });
      c.width = w; c.height = h;
      const x = c.getContext('2d'); x.clearRect(0, 0, w, h); x.drawImage(Engine.canvas, 0, 0);
      /* the engine renders opaque; give the picture back its own alpha */
      x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0, w, h); x.globalCompositeOperation = 'source-over';
    } finally {
      Engine.setMedia('A', saved.el, saved.w, saved.h, saved.video);
      Engine.backColor = savedBack; Engine.backCheck = savedCheck; Object.assign(App.stageOn, on);
      Engine.setSize(state.W, state.H, state.quality); resetAllFeedback();
      App.exporting = false; markDirty();
    }
    return c;
  }

  /* ---------- drawing ---------- */
  function filterOf(a, k){
    const f = [];
    if (a.brightness !== 100) f.push(`brightness(${a.brightness}%)`);
    if (a.contrast !== 100) f.push(`contrast(${a.contrast}%)`);
    if (a.saturate !== 100) f.push(`saturate(${a.saturate}%)`);
    if (a.hue) f.push(`hue-rotate(${a.hue}deg)`);
    if (a.blur) f.push(`blur(${a.blur * k}px)`);
    return f.length ? f.join(' ') : 'none';
  }
  function drawLayer(ctx, L, k){
    const { w, h } = size(L);
    ctx.save();
    ctx.globalAlpha = L.opacity; ctx.globalCompositeOperation = L.blend;
    ctx.filter = filterOf(L.adjust, k);
    const sh = L.shadow;
    if (sh.on){
      const [r, g, b] = Util.hexToRgb(sh.color);
      ctx.shadowColor = `rgba(${r},${g},${b},${sh.alpha})`;
      ctx.shadowBlur = sh.blur * k; ctx.shadowOffsetX = sh.x * k; ctx.shadowOffsetY = sh.y * k;
    }
    ctx.translate(L.x, L.y); ctx.rotate(L.rot * DEG); ctx.scale(L.sx * (L.flipX ? -1 : 1), L.sy * (L.flipY ? -1 : 1));
    if (L.type === 'image'){
      const m = P.media[L.image.media];
      const src = bakedFor(L) || (m && m.el);
      if (src) ctx.drawImage(src, -w / 2, -h / 2, w, h);
    } else if (L.type === 'shape'){
      const s = L.shape; ctx.fillStyle = s.fill; ctx.beginPath();
      if (s.kind === 'ellipse') ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      else if (s.radius > 0 && ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(s.radius, w / 2, h / 2));
      else ctx.rect(-w / 2, -h / 2, w, h);
      ctx.fill();
    } else {
      const t = L.text; setTextCtx(ctx, t); ctx.fillStyle = t.color;
      ctx.textAlign = t.align;
      const ax = t.align === 'left' ? -w / 2 + t.size * .05 : t.align === 'right' ? w / 2 - t.size * .05 : 0;
      textLines(t).forEach((s, i) => ctx.fillText(s, ax, -h / 2 + t.size * (.95 + i * t.leading)));
    }
    ctx.restore();
  }
  /* the whole poster into ctx, at k output pixels per poster pixel */
  function drawDoc(ctx, k, opaque){
    const d = P.doc;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (!d.transparent || opaque){ ctx.fillStyle = d.transparent ? '#ffffff' : d.bg; ctx.fillRect(0, 0, d.W, d.H); }
    for (const L of d.layers) if (L.visible) drawLayer(ctx, L, k);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ---------- stage ---------- */
  let stage, sctx, docC, dctx, wrap;
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);
  function fitView(){
    const r = wrap.getBoundingClientRect(), pad = 48;
    const k = Math.max(.02, Math.min((r.width - pad * 2) / P.doc.W, (r.height - pad * 2) / P.doc.H));
    P.view = { k, ox:(r.width - P.doc.W * k) / 2, oy:(r.height - P.doc.H * k) / 2, fit:true };
  }
  function resizeStage(){
    const r = wrap.getBoundingClientRect(), s = dpr();
    stage.width = Math.max(2, Math.round(r.width * s)); stage.height = Math.max(2, Math.round(r.height * s));
    stage.style.width = r.width + 'px'; stage.style.height = r.height + 'px';
    if (P.view.fit) fitView();
    P.dirty = true;
  }
  const toDoc = (cx, cy) => { const r = stage.getBoundingClientRect(); return { x:(cx - r.left - P.view.ox) / P.view.k, y:(cy - r.top - P.view.oy) / P.view.k }; };
  const toScreen = (x, y) => ({ x:P.view.ox + x * P.view.k, y:P.view.oy + y * P.view.k });
  function corners(L){
    const { w, h } = size(L), c = Math.cos(L.rot * DEG), s = Math.sin(L.rot * DEG);
    const at = (u, v) => { const lx = u * w * L.sx / 2, ly = v * h * L.sy / 2; return { x:L.x + lx * c - ly * s, y:L.y + lx * s + ly * c }; };
    return { at, w:w * L.sx, h:h * L.sy };
  }
  function hit(L, p){
    const { w, h } = size(L), c = Math.cos(-L.rot * DEG), s = Math.sin(-L.rot * DEG);
    const dx = p.x - L.x, dy = p.y - L.y, lx = dx * c - dy * s, ly = dx * s + dy * c;
    return Math.abs(lx) <= Math.abs(w * L.sx) / 2 && Math.abs(ly) <= Math.abs(h * L.sy) / 2;
  }
  const HANDLES = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  function handleAt(L, cx, cy){
    const r = stage.getBoundingClientRect(), mx = cx - r.left, my = cy - r.top, { at } = corners(L);
    const rp = rotHandle(L), rs = toScreen(rp.x, rp.y);
    if (Math.hypot(mx - rs.x, my - rs.y) < 10) return { rot:true };
    for (const [u, v] of HANDLES){ const q = at(u, v), s = toScreen(q.x, q.y); if (Math.hypot(mx - s.x, my - s.y) < 9) return { u, v }; }
    return null;
  }
  function rotHandle(L){
    const { at } = corners(L), top = at(0, -1), c = { x:L.x, y:L.y };
    const dx = top.x - c.x, dy = top.y - c.y, len = Math.hypot(dx, dy) || 1, off = 28 / P.view.k;
    return { x:top.x + dx / len * off, y:top.y + dy / len * off, top };
  }
  function drawStage(){
    if (!P.on || !stage) return;
    const s = dpr(), { k, ox, oy } = P.view, d = P.doc;
    const dw = Math.max(1, Math.round(d.W * k * s)), dh = Math.max(1, Math.round(d.H * k * s));
    if (docC.width !== dw || docC.height !== dh){ docC.width = dw; docC.height = dh; }
    drawDoc(dctx, k * s);
    sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, stage.width, stage.height);
    sctx.setTransform(s, 0, 0, s, 0, 0);
    /* a checkerboard shows through a transparent poster */
    if (d.transparent){
      sctx.save(); sctx.beginPath(); sctx.rect(ox, oy, d.W * k, d.H * k); sctx.clip();
      const q = 12; for (let y = 0; y * q < d.H * k; y++) for (let x = 0; x * q < d.W * k; x++){ sctx.fillStyle = (x + y) % 2 ? '#2b2c30' : '#3a3b40'; sctx.fillRect(ox + x * q, oy + y * q, q, q); }
      sctx.restore();
    }
    sctx.shadowColor = 'rgba(0,0,0,.5)'; sctx.shadowBlur = 40; sctx.shadowOffsetY = 16;
    sctx.drawImage(docC, ox, oy, d.W * k, d.H * k);
    sctx.shadowColor = 'transparent';
    /* centre guides while snapping */
    sctx.strokeStyle = '#ff5ad1'; sctx.lineWidth = 1;
    for (const g of P.guides){
      sctx.beginPath();
      if (g.x != null){ const x = Math.round(ox + g.x * k) + .5; sctx.moveTo(x, oy); sctx.lineTo(x, oy + d.H * k); }
      else { const y = Math.round(oy + g.y * k) + .5; sctx.moveTo(ox, y); sctx.lineTo(ox + d.W * k, y); }
      sctx.stroke();
    }
    const L = cur();
    if (L && L.visible){
      const { at } = corners(L), pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const q = at(u, v); return toScreen(q.x, q.y); });
      sctx.strokeStyle = L.locked ? '#a8a6a0' : '#c9f5e4'; sctx.lineWidth = 1.25;
      sctx.beginPath(); pts.forEach((q, i) => i ? sctx.lineTo(q.x, q.y) : sctx.moveTo(q.x, q.y)); sctx.closePath(); sctx.stroke();
      if (!L.locked){
        const rp = rotHandle(L), a = toScreen(rp.top.x, rp.top.y), b = toScreen(rp.x, rp.y);
        sctx.beginPath(); sctx.moveTo(a.x, a.y); sctx.lineTo(b.x, b.y); sctx.stroke();
        sctx.fillStyle = '#c9f5e4'; sctx.beginPath(); sctx.arc(b.x, b.y, 5, 0, Math.PI * 2); sctx.fill();
        for (const [u, v] of HANDLES){ const q = at(u, v), p = toScreen(q.x, q.y); sctx.fillStyle = '#1a1b1d'; sctx.fillRect(p.x - 4.5, p.y - 4.5, 9, 9); sctx.strokeRect(p.x - 4.5, p.y - 4.5, 9, 9); }
      }
    }
    $('#pZoom').textContent = `${Math.round(k * 100)}%`;
    $('#pEmpty').hidden = d.layers.length > 0;
  }

  /* pointer: select, move, scale from the opposite handle, rotate */
  let drag = null;
  function onDown(e){
    if (e.button === 1 || (e.button === 0 && spaceHeld)){ drag = { pan:true, sx:e.clientX, sy:e.clientY, ox:P.view.ox, oy:P.view.oy }; stage.setPointerCapture(e.pointerId); return; }
    if (e.button) return;
    stage.focus({ preventScroll:true });
    const p = toDoc(e.clientX, e.clientY);
    let L = cur(), h = L && !L.locked && L.visible ? handleAt(L, e.clientX, e.clientY) : null;
    if (!h){
      const top = [...P.doc.layers].reverse().find(l => l.visible && !l.locked && hit(l, p));
      if (top !== L){ P.sel = top ? top.id : null; renderPanels(); }
      L = top;
    }
    if (!L){ P.dirty = true; return; }
    hist.begin();
    const sz = size(L);
    if (h && h.rot) drag = { L, rot:true, a0:Math.atan2(p.y - L.y, p.x - L.x), r0:L.rot };
    else if (h){
      const { at } = corners(L), anchor = at(-h.u, -h.v);
      drag = { L, u:h.u, v:h.v, anchor, sx0:L.sx, sy0:L.sy, w:sz.w, h:sz.h };
    } else drag = { L, move:true, dx:p.x - L.x, dy:p.y - L.y };
    stage.setPointerCapture(e.pointerId);
    P.dirty = true;
  }
  function onMove(e){
    if (!drag){
      const L = cur(), h = L && !L.locked ? handleAt(L, e.clientX, e.clientY) : null;
      stage.style.cursor = spaceHeld ? 'grab' : h ? (h.rot ? 'crosshair' : 'pointer') : 'default';
      return;
    }
    if (drag.pan){ P.view.ox = drag.ox + e.clientX - drag.sx; P.view.oy = drag.oy + e.clientY - drag.sy; P.view.fit = false; P.dirty = true; return; }
    const L = drag.L, p = toDoc(e.clientX, e.clientY);
    if (drag.move){
      let x = p.x - drag.dx, y = p.y - drag.dy; P.guides = [];
      if (!e.altKey){
        const t = 6 / P.view.k;
        if (Math.abs(x - P.doc.W / 2) < t){ x = P.doc.W / 2; P.guides.push({ x }); }
        if (Math.abs(y - P.doc.H / 2) < t){ y = P.doc.H / 2; P.guides.push({ y }); }
      }
      L.x = x; L.y = y;
    } else if (drag.rot){
      let r = drag.r0 + (Math.atan2(p.y - L.y, p.x - L.x) - drag.a0) / DEG;
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      L.rot = ((r % 360) + 540) % 360 - 180;
    } else {
      const c = Math.cos(-L.rot * DEG), s = Math.sin(-L.rot * DEG);
      const dx = p.x - drag.anchor.x, dy = p.y - drag.anchor.y, lx = dx * c - dy * s, ly = dx * s + dy * c;
      let sx = drag.u ? Math.max(.01, lx * drag.u / drag.w) : drag.sx0, sy = drag.v ? Math.max(.01, ly * drag.v / drag.h) : drag.sy0;
      /* corners keep the proportions unless Shift is held */
      if (drag.u && drag.v && !e.shiftKey){ const f = Math.max(sx / drag.sx0, sy / drag.sy0); sx = drag.sx0 * f; sy = drag.sy0 * f; }
      L.sx = sx; L.sy = sy;
      const cc = Math.cos(L.rot * DEG), ss = Math.sin(L.rot * DEG), hx = drag.u * drag.w * sx / 2, hy = drag.v * drag.h * sy / 2;
      L.x = drag.anchor.x + hx * cc - hy * ss; L.y = drag.anchor.y + hx * ss + hy * cc;
    }
    touch(); syncFields();
  }
  function onUp(){
    if (!drag) return;
    const was = drag; drag = null; P.guides = []; P.dirty = true;
    if (!was.pan){ hist.end(); syncFields(); }
  }
  function onWheel(e){
    e.preventDefault();
    if (e.ctrlKey || e.metaKey){
      const r = stage.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      zoomAt(P.view.k * Math.exp(-e.deltaY * .01), mx, my);
    } else { P.view.ox -= e.deltaX; P.view.oy -= e.deltaY; P.view.fit = false; P.dirty = true; }
  }
  function zoomAt(k, mx, my){
    k = Util.clamp(k, .02, 8);
    if (mx == null){ const r = stage.getBoundingClientRect(); mx = r.width / 2; my = r.height / 2; }
    const x = (mx - P.view.ox) / P.view.k, y = (my - P.view.oy) / P.view.k;
    P.view = { k, ox:mx - x * k, oy:my - y * k, fit:false }; P.dirty = true;
  }

  /* ---------- history: snapshots of the document, session only ---------- */
  const snap = () => JSON.stringify({ doc:P.doc, sel:P.sel });
  const hist = {
    past:[], future:[], txn:null,
    begin(){ if (!this.txn) this.txn = snap(); },
    end(){
      if (!this.txn) return;
      const before = this.txn; this.txn = null;
      if (before === snap()) return;
      this.past.push(before); if (this.past.length > 100) this.past.shift(); this.future = []; sync();
    },
    record(fn){ const nested = !!this.txn; this.begin(); fn(); if (!nested) this.end(); },
    undo(){ this.end(); const s = this.past.pop(); if (!s) return; this.future.push(snap()); restore(s); },
    redo(){ this.end(); const s = this.future.pop(); if (!s) return; this.past.push(snap()); restore(s); },
  };
  function restore(s){ const o = JSON.parse(s); P.doc = o.doc; P.sel = o.sel; touch(); renderAll(); sync(); }
  function sync(){ $('#pUndo').disabled = !hist.past.length; $('#pRedo').disabled = !hist.future.length; }

  /* ---------- save, open, autosave ---------- */
  const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  const usedMedia = () => [...new Set(P.doc.layers.filter(l => l.type === 'image').map(l => l.image.media))].filter(id => P.media[id]);
  const posterName = () => (P.doc.name && P.doc.name.trim()) || 'poster';
  async function save(){
    const media = {};
    for (const id of usedMedia()) media[id] = { name:P.media[id].name, data:await blobToDataURL(P.media[id].blob) };
    const out = JSON.stringify({ fxposter:1, doc:P.doc, media });
    triggerDownload(new Blob([out], { type:'application/json' }), `${slugName(posterName())}.fxposter.json`);
    toast('Saved the poster file. It carries its images, so it opens on any computer.');
  }
  async function openText(text){
    let o; try { o = JSON.parse(text); } catch { toast('That file isn’t a poster file. Open a .fxposter.json saved from Poster.', true); return; }
    if (!o || !o.fxposter || !o.doc){ toast('That file isn’t a poster file. Open a .fxposter.json saved from Poster.', true); return; }
    for (const [id, m] of Object.entries(o.media || {})){
      try { const b = await (await fetch(m.data)).blob(); await mediaFromBlob(b, m.name, id); } catch { /* the layer shows as empty */ }
    }
    hist.record(() => { P.doc = normalise(o.doc); P.sel = null; });
    bakes.clear(); fitView(); touch(); renderAll();
  }
  function normalise(d){
    const doc = { W:1080, H:1350, sizeId:'custom', bg:'#ffffff', transparent:false, name:'', layers:[], ...d };
    doc.layers = (doc.layers || []).filter(l => l && ['image', 'text', 'shape'].includes(l.type)).map(l => ({ ...baseLayer(l.type, l.name), ...l, adjust:{ ...ADJ0, ...l.adjust }, shadow:{ ...SHADOW0, ...l.shadow } }));
    doc.layers.forEach(l => { if (l.fx) l.fx = l.fx.filter(i => FX.byId[i.id]).map(i => ({ ...makeInst(i.id), on:i.on !== false, params:{ ...makeInst(i.id).params, ...i.params } })); });
    return doc;
  }
  let saveTimer = 0;
  function touch(){ P.dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 900); }
  function autosave(){
    if (!Assets.metaPut) return;
    const media = {}; for (const id of usedMedia()) media[id] = { name:P.media[id].name, blob:P.media[id].blob };
    Assets.metaPut('poster', { doc:JSON.parse(JSON.stringify(P.doc)), media });
  }
  async function restoreSaved(){
    try {
      await Assets.ready;
      const o = Assets.metaGet && await Assets.metaGet('poster');
      if (!o || !o.doc || P.doc.layers.length) return;
      for (const [id, m] of Object.entries(o.media || {})){ try { if (m.blob) await mediaFromBlob(m.blob, m.name, id); } catch { /* skipped */ } }
      P.doc = normalise(o.doc); P.sel = null;
      if (wrap) fitView();
      renderAll();
    } catch (e){ console.warn('fxlab: poster restore failed', e); }
  }

  /* ---------- export ---------- */
  async function exportImage(){
    const s = P.exportScale, d = P.doc, w = Math.round(d.W * s), h = Math.round(d.H * s);
    if (Math.max(w, h) > MAX_SIDE){ toast(`That would be ${w}×${h} px. The largest export is ${MAX_SIDE} px on the long side; pick a smaller scale.`, true, 6000); return; }
    bakeAll();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const jpg = P.exportFmt === 'jpeg';
    drawDoc(c.getContext('2d'), s, jpg);
    const blob = await canvasToBlob(c, jpg ? 'image/jpeg' : 'image/png', .92);
    await download(blob, `${slugName(posterName())}.${jpg ? 'jpg' : 'png'}`);
    toast(`Exported ${jpg ? 'JPEG' : 'PNG'} at ${w}×${h}${!jpg && d.transparent ? ' with transparency' : ''}`);
  }

  /* ---------- panels ---------- */
  function rangeRow(label, get, set, min, max, step, def, unit = ''){
    const row = el('div', 'prm'), lab = el('label', null, label);
    const r = el('input'); Object.assign(r, { type:'range', min, max, step, value:get() }); r.setAttribute('aria-label', label);
    const num = el('input', 'val'); num.type = 'text'; num.value = fmt(get(), step) + unit; num.setAttribute('aria-label', `${label} value`);
    const apply = v => { v = Util.clamp(v, min, max); set(v); r.value = v; num.value = fmt(v, step) + unit; lab.classList.toggle('mod', Math.abs(v - def) > step / 2); touch(); };
    r.oninput = () => { hist.begin(); apply(+r.value); };
    r.onchange = () => hist.end();
    num.onchange = () => { const v = parseFloat(num.value); if (!isNaN(v)) hist.record(() => apply(v)); else num.value = fmt(get(), step) + unit; };
    lab.title = 'Drag to change (Shift ×10, Alt ×0.1). Double-click to reset.'; lab.classList.add('scrub');
    lab.ondblclick = () => hist.record(() => apply(def));
    let sx = null, sv = 0;
    lab.addEventListener('pointerdown', e => { if (e.button) return; sx = e.clientX; sv = get(); lab.setPointerCapture(e.pointerId); hist.begin(); e.preventDefault(); });
    lab.addEventListener('pointermove', e => { if (sx == null) return; let v = sv + (e.clientX - sx) / 300 * (max - min) * (e.shiftKey ? 10 : e.altKey ? .1 : 1); v = Math.round(v / step) * step; apply(v); });
    const done = () => { if (sx == null) return; sx = null; hist.end(); };
    lab.addEventListener('pointerup', done); lab.addEventListener('pointercancel', done);
    lab.classList.toggle('mod', Math.abs(get() - def) > step / 2);
    row.append(lab, r, num);
    return row;
  }
  function numField(label, get, set, step = 1){
    const w = el('label', 'pnum'); w.append(el('span', null, label));
    const i = el('input'); i.type = 'number'; i.step = step; i.value = +(+get()).toFixed(2); i.setAttribute('aria-label', label);
    i.onchange = () => { const v = parseFloat(i.value); if (!isNaN(v)) hist.record(() => { set(v); touch(); }); i.value = +(+get()).toFixed(2); };
    w.append(i); w._sync = () => { if (document.activeElement !== i) i.value = +(+get()).toFixed(2); };
    return w;
  }
  function selectRow(label, options, get, set){
    const row = el('div', 'prm wide'); row.append(el('label', null, label));
    const s = el('select'); s.setAttribute('aria-label', label);
    options.forEach(([v, n]) => { const o = el('option', null, n); o.value = v; s.append(o); }); s.value = String(get());
    s.onchange = () => hist.record(() => { set(s.value); touch(); });
    row.append(s); return row;
  }
  function colourRow(label, get, set){
    const row = el('div', 'prm wide'); row.append(el('label', null, label));
    const c = el('input'); c.type = 'color'; c.value = get(); c.setAttribute('aria-label', label);
    c.oninput = () => { hist.begin(); set(c.value); touch(); }; c.onchange = () => hist.end();
    const sw = el('div', 'swatches');
    (Assets.palette || []).forEach(pc => { const b = el('button'); b.style.background = pc.hex; b.title = `${pc.name} ${pc.hex.toUpperCase()}`; b.setAttribute('aria-label', pc.name); b.onclick = () => { c.value = pc.hex; hist.record(() => { set(pc.hex); touch(); }); }; sw.append(b); });
    const pair = el('div', 'pcol'); pair.append(c); if (sw.children.length) pair.append(sw);
    row.append(pair); return row;
  }
  function checkRow(label, get, set){
    const l = el('label', 'chk'); const c = el('input'); c.type = 'checkbox'; c.checked = !!get();
    c.onchange = () => hist.record(() => { set(c.checked); touch(); renderPanels(); });
    l.append(c, document.createTextNode(' ' + label)); return l;
  }
  const btn = (text, title, fn, cls) => { const b = el('button', cls || null, text); if (title) b.title = title; b.type = 'button'; b.onclick = fn; return b; };
  const section = (title, open = true) => { const d = el('details', 'psec'); d.open = open; d.append(el('summary', null, title)); return d; };

  function thumbOf(L){
    const c = el('canvas', 'pthumb'); c.width = c.height = 64; c.setAttribute('aria-hidden', 'true');
    const x = c.getContext('2d'), { w, h } = size(L), s = Math.min(56 / Math.max(1, w * L.sx), 56 / Math.max(1, h * L.sy));
    /* on the poster's own ground, so dark text on a light poster still reads */
    if (!P.doc.transparent){ x.fillStyle = P.doc.bg; x.fillRect(0, 0, 64, 64); }
    x.translate(32, 32); x.scale(s, s); x.translate(-L.x, -L.y);
    try { drawLayer(x, { ...L, opacity:1, blend:'source-over', shadow:{ ...L.shadow, on:false }, adjust:{ ...L.adjust, blur:0 } }, s); } catch { /* thumbnail only */ }
    return c;
  }
  function renderLayers(){
    const box = $('#pLayers'); box.innerHTML = '';
    const list = [...P.doc.layers].reverse();
    if (!list.length){
      const e = el('div', 'pempty');
      e.append(el('p', 'hint2', 'No layers yet. Drop images on the canvas, paste one, or add one here.'));
      e.append(btn('Add an image…', null, () => $('#pFile').click()));
      box.append(e); return;
    }
    list.forEach(L => {
      const row = el('div', 'player-row' + (L.id === P.sel ? ' on' : '') + (L.visible ? '' : ' off'));
      row.draggable = true; row.dataset.id = L.id; row.tabIndex = 0; row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(L.id === P.sel));
      row.setAttribute('aria-label', `${L.name}${L.visible ? '' : ', hidden'}${L.locked ? ', locked' : ''}`);
      row.onclick = () => { P.sel = L.id; renderPanels(); P.dirty = true; };
      row.onkeydown = e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); row.click(); } };
      const eye = btn('', L.visible ? 'Hide layer' : 'Show layer', e => { e.stopPropagation(); hist.record(() => { L.visible = !L.visible; touch(); }); renderLayers(); }, 'ghost icon');
      eye.innerHTML = L.visible ? EYE_ON : EYE_OFF; eye.setAttribute('aria-label', L.visible ? `Hide ${L.name}` : `Show ${L.name}`);
      const lock = btn('', L.locked ? 'Unlock layer' : 'Lock layer', e => { e.stopPropagation(); hist.record(() => { L.locked = !L.locked; touch(); }); renderLayers(); }, 'ghost icon plock' + (L.locked ? ' on' : ''));
      lock.innerHTML = LOCK_ICON; lock.setAttribute('aria-label', L.locked ? `Unlock ${L.name}` : `Lock ${L.name}`);
      const name = el('span', 'pname', L.name);
      const meta = el('span', 'pmeta', L.type === 'image' ? (L.fx && L.fx.some(i => i.on) ? `${L.fx.filter(i => i.on).length} effect${L.fx.filter(i => i.on).length > 1 ? 's' : ''}` : 'Image') : L.type === 'text' ? 'Text' : 'Shape');
      const txt = el('div', 'ptxt'); txt.append(name, meta);
      row.append(thumbOf(L), txt, lock, eye);
      row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/x-fxlayer', L.id); e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('text/x-fxlayer')){ e.preventDefault(); row.classList.add('drop'); } });
      row.addEventListener('dragleave', () => row.classList.remove('drop'));
      row.addEventListener('drop', e => {
        const id = e.dataTransfer.getData('text/x-fxlayer'); row.classList.remove('drop'); if (!id) return;
        e.preventDefault(); e.stopPropagation();
        hist.record(() => { const a = P.doc.layers, from = a.findIndex(l => l.id === id); const [m] = a.splice(from, 1); a.splice(a.findIndex(l => l.id === L.id) + (from > a.findIndex(l => l.id === L.id) ? 1 : 0), 0, m); touch(); });
        renderLayers();
      });
      box.append(row);
    });
  }
  function arrange(how){
    const L = cur(); if (!L) return;
    hist.record(() => {
      const a = P.doc.layers, i = a.indexOf(L); a.splice(i, 1);
      const j = how === 'front' ? a.length : how === 'back' ? 0 : how === 'up' ? Math.min(a.length, i + 1) : Math.max(0, i - 1);
      a.splice(j, 0, L); touch();
    });
    renderLayers();
  }
  function duplicate(){
    const L = cur(); if (!L) return;
    hist.record(() => {
      const c = JSON.parse(JSON.stringify(L)); c.id = uid(); c.name = L.name + ' copy'; c.x += 24; c.y += 24;
      if (c.fx) c.fx = c.fx.map(i => ({ ...i, uid:makeInst(i.id).uid }));
      P.doc.layers.splice(P.doc.layers.indexOf(L) + 1, 0, c); P.sel = c.id; touch();
    });
    renderPanels();
  }
  function remove(){
    const L = cur(); if (!L) return;
    hist.record(() => { P.doc.layers = P.doc.layers.filter(l => l !== L); P.sel = null; bakes.delete(L.id); touch(); });
    renderPanels();
  }
  let fieldSyncs = [];
  function syncFields(){ fieldSyncs.forEach(f => f()); }
  function renderProps(){
    const box = $('#pProps'); box.innerHTML = ''; fieldSyncs = [];
    const L = cur();
    if (!L){ renderDocProps(box); return; }
    const head = el('div', 'phead');
    const nm = el('input'); nm.type = 'text'; nm.value = L.name; nm.setAttribute('aria-label', 'Layer name');
    nm.onchange = () => hist.record(() => { L.name = nm.value.trim() || L.name; touch(); renderLayers(); });
    head.append(nm);
    box.append(head);
    const acts = el('div', 'pacts');
    acts.append(btn('To front', 'Bring to front', () => arrange('front')), btn('Forward', 'Bring forward (])', () => arrange('up')), btn('Back', 'Send backward ([)', () => arrange('down')), btn('To back', 'Send to back', () => arrange('back')));
    box.append(acts);
    const acts2 = el('div', 'pacts');
    acts2.append(btn('Duplicate', 'Duplicate (⌘D)', duplicate), btn('Delete', 'Delete layer (Delete)', remove));
    box.append(acts2);

    const tr = section('Position');
    const grid = el('div', 'pgrid');
    const dims = () => size(L);
    const fields = [
      numField('X', () => L.x, v => { L.x = v; }), numField('Y', () => L.y, v => { L.y = v; }),
      numField('W', () => dims().w * L.sx, v => { const f = Math.max(1, v) / dims().w; if (L._lockAspect !== false){ L.sy *= f / L.sx; } L.sx = f; }),
      numField('H', () => dims().h * L.sy, v => { const f = Math.max(1, v) / dims().h; if (L._lockAspect !== false){ L.sx *= f / L.sy; } L.sy = f; }),
      numField('Rotate °', () => L.rot, v => { L.rot = ((v % 360) + 540) % 360 - 180; }, 1),
    ];
    fields.forEach(f => { grid.append(f); fieldSyncs.push(f._sync); });
    tr.append(grid);
    const flips = el('div', 'pacts');
    flips.append(
      btn('Flip H', 'Flip horizontally', () => { hist.record(() => { L.flipX = !L.flipX; touch(); }); }),
      btn('Flip V', 'Flip vertically', () => { hist.record(() => { L.flipY = !L.flipY; touch(); }); }),
      btn('Centre', 'Centre on the canvas', () => { hist.record(() => { L.x = P.doc.W / 2; L.y = P.doc.H / 2; touch(); }); syncFields(); }),
    );
    tr.append(flips);
    const fits = el('div', 'pacts');
    fits.append(
      btn('Fit', 'Scale to fit inside the canvas', () => { hist.record(() => { const s = fitScale(dims().w, dims().h, 1); L.sx = L.sy = s; L.rot = 0; L.x = P.doc.W / 2; L.y = P.doc.H / 2; touch(); }); syncFields(); }),
      btn('Fill', 'Scale to cover the whole canvas', () => { hist.record(() => { const d = dims(), s = Math.max(P.doc.W / d.w, P.doc.H / d.h); L.sx = L.sy = s; L.rot = 0; L.x = P.doc.W / 2; L.y = P.doc.H / 2; touch(); }); syncFields(); }),
      btn('Reset', 'Back to natural size, no rotation', () => { hist.record(() => { L.sx = L.sy = 1; L.rot = 0; L.flipX = L.flipY = false; touch(); }); syncFields(); }),
    );
    tr.append(fits);
    box.append(tr);

    const look = section('Blend');
    look.append(rangeRow('Opacity', () => L.opacity * 100, v => { L.opacity = v / 100; }, 0, 100, 1, 100, '%'));
    look.append(selectRow('Blend', BLENDS, () => L.blend, v => { L.blend = v; }));
    box.append(look);

    if (L.type === 'text') box.append(textSection(L));
    if (L.type === 'shape') box.append(shapeSection(L));
    if (L.type === 'image') box.append(effectsSection(L));

    const adj = section('Adjust', Object.keys(ADJ0).some(k => L.adjust[k] !== ADJ0[k]));
    adj.append(rangeRow('Brightness', () => L.adjust.brightness, v => { L.adjust.brightness = v; }, 0, 200, 1, 100, '%'));
    adj.append(rangeRow('Contrast', () => L.adjust.contrast, v => { L.adjust.contrast = v; }, 0, 200, 1, 100, '%'));
    adj.append(rangeRow('Saturation', () => L.adjust.saturate, v => { L.adjust.saturate = v; }, 0, 200, 1, 100, '%'));
    adj.append(rangeRow('Hue', () => L.adjust.hue, v => { L.adjust.hue = v; }, -180, 180, 1, 0, '°'));
    adj.append(rangeRow('Blur', () => L.adjust.blur, v => { L.adjust.blur = v; }, 0, 100, .5, 0));
    box.append(adj);

    const sh = section('Shadow', L.shadow.on);
    sh.append(checkRow('Drop shadow', () => L.shadow.on, v => { L.shadow.on = v; }));
    if (L.shadow.on){
      sh.append(colourRow('Colour', () => L.shadow.color, v => { L.shadow.color = v; }));
      sh.append(rangeRow('Opacity', () => L.shadow.alpha * 100, v => { L.shadow.alpha = v / 100; }, 0, 100, 1, 45, '%'));
      sh.append(rangeRow('Softness', () => L.shadow.blur, v => { L.shadow.blur = v; }, 0, 200, 1, 40));
      sh.append(rangeRow('Offset X', () => L.shadow.x, v => { L.shadow.x = v; }, -200, 200, 1, 0));
      sh.append(rangeRow('Offset Y', () => L.shadow.y, v => { L.shadow.y = v; }, -200, 200, 1, 16));
    }
    box.append(sh);
  }
  function textSection(L){
    const t = L.text, s = section('Text');
    const ta = el('textarea'); ta.rows = 3; ta.value = t.text; ta.setAttribute('aria-label', 'Text');
    ta.oninput = () => { hist.begin(); t.text = ta.value; touch(); syncFields(); };
    ta.onchange = () => { hist.end(); renderLayers(); };
    s.append(ta);
    s.append(selectRow('Font', FONTS.map(f => [f[0], f[1]]), () => t.font, v => { t.font = v; renderProps(); }));
    if (t.font === 'custom'){
      const row = el('div', 'prm wide'); row.append(el('label', null, 'Font name'));
      const i = el('input'); i.type = 'text'; i.value = t.custom; i.placeholder = 'e.g. Futura'; i.setAttribute('aria-label', 'Font name');
      i.onchange = () => hist.record(() => { t.custom = i.value; touch(); syncFields(); });
      row.append(i); s.append(row);
      s.append(el('p', 'hint2', 'Uses a font installed on this computer. Another computer without it shows a fallback; export a PNG to keep the look.'));
    }
    s.append(rangeRow('Size', () => t.size, v => { t.size = v; }, 6, 1200, 1, Math.round(P.doc.W / 8), ' px'));
    s.append(selectRow('Weight', [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [900, 'Black']], () => t.weight, v => { t.weight = +v; }));
    s.append(selectRow('Align', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], () => t.align, v => { t.align = v; }));
    s.append(rangeRow('Tracking', () => t.tracking, v => { t.tracking = v; }, -200, 800, 5, 0));
    s.append(rangeRow('Leading', () => t.leading, v => { t.leading = v; }, .6, 3, .01, 1.05));
    s.append(colourRow('Colour', () => t.color, v => { t.color = v; }));
    const opts = el('div', 'pacts');
    opts.append(checkRow('Italic', () => t.italic, v => { t.italic = v; }), checkRow('Capitals', () => t.upper, v => { t.upper = v; }));
    s.append(opts);
    return s;
  }
  function shapeSection(L){
    const sh = L.shape, s = section('Shape');
    s.append(selectRow('Shape', [['rect', 'Rectangle'], ['ellipse', 'Ellipse']], () => sh.kind, v => { sh.kind = v; renderProps(); }));
    s.append(colourRow('Fill', () => sh.fill, v => { sh.fill = v; }));
    if (sh.kind === 'rect') s.append(rangeRow('Corners', () => sh.radius, v => { sh.radius = v; }, 0, 1000, 1, 0, ' px'));
    s.append(el('p', 'hint2', 'Width and height are in Position. Scaling a shape keeps its edges sharp.'));
    return s;
  }
  function effectsSection(L){
    const s = section('Effects', true);
    s.append(el('p', 'hint2', 'FX Lab treatments and effects, applied to this image. They render at up to 2048 px on the long side.'));
    (L.fx || []).forEach((inst, idx) => {
      const m = FX.byId[inst.id]; if (!m) return;
      const card = el('div', 'pfx' + (inst.on ? '' : ' off'));
      const h = el('div', 'pfxh'); h.append(el('b', null, m.name));
      const eye = btn('', inst.on ? 'Turn off' : 'Turn on', () => { hist.record(() => { inst.on = !inst.on; touch(); }); renderProps(); renderLayers(); }, 'ghost icon');
      eye.innerHTML = inst.on ? EYE_ON : EYE_OFF; eye.setAttribute('aria-label', inst.on ? `Turn off ${m.name}` : `Turn on ${m.name}`);
      const x = btn('×', `Remove ${m.name}`, () => { hist.record(() => { L.fx.splice(idx, 1); touch(); }); renderProps(); renderLayers(); }, 'ghost icon');
      x.setAttribute('aria-label', `Remove ${m.name}`);
      h.append(eye, x); card.append(h);
      if (m.desc) card.append(el('p', 'hint2', m.desc));
      const shown = m.params.filter(p => ['range', 'select', 'toggle', 'color'].includes(p.type));
      const keep = m.primary != null ? m.primary : 6;
      const rows = shown.map(p => fxParam(inst, p));
      rows.slice(0, keep).forEach(r => card.append(r));
      if (rows.length > keep){ const d = el('details', 'more'); d.append(el('summary', null, `More controls (${rows.length - keep})`)); rows.slice(keep).forEach(r => d.append(r)); card.append(d); }
      s.append(card);
    });
    const add = el('select'); add.setAttribute('aria-label', 'Add an effect');
    const o0 = el('option', null, 'Add an effect…'); o0.value = ''; add.append(o0);
    [['treatment', 'Treatments'], ['fx', 'Effects']].forEach(([cat, label]) => {
      const g = el('optgroup'); g.label = label;
      FX.modules.filter(m => m.cat === cat && fxEligible(m)).sort((a, b) => a.name.localeCompare(b.name)).forEach(m => { const o = el('option', null, m.name); o.value = m.id; o.title = m.desc || ''; g.append(o); });
      add.append(g);
    });
    add.onchange = () => { const id = add.value; if (!id) return; hist.record(() => { (L.fx = L.fx || []).push(makeInst(id)); touch(); }); renderProps(); renderLayers(); };
    s.append(add);
    const rep = btn('Replace image…', 'Swap the picture, keeping position and effects', () => { replaceTarget = L.id; $('#pFile').click(); });
    const pacts = el('div', 'pacts'); pacts.append(rep); s.append(pacts);
    return s;
  }
  function fxParam(inst, p){
    const set = v => { inst.params[p.id] = v; };
    if (p.type === 'range') return rangeRow(p.label, () => inst.params[p.id], set, p.min, p.max, p.step, p.def);
    if (p.type === 'select') return selectRow(p.label, p.options.map((o, i) => [i, o]), () => inst.params[p.id], v => set(+v));
    if (p.type === 'toggle'){ const r = el('div', 'prm wide'); r.append(el('span'), checkRow(p.label, () => inst.params[p.id], set)); return r; }
    return colourRow(p.label, () => { const v = String(Identity.color ? Identity.color(inst.params[p.id]) : inst.params[p.id]); return v.slice(0, 7); }, set);
  }
  function renderDocProps(box){
    box.append(el('p', 'hint2 pnone', 'Nothing selected. Click a layer on the canvas or in the list. Canvas size and background are above the canvas.'));
    const nm = el('div', 'prm wide'); nm.append(el('label', null, 'Poster name'));
    const i = el('input'); i.type = 'text'; i.value = P.doc.name; i.placeholder = 'poster'; i.setAttribute('aria-label', 'Poster name');
    i.onchange = () => hist.record(() => { P.doc.name = i.value; touch(); });
    nm.append(i); box.append(nm);
    const ex = section('Export');
    ex.append(selectRow('Format', [['png', 'PNG'], ['jpeg', 'JPEG']], () => P.exportFmt, v => { P.exportFmt = v; }));
    ex.append(selectRow('Scale', [[.5, '0.5×'], [1, '1×'], [2, '2×'], [3, '3×']], () => P.exportScale, v => { P.exportScale = +v; renderProps(); }));
    ex.append(el('p', 'hint2', `Exports ${Math.round(P.doc.W * P.exportScale)} × ${Math.round(P.doc.H * P.exportScale)} px.${P.doc.transparent ? ' PNG keeps the transparent background; JPEG puts it on white.' : ''}`));
    const b = btn('Export image', null, exportImage, 'primary'); ex.append(b);
    box.append(ex);
    const ks = section('Keys', false);
    ks.append(el('p', 'hint2', 'Drag to move, corners to scale (Shift frees the proportions), the dot above to rotate (Shift snaps to 15°). Arrows nudge (Shift ×10). Delete removes, ⌘D duplicates, [ and ] reorder, ⌘Z undoes. Hold Space and drag, or scroll, to pan; ⌘ or Ctrl and scroll to zoom. Alt while moving skips the centre snap.'));
    box.append(ks);
  }
  function renderPanels(){ renderLayers(); renderProps(); P.dirty = true; }
  function renderAll(){ syncCanvasBar(); renderPanels(); }

  /* ---------- canvas bar ---------- */
  function syncCanvasBar(){
    const d = P.doc;
    $('#pSize').value = POSTER_SIZES.some(s => s.id === d.sizeId) ? d.sizeId : 'custom';
    $('#pW').value = d.W; $('#pH').value = d.H; $('#pBg').value = d.bg; $('#pClear').checked = d.transparent; $('#pBg').disabled = d.transparent;
  }
  function resizeDoc(W, H, id){
    W = Math.round(Util.clamp(W, 16, MAX_SIDE)); H = Math.round(Util.clamp(H, 16, MAX_SIDE));
    hist.record(() => {
      const d = P.doc, fx = W / d.W, fy = H / d.H, f = Math.min(fx, fy);
      /* keep the layout: positions follow the frame, sizes follow the shorter change */
      d.layers.forEach(L => { L.x *= fx; L.y *= fy; L.sx *= f; L.sy *= f; });
      d.W = W; d.H = H; d.sizeId = id || (POSTER_SIZES.find(s => s.w === W && s.h === H) || { id:'custom' }).id; touch();
    });
    fitView(); syncCanvasBar(); renderPanels();
  }

  /* ---------- mode ---------- */
  function setMode(mode){
    const poster = mode === 'poster';
    if (poster && !stage) build();
    P.on = poster; App.mode = poster ? 'poster' : 'motion';
    document.body.classList.toggle('mode-poster', poster);
    ['Motion', 'Poster'].forEach(n => { const b = $('#mode' + n), on = (n === 'Poster') === poster; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    try { localStorage.setItem('fxlab.mode', App.mode); } catch { /* private mode */ }
    if (poster){ App.wasPlaying = App.playing; App.playing = false; requestAnimationFrame(() => { resizeStage(); renderAll(); }); }
    else { if (App.wasPlaying) App.playing = true; if (typeof updatePlayBtn === 'function') updatePlayBtn(); markDirty(); }
  }

  let spaceHeld = false, replaceTarget = null;
  function build(){
    stage = $('#pStage'); wrap = $('#pStageWrap'); sctx = stage.getContext('2d');
    docC = document.createElement('canvas'); dctx = docC.getContext('2d');
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp); stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('wheel', onWheel, { passive:false });
    stage.addEventListener('dblclick', e => { const L = cur(); if (L && L.type === 'text' && hit(L, toDoc(e.clientX, e.clientY))){ const ta = $('#pProps textarea'); if (ta){ ta.focus(); ta.select(); } } });
    new ResizeObserver(() => { if (P.on) resizeStage(); }).observe(wrap);
    const sel = $('#pSize');
    const g1 = el('optgroup'); g1.label = 'Social & screen'; const g2 = el('optgroup'); g2.label = 'Print';
    POSTER_SIZES.forEach(s => { const o = el('option', null, s.label); o.value = s.id; (s.id === 'custom' ? sel : /dpi/.test(s.label) ? g2 : g1).append(o); });
    sel.prepend(g1, g2);
    sel.onchange = () => { const s = POSTER_SIZES.find(z => z.id === sel.value); if (s && s.w) resizeDoc(s.w, s.h, s.id); };
    $('#pW').onchange = () => resizeDoc(+$('#pW').value || P.doc.W, P.doc.H);
    $('#pH').onchange = () => resizeDoc(P.doc.W, +$('#pH').value || P.doc.H);
    $('#pSwap').onclick = () => resizeDoc(P.doc.H, P.doc.W);
    $('#pBg').oninput = () => { hist.begin(); P.doc.bg = $('#pBg').value; touch(); };
    $('#pBg').onchange = () => hist.end();
    $('#pClear').onchange = () => { hist.record(() => { P.doc.transparent = $('#pClear').checked; touch(); }); syncCanvasBar(); renderProps(); };
    $('#pFit').onclick = () => { fitView(); P.dirty = true; };
    $('#p100').onclick = () => zoomAt(1 / dpr());
    $('#pZoomIn').onclick = () => zoomAt(P.view.k * 1.25);
    $('#pZoomOut').onclick = () => zoomAt(P.view.k / 1.25);
    $('#pAddImage').onclick = () => { replaceTarget = null; $('#pFile').click(); };
    $('#pEmptyAdd').onclick = () => { replaceTarget = null; $('#pFile').click(); };
    $('#pEmptyMotion').onclick = addMotionFrame;
    $('#pAddMotion').onclick = addMotionFrame;
    $('#pAddText').onclick = addText;
    $('#pAddRect').onclick = () => addShape('rect');
    $('#pAddEllipse').onclick = () => addShape('ellipse');
    $('#pFile').onchange = async e => {
      const files = [...e.target.files]; e.target.value = '';
      if (!files.length) return;
      if (replaceTarget){
        const L = P.doc.layers.find(l => l.id === replaceTarget); replaceTarget = null;
        try {
          const m = await mediaFromBlob(files[0], files[0].name);
          if (L) hist.record(() => { const old = L.image.w * L.sx; L.image = { media:m.id, w:m.w, h:m.h }; L.sx = L.sy = old / m.w; touch(); });
          renderPanels();
        } catch (er){ toast(er.message, true); }
        return;
      }
      addFiles(files);
    };
    $('#pUndo').onclick = () => hist.undo(); $('#pRedo').onclick = () => hist.redo();
    $('#pSave').onclick = save;
    $('#pOpen').onclick = () => $('#pFileProject').click();
    $('#pFileProject').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) openText(await f.text()); };
    $('#pExport').onclick = exportImage;
    $('#pNew').onclick = () => {
      if (P.doc.layers.length && !confirm('Start a new poster? This one is cleared; Undo brings it back.')) return;
      hist.record(() => { P.doc = { ...P.doc, layers:[], name:'' }; P.sel = null; touch(); }); bakes.clear(); renderAll();
    };
    sync();
    const loop = () => { requestAnimationFrame(loop); if (P.on && P.dirty){ P.dirty = false; drawStage(); } };
    requestAnimationFrame(loop);
  }

  function onKey(e){
    if (!P.on) return false;
    const mod = e.metaKey || e.ctrlKey, typing = typingField(e.target) || /input|textarea|select/i.test(e.target.tagName);
    if (mod && e.code === 'KeyZ' && !typing){ e.preventDefault(); if (e.shiftKey) hist.redo(); else hist.undo(); return true; }
    if (e.ctrlKey && e.code === 'KeyY' && !typing){ e.preventDefault(); hist.redo(); return true; }
    if (typing) return true;
    if (e.code === 'Space' && e.target.tagName !== 'BUTTON'){ e.preventDefault(); spaceHeld = true; return true; }
    const L = cur();
    if (mod && e.code === 'KeyD'){ e.preventDefault(); duplicate(); return true; }
    if (mod && e.code === 'Digit0'){ e.preventDefault(); fitView(); P.dirty = true; return true; }
    if (!L) return true;
    if (e.key === 'Escape'){ P.sel = null; renderPanels(); return true; }
    if (e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); remove(); return true; }
    if (e.key === ']'){ arrange(mod ? 'front' : 'up'); return true; }
    if (e.key === '['){ arrange(mod ? 'back' : 'down'); return true; }
    const arrows = { ArrowLeft:[-1, 0], ArrowRight:[1, 0], ArrowUp:[0, -1], ArrowDown:[0, 1] }[e.key];
    if (arrows && !L.locked){ e.preventDefault(); const n = e.shiftKey ? 10 : 1; hist.record(() => { L.x += arrows[0] * n; L.y += arrows[1] * n; touch(); }); syncFields(); return true; }
    return true;
  }
  function onPaste(e){
    if (!P.on || typingField(e.target) || /input|textarea/i.test(e.target.tagName)) return;
    const files = [...(e.clipboardData?.files || [])].filter(f => /^image\//.test(f.type));
    if (files.length){ e.preventDefault(); addFiles(files); }
  }
  function onDrop(e, files){
    if (!P.on) return false;
    const r = stage.getBoundingClientRect(), inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    addFiles(files, inside ? toDoc(e.clientX, e.clientY) : null);
    return true;
  }

  function init(){
    if (App.player) return;
    $('#modeMotion').onclick = () => setMode('motion');
    $('#modePoster').onclick = () => setMode('poster');
    document.addEventListener('keyup', e => { if (e.code === 'Space') spaceHeld = false; });
    document.addEventListener('paste', onPaste);
    window.addEventListener('pointerup', () => { if (P.on) hist.end(); });
    restoreSaved();
    let m = 'motion'; try { m = localStorage.getItem('fxlab.mode') || 'motion'; } catch { /* private mode */ }
    if (m === 'poster') setMode('poster');
  }

  return { init, setMode, onKey, onDrop, addFiles, addText, addShape, addMotionFrame, exportImage, drawDoc, bakeAll, hist, P,
    get on(){ return P.on; }, select:id => { P.sel = id; renderPanels(); }, render:() => drawStage(), fxEligible };
})();
const LOCK_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 7V5.2a2.5 2.5 0 015 0V7" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
