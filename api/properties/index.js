// GET  /api/properties  → list the signed-in user's saved properties (dashboard)
// POST /api/properties  → save a property search
//
// Table: public.properties  (owned directly via user_id; RLS: auth.uid() = user_id)
const { requireUser, cors, parseBody } = require('../_supabase');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const auth = await requireUser(req, res);
  if (!auth) return;
  const { supabase, user } = auth;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('properties')
      .select('id, address, postcode, uprn, epc_rrn, created_at')
      .order('created_at', { ascending: false });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ properties: data });
    return;
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    // user_id is set explicitly from the authenticated user; the RLS with_check
    // (auth.uid() = user_id) then guarantees a user can only insert as themselves.
    const row = {
      user_id:       user.id,
      address:       body.address       ?? null,
      postcode:      body.postcode      ?? null,
      uprn:          body.uprn          ?? null,
      epc_rrn:       body.epc_rrn       ?? null,
      epc_data_json: body.epc_data_json ?? null,
    };
    const { data, error } = await supabase
      .from('properties')
      .insert(row)
      .select('id')
      .single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.status(201).json({ id: data.id });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
