// ============================================================================
// EPC2C — v1 engine test suite
// Run: node engine-v1.test.js
// Verifies (a) verdicts on known properties, and (b) the GOVERNING RULE that
// the free report and paid report can never deviate.
// ============================================================================
const E = require('./engine-v1.js');

let pass = 0, fail = 0;
function ok(name, cond){ cond ? (pass++, console.log('  \u2713 ' + name))
                              : (fail++, console.log('  \u2717 FAIL: ' + name)); }
function group(t){ console.log('\n' + t); }

// --- Fixtures: property + the verdict we expect ---------------------------
const FIXTURES = [
  { id:'Straightforward — 1996 semi (D60)', currentSAP:60, expect:'Straightforward', measures:[
      {name:'Cavity wall insulation', uplift:5, cMin:500,  cMax:1500},
      {name:'Loft insulation',        uplift:4, cMin:100,  cMax:350},
      {name:'Heating controls',       uplift:3, cMin:350,  cMax:450} ] },

  { id:'Achievable — 1970s terrace (D58)', currentSAP:58, expect:'Achievable', measures:[
      {name:'Loft insulation',        uplift:3, cMin:100,  cMax:350},
      {name:'Cavity wall insulation', uplift:3, cMin:500,  cMax:1500},
      {name:'Solar PV',               uplift:6, cMin:3500, cMax:5500},
      {name:'Heating controls',       uplift:2, cMin:350,  cMax:450} ] },

  { id:'Challenging — solid-wall semi (D60)', currentSAP:60, expect:'Challenging', measures:[
      {name:'Internal wall insulation', uplift:8, cMin:5000, cMax:9000},
      {name:'Solar PV',                 uplift:5, cMin:3500, cMax:5500},
      {name:'Heating controls',         uplift:2, cMin:350,  cMax:450} ] },

  { id:'Exemption — Victorian terrace (E50)', currentSAP:50, expect:'Exemption Candidate', measures:[
      {name:'Internal wall insulation', uplift:10, cMin:5000, cMax:9000},
      {name:'Double glazing',           uplift:5,  cMin:3300, cMax:6500},
      {name:'Loft insulation',          uplift:4,  cMin:100,  cMax:350},
      {name:'Heating controls',         uplift:2,  cMin:350,  cMax:450} ] },

  { id:'Already C — 2005 flat (C71)', currentSAP:71, expect:'Likely compliant', measures:[] },
];

// --- 1. Verdicts ----------------------------------------------------------
group('1. Verdicts match expectation');
FIXTURES.forEach(f => {
  const r = E.evaluate(f);
  const verdict = E.freeReport(r).verdict;
  ok(`${f.id}  ->  ${verdict}`, verdict === f.expect);
});

// --- 2. GOVERNING RULE: free and paid never deviate -----------------------
group('2. Free = paid, redacted (integrity)');
FIXTURES.forEach(f => {
  const r = E.evaluate(f);
  const free = E.freeReport(r);
  const paid = E.paidReport(r);

  // 2a. identical verdict
  ok(`${f.id} — verdict identical in free & paid`, free.verdict === paid.verdict);

  // 2b. paid total sits INSIDE the free cost outlook (reach + exemption)
  if(r.kind === 'reach'){
    ok(`${f.id} — paid total \u00a3${paid.total} inside free outlook \u00a3${free.outlookMin}\u2013\u00a3${free.outlookMax}`,
       paid.total >= free.outlookMin && paid.total <= free.outlookMax);
  }
  if(r.kind === 'exempt'){
    ok(`${f.id} — within-cap spend \u00a3${paid.withinCapSpend} inside free outlook \u00a3${free.outlookMin}\u2013\u00a3${free.outlookMax}`,
       paid.withinCapSpend >= free.outlookMin && paid.withinCapSpend <= free.outlookMax);
  }

  // 2c. free report does NOT leak the measure list (redaction holds)
  ok(`${f.id} — free report hides the measures`, !('measures' in free) && !('withinCapMeasures' in free));
});

// --- 3. Verdict is frozen (recompute yields the same answer) --------------
group('3. Verdict is deterministic / frozen');
FIXTURES.forEach(f => {
  const a = E.freeReport(E.evaluate(f)).verdict;
  const b = E.freeReport(E.evaluate(f)).verdict;
  ok(`${f.id} — re-evaluation gives same verdict`, a === b);
});

