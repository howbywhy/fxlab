/* ---------------- Poster: cut edges, keys and brush marks ----------------
   Pure Canvas 2D helpers for Poster's collage tools. Nothing here knows about
   layers or the document; poster.js decides when they run and caches results.
------------------------------------------------------------------------------ */
const Marks = (() => {
  /* small seeded random, so an edge or a spray looks the same every time it redraws */
  function rng(seed){
    let s = (Math.floor(seed) * 2654435761 >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  /* 1D value noise along the edge: smooth wander plus finer fibres */
  function noise1(r, n){
    const v = Array.from({ length:n + 2 }, () => r());
    return x => { const i = Math.floor(x), f = x - i, t = f * f * (3 - 2 * f); return v[i % (n + 1)] * (1 - t) + v[(i + 1) % (n + 1)] * t; };
  }

  /* points around a rectangle or ellipse w×h, clockwise from the top left */
  function outline(kind, w, h, step){
    const pts = [];
    if (kind === 'ellipse'){
      const n = Math.max(24, Math.round(Math.PI * (w + h) / 2 / step));
      for (let i = 0; i < n; i++){ const a = i / n * Math.PI * 2 - Math.PI / 2; pts.push({ x:w / 2 + Math.cos(a) * w / 2, y:h / 2 + Math.sin(a) * h / 2, nx:-Math.cos(a), ny:-Math.sin(a) }); }
      return pts;
    }
    /* a corner moves in along both sides, or it pokes out past the cut */
    const side = (x0, y0, x1, y1, nx, ny, cx, cy) => { const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / step)); for (let i = 0; i < n; i++){ const t = i / n; pts.push({ x:x0 + (x1 - x0) * t, y:y0 + (y1 - y0) * t, nx:i ? nx : cx, ny:i ? ny : cy }); } };
    side(0, 0, w, 0, 0, 1, 1, 1); side(w, 0, w, h, -1, 0, -1, 1); side(w, h, 0, h, 0, -1, -1, -1); side(0, h, 0, 0, 1, 0, 1, -1);
    return pts;
  }

  /* An edge as a closed path, pushed inward by `depth` px.
     torn: paper ripped by hand, a slow wander with fibres.
     scissors: straight cuts that change angle every few centimetres.
     deckle: a short, even ragged edge, like handmade paper. */
  function edgePath(style, kind, w, h, depth, seed, extra = 0){
    const r = rng(seed), d = Math.max(0, depth);
    if (style === 'scissors'){
      const base = outline(kind, w, h, Math.max(4, (w + h) / 200)), out = [];
      let i = 0;
      while (i < base.length){
        const p = base[i], inset = d * (.15 + r() * .85) - extra;
        out.push({ x:p.x + p.nx * inset, y:p.y + p.ny * inset });
        i += Math.max(1, Math.round((8 + r() * 22) * (base.length / 400)));
      }
      return out;
    }
    const step = style === 'deckle' ? 1.5 : 2;
    const base = outline(kind, w, h, step), n = base.length;
    const slow = noise1(r, 24), fine = noise1(r, 160);
    return base.map((p, i) => {
      const u = i / n;
      let inset;
      if (style === 'deckle') inset = d * (.35 + .65 * fine(u * 160)) * (.6 + .4 * r());
      else inset = d * (.55 * slow(u * 24) + .3 * fine(u * 160) + .15 * r());
      inset -= extra;
      return { x:p.x + p.nx * inset, y:p.y + p.ny * inset };
    });
  }
  function fillPath(ctx, pts){ ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill(); }

  /* make pixels near `hex` transparent; soft is the width of the fade */
  function colourKey(ctx, w, h, hex, tol, soft){
    const [kr, kg, kb] = Util.hexToRgb(hex), img = ctx.getImageData(0, 0, w, h), d = img.data;
    const t0 = tol * 4.42, t1 = t0 + Math.max(1, soft * 4.42);   // 0–100 → 0–442, the RGB diagonal
    for (let i = 0; i < d.length; i += 4){
      const dist = Math.hypot(d[i] - kr, d[i + 1] - kg, d[i + 2] - kb);
      if (dist < t1) d[i + 3] = dist <= t0 ? 0 : d[i + 3] * (dist - t0) / (t1 - t0);
    }
    ctx.putImageData(img, 0, 0);
  }

  /* a solid silhouette `px` wide around whatever is opaque in src: the sticker edge */
  function outlineOf(src, px, hex){
    const pad = Math.ceil(px), c = document.createElement('canvas');
    c.width = src.width + pad * 2; c.height = src.height + pad * 2;
    const x = c.getContext('2d'), n = Math.max(12, Math.min(48, Math.round(px * 1.5)));
    for (let i = 0; i < n; i++){ const a = i / n * Math.PI * 2; x.drawImage(src, pad + Math.cos(a) * px, pad + Math.sin(a) * px); }
    x.drawImage(src, pad, pad);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = hex; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-over'; x.drawImage(src, pad, pad);
    return { canvas:c, pad };
  }

  /* ---------- brushes ----------
     Each brush lays dabs along the stroke. size is the diameter in target px,
     p is pen pressure (1 for a mouse), r a seeded random for the stroke. */
  const BRUSHES = [
    ['round', 'Round'], ['pencil', 'Pencil'], ['charcoal', 'Charcoal'], ['marker', 'Marker'],
    ['spray', 'Spray'], ['ink', 'Ink'], ['stipple', 'Stipple'],
  ];
  const spacing = { round:.12, pencil:.2, charcoal:.18, marker:.08, spray:.35, ink:.06, stipple:.9 };
  function softDot(ctx, x, y, rad, hard, col, a){
    if (hard >= .98){ ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); return; }
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, col); g.addColorStop(Math.max(.01, hard), col); g.addColorStop(1, col.length === 7 ? col + '00' : 'rgba(0,0,0,0)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  function dab(ctx, kind, x, y, size, o, r, angle){
    const rad = Math.max(.5, size / 2), col = o.color, a = o.opacity, hard = o.hardness;
    if (kind === 'round') softDot(ctx, x, y, rad, hard, col, a * .9);
    else if (kind === 'pencil'){
      /* graphite: many tiny grains, denser in the middle */
      ctx.fillStyle = col;
      const n = Math.max(3, Math.round(rad * rad * .9));
      for (let i = 0; i < n; i++){ const t = r() * Math.PI * 2, d = Math.sqrt(r()) * rad; ctx.globalAlpha = a * (.25 + .5 * r()); ctx.fillRect(x + Math.cos(t) * d, y + Math.sin(t) * d, 1, 1); }
    } else if (kind === 'charcoal'){
      ctx.fillStyle = col;
      const n = Math.max(6, Math.round(rad * 2.2));
      for (let i = 0; i < n; i++){
        const t = r() * Math.PI * 2, d = Math.pow(r(), .7) * rad, s = 1 + r() * rad * .35;
        ctx.globalAlpha = a * (.08 + .22 * r()); ctx.fillRect(x + Math.cos(t) * d - s / 2, y + Math.sin(t) * d - s / 2, s, s * (.4 + r()));
      }
    } else if (kind === 'marker'){
      /* a chisel tip held at 30°: wide one way, thin the other */
      ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 6); ctx.globalAlpha = a * .22; ctx.fillStyle = col;
      ctx.fillRect(-rad, -rad * .28, rad * 2, rad * .56); ctx.restore();
    } else if (kind === 'spray'){
      ctx.fillStyle = col;
      const n = Math.max(8, Math.round(rad * 1.6));
      for (let i = 0; i < n; i++){ const t = r() * Math.PI * 2, d = rad * Math.sqrt(-2 * Math.log(1 - r() * .999)) * .45; if (d > rad) continue; ctx.globalAlpha = a * (.3 + .7 * r()); const s = .6 + r() * 1.4; ctx.fillRect(x + Math.cos(t) * d, y + Math.sin(t) * d, s, s); }
    } else if (kind === 'ink'){
      softDot(ctx, x, y, rad, .9, col, a);
    } else if (kind === 'stipple'){
      ctx.fillStyle = col;
      for (let i = 0; i < 3; i++){ const t = r() * Math.PI * 2, d = r() * rad; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x + Math.cos(t) * d, y + Math.sin(t) * d, Math.max(.6, rad * .12 * (.6 + r())), 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  /* A stroke keeps its own state so it can be fed points as the pointer moves. */
  function stroke(ctx, o, seed){
    const r = rng(seed), kind = o.brush || 'round';
    let last = null, carry = 0, speedW = 1;
    return {
      to(x, y, pressure){
        const pr = pressure > 0 && pressure < 1 ? .25 + pressure * .75 : 1;
        let size = o.size * pr;
        if (!last){ dab(ctx, kind, x, y, size, o, r); last = { x, y }; return; }
        const dx = x - last.x, dy = y - last.y, dist = Math.hypot(dx, dy);
        /* ink thins as the pen moves faster */
        if (kind === 'ink'){ speedW = speedW * .8 + .2 * Util.clamp(1.3 - dist / Math.max(4, o.size), .35, 1.2); size *= speedW; }
        const gap = Math.max(.5, size * (spacing[kind] || .15));
        let d = gap - carry;
        while (d <= dist){ const t = d / dist; dab(ctx, kind, last.x + dx * t, last.y + dy * t, size, o, r); d += gap; }
        carry = dist - (d - gap);
        last = { x, y };
      },
    };
  }
  return { rng, edgePath, fillPath, colourKey, outlineOf, stroke, BRUSHES };
})();
