// GET /api/epc/recommendations?lmkKey=<certificate-number>
// Returns { rows: [...recommendations...], detail: {...property attributes...} }
// sourced from the new EPC API certificate endpoint.
const { fetchCertificate } = require('./_certificate');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const id = req.query.lmkKey || req.query.certificate_number || req.query.rrn;
  if (!id) { res.status(400).json({ error: 'lmkKey (certificate number) required', rows: [] }); return; }

  try {
    const out = await fetchCertificate(id);
    if (out.status !== 200) { res.status(out.status).json({ error: out.error, rows: [] }); return; }
    res.status(200).json({ rows: out.rows, detail: out.detail });
  } catch (err) {
    console.error('[EPC] fetch error:', err.message);
    res.status(502).json({ error: err.message, rows: [] });
  }
};
