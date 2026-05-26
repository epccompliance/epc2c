// Shared Upstash Redis client for property session storage.
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your Vercel project env vars.
const { Redis } = require('@upstash/redis');

const url   = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.error('[redis] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — session endpoints will fail');
  module.exports = null;
} else {
  module.exports = new Redis({ url, token });
}
