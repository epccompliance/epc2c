// Shared Supabase helpers for EPC2C serverless API routes.
//
// We build a *user-scoped* client from the caller's access token — the JWT the
// browser holds after magic-link sign-in, sent as `Authorization: Bearer <jwt>`.
// Every query through that client runs AS the signed-in user, so Row Level
// Security enforces per-user isolation automatically. No service_role key is
// used here, so a bug in a route can never read another user's data.
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL      = process.env.SUPABASE_URL      || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[supabase] SUPABASE_URL / SUPABASE_ANON_KEY not set — report routes will fail');
}

// Extract the bearer token from the Authorization header.
function getToken(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

// A Supabase client that acts as the signed-in user (RLS enforced).
function userClient(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
}

// Standard CORS for browser calls that carry the Authorization header.
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Gate a request behind authentication.
// On success returns { supabase, user }. On failure it writes the error
// response and returns null — callers should `if (!auth) return;`.
async function requireUser(req, res) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(503).json({ error: 'Supabase not configured (SUPABASE_URL / SUPABASE_ANON_KEY missing)' });
    return null;
  }
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required — sign in to continue' });
    return null;
  }
  const supabase = userClient(token);
  // Validate the token against the Supabase auth server.
  const { data: { user } = {}, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired session — please sign in again' });
    return null;
  }
  return { supabase, user };
}

// Parse a JSON body whether Vercel pre-parsed it or handed us a raw string.
function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

module.exports = { getToken, userClient, requireUser, cors, parseBody };
