/* ---------------- Language tab, pins, and the tool (player) ---------------- */
const PIN_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M8 3h8l-1.2 6.2L18 13H6l3.2-3.8z"/></svg>';

/* the pin beside a control: press to make it one of the language's controls */
function pinButton(row, inst, p){
  const b = el('button', 'pin'); b.type = 'button'; b.innerHTML = PIN_ICON;
  const sync = () => {
    const on = !!(inst.expose && inst.expose[p.id]);
    row.classList.toggle('pinned', on); b.setAttribute('aria-pressed', String(on));
    b.title = on ? `Pinned as “${inst.expose[p.id].label}”. Press to remove it from the language's controls.` : 'Pin this as one of the language’s controls';
    b.setAttribute('aria-label', on ? `Unpin ${p.label}` : `Pin ${p.label} as a control`);
  };
  b.onclick = () => { Language.toggle(inst, p); sync(); updateBadges(); if (App.ws === 'language') renderLanguage(); };
  sync(); return b;
}

/* a pinned control as a full-width row, used by the tool and the variation list */
function controlRow(e, onChange){
  const { inst, p, x } = e, row = el('div', 'prm'), lab = el('label', null, x.label || p.label); row.append(lab);
  const val = inst.params[p.id], set = v => { History.begin('param'); inst.params[p.id] = v; onChange && onChange(); markDirty(); History.end(); };
  if (p.type === 'range'){
    const { lo, hi } = Language.bounds(e), r = el('input');
    Object.assign(r, { type:'range', min:Math.min(lo, hi), max:Math.max(lo, hi), step:p.step, value:val }); r.setAttribute('aria-label', x.label || p.label);
    const num = el('input', 'val'); num.type = 'text'; num.value = fmt(val, p.step); num.setAttribute('aria-label', `${x.label || p.label} value`);
    r.oninput = () => { num.value = fmt(+r.value, p.step); History.begin('param'); inst.params[p.id] = +r.value; markDirty(); onChange && onChange(); };
    r.onchange = () => History.end();
    num.onchange = () => { const v = Util.clamp(parseFloat(num.value), Math.min(lo, hi), Math.max(lo, hi)); if (!isNaN(v)){ r.value = v; num.value = fmt(v, p.step); set(v); } };
    lab.title = 'Double-click to reset'; lab.ondblclick = () => { const d = Util.clamp(p.def, Math.min(lo, hi), Math.max(lo, hi)); r.value = d; num.value = fmt(d, p.step); set(d); };
    row.append(r, num);
  } else if (p.type === 'select'){
    row.classList.add('wide'); const s = el('select'); s.setAttribute('aria-label', x.label || p.label);
    p.options.forEach((o, i) => { const op = el('option', null, o); op.value = i; s.append(op); }); s.value = val; s.onchange = () => set(+s.value); row.append(s);
  } else {
    row.classList.add('wide'); const c = el('input'); c.type = 'checkbox'; c.checked = !!val; c.setAttribute('aria-label', x.label || p.label); c.onchange = () => set(c.checked); row.append(c);
  }
  return row;
}

function download1(blob, name){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }

/* variations rendered small, without touching the composition: only pinned values move, and they are put back */
async function renderVariations(seed, n, w, h, strength, size){
  const meta = { W:state.W, H:state.H, t:App.t, playing:App.playing, exporting:App.exporting };
  const snap = Language.snapshot(), out = [];
  App.exporting = true; App.playing = false;
  try {
    Object.assign(state, { W:w, H:h }); Engine.setSize(w, h, 1);
    for (let k = 0; k < n; k++){
      Language.restore(snap); if (k > 0) Language.apply(Language.variation(seed, k, strength, snap));
      resetAllFeedback(); if (hasFeedback()) await preroll(stillTime(), .5);
      renderAt(stillTime());
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(Engine.canvas, 0, 0, w, h); out.push(c);
    }
  } finally {
    Language.restore(snap);
    Object.assign(state, { W:meta.W, H:meta.H }); App.exporting = meta.exporting; App.playing = meta.playing; App.t = meta.t;
    applySize(); resetAllFeedback(); markDirty();
  }
  return out;
}

