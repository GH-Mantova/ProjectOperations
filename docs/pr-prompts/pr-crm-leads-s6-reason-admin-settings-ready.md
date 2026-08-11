---
premise: '! test -f apps/web/src/pages/crm/DropReasonAdminPage.tsx'
premise_means: The admin screen for managing CRM drop reasons has not been built yet (S6 not done).
requires_file_on_main: apps/web/src/pages/crm/DontPursueModal.tsx
scope:
  - apps/web/src/pages/crm/**
  - apps/web/src/App.tsx
  - apps/web/src/components/SettingsShell.tsx
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/crm/DropReasonAdminPage.tsx && grep -rq "DropReasonAdminPage" apps/web/src/App.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# feat(web): CRM S6 — admin screen for CRM drop-reason list management

Implement **SLICE 6** of `docs/plans/crm-leads-collapse-plan.md`.

Read that plan in full before writing any code. S4 (`requires_file_on_main` gate) must be
on `main` first (confirms the `crm-api.ts` helper with `listDropReasons` is live before
building the admin screen that calls it). S5 may ship concurrently with S6 — they are
independent after S4.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the work is already on main. Never ask
a question or "stand by" for approval. Read the CI job log before diagnosing any failure.

---

## What to build

### 1. `apps/web/src/pages/crm/DropReasonAdminPage.tsx` (new)

An admin CRUD page for the managed drop-reason list. Requirements:

- **List view:** table of all `DropReason` rows (`label`, `isActive`, `sortOrder`).
  Fetch via `GET /crm/drop-reasons` (from `crm-api.ts`'s `listDropReasons`).
- **Add:** a form or inline row for creating a new reason (`label`, optional `sortOrder`).
  Calls `POST /crm/drop-reasons`.
- **Edit:** inline label and sortOrder editing. Calls `PATCH /crm/drop-reasons/:id`.
- **Disable / enable:** toggle `isActive`. Calls `PATCH /crm/drop-reasons/:id` with
  `{ isActive: !current }`. Do NOT show a delete button — reasons in use cannot be deleted
  (the API guards this); instead offer disable.
- **Guard:** wrap the page with the appropriate `RequirePermissions` component matching the
  existing admin permission pattern in `apps/web/src/App.tsx` for admin-only pages. Check
  the permission registry (`apps/api/src/common/permissions/permission-registry.ts` or
  equivalent) for a suitable existing code before using one. If `crm.manage` exists, use it;
  otherwise use the closest existing admin permission code. Do NOT invent a new permission
  code — note in the PR body which code you used and why.
- **DS patterns:** use DS components (`@project-ops/ds`) wherever the existing CRM pages do.
  Read `apps/web/src/pages/crm/OpportunityDetailPage.tsx` and match the component/style
  conventions.

### 2. `apps/web/src/App.tsx`

Register the new route:
```
/settings/crm/drop-reasons  →  <DropReasonAdminPage />
```
Wrap it with the same permission guard used on other admin-level settings pages.

### 3. `apps/web/src/components/SettingsShell.tsx`

Add a nav entry "CRM drop reasons" under the Administration section (match the format of
existing Administration sub-nav entries). Gate it on the same permission code used in App.tsx.

### 4. `apps/web/src/pages/crm/__tests__/DropReasonAdminPage.test.ts` (new, optional)

If the file budget allows (5 files: DropReasonAdminPage, App.tsx, SettingsShell.tsx, test),
add a unit test covering:
- List renders reasons.
- Disable toggle calls the correct API.
- Add form creates a new reason.

Match the test structure of existing tests in the crm `__tests__` folder.

## Do NOT

- Do NOT add a hard-delete button or endpoint call — reasons in use cannot be deleted, and
  the API already guards this. Soft-disable is the UX.
- Do NOT invent a new permission code — use an existing one.
- Do NOT touch `schema.prisma`, migrations, `/sot/`, or Azure/Entra/SharePoint.
- Do NOT exceed 5 files.
