# ProjectOperations — Roadmap
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