// --- 4. Cost cap behaves ---------------------------------------------------
group('4. £10k cost cap logic');
FIXTURES.forEach(f => {
  const r = E.evaluate(f);
  if(r.kind === 'reach')
    ok(`${f.id} — cheapest route \u00a3${r.route.cost} is within the \u00a310k cap`, r.route.cost <= E.COST_CAP);
  if(r.kind === 'exempt'){
    ok(`${f.id} — flagged exemption because cheapest route to C (\u00a3${r.cheapestToCCost}) exceeds cap`,
       r.cheapestToCCost === null || r.cheapestToCCost > E.COST_CAP);
    ok(`${f.id} — within-cap works \u00a3${r.within.cost} are <= cap`, r.within.cost <= E.COST_CAP);
  }
});

// --- 5. Flexibility line --------------------------------------------------
group('5. Route-flexibility line populated for reach cases');
FIXTURES.forEach(f => {
  const r = E.evaluate(f);
  if(r.kind === 'reach'){
    const free = E.freeReport(r);
    ok(`${f.id} — flexibility: "${free.flexibility}"`, /\d+ measure.* · \d+ route/.test(free.flexibility));
  }
});

// ============================================================================
// 6. REAL-EPC FIXTURES
// ----------------------------------------------------------------------------
// Anonymised, representative EPC-register certificates fed through a faithful
// port of the live parser (parseCostRange + the cumulative-EPR uplift derivation
// used by fetchRecs/buildMeasures in public/epc-c-calculator.html). Each record
// is the raw shape the EPC certificate endpoint returns: a current SAP plus the
// recommendation rows with their cumulative `energy-performance-rating` (epr) and
// the register's `indicative-cost` string. We assert the SAME integrity
// invariants on real-shaped data, not just the synthetic fixtures.
//
// NOTE (transparency): these certificates were reconstructed from representative
// EPC-register recommendation data (typical measures + the register's own
// indicative-cost bands). They were NOT pulled from the live EPC API in this run
// because the sandbox has no proxy credentials / network. Marcus should re-run
// the same postcodes through the live proxy to confirm parity end-to-end.
// ----------------------------------------------------------------------------

// --- parser port (mirrors public/epc-c-calculator.html) -------------------
function parseCostRange(s){                       // identical to the calculator
  if(!s)return{min:500,max:2000};
  const nums=(s.match(/[\d,]+/g)||[]).map(x=>parseInt(x.replace(/,/g,'')));
  if(!nums.length)return{min:500,max:2000};
  if(nums.length===1)return{min:nums[0],max:Math.round(nums[0]*1.6)};
  return{min:nums[0],max:nums[1]};
}
// fetchRecs + buildMeasures: per-measure uplift = max(0, eprᵢ − eprᵢ₋₁),
// walking the cumulative ratings up from the certificate's current SAP.
function parseCertificate(cert){
  let prev = cert.currentSAP;
  const measures = cert.recs.map(rec => {
    const epr = rec.epr || prev;
    const uplift = Math.max(0, epr - prev); prev = epr;
    const c = parseCostRange(rec.indicativeCost);
    return { name: rec.name, uplift, cMin: c.min, cMax: c.max };
  });
  return { currentSAP: cert.currentSAP, measures };
}

