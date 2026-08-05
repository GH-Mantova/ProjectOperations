---
premise: '! grep -q "workers/job-roles" apps/web/src/App.tsx'
premise_means: Job roles has not been moved to the Workers area yet (no /workers/job-roles route in App.tsx), so SLICE 15 has not landed.
scope:
  - apps/web/src/**
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && grep -q "workers/job-roles" apps/web/src/App.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 922
  - 949
---

# SLICE-15: Move Job roles from Settings/Administration to the Workers area

## Premise
`docs/plans/settings-restructure-plan.md` §3 SLICE 15. Job roles is a scheduler competency bundle (a
Workers/Resources concern, governed by `resources.manage`), currently mis-homed under Settings ->
Administration. `JobRolesPage` mounts at `/settings/administration/job-roles`. This slice moves it to the
existing Workers area at `/workers/job-roles`, adds a Workers nav entry, removes the SettingsShell "Job
roles" item, and redirects the old URLs. MOVE ONLY — no behaviour, API, permission, schema, or /sot/ change.

## Binding spec — read it
`docs/plans/settings-restructure-plan.md` on main, §3 SLICE 15, plus §2 IA and §4 redirect map. Verified
against main:
- `apps/web/src/App.tsx`: `JobRolesPage` imported from `./pages/admin/JobRolesPage`; mounted at the
  SettingsShell route `administration/job-roles`; `/admin/job-roles` -> `Navigate` to
  `/settings/administration/job-roles`. The Workers area already has `/workers`, `/workers/live-crew`,
  `/workers/leave-approvals`, and a DYNAMIC `/workers/:id` route.
- `apps/web/src/components/ShellLayout.tsx`: main nav has a Workers group (e.g.
  `{ to: "/workers", label: "Workers", requiresPermission: "resources.view" }`, `/workers/live-crew`,
  `/workers/leave-approvals`).
- `apps/web/src/components/SettingsShell.tsx`: Administration item
  `{ to: "/settings/administration/job-roles", label: "Job roles", requiresPermission: "resources.manage" }`.
- Permission code `resources.manage` already exists — reuse it, do NOT invent codes.

## What to build (all under apps/web/src/ and tests/e2e/)

1. **App.tsx** — new Workers route:
   - Add `<Route path="/workers/job-roles" element={<JobRolesPage />} />` wrapped exactly like the other
     top-level `/workers/*` routes (match their existing guard pattern; `JobRolesPage` keeps its own gate).
   - CRITICAL ROUTE ORDER: register `/workers/job-roles` BEFORE the dynamic `/workers/:id` route, otherwise
     "job-roles" is captured as an `:id`. Place it adjacent to the other static `/workers/*` routes.
   - Replace the SettingsShell `administration/job-roles` route element (currently `<JobRolesPage />`) with
     `<Navigate to="/workers/job-roles" replace />` so the old Settings URL still resolves.
   - Retarget `/admin/job-roles` -> `<Navigate to="/workers/job-roles" replace />` (was pointing at the
     settings URL; a chained redirect also works but retarget is cleaner).
   - Keep the `JobRolesPage` import (still used by the new /workers route).

2. **ShellLayout.tsx** — add a Workers-area nav entry
   `{ to: "/workers/job-roles", label: "Job roles", requiresPermission: "resources.manage" }` alongside the
   other `/workers/*` items (mirror their shape/icon usage). If ShellLayout enforces a nav test, keep it consistent.

3. **SettingsShell.tsx** — remove the Administration `"Job roles"` item (and the stale "SLICE 15 moves it"
   comment). Do NOT touch other Settings items.

4. **E2E + nav test**:
   - `apps/web/src/components/__tests__/ShellLayout.nav.test.ts` (vitest, CI-enforced per plan §5.2): update
     it to reflect the new Workers "Job roles" entry and the removed Settings item, so `pnpm test` stays green.
   - `tests/e2e/**`: update any assertion that reached Job roles under `/settings/administration/job-roles`
     to target `/workers/job-roles`; assert the old URLs redirect. Keep coverage equivalent; keep tendering-e2e green.

## Do NOT
- Do NOT change `JobRolesPage` behaviour, its API, or permission model.
- Do NOT touch other Settings/Workers surfaces or other slices.
- Do NOT change schema/API/permission registry or /sot/. Do NOT touch Azure/Entra/SharePoint. Do NOT read/print/rotate any key value.
- Do NOT pull in SLICE 16 (administration landing) or SLICE 17 (guard unification).

## STANDING AUTHORITY
> You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
> There is no human in this run. Finishing the work then asking permission is failing.

## Guardrails
- One attempt. If `/workers/job-roles` already exists in App.tsx on main, say `NO-OP`.
- `pnpm --filter @project-ops/web build` AND the web vitest suite (incl. ShellLayout.nav.test.ts) must pass;
  keep tendering-e2e green. Read the CI job log before diagnosing any failure.
- Parity: a user with `resources.manage` reaches Job roles from the Workers nav at `/workers/job-roles`;
  the old `/settings/administration/job-roles` and `/admin/job-roles` URLs still resolve via redirect.
