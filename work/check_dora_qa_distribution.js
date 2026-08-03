const fs = require('fs');
const path = require('path');

const dir = path.resolve(
  'outputs',
  'helloproject-mobile-archive',
  'helloproject-mobile.com',
  'hello_qa',
);

for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.html') && name !== 'index.html').sort()) {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  const idx = html.indexOf('<h3>欲しいドラえもんのひみつ道具は？</h3>');
  if (idx < 0) continue;
  const next = html.indexOf('<section class="qa-card"', idx + 1);
  const snip = html.slice(idx, next < 0 ? idx + 12000 : next);
  const names = [...snip.matchAll(/<div class="answer-name">([^<]+)/g)].map((match) => match[1]);
  console.log(`${file}\t${names.join(', ')}`);
}
