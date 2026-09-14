/* ---------------- Identity system ----------------
   Brand roles that modules can link to instead of fixed values:
     colours  'role:ink' 'role:ground' 'role:accent' 'role:accent2'  (from the active colourway)
     fonts    'role:display' 'role:text'
     logos    'role:logo' 'role:symbol' 'role:wordmark'
   Change the colourway, font or logo role and every linked module updates.
   Motion tokens (easing, slant, beat) drive modules set to "Brand".
   Stored with Assets (this browser + .fxkit kits).
--------------------------------------------------- */
const Identity = (() => {
  const I = {};
  I.COLOR_ROLES = [['ink', 'Ink'], ['ground', 'Ground'], ['accent', 'Accent'], ['accent2', 'Accent 2']];
  I.FONT_ROLES = [['display', 'Display'], ['text', 'Text']];
  I.LOGO_ROLES = [['logo', 'Primary logo'], ['symbol', 'Symbol'], ['wordmark', 'Wordmark']];
  I.EASES = ['Expo out', 'Quint out', 'Back out', 'Elastic out', 'Circ out', 'Custom curve'];
  const FALLBACK = { name:'Default', ink:'#e4e2dc', ground:'#141516', accent:'#ff5a36', accent2:'#c9f5e4' };

  I.blank = () => ({ colourways:[], active:0, type:{ display:'', text:'' }, logos:{ logo:'', symbol:'', wordmark:'' },
    motion:{ ease:0, bezier:[.16, 1, .3, 1], slant:1, beat:4 }, autoApply:true, looks:[] });
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
  I.fontRef = v => {
    if (typeof v !== 'string' || !v.startsWith('role:')) return v;
    const d = D(), r = v.slice(5), ref = d && d.type[r];
    if (ref && (!ref.startsWith('asset:') || Assets.get(ref))) return ref;
    const f = Assets.pickFont(); return f ? 'asset:' + f.id : 'Helvetica';
  };
  I.logoRef = v => {
    if (typeof v !== 'string' || !v.startsWith('role:')) return v;
    const d = D(), r = v.slice(5), ref = d && (d.logos[r] || d.logos.logo || d.logos.symbol);
    if (ref && Assets.get(ref)) return ref;
    const im = Assets.images()[0]; return im ? 'asset:' + im.id : '';
  };
  I.roleLabel = v => {
    if (typeof v !== 'string' || !v.startsWith('role:')) return '';
    const r = v.slice(5); return ([...I.COLOR_ROLES, ...I.FONT_ROLES, ...I.LOGO_ROLES].find(x => x[0] === r) || [, r])[1];
  };
  /* params with role links swapped for concrete values (what modules actually see) */
  I.resolve = (m, params) => {
    let out = null;
    for (const p of m.params){
      const v = params[p.id];
      if (typeof v !== 'string' || !v.startsWith('role:')) continue;
      out = out || { ...params };
      out[p.id] = p.type === 'color' ? I.color(v) : p.type === 'font' ? I.fontRef(v) : p.type === 'asset' ? I.logoRef(v) : v;
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
  let bzKey = '', bzFn = null;
  I.ease = x => {
    x = Math.min(1, Math.max(0, x));
    const m = D() ? D().motion : I.blank().motion;
    switch (m.ease | 0){
      case 1: return 1 - Math.pow(1 - x, 5);
      case 2: return KT.ease.back(x);
      case 3: return KT.ease.elastic(x);
      case 4: return Math.sqrt(1 - Math.pow(x - 1, 2));
      case 5: { const k = m.bezier.join(','); if (k !== bzKey){ bzKey = k; bzFn = bezier(...m.bezier); } return bzFn(x); }
      default: return KT.ease.expo(x);
    }
  };
  I.easeInOut = x => x < .5 ? (1 - I.ease(1 - 2 * x)) / 2 : (1 + I.ease(2 * x - 1)) / 2;
  I.slant = () => (D() ? D().motion.slant : 1);
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
    if (p.type === 'font' && (d.type.display || Assets.fonts().length)) return p.role ? 'role:' + p.role : 'role:display';
    if (p.type === 'asset' && p.auto && Assets.images().length) return 'role:' + (typeof p.auto === 'string' ? p.auto : 'logo');
    if (p.type === 'select' && p.id === 'easing' && p.options.includes('Brand')) return p.options.indexOf('Brand');
    return undefined;
  };
  I.active = () => { const d = D(); return !!(d && (d.colourways.length || d.type.display || d.logos.logo)); };

  /* ---------- build a starting system from the assets ---------- */
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
    const fonts = Assets.fonts();
    if (fonts.length && (force || !d.type.display)){
      const disp = Assets.pickFont(), first = s => s.name.split(' ')[0].toLowerCase();
      const text = fonts.find(f => first(f) !== first(disp)) || disp;
      d.type.display = 'asset:' + disp.id; d.type.text = 'asset:' + text.id; changed = true;
    }
    const imgs = Assets.images();
    if (imgs.length && (force || !d.logos.logo)){
      const ink = I.colourway().ink;
      const pick = re => {
        const hits = imgs.filter(a => re.test(a.name + ' ' + a.file));
        if (!hits.length) return null;
        return hits.find(a => a.colors && a.colors.length === 1 && a.colors[0] === ink) || hits.find(a => /white/i.test(a.name)) || hits[0];
      };
      const logo = pick(/marketing|lockup|primary|master|combination/i) || pick(/logotype|wordmark|logo/i) || imgs[0];
      const symbol = pick(/symbol|icon|monogram|\bmark\b|glyph/i) || logo;
      const wordmark = pick(/logotype/i) || pick(/wordmark|type/i) || logo;
      d.logos = { logo:'asset:' + logo.id, symbol:'asset:' + symbol.id, wordmark:'asset:' + wordmark.id }; changed = true;
    }
    return changed;
  };
  return I;
})();
