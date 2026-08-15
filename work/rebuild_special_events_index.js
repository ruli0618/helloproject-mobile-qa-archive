const fs = require('fs');
const path = require('path');

const OUT = path.resolve('outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'special_events');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fileCount(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += fileCount(full, predicate);
    else if (predicate(full)) count += 1;
  }
  return count;
}

const events = [
  { title: '暑中見舞い 2026', date: '2026', href: 'pages/syotyuumimai_2026/index.html', color: '#0b7fab' },
  { title: '暑中見舞い 2025', date: '2025', href: 'pages/syotyuumimai_2025/index.html', color: '#0b7fab' },
  { title: 'クリスマス 2025', date: '2025', href: 'pages/xmas_2025/index.html', color: '#d15f2f' },
  { title: '年末特集 2025', date: '2025', href: 'pages/nenmatsu_2025/index.html', color: '#6b63b5' },
  { title: '年始特集 2026', date: '2026', href: 'pages/nenshi_2026/index.html', color: '#f1881a' },
  { title: '前田こころ 今月の一言', date: '', href: 'pages/maeda_word/index.html', color: '#20a239' },
].filter(item => fs.existsSync(path.join(OUT, item.href)));

const pageCount = fileCount(path.join(OUT, 'pages'), file => /\.html?$/i.test(file));
const spmessageCount = fileCount(path.join(OUT, 'spmessage'), file => /\.html?$/i.test(file));
const assetCount = fileCount(path.join(OUT, 'assets'));

const nav = events.map((item, index) => `<button class="event-button${index === 0 ? ' active' : ''}" style="--cat:${item.color}" data-event="event-${index}"><span></span><strong>${esc(item.title)}</strong><b>開く</b></button>`).join('\n');
const cards = events.map((item, index) => `<article class="event-card" id="event-${index}" data-search="${esc(`${item.title} ${item.date} ${item.href}`)}">
  <header>
    <div>
      <div class="date">${esc(item.date)}</div>
      <h2>${esc(item.title)}</h2>
      <p class="path">${esc(item.href)}</p>
    </div>
    <a class="source" href="${esc(item.href)}">開く</a>
  </header>
</article>`).join('\n');

