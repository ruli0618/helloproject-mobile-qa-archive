const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[ch]);
const count = (file, pattern) => read(file).match(pattern)?.[1] || '';
const names2026 = {
  ise:'伊勢鈴蘭', onoda:'小野田華凜', ebata:'江端妃咲', makino:'牧野真莉愛', soma:'相馬優芽',
  tamenaga:'為永幸音', murakoshi:'村越彩菜', ishiyama:'石山咲良', uemura:'植村葉純', matsubara:'松原ユリヤ',
  murata:'村田結生', oda:'小田さくら', takase:'高瀬くるみ', doi:'土居楓奏', nishizaki:'西﨑美空',
  shimakawa:'島川波菜', endo:'遠藤彩加里', yonemura:'米村姫良々', danbara:'段原瑠々', nagano:'長野桃羽',
  goto:'後藤花', nishida:'西田汐里', hayashi:'林仁愛', kamimura:'上村麗菜', hiromoto:'広本瑠璃',
  maeda:'前田こころ', yamazaki:'山﨑愛生', matsunaga:'松永里愛', yoshida:'吉田姫杷', yumigeta:'弓桁朱琴',
  nakayama:'中山夏月姫', kubota:'窪田七海', hirayama:'平山遊季', akiyama:'秋山眞緒', kasai:'河西結心',
  eguchi:'江口紗耶', shimoitani:'下井谷幸穂', tsutsui:'筒井澪心', kobayashi:'小林萌花', kitahara:'北原もも',
  matsumoto:'松本わかな', ishikawa:'石川華望', satoyoshi:'里吉うたの', kudo:'工藤由愛', ono:'小野瑞歩',
};
const historicalNames = {
  aikawa:'相川茉穂', arisawa:'有澤一華', asakura:'浅倉樹々', dambara:'段原瑠々', danbara:'段原瑠々',
  doi:'土居楓奏', doi2:'土居楓奏',
  fujii:'藤井梨央', fukuda:'福田真琳', fukumura:'譜久村聖', funaki:'船木結', haga:'羽賀朱音', hagiwara:'萩原舞', hamaura:'浜浦彩乃',
  hashida:'橋田歩果', hashisako:'橋迫鈴', hirai:'平井美葉', hirose:'広瀬彩海', ichioka:'一岡伶奈',
  iikubo:'飯窪春菜', ikuta:'生田衣梨奈', inaba:'稲場愛香', inoue:'井上玲音',
  irie:'入江里咲', ishida:'石田亜佑美', 'ishida_from-screenshot':'石田亜佑美',
  ishiguri:'石栗奏美', ishii:'石井泉羽', kaga:'加賀楓', kamiko:'上國料萌衣',
  kamikokuryo:'上國料萌衣', kanazawa:'金澤朋子', kasahara:'笠原桃奈', katsuta:'勝田里奈',
  kawamura:'川村文乃', kawana:'川名凜', kawashima:'川嶋美楓', kishimoto:'岸本ゆめの',
  kitagawa:'北川莉央', kiyono:'清野桃々姫', miyamoto:'宮本佳林', miyazaki:'宮崎由加',
  morito:'森戸知沙希', murota:'室田瑞希', nakanishi:'中西香菜', nakajima:'中島早貴', niinuma:'新沼希空',
  nishimura:'西村乙輝', nomura:'野村みな美', nonaka:'野中美希', ogata:'小片リサ',
  oota:'太田遥香', ogawa:'小川麗奈', ozeki:'小関舞',
  saito:'斉藤円香', sakurai:'櫻井梨央', sasaki:'佐々木莉佳子', sato:'佐藤優樹', sayashi:'鞘師里保',
  shimakura:'島倉りか', takagi:'高木紗友希', taguchi:'田口夏実', takeuchi:'竹内朱莉', tanimoto:'谷本安美', tsugunaga:'嗣永桃子',
  tashiro:'田代すみれ', uemura:'植村葉純', yagi:'八木栞',
  yamagishi:'山岸理子', yamaki:'山木梨沙', yamazaki:'山﨑愛生', yanagawa:'梁川奈々美', yofu:'豫風瑠乃', yohu:'豫風瑠乃',
  yajima:'矢島舞美', yokoyama:'横山玲奈', yonemura:'米村姫良々',
};
const namesByBirthday = {
  '0107_ishida_from-screenshot':'石田亜佑美',
  '0123_onoda':'小野田華凜', '1217_onoda':'小野田紗栞',
  '0225_uemura':'植村葉純', '1230_uemura':'植村あかり',
  '0506_inoue':'井上春華', '0717_inoue':'井上玲音',
  '0509_okamura':'岡村ほまれ', '1020_okamura':'岡村美波',
  '0628_yamazaki':'山﨑愛生', '1105_yamazaki':'山﨑夢羽',
  '0308_wada':'和田桜子', '0801_wada':'和田彩花',
  '0412_suzuki':'鈴木愛理', '1027_kudo':'工藤遥',
  '0215_ogata':'尾形春水', '1105_ogata':'小片リサ',
};
function birthdayLabel(year, file) {
  const match = file.match(/^\d{4}-(\d{2})-(\d{2})_(.+)\.(?:jpe?g|png|webp)$/i);
  if (!match) throw new Error(`Unknown birthday card filename: ${file}`);
  const [, month, day, slug] = match;
  const label = namesByBirthday[`${month}${day}_${slug}`] || names2026[slug] || historicalNames[slug];
  if (!label) throw new Error(`Unknown birthday card member: ${file}`);
  return label;
}
const years = fs.readdirSync(path.join(root, 'birthday_cards'), { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))
  .map(entry => entry.name).sort().reverse();
