# settings-restructure — `/sot/` reconcile marker (SLICE 20)

**Station:** 05 SoT-Keeper · **Date:** 2026-08-24 (UTC) · **Base:** `origin/main c17a8bb6`
**Discharges:** backlog item `settings-restructure-sot-nav-reconcile`
(`docs/pr-prompts/BACKLOG.yaml:357`), whose gate is
`test -f apps/web/src/pages/administration/MapLocationsPage.tsx && ! test -f docs/audits/settings-restructure-sot-reconcile.md`.
This file is the second half of that gate. Its existence closes the item.

## Gate re-verified before acting

| Half | Command | Result |
|---|---|---|
| SLICE 14 landed | `git ls-tree -r --name-only origin/main \| grep MapLocationsPage` | `apps/web/src/pages/administration/MapLocationsPage.tsx` — **present** |
| Reconcile not yet shipped | `git ls-tree -r --name-only origin/main -- docs/audits/settings-restructure-sot-reconcile.md` | **empty — absent** |

Note the page lives under `pages/administration/`, **not** `pages/settings/`. Anything asserting
the latter path is wrong.

## What was reconciled

### `sot/01` SECTION 9, group 7 (SETTINGS) — rewritten

Reconciled against the shipped nav model, `apps/web/src/components/settings-nav-items.ts`
(`PERSONAL_ITEMS`, `COMPANY_ITEMS`, `ADMINISTRATION_ITEMS`) — the operative source for Settings
destinations and their permission codes. Every route and permission code in the new block was read
out of that file at `origin/main c17a8bb6`.

Drift closed:

- **SLICE 14** — `Client versions` (`/settings/administration/client-versions`) and `Map locations`
  (`/settings/administration/map-locations`) were missing from §9 entirely. Both added, both gated
  on `system.manage`.
- **SLICE 17** — §9 said `Administration (admin/super only)`. That blanket guard is gone:
  `App.tsx:454` records "administration hub — outer AdminOnly guard removed", and each screen now
  carries its own code (`users.view`, `roles.view`, `audit.view`, `sharepoint.view`,
  `automations.view`, `system.manage`, `platform.admin`, `crm.manage`). The heading and every row
  now name the real code.
- **SLICE 15** — §9 listed `Job Roles` under Settings › Administration. It is not there. It moved to
  HR at `/workers/job-roles` (`ShellLayout.tsx:331-340`, gate `resources.manage`). §9 now says so.
- **`Permissions`** was listed as a Settings screen. It is not one — it folded into
  `Roles & Permissions`, and `/settings/administration/permissions` redirects (`App.tsx:495`).
- **Company group** was three items (`Company | AI Settings | Data Model`); it is seven —
  `Reference data & Lists`, `Handover template`, `Field definitions` and `Companies` were absent.
- **`Xero file exchange`** and **`CRM drop reasons`** were absent from Administration.

### `sot/01` SECTION 9 trailing note — updated with measurements

`/tenders/dashboard` returns 0 hits in `App.tsx`; `/admin/estimate-rates` redirects to
`/settings/reference-data` (`App.tsx:611-612`, SLICE 11b) as does `/admin/rates-lists`
(`App.tsx:622`). Both follow-ups are done and the note now says so. **The two seeded dashboards were
not re-verified in this pass** and are called out as still open, rather than silently dropped.

### `sot/01` SECTION 3 "Key URLs" and SECTION 15 — the fetch-URL contradiction, fixed

`sot/01:105` said *"use blob URL — raw CDN has delays"*; `sot/01:1261` said *"always use the raw
URL"*. A new chat's **first action** is a fetch, so the charter was contradicting itself at the
worst possible moment. Both sites now point at the same rule: **`?plain=1`** (raw and the GitHub MCP
also truthful; a bare blob URL has been observed serving a 2026-07-08 render of `sot/README.md`
carrying the retired MAIN/OldMain#/Chat#/DR# routing model).

### `sot/05` D42 — marked RESCINDED

Row `D42` was `REGISTERED` and read *"Leave SLICE 0 gate PRs open; never merge them"*, with a
footnote asking for Marco's ruling. Marco rescinded it on 2026-08-20. The row and the
"Rows needing Marco's attention" bullet now both record the rescission and its evidence — #1146,
#1149 and #1150 were merged 2026-08-17 and their SLICE 0 prompts then ran.

## Deliberately NOT changed

1. **`sot/01` §9 groups 1-6 and FIELD.** Those describe the pre-NAV-1 sidebar and are wrong, but
   they are already claimed by a staged prompt:
   `docs/pr-prompts/pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md` (NAV-5), which states in its own
   text that group 8/SETTINGS is SLICE 20's and must not be touched by NAV-5. The division of labour
   is respected in both directions. ⚠️ **NAV-5's replacement block now embeds a stale copy of group 7
   — see the breadcrumb `docs/pr-prompts/00-05-sot-keeper-2026-08-24-0110-nav5-group7-now-stale.md`.**
2. **`sot/04`.** The backlog item's `why` anticipated sot/04 going stale via "the dropped
   Estimate*Rate tables at SLICE 11c". **SLICE 11c has not landed.** All eight models
   (`EstimateLabourRate`, `EstimatePlantRate`, `EstimateWasteRate`, `EstimateCuttingRate`,
   `EstimateCoreHoleRate`, `EstimateFuelRate`, `EstimateEnclosureRate`, `EstimateMaterialDensity`)
   are still on `apps/api/prisma/schema.prisma` at `origin/main c17a8bb6`, and every
   `/estimate-rates/*` endpoint is still on `estimates.controller.ts`. Editing sot/04 to reflect a
   drop that has not happened would have been the error. No sot/04 edit is due from SLICE 20.
3. **`sot/02` and `sot/03`.** Both carry large, separately-measured drift (see the PR body). They are
   not settings-restructure drift and are not in this item's scope.
