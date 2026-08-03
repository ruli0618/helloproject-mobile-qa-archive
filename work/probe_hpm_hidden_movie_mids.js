const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_ROOT = path.join(ROOT, 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'hello_movie_sorted');
const MANIFEST = path.join(OUT_ROOT, '_hello_movie_manifest.json');
const REPORT = path.join(OUT_ROOT, '_hidden_movie_mid_candidates.json');
const TOKEN = 'MDk2N0UxMTlGQ0Y4QjQ5QUZFQThEMTFGOUExOUQxMzE=';
const START = Number(process.env.HPM_MID_START || 1);
const END = Number(process.env.HPM_MID_END || 8200);
const CONCURRENCY = Number(process.env.HPM_MID_CONCURRENCY || 32);
const MAX_DURATION = Number(process.env.HPM_MID_MAX_DURATION || 90);

function knownMids() {
  const mids = new Set();
  try {
    const json = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    for (const item of Object.values(json.done || {})) {
      if (item.movie_id) mids.add(String(item.movie_id));
    }
  } catch {}
  return mids;
}

function bestQuality(meta) {
  const urls = meta.movie_url || {};
  const defs = meta.movie_definition || {};
  for (const key of ['mb_hd', 'mb_hq', 'mb_sq', 'mb_lq', 'auto_sp', 'mb_auto']) {
    if (urls[key]) return { key, definition: defs[key] || '', url: urls[key] };
  }
  return null;
}

async function getMid(mid) {
  const url = `https://api01-platform.stream.co.jp/apiservice/getMediaByParam/?type=json&token=${encodeURIComponent(TOKEN)}&mid=${mid}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const meta = json?.meta?.[0];
  if (!meta || Number(json.moviesum || 0) < 1) return null;
  const best = bestQuality(meta);
  if (!best) return null;
  return {
    mid: String(mid),
    title: meta.title || '',
    duration: Number(meta.duration || 0),
    quality: best.key,
    definition: best.definition,
    thumbnail_url: meta.thumbnail_url || meta.thumbnail_url_ssl || '',
    insert_date: meta.insert_date || '',
    update_date: meta.update_date || '',
    url: best.url,
  };
}

async function main() {
  const known = knownMids();
  const mids = [];
  for (let i = START; i <= END; i++) {
    if (!known.has(String(i))) mids.push(i);
  }
  const hits = [];
  const shortCandidates = [];
  let checked = 0;

  async function worker() {
    while (mids.length) {
      const mid = mids.shift();
      const item = await getMid(mid).catch(() => null);
      if (item) {
        hits.push(item);
        if (item.duration > 0 && item.duration <= MAX_DURATION) shortCandidates.push(item);
      }
      checked++;
      if (checked % 1000 === 0) console.log(`checked=${checked} hits=${hits.length} short=${shortCandidates.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  hits.sort((a, b) => Number(a.mid) - Number(b.mid));
  shortCandidates.sort((a, b) => Number(a.mid) - Number(b.mid));
  const report = {
    scanned: { start: START, end: END, skipped_known_mids: known.size },
    hit_count: hits.length,
    short_candidate_count: shortCandidates.length,
    short_candidates: shortCandidates,
    all_unlisted_mid_hits: hits,
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({
    scanned: report.scanned,
    hit_count: report.hit_count,
    short_candidate_count: report.short_candidate_count,
    short_candidates: report.short_candidates.slice(0, 80),
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
