/* ---------------- Are.na references ----------------
   Bring a public Are.na channel in as reference images: pick one as A or B, or pull a
   palette from the board. It loads one channel the person names, on request, through the
   public v2 API (no key; the API and its image host allow web pages to read them).
   Images stay on Are.na: they are held in memory for the session, never written to the
   library, a project or a kit. Are.na's terms allow personal viewing and forbid bulk
   collection, so there is no crawling, no caching across sessions and no bundling.
------------------------------------------------ */
const Arena = (() => {
  const A = { channel:null, blocks:[], page:0, total:0, busy:false, error:'', input:'' };
  const API = 'https://api.are.na/v2/';
  /* a channel link, or a bare slug */
  A.slugOf = text => {
    text = String(text || '').trim(); if (!text) return '';
    try {
      const u = new URL(text);
      if (!/(^|\.)are\.na$/i.test(u.hostname)) return '';
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'channels') return parts[1] || '';
      if (parts[0] === 'block' || parts.length < 2) return '';
      return parts[1];
    } catch { return /^[a-z0-9][a-z0-9_-]{1,120}$/i.test(text) ? text : ''; }
  };
  A.channelUrl = (slug, page = 1, per = 40) => `${API}channels/${encodeURIComponent(slug)}?per=${per}&page=${page}`;
  A.contentsUrl = (slug, per = 100) => `${API}channels/${encodeURIComponent(slug)}/contents?per=${per}`;
  /* only Are.na's own image host is ever loaded, whatever the data says */
  const trusted = u => { try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)images\.are\.na$/i.test(x.hostname); } catch { return false; } };
  A.blocks_ = b => (Array.isArray(b) ? b : []).map(x => {
    const im = x && x.image || {}, pick = (...ks) => { for (const k of ks) if (im[k] && trusted(im[k].url)) return im[k].url; return ''; };
    return { id:x && x.id, kind:String(x && x.class || ''), title:String(x && (x.title || x.generated_title) || ''), thumb:pick('square', 'thumb', 'display'), display:pick('display', 'large'), source:x && x.source && typeof x.source.url === 'string' ? x.source.url : '', user:String(x && x.user && (x.user.username || x.user.slug) || '') };
  }).filter(b => b.thumb && b.display && Number.isFinite(+b.id));

  const explain = res => res.status === 404 ? 'I couldn’t find that channel. Check the link, and that the channel is public.'
    : res.status === 401 || res.status === 403 ? 'That channel is private, so it can’t be read without signing in to Are.na.'
    : res.status === 429 ? 'Are.na says too many requests came from this connection. Wait a minute and try again.'
    : `Are.na answered ${res.status}. Try again in a moment.`;

  A.load = async (text, more = false) => {
    const slug = A.slugOf(text);
    if (!slug) throw new Error('That doesn’t look like an Are.na channel link. It should look like https://www.are.na/name/channel-name');
    const page = more && A.channel && A.channel.slug === slug ? A.page + 1 : 1;
    let res;
    /* one quiet retry: a first request after idle sometimes fails while the connection wakes */
    for (let attempt = 0; attempt < 2 && !res; attempt++){
      try { res = await fetch(A.channelUrl(slug, page), { cache:'no-store' }); }
      catch { if (attempt) throw new Error('The browser couldn’t reach Are.na. Check the connection and try again.'); await new Promise(r => setTimeout(r, 700)); }
    }
    if (!res.ok) throw new Error(explain(res));
    const j = await res.json();
    const got = A.blocks_(j.contents);
    const own = j.user && (j.user.slug || j.user.username) || (j.owner && (j.owner.slug || j.owner.username)) || '';
    if (page === 1 || !A.channel || A.channel.slug !== slug){
      A.blocks = got; A.channel = { slug, title:String(j.title || slug), owner:String(own), length:+j.length || got.length, status:String(j.status || '') };
    } else A.blocks = A.blocks.concat(got.filter(b => !A.blocks.some(x => x.id === b.id)));
    A.page = page; A.total = A.channel.length;
    return A.blocks;
  };
  A.url = () => A.channel ? `https://www.are.na/${encodeURIComponent(A.channel.owner || 'channels')}/${encodeURIComponent(A.channel.slug)}` : '';
  A.clear = () => { A.channel = null; A.blocks = []; A.page = 0; A.total = 0; A.error = ''; };

  /* one image as a picture in memory: fetched with CORS, so it never taints the canvas */
  A.image = async (url, k) => {
    if (!trusted(url)) throw new Error('That image isn’t on Are.na’s image host, so I won’t load it.');
    let res; try { res = await fetch(url); } catch { throw new Error('The browser couldn’t load that image.'); }
    if (!res.ok) throw new Error(`Are.na answered ${res.status} for that image.`);
    const blob = await res.blob();
    if (!/^image\//.test(blob.type)) throw new Error('That block’s file isn’t a picture I can read.');
    return blob;
  };
  return A;
})();

