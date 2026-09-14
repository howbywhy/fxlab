/* ---------------- Assets tab ---------------- */
function showTab(which){
  const tabs = { lib:['#tabLib', '#paneLib'], assets:['#tabAssets', '#paneAssets'], system:['#tabSystem', '#paneSystem'] };
  Object.entries(tabs).forEach(([k, [t, p]]) => { const on = k === which; $(t).classList.toggle('on', on); $(t).setAttribute('aria-selected', String(on)); $(p).classList.toggle('on', on); });
}

async function importAssets(files){
  if (!files || !files.length) return;
  showTab('assets');
  toast(`Reading ${files.length === 1 ? files[0].name : files.length + ' files'}…`, false, 60000);
  const sum = await Assets.addFiles(files);
  const bits = [];
  if (sum.fonts) bits.push(`${sum.fonts} font${sum.fonts > 1 ? 's' : ''}`);
  if (sum.images) bits.push(`${sum.images} logo${sum.images > 1 ? 's' : ''}`);
  if (sum.colors) bits.push(`${sum.colors} colour${sum.colors > 1 ? 's' : ''}`);
  if (sum.looks) bits.push(`${sum.looks} look${sum.looks > 1 ? 's' : ''}`);
  let msg = bits.length ? `Added ${bits.join(', ')}.` : 'Nothing new added.';
  if (sum.duplicates) msg += ` ${sum.duplicates} already here.`;
  if (sum.skipped.length){
    const kinds = [...new Set(sum.skipped.map(n => '.' + n.split('.').pop().toLowerCase()))].slice(0, 4).join(', ');
    msg += ` Skipped ${sum.skipped.length} file${sum.skipped.length > 1 ? 's' : ''} fxlab can’t use (${kinds}).`;
  }
  if (sum.failed.length) msg += `\nCouldn’t read: ${sum.failed.slice(0, 3).join(', ')}${sum.failed.length > 3 ? '…' : ''}`;
  if (sum.system) msg += ' Brand roles and colourways are set up in the System tab.';
  toast(msg, !!sum.failed.length && !bits.length, 7000);
}

function useAssetAsSource(k, id){
  const a = Assets.get(id), c = Assets.image(id); if (!c) return;
  History.record('source', () => {
    Engine.setMedia(k, c, c.width, c.height, false);
    App.mediaInfo[k] = { name:a.name, thumb:a.thumb, logo:true };
    state.sources[k].asset = a.id;
    if (!state.sources[k].fit) state.sources[k].fit = 1;
    renderSlots(); markDirty();
  });
}

function addLogoModule(id){
  History.record('module', () => {
    const inst = makeInst('lg-logo'); inst.params.logo = 'asset:' + id; openNewInst(inst.uid);
    state.stack.push(inst); renderStack(); markDirty();
  });
  toast(`Added a Logo layer to Finish`);
}

