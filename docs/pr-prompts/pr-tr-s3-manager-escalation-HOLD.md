---
premise: '! test -f apps/api/src/modules/crm/reminders/comms-reminder-escalation.service.ts'
premise_means: No manager escalation layer exists for CRM reminders — when an overdue CommTask or an approaching/overdue tender item is unactioned past the configured escalation window, no notification reaches a manager (TR_SCOPE_CRM re-scope 2026-09-01).
scope:
  - apps/api/src/modules/crm/reminders/comms-reminder-escalation.service.ts
  - apps/api/src/modules/crm/reminders/reminders.module.ts
  - apps/api/src/modules/crm/reminders/__tests__/comms-reminder-escalation.service.spec.ts
  - apps/api/src/modules/crm/reminders/comms-reminder.service.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/crm/reminders/comms-reminder-escalation.service.ts && grep -q "scanAndEscalate" apps/api/src/modules/crm/reminders/comms-reminder-escalation.service.ts
size: 4
gate_allow: none
seed_only: false
escalates: false
requires_on_main: apps/api/src/modules/crm/reminders/comms-reminder.service.ts
---

<!-- re-scoped 2026-09-01: TR_SCOPE_CRM — CRM surface, not Tendering. See docs/plans/tender-reminders-plan.md §0. -->

# TR-3: Manager escalation for unactioned CRM reminders — **CRM surface**

**Binding plan:** `docs/plans/tender-reminders-plan.md` — read **§0 `TR_SCOPE_CRM`** first
(re-scope from Tendering to CRM), then §2 and §4. This is the third slice of the CRM reminders
cluster.

**Gate:** TR-2 (CRM reminder cron engine) must be on main. Verify that
`apps/api/src/modules/crm/reminders/comms-reminder.service.ts` exists before starting.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- TR-1 added: `TenderReminderPolicy` (with `escalationWindowDays` field, default 3) and
  `TenderReminderLog` (polymorphic idempotency log,
  `@@unique([subjectType, subjectId, triggerKey])`) under
  `apps/api/src/modules/crm/reminders/`.
- TR-2 built: `CommsReminderService.scanAndNotify(today)` — scans PRE-DUE, POST-SUBMISSION,
  and TASK tracks (CommTask-driven) and fires notifications to assignees / estimators; writes
  `TenderReminderLog` rows keyed by `{ subjectType, subjectId, triggerKey }`.
- **CRM-S7/S8 shipped:** "actioned" for the CRM surface means:
  the `CommTask` row moved to `status = DONE`, OR a newer `CommThread` (kind `logged_contact`)
  was created against the same anchor after `firedAt` (a user has since logged an interaction).
- `NotificationsService.create({ userId, title, body, severity, linkUrl? })` — the delivery seam;
  do not build a parallel channel.
- The permissions registry (`apps/api/src/common/auth/permissions.registry.ts` or equivalent) —
  grep FIRST for a CRM-admin key (`crm.admin`, `crm.manage`, etc.) so the escalation targets CRM
  managers. If no CRM-specific key exists, fall back to `tenders.manage` and record the choice
  at the top of the service file. Do NOT invent a new role concept.
- Do NOT extend the deprecated `TenderFollowUp` endpoint.
- Do NOT touch Azure / Entra / SharePoint.

## What to build

### 1. `apps/api/src/modules/crm/reminders/comms-reminder-escalation.service.ts` (new)

An `@Injectable()` service. Inject `PrismaService`, `ReminderPolicyService`,
`NotificationsService`.

**Method — `async scanAndEscalate(today: Date)`:**

