# ProjectOperations — Project Instructions
# Version: 1.0
# Created: 2026-04-25 10:02 AEST
# Maintained by: Claude Code (update after any architectural decision,
#   module addition, business rule change, or workflow change)
# Accessed by: All Claude chats in this project via web_fetch
# URL: https://github.com/GH-Mantova/ProjectOperations/blob/main/project_instructions.md
#
# ─────────────────────────────────────────────────────────────
# ROUTING INSTRUCTION (read this first, every chat, every time)
# ─────────────────────────────────────────────────────────────
# If your chat title matches "Chat" followed by digits (Chat1, Chat2...):
#   → Jump directly to section: SUPPORT CHAT ROLES
#   → Do not read beyond that section
#   → Do not make architectural decisions
#
# If your chat title is "🏗️ MAIN — ProjectOperations Development":
#   → Read this entire file
#   → Role: architecture, PR prompts, roadmap, all decisions
#
# If your chat has any other title:
#   → Ask the user: "What is the purpose of this chat?
#     (1) Screenshot uploads (2) File review (3) General development"
#   → Act accordingly
# ─────────────────────────────────────────────────────────────

---

## SECTION 1 — COMPANY

**Initial Services Pty Ltd** — Brisbane contractor.
Disciplines: demolition, Class A+B asbestos removal, civil works.

### Key Staff

| Name | Role | Email | Phone |
|------|------|-------|-------|
| Sean Lattin | Company Director | sean@initialservices.net | 0400 850 723 |
| Colin Hanlon | Operations Manager | colin@initialservices.net | 0447 803 617 |
| Beau Murphy | Project Manager | beau.m@initialservices.net | 0400 083 565 |
| Marco Mantovaninni | WHS & Commercial Compliance | marco@initialservices.net | 0487 373 415 |
| Raj Pudasaini | Senior Estimator | estimating@initialservices.net | 0421 140 248 |
| Amy Russian | Accounts Payable/Receivable | admin@initialservices.net | (07) 3888 0539 |
| Matthew Knox | Warehouse Manager | warehouse@initialservices.net | 0407 923 006 |

### Permission Roles
- Sean Lattin: Super User (bypasses all permission checks via isSuperUser in JWT)
- Colin Hanlon: Admin
- Marco Mantovaninni: Admin + WHS officer + safety.admin + compliance.admin
- Beau Murphy: Project Manager
- Raj Pudasaini: Senior Estimator
- Amy Russian: Accounts (finance.manage)
- Matthew Knox: Warehouse Manager

---

## SECTION 2 — VISION

A full company ERP replacing all Excel, paper, and disconnected SaaS tools.
Equivalent to: Assignar + Buildertrend + Hammertech + Procore + Simpro +
SiteDocs + AssetTiger + Monday CRM + Pipedrive — tailored to IS workflows.

One platform. One source of truth. Desktop for office, mobile web for field.

---

## SECTION 3 — ENVIRONMENT

| Item | Value |
|------|-------|
| Repo | https://github.com/GH-Mantova/ProjectOperations |
| Local path | C:\ProjectOperations2 |
| Database | Docker — project-operations-postgres / project_operations |
| Dev login | admin@projectops.local / Password123! |
| Claude Code flag | always use --dangerously-skip-permissions |
| CLAUDE.md | Repo root — Claude Code reads automatically each session |
| project_instructions.md | Repo root — fetch via blob URL |
| progress.md | Repo root — fetch via blob URL |
| roadmap.md | Repo root — fetch via blob URL |

### Key URLs (use blob URL — raw CDN has delays)
- Instructions: https://github.com/GH-Mantova/ProjectOperations/blob/main/project_instructions.md
- Progress: https://github.com/GH-Mantova/ProjectOperations/blob/main/progress.md
- Roadmap: https://github.com/GH-Mantova/ProjectOperations/blob/main/roadmap.md

---

## SECTION 4 — TECH STACK

