---
premise: '! test -f apps/api/src/modules/crm/reminders/reminder-policy.service.ts'
premise_means: No CRM ReminderPolicy config table or polymorphic reminder-log model exists yet — admin-configurable reminder timings and cron idempotency log have not been built on the CRM surface (TR_SCOPE_CRM re-scope 2026-09-01).
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/crm/reminders/reminder-policy.service.ts
  - apps/api/src/modules/crm/reminders/reminder-policy.controller.ts
  - apps/api/src/modules/crm/reminders/reminders.module.ts
  - apps/api/src/modules/crm/crm.module.ts
  - apps/api/prisma/seed.ts
  - apps/api/src/modules/crm/reminders/__tests__/reminder-policy.service.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/crm/reminders/reminder-policy.service.ts && grep -q "TenderReminderPolicy" apps/api/prisma/schema.prisma && test -f docs/data-model/relationship-map.json && node scripts/data-model/build-relationship-map.mjs --check
size: 9
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
requires_on_main: docs/plans/tender-reminders-plan.md :: TR_SCOPE_CRM
rollback_strategy: Both new models are purely additive (CREATE TABLE only, no existing rows modified, all columns have defaults). Safe to leave on main if the run is capped before the code lands. To revert, remove TenderReminderPolicy and TenderReminderLog from schema.prisma and drop the corresponding migration — no UPDATE ... SET, no NOT NULL backfill on existing rows.
---
<!-- gate dropped 2026-08-19: docs/plans/tender-reminders-plan.md landed on main; the gate was a no-op. -->
<!-- re-scoped 2026-09-01: TR_SCOPE_CRM — CRM surface, not Tendering. See docs/plans/tender-reminders-plan.md §0. -->
<!-- escalates false -> true, 2026-09-02, Marco's call (Station 00, 03:2xZ). This prompt carries
     gate_allow: migrations at size 9, and with escalates: false the watcher applies NO
     do-not-merge label, so nothing would have held its PR: arming it would have AUTO-MERGED a
     schema migration unattended. Every prompt armed to date has been docs- or web-only. The flag
     gates the MERGE, not the RUN (DOCTRINE §5b) — this prompt still runs and still opens its PR;
     the PR now waits for Marco. Additive: it adds a gate, removes none, and touches no data path. -->


# TR-1: Reminder policy/config + reminder-log (schema, CRUD, idempotency) — **CRM surface**

**Binding plan:** `docs/plans/tender-reminders-plan.md` — read **§0 `TR_SCOPE_CRM`** first
(it re-scopes the whole cluster from Tendering to CRM), then §2 and §4. This is the first slice
of the CRM reminders cluster.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- **CRM-S7 (on main, `b63af33e`) is the interaction log.** `CommThread` +
  `CommMessage` (kind `logged_contact`) is the store for tender/opportunity interactions;
  `CommTask` (`entityType`, `entityId`, `dueAt`, `status`, `assigneeId`) is where the next
  action lands. `RelationshipNote` (+ `InteractionChannel` enum) is the Account/Contact log.
- **CRM-S8 (on main, `3985d74f`) is the Register+Follow-ups UI.** `TendersRegisterPage.tsx`
  reads `Last interaction` / `Logged by` / `Next action` from `CommThread`/`CommMessage`/`CommTask`
  and renders the Follow-ups tab. `comms.service.logContact({ nextActionAt, nextActionNote })`
  atomically writes `CommThread` + `CommMessage` + optional `CommTask`.
- `apps/api/src/modules/crm/comms/` is the CRM comms sub-module. TR-1 adds a **sibling**
  sub-module `apps/api/src/modules/crm/reminders/`. Do NOT put reminder services inside `comms/`
  — they cron over `CommTask`, they do not create threads.
- `apps/api/src/modules/platform/notifications.service.ts` — delivery seam. Do not touch it here.
- `apps/api/src/modules/contracts/claim-draft-reminder.service.ts` — the cron pattern TR-2 will
  mirror. Do not touch it here.
- Do NOT extend the deprecated `TenderFollowUp` endpoint.
- Do NOT wire against `TenderEntry` `follow_up` / `self_reminder` rows — that store is not what
  the CRM Register+Follow-ups reads. Scan `CommTask`.

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

**`model TenderReminderLog`** — polymorphic idempotency log for cron (name kept to avoid a
migration-name churn; the store is not tender-only):

```prisma
model TenderReminderLog {
  id          String   @id @default(cuid())
  /// Polymorphic subject: "Tender" (PRE-DUE / POST-SUBMISSION tracks) or "CommTask"
  /// (FOLLOW-UP track). No hard FK — matches the CommThread/CommTask polymorphism
  /// pattern already in use in this schema.
  subjectType String   @map("subject_type")
  subjectId   String   @map("subject_id")
  triggerKey  String   @map("trigger_key")
  firedAt     DateTime @default(now()) @map("fired_at")
  @@unique([subjectType, subjectId, triggerKey])
  @@index([subjectType, subjectId])
  @@map("tender_reminder_log")
}
```

`triggerKey` examples: `"pre_due_7"`, `"pre_due_0"`, `"post_sub_14"`, `"post_sub_28"`,
`"task_due"`, `"esc_pre_due_7"`, `"esc_task_due"`. The
`@@unique([subjectType, subjectId, triggerKey])` constraint is the race-guard — the cron
upserts by this key.

Back-relations:
- `model User`: `reminderPolicyUpdates  TenderReminderPolicy[]`
- Do **not** add a `Tender.reminderLogs` back-relation — the log is polymorphic and no
  cascade behaviour is wanted. If cascade-on-tender-delete matters, delete the log row from
  the cron code, not via schema. (This is deliberate: `CommTask` rows are also subjects.)

