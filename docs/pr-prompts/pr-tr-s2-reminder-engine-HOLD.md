---
premise: '! test -f apps/api/src/modules/crm/reminders/comms-reminder.service.ts'
premise_means: No scheduled CRM reminder cron exists — the engine that scans for overdue CommTask rows, approaching quote due dates, and long-idle post-submission tenders has not been built (TR_SCOPE_CRM re-scope 2026-09-01).
scope:
  - apps/api/src/modules/crm/reminders/comms-reminder.service.ts
  - apps/api/src/modules/crm/reminders/reminders.module.ts
  - apps/api/src/modules/crm/reminders/__tests__/comms-reminder.service.spec.ts
  - apps/api/src/modules/crm/reminders/comms-reminder.types.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/crm/reminders/comms-reminder.service.ts && grep -q "scanAndNotify" apps/api/src/modules/crm/reminders/comms-reminder.service.ts
size: 4
gate_allow: none
seed_only: false
escalates: false
requires_on_main: apps/api/src/modules/crm/reminders/reminder-policy.service.ts
---

<!-- re-scoped 2026-09-01: TR_SCOPE_CRM — CRM surface, not Tendering. See docs/plans/tender-reminders-plan.md §0. -->

# TR-2: Scheduled reminder engine (cron) — **CRM surface, scans CommTask + Tender**

**Binding plan:** `docs/plans/tender-reminders-plan.md` — read **§0 `TR_SCOPE_CRM`** first
(re-scope from Tendering to CRM), then §2 and §4. This is the second slice of the CRM reminders
cluster.

**Gate:** TR-1 (reminder policy + polymorphic log schema in the CRM sub-module) must be on main.
Verify that `apps/api/src/modules/crm/reminders/reminder-policy.service.ts` exists before starting.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- TR-1 added: `TenderReminderPolicy` (singleton config), `TenderReminderLog` (polymorphic
  idempotency log with `@@unique([subjectType, subjectId, triggerKey])`), and
  `ReminderPolicyService.getPolicy()` under `apps/api/src/modules/crm/reminders/`.
- **CRM-S7/S8 shipped:** `CommThread` (`entityType`, `entityId`, `kind`) and
  `CommTask` (`entityType`, `entityId`, `dueAt`, `status`, `assigneeId`) are the interaction and
  next-action stores. `comms.service.logContact({ nextActionAt, nextActionNote })` is the write
  seam used by the Register+Follow-ups tab. Do NOT create a new next-action store.
- `apps/api/src/modules/contracts/claim-draft-reminder.service.ts` — **mirror this pattern exactly**:
  `@Cron(...)` wraps a try/catch, testable core extracted as a date-injected method.
- `apps/api/src/modules/contracts/public-holidays.ts` — exports `adjustToPrecedingWorkday(date)`;
  import and reuse for business-day awareness.
- `NotificationsService.create({ userId, title, body, severity, linkUrl? })` — the delivery seam.
  Import from `PlatformModule` (already imported in `crm.module.ts`).
- `Tender.dueDate` (quote due) — PRE-DUE track anchor.
- `Tender.submittedAt` — POST-SUBMISSION track anchor.
- `Tender.estimatorUserId` — default notification target for tender-level tracks when the
  linked `CommTask` has no explicit `assigneeId`.
- Do NOT scan `TenderEntry` `follow_up` / `self_reminder` — that store is not what CRM-S8
  reads. Scan `CommTask` instead.

## What to build

### 1. `apps/api/src/modules/crm/reminders/comms-reminder.service.ts` (new)

An `@Injectable()` service mirroring `ClaimDraftReminderService`:

**Cron schedule:**
```typescript
@Cron("0 21 * * *", { name: "crm-comms-reminders", timeZone: "UTC" })
async runCommsReminders() {
  try {
    await this.scanAndNotify(new Date());
  } catch (err) {
    this.logger.warn(`crm-comms-reminders failed: ${(err as Error).message}`);
  }
}
```

`0 21 * * *` = 9pm UTC = 7am AEST (UTC+10). Use `timeZone: "UTC"` per house convention.

**Core method — `async scanAndNotify(today: Date)`:**

Inject: `PrismaService`, `ReminderPolicyService`, `NotificationsService`.

All three tracks write into the shared polymorphic `TenderReminderLog` via
`{ subjectType, subjectId, triggerKey }` upserts.

