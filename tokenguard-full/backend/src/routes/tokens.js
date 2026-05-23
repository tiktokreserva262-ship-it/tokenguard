import { query } from '../services/db.js';
import { requireAuth } from '../middleware/auth.js';
import { signRuntimeToken } from '../services/jwt.js';
import { revokeToken } from '../services/redis.js';

export default async function tokenRoutes(app) {

  // GET /tokens?projectId=
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const { projectId } = req.query;
    const { rows } = await query(
      `SELECT t.* FROM tokens t
       JOIN projects p ON p.id = t.project_id
       WHERE p.user_id = $1 ${projectId ? 'AND t.project_id = $2' : ''}
       ORDER BY t.created_at DESC LIMIT 100`,
      projectId ? [req.userId, projectId] : [req.userId]
    );
    return rows;
  });

  // POST /tokens/generate
  app.post('/generate', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { projectId, overrides } = req.body ?? {};
    if (!projectId) return reply.code(400).send({ error: 'projectId obrigatório' });

    // Verifica que o projeto pertence ao usuário
    const { rows: proj } = await query(
      'SELECT id, rules, domains FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    if (!proj.length) return reply.code(404).send({ error: 'Projeto não encontrado' });

    const rules = { ...proj[0].rules, ...overrides };
    const { token, jti, expiresIn } = signRuntimeToken({
      projectId,
      domain: proj[0].domains[0],
      rules,
    });

    // Persiste o token no banco
    await query(
      `INSERT INTO tokens (jti, project_id, expires_at, rules)
       VALUES ($1, $2, NOW() + INTERVAL '${expiresIn} seconds', $3)`,
      [jti, projectId, JSON.stringify(rules)]
    );

    return reply.code(201).send({ token, jti, expiresIn });
  });

  // POST /tokens/revoke
  app.post('/revoke', { preHandler: requireAuth }, async (req, reply) => {
    const { jti } = req.body ?? {};
    if (!jti) return reply.code(400).send({ error: 'jti obrigatório' });

    const { rows } = await query(
      `UPDATE tokens SET status = 'revoked'
       WHERE jti = $1
         AND project_id IN (SELECT id FROM projects WHERE user_id = $2)
       RETURNING jti, expires_at`,
      [jti, req.userId]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Token não encontrado' });

    const ttl = Math.max(0, Math.floor((new Date(rows[0].expires_at) - Date.now()) / 1000));
    if (ttl > 0) await revokeToken(jti, ttl);

    return { revoked: true, jti };
  });
}
