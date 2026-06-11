// POST /api/stripe-webhook  — durable payment ledger (best-effort, separate from
// the verify-payment unlock gate). Verifies the Stripe signature against the RAW
// request body, then records checkout.session.completed exactly once.
//
// Idempotency: the session id is recorded in Redis (SET NX). A duplicate delivery
// finds the key already set and is skipped. The recorded row goes to Supabase if a
// service-role key is wired; otherwise it is logged. Always returns 2xx quickly so
// Stripe does not retry a successfully-received event.
const Stripe = require('stripe');
const redis  = require('./_redis');

const STRIPE_SECRET  = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const LEDGER_TTL     = 60 * 60 * 24 * 90;   // remember processed sessions for 90 days

// Stripe signature verification needs the unparsed body — the config export at the
// bottom disables Vercel's body parser for this route (it must come AFTER the
// handler assignment, or it gets overwritten).
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Write the ledger row. Supabase if a service-role key is present, else log.
async function record(row) {
  const url        = process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (url && serviceKey) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
      const { error } = await admin.from('payments').insert(row);
      if (error) { console.error('[webhook] supabase insert failed, logging instead:', error.message); console.log('[webhook] LEDGER', JSON.stringify(row)); }
      return;
    } catch (e) {
      console.error('[webhook] supabase client error, logging instead:', e.message);
    }
  }
  console.log('[webhook] LEDGER', JSON.stringify(row));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!STRIPE_SECRET || !WEBHOOK_SECRET) {
    // Misconfigured — acknowledge so Stripe doesn't hammer retries, but do nothing.
    console.error('[webhook] STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not set');
    res.status(200).json({ received: true, skipped: 'not configured' });
    return;
  }

  let event;
  try {
    const raw = await readRawBody(req);
    const sig = req.headers['stripe-signature'];
    const stripe = Stripe(STRIPE_SECRET);
    event = stripe.webhooks.constructEvent(raw, sig, WEBHOOK_SECRET);   // throws on bad signature
  } catch (err) {
    console.error('[webhook] signature verification failed:', err.message);
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;

      // Idempotency: skip if we've already recorded this session.
      if (redis) {
        const fresh = await redis.set(`stripe:session:${s.id}`, '1', { nx: true, ex: LEDGER_TTL });
        if (fresh === null) { res.status(200).json({ received: true, duplicate: true }); return; }
      }

      await record({
        session_id:   s.id,
        amount_total: s.amount_total,
        currency:     s.currency,
        payment_status: s.payment_status,
        email:        (s.customer_details && s.customer_details.email) || null,
        client_reference_id: s.client_reference_id || null,
        created_at:   new Date(((s.created || 0) * 1000) || Date.now()).toISOString(),
      });
    }
    res.status(200).json({ received: true });
  } catch (err) {
    // Don't fail the webhook on a ledger error — the unlock path doesn't depend on it.
    console.error('[webhook] handler error:', err.message);
    res.status(200).json({ received: true, ledger_error: true });
  }
};

// Disable Vercel's body parser so the RAW body is available for signature checks.
// Must be set AFTER the handler assignment above.
module.exports.config = { api: { bodyParser: false } };
