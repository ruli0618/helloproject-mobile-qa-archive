const fs = require('fs');
const path = require('path');

const OUT = path.resolve('outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'hello_qa');
const archive = JSON.parse(fs.readFileSync(path.join(OUT, '_hello_qa_archive.json'), 'utf8'));

const historicalCategories = [
  { id: 'h_cute', title: '℃-ute', color: '9b59b6' },
  { id: 'h_country', title: 'カントリー・ガールズ', color: '7f8c8d' },
  { id: 'h_kobushi', title: 'こぶしファクトリー', color: 'b87333' },
];
const categoryOrder = ['2', '3', '4', '26', '94', '131', '174', 'h_cute', 'h_country', 'h_kobushi', '1'];
const categories = [
  ...archive.categories.map((cat) => ({ ...cat, id: String(cat.id) })),
  ...historicalCategories,
].sort((a, b) => categoryOrder.indexOf(a.id) - categoryOrder.indexOf(b.id));
const activeCategories = categories.filter((cat) => cat.title !== 'OG');
const categoryById = new Map(categories.map((cat) => [cat.id, cat]));

const formerIdToCategory = {
  6: '2', 10: '2', 11: '2', 12: '2', 17: '2', 96: '2',
  22: '3', 23: '3', 27: '3', 66: '3',
  28: '4', 31: '4', 32: '4', 35: '4',
  50: '26', 54: '26',
  103: '94',
  1: 'h_cute', 2: 'h_cute', 3: 'h_cute',
  38: 'h_country',
  46: 'h_kobushi',
};
const orderIds = {
  2: ['6', '10', '11', '12', '17', '96', '16', '14', '119', '120', '144', '147', '148', '168', '172', '173', '174'],
  3: ['22', '23', '27', '66', '112', '123', '121', '122', '124', '143', '150', '149', '166'],
  4: ['28', '31', '32', '35', '100', '46', '116', '117', '125', '126', '127', '146', '145', '151', '165'],
  26: ['50', '54', '56', '57', '58', '59', '60', '61', '62', '121', '122', '123', '124'],
  94: ['103', '104', '105', '107', '109', '110', '113', '114', '115', '169', '170', '171'],
  131: ['125', '126', '127', '128', '129', '130', '131', '132', '133', '134'],
  174: ['147', '148', '149', '150', '151', '152', '154', '155', '156'],
  h_cute: ['1', '2', '3'],
  h_country: ['38'],
  h_kobushi: ['46'],
};

function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function titleKey(value) {
  return String(value ?? '').replace(/\s+/g, ' ').replace(/秘密道具/g, 'ひみつ道具').trim();
}
function dateOnly(value) {
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}
function dedupeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}
function dayNumber(value) {
  const d = new Date(String(value ?? '').replace(/-/g, '/'));
  return Number.isFinite(d.getTime()) ? Math.floor(d.getTime() / 86400000) : 0;
}
function groupFileName(cat) {
  const index = String(categoryOrder.indexOf(cat.id) + 1).padStart(2, '0');
  const slug = cat.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, '_').replace(/'/g, '');
  return `${index}_${slug}.html`;
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function normalizeHiddenItem(item) {
  if (String(item.category_id) === '5') {
    item.category_id = 'h_country';
    item.category_title = 'カントリー・ガールズ';
  } else if (String(item.category_id) === '6' || String(item.category_id) === '124') {
    item.category_id = 'h_kobushi';
    item.category_title = 'こぶしファクトリー';
  }
  return item;
}

const activeItems = archive.items.filter((item) => item.category_title !== 'OG').map(clone).map(normalizeHiddenItem);
const ogItems = archive.items.filter((item) => item.category_title === 'OG').map(clone);
for (const item of activeItems) item.merged_from_og = [];
const syntheticTargetByKey = new Map();

function makeSyntheticTarget(ogItem, targetCategory) {
  const key = `${targetCategory}\t${titleKey(ogItem.title)}\t${dateOnly(ogItem.release_date)}`;
  if (syntheticTargetByKey.has(key)) return syntheticTargetByKey.get(key);
  const cat = categoryById.get(targetCategory) || { id: targetCategory, title: targetCategory };
  const target = {
    ...clone(ogItem),
    id: `og-${ogItem.content_id}-${targetCategory}`,
    category_id: targetCategory,
    category_title: cat.title,
    comments: [],
    merged_from_og: [],
    og_only_question: true,
  };
  activeItems.push(target);
  syntheticTargetByKey.set(key, target);
  return target;
}

function findTarget(ogItem, comment) {
  const targetCategory = formerIdToCategory[String(comment.artist_id || '')];
  if (!targetCategory) return null;
  const sameTitle = activeItems.filter((item) => item.category_id === targetCategory && titleKey(item.title) === titleKey(ogItem.title));
  if (!sameTitle.length) return makeSyntheticTarget(ogItem, targetCategory);
  const sameDate = sameTitle.find((item) => dateOnly(item.release_date) === dateOnly(ogItem.release_date));
  if (sameDate) return sameDate;
  const ogDay = dayNumber(ogItem.release_date);
  const nearest = sameTitle.slice().sort((a, b) => Math.abs(dayNumber(a.release_date) - ogDay) - Math.abs(dayNumber(b.release_date) - ogDay))[0];
  if (!nearest || Math.abs(dayNumber(nearest.release_date) - ogDay) > 45) return makeSyntheticTarget(ogItem, targetCategory);
  return nearest;
}

const remainingOg = [];
let movedOgAnswers = 0;
let skippedDuplicateOgAnswers = 0;
const movedQuestionIds = new Set();
for (const ogItem of ogItems) {
  const leftover = clone(ogItem);
  leftover.comments = [];
  for (const comment of ogItem.comments || []) {
    const target = findTarget(ogItem, comment);
    if (!target) {
      leftover.comments.push(comment);
      continue;
    }
    const duplicate = (target.comments || []).some((existing) => (
      String(existing.artist_id || '') === String(comment.artist_id || '')
      && dedupeText(existing.comment_plain || existing.comment_text) === dedupeText(comment.comment_plain || comment.comment_text)
    ));
    if (duplicate) {
      skippedDuplicateOgAnswers += 1;
      movedQuestionIds.add(ogItem.content_id);
      continue;
    }
    const moved = clone(comment);
    moved.moved_from_og = true;
    moved.original_category_title = 'OG';
    moved.original_release_date = ogItem.release_date;
    moved.original_url = ogItem.url;
    target.comments.push(moved);
    target.merged_from_og.push({ name: comment.user_name, original_release_date: ogItem.release_date, original_url: ogItem.url });
    movedOgAnswers += 1;
    movedQuestionIds.add(ogItem.content_id);
  }
  if (leftover.comments.length) remainingOg.push(leftover);
}

function sortComments(item) {
  const ids = orderIds[String(item.category_id)] || [];
  item.comments = (item.comments || [])
    .map((comment, index) => ({ comment, index }))
    .sort((a, b) => {
      const ai = ids.indexOf(String(a.comment.artist_id || ''));
      const bi = ids.indexOf(String(b.comment.artist_id || ''));
      const ar = ai === -1 ? 10000 + a.index : ai;
      const br = bi === -1 ? 10000 + b.index : bi;
      return ar - br || a.index - b.index;
    })
    .map((entry) => entry.comment);
}
for (const item of activeItems) sortComments(item);
for (const item of remainingOg) sortComments(item);

const displayItems = [...activeItems, ...remainingOg];
const displayCategories = remainingOg.length ? categories : activeCategories;
const byCategory = new Map();
for (const item of displayItems) {
  const id = String(item.category_id);
  if (!byCategory.has(id)) byCategory.set(id, []);
  byCategory.get(id).push(item);
}
for (const items of byCategory.values()) {
  items.sort((a, b) => String(b.release_date).localeCompare(String(a.release_date)));
}

function answerHtml(comment) {
  const img = comment.local_image ? `<img class="avatar" src="${htmlEscape(comment.local_image)}" alt="">` : '<div class="avatar placeholder"></div>';
  const moved = comment.moved_from_og ? '<span class="moved">OGから統合</span>' : '';
  return `<article class="answer">${img}<div class="answer-main"><div class="answer-name">${htmlEscape(comment.user_name)}${moved}</div><div class="answer-text">${htmlEscape(comment.comment_plain || '').replace(/\n/g, '<br>')}</div></div></article>`;
}
function itemHtml(item) {
  const movedCount = (item.comments || []).filter((c) => c.moved_from_og).length;
  const searchText = `${item.category_title} ${item.title} ${(item.comments || []).map((c) => `${c.user_name} ${c.comment_plain}`).join(' ')}`;
  const ogOnly = item.og_only_question ? '<div class="merged-note">OGページ由来の質問</div>' : '';
  return `<section class="qa-card" data-category="${htmlEscape(item.category_id)}" data-text="${htmlEscape(searchText)}"><header class="qa-head"><div class="qa-title"><div class="date">${htmlEscape(dateOnly(item.release_date))}</div><h3>${htmlEscape(item.title).replace(/秘密道具/g, 'ひみつ道具')}</h3>${ogOnly}${movedCount ? `<div class="merged-note">OG回答 ${movedCount}件をこの質問へ統合</div>` : ''}</div><div class="qa-side"><div class="answer-count">${(item.comments || []).length}人</div><a class="source-link" href="${htmlEscape(item.url)}">元ページ</a></div></header><div class="answers">${(item.comments || []).map(answerHtml).join('\n')}</div></section>`;
}

const totalQuestions = displayItems.length;
const totalAnswers = displayItems.reduce((sum, item) => sum + (item.comments || []).length, 0);

const nav = displayCategories.map((cat) => `<div class="nav-row" style="--cat:#${htmlEscape(cat.color)}"><button class="cat nav-filter" data-category="${htmlEscape(cat.id)}"><span></span><strong>${htmlEscape(cat.title)}</strong><b>${(byCategory.get(cat.id) || []).length}</b></button></div>`).join('\n');
const groupLinks = displayCategories.map((cat) => `<a class="group-link" style="--cat:#${htmlEscape(cat.color)}" href="${htmlEscape(groupFileName(cat))}"><span></span>${htmlEscape(cat.title)} <b>${(byCategory.get(cat.id) || []).length}</b></a>`).join('\n');
const archiveLinks = `<div class="nav-title">他のアーカイブ</div>
<div class="nav-row" style="--cat:#127e97"><a class="cat group-link" href="../hello_pedia/index.html"><span></span><strong>ハローペディア</strong><b>開く</b></a></div>
<div class="nav-row" style="--cat:#4a88c7"><a class="cat group-link" href="../hello_pedia/media.html"><span></span><strong>妄想動画</strong><b>開く</b></a></div>
<div class="nav-row" style="--cat:#d15f2f"><a class="cat group-link" href="../tour_diary/index.html"><span></span><strong>ツアー日記</strong><b>開く</b></a></div>
<div class="nav-row" style="--cat:#6b63b5"><a class="cat group-link" href="../special_events/index.html"><span></span><strong>特設イベント</strong><b>開く</b></a></div>
<div class="nav-row" style="--cat:#0b7fab"><a class="cat group-link" href="../mail/index.html"><span></span><strong>メール</strong><b>開く</b></a></div>`;
const archivePills = `<span class="pill"><a href="../hello_pedia/index.html">ペディア</a></span><span class="pill"><a href="../hello_pedia/media.html">妄想動画</a></span><span class="pill"><a href="../tour_diary/index.html">ツアー日記</a></span><span class="pill"><a href="../special_events/index.html">特設イベント</a></span><span class="pill"><a href="../mail/index.html">メール</a></span>`;
function sectionHtml(cat, deferred = false) {
  const items = byCategory.get(cat.id) || [];
  return `<section class="category-section${deferred ? ' deferred' : ''}" id="cat-${htmlEscape(cat.id)}" data-category-section="${htmlEscape(cat.id)}"><h2 style="--cat:#${htmlEscape(cat.color)}"><span></span>${htmlEscape(cat.title)} <small>${items.length}件</small></h2>${items.map(itemHtml).join('\n')}</section>`;
}

function page({ title, meta, buttons, navHtml, content, single = false, defer = false }) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)}</title><style>
:root{color-scheme:light;--ink:#162033;--sub:#5a6678;--line:#dbe3ee;--soft:#f4f7fb;--panel:#fff;--accent:#127e97}*{box-sizing:border-box}body{margin:0;background:var(--soft);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Sans","Yu Gothic",Meiryo,sans-serif;line-height:1.6;letter-spacing:0}.hero{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.98);border-bottom:1px solid var(--line)}.hero-inner{max-width:1320px;margin:auto;padding:12px 18px 10px}h1{font-size:23px;margin:0 0 5px}.meta{display:flex;gap:8px;flex-wrap:wrap;color:var(--sub);font-size:13px}.pill{border:1px solid var(--line);border-radius:999px;background:#fff;padding:2px 8px}.side-controls{display:grid;gap:8px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--line)}input[type=search]{width:100%;font-size:15px;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:#fff}.clear{border:1px solid var(--line);background:#fff;border-radius:8px;padding:7px 10px;color:var(--ink);font-size:13px}.nav-row{display:grid;grid-template-columns:1fr;gap:6px;margin-bottom:6px}.cat,.group-link{display:flex;align-items:center;gap:7px;border:1px solid var(--line);background:#fff;border-radius:8px;padding:7px 8px;font-size:13px;color:var(--ink);min-height:34px;text-decoration:none;width:100%;text-align:left}.cat strong{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cat span,.group-link span,nav span,h2 span{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--cat);flex:0 0 auto}.cat b,.group-link b,nav b{margin-left:auto;color:var(--sub);font-weight:600}.cat.active{border-color:var(--cat);box-shadow:0 0 0 2px color-mix(in srgb,var(--cat),transparent 78%);background:color-mix(in srgb,var(--cat),#fff 92%)}.nav-title{font-size:12px;color:var(--sub);font-weight:700;margin:10px 0 6px}main{max-width:1320px;margin:0 auto;padding:14px 18px 32px;display:grid;grid-template-columns:270px 1fr;gap:16px}body.single main{display:block}body.single .hero{position:static}nav{position:sticky;top:calc(var(--sticky-top,90px) + 10px);align-self:start;max-height:calc(100vh - var(--sticky-top,90px) - 22px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px}.category-section{margin-bottom:28px;content-visibility:auto;contain-intrinsic-size:900px}.qa-card{background:var(--panel);border:1px solid var(--line);border-radius:8px;margin:0 0 12px;overflow:hidden;content-visibility:auto;contain-intrinsic-size:260px}.qa-head{display:grid;grid-template-columns:1fr auto;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line);background:#fbfcfe}.date{font-size:12px;color:var(--sub);margin-bottom:3px}h3{font-size:17px;line-height:1.42;margin:0}.merged-note{font-size:12px;color:#8a5a00;margin-top:4px}.qa-side{text-align:right;white-space:nowrap}.answer-count{font-size:12px;color:var(--sub);margin-bottom:3px}.source-link{color:var(--accent);font-size:12px;text-decoration:none}.answers{padding:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}.answer{display:grid;grid-template-columns:42px 1fr;gap:10px;min-width:0;padding:10px;border:1px solid #edf1f6;border-radius:8px;background:#fff}.avatar{width:42px;height:42px;border-radius:50%;object-fit:cover;border:1px solid var(--line);background:#edf2f7}.placeholder{display:block}.answer-name{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-weight:700;margin-bottom:3px;color:#14324a;font-size:14px}.moved{font-size:11px;font-weight:600;color:#8a5a00;background:#fff4cf;border:1px solid #ffe09b;border-radius:999px;padding:0 6px}.answer-text{font-size:14px;overflow-wrap:anywhere}.hidden{display:none!important}.deferred{display:none}.showing-deferred .deferred{display:block}@media(max-width:900px){body{background:#fff}.hero{position:static}.hero-inner{padding:12px}h1{font-size:20px;line-height:1.25}.meta{gap:5px;font-size:12px}.pill{padding:1px 7px}main{display:block;padding:0;background:#fff}nav{position:static;max-height:none;margin:0;border-width:0 0 1px;border-radius:0;padding:10px 12px;background:#f8fafc}.side-controls{grid-template-columns:1fr auto;gap:7px;margin-bottom:8px;padding-bottom:8px}.side-controls .cat{grid-column:1/-1}.clear{min-width:64px}.nav-title{margin-top:8px}.nav-row{grid-template-columns:1fr;gap:7px;margin-bottom:7px}.cat{min-height:38px;font-size:13px}.category-section{padding:12px;margin:0;content-visibility:visible;contain-intrinsic-size:auto}h2{font-size:18px;margin:6px 0 10px}.qa-card{border-left:0;border-right:0;border-radius:0;margin:0 -12px 10px;content-visibility:visible;contain-intrinsic-size:auto}.qa-head{grid-template-columns:1fr;padding:11px 12px;gap:6px}.qa-side{text-align:left;display:flex;gap:10px;align-items:center}.answers{grid-template-columns:1fr;padding:10px;gap:8px}.answer{grid-template-columns:38px 1fr;padding:9px}.avatar{width:38px;height:38px}.answer-text{font-size:14px}body.single main{padding:0 0 24px}body.single .category-section{padding:12px}}
</style></head><body class="${single ? 'single' : ''}"><header class="hero"><div class="hero-inner"><h1>${htmlEscape(title)}</h1><div class="meta">${meta}</div></div></header><main>${navHtml ? `<nav><div class="side-controls"><input id="search" type="search" placeholder="質問、回答、メンバー名で検索"><button class="clear" id="clear">クリア</button><button class="cat active" data-category="all"><span style="background:#127e97"></span>すべて <b>${totalQuestions}</b></button></div>${archiveLinks}<div class="nav-title">グループ</div>${navHtml}</nav>` : ''}<div id="content">${content}</div></main><script>
function setStickyTop(){const hero=document.querySelector('.hero');if(hero)document.documentElement.style.setProperty('--sticky-top',Math.ceil(hero.getBoundingClientRect().height)+'px')}setStickyTop();addEventListener('resize',setStickyTop,{passive:true});const search=document.getElementById('search');const clear=document.getElementById('clear');const cards=[...document.querySelectorAll('.qa-card')];const sections=[...document.querySelectorAll('.category-section')];const buttons=[...document.querySelectorAll('.cat')];let activeCategory='all';let filterTimer=0;function applyFilter(){const q=search?search.value.trim().toLowerCase():'';for(const card of cards){const catOk=activeCategory==='all'||card.dataset.category===activeCategory;const textOk=!q||card.dataset.text.toLowerCase().includes(q);card.classList.toggle('hidden',!(catOk&&textOk))}for(const section of sections){const any=[...section.querySelectorAll('.qa-card')].some(card=>!card.classList.contains('hidden'));section.classList.toggle('hidden',!any)}}buttons.forEach(btn=>btn.addEventListener('click',()=>{activeCategory=btn.dataset.category;buttons.forEach(b=>b.classList.toggle('active',b===btn));applyFilter();setStickyTop()}));if(search)search.addEventListener('input',()=>{clearTimeout(filterTimer);filterTimer=setTimeout(applyFilter,120)});if(clear)clear.addEventListener('click',()=>{if(search)search.value='';activeCategory='all';buttons.forEach((b,i)=>b.classList.toggle('active',i===0));applyFilter();setStickyTop()});${defer ? `setTimeout(()=>{document.body.classList.add('showing-deferred');setStickyTop()},80);` : ''}
</script></body></html>`;
}

const sections = displayCategories.map((cat, i) => sectionHtml(cat, i >= 2)).join('\n');
const meta = `<span class="pill">質問 ${totalQuestions}件</span><span class="pill">回答 ${totalAnswers}件</span><span class="pill">OG統合回答 ${movedOgAnswers}件</span><span class="pill">未統合OG質問 ${remainingOg.length}件</span><span class="pill">生成 ${htmlEscape(new Date().toLocaleString('ja-JP'))}</span>`;
fs.writeFileSync(path.join(OUT, 'index.html'), page({ title: 'ハロー！Q&A アーカイブ', meta, buttons: '', navHtml: nav, content: sections, defer: true }), 'utf8');

for (const cat of displayCategories) {
  const items = byCategory.get(cat.id) || [];
  const answers = items.reduce((sum, item) => sum + (item.comments || []).length, 0);
  const moved = items.reduce((sum, item) => sum + (item.comments || []).filter((comment) => comment.moved_from_og).length, 0);
  fs.writeFileSync(path.join(OUT, groupFileName(cat)), page({
    title: `ハロー！Q&A - ${cat.title}`,
    meta: `<span class="pill">質問 ${items.length}件</span><span class="pill">回答 ${answers}件</span><span class="pill">OG統合回答 ${moved}件</span><span class="pill"><a href="index.html">全体へ戻る</a></span>${archivePills}`,
    buttons: groupLinks,
    navHtml: '',
    content: sectionHtml(cat),
    single: true,
  }), 'utf8');
}

fs.writeFileSync(path.join(OUT, '_hello_qa_merged_view_report.json'), JSON.stringify({
  generated_at: new Date().toISOString(),
  displayed_questions: totalQuestions,
  displayed_answers: totalAnswers,
  moved_og_answers: movedOgAnswers,
  skipped_duplicate_og_answers: skippedDuplicateOgAnswers,
  moved_og_question_count: movedQuestionIds.size,
  remaining_og_questions: remainingOg.length,
  remaining_og_answers: remainingOg.reduce((sum, item) => sum + (item.comments || []).length, 0),
  group_pages: displayCategories.map((cat) => ({ category_title: cat.title, file: groupFileName(cat) })),
  category_counts: displayCategories.map((cat) => ({ category_id: cat.id, category_title: cat.title, questions: (byCategory.get(cat.id) || []).length })),
}, null, 2), 'utf8');

console.log(JSON.stringify({ displayed_questions: totalQuestions, displayed_answers: totalAnswers, moved_og_answers: movedOgAnswers, skipped_duplicate_og_answers: skippedDuplicateOgAnswers, remaining_og_questions: remainingOg.length, output: path.join(OUT, 'index.html') }, null, 2));
