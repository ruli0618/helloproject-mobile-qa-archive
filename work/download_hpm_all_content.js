const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = 'http://helloproject-mobile.com';
const SITE = path.resolve(__dirname, '..', 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com');
const OUT = path.join(SITE, 'extra_content');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const AUTH_HEADERS = process.env.HPM_COOKIE ? { cookie: process.env.HPM_COOKIE } : {};
const MIN_FREE_BYTES = 10 * 1024 ** 3;
const NOT_FOUND_SHA256 = '57029bbffc124f07caca9ff9a3fa5b6f1071f09a3c85a74b3e088c8735557903';
const MENUS = [
  [3, 'スタッフ日記'], [16, 'Juice=JuiceのLike=Like'], [18, 'イラスト漫画リレー'],
  [19, 'つばきファクトリーのハナモヨウ'], [21, '野中部長の小説コーナー'], [22, '意識高い乙女の記し'],
  [23, '野中部長の裏日記'], [24, 'BEYOOOOONDSのビヨンズした'], [27, 'つばきのスキップ日和'],
];

function freeBytes() {
  const stats = fs.statfsSync(path.parse(SITE).root);
  return stats.bavail * stats.bsize;
}

function safe(value) {
  return String(value || 'untitled').normalize('NFKC').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function request(url, options = {}, retries = 3) {
  let last;
  for (let i = 0; i < retries; i += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json,image/*,*/*', ...AUTH_HEADERS, ...options.headers } });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return { response, buffer: Buffer.from(await response.arrayBuffer()) };
    } catch (error) {
      last = error;
      await new Promise(resolve => setTimeout(resolve, 350 * (i + 1)));
    }
  }
  throw last;
}

async function json(url) {
  const { buffer } = await request(url);
  return JSON.parse(buffer.toString('utf8'));
}

async function mapLimit(items, limit, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await fn(items[index], index);
    }
  }));
}

function savePath(dir, contentId, material) {
  const sourceName = material.material_title || material.material_file || 'image';
  const ext = path.extname(sourceName) || '.bin';
  return path.join(dir, 'assets', `${safe(contentId)}_${safe(material.material_id || 'asset')}_${safe(path.basename(sourceName, ext))}${ext}`);
}

function isMissingImage(buffer) {
  return buffer.length === 61362 && crypto.createHash('sha256').update(buffer).digest('hex') === NOT_FOUND_SHA256;
}

async function saveMaterial(dir, item, material) {
  if (!material?.secretKey || !material.material_file) return null;
  const out = savePath(dir, item.content_id, material);
  if (!fs.existsSync(out) || !fs.statSync(out).size || isMissingImage(fs.readFileSync(out))) {
    if (freeBytes() < MIN_FREE_BYTES) throw new Error('stopped: preserving 10 GB free-space reserve');
    const url = `${ROOT}/materials/viewer?secretKey=${encodeURIComponent(material.secretKey)}&material_file=${encodeURIComponent(material.material_file)}`;
    const { buffer } = await request(url);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (isMissingImage(buffer)) return null;
    fs.writeFileSync(out, buffer);
  }
  return path.relative(dir, out).replace(/\\/g, '/');
}

function renderBody(text, materialFiles) {
  const names = new Map(materialFiles.map(file => [path.basename(file).split('_').slice(2).join('_'), file]));
  let body = esc(text).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
  body = body.replace(/&lt;img\s+src=&quot;\/emoji\/emoji-images\/([A-Za-z0-9_-]+\.gif)&quot;\s*\/?&gt;/gi,
    (original, name) => fs.existsSync(path.join(OUT, 'emoji', name))
      ? `<img src="../emoji/${name}" alt="絵文字" style="display:inline;width:auto;height:1.1em;max-width:none;max-height:none;vertical-align:-.15em">`
      : original);
  for (const [name, local] of names) {
    if (name) body = body.replaceAll(esc(name), `<a class="photo" style="width:min(100%,560px)" href="${esc(local)}"><img loading="lazy" src="${esc(local)}" alt=""></a>`);
  }
  return body;
}

