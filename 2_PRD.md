# PRD 2 of 2 — ChatGPT Activity Capture via Browser Extension (Deep Spec)
**Companion document to: AutoEOD-Master-PRD.md**
**Companion document: PRD-01-GitHub-Integration.md**

Version: 1.0
Owner: Karan
Status: Build-ready
Scope: This PRD covers **only** ChatGPT activity capture, via a browser extension, expanded to full implementation depth. It assumes the base architecture, data model, auth, and report-generation pipeline from the Master PRD already exist.

---

## 0. Why this integration is fundamentally different from GitHub — read this before building anything

This is the most important section in this document. If this is skipped, the build will start from a wrong assumption.

**There is no API for reading a user's ChatGPT.com conversation history.** OpenAI's platform API (api.openai.com, the one you use for the report-generation AI calls in the Master PRD) is a completely separate product from chat.gpt.com, the consumer chat product. There is no OAuth scope, no endpoint, no official integration path that lets a third-party app say "show me this user's ChatGPT conversations." This is by design, not a gap — it's the same reason there's no public API to read someone's private Gmail inbox without their own explicit, scoped consent flow, except OpenAI hasn't even built the consent flow for this use case.

**Given that constraint, the only technically real options are:**
1. A **browser extension** running in the user's own browser, with the user's own explicit permission, reading the DOM/local state of chat.gpt.com while they're using it, and forwarding structured data to your backend. This is what this PRD builds.
2. Manual data export (user downloads their ChatGPT data export, uploads the file) — batch, not live, explicitly deferred (noted in Section 9).
3. Tracking *API* usage instead of chat.gpt.com usage, if the user happens to use the OpenAI API directly with their own key — not the same as "ChatGPT chats," explicitly out of scope here.

**This means the deliverable for this PRD is two separate codebases:**
- A browser extension (Chrome/Edge, Manifest V3) — a new, standalone client app.
- Backend additions to receive, authenticate, and store data **from** that extension.

This is materially more work than the GitHub PRD, and carries real legal/ethical weight (Section 1) that GitHub's OAuth-based approach does not.

---

## 1. Legal, Ethical, and ToS Considerations — Required Reading Before Building

This section is not boilerplate. Get this wrong and the product (and Karan personally, if distributed) carries real risk.

- **OpenAI's Terms of Use** prohibit scraping or automated extraction of ChatGPT in ways that violate their terms. Reading a page's DOM via a browser extension the *user themselves* installs and runs, to capture *their own* conversation data for their own productivity purposes, is a materially different posture than a third party scraping the service — but this is genuinely a gray area, not a clearly-blessed one. **Before distributing this extension to anyone other than yourself for personal testing, review OpenAI's current Terms of Service and Usage Policies directly** (search and read them at build time — do not rely on a memorized summary, since terms change). If the determination is that this violates ToS for anything beyond strictly personal individual use, the honest path is to either keep this strictly self-hosted/personal-use only, or pivot to the manual-export approach (Section 9) for any user beyond Karan himself.
- **This extension only ever operates on data the logged-in user can already see in their own browser session.** It must never attempt to access another person's account, never run server-side scraping, and never operate without the extension being knowingly installed and enabled by the account owner.
- **Consent and transparency are mandatory, not optional polish:** the extension must show a clear, persistent indicator when it's actively capturing (Section 5.4), and the user must be able to see exactly what was captured before it's used in a report (it already can, via the Timeline page from the Master PRD/GitHub PRD pattern).
- **Content sensitivity:** ChatGPT conversations are often more sensitive than GitHub commits — they can contain personal information, draft business strategy, or anything the user typed. Storing full conversation text carries materially more privacy weight than storing a commit message. Section 4 addresses what's actually stored vs. just titles/summaries.

**Recommendation embedded in this PRD's design:** capture conversation **titles and timestamps** as the primary signal (cheap, low-sensitivity, sufficient for "what topics did I work on today"), and treat full message-content capture as an explicitly separate, opt-in setting (default OFF) — not bundled together. This is reflected in the data model (Section 4) and settings (Section 7.3).

---

## 2. Goal Restated

