---
premise: '! grep -q "administration/automations" apps/web/src/components/SettingsShell.tsx'
premise_means: The Automations surface is not yet adopted into the Settings/Administration nav, so SLICE 10 has not landed yet.
scope:
  - apps/web/src/**
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && grep -q "administration/automations" apps/web/src/components/SettingsShell.tsx
size: 3
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 922
  - 942
---

# SLICE-10: Adopt Automations into the Settings / Administration nav

## Premise
`docs/plans/settings-restructure-plan.md` §3 SLICE 10. `AutomationsPage` currently mounts at the
top-level `/admin/automations` route and has NO entry in the Settings shell. This slice adopts it into
the Administration nav at `/settings/administration/automations` (mirroring how Users/Roles/Audit/Job
roles already live under Settings), and turns the old `/admin/automations` into a redirect. Nav
plumbing only — NO rewrite of the automations/rules engine, no schema, no API, no /sot/ change.

## Binding spec — read it
`docs/plans/settings-restructure-plan.md` on main, §3 SLICE 10, plus §2 target IA and §4 redirect map.
Verified against main: `AutomationsPage` is imported in App.tsx from `./pages/admin/AutomationsPage`
and mounted as `<Route path="/admin/automations" element={<AutomationsPage />} />`. The permission code
`automations.view` EXISTS (permission-registry.ts) and `AutomationsPage` already self-gates on it
(`can(user, "automations.view")` → NoAccess). Do NOT invent codes.

## What to build (all under apps/web/src/ and tests/e2e/)

1. **SettingsShell** `apps/web/src/components/SettingsShell.tsx`: add ONE new item to the
   **Administration** group:
   `{ to: "/settings/administration/automations", label: "Automations", requiresPermission: "automations.view" }`
   Place it consistently with siblings (e.g. after "Audit" / near Platform). Use the same
   `requiresPermission` field the sibling items use (Users=`users.view`, Audit=`audit.view`, etc.).

2. **App.tsx** `apps/web/src/App.tsx`:
   - Add a new route `administration/automations` under the SettingsShell/Administration area that
     renders `<AutomationsPage />`, wrapped exactly like its sibling administration routes (match the
     existing wrapper the neighbouring `administration/*` routes use — AdminOnly / RequirePermissions —
     do not invent a new pattern). `AutomationsPage` keeps its own internal `automations.view` gate.
   - Convert the existing `<Route path="/admin/automations" element={<AutomationsPage />} />` into a
     redirect: `<Route path="/admin/automations" element={<Navigate to="/settings/administration/automations" replace />} />`
     (mirror the existing `/admin/job-roles` → `/settings/administration/job-roles` redirect).
   - Keep the `AutomationsPage` import (still used by the new settings route).

3. **E2E** `tests/e2e/**` (batch that covers admin nav / automations): update any assertion that reaches
   Automations via `/admin/automations` so it targets `/settings/administration/automations`; assert the
   old URL redirects. Keep coverage equivalent.

## Do NOT
- Do NOT change `AutomationsPage` behaviour, the automations/rules engine, its API, or the permission model.
- Do NOT touch other SettingsShell items or other administration routes.
- Do NOT change schema/API/permission registry or /sot/. Do NOT touch Azure/Entra/SharePoint. Do NOT read/print/rotate any key value.
- Do NOT pull in SLICE 11 (estimate-rates) or any other slice.

## STANDING AUTHORITY
> You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
> There is no human in this run. Finishing the work then asking permission is failing.

## Guardrails
- One attempt. If `administration/automations` is already wired in SettingsShell on main, say `NO-OP`.
- `pnpm --filter @project-ops/web build` and the web vitest suite must pass. Read the CI job log before
  diagnosing any failure.
- Parity: a user with `automations.view` reaches Automations at the new Settings route; `/admin/automations` still resolves via redirect.
