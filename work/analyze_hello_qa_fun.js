const fs = require('fs');

const archivePath = 'outputs/helloproject-mobile-archive/helloproject-mobile.com/hello_qa/_hello_qa_archive.json';
const data = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
const items = data.items || [];

const names = [...new Set(items.flatMap((it) => it.comments || []).map((c) => c.user_name).filter(Boolean))];

function variants(name) {
  const compact = name.replace(/[ 　]/g, '');
  const out = new Set([name, compact]);
  const parts = name.split(/[ 　]/).filter(Boolean);
  if (parts[0] && parts[0].length >= 2) out.add(parts[0]);
  if (parts[1] && parts[1].length >= 2) out.add(parts[1]);
  return [...out].filter((x) => x.length >= 2);
}

const aliases = [];
for (const name of names) {
  for (const alias of variants(name)) aliases.push([name, alias.replace(/[ 　]/g, '')]);
}
aliases.sort((a, b) => b[1].length - a[1].length);

function topForTitle(patterns, limit = 15) {
  const rows = items.filter((it) => patterns.some((p) => it.title.includes(p)));
  const counts = new Map();
  let answers = 0;
  const examples = new Map();

  for (const it of rows) {
    for (const c of it.comments || []) {
      answers++;
      const text = (c.comment_plain || c.comment_text || '').replace(/[ 　\r\n\t]/g, '');
      const hit = new Set();
      for (const [name, alias] of aliases) {
        if (name === c.user_name) continue;
        if (text.includes(alias)) hit.add(name);
      }
      for (const name of hit) {
        counts.set(name, (counts.get(name) || 0) + 1);
        if (!examples.has(name)) examples.set(name, { by: c.user_name, title: it.title, text: c.comment_plain || c.comment_text || '' });
      }
    }
  }

  return {
    questions: rows.length,
    answers,
    top: [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count, example: examples.get(name) })),
  };
}

const targets = [
  ['歌声・声', ['歌声が好きなメンバー', '1番好きな声', '好きな声は誰', 'かわいい！と思う歌声']],
  ['踊り方', ['踊り方が好きなメンバー']],
  ['尊敬・憧れ', ['尊敬している', '憧れ', '目標にしている', 'ライバル']],
  ['仲良くなりたい', ['仲良くなりたい', '話したいと思うメンバー']],
  ['入れ替わりたい', ['入れ替わ', 'なってみたいメンバー', '1日だけ']],
  ['ドラえもん秘密道具', ['ドラえもん', '秘密道具']],
];

for (const [label, patterns] of targets) {
  const r = topForTitle(patterns);
  console.log(`\n## ${label} questions=${r.questions} answers=${r.answers}`);
  for (const row of r.top) console.log(`${row.count}\t${row.name}\t${row.example?.by || ''}\t${row.example?.title || ''}`);
}

const byTitle = new Map();
for (const it of items) {
  const cur = byTitle.get(it.title) || { questions: 0, answers: 0 };
  cur.questions++;
  cur.answers += (it.comments || []).length;
  byTitle.set(it.title, cur);
}
console.log('\n## repeated titles');
for (const [title, stat] of [...byTitle].sort((a, b) => b[1].questions - a[1].questions).slice(0, 35)) {
  console.log(`${stat.questions}\t${stat.answers}\t${title}`);
}

function answersForTitle(titlePart) {
  const rows = items.filter((it) => it.title.includes(titlePart));
  return {
    rows,
    answers: rows.flatMap((it) => (it.comments || []).map((c) => ({
      group: it.category_title,
      user: c.user_name,
      text: (c.comment_plain || c.comment_text || '').trim(),
    }))),
  };
}

const keywordTargets = [
  ['欲しいドラえもんの秘密道具', ['どこでもドア', 'タイムマシン', '暗記パン', 'もしもボックス', '四次元ポケット', 'スモールライト', 'タケコプター']],
  ['インドア派？アウトドア派？', ['インドア', 'アウトドア', 'どっちも', '両方']],
  ['待ち合わせの相手が来ない', ['一生', '何時間', '1時間', '１時間', '30分', '３０分', '15分', '１５分', '10分', '１０分', '帰る']],
  ['宝くじで一等', ['貯金', '家族', '旅行', '寄付', '買', '家', '服', '焼肉']],
];

for (const [titlePart, keywords] of keywordTargets) {
  const { rows, answers } = answersForTitle(titlePart);
  console.log(`\n## keyword ${titlePart} questions=${rows.length} answers=${answers.length}`);
  for (const keyword of keywords) {
    const count = answers.filter((a) => a.text.includes(keyword)).length;
    if (count) console.log(`${count}\t${keyword}`);
  }
}
