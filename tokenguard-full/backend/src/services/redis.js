import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
  reconnectOnError: () => true,
});

redis.on('error', (err) => console.error('[Redis]', err.message));
redis.on('connect', () => console.log('[Redis] conectado'));

// ── helpers ───────────────────────────────────────────────────────
export const revokeToken = (jti, ttl) =>
  redis.setex(`revoked:${jti}`, ttl, '1');

export const isRevoked = (jti) =>
  redis.exists(`revoked:${jti}`);

export const bindSession = (jti, sessionId, ttl) =>
  redis.setex(`session:${jti}`, ttl, sessionId);

export const getSession = (jti) =>
  redis.get(`session:${jti}`);

export const incrHits = (jti, ttl) =>
  redis.multi().incr(`hits:${jti}`).expire(`hits:${jti}`, ttl).exec()
    .then(r => r[0][1]); // retorna o novo valor do contador
