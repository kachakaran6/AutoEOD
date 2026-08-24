<div align="center">

# 🚀 AutoEOD
### Automated AI-Powered End-of-Day & Standup Report Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://react.dev)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-indigo.svg)](https://www.prisma.io)
[![BullMQ](https://img.shields.io/badge/BullMQ-Redis-red.svg)](https://bullmq.io)

**AutoEOD** connects to your developer workflows (GitHub, browser activity, calendar, IDE), aggregates your work throughout the day, and automatically generates structured, professional daily standup and End-of-Day (EOD) reports powered by AI.

</div>

---

## 🌟 Key Features

- 🐙 **GitHub Integration**: Automatically fetches commits, pull requests, reviews, and issue discussions across all your repositories.
- 🤖 **AI-Driven Report Generation**: Converts raw technical events into concise, readable standup bullets (completed tasks, in-progress items, blockers, and tomorrow's plan) using Groq / OpenAI / Llama 3.3.
- ⏱️ **Per-User Scheduling & Timezones**: Configure exact work hours and delivery times with full IANA timezone support.
- ✉️ **Multi-Channel Delivery**: Send reports directly via Google Workspace Gmail, Zoho Mail, or transactional email (Resend).
- 🧩 **Chrome Extension & Desktop Tracker**: Optionally capture browser task context and time-on-task metrics without manual entry.
- 🛡️ **Enterprise-Grade Security**: AES-256-GCM token encryption at rest, secure JWT authentication with refresh token rotation, and multi-tenant data isolation.
- ⚡ **Self-Hostable**: 100% open-source with first-class Docker Compose and Coolify deployment support.

---

## 🏗️ Architecture

AutoEOD is structured as a lightweight TypeScript monorepo:

```
autoeod/
├── apps/
│   ├── api/        # Express REST API (Auth, OAuth callbacks, Activity, Reports, Admin)
│   ├── worker/     # BullMQ background queue worker (GitHub sync, AI generator, email dispatcher)
│   ├── web/        # React + Vite + Tailwind CSS dashboard SPA
│   ├── desktop/    # Optional desktop timeline assistant
│   └── extension/  # Optional Chrome MV3 browser extension
├── packages/
│   └── db/         # Prisma schema and shared database client
├── Dockerfile.backend # Multi-stage backend build (API + BullMQ Worker)
├── Dockerfile.web     # Multi-stage frontend build (Nginx + Vite SPA)
└── docker-compose.yml # Full local & production container stack
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: `20.x` or later
- **Docker & Docker Compose**: For local PostgreSQL and Redis
- **npm**: `10.x` or later

### 2. Clone & Install
```bash
git clone https://github.com/kachakaran6/AutoEOD.git
cd AutoEOD
npm install
```

### 3. Start Database & Redis
```bash
docker-compose up -d postgres redis
```

### 4. Configure Environment
```bash
cp .env.example .env
# Open .env and adjust your secrets, database connection, and API keys
```

### 5. Push Database Schema
```bash
npm run db:migrate
# or
npm run push --workspace=packages/db
```

### 6. Run Development Servers
You can run all three services concurrently in separate terminals:

```bash
# Terminal 1 — Backend API (:3001)
npm run dev:api

# Terminal 2 — Background Worker
npm run dev:worker

# Terminal 3 — Frontend Web Dashboard (:5173)
npm run dev:web
```

Access the web dashboard at `http://localhost:5173`.

---

## 🐳 Docker Deployment

To spin up the entire stack (Postgres, Redis, Backend, and Web) using Docker:

```bash
docker-compose up -d --build
```

- **Frontend Web Dashboard**: `http://localhost:3000`
- **Backend REST API**: `http://localhost:3001`

---

## ☁️ Self-Hosting with Coolify

AutoEOD is optimized for lightweight VPS hosting (e.g., Oracle Cloud, Hetzner, AWS, DigitalOcean) via **[Coolify](https://coolify.io)**:

1. **PostgreSQL**: Create a PostgreSQL 16 database resource in Coolify.
2. **Redis**: Create a Redis 7 database resource in Coolify.
3. **Backend App**:
   - Build pack: `Dockerfile` (`/Dockerfile.backend`)
   - Port: `3001`
   - Healthcheck: `/health`
   - Set environment variables from `.env.example`.
4. **Frontend App**:
   - Build pack: `Dockerfile` (`/Dockerfile.web`)
   - Port: `80`
   - Healthcheck: `/healthz`
   - Build argument: `VITE_API_URL=https://your-backend-domain.com`

---

## ⚙️ Environment Variables

See [`.env.example`](.env.example) for a full breakdown of all configuration keys:

| Variable | Required | Description |
| :--- | :---: | :--- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string (BullMQ queues) |
| `JWT_ACCESS_SECRET` | Yes | Secret key for signing JWT access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | Secret key for signing JWT refresh tokens (min 32 chars) |
| `ENCRYPTION_KEY` | Yes | 64-char hex key for AES-256-GCM token encryption at rest |
| `FRONTEND_URL` | Yes | URL of frontend web app (for CORS & OAuth redirects) |
| `GITHUB_CLIENT_ID` | Optional | GitHub OAuth Application Client ID |
| `GITHUB_CLIENT_SECRET`| Optional | GitHub OAuth Application Client Secret |
| `GITHUB_CALLBACK_URL` | Optional | GitHub OAuth redirect callback URL |
| `OPENAI_API_KEY` | Optional | OpenAI / Groq API key for report generation |
| `OPENAI_BASE_URL` | Optional | Custom base URL (e.g., `https://api.groq.com/openai/v1`) |
| `OPENAI_MODEL` | Optional | Model identifier (defaults to `llama-3.3-70b-versatile`) |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID for Gmail integration |
| `GOOGLE_CLIENT_SECRET`| Optional | Google OAuth client secret |
| `ZOHO_CLIENT_ID` | Optional | Zoho OAuth client ID for Zoho Mail integration |
| `ZOHO_CLIENT_SECRET` | Optional | Zoho OAuth client secret |
| `RESEND_API_KEY` | Optional | Resend API key for transactional emails |

---

## 📜 Available NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev:api` | Starts the Express API server with hot-reload (`tsx watch`) |
| `npm run dev:worker` | Starts the BullMQ worker process with hot-reload |
| `npm run dev:web` | Starts the Vite React frontend development server |
| `npm run build:backend` | Compiles `@autoeod/db`, `@autoeod/api`, and `@autoeod/worker` |
| `npm run build:web` | Compiles the production Vite bundle for `@autoeod/web` |
| `npm run build:all` | Compiles all packages and applications |
| `npm run db:generate` | Generates the Prisma client from `schema.prisma` |
| `npm run db:migrate` | Runs database migrations |
| `npm run db:studio` | Opens Prisma Studio GUI in browser |

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome! Feel free to check the [issues page](https://github.com/kachakaran6/AutoEOD/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add some amazing feature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
