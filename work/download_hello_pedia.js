const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'hello_pedia');
const RAW = path.join(OUT, '_raw_json');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const MENU_ID = '25';

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
        Accept: 'application/json,text/html,*/*',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', async () => {
        const body = Buffer.concat(chunks);
        if (res.statusCode >= 500 && tries > 1) {
          await sleep(500);
          try { resolve(await requestBuffer(url, tries - 1)); } catch (err) { reject(err); }
          return;
        }
        resolve({ status: res.statusCode, body, url });
      });
    });
    req.on('error', async (err) => {
      if (tries > 1) {
        await sleep(500);
        try { resolve(await requestBuffer(url, tries - 1)); } catch (retryErr) { reject(retryErr); }
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
    throw new Error(`JSON parse failed for ${url}: ${text.slice(0, 160)}`);
  }
}

async function main() {
  mkdirp(RAW);
  const contents = [];
  const errors = [];

  for (let page = 1; page < 200; page++) {
    const url = `http://helloproject-mobile.com/api/contents?menu_id=${MENU_ID}&page=${page}`;
    const data = await getJson(url);
    fs.writeFileSync(path.join(RAW, `list_${String(page).padStart(3, '0')}.json`), JSON.stringify(data, null, 2));
    contents.push(...(data.contents || []));
    console.log(`list page ${page}: ${data.contents?.length || 0}`);
    if (!data.hasNext) break;
  }

  const items = [];
  for (let i = 0; i < contents.length; i++) {
    const item = contents[i];
    const idx = item.idx || i + 1;
    const page = Math.floor((idx - 1) / 20) + 1;
    const url = `http://helloproject-mobile.com/api/contents/${encodeURIComponent(item.content_id)}?idx=${idx}&page=${page}&menu_id=${MENU_ID}`;
    try {
      const data = await getJson(url);
      fs.writeFileSync(path.join(RAW, `detail_${String(idx).padStart(4, '0')}_${item.content_id}.json`), JSON.stringify(data, null, 2));
      items.push({ ...item, detail: data.content || null });
      console.log(`detail ${idx}/${contents.length}: ${item.content_title}`);
    } catch (err) {
      errors.push({ item, url, error: String(err.message || err) });
      items.push({ ...item, detail: null });
      console.warn(`detail error ${item.content_id}: ${err.message || err}`);
    }
  }

  const archive = {
    generated_at: new Date().toISOString(),
    source: 'http://helloproject-mobile.com/content/artist10?menu_id=25',
    menu_id: MENU_ID,
    list_count: contents.length,
    item_count: items.length,
    error_count: errors.length,
    items,
    errors,
  };
  fs.writeFileSync(path.join(OUT, '_hello_pedia_archive.json'), JSON.stringify(archive, null, 2));
  fs.writeFileSync(path.join(OUT, '_hello_pedia_report.txt'), [
    `generated_at: ${archive.generated_at}`,
    `items: ${archive.item_count}`,
    `errors: ${archive.error_count}`,
  ].join('\n'));
  console.log(JSON.stringify({ items: archive.item_count, errors: archive.error_count }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
