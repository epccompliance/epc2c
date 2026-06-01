const fetch = require('node-fetch');
const { val, str } = require('./_certificate');   // {value,language} unwrappers

// New "Get Energy Performance of Buildings Data" API (Bearer auth).
const EPC_TOKEN    = process.env.EPC_API_TOKEN || process.env.EPC_BEARER_TOKEN || process.env.EPC_TOKEN || '';
const EPC_API_BASE = (process.env.EPC_API_BASE_URL || 'https://api.get-energy-performance-data.communities.gov.uk').replace(/\/$/, '');

// The new search returns camelCase summary records. Map them back to the
// hyphenated field names the calculator front-end already consumes, so the
// property-list UI keeps working unchanged. Detail fields (property-type,
// walls, heating, SAP scores) are no longer in search — they require the
// /api/certificate?certificate_number= endpoint (wired separately).
function mapRecord(rec) {
  return {
    'lmk-key':               str(rec.certificateNumber),
    'certificate-number':    str(rec.certificateNumber),
    address1:                str(rec.addressLine1),
    address2:                str(rec.addressLine2),
    address3:                [val(rec.addressLine3), val(rec.addressLine4)].filter(Boolean).join(', '),
    posttown:                str(rec.postTown),
    postcode:                str(rec.postcode),
    'current-energy-rating': str(rec.currentEnergyEfficiencyBand),
    uprn:                    rec.uprn != null ? String(val(rec.uprn)) : '',
    'registration-date':     str(rec.registrationDate),
    council:                 str(rec.council),
    _new:                    rec,   // original new-API record, preserved verbatim
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { postcode, size } = req.query;
  if (!postcode) { res.status(400).json({ error: 'postcode required', rows: [] }); return; }

  // Normalise: a literal '+' or any spacing collapses to one space, then encode
  // (-> %20, which the API accepts; a raw '+' would be sent as %2B and 400).
  const pc = String(postcode).trim().replace(/[\s+]+/g, ' ');
  let url = `${EPC_API_BASE}/api/domestic/search?postcode=${encodeURIComponent(pc)}`;
  if (size) url += `&size=${encodeURIComponent(size)}`;
  console.log(`[EPC] GET ${url}`);

  try {
    const r    = await fetch(url, { headers: { Authorization: 'Bearer ' + EPC_TOKEN, Accept: 'application/json' } });
    const text = await r.text();
    let body; try { body = JSON.parse(text); } catch { body = null; }

    if (!r.ok || !body) {
      console.log(`[EPC] ${r.status} — error`);
      res.status(r.status).json({ error: (body && body.error) || text.slice(0, 200).trim(), rows: [] });
      return;
    }

    const data = Array.isArray(body.data) ? body.data : [];
    const rows = data.map(mapRecord);
    console.log(`[EPC] 200 — ${rows.length} rows`);
    res.status(200).json({ rows, pagination: body.pagination || null });
  } catch (err) {
    console.error('[EPC] fetch error:', err.message);
    res.status(502).json({ error: err.message, rows: [] });
  }
};
