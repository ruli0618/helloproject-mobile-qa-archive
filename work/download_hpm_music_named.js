const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { execFileSync } = require('child_process');

const root = 'C:/Users/misuz/Documents/Codex/2026-07-31/http-helloproject-mobile-com/outputs/helloproject-mobile-archive';
const dataRoot = path.join(root, 'helloproject-mobile.com', 'music_data');
const apiDir = path.join(dataRoot, 'stream_api');
const outRoot = path.join(root, 'helloproject-mobile.com', 'music_named_flat');
const ffmpeg = 'C:/ffmpeg/bin/ffmpeg.exe';
const minFreeBytes = 10 * 1024 * 1024 * 1024;
const concurrency = 8;

fs.mkdirSync(outRoot, { recursive: true });

const mediaRaw = JSON.parse(fs.readFileSync(path.join(apiDir, '_all_media.json'), 'utf8'));
const radio = JSON.parse(fs.readFileSync(path.join(dataRoot, 'radiolist.json'), 'utf8'));
const playlist = JSON.parse(fs.readFileSync(path.join(dataRoot, 'playlist.json'), 'utf8'));

function freeBytes() {
  try {
    return Number(execFileSync('powershell.exe', ['-NoProfile', '-Command', '(Get-PSDrive -Name C).Free'], { encoding: 'utf8' }).trim()) || 0;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function clean(value, max = 80) {
  return String(value || 'unknown')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'unknown';
}

const midContext = new Map();
for (const group of radio) {
  const section = clean(group.title, 48);
  for (const content of group.contents || []) {
    const episode = clean(content.title, 64);
    for (const item of content.list || []) {
      for (const mid of item.mids || []) {
        if (!midContext.has(String(mid))) {
          midContext.set(String(mid), { section, episode, item: clean(item.title, 40) });
        }
      }
    }
  }
}
for (const item of playlist) {
  for (const mid of item.mids || []) {
    if (!midContext.has(String(mid))) {
      midContext.set(String(mid), {
        section: 'プレイリスト',
        episode: clean(item.title, 64),
        item: clean(item.title, 40),
      });
    }
  }
}

const byMid = new Map();
for (const item of mediaRaw) {
  if (item && item.mid && item.movie_url && item.movie_url.mb_lq) {
    byMid.set(String(item.mid), item);
  }
}

function collectExistingMids() {
  const roots = [
    path.join(root, 'helloproject-mobile.com', 'music_named'),
    path.join(root, 'helloproject-mobile.com', 'music_named_short'),
    outRoot,
  ];
  const stack = roots.filter(fs.existsSync);
  const existing = new Set();
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(p);
      else if (entry.isFile() && entry.size !== 0) {
        const match = entry.name.match(/\[mid(\d+)\]/);
        if (match) existing.add(match[1]);
      }
    }
  }
  return existing;
}

const existingMids = collectExistingMids();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renameWithRetry(from, to) {
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      fs.renameSync(from, to);
      return true;
    } catch (error) {
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) throw error;
      await sleep(500 + attempt * 250);
    }
  }
  fs.copyFileSync(from, to);
  fs.rmSync(from, { force: true });
  return true;
}

async function recoverParts(dir = outRoot) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await recoverParts(p);
    } else if (entry.isFile() && entry.name.endsWith('.part.mp4')) {
      let size = 0;
      try {
        size = fs.statSync(p).size;
      } catch {
        continue;
      }
      if (size <= 10000) continue;
      const finalPath = p.replace(/\.part\.mp4$/i, '.mp4');
      if (!fs.existsSync(finalPath)) {
        try {
          await renameWithRetry(p, finalPath);
        } catch (error) {
          if (error.code === 'ENOENT') continue;
          throw error;
        }
      }
      const match = path.basename(finalPath).match(/\[mid(\d+)\]/);
      if (match) existingMids.add(match[1]);
    }
  }
}

function outputPath(item) {
  const ctx = midContext.get(String(item.mid)) || {
    section: '未分類',
    episode: clean(item.title, 64),
  };
  const section = clean(ctx.section, 48);
  const title = clean(item.title, 70);
  const artist = clean(item.custom_metadata && item.custom_metadata.Artist, 36);
  const dir = outRoot;
  fs.mkdirSync(dir, { recursive: true });
  const artistPart = artist && artist !== 'unknown' ? ` - ${artist}` : '';
  return path.join(dir, `${section} - ${String(item.mid).padStart(5, '0')} - ${title}${artistPart} [mid${item.mid}].mp4`);
}

function runFfmpeg(item, out) {
  return new Promise((resolve) => {
    const tmp = out.replace(/\.mp4$/i, '.part.mp4');
    try {
      if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
    } catch {}

    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-headers', 'Referer: http://helloproject-mobile.com/\r\nUser-Agent: Mozilla/5.0\r\n',
      '-i', item.movie_url.mb_lq,
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      '-f', 'mp4',
      tmp,
    ];

    const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      if (stderr.length < 1200) stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch {}
    }, 240000);
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(tmp) && fs.statSync(tmp).size > 10000) {
        try {
          renameWithRetry(tmp, out)
            .then(() => resolve({ ok: true }))
            .catch((error) => resolve({ ok: false, error: String(error), code }));
          return;
        } catch (error) {
          resolve({ ok: false, error: String(error), code });
        }
      } else {
        try {
          if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
        } catch {}
        resolve({ ok: false, error: stderr, code });
      }
    });
  });
}

const media = [...byMid.values()].sort((a, b) => Number(b.mid || 0) - Number(a.mid || 0));
const progressPath = path.join(apiDir, '_named_audio_progress_flat.json');
let cursor = 0;
let saved = 0;
let skipped = 0;
let failed = 0;
let attempted = 0;
let stopped = false;
const failures = [];

function writeProgress() {
  fs.writeFileSync(progressPath, JSON.stringify({
    total: media.length,
    cursor,
    saved,
    skipped,
    failed,
    attempted,
    freeBytes: freeBytes(),
    freeGb: freeBytes() / 1024 / 1024 / 1024,
    stopped,
    failures,
    updated: new Date().toISOString(),
  }, null, 2));
}

async function worker() {
  while (!stopped && cursor < media.length) {
    const item = media[cursor++];
    if (existingMids.has(String(item.mid))) {
      skipped++;
      continue;
    }
    if (freeBytes() < minFreeBytes) {
      stopped = true;
      break;
    }
    attempted++;
    const out = outputPath(item);
    const result = await runFfmpeg(item, out);
    if (result.ok) {
      saved++;
      existingMids.add(String(item.mid));
    } else {
      failed++;
      if (failures.length < 200) {
        failures.push({
          mid: item.mid,
          title: item.title,
          url: item.movie_url.mb_lq,
          error: (result.error || '').slice(0, 600),
          code: result.code,
        });
      }
    }
    if ((saved + failed) % 40 === 0) {
      writeProgress();
      console.log(JSON.stringify({
        cursor,
        saved,
        skipped,
        failed,
        attempted,
        freeGb: (freeBytes() / 1024 / 1024 / 1024).toFixed(1),
      }));
    }
  }
}

(async () => {
  await recoverParts();
  await Promise.all(Array.from({ length: concurrency }, worker));
  writeProgress();
  console.log(JSON.stringify({
    total: media.length,
    cursor,
    saved,
    skipped,
    failed,
    attempted,
    freeGb: freeBytes() / 1024 / 1024 / 1024,
    stopped,
  }, null, 2));
})();
