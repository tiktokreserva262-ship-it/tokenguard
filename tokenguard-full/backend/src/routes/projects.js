import { query } from '../services/db.js';
import { requireAuth } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_RULES = {
  tokenExpiry: 3600,
  singleSession: true,
  maxAccess: 100,
  domainMode: 'strict',
};

export default async function projectRoutes(app) {

  // GET /projects
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const { rows } = await query(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM tokens t WHERE t.project_id = p.id AND t.status = 'valid') AS active_tokens,
        (SELECT COUNT(*) FROM access_logs l WHERE l.project_id = p.id) AS total_logs
       FROM projects p WHERE p.user_id = $1 ORDER BY p.created_at DESC`,
      [req.userId]
    );
    return rows;
  });

  // GET /projects/:id
  app.get('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { rows } = await query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Projeto não encontrado' });
    return rows[0];
  });

  // POST /projects
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const { name, domains, rules, bundleUrl } = req.body ?? {};
    if (!name) return reply.code(400).send({ error: 'name obrigatório' });
    if (!domains?.length) return reply.code(400).send({ error: 'domains obrigatório' });

    const id = `proj_${uuidv4().replace(/-/g,'').slice(0,10)}`;
    const mergedRules = { ...DEFAULT_RULES, ...rules };

    const { rows } = await query(
      `INSERT INTO projects (id, user_id, name, domains, rules, bundle_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, req.userId, name, domains, JSON.stringify(mergedRules), bundleUrl ?? null]
    );
    return reply.code(201).send(rows[0]);
  });

  // PUT /projects/:id
  app.put('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { name, domains, rules, status, bundleUrl } = req.body ?? {};
    const { rows } = await query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           domains = COALESCE($2, domains),
           rules = COALESCE($3, rules),
           status = COALESCE($4, status),
           bundle_url = COALESCE($5, bundle_url),
           updated_at = NOW()
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [name, domains, rules ? JSON.stringify(rules) : null, status, bundleUrl, req.params.id, req.userId]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Projeto não encontrado' });
    return rows[0];
  });

  // DELETE /projects/:id
  app.delete('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { rowCount } = await query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!rowCount) return reply.code(404).send({ error: 'Projeto não encontrado' });
    return { deleted: true };
  });
}
