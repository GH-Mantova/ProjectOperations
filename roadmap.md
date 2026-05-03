# ProjectOperations — Roadmap

Last updated: 2026-05-03 05:50 AEST

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

✅ Persona registry architecture — PRs #117 + #136 (COMPLETE)
   (Database tables: Persona, PersonaCompanyInstruction,
    UserPersonaSettings. Code registry pattern allowing new personas
    to be added without touching the shell. Conversation persistence
    per persona per user. Permission model: ai.persona.<name> from
    day one.

    PR #117 delivered the registry foundation. PR #136 closes the
    last 20% — conversation persistence per (user, personaSlug,
    subMode, contextKey) via the new Conversation +
    ConversationMessage tables. Auto-resume of the most recent
    thread on panel open; New conversation button; History list with
    delete; failed/interrupted streams don't pollute history.
    Retention is forever — deletion is user-initiated only.)

🔲 Floating window shell
   (Bottom-right floating button, expand/collapse, available only
    on routes where a persona matches. No fallback persona. Cog
    icon deep-links to AI Settings tab.)

🔲 AI Settings tab — Sean view + user view
   (Sean: company-wide provider access toggles, per-persona
    configuration, global "allow user instruction overrides" toggle.
    User: provider preference, persona settings showing company
    instruction read-only + personal override field if Sean enables.)

✅ Bring-your-own-key infrastructure — PR #134 (encryption + UI layer COMPLETE)
   (User-provided AI provider keys with proper encryption at rest,
    key validation on save, provider isolation per request,
    graceful fallback when user keys fail or expire, full audit
    trail. Storage: encrypted column, key from environment,
    rotation policy. No payment details — users supply their own
    already-billed keys.

    PR #134 delivered: AES-256-GCM encryption (KeyEncryptionService,
    BYOK_ENCRYPTION_KEY master); live key validation with 5s timeout
    + sanitiseProviderError categorisation; new *KeyEncrypted columns
    on PlatformConfig + User; resolveProviderConfig prefers user key
    then company key (no env fallback); 8 endpoints under
    /api/v1/ai-settings (company + user, save/delete/list); UI on
    Company tab and My Settings tab with modal validate-on-save flow.
    Audit logs record key save/delete/use with userId+provider+source
    only — never the key itself.

    Outstanding (deferred): key rotation policy; dedicated audit log
    dashboard (logs go to structured logging today); Gemini/Groq
    validation methods (throw "not yet implemented" until those
    providers ship).)

