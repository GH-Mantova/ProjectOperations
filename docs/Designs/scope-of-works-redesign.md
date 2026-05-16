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

