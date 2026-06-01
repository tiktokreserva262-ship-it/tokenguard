import bcrypt from 'bcryptjs';
import { query } from '../services/db.js';
import { signDashboardToken, verifyToken } from '../services/jwt.js';
import { requireAuth } from '../middleware/auth.js';

export default async function authRoutes(app) {

  // POST /auth/register
  app.post('/register', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { name, email, password } = req.body ?? {};

    if (!email || !password) {
      return reply.code(400).send({ error: 'bad_request', message: 'email and password are required' });
    }
    if (password.length < 8) {
      return reply.code(400).send({ error: 'bad_request', message: 'Password must be at least 8 characters' });
    }

    const hash = await bcrypt.hash(password, 12);

    try {
      const { rows } = await query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3) RETURNING id, name, email, created_at`,
        [name?.trim() ?? null, email.trim().toLowerCase(), hash]
      );
      const token = signDashboardToken(rows[0].id);
      return reply.code(201).send({ token, user: rows[0] });
    } catch (e) {
      if (e.code === '23505') {
        return reply.code(409).send({ error: 'conflict', message: 'Email already registered' });
      }
      throw e;
    }
  });

  // POST /auth/login
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return reply.code(400).send({ error: 'bad_request', message: 'email and password are required' });
    }

    const { rows } = await query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    if (!rows.length) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Invalid credentials' });
    }

    const { password_hash: _, ...user } = rows[0];
    const token = signDashboardToken(user.id);
    return { token, user };
  });

  // GET /auth/me
  app.get('/me', { preHandler: requireAuth }, async (req) => {
    const { rows } = await query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    return rows[0] ?? null;
  });
}
