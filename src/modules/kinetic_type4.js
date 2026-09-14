/* ---------------- Kinetic type IV ---------------- */

/* ---- Extruded ---- */
FX.register({ id:'kt-3d', name:'Extruded', cat:'type', kind:'2d', nonLocal:true, desc:'Type built as a solid with real depth, turning in perspective with shaded sides.',
  params:[ ...KT.typeParams('DEPTH'), R('margin','Margin',.12,0,.4), R('leading','Leading',.95,.6,2), R('depth','Depth',.35,0,1.5), R('turn','Turn',35,-180,180,1), R('tilt','Tilt',-8,-60,60,1), S('drive','Motion',['Static','Turn with the loop','Swing','Turn in with the timeline'],2), I('speed','Loops per cycle',1,1,6), R('perspective','Perspective',.6,0,2),
    S('shading','Sides',['Flat','Shaded','Striped','Gradient'],1), I('slices','Smoothness',26,4,80), T('outline','Outline the face',false), R('stroke','Outline weight',1,.2,5),
    C('ink','Face','#e4e2dc'), C('accent','Sides','#ff5a36'), C('accent2','Far side','#8a2f1d'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P); if (!text.trim()) return;
    const B = TypeBlock.get(ctx, P, text, w, h, { margin:P.margin, leading:P.leading });
    const size = B.size, cx = w / 2, cy = h / 2;
    let a = P.turn * Math.PI / 180, tilt = P.tilt * Math.PI / 180;
    const drive = P.drive | 0, sp = P.speed | 0;
    if (drive === 1) a += api.loop * KT.TAU * sp;
    else if (drive === 2) a = Math.sin(api.loop * KT.TAU * sp) * P.turn * Math.PI / 180;
    else if (drive === 3) a *= 1 - KT.ease.expo(Util.clamp(api.p));
    const depth = P.depth * size, slices = Math.max(4, P.slices | 0), f = size * 9 / Math.max(.05, P.perspective);
    const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(tilt), st = Math.sin(tilt);
    const proj = (x, y, z) => {
      const X = x * ca + z * sa, Z = -x * sa + z * ca;
      const Y = y * ct - Z * st, Z2 = y * st + Z * ct;
      const s = f / (f + Z2);
      return [cx + X * s, cy + Y * s, Z2];
    };
    const glyphs = B.glyphs.map(g => ({ g, cxg: g.ox - cx + g.w / 2 }));
    /* back-to-front: draw the extrusion slices, then the face */
    const shade = P.shading | 0;
    const path = (g, z) => {
      const p = new Path2D();
      for (const c of g.contours){
        if (c.length < 4) continue;
        for (let i = 0; i < c.length; i += 2){
          const [X, Y] = proj(g.ox - cx + c[i], g.oy - cy + c[i + 1], z);
          i ? p.lineTo(X, Y) : p.moveTo(X, Y);
        }
        p.closePath();
      }
      return p;
    };
    for (let i = slices; i >= 1; i--){
      const t = i / slices, z = depth * t;
      let col;
      if (shade === 0) col = P.accent;
      else if (shade === 1) col = KT.mixHex(P.accent, P.accent2, t * (.5 + .5 * Math.abs(sa)));
      else if (shade === 2) col = (i % 2) ? P.accent : P.accent2;
      else col = KT.mixHex(P.accent, P.accent2, t);
      ctx.fillStyle = col;
      for (const { g } of glyphs) ctx.fill(path(g, z), 'evenodd');
    }
    ctx.fillStyle = P.ink; ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(1, size * .01 * P.stroke); ctx.lineJoin = 'round';
    for (const { g } of glyphs){ const p = path(g, 0); P.outline ? ctx.stroke(p) : ctx.fill(p, 'evenodd'); }
  } });

