---
premise: '! grep -q "CRM_OWNER_PICKER_V1" apps/web/src/pages/crm/TendersRegisterPage.tsx'
premise_means: >-
  The Tenders register's Owner chip is a free-text input (TendersRegisterPage.tsx, the
  `aria-label="Filter by owner"` input) that only works if the user pastes a raw estimator id.
  Every other filter chip is a picker. MEASURED 2026-10-02 at origin/main def136f5. It was never a
  picker because the staff list (GET /users) needs users.view, and a crm-view-only user gets a 403
  (punch list 1.3.2). But every loaded TenderRow already carries
  `estimator { id, firstName, lastName }`, and "Mine only" already filters client-side on
  `t.estimator?.id`. fetchAllPages loads up to MAX_PAGES x 100 = 5,000 rows, so the names are
  already in the browser.
design_ref: Claude Design/proposed/crm-register-channel-owner/crm-register-channel-owner-mockup.html
done_when: >-
  pnpm build && pnpm lint &&
  pnpm --filter web test &&
  grep -q "CRM_OWNER_PICKER_V1" apps/web/src/pages/crm/TendersRegisterPage.tsx &&
  test -f apps/web/src/pages/crm/__tests__/tenders-register-owner-picker.test.ts &&
  node scripts/pipeline/check-hex-ratchet.mjs
scope:
  - apps/web/src/pages/crm/TendersRegisterPage.tsx
  - apps/web/src/pages/crm/tendersRegisterPage.helpers.ts
  - apps/web/src/pages/crm/crm.css
  - apps/web/src/pages/crm/__tests__/tenders-register-owner-picker.test.ts
size: 2
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Web only. Reverting restores the text box and the server-side estimatorId filter. No API, schema
  or data change.
escalates: false
module: crm
---

# Tenders register: the Owner chip becomes a picker

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Build to panel 2 of the mock-up at the `design_ref`.

## Marco's ruling (2026-10-02)

Names come **from the tenders on screen**: everyone who owns at least one loaded tender, plus
"Unassigned". No permission change and no new server work. Mock-up approved.

Tag the change with `CRM_OWNER_PICKER_V1` in a comment.

## What to build

### A pure helper: `ownerOptions(rows)` in `tendersRegisterPage.helpers.ts`

- Input: rows with `estimator?: { id, firstName, lastName } | null`.
- Output: `[{ id, label, count }]`, one per distinct estimator id. The label is `F. Lastname` (first
  initial plus last name, like the Logged-by avatar names). Sorted by label, then by id for a stable
  order.
- Plus one `{ id: "__unassigned", label: "Unassigned", count }` entry **last**, only when at least
  one row has no estimator.
- Export the sentinel as `UNASSIGNED_OWNER = "__unassigned"`.

### Filter client-side, not on the server

- **Stop sending `estimatorId` to `/tenders`** from this page: pass
  `{ ...filters, estimatorId: null }` to `fetchAllPages`. `FiltersForQuery` is shared with the
  tendering page; do not change the type or that page.
- Apply the owner filter in the same `useMemo` that applies "Mine only" (the
  `t.estimator?.id !== currentUserId` check): keep rows whose `estimator?.id === filters.estimatorId`,
  or rows with no estimator when it equals `UNASSIGNED_OWNER`.
- Build the options from the **loaded rows before the owner filter**, so picking one owner does not
  shrink the list to that one name.
- Keep the state key `filters.estimatorId` so existing **saved views keep working**. A saved view
  holding an id that matches no loaded row still filters, and its chip shows "Owner: unknown" with
  the clear control. It never silently drops the filter.

### The chip (panel 2)

- Replace the `<input type="text">` with the same chip-plus-menu pattern the **Client** chip uses
  in this file. Reuse its markup and classes; do not invent a new dropdown.
- Menu order: "Any owner" (clears), a separator, owners with counts, a separator, "Unassigned" with
  its count.
- Active chip label: `Owner: <label>` with the existing active-chip class and a clear (✕) control.
- Keyboard and screen-reader behaviour must match the Client chip.
- **"Mine only" is unchanged** and composes with the owner filter.

**Zero colour literals.** Reuse the Client chip's classes and the tokens in `tokens.css`.

## Tests: `__tests__/tenders-register-owner-picker.test.ts`

1. `ownerOptions`: distinct owners with correct counts, sorted, "Unassigned" last and only when
   present.
2. Two estimators with the same initial and last name but different ids stay separate entries.
3. The filter predicate keeps the right rows for an id, for `UNASSIGNED_OWNER`, and for null (all
   rows).
4. **Negative control:** the options come from the unfiltered rows. With the filter set to owner A,
   owner B still appears in the list.

Existing register suites must stay green. If a suite asserted the text input or the
`estimatorId` query param from this page, update it and name it in the PR body.

## Out of scope

- Who is *eligible* to own an account or tender (punch list 1.3.2, Marco's open question). This is
  a filter over existing owners only.
- The tendering page's own estimator filter.
