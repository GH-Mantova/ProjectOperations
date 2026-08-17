---
premise: '! grep -rq "schedule-of-rates" apps/web/src'
premise_means: The web app has no consumer of the Schedule-of-Rates API yet — the SoR master admin screen (S2) does not exist. S1 (schedule-of-rates API + models) is already merged on main.
scope:
  - apps/web/src/pages/ScheduleOfRatesAdminPage.tsx
  - apps/web/src/App.tsx
  - apps/web/src/pages/EstimateRatesAdminPage.tsx
  - apps/web/src/lib/**
done_when: pnpm --filter @project-ops/web build && pnpm --filter @project-ops/web lint && grep -rq "schedule-of-rates" apps/web/src
size: 6
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_file_on_main: apps/api/src/modules/schedule-of-rates/schedule-of-rates.service.ts
---

# SoR S2 — Schedule of Rates master admin UI + change-log view

**Binding plan:** `docs/plans/sor-program-plan.md` on main — read the "Locked rules" and the S2 line
in full first. This is the **second** SoR slice; **S1 is merged** (models `SorPeriod`, `SorRate`,
`SorChangeLogEntry`; module `apps/api/src/modules/schedule-of-rates/`). This slice is **web-only** —
do NOT touch the API, schema, or migrations.

## Grounded API (S1, on main) — the screen consumes exactly these
Controller `apps/api/src/modules/schedule-of-rates/schedule-of-rates.controller.ts`,
base path `schedule-of-rates`, every endpoint guarded by permission **`rates.manage`**:
- `GET  schedule-of-rates/periods`            — list periods (year, half H1/H2, start/expiry, status)
- `GET  schedule-of-rates/periods/:id`        — one period with its rates
- `POST schedule-of-rates/periods`            — create a period
- `POST schedule-of-rates/periods/:id/rates`  — add a rate to a period
- `PATCH schedule-of-rates/rates/:id`         — edit a rate (append-only supersede — see change log)
- `DELETE schedule-of-rates/rates/:id`        — remove a rate
- `GET  schedule-of-rates/periods/:id/change-log` — append-only change-log entries for the period

Confirm the exact DTO field names against the controller/service on main at build time (do not guess).

## What to build
A master rate-book admin screen, mirroring the existing rates-admin pages — **read these two first
and follow their structure, API-call style, and design tokens exactly**:
`apps/web/src/pages/EstimateRatesAdminPage.tsx` and `apps/web/src/pages/admin/RatesListsAdminPage.tsx`.

1. **`apps/web/src/pages/ScheduleOfRatesAdminPage.tsx`** (new):
   - **Period selector** — dropdown of periods from `GET periods` (label like "H1 2026 — expires 30 Jun",
     show status). Selecting one loads `GET periods/:id`.
   - **Four category tables** matching the master catalog (sor plan "Locked rules"):
     Labour (Position · Class · **Ordinary / 1.5x / 2x** rate columns), Plant/Equipment/Consumables
     (unit + rate), Waste (unit + rate), Subcontractors (cost+ — `isReference`). Group the period's
     `SorRate` rows by their category field.
   - **Add / edit / remove** a rate via `POST periods/:id/rates`, `PATCH rates/:id`, `DELETE rates/:id`.
     Editing is the append-only supersede the API implements — surface it as a normal edit; do not build
     a separate mutate-in-place path.
   - **Change-log view** — a panel/tab rendering `GET periods/:id/change-log` (append-only history).
   - Use the same data-fetching/mutation helper the sibling pages use (e.g. the shared api client in
     `apps/web/src/lib/**`); do not invent a new fetch layer.
2. **Route + nav** in `apps/web/src/App.tsx`: register the page at `/admin/schedule-of-rates` following
   the exact pattern of the `/admin/estimate-rates` route (import + `<Route>`), and add it to the same
   Estimating/Settings nav grouping the sibling rates pages use. Guard it for `rates.manage` the same
   way the sibling admin routes guard their permission.

## Do NOT
- Do NOT touch the API, `schema.prisma`, migrations, or seed — S1 shipped those; this is UI-only.
- Do NOT wire the SoR into tender/estimate pricing — the SoR is a separate axis (plan "What this is NOT").
- Do NOT build the per-client rate card (S3), attach-to-job wizard (S4), or PDF (S5) — later slices.
- Do NOT invent a parallel category taxonomy — use the categories the S1 `SorRate` model defines.
- Do NOT touch Azure/Entra/SharePoint or `/sot/`.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if the screen already exists on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval.
- Read the CI job log before diagnosing a failure.
- `pnpm --filter @project-ops/web build` and `lint` must pass.
