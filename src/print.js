/* ---------------- Print ----------------
   Print documents in millimetres with bleed and safe margins. Exports render
   in tiles at full print resolution (e.g. 300 dpi) and stream straight into
   a PDF (trim/bleed boxes, crop marks) or a PNG with its dpi recorded, so
   big posters never need one giant canvas. Ink separations split the artwork
   into one greyscale plate per ink for riso or screen printing.
----------------------------------------- */
const PRINT_SIZES = [
  { id:'p-a6', label:'A6', w:105, h:148 }, { id:'p-a5', label:'A5', w:148, h:210 }, { id:'p-a4', label:'A4', w:210, h:297 },
  { id:'p-a3', label:'A3', w:297, h:420 }, { id:'p-a2', label:'A2', w:420, h:594 }, { id:'p-a1', label:'A1', w:594, h:841 },
  { id:'p-letter', label:'US Letter', w:215.9, h:279.4 }, { id:'p-tabloid', label:'Tabloid 11×17″', w:279.4, h:431.8 },
  { id:'p-18x24', label:'Poster 18×24″', w:457.2, h:609.6 }, { id:'p-24x36', label:'Poster 24×36″', w:609.6, h:914.4 },
  { id:'p-dl', label:'DL flyer', w:99, h:210 }, { id:'p-card', label:'Business card 85×55', w:85, h:55 }, { id:'p-uscard', label:'Business card 3.5×2″', w:88.9, h:50.8 },
  { id:'p-square', label:'Square 200×200', w:200, h:200 },
];
const Print = (() => {
  const PR = {};
  const MM_IN = 25.4, PT = 72 / 25.4;
  PR.defaults = () => ({ preset:'p-a4', wMM:210, hMM:297, bleed:3, safe:5, guides:true, dpi:300, format:'pdf-marks', frame:'playhead', inks:[], paper:'#ffffff', inkPreview:false, misreg:0 });
  /* design pixels: ≤150 px per inch and ≤3600 px long side, so the stage stays fast */
  PR.docPx = pr => {
    const wIn = (pr.wMM + pr.bleed * 2) / MM_IN, hIn = (pr.hMM + pr.bleed * 2) / MM_IN;
    const ppi = Math.min(150, 3600 / Math.max(wIn, hIn));
    return { W:Math.max(16, Math.round(wIn * ppi / 2) * 2), H:Math.max(16, Math.round(hIn * ppi / 2) * 2), ppi, wIn, hIn };
  };
  PR.outPx = pr => { const d = PR.docPx(pr); return { w:Math.round(d.wIn * pr.dpi), h:Math.round(d.hIn * pr.dpi) }; };

  /* ---------- CRC + streaming deflate ---------- */
  const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = (parts) => { let c = 0xFFFFFFFF; for (const u8 of parts) for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function deflater(){
    if (!window.CompressionStream) throw new Error('this browser can’t compress large images; use Chrome, Safari 16.4+ or Firefox 113+');
    const cs = new CompressionStream('deflate'), writer = cs.writable.getWriter(), chunks = [];
    const done = (async () => { const r = cs.readable.getReader(); for (;;){ const { value, done } = await r.read(); if (done) break; chunks.push(value); } })();
    return { async write(u8){ await writer.ready; await writer.write(u8); }, async end(){ await writer.close(); await done; return chunks; } };
  }
  const be32 = v => new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
  const ascii = s => new TextEncoder().encode(s);
  function pngChunk(type, data){ const t = ascii(type); return [be32(data.length), t, data, be32(crc32([t, data]))]; }

  /* rows in → PNG blob out. channels 3 (RGB) or 1 (grey) */
  function pngWriter(w, h, channels, dpi){
    const z = deflater();
    return {
      async rows(buf){ await z.write(buf); },          /* buf: n rows, each 1 filter byte + w*channels */
      async blob(){
        const idat = await z.end();
        const ihdr = new Uint8Array(13); ihdr.set(be32(w), 0); ihdr.set(be32(h), 4); ihdr[8] = 8; ihdr[9] = channels === 1 ? 0 : 2;
        const ppm = Math.round(dpi / .0254), phys = new Uint8Array(9); phys.set(be32(ppm), 0); phys.set(be32(ppm), 4); phys[8] = 1;
        const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), ...pngChunk('IHDR', ihdr), ...pngChunk('pHYs', phys)];
        for (const c of idat) parts.push(...pngChunk('IDAT', c));
        parts.push(...pngChunk('IEND', new Uint8Array(0)));
        return new Blob(parts, { type:'image/png' });
      },
    };
  }
  /* rows in → PDF with the image at physical size, trim/bleed boxes and optional crop marks */
  function pdfWriter(w, h, pr, marks, slug){
    const z = deflater();
    return {
      async rows(buf){ await z.write(buf); },
      async blob(){
        const data = await z.end(), len = data.reduce((a, b) => a + b.length, 0);
        const mk = marks ? 12 : 0, b = pr.bleed;
        const mw = (pr.wMM + 2 * b + 2 * mk) * PT, mh = (pr.hMM + 2 * b + 2 * mk) * PT;
        const f = v => (+v).toFixed(3);
        const trim = [mk + b, mk + b, mk + b + pr.wMM, mk + b + pr.hMM].map(v => v * PT), bleed = [mk, mk, mk + pr.wMM + 2 * b, mk + pr.hMM + 2 * b].map(v => v * PT);
        let content = `q ${f((pr.wMM + 2 * b) * PT)} 0 0 ${f((pr.hMM + 2 * b) * PT)} ${f(mk * PT)} ${f(mk * PT)} cm /Im0 Do Q\n`;
        if (marks){
          const off = (b + 2) * PT, L = 5 * PT, [x0, y0, x1, y1] = trim;
          content += `q 0.25 w 1 1 1 1 K\n`;
          [[x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1], [x1, y1, 1, 1]].forEach(([x, y, sx, sy]) => {
            content += `${f(x + sx * off)} ${f(y)} m ${f(x + sx * (off + L))} ${f(y)} l S\n${f(x)} ${f(y + sy * off)} m ${f(x)} ${f(y + sy * (off + L))} l S\n`;
          });
          const esc = s => String(s).replace(/[\\()]/g, m => '\\' + m).replace(/[^\x20-\x7e]/g, '-');
          content += `Q q 0 0 0 1 k BT /F1 6 Tf ${f(x0)} ${f(mh - 5 * PT)} Td (${esc(slug)}) Tj ET Q\n`;
        }
        const objs = [];
        objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
        objs[2] = `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`;
        objs[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(mw)} ${f(mh)}] /BleedBox [${bleed.map(f).join(' ')}] /TrimBox [${trim.map(f).join(' ')}] /Resources << /XObject << /Im0 4 0 R >> /Font << /F1 6 0 R >> >> /Contents 5 0 R >>`;
        objs[5] = `<< /Length ${content.length} >>\nstream\n${content}endstream`;
        objs[6] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
        const parts = [], offsets = []; let pos = 0;
        const push = p => { const u = typeof p === 'string' ? ascii(p) : p; parts.push(u); pos += u.length; };
        push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'.replace(/[\x80-\xff]/g, '*'));
        for (let i = 1; i <= 6; i++){
          offsets[i] = pos;
          if (i === 4){
            push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${len} >>\nstream\n`);
            data.forEach(push); push('\nendstream\nendobj\n');
          } else push(`${i} 0 obj\n${objs[i]}\nendobj\n`);
        }
        const xref = pos;
        push(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
        return new Blob(parts, { type:'application/pdf' });
      },
    };
  }

  /* ---------- inks: separation maths and GPU passes ---------- */
  const rgb = hx => Util.hexToRgb(hx).map(v => v / 255);
  /* least-squares (ridge) inverse of the ink absorption matrix: density = M · log(pixel / paper) */
  PR.inkMatrix = (inks, paper) => {
    const pp = rgb(paper).map(v => Math.max(v, .004)), N = inks.length;
    const A = inks.map(hx => rgb(hx).map((v, c) => Math.log(Math.max(v, .004) / pp[c])));   /* N × 3 (columns of the model) */
    const AtA = [...Array(N)].map((_, i) => [...Array(N)].map((_, j) => A[i].reduce((s, v, c) => s + v * A[j][c], 0) + (i === j ? .003 : 0)));
    const inv = [...Array(N)].map((_, i) => [...Array(N)].map((_, j) => i === j ? 1 : 0));
    for (let i = 0; i < N; i++){
      let piv = i; for (let r = i + 1; r < N; r++) if (Math.abs(AtA[r][i]) > Math.abs(AtA[piv][i])) piv = r;
      [AtA[i], AtA[piv]] = [AtA[piv], AtA[i]]; [inv[i], inv[piv]] = [inv[piv], inv[i]];
      const d = AtA[i][i] || 1e-9; for (let c = 0; c < N; c++){ AtA[i][c] /= d; inv[i][c] /= d; }
      for (let r = 0; r < N; r++) if (r !== i){ const k = AtA[r][i]; for (let c = 0; c < N; c++){ AtA[r][c] -= k * AtA[i][c]; inv[r][c] -= k * inv[i][c]; } }
    }
    return [...Array(4)].map((_, k) => k < N ? [0, 1, 2].map(c => inv[k].reduce((s, v, j) => s + v * A[j][c], 0)) : [0, 0, 0]);
  };
  let inkP = null, tmpT = null;
  const inkFS = () => `${GLSL.PRELUDE}
uniform vec3 uPaper, uR0, uR1, uR2, uR3, uI0, uI1, uI2, uI3; uniform float uN, uK, uMode, uMis;
float dens(vec3 r, vec2 uv){ vec3 c = texture(uInput, uv).rgb; vec3 b = log(max(c, vec3(.004)) / max(uPaper, vec3(.004))); return clamp(dot(r, b), 0., 1.); }
void main(){
  vec2 uv = vUv, px = uMis / uRes;
  float d0 = dens(uR0, uv + px * vec2(.7, .2)), d1 = dens(uR1, uv - px * vec2(.3, .8)), d2 = dens(uR2, uv + px * vec2(-.6, .5)), d3 = dens(uR3, uv);
  if (uMode < .5){ float d = uK < .5 ? d0 : uK < 1.5 ? d1 : uK < 2.5 ? d2 : d3; outColor = vec4(vec3(1. - d), 1.); return; }
  vec3 p = max(uPaper, vec3(.004)), c = uPaper;
  if (uN > .5) c *= pow(max(uI0, vec3(.004)) / p, vec3(d0));
  if (uN > 1.5) c *= pow(max(uI1, vec3(.004)) / p, vec3(d1));
  if (uN > 2.5) c *= pow(max(uI2, vec3(.004)) / p, vec3(d2));
  if (uN > 3.5) c *= pow(max(uI3, vec3(.004)) / p, vec3(d3));
  outColor = vec4(c, 1.);
}`;
  function inkPass(src, pr, mode, k, misreg){
    const gl = Engine.gl;
    if (!inkP) inkP = Engine.link(inkFS());
    if (!tmpT || tmpT.w !== src.w || tmpT.h !== src.h){ if (tmpT) Engine.freeTarget(tmpT); tmpT = Engine.makeTarget(src.w, src.h); }
    const inks = pr.inks.slice(0, 4), M = PR.inkMatrix(inks, pr.paper);
    gl.useProgram(inkP.prog); Engine.bindUnits(src.tex, null, null);
    gl.uniform2f(inkP.u('uRes'), src.w, src.h);
    gl.uniform3fv(inkP.u('uPaper'), rgb(pr.paper));
    M.forEach((r, i) => gl.uniform3fv(inkP.u('uR' + i), r));
    [0, 1, 2, 3].forEach(i => gl.uniform3fv(inkP.u('uI' + i), rgb(inks[i] || '#ffffff')));
    gl.uniform1f(inkP.u('uN'), inks.length); gl.uniform1f(inkP.u('uK'), k); gl.uniform1f(inkP.u('uMode'), mode); gl.uniform1f(inkP.u('uMis'), misreg);
    Engine.draw(tmpT);
    return tmpT;
  }
  /* on-stage ink preview */
  PR.syncPreview = () => {
    const pr = state.print;
    Engine.post = pr && pr.inkPreview && pr.inks.length ? cur => inkPass(cur, pr, 1, 0, pr.misreg * (Engine.tiled ? Engine.tiled.w : Engine.rw) / state.W) : null;
    markDirty();
  };

  /* ---------- the render loop ---------- */
  async function renderRows(pxW, pxH, t, onBand){
    const nonLocal = [state.base, ...state.stack].some(i => i && i.on !== false && FX.byId[i.id] && FX.byId[i.id].nonLocal);
    const gl = Engine.gl, maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 8192);
    const g = globalsAt(t);
    if (nonLocal){
      Engine.setSize(state.W, state.H, pxW / state.W); Engine.resetFeedback(state.stack);
      renderAt(t); const tgt = Engine.last, buf = new Uint8Array(tgt.w * tgt.h * 4); Engine.read(tgt, buf);
      await onBand(buf, tgt.w, 0, tgt.h, true);
      return;
    }
    void g;
    const scale = pxW / state.W, M = Math.max(48, Math.min(384, Math.ceil(96 * scale)));
    const TS = Math.min(2048, maxTex), core = TS - 2 * M;
    Engine.enterTiles(pxW, pxH, TS); Engine.resetFeedback(state.stack);
    const tile = new Uint8Array(TS * TS * 4);
    const total = Math.ceil(pxW / core) * Math.ceil(pxH / core); let n = 0;
    for (let ty = 0; ty < pxH; ty += core){
      const rows = Math.min(core, pxH - ty), band = new Uint8Array(pxW * rows * 4);
      for (let tx = 0; tx < pxW; tx += core){
        if (App.cancel) throw new Error('cancelled');
        Engine.setTile(tx - M, ty - M); renderAt(t);
        const tgt = Engine.last; Engine.read(tgt, tile);
        const cols = Math.min(core, pxW - tx);
        for (let r = 0; r < rows; r++){
          const src = (TS - 1 - (M + r)) * TS * 4 + M * 4, dst = r * pxW * 4 + tx * 4;
          band.set(tile.subarray(src, src + cols * 4), dst);
        }
        busyProgress(++n / total * .92, `Tile ${n} of ${total} · ${pxW}×${pxH} px`);
        await sleep(0);
      }
      await onBand(band, pxW, ty, rows, false);
    }
  }

  PR.export = async () => {
    const pr = state.print; if (!pr) return;
    const out = PR.outPx(pr), fmt = pr.format;
    const gl = Engine.gl, maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 8192);
    const nonLocal = [state.base, ...state.stack].some(i => i && i.on !== false && FX.byId[i.id] && FX.byId[i.id].nonLocal);
    let pxW = out.w, pxH = out.h;
    if (nonLocal){ const s = Math.min(1, maxTex / Math.max(pxW, pxH), Math.sqrt(40e6 / (pxW * pxH))); pxW = Math.round(pxW * s); pxH = Math.round(pxH * s); }
    const dpi = pr.dpi * pxW / out.w;
    const t = pr.frame === 'end' ? stillTime() : App.t;
    const seps = fmt === 'seps';
    if (seps && !pr.inks.length){ toast('Choose at least one ink for separations.', true); return; }
    const stem = `${fileStem()}_${PRINT_SIZES.find(p => p.id === pr.preset)?.label.replace(/[^a-z0-9]+/gi, '-') || 'print'}_${Math.round(dpi)}dpi`;
    const saved = { playing:App.playing, post:Engine.post };
    App.exporting = true; App.cancel = false; App.playing = false;
    Engine.auxCap = Math.min(maxTex, 6000); Assets.version++;
    if (seps) Engine.post = null;
    busy(true, seps ? 'Exporting separations' : fmt === 'png' ? 'Exporting print PNG' : 'Exporting print PDF', `${pxW}×${pxH} px at ${Math.round(dpi)} dpi`);
    try {
      const writers = seps
        ? [...pr.inks.slice(0, 4).map(() => pngWriter(pxW, pxH, 1, dpi)), pngWriter(pxW, pxH, 3, dpi)]
        : [fmt === 'png' ? pngWriter(pxW, pxH, 3, dpi) : pdfWriter(pxW, pxH, pr, fmt === 'pdf-marks', `${stem}  ·  trim ${pr.wMM}×${pr.hMM} mm  ·  bleed ${pr.bleed} mm  ·  ${Math.round(dpi)} dpi  ·  ${new Date().toISOString().slice(0, 10)}`)];
      const withFilter = fmt !== 'pdf' && fmt !== 'pdf-marks';
      const toRows = (rgba, w, rows, ch, pick) => {
        const stride = w * ch + (withFilter ? 1 : 0), o = new Uint8Array(stride * rows);
        for (let r = 0; r < rows; r++){ let d = r * stride; if (withFilter) o[d++] = 0; const s0 = r * w * 4; for (let x = 0; x < w; x++){ const s = s0 + x * 4; if (ch === 1) o[d++] = rgba[s + pick]; else { o[d++] = rgba[s]; o[d++] = rgba[s + 1]; o[d++] = rgba[s + 2]; } } }
        return o;
      };
      const flip = (buf, w, h) => { const o = new Uint8Array(buf.length), row = w * 4; for (let r = 0; r < h; r++) o.set(buf.subarray((h - 1 - r) * row, (h - r) * row), r * row); return o; };
      await renderRows(pxW, pxH, t, async (band, w, y0, rows, bottomUp) => {
        let rgba = bottomUp ? flip(band, w, rows) : band;
        if (!seps){ await writers[0].rows(toRows(rgba, w, rows, 3)); return; }
        /* separations: run the ink pass over the band again on the GPU (band is uploaded as a texture) */
        const tex = bandTarget(w, rows, rgba);
        for (let k = 0; k < writers.length - 1; k++){
          const plate = inkPass(tex, pr, 0, k, 0), pbuf = new Uint8Array(w * rows * 4); Engine.read(plate, pbuf);
          await writers[k].rows(toRows(flip(pbuf, w, rows), w, rows, 1, 0));
        }
        const comp = inkPass(tex, pr, 1, 0, 0), cbuf = new Uint8Array(w * rows * 4); Engine.read(comp, cbuf);
        await writers[writers.length - 1].rows(toRows(flip(cbuf, w, rows), w, rows, 3));
      });
      busyProgress(.96, 'Finishing file…');
      if (seps){
        const zip = new Zip(); const names = pr.inks.slice(0, 4).map(hx => (Assets.palette.find(c => c.hex === hx) || {}).name || hx.toUpperCase());
        for (let k = 0; k < writers.length - 1; k++) await zip.add(`${stem}/${k + 1}-${names[k].replace(/[^a-z0-9#]+/gi, '-')}.png`, await writers[k].blob());
        await zip.add(`${stem}/composite-preview.png`, await writers[writers.length - 1].blob());
        await zip.add(`${stem}/inks.txt`, new Blob([`Ink separations from fxlab\nPaper ${pr.paper.toUpperCase()}\n${names.map((n, i) => `Plate ${i + 1}: ${n} ${pr.inks[i].toUpperCase()}`).join('\n')}\n\nBlack = full ink, white = no ink. ${pxW}×${pxH} px at ${Math.round(dpi)} dpi, trim ${pr.wMM}×${pr.hMM} mm with ${pr.bleed} mm bleed on each side.\n`], { type:'text/plain' }));
        download(zip.blob(), `${stem}_separations.zip`);
      } else download(await writers[0].blob(), `${stem}.${fmt === 'png' ? 'png' : 'pdf'}`);
      toast(`Exported ${pxW}×${pxH} px at ${Math.round(dpi)} dpi${nonLocal && pxW < out.w ? ` (capped: this stack uses whole-frame effects)` : ''}.`, nonLocal && pxW < out.w, 7000);
    } catch (e){
      if (String(e.message) === 'cancelled') toast('Export cancelled'); else { console.error(e); toast(`Print export stopped: ${e.message || e}`, true, 8000); }
    } finally {
      Engine.exitTiles(); Engine.auxCap = 1600; Assets.version++; Engine.post = saved.post;
      busy(false); Engine.setSize(state.W, state.H, state.quality); Engine.resetFeedback(state.stack);
      App.exporting = false; App.playing = saved.playing; updatePlayBtn(); markDirty();
    }
  };
  let bandT = null;
  function bandTarget(w, h, rgba){
    const gl = Engine.gl;
    if (!bandT || bandT.w !== w || bandT.h !== h){ if (bandT) Engine.freeTarget(bandT); bandT = Engine.makeTarget(w, h); }
    gl.bindTexture(gl.TEXTURE_2D, bandT.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const up = new Uint8Array(rgba.length), row = w * 4; for (let r = 0; r < h; r++) up.set(rgba.subarray((h - 1 - r) * row, (h - r) * row), r * row);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, up);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    return bandT;
  }
  return PR;
})();
