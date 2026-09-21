/* ---------------- Vector effects, part two ----------------
   More Canvas 2D effects on the geometry SvgFx reads from an SVG in Image A or B (or the
   built-in sample). Same shared controls as the first set (Vector from, Fit, Margin, Scale,
   X, Y, ground) and the same limits: paths and basic shapes only.

   Every animated control counts whole cycles of the project loop, so exports loop cleanly.
   Everything is drawn in whole-frame coordinates, so print tiles match; fx-svg-mask copies
   the incoming frame and so is marked nonLocal.
--------------------------------------------------------- */
const Sv2 = (() => {
  const TAU = SvgFx.TAU, frac = SvgFx.frac, nz = SvgFx.noise;
  const hs = (i, s = 0) => Util.hash(i * 12.9898 + s * 78.233 + 1.13);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const rule = sh => sh.eo ? 'evenodd' : 'nonzero';
  const isClosed = sh => sh.subs.some(s => s.closed);
  const isFilled = sh => !!sh.fill && sh.fa > .05;
  /* colours arrive as '#rrggbb' or as the 'rgb(…)' strings Sketch.mixHex returns, so read both */
  const rgbOf = c => { const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(c); return m ? [+m[1], +m[2], +m[3]] : Util.hexToRgb(c); };
  const mix = (a, b, t) => { const A = rgbOf(a), B = rgbOf(b), k = clamp(t); return `rgb(${[0, 1, 2].map(i => Math.round(A[i] * (1 - k) + B[i] * k)).join(',')})`; };
  /* value noise sits close to .5: stretch it so marks and dashes vary visibly */
  const nzs = (x, y, z) => clamp((nz(x, y, z) - .5) * 1.9 + .5);

  function bounds(sh){
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const sub of sh.subs) for (let i = 0; i < sub.p.length; i += 2){ const x = sub.p[i], y = sub.p[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1, cx:(x0 + x1) / 2, cy:(y0 + y1) / 2, w:x1 - x0, h:y1 - y0 };
  }
  /* closed shapes repeat their first point at the end; the ring is one shorter */
  function ringN(p, closed){
    let n = p.length / 2;
    if (closed && n > 2 && Math.hypot(p[0] - p[n * 2 - 2], p[1] - p[n * 2 - 1]) < 1e-6) n--;
    return n;
  }
  /* unit normals, scaled to keep the offset distance at corners (mitre, capped) */
  function normals(p, closed){
    const N = p.length / 2, n = ringN(p, closed), o = new Float32Array(N * 2);
    const seg = (i, j) => { const dx = p[j * 2] - p[i * 2], dy = p[j * 2 + 1] - p[i * 2 + 1], L = Math.hypot(dx, dy); return L < 1e-9 ? null : [dy / L, -dx / L]; };
    for (let i = 0; i < n; i++){
      const a = closed ? (i + n - 1) % n : i - 1, b = closed ? (i + 1) % n : i + 1;
      let n1 = a >= 0 ? seg(a, i) : null, n2 = b < n ? seg(i, b) : null;
      if (!n1) n1 = n2;
      if (!n2) n2 = n1;
      if (!n1) continue;
      let mx = n1[0] + n2[0], my = n1[1] + n2[1], L = Math.hypot(mx, my);
      if (L < 1e-6){ mx = n1[0]; my = n1[1]; L = 1; }
      mx /= L; my /= L;
      const s = Math.min(2.2, 1 / Math.max(.45, mx * n1[0] + my * n1[1]));
      o[i * 2] = mx * s; o[i * 2 + 1] = my * s;
    }
    if (closed && N > n){ o[(N - 1) * 2] = o[0]; o[(N - 1) * 2 + 1] = o[1]; }
    return o;
  }
  const offsetPts = (p, nr, d) => { const q = new Float32Array(p.length); for (let i = 0; i < p.length; i++) q[i] = p[i] + nr[i] * d; return q; };
  /* +1 when the normals of this closed line point away from its shape's fill, -1 when into it */
  function outward(ctx, path, sh, p, nr, probe){
    const n = p.length / 2; let best = 1, bl = -1;
    for (let i = 1; i < n; i++){ const L = Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1]); if (L > bl){ bl = L; best = i; } }
    const i = best, j = best - 1, mx = (p[i * 2] + p[j * 2]) / 2, my = (p[i * 2 + 1] + p[j * 2 + 1]) / 2;
    const nx = (nr[i * 2] + nr[j * 2]) / 2, ny = (nr[i * 2 + 1] + nr[j * 2 + 1]) / 2;
    return ctx.isPointInPath(path, mx + nx * probe, my + ny * probe, rule(sh)) ? -1 : 1;
  }
  const cumLen = p => { const n = p.length / 2, c = new Float32Array(n); for (let i = 1; i < n; i++) c[i] = c[i - 1] + Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1]); return c; };
  /* position and tangent at arc length s along a polyline with cumulative lengths c */
  function at(p, c, s){
    const n = c.length; let lo = 1, hi = n - 1;
    s = clamp(s, 0, c[n - 1]);
    while (lo < hi){ const m = (lo + hi) >> 1; if (c[m] < s) lo = m + 1; else hi = m; }
    const i = lo, L = c[i] - c[i - 1] || 1, t = (s - c[i - 1]) / L, ax = p[i * 2 - 2], ay = p[i * 2 - 1], bx = p[i * 2], by = p[i * 2 + 1], d = Math.hypot(bx - ax, by - ay) || 1;
    return [ax + (bx - ax) * t, ay + (by - ay) * t, (bx - ax) / d, (by - ay) / d];
  }
  /* colour for filling a shape: its own fill under 'Original colours', else the module's mode */
  const fillCol = (P, sh, n) => (P.colour | 0) === 2 ? (sh.fill || sh.stroke || P.c1) : SvgFx.colourOf(P, sh, n);
  /* the ground decides whether glows add light or the colour just sits on top */
  const darkGround = P => (P.ground | 0) === 1 ? SvgFx.luma(P.bg) < .5 : true;
  const wtu = (P, sc, k = 'weight') => Math.max(.5, P[k] * sc.unit * 1.6);
  /* shapes grouped by colour, so effects that redraw many times use a handful of paths */
  function groups(sc, colFn, only){
    const m = new Map();
    for (const sh of sc.shapes){
      if (only && !only(sh)) continue;
      const col = colFn(sh), key = col + (sh.eo ? '|e' : ''); let g = m.get(key);
      if (!g){ g = { col, eo:sh.eo, path:new Path2D() }; m.set(key, g); }
      SvgFx.pathOf(sh, sc, g.path);
    }
    return [...m.values()];
  }
  return { TAU, frac, nz, nzs, hs, clamp, rule, isClosed, isFilled, mix, bounds, ringN, normals, offsetPts, outward, cumLen, at, fillCol, darkGround, wtu, groups };
})();

