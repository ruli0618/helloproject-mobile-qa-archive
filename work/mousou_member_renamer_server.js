const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.resolve(__dirname, '..');
const MOVIE_ROOT = path.join(
  ROOT,
  'outputs',
  'helloproject-mobile-archive',
  'helloproject-mobile.com',
  'hello_movie_sorted',
);
const MOUSOU_DIR = path.join(MOVIE_ROOT, '妄想動画');
const LOG_PATH = path.join(MOVIE_ROOT, '_mousou_member_renamer_log.jsonl');

const MEMBERS = [
  '嗣永桃子', '矢島舞美', '中島早貴', '鈴木愛理', '岡井千聖', '萩原舞',
  '和田彩花', '中西香菜', '竹内朱莉', '勝田里奈', '室田瑞希', '相川茉穂', '佐々木莉佳子', '上國料萌衣', '笠原桃奈', '船木結',
  '宮崎由加', '金澤朋子', '高木紗友希', '宮本佳林', '植村あかり', '稲場愛香', '梁川奈々美',
  '山岸理子', '小片リサ', '新沼希空', '谷本安美', '岸本ゆめの', '浅倉樹々', '小野瑞歩', '小野田紗栞', '秋山眞緒',
  '一岡伶奈', '島倉りか', '西田汐里', '江口紗耶', '高瀬くるみ', '前田こころ', '山﨑夢羽', '岡村美波', '清野桃々姫', '里吉うたの',
  '藤井梨央', '広瀬彩海', '野村みな美', '小川麗奈', '浜浦彩乃', '田口夏実', '和田桜子', '井上玲音',
  '譜久村聖', '生田衣梨奈', '鞘師里保', '鈴木香音', '飯窪春菜', '工藤遥', '佐藤優樹', '尾形春水', '野中美希', '牧野真莉愛', '羽賀朱音', '加賀楓', '森戸知沙希', '横山玲奈', '小田さくら', '石田亜佑美',
  '山木梨沙', '小関舞',
];

function sendJson(res, status, value) {
  const body = Buffer.from(JSON.stringify(value, null, 2), 'utf8');
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  res.end(body);
}

function safeBaseName(name) {
  return path.basename(String(name || ''));
}

function listFiles() {
  return fs.readdirSync(MOUSOU_DIR)
    .filter((name) => name.endsWith('.mp4'))
    .sort((a, b) => a.localeCompare(b, 'ja'))
    .map((name) => {
      const file = path.join(MOUSOU_DIR, name);
      const stat = fs.statSync(file);
      return {
        name,
        size: stat.size,
        missing: name.endsWith(' -.mp4'),
      };
    });
}

