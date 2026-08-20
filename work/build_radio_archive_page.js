const fs = require('fs');
const path = require('path');

const RADIO_ROOT = 'C:\\Users\\misuz\\Desktop\\RADIO\\ハロモバラジオ';
const OUT = path.resolve('outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'radio');
const MANIFEST_PATH = path.join(OUT, 'radio_manifest.json');
const previousLinks = new Map();
if (fs.existsSync(MANIFEST_PATH)) {
  try {
    const previous = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    for (const item of previous.items || []) {
      previousLinks.set(item.local_path, { audio_url: item.audio_url || '', archive_item: item.archive_item || '' });
    }
  } catch {
    // Rebuild from local files if the old manifest is incomplete.
  }
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function parseFile(file) {
  const name = path.basename(file);
  const folder = path.basename(path.dirname(file));
  const stat = fs.statSync(file);
  const title = name.replace(/\.[^.]+$/, '');
  const order = Number((title.match(/^(\d+)/) || [])[1] || 0);
  const episode = Number((title.match(/第(\d+)回/) || [])[1] || 0);
  const part = Number((title.match(/#(\d+)/) || [])[1] || 0);
  const date = (title.match(/【([^】]+)】/) || [])[1] || '';
  const host = (title.match(/】 - ([^\[]+)/) || [])[1]?.trim() || '';
  const guest = (title.match(/ゲスト[：:_]([^【]+)/) || [])[1]?.trim() || '';
  const mid = (title.match(/\[mid(\d+)\]/i) || [])[1] || '';
  const cleanTitle = title
    .replace(/^\d+\s*-\s*/, '')
    .replace(/\s*\[mid\d+\]\s*$/i, '');
  const previous = previousLinks.get(file) || {};
  return {
    program: folder,
    title: cleanTitle,
    episode,
    part,
    date,
    host,
    guest,
    mid,
    order,
    file_name: name,
    local_path: file,
    size: stat.size,
    size_mb: Math.round((stat.size / 1024 / 1024) * 10) / 10,
    audio_url: previous.audio_url || '',
    archive_item: previous.archive_item || '',
  };
}

function compareItem(a, b) {
  return (a.program.localeCompare(b.program, 'ja') ||
    a.episode - b.episode ||
    a.part - b.part ||
    a.order - b.order ||
    a.file_name.localeCompare(b.file_name, 'ja'));
}

fs.mkdirSync(OUT, { recursive: true });
const files = walk(RADIO_ROOT).filter((file) => /\.(mp4|m4a|mp3|aac)$/i.test(file));
const items = files.map(parseFile).sort(compareItem);
const programs = [...new Set(items.map((item) => item.program))].sort((a, b) => a.localeCompare(b, 'ja'));
const totalBytes = items.reduce((sum, item) => sum + item.size, 0);
const manifest = {
  generated_at: new Date().toISOString(),
  source_root: RADIO_ROOT,
  note: 'GitHub Pagesには音源本体を置かず、Internet Archiveなどにアップロード後 audio_url / archive_item を埋めるための目録です。',
  total_files: items.length,
  total_gb: Math.round((totalBytes / 1024 / 1024 / 1024) * 100) / 100,
  programs: programs.map((program) => {
    const rows = items.filter((item) => item.program === program);
    return {
      program,
      files: rows.length,
      episodes: new Set(rows.map((item) => item.episode).filter(Boolean)).size,
      size_gb: Math.round((rows.reduce((sum, item) => sum + item.size, 0) / 1024 / 1024 / 1024) * 100) / 100,
    };
  }),
  items,
};
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

const programOptions = programs.map((program) => `<option value="${esc(program)}">${esc(program)}</option>`).join('');

const episodeMap = new Map();
for (const item of items) {
  const key = `${item.program}\u0000${item.episode || item.order}`;
  if (!episodeMap.has(key)) episodeMap.set(key, []);
  episodeMap.get(key).push(item);
}
const episodes = [...episodeMap.values()].map((tracks) => tracks.sort(compareItem)).sort((a, b) => compareItem(a[0], b[0]));
const playableEpisodes = episodes.filter((tracks) => tracks.some((item) => item.audio_url)).length;
const playableTracks = items.filter((item) => item.audio_url).length;

function compactTitle(tracks) {
  const first = tracks[0];
  const guest = first.guest ? ` ゲスト：${first.guest}` : '';
  return `${first.program} - ${first.episode ? `第${first.episode}回` : first.title}${guest}`;
}

function trackButton(item, index) {
  const label = item.part ? `#${item.part}` : `${index + 1}`;
  const disabled = item.audio_url ? '' : ' disabled';
  const url = item.audio_url ? ` data-url="${esc(item.audio_url)}"` : '';
  return `<button class="track-button" type="button"${disabled}${url} data-title="${esc(item.title)}">${esc(label)}<small>${esc(item.size_mb)}MB</small></button>`;
}

const rows = episodes.map((tracks) => {
  const first = tracks[0];
  const playable = tracks.filter((item) => item.audio_url);
  const search = tracks.map((item) => `${item.program} ${item.title} ${item.date} ${item.host} ${item.guest} mid${item.mid}`).join(' ');
  const date = [...new Set(tracks.map((item) => item.date).filter(Boolean))].join(' / ');
  const host = [...new Set(tracks.flatMap((item) => [item.host, item.guest].filter(Boolean)))].join(' / ');
  const mids = tracks.map((item) => item.mid).filter(Boolean).join(', ');
  return `<article class="radio-card" data-program="${esc(first.program)}" data-search="${esc(search)}" data-episode="${first.episode || 0}">
  <header>
    <div>
      <div class="meta-line">${esc(first.program)} / ${first.episode ? `第${first.episode}回` : '回不明'} / ${tracks.length}分割</div>
      <h2>${esc(compactTitle(tracks))}</h2>
    </div>
    <span class="size">${playable.length}/${tracks.length} 再生可</span>
  </header>
  <dl>
    <div><dt>配信</dt><dd>${esc(date || '-')}</dd></div>
    <div><dt>出演</dt><dd>${esc(host || '-')}</dd></div>
    <div><dt>mid</dt><dd>${esc(mids || '-')}</dd></div>
  </dl>
  <div class="player"${playable.length ? '' : ' data-empty="true"'}>
    ${playable.length ? `<button class="load-play" type="button">この回を再生</button><span>共通プレイヤーで再生します</span>` : '<span>音源アップロード後にここで再生できます</span>'}
  </div>
  <div class="track-list">${tracks.map(trackButton).join('')}</div>
  <details class="filenames"><summary>分割ファイル名</summary>${tracks.map((item) => `<p>${esc(item.file_name)}</p>`).join('')}</details>
</article>`;
}).join('\n');

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ハローラジオ アーカイブ</title>
<style>
:root{color-scheme:light;--ink:#162033;--sub:#637083;--line:#dbe3ee;--soft:#f4f7fb;--panel:#fff;--accent:#0b7fab;--accent-soft:#eef8fc}
*{box-sizing:border-box}body{margin:0;background:var(--soft);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Sans","Yu Gothic",Meiryo,sans-serif;line-height:1.7;letter-spacing:0}
a{color:inherit}.top{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.97);border-bottom:1px solid var(--line)}.top-inner{max-width:1320px;margin:auto;padding:13px 18px}
h1{margin:0 0 8px;font-size:24px;line-height:1.3}.pills{display:flex;gap:8px;flex-wrap:wrap}.pill,.link{border:1px solid var(--line);border-radius:999px;background:#fff;padding:3px 10px;color:var(--sub);font-size:13px;text-decoration:none}.link{color:#174154;font-weight:700}
main{max-width:1320px;margin:0 auto;padding:14px 18px 34px;display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px}.side{position:sticky;top:86px;align-self:start;max-height:calc(100vh - 104px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px}
.control{display:grid;gap:6px;margin-bottom:11px}.control label,.nav-title{font-size:12px;color:var(--sub);font-weight:700}.nav-title{margin:12px 0 6px}.side input,.side select{width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 10px;font-size:15px;background:#fff}.side button{border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 10px;color:var(--ink);font-size:13px}.archive-link{display:flex;align-items:center;gap:7px;width:100%;min-height:34px;margin-bottom:7px;padding:7px 8px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);font-size:13px;text-decoration:none}.archive-link span{width:10px;height:10px;border-radius:50%;background:var(--cat);flex:0 0 auto}.archive-link b{margin-left:auto;color:var(--sub);font-size:12px}.summary{color:var(--sub);font-size:13px}
.global-player{position:sticky;top:68px;z-index:4;max-width:1320px;margin:0 auto;padding:10px 18px;background:rgba(244,247,251,.96);border-bottom:1px solid var(--line)}.global-inner{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px}.global-player video{width:100%;height:56px;background:#101820;border-radius:6px}.global-title{font-size:13px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.global-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap}.global-nav,.global-open{border:1px solid var(--line);border-radius:999px;background:#fff;padding:7px 12px;color:#174154;text-decoration:none;font-size:13px;font-weight:700;cursor:pointer}.global-nav:disabled{opacity:.42;cursor:not-allowed}.global-open{padding:7px 12px}.radio-card{background:var(--panel);border:1px solid var(--line);border-radius:8px;margin:0 0 12px;overflow:hidden}.radio-card header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line);background:#fbfcfe}.meta-line{font-size:12px;color:var(--sub)}h2{font-size:18px;line-height:1.42;margin:2px 0 0}.size{align-self:start;color:var(--sub);font-size:12px;white-space:nowrap}dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0;padding:12px 14px}dt{color:var(--sub);font-size:12px;font-weight:700}dd{margin:0;font-size:14px;overflow-wrap:anywhere}.player{margin:0 14px 10px;padding:12px;border:1px dashed var(--line);border-radius:8px;background:var(--accent-soft);color:var(--sub);font-size:13px}.load-play{width:100%;margin:0 0 6px;border:1px solid var(--accent);border-radius:8px;background:var(--accent);color:#fff;padding:9px 12px;font-weight:700;cursor:pointer}.track-list{display:flex;gap:8px;flex-wrap:wrap;margin:0 14px 12px}.track-button{border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 10px;min-width:74px;color:var(--ink);font-weight:700;cursor:pointer}.track-button small{display:block;color:var(--sub);font-weight:400;font-size:11px}.track-button[disabled]{opacity:.45;cursor:not-allowed}.track-button.is-active{border-color:var(--accent);background:var(--accent);color:#fff}.track-button.is-active small{color:#dff7ff}.filenames{margin:0;padding:0 14px 14px;color:var(--sub);font-size:12px}.filenames summary{cursor:pointer}.filenames p{margin:5px 0;overflow-wrap:anywhere}.hidden{display:none!important}
@media(max-width:900px){body{background:#fff}.top{position:static}.top-inner{padding:12px}.global-player{position:sticky;top:0;padding:8px 10px;background:#f8fafc}.global-inner{grid-template-columns:1fr}.global-player video{height:54px}.global-actions{justify-content:stretch}.global-nav,.global-open{flex:1;text-align:center}main{display:block;padding:0;background:#fff}.side{position:static;max-height:none;border-width:0 0 1px;border-radius:0;background:#f8fafc}.radio-card{border-left:0;border-right:0;border-radius:0;margin:0}.radio-card header{grid-template-columns:1fr;padding:11px 12px}.size{justify-self:start}dl{grid-template-columns:1fr;padding:10px 12px}.player{margin:0 12px 10px}.track-list{margin:0 12px 12px}.track-button{flex:1 1 76px}.filenames{padding:0 12px 12px}}
</style>
</head>
<body>
<header class="top"><div class="top-inner">
  <h1>ハローラジオ アーカイブ</h1>
  <div class="pills">
    <span class="pill">音源 ${playableTracks}/${items.length}本 再生可</span>
    <span class="pill">回 ${playableEpisodes}/${episodes.length}件 再生可</span>
    <span class="pill">番組 ${programs.length}件</span>
    <span class="pill">合計 ${manifest.total_gb}GB</span>
    <a class="link" href="../../../../index.html">トップ</a>
    <a class="link" href="../hello_qa/index.html">ハロー！Q&amp;A</a>
    <a class="link" href="../hello_pedia/index.html">ハローペディア</a>
    <a class="link" href="../mail/index.html">メール</a>
  </div>
</div></header>
<section class="global-player">
  <div class="global-inner">
    <div>
      <video id="globalMedia" controls playsinline preload="none"></video>
      <div id="globalTitle" class="global-title">再生する回または # を選んでください</div>
    </div>
    <div class="global-actions">
      <button id="globalPrev" class="global-nav" type="button" disabled>前へ</button>
      <button id="globalNext" class="global-nav" type="button" disabled>次へ</button>
      <a id="globalOpen" class="global-open" href="#" target="_blank" rel="noopener noreferrer">直接開く</a>
    </div>
  </div>
</section>
<main>
<aside class="side">
  <div class="nav-title">他のアーカイブ</div>
  <a class="archive-link" style="--cat:#127e97" href="../hello_qa/index.html"><span></span><strong>ハロー！Q&amp;A</strong><b>開く</b></a>
  <a class="archive-link" style="--cat:#127e97" href="../hello_pedia/index.html"><span></span><strong>ハローペディア</strong><b>開く</b></a>
  <a class="archive-link" style="--cat:#4a88c7" href="../hello_pedia/media.html"><span></span><strong>妄想動画</strong><b>開く</b></a>
  <a class="archive-link" style="--cat:#d15f2f" href="../tour_diary/index.html"><span></span><strong>ツアー日記</strong><b>開く</b></a>
  <a class="archive-link" style="--cat:#6b63b5" href="../special_events/index.html"><span></span><strong>特設イベント</strong><b>開く</b></a>
  <a class="archive-link" style="--cat:#0b7fab" href="../mail/index.html"><span></span><strong>メール</strong><b>開く</b></a>
  <div class="nav-title">絞り込み</div>
  <div class="control"><label for="q">検索</label><input id="q" type="search" placeholder="番組、回、出演者、mid"></div>
  <div class="control"><label for="program">番組</label><select id="program"><option value="">すべて</option>${programOptions}</select></div>
  <button id="clear">クリア</button>
  <p id="summary" class="summary"></p>
</aside>
<section id="list">${rows}</section>
</main>
<script>
const q=document.getElementById('q'), program=document.getElementById('program'), clear=document.getElementById('clear'), summary=document.getElementById('summary');
const cards=[...document.querySelectorAll('.radio-card')];
const media=document.getElementById('globalMedia');
const globalTitle=document.getElementById('globalTitle');
const globalOpen=document.getElementById('globalOpen');
const globalPrev=document.getElementById('globalPrev');
const globalNext=document.getElementById('globalNext');
const allTracks=[...document.querySelectorAll('.track-button:not([disabled])')];
let activeTrack=null;
let preloadMedia=null;
function trackIndex(){
  return allTracks.indexOf(activeTrack);
}
function updateNav(){
  const current=trackIndex();
  if(globalPrev) globalPrev.disabled=current<=0;
  if(globalNext) globalNext.disabled=current<0||current>=allTracks.length-1;
}
function preloadNext(){
  if(!activeTrack) return;
  const current=trackIndex();
  const next=allTracks[current+1];
  if(!next||!next.dataset.url) return;
  if(!preloadMedia){
    preloadMedia=document.createElement('video');
    preloadMedia.preload='auto';
  }
  if(preloadMedia.src!==next.dataset.url){
    preloadMedia.src=next.dataset.url;
    preloadMedia.load();
  }
}
function activateTrack(button, play){
  if(!button||!button.dataset.url) return;
  allTracks.forEach(item=>item.classList.toggle('is-active',item===button));
  activeTrack=button;
  if(media.src!==button.dataset.url){
    media.src=button.dataset.url;
    media.load();
  }
  if(globalTitle) globalTitle.textContent=button.dataset.title||button.textContent.trim();
  if(globalOpen) globalOpen.href=button.dataset.url;
  updateNav();
  if(play) media.play().catch(()=>{});
  preloadNext();
}
allTracks.forEach((button)=>button.addEventListener('click',()=>activateTrack(button,true)));
function moveTrack(offset){
  const current=trackIndex();
  const target=allTracks[current+offset];
  if(target) activateTrack(target,true);
}
if(globalPrev) globalPrev.addEventListener('click',()=>moveTrack(-1));
if(globalNext) globalNext.addEventListener('click',()=>moveTrack(1));
updateNav();
if(media){
  media.addEventListener('play',preloadNext);
  media.addEventListener('loadedmetadata',preloadNext);
  media.addEventListener('timeupdate',()=>{
    if(media.duration&&media.duration-media.currentTime<25) preloadNext();
  });
  media.addEventListener('ended',()=>{
    const current=trackIndex();
    const next=allTracks[current+1];
    if(next) activateTrack(next,true);
  });
}
for(const card of cards){
  const loadPlay=card.querySelector('.load-play');
  const buttons=[...card.querySelectorAll('.track-button:not([disabled])')];
  if(loadPlay){
    loadPlay.addEventListener('click',()=>{
      if(buttons[0]) activateTrack(buttons[0],true);
    });
  }
}
function apply(){
  const term=q.value.trim().toLowerCase();
  const selected=program.value;
  let shown=0;
  for(const card of cards){
    const okProgram=!selected||card.dataset.program===selected;
    const okText=!term||card.dataset.search.toLowerCase().includes(term);
    const ok=okProgram&&okText;
    card.classList.toggle('hidden',!ok);
    if(ok) shown++;
  }
  summary.textContent=shown+' / '+cards.length+'本';
}
q.addEventListener('input',apply);
program.addEventListener('change',apply);
clear.addEventListener('click',()=>{q.value='';program.value='';apply();q.focus()});
apply();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');
console.log(JSON.stringify({ files: items.length, programs: programs.length, total_gb: manifest.total_gb, out: OUT }, null, 2));