```
1. const policy = await this.policyService.getPolicy();

2. Find TenderReminderLog rows WHERE firedAt <= today - policy.escalationWindowDays days
   AND triggerKey does NOT already start with "esc_"
   (i.e. only escalate primary reminders, never escalate escalations)

3. For each log row, resolve the subject and check whether it has been actioned since firedAt:
   - subjectType='Tender':
     * "Actioned" = the tender moved to a terminal stage (AWARDED, CONTRACT_ISSUED, CONVERTED),
       OR an outcome was recorded,
       OR a CommThread with kind='logged_contact' anchored to this tender was created AFTER
       the log's firedAt (a user has since logged an interaction on the tender).
   - subjectType='CommTask':
     * "Actioned" = the CommTask row is now status=DONE or CANCELLED,
       OR (if the task has a threadId) a newer CommMessage was written to the same thread
       AFTER firedAt.
   - If actioned: skip (no escalation needed).

4. Derive the escalation trigger key: prefix the original with "esc_": e.g. "esc_pre_due_7",
   "esc_post_sub_14", "esc_task_due". Check TenderReminderLog for this escalation key on the
   same (subjectType, subjectId) — if it exists, skip (already escalated).

5. For each item not yet escalated:
   - Find users who hold the manager permission (see Context above: grep for a CRM-admin key
     FIRST — `crm.admin` / `crm.manage` — then fall back to `tenders.manage`; adapt to whatever
     the existing auth model provides: direct permission grant, or via a Role relation).
   - If no manager users found: log a warning and skip without error.
   - For each manager user:
     * subjectType='Tender': NotificationsService.create({
         userId: managerId,
         title: `Tender ${tender.tenderNumber} — reminder unactioned (escalation)`,
         body: `A reminder for ${tender.title} was sent ${escalationWindowDays} days ago and has not been actioned. Escalating to manager.`,
         severity: "HIGH",
         linkUrl: `/crm/tenders?tenderId=${tender.id}`
       })
     * subjectType='CommTask': same shape, referencing the task title and the anchor
       (`entityType`/`entityId`), linkUrl pointing at the CRM record for that anchor.
   - Upsert TenderReminderLog { subjectType, subjectId, triggerKey: "esc_<original>", firedAt: today }

6. Expose this method publicly so CommsReminderService can call it as a second pass in its
   scanAndNotify — or wire it as a separate daily @Cron on the same UTC schedule. Choose the
   cleaner option given the existing CommsReminderService shape.
```

### 2. Wire into `CommsReminderService` (update `comms-reminder.service.ts`)

At the end of `scanAndNotify(today)`, call `this.escalationService.scanAndEscalate(today)` —
making the escalation pass a natural second phase of the same daily run. Alternatively, add a
separate `@Cron` in the escalation service if that is cleaner. Choose whichever approach keeps both
services testable independently.

### 3. Update `apps/api/src/modules/crm/reminders/reminders.module.ts`

Register `CommsReminderEscalationService` in `providers`. Inject it into `CommsReminderService`
if wired via the service-call approach. Do NOT edit `tendering.module.ts`.

### 4. Unit tests — `apps/api/src/modules/crm/reminders/__tests__/comms-reminder-escalation.service.spec.ts` (new)

Mirror the mock-Prisma pattern used in `apps/api/src/modules/crm/comms/__tests__/*.spec.ts`.
Key assertions:

- A `subjectType='Tender'` log row older than `escalationWindowDays` with no subsequent
  `logged_contact` `CommThread` triggers a manager notification.
- A `subjectType='Tender'` log row older than `escalationWindowDays` but with a `logged_contact`
  `CommThread` created AFTER `firedAt` does NOT escalate.
- A `subjectType='CommTask'` log row for a task now in `status=DONE` does NOT escalate.
- A `subjectType='CommTask'` log row where a newer `CommMessage` exists on the linked thread
  AFTER `firedAt` does NOT escalate.
- An existing `TenderReminderLog` row for the escalation trigger key prevents a duplicate
  escalation notification.
- The escalation pass never escalates its own escalation rows (triggerKey starting with `"esc_"`).
- When no manager users are found, the method logs a warning and returns without throwing.

## Do NOT

- Do NOT build any UI — CRM-S8's Follow-ups tab is the worklist; TR-4 is retired.
- Do NOT email clients — escalation goes to internal manager users only.
- Do NOT build a new role or permission concept — use the existing permissions registry.
- Do NOT re-fire an escalation that already has its `TenderReminderLog` row.
- Do NOT escalate escalation rows (triggerKey starting with `"esc_"`).
- Do NOT wire against `TenderEntry` — resolve "actioned" via `CommTask`/`CommThread` state.
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
  `apps/api/src/modules/crm/reminders/comms-reminder-escalation.service.ts` already exists on
  main, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
- Before starting, verify `apps/api/src/modules/crm/reminders/comms-reminder.service.ts`
  exists on main (`test -f` it).
