const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(
  ROOT,
  'outputs',
  'helloproject-mobile-archive',
  'helloproject-mobile.com',
  'hello_qa',
);
const ARCHIVE = path.join(OUT, '_hello_qa_archive.json');

function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dateOnly(value) {
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function normalizeName(value) {
  return String(value ?? '').replace(/\s+/g, '').trim();
}

function titleKey(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/秘密道具/g, 'ひみつ道具')
    .trim();
}

function dayNumber(value) {
  const d = new Date(String(value ?? '').replace(/-/g, '/'));
  return Number.isFinite(d.getTime()) ? Math.floor(d.getTime() / 86400000) : 0;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const archive = JSON.parse(fs.readFileSync(ARCHIVE, 'utf8'));
const categories = archive.categories.map(clone);
const ogCategory = categories.find((cat) => cat.title === 'OG');
const activeCategories = categories.filter((cat) => cat.title !== 'OG');
const activeCategoryIds = new Set(activeCategories.map((cat) => cat.id));

const activeItems = archive.items
  .filter((item) => activeCategoryIds.has(item.category_id))
  .map(clone);
const ogItems = archive.items
  .filter((item) => item.category_title === 'OG')
  .map(clone);

const categoryByTitle = new Map(activeCategories.map((cat) => [cat.title, cat]));
const categoryById = new Map(activeCategories.map((cat) => [String(cat.id), cat]));
const formerMemberGroup = new Map(Object.entries({
  '譜久村聖': "モーニング娘。'26",
  '生田衣梨奈': "モーニング娘。'26",
  '飯窪春菜': "モーニング娘。'26",
  '石田亜佑美': "モーニング娘。'26",
  '佐藤優樹': "モーニング娘。'26",
  '小田さくら': "モーニング娘。'26",
  '野中美希': "モーニング娘。'26",
  '牧野真莉愛': "モーニング娘。'26",
  '羽賀朱音': "モーニング娘。'26",
  '森戸知沙希': "モーニング娘。'26",
  '竹内朱莉': 'アンジュルム',
  '勝田里奈': 'アンジュルム',
  '佐々木莉佳子': 'アンジュルム',
  '上國料萌衣': 'アンジュルム',
  '宮崎由加': 'Juice=Juice',
  '金澤朋子': 'Juice=Juice',
  '宮本佳林': 'Juice=Juice',
  '植村あかり': 'Juice=Juice',
  '稲場愛香': 'Juice=Juice',
  '山岸理子': 'つばきファクトリー',
  '浅倉樹々': 'つばきファクトリー',
  '小片リサ': 'つばきファクトリー',
  '島倉りか': 'BEYOOOOONDS',
}));

const memberOrderByCategory = new Map(Object.entries({
  "モーニング娘。'26": [
    '譜久村聖', '生田衣梨奈', '飯窪春菜', '石田亜佑美', '佐藤優樹', '小田さくら',
    '野中美希', '牧野真莉愛', '羽賀朱音', '加賀楓', '横山玲奈', '森戸知沙希',
    '北川莉央', '岡村ほまれ', '山﨑愛生', '櫻井梨央', '井上春華', '弓桁朱琴',
  ],
  'アンジュルム': [
    '和田彩花', '中西香菜', '竹内朱莉', '勝田里奈', '室田瑞希', '佐々木莉佳子',
    '上國料萌衣', '笠原桃奈', '船木結', '川村文乃', '伊勢鈴蘭', '橋迫鈴',
    '川名凜', '為永幸音', '松本わかな', '平山遊季', '下井谷幸穂', '後藤花',
  ],
  'Juice=Juice': [
    '宮崎由加', '金澤朋子', '高木紗友希', '宮本佳林', '植村あかり', '梁川奈々美',
    '段原瑠々', '稲場愛香', '工藤由愛', '松永里愛', '井上玲音', '有澤一華',
    '入江里咲', '江端妃咲', '石山咲良', '遠藤彩加里', '川嶋美楓',
  ],
  'つばきファクトリー': [
    '山岸理子', '小片リサ', '新沼希空', '谷本安美', '岸本ゆめの', '浅倉樹々',
    '小野瑞歩', '小野田紗栞', '秋山眞緒', '河西結心', '八木栞', '福田真琳',
    '豫風瑠乃', '石井泉羽', '村田結生', '土居楓奏',
  ],
  'BEYOOOOONDS': [
    '一岡伶奈', '島倉りか', '西田汐里', '江口紗耶', '高瀬くるみ', '前田こころ',
    '山﨑夢羽', '岡村美波', '清野桃々姫', '平井美葉', '小林萌花', '里吉うたの',
  ],
  'OCHA NORMA': [
    '斉藤円香', '広本瑠璃', '石栗奏美', '米村姫良々', '窪田七海', '田代すみれ',
    '中山夏月姫', '西﨑美空', '北原もも', '筒井澪心',
  ],
  'ロージークロニクル': [
    '橋田歩果', '吉田姫杷', '小野田華凜', '村越彩菜', '植村葉純', '松原ユリヤ',
    '島川波菜', '上村麗菜', '相馬優芽',
  ],
}));

const formerArtistIdGroup = new Map(Object.entries({
  '6': "モーニング娘。'26",
  '10': "モーニング娘。'26",
  '11': "モーニング娘。'26",
  '12': "モーニング娘。'26",
  '17': "モーニング娘。'26",
  '96': "モーニング娘。'26",
  '22': 'アンジュルム',
  '23': 'アンジュルム',
  '27': 'アンジュルム',
  '66': 'アンジュルム',
  '28': 'Juice=Juice',
  '31': 'Juice=Juice',
  '32': 'Juice=Juice',
  '35': 'Juice=Juice',
  '50': 'つばきファクトリー',
  '54': 'つばきファクトリー',
  '103': 'BEYOOOOONDS',
}));

const formerArtistIdCategoryId = new Map(Object.entries({
  '6': '2',
  '10': '2',
  '11': '2',
  '12': '2',
  '17': '2',
  '96': '2',
  '22': '3',
  '23': '3',
  '27': '3',
  '66': '3',
  '28': '4',
  '31': '4',
  '32': '4',
  '35': '4',
  '50': '26',
  '54': '26',
  '103': '94',
}));

const artistIdOrderByCategory = new Map(Object.entries({
  "モーニング娘。'26": ['6', '10', '11', '12', '17', '96'],
  'アンジュルム': ['22', '23', '27', '66'],
  'Juice=Juice': ['28', '31', '32', '35'],
  'つばきファクトリー': ['50', '54'],
  'BEYOOOOONDS': ['103'],
}));

for (const item of activeItems) {
  item.merged_from_og = [];
}

const memberCategoryStats = new Map();
for (const item of activeItems) {
  for (const comment of item.comments || []) {
    const name = normalizeName(comment.user_name);
    if (!name) continue;
    if (!memberCategoryStats.has(name)) memberCategoryStats.set(name, new Map());
    const stats = memberCategoryStats.get(name);
    const current = stats.get(item.category_id) || {
      category_id: item.category_id,
      category_title: item.category_title,
      category_color: item.category_color,
      count: 0,
      last_release: '',
    };
    current.count += 1;
    if (String(item.release_date) > String(current.last_release)) current.last_release = item.release_date;
    stats.set(item.category_id, current);
  }
}

function inferredCategoryFor(comment) {
  const explicitCategoryId = formerArtistIdCategoryId.get(String(comment.artist_id || ''));
  if (explicitCategoryId && categoryById.has(explicitCategoryId)) {
    return categoryById.get(explicitCategoryId);
  }
  const explicitGroupById = formerArtistIdGroup.get(String(comment.artist_id || ''));
  if (explicitGroupById && categoryByTitle.has(explicitGroupById)) {
    return categoryByTitle.get(explicitGroupById);
  }
  const explicitGroupTitle = formerMemberGroup.get(normalizeName(comment.user_name));
  if (explicitGroupTitle && categoryByTitle.has(explicitGroupTitle)) {
    return categoryByTitle.get(explicitGroupTitle);
  }
  const stats = memberCategoryStats.get(normalizeName(comment.user_name));
  if (!stats) return null;
  return [...stats.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(b.last_release).localeCompare(String(a.last_release));
  })[0];
}

