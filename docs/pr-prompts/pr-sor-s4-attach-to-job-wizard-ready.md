---
premise: '! grep -q "model JobSorSnapshot" apps/api/prisma/schema.prisma'
premise_means: The Job SoR snapshot models (JobSorSnapshot / JobSorSnapshotRate) do not exist yet — no wizard has attached a locked rate book to any job. S1 (SorPeriod / SorRate / SorChangeLogEntry), S2 (master admin UI), S3 (SorClientRateCard / SorClientRateEntry) and S5 (client SoR PDF) are already merged on main.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/schedule-of-rates/job-sor-snapshot.service.ts
  - apps/api/src/modules/schedule-of-rates/job-sor-snapshot.controller.ts
  - apps/api/src/modules/schedule-of-rates/schedule-of-rates.module.ts
  - apps/api/src/modules/schedule-of-rates/__tests__/job-sor-snapshot.service.spec.ts
  - apps/web/src/pages/JobSorAttachWizardPage.tsx
  - apps/web/src/App.tsx
done_when: pnpm build && pnpm lint && grep -q "model JobSorSnapshot" apps/api/prisma/schema.prisma && test -f apps/api/src/modules/schedule-of-rates/job-sor-snapshot.service.ts
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Additive migration only — two new tables (JobSorSnapshot, JobSorSnapshotRate); no existing table/column altered. Safe to leave on main; a down migration drops both tables. Forward-only otherwise.
backfill: false
---

# SoR S4 — attach-to-job wizard + Job SoR snapshot & per-record version lock

Slice S4 of the Schedule of Rates program (`docs/plans/sor-program-plan.md` on main; design in memory
`project_sor_program`). **S1/S2/S3/S5 are merged.** This slice is the **chain head** for the workflow
layer: it stands up the attach-to-job wizard and — critically — the Job SoR **snapshot + version-lock**
that S6, S7, S8, S9 all key off. It is SEPARATE from tender pricing; do NOT touch the tender/estimate
rate engine, `TenderRateSet`, or `EstimatePlantRate`/`EstimateWasteRate`.

Note on the parallel rate-hub program: the rate hub extends `SorRate` with source/markup fields; the
snapshot below freezes **effective** rate values at lock (ordinary / oneAndHalf / double / isReference),
so it composes with the rate-hub regardless of merge order. Do NOT hard-depend on rate-hub slices.

## Grounded (read first — on main today)
- `apps/api/prisma/schema.prisma` — `SorPeriod`, `SorRate`, `SorChangeLogEntry` (S1); `SorClientRateCard`,
  `SorClientRateEntry` (S3). `Job` (line 1420) is the attach target for live jobs; `Tender` for tenders.
- `apps/api/src/modules/schedule-of-rates/` (S1 module) — reuse its service pattern & `rates.manage`
  permission guard.
- `apps/web/src/pages/ScheduleOfRatesAdminPage.tsx` (S2) and the tender/new-tender wizard for the
  cascade UI reference — mirror their layout, API-call style, and design tokens; do NOT invent a new
  wizard shell.

## What to build

1. **`apps/api/prisma/schema.prisma`** — add TWO new models (nothing existing altered):
   - `JobSorSnapshot` — one row per (job OR tender) once the first VC/AR is created against it. Fields
     (indicative — confirm the exact `Job`/`Tender`/`SorPeriod` relation shapes on main):
     - `id`, `jobId String?` + `tenderId String?` (exactly one non-null, enforce in service),
     - `clientId` (denormalised for wizard queries), `sorPeriodId` (the period locked at attach time),
     - `sorClientRateCardId String?` (nullable — set if the client had a card at attach time),
     - `sorPeriodLabel String` (denormalised so it survives period rename/expiry),
     - `sorVersion String` (append-only version stamp; format `"<year>-<half>-<createdAt-iso>"`),
     - `lockedAt DateTime @default(now())`, `lockedById`, `status String @default("ACTIVE")`,
       `supersededById String?` (points at a later re-issued snapshot after expiry),
     - relation to `rates JobSorSnapshotRate[]`.
     - `@@unique([jobId, sorVersion])`, `@@unique([tenderId, sorVersion])`, `@@index([clientId])`.
   - `JobSorSnapshotRate` — the **frozen** rate rows copied from the merged (master + client card)
     view at lock time. Fields: `id`, `snapshotId`, `sourceRateId String?` (nullable — an added client
     line has no master row), `category SorCategory`, `name`, `class?`, `unit?`, `ordinary?`,
     `oneAndHalf?`, `double?`, `isReference Boolean`, `comments?`. `@@index([snapshotId, category])`.
