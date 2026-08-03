const fs = require('fs');
const path = require('path');

const ROOT = 'http://helloproject-mobile.com';
const OUT = path.join('outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'special_events');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const EVENT_RE = /(暑中|syotyu|shochu|残暑|年賀|nenga|newyear|正月|クリスマス|christmas|xmas|ハロウィン|halloween|valentine|バレンタイン|white|ホワイトデー)/i;
const DISCOVERED_SEASONAL_PAGES = [
  { content_title: '暑中見舞い特設 2025', content_sub_title: 'syotyuumimai_2025/index.html', release_date: '2025', content_id: 'discovered-syotyuumimai-2025' },
  { content_title: 'クリスマス特集 2025', content_sub_title: 'xmas_2025/index.html', release_date: '2025', content_id: 'discovered-xmas-2025' },
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

function localPagePath(page) {
  const clean = page.replace(/^\/+/, '').replace(/\?.*$/, '');
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
  return page.replace(/^\/+/, '').split('/')[0];
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
  for (let page = 1; page < 200; page++) {
    const apiUrl = `${ROOT}/api/contents?menu_id=11&page=${page}`;
    const json = JSON.parse(await fetchText(apiUrl));
    contents.push(...(json.contents || []));
    if (!json.hasNext) break;
  }
  return contents;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const all = await getAllSpecialContents();
  const seedByPage = new Map();
  for (const item of all.filter((entry) => EVENT_RE.test(entry.content_title) || EVENT_RE.test(entry.content_sub_title))) {
    seedByPage.set(item.content_sub_title.replace(/\/index$/, '/index.html'), item);
  }
  for (const item of DISCOVERED_SEASONAL_PAGES) {
    seedByPage.set(item.content_sub_title.replace(/\/index$/, '/index.html'), item);
  }
  const eventSeeds = [...seedByPage.values()];
  const queue = [];
  const seen = new Set();
  for (const item of eventSeeds) {
    queue.push({ page: item.content_sub_title, source: 'api', title: item.content_title, release_date: item.release_date, content_id: item.content_id });
  }

  const pages = [];
  const assets = new Map();
  const errors = [];

  while (queue.length) {
    const current = queue.shift();
    const page = current.page.replace(/^\/+/, '');
    if (seen.has(page)) continue;
    seen.add(page);
    const url = pageToUrl(page);
    try {
      let html = await fetchText(url);
      const pagePath = localPagePath(page);
      const pageDir = path.dirname(pagePath);

      for (const assetUrl of extractAssets(html, page)) assets.set(assetUrl, true);
      for (const nextPage of extractSpecialPages(html)) {
        const normalized = nextPage.replace(/^\/+/, '');
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

      ensureDir(pagePath);
      fs.writeFileSync(pagePath, html);
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
        const patched = buf.toString('utf8').replace(
          /showReload:\s*function\(msg\)\s*\{[\s\S]*?hlpr\.utils\.modalDisplay\("#reload-content"\);\s*\},/,
          'showReload: function(msg) {\n    return false;\n  },',
        );
        fs.writeFileSync(file, patched);
      } else {
        fs.writeFileSync(file, buf);
      }
      downloadedAssets++;
    } catch (e) {
      errors.push({ url: assetUrl, file, error: String(e.message || e) });
    }
  }

  const index = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ハロモバ 特設イベント保存</title><style>body{font-family:system-ui,sans-serif;margin:0;background:#f6f8fb;color:#172033}.wrap{max-width:980px;margin:auto;padding:24px}h1{font-size:24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.card{background:#fff;border:1px solid #dbe3ef;border-radius:8px;padding:14px}a{color:#006bb6;font-weight:700;text-decoration:none}.meta{color:#617089;font-size:13px;margin-top:6px}</style><div class="wrap"><h1>ハロモバ 特設イベント保存</h1><p>保存ページ ${pages.length} 件 / 画像・CSS・JS ${assets.size} 件</p><div class="grid">${eventSeeds.map((item) => {
    const file = localPagePath(item.content_sub_title);
    return `<div class="card"><a href="${path.relative(OUT, file).replace(/\\/g, '/')}">${sanitize(item.content_title)}</a><div class="meta">${item.release_date || ''}<br>${item.content_sub_title}</div></div>`;
  }).join('')}</div></div>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), index);
  fs.writeFileSync(path.join(OUT, '_special_events_report.json'), JSON.stringify({ generated_at: new Date().toISOString(), event_seed_count: eventSeeds.length, page_count: pages.length, asset_count: assets.size, downloaded_assets: downloadedAssets, eventSeeds, pages, errors }, null, 2));
  console.log(JSON.stringify({ all_special: all.length, event_seed_count: eventSeeds.length, page_count: pages.length, asset_count: assets.size, downloadedAssets, errors: errors.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
