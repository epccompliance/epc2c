const http = require('http');
const fs   = require('fs');
const path = require('path');
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
};

http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/epc2c_v3.html';
  const filePath = path.join(ROOT, url);
  if (!fs.existsSync(filePath) || !filePath.startsWith(ROOT)) {
    res.writeHead(404); res.end('Not found'); return;
  }
  const ext = path.extname(filePath);
  const ct  = MIME[ext] || 'text/plain';
  res.writeHead(200, { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(filePath).pipe(res);
}).listen(8080, () => console.log('Static server: http://localhost:8080'));
