/* ---------------- Logo & brand ----------------
   Logos come from the Assets tab (L params). Everything draws nothing
   until a logo is chosen.
------------------------------------------------ */
FX.register({ id:'lg-logo', name:'Logo', cat:'logo', kind:'2d', noRandom:true, desc:'Place a logo with an entrance on the timeline and an optional looping motion.',
  params:[ L('logo','Logo'), R('size','Width',40,2,120,.1), R('x','X',0,-1,1), R('y','Y',0,-1,1), R('rotate','Rotate',0,-180,180,1), R('opacity','Opacity',1,0,1), T('tint','Tint',false), C('color','Tint colour','#ffffff'), S('blend','Blend',['Normal','Multiply','Screen','Overlay','Difference']),
    S('entry','Entrance',['None','Fade','Scale pop','Rise','Wipe','Spin in','Slam']), S('easing','Easing',KT.EASES), S('motion','Loop motion',['None','Float','Pulse','Spin','Sway','Bounce']), R('amount','Motion amount',.5,0,2), I('speed','Loops per cycle',1,1,6) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api;
    const [ww, hh] = Brand.size(ctx, P, 'logo', w, h, P.size / 100); if (!ww) return;
    const E = KT.easeBy(P.easing), p = Util.clamp(api.p), e = E(p), en = P.entry | 0, mn = Math.min(w, h);
    let x = (.5 + P.x * .5) * w, y = (.5 - P.y * .5) * h, sc = 1, rot = P.rotate * Math.PI / 180, alpha = P.opacity;
    if (en === 1) alpha *= p;
    else if (en === 2){ sc = Math.max(0, e); alpha *= Util.clamp(p * 4); }
    else if (en === 3){ y += (1 - e) * mn * .25; alpha *= Util.clamp(p * 3); }
    else if (en === 5){ rot += (1 - e) * -Math.PI; sc = .3 + .7 * e; alpha *= Util.clamp(p * 3); }
    else if (en === 6){ sc = 1 + (1 - KT.ease.expo(p)) * 3; alpha *= Util.clamp(p * 2.5); }
    const ph = api.loop * (P.speed | 0) * KT.TAU, amt = P.amount, mo = P.motion | 0;
    if (mo === 1) y += Math.sin(ph) * amt * mn * .04;
    else if (mo === 2) sc *= 1 + Math.sin(ph) * amt * .06;
    else if (mo === 3) rot += api.loop * (P.speed | 0) * KT.TAU;
    else if (mo === 4) rot += Math.sin(ph) * amt * .25;
    else if (mo === 5) y -= Math.abs(Math.sin(ph / 2)) * amt * mn * .12;
    ctx.save();
    ctx.globalAlpha = Util.clamp(alpha); ctx.globalCompositeOperation = Brand.BLEND[P.blend | 0];
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
    if (en === 4){ ctx.beginPath(); ctx.rect(-ww / 2, -hh / 2 - 2, ww * e, hh + 4); ctx.clip(); }
    Brand.logo(ctx, P, 'logo', 0, 0, ww, P.tint ? P.color : null);
    ctx.restore();
  } });

FX.register({ id:'lg-pattern', name:'Logo pattern', cat:'logo', kind:'2d', desc:'A logo tiled into a scrolling brand pattern with pops and alternating colours.', search:['repeat'],
  params:[ L('logo','Logo','symbol'), I('cols','Columns',5,1,24), R('gap','Spacing',.6,0,3), T('brick','Offset rows',true), R('angle','Angle',0,-45,45,1), S('scroll','Scroll',['None','Up','Down','Left','Right']), I('speed','Loops per cycle',1,0,6),
    S('pop','Pop',['None','Wave','Checker blink','Random']), R('popAmt','Pop amount',.5,0,1), T('tint','Tint',true), C('c1','Colour 1','#e4e2dc'), C('c2','Colour 2','#ff5a36'), T('alternate','Alternate colours',true), ...KT.groundParams(1) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const src = Assets.image(P.logo); if (!src) return;
    const cols = Math.max(1, P.cols | 0), pitchX = w / cols, lw = pitchX / (1 + P.gap), lh = lw * src.height / src.width;
    const pitchY = Math.max(lh * (1 + P.gap), 4), Ld = Math.hypot(w, h);
    const sp = P.speed | 0, sc = P.scroll | 0;
    const periodY = P.brick ? pitchY * 2 : pitchY;
    const ox = sc === 3 ? -api.loop * sp * pitchX : sc === 4 ? api.loop * sp * pitchX : 0;
    const oy = sc === 1 ? -api.loop * sp * periodY : sc === 2 ? api.loop * sp * periodY : 0;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(P.angle * Math.PI / 180);
    const nx = Math.ceil(Ld / pitchX) + 2, ny = Math.ceil(Ld / pitchY) + 3;
    for (let j = -ny; j <= ny; j++) for (let i = -nx; i <= nx; i++){
      const rowShift = P.brick && (j & 1) ? pitchX / 2 : 0;
      const x = i * pitchX + rowShift + (((ox % pitchX) + pitchX) % pitchX);
      const y = j * pitchY + (((oy % periodY) + periodY) % periodY);
      if (Math.abs(x) > Ld / 2 + pitchX || Math.abs(y) > Ld / 2 + pitchY) continue;
      const jj = j - Math.round((((oy % periodY) + periodY) % periodY) / pitchY);
      let s = 1; const pop = P.pop | 0;
      if (pop === 1) s = 1 - P.popAmt * (.5 + .5 * Math.sin(KT.TAU * (api.loop * Math.max(1, sp) - (x + y) / Ld)));
      else if (pop === 2) s = ((i + j) & 1) === (Math.floor(api.loop * 4 * Math.max(1, sp)) & 1) ? 1 : 1 - P.popAmt;
      else if (pop === 3) s = 1 - P.popAmt * Math.max(0, Math.sin(KT.TAU * (api.loop * Math.max(1, sp) + KT.rnd(i * 17 + jj * 131, 9))));
      if (s <= .01) continue;
      const col = P.alternate && ((i + jj) & 1) ? P.c2 : P.c1;
      Brand.logo(ctx, P, 'logo', x, y, lw * s, P.tint ? col : null);
    }
    ctx.restore();
  } });

