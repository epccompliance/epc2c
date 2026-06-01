// GET    /api/reports/:id  → fetch one report + its property (powers /report/[id])
// DELETE /api/reports/:id  → delete one report
//
// RLS lets a user touch only reports whose property they own, so another user's
// id simply returns 404 (existence is not leaked).
const { requireUser, cors } = require('../_supabase');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const auth = await requireUser(req, res);
  if (!auth) return;
  const { supabase } = auth;

  const { id } = req.query;
  if (!id) { res.status(400).json({ error: 'report id required' }); return; }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('reports')
      .select('*, property:properties(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!data)  { res.status(404).json({ error: 'report not found' }); return; }
    res.status(200).json({ report: data });
    return;
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('reports').delete().eq('id', id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(204).end();
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
