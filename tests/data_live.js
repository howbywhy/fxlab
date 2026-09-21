async () => {
  const bad = [], out = [];
  for (const s of window.fxlab.Data.sources){
    try {
      const t = await window.fxlab.Data.fetchUrl(s.url);
      out.push(s.id + ' ' + t.rows + '×' + t.cols.length);
      if (t.rows < 3 || t.cols.length < 2) bad.push(s.id + ': only ' + t.rows + '×' + t.cols.length);
    } catch (e){ bad.push(s.id + ': ' + e.message); }
  }
  return { bad, out };
}
