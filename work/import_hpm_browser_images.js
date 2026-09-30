const fs = require('fs');
const path = require('path');
const { isMissingImage, savePath } = require('./download_hpm_all_content');

const site = path.resolve(__dirname, '..', 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com');
const extra = path.join(site, 'extra_content');
const bundleRoot = path.join(process.env.LOCALAPPDATA, 'Temp', 'browser-use', 'assets');
const destinations = new Map();

function add(id, file) {
  if (!destinations.has(id)) destinations.set(id, new Set());
  destinations.get(id).add(file);
}

for (const dirent of fs.readdirSync(extra, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const dir = path.join(extra, dirent.name);
  const archivePath = path.join(dir, '_archive.json');
  if (!fs.existsSync(archivePath)) continue;
  for (const entry of JSON.parse(fs.readFileSync(archivePath, 'utf8')).entries) {
    for (const material of entry.materials || []) {
      if (material.material_id) add(String(material.material_id), savePath(dir, entry.content_id, material));
    }
  }
}

const tour = path.join(site, 'tour_diary');
for (const entry of JSON.parse(fs.readFileSync(path.join(tour, '_tour_diary_archive.json'), 'utf8')).entries) {
  for (const material of (entry.detail?.materials || [])) {
    if (material.material_id && material.saved?.local_path) add(String(material.material_id), path.join(tour, material.saved.local_path));
  }
}

let imported = 0;
let already = 0;
let rejected = 0;
for (const dirent of fs.readdirSync(bundleRoot, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const manifestPath = path.join(bundleRoot, dirent.name, 'manifest.json');
  if (!fs.existsSync(manifestPath)) continue;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const asset of manifest.assets || []) {
    if (!asset.url.startsWith('http://helloproject-mobile.com/materials/viewer?') && !asset.url.startsWith('https://helloproject-mobile.com/materials/viewer?')) continue;
    const sourceName = new URL(asset.url).searchParams.get('material_file') || '';
    const id = sourceName.match(/^[a-f0-9]{64}(\d+)\.[a-z0-9]+$/i)?.[1];
    if (!id || !destinations.has(id) || !fs.existsSync(asset.path)) continue;
    const buffer = fs.readFileSync(asset.path);
    if (isMissingImage(buffer) || buffer.length < 1000 || !/^image\//.test(asset.contentType || '')) {
      rejected++;
      continue;
    }
    for (const out of destinations.get(id)) {
      if (fs.existsSync(out) && !isMissingImage(fs.readFileSync(out))) {
        already++;
        continue;
      }
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.copyFileSync(asset.path, out);
      imported++;
    }
  }
}
console.log(JSON.stringify({ imported, already, rejected, material_ids: destinations.size }));
