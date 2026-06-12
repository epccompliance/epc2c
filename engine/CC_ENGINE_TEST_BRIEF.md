# Claude Code task — test the v1 scoring engine (free & paid reports)

**Branch only. Do not commit until Marcus has reviewed. Do not deploy.**
Ignore `NEXT_SESSION.md` in the repo root — it is stale (references Railway/SiteGround; we are on Vercel + Supabase).

The goal of this task is **not** to redesign the engine. It is to stand the v1 engine up in a *testable* form and prove one property holds on every input:

> **GOVERNING RULE — the free report and the paid report must never deviate.**
> One engine, one cost source, computed once. The free report is the paid report
> with detail rows **redacted**. The verdict is **frozen** at generation — the paid
> report *reveals* detail, it never recomputes.

---

## What you're given

Two reference files (drop them into the repo, e.g. `engine/`):

- **`engine-v1.js`** — the engine as a pure, dependency-free module. `evaluate(property)` runs the single computation; `freeReport(r)` and `paidReport(r)` derive the two views from that one result. This is the spec.
- **`engine-v1.test.js`** — 32 assertions covering verdicts, the integrity rule, determinism, the £10k cap, and the flexibility line.

First thing: `node engine-v1.test.js` → must print **32 passed, 0 failed**. If it doesn't, stop and report.

---

## v1 spec (what the engine must do)

**Cost source (v1):** the EPC register's indicative figures only. In production this is `rec['indicative-cost']` → `parseCostRange()` → `cMin`/`cMax` (already in `buildMeasures`, ~line 1098). The engine uses the **midpoint** for scoring. The **same** measure list with the **same** costs must feed both the free verdict and the paid plan — do not introduce a second cost path.

Add this disclaimer wherever costs are shown:
> *Cost estimates are indicative, based on the official EPC register's figures, and are a guide only. Actual installer quotes may be higher. Get quotes before committing to works.*

**Pipeline (see `evaluate()` in `engine-v1.js`):**
1. Gate — `currentSAP >= 69` → already compliant → £99 new-EPC route.
2. Enumerate every measure subset; keep those reaching C (`finalSAP >= 69`) **and** within the **£10,000 cap**, sorted by cost.
3. If any exist → cheapest is the route. Score it:
   - Cost (1–5): `<£2k=1 · £2–5k=2 · £5–7.5k=3 · £7.5–10k=4 · £10k+=5`
   - Disruption (1–5): worst single measure (lookup in `disruptionScore`)
   - Complexity (1–5): `min(4, route size)`
   - **Index = 0.40·Cost + 0.35·Disruption + 0.25·Complexity**
   - Verdict: `≤2.0 Straightforward · ≤3.0 Achievable · ≤4.0 Challenging · >4.0 Major Project`
   - Guard: any axis ≥4 forces at least Challenging.
4. If none reach C within the cap → **Exemption Candidate**. Compute `bestWithinCap()` (max uplift subset costing ≤£10k) — the works the landlord installs before registering a cost-cap exemption.

**Free report shows (diagnosis):** verdict · cost outlook (route `cMin`–`cMax`) · disruption word · route flexibility (`as few as N measures · X routes`) · exemption indicator. **Never the measures.**

**Paid report shows (prescription):** same frozen verdict · the specific measures · per-measure cost + total · projected band · for exemptions, the within-cap works + "register cost-cap exemption."

**Verdict → outcome/CTA:** already-C → £99 · Straightforward/Achievable/Challenging → £24.99 plan · Major Project → £149 consultation · Exemption Candidate → £149 specialist.

⚠️ **Do not change** the weights (0.40/0.35/0.25) or band thresholds (2.0/3.0/4.0). They are pending Marcus's sign-off — leave exactly as in `engine-v1.js` and flag in your PR notes.

---

## Tasks

1. **Land the reference engine + tests.** Add both files, run the suite, confirm 32/32.

2. **Wire the engine into `public/epc-c-calculator.html`.** Today the logic is scattered — `buildMeasures` (~1098), `evalCombos` (~1489), `renderFrOutcome` (~1537–1676, the old 4-outcome funnel). Refactor so there is **one** `evaluate()` matching `engine-v1.js`, and the free + paid renderers consume `freeReport()` / `paidReport()`. The renderers must **read** the result, not re-run scoring. Keep `parseCostRange`/`indicative-cost` as the cost feed.

3. **Add real-EPC fixtures.** Run 5–10 real (anonymised) certificates through the live parser, capture `evaluate()` output, and extend `engine-v1.test.js` with them — asserting the same integrity invariants on real data, not just the synthetic fixtures.

4. **Assert integrity in the browser too.** On every result render (dev build), check `paid.total` ∈ `[free.outlookMin, free.outlookMax]` and `free.verdict === paid.verdict`; `console.error` if either fails. This is the canary that catches any future regression of the governing rule.

5. **Report back:** test output (synthetic + real fixtures), any property where the verdict felt wrong, and confirmation that free never emits a measure list.

---

## Out of scope for v1 (parked — do **not** build now)

- The component `RATES` cost table (labour/materials/extras) — that is the **v2** cost source; v1 stays on EPC indicative.
- The secondary exemption-signal layer (solid-wall / leasehold-consent flags).
- Area-based (£/m²) costing for loft/floors/IWI/EWI.
- PDF report output.

Keep these untouched so v1 stays small and shippable.
