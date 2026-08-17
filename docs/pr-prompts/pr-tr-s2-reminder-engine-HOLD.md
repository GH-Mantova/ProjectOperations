---
premise: '! test -f apps/api/src/modules/tendering/tender-reminder.service.ts'
premise_means: No scheduled tender reminder cron exists — the engine that scans for approaching/overdue quote due dates and TenderEntry follow-up dates has not been built.
scope:
  - apps/api/src/modules/tendering/tender-reminder.service.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/api/src/modules/tendering/__tests__/tender-reminder.service.spec.ts
  - apps/api/src/modules/tendering/tender-reminder.types.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/tendering/tender-reminder.service.ts && grep -q "scanAndNotify" apps/api/src/modules/tendering/tender-reminder.service.ts
size: 4
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/api/src/modules/tendering/reminder-policy.service.ts
---

# TR-2: Scheduled reminder engine (cron)

**Binding plan:** `docs/plans/tender-reminders-plan.md` (read sections 2, 3, and 4 in full before
starting). This is the second slice of the tender reminders cluster.

**Gate:** TR-1 (reminder policy + log schema) must be on main. Verify that
`apps/api/src/modules/tendering/reminder-policy.service.ts` exists before starting.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- TR-1 added: `TenderReminderPolicy` (singleton config), `TenderReminderLog` (idempotency log with
  `@@unique([tenderId, triggerKey])`), and `ReminderPolicyService.getPolicy()`.
- `apps/api/src/modules/contracts/claim-draft-reminder.service.ts` — **mirror this pattern exactly**:
  `@Cron(...)` wraps a try/catch, testable core extracted as a date-injected method.
- `apps/api/src/modules/contracts/public-holidays.ts` — exports `adjustToPrecedingWorkday(date)`;
  import and reuse for business-day awareness.
- `NotificationsService.create({ userId, title, body, severity, linkUrl? })` — the delivery seam.
  Import from `PlatformModule` (already imported in `tendering.module.ts`).
- `TenderEntry` types `follow_up` / `self_reminder` require a `dueDate` — scan these for upcoming
  dates. Do not scan `task` entries (those already notify on assignment via `TenderEntriesService`).
- `Tender.dueDate` (quote due) — PRE-DUE track anchor.
- `Tender.submittedAt` — POST-SUBMISSION track anchor.
- `Tender.estimatorUserId` — primary notification target for both tracks.

## What to build

### 1. `apps/api/src/modules/tendering/tender-reminder.service.ts` (new)

An `@Injectable()` service mirroring `ClaimDraftReminderService`:

**Cron schedule:**
```typescript
@Cron("0 21 * * *", { name: "tender-reminders", timeZone: "UTC" })
async runTenderReminders() {
  try {
    await this.scanAndNotify(new Date());
  } catch (err) {
    this.logger.warn(`tender-reminders failed: ${(err as Error).message}`);
  }
}
```

`0 21 * * *` = 9pm UTC = 7am AEST (UTC+10). Use `timeZone: "UTC"` per house convention.

**Core method — `async scanAndNotify(today: Date)`:**

Inject: `PrismaService`, `ReminderPolicyService`, `NotificationsService`.

