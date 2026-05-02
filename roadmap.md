# ProjectOperations — Roadmap

Last updated: 2026-05-02 01:00 AEST

# Version: 1.0
# Created: 2026-04-25 10:02 AEST
# Maintained by: Claude Code + main development chat
# Format: append new entries, never delete old ones
# Fetch: https://github.com/GH-Mantova/ProjectOperations/blob/main/roadmap.md
#
# Status legend:
#   ✅ COMPLETE — merged to main
#   🔧 IN PROGRESS — PR open or branch active
#   🔲 QUEUED — next in line
#   ⏸️  DEFERRED — agreed to skip for now, revisit later
#   ❌ CANCELLED — will not build

## TABLE OF CONTENTS

| Phase | Title | Status |
|-------|-------|--------|
| §1 | Commercial Foundation | ✅ Complete |
| §2 | Operations + Field | ✅ Complete |
| §3 | Directory + Compliance | ✅ Complete |
| §4 | Integrations | ✅ Complete |
| §5A | Tendering Module Sign-off | 🔲 Current priority — gate for everything else |
| §5B | Dashboard + UI fixes | ✅ Complete (PR #92 + #96) |
| §5C | Forms Engine UI | 🔲 Follow-up to PR #97 |
| §6 | Deferred / tech debt | ⏸️ Tracked items |
| §7 | Next feature priorities | 🔲 Queued |
| §8 | Future / unscoped | 🔲 Future |
| Changelog | Roadmap-change history | append-only |

**Quick navigation:**
- "What should I work on next?" → §5A (gate) → §7 (post-gate)
- "Is this on the roadmap?" → Ctrl+F the keyword
- "Why was X deferred?" → §6 (notes attached to each item)

---

## PHASE 1 — COMMERCIAL FOUNDATION ✅ COMPLETE

✅ Tendering pipeline + register
✅ Estimate editor (Labour, E&S, Plant, Disposal, Cutting, Waste tabs)
✅ Cutrite rates (full matrix — Floor/Wall × Equipment × Material × Depth)
✅ AI scope drafting (IS disciplines only)
✅ Quote system (per-client, revisions, cost lines A/B/C)
✅ Quote PDF (IS logo, ABN, T&C, simple/detailed modes)
✅ Clarifications (unified, 6 types, colour badges)
✅ Tender dashboard + reports (KPIs, follow-up queue, scorecard)
✅ Contracts module (variations, progress claims, retention, cut-off reminders)
✅ Rates admin (all 7 rate types including Cutrite matrix + Other rates)
✅ Dashboard builder (user-owned, drag-to-reorder, widget categories)
✅ Client portal /portal/client (separate JWT, invite flow, security hardened)

---

## PHASE 2 — OPERATIONS + FIELD ✅ COMPLETE

✅ Projects (live job management)
✅ Jobs, Scheduler, Forms, Assets, Maintenance (baseline)
✅ Resource allocation (workers + plant to jobs)
✅ Sites (standalone register, linked to tenders/projects)
✅ Gantt scheduling (GanttTask model, Schedule tab, auto-generate from scope)
✅ Worker availability (leave calendar, unavailability, scheduler overlay)
✅ Field worker mobile shell (FieldLayout)
✅ Allocations, pre-start checklists, timesheet capture + approval
✅ GPS clock-on (consent-based, clock events only, 90-day auto-delete)
✅ Safety forms (IS-INC/IS-HAZ, desktop + mobile, notifications to Marco)
✅ PWA offline support (IndexedDB, auto-sync, install prompt)

---

## PHASE 3 — DIRECTORY + COMPLIANCE ✅ COMPLETE

✅ Extended Client model (ABN, bank details, business types incl. Private Person)
✅ Subcontractor/Supplier module (prequalification, categories)
✅ Unified Contact model (polymorphic CLIENT/SUBCONTRACTOR/SUPPLIER)
✅ EntityLicence + EntityInsurance (polymorphic, expiry tracking)
✅ CreditApplication workflow (outgoing + incoming)
✅ Compliance dashboard (expiry alerts, blocked entities)
✅ Worker qualification register (per worker, expiry tracking)
✅ Daily cron (30-day + 7-day alerts to Marco)
✅ Auto-block expired subcontractors on critical items

---

## PHASE 4 — INTEGRATIONS ✅ COMPLETE

✅ SharePoint live (Microsoft Graph API, SHAREPOINT_MODE=live|mock)
✅ Xero OAuth2 (contact sync, invoice from progress claims, CSRF hardened)
✅ MYOB CSV export (CustomerImport + SupplierImport formats)
✅ Auth (M365 SSO + local JWT, Super User tier)
✅ AI providers (Anthropic/Gemini/Groq/OpenAI, configurable)

---

## PHASE 5A — TENDERING MODULE SIGN-OFF (current priority — do this first)

This phase must be completed and signed off by Raj and Sean before
any other development proceeds. The tendering module is the foundation
of the entire ERP — everything else depends on it being correct.

Phase 5A is structured into three sub-phases. 5A.1 + 5A.2 ship first;
5A.3 (workflow review and dependent items) cannot meaningfully run
until the AI persona is available for Raj to test, and the rendered
quote PDFs match Sean's reference templates.

### 5A.1 — AI Infrastructure + Tendering Assistant Persona

This is the conversational AI assistant Raj will use during tendering
workflow review. One persona ("Tendering Assistant" — Sean to confirm
name) active across the whole tendering module, with sub-modes per
route (scope mode = drafting tools; quote mode = advisory; etc.).

🔲 Persona registry architecture
   (Database tables: Persona, PersonaCompanyInstruction,
    UserPersonaSettings. Code registry pattern allowing new personas
    to be added without touching the shell. Conversation persistence
    per persona per user. Permission model: ai.persona.<name> from
    day one.)

🔲 Floating window shell
   (Bottom-right floating button, expand/collapse, available only
    on routes where a persona matches. No fallback persona. Cog
    icon deep-links to AI Settings tab.)

🔲 AI Settings tab — Sean view + user view
   (Sean: company-wide provider access toggles, per-persona
    configuration, global "allow user instruction overrides" toggle.
    User: provider preference, persona settings showing company
    instruction read-only + personal override field if Sean enables.)

🔲 Bring-your-own-key infrastructure
   (User-provided AI provider keys with proper encryption at rest,
    key validation on save, provider isolation per request,
    graceful fallback when user keys fail or expire, full audit
    trail. Storage: encrypted column, key from environment,
    rotation policy. No payment details — users supply their own
    already-billed keys.)

🔲 Tendering Assistant persona — sub-mode tooling
   (Pipeline mode, Register mode, Tender Detail mode: read-only
    knowledge / advisory.
    Scope mode: drawing upload, AI scope-item proposal cards with
    user-confirmed commit, Cutrite rate lookup, IS discipline
    constraint enforcement, conversation history per tender.
    Estimate mode: rate lookup, value suggestions, advisory only —
    user clicks to apply.
    Quote mode: cost line structure suggestions, exclusion / assumption
    suggestions, advisory only.
    Clarifications mode: summarisation, response suggestions.)

### 5A.2 — HTML→PDF renderer migration

Replace the PDFKit-based PDF generator with HTML→PDF rendering using
Puppeteer (or @sparticuz/chromium for serverless). Fixes the
rendering bug class Sean is currently experiencing (header/footer
drift, logo borders, font changes mid-paragraph, text overlapping,
T&C two-column layout broken). Unlocks future template-editor work.

🔲 HTML→PDF renderer infrastructure
   (Puppeteer or equivalent in Docker, rendering pipeline,
    template loading from filesystem or database, font handling,
    page margin/header/footer handling.)

🔲 Quote PDF — HTML template + migration
   (Build HTML/CSS template matching Sean's reference letterhead +
    layout. Sean signs off visual fidelity. Migrate quote PDF
    generation through the new renderer. Existing PDFKit code
    retired only after sign-off. Reference templates at
    C:\ProjectOperations-Reference\ — outside the repo, sensitive
    client data.)

🔲 Variation PDF — HTML template + migration
   (Same approach as quote. Sean's reference template required.)

🔲 Schedule of Rates PDF — HTML template + migration
   (Same approach. Sean's reference template required.)

### 5A.3 — Existing 5A items (workflow review + dependent items)

5A.3 begins after 5A.1 + 5A.2 land. The workflow review (first item
below) cannot meaningfully run until the AI persona is available for
Raj to test, and the rendered quote PDFs match Sean's templates.

🔲 Structured end-to-end tendering workflow review
   Raj walks through the complete workflow:
   - Create tender → build scope → run estimate → generate quote → send PDF
   - Screenshot chat captures every issue, confusion, or missing feature
   - Main development chat analyses and writes fix PRs
   - Repeat until Raj signs off the full workflow

🔲 Fix all issues identified during workflow review (PR per issue group)

🔲 Quote scope grouped-by-discipline drag reorder
   (grouped mode is Raj's primary view — currently static sortOrder.
    Flat mode reorder works. Both modes must support drag reorder.
    API exists, frontend @dnd-kit work only — deferred from PR #72)

🔲 Clarification types — add Call/Email/Meeting/Note as first-class types
   (TenderClarificationNote.noteType column exists from PR #72 migration.
    Full type set deferred from PR #70 — now needs UI completion)

🔲 Tender bulk status update — production validation
   (bulk status update built but needs live test with real tender data.
    Raj is currently blocked on this — prioritised as immediate fix)

🔲 Sites module detail page + hard siteId FK to Tender/Project
   (sites list works, detail page is stub — deferred from PR #76)

🔲 Quote PDF enhancements (post Raj/Marco sign-off):
   - IS licence/certification logos on PDF header
   - IS watermark on pages
   - T&C clause review — Marco to review and approve all 21 clauses
     (blocks PDF being legally valid for client distribution)

🔲 Tendering module signed off by Raj + Sean
   → Gate: nothing in Phase 6+ starts until this sign-off is received

---

## PHASE 5B — DASHBOARD + UI FIXES (parallel with 5A)

✅ Remove duplicate dashboard page under Platform sidebar (PR #92)
✅ Add Safety widget category to dashboard widget picker (PR #96)
✅ Add Compliance widget category to dashboard widget picker (PR #96)
✅ Dashboard builder polish (PR #96):
    - 4-column KPI grid layout (responsive 4 → 2 → 1)
    - Sidebar live-update after dashboard creation (invalidate query cache)
    - Widget picker "Select all / Deselect all" per category
    - Per-widget period override pill (orange when overridden)
    - Drag handle visible on widget cards (baseline opacity 0.5)
    - Inline-editable dashboard name (click → Enter)
🔲 subcontractor_contacts table drop
   (table retained in PR #75 migration, marked deprecated — never dropped.
    Migration risk — move to completed state)

---

## PHASE 5C — FORMS ENGINE UI (follow-up to PR #97)

🔲 Form builder UI
   - Drag-and-drop field canvas (3-panel: palette / canvas / settings)
   - Field palette: all 30+ field types organised by category
   - Field settings panel: config, rules editor, actions editor
   - Condition builder: AND/OR nested groups, all 11 operators
   - Preview mode: live rule evaluation, desktop + mobile view
   - Publish flow: version increment, change summary

🔲 Form submission fill UI
   - Mobile-first layout (FieldLayout pattern)
   - All 30+ field types rendered correctly
   - GPS auto-capture on form load
   - Photo fields: camera capture, thumbnail grid
   - Signature field: canvas draw area
   - Offline fill: IndexedDB save every 30s, sync on reconnect
   - Progress indicator: section N of M
   - Conditional field show/hide in real-time

🔲 PDF export (full)
   - Photos embedded inline
   - Signatures rendered as images
   - IS branding (logo, ABN, colours)
   - Approval chain timeline at bottom
   - QR code linking to digital submission

🔲 Analytics page
   - Submission trend chart (line)
   - Status breakdown (bar)
   - By category (donut)
   - Field completion rates per template
   - Answer distribution for choice fields

---

## PHASE 6 — DEFERRED FROM CHAIN (tech debt)

⏸️  Drag-to-reschedule Gantt UI
    (API supports it — purely frontend @dnd-kit work)
⏸️  Scheduler weekly grid view
⏸️  Worker/WorkerProfile dual model consolidation
    (ResourcesPage still calls /resources/workers — different model)
⏸️  directory.finance inline permission → guard decorator
    (currently inline hasPermission check, not @RequirePermissions)
⏸️  PWA NetworkFirst 24h cache — cross-user stale data on shared devices
    (audit #4 major M14 — deferred, risk on shared field devices)
⏸️  Subcontractor performance rating UI
    (performanceRating 1-5 field exists in schema, no UI or history tracking)
⏸️  Azure Mail.Send permission — production email sending
    (company not ready for Azure integration yet — deferred until tendering
     module is signed off and production launch is planned)
⏸️  Audit script endpoint path corrections
    (Comprehensive audit 2026-04-26 12:02 flagged stale paths in the
     chain audit script: /integrations/xero/status should be /xero/status,
     /maintenance/dashboard should be /maintenance/upcoming,
     /notifications should be /notification/settings. Causes false-
     positive 404s on every chain audit. Update the audit script
     template before next chain run.)
⏸️  Re-enable deploy.yml automatic trigger
    (Workflow disabled to manual-only on 2026-04-27 — was generating
     email noise on every PR because Azure secrets weren't configured.
     Re-enable on:push when production deployment is ready, after
     tendering sign-off (§5A) and Azure secret configuration.)
⏸️  Auto folder creation (SharePoint, Tender → Jobs Won → Lost → Archived
    with T/A-YYMMDD-## naming)
    (Discussed 2026-05-02, deferred until 5A.1 + 5A.2 complete.
     Status-driven SharePoint folder reorganisation.)
⏸️  Estimating window restructure (scope item card → "Add new" group
    population, persistent expandable scope frame, per-grouping filter)
    (Discussed 2026-05-02, deferred until 5A.1 + 5A.2 complete.
     Needs Sean's xls reference + current estimate UI inspection
     before design can be finalised.)
⏸️  Other module personas (Dashboard Master, Captain Operations, etc.)
    (Once Tendering Assistant is signed off, additional personas roll
     out incrementally per module. Architecture from 5A.1 supports
     this without rework.)
⏸️  Module-specific AI tools
    (Per-module action tooling expands as new personas come online.
     Each persona gets its own tool registry.)
⏸️  Security hygiene cleanup — 9 GitHub alerts surfaced 2026-05-02
    (3 transitive npm dep version bumps: serialize-javascript ≥7.0.5
     (closes 2 alerts), postcss ≥8.5.10, uuid ≥14.0.0 (major bump,
     verify tests pass). 3 workflow files missing permissions blocks:
     ci.yml, playwright.yml, deploy.yml — add `permissions: contents: read`
     at workflow level (one block on ci.yml closes 2 alerts). 1 React
     XSS alert on apps/web/src/pages/forms/FormSubmitPage.tsx:459 —
     likely false positive on standard React JSX interpolation, but
     requires reading the file to confirm. None exploitable in current
     architecture: npm vulns are all build-time transitive deps with
     controlled inputs; workflow tokens not actually elevated;
     FormSubmitPage uses standard React text interpolation that auto-
     escapes. Batch into single cleanup PR. Estimated 1–2 hours total.
     Schedule between 5A.1 sub-PRs as a token-budget filler.)
⏸️  Form drafts — Phase 2 (admin CRUD wiring)
    (Phase 1 shipped foundation + 6 user-facing forms in PR #111. ~20
     admin CRUD pages — UsersPage, RolesPage, SubcontractorsPage modals,
     SitesListPage modal, WorkersListPage, ContractDetailPage,
     JobsListPage, ProjectDetailPage edit, MaintenancePage event
     logging, AssetsPage create/edit, master-data CRUD, etc. — were
     deferred per scope decision 2026-04-27 to keep PR #111's surface
     knowable. Each needs the useFormDraft hook + DraftBanner +
     SaveDraftButton wired with appropriate formType / contextKey.
     See docs/form-drafts-inventory.md "Pending review" section.)
⏸️  Form drafts — field timesheet + pre-start integration
    (Existing "Save draft" buttons on FieldTimesheetPage and
     FieldPreStartPage are backend saves to a server-side draft state.
     Need product decision on whether to layer local IDB drafts on top
     or keep backend-only. Deferred from PR #111 inventory pass.)
⏸️  FormSubmitPage dead code removal
    (Route /forms/submit/:templateId is mounted in App.tsx but no
     navigates/links anywhere in the codebase point to it. Superseded
     by FormFillPage. Verified during PR #111 inventory. Separate
     dead-code cleanup PR.)

---

## PHASE 7 — NEXT FEATURE PRIORITIES

🔲 Field worker competency gate on job allocation — COMPLIANCE CRITICAL
    (before worker can be allocated to a job, check WorkerQualification
     against job requirements. Block allocation if critical quals missing
     or expired — e.g. cannot allocate worker without asbestos_b licence
     to an asbestos removal job. IS legal obligation.)

🔲 Automated timesheet → payroll export
    (approved timesheets → CSV export for payroll system.
     Amy currently processing manually. High operational impact.)

🔲 Plant/equipment utilisation reporting
    (track hours per asset, utilisation rate, cost per job.
     Matthew needs for warehouse/asset management.)

🔲 Supplier credit account management
    (incoming CreditApplication workflow exists but no UI for tracking
     supplier account numbers, credit limits, statement dates.
     Activate when commercial modules go live — after tendering sign-off.)

🔲 Subcontractor portal (/portal/sub)
    - Separate JWT auth (type: subcontractor_portal)
    - Read-only: jobs assigned, documents, prequalification status
    - Upload: SWMS, insurance certificates, licence renewals
    - Invite flow from IS admin (same pattern as client portal)

🔲 Custom dashboard widget builder
    - User selects data source (any entity in the system)
    - User selects fields, display type (table/pivot/chart)
    - Filters and groupings
    - Like Excel pivot tables scoped to IS data

🔲 Calendar sync
    - Google Calendar integration
    - Microsoft Calendar integration
    - Sync: jobs, scheduler shifts, leave, site visits

🔲 Two-way email reply parsing
    - Outlook/Gmail webhook
    - Parse replies to IS emails → attach to tender/project/clarification
    - Notify relevant staff

🔲 MYOB live integration
    - OAuth2 (MYOB AccountRight API)
    - Contact sync (customers + suppliers)
    - Invoice push from progress claims
    - Bank feed reconciliation (future)

🔲 Web Push notifications
    - Field worker alerts (allocation changes, pre-start reminders)
    - Compliance alerts to Marco
    - Safety incident alerts
    - Requires VAPID keys + service worker subscription

🔲 WebSockets (real-time updates)
    - Live scheduler updates when allocations change
    - Live safety incident feed for Marco
    - Live timesheet status for supervisors

🔲 Ghost cut / block weight calculation
    (Cutrite-specific — calculate ghost cuts for complex shapes,
     block weight from density × volume for lifting/demolition planning.
     Lower priority within Phase 7.)

---

## PHASE 8 — FUTURE / UNSCOPED

🔲 Subcontractor rate cards (link to estimate rates)
🔲 Asset GPS tracking (plant location, not worker)
🔲 Document OCR (extract data from uploaded PDFs)
🔲 Automated progress claim generation (from timesheet + scope data)
🔲 Client portal — progress photos (field workers upload → client sees)
🔲 Tender win/loss analytics (ML scoring on historical data)
🔲 Multi-company support (if IS acquires or merges with another entity)
🔲 SWMS builder (digital SWMS creation, not just upload)
🔲 Form builder enhancements (conditional logic, signatures, GPS stamp)
🔲 Maintenance scheduling automation (based on asset usage hours)

🔲 Structured asbestos register per site
    (sites have knownHazards text field — replace with structured register:
     material type, location, quantity, friability rating, removal records,
     air monitoring results, clearance certificates)

🔲 Tender win/loss debrief module
    (capture why tenders were won/lost, competitor pricing, lessons learned.
     Feeds into AI scope drafting improvement over time.)

🔲 Automated progress claim generation
    (approved timesheets + scope data → draft progress claim.
     Reduces Amy's manual work on billing.)

🔲 Plant/equipment GPS tracking
    (asset location tracking — distinct from worker GPS.
     Requires hardware integration.)

---

## CHANGELOG

### 2026-04-25 — Initial roadmap created
Phases 1-4 marked complete based on PR chain #80-#91.
Phase 5 immediate fixes identified from post-chain review.
Phase 6 deferred items carried over from audit findings and PR notes.
Phases 7-8 sourced from original vision spec and roadmap discussions.

### 2026-04-25 — Roadmap gap analysis + reprioritisation
Full cross-reference of roadmap against all PRs (#1-#93), audit findings,
deferred items from PR bodies, and session conversation history.

New Phase 5A added: Tendering module sign-off (must complete before
anything else proceeds). Phase 5 renamed to 5B.

Items added: 15 new items across phases 5A, 5B, 6, 7, 8.
Items reprioritised:
  - Field worker competency gate → Phase 7 top priority (compliance risk)
  - Timesheet payroll export → Phase 7 (Amy operational impact)
  - Plant utilisation reporting → Phase 7 (Matthew operational impact)
  - Supplier credit management → Phase 7 (activate post tendering launch)
  - Ghost cut / block weight → Phase 7 lower priority
  - Azure Mail.Send → deferred (company not ready for Azure yet)
  - Bulk status update → Phase 5A (Raj currently blocked)
  - Quote grouped drag reorder → Phase 5A (Raj primary workflow)
  - Asbestos register → Phase 8 (structured, not just text field)

### 2026-04-26 — Forms Engine shipped (PR #97); Phase 5B complete
PR #97 shipped the Forms Engine backend: schema extensions to FormTemplate
/Section/Field/Submission/Value, 3 new tables (FormApproval / FormTriggeredRecord
/ FormSchedule), full RulesEngineService (11 operators, AND/OR nested condition
groups, validation, asbestos compliance gate) with 17 unit tests, FormsEngineService
submission pipeline (validate → gates → on_submit actions → triggered records →
approval chain), 8 IS system templates seeded idempotently. Builder UI, full
submission UI, PDF export, and analytics dashboard moved to Phase 5C as a
follow-up PR.

PR #92 / #96 cleared all four Phase 5B dashboard items: duplicate sidebar
entry removed, Safety + Compliance widget categories added (4 widgets each),
KPI grid responsive 4-col layout, period override pill, drag handle visibility,
inline name editing, sidebar live-update.

### 2026-04-27 — Post-PR-111 doc cleanup
PR #111 (FIX 4 form drafts) logged in progress.md.
PHASE 6 PWA entries (OfflineProvider boundary, SW autoUpdate race,
Dead-letter UX) removed — shipped by PR #108 on 2026-04-26.
Audit script endpoint path corrections added to PHASE 6 from the
2026-04-26 comprehensive audit medium-priority finding.

### 2026-04-27 — Deploy workflow disabled
.github/workflows/deploy.yml changed from on:push:main to
on:workflow_dispatch (manual-only). Was failing on every push because
Azure secrets aren't configured yet — generating email noise. Re-enable
the push trigger when production deployment is wired up post §5A
sign-off. Tracked in PHASE 6.

### 2026-05-02 evening — Phase 5A scope expansion
Product session worked through 7 tendering enhancement ideas. Five
expand 5A scope (now ~15 sub-PRs before sign-off): AI persona
infrastructure, AI settings, bring-your-own-key, Tendering Assistant
persona with sub-mode tooling, HTML→PDF renderer migration. Two
ideas (auto folder creation, estimating window restructure) deferred
to Phase 6. Architectural decisions documented in
project_instructions.md §13. Critical reasoning captured: HTML→PDF
chosen over template-editor approaches because Sean's "persistent
formatting issues" are mostly rendering bugs in PDFKit code, not
design preferences. Replacing the renderer fixes the bug class and
unlocks future editor work. AI persona built with one persona at a
time approach — Tendering first, others post-sign-off — to keep
scope manageable while preserving the "personas everywhere" vision.
Same session captured 9 GitHub security alerts (3 npm transitive
dep vulns + 3 workflow files missing permissions blocks + 1 React
XSS likely false positive) as a PHASE 6 cleanup chore.
