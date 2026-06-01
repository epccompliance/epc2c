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

// ── EPC API (new "Get Energy Performance of Buildings Data" service) ───────────
const { fetchCertificate } = require('./api/epc/_certificate');
const EPC_TOKEN    = process.env.EPC_API_TOKEN || process.env.EPC_BEARER_TOKEN || process.env.EPC_TOKEN || '';
const EPC_API_BASE = (process.env.EPC_API_BASE_URL || 'https://api.get-energy-performance-data.communities.gov.uk').replace(/\/$/, '');
const EPC_AUTH     = 'Bearer ' + EPC_TOKEN;

if (!EPC_TOKEN) {
  console.warn('WARNING: EPC_API_TOKEN / EPC_BEARER_TOKEN not set — EPC routes will fail');
}

// Map a new-API search summary record to the hyphenated fields the front-end expects.
function mapSearchRecord(rec) {
  return {
    'lmk-key':               rec.certificateNumber,
    'certificate-number':    rec.certificateNumber,
    address1:                rec.addressLine1 || '',
    address2:                rec.addressLine2 || '',
    address3:                [rec.addressLine3, rec.addressLine4].filter(Boolean).join(', '),
    posttown:                rec.postTown || '',
    postcode:                rec.postcode || '',
    'current-energy-rating': rec.currentEnergyEfficiencyBand || '',
    uprn:                    rec.uprn != null ? String(rec.uprn) : '',
    'registration-date':     rec.registrationDate || '',
    council:                 rec.council || '',
    _new:                    rec,
  };
}

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

// GET /api/epc/search?postcode=WV11+3TY&size=5000
app.get('/api/epc/search', async (req, res) => {
  const { postcode, size } = req.query;
  if (!postcode) return res.status(400).json({ error: 'postcode required', rows: [] });

  // Normalise '+'/spaces to one space, then encode (-> %20; a raw '+' would 400).
  const pc = String(postcode).trim().replace(/[\s+]+/g, ' ');
  let url = `${EPC_API_BASE}/api/domestic/search?postcode=${encodeURIComponent(pc)}`;
  if (size) url += `&size=${encodeURIComponent(size)}`;
  console.log(`[EPC] GET ${url}`);
  try {
    const r    = await fetch(url, { headers: { Authorization: EPC_AUTH, Accept: 'application/json' } });
    const text = await r.text();
    let body; try { body = JSON.parse(text); } catch { body = null; }
    if (!r.ok || !body) {
      return res.status(r.status).json({ error: (body && body.error) || text.slice(0, 200).trim(), rows: [] });
    }
    const rows = (Array.isArray(body.data) ? body.data : []).map(mapSearchRecord);
    console.log(`[EPC] ${r.status} — ${rows.length} rows`);
    res.status(200).json({ rows, pagination: body.pagination || null });
  } catch (err) {
    console.error('[EPC] fetch error:', err.message);
    res.status(502).json({ error: err.message, rows: [] });
  }
});

// GET /api/epc/recommendations?lmkKey=...  (query variant used by the calculator)
app.get('/api/epc/recommendations', async (req, res) => {
  const id = req.query.lmkKey || req.query.certificate_number;
  if (!id) return res.status(400).json({ error: 'lmkKey required', rows: [] });
  try {
    const out = await fetchCertificate(id);
    if (out.status !== 200) return res.status(out.status).json({ error: out.error, rows: [] });
    res.status(200).json({ rows: out.rows, detail: out.detail });
  } catch (err) {
    console.error('[EPC] fetch error:', err.message);
    res.status(502).json({ error: err.message, rows: [] });
  }
});

// GET /api/epc/:lmkKey/recommendations  (path variant; lmkKey = certificate number)
app.get('/api/epc/:lmkKey/recommendations', async (req, res) => {
  try {
    const out = await fetchCertificate(req.params.lmkKey);
    if (out.status !== 200) return res.status(out.status).json({ error: out.error, rows: [] });
    res.status(200).json({ rows: out.rows, detail: out.detail });
  } catch (err) {
    console.error('[EPC] fetch error:', err.message);
    res.status(502).json({ error: err.message, rows: [] });
  }
});

// GET /api/health — confirms server is up and EPC credentials work
app.get('/api/health', async (req, res) => {
  const url = `${EPC_API_BASE}/api/domestic/search?postcode=WV11+3TY&size=1`;
  try {
    const r    = await fetch(url, { headers: { Authorization: EPC_AUTH, Accept: 'application/json' } });
    const text = await r.text();
    let body; try { body = JSON.parse(text); } catch { body = null; }
    res.json({
      server:                 'ok',
      epc_api_status:         r.status,
      epc_api_ok:             r.status === 200,
      rows_returned:          body && Array.isArray(body.data) ? body.data.length : 0,
      property_sessions_live: propertyStore.size,
      epc_token_set:          !!EPC_TOKEN,
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
  console.log(`EPC token     →  ${EPC_TOKEN ? 'set' : 'NOT SET'}  (base ${EPC_API_BASE})`);
});
