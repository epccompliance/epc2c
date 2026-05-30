/**
 * EPC2C unified server
 * - Serves epc2c_v3.html (/) and epc2e.html (/epc2e) as static files
 * - Proxies requests to the EPC Open Data Communities API (/api/epc/*)
 * - Provides server-side property sessions so Stripe redirect works
 *   across origins (POST /save-property → GET /get-property/:id)
 *
 * Deploy to Railway: set EPC_EMAIL, EPC_API_KEY, SESSION_SECRET env vars.
 * Railway sets PORT automatically.
 */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fetch   = require('node-fetch');
const cors    = require('cors');
const crypto  = require('crypto');
const path    = require('path');
const fs      = require('fs');

const app = express();
const DIR = __dirname;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'epc2c-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 2 * 60 * 60 * 1000, sameSite: 'lax' }, // 2 hours
}));

// ── EPC API credentials ───────────────────────────────────────────────────────
const EPC_EMAIL   = process.env.EPC_EMAIL   || '';
const EPC_API_KEY = process.env.EPC_API_KEY || '';
const EPC_BASE    = process.env.EPC_BASE    || 'https://epc.opendatacommunities.org/api/v1/domestic';

if (!EPC_EMAIL || !EPC_API_KEY) {
  console.warn('WARNING: EPC_EMAIL / EPC_API_KEY not set — EPC proxy routes will fail');
}

const EPC_AUTH = 'Basic ' + Buffer.from(EPC_EMAIL + ':' + EPC_API_KEY).toString('base64');

// ── Property session store ────────────────────────────────────────────────────
// Keyed by UUID returned to client and appended to Stripe URL as ?ref=<id>.
// Using an in-memory Map rather than express-session because the ID must
// survive a cross-origin redirect (cookie is not sent with the Stripe hop).
const propertyStore = new Map(); // id → { data, expiresAt }
const SESSION_TTL   = 2 * 60 * 60 * 1000; // 2 hours in ms

// Purge expired entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of propertyStore) {
    if (entry.expiresAt < now) propertyStore.delete(id);
  }
}, 15 * 60 * 1000).unref();

// ── Static file helper ────────────────────────────────────────────────────────
function serveHtml(filename) {
  return (req, res) => {
    const filePath = path.join(DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('File not found: ' + filename);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(filePath).pipe(res);
  };
}

// ── Static routes ─────────────────────────────────────────────────────────────
// Serve everything in /public as-is (for assets and direct .html access)
app.use(express.static(path.join(DIR, 'public')));

// Clean URLs (mirror vercel.json rewrites)
app.get('/',                  serveHtml('public/index.html'));
app.get('/epc-c-calculator',  serveHtml('public/epc-c-calculator.html'));
app.get('/about',             serveHtml('public/about.html'));
app.get('/privacy',           serveHtml('public/privacy.html'));
app.get('/terms',             serveHtml('public/terms.html'));
app.get('/methodology',       serveHtml('public/methodology.html'));
app.get('/dea',               serveHtml('public/dea.html'));
app.get('/agents',            serveHtml('public/agents.html'));
app.get('/epc2e',             serveHtml('public/epc2e.html'));
// Legacy direct links — keep working for backwards compat
app.get('/epc2c_v3.html',     serveHtml('epc2c_v3.html'));
app.get('/epc2e.html',        serveHtml('epc2e.html'));

// ── Property session endpoints ────────────────────────────────────────────────

// POST /save-property
// Body: property object (selProp from the browser)
// Returns: { sessionId } — append as ?ref=<sessionId> on the Stripe URL
app.post('/save-property', (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'property object required in request body' });
  }
  const sessionId = crypto.randomUUID();
  propertyStore.set(sessionId, { data, expiresAt: Date.now() + SESSION_TTL });
  console.log(`[session] saved  ${sessionId}  addr="${data.addr || '?'}"`);
  res.json({ sessionId });
});

// GET /get-property/:id
// Returns the saved property object, or 404 if not found / expired
app.get('/get-property/:id', (req, res) => {
  const entry = propertyStore.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'session not found or expired' });
  }
  if (entry.expiresAt < Date.now()) {
    propertyStore.delete(req.params.id);
    return res.status(404).json({ error: 'session expired' });
  }
  console.log(`[session] fetched ${req.params.id}  addr="${entry.data.addr || '?'}"`);
  res.json(entry.data);
});

// ── EPC API proxy routes ──────────────────────────────────────────────────────

// GET /api/epc/search?postcode=WV11+3TY&size=10
app.get('/api/epc/search', async (req, res) => {
  const { postcode, size = 10, from } = req.query;
  if (!postcode) return res.status(400).json({ error: 'postcode required', rows: [] });

  let url = `${EPC_BASE}/search?postcode=${encodeURIComponent(postcode)}&size=${size}`;
  if (from !== undefined) url += `&from=${from}`;
  console.log(`[EPC] GET ${url}`);
  try {
    const r    = await fetch(url, { headers: { Authorization: EPC_AUTH, Accept: 'application/json' } });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { error: text.trim(), rows: [] }; }
    console.log(`[EPC] ${r.status} — ${body.rows ? body.rows.length : 0} rows`);
    res.status(r.status).json(body);
  } catch (err) {
    console.error('[EPC] fetch error:', err.message);
    res.status(502).json({ error: err.message, rows: [] });
  }
});

// GET /api/epc/:lmkKey/recommendations
app.get('/api/epc/:lmkKey/recommendations', async (req, res) => {
  const url = `${EPC_BASE}/${req.params.lmkKey}/recommendations`;
  console.log(`[EPC] GET ${url}`);
  try {
    const r    = await fetch(url, { headers: { Authorization: EPC_AUTH, Accept: 'application/json' } });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { error: text.trim() }; }
    res.status(r.status).json(body);
  } catch (err) {
    console.error('[EPC] fetch error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// GET /api/health — confirms server is up and EPC credentials work
app.get('/api/health', async (req, res) => {
  const url = `${EPC_BASE}/search?postcode=WV11+3TY&size=1`;
  try {
    const r    = await fetch(url, { headers: { Authorization: EPC_AUTH, Accept: 'application/json' } });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text.trim() }; }
    res.json({
      server:                 'ok',
      epc_api_status:         r.status,
      epc_api_ok:             r.status === 200,
      rows_returned:          body.rows ? body.rows.length : 0,
      property_sessions_live: propertyStore.size,
      epc_email:              EPC_EMAIL || '(not set)',
    });
  } catch (err) {
    res.status(502).json({ server: 'ok', epc_api_status: 'unreachable', error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`EPC2C server  →  http://localhost:${PORT}/`);
  console.log(`              →  http://localhost:${PORT}/epc2e`);
  console.log(`Health check  →  http://localhost:${PORT}/api/health`);
  if (EPC_EMAIL) console.log(`EPC email     →  ${EPC_EMAIL}`);
});
