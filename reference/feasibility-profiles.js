/* ============================================================================
   EPC2C — Feasibility profile library  (v1, for review)
   ----------------------------------------------------------------------------
   One profile per measure TYPE. It does NOT assess a specific property — it
   describes the conditions a measure of this type needs in order to be fitted,
   what an "(assumed)" element on the EPC implies for it, and which exemption a
   genuine infeasibility points toward.

   Design rules (carry the governing "genuine & truthful" principle):
   • These are CONDITIONS TO CHECK, never assertions of fact. The engine cannot
     see a loft hatch or a roof's orientation, so every line is framed as
     "you'd need… / worth checking…", not "there is no…".
   • "assumed" on an EPC means the assessor did NOT verify the element (RdSAP
     used an age/type default). It does NOT, by itself, mean "no access" — that
     reading is reasonable for lofts (you can't see loft insulation without
     getting in) but NOT for walls, where "(assumed)" is near-universal and says
     nothing about access.
   • By default a measure is ASSUMED FEASIBLE — these profiles annotate the PAID
     report; they do not change the engine's verdict. Actual infeasibility is a
     human/survey step that can re-run the engine and open an exemption.

   Placement: PAID report only (it's measure-specific; the free report never
   names measures). The free report carries one generic, measure-blind caveat.

   NOTE FOR MARCUS: content is a first pass for you to review/refine as the
   domain expert. Figures (e.g. hatch size) are indicative working values.
   ============================================================================ */