const birthdayImages = years.flatMap(year => fs.readdirSync(path.join(root, 'birthday_cards', year))
  .filter(file => /^\d{4}-\d{2}-\d{2}_.+\.(?:jpe?g|png|webp)$/i.test(file))
  .sort().reverse()
  .map(file => ({ year, file, date: file.slice(0, 10), label: birthdayLabel(year, file) })));
const extraReport = JSON.parse(read('extra_content/_backup_report.json'));
const extraCount = extraReport.results.reduce((sum, row) => sum + (row.entries || 0), 0);
const mailCount = JSON.parse(read('mail/_mail_manifest.json')).length;
const birthdayImage = `birthday_cards/${birthdayImages[0].year}/${encodeURIComponent(birthdayImages[0].file)}`;

const categories = [
  { title:'ハロー！Q&A', type:'read', typeLabel:'読む', href:'hello_qa/index.html', count:`${count('hello_qa/index.html', /質問 (\d+)件/)} 質問`, desc:'グループとメンバーの回答を読む' },
  { title:'ハローペディア', type:'read', typeLabel:'読む', href:'hello_pedia/index.html', count:`${count('hello_pedia/index.html', /項目 (\d+)件/)} 項目`, desc:'プロフィール・用語・関連リンク' },
  { title:'ツアー日記', type:'read', typeLabel:'読む', href:'tour_diary/index.html', count:`${count('tour_diary/index.html', /日記 (\d+)件/)} 記事`, desc:'ツアー別に写真と本文をたどる' },
  { title:'日記・連載', type:'read', typeLabel:'読む', href:'extra_content/index.html', count:`${extraCount.toLocaleString('ja-JP')} 記事`, desc:'スタッフ日記とメンバー連載' },
  { title:'ハロモバメール', type:'read', typeLabel:'読む', href:'mail/index.html', count:`${mailCount.toLocaleString('ja-JP')} 通`, desc:'日付・メンバー別にメールを読む' },
  { title:'妄想動画', type:'watch', typeLabel:'観る', href:'hello_pedia/media.html', count:`${count('hello_pedia/media.html', /妄想動画 (\d+)件/)} 本`, desc:'メンバー別の動画アーカイブ' },
  { title:'特設・季節イベント', type:'watch', typeLabel:'観る', href:'special_events/index.html', count:`${count('special_events/index.html', /イベント (\d+)件/)} 特集`, desc:'季節のメッセージと特設ページ', thumb:'special_events/assets/images/special/countdown2026/top.jpg' },
  { title:'バースデーカード', type:'watch', typeLabel:'観る', href:'birthday_cards/index.html', count:`${birthdayImages.length} 枚`, desc:'年ごとに保存した誕生日カード', thumb:birthdayImage },
  { title:'ハローラジオ', type:'listen', typeLabel:'聴く', href:'radio/index.html', count:`${count('radio/index.html', /回 (\d+)\/\d+件/)} 回`, desc:'番組・回を選んで続けて聴く' },
];

