// POST /api/send-plan-email  { email, address }
// Sends the post-purchase "your compliance plan is ready" email via SMTP.
// Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars (SiteGround).
// No-ops with 503 if SMTP isn't configured, so the client call is always safe.
const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const email   = (body.email || '').trim();
  const address = (body.address || 'your property').trim();
  if (!email) { res.status(400).json({ error: 'email required' }); return; }

  const HOST = process.env.SMTP_HOST, USER = process.env.SMTP_USER, PASS = process.env.SMTP_PASS;
  const PORT = parseInt(process.env.SMTP_PORT || '465', 10);
  if (!HOST || !USER || !PASS) {
    res.status(503).json({ error: 'SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing)' });
    return;
  }

  const dash = (process.env.SITE_URL || 'https://www.epc2c.co.uk') + '/dashboard';
  const from = process.env.SMTP_FROM || `EPC2C <${USER}>`;

  try {
    const transporter = nodemailer.createTransport({
      host: HOST, port: PORT, secure: PORT === 465, auth: { user: USER, pass: PASS },
    });
    await transporter.sendMail({
      from, to: email,
      subject: 'Your EPC2C Compliance Plan is ready',
      text: `Thank you for your purchase.\n\nYour compliance plan for ${address} is ready to access.\nAccess your compliance plan: ${dash}\n\nGoGreen Alliance · hello@epc2c.co.uk`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1a2332;line-height:1.6">
        <p>Thank you for your purchase.</p>
        <p>Your compliance plan for <strong>${address}</strong> is ready to access.</p>
        <p><a href="${dash}" style="display:inline-block;background:#4ecba8;color:#0f1e33;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:8px">Access your compliance plan →</a></p>
        <p style="color:#6b7280;font-size:13px;margin-top:20px">GoGreen Alliance · hello@epc2c.co.uk</p>
      </div>`,
    });
    console.log('[email] sent plan-ready to', email);
    res.status(200).json({ sent: true });
  } catch (err) {
    console.error('[email] send failed:', err.message);
    res.status(502).json({ error: err.message });
  }
};
