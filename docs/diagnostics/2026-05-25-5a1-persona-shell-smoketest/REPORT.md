# §5A.1 Persona Shell Smoke Test — 2026-05-25

Diagnostic run by Cowork (§19 local diagnostic agent).
Date: 2026-05-25, ~05:25–05:46 AEST.

---

## §1 — Setup

### Stack status

| Component | Status |
|---|---|
| PostgreSQL (Docker) | Running — `Up 18 hours (healthy)` |
| Prisma migrate | 86 migrations applied, schema up to date |
| Seed | Completed (exit 0, no errors) |
| API (`localhost:3000`) | Running — health check returns `{"status":"ok"}` |
| Web (`localhost:5173`) | Running — Vite dev server returns 200 |

### Migrate output

```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "project_operations", schema "public" at "localhost:5432"
86 migrations found in prisma/migrations
Database schema is up to date!
```

### Seed output

```
> @project-ops/api@0.1.3 seed C:\ProjectOperations2\apps\api
> tsx prisma/seed.ts
(exit code 0, no output)
```

### AI provider key

**Not present.** No `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or any AI provider key
found in `apps/api/.env`. §3 and §4 are **BLOCKED** by this.

### Logged-in account

- **Display name**: Alex Admin
- **Email**: `admin@projectops.local`
- **Role**: Admin ("Full platform administration")
- **isSuperUser**: `false`
- **Permissions include**: `ai.persona.tendering` (can see persona window)
- **Super User account**: Sean Lattin (`sean@initialservices.net`, `isSuperUser: true`)

Login response (user object):

```json
{
  "id": "cmpja2dme004b0qesk2tks9ar",
  "email": "admin@projectops.local",
  "firstName": "Alex",
  "lastName": "Admin",
  "isActive": true,
  "isSuperUser": false,
  "roles": [{ "name": "Admin", "description": "Full platform administration" }],
  "permissions": ["ai.persona.tendering", ...62 others]
}
```

---

## §2 — Persona window route-matching

All tests run as Alex Admin (`ai.persona.tendering` permission).
Tender IS-T020 URL: `/tenders/cmpja2gjj00rl0qesc7x8duy1`

| Route | Window | Sub-mode label | API status |
|---|---|---|---|
| `/tenders` | **PRESENT** | "Tender register — pipeline view" | 200 |
| `/tenders/cmpja2gjj00rl0qesc7x8duy1` (IS-T020) | **PRESENT** | "Tender detail — answer questions about the tender" | 200 |
| `/tenders/cmpja2gjj00rl0qesc7x8duy1` → Scope of Works tab | **PRESENT** | "Tender detail — answer questions about the tender" | 200 |
| `/tenders/cmpja2gjj00rl0qesc7x8duy1` → Quote tab | **PRESENT** | "Tender detail — answer questions about the tender" | 200 |
| `/tenders/:id/clarifications` (API only) | N/A — no UI tab | "Clarifications — summarisation and response drafts" | 200 |
| `/assets` | **ABSENT** | (empty response) | 200 |

### Observation — sub-mode does not update with tab switches

The UI uses client-side tabs (Overview / Scope of Works / Quote) within a single
URL (`/tenders/:id`). The `active-for-route` API is called with `/tenders/:id`
regardless of which tab is active, so the sub-mode always returns `tender-detail`.
The API *does* return correct sub-modes for `/tenders/:id/scope`,
`/tenders/:id/quote`, and `/tenders/:id/clarifications` when queried directly,
but the UI never constructs those URLs.

**Impact**: The persona window header always shows "Tender detail" even when
the user is on the Scope or Quote tab. The persona system prompt does not
receive the sub-mode context for those tabs.

### `active-for-route` response bodies

**`/tenders`**:
```json
{
  "persona": {
    "slug": "tendering",
    "displayName": "Tendering Assistant",
    "description": "Conversational AI assistant for IS tendering workflow..."
  },
  "subMode": {
    "name": "register",
    "label": "Tender register — pipeline view"
  }
}
```

**`/tenders/:id`** (tender detail):
```json
{
  "persona": { "slug": "tendering", "displayName": "Tendering Assistant", ... },
  "subMode": { "name": "tender-detail", "label": "Tender detail — answer questions about the tender" }
}
```

**`/tenders/:id/scope`** (API-only, not hit by UI):
```json
{
  "persona": { "slug": "tendering", ... },
  "subMode": { "name": "scope", "label": "Scope — propose and refine scope items" }
}
```

**`/tenders/:id/quote`** (API-only, not hit by UI):
```json
{
  "persona": { "slug": "tendering", ... },
  "subMode": { "name": "quote", "label": "Quote — cost line structure and exclusions" }
}
```

**`/tenders/:id/clarifications`** (API-only, no UI tab):
```json
{
  "persona": { "slug": "tendering", ... },
  "subMode": { "name": "clarifications", "label": "Clarifications — summarisation and response drafts" }
}
```

**`/assets`**:
```
(empty 200 response — no persona matches)
```

### Screenshots

- `/tenders` pipeline with "Tendering Assistant" pill visible (screenshot ss_2047neu3n)
- IS-T020 tender detail with pill visible (screenshot ss_8053kfbdz)
- Scope of Works tab with pill visible (screenshot ss_42463spo1)
- Quote tab with pill visible (screenshot ss_81849twkm)
- `/assets` page — no persona window (screenshot ss_62811ambn)

---

## §3 — Chat streaming

### Status: BLOCKED

**Reason**: No AI provider API key configured in `apps/api/.env`. Without
`ANTHROPIC_API_KEY` (or another provider key), the chat backend cannot call the
AI provider and streaming will fail.

### Chat panel rendering: PASS

The persona window pill was clicked on the Scope of Works tab. The chat panel
opened and rendered correctly:

- **Title**: "Tendering Assistant"
- **Sub-mode label**: "Tender detail — answer questions about the tender"
- **Buttons**: "+ New", "History"
- **Placeholder text**: "Ask the Tendering Assistant about this tender."
- **Input field**: "Message..." with "Send" button
- **Settings cog**: Present in footer, links to `/admin/ai-settings`

Screenshot: ss_1924o0ou1

No message was sent because no AI key is available.

---

## §4 — Tool round-trip

### Status: BLOCKED

**Reason**: Same as §3 — no AI provider API key configured. Tool calls require
the AI provider to invoke tools, which requires a valid API key.

No prompts were sent. All three test prompts (list_tender_drawings,
read_asbestos_register, propose scope item) are **BLOCKED**.

---

## §5 — AI Settings page

### Navigation

The settings cog icon in the persona window footer correctly navigates to
`/admin/ai-settings`. Confirmed working.

### Company tab (Sean Lattin — Super User)

Logged in as Sean Lattin (`sean@initialservices.net`, `isSuperUser: true`).
The Company tab is visible and renders all expected elements:

**Provider Access**:
- Anthropic Claude: checked (default — required for now)
- OpenAI GPT: unchecked
- Google Gemini: unchecked
- Groq: unchecked

**User Customisation**:
- "Allow users to add personal instructions to AI personas": unchecked (default)
- "Allow users to bring their own API keys (BYOK)": unchecked (default)

**Save changes** button: present

**Personas section**:
- "Tendering Assistant" card with "Active on: /tenders/*"
- Company Instruction textarea with placeholder
- "Save changes" button with "Last updated: 24/05/2026, 14:28:58"

**API Keys section**:
- Anthropic Claude: "Not configured" with "Configure" button
- OpenAI GPT: "Not configured" with "Configure" button
- Google Gemini: "Not configured" with "Configure" button

Screenshots: ss_7528wqr3k (top), ss_3137y8l2p (scrolled to API Keys)

#### Toggle/Save/Reload test

1. Toggled **OpenAI GPT** ON → clicked **Save changes**
2. Success toast: "Company AI settings saved" (screenshot ss_9845ej1fd)
3. Reloaded page (F5)
4. OpenAI GPT remains checked → **persistence confirmed** (screenshot ss_3396do3r7)
5. Toggled OpenAI GPT back OFF, saved → restored to original state

**`GET /api/v1/personas/global-settings` response**:
```json
{
  "id": 1,
  "allowUserInstructionOverrides": false,
  "enabledProviders": ["anthropic"],
  "allowBringYourOwnKey": false,
  "createdAt": "2026-05-24T04:28:58.548Z",
  "updatedAt": "2026-05-24T04:28:58.548Z"
}
```

**`PUT /api/v1/personas/global-settings`**: returned 200 on both save operations.

### My Settings tab

**As Alex Admin** (non-Super User):
- Company tab NOT visible (expected — Super User only)
- My Settings renders with:
  - Personal API Keys (BYOK): "Personal AI keys are disabled by your administrator."
  - Tendering Assistant card with provider override dropdown ("Anthropic Claude")
  - Company Instruction (read-only): "No company instruction set yet."
  - NO personal-instruction textarea (company toggle is OFF)
  - "Save my settings" button

Screenshot: ss_6587bys6q

**As Sean Lattin** (Super User, My Settings tab):
- Same layout as Alex Admin
- Provider override: "Use system default (Anthropic)"

Screenshot: ss_703501vyb

#### Personal instruction toggle test

1. Company tab → toggled "Allow users to add personal instructions" ON → Save
2. Toast: "Company AI settings saved" (screenshot ss_2568qncnd)
3. Switched to My Settings tab
4. **"My Personal Instruction" textarea appeared** (screenshot ss_703501vyb)
5. Typed "Smoke test personal instruction" → Save
6. Toast: "My settings saved" (screenshot ss_5387g8xok)
7. Reloaded page → switched to My Settings
8. Personal instruction text persisted: "Smoke test personal instruction" (screenshot ss_64781ucmi)
9. Reverted: cleared personal instruction, saved; turned off company toggle, saved

**`GET /api/v1/personas/tendering/my-settings` response** (Alex Admin):
```json
{
  "id": "cmpjciqfe001h0q0oji17g1rm",
  "userId": "cmpja2dme004b0qesk2tks9ar",
  "personaId": "cmpja2hwo017h0qes4djxsrzd",
  "providerOverride": "anthropic",
  "instructionOverride": null,
  "bringYourOwnKey": null,
  "createdAt": "2026-05-24T05:37:35.306Z",
  "updatedAt": "2026-05-24T05:37:40.195Z"
}
```

**`PUT /api/v1/personas/tendering/my-settings`**: returned 200.

### Non-Super-User access control

When Alex Admin (non-Super User) was logged in, `GET /api/v1/personas/global-settings`
returned **403 Forbidden** — correct access control. The Company tab was not
rendered in the UI.

---

## §6 — Console + network error sweep

### Console errors

No red console errors observed during the walkthrough. Console error tracking
was active during §5 page reloads and tab switches.

### Failed network requests

| Request | Status | Step | Notes |
|---|---|---|---|
| `GET /api/v1/personas/global-settings` | 403 | §5 (Alex Admin on AI Settings) | **Expected** — non-Super-User correctly denied |
| `GET /api/v1/personas/global-settings` | 403 | §5 (Alex Admin on AI Settings) | **Expected** — duplicate call, same reason |

**No unexpected 4xx/5xx errors observed.**

---

## §7 — Summary table

| Check | Verdict | Evidence |
|---|---|---|
| §2 `/tenders` — window present | **PASS** | §2 route table, screenshot ss_2047neu3n |
| §2 `/tenders/:id` — window present | **PASS** | §2 route table, screenshot ss_8053kfbdz |
| §2 `/tenders/:id` Scope tab — window present | **PASS** | §2 route table, screenshot ss_42463spo1 |
| §2 `/tenders/:id` Quote tab — window present | **PASS** | §2 route table, screenshot ss_81849twkm |
| §2 `/tenders/:id/clarifications` — API sub-mode | **PASS** | §2 API response (no UI tab exists) |
| §2 `/assets` — window absent | **PASS** | §2 route table, screenshot ss_62811ambn |
| §2 Sub-mode updates per tab | **FAIL** | §2 observation — URL doesn't change with tabs |
| §3 Chat panel renders | **PASS** | §3, screenshot ss_1924o0ou1 |
| §3 Chat streaming | **BLOCKED** | §3 — no AI provider key |
| §4 `list_tender_drawings` tool | **BLOCKED** | §4 — no AI provider key |
| §4 `read_asbestos_register` tool | **BLOCKED** | §4 — no AI provider key |
| §4 Propose scope item card | **BLOCKED** | §4 — no AI provider key |
| §5 Company tab renders (Super User) | **PASS** | §5, screenshots ss_7528wqr3k, ss_3137y8l2p |
| §5 Company toggle/save/reload | **PASS** | §5, screenshots ss_9845ej1fd, ss_3396do3r7 |
| §5 My Settings tab renders | **PASS** | §5, screenshots ss_6587bys6q, ss_703501vyb |
| §5 Personal instruction toggle/save/reload | **PASS** | §5, screenshots ss_5387g8xok, ss_64781ucmi |
| §5 Cog icon → AI Settings navigation | **PASS** | §5 navigation confirmed |
| §5 Non-Super-User access control (403) | **PASS** | §6 network table |
| §6 Console errors | **PASS** | §6 — none observed |
| §6 Network errors | **PASS** | §6 — no unexpected errors |
