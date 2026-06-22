# AutoEOD — Master PRD (Phase 1)
**AI-powered EOD / Standup report generator — GitHub-first, multi-tenant SaaS**

Version: 1.0
Owner: Karan
Status: Build-ready
Scope: Phase 1 only. Everything in this document must be fully functional before any Phase 2 integration (Jira, Slack, Teams, etc.) is touched.

---

## 1. Product Definition

### 1.1 The problem
Employees at IT companies are required to send daily EOD/standup emails summarizing what they worked on, blockers, and tomorrow's plan. This is manually written every day, gets forgotten under workload, and forgetting has real consequences (performance reviews, manager trust).

### 1.2 The Phase 1 solution
A web app where a user:
1. Connects their GitHub account (OAuth).
2. Sets a work schedule (start time, end time, reminder time, timezone).
3. Lets the system passively collect GitHub activity all day (commits, PRs, PR reviews, issues).
4. At a scheduled time, the system uses an LLM to turn that raw activity into a structured, professional EOD report.
5. The user reviews the report on a dashboard, edits if needed, and clicks **Approve & Send** — which emails it to a configured recipient (manager).

**Explicitly NOT in Phase 1:** auto-send without approval, Jira/Slack/Teams/Calendar/ChatGPT-log integrations, mobile app, team/manager dashboards, burnout detection, analytics charts. These are listed in Section 10 (Future Phases) for context only — do not build them now.

### 1.3 Success criteria for Phase 1 (what "fully functional" means)
Phase 1 is done when all of the following are true end-to-end, with real data, no mocks:
- A new user can sign up, connect GitHub via real OAuth, and see their actual commits/PRs appear in a timeline within minutes.
- A cron job runs every day at the user's configured reminder time (per-user, per-timezone) and generates a real AI report from that user's actual GitHub activity for that day.
- The user gets a notification (in-app, minimum; email reminder is a stretch goal inside Phase 1, see 6.5) that their report is ready.
- The user can view the report, regenerate it, manually edit any field, and send it as a real email via SMTP/Resend to a real recipient address.
- All of this works for multiple concurrent users (multi-tenant), with each user's GitHub tokens and data fully isolated.
- The system survives a server restart without losing scheduled jobs (cron must be DB-driven, not in-memory only).

If any of the above is faked, hardcoded, or only works for one hardcoded user, Phase 1 is not done.

---

## 2. Users & Tenancy Model

This is a **public multi-tenant SaaS** from day one. Design every table, every query, and every background job with tenant isolation as a first-class constraint — not something added later.

- Each signed-up person is a `User` (tenant = user; no organizations/teams in Phase 1).
- Every data row (integration tokens, activity events, reports, settings) is scoped by `user_id`.
- No cross-user data access anywhere, including in admin tooling (skip admin tooling in Phase 1).
- Background jobs (cron, queues) must iterate **all active users**, not one hardcoded user.

---

## 3. Tech Stack (locked for Phase 1)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React.js + TypeScript + Vite | Not Next.js for Phase 1 — keep frontend a pure SPA calling the API. Simpler to reason about for a solo dev. |
| UI components | shadcn/ui + Tailwind CSS | Use shadcn defaults. Do not custom-theme in Phase 1. Pull components only as needed (Button, Card, Input, Switch, Tabs, Dialog, Table, Badge, Skeleton, Toast/Sonner). |
| Icons | lucide-react | |
| Data fetching | TanStack Query | All API calls go through it — gives you caching, refetch, loading/error states for free. |
| Routing | React Router v6 | |
| Backend | Node.js + Express + TypeScript | |
| ORM | Prisma | |
| Database | PostgreSQL | |
| Queue / scheduling | BullMQ + Redis | Cron logic lives here, not in a naive `setInterval`. |
| AI | OpenAI API (model: `gpt-4.1` or current equivalent — confirm latest available model at build time, do not hardcode a model name that may be deprecated) | Structured JSON output mode. |
| Auth | JWT (access + refresh token pair), httpOnly cookies | Email/password signup is fine for Phase 1. Skip Google/Microsoft OAuth login — GitHub OAuth is only used for the *integration*, not necessarily for login, see 4.1. |
| Email sending | Resend (preferred) or SMTP via Nodemailer | Resend is simpler to set up; use it unless the user already has SMTP creds. |
| Hosting (suggested, not mandated) | Frontend: Vercel/Netlify. Backend+Redis+Postgres: Railway/Render/Fly.io | Not part of this PRD's required deliverable — local Docker Compose setup is the actual Phase 1 deliverable; deployment is the user's choice. |

