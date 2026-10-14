/* ---------------- App: state, UI, timeline, export ---------------- */
const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const SIZES = [
  { id:'ig-square',   label:'Instagram square 1:1',   w:1080, h:1080 },
  { id:'ig-portrait', label:'Instagram portrait 4:5', w:1080, h:1350 },
  { id:'ig-34',       label:'Instagram grid 3:4',     w:1080, h:1440 },
  { id:'story',       label:'Story / Reel / TikTok 9:16', w:1080, h:1920 },
  { id:'landscape',   label:'Landscape 16:9',         w:1920, h:1080 },
  { id:'yt-thumb',    label:'YouTube thumbnail',      w:1280, h:720 },
  { id:'x-post',      label:'X post 16:9',            w:1600, h:900 },
  { id:'li-link',     label:'LinkedIn link 1.91:1',   w:1200, h:627 },
  { id:'pinterest',   label:'Pinterest 2:3',          w:1000, h:1500 },
  { id:'x-header',    label:'X header 3:1',           w:1500, h:500 },
  { id:'custom',      label:'Custom',                 w:0, h:0 },
];
const EASE = {
  'Linear': x => x,
  'Ease in-out sine': x => -(Math.cos(Math.PI * x) - 1) / 2,
  'Ease in-out cubic': x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  'Ease in-out quart': x => x < .5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2,
  'Ease in-out expo': x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  'Ease out expo': x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
  'Brand': x => Identity.easeInOut(x),
};

let uidSeq = 1;
function makeInst(id, randomize = false){
  const m = FX.byId[id]; const params = {};
  for (const p of m.params){
    let v = p.def;
    if (randomize && p.type === 'range'){ const span = (p.max - p.min) * .3; v = Util.clamp(p.def + (Math.random() * 2 - 1) * span, p.min, p.max); v = Math.round(v / p.step) * p.step; v = +v.toFixed(4); }
    if (randomize && p.type === 'select' && Math.random() < .5) v = Math.floor(Math.random() * p.options.length);
    const linked = Identity.linkedDefault(p);
    if (linked !== undefined) v = linked;
    if (randomize && p.type === 'color' && linked === undefined && Assets.palette.length > 1) v = Assets.palette[Math.floor(Math.random() * Assets.palette.length)].hex;
    params[p.id] = v;
  }
  return { uid:uidSeq++, id, on:true, params };
}

const state = {
  sizeId:'ig-portrait', W:1080, H:1350, quality:.5, bg:'#000000',
  duration:4, fps:30, loopMode:'pingpong', easing:'Ease in-out cubic', hold:.15,
  sources:{ A:{ fit:0, zoom:1, x:0, y:0, process:[] }, B:{ fit:0, zoom:1, x:0, y:0, process:[] } },
  base:null, stack:[], print:null, transparent:false, name:'',
};
const App = {
  t:0, playing:true, dirty:true, exporting:false, cancel:false, mediaInfo:{ A:null, B:null },
  stageOn:{ prepare:true, finish:true },
  ws:'images', srcTab:'A', compare:false, libChip:'all', libLive:(() => { try { return !!localStorage.getItem('fxlab.libLive'); } catch { return false; } })(), batchOpen:false,
  /* Session-only inspector disclosure. Not saved in projects. Key instances by uid. */
  ui:{ stages:{ prepare:true, combine:true, finish:true }, inst:Object.create(null), more:Object.create(null) },
  libTarget:null, libReplace:null,
  /* the layer [ and ] step through: the last one clicked or focused, session-only */
  stepUid:null,
  exportDir:null, exportDirPending:null, exportDirPersisted:false,
};

function progressAt(t){
  const D = state.duration; let x = ((t % D) + D) % D / D;
  if (state.loopMode === 'pingpong') x = x < .5 ? x * 2 : 2 - x * 2;
  const h = state.loopMode === 'pingpong' ? state.hold : state.hold * .5;
  x = Util.clamp((x - h) / Math.max(1e-3, 1 - 2 * h));
  return (EASE[state.easing] || EASE.Linear)(x);
}
function globalsAt(t){ const D = state.duration; return { t, p:progressAt(t), loop:(((t % D) + D) % D) / D, dur:D, fps:state.fps }; }
function renderAt(t){
  Engine.backColor = Engine.backOverride || Engine.hex(state.bg);
  Engine.backCheck = state.transparent && !App.exporting;
  if (App.compare && !App.exporting){
    /* hold-to-compare: the fitted image A on its own, nothing else */
    const base = state.base, on = { ...App.stageOn };
    state.base = App.compareBase || (App.compareBase = makeInst('src-a'));
    App.stageOn.prepare = App.stageOn.finish = false;
    try { Engine.frame(state, t, globalsAt(t)); } finally { state.base = base; Object.assign(App.stageOn, on); }
    return;
  }
  Engine.frame(state, t, globalsAt(t));
}
const markDirty = () => { App.dirty = true; };

/* Session-only snapshot history. Not saved in projects. Media stays as refs. */
const HIST_LIMIT = 80;
const RAND_CATS = ['treatment', 'fx', 'overlay'];
function defaultRandScope(){
  return { prepareA:false, prepareB:false, combine:true, finish:true, treatment:true, fx:true, overlay:true };
}
function loadRandScope(){
  try {
    const o = JSON.parse(localStorage.getItem('fxlab-rand-scope') || 'null');
    return o && typeof o === 'object' ? { ...defaultRandScope(), ...o } : defaultRandScope();
  } catch { return defaultRandScope(); }
}
function saveRandScope(){
  try { localStorage.setItem('fxlab-rand-scope', JSON.stringify(App.randScope)); } catch { /* private mode */ }
}
App.randScope = loadRandScope();
App.dragDepth = 0;

const History = {
  past:[], future:[], txn:null, silent:false,
  snap(){
    return {
      project: JSON.parse(JSON.stringify(projectFromState(true))),
      media:{
        A: Engine.media.A ? { el:Engine.media.A.el, w:Engine.media.A.w, h:Engine.media.A.h, video:!!Engine.media.A.video } : null,
        B: Engine.media.B ? { el:Engine.media.B.el, w:Engine.media.B.w, h:Engine.media.B.h, video:!!Engine.media.B.video } : null,
        infoA: App.mediaInfo.A, infoB: App.mediaInfo.B,
      },
    };
  },
  same(a, b){
    if (!a || !b) return false;
    if (JSON.stringify(a.project) !== JSON.stringify(b.project)) return false;
    const el = (s, k) => s.media && s.media[k] && s.media[k].el;
    return el(a, 'A') === el(b, 'A') && el(a, 'B') === el(b, 'B');
  },
  begin(label){
    if (this.silent || this.txn) return;
    this.txn = { before:this.snap(), label:label || 'edit' };
  },
  end(){
    if (this.silent || !this.txn) return;
    const after = this.snap();
    if (this.same(this.txn.before, after)){ this.txn = null; return; }
    this.past.push({ before:this.txn.before, after, label:this.txn.label });
    if (this.past.length > HIST_LIMIT) this.past.shift();
    this.future = [];
    this.txn = null;
    syncHistoryBtns();
  },
  record(label, fn){
    if (this.silent){ fn(); return; }
    if (this.txn) this.end();
    this.begin(label);
    try { fn(); } finally { this.end(); }
  },
  apply(entry, which){
    const snap = entry[which];
    this.silent = true;
    try { restoreProject(snap.project); restoreMedia(snap.media); renderSlots(); }
    finally { this.silent = false; }
  },
  undo(){
    if (this.txn) this.end();
    const e = this.past.pop(); if (!e) return false;
    this.apply(e, 'before');
    this.future.push(e);
    syncHistoryBtns();
    return true;
  },
  redo(){
    if (this.txn) this.end();
    const e = this.future.pop(); if (!e) return false;
    this.apply(e, 'after');
    this.past.push(e);
    syncHistoryBtns();
    return true;
  },
  reset(){
    this.past = []; this.future = []; this.txn = null;
    syncHistoryBtns();
  },
};
function restoreMedia(media){
  if (!media) return;
  for (const k of ['A', 'B']){
    const m = media[k];
    if (m && m.el) Engine.setMedia(k, m.el, m.w, m.h, m.video);
    const info = k === 'A' ? media.infoA : media.infoB;
    if (info) App.mediaInfo[k] = info;
  }
}
function syncHistoryBtns(){
  const u = $('#btnUndo'), r = $('#btnRedo');
  if (u) u.disabled = !History.past.length && !History.txn;
  if (r) r.disabled = !History.future.length;
}
function typingField(el){
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !/^(range|color|checkbox|radio|file|button|submit)$/i.test(el.type || '');
  return false;
}
function bindLive(el, label){
  el.addEventListener('pointerdown', () => History.begin(label));
  el.addEventListener('pointerup', () => History.end());
  el.addEventListener('pointercancel', () => History.end());
  el.addEventListener('change', () => History.end());
  el.addEventListener('blur', () => History.end());
}

function stageIsOpen(id){ return App.ui.stages[id] !== false; }
function setStageOpen(id, open){ App.ui.stages[id] = !!open; }
function instIsOpen(uid){ return App.ui.inst[uid] !== false; }
function setInstOpen(uid, open){ App.ui.inst[uid] = !!open; }
function openNewInst(uid){ App.ui.inst[uid] = true; }

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, err = false, ms = 3200){
  const t = $('#toast'); t.textContent = msg; t.className = err ? 'err' : ''; t.style.display = 'block';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.style.display = 'none', ms);
}
Engine.onError = (m, msg) => toast(`${m.name} failed to compile:\n${msg.slice(0, 400)}`, true, 8000);

/* ---------- placeholder sources ---------- */
/* Stand-ins for a photograph. Soft light and a real tonal range, so grades, screens and transitions have something to work on. */
function placeholder(which){
  const S = 1600, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const lin = (y0, y1, stops) => { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(([t, col]) => g.addColorStop(t, col)); return g; };
  const glow = (cx, cy, r, stops) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); stops.forEach(([t, col]) => g.addColorStop(t, col)); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); };
  if (which === 'A'){
    /* dusk over layered hills */
    x.fillStyle = lin(0, 1100, [[0, '#16323f'], [.45, '#3f6a72'], [.8, '#e9a86b'], [1, '#f6d7a0']]); x.fillRect(0, 0, S, S);
    glow(1040, 930, 640, [[0, 'rgba(255,248,226,1)'], [.12, 'rgba(255,224,160,.95)'], [.4, 'rgba(255,170,100,.35)'], [1, 'rgba(255,140,80,0)']]);
    for (let i = 0; i < 9; i++){
      const y = 200 + i * 85, w = 900 + (i % 3) * 260, cx = 260 + (i * 431) % 900;
      x.save(); x.translate(cx, y); x.scale(1, .07); x.translate(-cx, -y);
      glow(cx, y, w / 2, [[0, 'rgba(255,214,170,.22)'], [1, 'rgba(255,214,170,0)']]); x.restore();
    }
    const ridge = (base, amp, seed, fill) => {
      x.beginPath(); x.moveTo(0, S);
      for (let px = 0; px <= S; px += 8) x.lineTo(px, base + Math.sin(px / 210 + seed) * amp + Math.sin(px / 83 + seed * 2.3) * amp * .35 + Math.sin(px / 27 + seed * 5) * amp * .06);
      x.lineTo(S, S); x.closePath(); x.fillStyle = fill; x.fill();
    };
    ridge(960, 60, 1.2, lin(900, 1200, [[0, '#a8756a'], [1, '#6f5a63']]));
    ridge(1060, 70, 3.1, lin(980, 1300, [[0, '#6a5266'], [1, '#3d3550']]));
    ridge(1200, 80, 5.4, lin(1100, 1450, [[0, '#3a3049'], [1, '#221f31']]));
    ridge(1350, 60, 7.7, lin(1300, 1600, [[0, '#1c1a28'], [1, '#0e0d16']]));
  } else {
    /* still life in window light: wall, floor, a block and two spheres */
    x.fillStyle = lin(0, S, [[0, '#dccfb8'], [1, '#a99574']]); x.fillRect(0, 0, S, S);
    const fy = 1090;
    x.fillStyle = lin(fy, S, [[0, '#8f7c60'], [1, '#54463a']]); x.fillRect(0, fy, S, S - fy);
    x.save(); x.beginPath(); x.moveTo(1120, 0); x.lineTo(1600, 0); x.lineTo(1600, 1600); x.lineTo(520, 1600); x.closePath(); x.clip();
    const beam = x.createLinearGradient(1600, 0, 620, 1500); beam.addColorStop(0, 'rgba(255,247,226,.78)'); beam.addColorStop(1, 'rgba(255,240,200,0)');
    x.fillStyle = beam; x.fillRect(0, 0, S, S); x.restore();
    /* cast shadows fall away from the light, to the left */
    x.fillStyle = 'rgba(38,26,16,.42)';
    x.beginPath(); x.moveTo(560, fy); x.lineTo(300, fy + 110); x.lineTo(30, fy + 110); x.lineTo(300, fy); x.closePath(); x.fill();
    x.save(); x.translate(720, fy + 30); x.scale(1, .16); x.beginPath(); x.arc(0, 0, 210, 0, Math.PI * 2); x.restore(); x.fill();
    x.save(); x.translate(1090, fy + 44); x.scale(1, .18); x.beginPath(); x.arc(0, 0, 100, 0, Math.PI * 2); x.restore(); x.fill();
    /* block: three lit faces */
    x.fillStyle = '#c9b48f'; x.fillRect(300, 800, 260, 290);
    x.fillStyle = '#efe0bd'; x.beginPath(); x.moveTo(300, 800); x.lineTo(430, 720); x.lineTo(690, 720); x.lineTo(560, 800); x.closePath(); x.fill();
    x.fillStyle = '#a8946f'; x.beginPath(); x.moveTo(560, 800); x.lineTo(690, 720); x.lineTo(690, 1010); x.lineTo(560, 1090); x.closePath(); x.fill();
    /* sphere lit from the upper right */
    const sp = x.createRadialGradient(850, 690, 20, 780, 800, 260);
    sp.addColorStop(0, '#fff3dc'); sp.addColorStop(.35, '#d8b98d'); sp.addColorStop(1, '#3a2c22');
    x.fillStyle = sp; x.beginPath(); x.arc(760, 880, 210, 0, Math.PI * 2); x.fill();
    const rs = x.createRadialGradient(1120, 940, 8, 1080, 980, 110);
    rs.addColorStop(0, '#ff9a7a'); rs.addColorStop(.5, '#e0421f'); rs.addColorStop(1, '#5a140a');
    x.fillStyle = rs; x.beginPath(); x.arc(1090, 990, 100, 0, Math.PI * 2); x.fill();
    /* the room falls off toward the corners */
    glow(S / 2, S / 2, S * .8, [[0, 'rgba(0,0,0,0)'], [.7, 'rgba(20,12,6,.08)'], [1, 'rgba(20,12,6,.42)']]);
  }
  return c;
}

