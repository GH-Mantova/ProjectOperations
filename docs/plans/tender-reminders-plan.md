# Tender Reminders Plan — Scheduled Quote-Due + Follow-Up Reminder & Escalation Engine

**Cluster prefix:** TR
**Plan status:** SLICE-0 (plan only — no product code in this PR)
**Authored:** 2026-08-13
**Decisions locked by:** Marco (PR-Master panel, 2026-08-12)
**Re-scoped:** 2026-09-01 — see §0 `TR_SCOPE_CRM` decision block below. The whole cluster now
targets the **CRM** surface, not the Tendering surface. All references to
`apps/web/src/pages/tendering/**` and `apps/api/src/modules/tendering/**` further down this file
are historical — read them for original intent, but the CRM re-scope in §0 governs.

---

## 0. TR_SCOPE_CRM — 2026-09-01 re-scope decision

**Marco's 2026-08-20 ruling** put follow-up and chasing in the CRM. Since the original plan was
authored, two CRM slices have shipped that consumed the "reminder" surface area:

- **CRM-S7** (`b63af33e`, PR #1431) — the interaction log. `RelationshipNote`
  (Account/Contact anchor) and `CommThread`+`CommMessage` (Tender/Opportunity anchor), plus the
  `InteractionChannel` enum and `CommThreadKind = logged_contact`. "Logging an interaction records
  channel, author and body AND sets the next action in the same write" — decision 5 of
  `crm-build-order-plan.md`. `CommTask` (already on main from CRM-4) is where the next action
  lands (`dueAt`, `status`, `assigneeId`).
- **CRM-S8** (`3985d74f`, PR #1447) — `TendersRegisterPage` V2. Full filter set + column sort,
  CSV export, `Last interaction` / `Logged by` / `Next action` columns with overdue/due-soon
  chips, single Log-action modal that writes `CommThread`+`CommMessage`+`CommTask` atomically
  (via `comms.service.logContact({ nextActionAt, nextActionNote })`), and a **Follow-ups tab that
  is the same list with amber toggles on and On track off**. Saved views persisted to
  localStorage.

Consequences that bind this cluster:

1. **Next actions live in `CommTask` (via `comms.service.logContact`), not `TenderEntry`.** The
   `TenderEntry` reminder surface named throughout the historical plan below is NOT the store the
   CRM uses. Do NOT wire the reminder engine against `TenderEntry` `follow_up` / `self_reminder`
   rows. Scan `CommTask` (`dueAt`, `status`, `assigneeId`, `entityType`, `entityId`).
2. **The Follow-ups worklist is already shipped as the S8 tab.** There is no separate
   "Tenders Attention Worklist" screen to build. TR-4 as originally described **duplicates S8 and
   is retired-in-place** (see §4 TR-4 note and the SUPERSEDED-BY header in
   `pr-tr-s4-attention-worklist-HOLD.md`).
3. **The reminder services live in the CRM module, not tendering.** New location:
   `apps/api/src/modules/crm/reminders/` (create the sub-module; sits next to
   `apps/api/src/modules/crm/comms/`). Admin config surface is a CRM admin route, not a Tendering
   admin route.
4. **What TR still owns that S7/S8 do NOT:**
   - **Scheduling** — a cron that fires when no user is present. S8 renders amber chips when the
     Follow-ups tab is open; nothing pushes a notification overnight when a `CommTask.dueAt`
     lapses, and nothing scans tenders for approaching quote `dueDate` or long-idle post-submission
     tenders. That gap remains.
   - **Escalation** — routing to a manager when an action stays overdue past a configured window.
     `CommTask` has `assigneeId` but no escalation path. That gap remains.

**Marker in this file:** `TR_SCOPE_CRM` — the CI premise for CRM-S12 asserts this literal is
present. Do not delete the marker.

**What did NOT change:**
- The idempotency requirement (a cron that fires the same reminder every tick is a bug).
- The reuse-not-rebuild discipline. The CRM comms sub-module (`apps/api/src/modules/crm/comms/`)
  and `NotificationsService` are the seams to reuse. Do not build a parallel channel.
- The anti-fatigue digest requirement (one notification per user per run, listing affected items).
- The out-of-scope list in §6 (no client emails, no Azure/Entra/SharePoint, no edits to `/sot/`).

**Open question deferred to the next slice, not to this re-scope:** whether historical PRE-DUE
quote-due reminders (a scheduled fire N days before `Tender.dueDate` for the estimator, before any
CRM action has been logged) should stay in this cluster or become a Tendering-side concern. This
plan keeps them in-cluster for now — the cron already has to run against `Tender.dueDate` for the
post-submission chase, so bundling PRE-DUE is a smaller surface than splitting the cron in two.

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

> **TR_SCOPE_CRM re-scope (2026-09-01):** the two new models and the CRUD service move to
> `apps/api/src/modules/crm/reminders/` (new sub-module). Admin route becomes
> `/crm/admin/reminder-policy` (super-user gated via existing `crm.admin` or equivalent —
> the prompt grep-locates the correct permission key). `TenderReminderLog` becomes polymorphic:
> `subjectType` (`"Tender" | "CommTask"`) + `subjectId` + `triggerKey`, so the same idempotency
> table serves both scheduled tender chases and overdue `CommTask` reminders. Naming: keep
> `TenderReminderPolicy` / `TenderReminderLog` for now (rename would break the migration name and
> is a separate slice if wanted). The `stageIdleThresholds` migration step is DROPPED — the
> Follow-ups tab (S8) uses S7's `nextActionAt`/`CommTask.dueAt` and does not read those
> per-stage thresholds; keeping them in the policy is dead config until a caller emerges.

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

> **TR_SCOPE_CRM re-scope (2026-09-01):** service moves to
> `apps/api/src/modules/crm/reminders/comms-reminder.service.ts`. The FOLLOW-UP TRACK no longer
> scans `TenderEntry`; it scans `CommTask WHERE status = 'OPEN' AND dueAt <= today + policy.daysBefore`
> and notifies `assigneeId` (falling back to a sensible default only if unset). PRE-DUE and
> POST-SUBMISSION tracks still anchor on `Tender.dueDate` and `Tender.submittedAt`. The
> "outcome recorded" check for POST-SUBMISSION becomes: any `CommThread` of kind
> `logged_contact` written against the tender since `submittedAt` **counts as a chase already
> logged**, so the cron does not chase behind a user who already actioned it. Cron still fires
> at `0 21 * * *` UTC. Wire into `crm.module.ts` (new `RemindersModule` under CRM).

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

> **TR_SCOPE_CRM re-scope (2026-09-01):** service moves to
> `apps/api/src/modules/crm/reminders/comms-reminder-escalation.service.ts`. "Actioned" now
> means: the `CommTask` row is `status = DONE` OR a newer `CommThread`/`CommMessage` (kind
> `logged_contact`) has been written against the same anchor since the reminder log's
> `firedAt`. Manager lookup still reuses the existing permissions registry — grep for the
> CRM manage permission first, fall back to `tenders.manage` only if no CRM-specific one
> exists (the prompt records which was chosen and why).

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

### TR-4 (S4) — "Needs attention" worklist UI  **[RETIRED-IN-PLACE — superseded by CRM-S8]**

**Prompt file:** `docs/pr-prompts/pr-tr-s4-attention-worklist-HOLD.md`

> **TR_SCOPE_CRM re-scope (2026-09-01) — RETIRED:** CRM-S8 (`3985d74f`, PR #1447) shipped
> `TendersRegisterPage` V2 with a Follow-ups tab that IS this worklist — same list, amber
> toggles on, On track off; overdue/due-soon chips on Next action; per-row Log-action modal;
> saved views. Building `TendersAttentionWorklist.tsx` on the Tendering page would ship a
> second screen that does the same job on a different surface (Tendering vs CRM) against a
> different data source (`TenderEntry` vs `CommTask`).
>
> **Do NOT build TR-4.** The prompt file is left on disk with a SUPERSEDED-BY header so the
> history is intact. If a gap in the Follow-ups tab surfaces later (e.g. a snooze action that
> S8 does not yet cover), open a targeted CRM slice against S8, not against this file.

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

**Post-`TR_SCOPE_CRM` chain (governs):**

```
CRM-S12 (this re-scope PR)
  └─ TR-1 (CRM): reminders/reminder-policy.service.ts + TenderReminderPolicy/TenderReminderLog (polymorphic)
       └─ TR-2 (CRM): reminders/comms-reminder.service.ts (cron scans CommTask + Tender)
            └─ TR-3 (CRM): reminders/comms-reminder-escalation.service.ts
                 └─ (TR-4 retired — CRM-S8's Follow-ups tab is the worklist)
```

Each slice is gated on its predecessor's primary artifact being on `origin/main` via
`requires_on_main`.

**Historical chain (superseded — kept for context):**

```
TR-0 → TR-1 (tendering/reminder-policy.service.ts)
     → TR-2 (tendering/tender-reminder.service.ts)
     → TR-3 (tendering/tender-reminder-escalation.service.ts)
     → TR-4 (web/tendering/TendersAttentionWorklist.tsx)
```

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

**Post-`TR_SCOPE_CRM` paths (govern):**

| Slice | Primary artifact (used as `requires_on_main` by next slice) |
|---|---|
| TR-1 | `apps/api/src/modules/crm/reminders/reminder-policy.service.ts` |
| TR-2 | `apps/api/src/modules/crm/reminders/comms-reminder.service.ts` |
| TR-3 | `apps/api/src/modules/crm/reminders/comms-reminder-escalation.service.ts` |
| TR-4 | RETIRED — CRM-S8's Follow-ups tab is the worklist (`apps/web/src/pages/crm/TendersRegisterPage.tsx :: FOLLOWUPS_DEFAULT_TOGGLES`) |

**Historical paths (superseded):**

| Slice | Original artifact (do NOT build) |
|---|---|
| TR-1 | `apps/api/src/modules/tendering/reminder-policy.service.ts` |
| TR-2 | `apps/api/src/modules/tendering/tender-reminder.service.ts` |
| TR-3 | `apps/api/src/modules/tendering/tender-reminder-escalation.service.ts` |
| TR-4 | `apps/web/src/pages/tendering/TendersAttentionWorklist.tsx` |
