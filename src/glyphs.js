/* ---------------- Glyphs: outlines from any font ----------------
   Renders each glyph once at high resolution, traces its outline with
   marching squares (sub-pixel interpolated), simplifies it, and caches it.
   Works with system fonts, your asset fonts and variable fonts alike.

   Glyphs.layout(ctx, P, text, size, { tracking, weight })
     → { glyphs:[{ ch, x, w, contours:[[x,y,x,y…],…] }], width, cap, asc, desc }
       contour coordinates are in pixels relative to the glyph origin on the baseline.
   Glyphs.resample(pts, n), Glyphs.area(pts), Glyphs.centroid(pts), Glyphs.path(contours, dx, dy)
   Glyphs.axes(P) → { wght:bool, wdth:bool } whether the font really varies
------------------------------------------------------------------ */
const Glyphs = (() => {
  const G = {};
  const RES = 200;
  const cache = new Map();
  const cv = document.createElement('canvas');
  const cx = cv.getContext('2d', { willReadFrequently:true });

  function trace(alpha, W, H){
    const PW = W + 2, PH = H + 2, val = new Float32Array(PW * PH);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) val[(y + 1) * PW + x + 1] = alpha[y * W + x] / 255;
    const v = (x, y) => val[(y + 1) * PW + x + 1];
    const GW = W + 1, GH = H + 1;               /* cells span -1..W-1 so edges close */
    const visited = new Uint8Array((GW + 1) * (GH + 1) * 2);
    const key = (e, cxl, cyl) => {             /* e: 0 T,1 R,2 B,3 L of cell (cxl, cyl) with cells offset by 1 */
      const x = cxl + 1, y = cyl + 1;
      if (e === 0) return (y * (GW + 1) + x) * 2;
      if (e === 2) return ((y + 1) * (GW + 1) + x) * 2;
      if (e === 3) return (y * (GW + 1) + x) * 2 + 1;
      return (y * (GW + 1) + x + 1) * 2 + 1;
    };
    const corners = (x, y) => [v(x, y), v(x + 1, y), v(x + 1, y + 1), v(x, y + 1)];
    const caseOf = c => (c[0] >= .5 ? 8 : 0) | (c[1] >= .5 ? 4 : 0) | (c[2] >= .5 ? 2 : 0) | (c[3] >= .5 ? 1 : 0);
    const segs = (cs, c) => {
      switch (cs){
        case 1: case 14: return [[3, 2]];
        case 2: case 13: return [[2, 1]];
        case 3: case 12: return [[3, 1]];
        case 4: case 11: return [[0, 1]];
        case 6: case 9: return [[0, 2]];
        case 7: case 8: return [[3, 0]];
        case 5: return (c[0] + c[1] + c[2] + c[3]) / 4 >= .5 ? [[3, 0], [1, 2]] : [[0, 1], [3, 2]];
        case 10: return (c[0] + c[1] + c[2] + c[3]) / 4 >= .5 ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]];
        default: return [];
      }
    };
    const lerp = (a, b) => { const d = b - a; return Math.abs(d) < 1e-6 ? .5 : Util.clamp((.5 - a) / d); };
    const point = (e, x, y, c) => {
      if (e === 0) return [x + lerp(c[0], c[1]), y];
      if (e === 1) return [x + 1, y + lerp(c[1], c[2])];
      if (e === 2) return [x + lerp(c[3], c[2]), y + 1];
      return [x, y + lerp(c[0], c[3])];
    };
    const step = [[0, -1], [1, 0], [0, 1], [-1, 0]], opp = [2, 3, 0, 1];
    const contours = [];
    for (let y = -1; y < H; y++){
      const r0 = (y + 1) * PW, r1 = r0 + PW;
      for (let x = -1; x < W; x++){
      const i0 = x + 1, q = (val[r0 + i0] >= .5) + (val[r0 + i0 + 1] >= .5) + (val[r1 + i0 + 1] >= .5) + (val[r1 + i0] >= .5);
      if (q === 0 || q === 4) continue;
      const c0 = corners(x, y), cs0 = caseOf(c0);
      for (const [a0] of segs(cs0, c0)){
        if (visited[key(a0, x, y)]) continue;
        const pts = []; let cxl = x, cyl = y, entry = a0; const startKey = key(a0, x, y);
        for (let guard = 0; guard < 200000; guard++){
          const c = corners(cxl, cyl), s = segs(caseOf(c), c).find(sg => sg[0] === entry || sg[1] === entry);
          if (!s) break;
          visited[key(entry, cxl, cyl)] = 1;
          const exit = s[0] === entry ? s[1] : s[0];
          const p = point(exit, cxl, cyl, c); pts.push(p[0], p[1]);
          const k2 = key(exit, cxl, cyl);
          visited[k2] = 1;
          if (k2 === startKey) break;
          cxl += step[exit][0]; cyl += step[exit][1]; entry = opp[exit];
          if (cxl < -1 || cyl < -1 || cxl >= W || cyl >= H) break;
        }
        if (pts.length >= 8) contours.push(pts);
      }
      }
    }
    return contours;
  }
  /* Ramer–Douglas–Peucker on a closed polyline */
  function simplify(pts, eps){
    const n = pts.length / 2; if (n < 8) return pts;
    const keep = new Uint8Array(n); keep[0] = 1; keep[n >> 1] = 1;
    const rec = (a, b) => {
      const ax = pts[a * 2], ay = pts[a * 2 + 1], bx = pts[(b % n) * 2], by = pts[(b % n) * 2 + 1];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-6;
      let md = -1, mi = -1;
      for (let i = a + 1; i < b; i++){ const px = pts[i * 2], py = pts[i * 2 + 1]; const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len; if (d > md){ md = d; mi = i; } }
      if (md > eps){ keep[mi] = 1; rec(a, mi); rec(mi, b); }
    };
    rec(0, n >> 1); rec(n >> 1, n);
    const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
    return out;
  }
  function glyph(family, weight, ch){
    const k = family + '|' + weight + '|' + ch;
    let g = cache.get(k); if (g) return g;
    cx.font = `${weight} ${RES}px ${family}`;
    const m = cx.measureText(ch);
    const left = Math.ceil(m.actualBoundingBoxLeft || 0) + 3, right = Math.ceil(m.actualBoundingBoxRight || m.width) + 3;
    const asc = Math.ceil(m.actualBoundingBoxAscent || RES) + 3, desc = Math.ceil(m.actualBoundingBoxDescent || 0) + 3;
    const W = Math.max(4, left + right), H = Math.max(4, asc + desc);
    g = { contours:[], adv:m.width / RES };
    if (!/\s/.test(ch) && W < 4 * RES && H < 4 * RES){
      cv.width = W; cv.height = H; cx.clearRect(0, 0, W, H); cx.font = `${weight} ${RES}px ${family}`; cx.fillStyle = '#000'; cx.textBaseline = 'alphabetic';
      cx.fillText(ch, left, asc);
      const d = cx.getImageData(0, 0, W, H).data, a = new Uint8Array(W * H);
      for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
      g.contours = trace(a, W, H).map(c => { const s = simplify(c, .35), o = new Float32Array(s.length); for (let i = 0; i < s.length; i += 2){ o[i] = (s[i] + .5 - left) / RES; o[i + 1] = (s[i + 1] + .5 - asc) / RES; } return o; })
        .filter(c => Math.abs(G.area(c)) > 5e-5);
    }
    cache.set(k, g); if (cache.size > 800) cache.delete(cache.keys().next().value);
    return g;
  }

  G.layout = (ctx, P, text, size, o = {}) => {
    const weight = o.weight ?? (Util.weights[P.weight | 0] || 400), family = Util.family(P);
    ctx.font = `${weight} ${size}px ${family}`;
    const L = KT.layout(ctx, text, { font:ctx.font, size, tracking:o.tracking || 0 });
    const M = KT.metrics(ctx, size);
    const lines = L.lines.map(ln => ({ width:ln.width, glyphs:ln.glyphs.map(gl => {
      const gg = glyph(family, weight, gl.ch);
      return { ch:gl.ch, x:gl.x, w:gl.w, space:gl.space, word:gl.word, contours:gg.contours.map(c => { const o2 = new Float32Array(c.length); for (let i = 0; i < c.length; i++) o2[i] = c[i] * size; return o2; }) };
    }) }));
    return { lines, maxWidth:L.maxWidth, cap:M.cap, asc:M.asc, desc:M.desc };
  };
  G.area = pts => { let a = 0; const n = pts.length; for (let i = 0; i < n; i += 2){ const j = (i + 2) % n; a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1]; } return a / 2; };
  G.centroid = pts => { let x = 0, y = 0; const n = pts.length / 2; for (let i = 0; i < pts.length; i += 2){ x += pts[i]; y += pts[i + 1]; } return [x / n, y / n]; };
  G.length = pts => { let l = 0; const n = pts.length; for (let i = 0; i < n; i += 2){ const j = (i + 2) % n; l += Math.hypot(pts[j] - pts[i], pts[j + 1] - pts[i + 1]); } return l; };
  /* n points evenly spaced by arc length around a closed contour */
  G.resample = (pts, n) => {
    const out = new Float32Array(n * 2), total = G.length(pts), m = pts.length;
    if (total <= 0 || m < 4){ for (let i = 0; i < n * 2; i += 2){ out[i] = pts[0] || 0; out[i + 1] = pts[1] || 0; } return out; }
    const step = total / n; let seg = 0, acc = 0, i0 = 0;
    for (let k = 0; k < n; k++){
      const target = k * step;
      while (true){
        const j = (i0 + 2) % m; seg = Math.hypot(pts[j] - pts[i0], pts[j + 1] - pts[i0 + 1]);
        if (acc + seg >= target || i0 >= m - 2){ const t = seg > 0 ? (target - acc) / seg : 0; out[k * 2] = pts[i0] + (pts[j] - pts[i0]) * t; out[k * 2 + 1] = pts[i0 + 1] + (pts[j + 1] - pts[i0 + 1]) * t; break; }
        acc += seg; i0 += 2;
      }
    }
    return out;
  };
  G.path = (contours, dx = 0, dy = 0) => {
    const p = new Path2D();
    for (const c of contours){ if (c.length < 4) continue; p.moveTo(c[0] + dx, c[1] + dy); for (let i = 2; i < c.length; i += 2) p.lineTo(c[i] + dx, c[i + 1] + dy); p.closePath(); }
    return p;
  };
  /* smooth 2D value noise */
  G.noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  };
  /* does this font actually change with weight / width? (tests by rendering) */
  const axesCache = new Map();
  G.axes = P => {
    const fam = Util.family(P); if (axesCache.has(fam)) return axesCache.get(fam);
    const c = document.createElement('canvas'); c.width = 400; c.height = 90; const x = c.getContext('2d', { willReadFrequently:true });
    const ink = (font, stretch) => { x.clearRect(0, 0, 400, 90); x.font = font; if ('fontStretch' in x) x.fontStretch = stretch || 'normal'; x.fillText('HONH', 4, 72); const w = x.measureText('HONH').width; const d = x.getImageData(0, 0, 400, 90).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++; if ('fontStretch' in x) x.fontStretch = 'normal'; return [n, w]; };
    const lo = ink(`300 72px ${fam}`), hi = ink(`500 72px ${fam}`), cond = ink(`400 72px ${fam}`, 'condensed'), norm = ink(`400 72px ${fam}`);
    const r = { wght:hi[0] > lo[0] * 1.08, wdth:Math.abs(cond[1] - norm[1]) > norm[1] * .03 };
    if (document.fonts && [...document.fonts].some(f => fam.includes(f.family) && f.status !== 'loaded')) return r;
    axesCache.set(fam, r); return r;
  };
  G.clearAxes = () => axesCache.clear();
  return G;
})();
