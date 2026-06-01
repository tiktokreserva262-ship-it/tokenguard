import { query } from '../services/db.js';
import { requireAuth } from '../middleware/auth.js';
import { generateProjectId } from '../services/crypto.js';
import { resolveExpiry, MAX_TOKEN_EXPIRY, MIN_TOKEN_EXPIRY } from '../services/jwt.js';
import { countActiveSessions } from '../services/redis.js';

// SECURITY: tokenExpiry defaults and limits are enforced here, server-side only.
const DEFAULT_RULES = {
  tokenExpiry: 300,        // 5 minutes default (short-lived)
  singleSession: true,
  maxAccess: 1000,
  domainMode: 'strict',    // 'strict' | 'wildcard' | 'off'
};

function sanitizeRules(input = {}) {
  const rules = { ...DEFAULT_RULES };

  // tokenExpiry: ALWAYS clamped server-side; client can suggest but backend enforces limits
  if (input.tokenExpiry !== undefined) {
    rules.tokenExpiry = resolveExpiry(input.tokenExpiry);
  }

  if (typeof input.singleSession === 'boolean') rules.singleSession = input.singleSession;
  if (typeof input.maxAccess === 'number' && input.maxAccess > 0) rules.maxAccess = Math.min(input.maxAccess, 100000);
  if (['strict', 'wildcard', 'off'].includes(input.domainMode)) rules.domainMode = input.domainMode;

  return rules;
}

export default async function projectRoutes(app) {

  // GET /projects
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const { rows } = await query(
      `SELECT p.*,
         (SELECT COUNT(*) FROM sessions s WHERE s.project_id = p.id AND s.status = 'active' AND s.expires_at > NOW()) AS active_sessions,
         (SELECT COUNT(*) FROM access_logs l WHERE l.project_id = p.id AND l.created_at > NOW() - INTERVAL '24 hours') AS requests_24h,
         (SELECT COUNT(*) FROM access_logs l WHERE l.project_id = p.id AND l.status = 'blocked' AND l.created_at > NOW() - INTERVAL '24 hours') AS blocked_24h
       FROM projects p
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.userId]
    );
    return rows;
  });

  // GET /projects/:id
  app.get('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { rows } = await query(
      `SELECT p.*,
         (SELECT COUNT(*) FROM sessions s WHERE s.project_id = p.id AND s.status = 'active' AND s.expires_at > NOW()) AS active_sessions
       FROM projects p
       WHERE p.id = $1 AND p.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (!rows.length) return reply.code(404).send({ error: 'not_found', message: 'Project not found' });
    return rows[0];
  });

  // POST /projects
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const { name, domains, rules: inputRules, bundleUrl } = req.body ?? {};

    if (!name?.trim()) return reply.code(400).send({ error: 'bad_request', message: 'name is required' });
    if (!Array.isArray(domains) || !domains.length) {
      return reply.code(400).send({ error: 'bad_request', message: 'domains array is required' });
    }

    // Sanitize and enforce domains
    const cleanDomains = domains.map(d => d.trim().toLowerCase()).filter(Boolean);

    // SECURITY: rules are sanitized with enforced limits
    const rules = sanitizeRules(inputRules);

    const id = generateProjectId();

    const { rows } = await query(
      `INSERT INTO projects (id, user_id, name, domains, rules, bundle_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, req.userId, name.trim(), cleanDomains, JSON.stringify(rules), bundleUrl ?? null]
    );

    return reply.code(201).send(rows[0]);
  });

  // PUT /projects/:id
  app.put('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { name, domains, rules: inputRules, status, bundleUrl } = req.body ?? {};

    // Verify ownership
    const { rows: existing } = await query(
      'SELECT id, rules FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!existing.length) return reply.code(404).send({ error: 'not_found', message: 'Project not found' });

    // Merge rules with enforcement
    const currentRules = existing[0].rules ?? {};
    const rules = inputRules ? sanitizeRules({ ...currentRules, ...inputRules }) : undefined;
    const cleanDomains = domains?.map(d => d.trim().toLowerCase()).filter(Boolean);

    const { rows } = await query(
      `UPDATE projects
       SET name       = COALESCE($1, name),
           domains    = COALESCE($2, domains),
           rules      = COALESCE($3, rules),
           status     = COALESCE($4, status),
           bundle_url = COALESCE($5, bundle_url),
           updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [
        name?.trim() ?? null,
        cleanDomains ?? null,
        rules ? JSON.stringify(rules) : null,
        status ?? null,
        bundleUrl ?? null,
        req.params.id,
        req.userId,
      ]
    );

    return rows[0];
  });

  // DELETE /projects/:id
  app.delete('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { rowCount } = await query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!rowCount) return reply.code(404).send({ error: 'not_found', message: 'Project not found' });
    return { deleted: true };
  });

  // GET /projects/:id/sessions (live session count)
  app.get('/:id/sessions', { preHandler: requireAuth }, async (req, reply) => {
    const { rows: proj } = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!proj.length) return reply.code(404).send({ error: 'not_found' });

    const [dbSessions, redisSessions] = await Promise.all([
      query(
        `SELECT session_id, ip, created_at, expires_at
         FROM sessions
         WHERE project_id = $1 AND status = 'active' AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 50`,
        [req.params.id]
      ),
      countActiveSessions(req.params.id),
    ]);

    return {
      total: redisSessions,
      sessions: dbSessions.rows,
    };
  });

  // Expose expiry limits for the dashboard UI (informational only)
  app.get('/meta/limits', { preHandler: requireAuth }, async () => ({
    tokenExpiry: { min: MIN_TOKEN_EXPIRY, max: MAX_TOKEN_EXPIRY, default: 300 },
    domainModes: ['strict', 'wildcard', 'off'],
  }));
}
