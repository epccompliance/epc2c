// Shared helper: fetch a certificate from the new EPC API and return its
// recommendations (mapped to the front-end shape) plus reliable property detail.
const fetch = require('node-fetch');

const EPC_TOKEN    = process.env.EPC_API_TOKEN || process.env.EPC_BEARER_TOKEN || process.env.EPC_TOKEN || '';
const EPC_API_BASE = (process.env.EPC_API_BASE_URL || 'https://api.get-energy-performance-data.communities.gov.uk').replace(/\/$/, '');

// The new EPC API returns NO recommendation text — only `improvement_type` (a
// coarse letter) and `improvement_details.improvement_number` (the RdSAP measure
// ID). The number is the reliable key: the letter codes do NOT match the old
// open-data letters (e.g. new "T" = gas condensing boiler, not wind turbine), so
// mapping by letter produces confidently-wrong labels.
//
// This table is the verbatim register wording, sourced from MHCLG's own
// rendering service (communitiesuk/epb-frontend, locales/en.yml -> improvement_code
// `title`). Keep it in sync with that file if the register text changes.
const IMPROVEMENT_BY_NUMBER = {
  1:  'Hot water cylinder insulation',
  2:  'Hot water cylinder insulation',
  3:  'Hot water cylinder insulation',
  4:  'Hot water cylinder thermostat',
  5:  'Increase loft insulation to 270 mm',
  6:  'Cavity wall insulation',
  7:  'Internal wall insulation',
  8:  'Double glazed windows',
  9:  'Secondary glazing',
  10: 'Draught proofing',
  11: 'Heating controls (programmer, room thermostat and TRVs)',
  12: 'Heating controls (room thermostat and TRVs)',
  13: 'Heating controls (thermostatic radiator valves)',
  14: 'Heating controls (room thermostat)',
  15: 'Heating controls (programmer and TRVs)',
  16: 'Heating controls (time and temperature zone control)',
  17: 'Heating controls (programmer and room thermostat)',
  18: 'Heating controls (room thermostat)',
  19: 'Solar water heating',
  20: 'Replace boiler with new condensing boiler',
  21: 'Replace boiler with new condensing boiler',
  22: 'Replace boiler with biomass boiler',
  23: 'Biomass stove with boiler',
  24: 'Fan assisted storage heaters and dual immersion cylinder',
  25: 'Fan assisted storage heaters',
  26: 'Replacement warm air unit',
  27: 'Change heating to gas condensing boiler',
  28: 'Condensing oil boiler with radiators',
  29: 'Gas condensing boiler',
  30: 'Fan assisted storage heaters and dual immersion cylinder',
  31: 'Fan-assisted storage heaters',
  32: 'Change heating to gas condensing boiler',
  34: 'Solar photovoltaic panels, 2.5 kWp',
  35: 'Low energy lighting',
  36: 'Condensing heating unit',
  37: 'Condensing boiler (separate from the range cooker)',
  38: 'Condensing boiler (separate from the range cooker)',
  39: 'Biomass stove with boiler',
  40: 'Change room heaters to condensing boiler',
  41: 'Change room heaters to condensing boiler',
  42: 'Mains gas condensing heating unit',
  44: 'Wind turbine',
  45: 'Flat roof or sloping ceiling insulation',
  46: 'Room-in-roof insulation',
  47: 'Floor insulation',
  48: 'High performance external doors',
  49: 'Heat recovery system for mixer showers',
  50: 'Flue gas heat recovery device in conjunction with boiler',
  51: 'Air or ground source heat pump',
  52: 'Air or ground source heat pump with underfloor heating',
  53: 'Micro CHP',
  54: 'Biomass boiler (Exempted Appliance if in Smoke Control Area)',
  55: 'External and cavity wall insulation',
  56: 'Replacement glazing units',
  57: 'Floor insulation (suspended floor)',
  58: 'Floor insulation (solid floor)',
  59: 'High heat retention storage heaters and dual immersion cylinder and dual rate meter',
  60: 'High heat retention storage heaters',
  61: 'High heat retention storage heaters and dual immersion cylinder and dual rate meter',
  62: 'High heat retention storage heaters and dual rate meter',
  63: 'Party wall insulation',
  65: 'External wall insulation',
  66: 'Internal and cavity wall insulation',
  70: 'Water heating controls',
  72: 'Add PV Battery',
  73: 'Add PV diverter',
  75: 'Air or ground source heat pump',
  76: 'Air or ground source heat pump with underfloor heating',
};

function improvementText(imp, i) {
  // Map the RdSAP improvement number to the exact register wording.
  const det = imp.improvement_details || {};
  const num = parseInt(val(det.improvement_number), 10);
  if (IMPROVEMENT_BY_NUMBER[num]) return IMPROVEMENT_BY_NUMBER[num];

  // Unknown / missing number — use a neutral label rather than a wrong one.
  // (Letter `improvement_type` is deliberately NOT used as a fallback: its
  // meaning differs from the old open-data codes and would mislabel measures.)
  return 'Recommended improvement ' + (imp.sequence || i + 1);
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
    'improvement-number':         (imp.improvement_details && val(imp.improvement_details.improvement_number)) || null,
    'typical-saving':             saving != null ? saving : null,
  };
}

// The new API sometimes returns a field as a {value, language} object instead of
// a plain string/number. Unwrap it so callers never receive an object.
const val = v => (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v) ? v.value : v;
const str = v => { const x = val(v); return x == null ? '' : String(x); };

function detailFrom(d) {
  const firstDesc = a => (Array.isArray(a) && a[0]) ? str(a[0].description) : '';
  return {
    'property-type':               str(d.dwelling_type),
    'walls-description':           firstDesc(d.walls),
    'roof-description':            firstDesc(d.roofs),
    'main-heating-description':    firstDesc(d.main_heating),
    'windows-description':         str(d.window && d.window.description),
    'current-energy-efficiency':   val(d.energy_rating_current),
    'potential-energy-efficiency': val(d.energy_rating_potential),
    'current-energy-rating':       str(d.current_energy_efficiency_band),
    'potential-energy-rating':     str(d.potential_energy_efficiency_band),
    'total-floor-area':            val(d.total_floor_area),
    'registration-date':           str(d.registration_date),
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

module.exports = { fetchCertificate, EPC_API_BASE, EPC_TOKEN, val, str };
