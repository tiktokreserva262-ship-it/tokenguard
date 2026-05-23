import { query } from '../services/db.js';
import { requireAuth } from '../middleware/auth.js';

export default async function logsRoute(app) {

  // GET /logs
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const { projectId, status, limit = 100, offset = 0 } = req.query;

    const conditions = ['p.user_id = $1'];
    const params = [req.userId];
    let i = 2;

    if (projectId) { conditions.push(`l.project_id = $${i++}`); params.push(projectId); }
    if (status)    { conditions.push(`l.status = $${i++}`);     params.push(status); }

    params.push(Number(limit), Number(offset));

    const { rows } = await query(
      `SELECT l.id, l.project_id, l.session_id, l.ip, l.status, l.reason,
              l.created_at, p.name AS project_name
       FROM access_logs l
       LEFT JOIN projects p ON p.id = l.project_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY l.created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      params
    );
    return rows;
  });

  // GET /logs/stats
  app.get('/stats', { preHandler: requireAuth }, async (req) => {
    const { rows } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE l.status = 'authorized') AS authorized,
         COUNT(*) FILTER (WHERE l.status = 'blocked')    AS blocked,
         COUNT(*) AS total
       FROM access_logs l
       JOIN projects p ON p.id = l.project_id
       WHERE p.user_id = $1
         AND l.created_at > NOW() - INTERVAL '24 hours'`,
      [req.userId]
    );
    return rows[0];
  });
}
