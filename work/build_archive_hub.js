const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com');
const birthdayRoot = path.join(root, 'birthday_cards');
const birthdayYears = fs.readdirSync(birthdayRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))
  .map(entry => entry.name).sort();
const birthdaySections = birthdayYears.map(year => {
  const images = fs.readdirSync(path.join(birthdayRoot, year), { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(?:jpe?g|png|webp)$/i.test(entry.name))
    .map(entry => entry.name).sort();
  const tiles = images.map(file => {
    const label = file.replace(/\.[^.]+$/, '').replace(/^\d{4}-\d{2}-\d{2}_/, '').replace(/[_-]+/g, ' ');
    const src = `${year}/${encodeURIComponent(file)}`;
    return `<figure><a href="${src}" target="_blank" rel="noreferrer"><img loading="lazy" src="${src}" alt="${label}"></a><figcaption>${label}</figcaption></figure>`;
  }).join('');
  return `<details><summary>${year} <small>${images.length}枚</small></summary><div class="gallery">${tiles}</div></details>`;
}).join('\n');
fs.writeFileSync(path.join(birthdayRoot, 'index.html'), `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>バースデーカードアーカイブ</title><style>body{font:15px/1.5 system-ui,"Yu Gothic UI",sans-serif;background:#f3f6f8;color:#172638;margin:0}main{max-width:1100px;margin:auto;padding:20px}h1{font-size:22px}details{background:white;border:1px solid #d5e0e7;border-radius:5px;margin:8px 0;padding:12px}summary{cursor:pointer;font-weight:700}small{color:#586978;margin-left:8px}.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:12px;margin-top:14px}figure{margin:0}img{width:100%;height:190px;object-fit:contain;background:#eef2f4}figcaption{font-size:13px;overflow-wrap:anywhere}a{color:inherit}</style><main><h1>バースデーカード</h1>${birthdaySections}</main></html>`, 'utf8');
const groups = [
  ['Q&A', 'hello_qa/index.html', '質問・回答の全グループ別アーカイブ'],
  ['ハローペディア', 'hello_pedia/index.html', 'プロフィール・用語・関連リンク'],
  ['ツアー日記', 'tour_diary/index.html', '写真付き日記 557件'],
  ['特設・季節イベント', 'special_events/index.html', '季節特集、作品特設、メンバー企画'],
  ['追加コンテンツ', 'extra_content/index.html', '日記・連載など9カテゴリ、計2,726件'],
  ['妄想動画', 'hello_pedia/media.html', 'メンバー別の動画アーカイブと再生ページ'],
  ['ハローラジオ', 'radio/index.html', 'ラジオ番組アーカイブ'],
  ['ハロモバメール', 'mail/index.html', '保存済みメールと画像'],
  ['バースデーカード', 'birthday_cards/index.html', '保存済み誕生日カード'],
];

const cards = groups.map(([label, href, note]) => {
  const exists = fs.existsSync(path.join(root, href));
  return `<a class="item${exists ? '' : ' missing'}" href="${href}"><strong>${label}</strong><span>${exists ? note : '準備中・既存索引なし'}</span></a>`;
}).join('\n');

const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ハロモバ保存アーカイブ</title>
<style>
:root{color-scheme:light;--ink:#172638;--muted:#586978;--line:#d5e0e7;--teal:#087f87;--pink:#c13c67}*{box-sizing:border-box}body{margin:0;background:#f3f6f8;color:var(--ink);font:16px/1.55 system-ui,"Yu Gothic UI",sans-serif}.top{background:#fff;border-bottom:1px solid var(--line)}header,main{max-width:980px;margin:auto;padding:22px}h1{font-size:25px;margin:0}header p{color:var(--muted);margin:6px 0 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:10px}.item{display:flex;flex-direction:column;gap:4px;padding:15px 16px;background:#fff;border:1px solid var(--line);border-left:4px solid var(--teal);border-radius:5px;color:inherit;text-decoration:none}.item:hover,.item:focus-visible{border-color:var(--teal);background:#f8ffff}.item strong{font-size:17px}.item span{font-size:14px;color:var(--muted)}.missing{border-left-color:#aab4bc;opacity:.7}h2{font-size:18px;margin:26px 0 10px}footer{color:var(--muted);font-size:13px;padding:16px 0}@media(max-width:520px){header,main{padding:16px}h1{font-size:22px}}
</style></head><body><div class="top"><header><h1>ハロモバ保存アーカイブ</h1><p>ローカル保存済みコンテンツへの入口</p></header></div><main><h2>コンテンツ</h2><nav class="grid">${cards}</nav><footer>ページや画像は各アーカイブ内に保存されています。ログイン必須・期限切れ・API非公開の内容は含まれない場合があります。</footer></main></body></html>`;

fs.writeFileSync(path.join(root, 'archive.html'), html, 'utf8');
console.log(path.join(root, 'archive.html'));