function renderAssets(){
  const pane = $('#paneAssets'); const scroll = pane.scrollTop; pane.innerHTML = '';
  const n = Assets.list.length + Assets.palette.length;
  $('#assetCount').textContent = n ? String(Assets.list.length) : '';

  const drop = el('button', 'adrop'); drop.innerHTML = '<b>Add fonts, logos or a zip</b>Drop files here or click to browse. OTF, TTF, WOFF, SVG, PNG, JPG, .zip, .fxkit';
  drop.onclick = () => $('#fileAssets').click();
  pane.append(drop);
  pane.append(el('p', 'anote' + (Assets.persistent ? '' : ' warn'), Assets.persistent
    ? 'Kept in this browser on this computer, not inside fxlab.html. Save a kit to move them.'
    : 'This browser won’t keep assets for a local file, so they’ll clear when you close the tab. Save a kit to keep them.'));

  /* fonts */
  const fonts = Assets.fonts();
  if (fonts.length){
    const hd = el('div', 'ahead'); hd.append('Fonts', el('span', null, String(fonts.length))); pane.append(hd);
    const def = Assets.pickFont();
    fonts.forEach(f => {
      const row = el('div', 'afont');
      const aa = el('div', 'aa', 'Aa'); aa.style.fontFamily = `"${f.family}"`;
      const nm = el('div', 'nm', f.name); nm.style.fontFamily = `"${f.family}", var(--sans)`; nm.title = f.file;
      const ax = Glyphs.axes({ font:'asset:' + f.id }); if (ax.wght || ax.wdth){ const badge = el('span', 'vbadge', 'VAR'); badge.title = `Variable font: ${[ax.wght && 'weight', ax.wdth && 'width'].filter(Boolean).join(' & ')}`; nm.append(' ', badge); }
      const star = el('button', 'ghost icon star' + (def && def.id === f.id ? ' on' : ''), def && def.id === f.id ? '★' : '☆');
      star.title = 'Default font for new type modules'; star.setAttribute('aria-label', `Make ${f.name} the default font`);
      star.onclick = () => Assets.setDefaultFont(f.id);
      const rm = el('button', 'ghost icon', '×'); rm.title = `Remove ${f.name}`; rm.onclick = () => Assets.remove(f.id);
      row.append(aa, nm, star, rm); pane.append(row);
    });
  }

  /* images */
  const imgs = Assets.images();
  if (imgs.length){
    const hd = el('div', 'ahead'); hd.append('Logos & images', el('span', null, String(imgs.length))); pane.append(hd);
    const grid = el('div', 'agrid');
    /* drop a word every logo shares (usually the brand name) so captions stay readable */
    const first = imgs.map(i => i.name.split(' ')[0]); const common = imgs.length > 1 && first.every(f => f === first[0]) ? first[0] + ' ' : '';
    imgs.forEach(a => {
      const tile = el('div', 'aimg');
      const pic = el('div', 'pic checker'); pic.style.backgroundImage = `url("${a.thumb}")`; pic.title = `${a.name}\n${a.group ? a.group + ' / ' : ''}${a.file}`;
      const acts = el('div', 'acts');
      const mk = (t, title, fn) => { const b = el('button', null, t); b.title = title; b.onclick = fn; return b; };
      acts.append(mk('A', 'Use as source A', () => useAssetAsSource('A', a.id)), mk('B', 'Use as source B', () => useAssetAsSource('B', a.id)), mk('+', 'Add as a Logo layer', () => addLogoModule(a.id)), mk('×', 'Remove', () => Assets.remove(a.id)));
      tile.append(pic, acts, el('div', 'cap', common && a.name.startsWith(common) ? a.name.slice(common.length) : a.name)); grid.append(tile);
    });
    pane.append(grid);
  }

  /* palette */
  const hd = el('div', 'ahead'); hd.append('Palette', el('span', null, Assets.palette.length ? String(Assets.palette.length) : '')); pane.append(hd);
  if (!Assets.palette.length) pane.append(el('p', 'anote', 'Colours from single-colour SVG logos land here automatically. They show up as swatches under every colour control.'));
  Assets.palette.forEach(c => {
    const row = el('div', 'apal');
    const sw = el('i'); sw.style.background = c.hex; sw.title = 'Copy hex';
    sw.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(c.hex.toUpperCase()).then(() => toast(`Copied ${c.hex.toUpperCase()}`), () => {}); };
    const nm = el('input'); nm.type = 'text'; nm.value = c.name; nm.setAttribute('aria-label', 'Colour name');
    nm.onchange = () => Assets.renameColor(c.hex, nm.value.trim() || c.hex.toUpperCase());
    const right = el('div'); right.style.cssText = 'display:flex;align-items:center;gap:2px';
    const rm = el('button', 'ghost icon', '×'); rm.title = `Remove ${c.name}`; rm.onclick = () => Assets.removeColor(c.hex);
    right.append(el('code', null, c.hex.toUpperCase()), rm);
    row.append(sw, nm, right); pane.append(row);
  });
  const add = el('div', 'aadd');
  const ci = el('input'); ci.type = 'color'; ci.value = '#ff5a36';
  const cn = el('input'); cn.type = 'text'; cn.placeholder = 'Colour name';
  const cb = el('button', null, 'Add'); cb.onclick = async () => { if (!(await Assets.addColor(ci.value, cn.value.trim()))) toast('That colour is already in the palette.'); };
  add.append(ci, cn, cb); pane.append(add);

  /* kit */
  const kit = el('div', 'akit');
  const kn = el('input'); kn.type = 'text'; kn.value = Assets.kitName; kn.setAttribute('aria-label', 'Kit name'); kn.onchange = () => Assets.setKitName(kn.value.trim());
  const r1 = el('div', 'row');
  const save = el('button', null, 'Save kit'); save.title = 'Download fonts, logos and palette as one .fxkit file';
  save.onclick = async () => {
    if (!Assets.list.length && !Assets.palette.length){ toast('Add some assets first.'); return; }
    const blob = await Assets.exportKit();
    download(blob, `${(Assets.kitName || 'brand-kit').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand-kit'}.fxkit`);
  };
  const open = el('button', null, 'Open kit'); open.onclick = () => $('#fileAssets').click();
  r1.append(save, open);
  const clear = el('button', 'ghost', 'Clear all assets');
  clear.onclick = async () => { if (confirm('Remove every font, logo and colour from this browser? Save a kit first if you want to keep them.')) await Assets.clear(); };
  kit.append(kn, r1, clear);
  if (Assets.list.length || Assets.palette.length) pane.append(kit);
  else { const r = el('div', 'akit'); const ob = el('button', null, 'Open a kit…'); ob.onclick = () => $('#fileAssets').click(); r.append(ob); pane.append(r); }
  pane.scrollTop = scroll;
}

function initAssetsUI(){
  $('#tabLib').onclick = () => showTab('lib');
  $('#tabAssets').onclick = () => showTab('assets');
  $('#fileAssets').onchange = e => { importAssets([...e.target.files]); e.target.value = ''; };
  let first = true;
  Assets.onChange = () => {
    renderAssets();
    /* refresh controls so font/logo pickers and swatches are current; restore asset sources after reload */
    const active = document.activeElement;
    if (!(active && active.closest && active.closest('#insp'))){ renderBase(); renderStack(); }
    if (first){ first = false; for (const k of ['A', 'B']) if (state.sources[k].asset && Assets.get(state.sources[k].asset)) useAssetAsSource(k, state.sources[k].asset); }
    markDirty();
  };
  renderAssets();
}
