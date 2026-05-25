import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET não definido no .env');

export function signRuntimeToken({ projectId, domain, rules }) {
  const jti = `tok_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const expiresIn = rules?.tokenExpiry ?? 3600;

  const token = jwt.sign(
    {
      projectId,
      domain,
      jti,
      type: 'runtime',
    },
    SECRET,
    {
      expiresIn,
    }
  );

  return { token, jti, expiresIn };
}

export function signDashboardToken(userId) {
  return jwt.sign(
    {
      userId,
      type: 'dashboard',
    },
    SECRET,
    {
      expiresIn: '7d',
    }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

export function decodeToken(token) {
  return jwt.decode(token);
}
