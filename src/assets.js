/* ---------------- Assets: fonts, logos, palette ----------------
   Files live in this browser (IndexedDB), never inside fxlab.html,
   so licensed fonts stay with you. Kits (.fxkit) move them between
   browsers or machines.
------------------------------------------------------------------ */
const Assets = (() => {
  const A = { list:[], byId:{}, palette:[], kitName:'Brand kit', defaultFont:'', identity:null, version:0, persistent:false, ready:null, onChange:null };
  const FONT_EXT = ['otf', 'ttf', 'woff', 'woff2'];
  const IMG_EXT = ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif'];
  const MIME = { otf:'font/otf', ttf:'font/ttf', woff:'font/woff', woff2:'font/woff2', svg:'image/svg+xml', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', gif:'image/gif' };
  const ext = n => (String(n).split('.').pop() || '').toLowerCase();
  const stem = n => String(n).split('/').pop().replace(/\.[^.]+$/, '');
  const changed = () => { A.version++; A.onChange && A.onChange(); };

  /* ---------- helpers ---------- */
  function fnv(u8){
    let h1 = 0x811c9dc5, h2 = 0x01000193 ^ u8.length;
    for (let i = 0; i < u8.length; i++){ h1 = Math.imul(h1 ^ u8[i], 16777619); if (i % 7 === 0) h2 = Math.imul(h2 ^ u8[i], 2246822519); }
    return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36).slice(0, 4);
  }
  function pretty(name){
    return stem(name)
      .replace(/[-_]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b(RGB|CMYK|Layers|web)\b/gi, '')
      .replace(/\s+/g, ' ').trim();
  }
  const hex6 = h => { h = h.toLowerCase().replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return '#' + h; };

  /* ---------- IndexedDB ---------- */
  let db = null;
  function openDB(){
    return new Promise(res => {
      try {
        const r = indexedDB.open('fxlab', 1);
        r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('assets')) d.createObjectStore('assets', { keyPath:'id' }); if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta'); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
        r.onblocked = () => res(null);
      } catch { res(null); }
    });
  }
  function tx(store, mode, fn){
    return new Promise(res => {
      if (!db) return res(null);
      try { const t = db.transaction(store, mode); const s = t.objectStore(store); const out = fn(s); t.oncomplete = () => res(out && 'result' in out ? out.result : true); t.onerror = () => res(null); t.onabort = () => res(null); }
      catch { res(null); }
    });
  }
  const dbPut = rec => tx('assets', 'readwrite', s => s.put(rec));
  const dbDel = id => tx('assets', 'readwrite', s => s.delete(id));
  const dbClear = () => tx('assets', 'readwrite', s => s.clear());
  const dbAll = () => tx('assets', 'readonly', s => s.getAll());
  const saveMeta = () => tx('meta', 'readwrite', s => s.put({ palette:A.palette, kitName:A.kitName, defaultFont:A.defaultFont, identity:A.identity }, 'kit'));
  const loadMeta = () => tx('meta', 'readonly', s => s.get('kit'));
  A.metaGet = key => tx('meta', 'readonly', s => s.get(key));
  A.metaPut = (key, val) => tx('meta', 'readwrite', s => s.put(val, key));
  A.metaDel = key => tx('meta', 'readwrite', s => s.delete(key));

  /* ---------- zip reading (store + deflate) ---------- */
  async function inflateRaw(u8){
    if (!window.DecompressionStream) throw new Error('This browser can’t unzip files. Unzip first and drop the files in.');
    const ds = new DecompressionStream('deflate-raw');
    const buf = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  }
  async function readZip(buf){
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--){ if (dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; } }
    if (eocd < 0) throw new Error('Not a readable zip file');
    const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
    const td = new TextDecoder(), out = [];
    for (let n = 0; n < count && p + 46 <= u8.length; n++){
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = td.decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + elen + clen;
      if (name.endsWith('/')) continue;
      out.push({ name, method, csize, usize, off, async data(){
        const lnl = dv.getUint16(off + 26, true), lel = dv.getUint16(off + 28, true);
        const start = off + 30 + lnl + lel, raw = u8.subarray(start, start + csize);
        if (method === 0) return raw.slice();
        if (method === 8) return inflateRaw(raw);
        throw new Error(`Unsupported compression in ${name}`);
      } });
    }
    return out;
  }

  /* ---------- fonts ---------- */
  function fontName(u8){
    try {
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      const sig = dv.getUint32(0);
      if (sig !== 0x00010000 && sig !== 0x4F54544F && sig !== 0x74727565) return null; /* only raw OTF/TTF */
      const num = dv.getUint16(4);
      for (let i = 0; i < num; i++){
        const r = 12 + i * 16;
        if (String.fromCharCode(u8[r], u8[r + 1], u8[r + 2], u8[r + 3]) !== 'name') continue;
        const t = dv.getUint32(r + 8), cnt = dv.getUint16(t + 2), so = t + dv.getUint16(t + 4), names = {};
        for (let j = 0; j < cnt; j++){
          const q = t + 6 + j * 12, plat = dv.getUint16(q), id = dv.getUint16(q + 6), len = dv.getUint16(q + 8), o = so + dv.getUint16(q + 10);
          if (![1, 2, 4, 16, 17].includes(id)) continue;
          let str = '';
          if (plat === 3 || plat === 0){ for (let k = 0; k < len; k += 2) str += String.fromCharCode(dv.getUint16(o + k)); if (!names[id] || plat === 3) names[id] = str; }
          else if (plat === 1 && !names[id]){ for (let k = 0; k < len; k++) str += String.fromCharCode(u8[o + k]); names[id] = str; }
        }
        const full = names[4] || [names[16] || names[1], names[17] || names[2]].filter(Boolean).join(' ');
        return full && full.replace(/[.\s]/g, '').length > 1 ? full.trim() : null;
      }
    } catch {}
    return null;
  }
  async function activateFont(a){
    a.family = `fxa-${a.id}`;
    const face = new FontFace(a.family, await a.blob.arrayBuffer(), { weight:'1 1000', style:'normal', display:'block' });
    await face.load();
    document.fonts.add(face);
    a.face = face;
  }

  /* ---------- images ---------- */
  function svgColors(text){
    const found = [];
    const re = /(?:fill|stroke|stop-color)\s*[:=]\s*["']?\s*(#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|white|black)/gi;
    let m; while ((m = re.exec(text))){ let c = m[1].toLowerCase(); c = c === 'white' ? '#ffffff' : c === 'black' ? '#000000' : hex6(c); if (!found.includes(c)) found.push(c); }
    return found;
  }
  async function activateImage(a){
    let blob = a.blob;
    if (a.mime === 'image/svg+xml'){
      const text = await blob.text();
      a.colors = svgColors(text);
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      const svg = doc.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('Unreadable SVG');
      const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
      let w = parseFloat(svg.getAttribute('width')) || vb[2] || 1024, h = parseFloat(svg.getAttribute('height')) || vb[3] || 1024;
      if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const s = 2048 / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s);
      svg.setAttribute('width', w); svg.setAttribute('height', h);
      blob = new Blob([new XMLSerializer().serializeToString(svg)], { type:'image/svg+xml' });
    }
    const url = URL.createObjectURL(blob);
    const img = new Image(); img.decoding = 'async';
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Unreadable image')); img.src = url; });
    a.img = img; a.w = img.naturalWidth || img.width; a.h = img.naturalHeight || img.height;
    a.thumb = a.thumb || URL.createObjectURL(a.blob);
  }
  function raster(a){
    if (a.raster) return a.raster;
    const s = Math.min(1, 2048 / Math.max(a.w, a.h));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(a.w * s)); c.height = Math.max(1, Math.round(a.h * s));
    c.getContext('2d').drawImage(a.img, 0, 0, c.width, c.height);
    return (a.raster = c);
  }
  const tintCache = new Map();

  /* ---------- registry ---------- */
  async function activate(a){
    if (a.kind === 'font') await activateFont(a);
    else await activateImage(a);
    A.list.push(a); A.byId[a.id] = a;
  }
  A.get = ref => { if (!ref) return null; if (String(ref).startsWith('role:')) ref = Identity.logoRef(ref); if (!ref) return null; const id = String(ref).replace(/^asset:/, ''); return A.byId[id] || null; };
  A.fonts = () => A.list.filter(a => a.kind === 'font').sort((a, b) => a.name.localeCompare(b.name));
  /* the font new type modules start with: the starred one, else the plainest name */
  A.pickFont = () => {
    const f = A.fonts(); if (!f.length) return null;
    return A.byId[A.defaultFont] || [...f].sort((a, b) => (/italic|oblique|reverse|slant/i.test(a.name) - /italic|oblique|reverse|slant/i.test(b.name)) || a.name.length - b.name.length)[0];
  };
  A.setDefaultFont = async id => { A.defaultFont = A.defaultFont === id ? '' : id; await saveMeta(); changed(); };
  A.images = () => A.list.filter(a => a.kind === 'image');
  A.image = ref => { const a = A.get(ref); return a && a.kind === 'image' ? raster(a) : null; };
  A.tinted = (ref, color) => {
    const a = A.get(ref); if (!a || a.kind !== 'image') return null;
    const key = a.id + color; if (tintCache.has(key)) return tintCache.get(key);
    const src = raster(a), c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    tintCache.set(key, c); if (tintCache.size > 40) tintCache.delete(tintCache.keys().next().value);
    return c;
  };

  /* file-like {name, data:Uint8Array} → pending asset records */
  function classify(name){
    const base = name.split('/').pop();
    if (name.includes('__MACOSX/') || base.startsWith('._') || base === '.DS_Store') return null;
    const e = ext(base);
    if (FONT_EXT.includes(e)) return 'font';
    if (IMG_EXT.includes(e)) return 'image';
    return 'skip';
  }
  async function ingest(entries, summary){
    /* de-duplicate: SVG beats PNG of the same logo; OTF/TTF beats WOFF2 beats WOFF of the same font */
    const rank = { svg:0, png:1, webp:2, jpg:3, jpeg:3, gif:4, otf:0, ttf:0, woff2:1, woff:2 };
    const groups = new Map();
    for (const en of entries){
      const kind = classify(en.name);
      if (!kind) continue;
      if (kind === 'skip'){ summary.skipped.push(en.name.split('/').pop()); continue; }
      const key = kind + ':' + (kind === 'font' ? stem(en.name).toLowerCase().replace(/web/g, '').replace(/[^a-z0-9]/g, '') : stem(en.name).toLowerCase());
      const prev = groups.get(key);
      if (!prev || rank[ext(en.name)] < rank[ext(prev.name)]) groups.set(key, { ...en, kind });
    }
    for (const en of groups.values()){
      try {
        const data = await en.data();
        const id = fnv(data);
        if (A.byId[id]){ summary.duplicates++; continue; }
        const e = ext(en.name), parts = en.name.split('/').filter(Boolean);
        const a = { id, kind:en.kind, file:parts.pop(), group:parts.slice(-3).filter(p => !/^(digital|desktop|web|print)$/i.test(p)).join(' / '), mime:MIME[e], blob:new Blob([data], { type:MIME[e] }), added:Date.now() };
        a.name = en.kind === 'font' ? (fontName(data) || pretty(a.file)) : pretty(a.file);
        await activate(a);
        await dbPut({ id:a.id, kind:a.kind, name:a.name, file:a.file, group:a.group, mime:a.mime, blob:a.blob, added:a.added });
        summary[en.kind === 'font' ? 'fonts' : 'images']++; summary.added.push(a.id);
        if (a.colors && a.colors.length === 1) addColor(a.colors[0], colorName(a.file), summary);
      } catch (err){ console.warn('fxlab asset', en.name, err); summary.failed.push(en.name.split('/').pop()); }
    }
  }
  /* 'BRAND-Symbol-RallyRed-RGB.svg' → 'Rally Red' (the token that reads as a colour name) */
  function colorName(file){
    const toks = stem(file).split(/[-_ ]+/).filter(t => !/^(rgb|cmyk|layers|web|print|digital|\d+)$/i.test(t));
    const t = toks.length > 1 ? toks[toks.length - 1] : toks[0] || '';
    return t.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  function addColor(hex, name, summary){
    hex = hex6(hex);
    if (A.palette.some(c => c.hex === hex)) return false;
    A.palette.push({ hex, name:name || hex.toUpperCase() });
    if (summary) summary.colors++;
    return true;
  }

  /* ---------- public actions ---------- */
  A.addFiles = async files => {
    const summary = { fonts:0, images:0, colors:0, duplicates:0, skipped:[], failed:[], added:[] };
    const loose = [];
    for (const f of files){
      const e = ext(f.name);
      if (e === 'fxkit'){ try { await importKit(await f.arrayBuffer(), summary); } catch (err){ summary.failed.push(`${f.name}: ${err.message}`); } continue; }
      if (e === 'zip'){
        try { const entries = await readZip(await f.arrayBuffer()); await ingest(entries, summary); }
        catch (err){ summary.failed.push(`${f.name}: ${err.message}`); }
        continue;
      }
      loose.push({ name:f.name, data:async () => new Uint8Array(await f.arrayBuffer()) });
    }
    if (loose.length) await ingest(loose, summary);
    summary.system = Identity.autoSetup();
    await saveMeta(); changed();
    return summary;
  };
  A.remove = async id => {
    const a = A.byId[id]; if (!a) return;
    A.list.splice(A.list.indexOf(a), 1); delete A.byId[id];
    if (a.face) document.fonts.delete(a.face);
    if (a.thumb) URL.revokeObjectURL(a.thumb);
    [...tintCache.keys()].forEach(k => k.startsWith(id) && tintCache.delete(k));
    if (A.defaultFont === id) A.defaultFont = '';
    await dbDel(id); await saveMeta(); changed();
  };
  A.clear = async () => {
    for (const a of [...A.list]){ if (a.face) document.fonts.delete(a.face); if (a.thumb) URL.revokeObjectURL(a.thumb); }
    A.list = []; A.byId = {}; A.palette = []; A.defaultFont = ''; A.identity = Identity.blank(); tintCache.clear();
    await dbClear(); await saveMeta(); changed();
  };
  A.addColor = async (hex, name) => { const ok = addColor(hex, name); await saveMeta(); changed(); return ok; };
  A.removeColor = async hex => { A.palette = A.palette.filter(c => c.hex !== hex); await saveMeta(); changed(); };
  A.renameColor = async (hex, name) => { const c = A.palette.find(c => c.hex === hex); if (c){ c.name = name; await saveMeta(); changed(); } };
  A.setKitName = async name => { A.kitName = name || 'Brand kit'; await saveMeta(); };
  /* call after editing A.identity */
  A.saveIdentity = async (quiet = false) => { await saveMeta(); if (!quiet) changed(); else A.version++; };

  /* kit = STORE zip: manifest.json + assets/<id>/<file> */
  A.exportKit = async () => {
    const zip = new Zip();
    const manifest = { app:'fxlab-kit', version:2, name:A.kitName, palette:A.palette, defaultFont:A.defaultFont, identity:A.identity,
      assets:A.list.map(a => ({ id:a.id, kind:a.kind, name:a.name, file:a.file, group:a.group, mime:a.mime })) };
    await zip.add('manifest.json', new Blob([JSON.stringify(manifest, null, 2)], { type:'application/json' }));
    for (const a of A.list) await zip.add(`assets/${a.id}/${a.file}`, a.blob);
    return zip.blob();
  };
  async function importKit(buf, summary){
    const entries = await readZip(buf);
    const man = entries.find(e => e.name === 'manifest.json');
    if (!man) throw new Error('That kit has no manifest');
    const m = JSON.parse(new TextDecoder().decode(await man.data()));
    if (m.app !== 'fxlab-kit') throw new Error('That isn’t an fxlab kit');
    if (m.name && A.kitName === 'Brand kit') A.kitName = m.name;
    if (m.defaultFont && !A.defaultFont) A.defaultFont = m.defaultFont;
    if (m.identity){
      const cur = A.identity, inc = Object.assign(Identity.blank(), m.identity);
      if (!cur.colourways.length && !cur.looks.length && !cur.type.display) A.identity = inc;
      else inc.looks.forEach(l => { if (!cur.looks.some(x => x.id === l.id)) cur.looks.push(l); });
      summary.looks = inc.looks.length;
    }
    for (const c of m.palette || []) addColor(c.hex, c.name, summary);
    for (const info of m.assets || []){
      if (A.byId[info.id]){ summary.duplicates++; continue; }
      const en = entries.find(e => e.name === `assets/${info.id}/${info.file}`); if (!en) continue;
      try {
        const data = await en.data();
        const a = { ...info, blob:new Blob([data], { type:info.mime }), added:Date.now() };
        await activate(a);
        await dbPut({ id:a.id, kind:a.kind, name:a.name, file:a.file, group:a.group, mime:a.mime, blob:a.blob, added:a.added });
        summary[a.kind === 'font' ? 'fonts' : 'images']++; summary.added.push(a.id);
      } catch (err){ summary.failed.push(info.file); }
    }
  }

  /* restore what's stored in this browser */
  A.ready = (async () => {
    db = await openDB();
    const recs = await dbAll();
    A.persistent = !!(db && recs);
    const meta = await loadMeta();
    A.identity = Object.assign(Identity.blank(), (meta && meta.identity) || {});
    if (meta){ A.palette = meta.palette || []; A.kitName = meta.kitName || 'Brand kit'; A.defaultFont = meta.defaultFont || ''; }
    for (const r of (recs || []).sort((a, b) => a.added - b.added)){
      try { await activate({ ...r }); } catch (err){ console.warn('fxlab: could not restore asset', r.file, err); }
    }
    changed();
  })();
  return A;
})();
