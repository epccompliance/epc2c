// Shared Upstash Redis client — property session storage.
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env vars.
const { Redis } = require('@upstash/redis');

const url   = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.error('[redis] UPSTASH env vars missing — /save-property and /get-property will fail');
  module.exports = null;
} else {
  module.exports = new Redis({ url, token });
}
