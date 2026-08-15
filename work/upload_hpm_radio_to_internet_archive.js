const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RADIO_DIR = 'C:\\Users\\misuz\\Desktop\\RADIO\\ハロモバラジオ';
const MANIFEST = path.join(ROOT, 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'radio', 'radio_manifest.json');
const IA = path.join(process.env.APPDATA || '', 'Python', 'Python310', 'Scripts', 'ia.exe');
const BUILD_PAGE = path.join(ROOT, 'work', 'build_radio_archive_page.js');

const programIds = new Map([
  ['オリジナル番組「かみこ日和」', 'helloproject-mobile-radio-kamiko-biyori'],
  ['オリジナル番組「ふくむらの部屋」', 'helloproject-mobile-radio-fukumura-no-heya'],
  ['オリジナル番組「みよちゃん家の縁側」', 'helloproject-mobile-radio-miyochanchi-no-engawa'],
  ['オリジナル番組「やじまの部屋」', 'helloproject-mobile-radio-yajima-no-heya'],
  ['オリジナル番組「ろこの部屋」', 'helloproject-mobile-radio-roko-no-heya'],
  ['オリジナル番組「宣伝会議」', 'helloproject-mobile-radio-senden-kaigi'],
  ['オリジナル番組「隣のやじまん家」', 'helloproject-mobile-radio-tonari-no-yajimanchi'],
]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      SSL_CERT_FILE: certPath(),
      REQUESTS_CA_BUNDLE: certPath(),
    },
    ...options,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

function certPath() {
  const result = spawnSync('python', ['-c', 'import certifi; print(certifi.where())'], { encoding: 'utf8' });
  return result.stdout.trim();
}

function encodeFileName(name) {
  return encodeURIComponent(name).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function usage() {
  console.log(`Usage:
  node work/upload_hpm_radio_to_internet_archive.js plan
  node work/upload_hpm_radio_to_internet_archive.js check
  node work/upload_hpm_radio_to_internet_archive.js upload [program name]
  node work/upload_hpm_radio_to_internet_archive.js relink

Notes:
  - Run "ia configure" first if check says authentication is missing.
  - Uploading all programs is about 104GB and can take many hours.
`);
}

function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
}

function programSummary(manifest) {
  return manifest.programs.map((program) => ({
    ...program,
    identifier: programIds.get(program.program) || '',
  }));
}

function relink() {
  const manifest = loadManifest();
  for (const item of manifest.items) {
    const identifier = programIds.get(item.program);
    item.archive_item = identifier || '';
    item.audio_url = identifier ? `https://archive.org/download/${identifier}/${encodeFileName(item.file_name)}` : '';
  }
  manifest.internet_archive = {
    item_strategy: 'one item per program',
    updated_at: new Date().toISOString(),
    programs: programSummary(manifest),
  };
  saveManifest(manifest);
  run('node', [BUILD_PAGE]);
  console.log(JSON.stringify({ linked: manifest.items.length, programs: manifest.internet_archive.programs }, null, 2));
}

function check() {
  if (!fs.existsSync(IA)) {
    console.error(`ia.exe not found: ${IA}`);
    process.exit(1);
  }
  run(IA, ['configure', '--check']);
}

function upload(programName) {
  const manifest = loadManifest();
  const programs = programName ? [programName] : [...programIds.keys()];
  for (const program of programs) {
    const identifier = programIds.get(program);
    if (!identifier) {
      console.error(`Unknown program: ${program}`);
      process.exit(1);
    }
    const files = manifest.items
      .filter((item) => item.program === program)
      .map((item) => path.join(RADIO_DIR, program, item.file_name));
    if (!files.length) continue;
    const summary = manifest.programs.find((item) => item.program === program);
    const args = [
      'upload',
      identifier,
      ...files,
      '--retries', '10',
      '--checksum',
      '--metadata', `title:ハロモバラジオ - ${program}`,
      '--metadata', 'mediatype:audio',
      '--metadata', 'collection:opensource_audio',
      '--metadata', 'creator:Hello! Project Mobile',
      '--metadata', 'language:jpn',
      '--metadata', 'subject:Hello! Project;Hello Project Mobile;radio;Japanese idol',
      '--metadata', `description:ハロー！プロジェクトモバイルで配信されていたラジオ音源の個人保存アーカイブです。番組: ${program} / ファイル数: ${files.length} / 容量: ${summary?.size_gb || ''}GB`,
    ];
    console.log(`Uploading ${program} -> ${identifier} (${files.length} files)`);
    run(IA, args);
  }
}

const command = process.argv[2] || 'usage';
if (command === 'plan') {
  console.log(JSON.stringify(programSummary(loadManifest()), null, 2));
} else if (command === 'check') {
  check();
} else if (command === 'upload') {
  upload(process.argv[3]);
} else if (command === 'relink') {
  relink();
} else {
  usage();
}