const FEASIBILITY = {

  loft: {
    label: 'Loft / roof insulation',
    feasibilityClass: 'usually-feasible',          // access permitting
    conditions: [
      'A usable loft hatch (ideally ~600×400mm) and enough headroom to work safely.',
      'If the loft is boarded, boards may need lifting — or raising on battens — so insulation depth isn’t crushed.',
      'Stored items cleared from the area to be treated.',
      'Eaves ventilation kept clear to avoid condensation once insulated.',
      'No active leaks or damp in the roof first.'
    ],
    assumedMeans:
      'Loft insulation can’t be seen without entering the loft, so "assumed" usually means it wasn’t accessed or confirmed. Two implications: it may already be insulated (a fresh EPC could show you’re closer to C), or access is the very thing that makes the job harder.',
    clearingBlocker: 'Fitting a larger hatch or raising boarding on battens — typically a few hundred pounds.',
    ifInfeasible: 'all-relevant-improvements'
  },

  'room-in-roof': {
    label: 'Room-in-roof insulation',
    feasibilityClass: 'site-dependent',
    conditions: [
      'Applies where the roof space is a converted habitable room.',
      'Sloping ceilings, stud walls and small flat-ceiling sections all need treating — often from inside, losing a little room space, or by removing and reinstating plasterboard.',
      'Dormers and party walls complicate the detailing.'
    ],
    assumedMeans:
      'These build-ups are rarely fully inspectable, so "(assumed)" is common and implies the construction was taken from the property’s age/type rather than confirmed.',
    clearingBlocker: 'Plasterboard removal/reinstatement and redecoration where insulating from inside.',
    ifInfeasible: 'negative-impacts'
  },

  cavity: {
    label: 'Cavity wall insulation',
    feasibilityClass: 'site-dependent',            // construction-dependent
    conditions: [
      'Walls must actually be cavity construction with an unfilled cavity of suitable width.',
      'Walls in sound condition — no penetrating damp, good pointing/render.',
      'Exposure suitable — very exposed, wind-driven-rain locations may be unsuitable for fill.',
      'Not already filled (very commonly it is).'
    ],
    assumedMeans:
      'Wall insulation is almost never verifiable without intrusive inspection, so "(assumed)" is near-universal on walls — it implies nothing about access, only that the age/type default was used. The real question is whether the cavity is already filled; a borescope check or fresh EPC settles it.',
    clearingBlocker: 'Borescope survey to confirm cavity is open and unfilled before quoting fill.',
    ifInfeasible: 'all-relevant-improvements'
  },

  iwi: {
    label: 'Solid wall insulation — internal (IWI)',
    feasibilityClass: 'needs-survey',
    conditions: [
      'For solid (no-cavity) walls.',
      'Reduces internal room dimensions slightly.',
      'Skirting, sockets, radiators and coving need removing and refitting; rooms cleared and treated one at a time.',
      'Condensation/damp risk if detailing is wrong — needs proper (PAS 2035) design.'
    ],
    assumedMeans:
      'Solid-wall construction is often taken from the property’s age, and the presence of any insulation can’t be seen — so "(assumed)" here reflects the default, not an access problem.',
    clearingBlocker: 'PAS 2035 retrofit design + making good (decoration, joinery) after install.',
    ifInfeasible: 'negative-impacts | solid-wall-opt-out | consent'
  },

  ewi: {
    label: 'Solid wall insulation — external (EWI)',
    feasibilityClass: 'needs-survey',
    conditions: [
      'For solid walls.',
      'Changes external appearance — planning permission often needed, especially in conservation areas or on flats.',
      'Sound substrate, adequate eaves/verge overhang (or new detailing), and pipework/services moved.',
      'Scaffolding access to all treated elevations; not applied over existing damp.'
    ],
    assumedMeans:
      'As internal — construction taken from age, insulation not visible, so "(assumed)" is the default rather than evidence of anything.',
    clearingBlocker: 'Planning application + detailing at eaves, sills and boundaries; scaffolding.',
    ifInfeasible: 'consent | negative-impacts | solid-wall-opt-out'
  },

  floor: {
    label: 'Floor insulation',
    feasibilityClass: 'site-dependent',
    conditions: [
      'Suspended timber floor: needs underfloor (crawl-space) access or floorboards lifted; underfloor ventilation must be maintained.',
      'Solid floor: insulating means raising the floor level — affecting door heights and thresholds — and is far more disruptive.',
      'No untreated damp below the floor.'
    ],
    assumedMeans:
      'Floor build-up is rarely inspected and floor type (solid vs suspended) is often inferred from age, so "(assumed)" is common here.',
    clearingBlocker: 'Lifting/relaying floor finishes; door and threshold adjustments for solid floors.',
    ifInfeasible: 'negative-impacts | all-relevant-improvements'
  },

  solar: {
    label: 'Solar PV',
    feasibilityClass: 'site-dependent',
    conditions: [
      'A suitable roof: reasonable orientation (broadly south/east/west, not heavily shaded north), workable pitch, minimal overshadowing.',
      'Roof structure sound and able to carry the load.',
      'Enough clear, unobstructed roof area, plus a sensible position for the inverter.',
      'DNO notification (and approval for larger systems); scaffolding access. Listed/conservation status may restrict visible panels.'
    ],
    assumedMeans:
      'Generation is recorded as present/absent rather than "assumed", so the question here is roof feasibility rather than an unverified baseline.',
    clearingBlocker: 'Structural check / DNO application; alternative roof slopes if the main aspect is poor.',
    ifInfeasible: 'consent | all-relevant-improvements'
  },

  heatpump: {
    label: 'Air-source heat pump',
    feasibilityClass: 'needs-survey',
    conditions: [
      'External space for the unit with clear airflow and acceptable noise distance to boundaries and neighbouring windows.',
      'Emitters (radiators/underfloor) often need upsizing for lower flow temperatures.',
      'Space for a hot-water cylinder; adequate electrical supply.',
      'Works best in a reasonably insulated home; planning/permitted-development limits apply; MCS install needed for the grant.'
    ],
    assumedMeans:
      'The heating system is normally inspected, so it’s less likely to be "(assumed)" than fabric elements.',
    clearingBlocker: 'Emitter upgrades + cylinder; fabric-first measures if the home is leaky.',
    ifInfeasible: 'consent | negative-impacts | all-relevant-improvements'
    // NOTE: gross vs net-of-£7,500 BUS grant cost treatment is still parked (flips cost score).
  },

  glazing: {
    label: 'Double / secondary glazing',
    feasibilityClass: 'usually-feasible',          // listed permitting
    conditions: [
      'Replacing single glazing with double is generally straightforward.',
      'Listed buildings / conservation areas may require secondary glazing or specific approved units (consent).',
      'Window openings and surrounds structurally sound.'
    ],
    assumedMeans:
      'Glazing is usually visible and recorded from inspection, so it’s less commonly "(assumed)".',
    clearingBlocker: 'Listed-building / conservation consent where applicable.',
    ifInfeasible: 'consent'
  },

  controls: {
    label: 'Heating controls',
    feasibilityClass: 'usually-feasible',
    conditions: [
      'A programmer, room thermostat and thermostatic radiator valves, compatible with the existing boiler/system.',
      'Straightforward fit with minimal disruption.'
    ],
    assumedMeans:
      'Controls are normally observed during the assessment, so rarely "(assumed)".',
    clearingBlocker: null,
    ifInfeasible: null
  },

  draught: {
    label: 'Draught-proofing',
    feasibilityClass: 'usually-feasible',
    conditions: [
      'Around doors, windows, loft hatches and floors.',
      'Retain necessary background ventilation — don’t over-seal, or condensation risk rises.'
    ],
    assumedMeans:
      'Not typically an "(assumed)" element.',
    clearingBlocker: null,
    ifInfeasible: null
  },

  cylinder: {
    label: 'Hot-water cylinder insulation',
    feasibilityClass: 'usually-feasible',
    conditions: [
      'Applies where there’s an accessible cylinder without adequate factory foam or a jacket.',
      'Simple to fit.'
    ],
    assumedMeans:
      'Usually observed during the assessment.',
    clearingBlocker: null,
    ifInfeasible: null
  },

  'flat-roof': {
    label: 'Flat-roof insulation',
    feasibilityClass: 'site-dependent',
    conditions: [
      'Best done when the roof covering is replaced (warm-deck build-up) — tie it to any re-roofing.',
      'Cold-deck retrofits carry condensation risk and need careful detailing.',
      'Structural and access check first.'
    ],
    assumedMeans:
      'Flat-roof build-up is rarely inspectable, so "(assumed)" is common.',
    clearingBlocker: 'Coordinate with re-roofing; warm-deck detailing.',
    ifInfeasible: 'negative-impacts | all-relevant-improvements'
  }

};

