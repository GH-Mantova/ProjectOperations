---
premise: '! test -f apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts'
premise_means: A local Schedule of Rates edit still cannot be pushed back to the master hub - there is no push-back service, no preview endpoint, and no permission for it.
scope:
  - apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts
  - apps/api/src/modules/schedule-of-rates/sor-push-back.controller.ts
  - apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts
  - apps/api/src/modules/schedule-of-rates/schedule-of-rates.module.ts
  - apps/api/src/common/permissions/permission-registry.ts
  - apps/api/src/modules/schedule-of-rates/__tests__/sor-push-back.service.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts && grep -q '"rates.push-back"' apps/api/src/common/permissions/permission-registry.ts && grep -q "sor.rate.push-back" apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts
size: 6
gate_allow: none
seed_only: false
escalates: true
module: schedule-of-rates
cluster: ratehub-s6
cluster_order: 1
design_ref: https://claude.ai/code/artifact/2d70131e-79f9-4a92-a3d7-3df058e4ec99
---

# Rate Hub S6a - guarded push-back, API: preview + push, hub row id preserved

**Slice 1 of 2.** Marco split S6 at the API/web seam on 2026-09-11, the same seam as S9. This slice
is the service, the two endpoints, the permission and the spec that proves the frozen guarantee.
**S6b** is the Schedule of Rates page: the button, the drift lines and the dialogs. The mock-up in
`design_ref` is the standard for both; this slice implements what the dialog *shows*, so read its
states 2, 3 and 4 and its grounding panel before writing a line.

**Binding plan:** `docs/plans/rate-hub-sor-integration-plan.md`, Locked Decision 8 - *"Push (local
edit back to master) is permission-gated, change-logged, shows impact preview of affected UNLOCKED
tenders before confirm; locked snapshots NEVER move. Optional role split."* Every clause holds. What
this rewrite fixes is **how** "locked snapshots never move" is achieved, because the obvious
implementation breaks it - see "The one thing that must not happen" below.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the six files in `scope`. That is a scope limit,
**not** a reason to stop before pushing.

## Guardrails

- One attempt. If `sor-push-back.service.ts` already exists on main, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must both pass, and the new spec must be green, before you open the PR.
- `escalates: true` gates the MERGE, not the RUN. Open the PR; Marco removes `do-not-merge`. Raised
  because this slice adds a write path into the master hub and a high-risk permission.

## Grounded on main (read these first - cite line numbers in the PR body; take shapes from code, not from here)

- **"Unlocked" means no `TenderRateSet` row.** `TenderRateSet.lockedAt` is `DateTime @default(now())`,
  never null (`schema.prisma` ~6048); `TenderRateEntry.tenderRateSetId` is a required FK; `unlock()`
  deletes the set row (`tender-rate-set.service.ts` ~152). There is no `lockedAt IS NULL` branch to
  write. A tender either has a set (locked) or has none (will lock later).
- **A locked tender is held by copied values, addressed by a composite key.** Locking enumerates every
  `isActive: true` row of every non-reference `RateTable` and writes one `TenderRateEntry` per VALUE
  cell keyed `${table.id}:${row.id}:${col.id}` with the value copied into `originalValue`
  (`rate-resolver.service.ts` ~428-468, key at ~455). On read, `trySnapshot` re-derives that key from
  the **live** table over `rateRow.findMany({ isActive: true })` (~350-351) and, on a miss, logs
  `snapshot-miss-fell-back-to-live` and returns the live value (~296-305). `tryListRateTable` filters
  `isActive: true` the same way (~692).
- **`RateRow` is not append-only.** `RateTablesService.updateRow` mutates `cells` in place
  (`rate-tables.service.ts` ~271-285). The append-only supersede rule is a schema comment on
  **`SubcontractorRate`** (`schema.prisma` ~4897-4899) and applies only there.
- **A push carries three figures, not one.** `SorRate.ordinary / oneAndHalf / double` are nullable
  `Decimal(12,2)` (~7585-7587). The internal target has no rate column: `RateRow.cells` is JSON keyed
  by `RateColumn.id`. The vendor target has exactly one: `SubcontractorRate.rate`, `Decimal(10,2)`
  (~4909).