function commentSortKey(categoryTitle, comment, fallbackIndex) {
  const idOrder = artistIdOrderByCategory.get(categoryTitle) || [];
  const idIndex = idOrder.indexOf(String(comment.artist_id || ''));
  if (idIndex !== -1) {
    return { rank: idIndex, fallbackIndex };
  }
  const order = memberOrderByCategory.get(categoryTitle) || [];
  const index = order.findIndex((name) => normalizeName(name) === normalizeName(comment.user_name));
  return {
    rank: index === -1 ? 10000 + fallbackIndex : index,
    fallbackIndex,
  };
}

function sortCommentsForItem(item) {
  item.comments = (item.comments || [])
    .map((comment, index) => ({ comment, index }))
    .sort((a, b) => {
      const ka = commentSortKey(item.category_title, a.comment, a.index);
      const kb = commentSortKey(item.category_title, b.comment, b.index);
      if (ka.rank !== kb.rank) return ka.rank - kb.rank;
      return ka.fallbackIndex - kb.fallbackIndex;
    })
    .map((entry) => entry.comment);
}

function findTargetItem(ogItem, comment) {
  const inferred = inferredCategoryFor(comment);
  if (!inferred) return null;
  const sameTitle = activeItems.filter((item) => titleKey(item.title) === titleKey(ogItem.title));
  if (sameTitle.length === 0) return null;
  const groupMatches = inferred
    ? sameTitle.filter((item) => item.category_id === inferred.category_id)
    : sameTitle;
  const pool = groupMatches.length ? groupMatches : sameTitle;
  const sameDate = pool.find((item) => dateOnly(item.release_date) === dateOnly(ogItem.release_date));
  if (sameDate) return sameDate;
  const ogDay = dayNumber(ogItem.release_date);
  return pool
    .slice()
    .sort((a, b) => Math.abs(dayNumber(a.release_date) - ogDay) - Math.abs(dayNumber(b.release_date) - ogDay))[0] || null;
}

