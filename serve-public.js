// Local preview server for the Vercel `public/` site.
// Mirrors the vercel.json rewrites so clean routes (/about, /epc-c-calculator, …) resolve.
// Throwaway dev helper — not part of the deploy.
const http = require('http');
const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2',
};

// vercel.json rewrites (clean route -> file)
const ROUTES = {
  '/': '/index.html',
  '/epc-c-calculator': '/epc-c-calculator.html',
  '/about': '/about.html',
  '/privacy': '/privacy.html',
  '/terms': '/terms.html',
  '/methodology': '/methodology.html',
  '/login': '/login.html',
  '/dashboard': '/dashboard.html',
  '/epc2e': '/epc2e.html',
  '/dea': '/dea.html',
  '/agents': '/agents.html',
};

http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (ROUTES[url]) url = ROUTES[url];
  let filePath = path.join(ROOT, url);
  // /report/:id -> report.html
  if (!fs.existsSync(filePath) && /^\/report\//.test(url)) filePath = path.join(ROOT, 'report.html');
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not found: ' + url);
    return;
  }
  const ct = MIME[path.extname(filePath)] || 'text/plain';
  res.writeHead(200, { 'Content-Type': ct });
  fs.createReadStream(filePath).pipe(res);
}).listen(8090, () => console.log('Preview server: http://localhost:8090'));
