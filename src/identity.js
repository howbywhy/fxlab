/* ---------------- Identity system ----------------
   Colour roles that modules can link to instead of fixed values:
     'role:ink' 'role:ground' 'role:accent' 'role:accent2'  (from the active colourway)
   Change the colourway and every linked module updates.
   Motion tokens (easing, beat) drive modules set to "Brand".
   Stored with Assets (this browser + .fxkit kits).
--------------------------------------------------- */
const Identity = (() => {
  const I = {};
  I.COLOR_ROLES = [['ink', 'Ink'], ['ground', 'Ground'], ['accent', 'Accent'], ['accent2', 'Accent 2']];
  I.EASES = ['Expo out', 'Quint out', 'Back out', 'Elastic out', 'Circ out', 'Custom curve'];
  const FALLBACK = { name:'Default', ink:'#e4e2dc', ground:'#141516', accent:'#ff5a36', accent2:'#c9f5e4' };

  I.blank = () => ({ colourways:[], active:0, motion:{ ease:0, bezier:[.16, 1, .3, 1], beat:4 }, autoApply:true, looks:[] });
  const D = () => Assets.identity;

  /* ---------- colour maths ---------- */
  const rgb = Util.hexToRgb;
  const lum = h => { const c = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  I.contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const sat = h => { const [r, g, b] = rgb(h).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
  /* vividness: saturated and bright beats saturated and dark */
  const vivid = h => sat(h) * Math.max(...rgb(h)) / 255;
  I.readable = bg => I.contrast(bg, '#ffffff') >= I.contrast(bg, '#141516') ? '#ffffff' : '#141516';

  /* ---------- resolution ---------- */
  I.colourway = () => { const d = D(); return (d && d.colourways[d.active]) || d && d.colourways[0] || FALLBACK; };
  I.color = v => (typeof v === 'string' && v.startsWith('role:')) ? (I.colourway()[v.slice(5)] || FALLBACK[v.slice(5)] || '#ffffff') : v;
  I.roleLabel = v => {
    if (typeof v !== 'string' || !v.startsWith('role:')) return '';
    const r = v.slice(5); return (I.COLOR_ROLES.find(x => x[0] === r) || [, r])[1];
  };
  /* params with role links swapped for concrete values (what modules actually see) */
  I.resolve = (m, params) => {
    let out = null;
    for (const p of m.params){
      const v = params[p.id];
      if (typeof v !== 'string' || !v.startsWith('role:')) continue;
      out = out || { ...params };
      out[p.id] = p.type === 'color' ? I.color(v) : v;
    }
    return out || params;
  };

  /* ---------- motion tokens ---------- */
  function bezier(x1, y1, x2, y2){
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t, dx = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x; for (let i = 0; i < 6; i++){ const e = sx(t) - x, d = dx(t); if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break; t -= e / d; }
      t = Math.min(1, Math.max(0, t)); return sy(t);
    };
  }
  const back = x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const elastic = x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -9 * x) * Math.sin((x * 9 - .75) * (Math.PI * 2 / 3)) + 1;
  const expo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
  let bzKey = '', bzFn = null;
  I.ease = x => {
    x = Math.min(1, Math.max(0, x));
    const m = D() ? D().motion : I.blank().motion;
    switch (m.ease | 0){
      case 1: return 1 - Math.pow(1 - x, 5);
      case 2: return back(x);
      case 3: return elastic(x);
      case 4: return Math.sqrt(1 - Math.pow(x - 1, 2));
      case 5: { const k = m.bezier.join(','); if (k !== bzKey){ bzKey = k; bzFn = bezier(...m.bezier); } return bzFn(x); }
      default: return expo(x);
    }
  };
  I.easeInOut = x => x < .5 ? (1 - I.ease(1 - 2 * x)) / 2 : (1 + I.ease(2 * x - 1)) / 2;
  I.beat = () => Math.max(1, (D() ? D().motion.beat : 4) | 0);

  /* ---------- defaults for new modules ---------- */
  const COLOR_MAP = { ink:['color', 'ink', 'fg', 'ink1', 'c1', 'nameColor'], ground:['bg', 'boxColor', 'barText', 'ground2', 'bg2'], accent:['accent', 'ink2', 'c2', 'tape', 'hot', 'cell', 'echoColor', 'em', 'mark', 'bar', 'on'], accent2:['ink3', 'chip', 'color2'] };
  I.linkedDefault = p => {
    const d = D(); if (!d || !d.autoApply) return undefined;
    const hasCw = d.colourways.length > 0;
    if (p.type === 'color'){
      if (p.role === false) return undefined;                      /* module opted out (paper, pen inks) */
      if (typeof p.role === 'string' && hasCw) return 'role:' + p.role;
      if (hasCw) for (const [role, ids] of Object.entries(COLOR_MAP)) if (ids.includes(p.id)) return 'role:' + role;
    }
    if (p.type === 'select' && p.id === 'easing' && p.options.includes('Brand')) return p.options.indexOf('Brand');
    return undefined;
  };
  I.active = () => { const d = D(); return !!(d && d.colourways.length); };

  /* ---------- build a starting system from the palette ---------- */
  I.autoSetup = (force = false) => {
    const d = D(); let changed = false;
    const pal = Assets.palette.map(c => c.hex);
    if ((force || !d.colourways.length) && pal.length){
      const nameOf = hex => (Assets.palette.find(c => c.hex === hex) || {}).name || hex.toUpperCase();
      const dark = pal.filter(h => lum(h) < .03).sort((a, b) => lum(a) - lum(b))[0] || '#141516';
      const grounds = [dark, ...pal.filter(h => h !== dark && lum(h) < .85).sort((a, b) => vivid(b) - vivid(a))].slice(0, 4);
      d.colourways = grounds.map(g => {
        const others = pal.filter(h => h !== g);
        const inkPal = others.filter(h => I.contrast(h, g) >= 3).sort((a, b) => I.contrast(b, g) - I.contrast(a, g))[0];
        const ink = inkPal || I.readable(g);
        const rest = others.filter(h => h !== ink);
        const accent = rest.filter(h => I.contrast(h, g) >= 1.6).sort((a, b) => vivid(b) - vivid(a))[0] || rest[0] || (ink === '#ffffff' ? '#141516' : '#ffffff');
        const accent2 = rest.filter(h => h !== accent).sort((a, b) => I.contrast(b, g) - I.contrast(a, g))[0] || ink;
        return { name:g === dark && !pal.includes(dark) ? 'Night' : nameOf(g), ink, ground:g, accent, accent2 };
      });
      d.active = 0; changed = true;
    }
    return changed;
  };
  return I;
})();