const remainingOg = [];
let movedOgAnswers = 0;
let movedOgQuestions = new Set();
for (const ogItem of ogItems) {
  const leftover = clone(ogItem);
  leftover.comments = [];
  for (const comment of ogItem.comments || []) {
    const target = findTargetItem(ogItem, comment);
    if (target) {
      const moved = clone(comment);
      moved.moved_from_og = true;
      moved.original_category_title = 'OG';
      moved.original_release_date = ogItem.release_date;
      moved.original_url = ogItem.url;
      target.comments.push(moved);
      target.merged_from_og.push({
        name: comment.user_name,
        original_release_date: ogItem.release_date,
        original_url: ogItem.url,
      });
      movedOgAnswers += 1;
      movedOgQuestions.add(ogItem.content_id);
    } else {
      leftover.comments.push(comment);
    }
  }
  if (leftover.comments.length) remainingOg.push(leftover);
}

for (const item of activeItems) sortCommentsForItem(item);
for (const item of remainingOg) sortCommentsForItem(item);

const displayCategories = remainingOg.length ? categories : activeCategories;
const displayItems = [...activeItems, ...remainingOg];

const byCategory = new Map();
for (const item of displayItems) {
  if (!byCategory.has(item.category_id)) byCategory.set(item.category_id, []);
  byCategory.get(item.category_id).push(item);
}
for (const category of displayCategories) {
  const items = byCategory.get(category.id) || [];
  items.sort((a, b) => String(b.release_date).localeCompare(String(a.release_date)));
}

function answerHtml(comment) {
  const name = htmlEscape(comment.user_name || comment.artist_name || '回答');
  const img = comment.local_image
    ? `<img class="avatar" src="${htmlEscape(comment.local_image)}" alt="">`
    : '<div class="avatar placeholder"></div>';
  const body = htmlEscape(comment.comment_plain || '').replace(/\n/g, '<br>');
  const moved = comment.moved_from_og
    ? `<span class="moved">OGから統合</span>`
    : '';
  return `<article class="answer">
  ${img}
  <div class="answer-main">
    <div class="answer-name">${name}${moved}</div>
    <div class="answer-text">${body}</div>
  </div>
</article>`;
}