function writeIndex(dir, label, entries) {
  const cards = entries.slice().sort((a, b) => String(b.release_date || '').localeCompare(String(a.release_date || ''))).map(entry => {
    const media = (entry.saved_materials || []).filter(file => !String(entry.content_text || '').includes(path.basename(file).split('_').slice(2).join('_')))
      .map(file => `<a class="photo" href="${esc(file)}"><img loading="lazy" src="${esc(file)}" alt="${esc(entry.content_title)}"></a>`).join('');
    const missing = (entry.unavailable_materials || []).length;
    return `<article class="entry" data-search="${esc(`${entry.content_title} ${entry.content_sub_title} ${entry.content_text}`)}"><div class="date">${esc((entry.release_date || '').slice(0, 10))}</div><h2>${esc(entry.content_title || '（無題）')}</h2>${entry.content_sub_title ? `<div class="member">${esc(entry.content_sub_title)}</div>` : ''}<div class="body">${renderBody(entry.content_text || '', entry.saved_materials || [])}</div>${media ? `<div class="media">${media}</div>` : ''}${missing ? `<div class="missing-media">画像${missing}枚は公式サイトから取得できませんでした</div>` : ''}</article>`;
  }).join('\n');
  const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(label)} アーカイブ</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f6f9;color:#172033;font-family:system-ui,"Yu Gothic",Meiryo,sans-serif;line-height:1.7}.top{position:sticky;top:0;background:#fff;border-bottom:1px solid #dbe3ed;padding:12px max(16px,calc((100vw - 1000px)/2));z-index:2}.top h1{font-size:21px;margin:0 0 8px}.top p{font-size:13px;color:#617089;margin:0 0 8px}.top input{width:min(100%,560px);padding:10px 12px;border:1px solid #ccd7e3;border-radius:7px;font:inherit}.list{max-width:1000px;margin:auto;padding:14px 16px}.entry{background:white;border:1px solid #dbe3ed;border-radius:7px;padding:14px;margin:0 0 12px;overflow:hidden}.entry h2{font-size:18px;line-height:1.4;margin:2px 0 3px}.date,.member{font-size:12px;color:#637083}.member{font-weight:650}.body{margin-top:8px;overflow-wrap:anywhere}.body img{max-width:min(100%,560px);max-height:520px;object-fit:contain;vertical-align:middle}.media{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.photo{display:block;width:min(100%,260px);border:1px solid #e1e7ee;border-radius:6px;overflow:hidden}.photo img{display:block;width:100%;height:auto}.hidden{display:none!important}@media(max-width:600px){.entry{padding:12px}.entry h2{font-size:16px}}</style><header class="top"><h1>${esc(label)} アーカイブ</h1><p>${entries.length}件</p><input id="search" type="search" placeholder="本文・タイトル・メンバーで検索"></header><main class="list">${cards}</main><script>const s=document.querySelector('#search'),c=[...document.querySelectorAll('.entry')];s.addEventListener('input',()=>{const q=s.value.trim().toLowerCase();for(const e of c)e.classList.toggle('hidden',!!q&&!e.dataset.search.toLowerCase().includes(q))})</script></html>`;
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