| Layer | Technology |
|-------|-----------|
| API | NestJS + Prisma + PostgreSQL |
| Frontend | React + Vite + Recharts + @dnd-kit |
| Monorepo | pnpm workspaces |
| CI/CD | GitHub Actions → Azure |
| Auth | JWT (local) + M365 SSO |
| Documents | SharePoint via Microsoft Graph API |
| Accounting | Xero (OAuth2) + MYOB (CSV export) |
| Mobile | PWA + IndexedDB offline |
| Planned | WebSockets, Web Push notifications |

---

## SECTION 5 — BRAND (permanent — never change without explicit instruction)

| Token | Value | Usage |
|-------|-------|-------|
| Black | #000000 | Primary text, dark backgrounds |
| Teal | #005B61 | Primary brand, sidebar, headers |
| White | #FFFFFF | Light backgrounds, text on dark |
| Orange | #FEAA6D | ALL interactive elements (buttons, links, CTAs) |
| Dark Grey | #242424 | Secondary backgrounds |
| Light Grey | #F6F6F6 | Page backgrounds, card backgrounds |
| Font — body | Outfit | All body text, labels, inputs |
| Font — headings | Syne | h1, h2, h3 only |

Rules:
- Dark background → light text. Always.
- Always use CSS variables — never hardcode colour values.
- Orange is reserved for interactive elements only — never decorative use.

---

## SECTION 6 — ARCHITECTURE RULES (always apply, no exceptions)

### Code rules
- Read existing files before writing any code — always
- All $ calculations server-side — never trust or compute on frontend
- Prisma: `migrate deploy` on main — never `migrate dev` on main
- `pnpm build` + lint must pass before any PR
- `pnpm compliance:smoke` after every migration
- `pnpm seed` must run without errors after every migration (idempotent)
- Swagger decorators on ALL new API endpoints
- Migration names: `YYYYMMDD_feat_description`
- New pages: ShellLayout (desktop) or FieldLayout (mobile) — never create new shells
- Permissions pattern: `module.view` / `module.manage` / `module.admin`
- Dashboard widgets: always register in `widgetRegistry.ts`
- Drag and drop: `@dnd-kit` only, `PointerSensor` with `distance: 8`
- Notifications: always go through `NotificationsService` — never send directly
- GPS/location: always capture with user consent, store with timestamp + accuracy

### Pre-PR CI checklist (mandatory — fix ALL before pushing)
1. `pnpm --filter @project-ops/api lint` — zero warnings, zero errors
2. `pnpm --filter @project-ops/web lint` — zero warnings, zero errors
3. `pnpm --filter @project-ops/api test` — zero failures
4. `pnpm --filter @project-ops/web test` — zero failures
5. `pnpm build` — both packages must succeed
6. `pnpm compliance:smoke` — must pass
7. `npx playwright test tests/e2e/tendering.spec.ts --project=chromium` — all pass
Never open a PR with known CI failures. Fix locally first, then push.

### PR rules
- Combine all related fixes into one prompt unless:
  1. Hard schema dependency — PR B cannot branch until PR A merges
  2. Risk isolation — risky schema change separate from safe UI change
- Token budget is NEVER a reason to split PRs — always pause and resume
- Auto-merge at end of every PR prompt:
```
gh pr create \
  --title "..." \
  --body "..." \
  --reviewer GH-Mantova \
&& gh pr merge --auto --squash
```
- Auto-merge head-race: if auto-merge stalls with "head branch not up to date":
  `gh pr merge [N] --admin --squash`
  This is a known GitHub race condition — handle automatically, do not wait.

### Token budget rule (include in every Claude Code prompt)
TOKEN BUDGET: If approaching context limit, finish the current file, run
lint, commit with message "wip: [branch-name] — pausing for token reset",
push the branch, then STOP and wait. Do not open the PR yet. When resumed,
continue from where you left off and complete all remaining tasks before
opening the PR.

