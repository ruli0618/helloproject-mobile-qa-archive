const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'tour_diary');
const ARCHIVE = path.join(OUT, '_tour_diary_archive.json');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dateOnly(value) {
  return String(value || '').slice(0, 10);
}

function textToHtml(text) {
  return esc(text || '')
    .replace(
      /&lt;img src=&quot;\/emoji\/emoji-images\/([^&"<>/]+\.gif)&quot;\/&gt;/g,
      '<img class="emoji" loading="lazy" src="assets/emoji/emoji-images/$1" alt="">',
    )
    .replace(
      /&lt;img src=&quot;\/emoji\/emoji-images\/([^&"<>/]+\.gif)&quot;\/(?=(?:\r?\n|$))/g,
      '<img class="emoji" loading="lazy" src="assets/emoji/emoji-images/$1" alt="">',
    )
    .replace(/\r?\n/g, '<br>');
}

function removeMaterialFileNames(text, materials) {
  let result = text || '';
  for (const material of materials || []) {
    if (material.material_title) {
      result = result.replaceAll(material.material_title, '');
    }
  }
  return result.trim();
}

function navLink(href, label) {
  return `<a class="archive-link" href="${href}">${esc(label)}</a>`;
}

function buildSourceUrl(category, entry, detail) {
  return `http://helloproject-mobile.com/dialy/tour/detail?content_id=${encodeURIComponent(detail.content_id || entry.list.content_id)}&menu_id=2&category_id=${encodeURIComponent(category.category_id)}&category_title=${encodeURIComponent(category.category_title)}&idx=${encodeURIComponent(detail.idx || entry.list.idx || '')}`;
}

function main() {
  const archive = JSON.parse(fs.readFileSync(ARCHIVE, 'utf8'));
  const categories = archive.categories || [];
  const entries = archive.entries || [];
  const byCategory = new Map();

  for (const category of categories) byCategory.set(category.category_id, []);
  for (const entry of entries) {
    const key = entry.category.category_id;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(entry);
  }

  const articleHtml = categories.map((category) => {
    const items = byCategory.get(category.category_id) || [];
    const cards = items.map((entry) => {
      const detail = entry.detail || entry.list || {};
      const materials = detail.materials || [];
      const body = removeMaterialFileNames(detail.content_text || '', materials);
      const images = materials
        .filter((material) => material.saved?.local_path)
        .map((material) => `<figure><img loading="lazy" src="${esc(material.saved.local_path)}" alt="${esc(material.material_title || detail.content_title || '')}"><figcaption>${esc(material.material_title || '')}</figcaption></figure>`)
        .join('');
      const search = [
        category.category_title,
        detail.content_title,
        detail.content_sub_title,
        body,
      ].join(' ');
      const sourceUrl = buildSourceUrl(category, entry, detail);
      return `<article class="diary-card" data-category="${esc(category.category_id)}" data-search="${esc(search)}">
  <header>
    <div>
      <div class="date">${esc(dateOnly(detail.release_date || entry.list.release_date))}</div>
      <h3>${esc(detail.content_title || entry.list.content_title)}</h3>
      ${detail.content_sub_title ? `<p class="member">${esc(detail.content_sub_title)}</p>` : ''}
    </div>
    <a class="source" href="${esc(sourceUrl)}">元ページ</a>
  </header>
  <div class="body">${textToHtml(body)}</div>
  ${images ? `<div class="images">${images}</div>` : ''}
</article>`;
    }).join('\n');
    return `<section class="tour-section" id="tour-${esc(category.category_id)}" data-category="${esc(category.category_id)}">
  <h2><span></span>${esc(category.category_title)} <b>${items.length}</b></h2>
  ${cards}
</section>`;
  }).join('\n');

  const nav = categories.map((category) => {
    const count = (byCategory.get(category.category_id) || []).length;
    return `<button class="tour-button" data-category="${esc(category.category_id)}"><span></span><strong>${esc(category.category_title)}</strong><b>${count}</b></button>`;
  }).join('\n');
  const archiveLinks = `<div class="nav-title">他のアーカイブ</div>
<a class="archive-link-row" style="--cat:#127e97" href="../hello_qa/index.html"><span></span><strong>ハロー！Q&amp;A</strong><b>開く</b></a>
<a class="archive-link-row" style="--cat:#127e97" href="../hello_pedia/index.html"><span></span><strong>ハローペディア</strong><b>開く</b></a>
<a class="archive-link-row" style="--cat:#4a88c7" href="../hello_pedia/media.html"><span></span><strong>妄想動画</strong><b>開く</b></a>
<a class="archive-link-row" style="--cat:#6b63b5" href="../special_events/index.html"><span></span><strong>特設イベント</strong><b>開く</b></a>
<a class="archive-link-row" style="--cat:#0b7fab" href="../mail/index.html"><span></span><strong>メール</strong><b>開く</b></a>`;

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ツアー日記アーカイブ</title>
<style>
:root{color-scheme:light;--ink:#162033;--sub:#637083;--line:#dbe3ee;--soft:#f4f7fb;--panel:#fff;--accent:#0b7fab;--warm:#d15f2f}
*{box-sizing:border-box}body{margin:0;background:var(--soft);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Sans","Yu Gothic",Meiryo,sans-serif;line-height:1.72;letter-spacing:0}
a{color:inherit}.hero{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.98);border-bottom:1px solid var(--line)}.hero-inner{max-width:1320px;margin:auto;padding:12px 18px 10px}
h1{font-size:24px;line-height:1.25;margin:0 0 6px}.meta{display:flex;gap:8px;flex-wrap:wrap;color:var(--sub);font-size:13px}.pill,.archive-link{border:1px solid var(--line);border-radius:999px;background:#fff;padding:2px 9px;text-decoration:none}.archive-link{color:#174154;font-weight:700}
main{max-width:1320px;margin:0 auto;padding:14px 18px 34px;display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px}
nav{position:sticky;top:86px;align-self:start;max-height:calc(100vh - 104px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px}.controls{display:grid;gap:8px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--line)}
input[type=search]{width:100%;font-size:15px;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:#fff}.clear{border:1px solid var(--line);background:#fff;border-radius:8px;padding:7px 10px;color:var(--ink);font-size:13px}.nav-title{font-size:12px;color:var(--sub);font-weight:700;margin:12px 0 6px}.archive-link-row{display:flex;align-items:center;gap:7px;width:100%;min-height:34px;margin-bottom:7px;padding:7px 8px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);font-size:13px;text-decoration:none}.archive-link-row span{width:10px;height:10px;border-radius:50%;background:var(--cat);flex:0 0 auto}.archive-link-row strong{font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.archive-link-row b{margin-left:auto;color:var(--sub);font-size:12px}
.tour-button{display:flex;align-items:center;gap:8px;width:100%;min-height:36px;margin-bottom:7px;padding:7px 8px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);text-align:left;font-size:13px}.tour-button span,h2 span{width:10px;height:10px;border-radius:50%;background:var(--accent);flex:0 0 auto}.tour-button strong{font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tour-button b,h2 b{margin-left:auto;color:var(--sub);font-size:12px}.tour-button.active{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent),transparent 78%);background:color-mix(in srgb,var(--accent),#fff 92%)}
.tour-section{margin-bottom:30px;content-visibility:auto;contain-intrinsic-size:1000px}h2{display:flex;align-items:center;gap:8px;font-size:20px;line-height:1.35;margin:4px 0 12px}
.diary-card{background:var(--panel);border:1px solid var(--line);border-radius:8px;margin:0 0 12px;overflow:hidden;content-visibility:auto;contain-intrinsic-size:360px}.diary-card header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line);background:#fbfcfe}.date{font-size:12px;color:var(--sub)}h3{font-size:18px;line-height:1.42;margin:1px 0 0}.member{margin:3px 0 0;color:#174154;font-weight:700}.source{align-self:start;color:var(--accent);font-size:12px;text-decoration:none;white-space:nowrap}.body{padding:14px;font-size:15px;overflow-wrap:anywhere}.body img.emoji{display:inline-block;width:1.25em;height:1.25em;vertical-align:-.2em;margin:0 .04em}.images{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,360px));justify-content:start;gap:10px;padding:0 14px 14px}.images:has(figure:only-child){grid-template-columns:minmax(180px,360px);justify-content:center}figure{margin:0;border:1px solid #edf1f6;border-radius:8px;overflow:hidden;background:#fff}img{display:block;width:100%;height:auto}figcaption{padding:6px 8px;color:var(--sub);font-size:12px;overflow-wrap:anywhere}.hidden{display:none!important}
@media(max-width:900px){body{background:#fff}.hero{position:static}.hero-inner{padding:12px}h1{font-size:21px}.meta{font-size:12px;gap:5px}main{display:block;padding:0;background:#fff}nav{position:static;max-height:none;margin:0;border-width:0 0 1px;border-radius:0;padding:10px 12px;background:#f8fafc}.controls{grid-template-columns:1fr auto}.controls .tour-button{grid-column:1/-1}.tour-section{padding:12px;margin:0;content-visibility:visible;contain-intrinsic-size:auto}h2{font-size:18px}.diary-card{border-left:0;border-right:0;border-radius:0;margin:0 -12px 10px;content-visibility:visible;contain-intrinsic-size:auto}.diary-card header{grid-template-columns:1fr;gap:6px;padding:11px 12px}.source{justify-self:start}.body{padding:12px}.images,.images:has(figure:only-child){grid-template-columns:minmax(0,360px);justify-content:center;padding:0 12px 12px}}
</style>
</head>
<body>
<header class="hero"><div class="hero-inner">
  <h1>ツアー日記アーカイブ</h1>
  <div class="meta">
    <span class="pill">ツアー ${categories.length}件</span>
    <span class="pill">日記 ${entries.length}件</span>
    <span class="pill">生成 ${esc(new Date(archive.generated_at).toLocaleString('ja-JP'))}</span>
    ${navLink('../../../../index.html', 'トップ')}
    ${navLink('../hello_qa/index.html', 'ハロー！Q&A')}
    ${navLink('../hello_pedia/index.html', 'ハロー！ペディア')}
    ${navLink('../special_events/index.html', '特設イベント')}
  </div>
</div></header>
<main>
<nav>
  <div class="controls">
    ${archiveLinks}
    <div class="nav-title">ツアー</div>
    <input id="search" type="search" placeholder="タイトル、本文、メンバー名で検索">
    <button class="clear" id="clear">クリア</button>
    <button class="tour-button active" data-category="all"><span></span><strong>すべて</strong><b>${entries.length}</b></button>
  </div>
  ${nav}
</nav>
<div id="content">${articleHtml}</div>
</main>
<script>
const search = document.getElementById('search');
const clear = document.getElementById('clear');
const buttons = [...document.querySelectorAll('.tour-button')];
const sections = [...document.querySelectorAll('.tour-section')];
const cards = [...document.querySelectorAll('.diary-card')];
let active = 'all';
function apply(){
  const q = search.value.trim().toLowerCase();
  for (const card of cards) {
    const catOk = active === 'all' || card.dataset.category === active;
    const textOk = !q || card.dataset.search.toLowerCase().includes(q);
    card.classList.toggle('hidden', !(catOk && textOk));
  }
  for (const section of sections) {
    const visible = [...section.querySelectorAll('.diary-card')].some(card => !card.classList.contains('hidden'));
    section.classList.toggle('hidden', !visible);
  }
  buttons.forEach(button => button.classList.toggle('active', button.dataset.category === active));
}
buttons.forEach(button => button.addEventListener('click', () => { active = button.dataset.category; apply(); if(active !== 'all') document.getElementById('tour-' + CSS.escape(active))?.scrollIntoView({block:'start'}); }));
search.addEventListener('input', apply);
clear.addEventListener('click', () => { search.value = ''; active = 'all'; apply(); search.focus(); });
</script>
</body>
</html>`;

  fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');
  console.log(JSON.stringify({ categories: categories.length, entries: entries.length, output: path.join(OUT, 'index.html') }, null, 2));
}

main();
