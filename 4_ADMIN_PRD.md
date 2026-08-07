# Phase 4: Admin Dashboard & Centralized Configuration PRD

## 1. Overview and Problem Statement
Currently, the AutoEOD system (API, Web, Worker, Desktop, Extension) requires manual updates to hardcoded URLs whenever environments or hosting platforms change. While backend services (API, Worker, Web) can easily read Environment Variables at runtime, client applications (Desktop, Chrome Extension) compile these URLs during the build process. If the API URL changes, the client apps break unless a new version is built and distributed to users.

**The Solution:**
1. **For Backend Services (API, Worker, Web):** Rely strictly on runtime Environment Variables managed through the deployment platform (e.g., Coolify).
2. **For Client Apps (Desktop, Extension):** Implement a **Remote Configuration System**. Clients will have one fallback/bootstrap URL. On startup, they fetch their active configuration (like API endpoints, feature flags) from the server.
3. **Admin Dashboard:** A centralized React web application to manage these configurations, oversee users, and monitor system health.

## 2. Core Objectives
- **Zero-Downtime Client Updates:** Change API endpoints for the Desktop app and Chrome Extension instantly without requiring users to download updates.
- **Centralized Environment Management:** Manage database URLs, internal service URLs, and secrets for the backend via the deployment platform (Coolify), while managing client-facing URLs via the Admin Dashboard.
- **System Monitoring:** Provide admins with a high-level view of system health, active users, and worker queues.

## 3. Architecture & Remote Config Flow
To solve the "hardcoded URL" problem in extensions and desktop apps:

1. **The Bootstrap URL:** The Extension and Desktop app will hardcode exactly *one* highly-available URL (e.g., a static JSON file on AWS S3/Cloudflare, or a dedicated lightweight endpoint).
2. **Fetching Config:** On launch, the client fetches the JSON from the Bootstrap URL.
   ```json
   {
     "api_base_url": "https://api.autoeod.com",
     "web_base_url": "https://app.autoeod.com",
     "force_update": false
   }
   ```
3. **Dynamic Routing:** The client uses `api_base_url` for all subsequent requests. If you ever move your API to a new platform, you simply update the config via the Admin Dashboard, and all clients instantly route to the new server.

## 4. Admin Dashboard Features

### 4.1. Remote Configuration Manager
- UI to update the global `api_base_url`, `web_base_url`, and other client-facing variables.
- Ability to toggle "Maintenance Mode" (tells clients to show a maintenance screen).
- Ability to trigger "Force Update" (prompts Desktop/Extension users to download a mandatory new version).

### 4.2. User Management
- View all registered users.
- See active session statuses (who is currently tracking time).
- Suspend or ban malicious accounts.

### 4.3. System Health & Infrastructure
- **Worker Status:** View Redis queue length (how many background jobs are pending).
- **Database Status:** Simple ping check to PostgreSQL.
- **Error Logs:** View recent critical errors caught by the API.

## 5. Technical Stack
- **Framework:** React (Next.js or Vite, potentially extending the existing `apps/web` or creating a new `apps/admin`).
- **Styling:** TailwindCSS + Shadcn/Zion UI components (consistent with current design).
- **State Management:** React Query for fetching admin data.
- **Authentication:** Strict Role-Based Access Control (RBAC). Only users with `role === 'ADMIN'` can access these routes.

## 6. Implementation Plan (Phases)

**Step 1: Database Updates**
- Add a `SystemConfig` table to Postgres to store the dynamic URLs and feature flags.
- Update the `User` table to support an `ADMIN` role.

**Step 2: API Endpoints**
- Create a public `/api/config` endpoint that clients fetch on startup.
- Create protected `/api/admin/*` endpoints for updating the config, fetching users, etc.

**Step 3: Client Updates (Extension & Desktop)**
- Refactor `apps/extension/src/lib/api.ts` and Desktop's `index.js` to fetch the remote config on startup before making any other API calls.
- Implement a fallback mechanism.

**Step 4: Build the Admin Dashboard**
- Scaffold the UI in React.
- Connect forms to the new `/api/admin/config` endpoints.
- Add user monitoring tables.

## 7. Open Questions for Founder
1. Should this Admin Dashboard be integrated into the existing `apps/web` dashboard (hidden behind an `/admin` route for admin users), or should it be a completely separate app (e.g., `apps/admin`)?
2. Do you have a permanent domain name you plan to use? (Having a permanent domain name and just updating DNS records is actually the standard way to solve URL changes, rather than building a remote config system).
