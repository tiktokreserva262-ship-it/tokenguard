import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { redis } from './services/redis.js';
import { pool } from './services/db.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import tokenRoutes from './routes/tokens.js';
import validateRoute from './routes/validate.js';
import logsRoute from './routes/logs.js';

const app = Fastify({ logger: true, trustProxy: true });

// ── CORS ─────────────────────────────────────────────────────────
await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server
    const allowed = process.env.ALLOWED_ORIGINS?.split(',') ?? [];
    // Permite o dashboard + qualquer origem para /validate (clientes finais)
    cb(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
});

// ── RATE LIMIT ────────────────────────────────────────────────────
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  redis,
  keyGenerator: (req) => req.ip,
});

// ── HEALTH ────────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok', ts: Date.now() }));

// ── ROUTES ────────────────────────────────────────────────────────
await app.register(authRoutes,    { prefix: '/auth' });
await app.register(projectRoutes, { prefix: '/projects' });
await app.register(tokenRoutes,   { prefix: '/tokens' });
await app.register(validateRoute, { prefix: '/' });
await app.register(logsRoute,     { prefix: '/logs' });

// ── START ─────────────────────────────────────────────────────────
const start = async () => {
  try {
    await pool.query('SELECT 1'); // testa conexão DB
    await redis.ping();           // testa Redis
    await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
    console.log(`TokenGuard API rodando na porta ${process.env.PORT || 3000}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