2. **Migration** under `apps/api/prisma/migrations/` — additive only (create the two tables + indexes +
   FKs). Follow the recent additive migration style. Put a **bare `GATE-ALLOW: migrations`** line at
   column 0 of the PR body.
3. Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
   `docs/data-model/relationship-map.json`, `relationship-map.md`, and `metadata-catalog.json`.
4. **`apps/api/src/modules/schedule-of-rates/job-sor-snapshot.service.ts`** + `.controller.ts`, wired
   into `schedule-of-rates.module.ts`, guarded by `rates.manage`:
   - `POST job-sor-snapshot/attach` — body `{ jobId?|tenderId?, sorPeriodId }`. Loads the client's
     `SorClientRateCard` (if any) for that period, merges master + overrides − removals (mirror the
     merge already used in the S3 client-card service), copies the merged rows into
     `JobSorSnapshotRate`, and writes the `sorVersion`. **Idempotent per (job, sorVersion)** — first
     VC/AR triggers this via S6/S7; a second call for the same period returns the existing snapshot.
   - `GET job-sor-snapshot/for-job/:jobId` (and `/for-tender/:tenderId`) — return active snapshot + rates.
   - `POST job-sor-snapshot/:id/reissue` — re-issues a NEW snapshot for the next period when the old
     one's `sorPeriod.expiryDate` has passed; sets `supersededById` on the old snapshot but does NOT
     mutate its rates (old VC/AR keep their historical rate + sorVersion).
   - `GET job-sor-snapshot/rate/:snapshotId/:sortKey` — helper for S6/S7 to fetch a locked rate for
     stamping onto a VC/AR record (the "per-record rate lock" — S6/S7 read from the snapshot, never
     from live `SorRate`).
5. **`apps/web/src/pages/JobSorAttachWizardPage.tsx`** — cascade wizard mirroring the New Tender flow:
   step 1 pick Client → step 2 choose Tender OR Live Job (radio) → step 3 pick the specific
   tender/job → step 4 confirm period + attach. Route it at `/schedule-of-rates/attach` in
   `apps/web/src/App.tsx`, guarded for `rates.manage`. On submit call `POST attach` and route the
   user to the target job/tender page.
6. **Spec** at `apps/api/src/modules/schedule-of-rates/__tests__/job-sor-snapshot.service.spec.ts`
   using the repo's mock-Prisma pattern: cover (a) merge of master + client overrides at attach,
   (b) idempotency on repeat attach, (c) reissue sets `supersededById` and creates a new snapshot,
   (d) rate-fetch helper returns the locked rate not the live one.

## Do NOT
- Do NOT wire the SoR into tender/estimate pricing.
- Do NOT build the configurable approval-chain / roles editor UI — DEFERRED (separate PR).
- Do NOT create a parallel VC model — that is S6 and prices the EXISTING `Variation`.
- Do NOT touch `NotificationTrigger` here — S8 owns the office-lane notifications.
- Do NOT hard-depend on the rate-hub slices — the snapshot freezes effective values.
- Do NOT alter existing tables/columns; everything here is additive.
- Do NOT touch Azure/Entra/SharePoint or `/sot/`.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. If the snapshot already exists on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval.
- Read the CI job log (`gh run view <run> --job <job> --log`) before diagnosing a failure.
- Regenerate the data-model map up front — the drift check hard-fails a stale map.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
