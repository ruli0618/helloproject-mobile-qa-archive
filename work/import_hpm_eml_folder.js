const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORKSPACE = 'C:/Users/misuz/Documents/Codex/2026-07-31/http-helloproject-mobile-com';
const SOURCE_DIR = process.argv[2] || 'C:/Users/misuz/Desktop/ハロモバメール';
const OUT_JSON = path.join(WORKSPACE, 'work', 'hpm_gmail_messages.json');
const ASSET_ROOT = path.join(WORKSPACE, 'outputs', 'helloproject-mobile-archive', 'helloproject-mobile.com', 'mail', 'assets');

function decodeBytes(buffer, charset = 'utf-8') {
  const label = String(charset || 'utf-8').toLowerCase().replace(/_/g, '-');
  try {
    return new TextDecoder(label).decode(buffer);
  } catch {
    return buffer.toString('utf8');
  }
}

function decodeMimeWord(value) {
  return String(value || '').replace(/=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g, (_, charset, enc, text) => {
    const bytes = enc.toLowerCase() === 'b'
      ? Buffer.from(text.replace(/\s+/g, ''), 'base64')
      : Buffer.from(text.replace(/_/g, ' ').replace(/=([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'binary');
    return decodeBytes(bytes, charset);
  });
}

function splitHeaderBody(raw) {
  const idx = raw.search(/\r?\n\r?\n/);
  if (idx < 0) return [raw, ''];
  const sep = raw.match(/\r?\n\r?\n/)[0];
  return [raw.slice(0, idx), raw.slice(idx + sep.length)];
}

function parseHeaders(rawHeaders) {
  const headers = [];
  for (const line of rawHeaders.split(/\r?\n/)) {
    if (/^\s/.test(line) && headers.length) {
      headers[headers.length - 1].value += ' ' + line.trim();
      continue;
    }
    const idx = line.indexOf(':');
    if (idx > 0) headers.push({ name: line.slice(0, idx), value: decodeMimeWord(line.slice(idx + 1).trim()) });
  }
  return headers;
}

function header(headers, name) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function contentParam(contentType, name) {
  const re = new RegExp(`${name}\\*?=(?:\"([^\"]+)\"|([^;\\s]+))`, 'i');
  const match = String(contentType || '').match(re);
  return decodeMimeWord(match?.[1] || match?.[2] || '');
}

function decodeQuotedPrintableToBuffer(body) {
  const joined = body.replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < joined.length; i += 1) {
    if (joined[i] === '=' && /^[0-9a-f]{2}$/i.test(joined.slice(i + 1, i + 3))) {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(joined.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

function decodeBodyBuffer(body, transferEncoding) {
  const enc = String(transferEncoding || '').toLowerCase();
  if (enc.includes('base64')) return Buffer.from(body.replace(/\s+/g, ''), 'base64');
  if (enc.includes('quoted-printable')) return decodeQuotedPrintableToBuffer(body);
  return Buffer.from(body, 'binary');
}

function splitMultipart(body, boundary) {
  const marker = `--${boundary}`;
  const out = [];
  const chunks = body.split(marker).slice(1);
  for (const chunk of chunks) {
    if (chunk.startsWith('--')) break;
    out.push(chunk.replace(/^\r?\n/, '').replace(/\r?\n$/, ''));
  }
  return out;
}

function parsePart(raw) {
  const [rawHeaders, body] = splitHeaderBody(raw);
  const headers = parseHeaders(rawHeaders);
  const contentType = header(headers, 'Content-Type') || 'text/plain; charset=utf-8';
  const mimeType = contentType.split(';')[0].trim().toLowerCase();
  const boundary = contentParam(contentType, 'boundary');
  if (boundary) {
    return { headers, mimeType, children: splitMultipart(body, boundary).map(parsePart) };
  }
  const transfer = header(headers, 'Content-Transfer-Encoding');
  const buffer = decodeBodyBuffer(body, transfer);
  const charset = contentParam(contentType, 'charset') || 'utf-8';
  return { headers, mimeType, buffer, text: mimeType.startsWith('text/') ? decodeBytes(buffer, charset) : null, children: [] };
}

function flatten(part, out = []) {
  out.push(part);
  for (const child of part.children || []) flatten(child, out);
  return out;
}

function cleanName(value, max = 140) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'unknown';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cidFor(part) {
  return header(part.headers, 'Content-ID').replace(/^<|>$/g, '');
}

function extFor(mimeType) {
  if (/jpeg|jpg/i.test(mimeType)) return '.jpg';
  if (/png/i.test(mimeType)) return '.png';
  if (/gif/i.test(mimeType)) return '.gif';
  if (/webp/i.test(mimeType)) return '.webp';
  return '.bin';
}

function normalizeDate(dateHeader, fallbackName) {
  const date = new Date(dateHeader);
  if (!Number.isNaN(date.getTime())) return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const match = fallbackName.match(/(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || '日付不明';
}

function findFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...findFiles(full));
    else if (/\.eml$/i.test(entry.name)) files.push(full);
  }
  return files;
}

function replaceCidImages(html, parts, stem) {
  fs.mkdirSync(ASSET_ROOT, { recursive: true });
  let index = 0;
  for (const part of parts) {
    const cid = cidFor(part);
    if (!cid || !part.buffer || !part.mimeType.startsWith('image/')) continue;
    const fileName = `${stem}_inline_${String(++index).padStart(2, '0')}${extFor(part.mimeType)}`;
    const filePath = path.join(ASSET_ROOT, fileName);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) fs.writeFileSync(filePath, part.buffer);
    html = html.replace(new RegExp(`cid:${escapeRegExp(cid)}`, 'g'), `assets/${fileName}`);
  }
  return html;
}

function main() {
  const files = findFiles(SOURCE_DIR).sort((a, b) => a.localeCompare(b, 'ja'));
  if (!files.length) throw new Error(`${SOURCE_DIR} に .eml がありません。`);
  const messages = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, 'binary');
    const root = parsePart(raw);
    const parts = flatten(root);
    const htmlPart = parts.find((p) => p.mimeType === 'text/html');
    const textPart = parts.find((p) => p.mimeType === 'text/plain');
    let html = htmlPart?.text || (textPart?.text || '').replace(/\r?\n/g, '<br>');
    const subject = header(root.headers, 'Subject') || path.basename(file, '.eml').replace(/^\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2} /, '');
    const date = normalizeDate(header(root.headers, 'Date'), path.basename(file));
    const id = header(root.headers, 'Message-ID') || path.basename(file);
    const stem = cleanName(`${date}_${subject}_${messages.length + 1}`, 160);
    html = replaceCidImages(html, parts, stem);
    messages.push({ id, subject, date, html, source_file: file });
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(messages, null, 2), 'utf8');
  console.log(`wrote ${messages.length} messages to ${OUT_JSON}`);
  execFileSync(process.execPath, [path.join(WORKSPACE, 'work', 'build_hpm_mail_archive.js')], { stdio: 'inherit' });
}

main();