Capture a record of the user's ChatGPT.com activity during work hours — at minimum, which conversations were active and when, and optionally (opt-in) enough message content to let the AI report-generation step understand *what* was being worked on via ChatGPT — and feed this into the same `ActivityEvent` table the GitHub integration uses, so the report-generation pipeline can include it.

**Definition of done for this PRD:**
- A Chrome/Edge extension exists, installable via "Load unpacked" in developer mode for Phase 1 (Chrome Web Store submission is explicitly out of scope for Phase 1 — see Section 10).
- When installed and logged into the same AutoEOD account, the extension detects new/updated ChatGPT conversations while the user browses chat.gpt.com and pushes them to the backend within roughly 1-2 minutes of activity (near-real-time, not 15-minute polling — there's no polling needed since the extension observes the page directly).
- Data lands in `ActivityEvent` with `source: "chatgpt"`, correctly attributed to the right `userId`, with zero duplicates on repeated page loads/navigation.
- The user can toggle content-capture depth (titles-only vs. titles+message-text) in Settings, default titles-only.
- The user can see exactly what was captured on the Timeline page, same as GitHub events.

---

## 3. Architecture

```
┌──────────────────────────────┐
│   User's Browser              │
│  ┌─────────────────────────┐  │
│  │  chat.gpt.com tab        │  │
│  │  ┌─────────────────────┐│  │
│  │  │ Content Script       ││  │      extension's own
│  │  │ (observes DOM)       ││──┼──▶  background service
│  │  └─────────────────────┘│  │      worker (Manifest V3)
│  └─────────────────────────┘  │            │
│  ┌─────────────────────────┐  │            │ HTTPS, with extension's
│  │  Extension popup          │  │            │ stored API token
│  │  (login/status UI)        │  │            ▼
│  └─────────────────────────┘  │  ┌─────────────────────┐
└──────────────────────────────┘  │  AutoEOD Backend API   │
                                    │  POST /api/extension/  │
                                    │       activity         │
                                    └──────────┬──────────┘
                                               ▼
                                     ActivityEvent (source="chatgpt")
```

**Key design decision: the extension authenticates to your backend independently of the main web app's session**, using a long-lived **extension API token** (Section 6.1) generated from the AutoEOD web dashboard and pasted into the extension once — not shared browser cookies, which are unreliable across extension contexts and don't survive a logout on the main site cleanly. This mirrors how real tools (e.g., Toggl's browser extension, Raycast extensions) authenticate.

---

## 4. Data Model Additions (extends Master PRD schema)

```prisma
// New model — extension auth tokens, separate from the JWT used by the web app,
// because an extension token needs to be long-lived (months) and revocable
// independently of normal login sessions.
model ExtensionToken {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  tokenHash   String   @unique   // SHA-256 hash of the actual token; never store plaintext
  label       String   @default("Browser Extension")
  createdAt   DateTime @default(now())
  lastUsedAt  DateTime?
  revokedAt   DateTime?

  @@index([userId])
}

// Addition to UserSettings (Master PRD model):
model UserSettings {
  // ...existing fields from Master PRD...
  chatgptCaptureContent Boolean @default(false)  // false = titles/metadata only, true = also capture message text
}
```

### 4.1 `ActivityEvent` field mapping for ChatGPT sources

| ActivityEvent field | Titles-only mode | Content-capture mode (opt-in) |
|---|---|---|
| `source` | `"chatgpt"` | `"chatgpt"` |
| `type` | `"chatgpt_conversation"` | `"chatgpt_conversation"` |
| `externalId` | ChatGPT conversation ID (from URL path `/c/{id}`) | same |
| `repo` | `null` (field is named `repo` from the GitHub-first schema — for non-GitHub sources, this is acceptable to leave null; do not rename the column, it stays generic on purpose) | same |
| `title` | conversation title as shown in ChatGPT's sidebar | same |
| `url` | `https://chat.gpt.com/c/{id}` | same |
| `occurredAt` | timestamp of last detected activity in that conversation during this session | same |
| `rawPayload` | `{ title, messageCount, lastSeenAt }` — no message content | `{ title, messageCount, lastSeenAt, messages: [{role, excerpt}] }` — excerpt capped at ~500 chars per message, not full raw text, to bound storage and reduce sensitivity even in opt-in mode |

**Note on `messages.excerpt` capping even in opt-in mode:** full verbatim long-form capture of every message is unnecessary for the report-generation use case (which needs "what was this conversation about," not a full transcript) and increases both storage cost and privacy exposure for no real product benefit. This cap is a deliberate design choice, not a technical limitation — do not remove it without reconsidering the privacy tradeoff explicitly.

---

## 5. Browser Extension — Implementation Spec

### 5.1 Manifest (Manifest V3, Chrome/Edge)

```json
{
  "manifest_version": 3,
  "name": "AutoEOD — ChatGPT Activity Capture",
  "version": "0.1.0",
  "description": "Captures ChatGPT conversation activity for your AutoEOD daily report.",
  "permissions": ["storage", "alarms"],
  "host_permissions": ["https://chat.gpt.com/*", "https://chatgpt.com/*"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://chat.gpt.com/*", "https://chatgpt.com/*"],
      "js": ["content-script.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  }
}
```

**Note to verify at build time:** confirm the current actual domain ChatGPT serves on (`chat.gpt.com` vs `chatgpt.com` vs both, with redirects) — domain naming for OpenAI's consumer product may have changed; check by visiting the live site rather than assuming from memory, and include both in `matches`/`host_permissions` defensively as shown above.

### 5.2 Content script — what it observes and how

ChatGPT's web UI is a React SPA with no public, documented DOM contract — element structure can change without notice on OpenAI's side. Build defensively:

1. **Primary signal: the conversation sidebar list.** On `document_idle` and on a `MutationObserver` watching the sidebar container, extract conversation titles and their `/c/{id}` href links. This is the most stable, lowest-risk-of-breaking signal — it's just link text and hrefs, not deeply nested content structure.
2. **Secondary signal (only relevant in content-capture mode): the active conversation's message list.** Use a `MutationObserver` on the main chat container to detect new message nodes as they're added (covers both the user's sent messages and the assistant's streamed responses). Extract `role` (user/assistant — typically distinguishable via a stable data attribute or alternating structural pattern; inspect the live DOM at build time to find the most stable selector available, since exact class names are obfuscated/hashed and will change across ChatGPT deploys) and the text content, capped at 500 chars (Section 4.1).
3. **Debounce, don't spam.** Buffer detected changes for ~10 seconds before sending to the background script, so a burst of streaming tokens from an assistant response doesn't trigger dozens of separate sends — batch into one update per conversation per debounce window.
4. **Resilience to DOM changes:** wrap all selector logic in try/catch. If a selector finds nothing (likely because OpenAI changed their markup), log a console warning (visible to the user/developer in devtools) and degrade gracefully — **do not throw an uncaught error that breaks the rest of the extension.** Treat this as an expected, recurring maintenance burden: ChatGPT's frontend will change over time and this content script will periodically need selector updates. This is the single biggest ongoing maintenance cost of this entire integration, and should be communicated to Karan as such, not glossed over.

### 5.3 Background service worker — sending data to the backend

```
1. Receives buffered conversation data from content script via chrome.runtime
   message passing.
2. Reads the stored extension API token from chrome.storage.local
   (set via the popup, Section 5.5).
3. If no token stored: do nothing, surface "Not connected" state in popup badge.
4. POST to {backendUrl}/api/extension/activity with:
   Authorization: Bearer {token}
   Body: { conversations: [{ externalId, title, lastSeenAt, messages? }] }
5. On 401 (token revoked/invalid): clear stored token, set popup badge to
   "Reconnect needed".
6. On network failure: queue locally (chrome.storage.local, capped at e.g.
   last 50 pending updates) and retry on next successful detection cycle
   or via a chrome.alarms periodic retry every 5 minutes — this handles
   the user being temporarily offline without losing data.
```

### 5.4 Required visible consent/status indicator

- The extension's toolbar icon shows a badge (small colored dot) reflecting state: grey = not connected, green = active and connected, red = error/reconnect needed.
- The popup (Section 5.5) always shows, in plain text, whether content-capture mode is on or off, and a direct link to the AutoEOD Settings page to change it — the extension itself does not duplicate the settings toggle, it reads the setting from the backend (fetch current `UserSettings.chatgptCaptureContent` on popup open) so there's exactly one source of truth.

### 5.5 Popup UI (minimal, plain HTML/CSS — no React needed for something this small)

- If no token stored: input field to paste the extension token (generated from the AutoEOD web dashboard, Section 6.1) + "Connect" button.
- If connected: shows connected account's email (fetched once on connect, cached), current capture mode (titles-only / titles+content, read-only here, link to Settings to change), "Last activity sent: {relative time}", and a "Disconnect" button (clears the local token; does not revoke it server-side automatically — revoking is done from the web dashboard, Section 6.1, so a user who loses their browser still has a clean way to revoke).

---

## 6. Backend Additions

### 6.1 Extension token issuance (web dashboard side)

- New section on the Integrations page: "Browser Extension" card.
- "Generate Extension Token" button → `POST /api/extension-tokens` → generates a random 32-byte token, stores only its SHA-256 hash in `ExtensionToken.tokenHash`, **returns the plaintext token exactly once** in the API response (standard pattern — same as how GitHub/Stripe show API keys once). Frontend displays it in a copy-able field with a clear "copy this now, you won't see it again" warning.
- List existing tokens (label, created date, last used date) with a "Revoke" button per token → `DELETE /api/extension-tokens/:id` sets `revokedAt = now()`.

### 6.2 `POST /api/extension/activity` — the ingestion endpoint

```
1. Read Authorization: Bearer {token} header. If missing, 401.
2. Hash the provided token, look up ExtensionToken by tokenHash.
   If not found, or revokedAt is set, 401.
3. Update ExtensionToken.lastUsedAt = now().
4. Validate request body with Zod:
   { conversations: Array<{ externalId: string, title: string,
     lastSeenAt: string (ISO), messages?: Array<{role, excerpt}> }> }
5. Check UserSettings.chatgptCaptureContent for this user — if false,
   strip any `messages` field from the payload before storing
   (defense in depth: even if the extension sends content because the
   user toggled it off mid-session and the extension hasn't refreshed
   its cached setting yet, the backend is the final enforcement point
   for this privacy setting, not just the client).
6. Upsert one ActivityEvent per conversation, matching on
   [userId, source="chatgpt", externalId], updating rawPayload and
   occurredAt to the latest seen state (same upsert-in-place pattern
   as GitHub PR handling in PRD-01 Section 3.2).
7. Return 200 with a count of events processed.
```

### 6.3 Why this endpoint is intentionally separate from the GitHub sync worker pattern

GitHub data arrives via your own backend pulling from GitHub (a pull model, scheduled). ChatGPT data arrives via the extension pushing to your backend (a push model, event-driven). These are different enough that they should not share a queue/job abstraction — `POST /api/extension/activity` is a normal authenticated REST endpoint, not a BullMQ job. There's no polling needed because the extension itself is the "poller," running in the user's browser. Don't force this into the same worker-process pattern as GitHub sync; it would add complexity for no benefit.

---

## 7. Frontend (Main Web App) Changes Required

### 7.1 Integrations page — new "ChatGPT (Browser Extension)" card
- Shows connection status by checking whether any non-revoked `ExtensionToken` exists with a recent `lastUsedAt` (e.g., within the last hour while the user is actively working) — this is a proxy for "is the extension actually running," since the backend has no direct way to know if the extension is installed, only whether it's recently sent data.
- "Set Up Extension" flow: instructions + download/load-unpacked steps (Section 10) + the "Generate Token" action (6.1) inline.
- Clearly labeled "Beta" / "Manual install" given Phase 1's distribution model (Section 10).

### 7.2 Timeline page — rendering ChatGPT events
- `type: "chatgpt_conversation"` events get a distinct icon (lucide-react `MessageSquare`) and show the conversation title + link.
- If `rawPayload.messages` is present (content-capture mode was on), allow expanding the row to show the captured excerpts — this is the user's own transparency view into what was captured, directly relevant to the consent requirement in Section 1.

### 7.3 Settings page addition
- New toggle: "Capture ChatGPT message content (not just titles)" — default OFF, with inline copy explaining the tradeoff plainly: "Off: we only see conversation titles and timing. On: we also capture short excerpts of your messages, to help the AI understand what you worked on. Off is recommended unless you want more detailed reports." This is the only piece of Settings UI copy this PRD insists on the exact framing of, since it's a real consent decision, not just a feature toggle.

---

## 8. Report Generation Pipeline — Required Prompt Update

The Master PRD's report-generation prompt (Master PRD Section 6.4) currently only describes GitHub events. Extend the same prompt's event-input section to include ChatGPT events, with this added instruction:

- "Some activity entries are from ChatGPT conversations, identified by source: 'chatgpt'. Use conversation titles (and message excerpts, if present) to understand what topics or problems the user was working on — but never claim a ChatGPT conversation alone constitutes 'completed work.' Frame ChatGPT activity as research/exploration/debugging assistance, not as a deliverable in itself, unless the GitHub activity for the same time period corroborates an actual completed change."

This instruction exists because the most likely failure mode here is the AI inflating "asked ChatGPT about JWT bugs" into "completed JWT authentication," when in fact the GitHub data is the actual source of truth for completed work — ChatGPT activity is context/signal, not achievement.

---

## 9. Explicitly Deferred (do not build in this phase)

- **Manual export upload** (user downloads ChatGPT data export, uploads JSON for batch backfill) — real and useful, but a different code path (file upload + parser for OpenAI's export JSON schema) than the live extension. Build only if the extension proves insufficient or as a complementary "backfill history" feature later.
- **Firefox/Safari extension support** — Manifest V3 Chrome/Edge only for Phase 1; Firefox's extension APIs differ enough to be a real second port, not a copy-paste.
- **Chrome Web Store distribution** — Phase 1 ships as "load unpacked" developer-mode install only. Store submission requires a privacy policy, review process, and ongoing compliance with store policies that are worth doing once the product is validated, not before.
- **Claude.ai / Gemini equivalents** — same DOM-capture pattern could extend to other chat UIs later; out of scope now, and each one is its own selector-maintenance burden (Section 5.2's point about ongoing fragility applies multiplicatively per additional site supported).

---

## 10. Distribution Note for Phase 1

Given the ToS gray area (Section 1) and the lack of Chrome Web Store review, the realistic and honest Phase 1 distribution model is: **Karan installs and uses this himself, via developer-mode "load unpacked," as a personal tool.** If this is ever extended to other users, revisit Section 1's legal review before doing so — don't silently scale distribution past personal use without that review happening first.

---

## 11. Testing Checklist Specific to This PRD

1. Install the extension via load-unpacked. Generate an extension token from the web dashboard, paste it into the popup, confirm "Connected" state appears.
2. Open a new ChatGPT conversation, send a few messages. Within ~1-2 minutes, confirm a corresponding `ActivityEvent` row appears with the correct title and `externalId`.
3. Continue the same conversation later in the day. Confirm the existing row is updated (new `lastSeenAt`, not a duplicate row) — same upsert pattern test as PRD-01 Section 4.3.
4. With `chatgptCaptureContent = false` (default), confirm no message text ever reaches the backend — verify this by inspecting the actual network request payload in browser devtools, not just trusting the toggle exists.
5. Turn `chatgptCaptureContent` on in Settings, confirm the extension picks up the new setting and starts including message excerpts, and confirm excerpts are capped at ~500 chars, not full text.
6. Revoke the extension token from the web dashboard while the extension is actively running. Confirm the next send attempt gets 401 and the popup reflects "Reconnect needed" within a reasonable delay.
7. Disconnect from the internet, generate ChatGPT activity, reconnect. Confirm the queued local data (Section 5.3, step 6) is sent once connectivity returns, with no data loss and no duplicates.
8. Manually inspect the live chat.gpt.com DOM and confirm the selectors used in the content script still match current markup — repeat this check periodically given the fragility noted in Section 5.2, and treat any selector failure found during testing as expected maintenance, not a one-time bug to "finally fix."