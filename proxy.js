/**
 * EPC2C local proxy — forwards requests to EPC Open Data Communities API
 * Handles Basic Auth server-side (avoids CORS and browser credential exposure)
 * Run: node proxy.js
 */
require('dotenv').config();
const express = require('express');
const fetch   = require('node-fetch');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const EPC_EMAIL   = process.env.EPC_EMAIL   || '';
const EPC_API_KEY = process.env.EPC_API_KEY || '';
const EPC_BASE    = process.env.EPC_BASE    || 'https://epc.opendatacommunities.org/api/v1/domestic';

if (!EPC_EMAIL || !EPC_API_KEY) {
  console.error('ERROR: EPC_EMAIL and EPC_API_KEY must be set in .env');
  process.exit(1);
}

const token = Buffer.from(EPC_EMAIL + ':' + EPC_API_KEY).toString('base64');
const AUTH  = 'Basic ' + token;

// GET /api/epc/search?postcode=WV11+3TY&size=10
app.get('/api/epc/search', async (req, res) => {
  const { postcode, size = 10 } = req.query;
  if (!postcode) return res.status(400).json({ error: 'postcode required' });

  const url = `${EPC_BASE}/search?postcode=${encodeURIComponent(postcode)}&size=${size}`;
  console.log(`[EPC] GET ${url}`);

  try {
    const r = await fetch(url, { headers: { Authorization: AUTH, Accept: 'application/json' } });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { error: text.trim(), rows: [] }; }
    console.log(`[EPC] ${r.status} — ${body.rows ? body.rows.length : 0} results`);
    res.status(r.status).json(body);
  } catch (err) {
    console.error('[EPC] fetch error:', err.message);
    res.status(502).json({ error: err.message, rows: [] });
  }
});

// GET /api/epc/:lmkKey/recommendations
app.get('/api/epc/:lmkKey/recommendations', async (req, res) => {
  const { lmkKey } = req.params;
  const url = `${EPC_BASE}/${lmkKey}/recommendations`;
  console.log(`[EPC] GET ${url}`);

  try {
    const r = await fetch(url, { headers: { Authorization: AUTH, Accept: 'application/json' } });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { error: text.trim() }; }
    res.status(r.status).json(body);
  } catch (err) {
    console.error('[EPC] fetch error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// Health check — also shows whether credentials work
app.get('/api/health', async (req, res) => {
  const url = `${EPC_BASE}/search?postcode=WV11+3TY&size=1`;
  try {
    const r = await fetch(url, { headers: { Authorization: AUTH, Accept: 'application/json' } });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text.trim() }; }
    res.json({
      proxy: 'ok',
      epc_api_status: r.status,
      epc_api_ok: r.status === 200,
      rows_returned: body.rows ? body.rows.length : 0,
      raw_response: body.raw || null,
      email: EPC_EMAIL,
    });
  } catch (err) {
    res.status(502).json({ proxy: 'ok', epc_api_status: 'unreachable', error: err.message });
  }
});

const PORT = process.env.PROXY_PORT || 3001;
app.listen(PORT, () => {
  console.log(`EPC proxy running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`EPC email:    ${EPC_EMAIL}`);
  console.log(`EPC key:      ${EPC_API_KEY.substring(0,8)}...`);
});
