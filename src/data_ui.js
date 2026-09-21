/* ---------------- Data tab ----------------
   Load a table (sample, file, pasted text, or an address), see its columns,
   decide which row the playhead reads, and link any range control to a column.
   Everything is built with textContent, so nothing in a table can inject markup.
------------------------------------------------ */
const dataUI = { url:'', hname:'', hvalue:'', remember:false, busy:false, error:'', notice:'', paste:false, pasteText:'' };

function loadDataPrefs(){
  try {
    const o = JSON.parse(localStorage.getItem('fxlab-data-api') || 'null'); if (!o) return;
    dataUI.url = o.url || ''; dataUI.hname = o.hname || ''; dataUI.remember = !!o.remember; if (o.remember) dataUI.hvalue = o.hvalue || '';
  } catch { /* private mode */ }
}
function saveDataPrefs(){
  try { localStorage.setItem('fxlab-data-api', JSON.stringify({ url:dataUI.url, hname:dataUI.hname, remember:dataUI.remember, ...(dataUI.remember ? { hvalue:dataUI.hvalue } : {}) })); } catch { /* private mode */ }
}

const SVGNS = 'http://www.w3.org/2000/svg';
function sparkSvg(col, w = 84, h = 24){
  const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('class', 'spark'); svg.setAttribute('aria-hidden', 'true');
  if (!col || !col.v) return svg;
  const N = Math.min(72, Math.max(2, col.v.length)), pts = [];
  for (let i = 0; i < N; i++) pts.push(`${(i / (N - 1) * (w - 2) + 1).toFixed(1)},${(h - 2 - Data.norm(col, Data.at(col, i / (N - 1))) * (h - 4)).toFixed(1)}`);
  const path = document.createElementNS(SVGNS, 'polyline'); path.setAttribute('points', pts.join(' '));
  path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.4'); path.setAttribute('stroke-linejoin', 'round');
  svg.append(path); return svg;
}
const fmtNum = v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e4 ? Math.round(v).toString() : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(2);
const colRange = c => c.type === 'time' ? `${new Date(c.min).toISOString().slice(0, 10)} to ${new Date(c.max).toISOString().slice(0, 10)}` : c.type === 'category' ? `${c.cats.length} kinds` : `${fmtNum(c.min)} to ${fmtNum(c.max)}`;

/* every linked control in the project, with the layer it lives on */
function allInsts(){
  const out = [];
  if (state.base) out.push({ inst:state.base, where:'Combine' });
  ['A', 'B'].forEach(k => (state.sources[k].process || []).forEach(i => out.push({ inst:i, where:`Prepare ${k}` })));
  state.stack.forEach(i => out.push({ inst:i, where:'Finish' }));
  return out;
}
function refreshInspector(){ renderBase(); renderStack(); renderSlots(); updateBadges(); }

async function loadDataFile(file){
  try {
    const t = await Data.loadFile(file);
    dataUI.error = ''; dataUI.notice = `Loaded ${t.rows} rows from ${file.name}.`;
    toast(`Loaded ${t.rows} rows from ${file.name}.`); showWorkspace('data');
  } catch (e){ dataUI.error = e.message; toast(e.message, true, 7000); showWorkspace('data'); }
}
async function runFetch(url){
  url = String(url || '').trim(); if (!url) return;
  dataUI.url = url; dataUI.busy = true; dataUI.error = ''; dataUI.notice = ''; saveDataPrefs(); renderData();
  try {
    const headers = {}; if (dataUI.hname.trim() && dataUI.hvalue) headers[dataUI.hname.trim()] = dataUI.hvalue;
    const t = await Data.fetchUrl(url, headers);
    dataUI.notice = `Loaded ${t.rows} rows and ${t.cols.length} columns.` + (Data.hasSecretInUrl(url) ? ' The key in the address is left out when you save the project.' : '');
  } catch (e){ dataUI.error = e.message; }
  dataUI.busy = false; renderData();
}

