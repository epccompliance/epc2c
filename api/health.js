const fetch = require('node-fetch');

const EPC_EMAIL   = process.env.EPC_EMAIL   || '';
const EPC_API_KEY = process.env.EPC_API_KEY || '';
const EPC_BASE    = process.env.EPC_BASE    || 'https://epc.opendatacommunities.org/api/v1/domestic';
const EPC_AUTH    = 'Basic ' + Buffer.from(EPC_EMAIL + ':' + EPC_API_KEY).toString('base64');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const r    = await fetch(`${EPC_BASE}/search?postcode=WV11+3TY&size=1`, {
      headers: { Authorization: EPC_AUTH, Accept: 'application/json' },
    });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    res.status(200).json({
      server:         'ok',
      epc_api_status: r.status,
      epc_api_ok:     r.status === 200,
      rows_returned:  body.rows ? body.rows.length : 0,
      epc_email:      EPC_EMAIL || '(not set)',
    });
  } catch (err) {
    res.status(502).json({ server: 'ok', epc_api_status: 'unreachable', error: err.message });
  }
};