/* ---- Ribbon ---- */
FX.register({ id:'kt-ribbon', name:'Ribbon', cat:'type', kind:'2d', desc:'Text running along a waving ribbon in perspective — letters turn away, fade and shrink with depth. Loops seamlessly.',
  params:[ ...KT.typeParams('RIBBON OF TYPE · '), R('size','Type size',10,2,24,.1), R('amp','Wave height',.12,0,.5), R('freq','Waves',1.2,.3,5), R('twist','Twist',.7,0,2), R('depth','Depth',.6,0,2), I('speed','Loops per cycle',1,-6,6), R('y','Y',0,-1,1),
    T('band','Draw the ribbon',true), R('bandWidth','Ribbon width',1.35,.5,4), R('fade','Fade with depth',.6,0,1),
    C('ink','Ink','#e4e2dc'), C('accent','Ribbon','#ff5a36'), C('accent2','Ribbon back','#8a2f1d'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P).replace(/\n/g, ' '); if (!text.trim()) return;
    const size = P.size / 100 * Math.min(w, h);
    ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size);
    const unit = KT.layout(ctx, text, { font:ctx.font, size, tracking:0 }).lines[0];
    if (!unit.width) return;
    const reps = Math.max(1, Math.ceil(w * 1.6 / unit.width) + 1), total = reps * unit.width;
    const shift = ((api.loop * (P.speed | 0)) % 1 + 1) % 1 * unit.width;
    const cy = (.5 - P.y * .5) * h;
    const at = x => {
      const u = x / w;
      const yy = cy + Math.sin(u * KT.TAU * P.freq - api.loop * KT.TAU) * P.amp * h;
      const z = Math.cos(u * KT.TAU * P.freq - api.loop * KT.TAU) * P.depth;
      const dy = Math.cos(u * KT.TAU * P.freq - api.loop * KT.TAU) * P.amp * h * KT.TAU * P.freq / w;
      return { y:yy, z, slope:dy, scale:1 / (1 + z * .45), twist:Math.sin(u * KT.TAU * P.freq - api.loop * KT.TAU + Math.PI / 2) * P.twist };
    };
    if (P.band){
      const bw = M.cap * P.bandWidth;
      for (let x = -unit.width; x < w + unit.width; x += 8){
        const s0 = at(x), s1 = at(x + 8);
        const front = s0.z < 0;
        ctx.fillStyle = front ? P.accent : P.accent2;
        ctx.globalAlpha = 1 - Util.clamp(s0.z * .4) * P.fade;
        const hw0 = bw * s0.scale * Math.abs(Math.cos(s0.twist)) * .5, hw1 = bw * s1.scale * Math.abs(Math.cos(s1.twist)) * .5;
        ctx.beginPath();
        ctx.moveTo(x, s0.y - hw0); ctx.lineTo(x + 8, s1.y - hw1);
        ctx.lineTo(x + 8, s1.y + hw1); ctx.lineTo(x, s0.y + hw0); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (let r = -1; r < reps; r++) unit.glyphs.forEach(g => {
      if (g.space) return;
      let x = r * unit.width + g.x + shift;
      if (x < -unit.width || x > w + unit.width) return;
      const s = at(x + g.w / 2);
      ctx.save();
      ctx.translate(x + g.w / 2, s.y);
      ctx.rotate(Math.atan(s.slope * P.amp));
      ctx.scale(s.scale * Math.max(.05, Math.abs(Math.cos(s.twist))), s.scale);
      ctx.globalAlpha = 1 - Util.clamp((s.z + P.depth) / (2 * P.depth + .001)) * P.fade * .8;
      ctx.fillStyle = P.ink;
      ctx.fillText(g.ch, -g.w / 2, M.cap / 2);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    void total;
  } });

/* ---- Collage ---- */
FX.register({ id:'kt-collage', name:'Collage', cat:'type', kind:'2d', nonLocal:true, desc:'Cut-up lettering: every letter a different font, size, angle and colour, on torn paper scraps.',
  params:[ X('text','Text','CUT\nIT UP',true), T('upper','Uppercase',true), S('weight','Weight',Util.weights,4), R('margin','Margin',.1,0,.4), R('leading','Leading',1.05,.6,2),
    R('jitter','Angle jitter',10,0,45), R('sizeJitter','Size jitter',.35,0,1), R('shift','Position jitter',.25,0,1), T('mixFonts','Mix your fonts',true), S('scraps','Scraps',['None','Rectangles','Torn paper','Boxes behind words'],2), R('scrapPad','Scrap padding',.3,0,1),
    S('motion','Motion',['Pop in','Jitter on the beat','Both','Still'],2), I('beats','Beats per loop (0 = brand)',0,0,32), I('seed','Seed',5,1,99),
    T('palette','Colours from palette',true), C('ink','Ink','#141516', false), C('accent','Scrap','#e4e2dc', false), C('accent2','Second scrap','#ff5a36'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const raw = String(P.text); const text = P.upper ? raw.toUpperCase() : raw;
    if (!text.trim()) return;
    const fonts = Assets.fonts().map(f => 'asset:' + f.id);
    const pool = P.mixFonts && fonts.length ? fonts.concat(['Helvetica', 'Serif', 'Mono']) : [Identity.fontRef('role:display')];
    const beats = KT.beats(P.beats), beat = Math.floor(api.loop * beats), motion = P.motion | 0;
    const jseed = (motion === 1 || motion === 2) ? beat : 0, seed = P.seed | 0;
    const mg = P.margin * w, lines = text.split('\n');
    const base = { font:pool[0], weight:P.weight, upper:false };
    let size = KT.fit(ctx, base, text, (w - mg * 2) / (1 + P.sizeJitter * .35), (h - mg * 2), P.leading);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const items = [];
    lines.forEach((ln, li) => {
      const chars = [...ln]; let x = 0;
      const metrics = chars.map((ch, i) => {
        const idx = li * 31 + i;
        const font = pool[Math.floor(KT.rnd(idx, seed) * pool.length) % pool.length];
        const s = size * (1 + (KT.rnd(idx + 7, seed) - .5) * P.sizeJitter);
        const fp = { font, weight:P.weight, upper:false };
        ctx.font = KT.font(fp, s);
        const wd = ch === ' ' ? s * .3 : ctx.measureText(ch).width;
        const m = { ch, fp, s, wd, x, li, idx };
        x += wd * (1 + P.scrapPad * .25);
        return m;
      });
      metrics.forEach(m => { m.lineW = x; });
      items.push(...metrics);
    });
    const lineH = size * P.leading * 1.25, top = h / 2 - (lines.length - 1) * lineH / 2;
    const n = items.length;
    items.forEach((m, i) => {
      if (m.ch === ' ') return;
      const lp = motion === 0 || motion === 2 ? KT.stagger(api.p, i, n, .5) : 1;
      if (lp <= 0) return;
      const e = KT.ease.back(lp);
      const jx = (KT.rnd(m.idx + jseed * 13, seed) - .5) * P.shift * m.s * .5;
      const jy = (KT.rnd(m.idx + 77 + jseed * 13, seed) - .5) * P.shift * m.s * .5;
      const rot = (KT.rnd(m.idx + 3 + jseed * 5, seed) - .5) * 2 * P.jitter * Math.PI / 180;
      const x = (w - m.lineW) / 2 + m.x + m.wd / 2 + jx, y = top + m.li * lineH + jy;
      ctx.font = KT.font(m.fp, m.s); const M = KT.metrics(ctx, m.s);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(e, e);
      const scrap = P.scraps | 0;
      if (scrap){
        const pad = m.s * (.12 + P.scrapPad * .35);
        const bw = m.wd + pad * 2, bh = M.cap + pad * 2;
        ctx.fillStyle = P.palette ? Brand.paletteColor(m.idx, seed + 3, P.accent) : (m.idx % 3 === 0 ? P.accent2 : P.accent);
        if (scrap === 2){
          ctx.beginPath();
          const steps = 12;
          for (let k = 0; k <= steps; k++){ const t = k / steps; const px = -bw / 2 + bw * t, py = -bh / 2 - (KT.rnd(m.idx * 17 + k, seed) - .5) * pad * .8; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          for (let k = 0; k <= steps; k++){ const t = k / steps; const px = bw / 2 + (KT.rnd(m.idx * 29 + k, seed) - .5) * pad * .6, py = -bh / 2 + bh * t; ctx.lineTo(px, py); }
          for (let k = 0; k <= steps; k++){ const t = k / steps; const px = bw / 2 - bw * t, py = bh / 2 + (KT.rnd(m.idx * 41 + k, seed) - .5) * pad * .8; ctx.lineTo(px, py); }
          for (let k = 0; k <= steps; k++){ const t = k / steps; const px = -bw / 2 + (KT.rnd(m.idx * 53 + k, seed) - .5) * pad * .6, py = bh / 2 - bh * t; ctx.lineTo(px, py); }
          ctx.closePath(); ctx.fill();
        } else ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      }
      ctx.fillStyle = scrap ? P.ink : (P.palette ? Brand.paletteColor(m.idx + 5, seed, P.ink) : P.ink);
      ctx.fillText(m.ch, -m.wd / 2, M.cap / 2);
      ctx.restore();
    });
  } });

/* ---- Knockout ---- */
FX.register({ id:'kt-knockout', name:'Knockout', cat:'type', desc:'Type cut out of a colour block to show the frame through it, or filled with the frame over a solid ground — with parallax and an optional outline.', search:['window'],
  params:[ ...KT.typeParams('WINDOW'), R('margin','Margin',.08,0,.4), R('tracking','Tracking',-.01,-.2,.5), R('leading','Leading',.92,.6,2), S('mode','Mode',['Knock type out of a block','Fill type with the frame'],0), R('block','Block size',1,.2,1), S('blockShape','Block',['Full frame','Panel','Circle'],0),
    R('parallax','Parallax',.04,0,.3), R('zoom','Frame zoom',1.1,1,2), I('speed','Loops per cycle',1,0,6), R('outline','Outline',0,0,.06), R('shadow','Drop shadow',0,0,.2),
    C('ink','Block / ink','#ff5a36','accent'), C('accent','Outline','#e4e2dc') ],
  auxSize(P, w, h){ const s = Math.min(1, Math.max(1800, Engine.auxCap) / Math.max(w, h)); return [Math.round(w * s), Math.round(h * s)]; },
  aux(ctx, P, w, h){
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const text = KT.text(P); if (!text.trim()) return;
    const mg = P.margin * w, size = KT.fit(ctx, P, text, w - mg * 2, h - mg * 2, P.leading, P.tracking);
    const font = KT.font(P, size); ctx.font = font;
    const L = KT.layout(ctx, text, { font, size, tracking:P.tracking }), M = KT.metrics(ctx, size);
    const pos = KT.place(L, { size, leading:P.leading, cap:M.cap, align:1, x:w / 2, y:h / 2 });
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    L.lines.forEach((ln, i) => ln.glyphs.forEach(g => ctx.fillText(g.ch, pos[i].x + g.x, pos[i].y)));
  },
  fs:`vec4 fx(vec2 uv){
  vec2 drift = vec2(sin(uLoop * TAU * p_speed), cos(uLoop * TAU * p_speed)) * p_parallax;
  vec2 q = (uv - .5) / max(p_zoom, 1.) + .5 + drift * .5;
  vec3 frame = texture(uInput, q).rgb;
  float m = texture(uAux, uv).r;
  float o = 0.;
  if (p_outline > .001){
    float r = p_outline;
    for (int i = 0; i < 12; i++){ float a = TAU * float(i) / 12.; o = max(o, texture(uAux, uv + vec2(cos(a), sin(a) * aspect()) * r).r); }
    o = clamp(o - m, 0., 1.);
  }
  float sh = 0.;
  if (p_shadow > .001) sh = texture(uAux, uv - vec2(p_shadow, -p_shadow * aspect()) * .4).r;
  vec2 c = centered(uv);
  float block = 1.;
  int bs = int(p_blockShape + .5);
  if (bs == 1) block = step(abs(c.x), p_block * .5 * aspect()) * step(abs(c.y), p_block * .5);
  else if (bs == 2) block = 1. - smoothstep(p_block * .5 - .004, p_block * .5 + .004, length(c));
  vec3 col;
  if (p_mode < .5){
    vec3 base = texture(uInput, uv).rgb;
    vec3 panel = mix(base, p_ink, block);
    panel = mix(panel, base * .55, clamp(sh - m, 0., 1.) * block * 2.);
    col = mix(panel, frame, m * block);
    col = mix(col, base, (1. - block) * 0.);
  } else {
    col = mix(p_ink, frame, m);
    col = mix(col, p_ink * .6, clamp(sh - m, 0., 1.) * .8);
  }
  col = mix(col, p_accent, o);
  return vec4(col, 1.);
}` });

/* ---- Fold ---- */
FX.register({ id:'kt-fold', name:'Fold', cat:'type', kind:'2d', desc:'Letters folded out of flat strips like a paper sign, with shading on each panel.',
  params:[ ...KT.typeParams('UNFOLD'), R('margin','Margin',.1,0,.4), R('leading','Leading',.95,.6,2), I('panels','Panels',6,2,20), S('axis','Fold',['Horizontal','Vertical'],0), S('drive','Motion',['Unfold with the timeline','Fold & unfold (loop)','Ripple'],0), R('stagger','Stagger',.45,0,1), S('easing','Easing',KT.EASES,4), R('shade','Shading',.6,0,1.5), T('alternate','Alternate direction',true),
    C('ink','Ink','#e4e2dc'), C('accent','Fold shadow','#8a2f1d'), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const text = KT.text(P); if (!text.trim()) return;
    const mg = P.margin * w, size = KT.fit(ctx, P, text, w - mg * 2, h - mg * 2, P.leading);
    ctx.font = KT.font(P, size); const M = KT.metrics(ctx, size);
    const L = KT.layout(ctx, text, { font:ctx.font, size, tracking:0 }), pos = KT.place(L, { size, leading:P.leading, cap:M.cap, align:1, x:w / 2, y:h / 2 });
    const E = KT.easeBy(P.easing), n = Math.max(2, P.panels | 0), vertical = (P.axis | 0) === 1, drive = P.drive | 0;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    L.lines.forEach((ln, li) => {
      const y0 = pos[li].y - M.cap - size * .2, bh = M.cap + M.desc + size * .4;
      const x0 = pos[li].x - size * .12, bw = ln.width + size * .24;
      const span = vertical ? bw : bh, start0 = vertical ? x0 : y0, panel = span / n;
      /* how open each panel is */
      const open = [];
      for (let i = 0; i < n; i++){
        if (drive === 0) open.push(E(KT.stagger(api.p, i, n, P.stagger)));
        else if (drive === 1) open.push(E(KT.stagger(Math.pow(Math.sin(api.loop * Math.PI), 2), i, n, P.stagger)));
        else open.push(.5 + .5 * Math.sin(api.loop * KT.TAU - i / n * Math.PI * 2));
      }
      const total = open.reduce((a, k) => a + panel * Math.max(.001, k), 0);
      let acc = (vertical ? x0 + bw / 2 : y0 + bh / 2) - total / 2;
      for (let i = 0; i < n; i++){
        const k = Math.max(.001, open[i]), srcTop = start0 + panel * i, len = panel * k;
        ctx.save();
        ctx.beginPath();
        if (vertical) ctx.rect(acc, y0 - 2, len + .6, bh + 4); else ctx.rect(x0 - 2, acc, bw + 4, len + .6);
        ctx.clip();
        /* map the source strip onto the folded strip */
        if (vertical){ ctx.translate(acc - srcTop * k, 0); ctx.scale(k, 1); }
        else { ctx.translate(0, acc - srcTop * k); ctx.scale(1, k); }
        ctx.fillStyle = P.ink;
        ctx.fillText(ln.str, pos[li].x, pos[li].y);
        ctx.restore();
        const dir = P.alternate && i % 2 ? .55 : 1;
        const shade = (1 - k) * P.shade * dir;
        if (shade > .01){
          ctx.save();
          ctx.beginPath();
          if (vertical) ctx.rect(acc, y0 - 2, len + .6, bh + 4); else ctx.rect(x0 - 2, acc, bw + 4, len + .6);
          ctx.clip();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.globalAlpha = Util.clamp(shade);
          ctx.fillStyle = P.accent;
          ctx.fillRect(x0 - 4, y0 - 4, bw + 8, bh + 8);
          ctx.restore();
        }
        acc += len;
      }
    });
  } });
