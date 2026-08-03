const fs = require('fs');
const path = require('path');

const siteRoot = 'C:/Users/misuz/Documents/Codex/2026-07-31/http-helloproject-mobile-com/outputs/helloproject-mobile-archive/helloproject-mobile.com';
const sourceDirs = ['music_named', 'music_named_short', 'music_named_flat'].map((d) => path.join(siteRoot, d));
const outRoot = path.join(siteRoot, 'music_radio_organized');
const reportsRoot = path.join(siteRoot, 'music_data', 'stream_api');

function clean(value, max = 120) {
  return String(value || 'unknown')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'unknown';
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, files);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp4')) files.push(p);
  }
  return files;
}

function mojibakePenalty(text) {
  const s = String(text);
  const bad = (s.match(/[繧縺譁隨蟯螟蜷逕荳鬟鬆譛莨螂闕陦蛹蜃]+/g) || []).join('').length;
  const replacement = (s.match(/[�]/g) || []).length * 5;
  const japanese = (s.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
  return bad + replacement - japanese * 0.4;
}

function quality(item) {
  const rel = item.path.replace(siteRoot, '');
  let score = item.size / 1024 / 1024;
  score -= mojibakePenalty(rel) * 10;
  if (rel.includes('music_named\\')) score += 500;
  if (rel.includes('music_named_short\\')) score += 100;
  return score;
}

function programFromPath(file) {
  const rel = path.relative(siteRoot, file);
  const parts = rel.split(path.sep);
  if (parts[0] === 'music_named' && parts.length > 2) {
    const program = clean(parts[1], 80);
    return /^_+$/.test(program) ? 'プレイリスト' : program;
  }
  if (parts[0] === 'music_named_short' && parts.length > 2) {
    const program = clean(parts[1], 80);
    return /^_+$/.test(program) ? 'プレイリスト' : program;
  }
  const base = path.basename(file, '.mp4');
  const beforeMid = base.replace(/\s*\[mid\d+\].*$/, '');
  const first = beforeMid.split(' - ')[0];
  if (first && !/^\d+$/.test(first)) return clean(first, 80);
  return 'その他・プレイリスト';
}

function sameFile(a, b) {
  try {
    const sa = fs.statSync(a);
    const sb = fs.statSync(b);
    return sa.dev === sb.dev && sa.ino === sb.ino;
  } catch {
    return false;
  }
}

fs.mkdirSync(outRoot, { recursive: true });
fs.mkdirSync(reportsRoot, { recursive: true });

const byMid = new Map();
for (const dir of sourceDirs) {
  for (const file of walk(dir)) {
    const name = path.basename(file);
    const match = name.match(/\[mid(\d+)\]/);
    if (!match) continue;
    const mid = match[1];
    const item = { mid, path: file, name, size: fs.statSync(file).size };
    if (!byMid.has(mid)) byMid.set(mid, []);
    byMid.get(mid).push(item);
  }
}

const selected = [];
const duplicates = [];
for (const [mid, items] of byMid) {
  items.sort((a, b) => quality(b) - quality(a));
  selected.push(items[0]);
  for (const extra of items.slice(1)) duplicates.push({ mid, kept: items[0].path, duplicate: extra.path, size: extra.size });
}
selected.sort((a, b) => Number(b.mid) - Number(a.mid));

let linked = 0;
let already = 0;
let replaced = 0;
const manifest = [];
for (const item of selected) {
  const program = programFromPath(item.path);
  const dir = path.join(outRoot, program);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, clean(item.name, 180));
  if (fs.existsSync(dest)) {
    if (!sameFile(item.path, dest)) {
      fs.rmSync(dest, { force: true });
      fs.linkSync(item.path, dest);
      replaced++;
    } else {
      already++;
    }
  } else {
    fs.linkSync(item.path, dest);
    linked++;
  }
  manifest.push({ mid: item.mid, program, file: dest, source: item.path, size: item.size });
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

const manifestCsv = ['mid,program,file,source,size_bytes']
  .concat(manifest.map((r) => [r.mid, r.program, r.file, r.source, r.size].map(csvCell).join(',')))
  .join('\r\n');
fs.writeFileSync(path.join(reportsRoot, '_radio_organized_manifest.csv'), manifestCsv, 'utf8');

const duplicateCsv = ['mid,kept,duplicate,size_bytes']
  .concat(duplicates.map((r) => [r.mid, r.kept, r.duplicate, r.size].map(csvCell).join(',')))
  .join('\r\n');
fs.writeFileSync(path.join(reportsRoot, '_radio_duplicate_report.csv'), duplicateCsv, 'utf8');

const summary = {
  source_files: [...byMid.values()].reduce((sum, items) => sum + items.length, 0),
  unique_mids: byMid.size,
  duplicate_extra_files: duplicates.length,
  organized_files: manifest.length,
  linked,
  already,
  replaced,
  outRoot,
  manifest: path.join(reportsRoot, '_radio_organized_manifest.csv'),
  duplicateReport: path.join(reportsRoot, '_radio_duplicate_report.csv'),
  updated: new Date().toISOString(),
};
fs.writeFileSync(path.join(reportsRoot, '_radio_organized_summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify(summary, null, 2));
