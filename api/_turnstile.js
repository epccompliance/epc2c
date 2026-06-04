const fetch = require('node-fetch');

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Verify a Cloudflare Turnstile token server-side.
//   true  → token valid (or no secret configured, so dev/other envs aren't broken)
//   false → secret configured but token missing/invalid
async function verifyTurnstile(token, remoteip) {
  // Local dev (loopback) uses Cloudflare's always-pass TEST secret, which matches the
  // TEST sitekey the page serves on localhost. Real requests use the configured secret.
  const isLocal = remoteip === '127.0.0.1' || remoteip === '::1' || remoteip === '::ffff:127.0.0.1';
  const secret = isLocal
    ? '1x0000000000000000000000000000000AA'
    : (process.env.TURNSTILE_SECRET || process.env.TURNSTILE_SECRET_KEY || '');
  if (!secret) return true;   // not configured → skip the check
  if (!token)  return false;  // configured but no token supplied → reject

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteip) params.append('remoteip', remoteip);
    const r = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const data = await r.json();
    if (!data || !data.success) {
      console.warn('[turnstile] verify failed:', data && data['error-codes']);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[turnstile] verify error:', err.message);
    return false;
  }
}

module.exports = { verifyTurnstile };