/* the envelope the check compares against: the language at nine variations, measured */
async function ensureEnvelope(){
  const meta = Language.meta();
  if (!Language.count()) return null;
  const w = 128, tiles = await renderVariations(meta.seed, 9, w, Math.round(w * state.H / state.W), .9);
  meta.envelope = Language.envelope(tiles.map(Language.signature));
  return meta.envelope;
}

/* drop an image, see which of its measurements sit inside the language */
function checkBlock(getEnv){
  const b = el('div', 'block'); b.append(el('h3', null, 'Check an image'));
  b.append(el('p', 'hint2', 'Drop an image made with this language. It is measured for tone, colour, palette and texture and compared with the range the language produces. It cannot judge composition.'));
  const inp = el('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.hidden = true;
  const btn = el('button', null, 'Choose an image'); btn.onclick = () => inp.click();
  const out = el('div', 'checkout'); out.setAttribute('aria-live', 'polite');
  inp.onchange = async () => {
    const f = inp.files[0]; inp.value = ''; if (!f) return;
    out.textContent = 'Measuring…';
    try {
      const env = await getEnv(); if (!env){ out.textContent = 'Pin at least one control first, so the language has a range to compare with.'; return; }
      const img = new Image(), url = URL.createObjectURL(f);
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error(`Couldn’t read ${f.name}. Use JPG, PNG, WebP or GIF.`)); img.src = url; });
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); URL.revokeObjectURL(url);
      const r = Language.check(c, env);
      out.innerHTML = '';
      out.append(el('p', r.out ? 'verdict off' : 'verdict on', r.out ? `${r.out} of ${r.rows.length} measurements sit outside the language.` : 'Everything measured sits inside the language.'));
      r.rows.forEach(x => {
        const row = el('div', 'chk-row' + (x.ok ? '' : ' off')); row.title = x.note;
        row.append(el('span', 'nm', x.label), el('span', 'vv', `${fmt(x.value, .001)}`), el('span', 'rg', `${fmt(x.lo, .001)} to ${fmt(x.hi, .001)}`), el('span', 'st', x.ok ? 'Inside' : x.value < x.lo ? 'Below' : 'Above'));
        out.append(row);
      });
    } catch (e){ out.textContent = e.message || String(e); }
  };
  b.append(btn, inp, out); return b;
}

async function copyLink(){
  try {
    await ensureEnvelope();
    const { url, length } = await Language.link(Language.recipe());
    if (length > 60000){ toast('This language is too large for a link. Save the tool file instead.', true, 6000); return; }
    try { await navigator.clipboard.writeText(url); toast(length > 8000 ? 'Link copied. It is long, so some chat apps may cut it; the tool file is safer.' : 'Link copied. Anyone opening it gets this language as a tool.', length > 8000, 6000); }
    catch { window.prompt('Copy this link', url); }
  } catch (e){ toast(e.message || String(e), true, 7000); }
}

async function importTokens(file){
  try {
    const r = Language.importTokens(JSON.parse(await file.text()));
    refreshInspector(); renderBase(); renderStack(); markDirty(); renderLanguage(); if (typeof renderAssets === 'function') renderAssets(); if (typeof renderSystem === 'function') renderSystem();
    toast(`Read ${r.colours} colour${r.colours === 1 ? '' : 's'}${r.roles.length ? ` and set ${r.roles.join(', ')}` : ''}${r.ease ? ', and the easing' : ''}.`);
  } catch (e){ toast(e instanceof SyntaxError ? 'That file isn’t valid JSON.' : (e.message || String(e)), true, 7000); }
}