function itemHtml(item) {
  const date = dateOnly(item.release_date);
  const searchText = `${item.category_title} ${item.title} ${(item.comments || []).map((c) => `${c.user_name} ${c.comment_plain}`).join(' ')}`;
  const movedCount = (item.comments || []).filter((comment) => comment.moved_from_og).length;
  const mergedNote = movedCount
    ? `<div class="merged-note">OG回答 ${movedCount}件をこの質問へ統合</div>`
    : '';
  return `<section class="qa-card" data-category="${htmlEscape(item.category_id)}" data-text="${htmlEscape(searchText)}">
  <header class="qa-head">
    <div class="qa-title">
      <div class="date">${htmlEscape(date)}</div>
      <h3>${htmlEscape(item.title)}</h3>
      ${item.subtitle ? `<div class="subtitle">${htmlEscape(item.subtitle)}</div>` : ''}
      ${mergedNote}
    </div>
    <div class="qa-side">
      <div class="answer-count">${(item.comments || []).length}人</div>
      <a class="source-link" href="${htmlEscape(item.url)}">元ページ</a>
    </div>
  </header>
  <div class="answers">${(item.comments || []).map(answerHtml).join('\n')}</div>
</section>`;
}

const totalQuestions = displayItems.length;
const totalAnswers = displayItems.reduce((sum, item) => sum + (item.comments || []).length, 0);

const categoryButtons = displayCategories.map((cat) => {
  const count = (byCategory.get(cat.id) || []).length;
  return `<button class="cat" style="--cat:#${htmlEscape(cat.color)}" data-category="${htmlEscape(cat.id)}"><span></span>${htmlEscape(cat.title)} <b>${count}</b></button>`;
}).join('\n');

const nav = displayCategories.map((cat) => {
  const count = (byCategory.get(cat.id) || []).length;
  return `<a href="#cat-${htmlEscape(cat.id)}" style="--cat:#${htmlEscape(cat.color)}"><span></span>${htmlEscape(cat.title)}<b>${count}</b></a>`;
}).join('\n');

const sections = displayCategories.map((cat) => {
  const items = byCategory.get(cat.id) || [];
  const defer = displayCategories.findIndex((item) => item.id === cat.id) >= 2 ? ' deferred' : '';
  return `<section class="category-section${defer}" id="cat-${htmlEscape(cat.id)}" data-category-section="${htmlEscape(cat.id)}">
  <h2 style="--cat:#${htmlEscape(cat.color)}"><span></span>${htmlEscape(cat.title)} <small>${items.length}件</small></h2>
  ${items.map(itemHtml).join('\n')}
</section>`;
}).join('\n');

