# PRD 3 — Universal Browser Activity Capture ("Activity Radar")
**Companion document to: AutoEOD-Master-PRD.md, PRD-01-GitHub-Integration.md, PRD-02-ChatGPT-Extension-Integration.md**

Version: 1.0
Owner: Karan
Status: Build-ready
Scope: This PRD covers a **universal, site-agnostic browser activity capture system** — the extension's scope expands from "ChatGPT only" to "every site the user visits during work hours," logged into one master activity table, fully user-controlled (select/deselect, pause, exclude), feeding into the same `ActivityEvent` pipeline already established in the Master PRD.

This document **supersedes the narrow scope of PRD-02** for the extension's architecture — the ChatGPT-specific adapter described in PRD-02 becomes one of several "enhancement adapters" layered on top of this universal base, not a separate system. Read Section 1 before building anything; it sets the non-negotiable trust requirements this entire feature depends on.

---

## 1. The Trust Model — Non-Negotiable, Read First

### 1.1 What this feature actually is, stated plainly

A browser extension that logs every URL the user visits, every tab they switch to, and how long they spend there, during a configured time window, is a **comprehensive activity-monitoring tool**. The fact that it's built for the user's own benefit (auto-generating their EOD report) doesn't change what the underlying capability is. If this data were ever visible to a manager or employer in raw form, it would function exactly like surveillance software — because at the data-capture level, it is one.

This PRD proceeds anyway, because the actual product decision is **who controls the data and what happens to it after capture** — not whether capture happens. Three properties make the difference between "a tool that helps me" and "a tool that could be used against me," and all three are mandatory, not configurable-off:

1. **Local-first, user-account-scoped storage.** Raw activity logs belong to the individual `User` row (Master PRD tenancy model) and are never aggregated into any team/manager/org view in this phase — there is no team dashboard in this product at all (Master PRD Section 10 confirms this is Phase 3+, not built). Nothing in this PRD changes that. If a "manager view" of raw activity logs is ever requested in the future, that is a fundamentally different product decision requiring fresh consent design — flag it explicitly if it comes up, do not silently extend this system to support it.
2. **The user curates before anything leaves their control.** The master activity table (Section 5) is selectable/deselectable by the user, and **only selected rows are ever used as input to report generation.** Nothing is auto-included in an EOD report just because it was captured.
3. **Visible, unmissable, always-on recording state — and instant control.** Section 6.4 (status indicator) and Section 7 (pause/exclude controls) are mandatory UI, not optional. A user must always be able to tell, at a glance, "is this thing recording right now," and must be able to stop it in one click, for one site, one tab, or entirely.

### 1.2 What this PRD explicitly refuses to build, even if asked later

- No "stealth mode" / hidden operation. The toolbar icon and status indicator (Section 6.4) cannot be disabled by a setting.
- No remote/admin control of another user's extension (no "manager pushes a config to employee's browser").
- No upload of raw captured data anywhere except the user's own AutoEOD account, under their own auth.
- No capture of content inside password fields, payment forms, or other sites flagged sensitive by the browser's own autofill/sensitive-field heuristics — Section 4.3 specifies exclusions.

This section is the foundation the rest of the PRD is built on. If a future request conflicts with it, that conflict should be raised explicitly, not quietly resolved in the direction of more capture.

---

## 2. Goal Restated

Capture a complete, chronological log of browser activity during the user's configured work hours — every site, every tab, with timestamps and as much per-site context as can be gathered without a custom adapter — and present it as one master, filterable, editable table. The user (or, eventually, the AI summarization step) decides what's actually relevant to their EOD report from this raw material. Specific high-value AI tools (ChatGPT — already built in PRD-02, plus Claude.ai and Gemini, generically captured per Section 3) are not given deeper custom adapters in this phase — generic capture applies uniformly to all sites, including AI chat tools, by explicit decision (confirmed in scoping).