FX.register({ id:'lg-stamp', name:'Logo stamp', cat:'logo', kind:'2d', desc:'Logos stamp in one by one and pile up, then clear at the loop point.',
  params:[ L('logo','Logo','symbol'), I('count','Count',18,1,120), S('layout','Layout',['Scatter','Grid','Spiral']), R('minSize','Min width',10,2,80,.1), R('maxSize','Max width',24,2,120,.1), R('jitter','Rotation jitter',25,0,180,1), R('hold','Hold at end',.25,0,.8),
    S('pop','Stamp',['Scale pop','Slam','Fade']), T('tint','Tint',true), T('palette','Colours from palette',true), C('color','Colour','#ff5a36'), I('seed','Seed',1,1,99), ...KT.groundParams(0) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const src = Assets.image(P.logo); if (!src) return;
    const n = Math.max(1, P.count | 0), span = 1 - P.hold, seed = P.seed | 0, lay = P.layout | 0;
    const g = Math.ceil(Math.sqrt(n * w / h)), gr = Math.ceil(n / g);
    for (let i = 0; i < n; i++){
      const t0 = i / n * span, lp = Util.clamp((api.loop - t0) / .06);
      if (lp <= 0) continue;
      let x, y;
      if (lay === 0){ x = (.08 + .84 * KT.rnd(i, seed)) * w; y = (.08 + .84 * KT.rnd(i + 99, seed)) * h; }
      else if (lay === 1){ x = ((i % g) + .5) / g * w; y = (Math.floor(i / g) + .5) / gr * h; }
      else { const a = i * 2.39996, r = Math.sqrt((i + .5) / n) * .46; x = w / 2 + Math.cos(a) * r * Math.min(w, h); y = h / 2 + Math.sin(a) * r * Math.min(w, h); }
      const size = (P.minSize + (P.maxSize - P.minSize) * KT.rnd(i + 7, seed)) / 100 * w;
      const rot = (KT.rnd(i + 3, seed) * 2 - 1) * P.jitter * Math.PI / 180;
      const pop = P.pop | 0; let s = 1, a = 1;
      if (pop === 0) s = KT.ease.back(lp);
      else if (pop === 1){ s = 1 + (1 - KT.ease.expo(lp)) * 2.5; a = Util.clamp(lp * 3); }
      else a = lp;
      const col = P.palette ? Brand.paletteColor(i + 11, seed, P.color) : P.color;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
      Brand.logo(ctx, P, 'logo', 0, 0, size, P.tint ? col : null);
      ctx.restore();
    }
  } });

