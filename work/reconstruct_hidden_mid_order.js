const fs = require('fs');
const path = require('path');

const root = path.resolve(
  __dirname,
  '..',
  'outputs',
  'helloproject-mobile-archive',
  'helloproject-mobile.com',
  'hello_movie_sorted',
);
const candidates = JSON.parse(
  fs.readFileSync(path.join(root, '_hidden_movie_mid_candidates.json'), 'utf8'),
).short_candidates;

const dirs = ['妄想動画', 'プロフィールムービー'];
const files = [];
for (const dirName of dirs) {
  const dir = path.join(root, dirName);
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.mp4')) continue;
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.mtime < new Date('2026-08-01T02:10:00Z')) continue;
    files.push({ dirName, name, file, mtime: stat.mtimeMs });
  }
}
files.sort((a, b) => a.mtime - b.mtime || a.name.localeCompare(b.name, 'ja'));

const rows = files.map((file, index) => {
  const item = candidates[index] || {};
  return {
    index,
    mid: item.mid || '',
    insertDate: item.insert_date || '',
    duration: item.duration || '',
    category: file.dirName,
    name: file.name,
    thumbnail: item.thumbnail_url || '',
    streamTitle: item.title || '',
  };
});

const outPath = path.join(root, '_hidden_current_files_mid_order.tsv');
fs.writeFileSync(
  outPath,
  [
    'index\tmid\tinsertDate\tduration\tcategory\tname\tthumbnail\tstreamTitle',
    ...rows.map((row) =>
      [
        row.index,
        row.mid,
        row.insertDate,
        row.duration,
        row.category,
        row.name,
        row.thumbnail,
        row.streamTitle,
      ].join('\t'),
    ),
  ].join('\n') + '\n',
  'utf8',
);

console.log(`files=${files.length} candidates=${candidates.length}`);
console.log(outPath);
console.log(
  rows
    .filter((row) => row.category === '妄想動画' && / -\.mp4$/.test(row.name))
    .slice(0, 80)
    .map((row) => `${row.mid}\t${row.insertDate}\t${row.duration}\t${row.name}`)
    .join('\n'),
);