let arenaTiles = 0;
function renderArena(){
  const box = $('#arenaBlock'); if (!box) return;
  const scroll = box.scrollTop; box.innerHTML = '';
  const head = el('div', 'ahead'); head.append('References', el('span', null, Arena.channel ? `${Arena.blocks.length} of ${Arena.total}` : 'Are.na'));
  box.append(head);
  box.append(el('p', 'anote', Arena.channel ? '' : 'Bring in a reference board: paste a public Are.na channel link. Pick a picture as A or B, or pull a palette from the board.'));
  const row = el('div', 'row'); row.style.cssText = 'display:flex;gap:6px';
  const inp = el('input'); inp.type = 'text'; inp.placeholder = 'https://www.are.na/…'; inp.value = Arena.input; inp.setAttribute('aria-label', 'Are.na channel link'); inp.style.flex = '1';
  inp.oninput = () => { Arena.input = inp.value; };
  const go = el('button', 'primary', Arena.busy ? 'Loading…' : 'Load'); go.disabled = Arena.busy;
  const run = async more => {
    Arena.busy = true; Arena.error = ''; renderArena();
    try { const n = Arena.blocks.length; await Arena.load(Arena.input, more); if (!Arena.blocks.length) Arena.error = 'That channel has no pictures I can show (only image blocks and links with a preview image are used).'; else if (more && Arena.blocks.length === n) Arena.error = 'That was the last of the pictures.'; }
    catch (e){ Arena.error = e.message; }
    Arena.busy = false; renderArena();
  };
  go.onclick = () => run(false); inp.onkeydown = e => { if (e.key === 'Enter') run(false); };
  row.append(inp, go); box.append(row);
  if (Arena.error) { const e = el('div', 'errbox', Arena.error); e.setAttribute('role', 'alert'); e.style.marginTop = '8px'; box.append(e); }
  if (Arena.channel && Arena.blocks.length){
    const info = el('p', 'anote'); info.append(el('b', null, Arena.channel.title), Arena.channel.owner ? ` · ${Arena.channel.owner} · ` : ' · ');
    const link = el('a', null, 'Open on Are.na'); link.href = Arena.url(); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.style.color = 'var(--lamp)'; info.append(link); box.append(info);
    const grid = el('div', 'agrid');
    Arena.blocks.forEach(b => {
      const tile = el('div', 'aimg'); const pic = el('img', 'pic'); pic.loading = 'lazy'; pic.decoding = 'async'; pic.referrerPolicy = 'no-referrer'; pic.alt = b.title || 'Untitled'; pic.src = b.thumb; pic.style.cssText = 'width:100%;height:auto;aspect-ratio:1;object-fit:cover;padding:0;display:block;background:#111'; pic.title = `${b.title || 'Untitled'}${b.user ? ' · ' + b.user : ''}`;
      const acts = el('div', 'acts'); const mk = (t, title, fn) => { const x = el('button', null, t); x.title = title; x.setAttribute('aria-label', title); x.onclick = fn; return x; };
      const use = async k => { try { const blob = await Arena.image(b.display); loadFile(k, new File([blob], `${(b.title || 'are-na-' + b.id).slice(0, 40)}.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`, { type:blob.type })); } catch (e){ toast(e.message, true, 6000); } };
      acts.append(mk('A', `Use “${b.title || 'this picture'}” as image A`, () => use('A')), mk('B', `Use “${b.title || 'this picture'}” as image B`, () => use('B')));
      tile.append(pic, acts, el('div', 'cap', b.title || (b.user ? `by ${b.user}` : 'Untitled'))); grid.append(tile);
    });
    box.append(grid);
    const tools = el('div', 'pal-tools');
    const pal = el('button', null, 'Pull a palette from these'); pal.title = 'Finds the main colours across the first twelve pictures';
    pal.onclick = async () => {
      pal.disabled = true; pal.textContent = 'Reading…';
      try {
        const imgs = []; for (const b of Arena.blocks.slice(0, 12)){ try { const blob = await Arena.image(b.thumb); imgs.push(await createImageBitmap(blob)); } catch { /* skip one that won't load */ } }
        const got = Assets.extract(imgs, 6); imgs.forEach(i => i.close && i.close());
        if (!got.length){ toast('Couldn’t read colours from that board.', true); }
        else { let n = 0; for (const c of got) if (await Assets.addColor(c.hex, `${Arena.channel.title.slice(0, 24)} ${n + 1}`)) n++; toast(n ? `Added ${n} colour${n > 1 ? 's' : ''} from the board to your palette.` : 'Those colours are already in the palette.'); }
      } catch (e){ toast(e.message || String(e), true); }
      pal.disabled = false; pal.textContent = 'Pull a palette from these';
    };
    tools.append(pal);
    if (Arena.blocks.length < Arena.total){ const more = el('button', 'ghost', 'Load more'); more.onclick = () => run(true); tools.append(more); }
    const clr = el('button', 'ghost', 'Clear'); clr.onclick = () => { Arena.clear(); renderArena(); }; tools.append(clr);
    box.append(tools);
    box.append(el('p', 'anote', 'The pictures belong to their makers. They stay on Are.na and are loaded here only for you to work with; they are not saved in your library or project.'));
  }
  box.scrollTop = scroll;
}
