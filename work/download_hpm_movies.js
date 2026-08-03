const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SITE_ROOT = path.join(ROOT, 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com');
const OUT_ROOT = path.join(SITE_ROOT, 'hello_movie_sorted');
const MANIFEST = path.join(OUT_ROOT, '_hello_movie_manifest.json');
const REPORT = path.join(OUT_ROOT, '_hello_movie_report.txt');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const STREAM_TOKEN = 'MDk2N0UxMTlGQ0Y4QjQ5QUZFQThEMTFGOUExOUQxMzE=';
const MIN_FREE_GB = Number(process.env.HPM_MIN_FREE_GB || 10);
const CONCURRENCY = Number(process.env.HPM_MOVIE_CONCURRENCY || 2);
const REBUILD_MANIFEST = process.env.HPM_REBUILD_MANIFEST === '1';

const CATEGORIES = [
  { id: 70, title: 'ハロ！モバPR', color: '5FB404' },
  { id: 46, title: '妄想動画', color: 'ff0000' },
  { id: 84, title: 'スペシャル動画', color: 'ffff00' },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeName(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'untitled';
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function getJson(url, referer) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': referer || 'http://helloproject-mobile.com/info/movie?menu_id=17',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

function parseMovieId(contentText) {
  const text = String(contentText || '');
  const full = text.match(/id=["']playerElem["'][^>]*\bvalue=["'](\d+)["']/i);
  if (full) return { movieId: full[1], kind: 'full' };
  const short = text.match(/id=["']playerElem["'][^>]*\bshort=["'](\d+)["']/i);
  if (short) return { movieId: short[1], kind: 'short' };
  const anyValue = text.match(/\bvalue=["'](\d+)["']/i);
  if (anyValue) return { movieId: anyValue[1], kind: 'value' };
  return { movieId: null, kind: 'missing' };
}

function parseDate(value) {
  const d = new Date(String(value || '').replace(/-/g, '/'));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function ymd(value) {
  const d = parseDate(value);
  if (!d) return '0000-00-00';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function selectBest(meta) {
  const urls = meta.movie_url || {};
  const defs = meta.movie_definition || {};
  const keys = ['mb_hd', 'mb_hq', 'mb_sq', 'mb_lq', 'auto_sp', 'mb_auto', 'auto_pc'];
  let best = null;
  for (const key of keys) {
    if (!urls[key]) continue;
    const [h, w] = String(defs[key] || '0:0').split(':').map(Number);
    const pixels = (h || 0) * (w || 0);
    const rank = key === 'mb_hd' ? 10_000_000 : pixels;
    if (!best || rank > best.rank) {
      best = { key, url: urls[key], definition: defs[key] || '', rank };
    }
  }
  return best;
}

function getFreeGb() {
  try {
    const out = cp.execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      "(Get-PSDrive -Name C).Free / 1GB",
    ], { encoding: 'utf8' }).trim();
    return Number(out);
  } catch {
    return Infinity;
  }
}

function runFfmpeg(input, output) {
  const tmp = `${output}.part`;
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
  const args = [
    '-hide_banner',
    '-loglevel', 'warning',
    '-y',
    '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
    '-i', input,
    '-c', 'copy',
    '-bsf:a', 'aac_adtstoasc',
    '-f', 'mp4',
    tmp,
  ];
  const res = cp.spawnSync('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (res.status !== 0) {
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
    throw new Error((res.stderr || res.stdout || `ffmpeg exit ${res.status}`).trim());
  }
  fs.renameSync(tmp, output);
}

function existingContentIds() {
  const ids = new Set();
  if (!fs.existsSync(OUT_ROOT)) return ids;
  for (const dir of fs.readdirSync(OUT_ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(OUT_ROOT, dir.name))) {
      const m = file.match(/\[content(\d+)\]/);
      if (m) ids.add(m[1]);
    }
  }
  return ids;
}

async function loadAllListItems() {
  const all = [];
  for (const cat of CATEGORIES) {
    for (let page = 1; ; page++) {
      const url = `http://helloproject-mobile.com/api/contents?category_id=${cat.id}&page=${page}`;
      const referer = `http://helloproject-mobile.com/info/movie/list?menu_id=17&category_id=${cat.id}&category_title=${encodeURIComponent(cat.title)}&category_color=${cat.color}`;
      const json = await getJson(url, referer);
      for (const item of json.contents || []) {
        all.push({ ...item, category_title: cat.title, category_color: cat.color, page });
      }
      if (!json.hasNext) break;
    }
  }
  return all;
}

async function enrich(item) {
  const url = `http://helloproject-mobile.com/api/contents/${item.content_id}?idx=${item.idx}&page=${item.page}&menu_id=17&category_id=${item.category_id}&is_movie=true`;
  const referer = `http://helloproject-mobile.com/info/movie/detail?content_id=${item.content_id}&menu_id=17&category_id=${item.category_id}&idx=${item.idx}`;
  const json = await getJson(url, referer);
  const content = json.content || item;
  const parsed = parseMovieId(content.content_text);
  if (!parsed.movieId) throw new Error('movie id not found');
  const streamUrl = `https://api01-platform.stream.co.jp/apiservice/getMediaByParam/?type=json&token=${encodeURIComponent(STREAM_TOKEN)}&mid=${parsed.movieId}`;
  const stream = await getJson(streamUrl, referer);
  if (stream.response_status !== '2000' || !stream.meta || !stream.meta[0]) {
    throw new Error(`stream api ${stream.response_status || 'empty'}`);
  }
  const best = selectBest(stream.meta[0]);
  if (!best) throw new Error('stream url not found');
  return { ...item, ...content, movie_id: parsed.movieId, movie_id_kind: parsed.kind, stream: stream.meta[0], best };
}

function targetPath(item) {
  const date = ymd(item.release_date || item.created_at);
  const category = safeName(item.category_title);
  const title = safeName(item.content_title);
  const member = safeName(item.content_sub_title);
  const mid = item.movie_id || 'unknown';
  const filename = item.category_title === '妄想動画'
    ? `${date} - ${title} - ${member} [content${item.content_id}] [mid${mid}].mp4`
    : `${date} - ${category} - ${title} - ${member} [content${item.content_id}] [mid${mid}].mp4`;
  return path.join(OUT_ROOT, category, filename);
}

async function worker(queue, manifest, report) {
  while (queue.length) {
    const item = queue.shift();
    const cid = String(item.content_id);
    try {
      const free = getFreeGb();
      if (free < MIN_FREE_GB) {
        report.stopped = `free space ${free.toFixed(2)}GB is below ${MIN_FREE_GB}GB`;
        queue.length = 0;
        break;
      }
      if (!REBUILD_MANIFEST && manifest.done[cid]) {
        report.skipped++;
        continue;
      }
      const enriched = await enrich(item);
      const out = targetPath(enriched);
      ensureDir(path.dirname(out));
      if (!fs.existsSync(out)) {
        runFfmpeg(enriched.best.url, out);
      }
      manifest.done[cid] = {
        content_id: cid,
        movie_id: enriched.movie_id,
        category_title: enriched.category_title,
        title: enriched.content_title,
        member: enriched.content_sub_title,
        release_date: enriched.release_date,
        created_at: enriched.created_at,
        updated_at: enriched.updated_at,
        quality: enriched.best.key,
        definition: enriched.best.definition,
        path: out,
      };
      fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
      report.downloaded++;
      console.log(`OK ${cid} ${enriched.best.key} ${out}`);
    } catch (err) {
      report.failed.push({ content_id: cid, title: item.content_title, error: err.message });
      fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
      console.error(`FAIL ${cid} ${err.message}`);
    }
  }
}

async function main() {
  ensureDir(OUT_ROOT);
  const manifest = readJson(MANIFEST, { done: {} });
  for (const id of existingContentIds()) {
    manifest.done[id] ||= { content_id: id, discovered_from_existing_file: true };
  }

  const list = await loadAllListItems();
  list.sort((a, b) => {
    const ad = parseDate(a.release_date || a.created_at)?.getTime() || 0;
    const bd = parseDate(b.release_date || b.created_at)?.getTime() || 0;
    return ad - bd || Number(a.content_id) - Number(b.content_id);
  });

  const report = {
    started_at: new Date().toISOString(),
    total_listed: list.length,
    downloaded: 0,
    skipped: 0,
    failed: [],
    stopped: '',
  };

  const queue = list.filter(item => REBUILD_MANIFEST || !manifest.done[String(item.content_id)]);
  console.log(`listed=${list.length} queue=${queue.length} already=${Object.keys(manifest.done).length}`);
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker(queue, manifest, report)));

  report.finished_at = new Date().toISOString();
  report.done_total = Object.keys(manifest.done).length;
  const lines = [
    `started_at: ${report.started_at}`,
    `finished_at: ${report.finished_at}`,
    `total_listed: ${report.total_listed}`,
    `downloaded: ${report.downloaded}`,
    `skipped: ${report.skipped}`,
    `done_total: ${report.done_total}`,
    `failed: ${report.failed.length}`,
    report.stopped ? `stopped: ${report.stopped}` : '',
    '',
    ...report.failed.map(f => `FAIL content${f.content_id} ${f.title || ''}: ${f.error}`),
  ].filter(Boolean);
  fs.writeFileSync(REPORT, lines.join('\n') + '\n', 'utf8');
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(lines.join('\n'));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
