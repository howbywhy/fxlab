/* ---------------- System tab ---------------- */
let sysOpen = { batch:false };
const SYS = () => Assets.identity;
const saveSys = (quiet = true) => { Assets.saveIdentity(quiet); renderBase(); renderStack(); markDirty(); };

function renderSystem(){
  const pane = $('#paneSystem'); if (!pane || !SYS()) return;
  const scroll = pane.scrollTop; pane.innerHTML = '';
  const d = SYS();
  const head = (t, extra) => { const h = el('div', 'ahead'); h.append(t); if (extra) h.append(extra); pane.append(h); };

  const intro = el('p', 'anote', 'Link colours, fonts and logos to brand roles. Change a role here and every linked module updates, in every look.');
  pane.append(intro);
  const auto = el('label', 'chk sysauto'); const ai = el('input'); ai.type = 'checkbox'; ai.checked = d.autoApply; ai.onchange = () => { d.autoApply = ai.checked; saveSys(); };
  auto.append(ai, 'New modules link to brand roles'); pane.append(auto);

  /* colourways */
  const cwBtn = el('button', 'ghost', 'From palette'); cwBtn.title = 'Rebuild colourways from the palette';
  cwBtn.onclick = () => { if (!Assets.palette.length){ toast('Add colours to the palette first (Assets tab).'); return; } d.colourways = []; Identity.autoSetup(); saveSys(false); };
  head('Colourways', cwBtn);
  if (!d.colourways.length) pane.append(el('p', 'anote', 'No colourways yet. Import logos with brand colours, or add one below.'));
  d.colourways.forEach((cw, i) => {
    const row = el('div', 'cwrow' + (i === d.active ? ' on' : ''));
    const strip = el('button', 'strip'); strip.title = 'Use this colourway';
    ['ground', 'ink', 'accent', 'accent2'].forEach(r => { const s = el('i'); s.style.background = cw[r]; strip.append(s); });
    strip.onclick = () => { d.active = i; saveSys(false); };
    const nm = el('input'); nm.type = 'text'; nm.value = cw.name; nm.setAttribute('aria-label', 'Colourway name'); nm.onchange = () => { cw.name = nm.value.trim() || `Colourway ${i + 1}`; saveSys(); };
    const rm = el('button', 'ghost icon', '×'); rm.title = `Remove ${cw.name}`; rm.onclick = () => { d.colourways.splice(i, 1); d.active = Math.min(d.active, Math.max(0, d.colourways.length - 1)); saveSys(false); };
    row.append(strip, nm, rm); pane.append(row);
  });
  const cw = d.colourways[d.active];
  if (cw){
    const ed = el('div', 'cwedit');
    Identity.COLOR_ROLES.forEach(([r, name]) => {
      const row = el('div', 'prm wide'); row.append(el('label', null, name));
      const c = el('input'); c.type = 'color'; c.value = cw[r]; c.oninput = () => { cw[r] = c.value; saveSys(); }; c.onchange = () => renderSystem(); row.append(c);
      if (Assets.palette.length){ const sw = el('div', 'swatches'); Assets.palette.forEach(pc => { const b = el('button'); b.style.background = pc.hex; b.title = pc.name; b.onclick = () => { cw[r] = pc.hex; saveSys(false); }; sw.append(b); }); row.append(sw); }
      ed.append(row);
    });
    const ratio = Identity.contrast(cw.ink, cw.ground);
    ed.append(el('p', 'anote' + (ratio < 3 ? ' warn' : ''), `Ink on ground contrast ${ratio.toFixed(1)}:1${ratio < 3 ? ' — low for small text' : ratio >= 7 ? ' — excellent' : ''}`));
    pane.append(ed);
  }
  const addCw = el('button', null, cw ? 'Duplicate colourway' : 'Add colourway');
  addCw.onclick = () => { const base = cw || Identity.colourway(); d.colourways.push({ ...base, name:`${base.name || 'Colourway'} copy` }); d.active = d.colourways.length - 1; saveSys(false); };
  pane.append(addCw);

  /* type roles */
  head('Type');
  Identity.FONT_ROLES.forEach(([r, name]) => {
    const row = el('div', 'prm wide'); row.append(el('label', null, name));
    const s = el('select');
    const auto = el('option', null, 'Auto'); auto.value = ''; s.append(auto);
    const fonts = Assets.fonts();
    if (fonts.length){ const g = el('optgroup'); g.label = 'Your fonts'; fonts.forEach(f => { const o = el('option', null, f.name); o.value = 'asset:' + f.id; g.append(o); }); s.append(g); }
    const g2 = el('optgroup'); g2.label = 'System'; Util.fontNames.forEach(n => { const o = el('option', null, n); o.value = n; g2.append(o); }); s.append(g2);
    s.value = d.type[r] || ''; s.onchange = () => { d.type[r] = s.value; saveSys(false); };
    row.append(s); pane.append(row);
    const ref = Identity.fontRef('role:' + r), fam = Util.family({ font:ref });
    const spec = el('div', 'specimen', r === 'display' ? 'Aa Headline' : 'The quick brown fox jumps.'); spec.style.fontFamily = fam; if (r === 'display') spec.classList.add('big');
    pane.append(spec);
  });

  /* logo roles */
  head('Logos');
  const imgs = Assets.images();
  if (!imgs.length) pane.append(el('p', 'anote', 'Add logos in the Assets tab to assign roles.'));
  else Identity.LOGO_ROLES.forEach(([r, name]) => {
    const row = el('div', 'prm wide'); row.append(el('label', null, name));
    const wrap = el('div', 'pick'), s = el('select'), mini = el('div', 'mini checker');
    const auto = el('option', null, 'Auto'); auto.value = ''; s.append(auto);
    imgs.forEach(a => { const o = el('option', null, a.name); o.value = 'asset:' + a.id; s.append(o); });
    s.value = d.logos[r] || ''; const a = Assets.get('role:' + r); mini.style.backgroundImage = a ? `url("${a.thumb}")` : 'none';
    s.onchange = () => { d.logos[r] = s.value; saveSys(false); };
    wrap.append(s, mini); row.append(wrap); pane.append(row);
  });

  /* motion */
  head('Motion');
  const m = d.motion;
  const er = el('div', 'prm wide'); er.append(el('label', null, 'Easing'));
  const es = el('select'); Identity.EASES.forEach((n, i) => { const o = el('option', null, n); o.value = i; es.append(o); }); es.value = m.ease;
  es.onchange = () => { m.ease = +es.value; saveSys(false); }; er.append(es); pane.append(er);
  const cv = el('canvas', 'curvebox'); cv.width = 280; cv.height = 84; pane.append(cv);
  requestAnimationFrame(() => {
    const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height);
    x.strokeStyle = 'rgba(255,255,255,.08)'; x.strokeRect(.5, .5, cv.width - 1, cv.height - 1);
    x.strokeStyle = '#c9f5e4'; x.lineWidth = 2; x.beginPath();
    for (let i = 0; i <= 100; i++){ const t = i / 100, y = Identity.ease(t); const px = 8 + t * (cv.width - 16), py = cv.height - 12 - y * (cv.height - 24); i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke();
  });
  if ((m.ease | 0) === 5){
    const br = el('div', 'bez');
    m.bezier.forEach((v, i) => { const n = el('input'); n.type = 'number'; n.step = .01; n.value = v; n.setAttribute('aria-label', ['x1', 'y1', 'x2', 'y2'][i]); n.onchange = () => { m.bezier[i] = Util.clamp(+n.value || 0, i % 2 ? -1 : 0, i % 2 ? 2 : 1); saveSys(false); }; br.append(n); });
    pane.append(br);
  }
  const rng = (label, key, min, max, step, note) => {
    const row = el('div', 'prm'); row.append(el('label', null, label));
    const r = el('input'); Object.assign(r, { type:'range', min, max, step, value:m[key] });
    const v = el('input', 'val'); v.type = 'text'; v.value = m[key];
    r.oninput = () => { m[key] = +r.value; v.value = r.value; saveSys(); };
    v.onchange = () => { m[key] = Util.clamp(+v.value, min, max); r.value = m[key]; saveSys(); };
    row.append(r, v); pane.append(row); if (note) pane.append(el('p', 'anote tight', note));
  };
  rng('Slant', 'slant', 0, 3, .05, 'How far type and logos lean into their speed.');
  rng('Beat', 'beat', 1, 16, 1, 'Beats per loop for rhythm modules set to brand.');

  /* looks */
  head('Looks');
  const saveRow = el('div', 'aadd'); saveRow.style.gridTemplateColumns = '1fr auto';
  const ln = el('input'); ln.type = 'text'; ln.placeholder = 'Name this look';
  const lb = el('button', null, 'Save current');
  lb.onclick = () => {
    const name = ln.value.trim() || `Look ${d.looks.length + 1}`;
    d.looks.push({ id:'l' + Date.now().toString(36), name, thumb:snapshotThumb(), data:lookFromState() });
    saveSys(false); toast(`Saved look “${name}”`);
  };
  saveRow.append(ln, lb); pane.append(saveRow);
  if (d.looks.length){
    const grid = el('div', 'agrid'); grid.style.marginTop = '8px';
    d.looks.forEach((lk, i) => {
      const tile = el('div', 'aimg');
      const pic = el('div', 'pic'); pic.style.backgroundImage = `url("${lk.thumb}")`; pic.style.backgroundSize = 'cover'; pic.style.cursor = 'pointer'; pic.title = 'Apply this look';
      pic.onclick = () => { applyLook(lk.data); toast(`Applied “${lk.name}”`); };
      const acts = el('div', 'acts');
      const up = el('button', null, '↻'); up.title = 'Update with current composition'; up.onclick = () => { lk.data = lookFromState(); lk.thumb = snapshotThumb(); saveSys(false); toast(`Updated “${lk.name}”`); };
      const rm = el('button', null, '×'); rm.title = 'Delete look'; rm.onclick = () => { if (confirm(`Delete the look “${lk.name}”?`)){ d.looks.splice(i, 1); saveSys(false); } };
      acts.append(up, rm);
      const cap = el('div', 'cap', lk.name); tile.append(pic, acts, cap); grid.append(tile);
    });
    pane.append(grid);
  }
  const sd = el('details', 'starters'); const ss = el('summary', null, `Starter looks (${STARTER_LOOKS.length})`); sd.append(ss);
  STARTER_LOOKS.forEach(lk => {
    const b = el('button', 'item'); b.title = lk.desc;
    const t = el('span'); t.append(el('b', null, lk.name), el('small', null, lk.desc));
    b.append(t, el('span', 'add', 'apply'));
    b.onclick = () => { applyLook(lk.data); toast(`Applied “${lk.name}”. Tweak it, then save it as your own look.`); };
    sd.append(b);
  });
  pane.append(sd);

  /* batch export */
  head('Export the system');
  const bt = el('button', null, sysOpen.batch ? 'Hide export options' : 'Export looks × sizes × colourways…');
  bt.onclick = () => { sysOpen.batch = !sysOpen.batch; renderSystem(); };
  pane.append(bt);
  if (sysOpen.batch) pane.append(batchPanel());
  pane.scrollTop = scroll;
}
let sysTimer;
function renderSystemSoon(){ clearTimeout(sysTimer); sysTimer = setTimeout(renderSystem, 400); }