/* ----------------------------------------------------------------------------
   Resolver: map an engine measure name / EPC recommendation text to a profile.
   Lower-cases and looks for keywords so it tolerates the varied wording the EPC
   register uses (e.g. "Increase loft insulation to 270 mm").
   Returns the profile object, or null if nothing matches.
   ---------------------------------------------------------------------------- */
function feasibilityFor(measureText) {
  if (!measureText) return null;
  const t = String(measureText).toLowerCase();
  const has = (...ks) => ks.some(k => t.includes(k));

  if (has('room in roof', 'room-in-roof'))                 return FEASIBILITY['room-in-roof'];
  if (has('loft', 'roof insulation') && !has('flat'))      return FEASIBILITY.loft;
  if (has('flat roof'))                                     return FEASIBILITY['flat-roof'];
  if (has('cavity'))                                        return FEASIBILITY.cavity;
  if (has('internal wall', 'internal solid'))              return FEASIBILITY.iwi;
  if (has('external wall', 'external solid'))              return FEASIBILITY.ewi;
  if (has('solid wall'))                                    return FEASIBILITY.iwi; // default solid→internal
  if (has('floor insulation', 'underfloor'))              return FEASIBILITY.floor;
  if (has('solar', 'photovoltaic', 'pv'))                 return FEASIBILITY.solar;
  if (has('heat pump', 'heat-pump'))                       return FEASIBILITY.heatpump;
  if (has('glaz', 'window'))                               return FEASIBILITY.glazing;
  if (has('control', 'thermostat', 'programmer', 'trv'))  return FEASIBILITY.controls;
  if (has('draught', 'draft'))                             return FEASIBILITY.draught;
  if (has('cylinder', 'hot water tank'))                  return FEASIBILITY.cylinder;
  return null;
}

/* Detect whether an EPC element description was assumed (provenance flag).
   The "(assumed)" marker sits inside the register's *-description fields. */
function isAssumed(elementDescription) {
  return !!elementDescription && /assumed/i.test(String(elementDescription));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FEASIBILITY, feasibilityFor, isAssumed };
}