**Definition of done for this PRD:**
- The extension captures activity on **any** site visited during the configured work window — not a fixed allowlist — with title, URL, domain, time-in-tab, and timestamp, at minimum.
- All captured rows land in one master table, queryable/filterable by date, domain, and time range.
- The user can select/deselect individual rows or bulk-select by domain, and only selected rows are eligible for inclusion in report generation.
- The user can pause capture instantly (global pause), exclude specific domains permanently (e.g., banking sites, personal email), and see a persistent, accurate "recording" indicator whenever capture is active.
- This replaces and absorbs PRD-02's ChatGPT-specific capture into the universal system — i.e., after this PRD is built, PRD-02's standalone content script becomes one adapter registered into this system, not a separate extension.

---

## 3. Capture Depth Model — Three Tiers

This is the central architectural decision of this PRD. Per scoping: per-site capture depth is **user-configurable in settings**, with a sensible default, and no new deep custom adapters are built beyond what already exists (ChatGPT from PRD-02).

| Tier | What it captures | Applies to | Cost/fragility |
|---|---|---|---|
| **Tier 0 — Presence** (always on, cannot be disabled per-site below this floor while capture is active for that domain) | `url`, `domain`, `pageTitle`, `tabOpenedAt`, `tabClosedAt` (or last-seen if still open), computed `durationSeconds` | Every site, no exceptions | Near-zero — uses only `chrome.tabs` / `chrome.webNavigation` events, no DOM access needed |
| **Tier 1 — Page Snapshot** (opt-in, default OFF, configurable per-domain or globally) | Everything in Tier 0, plus a single text snapshot of the page's visible content at the time of capture (e.g., `document.body.innerText`, truncated to ~2000 chars), taken once per tab-visit, not continuously | Any site the user opts in for | Low-medium — generic DOM read, no site-specific selectors, but content quality varies wildly by site (a YouTube page's innerText is mostly UI chrome, not useful; a Notion doc's innerText is genuinely useful) — set expectations accordingly in UI copy, don't oversell this tier's usefulness uniformly across all sites |
| **Tier 2 — Enhanced Adapter** (opt-in, only exists for sites with a purpose-built adapter) | Site-specific structured data — currently **only ChatGPT** (per PRD-02, conversation titles + optional message excerpts). Claude.ai and Gemini are explicitly **not** given Tier 2 adapters in this phase (per scoping decision) — they get Tier 0/1 like every other site. | ChatGPT only, for now | High — per-site DOM selectors, ongoing maintenance burden as already documented in PRD-02 Section 5.2. This is exactly why it's not extended to every AI tool casually — each one repeats that cost. |

**Default configuration:** Tier 0 on for all sites during work hours (this is "the radar"), Tier 1 off globally (user opts in per-domain via Settings, Section 7.2), Tier 2 only active for ChatGPT if the user previously set it up per PRD-02.

This tiering is what makes "capture everything" actually buildable: Tier 0 has no per-site code at all, so "everything" is true on day one, while richer capture is bounded to where the user explicitly wants it and where engineering effort can sustainably go (Tier 2).

---

## 4. What Gets Captured, Precisely

### 4.1 Tier 0 fields (every site, every tab visit)

```ts
{
  domain: string;          // e.g. "stitch.withgoogle.com"
  url: string;              // full URL, see 4.3 for query-string scrubbing
  pageTitle: string;        // document.title at time of capture
  tabOpenedAt: string;      // ISO timestamp, when this tab/URL became active
  tabClosedAt: string | null; // ISO timestamp when tab was closed or navigated away; null if still open
  durationSeconds: number;  // computed: time the tab was the *active, focused* tab, not just open in background
  windowFocused: boolean;   // whether the browser window itself had OS focus during this period (see 4.2)
}
```

### 4.2 Active-time accuracy — the part that's easy to get wrong

"Time spent on a site" is meaningless if it counts background tabs sitting open all day. Required logic:

