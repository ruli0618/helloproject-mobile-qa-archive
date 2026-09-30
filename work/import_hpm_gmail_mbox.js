const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORKSPACE = 'C:/Users/misuz/Documents/Codex/2026-07-31/http-helloproject-mobile-com';
const MBOX_PATH = process.argv[2] || path.join(WORKSPACE, 'work', 'hpm_gmail.mbox');
const OUT_JSON = path.join(WORKSPACE, 'work', 'hpm_gmail_messages.json');

function decodeMimeWord(value) {
  return String(value || '').replace(/=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g, (_, charset, enc, text) => {
    let bytes;
    if (enc.toLowerCase() === 'b') {
      bytes = Buffer.from(text, 'base64');
    } else {
      const qp = text.replace(/_/g, ' ').replace(/=([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
      bytes = Buffer.from(qp, 'binary');
    }
    return bytes.toString(/shift[-_]?jis|cp932/i.test(charset) ? 'latin1' : 'utf8');
  });
}

function decodeBody(body, transferEncoding) {
  const enc = String(transferEncoding || '').toLowerCase();
  if (enc.includes('base64')) return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  if (enc.includes('quoted-printable')) {
    const joined = body.replace(/=\r?\n/g, '');
    const bytes = [];
    for (let i = 0; i < joined.length; i += 1) {
      if (joined[i] === '=' && /^[0-9a-f]{2}$/i.test(joined.slice(i + 1, i + 3))) {
        bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(joined.charCodeAt(i));
      }
    }
    return Buffer.from(bytes).toString('utf8');
  }
  return body;
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

function parseParts(raw, parentHeaders = []) {
  const [rawHeaders, body] = splitHeaderBody(raw);
  const headers = parseHeaders(rawHeaders);
  const contentType = header(headers, 'Content-Type') || 'text/plain';
  const boundary = contentType.match(/boundary="?([^";]+)"?/i)?.[1];
  const mimeType = contentType.split(';')[0].trim().toLowerCase();
  const transfer = header(headers, 'Content-Transfer-Encoding');
  if (boundary) {
    const parts = body.split(new RegExp(`\\r?\\n--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?\\r?\\n`, 'g'));
    return parts.flatMap((part) => parseParts(part, headers));
  }
  return [{ mime_type: mimeType, headers, body: { content: decodeBody(body, transfer) }, parts: null, parentHeaders }];
}

function htmlFromParts(parts) {
  return parts.find((p) => p.mime_type === 'text/html')?.body.content ||
    parts.find((p) => p.mime_type === 'text/plain')?.body.content.replace(/\r?\n/g, '<br>') ||
    '';
}

function splitMbox(text) {
  return text.split(/\r?\nFrom .*(?:\r?\n)/).filter((chunk) => chunk.trim());
}

function main() {
  if (!fs.existsSync(MBOX_PATH)) throw new Error(`${MBOX_PATH} がありません。Google Takeoutのmboxを指定してください。`);
  const raw = fs.readFileSync(MBOX_PATH, 'utf8');
  const messages = [];
  for (const chunk of splitMbox(raw)) {
    const [rawHeaders] = splitHeaderBody(chunk);
    const headers = parseHeaders(rawHeaders);
    const from = header(headers, 'From');
    if (!/info@helloproject-mobile\.com/i.test(from)) continue;
    const parts = parseParts(chunk);
    messages.push({
      id: header(headers, 'Message-ID') || String(messages.length + 1),
      internal_date: Date.parse(header(headers, 'Date')) || 0,
      payload: {
        headers,
        mime_type: 'message/rfc822',
        parts: [{ mime_type: 'text/html', body: { content: htmlFromParts(parts) }, headers: [], parts: null }],
      },
    });
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(messages, null, 2), 'utf8');
  console.log(`wrote ${messages.length} messages to ${OUT_JSON}`);
  execFileSync(process.execPath, [path.join(WORKSPACE, 'work', 'build_hpm_mail_archive.js')], { stdio: 'inherit' });
}

main();
