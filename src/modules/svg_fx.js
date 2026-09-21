/* ---------------- Vector effects ----------------
   Canvas 2D effects that read the geometry of an SVG in Image A or B (or a built-in
   sample when neither is an SVG) and redraw it as crisp lines, dots, hatching and so on.
   Raster effects can't do this: these move and restyle the paths themselves.

   Reads: path, line, polyline, polygon, rect, circle, ellipse, with transforms, CSS
   styles, and fill and stroke colours (a gradient fill reads as its first stop).
   Skips, and says so in the module description: text, images, <use> clones, filters,
   masks and clip paths. Convert text to outlines before importing.

   Parsing is async (the file's text is read from a blob) and cached per asset. Until it is
   ready a module draws nothing, then asks for a redraw, so render never blocks or throws.
--------------------------------------------------- */
const SvgFx = (() => {
  const TAU = Math.PI * 2, MAX_PTS = 20000, cache = new Map();
  const SKIP_PARENT = new Set(['defs', 'clipPath', 'mask', 'symbol', 'pattern', 'marker', 'linearGradient', 'radialGradient', 'filter', 'metadata', 'title', 'desc', 'style', 'script', 'foreignObject']);
  const NUM = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/y;

  /* ---------- a small deterministic value noise, 0–1 ---------- */
  const ih = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t);
  function noise(x, y, z = 0){
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(ih(xi, yi, zi), ih(xi + 1, yi, zi), fx), l(ih(xi, yi + 1, zi), ih(xi + 1, yi + 1, zi), fx), fy),
             l(l(ih(xi, yi, zi + 1), ih(xi + 1, yi, zi + 1), fx), l(ih(xi, yi + 1, zi + 1), ih(xi + 1, yi + 1, zi + 1), fx), fy), fz);
  }

  /* ---------- path → polylines ---------- */
  /* d attribute → [{ p:[x,y,…], vi:[anchor point indexes], closed }] in the matrix T's space.
     step is the flattening length in that space. */
  function pathToSubs(d, T, step){
    const subs = [], n = d.length, sc = Math.sqrt(Math.abs(T.a * T.d - T.b * T.c)) || 1;
    let i = 0, cur = null, x = 0, y = 0, sx = 0, sy = 0, lcx = 0, lcy = 0, prev = '', cmd = '';
    const ws = () => { while (i < n && (d.charCodeAt(i) <= 32 || d[i] === ',')) i++; };
    const num = () => { ws(); NUM.lastIndex = i; const m = NUM.exec(d); if (!m) return NaN; i = NUM.lastIndex; return +m[0]; };
    const flag = () => { ws(); const c = d[i]; if (c === '0' || c === '1'){ i++; return +c; } return NaN; };
    const put = (px, py, anchor) => {
      if (!cur){ cur = { p:[], vi:[], closed:false }; subs.push(cur); cur.p.push(T.a * x + T.c * y + T.e, T.b * x + T.d * y + T.f); cur.vi.push(0); }
      cur.p.push(T.a * px + T.c * py + T.e, T.b * px + T.d * py + T.f);
      if (anchor) cur.vi.push(cur.p.length / 2 - 1);
    };
    const count = len => Math.max(3, Math.min(120, Math.ceil(len * sc / step)));
    const cubic = (x1, y1, x2, y2, x3, y3) => {
      const N = count(Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2));
      const x0 = x, y0 = y;
      for (let k = 1; k <= N; k++){
        const t = k / N, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
        put(a * x0 + b * x1 + c * x2 + e * x3, a * y0 + b * y1 + c * y2 + e * y3, k === N);
      }
      lcx = x2; lcy = y2; x = x3; y = y3;
    };
    const quad = (x1, y1, x2, y2) => {
      const N = count(Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1)), x0 = x, y0 = y;
      for (let k = 1; k <= N; k++){ const t = k / N, u = 1 - t; put(u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2, k === N); }
      lcx = x1; lcy = y1; x = x2; y = y2;
    };
    const arc = (rx, ry, phi, fa, fs, x2, y2) => {
      rx = Math.abs(rx); ry = Math.abs(ry);
      if (!rx || !ry || (x2 === x && y2 === y)){ put(x2, y2, true); x = x2; y = y2; return; }
      const r = phi * Math.PI / 180, cp = Math.cos(r), sp = Math.sin(r);
      const dx = (x - x2) / 2, dy = (y - y2) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
      const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
      if (lam > 1){ const q = Math.sqrt(lam); rx *= q; ry *= q; }
      const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p, co = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, (rx * rx * ry * ry - den) / (den || 1)));
      const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx, cx = cp * cxp - sp * cyp + (x + x2) / 2, cy = sp * cxp + cp * cyp + (y + y2) / 2;
      const t1 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
      let dt = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx) - t1;
      if (!fs && dt > 0) dt -= TAU; else if (fs && dt < 0) dt += TAU;
      const N = count(Math.abs(dt) * Math.max(rx, ry));
      for (let k = 1; k <= N; k++){
        const th = t1 + dt * k / N, ex = rx * Math.cos(th), ey = ry * Math.sin(th);
        put(cx + ex * cp - ey * sp, cy + ex * sp + ey * cp, k === N);
      }
      x = x2; y = y2;
    };
    while (true){
      ws(); if (i >= n) break;
      const c = d[i];
      if (/[A-Za-z]/.test(c)){ cmd = c; i++; } else if (!cmd || cmd === 'Z' || cmd === 'z') break;
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
      if (C === 'Z'){
        if (cur){ if (Math.hypot(cur.p[0] - cur.p[cur.p.length - 2], cur.p[1] - cur.p[cur.p.length - 1]) > 1e-9) cur.p.push(cur.p[0], cur.p[1]); cur.closed = true; }
        x = sx; y = sy; cur = null; prev = 'Z'; continue;
      }
      if (C === 'M'){
        const nx = num() + ox, ny = num() + oy; if (isNaN(nx + ny)) break;
        x = sx = nx; y = sy = ny; cur = null;
        /* a lone moveto draws nothing; the start point is added when the next segment does */
        cmd = rel ? 'l' : 'L'; prev = 'M'; continue;
      }
      if (C === 'L'){ const nx = num() + ox, ny = num() + oy; if (isNaN(nx + ny)) break; put(nx, ny, true); x = nx; y = ny; }
      else if (C === 'H'){ const nx = num() + ox; if (isNaN(nx)) break; put(nx, y, true); x = nx; }
      else if (C === 'V'){ const ny = num() + oy; if (isNaN(ny)) break; put(x, ny, true); y = ny; }
      else if (C === 'C'){ const a = [num() + ox, num() + oy, num() + ox, num() + oy, num() + ox, num() + oy]; if (a.some(isNaN)) break; cubic(...a); }
      else if (C === 'S'){
        const a = [num() + ox, num() + oy, num() + ox, num() + oy]; if (a.some(isNaN)) break;
        const smooth = prev === 'C' || prev === 'S';
        cubic(smooth ? 2 * x - lcx : x, smooth ? 2 * y - lcy : y, ...a);
      }
      else if (C === 'Q'){ const a = [num() + ox, num() + oy, num() + ox, num() + oy]; if (a.some(isNaN)) break; quad(...a); }
      else if (C === 'T'){
        const a = [num() + ox, num() + oy]; if (a.some(isNaN)) break;
        const smooth = prev === 'Q' || prev === 'T';
        quad(smooth ? 2 * x - lcx : x, smooth ? 2 * y - lcy : y, ...a);
      }
      else if (C === 'A'){
        const rx = num(), ry = num(), ph = num(), fa = flag(), fs = flag(), nx = num() + ox, ny = num() + oy;
        if ([rx, ry, ph, fa, fs, nx, ny].some(isNaN)) break; arc(rx, ry, ph, fa, fs, nx, ny);
      }
      else break;
      prev = C;
    }
    return subs.filter(s => s.p.length >= 4);
  }

  const len = v => parseFloat(v) || 0;
  /* the outline of a basic shape as path data, so all shapes go through one parser */
  function shapeToD(el){
    const t = el.localName, a = n => len(el.getAttribute(n));
    if (t === 'path') return el.getAttribute('d') || '';
    if (t === 'line') return `M${a('x1')} ${a('y1')}L${a('x2')} ${a('y2')}`;
    if (t === 'polyline' || t === 'polygon'){
      const v = (el.getAttribute('points') || '').match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
      let s = ''; for (let i = 0; i + 1 < v.length; i += 2) s += (i ? 'L' : 'M') + v[i] + ' ' + v[i + 1];
      return s && t === 'polygon' ? s + 'Z' : s;
    }
    if (t === 'rect'){
      const x = a('x'), y = a('y'), w = a('width'), h = a('height'); if (w <= 0 || h <= 0) return '';
      let rx = el.hasAttribute('rx') ? a('rx') : NaN, ry = el.hasAttribute('ry') ? a('ry') : NaN;
      if (isNaN(rx) && isNaN(ry)) rx = ry = 0; else if (isNaN(rx)) rx = ry; else if (isNaN(ry)) ry = rx;
      rx = Math.min(Math.max(rx, 0), w / 2); ry = Math.min(Math.max(ry, 0), h / 2);
      if (!rx || !ry) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
    }
    if (t === 'circle' || t === 'ellipse'){
      const cx = a('cx'), cy = a('cy'), rx = t === 'circle' ? a('r') : a('rx'), ry = t === 'circle' ? rx : a('ry'); if (rx <= 0 || ry <= 0) return '';
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
    }
    return '';
  }

  /* 'rgb(1, 2, 3)' or 'rgba(1, 2, 3, .5)' from getComputedStyle → { hex, a } | null for none */
  function cssColour(v){
    const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?/.exec(v || ''); if (!m) return null;
    const h = '#' + [m[1], m[2], m[3]].map(c => Math.round(+c).toString(16).padStart(2, '0')).join('');
    let al = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
    return { hex:h, a:al };
  }
  /* a paint value: a colour, none, or url(#gradient) read as the gradient's first stop */
  function paint(cs, prop, root){
    const v = cs.getPropertyValue(prop); if (!v || v === 'none') return null;
    const u = /url\(["']?#([^"')]+)["']?\)/.exec(v);
    if (u){
      const g = root.querySelector('[id="' + u[1].replace(/"/g, '') + '"]'), st = g && g.querySelector('stop');
      return st ? cssColour(getComputedStyle(st).getPropertyValue('stop-color')) : null;
    }
    return cssColour(v);
  }

  let host = null;
  function getHost(){
    if (host && host.isConnected) return host;
    host = document.createElement('div'); host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;overflow:hidden;pointer-events:none';
    document.body.append(host); return host;
  }

  /* SVG text → { shapes, vb, art, skipped, count } or throws. Runs in a hidden attached <svg>
     so CSS, inheritance and transforms are resolved by the browser. */
  function parseSvg(text){
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    let root = doc.documentElement;
    if (!root || root.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('Unreadable SVG');
    /* never let a file run script: drop scripts and event handlers before it enters the page */
    root.querySelectorAll('script, foreignObject').forEach(n => n.remove());
    for (const n of [root, ...root.querySelectorAll('*')]) for (const at of [...n.attributes]) if (/^on/i.test(at.name)) n.removeAttribute(at.name);
    root = document.importNode(root, true);
    const vbAttr = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    let vb = vbAttr.length === 4 && vbAttr.every(isFinite) && vbAttr[2] > 0 && vbAttr[3] > 0 ? { x:vbAttr[0], y:vbAttr[1], w:vbAttr[2], h:vbAttr[3] } : null;
    const aw = len(root.getAttribute('width')), ah = len(root.getAttribute('height')), asp = vb ? vb.w / vb.h : (aw && ah ? aw / ah : 1);
    root.setAttribute('width', '1000'); root.setAttribute('height', String(Math.max(1, Math.round(1000 / asp))));
    root.removeAttribute('style');
    const h = getHost(), box = document.createElement('div'); box.append(root); h.append(box);
    try {
      const probe = document.createElementNS('http://www.w3.org/2000/svg', 'g'); root.append(probe);
      const R = probe.getScreenCTM(); probe.remove();
      if (!R) throw new Error('Unreadable SVG');
      const Rinv = R.inverse();
      const skipped = { text:0, image:0, use:0 };
      root.querySelectorAll('text, image, use').forEach(n => { skipped[n.localName]++; });
      const shapes = [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, total = 0;
      const ref = vb ? Math.max(vb.w, vb.h) : 1000, step = ref / 900;
      for (const el of root.querySelectorAll('path, line, polyline, polygon, rect, circle, ellipse')){
        let hidden = false;
        for (let p = el.parentNode; p && p !== root; p = p.parentNode) if (SKIP_PARENT.has(p.localName)){ hidden = true; break; }
        if (hidden) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const M = el.getScreenCTM(); if (!M) continue;
        const rel = Rinv.multiply(M), T = { a:rel.a, b:rel.b, c:rel.c, d:rel.d, e:rel.e, f:rel.f };
        const subs = pathToSubs(shapeToD(el), T, step);
        if (!subs.length) continue;
        const fill = paint(cs, 'fill', root), stroke = paint(cs, 'stroke', root), sc = Math.sqrt(Math.abs(T.a * T.d - T.b * T.c)) || 1;
        const op = Math.min(1, Math.max(0, parseFloat(cs.opacity)));
        const sw = stroke ? Math.max(0, len(cs.strokeWidth)) * sc : 0;
        const shape = { subs:subs.map(s => ({ p:Float32Array.from(s.p), vi:Uint32Array.from(s.vi), closed:s.closed })),
          fill:fill && fill.hex, fa:fill ? fill.a * (parseFloat(cs.fillOpacity) || 0) * (isNaN(op) ? 1 : op) : 0,
          stroke:stroke && stroke.hex, sa:stroke ? stroke.a * (parseFloat(cs.strokeOpacity) || 0) * (isNaN(op) ? 1 : op) : 0, sw, eo:cs.fillRule === 'evenodd' };
        for (const s of shape.subs){ total += s.p.length / 2; for (let i = 0; i < s.p.length; i += 2){ const px = s.p[i], py = s.p[i + 1]; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; } }
        shapes.push(shape);
      }
      if (!isFinite(x0)){ x0 = y0 = 0; x1 = y1 = 1; }
      const art = { x:x0, y:y0, w:Math.max(1e-6, x1 - x0), h:Math.max(1e-6, y1 - y0) };
      if (!vb) vb = { ...art };
      /* a very heavy file: thin every polyline so the effects stay fast */
      if (total > 150000){
        const k = Math.ceil(total / 150000);
        for (const s of shapes) for (const sub of s.subs){
          const q = []; const keep = new Set(sub.vi);
          for (let i = 0, n = sub.p.length / 2; i < n; i++) if (i % k === 0 || i === n - 1 || keep.has(i)) q.push(i);
          const idx = new Map(q.map((v, j) => [v, j])), np = new Float32Array(q.length * 2);
          q.forEach((v, j) => { np[j * 2] = sub.p[v * 2]; np[j * 2 + 1] = sub.p[v * 2 + 1]; });
          sub.vi = Uint32Array.from([...keep].filter(v => idx.has(v)).map(v => idx.get(v))); sub.p = np;
        }
      }
      return { state:'ready', shapes, vb, art, skipped, sample:false };
    } finally { box.remove(); }
  }

  /* ---------- the built-in sample: abstract vector artwork, no type ---------- */
  function sampleSvg(){
    const r = (i, s = 0) => Util.hash(i * 12.9898 + s * 78.233 + 1.13);
    const pal = ['#ff5a36', '#f4b942', '#3b8f8c', '#7b5cff', '#f4efe6'];
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-500 -500 1000 1000">';
    /* nested blobs, closed smooth curves */
    for (let k = 0; k < 8; k++){
      const R = 80 + k * 44, n = 8, P = [];
      for (let i = 0; i < n; i++){ const a = i / n * TAU + k * .35, q = R * (1 + (r(i, k) - .5) * .2); P.push([Math.cos(a) * q, Math.sin(a) * q * .86]); }
      let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
      for (let i = 0; i < n; i++){
        const p0 = P[(i + n - 1) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
        d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      s += `<path d="${d}Z" fill="${k % 3 === 0 ? pal[k % 4] : 'none'}" fill-opacity=".5" stroke="${pal[(k + 1) % 5]}" stroke-width="${2 + (k % 3)}"/>`;
    }
    /* ribbons: cubic flows across the frame */
    for (let k = 0; k < 5; k++){
      const y = -300 + k * 150, a = (r(k, 3) - .5) * 260, b = (r(k, 4) - .5) * 260;
      s += `<path d="M-460 ${y}C-240 ${y + a} -120 ${y + b} 40 ${y - a * .4}S320 ${y + b} 460 ${y - 40}" fill="none" stroke="${pal[k % 5]}" stroke-width="3"/>`;
    }
    /* arcs */
    for (let k = 0; k < 4; k++){ const R2 = 150 + k * 52; s += `<path d="M${-R2} 0A${R2} ${R2} 0 0 1 ${R2 * .5} ${-R2 * .866}" fill="none" stroke="${pal[(k + 2) % 5]}" stroke-width="6" transform="rotate(${k * 38} 0 0)"/>`; }
    /* shards and dots */
    s += '<polygon points="230,-380 420,-300 340,-140 250,-190" fill="#7b5cff" fill-opacity=".6" stroke="#f4efe6" stroke-width="2"/>';
    s += '<polygon points="-420,240 -300,180 -230,330 -380,400" fill="#3b8f8c" fill-opacity=".6" stroke="#f4efe6" stroke-width="2"/>';
    s += '<rect x="-60" y="-60" width="120" height="120" rx="18" fill="none" stroke="#ff5a36" stroke-width="4" transform="rotate(28) translate(230 -20)"/>';
    s += '<circle cx="-330" cy="-330" r="60" fill="#f4b942" fill-opacity=".7" stroke="none"/><circle cx="360" cy="330" r="34" fill="none" stroke="#f4efe6" stroke-width="3"/><ellipse cx="-90" cy="420" rx="110" ry="34" fill="none" stroke="#ff5a36" stroke-width="3"/>';
    return s + '</svg>';
  }

  /* the record for the vector a module should draw: an SVG asset, or the sample.
     null means "not ready yet, draw nothing". */
  function geometry(P){
    const want = P.src | 0, svgOf = k => { const id = state.sources[k].asset, a = id && Assets.get(id); return a && a.mime === 'image/svg+xml' ? a : null; };
    let a = null;
    if (want === 1) a = svgOf('A'); else if (want === 2) a = svgOf('B'); else if (want === 0) a = svgOf('A') || svgOf('B');
    if (a){
      let rec = cache.get(a.id);
      if (!rec){
        rec = { state:'loading' }; cache.set(a.id, rec);
        a.blob.text().then(t => { try { Object.assign(rec, parseSvg(t)); } catch (e){ rec.state = 'fail'; rec.error = String(e.message || e); } typeof markDirty === 'function' && markDirty(); })
          .catch(e => { rec.state = 'fail'; rec.error = String(e); });
      }
      if (rec.state === 'ready') return rec;
      if (rec.state === 'loading') return null;
    }
    let rec = cache.get('sample');
    if (!rec){ try { rec = parseSvg(sampleSvg()); rec.sample = true; } catch (e){ rec = { state:'fail', error:String(e) }; } cache.set('sample', rec); }
    return rec.state === 'ready' ? rec : null;
  }

  /* ---------- geometry mapped into the frame ---------- */
  /* Common controls, placed last in each module. */
  const srcParams = () => [ S('src', 'Vector from', ['Auto', 'Image A', 'Image B', 'Sample'], 0), S('fit', 'Fit to', ['Artboard', 'Artwork'], 0),
    R('margin', 'Margin', .1, 0, .4), R('scale', 'Scale', 1, .2, 4, .01), R('x', 'X', 0, -1, 1), R('y', 'Y', 0, -1, 1) ];
  const inkParams = (ink = 'ink', acc = 'accent') => [ C('c1', 'Ink', '#f4efe6', ink), C('c2', 'Accent', '#ff5a36', acc) ];
  const colourModes = ['Ink', 'Accent', 'Original colours', 'Ink to accent', 'From palette'];

  /* Geometry in frame pixels. Returns null until the vector is ready.
     Coordinates are in the full frame (print exports draw in tiles of it), so the
     result is identical whichever tile is being drawn. */
  function scene(api, P){
    const g = geometry(P); if (!g) return null;
    const { w, h } = api, box = (P.fit | 0) === 1 ? g.art : g.vb, avail = Math.max(.05, 1 - 2 * P.margin);
    const s = Math.min(w * avail / box.w, h * avail / box.h) * P.scale;
    const ox = w / 2 + P.x * w / 2 - (box.x + box.w / 2) * s, oy = h / 2 - P.y * h / 2 - (box.y + box.h / 2) * s;
    let total = 0, points = 0;
    const shapes = g.shapes.map((sh, i) => {
      const subs = sh.subs.map(sub => {
        const n = sub.p.length / 2, p = new Float32Array(n * 2); let L = 0;
        for (let j = 0; j < n; j++){ p[j * 2] = sub.p[j * 2] * s + ox; p[j * 2 + 1] = sub.p[j * 2 + 1] * s + oy; if (j) L += Math.hypot(p[j * 2] - p[j * 2 - 2], p[j * 2 + 1] - p[j * 2 - 1]); }
        total += L; points += n;
        return { p, vi:sub.vi, closed:sub.closed, len:L };
      });
      return { subs, fill:sh.fill, fa:sh.fa, stroke:sh.stroke, sa:sh.sa, sw:sh.sw * s, eo:sh.eo, i, len:subs.reduce((a, b) => a + b.len, 0) };
    });
    return { shapes, s, total, points, unit:Math.min(w, h) / 1000, box:{ x:box.x * s + ox, y:box.y * s + oy, w:box.w * s, h:box.h * s }, cx:w / 2 + P.x * w / 2, cy:h / 2 - P.y * h / 2, sample:g.sample, skipped:g.skipped };
  }

  /* marks every `step` px along a polyline, the first `first` px in: fn(x, y, tx, ty, s, k) with
     the tangent and the distance travelled. Callers derive `first` from frac(phase) * step, so
     a whole-cycle march lands back where it began. */
  function walk(sub, step, first, fn){
    const p = sub.p, n = p.length / 2; let acc = first, s = 0, k = 0;
    if (!(step > 1e-6)) return;
    for (let i = 1; i < n; i++){
      const ax = p[i * 2 - 2], ay = p[i * 2 - 1], bx = p[i * 2], by = p[i * 2 + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      if (L < 1e-9) continue;
      const tx = dx / L, ty = dy / L;
      let d = acc;
      while (d <= L){ fn(ax + tx * d, ay + ty * d, tx, ty, s + d, k++); d += step; }
      acc = d - L; s += L;
    }
  }
  /* a new polyline sampled evenly at `step`; ends and closure are kept */
  function resample(sub, step){
    const out = [];
    const p = sub.p, n = p.length / 2;
    if (n < 2) return { p:new Float32Array(p), closed:sub.closed, len:0 };
    out.push(p[0], p[1]);
    walk(sub, step, step, (x, y) => out.push(x, y));
    const lx = p[n * 2 - 2], ly = p[n * 2 - 1];
    if (Math.hypot(out[out.length - 2] - lx, out[out.length - 1] - ly) > step * .01) out.push(lx, ly);
    return { p:Float32Array.from(out), closed:sub.closed, len:sub.len };
  }
  /* a step in px no smaller than `want`, and large enough that the whole drawing stays under `max` points */
  const stepFor = (sc, want, max = MAX_PTS) => Math.max(want, sc.total / max);

  /* a Path2D of the shapes' polylines */
  function pathOf(shape, sc, into){
    const path = into || new Path2D();
    for (const sub of shape.subs){
      const p = sub.p, n = p.length / 2; if (n < 2) continue;
      path.moveTo(p[0], p[1]);
      for (let i = 1; i < n; i++) path.lineTo(p[i * 2], p[i * 2 + 1]);
      if (sub.closed) path.closePath();
    }
    return path;
  }
  function lineTo(ctx, p, close){
    const n = p.length / 2; if (n < 2) return;
    ctx.moveTo(p[0], p[1]);
    for (let i = 1; i < n; i++) ctx.lineTo(p[i * 2], p[i * 2 + 1]);
    if (close) ctx.closePath();
  }

  /* colour for a shape under a `colour` mode (see colourModes) */
  function colourOf(P, sh, n){
    switch (P.colour | 0){
      case 1: return P.c2;
      case 2: return sh.stroke || sh.fill || P.c1;
      case 3: return Sketch.mixHex(P.c1, P.c2, n > 1 ? sh.i / (n - 1) : 0);
      case 4: return Sketch.paletteColor(sh.i, 7, sh.i % 2 ? P.c2 : P.c1);
      default: return P.c1;
    }
  }
  const luma = hex => { const c = Util.hexToRgb(hex); return (c[0] * .299 + c[1] * .587 + c[2] * .114) / 255; };
  const frac = x => x - Math.floor(x);
  const wt = (P, sc, k = 'weight') => Math.max(.5, P[k] * sc.unit * 1.6);

  return { TAU, noise, parseSvg, geometry, scene, walk, resample, stepFor, pathOf, lineTo, colourOf, luma, frac, wt, srcParams, inkParams, colourModes, cache, sampleSvg };
})();

/* Every vector effect starts the same way: lay the ground, find the drawing. */
const svgBegin = (ctx, api) => {
  Sketch.ground(ctx, api);
  const sc = SvgFx.scene(api, api.params);
  if (sc){ ctx.lineJoin = ctx.lineCap = 'round'; }
  return sc;
};
const SVG_NOTE = ' Reads paths and basic shapes from an SVG in Image A or B, or a sample; text, images, filters and use clones are skipped.';
const SVG_GROUND = () => Sketch.groundParams(1, '#141516').map(p => p.type === 'color' ? { ...p, role:'ground' } : p);

/* ---- Vector outline ---- */
FX.register({ id:'fx-svg-lines', name:'Vector outline', cat:'fx', kind:'2d', search:['svg', 'vector', 'outline', 'stroke', 'plotter'],
  desc:'Redraws an SVG as clean lines of one weight, in one colour or its own. Fill tints the closed shapes.' + SVG_NOTE,
  params:[ R('weight', 'Line weight', 2.5, .3, 16, .1), S('colour', 'Colour', SvgFx.colourModes, 0), R('fill', 'Fill', 0, 0, 1), S('join', 'Corners', ['Round', 'Sharp'], 0), ...SvgFx.inkParams(), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    ctx.lineWidth = SvgFx.wt(P, sc); ctx.lineJoin = (P.join | 0) ? 'miter' : 'round'; ctx.lineCap = (P.join | 0) ? 'butt' : 'round';
    for (const sh of sc.shapes){
      const col = SvgFx.colourOf(P, sh, sc.shapes.length), path = SvgFx.pathOf(sh, sc);
      if (P.fill > 0){ ctx.globalAlpha = P.fill * (P.colour == 2 ? Math.max(.25, sh.fa) : 1); ctx.fillStyle = (P.colour | 0) === 2 ? (sh.fill || col) : col; ctx.fill(path, sh.eo ? 'evenodd' : 'nonzero'); }
      ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.stroke(path);
    }
  } });

/* ---- Hand-drawn ---- */
FX.register({ id:'fx-svg-hand', name:'Hand-drawn vector', cat:'fx', kind:'2d', search:['svg', 'vector', 'sketch', 'pen', 'wobble'],
  desc:'Wobbles an SVG like a pen drawing: uneven lines, doubled strokes, and pressure that lifts at the ends.' + SVG_NOTE,
  params:[ R('weight', 'Line weight', 2.5, .3, 12, .1), R('wobble', 'Wobble', 6, 0, 24, .1), R('size', 'Wobble size', 70, 10, 300, 1), I('passes', 'Strokes per line', 2, 1, 4), R('spread', 'Stroke spread', 1, 0, 3, .05),
    R('taper', 'Pressure', .6, 0, 1), I('boil', 'Redraws per loop', 0, 0, 12), S('colour', 'Colour', SvgFx.colourModes, 0), ...SvgFx.inkParams(), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const passes = P.passes | 0, u = sc.unit, step = SvgFx.stepFor(sc, 5 * u, 20000 / passes), amp = P.wobble * u * 2, f = 1 / (P.size * u), boil = P.boil | 0;
    const seed = boil ? Math.floor(api.loop * boil) % boil : 0, base = SvgFx.wt(P, sc);
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const sh of sc.shapes){
      ctx.strokeStyle = SvgFx.colourOf(P, sh, sc.shapes.length);
      for (let k = 0; k < passes; k++){
        const z = seed * 3.7 + k * 11.3 + sh.i * .61;
        for (const sub of sh.subs){
          const rs = SvgFx.resample(sub, step), p = rs.p, n = p.length / 2; if (n < 2) continue;
          const q = new Float32Array(p.length);
          for (let i = 0; i < n; i++){
            const x = p[i * 2], y = p[i * 2 + 1];
            q[i * 2] = x + (SvgFx.noise(x * f, y * f, z) - .5) * amp * (1 + k * P.spread * .5) + (k ? (SvgFx.noise(x * f * 3, y * f * 3, z + 5) - .5) * u * P.spread * 2 : 0);
            q[i * 2 + 1] = y + (SvgFx.noise(x * f + 31.4, y * f + 17.7, z) - .5) * amp * (1 + k * P.spread * .5) + (k ? (SvgFx.noise(x * f * 3 + 9, y * f * 3, z + 5) - .5) * u * P.spread * 2 : 0);
          }
          /* draw in short chunks so the width can follow the pen pressure along the line */
          const chunk = 6, base2 = base * (k ? .8 : 1);
          for (let i = 0; i < n - 1; i += chunk){
            const e = Math.min(n - 1, i + chunk), um = (i + e) / 2 / (n - 1);
            const pr = 1 - P.taper + P.taper * Math.pow(Math.sin(Math.PI * um), .55);
            ctx.lineWidth = Math.max(.4, base2 * (.35 + .65 * pr));
            ctx.beginPath(); ctx.moveTo(q[i * 2], q[i * 2 + 1]);
            for (let j = i + 1; j <= e; j++) ctx.lineTo(q[j * 2], q[j * 2 + 1]);
            ctx.stroke();
          }
        }
      }
    }
  } });

/* ---- Draw-on ---- */
FX.register({ id:'fx-svg-drawon', name:'Vector draw-on', cat:'fx', kind:'2d', search:['svg', 'vector', 'reveal', 'animate', 'stroke'],
  desc:'Draws an SVG on stroke by stroke over the timeline, or sends a bright segment chasing along the lines.' + SVG_NOTE,
  params:[ S('drive', 'Driven by', ['Timeline', 'Loop (draw, then erase)'], 0), S('style', 'Style', ['Draw on', 'Chase'], 0), R('weight', 'Line weight', 3, .3, 14, .1), R('stagger', 'Stagger', .6, 0, .95), R('trail', 'Chase length', .25, .02, 1),
    T('head', 'Dot at the pen', true), S('colour', 'Colour', SvgFx.colourModes, 0), ...SvgFx.inkParams(), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const n = sc.shapes.length, chase = (P.style | 0) === 1, loopMode = (P.drive | 0) === 1, st = P.stagger, trail = P.trail;
    ctx.lineWidth = SvgFx.wt(P, sc);
    const loc = (v, i) => Math.min(1, Math.max(0, (v - st * i / Math.max(1, n)) / (1 - st + 1e-6)));
    sc.shapes.forEach(sh => {
      if (sh.len < 1e-6) return;
      let a, b;   /* visible span of the shape's length, 0–1 */
      if (chase){
        const hd = loopMode ? SvgFx.frac(api.loop - st * sh.i / Math.max(1, n)) * (1 + trail) : api.p * (1 + trail + st) - st * sh.i / Math.max(1, n);
        b = Math.min(1, Math.max(0, hd)); a = Math.min(1, Math.max(0, hd - trail));
      } else if (loopMode){
        const q = api.loop; a = q < .5 ? 0 : loc((q - .5) * 2, sh.i); b = q < .5 ? loc(q * 2, sh.i) : 1;
      } else { a = 0; b = loc(api.p, sh.i); }
      if (b - a < 1e-4) return;
      const col = SvgFx.colourOf(P, sh, n); ctx.strokeStyle = col; ctx.fillStyle = col;
      let s0 = a * sh.len, s1 = b * sh.len, at = 0, tip = null;
      ctx.beginPath();
      for (const sub of sh.subs){
        const p = sub.p, m = p.length / 2;
        for (let i = 1; i < m; i++){
          const ax = p[i * 2 - 2], ay = p[i * 2 - 1], bx = p[i * 2], by = p[i * 2 + 1], L = Math.hypot(bx - ax, by - ay), e = at + L;
          if (e > s0 && at < s1 && L > 1e-9){
            const t0 = Math.max(0, (s0 - at) / L), t1 = Math.min(1, (s1 - at) / L);
            ctx.moveTo(ax + (bx - ax) * t0, ay + (by - ay) * t0); ctx.lineTo(ax + (bx - ax) * t1, ay + (by - ay) * t1);
            tip = [ax + (bx - ax) * t1, ay + (by - ay) * t1];
          }
          at = e;
        }
      }
      ctx.stroke();
      if (P.head && tip && b < .9999 && b > 0){ ctx.beginPath(); ctx.arc(tip[0], tip[1], ctx.lineWidth * 1.4, 0, SvgFx.TAU); ctx.fill(); }
    });
  } });

/* ---- Dots and stipple ---- */
FX.register({ id:'fx-svg-dots', name:'Vector dots', cat:'fx', kind:'2d', search:['svg', 'vector', 'stipple', 'dots', 'halftone'],
  desc:'Turns the lines of an SVG into rows of dots, or scatters stipple along and inside the shapes.' + SVG_NOTE,
  params:[ S('style', 'Style', ['Dots', 'Stipple', 'Stipple with fill'], 0), R('spacing', 'Spacing', 14, 3, 60, .5), R('size', 'Dot size', 4.5, .5, 14, .1), R('vary', 'Size variation', .3, 0, 1), R('swell', 'Swell', .4, 0, 1), I('march', 'Marching cycles', 1, 0, 4),
    S('colour', 'Colour', SvgFx.colourModes, 0), ...SvgFx.inkParams(), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const u = sc.unit, style = P.style | 0, step = SvgFx.stepFor(sc, P.spacing * u, style ? 7000 : 15000), r0 = P.size * u, cyc = P.march | 0, ph = api.loop * cyc;
    const n = sc.shapes.length;
    sc.shapes.forEach(sh => {
      ctx.fillStyle = SvgFx.colourOf(P, sh, n);
      ctx.beginPath();
      if (!style){
        for (const sub of sh.subs) SvgFx.walk(sub, step, SvgFx.frac(ph) * step, (x, y, tx, ty, s, k) => {
          /* size follows the position along the line, so marching dots slide through a fixed pattern and a whole cycle closes the loop */
          const wave = 1 + P.swell * Math.sin(SvgFx.TAU * s / (step * 8)),
            r = Math.max(.3, r0 * wave * (1 - P.vary * SvgFx.noise(s / step * .37, sh.i, 1)));
          ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, SvgFx.TAU);
        });
      } else {
        for (const sub of sh.subs) SvgFx.walk(sub, step * .5, 0, (x, y, tx, ty, s, k) => {
          const j = (SvgFx.noise(k * .91, sh.i, 2) - .5) * 2 * step * .9, j2 = (SvgFx.noise(k * .53, sh.i, 3) - .5) * 2 * step * .35;
          const r = Math.max(.3, r0 * (.35 + .9 * SvgFx.noise(k * 1.7, sh.i, 4)));
          ctx.moveTo(x - ty * j + tx * j2 + r, y + tx * j + ty * j2); ctx.arc(x - ty * j + tx * j2, y + tx * j + ty * j2, r, 0, SvgFx.TAU);
        });
        if (style === 2 && sh.subs.some(s => s.closed)){
          const path = SvgFx.pathOf(sh, sc); let xs = Infinity, ys = Infinity, xe = -Infinity, ye = -Infinity;
          for (const sub of sh.subs) for (let i = 0; i < sub.p.length; i += 2){ xs = Math.min(xs, sub.p[i]); xe = Math.max(xe, sub.p[i]); ys = Math.min(ys, sub.p[i + 1]); ye = Math.max(ye, sub.p[i + 1]); }
          const cell = Math.max(step * .8, Math.sqrt((xe - xs) * (ye - ys) / 2500)); let k = 0;
          for (let y = ys; y < ye; y += cell) for (let x = xs; x < xe; x += cell){
            const jx = x + SvgFx.noise(k, 1, 5) * cell, jy = y + SvgFx.noise(k, 2, 5) * cell; k++;
            if (!ctx.isPointInPath(path, jx, jy, sh.eo ? 'evenodd' : 'nonzero')) continue;
            const r = Math.max(.3, r0 * (.3 + .7 * SvgFx.noise(k * 1.3, 3, 5)));
            ctx.moveTo(jx + r, jy); ctx.arc(jx, jy, r, 0, SvgFx.TAU);
          }
        }
      }
      ctx.fill();
    });
  } });

/* ---- Stitch ---- */
FX.register({ id:'fx-svg-stitch', name:'Vector stitch', cat:'fx', kind:'2d', search:['svg', 'vector', 'dashed', 'thread', 'embroidery', 'stitch'],
  desc:'Sews an SVG: a dashed running stitch, a double row, or small cross stitches along every line.' + SVG_NOTE,
  params:[ S('style', 'Stitch', ['Running', 'Double row', 'Cross'], 0), R('dash', 'Stitch length', 12, 2, 50, .5), R('gap', 'Gap', 8, 1, 40, .5), R('weight', 'Thread', 2.5, .5, 10, .1), R('row', 'Row spacing', 7, 2, 24, .5), I('march', 'Marching cycles', 0, 0, 4),
    S('colour', 'Colour', SvgFx.colourModes, 0), ...SvgFx.inkParams(), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const u = sc.unit, style = P.style | 0, dash = Math.max(1.5, P.dash * u), gap = Math.max(1, P.gap * u), per = dash + gap, off = api.loop * (P.march | 0) * per, n = sc.shapes.length;
    ctx.lineWidth = SvgFx.wt(P, sc); ctx.lineCap = 'round';
    sc.shapes.forEach(sh => {
      ctx.strokeStyle = SvgFx.colourOf(P, sh, n);
      if (style === 2){
        const r = Math.max(1.5, P.dash * u * .3), cs = Math.max(per * .7, SvgFx.stepFor(sc, per * .7, 6000)); ctx.beginPath();
        for (const sub of sh.subs) SvgFx.walk(sub, cs, SvgFx.frac(api.loop * (P.march | 0)) * cs, (x, y, tx, ty) => {
          const ax = (tx - ty) * r, ay = (ty + tx) * r, bx = (tx + ty) * r, by = (ty - tx) * r;
          ctx.moveTo(x - ax, y - ay); ctx.lineTo(x + ax, y + ay); ctx.moveTo(x - bx, y - by); ctx.lineTo(x + bx, y + by);
        });
        ctx.stroke(); return;
      }
      ctx.setLineDash([dash, gap]);
      for (let row = 0; row < (style ? 2 : 1); row++){
        ctx.lineDashOffset = -off + row * per / 2; ctx.beginPath();
        const d = style ? (row ? 1 : -1) * P.row * u / 2 : 0;
        for (const sub of sh.subs){
          const p = sub.p, m = p.length / 2; if (m < 2) continue;
          if (!d){ SvgFx.lineTo(ctx, p, false); continue; }
          /* a parallel row: shift each point along the averaged normal of its two segments */
          const q = new Float32Array(p.length);
          for (let i = 0; i < m; i++){
            const a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1); let tx = p[b * 2] - p[a * 2], ty = p[b * 2 + 1] - p[a * 2 + 1]; const L = Math.hypot(tx, ty) || 1;
            q[i * 2] = p[i * 2] - ty / L * d; q[i * 2 + 1] = p[i * 2 + 1] + tx / L * d;
          }
          SvgFx.lineTo(ctx, q, false);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    });
  } });

/* ---- Echo ---- */
FX.register({ id:'fx-svg-echo', name:'Vector echo', cat:'fx', kind:'2d', search:['svg', 'vector', 'repeat', 'trail', 'offset', 'echo'],
  desc:'Stacks copies of an SVG that step in scale, offset and rotation, with a colour ramp from front to back.' + SVG_NOTE,
  params:[ I('copies', 'Copies', 7, 1, 30), R('step', 'Scale step', .035, -.15, .3, .005), R('dx', 'Offset X', 9, -60, 60, .5), R('dy', 'Offset Y', 5, -60, 60, .5), R('rot', 'Rotation step', 1.5, -20, 20, .1),
    R('fade', 'Fade', .6, 0, 1), R('weight', 'Line weight', 1.6, .3, 10, .1), I('sway', 'Sway cycles', 1, 0, 4), T('front', 'Keep the original in front', true), S('colour', 'Colour', ['Ramp', 'Original colours'], 0),
    C('c1', 'Front', '#f4efe6', 'ink'), C('c2', 'Back', '#ff5a36', 'accent'), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const N = P.copies | 0, u = sc.unit, ang = api.loop * (P.sway | 0) * SvgFx.TAU, sway = (P.sway | 0) ? Math.cos(ang) : 1, swy = (P.sway | 0) ? Math.sin(ang) : 1;
    const paths = sc.shapes.map(sh => SvgFx.pathOf(sh, sc)), lw = SvgFx.wt(P, sc), orig = (P.colour | 0) === 1;
    for (let k = N - 1; k >= 0; k--){
      const t = N > 1 ? k / (N - 1) : 0, z = 1 + k * P.step;
      ctx.save();
      ctx.translate(sc.cx + k * P.dx * u * sway, sc.cy + k * P.dy * u * swy); ctx.rotate(k * P.rot * Math.PI / 180 * (P.sway | 0 ? sway : 1)); ctx.scale(z, z); ctx.translate(-sc.cx, -sc.cy);
      ctx.lineWidth = lw / Math.max(.05, z); ctx.globalAlpha = 1 - P.fade * t; ctx.lineJoin = ctx.lineCap = 'round';
      if (!orig) ctx.strokeStyle = Sketch.mixHex(P.c1, P.c2, t);
      sc.shapes.forEach((sh, i) => { if (orig) ctx.strokeStyle = sh.stroke || sh.fill || P.c1; ctx.stroke(paths[i]); });
      ctx.restore();
    }
    if (P.front){
      ctx.globalAlpha = 1; ctx.lineWidth = lw; ctx.strokeStyle = P.c1;
      sc.shapes.forEach((sh, i) => { if (orig) ctx.strokeStyle = sh.stroke || sh.fill || P.c1; ctx.stroke(paths[i]); });
    }
  } });

/* ---- Vector distort ---- */
FX.register({ id:'fx-svg-warp', name:'Vector distort', cat:'fx', kind:'2d', search:['svg', 'vector', 'warp', 'distort', 'twist', 'wave', 'bend'],
  desc:'Bends the paths of an SVG with noise, waves, a twist, a bulge or ripples. The lines stay crisp at any size.' + SVG_NOTE,
  params:[ S('warp', 'Distortion', ['Noise', 'Wave', 'Twist', 'Bulge', 'Ripple'], 0), R('amount', 'Amount', .5, 0, 1), R('size', 'Size', .5, .1, 2), I('motion', 'Motion cycles', 1, 0, 4), R('weight', 'Line weight', 2.5, .3, 12, .1), R('fill', 'Fill', 0, 0, 1),
    S('colour', 'Colour', SvgFx.colourModes, 0), ...SvgFx.inkParams(), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const u = sc.unit, mode = P.warp | 0, R0 = Math.min(api.w, api.h) / 2, ph = api.loop * (P.motion | 0) * SvgFx.TAU, moving = (P.motion | 0) > 0;
    const A = P.amount * R0 * .22, fq = 1 / (P.size * R0 * .8), amt = P.amount, step = SvgFx.stepFor(sc, 4 * u, 20000);
    const cx = sc.cx, cy = sc.cy, nz = SvgFx.noise, cz = Math.cos(ph) * 1.2, sz = Math.sin(ph) * 1.2, k = moving ? Math.sin(ph) : 1;
    const warp = (x, y) => {
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy), rr = r / R0;
      if (mode === 0){ return [x + (nz(x * fq + cz, y * fq + sz, 0) - .5) * 2 * A, y + (nz(x * fq + 17 + sz, y * fq - cz, 1) - .5) * 2 * A]; }
      if (mode === 1){ return [x + Math.sin(y * fq * 6 + ph) * A * .6, y + Math.sin(x * fq * 4.8 + ph + 1.3) * A * .3]; }
      if (mode === 2){ const a = amt * 3.2 * k * Math.max(0, 1 - rr / (1.4 * (P.size + .3))), c = Math.cos(a), s = Math.sin(a); return [cx + dx * c - dy * s, cy + dx * s + dy * c]; }
      if (mode === 3){ const z = 1 + amt * .9 * k * Math.pow(Math.max(0, 1 - rr / (1.3 * (P.size + .3))), 2); return [cx + dx * z, cy + dy * z]; }
      const o = Math.sin(r * fq * 9 - ph) * A * .5 / (1 + rr * .5), q = r || 1; return [x + dx / q * o, y + dy / q * o];
    };
    const n = sc.shapes.length; ctx.lineWidth = SvgFx.wt(P, sc);
    for (const sh of sc.shapes){
      const col = SvgFx.colourOf(P, sh, n), path = new Path2D();
      for (const sub of sh.subs){
        const rs = SvgFx.resample(sub, step), p = rs.p, m = p.length / 2; if (m < 2) continue;
        for (let i = 0; i < m; i++){ const q = warp(p[i * 2], p[i * 2 + 1]); i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1]); }
        if (sub.closed) path.closePath();
      }
      if (P.fill > 0){ ctx.globalAlpha = P.fill; ctx.fillStyle = (P.colour | 0) === 2 ? (sh.fill || col) : col; ctx.fill(path, sh.eo ? 'evenodd' : 'nonzero'); ctx.globalAlpha = 1; }
      ctx.strokeStyle = col; ctx.stroke(path);
    }
  } });

