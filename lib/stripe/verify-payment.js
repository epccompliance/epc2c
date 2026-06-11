// POST /api/verify-payment   body: { session_id, expected? }   -> { paid, product, ... }
//
// The PRIMARY unlock gate for the paid report. It confirms payment DIRECTLY with
// Stripe (checkout.sessions.retrieve) and never trusts a URL param. It does NOT
// depend on Supabase — a paid:true here is sufficient (and required) to unlock.
//
// A session unlocks only when BOTH hold:
//   • session.payment_status === 'paid'
//   • amount_total matches one of our known product prices (and, if the client
//     passed `expected`, that specific product's price).
const Stripe = require('stripe');

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || '';

// Expected amounts in the smallest currency unit (pence). The paid-report unlock
// is keyed to the £19.99 plan; visit/epc are recognised so the client can show
// the right post-purchase message.
const EXPECTED = {
  plan:  1999,   // £19.99 compliance plan  (unlocks the paid report)
  visit: 14900,  // £149   site visit
  epc:   9900,   // £99    fresh EPC
};

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ paid: false, error: 'Method not allowed' }); return; }

  if (!STRIPE_SECRET) {
    res.status(503).json({ paid: false, error: 'Stripe not configured (STRIPE_SECRET_KEY missing)' });
    return;
  }

  const body = parseBody(req);
  const sessionId = body.session_id || (req.query && req.query.session_id);
  const expected  = body.expected || null;   // optional: 'plan' | 'visit' | 'epc'
  if (!sessionId) { res.status(400).json({ paid: false, error: 'session_id required' }); return; }

  try {
    const stripe  = Stripe(STRIPE_SECRET);
    const session = await stripe.checkout.sessions.retrieve(String(sessionId));

    const amount      = session.amount_total;
    const isPaid      = session.payment_status === 'paid';
    const product     = Object.keys(EXPECTED).find(k => EXPECTED[k] === amount) || null;
    const amountOk    = expected ? (amount === EXPECTED[expected]) : !!product;
    const paid        = isPaid && amountOk;

    res.status(200).json({
      paid,
      product,                                   // 'plan' | 'visit' | 'epc' | null
      payment_status: session.payment_status,    // 'paid' | 'unpaid' | 'no_payment_required'
      amount_total: amount,
      currency: session.currency,
    });
  } catch (err) {
    // Unknown/invalid session id, or Stripe error -> treat as not paid.
    console.error('[verify-payment]', err.message);
    res.status(200).json({ paid: false, error: 'Could not verify session' });
  }
};