/* ---- Fill patterns ---- */
FX.register({ id:'fx-svg-fill', name:'Vector fill patterns', cat:'fx', kind:'2d', search:['svg', 'vector', 'hatch', 'crosshatch', 'halftone', 'stipple', 'pattern', 'fill', 'engraving'],
  desc:'Fills the closed shapes of an SVG with hatching, waves, dots, halftone or stipple. The marks follow the tone of each fill, and can fade across each shape.' + SVG_NOTE,
  params:[ S('style', 'Pattern', ['Hatch', 'Cross-hatch', 'Waves', 'Dot grid', 'Halftone', 'Stipple'], 0), R('spacing', 'Spacing', 11, 3, 60, .5), R('angle', 'Angle', 40, 0, 180, 1), R('weight', 'Mark weight', 1.5, .3, 8, .1),
    R('tone', 'Tone from fill', .8, 0, 1), R('across', 'Fade across shape', .35, 0, 1), R('under', 'Fill underneath', .25, 0, 1), R('outline', 'Outline', 1.5, 0, 8, .1), T('hide', 'Hide what is behind', true),
    S('shapes', 'Shapes', ['Filled shapes', 'All closed shapes'], 0), I('drift', 'Drift cycles', 1, 0, 4), S('colour', 'Colour', SvgFx.colourModes, 0), ...SvgFx.inkParams(), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const u = sc.unit, style = P.style | 0, n = sc.shapes.length, lw = Math.max(.4, P.weight * u * 1.4), a = P.angle * Math.PI / 180, tx = Math.cos(a), ty = Math.sin(a), nx = -ty, ny = tx;
    const todo = sc.shapes.filter(sh => Sv2.isClosed(sh) && ((P.shapes | 0) === 1 || Sv2.isFilled(sh)));
    let area = 0; for (const sh of todo){ const b = Sv2.bounds(sh); area += b.w * b.h; }
    /* keep the number of marks bounded: widen the spacing on a busy drawing */
    const cell = Math.max(P.spacing * u, Math.sqrt(area * 2 / (style === 5 ? 14000 : style >= 3 ? 26000 : 9000)) || 0), ph = Sv2.frac(api.loop * (P.drift | 0));
    ctx.lineCap = 'round';
    for (const sh of todo){
      const b = Sv2.bounds(sh), col = Sv2.fillCol(P, sh, n), path = SvgFx.pathOf(sh, sc), lum = sh.fill ? SvgFx.luma(sh.fill) : .45;
      /* marks lighter than the ground read as light, so denser marks should mean a lighter fill; the reverse for dark marks */
      const lighter = SvgFx.luma(col) > ((P.ground | 0) === 1 ? SvgFx.luma(P.bg) : .3), tone = lighter ? lum : 1 - lum;
      const d0 = Sv2.clamp(.5 + (tone - .45) * 1.8 * P.tone), rad = Math.hypot(b.w, b.h) / 2 + 1;
      /* position across the shape along the pattern's normal: 0 at one side, 1 at the other */
      const proj = (x, y) => Sv2.clamp(((x - b.cx) * nx + (y - b.cy) * ny) / (2 * rad) + .5);
      const dens = (x, y) => Sv2.clamp(d0 * (1 - P.across) + P.across * (1 - proj(x, y)) * Math.min(1, d0 * 1.6 + .3));
      if (P.hide){ ctx.fillStyle = P.bg; ctx.fill(path, Sv2.rule(sh)); }
      if (P.under > 0){ ctx.globalAlpha = P.under * ((P.colour | 0) === 2 ? Math.max(.3, sh.fa) : .6); ctx.fillStyle = col; ctx.fill(path, Sv2.rule(sh)); ctx.globalAlpha = 1; }
      ctx.save(); ctx.clip(path, Sv2.rule(sh)); ctx.strokeStyle = col; ctx.fillStyle = col;
      if (style <= 2){
        /* line families: one line per step across the normal; weight follows the local tone */
        for (let f = 0; f < (style === 1 ? 2 : 1); f++){
          const ang = a + f * Math.PI / 2, ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux;
          const sp = Math.max(cell * (f ? 1.15 : 1) * (1.8 - 1.3 * d0), rad * 2 / 500);
          for (let o = -rad + (ph - 1) * sp; o <= rad + sp; o += sp){
            const px = b.cx + vx * o, py = b.cy + vy * o, g = dens(px, py);
            /* the second family only comes in on the darker parts */
            const w = lw * (.25 + 1.5 * g) * (f ? Sv2.clamp((g - .35) * 2.2) : 1); if (w < .25) continue;
            ctx.lineWidth = w; ctx.beginPath();
            if (style === 2){
              const amp = sp * .35, wl = sp * 2.6, m = Math.max(8, Math.ceil(rad * 2 / (wl / 6)));
              for (let k = 0; k <= m; k++){ const s = -rad + k / m * rad * 2, off = Math.sin(s / wl * Sv2.TAU + o / sp * .9) * amp, X = px + ux * s + vx * off, Y = py + uy * s + vy * off; k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
            } else { ctx.moveTo(px - ux * rad, py - uy * rad); ctx.lineTo(px + ux * rad, py + uy * rad); }
            ctx.stroke();
          }
        }
      } else if (style <= 4){
        /* a rotated grid of dots; halftone dots grow with density until they touch */
        ctx.beginPath();
        for (let j = -rad; j <= rad; j += cell) for (let i = -rad - cell; i <= rad + cell; i += cell){
          const gx = b.cx + tx * (i + ph * cell) + nx * j, gy = b.cy + ty * (i + ph * cell) + ny * j;
          if (gx < b.x0 - cell || gx > b.x1 + cell || gy < b.y0 - cell || gy > b.y1 + cell) continue;
          const g = dens(gx, gy), r = style === 4 ? cell * .62 * Math.sqrt(g) : Math.max(.3, P.weight * u * (.5 + g * 1.6));
          if (r < .4) continue; ctx.moveTo(gx + r, gy); ctx.arc(gx, gy, r, 0, Sv2.TAU);
        }
        ctx.fill();
      } else {
        /* stipple: jittered points kept with a probability that follows the density */
        ctx.beginPath(); const c2 = cell * .55; let k = 0;
        for (let y = b.y0; y < b.y1; y += c2) for (let x = b.x0; x < b.x1; x += c2){
          const jx = x + Sv2.hs(k, sh.i) * c2, jy = y + Sv2.hs(k, sh.i + 50) * c2; k++;
          if (Sv2.hs(k, sh.i + 9) > dens(jx, jy) * 1.15) continue;
          const r = Math.max(.35, P.weight * u * (.45 + Sv2.hs(k, 4) * .9)); ctx.moveTo(jx + r, jy); ctx.arc(jx, jy, r, 0, Sv2.TAU);
        }
        ctx.fill();
      }
      ctx.restore();
    }
    if (P.outline > 0){
      ctx.lineWidth = Math.max(.4, P.outline * u * 1.4); ctx.lineJoin = 'round';
      for (const sh of todo){ ctx.strokeStyle = SvgFx.colourOf(P, sh, n); ctx.stroke(SvgFx.pathOf(sh, sc)); }
    }
  } });

/* ---- Offset contours ---- */
FX.register({ id:'fx-svg-contour', name:'Vector contours', cat:'fx', kind:'2d', search:['svg', 'vector', 'offset', 'inset', 'outline', 'ripple', 'topographic', 'contour', 'echo'],
  desc:'Repeats the outline of each shape growing outwards or shrinking inwards, like ripples or a contour map. They can drift outwards on the loop.' + SVG_NOTE,
  params:[ S('dir', 'Direction', ['Outwards', 'Inwards', 'Both'], 0), S('style', 'Style', ['Lines', 'Bands'], 0), I('rings', 'Rings', 6, 1, 24), R('gap', 'Gap', 11, 2, 60, .5), R('weight', 'Line weight', 1.4, .3, 8, .1), R('fade', 'Fade', .7, 0, 1),
    I('flow', 'Drift cycles', 1, 0, 4), R('outline', 'Original outline', 1.8, 0, 8, .1), S('colour', 'Colour', ['Ink to accent', 'Ink', 'Accent', 'Original colours'], 0), ...SvgFx.inkParams(), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const u = sc.unit, N = P.rings | 0, gap = P.gap * u, flow = P.flow | 0, phase = flow ? Sv2.frac(api.loop * flow) : 1, dir = P.dir | 0, bands = (P.style | 0) === 1, cm = P.colour | 0;
    const step = SvgFx.stepFor(sc, 3.5 * u, 14000 / Math.max(1, N * (dir === 2 ? 2 : 1)));
    const colOf = (sh, t) => cm === 1 ? P.c1 : cm === 2 ? P.c2 : cm === 3 ? (sh.stroke || sh.fill || P.c1) : Sketch.mixHex(P.c1, P.c2, t);
    const count = flow ? N + 1 : N, sides = dir === 2 ? [1, -1] : dir === 1 ? [-1] : [1];
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const sh of sc.shapes){
      const path = SvgFx.pathOf(sh, sc), closed = Sv2.isClosed(sh), subs = sh.subs.map(sub => {
        const rs = SvgFx.resample(sub, step), nr = Sv2.normals(rs.p, sub.closed);
        return { p:rs.p, nr, closed:sub.closed, out:sub.closed ? Sv2.outward(ctx, path, sh, rs.p, nr, 1.5 * u + 1) : 1 };
      });
      for (const side of sides){
        /* outward rings are kept outside the shape and inward rings inside it, so tight curves do not tangle */
        ctx.save();
        if (closed){
          if (side > 0){ const clip = new Path2D(); clip.rect(-1e5, -1e5, 2e5, 2e5); clip.addPath(path); ctx.clip(clip, 'evenodd'); }
          else ctx.clip(path, Sv2.rule(sh));
        }
        ctx.lineWidth = Sv2.wtu(P, sc);
        for (let k = count; k >= 1; k--){
          const dist = (k - 1 + phase) * gap; if (flow && dist < 1e-3) continue;
          const t = Sv2.clamp(dist / (N * gap)), env = flow ? Math.min(1, dist / gap) * (1 - t * P.fade) : 1 - (k - 1) / Math.max(1, N) * P.fade;
          if (env <= .01 || dist > N * gap * 1.0001) continue;
          /* bands are solid and fade into the ground colour; lines fade by opacity */
          ctx.globalAlpha = bands ? 1 : env; ctx.strokeStyle = ctx.fillStyle = bands ? Sv2.mix(colOf(sh, t), P.bg, (1 - env) * .9) : colOf(sh, t);
          ctx.beginPath();
          for (const s of subs) SvgFx.lineTo(ctx, Sv2.offsetPts(s.p, s.nr, dist * side * s.out), s.closed);
          bands && closed ? ctx.fill(Sv2.rule(sh)) : ctx.stroke();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (P.outline > 0){ ctx.lineWidth = Math.max(.5, P.outline * u * 1.6); ctx.strokeStyle = cm === 2 ? P.c2 : cm === 3 ? (sh.stroke || sh.fill || P.c1) : P.c1; ctx.stroke(path); }
    }
  } });

/* ---- Extrude ---- */
FX.register({ id:'fx-svg-extrude', name:'Vector extrude', cat:'fx', kind:'2d', search:['svg', 'vector', 'extrude', 'depth', '3d', 'isometric', 'shadow', 'long shadow'],
  desc:'Pushes the filled shapes of an SVG back into space: solid sides, a long shadow or stepped layers. The direction can turn or rock over the loop.' + SVG_NOTE,
  params:[ S('style', 'Style', ['Solid sides', 'Long shadow', 'Stepped layers'], 0), R('depth', 'Depth', 70, 4, 300, 1), R('angle', 'Direction', 135, 0, 360, 1), R('shade', 'Side shading', .55, 0, 1), S('drive', 'Motion', ['Still', 'Turn', 'Rock', 'Breathe'], 2), I('cycles', 'Motion cycles', 1, 1, 4),
    R('weight', 'Line weight', 2, .3, 10, .1), S('on', 'Extrude', ['Filled shapes', 'All closed shapes and lines'], 0), S('colour', 'Colour', SvgFx.colourModes, 2), ...SvgFx.inkParams(), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const u = sc.unit, n = sc.shapes.length, style = P.style | 0, drive = P.drive | 0, cyc = Math.max(1, P.cycles | 0), a0 = api.loop * cyc * Sv2.TAU;
    let ang = P.angle, depth = P.depth * u;
    if (drive === 1) ang += 360 * Sv2.frac(api.loop * cyc); else if (drive === 2) ang += Math.sin(a0) * 28; else if (drive === 3) depth *= .55 + .45 * (Math.cos(a0) * .5 + .5);
    const a = ang * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), lw = Sv2.wtu(P, sc), steps = style === 2 ? Math.min(14, Math.max(3, Math.round(depth / (9 * u)))) : Math.min(90, Math.max(4, Math.round(depth / (1.1 * u))));
    const dark = (P.ground | 0) === 1 ? P.bg : '#000000', everything = (P.on | 0) === 1;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    /* painter's order: shapes later in the file sit in front */
    for (const sh of sc.shapes){
      const path = SvgFx.pathOf(sh, sc), top = Sv2.fillCol(P, sh, n), sw = Math.max(lw, (sh.sw || 0) * .5), closed = Sv2.isClosed(sh), solid = closed && (Sv2.isFilled(sh) || everything);
      const lifts = solid || (everything && !closed);
      if (lifts){
        const stepLen = depth / steps;
        for (let k = steps; k >= 1; k--){
          const t = k / steps, side = style === 1 ? Sv2.mix(Sv2.mix(top, dark, P.shade * .9), dark, t * .9) : Sv2.mix(top, dark, P.shade * (.35 + .65 * t));
          ctx.save(); ctx.translate(dx * t * depth, dy * t * depth); ctx.fillStyle = ctx.strokeStyle = side;
          if (solid) ctx.fill(path, Sv2.rule(sh));
          ctx.lineWidth = style === 2 ? sw * .8 : Math.max(sw, stepLen * 1.5); ctx.stroke(path); ctx.restore();
        }
      }
      if (solid){ ctx.fillStyle = top; ctx.fill(path, Sv2.rule(sh)); }
      ctx.strokeStyle = solid ? ((P.colour | 0) === 2 ? (sh.stroke || Sv2.mix(top, '#ffffff', .25)) : SvgFx.colourOf(P, sh, n)) : top; ctx.lineWidth = sw; ctx.stroke(path);
    }
  } });

/* ---- Neon ---- */
FX.register({ id:'fx-svg-neon', name:'Vector neon', cat:'fx', kind:'2d', search:['svg', 'vector', 'neon', 'glow', 'tube', 'light', 'sign'],
  desc:'Lights the paths of an SVG like neon tubes with a soft glow. Best on a dark ground; flicker and breaks loop cleanly.' + SVG_NOTE,
  params:[ R('weight', 'Tube weight', 3.5, .5, 14, .1), R('glow', 'Glow size', 26, 2, 90, .5), R('power', 'Glow strength', .7, 0, 1.5, .01), R('core', 'White core', .55, 0, 1), R('flicker', 'Flicker', .25, 0, 1), I('flickerRate', 'Flickers per loop', 6, 1, 16),
    R('breaks', 'Tube breaks', 0, 0, .8), I('travel', 'Break travel cycles', 1, 0, 4), S('colour', 'Colour', SvgFx.colourModes, 4), ...SvgFx.inkParams('ink', 'accent'), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const u = sc.unit, n = sc.shapes.length, lw = Sv2.wtu(P, sc), glow = P.glow * u, rate = P.flickerRate | 0, k = Math.floor(api.loop * rate) % Math.max(1, rate - 1);
    const add = Sv2.darkGround(P) ? 'lighter' : 'source-over', LAYERS = 6;
    const dash = P.breaks > 0 ? (() => { const per = 260 * u, on = per * (1 - P.breaks * .7); return { arr:[on, per - on], off:-Sv2.frac(api.loop * (P.travel | 0)) * per }; })() : null;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    sc.shapes.forEach(sh => {
      const path = SvgFx.pathOf(sh, sc), col = SvgFx.colourOf(P, sh, n), fl = 1 - P.flicker * (Sv2.hs(k, sh.i) > .72 ? .85 : Sv2.hs(k, sh.i + 3) * .25);
      if (dash){ ctx.setLineDash(dash.arr); ctx.lineDashOffset = dash.off; }
      ctx.globalCompositeOperation = add;
      for (let i = LAYERS; i >= 1; i--){
        const t = i / LAYERS; ctx.lineWidth = lw + glow * t * t * 1.6; ctx.globalAlpha = Math.min(1, P.power * fl * .16 * (1 - t * .55)); ctx.strokeStyle = col; ctx.stroke(path);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = fl; ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke(path);
      if (P.core > 0){ ctx.globalAlpha = fl * P.core; ctx.lineWidth = Math.max(.6, lw * .42); ctx.strokeStyle = Sv2.mix(col, '#ffffff', .82); ctx.stroke(path); }
      ctx.globalAlpha = 1; ctx.setLineDash([]);
    });
  } });

/* ---- Ribbons ---- */
FX.register({ id:'fx-svg-ribbon', name:'Vector ribbons', cat:'fx', kind:'2d', search:['svg', 'vector', 'ribbon', 'brush', 'variable width', 'calligraphy', 'taper', 'pen'],
  desc:'Turns every path of an SVG into a ribbon of changing width: tapered like a brush stroke, swelling in waves, or uneven like a pressed pen.' + SVG_NOTE,
  params:[ S('profile', 'Width', ['Taper both ends', 'Taper end', 'Swell', 'Pressure'], 0), R('width', 'Widest', 18, 2, 80, .5), R('narrow', 'Narrowest', .1, 0, 1), R('wave', 'Swell length', 160, 40, 600, 1), I('travel', 'Swell travel cycles', 1, 0, 4),
    S('colour', 'Colour', ['Ink', 'Accent', 'Original colours', 'Ink to accent', 'Along the stroke', 'From palette'], 4), R('edge', 'Edge line', 0, 0, 6, .1), R('alpha', 'Opacity', .92, .1, 1), ...SvgFx.inkParams(), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const u = sc.unit, n = sc.shapes.length, W = P.width * u, prof = P.profile | 0, cm = P.colour | 0, step = SvgFx.stepFor(sc, 4 * u, 16000), ph = Sv2.frac(api.loop * (P.travel | 0));
    ctx.lineJoin = 'round';
    sc.shapes.forEach(sh => {
      const base = cm === 5 ? Sketch.paletteColor(sh.i, 7, sh.i % 2 ? P.c2 : P.c1) : cm === 4 ? null : cm === 3 ? Sketch.mixHex(P.c1, P.c2, n > 1 ? sh.i / (n - 1) : 0) : cm === 2 ? (sh.stroke || sh.fill || P.c1) : cm === 1 ? P.c2 : P.c1;
      sh.subs.forEach((sub, si) => {
        const rs = SvgFx.resample(sub, step), p = rs.p, m = p.length / 2; if (m < 3) return;
        const nr = Sv2.normals(p, sub.closed), c = Sv2.cumLen(p), L = c[m - 1] || 1, cycles = Math.max(1, Math.round(L / (P.wave * u))), w = new Float32Array(m);
        for (let i = 0; i < m; i++){
          const s = c[i] / L; let f;
          if (prof === 0) f = sub.closed ? .5 + .5 * Math.sin(Sv2.TAU * s * Math.max(1, cycles) + si) : Math.pow(Math.sin(Math.PI * s), .7);
          else if (prof === 1) f = sub.closed ? .5 + .5 * Math.sin(Sv2.TAU * s) : 1 - Math.pow(s, 1.4);
          else if (prof === 2) f = .5 + .5 * Math.sin(Sv2.TAU * (s * cycles - ph));
          else f = Sv2.nzs(s * cycles * 1.6, sh.i + si, 2);
          w[i] = W * (P.narrow + (1 - P.narrow) * Sv2.clamp(f)) * .5;
        }
        const left = new Float32Array(m * 2), right = new Float32Array(m * 2);
        for (let i = 0; i < m; i++){ left[i * 2] = p[i * 2] + nr[i * 2] * w[i]; left[i * 2 + 1] = p[i * 2 + 1] + nr[i * 2 + 1] * w[i]; right[i * 2] = p[i * 2] - nr[i * 2] * w[i]; right[i * 2 + 1] = p[i * 2 + 1] - nr[i * 2 + 1] * w[i]; }
        ctx.globalAlpha = P.alpha;
        if (base){
          ctx.fillStyle = base; ctx.beginPath();
          for (let i = 0; i < m; i++) i ? ctx.lineTo(left[i * 2], left[i * 2 + 1]) : ctx.moveTo(left[0], left[1]);
          if (sub.closed){ ctx.closePath(); ctx.moveTo(right[0], right[1]); for (let i = 1; i < m; i++) ctx.lineTo(right[i * 2], right[i * 2 + 1]); ctx.closePath(); ctx.fill('evenodd'); }
          else { for (let i = m - 1; i >= 0; i--) ctx.lineTo(right[i * 2], right[i * 2 + 1]); ctx.closePath(); ctx.fill(); }
        } else {
          /* a colour that runs along the stroke: short quads, each with its own mix, and a hairline to close the seams */
          for (let i = 0; i < m - 1; i += 3){
            const e = Math.min(m - 1, i + 3), col = Sketch.mixHex(P.c1, P.c2, Sv2.clamp((c[i] + c[e]) / 2 / L));
            ctx.fillStyle = ctx.strokeStyle = col; ctx.lineWidth = .6 * u + .4; ctx.beginPath(); ctx.moveTo(left[i * 2], left[i * 2 + 1]);
            for (let j = i + 1; j <= e; j++) ctx.lineTo(left[j * 2], left[j * 2 + 1]);
            for (let j = e; j >= i; j--) ctx.lineTo(right[j * 2], right[j * 2 + 1]);
            ctx.closePath(); ctx.fill(); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        if (P.edge > 0){ ctx.strokeStyle = P.c1 === base ? P.c2 : P.c1; ctx.lineWidth = Math.max(.4, P.edge * u); ctx.beginPath(); SvgFx.lineTo(ctx, left, false); SvgFx.lineTo(ctx, right, false); ctx.stroke(); }
      });
    });
  } });

/* ---- Scatter ---- */
FX.register({ id:'fx-svg-scatter', name:'Vector scatter', cat:'fx', kind:'2d', search:['svg', 'vector', 'scatter', 'stamp', 'pattern brush', 'confetti', 'leaves', 'along path'],
  desc:'Stamps small marks along the paths of an SVG: dots, crosses, triangles, leaves, diamonds or rings, in rows that can march along the line.' + SVG_NOTE,
  params:[ S('mark', 'Mark', ['Dot', 'Cross', 'Triangle', 'Leaf', 'Diamond', 'Ring'], 3), R('spacing', 'Spacing', 22, 5, 100, .5), R('size', 'Size', 16, 1.5, 40, .1), R('vary', 'Size variation', .4, 0, 1), R('taper', 'Taper along line', 0, 0, 1), I('rows', 'Rows', 1, 1, 5), R('spread', 'Row spread', 12, 0, 60, .5),
    R('jitter', 'Sideways jitter', .35, 0, 1), S('turn', 'Direction', ['Along the line', 'Across the line', 'Random', 'Upright'], 0), I('march', 'Marching cycles', 1, 0, 4), R('weight', 'Stroke weight', 1.6, .4, 6, .1), S('colour', 'Colour', SvgFx.colourModes, 4), ...SvgFx.inkParams(), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const u = sc.unit, n = sc.shapes.length, kind = P.mark | 0, rows = P.rows | 0, march = P.march | 0, step = SvgFx.stepFor(sc, P.spacing * u, 12000 / rows), first = Sv2.frac(api.loop * march) * step;
    ctx.lineWidth = Math.max(.5, P.weight * u * 1.4); ctx.lineCap = 'round';
    sc.shapes.forEach(sh => {
      const col = SvgFx.colourOf(P, sh, n), fillP = new Path2D(), strokeP = new Path2D();
      for (const sub of sh.subs){
        const rs = SvgFx.resample(sub, Math.max(2 * u, step * .25)), c = Sv2.cumLen(rs.p), nr = Sv2.normals(rs.p, sub.closed), L = c[c.length - 1] || 1, cnt = c.length - 1;
        for (let row = 0; row < rows; row++){
          const ro = rows > 1 ? (row / (rows - 1) - .5) * 2 * P.spread * u : 0;
          SvgFx.walk(rs, step, (first + row * step / rows) % step, (x, y, tx, ty, s, k) => {
            /* looks depend on the position along the line, so a marching row stays continuous and closes the loop */
            const sr = march ? s / step : k, r1 = Sv2.nzs(sr * 1.9, sh.i, 5 + row), r2 = Sv2.nzs(sr * 1.3 + 9, sh.i, 6 + row), r3 = Sv2.nzs(sr * 1.1 + 4, sh.i, 7 + row);
            const r = P.size * u * Sv2.clamp(1 - P.taper * s / L) * (1 - P.vary * r1); if (r < .5) return;
            const off = ro + (r2 - .5) * 2 * P.jitter * P.spread * u, j = Math.min(cnt, Math.max(0, Math.round(s / L * cnt)));
            const px = x + nr[j * 2] * off, py = y + nr[j * 2 + 1] * off, tu = P.turn | 0;
            const ang = tu === 0 ? Math.atan2(ty, tx) : tu === 1 ? Math.atan2(ty, tx) + Math.PI / 2 : tu === 2 ? r3 * Sv2.TAU : -Math.PI / 2;
            const cs = Math.cos(ang), sn = Math.sin(ang), T = (lx, ly) => [px + lx * cs - ly * sn, py + lx * sn + ly * cs];
            let q;
            if (kind === 0){ fillP.moveTo(px + r * .5, py); fillP.arc(px, py, r * .5, 0, Sv2.TAU); }
            else if (kind === 1){ q = T(-r * .5, 0); strokeP.moveTo(q[0], q[1]); q = T(r * .5, 0); strokeP.lineTo(q[0], q[1]); q = T(0, -r * .5); strokeP.moveTo(q[0], q[1]); q = T(0, r * .5); strokeP.lineTo(q[0], q[1]); }
            else if (kind === 2){ q = T(r * .6, 0); fillP.moveTo(q[0], q[1]); q = T(-r * .45, -r * .5); fillP.lineTo(q[0], q[1]); q = T(-r * .45, r * .5); fillP.lineTo(q[0], q[1]); fillP.closePath(); }
            else if (kind === 3){
              /* a leaf: two curves between the tip and the stalk, their control points either side of the axis */
              const a = T(-r * .8, 0), e = T(r * .8, 0), b = T(0, -r * .85), d = T(0, r * .85);
              fillP.moveTo(a[0], a[1]); fillP.quadraticCurveTo(b[0], b[1], e[0], e[1]); fillP.quadraticCurveTo(d[0], d[1], a[0], a[1]);
            }
            else if (kind === 4){ q = T(r * .55, 0); fillP.moveTo(q[0], q[1]); q = T(0, -r * .35); fillP.lineTo(q[0], q[1]); q = T(-r * .55, 0); fillP.lineTo(q[0], q[1]); q = T(0, r * .35); fillP.lineTo(q[0], q[1]); fillP.closePath(); }
            else { strokeP.moveTo(px + r * .42, py); strokeP.arc(px, py, r * .42, 0, Sv2.TAU); }
          });
        }
      }
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.fill(fillP); ctx.stroke(strokeP);
    });
  } });

/* ---- Glitch ---- */
FX.register({ id:'fx-svg-glitch', name:'Vector glitch', cat:'fx', kind:'2d', search:['svg', 'vector', 'glitch', 'slice', 'rgb split', 'displace', 'scanline', 'datamosh'],
  desc:'Slices an SVG into strips that jump sideways, with colour-split copies of the lines. The jumps change in steps and repeat every loop.' + SVG_NOTE,
  params:[ S('dir', 'Slices', ['Horizontal strips', 'Vertical strips'], 0), R('slice', 'Strip size', 30, 4, 140, .5), R('amount', 'Jump', 60, 0, 240, 1), R('density', 'Strips that jump', .4, 0, 1), I('steps', 'Changes per loop', 5, 1, 16), R('split', 'Colour split', 7, 0, 30, .5),
    R('weight', 'Line weight', 2.5, .3, 12, .1), R('fill', 'Fill', 0, 0, 1), S('colour', 'Colour', SvgFx.colourModes, 0), C('c1', 'Main', '#f4efe6', 'ink'), C('c2', 'Split one', '#ff5a36', 'accent'), C('c3', 'Split two', '#3b8f8c', 'accent2'), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const u = sc.unit, n = sc.shapes.length, vert = (P.dir | 0) === 1, size = vert ? api.w : api.h, nb = Math.min(70, Math.ceil(size / Math.max(3, P.slice * u))), bs = size / nb;
    /* the last step repeats the first, so the loop closes on the same frame it opened with */
    const N = P.steps | 0, k = Math.floor(api.loop * N) % Math.max(1, N - 1), split = P.split * u, lw = Sv2.wtu(P, sc);
    const gs = Sv2.groups(sc, sh => SvgFx.colourOf(P, sh, n)), fills = P.fill > 0 ? Sv2.groups(sc, sh => Sv2.fillCol(P, sh, n), Sv2.isClosed) : [];
    const blend = split > 0 ? (Sv2.darkGround(P) ? 'lighter' : 'multiply') : 'source-over', copies = split > 0 ? [[-split, P.c2], [split, P.c3], [0, null]] : [[0, null]];
    for (let b = 0; b < nb; b++){
      const on = Sv2.hs(b, k * 7 + 1) < P.density, jump = on ? (Sv2.hs(b, k * 7 + 2) - .5) * 2 * P.amount * u : 0, extra = on ? (Sv2.hs(b, k * 7 + 3) - .5) * split * .8 : 0;
      ctx.save(); ctx.beginPath(); vert ? ctx.rect(b * bs - .5, 0, bs + 1, api.h) : ctx.rect(0, b * bs - .5, api.w, bs + 1); ctx.clip();
      for (const [cs, cc] of copies){
        ctx.globalCompositeOperation = cc ? blend : 'source-over';
        const off = jump + (cc ? cs + extra : 0); ctx.save(); vert ? ctx.translate(0, off) : ctx.translate(off, 0);
        if (P.fill > 0){ ctx.globalAlpha = P.fill * (cc ? .5 : 1); for (const g of fills){ ctx.fillStyle = cc || g.col; ctx.fill(g.path, g.eo ? 'evenodd' : 'nonzero'); } ctx.globalAlpha = 1; }
        ctx.lineWidth = cc ? lw * .8 : lw;
        for (const g of gs){ ctx.strokeStyle = cc || g.col; ctx.stroke(g.path); }
        ctx.restore();
      }
      ctx.restore();
    }
  } });

/* ---- Bristles ---- */
FX.register({ id:'fx-svg-bristle', name:'Vector bristles', cat:'fx', kind:'2d', search:['svg', 'vector', 'bristle', 'brush', 'rake', 'comb', 'dry brush', 'parallel lines'],
  desc:'Draws each path of an SVG as a bundle of parallel hair lines, like a rake or a dry brush that runs out of paint along the way.' + SVG_NOTE,
  params:[ I('bristles', 'Bristles', 8, 2, 16), R('width', 'Brush width', 26, 3, 100, .5), R('weight', 'Hair weight', 2.2, .3, 6, .1), R('wobble', 'Wobble', 3, 0, 14, .1), R('dry', 'Dry patches', .35, 0, .9), R('trim', 'Uneven ends', .4, 0, 1),
    R('shade', 'Colour variation', .5, 0, 1), I('motion', 'Motion cycles', 1, 0, 4), S('colour', 'Colour', SvgFx.colourModes, 3), ...SvgFx.inkParams(), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const u = sc.unit, n = sc.shapes.length, B = P.bristles | 0, W = P.width * u, step = SvgFx.stepFor(sc, 4 * u, 18000 / B), cy = P.motion | 0, cz = cy ? Math.cos(api.loop * cy * Sv2.TAU) * 1.1 : 0, sz = cy ? Math.sin(api.loop * cy * Sv2.TAU) * 1.1 : 0;
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    sc.shapes.forEach(sh => {
      const col = SvgFx.colourOf(P, sh, n);
      const bundles = sh.subs.map((sub, si) => {
        const rs = SvgFx.resample(sub, step), p = rs.p, m = p.length / 2; if (m < 2) return null;
        return { p, m, nr:Sv2.normals(p, sub.closed), c:Sv2.cumLen(p), closed:sub.closed, si };
      }).filter(Boolean);
      for (let j = 0; j < B; j++){
        const off = ((j + .5) / B - .5) * W + (Sv2.hs(j, sh.i + 3) - .5) * W / B * .5;
        ctx.lineWidth = Math.max(.4, P.weight * u * 1.6 * (.6 + Sv2.hs(j, sh.i + 8) * .9)); ctx.globalAlpha = .7 + .3 * Sv2.hs(j, sh.i + 12);
        ctx.strokeStyle = P.shade > 0 ? Sv2.mix(col, Sv2.hs(j, sh.i + 21) > .5 ? P.c2 : P.c1, P.shade * .55 * Sv2.hs(j, sh.i + 22)) : col;
        ctx.beginPath();
        for (const bd of bundles){
          const L = bd.c[bd.m - 1] || 1, t0 = bd.closed ? 0 : Sv2.hs(j, sh.i + 30 + bd.si) * P.trim * .4, t1 = bd.closed ? 1 : 1 - Sv2.hs(j, sh.i + 40 + bd.si) * P.trim * .4;
          let pen = false;
          for (let i = 0; i < bd.m; i++){
            const s = bd.c[i] / L; if (s < t0 || s > t1){ pen = false; continue; }
            /* dry patches lift the hair off the surface; the noise runs along the path, not in time */
            if (Sv2.nzs(s * L / (W * 1.4 + 40 * u) + j * 7.3, sh.i + bd.si * 3, 11) < P.dry * .9){ pen = false; continue; }
            const w = off + (Sv2.nz(s * L / (60 * u) + cz, j * 3.7 + sz, sh.i) - .5) * 2 * P.wobble * u, x = bd.p[i * 2] + bd.nr[i * 2] * w, y = bd.p[i * 2 + 1] + bd.nr[i * 2 + 1] * w;
            pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true;
          }
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  } });

/* ---- Sparks ---- */
FX.register({ id:'fx-svg-sparks', name:'Vector sparks', cat:'fx', kind:'2d', search:['svg', 'vector', 'sparks', 'particles', 'comets', 'travel', 'flow', 'along path', 'light trail'],
  desc:'Sends bright sparks with fading tails travelling along the paths of an SVG, over a faint copy of the lines. Each spark makes whole laps per loop.' + SVG_NOTE,
  params:[ R('spacing', 'Spark spacing', 150, 30, 600, 1), I('laps', 'Laps per loop', 1, 1, 4), R('speedVary', 'Some go faster', .4, 0, 1), R('tail', 'Tail length', 90, 6, 400, 1), R('size', 'Spark size', 4.5, 1, 16, .1), R('glow', 'Glow', .7, 0, 1),
    R('embers', 'Embers', .5, 0, 1), R('path', 'Show the path', .3, 0, 1), R('weight', 'Path weight', 1.3, .3, 6, .1), S('colour', 'Colour', SvgFx.colourModes, 1), ...SvgFx.inkParams(), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const u = sc.unit, n = sc.shapes.length, step = SvgFx.stepFor(sc, 3 * u, 14000), add = Sv2.darkGround(P) ? 'lighter' : 'source-over', laps = P.laps | 0, tail = P.tail * u, sp = P.spacing * u;
    let budget = 900; ctx.lineCap = 'round';
    if (P.path > 0){
      ctx.globalAlpha = P.path * .55; ctx.lineWidth = Sv2.wtu(P, sc); ctx.strokeStyle = P.c1;
      for (const sh of sc.shapes) ctx.stroke(SvgFx.pathOf(sh, sc));
      ctx.globalAlpha = 1;
    }
    sc.shapes.forEach(sh => {
      const col = SvgFx.colourOf(P, sh, n), hot = Sv2.mix(col, '#ffffff', .7);
      sh.subs.forEach((sub, si) => {
        const rs = SvgFx.resample(sub, step), p = rs.p; if (p.length < 6) return;
        const c = Sv2.cumLen(p), L = c[c.length - 1]; if (L < 8 * u) return;
        const cnt = Math.max(1, Math.round(L / sp)); if ((budget -= cnt) < 0) return;
        for (let i = 0; i < cnt; i++){
          const id = sh.i * 31 + si * 7 + i, sp2 = laps * (P.speedVary > 0 && Sv2.hs(id, 1) < P.speedVary * .6 ? 2 : 1);
          const s = Sv2.frac((i + Sv2.hs(id, 2) * .6) / cnt + sp2 * api.loop) * L, fadeLen = Math.min(L * .5, Math.max(tail, 30 * u)), env = sub.closed ? 1 : Math.min(1, s / fadeLen, (L - s) / fadeLen);
          if (env <= .02) continue;
          const tl = Math.min(tail, L * .9), SEG = 12; let prev = null;
          /* the tail: short segments, brighter and wider towards the head */
          for (let q = 0; q <= SEG; q++){
            let ss = s - tl * (1 - q / SEG);
            if (ss < 0){ if (sub.closed) ss += L; else { prev = null; continue; } }
            const pt = Sv2.at(p, c, ss);
            if (prev && Math.hypot(pt[0] - prev[0], pt[1] - prev[1]) < tl / SEG * 2.5 + 2){
              const f = q / SEG; ctx.globalCompositeOperation = add; ctx.globalAlpha = f * f * env * .9; ctx.strokeStyle = col; ctx.lineWidth = Math.max(.5, P.size * u * (.25 + .85 * f));
              ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(pt[0], pt[1]); ctx.stroke();
            }
            prev = pt;
          }
          const h = Sv2.at(p, c, s), r = P.size * u;
          if (P.glow > 0){
            ctx.globalCompositeOperation = add; ctx.globalAlpha = env * P.glow * .3; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(h[0], h[1], r * 3.4, 0, Sv2.TAU); ctx.fill();
            ctx.globalAlpha = env * P.glow * .5; ctx.beginPath(); ctx.arc(h[0], h[1], r * 1.9, 0, Sv2.TAU); ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = env; ctx.fillStyle = hot; ctx.beginPath(); ctx.arc(h[0], h[1], r * .8, 0, Sv2.TAU); ctx.fill();
          /* embers: a few specks left behind the head, drifting sideways as they cool */
          for (let e = 0, E = Math.round(P.embers * 5); e < E; e++){
            const back = Sv2.hs(id, 10 + e), ss = s - tl * (.15 + back * .85); if (ss < 0 && !sub.closed) continue;
            const pt = Sv2.at(p, c, ss < 0 ? ss + L : ss), side = (Sv2.hs(id, 20 + e) - .5) * 2 * (6 + back * 26) * u, tw = .6 + .4 * Math.sin(Sv2.TAU * (api.loop * 3 + Sv2.hs(id, 30 + e)));
            ctx.globalCompositeOperation = add; ctx.globalAlpha = env * (1 - back) * .9 * tw; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pt[0] - pt[3] * side, pt[1] + pt[2] * side, Math.max(.5, r * .3 * (1 - back * .6)), 0, Sv2.TAU); ctx.fill();
          }
        }
      });
    });
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  } });

/* ---- Shapes in motion ---- */
FX.register({ id:'fx-svg-burst', name:'Vector burst', cat:'fx', kind:'2d', search:['svg', 'vector', 'explode', 'burst', 'assemble', 'pulse', 'breathe', 'scatter shapes', 'fly out'],
  desc:'Moves every shape of an SVG on its own: flying out from the centre and back, assembling on the timeline, breathing, or spinning. Shapes keep their own colours.' + SVG_NOTE,
  params:[ S('style', 'Movement', ['Fly out and back', 'Assemble (timeline)', 'Breathe', 'Spin'], 0), R('amount', 'Amount', .6, 0, 2, .01), R('stagger', 'Stagger', .5, 0, .95), R('turn', 'Twist', .5, 0, 1), I('cycles', 'Cycles', 1, 1, 4),
    R('weight', 'Line weight', 2.2, .3, 12, .1), R('fill', 'Fill', .85, 0, 1), S('colour', 'Colour', SvgFx.colourModes, 2), ...SvgFx.inkParams(), ...SvgFx.srcParams(), ...SVG_GROUND() ],
  draw(ctx, api){
    const P = api.params, sc = svgBegin(ctx, api); if (!sc) return;
    const n = sc.shapes.length, style = P.style | 0, cyc = Math.max(1, P.cycles | 0), R0 = Math.min(api.w, api.h) / 2, cx = sc.box.x + sc.box.w / 2, cy = sc.box.y + sc.box.h / 2, lw = Sv2.wtu(P, sc);
    const ease = t => t * t * (3 - 2 * t);
    ctx.lineJoin = 'round';
    for (const sh of sc.shapes){
      const b = Sv2.bounds(sh), loc = sh.i / Math.max(1, n), dxc = b.cx - cx, dyc = b.cy - cy, dist = Math.hypot(dxc, dyc) || 1, dir = [dxc / dist, dyc / dist];
      /* f: 0 assembled, 1 fully apart */
      let f = 1;
      if (style === 0){ const v = Math.sin(Math.PI * Sv2.frac(api.loop * cyc - P.stagger * loc * .5)); f = v * v; }
      else if (style === 1) f = 1 - ease(Sv2.clamp((api.p - P.stagger * loc * .8) / (1 - P.stagger * .8 + 1e-6)));
      else if (style === 2) f = .5 - .5 * Math.cos(Sv2.TAU * (api.loop * cyc - P.stagger * loc * .6));
      const seed = (Sv2.hs(sh.i, 1) - .5) * 2, ph = Sv2.TAU * (api.loop * cyc - P.stagger * loc * .5);
      let tx = 0, ty = 0, rot = 0, s = 1;
      if (style <= 1){ const fly = f * P.amount * R0 * (.5 + Sv2.hs(sh.i, 2)); tx = dir[0] * fly; ty = dir[1] * fly; rot = seed * f * P.turn * 1.6; s = 1 + f * (Sv2.hs(sh.i, 3) - .35) * P.amount; }
      else if (style === 2) s = 1 + (f - .5) * P.amount * .6;
      else rot = ph * (seed > 0 ? 1 : -1) * P.turn;
      s = Math.max(.02, s);
      ctx.save(); ctx.translate(b.cx + tx, b.cy + ty); ctx.rotate(rot); ctx.scale(s, s); ctx.translate(-b.cx, -b.cy);
      const path = SvgFx.pathOf(sh, sc), col = SvgFx.colourOf(P, sh, n);
      ctx.globalAlpha = style === 1 ? Sv2.clamp(1 - f * .5) : style === 0 ? 1 - f * .35 : 1;
      if (P.fill > 0 && Sv2.isClosed(sh) && (Sv2.isFilled(sh) || (P.colour | 0) !== 2)){ ctx.save(); ctx.globalAlpha *= P.fill * ((P.colour | 0) === 2 ? Math.max(.4, sh.fa) : .55); ctx.fillStyle = Sv2.fillCol(P, sh, n); ctx.fill(path, Sv2.rule(sh)); ctx.restore(); }
      ctx.lineWidth = lw / s; ctx.strokeStyle = col; ctx.stroke(path);
      ctx.restore();
    }
  } });

/* ---- Vector as a window ---- */
(() => {
  let layer = null, lctx = null, tmp = null, tctx = null;
  const canvases = (w, h) => {
    if (!layer){ layer = document.createElement('canvas'); lctx = layer.getContext('2d'); tmp = document.createElement('canvas'); tctx = tmp.getContext('2d'); }
    for (const c of [layer, tmp]) if (c.width !== w || c.height !== h){ c.width = w; c.height = h; }
    return [lctx, tctx];
  };
  FX.register({ id:'fx-svg-mask', name:'Vector window', cat:'fx', kind:'2d', nonLocal:true, search:['svg', 'vector', 'mask', 'window', 'reveal', 'cut out', 'knockout', 'clip', 'shape', 'logo', 'silhouette'],
    desc:'Uses the shapes of an SVG as a window onto whatever is underneath, with a cover colour, shadow and edge around it. The image can drift inside. Open lines become bars.' + SVG_NOTE,
    params:[ S('mode', 'Show image', ['Inside the shapes', 'Outside the shapes'], 0), S('shapes', 'Shapes', ['All shapes', 'Closed shapes', 'Filled shapes'], 0), R('bar', 'Open lines become', 18, 0, 80, .5), R('grow', 'Grow', 0, 0, 60, .5), R('dim', 'Cover the rest', 1, 0, 1), T('backdrop', 'Skip a backdrop shape', true),
      R('zoom', 'Zoom inside', 1.2, 1, 3, .01), R('drift', 'Drift inside', .6, 0, 1), I('cycles', 'Drift cycles', 1, 0, 4), R('offset', 'Different in each shape', 0, 0, 1), R('tint', 'Tint with shape colour', 0, 0, 1),
      R('shadow', 'Shadow', .3, 0, 1), R('edge', 'Edge line', 0, 0, 8, .1), S('colour', 'Edge colour', SvgFx.colourModes, 0), ...SvgFx.inkParams(), ...SvgFx.srcParams(), C('bg', 'Cover colour', '#141516', 'ground') ],
    draw(ctx, api){
      const P = api.params, sc = SvgFx.scene(api, P); if (!sc || !api.input) return;
      const { w, h } = api, u = sc.unit, n = sc.shapes.length, inside = (P.mode | 0) === 0, pick = P.shapes | 0, bar = P.bar * u, grow = P.grow * u;
      /* a shape that fills most of the artwork is a background, not a window */
      const big = sh => { const b = Sv2.bounds(sh); return b.w * b.h > .6 * sc.box.w * sc.box.h && n > 1; };
      const chosen = sc.shapes.filter(sh => (pick === 0 || (pick === 1 ? Sv2.isClosed(sh) : Sv2.isFilled(sh))) && !(P.backdrop && big(sh)));
      const [L, T] = canvases(w, h), a = api.loop * (P.cycles | 0) * Sv2.TAU, slack = (P.zoom - 1) / 2;
      /* the shapes in a solid colour on canvas c: fills for closed shapes, fat strokes for open lines and for growing */
      const shapeIn = (c, list, colFn, extra = 0) => {
        c.lineJoin = c.lineCap = 'round';
        for (const sh of list){
          const path = SvgFx.pathOf(sh, sc), closed = Sv2.isClosed(sh); c.fillStyle = c.strokeStyle = colFn ? colFn(sh) : '#fff';
          if (closed && !extra) c.fill(path, Sv2.rule(sh));
          const wd = (closed ? 0 : bar) + grow * 2 + extra;
          if (wd > .5){ c.lineWidth = wd; c.stroke(path); }
        }
      };
      /* the frame scaled about its centre; the drift stays inside the slack so the image never runs out */
      const drawImg = (c, k) => {
        const dx = (Math.cos(a + k * 2.1) * P.drift + (k ? (Sv2.hs(k, 4) - .5) * 2 * P.offset : 0)) * slack * w * .5, dy = (Math.sin(a + k * 2.1) * P.drift + (k ? (Sv2.hs(k, 5) - .5) * 2 * P.offset : 0)) * slack * h * .5;
        c.save(); c.translate(w / 2 + dx, h / 2 + dy); c.scale(P.zoom, P.zoom); c.translate(-w / 2, -h / 2); c.drawImage(api.input, 0, 0, w, h); c.restore();
      };
      L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'source-over'; L.globalAlpha = 1; L.clearRect(0, 0, w, h);
      if (inside){
        const G = P.offset > 0 ? Math.min(10, Math.max(2, chosen.length)) : 1;
        for (let g = 0; g < G; g++){
          const list = G === 1 ? chosen : chosen.filter(sh => sh.i % G === g); if (!list.length) continue;
          const dest = G === 1 ? L : T;
          if (dest === T){ T.setTransform(1, 0, 0, 1, 0, 0); T.globalCompositeOperation = 'source-over'; T.globalAlpha = 1; T.clearRect(0, 0, w, h); }
          shapeIn(dest, list); dest.globalCompositeOperation = 'source-in'; drawImg(dest, G === 1 ? 0 : g + 1);
          if (P.tint > 0){ dest.globalCompositeOperation = 'source-atop'; dest.globalAlpha = P.tint; shapeIn(dest, list.filter(Sv2.isFilled), sh => sh.fill); dest.globalAlpha = 1; }
          dest.globalCompositeOperation = 'source-over';
          if (dest === T) L.drawImage(tmp, 0, 0);
        }
      } else {
        drawImg(L, 0); L.globalCompositeOperation = 'destination-out'; shapeIn(L, chosen); L.globalCompositeOperation = 'source-over';
      }
      /* cover what is outside the window, then the edge, then the window with its shadow */
      if (P.dim > 0){ ctx.globalAlpha = P.dim; ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
      const edge = Math.max(.5, P.edge * u * 1.6);
      if (P.edge > 0 && inside){
        /* a ring just outside the window: stroke wide, and the window is laid over its inner half */
        ctx.lineJoin = ctx.lineCap = 'round';
        for (const sh of chosen){ ctx.strokeStyle = SvgFx.colourOf(P, sh, n); ctx.lineWidth = (Sv2.isClosed(sh) ? 0 : bar) + grow * 2 + edge * 2; ctx.stroke(SvgFx.pathOf(sh, sc)); }
      }
      if (P.shadow > 0 && inside){ ctx.shadowColor = `rgba(0,0,0,${(P.shadow * .7).toFixed(3)})`; ctx.shadowBlur = 40 * u * P.shadow + 4 * u; ctx.shadowOffsetX = 6 * u * P.shadow; ctx.shadowOffsetY = 14 * u * P.shadow; }
      ctx.drawImage(layer, 0, 0);
      ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
      if (P.edge > 0 && !inside){
        ctx.lineJoin = ctx.lineCap = 'round'; ctx.lineWidth = edge;
        for (const sh of chosen){ ctx.strokeStyle = SvgFx.colourOf(P, sh, n); ctx.stroke(SvgFx.pathOf(sh, sc)); }
      }
    } });
})();
