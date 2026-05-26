const { randomUUID } = require('crypto');
const redis = require('./_redis');

const TTL = 7200; // 2 hours in seconds

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!redis) {
    res.status(503).json({ error: 'Session storage not configured (UPSTASH env vars missing)' });
    return;
  }

  const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    res.status(400).json({ error: 'property object required in request body' });
    return;
  }

  const sessionId = randomUUID();
  await redis.set(sessionId, JSON.stringify(data), { ex: TTL });
  console.log(`[session] saved  ${sessionId}  addr="${data.addr || '?'}"`);
  res.status(200).json({ sessionId });
};
