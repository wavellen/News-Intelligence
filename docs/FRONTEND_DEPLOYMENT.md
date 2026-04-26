# Frontend Deployment — NewsIntel v5

The frontend is a single self-contained file: `frontend/index.html`.
No build step, no npm, no bundler required.

---

## Deployment options

### Option A: Served by the FastAPI backend (default)

`GET /dashboard` serves `frontend/index.html` directly.

This is the default setup — nothing extra needed. The frontend and API share the same domain so there are no CORS issues and `API_BASE = ''` works as-is.

**Access:** `https://your-app.railway.app/dashboard`

---

### Option B: Separate Railway service

1. Create a new service in your Railway project
2. Set **Root Directory** to `frontend`
3. Railway auto-reads `frontend/railway.toml`
4. Set env var: `NEWSINTEL_API_URL = https://your-api.railway.app`

**Required changes to `frontend/index.html`:**

Find line ~325 in the `<script>` block:
```js
var API_BASE = '';
```

Change it to your API URL:
```js
var API_BASE = 'https://your-api.railway.app';
```

Also set `ALLOWED_ORIGINS` on the API service:
```bash
railway variables set ALLOWED_ORIGINS=https://your-frontend.railway.app
```

---

## Authentication integration

The frontend handles auth automatically. Here's how it works:

### Token storage

Tokens are stored in `sessionStorage` (cleared on tab close, not persisted to disk):
```js
sessionStorage.setItem('access_token', data.access_token);
sessionStorage.setItem('refresh_token', data.refresh_token);
```

> **Note:** `localStorage` would persist across sessions but is more vulnerable to XSS. `sessionStorage` is the recommended default. For production, `httpOnly` cookies (set by the backend) would be the most secure option.

### Login flow

```js
async function login(email, password) {
  const res = await fetch(API_BASE + '/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password}),
  });
  if (!res.ok) throw new Error('Invalid credentials');
  const data = await res.json();
  sessionStorage.setItem('access_token', data.access_token);
  sessionStorage.setItem('refresh_token', data.refresh_token);
}
```

### Authenticated API calls

```js
async function apiFetch(path) {
  const token = sessionStorage.getItem('access_token');
  const headers = token ? {'Authorization': 'Bearer ' + token} : {};
  const res = await fetch(API_BASE + path, {headers});
  if (res.status === 401) {
    await refreshTokens();
    return apiFetch(path);  // retry once
  }
  return res.json();
}
```

### Token refresh

```js
async function refreshTokens() {
  const refresh = sessionStorage.getItem('refresh_token');
  if (!refresh) { redirectToLogin(); return; }
  const res = await fetch(API_BASE + '/auth/refresh', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({refresh_token: refresh}),
  });
  if (!res.ok) { redirectToLogin(); return; }
  const data = await res.json();
  sessionStorage.setItem('access_token', data.access_token);
  sessionStorage.setItem('refresh_token', data.refresh_token);
}
```

### API key alternative

For server-to-server or simple scripts:

```js
// Via header
fetch(API_BASE + '/insights/summary', {
  headers: {'X-API-Key': 'nip_your_key_here'},
});

// Via query param
fetch(API_BASE + '/insights/summary?api_key=nip_your_key_here');
```

Generate an API key: `POST /auth/api-key` (requires login first).

---

## CORS configuration

If the frontend is on a different domain, set `ALLOWED_ORIGINS` in the API environment:

```bash
# Single origin
railway variables set ALLOWED_ORIGINS=https://your-frontend.railway.app

# Multiple origins (comma-separated, no spaces)
railway variables set ALLOWED_ORIGINS=https://your-frontend.railway.app,https://yourdomain.com
```

**Never use `*` in production** — it allows any website to call your API with credentials.

---

## Frontend `API_BASE` quick reference

| Deployment scenario | `API_BASE` value |
|--------------------|-----------------|
| API and frontend same domain | `''` (empty string) |
| Railway separate service | `'https://your-api.railway.app'` |
| Local development | `'http://localhost:8000'` |
| Production custom domain | `'https://api.yourdomain.com'` |
