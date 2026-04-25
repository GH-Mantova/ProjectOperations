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

## PHASE 5 — IMMEDIATE FIXES (next sprint)

🔲 Remove duplicate dashboard page under Platform sidebar
🔲 Add Safety widget category to dashboard widget picker
🔲 Add Compliance widget category to dashboard widget picker
🔲 Dashboard builder polish:
    - 4-column KPI grid layout
    - Sidebar live-update after dashboard creation
    - Widget picker "Select all / Deselect all" per category
    - Per-widget period override pill (orange when overridden)
    - Drag handle visible on widget cards

---

## PHASE 6 — DEFERRED FROM CHAIN (tech debt)

⏸️  Drag-to-reschedule Gantt UI
    (API supports it — purely frontend @dnd-kit work)
⏸️  Scheduler weekly grid view
⏸️  OfflineProvider boundary (PWA — audit #4 major)
⏸️  SW autoUpdate race condition (PWA — audit #4 major)
⏸️  Dead-letter UX for failed syncs (PWA — audit #4 major)
⏸️  Worker/WorkerProfile dual model consolidation
    (ResourcesPage still calls /resources/workers — different model)
⏸️  directory.finance inline permission → guard decorator
    (currently inline hasPermission check, not @RequirePermissions)

---

## PHASE 7 — NEXT FEATURE PRIORITIES

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

---

## CHANGELOG

### 2026-04-25 — Initial roadmap created
Phases 1-4 marked complete based on PR chain #80-#91.
Phase 5 immediate fixes identified from post-chain review.
Phase 6 deferred items carried over from audit findings and PR notes.
Phases 7-8 sourced from original vision spec and roadmap discussions.
