const fs = require('fs');
const path = require('path');
const { writeIndex, isMissingImage, savePath } = require('./download_hpm_all_content');

const root = path.resolve(__dirname, '..', 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'extra_content');
let valid = 0;
let unavailable = 0;
let entries = 0;

for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const dir = path.join(root, dirent.name);
  const archivePath = path.join(dir, '_archive.json');
  if (!fs.existsSync(archivePath)) continue;
  const archive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
  for (const entry of archive.entries) {
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
  fs.writeFileSync(archivePath, JSON.stringify(archive, null, 2), 'utf8');
  writeIndex(dir, archive.label, archive.entries);
  console.log(`${archive.label}: ${archive.entries.length} entries`);
}

console.log(JSON.stringify({ entries, valid_images: valid, unavailable_images: unavailable }));