async function exportBoard(){
  const meta = Language.meta(), ex = Language.exposed();
  if (!ex.length){ toast('Pin at least one control first, so the board has something to vary.', true); return; }
  busy(true, 'Making the board', 'Rendering variations…');
  try {
    const TW = 360, TH = Math.round(360 * state.H / state.W), cols = 4, rows = 2, gap = 24, pad = 40;
    const tiles = await renderVariations(meta.seed, cols * rows, TW, TH, .8);
    const W = pad * 2 + cols * TW + (cols - 1) * gap, head = 190, foot = 60 + Math.ceil(ex.length / 3) * 22;
    const H = head + rows * (TH + 34) + (rows - 1) * gap + foot;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const cw = Identity.colourway(); x.fillStyle = cw.ground; x.fillRect(0, 0, W, H);
    const ink = Identity.contrast(cw.ink, cw.ground) >= 4 ? cw.ink : Identity.readable(cw.ground), sans = Util.fonts[0], mono = Util.fonts[2];
    x.fillStyle = ink; x.textBaseline = 'alphabetic';
    x.font = `600 40px ${sans}`; x.fillText(meta.name || 'Untitled language', pad, pad + 34);
    x.globalAlpha = .7; x.font = `400 17px ${sans}`;
    const words = (meta.rule || 'A language: what stays fixed, and what may vary.').split(/\s+/); let line = '', yy = pad + 68;
    words.forEach(wd => { const t = line ? line + ' ' + wd : wd; if (x.measureText(t).width > W - pad * 2 && line){ x.fillText(line, pad, yy); yy += 24; line = wd; } else line = t; }); x.fillText(line, pad, yy);
    x.globalAlpha = 1;
    const pal = Assets.palette.length ? Assets.palette.map(p => p.hex).slice(0, 12) : [cw.ground, cw.ink, cw.accent, cw.accent2];
    pal.forEach((h, i) => { x.fillStyle = h; x.fillRect(pad + i * 34, head - 40, 26, 26); x.strokeStyle = 'rgba(255,255,255,.18)'; x.strokeRect(pad + i * 34 + .5, head - 40 + .5, 25, 25); });
    tiles.forEach((t, k) => {
      const cx = pad + (k % cols) * (TW + gap), cy = head + Math.floor(k / cols) * (TH + 34 + gap);
      x.drawImage(t, cx, cy, TW, TH);
      x.fillStyle = ink; x.globalAlpha = .6; x.font = `400 12px ${mono}`; x.fillText(k === 0 ? 'THE LANGUAGE AS IT STANDS' : `SEED ${Language.seedString(meta.seed)} · ${k}`, cx, cy + TH + 20); x.globalAlpha = 1;
    });
    x.font = `400 12px ${mono}`; x.fillStyle = ink; x.globalAlpha = .55;
    ex.forEach((e, i) => { const { lo, hi } = Language.bounds(e) || {}; const cx = pad + (i % 3) * ((W - pad * 2) / 3), cy = H - foot + 34 + Math.floor(i / 3) * 22; x.fillText(`${e.x.label || e.p.label}${lo != null ? `  ${fmt(lo, e.p.step)}–${fmt(hi, e.p.step)}` : ''}`, cx, cy); });
    x.globalAlpha = .4; x.fillText('made with fxlab', W - pad - 110, H - 22);
    download1(await new Promise(res => c.toBlob(res, 'image/png')), `${Language.slug()}-board.png`);
    toast('Saved the language board.');
  } catch (e){ console.error(e); toast(`Couldn’t make the board: ${e.message || e}`, true, 7000); }
  busy(false);
}

async function exportTool(){
  const meta = Language.meta();
  if (!Language.count()){ toast('Pin at least one control first. A tool needs something to adjust.', true); return; }
  try {
    await ensureEnvelope();
    const html = await Language.tool();
    download1(new Blob([html], { type:'text/html' }), `${Language.slug()}-tool.html`);
    toast(`Saved the tool (${Math.round(html.length / 1024)} KB). Open it in any browser.`);
  } catch (e){ toast(e.message || String(e), true, 8000); }
}

