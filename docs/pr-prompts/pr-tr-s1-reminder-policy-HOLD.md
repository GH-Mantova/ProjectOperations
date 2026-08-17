---
premise: '! test -f apps/api/src/modules/tendering/reminder-policy.service.ts'
premise_means: No TenderReminderPolicy config table or reminder-log model exists yet — admin-configurable reminder timings and idempotency log have not been built.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/tendering/reminder-policy.service.ts
  - apps/api/src/modules/tendering/reminder-policy.controller.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/web/src/pages/tendering-page-helpers.ts
  - apps/api/prisma/seed.ts
  - apps/api/src/modules/tendering/__tests__/reminder-policy.service.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/tendering/reminder-policy.service.ts && grep -q "TenderReminderPolicy" apps/api/prisma/schema.prisma && test -f docs/data-model/relationship-map.json && node scripts/data-model/build-relationship-map.mjs --check
size: 9
gate_allow: migrations
seed_only: false
escalates: false
backfill: false
rollback_strategy: Both new models are purely additive (CREATE TABLE only, no existing rows modified, all columns have defaults). Safe to leave on main if the run is capped before the code lands. To revert, remove TenderReminderPolicy and TenderReminderLog from schema.prisma and drop the corresponding migration — no UPDATE ... SET, no NOT NULL backfill on existing rows.
requires_file_on_main: docs/plans/tender-reminders-plan.md
---

# TR-1: Reminder policy/config + reminder-log (schema, CRUD, idempotency)

**Binding plan:** `docs/plans/tender-reminders-plan.md` (read sections 2, 3, and 4 in full before
starting). This is the first slice of the tender reminders cluster.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- `apps/web/src/pages/tendering-page-helpers.ts` contains `stageIdleThresholds` — a hardcoded
  `Record<TenderingStage, { watch: number; rotting: number }>` object. TR-1 moves these into the
  DB-backed `TenderReminderPolicy` and updates the helper to read from the policy. Keep the SAME
  values as seeded defaults so there is no behaviour change until an admin edits the policy.
- `apps/api/src/modules/tendering/tender-entries.service.ts` — `TenderEntry` types
  `follow_up`/`self_reminder`/`task` already require a due date. Do not touch this service.
- `apps/api/src/modules/platform/notifications.service.ts` — delivery seam. Do not touch it here.
- `apps/api/src/modules/contracts/claim-draft-reminder.service.ts` — the cron pattern TR-2 will
  mirror. Do not touch it here.
- The deprecated `TenderFollowUp` endpoint must NOT be extended.

## What to build

### 1. Add two models to `apps/api/prisma/schema.prisma`

**`model TenderReminderPolicy`** — singleton config row (only one row per installation):

```prisma
model TenderReminderPolicy {
  id                      String   @id @default(cuid())
  daysBefore              Int      @default(7)   @map("days_before")
  dueDayOf                Boolean  @default(true) @map("due_day_of")
  postSubmissionChaseDays Int      @default(14)  @map("post_submission_chase_days")
  postSubmissionCadenceDays Int    @default(14)  @map("post_submission_cadence_days")
  watchIdleThresholds     Json     @map("watch_idle_thresholds")
  rottingIdleThresholds   Json     @map("rotting_idle_thresholds")
  escalationWindowDays    Int      @default(3)   @map("escalation_window_days")
  updatedAt               DateTime @updatedAt    @map("updated_at")
  updatedById             String?  @map("updated_by_id")
  updatedBy               User?    @relation(fields: [updatedById], references: [id], onDelete: SetNull)
  @@map("tender_reminder_policy")
}
```

Default JSON for `watchIdleThresholds` (seed these values — same as current hardcoded):
```json
{ "DRAFT": 3, "IN_PROGRESS": 4, "SUBMITTED": 2, "AWARDED": 3, "CONTRACT_ISSUED": 5, "CONVERTED": 999 }
```

Default JSON for `rottingIdleThresholds`:
```json
{ "DRAFT": 7, "IN_PROGRESS": 8, "SUBMITTED": 5, "AWARDED": 6, "CONTRACT_ISSUED": 10, "CONVERTED": 999 }
```

**`model TenderReminderLog`** — idempotency log for cron:

```prisma
model TenderReminderLog {
  id         String   @id @default(cuid())
  tenderId   String   @map("tender_id")
  triggerKey String   @map("trigger_key")
  firedAt    DateTime @default(now()) @map("fired_at")
  tender     Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  @@unique([tenderId, triggerKey])
  @@index([tenderId])
  @@map("tender_reminder_log")
}
```

