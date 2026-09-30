const fs = require('fs');
const path = require('path');
const { writeIndex, isMissingImage, savePath } = require('./download_hpm_all_content');

const root = path.resolve(__dirname, '..', 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'extra_content');
let valid = 0;
let unavailable = 0;
let entries = 0;
const emoji = new Set();
const archives = [];

for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const dir = path.join(root, dirent.name);
  const archivePath = path.join(dir, '_archive.json');
  if (!fs.existsSync(archivePath)) continue;
  const archive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
  archives.push({ dir, archivePath, archive });
  for (const entry of archive.entries) {
    for (const match of String(entry.content_text || '').matchAll(/<img\s+src="\/emoji\/emoji-images\/([A-Za-z0-9_-]+\.gif)"\s*\/?\s*>/gi)) emoji.add(match[1]);
    const saved = [];
    const missing = [];
    for (const material of entry.materials || []) {
      if (!material.material_id) continue;
      const file = savePath(dir, entry.content_id, material);
      if (fs.existsSync(file) && !isMissingImage(fs.readFileSync(file))) {
        saved.push(path.relative(dir, file).replace(/\\/g, '/'));
        valid++;
      } else {
        missing.push(material.material_title || material.material_file);
        unavailable++;
      }
    }
    entry.saved_materials = saved;
    entry.unavailable_materials = missing;
    entries++;
  }
}

async function main() {
  const emojiDir = path.join(root, 'emoji');
  fs.mkdirSync(emojiDir, { recursive: true });
  const pending = [...emoji].filter(name => !fs.existsSync(path.join(emojiDir, name)));
  let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < pending.length) {
      const name = pending[next++];
      try {
        const response = await fetch(`https://helloproject-mobile.com/emoji/emoji-images/${name}`);
        if (!response.ok || !String(response.headers.get('content-type')).startsWith('image/')) continue;
        fs.writeFileSync(path.join(emojiDir, name), Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        console.warn(`emoji ${name}: ${error.message}`);
      }
    }
  }));
  for (const { dir, archivePath, archive } of archives) {
    fs.writeFileSync(archivePath, JSON.stringify(archive, null, 2), 'utf8');
    writeIndex(dir, archive.label, archive.entries);
    console.log(`${archive.label}: ${archive.entries.length} entries`);
  }
  console.log(JSON.stringify({ entries, valid_images: valid, unavailable_images: unavailable, emoji: emoji.size, emoji_saved: emoji.size - pending.filter(name => !fs.existsSync(path.join(emojiDir, name))).length }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