- **The column map already exists.** `SorSourceMarkupService.promoteToHub` fills hub cells by
  matching `RateColumn.name` case-insensitively: `rate` / `day rate` / `rate per tonne` <- ordinary,
  `night rate` <- oneAndHalf, `weekend rate` <- double (`sor-source-markup.service.ts` ~240-264).
  Push-back is that map run backwards. Audit actions in this module are dot-kebab:
  `sor.rate.link-internal`, `sor.rate.link-vendor`, `sor.rate.promote-to-hub` (~131, ~184, ~279).
- **`SorPeriod.status` is a plain string**, `"ACTIVE"` / `"EXPIRED"` only (~7560). There is no
  `"LOCKED"` status anywhere in the module.
- **`SorRateSourceType`** is `INTERNAL | SUBBIE | SUPPLIER | MANUAL` (~7546-7551). `sourceRateRowId`
  is set only for INTERNAL, `sourceSubRateId` only for SUBBIE/SUPPLIER, both `onDelete: SetNull`.
- **Permissions live in `apps/api/src/common/permissions/permission-registry.ts`** - an `as const`
  array of `{ code, module, label, description, isHighRisk? }` upserted by `seed-reference.ts` and
  re-synced by `permissions.service.ts` on startup. `rates.manage` is ~96 (not high-risk);
  `subcontractors.rates.manage` is ~158. `apps/api/src/common/auth/permissions.ts` **does not exist**
  - the previous version of this prompt named it; do not create it.
- **`SorChangeLogEntry`** is `{ periodId, rateId?, field, oldValue?, newValue?, changedById? }`
  (~7619-7632). **`JobSorSnapshotRate`** copies `ordinary / oneAndHalf / double` as its own columns and
  its `sourceRateId` is a provenance pointer, `onDelete: SetNull` (~7731-7752).
- **Terminal tender statuses** are already defined once: `TERMINAL_STATUSES` in
  `apps/api/src/modules/tendering/capacity.service.ts` ~10 (`AWARDED, CONTRACT_ISSUED, CONVERTED,
  LOST, WITHDRAWN`). That const is **not exported** and its file is out of scope, so declare the same
  five statuses locally with a comment citing that line; do not invent a different list.
- Controllers in this module: `@Controller("schedule-of-rates")` with `JwtAuthGuard` +
  `PermissionsGuard` and `@RequirePermissions(...)` per route (`sor-source-markup.controller.ts`
  ~57-132 is the closest sibling). Specs mock Prisma with plain `jest.fn()` objects
  (`__tests__/sor-source-markup.service.spec.ts` ~1-35) - copy that pattern.

## The one thing that must not happen

The earlier version of this prompt specified the INTERNAL push as an append-only supersede:
deactivate the old `RateRow`, create a new one. **Do not do that.** After a supersede, every
`TenderRateEntry.key` naming the old row id no longer matches anything the live resolver derives
(the derivation filters `isActive: true`), the snapshot lookup misses, and the resolver falls back to
the **live, just-pushed** value for every tender that had locked. Nothing is written to
`TenderRateSet`, and every locked tender moves anyway. The guarantee rests on **`RateRow.id`
surviving the push**. The internal write is therefore an in-place `cells` update on the same row,
exactly as `updateRow` already does.

## What to build

### 1. Permission - `permission-registry.ts`

Add one entry, next to `rates.manage`:

```ts
{ code: "rates.push-back", module: "rates", label: "Push a Schedule of Rates edit back to the master hub",
  description: "Update the master RateRow / SubcontractorRate from a SoR line - changes what every future tender locks", isHighRisk: true },
```

The seed and the startup sync pick it up from the array; do not edit the seed. Run
`apps/api/src/common/__tests__/permission-registry-coverage.guard.spec.ts` and
`apps/api/src/modules/permissions/__tests__/permissions.service.spec.ts` - both read the registry.

### 2. Shared column map - `sor-source-markup.service.ts`

Lift the three value-name mappings out of `promoteToHub` into one exported constant, e.g.
`SOR_FIGURE_COLUMN_NAMES = { ordinary: ["rate", "day rate", "rate per tonne"], oneAndHalf: ["night rate"], double: ["weekend rate"] }`,
and make `promoteToHub` read from it. **No behaviour change** to promotion - the existing spec must
still pass untouched. This is the only edit to this file.

### 3. Service - `sor-push-back.service.ts` (`SorPushBackService`, inject `PrismaService`, `AuditService`)

**`getPreview(sorRateId, actorId)`** - read-only. Returns the shape the dialog draws:

