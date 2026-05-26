const fetch = require('node-fetch');

const EPC_EMAIL   = process.env.EPC_EMAIL   || '';
const EPC_API_KEY = process.env.EPC_API_KEY || '';
const EPC_BASE    = process.env.EPC_BASE    || 'https://epc.opendatacommunities.org/api/v1/domestic';
const EPC_AUTH    = 'Basic ' + Buffer.from(EPC_EMAIL + ':' + EPC_API_KEY).toString('base64');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { postcode, size = 10 } = req.query;
  if (!postcode) { res.status(400).json({ error: 'postcode required', rows: [] }); return; }

  const url = `${EPC_BASE}/search?postcode=${encodeURIComponent(postcode)}&size=${size}`;
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
};
