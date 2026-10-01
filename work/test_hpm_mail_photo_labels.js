const assert = require('assert');
const { repairPhotoLabels } = require('./repair_hpm_mail_photo_labels');

const cases = [
  ['野中美希e', '野中美希', '野中美希'],
  ['01_matsumoto', '松本わかな', '松本わかな'],
  ['02_matsumoto', '松本わかな', '松本わかな'],
  ['☆広本瑠璃', '広本瑠璃', '広本瑠璃'],
  ['一岡玲奈', '一岡伶奈', '一岡伶奈'],
  ['谷本亜美', '谷本安美', '谷本安美'],
  ['谷本亜美', '谷本亜美', '谷本安美'],
  ['フォト', '稲場愛香', '稲場愛香'],
  ['遠藤彩加里', '植村葉純', '遠藤彩加里'],
];

for (const [oldName, member, expected] of cases) {
  const source = `<figure class="mail-photo"><img src="assets/photo.jpg" alt="${oldName}"><figcaption>${oldName}</figcaption></figure>`;
  const { html, corrected } = repairPhotoLabels(source, member);
  assert(html.includes(`alt="${expected}"`), `${oldName}: image alt`);
  assert(html.includes(`<figcaption>${expected}</figcaption>`), `${oldName}: caption`);
  assert.equal(corrected, oldName === expected ? 0 : 1, `${oldName}: correction count`);
  assert.equal(repairPhotoLabels(html, member).corrected, 0, `${oldName}: idempotence`);
}

const foodPhoto = '<figure class="mail-photo"><img src="assets/food.jpg" alt="野中美希"><figcaption>野中美希</figcaption></figure>';
const fixedFood = repairPhotoLabels(foodPhoto, '植村あかり', '2020-05-27');
assert(fixedFood.html.includes('<figcaption>磯部焼き</figcaption>'));
assert(fixedFood.html.includes('alt="磯部焼き"'));

const swappedName = '<figure class="mail-photo"><img src="assets/selfie.jpg" alt="遠藤彩加里"><figcaption>遠藤彩加里</figcaption></figure>';
assert(repairPhotoLabels(swappedName, '植村葉純', '2025-08-19').html.includes('<figcaption>植村葉純</figcaption>'));
assert.equal(repairPhotoLabels(swappedName, '植村葉純', '2025-08-20').corrected, 0);

console.log('mail photo label tests passed');
