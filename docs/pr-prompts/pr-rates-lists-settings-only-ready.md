---
premise: grep -q "/admin/rates-lists" apps/web/src/components/ShellLayout.tsx
premise_means: ShellLayout still has the top-level sidebar item "Rates & Lists" (to=/admin/rates-lists). It redirects to /settings/reference-data but currently lands on /settings/account because the reference-data child route is not resolving. It should be removed from the sidebar and kept only inside Settings.
scope:
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/App.tsx
  - apps/web/src/components/SettingsShell.tsx
  - apps/web/src/components/__tests__/ShellLayout.nav.test.ts
done_when: pnpm --filter @project-ops/web lint && pnpm --filter @project-ops/web test && ! grep -q "/admin/rates-lists" apps/web/src/components/ShellLayout.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# fix(web): consolidate Rates & Lists under Settings; remove sidebar entry (#5)

## What exists on main
- `apps/web/src/components/ShellLayout.tsx` has a sidebar item `{ to: "/admin/rates-lists", label: "Rates & Lists", ... }`.
- `App.tsx` redirects `/admin/rates-lists` → `/settings/reference-data`, but that child route isn't landing, so it falls through to the SettingsShell default → **`/settings/account`** (the bug Marco sees).
- `SettingsShell.tsx` already has a "Reference data & Lists" sub-nav item (SLICE 6, settings-restructure).

## What to build
1. **Remove** the "Rates & Lists" item from `ShellLayout` `NAV_GROUPS` (and its breadcrumb-title map entry if present). **Keep** the `/admin/rates-lists → /settings/reference-data` redirect in `App.tsx` for old bookmarks.
2. **Fix the route:** ensure `/settings/reference-data` actually renders `RatesListsAdminPage` under `SettingsShell` — add/repair the `<Route path="reference-data" ...>` child in `App.tsx` if it is missing or mis-wired, so it no longer falls through to `/settings/account`.
3. Confirm the SettingsShell **"Reference data & Lists"** item points at `/settings/reference-data` (match the sibling `requiresPermission` gating pattern, e.g. `rates.manage`, if siblings gate).
4. Update `ShellLayout.nav.test.ts` — the Estimating group no longer lists "Rates & Lists".

## Do NOT
- Do NOT change `RatesListsAdminPage` behaviour or any rates data/API — relocate + route only.
- Do NOT touch other nav groups or Settings items.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** Not wait-before-starting, not
> do-then-ask. There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if genuinely impossible.
- `pnpm --filter @project-ops/web lint` and `...test` must pass before opening the PR.
- Never ask for or wait on approval.
