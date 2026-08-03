const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(
  ROOT,
  'outputs',
  'helloproject-mobile-archive',
  'helloproject-mobile.com',
  'hello_qa',
);
const RAW = path.join(OUT, '_raw_json');
const ASSETS = path.join(OUT, 'assets');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestBuffer(url, tries = 3) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      headers: {
        'User-Agent': UA,
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json,text/html,image/*,*/*',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', async () => {
        const body = Buffer.concat(chunks);
        if (res.statusCode >= 500 && tries > 1) {
          await sleep(500);
          try { resolve(await requestBuffer(url, tries - 1)); }
          catch (err) { reject(err); }
          return;
        }
        resolve({ status: res.statusCode, headers: res.headers, body, url });
      });
    });
    req.on('error', async (err) => {
      if (tries > 1) {
        await sleep(500);
        try { resolve(await requestBuffer(url, tries - 1)); }
        catch (retryErr) { reject(retryErr); }
      } else {
        reject(err);
      }
    });
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

async function getJson(url) {
  const res = await requestBuffer(url);
  const text = res.body.toString('utf8');
  if (res.status !== 200) throw new Error(`${res.status} ${url}`);
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`JSON parse failed for ${url}: ${text.slice(0, 120)}`);
  }
}

function enc(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripTags(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')
    .trim();
}

function safeFileName(value) {
  return String(value ?? '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'untitled';
}

function dateOnly(value) {
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

async function saveJson(name, data) {
  fs.writeFileSync(path.join(RAW, name), JSON.stringify(data, null, 2), 'utf8');
}

async function downloadAsset(urlPath) {
  if (!urlPath) return '';
  const url = new URL(urlPath, 'http://helloproject-mobile.com/').toString();
  const parsed = new URL(url);
  const rel = parsed.pathname.replace(/^\/+/, '').replace(/[<>:"\\|?*\x00-\x1f]/g, '_');
  const outPath = path.join(ASSETS, rel);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
    return path.relative(OUT, outPath).replace(/\\/g, '/');
  }
  const res = await requestBuffer(url);
  if (res.status === 200 && String(res.headers['content-type'] || '').startsWith('image/')) {
    mkdirp(path.dirname(outPath));
    fs.writeFileSync(outPath, res.body);
    return path.relative(OUT, outPath).replace(/\\/g, '/');
  }
  return '';
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let index = 0;
  async function worker(workerId) {
    while (index < items.length) {
      const current = index++;
      try {
        out[current] = await fn(items[current], current, workerId);
      } catch (err) {
        out[current] = { error: err.message, item: items[current] };
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, (_, i) => worker(i)));
  return out;
}

async function main() {
  mkdirp(OUT);
  mkdirp(RAW);
  mkdirp(ASSETS);

  const categoryUrl = `http://helloproject-mobile.com/api/category?${enc({ menu_id: 6 })}`;
  const categoryData = await getJson(categoryUrl);
  await saveJson('categories.json', categoryData);
  const categories = (categoryData.category || []).map((item) => ({
    id: String(item.category_id),
    title: item.category_title,
    color: String(item.category_color || '#1e7296').replace(/^#/, ''),
    is_new: item.is_new,
  }));

  console.log(`categories=${categories.length}`);
  const allListItems = [];
  for (const category of categories) {
    let page = 1;
    while (true) {
      const listUrl = `http://helloproject-mobile.com/api/contents?${enc({ category_id: category.id, page })}`;
      const data = await getJson(listUrl);
      await saveJson(`contents_category_${category.id}_page_${String(page).padStart(3, '0')}.json`, data);
      const contents = data.contents || [];
      for (const item of contents) {
        allListItems.push({
          ...item,
          category_id: category.id,
          category_title: category.title,
          category_color: category.color,
          page,
        });
      }
      console.log(`${category.title}\tpage=${page}\titems=${contents.length}\thasNext=${!!data.hasNext}`);
      if (!data.hasNext || contents.length === 0) break;
      page += 1;
    }
  }

  const seen = new Set();
  const listItems = allListItems.filter((item) => {
    const key = `${item.category_id}:${item.content_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`contents=${listItems.length}`);

  const records = await mapLimit(listItems, 8, async (item, i) => {
    const detailUrl = `http://helloproject-mobile.com/api/contents/${item.content_id}?${enc({
      idx: item.idx,
      page: item.page,
      category_id: item.category_id,
    })}`;
    const commentsUrl = `http://helloproject-mobile.com/api/comments?${enc({
      order: 'true',
      content_id: item.content_id,
    })}`;
    const [detail, comments] = await Promise.all([getJson(detailUrl), getJson(commentsUrl)]);
    if (i % 50 === 0) console.log(`detail ${i + 1}/${listItems.length}`);
    await saveJson(`detail_${item.category_id}_${item.content_id}.json`, detail);
    await saveJson(`comments_${item.category_id}_${item.content_id}.json`, comments);
    const content = detail.content || item;
    const cleanedComments = await mapLimit(comments.comments || [], 4, async (comment) => {
      let imageUrl = '';
      if (comment.artist_id && String(comment.artist_id) !== '0') {
        imageUrl = `/images/artist_thumbnail/${comment.artist_id}.jpg`;
      } else if (comment.user_icon) {
        imageUrl = `/images/user_icon/${comment.user_icon}.png`;
      }
      return {
        ...comment,
        comment_plain: stripTags(comment.comment_text),
        image_url: imageUrl,
        local_image: await downloadAsset(imageUrl),
      };
    });
    return {
      category_id: item.category_id,
      category_title: item.category_title,
      category_color: item.category_color,
      idx: item.idx,
      content_id: String(item.content_id),
      title: content.content_title || item.content_title,
      subtitle: content.content_sub_title || item.content_sub_title || '',
      release_date: content.release_date || item.release_date || '',
      created_at: content.created_at || item.created_at || '',
      updated_at: content.updated_at || item.updated_at || '',
      content_text: stripTags(content.content_text || ''),
      url: `http://helloproject-mobile.com/content/qa/detail?${enc({
        content_id: item.content_id,
        menu_id: 6,
        category_id: item.category_id,
        category_title: item.category_title,
        idx: item.idx,
        category_color: item.category_color,
      })}`,
      comments: cleanedComments,
    };
  });

  const okRecords = records.filter((item) => item && !item.error);
  const errors = records.filter((item) => item && item.error);
  okRecords.sort((a, b) => {
    const c = a.category_title.localeCompare(b.category_title, 'ja');
    if (c !== 0) return c;
    return String(b.release_date).localeCompare(String(a.release_date));
  });

  const archive = {
    generated_at: new Date().toISOString(),
    source: 'http://helloproject-mobile.com/content/qa?menu_id=6',
    category_count: categories.length,
    content_count: okRecords.length,
    error_count: errors.length,
    categories,
    items: okRecords,
    errors,
  };
  fs.writeFileSync(path.join(OUT, '_hello_qa_archive.json'), JSON.stringify(archive, null, 2), 'utf8');

  const byCategory = new Map();
  for (const item of okRecords) {
    if (!byCategory.has(item.category_id)) byCategory.set(item.category_id, []);
    byCategory.get(item.category_id).push(item);
  }
  for (const category of categories) {
    const items = byCategory.get(category.id) || [];
    items.sort((a, b) => String(b.release_date).localeCompare(String(a.release_date)));
  }

  function commentHtml(comment) {
    const name = htmlEscape(comment.user_name || comment.artist_name || '回答');
    const img = comment.local_image
      ? `<img class="avatar" src="${htmlEscape(comment.local_image)}" alt="">`
      : '<div class="avatar placeholder"></div>';
    const body = htmlEscape(comment.comment_plain).replace(/\n/g, '<br>');
    return `<article class="answer">${img}<div class="answer-body"><div class="answer-name">${name}</div><div class="answer-text">${body}</div></div></article>`;
  }

  function itemHtml(item) {
    const date = dateOnly(item.release_date);
    const answers = item.comments.map(commentHtml).join('\n');
    const q = htmlEscape(item.title);
    const sub = item.subtitle ? `<div class="subtitle">${htmlEscape(item.subtitle)}</div>` : '';
    return `<section class="qa-card" data-category="${htmlEscape(item.category_id)}" data-text="${htmlEscape(`${item.category_title} ${item.title} ${item.comments.map((c) => `${c.user_name} ${c.comment_plain}`).join(' ')}`)}">
  <header class="qa-head">
    <div><div class="date">${htmlEscape(date)}</div><h3>${q}</h3>${sub}</div>
    <a class="source-link" href="${htmlEscape(item.url)}">元ページ</a>
  </header>
  <div class="answers">${answers}</div>
