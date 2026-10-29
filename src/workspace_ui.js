/* ---------------- Workspaces ----------------
   One tab per task. The stage, timeline and undo stay put; the panel beside
   them changes. The module picker is a drawer over the panel, opened by the
   Add buttons or by search (⌘K), never a hidden mode.
------------------------------------------------ */
const WORKSPACES = ['images', 'combine', 'finish', 'data', 'colour', 'language', 'export'];
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);

function showWorkspace(id, keepPicker){
  if (!WORKSPACES.includes(id)) return;
  if (!keepPicker && App.libTarget) setLibTarget(null);
  App.ws = id;
  ['controls', ...WORKSPACES.filter(w => w !== 'controls')].forEach(w => {
    const on = w === id, tab = $('#tab' + cap1(w)), pane = $('#ws' + cap1(w));
    tab.classList.toggle('on', on); tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1;
    pane.classList.toggle('on', on);
  });
  if (id === 'export') renderExport();
  if (id === 'data') renderData();
  if (id === 'language') renderLanguage();
  if (id === 'controls') renderControls();
}
/* older call sites name the tab they meant */
const showTab = w => showWorkspace(w === 'lib' ? (App.ws || 'finish') : w === 'assets' ? 'images' : w === 'system' ? 'colour' : w, true);

/* a small count on each tab, so a layer switched on elsewhere is never invisible */
function updateBadges(){
  const set = (id, n, dot) => { const b = $('#badge' + cap1(id)); if (!b) return; b.hidden = !n && !dot; b.classList.toggle('dot', !n && !!dot); b.textContent = n ? String(n) : ''; };
  const lanes = [...state.sources.A.process, ...state.sources.B.process].filter(i => i.on !== false).length;
  set('images', lanes);
  set('combine', 0, state.base && state.base.id !== 'src-a');
  set('finish', state.stack.filter(i => i.on !== false).length);
  const linked = Data.boundCount([state.base, ...state.stack, ...state.sources.A.process, ...state.sources.B.process]);
  set('data', linked, !!Data.table);
}

function renderExport(){
  const sum = $('#frameSummary'); if (!sum) return;
  const sz = state.print ? `${state.print.preset} print` : (SIZES.find(s => s.id === state.sizeId) || {}).label || 'Custom';
  sum.textContent = `${state.W} × ${state.H} px · ${sz}. Change the size above the stage.`;
  const box = $('#batchBlock'); box.innerHTML = '';
  box.append(el('h3', null, 'Batch'));
  box.append(el('p', 'hint2', 'Render one composition at several sizes and colourways in a single zip.'));
  const open = App.batchOpen === true;
  const bt = el('button', null, open ? 'Hide batch options' : 'Set up a batch…');
  bt.onclick = () => { App.batchOpen = !open; renderExport(); };
  box.append(bt);
  if (open && SYS()) box.append(batchPanel());
}

/* Tooltips: the text of any title attribute, shown after a short pause (at once on keyboard focus,
   and at once when moving between controls). The title is moved to data-tip so the browser's own
   tooltip doesn't double up; an icon-only control keeps its name as aria-label. */
function initTooltips(){
  const tip = el('div'); tip.id = 'tip'; tip.setAttribute('role', 'tooltip'); document.body.append(tip);
  let timer = 0, target = null, lastShown = 0;
  const hide = () => { clearTimeout(timer); timer = 0; target = null; tip.classList.remove('on'); };
  const show = t => {
    const r = t.getBoundingClientRect(); tip.textContent = t.dataset.tip; tip.classList.add('on');
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2)), y = r.bottom + 8;
    if (y + h > innerHeight - 8) y = r.top - h - 8;
    tip.style.left = x + 'px'; tip.style.top = y + 'px'; lastShown = Date.now();
  };
  const adopt = t => {
    if (t.hasAttribute('title')){
      const v = t.getAttribute('title'); if (v){ t.dataset.tip = v; if (!t.getAttribute('aria-label') && !t.textContent.trim()) t.setAttribute('aria-label', v); }
      t.removeAttribute('title');
    }
    return t.dataset.tip ? t : null;
  };
  const arm = (t, now) => { hide(); target = t; if (now || Date.now() - lastShown < 600) show(t); else timer = setTimeout(() => show(t), 700); };
  document.addEventListener('pointerover', e => { const t = e.target.closest && e.target.closest('[title],[data-tip]'); if (!t || t === target) return; const a = adopt(t); if (a) arm(a); else hide(); });
  document.addEventListener('pointerout', e => { if (target && !target.contains(e.relatedTarget)) hide(); });
  document.addEventListener('focusin', e => { const t = e.target.closest && e.target.closest('[title],[data-tip]'); if (t && t.matches(':focus-visible')){ const a = adopt(t); if (a) arm(a, true); } });
  ['focusout', 'pointerdown', 'keydown', 'scroll', 'wheel'].forEach(n => document.addEventListener(n, hide, true));
}

function initWorkspaces(){
  initTooltips();
  ['controls', ...WORKSPACES].forEach(w => {
    const tab = $('#tab' + cap1(w));
    tab.onclick = () => showWorkspace(w);
    tab.onkeydown = e => {
      const i = WORKSPACES.indexOf(w), n = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : null;
      if (n == null) return;
      e.preventDefault(); const t = WORKSPACES[(n + WORKSPACES.length) % WORKSPACES.length]; showWorkspace(t); $('#tab' + cap1(t)).focus();
    };
  });
  $('#btnExportGo').onclick = () => showWorkspace('export');
  $('#btnAdd').onclick = () => setLibTarget('all');
  /* the picker is a list: arrows move through it, Enter picks the first match from search */
  $('#lib').addEventListener('keydown', e => {
    const items = [...document.querySelectorAll('#libList .item')], i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown'){ e.preventDefault(); (items[i + 1] || items[0] || {}).focus && (items[i + 1] || items[0]).focus(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); if (i > 0) items[i - 1].focus(); else $('#search').focus(); }
    else if (e.key === 'Enter' && document.activeElement === $('#search') && items[0]){ e.preventDefault(); items[0].click(); }
  });
  /* number keys switch tabs; ⌘K or / opens the picker */
  document.addEventListener('keydown', e => {
    if (App.mode === 'poster') return;
    if (e.key === 'Escape' && App.libTarget && !e.metaKey && !e.ctrlKey){ e.preventDefault(); setLibTarget(null); return; }
    if (e.metaKey || e.ctrlKey || e.altKey){
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)){ e.preventDefault(); setLibTarget('all'); }
      return;
    }
    if (typingField(e.target) || /input|textarea|select/i.test(e.target.tagName)) return;
    const n = +e.key;
    if (n >= 1 && n <= WORKSPACES.length){ e.preventDefault(); showWorkspace(WORKSPACES[n - 1]); }
    else if (e.key === '/'){ e.preventDefault(); setLibTarget('all'); }
  });
  /* hold to see the original, unprocessed A */
  const cmp = $('#btnCompare');
  const hold = on => { if (App.compare === on) return; App.compare = on; cmp.classList.toggle('held', on); markDirty(); };
  cmp.addEventListener('pointerdown', e => { e.preventDefault(); hold(true); });
  ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(ev => cmp.addEventListener(ev, () => hold(false)));
  cmp.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); hold(true); } });
  cmp.addEventListener('keyup', () => hold(false));
  WORKSPACES.forEach((w, i) => { const k = $('#tab' + cap1(w) + ' .k'); if (k) k.textContent = String(i + 1); });
  if (!App.player) showWorkspace('images');
}
