const fs = require('fs');
const path = require('path');

const ROOT = 'http://helloproject-mobile.com';
const OUT = path.join('outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'special_events');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const EVENT_RE = /(暑中|syotyu|shochu|年賀|年始|年末|nenshi|nenmatsu|nenga|newyear|クリスマス|christmas|xmas|ハロウィン|halloween|バレンタイン|valentine|ホワイトデー|white)/i;
const DISCOVERED_SEASONAL_PAGES = [
  { content_title: '暑中見舞い特設 2025', content_sub_title: 'syotyuumimai_2025/index.html', release_date: '2025', content_id: 'discovered-syotyuumimai-2025' },
  { content_title: 'クリスマス特集 2025', content_sub_title: 'xmas_2025/index.html', release_date: '2025', content_id: 'discovered-xmas-2025' },
  { content_title: '年末特集 2025', content_sub_title: 'nenmatsu_2025/index.html', release_date: '2025', content_id: 'discovered-nenmatsu-2025' },
  { content_title: '年始特設 2026', content_sub_title: 'nenshi_2026/index.html', release_date: '2026', content_id: 'discovered-nenshi-2026' },
  { content_title: '前田こころの今月の一言！', content_sub_title: 'maeda_word/index.html', release_date: '', content_id: 'support-maeda-word' },
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function pageToUrl(page) {
  return `${ROOT}/info/special/content?page=${page}`;
}

function sanitize(s) {
  return String(s || '')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function normalizePage(page) {
  const clean = String(page || '').replace(/^\/+/, '').replace(/\?.*$/, '');
  return clean.endsWith('/index') ? `${clean}.html` : clean;
}

function localPagePath(page) {
  const clean = normalizePage(page);
  return path.join(OUT, 'pages', clean.endsWith('.html') || clean.endsWith('.htm') ? clean : `${clean}.html`);
}

function localAssetPath(url) {
  const u = new URL(url, ROOT);
  return path.join(OUT, 'assets', u.pathname.replace(/^\/+/, ''));
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer()).toString('utf8');
}

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function extractAttrs(html, attr) {
  const out = [];
  const re = new RegExp(`${attr}=["']([^"']+)["']`, 'gi');
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function extractSpecialPages(html) {
  const out = [];
  const re = /(?:href|src)=["'][^"']*\/info\/special\/content\?page=([^"'#]+)[^"']*["']/gi;
  let m;
  while ((m = re.exec(html))) out.push(decodeURIComponent(m[1]));
  return out;
}

function eventRoot(page) {
  return normalizePage(page).split('/')[0];
}

function extractAssets(html, basePage) {
  const attrs = [...extractAttrs(html, 'src'), ...extractAttrs(html, 'href')];
  const baseUrl = pageToUrl(basePage);
  return attrs
    .filter((v) => v && !v.startsWith('javascript:') && !v.startsWith('mailto:') && !v.startsWith('#'))
    .map((v) => new URL(v, baseUrl).href)
    .filter((u) => {
      const url = new URL(u);
      return url.hostname === 'helloproject-mobile.com' && /\.(?:jpe?g|png|gif|webp|css|js)(?:$|\?)/i.test(url.pathname + url.search);
    });
}

async function getAllSpecialContents() {
  const contents = [];
  for (let page = 1; page < 200; page += 1) {
    const apiUrl = `${ROOT}/api/contents?menu_id=11&page=${page}`;
    const json = JSON.parse(await fetchText(apiUrl));
    contents.push(...(json.contents || []));
    if (!json.hasNext) break;
  }
  return contents;
}

function patchBaseJs(buf) {
  return buf.toString('utf8').replace(
    /showReload:\s*function\(msg\)\s*\{[\s\S]*?hlpr\.utils\.modalDisplay\("#reload-content"\);\s*\},/,
    'showReload: function(msg) {\n    return false;\n  },',
  );
}

function buildIndex(eventSeeds, pages, assets) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ハロモバ 特設イベント保存</title><style>body{font-family:system-ui,sans-serif;margin:0;background:#f6f8fb;color:#172033}.wrap{max-width:980px;margin:auto;padding:24px}h1{font-size:24px}.links{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}.links a,.card a{color:#006bb6;font-weight:700;text-decoration:none}.links a{border:1px solid #dbe3ef;border-radius:999px;background:#fff;padding:4px 10px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.card{background:#fff;border:1px solid #dbe3ef;border-radius:8px;padding:14px}.meta{color:#617089;font-size:13px;margin-top:6px}</style><div class="wrap"><h1>ハロモバ 特設イベント保存</h1><p class="links"><a href="../../../../index.html">トップ</a><a href="../hello_qa/index.html">ハロー！Q&amp;A</a><a href="../hello_pedia/index.html">ハロー！ペディア</a><a href="../tour_diary/index.html">ツアー日記</a></p><p>保存ページ ${pages.length} 件 / 画像・CSS・JS ${assets.size} 件</p><div class="grid">${eventSeeds.map((item) => {
    const file = localPagePath(item.content_sub_title);
    return `<div class="card"><a href="${path.relative(OUT, file).replace(/\\/g, '/')}">${sanitize(item.content_title)}</a><div class="meta">${item.release_date || ''}<br>${item.content_sub_title}</div></div>`;
  }).join('')}</div></div>`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const all = await getAllSpecialContents();
  const seedByPage = new Map();

  for (const item of all.filter((entry) => EVENT_RE.test(entry.content_title) || EVENT_RE.test(entry.content_sub_title))) {
    seedByPage.set(normalizePage(item.content_sub_title), item);
  }
  for (const item of DISCOVERED_SEASONAL_PAGES) {
    seedByPage.set(normalizePage(item.content_sub_title), item);
  }

  const eventSeeds = [...seedByPage.values()];
  const queue = eventSeeds.map((item) => ({
    page: item.content_sub_title,
    source: 'seed',
    title: item.content_title,
    release_date: item.release_date,
    content_id: item.content_id,
  }));

  const pages = [];
  const assets = new Map();
  const errors = [];
  const seen = new Set();

  while (queue.length) {
    const current = queue.shift();
    const page = normalizePage(current.page);
    if (seen.has(page)) continue;
    seen.add(page);
    const url = pageToUrl(page);

    try {
      let html = await fetchText(url);
      const pagePath = localPagePath(page);
      const pageDir = path.dirname(pagePath);

      for (const assetUrl of extractAssets(html, page)) assets.set(assetUrl, true);
      for (const nextPage of extractSpecialPages(html)) {
        let normalized = normalizePage(nextPage);
        if (normalized === 'syotyuumimai_2026/tsubakifactory/11_nishimura.html') {
          normalized = 'syotyuumimai_2026/tsubakifactory/nishimura.html';
        }
        if (eventRoot(normalized) === eventRoot(page) && !seen.has(normalized)) queue.push({ page: normalized, source: page });
      }

      html = html.replace(/(href|src)=["']([^"']+)["']/gi, (match, attr, value) => {
        if (value.startsWith('javascript:') || value.startsWith('mailto:') || value.startsWith('#')) return match;
        const abs = new URL(value, url);
        if (abs.hostname !== 'helloproject-mobile.com') return match;
        if (abs.pathname === '/info/special/content' && abs.searchParams.get('page')) {
          const target = localPagePath(abs.searchParams.get('page'));
          return `${attr}="${path.relative(pageDir, target).replace(/\\/g, '/')}"`;
        }
        if (/\.(?:jpe?g|png|gif|webp|css|js)(?:$|\?)/i.test(abs.pathname + abs.search)) {
          const target = localAssetPath(abs.href);
          const rel = path.relative(pageDir, target).replace(/\\/g, '/');
          const cacheBust = /\/js\/base\.js$/.test(abs.pathname) ? '?archive_fix=1' : '';
          return `${attr}="${rel}${cacheBust}"`;
        }
        return match;
      });

      if (page === 'syotyuumimai_2026/tsubakifactory/doi.html') {
        html = html.replace(/href="11_nishimura\.html"/g, 'href="nishimura.html"');
      }

      ensureDir(pagePath);
      fs.writeFileSync(pagePath, html, 'utf8');
      pages.push({ ...current, page, url, file: pagePath });
      console.log(`page ${pages.length}: ${page}`);
    } catch (e) {
      errors.push({ ...current, page, url, error: String(e.message || e) });
      console.warn(`error ${page}: ${e.message || e}`);
    }
  }

  let downloadedAssets = 0;
  for (const assetUrl of assets.keys()) {
    const file = localAssetPath(assetUrl);
    if (fs.existsSync(file) && fs.statSync(file).size > 0) continue;
    try {
      const buf = await fetchBuffer(assetUrl);
      ensureDir(file);
      if (/\/js\/base\.js(?:$|\?)/.test(new URL(assetUrl).pathname + new URL(assetUrl).search)) {
        fs.writeFileSync(file, patchBaseJs(buf), 'utf8');
      } else {
        fs.writeFileSync(file, buf);
      }
      downloadedAssets += 1;
    } catch (e) {
      errors.push({ url: assetUrl, file, error: String(e.message || e) });
    }
  }

  fs.writeFileSync(path.join(OUT, 'index.html'), buildIndex(eventSeeds, pages, assets), 'utf8');
  fs.writeFileSync(path.join(OUT, '_special_events_report.json'), JSON.stringify({
    generated_at: new Date().toISOString(),
    note: 'Seasonal candidates were inferred from the official X account text and probed against /info/special/content?page=.../index.',
    event_seed_count: eventSeeds.length,
    page_count: pages.length,
    asset_count: assets.size,
    downloaded_assets: downloadedAssets,
    eventSeeds,
    pages,
    errors,
  }, null, 2));

  console.log(JSON.stringify({ all_special: all.length, event_seed_count: eventSeeds.length, page_count: pages.length, asset_count: assets.size, downloadedAssets, errors: errors.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
