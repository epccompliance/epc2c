// Shared helper: fetch a certificate from the new EPC API and return its
// recommendations (mapped to the front-end shape) plus reliable property detail.
const fetch = require('node-fetch');

const EPC_TOKEN    = process.env.EPC_API_TOKEN || process.env.EPC_BEARER_TOKEN || process.env.EPC_TOKEN || '';
const EPC_API_BASE = (process.env.EPC_API_BASE_URL || 'https://api.get-energy-performance-data.communities.gov.uk').replace(/\/$/, '');

// Best-effort map of RdSAP recommendation improvement_type codes -> readable text.
// The new API returns only codes; cost/SAP/saving are reliable, the NAME is a
// standard-table lookup. Unknown codes fall back to a neutral label.
const IMPROVEMENT_TEXT = {
  A: 'Increase loft insulation to 270 mm',
  B: 'Cavity wall insulation',
  C: 'Hot water cylinder insulation',
  D: 'Draught proofing',
  E: 'Low energy lighting for all fixed outlets',
  F: 'Hot water cylinder thermostat',
  G: 'Heating controls (thermostatic radiator valves)',
  I: 'Heating controls (programmer and room thermostat)',
  J: 'Heating controls (programmer, room thermostat and TRVs)',
  L: 'Flue gas heat recovery device',
  M: 'Solar water heating',
  N: 'Replace single glazed windows with low-E double glazing',
  O: 'Secondary glazing to single glazed windows',
  Q: 'Internal or external solid wall insulation',
  R: 'Condensing boiler',
  S: 'Solar photovoltaic panels',
  T: 'Wind turbine',
  U: 'Air or ground source heat pump',
  V: 'Change heating to gas condensing boiler',
  W: 'Floor insulation',
};

function improvementText(imp, i) {
  const code = imp.improvement_type || '';
  return IMPROVEMENT_TEXT[code]
      || IMPROVEMENT_TEXT[code.replace(/\d+$/, '')]   // e.g. "W1" -> "W"
      || ('Recommended improvement ' + (imp.sequence || i + 1));
}

function mapImprovement(imp, i) {
  const text   = improvementText(imp, i);
  const saving = imp.typical_saving && imp.typical_saving.value;
  return {
    seq:                          imp.sequence || (i + 1),
    'improvement-id-text':        text,
    'improvement-summary-text':   text + (saving ? ` — about £${saving}/yr saving` : ''),
    'energy-performance-rating':  imp.energy_performance_rating,
    'indicative-cost':            imp.indicative_cost || '',
    'improvement-type-code':      imp.improvement_type || '',
    'typical-saving':             saving != null ? saving : null,
  };
}

function detailFrom(d) {
  const first = a => (Array.isArray(a) && a[0] && a[0].description) || '';
  return {
    'property-type':               d.dwelling_type || '',
    'walls-description':           first(d.walls),
    'roof-description':            first(d.roofs),
    'main-heating-description':    first(d.main_heating),
    'windows-description':         (d.window && d.window.description) || '',
    'current-energy-efficiency':   d.energy_rating_current,
    'potential-energy-efficiency': d.energy_rating_potential,
    'current-energy-rating':       d.current_energy_efficiency_band || '',
    'potential-energy-rating':     d.potential_energy_efficiency_band || '',
    'total-floor-area':            d.total_floor_area,
    'registration-date':           d.registration_date || '',
  };
}

// Returns { status, rows, detail } on success, or { status, error, rows:[] } on failure.
async function fetchCertificate(id) {
  const url = `${EPC_API_BASE}/api/certificate?certificate_number=${encodeURIComponent(id)}`;
  console.log(`[EPC] GET ${url}`);
  const r    = await fetch(url, { headers: { Authorization: 'Bearer ' + EPC_TOKEN, Accept: 'application/json' } });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = null; }
  if (!r.ok || !body || !body.data) {
    return { status: r.status, error: (body && body.error) || text.slice(0, 200).trim(), rows: [] };
  }
  const d    = body.data;
  const imps = Array.isArray(d.suggested_improvements) ? d.suggested_improvements : [];
  return { status: 200, rows: imps.map(mapImprovement), detail: detailFrom(d) };
}

module.exports = { fetchCertificate, EPC_API_BASE, EPC_TOKEN };