### PR numbering convention
Chain PRs have conceptual numbers (#83.1) that may differ from GitHub's
sequential numbers when hotfixes are inserted. Always record BOTH in progress.md:
  Chain PR: #83.1 (conceptual)
  GitHub PR: #84 (actual GitHub number)

---

## SECTION 7 — KEY ENVIRONMENT VARIABLES

These must exist in `.env` for the system to function correctly.
See `.env.example` for full reference with descriptions.

```
# SharePoint
SHAREPOINT_MODE=live|mock
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
SHAREPOINT_SITE_ID=
SHAREPOINT_DRIVE_ID=
SHAREPOINT_ROOT_FOLDER=Project Operations

# Xero
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=
XERO_REDIRECT_URI=
XERO_SCOPES=

# Portal
PORTAL_JWT_SECRET=
PORTAL_JWT_EXPIRY=
PORTAL_PUBLIC_URL=
```

---

## SECTION 8 — USER TYPES

| Type | Model | Auth | Access |
|------|-------|------|--------|
| InternalUser | User | JWT (local) + M365 SSO | Full ERP (ShellLayout) |
| WorkerProfile | WorkerProfile | JWT or mobile-only | Field routes (FieldLayout) |
| ClientPortalUser | ClientPortalUser | Separate portal JWT | /portal/client only (PortalLayout) |
| SubcontractorContact | (planned) | Separate portal JWT | /portal/sub only (planned) |

### JWT rules
- Staff JWT payload: `{ sub, email, role, isSuperUser, permissions[] }`
- Portal JWT payload: `{ sub, email, type: 'client_portal', contactId, clientId }`
- `JwtAuthGuard` rejects any token where `type === 'client_portal'`
- `PortalAuthGuard` accepts ONLY tokens where `type === 'client_portal'`
- `isSuperUser: true` bypasses ALL permission checks — no guard can block Sean

### Layouts
- `ShellLayout` — desktop, sidebar nav, internal users
- `FieldLayout` — mobile-optimised, bottom nav, field workers (`/field/*`)
- `PortalLayout` — minimal IS-branded, no sidebar, external users (`/portal/*`)

---

## SECTION 9 — SIDEBAR NAVIGATION (definitive — do not deviate)

```
COMMERCIAL
  Tendering          → /tenders/pipeline
  Contracts          → /contracts

OPERATIONS
  Projects           → /projects
  Jobs               → /jobs
  Scheduler          → /scheduler
  Sites              → /sites
  Assets             → /assets
  Maintenance        → /maintenance
  Forms              → /forms
  Safety             → /safety

FIELD (FieldLayout, mobile only — bottom nav)
  Allocations        → /field/allocations
  Pre-start          → /field/pre-start
  Timesheet          → /field/timesheet
  Safety             → /field/safety

DIRECTORY
  Clients            → /clients
  Subcontractors     → /directory/subcontractors
                       (label: "Subcontractors & Suppliers" — truncate to "Subcontractors"
                        in sidebar if needed, full label in page header)
  Contacts           → /directory/contacts

PLATFORM
  Dashboard          → /dashboards  (+ button creates new dashboard)
  Compliance         → /compliance
  Documents          → /documents
  Archive            → /archive

ADMIN (Admin + Super User only — hidden for all other roles)
  Admin Settings     → /admin/settings
  Rates & Lists      → /admin/estimate-rates
```

---

## SECTION 10 — ESTIMATING DOMAIN (permanent business logic)

### Scope codes
| Code | Discipline |
|------|-----------|
| SO | Strip-outs |
| Str | Structural demolition |
| Asb | Asbestos removal |
| Civ | Civil works |
| Prv | Provisional sums |

### Cost sections (display order)
Labour → Equip & Sub → Plant → Disposal → Cutting

### General estimating rules
- Default markup: 30% per item (editable per job)
- Labour formula: Qty × Days × Rate (Day / Night / Weekend)
- Plant: wet hire (operator included) vs dry hire (separate operator cost line)
- Payment terms default: 25 days EoM (editable per client)
- All prices ex-GST. GST added at invoice stage.
- Quote validity: 30 days from issue or end of financial year (whichever first)
- AI scope drafting: IS disciplines only — never MEP, fit-out, painting,
  or new construction

### Waste
- Cascade: Group → Type → Facility
- Unit: per tonne OR per m³ (user selects per line item)
- Truck days: user-defined inputs per job:
  - Waste volume or tonnage
  - Truck capacity (m³ or T per load)
  - Expected loads per day (based on job location + tip site distance)
  - Number of trucks allocated
  All inputs user-editable. No fixed formula.

### Material densities (reference Australian Standards)
Always allow user to override per job. Add new materials citing source.

| Material | Density | Reference |
|----------|---------|-----------|
| Concrete (normal) | 2.40 T/m³ | AS 1379 |
| Concrete (reinforced) | 2.45 T/m³ | AS 1379 |
| Concrete (heavy/high density) | 2.70–3.00 T/m³ | AS 1379 |
| Asphalt (dense graded) | 2.30 T/m³ | Austroads |
| Brick/masonry (clay) | 1.80–2.00 T/m³ | AS 3700 |
| Brick/masonry (concrete block) | 2.00–2.20 T/m³ | AS 3700 |
| Timber (structural hardwood) | 0.80–1.10 T/m³ | AS 1720 |
| Steel | 7.85 T/m³ | AS 4100 |
| Soil (general fill) | 1.60–1.80 T/m³ | AS 1289 |
| Soil (compacted) | 1.80–2.10 T/m³ | AS 1289 |
| Gravel/crushed rock | 1.50–1.80 T/m³ | AS 1289 |

### Cutting (Cutrite schedule of rates)

**CRITICAL: Cutting uses a schedule rate lookup — NOT a formula with multipliers.**

Rate = look up from schedule: Equipment × Elevation × Material × Depth → discrete $ rate

**Elevations for cutting (two only):**
- Floor — has its own rate column in schedule
- Wall — has its own SEPARATE rate column in schedule
- ⚠️ Wall is NOT a multiplier on Floor — it is a completely different rate
- ⚠️ Inverted elevation does NOT exist for cutting — core holes only

**Method multiplier (applied ON TOP of schedule rate):**
- Petrol = 1.0× (no change to schedule rate)
- High-frequency / Low-emission = 1.25× (25% premium)

**Equipment rules:**
| Equipment | Allowed elevations | Allowed methods |
|-----------|-------------------|-----------------|
| Roadsaw | Floor only | Petrol, Low-emission |
| Demosaw | Floor, Wall | High-freq, Petrol, N/A |
| Ringsaw | Floor, Wall | High-freq, Petrol, N/A |
| Flush-cut saw | Floor, Wall | High-freq, Petrol, N/A |
| Tracksaw | Floor, Wall | Petrol, N/A |

**Materials:** Asphalt | Concrete | Masonry

### Core holes (separate schedule from cutting)

Rate = look up from core hole schedule by diameter (32mm to 650mm)

**Elevation multipliers for core holes:**
| Elevation | Multiplier |
|-----------|-----------|
| Floor | 1.0× (base rate, no change) |
| Wall | 1.1× |
| Inverted | 2.0× |

⚠️ Inverted elevation exists for CORE HOLES ONLY — never for cutting.

---

## SECTION 11 — BUSINESS LOGIC SANITY CHECKS

**Verify these before writing ANY estimating code. If anything seems wrong: STOP and confirm with user.**

| Rule | Correct behaviour |
|------|------------------|
| Cutting rate model | Schedule lookup (Equipment × Elevation × Material × Depth) — NOT base × multiplier |
| Wall elevation (cutting) | Separate rate column — NOT 1.1× multiplier on floor rate |
| Inverted elevation | Core holes ONLY — never applies to cutting |
| Core hole Wall multiplier | 1.1× applied to core hole schedule rate |
| Core hole Inverted multiplier | 2.0× applied to core hole schedule rate |
| Cutting method multiplier | Petrol=1.0× HF/LE=1.25× — applied after schedule rate lookup |
| Truck days | User-defined inputs per job — no fixed formula |
| Default markup | 30% per item — editable per job |
| Payment terms | 25 days EoM — editable per client |
| Material densities | Reference Australian Standards — always allow user override |
| Safety sidebar location | OPERATIONS section (not Platform, not Forms) |
| Compliance sidebar location | PLATFORM section |
| Dashboard entry | PLATFORM — single "Dashboard" item with "+" to create new |
| Duplicate dashboard | Must not exist — only one dashboard entry in sidebar |
| Portal token on staff endpoints | Must be REJECTED — JwtAuthGuard blocks type=client_portal |
| isSuperUser | Bypasses ALL permission checks — Sean Lattin only |

---

## SECTION 12 — DASHBOARD SYSTEM

### Architecture
- Single "Dashboard" entry in PLATFORM sidebar with "+" button to create new
- All dashboards are fully user-customisable widget grids
- Each user's dashboard configuration is unique to their login
- No shared/global dashboards — each user owns their own set

### Dashboard creation flow
1. User clicks "+" next to Dashboard in sidebar
2. Modal opens: name the dashboard, optionally start from a system template
3. Widget picker: browse by category, select widgets to include
4. Dashboard created and added to user's personal dashboard list
5. User can rename, reorder, or delete their dashboards at any time

### Widget categories (currently available)
- **Operations:** Active jobs, Active projects, Timesheets pending,
  Tender pipeline value, Open issues, Upcoming maintenance, Jobs by status,
  Tender pipeline by stage, Monthly revenue, Form submissions by week,
  Upcoming maintenance by asset, Project timeline
- **Tendering:** Active contracts, Active pipeline, Submitted MTD,
  Win rate YTD, Avg lead time, Due this week, Follow-up queue,
  Win rate last 6 months, Pipeline by estimator, Recent wins
- **Jobs:** Active jobs, Completion rate, Open issues, Jobs by stage
- **Maintenance:** Overdue maintenance, Upcoming maintenance, Open breakdowns
- **Forms:** Form submissions, Submissions by template
- **Safety:** (to be added — safety incidents, hazards, open items)
- **Compliance:** (to be added — expiring licences, blocked entities)

### Widget display types (pre-built widgets)
KPI card | Bar chart | Line chart | Donut/pie chart | Data table | List

### Custom widget builder (planned — not yet built)
Users will be able to create free-form widgets by:
1. Selecting a data source (any entity: Tenders, Jobs, Projects, Contracts,
   Safety Incidents, Hazards, Workers, Assets, Timesheets, Compliance etc.)
2. Selecting fields to display
3. Choosing display type (table, pivot, bar chart, line chart, pie etc.)
4. Applying filters and groupings
Similar to Excel pivot tables / Power BI — scoped to IS's own data.

### Widget grid rules
- All widgets: register in `widgetRegistry.ts`
- Widget sizes: kpi (span 1) | half (span 2) | full (span 4)
- Grid: 4 columns desktop, 2 columns tablet, 1 column mobile
- Drag-to-reorder via @dnd-kit (PointerSensor, distance: 8)
- Per-widget period override available (shown as orange pill when overridden)

---

## SECTION 13 — MODULE REGISTRY

### ✅ LIVE (merged to main through PR #91)

**COMMERCIAL**
- Tendering — pipeline, register, estimates, Cutrite rates, AI scope drafting
- Scope of Works — waste tab, multi-plant/measurement pills, cutting discipline filter
- Quote system — per-client quotes, revisions, cost lines A/B/C, provisional sums,
  cost options, send via Outlook, client scoring (5 stars, win rate)
- Quote PDF — IS logo, ABN, T&C two-column font 6, estimator-aware,
  simple/detailed modes
- Rates admin — all 7 rate types including full Cutrite matrix + Other rates
- Tender dashboard + reports — KPIs, follow-up queue, scorecard
- Clarifications — unified section, 6 types with colour badges, edit/complete
- Dashboard builder — user-owned, drag-to-reorder, widget categories
- Contracts module — variations, progress claims, retention, cut-off reminders

**OPERATIONS**
- Projects — live job management + Gantt scheduling (Schedule tab)
- Jobs, Scheduler, Forms, Assets, Maintenance (baseline)
- Resource allocation — assign workers/plant to jobs
- Sites — standalone site register, linked to tenders/projects
- Worker availability — leave calendar, unavailability, scheduler overlay

**SAFETY**
- Safety incident register (IS-INC auto-numbering, desktop + mobile)
- Hazard observation register (IS-HAZ auto-numbering, desktop + mobile)
- Safety dashboard widget
- Notifications to Marco + safety.admin on new incidents/extreme hazards

**FIELD (mobile web)**
- FieldLayout + mobile shell
- Worker allocations, pre-start checklists, timesheet capture + approval
- GPS clock-on — optional, explicit consent, clock events only
- Safety reporting — incident + hazard forms (mobile)
- Offline support — PWA, IndexedDB, auto-sync on reconnect

**DIRECTORY**
- Extended Client model (ABN, ACN, address, bank details, finance tabs)
- Business types: Company | Sole Trader | Partnership | Trust | Private Person
  (Private Person: ABN/ACN hidden, auto-creates primary contact)
- Subcontractor/Supplier module with prequalification (approved/pending/
  suspended/rejected) + trade categories
- Unified Contact model — polymorphic (CLIENT | SUBCONTRACTOR | SUPPLIER)
  Fields: firstName, lastName, role, email, phone, mobile, isPrimary,
  isAccountsContact, hasPortalAccess
- EntityLicence + EntityInsurance — polymorphic (clientId or subcontractorId),
  expiry tracking, document upload
  Licence types: qbcc | asbestos_a | asbestos_b | electrical | plumbing |
    labour_hire | demolition | waste_transport | other
  Insurance types: public_liability | professional_indemnity |
    workers_compensation | plant_equipment | contract_works | cyber | other
- CreditApplication workflow — outgoing (IS grants credit to client) and
  incoming (IS receives credit from supplier)
  Status flow: draft → submitted → under_review → approved | rejected
- Xero/MYOB export endpoints

**COMPLIANCE**
- Compliance dashboard (/compliance) — expiry alerts, blocked entities
- Worker qualification register (per worker, expiry tracking)
  Qual types: white_card | asbestos_a | asbestos_b | forklift | ewp |
    rigger | scaffolder | first_aid | warden | dogman | crane |
    electrical | plumbing | other
- Daily cron (7am AEST): 30-day + 7-day expiry alerts to compliance.admin users
- Auto-block expired subcontractors on critical licences/insurance
- ComplianceAlert model tracks sent alerts (prevents duplicates)

**PLATFORM**
- Auth — M365 SSO + local JWT, Super User tier (isSuperUser in JWT payload)
- Portal auth — separate JWT strategy for client portal users
- Notifications bell (in-app)
- Document upload — SharePoint live via Graph API + mock fallback
- AI integration (Anthropic/Gemini/Groq/OpenAI) — configurable in Admin Settings
- Admin Settings — notifications, email, AI, platform, users, integrations
- Global Lists system
- PWA — offline field worker support, install prompt, IndexedDB outbox,
  auto-sync on reconnect, 5-attempt retry with dead-letter handling

**INTEGRATIONS**
- SharePoint — Microsoft Graph API (SHAREPOINT_MODE=live|mock)
  Endpoints: ensureFolder, uploadFile, getFileUrl, deleteFile, listFolder
  Fallback: graceful degradation if Graph API unavailable
- Xero — OAuth2 via xero-node, XeroConnection model, token auto-refresh
  Endpoints: connect, callback, status, disconnect, sync contacts, create invoice
  CSRF protection: HMAC-signed state tokens with 10-minute TTL
- MYOB — manual CSV export (CustomerImport + SupplierImport formats)

**PORTALS**
- Client portal (/portal/client) — tender/project visibility, invite flow
  Pages: login, set-password, dashboard, tenders, tenders/:id, projects,
    projects/:id, documents, profile
  Security: separate JWT (type: client_portal), JwtAuthGuard rejects portal
    tokens on all staff endpoints, rate limiting, CSRF protection,
    data scoped to contactId's client only — NEVER exposes internal rates,
    adjustments, scope details, or cutting rates

### 🔲 KNOWN ISSUES / IMMEDIATE FIXES NEEDED
- Duplicate dashboard page under Platform sidebar — must be deleted
- Safety widget category missing from dashboard widget picker
- Compliance widget category missing from dashboard widget picker

### 🔲 NEXT PRIORITIES
See roadmap.md for full prioritised list.
https://github.com/GH-Mantova/ProjectOperations/blob/main/roadmap.md

---

## SECTION 14 — INTEGRATIONS DETAIL

### SharePoint
- Mode: `SHAREPOINT_MODE=live|mock`
- Live: Microsoft Graph API via `@azure/identity` + `@microsoft/microsoft-graph-client`
- Mock: returns fake folder paths and document URLs (for dev without Azure)
- Folder structure: `SHAREPOINT_ROOT_FOLDER/[tender-or-project-id]/[document-name]`
- Test connection: `GET /api/v1/admin/platform/sharepoint/test`

### Xero
- OAuth2 flow: `/integrations/xero/connect` → Xero consent → `/integrations/xero/callback`
- Scopes: `accounting.contacts accounting.transactions.read accounting.settings.read offline_access`
- Token auto-refresh: 60 seconds before expiry
- Contact sync: creates/updates Xero Contacts for clients, Xero Suppliers for subcontractors
- Invoice creation: from IS progress claims → Xero invoice line items
- CSRF: HMAC-signed state param, 10-min TTL, one-shot delete on use

### MYOB
- Manual CSV export only (live integration planned)
- CustomerImport format for clients
- SupplierImport format for subcontractors

---

## SECTION 15 — AUTONOMOUS PR CHAIN INFRASTRUCTURE

### progress.md
Maintained at repo root. Append-only. Never delete entries.
Fetch: https://github.com/GH-Mantova/ProjectOperations/blob/main/progress.md

Format:
```
[YYYY-MM-DD HH:MM AEST] — [action type]
Type: PR | AUDIT | FIX | PAUSE
Detail: [what happened]
Status: COMPLETE | FAILED | PAUSED
[PR number, branch, commit, CI status, files changed, issues found]
```

Update after: PR opens, PR merges, audit completes, fix applied, chain pauses.

### Bypass actor pattern
Ruleset ID: 15532058

Add bypass (before chain starts):
```bash
gh api --method PUT repos/GH-Mantova/ProjectOperations/rulesets/15532058 \
  --field 'bypass_actors=[{"actor_id":5,"actor_type":"RepositoryRole","bypass_mode":"always"}]'
```

Remove bypass (after chain complete or on pause):
```bash
gh api --method PUT repos/GH-Mantova/ProjectOperations/rulesets/15532058 \
  --field 'bypass_actors=[]'
```

Always verify removal: `current_user_can_bypass` must show `"never"`.
Always remove bypass before pausing or finishing a session.

### Final progress.md entry (after chain complete)
Bypass is removed before final commit, so direct push to main is blocked.
Always use a PR for the final chain-complete log entry:
```bash
git checkout -b chore/chain-complete-log
# append final entry to progress.md
git add progress.md
git commit -m "chore: progress — CHAIN COMPLETE"
git push origin chore/chain-complete-log
gh pr create --title "chore: chain complete log" \
  --body "Final progress.md entry." --reviewer GH-Mantova \
&& gh pr merge --auto --squash
```

### When to pause the chain
- Audit finds CRITICAL or HIGH issues
- CI fails on any PR
- Token budget approaching (commit wip first, then stop)

Pause message format:
```
⏸️  CHAIN PAUSED
URL: https://github.com/GH-Mantova/ProjectOperations/blob/main/progress.md
Reason: [why]
Waiting for: [what's needed]
Type CONTINUE or paste fix instructions to resume.
```

### Audit schedule
- Run after every 2 PRs minimum
- Always run after portal/auth PRs (security-critical)
- Always run after schema migrations (integrity check)
- Audit checks: API health (all endpoints 200), permission registry alignment,
  migration replay on shadow DB, dead code scan, calculation integrity

---

## SECTION 16 — PLANNED INTEGRATIONS (not yet built)

- Calendar sync: Google Calendar + Microsoft Calendar
- Two-way email reply parsing: Outlook/Gmail
- MYOB live integration (OAuth2)
- Web Push notifications (field worker alerts)
- Subcontractor portal: /portal/sub
- Custom widget builder (free-form data source selection)
- WebSockets (real-time field updates)

---

## SECTION 17 — SUPPORT CHAT ROLES

**→ If your chat title matches "Chat" followed by digits (Chat1, Chat2, Chat3...),
this section is your ONLY section. Read it fully, then STOP. Do not read further.**

### Your role
You are a support chat for the ProjectOperations ERP project.
Your sole purpose is to be the eyes and ears of the main development chat.
- Observe precisely
- Describe completely
- Never make architectural decisions
- Never write PR prompts independently
- When asked "what should we do?" — describe the issue and say
  "take this to the main development chat for the fix prompt"

### When images are uploaded
ALWAYS output a full structured description BEFORE any analysis:

```
SCREENSHOT ANALYSIS — [screen or page name]

Route visible: [URL/route shown, or "not visible"]
User logged in as: [name and role if visible, or "not visible"]
Errors: [exact error text verbatim, or "none"]

UI elements visible: [complete list — every button, field, label,
  dropdown, table column, data value, badge, status pill, icon]

Data values shown: [exact values — names, numbers, statuses, dates]

Layout issues: [anything misaligned, truncated, overlapping, missing]

Issues identified:
1. [specific issue with exact location]
2. [specific issue]
...
```

Nothing omitted. No "etc." No summarising. Full detail only.
This description is copied to the main development chat verbatim.

### When files are uploaded (PDF, Word, Excel, CSV)
- State file type and apparent purpose
- Describe every section, every field, every value
- Quote exact text where relevant
- Nothing omitted

### Project context (brief — enough to describe what you see)
- System: ProjectOperations ERP for Initial Services Pty Ltd (Brisbane)
- Disciplines: demolition, asbestos removal, civil works
- Brand: Teal #005B61 sidebar, Orange #FEAA6D buttons, black/white/grey
- Stack: React frontend, NestJS API, PostgreSQL

### Finding the main development chat
The main chat is titled "🏗️ MAIN — ProjectOperations Development"
Direct the user there for all architectural decisions and PR prompts.

### Your chat convention
Support chats are named Chat1, Chat2, Chat3... sequentially.
Start a new chat when the current one reaches its file upload limit.

---
**← STOP HERE if your chat title is Chat1, Chat2, Chat3 etc.**
**Do not read Section 18 or beyond.**
---

## SECTION 18 — MAIN CHAT OPERATING RULES

This section is for the main development chat only.

### Fetching project files
Always use blob URL (raw CDN has significant delays):
- Instructions: https://github.com/GH-Mantova/ProjectOperations/blob/main/project_instructions.md
- Progress: https://github.com/GH-Mantova/ProjectOperations/blob/main/progress.md
- Roadmap: https://github.com/GH-Mantova/ProjectOperations/blob/main/roadmap.md

Fetch `project_instructions.md` when:
- Starting a new conversation (check if content seems stale)
- User mentions a rule that seems inconsistent with what you know
- After a long gap between sessions
- When explicitly asked to check instructions

### Updating project_instructions.md
When any of the following change, instruct Claude Code to update the file:
- Business logic rules (cutting rates, densities, formulas)
- Module registry (new modules live, new deferrals)
- Architecture decisions (new patterns, deprecated patterns)
- Sidebar navigation changes
- Staff or contact details
- Environment variables
- PR/chain infrastructure patterns

Claude Code update command:
```bash
# Edit project_instructions.md directly
# Then commit via PR (bypass actor if mid-chain, PR otherwise):
git checkout -b chore/update-instructions-[date]
# make edits
git add project_instructions.md
git commit -m "chore: update project instructions — [what changed]"
git push origin chore/update-instructions-[date]
gh pr create --title "chore: update project instructions" \
  --body "[what changed and why]" --reviewer GH-Mantova \
&& gh pr merge --auto --squash
```

### Decision-making authority
This chat makes all architectural decisions. Support chats (Chat1, Chat2 etc.)
describe what they see — this chat decides what to do about it.
Claude Code implements — this chat writes the prompts.
