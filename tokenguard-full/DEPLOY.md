# TokenGuard — Deploy Passo a Passo

## Pré-requisitos
- Conta no GitHub
- Conta no Railway (railway.app)
- Conta no Supabase (supabase.com)
- Conta no Vercel (vercel.com)
- Conta no Cloudflare (cloudflare.com) — para loader CDN

---

## PASSO 1 — Subir o código no GitHub

```bash
cd tokenguard-full
git init
git add .
git commit -m "feat: TokenGuard MVP"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/tokenguard.git
git push -u origin main
```

---

## PASSO 2 — Banco de dados no Supabase

1. Acesse supabase.com → New Project
2. Dê um nome e crie uma senha forte para o banco
3. Vá em **SQL Editor** e cole o conteúdo de `backend/src/migrations/001_init.sql`
4. Clique em **Run**
5. Vá em **Settings → Database → Connection string → URI**
6. Copie a URL (parece com `postgresql://postgres:SENHA@db.PROJETO.supabase.co:5432/postgres`)

---

## PASSO 3 — Backend no Railway

1. Acesse railway.app → New Project → Deploy from GitHub Repo
2. Selecione seu repositório
3. Configure o **Root Directory** como `backend`
4. Vá em **Variables** e adicione:

```
JWT_SECRET=<rode: openssl rand -hex 32>
MASTER_SECRET=<rode: openssl rand -hex 32>
DATABASE_URL=<URL do Supabase do passo 2>
NODE_ENV=production
PORT=3000
```

5. Vá em **+ New** → **Database** → **Add Redis**
   - O Railway injeta `REDIS_URL` automaticamente

6. Clique em **Deploy** — aguarde ficar verde
7. Em **Settings → Networking → Generate Domain** — copie a URL (ex: `tokenguard-api.up.railway.app`)

---

## PASSO 4 — Frontend no Vercel

1. Acesse vercel.com → New Project → Import do GitHub
2. Selecione o repositório
3. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
4. Em **Environment Variables** adicione:

```
VITE_API_URL=https://tokenguard-api.up.railway.app
```

5. Clique em **Deploy** — aguarde ficar verde
6. Copie a URL gerada (ex: `tokenguard-frontend.vercel.app`)

---

## PASSO 5 — Loader no Cloudflare Pages

```bash
cd loader
npm install -g wrangler
wrangler login
wrangler pages deploy . --project-name tokenguard-loader
```

Ou via dashboard:
1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git
2. Selecione o repositório, pasta `loader`
3. Build command: (deixe vazio)
4. Output directory: `.`

Você terá: `https://tokenguard-loader.pages.dev/loader.js`

---

## PASSO 6 — Adicionar ALLOWED_ORIGINS no Railway

Volte no Railway → Variables e adicione:

```
ALLOWED_ORIGINS=https://tokenguard-frontend.vercel.app,https://tokenguard-loader.pages.dev
```

Faça redeploy.

---

## PASSO 7 — Testar

1. Acesse `https://tokenguard-frontend.vercel.app`
2. Crie uma conta
3. Crie um projeto com seu domínio
4. Gere um token
5. Teste o loader no seu app:

```html
<script
  src="https://tokenguard-loader.pages.dev/loader.js"
  data-project="proj_SEU_ID"
  data-api="https://tokenguard-api.up.railway.app"
></script>
```

---

## Domínio customizado (opcional)

Se tiver um domínio (ex: `tokenguard.io`):

| Subdomínio | DNS | Destino |
|---|---|---|
| `app.tokenguard.io` | CNAME | `cname.vercel-dns.com` |
| `api.tokenguard.io` | CNAME | `tokenguard-api.up.railway.app` |
| `cdn.tokenguard.io` | CNAME | `tokenguard-loader.pages.dev` |

Configure em cada plataforma (Vercel, Railway, Cloudflare) a seção **Custom Domain**.

---

## Variáveis de ambiente — resumo final

### Railway (backend)
```
JWT_SECRET=xxxx
MASTER_SECRET=xxxx
DATABASE_URL=postgresql://...
REDIS_URL=redis://...  ← injetado automaticamente
ALLOWED_ORIGINS=https://app.tokenguard.io
NODE_ENV=production
PORT=3000
```

### Vercel (frontend)
```
VITE_API_URL=https://api.tokenguard.io
```

---

## Custo estimado (início)

| Serviço | Plano | Limite grátis |
|---|---|---|
| Railway | Starter | $5 crédito/mês |
| Supabase | Free | 500MB DB, 2GB banda |
| Vercel | Hobby | 100GB banda |
| Cloudflare Pages | Free | 500 deploys/mês |

**Total: $0 para começar.**
