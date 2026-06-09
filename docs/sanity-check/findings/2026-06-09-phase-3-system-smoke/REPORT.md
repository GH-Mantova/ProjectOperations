# Phase 1D + 1E + Phase 3 — Consolidated system-wide smoke

**Status:** PASS with multiple findings
**Tester:** Cowork-driven via Chrome MCP
**Login:** Alex Admin (ADMIN)
**Viewport:** 1568x710 (desktop)

## Summary

System-wide smoke tour completed across 14 module routes:
- Contracts (empty state — no contracts in seed)
- Jobs (3 active + Jobs detail page)
- Scheduler (4-job rail, 14-worker resource list)
- Maintenance (9 events + June 2026 calendar)
- Assets (14+ pieces of equipment with realistic IS fleet)
- Compliance (4 expiry alerts + KPI strip)
- Safety (2 incidents + 3 hazards)
- Forms (13+ templates across 9 categories)
- Documents (23 docs with context rail)
- Archive (1 archived job + Export CSV)
- Admin Settings (6 sub-pages — Notifications visible)
- AI & Integrations (4-provider panel)
- Field/Mobile (FieldLayout structure intact, but 403 error not gracefully handled)
- IS-T020 Tendering Assistant + Entry modal (PR #260 verified)

Most modules render cleanly with realistic SEQ Australian construction context. Three new findings warrant attention.

## What works ✓

### Phase 1D — Contracts + Tender→Job conversion
- `/contracts` page renders with filter chips (All/Active/Practical completion/Defects liability/Closed) + "No contracts yet" empty state + New contract CTA
- Subtitle: "One contract per project. Tracks variations, progress claims, retention, and payment status."
- Seed has 0 contracts → deep workflow not verifiable on a fresh-reset DB. Awarded tenders IS-T001 (Ipswich, $4.25M) and IS-T003 (Sandgate, $1.1M) exist but haven't been converted to contracts in seed.
- Tender → Job conversion API exists (`POST /api/v1/tenders/:tenderId/convert-to-job` per route map). Not invoked from UI this pass.

### Phase 1E — Jobs + recent UX
- Jobs list at `/jobs` shows 3 ACTIVE jobs with KPI cards, status badges, progress bars, worker initials (BM/CH/BM)
- Filters: status, clients, sites, workers, date range × 2 + search
- Cards / Table view toggle + New job CTA
- Job detail page (`/jobs/:id`) has **7 tabs**: Overview, Stages & Activities (2), Issues (1), Variations (1), Progress (2), Documents, History (2)
- KPI strip: Total Activities, Open Issues, Variations Value, Progress %
- PR B01.1 flattened activity surface works (count "1 complete" appears in header)
- Active badge top-right

### PR #260 unified communications panel (verified on IS-T020)
- "Activity & communications" section with Feed / Tabs toggle + "+ Add entry" CTA
- Filter chips: All / Notes / Correspondence / Follow-ups / My Tasks
- New entry modal opens as **CenteredModal** (PR #299/#300 pattern ✓)
- Type dropdown has exactly the 8 entry types per spec: Note, RFI, Email, Call, Meeting, Follow-up, Self-reminder, Task
- **Type-conditional fields verified**: changing Type from "Note" to "Task" reveals Due date + Assignee fields ✓ (PR #260 conditional field behavior)
- Empty state "No entries" + filter helper text "Nothing matches the current filter yet"

### Phase 3 — system-wide

#### Scheduler `/scheduler`
- Week / Month toggle + Today + arrow nav + "8 June – 14 June 2026" range
- Job rail with 4 visible jobs + "All jobs (20)" badge (20 total jobs in system — Jobs page filtered)
- Workers/Assets toggle on resource panel right
- 14+ workers visible with shift counts (Hassan Al-Farsi 5 shifts, Amara Diallo 8 shifts, Ryan O'Brien 10 shifts, Jasmine Nguyen 8 shifts, etc.)
- No shifts visible in current week (Mon 8 to Sun 14 cells empty)

#### Maintenance `/maintenance`
- "Upcoming & overdue" panel with 9 maintenance events
- Calendar view (June 2026)
- Mixed event types: SERVICE (Scheduled badge) + Breakdown (with severity HIGH + status OPEN / UNDER_REPAIR)
- Realistic IS assets: EXCAVATOR 1, UTILITY TRUCK 1, CAT 308 MINI EXCAVATOR, DYNAPAC CA2500 ROLLER
- Overdue dates with red "Overdue" chip
- Fixture comment: "Deliberately overdue for scheduler warning demo" — intentional test data
- "+ Log event" CTA top right

#### Assets `/assets`
- 14+ pieces of equipment in cards (CAT 308 Mini Excavator, CAT 320 Excavator, Brokk 170 Demolition Robot, Concrete Mixer 9m³, Concrete Pump Schwing SP305, Dynapac CA2500 Roller, Excavator 1 EX-001, Ford Ranger ute NVG 456, Hydraulic Submersible Pump, etc.)
- Codes IS-A001 through IS-A014 + legacy EX-001
- Categories: Traffic Management / Excavators / Concrete Equipment / Compactors / Plant / Light Vehicles / Pumps & Drainage
- Status badges: AVAILABLE / MAINTENANCE — CAT 308 status (MAINTENANCE) cross-checks with Maintenance page entry ✓
- Locations: Sandgate Depot, Eagle Farm Depot, Gateway Depot
- Last-service dates per asset
- Filters: categories, statuses, locations + search

#### Compliance `/compliance`
- KPI strip: EXPIRED NOW 1, EXPIRING 7 DAYS 0, EXPIRING 30 DAYS 3, COMPLIANCE BLOCKED 0
- Filter chains: Days ahead (7/14/30/60/90), Type (All/Licences/Insurances/Qualifications), Entity (All/Clients/Subs/Workers), Show expired toggle
- 4 entries:
  - Swanbank Waste (Sub) — Licence — waste transport EPA-WT-5678 — Expired -5 days
  - Cutrite Concrete Sawing (Sub) — Insurance — public liability QBE-2026-001 — 15 days EXPIRING SOON
  - Marco Mantovaninni (Worker) — Qualification — first aid FA-2024-001 — 10 days EXPIRING SOON
  - Raj Pudasaini (Worker) — Qualification — asbestos b ASB-B-2024-001 — 20 days EXPIRING SOON
- Internal consistency check: Swanbank Waste + Cutrite Concrete Sawing match the "1 expiring" alert chips on the Directory page ✓

#### Safety `/safety`
- KPI strip: OPEN INCIDENTS 1, OPEN HAZARDS 2, OVERDUE HAZARDS 1
- 2 tabs: Incidents (2) + Hazards (3)
- Incidents table: IS-INC002 (Near Miss, MEDIUM, Open) + IS-INC001 (First Aid, LOW, Closed)
- Realistic SEQ context: "Riverside demolition site", "Yatala precast yard"
- "+ Report Incident" + "+ Log Hazard" CTAs

#### Forms `/forms`
- 4 tabs: Templates / My submissions / Pending approvals / Analytics
- 9 category filter chips: All / Safety / Asbestos / Plant / Induction / Environmental / Permits / Quality / Daily / Custom
- 13+ templates: Environmental Incident Report, Asbestos Work Plan, Incident Report (auto-creates IS-INC), Near Miss Report, Site Induction, Plant Pre-Start Inspection, Take 5, Daily Pre-Start Safety Meeting, Daily Prestart Checklist, Concrete Pour Record, Incident/Near Miss Report, etc.
- Per-template "Fill out" CTA
- "Last submitted: Never" on all (clean fixture)

#### Documents `/documents`
- 23 docs total across context rail (Jobs / Tenders / Assets)
- Mixed types: JPG, PDF, XLSX
- Per-doc tagging: e.g. "Assets · Maintenance", "Tenders · Submissions", "Jobs · Correspondence", "Form submissions · Evidence"
- Realistic asset docs: Schwing SP305 Cal Cert, Komatsu PC210 Rego, CAT 320 Service, CAT 320 Rego, "Pricing Schedule — Eagle Farm Hardstand"
- v1 versioning, Download + New version actions
- "+ Upload" CTA + drop-anywhere area + accepted types list

#### Archive `/archive`
- "Read-only register of closed and archived jobs"
- 1 archived job: **JOB-2025-099 — South precinct closeout package — Northside Civil — Closed 09/06/2026 — ARCHIVED**
- Filters: Search, Year, Client, Status
- Export CSV button
- View action per row
- (Same JOB-2025-099 also surfaced on the Scheduler rail and contributes to the F1E-01 finding below.)

#### Admin Settings `/admin/settings`
- 6 sub-pages: Notifications / Email / Users / AI & Integrations / Platform / Permissions / Audit log
- Notifications page shows 3 enabled triggers (Project status changed, Tender submitted, Worker allocated) with toggle on/off
- Per-trigger Delivery Method (Both/Email only/In-app only)
- Per-trigger Recipients by role (Accounts/Admin/Project Manager/Senior Estimator/Warehouse Manager) with per-role count badges and "Admin (4)" notably populated

#### AI & Integrations sub-page
- "AI provider configuration" card
- "Manage Anthropic, Gemini, Groq, and OpenAI API keys and the preferred provider for scope drafting. Personal AI keys live on each user's /account page."
- "Open settings" CTA — confirms the §5A.1 BYOK + multi-provider surface from PRs #117 / #134 / #139

## Findings

### F1E-01: Job ID canonicalisation regression — multiple legacy `JOB-YYYY-NNN` jobs in seed
**Severity:** HIGH (deviates from PR #210 canonicalisation, contained to seed)
**Pages:** `/jobs`, `/scheduler`, `/archive`
**Already logged in detail:** `findings/2026-06-09-phase-1e-job-id-format-regression/REPORT.md`

Discovered on the Jobs page initially; subsequent pages confirm:
- `/jobs` shows JOB-2026-001 (legacy) alongside J-2025-002, J-2025-001 (canonical)
- `/scheduler` rail adds JOB-2025-099 (legacy)
- `/archive` confirms JOB-2025-099 as the archived job (also legacy)

So the seed produces at least 2 legacy-format jobs alongside canonical ones, on a fresh `prisma migrate reset --force` followed by `pnpm seed`. Reconciliation work needed in the seed source.

### F3-01: Field/Mobile route shows raw JSON 403 to the user instead of a styled error state
**Severity:** CONCERN (UX polish — but user-facing) 
**Page:** `/field/allocations`
**Observed:** As an ADMIN user with no linked worker profile, the page renders the FieldLayout (top bar "IS My Jobs", bottom tab bar Home/Pre-Start/Timesheet/Documents/Safety) but the main area displays raw JSON:
```json
{"statusCode":403,"error":"Forbidden","message":"No worker profile is linked to your account. Ask your office to provision mobile access.","path":"/api/v1/field/my-allocations","timestamp":"2026-06-09T06:05:01.285Z"}
```
The error message itself is well-crafted — it just isn't being caught + rendered as a styled empty state.

**Recommended fix:** add an error boundary in `apps/web/src/pages/field/MyAllocationsPage.tsx` (or wherever the page lives) that detects the 403 + Forbidden shape and renders a friendly "Mobile access not provisioned for your account" state with an actionable next step (e.g. "Contact your office administrator" or a "back to web view" link). Could also be a broader pattern — apply the EmptyState / ErrorState component already used elsewhere.

### F3-02: Compliance sidebar badge count diverges from page total
**Severity:** MINOR (count semantics — possible mismatch)
**Pages:** Left rail "Compliance" badge "6" vs `/compliance` page showing 4 entries at the default 30-day window
**Hypothesis:** Sidebar badge may count all expiring items across ALL timeframes (7/14/30/60/90 days), while the page default filter restricts to 30 days. Or, sidebar may include the COMPLIANCE BLOCKED count somehow even though the page shows 0.
**Action:** Either (a) align the count formulas, or (b) make the sidebar tooltip clarify "expiring within 30 days" / "compliance attention items".

### F3-03: Documents context rail labels duplicate ("Jobs" / "Tendering" repeated)
**Severity:** MINOR (information density)
**Page:** `/documents` left rail
**Observed:** Context rail shows entries labelled generically: "Jobs (1)", "Jobs (4)", "Jobs (5)", "Tendering (1)", "Tendering (1)", "Tendering (1)", "Jobs (1)", "Jobs (1)" etc. Each row is presumably one specific job or tender, but the label only carries the entity type, not the specific job/tender code or name.
**Action:** Each row should show the parent record's name or code (e.g. "JOB-2026-001 North precinct" or "IS-T100 TEMPLATE") rather than just "Jobs" or "Tendering". Without that, the rail is just visual noise — only the per-row count differentiates entries.

## Items not verified

- Tender→Job conversion flow (no contracts in seed; would need to award + convert IS-T001 or IS-T003)
- Award → Contract → Variations → Claims (submit/approve/pay) end-to-end
- Quote PDF render (PR #220+ HTML→PDF) — IS-T100 has the seeded quote IS-T100-R1; clicking PDF would test
- Tendering Assistant actual chat exchange — needs an Anthropic or OpenAI key configured in `apps/api/.env`
- Drawing tools live test from persona on IS-T020 (has demo PDF per PR #146)
- propose_estimate_items / propose_quote_content / propose_clarifications accept/reject flows
- lookup_rate tool across 8 rate types
- read_asbestos_register against the seeded IS-T020 BGS-T020 Asbestos Register PDF
- Persona Settings page (gear icon in floating window)
- New tender creation flow + filter presets save/load
- Bulk-status update (Raj-blocking item from §5A.3)
- Tender Detail Team panel rebuild (PR-63 still queued per roadmap)
- Other CenteredModal migrations from PR #313 — sweep needs cataloguing
- JobsPage empty state (#327) — couldn't trigger because 3 active jobs exist; need filter that yields 0 OR an unfiltered state where archived-only items hide. The Jobs page's empty branch wasn't observed.
- Portal `/portal/client` (separate JWT — would need a different user)
- Mobile responsive layout (375px width)
- Permission gating (would need a non-admin role and a way to switch)

## Verdict

The system is in a healthy state. The §5A.1 + B-chain + §5A.2 work is visible at the UI layer. The seed produces a rich, realistic dataset that allows most paths to be eyeballed. The findings logged in this session (Phase 0 schema drift + F1E-01 job ID + F3-01 field error UX + F3-02 compliance badge + F3-03 documents rail labels + the Phase 1A/1B concerns) are all actionable as discrete PR-prompt drafts. None block Marco's Azure deployment in the short term — the schema drift IS a deployment risk and should be triaged before the first `migrate deploy` against the production DB.
