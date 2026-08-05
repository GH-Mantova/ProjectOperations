---
premise: 'grep -q "Audit log" apps/web/src/pages/AdminSettingsPage.tsx'
premise_means: The Admin-settings in-page "Audit log" stub tab still exists, so SLICE 9 (delete the audit stub) has not landed yet.
scope:
  - apps/web/src/**
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && ! grep -q "Audit log" apps/web/src/pages/AdminSettingsPage.tsx
size: 3
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 922
  - 936
---

# SLICE-9: Delete the Audit stub tab; keep the working AuditLogsPage

## Premise
`docs/plans/settings-restructure-plan.md` §3 SLICE 9. `AdminSettingsPage.tsx` still carries a dead
in-page "Audit log" tab that renders a `<StubCard>` ("Coming soon. All admin actions are recorded.").
The REAL audit surface is `AuditLogsPage`, already mounted at `/settings/administration/audit` and
already linked from the SettingsShell "Audit" nav item. This slice deletes ONLY the dead stub tab.
No behaviour change, no schema, no API, no /sot/ change.

## Binding spec — read it
`docs/plans/settings-restructure-plan.md` on main, §3 SLICE 9. Verified against main: the tab entry is
`{ id: "audit", label: "Audit log" }` and its render is `{tab === "audit" && <StubCard title="System
audit log" body="Coming soon. All admin actions are recorded." />}`.

## What to build (all under apps/web/src/ and tests/e2e/)

1. **AdminSettingsPage** `apps/web/src/pages/AdminSettingsPage.tsx`:
   - Remove the `{ id: "audit", label: "Audit log" }` entry from the `TABS` array.
   - Remove its render branch `{tab === "audit" && <StubCard ... />}`.
   - If the local `StubCard` component (and any now-unused imports) is left with ZERO remaining
     references in this file after that removal, delete the `StubCard` definition too. If StubCard is
     still referenced by another tab, LEAVE it. Verify by grep before deleting.
   - Do NOT touch any other tab (notifications, email, operations, access-requests, ai, integrations,
     platform, geofences, client-versions, map-locations) or the page header copy.

2. **Do NOT** touch `SettingsShell.tsx` — its "Audit" item already points at
   `/settings/administration/audit` (the real `AuditLogsPage`) and must stay exactly as-is.

3. **Do NOT** touch `AuditLogsPage.tsx`, `App.tsx`, routes, or redirects.

4. **E2E** `tests/e2e/**/batch8-admin-portal.spec.ts` (and siblings): drop any assertion that the
   Admin-settings section tabs include "Audit log" / the stub; keep everything else. Do not add coverage
   for the real AuditLogsPage here (out of scope).

## Do NOT
- Do NOT change schema/API/permissions or /sot/. Do NOT touch Azure/Entra/SharePoint. Do NOT read/print/rotate any key value.
- Do NOT pull in SLICE 10 (Automations) or any other slice.

## STANDING AUTHORITY
> You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
> There is no human in this run. Finishing the work then asking permission is failing.

## Guardrails
- One attempt. If the "Audit log" stub tab is already gone on main, say `NO-OP`.
- `pnpm --filter @project-ops/web build` and the web vitest suite must pass. Read the CI job log before
  diagnosing any failure.
- Parity: the real audit log at `/settings/administration/audit` is unchanged and still reachable.
