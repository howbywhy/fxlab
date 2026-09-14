/* ---------------- Engine: WebGL2 render graph ---------------- */
const Engine = (() => {
  const canvas = document.getElementById('stage');
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer:true, antialias:false, alpha:false, premultipliedAlpha:false });
  const E = { canvas, gl, W:1080, H:1350, rw:540, rh:675, frameId:0, errors:{}, tile:[0, 0, 1, 1], tiled:null, auxCap:1600, post:null, backColor:null, backCheck:false };
  if (!gl) return E;

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);

  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function compile(type, src){
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(log); }
    return s;
  }
  const vsObj = compile(gl.VERTEX_SHADER, GLSL.VS);
  function link(fsSrc){
    const p = gl.createProgram();
    gl.attachShader(p, vsObj); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {};
    const P = { prog:p, u:name => (name in loc) ? loc[name] : (loc[name] = gl.getUniformLocation(p, name)) };
    gl.useProgram(p);
    ['uInput','uA','uB','uPrev','uAux'].forEach((n, i) => { const l = P.u(n); if (l) gl.uniform1i(l, i); });
    ['uSrc'].forEach(n => { const l = P.u(n); if (l) gl.uniform1i(l, 0); });
    const lt = P.u('uTile'); if (lt) gl.uniform4f(lt, 0, 0, 1, 1);
    return P;
  }

  const programs = {};
  function programFor(m){
    if (programs[m.id] !== undefined) return programs[m.id];
    try { programs[m.id] = link(GLSL.buildFS(m)); delete E.errors[m.id]; }
    catch (e){ programs[m.id] = null; E.errors[m.id] = String(e.message || e); console.error(`fxlab: shader error in ${m.id}\n`, e.message); E.onError && E.onError(m, E.errors[m.id]); }
    return programs[m.id];
  }
  /* rebuild a module's program — handy when live-editing modules in the console */
  E.recompile = id => { delete programs[id]; };

  const copyP = link(`${GLSL.PRELUDE}\nvoid main(){ outColor = vec4(texture(uInput, vUv).rgb, 1.); }`);
  const fitP = link(`${GLSL.PRELUDE}
uniform sampler2D uSrc; uniform vec2 uSrcSize, uOffset; uniform float uMode, uZoom; uniform vec3 uBg;
void main(){
  float sa = uSrcSize.x / uSrcSize.y, ca = uRes.x / uRes.y; vec2 s = vec2(1.);
  if (uMode < .5){ if (sa > ca) s.x = ca / sa; else s.y = sa / ca; }
  else { if (sa > ca) s.y = sa / ca; else s.x = ca / sa; }
  vec2 st = (vUv - .5) * s / uZoom + .5 - uOffset * .5;
  if (any(lessThan(st, vec2(0.))) || any(greaterThan(st, vec2(1.)))) { outColor = vec4(backdrop(vUv), 1.); return; }
  vec4 c = texture(uSrc, st);
  outColor = vec4(c.rgb + backdrop(vUv) * (1. - c.a), 1.); /* premultiplied: transparent logos sit on the backdrop */
}`);

  function texParams(mip){
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  function makeTarget(w, h){
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); texParams(false);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }
  function freeTarget(t){ if (!t) return; gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }

  const dummy = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, dummy);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,255])); texParams(false);

  let pool = [], fit = { A:null, B:null };
  /* Shared A/B lane scratches, sized to fit (whole-frame, including print).
     fit.A/B stay the bind target for uA/uB. Empty process never touches these. */
  let lane = [null, null], srcKey = null;
  const c2d = document.createElement('canvas'), ctx2d = c2d.getContext('2d');
  const snap = document.createElement('canvas'), snapCtx = snap.getContext('2d');
  const srcCache = { A:{ c:document.createElement('canvas'), f:-1 }, B:{ c:document.createElement('canvas'), f:-1 } };
  const sampler = document.createElement('canvas'), samplerCtx = sampler.getContext('2d', { willReadFrequently:true });
  const sampleCache = {};

  const media = { A:{ el:null, w:1, h:1, tex:gl.createTexture(), video:false, dirty:false }, B:{ el:null, w:1, h:1, tex:gl.createTexture(), video:false, dirty:false } };

  E.setMedia = (k, el, w, h, isVideo) => { Object.assign(media[k], { el, w, h, video:!!isVideo, dirty:true }); };
  E.media = media;
  E.hasVideo = () => media.A.video || media.B.video;

  E.setSize = (W, H, q) => {
    E.W = W; E.H = H;
    E.rw = Math.max(2, Math.round(W * q)); E.rh = Math.max(2, Math.round(H * q));
    canvas.width = E.rw; canvas.height = E.rh;
    pool.forEach(freeTarget); freeTarget(fit.A); freeTarget(fit.B); lane.forEach(freeTarget);
    pool = [makeTarget(E.rw, E.rh), makeTarget(E.rw, E.rh)];
    fit = { A:makeTarget(E.rw, E.rh), B:makeTarget(E.rw, E.rh) };
    lane = [null, null]; srcKey = null;
    [c2d, snap, srcCache.A.c, srcCache.B.c].forEach(c => { c.width = E.rw; c.height = E.rh; });
    srcCache.A.f = srcCache.B.f = -1;
  };

  function bindUnits(input, prev, aux){
    const units = [input || dummy, fit.A.tex, fit.B.tex, prev || dummy, aux || dummy];
    units.forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); });
    gl.activeTexture(gl.TEXTURE0);
  }
  function setGlobals(P, g){
    gl.uniform2f(P.u('uRes'), E.W, E.H);
    gl.uniform1f(P.u('uTime'), g.t); gl.uniform1f(P.u('uProgress'), g.p);
    gl.uniform1f(P.u('uLoop'), g.loop); gl.uniform1f(P.u('uDur'), g.dur);
    gl.uniform1f(P.u('uPx'), E.W / (E.tiled ? E.tiled.w : E.rw));
    gl.uniform3fv(P.u('uBack'), E.backColor || [0, 0, 0]);
    gl.uniform1f(P.u('uBackCheck'), E.backCheck ? 1 : 0);
    gl.uniform4fv(P.u('uTile'), E.tile);
  }
  const hexCache = {};
  /* '#rgb', '#rrggbb' or '#rrggbbaa' → [r, g, b] with .a for the opacity */
  function hex(h){
    if (hexCache[h]) return hexCache[h];
    let t = String(h).replace('#', '');
    if (t.length === 3 || t.length === 4) t = t.split('').map(c => c + c).join('');
    const n = parseInt(t.padEnd(6, '0').slice(0, 6), 16) || 0;
    const out = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
    out.a = t.length >= 8 ? parseInt(t.slice(6, 8), 16) / 255 : 1;
    return (hexCache[h] = out);
  }
  E.hex = hex;
  E.alphaOf = h => hex(h).a;
  function setParams(P, m, params){
    for (const d of m.params){
      if (d.type === 'text') continue;
      const l = P.u('p_' + d.id); if (!l) continue;
      const v = params[d.id] ?? d.def;
      if (d.type === 'color'){ gl.uniform3fv(l, hex(v)); const la = P.u('p_' + d.id + '_a'); if (la) gl.uniform1f(la, hex(v).a); }
      else gl.uniform1f(l, typeof v === 'boolean' ? (v ? 1 : 0) : +v);
    }
  }
  function draw(target){
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : E.rw, target ? target.h : E.rh);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function present(t){
    gl.useProgram(copyP.prog); bindUnits(t.tex, null, null); draw(null);
  }

  function uploadMedia(k){
    const m = media[k]; if (!m.el) return;
    if (m.video){ if (m.el.readyState < 2) return; }
    else if (!m.dirty) return;
    gl.bindTexture(gl.TEXTURE_2D, m.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, m.el);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (!m.video){ gl.generateMipmap(gl.TEXTURE_2D); texParams(true); } else texParams(false);
    m.dirty = false;
  }
  function drawFit(k, s, bg){
    gl.useProgram(fitP.prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, media[k].tex);
    gl.uniform2f(fitP.u('uRes'), E.W, E.H); gl.uniform4f(fitP.u('uTile'), 0, 0, 1, 1);
    gl.uniform3fv(fitP.u('uBack'), E.backColor || hex(bg)); gl.uniform1f(fitP.u('uBackCheck'), E.backCheck ? 1 : 0);
    gl.uniform2f(fitP.u('uSrcSize'), media[k].w, media[k].h);
    gl.uniform1f(fitP.u('uMode'), +s.fit); gl.uniform1f(fitP.u('uZoom'), +s.zoom);
    gl.uniform2f(fitP.u('uOffset'), +s.x, +s.y); gl.uniform3fv(fitP.u('uBg'), hex(bg));
    draw(fit[k]);
  }

  function ensureFeedback(inst, input){
    if (inst._fb && inst._fb[0].w === E.rw && inst._fb[0].h === E.rh) return;
    if (inst._fb) inst._fb.forEach(freeTarget);
    inst._fb = [makeTarget(E.rw, E.rh), makeTarget(E.rw, E.rh)];
    /* seed history with the current frame so trails don't start from black */
    if (input){ gl.useProgram(copyP.prog); bindUnits(input.tex, null, null); draw(inst._fb[0]); draw(inst._fb[1]); }
  }
  E.resetFeedback = insts => insts.forEach(i => { if (i._fb){ i._fb.forEach(freeTarget); i._fb = null; } });

  function ensureAux(inst, m, params){
    /* aux canvases always describe the whole frame, even when rendering one tile */
    let AW = E.rw, AH = E.rh;
    if (E.tiled){ const s = Math.min(1, E.auxCap / Math.max(E.tiled.w, E.tiled.h)); AW = Math.round(E.tiled.w * s); AH = Math.round(E.tiled.h * s); }
    const size = m.auxSize ? m.auxSize(params, E.tiled ? E.tiled.w : AW, E.tiled ? E.tiled.h : AH) : [AW, AH];
    const maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 8192);
    if (Math.max(size[0], size[1]) > maxTex){ const s = maxTex / Math.max(size[0], size[1]); size[0] = Math.round(size[0] * s); size[1] = Math.round(size[1] * s); }
    const key = JSON.stringify(params) + '|' + size.join('x') + '|' + (typeof Assets !== 'undefined' ? Assets.version : 0);
    if (inst._auxKey === key && inst._auxTex) return;
    const c = inst._auxCanvas || (inst._auxCanvas = document.createElement('canvas'));
    c.width = size[0]; c.height = size[1];
    const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
    let info;
    try { info = m.aux(x, params, c.width, c.height); } catch (e){ console.error('fxlab aux', m.id, e); }
    inst._auxInfo = Array.isArray(info) ? info.concat([0,0,0,0]).slice(0, 4) : [0,0,0,0];
    if (!inst._auxTex) inst._auxTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, inst._auxTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D); texParams(true);
    inst._auxKey = key;
  }

  function source2d(k){
    const sc = srcCache[k];
    if (sc.f !== E.frameId){ present(fit[k]); const x = sc.c.getContext('2d'); x.clearRect(0, 0, E.rw, E.rh); x.drawImage(canvas, 0, 0); sc.f = E.frameId; }
    return sc.c;
  }
  function sample(k, cols, rows){
    const key = `${k}${cols}x${rows}`;
    const c = sampleCache[key];
    if (c && c.f === E.frameId) return c.data;
    const src = source2d(k);
    if (sampler.width !== cols || sampler.height !== rows){ sampler.width = cols; sampler.height = rows; }
    samplerCtx.drawImage(src, 0, 0, cols, rows);
    const data = samplerCtx.getImageData(0, 0, cols, rows);
    sampleCache[key] = { f:E.frameId, data };
    return data;
  }

  function run(inst, input, target, g){
    const m = FX.byId[inst.id];
    if (!m) return input || target;
    const params = typeof Identity !== 'undefined' ? Identity.resolve(m, inst.params) : inst.params;
    if (m.kind === '2d'){
      let inCanvas = null;
      if (input){ present(input); snapCtx.clearRect(0, 0, E.rw, E.rh); snapCtx.drawImage(canvas, 0, 0); inCanvas = snap; }
      /* fresh 2D state for every module so settings never leak between modules */
      if (ctx2d.reset) ctx2d.reset();
      else { ctx2d.setTransform(1, 0, 0, 1, 0, 0); Object.assign(ctx2d, { globalAlpha:1, globalCompositeOperation:'source-over', lineWidth:1, lineJoin:'miter', textAlign:'start', textBaseline:'alphabetic', font:'10px sans-serif' }); if ('letterSpacing' in ctx2d) ctx2d.letterSpacing = '0px'; ctx2d.clearRect(0, 0, E.rw, E.rh); }
      /* lay the incoming frame down first, so module colours with opacity below 1 composite over it.
         snap is a separate canvas from c2d, so modules can also read it as api.input without
         aliasing the destination. Size is this 2D buffer (preview, or the current print tile). */
      if (inCanvas) ctx2d.drawImage(inCanvas, 0, 0);
      if (E.tiled) ctx2d.setTransform(1, 0, 0, 1, -E.tiled.x, -E.tiled.y);
      const api = { w:E.tiled ? E.tiled.w : E.rw, h:E.tiled ? E.tiled.h : E.rh, W:E.W, H:E.H, t:g.t, p:g.p, loop:g.loop, dur:g.dur, fps:g.fps, params, input:inCanvas, source:source2d, sample, inst, tiled:!!E.tiled };
      try { m.draw(ctx2d, api); }
      catch (e){ if (!E.errors[m.id]){ E.errors[m.id] = String(e); console.error('fxlab 2d', m.id, e); E.onError && E.onError(m, String(e)); } return input || target; }
      gl.bindTexture(gl.TEXTURE_2D, target.tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, c2d);
      return target;
    }
    const P = programFor(m);
    if (!P) return input || target;
    let out = target, prev = null;
    if (m.feedback){ ensureFeedback(inst, input); out = inst._fb[0]; prev = inst._fb[1].tex; }
    if (m.aux) ensureAux(inst, m, params);
    gl.useProgram(P.prog);
    bindUnits(input ? input.tex : null, prev, inst._auxTex);
    setGlobals(P, g); setParams(P, m, params);
    const ai = P.u('uAuxInfo'); if (ai) gl.uniform4fv(ai, inst._auxInfo || [0,0,0,0]);
    draw(out);
    if (m.feedback){ inst._fb.reverse(); return inst._fb[1]; }
    return out;
  }

  function laneList(src){
    return (src && src.process || []).filter(inst => {
      if (!inst.on) return false;
      const m = FX.byId[inst.id];
      return m && FX.laneEligible(m);
    });
  }
  function ensureLane(){
    const w = fit.A.w, h = fit.A.h;
    if (lane[0] && lane[0].w === w && lane[0].h === h) return;
    lane.forEach(freeTarget);
    lane = [makeTarget(w, h), makeTarget(w, h)];
  }
  /* Ping-pong a source process list, then copy the result back onto fit[k].
     First pass reads fit[k] and writes a scratch — never the fit itself. */
  function processLane(k, src, g){
    const list = laneList(src);
    if (!list.length) return;
    ensureLane();
    const dest = fit[k];
    let cur = dest;
    for (let i = 0; i < list.length; i++){
      const tgt = cur === lane[0] ? lane[1] : lane[0];
      cur = run(list[i], cur, tgt, g);
    }
    if (cur !== dest){
      gl.useProgram(copyP.prog); bindUnits(cur.tex, null, null); draw(dest);
    }
  }
  function processLanes(state, g){
    const saved = E.tile;
    E.tile = [0, 0, 1, 1];
    processLane('A', state.sources.A, g);
    processLane('B', state.sources.B, g);
    E.tile = saved;
  }

  /* render one frame of the project at time t */
  E.frame = (state, t, g) => {
    E.frameId++;
    uploadMedia('A'); uploadMedia('B');
    /* Session UI bypass (App.stageOn) skips processing without mutating lists.
       Combine always runs — there is no skip-base path in this architecture. */
    const prepOn = typeof App === 'undefined' || !App.stageOn || App.stageOn.prepare !== false;
    const finOn = typeof App === 'undefined' || !App.stageOn || App.stageOn.finish !== false;
    const need = prepOn ? laneList(state.sources.A).length + laneList(state.sources.B).length : 0;
    /* Empty lists: same drawFit path as before. Non-empty print tiles reuse
       the whole-frame prep for this t so lanes are not themselves tiled. */
    if (!E.tiled || !need || srcKey !== g.t){
      drawFit('A', state.sources.A, state.bg); drawFit('B', state.sources.B, state.bg);
      if (need) processLanes(state, g);
      if (E.tiled && need) srcKey = g.t;
    }
    let cur = run(state.base, null, pool[0], g);
    if (finOn){
      for (const inst of state.stack){
        if (!inst.on) continue;
        const tgt = cur === pool[0] ? pool[1] : pool[0];
        cur = run(inst, cur, tgt, g);
      }
    }
    if (E.post) cur = E.post(cur) || cur;
    if (!E.tiled) present(cur);
    E.last = cur;
    return cur;
  };

  /* ---------- tiled rendering for large print exports ---------- */
  E.maxTile = () => Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE));
  E.enterTiles = (fullW, fullH, tileSize) => {
    E.rw = E.rh = tileSize; canvas.width = canvas.height = tileSize;
    pool.forEach(freeTarget); freeTarget(fit.A); freeTarget(fit.B); lane.forEach(freeTarget);
    pool = [makeTarget(tileSize, tileSize), makeTarget(tileSize, tileSize)];
    /* sources stay whole-frame (capped) so effects can sample them anywhere */
    const cap = gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 8192 ? 4096 : 2048, fs = Math.min(1, cap / Math.max(fullW, fullH));
    fit = { A:makeTarget(Math.round(fullW * fs), Math.round(fullH * fs)), B:makeTarget(Math.round(fullW * fs), Math.round(fullH * fs)) };
    lane = [null, null]; srcKey = null;
    [c2d, snap].forEach(c => { c.width = tileSize; c.height = tileSize; });
    [srcCache.A.c, srcCache.B.c].forEach(c => { c.width = fit.A.w; c.height = fit.A.h; });
    E.tiled = { w:fullW, h:fullH, x:0, y:0, size:tileSize };
  };
  E.setTile = (x, y) => {
    const T = E.tiled; T.x = x; T.y = y;
    E.tile = [x / T.w, 1 - (y + T.size) / T.h, T.size / T.w, T.size / T.h];
  };
  E.exitTiles = () => { E.tiled = null; E.tile = [0, 0, 1, 1]; srcKey = null; };
  /* read a render target into an RGBA buffer (rows bottom-up) */
  E.read = (t, buf) => { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.readPixels(0, 0, t.w, t.h, gl.RGBA, gl.UNSIGNED_BYTE, buf); return buf; };
  E.link = link; E.draw = draw; E.bindUnits = bindUnits; E.makeTarget = makeTarget; E.freeTarget = freeTarget;
  return E;
})();
