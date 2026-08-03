const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(
  ROOT,
  'outputs',
  'helloproject-mobile-archive',
  'helloproject-mobile.com',
  'birthday_cards',
);
const MANIFEST = path.join(OUT, '_birthday_cards_manifest.json');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';

const seeds = [
  // Current JSON seeds and current/recent H!P surnames. Additions are cheap:
  // only plausible birthday dates are scanned when a known MMDD is present.
  ['0605', 'goto'], ['0607', 'nishida'], ['0610', 'hayashi'], ['0615', 'kamimura'],
  ['0618', 'hiromoto'], ['0623', 'maeda'], ['0628', 'yamazaki'], ['0707', 'matsunaga'],
  ['0708', 'yumigeta'], ['0708', 'yoshida'], ['0717', 'inoue'], ['0720', 'nakayama'],
  ['0723', 'kubota'], ['0725', 'hirayama'], ['0729', 'akiyama'], ['0730', 'kasai'],
  ['0801', 'eguchi'], ['0804', 'shimoitani'], ['0810', 'tsutsui'], ['0816', 'kobayashi'],
  ['0830', 'kitahara'],

  ['0102', 'fukumura'], ['0107', 'ishida'], ['0115', 'nonaka'], ['0119', 'ise'],
  ['0209', 'tamenaga'], ['0219', 'morito'], ['0222', 'yokoyama'], ['0225', 'uemura'],
  ['0307', 'haga'], ['0312', 'oda'], ['0316', 'kitagawa'], ['0323', 'dambara'],
  ['0324', 'kitahara'], ['0327', 'kobayashi'], ['0412', 'yagi'], ['0419', 'sato'],
  ['0420', 'ishiguri'], ['0430', 'yoneyama'], ['0507', 'sasaki'], ['0507', 'danbara'],
  ['0509', 'sakurai'], ['0510', 'funa'], ['0516', 'saito'], ['0528', 'sayashi'],
  ['0604', 'sato'], ['0612', 'murota'], ['0617', 'tsugunaga'], ['0620', 'okamura'],
  ['0701', 'kanazawa'], ['0702', 'kanemitsu'], ['0707', 'kawamura'], ['0707', 'ikuta'],
  ['0708', 'yoshida'], ['0715', 'hashisako'], ['0717', 'inoue'], ['0720', 'nakajima'],
  ['0722', 'tanaka'], ['0728', 'hamaura'], ['0803', 'kumai'], ['0805', 'suzuki'],
  ['0807', 'yanagawa'], ['0816', 'ogata'], ['0820', 'shima'], ['0824', 'akiyama'],
  ['0828', 'maeda'], ['0830', 'kitahara'], ['0901', 'matsumoto'], ['0903', 'asakura'],
  ['0907', 'miyazaki'], ['0910', 'ogata'], ['0914', 'takase'], ['0917', 'saki'],
  ['0922', 'satoyoshi'], ['1003', 'kudo'], ['1006', 'hashisako'], ['1018', 'irie'],
  ['1020', 'niinuma'], ['1021', 'ota'], ['1024', 'kamiko'], ['1024', 'kamikokuryo'],
  ['1027', 'kudo'],
  ['1030', 'fukumura'], ['1105', 'yamaki'], ['1107', 'iikubo'], ['1111', 'sakurai'],
  ['1116', 'tanaka'], ['1119', 'takeuchi'], ['1123', 'chiba'], ['1124', 'yamada'],
  ['1127', 'kaga'], ['1130', 'kato'], ['1201', 'miyamoto'], ['1211', 'hirai'],
  ['1217', 'ogata'], ['1222', 'kiyono'], ['1223', 'kamei'], ['1228', 'maeda'],

  // 2026 current-member additions from current birthday summaries.
  ['0123', 'onoda'], ['0130', 'ebata'], ['0204', 'soma'], ['0211', 'murakoshi'],
  ['0222', 'ishiyama'], ['0225', 'uemura'], ['0226', 'kojima'], ['0226', 'matsubara'],
  ['0312', 'murata'], ['0323', 'doi'], ['0329', 'sugiyama'], ['0412', 'yasuda'],
  ['0417', 'nishizaki'], ['0418', 'shimakawa'], ['0419', 'yasuda'], ['0426', 'endo'],
  ['0430', 'yonemura'], ['0506', 'inoue'], ['0513', 'nagano'], ['0622', 'otsubo'],
  ['0909', 'ishikawa'], ['0928', 'kudo'], ['0929', 'ono'], ['0929', 'onozuki'],
  ['1007', 'nonaka'], ['1015', 'nishimura'], ['1017', 'hashida'], ['1018', 'fukuda'],
  ['1020', 'ishii'], ['1020', 'okamura'], ['1028', 'saito'], ['1116', 'tanimoto'],
  ['1206', 'kawana'], ['1213', 'kawashima'], ['1217', 'onoda'], ['1220', 'yofu'],
  ['1220', 'sugihara'], ['1223', 'arisawa'],

  // Graduated / former H!P members and common slug variants observed in old assets.
  ['0102', 'fukumura'], ['0107', 'ishida'], ['0112', 'mitsui'], ['0115', 'nonaka'],
  ['0120', 'yajima'], ['0205', 'nakajima'], ['0207', 'kaga'], ['0207', 'hagiwara'],
  ['0209', 'tamenaga'], ['0215', 'ogawa'], ['0219', 'morito'], ['0222', 'yokoyama'],
  ['0225', 'uemura'], ['0306', 'tsugunaga'], ['0307', 'haga'], ['0312', 'oda'],
  ['0315', 'arihara'], ['0316', 'kitagawa'], ['0328', 'satoda'], ['0402', 'miyazaki'],
  ['0411', 'mano'], ['0412', 'yoshizawa'], ['0412', 'yagi'], ['0417', 'nishizaki'],
  ['0419', 'sato'], ['0420', 'ishiguri'], ['0430', 'yonemura'], ['0507', 'sasaki'],
  ['0513', 'michishige'], ['0516', 'sayashi'], ['0522', 'tokunaga'], ['0528', 'sayashi'],
  ['0604', 'sato'], ['0612', 'murota'], ['0617', 'tsugunaga'], ['0621', 'okai'],
  ['0623', 'takeuchi'], ['0701', 'kanazawa'], ['0707', 'ikuta'], ['0707', 'kawamura'],
  ['0707', 'matsunaga'], ['0715', 'hashisako'], ['0717', 'inoue'], ['0720', 'nakajima'],
  ['0722', 'tanaka'], ['0728', 'hamaura'], ['0803', 'kumai'], ['0805', 'suzuki'],
  ['0807', 'yanagawa'], ['0816', 'ogata'], ['0820', 'shima'], ['0824', 'akiyama'],
  ['0825', 'natsuyaki'], ['0828', 'maeda'], ['0901', 'matsumoto'], ['0903', 'asakura'],
  ['0910', 'ogata'], ['0914', 'takase'], ['0922', 'satoyoshi'], ['0928', 'kudo'],
  ['0929', 'ono'], ['1006', 'hashisako'], ['1007', 'nonaka'], ['1018', 'irie'],
  ['1020', 'niinuma'], ['1024', 'kamiko'], ['1024', 'kamikokuryo'], ['1027', 'kudo'],
  ['1030', 'fukumura'], ['1105', 'yamaki'], ['1107', 'iikubo'], ['1116', 'tanimoto'],
  ['1119', 'takeuchi'], ['1123', 'chiba'], ['1127', 'kaga'], ['1201', 'miyamoto'],
  ['1211', 'hirai'], ['1217', 'onoda'], ['1222', 'kiyono'], ['1228', 'maeda'],

  // 2018-2019 active roster coverage from contemporary birthday lists.
  ['0202', 'makino'], ['0210', 'nomura'], ['0210', 'ozeki'], ['0225', 'ichioka'],
  ['0308', 'wada'], ['0316', 'takase'], ['0401', 'kishimoto'], ['0406', 'katsuta'],
  ['0421', 'takagi'], ['0426', 'hamaura'], ['0507', 'sato'], ['0510', 'funaki'],
  ['0528', 'sasaki'], ['0604', 'nakanishi'], ['0702', 'kanazawa'], ['0804', 'hirose'],
  ['1014', 'yamaki'], ['1022', 'kasahara'], ['1105', 'yamazaki'], ['1124', 'yamagishi'],
  ['1130', 'kaga'], ['1227', 'inaba'], ['1230', 'uemura'],
];

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function request(url, method = 'GET') {
  const client = url.startsWith('https:') ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(url, { method, headers: { 'user-agent': UA } }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function cleanUrl(image) {
  return new URL(image, 'https://helloproject-mobile.com/').toString();
}

function birthdayInfoFromUrl(url) {
  const pathname = new URL(url).pathname;
  const name = path.basename(pathname);
  const m = name.match(/^(\d{2})(\d{2})(\d{2})_([^./]+)\.(jpg|png|jpeg)$/i);
  if (!m) return null;
  return {
    year: 2000 + Number(m[1]),
    mmdd: `${m[2]}${m[3]}`,
    date: `20${m[1]}-${m[2]}-${m[3]}`,
    slug: m[4],
    ext: m[5].toLowerCase(),
    fileName: name,
  };
}

function outPathFor(info) {
  const dir = path.join(OUT, String(info.year));
  return path.join(dir, `${info.date}_${info.slug}.${info.ext}`);
}

async function saveImage(url, source) {
  const info = birthdayInfoFromUrl(url);
  if (!info) return null;
  const out = outPathFor(info);
  if (fs.existsSync(out)) {
    return { ...info, url, path: out, source, skipped: true };
  }
  const res = await request(url, 'GET');
  const type = String(res.headers['content-type'] || '');
  if (res.status !== 200 || !type.startsWith('image/')) return null;
  mkdirp(path.dirname(out));
  fs.writeFileSync(out, res.body);
  return { ...info, url, path: out, source, bytes: res.body.length };
}

async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const index = i++;
      try { out[index] = await fn(items[index], index); }
      catch (err) { out[index] = { error: err.message, item: items[index] }; }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

async function main() {
  mkdirp(OUT);
  const topJsonUrl = 'https://helloproject-mobile.com/json_data/top_flick_images.json';
  const topJson = await request(topJsonUrl);
  fs.writeFileSync(path.join(OUT, '_top_flick_images.json'), topJson.body);
  const topItems = JSON.parse(topJson.body.toString('utf8'));
  const topBirthdayUrls = topItems
    .map((item) => cleanUrl(item.image || ''))
    .filter((item) => birthdayInfoFromUrl(item));

  const candidates = new Set(topBirthdayUrls);
  for (const url of topBirthdayUrls) {
    const info = birthdayInfoFromUrl(url);
    if (!info) continue;
    for (let year = 2014; year <= 2030; year += 1) {
      const yy = String(year).slice(2);
      candidates.add(`https://helloproject-mobile.com/images/top-flickpic/${yy}${info.mmdd}_${info.slug}.jpg?${yy}${info.mmdd}`);
    }
  }
  for (const [mmdd, slug] of seeds) {
    for (let year = 2014; year <= 2030; year += 1) {
      const yy = String(year).slice(2);
      candidates.add(`https://helloproject-mobile.com/images/top-flickpic/${yy}${mmdd}_${slug}.jpg?${yy}${mmdd}`);
    }
  }

  const urls = [...candidates].sort();
  console.log(`candidates=${urls.length}`);
  const results = await mapLimit(urls, 12, (url) => saveImage(url, topBirthdayUrls.includes(url) ? 'top_json' : 'scan'));
  const savedMap = new Map();
  for (const item of results.filter(Boolean).filter((item) => !item.error)) {
    savedMap.set(item.path, item);
  }
  const saved = [...savedMap.values()];
  saved.sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
  fs.writeFileSync(MANIFEST, JSON.stringify({
    generated_at: new Date().toISOString(),
    candidates: urls.length,
    saved_count: saved.length,
    first: saved[0]?.date || null,
    last: saved[saved.length - 1]?.date || null,
    items: saved,
  }, null, 2), 'utf8');
  console.log(`saved=${saved.length}`);
  console.log(`first=${saved[0]?.date || ''}`);
  console.log(`last=${saved[saved.length - 1]?.date || ''}`);
  console.log(OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
