const fs = require('fs');
const path = require('path');

const DATA_FILE = path.resolve(__dirname, '..', 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'mail', 'mail_data.js');

const CAPTION_OVERRIDES = new Map([
  ['2025-09-18|上村麗菜|石山咲良', '上村麗菜'],
  ['2025-08-30|北原もも|村越彩菜', '北原もも'],
  ['2025-08-19|植村葉純|遠藤彩加里', '植村葉純'],
  ['2025-08-19|遠藤彩加里|植村葉純', '遠藤彩加里'],
  ['2025-01-22|福田真琳|後藤花', '福田真琳'],
  ['2024-08-30|北原もも|松原ユリヤ', '北原もも'],
  ['2024-04-16|豫風瑠乃|弓桁朱琴', '豫風瑠乃'],
  ['2024-01-22|新沼希空|伊勢鈴蘭', '新沼希空'],
  ['2024-01-18|里吉うたの|山﨑愛生', '里吉うたの'],
  ['2023-09-29|小野瑞歩|工藤由愛', '小野瑞歩'],
  ['2022-07-20|中山夏月姫|井上玲音', '中山夏月姫'],
  ['2020-12-09|船木結|小片リサ', '船木結'],
  ['2020-08-05|笠原桃奈|小片リサ', '笠原桃奈'],
  ['2020-07-21|山﨑夢羽|山岸理子', '山﨑夢羽'],
  ['2020-07-01|加賀楓|小片リサ', '加賀楓'],
  ['2020-06-03|稲場愛香|小片リサ', '稲場愛香'],
  ['2020-06-01|野中美希|小片リサ', '野中美希'],
  ['2020-05-27|植村あかり|野中美希', '磯部焼き'],
  ['2020-05-25|野中美希|小片リサ', '野中美希'],
  ['2019-12-17|野中美希|小片リサ', '野中美希'],
]);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function correctedCaption(label, member, date = '') {
  const caption = String(label || '').trim();
  if (!caption || !member) return caption;
  const override = CAPTION_OVERRIDES.get(`${date}|${member}|${caption}`);
  if (override) return override;
  if (caption === '谷本亜美') return '谷本安美';
  if (member === '野中美希' && caption === '野中美希e') return member;
  if (member === '松本わかな' && /^0[12]_matsumoto$/.test(caption)) return member;
  if (caption === `☆${member}` || caption === 'フォト') return member;
  if (member === '一岡伶奈' && caption === '一岡玲奈') return member;
  return caption;
}

function repairPhotoLabels(html, member, date = '') {
  let corrected = 0;
  const result = String(html || '').replace(/<figure\b[^>]*class=["'][^"']*\bmail-photo\b[^"']*["'][^>]*>[\s\S]*?<\/figure>/gi, figure => {
    const match = figure.match(/<figcaption>([\s\S]*?)<\/figcaption>/i);
    if (!match) return figure;
    const oldCaption = match[1].replace(/<[^>]+>/g, '').trim();
    const newCaption = correctedCaption(oldCaption, member, date);
    if (newCaption === oldCaption) return figure;
    const escaped = escapeHtml(newCaption);
    corrected += 1;
    return figure
      .replace(/(<figcaption>)[\s\S]*?(<\/figcaption>)/i, (_, start, end) => `${start}${escaped}${end}`)
      .replace(/(<img\b[^>]*\balt=")[^"]*(")/i, (_, start, end) => `${start}${escaped}${end}`);
  });
  return { html: result, corrected };
}

function repairExistingArchive() {
  const source = fs.readFileSync(DATA_FILE, 'utf8').replace(/^window\.MAIL_MESSAGES\s*=\s*/, '').replace(/;\s*$/, '');
  const messages = JSON.parse(source);
  let corrected = 0;
  for (const message of messages) {
    const result = repairPhotoLabels(message.html, message.member, message.date);
    if (!result.corrected) continue;
    message.html = result.html;
    const text = message.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    message.searchText = `${message.date} ${message.subject} ${message.member} ${text}`;
    corrected += result.corrected;
  }
  if (corrected) fs.writeFileSync(DATA_FILE, `window.MAIL_MESSAGES=${JSON.stringify(messages)};\n`, 'utf8');
  console.log(`mail photo labels corrected: ${corrected}`);
}

if (require.main === module) repairExistingArchive();

module.exports = { correctedCaption, repairPhotoLabels };
