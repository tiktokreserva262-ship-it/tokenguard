import { v4 as uuidv4 } from 'uuid';
import { signRuntimeToken, verifyToken, decodeToken, resolveExpiry } from '../services/jwt.js';
import { isRevoked, bindSession, getSession, incrHits, touchHeartbeat, isSessionAlive, registerActiveSession } from '../services/redis.js';
import { deriveBundleKey, maskIp } from '../services/crypto.js';
import { logAccess } from '../services/logger.js';
import { query } from '../services/db.js';

// ── Domain validation ──────────────────────────────────────────────
function extractHostname(origin) {
  try { return new URL(origin).hostname; } catch { return ''; }
}

function isDomainAllowed(hostname, domains, mode = 'strict') {
  if (mode === 'off') return true;
  return domains.some(d => {
    if (mode === 'wildcard') {
      const base = d.replace(/^\*\./, '');
      return hostname === base || hostname.endsWith(`.${base}`);
    }
    return hostname === d;
  });
}

export default async function validateRoutes(app) {

  // ─────────────────────────────────────────────────────────────────
  // POST /generate-token
  // Called by the SDK/loader on page load.
  // Returns a short-lived JWT signed with project's tokenExpiry.
  // SECURITY: tokenExpiry is ALWAYS pulled from DB project config.
  //           The client-side SDK can never influence duration.
  // ─────────────────────────────────────────────────────────────────
  app.post('/generate-token', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { projectId, origin, host, href, userAgent } = req.body ?? {};
    const ip = maskIp(req.ip);

    if (!projectId) {
      return reply.code(400).send({ error: 'bad_request', message: 'projectId is required' });
    }

    // Build fingerprint for logging and clone-detection heuristics.
    // We cross-check origin vs host vs href — a cloned page often shows
    // mismatches (e.g. origin=localhost but href=file:// or mismatched host).
    const fingerprint = { origin, host, href: href?.slice(0, 256), userAgent: userAgent?.slice(0, 200) };

    // Primary hostname from origin; fallback to host field
    const hostname = extractHostname(origin ?? req.headers.origin ?? '')
      || (host ?? '').toLowerCase().trim();

    // Fetch project config from DB
    const { rows } = await query(
      `SELECT id, domains, rules, bundle_url, status
       FROM projects
       WHERE id = $1`,
      [projectId]
    );

    if (!rows.length) {
      await logAccess({ ip, status: 'blocked', reason: 'project_not_found', metadata: { projectId, ...fingerprint } });
      return reply.code(403).send({ error: 'forbidden', message: 'Project not found' });
    }

    const project = rows[0];

    if (project.status !== 'active') {
      await logAccess({ projectId, ip, status: 'blocked', reason: 'project_inactive', metadata: fingerprint });
      return reply.code(403).send({ error: 'forbidden', message: 'Project is inactive' });
    }

    // Domain check at generation time — uses both origin and host for stronger clone detection
    const rules = project.rules ?? {};
    if (!isDomainAllowed(hostname, project.domains, rules.domainMode)) {
      await logAccess({ projectId, ip, status: 'blocked', reason: 'domain_not_allowed', metadata: { ...fingerprint } });
      return reply.code(403).send({ error: 'domain_not_allowed', message: 'Origin not authorized for this project' });
    }

    // Cross-check: if host field was sent, it must also match the allowed domains
    if (host && rules.domainMode !== 'off') {
      const hostClean = host.toLowerCase().trim();
      if (!isDomainAllowed(hostClean, project.domains, rules.domainMode)) {
        await logAccess({ projectId, ip, status: 'blocked', reason: 'host_mismatch', metadata: { ...fingerprint } });
        return reply.code(403).send({ error: 'host_mismatch', message: 'Host field does not match allowed domains' });
      }
    }

    // Generate session ID
    const sessionId = `sid_${uuidv4().replace(/-/g, '').slice(0, 20)}`;

    // Sign runtime token — expiry comes from project.rules.tokenExpiry
    const { token, jti, expiresIn } = signRuntimeToken({
      projectId,
      sessionId,
      rules: project.rules,
    });

    // Persist session token in DB
    await query(
      `INSERT INTO sessions (jti, project_id, session_id, expires_at, ip)
       VALUES ($1, $2, $3, NOW() + ($4 || ' seconds')::interval, $5)`,
      [jti, projectId, sessionId, expiresIn, ip]
    );

    // Register in Redis for fast lookup
    await bindSession(jti, sessionId, expiresIn);
    await registerActiveSession(projectId, sessionId, expiresIn);

    await logAccess({ projectId, sessionId, ip, status: 'authorized', reason: 'token_generated', metadata: fingerprint });

    return reply.code(201).send({
      token,
      sessionId,
      expiresIn,
      heartbeatInterval: Math.min(30, Math.floor(expiresIn / 3)),
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // POST /validate-token
  // Called by the SDK after receiving the token from generate-token.
  // Returns authorization state + optional bundle URL + ephemeral key.
  // ─────────────────────────────────────────────────────────────────
  app.post('/validate-token', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { token, origin } = req.body ?? {};
    const sessionId = req.headers['x-tg-session'];
    const ip = maskIp(req.ip);

    if (!token) {
      return reply.code(400).send({ error: 'bad_request', message: 'token is required' });
    }

    // 1. Verify JWT signature and expiry
    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      const reason = e.name === 'TokenExpiredError' ? 'token_expired' : 'token_invalid';
      await logAccess({ ip, sessionId, status: 'blocked', reason });
      return reply.code(403).send({ authorized: false, reason });
    }

    if (payload.type !== 'runtime') {
      return reply.code(403).send({ authorized: false, reason: 'wrong_token_type' });
    }

    const { sub: projectId, jti, sid: tokenSid } = payload;

    // 2. Check revocation list in Redis (O(1))
    if (await isRevoked(jti)) {
      await logAccess({ projectId, sessionId, ip, status: 'blocked', reason: 'token_revoked' });
      return reply.code(403).send({ authorized: false, reason: 'token_revoked' });
    }

    // 3. Fetch project + session from DB
    const { rows } = await query(
      `SELECT p.domains, p.rules, p.bundle_url, p.status,
              s.session_id, s.expires_at
       FROM projects p
       JOIN sessions s ON s.project_id = p.id
       WHERE p.id = $1 AND s.jti = $2 AND s.status = 'active'`,
      [projectId, jti]
    );

    if (!rows.length) {
      await logAccess({ projectId, ip, status: 'blocked', reason: 'session_not_found' });
      return reply.code(403).send({ authorized: false, reason: 'session_not_found' });
    }

    const { domains, rules, bundle_url, status } = rows[0];

    if (status !== 'active') {
      return reply.code(403).send({ authorized: false, reason: 'project_inactive' });
    }

    const hostname = extractHostname(origin ?? req.headers.origin ?? '');

    // 4. Domain validation
    if (!isDomainAllowed(hostname, domains, rules?.domainMode)) {
      await logAccess({ projectId, sessionId, ip, status: 'blocked', reason: 'domain_not_allowed' });
      return reply.code(403).send({ authorized: false, reason: 'domain_not_allowed' });
    }

    // 5. Single-session enforcement
    if (rules?.singleSession) {
      const boundSession = await getSession(jti);
      if (boundSession && boundSession !== (sessionId ?? tokenSid)) {
        await logAccess({ projectId, sessionId, ip, status: 'blocked', reason: 'session_conflict' });
        return reply.code(403).send({ authorized: false, reason: 'session_conflict' });
      }
    }

    // 6. Access count enforcement
    const ttl = Math.max(0, Math.floor((new Date(rows[0].expires_at) - Date.now()) / 1000));
    const hits = await incrHits(jti, ttl);
    if (hits > (rules?.maxAccess ?? 1000)) {
      await logAccess({ projectId, sessionId, ip, status: 'blocked', reason: 'access_limit_exceeded' });
      return reply.code(403).send({ authorized: false, reason: 'access_limit_exceeded' });
    }

    // 7. Start heartbeat tracking
    await touchHeartbeat(sessionId ?? tokenSid);

    // 8. Derive ephemeral AES key for encrypted bundle (if applicable)
    const bundleKey = bundle_url ? deriveBundleKey(projectId, jti) : null;

    await logAccess({ projectId, sessionId, ip, status: 'authorized' });

    return {
      authorized: true,
      bundleUrl: bundle_url ?? null,
      key: bundleKey,
      expiresIn: ttl,
      heartbeatInterval: Math.min(30, Math.floor(ttl / 3)),
    };
  });

  // ─────────────────────────────────────────────────────────────────
  // POST /session-heartbeat
  // Called by the SDK every N seconds to keep the session alive.
  // Returns a fresh short-lived token to replace the expiring one.
  // ─────────────────────────────────────────────────────────────────
  app.post('/session-heartbeat', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { token } = req.body ?? {};
    const sessionId = req.headers['x-tg-session'];
    const ip = maskIp(req.ip);

    if (!token || !sessionId) {
      return reply.code(400).send({ error: 'bad_request', message: 'token and X-TG-Session are required' });
    }

    // Allow slightly-expired tokens (5s grace) for network latency
    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      if (e.name !== 'TokenExpiredError') {
        return reply.code(403).send({ alive: false, reason: 'token_invalid' });
      }
      // Allow expired token up to 10s grace for heartbeat renewal
      const decoded = decodeToken(token);
      if (!decoded) return reply.code(403).send({ alive: false, reason: 'token_invalid' });
      const expiredAgo = Math.floor(Date.now() / 1000) - decoded.exp;
      if (expiredAgo > 10) {
        return reply.code(403).send({ alive: false, reason: 'token_expired' });
      }
      payload = decoded;
    }

    if (payload.type !== 'runtime') {
      return reply.code(403).send({ alive: false, reason: 'wrong_token_type' });
    }

    const { sub: projectId, jti } = payload;

    // Check revocation
    if (await isRevoked(jti)) {
      return reply.code(403).send({ alive: false, reason: 'token_revoked' });
    }

    // Fetch project rules for re-issuance
    const { rows } = await query(
      `SELECT p.rules, p.status, p.domains
       FROM projects p
       JOIN sessions s ON s.project_id = p.id
       WHERE p.id = $1 AND s.jti = $2 AND s.status = 'active'`,
      [projectId, jti]
    );

    if (!rows.length) {
      return reply.code(403).send({ alive: false, reason: 'session_not_found' });
    }

    const { rules, status } = rows[0];
    if (status !== 'active') {
      return reply.code(403).send({ alive: false, reason: 'project_inactive' });
    }

    // Touch heartbeat in Redis + update last_seen in DB
    await touchHeartbeat(sessionId);
    // Fire-and-forget last_seen update — don't block the response
    query(
      `UPDATE sessions SET last_seen = NOW() WHERE jti = $1`,
      [jti]
    ).catch(() => {});

    // Issue a fresh runtime token (rolling window)
    // expiresIn still comes from project.rules.tokenExpiry — never from client
    const { token: newToken, jti: newJti, expiresIn } = signRuntimeToken({
      projectId,
      sessionId,
      rules,
    });

    // Persist new session token
    await query(
      `INSERT INTO sessions (jti, project_id, session_id, expires_at, ip)
       VALUES ($1, $2, $3, NOW() + ($4 || ' seconds')::interval, $5)`,
      [newJti, projectId, sessionId, expiresIn, ip]
    );

    await bindSession(newJti, sessionId, expiresIn);
    await registerActiveSession(projectId, sessionId, expiresIn);

    return {
      alive: true,
      token: newToken,
      jti: newJti,
      expiresIn,
      heartbeatInterval: Math.min(30, Math.floor(expiresIn / 3)),
    };
  });
}
