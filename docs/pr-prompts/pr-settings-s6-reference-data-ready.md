---
premise: '! grep -rq "settings/reference-data" apps/web/src/App.tsx'
premise_means: The Reference data & Lists surface has not yet been moved off UserProfilePage to a single home under Company, so SLICE 6 has not landed.
scope:
  - apps/web/src/**
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && grep -rq "settings/reference-data" apps/web/src/App.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 922
---

# Settings restructure SLICE 6 — Lists off UserProfilePage; single home under Company (/settings/reference-data)

## Premise
Per `docs/plans/settings-restructure-plan.md` §3 SLICE 6 (+ §2 target IA, §4 redirect map, §5.1 e2e).
SLICE 3 (#922) is merged (Settings visible + per-item gates). Today `apps/web/src/pages/account/
UserProfilePage.tsx` mounts `<GlobalListsSection />` — a company-wide admin surface mis-shelved inside a
personal Account page (it's ALSO the "Lists" tab of `/admin/rates-lists` → RatesListsAdminPage). This
slice gives that surface ONE home under Company at `/settings/reference-data` and removes the personal
mount. This is a MOVE, NOT a rework — the section stays admin-shape internally.

## Binding spec — READ IT
Read `docs/plans/settings-restructure-plan.md` on main (UTF-16): §3 SLICE 6 (file list), §2 (Company →
"Reference data & Lists" — /settings/reference-data, gate: rates.manage OR lists.manage), §4 redirect map
(/admin/rates-lists → its new home), §5.1 (e2e). Implement exactly to §3 SLICE 6.

## What to build (~4 files)

### 1. Remove the personal mount
`apps/web/src/pages/account/UserProfilePage.tsx` — remove `<GlobalListsSection />` (and its now-unused
import). UserProfilePage stays a personal Account page; the company Lists surface no longer renders there.

### 2. New Company route
`apps/web/src/App.tsx` — add a route `/settings/reference-data` rendering the EXISTING
`RatesListsAdminPage` (or a thin wrapper around it — do NOT duplicate/rebuild the page). Gate it the same
way its content is gated today. Convert `/admin/rates-lists` to a `<Navigate to="/settings/reference-data"
replace />` redirect per the §4 redirect map (keep the old path resolving).

### 3. SettingsShell nav item
`apps/web/src/components/SettingsShell.tsx` — add the Company sub-nav item "Reference data & Lists" →
`/settings/reference-data`, gated with `requiresPermission` on `rates.manage` OR `lists.manage` (use the
existing per-item gating from SLICE 3; use codes that EXIST in the permission registry — do NOT invent
codes; if only one of rates.manage/lists.manage exists, gate on that and note it in the PR body).

### 4. e2e updates (§5.1)
Update any spec that hard-asserts Lists living under Account, or the `/admin/rates-lists` URL as the Lists
home. List every spec + assertion you changed in the PR body. If none hard-assert it, say so (like the
SLICE-4 PR did).

## Do NOT
- Do NOT rework/rebuild the Lists surface — MOVE only (render the existing RatesListsAdminPage /
  GlobalListsSection component at the new route). No behaviour/data change.
- Do NOT delete `/admin/rates-lists` outright — it becomes a Navigate redirect.
- Do NOT invent permission codes. Do NOT change schema/API/`/sot/`. Do NOT touch Azure/Entra/SharePoint.
- Do NOT pull other slices' work (no /settings/administration landing, no tab dissolution, etc.).

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does not mean "wait for approval
> before starting". There is no human in this run — finishing then asking permission = failing.

## Guardrails
- One attempt. If `/settings/reference-data` already routes in App.tsx on main, say `NO-OP`.
- Never ask a question or "stand by". Read the CI job log before diagnosing a failure.
- `pnpm --filter @project-ops/web build` + `pnpm --filter @project-ops/web lint` must pass, and the web
  vitest suite must be green. Update every nav/e2e assertion this move invalidates; list them in the PR
  body. The Lists surface must render identically at /settings/reference-data as it did before.
