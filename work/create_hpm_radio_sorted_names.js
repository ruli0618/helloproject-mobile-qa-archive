const fs = require('fs');
const path = require('path');

const siteRoot = 'C:/Users/misuz/Documents/Codex/2026-07-31/http-helloproject-mobile-com/outputs/helloproject-mobile-archive/helloproject-mobile.com';
const inRoot = path.join(siteRoot, 'music_radio_organized');
const outRoot = path.join(siteRoot, 'music_radio_sorted');
const reportsRoot = path.join(siteRoot, 'music_data', 'stream_api');

function clean(value, max = 180) {
  return String(value || 'unknown')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'unknown';
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

function parseMid(name) {
  const match = name.match(/\[mid(\d+)\]/);
  return match ? Number(match[1]) : 0;
}

function parseEpisode(name) {
  const match = name.match(/第\s*(\d+)\s*回/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function parsePart(name) {
  const match = name.match(/#\s*(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function normalizedTitle(name, program) {
  let title = path.basename(name, '.mp4');
  title = title.replace(/\s*\[mid\d+\]\s*$/i, '');
  title = title.replace(/^\d{4,6}\s*-\s*/, '');
  title = title.replace(new RegExp(`^${escapeRegExp(program)}\\s*-\\s*`), '');
  title = title.replace(/^\d{4,6}\s*-\s*/, '');
  return clean(title, 130);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sortKey(item) {
  const episode = parseEpisode(item.name);
  const part = parsePart(item.name);
  const mid = parseMid(item.name);
  if (episode !== Number.MAX_SAFE_INTEGER) return [0, episode, part, mid];
  return [1, item.title.localeCompare(item.title, 'ja'), mid, 0];
}

function compareItems(a, b) {
  const ka = sortKey(a);
  const kb = sortKey(b);
  for (let i = 0; i < ka.length; i++) {
    if (typeof ka[i] === 'string') {
      const c = ka[i].localeCompare(kb[i], 'ja', { numeric: true });
      if (c !== 0) return c;
    } else if (ka[i] !== kb[i]) {
      return ka[i] - kb[i];
    }
  }
  return a.name.localeCompare(b.name, 'ja', { numeric: true });
}

if (!fs.existsSync(inRoot)) {
  throw new Error(`Missing input folder: ${inRoot}`);
}
fs.mkdirSync(outRoot, { recursive: true });
fs.mkdirSync(reportsRoot, { recursive: true });

const manifest = [];
let linked = 0;
let replaced = 0;
let already = 0;

const programs = fs.readdirSync(inRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }));

for (const program of programs) {
  const srcDir = path.join(inRoot, program);
  const destDir = path.join(outRoot, program);
  fs.mkdirSync(destDir, { recursive: true });

  const items = fs.readdirSync(srcDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mp4'))
    .map((entry) => {
      const source = path.join(srcDir, entry.name);
      return {
        program,
        name: entry.name,
        source,
        mid: parseMid(entry.name),
        title: normalizedTitle(entry.name, program),
        size: fs.statSync(source).size,
      };
    })
    .sort(compareItems);

  const width = String(items.length).length;
  items.forEach((item, index) => {
    const seq = String(index + 1).padStart(Math.max(4, width), '0');
    const midPart = item.mid ? ` [mid${item.mid}]` : '';
    const filename = clean(`${seq} - ${program} - ${item.title}${midPart}.mp4`, 220);
    const dest = path.join(destDir, filename);

    if (fs.existsSync(dest)) {
      if (sameFile(item.source, dest)) {
        already++;
      } else {
        fs.rmSync(dest, { force: true });
        fs.linkSync(item.source, dest);
        replaced++;
      }
    } else {
      fs.linkSync(item.source, dest);
      linked++;
    }

    manifest.push({
      seq,
      program,
      mid: item.mid,
      title: item.title,
      file: dest,
      source: item.source,
      size: item.size,
    });
  });
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

const csv = ['seq,program,mid,title,file,source,size_bytes']
  .concat(manifest.map((r) => [r.seq, r.program, r.mid, r.title, r.file, r.source, r.size].map(csvCell).join(',')))
  .join('\r\n');

const manifestPath = path.join(reportsRoot, '_radio_sorted_manifest.csv');
const summaryPath = path.join(reportsRoot, '_radio_sorted_summary.json');
fs.writeFileSync(manifestPath, csv, 'utf8');
const summary = {
  sourceRoot: inRoot,
  outRoot,
  programs: programs.length,
  files: manifest.length,
  linked,
  already,
  replaced,
  manifest: manifestPath,
  updated: new Date().toISOString(),
};
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify(summary, null, 2));