function htmlPage({ title, metaHtml, categoryButtonsHtml, navHtml, contentHtml, bodyClass = '', deferSections = false }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEscape(title)}</title>
<style>
:root{color-scheme:light;--ink:#162033;--sub:#5a6678;--line:#dbe3ee;--soft:#f4f7fb;--panel:#fff;--accent:#127e97}
*{box-sizing:border-box}
body{margin:0;background:var(--soft);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Sans","Yu Gothic",Meiryo,sans-serif;line-height:1.6;letter-spacing:0}
.hero{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.98);border-bottom:1px solid var(--line)}
.hero-inner{max-width:1320px;margin:auto;padding:16px 18px 13px}
h1{font-size:24px;margin:0 0 6px}
.meta{display:flex;gap:10px;flex-wrap:wrap;color:var(--sub);font-size:13px}
.pill{border:1px solid var(--line);border-radius:999px;background:#fff;padding:2px 8px}
.controls{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:10px;margin-top:12px}
input[type=search]{width:100%;font-size:16px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:#fff}
.clear{border:1px solid var(--line);background:#fff;border-radius:8px;padding:0 14px;color:var(--ink)}
.catbar{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;max-height:74px;overflow:auto}
.cat,.group-link{display:flex;align-items:center;gap:7px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 10px;font-size:13px;color:var(--ink);min-height:32px;text-decoration:none}
.cat span,.group-link span,nav span,h2 span{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--cat)}
.cat b,.group-link b,nav b{margin-left:2px;color:var(--sub);font-weight:600}
.cat.active{border-color:var(--cat);box-shadow:0 0 0 2px color-mix(in srgb,var(--cat),transparent 78%)}
main{max-width:1320px;margin:0 auto;padding:16px 18px 32px;display:grid;grid-template-columns:230px 1fr;gap:16px}
body.single main{display:block}
nav{position:sticky;top:calc(var(--sticky-top, 150px) + 10px);align-self:start;max-height:calc(100vh - var(--sticky-top, 150px) - 22px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px}
nav a{display:flex;align-items:center;gap:8px;color:var(--ink);text-decoration:none;padding:8px;border-radius:6px;font-size:13px}
nav a:hover{background:#f1f5f9}
.category-section{margin-bottom:28px;content-visibility:auto;contain-intrinsic-size:900px}
h2{display:flex;align-items:center;gap:9px;margin:4px 0 10px;font-size:20px}
h2 small{color:var(--sub);font-size:13px;font-weight:500}
.qa-card{background:var(--panel);border:1px solid var(--line);border-radius:8px;margin:0 0 12px;overflow:hidden;content-visibility:auto;contain-intrinsic-size:260px}
.qa-head{display:grid;grid-template-columns:1fr auto;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line);background:#fbfcfe}
.date{font-size:12px;color:var(--sub);margin-bottom:3px}
h3{font-size:17px;line-height:1.42;margin:0}
.subtitle,.merged-note{font-size:12px;color:var(--sub);margin-top:4px}
.merged-note{color:#8a5a00}
.qa-side{text-align:right;white-space:nowrap}
.answer-count{font-size:12px;color:var(--sub);margin-bottom:3px}
.source-link{color:var(--accent);font-size:12px;text-decoration:none}
.answers{padding:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
.answer{display:grid;grid-template-columns:42px 1fr;gap:10px;min-width:0;padding:10px;border:1px solid #edf1f6;border-radius:8px;background:#fff}
.avatar{width:42px;height:42px;border-radius:50%;object-fit:cover;border:1px solid var(--line);background:#edf2f7}
.placeholder{display:block}
.answer-name{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-weight:700;margin-bottom:3px;color:#14324a;font-size:14px}
.moved{font-size:11px;font-weight:600;color:#8a5a00;background:#fff4cf;border:1px solid #ffe09b;border-radius:999px;padding:0 6px}
.answer-text{font-size:14px;overflow-wrap:anywhere}
.hidden{display:none!important}.deferred{display:none}.showing-deferred .deferred{display:block}
@media(max-width:900px){main{display:block;padding:12px}nav{position:static;margin-bottom:12px}.hero-inner{padding:13px 12px}.controls{grid-template-columns:1fr}.qa-head{grid-template-columns:1fr}.qa-side{text-align:left}.answers{grid-template-columns:1fr}.catbar{max-height:112px}}
</style>
</head>
<body class="${bodyClass}">
<header class="hero">
  <div class="hero-inner">
    <h1>${htmlEscape(title)}</h1>
    <div class="meta">${metaHtml}</div>
    <div class="controls"><input id="search" type="search" placeholder="質問、回答、メンバー名で検索"><button class="clear" id="clear">クリア</button></div>
    <div class="catbar">${categoryButtonsHtml}</div>
  </div>
</header>
<main>
  ${navHtml ? `<nav>${navHtml}</nav>` : ''}
  <div id="content">${contentHtml}</div>
</main>
<script>
function setStickyTop(){
  const hero = document.querySelector('.hero');
  if (hero) document.documentElement.style.setProperty('--sticky-top', Math.ceil(hero.getBoundingClientRect().height) + 'px');
}
setStickyTop();
addEventListener('resize', setStickyTop, {passive:true});
const search = document.getElementById('search');
const clear = document.getElementById('clear');
const cards = [...document.querySelectorAll('.qa-card')];
const sections = [...document.querySelectorAll('.category-section')];
const buttons = [...document.querySelectorAll('.cat')];
let activeCategory = 'all';
let filterTimer = 0;
function applyFilter(){
  const q = search.value.trim().toLowerCase();
  for (const card of cards) {
    const catOk = activeCategory === 'all' || card.dataset.category === activeCategory;
    const textOk = !q || card.dataset.text.toLowerCase().includes(q);
    card.classList.toggle('hidden', !(catOk && textOk));
  }
  for (const section of sections) {
    const any = [...section.querySelectorAll('.qa-card')].some(card => !card.classList.contains('hidden'));
    section.classList.toggle('hidden', !any);
  }
}
buttons.forEach(btn => btn.addEventListener('click', () => {
  activeCategory = btn.dataset.category;
  buttons.forEach(b => b.classList.toggle('active', b === btn));
  applyFilter();
  setStickyTop();
}));
search.addEventListener('input', () => { clearTimeout(filterTimer); filterTimer = setTimeout(applyFilter, 120); });
clear.addEventListener('click', () => { search.value = ''; activeCategory = 'all'; buttons.forEach((b,i)=>b.classList.toggle('active', i===0)); applyFilter(); setStickyTop(); });
${deferSections ? `
const deferred = [...document.querySelectorAll('.deferred')];
if (deferred.length) {
  setTimeout(() => {
    document.body.classList.add('showing-deferred');
    setStickyTop();
  }, 80);
}` : ''}
</script>
</body>
</html>`;
}

function groupFileName(cat) {
  const index = String(displayCategories.findIndex((item) => item.id === cat.id) + 1).padStart(2, '0');
  const slug = cat.title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/'/g, '')
    .trim();
  return `${index}_${slug || cat.id}.html`;
}

const groupLinks = displayCategories.map((cat) => {
  const count = (byCategory.get(cat.id) || []).length;
  return `<a class="group-link" style="--cat:#${htmlEscape(cat.color)}" href="${htmlEscape(groupFileName(cat))}"><span></span>${htmlEscape(cat.title)} <b>${count}</b></a>`;
}).join('\n');

const metaHtml = `
      <span class="pill">質問 ${htmlEscape(totalQuestions)}件</span>
      <span class="pill">回答 ${htmlEscape(totalAnswers)}件</span>
      <span class="pill">OG統合回答 ${htmlEscape(movedOgAnswers)}件</span>
      <span class="pill">未統合OG質問 ${htmlEscape(remainingOg.length)}件</span>
      <span class="pill">生成 ${htmlEscape(new Date().toLocaleString('ja-JP'))}</span>`;
const html = htmlPage({
  title: 'ハロー！Q&A アーカイブ',
  metaHtml,
  categoryButtonsHtml: `<button class="cat active" data-category="all"><span style="background:#127e97"></span>すべて <b>${totalQuestions}</b></button>${categoryButtons}\n${groupLinks}`,
  navHtml: nav,
  contentHtml: sections,
  deferSections: true,
});

fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');
for (const cat of displayCategories) {
  const items = byCategory.get(cat.id) || [];
  const answers = items.reduce((sum, item) => sum + (item.comments || []).length, 0);
  const moved = items.reduce((sum, item) => sum + (item.comments || []).filter((comment) => comment.moved_from_og).length, 0);
  const content = `<section class="category-section" id="cat-${htmlEscape(cat.id)}" data-category-section="${htmlEscape(cat.id)}">
  <h2 style="--cat:#${htmlEscape(cat.color)}"><span></span>${htmlEscape(cat.title)} <small>${items.length}件</small></h2>
  ${items.map(itemHtml).join('\n')}
</section>`;
  const groupHtml = htmlPage({
    title: `ハロー！Q&A - ${cat.title}`,
    metaHtml: `<span class="pill">質問 ${htmlEscape(items.length)}件</span><span class="pill">回答 ${htmlEscape(answers)}件</span><span class="pill">OG統合回答 ${htmlEscape(moved)}件</span><span class="pill"><a href="index.html">全体へ戻る</a></span>`,
    categoryButtonsHtml: groupLinks,
    navHtml: '',
    contentHtml: content,
    bodyClass: 'single',
  });
  fs.writeFileSync(path.join(OUT, groupFileName(cat)), groupHtml, 'utf8');
}
fs.writeFileSync(path.join(OUT, '_hello_qa_merged_view_report.json'), JSON.stringify({
  generated_at: new Date().toISOString(),
  displayed_questions: totalQuestions,
  displayed_answers: totalAnswers,
  moved_og_answers: movedOgAnswers,
  moved_og_question_count: movedOgQuestions.size,
  remaining_og_questions: remainingOg.length,
  remaining_og_answers: remainingOg.reduce((sum, item) => sum + (item.comments || []).length, 0),
  group_pages: displayCategories.map((cat) => ({ category_title: cat.title, file: groupFileName(cat) })),
  category_counts: displayCategories.map((cat) => ({
    category_id: cat.id,
    category_title: cat.title,
    questions: (byCategory.get(cat.id) || []).length,
  })),
}, null, 2), 'utf8');

console.log(JSON.stringify({
  displayed_questions: totalQuestions,
  displayed_answers: totalAnswers,
  moved_og_answers: movedOgAnswers,
  moved_og_question_count: movedOgQuestions.size,
  remaining_og_questions: remainingOg.length,
  output: path.join(OUT, 'index.html'),
}, null, 2));
