# AutoEOD — Phase 1

AI-powered daily EOD/standup report generator. Connects to GitHub, tracks your activity throughout the day, and generates structured professional reports using AI.

## Architecture

```
apps/
  api/      - Express + TypeScript API server (port 3001)
  worker/   - BullMQ worker process (separate Node process)
  web/      - React + Vite + TypeScript SPA (port 5173)
packages/
  db/       - Prisma schema + generated client (shared)
```

## Prerequisites

- Node.js 20+
- Docker (for Postgres + Redis)
- npm 10+

## Setup

### 1. Start infrastructure
```bash
docker-compose up -d
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in all variables in .env
```

### 3. Install dependencies
```bash
npm install
```

### 4. Run database migrations
```bash
npm run db:migrate
```

### 5. Start development servers (3 terminals)

**Terminal 1 — API server:**
```bash
npm run dev:api
```

**Terminal 2 — Worker process:**
```bash
npm run dev:worker
```

**Terminal 3 — Frontend:**
```bash
npm run dev:web
```

Open http://localhost:5173

## Environment Variables

See `.env.example` for all required variables and their descriptions.

## Key Features (Phase 1)

- GitHub OAuth integration with real-time activity tracking
- AI-powered EOD report generation (OpenAI)
- Per-user scheduling with timezone support
- Email delivery via Resend
- Multi-tenant with full data isolation
