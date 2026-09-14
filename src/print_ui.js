/* ---------------- Print UI ---------------- */
function applyPrintDoc(pr){
  state.print = pr;
  const d = Print.docPx(pr);
  state.W = d.W; state.H = d.H; state.sizeId = pr.preset;
  App.syncTop(); applySize(); Print.syncPreview();
}
function setPrintPreset(id, landscape){
  const p = PRINT_SIZES.find(s => s.id === id); if (!p) return;
  const pr = Object.assign(Print.defaults(), state.print || {}, { preset:id });
  const land = landscape ?? (state.print ? state.print.wMM > state.print.hMM : false);
  pr.wMM = land ? Math.max(p.w, p.h) : Math.min(p.w, p.h); pr.hMM = land ? Math.min(p.w, p.h) : Math.max(p.w, p.h);
  if (/card/.test(id)){ pr.bleed = 2; pr.safe = 4; if (!state.print) { pr.wMM = Math.max(p.w, p.h); pr.hMM = Math.min(p.w, p.h); } }
  applyPrintDoc(pr);
}
function printGuides(box){
  const pr = state.print; if (!pr || !pr.guides) return;
  const tw = pr.wMM + pr.bleed * 2, th = pr.hMM + pr.bleed * 2;
  const bx = pr.bleed / tw * 100, by = pr.bleed / th * 100, sx = (pr.bleed + pr.safe) / tw * 100, sy = (pr.bleed + pr.safe) / th * 100;
  const trim = el('div', 'trim'); trim.style.cssText = `left:${bx}%;right:${bx}%;top:${by}%;bottom:${by}%`;
  const safe = el('div', 'psafe'); safe.style.cssText = `left:${sx}%;right:${sx}%;top:${sy}%;bottom:${sy}%`;
  box.append(trim, safe);
}

function openPrintDialog(){
  if (!state.print) setPrintPreset('p-a4', false);
  let dlg = $('#printDlg');
  if (!dlg){ dlg = el('div'); dlg.id = 'printDlg'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-label', 'Print'); document.body.append(dlg);
    dlg.addEventListener('click', e => { if (e.target === dlg) closePrintDialog(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && dlg.classList.contains('on')) closePrintDialog(); }); }
  dlg.classList.add('on');
  renderPrintDialog();
}
function closePrintDialog(){ const d = $('#printDlg'); if (d) d.classList.remove('on'); }

