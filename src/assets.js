/* ---------------- Assets: images and palette ----------------
   Files live in this browser (IndexedDB), never inside fxlab.html.
   Kits (.fxkit) move them between browsers or machines.
------------------------------------------------------------------ */
const Assets = (() => {
  const A = { list:[], byId:{}, palette:[], kitName:'Palette kit', identity:null, version:0, persistent:false, ready:null, onChange:null };
  const IMG_EXT = ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif'];
  const MIME = { svg:'image/svg+xml', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', gif:'image/gif' };
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
  const saveMeta = () => tx('meta', 'readwrite', s => s.put({ palette:A.palette, kitName:A.kitName, identity:A.identity }, 'kit'));
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

  /* An SVG used as a source keeps its own canvas, tagged with vecId, so the engine can draw it
     again at the size the frame needs (drawImage re-renders an SVG image as vectors) instead of
     stretching a fixed 2048 px raster. Other users of Assets.image keep the shared raster. */
  const VEC_MAX = 4096;
  function rasterTo(c, long){
    const a = A.byId[c.vecId]; if (!a) return c;
    const s = Math.min(VEC_MAX, Math.max(256, long)) / Math.max(a.w, a.h);
    const w = Math.max(1, Math.round(a.w * s)), h = Math.max(1, Math.round(a.h * s));
    if (c.width !== w || c.height !== h){ c.width = w; c.height = h; }
    const x = c.getContext('2d'); x.clearRect(0, 0, w, h); x.drawImage(a.img, 0, 0, w, h);
    return c;
  }
  A.rasterTo = rasterTo;
  A.isVector = ref => { const a = A.get(ref); return !!a && a.mime === 'image/svg+xml'; };
  A.sourceImage = ref => {
    const a = A.get(ref); if (!a || a.kind !== 'image') return null;
    if (a.mime !== 'image/svg+xml') return raster(a);
    if (!a.srcRaster){ const c = document.createElement('canvas'); c.vecId = a.id; a.srcRaster = rasterTo(c, 2048); }
    return a.srcRaster;
  };

  /* ---------- registry ---------- */
  async function activate(a){
    await activateImage(a);
    A.list.push(a); A.byId[a.id] = a;
  }
  A.get = ref => { if (!ref) return null; const id = String(ref).replace(/^asset:/, ''); return A.byId[id] || null; };
  A.images = () => A.list.filter(a => a.kind === 'image');
  A.image = ref => { const a = A.get(ref); return a && a.kind === 'image' ? raster(a) : null; };

  /* file-like {name, data:Uint8Array} → pending asset records */
  function classify(name){
    const base = name.split('/').pop();
    if (name.includes('__MACOSX/') || base.startsWith('._') || base === '.DS_Store') return null;
    const e = ext(base);
    if (IMG_EXT.includes(e)) return 'image';
    return 'skip';
  }
  async function ingest(entries, summary){
    /* de-duplicate: SVG beats PNG of the same image */
    const rank = { svg:0, png:1, webp:2, jpg:3, jpeg:3, gif:4 };
    const groups = new Map();
    for (const en of entries){
      const kind = classify(en.name);
      if (!kind) continue;
      if (kind === 'skip'){ summary.skipped.push(en.name.split('/').pop()); continue; }
      const key = kind + ':' + stem(en.name).toLowerCase();
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
        a.name = pretty(a.file);
        await activate(a);
        await dbPut({ id:a.id, kind:a.kind, name:a.name, file:a.file, group:a.group, mime:a.mime, blob:a.blob, added:a.added });
        summary.images++; summary.added.push(a.id);
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
    const summary = { images:0, colors:0, duplicates:0, skipped:[], failed:[], added:[] };
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
    if (a.thumb) URL.revokeObjectURL(a.thumb);
    await dbDel(id); await saveMeta(); changed();
  };
  A.clear = async () => {
    for (const a of [...A.list]){ if (a.thumb) URL.revokeObjectURL(a.thumb); }
    A.list = []; A.byId = {}; A.palette = []; A.identity = Identity.blank();
    await dbClear(); await saveMeta(); changed();
  };
  A.addColor = async (hex, name) => { const ok = addColor(hex, name); await saveMeta(); changed(); return ok; };
  A.removeColor = async hex => { A.palette = A.palette.filter(c => c.hex !== hex); await saveMeta(); changed(); };
  A.renameColor = async (hex, name) => { const c = A.palette.find(c => c.hex === hex); if (c){ c.name = name; await saveMeta(); changed(); } };
  /* the main colours of an image or video frame: k-means on a small copy, seeded by the most distant colours so the result is repeatable */
  A.extract = (source, k = 5) => {
    /* one image, or several pooled into one palette */
    const S = 48, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d', { willReadFrequently:true }), px = [];
    for (const src of Array.isArray(source) ? source : [source]){
      x.clearRect(0, 0, S, S);
      try { x.drawImage(src, 0, 0, S, S); } catch { continue; }
      const d = x.getImageData(0, 0, S, S).data;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]);
    }
    if (px.length < k) return [];
    const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    const mean = px.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map(v => v / px.length);
    let cen = [px.reduce((b, p) => dist(p, mean) < dist(b, mean) ? p : b)];
    while (cen.length < k){ let best = px[0], bd = -1; for (const p of px){ const m = Math.min(...cen.map(q => dist(p, q))); if (m > bd){ bd = m; best = p; } } cen.push(best); }
    let count = [];
    for (let it = 0; it < 12; it++){
      const sum = cen.map(() => [0, 0, 0, 0]);
      for (const p of px){ let bi = 0, bd = Infinity; cen.forEach((q, i) => { const dd = dist(p, q); if (dd < bd){ bd = dd; bi = i; } }); const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; }
      cen = sum.map((s, i) => s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cen[i]); count = sum.map(s => s[3]);
    }
    const hex = q => '#' + q.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    return cen.map((q, i) => ({ hex:hex(q), share:count[i] / px.length })).sort((a, b) => b.share - a.share);
  };
  A.setKitName = async name => { A.kitName = name || 'Palette kit'; await saveMeta(); };
  /* call after editing A.identity */
  A.saveIdentity = async (quiet = false) => { await saveMeta(); if (!quiet) changed(); else A.version++; };

  /* kit = STORE zip: manifest.json + assets/<id>/<file> */
  A.exportKit = async () => {
    const zip = new Zip();
    const manifest = { app:'fxlab-kit', version:3, name:A.kitName, palette:A.palette, identity:A.identity,
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
    if (m.name && A.kitName === 'Palette kit') A.kitName = m.name;
    if (m.identity){
      const cur = A.identity, inc = Object.assign(Identity.blank(), m.identity);
      if (!cur.colourways.length && !cur.looks.length) A.identity = inc;
      else inc.looks.forEach(l => { if (!cur.looks.some(x => x.id === l.id)) cur.looks.push(l); });
      summary.looks = inc.looks.length;
    }
    for (const c of m.palette || []) addColor(c.hex, c.name, summary);
    for (const info of m.assets || []){
      if (info.kind !== 'image'){ summary.skipped.push(info.file); continue; }
      if (A.byId[info.id]){ summary.duplicates++; continue; }
      const en = entries.find(e => e.name === `assets/${info.id}/${info.file}`); if (!en) continue;
      try {
        const data = await en.data();
        const a = { ...info, blob:new Blob([data], { type:info.mime }), added:Date.now() };
        await activate(a);
        await dbPut({ id:a.id, kind:a.kind, name:a.name, file:a.file, group:a.group, mime:a.mime, blob:a.blob, added:a.added });
        summary.images++; summary.added.push(a.id);
      } catch (err){ summary.failed.push(info.file); }
    }
  }

  /* restore what's stored in this browser */
  /* a language opened from a link must not overwrite this browser's own kit */
  A.detach = () => { db = null; A.persistent = false; };

  A.ready = (async () => {
    if (PLAYER_RECIPE){
      await null;   /* Identity is defined after this file loads */
      /* a tool is read-only: nothing is stored, and the recipe supplies the palette and colourways */
      A.identity = Object.assign(Identity.blank(), PLAYER_RECIPE.identity || {});
      A.palette = PLAYER_RECIPE.palette || []; A.persistent = false;
      changed(); return;
    }
    db = await openDB();
    const recs = await dbAll();
    A.persistent = !!(db && recs);
    const meta = await loadMeta();
    A.identity = Object.assign(Identity.blank(), (meta && meta.identity) || {});
    if (meta){ A.palette = meta.palette || []; A.kitName = meta.kitName || 'Palette kit'; }
    for (const r of (recs || []).sort((a, b) => a.added - b.added)){
      if (r.kind !== 'image') continue;
      try { await activate({ ...r }); } catch (err){ console.warn('fxlab: could not restore asset', r.file, err); }
    }
    changed();
  })();
  return A;
})();
