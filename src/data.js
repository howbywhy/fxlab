/* ---------------- Data ----------------
   One table at a time. Load it from a sample, a file, pasted text or an API,
   then either link any range control to a column (inst.bind) or use the Data
   modules, which read the table directly.
   Rows are capped so canvas and shaders stay smooth. API keys are never saved
   into projects.
------------------------------------------------ */
const Data = (() => {
  const MAX_ROWS = 2000, MAX_COLS = 24, MAX_BYTES = 8e6;
  const D = { table:null, pending:null, version:0, play:{ mode:'pingpong', row:.5 }, trim:false, onChange:null, MAX_ROWS, MAX_COLS };
  const changed = () => { D.version++; D.onChange && D.onChange(); };
  const clamp = Util.clamp;

  /* ---------- parsing ---------- */
  function parseCSV(text){
    text = String(text).replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0];
    const counts = [',', ';', '\t', '|'].map(d => [d, first.split(d).length - 1]).sort((a, b) => b[1] - a[1]);
    const delim = counts[0][1] > 0 ? counts[0][0] : ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++){
      const ch = text[i];
      if (q){ if (ch === '"'){ if (text[i + 1] === '"'){ cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim){ row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r'){
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cur += ch;
    }
    if (cur !== '' || row.length){ row.push(cur); rows.push(row); }
    return rows;
  }

  const ISO = /^\d{4}-\d{2}(-\d{2})?([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
  function num(v){
    if (typeof v === 'number') return v;
    if (v == null || typeof v === 'boolean') return NaN;
    const s = String(v).trim().replace(/^\+/, '');
    if (s === '') return NaN;
    if (/^-?\d+,\d+$/.test(s)) return Number(s.replace(',', '.'));
    const n = Number(s); return Number.isFinite(n) ? n : NaN;
  }
  const isTime = v => typeof v === 'string' && ISO.test(v.trim()) && Number.isFinite(Date.parse(v.trim()));

  function finishColumn(c){
    /* fill gaps by interpolating between the nearest real values */
    const v = c.v, n = v.length; let gaps = 0;
    for (let i = 0; i < n; i++) if (!Number.isFinite(v[i])) gaps++;
    if (gaps && gaps < n){
      let last = -1;
      for (let i = 0; i < n; i++){
        if (!Number.isFinite(v[i])) continue;
        if (last < 0) for (let j = 0; j < i; j++) v[j] = v[i];
        else if (i - last > 1) for (let j = last + 1; j < i; j++) v[j] = v[last] + (v[i] - v[last]) * (j - last) / (i - last);
        last = i;
      }
      for (let j = last + 1; j < n; j++) v[j] = v[last];
    }
    const s = Float64Array.from(v).filter(Number.isFinite).sort();
    c.min = s.length ? s[0] : 0; c.max = s.length ? s[s.length - 1] : 1;
    c.lo = s.length ? s[Math.floor(s.length * .02)] : 0; c.hi = s.length ? s[Math.min(s.length - 1, Math.floor(s.length * .98))] : 1;
    if (c.max === c.min) c.max = c.min + 1;
    if (c.hi === c.lo){ c.lo = c.min; c.hi = c.max; }
    c.gaps = gaps;
    /* an axis is a column that runs one way (time, year, an id): it places rows, it isn't a value to plot */
    let up = 0, down = 0;
    for (let i = 1; i < n; i++){ if (v[i] > v[i - 1]) up++; else if (v[i] < v[i - 1]) down++; }
    c.axis = c.type === 'time' || (c.type === 'number' && n >= 8 && Math.max(up, down) >= .97 * (n - 1));
    return c;
  }

  function inferColumn(name, raw){
    let filled = 0, nums = 0, times = 0;
    for (const v of raw){ if (v == null || v === '') continue; filled++; if (Number.isFinite(num(v))) nums++; else if (isTime(v)) times++; }
    if (!filled) return null;
    if (nums / filled >= .9) return finishColumn({ name, type:'number', v:Float64Array.from(raw, num) });
    if (times / filled >= .9) return finishColumn({ name, type:'time', v:Float64Array.from(raw, v => isTime(v) ? Date.parse(String(v).trim()) : NaN) });
    const cats = [], idx = new Map();
    const v = new Float64Array(raw.length);
    raw.forEach((x, i) => {
      if (x == null || x === ''){ v[i] = NaN; return; }
      const k = String(x); if (!idx.has(k)){ idx.set(k, cats.length); cats.push(k); }
      v[i] = idx.get(k);
    });
    if (cats.length > 60) return { name, type:'text', v:null, cats:[], min:0, max:1, lo:0, hi:1, gaps:0 };
    const c = finishColumn({ name, type:'category', v, cats });
    c.min = 0; c.max = Math.max(1, cats.length - 1); c.lo = c.min; c.hi = c.max;
    return c;
  }

  function buildTable(name, headers, raws, origin){
    let n = raws.length ? raws[0].length : 0, stride = 1;
    if (n > MAX_ROWS){ stride = Math.ceil(n / MAX_ROWS); }
    const pick = stride > 1 ? a => a.filter((_, i) => i % stride === 0 || i === a.length - 1) : a => a;
    const cols = [], seen = new Set();
    headers.forEach((h, i) => {
      if (cols.length >= MAX_COLS) return;
      let nm = String(h == null ? '' : h).trim() || `column ${i + 1}`, k = 2;
      while (seen.has(nm)) nm = `${String(h).trim()} ${k++}`;
      const c = inferColumn(nm, pick(raws[i])); if (!c) return;
      seen.add(nm); cols.push(c);
    });
    if (!cols.length) throw new Error('That data has no columns I can read.');
    const rows = cols.find(c => c.v).v.length;
    const t = { name, origin:origin || { kind:'paste' }, cols, rows, byName:{}, sampled:stride > 1 ? n : 0 };
    cols.forEach(c => { t.byName[c.name] = c; });
    return t;
  }

  function fromGrid(name, grid, origin){
    const looksHeader = grid.length > 0 && grid[0].some(c => c != null && String(c).trim() !== '' && !Number.isFinite(num(c)));
    const headers = looksHeader ? grid[0] : grid[0].map((_, i) => `column ${i + 1}`);
    const body = looksHeader ? grid.slice(1) : grid;
    if (body.length < 2) throw new Error('That data has fewer than two rows.');
    const w = Math.max(...body.slice(0, 50).map(r => r.length));
    const raws = Array.from({ length:w }, (_, j) => body.map(r => r[j]));
    return buildTable(name, headers, raws, origin);
  }

  const flat = (o, prefix = '', out = {}, depth = 0) => {
    for (const k of Object.keys(o)){
      const v = o[k], key = prefix ? prefix + '.' + k : k;
      if (v && typeof v === 'object' && !Array.isArray(v) && depth < 1) flat(v, key, out, depth + 1);
      else if (!Array.isArray(v) && (v == null || typeof v !== 'object')) out[key] = v;
    }
    return out;
  };
  function fromRecords(name, recs, origin, geo){
    const rows = recs.map(r => {
      if (!geo) return flat(r);
      const o = flat(r.properties || {});
      const g = r.geometry;
      if (g && g.type === 'Point' && Array.isArray(g.coordinates)){ o.longitude = g.coordinates[0]; o.latitude = g.coordinates[1]; if (g.coordinates[2] != null) o.altitude = g.coordinates[2]; }
      return o;
    });
    const keys = []; const ks = new Set();
    rows.slice(0, 100).forEach(r => Object.keys(r).forEach(k => { if (!ks.has(k)){ ks.add(k); keys.push(k); } }));
    return buildTable(name, keys, keys.map(k => rows.map(r => r[k])), origin);
  }
  function fromColumns(name, obj, keys, origin){
    return buildTable(name, keys, keys.map(k => obj[k]), origin);
  }

  /* every array of records, and every object of equal-length arrays, found in a JSON document */
  function findCandidates(json){
    const found = [];
    const walk = (node, path, depth) => {
      if (depth > 4 || node == null || typeof node !== 'object') return;
      if (Array.isArray(node)){
        if (node.length >= 2 && node.every(x => x && typeof x === 'object' && !Array.isArray(x))){
          found.push({ path, kind:'records', n:node.length, data:node });
          node.slice(0, 2).forEach((x, i) => walk(x, `${path}[${i}]`, depth + 1));   /* tables nested inside the records */
          return;
        }
        if (node.length >= 2 && node.every(x => Array.isArray(x))){ found.push({ path, kind:'grid', n:node.length, data:node }); return; }
        node.slice(0, 2).forEach((x, i) => walk(x, `${path}[${i}]`, depth + 1));
        return;
      }
      const keys = Object.keys(node);
      /* an object keyed by date or id, each value a record: { "2024-01-02": { USD: 1.1 }, … } */
      if (keys.length >= 3 && keys.every(k => node[k] && typeof node[k] === 'object' && !Array.isArray(node[k]) && Object.values(node[k]).some(x => x == null || typeof x !== 'object'))){
        found.push({ path, kind:'records', n:keys.length, data:keys.map(k => ({ key:k, ...node[k] })) });
      }
      if (Array.isArray(node.features) && node.features.length >= 2) found.push({ path:path ? path + '.features' : 'features', kind:'geo', n:node.features.length, data:node.features });
      const arrs = keys.filter(k => Array.isArray(node[k]) && node[k].length >= 2 && node[k].every(x => x == null || typeof x !== 'object'));
      if (arrs.length){
        const lens = {}; arrs.forEach(k => { lens[node[k].length] = (lens[node[k].length] || 0) + 1; });
        const len = +Object.keys(lens).sort((a, b) => lens[b] - lens[a] || b - a)[0];
        const ks = arrs.filter(k => node[k].length === len);
        if (ks.length >= 2) found.push({ path, kind:'columns', n:len, keys:ks, data:node });
      }
      keys.forEach(k => { if (k !== 'features') walk(node[k], path ? `${path}.${k}` : k, depth + 1); });
    };
    walk(json, '', 0);
    return found.sort((a, b) => b.n * (b.keys ? b.keys.length : 6) - a.n * (a.keys ? a.keys.length : 6));
  }
  const candLabel = c => `${c.path || 'top level'} · ${c.n} rows${c.kind === 'columns' ? `, ${c.keys.length} columns` : ''}`;

  function tableFromCandidate(c, name, origin){
    if (c.kind === 'records') return fromRecords(name, c.data, origin, false);
    if (c.kind === 'geo') return fromRecords(name, c.data, origin, true);
    if (c.kind === 'columns') return fromColumns(name, c.data, c.keys, origin);
    return fromGrid(name, c.data, origin);
  }

  /* text (CSV, JSON, GeoJSON, NDJSON) → table. JSON with several possible tables keeps the list in D.pending. */
  function parse(text, name, origin){
    text = String(text || '').trim();
    if (!text) throw new Error('There is nothing to read.');
    if (text.length > MAX_BYTES) throw new Error('That is more than 8 MB. Use a smaller extract or a shorter date range.');
    D.pending = null;
    if (text[0] === '{' || text[0] === '['){
      let json;
      try { json = JSON.parse(text); }
      catch {
        const lines = text.split(/\r?\n/).filter(Boolean);
        try { json = lines.map(l => JSON.parse(l)); } catch { throw new Error('That looks like JSON but it isn’t valid. Check for a missing bracket or quote.'); }
      }
      const cands = findCandidates(json);
      if (!cands.length) throw new Error('I couldn’t find a table in that JSON. I look for a list of records or lists of equal length.');
      /* the best-ranked table that has readable columns; a list of records with only nested values is skipped */
      let sel = 0, t = null, last;
      for (; sel < cands.length && !t; sel++){ try { t = tableFromCandidate(cands[sel], name, { ...origin, path:cands[sel].path }); } catch (e){ last = e; } }
      if (!t) throw last;
      D.pending = { cands, sel:sel - 1, name, origin };
      return t;
    }
    return fromGrid(name, parseCSV(text), origin);
  }
  D.candidates = () => D.pending ? D.pending.cands.map(candLabel) : [];
  D.pickCandidate = i => {
    const p = D.pending; if (!p || !p.cands[i]) return;
    p.sel = i; D.table = tableFromCandidate(p.cands[i], p.name, { ...p.origin, path:p.cands[i].path });
    changed();
  };

  /* ---------- loading ---------- */
  D.set = t => { D.table = t; changed(); return t; };
  D.clear = () => { D.table = null; D.pending = null; changed(); };
  D.loadText = (text, name, origin) => D.set(parse(text, name, origin));
  D.loadFile = async file => D.loadText(await file.text(), file.name.replace(/\.[^.]+$/, ''), { kind:'file' });
  const sampleCache = {};
  D.samples = DATA_SAMPLES;
  D.sources = DATA_SOURCES;
  D.sampleTable = id => {
    const s = DATA_SAMPLES.find(x => x.id === id) || DATA_SAMPLES[0];
    if (!sampleCache[s.id]){
      const t = fromGrid(s.name, parseCSV(s.csv), { kind:'sample', id:s.id });
      t.credit = s.credit; sampleCache[s.id] = t;
    }
    return sampleCache[s.id];
  };
  D.loadSample = id => D.set(D.sampleTable(id));
  /* the table modules see: yours, or the first sample so a Data module looks like something the moment it's added */
  D.current = () => D.table || D.sampleTable('weather');
  D.isDefault = () => !D.table;

  /* keys travel in headers, never in a saved project; query-string keys are blanked when saving */
  const SECRET = /^(key|apikey|api_key|token|access_token|secret|auth|appid|app_id)$/i;
  D.safeUrl = url => { try { const u = new URL(url); [...u.searchParams.keys()].forEach(k => { if (SECRET.test(k)) u.searchParams.set(k, ''); }); return u.toString(); } catch { return url; } };
  D.hasSecretInUrl = url => { try { return [...new URL(url).searchParams.keys()].some(k => SECRET.test(k)); } catch { return false; } };
  D.fetchUrl = async (url, headers) => {
    let u;
    try { u = new URL(url); } catch { throw new Error('That isn’t a web address. It should start with https://'); }
    if (!/^https?:$/.test(u.protocol)) throw new Error('Only http and https addresses work.');
    if (/(^|\.)are\.na$/i.test(u.hostname) && u.hostname !== 'api.are.na'){ const slug = Arena.slugOf(u.href); if (slug) u = new URL(Arena.contentsUrl(slug)); }
    let res;
    try { res = await fetch(u.toString(), { headers:headers || {}, cache:'no-store' }); }
    catch {
      throw new Error(location.protocol === 'file:'
        ? 'The browser couldn’t read that address. It may be offline, or the server doesn’t allow a page opened from a file to read it (CORS). Download the data and drop the file onto this tab instead.'
        : 'The browser couldn’t read that address. It may be offline, or the server doesn’t allow other sites to read it (CORS). Download the data and drop the file onto this tab instead.');
    }
    if (!res.ok) throw new Error(`The server answered ${res.status}${res.status === 401 || res.status === 403 ? ', so it probably needs an API key. Add it as a header.' : res.status === 429 ? ', which means too many requests. Wait a minute and try again.' : '.'}`);
    const text = await res.text();
    const name = u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : '');
    return D.loadText(text, name, { kind:'api', url:D.safeUrl(u.toString()) });
  };

  /* ---------- reading values ---------- */
  /* kinds: 'number' = plottable values (numbers that aren't an axis), 'axis' = time-like columns, 'any' = values and categories */
  D.usable = (t, kind = 'number') => {
    const cols = (t || D.current()).cols.filter(c => c.v);
    if (kind === 'axis') return cols.filter(c => c.axis);
    if (kind === 'any') return cols.filter(c => !c.axis);
    const nums = cols.filter(c => c.type === 'number' && !c.axis);
    return nums.length ? nums : cols.filter(c => c.type === 'number' || c.type === 'time');
  };
  /* a column by name, or the i-th usable column when the name is empty or gone. 'axis' falls back to values. */
  D.pick = (name, i = 0, kind = 'number', t) => {
    t = t || D.current();
    if (name && t.byName[name] && t.byName[name].v) return t.byName[name];
    let list = D.usable(t, kind);
    if (!list.length && kind === 'axis') list = D.usable(t, 'number');
    return list.length ? list[((i % list.length) + list.length) % list.length] : null;
  };
  /* longitude and latitude columns, when the table has them */
  D.geo = t => {
    t = t || D.current();
    const f = re => t.cols.find(c => c.v && c.type === 'number' && re.test(c.name.replace(/^.*\./, '')));
    const x = f(/^(lon|lng|long|longitude)$/i), y = f(/^(lat|latitude)$/i);
    return x && y ? { x, y } : null;
  };
  D.at = (col, u) => {
    const v = col.v, n = v.length;
    if (n === 1) return v[0];
    if (col.type === 'category') return v[Math.round(clamp(u) * (n - 1))];
    const x = clamp(u) * (n - 1), i = Math.floor(x), f = x - i;
    return v[i] + (v[Math.min(n - 1, i + 1)] - v[i]) * f;
  };
  D.norm = (col, x) => {
    const lo = D.trim ? col.lo : col.min, hi = D.trim ? col.hi : col.max;
    return clamp((x - lo) / ((hi - lo) || 1));
  };
  D.norm01 = (col, i) => D.norm(col, col.v[i]);
  D.u = g => {
    const m = D.play.mode;
    if (m === 'loop') return g.loop;
    if (m === 'timeline') return clamp(g.p);
    if (m === 'still') return D.play.row;
    return 1 - Math.abs(2 * g.loop - 1);
  };
  /* param values for one instance, with any linked controls replaced by their column */
  D.bind = (m, inst, params, g) => {
    const b = inst.bind; if (!b) return params;
    const t = D.current(), u = D.u(g); let out = null;
    for (const p of m.params){
      const bd = b[p.id]; if (!bd || p.type !== 'range') continue;
      const col = t.byName[bd.col]; if (!col || !col.v) continue;
      let x;
      /* smoothing averages the column across a window of the playhead, so a noisy series doesn't make a control jitter */
      if (bd.smooth > 0){ const k = bd.smooth * .12; let sum = 0; for (let i = -4; i <= 4; i++) sum += D.norm(col, D.at(col, Math.min(1, Math.max(0, u + k * i / 4)))); x = sum / 9; }
      else x = D.norm(col, D.at(col, u));
      if (bd.curve === 1) x = x * x; else if (bd.curve === 2) x = 1 - (1 - x) * (1 - x); else if (bd.curve === 3) x = Math.round(x * 4) / 4;
      if (bd.invert) x = 1 - x;
      const lo = bd.lo != null ? bd.lo : p.min, hi = bd.hi != null ? bd.hi : p.max;
      let v = lo + (hi - lo) * x; if (p.step >= 1) v = Math.round(v);
      out = out || { ...params }; out[p.id] = v;
    }
    return out || params;
  };
  D.boundCount = list => (list || []).reduce((n, i) => n + (i && i.bind ? Object.keys(i.bind).length : 0), 0);

  /* ---------- projects ---------- */
  const round = x => Math.round(x * 1e4) / 1e4;
  D.toProject = () => {
    const out = { play:{ ...D.play }, trim:D.trim };
    const t = D.table; if (!t) return out;
    out.table = { name:t.name, origin:t.origin && t.origin.url ? { ...t.origin, url:D.safeUrl(t.origin.url) } : t.origin, credit:t.credit,
      cols:t.cols.map(c => c.v ? { name:c.name, type:c.type, v:Array.from(c.v, round), ...(c.cats && c.cats.length ? { cats:c.cats } : {}) } : { name:c.name, type:'text' }) };
    return out;
  };
  D.fromProject = o => {
    D.pending = null;
    D.play = Object.assign({ mode:'pingpong', row:.5 }, o && o.play || {});
    D.trim = !!(o && o.trim);
    D.table = null;
    const s = o && o.table;
    if (s && Array.isArray(s.cols) && s.cols.length){
      const cols = s.cols.map(c => c.v ? finishColumn({ name:c.name, type:c.type, v:Float64Array.from(c.v), cats:c.cats || [] }) : { name:c.name, type:'text', v:null, cats:[], min:0, max:1, lo:0, hi:1, gaps:0 });
      cols.forEach(c => { if (c.type === 'category'){ c.min = 0; c.max = Math.max(1, c.cats.length - 1); c.lo = c.min; c.hi = c.max; } });
      const t = { name:s.name, origin:s.origin || { kind:'paste' }, credit:s.credit, cols, rows:cols.find(c => c.v).v.length, byName:{}, sampled:0 };
      cols.forEach(c => { t.byName[c.name] = c; });
      D.table = t;
    }
    changed();
  };
  return D;
})();
