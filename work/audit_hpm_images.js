const fs = require('fs');
const path = require('path');
const { isMissingImage, savePath } = require('./download_hpm_all_content');

const site = path.resolve(__dirname, '..', 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com');
const extra = path.join(site, 'extra_content');
const report = { generated_at: new Date().toISOString(), categories: [], tour_diary: null };

for (const item of fs.readdirSync(extra, { withFileTypes: true })) {
  if (!item.isDirectory()) continue;
  const dir = path.join(extra, item.name);
  const archivePath = path.join(dir, '_archive.json');
  if (!fs.existsSync(archivePath)) continue;
  const archive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
  const category = { label: archive.label, entries: archive.entries.length, images: 0, saved: 0, missing: [] };
  for (const entry of archive.entries) {
    for (const material of entry.materials || []) {
      if (!material.material_id) continue;
      category.images++;
      const file = savePath(dir, entry.content_id, material);
      if (fs.existsSync(file) && !isMissingImage(fs.readFileSync(file))) category.saved++;
      else category.missing.push({ content_id: entry.content_id, title: entry.content_title, material_id: material.material_id, filename: material.material_title });
    }
  }
  report.categories.push(category);
}

const tour = path.join(site, 'tour_diary');
const archive = JSON.parse(fs.readFileSync(path.join(tour, '_tour_diary_archive.json'), 'utf8'));
const tourResult = { entries: archive.entries.length, images: 0, saved: 0, missing: [] };
for (const entry of archive.entries) {
  for (const material of entry.detail?.materials || []) {
    if (!material.material_id) continue;
    tourResult.images++;
    const file = material.saved?.local_path && path.join(tour, material.saved.local_path);
    if (file && fs.existsSync(file) && !isMissingImage(fs.readFileSync(file))) tourResult.saved++;
    else tourResult.missing.push({ content_id: entry.detail.content_id, title: entry.detail.content_title, material_id: material.material_id, filename: material.material_title });
  }
}
report.tour_diary = tourResult;
fs.writeFileSync(path.join(extra, '_image_recovery_report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({ extra_saved: report.categories.reduce((n, c) => n + c.saved, 0), extra_images: report.categories.reduce((n, c) => n + c.images, 0), tour_saved: tourResult.saved, tour_images: tourResult.images }));