**Explicitly excluded from Phase 1 stack:** n8n (logic lives in code, not a separate automation tool — n8n adds an extra moving part with its own failure modes; revisit in Phase 2 if genuinely needed), GraphQL, microservices, Kubernetes.

---

## 4. Core Architecture

```
┌─────────────┐      HTTPS/JSON       ┌──────────────────┐
│  React SPA  │ ───────────────────▶  │  Express API     │
│  (Vite)     │ ◀───────────────────  │  (TypeScript)     │
└─────────────┘                       └─────────┬────────┘
                                                  │
                        ┌─────────────────────────┼─────────────────────────┐
                        ▼                         ▼                         ▼
                 ┌─────────────┐          ┌──────────────┐          ┌──────────────┐
                 │ PostgreSQL  │          │    Redis      │          │  OpenAI API   │
                 │  (Prisma)   │          │  (BullMQ)     │          │               │
                 └─────────────┘          └──────┬───────┘          └──────────────┘
                                                  │
                                          ┌───────┴────────┐
                                          │  Worker process │
                                          │  (separate      │
                                          │  Node process)   │
                                          └───────┬────────┘
                                                  │
                                  ┌───────────────┼───────────────┐
                                  ▼               ▼               ▼
                           GitHub REST API   Resend/SMTP    PostgreSQL
```

**Critical architectural decision:** the worker that runs scheduled jobs (GitHub polling, report generation, reminder checks) is a **separate Node process** from the API server, both pointing at the same Postgres + Redis. This is non-negotiable for correctness — an API server that also runs cron in-process will duplicate jobs the moment you scale to 2 instances, and will lose jobs on every deploy restart if the queue isn't Redis-backed. BullMQ + Redis solves both.

---

## 5. Data Model (Prisma schema — authoritative)

This schema is the source of truth. Implement exactly this in Phase 1; do not add Jira/Slack tables yet even as placeholders — add them in Phase 2 when actually building that integration.

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  name          String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  settings          UserSettings?
  githubIntegration GithubIntegration?
  activityEvents    ActivityEvent[]
  reports           Report[]
}

model UserSettings {
  id               String   @id @default(cuid())
  userId           String   @unique
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  timezone         String   @default("Asia/Kolkata")   // IANA tz name, e.g. "Asia/Kolkata"
  workStartTime    String   @default("09:00")          // 24h "HH:mm", local to `timezone`
  workEndTime      String   @default("18:00")
  reportTime       String   @default("17:50")          // when daily report generation fires
  autoGenerate     Boolean  @default(true)
  managerEmail     String?
  ccEmails         String?                              // comma-separated
  reportTemplate   String   @default("professional")    // "professional" | "short" | "detailed"
  reportLanguage   String   @default("english")         // "english" | "hindi" | "gujarati"

  updatedAt        DateTime @updatedAt
}

model GithubIntegration {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  githubUserId      String   // GitHub's numeric/string user id
  githubUsername    String
  accessTokenEnc    String   // AES-256-GCM encrypted, see Section 7.3
  scopes            String   // space-separated scopes granted
  connectedAt       DateTime @default(now())
  lastSyncedAt      DateTime?
  lastSyncCursor    String?  // ISO timestamp of last successfully fetched event, for incremental polling

  @@index([userId])
}

// Normalized record of one unit of GitHub activity, used as the raw
// material the AI report is generated from. One row per commit / PR /
// PR review / issue comment etc.
model ActivityEvent {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  source        String   // "github" (only value in Phase 1, but kept generic for Phase 2)
  type          String   // "commit" | "pull_request" | "pr_review" | "issue" | "issue_comment"
  externalId    String   // GitHub's id/sha for de-duplication
  repo          String   // e.g. "karan/noctune"
  title         String   // commit message / PR title / issue title
  url           String   // link back to GitHub
  occurredAt    DateTime // when the event actually happened on GitHub
  rawPayload    Json     // full API response for that item, for audit/debug/reprocessing

  createdAt     DateTime @default(now())

  @@unique([userId, source, externalId])
  @@index([userId, occurredAt])
}

