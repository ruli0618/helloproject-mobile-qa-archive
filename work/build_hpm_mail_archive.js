const fs = require('fs');
const path = require('path');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const WORKSPACE = 'C:/Users/misuz/Documents/Codex/2026-07-31/http-helloproject-mobile-com';
const OUT_ROOT = path.join(WORKSPACE, 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'mail');
const ASSET_ROOT = path.join(OUT_ROOT, 'assets');
const SOURCE_JSON = path.join(WORKSPACE, 'work', 'hpm_gmail_messages.json');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/14E5239e Safari/602.1';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function cleanName(value, max = 120) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'unknown';
}

function normalizeDate(value, internalDate) {
  const date = value ? new Date(value) : new Date(Number(internalDate || 0));
  if (Number.isNaN(date.getTime())) return '日付不明';
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function findHtmlPart(payload) {
  if (!payload) return '';
  const stack = [payload];
  while (stack.length) {
    const part = stack.shift();
    if (part?.mime_type === 'text/html' && part.body?.content) return part.body.content;
    if (Array.isArray(part?.parts)) stack.push(...part.parts);
  }
  return '';
}

function findHeader(payload, name) {
  const header = payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

function toAbsoluteUrl(src) {
  try {
    return new URL(src, 'http://helloproject-mobile.com/').toString();
  } catch {
    return '';
  }
}

async function fetchBuffer(url, referer = 'http://helloproject-mobile.com/') {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function localizeImages(html, messageStem) {
  fs.mkdirSync(ASSET_ROOT, { recursive: true });
  let imageIndex = 0;
  const replacements = [];
  for (const match of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const src = match[1];
    if (/^(?:data:|cid:|assets\/|\.\/assets\/|\.\.\/)/i.test(src) || !/^(?:https?:)?\/\//i.test(src)) continue;
    const url = toAbsoluteUrl(src);
    if (!url || !/^https?:/i.test(url)) continue;
    const ext = path.extname(new URL(url).pathname).split('?')[0] || '.img';
    const fileName = `${messageStem}_${String(++imageIndex).padStart(2, '0')}${ext}`;
    const filePath = path.join(ASSET_ROOT, fileName);
    try {
      if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) fs.writeFileSync(filePath, await fetchBuffer(url));
      replacements.push([src, `assets/${fileName}`]);
    } catch (error) {
      console.warn(`image skip ${url}: ${error.message}`);
    }
  }
  for (const [from, to] of replacements) html = html.split(from).join(to);
  return html;
}

async function convertSpmessageLinks(html, messageStem) {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']*spmessage\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (let i = 0; i < links.length; i += 1) {
    const [full, href, label] = links[i];
    const pageUrl = href.startsWith('http') ? href : `http://helloproject-mobile.com/info/special/content?page=${href}`;
    const url = pageUrl.endsWith('.html') ? pageUrl : `${pageUrl}.html`;
    try {
      const page = (await fetchBuffer(url, 'http://helloproject-mobile.com/')).toString('utf8');
      const img = [...page.matchAll(/<img\b[^>]*>/gi)]
        .map((m) => m[0])
        .find((tag) => /\bclass=["'][^"']*\bfull\b/i.test(tag));
      const src = img?.match(/\bsrc=["']([^"']+)["']/i)?.[1];
      const alt = img?.match(/\balt=["']([^"']*)["']/i)?.[1] || label.replace(/<[^>]+>/g, '').trim() || 'フォト';
      if (!src) continue;
      const imageUrl = toAbsoluteUrl(src);
      const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
      const fileName = `${messageStem}_photo_${String(i + 1).padStart(2, '0')}${ext}`;
      const filePath = path.join(ASSET_ROOT, fileName);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) fs.writeFileSync(filePath, await fetchBuffer(imageUrl, url));
      html = html.replace(full, `<figure class="mail-photo"><img src="assets/${fileName}" alt="${escapeHtml(alt)}"><figcaption>${escapeHtml(alt)}</figcaption></figure>`);
    } catch (error) {
      console.warn(`spmessage skip ${url}: ${error.message}`);
    }
  }
  return html;
}

function stripMailFooter(html) {
  return html
    .replace(/<linkclump-plus[\s\S]*?<\/linkclump-plus>/gi, '')
    .replace(/<div>\s*-{10,}[\s\S]*?メール解除設定[\s\S]*?<\/div>\s*<div>\s*-{10,}\s*<\/div>/i, '')
    .replace(/<a\b[^>]*helloproject-mobile\.com\/mail\/magazine[^>]*>[\s\S]*?<\/a>/gi, '');
}

function isOperationalNotice(subject, html) {
  const title = String(subject || '').replace(/\s+/g, '');
  const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, '');
  if (/^(?:【)?(?:お詫び|詫び|訂正|再送|誤送信|誤配信|誤掲載|不備|不具合)/i.test(title)) return true;
  if (/(?:お詫び|深くお詫び|訂正|誤送信|誤配信|誤って|不備|不具合)/.test(title) && !/^From☆/.test(title)) return true;
  if (/ユーザーの皆様には深くお詫び申し上げます/.test(text)) return true;
  if (/本来.*(?:予定|表示).*誤って/.test(text)) return true;
  return false;
}

function shouldSkipMessage(subject, html) {
  const title = String(subject || '').replace(/\s+/g, '');
  const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, '');
  const inquiryNotice = new RegExp('(?:\\u304a\\u554f\\u3044\\u5408\\u308f\\u305b|\\u554f\\u3044\\u5408\\u308f\\u305b|\\u554f\\u5408\\u305b)');
  if (inquiryNotice.test(title) && !/^From/.test(title)) return true;
  return isOperationalNotice(subject, html);
}

function renderPage(count) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ハロモバ メールアーカイブ</title>
<style>
:root{--ink:#162033;--sub:#637083;--line:#dbe3ee;--soft:#f4f7fb;--panel:#fff;--accent:#0b7fab;--accent-soft:#e8f4f8}
*{box-sizing:border-box}body{margin:0;background:var(--soft);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Sans","Yu Gothic",Meiryo,sans-serif;line-height:1.75}
.top{position:sticky;top:0;z-index:3;background:rgba(255,255,255,.97);border-bottom:1px solid var(--line)}.top-inner{max-width:1120px;margin:auto;padding:13px 16px}h1{margin:0 0 8px;font-size:24px;line-height:1.3}.meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.pill,.link{border:1px solid var(--line);border-radius:999px;background:#fff;padding:3px 10px;color:var(--sub);font-size:13px;text-decoration:none}.link{color:#174154;font-weight:700}
main{max-width:1120px;margin:0 auto;padding:16px;display:grid;grid-template-columns:280px minmax(0,1fr);gap:16px}.side{position:sticky;top:86px;align-self:start;background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px;max-height:calc(100vh - 104px);overflow:auto}.control{display:grid;gap:6px;margin:0 0 11px}.control label{font-size:12px;color:var(--sub);font-weight:700}.side input,.side select{width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 10px;font-size:15px;background:#fff}.side button{border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 10px;color:var(--ink);font-size:13px}.quick{display:flex;gap:6px;flex-wrap:wrap}.quick button.active{border-color:var(--accent);background:var(--accent-soft);font-weight:700}.summary{margin:10px 0 0;color:var(--sub);font-size:13px}
.mail-list{display:grid;gap:12px}.mail-card{background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;content-visibility:auto;contain-intrinsic-size:420px}.mail-card header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line);background:#fbfcfe}.mail-card time{display:block;color:var(--sub);font-size:12px}.mail-card h2{margin:2px 0 0;font-size:18px;line-height:1.4}.member{align-self:start;color:var(--accent);font-size:13px;font-weight:800;white-space:nowrap}.body{padding:14px;font-size:15px}.body img.userfile{max-height:1.4em;width:auto;vertical-align:-.25em}.mail-photo{margin:12px 0;padding:10px;border:1px solid var(--line);border-radius:8px;background:#f8fafc}.mail-photo img{display:block;max-width:min(100%,560px);max-height:720px;margin:auto;border-radius:6px}.mail-photo figcaption{margin-top:7px;text-align:center;color:var(--sub);font-size:13px}.empty{padding:28px;background:#fff;border:1px solid var(--line);border-radius:8px;color:var(--sub)}.more{justify-self:center;padding:10px 18px;border:1px solid var(--line);background:#fff;border-radius:8px}
@media(max-width:820px){.top{position:static}.top-inner{padding:12px}h1{font-size:21px}main{display:block;padding:0}.side{position:static;max-height:none;border-width:0 0 1px;border-radius:0}.mail-card{border-left:0;border-right:0;border-radius:0}.mail-card header{grid-template-columns:1fr}.member{justify-self:start}.body{padding:12px}.mail-photo img{max-height:560px}}
</style>
</head>
<body>
<header class="top"><div class="top-inner">
  <h1>ハロモバ メールアーカイブ</h1>
  <div class="meta"><span class="pill">メール ${count}件</span><a class="link" href="../../../../index.html">トップ</a><a class="link" href="../hello_pedia/index.html">ハローペディア</a><a class="link" href="../hello_qa/index.html">ハロー！Q&amp;A</a><a class="link" href="../special_events/index.html">特設イベント</a></div>
</div></header>
<main>
  <aside class="side">
    <div class="control"><label for="search">検索</label><input id="search" type="search" placeholder="件名・本文で検索"></div>
    <div class="control"><label>年</label><div class="quick" id="years"></div></div>
    <div class="control"><label for="month">月</label><select id="month"></select></div>
    <div class="control"><label for="member">メンバー</label><select id="member"></select></div>
    <button id="reset" type="button">条件をリセット</button>
    <p class="summary" id="count"></p>
  </aside>
  <section class="mail-list" id="list"></section>
</main>
<script src="mail_data.js"></script>
<script>
const allMessages = window.MAIL_MESSAGES || [];
const state = { year: '', month: '', member: '', query: '', shown: 0, step: 40 };
const list = document.getElementById('list'), count = document.getElementById('count'), years = document.getElementById('years'), month = document.getElementById('month'), member = document.getElementById('member'), search = document.getElementById('search');
function esc(value){return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function memberName(subject){return String(subject || '').replace(/^\\s*From☆\\s*/, '').trim() || '不明';}
function ym(date){return String(date || '').slice(0, 7);}
function setup(){
  const yearValues = [...new Set(allMessages.map(m => String(m.date).slice(0,4)).filter(Boolean))].sort().reverse();
  years.innerHTML = '<button type="button" data-year="">すべて</button>' + yearValues.map(y => '<button type="button" data-year="'+esc(y)+'">'+esc(y)+'</button>').join('');
  const members = [...new Set(allMessages.map(m => m.member || memberName(m.subject)))].sort((a,b)=>a.localeCompare(b,'ja'));
  member.innerHTML = '<option value="">すべて</option>' + members.map(v => '<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
  const latestMonth = allMessages[0] ? ym(allMessages[0].date) : '';
  state.year = latestMonth.slice(0,4);
  state.month = latestMonth;
  refreshMonths();
  apply();
}
function refreshMonths(){
  const months = [...new Set(allMessages.filter(m => !state.year || String(m.date).startsWith(state.year)).map(m => ym(m.date)).filter(Boolean))].sort().reverse();
  month.innerHTML = '<option value="">すべて</option>' + months.map(v => '<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
  if (state.month && !months.includes(state.month)) state.month = '';
  month.value = state.month;
  for (const b of years.querySelectorAll('button')) b.classList.toggle('active', b.dataset.year === state.year);
}
function filtered(){
  const q = state.query.toLowerCase();
  return allMessages.filter(m => (!state.year || String(m.date).startsWith(state.year)) && (!state.month || ym(m.date) === state.month) && (!state.member || m.member === state.member) && (!q || String(m.searchText || '').toLowerCase().includes(q)));
}
function renderCard(m){
  return '<article class="mail-card"><header><div><time>'+esc(m.date)+'</time><h2>'+esc(m.subject)+'</h2></div><span class="member">'+esc(m.member)+'</span></header><div class="body">'+m.html+'</div></article>';
}
function apply(){
  state.query = search.value.trim();
  const rows = filtered();
  state.shown = Math.min(state.shown || state.step, rows.length);
  list.innerHTML = rows.slice(0, state.shown).map(renderCard).join('') || '<div class="empty">該当するメールがありません。</div>';
  if (state.shown < rows.length) {
    const btn = document.createElement('button');
    btn.className = 'more';
    btn.type = 'button';
    btn.textContent = 'さらに表示';
    btn.addEventListener('click', () => { state.shown += state.step; apply(); });
    list.appendChild(btn);
  }
  count.textContent = rows.length + '件中 ' + Math.min(state.shown, rows.length) + '件を表示';
}
years.addEventListener('click', e => { const b=e.target.closest('button[data-year]'); if(!b)return; state.year=b.dataset.year; state.month=''; state.shown=state.step; refreshMonths(); apply(); });
month.addEventListener('change', () => { state.month=month.value; state.shown=state.step; apply(); });
member.addEventListener('change', () => { state.member=member.value; state.shown=state.step; apply(); });
search.addEventListener('input', () => { state.shown=state.step; apply(); });
document.getElementById('reset').addEventListener('click', () => { state.year=''; state.month=''; state.member=''; search.value=''; member.value=''; state.shown=state.step; refreshMonths(); apply(); });
setup();
</script>
</body>
</html>`;
}

async function main() {
  if (!fs.existsSync(SOURCE_JSON)) throw new Error(`${SOURCE_JSON} がありません。Gmail本文データをここに置いてから実行してください。`);
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  const raw = JSON.parse(fs.readFileSync(SOURCE_JSON, 'utf8'));
  const source = Array.isArray(raw) ? raw : raw.responses || [];
  const messages = [];
  for (const item of source) {
    const payload = item.payload || item;
    const subject = findHeader(payload, 'Subject') || item.subject || '(件名なし)';
    const date = normalizeDate(findHeader(payload, 'Date') || item.date, item.internal_date);
    const stem = cleanName(`${date}_${subject}_${item.id || messages.length + 1}`, 150);
    let html = findHtmlPart(payload) || item.html || '';
    html = stripMailFooter(html);
    if (shouldSkipMessage(subject, html)) continue;
    html = await localizeImages(html, stem);
    html = await convertSpmessageLinks(html, stem);
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const member = subject.replace(/^\s*From☆\s*/, '').trim() || '不明';
    messages.push({ date, subject, member, html, searchText: `${date} ${subject} ${member} ${text}` });
  }
  messages.sort((a, b) => `${b.date} ${b.subject}`.localeCompare(`${a.date} ${a.subject}`, 'ja'));
  fs.writeFileSync(path.join(OUT_ROOT, 'index.html'), renderPage(messages.length), 'utf8');
  fs.writeFileSync(path.join(OUT_ROOT, 'mail_data.js'), `window.MAIL_MESSAGES=${JSON.stringify(messages)};\n`, 'utf8');
  fs.writeFileSync(path.join(OUT_ROOT, '_mail_manifest.json'), JSON.stringify(messages.map(({ date, subject, member }) => ({ date, subject, member })), null, 2), 'utf8');
  console.log(`mail archive written: ${messages.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