const REAL = [
  { id:'R1 — 1996 semi (D62), cavity + loft', currentSAP:62, expect:'Straightforward', recs:[
      {name:'Increase loft insulation to 270 mm', epr:64, indicativeCost:'£100 - £350'},
      {name:'Cavity wall insulation',             epr:69, indicativeCost:'£500 - £1,500'},
      {name:'Heating controls (room thermostat)', epr:70, indicativeCost:'£350 - £450'} ] },

  { id:'R2 — 1970s terrace (E54), needs solar', currentSAP:54, expect:'Achievable', recs:[
      {name:'Increase loft insulation to 270 mm', epr:57, indicativeCost:'£100 - £350'},
      {name:'Cavity wall insulation',             epr:60, indicativeCost:'£500 - £1,500'},
      {name:'Solar photovoltaic panels, 2.5 kWp', epr:70, indicativeCost:'£3,500 - £5,500'},
      {name:'Heating controls (room thermostat)', epr:71, indicativeCost:'£350 - £450'} ] },

  { id:'R3 — solid-wall semi (D60), internal wall', currentSAP:60, expect:'Challenging', recs:[
      {name:'Internal or external wall insulation', epr:68, indicativeCost:'£4,000 - £7,000'},
      {name:'Solar photovoltaic panels, 2.5 kWp',   epr:73, indicativeCost:'£3,500 - £5,500'},
      {name:'Heating controls (room thermostat)',   epr:74, indicativeCost:'£350 - £450'} ] },

  { id:'R4 — Victorian terrace (E48), exemption', currentSAP:48, expect:'Exemption Candidate', recs:[
      {name:'Internal or external wall insulation', epr:59, indicativeCost:'£8,000 - £12,000'},
      {name:'Solid floor insulation',               epr:62, indicativeCost:'£4,000 - £6,000'},
      {name:'Replace single glazed windows with double glazing', epr:66, indicativeCost:'£3,300 - £6,500'},
      {name:'Increase loft insulation to 270 mm',   epr:69, indicativeCost:'£100 - £350'},
      {name:'Heating controls (room thermostat)',   epr:70, indicativeCost:'£350 - £450'} ] },

  { id:'R5 — 2005 flat (C72), already compliant', currentSAP:72, expect:'Likely compliant', recs:[
      {name:'Low energy lighting', epr:73, indicativeCost:'£15 - £100'} ] },

  { id:'R6 — 2002 flat (D66), single measure', currentSAP:66, expect:'Straightforward', recs:[
      {name:'Increase loft insulation to 270 mm', epr:70, indicativeCost:'£100 - £350'},
      {name:'Heating controls (room thermostat)', epr:71, indicativeCost:'£350 - £450'},
      {name:'Low energy lighting',                epr:72, indicativeCost:'£20 - £100'} ] },
];

group('6. Real-EPC fixtures — verdict + integrity on parsed certificates');
REAL.forEach(cert => {
  const prop = parseCertificate(cert);
  const r    = E.evaluate(prop);
  const free = E.freeReport(r);
  const paid = E.paidReport(r);

  // 6a. verdict matches expectation
  ok(`${cert.id}  ->  ${free.verdict}`, free.verdict === cert.expect);

  // 6b. governing rule: free.verdict === paid.verdict
  ok(`${cert.id} — verdict identical in free & paid`, free.verdict === paid.verdict);

  // 6c. paid spend sits INSIDE the free cost outlook
  if(r.kind === 'reach')
    ok(`${cert.id} — paid total £${paid.total} inside free outlook £${free.outlookMin}–£${free.outlookMax}`,
       paid.total >= free.outlookMin && paid.total <= free.outlookMax);
  if(r.kind === 'exempt')
    ok(`${cert.id} — within-cap spend £${paid.withinCapSpend} inside free outlook £${free.outlookMin}–£${free.outlookMax}`,
       paid.withinCapSpend >= free.outlookMin && paid.withinCapSpend <= free.outlookMax);

  // 6d. £10k cap respected
  if(r.kind === 'reach')
    ok(`${cert.id} — route £${r.route.cost} within £10k cap`, r.route.cost <= E.COST_CAP);
  if(r.kind === 'exempt'){
    ok(`${cert.id} — flagged exemption because cheapest route to C (£${r.cheapestToCCost}) exceeds cap`,
       r.cheapestToCCost === null || r.cheapestToCCost > E.COST_CAP);
    ok(`${cert.id} — within-cap works £${r.within.cost} <= cap`, r.within.cost <= E.COST_CAP);
  }

  // 6e. redaction holds — free NEVER emits a measure list
  ok(`${cert.id} — free report hides the measures`,
     !('measures' in free) && !('withinCapMeasures' in free));

  // 6f. deterministic / frozen
  ok(`${cert.id} — re-evaluation gives same verdict`,
     E.freeReport(E.evaluate(prop)).verdict === free.verdict);
});

// --- summary --------------------------------------------------------------
console.log(`\n${'='.repeat(60)}\n  ${pass} passed, ${fail} failed\n${'='.repeat(60)}`);
process.exit(fail ? 1 : 0);
