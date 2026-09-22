const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const ROOT = 'C:/Users/misuz/Desktop/RADIO/ハロモバラジオ';
const FFMPEG = 'C:/ffmpeg/bin/ffmpeg.exe';
const TOKEN = 'MDk2N0UxMTlGQ0Y4QjQ5QUZFQThEMTFGOUExOUQxMzE=';
const RADIO_JSON_URL = 'http://helloproject-mobile.com/music_data/radiolist.json';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/14E5239e Safari/602.1';

const TARGETS = [
  {
    id: 'hirai',
    directory: 'オリジナル番組「みよちゃん家の縁側」',
    program: 'オリジナル番組「みよちゃん家の縁側」',
    host: '平井美葉',
    minEpisode: 110,
  },
  {
    id: 'rokonoheya',
    directory: 'オリジナル番組「ろこの部屋」',
    program: 'オリジナル番組「ろこの部屋」',
    host: '筒井澪心',
    minEpisode: 69,
  },
];

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanFilename(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function episodeNo(title) {
  const match = stripHtml(title).match(/第(\d+)回/);
  return match ? Number(match[1]) : 0;
}

function maxSeq(dir) {
  let max = 0;
  if (!fs.existsSync(dir)) return max;
  for (const name of fs.readdirSync(dir)) {
    const match = name.match(/^(\d{4})\s+-/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

function existingMids(dir) {
  const mids = new Set();
  if (!fs.existsSync(dir)) return mids;
  for (const name of fs.readdirSync(dir)) {
    const match = name.match(/\[mid(\d+)\]/);
    if (match) mids.add(match[1]);
  }
  return mids;
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Referer': 'http://helloproject-mobile.com/info/music',
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function streamMeta(mid) {
  const url = `https://api01-platform.stream.co.jp/apiservice/getMediaByParam/?type=json&token=${encodeURIComponent(TOKEN)}&mid=${mid}`;
  const json = await getJson(url);
  if (json.response_status !== '2000' || !json.meta || !json.meta[0]) {
    throw new Error(`stream api failed for mid${mid}: ${json.response_status || 'empty'}`);
  }
  return json.meta[0];
}

function runFfmpeg(input, output) {
  return new Promise((resolve, reject) => {
    const tmp = output.replace(/\.mp4$/i, '.part.mp4');
    fs.rmSync(tmp, { force: true });
    const args = [
      '-hide_banner',
      '-loglevel', 'warning',
      '-y',
      '-headers', `Referer: http://helloproject-mobile.com/info/music\r\nUser-Agent: ${UA}\r\n`,
      '-i', input,
      '-c', 'copy',
      '-movflags', '+faststart',
      tmp,
    ];
    const child = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code) => {
      if (code !== 0) {
        fs.rmSync(tmp, { force: true });
        reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-1000)}`));
        return;
      }
      fs.renameSync(tmp, output);
      resolve();
    });
  });
}

async function main() {
  const radio = await getJson(RADIO_JSON_URL);
  const saved = [];
  const skipped = [];

  for (const target of TARGETS) {
    const group = radio.find((item) => String(item.title || '').includes(`id= ${target.id}`));
    if (!group) throw new Error(`group not found: ${target.id}`);

    const dir = path.join(ROOT, target.directory);
    fs.mkdirSync(dir, { recursive: true });
    const midsDone = existingMids(dir);
    let seq = maxSeq(dir);

    const contents = (group.contents || [])
      .filter((content) => episodeNo(content.title) >= target.minEpisode)
      .sort((a, b) => episodeNo(a.title) - episodeNo(b.title));

    for (const content of contents) {
      const episodeTitle = cleanFilename(stripHtml(content.title));
      const parts = (content.list || []).filter((item) => !/ALL PLAY/i.test(stripHtml(item.title)));
      for (const item of parts) {
        const mid = String((item.mids || [])[0] || '');
        if (!mid) continue;
        if (midsDone.has(mid)) {
          skipped.push({ mid, reason: 'exists' });
          continue;
        }
        const meta = await streamMeta(mid);
        const input = meta.movie_url && (meta.movie_url.mb_lq || meta.movie_url.lq);
        if (!input) throw new Error(`movie url not found for mid${mid}`);
        const title = cleanFilename(meta.title || stripHtml(item.title));
        const name = cleanFilename(`${String(++seq).padStart(4, '0')} - ${target.program} - ${episodeTitle} - ${title} - ${target.host} [mid${mid}].mp4`);
        const out = path.join(dir, name);
        console.log(`DOWNLOAD mid${mid} -> ${name}`);
        await runFfmpeg(input, out);
        midsDone.add(mid);
        saved.push({ mid, file: out, size: fs.statSync(out).size });
      }
    }
  }

  const report = {
    saved_at: new Date().toISOString(),
    saved,
    skipped,
  };
  fs.writeFileSync(path.join(ROOT, '_latest_update_2026-08-15.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log(`saved=${saved.length} skipped=${skipped.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
