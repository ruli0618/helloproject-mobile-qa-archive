const fs = require('fs');
const path = require('path');

const OUT = path.resolve('outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'hello_pedia');
const archive = JSON.parse(fs.readFileSync(path.join(OUT, '_hello_pedia_archive.json'), 'utf8'));

function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textOnly(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function dateOnly(value) {
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function slug(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

function splitEntries(html) {
  return String(html ?? '')
    .split(/(?=<b>【)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

const items = archive.items
  .map((item, index) => {
    const detail = item.detail || {};
    const rawHtml = detail.content_text || '';
    const entries = splitEntries(rawHtml);
    return {
      idx: Number(item.idx || index + 1),
      id: String(item.content_id),
      title: detail.content_title || item.content_title || '',
      date: dateOnly(detail.release_date || item.release_date || item.created_at),
      rawHtml,
      plain: textOnly(rawHtml),
      entries,
    };
  })
  .sort((a, b) => b.idx - a.idx);

function renderContent(html) {
  return String(html ?? '')
    .replace(/<a\s+/gi, '<a target="_blank" rel="noopener" ')
    .replace(/\r?\n/g, '<br>');
}

function renderEntry(entry) {
  const title = (entry.match(/<b>【([\s\S]*?)】<\/b>/) || [])[1];
  const body = title ? entry.replace(/<b>【[\s\S]*?】<\/b>\s*/, '') : entry;
  return `<article class="pedia-entry">${title ? `<h3>${title}</h3>` : ''}<div class="entry-body">${renderContent(body)}</div></article>`;
}

const cards = items.map((item) => `
  <article class="item-card" id="item-${item.id}" data-title="${htmlEscape(item.title)}" data-text="${htmlEscape(item.plain)}" data-date="${htmlEscape(item.date)}">
    <a class="anchor" href="#item-${item.id}" aria-label="${htmlEscape(item.title)}"></a>
    <header class="item-head">
      <div class="date"><span>${htmlEscape(item.date.slice(5, 7) || '--')}月</span><b>${htmlEscape(item.date.slice(8, 10) || '--')}</b><small>${htmlEscape(item.date.slice(0, 4))}</small></div>
      <div>
        <p class="eyebrow">No. ${item.idx} / ${item.entries.length || 1}項目</p>
        <h2>${htmlEscape(item.title)}</h2>
      </div>
    </header>
    <div class="entry-list">
      ${(item.entries.length ? item.entries : [item.rawHtml]).map(renderEntry).join('\n')}
    </div>
  </article>`).join('\n');

const nav = items.map((item) => `<a href="#item-${item.id}" data-title="${htmlEscape(item.title)}">${htmlEscape(item.title)}<span>${htmlEscape(item.date)}</span></a>`).join('\n');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ハロー！ペディア アーカイブ</title>
  <style>
    :root { color-scheme: light; --bg:#f5f7fb; --panel:#fff; --text:#152033; --muted:#66758d; --line:#dce4ef; --accent:#0b7fab; --soft:#e8f6fb; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:var(--bg); color:var(--text); }
    a { color:#006da8; }
    .app { min-height:100vh; display:grid; grid-template-columns: 300px minmax(0,1fr); }
    aside { position:sticky; top:0; height:100vh; overflow:auto; padding:18px; background:#fff; border-right:1px solid var(--line); }
    main { min-width:0; padding:24px; }
    .brand { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:16px; }
    h1 { font-size:24px; line-height:1.25; margin:0; }
    .top-link { display:inline-flex; align-items:center; justify-content:center; min-height:36px; padding:0 12px; border:1px solid var(--line); border-radius:8px; text-decoration:none; color:var(--text); background:#f8fafc; font-weight:700; }
    .stats { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0 16px; }
    .pill { border:1px solid var(--line); border-radius:999px; padding:7px 10px; background:#fff; color:var(--muted); font-size:13px; }
    .search { width:100%; min-height:42px; border:1px solid var(--line); border-radius:8px; padding:0 12px; font-size:16px; }
    .nav { display:flex; flex-direction:column; gap:7px; margin-top:14px; }
    .nav a { display:block; padding:10px 11px; border:1px solid var(--line); border-radius:8px; text-decoration:none; color:var(--text); background:#fff; font-weight:750; }
    .nav span { display:block; margin-top:4px; color:var(--muted); font-size:12px; font-weight:500; }
    .hero { max-width:980px; margin:0 auto 16px; }
    .hero p { color:var(--muted); line-height:1.7; margin:8px 0 0; }
    .item-list { max-width:980px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
    .item-card { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:18px; box-shadow:0 8px 24px rgba(18,35,60,.06); scroll-margin-top:18px; }
    .item-head { display:grid; grid-template-columns:64px 1fr; gap:14px; align-items:center; margin-bottom:14px; }
    .date { width:64px; min-height:72px; border-radius:8px; background:var(--soft); color:#075d7e; text-align:center; border:1px solid #b9e0ed; padding:6px 4px; }
    .date span, .date small { display:block; font-size:12px; color:#31758d; }
    .date b { display:block; font-size:26px; line-height:1.05; }
    .eyebrow { color:var(--muted); font-size:13px; margin:0 0 4px; }
    h2 { font-size:22px; line-height:1.35; margin:0; }
    .entry-list { display:grid; grid-template-columns:1fr; gap:12px; }
    .pedia-entry { border-top:1px solid var(--line); padding-top:12px; }
    .pedia-entry:first-child { border-top:0; padding-top:0; }
    .pedia-entry h3 { margin:0 0 8px; font-size:17px; color:#0b6f95; }
    .entry-body { font-size:15px; line-height:1.85; overflow-wrap:anywhere; }
    .entry-body a { font-weight:700; }
    .hidden { display:none !important; }
    @media (max-width: 860px) {
      .app { display:block; }
      aside { position:static; height:auto; border-right:0; border-bottom:1px solid var(--line); }
      main { padding:16px; }
      .nav { max-height:260px; overflow:auto; }
      .item-card { padding:14px; }
      .item-head { grid-template-columns:56px 1fr; gap:10px; }
      .date { width:56px; min-height:64px; }
      h1 { font-size:22px; }
      h2 { font-size:19px; }
    }
  </style>
</head>
<body>
  <div class="app">
    <aside>
      <div class="brand">
        <h1>ハロー！ペディア</h1>
        <a class="top-link" href="../../../../index.html">入口</a>
        <a class="top-link" href="../hello_qa/index.html">Q&amp;A</a>
      </div>
      <div class="stats">
        <span class="pill">記事 ${items.length}件</span>
        <span class="pill">項目 ${items.reduce((sum, item) => sum + (item.entries.length || 1), 0)}件</span>
      </div>
      <input class="search" id="search" type="search" placeholder="タイトル・本文を検索">
      <nav class="nav" id="nav">${nav}</nav>
    </aside>
    <main>
      <section class="hero">
        <h1>ハロー！ペディア アーカイブ</h1>
        <p>ハロ！モバ宣伝会議連動の辞書コンテンツを保存した閲覧用ページです。左の一覧または検索から記事へ移動できます。</p>
      </section>
      <section class="item-list" id="items">${cards}</section>
    </main>
  </div>
  <script>
    const search = document.getElementById('search');
    const cards = [...document.querySelectorAll('.item-card')];
    const navLinks = [...document.querySelectorAll('#nav a')];
    function normalize(value) { return String(value || '').toLowerCase().normalize('NFKC'); }
    search.addEventListener('input', () => {
      const q = normalize(search.value);
      for (const card of cards) {
        const hit = !q || normalize(card.dataset.title + ' ' + card.dataset.text).includes(q);
        card.classList.toggle('hidden', !hit);
      }
      for (const link of navLinks) {
        const target = document.querySelector(link.getAttribute('href'));
        link.classList.toggle('hidden', target?.classList.contains('hidden'));
      }
    });
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(JSON.stringify({
  items: items.length,
  entries: items.reduce((sum, item) => sum + (item.entries.length || 1), 0),
  file: path.join(OUT, 'index.html'),
}, null, 2));