model Report {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  reportDate      String   // "YYYY-MM-DD", local to user's timezone
  status          String   @default("draft") // "draft" | "approved" | "sent" | "failed"

  summary         String?  @db.Text
  completedItems  Json?    // string[]
  inProgressItems Json?    // string[]
  blockers        String?  @db.Text
  tomorrowPlan    String?  @db.Text

  rawEventIds     Json     // string[] of ActivityEvent.id used to generate this report
  aiModel         String?  // model name used, for audit
  generatedAt     DateTime?
  sentAt          DateTime?
  sentTo          String?
  errorMessage    String?  // populated if status = "failed"

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, reportDate])
  @@index([userId, reportDate])
}
```

**Why `ActivityEvent` is normalized and source-tagged now, even though Phase 1 only has GitHub:** adding Jira in Phase 2 must not require a schema migration that touches existing data. `source: "github"` and a generic `type`/`title`/`url` shape means Phase 2 just adds rows with `source: "jira"` — zero schema change. This is the one piece of forward design baked into Phase 1, because the cost of doing it now is zero and the cost of retrofitting it later is a painful migration.

---

## 6. Functional Requirements — Phase 1

### 6.1 Authentication

- Email + password signup/login.
- Password hashed with bcrypt (cost factor 12).
- On login, issue a short-lived JWT access token (15 min) + a longer-lived refresh token (7 days), refresh token stored in an httpOnly, secure, sameSite=lax cookie.
- `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`.
- Every other API route requires a valid access token; middleware attaches `req.userId`.

### 6.2 GitHub Integration (OAuth + data fetch)

**OAuth flow:**
1. User clicks "Connect GitHub" on the Integrations page.
2. Frontend redirects to `GET /api/integrations/github/connect`, which redirects to GitHub's OAuth authorize URL with scopes `repo, read:user` and a `state` param (CSRF protection, store in a short-lived signed cookie).
3. GitHub redirects back to `GET /api/integrations/github/callback?code=...&state=...`.
4. Backend verifies `state`, exchanges `code` for an access token via GitHub's token endpoint, fetches the GitHub user profile, encrypts the access token (Section 7.3), and upserts a `GithubIntegration` row for `req.userId`.
5. Redirect back to frontend `/integrations?github=connected`.

**Data fetch (the actual tracking):**
- A BullMQ repeatable job (`github-sync`) runs **every 15 minutes** for every user with a `GithubIntegration` row.
- For each user: call GitHub's `GET /users/{username}/events` (or, more reliably, the Search API for commits/PRs by author since `lastSyncCursor` — use whichever the build-time GitHub API docs confirm gives complete coverage; do not assume from memory, verify against current GitHub REST API docs at implementation time) filtered to events after `lastSyncCursor`.
- Normalize each relevant event (`PushEvent` → one `ActivityEvent` per commit in the push; `PullRequestEvent` → one per PR opened/merged; `PullRequestReviewEvent` → one per review; `IssuesEvent`/`IssueCommentEvent` → one per issue activity) and upsert into `ActivityEvent` using the `[userId, source, externalId]` unique constraint to avoid duplicates.
- Update `lastSyncCursor` to the timestamp of the most recent event processed.
- On GitHub API failure (rate limit, token revoked), log the error, do not crash the worker, and if the token is revoked (401), mark the integration as needing reconnection (add a `needsReconnect Boolean @default(false)` field if you hit this in practice — flagged here as a likely real-world edge case, not pre-built speculatively).

**Integrations page (frontend):**
- Single card: "GitHub" with Connect/Connected state, username shown when connected, "Last synced: X minutes ago", and a "Disconnect" button (`DELETE /api/integrations/github`, which deletes the `GithubIntegration` row and is the only place a user's GitHub token is ever deleted, not just unlinked from UI).
- All other integration cards (Jira, Slack, ChatGPT, etc.) are rendered but disabled/greyed out with a "Coming soon" badge — this matches Karan's original vision UI but makes clear they are non-functional in Phase 1. Do not wire fake "Connect" buttons that do nothing silently.

### 6.3 Report Generation Pipeline

This is the core of the product. It must run as a BullMQ job, not inline in an HTTP request — report generation involves an LLM call and must not block or time out an API request, and must be retryable on failure.

**Trigger:** A repeatable BullMQ job (`schedule-dispatcher`) runs every 5 minutes. It queries all users where `UserSettings.autoGenerate = true` and the current time in `UserSettings.timezone` matches `UserSettings.reportTime` (within the 5-minute window, with a check against `Report` for that `reportDate` to avoid double-triggering). For each match, it enqueues a `generate-report` job for that `userId`.

**`generate-report` job logic:**
1. Fetch all `ActivityEvent` rows for the user where `occurredAt` falls within `[workStartTime, now]` on `reportDate`, in the user's timezone.
2. If zero events found, still generate a report but with an honest "No tracked activity today" summary — never fabricate work that didn't happen.
3. Build a structured prompt (Section 6.4) and call OpenAI with JSON-mode structured output.
4. Parse and validate the response against a strict schema (use Zod) — if validation fails, retry once with an error-correction prompt; if it fails twice, mark `Report.status = "failed"` with `errorMessage` and stop (do not silently send garbage).
5. Upsert the `Report` row (`status = "draft"`, `generatedAt = now()`).
6. Create an in-app notification (simplest Phase 1 version: a `read Boolean @default(false)` flag is enough — do not build a full notification center; a bell icon with unread count and a list is sufficient).

**Manual trigger:** `POST /api/reports/generate` lets the user trigger generation on demand (the "Generate Report" button) for the current day, bypassing the schedule — same underlying job, enqueued immediately instead of waiting for cron.

**Regenerate:** `POST /api/reports/:id/regenerate` re-runs the pipeline for an existing report's date, overwriting the draft fields (keeps `id` and `reportDate`, since `[userId, reportDate]` is unique).

### 6.4 AI Prompt Design

Use OpenAI's structured output (JSON mode / function-calling schema) so the response is guaranteed parseable. Conceptually, the prompt instructs the model to:

- Treat the list of GitHub events (repo, type, title, timestamp, URL) as ground truth — never invent commits, PRs, or work that isn't in the data.
- Group related events into human-readable accomplishments (e.g., 4 commits across one PR → one "Completed JWT refresh token handling" bullet, not 4 separate bullets).
- Distinguish "completed" (merged PRs, closed issues) from "in progress" (open PRs, recent commits with no merge yet).
- Write the `summary` field as 2-3 natural sentences in the tone set by `reportTemplate` (`professional` = formal business tone; `short` = 1-2 sentences total, terse; `detailed` = more granular, includes file/repo names).
- Leave `blockers` empty/null if nothing in the data suggests a blocker — never invent a blocker.
- Write `tomorrowPlan` only as a reasonable inference from open/in-progress items (e.g., "Continue work on the notification service"), clearly framed as a suggestion the user should edit, not a fact.
- Respect `reportLanguage` (english/hindi/gujarati) for all generated text fields.

Output schema (validate with Zod on the backend):
```ts
{
  summary: string;
  completedItems: string[];
  inProgressItems: string[];
  blockers: string | null;
  tomorrowPlan: string;
}
```

### 6.5 Notifications & Reminders

Phase 1 minimum:
- In-app notification (unread flag on `Report`, shown as a toast on next page load + a badge in the nav) when a report finishes generating.
- **Stretch goal within Phase 1** (build if time permits, not blocking for "done"): an email reminder at `reportTime` saying "Your EOD report is ready, review and send" with a direct link to the report — this requires Resend/SMTP to already be wired for the send-report feature (6.6) anyway, so it's a small addition once that exists.

Explicitly not Phase 1: Slack/Teams notifications, push notifications, SMS.

### 6.6 Dashboard, Timeline, Report Review, Send

**Dashboard page** (`/`):
- Greeting with user's name.
- Today's stats computed from `ActivityEvent`: count of commits, PRs opened, PRs merged, total events — computed live from the DB, not cached/fake.
- "Today's AI Summary" — pulls `completedItems` from today's `Report` if one exists, otherwise shows "Report not generated yet."
- Buttons: "View Timeline", "Generate Report" (calls 6.3 manual trigger), "Approve & Send" (only enabled if today's report exists and `status = draft`).

**Timeline page** (`/timeline`):
- Chronological list of `ActivityEvent` rows for the selected date (date picker, defaults to today), each showing type icon, title, repo, timestamp, and a link to GitHub.
- This is a direct, honest view of the raw data — useful for the user to verify the AI report against reality.

**Report page** (`/reports/:date`):
- Shows the generated report in an editable form: `summary` (textarea), `completedItems`/`inProgressItems` (editable list — add/remove/edit lines), `blockers` (textarea), `tomorrowPlan` (textarea).
- Buttons: "Regenerate" (6.3), "Save Draft" (`PATCH /api/reports/:id` — persists manual edits, status stays `draft`), "Approve & Send."
- **Approve & Send** (`POST /api/reports/:id/send`):
  - Requires `UserSettings.managerEmail` to be set — if not, block with a clear message pointing to Settings.
  - Renders the report fields into a clean HTML email template (plain, professional — no heavy branding).
  - Sends via Resend/SMTP to `managerEmail`, cc `ccEmails` if set.
  - On success: `status = "sent"`, `sentAt = now()`, `sentTo = managerEmail`.
  - On failure: `status = "failed"`, `errorMessage` set, user sees the error and can retry — never silently fail.
  - **No auto-send path exists in Phase 1.** Every send is a deliberate user click. `UserSettings` has no "autoSend" field in Phase 1 — do not build the toggle even disabled, since the original idea's auto-send mode is explicitly deferred per product decision, not just hidden.

**Settings page** (`/settings`):
- Work start/end time, timezone, report time, auto-generate toggle, manager email, CC, template choice, language choice. Maps 1:1 to `UserSettings`. `PATCH /api/settings`.

### 6.7 Required API Surface (summary)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | create account |
| POST | `/api/auth/login` | login |
| POST | `/api/auth/refresh` | rotate access token |
| POST | `/api/auth/logout` | clear refresh cookie |
| GET | `/api/integrations/github/connect` | start OAuth |
| GET | `/api/integrations/github/callback` | OAuth callback |
| DELETE | `/api/integrations/github` | disconnect |
| GET | `/api/activity?date=YYYY-MM-DD` | timeline data |
| GET | `/api/dashboard/today` | today's stats + report summary |
| POST | `/api/reports/generate` | manual trigger |
| GET | `/api/reports/:date` | fetch report by date |
| PATCH | `/api/reports/:id` | manual edit/save draft |
| POST | `/api/reports/:id/regenerate` | re-run AI generation |
| POST | `/api/reports/:id/send` | approve & send email |
| GET | `/api/settings` | fetch settings |
| PATCH | `/api/settings` | update settings |

---

## 7. Non-Functional Requirements

### 7.1 Reliability of scheduling (this is the part the original idea got vague on — be precise)

- **No `setInterval`/`node-cron` in the API process.** All scheduled/recurring work is a BullMQ repeatable job, backed by Redis, run by a dedicated worker process (`worker.ts`, started separately from `server.ts`, e.g. `node dist/worker.js` as its own process/container).
- This guarantees: jobs survive API server restarts/deploys; jobs aren't duplicated across multiple API instances; failed jobs are visible and retryable (BullMQ's built-in retry + backoff).
- Two repeatable jobs in Phase 1: `github-sync` (every 15 min, all users) and `schedule-dispatcher` (every 5 min, all users) which enqueues per-user `generate-report` jobs as needed.
- All times are stored and compared using IANA timezone names (`Asia/Kolkata`, etc.) via a library like `luxon` or `date-fns-tz` — never raw UTC offset math, which breaks across DST and is wrong for India-specific use anyway (India has no DST, but the system must be correct for any user's timezone since this is public SaaS).

### 7.2 Idempotency & duplicate prevention

- `ActivityEvent` uniqueness on `[userId, source, externalId]` prevents duplicate events from repeated GitHub syncs.
- `Report` uniqueness on `[userId, reportDate]` prevents duplicate reports for the same day — `generate-report` must upsert, not insert blindly.
- `schedule-dispatcher` must check "does a Report already exist for this user+date" before enqueuing generation, to avoid regenerating every 5-minute tick after the target time has passed.

### 7.3 Security

- GitHub access tokens are encrypted at rest using AES-256-GCM with a key from `process.env.ENCRYPTION_KEY` (never stored in the DB or code). Decrypt only in-memory when making a GitHub API call.
- JWT secrets, OpenAI key, GitHub OAuth client secret, encryption key, Resend/SMTP credentials — all via environment variables, never committed. Provide a `.env.example` with placeholder values.
- Rate-limit auth endpoints (`express-rate-limit`) to prevent brute force.
- CORS locked to the known frontend origin(s) only.
- Validate all request bodies with Zod at the API boundary.

### 7.4 Observability (minimum viable)

- Structured logging (e.g. `pino`) in both API and worker processes, including `userId` and `jobId` context on every log line related to background jobs — without this, debugging "why didn't user X get a report" in a multi-tenant system is nearly impossible.
- BullMQ Board or a simple `/api/admin/queues` debug endpoint (auth-gated, even if just a hardcoded check against your own user id for Phase 1) to inspect job status during development.

---

## 8. Local Development Setup

Deliverable: a `docker-compose.yml` that brings up Postgres + Redis, plus clear `.env.example` and README instructions for running API, worker, and frontend as three separate `npm run dev` processes.

```yaml
# docker-compose.yml (infra only — app processes run via npm, not in Docker, for fast iteration)
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: autoeod
      POSTGRES_PASSWORD: autoeod
      POSTGRES_DB: autoeod
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7
    ports: ["6379:6379"]

