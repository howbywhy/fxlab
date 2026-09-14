"""Source-prep lifecycle: load, Looks, stale state, instance isolation.

    python3 tests/lifecycle.py
"""
import base64, io, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
from helpers import launch, load_assets, report

HERE = Path(__file__).resolve().parent
GOLDEN = HERE / 'goldens' / 'compositions' / 'lane-treated-tiles.png'
PIXEL, PCT = 8, 0.4

JS = """() => {
  const f = window.fxlab, S = f.state, E = f.Engine;
  f.App.playing = false; f.App.exporting = true;
  const ids = list => (list || []).map(i => i.id);
  const mk = (id, params) => { const i = f.makeInst(id); if (params) Object.assign(i.params, params); return i; };
  const bad = [];

  const eligible = new Set(f.FX.modules.filter(f.FX.laneEligible).map(m => m.id));
  const addA = document.querySelector('#secPrepare [data-add="A"]');
  if (!addA) bad.push('missing Prepare A add');
  else {
    addA.click();
    if ((document.getElementById('libCtxTitle') || {}).textContent !== 'Add to Prepare A')
      bad.push('missing Add to Prepare A context');
    if (document.querySelector('#libList .cat.looks')) bad.push('Looks shown in Prepare context');
    const shown = [...document.querySelectorAll('#libList .item')].map(el => el.dataset.id).filter(Boolean);
    if (shown.some(id => !eligible.has(id))) bad.push('Prepare A library listed ineligible modules');
    if ([...eligible].some(id => !shown.includes(id))) bad.push('Prepare A library missed a lane-eligible module');
    for (const id of ['kt-reveal', 'lg-logo', 'ovl-letterbox', 'tr-tiles', 'mx-blend', 'src-a', 'fx-echo']){
      if (shown.includes(id)) bad.push(id + ' shown in Prepare A library');
    }
    document.getElementById('libCtxDone').click();
    if (f.App.libTarget) bad.push('Browse all did not exit Library context');
  }
  for (const id of ['kt-reveal', 'lg-logo', 'ovl-letterbox', 'tr-tiles', 'mx-blend', 'src-a', 'fx-echo']){
    if (f.FX.laneEligible(f.FX.byId[id])) bad.push(id + ' is lane-eligible');
  }
  const names = [...document.querySelectorAll('#insp .stage-name')].map(el => el.textContent);
  if (names.join() !== 'Prepare,Combine,Finish') bad.push('inspector stages are ' + names.join());
  if ([...document.querySelectorAll('#libList .role')].some(el => /sets base|adds to stack/.test(el.textContent)))
    bad.push('Library still uses engine-role language');

  S.sources.A.process = [mk('trt-splittone', { contrast:1.4 }), mk('fx-reframe', { scale:1.8 })];
  S.sources.B.process = [mk('trt-riso')];
  S.base = mk('tr-tiles'); S.stack = [mk('ovl-letterbox')];
  const saved = f.projectFromState();
  const savedJson = JSON.stringify(saved);
  if (saved.sources.A.process.map(i => i.id).join() !== 'trt-splittone,fx-reframe') bad.push('projectFromState lost A process');
  saved.sources.A.process[0].params.contrast = 9;
  if (S.sources.A.process[0].params.contrast === 9) bad.push('projectFromState shared A params by reference');

  const old = { app:'fxlab', version:1, size:{ id:'ig-portrait', w:1080, h:1350 }, bg:'#000',
    timeline:{ duration:4, fps:30, loopMode:'once', easing:'Linear', hold:0 },
    sources:{ A:{ fit:0, zoom:1, x:0, y:0 }, B:{ fit:0, zoom:1, x:0, y:0 } },
    base:{ id:'src-a', on:true, params:{} }, stack:[] };
  f.loadProject(JSON.stringify(old));
  if (ids(S.sources.A.process).length || ids(S.sources.B.process).length)
    bad.push('old project without process left leftover lanes');

  f.loadProject(savedJson);
  if (ids(S.sources.A.process).join() !== 'trt-splittone,fx-reframe') bad.push('reload lost A order');
  if (ids(S.sources.B.process).join() !== 'trt-riso') bad.push('reload lost B');
  if (S.sources.A.process[0].params.contrast !== 1.4) bad.push('reload lost saved param');
  if (S.sources.A.process[1].params.scale !== 1.8) bad.push('reload lost reframe scale');

  const dirty = JSON.parse(JSON.stringify(saved));
  dirty.sources.A.process.push({ id:'no-such-mod', on:true, params:{} });
  dirty.sources.B.process.push({ id:'kt-reveal', on:true, params:{} });
  f.loadProject(JSON.stringify(dirty));
  if (ids(S.sources.A.process).join() !== 'trt-splittone,fx-reframe') bad.push('unknown id leaked into A');
  if (ids(S.sources.B.process).join() !== 'trt-riso') bad.push('ineligible kt-reveal leaked into B');

  const test = f.TEST_LOOKS.find(l => l.id === 't-prepare-tiles');
  if (!test) return { bad:['missing TEST_LOOKS t-prepare-tiles'], png:null };
  if (f.STARTER_LOOKS.some(l => l.id === 't-prepare-tiles')) bad.push('test Look leaked into STARTER_LOOKS');

  f.applyLook(test.data);
  if (S.base.id !== 'tr-tiles') bad.push('test Look did not restore base');
  if (ids(S.stack).join() !== 'ovl-letterbox') bad.push('test Look did not restore stack');
  if (ids(S.sources.A.process).join() !== 'trt-splittone') bad.push('test Look did not restore Prepare A');
  if (ids(S.sources.B.process).join() !== 'trt-riso') bad.push('test Look did not restore Prepare B');
  if (S.sources.A.process[0].params.contrast !== 1.4) bad.push('test Look lost splittone contrast');

  const snap = f.lookFromState();
  S.sources.A.process[0].params.contrast = 99;
  if (snap.sources.A.process[0].params.contrast === 99) bad.push('lookFromState shared params by reference');
  if (snap.sources.A.process === S.sources.A.process) bad.push('lookFromState shared the A array');
  if (snap.sources.A.process === snap.sources.B.process) bad.push('lookFromState aliased A and B arrays');

  const starter = f.STARTER_LOOKS.find(l => l.id === 's-knockout');
  f.applyLook(starter.data);
  if (ids(S.sources.A.process).length || ids(S.sources.B.process).length)
    bad.push('starter Look left previous Prepare lists in place');
  if (S.base.id !== 'src-a') bad.push('starter Look did not replace base');

  f.applyLook(test.data);
  if (ids(S.sources.A.process).join() !== 'trt-splittone') bad.push('test Look after starter did not restore A');

  const prepLook = f.STARTER_LOOKS.find(l => l.id === 's-cut');
  if (prepLook){
    f.applyLook(prepLook.data);
    if (ids(S.sources.A.process).join() !== 'trt-splittone' || ids(S.sources.B.process).join() !== 'trt-riso')
      bad.push('Prepared Cut did not restore Prepare lanes');
    f.applyLook(starter.data);
    if (ids(S.sources.A.process).length || ids(S.sources.B.process).length)
      bad.push('old starter after Prepared Cut left lanes behind');
    f.applyLook(prepLook.data);
    if (ids(S.sources.A.process).join() !== 'trt-splittone')
      bad.push('Prepared Cut after old starter did not restore A');
  }

  f.applyLook(test.data);
  f.refresh();
  const psum = (document.querySelector('#secPrepare .stage-sum') || {}).textContent || '';
  const csum = (document.querySelector('#secCombine .stage-sum') || {}).textContent || '';
  const fsum = (document.querySelector('#secFinish .stage-sum') || {}).textContent || '';
  if (!/Split tone/.test(psum) || !/Riso/.test(psum)) bad.push('prepare summary ' + JSON.stringify(psum));
  if (!/Tile flip/.test(csum)) bad.push('combine summary ' + JSON.stringify(csum));
  if (!/Letterbox/.test(fsum)) bad.push('finish summary ' + JSON.stringify(fsum));

  const addFin = document.querySelector('#secFinish [data-add="finish"]');
  if (!addFin) bad.push('missing Add to Finish');
  else {
    addFin.click();
    if ((document.getElementById('libCtxTitle') || {}).textContent !== 'Add to Finish')
      bad.push('missing Add to Finish context');
    const finIds = [...document.querySelectorAll('#libList .item')].map(el => el.dataset.id);
    if (finIds.includes('tr-tiles') || finIds.includes('src-a')) bad.push('Finish library showed combine modules');
    if (!finIds.includes('ovl-letterbox') || !finIds.includes('trt-grain')) bad.push('Finish library missed stack modules');
    document.getElementById('libCtxDone').click();
  }
  const addC = document.querySelector('#secCombine [data-add="combine"]');
  if (!addC) bad.push('missing Combine Change');
  else {
    addC.click();
    if ((document.getElementById('libCtxTitle') || {}).textContent !== 'Choose Combine')
      bad.push('missing Choose Combine context');
    const cIds = [...document.querySelectorAll('#libList .item')].map(el => el.dataset.id);
    if (cIds.includes('ovl-letterbox') || cIds.includes('trt-grain')) bad.push('Combine library showed finish modules');
    if (!cIds.includes('tr-tiles') || !cIds.includes('src-a')) bad.push('Combine library missed base modules');
    document.getElementById('libCtxDone').click();
  }

  S.sources.A.process = [mk('trt-splittone')];
  S.sources.B.process = [mk('trt-riso')];
  const beforeA = ids(S.sources.A.process).join(), beforeB = ids(S.sources.B.process).join();
  f.randomise();
  if (ids(S.sources.A.process).join() !== beforeA || ids(S.sources.B.process).join() !== beforeB)
    bad.push('randomise changed Prepare lists');

  if (f.projectName() !== 'Untitled' || f.slugName('Bounce Qualifier 01') !== 'bounce-qualifier-01')
    bad.push('project name helpers');
  if (f.fileStem() !== 'untitled') bad.push('unnamed fileStem is ' + f.fileStem());
  const unnamed = { app:'fxlab', version:1, size:{ id:'ig-portrait', w:1080, h:1350 }, bg:'#000',
    timeline:{ duration:4, fps:30, loopMode:'once', easing:'Linear', hold:0 },
    sources:{ A:{ fit:0, zoom:1, x:0, y:0 }, B:{ fit:0, zoom:1, x:0, y:0 } },
    base:{ id:'src-a', on:true, params:{} }, stack:[] };
  f.loadProject(JSON.stringify(unnamed));
  if (f.projectName() !== 'Untitled' || S.name) bad.push('old unnamed project did not fall back');
  f.setProjectName('Bounce Qualifier 01');
  if (f.projectFromState().name !== 'Bounce Qualifier 01') bad.push('projectFromState lost name');
  if (f.fileStem() !== 'bounce-qualifier-01') bad.push('named fileStem is ' + f.fileStem());
  const namedSnap = f.projectFromState();
  f.setProjectName('Other');
  f.loadProject(JSON.stringify(namedSnap));
  if (S.name !== 'Bounce Qualifier 01') bad.push('load did not restore project name');
  if ((document.getElementById('projTitle') || {}).textContent !== 'Bounce Qualifier 01')
    bad.push('header did not show project name');

  S.sources.A.process = [mk('trt-press'), mk('fx-reframe')];
  S.stack = [mk('trt-grain'), mk('ovl-letterbox')];
  f.refresh();
  const chA = document.querySelector('#secPrepare [data-change="A"][data-idx="0"]');
  if (!chA) bad.push('missing Prepare Change');
  else {
    const before = ids(S.sources.A.process).join();
    chA.click();
    if ((document.getElementById('libCtxTitle') || {}).textContent !== 'Replace in Prepare A')
      bad.push('missing Replace in Prepare A context');
    if (ids(S.sources.A.process).join() !== before) bad.push('Change mutated Prepare before a pick');
    if (document.querySelector('#libList .cat.looks')) bad.push('Looks shown in replace context');
    const shown = [...document.querySelectorAll('#libList .item')].map(el => el.dataset.id);
    if (shown.includes('ovl-letterbox') || shown.includes('tr-tiles')) bad.push('replace Prepare listed ineligible modules');
    document.getElementById('libCtxDone').click();
    if (ids(S.sources.A.process).join() !== before) bad.push('Cancel replace mutated Prepare');
    if (f.App.libTarget) bad.push('Cancel did not exit replace context');
    document.querySelector('#secPrepare [data-change="A"][data-idx="0"]').click();
    const duo = document.querySelector('#libList .item[data-id="trt-duotone"]');
    if (!duo) bad.push('Duotone missing from replace Prepare library');
    else duo.click();
    if (ids(S.sources.A.process).join() !== 'trt-duotone,fx-reframe') bad.push('Prepare replace was not in-place: ' + ids(S.sources.A.process));
    if (f.App.libTarget) bad.push('replace did not exit Library context');
  }
  const chF = document.querySelector('#secFinish [data-change="finish"][data-idx="0"]');
  if (!chF) bad.push('missing Finish Change');
  else {
    chF.click();
    if ((document.getElementById('libCtxTitle') || {}).textContent !== 'Replace in Finish')
      bad.push('missing Replace in Finish context');
    const half = document.querySelector('#libList .item[data-id="trt-halftone"]');
    if (!half) bad.push('Halftone missing from replace Finish library');
    else half.click();
    if (ids(S.stack).join() !== 'trt-halftone,ovl-letterbox') bad.push('Finish replace was not in-place: ' + ids(S.stack));
  }

  S.W = 480; S.H = 600; S.quality = 1;
  f.applyLook(test.data);
  S.W = 480; S.H = 600;
  E.setSize(480, 600, 1);
  f.App.stageOn.prepare = true; f.App.stageOn.finish = true;
  f.renderAt(2.0);
  const png = E.canvas.toDataURL('image/png');
  f.App.stageOn.prepare = false;
  f.renderAt(2.0);
  const prepOff = E.canvas.toDataURL('image/png');
  if (prepOff === png) bad.push('prepare bypass had no pixel effect');
  if (ids(S.sources.A.process).join() !== 'trt-splittone') bad.push('prepare bypass mutated A');
  f.App.stageOn.prepare = true;
  f.App.stageOn.finish = false;
  f.renderAt(2.0);
  const finOff = E.canvas.toDataURL('image/png');
  if (finOff === png) bad.push('finish bypass had no pixel effect');
  if (ids(S.stack).join() !== 'ovl-letterbox') bad.push('finish bypass mutated stack');
  f.App.stageOn.finish = true;
  f.renderAt(2.0);
  if (E.canvas.toDataURL('image/png') !== png) bad.push('restoring stage bypass changed pixels');
  const rawA = S.sources.A.process, rawB = S.sources.B.process;
  S.sources.A.process = []; S.sources.B.process = [];
  f.renderAt(2.0);
  const raw = E.canvas.toDataURL('image/png');
  S.sources.A.process = rawA; S.sources.B.process = rawB;

  /* Disclosure is session UI keyed by uid — rebuilds must not reopen collapses. */
  f.App.ui.stages.prepare = false;
  f.App.ui.stages.combine = true;
  f.App.ui.stages.finish = true;
  f.refresh();
  if (document.getElementById('secPrepare').classList.contains('open')) bad.push('Prepare collapse lost after refresh');
  if (!document.getElementById('secFinish').classList.contains('open')) bad.push('Finish open lost after refresh');
  S.stack = [mk('trt-grain'), mk('ovl-letterbox')];
  f.refresh();
  const uGrain = S.stack[0].uid, uBox = S.stack[1].uid;
  f.App.ui.inst[uGrain] = false; f.App.ui.inst[uBox] = true;
  f.refresh();
  const cardsA = [...document.querySelectorAll('#secStack .card')];
  if (!cardsA[0] || !cardsA[0].classList.contains('collapsed')) bad.push('first Finish collapse lost after rebuild');
  if (!cardsA[1] || cardsA[1].classList.contains('collapsed')) bad.push('second Finish open lost after rebuild');
  [S.stack[0], S.stack[1]] = [S.stack[1], S.stack[0]];
  f.refresh();
  const cardsB = [...document.querySelectorAll('#secStack .card')];
  if (cardsB[0].classList.contains('collapsed')) bad.push('reorder did not keep the open module open');
  if (!cardsB[1].classList.contains('collapsed')) bad.push('reorder did not keep the collapsed module collapsed');
  f.replaceInst(S.stack, 0, 'trt-halftone');
  f.refresh();
  const grain = S.stack.find(i => i.id === 'trt-grain');
  const grainCard = [...document.querySelectorAll('#secStack .card')][S.stack.findIndex(i => i.id === 'trt-grain')];
  if (!grain || f.App.ui.inst[grain.uid] !== false || !grainCard || !grainCard.classList.contains('collapsed'))
    bad.push('replace reopened an unrelated collapsed module');
  const proj = f.projectFromState();
  if (proj.stack.some(i => 'collapsed' in i || 'uid' in i)) bad.push('project stored disclosure or uid');
  if (JSON.stringify(proj).includes('stageOpen') || /"ui"/.test(JSON.stringify(proj)))
    bad.push('project stored inspector UI state');

  /* ----- Randomise scope, ASCII font, drag highlight, undo ----- */
  const snapIds = () => ({
    A: ids(S.sources.A.process).join(),
    B: ids(S.sources.B.process).join(),
    base: S.base && S.base.id,
    stack: ids(S.stack).join(),
  });
  const cloneLane = list => (list || []).map(i => ({ id:i.id, on:i.on, params:JSON.parse(JSON.stringify(i.params)) }));
  S.sources.A.process = [mk('trt-duotone')];
  S.sources.B.process = [mk('trt-halftone')];
  S.base = mk('mx-gradient');
  S.stack = [mk('kt-plane'), mk('fx-reframe'), mk('ovl-letterbox')];
  f.refresh();
  const keepA = cloneLane(S.sources.A.process), keepB = cloneLane(S.sources.B.process);
  const keepBase = S.base.id, keepType = S.stack[0].id, keepTypeP = JSON.stringify(S.stack[0].params);
  f.setRandScope({ prepareA:false, prepareB:false, combine:false, finish:true, type:false, logo:false, treatment:false, fx:true, overlay:false });
  f.randomise();
  if (JSON.stringify(cloneLane(S.sources.A.process)) !== JSON.stringify(keepA)) bad.push('scoped randomise mutated Prepare A');
  if (JSON.stringify(cloneLane(S.sources.B.process)) !== JSON.stringify(keepB)) bad.push('scoped randomise mutated Prepare B');
  if (S.base.id !== keepBase) bad.push('scoped randomise mutated Combine');
  if (S.stack[0].id !== keepType || JSON.stringify(S.stack[0].params) !== keepTypeP) bad.push('scoped randomise mutated Type');
  if (!S.stack.some(i => f.FX.byId[i.id] && f.FX.byId[i.id].cat === 'fx')) bad.push('scoped randomise missed Effects');
  if (S.sources.A.process.some(i => !eligible.has(i.id))) bad.push('randomise put ineligible module on Prepare A');
  f.setRandScope({ prepareA:true, prepareB:false, combine:false, finish:false, type:true, logo:true, treatment:true, fx:true, overlay:true });
  const bBefore = cloneLane(S.sources.B.process);
  const stackBefore = ids(S.stack).join();
  f.randomise();
  if (JSON.stringify(cloneLane(S.sources.B.process)) !== JSON.stringify(bBefore)) bad.push('Prepare A randomise touched B');
  if (ids(S.stack).join() !== stackBefore) bad.push('Prepare A randomise touched Finish');
  if (S.sources.A.process.some(i => !eligible.has(i.id))) bad.push('Prepare A randomise added ineligible');
  const menu = document.getElementById('randMenu');
  if (!menu) bad.push('missing Randomise scope menu');
  if (!document.getElementById('btnRandScope')) bad.push('missing Randomise scope button');

  const ascii = mk('trt-ascii');
  if (!f.FX.byId['trt-ascii'].params.some(p => p.id === 'font' && p.type === 'font'))
    bad.push('trt-ascii has no Font param');
  const fonts = f.Assets.fonts();
  if (f.Assets.identity.autoApply && (f.Assets.identity.type.text || fonts.length)){
    if (ascii.params.font !== 'role:text') bad.push('ascii default is ' + ascii.params.font + ', not role:text');
  } else if (ascii.params.font !== 'Helvetica') bad.push('ascii fallback font is ' + ascii.params.font);
  const auxOf = font => {
    const inst = mk('trt-ascii', { font, cell:16 });
    S.base = mk('src-a'); S.stack = [inst];
    f.renderAt(0);
    return inst._auxCanvas ? inst._auxCanvas.toDataURL() : '';
  };
  const auxHelv = auxOf('Helvetica'), auxMono = auxOf('Mono'), auxSerif = auxOf('Serif');
  if (!auxHelv || auxHelv === auxMono) bad.push('ascii Helvetica/Mono aux identical');
  if (auxHelv === auxSerif) bad.push('ascii Helvetica/Serif aux identical');
  if (fonts.length){
    const auxAsset = auxOf('asset:' + fonts[0].id);
    if (!auxAsset || auxAsset === auxHelv) bad.push('ascii imported font aux did not change');
    if (f.Assets.identity.type.display){
      const auxRole = auxOf('role:display');
      if (!auxRole) bad.push('ascii role:display produced no aux');
    }
  }

  const w = document.getElementById('stageWrap');
  const slot = document.querySelector('.slot');
  const dt = new DataTransfer();
  dt.items.add(new File(['x'], 'note.txt', { type:'text/plain' }));
  w.classList.add('drag'); slot.classList.add('drag'); f.App.dragDepth = 3;
  slot.dispatchEvent(new DragEvent('drop', { bubbles:true, cancelable:true, dataTransfer:dt }));
  if (w.classList.contains('drag')) bad.push('slot drop left stage highlight');
  if (slot.classList.contains('drag')) bad.push('slot drop left slot highlight');
  w.classList.add('drag'); f.App.dragDepth = 2;
  window.dispatchEvent(new DragEvent('drop', { bubbles:true, cancelable:true, dataTransfer:dt }));
  if (w.classList.contains('drag') || f.App.dragDepth) bad.push('window drop did not clear highlight');
  w.classList.add('drag'); f.App.dragDepth = 1;
  window.dispatchEvent(new DragEvent('dragend', { bubbles:true }));
  if (w.classList.contains('drag')) bad.push('dragend left stage highlight');
  w.classList.add('drag');
  document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  if (w.classList.contains('drag')) bad.push('Escape left stage highlight');

  S.base = mk('src-a');
  S.stack = [mk('trt-grain', { amount:.08 })];
  S.sources.A.process = [mk('trt-duotone')];
  S.sources.B.process = [];
  f.refresh();
  f.History.reset();
  const grainAmt = S.stack[0].params.amount;
  document.querySelector('[data-add="finish"]').click();
  const addBox = document.querySelector('#libList .item[data-id="ovl-letterbox"]');
  if (!addBox) bad.push('could not add letterbox for undo test');
  else {
    addBox.click();
    if (ids(S.stack).join() !== 'trt-grain,ovl-letterbox') bad.push('add module failed: ' + ids(S.stack));
    if (!f.History.undo()) bad.push('undo add returned false');
    if (ids(S.stack).join() !== 'trt-grain') bad.push('undo add did not restore: ' + ids(S.stack));
    if (!f.History.redo()) bad.push('redo add returned false');
    if (ids(S.stack).join() !== 'trt-grain,ovl-letterbox') bad.push('redo add did not restore');
  }
  f.History.record('replace', () => { f.replaceInst(S.stack, 0, 'trt-halftone'); f.refresh(); });
  if (S.stack[0].id !== 'trt-halftone') bad.push('replace for undo failed');
  f.History.undo();
  if (S.stack[0].id !== 'trt-grain') bad.push('undo replace did not restore grain');
  f.History.record('reorder', () => { S.stack.push(S.stack.shift()); f.refresh(); });
  const afterOrd = ids(S.stack).join();
  f.History.undo();
  if (ids(S.stack).join() === afterOrd && S.stack.length > 1) bad.push('undo reorder did nothing');
  const slider = document.querySelector('#secStack .prm input[type=range]');
  if (slider){
    const start = +slider.value;
    slider.value = String(Math.min(+slider.max, start + (+slider.step || .01)));
    slider.dispatchEvent(new Event('input', { bubbles:true }));
    slider.value = String(Math.min(+slider.max, start + 4 * (+slider.step || .01)));
    slider.dispatchEvent(new Event('input', { bubbles:true }));
    slider.dispatchEvent(new Event('change', { bubbles:true }));
    if (S.stack[0].params[f.FX.byId[S.stack[0].id].params.find(p => p.type === 'range').id] === start)
      bad.push('slider input did not change param');
    f.History.undo();
    const pid = f.FX.byId[S.stack[0].id].params.find(p => p.type === 'range').id;
    if (Math.abs(S.stack[0].params[pid] - start) > 1e-6) bad.push('undo slider did not restore pre-drag value');
  } else {
    f.History.record('param', () => { S.stack[0].params.amount = .4; });
    f.History.undo();
    if (S.stack[0].params.amount !== grainAmt) bad.push('undo param failed');
  }
  const prepN = S.sources.A.process.length;
  f.History.record('module', () => { S.sources.A.process.push(mk('trt-riso')); f.refresh(); });
  if (S.sources.A.process.length !== prepN + 1) bad.push('prepare edit did not add');
  f.History.undo();
  if (S.sources.A.process.length !== prepN) bad.push('undo prepare edit failed');
  f.setRandScope({ prepareA:false, prepareB:false, combine:true, finish:true, type:true, logo:true, treatment:true, fx:true, overlay:true });
  const recipe = JSON.stringify(f.projectFromState());
  f.randomise();
  if (JSON.stringify(f.projectFromState()) === recipe) bad.push('randomise produced no change');
  const randPast = f.History.past.length;
  f.History.undo();
  if (JSON.stringify(f.projectFromState()) !== recipe) bad.push('undo randomise did not restore recipe');
  if (f.History.past.length !== randPast - 1) bad.push('randomise was not a single undo step');
  const look = f.STARTER_LOOKS[0];
  if (look){
    const beforeLook = JSON.stringify(f.lookFromState());
    f.applyLook(look.data);
    if (JSON.stringify(f.lookFromState()) === beforeLook) bad.push('apply look made no change');
    f.History.undo();
    if (JSON.stringify(f.lookFromState()) !== beforeLook) bad.push('undo look did not restore');
  }
  f.History.record('module', () => { S.stack.push(mk('trt-vignette')); });
  f.History.undo();
  if (!f.History.future.length) bad.push('undo did not populate redo');
  f.History.record('module', () => { S.stack.push(mk('trt-bloom')); });
  if (f.History.future.length) bad.push('new edit after undo did not clear redo');
  f.History.record('module', () => { S.stack.push(mk('ovl-edge')); });
  const loaded = { app:'fxlab', version:1, size:{ id:'ig-portrait', w:1080, h:1350 }, bg:'#000',
    timeline:{ duration:4, fps:30, loopMode:'once', easing:'Linear', hold:0 },
    sources:{ A:{ fit:0, zoom:1, x:0, y:0 }, B:{ fit:0, zoom:1, x:0, y:0 } },
    base:{ id:'src-a', on:true, params:{} }, stack:[] };
  f.loadProject(JSON.stringify(loaded));
  if (f.History.past.length || f.History.future.length || f.History.txn)
    bad.push('load project did not reset history');
  f.History.reset();
  f.App.ui.stages.prepare = false;
  document.getElementById('search').value = 'spatial';
  document.getElementById('search').dispatchEvent(new Event('input', { bubbles:true }));
  document.querySelector('#secFinish .stage-h').click();
  if (f.History.past.length) bad.push('collapse/search created history');
  const search = document.getElementById('search');
  search.focus();
  const kz = new KeyboardEvent('keydown', { key:'z', code:'KeyZ', metaKey:true, ctrlKey:true, bubbles:true, cancelable:true });
  search.dispatchEvent(kz);
  if (kz.defaultPrevented) bad.push('Cmd-Z hijacked library search');
  const finalProj = f.projectFromState();
  if (finalProj.randScope || finalProj.history || finalProj.ui || JSON.stringify(finalProj).includes('fxlab-rand-scope'))
    bad.push('project stored randomise scope or history');
  if (JSON.stringify(finalProj).includes('"past"') && /history/i.test(JSON.stringify(finalProj)))
    bad.push('project serialised undo history');

  return {
    bad, png, raw,
    starters: f.STARTER_LOOKS.length,
    testLooks: f.TEST_LOOKS.map(l => l.id),
    modules: f.FX.modules.length,
  };
}"""


