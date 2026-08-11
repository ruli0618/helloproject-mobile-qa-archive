const fs = require('fs');
const path = require('path');

const OUT = path.resolve('outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'special_events');
const PAGES = path.join(OUT, 'pages');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.html?$/.test(entry.name)) files.push(full);
  }
  return files;
}

function removeBlockById(html, id) {
  const startRe = new RegExp(`<div\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i');
  const match = startRe.exec(html);
  if (!match) return html;

  let index = match.index;
  let pos = match.index;
  let depth = 0;
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = pos;
  let tag;
  while ((tag = tagRe.exec(html))) {
    if (tag[0].startsWith('</')) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      return html.slice(0, index) + html.slice(tagRe.lastIndex);
    }
  }
  return html;
}

function cleanHtml(file, html) {
  const pageDir = path.dirname(file);
  const specialIndex = path.relative(pageDir, path.join(OUT, 'index.html')).replace(/\\/g, '/');

  let out = html;

  out = out.replace(/<script\b[^>]*src=["'][^"']*\/assets\/js\/plugins\/(?:lodash\.min|knockout-3\.2\.0|knockout\.mapping-latest|jquery\.overflowScroll)\.js["'][^>]*>\s*<\/script>\s*/gi, '');
  out = out.replace(/<script\b[^>]*src=["'][^"']*\/assets\/js\/(?:menu|base)\.js(?:\?archive_fix=1)?["'][^>]*>\s*<\/script>\s*/gi, '');
  out = out.replace(/<link\b[^>]*href=["'][^"']*jquery\.sidr\.light\.css["'][^>]*>\s*/gi, '');
  out = out.replace(/\s*<meta http-equiv=["']x-xrds-location["'][^>]*>\s*/gi, '');
  out = out.replace(/\s*<!-- Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->\s*/gi, '');
  out = out.replace(/\s*<!-- Google Tag Manager \(noscript\) -->[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->\s*/gi, '');

  out = out.replace(/<div\b[^>]*\bid=["']js-off["'][^>]*>[\s\S]*?<\/div>\s*/i, '');
  out = out.replace(/\s*<script type=["']text\/javascript["']>\s*document\.getElementById\(["']js-off["']\)\.style\.display\s*=\s*["']none["'];\s*<\/script>\s*/gi, '');
  out = out.replace(/<div\b([^>]*)\bid=["']js-on["']([^>]*)\sstyle=["']display:\s*none;?["']([^>]*)>/gi, '<div$1id="js-on"$2$3>');
  out = out.replace(/<div\b[^>]*\bclass=["']side-menu-btn["'][^>]*\bid=["']js__sideMenuBtn["'][^>]*>[\s\S]*?<\/div>\s*/i, '');
  out = out.replace(/<div\b[^>]*\bid=["']js__overlay["'][^>]*>\s*<\/div>\s*/i, '');
  out = out.replace(/<nav\b[^>]*\bclass=["']side-menu["'][^>]*>[\s\S]*?<\/nav>\s*/i, '');

  for (const id of ['modal-content', 'login-content', 'reload-content', 'arrangeable-modal']) {
    out = removeBlockById(out, id);
  }

  out = out.replace(/<!--\s*[^<]*JS[^<]*-->\s*<script type="text\/javascript">\s*\/\/[\s\S]*?<\/script>\s*/i, '');
  out = out.replace(/<a href=["']\/["']>\s*(<img\b[^>]*src=["'][^"']*logo\.png["'][^>]*>)\s*<\/a>/gi, `<a href="${specialIndex}">$1</a>`);
  out = out.replace(/\bhref=["']\/["']/gi, `href="${specialIndex}"`);

  out = out.replace(/\s+data-bind=["'][^"']*["']/gi, '');
  out = out.replace(/\s+onContextmenu=["'][^"']*["']/gi, '');
  out = out.replace(/[ \t]+$/gm, '');
  out = out.replace(/<body>/i, '<body>');

  return out;
}

let changed = 0;
for (const file of walk(PAGES)) {
  const before = fs.readFileSync(file, 'utf8');
  const after = cleanHtml(file, before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    changed += 1;
  }
}

console.log(JSON.stringify({ scanned: walk(PAGES).length, changed }, null, 2));