- Track time only while: (a) the tab is the **active tab** in its window (`chrome.tabs.onActivated`), AND (b) the browser **window has OS-level focus** (`chrome.windows.onFocusChanged` — catches the case where the user alt-tabs to Slack/a native app while the browser tab stays "active" in Chrome's eyes but the user isn't actually looking at it).
- Pause the running timer for the current tab whenever either condition becomes false; resume when both are true again.
- This means a tab left open in the background all day correctly shows near-zero `durationSeconds`, while a tab actually being read/used accumulates real time — this distinction is the difference between a useful activity log and noise.

### 4.3 Required exclusions (cannot be disabled — safety floor)

- **Never capture on browser-internal pages** (`chrome://*`, `edge://*`, extension pages themselves).
- **Never capture query strings or URL fragments that commonly carry secrets/tokens** — strip anything matching common auth-token patterns (`?token=`, `?access_token=`, `#access_token=`, etc.) before storing the URL; store the path only in ambiguous cases where you can't confirm a param is safe. Err toward over-stripping rather than under-stripping.
- **Never run Tier 1 (page snapshot) on pages where the browser's own autofill heuristics detect a password or payment field present on the page** — a simple `document.querySelector('input[type="password"], input[autocomplete*="cc-"]')` check before snapshotting is sufficient; if found, skip snapshot for that page entirely (Tier 0 presence logging still applies — knowing "user was on their bank's site for 4 minutes at 2pm" is fine and expected; capturing the page's text content is not).
- **Respect a permanent domain exclusion list** (Section 7.2) — domains on this list get **zero** capture, not even Tier 0. This is the user's explicit "never log this" list (personal banking, personal email, healthcare portals, etc.), separate from the work-hours time window.

### 4.4 What is explicitly NOT captured, ever, in this phase

- Keystrokes outside of the page-snapshot mechanism (no keylogging).
- Screenshots/screen recording.
- Clipboard contents.
- Audio/microphone/camera access.
- Anything on incognito/private browsing windows (extension should declare `"incognito": "not_allowed"` in the manifest, or explicitly check `chrome.tabs` for incognito state and skip — confirm exact manifest mechanism against current Chrome extension docs at build time).

---

## 5. Data Model

```prisma
// Replaces the narrow PRD-02 "ChatGPT only" framing — this is now the
// general-purpose raw capture table. ActivityEvent (Master PRD) remains
// the *curated* table that feeds report generation; this new model is
// the *raw* firehose that the user selects from to populate ActivityEvent.

model BrowserActivityLog {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  domain          String
  url             String   @db.Text
  pageTitle       String
  tabOpenedAt     DateTime
  tabClosedAt     DateTime?
  durationSeconds Int      @default(0)

  captureTier     Int      // 0, 1, or 2 — see Section 3
  snapshotText    String?  @db.Text   // populated only if captureTier >= 1
  adapterPayload  Json?                // populated only if captureTier = 2 (e.g. ChatGPT structured data)

  selected        Boolean  @default(false)  // user's curation flag — see Section 6.2
  promotedToEventId String? @unique          // set once this row has been turned into an ActivityEvent

  createdAt       DateTime @default(now())

  @@index([userId, tabOpenedAt])
  @@index([userId, domain])
}

model UserExtensionSettings {
  id                  String   @id @default(cuid())
  userId              String   @unique
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  globalPaused        Boolean  @default(false)
  tier1GlobalDefault  Boolean  @default(false)     // if true, Tier 1 snapshot applies everywhere by default
  tier1DomainAllowlist Json    @default("[]")        // string[] of domains with Tier 1 on, when global default is off
  excludedDomains     Json    @default("[]")        // string[] of domains with zero capture, ever

  updatedAt           DateTime @updatedAt
}
```

**Why this is a separate table from `ActivityEvent`, not a reuse of it:** `ActivityEvent` (Master PRD) was designed as a curated, source-attributed record feeding directly into report generation, with a clean `[userId, source, externalId]` uniqueness constraint suited to discrete events (one commit, one PR). Raw browser activity is high-volume, often noisy (dozens of brief tab visits per hour), and needs a separate user-curation step before it's report-worthy. Keeping them separate means the report-generation pipeline (Master PRD Section 6.3) doesn't need to change its input assumptions at all — it still just reads `ActivityEvent` rows. The bridge between the two is the explicit "promote selected rows" action (Section 6.3).

