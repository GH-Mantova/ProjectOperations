---
premise: '! grep -rq "directory-archive-action" apps/web/src'
premise_means: There is no first-class Archive/Unarchive action in the Directory yet — archiving a client currently requires opening the edit modal and changing the status dropdown, and the default list still shows archived records.
requires_file_on_main: apps/web/src/pages/directory/directory-tab-helpers.ts
scope:
  - apps/web/src/pages/master-data/MasterDataWorkspacePage.tsx
  - apps/web/src/pages/directory/SubcontractorsPage.tsx
  - apps/web/src/pages/directory/directory-archive.ts
  - apps/web/src/pages/directory/__tests__/directory-archive.test.ts
done_when: pnpm --filter @project-ops/web lint && pnpm --filter @project-ops/web test && grep -rq "directory-archive-action" apps/web/src
size: 6
gate_allow: none
seed_only: false
escalates: false
---

# AR-1 — Directory: first-class Archive / Unarchive + default-list exclusion + bulk-archive

Slice AR-1 of the archive/decommission program (`docs/plans/directory-archive-decommission-plan.md`).
Design LOCKED (Marco 2026-08-10): archive is the everyday, non-destructive action for all manage-rights
users; there is NO delete here (delete = a separate super-admin decommission program, later). Depends on
directory PR #969 (adds `directory-tab-helpers.ts`); the `requires_file_on_main` gate holds this until #969
lands, so it builds on the post-#969 Directory.

## Current state (grounded on live build 7c6a7c4 = origin/main)

Client records already carry `status` = `ACTIVE` / `INACTIVE` / `ARCHIVED` (editable in the Client edit
modal's Details tab), and the Directory has an "All statuses" filter. But: (a) archiving requires opening
the edit modal and changing the dropdown — there is no one-click action on the card/row; (b) the default
list shows archived records; (c) there is no bulk action. Verify the exact status field + list/filter
wiring in `MasterDataWorkspacePage.tsx` (Clients) and `SubcontractorsPage.tsx` (Subcontractors & Suppliers)
before editing.

## What to build

1. **`apps/web/src/pages/directory/directory-archive.ts` (new)** — a tiny shared helper module:
   - `isArchived(status)` and the canonical archived value (mirror the API `status` enum used by clients /
     subcontractors — check the existing type; do not invent a new value).
   - `setArchived(authFetch, kind, id, archived)` — calls the EXISTING status-update endpoint the edit
     modal already uses (find it in `MasterDataWorkspacePage.tsx` / `SubcontractorsPage.tsx`; reuse it — do
     not add a new API route) to set status to archived / back to active.
   - `DEFAULT_VISIBLE_STATUSES` — the set shown when no explicit status filter is chosen (everything except
     archived).

2. **`apps/web/src/pages/master-data/MasterDataWorkspacePage.tsx`** (Clients) —
   - Add a one-click **Archive** / **Unarchive** action on each client card/row (button or row menu),
     tagged `data-testid="directory-archive-action"`, guarded by a `useConfirm` ("Archive this client? It
     will be hidden from the default list but stays searchable and can be unarchived."). Use `setArchived`.
   - Change the DEFAULT list to exclude archived records (use `DEFAULT_VISIBLE_STATUSES`); archived records
     remain visible when the status filter is set to Archived (or an explicit All). Keep the existing
     filter control working.
   - Add a lightweight **bulk-archive**: multi-select clients + an "Archive selected" action (same confirm).
   - Do NOT add any delete control.

3. **`apps/web/src/pages/directory/SubcontractorsPage.tsx`** (Subcontractors & Suppliers) — the same
   one-click Archive/Unarchive action (`data-testid="directory-archive-action"`) + default-exclude-archived,
   reusing `directory-archive.ts`. Bulk-archive here is optional if it inflates scope — if so, note it as a
   follow-up in the PR body rather than exceeding the file budget.

4. **`apps/web/src/pages/directory/__tests__/directory-archive.test.ts` (new)** — unit-test the helper:
   `isArchived`, `DEFAULT_VISIBLE_STATUSES` excludes archived, and `setArchived` calls the status endpoint
   with the correct archived/active value for both kinds. (The web workspace has no jsdom; test the pure
   helper, matching the pattern #969 used for `directory-tab-helpers.test.ts`.)

## Do NOT

- Do NOT add any delete / hard-delete control or endpoint — archive only (delete is the later super-admin
  decommission program).
- Do NOT add a new status value or a new API route — reuse the existing `status` enum + status-update
  endpoint.
- Do NOT touch Contracts (that is slice AR-2), the Workers/HR module, `sot/`, or Azure/Entra/SharePoint.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. If genuinely impossible in the stated scope, do not exit silently — say `NO-OP: <reason>`.
- Never stand by for approval; there is no human to approve mid-run.
- If CI fails, read the actual job log before diagnosing.
- `pnpm --filter @project-ops/web lint` and `test` must pass before you open the PR.
