---
premise: ! test -f apps/web/src/pages/schedule-of-rates/CreateSorPage.tsx
premise_means: The CreateSorPage component does not exist yet — S4 Create-SoR wizard is still needed.
requires_file_on_main: apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts
scope:
  - apps/web/src/pages/schedule-of-rates/CreateSorPage.tsx
  - apps/web/src/pages/schedule-of-rates/**
  - apps/api/src/modules/schedule-of-rates/create-sor.service.ts
  - apps/api/src/modules/schedule-of-rates/**
  - apps/web/src/App.tsx
  - apps/web/src/components/ShellLayout.tsx
done_when:
  - pnpm build
  - pnpm lint
  - test -f apps/web/src/pages/schedule-of-rates/CreateSorPage.tsx
  - grep -q "CreateSorPage" apps/web/src/App.tsx
size: 8
gate_allow: none
seed_only: false
escalates: false
---

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. If the premise is already satisfied on main, say `NO-OP: premise already satisfied`
  and exit.
- Never ask a question. Decide from the evidence, or write to `needs-marco/` and stop.
- Before diagnosing any CI failure, read the job log via `gh run view <run-id> --log`.
- Say `NO-OP: <reason>` loudly if you cannot finish. A silent exit is treated as success by the
  watcher — that is the worst outcome.

## Context

Plan: `docs/plans/rate-hub-sor-integration-plan.md` (read it, especially §Locked Decisions #5).

This slice builds the "Create Schedule of Rates" wizard: a multi-step flow that lets the user
select lines from all three hub tabs (Internal rates, Subcontractors, Suppliers), preview markup,
and create a period-stamped `SorPeriod` with populated `SorRate` rows. The snapshot freezes at lock.

## Ground first — read these files (cite line numbers)

1. `apps/api/prisma/schema.prisma` lines 6980–7030 (`SorPeriod`, `SorRate` — what we create).
2. `apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts` (from S3) —
   `resolveEffectiveRate`, `linkInternalRate`, `linkVendorRate` to call during creation.
3. `apps/web/src/pages/ScheduleOfRatesAdminPage.tsx` — existing SoR admin; the wizard navigates
   back here after creation. Do NOT rebuild this page.
4. `apps/web/src/App.tsx` — how existing routes are registered; add the new route here.
5. `apps/web/src/pages/admin/RatesListsAdminPage.tsx` — the "Create SoR" button lives here (add it).

## What to build

### 1. New API service
Create `apps/api/src/modules/schedule-of-rates/create-sor.service.ts`:

- `createSorPeriod(dto: CreateSorDto, actorId: string): Promise<SorPeriod>` —
  - Validates year+half uniqueness (throws `ConflictException` if period already exists).
  - Creates the `SorPeriod` row.
  - For each selected line in `dto.lines`:
    - Creates a `SorRate` row with `sourceType`, `sourceRateRowId` or `sourceSubRateId` per S3.
    - Calls `resolveEffectiveRate` to compute the effective rate and stores it in `ordinary`.
  - Writes audit log.
  - Returns the created period with its rates.

DTO shape:
```ts
type CreateSorLineDto = {
  name: string;
  category: string;  // SorCategory value
  unit: string;
  baseRate: number;
  sourceType: 'INTERNAL' | 'SUBBIE' | 'SUPPLIER' | 'MANUAL';
  sourceRateRowId?: string;
  sourceSubRateId?: string;
  markupPct?: number;  // per-line override; if absent, category default applies
};

type CreateSorDto = {
  year: number;
  half: 'H1' | 'H2';
  startDate: string;
  expiryDate: string;
  label: string;
  lines: CreateSorLineDto[];
};
```

Add endpoint: `POST /schedule-of-rates/create-period` — calls `createSorPeriod`.

### 2. New wizard page
Create `apps/web/src/pages/schedule-of-rates/CreateSorPage.tsx`:

Multi-step wizard (use a step state machine, no external wizard library):
- **Step 1 — Period details:** year, half, startDate, expiryDate, label.
- **Step 2 — Select lines:** three sub-tabs (Internal / Subcontractors / Suppliers).
  Each sub-tab shows the hub view (fetched from the hub-view endpoint added in S1).
  User checks rows to include. Shows base rate and computed effective rate (category markup applied).
- **Step 3 — Review + markup:** table of selected lines with per-line `markupPct` override
  column; shows effective rate column. User adjusts markups here.
- **Step 4 — Confirm:** summary card; "Create SoR" button calls the API. On success navigates to
  `/admin/schedule-of-rates` with the new period selected.

### 3. Route + nav
- Add route in `apps/web/src/App.tsx`:
  `<Route path="/schedule-of-rates/create" element={<CreateSorPage />} />`
- Add a "Create SoR" button in `apps/web/src/pages/admin/RatesListsAdminPage.tsx` that navigates
  to `/schedule-of-rates/create`.

## Do NOT
- Do NOT modify the existing `SorPeriod` list/edit on `ScheduleOfRatesAdminPage`.
- Do NOT change the schema — this slice has no migrations.
- Do NOT duplicate hub data — the wizard reads the hub-view endpoint; it does not copy data.
- Do NOT lock/freeze the SoR period in this slice (freeze logic is a later lifecycle step;
  `status` defaults to `ACTIVE` which is the correct initial state).
- Do NOT edit `/sot/`.

## VERIFY
```
pnpm build && pnpm lint
test -f apps/web/src/pages/schedule-of-rates/CreateSorPage.tsx
grep -q "CreateSorPage" apps/web/src/App.tsx
grep -q "create-sor.service" apps/api/src/modules/schedule-of-rates/create-sor.service.ts
```
All must pass before you open the PR.

Open the PR with a title like:
`feat(rate-hub): S4 — Create Schedule of Rates wizard (3-tab line picker + markup preview)`

Leave it UNMERGED.
