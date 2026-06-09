# Phase 1B — Tendering core

**Status:** PASS with one notable observation
**Tester:** Cowork-driven via Chrome MCP
**Login:** Alex Admin (ADMIN)
**Viewport:** 1568x744 (desktop)

## Summary

The Tendering module is the most polished surface in the system. Pipeline renders 15 seeded tenders across 7 status columns with healthy financial totals. The B-chain reshape (PRs #162-#248) is fully present — cards-as-tabs, dotted WBS codes, 12-column item layout, per-card markup, B4a dimensions. The Quote editor is rich. The Tendering Assistant persona window is wired sub-mode-aware (PR #143 verified in UI).

## What works ✓

### Tendering Pipeline (`/tenders`)
- **PR #226 fix verified:** 7-column CSS grid `repeat(7)` lays Draft/Estimating/Submitted/Awarded/Contract/Lost/Withdrawn as peer columns. Withdrawn no longer rendered below Draft.
- 15 seeded tenders distributed across columns:
  - Draft 3 / $748k (IS-T005, IS-T011, IS-T100)
  - Estimating 4 / $3,580k (IS-T012, IS-T007, IS-T004, IS-T020)
  - Submitted 4 / $3,518k (IS-T002, IS-T014, IS-T013, IS-T009)
  - Awarded 2 / $5,350k (IS-T003 Sandgate $1.1M, IS-T001 Ipswich Motorway $4.25M)
  - Contract 0
  - Lost 1 / $720k (IS-T006 Capalaba)
  - Withdrawn 1 / $340k (IS-T008 BCC Lane Cove)
- Each card shows: tender code, name, client, value, "today since activity", RP avatar, 3-dot menu
- Pipeline / Register toggle present
- "+ New tender" CTA

### IS-T100 Tender Detail (`/tenders/seed-tender-template-100`)
- Header: code + title + Draft chip + stage dropdown + Duplicate + Delete
- 3 tabs visible: Overview, Scope of Works, Quote
- **No standalone Estimate tab** — estimate is embedded within Scope of Works at the item level (each item's cost rolls up labour + plant; PR B1.7.1)
- **No standalone Clarifications tab** — consistent with PR #260 unified communications panel collapsing Clarifications into Overview's TenderEntry feed

### Overview tab
- KPI strip: Stage, Value ($0 for template), Probability (Cold dropdown), Due Date, Rate Snapshot ("No estimate yet")
- Description / Scope notes panel: "Template tender — do not submit. Copy this tender to start a new quote with all sections pre-populated."
- Team panel: Raj Pudasaini (Estimator) avatar (PR-63 estimator surface)
- Clients panel: Acme Infrastructure (PRIMARY) + star rating + add client
- Documents (3): drag & drop upload, category dropdown defaults to Other, supports PDF/Word/Excel/DWG/PNG/JPG up to 100 MB

### Scope of Works tab — the B-chain reshape
**Verified live (PRs #162-#248):**
- ✓ Cards-as-tabs: DEM1 Demolition (4), CIV1 Civil works (3), ASB1 Asbestos removal (4), Other1 Other (5), + Add card trailing tab (PR B1.5)
- ✓ 4-code discipline system: DEM / CIV / ASB / Other (PR A1)
- ✓ Dotted WBS codes: DEM1.1, DEM1.2, DEM1.3, DEM1.4 (PR B1)
- ✓ Tender-level Markup field with "Reset all" button — top right 30% (PR B2)
- ✓ Per-card header strip: Peak crew (4), Labour days (14.3), Plant (—)
- ✓ Per-card Markup override field (30%) and Discipline dropdown (PR B2)
- ✓ Items table with per-row $ totals shown on collapsed header (PR B1.7.1)
- ✓ Item expansion shows MEN / DAYS row + Plant button + B4a dimensions row (Length / Height / Depth / Material / Density / SQM / M³ / Tonnes) + Waste row (Group / Item) (PR B1.7 + PR B4a)
- ✓ `+ Add row` per card
- ✓ Subtotal at bottom of card (Subtotal / with markup format)

**Math verification on DEM1.1 (Internal strip-out):**
- 4 men × 6 days × $600/day = $14,400 base labour
- × 1.30 markup factor = $18,720
- Item header shows $18,720 ✓
- Confirms PR B1.7.2 "remove waste from item total" fix is in place (waste belongs to dedicated subtable, not item total)

### Quote tab + Quote editor
- Versions list shows IS-T100-R1 DRAFT for Acme Infrastructure with Edit / New revision / PDF / Send / Delete actions
- Quote editor opens with 8 sub-tabs: **Cost Summary, Scope items, Provisional Sums, Cost Options, Assumptions, Exclusions, Terms & Conditions, Preview**
- "QUOTE CONTENTS — VISIBLE IN QUOTE" toggle row with 6 checkboxes (Scope of works table, Assumptions, Exclusions, Referenced drawings, Provisional sums, Cost options) — all checked. This is the ClientQuote.show* flags from C-chain that shipped early.
- Cost Summary: 4 cost lines pre-populated rolling up disciplines
  - Den / Internal strip-out, structural demolition, slab removal, masonry demolition / $245,000
  - Asb / Class A friable removal, Class B bonded removal, air monitoring, Form 65 / $185,000
  - Civi / Trench excavation, service reinstatement, hardstand works / $92,000
  - Con / Wall saw cuts, core drilling for service penetrations, surface grinding / $38,000
  - Total: $560,000
- Each cost line has Price + Adjusted columns (the adjustment column is the PR B2 markup adjustment surface)
- + Add cost line
- Client adjustment panel below ("Adjustment %" — internal, never shown on quote)

### Tendering Assistant (§5A.1 persona surface)
- Floating teal pill button bottom-right of every tender-scoped page (PR B1.8 draggable/minimisable)
- Click opens floating window with:
  - Header: "Tendering Assistant" + minimise + close
  - **Sub-mode-aware subtitle** ✓ — confirmed by tab switching:
    - On Quote tab: "**Quote** — estimating, costing, and client quotes"
    - On Scope tab: "**Scope** — propose and refine scope items"
  - **Sub-mode-aware empty state** ✓:
    - Quote: "Ask the Tendering Assistant about the quote and estimate."
    - Scope: "Ask the Tendering Assistant about scope drafting."
  - "+ New" conversation button
  - "History" button
  - Message input + Send (disabled when empty)
  - Settings gear icon bottom left
- PR #143 sub-mode binding **verified live in UI** ✓

## Findings (CONCERN level)

### F1B-01: Estimate tab merge into Scope of Works needs roadmap reconciliation
**Severity:** ACKNOWLEDGED (deliberate merge, but undocumented in module reference)
**Page:** `/tenders/:id` tab strip
**Observation:** The pre-build module reference (and the §5A.1 spec) implies an Estimate tab. Live UI has 3 tabs only: Overview / Scope of Works / Quote.

The B-chain reshape collapsed Estimate INTO Scope of Works (items now carry labour + plant + waste + per-row pricing inline; estimate-only fields moved to the item expansion). This is the right product decision but isn't recorded in the module-reference docs we built.

**Action:** Update `docs/sanity-check/module-reference/05-tendering-estimating.md` to reflect actual surface; note in roadmap as a documentation reconciliation, not a bug.

### F1B-02: Quote PDF rendering not tested in this pass
**Severity:** TODO (Phase 1B residual)
**Page:** Quote tab > PDF button OR Quote editor > Preview sub-tab
**Action:** Defer to time-permitting sweep. The §5A.2 HTML→PDF migration (PRs #220-#223) was signed off by Sean+Raj on 2026-05-26 so we have reason to trust it; but a smoke render against IS-T100 would be the belt-and-braces confirmation.

### F1B-03: Quote editor sub-tabs (Provisional Sums / Cost Options / Assumptions / Exclusions / Terms & Conditions / Preview) not individually verified
**Severity:** TODO (Phase 1B residual)
**Action:** Re-enter quote editor, cycle through each sub-tab, verify pre-populated content per IS-T100 fixture spec (2 provisional sums, 2 cost options, 8 linked assumptions, 7 exclusions, 21 T&C clauses).

## What's NOT verified yet (carry to follow-up)

- AI provider not configured in seed → cannot send a real prompt without an API key. Could verify via curl with a fake key to see error categorisation (PR #131 sanitiseProviderError surface)
- Drawing tools — IS-T020 has the seeded demo PDF per PR #146; haven't tested list_tender_drawings / extract_drawing_titleblock / read_tender_drawing from the persona UI
- Asbestos register reader (`read_asbestos_register`) — would need an IS-T020 conversation with an asbestos-tagged document
- lookup_rate tool across all 8 rate types
- Proposal acceptance flow (propose_scope_items / propose_estimate_items / propose_quote_content / propose_clarifications) — needs a connected AI provider
- Persona settings page (`/settings/ai` or gear icon target)
- Other sub-modes: tender-detail, clarifications, register, pipeline
- Tender CRUD: New tender flow, bulk-status update, filter presets, duplicate, soft-delete, cascade preflight, status changes, probability changes, assigned-estimator changes
- TenderEntry unified comms panel (PR #260) — need to navigate to a real (non-template) tender's Overview
- Scope of Works: card add/rename/delete, change discipline atomic cascade, item reorder, copy-from-above (waste + cutting), Sum-from-above, push-from-scope to quote
- Quote: cost lines reorder, scope items reorder + visibility toggles + reset, T&C reset per-clause and reset-all (PR #220 era)
- Estimate Export: PDF + Excel

## Verdict so far

Tendering core (the surfaces I touched) is the strongest part of the app. The §5A.1 + B-chain investment has clearly paid off — the UI matches the heavy roadmap activity from May 2026. Marco's "AI personas + sign-off gate" can proceed pending the items in the not-verified list above.
