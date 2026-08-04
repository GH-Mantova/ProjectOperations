---
premise: '! grep -q "RatesTab\|rates.*tab" apps/web/src/pages/directory/SubcontractorsPage.tsx'
premise_means: The SubcontractorsPage detail panel has no "Rates" tab yet — a subbie's rate card cannot be viewed, added, edited, or superseded from the UI.
scope:
  - apps/web/src/pages/directory/SubcontractorRatesTab.tsx
  - apps/web/src/pages/directory/SubcontractorsPage.tsx
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/directory/SubcontractorRatesTab.tsx && grep -q "SubcontractorRatesTab" apps/web/src/pages/directory/SubcontractorsPage.tsx
size: 3
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# RC-2: Rates tab on the SubcontractorsPage detail panel

**Binding plan:** `docs/plans/subcontractor-rate-cards-slice-plan.md` on main. RC-1 (predecessor
slice, gated via `requires_file_on_main`) added the `SubcontractorRate` model and the
`subcontractor-rates` CRUD module guarded by `subcontractors.rates.view` / `.manage`. This slice adds
the UI: list, add, edit (supersede), on a subbie's own rates.

Grounded on main today: `apps/web/src/pages/directory/SubcontractorsPage.tsx` renders a detail panel
with a tab bar (`<nav role="tablist">`) with tabs `Overview`, `Contacts (n)`, `Documents (n)`, `Credit`
— `tab` state via `useState`, each tab a `button` with
`className={tab === "x" ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}`.
The `Credit` tab renders `<CreditLedgerTab subcontractorId={detail.id} canManage={canManage} />`, a
component defined inline in the same file that fetches its own data via `authFetch` from `useAuth()`
— this is the closest existing analog to copy the shape of (self-contained tab component, fetches on
mount, has its own loading/error state). The `Contacts` tab instead uses a separately-imported
component, `ContactsTab` from `../../components/contacts/ContactsTab` — this is the closest analog
for "new file, imported into the page". Follow the `ContactsTab` precedent: put the new tab in its own
file, not inlined into `SubcontractorsPage.tsx`, since the plan's `primary_new_file` contract requires
a dedicated file for the next slice (RC-3) to gate on.

## What to build

### 1. New file `apps/web/src/pages/directory/SubcontractorRatesTab.tsx`
A self-contained tab component, props `{ subcontractorSupplierId: string; canManage: boolean }`
(match whichever prop name RC-1's controller/DTO actually used for the FK — confirm against
`apps/api/src/modules/subcontractor-rates/dto/*.ts` on main before naming this prop). On mount, fetch
the subbie's rates via `authFetch` (from `useAuth()`, same pattern `CreditLedgerTab` and `ContactsTab`
use) against RC-1's list endpoint. Render:
- A table of current active rates: discipline/scope code (DEM/CIV/ASB/Other — render the
  human label via `IS_DISCIPLINE_LABELS` if you can safely import it into the web bundle, otherwise a
  small local label map matching the same four codes — do not invent a fifth), unit, rate, valid
  from/to, notes.
- An "Add rate" action (gated on `canManage`) opening a small form/modal (reuse `CenteredModal` from
  `@project-ops/ui`, the same modal primitive `SubcontractorsPage.tsx` already imports) capturing
  discipline code, unit, rate, optional valid-from/to, notes. Submits to RC-1's create endpoint.
- An "Edit" action per row (gated on `canManage`) that — per the append-only supersede rule RC-1
  enforces server-side — opens the same form pre-filled, and on submit calls RC-1's supersede
  endpoint (never a raw PATCH-in-place; there is no such endpoint on the API). After supersede, the
  old row should show as superseded/inactive (either filtered out of the default view or shown greyed
  out with a "superseded" badge — your call, keep it simple) and the new row appears as current.
- Empty state ("No rates recorded yet") when the list is empty, matching the visual convention of
  other empty states in this codebase (e.g. how `DocumentsTab`/`CreditLedgerTab` handle zero rows in
  the same file).
- Loading and error states matching the existing tabs' conventions (a simple inline message /
  skeleton — do not add a new loading-state library).

### 2. Wire into `SubcontractorsPage.tsx`
- Add a new tab button to the `<nav role="tablist">` list: `Rates`, following the exact same
  `role="tab"` / `aria-selected` / `className` pattern as the existing four tabs.
- Add the `tab === "rates"` branch rendering `<SubcontractorRatesTab subcontractorSupplierId={detail.id} canManage={canManage} />`
  (or the correctly-named prop per RC-1's DTO), inserted alongside the existing
  `tab === "contacts" ? ... : tab === "documents" ? ... : tab === "credit" ? ... : (...)` chain.
- Import `SubcontractorRatesTab` from `./SubcontractorRatesTab`.
- Gate visibility of the "Add rate" / "Edit" actions on `subcontractors.rates.manage` via the existing
  `can(user, "...")` helper (`../../auth/permissions`) already imported into this file for `canManage`/
  `canAdmin` — do not gate the whole tab's visibility on a permission the user might not have for
  *viewing*; use `subcontractors.rates.view` for whether the tab/data loads at all if you want to be
  strict, but at minimum never show write actions without `.manage`.

## Do NOT
- Do NOT add a raw "edit in place" call to any PATCH-style endpoint — RC-1 does not expose one; use
  the supersede endpoint only.
- Do NOT touch `Overview`, `Contacts`, `Documents`, or `Credit` tab logic beyond adding the new tab
  button and branch.
- Do NOT touch `apps/api/**` — this slice is UI-only, RC-1 already shipped the backend.
- Do NOT touch `RateResolverService`, `RateTable`, or any estimate-rate UI/admin screen.
- Do NOT build the "price a scope line from this rate card" action — that is RC-3, gated separately.
- Do NOT touch Azure/Entra/SharePoint.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if a Rates tab already exists on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must pass.
