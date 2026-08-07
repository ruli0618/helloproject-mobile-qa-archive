const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'tour_diary');
const RAW = path.join(OUT, '_raw_json');
const ASSETS = path.join(OUT, 'assets', 'materials');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const MENU_ID = '2';

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
        Accept: 'application/json,image/*,*/*',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', async () => {
        const body = Buffer.concat(chunks);
        if (res.statusCode >= 500 && tries > 1) {
          await sleep(600);
          try { resolve(await requestBuffer(url, tries - 1)); } catch (err) { reject(err); }
          return;
        }
        resolve({ status: res.statusCode, headers: res.headers, body, url });
      });
    });
    req.on('error', async (err) => {
      if (tries > 1) {
        await sleep(600);
        try { resolve(await requestBuffer(url, tries - 1)); } catch (retryErr) { reject(retryErr); }
      } else {
        reject(err);
      }
    });
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
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
    throw new Error(`JSON parse failed for ${url}: ${text.slice(0, 200)}`);
  }
}

function extFromMaterial(material, contentType) {
  const file = material.material_file || material.material_title || '';
  const ext = path.extname(file).toLowerCase();
  if (ext) return ext;
  if ((contentType || '').includes('png')) return '.png';
  if ((contentType || '').includes('gif')) return '.gif';
  if ((contentType || '').includes('webp')) return '.webp';
  return '.jpg';
}

async function downloadMaterial(material) {
  if (!material || !material.secretKey || !material.material_file) return null;
  mkdirp(ASSETS);
  const url = `http://helloproject-mobile.com/materials/viewer?secretKey=${encodeURIComponent(material.secretKey)}&material_file=${encodeURIComponent(material.material_file)}`;
  const res = await requestBuffer(url);
  if (res.status !== 200) throw new Error(`${res.status} ${url}`);
  const ext = extFromMaterial(material, res.headers['content-type']);
  const file = `${material.material_id || 'material'}_${material.secretKey.slice(0, 8)}${ext}`;
  const out = path.join(ASSETS, file);
  fs.writeFileSync(out, res.body);
  return {
    local_path: `assets/materials/${file}`,
    bytes: res.body.length,
    content_type: res.headers['content-type'] || '',
    source_url: url,
  };
}

async function main() {
  mkdirp(RAW);
  mkdirp(ASSETS);
  const categories = [];
  const entries = [];
  const errors = [];

  for (let page = 1; page < 100; page++) {
    const url = `http://helloproject-mobile.com/api/category?menu_id=${MENU_ID}&page=${page}`;
    const data = await getJson(url);
    fs.writeFileSync(path.join(RAW, `category_${String(page).padStart(3, '0')}.json`), JSON.stringify(data, null, 2));
    const pageCategories = data.category || [];
    categories.push(...pageCategories);
    console.log(`category page ${page}: ${pageCategories.length}`);
    if (!data.hasNext) break;
  }

  for (const category of categories) {
    const listItems = [];
    for (let page = 1; page < 300; page++) {
      const url = `http://helloproject-mobile.com/api/contents?category_id=${encodeURIComponent(category.category_id)}&page=${page}`;
      const data = await getJson(url);
      fs.writeFileSync(path.join(RAW, `list_${String(category.idx).padStart(3, '0')}_${category.category_id}_${String(page).padStart(3, '0')}.json`), JSON.stringify(data, null, 2));
      const contents = data.contents || [];
      listItems.push(...contents);
      console.log(`list ${category.idx}/${categories.length} ${category.category_title} page ${page}: ${contents.length}`);
      if (!data.hasNext) break;
    }

    for (let i = 0; i < listItems.length; i++) {
      const item = listItems[i];
      const idx = item.idx || i + 1;
      const page = Math.floor((idx - 1) / 20) + 1;
      const url = `http://helloproject-mobile.com/api/contents/${encodeURIComponent(item.content_id)}?idx=${idx}&page=${page}&category_id=${encodeURIComponent(category.category_id)}`;
      try {
        const data = await getJson(url);
        fs.writeFileSync(path.join(RAW, `detail_${String(category.idx).padStart(3, '0')}_${category.category_id}_${String(idx).padStart(4, '0')}_${item.content_id}.json`), JSON.stringify(data, null, 2));
        const detail = data.content || null;
        const materials = [];
        for (const material of (detail?.materials || [])) {
          if (!material.material_id) continue;
          try {
            const saved = await downloadMaterial(material);
            materials.push({ ...material, saved });
          } catch (err) {
            errors.push({ type: 'material', category, item, material, error: String(err.message || err) });
            materials.push({ ...material, saved: null });
          }
        }
        entries.push({ category, list: item, detail: detail ? { ...detail, materials } : null });
        console.log(`detail ${category.idx}/${categories.length} ${idx}/${listItems.length}: ${item.content_title}`);
      } catch (err) {
        errors.push({ type: 'detail', category, item, url, error: String(err.message || err) });
        entries.push({ category, list: item, detail: null });
        console.warn(`detail error ${item.content_id}: ${err.message || err}`);
      }
    }
  }

  const archive = {
    generated_at: new Date().toISOString(),
    source: 'http://helloproject-mobile.com/dialy/tour?menu_id=2',
    menu_id: MENU_ID,
    category_count: categories.length,
    entry_count: entries.length,
    error_count: errors.length,
    categories,
    entries,
    errors,
  };
  fs.writeFileSync(path.join(OUT, '_tour_diary_archive.json'), JSON.stringify(archive, null, 2));
  fs.writeFileSync(path.join(OUT, '_tour_diary_report.txt'), [
    `generated_at: ${archive.generated_at}`,
    `categories: ${archive.category_count}`,
    `entries: ${archive.entry_count}`,
    `errors: ${archive.error_count}`,
  ].join('\n'));
  console.log(JSON.stringify({ categories: archive.category_count, entries: archive.entry_count, errors: archive.error_count }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
