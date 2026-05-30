-- TokenGuard v2 — Migration 001
-- Run via: psql $DATABASE_URL -f 001_init.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Projects ──────────────────────────────────────────────────────
-- rules.tokenExpiry is always enforced by the backend (resolveExpiry).
-- Frontend/SDK code can NEVER set this value.
CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  domains    TEXT[] NOT NULL DEFAULT '{}',
  rules      JSONB NOT NULL DEFAULT '{
    "tokenExpiry": 300,
    "singleSession": true,
    "maxAccess": 1000,
    "domainMode": "strict"
  }',
  bundle_url TEXT,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sessions (replaces old tokens table) ─────────────────────────
-- Each generate-token call creates one session row.
-- jti is the JWT ID — used for revocation and heartbeat.
CREATE TABLE IF NOT EXISTS sessions (
  jti        TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  ip         TEXT,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen  TIMESTAMPTZ DEFAULT NOW(),   -- updated on every heartbeat
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Access Logs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  session_id TEXT,
  ip         TEXT,
  status     TEXT NOT NULL CHECK (status IN ('authorized','blocked')),
  reason     TEXT,
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_user         ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project      ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status       ON sessions(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id   ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_logs_project          ON access_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_logs_created          ON access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_status           ON access_logs(status);

-- ── Auto-expire sessions via cron ────────────────────────────────
CREATE OR REPLACE FUNCTION expire_old_sessions()
RETURNS void LANGUAGE sql AS $$
  UPDATE sessions SET status = 'expired'
  WHERE status = 'active' AND expires_at < NOW();
$$;

-- ── Updated-at trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── last_seen upgrade (safe to run on existing table) ─────────────
-- If upgrading from v2.0 without last_seen, run this manually:
-- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();
-- CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen DESC);