function renderData(){
  const box = $('#dataBody'); if (!box) return;
  const scroll = box.scrollTop; box.innerHTML = '';
  const t = Data.table, cur = Data.current();

  /* the table */
  if (!t){
    const c = el('div', 'empty-cta'); c.append(el('b', null, 'No data of your own yet'), `Data visuals and links use a built-in sample (${cur.name}) until you load something. Pick one below, or drop a CSV or JSON file on the stage.`);
    box.append(c);
  } else {
    const card = el('div', 'dtable'); const dh = el('div', 'dh');
    const nm = el('div'); nm.append(el('b', null, t.name), el('br'), el('span', null, `${t.rows} rows · ${t.cols.length} columns${t.sampled ? ` · every ${Math.ceil(t.sampled / t.rows)}th of ${t.sampled} rows` : ''}`));
    const clr = el('button', 'ghost', 'Clear'); clr.title = 'Go back to the built-in sample'; clr.onclick = () => { Data.clear(); dataUI.notice = ''; dataUI.error = ''; };
    dh.append(nm, clr); card.append(dh);
    t.cols.forEach(c => {
      const r = el('div', 'dcol'); const n = el('div', 'nm', c.name);
      n.append(el('small', null, c.v ? colRange(c) : 'labels, not used'));
      if (c.axis) n.append(el('span', 'tag axis', 'axis')); else if (c.type === 'category') n.append(el('span', 'tag', 'kinds'));
      r.append(n, sparkSvg(c)); card.append(r);
    });
    box.append(card);
    const cands = Data.candidates();
    if (cands.length > 1){
      const row = el('div', 'prm wide'); row.append(el('label', null, 'Table in file'));
      const sel = el('select'); cands.forEach((c, i) => { const o = el('option', null, c); o.value = i; sel.append(o); }); sel.value = Data.pending.sel; sel.onchange = () => Data.pickCandidate(+sel.value);
      row.append(sel); card.after(row);
    }
    if (t.credit) box.append(el('p', 'credit', t.credit));
    else if (t.origin && t.origin.kind === 'api'){ const src = Data.sources.find(s => Data.safeUrl(s.url) === t.origin.url); if (src) box.append(el('p', 'credit', `${src.name}. ${src.credit}.`)); }
  }
  if (dataUI.notice) box.append(el('div', 'okbox', dataUI.notice));
  if (dataUI.error) { const e = el('div', 'errbox', dataUI.error); e.setAttribute('role', 'alert'); box.append(e); }

  /* load */
  const load = el('div', 'block dsrc'); load.append(el('h3', null, 'Load data'));
  load.append(el('div', 'hint2', 'Samples work offline.'));
  const list = el('div', 'dlist');
  Data.samples.forEach(s => list.append(libRow({ id:'sample-' + s.id, name:s.name, desc:s.blurb, action:t && t.origin && t.origin.id === s.id ? 'loaded' : 'use', active:!!(t && t.origin && t.origin.id === s.id), onClick:() => { dataUI.error = ''; dataUI.notice = ''; Data.loadSample(s.id); } })));
  load.append(list);
  const own = el('div', 'row');
  const pick = el('button', null, 'Choose a file…'); pick.title = 'CSV, TSV, JSON, GeoJSON or newline-delimited JSON'; pick.onclick = () => $('#fileData').click();
  const pasteBtn = el('button', 'ghost', dataUI.paste ? 'Hide paste box' : 'Paste text'); pasteBtn.onclick = () => { dataUI.paste = !dataUI.paste; renderData(); };
  own.append(pick, pasteBtn); load.append(own);
  if (dataUI.paste){
    const ta = el('textarea'); ta.rows = 6; ta.placeholder = 'Paste a table with a header row, or JSON'; ta.value = dataUI.pasteText; ta.setAttribute('aria-label', 'Pasted data');
    ta.oninput = () => { dataUI.pasteText = ta.value; };
    const use = el('button', 'primary', 'Use this text'); use.onclick = () => { try { Data.loadText(dataUI.pasteText, 'Pasted table', { kind:'paste' }); dataUI.error = ''; dataUI.notice = `Loaded ${Data.table.rows} rows.`; } catch (e){ dataUI.error = e.message; } renderData(); };
    load.append(ta, use);
  }
  box.append(load);

  /* the web */
  const web = el('div', 'block dsrc'); web.append(el('h3', null, 'From the web'));
  web.append(el('div', 'hint2', 'Any address that returns CSV or JSON and allows web pages to read it. An Are.na channel link works too: every block becomes a row. These public sources need no key:'));
  const wl = el('div', 'dlist');
  Data.sources.forEach(s => wl.append(libRow({ id:'source-' + s.id, name:s.name, desc:`${s.blurb} ${s.credit}.`, action:'fetch', onClick:() => runFetch(s.url) })));
  web.append(wl);
  const urlRow = el('div', 'row'); const url = el('input'); url.type = 'text'; url.placeholder = 'https://…'; url.value = dataUI.url; url.setAttribute('aria-label', 'Data address');
  url.oninput = () => { dataUI.url = url.value; }; url.onkeydown = e => { if (e.key === 'Enter') runFetch(url.value); };
  const go = el('button', 'primary', dataUI.busy ? 'Fetching…' : 'Fetch'); go.disabled = dataUI.busy; go.onclick = () => runFetch(url.value);
  urlRow.append(url, go); web.append(urlRow);
  const key = el('details', 'more'); key.append(el('summary', null, 'Needs an API key?'));
  key.append(el('p', 'hint2', 'Send it as a header. The value stays in this tab and is never saved in a project. Some servers refuse custom headers from web pages.'));
  const hn = el('div', 'prm wide'); hn.append(el('label', null, 'Header')); const hni = el('input'); hni.type = 'text'; hni.placeholder = 'e.g. x-api-key'; hni.value = dataUI.hname; hni.setAttribute('aria-label', 'Header name'); hni.oninput = () => { dataUI.hname = hni.value; saveDataPrefs(); }; hn.append(hni);
  const hv = el('div', 'prm wide'); hv.append(el('label', null, 'Value')); const hvi = el('input'); hvi.type = 'password'; hvi.autocomplete = 'off'; hvi.value = dataUI.hvalue; hvi.setAttribute('aria-label', 'Header value'); hvi.oninput = () => { dataUI.hvalue = hvi.value; saveDataPrefs(); }; hv.append(hvi);
  const rem = el('label', 'chk'); const ri = el('input'); ri.type = 'checkbox'; ri.checked = dataUI.remember; ri.onchange = () => { dataUI.remember = ri.checked; saveDataPrefs(); }; rem.append(ri, 'Remember the value on this computer');
  key.append(hn, hv, rem); web.append(key);
  box.append(web);

  /* playhead */
  const play = el('div', 'block'); play.append(el('h3', null, 'Playhead'));
  play.append(el('p', 'hint2', 'Which row the linked controls and Data visuals read as the timeline plays.'));
  const modes = [['pingpong', 'Forward and back (loops cleanly)'], ['loop', 'Forward, then jump back'], ['timeline', 'Follows the transition'], ['still', 'A fixed row']];
  const mr = el('div', 'prm wide'); mr.append(el('label', null, 'Reads'));
  const ms = el('select'); modes.forEach(([v, n]) => { const o = el('option', null, n); o.value = v; ms.append(o); }); ms.value = Data.play.mode; ms.setAttribute('aria-label', 'Playhead mode');
  ms.onchange = () => { Data.play.mode = ms.value; markDirty(); renderData(); }; mr.append(ms); play.append(mr);
  if (Data.play.mode === 'still'){
    const rr = el('div', 'prm'); rr.append(el('label', null, 'Row')); const r = el('input'); Object.assign(r, { type:'range', min:0, max:1, step:.001, value:Data.play.row }); r.setAttribute('aria-label', 'Row');
    const nv = el('input', 'val'); nv.type = 'text'; nv.value = String(Math.round(Data.play.row * (cur.rows - 1)) + 1); nv.readOnly = true;
    r.oninput = () => { Data.play.row = +r.value; nv.value = String(Math.round(Data.play.row * (cur.rows - 1)) + 1); markDirty(); };
    rr.append(r, nv); play.append(rr);
  }
  const tr = el('label', 'chk'); const ti = el('input'); ti.type = 'checkbox'; ti.checked = Data.trim; ti.onchange = () => { Data.trim = ti.checked; markDirty(); }; tr.append(ti, 'Ignore the extreme 2% at each end'); play.append(tr);
  box.append(play);

  /* data visuals */
  const vis = el('div', 'block dsrc'); vis.append(el('h3', null, 'Draw it')); vis.append(el('div', 'hint2', 'Adds a layer to Finish. Each reads the table above.'));
  const vl = el('div', 'dlist');
  FX.modules.filter(m => m.cat === 'data').forEach(m => vl.append(libRow({ id:'add-' + m.id, name:m.name, desc:m.desc, action:'add', onClick:() => {
    History.record('module', () => { const i = makeInst(m.id); openNewInst(i.uid); state.stack.push(i); renderStack(); markDirty(); });
    showWorkspace('finish'); toast(`Added ${m.name} to Finish.`);
  } })));
  vis.append(vl); box.append(vis);

  /* linked controls */
  const links = []; allInsts().forEach(({ inst, where }) => { const m = FX.byId[inst.id]; Object.keys(inst.bind || {}).forEach(pid => { const p = m.params.find(q => q.id === pid); if (p) links.push({ inst, m, p, where, b:inst.bind[pid] }); }); });
  const lk = el('div', 'block'); lk.append(el('h3', null, `Linked controls${links.length ? ` (${links.length})` : ''}`));
  if (!links.length) lk.append(el('p', 'hint2', 'None yet. Hover any slider in Prepare, Combine or Finish and press its link button to drive it from a column.'));
  links.forEach(({ inst, m, p, where, b }) => {
    const r = el('div', 'dcol'); const n = el('div', 'nm', `${m.name} · ${p.label}`); n.append(el('small', null, `${where} ← ${b.col}${b.invert ? ' (inverted)' : ''}`));
    const un = el('button', 'ghost', 'Unlink'); un.onclick = () => { History.record('link', () => { delete inst.bind[p.id]; if (!Object.keys(inst.bind).length) delete inst.bind; }); refreshInspector(); markDirty(); renderData(); };
    r.append(n, un); lk.append(r);
  });
  box.append(lk);
  box.scrollTop = scroll;
}

