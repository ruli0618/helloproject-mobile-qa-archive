const fs = require('fs');
const path = require('path');

const ROOT = 'http://helloproject-mobile.com';
const OUT_ROOT = path.join(
  'C:/Users/misuz/Documents/Codex/2026-07-31/http-helloproject-mobile-com',
  'outputs',
  'helloproject-mobile-archive',
  'helloproject-mobile.com',
  'special_events',
  'spmessage'
);
const URL_LIST = path.join(
  'C:/Users/misuz/Documents/Codex/2026-07-31/http-helloproject-mobile-com',
  'work',
  'spmessage_urls_from_chrome_history.txt'
);
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/14E5239e Safari/602.1';

function cleanName(value, max = 120) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'unknown';
}

function parseAttrs(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([a-zA-Z0-9_-]+)\s*=\s*["']([^"']*)["']/g)) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  return attrs;
}

function urlToId(url) {
  const page = new URL(url).searchParams.get('page') || '';
  return page.replace(/^spmessage\//, '').replace(/\.html$/i, '');
}

async function getBuffer(url, referer) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Referer': referer || ROOT + '/',
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function getText(url) {
  return (await getBuffer(url, ROOT + '/info/special/')).toString('utf8');
}

async function main() {
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  const urls = fs.readFileSync(URL_LIST, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const unique = [...new Set(urls)];
  const manifest = [];

  for (const originalUrl of unique) {
    const url = originalUrl.endsWith('.html') ? originalUrl : `${originalUrl}.html`;
    const id = urlToId(url);
    try {
      const html = await getText(url);
      const fullImgTag = [...html.matchAll(/<img\b[^>]*>/gi)]
        .map((m) => m[0])
        .find((tag) => /\bclass=["'][^"']*\bfull\b/i.test(tag));
      if (!fullImgTag) throw new Error('full image not found');
      const attrs = parseAttrs(fullImgTag);
      const src = attrs.src;
      const alt = attrs.alt || '';
      if (!src) throw new Error('image src not found');
      const imageUrl = new URL(src, ROOT).toString();
      const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
      const stem = cleanName(`${id} - ${alt}`, 160);
      const htmlPath = path.join(OUT_ROOT, `${stem}.html`);
      const imagePath = path.join(OUT_ROOT, `${stem}${ext}`);

      fs.writeFileSync(htmlPath, html, 'utf8');
      if (!fs.existsSync(imagePath) || fs.statSync(imagePath).size === 0) {
        fs.writeFileSync(imagePath, await getBuffer(imageUrl, url));
      }

      const row = {
        id,
        alt,
        page_url: url,
        image_url: imageUrl,
        html_file: htmlPath,
        image_file: imagePath,
        image_size: fs.statSync(imagePath).size,
      };
      manifest.push(row);
      console.log(`OK ${id} ${alt}`);
    } catch (error) {
      manifest.push({ id, page_url: url, error: error.message });
      console.error(`FAIL ${id}: ${error.message}`);
    }
  }

  manifest.sort((a, b) => String(a.id).localeCompare(String(b.id), 'ja'));
  fs.writeFileSync(path.join(OUT_ROOT, '_spmessage_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`done ${manifest.filter((x) => !x.error).length}/${manifest.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