◐ Tendering Assistant persona — sub-mode tooling (PARTIAL — PR #137)
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

   PR #137 (PR A in series) shipped: provider-agnostic tool calling
   for both Anthropic (tool_use) and OpenAI (function/tool calls);
   propose_scope_items tool with IS-discipline constraint at the
   schema level; ConversationMessage.metadata JSONB column +
   tool_call/tool_result roles; ProposalCardList UI with
   Accept/Edit/Reject + bulk actions; chat dispatch wires all of
   this; 32 new API tests + 52 new web tests (DB-independent
   verification — full DB-dependent smoke pending Marco).

   Remaining in this Item 5 sub-area:
   - PR B: delete legacy "Draft scope with Claude" code path.
   - PR C: drawing upload feeding scope inference.
   - PR D: Cutrite rate lookup + IS discipline lookup tables.
   - Estimate / Quote / Clarifications mode tools (separate PRs
     once Scope is fully signed off by Raj).

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
✅  Security hygiene cleanup — 9 GitHub alerts surfaced 2026-05-02
    Closed by PR #128 (overnight chain PR B). 3 npm overrides
    (serialize-javascript ≥7.0.5, postcss ≥8.5.10, uuid ≥10.0.0
     <11.0.0). 3 workflow files (ci.yml, playwright.yml, deploy.yml)
    gained `permissions: contents: read` blocks. 1 React XSS CodeQL
    alert (#6 FormSubmitPage) dismissed as false positive — React
    text interpolation auto-escapes. uuid couldn't go to ≥14.0.0 as
    originally specced (v11+ are ESM-only and break Jest in our
    CommonJS setup). Pinned to last CJS-compatible major (10.x).
    Risk note: if the buffer-bounds CVE was patched only in v11+,
    Dependabot may keep the alert open; mitigated by the fact that
    no direct uuid imports exist in our code (purely transitive via
    @azure/msal-node and exceljs, both v4-only callers). One new
    CodeQL alert (#9, js/xss-through-exception on
    personas.controller.ts chat endpoint) discovered during
    investigation — also a false positive (SSE responses aren't
    HTML-rendered) but deferred per chain rule "DO NOT touch §5A.1
    code". Tracked separately below.

✅  CodeQL alert #9 — js/xss-through-exception on personas.controller chat endpoint
    Closed by PR #131 with a defence-in-depth fix rather than a pure
    suppression. New error-sanitiser.ts maps provider/network/exception
    text into 7 categorised user-facing messages (auth, rate-limit,
    quota, server, network, config, unknown). Raw error text is logged
    server-side for ops debugging but never reaches the client. Closes
    the rule's actual concern (exception text reinterpreted as HTML)
    structurally — even if a future frontend renderer were unsafe, the
    user message is now a hardcoded string from our list, not provider
    output. Also closed re-raised CodeQL alert #10
    (js/xss-through-dom on FormSubmitPage.tsx:459, the same false
    positive as previously-dismissed #6) — proper inline `codeql[…]`
    suppression directive applied + dismissed via gh API.
✅  Audit M1 — Xero error sanitisation (2026-05-02 system audit)
    Closed by PR #135. Same defence-in-depth pattern as PR #131
    extended to xero.service.ts catch blocks. Three reflection
    sites (syncContact, syncAllContacts results aggregation,
    createInvoiceFromProgressClaim) now route upstream errors
    through sanitiseProviderError. BadRequestException carries the
    categorised user message with "Xero sync:" / "Xero invoice
    push:" prefix; full original error logged server-side with
    category prefix and stored in xeroSyncLog.errorText. Frontend
    rendering remains JSX (auto-escaped) so this was not exploitable
    today — the fix is structural defence-in-depth at the API
    boundary. 12 new tests verify no raw text reaches the thrown
    message across script/HTML/keyword/network/unknown shapes.
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
⏸️  RTL adoption for frontend component tests
    (Currently using a logic-helper pattern only — pure functions
     tested in isolation. RTL not installed; component rendering
     and interaction not tested. Surfaced repeatedly during §5A.1
     PRs #119, #120, #121, #123, #124, #125 as a recurring deviation.
     When RTL is added, retrofit existing persona components for
     proper rendering tests.)
⏸️  Background dev:api orphan processes — TaskStop on parent shell
    doesn't propagate to Nest child
    (Observed in PR #120, PR #121, PR #123 where the agent had to
     manually kill PIDs (e.g. 25320, 46996, 57512) on port 3000 left
     from previous pnpm dev:api background tasks. Worth investigating
     whether pnpm dev:api should set up proper signal handling, or
     whether the run script should use a process manager that
     propagates SIGTERM correctly.)
⏸️  Replace catch-all redirect with explicit 404 page in App.tsx
    (App.tsx currently has <Route path="*" element={<Navigate to="/"
     replace />} /> which silently bounces unknown URLs to operations
     overview. Better: render a proper "Page not found" component
     that tells users they hit an unknown route. Caught during PR
     #120 visual smoke when /admin/ai-settings 404 was masked as a
     navigate-to-/ bug. Project-wide UX issue, not §5A.1-specific.)
⏸️  Refine Tendering persona sub-mode coverage for utility routes
    (/tenders/clients, /tenders/contacts, /tenders/settings,
     /tenders/reports currently match as 'tender-detail' sub-mode.
     Acceptable while sub-modes have empty toolSlots, but when tools
     are wired in §5A.1 PRs 11+ these routes need their own sub-modes
     or a 'utility' fallback. Discovered during PR #120 audit.
     PR #126's register/pipeline collapse pattern is the template.)
⏸️  Investigate user-level default AI provider
    (Currently provider override is per-persona only — no user-wide
     default. Discovered during PR #121 review when "My Provider
     Preference" couldn't be implemented as originally specced
     because the schema doesn't support it. May or may not be
     needed; investigate when more personas exist post-§5A.1.)
✅  Reconcile AI provider model defaults across codebase
    Closed by PR #129 (overnight chain PR C). PlatformConfig.DEFAULT_MODELS
    is now the single source of truth — DEFAULT_MODELS.openai bumped
    from 'gpt-4o-mini' to 'gpt-5.4-mini'. The §5A.1 ai-providers
    service imports DEFAULT_MODELS directly; the redundant
    ANTHROPIC_DEFAULT_MODEL / OPENAI_DEFAULT_MODEL constants in the
    new providers were removed. Legacy tendering AI scope drafting
    (apps/api/src/modules/tendering/ai-providers/) still has its
    own per-file constants — not touched per legacy-migration deferral
    from PR #122. Will be addressed when AI scope drafting migrates
    to the persona system.
⏸️  Audit migration history vs current schema
    (Pre-existing drift noted during PR #117: stray
     workers.employmentType compat column from migration
     202604020004_worker_employmenttype_compat, plus FK/default
     normalisations. Trimmed out of PR #117's migration. Bundled
     again in PR #126 attempts. Worth a focused cleanup PR that
     audits all migration files vs current schema.prisma and either
     adds a clean-up migration or formalises the drift as
     intentional.)
⏸️  Consolidate .env files — root vs apps/api/.env duplication
    (Both root .env and apps/api/.env exist. The API server reads
     from apps/api/.env (per investigation in May 2 session).
     Determine canonical location, document in setup guide, remove
     or symlink the redundant copy. Caused real confusion during
     PR #123 manual smoke when ANTHROPIC_API_KEY was added to root
     but not apps/api/.env.)
⏸️  Tender detail tab sub-modes use internal state, not URL
    (TenderDetailPage tabs (Overview, Scope, Estimate, Quote,
     Clarifications) use internal React state rather than syncing
     to ?detail= query param. Persona sub-modes for scope/estimate/
     quote/clarifications were defined assuming ?detail= but never
     activate because URL never changes. Same architectural mismatch
     as register/pipeline (fixed in PR #126). Decision needed when
     wiring per-tab tools in §5A.1 PRs 11+: either sync tabs to
     ?detail= URL OR collapse sub-modes to match the URL space.
     Currently functional — chat works, just frames itself as
     "tender-detail mode" for all tabs.)
⏸️  Provider implementation consolidation
    (apps/api/src/modules/tendering/ai-providers/ holds ClaudeProvider,
     OpenAiProvider, MockAiProvider for one-shot scope drafting.
     apps/api/src/modules/ai-providers/providers/ holds AnthropicProvider,
     OpenAiProvider for streaming chat. Different APIs (one-shot JSON
     vs streaming SSE), different use cases — not bug-level duplication,
     but future refactor candidate. Could collapse to a single provider
     abstraction supporting both modes. Surfaced as PR #132 deviation
     3 and audit 2026-05-02 finding o4. Estimated 2-4 hours when
     prioritised.)
✅  Migrate AI scope drafting to persona system — PR #132
    Originally PHASE 6 entry implied by PR #122 investigation
    (docs/legacy-ai-providers-investigation.md). tender-scope-drafting
    .service.ts migrated from UserAiProvidersService to the new
    persona-based AiProvidersService.resolveProviderConfig (slug
    "tendering"). Legacy infrastructure deleted: UserAiProvidersService
    (apps/api/src/modules/user-ai-providers/), AiProviderSelector
    (apps/web/src/components/ai/), the My Account "AI providers"
    section, AnthropicKeyModal, AddPersonalProviderModal,
    user_ai_providers and user_ai_preferences tables. Net -1,456 LOC.
    Audit 2026-05-02 confirmed clean cleanup — only one comment-only
    mention remains in tender-scope-drafting.service.ts:20 as the
    historical audit trail.

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