/* ---------- media loading ---------- */
function loadFile(k, file){
  if (!file) return;
  if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)){
    Assets.addFiles([file]).then(sum => { const id = sum.added[0] || (Assets.images().find(a => a.file === file.name) || {}).id; if (id) useAssetAsSource(k, id); });
    return;
  }
  delete state.sources[k].asset;
  const url = URL.createObjectURL(file);
  if (file.type.startsWith('video/')){
    const v = document.createElement('video');
    Object.assign(v, { src:url, muted:true, loop:true, playsInline:true, autoplay:true, crossOrigin:'anonymous' });
    v.addEventListener('loadeddata', () => {
      History.record('source', () => {
        Engine.setMedia(k, v, v.videoWidth, v.videoHeight, true); v.play().catch(() => {});
        App.mediaInfo[k] = { name:file.name, thumb:null, video:v }; renderSlots(); markDirty();
      });
      toast(`${k}: ${file.name} (${v.videoWidth}×${v.videoHeight}, video)`);
    }, { once:true });
    v.addEventListener('error', () => toast(`Could not read ${file.name}. Try MP4 (H.264) or WebM.`, true));
  } else if (file.type.startsWith('image/')){
    const img = new Image();
    img.onload = () => {
      let src = img, w = img.naturalWidth, h = img.naturalHeight;
      const max = Math.min(8192, Engine.gl ? Engine.gl.getParameter(Engine.gl.MAX_TEXTURE_SIZE) : 4096);
      if (Math.max(w, h) > max){ const s = max / Math.max(w, h); const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); src = c; w = c.width; h = c.height; }
      History.record('source', () => {
        Engine.setMedia(k, src, w, h, false);
        App.mediaInfo[k] = { name:file.name, thumb:url }; renderSlots(); markDirty();
      });
      toast(`${k}: ${file.name} (${img.naturalWidth}×${img.naturalHeight})`);
    };
    img.onerror = () => toast(`Could not read ${file.name}. Use JPG, PNG, WebP or GIF.`, true);
    img.src = url;
  } else toast(`${file.name} isn't an image or video.`, true);
}
function setPlaceholder(k){
  const c = placeholder(k); Engine.setMedia(k, c, c.width, c.height, false);
  App.mediaInfo[k] = { name:'Placeholder', thumb:c.toDataURL('image/jpeg', .7) };
}

/* ---------- top bar ---------- */
function initTopBar(){
  const sel = $('#sizePreset');
  const gSoc = el('optgroup'); gSoc.label = 'Social & screen'; SIZES.forEach(s => { const o = el('option', null, s.label); o.value = s.id; gSoc.append(o); });
  const gPr = el('optgroup'); gPr.label = 'Print (mm, with bleed)'; PRINT_SIZES.forEach(s => { const o = el('option', null, `${s.label} · print`); o.value = s.id; gPr.append(o); });
  const pCustom = el('option', null, 'Custom print size'); pCustom.value = 'p-custom'; gPr.append(pCustom);
  sel.append(gSoc, gPr);
  const syncFields = () => {
    sel.value = state.print ? (PRINT_SIZES.some(p => p.id === state.print.preset) ? state.print.preset : 'p-custom') : state.sizeId;
    $('#outW').value = state.W; $('#outH').value = state.H; $('#quality').value = String(state.quality);
    $('#outW').disabled = $('#outH').disabled = !!state.print; $('#outW').title = state.print ? 'Set print sizes in Print…' : 'Width';
    $('#btnPrint').classList.toggle('on', !!state.print);
  };
  sel.onchange = () => {
    if (sel.value.startsWith('p-')){ if (sel.value === 'p-custom') openPrintDialog(); else History.record('size', () => setPrintPreset(sel.value)); return; }
    History.record('size', () => {
      state.print = null; Print.syncPreview();
      const s = SIZES.find(z => z.id === sel.value); if (s.w){ state.W = s.w; state.H = s.h; } state.sizeId = s.id; syncFields(); applySize();
    });
  };
  $('#btnPrint').onclick = openPrintDialog;
  const custom = () => History.record('size', () => { state.print = null; const even = v => Math.round(Util.clamp(+v || 1080, 16, 4096) / 2) * 2; state.W = even($('#outW').value); state.H = even($('#outH').value); const m = SIZES.find(z => z.w === state.W && z.h === state.H); state.sizeId = m ? m.id : 'custom'; syncFields(); applySize(); });
  $('#outW').onchange = custom; $('#outH').onchange = custom;
  $('#quality').onchange = e => { state.quality = +e.target.value; applySize(); };
  $('#safeToggle').onchange = () => { $('#safe').classList.toggle('on', $('#safeToggle').checked); layoutSafe(); };
  initRandomiseUi();
  $('#btnUndo').onclick = () => History.undo();
  $('#btnRedo').onclick = () => History.redo();
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  $('#btnUndo').title = mac ? 'Undo (⌘Z)' : 'Undo (Ctrl+Z)';
  $('#btnRedo').title = mac ? 'Redo (⇧⌘Z)' : 'Redo (Ctrl+Y)';
  $('#btnSave').onclick = () => saveProject(false);
  $('#btnSaveAs').onclick = saveProjectAs;
  $('#btnFolder').onclick = pickExportFolder;
  $('#btnOpen').onclick = () => $('#fileProject').click();
  $('#fileProject').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(loadProject); e.target.value = ''; };
  $('#btnPng').onclick = exportPNG; $('#btnVideo').onclick = exportVideo; $('#btnSeq').onclick = exportSequence;
  $('#busyCancel').onclick = () => { App.cancel = true; };
  App.syncTop = syncFields; syncFields();
}
const cloneParams = p => JSON.parse(JSON.stringify(p || {}));
const clean = i => ({ id:i.id, on:i.on, params:cloneParams(i.params), ...(i.bind && Object.keys(i.bind).length ? { bind:cloneParams(i.bind) } : {}), ...(i.expose && Object.keys(i.expose).length ? { expose:cloneParams(i.expose) } : {}) });
const sourceInsts = () => [...(state.sources.A.process || []), ...(state.sources.B.process || [])];
function resetAllFeedback(){ Engine.resetFeedback([...state.stack, ...sourceInsts()]); }

/* One instance path for stack, lanes, saved looks and projects. */
function hydrateInst(o, missing){
  if (!o || !o.id || !FX.byId[o.id]){ if (o && o.id && missing) missing.push(o.id); return null; }
  const i = makeInst(o.id);
  Object.assign(i.params, cloneParams(o.params));
  i.on = o.on !== false;
  if (o.bind && typeof o.bind === 'object') i.bind = cloneParams(o.bind);
  if (o.expose && typeof o.expose === 'object') i.expose = cloneParams(o.expose);
  return i;
}
function hydrateLane(o, missing){
  const i = hydrateInst(o, missing);
  if (!i) return null;
  if (!FX.laneEligible(FX.byId[i.id])){ if (missing) missing.push(o.id); return null; }
  return i;
}
/* A saved look owns preparation the same way it owns the stack: missing field → []. */
function applyProcess(data, missing){
  for (const k of ['A', 'B']){
    const raw = data && data.sources && data.sources[k] && data.sources[k].process;
    state.sources[k].process = Array.isArray(raw) ? raw.map(o => hydrateLane(o, missing)).filter(Boolean) : [];
  }
}
function applySize(){
  Engine.setSize(state.W, state.H, state.quality);
  resetAllFeedback();
  layoutStage(); markDirty();
}
function layoutStage(){
  const wrap = $('#stageWrap'), pad = 40;
  const s = Math.min((wrap.clientWidth - pad * 2) / state.W, (wrap.clientHeight - pad * 2) / state.H);
  const box = $('#stageBox'); box.style.width = `${Math.max(10, state.W * s)}px`; box.style.height = `${Math.max(10, state.H * s)}px`;
  const pr = state.print;
  $('#stageInfo').textContent = pr
    ? `${(PRINT_SIZES.find(p => p.id === pr.preset) || { label:'Custom' }).label} · trim ${pr.wMM}×${pr.hMM} mm + ${pr.bleed} mm bleed · exports ${Print.outPx(pr).w}×${Print.outPx(pr).h} px at ${pr.dpi} dpi`
    : `${state.W}×${state.H} · preview ${Math.round(state.quality * 100)}% · view ${Math.round(s * 100)}%`;
  layoutSafe();
}
function layoutSafe(){
  const s = $('#safe'); s.innerHTML = '';
  if (state.print){ s.classList.toggle('on', !!state.print.guides); s.classList.add('print'); printGuides(s); return; }
  s.classList.remove('print'); s.classList.toggle('on', $('#safeToggle').checked);
  if (state.H / state.W >= 1.7){
    const top = el('div'); top.style.cssText = 'top:0;height:13%;border-bottom-width:1px'; 
    const bot = el('div'); bot.style.cssText = 'bottom:0;height:20%;border-top-width:1px';
    const side = el('div'); side.style.cssText = 'top:13%;bottom:20%;left:auto;right:0;width:15%;border-left-width:1px';
    s.append(top, bot, side);
  } else { s.append(el('div', 'inset')); }
}

