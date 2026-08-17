const fs = require('fs');
const path = require('path');

const OUT = path.resolve('outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'radio');
const MANIFEST_PATH = path.join(OUT, 'radio_manifest.json');
const LOG_DIR = path.resolve('work', 'radio_upload_logs');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const byName = new Map(manifest.items.map((item) => [item.file_name, item]));
const links = new Map();

for (const entry of fs.readdirSync(LOG_DIR, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.log')) continue;
  const text = fs.readFileSync(path.join(LOG_DIR, entry.name), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^200\s+(https:\/\/s3\.us\.archive\.org\/([^/]+)\/(.+))$/);
    if (!match) continue;
    const archiveItem = match[2];
    const fileName = decodeURIComponent(match[3]);
    links.set(fileName, {
      archive_item: archiveItem,
      audio_url: `https://archive.org/download/${archiveItem}/${encodeURIComponent(fileName)}`,
    });
  }
}

let linked = 0;
const counts = {};
for (const [fileName, link] of links) {
  const item = byName.get(fileName);
  if (!item) continue;
  item.archive_item = link.archive_item;
  item.audio_url = link.audio_url;
  linked += 1;
  counts[item.program] = (counts[item.program] || 0) + 1;
}

manifest.generated_at = new Date().toISOString();
fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ linked, counts }, null, 2));
