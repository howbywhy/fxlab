/* ---------------- Images and palette ---------------- */
async function importAssets(files){
  if (!files || !files.length) return;
  showWorkspace('images', true);
  toast(`Reading ${files.length === 1 ? files[0].name : files.length + ' files'}…`, false, 60000);
  const sum = await Assets.addFiles(files);
  const bits = [];
  if (sum.images) bits.push(`${sum.images} image${sum.images > 1 ? 's' : ''}`);
  if (sum.colors) bits.push(`${sum.colors} colour${sum.colors > 1 ? 's' : ''}`);
  if (sum.looks) bits.push(`${sum.looks} look${sum.looks > 1 ? 's' : ''}`);
  let msg = bits.length ? `Added ${bits.join(', ')}.` : 'Nothing new added.';
  if (sum.duplicates) msg += ` ${sum.duplicates} already here.`;
  if (sum.skipped.length){
    const kinds = [...new Set(sum.skipped.map(n => '.' + n.split('.').pop().toLowerCase()))].slice(0, 4).join(', ');
    msg += ` Skipped ${sum.skipped.length} file${sum.skipped.length > 1 ? 's' : ''} fxlab can’t use (${kinds}).`;
  }
  if (sum.failed.length) msg += `\nCouldn’t read: ${sum.failed.slice(0, 3).join(', ')}${sum.failed.length > 3 ? '…' : ''}`;
  if (sum.system) msg += ' Colourways are set up in the System tab.';
  toast(msg, !!sum.failed.length && !bits.length, 7000);
}

function useAssetAsSource(k, id){
  const a = Assets.get(id), c = Assets.sourceImage(id); if (!c) return;
  History.record('source', () => {
    Engine.setMedia(k, c, c.width, c.height, false);
    App.mediaInfo[k] = { name:a.name, thumb:a.thumb, alpha:true };
    state.sources[k].asset = a.id;
    if (!state.sources[k].fit) state.sources[k].fit = 1;
    renderSlots(); markDirty();
  });
}