- `line`: id, name, class, unit, category, periodId, periodStatus, sourceType, the three SoR figures.
- `target`: `{ model: "RateRow", rateTableId, rateTableSlug, rateRowId }` or
  `{ model: "SubcontractorRate", subRateId, vendorName, discipline, unit }`.
- `figures[]`: one per SoR figure `{ field, current, proposed, lands, hubColumnName?, cellsKey?, reason? }`.
  INTERNAL: `lands` is true when the target table has a column whose name matches the map for that
  field; `current` is the hub cell value. Vendor: only `ordinary` lands (into `rate`); `oneAndHalf`
  and `double` carry `lands: false, reason: "no such column on SubcontractorRate"`. A figure that is
  null on the SoR line does not land either.
- `landingCount` and `nothingToPush` (true when every landing figure already equals the hub).
- `futureLocks[]`: tenders with **no** `TenderRateSet` row and `status NOT IN TERMINAL_STATUSES` -
  `{ tenderId, tenderNumber, title, status, wouldLockToday, willLockAfter }` where the two values are
  the hub's current and proposed `ordinary`. Every such tender will copy this row at its first lock,
  because locking enumerates every active row of every non-reference table - so this list is "who
  picks the change up", not "who is disturbed". It is legitimately empty when no open tender is
  unlocked; return `[]`, not an error. Two cases return `[]` with a `futureLocksReason` string
  instead of a query: a **vendor** line (vendor rows are outside the keyspace a lock enumerates -
  tenders pick vendor rates up through their own subbie quotes, never through `TenderRateSet`), and
  an INTERNAL line whose target table is `isReference: true` (`enumerateRateSet` skips reference
  tables, so no tender ever locks that row).
