---
premise: '! grep -q "RequirePermissions" apps/web/src/components/SettingsShell.tsx'
premise_means: The Settings sub-nav still gates the Administration section with the role-name AdminOnly wrapper (not per-item permission codes), so SLICE 3 has not landed.
scope:
  - apps/web/src/**
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && grep -q "RequirePermissions" apps/web/src/components/SettingsShell.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 877
  - 878
---

# Settings restructure SLICE 3 — Settings group visible to all + per-item permission gates

## Premise
Per `docs/plans/settings-restructure-plan.md` §2 (target IA) and §3 SLICE 3. SLICE 0 (plan #840),
SLICE 1 (permission-code inventory #877) and SLICE 2 (vitest wired into CI #878) are merged. Today the
sidebar "Settings" group is `adminOnly` (ShellLayout.tsx:361) so non-admins have no Settings affordance,
and the SettingsShell Administration section is gated by the role-name `AdminOnly` wrapper. This slice
makes Settings visible to ALL users and moves gating onto PER-ITEM permission codes. NO behaviour change
beyond visibility/gating. No new pages, no schema.

## Binding spec — READ IT
Read `docs/plans/settings-restructure-plan.md` on main:
- §2 (target IA: the exact per-item gates for Personal/Company/Administration),
- §3 SLICE 3 (the file list),
- §1 findings 1 and 7 (the ungated items to fix),
- §5.2 (CI: SLICE 2 now runs ShellLayout.nav.test.ts — you MUST update it or CI goes red),
- §5.1 (e2e specs that assert current nav visibility).
Implement exactly to §3 SLICE 3. Do NOT pull work from later slices (no new routes/items that SLICES
4/5/6/10/16 introduce — e.g. do NOT add Automations, Reference-data, Notification-preferences items here).

## What to build (per plan §3 SLICE 3 — ~4 files)

### 1. `apps/web/src/components/ShellLayout.tsx`
- Drop `adminOnly: true` from the "settings" sidebar group (line ~361) so the Settings group renders for
  every authenticated user. The group-level filter (`.filter((group) => !group.adminOnly || isAdmin)`,
  ~line 553) then no longer hides it.
- Ensure the Settings landing is reachable ungated (self-service items like Account must be reachable by
  a non-admin). Keep existing per-item `requiresPermission` behaviour (the stricter per-item gate at
  ~line 34) intact and apply it where §2 says an item is gated.

### 2. `apps/web/src/components/SettingsShell.tsx`
- Replace the `AdminOnly` gate on the Administration section with PER-ITEM permission-code gating
  (`RequirePermissions` / the existing `can()`-based permission gate — use the codes finalized in
  SLICE 1 / the permission catalogue; DO NOT invent codes). Per §2 the Administration items gate on:
  Users `users.view`, Roles & Permissions `roles.manage`, Audit log `audit.view`,
  Platform/Integrations `platform.manage`, Automations `automations.manage`.
- Fix finding 7: add gates to the currently-ungated "Company" (`company.manage`) and "AI settings"
  (`ai.manage`) items. Only gate items that EXIST in SettingsShell today; do not add new items.
- Keep `/settings/data-model` as SuperUser-only (unchanged). SuperUser bypass in `can()` stays
  authoritative (a super-user sees everything).
- `AdminOnly` the component may remain defined (SLICE 17 deletes it) but must no longer gate the
  Administration section here.

### 3. `apps/web/src/components/__tests__/ShellLayout.nav.test.ts`
- Update assertions so the suite reflects the new reality: Settings group is visible to a non-admin with
  the right permissions; per-item gates hide/show entries by permission code (not by `isAdminUser`). This
  suite now runs in CI (SLICE 2) — it MUST be green.

### 4. e2e spec (only if one hard-asserts the old behaviour)
- If any spec under `tests/e2e/` asserts "Settings hidden for non-admin" or the old admin-only Settings
  visibility (see plan §5.1, e.g. `tests/e2e/pr-acceptance/batch1-auth-shell.spec.ts`), update just that
  assertion to the new IA. List every spec + assertion you changed in the PR body. Do NOT broaden scope.

## Do NOT
- Do NOT invent permission codes. Use the SLICE-1 catalogue; if a needed code is genuinely absent, gate on
  the closest existing code and NOTE it in the PR body — do not block the slice or add a migration.
- Do NOT add routes/pages/items that later slices own (Notifications→/inbox is SLICE 4, Notification
  preferences SLICE 5, Reference-data SLICE 6, Automations nav SLICE 10, /settings/administration landing
  SLICE 16). This slice is visibility + gating of EXISTING items only.
- Do NOT change any API, schema, or `/sot/` (SLICE 20 owns the sot reconcile). Do NOT touch
  Azure/Entra/SharePoint. No new features.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does not mean "wait for approval
> before starting". There is no human in this run — finishing the work then asking permission is
> indistinguishable from failing.

## Guardrails
- One attempt. If SettingsShell already uses `RequirePermissions` on main, say `NO-OP`.
- Never ask a question or "stand by". Read the CI job log before diagnosing a failure.
- `pnpm --filter @project-ops/web build` + `pnpm --filter @project-ops/web lint` must pass, and the web
  vitest suite (incl. ShellLayout.nav.test.ts) must be green. Update every nav/e2e assertion this change
  invalidates; list them in the PR body (plan §5.1/§5.2).
