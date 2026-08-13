# Tender Reminders Plan — Scheduled Quote-Due + Follow-Up Reminder & Escalation Engine

**Cluster prefix:** TR  
**Plan status:** SLICE-0 (plan only — no product code in this PR)  
**Authored:** 2026-08-13  
**Decisions locked by:** Marco (PR-Master panel, 2026-08-12)

---

## 1. Problem statement

Nothing currently fires when a date arrives in the tendering workflow. Specifically:

- No scheduled scan for tenders approaching or past their quote `dueDate`.
- No scheduled scan for upcoming or overdue `TenderEntry` follow-up / self-reminder due dates.
- No alert when a submitted tender has no outcome recorded after a configurable wait.
- The going-cold thresholds (`stageIdleThresholds` in `tendering-page-helpers.ts`) are hardcoded in
  the web layer — admin cannot tune them without a code change.
- No escalation when an approaching-due or overdue item remains unactioned.
- No consolidated worklist surface sorted by urgency.

The existing `attentionState` / `needsAttention` logic (in `apps/web/src/pages/tendering-page-helpers.ts`)
already classifies tenders as healthy / watch / rotting, and `TenderEntry` (types `follow_up`,
`self_reminder`, `task` — all require a due date) is the data model for reminders. The notification
delivery seam (`NotificationsService`, `automation-engine.service.ts`) and the cron pattern
(`claim-draft-reminder.service.ts` + `public-holidays.ts` for business-day rolling) already exist
and must be REUSED — not rebuilt.

---

## 2. Marco's locked decisions (do not re-litigate)

1. **Reuse, don't rebuild.** Build ON `attentionState`, `TenderEntry` (follow_up / self_reminder),
   and `NotificationsService`. No parallel follow-up model, no parallel notification channel.
2. **Two distinct reminder tracks:**
   - PRE-DUE: before quote `dueDate` — alert estimator not to submit late.
   - POST-SUBMISSION: chase-for-decision after `submittedAt` if no outcome recorded.
   Going-cold STOPS once won/lost is recorded (outcome capture already exists via `TenderEntry`
   outcomes and `OutcomeCaptureModal`).
3. **Admin-configurable timings** replace the hardcoded thresholds:
   days-before-due, post-submission chase cadence, idle watch/rotting thresholds, escalation window.
   Super-user/admin gated + audited.
4. **Idempotency is mandatory.** A `TenderReminderLog` table (or `lastRemindedAt` field) ensures the
   cron never re-notifies the same item on every tick.
5. **Escalation:** assigned estimator first; escalate to a manager role if a due/overdue item is
   unactioned within the configured window. Reminders go ONLY to the assignee + escalation role.
6. **Anti-fatigue:** group reminders into a digest; the WORKLIST is the primary surface; notifications
   are a nudge. Estimator can snooze / dismiss / mark-actioned, and set a manual follow-up date.
7. **Worklist reuses `attentionState`.** Surface the existing `needsAttention` as a sorted-by-urgency
   list; do NOT recompute attention in a second place.

---

## 3. What already exists (grounded against main)

| Artifact | Location | Role in TR |
|---|---|---|
| `attentionState` / `needsAttention` / `stageIdleThresholds` | `apps/web/src/pages/tendering-page-helpers.ts` | TR-1 moves thresholds to DB config; TR-4 surfaces the worklist |
| `TenderEntry` (follow_up / self_reminder / task, all require dueDate) | `apps/api/src/modules/tendering/tender-entries.service.ts` | TR-2 scans these for upcoming due dates |
| `NotificationsService.create()` | `apps/api/src/modules/platform/notifications.service.ts` | TR-2/TR-3 delivery seam |
| `AutomationEngineService` | `apps/api/src/modules/platform/automation-engine.service.ts` | Already wired into notifications; TR does not add a parallel channel |
| `ClaimDraftReminderService` | `apps/api/src/modules/contracts/claim-draft-reminder.service.ts` | Mirror pattern for TR-2 cron |
| `qldPublicHolidays` / `adjustToPrecedingWorkday` | `apps/api/src/modules/contracts/public-holidays.ts` | TR-2 imports for business-day awareness |
| `Tender.dueDate` | `prisma/schema.prisma` | PRE-DUE track anchor |
| `Tender.submittedAt` | `prisma/schema.prisma` | POST-SUBMISSION track anchor |
| `Tender.estimatorUserId` | `prisma/schema.prisma` | Primary notification target |

