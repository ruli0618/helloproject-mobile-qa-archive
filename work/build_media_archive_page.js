const fs = require('fs');
const path = require('path');

const ROOT = path.resolve('outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com');
const RADIO_ROOT = path.join(ROOT, 'music_radio_sorted');
const MOVIE_ROOT = path.join(ROOT, 'hello_movie_sorted');
const PEDIA_ROOT = path.join(ROOT, 'hello_pedia');
const OUT = path.join(PEDIA_ROOT, 'media.html');

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function relFromPedia(file) {
  return path.relative(PEDIA_ROOT, file).replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
}

function stripExt(name) {
  return name.replace(/\.[^.]+$/, '');
}

function parseDate(text) {
  const iso = text.match(/(20\d{2})[-_.年](\d{1,2})[-_.月](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const jp = text.match(/【(\d{1,2})月(\d{1,2})日配信】/);
  if (jp) return `${jp[1].padStart(2, '0')}/${jp[2].padStart(2, '0')}`;
  return '';
}

function parseRadioName(file) {
  const base = stripExt(path.basename(file));
  const folder = path.basename(path.dirname(file));
  const noPrefix = base.replace(/^\d+\s*-\s*/, '');
  const parts = noPrefix.split(' - ');
  const program = parts[0] || folder;
  const episode = parts.slice(1).join(' - ') || noPrefix;
  const date = parseDate(base);
  const mid = (base.match(/\[(mid\d+)\]/i) || [])[1] || '';
  return { program, title: episode, date, mid };
}

function parseMovieName(file) {
  const rel = path.relative(MOVIE_ROOT, file).split(path.sep);
  const base = stripExt(path.basename(file));
  const top = rel[0] || '動画';
  const isMousouMember = rel[0] === '妄想動画' && rel[1] === '妄想動画' && rel.length >= 4;
  const category = isMousouMember ? '妄想動画（メンバー別）' : top;
  const member = isMousouMember ? rel[2] : '';
  const clean = base
    .replace(/\s*\[(?:content|mid)\d+\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const date = parseDate(base);
  return { category, member, title: clean, date };
}

function fileSize(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function sortKey(item) {
  return [
    item.group || '',
    item.date && /^\d{4}-/.test(item.date) ? item.date : '',
    item.name || '',
    item.title || '',
  ].join('\u0000');
}

const radioItems = walk(RADIO_ROOT)
  .filter(file => path.extname(file).toLowerCase() === '.mp4')
  .map(file => {
    const stat = fs.statSync(file);
    const parsed = parseRadioName(file);
    return {
      type: 'radio',
      group: parsed.program,
      subgroup: '',
      title: parsed.title,
      name: path.basename(file),
      date: parsed.date,
      size: fileSize(stat.size),
      bytes: stat.size,
      href: relFromPedia(file),
      search: `${parsed.program} ${parsed.title} ${path.basename(file)} ${parsed.mid}`,
    };
  })
  .sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'ja'));

const movieItems = walk(MOVIE_ROOT)
  .filter(file => path.extname(file).toLowerCase() === '.mp4')
  .filter(file => !path.relative(MOVIE_ROOT, file).split(path.sep).some(part => part.startsWith('_')))
  .map(file => {
    const stat = fs.statSync(file);
    const parsed = parseMovieName(file);
    return {
      type: parsed.category.startsWith('妄想動画') ? 'mousou' : 'movie',
      group: parsed.category,
      subgroup: parsed.member,
      title: parsed.title,
      name: path.basename(file),
      date: parsed.date,
      size: fileSize(stat.size),
      bytes: stat.size,
      href: relFromPedia(file),
      search: `${parsed.category} ${parsed.member} ${parsed.title} ${path.basename(file)}`,
    };
  })
  .sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'ja'));

const items = [...radioItems, ...movieItems];
const totalBytes = items.reduce((sum, item) => sum + item.bytes, 0);
const groups = new Map();
for (const item of items) {
  const key = `${item.type}::${item.group}${item.subgroup ? `::${item.subgroup}` : ''}`;
  if (!groups.has(key)) groups.set(key, { key, type: item.type, group: item.group, subgroup: item.subgroup, count: 0, bytes: 0 });
  const g = groups.get(key);
  g.count += 1;
  g.bytes += item.bytes;
}

const data = {
  generatedAt: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
  totals: {
    count: items.length,
    radio: radioItems.length,
    movie: movieItems.filter(item => item.type === 'movie').length,
    mousou: movieItems.filter(item => item.type === 'mousou').length,
    size: fileSize(totalBytes),
  },
  groups: [...groups.values()].sort((a, b) => {
    const typeOrder = { radio: 0, movie: 1, mousou: 2 };
    return (typeOrder[a.type] - typeOrder[b.type]) || a.group.localeCompare(b.group, 'ja') || a.subgroup.localeCompare(b.subgroup, 'ja');
  }),
  items,
};

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ハロモバ メディア保存庫</title>
<style>
:root{color-scheme:light;--ink:#162033;--sub:#637083;--line:#dbe3ee;--soft:#f4f7fb;--panel:#fff;--accent:#0b7fab;--radio:#0b7fab;--movie:#c43d4d;--mousou:#7b4ab8}
*{box-sizing:border-box}body{margin:0;background:var(--soft);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Sans","Yu Gothic",Meiryo,sans-serif;line-height:1.65;letter-spacing:0}
a{color:inherit}.hero{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.98);border-bottom:1px solid var(--line)}.hero-inner{max-width:1380px;margin:auto;padding:12px 18px 10px}
h1{font-size:24px;line-height:1.25;margin:0 0 7px}.meta{display:flex;gap:8px;flex-wrap:wrap;color:var(--sub);font-size:13px}.pill,.archive-link{border:1px solid var(--line);border-radius:999px;background:#fff;padding:2px 9px;text-decoration:none}.archive-link{color:#174154;font-weight:700}
main{max-width:1380px;margin:0 auto;padding:14px 18px 34px;display:grid;grid-template-columns:330px minmax(0,1fr);gap:16px}
aside{position:sticky;top:86px;align-self:start;max-height:calc(100vh - 104px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px}.controls{display:grid;gap:8px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--line)}
input[type=search]{width:100%;font-size:15px;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:#fff}.tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.tab,.group-button,.clear{border:1px solid var(--line);background:#fff;border-radius:8px;color:var(--ink);font-size:13px}.tab{min-height:34px}.tab.active,.group-button.active{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent),transparent 78%);background:color-mix(in srgb,var(--accent),#fff 92%)}.clear{padding:7px 10px}
.group-button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;width:100%;min-height:40px;margin-bottom:7px;padding:7px 8px;text-align:left}.group-button strong{font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.group-button b,.group-button span{color:var(--sub);font-size:12px}.group-button span{grid-column:1/-1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}.stat{background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px}.stat strong{display:block;font-size:22px;line-height:1.15}.stat span{color:var(--sub);font-size:12px}
.list{display:grid;gap:10px}.item{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:11px 12px;content-visibility:auto;contain-intrinsic-size:130px}.item-header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start}.badge{display:inline-block;border-radius:999px;padding:1px 8px;font-size:12px;color:#fff;background:var(--accent);margin-right:5px}.badge.radio{background:var(--radio)}.badge.movie{background:var(--movie)}.badge.mousou{background:var(--mousou)}h2{font-size:16px;line-height:1.45;margin:3px 0 4px}.detail{color:var(--sub);font-size:12px}.play{border:1px solid var(--accent);background:#fff;color:var(--accent);border-radius:8px;padding:7px 10px;font-weight:700;white-space:nowrap}.player{display:none;margin-top:10px}.player.open{display:block}audio,video{width:100%;max-height:58vh;background:#000;border-radius:8px}.empty{background:#fff;border:1px solid var(--line);border-radius:8px;padding:18px;color:var(--sub)}
@media(max-width:900px){body{background:#fff}.hero{position:static}.hero-inner{padding:12px}h1{font-size:21px}.meta{font-size:12px;gap:5px}main{display:block;padding:0;background:#fff}aside{position:static;max-height:none;margin:0;border-width:0 0 1px;border-radius:0;padding:10px 12px;background:#f8fafc}.summary{grid-template-columns:repeat(2,minmax(0,1fr));padding:12px 12px 0;margin:0}.list{gap:0}.item{border-left:0;border-right:0;border-radius:0;margin:0;content-visibility:visible;contain-intrinsic-size:auto}.item-header{grid-template-columns:1fr}.play{justify-self:start}.tabs{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<header class="hero"><div class="hero-inner">
  <h1>ハロモバ メディア保存庫</h1>
  <div class="meta">
    <span class="pill">合計 ${data.totals.count}件</span>
    <span class="pill">ラジオ ${data.totals.radio}件</span>
    <span class="pill">動画 ${data.totals.movie}件</span>
    <span class="pill">妄想動画 ${data.totals.mousou}件</span>
    <span class="pill">${htmlEscape(data.totals.size)}</span>
    <span class="pill">ローカル保存ファイル用</span>
    <span class="pill">生成 ${htmlEscape(data.generatedAt)}</span>
    <a class="archive-link" href="index.html">ハローペディア</a>
    <a class="archive-link" href="../hello_qa/index.html">ハロー！Q&A</a>
  </div>
</div></header>
<main>
<aside>
  <div class="controls">
    <input id="search" type="search" placeholder="番組名、タイトル、メンバー名で検索">
    <div class="tabs">
      <button class="tab active" data-type="all">すべて</button>
      <button class="tab" data-type="radio">ラジオ</button>
      <button class="tab" data-type="movie">動画</button>
      <button class="tab" data-type="mousou">妄想動画</button>
    </div>
    <button class="clear" id="clear">クリア</button>
  </div>
  <div id="groups"></div>
</aside>
<section>
  <div class="summary">
    <div class="stat"><strong>${data.totals.count}</strong><span>全メディア</span></div>
    <div class="stat"><strong>${data.totals.radio}</strong><span>ハローラジオ</span></div>
    <div class="stat"><strong>${data.totals.movie}</strong><span>ハロームービー</span></div>
    <div class="stat"><strong>${data.totals.mousou}</strong><span>妄想動画</span></div>
  </div>
  <div id="result" class="detail" style="margin:0 0 10px"></div>
  <div id="list" class="list"></div>
</section>
</main>
<script id="archive-data" type="application/json">${scriptJson(data)}</script>
<script>
const data = JSON.parse(document.getElementById('archive-data').textContent);
const state = { type: 'all', group: 'all', query: '' };
const groupsEl = document.getElementById('groups');
const listEl = document.getElementById('list');
const resultEl = document.getElementById('result');
const searchEl = document.getElementById('search');
function labelType(type){ return type === 'radio' ? 'ラジオ' : type === 'mousou' ? '妄想動画' : '動画'; }
function groupKey(item){ return item.type + '::' + item.group + (item.subgroup ? '::' + item.subgroup : ''); }
function renderGroups(){
  const groups = data.groups.filter(g => state.type === 'all' || g.type === state.type);
  groupsEl.innerHTML = '<button class="group-button ' + (state.group === 'all' ? 'active' : '') + '" data-group="all"><strong>すべて</strong><b>' + data.items.filter(i => state.type === 'all' || i.type === state.type).length + '</b><span>選択中の種類をすべて表示</span></button>' +
    groups.map(g => '<button class="group-button ' + (state.group === g.key ? 'active' : '') + '" data-group="' + escapeHtml(g.key) + '"><strong>' + escapeHtml(g.subgroup || g.group) + '</strong><b>' + g.count + '</b><span>' + escapeHtml(labelType(g.type) + (g.subgroup ? ' / ' + g.group : '') + ' / ' + formatBytes(g.bytes)) + '</span></button>').join('');
}
function filtered(){
  const q = state.query.trim().toLowerCase();
  return data.items.filter(item => {
    if (state.type !== 'all' && item.type !== state.type) return false;
    if (state.group !== 'all' && groupKey(item) !== state.group) return false;
    if (q && !item.search.toLowerCase().includes(q)) return false;
    return true;
  });
}
function renderList(){
  const items = filtered();
  resultEl.textContent = items.length + '件を表示';
  if (!items.length) {
    listEl.innerHTML = '<div class="empty">該当するメディアがありません。</div>';
    return;
  }
  listEl.innerHTML = items.map((item, index) => {
    const isRadio = item.type === 'radio';
    const media = isRadio ? 'audio' : 'video';
    const group = item.subgroup ? item.group + ' / ' + item.subgroup : item.group;
    return '<article class="item" data-kind="' + item.type + '" data-src="' + escapeHtml(item.href) + '">' +
      '<div class="item-header"><div>' +
      '<span class="badge ' + item.type + '">' + escapeHtml(labelType(item.type)) + '</span>' +
      '<span class="detail">' + escapeHtml(group) + '</span>' +
      '<h2>' + escapeHtml(item.title) + '</h2>' +
      '<div class="detail">' + escapeHtml([item.date, item.size, item.name].filter(Boolean).join(' / ')) + '</div>' +
      '</div><button class="play" data-index="' + index + '">再生</button></div>' +
      '<div class="player"></div>' +
      '</article>';
  }).join('');
}
function render(){ renderGroups(); renderList(); }
function escapeHtml(value){ return String(value).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
function formatBytes(bytes){ if(bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB'; if(bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB'; return Math.round(bytes / 1024) + ' KB'; }
document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  button.classList.add('active');
  state.type = button.dataset.type;
  state.group = 'all';
  render();
}));
groupsEl.addEventListener('click', event => {
  const button = event.target.closest('.group-button');
  if (!button) return;
  state.group = button.dataset.group;
  render();
});
searchEl.addEventListener('input', () => {
  state.query = searchEl.value;
  renderList();
});
document.getElementById('clear').addEventListener('click', () => {
  searchEl.value = '';
  state.query = '';
  state.group = 'all';
  state.type = 'all';
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.type === 'all'));
  render();
});
listEl.addEventListener('click', event => {
  const button = event.target.closest('.play');
  if (!button) return;
  const item = button.closest('.item');
  const player = item.querySelector('.player');
  const open = player.classList.toggle('open');
  button.textContent = open ? '閉じる' : '再生';
  if (open && !player.firstElementChild) {
    const tag = item.dataset.kind === 'radio' ? 'audio' : 'video';
    const media = document.createElement(tag);
    media.controls = true;
    media.preload = 'none';
    media.src = item.dataset.src;
    player.appendChild(media);
  } else if (!open) {
    const media = player.querySelector('audio,video');
    if (media) media.pause();
  }
});
render();
</script>
</body>
</html>
`;

fs.mkdirSync(PEDIA_ROOT, { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log(JSON.stringify({
  output: OUT,
  items: data.totals.count,
  radio: data.totals.radio,
  movie: data.totals.movie,
  mousou: data.totals.mousou,
  groups: data.groups.length,
}, null, 2));