/* ---------- library ---------- */
function searchHay(q, ...parts){
  if (!q) return true;
  return parts.some(p => {
    if (p == null || p === '') return false;
    if (Array.isArray(p)) return p.some(t => {
      const s = String(t).toLowerCase();
      return s === q || s.startsWith(q);
    });
    return String(p).toLowerCase().includes(q);
  });
}
function moduleMatch(m, q){
  if (!q) return true;
  const cat = CATS.find(c => c.id === m.cat);
  return searchHay(q, cat && cat.label, m.name, m.desc, m.search);
}
function searchLibrary(q){
  q = String(q || '').trim().toLowerCase();
  return {
    modules: FX.modules.filter(m => moduleMatch(m, q)).map(m => m.id),
  };
}
function libRow({ id, name, desc, action, active, onClick, thumb }){
  const b = el('button', 'item' + (thumb ? ' has-thumb' : '')); if (active) b.classList.add('active');
  if (id) b.dataset.id = id;
  b.title = desc || '';
  if (thumb){ const th = el('span', 'th'); th.style.backgroundImage = `url("${thumb}")`; th.setAttribute('aria-hidden', 'true'); b.append(th); }
  const copy = el('span', 'copy');
  copy.append(el('b', null, name));
  if (desc) copy.append(el('small', null, desc));
  b.append(copy, el('span', 'add', action));
  b.onclick = onClick;
  return b;
}
const CAT_USE = {
  source:'starts composition', transition:'combines A + B', mix:'combines A + B',
  generator:'creates the frame', data:'draws your data',
  treatment:'prepare / finish', fx:'finish', overlay:'finish',
};
const LIB_CTX = {
  prepareA:{ title:'Add to Prepare A', ph:'Search treatments and reframe' },
  prepareB:{ title:'Add to Prepare B', ph:'Search treatments and reframe' },
  combine:{ title:'How should the images meet?', ph:'Search sources, transitions, mixes, generators' },
  finish:{ title:'Add to Finish', ph:'Search finish modules' },
  all:{ title:'Find a module', ph:'Search every module' },
  replacePrepareA:{ title:'Replace in Prepare A', ph:'Search treatments and reframe', replace:true },
  replacePrepareB:{ title:'Replace in Prepare B', ph:'Search treatments and reframe', replace:true },
  replaceFinish:{ title:'Replace in Finish', ph:'Search finish modules', replace:true },
};
const LIB_WS = { prepareA:'images', prepareB:'images', replacePrepareA:'images', replacePrepareB:'images', combine:'combine', finish:'finish', replaceFinish:'finish' };
function libKind(ctx){
  if (!ctx) return null;
  if (ctx === 'prepareA' || ctx === 'replacePrepareA') return 'prepareA';
  if (ctx === 'prepareB' || ctx === 'replacePrepareB') return 'prepareB';
  if (ctx === 'combine') return 'combine';
  if (ctx === 'finish' || ctx === 'replaceFinish') return 'finish';
  return ctx;
}
function libEligible(m){
  const kind = libKind(App.libTarget);
  if (!kind || kind === 'all') return true;
  if (kind === 'prepareA' || kind === 'prepareB') return FX.laneEligible(m);
  if (kind === 'combine') return catRole(m.cat) === 'base';
  if (kind === 'finish') return catRole(m.cat) === 'stack';
  return true;
}
/* the picker is a drawer over the panel: it opens from an Add or Change button, or from search, and closes when a module is chosen */
function setLibTarget(target, index){
  const prev = App.libTarget;
  App.libTarget = target || null;
  App.libReplace = (target && LIB_CTX[target] && LIB_CTX[target].replace && index != null) ? index : null;
  const ctx = target && LIB_CTX[target];
  $('#lib').classList.toggle('open', !!ctx);
  $('#libCtxTitle').textContent = ctx ? ctx.title : '';
  $('#libCtxDone').textContent = ctx && ctx.replace ? 'Cancel' : '← Back';
  $('#search').placeholder = ctx ? ctx.ph : 'Search modules';
  if (ctx){
    App.libChip = 'all'; $('#search').value = '';
    if (LIB_WS[target]) showWorkspace(LIB_WS[target], true);
    if (/A$/.test(target)) App.srcTab = 'A'; else if (/B$/.test(target)) App.srcTab = 'B';
  }
  renderLibrary();
  if (ctx) $('#search').focus();
  if ((prev && LIB_CTX[prev] && LIB_CTX[prev].replace) || (ctx && ctx.replace)){
    renderSlots(); renderStack();
  }
}
function renderLibrary(){
  const ctx = App.libTarget;
  if (!ctx) return;
  const q = $('#search').value.trim().toLowerCase();
  const list = $('#libList'); list.innerHTML = '';
  const chips = $('#libChips'); chips.innerHTML = '';
  const kinds = CATS.filter(c => FX.modules.some(m => m.cat === c.id && libEligible(m)));
  if (kinds.length > 1) [{ id:'all', label:'All' }, ...kinds].forEach(c => {
    const b = el('button', App.libChip === c.id ? 'on' : '', c.label); b.type = 'button'; b.setAttribute('aria-pressed', String(App.libChip === c.id));
    b.onclick = () => { App.libChip = c.id; renderLibrary(); };
    chips.append(b);
  });
  /* previews drawn from the picture you are working on, not the stand-in */
  const live = el('button', 'live' + (App.libLive ? ' on' : ''), 'On my image'); live.type = 'button'; live.setAttribute('aria-pressed', String(!!App.libLive));
  live.title = 'Draw each thumbnail from image A instead of the stand-in photograph';
  live.onclick = () => { App.libLive = !App.libLive; try { localStorage.setItem('fxlab.libLive', App.libLive ? '1' : ''); } catch {} renderLibrary(); };
  chips.append(live);
  const row = (m, cat) => {
    const isBase = cat.role === 'base';
    return libRow({
      id:m.id, name:m.name, desc:m.desc, thumb:thumbSrc(m.id),
      action: isBase ? (state.base && state.base.id === m.id ? 'active' : 'use') : (LIB_CTX[ctx].replace ? 'replace' : 'add'),
      active: !!(isBase && state.base && state.base.id === m.id),
      onClick:() => chooseModule(m.id),
    });
  };
  /* the modules you reached for last, before the full list */
  if (!q && App.libChip === 'all'){
    const rec = recentModules().map(id => FX.byId[id]).filter(m => m && libEligible(m));
    if (rec.length){
      const d = el('details', 'cat'); d.open = true;
      const sum = el('summary'); sum.append(el('span', null, 'Recent'), el('span', 'role', String(rec.length))); d.append(sum);
      rec.forEach(m => d.append(row(m, CATS.find(c => c.id === m.cat))));
      list.append(d);
    }
  }
  for (const cat of CATS){
    if (App.libChip !== 'all' && cat.id !== App.libChip) continue;
    const items = FX.modules.filter(m => m.cat === cat.id && moduleMatch(m, q) && libEligible(m));
    if (!items.length) continue;
    const d = el('details', 'cat'); d.open = true;
    const sum = el('summary'); sum.append(el('span', null, cat.label), el('span', 'role', String(items.length)));
    d.append(sum);
    for (const m of items) d.append(row(m, cat));
    list.append(d);
  }
  if (App.libLive) queueLivePreviews(list);
  if (!list.children.length) list.append(el('p', 'empty', q ? `Nothing matches “${q}”. Try “grain”, “print”, “distort” or “scan”.` : 'Nothing to show here.'));
}
/* Live thumbnails: rows draw when they scroll into view, in small batches, on the current image A.
   The composition is swapped out for the render and put back, as the Language variations do. Modules
   that keep state between frames keep their stand-in thumbnail: they would need a warm-up per row. */
let livePending = [], liveTimer = 0, liveToken = 0;
function queueLivePreviews(list){
  const token = ++liveToken; livePending = [];
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting){ io.unobserve(en.target); livePending.push(en.target); } });
    clearTimeout(liveTimer); liveTimer = setTimeout(() => drawLivePreviews(token), 60);
  }, { root:list, rootMargin:'120px' });
  list.querySelectorAll('.item[data-id] .th').forEach(t => io.observe(t));
}
function drawLivePreviews(token){
  if (token !== liveToken || !livePending.length) return;
  const rows = livePending.splice(0), keep = { W:state.W, H:state.H, base:state.base, stack:state.stack, exp:App.exporting, play:App.playing, t:App.t };
  const w = 88, h = 110, out = [];
  try {
    App.exporting = true; App.playing = false; Object.assign(state, { W:w, H:h }); Engine.setSize(w, h, 1);
    rows.forEach(th => {
      const id = th.parentElement.dataset.id, m = FX.byId[id];
      if (!m || m.feedback || m.kind === 'data') return;
      const cat = CATS.find(c => c.id === m.cat), inst = makeInst(id);
      if (cat.role === 'base'){ state.base = inst; state.stack = []; } else { state.base = keep.base; state.stack = [inst]; }
      try { renderAt(stillTime()); const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(Engine.canvas, 0, 0, w, h); out.push([th, c.toDataURL('image/jpeg', .8)]); } catch {}
    });
  } finally {
    Object.assign(state, { W:keep.W, H:keep.H, base:keep.base, stack:keep.stack }); App.exporting = keep.exp; App.playing = keep.play; App.t = keep.t;
    applySize(); resetAllFeedback(); markDirty();
  }
  out.forEach(([th, u]) => { th.style.backgroundImage = `url("${u}")`; });
  if (livePending.length) liveTimer = setTimeout(() => drawLivePreviews(token), 30);
}
function replaceInst(list, idx, id){
  const old = list[idx];
  if (!old) return;
  Engine.resetFeedback([old]);
  const inst = makeInst(id);
  inst.on = old.on !== false;
  list[idx] = inst;
  openNewInst(inst.uid);
}
function recentModules(){ try { return JSON.parse(localStorage.getItem('fxlab-recent') || '[]').filter(id => typeof id === 'string').slice(0, 6); } catch { return []; } }
function rememberModule(id){ try { const r = [id, ...recentModules().filter(x => x !== id)].slice(0, 8); localStorage.setItem('fxlab-recent', JSON.stringify(r)); } catch { /* private mode */ } }
function chooseModule(id){
  const m = FX.byId[id];
  if (!m) return;
  rememberModule(id);
  History.record('module', () => chooseModuleNow(id, m, App.libTarget));
}
function chooseModuleNow(id, m, ctx){
  if (ctx === 'replacePrepareA' || ctx === 'replacePrepareB'){
    if (!FX.laneEligible(m)) return;
    const list = state.sources[ctx === 'replacePrepareA' ? 'A' : 'B'].process;
    const i = App.libReplace;
    if (i == null || !list[i]) return;
    replaceInst(list, i, id);
    setLibTarget(null);
    renderSlots(); markDirty();
    return;
  }
  if (ctx === 'replaceFinish'){
    if (catRole(m.cat) !== 'stack') return;
    const i = App.libReplace;
    if (i == null || !state.stack[i]) return;
    replaceInst(state.stack, i, id);
    setLibTarget(null);
    renderStack(); markDirty();
    return;
  }
  if (ctx === 'prepareA' || ctx === 'prepareB'){
    if (!FX.laneEligible(m)) return;
    const added = makeInst(id); openNewInst(added.uid);
    state.sources[ctx === 'prepareA' ? 'A' : 'B'].process.push(added);
    setLibTarget(null);
    renderSlots(); markDirty();
    return;
  }
  if (ctx === 'combine' || (ctx === 'all' && catRole(m.cat) === 'base')){
    if (catRole(m.cat) !== 'base') return;
    state.base = makeInst(id);
    setLibTarget(null);
    if (ctx === 'all') showWorkspace('combine');
    renderBase();
    markDirty();
    return;
  }
  if (ctx === 'finish' || ctx === 'all'){
    if (catRole(m.cat) !== 'stack') return;
    const added = makeInst(id); openNewInst(added.uid);
    state.stack.push(added);
    setLibTarget(null);
    if (ctx === 'all') showWorkspace('finish');
    renderStack(); markDirty();
    return;
  }
}

/* ---------- stepping through modules from the keyboard ---------- */
/* [ and ] swap the layer you last touched for the previous or next module in picker order, so a look
   can be auditioned on the picture without opening the picker. Shift jumps a whole category. The tab
   decides which list: Images steps Prepare on the open source, Combine steps the base, anything else
   steps Finish. A run of steps is one undo. */
