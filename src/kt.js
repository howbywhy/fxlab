/* ---------------- Type & brand helpers ----------------
   KT: text layout, fitting, easing, stagger and ground helpers used by
   the Kinetic type modules — use them in your own modules too.
   Brand: draw logos from Assets (sized, tinted) and pick palette colours.
------------------------------------------------------ */
const KT = (() => {
  const TAU = Math.PI * 2;
  const clamp = Util.clamp;
  const ease = {
    expo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
    back: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    elastic: x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -9 * x) * Math.sin((x * 9 - .75) * (TAU / 3)) + 1,
    cubic: x => 1 - Math.pow(1 - x, 3),
    inOut: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  };
  ease.bounce = x => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375; return n * (x -= 2.625 / d) * x + .984375; };
  /* 'Brand' uses the easing set in the System tab */
  const EASES = ['Expo', 'Back', 'Elastic', 'Cubic', 'Brand'];
  const easeBy = i => [ease.expo, ease.back, ease.elastic, ease.cubic, x => Identity.ease(x)][i | 0] || ease.expo;

  const K = {
    TAU, ease, EASES, easeBy,
    text: P => { const t = String(P.text ?? ''); return P.upper ? t.toUpperCase() : t; },
    font: (P, px) => `${Util.weights[P.weight | 0] || 400} ${Math.max(1, px)}px ${Util.family(P)}`,
    /* lerp two '#rrggbb' colours, t 0-1 → a Canvas-ready 'rgb(...)' string */
    mixHex(a, b, t){ const A = Util.hexToRgb(a), B = Util.hexToRgb(b); const c = i => Math.round(A[i] * (1 - t) + B[i] * t); return `rgb(${c(0)},${c(1)},${c(2)})`; },
    /* standard param groups */
    typeParams: (text, o = {}) => [ X('text', 'Text', text, true), F('font', 'Font', o.font || 'Helvetica'), S('weight', 'Weight', Util.weights, o.weight ?? 4), T('upper', 'Uppercase', o.upper ?? true) ],
    groundParams: (def = 0, color = '#141516') => [ S('ground', 'Ground', ['Over frame', 'Colour'], def), C('bg', 'Ground colour', color) ],
    /* the engine already paints the incoming frame; Colour covers it. api.input is that
       same frame if a module needs to sample or crop it — do not blit it at 0,0 here
       (the 2D buffer is tile-sized during print). */
    ground(ctx, api){ const P = api.params; if ((P.ground | 0) === 1){ ctx.fillStyle = P.bg; ctx.fillRect(0, 0, api.w, api.h); } },
    /* seeded random 0–1 */
    rnd: (i, s = 0) => Util.hash(i * 12.9898 + s * 78.233 + 1.13),
    /* local 0–1 progress for item i of n. spread 0 = together, 1 = one after another */
    stagger(p, i, n, spread){
      if (n <= 1) return clamp(p);
      const span = 1 / (1 + (n - 1) * spread);
      return clamp((p - i * spread * span) / span);
    },
    /* reorder index by mode: 0 forward, 1 reverse, 2 centre out, 3 random */
    orderMap(n, mode, seed = 1){
      const idx = [...Array(n).keys()];
      if (mode === 1) idx.reverse();
      else if (mode === 2){ const c = (n - 1) / 2; idx.sort((a, b) => Math.abs(a - c) - Math.abs(b - c) || a - b); }
      else if (mode === 3) idx.sort((a, b) => K.rnd(a, seed) - K.rnd(b, seed));
      const rank = new Array(n); idx.forEach((v, r) => rank[v] = r); return rank;
    },
    /* shear around (x, y): positive leans right */
    slant(ctx, x, y, k){ if (!k) return; ctx.translate(x, y); ctx.transform(1, 0, -k, 1, 0, 0); ctx.translate(-x, -y); },
    /* velocity-driven slant, scaled by the brand's motion slant token */
    motionSlant(ctx, x, y, k){ K.slant(ctx, x, y, Util.clamp(k * Identity.slant(), -1.4, 1.4)); },
    /* beats per loop: module value, or the brand beat when 0 */
    beats: v => (v | 0) > 0 ? v | 0 : Identity.beat(),
    /* '*word*' marks emphasis → [{ text, em }] */
    emph(str){ const out = []; String(str).split(/(\*[^*]+\*)/).forEach(t => { if (!t) return; const em = /^\*[^*]+\*$/.test(t); out.push({ text:em ? t.slice(1, -1) : t, em }); }); return out; },
    stripEmph: str => String(str).replace(/\*([^*]+)\*/g, '$1'),
    /* word wrap for the current ctx.font. Lines are balanced: the same number of
       lines, but evened out, so you don't get a last line with one word on it. */
    wrap(ctx, text, maxW, balance = true){
      const out = [];
      const greedy = (words, width) => {
        const lines = []; let line = '';
        for (const word of words){ const t = line ? line + ' ' + word : word; if (ctx.measureText(t).width > width && line){ lines.push(line); line = word; } else line = t; }
        lines.push(line); return lines;
      };
      String(text).split('\n').forEach(par => {
        const words = par.split(/\s+/).filter(Boolean);
        if (!words.length){ out.push(''); return; }
        let lines = greedy(words, maxW);
        if (balance && lines.length > 1){
          let lo = ctx.measureText(words.reduce((a, b) => a.length >= b.length ? a : b)).width, hi = maxW, best = lines;
          for (let i = 0; i < 12; i++){
            const mid = (lo + hi) / 2, test = greedy(words, mid);
            if (test.length <= lines.length){ best = test; hi = mid; } else lo = mid;
          }
          lines = best;
        }
        out.push(...lines);
      });
      return out;
    },
    roundRect(ctx, x, y, w, h, r){ r = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); },
    /* draw text in a rect that rises from under a mask: lp 0–1 */
    rise(ctx, lp, top, height, fn){ if (lp <= 0) return; ctx.save(); ctx.beginPath(); ctx.rect(-1e5, top, 2e5, height); ctx.clip(); ctx.translate(0, (1 - lp) * height); fn(); ctx.restore(); },
    /* metrics for the current ctx.font */
    metrics(ctx, size){
      const m = ctx.measureText('HMOQgjpy');
      const cap = ctx.measureText('H').actualBoundingBoxAscent || size * .72;
      return { cap, asc: m.actualBoundingBoxAscent || size * .8, desc: m.actualBoundingBoxDescent || size * .2 };
    },
    /* glyph layout. returns lines with glyph x positions (kerning kept via prefix measure). baseline-aligned */
    layout(ctx, text, o){
      ctx.font = o.font;
      const tr = (o.tracking || 0) * o.size, lines = String(text).split('\n');
      const out = lines.map(str => {
        const chars = [...str], glyphs = []; let word = 0, prevSpace = true, prefix = '';
        chars.forEach((ch, i) => {
          const x = ctx.measureText(prefix).width + i * tr;
          prefix += ch;
          const adv = ctx.measureText(prefix).width + i * tr - x;
          const space = /\s/.test(ch);
          if (!space && prevSpace && glyphs.length) word++;
          prevSpace = space;
          glyphs.push({ ch, x, w:adv, space, word });
        });
        const width = chars.length ? ctx.measureText(str).width + (chars.length - 1) * tr : 0;
        return { str, glyphs, width, words:glyphs.length ? word + 1 : 0 };
      });
      return { lines:out, tracking:tr, maxWidth:Math.max(0, ...out.map(l => l.width)) };
    },
    /* font size so the widest line fits maxW (and block fits maxH) */
    fit(ctx, P, text, maxW, maxH, leading = 1, tracking = 0){
      const base = 100; ctx.font = K.font(P, base);
      const L = K.layout(ctx, text, { font:ctx.font, size:base, tracking });
      const lines = Math.max(1, L.lines.length);
      let s = L.maxWidth > 0 ? base * maxW / L.maxWidth : base;
      if (maxH) s = Math.min(s, maxH / (lines * leading * .9 + .1));
      return Math.max(2, s);
    },
    /* position a laid-out block: returns baseline y per line and x origin per line */
    place(L, o){
      const n = L.lines.length, lh = o.size * o.leading;
      const top = o.y - ((n - 1) * lh) / 2 + o.cap / 2;
      return L.lines.map((ln, i) => ({ y: top + i * lh, x: o.align === 0 ? o.x : o.align === 2 ? o.x - ln.width : o.x - ln.width / 2 }));
    },
  };
  return K;
})();

const Brand = {
  /* draw an asset centred at (x, y), width = ww; returns drawn height */
  logo(ctx, P, key, x, y, ww, tint){
    const src = tint ? Assets.tinted(P[key], tint) : Assets.image(P[key]);
    if (!src) return 0;
    const hh = ww * src.height / src.width;
    ctx.drawImage(src, x - ww / 2, y - hh / 2, ww, hh);
    return hh;
  },
  size(ctx, P, key, W, H, pct){
    const src = Assets.image(P[key]); if (!src) return [0, 0];
    let ww = pct * W; const ar = src.height / src.width;
    if (ww * ar > H * .96) ww = H * .96 / ar;
    return [ww, ww * ar];
  },
  paletteColor(i, seed, fallback){
    const pal = Assets.palette; if (!pal.length) return fallback;
    return pal[Math.floor(KT.rnd(i, seed) * pal.length)].hex;
  },
  BLEND: ['source-over', 'multiply', 'screen', 'overlay', 'difference'],
};