function renderLanguage(){
  const box = $('#languageBody'); if (!box) return;
  const scroll = box.scrollTop; box.innerHTML = '';
  const meta = Language.meta(), ex = Language.exposed();

  /* name and rule */
  const id = el('div', 'block'); id.append(el('h3', null, 'Name and rule'));
  const nr = el('div', 'prm wide'); nr.append(el('label', null, 'Name')); const ni = el('input'); ni.type = 'text'; ni.value = meta.name; ni.placeholder = 'e.g. Slow print'; ni.setAttribute('aria-label', 'Language name');
  ni.onchange = () => { meta.name = ni.value.trim(); markDirty(); }; nr.append(ni); id.append(nr);
  const ta = el('textarea'); ta.rows = 3; ta.value = meta.rule; ta.placeholder = 'One or two sentences: what never changes, and what is allowed to.'; ta.setAttribute('aria-label', 'The rule');
  ta.onchange = () => { meta.rule = ta.value.trim(); }; id.append(ta); box.append(id);

  /* constants */
  const con = el('div', 'block'); con.append(el('h3', null, 'What stays fixed'));
  const fx = [...state.sources.A.process, ...state.sources.B.process].filter(i => i.on !== false).length, fin = state.stack.filter(i => i.on !== false).length, cw = Identity.colourway();
  const chips = el('div', 'chipline'); const chip = (a, b) => { const s = el('span'); s.append(b ? `${a} ` : a, ...(b ? [el('b', null, b)] : [])); chips.append(s); };
  chip('Combine', FX.byId[state.base.id].name); chip('Prepare', fx ? `${fx} layer${fx > 1 ? 's' : ''}` : 'none'); chip('Finish', fin ? `${fin} layer${fin > 1 ? 's' : ''}` : 'none');
  chip('Palette', Assets.palette.length ? `${Assets.palette.length} colours` : (cw.name || 'default')); chip('Easing', Identity.EASES[Identity.ease ? (Assets.identity.motion.ease | 0) : 0]); chip('Length', `${state.duration}s`);
  if (Data.boundCount(allInsts().map(a => a.inst))) chip('Data', `${Data.boundCount(allInsts().map(a => a.inst))} linked`);
  con.append(chips, el('p', 'hint2', 'Everything not pinned below is a constant. It cannot be changed in the tool.')); box.append(con);

  /* variation */
  const vary = el('div', 'block'); vary.append(el('h3', null, `What may vary${ex.length ? ` (${ex.length})` : ''}`));
  if (!ex.length){
    vary.append(el('p', 'hint2', 'Pin the few controls that carry this language: hover any control and press its pin. Name each after what it does to the picture, not how it works.'));
    const sug = el('button', null, 'Suggest controls'); sug.title = 'Pins one defining control from each layer'; sug.onclick = () => { const n = Language.suggest(); refreshInspector(); renderLanguage(); toast(n ? `Pinned ${n} control${n > 1 ? 's' : ''}. Rename them below.` : 'Nothing to pin yet: add some layers first.'); }; vary.append(sug);
  }
  ex.forEach(e => {
    const row = el('div', 'lang-row'), lab = el('div', 'lab');
    const li = el('input'); li.type = 'text'; li.value = e.x.label; li.setAttribute('aria-label', `Name for ${e.p.label}`);
    li.onchange = () => History.record('pin', () => { e.x.label = li.value.trim() || e.p.label; });
    lab.append(li, el('small', null, `${e.m.name} · ${e.p.label} · ${e.where}`));
    const rng = el('div', 'rng');
    if (e.p.type === 'range'){
      const b = Language.bounds(e), lo = el('input'), hi = el('input');
      [[lo, b.lo, 'Lowest'], [hi, b.hi, 'Highest']].forEach(([i, v, l]) => { i.type = 'number'; i.step = e.p.step; i.min = e.p.min; i.max = e.p.max; i.value = fmt(v, e.p.step); i.setAttribute('aria-label', `${l} value of ${e.x.label}`); });
      const save = () => History.record('pin', () => { const l = parseFloat(lo.value), h = parseFloat(hi.value); if (isFinite(l)) e.x.lo = Util.clamp(l, e.p.min, e.p.max); if (isFinite(h)) e.x.hi = Util.clamp(h, e.p.min, e.p.max); });
      lo.onchange = save; hi.onchange = save; rng.append(lo, hi);
    }
    const lock = el('button', 'ghost', e.x.lock ? 'Held still' : 'Varies'); lock.style.padding = '0 8px';
    lock.title = e.x.lock ? 'Held still when exploring. Press to let it vary.' : 'Moves when exploring. Press to hold it still.'; lock.onclick = () => { History.record('pin', () => { e.x.lock = !e.x.lock; if (!e.x.lock) delete e.x.lock; }); renderLanguage(); };
    const rm = el('button', 'ghost icon', '×'); rm.title = 'Remove from the language’s controls'; rm.setAttribute('aria-label', `Unpin ${e.x.label}`); rm.onclick = () => { Language.toggle(e.inst, e.p); refreshInspector(); renderLanguage(); };
    rng.append(el('span', 'sp'), lock, rm); row.append(lab, rng); vary.append(row);
  });
  box.append(vary);

  /* versions */
  if (ex.length){
    const ver = el('div', 'block'); ver.append(el('h3', null, 'Versions'));
    ver.append(el('p', 'hint2', 'Keep a version of the pinned values before you explore, and come back to it. Saved with the project.'));
    const vr = el('div', 'prm'); vr.append(el('label', null, 'Name')); const vi = el('input'); vi.type = 'text'; vi.placeholder = `Version ${Language.versions().length + 1}`; vi.setAttribute('aria-label', 'Version name'); vi.style.width = '100%';
    const vb = el('button', null, 'Keep this'); vb.onclick = () => { Language.saveVersion(vi.value); markDirty(); renderLanguage(); toast('Kept this version.'); };
    vr.append(vi, vb); vr.style.gridTemplateColumns = '104px 1fr auto'; ver.append(vr);
    Language.versions().slice().reverse().forEach(v => {
      const d = Language.diffVersion(v), row = el('div', 'ver-row'); const lab = el('div', 'lab');
      lab.append(el('b', null, v.name), el('small', null, `${v.made} · ${d.length ? `${d.length} pin${d.length > 1 ? 's' : ''} differ from now` : 'same as now'}`));
      if (d.length){ const ul = el('ul', 'diff'); d.slice(0, 6).forEach(x => ul.append(el('li', null, `${x.label}: ${x.p.type === 'range' ? fmt(x.from, x.p.step) + ' → ' + fmt(x.to, x.p.step) : x.p.type === 'select' ? x.p.options[x.from] + ' → ' + x.p.options[x.to] : String(x.from) + ' → ' + String(x.to)}`))); lab.append(ul); }
      const acts = el('div', 'acts'); const rs = el('button', null, 'Restore'); rs.disabled = !d.length; rs.onclick = () => { Language.restoreVersion(v); refreshInspector(); markDirty(); renderLanguage(); };
      const rm = el('button', 'ghost icon', '×'); rm.title = 'Delete this version'; rm.setAttribute('aria-label', `Delete ${v.name}`); rm.onclick = () => { const a = Language.versions(); a.splice(a.indexOf(v), 1); markDirty(); renderLanguage(); };
      acts.append(rs, rm); row.append(lab, acts); ver.append(row);
    });
    box.append(ver);
  }

  /* explore */
  if (ex.length){
    const exp = el('div', 'block'); exp.append(el('h3', null, 'Explore'));
    exp.append(el('p', 'hint2', 'Each seed is a reproducible walk through the ranges above. Press a picture to take it.'));
    const sr = el('div', 'prm'); sr.append(el('label', null, 'Seed')); const si = el('input'); si.type = 'text'; si.value = Language.seedString(meta.seed); si.setAttribute('aria-label', 'Seed'); si.style.width = '100%';
    const shuf = el('button', null, 'Shuffle'); shuf.onclick = () => { meta.seed = Language.newSeed(); renderLanguage(); };
    si.onchange = () => { const n = Language.parseSeed(si.value); if (n){ meta.seed = n; renderLanguage(); } else si.value = Language.seedString(meta.seed); };
    sr.append(si, shuf); sr.style.gridTemplateColumns = '104px 1fr auto'; exp.append(sr);
    const wr = el('div', 'prm'); wr.append(el('label', null, 'How far')); const wi = el('input'); Object.assign(wi, { type:'range', min:.1, max:1, step:.05, value:App.langStrength || .7 }); wi.setAttribute('aria-label', 'How far to wander');
    const wv = el('input', 'val'); wv.type = 'text'; wv.readOnly = true; wv.value = fmt(+wi.value, .05); wr.append(wi, wv); exp.append(wr);
    const grid = el('div', 'varigrid'); exp.append(grid);
    const draw = async () => {
      App.langStrength = +wi.value; wv.value = fmt(+wi.value, .05);
      const my = App.langDraw = (App.langDraw || 0) + 1;
      const tiles = await renderVariations(meta.seed, 6, 180, Math.round(180 * state.H / state.W), +wi.value);
      if (my !== App.langDraw || App.ws !== 'language') return;
      grid.innerHTML = '';
      tiles.forEach((c, k) => {
        const b = el('button'); b.type = 'button'; b.append(c, el('span', null, k === 0 ? 'As it stands' : `${Language.seedString(meta.seed)} · ${k}`)); b.setAttribute('aria-label', k === 0 ? 'Keep it as it stands' : `Take variation ${k}`);
        b.onclick = () => { if (k === 0) return; const snap = Language.snapshot(); History.record('variation', () => Language.apply(Language.variation(meta.seed, k, +wi.value, snap))); refreshInspector(); markDirty(); renderLanguage(); };
        grid.append(b);
      });
    };
    wi.oninput = () => { wv.value = fmt(+wi.value, .05); }; wi.onchange = draw;
    draw(); box.append(exp);
  }

  /* hand it on */
  const out = el('div', 'block lang-export'); out.append(el('h3', null, 'Hand it on'));
  const card = (t, d, label, fn, primary) => { const c = el('div', 'xcard'); const l = el('div'); l.append(el('b', null, t), el('p', null, d)); const b = el('button', primary ? 'primary' : '', label); b.onclick = fn; c.append(l, b); out.append(c); };
  card('Tool', 'One HTML file: this composition locked, only your pinned controls shown. Drop in an image, adjust, export.', 'Save tool', exportTool, true);
  card('Language board', 'Variations of the language, with the palette and each control’s range, as one PNG.', 'Save board', exportBoard);
  card('Link', 'A web address that carries the language and opens it as a tool. Nothing is uploaded; it lives in the address.', 'Copy link', copyLink);
  card('Recipe', 'The whole composition as JSON. Opens in fxlab.', 'Save recipe', async () => { await ensureEnvelope(); download1(new Blob([JSON.stringify(Language.recipe(), null, 2)], { type:'application/json' }), `${Language.slug()}.fxlanguage.json`); });
  card('Tokens', 'Colour and motion as W3C design tokens, for Figma, Style Dictionary and code.', 'Save tokens', () => download1(new Blob([JSON.stringify(Language.tokens(), null, 2)], { type:'application/json' }), `${Language.slug()}.tokens.json`));
  const fid = el('div', 'fidelity'); fid.innerHTML = '<b>What travels.</b> The tool and the recipe carry everything, exactly, but need fxlab’s renderer, so they run in a browser with WebGL2. Tokens carry colour and motion only: a stack of treatments and textures cannot be written as tokens, and pretending otherwise would lose it. Images are not stored; the tool starts with stand-ins.';
  out.append(fid); box.append(out);
  box.append(checkBlock(async () => meta.envelope || ensureEnvelope()));
  const tk = el('div', 'block'); tk.append(el('h3', null, 'Start from tokens'));
  tk.append(el('p', 'hint2', 'Read colours and easing from a W3C design token file, so the language starts from an existing system. Names such as ink, ground, accent or primary become colour roles.'));
  const tf = el('input'); tf.type = 'file'; tf.accept = '.json,application/json'; tf.hidden = true; tf.onchange = () => { if (tf.files[0]) importTokens(tf.files[0]); tf.value = ''; };
  const tb = el('button', null, 'Choose a token file'); tb.onclick = () => tf.click(); tk.append(tb, tf); box.append(tk);
  box.scrollTop = scroll;
}

