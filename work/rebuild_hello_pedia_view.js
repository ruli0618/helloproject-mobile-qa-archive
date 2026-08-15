const fs = require('fs');
const path = require('path');

const OUT = path.resolve('outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'hello_pedia');
const ARCHIVE = path.join(OUT, '_hello_pedia_archive.json');
const archive = JSON.parse(fs.readFileSync(ARCHIVE, 'utf8'));

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeBasicEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function textOnly(value) {
  return decodeBasicEntities(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dateOnly(value) {
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function splitEntries(html) {
  return String(html ?? '')
    .split(/(?=<b>【)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function renderContent(html) {
  const tokenPrefix = `__PEDIA_LINK_${Math.random().toString(36).slice(2)}_`;
  const links = [];
  let escaped = esc(html ?? '').replace(/&lt;a\s+([^&]*?)href=&quot;([^&]+)&quot;([^&]*?)&gt;([\s\S]*?)&lt;\/a&gt;/gi, (_, before, href, after, label) => {
    const token = `${tokenPrefix}${links.length}__`;
    const target = /target=&quot;_blank&quot;/i.test(before + after) ? ' target="_blank" rel="noopener"' : '';
    links.push(`<a href="${href}"${target}>${label}</a>`);
    return token;
  });

  escaped = escaped
    .replace(/&lt;b&gt;([\s\S]*?)&lt;\/b&gt;/gi, '<strong>$1</strong>')
    .replace(/\r?\n/g, '<br>');

  for (let i = 0; i < links.length; i += 1) {
    escaped = escaped.replace(`${tokenPrefix}${i}__`, links[i]);
  }
  return escaped;
}

function renderEntry(entry) {
  const titleMatch = entry.match(/^<b>(【[\s\S]*?】)<\/b>\s*/);
  const title = titleMatch?.[1] || '';
  const body = title ? entry.slice(titleMatch[0].length) : entry;
  return `<article class="pedia-entry">
    ${title ? `<h3>${esc(title)}</h3>` : ''}
    <div class="entry-body">${renderContent(body)}</div>
  </article>`;
}

function sourceUrl(item) {
  return `http://helloproject-mobile.com/content/artist10/detail?content_id=${encodeURIComponent(item.content_id)}&menu_id=25&idx=${encodeURIComponent(item.idx || '')}`;
}

const items = (archive.items || [])
  .map((item, index) => {
    const detail = item.detail || {};
    const rawHtml = detail.content_text || '';
    const entries = splitEntries(rawHtml);
    return {
      idx: Number(item.idx || index + 1),
      id: String(item.content_id || detail.content_id || index),
      title: detail.content_title || item.content_title || '',
      date: dateOnly(detail.release_date || item.release_date || item.created_at),
      rawHtml,
      plain: textOnly(rawHtml),
      entries,
      item,
    };
  })
  .sort((a, b) => b.idx - a.idx);

const entryCount = items.reduce((sum, item) => sum + (item.entries.length || 1), 0);

const archiveLinks = `<div class="nav-title">他のアーカイブ</div>
<a class="archive-link-row" style="--cat:#127e97" href="../hello_qa/index.html"><span></span><strong>ハロー！Q&amp;A</strong><b>開く</b></a>
<a class="archive-link-row" style="--cat:#4a88c7" href="media.html"><span></span><strong>妄想動画</strong><b>開く</b></a>
<a class="archive-link-row" style="--cat:#d15f2f" href="../tour_diary/index.html"><span></span><strong>ツアー日記</strong><b>開く</b></a>
<a class="archive-link-row" style="--cat:#6b63b5" href="../special_events/index.html"><span></span><strong>特設イベント</strong><b>開く</b></a>
<a class="archive-link-row" style="--cat:#0b7fab" href="../mail/index.html"><span></span><strong>メール</strong><b>開く</b></a>`;
const nav = items.map((item) => `<button class="pedia-button" data-id="item-${esc(item.id)}"><strong>${esc(item.title)}</strong><b>${item.entries.length || 1}</b><span>${esc(item.date)}</span></button>`).join('\n');

const cards = items.map((item) => {
  const search = `${item.title} ${item.date} ${item.plain}`;
  return `<article class="pedia-card" id="item-${esc(item.id)}" data-search="${esc(search)}">
  <header>
    <div>
      <div class="date">${esc(item.date)}</div>
      <h2>${esc(item.title)}</h2>
      <p class="count">No. ${esc(item.idx)} / ${item.entries.length || 1}項目</p>
    </div>
    <a class="source" href="${esc(sourceUrl(item.item))}">元ページ</a>
  </header>
  <div class="entry-list">${(item.entries.length ? item.entries : [item.rawHtml]).map(renderEntry).join('\n')}</div>
</article>`;
}).join('\n');

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ハロー！ペディア アーカイブ</title>
<style>
:root{color-scheme:light;--ink:#162033;--sub:#637083;--line:#dbe3ee;--soft:#f4f7fb;--panel:#fff;--accent:#0b7fab}
*{box-sizing:border-box}body{margin:0;background:var(--soft);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Sans","Yu Gothic",Meiryo,sans-serif;line-height:1.72;letter-spacing:0}
a{color:inherit}.hero{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.98);border-bottom:1px solid var(--line)}.hero-inner{max-width:1320px;margin:auto;padding:12px 18px 10px}
h1{font-size:24px;line-height:1.25;margin:0 0 6px}.meta{display:flex;gap:8px;flex-wrap:wrap;color:var(--sub);font-size:13px}.pill,.archive-link{border:1px solid var(--line);border-radius:999px;background:#fff;padding:2px 9px;text-decoration:none}.archive-link{color:#174154;font-weight:700}
main{max-width:1320px;margin:0 auto;padding:14px 18px 34px;display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px}
nav{position:sticky;top:86px;align-self:start;max-height:calc(100vh - 104px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px}.controls{display:grid;gap:8px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--line)}
input[type=search]{width:100%;font-size:15px;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:#fff}.clear{border:1px solid var(--line);background:#fff;border-radius:8px;padding:7px 10px;color:var(--ink);font-size:13px}.nav-title{font-size:12px;color:var(--sub);font-weight:700;margin:12px 0 6px}.archive-link-row{display:flex;align-items:center;gap:7px;width:100%;min-height:34px;margin-bottom:7px;padding:7px 8px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);font-size:13px;text-decoration:none}.archive-link-row span{width:10px;height:10px;border-radius:50%;background:var(--cat);flex:0 0 auto}.archive-link-row strong{font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.archive-link-row b{margin-left:auto;color:var(--sub);font-size:12px}
.all-button,.pedia-button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;width:100%;min-height:38px;margin-bottom:7px;padding:7px 8px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);text-align:left;font-size:13px}.all-button{display:flex;align-items:center}.all-button strong,.pedia-button strong{font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.all-button b,.pedia-button b{color:var(--sub);font-size:12px}.pedia-button span{grid-column:1/-1;color:var(--sub);font-size:12px}.all-button.active,.pedia-button.active{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent),transparent 78%);background:color-mix(in srgb,var(--accent),#fff 92%)}
.pedia-card{background:var(--panel);border:1px solid var(--line);border-radius:8px;margin:0 0 12px;overflow:hidden;content-visibility:auto;contain-intrinsic-size:520px}.pedia-card header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line);background:#fbfcfe}.date{font-size:12px;color:var(--sub)}h2{font-size:20px;line-height:1.38;margin:1px 0 0}.count{margin:3px 0 0;color:var(--sub);font-size:13px}.source{align-self:start;color:var(--accent);font-size:12px;text-decoration:none;white-space:nowrap}.entry-list{padding:14px;display:grid;gap:12px}.pedia-entry{border-top:1px solid var(--line);padding-top:12px}.pedia-entry:first-child{border-top:0;padding-top:0}.pedia-entry h3{font-size:17px;line-height:1.45;margin:0 0 6px;color:#174154}.entry-body{font-size:15px;line-height:1.85;overflow-wrap:anywhere}.entry-body a{color:var(--accent);font-weight:700}.hidden{display:none!important}
@media(max-width:900px){body{background:#fff}.hero{position:static}.hero-inner{padding:12px}h1{font-size:21px}.meta{font-size:12px;gap:5px}main{display:block;padding:0;background:#fff}nav{position:static;max-height:none;margin:0;border-width:0 0 1px;border-radius:0;padding:10px 12px;background:#f8fafc}.controls{grid-template-columns:1fr auto}.controls .all-button{grid-column:1/-1}.pedia-card{border-left:0;border-right:0;border-radius:0;margin:0;content-visibility:visible;contain-intrinsic-size:auto}.pedia-card header{grid-template-columns:1fr;gap:6px;padding:11px 12px}.source{justify-self:start}.entry-list{padding:12px}.pedia-entry h3{font-size:16px}#content{padding-bottom:24px}}
</style>
</head>
<body>
<header class="hero"><div class="hero-inner">
  <h1>ハロー！ペディア アーカイブ</h1>
  <div class="meta">
    <span class="pill">記事 ${items.length}件</span>
    <span class="pill">項目 ${entryCount}件</span>
    <span class="pill">生成 ${esc(new Date(archive.generated_at).toLocaleString('ja-JP'))}</span>
    <a class="archive-link" href="../../../../index.html">トップ</a>
    <a class="archive-link" href="../hello_qa/index.html">ハロー！Q&A</a>
    <a class="archive-link" href="../tour_diary/index.html">ツアー日記</a>
    <a class="archive-link" href="../special_events/index.html">特設イベント</a>
  </div>
</div></header>
<main>
<nav>
  <div class="controls">
    ${archiveLinks}
    <div class="nav-title">記事</div>
    <input id="search" type="search" placeholder="メンバー名、項目、本文で検索">
    <button class="clear" id="clear">クリア</button>
    <button class="all-button active" data-id="all"><strong>すべて</strong><b>${items.length}</b></button>
  </div>
  ${nav}
</nav>
<div id="content">${cards}</div>
</main>
<script>
const search = document.getElementById('search');
const clear = document.getElementById('clear');
const buttons = [...document.querySelectorAll('nav button[data-id]')];
const cards = [...document.querySelectorAll('.pedia-card')];
let active = 'all';
function apply(){
  const q = search.value.trim().toLowerCase();
  for (const card of cards) {
    const activeOk = active === 'all' || card.id === active;
    const textOk = !q || card.dataset.search.toLowerCase().includes(q);
    card.classList.toggle('hidden', !(activeOk && textOk));
  }
  buttons.forEach(button => button.classList.toggle('active', button.dataset.id === active));
}
buttons.forEach(button => button.addEventListener('click', () => {
  active = button.dataset.id;
  apply();
  if (active !== 'all') document.getElementById(active)?.scrollIntoView({block:'start'});
}));
search.addEventListener('input', apply);
clear.addEventListener('click', () => { search.value = ''; active = 'all'; apply(); search.focus(); });
</script>
</body>
</html>`;

fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');
console.log(JSON.stringify({ items: items.length, entries: entryCount, file: path.join(OUT, 'index.html') }, null, 2));
