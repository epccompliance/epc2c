// ============================================================================
// EPC2C — v1 Difficulty Engine (reference implementation, pure & testable)
// ----------------------------------------------------------------------------
// GOVERNING RULE (must never be violated):
//   • ONE engine, ONE cost source, computed ONCE.
//   • The FREE report is the PAID report with detail rows REDACTED.
//   • The verdict is FROZEN at generation. Paid REVEALS detail, never recomputes.
//
// v1 cost source: EPC register indicative costs (cMin/cMax per measure -> midpoint).
//                 In production these come from rec['indicative-cost'] via
//                 parseCostRange(). Here they are passed in as cMin/cMax so the
//                 engine stays pure and unit-testable.
// ============================================================================

const TARGET_SAP = 69;     // EPC band C threshold
const COST_CAP   = 10000;  // £10,000 cost cap (confirmed Jan 2026, Warm Homes Plan)

const mid = m => Math.round((m.cMin + m.cMax) / 2);

// --- the three sub-scores -------------------------------------------------
function costScore(c){ return c<2000 ? 1 : c<5000 ? 2 : c<7500 ? 3 : c<10000 ? 4 : 5; }

function disruptionScore(name){
  const t = name.toLowerCase();
  if(/first time central|solid floor/.test(t)) return 5;
  if(/internal wall|external wall|heat pump|air or ground|room.?in.?roof|flat roof|sloping/.test(t)) return 4;
  if(/floor insulation/.test(t)) return /suspended/.test(t) ? 3 : 4;
  if(/solar|photovolt|\bpv\b|double glaz|secondary glaz/.test(t)) return 3;
  if(/loft|cavity/.test(t)) return 2;
  if(/heating control|draught|cylinder|low energy|hot water/.test(t)) return 1;
  return 2;
}

const difficultyIndex = (C,D,X) => 0.40*C + 0.35*D + 0.25*X;

function verdictFromIndex(index, C, D, X){
  let b = index<=2.0 ? 1 : index<=3.0 ? 2 : index<=4.0 ? 3 : 4;
  if(Math.max(C,D,X) >= 4) b = Math.max(b, 3);   // guard: any single axis >=4 forces >= Challenging
  return ['', 'Straightforward', 'Achievable', 'Challenging', 'Major Project'][b];
}

function sapToBand(s){ return s>=92?'A':s>=81?'B':s>=69?'C':s>=55?'D':s>=39?'E':s>=21?'F':'G'; }

// --- enumeration ----------------------------------------------------------
// Every non-empty subset of the available measures, with its totals.
function enumerate(measures, baseSAP){
  const n = measures.length, out = [];
  for(let k=1; k<(1<<n); k++){
    let uplift=0, cost=0, cMin=0, cMax=0; const sub=[];
    for(let i=0;i<n;i++) if(k & (1<<i)){
      const m = measures[i];
      uplift += m.uplift; cost += mid(m); cMin += m.cMin; cMax += m.cMax; sub.push(m);
    }
    out.push({ uplift, cost, cMin, cMax, size: sub.length, measures: sub, finalSAP: baseSAP+uplift });
  }
  return out;
}

// Best improvement achievable within the cap (max uplift; tie-break cheapest).
// Used for exemption candidates: the works the landlord must install before
// registering a cost-cap exemption.
function bestWithinCap(combos, cap){
  return combos.filter(c => c.cost <= cap)
               .sort((a,b) => b.uplift - a.uplift || a.cost - b.cost)[0] || null;
}

// ============================================================================
// THE SINGLE COMPUTATION — call once per property.
// ============================================================================
function evaluate(property){
  const { currentSAP, measures } = property;

  // Gate: already at C -> no engine run.
  if(currentSAP >= TARGET_SAP){
    return { kind:'already', currentSAP, band: sapToBand(currentSAP) };
  }

  const all = enumerate(measures, currentSAP);
  const toC = all.filter(c => c.finalSAP >= TARGET_SAP && c.cost <= COST_CAP)
                 .sort((a,b) => a.cost - b.cost);

  if(toC.length){
    const route = toC[0];                                  // cheapest route to C within cap
    const C = costScore(route.cost);
    const D = Math.max(...route.measures.map(m => disruptionScore(m.name)));
    const X = Math.min(4, route.size);
    const index = difficultyIndex(C, D, X);
    return {
      kind: 'reach',
      route, C, D, X, index,
      verdict: verdictFromIndex(index, C, D, X),
      minMeasures: Math.min(...toC.map(c => c.size)),      // simplest route size
      routeCount:  toC.length,                             // how many ways to C
    };
  }

  // No route to C within the cap -> exemption candidate.
  const cheapestToC = all.filter(c => c.finalSAP >= TARGET_SAP).sort((a,b)=>a.cost-b.cost)[0] || null;
  const within = bestWithinCap(all, COST_CAP);
  return {
    kind: 'exempt',
    verdict: 'Exemption Candidate',
    cheapestToCCost: cheapestToC ? cheapestToC.cost : null, // null = C unreachable at any cost
    within,
    withinBand: sapToBand(within.finalSAP),
  };
}

// ============================================================================
// FREE REPORT — a REDACTED view of the one computation (diagnosis only).
//   Shows the SHAPE of the problem; never names the measures.
// ============================================================================
function freeReport(r){
  if(r.kind === 'already')
    return { verdict:'Likely compliant', band:r.band, cta:'Order a new EPC — £99' };

  if(r.kind === 'reach')
    return {
      verdict:     r.verdict,
      outlookMin:  r.route.cMin,
      outlookMax:  r.route.cMax,
      disruption:  ['','Minimal','Low','Moderate','High','Major'][r.D],
      flexibility: `as few as ${r.minMeasures} measure${r.minMeasures>1?'s':''} · ${r.routeCount} route${r.routeCount>1?'s':''}`,
      exemption:   'No',
      cta:         r.verdict === 'Major Project' ? 'Book a consultation — £149' : 'Get my plan — £24.99',
      // measures intentionally OMITTED (redacted)
    };

  return { // exemption
    verdict:           r.verdict,
    bestReachableBand: r.withinBand,
    bestReachableSAP:  r.within.finalSAP,
    outlookMin:        r.within.cMin,
    outlookMax:        r.within.cMax,
    exemption:         'Likely',
    cta:               'Book a specialist — £149',
  };
}

// ============================================================================
// PAID REPORT — the FULL view of the SAME computation (prescription).
//   Reveals the rows the free report hid. NO recomputation.
// ============================================================================
function paidReport(r){
  if(r.kind === 'already')
    return { verdict:'Likely compliant', note:'Already meets C — lodge a new EPC (£99).' };

  if(r.kind === 'reach')
    return {
      verdict:       r.verdict,                                   // identical to free
      measures:      r.route.measures.map(m => ({ name:m.name, cost: mid(m) })),
      total:         r.route.cost,
      projectedSAP:  r.route.finalSAP,
      projectedBand: sapToBand(r.route.finalSAP),
    };

  return { // exemption — the within-cap works + the exemption route
    verdict:          r.verdict,
    withinCapMeasures: r.within.measures.map(m => ({ name:m.name, cost: mid(m) })),
    withinCapSpend:   r.within.cost,
    reaches:          `${r.withinBand} (${r.within.finalSAP}) — short of C`,
    next:             'register cost-cap exemption',
    cheapestToCCost:  r.cheapestToCCost,
  };
}

module.exports = {
  TARGET_SAP, COST_CAP,
  evaluate, freeReport, paidReport,
  costScore, disruptionScore, difficultyIndex, verdictFromIndex, sapToBand,
  enumerate, bestWithinCap, mid,
};