FX.register({ id:'lg-trail', name:'Logo trail', cat:'logo', kind:'2d', desc:'A logo travels a looping path leaving echoes, leaning into its speed.',
  params:[ L('logo','Logo','symbol'), R('size','Width',26,2,100,.1), S('path','Path',['Figure eight','Orbit','Bounce','Pendulum','Lissajous 3:2']), R('amp','Travel',.3,0,.6), I('speed','Loops per cycle',1,1,6), I('echoes','Echoes',6,0,30), R('lag','Echo spacing',.025,.002,.1,.001),
    S('echoStyle','Echoes',['Fade','Tint','Palette colours']), R('slant','Velocity slant',.6,0,3), T('face','Turn with motion',false), T('tint','Tint logo',false), C('color','Logo tint','#ffffff'), C('echoColor','Echo tint','#ff5a36'), ...KT.groundParams(0) ],
  draw(ctx, api){
    const P = api.params, { w, h } = api; KT.ground(ctx, api);
    const src = Assets.image(P.logo); if (!src) return;
    const kind = P.path | 0, A = P.amp, sp = P.speed | 0;
    const pos = s => {
      const a = s * KT.TAU;
      if (kind === 0) return [Math.sin(a) * A, Math.sin(a * 2) * A * .5];
      if (kind === 1) return [Math.cos(a) * A, Math.sin(a) * A];
      if (kind === 2){ const t = ((s * 2) % 2 + 2) % 2; return [(t < 1 ? t : 2 - t) * 2 * A - A, .25 - Math.abs(Math.sin(a * 3)) * A * 1.4]; }
      if (kind === 3) return [Math.sin(a) * A, -Math.cos(a * 2) * A * .15 + A * .15];
      return [Math.sin(a * 3) * A, Math.sin(a * 2) * A];
    };
    const [ww] = Brand.size(ctx, P, 'logo', w, h, P.size / 100);
    const mn = Math.min(w, h);
    const place = (s, j) => {
      const [px, py] = pos(s), [qx, qy] = pos(s + .002);
      const vx = (qx - px) / .002, vy = (qy - py) / .002;
      const x = w / 2 + px * mn, y = h / 2 - py * mn;
      ctx.save(); ctx.translate(x, y);
      if (P.face) ctx.rotate(Math.atan2(-vy, vx) * .25);
      ctx.transform(1, 0, Util.clamp(-vx * .04 * P.slant * Identity.slant(), -1.2, 1.2), 1, 0, 0);
      const es = P.echoStyle | 0;
      let tint = P.tint ? P.color : null;
      if (j > 0){
        ctx.globalAlpha = (1 - j / (P.echoes + 1)) * (es === 0 ? .7 : .9);
        tint = es === 1 ? P.echoColor : es === 2 ? Brand.paletteColor(j, 3, P.echoColor) : tint;
      }
      Brand.logo(ctx, P, 'logo', 0, 0, ww, tint);
      ctx.restore();
    };
    const s0 = api.loop * sp;
    for (let j = P.echoes | 0; j >= 1; j--) place(s0 - j * P.lag, j);
    place(s0, 0);
  } });

/* aux shared by logo transition and logo mask: white logo centred on black */
const logoAux = {
  auxSize(P, w, h){ const s = Math.min(1, Math.max(1600, Engine.auxCap) / Math.max(w, h)); return [Math.round(w * s), Math.round(h * s)]; },
  aux(ctx, P, w, h){
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const [ww] = Brand.size(ctx, P, 'logo', w, h, P.size / 100);
    if (ww) Brand.logo(ctx, P, 'logo', w / 2, h / 2, ww, '#ffffff');
  },
};

FX.register({ id:'tr-logo', name:'Logo zoom-through', cat:'transition', desc:'B appears inside the logo, then the logo zooms until B fills the frame.', ...logoAux,
  params:[ L('logo','Logo','symbol'), R('size','Logo width',35,5,100,.1), R('x','Zoom point X',0,-1,1), R('y','Zoom point Y',0,-1,1), R('intro','Intro',.25,0,.8), R('zoom','Zoom',40,2,200,1), R('curve','Acceleration',3,1,8), T('invert','A inside the logo',false) ],
  fs:`vec4 fx(vec2 uv){
  float p = uProgress;
  float intro = max(p_intro, 1e-3);
  float grow = smoothstep(0., 1., clamp(p / intro, 0., 1.));
  float z = clamp((p - intro) / max(1. - intro, 1e-3), 0., 1.);
  float s = max(grow * mix(1., p_zoom, pow(z, p_curve)), 1e-4);
  vec2 c = vec2(.5 + p_x * .5, .5 + p_y * .5);
  vec2 q = (uv - c) / s + c;
  float m = (any(lessThan(q, vec2(0.))) || any(greaterThan(q, vec2(1.)))) ? 0. : texture(uAux, q).r;
  m = mix(m, 1., smoothstep(.82, 1., z));
  if (p <= 0.) m = 0.;
  if (p_invert > .5) return vec4(mix(texture(uB, uv).rgb, texture(uA, uv).rgb, m), 1.);
  return vec4(mix(texture(uA, uv).rgb, texture(uB, uv).rgb, m), 1.);
}` });

FX.register({ id:'mx-logo', name:'Logo mask', cat:'mix', desc:'B (or a colour) inside a logo over A. Tile it, pulse it, invert it.', search:['combine', 'window'], ...logoAux,
  params:[ L('logo','Logo','symbol'), R('size','Logo width',50,5,100,.1), I('tile','Tile',1,1,12), S('animate','Animate',['None','Pulse','Drift']), S('fill','Fill with',['Image B','Colour']), C('color','Colour','#ff5a36'), T('invert','Invert',false) ],
  fs:`vec4 fx(vec2 uv){
  vec2 q = uv;
  float t = max(p_tile, 1.);
  if (p_animate > 1.5) q += vec2(uLoop / t, 0.);
  if (t > 1.) q = fract(q * t);
  if (p_animate > .5 && p_animate < 1.5) q = (q - .5) / (1. + .08 * sin(uLoop * TAU)) + .5;
  float m = (any(lessThan(q, vec2(0.))) || any(greaterThan(q, vec2(1.)))) ? 0. : texture(uAux, q).r;
  if (p_invert > .5) m = 1. - m;
  vec3 b = p_fill < .5 ? texture(uB, uv).rgb : p_color;
  return vec4(mix(texture(uA, uv).rgb, b, m), 1.);
}` });