function stepTarget(){
  if (App.ws === 'combine') return { kind:'combine', list:null, label:'Combine', eligible:m => catRole(m.cat) === 'base' };
  if (App.ws === 'images'){
    const k = App.srcTab;
    return { kind:'prepare' + k, list:state.sources[k].process, label:`Prepare ${k}`, eligible:m => FX.laneEligible(m) };
  }
  return { kind:'finish', list:state.stack, label:'Finish', eligible:m => catRole(m.cat) === 'stack' };
}
function stepPool(eligible){
  const out = [];
  for (const cat of CATS) for (const m of FX.modules) if (m.cat === cat.id && eligible(m)) out.push(m);
  return out;
}
/* touching a card makes it the one [ and ] step */
function stepFocus(card, inst){
  const mark = () => {
    if (App.stepUid === inst.uid) return;
    App.stepUid = inst.uid;
    document.querySelectorAll('.card.stepping').forEach(c => c.classList.remove('stepping'));
    card.classList.add('stepping');
  };
  card.addEventListener('pointerdown', mark);
  card.addEventListener('focusin', mark);
}
let stepTimer = 0;
function stepModule(dir, byCategory){
  const tg = stepTarget(), pool = stepPool(tg.eligible);
  if (!pool.length) return;
  let idx = -1, cur = null;
  if (tg.list){
    idx = tg.list.findIndex(i => i.uid === App.stepUid);
    if (idx < 0) idx = tg.list.length - 1;
    cur = tg.list[idx] || null;
  } else cur = state.base;
  const at = cur ? pool.findIndex(m => m.id === cur.id) : -1;
  let next;
  if (byCategory){
    const cats = CATS.filter(c => pool.some(m => m.cat === c.id)).map(c => c.id);
    const ci = at < 0 ? (dir > 0 ? -1 : 0) : cats.indexOf(pool[at].cat);
    const cat = cats[(ci + dir + cats.length) % cats.length];
    next = pool.find(m => m.cat === cat);
  } else next = at < 0 ? pool[dir > 0 ? 0 : pool.length - 1] : pool[(at + dir + pool.length) % pool.length];
  /* one undo per run of steps: the transaction closes once the keys go quiet */
  if (!History.txn) History.begin('step');
  clearTimeout(stepTimer); stepTimer = setTimeout(() => { if (History.txn && History.txn.label === 'step') History.end(); }, 900);
  let n = 1, of = 1;
  if (!tg.list){
    state.base = makeInst(next.id);
    renderBase();
  } else {
    if (!cur){ const added = makeInst(next.id); openNewInst(added.uid); tg.list.push(added); idx = tg.list.length - 1; }
    else replaceInst(tg.list, idx, next.id);
    App.stepUid = tg.list[idx].uid; n = idx + 1; of = tg.list.length;
    if (tg.kind === 'finish') renderStack(); else renderSlots();
  }
  markDirty();
  const cat = CATS.find(c => c.id === next.cat), inCat = pool.filter(m => m.cat === next.cat);
  toast(`${tg.label}${of > 1 ? ` ${n} of ${of}` : ''} · ${next.name}\n${cat ? cat.label : ''} ${inCat.indexOf(next) + 1} of ${inCat.length}`, false, 1800);
}

/* ---------- inspector: params ---------- */
function paramRow(inst, p, onChange){
  const row = el('div', 'prm');
  const lab = el('label', null, p.label); row.append(lab);
  const val = inst.params[p.id];
  const commit = v => { History.begin('param'); inst.params[p.id] = v; onChange && onChange(); markDirty(); };
  const commitOnce = v => { commit(v); History.end(); };
  if (p.type === 'range'){
    const linked = !!(inst.bind && inst.bind[p.id]);
    const r = el('input'); Object.assign(r, { type:'range', min:p.min, max:p.max, step:p.step, value:val });
    const num = el('input', 'val'); num.type = 'text'; num.value = fmt(val, p.step);
    r.setAttribute('aria-label', p.label); num.setAttribute('aria-label', `${p.label} value`);
    r.oninput = () => { num.value = fmt(+r.value, p.step); commit(+r.value); };
    bindLive(r, 'param');
    num.onchange = () => { const v = Util.clamp(parseFloat(num.value), p.min, p.max); if (!isNaN(v)){ r.value = v; num.value = fmt(v, p.step); commitOnce(v); } };
    const mod = () => lab.classList.toggle('mod', Math.abs(+r.value - p.def) > (p.step || .01) / 2);
    const set = v => { v = Util.clamp(v, p.min, p.max); v = p.step >= 1 ? Math.round(v) : Math.round(v / p.step) * p.step; r.value = v; num.value = fmt(v, p.step); commit(+v); mod(); };
    lab.title = 'Drag to change (Shift ×10, Alt ×0.1). Double-click to reset.'; lab.classList.add('scrub');
    lab.ondblclick = () => { r.value = p.def; num.value = fmt(p.def, p.step); commitOnce(p.def); mod(); };
    let sx = null, sv = 0;
    lab.addEventListener('pointerdown', e => { if (r.disabled || e.button) return; sx = e.clientX; sv = +r.value; lab.setPointerCapture(e.pointerId); History.begin('param'); e.preventDefault(); });
    lab.addEventListener('pointermove', e => { if (sx == null) return; set(sv + (e.clientX - sx) / 300 * (p.max - p.min) * (e.shiftKey ? 10 : e.altKey ? .1 : 1)); });
    const done = () => { if (sx == null) return; sx = null; History.end(); };
    lab.addEventListener('pointerup', done); lab.addEventListener('pointercancel', done);
    r.addEventListener('input', mod);
    r.addEventListener('keydown', e => { if (e.shiftKey && /^Arrow(Left|Right|Up|Down)$/.test(e.key)){ e.preventDefault(); set(+r.value + (/Left|Down/.test(e.key) ? -1 : 1) * p.step * 10); History.end(); } });
    mod();
    row.append(r, num);
    row.classList.add('has-link');
    const lk = el('button', 'lk'); lk.type = 'button'; lk.innerHTML = LINK_ICON;
    lk.title = linked ? `Linked to ${inst.bind[p.id].col}. Change or unlink.` : 'Link to a data column';
    lk.setAttribute('aria-label', linked ? `${p.label} is linked to ${inst.bind[p.id].col}. Edit the link.` : `Link ${p.label} to a data column`);
    lk.onclick = () => toggleBindPopover(row, inst, p);
    row.append(lk, pinButton(row, inst, p));
    if (linked){ row.classList.add('bound'); r.disabled = true; num.readOnly = true; num.value = 'data'; }
  } else if (p.type === 'column'){
    row.classList.add('wide');
    const t = Data.current(), s = el('select'); s.setAttribute('aria-label', p.label);
    const guess = Data.pick('', p.auto || 0, p.kind === 'any' ? 'any' : p.kind === 'axis' ? 'axis' : 'number', t);
    const auto = el('option', null, `Automatic · ${guess ? guess.name : 'none'}`); auto.value = ''; s.append(auto);
    t.cols.filter(c => c.v).forEach(c => { const o = el('option', null, c.name + (c.axis ? ' (axis)' : c.type === 'category' ? ' (categories)' : '')); o.value = c.name; s.append(o); });
    if (val && !t.byName[val]){ const o = el('option', null, `${val} (not in this table)`); o.value = val; s.append(o); }
    s.value = val || ''; s.onchange = () => commitOnce(s.value); row.append(s);
  } else if (p.type === 'color'){
    row.classList.add('wide');
    const split = v => { const s2 = String(Identity.color(v)); const t = s2.replace('#', ''); return { rgb:'#' + t.slice(0, 6), a:t.length >= 8 ? parseInt(t.slice(6, 8), 16) / 255 : 1 }; };
    const join = (rgb, a) => a >= .999 ? rgb : rgb + Math.round(Util.clamp(a) * 255).toString(16).padStart(2, '0');
    const cur0 = split(val);
    const c = el('input'); c.type = 'color'; c.value = cur0.rgb; c.setAttribute('aria-label', p.label);
    const ar = el('input', 'alpha'); Object.assign(ar, { type:'range', min:0, max:1, step:.01, value:cur0.a });
    ar.title = 'Opacity — drag to 0 for transparent'; ar.setAttribute('aria-label', `${p.label} opacity`);
    const setSwatch = () => { c.style.setProperty('--a', String(+ar.value)); c.classList.toggle('clear', +ar.value < .999); };
    const sw = el('div', 'swatches');
    const mark = () => { sw.querySelectorAll('.role').forEach(b => b.classList.toggle('on', b.dataset.role === inst.params[p.id])); lab.classList.toggle('linked', String(inst.params[p.id]).startsWith('role:')); lab.title = String(inst.params[p.id]).startsWith('role:') ? `Linked to ${Identity.roleLabel(inst.params[p.id])}` : ''; };
    const commitCol = () => { commit(join(c.value, +ar.value)); setSwatch(); mark(); };
    c.oninput = commitCol; ar.oninput = commitCol;
    bindLive(c, 'param'); bindLive(ar, 'param');
    setSwatch();
    const pair = el('div', 'colpair'); pair.append(c, ar);
    row.append(pair);
    if (Identity.active()){
      Identity.COLOR_ROLES.forEach(([r, name]) => { const b = el('button', 'role'); b.dataset.role = 'role:' + r; b.style.background = Identity.colourway()[r]; b.title = `Link to ${name}`; b.setAttribute('aria-label', `Link to ${name}`); b.textContent = name[0] + (r === 'accent2' ? '2' : ''); b.style.color = Identity.readable(Identity.colourway()[r]); b.onclick = () => { commitOnce('role:' + r); const sp = split('role:' + r); c.value = sp.rgb; ar.value = sp.a; setSwatch(); mark(); }; sw.append(b); });
      if (Assets.palette.length) sw.append(el('span', 'swsep'));
    }
    Assets.palette.forEach(pc => { const b = el('button'); b.style.background = pc.hex; b.title = `${pc.name} ${pc.hex.toUpperCase()}`; b.setAttribute('aria-label', pc.name); b.onclick = () => { c.value = pc.hex; commitCol(); History.end(); }; sw.append(b); });
    { const b = el('button', 'clearsw'); b.title = 'Transparent'; b.setAttribute('aria-label', 'Transparent'); b.onclick = () => { ar.value = 0; commitCol(); History.end(); }; sw.append(b); }
    if (sw.children.length) row.append(sw);
    mark();
  } else if (p.type === 'toggle'){
    row.classList.add('wide');
    const c = el('input'); c.type = 'checkbox'; c.checked = !!val; c.setAttribute('aria-label', p.label); c.onchange = () => commitOnce(c.checked); row.append(c); row.classList.add('has-pin'); row.append(pinButton(row, inst, p));
  } else if (p.type === 'select'){
    row.classList.add('wide');
    const s = el('select'); s.setAttribute('aria-label', p.label); p.options.forEach((o, i) => { const op = el('option', null, o); op.value = i; s.append(op); }); s.value = val;
    s.onchange = () => commitOnce(+s.value); row.append(s); row.classList.add('has-pin'); row.append(pinButton(row, inst, p));
  } else if (p.type === 'text'){
    row.classList.add('wide');
    const t = p.multiline ? el('textarea') : el('input'); if (!p.multiline) t.type = 'text'; else t.rows = 2;
    t.setAttribute('aria-label', p.label);
    t.value = val; t.oninput = () => commit(t.value); bindLive(t, 'param'); row.append(t);
  }
  return row;
}
const fmt = (v, step) => { const d = step >= 1 ? 0 : step >= .1 ? 1 : step >= .01 ? 2 : 3; return (+v).toFixed(d); };

const EYE_ON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M1.5 8S3.8 3.6 8 3.6 14.5 8 14.5 8 12.2 12.4 8 12.4 1.5 8 1.5 8Z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2.1" fill="currentColor"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M1.5 8S3.8 3.6 8 3.6 14.5 8 14.5 8 12.2 12.4 8 12.4 1.5 8 1.5 8Z" fill="none" stroke="currentColor" stroke-width="1.3" opacity=".55"/><path d="M3 13 13 3" stroke="currentColor" stroke-width="1.4"/></svg>';
function eyeBtn(inst, name, redraw){
  const eye = el('button', 'eye' + (inst.on ? '' : ' off'));
  eye.innerHTML = inst.on ? EYE_ON : EYE_OFF;
  eye.title = inst.on ? 'Turn off' : 'Turn on';
  eye.setAttribute('aria-label', `${inst.on ? 'Turn off' : 'Turn on'} ${name}`);
  eye.setAttribute('aria-pressed', String(!inst.on));
  eye.onclick = () => History.record('toggle', () => { inst.on = !inst.on; redraw(); markDirty(); });
  return eye;
}
function addMod(label, target){
  const b = el('button', 'add-mod', label);
  b.dataset.add = target;
  b.onclick = () => setLibTarget(target === 'A' ? 'prepareA' : target === 'B' ? 'prepareB' : target);
  return b;
}
function changeBtn(target, idx){
  const b = el('button', 'ghost', 'Change');
  b.dataset.change = target;
  b.dataset.idx = String(idx);
  b.title = 'Replace this module. [ and ] step through the others on the picture, Shift jumps a category';
  b.onclick = ev => { ev.stopPropagation(); setLibTarget(target === 'A' ? 'replacePrepareA' : target === 'B' ? 'replacePrepareB' : 'replaceFinish', idx); };
  return b;
}
function instNames(list, onOnly = true){
  return (list || []).filter(i => !onOnly || i.on !== false).map(i => (FX.byId[i.id] || {}).name).filter(Boolean);
}
function joinNames(names, max = 5){
  if (!names.length) return '';
  if (names.length <= max) return names.join(' · ');
  return names.slice(0, max).join(' · ') + ' · +' + (names.length - max);
}
function prepareSummary(){
  const a = instNames(state.sources.A.process);
  const b = instNames(state.sources.B.process);
  return `A${a.length ? ' · ' + a.join(' · ') : ''}\nB${b.length ? ' · ' + b.join(' · ') : ''}`;
}
function combineSummary(){
  if (!state.base) return '';
  const m = FX.byId[state.base.id]; const cat = CATS.find(c => c.id === m.cat);
  return cat ? `${m.name} · ${cat.label}` : m.name;
}
function finishSummary(){ return joinNames(instNames(state.stack, false)) || 'No finish modules'; }
function renderStageHeads(){
  const stages = [
    { name:'Prepare', canBypass:true, on:App.stageOn.prepare, setOn:v => { App.stageOn.prepare = v; markDirty(); }, tip:'Bypass Prepare. Fit still runs.' },
    { name:'Combine', canBypass:false, on:true, quiet:true },
    { name:'Finish', canBypass:true, on:App.stageOn.finish, setOn:v => { App.stageOn.finish = v; markDirty(); }, tip:'Bypass every Finish layer. The combined frame stays.' },
  ];
  stages.forEach(st => {
    const hdr = $(`#hdr${st.name}`); hdr.innerHTML = '';
    if (!st.quiet) hdr.append(el('span', 'stage-name', st.name === 'Finish' ? 'Layers' : st.name));
    if (st.canBypass){
      const on = el('span', 'stage-on' + (st.on ? ' on' : ''));
      on.append(el('i'), document.createTextNode(st.on ? 'ON' : 'OFF'));
      on.title = st.tip; on.setAttribute('role', 'button'); on.tabIndex = 0;
      on.setAttribute('aria-pressed', String(!st.on)); on.setAttribute('aria-label', `${st.name}: ${st.on ? 'on' : 'bypassed'}. Press to ${st.on ? 'bypass' : 'turn on'}.`);
      const flip = ev => { ev.stopPropagation(); st.setOn(!st.on); renderStageHeads(); };
      on.onclick = flip;
      on.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); flip(ev); } };
      hdr.append(on);
    }
  });
  updateBadges();
}

