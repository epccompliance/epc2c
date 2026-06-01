// GET  /api/reports   → list the signed-in user's reports, with their property
// POST /api/reports   → create a report against one of the user's properties
//
// Table: public.reports  (ownership flows through property_id -> properties.user_id)
const { requireUser, cors, parseBody } = require('../_supabase');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const auth = await requireUser(req, res);
  if (!auth) return;
  const { supabase } = auth;

  // ── List ────────────────────────────────────────────────────────────────────
  // RLS filters to reports whose property belongs to this user. The embedded
  // property gives the dashboard the address/postcode to display.
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('reports')
      .select('id, payment_status, pdf_url, created_at, property:properties(id, address, postcode, epc_rrn)')
      .order('created_at', { ascending: false });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ reports: data });
    return;
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = parseBody(req);
    if (!body.property_id) {
      res.status(400).json({ error: 'property_id is required' });
      return;
    }
    // payment_status is NOT taken from the client — a report starts 'unpaid' and
    // is only marked paid by a server-side payment webhook (service key, future).
    const row = {
      property_id:            body.property_id,
      selected_measures_json: body.selected_measures_json ?? null,
      pathway_results_json:   body.pathway_results_json   ?? null,
      exemption_results_json: body.exemption_results_json ?? null,
      pdf_url:                body.pdf_url                ?? null,
      payment_status:         'unpaid',
    };
    // RLS with_check rejects the insert (returns an error) if property_id does
    // not belong to the authenticated user — so cross-user writes are impossible.
    const { data, error } = await supabase
      .from('reports')
      .insert(row)
      .select('id')
      .single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json({ id: data.id });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
