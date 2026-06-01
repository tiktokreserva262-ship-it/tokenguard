import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET is not defined in environment');

// ── Expiry constants ──────────────────────────────────────────────
// SECURITY: These are enforced SERVER-SIDE only.
// The frontend/SDK never controls token duration.
export const MAX_TOKEN_EXPIRY = Number(process.env.MAX_TOKEN_EXPIRY ?? 86400); // 24h hard cap
export const MIN_TOKEN_EXPIRY = Number(process.env.MIN_TOKEN_EXPIRY ?? 30);    // 30s minimum
export const DEFAULT_TOKEN_EXPIRY = 300; // 5 minutes (short-lived default)
export const HEARTBEAT_INTERVAL = 30;   // seconds between heartbeats

/**
 * Clamps the project's configured tokenExpiry between MIN and MAX.
 * SECURITY: This is the SINGLE source of truth for token duration.
 * Frontend code can NEVER influence this value.
 */
export function resolveExpiry(projectExpiry) {
  const raw = Number(projectExpiry ?? DEFAULT_TOKEN_EXPIRY);
  return Math.min(Math.max(raw, MIN_TOKEN_EXPIRY), MAX_TOKEN_EXPIRY);
}

/**
 * Signs a short-lived runtime JWT for SDK use.
 * expiresIn is always resolved server-side from project.rules.tokenExpiry.
 */
export function signRuntimeToken({ projectId, sessionId, rules }) {
  const jti = `sess_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const expiresIn = resolveExpiry(rules?.tokenExpiry);

  const payload = {
    sub: projectId,
    jti,
    sid: sessionId,
    type: 'runtime',
    iat: Math.floor(Date.now() / 1000),
  };

  // IMPORTANT: jti is already in payload — do NOT pass jwtid in options.
  // Passing both causes jsonwebtoken to throw "duplicated key" in some versions.
  const token = jwt.sign(payload, SECRET, { expiresIn });
  return { token, jti, expiresIn, sessionId };
}

/**
 * Signs a refresh token for heartbeat continuity.
 * Slightly longer-lived than the runtime token.
 */
export function signRefreshToken({ projectId, jti, sessionId }) {
  const refreshJti = `ref_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const token = jwt.sign(
    { sub: projectId, jti: refreshJti, sid: sessionId, type: 'refresh', parent: jti },
    SECRET,
    { expiresIn: MAX_TOKEN_EXPIRY }
  );
  return { token, jti: refreshJti };
}

/**
 * Signs a long-lived dashboard JWT for dashboard users.
 */
export function signDashboardToken(userId) {
  return jwt.sign({ sub: userId, userId, type: 'dashboard' }, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

export function decodeToken(token) {
  return jwt.decode(token);
}
