import { query } from '../services/db.js';
import { requireAuth } from '../middleware/auth.js';
import { revokeToken } from '../services/redis.js';

export default async function tokenRoutes(app) {

  // GET /tokens?projectId=
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const { projectId, limit = '50' } = req.query;
    const { rows } = await query(
      `SELECT s.* FROM sessions s
       JOIN projects p ON p.id = s.project_id
       WHERE p.user_id = $1
         ${projectId ? 'AND s.project_id = $2' : ''}
       ORDER BY s.created_at DESC LIMIT $${projectId ? 3 : 2}`,
      projectId ? [req.userId, projectId, Number(limit)] : [req.userId, Number(limit)]
    );
    return rows;
  });

  // POST /tokens/revoke
  app.post('/revoke', { preHandler: requireAuth }, async (req, reply) => {
    const { jti } = req.body ?? {};
    if (!jti) return reply.code(400).send({ error: 'bad_request', message: 'jti is required' });

    const { rows } = await query(
      `UPDATE sessions SET status = 'revoked'
       WHERE jti = $1
         AND project_id IN (SELECT id FROM projects WHERE user_id = $2)
       RETURNING jti, expires_at`,
      [jti, req.userId]
    );
    if (!rows.length) return reply.code(404).send({ error: 'not_found', message: 'Session not found' });

    const ttl = Math.max(0, Math.floor((new Date(rows[0].expires_at) - Date.now()) / 1000));
    if (ttl > 0) await revokeToken(jti, ttl);

    return { revoked: true, jti };
  });

  // POST /tokens/revoke-all  — revoke all sessions for a project
  app.post('/revoke-all', { preHandler: requireAuth }, async (req, reply) => {
    const { projectId } = req.body ?? {};
    if (!projectId) return reply.code(400).send({ error: 'bad_request', message: 'projectId is required' });

    // Verify ownership
    const { rows: proj } = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.userId]
    );
    if (!proj.length) return reply.code(404).send({ error: 'not_found', message: 'Project not found' });

    const { rows } = await query(
      `UPDATE sessions SET status = 'revoked'
       WHERE project_id = $1 AND status = 'active' AND expires_at > NOW()
       RETURNING jti, expires_at`,
      [projectId]
    );

    // Push all to Redis revocation list
    await Promise.all(rows.map(r => {
      const ttl = Math.max(0, Math.floor((new Date(r.expires_at) - Date.now()) / 1000));
      return ttl > 0 ? revokeToken(r.jti, ttl) : Promise.resolve();
    }));

    return { revoked: rows.length };
  });
}