const homeCards = categories.map(item => `<a class="category-card" data-kind="${item.type}" data-search="${esc(`${item.title} ${item.desc}`)}" href="${esc(item.href)}"><div class="copy"><span class="kind">${item.typeLabel}</span><h2>${esc(item.title)}</h2><p class="count">${esc(item.count)}</p><p class="desc">${esc(item.desc)}</p></div>${item.thumb ? `<img class="thumb" loading="lazy" src="${esc(item.thumb)}" alt="">` : ''}<span class="arrow" aria-hidden="true">→</span></a>`).join('\n');
const home = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ハロモバ保存アーカイブ</title><link rel="stylesheet" href="archive-ui.css"></head><body>
<header class="site-head"><div class="site-head-inner"><div class="brandline"><div class="site-mark">H!M</div><div><p class="eyebrow">HELLO! PROJECT MOBILE</p><h1>ハロモバ保存アーカイブ</h1></div></div><p class="head-meta">2026年9月までの保存コンテンツ</p></div></header>
<main class="container"><div class="bar"><input id="archiveSearch" type="search" placeholder="アーカイブ名から探す" aria-label="アーカイブ名から探す"><div class="segment" role="group" aria-label="種類"><button type="button" data-type="all" aria-pressed="true">すべて</button><button type="button" data-type="read" aria-pressed="false">読む</button><button type="button" data-type="watch" aria-pressed="false">観る</button><button type="button" data-type="listen" aria-pressed="false">聴く</button></div></div>
<div class="category-grid" id="categoryGrid">${homeCards}</div><p id="homeEmpty" class="empty-state" hidden>該当するアーカイブはありません。</p><p class="section-note">非公式の保存アーカイブです。元サイトで取得できなかった一部の内容は含まれません。</p></main>
<script>const q=document.querySelector('#archiveSearch'),buttons=[...document.querySelectorAll('[data-type]')],cards=[...document.querySelectorAll('.category-card')];let type='all';function apply(){let shown=0;for(const card of cards){const visible=(type==='all'||card.dataset.kind===type)&&card.dataset.search.toLowerCase().includes(q.value.trim().toLowerCase());card.hidden=!visible;if(visible)shown++}document.querySelector('#homeEmpty').hidden=shown>0}q.addEventListener('input',apply);buttons.forEach(button=>button.addEventListener('click',()=>{type=button.dataset.type;buttons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));apply()}));</script></body></html>`;
fs.writeFileSync(path.join(root, 'archive.html'), home, 'utf8');
fs.writeFileSync(path.resolve(root, '..', '..', '..', 'index.html'),
  home.replace('<head>', '<head><base href="outputs/helloproject-mobile-archive/helloproject-mobile.com/">'), 'utf8');

const birthdaySections = years.map(year => {
  const images = birthdayImages.filter(item => item.year === year);
  const tiles = images.map(item => {
    const src = `${year}/${encodeURIComponent(item.file)}`;
    return `<a class="birthday-item" href="${src}" data-label="${esc(`${item.date} ${item.label}`)}" data-search="${esc(`${item.date} ${item.label}`)}"><img loading="lazy" src="${src}" alt="${esc(item.label)}"><span>${esc(item.date)} · ${esc(item.label)}</span></a>`;
  }).join('');
  return `<section class="gallery-year" data-year="${year}"><h2>${year}<small>${images.length}枚</small></h2><div class="birthday-grid">${tiles}</div></section>`;
}).join('\n');
const yearOptions = [`<option value="">全年</option>`, ...years.map(year => `<option value="${year}"${year === years[0] ? ' selected' : ''}>${year}年</option>`)].join('');
const birthday = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>バースデーカード | ハロモバ保存アーカイブ</title><link rel="stylesheet" href="../archive-ui.css"></head><body>
<header class="site-head"><div class="site-head-inner index-head"><div><p class="eyebrow">PHOTO ARCHIVE</p><h1>バースデーカード</h1><p class="head-meta">${birthdayImages.length}枚 · ${years.at(-1)}年–${years[0]}年</p></div><a href="../archive.html">一覧へ</a></div></header>
<main class="container"><div class="bar"><input id="birthdaySearch" type="search" placeholder="日付・名前で検索" aria-label="日付・名前で検索"><select id="birthdayYear" aria-label="年を選択">${yearOptions}</select><span id="birthdayCount" class="head-meta"></span></div><div id="birthdayGallery">${birthdaySections}</div><p id="birthdayEmpty" class="empty-state" hidden>該当するカードはありません。</p></main>
<dialog class="viewer" id="viewer"><img id="viewerImage" alt=""><div class="viewer-controls"><strong id="viewerTitle"></strong><button id="viewerClose" type="button" aria-label="閉じる" title="閉じる">×</button></div></dialog>
<script>const search=document.querySelector('#birthdaySearch'),year=document.querySelector('#birthdayYear'),sections=[...document.querySelectorAll('.gallery-year')],viewer=document.querySelector('#viewer');function apply(){let total=0;const term=search.value.trim().toLowerCase();for(const section of sections){let visible=0;for(const tile of section.querySelectorAll('.birthday-item')){const show=(!year.value||section.dataset.year===year.value)&&tile.dataset.search.toLowerCase().includes(term);tile.hidden=!show;if(show)visible++}section.hidden=!visible;total+=visible}document.querySelector('#birthdayCount').textContent=total+'枚';document.querySelector('#birthdayEmpty').hidden=total>0}search.addEventListener('input',apply);year.addEventListener('change',apply);apply();document.querySelector('#birthdayGallery').addEventListener('click',event=>{const link=event.target.closest('.birthday-item');if(!link)return;event.preventDefault();document.querySelector('#viewerImage').src=link.href;document.querySelector('#viewerTitle').textContent=link.dataset.label;viewer.showModal()});document.querySelector('#viewerClose').addEventListener('click',()=>viewer.close());viewer.addEventListener('click',event=>{if(event.target===viewer)viewer.close()});</script></body></html>`;
fs.writeFileSync(path.join(root, 'birthday_cards', 'index.html'), birthday, 'utf8');