/* the first few controls always; the rest under one fold, so a module never opens onto a wall of sliders */
function paramRows(box, inst, m){
  const list = m.params, keep = m.primary != null ? m.primary : 6;
  const shown = list.length > keep + 1 ? list.slice(0, keep) : list, rest = list.slice(shown.length);
  shown.forEach(p => box.append(paramRow(inst, p)));
  if (!rest.length) return;
  const d = el('details', 'more'); d.open = !!App.ui.more[inst.uid];
  d.ontoggle = () => { App.ui.more[inst.uid] = d.open; };
  d.append(el('summary', null, `More controls (${rest.length})`));
  rest.forEach(p => d.append(paramRow(inst, p)));
  box.append(d);
}
function renderSrcTabs(){
  const box = $('#srcTabs'); if (!box) return;
  box.innerHTML = '';
  ['A', 'B'].forEach(k => {
    const info = App.mediaInfo[k] || {}, n = (state.sources[k].process || []).filter(i => i.on !== false).length, on = App.srcTab === k;
    const b = el('button', on ? 'on' : ''); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(on));
    const th = el('span', 'mt'); if (info.thumb) th.style.backgroundImage = `url("${info.thumb}")`;
    b.append(th, document.createTextNode(`Image ${k}`));
    if (n) b.append(el('span', 'cnt', String(n)));
    b.onclick = () => { App.srcTab = k; renderSrcTabs(); };
    box.append(b);
  });
  $('#slots').dataset.active = App.srcTab;
}

function renderBase(){
  const sec = $('#secBase'); sec.innerHTML = '';
  const m = FX.byId[state.base.id]; const cat = CATS.find(c => c.id === m.cat);
  const head = el('div', 'module-head');
  const title = el('span'); title.append(el('b', null, m.name));
  if (cat) title.append(el('small', null, cat.label));
  const acts = el('span');
  if (m.params.length){ const rb = el('button', 'ghost', 'Reset'); rb.onclick = () => History.record('reset', () => { state.base = makeInst(m.id); renderBase(); markDirty(); }); acts.append(rb); }
  const chg = el('button', 'ghost', 'Change'); chg.dataset.add = 'combine'; chg.title = 'Replace this module. [ and ] step through the others on the picture, Shift jumps a category'; chg.onclick = () => setLibTarget('combine'); acts.append(chg);
  head.append(title, acts);
  sec.append(head, el('p', 'desc', m.desc || ''));
  if (m.cat === 'transition') sec.querySelector('.desc').textContent += ' Timing follows the timeline length, easing and hold.';
  paramRows(sec, state.base, m);
  renderStageHeads();
}

let dragUid = null;
function renderStack(){
  const sec = $('#secStack'); sec.innerHTML = '';
  if (!state.stack.length){
    const box = el('div', 'empty-cta'); box.append(el('b', null, 'Nothing here yet'), 'Add a layer to grade, print or texture the frame. Try Film grain, Halftone or Levels & curves.');
    box.append(document.createElement('br'), addMod('+ Add to Finish', 'finish'));
    sec.append(box);
    renderStageHeads();
    return;
  }
  state.stack.forEach((inst, idx) => {
    const m = FX.byId[inst.id];
    const card = el('div', 'card'); if (!inst.on) card.classList.add('off'); if (!instIsOpen(inst.uid)) card.classList.add('collapsed');
    if (App.libTarget === 'replaceFinish' && App.libReplace === idx) card.classList.add('replacing');
    if (inst.uid === App.stepUid) card.classList.add('stepping');
    stepFocus(card, inst);
    const ch = el('div', 'ch'); ch.draggable = true;
    const num = el('span', 'step', String(idx + 1)); num.title = `Runs ${['first', 'second', 'third'][idx] || `${idx + 1}th`}`;
    const nm = el('div', 'nm'); nm.append(m.name, el('small', null, (CATS.find(c => c.id === m.cat) || {}).label));
    if (!inst.on) nm.append(el('small', 'hiddenTag', 'off'));
    nm.onclick = ev => { ev.stopPropagation(); setInstOpen(inst.uid, !instIsOpen(inst.uid)); card.classList.toggle('collapsed', !instIsOpen(inst.uid)); };
    const mk = (txt, title, fn) => { const b = el('button', 'ghost icon', txt); b.title = title; b.onclick = fn; return b; };
    ch.append(eyeBtn(inst, m.name, renderStack), num, nm, changeBtn('finish', idx),
      mk('↑', 'Move up', () => { if (idx > 0) History.record('reorder', () => { [state.stack[idx - 1], state.stack[idx]] = [state.stack[idx], state.stack[idx - 1]]; renderStack(); markDirty(); }); }),
        mk('↓', 'Move down', () => { if (idx < state.stack.length - 1) History.record('reorder', () => { [state.stack[idx + 1], state.stack[idx]] = [state.stack[idx], state.stack[idx + 1]]; renderStack(); markDirty(); }); }),
      mk('⧉', 'Duplicate', () => History.record('module', () => { const c = makeInst(inst.id); c.params = JSON.parse(JSON.stringify(inst.params)); if (inst.bind) c.bind = JSON.parse(JSON.stringify(inst.bind)); if (inst.expose) c.expose = JSON.parse(JSON.stringify(inst.expose)); openNewInst(c.uid); state.stack.splice(idx + 1, 0, c); renderStack(); markDirty(); })),
      mk('×', 'Remove', () => History.record('module', () => { Engine.resetFeedback([inst]); state.stack.splice(idx, 1); renderStack(); markDirty(); })));
    ch.ondragstart = e => { dragUid = inst.uid; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(inst.uid)); };
    ch.ondragend = () => { dragUid = null; card.classList.remove('dragging'); };
    card.ondragover = e => { if (dragUid != null){ e.preventDefault(); card.classList.add('over'); } };
    card.ondragleave = () => card.classList.remove('over');
    card.ondrop = e => {
      e.preventDefault(); card.classList.remove('over');
      const from = state.stack.findIndex(i => i.uid === dragUid); if (from < 0 || from === idx) return;
      History.record('reorder', () => { const [it] = state.stack.splice(from, 1); state.stack.splice(idx, 0, it); renderStack(); markDirty(); });
    };
    const cb = el('div', 'cb');
    if (m.desc) cb.append(el('p', 'desc', m.desc));
    paramRows(cb, inst, m);
    card.append(ch, cb); sec.append(card);
  });
  sec.append(addMod('+ Add to Finish', 'finish'));
  renderStageHeads();
}