- `frozen[]`: the proof table - records that already hold this rate and are untouched by the push:
  - `TenderRateEntry` rows whose `key` starts with `${rateTableId}:${rateRowId}:` (one row per
    tender, value = `overrideValue ?? originalValue`, `lockedAt` / `lockedBy` from the set,
    `mechanism: "TenderRateEntry"`);
  - `JobSorSnapshotRate` rows with `sourceRateId = sorRateId` (all three copied figures, the
    snapshot's job / record, `mechanism: "JobSorSnapshotRate"`);
  - `SorClientRateEntry` rows for this `rateId` (card name, value, `mechanism: "SorClientRateEntry"`).
  Vendor lines have no `TenderRateEntry` rows (vendor rows are outside the keyspace a lock
  enumerates); return the other two kinds.
- Refusals, thrown before any query that is not needed to decide them: `NotFoundException` (no such
  SoR line); `BadRequestException` when `sourceType === MANUAL` or the anchor id is null
  ("No hub anchor - promote the line first"); `ForbiddenException` when `period.status !== "ACTIVE"`
  (message names the period label and its status, as in mock-up state 4).

**`pushBack(sorRateId, actorId, expected)`** - `expected` is `{ ordinary, oneAndHalf, double }` as
shown in the preview the operator confirmed. Re-run the refusal checks. Compare `expected` to the SoR
line's current figures; on any difference throw `ConflictException("Line changed since the preview
was opened - reopen it")`. If `nothingToPush`, throw `ConflictException("Nothing to push - all
landing figures already equal the hub")`. Then, in **one `$transaction`**:

- **INTERNAL:** `rateRow.update({ where: { id: rateRowId }, data: { cells: <existing cells with the
  landing keys replaced>, updatedById: actorId } })`. Nothing else on the row changes - not `id`, not
  `isActive`, not `sortOrder`. **Never `rateRow.create` here.** Then one `SorChangeLogEntry` per
  landed figure with `field: "hub.ordinary" | "hub.oneAndHalf" | "hub.double"`, `oldValue` = hub
  value, `newValue` = pushed value, `rateId: sorRateId`, `changedById: actorId`. (The `hub.` prefix
  is deliberate: the SoR line itself did not change, so its own `ordinary` history must not gain an
  entry - the mock-up's log table shows bare field names; that is the one place this slice departs
  from it, and Marco has been told.)
- **SUBBIE / SUPPLIER:** follow the schema's supersede rule: create a new `SubcontractorRate` copying
  `subcontractorSupplierId, discipline, unit, validFrom, notes`, with `rate = ordinary`,
  `createdById: actorId`; set the old row `isActive: false` and `validTo: today`; repoint
  **every** `SorRate` whose `sourceSubRateId` is the old row (this period's line and any other
  period's) to the new row, so no line is left anchored to an inactive vendor row. One
  `SorChangeLogEntry` (`hub.ordinary`).
- Both branches: `audit.write({ action: "sor.rate.push-back", entityType: "SorRate", entityId:
  sorRateId, actorId, metadata: { targetModel, targetId (new vendor id where superseded), figures:
  { ordinary, oneAndHalf, double }, landed: [...fields], futureLockCount, frozenCount } })`. The
  action name and `entityType: "SorRate"` follow the module's existing convention (the mock-up's
  "Will be written" table shows `entityType RateRow`; the module convention wins, the metadata
  carries the target).
- **Never write to** `TenderRateSet`, `TenderRateEntry`, `SorClientRateEntry`, `JobSorSnapshot`,
  `JobSorSnapshotRate`. The spec asserts it.

Return `{ landed, futureLockCount, frozenCount, targetModel, targetId }` for the toast.

**`getHubFigures(periodId)`** - read-only, for S6b's at-rest drift lines. For every non-MANUAL line in
the period, the target's current figures keyed by `sorRateId`:
`{ [sorRateId]: { model, figures: { ordinary?, oneAndHalf?, double? }, missing: [fields with no column] } }`.
One query per target model, not one per line.

### 4. Controller - `sor-push-back.controller.ts`

`@Controller("schedule-of-rates")`, `JwtAuthGuard` + `PermissionsGuard`, matching the siblings:

- `GET  rates/:id/push-back/preview` -> `getPreview` - `@RequirePermissions("rates.push-back")`
- `POST rates/:id/push-back` body `{ ordinary, oneAndHalf, double }` (class-validator, each optional
  number) -> `pushBack` - `@RequirePermissions("rates.push-back")`
- `GET  periods/:periodId/push-back/hub-figures` -> `getHubFigures` - `@RequirePermissions("rates.manage")`
  (reading hub values is not a write; the drift lines must show to anyone who can see the page).

Register the controller and service in `schedule-of-rates.module.ts`.

### 5. Spec - `__tests__/sor-push-back.service.spec.ts`

Mock Prisma the way `sor-source-markup.service.spec.ts` does. At minimum:

1. **The frozen guarantee.** INTERNAL push calls `rateRow.update` with the **same** `id`, never
   `rateRow.create`, never touches `isActive`; and no method on `tenderRateSet`, `tenderRateEntry`,
   `sorClientRateEntry`, `jobSorSnapshot`, `jobSorSnapshotRate` is called at all.
2. Period `"EXPIRED"` -> `ForbiddenException`, and no write of any kind happened.
3. `sourceType MANUAL` -> `BadRequestException`.
4. `expected` differs from the live line -> `ConflictException`, no write.
5. All landing figures equal the hub -> `nothingToPush: true` in the preview; push -> `ConflictException`.
6. Vendor push: one `subcontractorRate.create`, old row `isActive: false`, every linked `SorRate`
   repointed, all inside the `$transaction` callback; only `ordinary` lands.
7. Preview `futureLocks` filters `tenderRateSet: null` and `status: { notIn: TERMINAL_STATUSES }`.

## Do NOT

- Do NOT supersede, deactivate or recreate a `RateRow`. The row id is the guarantee.
- Do NOT write to `TenderRateSet`, `TenderRateEntry`, `SorClientRateEntry`, `JobSorSnapshot` or
  `JobSorSnapshotRate`.
- Do NOT push a MANUAL line; do NOT push from a period whose status is not `"ACTIVE"`.
- Do NOT change `schema.prisma` - this slice has no schema change.
- Do NOT create `apps/api/src/common/auth/permissions.ts`.
- Do NOT touch the web app - that is S6b.
- Do NOT touch `/sot/`, Azure/Entra/SharePoint.

## VERIFY

```
pnpm build && pnpm lint
test -f apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts
grep -q '"rates.push-back"' apps/api/src/common/permissions/permission-registry.ts
grep -q "sor.rate.push-back" apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts
pnpm --filter @project-ops/api test -- schedule-of-rates permission
```

All must pass before you open the PR. Title it
`feat(schedule-of-rates): S6a - guarded push-back API (preview + push, hub row id preserved)`
and leave it UNMERGED.
