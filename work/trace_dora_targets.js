const fs = require('fs');

const archive = JSON.parse(fs.readFileSync('outputs/helloproject-mobile-archive/helloproject-mobile.com/hello_qa/_hello_qa_archive.json', 'utf8'));
const activeItems = archive.items.filter((item) => item.category_title !== 'OG');
const og = archive.items.find((item) => item.content_id === '21088');
const idToCategory = {
  6: '2', 10: '2', 11: '2', 12: '2', 17: '2', 96: '2',
  22: '3', 23: '3', 27: '3', 66: '3',
  28: '4', 31: '4', 32: '4', 35: '4',
  50: '26', 54: '26',
  103: '94',
};
function titleKey(value) {
  return String(value ?? '').replace(/\s+/g, ' ').replace(/秘密道具/g, 'ひみつ道具').trim();
}
function dateOnly(value) {
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}
function dayNumber(value) {
  const d = new Date(String(value ?? '').replace(/-/g, '/'));
  return Number.isFinite(d.getTime()) ? Math.floor(d.getTime() / 86400000) : 0;
}
for (const comment of og.comments) {
  const cid = idToCategory[comment.artist_id];
  const sameTitle = activeItems.filter((item) => titleKey(item.title) === titleKey(og.title));
  const groupMatches = sameTitle.filter((item) => item.category_id === cid);
  const pool = groupMatches.length ? groupMatches : [];
  const sameDate = pool.find((item) => dateOnly(item.release_date) === dateOnly(og.release_date));
  const ogDay = dayNumber(og.release_date);
  const target = sameDate || pool.slice().sort((a, b) => Math.abs(dayNumber(a.release_date) - ogDay) - Math.abs(dayNumber(b.release_date) - ogDay))[0];
  console.log(comment.user_name, comment.artist_id, cid, target && target.category_title, target && target.content_id, target && target.release_date);
}
