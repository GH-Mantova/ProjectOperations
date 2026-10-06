---
premise: '! grep -rq "ASB_ENCLOSURE_LINES_UI_V1" apps/web/src'
premise_means: >-
  Asbestos items have no screen for priced enclosure, air monitoring and clearance lines. MEASURED
  2026-10-02 at origin/main 7d9926ae: the "+ Add enclosure / monitoring" action on ASB items opens
  WbsAcmBlock (scope-cards/WbsAcmBlock.tsx). That block records ACM type, ACM material and two ticks
  (enclosureRequired, airMonitoring), and nothing priced. S1 adds the API for priced lines; this
  slice puts them on the card, as drawn in the approved mock-up.
  POSITIVE CONTROL: grep -n "export function acmFactCount" apps/web/src/pages/tendering/scope-cards/WbsAcmBlock.tsx
  returns a hit.
design_ref: Claude Design/proposed/asb-enclosure-lines/asb-enclosure-lines-mockup.html
requires_on_main: 'apps/api/src/modules/tendering/scope-enclosure.service.ts :: ASB_ENCLOSURE_LINES_V1'
done_when: >-
  pnpm build && pnpm lint && pnpm --filter web test && node scripts/pipeline/check-hex-ratchet.mjs &&
  grep -rq "ASB_ENCLOSURE_LINES_UI_V1" apps/web/src/pages/tendering/scope-cards
scope:
  - apps/web/src/pages/tendering/scope-cards/WbsAcmBlock.tsx
  - apps/web/src/pages/tendering/scope-cards/EnclosureLinesTable.tsx
  - apps/web/src/lib/enclosure-lines-api.ts
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/enclosure-lines-table.test.tsx
size: 4
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Web only. Reverting removes the table from the card; the lines and their money stay in the API,
  and the totals are unaffected.
escalates: false
module: tendering
---

# Asbestos enclosure S2: the "Enclosure, monitoring & clearance" table on the ASB item

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Build to the mock-up at the `design_ref`, which Marco approved on 2026-10-02. It waits for S1 (front
matter gate).

## What to build

Marker: `export const ASB_ENCLOSURE_LINES_UI_V1 = "asb-enclosure-s2";` in `EnclosureLinesTable.tsx`.

- **`lib/enclosure-lines-api.ts`:** list, add, patch and delete against S1's routes, plus the
  enclosure type list from the existing rate-resolver list endpoint for slug `enclosure` (find the
  route the Rates admin uses; do not add one).
- **`EnclosureLinesTable.tsx`**, rendered **inside the existing ACM block** that the
  "+ Add enclosure / monitoring" action opens, below the ACM type, material and ticks. Do not add a
  second button.
  - The heading reads "Enclosure, monitoring & clearance". The hint reads "priced from the enclosure
    rate table · added on top of the labour above".
  - Columns: Item (a select from the type list), Qty, Unit (read-only), Rate (the snapshot shown as a
    placeholder, with typing as an override), Total, and a remove ×.
  - Add a subtotal row and a "+ add another" button.
  - Totals come from the API response. **Never compute money in the browser.**
- **The action's count** (`acmFactCount`) adds the number of priced lines, so the tick reflects them.
- **The ASB card note** (where the card states asbestos particularities) reads: "Enclosure materials
  and hire, air monitoring and clearance are priced from the enclosure rate table. The labour to build
  and strip the enclosure stays as men × days."
- After any add, patch or delete, refresh the item and card totals the same way other line edits do,
  so Item total and the discipline bar update without a reload.
- **Read-only state:** follow the card's existing permission handling. A user who cannot edit scope
  sees the lines, with no controls.

## Tests: `enclosure-lines-table.test.tsx`

1. The type list renders from the API, with no type names as literals in the component.
2. Adding a line POSTs `{ enclosureType, qty }`. Typing a rate PATCHes `rateOverride`. Clearing it
   PATCHes `null`.
3. The subtotal and line totals display the API's figures. A test fails if the component multiplies.
4. The block never renders on a non-ASB card.
5. The action count includes the lines.
6. After an edit, the card's totals refresh, and the item total equals the API value.
7. Tests 1, 2 and 6 **fail on `origin/main`**. Prove it once.

## DO NOT

- Do not change the API, the ACM ticks' meaning, or the men × days rows.
- No new `#RRGGBB` literals. Do not touch `sot/` (CP-24).

## Screenshots

- The ASB item with the three example lines open, in light and dark.
- A DEM card showing no action.
- Narrow (≤420 px): the table scrolls inside its own box.
