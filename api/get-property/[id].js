const redis = require('../_redis');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!redis) {
    res.status(503).json({ error: 'Session storage not configured (UPSTASH env vars missing)' });
    return;
  }

  const { id } = req.query;
  if (!id) { res.status(400).json({ error: 'id required' }); return; }

  const raw = await redis.get(id);
  if (!raw) {
    res.status(404).json({ error: 'session not found or expired' });
    return;
  }

  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  console.log(`[session] fetched ${id}  addr="${data.addr || '?'}"`);
  res.status(200).json(data);
};
