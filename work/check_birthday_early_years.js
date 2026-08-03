const fs = require('fs');
const https = require('https');

const src = fs.readFileSync('work/download_birthday_cards.js', 'utf8');
const pairs = [...src.matchAll(/\['(\d{4})',\s*'([a-z0-9_]+)'\]/g)].map((match) => [match[1], match[2]]);
const uniq = [...new Set(pairs.map((pair) => pair.join('_')))].map((value) => value.split('_'));
console.log(`seed_pairs=${pairs.length}\tunique=${uniq.length}`);
const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';

function check(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'GET', headers: { 'user-agent': ua } }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '' }));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

async function scan(label, years, filter) {
  const urls = [];
  for (const [mmdd, slug] of uniq.filter(filter)) {
    for (const year of years) {
      const yy = String(year).slice(2);
      urls.push({
        year,
        mmdd,
        slug,
        url: `https://helloproject-mobile.com/images/top-flickpic/${yy}${mmdd}_${slug}.jpg?${yy}${mmdd}`,
      });
    }
  }
  const hits = [];
  let index = 0;
  async function worker() {
    while (index < urls.length) {
      const item = urls[index++];
      const res = await check(item.url);
      if (res && res.status === 200 && String(res.type).startsWith('image/')) hits.push(item);
    }
  }
  await Promise.all(Array.from({ length: 10 }, worker));
  hits.sort((a, b) => `${a.year}${a.mmdd}${a.slug}`.localeCompare(`${b.year}${b.mmdd}${b.slug}`));
  console.log(`${label}\tchecked=${urls.length}\thits=${hits.length}`);
  for (const hit of hits) console.log(`${hit.year}\t${hit.mmdd}\t${hit.slug}\t${hit.url}`);
}

(async () => {
  await scan('2016', [2016], () => true);
  await scan('2017', [2017], () => true);
  await scan('2018q1', [2018], ([mmdd]) => mmdd < '0401');
})();