/* ---------- the tool: the same app, opened on a recipe ---------- */
function renderControls(){
  const box = $('#controlsBody'); if (!box) return;
  const meta = Language.meta(), ex = Language.exposed().filter(e => !e.x.lock);
  box.innerHTML = '';
  const seedBox = el('div', 'block'); seedBox.append(el('h3', null, 'Explore'));
  const sr = el('div', 'prm'); sr.append(el('label', null, 'Seed')); const si = el('input'); si.type = 'text'; si.value = Language.seedString(meta.seed); si.setAttribute('aria-label', 'Seed'); si.style.width = '100%';
  const go = () => { const snap = App.toolBase || (App.toolBase = Language.snapshot()); Language.apply(Language.variation(meta.seed, 1, .9, snap)); markDirty(); renderControls(); };
  const shuf = el('button', 'primary', 'Shuffle'); shuf.onclick = () => { meta.seed = Language.newSeed(); go(); };
  si.onchange = () => { const n = Language.parseSeed(si.value); if (n){ meta.seed = n; go(); } };
  const reset = el('button', 'ghost', 'Reset'); reset.title = 'Back to the language as it was made'; reset.onclick = () => { if (App.toolBase) Language.restore(App.toolBase); markDirty(); renderControls(); };
  sr.append(si, shuf); sr.style.gridTemplateColumns = '104px 1fr auto'; seedBox.append(sr, reset); box.append(seedBox);
  const lst = el('div', 'block'); lst.append(el('h3', null, 'Controls'));
  ex.forEach(e => lst.append(controlRow(e)));
  if (!ex.length) lst.append(el('p', 'hint2', 'This language has no adjustable controls.'));
  box.append(lst);
  if (meta.envelope) box.append(checkBlock(async () => meta.envelope));
  box.append(el('p', 'hint2', 'Drop your own image on the stage, then export from the Export tab. The rest of the composition is fixed by the language.'));
}

