/* =====================================================================
   fxlab — a WebGL2 motion & image lab
   ---------------------------------------------------------------------
   HOW IT WORKS
   Every frame:  Sources  →  optional Prepare A/B  →  Base / Combine  →  Stack / Finish
   - Optional sources.A.process / sources.B.process prepare each fitted
     source before the base. FX.laneEligible: treatments + fx-reframe only.
     Not a second stack or precomp. Empty lists are a no-op; uA/uB stay the fit.
   - Source fit/zoom/x/y is how the file first sits in the frame. fx-reframe
     in Prepare is a later crop in that source's chain.
   - Base modules (sources, transitions, mix & mask, generators) make the
     starting frame. They read uA and uB (fitted, or prepared if a source
     process list ran).
   - Stack modules (treatments, effects, overlays) process the frame in order. They read uInput. They can
     also sample the bound uA/uB (see fx-matte) but not a second
     processed layer from the stack.

   ADDING A MODULE (GLSL) — copy this into any modules section:
     FX.register({
       id: 'fx-myeffect', name: 'My effect', cat: 'fx',
       desc: 'One line about what it does.',
       params: [ R('amount','Amount',0.5,0,1), C('tint','Tint','#ffffff') ],
       fs: `vec4 fx(vec2 uv){
              vec3 c = texture(uInput, uv).rgb;
              return vec4(mix(c, c*p_tint, p_amount), 1.);
            }`
     });
   Params become uniforms named p_<id>: range/select/toggle → float,
   color → vec3. Text (X) params are for aux/2D modules. Col params pick a column
   of the loaded data (Data.pick(P.col, index) → { v, min, max, … }); every range
   control can also be linked to a column from its link button.
   Colour roles: colour params may hold 'role:ink', 'role:ground', 'role:accent'
   or 'role:accent2'. Modules receive the resolved values, so draw code never
   needs to know. New modules link to roles automatically (System tab).
   Canvas 2D helpers: Sketch.rnd (seeded), Sketch.TAU, Sketch.ground,
   Sketch.groundParams, Sketch.paletteColor.

   Uniforms available to every shader:
     uInput uA uB uPrev uAux (samplers)   uRes (output px, not preview px)
     uTime (s)  uProgress (eased 0–1 transition)  uLoop (0–1 raw loop phase)
     uDur (s)  uAuxInfo (vec4 returned by aux())
     uPx (output px per preview px — use for crisp 1px lines at any preview quality)
   Helpers: luma hash12 hash22 vnoise fbm rot centered uncentered
     mirrorUv hsv2rgb rgb2hsv blendMode bayer2/4/8 sdRoundBox sdTri
   Where to paste: the "YOUR MODULES" block just below this header.
   After saving the file, reload the page. Shader errors appear on screen.
   Tip: drive animation with uLoop (cos/sin(uLoop*TAU)) so loops are seamless.

   Optional module flags:
     feedback: true  → uPrev holds this module's previous output
     nonLocal: true  → this module samples far from its own pixel (whole-frame
                       lookups, polar/kaleido wraps, long streaks…). Print then
                       renders the stack in one pass instead of tiles, or seams
                       appear. Set it when you write the module, not later.
     search: ['distort'] → extra words the Library search matches. Invisible;
                       not a second category. Only add when name/desc would miss
                       a designer’s word (print, window, combine, feedback…).
     aux(ctx, params, w, h) → draw into a 2D canvas uploaded as uAux;
                              return [a,b,c,d] for uAuxInfo
     auxSize(params, w, h) → [w, h] for the aux canvas
     kind: '2d', draw(ctx, api) → a Canvas 2D module instead of GLSL.
       api: { w, h, W, H, t, p, loop, dur, fps, params, input, source(k), sample(k, cols, rows) }
       source(k) reads bound A/B (fitted, or prepared if a source process ran).
       input is the incoming processed frame (HTMLCanvasElement), or null on a
       base with no input. Same size as the current 2D buffer — preview render
       size, or the current print tile — not output W×H. The engine also paints
       that frame onto the destination before draw() runs. Do not keep the
       canvas after draw() returns.
   ===================================================================== */

/* a tool made by fxlab is this app with its recipe in a script tag ahead of the code; null in the editor */
const PLAYER_RECIPE = (() => {
  const e = typeof document !== 'undefined' && document.getElementById('fxlab-language');
  if (!e) return null;
  try { return JSON.parse(e.textContent); } catch { return null; }
})();

const FX = (() => {
  const modules = [], byId = {};
  function register(m){
    if (byId[m.id]) console.warn('fxlab: duplicate module id', m.id);
    m.params = m.params || [];
    m.kind = m.kind || 'gl';
    modules.push(m); byId[m.id] = m;
    return m;
  }
  /* Source lanes prepare an image. They are not a second composition. */
  function laneEligible(m){
    if (!m || m.feedback || m.kind === '2d') return false;
    return m.cat === 'treatment' || m.id === 'fx-reframe';
  }
  return { modules, byId, register, laneEligible };
})();

const CATS = [
  { id:'source',     label:'Sources',     role:'base'  },
  { id:'transition', label:'Transitions', role:'base'  },
  { id:'mix',        label:'Mix & mask',  role:'base'  },
  { id:'generator',  label:'Generators',  role:'base'  },
  { id:'treatment',  label:'Treatments',  role:'stack' },
  { id:'fx',         label:'Effects',     role:'stack' },
  { id:'data',       label:'Data',        role:'stack' },
  { id:'overlay',    label:'Overlays',    role:'stack' },
];
const catRole = id => (CATS.find(c => c.id === id) || {}).role;

/* param helpers */
const R = (id, label, def, min, max, step) => ({ type:'range', id, label, def, min, max, step: step ?? +((max - min) / 200).toPrecision(3) });
const I = (id, label, def, min, max) => ({ type:'range', id, label, def, min, max, step:1 });
/* role: 'ink' | 'ground' | 'accent' | 'accent2' pins this colour to a colour role; false opts out of linking */
const C = (id, label, def, role) => ({ type:'color', id, label, def, role });
const T = (id, label, def = false) => ({ type:'toggle', id, label, def });
const S = (id, label, options, def = 0) => ({ type:'select', id, label, options, def });
const X = (id, label, def = '', multiline = false) => ({ type:'text', id, label, def, multiline });
/* Col: a column of the loaded data. Empty means the auto pick: the `auto`-th numeric column. kind 'any' also allows categories. */
const Col = (id, label, auto = 0, kind = 'number') => ({ type:'column', id, label, def:'', auto, kind });

const BLENDS = ['Normal','Multiply','Screen','Overlay','Soft light','Hard light','Difference','Exclusion','Add','Subtract','Lighten','Darken','Colour dodge','Colour burn'];
const DIRS4 = ['Top → bottom','Left → right','Bottom → top','Right → left'];

const Util = {
  fonts: [
    '"Helvetica Neue", Helvetica, Arial, sans-serif',
    'Georgia, "Times New Roman", serif',
    '"Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif',
    '"Geist", ui-sans-serif, system-ui, sans-serif',
  ],
  clamp: (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)),
  hash(n){ const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); },
  /* '#rrggbb' → [r,g,b] 0-255 */
  hexToRgb(h){ const n = parseInt(String(h).replace('#', '').slice(0, 6), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; },
};
