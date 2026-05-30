import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
  reconnectOnError: () => true,
  enableReadyCheck: true,
});

redis.on('error',   (err) => console.error('[Redis] error:', err.message));
redis.on('connect', ()    => console.log('[Redis] connected'));
redis.on('ready',   ()    => console.log('[Redis] ready'));

// ── Token revocation ──────────────────────────────────────────────
export const revokeToken  = (jti, ttl) => redis.setex(`revoked:${jti}`, ttl, '1');
export const isRevoked    = (jti) => redis.exists(`revoked:${jti}`).then(Boolean);

// ── Session binding (single-session enforcement) ──────────────────
export const bindSession  = (jti, sessionId, ttl) => redis.setex(`session:${jti}`, ttl, sessionId);
export const getSession   = (jti) => redis.get(`session:${jti}`);

// ── Heartbeat tracking ────────────────────────────────────────────
const HEARTBEAT_TTL = 90; // seconds — miss 3 beats = dead

export const touchHeartbeat  = (sessionId) => redis.setex(`hb:${sessionId}`, HEARTBEAT_TTL, Date.now().toString());
export const getHeartbeat    = (sessionId) => redis.get(`hb:${sessionId}`);
export const dropHeartbeat   = (sessionId) => redis.del(`hb:${sessionId}`);
export const isSessionAlive  = async (sessionId) => {
  const ts = await getHeartbeat(sessionId);
  if (!ts) return false;
  return Date.now() - Number(ts) < HEARTBEAT_TTL * 1000;
};

// ── Access hit counter (rate / replay protection) ─────────────────
export const incrHits = (jti, ttl) =>
  redis.multi()
    .incr(`hits:${jti}`)
    .expire(`hits:${jti}`, ttl)
    .exec()
    .then(r => r[0][1]);

// ── Project-level stats cache ─────────────────────────────────────
export const cacheStats = (projectId, data, ttl = 30) =>
  redis.setex(`stats:${projectId}`, ttl, JSON.stringify(data));
export const getCachedStats = async (projectId) => {
  const raw = await redis.get(`stats:${projectId}`);
  return raw ? JSON.parse(raw) : null;
};

// ── Active session registry (for dashboard) ──────────────────────
export const registerActiveSession = (projectId, sessionId, ttl) =>
  redis.setex(`active:${projectId}:${sessionId}`, ttl, '1');

export const countActiveSessions = async (projectId) => {
  const keys = await redis.keys(`active:${projectId}:*`);
  return keys.length;
};
