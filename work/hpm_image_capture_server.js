const fs = require('fs');
const path = require('path');
const http = require('http');
const { isMissingImage, savePath } = require('./download_hpm_all_content');

const site = path.resolve(__dirname, '..', 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com');
const extra = path.join(site, 'extra_content');
const statePath = path.join(__dirname, 'hpm_image_capture_state.json');
const routes = { 3: '/dialy/member', 16: '/content/artist3', 18: '/content/manga', 19: '/content/artist4', 21: '/content/artist6', 22: '/content/artist7', 23: '/content/artist8', 24: '/content/artist9', 27: '/content/artist11' };

function needsImage(file) {
  return !fs.existsSync(file) || isMissingImage(fs.readFileSync(file));
}

const queue = [];
for (const dirent of fs.readdirSync(extra, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const dir = path.join(extra, dirent.name);
  const archivePath = path.join(dir, '_archive.json');
  if (!fs.existsSync(archivePath)) continue;
  const archive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
  const menu = Number(archive.menu_id);
  for (const entry of archive.entries) {
    const materials = (entry.materials || []).filter(m => m.material_id);
    if (!materials.some(m => needsImage(savePath(dir, entry.content_id, m)))) continue;
    const rawPath = path.join(dir, '_raw_json', `detail_${entry.content_id}.json`);
    const list = fs.existsSync(rawPath) ? JSON.parse(fs.readFileSync(rawPath, 'utf8')).list : entry;
    const index = Number(list.idx || entry.idx);
    const u = new URL(`${routes[menu]}/detail`, 'http://helloproject-mobile.com');
    u.searchParams.set('menu_id', String(menu));
    u.searchParams.set('content_id', String(entry.content_id));
    u.searchParams.set('category_id', String(entry.category_id));
    u.searchParams.set('idx', String(index));
    u.searchParams.set('page', String(Math.floor((index - 1) / 20) + 1));
    u.searchParams.set('backup_expected', String(materials.length));
    queue.push(u.href);
  }
}

const tour = path.join(site, 'tour_diary');
const tourArchive = JSON.parse(fs.readFileSync(path.join(tour, '_tour_diary_archive.json'), 'utf8'));
for (const entry of tourArchive.entries) {
  const detail = entry.detail || entry.list;
  const materials = (detail.materials || []).filter(m => m.material_id);
  if (!materials.some(m => !m.saved?.local_path || needsImage(path.join(tour, m.saved.local_path)))) continue;
  const u = new URL('/dialy/tour/detail', 'http://helloproject-mobile.com');
  u.searchParams.set('menu_id', '2');
  u.searchParams.set('content_id', String(detail.content_id));
  u.searchParams.set('category_id', String(entry.category.category_id));
  const index = Number(entry.list.idx || detail.idx);
  u.searchParams.set('idx', String(index));
  u.searchParams.set('page', String(Math.floor((index - 1) / 20) + 1));
  u.searchParams.set('backup_expected', String(materials.length));
  queue.push(u.href);
}

let pointer = 0;
if (fs.existsSync(statePath)) {
  const saved = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (saved.total === queue.length) pointer = Math.min(saved.pointer || 0, queue.length);
}

const server = http.createServer((req, res) => {
  if (req.url === '/next') {
    if (pointer >= queue.length) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end('complete');
      return;
    }
    const target = queue[pointer++];
    fs.writeFileSync(statePath, JSON.stringify({ pointer, total: queue.length, last: target }));
    res.writeHead(302, { location: target, 'cache-control': 'no-store' });
    res.end();
    return;
  }
  if (req.url === '/status') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ pointer, total: queue.length }));
    return;
  }
  res.writeHead(404);
  res.end();
});

async function refreshIndices() {
  const cache = new Map();
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  async function list(category, page) {
    const key = `${category}:${page}`;
    if (!cache.has(key)) {
      cache.set(key, fetch(`http://helloproject-mobile.com/api/contents?category_id=${category}&page=${page}`, { headers: { 'user-agent': ua } })
        .then(r => r.json()).then(j => j.contents || []).catch(() => []));
    }
    return cache.get(key);
  }
  for (let i = 0; i < queue.length; i++) {
    const u = new URL(queue[i]);
    const category = u.searchParams.get('category_id');
    const id = u.searchParams.get('content_id');
    const page = Number(u.searchParams.get('page'));
    for (const candidatePage of [page, page + 1, page - 1].filter(p => p > 0)) {
      const entry = (await list(category, candidatePage)).find(item => String(item.content_id) === id);
      if (!entry) continue;
      const index = Number(entry.idx);
      u.searchParams.set('idx', String(index));
      u.searchParams.set('page', String(Math.floor((index - 1) / 20) + 1));
      queue[i] = u.href;
      break;
    }
  }
}

refreshIndices().then(() => server.listen(8765, '127.0.0.1', () => console.log(JSON.stringify({ port: 8765, pointer, total: queue.length }))));