</section>`;
  }

  const categoryButtons = categories.map((cat) => {
    const count = (byCategory.get(cat.id) || []).length;
    return `<button class="cat" style="--cat:#${htmlEscape(cat.color)}" data-category="${htmlEscape(cat.id)}"><span></span>${htmlEscape(cat.title)} <b>${count}</b></button>`;
  }).join('\n');
  const nav = categories.map((cat) => {
    const count = (byCategory.get(cat.id) || []).length;
    return `<a href="#cat-${htmlEscape(cat.id)}" style="--cat:#${htmlEscape(cat.color)}"><span></span>${htmlEscape(cat.title)}<b>${count}</b></a>`;
  }).join('\n');
  const sections = categories.map((cat) => {
    const items = byCategory.get(cat.id) || [];
    return `<section class="category-section" id="cat-${htmlEscape(cat.id)}" data-category-section="${htmlEscape(cat.id)}">
  <h2 style="--cat:#${htmlEscape(cat.color)}"><span></span>${htmlEscape(cat.title)} <small>${items.length}件</small></h2>
  ${items.map(itemHtml).join('\n')}
</section>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ハロー！Q&A アーカイブ</title>
<style>
:root{color-scheme:light;--ink:#172338;--muted:#667085;--line:#d8e0ea;--bg:#f5f7fb;--panel:#fff;--accent:#117c96}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Sans","Yu Gothic",Meiryo,sans-serif;line-height:1.65;letter-spacing:0}
header.hero{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid var(--line)}
.hero-inner{max-width:1180px;margin:auto;padding:18px 18px 14px}
h1{font-size:26px;margin:0 0 8px}
.meta{color:var(--muted);font-size:13px}
.controls{display:grid;grid-template-columns:1fr auto;gap:12px;margin-top:14px}
input[type=search]{width:100%;font-size:16px;padding:11px 13px;border:1px solid var(--line);border-radius:8px;background:#fff}
.clear{border:1px solid var(--line);background:#fff;border-radius:8px;padding:0 14px;color:var(--ink)}
main{max-width:1180px;margin:0 auto;padding:18px;display:grid;grid-template-columns:250px 1fr;gap:18px}
nav{position:sticky;top:118px;align-self:start;background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px}
nav a{display:flex;align-items:center;gap:8px;color:var(--ink);text-decoration:none;padding:8px;border-radius:6px;font-size:14px}
nav a:hover{background:#f1f5f9}
nav span,.cat span,h2 span{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--cat)}
nav b,.cat b{margin-left:auto;color:var(--muted);font-weight:600}
.catbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.cat{display:flex;align-items:center;gap:7px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 10px;font-size:13px;color:var(--ink)}
.cat.active{border-color:var(--cat);box-shadow:0 0 0 2px color-mix(in srgb,var(--cat),transparent 78%)}
.category-section{margin-bottom:32px}
h2{display:flex;align-items:center;gap:10px;margin:8px 0 12px;font-size:22px}
h2 small{color:var(--muted);font-size:13px;font-weight:500}
.qa-card{background:var(--panel);border:1px solid var(--line);border-radius:8px;margin:0 0 14px;overflow:hidden}
.qa-head{display:flex;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);background:#fbfcfe}
.date{font-size:12px;color:var(--muted);margin-bottom:4px}
h3{font-size:18px;line-height:1.45;margin:0}
.subtitle{font-size:13px;color:var(--muted);margin-top:4px}
.source-link{flex:0 0 auto;color:var(--accent);font-size:12px;text-decoration:none}
.answers{padding:6px 14px 14px}
.answer{display:grid;grid-template-columns:54px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid #eef2f6}
.answer:last-child{border-bottom:0}
.avatar{width:54px;height:54px;border-radius:50%;object-fit:cover;border:1px solid var(--line);background:#edf2f7}
.placeholder{display:block}
.answer-name{font-weight:700;margin-bottom:3px;color:#14324a}
.answer-text{white-space:normal;overflow-wrap:anywhere}
.hidden{display:none!important}
mark{background:#fff2a8;padding:0 2px;border-radius:2px}
@media(max-width:820px){main{display:block;padding:12px}nav{position:static;margin-bottom:14px}.controls{grid-template-columns:1fr}.qa-head{display:block}.source-link{display:inline-block;margin-top:8px}.hero-inner{padding:14px 12px}.catbar{max-height:120px;overflow:auto}}
</style>
</head>
<body>
<header class="hero">
  <div class="hero-inner">
    <h1>ハロー！Q&A アーカイブ</h1>
    <div class="meta">${htmlEscape(okRecords.length)}件 / ${htmlEscape(categories.length)}カテゴリ / 生成 ${htmlEscape(new Date().toLocaleString('ja-JP'))}</div>
    <div class="controls"><input id="search" type="search" placeholder="質問、回答、メンバー名で検索"><button class="clear" id="clear">クリア</button></div>
    <div class="catbar"><button class="cat active" data-category="all"><span style="background:#117c96"></span>すべて <b>${okRecords.length}</b></button>${categoryButtons}</div>
  </div>
</header>
<main>
  <nav>${nav}</nav>
  <div id="content">${sections}</div>
</main>
<script>
const search = document.getElementById('search');
const clear = document.getElementById('clear');
const cards = [...document.querySelectorAll('.qa-card')];
const sections = [...document.querySelectorAll('.category-section')];
const buttons = [...document.querySelectorAll('.cat')];
let activeCategory = 'all';
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
}));
search.addEventListener('input', applyFilter);
clear.addEventListener('click', () => { search.value = ''; activeCategory = 'all'; buttons.forEach((b,i)=>b.classList.toggle('active', i===0)); applyFilter(); });
</script>
</body>
</html>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');

  const report = [
    'ハロー！Q&A 保存レポート',
    `生成日時: ${new Date().toLocaleString('ja-JP')}`,
    `カテゴリ: ${categories.length}`,
    `Q&A: ${okRecords.length}`,
    `エラー: ${errors.length}`,
    '',
    ...categories.map((cat) => `${cat.title}: ${(byCategory.get(cat.id) || []).length}`),
  ].join('\n');
  fs.writeFileSync(path.join(OUT, '_hello_qa_report.txt'), report, 'utf8');
  console.log(report);
  console.log(path.join(OUT, 'index.html'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