async function archiveMenu([menuId, label]) {
  const slug = `menu-${String(menuId).padStart(2, '0')}-${safe(label).replace(/[^\p{L}\p{N}_-]/gu, '-')}`;
  const dir = path.join(OUT, slug);
  const raw = path.join(dir, '_raw_json');
  fs.mkdirSync(raw, { recursive: true });
  const errors = [];
  const categories = [];
  for (let page = 1; page < 100; page += 1) {
    const data = await json(`${ROOT}/api/category?menu_id=${menuId}&page=${page}`);
    categories.push(...(data.category || []));
    if (!data.hasNext) break;
  }
  fs.writeFileSync(path.join(raw, 'categories.json'), JSON.stringify(categories, null, 2));

  const pairs = [];
  await mapLimit(categories, 3, async category => {
    const items = [];
    for (let page = 1; page < 500; page += 1) {
      const data = await json(`${ROOT}/api/contents?category_id=${encodeURIComponent(category.category_id)}&page=${page}`);
      items.push(...(data.contents || []));
      if (!data.hasNext) break;
    }
    fs.writeFileSync(path.join(raw, `list_${category.category_id}.json`), JSON.stringify(items, null, 2));
    for (const item of items) pairs.push({ category, item });
  });

  const entries = new Array(pairs.length);
  let finished = 0;
  await mapLimit(pairs, 6, async ({ category, item }, index) => {
    try {
      const page = Math.floor((Number(item.idx || 1) - 1) / 20) + 1;
      const detail = await json(`${ROOT}/api/contents/${encodeURIComponent(item.content_id)}?idx=${item.idx}&page=${page}&category_id=${encodeURIComponent(category.category_id)}`);
      const content = detail.content || item;
      const savedMaterials = [];
      const unavailableMaterials = [];
      for (const material of content.materials || []) {
        if (!material.material_id) continue;
        try {
          const saved = await saveMaterial(dir, item, material);
          if (saved) savedMaterials.push(saved);
          else unavailableMaterials.push(material.material_title || material.material_file);
        } catch (error) {
          errors.push({ content_id: item.content_id, type: 'material', error: String(error.message || error) });
          unavailableMaterials.push(material.material_title || material.material_file);
          if (String(error.message).startsWith('stopped:')) throw error;
        }
      }
      const entry = { ...category, ...content, saved_materials: savedMaterials, unavailable_materials: unavailableMaterials };
      entries[index] = entry;
      fs.writeFileSync(path.join(raw, `detail_${item.content_id}.json`), JSON.stringify({ category, list: item, detail: entry }, null, 2));
    } catch (error) {
      errors.push({ content_id: item.content_id, type: 'detail', error: String(error.message || error) });
      entries[index] = { ...category, ...item, content_text: '', saved_materials: [] };
    }
    finished += 1;
    if (finished % 100 === 0 || finished === pairs.length) console.log(`${label}: ${finished}/${pairs.length}`);
  });

  const cleanEntries = entries.filter(Boolean);
  fs.writeFileSync(path.join(dir, '_archive.json'), JSON.stringify({ menu_id: menuId, label, generated_at: new Date().toISOString(), categories, entries: cleanEntries, errors }, null, 2));
  writeIndex(dir, label, cleanEntries);
  return { menu_id: menuId, label, categories: categories.length, entries: pairs.length, errors: errors.length, dir };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  for (const menu of MENUS) {
    try {
      results.push(await archiveMenu(menu));
    } catch (error) {
      results.push({ menu_id: menu[0], label: menu[1], fatal_error: String(error.message || error) });
    }
  }
  fs.writeFileSync(path.join(OUT, '_backup_report.json'), JSON.stringify({ generated_at: new Date().toISOString(), min_free_gb: 10, results }, null, 2));
  const links = results.filter(result => result.dir && fs.existsSync(path.join(result.dir, 'index.html'))).map(result => `<li><a href="${esc(path.relative(OUT, path.join(result.dir, 'index.html')).replace(/\\/g, '/'))}">${esc(result.label)}</a><span>${result.entries}件</span></li>`).join('\n');
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ハロモバ追加アーカイブ</title><style>body{font:16px system-ui,sans-serif;background:#f3f6f9;color:#172033;margin:0}.wrap{max-width:900px;margin:auto;padding:20px}h1{font-size:22px}ul{list-style:none;margin:0;padding:0}li{display:flex;justify-content:space-between;gap:12px;padding:12px;border-bottom:1px solid #dbe3ed;background:#fff}a{color:#087f94;font-weight:650}</style><main class="wrap"><h1>ハロモバ追加アーカイブ</h1><ul>${links}</ul></main>`, 'utf8');
  console.log(JSON.stringify(results, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { writeIndex, isMissingImage, savePath };