function enterPlayer(r){
  App.player = true; document.body.classList.add('player');
  restoreProject(r.project, []);
  state.language = { name:r.name || '', rule:r.rule || '', seed:r.seed || Language.newSeed(), envelope:r.envelope };
  App.toolBase = Language.snapshot();
  const name = r.name || 'Language';
  $('#projTitle').textContent = name; $('.brand').firstChild.textContent = 'fxlab ';
  const by = el('small', 'by', 'language'); $('.brand').insertBefore(by, $('#projTitle'));
  $('#ctlTitle').textContent = name; $('#ctlRule').textContent = r.rule || '';
  $('#tabControls').hidden = false;
  App.wsList = ['controls', 'images', 'export'];
  WORKSPACES.splice(0, WORKSPACES.length, ...App.wsList);
  App.wsList.forEach((w, i) => { const k = $('#tab' + cap1(w) + ' .k'); if (k) k.textContent = String(i + 1); });
  History.reset(); renderControls(); showWorkspace('controls');
}

function initLanguageUI(){
  if (!state.language) state.language = { name:'', rule:'', seed:Language.newSeed() };
  if (PLAYER_RECIPE) enterPlayer(PLAYER_RECIPE);
  else if (/^#lang=/.test(location.hash)) openLink(location.hash);
}

/* a language opened from a link: this browser's own palette and colourways are left alone */
async function openLink(hash){
  try {
    const r = await Language.fromHash(hash);
    await Assets.ready;
    Assets.detach();
    Assets.identity = Object.assign(Identity.blank(), r.identity || {}); Assets.palette = r.palette || [];
    enterPlayer(r);
  } catch (e){ toast(e.message || String(e), true, 8000); }
}
