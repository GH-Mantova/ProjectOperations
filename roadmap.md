# ProjectOperations — Roadmap

Last updated: 2026-06-02 07:57 AEST

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

   PR #141 (foundation) shipped: multi-turn agent loop with 10-turn
   cap, 8-parallel-call cap, error-as-tool-result; ToolHandlerRegistry
   pattern; Anthropic + OpenAI adapter image-content support;
   visibility column on conversation_messages; propose_scope_items
   migrated to the new registry; test-fixture handlers
   (_test_get_current_time, _test_get_test_image) for end-to-end
   loop verification.

   PR #142 shipped: three drawing tools (list_tender_drawings,
   extract_drawing_titleblock, read_tender_drawing) registered on
   tendering.scope; system prompt overhaul with five IS scope codes
   (SO/Str/Asb/Civ/Prv) and explicit strip-out vs fit-out
   disambiguation that fixes the PR #141 step-2 false refusal;
   asbestos register cross-reference workflow; drawing-reading
   conventions derived from analysis of five real consultant
   drawings. ToolHandlerContext.toolUseId added (PR #141 deviation
   fix). Hard regression test against real Anthropic API
   (CI-safe — skips when key absent).

   PR #143 shipped: drawing tools bound to all six Tendering
   Assistant sub-modes (drawings are reference material, useful
   from any context); propose_scope_items remained scope-only.
   Hoisted TENDERING_SUB_MODES constant. 13 binding assertions.
   Closed the PR #142 step-1 smoke failure (tools not reaching
   the model when subMode defaulted to "register").

   PR #144 shipped: tender-context injection in the system prompt.
   When a tender-scoped sub-mode (tender-detail / scope / estimate
   / quote / clarifications) has a contextKey, the prompt is
   prefixed with the tender's display code (tenderNumber) + CUID
   + an explicit instruction to pass the CUID to tools, not the
   code. Fixes the PR #143 follow-up where the model called
   list_tender_drawings with "IS-T020" (display code) and was
   rejected as malformed CUID.

   PR #145 shipped: list_tender_drawings filter pivoted from
   tender_document_links.category (PR #142 misread the field —
   it describes what the document is LINKED TO, not what TYPE it
   is) to mime-type (PDF/PNG/JPEG) plus filename extension
   fallback. Real demo drawings have category="tender" and were
   silently excluded by the PR #142 allowlist; the new filter
   includes them. pageCount dropped from per-listing PDF parse
   path (defeated the cheap-listing design goal); PHASE 6
   carry-forward captures the upload-time caching idea.

   PR #146 shipped: SharePointAdapter interface extended with
   downloadFileBytes; MockSharePointAdapter persists bytes to
   local disk on uploadFile and reads them back; SharePointService
   adds audit-logged downloadFileBytes; DrawingToolsAccessService
   rewired through the service (was using a fetch-against-fake-URL
   path that always failed); SharePointFileNotFoundError typed
   error so handlers produce a specific user-facing message for
   missing-content vs generic storage failures; seed script
   generates a synthetic 2-page demo PDF for IS-T020. Closes the
   PR #142/#143/#144/#145 manual smoke step 2-7 blocker.

   PR #147 shipped: dispatcher captures full tool-result content
   (including image bytes) in memory after tool execution; on the
   immediate next turn it splices those full-content blocks into
   the messages array, replacing the DB-rebuilt versions for the
   matching toolUseIds. Older turns continue to use DB rebuild
   with the "[image not replayed — call the tool again to refresh]"
   marker — correct for those turns since the model already saw
   the image when it was new. Seed gains size_bytes population on
   the IS-T020 demo drawing's file_link row by computing
   Buffer.byteLength before the upsert (was null prior — cosmetic).
   Closes the PR #142/#146 smoke step 4 blocker where the model
   reported "not replayed" instead of describing the drawing.

   Drawing-tools sub-task gates (PR #142 + #143 + #144 + #145 +
   #146 + #147) are now all complete on the backend; pending
   Marco's fresh-conversation smoke from re-seeded state to confirm
   end-to-end.

   PR #148 shipped: `lookup_rate` tool for cutting + core hole
   rate types. Read-only — returns live schedule rates as chat
   output, does not write to estimate items. Bound to
   tendering.scope and tendering.estimate sub-modes. Cutting uses
   exact-schedule lookup (equipment / elevation / material /
   depthMm); core holes use base rate per diameter with IS
   elevation multiplier applied (Floor=1.0×, Wall=1.1×,
   Inverted=2.0×). System prompt extended with
   RATE_LOOKUP_CONVENTIONS. Two hard regression tests gate against
   prompt regression (skip without ANTHROPIC_API_KEY). 14 handler
   unit tests + 6 binding tests.

   PR #149 (fix-forward on PR #148) shipped: broadened
   lookup_rate binding to ALL FIVE tender-scoped Tendering
   sub-modes (tender-detail, scope, estimate, quote,
   clarifications) and strengthened RATE_LOOKUP_CONVENTIONS into
   an explicit "RATE LOOKUP — MANDATORY POLICY" block that
   forbids ranges, year-stamped market references
   ("SEQ 2024-25"), market-knowledge estimates, and pre-emptive
   figures. Discovery: PR #148 smoke caught the model fabricating
   "$35-$65 per linear metre" with fake "SEQ, 2024-25" citations
   from the tender-detail tab where lookup_rate was unbound —
   identical fabricated numbers two runs in a row. Two safeguards
   were needed: (1) bind the tool wherever a rate question can
   plausibly arise, not just where rates are obviously the topic;
   (2) make the prompt prohibitions unambiguous about market
   knowledge being off-limits. Register sub-mode stays unbound
   (tender list view, no specific tender from which to ask).
   +7 tests (5 sub-mode policy distribution + register exclusion
   + forbidden-pattern check); 432 passing total.

   Remaining in this Item 5 sub-area:
   - ✅ PR B (shipped 2026-05-24): legacy "Draft scope with Claude"
     code path deleted. See §5A.1 PR B changelog entry below.
   - ✅ PR D (shipped 2026-05-24): propose_estimate_items —
     estimate-creation tool. Mirrors propose_scope_items end-to-end;
     bound to the estimate sub-mode only; system prompt mandates
     lookup_rate first for every rate. See §5A.1 PR D changelog entry
     below.
   - ✅ PR E (shipped 2026-05-24): propose_quote_content +
     list_tender_quotes — quote-content tools. Mirrors PR D end-to-end;
     bound to the quote sub-mode only; the model proposes cost-line
     structure / exclusions / assumptions into an existing
     ClientQuote (DRAFT only); never invents a cost-line price.
     See §5A.1 PR E changelog entry below.
   - ✅ PR F (shipped 2026-05-24): propose_clarifications +
     list_tender_clarifications — clarifications tools. Mirrors PR E
     end-to-end; bound to the clarifications sub-mode only. Three
     discriminated proposal kinds (new_rfi, new_note, rfi_response)
     with cross-tender + already-responded integrity checks. Also
     folded in a labour-unit correction in lookup-rate
     (AUD per hour → AUD per day per IS §10 Qty × Days × Rate
     formula). See §5A.1 PR F changelog entry below.
   - ✅ PR G (shipped 2026-05-24): `read_asbestos_register` —
     read-only persona tool that auto-detects the register attached
     to a tender (by filename keyword: asbestos register / hazmat /
     ACM survey / Division 6) and extracts its content. Handles
     PDF (text layer + scanned-image fallback for the first 3
     pages), single-page image, XLSX (every sheet's rows
     tab-delimited), and DOCX (raw text via mammoth). Bound to all
     six Tendering Assistant sub-modes — register cross-reference
     is reference material, like the drawing tools. After this PR,
     Tendering Assistant sub-mode tooling is **complete**. See
     §5A.1 PR G changelog entry below.
   - ✅ PR H (shipped 2026-05-24): lookup_rate extended to all
     remaining rate types (labour, plant, waste, fuel, enclosure,
     other). Same handler pattern as cutting/core_hole; additive
     to the rateType enum, input-schema sub-objects, dispatch
     branches, and the RATE_LOOKUP system-prompt block. See
     §5A.1 PR H changelog entry below.

### 5A.2 — HTML→PDF renderer migration

Replace the PDFKit-based PDF generator with HTML→PDF rendering using
Puppeteer (or @sparticuz/chromium for serverless). Fixes the
rendering bug class Sean is currently experiencing (header/footer
drift, logo borders, font changes mid-paragraph, text overlapping,
T&C two-column layout broken). Unlocks future template-editor work.

✅ HTML→PDF renderer infrastructure (PR #220 — 2026-05-25)
   PdfRenderingModule with PdfRendererService (Puppeteer 23.x,
   bundled Chromium). Template loading, {{key}} interpolation,
   IS brand fonts (Outfit + Syne), concurrency guard, typed errors.
   18 tests (6 defaults + 8 template helpers + 4 integration).

✅ Quote PDF — HTML template + migration (2026-05-25)
   PDFKit builder deleted. HTML builder (quote-html.builder.ts)
   produces full quote document via PdfRendererService. Both consumers
   migrated (QuotePdfService + EstimateExportService). 9 new tests.
   Sample PDFs at docs/samples/ for Sean's visual sign-off.
   **Sean + Raj reviewed and approved the Quote PDF visual fidelity on
   2026-05-26 — this §5A.2 sub-item is signed off.**

⏸️ Variation PDF — HTML template + migration
   (Same approach as quote. Sean's reference template required.)
   DEFERRED: Pushed back until the Scheduler / Job-allocation track
   catches up (owner decision, 2026-05-26). The PDFKit-based Variation
   PDF continues to render via the legacy path until then.

⏸️ Schedule of Rates PDF — HTML template + migration
   (Same approach. Sean's reference template required.)
   DEFERRED: Pushed back until the Scheduler / Job-allocation track
   catches up (owner decision, 2026-05-26). The PDFKit-based Schedule
   of Rates PDF continues to render via the legacy path until then.

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

✅ Quote scope grouped-by-discipline drag reorder — PR #287 (2026-06-02)
   (grouped mode is Raj's primary view — was static sortOrder. Within-
    discipline reorder now ships via @dnd-kit using the existing
    reorder endpoint; cross-discipline drag is rejected at drop time.
    Flat-mode reorder unchanged.)

🔲 Clarification types — add Call/Email/Meeting/Note as first-class types
   (TenderClarificationNote.noteType column exists from PR #72 migration.
    Full type set deferred from PR #70 — now needs UI completion)

🔲 Tender bulk status update — production validation
   (bulk status update built but needs live test with real tender data.
    Raj is currently blocked on this — prioritised as immediate fix)

🔧 Sites module detail page + hard siteId FK to Tender/Project
   — Detail page ✅ PR #288 (2026-06-02): /sites/:id KPI strip, tabs
     (Overview/Tenders/Projects/Documents), inline Edit + Delete.
   — Hard siteId FK still 🔲 pending as a follow-up.

🔧 Tender & quote delete + edit — PR #227 (2026-05-26)
   Hard delete for tenders and quotes with responsible safeguards:
   Prisma cascade (onDelete: SetNull for SafetyIncident/HazardObservation
   FKs, Cascade for all owned children); audit log written BEFORE row
   removal; permission-gated behind tenders.manage; preflight endpoint
   returns cascade counts for UI confirmation dialog; AWARDED/CONTRACT_ISSUED
   tenders require typing the tender ref to confirm. Edit endpoints already
   existed — no changes needed.

🔲 Quote PDF enhancements (post Raj/Marco sign-off):
   - IS licence/certification logos on PDF header
   - IS watermark on pages
   - T&C clause review — Marco to review and approve all 21 clauses
     (blocks PDF being legally valid for client distribution)

🔲 PR A — Tendering: density as Rates & Lists lookup
   New `EstimateMaterialDensity` model + seed of 13 IS-relevant defaults +
   admin UI section + Material dropdown on the scope item form. Density input
   becomes read-only and looked-up. Replaces the per-item free-text density.

🔲 PR B — Tendering: card-header summaries + override highlight + proportional cost appropriation
   Three interlocking pieces. (1) Shared override-highlight design token
   (`--surface-override`) and revert icon, adopted across dimension overrides +
   new summaries + T&C clauses. (2) Per-card header zone shows peak crew +
   total person-days + per-equipment plant peak + card duration, all
   overridable. (3) Quote Edit adjustments distribute proportionally across
   cost lines by their share of the un-overridden total; no compounding, no
   mutation of the underlying base values.

🔲 PR C — Tendering: floating bulk editor for Assumptions / Exclusions (Alt+A)
   New top-right anchored resizable panel reachable from Overview + Scope of
   Works tabs (hidden on Quote). Writes through to the same
   `TenderAssumption` / `TenderExclusion` data; size persists per user.

✅ PR D — Tendering: unified communications panel — PR #260 (2026-05-29)
   Replaced the separate Activity timeline + Clarifications & Communications +
   Follow-ups panels with one `TenderEntry`-backed panel. Type dropdown
   (Note / RFI / Email / Call / Meeting / Follow-up / Self-reminder / Task)
   drives conditional fields (due date, assignee, status). Task-assignment
   notification scaffolding shipped (in-app + email hooks); full delivery
   wired in a follow-up. Legacy tables retained one release cycle then
   dropped in a follow-up PR. Idempotent backfill migration copies historical
   rows from the legacy tables on first deploy.

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

✅  PR B1 (backend) — ScopeCard cardNumber + card-CRUD endpoints (2026-05-16)
    Schema + service + endpoint layer for cards-as-tabs. ScopeCard gains a
    cardNumber Int column unique per (tenderId, discipline); item wbsCodes
    migrated from flat (DEM1, DEM2, DEM3) to hierarchical dotted form
    (DEM1.1, DEM1.2, DEM1.3) via the 20260516200000_scope_card_number
    migration. Migration's first step uses ROW_NUMBER() OVER (PARTITION BY
    card_id ORDER BY sort_order, created_at) to renumber legacy item_number
    values that had collisions from the pre-A1 per-discipline counter.
    Service gains: listCards, createCard (cardNumber=MAX+1 in discipline),
    renameCard, changeCardDiscipline (atomic — reissues cardNumber, renumbers
    items, cascades cutting + waste wbsRef in a $transaction), deleteCard
    (409 if items exist), reorderCards (bulk sortOrder update),
    createItemInCard (per-card itemNumber). 6 new REST endpoints under
    /tenders/:tenderId/scope/cards. 15 new tests. Frontend continues using
    legacy ScopeOfWorksTab against pre-B1 contract — dotted wbsCodes render
    fine as plain strings in the existing table. No user-visible change
    beyond the dotted codes.

✅  PR B1.8 — Plant qty/days width + draggable/minimisable Tendering Assistant (2026-05-17)
    Two small fixes in one PR. (1) ScopeQuantitiesTable PlantCluster qty +
    days input widths bumped 44px → 64px so two- and three-digit values
    aren't clipped (cluster still 280px; rate dropdown's flex: 1 absorbs
    the change). (2) PersonaWindow ("Tendering Assistant" floating bubble)
    is now draggable from its header bar (when open) or from the entire
    pill button (when minimised); a new minimise affordance collapses the
    panel to the pill while keeping the saved position, and × resets the
    bubble to the default bottom-right corner. Position + minimised state
    persisted to localStorage per persona+sub-mode key. Viewport clamp
    runs on drag, on resize, and on minimise/open swap. Pointer events
    handle mouse + touch + pen. 10 new helper tests
    (clampWindowPosition + personaWindowStorageKeys). Tests: 138 → 148.

✅  PR B1.7 — Collapsible items + shared subtable notes + tooltip dropdowns (2026-05-16)
    Each scope item becomes a collapsible card: header bar (chevron / WBS /
    description / per-row $ / delete) when collapsed; full multi-section
    layout when expanded (Men/Days + Plant N flex-wrap clusters, waste grid,
    full-width notes). Cutting and Waste subtables drop their per-row notes
    inputs and gain a single shared notes block at the bottom, persisted to
    ScopeCard.cuttingNotes / ScopeCard.wasteNotes (new nullable columns).
    Two reusable components introduced in apps/web/src/components: TooltipSelect
    (native browser title-tooltip on long option labels) and NotesField
    (4-row textarea + expand-to-modal with Esc/backdrop/⌘+Enter handling).
    Fixes two B1.6 regressions: empty Plant dropdown (PlantRate field was
    `item`, not `name`) and "Add row" 400 (new CreateScopeItemInCardDto
    makes discipline server-derived and rowType optional, defaulting to
    "general-labour"). Tests: 498 → 505. Follow-up B1.7.1 will surface
    per-row $ totals (header currently shows "—").

✅  PR B1.6 — Items table redesign per design doc (2026-05-16)
    Canonical 12-column fixed layout per docs/Designs/scope-of-works-redesign.md
    lines 269-309. Replaces the dynamic-column-by-row-type mechanism with
    a fixed set: WBS / Description / Men / Days / Plant 1...N / Waste group /
    Waste item / Unit / Value / Waste? / Notes / Delete. Plant column count
    is per-card (new ScopeCard.plantColumnCount column, default 1) with
    "+"/"×" header buttons; column removal confirms with the user if any
    row has data at that columnIndex. Adds 4 new columns on ScopeOfWorksItem
    (unit, value, wasteItem, wasteIncluded). Legacy columns kept in schema
    for back-compat. ScopeQuantitiesTable.tsx rewritten (840 → 612 lines);
    ScopeColumnManager + view-config + pills row + Row Type column all gone
    from UI. Tests: 493 → 498. Follow-ups: dead-code cleanup in
    scope-redesign.service.ts COLUMNS_BY_ROW_TYPE matrix, ScopeViewConfig
    table+endpoints deprecation, and auto-waste-summary calc rewire
    (deferred to PR B3).

✅  PR B1.5 — Cards-as-tabs frontend (2026-05-16)
    Cards-as-tabs UX shipped. New scope-cards/ component tree (8 files +
    utils + tests) replaces ScopeOfWorksTab.tsx (1321 lines) and
    ScopeDisciplineBar.tsx (132 lines) — both deleted. The existing
    ScopeQuantitiesTable + ScopeColumnManager + ScopeListDropdown +
    ScopeRowPills are kept alive and reused inside the new tabs shell,
    scoped by active card via cardId filter. @dnd-kit
    horizontalListSortingStrategy drives tab reorder (PointerSensor
    distance:8 to preserve click-to-select). Inline rename on
    double-click; "+ Add card" trailing tab; 4 quick-start buttons on
    empty-state; ChangeDisciplineModal with renumber preview triggers
    the A2.5 atomic cascade. URL search param `?card=<id>` for
    deep-linking. Cutting + waste subtables still render page-level
    filtered by active card's wbsRefs (B2/B3 move them per-card).
    Tests: 132 → 138 (6 new utility tests). API tests unchanged at 493.

✅  PR B1.7.2 — Hotfix: remove waste from item total + align /scope/summary (2026-05-17)
    Smoke caught two bugs from B1.7.1. (A) The waste leg in
    computeScopeItemTotal was wrong — per the design doc, waste
    belongs to the dedicated waste summary subtable, not the scope
    item total. Removed entirely (formula is now labour + plant only;
    Other → provisionalAmount). (B) /scope/summary diverged from the
    per-row totals attached by /scope/items because it still used
    the legacy priceByItemId path. Re-pointed scope-redesign.service
    summary() to the same computeScopeItemTotal helper. Moved
    DEFAULT_ROLE_BY_DISCIPLINE + buildRateMaps + toPricingInput +
    decToNum into scope-item-pricing.ts so both endpoints share one
    primitive set. Marked computeEstimateItemPrices @deprecated in
    both services (no longer called, kept until a cleanup PR
    confirms no other callers).

✅  PR B1.7.1 — Per-row $ total surfacing on the item header bar (2026-05-17)
    Replaces the "—" placeholder with a real per-row total computed
    server-side from canonical B1.6+ fields. New pure helper
    apps/api/src/modules/tendering/scope-item-pricing.ts encapsulates
    the formula (labour = men×days×dayRate; plant = Σ qty×days×rate;
    waste = value×tonRate when unit==="t" && wasteIncluded; Other →
    provisionalAmount). [B1.7.2 NOTE: waste leg was wrong and was
    stripped — see B1.7.2 entry above.] listItems() batch-fetches
    the labour + plant rate cards + the tender markup in a single
    Promise.all and attaches lineTotal + lineTotalWithMarkup to each
    item; summaryByDiscipline re-points at the new per-row totals.
    Frontend collapsed header renders lineTotalWithMarkup (matches
    the footer's "with markup" subtotal). Pricing-helper specs:
    14 → 10 after B1.7.2 stripped the waste branches.
    Note: tender totals rose for any tender with canonical rows that
    were previously contributing $0 — bug fix, not regression.
    Carried into B3: proper waste calc on the dedicated waste
    summary subtable; facility picker for multi-facility waste
    rates; night/weekend shift labour rates.

✅  PR B2.1 — Hotfix: "Reset this card" markup button (2026-05-17)
    B2 smoke surfaced two issues. (A) "Markup picker missing on non-
    DEM cards" — investigation found NO discipline gate anywhere in
    the rendering path; defensive null|undefined widening on the
    CardMarkupOverride.value prop shipped in case a stale cached
    response is the cause. Re-verification post-merge. (B) "Reset"
    split into two affordances: "Reset all" stays on the tender
    header (unchanged); NEW "Reset this card" button next to the
    per-card markup input. Only renders when an override is set
    (hides cleanly when nothing to reset). The × button inside the
    input stays for inline discoverability.

✅  PR B2 — Tender + per-card markup picker + Other-discipline markup (2026-05-17)
    Three pieces of pricing control shipped together.
    (1) Tender-level markup field in the Scope of Works page header
        (right-aligned cluster with input + "Reset all" button). Reads
        /tenders/:id/estimate; writes via PATCH which now upserts the
        TenderEstimate row on first save.
    (2) Per-card markup override field in the card body header strip.
        New ScopeCard.markupOverride Decimal(5,2) nullable; null =
        inherit tender markup, non-null = override for this card only.
        Input is info-bordered when active; × button clears.
    (3) "Reset all" button on the tender header. Confirms when ≥1
        card has an override. Backed by new POST /tenders/:id/scope/
        markup/reset-all → { cardsReset: count }.
    Bonus: Other-discipline rows now apply markup. Previously short-
    circuited to lineTotalWithMarkup = provisionalAmount (no markup);
    now multiply by markupFactor like every other discipline. Flagged
    in PR body as a tender-total bump for tenders with Other rows.
    Footer math: ScopeQuantitiesTable dropped subtotal/subtotalWithMarkup
    props. Per-card footer now self-sums from each item's lineTotal +
    lineTotalWithMarkup attached by /scope/items (B1.7.1). Per-card
    overrides reflect immediately and accurately even when two cards
    share a discipline.
    Tests: 515 → 522 API (+7); web 148 unchanged.

✅  PR B3 — Per-card waste summary subtable + "Sum from above" (2026-05-17)
    Per-card waste filtering shipped (ScopeWasteItem.cardId already
    existed from PR A2 — service + frontend now actually use it).
    NEW "Sum from above" button on the per-card waste subtable
    transactionally aggregates canonical scope items (wasteIncluded=true)
    by (wasteGroup, wasteItem, unit), sums value, picks the first
    active matching EstimateWasteRate for facility + rate, and
    REPLACES only ScopeWasteItem rows where autoSummed=true. Manual
    rows (autoSummed=false) are preserved across regenerations.
    Two new columns: unit (drives facility filter) + autoSummed
    (marks regenerable rows). Frontend: editable unit dropdown
    (m²/m³/t/ea), facility filter now (group, type, unit)-aware,
    amber row tint + disabled dropdown + "— no facility for [unit]
    —" placeholder when no rate matches, small "AUTO" badge on
    autoSummed rows. New endpoint POST /tenders/:id/scope/cards/
    :cardId/waste/sum-from-above returns { replaced, created }.
    Tests: 522 → 530 API (+8 service specs); web 148 unchanged.
    Note: existing tenders with cardless legacy waste rows become
    invisible in the new per-card view — follow-up cleanup tracked
    below.

⏸️  PR B3-followup — Orphaned cardless waste rows
    Existing rows with cardId=NULL are filtered out by the new
    per-card list. Two options: (a) backfill cardId via
    wbsRef → wbsCode → cardId lookup, or (b) surface them in a
    dedicated "uncategorised waste" admin view. Decide after a
    smoke pass on real data.

⏸️  PR B3-cleanup — Rename ScopeWasteItem.wasteTonnes → qty
    Column-name lie introduced in B3: wasteTonnes now holds quantity
    in unit (not always tonnes). Math is correct; column needs
    renaming for clarity. Pure schema rename + Prisma update; no
    data migration required (just metadata).

✅  PR B4a — Scope item dimensions + waste subtable rework (2026-05-17)
    Eight controlled dimension inputs (length, height, depth, density,
    sqm, m³, tonnes, chargeBy) on the scope card item body with live
    derive via a pure helper duplicated client + server. Backend
    re-runs the same compute on save (deriveDimensionFields) so
    persisted sqm/m³/tonnes are always self-consistent; explicit
    overrides survive across partial PATCHes. Waste subtable: Unit
    column dropped; Tonnes + M³ + Billed-by columns added; facility
    filter relaxed to (group, type) only; per-row $/t or $/m³ label
    next to the rate input. sumFromAbove rewrite: group key drops
    unit, sums both tonnes and m³, picks rate by (group, type), bills
    by rate.unit. Legacy ScopeOfWorksItem.unit/value and wasteM3 marked
    @deprecated PR B4a (retained for backward compat; cleanup PR drops
    them later). cuttingIncluded tick box wired + persisted; aggregator
    deferred to B4b. Schema: 7 new fields on ScopeOfWorksItem + 1 (m3)
    on ScopeWasteItem; migration 20260517030000_b4a_scope_item_dimensions
    is pure additive. Tests: 530 → 546 API (+16: 12 dimensions helper
    + 4 net new waste service); web 148 unchanged.
    Flagged: existing autoSummed waste rows go stale on the new
    aggregator — user re-runs Sum from above per card after the
    upgrade (no data migration shipped; per-row density isn't a value
    we can invent).

✅  PR B4b — Per-card concrete cutting subtable + Copy from above (2026-05-17)
    Cutting moves from page-level to per-card collapsible section
    (mirrors B3 waste pattern). ScopeCuttingSheet already mounted
    per-card from B1.7 — B4b adds server-side cardId scoping so the
    list query is authoritative (not relying on client-side WBS
    prefix filtering) and a new "Copy from above" button on the
    Saw-cut tab.

    Copy-from-above reads scope items on the card where
    cuttingIncluded=true (the flag shipped with B4a UI) and creates
    Saw-cut rows with: wbsRef=scopeItem.wbsCode, description verbatim,
    depthMm=round(depth*1000), quantityLm=length, material via
    inferCuttingMaterial(material/materialType/description) helper.
    Equipment / elevation / method / shift left null — estimator
    picks. Material returns null on no-match (NOT default-Concrete) so
    the UI flags with an amber border and forces a manual pick.

    Replace semantics: re-running Copy-from-above deletes
    autoCopied=true saw-cut rows on the card then regenerates. Manual
    saw-cut rows (autoCopied=false), all core-hole rows, and all
    other-rate rows are preserved.

    Schema: +1 column (autoCopied BOOLEAN on CuttingSheetItem).
    Migration: 20260517070000_b4b_cutting_per_card (pure additive).
    New endpoint:
      POST /tenders/:tenderId/scope/cards/:cardId/cutting/copy-from-above
    returning { replaced, created, warnings } — warnings flag rows
    with computed depthMm > 2000 so the estimator can sanity-check.

    Tests: 573 → 590 API (+17: 8 inferCuttingMaterial + 9 copyFromAbove);
    web 148 unchanged.

    No schema changes to rate cards — EstimateCuttingRate already has
    Wall + Floor as separate seeded rows; EstimateCoreHoleRate already
    applies elevation multipliers (Wall=1.1, Inverted=2.0) at compute
    time. Marco's brief confirmed the existing pricing math is correct.

✅  PR B4b.1 — Cutting cardId normalization + UpdateDto cleanup (2026-05-17)
    Codex post-merge P2 hotfix on B4b. (a) createCuttingItem now
    normalizes empty-string / whitespace-only cardId to null BEFORE
    the scope_cards FK validation — closes the gap where an empty
    string would 500 instead of being treated as cardless. (b)
    Removed unused cardId field from UpdateCuttingItemDto — service
    handler never read it, so clients could PATCH and silently
    no-op. Re-parenting isn't a requested feature; if it ever is,
    the service handler must be wired up in the same PR that
    re-exposes the field. +5 specs (4 P2a behaviour + 1 P2b
    @ts-expect-error compile-time contract guard); 590 → 595
    passing. No schema, no migration, no frontend changes.

✅  PR B-followup — Orphan cutting reconciliation + cardId NOT NULL
    guards (2026-05-17)
    Closes the B4b carry-forward. Two test cutting rows on IS-T020
    (DEM1.1, pre-B4b 2026-05-16 creations) deleted via migration;
    zero waste orphans existed at promotion time. NOT NULL
    constraints added to both cutting_sheet_items.card_id and
    scope_waste_items.card_id — the per-card invariant is now
    DB-enforced, not convention-enforced. FK ON DELETE on both
    tables changed from SET NULL → CASCADE (SET NULL would violate
    the new NOT NULL). createCuttingItem and the waste create now
    reject missing/blank cardId with a controlled 400; B4b.1's
    normalize-to-null path is no longer valid. Frontend addItem +
    addRow guard against missing cardId. +4 new specs (3 schema-
    shape compile guards + 1 missing-cardId behavioural), 2 B4b.1
    normalization specs modified in-place to expect 400 instead of
    null-persist. 595 → 599 passing. Migration
    20260517090000_b_followup_cardid_not_null is destructive
    (DELETE) but scope is narrow: pre-merge timestamp filter
    ensures any post-B4b orphan blocks the migration rather than
    being silently destroyed. Smoke-confirmed against IS-T020 dev
    DB before merge.
    Supersedes the prior ⏸️ B4b-followup carry-forward.

📋  Triage Maps (Fix Map + Design Map) — 2026-05-18
    Fix Map covers 8 bugs (B01-B08); Design Map covers 11 features
    (C1-D1 + P-tab1-P-tab6). See
    docs/Designs/scope-of-works-redesign.md sections "Fix Map
    (2026-05-18)" and "Design Map (2026-05-18)". Implementation
    prompts written by MAIN per item; bug-fix wave precedes feature
    wave by Marco's decision. Confirmed root causes for B02, B05,
    B08; B03 flagged as L-complexity architectural decision needing
    its own sub-discovery; B01/B04/B06/B07 need fresh repro
    screenshots / browser-console capture from Marco. C-chain
    entries (C1-D1) unchanged below; new P-chain entries (P-tab1
    through P-tab6) live in the Design Map only — they'll move into
    roadmap proper when implementation prompts ship.

✅  Bug fix B02 — POST /api/v1/jobs (manual job creation)
    Shipped 2026-05-18, PR #197. JobsController gets @Post() create
    handler; JobsService.createJob mirrors convertTenderToJob shape;
    audit via auditService.write({action:'jobs.create'}). +8 specs.
    Fix Map B02 closed.

✅  Bug fix B01 — JobDetailPage surgical error boundary
    Shipped 2026-05-18, PR #199. New ErrorBoundary class component
    (apps/web/src/components/) wraps each tab section in
    JobDetailPage; dev-mode console.error in reload() catch surfaces
    fetch failures in DevTools; +5 vitest specs. Phase 0.4 audit
    found job-001 had no unguarded dereferences or null FKs — fix
    is defence-in-depth + future-crash observability. Design Map
    gets new P-platform1 entry (app-wide boundary promotion +
    Application Insights telemetry as future work). Fix Map B01
    closed.

✅  Cowork rules + diagnostics directory convention — 2026-05-18
    Shipped PR #201. project_instructions.md §19 formalises
    the Cowork local-agent role (reads + diagnostic reports
    only; not implementation). docs/diagnostics/README.md
    adds the report template. Standing convention going
    forward: bug-investigation loop uses Cowork → MAIN →
    Claude Code in sequence.

✅  fix/B01.1 — JobDetailPage line 207 precedence bug — 2026-05-18
    Shipped PR #203. Real cause of the B01 blank-page symptom.
    Triple-confirmed: Cowork source analysis + symptom shape +
    Marco's DevTools console showing exact error
    (TypeError "Cannot read properties of undefined (reading
    'length')" at MessagePort.M — React 18 scheduler signature
    of a render-phase throw). FE-only fix: `job.activities`
    references replaced with a flat list derived from
    `stages[].activities` via a `flattenActivities` helper
    (exported + 3 vitest specs). Type-lie dropped from
    JobDetail. Full-file audit of the same precedence
    antipattern. EmptyState fallback replaces `return null`.
    ErrorBoundary JSDoc clarifies it does NOT catch
    render-phase errors thrown above its mount point. Cowork's
    diagnostic report (599 lines) committed as the first
    example under §19 conventions. Design Map gets P-platform2
    (API/FE type contract enforcement — Zod-or-OpenAPI, 3-4
    PRs). Fix Map B01.1 closed.

✅  docs/post-b01.1-housekeeping — 2026-05-18
    Shipped PR #205. Fix Map updated to reflect today's wave:
    B01 (PR #199), B01.1 (PR #203), B02 (PR #197) all marked
    ✅ Shipped with cross-references; B04 marked
    ⏳ Verification-pending (JobsListPage screenshot still
    needed before closing). New B01.1 row + per-bug detail
    added (was missing entirely). Summary table gained a
    Status column. Design Map gains P-platform3 (Service
    Worker update strategy — Approach A skip-waiting + toast,
    1-2 PRs, future). Full Fix Map + Design Map audit
    performed; 13 entries inspected, 10 changes made, 3
    inspected-and-unchanged.

✅  docs/commit-dependabot-207-report — 2026-05-19
    Shipped PR #208. Commits the Cowork diagnostic report
    produced during PR #207 (brace-expansion bump) triage as
    the second-ever committed Cowork report (first was
    B01.1's via PR #203). README updated with three-case
    guidance for when reports get committed (lessons-learned,
    triage template, architectural decision evidence). §19
    in project_instructions.md unchanged — README is the
    operational override that explains the deviation cases.

⏳  fix/B05 + B02.1 — Job ID canonicalisation + createJob race-fix — 2026-05-19
    PR #[N] OPENED, awaiting human review (no auto-merge —
    schema migration). Three coexisting Job ID formats
    consolidated to canonical J-YYYY-NNN via new
    JobNumberService (per-year sequence, Brisbane TZ). Migration
    normalises 2 JOB-YYYY-NNN + 36 JOB-COMP-* rows in place;
    JOB-COMP-* renumbering starts at MAX(existing 2026)+1 to
    avoid collision with the JOB-2026-001 rewrite. createJob +
    convertTenderToJob both generate when omitted, validate when
    supplied (legacy format → 400). B02.1 P2002 race-fix on both
    paths → 409. +19 API tests. Compliance harness's hard-coded
    JOB-COMP-* dropped (server now generates) — flagged as a
    scope deviation in the PR body (out-of-scope per prompt, but
    necessary to keep the 7-check gate green). On merge: Fix Map
    B05 + B02.1 closed; B02 entry gains "Codex P2 folded into
    B05" note.

⏳  PR C1 — Quote Arrangement screen base
    Phase 0 discovery complete (2026-05-18, see
    docs/Designs/scope-of-works-redesign.md → "C-chain — Phase 0
    discovery findings (2026-05-18)"). Discovery found the Quote
    layer is substantially already built — ClientQuote + 5 sub-
    tables, 4 controllers, 2122-LOC ClientQuotesPanel.tsx with
    dnd-kit already wired. The push-from-scope endpoint at
    POST /tenders/:id/quotes/:quoteId/scope-items/push-from-scope
    is the embryonic Calc-Sheet→Arrangement primitive. C1 extends
    in place rather than building new. Awaiting MAIN to write the
    C1 implementation prompt; recommendations captured in the
    discovery section (Q4: use Client.name + Rev; Q5: stopgap on
    PDFKit, decouple from HTML→PDF migration).

⏸️  PR C2 — Drag-and-drop + grouping (blocked on C1)
    Reuse existing @dnd-kit wiring; group-by-source-card pivot;
    update sortOrder on drag-end via existing reorder endpoint.

⏸️  PR C3 — Collapse / expand / hide (blocked on C2)
    Per-row hide via QuoteScopeItem.isVisible (already exists);
    per-section toggle via ClientQuote.show* flags (already exist).
    Likely no schema change.

⏸️  PR C4 — Change Quote details + Reset to original (blocked on C3)
    Reset = re-run push-from-scope + clear isVisible/sortOrder
    overrides. May add nullable ClientQuote.displayName if Q4
    follow-up surfaces.

⏸️  PR D1 — Quote PDF respects arrangement (blocked on C4)
    Modify quote-pdf.builder.ts to read from QuoteScopeItem
    (currently reads raw scope tables); honour isVisible,
    sortOrder, show* flags; per-section heading from C2's pivot.
    Stopgap on PDFKit (no HTML→PDF dependency).

✅  Discipline migration from 5-code to 4-code system (PR A1) — 2026-05-16
    Closed by PR A1 of the scope-of-works redesign chain (see
    docs/Designs/scope-of-works-redesign.md). Collapsed the legacy 5-code
    discipline system (SO/Str/Asb/Civ/Prv) into the canonical 4-code
    system (DEM/CIV/ASB/Other). SO and Str both merged into DEM (the
    unified demolition umbrella); Asb→ASB, Civ→CIV, Prv→Other (broader
    than provisional sums — covers PS, cost options, adjustments).
    Source of truth: apps/api/src/modules/personas/definitions/disciplines.ts.
    Data migration: 20260516000000_chore_discipline_code_migration covers
    all 5 discipline-bearing tables (scope_of_works_items, scope_waste_items,
    scope_view_configs, claim_line_items, gantt_tasks). Idempotent. The
    new test file discipline-codes.spec.ts (8 tests) is the regression
    guard for the migration's constants and persona prompt vocabulary.
    Frontend scope was Option B: tendering UI updated in this PR, the
    Projects-side ProjectDetailPage.tsx Jobs dropdown deferred to a
    follow-up A1.5.

✅  PR A2 — ScopeCard schema foundation (2026-05-16)
    Added scope_cards table + card_id FKs on scope_of_works_items,
    scope_waste_items, cutting_sheet_items. One card per (tenderId,
    discipline) pair created by the data migration; all existing items
    linked (4 cards / 7 items / 0 orphans on dev DB). Schema-only —
    services continue reading ScopeOfWorksItem.discipline as authoritative
    (per Path 3 of the Q5 decision). New helper
    apps/api/src/modules/tendering/scope/card-defaults.ts exports the
    discipline → card-name + sortOrder mapping used by both the seed and
    the data migration's CASE block.

✅  Design doc committed — docs/Designs/scope-of-works-redesign.md (2026-05-16)
    Living architectural reference for the scope-of-works rebuild.
    Drove A1/A1.5/A2/A2.5; will drive B1/B2/B3 (MVP) and C1-D1 (post-demo).

✅  PR A2.5 — Service-layer migration to card.discipline + column drop (2026-05-16)
    Migrated all service reads from ScopeOfWorksItem.discipline to
    card.discipline via the cardId FK established by PR A2. Touched 8
    services (scope-of-works, scope-redesign, tendering, proposals,
    tender-scope-drafting, contracts, estimate-export, quote-scope-items)
    + 1 Projects-side (gantt). Builders (estimate-excel, quote-pdf)
    unchanged — service flattens i.card?.discipline into the ScopeRow
    payload. Write paths (createItem, createDraftItemsFromAi,
    acceptProposal) now look up or create the parent ScopeCard and write
    cardId instead of discipline. Dropped the discipline column from
    scope_of_works_items via migration 20260516180000_drop_scope_of_works_items_discipline,
    replaced the composite index. ScopeWasteItem.discipline,
    ScopeViewConfig.discipline, ClaimLineItem.discipline, and
    gantt_tasks.discipline columns all retained (separate models;
    future cleanup). Tests: 476 → 478 passing (2 new helper tests).

✅  PR A1.5 — Projects-side discipline dropdown migration (2026-05-16)
    Migrated apps/web/src/pages/projects/ProjectDetailPage.tsx:1468-1472
    from legacy 5-code values (SO/Str/Asb/Civ/Prv) to canonical 4-code
    values (DEM/CIV/ASB/Other), matching the labelling style PR A1
    established on the Tendering surfaces. Pre-flight grep across
    apps/web/src/pages/projects/ + apps/api/src/modules/projects/
    surfaced no additional legacy-code surfaces beyond this one
    `<select>`. The spec's secondary item — removing a supposed
    duplicate `Other` key in apps/api/src/modules/projects/gantt.service.ts
    — was a no-op; pre-flight inspection confirmed PR A1 had already left
    that file in the desired shape (4 canonical keys + 5 legacy aliases,
    no duplicates). API 467 / web 132 tests unchanged.

✅  Rate-fabrication prohibition precedence hardening — closed by PR #161
    Completed in PR #161 (2026-05-16). Pre-demo safety hardening.
    Tightened the precedence language inside GLOBAL_RATE_FABRICATION_PROHIBITION
    (apps/api/src/modules/personas/definitions/shared-prompts.ts) so
    company and user instructions cannot loosen the prohibition, while
    preserving the legitimate extension path for tool-call mandates
    (tendering's RATE_LOOKUP_CONVENTIONS). The prohibition now explicitly
    declares that it can ONLY be EXTENDED (stricter, with tool-call
    mandates) by later instructions and CANNOT be LOOSENED by company
    instructions, user instructions, or sub-mode descriptions; on
    conflict the model surfaces the issue to the user rather than
    silently picking. Added 9 new tests (4 in intrinsic-prompt.spec.ts,
    5 in ai-providers.service.spec.ts) covering the precedence-against-override
    behaviour using the existing prisma mock infrastructure. No live API
    calls in any new test. Removes a real money-on-the-line risk before
    the Sean+Raj demo: if a company instruction is edited during/after
    demo to "ignore the rate handling rule" or similar, the model will
    now refuse and surface the conflict rather than comply.

✅  Mirror-test cleanup in tendering regression spec — closed by PR #160
    Completed in PR #160 (2026-05-16). One file genuinely affected
    (tendering-assistant.system-prompt.regression.spec.ts) — the
    buildScopeSubModeSystemPrompt() helper was reconstructing the
    prompt in-test and had diverged from production after PR #152
    added the GLOBAL_RATE_FABRICATION_PROHIBITION prefix to
    intrinsicPrompt(). Replaced with a direct delegation. The other
    file flagged in PR #152's note (rate-lookup-policy.prompt.spec.ts)
    was found NOT to be a mirror test — it's a structural test
    inspecting sub-mode descriptions directly, which is the correct
    unit for its assertions. Left untouched.

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

✅ Root-cause investigation: which build step emits `.js` into
    `apps/web/src/`
    Completed in PR #157 (2026-05-16). Root cause was
    apps/web/package.json `build` script using `tsc -b` (build mode)
    which inherently emits regardless of --noEmit flag. Fixed by
    replacing with explicit `tsc --noEmit -p <config>` invocations.
    Vite still handles all compilation/bundling.
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

⏸️  Dashboard KPI card title/period-selector layout collision (CRITICAL)
    (Chat1 dashboard screenshot batch 2026-05-03 — visible overlap
     at narrow viewports.)

⏸️  Job ID naming inconsistency (JOB-COMP-{epoch} vs JOB-2026-001)
    (Chat1 dashboard 2026-05-03 — two patterns coexist; pick one
     and migrate.)

⏸️  Tender title truncation in dashboard lists (~12-15 char ellipsis)
    (Chat1 dashboard 2026-05-03 — truncation point too aggressive.)

⏸️  Scheduler week view weekend clipping at narrow viewports
    (Chat1 dashboard 2026-05-03 — Sat/Sun columns clip below 1280px.)

⏸️  Sidebar "Tendering" label duplication (DASHBOARDS vs COMMERCIAL)
    (Chat1 dashboard 2026-05-03 — sidebar shows the label in two
     sections.)

⏸️  "Due this week" card label vs content mismatch (only overdue items)
    (Chat1 dashboard 2026-05-03 — card title says "Due this week"
     but rows show overdue-only.)

✅  Tendering Pipeline board — Withdrawn column layout
    (fix/tendering-board-withdrawn-layout — CSS grid repeat(6) → repeat(7)
     so all 7 status columns render as peer columns. PR #226.)

⏸️  sanitiseProviderError — extend with Xero-specific status extraction
    (Deferred from PR #135 audit M1. The defence-in-depth wrapper
     applied in PR #135 routes Xero errors through the same generic
     categoriser; a Xero-aware extractor could pull the auth/rate-limit
     status code out of the wire response for crisper user messages.)

⏸️  Playwright e2e for scope proposal cards (§5A.1 PR 11 follow-up)
    (Deferred from PR #137. Mock the AI SSE response, accept a card,
     verify scope_of_works_items row gets written. Currently the
     existing tendering.spec.ts only covers tender create / detail
     navigation.)

⏸️  Provider-agnostic tool calling — extend to Gemini and Groq
    (Deferred from PR #137. Currently Anthropic + OpenAI have native
     tool_use streaming; Gemini and Groq providers exist as key-only
     today and would need streaming + tool translation if added to
     SUPPORTED_PROVIDERS.)

✅  Drop dead *ApiKey + *KeyUpdatedAt PlatformConfig columns
    (completed PR #139 — 8 of 12 originally-listed columns dropped.
     *Model columns retained; tracked in the items below.)

⏸️  Decide fate of per-provider model override (*_model columns)
    Discovered live in PR #139 static scan — read by
    PlatformConfigService.getModel/providerStatus, written by
    setModel. Currently NULL across all 4 providers; nobody has
    used the feature. Three options:
      (a) Keep on PlatformConfig as singleton override
      (b) Migrate to UserPersonaSettings for per-user choice
      (c) Drop entirely — model selection happens via persona spec
    Product decision required before implementation.

⏸️  Rename set*ApiKey() methods/DTOs to set*Key()
    Cosmetic-only follow-up to PR #139. The 4 methods named
    setAnthropicApiKey/setOpenaiApiKey/setGeminiApiKey/setGroqApiKey
    and their DTO fields write to *_key_encrypted columns under the
    hood — name implies legacy column write, reality is current
    column write. Rename for clarity. Touches DTOs, controllers,
    service methods, frontend service callers, OpenAPI client.

⏸️  Frontend handling of intermediate tool events
    (Server emits tool_use_started / tool_use_completed /
     tool_side_effect SSE events as of multi-turn loop PR #141.
     Persona window UI currently ignores them. Add visual
     indicators: "Reading drawing...", "Looking up rate...", etc.
     Cosmetic but improves UX during multi-second tool runs.)

⏸️  Conversation history pagination / context window management
    (Multi-turn loop PR #141 persists every assistant turn, tool
     call, and tool result. Long conversations will eventually
     exceed the model's context window. Need a strategy:
     summarisation, sliding window, or both. Defer until first user
     actually hits the limit.)

⏸️  Full structured drawing extraction
    (Dimension parsing, area calculation, hatching/symbol detection,
     AS legend recognition, drawing-type classification — floor
     plan vs elevation vs site plan. Originally proposed for
     drawing tools but deferred — the simple pass-through approach
     covers conversational use; structured extraction is heavy work
     justified only if Raj actually needs it.)

⏸️  DWG / Revit file support
    (Out of scope for the persona drawing tools — would require
     a third-party CAD converter. Deferred until clear demand.)

⏸️  Drawing rasterisation cache
    (In-memory LRU or disk cache for PDF page rasterisation. Not
     built in the drawing tools PR — premature optimisation given
     Raj uploads one drawing set at a time. Add if profiling shows
     it's a real bottleneck.)

✅  Migration history vs dev-DB drift reconciliation — PR #289 (2026-06-02)
    (Drift had accumulated across PRs #117/#134/#136/#137/#139/#141.
     Closed by 20260602084115_chore_reconcile_drift migration —
     captures the residual schema delta so a fresh DB replays
     identical to the live dev schema. Unblocks the pre-deploy
     checklist; production migrate deploy is now safe to run.)

⏸️  Document Prisma .dll harmless-stale cases in troubleshooting doc
    (docs/troubleshooting/prisma-windows-engine-lock.md created in
     PR #138. PRs #139 and #141 both confirmed that ADD/DROP COLUMN
     migrations work correctly with a stale .dll because the failure
     mode is loud — query against missing column errors, doesn't
     silently corrupt. Add a "When stale .dll is harmless" section
     so future agents don't run the recovery sequence unnecessarily.)

⏸️  register-stats-bar Firefox flake
    (Failed first run, passed on retry, in PRs #137/#138/#139.
     Did NOT recur in PR #141 or PR #142. Pattern still likely
     real — timing/race in stats bar render under parallel runners.
     Investigate next time it surfaces.)

⏸️  Asbestos register / hazmat survey reading tool
    (Separate from the drawing tools shipped in PR #142. The system
     prompt instructs the model to cross-reference the asbestos
     register before proposing Asb scope items, but no dedicated
     tool exists yet to read XLSX/PDF hazmat surveys. Auto-detect
     register documents in tender pack + parse + structured query.
     Add when Marco confirms the conversational approach hits its
     limit on real tenders.)

⏸️  Drawing rasterisation / titleblock cache
    (read_tender_drawing rasterises every call; extract_drawing_titleblock
     re-fetches PDF every call. For tenders where Raj asks repeated
     questions about the same drawing, this is wasteful. Add an
     in-memory LRU keyed on documentId + pageNumber, with TTL ~5
     minutes. Defer until profiling shows it as a real bottleneck.)

⏸️  Multi-turn image content — multi-turn re-vision
    (PR #147 passes full image bytes only on the immediate next turn
     after tool execution; older turns get the
     "[image not replayed — call the tool again to refresh]" text
     marker. Works correctly for typical use — model interprets the
     image once and references it via summaries downstream. If a use
     case emerges where the model needs to RE-SEE the same image many
     turns later, the simplest path is to call the relevant tool
     again rather than persist images in DB. Document this clearly
     if such a use case arises; an alternative would be a small
     ttl-bounded in-memory cache of per-conversation image blocks
     keyed by toolUseId. Defer until profiling or a real workflow
     surfaces the need.)

⏸️  DWG / Revit native support for drawing tools
    (Today read_tender_drawing rejects non-PDF/PNG/JPEG with a
     clear "unsupported file type" error. DWG would need a
     CAD-to-PDF converter; Revit even more involved. Deferred until
     clear demand from a real tender.)

⏸️  Other rate types for lookup_rate (PR #148 follow-up)
    (PR #148 covered cutting + core holes — most distinctive IS
     rate types with their elevation rules. Subsequent PRs add
     labour, plant, fuel, waste, enclosure, and other rate types
     using the same handler pattern. Each is a small extension to
     the rateType enum + dispatch branch + system prompt section.
     Defer until cutting + core hole tool is validated through
     manual smoke and Marco signs off the lookup pattern.)

⏸️  Estimate-writing tool (next §5A.1 Item 5 sub-task)
    (Once lookup_rate is validated through smoke, the estimate
     creation tool lets the agent populate estimate items directly.
     Will reference lookup_rate in its system prompt so the model
     follows the standard pattern: lookup_rate → use result to
     populate estimate item fields. Provisional cost lines first;
     full cost-line CRUD second.)

⏸️  Snapshot / revision rate-locking semantics
    (CHECK 0.5 from PR #148 established: no recalculate endpoint
     exists; quote send does not snapshot rates; ClientQuote has
     a revision column with deepCopy support; Tender tracks
     ratesSnapshotAt at submission time as informational only.
     Quote pricing is line-item owned, not rate-table owned, so
     rate library changes don't affect existing quotes — there's
     no immediate correctness risk. Future work: decide whether
     rate-locking should be enforced at quote send or quote
     revision, what the estimator UX should look like for
     "lock current rates", and whether the lookup_rate tool
     should operate on snapshot rates when chatting on a
     locked quote. Design discussion deferred to post-demo with
     Raj.)

⏸️  Per-provider tool compatibility guard at handler-execute time
    (PR #142 documented that ReadTenderDrawingHandler doesn't
     enforce its own provider check because PR #141's
     AiProvidersService.streamChat already throws
     ToolingNotSupportedError synchronously. If tool registration
     ever decouples from the streamChat boundary — e.g. an internal
     scheduler that runs tools without a provider — a per-handler
     guard would become necessary. Re-evaluate then.)

⏸️  pdfjs-dist v4 ESM migration when Jest gets ESM-stable
    (PR #142 pinned to pdfjs-dist@^3.11 because v4 is ESM-only and
     Jest's CommonJS runtime can't load it without transformer
     gymnastics. Upgrade to v4 once Jest 30+ ESM support is mature
     enough to handle pdfjs-dist's import.meta usage cleanly. Until
     then, v3 is functionally complete for our needs.

     CVE carry-forward (Dependabot alerts #14 + #15, HIGH).
     pdfjs-dist 3.11.174 is vulnerable to arbitrary JavaScript
     execution upon opening a malicious PDF; patched in 4.2.67.
     PR #154 mitigated via `isEvalSupported: false` at every
     runtime `pdfjs.getDocument()` call site (the two API drawing
     handlers — read-tender-drawing.handler.ts and
     extract-drawing-titleblock.handler.ts). This is Mozilla's
     recommended mitigation per the pdf.js CVE advisory when the
     package version cannot be upgraded. The eval-based execution
     path is closed for all PDFs loaded by this application.
     Once the v4 upgrade lands, remove the `isEvalSupported`
     option and the inline security comments at both sites — the
     option is documented as redundant on v4+. Dependabot will not
     auto-close alerts #14/#15 on this PR because the package
     version is unchanged; manual dismissal with "Tolerable risk"
     and a pointer to PR #154 is the post-merge step.)

⏸️  Drawing tools structured field extraction
    (extract_drawing_titleblock today returns a regex-based best
     effort. Real consultant drawings vary widely in titleblock
     layout — some put scale below the drawing number, some have
     multi-row titleblocks, some embed the drawing number in the
     filename instead. A trained extractor (or a vision-based
     pre-pass that asks the model to summarise the titleblock)
     would be more robust. Defer until the regex approach actually
     misses a real tender.)

✅  Frontend sub-mode awareness audit (resolved 2026-05-04)
    Network trace from PR #143 manual smoke confirmed the frontend
    chat panel correctly inherits sub-mode from route context
    (tender-detail, scope, etc.). The "register" default at
    personas.controller.ts only fires when subMode is genuinely
    omitted, which is the correct behaviour. No frontend audit
    needed — hypothesis from PR #143 was wrong. PR #144 closed the
    next layer (model receives tools but couldn't resolve
    tender-number → CUID).

⏸️  Cache page count on TenderDocumentLink at upload time
    (list_tender_drawings returns pageCount: null for every entry
     because computing it requires loading the PDF, which defeats
     the cheap-listing design goal — listing 10 drawings would mean
     10 SharePoint downloads + 10 PDF parses on every call. PR
     #142 introduced the per-listing parse; PR #145 dropped it.
     A future optimisation: cache page count on
     TenderDocumentLink at upload time (or as a one-shot
     post-upload background job). Low priority — the model can
     still call extract_drawing_titleblock if it needs page count
     for a specific drawing, and a per-tender listing doesn't
     usually depend on it.)

⏸️  Microsoft Graph SharePoint adapter implementation
    (PR #146 completed the SharePointAdapter abstraction —
     interface extended with downloadFileBytes, mock adapter
     persists/reads locally, GraphSharePointAdapter shell already
     exists with downloadFileBytes implemented via getDownloadUrl
     + fetch + 404→SharePointFileNotFoundError. Remaining work for
     production: finish ensureFolder/uploadFile/getDownloadUrl
     against real Graph (Azure App Registration, MSAL auth,
     environment-aware config). SHAREPOINT_MODE env var already
     selects adapter at module init; flipping to "live" picks up
     the Graph adapter. Mock adapter stays for dev/test forever.)

⏸️  Richer demo drawings for tender register
    (PR #146 ships a synthetic 2-page PDF as the IS-T020 demo
     drawing — bland by design, single titleblock + placeholder
     content area + boilerplate notes. For demos with Sean and
     Raj, real consultant drawings (UQ Union, C-Square Nambour,
     etc.) would be more compelling. Two paths: (a) upload via
     UI after seeding to override the synthetic file at the same
     itemId, or (b) future seed-fixtures/optional/ directory
     pattern where reference drawings can be dropped in without
     committing to repo, with the seed script picking them up if
     present. Defer until first live demo where the synthetic
     drawing's blandness becomes a problem.)

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

🔲 Tendering — Outlook correspondence hub (post-Azure migration)
    Microsoft Graph API integration: monitor company email, group
    correspondence per tender / per client, surface in the unified comms
    panel (PR D) once that ships. Calendar + Tasks integration follows.
    Depends on the Azure launch landing first.

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

### 2026-05-29 — §5A PR D shipped: unified communications panel (PR #260)
Replaced the three Overview-tab panels (Activity timeline, Clarifications &
Communications, Follow-ups) with a single unified "Activity & communications"
panel backed by a new `TenderEntry` table. Schema + idempotent backfill
migration + CRUD API (Swagger + class-validator DTOs) + frontend
`TenderEntriesPanel` with Feed/Tabs toggle and filter chips + add-entry
modal with type-conditional fields + task-assignment notification
scaffolding. Legacy tables (`TenderActivity`, `TenderClarification*`,
`TenderFollowUp`) retained one release cycle then dropped in a follow-up.
Closes the §5A "PR D" roadmap slot. Owner-verified live on 2026-05-29.

### 2026-05-29 — Scope of Works: remove redundant Duration field from card header (PR #259)
Dropped the standalone "Duration (days)" field from the discipline card
header. The per-variant Plant lines (PR #258) already convey duration
alongside qty/equipment, so the separate Duration column was visual noise
and contributed to header crowding. Server-side `duration` calculation
preserved on the data model — presentation-only change.

### 2026-05-29 — Plant summary: one line per variant (PR #258)
`formatPlantSummary` was joining per-variant plant entries with " · " into
a single line, packing multiple variants onto one row. Switched to emitting
one line per variant so each variant reads cleanly on its own row in the
card-header summary and Plant cluster cells.

### 2026-05-29 — Quote edit: restore Save/Cancel buttons (PR #257)
Restored the Save/Cancel button swap on the Quote versions row that was
lost in PR #256. PR-252 Phase 5 surfaced Save/Cancel inline next to the
version chips; PR #256 regressed that surface. This PR re-applies the
original handlers and conditional rendering so the buttons appear when a
version is being edited and disappear after Save or Cancel.

### 2026-05-27 — Dev tooling: harden dev-start.bat (PR #233)
Replaced the dirty-tree warning-then-continue block with a fail-fast guard
that exits non-zero when uncommitted changes are detected. A `git pull` on
a dirty tree had twice left `.git/HEAD` in a broken state requiring manual
recovery. Also replaced the port 3000/5173 warning+pause blocks with inline
PowerShell calls that auto-kill orphan listeners and continue.

### 2026-05-26 — Tender UX polish: canonical status labels + delete-dialog cascade list (PR #232)
Centralised the 7 tender status labels into `tenderStatusLabels.ts` as a
single source of truth for display strings. Fixed the detail-page status
dropdown missing the `CONTRACT_ISSUED` option. Added the `tenderClients`
line to the ConfirmDeleteDialog cascade list so users see which clients
are affected before confirming a tender deletion.

### 2026-05-26 — Tender Detail: fix phantom Clarifications draft + Activity Post verification (PR #231)
Added an `isDirty` predicate to `useFormDraft` so the `visibilitychange`
auto-save only fires when the form is open AND has user content — fixes a
phantom Clarifications draft appearing after navigating away from an empty
form. Defect 2 (Activity Post discarding content) was verified as a Cowork
test artifact with no code change needed.

### 2026-05-26 — Scope of Works: make dimension overrides stick across save / refresh (PR #229)
Replaces the unconditional dirty-flag reset with `isDimensionOverride`
detection so saved overrides on SQM / M³ / Tonnes display correctly as
overrides after reload. Previously, saving then refreshing would reset the
visual indicator even though the override value was persisted.

### 2026-05-26 — Seed: full-feature template tender (PR #228)
Seeded IS-T100 as a full-feature template tender with 4 disciplines, 18
scope items including concrete cutting / coring / grinding, 2 provisional
sums, 2 cost options, 8 linked assumptions, 7 exclusions, and 3 referenced
drawings. ClientQuote IS-T100-R1 seeded with `assumptionMode=linked`,
`detailLevel=detailed`, and all show-flags enabled.

### 2026-05-26 — Tender & quote delete + edit (PR #227)
Hard delete for tenders and quotes with responsible safeguards: audit log
written before row removal; permission-gated behind `tenders.manage`;
preflight endpoint returns cascade counts for UI confirmation dialog;
AWARDED/CONTRACT_ISSUED tenders require typing the tender ref to confirm.
Prisma migration adds `onDelete: SetNull` on SafetyIncident /
HazardObservation tender FKs, Cascade for all owned children.

### 2026-05-26 — Tendering pipeline board layout fix (PR #226)
CSS grid `repeat(6)` → `repeat(7)` so all 7 status columns render as
peer columns. The Withdrawn column was rendering below Draft due to the
missing grid track.

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

### 2026-05-03 evening — AI provider system default fix
Bug: chat returned "AI provider not configured" when user persona
setting was "Use system default" and only a company key existed.
Root cause: chosenProvider was never resolved from null/'system'
before key lookups. Fix: three-tier resolution (user → platform
preferred → first configured). Same PR added warn-on-catch logging
to tryDecrypt (was silent — hid 30 min of diagnosis), a named
ProviderNotConfiguredError class for clearer DX, and a
troubleshooting doc capturing the Windows Prisma .dll lock
recovery sequence that surfaced during diagnosis. PHASE 6 expanded
with 9 new deferred items (6 Chat1 dashboard issues, Xero
sanitiser extension, proposal-cards e2e, Gemini/Groq tool calling,
legacy *ApiKey column drop). project_instructions.md §6 Code
rules gained an explicit "always use the three-tier fallback" rule.

### 2026-05-03 evening — Drop 8 dead PlatformConfig columns
Removed the 8 truly-dead columns (*_api_key + *_key_updated_at for
anthropic, openai, gemini, groq) from PlatformConfig. Originally
scoped as 12 columns in PR #139 spec; static scan caught that the
4 *_model columns are live, not dead — they back an admin-set
per-provider model-override feature. Scope reduced to the
verified-dead 8. Three follow-up PHASE 6 items added: decide fate
of model override, rename misleading set*ApiKey() methods, and the
completion record itself.

### 2026-05-03 evening — Multi-turn agent loop (foundation for §5A.1 Item 5)
Built the conversational agent loop infrastructure that all
remaining §5A.1 Item 5 tools depend on. Discovered as a hard
prerequisite during PR #140 BLOCKED review — the dispatcher was
one-shot, no tool result ever flowed back to the model. Loop has
parallel tool execution, 10-turn cap, error-as-tool-result policy,
per-turn streaming with intermediate events. Anthropic and OpenAI
providers fully support tools including image content; Gemini and
Groq throw a clear ToolingNotSupportedError until tool calling is
implemented for them (existing PHASE 6 deferral). Schema gained
a message visibility field so internal turns (tool calls/results)
are preserved for context but hidden from UI replay.
propose_scope_items migrated from PR #137's one-shot path to the
new registry without behavioural change. Eight new PHASE 6 items
added: frontend handling of intermediate tool events, conversation
context-window management, full structured drawing extraction,
DWG/Revit support, drawing rasterisation cache, migration drift
reconciliation, Prisma .dll harmless-stale doc extension,
register-stats-bar flake follow-up.

### 2026-05-03 evening — Drawing tools + Tendering Assistant system prompt overhaul (§5A.1 Item 5 sub-task)
Three drawing tools (list_tender_drawings,
extract_drawing_titleblock, read_tender_drawing) registered on the
Tendering Assistant scope sub-mode, built on PR #141's multi-turn
loop foundation. Tool-handler tier: pdfjs-dist v3 for PDF parsing
(v4 deferred until Jest ESM support matures), @napi-rs/canvas for
cross-platform rasterisation, sharp for resize/format normalisation,
1568px longer-side cap per Anthropic vision guidance. System prompt
overhaul made the five IS scope codes (SO/Str/Asb/Civ/Prv) explicit
with strip-out vs fit-out disambiguation that fixes the PR #141
step-2 false refusal; added drawing-reading conventions derived
from analysis of five real consultant drawings (UQ Union, C-Square
Nambour, UQ Mayne, Darra SS, SCA Sunshine Coast). Hard regression
test against real Anthropic API on the strip-out scenario, two-attempt
flake-tolerant pattern, skips with console warning when
ANTHROPIC_API_KEY absent. ToolHandlerContext.toolUseId added (PR #141
deviation fix). Six new PHASE 6 deferrals captured: asbestos
register reading tool, drawing/titleblock cache, DWG/Revit support,
per-provider handler guards, pdfjs-dist v4 migration, structured
field extraction.

### 2026-05-04 morning — Tender-context system prompt injection (§5A.1 Item 5)
PR #144 closed the human-readable code vs database CUID gap that
PR #143 exposed during manual smoke. Model used to call
list_tender_drawings with "IS-T020" and get rejected as malformed
CUID; the fix prefixes the system prompt with a "Current tender
context" block when the user is in a tender-scoped sub-mode and
the chat request has a contextKey. Block surfaces the tender's
tenderNumber (display code), CUID, optional title, and an
explicit instruction to pass the CUID to tools. Five tender-scoped
sub-modes inject (tender-detail / scope / estimate / quote /
clarifications); register does not (it's the list view). Twelve
new tests covering injection conditions and graceful failure
modes. Drawing-tools sub-task gates (PR #142 + #143 + #144) now
complete pending Marco's fresh-conversation smoke. The PR #143
PHASE 6 carry-forward "frontend sub-mode awareness audit" closed
as resolved — network trace confirmed the frontend is sub-mode-
aware after all.

### 2026-05-04 morning — list_tender_drawings filter pivot to mime-type (§5A.1 Item 5)
PR #145 fixed the third layer of failure exposed by PR #144's
manual smoke. PR #142's category allowlist
([drawing, plan, demolition, architectural, ...]) misread the
tender_document_links.category field semantics — that field
describes what the document is LINKED TO (tender / project /
job), not what TYPE it is. Real demo drawings have
category="tender" and were silently excluded. PR #145 pivots to
mime-type filtering (PDF/PNG/JPEG) plus filename extension
fallback for null-mime cases via a new looksLikeDrawingFile
helper. Aligns the listing tool with what read_tender_drawing
can actually render. pageCount dropped from per-listing PDF
parse path; PHASE 6 carry-forward captures the upload-time
caching idea. Drawing-tools sub-task gates (PR #142 + #143 +
#144 + #145) now all complete pending Marco's fresh-conversation
smoke retry.

### 2026-05-04 afternoon — SharePoint mock adapter persists bytes locally (§5A.1 Item 5)
PR #146 closed the fifth and final layer of failure exposed by
the manual smoke trail starting at PR #142: drawing tools could
call list_tender_drawings successfully (after PR #145 fixed the
filter), but extract_drawing_titleblock and read_tender_drawing
failed because the mock SharePoint adapter fabricated upload IDs
without persisting bytes AND there was no downloadFileBytes
method on the adapter at all. Fix: extended SharePointAdapter
interface with downloadFileBytes; mock adapter now persists to
local disk on uploadFile and reads back on downloadFileBytes
(storage path .local-storage/sharepoint-mock relative to cwd, so
apps/api/.local-storage/sharepoint-mock since both `pnpm dev`
and `pnpm seed` run from there); GraphSharePointAdapter
implements downloadFileBytes via getDownloadUrl + fetch + 404
detection; SharePointService adds audit-logged downloadFileBytes;
DrawingToolsAccessService rewired through the service;
SharePointFileNotFoundError typed error so handlers produce a
specific user-facing message; seed script generates a synthetic
2-page demo PDF for IS-T020 via pdfkit. Two new PHASE 6
deferrals: Microsoft Graph adapter implementation (the rest of
the production adapter on top of the new downloadFileBytes path);
richer demo drawings (synthetic is bland by design — real
consultant drawings would land via UI upload or a future
seed-fixtures/optional/ directory). Drawing-tools sub-task gates
(PR #142 + #143 + #144 + #145 + #146) now all complete pending
Marco's fresh-conversation smoke from re-seeded state.

### 2026-05-24 — §5A.1 PR B: legacy "Draft scope with Claude" path deleted
Closes the carry-forward from §5A.1 PR 8 (PR #132), which migrated AI
scope drafting onto the Tendering Assistant persona but left the
standalone endpoint + button alongside the new path. PR B removes the
dead path now that the persona-based propose_scope_items tool is the
canonical entry point.

Backend deletions: tender-scope-drafting.controller.ts +
tender-scope-drafting.service.ts + the entire
apps/api/src/modules/tendering/ai-providers/ subdirectory
(ai-provider.interface.ts, claude.provider.ts, openai.provider.ts —
used only by the deleted service). TenderingModule loses its
TenderScopeDraftingController/Service entries and its AiProvidersModule
import (no longer consumed anywhere in the tendering module
directory).

Frontend deletions: TenderDocumentsPanel.tsx loses the
onDraftRequest / drafting / draftBadgeState / showInlineUploadOnly
props, the draftButtonTooltip helper, the .draft-scope-panel JSX
block, and the now-orphaned hasReadableDoc memo + READABLE_PATTERN
constant + useMemo import. TenderDetailPage.tsx loses the drafting /
draftToast useState pair, the runDraft / requestDraft useCallbacks,
the panel-prop pass-through, the draftToast render block, and the
stale PR #44 retirement comment. styles.css loses the 9
.draft-scope-* CSS rules; section header on the surviving
doc-upload-* rules updated to "Tender documents upload".

Test edits: intrinsic-prompt.spec.ts loses the
SCOPE_DRAFTING_SYSTEM_PROMPT import and the "PR #152 Site 2"
describe block. Header comment updated to reflect a single
runtime assembly site (intrinsicPrompt). project_instructions.md
§13 PR #152 paragraph rewritten to match (one site, with the
historical context preserved in parentheses).

No new dependencies. No new env vars. No migrations. The closed
dependency cluster was verified by grepping the apps/ tree for
every removed identifier — no consumer remained outside the deleted
files.

### 2026-05-24 — §5A.1 PR H: lookup_rate extended to all rate types
Closes the last remaining Item 5 sub-task by extending the
lookup_rate persona tool from the two foundational rate types
(cutting + core_hole, PRs #148 + #149) to all six remaining IS rate
types: labour, plant, waste, fuel, enclosure, and other (the
cutting-sheet catalogue flat-fee table). No schema changes — every
rate table already exists; this is purely new read/lookup logic on
top of existing models.

Handler change (apps/api/src/modules/personas/tools/handlers/
lookup-rate.handler.ts): rateType enum widened from
["cutting","core_hole"] to ["cutting","core_hole","labour","plant",
"waste","fuel","enclosure","other"]; the handler description and
the fallback error-message language broadened to match. Six new
input sub-objects in the JSON schema (labour / plant / waste /
fuel / enclosure / other), six new parse/validate functions
mirroring parseCuttingInput, six new lookup methods mirroring
lookupCutting/lookupCoreHole, six new dispatch branches in execute().
All queries filter isActive: true; case-insensitive matching uses
Prisma's `mode: "insensitive"`. No-match paths list the available
options for that table (mirroring availableCuttingCombinations) so
the user gets a useful error rather than a bare not-found.

Backing models per type: labour → EstimateLabourRate (role
@unique; three shift columns dayRate/nightRate/weekendRate);
plant → EstimatePlantRate (item @unique; rate + unit + fuelRate);
waste → EstimateWasteRate ((wasteType, facility) @@unique;
tonRate + loadRate + unit + wasteGroup); fuel → EstimateFuelRate
(item @unique; rate + unit); enclosure → EstimateEnclosureRate
(enclosureType @unique; rate + unit); other → CuttingOtherRate
(description NOT unique; case-insensitive substring match returns
all active matches so the user can pick).

System prompt (apps/api/src/modules/personas/definitions/
tendering.persona.ts): the RATE_LOOKUP_CONVENTIONS block — which
is appended to every tender-scoped sub-mode description per PR #149
— is broadened. The MANDATORY POLICY trigger list now enumerates
all eight categories; the "deferred to subsequent PRs" section is
replaced with per-type mechanics sections matching the existing
cutting/core_hole sections (call shape, key fields, edge cases).
The GLOBAL_RATE_FABRICATION_PROHIBITION baseline and the
RATE_LOOKUP override-precedence language are NOT weakened — only
the supported-types list is broadened.

Tests (lookup-rate.handler.spec.ts): the existing Prisma mock is
extended to cover all six new tables with case-insensitive findFirst
matching; happy-path + no-match tests added for each of the six new
types (12 new specs). The "unsupported rateType" test, which used
"labour" to assert the deferred-types fallback, is updated to use
"bogus" and to assert against the new fallback message ("rateType
must be one of …").

Bindings unchanged: lookup_rate stays bound to the same five
tender-scoped sub-modes (tender-detail, scope, estimate, quote,
clarifications). Register sub-mode stays unbound — same rationale
as PR #149: no specific tender from which to ask for rates.

No new dependencies. No new env vars. No migrations.

### 2026-05-24 — §5A.1 PR D: propose_estimate_items shipped
Adds the Tendering Assistant's estimate-creation tool, mirroring
propose_scope_items end-to-end. The estimate sub-mode is no longer
read-only: the model proposes whole estimate items (header + optional
labour/plant/cutting/waste cost-line groups), and the user reviews
each as a card with Accept / Edit / Reject buttons. No schema changes
— TenderEstimate, EstimateItem, and the four cost-line tables already
exist; this PR is purely new tool + service + handler + controller +
frontend code.

Backend: new propose-estimate-items.tool.ts (JSON schema + types),
new EstimateProposalsService (store + accept + reject + bulk; GET-OR-
CREATE TenderEstimate idempotent with createEstimateItemFromScope;
rejects when estimate is locked), new ProposeEstimateItemsHandler
(emits SSE event="estimate_proposals"), new EstimateProposalsController
(POST /personas/tendering/estimate-proposals/:messageId/accept | reject
| accept-all | reject-all, ai.persona.tendering guard). The
tool_result metadata carries a toolName="propose_estimate_items"
discriminator so the service AND the frontend rebuild logic can
distinguish estimate-proposal rows from the legacy scope-proposal
rows that lack the field. EstimateEquipLine and EstimateAssumption
are intentionally out of scope — the estimator can add them manually
after acceptance.

System prompt: ESTIMATE_SUBMODE_PROMPT rewritten. The model is
instructed to call lookup_rate for every rate it intends to put on a
cost line BEFORE calling propose_estimate_items; if a lookup returns
no match, the model must not invent a rate — it must surface the gap
to the user and either skip the line or wait for the rate to be added
to the schedule. The GLOBAL_RATE_FABRICATION_PROHIBITION baseline and
the RATE_LOOKUP MANDATORY POLICY block remain unchanged — the new
prompt extends them with estimate-creation-specific guidance.

Frontend: new EstimateProposalCardList component parallel to
ProposalCardList, rendering the richer estimate-item shape (header
+ collapsible cost-line groups). chat-helpers gains
ChatEstimateProposal + ChatEstimateProposalsMessage types, the
ChatMessage and SSEChunk unions widen, parseSSEEvent learns the
"estimate_proposals" event, and a parallel pair of
appendEstimateProposalsMessage / updateEstimateProposalsMessage
helpers ships alongside the existing scope-proposal helpers.
use-streaming-chat handles the new SSE event, exposes accept /
reject / acceptAll / rejectAll callbacks wired to the new endpoints,
and the rebuildMessagesFromHistory function branches on
metadata.toolName so estimate-proposal rows survive a page reload.
MessageList + ChatPanel route the new message role to the new card
list. The legacy scope-proposals UI is untouched and unchanged.

Bindings unchanged structurally but extended: lookup_rate stays
bound to the same five tender-scoped sub-modes per PR #149;
propose_scope_items stays bound to the scope sub-mode only;
propose_estimate_items is bound to the estimate sub-mode only —
mirroring the propose_scope_items per-sub-mode discipline.

Closes the last code-bearing Item 5 sub-task in §5A.1. PRs E/F/G/H
are now the only remaining items (H is shipped; E/F/G remain).

No new dependencies. No new env vars. No migrations.

### 2026-05-24 — §5A.1 PR E: propose_quote_content + list_tender_quotes shipped
Adds the Tendering Assistant's two quote sub-mode tools — read-only
list_tender_quotes for discovery, and the propose-then-confirm
propose_quote_content for content creation — closing the quote
sub-mode's "advisory only" gap. The estimator still creates each
ClientQuote in the Quote tab (with its target client + revision); the
AI proposes what goes INSIDE that quote — cost-line structure,
exclusions, and assumptions. No schema changes: ClientQuote,
QuoteCostLine, QuoteExclusion, and QuoteAssumption all already
exist.

Backend: new list-tender-quotes.handler.ts (read-only;
contextKey-default with explicit tenderId override; tenders.view
permission gate; super-users bypass), new
propose-quote-content.tool.ts (JSON schema + per-block types), new
QuoteProposalsService (storeQuoteProposals writes the tool_call +
tool_result rows with a toolName="propose_quote_content"
discriminator; acceptQuoteProposal validates the target ClientQuote
belongs to the conversation's tender, validates status === DRAFT —
SENT and SUPERSEDED quotes are immutable — computes the next
sortOrder per row type from MAX(existing) + 1 so accepted content
appends without colliding with manual entries, then writes one row
per cost-line / exclusion / assumption into the quote), new
ProposeQuoteContentHandler (emits SSE event="quote_proposals"), new
QuoteProposalsController (POST /personas/tendering/quote-proposals/
:messageId/{accept, reject, accept-all, reject-all}; ai.persona.tendering
guard). The toolName discriminator lets the service and the
frontend's history-rebuild distinguish quote proposals from scope
proposals and estimate proposals — the three flows stay strictly
isolated.

System prompt: QUOTE_SUBMODE_PROMPT rewritten. The model is told to
call list_tender_quotes first and confirm the target quote with the
user before proposing content into it; only DRAFT quotes accept new
content; cost-line prices are USER-SUPPLIED unless the user
explicitly stated a figure in the conversation — never invent or
ballpark a price (quote totals are a function of the estimate, which
the estimator owns). The GLOBAL_RATE_FABRICATION_PROHIBITION baseline
and the RATE_LOOKUP MANDATORY POLICY block both remain in force
unchanged.

Frontend: new QuoteProposalCardList component parallel to
EstimateProposalCardList, rendering the cost-line / exclusion /
assumption groups inside the target quote. chat-helpers gains
ChatQuoteProposal + ChatQuoteProposalsMessage types; the ChatMessage
and SSEChunk unions widen for a third proposal variant;
parseSSEEvent learns the "quote_proposals" event; a parallel pair of
appendQuoteProposalsMessage / updateQuoteProposalsMessage helpers
ships alongside the scope + estimate helpers. use-streaming-chat
handles the new SSE event, exposes the four
accept/reject/acceptAll/rejectAll callbacks, and
rebuildMessagesFromHistory now branches three ways on
metadata.toolName so a page reload places each row on its dedicated
card surface. MessageList + ChatPanel route the new role.

Bindings (no structural change to existing tools): list_tender_quotes
and propose_quote_content are both bound to the tendering.quote
sub-mode ONLY — the scope, estimate, and clarifications tabs have
their own creation tools and shouldn't surface quote tools. The
drawing tools and lookup_rate continue to be bound as before.

Remaining §5A.1 Item 5 sub-tasks after PR E: F (clarifications mode
tool) and G (asbestos register reading + cross-reference). H is
shipped.

No new dependencies. No new env vars. No migrations.

### 2026-05-24 — §5A.1 PR G: read_asbestos_register shipped — Tendering Assistant tooling COMPLETE
Adds the final tool in the §5A.1 Item 5 series: a read-only persona
tool that auto-detects and reads the asbestos register / hazmat
survey attached to a tender. The Tendering Assistant's system
prompt already required a register cross-reference before any ASB
scope item; this PR makes that cross-reference actually possible
across all the register formats consultants ship (PDF text layer,
scanned PDF, single-page image, XLSX, DOCX).

Auto-detection uses a small case-insensitive keyword set
(`asbestos register`, `asbestos survey`, `asbestos report`,
`hazmat`, `hazardous material`, `acm survey`, `acm register`,
`division 6`, `div 6`) matched against both the file name and the
TenderDocumentLink title. 0/1/2+ outcomes diverge: 0 candidates is
a non-error "raise a clarification" message; 1 reads it; 2+ returns
a candidate list and asks the model to call again with a specific
`documentId`.

Per-format readers:
- **PDF (text layer)** — extracts every page via pdfjs-dist with
  `isEvalSupported: false` (Dependabot alerts #14/#15 CVE
  mitigation), concatenated with `--- Page N ---` separators. The
  text layer of a tabular ACM register beats page-by-page vision
  for accuracy at zero vision-token cost.
- **PDF (scanned, no text layer)** — falls back to rendering the
  first up-to-3 pages as JPEG via the same pipeline as
  read_tender_drawing (@napi-rs/canvas + pdfjs + sharp; ≤1568px
  longer side; JPEG q85). Returns image blocks plus a text hint
  pointing at `read_tender_drawing` for further pages.
- **Image (PNG/JPEG)** — single-page register; normalised through
  sharp and returned as one image block.
- **XLSX** — every sheet, every non-empty row, tab-delimited.
  Header row included. Empty sheets reported as such with a
  re-upload prompt.
- **DOCX** — `mammoth.extractRawText({ buffer })`. Empty documents
  reported as such with a re-upload prompt.
- **Unknown MIME** — clean error naming the detected MIME.

Context-window protection: `MAX_EXTRACTED_CHARS = 60_000`. Larger
content is truncated and tagged with a `[truncated — showing first
N of M characters; ask for a specific section or page if you need
more]` marker so the model knows to scope its next request.

Cross-tender guard: an explicit `documentId` whose `tenderId`
doesn't match the conversation's contextKey is rejected with a
clean error — mirrors the cross-tender 400s in the propose tools.

Bindings: read_asbestos_register is bound to ALL SIX Tendering
Assistant sub-modes (register, tender-detail, scope, estimate,
quote, clarifications). The register is reference material useful
from any sub-mode: scope proposes ASB items, estimate prices them,
quote references the standard exclusion clause "asbestos not noted
in the asbestos register", clarifications drafts RFIs about the
register. The pipeline (register sub-mode) has no specific tender;
the tool returns a clean "needs a tender" message there, matching
the drawing-tools convention.

System prompt: three coordinated updates. (1) The ASB entry in
IS_SCOPE_DESCRIPTION now instructs the model to call
`read_asbestos_register` instead of "request" the register;
(2) drawing convention (7) names the tool explicitly;
(3) the "starting work on a new tender" example sequence step 7
says call read_asbestos_register and raise a clarification via
propose_clarifications if no register is attached.

`DrawingToolsAccessService` gained one additive method
(`listDocumentsForTender`) so the register reader can see XLSX/DOCX
candidates the existing `listDrawingsForTender` (PDF/PNG/JPEG MIME
filter) would exclude. Rename of the service class is deferred —
its naming is now slightly narrow but the rename touches every
drawing-tool import and isn't worth bundling here.

Seed: synthetic register PDF for the IS-T020 BGS demo tender,
realistic 4-row ACM schedule, idempotent upsert. Filename
`BGS-T020 Asbestos Register - Hazmat Survey.pdf` hits the
detection keyword set.

**New dependency:** `mammoth@^1.12.0` for DOCX text extraction.
Standard, well-maintained library. `exceljs` is already a
dependency — no new package for XLSX.

No schema migration. No new env vars.

With PR G shipped, the §5A.1 Item 5 sub-task list is **complete**:
PRs D / E / F / G / H all shipped (plus B's cleanup). Tendering
Assistant tooling is fully built out.

### 2026-05-24 — §5A.1 PR F: propose_clarifications + list_tender_clarifications shipped
Adds the Tendering Assistant's two clarifications sub-mode tools —
read-only list_tender_clarifications for discovery, and the
propose-then-confirm propose_clarifications for content creation —
closing the clarifications sub-mode's "advisory only" gap. No schema
changes: TenderClarification and TenderClarificationNote already
exist.

The clarifications log is mixed: formal RFIs (TenderClarification, with
status / response / due date) plus a wider comms record
(TenderClarificationNote — call, email, meeting, note, response;
sent or received). The propose tool handles both via three
discriminated proposal kinds:
  - **new_rfi** — creates a TenderClarification with status=OPEN.
  - **new_note** — creates a TenderClarificationNote with
    createdById = authenticated user; occurredAt defaults to now if
    the model omits it.
  - **rfi_response** — updates an existing TenderClarification with
    a response and flips status to CLOSED. Three accept-time
    integrity checks: 404 when the target RFI doesn't exist, 400 when
    it belongs to a different tender, 400 when it already has a
    response (the dedicated edit page is where re-answers go).

Backend: new list-tender-clarifications.handler.ts (read-only;
sorts RFIs OPEN-first; returns last 50 notes; tenders.view gate;
super-users bypass), new propose-clarifications.tool.ts (JSON schema
with `kind` discriminator + per-kind required fields), new
ClarificationProposalsService (storeClarificationProposals,
acceptClarificationProposal with kind-switch and rfi_response
integrity checks, rejectClarificationProposal, acceptAllPending,
rejectAllPending; loadProposalMessage enforces the
toolName="propose_clarifications" discriminator so the service is
strictly isolated from the scope/estimate/quote proposal stores),
new ProposeClarificationsHandler (SSE event="clarification_proposals"),
new ClarificationProposalsController (POST /personas/tendering/
clarification-proposals/:messageId/{accept,reject,accept-all,
reject-all}; ai.persona.tendering guard).

System prompt: CLARIFICATIONS_SUBMODE_PROMPT rewritten. The model is
told to call list_tender_clarifications first; to target existing
RFIs by id via rfi_response rather than raising a duplicate; to use
the IS tender voice (concise, factual, no marketing, no hedging) on
drafts; and that the GLOBAL_RATE_FABRICATION_PROHIBITION +
RATE_LOOKUP MANDATORY POLICY blocks remain in force unchanged.

Frontend: new ClarificationProposalCardList component parallel to
QuoteProposalCardList, with a per-kind switch inside each card
(new_rfi shows subject + due date; new_note shows
type/direction/occurredAt + body; rfi_response shows the target
rfiId code-formatted + the response text). Edit mode reveals
kind-specific fields. chat-helpers gains the four
ChatClarificationProposalInput discriminated types,
ChatClarificationProposal, ChatClarificationProposalsMessage; the
ChatMessage and SSEChunk unions widen for the 4th proposal variant;
parseSSEEvent learns the "clarification_proposals" event; a parallel
pair of appendClarificationProposalsMessage /
updateClarificationProposalsMessage helpers ships alongside the
quote/estimate/scope helpers. use-streaming-chat handles the new
SSE event, exposes the four accept/reject/acceptAll/rejectAll
callbacks, and rebuildMessagesFromHistory now branches four ways
on metadata.toolName so a page reload places each row on its
dedicated card surface. MessageList + ChatPanel route the new role.

Bindings unchanged structurally: list_tender_clarifications and
propose_clarifications are both bound to tendering.clarifications
ONLY. Existing sub-mode bindings (scope / estimate / quote / drawing
tools / lookup_rate) are unchanged.

**Labour-rate unit correction (folded into this PR).** The
lookup_rate labour result returned `unit: "AUD per hour"`, but per
project_instructions §10 the IS labour formula is Qty × Days × Rate
— labour rates are per DAY, not per hour. Single string change in
lookup-rate.handler.ts plus a unit assertion locking the corrected
value in lookup-rate.handler.spec.ts. This was a latent bug; the
labour rate-table rows themselves were always per-day, the unit
string was just wrong.

Remaining §5A.1 Item 5 sub-tasks after PR F: only **G** (asbestos
register reading + cross-reference) remains. H / E / F / D are
shipped.

No new dependencies. No new env vars. No migrations.

### 2026-05-25 — §5A.2 PR 1: HTML→PDF renderer infrastructure (PR #220)

First PR of Phase 5A.2. Adds PdfRenderingModule with PdfRendererService
— the shared HTML→PDF rendering service that future document-migration
PRs will consume. Engine: Puppeteer 23.x with bundled Chromium.
Lazy-launched shared browser, auto-reconnect, 4-concurrent-render guard.
API: `renderHtmlToPdf`, `loadTemplate`, `renderTemplateToPdf` with
`{{key}}` interpolation. IS brand fonts (Outfit + Syne, OFL variable
TTFs) bundled for deterministic rendering. Sample template exercises
both fonts, brand colours, tables. 18 tests (6 defaults, 8 template
helpers, 4 integration with pdfjs-dist page-count verification).
New dependency: `puppeteer@23.11.1`. No new env vars. No migration.

### 2026-05-25 — §5A.2 PR 2: Quote PDF — HTML template + migration

Second PR of Phase 5A.2. Migrates the Quote PDF from the 1,174-line
PDFKit builder (quote-pdf.builder.ts) to the HTML→PDF renderer. The
PDFKit builder is deleted outright — no fallback path (owner-approved).
Both consumers (QuotePdfService.generate for per-ClientQuote PDFs,
EstimateExportService.exportPdf for tender-level PDFs) rewired to the
new HTML builder. Template reproduces every section: IS-branded cover
page, cost summary, cost options, provisional sums, scope table
(simple/detailed/tender-level), preliminary works, referenced drawings,
allowances, assumptions (free + linked), exclusions, two-column T&C,
acceptance/signature block. IS watermark and Puppeteer-driven page
footers with page numbers. All dynamic values HTML-escaped.
pdfkit dependency kept (persona test fixtures). 9 new tests.
Sample PDFs at docs/samples/ for Sean's visual sign-off.
No new dependencies. No new env vars. No migration.

### 2026-05-25 — §5A.2 fix-forward: repeating header + acceptance page-break

Recovers commit 70b4d98, which the PR #221 squash merge missed.
CSS position:fixed header band repeats on every printed page (was
absent from the T&C overflow page). Acceptance/signature block wrapped
in break-inside:avoid so it never splits across a page boundary.
Sample PDFs regenerated with the fix applied.

### 2026-05-26 — §5A.2 fix-forward: fix doubled / overlapping repeating header

PR #222's CSS position:fixed header doubled on every page (both the
fixed header and inline headerBand() were present) and overlapped body
content on pages 3–4. Reworked: header now uses Puppeteer's
headerTemplate (same mechanism as the footer) with the IS logo embedded
as base64. Removed fixedHeaderBand(), headerBand(), and all associated
CSS. Page margin.top increased from 25mm to 30mm. Both sample PDFs
regenerated; programmatic verification confirms exactly 1× header per
page on all 4 pages of both samples.

### 2026-05-26 — §5A.2 fix-forward: restore brand styling, fix page-break + document-control

PR #223 moved the header to Puppeteer headerTemplate but lost the IS
teal branding and document-control block. This fix-forward restores
full brand styling to both header and footer (teal bands, orange rule,
-webkit-print-color-adjust:exact), adds the document-control block
("Electronic document / Uncontrolled when printed / Printed on: <date>")
to the header template, removes the hard page-break before Scope of
Works (eliminating ~80% blank page), and fixes stray ")" appended to
cost summary and cost option labels.


### 2026-06-01 — §4 Xero contacts CSV importer (one-shot CLI)

Companion tooling for PR #277's Xero schema alignment. New
`apps/api/scripts/xero-import-contacts.ts` (runner
`pnpm xero:import-contacts`) reads Marco's two Xero exports
(`Contacts Customers.csv`, `Contacts Suppliers.csv`) and
upserts into `Client` / `SubcontractorSupplier` / `Contact`.
Dry-run by default; `--commit` to write. Idempotent by
`xeroContactId` or exact trimmed `name`. Inline RFC 4180
parser — no new dep. 25 unit tests on the pure helpers.
The script is one-shot — not part of the normal startup
path and not exposed in the UI.
