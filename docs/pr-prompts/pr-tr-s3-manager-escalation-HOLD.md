---
premise: '! test -f apps/api/src/modules/tendering/tender-reminder-escalation.service.ts'
premise_means: No manager escalation layer exists for tender reminders — when an approaching/overdue item is unactioned past the configured escalation window, no notification reaches a manager.
scope:
  - apps/api/src/modules/tendering/tender-reminder-escalation.service.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/api/src/modules/tendering/__tests__/tender-reminder-escalation.service.spec.ts
  - apps/api/src/modules/tendering/tender-reminder.service.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/tendering/tender-reminder-escalation.service.ts && grep -q "scanAndEscalate" apps/api/src/modules/tendering/tender-reminder-escalation.service.ts
size: 4
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/api/src/modules/tendering/tender-reminder.service.ts
---

# TR-3: Manager escalation for unactioned tender reminders

**Binding plan:** `docs/plans/tender-reminders-plan.md` (read sections 2 and 4 in full before
starting). This is the third slice of the tender reminders cluster.

**Gate:** TR-2 (reminder cron engine) must be on main. Verify that
`apps/api/src/modules/tendering/tender-reminder.service.ts` exists before starting.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- TR-1 added: `TenderReminderPolicy` (with `escalationWindowDays` field, default 3) and
  `TenderReminderLog` (idempotency log, `@@unique([tenderId, triggerKey])`).
- TR-2 built: `TenderReminderService.scanAndNotify(today)` — scans PRE-DUE, POST-SUBMISSION, and
  FOLLOW-UP tracks and fires notifications to estimators; writes `TenderReminderLog` rows.
- `NotificationsService.create({ userId, title, body, severity, linkUrl? })` — the delivery seam;
  do not build a parallel channel.
- The permissions registry (`apps/api/src/common/auth/permissions.registry.ts` or equivalent) —
  grep for `"tenders.manage"` to locate it. Use the existing manage permission to identify manager
  users rather than inventing a new role concept.
- Do NOT extend the deprecated `TenderFollowUp` endpoint.
- Do NOT touch Azure / Entra / SharePoint.

## What to build

### 1. `apps/api/src/modules/tendering/tender-reminder-escalation.service.ts` (new)

An `@Injectable()` service. Inject `PrismaService`, `ReminderPolicyService`,
`NotificationsService`.

**Method — `async scanAndEscalate(today: Date)`:**

```
1. const policy = await this.policyService.getPolicy();

2. Find TenderReminderLog rows WHERE firedAt <= today - policy.escalationWindowDays days
   AND tenderId matches a tender that is still OPEN/at-risk (not CONVERTED, not won/lost outcome)
   AND the tender's estimatorUserId is still set

3. For each such log row, check whether the tender has been actioned since the reminder fired:
   - "Actioned" = any TenderEntry created AFTER the log's firedAt (type: any; status: open or done),
     OR the tender has moved to a terminal stage (AWARDED, CONTRACT_ISSUED, CONVERTED),
     OR a TenderEntry of type 'follow_up'/'self_reminder' is now status='done'.
   - If actioned: skip (no escalation needed).

4. For unactioned items, derive the escalation trigger key:
   - Take the original log's triggerKey, prefix with "esc_": e.g. "esc_pre_due_7"
   - Check TenderReminderLog for this escalation key — if it exists, skip (already escalated).

5. For each item not yet escalated:
   - Find users who hold the manager role (grep the permissions registry for the correct
     permission key — likely "tenders.manage" or an admin-level permission — and query User rows
     that have that permission granted; if the permission system uses a Role-based approach, query
     that relation; adapt to whatever the existing auth model provides).
   - If no manager users found: log a warning and skip without error.
   - For each manager user: NotificationsService.create({
       userId: managerId,
       title: `Tender ${tender.tenderNumber} — reminder unactioned (escalation)`,
       body: `A reminder for ${tender.title} was sent ${escalationWindowDays} days ago and has not been actioned. Escalating to manager.`,
       severity: "HIGH",
       linkUrl: `/tenders/${tender.id}`
     })
   - Upsert TenderReminderLog { tenderId, triggerKey: "esc_pre_due_7" (or equivalent), firedAt: today }

6. Expose this method publicly so TenderReminderService can call it as a second pass in its
   scanAndNotify — or wire it as a separate daily @Cron on the same UTC schedule. Choose the
   cleaner option given the existing TenderReminderService shape.
```

### 2. Wire into `TenderReminderService` (update `tender-reminder.service.ts`)

At the end of `scanAndNotify(today)`, call `this.escalationService.scanAndEscalate(today)` —
making the escalation pass a natural second phase of the same daily run. Alternatively, add a
separate `@Cron` in the escalation service if that is cleaner. Choose whichever approach keeps both
services testable independently.

### 3. Update `apps/api/src/modules/tendering/tendering.module.ts`

Register `TenderReminderEscalationService` in `providers`. Inject it into `TenderReminderService`
if wired via the service call approach.

### 4. Unit tests — `apps/api/src/modules/tendering/__tests__/tender-reminder-escalation.service.spec.ts` (new)

Mirror the mock-Prisma pattern. Key assertions:

- A log row older than `escalationWindowDays` for a tender with no subsequent TenderEntry triggers a
  manager notification.
- A log row older than `escalationWindowDays` but with a TenderEntry created AFTER `firedAt` does
  NOT escalate (tender was actioned).
- An existing `TenderReminderLog` row for the escalation trigger key prevents a duplicate escalation
  notification.
- When no manager users are found, the method logs a warning and returns without throwing.

## Do NOT

- Do NOT build any UI — that is TR-4.
- Do NOT email clients — escalation goes to internal manager users only.
- Do NOT build a new role or permission concept — use the existing permissions registry.
- Do NOT re-fire an escalation that already has its `TenderReminderLog` row.
- Do NOT extend the deprecated `TenderFollowUp` endpoint.
- Do NOT touch Azure / Entra / SharePoint or `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if `tender-reminder-escalation.service.ts` already exists on
  main, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
- Before starting, verify `tender-reminder.service.ts` exists on main (`test -f` it).