function uniquePath(file) {
  if (!fs.existsSync(file)) return file;
  const ext = path.extname(file);
  const base = file.slice(0, -ext.length);
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base} (${i})${ext}`;
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error('衝突回避名を作れませんでした');
}

function renameMovie(oldName, member) {
  oldName = safeBaseName(oldName);
  member = String(member || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  if (!member) throw new Error('メンバー名が空です');
  const oldPath = path.join(MOUSOU_DIR, oldName);
  if (!fs.existsSync(oldPath)) throw new Error('元ファイルが見つかりません');
  const newName = oldName.endsWith(' -.mp4')
    ? oldName.replace(/ -\.mp4$/, ` - ${member}.mp4`)
    : oldName.replace(/\.mp4$/, ` - ${member}.mp4`);
  const newPath = uniquePath(path.join(MOUSOU_DIR, newName));
  fs.renameSync(oldPath, newPath);
  fs.appendFileSync(LOG_PATH, JSON.stringify({
    at: new Date().toISOString(),
    oldName,
    newName: path.basename(newPath),
    member,
  }) + '\n', 'utf8');
  return path.basename(newPath);
}

function serveVideo(req, res, name) {
  name = safeBaseName(name);
  const file = path.join(MOUSOU_DIR, name);
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const stat = fs.statSync(file);
  const range = req.headers.range;
  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    const start = match && match[1] ? Number(match[1]) : 0;
    const end = match && match[2] ? Number(match[2]) : stat.size - 1;
    res.writeHead(206, {
      'content-type': 'video/mp4',
      'content-length': end - start + 1,
      'content-range': `bytes ${start}-${end}/${stat.size}`,
      'accept-ranges': 'bytes',
    });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'content-type': 'video/mp4',
      'content-length': stat.size,
      'accept-ranges': 'bytes',
    });
    fs.createReadStream(file).pipe(res);
  }
}

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>妄想動画 メンバー名リネーム</title>
<style>
  :root { color-scheme: light; font-family: "Meiryo", system-ui, sans-serif; background:#f5f6f8; color:#15171a; }
  body { margin:0; }
  header { height:56px; display:flex; align-items:center; justify-content:space-between; padding:0 18px; border-bottom:1px solid #d9dde4; background:#fff; position:sticky; top:0; z-index:2; }
  h1 { font-size:18px; margin:0; font-weight:700; }
  main { display:grid; grid-template-columns:minmax(260px,360px) 1fr; min-height:calc(100vh - 57px); }
  aside { border-right:1px solid #d9dde4; background:#fff; overflow:auto; max-height:calc(100vh - 57px); }
  .filters { display:flex; gap:8px; padding:10px; border-bottom:1px solid #eef0f3; }
  input, select, button { font:inherit; }
  input[type="search"] { flex:1; min-width:0; padding:8px 10px; border:1px solid #c9ced8; border-radius:6px; }
  button { border:1px solid #bcc3cf; background:#fff; border-radius:6px; padding:8px 10px; cursor:pointer; }
  button.primary { background:#1565c0; color:#fff; border-color:#1565c0; }
  button:disabled { opacity:.45; cursor:not-allowed; }
  .list button { width:100%; display:block; text-align:left; border:0; border-bottom:1px solid #eef0f3; border-radius:0; padding:10px 12px; background:#fff; }
  .list button.active { background:#e9f2ff; }
  .list small { display:block; color:#667085; margin-top:3px; }
  .work { padding:18px; display:grid; grid-template-rows:auto 1fr; gap:14px; }
  video { width:100%; max-height:62vh; background:#000; border-radius:6px; }
  .panel { background:#fff; border:1px solid #d9dde4; border-radius:8px; padding:14px; }
  .title { font-size:18px; font-weight:700; margin-bottom:8px; word-break:break-all; }
  .member-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:8px; max-height:250px; overflow:auto; padding-top:10px; }
  .member-grid button.selected { background:#e8f5e9; border-color:#2e7d32; }
  .actions { display:flex; gap:8px; margin-top:12px; align-items:center; }
  .status { color:#475467; }
  .empty { padding:30px; color:#667085; }
  @media (max-width: 820px) { main { grid-template-columns:1fr; } aside { max-height:34vh; border-right:0; border-bottom:1px solid #d9dde4; } }
</style>
</head>
<body>
<header>
  <h1>妄想動画 メンバー名リネーム</h1>
  <div class="status" id="status">読み込み中</div>
</header>
<main>
  <aside>
    <div class="filters">
      <input id="q" type="search" placeholder="タイトル検索">
      <button id="missingOnly">未入力のみ</button>
    </div>
    <div class="list" id="list"></div>
  </aside>
  <section class="work">
    <video id="video" controls playsinline></video>
    <div class="panel" id="panel">
      <div class="empty">左から動画を選んでください。</div>
    </div>
  </section>
</main>
<script>
let files = [];
let current = null;
let selectedMember = '';
let missingOnly = true;
const members = ${JSON.stringify(MEMBERS)};

const el = (id) => document.getElementById(id);
function titleOf(name) { return name.replace(/^\\d{4}-\\d{2}-\\d{2} - /,'').replace(/ -\\.mp4$/,'').replace(/\\.mp4$/,''); }
function dateOf(name) { return name.slice(0, 10); }
function renderList() {
  const q = el('q').value.trim().toLowerCase();
  const visible = files.filter(f => (!missingOnly || f.missing) && (!q || f.name.toLowerCase().includes(q)));
  el('status').textContent = '未入力 ' + files.filter(f => f.missing).length + ' / 全体 ' + files.length;
  el('list').innerHTML = visible.map(f => '<button class="' + (current?.name === f.name ? 'active' : '') + '" data-name="' + encodeURIComponent(f.name) + '"><b>' + escapeHtml(titleOf(f.name)) + '</b><small>' + dateOf(f.name) + (f.missing ? ' / 未入力' : ' / 済') + '</small></button>').join('') || '<div class="empty">該当なし</div>';
  el('list').querySelectorAll('button[data-name]').forEach(btn => btn.onclick = () => selectFile(decodeURIComponent(btn.dataset.name)));
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function renderPanel() {
  if (!current) return;
  el('panel').innerHTML = '<div class="title">' + escapeHtml(current.name) + '</div>' +
    '<input id="memberSearch" type="search" placeholder="メンバー検索 / 直接入力" value="' + escapeHtml(selectedMember) + '">' +
    '<div class="member-grid">' + members.map(m => '<button class="' + (m === selectedMember ? 'selected' : '') + '" data-member="' + escapeHtml(m) + '">' + escapeHtml(m) + '</button>').join('') + '</div>' +
    '<div class="actions"><button class="primary" id="renameBtn">この名前でリネーム</button><button id="skipBtn">次へ</button><span class="status" id="msg"></span></div>';
  el('memberSearch').oninput = e => { selectedMember = e.target.value; filterMembers(); };
  el('panel').querySelectorAll('button[data-member]').forEach(btn => btn.onclick = () => { selectedMember = btn.dataset.member; renderPanel(); });
  el('renameBtn').onclick = renameCurrent;
  el('skipBtn').onclick = nextMissing;
}
function filterMembers() {
  const q = selectedMember.toLowerCase();
  el('panel').querySelectorAll('button[data-member]').forEach(btn => {
    btn.style.display = !q || btn.dataset.member.toLowerCase().includes(q) ? '' : 'none';
  });
}
function selectFile(name) {
  current = files.find(f => f.name === name);
  selectedMember = '';
  el('video').src = '/video?name=' + encodeURIComponent(name);
  renderList();
  renderPanel();
}
function nextMissing() {
  const missing = files.filter(f => f.missing);
  if (!missing.length) return;
  const idx = current ? missing.findIndex(f => f.name === current.name) : -1;
  selectFile(missing[(idx + 1 + missing.length) % missing.length].name);
}
async function renameCurrent() {
  const member = selectedMember.trim();
  if (!current || !member) return;
  el('renameBtn').disabled = true;
  const res = await fetch('/api/rename', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ name: current.name, member }) });
  const data = await res.json();
  if (!res.ok) {
    el('msg').textContent = data.error || '失敗';
    el('renameBtn').disabled = false;
    return;
  }
  await load();
  const msg = data.newName;
  nextMissing();
  if (el('msg')) el('msg').textContent = '保存: ' + msg;
}
async function load() {
  const res = await fetch('/api/files');
  const data = await res.json();
  files = data.files;
  renderList();
}
el('q').oninput = renderList;
el('missingOnly').onclick = () => { missingOnly = !missingOnly; el('missingOnly').textContent = missingOnly ? '未入力のみ' : '全件表示'; renderList(); };
load().then(nextMissing);
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  if (req.method === 'GET' && parsed.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
    return;
  }
  if (req.method === 'GET' && parsed.pathname === '/api/files') {
    sendJson(res, 200, { files: listFiles(), members: MEMBERS });
    return;
  }
  if (req.method === 'GET' && parsed.pathname === '/video') {
    serveVideo(req, res, parsed.query.name);
    return;
  }
  if (req.method === 'POST' && parsed.pathname === '/api/rename') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const newName = renameMovie(payload.name, payload.member);
        sendJson(res, 200, { ok: true, newName });
      } catch (err) {
        sendJson(res, 400, { ok: false, error: err.message });
      }
    });
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

const port = Number(process.env.PORT || 4379);
server.listen(port, '127.0.0.1', () => {
  console.log(`mousou member renamer: http://127.0.0.1:${port}/`);
});
