---
premise: '! test -f apps/api/src/modules/admin-imports/tender-tracker-import.service.ts'
premise_means: The tender-tracker import service does not exist on main yet — MIG-2 has not shipped.
scope:
  - apps/api/src/modules/admin-imports/**
  - apps/api/src/app.module.ts
requires_file_on_main: docs/data-model/tender-migration/MIG-1-DONE.md
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/admin-imports/tender-tracker-import.service.ts
size: 8
gate_allow: none
seed_only: false
escalates: true
---

# MIG-2 — Tender-tracker import endpoint + service (dry-run + commit)

**Binding plan:** `docs/plans/tender-tracker-migration-plan.md` (read it in full before starting).
This is **MIG-2**, the core slice of the legacy estimating-tracker migration program. It builds
the super-user endpoint that turns Marco's ~540-row estimating tracker into ERP `Tender`
rows (with matching `Client` and stub `Site` rows), plus `TenderClientNote` rows for follow-up
comms. MIG-1 has already dropped `Site @@unique([name])` (this slice's `requires_file_on_main`
gate confirms the landed marker exists on main before dequeue).

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails

One attempt. Never exit silently — say `NO-OP: <reason>` if the work is already on main. Never
ask a question or "stand by" for approval. Read the CI job log before diagnosing any failure.
`pnpm build` and `pnpm lint` must pass.

**Data-privacy hard rule (D9):** the real tracker workbook (client names, values, comms notes)
is UPLOADED to the endpoint at runtime — the repo is public and MUST NEVER contain a real row.
All spec fixtures under `__fixtures__/` MUST be synthetic. If you catch yourself typing a real
client name, stop and use a placeholder.

**Never invent Users (D6).** Unmatched estimator names → `estimatorUserId: null` and the row is
flagged in the dry-run report. Creating a User is out of scope.

---

## Grounded state on main (verified 2026-08-12)

- `Tender` model (`apps/api/prisma/schema.prisma` ~line 1146) fields to use:
  `tenderNumber` (unique), `title`, `status` (String default `"DRAFT"`), `estimatorUserId`,
  `siteId` (required), `dueDate`, `submittedAt`, `leadTimeDays`, `estimatedValue` (Decimal),
  `wonAt`, `lostAt`. Relations: `tenderClients` (`TenderClient`), `clientNotes`
  (`TenderClientNote`).
- `Client` model (~line 708): `name` is `@@unique`. Dedupe imports on normalised name
  (lowercase + collapse whitespace).
- `Site` model (~line 829): after MIG-1, `@@unique([name])` is REMOVED. Stub-site creation is
  safe. Site still requires `name` (String, not-null).
- `TenderClientNote` model (~line 2661): note rows for CRM to read per-client.
- Admin controller convention: `apps/api/src/modules/admin-settings/`,
  `apps/api/src/modules/admin-users/` — module + controller + service + spec. Follow this
  layout for `admin-imports`.
- No existing `admin-imports` module — create it.

## What to build

### 1. New module — `apps/api/src/modules/admin-imports/`

Standard NestJS module structure following the admin-settings / admin-users convention:

- `admin-imports.module.ts` — module registration; import `PrismaModule` (or however the other
  admin modules acquire `PrismaService` — read `admin-settings.module.ts` first and match).
- `tender-tracker-import.controller.ts` — exposes `POST /admin/imports/tender-tracker`.
- `tender-tracker-import.service.ts` — parser + mapper + committer.
- `tender-tracker-import.service.spec.ts` — unit tests over synthetic fixtures.
- `__fixtures__/synthetic-tracker.csv` (or an inline TypeScript fixture) — synthetic rows only.

Register `AdminImportsModule` in `apps/api/src/app.module.ts` alongside the other admin
modules.

### 2. Endpoint contract

```
POST /admin/imports/tender-tracker
Content-Type: multipart/form-data
Body: file=<xlsx or csv upload>, dryRun=<"true" | "false">
```

Guard: reuse the same super-user guard the other admin controllers use — read
`admin-users.controller.ts` and copy the exact `@UseGuards(...)` +
`@RequirePermissions(...)` (or role) decoration. Do NOT invent a new permission.

Response body (both modes) — a structured JSON report:

```typescript
interface TenderTrackerImportReport {
  dryRun: boolean;
  rowsRead: number;
  clientsToCreateOrExisting: number;
  clientsCreated: number;      // 0 when dryRun
  tendersToCreateOrUpdate: number;
  tendersCreated: number;      // 0 when dryRun
  tendersUpdated: number;      // 0 when dryRun (idempotency re-runs)
  notesCreated: number;        // 0 when dryRun
  unmatchedEstimators: string[]; // distinct raw names that did not match any User
  badRows: Array<{ row: number; reason: string }>;
}
```

### 3. Service behaviour — parser

Accept `.xlsx` and `.csv`. Pick a parser library that is ALREADY a workspace dependency (grep
`package.json` — do NOT add a new dep in this slice). If none is present for xlsx, restrict
this slice to `.csv` and log a `badRows` entry when a non-CSV file is uploaded. Note that
choice in the endpoint's response and in the PR body.

Parse the tracker's columns (case-insensitive header match, tolerant of extra whitespace):

- `Project Name` (required) → the tender's project name; the ERP `title` will be built from it.
- `Client Company Name` (required) → dedupe key for Client (normalised: lowercase +
  whitespace-collapsed).
- `Estimator` (optional) → best-effort match to User.
- `Tender Price` (optional) → Decimal.
- `Quote Due Date` (optional) → Date.
- `Date Submitted` (optional) → Date.
- `Lead time` (optional) → Int (days).
- `Probability` (optional; the mislabelled STAGE/OUTCOME column) → maps to status.
- `Decision` (optional; wins over Probability when both present and Decision is terminal).
- `Follow Up Notes` (optional) → free text → one or more `TenderClientNote`.

For every row, extract the legacy `T####` from the `Project Name` cell (regex
`/T\d{3,5}/` — accept 3–5 digits). If missing, `badRows.push({row, reason: "no T-number in Project Name"})`
and skip.

### 4. Service behaviour — dry-run

Do everything in-memory:

- Compute distinct normalised Client names → count new vs existing.
- For each row, build the target Tender payload (title, status, wonAt/lostAt, estimator match,
  numeric/date fields).
- Compute `unmatchedEstimators` (distinct raw names that did not match any `User`).
- Push a `badRows` entry for each parse failure (bad Decimal, bad Date, missing required col).
- Write NOTHING to the database. Return the report.

### 5. Service behaviour — commit

Idempotent. Iterate rows; for each row, perform these steps inside a single Prisma transaction
(one transaction per row keeps blast radius small if a single row fails):

1. **Client:** `upsert` on `name` (write the FIRST-seen raw name; use the normalised name only
   as the dedupe/equality key — do NOT overwrite an existing Client's name).
2. **Stub Site:** `create` a new Site with `name = "T#### — <Project Name>"`, `clientId` = the
   upserted client, all address fields NULL, `notes = "IMPORTED — address to be completed"`.
   On re-runs, look up an existing stub site by (client + name) and reuse; do NOT create a
   duplicate. (This is safe now that MIG-1 has dropped `Site @@unique([name])`.)
3. **Tender:** locate an existing Tender whose `title` contains the same `T####` substring.
   - If found → `update` the mapped fields (status/wonAt/lostAt/estimator/numeric/dates) and
     leave `tenderNumber` unchanged.
   - If not found → `create`. Generate a synthetic canonical `tenderNumber` from the T-number
     (e.g. `IMPORT-T####-<row>` — must be unique across the workbook; if the ERP has a
     canonical generator, use it, but do NOT invent Sites/Clients through it).
   - `title = "T#### — <Project Name>"` (D3).
   - `status` per D2:
     - `Won` (case-insensitive) → `"WON"`, set `wonAt = submittedAt ?? now()`.
     - `Lost` → `"LOST"`, set `lostAt = submittedAt ?? now()`.
     - `Not quoting` → `"WITHDRAWN"`.
     - `Submitted` → `"SUBMITTED"`.
     - `Quoting` / `Chasing` / `Hot` / `Warm` / `Cold` → `"DRAFT"`.
     - `Decision` overrides when it is a terminal `Won` / `Lost`.
     - Anything else → `"DRAFT"` + push a `badRows` warning (not a hard error).
   - `estimatorUserId` per D6: best-effort match against `User` by normalised full name.
     Marco's known names: `Sean Lattin`, `Raj Pudasaini`, `Marco Mantovanini` (tracker
     misspells `Mantovaninni` — normalise via a small alias map), `Russel Cummings`. Unmatched
     → `null` + add to `unmatchedEstimators`.
   - `siteId` = the stub site's id.
   - `estimatedValue` = parsed Decimal or null.
   - `leadTimeDays` = parsed Int or null.
   - `dueDate` = parsed Date or null.
   - `submittedAt` = parsed Date or null.
4. **TenderClient:** upsert on (`tenderId`, `clientId`) linking tender to client.
5. **Follow-up notes (D5):** for each non-empty `Follow Up Notes` cell, create one
   `TenderClientNote` (`noteType = "note"`, `body = <cell>`, `tenderId`, `clientId`,
   `occurredAt = submittedAt ?? createdAt`, `createdBy` = the current super-user's id). On
   re-run, skip if an equivalent note already exists (match on (`tenderId`, `clientId`,
   `body`, `occurredAt`)). Splitting a multi-line cell into multiple notes vs. keeping it as
   one blob is your call — pick whichever the real data at hand supports and note it in the
   PR body.

### 6. Unit tests — `tender-tracker-import.service.spec.ts`

Cover, using synthetic fixtures only (D9):

- Dry-run: happy path counts (rows, clients, tenders, notes) with no DB writes (mock Prisma).
- Dry-run: unmatched estimators are surfaced.
- Dry-run: bad rows (missing Project Name, bad Decimal, missing T-number) are surfaced.
- Commit: status mapping — one row per branch of D2 (`Won`, `Lost`, `Not quoting`,
  `Submitted`, `Quoting`, unknown → `DRAFT`).
- Commit: `Decision = Won` overrides `Probability = Cold`.
- Commit: client dedupe on normalised name (two rows with `Acme` and `  ACME  ` produce ONE
  Client).
- Commit: T-number match — re-running the same row updates rather than duplicates the Tender.
- Commit: estimator name misspelling `Mantovaninni` matches the User `Marco Mantovanini` via
  the alias map.
- Commit: unmatched estimator → `estimatorUserId: null` (does NOT create a User).
- Commit: stub Site is created with NULL address fields and the imported-flag `notes` string.

### 7. Wiring

- Register `AdminImportsModule` in `apps/api/src/app.module.ts`.
- Follow the exact same import ordering / grouping as the sibling admin modules.

## Do NOT

- Do NOT add fields to `Tender`, `Client`, `Site`, or `TenderClientNote`. Reuse only.
- Do NOT change `schema.prisma` in this slice — MIG-1 did the only schema change needed.
- Do NOT create Users for unmatched estimators (D6).
- Do NOT commit any row from the real tracker workbook (D9). Fixtures are synthetic only.
- Do NOT touch Azure/Entra/SharePoint config — MIG-3 handles folder copy through the
  existing Graph seam and is a separate slice.
- Do NOT auto-create CRM `Account` rows here — that is CRM-1's responsibility (call-out in
  the plan under "Cross-dependencies").
- Do NOT invent a new super-user permission — reuse whatever `admin-users.controller.ts`
  uses.
- Do NOT add a new xlsx/csv dependency in this slice; use what is already in `package.json`.
- Do NOT touch `/sot/`, seed data, or any file outside declared scope.
- Do NOT use `requires_merged` — this slice already chains via `requires_file_on_main`.
