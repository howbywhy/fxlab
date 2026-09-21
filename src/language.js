/* ---------------- Language ----------------
   A visual language is a few constants and a bounded space of variation. Here the
   constants are the composition (layers, palette, motion); the variation is a
   handful of controls pinned on layers (inst.expose) with a range each. A seed
   walks that space reproducibly. Exports carry the language out:
     tool    one HTML file with the composition locked and only the pinned controls shown
     board   variations of the language in one PNG
     recipe  the whole composition as JSON, opens in fxlab
     tokens  colour and motion as W3C design tokens (treatments can't be tokens)
------------------------------------------------ */
const Language = (() => {
  const L = {};
  /* integer hash: the same seed gives the same variation in every browser */
  const h32 = (a, b, c) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  L.seedString = s => (s >>> 0).toString(36);
  L.parseSeed = t => { const n = parseInt(String(t).trim().toLowerCase(), 36); return Number.isFinite(n) && n > 0 ? n % 2147483647 : null; };
  L.newSeed = () => 1 + Math.floor(Math.random() * 2147483646);
  L.meta = () => state.language || (state.language = { name:'', rule:'', seed:L.newSeed() });

  /* every pinned control, in layer order */
  L.exposed = () => {
    const out = [];
    allInsts().forEach(({ inst, where }) => {
      const m = FX.byId[inst.id]; if (!m || !inst.expose) return;
      m.params.forEach(p => { const x = inst.expose[p.id]; if (x && (p.type === 'range' || p.type === 'select' || p.type === 'toggle')) out.push({ inst, m, p, where, x }); });
    });
    return out;
  };
  L.count = () => L.exposed().length;
  L.toggle = (inst, p) => History.record('pin', () => {
    inst.expose = inst.expose || {};
    if (inst.expose[p.id]) delete inst.expose[p.id]; else inst.expose[p.id] = { label:p.label };
    if (!Object.keys(inst.expose).length) delete inst.expose;
  });
  /* a control's own label, range and lock, with the module's range as the default */
  L.bounds = ({ p, x }) => p.type === 'range' ? { lo:x.lo != null ? x.lo : p.min, hi:x.hi != null ? x.hi : p.max } : null;

  /* the controls that best carry a layer's character: the first one whose name says how much, how big or how dense */
  L.suggest = () => {
    const key = /amount|strength|intensity|size|scale|density|cell|grain|blur|contrast|warp|softness|threshold|speed|spread|offset|glow|depth|smear|noise/i;
    let n = 0;
    History.record('pin', () => {
      allInsts().forEach(({ inst }) => {
        const m = FX.byId[inst.id]; if (!m || m.cat === 'source' || (inst.expose && Object.keys(inst.expose).length) || n >= 6) return;
        const ranges = m.params.filter(p => p.type === 'range' && !(inst.bind && inst.bind[p.id]));
        const p = ranges.find(q => key.test(q.label) || key.test(q.id)) || ranges[0]; if (!p) return;
        inst.expose = { [p.id]:{ label:p.label } }; n++;
      });
    });
    return n;
  };

  /* values now, so a variation can be undone in place without rebuilding any layer */
  L.snapshot = () => L.exposed().map(e => ({ inst:e.inst, id:e.p.id, v:e.inst.params[e.p.id] }));
  L.restore = snap => snap.forEach(s => { s.inst.params[s.id] = s.v; });
  /* variation k of a seed, from the values in `snap`. strength 0 stays put, 1 may land anywhere in range. */
  L.variation = (seed, k, strength, snap) => {
    const ex = L.exposed(), out = [];
    ex.forEach((e, i) => {
      if (e.x.lock) return;
      const cur = (snap.find(s => s.inst === e.inst && s.id === e.p.id) || { v:e.inst.params[e.p.id] }).v;
      const r = h32(seed, k, i * 2 + 1), r2 = h32(seed, k, i * 2 + 2);
      let v = cur;
      if (e.p.type === 'range'){
        const { lo, hi } = L.bounds(e); v = cur + (lo + r * (hi - lo) - cur) * strength;
        v = Util.clamp(v, Math.min(lo, hi), Math.max(lo, hi));
        v = e.p.step >= 1 ? Math.round(v) : Math.round(v / e.p.step) * e.p.step; v = +v.toFixed(4);
      } else if (e.p.type === 'select'){ if (r < strength) v = Math.min(e.p.options.length - 1, Math.floor(r2 * e.p.options.length)); }
      else if (e.p.type === 'toggle'){ if (r < strength * .5) v = !cur; }
      out.push({ inst:e.inst, id:e.p.id, v });
    });
    return out;
  };
  L.apply = changes => changes.forEach(c => { c.inst.params[c.id] = c.v; });

  /* ---------- versions ----------
     Named snapshots of the pinned values, saved in the project. A diff says which pins moved.
     Layers are matched by position, so a version made before layers were reordered may not line up. */
  const keyOf = e => `${allInsts().findIndex(a => a.inst === e.inst)}:${e.p.id}`;
  L.versions = () => L.meta().versions || (L.meta().versions = []);
  L.saveVersion = name => {
    const values = {}; L.exposed().forEach(e => { values[keyOf(e)] = e.inst.params[e.p.id]; });
    const v = { name:(name || '').trim() || `Version ${L.versions().length + 1}`, made:new Date().toISOString().slice(0, 16).replace('T', ' '), values };
    L.versions().push(v); return v;
  };
  L.restoreVersion = v => History.record('variation', () => {
    L.exposed().forEach(e => { const k = keyOf(e); if (k in v.values) e.inst.params[e.p.id] = v.values[k]; });
  });
  /* what a version changed relative to now: [{ label, from, to }] for pins whose value differs */
  L.diffVersion = v => L.exposed().map(e => ({ label:e.x.label || e.p.label, key:keyOf(e), from:v.values[keyOf(e)], to:e.inst.params[e.p.id], p:e.p }))
    .filter(d => d.from !== undefined && d.from !== d.to);

  /* ---------- exports ---------- */
  const roles = () => { const cw = Identity.colourway(); return { ink:cw.ink, ground:cw.ground, accent:cw.accent, accent2:cw.accent2 }; };
  const rgbObj = hex => { const c = Util.hexToRgb(hex); return { colorSpace:'srgb', components:c.map(v => +(v / 255).toFixed(4)), hex:hex.slice(0, 7).toLowerCase() }; };
  const slug = s => String(s || 'language').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'language';
  L.slug = () => slug(L.meta().name);

  /* W3C design tokens (2025.10). Colour and motion only: a treatment stack has no token type, so it is not pretended. */
  L.tokens = () => {
    const d = Assets.identity, m = d.motion, t = { $description:`${L.meta().name || 'Language'} — colour and motion tokens from fxlab. Treatments and textures are not expressible as tokens; use the tool or the recipe.` };
    t.colour = { $type:'color' };
    Object.entries(roles()).forEach(([k, v]) => { t.colour[k] = { $value:rgbObj(v) }; });
    if (Assets.palette.length){ t.palette = { $type:'color' }; Assets.palette.forEach((c, i) => { t.palette[slug(c.name || 'colour-' + (i + 1))] = { $value:rgbObj(c.hex) }; }); }
    const names = ['expo-out', 'quint-out', 'back-out', 'elastic-out', 'circ-out', 'custom'];
    t.motion = {
      easing:{ $type:'cubicBezier', $value:m.ease === 5 ? m.bezier : [[.16, 1, .3, 1], [.22, 1, .36, 1], [.34, 1.56, .64, 1], [.16, 1, .3, 1], [0, .55, .45, 1], m.bezier][m.ease | 0].slice(0, 4), $description:`fxlab easing “${names[m.ease | 0] || 'expo-out'}”${[2, 3].includes(m.ease | 0) ? ' (approximated: the original overshoots or springs)' : ''}` },
      duration:{ $type:'duration', $value:{ value:state.duration, unit:'s' } },
      beat:{ $type:'number', $value:m.beat },
    };
    return t;
  };

  L.recipe = () => {
    const meta = L.meta();
    return { app:'fxlab-language', version:1, name:meta.name, rule:meta.rule, seed:meta.seed, made:new Date().toISOString().slice(0, 10),
      project:projectFromState(),
      identity:{ colourways:Assets.identity.colourways, active:Assets.identity.active, motion:Assets.identity.motion },
      palette:Assets.palette,
      envelope:meta.envelope || undefined,
      controls:L.exposed().map(e => ({ layer:e.where, module:e.m.name, control:e.p.label, label:e.x.label, ...(e.p.type === 'range' ? L.bounds(e) : {}) })) };
  };

  /* the tool: this app with the recipe placed in front of it. It needs the app's own source, which the build embeds. */
  const selfSource = async () => {
    if (typeof window.__FXLAB_SELF !== 'string' || !window.__FXLAB_SELF) throw new Error('This copy of fxlab can’t make tools. Use the built fxlab.html.');
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser can’t unpack the tool. Use a current Chrome, Safari or Firefox.');
    const b = Uint8Array.from(atob(window.__FXLAB_SELF), c => c.charCodeAt(0));
    return await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  };
  L.tool = async () => {
    let html = await selfSource();
    const recipe = JSON.stringify(L.recipe()).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');
    const at = html.indexOf("<script>\n'use strict';");
    if (at < 0) throw new Error('The tool template is damaged. Rebuild fxlab.');
    html = html.slice(0, at) + `<script type="application/json" id="fxlab-language">${recipe}</scr` + `ipt>\n` + html.slice(at);
    /* a tool has no picker, so it doesn't need the module thumbnails */
    const a = html.indexOf('const THUMBS = {'), b = html.indexOf('const thumbSrc');
    if (a > 0 && b > a) html = html.slice(0, a) + 'const THUMBS = {};\n' + html.slice(b);
    const name = (L.meta().name || 'Language').replace(/[<>&"]/g, '');
    return html.replace(/<title>[^<]*<\/title>/, `<title>${name} — fxlab language</title>`);
  };

  /* ---------- checking an image against the language ----------
     A statistical envelope, not a judgement: the language is rendered at several variations,
     each output is measured for tone, colour, palette fit and texture, and the spread becomes
     the range an image is compared to. It knows nothing about composition. */
  L.STATS = [
    { id:'luma', label:'Brightness', note:'mean tone' },
    { id:'contrast', label:'Contrast', note:'spread of tone' },
    { id:'sat', label:'Colour strength', note:'how saturated' },
    { id:'fit', label:'Palette fit', note:'distance to the nearest palette colour, lower is closer' },
    { id:'edge', label:'Texture', note:'fine detail and grain' },
  ];
  L.colours = () => {
    const cw = Identity.colourway(), set = [cw.ink, cw.ground, cw.accent, cw.accent2, ...Assets.palette.map(c => c.hex)].filter(Boolean);
    return [...new Set(set.map(h => h.slice(0, 7).toLowerCase()))].map(h => Util.hexToRgb(h));
  };
  L.signature = canvas => {
    const w = 96, h = Math.max(8, Math.round(96 * canvas.height / canvas.width)), c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently:true }); x.drawImage(canvas, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, pal = L.colours(), n = w * h, Y = new Float32Array(n);
    let sl = 0, ss = 0, sf = 0, se = 0;
    for (let i = 0; i < n; i++){
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], y = (.2126 * r + .7152 * g + .0722 * b) / 255; Y[i] = y; sl += y;
      ss += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
      let best = 1e9; for (const p of pal){ const dr = r - p[0], dg = g - p[1], db = b - p[2], q = dr * dr + dg * dg + db * db; if (q < best) best = q; }
      sf += pal.length ? Math.sqrt(best) / 441.7 : 0;
    }
    const mean = sl / n; let v = 0;
    for (let i = 0; i < n; i++){ v += (Y[i] - mean) ** 2; if (i % w < w - 1) se += Math.abs(Y[i] - Y[i + 1]); }
    return { luma:mean, contrast:Math.sqrt(v / n), sat:ss / n, fit:sf / n, edge:se / n };
  };
  L.envelope = sigs => {
    const env = {};
    L.STATS.forEach(({ id }) => {
      const v = sigs.map(s => s[id]), lo = Math.min(...v), hi = Math.max(...v), pad = Math.max((hi - lo) * .25, id === 'edge' ? .006 : .05);
      env[id] = [+(lo - pad).toFixed(4), +(hi + pad).toFixed(4)];
    });
    return env;
  };
  L.check = (canvas, env) => {
    const sig = L.signature(canvas);
    const rows = L.STATS.filter(s => env[s.id]).map(s => ({ ...s, value:sig[s.id], lo:env[s.id][0], hi:env[s.id][1], ok:sig[s.id] >= env[s.id][0] && sig[s.id] <= env[s.id][1] }));
    return { rows, out:rows.filter(r => !r.ok).length };
  };

  /* ---------- a link that carries the language ----------
     The recipe, compressed, in the fragment (which is never sent to a server). */
  const b64u = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = t => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  L.link = async recipe => {
    if (typeof CompressionStream === 'undefined') throw new Error('This browser can’t make a link. Save the tool instead.');
    const bytes = await new Response(new Blob([JSON.stringify(recipe)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    const t = b64u(new Uint8Array(bytes));
    return { url:location.href.split('#')[0] + '#lang=' + t, length:t.length };
  };
  L.fromHash = async hash => {
    const m = /^#lang=([\w-]+)$/.exec(hash || ''); if (!m) return null;
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser can’t open language links.');
    const text = await new Response(new Blob([unb64u(m[1])]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    const r = JSON.parse(text);
    if (!r || r.app !== 'fxlab-language') throw new Error('That link isn’t an fxlab language.');
    return r;
  };

  /* ---------- design tokens in ----------
     Reads W3C tokens (colour tokens as hex strings or colour objects). Names that say what a
     colour is for become roles; everything else goes to the palette. Motion is read if present. */
  L.importTokens = tokens => {
    const found = [];
    const hexOf = v => {
      if (typeof v === 'string') return /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v) ? v.slice(0, 7).toLowerCase() : /^#[0-9a-f]{3}$/i.test(v) ? '#' + [...v.slice(1)].map(c => c + c).join('').toLowerCase() : null;
      if (v && typeof v === 'object'){ if (typeof v.hex === 'string') return hexOf(v.hex); if (Array.isArray(v.components) && v.components.length >= 3 && (!v.colorSpace || v.colorSpace === 'srgb')) return '#' + v.components.slice(0, 3).map(c => Math.round(Util.clamp(c) * 255).toString(16).padStart(2, '0')).join(''); }
      return null;
    };
    let ease = null;
    const walk = (node, path, type) => {
      if (!node || typeof node !== 'object') return;
      const t = node.$type || type;
      if ('$value' in node){
        if (t === 'color'){ const h = hexOf(node.$value); if (h) found.push({ path, hex:h }); }
        else if (t === 'cubicBezier' && Array.isArray(node.$value) && node.$value.length === 4 && node.$value.every(n => typeof n === 'number')) ease = node.$value;
        return;
      }
      Object.keys(node).filter(k => !k.startsWith('$')).forEach(k => walk(node[k], path.concat(k), t));
    };
    walk(tokens, [], null);
    if (!found.length && !ease) throw new Error('No colours or easing found. Expected W3C design tokens with $type "color".');
    const ROLE = { ink:/(^|[-_. ])(ink|foreground|text|fg)($|[-_. ])/i, ground:/(^|[-_. ])(ground|background|surface|bg|paper)($|[-_. ])/i, accent:/(^|[-_. ])(accent|primary|brand)($|[-_. ])/i, accent2:/(^|[-_. ])(accent-?2|secondary)($|[-_. ])/i };
    const roles = {}, palette = [];
    found.forEach(f => {
      const name = f.path.join(' '), r = ['accent2', 'ink', 'ground', 'accent'].find(k => ROLE[k].test(name) && !roles[k]);
      if (r) roles[r] = f.hex;
      if (!Assets.palette.some(c => c.hex === f.hex) && !palette.some(c => c.hex === f.hex)) palette.push({ hex:f.hex, name:f.path.slice(-2).join(' ').replace(/[-_]+/g, ' ') || f.hex });
    });
    Assets.palette.push(...palette);
    const d = Assets.identity;
    if (Object.keys(roles).length){
      const base = Identity.colourway();
      d.colourways.unshift({ name:'Imported', ink:roles.ink || base.ink, ground:roles.ground || base.ground, accent:roles.accent || base.accent, accent2:roles.accent2 || roles.accent || base.accent2 });
      d.active = 0;
    } else if (palette.length){ d.colourways = []; Identity.autoSetup(); }
    if (ease){ d.motion.ease = 5; d.motion.bezier = ease; }
    Assets.saveIdentity(false);
    return { colours:found.length, roles:Object.keys(roles), ease:!!ease };
  };
  return L;
})();
