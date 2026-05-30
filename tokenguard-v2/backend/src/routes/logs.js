import { query } from '../services/db.js';
import { requireAuth } from '../middleware/auth.js';

export default async function logsRoute(app) {

  // GET /logs?projectId=&limit=&status=
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const { projectId, limit = '50', status, since } = req.query;

    const conditions = ['p.user_id = $1'];
    const params = [req.userId];
    let i = 2;

    if (projectId) { conditions.push(`l.project_id = $${i++}`); params.push(projectId); }
    if (status)    { conditions.push(`l.status = $${i++}`);     params.push(status); }
    if (since)     { conditions.push(`l.created_at > $${i++}`); params.push(since); }

    params.push(Number(limit));

    const { rows } = await query(
      `SELECT l.*, p.name AS project_name
       FROM access_logs l
       LEFT JOIN projects p ON p.id = l.project_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY l.created_at DESC
       LIMIT $${i}`,
      params
    );

    return rows;
  });

  // GET /logs/stats  — aggregate stats for dashboard
  app.get('/stats', { preHandler: requireAuth }, async (req) => {
    const { projectId, period } = req.query;

    // Safe interval mapping — never interpolated from user input
    const INTERVALS = { '7d': '7 days', '30d': '30 days' };
    const interval = INTERVALS[period] ?? '24 hours';

    const params = [req.userId];
    let projectFilter = '';
    if (projectId) {
      projectFilter = 'AND l.project_id = $2';
      params.push(projectId);
    }

    const { rows } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE l.status = 'authorized') AS authorized,
         COUNT(*) FILTER (WHERE l.status = 'blocked')    AS blocked,
         COUNT(*)                                         AS total,
         COUNT(DISTINCT l.project_id)                    AS active_projects
       FROM access_logs l
       LEFT JOIN projects p ON p.id = l.project_id
       WHERE p.user_id = $1
         ${projectFilter}
         AND l.created_at > NOW() - INTERVAL '${interval}'`,
      params
    );

    return rows[0] ?? { authorized: 0, blocked: 0, total: 0, active_projects: 0 };
  });

  // GET /logs/chart — hourly buckets for sparkline (last 24h)
  app.get('/chart', { preHandler: requireAuth }, async (req) => {
    const { projectId } = req.query;
    const params = [req.userId];
    let projectFilter = '';
    if (projectId) { projectFilter = 'AND l.project_id = $2'; params.push(projectId); }

    const { rows } = await query(
      `SELECT
         date_trunc('hour', l.created_at)                   AS hour,
         COUNT(*) FILTER (WHERE l.status = 'authorized')    AS authorized,
         COUNT(*) FILTER (WHERE l.status = 'blocked')       AS blocked
       FROM access_logs l
       LEFT JOIN projects p ON p.id = l.project_id
       WHERE p.user_id = $1
         ${projectFilter}
         AND l.created_at > NOW() - INTERVAL '24 hours'
       GROUP BY 1
       ORDER BY 1 ASC`,
      params
    );
    return rows;
  });
}
