const fs = require('fs');
const path = require('path');
const http = require('http');

const OUT = path.resolve('work', 'top_flick_numeric_probe');
fs.mkdirSync(OUT, { recursive: true });

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';

function get(url) {
  return new Promise((resolve) => {
    const req = http.request(url, { headers: { 'user-agent': UA } }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ url, status: res.statusCode, type: res.headers['content-type'] || '', body: Buffer.concat(chunks) }));
    });
    req.on('error', (err) => resolve({ url, error: err.message }));
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

async function main() {
  const hits = [];
  for (let i = 1; i <= 300; i += 1) {
    const url = `http://helloproject-mobile.com/images/top-flickpic/${i}.jpg`;
    const res = await get(url);
    if (res.status === 200 && String(res.type).startsWith('image/')) {
      const file = path.join(OUT, `${String(i).padStart(4, '0')}.jpg`);
      fs.writeFileSync(file, res.body);
      hits.push({ i, bytes: res.body.length, file });
    }
  }
  fs.writeFileSync(path.join(OUT, '_hits.json'), JSON.stringify(hits, null, 2), 'utf8');
  console.log(`hits=${hits.length}`);
  for (const hit of hits) console.log(`${hit.i}\t${hit.bytes}\t${hit.file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