function renderAssets(){
  const imgBox = $('#assetsImages'), palBox = $('#assetsPalette'); if (!imgBox || !palBox) return;
  imgBox.innerHTML = ''; palBox.innerHTML = '';

  /* images */
  const imgs = Assets.images();
  const hd = el('div', 'ahead'); hd.append('Image library', el('span', null, imgs.length ? String(imgs.length) : '')); imgBox.append(hd);
  if (!imgs.length){
    const drop = el('button', 'adrop'); drop.innerHTML = '<b>Add images or a zip</b>Drop files here or click to browse. SVG, PNG, JPG, WebP, .zip, .fxkit';
    drop.onclick = () => $('#fileAssets').click(); imgBox.append(drop);
    imgBox.append(el('p', 'anote', 'Images you add here can be used as A or B at any time. They stay in this browser, not inside fxlab.html.'));
  } else {
    const grid = el('div', 'agrid');
    /* drop a word every image shares so captions stay readable */
    const first = imgs.map(i => i.name.split(' ')[0]); const common = imgs.length > 1 && first.every(f => f === first[0]) ? first[0] + ' ' : '';
    imgs.forEach(a => {
      const tile = el('div', 'aimg');
      const pic = el('div', 'pic checker'); pic.style.backgroundImage = `url("${a.thumb}")`; pic.title = `${a.name}\n${a.group ? a.group + ' / ' : ''}${a.file}`;
      const acts = el('div', 'acts');
      const mk = (t, title, fn) => { const b = el('button', null, t); b.title = title; b.setAttribute('aria-label', title); b.onclick = fn; return b; };
      acts.append(mk('A', 'Use as image A', () => useAssetAsSource('A', a.id)), mk('B', 'Use as image B', () => useAssetAsSource('B', a.id)), mk('×', `Remove ${a.name}`, () => Assets.remove(a.id)));
      tile.append(pic, acts, el('div', 'cap', common && a.name.startsWith(common) ? a.name.slice(common.length) : a.name)); grid.append(tile);
    });
    imgBox.append(grid);
    const more = el('button', 'ghost', 'Add more images…'); more.style.marginTop = '8px'; more.onclick = () => $('#fileAssets').click(); imgBox.append(more);
  }

  /* palette */
  const ph = el('div', 'ahead'); ph.append('Palette', el('span', null, Assets.palette.length ? String(Assets.palette.length) : '')); palBox.append(ph);
  if (!Assets.palette.length) palBox.append(el('p', 'anote', 'Colours here show up as swatches under every colour control. Add your own, or pull them from the image on the stage.'));
  Assets.palette.forEach(c => {
    const row = el('div', 'apal');
    const sw = el('i'); sw.style.background = c.hex; sw.title = 'Copy hex';
    sw.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(c.hex.toUpperCase()).then(() => toast(`Copied ${c.hex.toUpperCase()}`), () => {}); };
    const nm = el('input'); nm.type = 'text'; nm.value = c.name; nm.setAttribute('aria-label', 'Colour name');
    nm.onchange = () => Assets.renameColor(c.hex, nm.value.trim() || c.hex.toUpperCase());
    const right = el('div'); right.style.cssText = 'display:flex;align-items:center;gap:2px';
    const rm = el('button', 'ghost icon', '×'); rm.title = `Remove ${c.name}`; rm.setAttribute('aria-label', `Remove ${c.name}`); rm.onclick = () => Assets.removeColor(c.hex);
    right.append(el('code', null, c.hex.toUpperCase()), rm);
    row.append(sw, nm, right); palBox.append(row);
  });
  const add = el('div', 'aadd');
  const ci = el('input'); ci.type = 'color'; ci.value = '#ff5a36'; ci.setAttribute('aria-label', 'New colour');
  const cn = el('input'); cn.type = 'text'; cn.placeholder = 'Colour name'; cn.setAttribute('aria-label', 'Colour name');
  const cb = el('button', null, 'Add'); cb.onclick = async () => { if (!(await Assets.addColor(ci.value, cn.value.trim()))) toast('That colour is already in the palette.'); };
  add.append(ci, cn, cb); palBox.append(add);
  const tools = el('div', 'pal-tools');
  ['A', 'B'].forEach(k => {
    const b = el('button', null, `Pull colours from image ${k}`); b.title = 'Finds the five main colours in the current frame of this image';
    b.onclick = async () => {
      const m = Engine.media[k]; const got = m ? Assets.extract(m.el, 5) : [];
      if (!got.length){ toast('Couldn’t read colours from that image.', true); return; }
      let n = 0; for (const c of got) if (await Assets.addColor(c.hex, `From image ${k} ${n + 1}`)) n++;
      toast(n ? `Added ${n} colour${n > 1 ? 's' : ''} from image ${k}.` : 'Those colours are already in the palette.');
    };
    tools.append(b);
  });
  palBox.append(tools);

  /* kit */
  const kit = el('div', 'akit');
  const kn = el('input'); kn.type = 'text'; kn.value = Assets.kitName; kn.setAttribute('aria-label', 'Kit name'); kn.onchange = () => Assets.setKitName(kn.value.trim());
  const r1 = el('div', 'row');
  const save = el('button', null, 'Save kit'); save.title = 'Download images, palette, colourways and saved looks as one .fxkit file';
  save.onclick = async () => {
    if (!Assets.list.length && !Assets.palette.length){ toast('Add some images or colours first.'); return; }
    const blob = await Assets.exportKit();
    download(blob, `${(Assets.kitName || 'palette-kit').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'palette-kit'}.fxkit`);
  };
  const open = el('button', null, 'Open kit'); open.onclick = () => $('#fileAssets').click();
  r1.append(save, open);
  const clear = el('button', 'ghost', 'Clear all images and colours');
  clear.onclick = async () => { if (confirm('Remove every image and colour from this browser? Save a kit first if you want to keep them.')) await Assets.clear(); };
  kit.append(el('div', 'ahead', 'Kit'), kn, r1);
  if (Assets.list.length || Assets.palette.length) kit.append(clear);
  kit.append(el('p', 'anote', Assets.persistent ? 'Kept in this browser on this computer. A kit moves them to another.' : 'This browser won’t keep assets for a local file, so they clear when you close the tab. Save a kit to keep them.'));
  palBox.append(kit);
}

function initAssetsUI(){
  $('#fileAssets').onchange = e => { importAssets([...e.target.files]); e.target.value = ''; };
  let first = true;
  Assets.onChange = () => {
    renderAssets();
    /* refresh controls so swatches are current; restore asset sources after reload */
    const active = document.activeElement;
    if (!(active && active.closest && active.closest('#insp'))){ renderBase(); renderStack(); }
    if (first){ first = false; for (const k of ['A', 'B']) if (state.sources[k].asset && Assets.get(state.sources[k].asset)) useAssetAsSource(k, state.sources[k].asset); }
    markDirty();
  };
  renderAssets();
}