const archiveLinks = `<div class="nav-title">他のアーカイブ</div>
<a class="archive-link-row" style="--cat:#127e97" href="../hello_qa/index.html"><span></span><strong>ハロー！Q&amp;A</strong><b>開く</b></a>
<a class="archive-link-row" style="--cat:#127e97" href="../hello_pedia/index.html"><span></span><strong>ハローペディア</strong><b>開く</b></a>
<a class="archive-link-row" style="--cat:#4a88c7" href="../hello_pedia/media.html"><span></span><strong>妄想動画</strong><b>開く</b></a>
<a class="archive-link-row" style="--cat:#d15f2f" href="../tour_diary/index.html"><span></span><strong>ツアー日記</strong><b>開く</b></a>
<a class="archive-link-row" style="--cat:#0b7fab" href="../mail/index.html"><span></span><strong>メール</strong><b>開く</b></a>`;

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ハロモバ 特設イベントアーカイブ</title>
<style>
:root{color-scheme:light;--ink:#162033;--sub:#637083;--line:#dbe3ee;--soft:#f4f7fb;--panel:#fff;--accent:#6b63b5}
*{box-sizing:border-box}body{margin:0;background:var(--soft);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Sans","Yu Gothic",Meiryo,sans-serif;line-height:1.65;letter-spacing:0}
a{color:inherit}.hero{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.98);border-bottom:1px solid var(--line)}.hero-inner{max-width:1320px;margin:auto;padding:12px 18px 10px}
h1{font-size:24px;line-height:1.25;margin:0 0 6px}.meta{display:flex;gap:8px;flex-wrap:wrap;color:var(--sub);font-size:13px}.pill,.archive-link{border:1px solid var(--line);border-radius:999px;background:#fff;padding:2px 9px;text-decoration:none}.archive-link{color:#174154;font-weight:700}
main{max-width:1320px;margin:0 auto;padding:14px 18px 34px;display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px}
nav{position:sticky;top:86px;align-self:start;max-height:calc(100vh - 104px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px}.controls{display:grid;gap:8px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--line)}
input[type=search]{width:100%;font-size:15px;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:#fff}.clear{border:1px solid var(--line);background:#fff;border-radius:8px;padding:7px 10px;color:var(--ink);font-size:13px}.nav-title{font-size:12px;color:var(--sub);font-weight:700;margin:12px 0 6px}
.archive-link-row,.event-button{display:flex;align-items:center;gap:7px;width:100%;min-height:34px;margin-bottom:7px;padding:7px 8px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);font-size:13px;text-decoration:none;text-align:left}.archive-link-row span,.event-button span{width:10px;height:10px;border-radius:50%;background:var(--cat);flex:0 0 auto}.archive-link-row strong,.event-button strong{font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.archive-link-row b,.event-button b{margin-left:auto;color:var(--sub);font-size:12px}.event-button.active{border-color:var(--cat);box-shadow:0 0 0 2px color-mix(in srgb,var(--cat),transparent 78%);background:color-mix(in srgb,var(--cat),#fff 92%)}
.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}.stat{background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px}.stat strong{display:block;font-size:22px;line-height:1.15}.stat span{color:var(--sub);font-size:12px}
.event-card{background:var(--panel);border:1px solid var(--line);border-radius:8px;margin:0 0 12px;overflow:hidden}.event-card header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line);background:#fbfcfe}.date{font-size:12px;color:var(--sub)}h2{font-size:20px;line-height:1.38;margin:1px 0 0}.path{margin:3px 0 0;color:var(--sub);font-size:13px;overflow-wrap:anywhere}.source{align-self:start;color:var(--accent);font-size:12px;text-decoration:none;white-space:nowrap}.hidden{display:none!important}
@media(max-width:900px){body{background:#fff}.hero{position:static}.hero-inner{padding:12px}h1{font-size:21px}.meta{font-size:12px;gap:5px}main{display:block;padding:0;background:#fff}nav{position:static;max-height:none;margin:0;border-width:0 0 1px;border-radius:0;padding:10px 12px;background:#f8fafc}.controls{grid-template-columns:1fr auto}.summary{grid-template-columns:repeat(2,minmax(0,1fr));padding:12px 12px 0;margin:0}.event-card{border-left:0;border-right:0;border-radius:0;margin:0}.event-card header{grid-template-columns:1fr}.source{justify-self:start}}
</style>
</head>
<body>
<header class="hero"><div class="hero-inner">
  <h1>ハロモバ 特設イベントアーカイブ</h1>
  <div class="meta"><span class="pill">イベント ${events.length}件</span><span class="pill">保存ページ ${pageCount + spmessageCount}件</span><span class="pill">素材 ${assetCount}件</span><a class="archive-link" href="../../../../index.html">トップ</a><a class="archive-link" href="../hello_qa/index.html">ハロー！Q&amp;A</a></div>
</div></header>
<main>
<nav><div class="controls">${archiveLinks}<div class="nav-title">イベント</div><input id="search" type="search" placeholder="イベント名、年、保存先で検索"><button class="clear" id="clear">クリア</button></div>${nav}</nav>
<section>
  <div class="summary"><div class="stat"><strong>${events.length}</strong><span>イベント</span></div><div class="stat"><strong>${pageCount + spmessageCount}</strong><span>保存ページ</span></div><div class="stat"><strong>${assetCount}</strong><span>素材</span></div></div>
  <div id="list">${cards}</div>
</section>
</main>
<script>
const search=document.getElementById('search'), clear=document.getElementById('clear'), cards=[...document.querySelectorAll('.event-card')], buttons=[...document.querySelectorAll('.event-button')];
function apply(){const q=search.value.trim().toLowerCase(); for(const card of cards) card.classList.toggle('hidden', q && !card.dataset.search.toLowerCase().includes(q));}
buttons.forEach(button=>button.addEventListener('click',()=>{buttons.forEach(b=>b.classList.toggle('active',b===button)); document.getElementById(button.dataset.event)?.scrollIntoView({block:'start'});}));
search.addEventListener('input',apply); clear.addEventListener('click',()=>{search.value=''; apply(); search.focus();});
</script>
</body>
</html>`;

fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');
console.log(JSON.stringify({ events: events.length, pages: pageCount + spmessageCount, assets: assetCount, output: path.join(OUT, 'index.html') }, null, 2));
