import { verifyToken } from '../services/jwt.js';
import { isRevoked, bindSession, getSession, incrHits } from '../services/redis.js';
import { deriveBundleKey, maskIp } from '../services/crypto.js';
import { logAccess } from '../services/logger.js';
import { query } from '../services/db.js';

export default async function validateRoute(app) {

  // POST /generate-token  (chamado pelo loader.js público)
  app.post('/generate-token', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { projectId, origin } = req.body ?? {};
    if (!projectId) return reply.code(400).send({ error: 'projectId obrigatório' });

    const { rows } = await query(
      `SELECT t.jti, t.rules, t.expires_at,
              p.domains, p.bundle_url, p.status
       FROM tokens t
       JOIN projects p ON p.id = t.project_id
       WHERE t.project_id = $1
         AND t.status = 'valid'
         AND t.expires_at > NOW()
       ORDER BY t.created_at DESC LIMIT 1`,
      [projectId]
    );

    if (!rows.length) {
      return reply.code(403).send({ authorized: false, reason: 'no_valid_token' });
    }

    const { jti, rules, expires_at, domains, bundle_url, status } = rows[0];
    if (status !== 'active') {
      return reply.code(403).send({ authorized: false, reason: 'project_inactive' });
    }

    const ttl = Math.max(0, Math.floor((new Date(expires_at) - Date.now()) / 1000));
    return { token: jti, expiresIn: ttl };
  });

  // POST /validate  (chamado pelo loader.js — rota mais crítica)
  app.post('/validate', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { token, origin } = req.body ?? {};
    const sessionId = req.headers['x-tg-session'];
    const ip = maskIp(req.ip);

    if (!token || !origin) {
      return reply.code(400).send({ authorized: false, reason: 'missing_params' });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      await logAccess({ ip, status: 'blocked', reason: e.name === 'TokenExpiredError' ? 'token_expired' : 'token_invalid' });
      return reply.code(403).send({ authorized: false, reason: e.name === 'TokenExpiredError' ? 'token_expired' : 'token_invalid' });
    }

    if (payload.type !== 'runtime') {
      return reply.code(403).send({ authorized: false, reason: 'wrong_token_type' });
    }

    const { projectId, jti } = payload;

    // 1. Verificar se foi revogado no Redis
    const revoked = await isRevoked(jti);
    if (revoked) {
      await logAccess({ projectId, sessionId, ip, status: 'blocked', reason: 'token_revoked' });
      return reply.code(403).send({ authorized: false, reason: 'token_revoked' });
    }

    // 2. Buscar projeto e regras no banco
    const { rows } = await query(
      `SELECT p.domains, p.rules, p.bundle_url, p.status,
              t.rules AS token_rules, t.expires_at
       FROM projects p
       JOIN tokens t ON t.project_id = p.id
       WHERE p.id = $1 AND t.jti = $2`,
      [projectId, jti]
    );

    if (!rows.length) {
      await logAccess({ projectId, ip, status: 'blocked', reason: 'project_or_token_not_found' });
      return reply.code(403).send({ authorized: false, reason: 'not_found' });
    }

    const { domains, rules, bundle_url, status, token_rules, expires_at } = rows[0];

    if (status !== 'active') {
      return reply.code(403).send({ authorized: false, reason: 'project_inactive' });
    }

    const mergedRules = { ...rules, ...token_rules };
    const ttl = Math.max(0, Math.floor((new Date(expires_at) - Date.now()) / 1000));

    // 3. Validar domínio
    const originHost = (() => { try { return new URL(origin).hostname; } catch { return ''; } })();
    const domainAllowed = domains.some(d => {
      if (mergedRules.domainMode === 'wildcard') {
        const base = d.replace(/^\*\./, '');
        return originHost === base || originHost.endsWith(`.${base}`);
      }
      return originHost === d;
    });

    if (!domainAllowed && mergedRules.domainMode !== 'off') {
      await logAccess({ projectId, sessionId, ip, status: 'blocked', reason: 'domain_not_allowed' });
      return reply.code(403).send({ authorized: false, reason: 'domain_not_allowed' });
    }

    // 4. Sessão única
    if (mergedRules.singleSession && sessionId) {
      const existing = await getSession(jti);
      if (existing && existing !== sessionId) {
        await logAccess({ projectId, sessionId, ip, status: 'blocked', reason: 'session_conflict' });
        return reply.code(403).send({ authorized: false, reason: 'session_conflict' });
      }
      await bindSession(jti, sessionId, ttl);
    }

    // 5. Limite de acessos
    const hits = await incrHits(jti, ttl);
    if (hits > (mergedRules.maxAccess ?? 100)) {
      await logAccess({ projectId, sessionId, ip, status: 'blocked', reason: 'access_limit_exceeded' });
      return reply.code(403).send({ authorized: false, reason: 'access_limit_exceeded' });
    }

    // 6. Derivar chave AES efêmera para o bundle
    const bundleKey = deriveBundleKey(projectId, jti);

    await logAccess({ projectId, sessionId, ip, status: 'authorized' });

    return {
      authorized: true,
      bundleUrl: bundle_url,
      key: bundleKey,
      expiresIn: ttl,
    };
  });
}