/* ---------- sources ---------- */
function renderSlots(){
  const wrap = $('#slots'); wrap.innerHTML = '';
  ['A', 'B'].forEach(k => {
    const info = App.mediaInfo[k] || {}; const s = state.sources[k];
    const slot = el('div', 'slot');
    const th = el('div', 'thumb'); th.title = `${info.name || ''} — click or drop to replace`;
    if (info.thumb) th.style.backgroundImage = `url("${info.thumb}")`;
    if (info.alpha){ th.classList.add('alpha'); th.style.setProperty('--bgc', state.bg); }
    if (info.video){ const v = info.video; v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover'; th.append(v); }
    th.append(el('span', null, k));
    const fi = el('input'); fi.type = 'file'; fi.accept = 'image/*,video/*'; fi.hidden = true;
    fi.onchange = () => { loadFile(k, fi.files[0]); fi.value = ''; };
    th.onclick = () => fi.click();
    slot.ondragover = e => { e.preventDefault(); e.stopPropagation(); slot.classList.add('drag'); };
    slot.ondragleave = e => { if (e.relatedTarget && slot.contains(e.relatedTarget)) return; slot.classList.remove('drag'); };
    slot.ondrop = e => { e.preventDefault(); e.stopPropagation(); clearFileDrag(); loadFile(k, e.dataTransfer.files[0]); };
    const ctl = el('div', 'ctl');
    const fitSel = el('select'); ['Fill (crop)', 'Fit (letterbox)'].forEach((o, i) => { const op = el('option', null, o); op.value = i; fitSel.append(op); });
    fitSel.value = s.fit; fitSel.onchange = () => History.record('source', () => { s.fit = +fitSel.value; markDirty(); });
    fitSel.title = 'How this file first sits in the frame. Reframe in Prepare is a later crop.';
    const mini = (label, key, min, max, step) => { const row = el('label', 'mini'); const r = el('input'); Object.assign(r, { type:'range', min, max, step, value:s[key] }); r.title = label; r.setAttribute('aria-label', `${k} ${label}`); r.oninput = () => { History.begin('source'); s[key] = +r.value; markDirty(); }; bindLive(r, 'source'); r.ondblclick = () => History.record('source', () => { s[key] = key === 'zoom' ? 1 : 0; r.value = s[key]; markDirty(); }); row.title = 'Double-click the slider to reset'; row.append(el('span', null, label), r); return row; };
    ctl.append(fitSel, mini('Zoom', 'zoom', .25, 4, .01), mini('X', 'x', -1, 1, .01), mini('Y', 'y', -1, 1, .01));
    if (info.name === 'Placeholder') ctl.append(el('p', 'hint2', 'A stand-in image. Drop your own photograph or video on the stage, or click the picture above.'));
    if (s.asset && Assets.isVector(s.asset)) ctl.append(el('p', 'hint2', 'Vector file: the vector effects in Finish redraw its paths as lines, dots and more, and it stays sharp at any size.'));
    if (!Array.isArray(s.process)) s.process = [];
    const proc = el('div', 'proc');
    const ph = el('h3'); ph.append(el('span', null, `Prepare ${k}`), el('span', 'dim', s.process.length ? String(s.process.length) : ''));
    ph.title = 'Treatments and Reframe only. Fit above is how the file sits in the frame; Reframe here is a crop in the chain.';
    proc.append(ph);
    if (!s.process.length) proc.append(el('p', 'empty', 'No treatment modules'));
    s.process.forEach((inst, idx) => {
      const m = FX.byId[inst.id];
      if (!m) return;
      const card = el('div', 'card'); if (!inst.on) card.classList.add('off'); if (!instIsOpen(inst.uid)) card.classList.add('collapsed');
      if ((App.libTarget === 'replacePrepareA' && k === 'A' || App.libTarget === 'replacePrepareB' && k === 'B') && App.libReplace === idx) card.classList.add('replacing');
      if (inst.uid === App.stepUid) card.classList.add('stepping');
      stepFocus(card, inst);
      const ch = el('div', 'ch');
      const nm = el('div', 'nm'); nm.append(m.name);
      if (!inst.on) nm.append(el('small', 'hiddenTag', 'off'));
      nm.onclick = ev => { ev.stopPropagation(); setInstOpen(inst.uid, !instIsOpen(inst.uid)); card.classList.toggle('collapsed', !instIsOpen(inst.uid)); };
      const mk = (txt, title, fn) => { const b = el('button', 'ghost icon', txt); b.title = title; b.onclick = fn; return b; };
      ch.append(eyeBtn(inst, m.name, renderSlots), nm, changeBtn(k, idx),
        mk('↑', 'Move up', () => { if (idx > 0) History.record('reorder', () => { [s.process[idx - 1], s.process[idx]] = [s.process[idx], s.process[idx - 1]]; renderSlots(); markDirty(); }); }),
        mk('↓', 'Move down', () => { if (idx < s.process.length - 1) History.record('reorder', () => { [s.process[idx + 1], s.process[idx]] = [s.process[idx], s.process[idx + 1]]; renderSlots(); markDirty(); }); }),
        mk('×', 'Remove', () => History.record('module', () => { Engine.resetFeedback([inst]); s.process.splice(idx, 1); renderSlots(); markDirty(); })));
      const cb = el('div', 'cb');
      paramRows(cb, inst, m);
      card.append(ch, cb); proc.append(card);
    });
    proc.append(addMod(`+ Add to Prepare ${k}`, k));
    slot.append(th, fi, ctl, proc); wrap.append(slot);
  });
  renderSrcTabs();
  renderStageHeads();
}

/* ---------- timeline ---------- */
function initTimeline(){
  const easing = $('#easing'); Object.keys(EASE).forEach(k => easing.append(el('option', null, k)));
  const sync = () => { $('#dur').value = state.duration; $('#fps').value = String(state.fps); $('#loopMode').value = state.loopMode; easing.value = state.easing; $('#hold').value = state.hold; drawCurve(); };
  $('#dur').onchange = e => History.record('timeline', () => { state.duration = Util.clamp(+e.target.value || 4, .5, 60); App.t %= state.duration; sync(); markDirty(); });
  $('#fps').onchange = e => History.record('timeline', () => { state.fps = +e.target.value; markDirty(); });
  $('#loopMode').onchange = e => History.record('timeline', () => { state.loopMode = e.target.value; sync(); markDirty(); });
  easing.onchange = e => History.record('timeline', () => { state.easing = e.target.value; sync(); markDirty(); });
  $('#hold').onchange = e => History.record('timeline', () => { state.hold = Util.clamp(+e.target.value, 0, .45); sync(); markDirty(); });
  const scrub = $('#scrub');
  scrub.oninput = () => { App.playing = false; App.t = +scrub.value / 10000 * state.duration; updatePlayBtn(); markDirty(); };
  $('#btnPlay').onclick = togglePlay;
  App.syncTimeline = sync; sync(); updatePlayBtn();
  window.addEventListener('resize', () => { drawCurve(); layoutStage(); });
}
function drawCurve(){
  const c = $('#curve'), r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
  c.width = Math.max(1, r.width * dpr); c.height = Math.max(1, r.height * dpr);
  const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
  x.strokeStyle = 'rgba(201,245,228,.35)'; x.lineWidth = 1.25 * dpr; x.beginPath();
  for (let i = 0; i <= 200; i++){ const t = i / 200 * state.duration; const px = i / 200 * c.width, py = c.height - 3 * dpr - progressAt(t) * (c.height - 6 * dpr); i ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.stroke();
}
function togglePlay(){ App.playing = !App.playing; updatePlayBtn(); }
function updatePlayBtn(){
  $('#btnPlay').innerHTML = App.playing
    ? '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" fill="currentColor"/><rect x="7" y="1.5" width="3" height="9" fill="currentColor"/></svg>'
    : '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>';
}
function updateTimeUI(){
  const f = Math.floor(App.t * state.fps + 1e-6);
  const s = Math.floor(App.t);
  $('#tc').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(f % state.fps).padStart(2, '0')}`;
  const frac = App.t / state.duration;
  $('#playhead').style.left = `${frac * 100}%`;
  if (document.activeElement !== $('#scrub')) $('#scrub').value = Math.round(frac * 10000);
}

/* ---------- randomise ---------- */
function pickMod(list){ return list[Math.floor(Math.random() * list.length)]; }
function randomPrepare(k){
  const pool = FX.modules.filter(m => FX.laneEligible(m) && !m.noRandom);
  if (!pool.length) return;
  Engine.resetFeedback(state.sources[k].process || []);
  const n = Math.random() < .25 ? 0 : 1 + (Math.random() < .4 ? 1 : 0);
  const next = [];
  for (let i = 0; i < n; i++){
    const m = pickMod(pool);
    if (m && FX.laneEligible(m)) next.push(makeInst(m.id, true));
  }
  state.sources[k].process = next;
}
function randomCombine(){
  const bases = FX.modules.filter(m => ['transition', 'mix', 'generator'].includes(m.cat) && !m.noRandom);
  if (!bases.length) return;
  state.base = makeInst(pickMod(bases).id, true);
}
function randomFinish(scope){
  const enabled = new Set(RAND_CATS.filter(c => scope[c]));
  if (!enabled.size) return;
  const next = [];
  let replaced = 0;
  for (const inst of state.stack){
    const m = FX.byId[inst.id];
    if (!m || !enabled.has(m.cat)){ next.push(inst); continue; }
    const pool = FX.modules.filter(x => x.cat === m.cat && !x.noRandom);
    if (!pool.length){ next.push(inst); continue; }
    next.push(makeInst(pickMod(pool).id, true));
    replaced++;
  }
  if (!replaced){
    const pool = FX.modules.filter(x => enabled.has(x.cat) && !x.noRandom && catRole(x.cat) === 'stack');
    if (pool.length){
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) next.push(makeInst(pickMod(pool).id, true));
    }
  }
  state.stack = next;
}
function randomise(){
  const s = App.randScope;
  const work = s.prepareA || s.prepareB || s.combine || (s.finish && RAND_CATS.some(c => s[c]));
  if (!work){ toast('Tick a stage in the Randomise menu first.'); return; }
  History.record('randomise', () => {
    resetAllFeedback();
    if (s.prepareA) randomPrepare('A');
    if (s.prepareB) randomPrepare('B');
    if (s.combine) randomCombine();
    if (s.finish) randomFinish(s);
    renderBase(); renderStack(); renderSlots(); renderLibrary(); markDirty();
  });
  const bits = [];
  if (s.prepareA) bits.push('Prepare A');
  if (s.prepareB) bits.push('Prepare B');
  if (s.combine) bits.push((FX.byId[state.base.id] || {}).name || 'Combine');
  if (s.finish) bits.push(state.stack.map(x => (FX.byId[x.id] || {}).name).join(', ') || 'Finish');
  toast(bits.join(' · '));
}
function setRandScope(partial){
  App.randScope = { ...defaultRandScope(), ...App.randScope, ...partial };
  saveRandScope();
  syncRandMenu();
}
function syncRandMenu(){
  const s = App.randScope;
  document.querySelectorAll('#randMenu [data-rand]').forEach(inp => { inp.checked = !!s[inp.dataset.rand]; });
  const cats = $('#randCats');
  if (cats) cats.style.opacity = s.finish ? '1' : '.4';
  document.querySelectorAll('#randCats [data-rand]').forEach(inp => { inp.disabled = !s.finish; });
}
function openRandMenu(open){
  const menu = $('#randMenu'), btn = $('#btnRandScope');
  if (!menu) return;
  const on = open == null ? menu.hidden : !!open;
  menu.hidden = !on;
  if (btn) btn.setAttribute('aria-expanded', String(on));
  if (on) syncRandMenu();
}
function initRandomiseUi(){
  syncRandMenu();
  $('#btnRandom').onclick = () => { openRandMenu(true); randomise(); };
  $('#btnRandScope').onclick = e => { e.stopPropagation(); openRandMenu(); };
  document.querySelectorAll('#randMenu [data-rand]').forEach(inp => {
    inp.onchange = () => {
      const key = inp.dataset.rand;
      const next = { [key]: inp.checked };
      if (key === 'finish' && !inp.checked) { /* cats stay as last preference */ }
      setRandScope(next);
    };
  });
  document.addEventListener('pointerdown', e => {
    if (!$('#randMenu').hidden && !e.target.closest('#randWrap')) openRandMenu(false);
  });
}

/* ---------- project files ---------- */
function projectFromState(forHistory){
  const src = k => {
    const s = state.sources[k];
    return { fit:s.fit, zoom:s.zoom, x:s.x, y:s.y, ...(s.asset ? { asset:s.asset } : {}), process:(s.process || []).map(clean) };
  };
  return { app:'fxlab', version:1, name:projectName(), size:{ id:state.sizeId, w:state.W, h:state.H }, bg:state.bg,
    timeline:{ duration:state.duration, fps:state.fps, loopMode:state.loopMode, easing:state.easing, hold:state.hold },
    sources:{ A:src('A'), B:src('B') }, base:clean(state.base), stack:state.stack.map(clean), print:state.print, transparent:state.transparent,
    ...(state.language ? { language:{ ...state.language } } : {}),
    ...(forHistory ? {} : { data:Data.toProject() }) };
}
function isNamed(){ return !!(state.name && String(state.name).trim()); }
function projectName(){ return isNamed() ? String(state.name).trim() : 'Untitled'; }
function slugName(name){
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}
function syncProjectName(){
  const t = $('#projTitle'); if (t) t.textContent = projectName();
}
function setProjectName(name, fromHistory){
  const next = String(name || '').trim();
  if (fromHistory || History.silent){ state.name = next; syncProjectName(); return; }
  History.record('name', () => { state.name = next; syncProjectName(); });
}
function askName(initial){
  return new Promise(resolve => {
    const dlg = $('#nameDlg'), inp = $('#projName');
    inp.value = initial || '';
    dlg.classList.add('on');
    setTimeout(() => { inp.focus(); inp.select(); }, 0);
    const done = v => { dlg.classList.remove('on'); resolve(v); };
    $('#nameCancel').onclick = () => done(null);
    $('#nameOk').onclick = () => done(inp.value.trim());
    inp.onkeydown = e => {
      if (e.key === 'Enter'){ e.preventDefault(); done(inp.value.trim()); }
      if (e.key === 'Escape'){ e.preventDefault(); done(null); }
    };
  });
}
async function saveProject(asNew){
  if (asNew || !isNamed()){
    const n = await askName(isNamed() ? projectName() : '');
    if (n == null) return;
    if (!n){ toast('Give the project a name.', true); return; }
    setProjectName(n);
  }
  const body = JSON.stringify(projectFromState(), null, 2);
  await download(new Blob([body], { type:'application/json' }), `${slugName(projectName())}.fxlab.json`);
}
function saveProjectAs(){ return saveProject(true); }
function restoreProject(d, missing){
  resetAllFeedback();
  Object.assign(state, { sizeId:d.size?.id || 'custom', W:d.size?.w || 1080, H:d.size?.h || 1080, bg:d.bg || '#000000' });
  Object.assign(state, d.timeline || {});
  const loadedName = d.name != null ? String(d.name).trim() : '';
  state.name = !loadedName || loadedName === 'Untitled' ? '' : loadedName;
  state.print = d.print ? Object.assign(Print.defaults(), d.print) : null;
  state.transparent = !!d.transparent;
  if (d.data !== undefined) Data.fromProject(d.data);
  state.language = d.language ? { name:'', rule:'', ...d.language } : null;
  if (state.print){ const dp = Print.docPx(state.print); state.W = dp.W; state.H = dp.H; state.sizeId = state.print.preset; }
  const takeSrc = raw => ({
    fit: raw && raw.fit != null ? raw.fit : 0,
    zoom: raw && raw.zoom != null ? raw.zoom : 1,
    x: raw && raw.x != null ? raw.x : 0,
    y: raw && raw.y != null ? raw.y : 0,
    ...(raw && raw.asset ? { asset:raw.asset } : {}),
    process:[],
  });
  state.sources = { A:takeSrc(d.sources && d.sources.A), B:takeSrc(d.sources && d.sources.B) };
  applyProcess(d, missing);
  state.base = hydrateInst(d.base || {}, missing) || makeInst('src-a');
  for (const k of ['A', 'B']) if (state.sources[k].asset && Assets.get(state.sources[k].asset)) useAssetAsSource(k, state.sources[k].asset);
  state.stack = (d.stack || []).map(o => hydrateInst(o, missing)).filter(Boolean);
  $('#bgColor').value = state.bg;
  $('#clearBg').checked = state.transparent; $('#bgColor').disabled = state.transparent; $('#stageBox').classList.toggle('clear', state.transparent);
  App.syncTop(); App.syncTimeline(); applySize(); Print.syncPreview(); renderBase(); renderStack(); renderSlots(); renderLibrary();
  syncProjectName();
}
function loadProject(text){
  let d; try { d = JSON.parse(text); } catch { toast('That file isn’t valid JSON.', true); return; }
  if (!d || d.app !== 'fxlab'){ toast('That isn’t an fxlab project file.', true); return; }
  const missing = [];
  History.silent = true;
  try { restoreProject(d, missing); }
  finally { History.silent = false; }
  History.reset();
  toast(missing.length ? `Opened, but skipped modules: ${missing.join(', ')}` : 'Project opened. Photos and video aren’t stored in projects; drop them back in. Images come from Assets.', !!missing.length, 5000);
}

/* ---------- export ---------- */
function triggerDownload(blob, name){
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}
function withSuffix(name, n){
  const i = name.lastIndexOf('.');
  if (i <= 0) return `${name}-${n}`;
  return `${name.slice(0, i)}-${n}${name.slice(i)}`;
}
async function dirHasFile(dir, name){
  try { await dir.getFileHandle(name); return true; }
  catch { return false; }
}
async function writeToDir(dir, name, blob){
  let out = name, n = 2;
  while (await dirHasFile(dir, out)){ out = withSuffix(name, n); n++; }
  const fh = await dir.getFileHandle(out, { create:true });
  const w = await fh.createWritable();
  await w.write(blob); await w.close();
  return out;
}
async function ensureExportDir(){
  const ask = async h => {
    if (!h || !h.queryPermission) return null;
    let p = await h.queryPermission({ mode:'readwrite' });
    if (p === 'prompt') p = await h.requestPermission({ mode:'readwrite' });
    return p === 'granted' ? h : null;
  };
  const cur = await ask(App.exportDir);
  if (cur) return cur;
  const pending = await ask(App.exportDirPending);
  if (pending){ App.exportDir = pending; App.exportDirPending = null; syncFolderBtn(); return pending; }
  App.exportDir = null;
  return null;
}
function syncFolderBtn(){
  const b = $('#btnFolder'); if (!b) return;
  if (App.exportDir) b.textContent = `Export to: ${App.exportDir.name}`;
  else b.textContent = 'Export folder…';
}
async function pickExportFolder(){
  if (!window.showDirectoryPicker){
    toast('This browser downloads to your usual Downloads folder. Chrome or Edge can write to a folder you choose.');
    return;
  }
  try {
    const h = await window.showDirectoryPicker({ id:'fxlab-export', mode:'readwrite' });
    App.exportDir = h; App.exportDirPending = null;
    let persisted = false;
    try { await Assets.ready; await Assets.metaPut('exportDir', h); persisted = true; }
    catch { persisted = false; }
    App.exportDirPersisted = persisted;
    syncFolderBtn();
    toast(persisted
      ? `Exports go to “${h.name}”. This browser may ask again next time.`
      : `Exports go to “${h.name}” for this session.`);
  } catch (e){
    if (e && e.name === 'AbortError') return;
    toast('Couldn’t open that folder. Exports will download as usual.', true);
  }
}
async function restoreExportDir(){
  try {
    await Assets.ready;
    const h = await Assets.metaGet('exportDir');
    if (!h || !h.queryPermission) return;
    const p = await h.queryPermission({ mode:'readwrite' });
    if (p === 'granted'){ App.exportDir = h; App.exportDirPersisted = true; }
    else if (p === 'prompt'){ App.exportDirPending = h; App.exportDirPersisted = true; }
    syncFolderBtn();
  } catch { /* session-only if restore fails */ }
}
async function download(blob, name){
  const dir = await ensureExportDir();
  if (dir){
    try {
      const written = await writeToDir(dir, name, blob);
      toast(`Saved ${written} to ${dir.name}`);
      return written;
    } catch (e){
      console.warn('fxlab: folder write failed', e);
      toast('Couldn’t write to the export folder. Downloading instead.', true);
    }
  }
  triggerDownload(blob, name);
  return name;
}
function fileStem(){ return slugName(projectName()); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hasFeedback = () => App.stageOn.finish !== false && state.stack.some(i => i.on && FX.byId[i.id].feedback);
function busy(on, title = '', text = ''){ $('#busy').classList.toggle('on', on); $('#busyTitle').textContent = title; $('#busyText').textContent = text; $('#busyBar').style.width = '0'; }
const busyProgress = (f, text) => { $('#busyBar').style.width = `${Math.round(f * 100)}%`; if (text) $('#busyText').textContent = text; };

async function withFullRes(fn){
  App.exporting = true; App.cancel = false;
  const wasPlaying = App.playing; App.playing = false;
  Engine.setSize(state.W, state.H, 1); resetAllFeedback();
  try { await fn(); }
  catch (e){ if (String(e.message) === 'cancelled') toast('Export cancelled'); else { console.error(e); toast(`Export stopped: ${e.message || e}`, true, 6000); } }
  finally { busy(false); Engine.setSize(state.W, state.H, state.quality); resetAllFeedback(); App.exporting = false; App.playing = wasPlaying; updatePlayBtn(); markDirty(); }
}
async function preroll(fromT, seconds){
  const n = Math.round(seconds * state.fps);
  for (let i = n; i > 0; i--){ renderAt(fromT - i / state.fps); if (i % 10 === 0) await sleep(0); if (App.cancel) throw new Error('cancelled'); }
}
const canvasBlob = (type = 'image/png', q) => new Promise((res, rej) => Engine.canvas.toBlob(b => b ? res(b) : rej(new Error('Canvas export failed')), type, q));
/* Transparent export: render the frame over black and over white, then solve for the
   alpha that explains the difference. Exact for anything composited over the backdrop. */
const alphaCanvas = document.createElement('canvas');
function renderAlphaFrame(t){
  const gl = Engine.gl, w = Engine.rw, h = Engine.rh;
  Engine.backCheck = false;
  Engine.backOverride = [0, 0, 0]; renderAt(t);
  const dark = new Uint8Array(w * h * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, dark);
  resetAllFeedback();
  Engine.backOverride = [1, 1, 1]; renderAt(t);
  const light = new Uint8Array(w * h * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, light);
  Engine.backOverride = null;
  alphaCanvas.width = w; alphaCanvas.height = h;
  const ctx = alphaCanvas.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++){
    const src = (h - 1 - y) * w * 4, dst = y * w * 4;
    for (let x = 0; x < w * 4; x += 4){
      let a = 0;
      for (let k = 0; k < 3; k++) a = Math.max(a, 255 - (light[src + x + k] - dark[src + x + k]));
      a = Util.clamp(a, 0, 255);
      const inv = a > 0 ? 255 / a : 0;
      for (let k = 0; k < 3; k++) d[dst + x + k] = Util.clamp(dark[src + x + k] * inv, 0, 255);
      d[dst + x + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return alphaCanvas;
}
const frameBlob = async t => {
  if (!state.transparent) return canvasBlob();
  const c = renderAlphaFrame(t);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Canvas export failed')), 'image/png'));
};

function exportPNG(){
  return withFullRes(async () => {
    busy(true, 'Exporting PNG', `${state.W}×${state.H}`);
    if (hasFeedback()) await preroll(App.t, Math.min(state.duration, 2));
    renderAt(App.t);
    await download(await frameBlob(App.t), `${fileStem()}.png`);
    toast(`Exported PNG at ${state.W}×${state.H}${state.transparent ? ' with transparency' : ''}`);
  });
}

/* ---------- looks ---------- */
function lookFromState(){
  return {
    base:clean(state.base), stack:state.stack.map(clean),
    timeline:{ duration:state.duration, loopMode:state.loopMode, easing:state.easing, hold:state.hold },
    sources:{ A:{ process:(state.sources.A.process || []).map(clean) }, B:{ process:(state.sources.B.process || []).map(clean) } },
  };
}
function applyLook(data, quiet = false){
  const run = () => {
    resetAllFeedback();
    state.base = hydrateInst(data.base) || makeInst('src-a');
    state.stack = (data.stack || []).map(o => hydrateInst(o)).filter(Boolean);
    applyProcess(data);
    if (data.timeline) Object.assign(state, data.timeline);
    if (!quiet){ App.syncTimeline(); renderBase(); renderStack(); renderSlots(); renderLibrary(); markDirty(); }
  };
  if (quiet || History.silent) run();
  else History.record('look', run);
}
function snapshotThumb(){
  const c = document.createElement('canvas'), s = 240 / Math.max(Engine.canvas.width, Engine.canvas.height);
  c.width = Math.round(Engine.canvas.width * s); c.height = Math.round(Engine.canvas.height * s);
  c.getContext('2d').drawImage(Engine.canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .8);
}
/* the time where a transition is most complete (for stills) */
function stillTime(){
  let best = 0, bt = 0; const D = state.duration;
  for (let i = 0; i <= 80; i++){ const t = i / 80 * D * .999, p = progressAt(t); if (p > best + 1e-4){ best = p; bt = t; } }
  return Math.min(D * .999, bt + D * .02);
}

async function exportBatch(jobs, format){
  if (!jobs.length) return;
  if (format === 'mp4' && !(await pickEncoder(1080, 1080, 30, 8e6))){ toast('This browser can’t encode MP4 in the background. Choose PNG stills, or use Chrome or Safari.', true, 7000); return; }
  const saved = { look:lookFromState(), W:state.W, H:state.H, sizeId:state.sizeId, active:Assets.identity.active, t:App.t, playing:App.playing };
  App.exporting = true; App.cancel = false; App.playing = false;
  const zip = new Zip(), slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const kit = slug(Assets.kitName || 'export') || 'export';
  try {
    for (let i = 0; i < jobs.length; i++){
      if (App.cancel) throw new Error('cancelled');
      const j = jobs[i];
      applyLook(j.look.data, true);
      state.W = j.size.w; state.H = j.size.h;
      if (j.cw != null && Assets.identity.colourways[j.cw]){ Assets.identity.active = j.cw; Assets.version++; }
      Engine.setSize(state.W, state.H, 1); resetAllFeedback();
      const cwName = j.cw != null && Assets.identity.colourways[j.cw] ? '_' + slug(Assets.identity.colourways[j.cw].name) : '';
      const name = `${kit}/${slug(j.look.name)}${cwName}_${state.W}x${state.H}`;
      busy(true, `Exporting ${i + 1} of ${jobs.length}`, `${j.look.name} · ${state.W}×${state.H}`);
      if (format === 'mp4'){
        const out = await encodeVideoBlob(`${i + 1}/${jobs.length} ${j.look.name}`);
        await zip.add(`${name}.mp4`, out.blob);
      } else {
        if (hasFeedback()) await preroll(stillTime(), Math.min(state.duration, 2));
        renderAt(stillTime()); await zip.add(`${name}.png`, await canvasBlob());
      }
    }
    busy(true, 'Zipping…', ''); busyProgress(1);
    download(zip.blob(), `${kit}_system_${format}.zip`);
    toast(`Exported ${jobs.length} file${jobs.length > 1 ? 's' : ''}.`, false, 5000);
  } catch (e){
    if (String(e.message) === 'cancelled') toast('Export cancelled'); else { console.error(e); toast(`Export stopped: ${e.message || e}`, true, 7000); }
  } finally {
    Assets.identity.active = saved.active; Assets.version++;
    applyLook(saved.look, true);
    Object.assign(state, { W:saved.W, H:saved.H, sizeId:saved.sizeId });
    busy(false); Engine.setSize(state.W, state.H, state.quality); resetAllFeedback();
    App.exporting = false; App.t = saved.t; App.playing = saved.playing; updatePlayBtn();
    App.syncTop(); App.syncTimeline(); layoutStage(); renderBase(); renderStack(); renderSlots(); renderLibrary(); markDirty();
  }
}

function pickMime(){
  const types = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
}
/* pick the best WebCodecs encoder: H.264 first (what social platforms want), then VP9 */
async function pickEncoder(w, h, fps, bitrate){
  if (!window.VideoEncoder || !window.VideoFrame || !window.Mp4Muxer) return null;
  const tries = [
    ['avc1.640033', 'avc'], ['avc1.640028', 'avc'], ['avc1.4d0033', 'avc'], ['avc1.42003e', 'avc'],
    ['vp09.00.51.08', 'vp9'], ['vp09.00.41.08', 'vp9'],
  ];
  for (const [codec, mux] of tries){
    const config = { codec, width:w, height:h, bitrate, framerate:fps, ...(mux === 'avc' ? { avc:{ format:'avc' } } : {}) };
    try { const r = await VideoEncoder.isConfigSupported(config); if (r.supported) return { config, mux }; } catch {}
  }
  return null;
}
/* render the current state to an MP4 blob (engine must already be at full size) */
async function encodeVideoBlob(label = ''){
  const fps = state.fps, frames = Math.round(state.duration * fps);
  const bitrate = Math.round(Util.clamp(state.W * state.H * fps * .18, 4e6, 40e6));
  const enc = await pickEncoder(state.W, state.H, fps, bitrate);
  if (!enc) return null;
  const muxer = new Mp4Muxer.Muxer({ target:new Mp4Muxer.ArrayBufferTarget(), fastStart:'in-memory',
    video:{ codec:enc.mux, width:state.W, height:state.H, frameRate:fps } });
  let failure = null;
  const encoder = new VideoEncoder({ output:(chunk, meta) => muxer.addVideoChunk(chunk, meta), error:e => { failure = e; } });
  encoder.configure(enc.config);
  if (hasFeedback()) await preroll(0, state.duration);
  const usec = 1e6 / fps;
  for (let i = 0; i < frames; i++){
    if (App.cancel){ encoder.close(); throw new Error('cancelled'); }
    if (failure) throw failure;
    renderAt(i / fps);
    const frame = new VideoFrame(Engine.canvas, { timestamp:Math.round(i * usec), duration:Math.round(usec) });
    encoder.encode(frame, { keyFrame:i % (fps * 2) === 0 }); frame.close();
    while (encoder.encodeQueueSize > 6) await sleep(4);
    busyProgress((i + 1) / frames * .96, `${label ? label + ' · ' : ''}Frame ${i + 1} of ${frames} · ${enc.mux === 'avc' ? 'H.264' : 'VP9'} MP4`);
    if (i % 3 === 0) await sleep(0);
  }
  await encoder.flush(); encoder.close();
  if (failure) throw failure;
  muxer.finalize();
  return { blob:new Blob([muxer.target.buffer], { type:'video/mp4' }), codec:enc.mux };
}
function exportVideo(){
  return withFullRes(async () => {
    const fps = state.fps, frames = Math.round(state.duration * fps);
    const bitrate = Math.round(Util.clamp(state.W * state.H * fps * .18, 4e6, 40e6));
    busy(true, 'Exporting video', 'Preparing encoder…');
    if (state.transparent) toast('MP4 can’t carry transparency — the video uses the letterbox colour. Use a PNG sequence for an alpha channel.', true, 7000);
    const out = await encodeVideoBlob();
    if (!out) return recordVideo(fps, frames, bitrate);
    await download(out.blob, `${fileStem()}.mp4`);
    if (out.codec === 'avc') toast(`Exported MP4 (H.264) · ${state.W}×${state.H} · ${fps}fps · ${state.duration}s`, false, 5000);
    else toast('Exported MP4, but this browser has no H.264 encoder so it used VP9. For Instagram/TikTok-ready files, export from Chrome or Safari.', true, 9000);
  });
}
/* fallback for browsers without WebCodecs: real-time capture */
async function recordVideo(fps, frames, bitrate){
  const mime = pickMime();
  if (!mime) throw new Error('this browser can’t encode video. Use PNG sequence, or try Chrome or Safari');
  busy(true, 'Recording video', 'Real-time capture. Keep this tab visible.');
  if (hasFeedback()) await preroll(0, state.duration);
  renderAt(0);
  const stream = Engine.canvas.captureStream(0); const track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, { mimeType:mime, videoBitsPerSecond:bitrate });
  const chunks = []; rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise(r => rec.onstop = r);
  rec.start(250);
  for (let i = 0; i < 15; i++){ renderAt(0); track.requestFrame && track.requestFrame(); await sleep(1000 / fps); } /* encoder warm-up */
  const frameMs = 1000 / fps; const t0 = performance.now();
  for (let i = 0; i < frames; i++){
    if (App.cancel){ rec.stop(); await stopped; throw new Error('cancelled'); }
    renderAt(i / fps);
    if (track.requestFrame) track.requestFrame();
    busyProgress((i + 1) / frames, `Frame ${i + 1} of ${frames} · ${mime.split(';')[0]}`);
    await sleep(Math.max(0, t0 + (i + 1) * frameMs - performance.now()));
  }
  rec.stop(); await stopped; track.stop();
  if (!chunks.length) throw new Error('the browser recorded no frames. Try PNG sequence');
  const ext = mime.includes('mp4') ? 'mp4' : 'webm';
  await download(new Blob(chunks, { type:mime.split(';')[0] }), `${fileStem()}.${ext}`);
  toast(`Exported ${ext.toUpperCase()} · ${state.W}×${state.H} · ${fps}fps`, false, 5000);
}
/* minimal STORE zip writer (no dependencies, works offline) */
const Zip = (() => {
  const table = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = table[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  return function(){
    const parts = [], central = []; let offset = 0;
    this.add = async (name, blob) => {
      const data = new Uint8Array(await blob.arrayBuffer()), nm = new TextEncoder().encode(name), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true);
      parts.push(h.buffer, nm, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, offset, true);
      central.push(c.buffer, nm);
      offset += 30 + nm.length + data.length;
    };
    this.blob = () => {
      const size = central.reduce((a, b) => a + b.byteLength, 0), count = central.length / 2;
      const e = new DataView(new ArrayBuffer(22));
      e.setUint32(0, 0x06054b50, true); e.setUint16(8, count, true); e.setUint16(10, count, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
      return new Blob([...parts, ...central, e.buffer], { type:'application/zip' });
    };
  };
})();
function exportSequence(){
  return withFullRes(async () => {
    const fps = state.fps, frames = Math.round(state.duration * fps);
    if (frames > 65000) throw new Error('too many frames for one zip');
    busy(true, 'Exporting PNG sequence', `${state.W}×${state.H} · ${frames} frames`);
    const zip = new Zip(), stem = fileStem();
    if (hasFeedback()) await preroll(0, state.duration);
    for (let i = 0; i < frames; i++){
      if (App.cancel) throw new Error('cancelled');
      renderAt(i / fps);
      await zip.add(`${stem}/frame_${String(i).padStart(5, '0')}.png`, await frameBlob(i / fps));
      busyProgress((i + 1) / frames * .95, `Frame ${i + 1} of ${frames}`);
      if (i % 4 === 0) await sleep(0);
    }
    busyProgress(1, 'Zipping…');
    await download(zip.blob(), `${stem}_${fps}fps.zip`);
    toast(`Exported ${frames} frames at ${fps}fps`, false, 5000);
  });
}

/* ---------- drop on stage, keyboard ---------- */
const LINK_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg>';

function clearFileDrag(){
  App.dragDepth = 0;
  const w = $('#stageWrap'), lib = $('#lib');
  if (w) w.classList.remove('drag');
  if (lib) lib.classList.remove('drag');
  document.querySelectorAll('.slot.drag').forEach(s => s.classList.remove('drag'));
}
function initDrop(){
  const w = $('#stageWrap');
  const isFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter', e => {
    if (!isFiles(e)) return;
    App.dragDepth++;
    w.classList.add('drag');
  });
  window.addEventListener('dragleave', e => {
    if (!isFiles(e) && !App.dragDepth) return;
    App.dragDepth = Math.max(0, App.dragDepth - 1);
    if (!App.dragDepth) clearFileDrag();
  });
  window.addEventListener('dragover', e => { if (isFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', e => {
    e.preventDefault();
    clearFileDrag();
    const all = [...(e.dataTransfer?.files || [])];
    const assetLike = f => /\.(zip|fxkit)$/i.test(f.name);
    const dataLike = f => /\.(csv|tsv|json|geojson|ndjson|txt)$/i.test(f.name) && !/\.fxlab\.json$/i.test(f.name);
    if (all.some(assetLike)){ importAssets(all); return; }
    const table = all.find(dataLike);
    if (table && !all.some(f => /^(image|video)\//.test(f.type))){ loadDataFile(table); return; }
    const files = all.filter(f => /^(image|video)\//.test(f.type) || /\.svg$/i.test(f.name));
    if (!files.length) return;
    if (files.length >= 2){ loadFile('A', files[0]); loadFile('B', files[1]); }
    else loadFile(App.mediaInfo.A && App.mediaInfo.A.name !== 'Placeholder' ? 'B' : 'A', files[0]);
  });
  window.addEventListener('dragend', clearFileDrag);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') clearFileDrag();
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.code === 'KeyZ'){
      if (typingField(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) History.redo(); else History.undo();
      return;
    }
    if (e.ctrlKey && !e.metaKey && e.code === 'KeyY'){
      if (typingField(e.target)) return;
      e.preventDefault();
      History.redo();
      return;
    }
    if (typingField(e.target) || (/input|textarea|select/i.test(e.target.tagName) && e.target.type !== 'range')) return;
    if (e.code === 'Space'){ e.preventDefault(); togglePlay(); }
    else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft'){ e.preventDefault(); App.playing = false; updatePlayBtn(); App.t = ((App.t + (e.code === 'ArrowRight' ? 1 : -1) / state.fps) % state.duration + state.duration) % state.duration; markDirty(); }
    else if (e.code === 'Home'){ App.t = 0; markDirty(); }
  });
  window.addEventListener('pointerup', () => History.end());
  window.addEventListener('pointercancel', () => History.end());
}

/* ---------- boot ---------- */
function boot(){
  if (!Engine.gl){
    document.getElementById('stageWrap').innerHTML = '<p style="max-width:420px;color:#e4e2dc">fxlab needs WebGL2. Open this file in a current Chrome, Safari, Edge or Firefox with hardware acceleration turned on.</p>';
    return;
  }
  setPlaceholder('A'); setPlaceholder('B');
  state.base = makeInst('src-a');
  state.stack = [];
  initTopBar(); initTimeline(); initDrop();
  $('#clearBg').checked = state.transparent;
  $('#clearBg').onchange = e => History.record('bg', () => { state.transparent = e.target.checked; $('#stageBox').classList.toggle('clear', state.transparent); $('#bgColor').disabled = state.transparent; markDirty(); });
  $('#bgColor').value = state.bg;
  $('#bgColor').oninput = e => { History.begin('bg'); state.bg = e.target.value; document.querySelectorAll('.slot .thumb.alpha').forEach(t => t.style.setProperty('--bgc', state.bg)); markDirty(); };
  bindLive($('#bgColor'), 'bg');
  $('#btnSwap').onclick = () => History.record('swap', () => {
    const m = Engine.media; const a = { ...m.A }, b = { ...m.B };
    Engine.setMedia('A', b.el, b.w, b.h, b.video); Engine.setMedia('B', a.el, a.w, a.h, a.video);
    [App.mediaInfo.A, App.mediaInfo.B] = [App.mediaInfo.B, App.mediaInfo.A];
    [state.sources.A, state.sources.B] = [state.sources.B, state.sources.A];
    renderSlots(); markDirty();
  });
  $('#search').oninput = renderLibrary;
  $('#libCtxDone').onclick = () => setLibTarget(null);
  App.setLibTarget = setLibTarget;
  renderLibrary(); renderBase(); renderStack(); renderSlots();
  syncProjectName(); syncFolderBtn();
  Assets.ready.then(restoreExportDir);
  applySize();
  new ResizeObserver(() => { layoutStage(); drawCurve(); }).observe($('#stageWrap'));
  let last = performance.now();
  const tick = now => {
    requestAnimationFrame(tick);
    const dt = Math.max(0, Math.min(.1, (now - last) / 1000)); last = now;
    if (App.exporting) return;
    if (App.playing){ App.t = (App.t + dt) % state.duration; App.dirty = true; }
    if (App.dirty || Engine.hasVideo()){ renderAt(App.t); App.dirty = false; updateTimeUI(); }
  };
  requestAnimationFrame(tick);
  window.fxlab = { setLibTarget, renderLibrary, FX, Engine, Assets, Data, Language, Arena, renderArena, renderLanguage, exportBoard, Identity, showWorkspace, updateBadges, toggleBindPopover, Print, PRINT_SIZES, setPrintPreset, applyLook, lookFromState, projectFromState, exportBatch, searchLibrary, state, App, History, renderAt, makeInst, loadProject, restoreProject, randomise, setRandScope, projectName, slugName, setProjectName, saveProject, saveProjectAs, fileStem, replaceInst, clearFileDrag, refresh:() => { renderLibrary(); renderBase(); renderStack(); renderSlots(); markDirty(); } };
  initAssetsUI(); initSystemUI(); initWorkspaces(); initDataUI(); renderArena(); initLanguageUI();
}


