---
premise: 'grep -q "id: \"operations\"" apps/web/src/pages/AdminSettingsPage.tsx'
premise_means: The Operations (fuel) tab still exists in AdminSettingsPage, so SLICE 13 (fold commercial defaults under Company profile) has not landed yet.
scope:
  - apps/web/src/**
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && ! grep -q "id: \"operations\"" apps/web/src/pages/AdminSettingsPage.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 922
  - 947
---

# SLICE-13: Consolidate commercial defaults (Operations / Fuel) under the Company profile

## Premise
`docs/plans/settings-restructure-plan.md` §3 SLICE 13. The `OperationsTab` (fuel price + interim travel
rate — the waste-transport cost-engine R3 inputs) currently lives inside `AdminSettingsPage.tsx` under
its `operations` tab. Its natural home is the "Commercial defaults" section of the Company profile page,
`AdminCompanyPage.tsx`. This slice MOVES that content into AdminCompanyPage's existing "Commercial
defaults" section and deletes the `operations` tab from AdminSettingsPage. MOVE ONLY — no behaviour,
API, schema, permission, or /sot/ change. NON-GOAL: no re-skin (finding 11 is a separate slice, 18a).

## Binding spec — read it
`docs/plans/settings-restructure-plan.md` on main, §3 SLICE 13. Verified against main:
- In `apps/web/src/pages/AdminSettingsPage.tsx`: the tab entry `{ id: "operations", label: "Operations" }`,
  its render `{tab === "operations" && <OperationsTab />}`, and a LOCAL `function OperationsTab()` (with a
  local `type OperationsSettings`) that calls `authFetch("/admin/settings/operations")` and renders the
  "Operations / Fuel" fields (fuel price per litre AUD, fuel price source, fetched-at line).
- `apps/web/src/pages/admin/AdminCompanyPage.tsx` is section-based: `const SECTIONS = [...]` already
  includes `{ id: "commercial", label: "Commercial defaults" }`, rendered via a `section === "commercial"`
  branch.

## What to build (all under apps/web/src/ and tests/e2e/)

1. **Move `OperationsTab` + its `OperationsSettings` type** out of `AdminSettingsPage.tsx` and into
   `AdminCompanyPage.tsx`. Move VERBATIM — same `authFetch("/admin/settings/operations")` GET/PATCH, same
   fields, same behaviour. Carry over any imports/helpers it needs (authFetch, useState/useEffect, etc.);
   remove them from AdminSettingsPage only if nothing else there still uses them.

2. **Render it in the "Commercial defaults" section** of AdminCompanyPage: inside the
   `section === "commercial"` render branch, add the Operations/Fuel content (either inline or as the
   moved `OperationsTab` component) below the existing commercial-defaults content. Preserve the existing
   heading/blurb copy ("Operations / Fuel", the R3 waste-transport explanation). Keep all other
   AdminCompanyPage sections intact.

3. **AdminSettingsPage.tsx**: remove the `{ id: "operations", label: "Operations" }` TABS entry, the
   `{tab === "operations" && <OperationsTab />}` render branch, and the now-unused local `OperationsTab`
   function + `OperationsSettings` type. Do NOT touch any other tab.

4. **E2E** `tests/e2e/**`: update EVERY assertion that reached Operations/fuel via the AdminSettings
   `operations` tab so it targets the Company profile "Commercial defaults" section. Also CHECK
   `tests/e2e/pr-acceptance/batch8-admin-portal.spec.ts` — the "renders all section tabs" test asserts a
   list (currently Notifications / Email / AI & Integrations; "Operations" is NOT in it, so it should be
   unaffected — but VERIFY and drop any newly-stale entry). Keep coverage equivalent and tendering-e2e green.

## Do NOT
- Do NOT change fuel/operations behaviour, the `/admin/settings/operations` API, DTOs, or the cost engine.
- Do NOT re-skin (that is SLICE 18a). Do NOT touch other AdminSettingsPage tabs or other AdminCompanyPage sections beyond adding to "commercial".
- Do NOT change schema/API/permission registry or /sot/. Do NOT touch Azure/Entra/SharePoint. Do NOT read/print/rotate any key value.
- Do NOT pull in SLICE 14 or any other slice.

## STANDING AUTHORITY
> You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
> There is no human in this run. Finishing the work then asking permission is failing.

## Guardrails
- One attempt. If the `operations` tab is already gone from AdminSettingsPage on main, say `NO-OP`.
- `pnpm --filter @project-ops/web build` and the web vitest suite must pass; keep tendering-e2e green
  (update stale admin-tab assertions). Read the CI job log before diagnosing any failure.
- Parity: an admin sets the fuel price / source exactly as before, now under Company profile → Commercial
  defaults; the AdminSettings "Operations" tab is gone.
