// POST /api/email-assessment
// Sends a free-report "email assessment" request to hello@epc2c.co.uk via SMTP.
// Body: { email, address, postcode, rrn, band, sap, declarations, completedWorks, estimatedPosition }
// Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars.
// No-ops with 503 if SMTP isn't configured, so the client call is always safe.
const nodemailer = require('nodemailer');

const RECIPIENT = 'hello@epc2c.co.uk';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const email = (body.email || '').trim();
  if (!email) { res.status(400).json({ error: 'email required' }); return; }

  const address  = (body.address || 'Unknown property').trim();
  const decl     = body.declarations || {};
  const works    = Array.isArray(body.completedWorks) ? body.completedWorks : [];
  const declLine = `Conservation area: ${decl.conservation ? 'Yes' : 'No'} | Listed: ${decl.listed ? 'Yes' : 'No'} | Owned <6 months: ${decl.owned6 ? 'Yes' : 'No'}`;
  const worksLine= works.length ? works.join(', ') : 'None declared';

  const HOST = process.env.SMTP_HOST, USER = process.env.SMTP_USER, PASS = process.env.SMTP_PASS;
  const PORT = parseInt(process.env.SMTP_PORT || '465', 10);
  if (!HOST || !USER || !PASS) {
    res.status(503).json({ error: 'SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing)' });
    return;
  }
  const from = process.env.SMTP_FROM || `EPC2C <${USER}>`;

  const lines = [
    'A free-report email assessment was requested.',
    '',
    `From (landlord): ${email}`,
    `Property: ${address}`,
    `Postcode: ${body.postcode || '—'}`,
    `RRN: ${body.rrn || '—'}`,
    `Current EPC: ${body.band || '—'}${body.sap ? ' (' + body.sap + ')' : ''}`,
    `Declarations: ${declLine}`,
    `Completed works declared: ${worksLine}`,
    `Estimated position: ${body.estimatedPosition || '—'}`,
  ];

  try {
    const transporter = nodemailer.createTransport({
      host: HOST, port: PORT, secure: PORT === 465, auth: { user: USER, pass: PASS },
    });
    await transporter.sendMail({
      from, to: RECIPIENT, replyTo: email,
      subject: `EPC Assessment Request — ${address}`,
      text: lines.join('\n'),
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2332;line-height:1.7">
        <p><strong>A free-report email assessment was requested.</strong></p>
        <p><strong>From (landlord):</strong> ${email}<br>
        <strong>Property:</strong> ${address}<br>
        <strong>Postcode:</strong> ${body.postcode || '—'}<br>
        <strong>RRN:</strong> ${body.rrn || '—'}<br>
        <strong>Current EPC:</strong> ${body.band || '—'}${body.sap ? ' (' + body.sap + ')' : ''}<br>
        <strong>Declarations:</strong> ${declLine}<br>
        <strong>Completed works declared:</strong> ${worksLine}<br>
        <strong>Estimated position:</strong> ${body.estimatedPosition || '—'}</p>
      </div>`,
    });
    console.log('[email] assessment request from', email, 'for', address);
    res.status(200).json({ sent: true });
  } catch (err) {
    console.error('[email] assessment send failed:', err.message);
    res.status(502).json({ error: err.message });
  }
};