```
1. const policy = await this.policyService.getPolicy();

2. PRE-DUE TRACK — scan tenders with an approaching or past quote dueDate:
   - Find tenders WHERE stage NOT IN ['AWARDED', 'CONTRACT_ISSUED', 'CONVERTED', 'SUBMITTED']
     AND dueDate is set AND estimatorUserId is set
   - For each, compute businessDaysUntilDue using UTC date arithmetic + adjustToPrecedingWorkday
   - Trigger keys to check:
     - "pre_due_N" where N = policy.daysBefore (e.g. "pre_due_7") when daysUntilDue <= policy.daysBefore
     - "pre_due_0" when dueDate <= today (overdue — quote submission may be late)
   - For each applicable trigger key NOT already in TenderReminderLog for this tender:
     * Create notification via NotificationsService.create({ userId: tender.estimatorUserId, ... })
     * Upsert TenderReminderLog { tenderId, triggerKey, firedAt: today } (upsert to handle re-scan)

3. POST-SUBMISSION TRACK — scan submitted tenders with no outcome:
   - Find tenders WHERE stage = 'SUBMITTED' AND submittedAt is set
     AND NOT EXISTS (outcome recorded — check TenderEntry with type outcome or the outcomes relation)
   - For each, compute daysSinceSubmitted = diff in days (submittedAt, today)
   - Trigger keys:
     - "post_sub_N" where N = Math.floor(daysSinceSubmitted / policy.postSubmissionCadenceDays) * policy.postSubmissionCadenceDays
       Only fire when daysSinceSubmitted >= policy.postSubmissionChaseDays
   - Same upsert-to-log + notification pattern as PRE-DUE track

4. FOLLOW-UP TRACK — scan open TenderEntry rows of type follow_up / self_reminder:
   - Find TenderEntry rows WHERE type IN ['follow_up', 'self_reminder'] AND status = 'open'
     AND dueDate is set AND dueDate <= addDays(today, policy.daysBefore)
   - Trigger key: "followup_<entryId>_due" — unique per entry so re-scanning is safe
   - Notify the entry's assigneeId (if set) or the tender's estimatorUserId
   - Upsert log, skip if already logged

5. DIGEST — where multiple trigger events target the same userId in the same run,
   group into a single notification listing the affected tenders/entries rather than
   firing one notification per item. A simple in-memory grouping per userId before
   the notification loop is sufficient.
```

Business-day awareness: call `adjustToPrecedingWorkday` when computing daysUntilDue for
weekend/holiday boundary cases (same pattern as the contracts cron).

### 2. Update `apps/api/src/modules/tendering/tendering.module.ts`

Register `TenderReminderService` in `providers`. Ensure `@nestjs/schedule`'s `ScheduleModule` is
imported (check whether it is already imported at the app module level — if so, no change needed
here; if not, add `ScheduleModule.forFeature()` following the contracts module pattern).

### 3. Optional type file — `apps/api/src/modules/tendering/tender-reminder.types.ts`

If the service needs shared types (e.g. `ReminderTrackResult`), put them here. Keep this file lean
— only add it if it keeps the service file under ~150 lines.

### 4. Unit tests — `apps/api/src/modules/tendering/__tests__/tender-reminder.service.spec.ts` (new)

Mirror `claim-draft-reminder.service.spec.ts` pattern (mock Prisma, inject test date). Key assertions:

- A tender with `dueDate` 5 days from `today` and `policy.daysBefore = 7` gets a `"pre_due_7"`
  notification; a tender with `dueDate` 10 days away does NOT.
- A tender with an existing `TenderReminderLog` row for `"pre_due_7"` does NOT get a second
  notification for the same trigger key.
- A submitted tender with `submittedAt` 20 days ago, `policy.postSubmissionChaseDays = 14`,
  `policy.postSubmissionCadenceDays = 14` gets a `"post_sub_14"` notification.
- A tender with no `estimatorUserId` is skipped without error.
- Multiple triggers for the same user in one scan produce a single digest notification, not multiple.

## Do NOT

- Do NOT build the escalation logic — that is TR-3.
- Do NOT build any UI — that is TR-4.
- Do NOT email clients — notify internal staff (estimatorUserId) only.
- Do NOT build a parallel notification channel — reuse `NotificationsService.create()`.
- Do NOT re-fire a reminder that already has a `TenderReminderLog` row — the unique constraint is the guard.
- Do NOT extend the deprecated `TenderFollowUp` endpoint.
- Do NOT touch Azure / Entra / SharePoint or `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if `tender-reminder.service.ts` already exists on main, say
  `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
- Before starting, verify `reminder-policy.service.ts` exists on main (`test -f` it).
