# 🚀 Deploying AutoEOD as Separate Services in Coolify

Deploying each component as an independent service is **much lighter, faster to build, and avoids VPS Out-of-Memory (OOM) errors**.

---

## 🏗️ 4-Service Modular Architecture

```
┌────────────────────────────────────────────────────────┐
│                        COOLIFY                         │
│                                                        │
│  [1. PostgreSQL DB]    ◄────┐                          │
│  (Coolify Database)         │ (DATABASE_URL)           │
│                             │                          │
│  [2. Redis Cache]      ◄────┼─── [3. Backend Service]  │
│  (Coolify Database)         │    (Dockerfile.backend)  │
│                             │    • Express API (:3001) │
│                             │    • BullMQ Worker       │
│                             │    • Auto Migrations     │
│                             │                          │
│  [4. Frontend Web]     ─────┘ (VITE_API_URL)           │
│  (Dockerfile.web - Nginx :80)                          │
└────────────────────────────────────────────────────────┘
```

---

## ⚡ Step-by-Step Setup in Coolify

### 1️⃣ Step 1: Create PostgreSQL Database
1. In Coolify, click **+ New Resource** → **Database** → **PostgreSQL**.
2. Click **Start / Deploy**.
3. Copy the **Internal Database URL** (e.g., `postgresql://postgres:PASSWORD@postgres:5432/postgres`) or use external Neon DB (`DATABASE_URL`).

---

### 2️⃣ Step 2: Create Redis Database
1. In Coolify, click **+ New Resource** → **Database** → **Redis**.
2. Click **Start / Deploy**.
3. Copy the **Internal Redis URL** (e.g., `redis://default:PASSWORD@redis:6379`) or use external Upstash Redis (`REDIS_URL`).

---

### 3️⃣ Step 3: Create Backend Application (API + Worker)
1. Click **+ New Resource** → **Application** → Connect your Git repo (`AutoEOD`).
2. Configure settings:
   - **Build Pack**: `Dockerfile`
   - **Dockerfile Path**: `Dockerfile.backend`
   - **Port**: `3001`
   - **Domain / FQDN**: `https://jzxnkdlzyldc8yf1g6sszryg.kachakaran.me`
3. Add **Environment Variables**:
   ```env
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=your_postgres_connection_url_from_step_1
   REDIS_URL=your_redis_connection_url_from_step_2
   FRONTEND_URL=https://ctsslkcelp1jc0xd5id3lgnl.kachakaran.me
   JWT_ACCESS_SECRET=your_jwt_access_secret_min_32_chars
   JWT_REFRESH_SECRET=your_jwt_refresh_secret_min_32_chars
   ENCRYPTION_KEY=your_64_char_hex_encryption_key
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   GITHUB_CALLBACK_URL=https://jzxnkdlzyldc8yf1g6sszryg.kachakaran.me/api/integrations/github/callback
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=https://jzxnkdlzyldc8yf1g6sszryg.kachakaran.me/api/auth/google/callback
   ZOHO_CLIENT_ID=your_zoho_client_id
   ZOHO_CLIENT_SECRET=your_zoho_client_secret
   ZOHO_CALLBACK_URL=https://jzxnkdlzyldc8yf1g6sszryg.kachakaran.me/api/auth/zoho/callback
   ZOHO_OAUTH_DOMAIN=https://accounts.zoho.com
   ZOHO_API_DOMAIN=https://mail.zoho.com
   OPENAI_API_KEY=your_groq_or_openai_api_key
   OPENAI_BASE_URL=https://api.groq.com/openai/v1
   OPENAI_MODEL=llama-3.3-70b-versatile
   OPENAI_FALLBACK_MODEL=llama-3.3-70b-versatile
   RESEND_API_KEY=re_your-resend-api-key-here
   EMAIL_FROM=AutoEOD <reports@yourdomain.com>
   LOG_LEVEL=info
   ```
4. Click **Deploy**. (It automatically runs `prisma db push` and starts both API and Background Worker in 1 single memory-efficient node process).

---

### 4️⃣ Step 4: Create Frontend Web Application
1. Click **+ New Resource** → **Application** → Connect your Git repo (`AutoEOD`).
2. Configure settings:
   - **Build Pack**: `Dockerfile`
   - **Dockerfile Path**: `Dockerfile.web`
   - **Port**: `80`
   - **Domain / FQDN**: `https://ctsslkcelp1jc0xd5id3lgnl.kachakaran.me`
3. Add **Environment Variables / Build Arguments**:
   ```env
   VITE_API_URL=https://jzxnkdlzyldc8yf1g6sszryg.kachakaran.me
   ```
4. Click **Deploy**.

---

## 🎯 Benefits of this 4-Service Setup
- **No Build OOM Crashing**: Each service builds in isolation without competing for CPU/RAM.
- **Auto DB Backups**: Coolify natively manages automated backups for PostgreSQL.
- **Dynamic Scale & Restart**: You can restart or redeploy the frontend without interrupting the API or Worker.
- **Zero Hardcoding**: All URLs and secrets are 100% environment-driven.
