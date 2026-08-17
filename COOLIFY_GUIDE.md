# 🚀 Deploying AutoEOD to Coolify

This guide walks you through deploying the complete AutoEOD stack (PostgreSQL, Redis, Express API, BullMQ Worker, and Vite/React Web App) to [Coolify](https://coolify.io) using Docker Compose.

---

## 🏗️ Architecture Overview

The `docker-compose.yml` orchestrates 5 unified services:

| Service | Technology | Host Port / Container Port | Description |
| :--- | :--- | :--- | :--- |
| **`web`** | Nginx + Vite React SPA | `3000` ➔ `80` | Frontend UI with SPA routing & `/api/` reverse-proxy |
| **`api`** | Node.js (Express + Prisma) | `3001` ➔ `3001` | REST API & OAuth Handlers |
| **`worker`** | Node.js (BullMQ) | Internal | Background task scheduler, GitHub sync, & AI reporter |
| **`postgres`** | PostgreSQL 16 Alpine | Internal | Persistent database (`pgdata` volume) |
| **`redis`** | Redis 7 Alpine | Internal | Message queue and caching (`redisdata` volume) |

> **VPS Port Conflict Prevention**: Standard host ports (`80`, `443`, `22`) are **never occupied** by this stack. Coolify's reverse proxy (Traefik/Caddy) maps your domain to the container directly while the host binds safely to `3000` and `3001`.

---

## ⚡ Quick Deployment Steps

### Step 1: Add a New Resource in Coolify
1. In your Coolify dashboard, select your **Project** and **Environment**.
2. Click **+ New Resource** → Select **Docker Compose** (or **Git-based Project**).
3. Connect your GitHub/GitLab repository:
   - **Repository**: Your AutoEOD repository URL
   - **Branch**: `main` (or your deployment branch)
   - **Compose File Path**: `docker-compose.yml` (default)

---

### Step 2: Configure Domains in Coolify

Choose one of two hosting configurations:

#### 🔹 Option A: Single Domain (Recommended & Easiest)
Map your custom domain to the **`web`** service:
- Domain for `web`: `https://autoeod.yourdomain.com` (Target container port: `80`)
- **How it works**: Coolify routes public HTTPS traffic to the `web` container. Nginx serves the React frontend and automatically proxies `/api/*` calls internally to the `api` container. No CORS setup or secondary domain required!
- **Environment Variables**:
  ```env
  FRONTEND_URL=https://autoeod.yourdomain.com
  ```

#### 🔹 Option B: Separate Domains for Web and API
- Domain for `web`: `https://app.yourdomain.com` (Target container port: `80`)
- Domain for `api`: `https://api.yourdomain.com` (Target container port: `3001`)
- **Environment Variables**:
  ```env
  FRONTEND_URL=https://app.yourdomain.com
  VITE_API_URL=https://api.yourdomain.com
  ```

---

### Step 3: Generate Secret Keys

Run these commands in your terminal to generate cryptographically secure keys:

```bash
# JWT Access Secret (min 32 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT Refresh Secret (min 32 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encryption Key for OAuth Tokens (MUST be exactly 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Step 4: Add Environment Variables in Coolify

In Coolify, go to the **Environment Variables** tab of your Docker Compose resource and paste the required values:

```env
# ── Core Secrets (Required) ──
JWT_ACCESS_SECRET=your_generated_64_char_access_secret
JWT_REFRESH_SECRET=your_generated_64_char_refresh_secret
ENCRYPTION_KEY=your_generated_64_char_hex_encryption_key

# ── Application URLs ──
FRONTEND_URL=https://autoeod.yourdomain.com

# ── AI Integration ──
OPENAI_API_KEY=sk-proj-your-openai-api-key
OPENAI_MODEL=gpt-4o-mini

# ── GitHub OAuth (Optional / Integration) ──
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://autoeod.yourdomain.com/api/integrations/github/callback

# ── Google OAuth for Email (Optional) ──
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://autoeod.yourdomain.com/api/auth/google/callback

# ── Zoho OAuth for Email (Optional) ──
ZOHO_CLIENT_ID=your_zoho_client_id
ZOHO_CLIENT_SECRET=your_zoho_client_secret
ZOHO_CALLBACK_URL=https://autoeod.yourdomain.com/api/auth/zoho/callback

# ── Email Delivery (Resend - Optional) ──
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=AutoEOD <reports@yourdomain.com>
```

> **Note on Database & Redis**: By default, `docker-compose.yml` will run bundled PostgreSQL and Redis instances with persistent volumes. If you want to use external managed databases (e.g. Neon PostgreSQL or Upstash Redis), simply provide `DATABASE_URL` and `REDIS_URL` in the environment variables.

---

### Step 5: Deploy!

Click **Deploy** in Coolify.
- Coolify will build the Docker images and start all 5 services in dependency order.
- Prisma schema migrations (`prisma db push`) run automatically on startup when the database becomes healthy.
- Docker health checks on `/health` (API) and `/healthz` (Web) ensure traffic is only routed once the containers are fully operational.

---

## 🔍 Health Checks & Monitoring

- **Frontend Health**: `GET /healthz` (returns `200 healthy`)
- **API Health**: `GET /health` (returns `{"status":"ok", "timestamp":"..."}`)
- **Admin Dashboard**: Access the admin metrics, queue health, and logs at `/admin` within the web app (for users with `role: "ADMIN"`).

---

## 🛡️ Persistence & Backups

The following Docker volumes are created and persisted across deployments:
- `pgdata`: PostgreSQL data directory (`/var/lib/postgresql/data`)
- `redisdata`: Redis append-only persistence file (`/data`)

In Coolify, you can enable automated PostgreSQL backups directly from the storage settings or volume configuration.
