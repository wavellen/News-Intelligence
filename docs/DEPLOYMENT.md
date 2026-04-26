# Deployment Guide — NewsIntel v5 (Railway)

---

## Pre-deployment checklist

Before deploying:

- [ ] `SECRET_KEY` is a unique 64-char hex string (`python -c "import secrets; print(secrets.token_hex(32))"`)
- [ ] `ALLOWED_ORIGINS` is set to your actual frontend domain (not `*`)
- [ ] `AUTH_MODE=required`
- [ ] `DATABASE_URL` points to PostgreSQL (not SQLite)
- [ ] `DEBUG=false`
- [ ] `.env` is in `.gitignore` — never committed
- [ ] `INITIAL_ADMIN_EMAIL` + `INITIAL_ADMIN_PASSWORD` set for first-run (remove after)

---

## Railway Deployment

**Why Railway:** Git-push deploys, generous free tier, simple PostgreSQL plugin, Nixpacks auto-detection.

### Steps

**1. Install Railway CLI**
```bash
npm install -g @railway/cli
railway login
```

**2. Create project with PostgreSQL**
```bash
railway init
railway add --plugin postgresql   # auto-sets DATABASE_URL
```

**3. Set environment variables**
```bash
railway variables set SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
railway variables set AUTH_MODE=required
railway variables set ALLOWED_ORIGINS=https://your-app.railway.app
railway variables set INITIAL_ADMIN_EMAIL=admin@example.com
railway variables set INITIAL_ADMIN_PASSWORD=YourPass1!
```

**4. Deploy**
```bash
railway up
```

Railway detects `.python-version` (3.11.9) and uses Nixpacks with the build command from `railway.toml`.

**5. Verify deployment**
```bash
# Check health
curl https://your-app.railway.app/health

# Login with admin
curl -X POST https://your-app.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YourPass1!"}'

# Trigger first ingestion (use token from login response)
curl -X POST https://your-app.railway.app/admin/pipeline \
  -H "Authorization: Bearer eyJ..."
```

### Frontend service (separate)

The frontend can be deployed as a separate Railway service:

1. Create a new service in your Railway project
2. Set **Root Directory** to `frontend`
3. Railway auto-reads `frontend/railway.toml`
4. Set env var: `NEWSINTEL_API_URL = https://your-api.railway.app`

Or serve it from the backend directly via `GET /dashboard` (no extra setup needed).

### Railway configuration notes

- `railway.toml` contains all non-secret variables
- `DATABASE_URL` must be set to `${{news-intel-db.DATABASE_URL}}` — the Railway reference variable
- If `DATABASE_URL` resolves to empty, the app falls back to SQLite with a warning
- Migrations run automatically on every deploy via `startCommand`
- Add optional API keys (`NEWSAPI_KEY`, `GUARDIAN_API_KEY`, `GNEWS_API_KEY`) via Railway UI

---

## Running database migrations

Migrations run automatically on deploy (`alembic upgrade head` in `startCommand`).

For manual migration management:

```bash
# Apply all pending migrations
railway run alembic upgrade head

# Check current revision
railway run alembic current

# Rollback one step
railway run alembic downgrade -1
```

---

## Environment variable reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | ✅ | placeholder | 64-char hex — generate fresh per deployment |
| `DATABASE_URL` | ✅ prod | SQLite | PostgreSQL connection string |
| `AUTH_MODE` | ✅ prod | `required` | required · optional · disabled |
| `ALLOWED_ORIGINS` | ✅ prod | `*` | Comma-separated frontend domain(s) |
| `ENV` | — | `development` | development · production |
| `DEBUG` | — | `true` | `false` in production |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | — | `30` | JWT access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | — | `7` | JWT refresh token lifetime |
| `INITIAL_ADMIN_EMAIL` | First run | — | Seeds admin on first startup |
| `INITIAL_ADMIN_PASSWORD` | First run | — | Seeds admin on first startup |
| `NEWSAPI_KEY` | — | — | newsapi.org (100 req/day free) |
| `GUARDIAN_API_KEY` | — | — | open-platform.theguardian.com |
| `GNEWS_API_KEY` | — | — | gnews.io (100 req/day free) |
| `FETCH_INTERVAL_MINUTES` | — | `30` | News ingestion frequency |
| `MAX_ARTICLES_PER_SOURCE` | — | `30` | Per-feed article cap per cycle |
| `STOCK_UPDATE_INTERVAL_MINUTES` | — | `15` | Market data refresh frequency |
| `RATE_LIMIT_DEFAULT` | — | `60` | Default requests/min per IP |
| `RATE_LIMIT_EXPENSIVE` | — | `20` | `/insights/summary`, `/facts/*` |
| `RATE_LIMIT_ADMIN` | — | `10` | `/admin/*` endpoints |
| `RATE_LIMIT_STOCKS` | — | `30` | `/stocks/*` endpoints |
| `SPACY_MODEL` | — | `en_core_web_sm` | NLP model name |
| `MIN_ARTICLE_WORDS` | — | `50` | Discard articles shorter than this |
| `USER_REGION` | — | `global` | Default stock market region |

---

## Health monitoring

Railway checks `GET /health`. The endpoint returns:

```json
{"status": "healthy", "db": "connected", "version": "1.0.0"}
```

If the DB is unreachable, it returns `503 Service Unavailable`.

The `healthcheckTimeout` is set to 60s in `railway.toml` to allow spaCy model loading time.
