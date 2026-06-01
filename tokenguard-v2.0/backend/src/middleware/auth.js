import { verifyToken } from '../services/jwt.js';

export async function requireAuth(req, reply) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'unauthorized', message: 'Missing authentication token' });
  }
  try {
    const payload = verifyToken(header.slice(7));
    if (payload.type !== 'dashboard') throw new Error('Invalid token type');
    req.userId = payload.userId ?? payload.sub;
  } catch {
    return reply.code(401).send({ error: 'unauthorized', message: 'Invalid or expired token' });
  }
}