function renderPrintDialog(){
  const dlg = $('#printDlg'), pr = state.print; if (!dlg || !pr) return;
  dlg.innerHTML = '';
  const card = el('div', 'pcard'); dlg.append(card);
  const head = el('div', 'phead'); head.append(el('h2', null, 'Print'), Object.assign(el('button', 'ghost icon', '×'), { title:'Close', onclick:closePrintDialog })); card.append(head);
  const cols = el('div', 'pcols'); card.append(cols);
  const colA = el('div', 'pcol'), colB = el('div', 'pcol'); cols.append(colA, colB);
  const row = (parent, label, ...ctrls) => { const r = el('div', 'prm wide'); r.append(el('label', null, label)); const w = el('div', 'pinline'); ctrls.forEach(c => w.append(c)); r.append(w); parent.append(r); return r; };
  const num = (v, step, onch, unit) => { const i = el('input'); i.type = 'number'; i.step = step; i.value = +(+v).toFixed(2); i.onchange = () => onch(+i.value); const w = el('span', 'unit'); w.append(i, el('small', null, unit)); return w; };
  const update = (patch, rebuild = true) => { Object.assign(pr, patch); if (rebuild) applyPrintDoc(pr); else { Print.syncPreview(); layoutSafe(); } renderPrintDialog(); };

  /* document */
  colA.append(el('div', 'ahead', 'Document'));
  const ps = el('select'); PRINT_SIZES.forEach(p => { const o = el('option', null, `${p.label}`); o.value = p.id; ps.append(o); });
  const cust = el('option', null, 'Custom'); cust.value = 'p-custom'; ps.append(cust);
  ps.value = PRINT_SIZES.some(p => p.id === pr.preset) ? pr.preset : 'p-custom';
  ps.onchange = () => { if (ps.value !== 'p-custom') setPrintPreset(ps.value); renderPrintDialog(); };
  row(colA, 'Size', ps);
  const orient = el('select'); [['p', 'Portrait'], ['l', 'Landscape']].forEach(([v, n]) => { const o = el('option', null, n); o.value = v; orient.append(o); });
  orient.value = pr.wMM > pr.hMM ? 'l' : 'p';
  orient.onchange = () => { const land = orient.value === 'l'; if ((pr.wMM > pr.hMM) !== land) update({ wMM:pr.hMM, hMM:pr.wMM }); };
  row(colA, 'Orientation', orient);
  row(colA, 'Trim size', num(pr.wMM, 1, v => update({ wMM:Util.clamp(v, 20, 2000), preset:'p-custom' }), 'mm'), el('span', 'dim', '×'), num(pr.hMM, 1, v => update({ hMM:Util.clamp(v, 20, 2000), preset:'p-custom' }), 'mm'));
  row(colA, 'Bleed', num(pr.bleed, .5, v => update({ bleed:Util.clamp(v, 0, 20) }), 'mm'));
  row(colA, 'Safe margin', num(pr.safe, .5, v => update({ safe:Util.clamp(v, 0, 50) }, false), 'mm'));
  const gl = el('label', 'chk'); const gi = el('input'); gi.type = 'checkbox'; gi.checked = pr.guides; gi.onchange = () => update({ guides:gi.checked }, false); gl.append(gi, 'Show trim, bleed and safe area on the stage');
  colA.append(gl);
  const d = Print.docPx(pr);
  colA.append(el('p', 'anote', `The stage is the full sheet including bleed: ${(pr.wMM + 2 * pr.bleed).toFixed(1)} × ${(pr.hMM + 2 * pr.bleed).toFixed(1)} mm, designed at ${state.W}×${state.H} px (${Math.round(d.ppi)} ppi). Effects keep their proportions at any print resolution.`));

  /* inks */
  colA.append(el('div', 'ahead', 'Inks'));
  colA.append(el('p', 'anote', 'For riso or screen printing: pick up to four inks and a paper colour. Separations export one plate per ink; preview shows the result on the stage.'));
  const pool = [];
  const pushInk = (hex, name) => { if (!pool.some(p => p.hex === hex)) pool.push({ hex, name }); };
  Assets.palette.forEach(c => pushInk(c.hex, c.name));
  (Assets.identity ? Assets.identity.colourways : []).forEach(cw => pushInk(cw.accent, `${cw.name} accent`));
  pushInk('#ff48b0', 'Fluorescent pink'); pushInk('#0078bf', 'Blue'); pushInk('#ffe800', 'Yellow'); pushInk('#00a95c', 'Green'); pushInk('#1a1a1a', 'Black');
  pr.inks.forEach(hx => pushInk(hx, hx.toUpperCase()));
  const chips = el('div', 'inkchips');
  pool.forEach(p => {
    const on = pr.inks.includes(p.hex), b = el('button', 'inkchip' + (on ? ' on' : ''));
    const sw = el('i'); sw.style.background = p.hex; b.append(sw, p.name); b.title = p.hex.toUpperCase();
    if (on) b.append(el('b', null, String(pr.inks.indexOf(p.hex) + 1)));
    b.onclick = () => { const inks = pr.inks.filter(x => x !== p.hex); if (!on){ if (inks.length >= 4){ toast('Four inks at most.'); return; } inks.push(p.hex); } update({ inks }, false); };
    chips.append(b);
  });
  colA.append(chips);
  const addInk = el('input'); addInk.type = 'color'; addInk.value = '#ff6c2f'; addInk.title = 'Add a custom ink';
  addInk.onchange = () => { if (pr.inks.length >= 4){ toast('Four inks at most.'); return; } if (!pr.inks.includes(addInk.value)) update({ inks:[...pr.inks, addInk.value] }, false); };
  const paper = el('input'); paper.type = 'color'; paper.value = pr.paper; paper.onchange = () => update({ paper:paper.value }, false);
  row(colA, 'Custom ink', addInk);
  row(colA, 'Paper', paper);
  const pv = el('label', 'chk'); const pvi = el('input'); pvi.type = 'checkbox'; pvi.checked = pr.inkPreview; pvi.onchange = () => update({ inkPreview:pvi.checked }, false); pv.append(pvi, 'Preview inks on the stage');
  colA.append(pv);
  if (pr.inkPreview){ const mr = el('input'); Object.assign(mr, { type:'range', min:0, max:12, step:.5, value:pr.misreg }); mr.oninput = () => { pr.misreg = +mr.value; Print.syncPreview(); }; row(colA, 'Misregistration', mr); }

  /* output */
  colB.append(el('div', 'ahead', 'Export'));
  const fmt = el('select'); [['pdf-marks', 'PDF with crop marks'], ['pdf', 'PDF, bleed only'], ['png', 'PNG'], ['seps', 'Ink separations (PNG plates)']].forEach(([v, n]) => { const o = el('option', null, n); o.value = v; fmt.append(o); });
  fmt.value = pr.format; fmt.onchange = () => update({ format:fmt.value }, false);
  row(colB, 'Format', fmt);
  const dpi = el('select'); [150, 200, 300, 400, 600].forEach(v => { const o = el('option', null, `${v} dpi`); o.value = v; dpi.append(o); }); dpi.value = pr.dpi;
  dpi.onchange = () => update({ dpi:+dpi.value }, false);
  row(colB, 'Resolution', dpi);
  const fr = el('select'); [['playhead', 'Current playhead'], ['end', 'End of transition']].forEach(([v, n]) => { const o = el('option', null, n); o.value = v; fr.append(o); }); fr.value = pr.frame;
  fr.onchange = () => update({ frame:fr.value }, false);
  row(colB, 'Frame', fr);
  const out = Print.outPx(pr), mp = out.w * out.h / 1e6;
  const nonLocal = [state.base, ...state.stack].filter(i => i && i.on !== false && FX.byId[i.id] && FX.byId[i.id].nonLocal).map(i => FX.byId[i.id].name);
  const facts = el('div', 'pfacts');
  const fact = (k, v) => { const r = el('div'); r.append(el('span', null, k), el('b', null, v)); facts.append(r); };
  fact('Output', `${out.w.toLocaleString()} × ${out.h.toLocaleString()} px`);
  fact('Megapixels', mp.toFixed(1));
  fact('Sheet with bleed', `${(pr.wMM + 2 * pr.bleed).toFixed(1)} × ${(pr.hMM + 2 * pr.bleed).toFixed(1)} mm`);
  if (pr.format === 'seps') fact('Plates', pr.inks.length ? `${pr.inks.length} + composite` : 'choose inks');
  colB.append(facts);
  if (nonLocal.length){
    const gl2 = Engine.gl, maxTex = Math.min(gl2.getParameter(gl2.MAX_TEXTURE_SIZE), 8192), s = Math.min(1, maxTex / Math.max(out.w, out.h), Math.sqrt(40e6 / (out.w * out.h)));
    if (s < 1) colB.append(el('p', 'anote warn', `${nonLocal.join(', ')} look${nonLocal.length > 1 ? '' : 's'} across the whole frame, so this stack renders in one pass at up to ${Math.round(out.w * s)}×${Math.round(out.h * s)} px (${Math.round(pr.dpi * s)} dpi).`));
  }
  if (pr.format === 'seps' && pr.inks.length && !pr.inkPreview) colB.append(el('p', 'anote', 'Tip: turn on ink preview to see how the plates combine before exporting.'));
  colB.append(el('p', 'anote', mp > 60 ? 'Large file: this can take a few minutes. Keep the tab open.' : 'Photos in sources A and B print at their own resolution; use high-resolution images for large formats.'));
  const go = el('button', 'primary pgo', pr.format === 'seps' ? 'Export separations' : `Export ${pr.format === 'png' ? 'PNG' : 'PDF'}`);
  go.onclick = async () => { closePrintDialog(); await Print.export(); };
  colB.append(go);
}