/* ---- Blueprint plotter ---- */
FX.register({ id:'fx-svg-plotter', name:'Plotter drawing', cat:'fx', kind:'2d', search:['svg', 'vector', 'plotter', 'blueprint', 'hatch', 'technical', 'nodes'],
  desc:'A pen-plotter reading of an SVG: fine lines, dots at every anchor point, and hatching inside filled shapes, darker fills hatched tighter.' + SVG_NOTE,
  params:[ R('weight', 'Line weight', 1.1, .3, 5, .05), T('nodes', 'Anchor points', true), S('nodeStyle', 'Point style', ['Dot', 'Ring', 'Cross'], 1), R('nodeSize', 'Point size', 3.5, 1, 12, .1),
    R('hatch', 'Hatch spacing', 9, 0, 40, .5), R('angle', 'Hatch angle', 45, 0, 180, 1), S('hatchOn', 'Hatch', ['Filled shapes', 'All closed shapes'], 0), T('tone', 'Tighter on darker fills', true), R('grid', 'Grid', 0, 0, 1), T('marks', 'Corner marks', true),
    ...SvgFx.inkParams('ink', 'accent'), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const u = sc.unit, lw = SvgFx.wt(P, sc), bx = sc.box;
    if (P.grid > 0){
      ctx.save(); ctx.globalAlpha = .18 + P.grid * .4; ctx.strokeStyle = P.c2; ctx.lineWidth = Math.max(.5, u); ctx.beginPath();
      const g = Math.max(12 * u, bx.w / 24);
      for (let x = bx.x; x <= bx.x + bx.w + 1; x += g){ ctx.moveTo(x, bx.y); ctx.lineTo(x, bx.y + bx.h); }
      for (let y = bx.y; y <= bx.y + bx.h + 1; y += g){ ctx.moveTo(bx.x, y); ctx.lineTo(bx.x + bx.w, y); }
      ctx.stroke(); ctx.restore();
    }
    if (P.marks){
      const m = 16 * u; ctx.save(); ctx.strokeStyle = P.c2; ctx.lineWidth = Math.max(.6, lw * .8); ctx.beginPath();
      for (const [x, y, sx, sy] of [[bx.x, bx.y, 1, 1], [bx.x + bx.w, bx.y, -1, 1], [bx.x, bx.y + bx.h, 1, -1], [bx.x + bx.w, bx.y + bx.h, -1, -1]]){ ctx.moveTo(x - sx * m * .3, y); ctx.lineTo(x + sx * m, y); ctx.moveTo(x, y - sy * m * .3); ctx.lineTo(x, y + sy * m); }
      ctx.stroke(); ctx.restore();
    }
    /* hatching first, so the outline and points sit on top */
    if (P.hatch > 0){
      ctx.save(); ctx.strokeStyle = P.c2; ctx.lineWidth = Math.max(.5, lw * .7);
      let budget = 9000;
      for (const sh of sc.shapes){
        if (!sh.subs.some(s => s.closed)) continue;
        if ((P.hatchOn | 0) === 0 && !(sh.fill && sh.fa > .05)) continue;
        const path = SvgFx.pathOf(sh, sc);
        let xs = Infinity, ys = Infinity, xe = -Infinity, ye = -Infinity;
        for (const sub of sh.subs) for (let i = 0; i < sub.p.length; i += 2){ xs = Math.min(xs, sub.p[i]); xe = Math.max(xe, sub.p[i]); ys = Math.min(ys, sub.p[i + 1]); ye = Math.max(ye, sub.p[i + 1]); }
        const lum = sh.fill ? SvgFx.luma(sh.fill) : .5;
        let sp = P.hatch * u * (P.tone ? .55 + lum * .9 : 1);
        const cxm = (xs + xe) / 2, cym = (ys + ye) / 2, rad = Math.hypot(xe - xs, ye - ys) / 2;
        sp = Math.max(sp, rad * 2 / 600);
        const dirs = [P.angle]; if (P.tone && lum < .28) dirs.push(P.angle + 90);
        ctx.save(); ctx.clip(path, sh.eo ? 'evenodd' : 'nonzero'); ctx.beginPath();
        for (const dgr of dirs){
          const a = dgr * Math.PI / 180, tx = Math.cos(a), ty = Math.sin(a);
          for (let o = -rad; o <= rad; o += sp){
            const px = cxm - ty * o, py = cym + tx * o;
            ctx.moveTo(px - tx * rad, py - ty * rad); ctx.lineTo(px + tx * rad, py + ty * rad); budget--;
          }
        }
        ctx.stroke(); ctx.restore();
        if (budget <= 0) break;
      }
      ctx.restore();
    }
    ctx.strokeStyle = P.c1; ctx.lineWidth = lw; ctx.lineJoin = 'round';
    for (const sh of sc.shapes){ ctx.beginPath(); for (const sub of sh.subs) SvgFx.lineTo(ctx, sub.p, false); ctx.stroke(); }
    if (P.nodes){
      const r = P.nodeSize * u, st = P.nodeStyle | 0; let left = 6000;
      ctx.lineWidth = Math.max(.6, lw * .9); ctx.fillStyle = P.c2; ctx.strokeStyle = P.c2; ctx.beginPath();
      for (const sh of sc.shapes) for (const sub of sh.subs) for (const i of sub.vi){
        if (left-- <= 0) break;
        const x = sub.p[i * 2], y = sub.p[i * 2 + 1];
        if (st === 2){ ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); }
        else { ctx.moveTo(x + r * (st ? 1 : .6), y); ctx.arc(x, y, r * (st ? 1 : .6), 0, SvgFx.TAU); }
      }
      st === 0 ? ctx.fill() : ctx.stroke();
    }
  } });
