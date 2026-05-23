import bcrypt from 'bcrypt';
import { query } from '../services/db.js';
import { signDashboardToken } from '../services/jwt.js';
import { v4 as uuidv4 } from 'uuid';

export default async function authRoutes(app) {

  // POST /auth/register
  app.post('/register', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const { name, email, password } = req.body ?? {};
    if (!email || !password) return reply.code(400).send({ error: 'email e password obrigatórios' });
    if (password.length < 8)  return reply.code(400).send({ error: 'Senha mínimo 8 caracteres' });

    const hash = await bcrypt.hash(password, 12);
    try {
      const { rows } = await query(
        `INSERT INTO users (id, name, email, password_hash)
         VALUES ($1, $2, $3, $4) RETURNING id, email`,
        [uuidv4(), name ?? '', email.toLowerCase().trim(), hash]
      );
      const token = signDashboardToken(rows[0].id);
      return reply.code(201).send({ token, user: rows[0] });
    } catch (e) {
      if (e.code === '23505') return reply.code(409).send({ error: 'Email já cadastrado' });
      throw e;
    }
  });

  // POST /auth/login
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) return reply.code(400).send({ error: 'email e password obrigatórios' });

    const { rows } = await query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (!rows.length) return reply.code(401).send({ error: 'Credenciais inválidas' });

    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok)  return reply.code(401).send({ error: 'Credenciais inválidas' });

    const token = signDashboardToken(rows[0].id);
    return { token, user: { id: rows[0].id, email: rows[0].email } };
  });

  // GET /auth/me
  app.get('/me', { preHandler: (await import('../middleware/auth.js')).requireAuth }, async (req) => {
    const { rows } = await query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    return rows[0] ?? {};
  });
}