### 2. Generate and review the migration

```
npx prisma migrate dev --name tr1_reminder_policy_and_log --create-only
```

Review the generated SQL — it must:
- `CREATE TABLE tender_reminder_policy ...` (all columns with defaults)
- `CREATE TABLE tender_reminder_log ...` with the unique constraint on
  `[subject_type, subject_id, trigger_key]`
- No `ALTER TABLE` on existing tables beyond adding back-relation columns if Prisma requires them.

Commit the migration file.

### 3. Regenerate the data-model map

```
node scripts/data-model/build-relationship-map.mjs
```

Commit the regenerated `docs/data-model/relationship-map.json`, `relationship-map.md`, and
`metadata-catalog.json`.

### 4. `apps/api/src/modules/crm/reminders/reminder-policy.service.ts` (new)

An `@Injectable()` service that:

- `getPolicy(): Promise<TenderReminderPolicy>` — finds the single policy row; if none exists,
  upserts a default row using the seeded defaults above and returns it.
- `updatePolicy(dto: UpdateReminderPolicyDto, actorId: string): Promise<TenderReminderPolicy>` —
  validates the DTO (all numeric fields must be positive integers; JSON threshold objects, if kept,
  must have all six `TenderingStage` keys), updates the row, writes an audit entry via
  `AuditService`.
- Export the service as the primary artifact — TR-2 imports and calls `getPolicy()`.

### 5. `apps/api/src/modules/crm/reminders/reminder-policy.controller.ts` (new)

NestJS controller, base route `/crm/admin/reminder-policy`, guarded by `JwtAuthGuard` +
`PermissionsGuard` + `@RequirePermissions(...)`. **Permission choice:** grep the permissions
registry (`apps/api/src/common/auth/permissions.registry.ts` or equivalent) for a CRM-admin key
first (`crm.admin`, `crm.manage`, etc.). If none exists, fall back to `tenders.manage` and record
the choice at the top of the controller file. Do NOT invent a new permission.

- `GET /crm/admin/reminder-policy` — returns the current policy (creates default if absent).
- `PUT /crm/admin/reminder-policy` — updates the policy.

### 6. `apps/api/src/modules/crm/reminders/reminders.module.ts` (new) + wire into `crm.module.ts`

Create `RemindersModule` under `apps/api/src/modules/crm/reminders/` alongside `crm/comms/`.
Register `ReminderPolicyService` and `ReminderPolicyController`. Import `RemindersModule` from
`crm.module.ts`. Do NOT add anything to `tendering.module.ts` — this cluster is CRM-side now.

### 7. Seed the default policy row

In `apps/api/prisma/seed.ts` (or the appropriate seeder file — grep for the seed entry point):
Add an upsert for the singleton `TenderReminderPolicy` row with the default values listed above.
Use `upsert` with `where: { id: "trp-default" }` (fixed ID) so re-seeding is idempotent.

### 8. `stageIdleThresholds` — DROPPED from this slice

The original TR-1 wired an `idleThresholds` parameter through
`getTenderingAttentionSummary()` in `apps/web/src/pages/tendering-page-helpers.ts`. That helper
serves the Tendering page's own attention state, which is a different surface from the CRM
Register+Follow-ups tab (S8). The CRM Follow-ups tab reads `nextActionAt` (`CommTask.dueAt`) and
does not read per-stage idle thresholds. Adding an unused parameter is dead code.

**Do NOT touch `apps/web/src/pages/tendering-page-helpers.ts` in this slice.** Keep
`watchIdleThresholds` / `rottingIdleThresholds` fields in the policy row (they carry the
current hardcoded values as seed data) so a later slice can wire them back in if the Tendering
page is brought into the reminder scope — but do not read them from anywhere yet.

### 9. Unit test — `apps/api/src/modules/crm/reminders/__tests__/reminder-policy.service.spec.ts` (new)

Mirror the mock-Prisma pattern used in `apps/api/src/modules/crm/comms/__tests__/*.spec.ts`
(look there for the CRM-side testing conventions before writing).
Key assertions:
- `getPolicy()` returns the existing row when one exists.
- `getPolicy()` creates and returns a default row when none exists.
- `updatePolicy()` calls `prisma.tenderReminderPolicy.update` and writes an audit entry.

## Do NOT

- Do NOT build the cron job or any notification dispatch — that is TR-2.
- Do NOT build any UI — the CRM-S8 Follow-ups tab already covers TR-4's original scope.
- Do NOT extend the deprecated `TenderFollowUp` endpoint.
- Do NOT wire against `TenderEntry` `follow_up` / `self_reminder` rows — scan `CommTask`.
- Do NOT put reminder services under `apps/api/src/modules/tendering/` — CRM surface only.
- Do NOT put reminder services under `apps/api/src/modules/crm/comms/` — reminders cron over
  tasks, they do not create threads. Use the new `apps/api/src/modules/crm/reminders/` sub-module.
- Do NOT invent a new permission — reuse an existing CRM-admin or `tenders.manage` key.
- Do NOT touch Azure / Entra / SharePoint.
- Do NOT edit `/sot/`.
- Do NOT edit `apps/web/src/pages/tendering-page-helpers.ts` (see step 8).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if
  `apps/api/src/modules/crm/reminders/reminder-policy.service.ts` already exists on main, say
  `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
- Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated map in the
  same PR — the CI data-model drift check hard-fails a schema change with a stale map.

GATE-ALLOW: migrations
