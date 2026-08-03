const ROOT = 'http://helloproject-mobile.com';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const prefixes = [
  'syotyuumimai', 'shochuumimai', 'shochu', 'summer',
  'nengajo', 'nenga', 'newyear', 'new_year',
  'christmas', 'xmas',
  'halloween',
  'valentine', 'valentines',
  'whiteday', 'white_day',
];
const suffixes = ['index.html', 'index'];

async function exists(page) {
  const url = `${ROOT}/info/special/content?page=${page}`;
  const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, page };
  if (/ハロー！プロジェクトモバイルとは？/.test(text)) return { ok: false, status: 'pc-about', page };
  if (/データが取得できません|ページが見つかりません|Not Found/.test(text)) return { ok: false, status: 'notfound-text', page };
  const title = (text.match(/<title[^>]*>([^<]+)/i) || [])[1] || '';
  const body = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200);
  return { ok: true, status: res.status, page, title, body };
}

async function main() {
  const hits = [];
  for (let year = 2014; year <= 2027; year++) {
    for (const prefix of prefixes) {
      for (const suffix of suffixes) {
        const page = `${prefix}_${year}/${suffix}`;
        const r = await exists(page);
        if (r.ok) {
          hits.push(r);
          console.log('HIT', JSON.stringify(r));
        }
      }
    }
  }
  console.log(JSON.stringify({ hits: hits.length, pages: hits.map((h) => h.page) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
