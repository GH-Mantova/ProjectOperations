\# Scope of Works + Quote Arrangement — Design



\*\*Status:\*\* approved 2026-05-16, MVP (PRs A1-B3) targets next-week Sean+Raj demo; full arrangement screen (PRs C1-D1) ships post-demo.

\*\*Authority:\*\* Marco (MAIN, 2026-05-16). Decisions captured in this doc are canonical — code conforms to this, not to legacy patterns.

\*\*Predecessor PRs:\*\* Scope of Works module shipped with fixed SO/Str/Asb/Civ/Prv discipline cards (Phase 1 — PR chain pre-#80). Tendering persona system prompts (PR #142, #148, #149, #152, #161) referenced those discipline codes throughout.



\---



\## TL;DR



Replace the fixed 5-discipline scope-of-works layout (SO/Str/Asb/Civ/Prv cards) with user-named scope cards (tabbed UI), each containing a flexible scope-items table plus per-card concrete cutting and waste summary subtables. Add a separate Quote Arrangement screen (post-demo) that lets the user rearrange items into client-facing groupings without modifying the underlying Calculation Sheet. Simplify disciplines from 5 codes to 4 (DEM/CIV/ASB/Other).



\---



\## Motivation



\*\*Current state (pre-redesign):\*\*

\- Scope of Works tab has 5 hard-coded discipline cards (SO/Str/Asb/Civ/Prv). User can't add, remove, rename, or restructure them.

\- All concrete cutting work lives in one global table on the tender, not scoped to specific scope items.

\- All waste lives in a similar global table.

\- Quote PDF generation is tightly coupled to the discipline structure — high-level summarising and per-client customisation are limited.



\*\*Problems Raj and Sean have surfaced:\*\*

1\. Real tenders don't fit cleanly into 5 disciplines. Estimators want to group work the way they think about it (e.g., "Level 1 strip-outs", "Block A demolition", "External works").

2\. Concrete cutting belongs WITH the scope item it serves, not as a global afterthought.

3\. Different clients should be able to receive the same scope as different quote presentations — one client gets a high-level total, another gets full line-item detail.

4\. The fixed discipline labels (SO/Str — strip-outs vs structural) don't match how IS actually thinks about work. Demolition is the umbrella; provisional/cost-options/adjustments don't deserve their own discipline.



\*\*This redesign addresses all four.\*\*



\---



\## Architecture overview



Two layers, cleanly separated:



```

┌─────────────────────────────────────────────────────────────────┐

│ Layer 1: Calculation Sheet (Scope of Works tab)                 │

│ Source of truth. One per tender. Shared across all clients.     │

│                                                                  │

│ Cards (user-named, tabbed) ─┬─ Scope items table                │

│                             ├─ Concrete cutting subtable        │

│                             └─ Waste summary subtable           │

└─────────────────────────────────────────────────────────────────┘

&#x20;                             │

&#x20;                             ▼ (read-only feed)

┌─────────────────────────────────────────────────────────────────┐

│ Layer 2: Quote Arrangement (per quote, per client)              │

│ Presentation layer. Multiple per tender (one per client/rev).   │

│ Drag/drop/group/hide/rename, autosaves.                         │

│ Renames push back to Layer 1 via explicit button only.          │

└─────────────────────────────────────────────────────────────────┘

&#x20;                             │

&#x20;                             ▼ (render)

┌─────────────────────────────────────────────────────────────────┐

│ Layer 3: Quote PDF (per quote arrangement)                      │

│ Reflects arrangement state at PDF generation time.              │

└─────────────────────────────────────────────────────────────────┘

```



\*\*Key invariant:\*\* The Calculation Sheet is shared. Each client's quote arrangement is independent and never affects the Calculation Sheet except through the explicit "Change Quote details" button (renames only).



\---



\## Disciplines



\*\*Old (5):\*\* SO (Strip-outs), Str (Structural), Asb (Asbestos), Civ (Civil), Prv (Provisional)



\*\*New (4):\*\* DEM (Demolition), CIV (Civil), ASB (Asbestos), Other



\*\*Migration mapping:\*\*



| Old | New |

|---|---|

| SO  | DEM |

| Str | DEM |

| Asb | ASB |

| Civ | CIV |

| Prv | Other |



Both Strip-outs and Structural collapse into Demolition (DEM). Other catches Provisional, cost options, adjustments, and anything that doesn't fit DEM/CIV/ASB.



\*\*System-wide implications:\*\*

\- Database enum migration with data remap

\- All persona system prompts that reference IS scope codes (`apps/api/src/modules/personas/definitions/tendering.persona.ts`, `apps/api/src/modules/personas/definitions/shared-prompts.ts`, `apps/api/src/modules/tendering/tender-scope-drafting.service.ts`) need updating to use the new 4-code system

\- Tender reports / dashboards that filter by discipline get new options

\- Seed data needs new codes

\- Existing tender records get their discipline tags remapped via migration



\---



\## Calculation Sheet (Scope of Works tab) — detailed design



\### Cards as tabs



Cards render as a horizontal tab strip across the top of the Scope of Works content area.



\*\*Tab content (per card):\*\*

\- Drag handle (left) — drag to reorder

\- Card name (editable — double-click to rename inline)

\- Discipline badge (DEM/CIV/ASB/Other — colour-coded)

\- Card `$` total (auto-calculated)

\- Delete `×` (with confirmation)



\*\*Tab behaviour:\*\*

\- Click tab → switch active card

\- Double-click tab name → rename inline

\- Drag tab → reorder (within the Calculation Sheet — this is entry order)

\- `×` → delete card with confirmation

\- Horizontal scroll when tabs overflow



\*\*Active tab visual:\*\* underline + darker text (matches the existing Overview/Scope of Works/Quote tab styling).



\*\*`+ Add new scope item`\*\* button stays in the page section header (top-right), not in the tab strip. It creates a new card and switches focus to it.



\*\*Discipline badge colours (proposal):\*\*

\- DEM — neutral grey

\- CIV — neutral grey

\- ASB — warning amber (asbestos is high-attention work — visual flag matches existing convention)

\- Other — neutral grey



\### Active card body — three always-visible subtables



When a tab is active, the card body renders three subtables stacked vertically:



1\. \*\*Scope items table\*\* (top)

2\. \*\*Concrete cutting subtable\*\* (middle — Cutting / Coring / Other tabs preserved)

3\. \*\*Waste summary subtable\*\* (bottom)



All three are \*\*always visible\*\*. New cards show all three with their column headers and an `+ Add row` button — no opt-in click required. Empty subtables just show their headers + the add-row button.



Rationale: simpler UX (always-predictable layout), removes a click, makes the structure self-documenting.



\### Scope items table — columns



| Column | Type | Notes |

|---|---|---|

| Description | text | Free text describing the line item |

| Men | number | Number of workers |

| Days | number | Number of days |

| Plant 1 | dropdown | From IS plant list. `+` button beside header adds Plant 2, Plant 3, etc. (whole-table columns). `×` button removes the column. |

| Waste group | dropdown | From existing waste groups table |

| Waste item | dropdown | From existing waste items table (filtered by waste group) |

| Unit | dropdown | m², m³, t, ea — for waste calc only |

| Value | number | Quantity in the chosen unit |

| Waste? | checkbox | Per-row. When ticked, this row contributes to the auto-generated waste summary below. |

| Notes | text | Free-text per-row notes |

| Delete | button | Per-row delete |



`+ Add row` button is always visible at the bottom of the table as the last row, adds a blank row to the table.



\*\*Plant column expansion:\*\* clicking `+ Plant` on the column header adds a new Plant N column visible on all rows in the table. Existing rows get a blank dropdown for the new column. Empty cells in Plant 2+ are acceptable (no auto-collapse). User can remove a Plant column via `×` on its header.



\*\*Unit column:\*\* drives the waste summary calculation only. Doesn't affect the card's $ total (which comes from the rate engine via Men/Days/Plant). Possible units: m², m³, t, ea. Tonnage and m³ are most useful since tips charge by either. Smaller list keeps the dropdown focused.



\### Concrete cutting subtable



Same structure as today's global concrete cutting table, but scoped per-card.



\- Three tabs: Cutting / Coring / Other

\- Existing row structure preserved (equipment, elevation, material, depth, length, etc.)

\- `+ Add row` button always visible as the last row of each tab

\- The card's $ total includes all cutting line costs



\### Waste summary subtable



Two row sources:



1\. \*\*Auto-generated rows\*\* (badge: `auto`):

&#x20;  - One row per (waste group + waste item) combination present in the scope items table where the `Waste?` checkbox is ticked

&#x20;  - Calculates tonnage and m³ from the Unit column values, aggregating duplicates

&#x20;  - Refreshes when underlying scope rows change

&#x20;  - User can edit auto-generated rows (overrides the calculation for that row — flag remains visible but the value is now user-driven)



2\. \*\*Manual rows\*\* (badge: `manual`):

&#x20;  - User-added via `+ Add manual row` button

&#x20;  - For waste that doesn't tie to a specific scope item (e.g., dust + debris from the work itself)



\*\*Columns:\*\*

\- Waste group (dropdown from existing waste groups)

\- Waste item (dropdown from existing waste items, filtered by group)

\- Tonnage (number)

\- m³ (number)

\- Source (`auto` or `manual` badge)

\- Delete (button)



`+ Add manual row` button always visible at the bottom.



\### Card $ total



Auto-calculated, displayed top-right of active card and on each tab.



Calculation = sum of all costs across all subtables (scope items + concrete cutting + waste summary), using the existing rate engine. Calculated at input time (rates fetched live as fields change).



A line with 0 Men, 0 Days, 0 Plant, 0 cutting still counts toward the total if it has waste with a tip cost. Empty rows contribute $0.



\### System-generated IDs



Every line item across every subtable (scope items, cutting, coring, other-cutting, waste-auto, waste-manual) gets a system-generated UUID at creation time. UUIDs are:



\- Persistent — survive page reload, scope edits, anything except explicit row delete

\- Referenced by the Quote Arrangement layer to track which item is which

\- Never displayed to the user (internal only)

\- Used by the database as the primary key of the line-item record



Necessary for the arrangement screen to maintain stable references across reloads.



\---



\## Quote Arrangement (post-MVP)



\*\*Not in the demo MVP. Post-demo.\*\* Sketched here so PRs A1-B3 don't accidentally close off design space we need later.



\### Trigger



User opens the Quote tab. At the top: a Client selector dropdown (Option A). Below it: a quote selector (per-client quotes with revisions). Selecting a quote opens its arrangement.



\### Arrangement screen layout



Pivot-style table populated by reading the current Calculation Sheet via the system-generated UUIDs. Renders as a hierarchical list of headers and rows.



\*\*Initial state (first open or after "Reset to original"):\*\*

\- One header per Calculation Sheet card, in the same order

\- All headers expanded showing all their line items

\- All items visible (none hidden)



\*\*User actions:\*\*



| Action | Scope |

|---|---|

| Click header collapse/expand chevron | Header level — show name+total only vs. name+total+all lines |

| Click line collapse/expand | Line level — within an expanded header, can collapse individual lines |

| Drag handle on header | Reorder headers |

| Drag handle on line | Move line to a different header, or reorder within current header |

| `+ New header` button | Creates a new presentation-only header (default discipline: Other). User can drag lines into it. Does NOT create a new Calculation Sheet card. |

| Rename header inline | Renames presentation-only OR (if it maps to a Calc Sheet card) marks the rename as "pending push back to Calc Sheet" |

| Rename line description inline | Same as header rename — pending push back |

| `×` (hide) on header | Excludes from quote PDF entirely. Card $ total excludes hidden lines (P6: hide = exclude from totals). |

| `×` (hide) on line | Same as above, line-level. |

| Delete line | Hides from THIS arrangement only. Calculation Sheet is unaffected. The line can be restored via "Reset to original". |



\### Buttons at the bottom



| Button | Behaviour |

|---|---|

| \*\*Autosave indicator\*\* | Visible status — saved/unsaved/saving |

| \*\*Reset to original\*\* | Wipes arrangement, regenerates from current Calculation Sheet state. All renames, regroupings, hides discarded. Confirmation required. |

| \*\*Change Quote details\*\* | Pushes the rename changes (and ONLY renames) back to the Calculation Sheet. Updates the card names and line descriptions on the underlying scope cards. Order, grouping, hide, new-header decisions stay on this arrangement only. |

| \*\*Generate PDF\*\* | Renders the PDF using the current arrangement state. |



\### Per-client / per-quote arrangement



The arrangement is \*\*per quote\*\*, not per tender. Each client has their own quote(s) for the same tender. Each quote has its own arrangement state.



Example:

\- Tender IS-T020 has Calculation Sheet with 4 cards (DEM/DEM/ASB/Other)

\- Client A receives Quote #1 — arrangement collapses all cards to summary-only, no line items shown

\- Client B receives Quote #1 — arrangement shows all detail

\- Both quotes generate different PDFs from the same source-of-truth Calculation Sheet



\### Cross-card pull-out



User can pull lines from any card into a new header. Use case: pulling all concrete cutting lines from all cards into a single "Concrete cutting" header at the bottom of the PDF, so the client sees cutting work consolidated.



This is presentation-only. The underlying Calculation Sheet keeps cutting lines inside their parent cards.



\---



\## Persona implications



The Tendering Assistant persona (system prompts, tool definitions, scope items) needs to understand:



1\. \*\*Disciplines have changed:\*\* DEM/CIV/ASB/Other instead of SO/Str/Asb/Civ/Prv. All prompts that name disciplines need updating.

2\. \*\*Cards are user-named:\*\* the persona can no longer assume a fixed discipline-named card exists. It must work with whatever cards the user has created (or create new ones if proposing scope items).

3\. \*\*Concrete cutting is per-card:\*\* `lookup\_rate` and cutting-related tools need to know which card they're operating in.

4\. \*\*Waste summary is per-card:\*\* auto-aggregation depends on what's in the parent card's scope items.

5\. \*\*Calculation Sheet vs arrangement:\*\* the persona always works on the Calculation Sheet (source of truth). It does not modify the arrangement.



\*\*Affected files (initial scan):\*\*

\- `apps/api/src/modules/personas/definitions/tendering.persona.ts` — persona description, sub-mode descriptions

\- `apps/api/src/modules/personas/definitions/shared-prompts.ts` — `GLOBAL\_RATE\_FABRICATION\_PROHIBITION` (no discipline mentions, no change needed)

\- `apps/api/src/modules/tendering/tender-scope-drafting.service.ts` — has its own `SYSTEM\_PROMPT` const, references IS scope codes — needs DEM/CIV/ASB/Other

\- `propose\_scope\_items` tool input schema — discipline enum

\- `lookup\_rate` tool — needs awareness of which card we're in (parameter addition)

\- Regression test specs (`tendering-assistant.system-prompt.regression.spec.ts`, `rate-lookup-policy.prompt.spec.ts`) — assert content about old disciplines, need updating



\*\*Untouched persona scope (defer to post-MVP):\*\*

\- Drawing tools (`list\_tender\_drawings`, `extract\_drawing\_titleblock`, `read\_tender\_drawing`) — don't reference scope structure, unaffected

\- Persona registry / multi-turn loop / tool dispatcher — structurally unaffected



\---



\## PR breakdown



\### MVP (target: Sean+Raj demo next week)



\*\*PR A1 — Discipline migration\*\*

\- Database enum migration: SO/Str/Asb/Civ/Prv → DEM/CIV/ASB/Other

\- Data remap on existing tender records

\- Update all persona system prompts that name disciplines

\- Update tool schemas (`propose\_scope\_items` discipline enum)

\- Update regression test assertions

\- No UI changes yet



\*\*PR A2 — Database schema for new line-item structure\*\*

\- New `ScopeCard` table (user-named cards, replaces fixed disciplines)

\- `ScopeItem`, `ConcreteCuttingLine`, `WasteLine` tables with UUIDs as primary keys

\- Foreign-key relationships

\- Migration to convert existing global cutting/waste tables into per-card structure

\- Decision needed: how to map old data — probably one Card per current discipline, all cutting in one card, all waste in one card. To be confirmed in PR spec.



\*\*PR B1 — New Scope of Works UI: cards as tabs + scope items table\*\*

\- Replace fixed 5-card layout with horizontal tab strip

\- `+ Add new scope item` button creates a new card

\- Tab interactions: click, drag, rename, delete

\- Scope items table with all columns (Description, Men, Days, Plant 1+, Waste group, Waste item, Unit, Value, Waste?, Notes)

\- `+ Plant` column expansion

\- `+ Add row` always visible

\- Card $ total at top-right of active card and on each tab



\*\*PR B2 — Per-card concrete cutting subtable\*\*

\- Move global concrete cutting table to per-card subtable

\- Three tabs preserved (Cutting / Coring / Other)

\- `+ Add row` always visible on each tab

\- Card $ total now includes cutting line costs

\- Migration of existing concrete cutting data into the new per-card structure



\*\*PR B3 — Per-card waste summary subtable\*\*

\- Auto-generated rows from scope items where `Waste?` is ticked

\- Manual rows via `+ Add manual row`

\- Tonnage + m³ columns

\- Auto/manual badges

\- Auto rows are editable (overriding the calculation)

\- Card $ total includes waste line costs (tip charges)



\### Post-MVP (after demo)



\*\*PR C1 — Quote Arrangement screen base\*\*

\- Client picker dropdown on Quote tab

\- Quote selector below client picker

\- Arrangement screen layout — read Calculation Sheet, render pivot

\- Autosave infrastructure



\*\*PR C2 — Drag-and-drop + grouping\*\*

\- Drag headers to reorder

\- Drag lines between/within headers

\- `+ New header` button creates presentation-only header



\*\*PR C3 — Collapse / expand / hide\*\*

\- Per-header collapse/expand chevrons

\- Per-line collapse/expand

\- Hide actions for both

\- Hidden items excluded from totals (P6 decision)



\*\*PR C4 — Change Quote details + Reset to original\*\*

\- "Change Quote details" pushes rename changes back to Calculation Sheet

\- "Reset to original" regenerates from current Calculation Sheet

\- Confirmation dialogs for both



\*\*PR D1 — Quote PDF respects arrangement\*\*

\- PDF generation reads from arrangement state, not directly from Calculation Sheet

\- Per-arrangement client-facing output

\- Existing PDFKit logic adapted (or migrated to HTML→PDF if 5A.2 has progressed)



\### Total scope



9 PRs (4 MVP + 5 post-demo). Demo-readiness is achieved at PR B3 with the existing Quote PDF generator continuing to work via a compatibility layer (Calculation Sheet → existing quote pipeline). Arrangement screen is purely additive.



\---



\## Open questions deferred to PR specs



These don't block design approval but need answers when drafting each PR:



1\. \*\*A2:\*\* How exactly do existing tender records map to the new card structure? One card per old discipline? Per-tender custom?

2\. \*\*B2:\*\* Existing concrete cutting tables — do they get split by inferring which scope item they relate to, or all get lumped into one card?

3\. \*\*B3:\*\* When the user toggles `Waste?` checkbox on a scope row, does the corresponding auto waste row appear immediately, or only when the user moves focus / saves? (Probably immediately — live calculation.)

4\. \*\*C1:\*\* Where do client-facing quote names come from? Client.name? Or a per-quote name field?

5\. \*\*D1:\*\* If 5A.2 (HTML→PDF migration) hasn't shipped by demo, do we ship PDF generation through the existing PDFKit pipeline as a stopgap, or block on 5A.2 first?



\---



\## Non-goals (explicitly out of scope)



\- Estimate module changes (separate Phase 6 deferred item)

\- Variation / Schedule of Rates / Contract PDF changes (5A.2 territory)

\- Field worker module changes (separate phase)

\- AI persona tool expansion beyond what's needed for the new structure

\- Client portal updates (separate JWT subsystem, separate phase)

\- Multi-tender batch operations

\- Bulk import / export of scope items

\- Rate library changes (existing rate engine wired in as-is)



\---



\## Migration risks



1\. \*\*Data loss on discipline remap\*\* — existing tender records have SO/Str/Asb/Civ/Prv strings in various columns. Migration must remap every column. Audit needed.

2\. \*\*Persona system prompts on production drift\*\* — once persona prompts mention DEM but production data still has Str records, the AI gives wrong advice. PR A1 must ship the prompt change + data migration together.

3\. \*\*Cutting/waste table consolidation\*\* — collapsing global cutting/waste tables into per-card structure requires deciding which card each historical line belongs to. Options: (a) attach all to a single "Migrated cutting" / "Migrated waste" card per tender, (b) attempt heuristic matching, (c) require manual remap. Option (a) is safest, cheapest.

4\. \*\*Demo time pressure\*\* — if MVP slips past demo, fallback is showing the existing UI. Don't promise the new UI to Sean+Raj until PR B3 is shipped + smoke-tested.



\---



\## Approval



This design is the canonical reference. Any deviation in any PR spec must update this doc first, then the spec, then code.



— end of doc —

## C-chain — Phase 0 discovery findings (2026-05-18)

**Status:** investigation complete, no code written. C1 implementation
prompt to be written by MAIN in a follow-up session based on findings
below.

**Base SHA at investigation time:** `f755f70181355625b3ff958a50d7b316dcd534f0` (chore #192, post docs/discipline #191)
**Tests at investigation time:** API 599 pass / 6 skip; web 148

### 1. Codebase inventory

#### 1.1 Quote-related schema (from `apps/api/prisma/schema.prisma`)

The Quote layer is **substantially built** already. C-chain will
restructure and add presentation state, not start from scratch.

| Model | Table | Key fields | Scoped by |
|---|---|---|---|
| `Client` (line 401) | `clients` | name, abn, address, payment terms, bank details | (root) |
| `TenderClient` (line 739) | `tender_clients` | `isAwarded`, `contractIssued`, `relationshipType`, FK contactId | `tenderId` |
| `ClientQuote` (line 2828) | `client_quotes` | `quoteRef` (unique), `revision`, `status`, `adjustmentPct/Amt`, `assumptionMode`, **6× show* flags** (`showProvisional`, `showCostOptions`, `showScopeTable`, `showAssumptions`, `showExclusions`, `showReferencedDrawings`), `detailLevel`, `sentAt`, `generatedPdfPath` | `tenderId + clientId` |
| `QuoteCostLine` (line 2870) | `quote_cost_lines` | label, description, price, **sortOrder**, **isVisible** | `quoteId` |
| `QuoteProvisionalLine` (line 2885) | `quote_provisional_lines` | description, price, notes, **sortOrder** | `quoteId` |
| `QuoteCostOption` (line 2898) | `quote_cost_options` | label, description, price, notes, **sortOrder** | `quoteId` |
| `QuoteAssumption` (line 2912) | `quote_assumptions` | text, **sortOrder**, optional FK to `QuoteCostLine` (linked-vs-free mode) | `quoteId` |
| `QuoteExclusion` (line 2926) | `quote_exclusions` | text, **sortOrder** | `quoteId` |
| `QuoteEmail` (line 2937) | `quote_emails` | sentTo[], subject, bodyPreview, sentAt, sentById | `quoteId` |
| `QuoteScopeItem` (line 2381) | `quote_scope_items` | `sourceItemId`/`sourceItemType` (provenance), label, description, qty, unit, notes, **sortOrder**, **isVisible** | `quoteId` |

**Key finding:** every sub-table already has `sortOrder` + most have
`isVisible`. The "Arrangement screen" largely DRIVES existing
fields rather than introducing new ones. `QuoteScopeItem` already
carries provenance back to a source scope item — exactly the
"calc-sheet → arrangement" link the C-chain needs.

**`ClientQuote.showXxx` flags** are presentation toggles already
shipped — C3's "collapse / expand / hide" semantics may map
cleanly onto these for whole-section visibility, with finer-grain
per-row visibility via `isVisible` on the sub-tables.

**No `cardId` FK** on any quote model — quotes are tender-scoped,
not card-scoped (correct: cards are an estimating-side concept; the
arrangement pivots cards into a client-facing view).

#### 1.2 Quote-related backend routes

| Controller file | Route prefix | Surface area |
|---|---|---|
| `client-quotes.controller.ts` | `tenders/:tenderId/quotes` | Full CRUD on quote + cost-lines / provisional-lines / cost-options / assumptions (with reorder + copy-from-tender) / exclusions / summary |
| `quote-scope-items.controller.ts` | `tenders/:tenderId/quotes/:quoteId/scope-items` | CRUD + **reorder + reset + push-from-scope** — the primitive of "regenerate arrangement from Calc Sheet" already exists in basic form |
| `quote.controller.ts` | `tenders/:tenderId` | T&Cs, tender-level assumptions / exclusions (the per-tender pool that copy-from-tender pulls from), exports |
| `tender-clients.controller.ts` | `tenders/:tenderId/clients` + `tendering/clients/search` | Client picker primitives + tender-client linking |

**Key finding:** `push-from-scope` (POST `/scope-items/push-from-scope`)
on quote-scope-items is the C-chain's "regenerate from Calc Sheet"
primitive in embryonic form. C1 should review what it currently
does and decide whether to extend or replace it.

#### 1.3 Quote-related frontend

| File | LOC | Summary |
|---|---|---|
| `ClientQuotesPanel.tsx` | 2122 | Per-client quote editor. Contains: `ClientRow`, `QuoteContentsPanel`, `QuoteEditor`, and tab components `CostTab` / `ProvisionalTab` / `OptionsTab` / `AssumptionsTab` (free + linked variants) / `ExclusionsTab` / `PreviewTab`. **Drag-and-drop already wired via `@dnd-kit/core` + `@dnd-kit/sortable`**; `SortableQuoteRow` + `StaticQuoteRow` co-exist. |
| `QuoteTab.tsx` | 816 | Outer tab on the tender detail page; renders the per-discipline scope summary + mounts `ClientQuotesPanel`. Already uses 4-code discipline labels (`DEM/CIV/ASB/Other`). |
| `SendQuoteModal.tsx` | 269 | Send-quote UI — recipient picker, body preview, send action. |

**Key finding:** the "Arrangement screen" the design doc envisions
is **partially built already as `ClientQuotesPanel`**. The C-chain
work is more "extend / restructure / add per-quote pivot view"
than "build from scratch". `dnd-kit` is the existing dnd library —
C2's drag-and-drop should reuse it.

**No discrete pivot-table component exists.** The C-chain's
arrangement-screen pivot (cards as columns, quotes as rows, or vice
versa) is genuinely new UI on top of the existing data layer.

#### 1.4 Quote PDF pipeline (current state)

- File: `apps/api/src/modules/estimate-export/pdf/quote-pdf.builder.ts` (1173 LOC)
- Stack: **PDFKit** (per file header: "Server-side PDF builder using PDFKit primitives only. No headless browser, no HTML rendering — intentional for stability.")
- Reads from: `fetchTenderForExport` — `ScopeOfWorksItem + CuttingSheetItem + TenderTandC + TenderAssumption + TenderExclusion`
- **Reads directly from scope tables**, not from `QuoteScopeItem`. D1's job is to rewire this to honour per-quote arrangement.
- 5A.2 HTML→PDF migration: **not shipped**. Q5 status: OPEN.

#### 1.5 Persona implications (current state)

- `disciplines.ts` exports `IS_DISCIPLINE_CODES = ["DEM", "CIV", "ASB", "Other"]` — canonical 4-code confirmed.
- `tendering.persona.ts` has a `QUOTE_SUBMODE_PROMPT` block (persona is already aware of quote workflow).
- **No mentions of "arrangement", "Calculation Sheet", or "arrangement screen"** in the persona prompts. C-chain implementation should include a persona update introducing the **Calc-Sheet-as-source-of-truth invariant** ("the persona always works on the Calculation Sheet, never on the Arrangement; the Arrangement is a client-facing presentation layer derived from the Calc Sheet").

### 2. Data shape probes (dev DB, 2026-05-18)

#### 2.1 Quote inventory by tender

```
            id             |                         title                         | quote_count
---------------------------+-------------------------------------------------------+-------------
 cmonoidox00rlubccg27ce18n | Brisbane Grammar School — Science Block refurbishment |           1
 cmonv7yz50004ub601c0knolv | Compliance Tender 1777697548014                       |           0
 (… 18 more tenders, all with quote_count = 0)
```

Only IS-T020 has a quote. 19 of 20 sampled tenders have zero
quotes (typical for early-stage tenders). C-chain demo data
generation may want to seed quotes against more tenders to
showcase the arrangement UI populated.

#### 2.2 Client inventory

8 clients total. 5 seed clients (`client-001` … `client-005`) +
3 cuid-style additions (Brisbane Grammar School is the one with an
ABN — that's IS-T020's tender client).

#### 2.3 TenderClient inventory

85 tender-client links across the dev DB. Per-tender many-to-many
between clients and tenders works as expected. Sample:

```
         tender_id         |         client_id         | is_awarded
---------------------------+---------------------------+------------
 cmoo6vij90004ubo8ghmj2lyl | client-003                | t
 cmoo6vij90004ubo8ghmj2lyl | cmonoidla00p0ubccu7898lnw | f
```

Multiple clients per tender (one awarded, others not) — the
arrangement screen will need to handle this when picking which
client's quote to view/build.

#### 2.4 Quote sub-table counts (dev)

```
      source       | count
-------------------+-------
 cost_lines        |     3
 scope_items       |     0
 provisional_lines |     1
 cost_options      |     0
 assumptions       |     4
 exclusions        |     7
```

`quote_scope_items` is empty — the "push from scope" primitive
exists but hasn't been used in dev yet. C1 will populate this on
quote creation.

#### 2.5 IS-T020 scope state

```
 cards
-------
     4
```

| card_id | items |
|---|---|
| `…-card-ASB` | 2 |
| `…-card-CIV` | 1 |
| `…-card-DEM` | 4 |
| `…-card-Other` | 1 |

Eight scope items total across 4 cards. The C-chain pivot will
have a tractable demo dataset.

### 3. Design-doc open questions — status

**Q1 (PR A2 / B-chain): How exactly do existing tender records map to the new card structure?**
- **Status:** RESOLVED
- **Finding:** Shipped via A2 + B-chain. Cards exist per tender × discipline; existing scope items migrated to their natural cards.

**Q2 (PR B2 / B4b): How do existing concrete cutting tables get split by inferring which scope item they relate to?**
- **Status:** RESOLVED
- **Finding:** B4b shipped Copy-from-above with material auto-inference + cardId FK. B-followup deleted the 2 pre-card-scoping cutting orphans and made `card_id` NOT NULL on both cutting + waste tables.

**Q3 (PR B3): Does waste auto-row appear immediately when Waste? checkbox toggles?**
- **Status:** RESOLVED (verified from shipped behaviour)
- **Finding:** No — the `Waste?` toggle in `ScopeQuantitiesTable.tsx` fires `onPatch({ wasteIncluded: ... })` immediately, but only persists the flag. The waste summary row only appears when the user explicitly clicks "Sum from above" on the waste subtable. Matches B3's stated design (user-driven regeneration; manual rows survive).

**Q4 (PR C1): Where do client-facing quote names come from? Client.name? Per-quote name field?**
- **Status:** OPEN — central C1 decision
- **Finding:** `ClientQuote` has `quoteRef` (unique, machine-style) and `revision` (Int) but **NO** human-friendly `name` / `title` / `displayName` column. `Client.name` exists. The natural display name today is `${Client.name} — Rev ${revision}` (e.g. "Brisbane Grammar School — Rev 1") or `${quoteRef}`.
- **Recommendation:** Start with `Client.name + revision` as the displayed name (zero schema work). If estimators ask for per-quote labels later (e.g. two parallel quote variants for the same client), promote to a nullable `displayName` column on `ClientQuote` in a follow-up. This keeps C1 small while preserving the upgrade path.

**Q5 (PR D1): If 5A.2 (HTML→PDF migration) hasn't shipped by demo, stopgap on PDFKit or block on 5A.2?**
- **Status:** OPEN
- **Finding:** 5A.2 has **not** shipped. `quote-pdf.builder.ts` is still PDFKit (its file header explicitly notes "intentional for stability"). HTML→PDF is not in the dependency graph (`puppeteer` / `playwright PDF` search returned nothing).
- **Recommendation:** **Stopgap on PDFKit.** D1's job is to make the PDF respect arrangement; that's a "what to render" change, not a "how to render" change. PDFKit can read from `QuoteScopeItem` + the `ClientQuote.show*` flags + per-line `isVisible` + per-line `sortOrder` exactly as well as HTML would. Coupling C-chain to 5A.2 would block the demo on a sibling migration that has its own scope; the stability argument in the file header still applies.

### 4. Refined C-chain PR breakdown

Post-discovery, the C-chain is **smaller than the design doc
sketched** because so much plumbing already exists. Re-scoping:

**PR C0 — NOT NEEDED.** Discovery did not surface any pre-work
required. Existing Quote tab can be progressively replaced.

**PR C1 — Quote Arrangement screen base** — complexity: **M**
- **Scope:**
  - New "Arrangement" view inside the Quote tab (alongside or
    replacing the current `ClientQuotesPanel`'s editor — TBD)
  - Client picker (reuse `tendering/clients/search` endpoint)
  - Create / select a quote per `(tender, client)` pair
  - Populate `QuoteScopeItem` from the Calc Sheet on quote
    creation (extend existing `push-from-scope` if needed)
  - Display quote-scope-items as a flat list with the existing
    `sortOrder` driving order
  - Use `Client.name + Rev ${revision}` as displayed quote name (Q4 recommendation)
- **Out:** drag-and-drop, hide/collapse, grouping (those are C2 / C3)
- **Files touched:** mostly `ClientQuotesPanel.tsx` + 1-2 new backend handlers; no schema changes if Q4 recommendation accepted
- **Tests:** ~6-10 specs around the push-from-scope extension + client picker

**PR C2 — Drag-and-drop + grouping** — complexity: **M**
- **Scope:**
  - Reuse existing `@dnd-kit` wiring on `QuoteScopeItem` rows
  - Group-by-source-card pivot (rows grouped by their `sourceItemId`'s card)
  - Update `sortOrder` on drag-end via existing reorder endpoint
- **Schema:** likely none; existing `sortOrder` does the work. May need a `groupId` or similar if grouping needs to persist independently of card boundaries — defer decision to C2's discovery
- **Files touched:** mostly `ClientQuotesPanel.tsx`
- **Tests:** ~4-6 specs around reorder semantics + group integrity

**PR C3 — Collapse / expand / hide** — complexity: **S**
- **Scope:**
  - Per-row hide via existing `QuoteScopeItem.isVisible`
  - Per-section collapse/expand for the 6 `ClientQuote.showXxx` flags
  - Optional: per-row "collapsed" state if rows need to fold (likely just CSS)
- **Schema:** none — existing flags + `isVisible` suffice
- **Files touched:** mostly frontend
- **Tests:** ~3-4 specs

**PR C4 — Change Quote details + Reset to original** — complexity: **S/M**
- **Scope:**
  - Edit `Client.name` displayed override (the Q4 follow-up if estimators ask) OR per-quote labels via a new `displayName` column
  - "Reset to original" = re-run `push-from-scope` (already exists) + clear `isVisible` / `sortOrder` overrides
  - "Reset this row" = revert one `QuoteScopeItem` to its source
- **Schema:** possibly `+ClientQuote.displayName String?` if Q4 follow-up is in scope
- **Tests:** ~5-7 specs around reset semantics + override behaviour

**PR D1 — Quote PDF respects arrangement** — complexity: **M**
- **Scope:**
  - Modify `quote-pdf.builder.ts` to read from `QuoteScopeItem` instead of (or in addition to) raw scope items
  - Honour `isVisible`, `sortOrder`, `ClientQuote.show*` flags
  - Per-section heading from group-by-source-card pivot (matches C2)
  - Stopgap on PDFKit (Q5 recommendation accepted)
- **Schema:** none
- **Files touched:** `quote-pdf.builder.ts` + `estimate-export.service.ts` (the upstream fetch)
- **Tests:** ~4-6 PDF-builder specs against a fixture quote

### 5. Recommendations for MAIN before writing the C1 prompt

1. **Confirm Q4 answer** (per-quote name vs Client.name fallback). Recommended: Client.name + revision in C1; promote to per-quote `displayName` in C4 only if requested.
2. **Confirm Q5 answer** (PDFKit stopgap vs block on 5A.2). Recommended: stopgap on PDFKit — D1 is a "what to render" change, decoupled from HTML migration's "how to render".
3. **Decide on `push-from-scope` extension vs replacement.** The endpoint already exists at POST `/tenders/:tenderId/quotes/:quoteId/scope-items/push-from-scope`. C1 should either (a) extend it to handle the full Calc-Sheet → Arrangement materialisation, or (b) ship a new endpoint and deprecate this one. Discovery didn't open the handler — C1's implementation prompt should include a Phase 0 reading of what it currently does so the decision is informed.
4. **Decide the C1 frontend boundary**: extend `ClientQuotesPanel.tsx` (currently 2122 LOC, already organised into per-quote tabs) vs build a new arrangement-screen component. Recommended: extend in place. The existing structure (ClientRow → QuoteContentsPanel → QuoteEditor → tab components) is the right place to add an "Arrangement" tab alongside Cost / Provisional / Options / Assumptions / Exclusions / Preview.
5. **Persona update**: C1 (or any C-chain PR) should add the Calc-Sheet-as-source-of-truth invariant to `tendering.persona.ts`'s QUOTE_SUBMODE_PROMPT. Discovery confirmed this rule is not yet in the persona prompt.

### 6. Out-of-scope notes captured during discovery

- **Demo data thin on the Quote side.** Only IS-T020 has a quote; only 3 cost lines + 1 provisional line + 7 exclusions + 4 assumptions across the whole dev DB. C1's demo prep may want a seed-data PR adding 2-3 more quotes to populate the arrangement screen visually.
- **TenderClient model is rich** — has `isAwarded`, `contractIssued`, `relationshipType`, etc. The arrangement screen's client picker may want to surface "awarded" / "primary" status to help estimators distinguish the awarded client from also-rans. Not in scope for C1 but worth a UX note.
- **`assumptionMode` on `ClientQuote`** has values `"free"` and (presumably) `"linked"`. The current `QuoteAssumption` model supports both modes (optional FK to `QuoteCostLine`). C3's "collapse / hide" UI should respect this — linked assumptions probably auto-hide when their cost line is hidden, which is a non-trivial UX detail to confirm with estimators.
- **`generatedPdfPath` on `ClientQuote`** suggests PDFs are cached. D1 should think about cache invalidation when arrangement changes.

— end of C-chain Phase 0 discovery —

## Fix Map (2026-05-18)

**Status:** triage complete, no fixes shipped. Decided per-bug after
review by MAIN whether each ships as its own PR or grouped.

**Base SHA at triage time:** `78c7b049947e486941dac285bf456650962c2f03` (post chore #194)
**Tests at triage time:** API 599 pass / 6 skip; web 148

### Summary table

| ID | Title | Severity | Suspected cause | Fix complexity | Blocks/Blocked-by |
|---|---|---|---|---|---|
| B01 | Job detail blank page (/jobs/job-001) | BLOCKER | Frontend render exception with no error boundary OR auth/session edge case; backend + DB look fine | M | Blocks B04 visual verify |
| B02 | POST /api/v1/jobs returns "Cannot POST" | BLOCKER | `JobsController` has no `@Post()` handler; frontend calls one that doesn't exist | S | — |
| B03 | No project → job transition | BLOCKER | Architectural gap: existing `convertFromTender` creates Project; existing `tender-conversion/:id/convert-to-job` creates Job — both off tender; no Project→Job path exists | L (sub-discovery candidate) | — |
| B04 | KPI card overlap (Chat1 #1) | COSMETIC | Unverified visual edge case at narrow widths; CSS structurally sound | S (TBD) | Blocked by B01 (can't smoke) |
| B05 | Job ID format inconsistency (Chat1 #2) | FUNCTIONAL | 3 prefix formats coexist: `J-YYYY-NNN` (seed), `JOB-YYYY-NNN` (runtime), `JOB-COMP-<epoch>` (compliance harness) | S | — |
| B06 | Scheduler weekend clip (Chat1 #4) | COSMETIC | Unverified; no `--weekend` variant in `.sched-week__*` CSS — likely a narrow-column rendering issue | S (TBD) | — |
| B07 | "Due this week" mislabel (Chat1 #6) | COSMETIC | Widget filter is "due in next `daysAhead` days" (default 7); title says "this week" → off-by-cutoff at end of week | S | — |
| B08 | Client win 300% | FUNCTIONAL | `bumpWinCount` re-fires winCount increment without re-checking tenderCount; copy-tender flow or re-award triggers it | S (data fix + idempotency guard) | — |

### Per-bug detail

#### B01 — Job detail blank page

- **Where it lives:** `apps/web/src/App.tsx:188` (route registration `/jobs/:id` → `JobDetailPage`), `apps/web/src/pages/jobs/JobDetailPage.tsx` (570 LOC).
- **Evidence:** Marco screenshot showed `/jobs/job-001` URL with blank white viewport. Route handler responded (URL changed; not a 404) but no UI rendered.
- **Backend + data confirmed OK:**
  - `GET /jobs/:id` exists at `JobsController:45` (`getById(@Param('id') id)` → `service.getById`).
  - `jobs.service.ts:332` (`getById`) wraps `requireJob(id)` (line 1251) which uses the rich `jobInclude` (line 92) — includes `stages`, `issues`, `variations`, `progressEntries`, `statusHistory`, etc. Shape matches the `JobDetail` type in the component.
  - DB has `job-001` (`SELECT id, job_number, name, status FROM jobs WHERE id='job-001'` → exists, `J-2025-001 / Ipswich Motorway Stage 4 — Earthworks / ACTIVE`).
- **Hypotheses:**
  - **H1** (most likely): a render-time exception inside one of the nested sections (`StageSection` / `ActivitySection` / etc.) crashes the React tree silently. No error boundary above `JobDetailPage`, so the whole route renders blank. Likely a nested field — e.g. `activity.owner` is null and code dereferences `.firstName`.
  - **H2**: `authFetch` returns a 401 (expired token) → `response.ok=false` → throws → `setError("Job not found.")` → renders `EmptyState`. But Marco said BLANK, not "Job not found", so H2 is unlikely unless the EmptyState component itself crashes (it doesn't — used everywhere).
  - **H3**: `setExpandedStages(new Set(data.stages.map(s => s.id)))` on line 168 throws if `data.stages` is undefined. Catch block sets error AND `job` was already set on line 166 → render proceeds with truthy `job` but undefined nested arrays → JSX access throws → blank tree.
- **Recommended hypothesis to test first:** H1 / H3 (closely related). Add an error boundary at the `<Route>` level OR wrap each tab section. Cheapest first-cut: log to console.error in the catch on line 170 to surface the underlying error to Marco.
- **Fix sketch:**
  1. Add an error boundary component (`<ErrorBoundary fallback={<EmptyState heading="Could not render job"/>}>`) around `JobDetailPage`'s nested sections.
  2. Audit nested optional fields in the render path (`owner`, `lead`, `approvedBy`, `reportedBy`) for unguarded `.firstName` dereferences.
  3. Re-throw `error` to the browser console in dev mode so the actual stack reaches Marco.
- **Smoke test (after fix):**
  1. Login as admin
  2. Navigate to `/jobs`
  3. Click the "Ipswich Motorway Stage 4 — Earthworks" card
  4. Expected: job detail renders with stages, issues, variations sections. NOT blank, NOT "Job not found".
  5. Open browser console; expect zero errors.
- **Open questions for MAIN:** is there a global error boundary on the React tree that Marco could check, or do we need one? Memory hints that `EmptyState`/`Skeleton` are from `@project-ops/ui` but I didn't find any app-level error boundary.
- **Dependencies:** Blocks B04 (KPI card overlap on the same page).

#### B02 — POST /api/v1/jobs returns "Cannot POST"

- **Where it lives:** `apps/api/src/modules/jobs/jobs.controller.ts:26` (`@Controller("jobs")` — no `@Post()` at root); `apps/web/src/pages/jobs/JobsListPage.tsx:449` (frontend POSTs to `/jobs`).
- **Evidence:** Modal "Cannot POST /api/v1/jobs" after submitting job-creation form. Confirmed: controller has only `@Get`, `@Patch`, and `@Post(":id/<sub-resource>")` handlers — nothing at the controller root.
- **Hypotheses:**
  - **H1** (confirmed): `@Post()` handler simply doesn't exist. Frontend calls `authFetch("/jobs", { method: "POST" })`; Nest responds 404 "Cannot POST /api/v1/jobs".
- **Recommended hypothesis to test first:** H1.
- **Fix sketch:**
  1. Add `@Post() create(@Body() dto: CreateJobDto, @CurrentUser() actor) { return this.service.createJob(dto, actor.sub); }` to `JobsController`.
  2. Add `createJob(dto, actorId)` to `JobsService`. Look at the existing `convertFromTender` / `reuseArchivedJobConversion` paths for the pattern. A minimal manual-create is `prisma.job.create({ data: { ... } })` + writing a status-history row + audit log.
  3. Add `CreateJobDto` (or reuse fields from `UpdateJobDto` made required). The frontend body (line 449-451) sends `name`, optional `description`, optional `siteId` — match those.
- **Smoke test (after fix):**
  1. Navigate to `/jobs`
  2. Click "New job"
  3. Enter name "Test Job 1", leave description + site blank, submit
  4. Expected: modal closes; new card appears in the list with name "Test Job 1" and a `JOB-2026-NNN` number; clicking it navigates to its detail page (after B01 is also fixed).
- **Open questions for MAIN:** what's the policy on manual jobs (without a tender source)? The schema allows `sourceTenderId = null` but a quick scan of the conversion paths suggests all production jobs come from tenders. If manual jobs shouldn't exist, the fix is "hide/disable the New Job button when not converting" rather than "wire up POST /jobs".
- **Dependencies:** None.

#### B03 — No project → job transition

- **Where it lives:**
  - Tender→Project conversion: `apps/api/src/modules/projects/projects.service.ts:390` (`convertFromTender`) + `apps/api/src/modules/tendering/tender-convert.controller.ts:18` (`POST /tenders/:id/convert`).
  - Tender→Job conversion (parallel, separate): `apps/api/src/modules/jobs/tender-conversion.controller.ts:45` (`POST /tender-conversion/:tenderId/convert-to-job`) + `JobsService.reuseArchivedJobConversion`.
  - Project status UI: `apps/web/src/pages/projects/AdvanceStatusModal.tsx` — status flow is `MOBILISING → ACTIVE → PRACTICAL_COMPLETION → DEFECTS → CLOSED` (all within Project).
- **Evidence:** Marco: "When I go to tenders and change the status to awarded, it shows under project, but I can't move from project to jobs". The status flow in `AdvanceStatusModal.tsx` confirms no Project→Job transition exists. Schema has `Job.sourceTender` (line ~1860) but no `Job.sourceProjectId`.
- **Hypotheses:**
  - **H1**: Project→Job is genuinely unimplemented; needs new schema FK + endpoint + UI button + design decision on what "becoming a Job" means (does the Project close? Is the Job a child of the Project? Do scope items duplicate?).
  - **H2**: Project and Job were conceptually meant to be the same entity at different lifecycle stages; the schema already has overlap (both have client, scope, team, contractValue, etc.). Fix is to collapse them, NOT add a transition.
- **Recommended hypothesis to test first:** H1 with a sub-discovery PR that nails down (a) what Marco's workflow expects ("Project IS the delivery phase" vs "Project precedes Job") and (b) what data needs to move/duplicate/freeze on transition.
- **Fix sketch:** **L complexity.** This isn't a single fix — it's a design decision. Recommend MAIN run a separate sub-discovery pass before writing any implementation prompt. Possible scopes:
  - **Scope A** (minimal): add a `MOBILISING → ACTIVE → … → CLOSED` step labelled "Convert to Job" that creates a Job record off the Project + sets Project.status=ARCHIVED. Adds `Job.sourceProjectId` FK.
  - **Scope B** (collapse): merge Project + Job into a single Project entity, deprecate the Job model. Multi-PR migration.
- **Smoke test (after fix):** depends on the chosen scope.
- **Open questions for MAIN:** see Hypotheses + Fix sketch above. This is the architectural decision that has to come first.
- **Dependencies:** None to other bugs; but enlarges B01 scope if H2 is chosen (we'd be deprecating the entire Jobs module).

#### B04 — KPI card overlap (Chat1 #1)

- **Where it lives:** `apps/web/src/styles.css:3972` (`.tendering-stat-card`) + `apps/web/src/pages/JobsPage.tsx:1201, 1205, 1209, 1217` (4 stat cards: source tender / estimated value / win confidence / carried documents).
- **Evidence:** Chat1 observation, never visually verified by Marco. CSS structurally fine (display:grid with 4px gap).
- **Hypotheses:**
  - **H1**: Cards overlap horizontally at narrow widths because the parent container doesn't wrap (or wraps badly).
  - **H2**: Value-string overflow (long currency / long tender number) breaks the layout.
  - **H3**: Already-resolved since Chat1's observation; no current bug.
- **Recommended hypothesis to test first:** H3 first — confirm via fresh screenshot from Marco after B01 unblocks visual access to the jobs detail page.
- **Fix sketch:** TBD pending re-screenshot. If H1: wrap parent in `flex-wrap: wrap` or set `min-width: 0` on child. If H2: `text-overflow: ellipsis`.
- **Smoke test (after fix):** Resize browser from 1920px down to 768px on `/jobs/<job-id>` (after B01); cards must stack cleanly, no overlap, no value clipping.
- **Open questions for MAIN:** request a current screenshot before allocating a fix PR.
- **Dependencies:** Blocked by B01 (can't visually verify until job detail renders).

#### B05 — Job ID format inconsistency (Chat1 #2)

- **Where it lives:** `apps/api/prisma/seed-initial-services.ts` (seed uses `J-2025-NNN`) + compliance smoke harness (uses `JOB-COMP-<epoch>`) + runtime job-number generator (uses `JOB-YYYY-NNN`). The runtime generator is in `JobsService.generateJobNumber` or similar — wasn't located explicitly but inferred from `JOB-2026-001` data and `ProjectNumberSequence` schema model precedent (`apps/api/prisma/schema.prisma:1847`).
- **Evidence:** DB probe (38 rows) confirmed three coexisting formats:
  - `J-2025-001`, `J-2025-002` — 2 seed records
  - `JOB-2025-099` — 1 seed record
  - `JOB-2026-001` — 1 runtime-created (the most recent non-compliance row)
  - `JOB-COMP-<epoch>` — 33 compliance-smoke records
- **Hypotheses:**
  - **H1** (confirmed): seed and runtime generator use different prefix formats.
- **Recommended hypothesis to test first:** H1.
- **Fix sketch:** Update seed to use `JOB-YYYY-NNN` to match runtime. Compliance harness can keep `JOB-COMP-<epoch>` (it's disposable test data) OR also switch — Marco's call. No migration needed because seed runs idempotently against ID = `job-001`, `job-002`, etc. Just change the displayed `jobNumber` literals.
- **Smoke test (after fix):**
  1. Reset DB + reseed
  2. Navigate to `/jobs`
  3. All non-compliance job cards display `JOB-YYYY-NNN` format. No `J-2025-NNN` anywhere.
- **Open questions for MAIN:** keep `JOB-COMP-<epoch>` for compliance smoke or also normalize? Recommendation: keep the COMP- prefix so they're visually distinguishable in the audit table; just don't display them in the user-facing list.
- **Dependencies:** None.

#### B06 — Scheduler weekend clipping (Chat1 #4)

- **Where it lives:** `apps/web/src/pages/scheduler/SchedulerWorkspacePage.tsx:436` (week-header `["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]`) + `apps/web/src/styles.css:2343` (`.sched-week__col`) + `.sched-month__cell` (line 2488+).
- **Evidence:** Chat1 observation, never visually verified. CSS has no `--weekend` variant — all 7 columns share the same styling.
- **Hypotheses:**
  - **H1**: All 7 columns are equal width but the parent grid has a max-width that compresses Saturday/Sunday columns differently from weekdays at narrow widths.
  - **H2**: A specific shift / event renders only on weekends and overflows because of a hardcoded width.
  - **H3**: Already-resolved.
- **Recommended hypothesis to test first:** H3 — re-screenshot from Marco. Without a specific repro, root cause speculation is unproductive.
- **Fix sketch:** TBD pending repro.
- **Smoke test (after fix):** Navigate to `/scheduler`; load a week with weekend shifts; verify Sat + Sun columns render at the same width as Mon-Fri with no content clipping.
- **Open questions for MAIN:** request a fresh screenshot, ideally with a weekend-shift visible.
- **Dependencies:** None.

#### B07 — "Due this week" mislabel (Chat1 #6)

- **Where it lives:** `apps/web/src/dashboards/widgets/tendering.tsx:242` (`DueThisWeekPanel`) + `apps/web/src/dashboards/widgetRegistry.ts:283` (widget metadata `name: "Due this week"`).
- **Evidence:** Confirmed via code read: widget filter is `daysUntil(t.dueDate) <= daysAhead` where `daysAhead` defaults to 7 (configurable). Title says "Due this week" but the actual semantic is "due in the next N days" (default 7 = rolling 7-day window from today). At end of week, results spill into next week.
- **Hypotheses:**
  - **H1** (confirmed): label / semantic mismatch. Title implies "this week" (Mon-Sun current week) but logic is rolling 7-day.
- **Recommended hypothesis to test first:** H1.
- **Fix sketch:** Two options:
  - **(a) Rename label** to "Due in next 7 days" or "Due soon" — preserves current 7-day rolling behaviour, fixes label. 1-line change in `widgetRegistry.ts:283`.
  - **(b) Change semantic** to literal current-week (Mon-Sun of `new Date()`'s ISO week). Adjust the filter in `DueThisWeekPanel` line 250.
  Recommendation: (a) — the 7-day rolling window is a more useful default for tenders (estimators don't suddenly stop caring on Sunday night).
- **Smoke test (after fix):** Open `/tendering/dashboard`; verify widget title matches its content.
- **Open questions for MAIN:** decide (a) vs (b). The `daysAhead` config field already exists — letting estimators set it to 14 to mean "next two weeks" is the strongest argument for (a).
- **Dependencies:** None.

#### B08 — Client win 300%

- **Where it lives:** `apps/api/src/modules/tendering/tendering.service.ts:1026` (`bumpWinCount`) + `apps/api/src/modules/tendering/tendering.service.ts:1009` (the win-rate computation in another path).
- **Evidence:** DB probe confirmed Brisbane Grammar School has `win_count=3, tender_count=1, win_rate=300.00` — `winCount > tenderCount` is mathematically impossible for a probability. `winRate` is stored as a percentage on `clients.win_rate`; no `win_probability` column exists anywhere.
- **Hypotheses:**
  - **H1** (most likely): `bumpWinCount` (`tendering.service.ts:1026`) increments `winCount` without checking idempotency. If a tender is awarded → bumpWinCount runs (winCount=1). Tender duplicated via "Copy" flow → if the copy retains the AWARDED status, bumpWinCount fires again on the COPY (winCount=2, tenderCount still 1 because Copy didn't increment tenderCount). Status edit re-award → bumpWinCount #3 (winCount=3).
  - **H2**: A backfill / migration ran `bumpWinCount` more than once over the same set.
- **Recommended hypothesis to test first:** H1 via the Copy-tender flow.
- **Fix sketch:**
  1. **Data fix:** one-shot SQL to clamp `winCount = LEAST(winCount, tenderCount)` and recompute `winRate = winCount/tenderCount*100`. Migration `XXXX_clamp_client_win_counters.sql`.
  2. **Idempotency guard:** in `bumpWinCount`, before incrementing, check whether this `(clientId, tenderId)` win has already been counted. Simplest approach: add a `wonAt` timestamp on `TenderClient`; if already set, skip. (Schema add: nullable `won_at TIMESTAMPTZ` on `tender_clients`. Migration + code change.)
  3. **Copy-tender flow:** when duplicating a tender, reset `is_awarded=false` on the copy's `TenderClient` rows so the next award fires fresh — OR explicitly do NOT re-run bumpWinCount during copy.
- **Smoke test (after fix):**
  1. Reset Brisbane Grammar School: `UPDATE clients SET win_count=1, win_rate=100 WHERE id='cmonoidor00riubccwps0j96a';`
  2. Re-trigger the bug: duplicate IS-T020 (the AWARDED parent)
  3. Verify the new IS-T020-COPY-2 does NOT bump winCount again; client still shows `win_count=1, tender_count=2, win_rate=50`.
  4. Award IS-T020-COPY-2 explicitly → winCount=2, tenderCount=2, winRate=100. Correct.
- **Open questions for MAIN:** does the Copy-tender flow today preserve AWARDED status on the copy, or reset it? If it preserves, fix step 3 is mandatory; if it resets, step 3 is moot.
- **Dependencies:** None.

— end of Fix Map —

## Design Map (2026-05-18)

**Status:** triage complete, no implementation shipped. Implementation
prompts to be written by MAIN per-feature as priorities are set.

**Scope:** 11 features — 5 in C-chain (Quote Arrangement, post-MVP)
and 6 in P-chain (Projects module redesign, described by Marco
2026-05-18).

### Summary table

| ID | Chain | Feature | Complexity | Cross-cutting concerns | Status |
|---|---|---|---|---|---|
| C1 | C-chain | Quote Arrangement screen base | M | extends push-from-scope | discovered, ready for impl prompt |
| C2 | C-chain | Drag-and-drop + grouping | M | reuses @dnd-kit; pivots on source card | discovered |
| C3 | C-chain | Collapse/expand/hide | S | reuses isVisible + show* flags | discovered |
| C4 | C-chain | Reset to original / displayName | S/M | re-runs push-from-scope | discovered |
| D1 | C-chain | Quote PDF respects arrangement | M | PDFKit stopgap (Q5 locked) | discovered |
| P-tab1 | P-chain | Project Overview restructure | S | depends on user list catalog | new |
| P-tab2 | P-chain | Project Documents with type dropdown | M | extensible doc-type catalog | new |
| P-tab3 | P-chain | Project Scope with "pull from quote" + log | L | overlaps with C2/C3 UX; needs change-log model | new |
| P-tab4 | P-chain | Project Schedule from project scope + WBS Gantt | M | depends on P-tab3; Gantt explode/collapse | new |
| P-tab5 | P-chain | Project Team as calendar with cascading allocation | L | scheduler module shares logic; worker→ticket→asset relations | new |
| P-tab6 | P-chain | Project Activity = change-log | S | depends on P-tab3 log model | new |

### C-chain features

See the existing "C-chain — Phase 0 discovery findings (2026-05-18)"
section above. No deltas; nothing has shipped on C-chain since that
discovery, so all open questions (Q4 Client.name vs displayName,
Q5 PDFKit stopgap, push-from-scope extension boundary) remain
locked as recommendations awaiting MAIN's final answer.

### P-chain features

#### P-tab1 — Project Overview restructure

**Purpose:** Make the Project Overview tab the single landing screen
for a delivery-phase project — Manager / Supervisor (only one
authoritative role label) + key dates + financials, no clutter.

**Current state:**
- File: `apps/web/src/pages/projects/ProjectDetailPage.tsx:217` (`OverviewTab`)
- Currently renders 3 sections: Financials (4 stats), Team (4 PersonCards — Project Manager / Supervisor / Estimator / WHS Officer), Key dates (4 dates)
- Backend: `Project` schema (`apps/api/prisma/schema.prisma:1854`) has `projectManagerId`, `supervisorId`, and FK relations. `whsOfficer` is part of the `project` payload from `jobInclude`-equivalent in `projects.service.ts`. Estimator comes from the source tender.

**Proposed change (Marco's brief, verbatim where ambiguous):**
> "Project Overview should not surface Supervisor and WHS Officer as
> primary identity — just one role. The list of PMs is Beau Murphy,
> Colin Hanlon, Sean Lattin, Marco Mantovaninni."

**Restructured intent (MAIN's interpretation):**
- Drop Supervisor + WHS Officer from OverviewTab's Team section (still keep the fields in the underlying schema so reports / dashboards can use them; just hide the UI surface).
- Promote Project Manager to a more prominent slot (currently same size as the other 3 roles).
- Replace the PM picker with a dropdown sourced from the 4 named users (Beau / Colin / Sean / Marco — all confirmed to exist in dev DB as `user-pm-001`, `user-pm-002`, `user-admin`, `user-supervisor-001` respectively).

**Open questions:**
- **Is Supervisor / WHS Officer used elsewhere?** Probe-confirmed they're FK columns on the Project row; UI display in OverviewTab is the primary consumer. Other consumers (reports, dashboard widgets) may exist — would need a grep before deletion. **Recommendation:** hide in UI; do not drop the column.
- **PM dropdown source:** the 4 names align with `user-pm-001`, `user-pm-002`, `user-admin`, `user-supervisor-001`. Should the dropdown filter by a role/permission ("users with `projects.manage`"), or hardcode the 4 user IDs, or query a saved "PM candidates" catalog?
  - **Recommendation:** filter by permission `projects.manage` — most extensible.

**Cross-cutting concerns:**
- Other tabs (Team, Activity) display PM data — restructure shouldn't break those.

**Suggested PR breakdown:**
- Single PR (S complexity). Frontend-only changes to OverviewTab; backend schema unchanged.

#### P-tab2 — Project Documents with type dropdown

**Purpose:** Add a typed-category dropdown (drawings / SWMS / ARCP / DMP / contract / Form65 / etc) to the upload UI so documents can be filtered and the tab becomes a structured catalogue rather than a flat list.

**Current state:**
- File: `apps/web/src/pages/projects/ProjectDetailPage.tsx:501` (`DocumentsTab`)
- Backend: `DocumentLink` model (`apps/api/prisma/schema.prisma:262`) already has a `category: String` field (free-form string, not enum) — extensible by design. Seed data shows existing categories: "Contract", "Programme", "Environmental", "SWMS", "Geotechnical".
- Tender-vs-project provenance already tracked via `secondaryEntity` metadata (per seed). Image 9 shows current "tender · 05/05/2026" / "tender · 04/05/2026" labels.

**Proposed change (Marco's brief, verbatim where ambiguous):**
> "Documents — need a dropdown when uploading: drawings, SWMS, ARCP,
> DMP, contract, Form65… this list may change and/or grow in the future."

**Restructured intent (MAIN's interpretation):**
- Add a dropdown to the upload UI that lets the user pick from a curated category list.
- Store the picked value in the existing `DocumentLink.category` field.
- Provide an admin UI to manage the available category list (since "this list may change and/or grow in the future").

**Open questions:**
- **Extensibility: ENUM, admin catalog, or frontend constant?** Three options:
  - **(a)** Postgres ENUM on `category` — type-safe but every new value needs a migration.
  - **(b)** Admin-managed catalog table (`DocumentCategory` with `name`, `module`, `isActive`, `sortOrder`) — most flexible.
  - **(c)** Frontend constant list — fastest now, painful later.
  - **Recommendation:** **(b)**. The string column already exists; we just add the catalog table + admin UI. Existing values continue to work without migration; new values are admin-added without code change.
- **Should categories be module-scoped?** "Form65" is a project document; "Quote PDF" is a tendering artifact. The catalog table should have a `module` filter so the UI dropdown only shows project-relevant categories.

**Cross-cutting concerns:**
- The same dropdown will eventually appear on Tender Documents (uploading there has its own category needs). Catalog table should be module-aware from day one.
- Document uploads in other modules (Forms, Maintenance) already use `DocumentLink` — consistency check.

**Suggested PR breakdown:**
- **P-tab2a** — Schema + admin catalog (DocumentCategory model + migration + admin CRUD endpoints + admin UI). S/M.
- **P-tab2b** — Wire the dropdown into the Project Documents upload UI. S.

#### P-tab3 — Project Scope with "pull from quote" + change-log

**Purpose:** The Project Scope tab is the frozen-at-conversion view of what's been promised to the client. It should let estimators / PMs see the scope at WBS granularity (DEM1.1, DEM1.2 …) with collapsible groupings, pull the most recent quote arrangement as the starting point, and keep an audit trail of any post-conversion edits.

**Current state:**
- File: `apps/web/src/pages/projects/ProjectDetailPage.tsx:292` (`ScopeTab`)
- Currently shows "Scope and rates are frozen at conversion — <timestamp>" + grouped by `scopeCode`. IS-P001 shows "No scope items / No line items were snapshotted from the source tender" — the snapshot at conversion appears not to have populated for that project, which is its own gap to address inside this work.
- Backend has `QuoteScopeItem` (per C-chain discovery) with `sourceItemId`/`sourceItemType` provenance and per-row `sortOrder` + `isVisible`. WBS numbering lives on `ScopeOfWorksItem.wbsCode` (e.g. `DEM1.1`).

**Proposed change (Marco's brief, verbatim where ambiguous):**
> "Project Scope — should pull from the quote (preserving discipline
> numbering like DEM1.1, DEM1.2); also needs the same collapse/explode
> rules as the generated quote; needs a change-log for any
> post-conversion edits."

**Restructured intent (MAIN's interpretation):**
- Change the snapshot source: instead of (or in addition to) `ScopeOfWorksItem`, materialise from the **awarded quote's** `QuoteScopeItem` rows — preserves the arrangement the client actually accepted.
- Add a UI mode that mirrors C2/C3's collapse/explode/hide semantics (group by source card, show/hide per row, collapse group).
- Add a change-log: every post-conversion edit (description tweaked, quantity changed, row added) creates a `ProjectActivityLog` entry with `action='SCOPE_EDITED'` (new enum value) and `details` containing before/after.

**Open questions:**
- **Conversion snapshot vs awarded-quote snapshot:** today `convertFromTender` populates a "flat scope". Should it instead read from the awarded `ClientQuote`'s `QuoteScopeItem` rows? If yes, what if no client has been marked AWARDED before conversion? **Recommendation:** prefer awarded-quote source; fall back to tender's raw scope if no awarded quote exists.
- **Collapse/explode UX: build now or wait for C-chain?** P-tab3 depends on the same dnd-kit + grouping work as C2/C3. If C2/C3 ships first, P-tab3 reuses; if P-tab3 ships first, it ships standalone.
  - **Recommendation:** sequence C2/C3 first so P-tab3 reuses the work.
- **Change-log granularity:** per-field, per-line, or per-card? **Recommendation:** per-line (one log entry per scope-row edit, with a diff in `details`). Matches what the existing ProjectActivityLog supports.

**Cross-cutting concerns:**
- Depends on C-chain (C2/C3 ideally precede; D1 also wants this data layer to be quote-arrangement-aware).
- The "pull from quote" semantic means the existing `convertFromTender` snapshot needs an overhaul.

**Suggested PR breakdown:**
- **P-tab3a** — Backend: change snapshot source to awarded quote; fallback path; new ProjectActivityAction enum value. M.
- **P-tab3b** — Frontend: collapse/explode/hide UI (reusing C-chain dnd-kit work if it's shipped). S/M.
- **P-tab3c** — Change-log read+write integration (writes from edits in 3b; reads displayed in P-tab6's Activity tab). S.

#### P-tab4 — Project Schedule from project scope + WBS Gantt

**Purpose:** The Schedule tab's Gantt chart should reflect the WBS used in the project's frozen scope (collapsible / explodable like the scope view), and must read from the project's snapshot — not the tender's raw scope as it does today.

**Current state:**
- File: `apps/web/src/pages/projects/ProjectDetailPage.tsx:348` (`ScheduleTab`)
- "Generate from scope" button at line 373 calls `POST /projects/:id/gantt/generate`. The confirmation prompt confirms Marco's complaint: "Generate Gantt tasks from the source tender's scope disciplines?" — explicitly reads from tender, not project.
- Backend service handles this — needs to be located in `projects.service.ts`.

**Proposed change (Marco's brief, verbatim where ambiguous):**
> "The Gantt chart should reflect the WBS implemented on scope as well,
> allowing the user to explode or collapse the gantt chart as required.
> Also, it must be the scope on the project, not the one from the
> tender/quote (which is what it is doing right now)."

**Restructured intent (MAIN's interpretation):**
- Change the Gantt-generation read source from tender → project scope snapshot (the new P-tab3a output).
- Add tree-mode to the Gantt: each discipline node (DEM, CIV, etc) can explode to per-WBS-row tasks (DEM1.1, DEM1.2 …) and collapse back to a single discipline-summary bar.
- Default view: collapsed at discipline level; click to expand.

**Open questions:**
- **Gantt library tree-mode:** what library is `GanttChart.tsx:447` using? Custom or third-party? Need to check whether tree-mode is supported natively, requires a fork, or means switching libraries.
- **Source-of-truth ordering:** when the user reorders scope rows via the project scope tab (P-tab3), should the Gantt re-flow automatically, or does it need a manual "regenerate"?
  - **Recommendation:** auto-reflow when scope changes; gives a coherent project view.

**Cross-cutting concerns:**
- Depends on P-tab3a (the project scope snapshot has to be the new source).
- Gantt tree-mode UX may overlap with C2/C3 collapse/explode pattern.

**Suggested PR breakdown:**
- **P-tab4a** — Switch Gantt source from tender → project snapshot. S/M.
- **P-tab4b** — Tree-mode Gantt (explode/collapse). M (depends on library capability).

#### P-tab5 — Project Team as calendar with cascading allocation

**Purpose:** Replace the current "list of workers + list of assets" view with a calendar where managers can click-and-drag to allocate workers and plant to specific dates / activities, with cascading dropdowns (resource type → discipline → eligible worker / asset, filtered by qualifying ticket for plant operators).

**Current state:**
- File: `apps/web/src/pages/projects/ProjectDetailPage.tsx:573` (`TeamTab`)
- Currently fetches `/projects/:id/allocations` + shows two empty sections ("Workers" / "Plant & equipment"). Add-worker / Add-asset modals exist but the UI is list-based, not calendar-based.
- Backend: `WorkerQualification`, `Asset`, `ShiftAssetAssignment`, `AllocationTargetType` enum (`WORKER | ASSET`) all exist in schema. `worker_qualifications` table confirmed (probe at `Phase 2` returned 9 tables matching `%qualif% / %ticket% / %asset%`).

**Proposed change (Marco's brief, verbatim where ambiguous):**
> "Project Team — calendar view, click-and-drag allocation, cascading
> dropdowns (labour/plant → discipline → workers, with optional
> qualifying ticket check for plant operators). The logic for the 5th
> tab will be replicated on the scheduler once we reach that stage of
> development. If this needs to be done now, to ensure compatibility
> between modules, then do it."

**Restructured intent (MAIN's interpretation):**
- Replace the list view with a week-view calendar (similar to `SchedulerWorkspacePage.tsx`'s sched-week structure).
- Allocation by click-and-drag on a date range, opens a cascading picker (Resource type → Discipline → eligible Worker/Asset).
- For plant: filter eligible workers by `WorkerQualification` matching the asset's required ticket type. Schema-confirmed: `worker_qualifications` table exists.
- Build with Scheduler-compatible primitives so the same logic can be reused when the standalone Scheduler module ships.

**Open questions:**
- **Build shared logic now (extract calendar component) or duplicate then refactor?**
  - **Recommendation:** extract a `<CalendarAllocator>` component in a shared `apps/web/src/components/calendar/` folder from day one. Marco's brief explicitly said "do it" if compat matters; it does.
- **Worker → ticket → asset relationship in schema:** `WorkerQualification` exists but its FK shape to `Asset` (whether direct or via a ticket-type lookup table) wasn't deeply verified. Sub-discovery needed before implementation prompt.
- **Calendar library choice:** roll our own with date-fns + CSS Grid (consistent with existing `sched-week` styling), or pull in `react-big-calendar` / `fullcalendar`? Recommendation: roll our own — bundle size and styling consistency win out.

**Cross-cutting concerns:**
- Heavy overlap with the future Scheduler module. Architectural decision required up-front.
- Depends on accurate `WorkerQualification` data (currently dev-DB has migration drift on this table — confirm dataset is queryable before building UI).

**Suggested PR breakdown:**
- **P-tab5a** — Sub-discovery pass on worker→ticket→asset schema + scheduler-shared-component boundary. (Read-only pass like this current PR.) S.
- **P-tab5b** — `<CalendarAllocator>` shared component built generically. M.
- **P-tab5c** — Wire P-tab5 to use `<CalendarAllocator>` + cascading dropdown UX. M.

#### P-tab6 — Project Activity = change-log

**Purpose:** Make the Activity tab the unified view of every state change, scope edit, document upload/removal, and team allocation event on the project — a single audit trail.

**Current state:**
- File: `apps/web/src/pages/projects/ProjectDetailPage.tsx:1214` (`ActivityTab`)
- Backend: `ProjectActivityLog` model exists (`apps/api/prisma/schema.prisma:1936`) with `action: ProjectActivityAction` enum (line 1827) — already supports `PROJECT_CREATED`, `STATUS_CHANGED`, `TEAM_CHANGED`, `CONTRACT_VALUE_CHANGED`, `BUDGET_CHANGED`, `DOCUMENT_ADDED`, `DOCUMENT_REMOVED`, `WORKER_ALLOCATED`, `ASSET_ALLOCATED`, `TIMESHEET_SUBMITTED`, `TIMESHEET_REJECTED`, `PRESTART_SUBMITTED`.
- Image 11/12 confirms current UI is exactly this — generic event log with click-to-expand JSON details.
- Marco's note "this is the log I was talking about" effectively confirms the existing tab matches the intent.

**Proposed change (Marco's brief, verbatim where ambiguous):**
> "Activity tab — this is the log I was talking about (referencing
> the change-log requirement from tab 3)."

**Restructured intent (MAIN's interpretation):**
- The existing tab already does what Marco wants for status / team / financial / document / allocation events.
- The gap is **scope edits** — `ProjectActivityAction` doesn't have `SCOPE_EDITED` yet. That's the cross-link to P-tab3.

**Open questions:**
- **Granularity of the new SCOPE_EDITED action:** per-line, per-card, per-field? **Recommendation:** per-line with a diff payload in `details` (mirrors what P-tab3 surfaces).

**Cross-cutting concerns:**
- P-tab3 must add the `SCOPE_EDITED` enum value + the write-path. P-tab6 just gets a new icon / label for that action.

**Suggested PR breakdown:**
- **P-tab6a** — Add `SCOPE_EDITED` rendering to ActivityTab + icon/label for the new event type. Bundled with P-tab3a or shipped together. S.

#### P-platform1 — App-wide error boundary infrastructure

**Purpose:** Generalise the surgical error-boundary pattern landed
on JobDetailPage (PR fix/B01) into a platform-wide capability so
every routed page wraps its sections in a defensive boundary, and
the top-level router shell catches anything that escapes a page
boundary.

**Current state:**
- File: `apps/web/src/components/ErrorBoundary.tsx` — small class
  component with `sectionName` + optional `fallback` + `onReset`,
  dev-mode `console.error` via `import.meta.env.DEV`, default
  fallback styled by `.error-boundary-fallback` in `styles.css`.
- Only consumer: `apps/web/src/pages/jobs/JobDetailPage.tsx` —
  seven tab sections each wrapped, one boundary per section.
- No router-level boundary; an exception in any non-job page or
  in the layout itself still blanks the app.

**Proposed change:**
- Audit every routed page under `apps/web/src/pages/` (jobs,
  projects, tendering, scheduler, forms, archive, etc) and wrap
  each tab / panel / list surface in `<ErrorBoundary sectionName=…>`.
- Add a top-level `<ErrorBoundary sectionName="App">` in
  `apps/web/src/main.tsx` (or the equivalent shell) around the
  `<RouterProvider>` to catch anything that escapes a page.
- Promote `ErrorBoundary` from `apps/web/src/components/` to
  `packages/ui/src/` so non-web workspaces (e.g. a future native
  shell) can reuse it. Re-export from `@project-ops/ui`.
- Add a Sentry / telemetry hook on `componentDidCatch` (gated by
  env var) so production crashes are observable, not just the dev
  console log.

**Open questions:**
- **Telemetry sink:** Sentry, Application Insights (Azure-native),
  or a custom audit-log POST? Recommendation: Application
  Insights — Azure stack alignment, no extra vendor.
- **Boundary granularity per page:** one boundary per route, or
  one per panel (the JobDetailPage pattern)? Recommendation:
  per-panel where panels are independently mounted (tabs,
  modals, side rails); one per route is the minimum.
- **Fallback styling consistency:** today's fallback is one CSS
  block. As we add boundaries everywhere we'll want a shared
  `<SectionErrorFallback />` UI primitive in `@project-ops/ui`.

**Cross-cutting concerns:**
- Touches every page in `apps/web/src/pages/` — large surface area
  but each wrap is mechanical.
- Telemetry integration adds an env-var contract (S4-adjacent).
- The promote-to-`@project-ops/ui` step affects the import path
  on the one existing consumer (JobDetailPage) — trivial edit.

**Suggested PR breakdown:**
- **P-platform1a** — Promote `ErrorBoundary` to `packages/ui`;
  update the JobDetailPage import; add a `<SectionErrorFallback />`
  primitive. S.
- **P-platform1b** — Wrap every routed page's panel surfaces.
  M (mechanical but wide).
- **P-platform1c** — Top-level shell boundary in `main.tsx`. S.
- **P-platform1d** — Application Insights wiring + env-var
  contract documented in `environment-reference.md`. S/M.

#### P-platform2 — API/FE type contract enforcement

**Status:** Future work
**Complexity:** L
**Source:** Surfaced by B01.1 root-cause analysis (2026-05-18)
**Depends on:** none

The B01.1 bug existed because the FE TypeScript type for a job
declared a top-level `activities` field that the API never
sends. TypeScript couldn't catch this because API responses
are effectively `any` at the fetch boundary. Two systemic
approaches to fix this class of bug:

**Approach A — OpenAPI codegen:**
- API exposes OpenAPI spec (NestJS has built-in support)
- FE codegens types from the spec
- Build-time guarantee that FE and API shapes match
- One-shot setup; ongoing type drift detection in CI

**Approach B — Runtime validation (Zod):**
- Define Zod schemas for each API response
- authFetch (or a wrapper) runs `schema.parse()` on incoming JSON
- Runtime errors at the boundary with clear messages
- More flexible than codegen, slightly slower at runtime

**Recommendation when this is picked up:** Hybrid.
- Zod schemas as the source of truth
- TS types derived via `z.infer<>`
- Optional: codegen API DTOs from the same schemas (e.g. via
  ts-rest or tRPC) for end-to-end consistency

**Estimated PRs:** 3–4
- **P-platform2a** — choose tool, set up Zod + first schema (POC
  on `/jobs/:id` since we already know its shape from B01.1)
- **P-platform2b** — migrate hot-path endpoints (`/jobs`,
  `/tenders`, `/projects`, `/clients`)
- **P-platform2c** — migrate remaining endpoints + remove `any`
  casts at fetch boundary
- **P-platform2d** (optional) — codegen API DTOs from the same
  schemas

**Why not now:** Out of scope for B01.1 (one-line render-phase
fix shouldn't drag a 3–4 PR platform change behind it).
Captured here so the architectural debt isn't lost.

### Cross-cutting decisions (must be locked before implementation)

1. **Worker dropdown source-of-truth** — `User` table, `WorkerProfile` table, or hybrid? Recommendation: `User` table filtered by `permissions.includes('projects.manage')` for PM dropdown; `WorkerProfile` for field-worker allocation. The two models have different audiences.
2. **Document type extensibility** — ENUM, admin catalog, or frontend constant? **Recommendation: admin catalog (`DocumentCategory` table with `module` scoping).** No migration per category change.
3. **Scheduler shared logic** — build P-tab5 calendar logic now with Scheduler in mind, or build standalone then refactor when Scheduler ships? **Recommendation: build shared `<CalendarAllocator>` from day one.** Marco explicitly said "do it" if compat matters.
4. **Project scope change-log granularity** — per-field, per-line, per-card? **Recommendation: per-line.** Matches the granularity of the existing ProjectActivityLog `details: Json` payload.
5. **C-chain vs P-chain priority** — both depend on each other partially (P-tab3 reuses C2/C3 UX patterns; P-tab5 is independent of either). **Recommendation:** C-chain first (C1→C2→C3 at minimum) so P-tab3 / P-tab4 can reuse the collapse/explode/hide infrastructure. P-tab1, P-tab2, P-tab5, P-tab6 can ship in parallel with the C-chain since they don't share UX patterns.

— end of Design Map —

