const http = require('http');
const https = require('https');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';

function request(url) {
  const client = url.startsWith('https:') ? https : http;
  return new Promise((resolve) => {
    const req = client.request(url, { headers: { 'user-agent': UA } }, (res) => {
      let bytes = 0;
      res.on('data', (chunk) => { bytes += chunk.length; });
      res.on('end', () => resolve({
        url,
        status: res.statusCode,
        type: res.headers['content-type'] || '',
        bytes,
      }));
    });
    req.on('error', (err) => resolve({ url, error: err.message }));
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

async function main() {
  const date = '180107';
  const q = ['180107', '20180107'];
  const exts = ['jpg', 'png', 'jpeg'];
  const slugs = [
    'ishida', 'ayumi', 'ishida_ayumi', 'ayumi_ishida',
    'ishidaayumi', 'ayumiishida', 'ishidaa', 'aishida',
    'ishida1', 'ishida2', 'ishida_1', 'ishida_2',
    'ishida21', 'ishida_21', 'ayumi21', 'ayumi_21',
    'morning_ishida', 'mm_ishida', 'mm17_ishida', 'mm18_ishida',
    'ishida2018', '2018ishida',
  ];
  for (let n = 0; n <= 40; n += 1) {
    slugs.push(`ishida${n}`, `ishida_${n}`, `ishida-${n}`, `ayumi${n}`, `ayumi_${n}`);
  }
  for (const prefix of ['180107', '20180107', 'birthday', 'bd', 'top']) {
    slugs.push(`${prefix}_ishida`, `${prefix}_ayumi`, `${prefix}_ishida_ayumi`);
  }
  const urls = [];
  for (const scheme of ['http', 'https']) {
    for (const slug of slugs) {
      for (const ext of exts) {
        for (const query of q) {
          urls.push(`${scheme}://helloproject-mobile.com/images/top-flickpic/${date}_${slug}.${ext}?${query}`);
        }
      }
    }
  }
  const hits = [];
  for (let i = 0; i < urls.length; i += 12) {
    const chunk = urls.slice(i, i + 12);
    const results = await Promise.all(chunk.map(request));
    hits.push(...results.filter((r) => r.status === 200 && String(r.type).startsWith('image/')));
  }
  console.log(`checked=${urls.length} hits=${hits.length}`);
  for (const hit of hits) console.log(`${hit.bytes}\t${hit.type}\t${hit.url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