/* ---------- linking a control to a column ---------- */
function syncBoundRow(row, inst, p){
  const b = inst.bind && inst.bind[p.id];
  const r = row.querySelector('input[type=range]'), num = row.querySelector('input.val'), lk = row.querySelector('.lk');
  row.classList.toggle('bound', !!b);
  if (r){ r.disabled = !!b; r.value = inst.params[p.id]; }
  if (num){ num.readOnly = !!b; num.value = b ? 'data' : fmt(inst.params[p.id], p.step); }
  if (lk){ lk.title = b ? `Linked to ${b.col}. Change or unlink.` : 'Link to a data column'; lk.setAttribute('aria-label', b ? `${p.label} is linked to ${b.col}. Edit the link.` : `Link ${p.label} to a data column`); }
  updateBadges(); markDirty();
}
function toggleBindPopover(row, inst, p){
  const open = row.querySelector('.bindpop'); if (open){ open.remove(); return; }
  const t = Data.current(), cols = t.cols.filter(c => c.v && c.type !== 'category');
  if (!cols.length) return;
  const cur = inst.bind && inst.bind[p.id];
  const st = { col:cur ? cur.col : (Data.pick('', 0, 'number', t) || cols[0]).name, lo:cur && cur.lo != null ? cur.lo : p.min, hi:cur && cur.hi != null ? cur.hi : p.max, invert:!!(cur && cur.invert) };
  const pop = el('div', 'bindpop'); pop.setAttribute('role', 'group'); pop.setAttribute('aria-label', `Link ${p.label} to data`);
  pop.append(el('div', 'hint2', `The control follows the column as the playhead moves${Data.isDefault() ? ' (a built-in sample until you load data)' : ''}.`));
  const cr = el('div', 'row'); cr.append(el('label', null, 'Column'));
  const sel = el('select'); sel.setAttribute('aria-label', 'Column'); cols.forEach(c => { const o = el('option', null, c.name + (c.axis ? ' (axis)' : '')); o.value = c.name; sel.append(o); }); sel.value = st.col; cr.append(sel); pop.append(cr);
  const spark = el('div'); const info = el('div', 'hint2'); pop.append(spark, info);
  const rr = el('div', 'row'); rr.append(el('label', null, 'Output'));
  const two = el('div', 'two'); const lo = el('input'), hi = el('input');
  [[lo, st.lo, 'From'], [hi, st.hi, 'To']].forEach(([i, v, l]) => { i.type = 'number'; i.step = p.step; i.value = fmt(v, p.step); i.setAttribute('aria-label', `${l} value`); i.style.width = '100%'; two.append(i); });
  rr.append(two); pop.append(rr);
  const shr = el('div', 'row'); shr.append(el('label', null, 'Smoothing'));
  const sm = el('input'); Object.assign(sm, { type:'range', min:0, max:1, step:.05, value:cur && cur.smooth || 0 }); sm.setAttribute('aria-label', 'Smoothing'); shr.append(sm); pop.append(shr);
  const cvr = el('div', 'row'); cvr.append(el('label', null, 'Response'));
  const cv = el('select'); cv.setAttribute('aria-label', 'Response curve'); ['Linear', 'Eases in', 'Eases out', 'Stepped'].forEach((n, i) => { const o = el('option', null, n); o.value = i; cv.append(o); }); cv.value = cur && cur.curve || 0; cvr.append(cv); pop.append(cvr);
  const ir = el('label', 'chk'); const ii = el('input'); ii.type = 'checkbox'; ii.checked = st.invert; ir.append(ii, 'Flip it (high values give low output)'); pop.append(ir);
  const acts = el('div', 'acts'); const un = el('button', 'ghost', 'Unlink'); un.disabled = !cur; const done = el('button', null, 'Done'); acts.append(un, done); pop.append(acts);
  const paint = () => { const c = t.byName[sel.value]; spark.replaceChildren(sparkSvg(c, 260, 36)); info.textContent = c ? `${colRange(c)} · ${c.gaps ? c.gaps + ' gaps filled' : 'no gaps'}` : ''; };
  const apply = () => {
    const l = parseFloat(lo.value), h = parseFloat(hi.value);
    History.record('link', () => {
      inst.bind = inst.bind || {};
      inst.bind[p.id] = { col:sel.value, ...(isFinite(l) && l !== p.min ? { lo:l } : {}), ...(isFinite(h) && h !== p.max ? { hi:h } : {}), ...(ii.checked ? { invert:true } : {}), ...(+sm.value > 0 ? { smooth:+sm.value } : {}), ...(+cv.value ? { curve:+cv.value } : {}) };
    });
    un.disabled = false; syncBoundRow(row, inst, p); paint();
  };
  sm.onchange = apply; cv.onchange = apply; sel.onchange = apply; lo.onchange = apply; hi.onchange = apply; ii.onchange = apply;
  un.onclick = () => { History.record('link', () => { if (inst.bind){ delete inst.bind[p.id]; if (!Object.keys(inst.bind).length) delete inst.bind; } }); syncBoundRow(row, inst, p); pop.remove(); };
  done.onclick = () => pop.remove();
  paint();
  if (!cur){ /* the first look at a link is a live one, so the slider visibly comes alive */ apply(); }
  row.append(pop);
}

function initDataUI(){
  loadDataPrefs();
  $('#fileData').onchange = e => { const f = e.target.files[0]; if (f) loadDataFile(f); e.target.value = ''; };
  Data.onChange = () => { if (App.ws === 'data') renderData(); refreshInspector(); markDirty(); };
  renderData();
}
