const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(
  __dirname,
  '..',
  'outputs',
  'helloproject-mobile-archive',
  'helloproject-mobile.com',
  'hello_movie_sorted',
);
const dir = path.join(root, '妄想動画');
const candidates = JSON.parse(
  fs.readFileSync(path.join(root, '_hidden_movie_mid_candidates.json'), 'utf8'),
).short_candidates;

const byKey = new Map();
for (const item of candidates) {
  const date = String(item.insert_date || '').replace(/\//g, '-').slice(0, 10);
  const key = `${date}|${Math.round(Number(item.duration))}`;
  if (!byKey.has(key)) byKey.set(key, []);
  byKey.get(key).push(item);
}

function durationOf(file) {
  const out = cp.execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      file,
    ],
    { encoding: 'utf8' },
  );
  return Number(out.trim());
}

const targets = fs
  .readdirSync(dir)
  .filter((name) => name.endsWith('.mp4') && / -\.mp4$/.test(name))
  .sort();

const rows = [];
for (const name of targets) {
  const file = path.join(dir, name);
  const date = name.slice(0, 10);
  const duration = durationOf(file);
  const key = `${date}|${Math.round(duration)}`;
  const matches = byKey.get(key) || [];
  rows.push({
    matchCount: matches.length,
    duration: duration.toFixed(2),
    mids: matches.map((item) => item.mid).join(','),
    name,
    thumbnail: matches[0]?.thumbnail_url || '',
    streamTitle: matches[0]?.title || '',
  });
}

const outPath = path.join(root, '_mousou_missing_member_mid_match.tsv');
fs.writeFileSync(
  outPath,
  [
    'matchCount\tduration\tmids\tname\tthumbnail\tstreamTitle',
    ...rows.map((row) =>
      [
        row.matchCount,
        row.duration,
        row.mids,
        row.name,
        row.thumbnail,
        row.streamTitle,
      ].join('\t'),
    ),
  ].join('\n') + '\n',
  'utf8',
);

const summary = rows.reduce(
  (acc, row) => {
    if (row.matchCount === 1) acc.exact += 1;
    else if (row.matchCount > 1) acc.ambiguous += 1;
    else acc.none += 1;
    return acc;
  },
  { total: rows.length, exact: 0, ambiguous: 0, none: 0 },
);

console.log(JSON.stringify(summary, null, 2));
console.log(outPath);
console.log(
  rows
    .slice(0, 80)
    .map((row) => `${row.matchCount}\t${row.duration}\t${row.mids}\t${row.name}`)
    .join('\n'),
);
