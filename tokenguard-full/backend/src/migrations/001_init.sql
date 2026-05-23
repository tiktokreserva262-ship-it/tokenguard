-- TokenGuard — Migration 001
-- Execute no Supabase SQL Editor ou via: psql $DATABASE_URL -f 001_init.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Usuários do dashboard
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Projetos
CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  domains    TEXT[] NOT NULL DEFAULT '{}',
  rules      JSONB NOT NULL DEFAULT '{}',
  bundle_url TEXT,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tokens gerados
CREATE TABLE IF NOT EXISTS tokens (
  jti        TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rules      JSONB NOT NULL DEFAULT '{}',
  status     TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','revoked','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs de acesso
CREATE TABLE IF NOT EXISTS access_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  session_id TEXT,
  ip         TEXT,
  status     TEXT NOT NULL CHECK (status IN ('authorized','blocked')),
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_projects_user    ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_project   ON tokens(project_id);
CREATE INDEX IF NOT EXISTS idx_tokens_status    ON tokens(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_logs_project     ON access_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_logs_created     ON access_logs(created_at DESC);

-- Expirar tokens automaticamente via job (opcional, senão deixe o Redis/JWT cuidar)
-- Pode ser chamado por um cron: SELECT expire_old_tokens();
CREATE OR REPLACE FUNCTION expire_old_tokens()
RETURNS void LANGUAGE sql AS $$
  UPDATE tokens SET status = 'expired'
  WHERE status = 'valid' AND expires_at < NOW();
$$;