```
1. const policy = await this.policyService.getPolicy();

2. PRE-DUE TRACK — scan tenders with an approaching or past quote dueDate:
   - Find tenders WHERE stage NOT IN ['AWARDED', 'CONTRACT_ISSUED', 'CONVERTED', 'SUBMITTED']
     AND dueDate is set AND estimatorUserId is set
   - For each, compute businessDaysUntilDue using UTC date arithmetic + adjustToPrecedingWorkday
   - Trigger keys to check:
     - "pre_due_N" where N = policy.daysBefore (e.g. "pre_due_7") when daysUntilDue <= policy.daysBefore
     - "pre_due_0" when dueDate <= today (overdue — quote submission may be late)
   - For each applicable trigger key NOT already in TenderReminderLog for
     { subjectType: "Tender", subjectId: tender.id, triggerKey }:
     * Create notification via NotificationsService.create({ userId: tender.estimatorUserId, ... })
     * Upsert TenderReminderLog { subjectType: "Tender", subjectId: tender.id, triggerKey, firedAt: today }

3. POST-SUBMISSION TRACK — scan submitted tenders that have not been chased recently:
   - Find tenders WHERE stage = 'SUBMITTED' AND submittedAt is set
     AND NOT EXISTS (outcome recorded — check the existing outcome relation on Tender)
     AND NOT EXISTS (a CommThread with kind='logged_contact' entityType='Tender' entityId=tender.id
                     createdAt > submittedAt within policy.postSubmissionCadenceDays days of today)
     — the second condition means: if a user has already logged an interaction in the current
     cadence window, do NOT chase again; the human is on it.
   - For each, compute daysSinceSubmitted = diff in days (submittedAt, today)
   - Trigger keys:
     - "post_sub_N" where N = Math.floor(daysSinceSubmitted / policy.postSubmissionCadenceDays) * policy.postSubmissionCadenceDays
       Only fire when daysSinceSubmitted >= policy.postSubmissionChaseDays
   - Same upsert-to-log + notification pattern as PRE-DUE track (subjectType: "Tender")

4. TASK TRACK — scan overdue open CommTask rows (replaces the historical TenderEntry follow-up scan):
   - Find CommTask rows WHERE status = 'OPEN' AND dueAt is set
     AND dueAt <= addDays(today, policy.daysBefore)
   - Trigger key: "task_due" (one row per CommTask, keyed by CommTask.id in the polymorphic log,
     so any given task fires exactly one due-reminder for its lifetime)
   - Notify assigneeId if set; if null, fall back to the tender's estimatorUserId
     (only for entityType='Tender'/'Opportunity' — if neither resolves a user, log a warning and
     skip without error).
   - Upsert TenderReminderLog { subjectType: "CommTask", subjectId: task.id,
     triggerKey: "task_due", firedAt: today }

5. DIGEST — where multiple trigger events target the same userId in the same run,
   group into a single notification listing the affected tenders/tasks rather than
   firing one notification per item. A simple in-memory grouping per userId before
   the notification loop is sufficient.
```

Business-day awareness: call `adjustToPrecedingWorkday` when computing daysUntilDue for
weekend/holiday boundary cases (same pattern as the contracts cron).

### 2. `apps/api/src/modules/crm/reminders/reminders.module.ts` (update) + `crm.module.ts`

Register `CommsReminderService` in the `RemindersModule` created in TR-1. Ensure
`@nestjs/schedule`'s `ScheduleModule` is imported (check whether it is already imported at the
app module level — if so, no change needed here; if not, add `ScheduleModule.forFeature()`
following the contracts module pattern). Do NOT edit `tendering.module.ts`.

### 3. Optional type file — `apps/api/src/modules/crm/reminders/comms-reminder.types.ts`

If the service needs shared types (e.g. `ReminderTrackResult`, `DigestGroup`), put them here.
Keep this file lean — only add it if it keeps the service file under ~150 lines.

### 4. Unit tests — `apps/api/src/modules/crm/reminders/__tests__/comms-reminder.service.spec.ts` (new)

Mirror `claim-draft-reminder.service.spec.ts` pattern (mock Prisma, inject test date). Key assertions:

- A tender with `dueDate` 5 days from `today` and `policy.daysBefore = 7` gets a `"pre_due_7"`
  notification; a tender with `dueDate` 10 days away does NOT.
- An existing `TenderReminderLog` row for `{ subjectType: "Tender", subjectId, "pre_due_7" }`
  prevents a second notification for the same trigger key.
- A submitted tender with `submittedAt` 20 days ago, no `logged_contact` thread since submission,
  `policy.postSubmissionChaseDays = 14`, `policy.postSubmissionCadenceDays = 14` gets a
  `"post_sub_14"` notification.
- A submitted tender with a `logged_contact` `CommThread` created 3 days ago is NOT chased
  (a user has already actioned it inside the cadence window).
- An overdue `CommTask` with `assigneeId` set fires `"task_due"` to that assignee.
- An overdue `CommTask` with no `assigneeId` on a Tender entity falls back to
  `Tender.estimatorUserId`; on an entity type that cannot resolve a user, the task is skipped
  with a warning and no throw.
- Multiple triggers for the same user in one scan produce a single digest notification, not multiple.

## Do NOT

- Do NOT build the escalation logic — that is TR-3.
- Do NOT build any UI — CRM-S8's Follow-ups tab is the worklist; TR-4 is retired.
- Do NOT email clients — notify internal staff (assignee / estimator) only.
- Do NOT build a parallel notification channel — reuse `NotificationsService.create()`.
- Do NOT re-fire a reminder that already has a `TenderReminderLog` row — the unique constraint
  on `[subjectType, subjectId, triggerKey]` is the guard.
- Do NOT scan `TenderEntry` — scan `CommTask`.
- Do NOT put the service under `apps/api/src/modules/tendering/`.
- Do NOT extend the deprecated `TenderFollowUp` endpoint.
- Do NOT touch Azure / Entra / SharePoint or `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if
  `apps/api/src/modules/crm/reminders/comms-reminder.service.ts` already exists on main,
  say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
- Before starting, verify `apps/api/src/modules/crm/reminders/reminder-policy.service.ts`
  exists on main (`test -f` it).