const extraCategories = extraReport.results.filter(row => row.dir && row.entries).map(row => {
  const dir = path.basename(row.dir);
  const archive = JSON.parse(read(`extra_content/${dir}/_archive.json`));
  const ordered = archive.entries.slice().sort((a, b) => String(b.release_date).localeCompare(String(a.release_date)));
  return { row, dir, latest: ordered[0], image: ordered.find(entry => entry.saved_materials?.length)?.saved_materials?.[0] };
}).sort((a, b) => String(b.latest?.release_date).localeCompare(String(a.latest?.release_date)));
const extraRows = extraCategories.map(({ row, dir, latest, image }) => {
  return `<a class="archive-row" href="${encodeURIComponent(dir)}/index.html" data-search="${esc(row.label)}">${image ? `<img loading="lazy" src="${encodeURIComponent(dir)}/${image.split('/').map(encodeURIComponent).join('/')}" alt="">` : '<span class="empty-thumb"></span>'}<div><h2>${esc(row.label)}</h2><p>最終掲載 ${esc((latest?.release_date || '').slice(0, 10))}</p></div><span class="row-count">${row.entries}件 →</span></a>`;
}).join('\n');
const extra = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>日記・連載 | ハロモバ保存アーカイブ</title><link rel="stylesheet" href="../archive-ui.css"></head><body>
<header class="site-head"><div class="site-head-inner index-head"><div><p class="eyebrow">DIARY & SERIALS</p><h1>日記・連載</h1><p class="head-meta">${extraReport.results.length}カテゴリ · ${extraCount.toLocaleString('ja-JP')}記事</p></div><a href="../archive.html">一覧へ</a></div></header>
<main class="container"><div class="bar"><input id="extraSearch" type="search" placeholder="連載名で検索" aria-label="連載名で検索"></div><div class="archive-list" id="extraList">${extraRows}</div><p id="extraEmpty" class="empty-state" hidden>該当する連載はありません。</p></main>
<script>const q=document.querySelector('#extraSearch'),rows=[...document.querySelectorAll('.archive-row')];q.addEventListener('input',()=>{let shown=0;for(const row of rows){row.hidden=!row.dataset.search.toLowerCase().includes(q.value.trim().toLowerCase());if(!row.hidden)shown++}document.querySelector('#extraEmpty').hidden=shown>0});</script></body></html>`;
fs.writeFileSync(path.join(root, 'extra_content', 'index.html'), extra, 'utf8');

const pages = [
  'hello_qa/index.html', 'hello_pedia/index.html', 'hello_pedia/media.html',
  'tour_diary/index.html', 'special_events/index.html', 'extra_content/index.html',
  'radio/index.html', 'mail/index.html', 'birthday_cards/index.html',
];
for (const row of extraReport.results) if (row.dir) pages.push(`extra_content/${path.basename(row.dir)}/index.html`);
for (const page of pages) {
  const file = path.join(root, page);
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('site-shell.js')) continue;
  const prefix = path.relative(path.dirname(file), root).replace(/\\/g, '/') || '.';
  html = html.replace(/<\/title>/i, `</title><link rel="stylesheet" href="${prefix}/site-shell.css"><script defer src="${prefix}/site-shell.js"></script>`);
  fs.writeFileSync(file, html, 'utf8');
}
console.log(`archive pages: ${categories.length} categories, ${birthdayImages.length} cards, ${pages.length} decorated pages`);