def decode_png(url):
    return Image.open(io.BytesIO(base64.b64decode(url.split(',', 1)[1]))).convert('RGB')


def diff_pct(act, exp):
    if act.size != exp.size:
        return 100.0
    aw, ah = act.size
    ap, ep = act.load(), exp.load()
    changed = 0
    for y in range(ah):
        for x in range(aw):
            ar, ag, ab = ap[x, y]
            er, eg, eb = ep[x, y]
            if max(abs(ar - er), abs(ag - eg), abs(ab - eb)) > PIXEL:
                changed += 1
    return 100.0 * changed / (aw * ah)


def main():
    failures = []
    extra = ''
    with sync_playwright() as p:
        browser, page, errors = launch(p)
        load_assets(page)
        res = page.evaluate(JS)
        browser.close()
    failures.extend(errors or [])
    failures.extend(res.get('bad') or [])
    if not GOLDEN.exists():
        failures.append('missing lane-treated-tiles golden')
    elif res.get('png'):
        got = diff_pct(decode_png(res['png']), Image.open(GOLDEN).convert('RGB'))
        if got > PCT:
            failures.append(f'test Look pixels differ {got:.2f}% from lane-treated-tiles')
        raw = diff_pct(decode_png(res['png']), decode_png(res['raw']))
        if raw < 2.0:
            failures.append(f'test Look almost identical to raw A/B ({raw:.2f}%)')
    extra = f"{res.get('starters')} starters · {res.get('testLooks')} · {res.get('modules')} modules"
    return report('lifecycle', failures, extra)


if __name__ == '__main__':
    sys.exit(main())