---

## 6. The Master Activity Table — Core UI Deliverable

This is the centerpiece UI surface this PRD asks for: "one table with timestamp, URL, activity performed, where user can select and deselect and do anything they want."

### 6.1 Table view (`/activity-log` page, new)

Columns: checkbox (select), time range (`tabOpenedAt`–`tabClosedAt` or "ongoing"), domain (with favicon), page title, duration, tier badge (0/1/2, with tier 2 shown as a distinct colored badge e.g. "Enhanced: ChatGPT"), action (expand row to see `snapshotText`/`adapterPayload` if present).

- Default sort: most recent first.
- Filters: date range picker, domain search/multi-select, tier filter, "show only selected" toggle.
- Bulk actions: "Select all visible," "Deselect all," "Select all from domain X," "Exclude this domain going forward" (writes to `UserExtensionSettings.excludedDomains` directly from the table row's context menu — fast path from "I see noise from this domain" to "stop logging it").
- This table is built with shadcn's `Table` + `Checkbox` + `DataTable`-pattern (TanStack Table, which pairs with the already-chosen TanStack Query) — do not hand-roll pagination/sorting, TanStack Table handles this and is already in the stack's spirit (Master PRD already uses TanStack Query).

### 6.2 Selection model

- `selected: Boolean` on `BrowserActivityLog` is the persistent curation flag — toggling a checkbox in the table immediately `PATCH`es that row's `selected` state, no separate "save" step.
- Selection has no automatic expiry or AI override — if the user selects a row, it stays selected until they change it or it gets promoted (6.3).

### 6.3 Promotion: turning selected raw logs into `ActivityEvent` rows

- New endpoint: `POST /api/activity-log/promote` — takes a list of `BrowserActivityLog` ids (or implicitly, "all selected, unpromoted, within date range X"), and for each:
  - Creates an `ActivityEvent` with `source: "browser"`, `type: "browser_activity"`, `title` = the page title (or a short AI-generated label if `snapshotText`/`adapterPayload` is rich enough to summarize — optional enhancement, not required for done), `url`, `occurredAt` = `tabOpenedAt`, `rawPayload` = the full `BrowserActivityLog` row.
  - Sets `BrowserActivityLog.promotedToEventId` to the new event's id, so it's visually marked "already included" in the table (and isn't double-promoted).
- **This promotion step can be manual (a button: "Add selected to today's report material") or automatic** (e.g., run right before report generation, auto-promoting anything `selected = true` and not yet promoted for the current `reportDate`) — recommend automatic-on-report-generation as the default UX, since requiring a separate manual promotion click before every report adds friction without much benefit, but expose it as a manual action too for users who want to curate ahead of time.

### 6.4 Status indicator (mandatory, per Section 1.3)

- Extension toolbar icon always shows one of three states: **recording** (green dot, animated subtle pulse), **paused** (grey, user-initiated), **outside work hours** (grey, automatic — see Section 8). This is not a setting that can be turned off.
- A persistent small badge/banner in the main AutoEOD web app (visible on every page while logged in, e.g., in the top nav) mirrors this same state, so the user has the signal even when not looking at the extension popup directly: "Activity capture: Recording" / "Paused" / "Outside work hours."

---

## 7. User Controls (Section 1's commitments, made concrete)

### 7.1 Global pause
- One click, from either the extension popup or the web app's status banner (6.4), sets `UserExtensionSettings.globalPaused = true`. While paused, **zero** capture happens at any tier, on any site, regardless of work-hours schedule. Un-pause is equally one click.

### 7.2 Domain exclusion list
- Settings page section: a simple add/remove list of domains (`UserExtensionSettings.excludedDomains`). Once added, a domain gets zero Tier 0/1/2 capture, full stop, checked first in the content-script/background-worker logic before any other capture decision is made.
- Fast-path addition directly from the activity table (6.1's "Exclude this domain going forward" row action).

### 7.3 Per-domain Tier 1 control
- Settings page: toggle for `tier1GlobalDefault` (snapshot everywhere) vs. an explicit allowlist of domains where Tier 1 is on, if global default is off. Recommend defaulting to allowlist mode with an empty list (i.e., Tier 1 off everywhere until the user explicitly turns it on per-domain) — this matches the "don't over-collect by default" posture from Section 1.

### 7.4 Deleting captured data
- A "Delete activity log" action in Settings, scoped by date range (e.g., "delete all browser activity logs older than 30 days," or "delete all logs for [specific date]"). Hard delete, not soft — once deleted, it's gone, including from any `ActivityEvent` rows that were promoted from it (those `ActivityEvent` rows themselves are NOT auto-deleted, since they may already be part of a sent report and deleting sent-report material retroactively would be its own integrity problem — only the raw `BrowserActivityLog` source rows are deleted; document this distinction clearly in the Settings UI copy so it's not surprising).

---

## 8. Work-Hours Scheduling — Reusing Existing Infrastructure

This does not need new scheduling infrastructure. The extension already needs to know the user's `workStartTime`/`workEndTime`/`timezone` (Master PRD `UserSettings`, already used for report scheduling).

- On extension startup and on a periodic alarm (`chrome.alarms`, every 5 minutes), the background service worker checks current local time against the cached `workStartTime`/`workEndTime`/`timezone` (fetched from `GET /api/settings` and cached locally, refreshed periodically — not fetched on every single tab change, which would be wasteful).
- Outside work hours: capture is automatically off (distinct status state from "paused" — Section 6.4 — since this is scheduled, not user-initiated, and the user should be able to tell the difference: "it's currently 9pm so of course it's not recording" vs. "I manually paused it for a meeting").
- The user can manually override and capture outside work hours if they want (toggle in popup: "Capture now anyway, even though it's outside work hours") — this is a deliberate exception action, logged distinctly so it's clear in the data later that this was an explicit override, not a scheduling bug.

---

## 9. Architecture Diagram (extends PRD-02's diagram)

```
┌────────────────────────────────────────────┐
│  User's Browser                              │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐│
│  │ Any Tab A   │ │ Any Tab B   │ │ ChatGPT  ││
│  │ (Tier 0/1)  │ │ (Tier 0/1)  │ │ (Tier 2) ││
│  └─────┬──────┘ └─────┬──────┘ └────┬─────┘│
│        │  chrome.tabs /              │       │
│        │  webNavigation events       │       │
│        ▼                              ▼       │
│  ┌──────────────────────────────────────────┐│
│  │  Background Service Worker                ││
│  │  - tab/window focus tracking (4.2)         ││
│  │  - tier decision logic (3, 4.3 exclusions) ││
│  │  - buffering + debounced send              ││
│  │  - work-hours schedule check (8)            ││
│  └──────────────────┬───────────────────────┘│
└──────────────────────┼────────────────────────┘
                        │ HTTPS, extension API token (PRD-02 §6.1 pattern)
                        ▼
              POST /api/extension/browser-activity
                        │
                        ▼
              BrowserActivityLog (raw, per-user)
                        │
              user curates via /activity-log table (§6)
                        │
              POST /api/activity-log/promote
                        │
                        ▼
              ActivityEvent (source="browser")
                        │
              [existing Master PRD report pipeline]
```

---

## 10. Backend Additions Summary

| Endpoint | Purpose |
|---|---|
| `POST /api/extension/browser-activity` | Ingest raw Tier 0/1/2 activity from the extension (same auth pattern as PRD-02 §6.2 — extension token, not JWT) |
| `GET /api/activity-log` | Paginated, filterable (date range, domain, tier, selected-only) fetch for the master table (§6.1) |
| `PATCH /api/activity-log/:id` | Toggle `selected` |
| `POST /api/activity-log/bulk-select` | Bulk select/deselect by filter (e.g., all rows from a domain in a date range) |
| `POST /api/activity-log/promote` | Turn selected rows into `ActivityEvent` rows (§6.3) |
| `DELETE /api/activity-log` | Bulk delete by date range (§7.4) |
| `GET /api/extension-settings` / `PATCH /api/extension-settings` | Read/update `UserExtensionSettings` (pause, exclusions, tier defaults) |

---

## 11. Report Generation Prompt Update (extends Master PRD §6.4, PRD-02 §8)

Add to the prompt's event-handling instructions:

- "Some activity entries are from general browser activity (`source: 'browser'`), representing pages visited during work hours that the user has manually selected as relevant. Treat the page title and domain as a weak signal of topic/context — e.g., time spent on documentation sites or internal tools suggests research or configuration work. Do not treat browser activity alone as evidence of a completed deliverable; corroborate with GitHub activity (source: 'github') where possible, same caution as already applied to ChatGPT activity. If a browser activity entry's title or content is ambiguous or uninformative (e.g., a generic homepage title), it is acceptable to omit it from the summary rather than force an interpretation."

---

## 12. Privacy & Settings UI Copy Requirements

Given Section 1's weight, the Settings page for this feature must include, verbatim in spirit (exact wording can be refined, but the substance is required):

- A short explainer at the top of the Activity Capture settings section: "This captures websites you visit during your work hours so you can pick what's relevant for your daily report. Nothing is shared with anyone else automatically — you choose what gets included, and you can pause or exclude any site at any time."
- The domain exclusion list and global pause control must be the *first* two controls visible on this settings page, above tier configuration — the controls that reduce capture should be more prominent than the controls that increase it.

---

## 13. Relationship to PRD-02 — Migration Note

Once this PRD is built:
- PRD-02's standalone content script (ChatGPT-only) is refactored to register as the Tier 2 adapter within this universal extension's adapter system, rather than existing as a separate extension/codebase.
- PRD-02's `ExtensionToken` model and `POST /api/extension/activity` endpoint are superseded by this PRD's `POST /api/extension/browser-activity` (which should accept an optional `adapterPayload` per entry to carry ChatGPT-specific structured data — i.e., merge the two ingestion paths into one, don't run two separate extension-auth systems side by side).
- Do this migration explicitly and deliberately as its own build step — don't let it happen as an ad hoc side effect of building this PRD's features.

---

## 14. Testing Checklist Specific to This PRD

1. Visit 5 different unrelated domains during a simulated work-hours window (YouTube, an internal/test site, a docs site, Gemini, Claude.ai). Confirm all 5 appear as Tier 0 rows in the activity table with reasonably accurate `durationSeconds`.
2. Open a tab, switch away to another application (not another browser tab — an entirely different app) for 5 minutes, switch back. Confirm that tab's `durationSeconds` does not include the 5 minutes away (tests §4.2's window-focus logic specifically, not just tab-active logic).
3. Add a domain to the exclusion list mid-session while a tab on that domain is already open. Confirm capture stops for it going forward (existing rows for it before exclusion are not retroactively deleted unless the user separately runs a delete action).
4. Turn on Tier 1 for one specific domain only. Confirm `snapshotText` is populated for that domain and remains null for all others.
5. Visit a page with a password field present (e.g., a login page). With Tier 1 globally on, confirm snapshot capture is skipped for that specific page (§4.3) while Tier 0 presence logging still occurs.
6. Hit global pause. Confirm zero new rows of any tier are created across multiple different domains until un-paused.
7. Select a handful of rows in the activity table, trigger promotion, confirm corresponding `ActivityEvent` rows appear correctly attributed and that re-running promotion doesn't duplicate already-promoted rows.
8. Confirm the work-hours auto-off behavior: set a narrow work window, verify capture state flips to "outside work hours" precisely at the boundary, in the user's configured timezone (reuse Master PRD §7.1's timezone-correctness discipline — test with a non-default timezone).
9. Confirm incognito windows produce zero captured rows under any settings configuration.
10. Delete activity logs for a specific past date range; confirm only `BrowserActivityLog` rows are removed and any already-promoted `ActivityEvent`/`Report` data from that period remains intact (§7.4).