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
const planPath = path.join(root, '_mousou_member_fill_plan.tsv');
const dir = path.join(root, '妄想動画');

function parseTsv(text) {
  const [header, ...lines] = text.trimEnd().split(/\r?\n/);
  const keys = header.split('\t');
  return lines.map((line) => {
    const values = line.split('\t');
    return Object.fromEntries(keys.map((key, index) => [key, values[index] || '']));
  });
}

function safeName(value) {
  return String(value || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
}

function uniquePath(file) {
  if (!fs.existsSync(file)) return file;
  const ext = path.extname(file);
  const base = file.slice(0, -ext.length);
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base} (${i})${ext}`;
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not find unique name for ${file}`);
}

function isSafe(row) {
  if (!row.member) return false;
  if (row.reason.startsWith('between same member')) return true;
  const match = row.reason.match(/same title .*mid(\d+)/);
  if (match && Math.abs(Number(row.mid) - Number(match[1])) <= 10) return true;
  return false;
}

const rows = parseTsv(fs.readFileSync(planPath, 'utf8'));
const applied = [];
const skipped = [];

for (const row of rows) {
  if (!isSafe(row)) {
    skipped.push(row);
    continue;
  }
  const oldPath = path.join(dir, row.name);
  if (!fs.existsSync(oldPath)) {
    skipped.push({ ...row, skipReason: 'missing file' });
    continue;
  }
  const newName = row.name.replace(/ -\.mp4$/, ` - ${safeName(row.member)}.mp4`);
  const newPath = uniquePath(path.join(dir, newName));
  fs.renameSync(oldPath, newPath);
  applied.push({ ...row, oldName: row.name, newName: path.basename(newPath) });
}

const reportPath = path.join(root, '_mousou_member_fill_safe_applied.tsv');
fs.writeFileSync(
  reportPath,
  [
    'mid\ttitle\tmember\treason\toldName\tnewName',
    ...applied.map((row) =>
      [row.mid, row.title, row.member, row.reason, row.oldName, row.newName].join('\t'),
    ),
  ].join('\n') + '\n',
  'utf8',
);

const remainingPath = path.join(root, '_mousou_member_fill_remaining.tsv');
fs.writeFileSync(
  remainingPath,
  [
    'mid\tdate\ttitle\tmemberCandidate\tconfidence\treason\tbefore\tafter\tname',
    ...skipped.map((row) =>
      [
        row.mid,
        row.date,
        row.title,
        row.member,
        row.confidence,
        row.reason || row.skipReason || '',
        row.before,
        row.after,
        row.name,
      ].join('\t'),
    ),
  ].join('\n') + '\n',
  'utf8',
);

console.log(`applied=${applied.length}`);
console.log(`remaining=${skipped.length}`);
console.log(reportPath);
console.log(remainingPath);
console.log(applied.map((row) => `mid${row.mid} ${row.title} => ${row.member}`).join('\n'));