The deprecated `TenderFollowUp` write endpoint must NOT be extended. Do not add a parallel follow-up
model. Do not rebuild any of the above.

---

## 4. Ordered slices

Each slice is independently deployable and gated on the previous slice's primary artifact being on main.

### TR-1 (S1) — Reminder policy/config + reminder-log

**Prompt file:** `docs/pr-prompts/pr-tr-s1-reminder-policy-HOLD.md`

**What it builds:**

- `model TenderReminderPolicy` — admin-configurable settings table:
  - `daysBefore` (Int, days before dueDate to fire first pre-due reminder, default 7)
  - `dueDayOf` (Boolean, fire a reminder on the actual due day, default true)
  - `postSubmissionChaseDays` (Int, days after submittedAt before first post-submission chase, default 14)
  - `postSubmissionCadenceDays` (Int, days between subsequent post-submission chases, default 14)
  - `watchIdleThresholds` (Json, per-stage watch day counts, seeded from current hardcoded values)
  - `rottingIdleThresholds` (Json, per-stage rotting day counts, seeded from current hardcoded values)
  - `escalationWindowDays` (Int, days unactioned before escalating to manager role, default 3)
  - `isSuperUserOnly` (Boolean, default true — super-user/admin gated CRUD)
- `model TenderReminderLog` — idempotency log:
  - `tenderId`, `triggerKey` (String, e.g. `"pre_due_7"`, `"post_sub_14"`), `firedAt` (DateTime),
    `@@unique([tenderId, triggerKey])` — prevents re-firing the same reminder
- `apps/api/src/modules/tendering/reminder-policy.service.ts` — CRUD for `TenderReminderPolicy`
  (read defaults, update, get current policy); provides `getPolicy()` used by TR-2.
- Admin controller endpoints (super-user gated): `GET /tendering/reminder-policy`,
  `PUT /tendering/reminder-policy`.
- Move `stageIdleThresholds` in `tendering-page-helpers.ts` to read from the policy (TR-1 seeds the
  same values as the current hardcoded defaults — no behaviour change until admin edits).
- Migration (additive: two new tables, no existing rows modified), data-model regen, rollback note.
- `gate_allow: migrations`, `backfill: false`, `GATE-ALLOW: migrations` at column 0 of PR body.
- **Primary artifact for TR-2 chain:** `apps/api/src/modules/tendering/reminder-policy.service.ts`

**Size:** 9 files (schema.prisma, migration, 2x data-model map files, reminder-policy.service.ts,
reminder-policy.controller.ts, tendering.module.ts update, tendering-page-helpers.ts update,
seed update for TenderReminderPolicy defaults)

### TR-2 (S2) — Scheduled reminder engine (cron)

**Prompt file:** `docs/pr-prompts/pr-tr-s2-reminder-engine-HOLD.md`

**What it builds:**

- `apps/api/src/modules/tendering/tender-reminder.service.ts` — the cron service, mirroring
  `ClaimDraftReminderService`:
  - `@Cron("0 21 * * *", ...)` (9pm UTC = 7am AEST) daily scan.
  - PRE-DUE track: find OPEN tenders with dueDate approaching within `policy.daysBefore` days or
    past-due; skip if `TenderReminderLog` already has the trigger key for this tender.
  - POST-SUBMISSION track: find SUBMITTED tenders with `submittedAt` older than
    `policy.postSubmissionChaseDays` and no outcome; chase at `postSubmissionCadenceDays` intervals
    via the log.
  - Business-day aware via `adjustToPrecedingWorkday` from `public-holidays.ts`.
  - Fires `NotificationsService.create()` to the tender's `estimatorUserId`; writes a
    `TenderReminderLog` row (upsert by `[tenderId, triggerKey]`) to prevent re-fire.
  - Anti-fatigue digest: group multiple reminder events into a single notification per user per run
    where possible.
  - Testable core extracted into `scanAndNotify(today: Date)` (injected date, same pattern as
    `checkDraftsReadyForReview`).
- Wire into `tendering.module.ts`.
- Unit tests mirroring `claim-draft-reminder.service.spec.ts` pattern.
- **Gate:** `requires_file_on_main: apps/api/src/modules/tendering/reminder-policy.service.ts`
- **Primary artifact for TR-3 chain:** `apps/api/src/modules/tendering/tender-reminder.service.ts`