volumes:
  pgdata:
```

Required `.env` variables (document all of these in `.env.example`):
```
DATABASE_URL=
REDIS_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
ENCRYPTION_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=
OPENAI_API_KEY=
RESEND_API_KEY=
FRONTEND_URL=
```

---

## 9. Build Order (do not parallelize — each step depends on the last working correctly)

1. **Repo scaffold**: monorepo with `apps/api`, `apps/worker`, `apps/web`, shared `packages/db` (Prisma schema + client). Get Postgres + Redis running via Docker Compose.
2. **Auth**: signup/login/refresh, JWT middleware. Test with curl/Postman before touching frontend.
3. **GitHub OAuth connect/callback**, token encryption, store `GithubIntegration`. Verify by manually checking the encrypted token round-trips correctly.
4. **`github-sync` worker job**: fetch real events for your own connected GitHub account, confirm `ActivityEvent` rows populate correctly with no duplicates on repeated runs.
5. **Frontend shell**: routing, auth pages, protected routes, shadcn setup, layout (sidebar/nav per original design — Dashboard, Timeline, Integrations, Settings).
6. **Integrations page** wired to real connect/disconnect; Timeline page wired to real `ActivityEvent` data.
7. **Report generation pipeline**: prompt + Zod schema + OpenAI call, manual "Generate Report" button working end-to-end against your own real GitHub data.
8. **`schedule-dispatcher` job**: confirm it correctly fires at the configured time in the configured timezone without duplicating.
9. **Report review/edit page**, Save Draft, Regenerate.
10. **Email sending**: Resend integration, Approve & Send working with a real email landing in a real inbox.
11. **Settings page** fully wired.
12. **Multi-user verification**: create a second test account, connect a different GitHub account, confirm zero data leakage between the two users across every feature above.
13. Only after all 12 steps work with real data end-to-end: Phase 1 is complete.

---

## 10. Future Phases (reference only — do not build yet)

Listed so design decisions in Phase 1 don't accidentally block these later:

- **Phase 2 integrations**: Jira, Slack, Microsoft Teams, Google Calendar, VS Code extension, ChatGPT/Claude conversation logs (with explicit per-platform user consent flows — this is sensitive data).
- **Phase 3**: Team/manager dashboards, org-level accounts, weekly/monthly/sprint summary rollups, analytics charts (productivity trends, focus hours).
- **Phase 4**: Auto-send mode (no human approval) — if ever built, must ship with a prominent, separately-confirmed opt-in, a visible "last N auto-sent reports" audit log, and an easy one-click revert to Approve & Send, given the real risk of an AI-authored report reaching a manager unreviewed and being wrong.
- **Phase 5**: Burnout detection, AI Work Memory Engine (semantic cross-source synthesis as described in the original concept), browser/terminal activity tracking.

---

## 11. Open Decisions to Confirm Before/During Build

- Exact GitHub API endpoint strategy for event fetching (events API vs. Search API vs. GraphQL) — confirm against current GitHub API docs at build time rather than assuming from training knowledge, since rate limits and event completeness details matter here and may have changed.
- Confirm current recommended OpenAI model name and structured-output method (JSON mode vs. function calling vs. newer structured-output feature) at build time.
- Whether `name` is collected at signup or deferred — minor, pick one and move on.