const batchSel = { looks:new Set(), sizes:new Set(['ig-portrait', 'story']), cws:new Set(), format:'mp4' };
function batchPanel(){
  const d = SYS(), box = el('div', 'batch');
  const group = (title, items, set, labelOf) => {
    const g = el('div', 'bgroup'); g.append(el('div', 'bh', title));
    items.forEach(it => { const l = el('label', 'chk'); const c = el('input'); c.type = 'checkbox'; c.checked = set.has(it.key); c.onchange = () => { c.checked ? set.add(it.key) : set.delete(it.key); count(); }; l.append(c, labelOf(it)); g.append(l); });
    box.append(g);
  };
  const looks = [...d.looks.map(l => ({ key:l.id, look:l })), ...STARTER_LOOKS.map(l => ({ key:l.id, look:l }))];
  if (!batchSel.looks.size) (d.looks.length ? d.looks : STARTER_LOOKS.slice(0, 3)).forEach(l => batchSel.looks.add(l.id));
  group('Looks', looks, batchSel.looks, it => it.look.name + (it.key.startsWith('s-') ? ' (starter)' : ''));
  group('Sizes', SIZES.filter(s => s.w).map(s => ({ key:s.id, s })), batchSel.sizes, it => `${it.s.label} · ${it.s.w}×${it.s.h}`);
  if (d.colourways.length > 1){
    if (!batchSel.cws.size) batchSel.cws.add(d.active);
    group('Colourways', d.colourways.map((c, i) => ({ key:i, c })), batchSel.cws, it => it.c.name);
  }
  const fr = el('div', 'prm wide'); fr.append(el('label', null, 'Format'));
  const fs = el('select'); [['mp4', 'MP4 video'], ['png', 'PNG still']].forEach(([v, n]) => { const o = el('option', null, n); o.value = v; fs.append(o); }); fs.value = batchSel.format;
  fs.onchange = () => { batchSel.format = fs.value; count(); }; fr.append(fs); box.append(fr);
  const go = el('button', 'primary'); box.append(go);
  const note = el('p', 'anote', 'Looks keep their timing and source preparation; each file renders at full size. Photos in sources A and B are used as they are now.'); box.append(note);
  const jobs = () => {
    const L = looks.filter(x => batchSel.looks.has(x.key)).map(x => x.look), S = SIZES.filter(s => batchSel.sizes.has(s.id));
    const C = d.colourways.length > 1 ? [...batchSel.cws].filter(i => d.colourways[i]) : [null];
    const out = []; L.forEach(look => S.forEach(size => C.forEach(cw => out.push({ look, size, cw })))); return out;
  };
  function count(){ const n = jobs().length; go.textContent = n ? `Export ${n} file${n > 1 ? 's' : ''}` : 'Choose looks and sizes'; go.disabled = !n; }
  go.onclick = () => exportBatch(jobs(), batchSel.format);
  count();
  return box;
}

function initSystemUI(){
  $('#tabSystem').onclick = () => showTab('system');
  const prev = Assets.onChange;
  Assets.onChange = () => { prev && prev(); renderSystem(); };
  renderSystem();
}
