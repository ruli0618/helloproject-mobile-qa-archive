const fs = require('fs');
const path = require('path');
const http = require('http');

const root = process.argv[2];
const port = Number(process.argv[3] || 4386);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
};

http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  let file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
  const resolvedRoot = path.resolve(root);
  if (!file.startsWith(resolvedRoot)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${port}/`);
});
