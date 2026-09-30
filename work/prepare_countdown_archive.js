const fs = require('fs');
const path = require('path');

const groups = ['morningmusume', 'angerme', 'juicejuice', 'tsubakifactory', 'beyooooonds', 'ochanorma', 'rosychronicle'];

function findClosingDiv(html, openAt) {
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = openAt;
  let depth = 0;
  let match;
  while ((match = tags.exec(html))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return tags.lastIndex;
  }
  return -1;
}

function removeCountdownSocialList(html) {
  const marker = html.indexOf('Hello! Project公式HP・SNS</p>');
  if (marker < 0) return html;
  const headingStart = html.lastIndexOf('<p style=', marker);
  const listStart = html.indexOf('<div class="hp_special_contents3"', marker);
  if (headingStart < 0 || listStart < 0) return html;
  const listEnd = findClosingDiv(html, listStart);
  if (listEnd < 0) return html;
  let end = listEnd;
  const tail = html.slice(end);
  const spacing = tail.match(/^(?:\s*<br\s*\/?\s*>){0,3}/i);
  if (spacing) end += spacing[0].length;
  return `${html.slice(0, headingStart)}${html.slice(end)}`;
}

function prepare(root) {
  const eventDir = path.resolve(root, 'pages', 'countdown2026');
  const indexPath = path.join(eventDir, 'index.html');
  if (!fs.existsSync(indexPath)) return { pages: 0, members: 0 };

  let index = fs.readFileSync(indexPath, 'utf8');
  const members = [...index.matchAll(/href=["']((?:morningmusume|angerme|juicejuice|tsubakifactory|beyooooonds|ochanorma|rosychronicle)\/[^"']+\.html)["']/g)]
    .map(match => match[1])
    .filter((href, position, list) => list.indexOf(href) === position)
    .filter(href => fs.existsSync(path.join(eventDir, href)));

  index = removeCountdownSocialList(index);
  index = index.replace(/\s*<section class="footer">[\s\S]*?<\/section>/i, '');
  fs.writeFileSync(indexPath, index, 'utf8');

  members.forEach((relative, position) => {
    const file = path.join(eventDir, relative);
    const previous = members[(position - 1 + members.length) % members.length];
    const next = members[(position + 1) % members.length];
    let html = fs.readFileSync(file, 'utf8');

    html = html.replace(/\s*<!--ヘッダー-->[\s\S]*?<!-- ヘッダー終了-->/i, '');
    html = html.replace(/\s*<nav\b[^>]*class=["']side-menu["'][^>]*>[\s\S]*?<\/nav>/i, '');
    html = html.replace(/\s*<div\b[^>]*id=["']js__overlay["'][^>]*>\s*<\/div>/i, '');
    html = html.replace(/\s*<section class="footer">[\s\S]*?<\/section>/i, (_, section) => {
      const previousHref = path.relative(path.dirname(file), path.join(eventDir, previous)).replace(/\\/g, '/');
      const nextHref = path.relative(path.dirname(file), path.join(eventDir, next)).replace(/\\/g, '/');
      return `<section class="footer"><div class="btnright_sp"><a href="${previousHref}">＜ 前へ</a><a class="btn_spaceleft_sp" href="${nextHref}">次へ ＞</a></div></section>`;
    });

    fs.writeFileSync(file, html, 'utf8');
  });

  return { pages: members.length + 1, members: members.length };
}

module.exports = prepare;
