import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { redis } from './services/redis.js';
import { pool } from './services/db.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import tokenRoutes from './routes/tokens.js';
import validateRoutes from './routes/validate.js';
import logsRoute from './routes/logs.js';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  trustProxy: true,
});

// ── CORS ──────────────────────────────────────────────────────────
const DASHBOARD_ORIGINS = (process.env.DASHBOARD_ORIGINS ?? 'http://localhost:5173')
  .split(',').map(s => s.trim());

await app.register(cors, {
  origin: (origin, cb) => {
    // No origin = server-to-server or same-origin
    if (!origin) return cb(null, true);
    // Dashboard: only allow known origins
    if (DASHBOARD_ORIGINS.includes(origin)) return cb(null, true);
    // Public SDK endpoints: allow any origin (but per-route auth enforced)
    cb(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-TG-Session', 'X-TG-Project'],
  exposedHeaders: ['X-TG-Request-Id'],
});

// ── RATE LIMIT (global baseline) ──────────────────────────────────
await app.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: '1 minute',
  redis,
  keyGenerator: (req) => `global:${req.ip}`,
  errorResponseBuilder: () => ({
    error: 'rate_limit_exceeded',
    message: 'Too many requests. Please slow down.',
    retryAfter: 60,
  }),
});

// ── REQUEST ID ────────────────────────────────────────────────────
app.addHook('onSend', async (req, reply) => {
  reply.header('X-TG-Request-Id', req.id);
});

// ── HEALTH ────────────────────────────────────────────────────────
app.get('/health', async () => ({
  status: 'ok',
  version: '2.0.0',
  ts: Date.now(),
}));

// ── ROUTES ────────────────────────────────────────────────────────
await app.register(authRoutes,     { prefix: '/auth' });
await app.register(projectRoutes,  { prefix: '/projects' });
await app.register(tokenRoutes,    { prefix: '/tokens' });
await app.register(validateRoutes, { prefix: '/' });
await app.register(logsRoute,      { prefix: '/logs' });

// ── GLOBAL ERROR HANDLER ──────────────────────────────────────────
app.setErrorHandler((error, req, reply) => {
  req.log.error(error);
  const code = error.statusCode ?? 500;
  reply.code(code).send({
    error: error.code ?? 'internal_error',
    message: code === 500 ? 'Internal server error' : error.message,
  });
});

// ── START ─────────────────────────────────────────────────────────
const start = async () => {
  try {
    await pool.query('SELECT 1');
    req_log('[DB] connected');
    await redis.ping();
    req_log('[Redis] connected');
    await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

function req_log(msg) { console.log(msg); }

start();
