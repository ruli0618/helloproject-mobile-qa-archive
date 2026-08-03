const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MOVIE_ROOT = path.join(ROOT, 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'hello_movie_sorted');
const REPORT = path.join(MOVIE_ROOT, '_hidden_movie_mid_candidates.json');
const OUT = path.join(MOVIE_ROOT, '_hidden_mid_candidates');
const MIN_FREE_GB = Number(process.env.HPM_MIN_FREE_GB || 10);

function safeName(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'untitled';
}

function ymd(value) {
  const m = String(value || '').match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '0000-00-00';
}

function getFreeGb() {
  try {
    return Number(cp.execFileSync('powershell', ['-NoProfile', '-Command', '(Get-PSDrive -Name C).Free / 1GB'], { encoding: 'utf8' }).trim());
  } catch {
    return Infinity;
  }
}

function runFfmpeg(input, output) {
  const tmp = `${output}.part`;
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
  const args = [
    '-hide_banner', '-loglevel', 'warning', '-y',
    '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
    '-i', input,
    '-c', 'copy',
    '-bsf:a', 'aac_adtstoasc',
    '-f', 'mp4',
    tmp,
  ];
  const res = cp.spawnSync('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (res.status !== 0) {
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
    throw new Error((res.stderr || res.stdout || `ffmpeg exit ${res.status}`).trim());
  }
  fs.renameSync(tmp, output);
}

function main() {
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });
  let saved = 0;
  let skipped = 0;
  const failed = [];
  for (const item of report.short_candidates || []) {
    const free = getFreeGb();
    if (free < MIN_FREE_GB) break;
    const name = `${ymd(item.insert_date)} - ${safeName(item.title)} - ${String(item.duration).padStart(3, '0')}s [mid${item.mid}] [${item.quality} ${safeName(item.definition)}].mp4`;
    const out = path.join(OUT, name);
    if (fs.existsSync(out)) {
      skipped++;
      continue;
    }
    try {
      runFfmpeg(item.url, out);
      saved++;
      console.log(`OK mid${item.mid} ${out}`);
    } catch (err) {
      failed.push({ mid: item.mid, title: item.title, error: err.message });
      console.error(`FAIL mid${item.mid} ${err.message}`);
    }
  }
  const summary = [
    `saved: ${saved}`,
    `skipped: ${skipped}`,
    `failed: ${failed.length}`,
    '',
    ...failed.map(f => `FAIL mid${f.mid} ${f.title}: ${f.error}`),
  ].join('\n');
  fs.writeFileSync(path.join(OUT, '_download_report.txt'), summary + '\n', 'utf8');
  console.log(summary);
}

main();
