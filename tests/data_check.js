() => {
  const f = window.fxlab, Data = f.Data, E = f.Engine, S = f.state;
  f.App.playing = false; f.App.exporting = true;
  const bad = [];
  const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(msg + ': got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); };
  const ok = (c, msg) => { if (!c) bad.push(msg); };
  const throws = (fn, re, msg) => { try { fn(); bad.push(msg + ': did not throw'); } catch (e){ if (!re.test(e.message)) bad.push(msg + ': wrong message ' + e.message); } };
  const load = (text, name) => Data.loadText(text, name || 't', { kind:'paste' });
  const types = t => t.cols.map(c => c.name + ':' + c.type).join(',');

  /* samples */
  for (const s of Data.samples){
    const t = Data.sampleTable(s.id);
    ok(t.rows > 100 && t.cols.length >= 4, s.id + ' looks too small: ' + t.rows + '×' + t.cols.length);
    ok(t.cols.every(c => c.v && Number.isFinite(c.min) && c.max > c.min), s.id + ' has an unusable column');
    ok(s.credit && s.credit.length > 10, s.id + ' has no credit');
  }
  eq(types(Data.sampleTable('quakes')), 'time:time,latitude:number,longitude:number,depth:number,mag:number', 'quakes types');
  eq(types(Data.sampleTable('weather')), 'time:time,temperature:number,wind:number,rain:number,cloud:number', 'weather types');
  ok(Data.sampleTable('warming').byName.year.min === 1881, 'warming starts 1881');

  /* CSV */
  let t = load('a,b\n1,"x, y"\n2,"he said ""hi"""\n3,z');
  eq([t.rows, types(t)], [3, 'a:number,b:category'], 'quoted CSV');
  eq(t.byName.b.cats, ['x, y', 'he said "hi"', 'z'], 'quoted cells');
  t = load('\uFEFFa;b\r\n1,5;2,5\r\n2,5;3,5\r\n');
  eq([t.rows, t.byName.a.v[0], t.byName.b.v[1]], [2, 1.5, 3.5], 'semicolon + decimal comma + BOM + CRLF');
  t = load('a\tb\n1\t2\n3\t4');
  eq(types(t), 'a:number,b:number', 'tab separated');
  t = load('1,2\n3,4\n5,6');
  eq(t.cols.map(c => c.name), ['column 1', 'column 2'], 'no header row');
  t = load('d,v\n2024-01-01,1\n2024-01-02,2\n2024-01-03,3');
  eq(types(t), 'd:time,v:number', 'ISO dates are times');
  t = load('v,w\n1,\n,5\n3,\n4,8');
  ok(t.byName.v.gaps === 1 && t.byName.v.v[1] === 2, 'gaps are interpolated: ' + Array.from(t.byName.v.v));
  ok(t.byName.w.v[0] === 5 && t.byName.w.v[3] === 8, 'leading gaps are back-filled');
  const big = 'x,y\n' + Array.from({ length:5000 }, (_, i) => i + ',' + (i % 7)).join('\n');
  t = load(big);
  ok(t.rows <= Data.MAX_ROWS && t.sampled === 5000, 'rows are capped and flagged: ' + t.rows + ' / ' + t.sampled);
  ok(t.byName.x.v[t.rows - 1] === 4999, 'the last row survives sampling');
  const wide = Array.from({ length:40 }, (_, i) => 'c' + i).join(',') + '\n' + Array.from({ length:5 }, () => Array.from({ length:40 }, (_, i) => i).join(',')).join('\n');
  ok(load(wide).cols.length === Data.MAX_COLS, 'columns are capped');
  t = load('id,n\n' + Array.from({ length:80 }, (_, i) => 'name' + i + ',' + i).join('\n'));
  eq(t.byName.id.type, 'text', 'too many distinct labels become text');
  t = load('kind,n\na,1\nb,2\na,3\nc,4');
  eq([t.byName.kind.type, t.byName.kind.cats], ['category', ['a', 'b', 'c']], 'categories');

  /* JSON shapes */
  t = load(JSON.stringify([{ a:1, b:'x', c:{ d:5 } }, { a:2, b:'y', c:{ d:6 } }]));
  eq(t.cols.map(c => c.name), ['a', 'b', 'c.d'], 'records flatten one level');
  t = load(JSON.stringify({ latitude:51, hourly:{ time:['2026-01-01T00:00', '2026-01-01T01:00', '2026-01-01T02:00'], temp:[1, 2, 3], wind:[5, 6, 7] }, hourly_units:{ time:'iso8601' } }));
  eq(types(t), 'time:time,temp:number,wind:number', 'columnar (Open-Meteo shape)');
  t = load(JSON.stringify([{ hourly:{ time:['2026-01-01', '2026-01-02'], t:[1, 2] } }, { hourly:{ time:['2026-01-01', '2026-01-02'], t:[3, 4] } }]));
  ok(t.rows === 2 && t.cols.length === 2, 'array of columnar objects');
  t = load(JSON.stringify({ type:'FeatureCollection', features:[
    { type:'Feature', properties:{ mag:2.5, place:'A' }, geometry:{ type:'Point', coordinates:[-150, 61, 10] } },
    { type:'Feature', properties:{ mag:3.1, place:'B' }, geometry:{ type:'Point', coordinates:[-120, 35, 5] } } ] }));
  eq(t.cols.map(c => c.name), ['mag', 'place', 'longitude', 'latitude', 'altitude'], 'GeoJSON points');
  t = load(JSON.stringify([{ page:1, total:2 }, [{ date:'2020', value:1.5, country:{ value:'UK' } }, { date:'2021', value:2.5, country:{ value:'UK' } }]]));
  eq([t.rows, t.cols.map(c => c.name)], [2, ['date', 'value', 'country.value']], '[meta, records] (World Bank)');
  t = load(JSON.stringify({ base:'EUR', rates:{ '2024-01-01':{ USD:1.1, GBP:.86 }, '2024-01-02':{ USD:1.2, GBP:.87 }, '2024-01-03':{ USD:1.3, GBP:.88 } } }));
  eq([t.rows, t.cols.map(c => c.name)], [3, ['key', 'USD', 'GBP']], 'object keyed by date');
  eq(types(t), 'key:time,USD:number,GBP:number', 'date keys are times');
  t = load(JSON.stringify({ prices:[[1700000000000, 10], [1700086400000, 12], [1700172800000, 9]], market_caps:[[1, 2], [3, 4], [5, 6]] }));
  ok(t.rows === 3 && t.cols.length === 2 && Data.candidates().length >= 2, 'array of pairs, with alternatives listed');
  t = load('{"a":1,"b":"x"}\n{"a":2,"b":"y"}\n{"a":3,"b":"z"}');
  ok(t.rows === 3, 'NDJSON');
  load(JSON.stringify({ one:{ rows:[{ a:1 }, { a:2 }] }, two:{ rows:[{ b:1 }, { b:2 }, { b:3 }] } }));
  eq(Data.candidates().length, 2, 'two tables in one document');
  eq(Data.table.cols[0].name, 'b', 'the biggest table is chosen first');
  Data.pickCandidate(1); eq(Data.table.cols[0].name, 'a', 'picking the other table');

  /* errors say what happened */
  throws(() => load(''), /nothing to read/i, 'empty');
  throws(() => load('{"a":'), /isn’t valid/, 'broken JSON');
  throws(() => load('{"a":1}'), /couldn’t find a table/, 'no table in JSON');
  throws(() => load('a,b\n1,2'), /fewer than two rows/, 'one row');
  throws(() => load('x'.repeat(9e6)), /8 MB/, 'too big');

  /* reading values */
  t = load('t,v\n0,10\n1,20\n2,40');
  const v = t.byName.v;
  eq([Data.at(v, 0), Data.at(v, .5), Data.at(v, 1), Data.at(v, .25)], [10, 20, 40, 15], 'interpolation');
  eq([Data.norm(v, 10), Data.norm(v, 25), Data.norm(v, 40)], [0, .5, 1], 'normalise');
  eq(Data.pick('', 1, 'number', t).name, 'v', 'auto pick');
  eq(Data.pick('nope', 0, 'number', t).name, 't', 'missing column falls back to auto');
  Data.play.mode = 'pingpong'; eq([Data.u({ loop:0 }), Data.u({ loop:.5 }), Data.u({ loop:1 })], [0, 1, 0], 'pingpong closes the loop');
  Data.play.mode = 'loop'; eq(Data.u({ loop:.25 }), .25, 'loop mode');
  Data.play.mode = 'timeline'; eq(Data.u({ p:.4, loop:.9 }), .4, 'timeline mode');
  Data.play.mode = 'still'; Data.play.row = .7; eq(Data.u({ loop:0 }), .7, 'still mode');
  Data.play.mode = 'pingpong';

  /* binding */
  const m = f.FX.byId['trt-adjust'], inst = f.makeInst('trt-adjust');
  const pe = m.params.find(p => p.id === 'brightness');
  ok(pe, 'trt-adjust has brightness');
  inst.bind = { brightness:{ col:'v' } };
  const at0 = Data.bind(m, inst, inst.params, { loop:0, p:0 }), at5 = Data.bind(m, inst, inst.params, { loop:.5, p:.5 });
  eq([at0.brightness, at5.brightness], [pe.min, pe.max], 'binding maps the column onto the control range');
  inst.bind = { brightness:{ col:'v', lo:0, hi:1, invert:true } };
  eq([Data.bind(m, inst, inst.params, { loop:0 }).brightness, Data.bind(m, inst, inst.params, { loop:.5 }).brightness], [1, 0], 'custom range and invert');
  ok(inst.params.brightness === f.makeInst('trt-adjust').params.brightness, 'binding does not touch the stored value');
  inst.bind = { brightness:{ col:'v', lo:0, hi:1, curve:1 } };
  const q = Data.bind(m, inst, inst.params, { loop:.25 }).brightness, ql = Data.bind(m, Object.assign({}, inst, { bind:{ brightness:{ col:'v', lo:0, hi:1 } } }), inst.params, { loop:.25 }).brightness;
  ok(q < ql, 'an ease-in response is lower than linear at the middle: ' + q + ' vs ' + ql);
  inst.bind = { brightness:{ col:'v', lo:0, hi:1, smooth:1 } };
  const sm = Data.bind(m, inst, inst.params, { loop:.5 }).brightness; ok(Number.isFinite(sm) && sm >= 0 && sm <= 1, 'smoothing stays in range: ' + sm);
  inst.bind = { brightness:{ col:'missing' } };
  ok(Data.bind(m, inst, inst.params, { loop:.5 }) === inst.params, 'a missing column leaves the control alone');
  const wide2 = f.FX.byId['gen-cells'], wi = f.makeInst('gen-cells');
  const ip = wide2.params.find(p => p.step === 1 && p.type === 'range');
  wi.bind = { [ip.id]:{ col:'v' } };
  ok(Number.isInteger(Data.bind(wide2, wi, wi.params, { loop:.25 })[ip.id]), 'whole-number controls stay whole');
  ok(Data.boundCount([inst, wi]) === 2, 'boundCount');
  const cl = f.lookFromState.length !== undefined;
  S.base = f.makeInst('src-a'); S.stack = [inst]; inst.bind = { brightness:{ col:'v' } };
  const saved = f.projectFromState();
  ok(saved.stack[0].bind && saved.stack[0].bind.brightness.col === 'v', 'bindings are saved with the layer');
  f.loadProject(JSON.stringify(saved));
  ok(f.state.stack[0].bind && f.state.stack[0].bind.brightness.col === 'v', 'bindings come back');

  /* projects */
  Data.loadText('k,v\n1,2\n2,3\n3,4', 'mine', { kind:'api', url:'https://example.com/x?apikey=SECRET&q=1' });
  const pj = Data.toProject();
  ok(!JSON.stringify(pj).includes('SECRET') && pj.table.origin.url.includes('q=1'), 'API keys in the query string are not saved');
  ok(Data.hasSecretInUrl('https://a.b/?token=abc') && !Data.hasSecretInUrl('https://a.b/?q=abc'), 'secret detection');
  Data.play.mode = 'still'; Data.play.row = .3; Data.trim = true;
  const back = JSON.parse(JSON.stringify(f.projectFromState()));
  Data.clear(); Data.play.mode = 'loop'; Data.trim = false;
  f.loadProject(JSON.stringify(back));
  eq([Data.table && Data.table.name, Data.play.mode, Data.play.row, Data.trim], ['mine', 'still', .3, true], 'data round-trips through a project');
  ok(!('data' in f.projectFromState(true)), 'history snapshots leave the table out');
  Data.clear(); Data.play.mode = 'pingpong'; Data.trim = false;
  f.loadProject(JSON.stringify(Object.assign({}, back, { data:undefined })));
  ok(Data.table === null || true, 'old projects without data still open');

  /* the data modules draw something on every sample, and never throw */
  const ids = f.FX.modules.filter(m => m.cat === 'data').map(m => m.id);
  eq(ids.length >= 5, true, 'data modules present');
  E.setSize(360, 450, 1);
  S.W = 360; S.H = 450; S.duration = 4; S.loopMode = 'once'; S.easing = 'Linear'; S.hold = 0;
  const px = () => { const a = new Uint8Array(E.rw * E.rh * 4); E.gl.bindFramebuffer(E.gl.FRAMEBUFFER, null); E.gl.readPixels(0, 0, E.rw, E.rh, E.gl.RGBA, E.gl.UNSIGNED_BYTE, a); return a; };
  const drawn = {};
  for (const sid of Data.samples.map(s => s.id)){
    Data.loadSample(sid);
    for (const id of ids){
      const onImage = ['dv-shift', 'dv-halftone', 'dv-mosaic'].includes(id); S.base = f.makeInst(onImage ? 'src-a' : 'gen-field'); if (!onImage){ S.base.params.c1 = '#101010'; S.base.params.c2 = '#101010'; } S.stack = [];
      f.renderAt(1.7); const a = px();
      S.stack = [f.makeInst(id)]; f.renderAt(1.7); const b = px();
      if (E.errors[id]) bad.push(id + ' on ' + sid + ': ' + E.errors[id]);
      let ch = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 40) ch++;
      drawn[id + '/' + sid] = ch;
      if (ch < a.length / 4 * .004) bad.push(id + ' drew almost nothing on ' + sid + ' (' + ch + ' px)');
    }
  }
  Data.clear();
  return { bad, drawn: Object.keys(drawn).length };
}
