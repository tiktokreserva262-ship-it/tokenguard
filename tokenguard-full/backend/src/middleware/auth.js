import { verifyToken } from '../services/jwt.js';

export async function requireAuth(req, reply) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Token de autenticação ausente' });
  }
  try {
    const payload = verifyToken(header.slice(7));
    if (payload.type !== 'dashboard') throw new Error('Tipo de token inválido');
    req.userId = payload.userId;
  } catch {
    return reply.code(401).send({ error: 'Token inválido ou expirado' });
  }
}
