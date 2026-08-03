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
const orderPath = path.join(root, '_hidden_current_files_mid_order.tsv');
const manifestPath = path.join(root, '_hello_movie_manifest.json');

function parseTsv(text) {
  const [header, ...lines] = text.trimEnd().split(/\r?\n/);
  const keys = header.split('\t');
  return lines.map((line) => {
    const values = line.split('\t');
    return Object.fromEntries(keys.map((key, index) => [key, values[index] || '']));
  });
}

function norm(value) {
  return String(value || '')
    .replace(/[〜～]/g, 'ー')
    .replace(/\s+/g, '')
    .replace(/[.。…]+$/g, '')
    .replace(/[！!？?]/g, '')
    .normalize('NFKC');
}

const hiddenRows = parseTsv(fs.readFileSync(orderPath, 'utf8')).filter(
  (row) => row.category === '妄想動画' && row.name.endsWith(' -.mp4'),
);
const manifest = Object.values(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).done)
  .filter((item) => item.category_title === '妄想動画')
  .map((item) => ({
    mid: Number(item.movie_id),
    content_id: item.content_id,
    title: item.title,
    member: item.member,
    date: String(item.release_date || '').slice(0, 10),
  }))
  .sort((a, b) => a.mid - b.mid);

const officialByTitle = new Map();
for (const item of manifest) {
  const key = norm(item.title);
  if (!officialByTitle.has(key)) officialByTitle.set(key, []);
  officialByTitle.get(key).push(item);
}

const planned = [];
for (const row of hiddenRows) {
  const mid = Number(row.mid);
  const title = row.name.replace(/^\d{4}-\d{2}-\d{2} - /, '').replace(/ -\.mp4$/, '').replace(/ \(\d+\)$/, '');
  const date = row.name.slice(0, 10);
  const titleMatches = officialByTitle.get(norm(title)) || [];
  const exactTitle = titleMatches.filter((item) => item.member);
  const before = [...manifest].reverse().find((item) => item.mid < mid);
  const after = manifest.find((item) => item.mid > mid);
  let member = '';
  let confidence = '';
  let reason = '';
  if (exactTitle.length === 1) {
    member = exactTitle[0].member;
    confidence = 'high';
    reason = `same title content${exactTitle[0].content_id}/mid${exactTitle[0].mid}`;
  } else if (before && after && before.member === after.member && Math.abs(before.mid - mid) <= 3 && Math.abs(after.mid - mid) <= 3) {
    member = before.member;
    confidence = 'high';
    reason = `between same member mid${before.mid} and mid${after.mid}`;
  } else if (before && Math.abs(before.mid - mid) <= 1) {
    member = before.member;
    confidence = 'medium';
    reason = `adjacent after official mid${before.mid}`;
  } else if (after && Math.abs(after.mid - mid) <= 1) {
    member = after.member;
    confidence = 'medium';
    reason = `adjacent before official mid${after.mid}`;
  }
  planned.push({
    mid,
    date,
    title,
    member,
    confidence,
    reason,
    before: before ? `mid${before.mid}:${before.member}:${before.title}` : '',
    after: after ? `mid${after.mid}:${after.member}:${after.title}` : '',
    name: row.name,
  });
}

const out = path.join(root, '_mousou_member_fill_plan.tsv');
fs.writeFileSync(
  out,
  [
    'mid\tdate\ttitle\tmember\tconfidence\treason\tbefore\tafter\tname',
    ...planned.map((row) =>
      [
        row.mid,
        row.date,
        row.title,
        row.member,
        row.confidence,
        row.reason,
        row.before,
        row.after,
        row.name,
      ].join('\t'),
    ),
  ].join('\n') + '\n',
  'utf8',
);

const counts = planned.reduce((acc, row) => {
  acc[row.confidence || 'blank'] = (acc[row.confidence || 'blank'] || 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify(counts, null, 2));
console.log(out);
console.log(
  planned
    .filter((row) => row.member)
    .slice(0, 120)
    .map((row) => `${row.confidence}\tmid${row.mid}\t${row.title}\t=> ${row.member}\t${row.reason}`)
    .join('\n'),
);
