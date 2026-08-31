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
51:    - **Domain / FQDN**: `https://autoeod-be.yourdomain.com`
52: 3. Add **Environment Variables**:
53:    ```env
54:    NODE_ENV=production
55:    PORT=3001
56:    DATABASE_URL=your_postgres_connection_url_from_step_1
57:    REDIS_URL=your_redis_connection_url_from_step_2
58:    FRONTEND_URL=https://autoeod.yourdomain.com
59:    JWT_ACCESS_SECRET=your_jwt_access_secret_min_32_chars
60:    JWT_REFRESH_SECRET=your_jwt_refresh_secret_min_32_chars
61:    ENCRYPTION_KEY=your_64_char_hex_encryption_key
62:    GITHUB_CLIENT_ID=your_github_client_id
63:    GITHUB_CLIENT_SECRET=your_github_client_secret
64:    GITHUB_CALLBACK_URL=https://autoeod-be.yourdomain.com/api/integrations/github/callback
65:    GOOGLE_CLIENT_ID=your_google_client_id
66:    GOOGLE_CLIENT_SECRET=your_google_client_secret
67:    GOOGLE_CALLBACK_URL=https://autoeod-be.yourdomain.com/api/auth/google/callback
68:    ZOHO_CLIENT_ID=your_zoho_client_id
69:    ZOHO_CLIENT_SECRET=your_zoho_client_secret
70:    ZOHO_CALLBACK_URL=https://autoeod-be.yourdomain.com/api/auth/zoho/callback
71:    ZOHO_OAUTH_DOMAIN=https://accounts.zoho.com
72:    ZOHO_API_DOMAIN=https://mail.zoho.com
73:    OPENAI_API_KEY=sk-or-v1-your-openrouter-key
74:    OPENAI_BASE_URL=https://openrouter.ai/api/v1
75:    OPENAI_MODEL=minimax/minimax-m3:free
76:    OPENAI_FALLBACK_MODEL=cohere/north-mini-code:free
77:    RESEND_API_KEY=re_your-resend-api-key-here
78:    EMAIL_FROM=AutoEOD <reports@yourdomain.com>
79:    LOG_LEVEL=info
80:    ```
81: 4. Click **Deploy**. (It automatically runs `prisma db push` and starts both API and Background Worker in 1 single memory-efficient node process).
82: 
83: ---
84: 
85: ### 4️⃣ Step 4: Create Frontend Web Application
86: 1. Click **+ New Resource** → **Application** → Connect your Git repo (`AutoEOD`).
87: 2. Configure settings:
88:    - **Build Pack**: `Dockerfile`
89:    - **Dockerfile Path**: `Dockerfile.web`
90:    - **Port**: `80`
91:    - **Domain / FQDN**: `https://autoeod.yourdomain.com`
92: 3. Add **Environment Variables / Build Arguments**:
93:    ```env
94:    VITE_API_URL=https://autoeod-be.yourdomain.com
95:    ```
4. Click **Deploy**.

---

## 🎯 Benefits of this 4-Service Setup
- **No Build OOM Crashing**: Each service builds in isolation without competing for CPU/RAM.
- **Auto DB Backups**: Coolify natively manages automated backups for PostgreSQL.
- **Dynamic Scale & Restart**: You can restart or redeploy the frontend without interrupting the API or Worker.
- **Zero Hardcoding**: All URLs and secrets are 100% environment-driven.