`triggerKey` examples: `"pre_due_7"`, `"pre_due_0"`, `"post_sub_14"`, `"post_sub_28"`, `"escalation_1"`.
The `@@unique([tenderId, triggerKey])` constraint is the race-guard — the cron upserts by this key.

Add back-relations to existing models:
- `model Tender`: `reminderLogs  TenderReminderLog[]`
- `model User`: `reminderPolicyUpdates  TenderReminderPolicy[]`

### 2. Generate and review the migration

```
npx prisma migrate dev --name tr1_reminder_policy_and_log --create-only
```

Review the generated SQL — it must:
- `CREATE TABLE tender_reminder_policy ...` (all columns with defaults)
- `CREATE TABLE tender_reminder_log ...` (with the unique constraint on `[tender_id, trigger_key]`)
- No `ALTER TABLE` on existing tables beyond adding back-relation columns if Prisma requires them.

Commit the migration file.

### 3. Regenerate the data-model map

```
node scripts/data-model/build-relationship-map.mjs
```

Commit the regenerated `docs/data-model/relationship-map.json`, `relationship-map.md`, and
`metadata-catalog.json`.

### 4. `apps/api/src/modules/tendering/reminder-policy.service.ts` (new)

An `@Injectable()` service that:

- `getPolicy(): Promise<TenderReminderPolicy>` — finds the single policy row; if none exists,
  upserts a default row using the seeded defaults above and returns it.
- `updatePolicy(dto: UpdateReminderPolicyDto, actorId: string): Promise<TenderReminderPolicy>` —
  validates the DTO (all numeric fields must be positive integers; JSON threshold objects must have
  all six `TenderingStage` keys), updates the row, writes an audit entry via `AuditService`.
- Export the service as the primary artifact — TR-2 imports and calls `getPolicy()`.

### 5. `apps/api/src/modules/tendering/reminder-policy.controller.ts` (new)

NestJS controller, base route `/tendering/reminder-policy`, guarded by `JwtAuthGuard` +
`PermissionsGuard` + `@RequirePermissions("tenders.manage")` (super-user/admin only — do not create
a new permission, reuse the existing manage permission):

- `GET /tendering/reminder-policy` — returns the current policy (creates default if absent).
- `PUT /tendering/reminder-policy` — updates the policy.

### 6. Update `apps/api/src/modules/tendering/tendering.module.ts`

Register `ReminderPolicyService` and `ReminderPolicyController` as providers/controllers in
`tendering.module.ts`. Check the existing module for the correct import pattern.

### 7. Seed the default policy row

In `apps/api/prisma/seed.ts` (or the appropriate seeder file — grep for the seed entry point):
Add an upsert for the singleton `TenderReminderPolicy` row with the default values listed above.
Use `upsert` with `where: { id: "trp-default" }` (fixed ID) so re-seeding is idempotent.

### 8. Update `apps/web/src/pages/tendering-page-helpers.ts`

The `stageIdleThresholds` constant is currently hardcoded. Add an optional parameter to
`getTenderingAttentionSummary` to accept external thresholds:

```typescript
export function getTenderingAttentionSummary(
  input: TenderingAttentionInput,
  now = new Date(),
  idleThresholds?: Partial<Record<TenderingStage, { watch: number; rotting: number }>>
): TenderingAttentionSummary {
  const thresholds = { ...stageIdleThresholds, ...idleThresholds };
  // ... rest of function unchanged
}
```

Keep `stageIdleThresholds` as the fallback default — no behaviour change unless a caller passes
overrides. The web page that calls this will eventually fetch the policy and pass the thresholds
(TR-4's job), but for TR-1 the signature change alone is sufficient.

### 9. Unit test — `apps/api/src/modules/tendering/__tests__/reminder-policy.service.spec.ts` (new)

Mirror the mock-Prisma pattern in `tender-entries.service.spec.ts` or `tendering.service.spec.ts`.
Key assertions:
- `getPolicy()` returns the existing row when one exists.
- `getPolicy()` creates and returns a default row when none exists.
- `updatePolicy()` calls `prisma.tenderReminderPolicy.update` and writes an audit entry.

## Do NOT

- Do NOT build the cron job or any notification dispatch — that is TR-2.
- Do NOT build the UI worklist — that is TR-4.
- Do NOT extend the deprecated `TenderFollowUp` endpoint.
- Do NOT create a new permission — reuse `tenders.manage`.
- Do NOT touch Azure / Entra / SharePoint.
- Do NOT edit `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if `reminder-policy.service.ts` already exists on main, say
  `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
- Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated map in the
  same PR — the CI data-model drift check hard-fails a schema change with a stale map.

GATE-ALLOW: migrations
