# 5. Tendering and Estimating

## Purpose

The commercial heart of the platform. Raj's primary daily tool. Captures a
tender from intake through scope drafting, estimating, quoting, and award.
Drives every downstream commercial flow (contracts, progress claims) and
every downstream operational flow (jobs, scheduler).

§5A "Tendering Module Sign-off" is the current top-priority gate — nothing
in §6+ ships until Raj + Sean sign this off.

This is the largest, most-iterated module in the codebase. Treat it as
high-risk for regression.

## Surface area

**Routes (frontend):**
- `/tenders` — `TenderingPage` (Kanban pipeline default + Register toggle)
- `/tenders/:id` — `TenderDetailPage` showing the **Overview** tab (sticky
  rail, activity & communications panel, inline note/clarification/follow-up
  forms)
- `/tenders/:id/scope` — `TenderDetailPage` showing the **Scope of Works**
  tab (cards-as-tabs per discipline, 12-column item table, embedded
  estimate fields)
- `/tenders/:id/quote` — `TenderDetailPage` showing the **Quote** tab
  (versions list + quote editor)
- `/tenders/dashboard` — `DashboardV2TenderLayout` (PR #43)
- `/tenders/clients` — `TenderClientsPage`
- `/tenders/contacts` — `TenderContactsPage`
- `/tenders/settings` — `TenderingSettingsPage`
- `/tenders/reports` — Reports view
- **Tender Detail surface: exactly 3 tabs** — Overview / Scope of Works /
  Quote. The tab is URL-driven (the 3 routes above all mount
  `TenderDetailPage`); switching tabs navigates. There is **no** standalone
  Estimate, Clarifications, Documents, or Activity tab — those surfaces
  were merged in as described below.

**API endpoints (key):**
- `GET/POST/PATCH/DELETE /api/v1/tenders` — CRUD
- `PATCH /api/v1/tenders/:id/status` — lightweight Kanban drag-drop
- `POST /api/v1/tenders/bulk-status` — bulk status update
- `GET/POST /api/v1/tenders/:id/notes`
- `GET/POST /api/v1/tenders/:id/clarifications`
- `GET/POST /api/v1/tenders/:id/follow-ups`
- `GET/POST /api/v1/tenders/:id/activities`
- `GET/POST /api/v1/tenders/:id/estimate` (upserts on PATCH)
- `GET /api/v1/tenders/:id/scope/items`
- `GET /api/v1/tenders/:id/scope/summary`
- `POST /api/v1/tenders/:id/scope/cards/{create,reorder,rename,...}` (PR B1)
- `POST /api/v1/tenders/:id/scope/markup/reset-all` (PR B2)
- `POST /api/v1/tenders/:id/scope/cards/:cardId/waste/sum-from-above` (PR B3)
- `POST /api/v1/tenders/:id/scope/cards/:cardId/cutting/copy-from-above` (PR B4b)
- `GET/POST /api/v1/tender-entries` — unified comms panel
- `GET /api/v1/tender-filter-presets` — saved presets
- `POST /api/v1/tenders/:id/convert` — tender → project conversion
- `POST /api/v1/tenders/:id/revert-to-tender` — admin escape hatch (PR #250)
- `POST /api/v1/tenders/:id/estimate/export` — Excel export

**DB entities:**
- `Tender`, `TenderNote`, `TenderFollowUp`, `TenderEntry`,
  `TenderClarificationNote`, `TenderFilterPreset`
- `TenderEstimate` (single per tender, upserted)
- `EstimateItem` + cost-line tables: `EstimateLabourLine`, `EstimatePlantLine`,
  `EstimateCuttingLine`, `EstimateWasteLine`, `EstimateEquipLine`,
  `EstimateAssumption`
- `ScopeCard` (cardNumber unique per (tenderId, discipline), markupOverride,
  plantColumnCount, cuttingNotes, wasteNotes)
- `ScopeOfWorksItem` (12-column layout post PR B1.6, dimensions per PR B4a)
- `ScopeWasteItem` (per-card via cardId, NOT NULL after PR B-followup)
- `CuttingSheetItem` (per-card via cardId, NOT NULL after PR B-followup,
  autoCopied flag from PR B4b)
- `TenderDocumentLink`

## What should work (functional checklist)

### Pipeline / Register
- [ ] Kanban pipeline board shows columns: Submitted, Active, Won, Lost,
      Withdrawn, Cancelled (verify column set is canonical labels, PR #232)
- [ ] Drag a tender card between columns — status updates immediately,
      audit log entry
- [ ] Withdrawn column renders correctly (PR #226 layout fix)
- [ ] Register (table) toggle works
- [ ] Register filters: client, status, estimator, due date range
- [ ] Filter presets — Save Current, Apply, Edit, Delete (verify all 4 work)
- [ ] Bulk-status update on multiple selected tenders (PR #107 verified;
      production validation pending per §5A.3)
- [ ] Stats bar shows live counts per status

### Tender create
- [ ] New tender slide-over opens with client picker
- [ ] Client picker filters live; can create new client from inline modal
- [ ] Site picker filters by selected client
- [ ] Required fields: tender number (auto?), title, client, due date,
      estimator
- [ ] Tender number format: `IS-T{NNN}` (e.g. IS-T020 is seed demo)
- [ ] Auto-create SharePoint folders on save (PR #304, mock mode)

### Tender detail
- [ ] Sticky rail with key facts: status, client, value, dates, estimator
- [ ] Activity timeline shows: notes, clarifications, follow-ups,
      activities, documents added (PR #303 — team-as-estimator +
      client-filtered activity)
- [ ] Inline create: note / clarification / follow-up / activity
- [ ] Status dropdown on detail (PR #95)
- [ ] Convert to project button (gated on Won status, PR #250 adds
      revert-to-tender escape hatch)
- [ ] Delete tender with confirmation modal that lists cascades
      (PR #232 cascade list)
- [ ] Activity Post verification (PR #231)
- [ ] No phantom Clarifications draft (PR #231)

### Scope of Works tab
- [ ] Cards-as-tabs UX (PR B1.5 / #168) — top horizontal tab strip per
      discipline (DEM/CIV/ASB/Other), drag-reorder via @dnd-kit
- [ ] "+ Add card" trailing tab with discipline picker modal (PR #248)
- [ ] Empty-state quick-start buttons (4 disciplines)
- [ ] Inline rename on double-click
- [ ] Change Discipline modal with renumber preview (PR B1.5)
- [ ] URL `?card=<id>` deep-links to specific card
- [ ] Tender-level markup field (header right) — PR B2 / #177
- [ ] "Reset all" button confirms with override count
- [ ] Per-card markup override input — × clears, info border when active
- [ ] "Reset this card" button only renders when override is set (PR B2.1)
- [ ] Items table: 12-column fixed layout (PR B1.6) — WBS, Description,
      Men, Days, Plant 1..N, Waste group, Waste item, Unit, Value, Waste?,
      Notes, Delete
- [ ] Plant column count per card with "+"/"×" header buttons
- [ ] Add Plant column confirms if rows have data when removing
- [ ] Items are collapsible (PR B1.7); header bar shows WBS / description /
      $ total / delete; expanded shows Men/Days + Plant clusters + waste
      grid + full-width notes
- [ ] Per-row $ totals on collapsed header (PR B1.7.1) — match the
      "with markup" footer subtotal
- [ ] Notes field expandable to modal (Esc/backdrop/⌘+Enter)
- [ ] Eight controlled dimension inputs (length / height / depth / density /
      sqm / m³ / tonnes / chargeBy) — live derive, server reruns the same
      compute on save (PR B4a)
- [ ] Dimension overrides stick across save / refresh (PR #229)
- [ ] Cascade-release downstream overrides on upstream edit (PR #235)
- [ ] Cutting subtable: per-card, "Copy from above" button (PR B4b);
      copies rows where `cuttingIncluded=true`; flags unknown material
      with amber border
- [ ] Waste subtable: per-card, "Sum from above" button (PR B3); amber
      row tint when no facility matches the (group, type, unit); shared
      `wasteNotes` at the bottom
- [ ] Cutting / Waste both have shared notes blocks at card bottom (PR B1.7)

### Estimate (embedded in Scope of Works — no standalone tab)
The Estimate sub-mode was merged INTO Scope of Works during the B-chain
reshape. Each scope item carries its labour + plant + dimensions + waste
inline, and the per-row `$ total` is computed from labour + plant per
PR B1.7.1. There is no separate Estimate tab in the UI — verify these
behaviours from inside `/tenders/:id/scope`:
- [ ] Per-item MEN / DAYS row + Plant button + B4a dimensions (Length /
      Height / Depth / Material / Density / SQM / M³ / Tonnes) + Waste
      row are present on the expanded item
- [ ] Per-row `$ total` on collapsed header (PR B1.7.1) — matches the
      "with markup" footer subtotal
- [ ] Waste removed from item total (PR B1.7.2) — waste lives in its
      dedicated subtable, not in the row dollar figure
- [ ] Other-discipline rows apply markup (PR B2 bonus fix)
- [ ] Card-header summaries with override highlight + proportional
      cost appropriation (PR #239)
- [ ] Card-header plant summary groups by equipment category + override
      (PR #245)
- [ ] Plant summary one line per variant (PR #258, fix-forward of #251)
- [ ] Person-days renamed to Labour days; plant duration formula
      correct (PR #246)
- [ ] Estimate export to Excel from the scope surface (PR #45;
      `POST /api/v1/tenders/:id/estimate/export`)
- [ ] Provisional sums (PR #46) priced correctly (entered via Quote
      editor → Provisional Sums sub-tab)

### Clarifications (collapsed into Overview "Activity & communications" — no standalone tab)
Per PR #260 + ADR-0001 the legacy Clarifications surface was unified
with Notes / Follow-ups / Activity into a single `TenderEntry`-backed
feed rendered inside the Overview tab. The standalone `/clarifications`
tab was removed and the legacy endpoints (PR #29 / #270) deprecated.
Verify from `/tenders/:id` (Overview):
- [ ] Single "Activity & communications" panel with a type dropdown
      that drives conditional fields (PR #267 covers the modal tests)
- [ ] Six clarification types still available with colour badges
      (Phase 1 complete)
- [ ] Call / Email / Meeting / Note as first-class types (PR #72
      migration, §5A.3 follow-up)
- [ ] Inline create + reply flow against `POST /api/v1/tender-entries`
- [ ] Filter chips on the panel (PR #265 tests)
- [ ] Saved filter presets per Marco's S5A.3 mention

### Tender Entries / Comms
- [ ] TenderEntriesPanel with filter chips (PR #265 tests)
- [ ] Add Entry modal — type-conditional fields (PR #267 tests)
- [ ] Plant summary edge cases covered (PR #269 tests)
- [ ] Cost allocation invariants per PR #268 tests

### Documents tab
- [ ] Upload drawings — list_tender_drawings can find them by mime-type
      (PR #145)
- [ ] Asbestos register auto-detected by filename keyword (PR G / #218)
- [ ] Categories: tender / drawings / asbestos / contracts / etc

## Recent PRs that shaped it (last ~100 merged)

**Big functional waves:**
- #16 — S7 tendering rebuild (foundational)
- #28 / #34 / #37 — Estimate editor v2, v3, improvements
- #43 / #30 — Dashboard v2 tender layout
- #44 — Scope of works tab
- #52 / #53 / #54 — Scope of works redesign chain
- #55 — Quote tab
- #62 — Quote system redesign
- #64 — Tender register improvements
- #67 — Audit findings fix
- #70 — UX quick-fixes
- #71 — Scope redesign
- #72 — Scope UX completion (plant/measure pills, waste cascade, quote
  reorder, clarification types)
- #77 / #78 / #95 / #102 / #104 — polish chain

**Scope-of-works rebuild (B-chain, very recent, high-risk):**
- #162 (PR A1) — Discipline migration 5-code → 4-code
- #163 (PR A1.5) — Projects-side discipline migration
- #164 (PR A2) — ScopeCard schema foundation
- #165 (PR A2.5) — Service-layer migration to card.discipline
- #167 (PR B1) — ScopeCard cardNumber + card-CRUD backend
- #168 (PR B1.5) — Cards-as-tabs frontend
- #169 (PR B1.5.1) — scope-waste DTO canonical disciplines
- #170 (PR B1.5.2) — ScopeRowPills multi-plant
- #171 (PR B1.6) — Items table redesign 12-col fixed layout
- #172 (PR B1.7) — Collapsible items + shared subtable notes + tooltip dropdowns
- #173 (PR B1.8) — Plant qty/days width + draggable/minimisable assistant
- #174 (PR B1.8.1) — Persona window click handlers fix
- #175 (PR B1.7.1) — Per-row $ totals on scope items
- #176 (PR B1.7.2) — Remove waste from item total + align /scope/summary
- #177 (PR B2) — Tender + per-card markup picker + Other-discipline markup
- #178 (PR B2.1) — Reset this card button
- #179 (PR B3) — Per-card waste summary + Sum from above
- #180 (PR B4a) — Scope item dimensions + waste subtable rework
- #181 (PR B4a.1) — Defensive type narrowing in toDecimal
- #182 (PR B4a.5) — Dimension override propagation
- #183 (PR B4a.6) — Widen density Decimal precision
- #184 (PR B4b) — Per-card cutting subtable + Copy from above
- #186 (PR B4b.1) — Cutting cardId normalisation
- #188 (PR B-followup) — Orphan cleanup + cardId NOT NULL guards
- #229 — Make dimension overrides stick across save/refresh
- #235 — Cascade-release downstream overrides
- #236/#237 — Density as lookup, unit-aware conversion
- #239 — Card-header summaries + override + proportional appropriation
- #241 — Scope card plant state isolation + header summary calc
- #244 — Material density seed expansion (29 rows + dual-unit variants)
- #245 — Card-header plant summary group by equipment + override
- #246 — Rename Person-days to Labour days, plant duration fix
- #247 — Card header field affordance discoverability
- #248 — Card creation discipline picker modal

**Comms / clarifications:**
- #29 / #270 — Deprecate legacy comms endpoints
- #260 — Unified communications panel (5A): **collapsed the standalone
  Clarifications tab into the Overview "Activity & communications" panel**
  backed by `TenderEntry`; the old standalone tab no longer exists
- #33 — ADR-0001 unified tender comms panel (doc)
- #263 — Swagger on TenderEntries
- #264 / #265 / #267 / #269 — TenderEntries panel + modal tests
  (test-only)

**Cosmetic / hygiene:**
- #226 — Withdrawn column layout
- #227 — Empty commit (`@`)
- #232 — Canonical status labels + delete dialog cascade list
- #231 — Fix phantom Clarifications draft + Activity Post verification
- #234 — Roadmap update §5A.2 Quote PDF + Outlook hub
- #287 — Quote scope grouped-mode drag reorder
- #299 — Migrate Tender delete-confirm modal to CenteredModal (UX)
- #300 — CenteredModal sweep 24 modals (UX)
- #303 — Team-as-estimator + client-filtered activity backend
- #312 — Vite manualChunks

**Test-only / doc-only (skip visual):**
- #22 — Swagger TenderEntries
- #23, #24, #26 — TenderEntries / panel / add-entry tests
- #27 — Cost allocation tests
- #28 — Plant summary tests
- #32 — JSDoc on web tendering public API

## What to watch for during sanity check

- **Scope-of-works B-chain (recent, very large)** — the entire chain
  (#162–#248) reshaped Scope. Items table is now 12-column fixed; cards
  are tabs; markup picker is tender + per-card; waste/cutting are per-card
  with "Sum from above" / "Copy from above". This is the highest-risk
  surface in the app.
- **Card-header summaries + proportional appropriation** — pricing math
  was reshuffled (PRs #239, #245, #251, #258). Spot-check totals against
  Excel export to verify no double-counting / mis-allocation.
- **Waste leg removal** — PR B1.7.2 removed waste from scope item total
  (waste is its own subtable now). Existing rows might show different
  per-row totals than before the migration — that's expected, not a bug.
- **CenteredModal sweep (PR #300)** — 24 modals migrated. Delete-confirm
  consistency (PR #299) is the watch-for. Esc / backdrop / × all should
  work. Bulk-action confirm modals should match.
- **Discipline migration (PR A1)** — verify NO surface still uses
  SO/Str/Asb/Civ/Prv. If you see those legacy codes in any picker or
  display, it's a leftover.
- **Filter presets** — Save / Apply / Edit / Delete is a 4-state surface;
  test all four.
- **Bulk status update** — production-validation gate per §5A.3; test
  with 5+ selected tenders.
- **Quote → Scope items grouped drag reorder (PR #287)** — Raj's primary
  view per the roadmap. Verify both grouped and flat reorder.
- **Auto SharePoint folder (PR #304)** — verify on disk after tender
  creation.
- **Persona window draggable + minimisable (PR B1.8 / #173)** — drag from
  header bar (when open) or full pill (when minimised); × resets to
  default position; state persists in localStorage. PR B1.8.1 fixed a
  click-handler regression — verify clicks INSIDE the window still work
  after dragging.
- **Activity timeline** — PR #303 added team-as-estimator and
  client-filtered activity. Test as a non-estimator user too.
- **Tender Detail surface is exactly 3 tabs — canonical** — Overview /
  Scope of Works / Quote, URL-driven (`/tenders/:id`, `/tenders/:id/scope`,
  `/tenders/:id/quote`). Any review or older spec that expects a separate
  Estimate or Clarifications tab is reading stale documentation: Estimate
  was merged into Scope items (PR B1.7.1) and Clarifications was collapsed
  into the Overview "Activity & communications" panel (PR #260 / ADR-0001).
  See the Estimate and Clarifications sections above for the
  current-surface checklist.

## Edge cases worth probing

- **Tender with 0 scope items** — empty state per card
- **Tender with 4 cards × 50 items each** — virtualisation / performance
- **Drag tender between Kanban columns rapidly** — race conditions on
  status update
- **Concurrent edit on same scope item** — last write wins, no corruption
- **Cards-as-tabs with 8+ cards** — horizontal scroll vs collapse
- **Reset-all markup with no overrides set** — should be no-op, not error
- **Sum from above with no matching facility rates** — amber tint + clear
  message
- **Copy from above with no `cuttingIncluded=true` rows** — empty result
  + clear feedback
- **Mobile width (375px)** — Tendering is desktop-first; degrade is
  acceptable, but Kanban and Items table should still be navigable
- **Permission-gated** — Field worker can't see Tenders nav; Planner
  can see read-only; Estimator can edit own; Admin can edit any
- **Network failure mid-save** — items table inputs should not lose
  state; clear "save failed" indicator
- **Delete card with items** — 409 with clear blocker message (PR B1)
- **Change discipline on card with items** — atomic cascade preview
  before commit
