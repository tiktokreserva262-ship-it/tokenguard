# TokenGuard v2 — Runtime Protection SDK

> Professional-grade anti-clone / lightweight DRM for frontend web applications.
> Stripe-style SDK experience. Cloudflare-style infrastructure thinking.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: CDN Loader (public)                                   │
│  https://cdn.tokenguard.io/loader.js                            │
│  Handles: init, token fetch, block overlay, heartbeat           │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: JavaScript SDK (npm / ESM)                            │
│  import TokenGuard from 'tokenguard-sdk'                        │
│  Same logic as loader, framework-native                         │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Backend API (Fastify + PostgreSQL + Redis)            │
│  /generate-token  /validate-token  /session-heartbeat           │
│  Enforces: domain check, token expiry, session control          │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: Dashboard SaaS (HTML + Vanilla JS)                    │
│  Create projects · Configure expiry · View logs · Revoke        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Token Expiry — Security Model

**CRITICAL**: Token expiry is controlled EXCLUSIVELY by the backend.

```
Client SDK          Backend                     Database
────────            ───────                     ────────
init() ──────────► /generate-token             project.rules.tokenExpiry
                   resolveExpiry() ◄─────────── (configured in dashboard)
                   clamp(MIN=30, MAX=86400)
                   jwt.sign({ expiresIn })
                   ◄──── { token, expiresIn, heartbeatInterval }
```

- ❌ `TokenGuard.init({ tokenExpiry: 9999 })` — **ignored**
- ❌ SDK cannot set, suggest, or influence expiry
- ✅ Dashboard → Project Settings → Token Expiry
- ✅ Backend clamps to `[MIN_TOKEN_EXPIRY, MAX_TOKEN_EXPIRY]`

---

## Flow Diagram

```
1. SDK/Loader calls POST /generate-token
   { projectId, origin }

2. Backend validates:
   - project exists and is active
   - domain is allowed (strict/wildcard/off)
   - returns short-lived JWT (expiry from DB)

3. SDK calls POST /validate-token
   { token, origin } + X-TG-Session header

4. Backend validates:
   - JWT signature
   - revocation list (Redis O(1))
   - domain match
   - single-session enforcement
   - access count limit
   - returns { authorized, bundleUrl?, key?, heartbeatInterval }

5. If bundleUrl: decrypt AES-GCM bundle, inject into DOM

6. Heartbeat starts: POST /session-heartbeat every N seconds
   - Backend returns fresh short-lived token
   - Heartbeat miss → block overlay shown
```

---

## Quick Start

### HTML (simplest)
```html
<script
  src="https://cdn.tokenguard.io/loader.js"
  data-project="proj_yourid"
  data-api="https://api.tokenguard.io"
></script>
```

### ESM / NPM
```js
import TokenGuard from 'tokenguard-sdk';

await TokenGuard.init({
  projectId: 'proj_yourid',
  api: 'https://api.tokenguard.io',
});
```

### window.TokenGuard (UMD)
```html
<script src="https://cdn.tokenguard.io/sdk.js"></script>
<script>
  TokenGuard.init({ projectId: 'proj_yourid' });
</script>
```

---

## API Endpoints

### Public (SDK-facing)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/generate-token` | Issue short-lived JWT for a project |
| POST | `/validate-token` | Validate JWT + authorize session |
| POST | `/session-heartbeat` | Keep session alive, renew token |

### Dashboard (authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Sign in |
| POST | `/auth/register` | Create account |
| GET | `/projects` | List projects |
| POST | `/projects` | Create project |
| PUT | `/projects/:id` | Update project |
| GET | `/projects/:id/sessions` | Live session list |
| POST | `/tokens/revoke` | Revoke single session |
| POST | `/tokens/revoke-all` | Revoke all sessions for a project |
| GET | `/logs` | Access logs |
| GET | `/logs/stats` | Aggregate stats |

---

## Environment Variables

```bash
# .env
DATABASE_URL=postgresql://user:pass@host/tokenguard
REDIS_URL=redis://localhost:6379
JWT_SECRET=<64 byte hex>
MASTER_SECRET=<64 byte hex>
MAX_TOKEN_EXPIRY=86400   # hard cap: 24h
MIN_TOKEN_EXPIRY=30      # minimum: 30s
PORT=3000
DASHBOARD_ORIGINS=https://dashboard.tokenguard.io
```

---

## Deployment

### Backend (Docker)
```bash
cd backend
docker build -t tokenguard-api .
docker run -p 3000:3000 --env-file .env tokenguard-api
```

### Migrations
```bash
psql $DATABASE_URL -f backend/src/migrations/001_init.sql
```

### CDN Loader (Cloudflare Workers)
```bash
cd loader
wrangler deploy
```

---

## Security Properties

| Property | Implementation |
|----------|---------------|
| Token expiry | Backend-only via `resolveExpiry()` — client has zero influence |
| Domain validation | `strict` / `wildcard` / `off` per project |
| Single session | Redis binding `session:{jti}` → `sessionId` |
| Revocation | Redis `revoked:{jti}` — checked before any DB call |
| IP masking | Last octet zeroed for GDPR-safe logging |
| Bundle encryption | AES-GCM-256 with ephemeral per-(project,jti) key |
| Heartbeat | Rolling token renewal — dead client detected in ≤3 beats |
| Rate limiting | Per-IP global + per-endpoint specific limits |
