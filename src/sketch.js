/* ---------------- Sketch helpers ----------------
   Small helpers for Canvas 2D modules: seeded random, tau, ground painting
   and palette picks. Use them in your own modules too.
------------------------------------------------------ */
const Sketch = (() => {
  const TAU = Math.PI * 2;
  return {
    TAU,
    /* seeded random 0–1 */
    rnd: (i, s = 0) => Util.hash(i * 12.9898 + s * 78.233 + 1.13),
    /* standard ground control: 'Over frame' keeps what is underneath, 'Colour' paints over it */
    groundParams: (def = 0, color = '#141516') => [ S('ground', 'Ground', ['Over frame', 'Colour'], def), C('bg', 'Ground colour', color) ],
    /* the frame underneath is already laid down by the engine; 'Colour' paints over it (honouring opacity) */
    ground(ctx, api){ const P = api.params; if ((P.ground | 0) === 1){ ctx.fillStyle = P.bg; ctx.fillRect(0, 0, api.w, api.h); } else if (api.input) ctx.drawImage(api.input, 0, 0); },
    /* lerp two '#rrggbb' colours, t 0–1 → a Canvas-ready 'rgb(...)' string */
    mixHex(a, b, t){ const A = Util.hexToRgb(a), B = Util.hexToRgb(b); const c = i => Math.round(A[i] * (1 - t) + B[i] * t); return `rgb(${c(0)},${c(1)},${c(2)})`; },
    /* a colour from the palette in Assets, picked by seed, or the fallback when the palette is empty */
    paletteColor(i, seed, fallback){
      const pal = Assets.palette; if (!pal.length) return fallback;
      return pal[Math.floor(Sketch.rnd(i, seed) * pal.length)].hex;
    },
  };
})();
