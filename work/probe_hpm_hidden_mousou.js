const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_ROOT = path.join(ROOT, 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'hello_movie_sorted');
const MANIFEST = path.join(OUT_ROOT, '_hello_movie_manifest.json');
const REPORT = path.join(OUT_ROOT, '_hidden_mousou_probe.json');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const START = Number(process.env.HPM_PROBE_START || 1);
const END = Number(process.env.HPM_PROBE_END || 25000);
const CONCURRENCY = Number(process.env.HPM_PROBE_CONCURRENCY || 24);

function parseMovieId(contentText) {
  const text = String(contentText || '');
  return text.match(/id=["']playerElem["'][^>]*\bvalue=["'](\d+)["']/i)?.[1]
    || text.match(/id=["']playerElem["'][^>]*\bshort=["'](\d+)["']/i)?.[1]
    || text.match(/\bvalue=["'](\d+)["']/i)?.[1]
    || null;
}

function readDone() {
  try {
    const json = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    return new Set(Object.keys(json.done || {}));
  } catch {
    return new Set();
  }
}

async function getContent(id, categoryId) {
  const url = `http://helloproject-mobile.com/api/contents/${id}?idx=1&menu_id=17&category_id=${categoryId}&is_movie=true`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'http://helloproject-mobile.com/info/movie?menu_id=17',
    },
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json || json.error?.status || !json.content?.content_id) return null;
  if (String(json.content.content_id) !== String(id)) return null;
  return json.content;
}

async function main() {
  const known = readDone();
  const ids = [];
  for (let i = START; i <= END; i++) ids.push(i);
  const hits = [];
  const hiddenMousou = [];
  let checked = 0;

  async function worker() {
    while (ids.length) {
      const id = ids.shift();
      for (const cat of [46, 70, 84]) {
        const c = await getContent(id, cat);
        if (!c) continue;
        const mid = parseMovieId(c.content_text);
        if (!mid) continue;
        const item = {
          content_id: String(c.content_id),
          category_id: String(c.category_id),
          requested_category_id: String(cat),
          title: c.content_title,
          member: c.content_sub_title,
          release_date: c.release_date,
          created_at: c.created_at,
          updated_at: c.updated_at,
          movie_id: mid,
          known: known.has(String(c.content_id)),
        };
        hits.push(item);
        if (String(c.category_id) === '46' && !item.known) hiddenMousou.push(item);
        break;
      }
      checked++;
      if (checked % 1000 === 0) console.log(`checked=${checked} hits=${hits.length} hiddenMousou=${hiddenMousou.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  hits.sort((a, b) => Number(a.content_id) - Number(b.content_id));
  hiddenMousou.sort((a, b) => Number(a.content_id) - Number(b.content_id));
  const report = {
    scanned: { start: START, end: END },
    hit_count: hits.length,
    hidden_mousou_count: hiddenMousou.length,
    hidden_mousou: hiddenMousou,
    hits,
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({
    scanned: report.scanned,
    hit_count: report.hit_count,
    hidden_mousou_count: report.hidden_mousou_count,
    hidden_mousou: report.hidden_mousou,
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
