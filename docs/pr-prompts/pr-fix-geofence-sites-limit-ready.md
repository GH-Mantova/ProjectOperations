---
premise: grep -qF "master-data/sites?limit=500" apps/web/src/pages/AdminSettingsPage.tsx
premise_means: The Admin Settings geofence tab fetches sites with the unsupported limit=500 query; the /master-data/sites endpoint caps limit at 100 and returns 400 ("limit must not be greater than 100"), so the Site dropdown never loads.
scope:
  - apps/web/src/pages/AdminSettingsPage.tsx
done_when: pnpm build && pnpm lint && ! grep -qF "sites?limit=500" apps/web/src/pages/AdminSettingsPage.tsx
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# Fix: Site geofences dropdown 400s on `limit=500`

## Context (verified on origin/main)
In `apps/web/src/pages/AdminSettingsPage.tsx` the geofence loader runs
`authFetch("/master-data/sites?limit=500")`. The `/master-data/sites` endpoint validates
`limit <= 100` and returns `400 {"message":["limit must not be greater than 100"]}`, so the
Site `<select>` on the Site geofences tab stays stuck on "Loading…". Every other caller in the
app uses the page convention `?page=1&pageSize=100` (see `SITES_OPTIONS_URL` in
`apps/web/src/dashboards/WidgetSettingsPopover.tsx`, plus JobsPage, CrmBoardPage,
OpportunityDetailPage, MasterDataWorkspacePage).

## What to build
Change that single fetch to `/master-data/sites?page=1&pageSize=100`. If the response shape the
geofence code reads differs from what the paged endpoint returns (page envelope `{ data, ... }`
vs a bare array), adapt the consuming code in the same function so the sites list renders in the
dropdown. Keep the change to this one loader.

## Do NOT
- Do NOT raise or remove the API's `limit` cap — the client is wrong, not the server.
- Do NOT refactor `AdminSettingsPage.tsx` or touch any other tab. The Settings restructure plan
  (PR #840) owns that file's broader rework; stay strictly inside this one fetch.
- Do NOT add pagination UI — one page of 100 sites matches every sibling caller.

## VERIFY
- `pnpm build && pnpm lint`
- `! grep -qF "sites?limit=500" apps/web/src/pages/AdminSettingsPage.tsx`

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — if the work is already on `main`, say `NO-OP: <reason>`.
Never ask a question or "stand by" for approval; there is no human in a headless run.
Read the CI job log before diagnosing any failure.