**Size:** 4 files (tender-reminder.service.ts, spec, tendering.module.ts update, minor helper if needed)

### TR-3 (S3) — Manager escalation

**Prompt file:** `docs/pr-prompts/pr-tr-s3-manager-escalation-HOLD.md`

**What it builds:**

- `apps/api/src/modules/tendering/tender-reminder-escalation.service.ts` — escalation layer:
  - Runs as a second pass after the daily cron (or as a separate `@Cron` on the same schedule,
    called from `TenderReminderService.scanAndNotify` or wired separately).
  - Finds tenders where a reminder was fired more than `policy.escalationWindowDays` ago and the
    tender is still in the same unactioned state (no new `TenderEntry` or no outcome captured).
  - Fires `NotificationsService.create()` to the manager role (look up users with the manager
    permission / role — reuse the existing permissions registry, do not create a new role concept).
  - Writes a separate `TenderReminderLog` trigger key (e.g. `"escalation_1"`) for idempotency.
- Wire into `tendering.module.ts`.
- Unit tests.
- **Gate:** `requires_file_on_main: apps/api/src/modules/tendering/tender-reminder.service.ts`
- **Primary artifact for TR-4 chain:** `apps/api/src/modules/tendering/tender-reminder-escalation.service.ts`

**Size:** 4 files (escalation.service.ts, spec, tendering.module.ts update, minor helper)

### TR-4 (S4) — "Needs attention" worklist UI

**Prompt file:** `docs/pr-prompts/pr-tr-s4-attention-worklist-HOLD.md`

**What it builds:**

- `apps/web/src/pages/tendering/TendersAttentionWorklist.tsx` — a worklist panel on the Tenders page:
  - Fetches the existing tender list with `attentionState` and `needsAttention` already computed by
    `getTenderingAttentionSummary` (reuse, do NOT recompute).
  - Filters to `needsAttention === true`, sorts by urgency (overdue dueDate > overdue followUps >
    rotting > watch).
  - Per-row actions: snooze (set a manual `TenderEntry` of type `self_reminder` with a future
    dueDate), dismiss (mark-actioned via a `TenderEntry` status update to `done`), and set a manual
    follow-up date (create a `TenderEntry` of type `follow_up`).
  - Reuse existing `TenderEntry` API endpoints — no new API endpoints needed.
- Wire into the Tenders page alongside the existing list view (e.g. as a tab or collapsible panel).
- **Gate:** `requires_file_on_main: apps/api/src/modules/tendering/tender-reminder-escalation.service.ts`
- **Primary artifact (proof of completion):** `apps/web/src/pages/tendering/TendersAttentionWorklist.tsx`

**Size:** 6 files (TendersAttentionWorklist.tsx, hook or helper, wiring into tenders page,
unit/vitest test, minor type additions to tendering-page-helpers or api types if needed)

---

## 5. Slice dependency chain

```
TR-0 (this plan PR)
  └─ TR-1: reminder-policy.service.ts + TenderReminderPolicy/TenderReminderLog schema
       └─ TR-2: tender-reminder.service.ts (cron)
            └─ TR-3: tender-reminder-escalation.service.ts
                 └─ TR-4: TendersAttentionWorklist.tsx (UI)
```

Each slice is gated on its predecessor's primary artifact being on `origin/main` via
`requires_file_on_main`.

---

## 6. What is explicitly out of scope

- Emailing clients — this feature notifies INTERNAL staff only.
- Any Azure / Entra / SharePoint touch.
- Editing `/sot/`.
- Rebuilding `attentionState`, `TenderEntry`, or `NotificationsService`.
- Extending the deprecated `TenderFollowUp` endpoint.
- Re-notifying the same item every cron tick (idempotency is mandatory via `TenderReminderLog`).
- A Redis pub-sub or external message queue — the cron + notifications seam is sufficient.

---

## 7. File path summary for cross-slice references

| Slice | Primary artifact (used as `requires_file_on_main` by next slice) |
|---|---|
| TR-1 | `apps/api/src/modules/tendering/reminder-policy.service.ts` |
| TR-2 | `apps/api/src/modules/tendering/tender-reminder.service.ts` |
| TR-3 | `apps/api/src/modules/tendering/tender-reminder-escalation.service.ts` |
| TR-4 | `apps/web/src/pages/tendering/TendersAttentionWorklist.tsx` |
