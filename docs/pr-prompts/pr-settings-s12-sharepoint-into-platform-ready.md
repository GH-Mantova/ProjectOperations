---
premise: '! grep -q "SharePointTestPanel" apps/web/src/pages/PlatformPage.tsx'
premise_means: The SharePoint config panels still live in AdminSettingsPage (not yet moved into PlatformPage), so SLICE 12 has not landed yet.
scope:
  - apps/web/src/**
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && grep -q "SharePointTestPanel" apps/web/src/pages/PlatformPage.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 922
  - 945
---

# SLICE-12: Merge SharePoint config into the Platform page

## Premise
`docs/plans/settings-restructure-plan.md` §3 SLICE 12. The SharePoint config UI (`SharePointTestPanel`
and `SharePointFolderMappingsPanel`) currently lives INSIDE `AdminSettingsPage.tsx` under its `platform`
tab. Its real home is `PlatformPage.tsx` (mounted at `/settings/administration/platform`). This slice
MOVES those two panels into `PlatformPage.tsx` and deletes the now-redundant `platform` tab from
`AdminSettingsPage.tsx`. MOVE ONLY — no behaviour change, no schema/API/permission/`/sot/` change.

## IMPORTANT — hard-stop compliance
This is a front-end component RELOCATION only. Do NOT change any SharePoint/Azure/Entra integration,
endpoint, or configuration. The panels' existing calls (`authFetch("/sharepoint/test")`,
`authFetch("/admin/sharepoint-folder-mappings...")`) must be moved VERBATIM — do not touch the API, the
SharePoint tenant/site/library wiring, `SHAREPOINT_MODE`, or any secret/credential. No Azure/Entra/SharePoint infra changes.

## Binding spec — read it
`docs/plans/settings-restructure-plan.md` on main, §3 SLICE 12. Verified against main: BOTH
`SharePointTestPanel` and `SharePointFolderMappingsPanel` are LOCAL `function` definitions inside
`apps/web/src/pages/AdminSettingsPage.tsx` (not imported from elsewhere), rendered under the
`{tab === "platform" && ( ... )}` branch. `PlatformPage.tsx` exists at
`apps/web/src/pages/PlatformPage.tsx` and is the real `/settings/administration/platform` home.

## What to build (all under apps/web/src/ and tests/e2e/)

1. **Move the two panel components** `SharePointTestPanel` and `SharePointFolderMappingsPanel` (their
   FULL function definitions) OUT of `AdminSettingsPage.tsx` and INTO `PlatformPage.tsx`. Move VERBATIM
   — same JSX, same `authFetch` calls, same behaviour. Carry over any imports/helpers they depend on
   (e.g. `authFetch`, modal/confirm hooks, types) — add them to `PlatformPage.tsx` if not already
   present, and remove them from `AdminSettingsPage.tsx` ONLY if nothing else there still uses them.

2. **Render them in `PlatformPage.tsx`**: place `<SharePointTestPanel />` and
   `<SharePointFolderMappingsPanel />` in a sensible section of the Platform page (e.g. a "SharePoint"
   / "Platform integrations" section), preserving the existing heading/blurb copy that accompanied them
   ("Platform integrations — SharePoint" etc.). Keep PlatformPage's existing content intact.

3. **AdminSettingsPage.tsx**: remove the `{ id: "platform", label: "Platform" }` entry from the `TABS`
   array and the entire `{tab === "platform" && ( ... )}` render branch (including the moved panels and
   their surrounding heading/blurb). Do NOT touch any other tab.

4. **E2E** `tests/e2e/**` (admin-portal / platform specs): update any assertion that reached the
   SharePoint panels via the AdminSettings `platform` tab so it targets `PlatformPage` at
   `/settings/administration/platform`. Keep coverage equivalent.

## Do NOT
- Do NOT change panel behaviour, API endpoints, or any SharePoint/Azure/Entra config (hard stop).
- Do NOT touch other AdminSettingsPage tabs, other slices' surfaces, SettingsShell, or App.tsx routes
  (the `/settings/administration/platform` route + SettingsShell "Platform" nav item already exist).
- Do NOT change schema/API/permission registry or /sot/. Do NOT read/print/rotate any key/secret value.
- Do NOT pull in SLICE 13 (operations/fuel) or any other slice.

## STANDING AUTHORITY
> You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
> There is no human in this run. Finishing the work then asking permission is failing.

## Guardrails
- One attempt. If `SharePointTestPanel` already lives in `PlatformPage.tsx` on main, say `NO-OP`.
- `pnpm --filter @project-ops/web build` and the web vitest suite must pass. Read the CI job log before
  diagnosing any failure.
- Parity: a super-user reaching Platform sees the SharePoint connection test + folder mappings exactly
  as before, now on the Platform page; the AdminSettings "Platform" tab is gone.
