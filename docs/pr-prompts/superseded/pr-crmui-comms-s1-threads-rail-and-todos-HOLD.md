---
premise: '! grep -q "CRM_COMMS_RAIL_V1" apps/web/src/pages/crm/CommsHubPage.tsx'
premise_means: >-
  The Comms hub's unanchored screen is a single column. The approved mock-up's 400px right rail -
  an "Add a to-do" composer and a tickable "My to-dos" list - does not exist, so a to-do can only be
  created from inside an anchored thread, and the to-do rows on the Threads screen are read-only
  status badges. Thread rows carry a subject and a date and nothing that says what the conversation
  is about.
scope:
  - apps/web/src/pages/crm/CommsHubPage.tsx
  - apps/web/src/pages/crm/__tests__/crm-comms-rail.test.ts
done_when: pnpm build && pnpm lint && grep -q "CRM_COMMS_RAIL_V1" apps/web/src/pages/crm/CommsHubPage.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
cluster: crm-comms
cluster_order: 1
rollback_strategy: >-
  Web-only, one page component plus its test. No API route, no DTO, no schema, no migration, no new
  dependency. Every request it makes already exists and is already called from this file. Revert and
  the Comms hub renders as the single column it is today.
---

# The Comms hub has no right rail, and its to-dos cannot be ticked

First slice of the Comms screen-composition corrections. Approved mock-up:
`https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c` - artboard `Comms.dc.html`,
titled "Comms hub . Threads".

Measured 2026-09-04 against the working tree, mock-up read artboard by artboard. The architecture
landed: one nav item, one tab bar, one URL contract, a genuine two-step anchor picker. The screen
composition did not, because `docs/plans/crm-build-order-plan.md` never described a layout.
**The mock-up is the specification.**

## What to build

**1. The right rail.** The mock-up's Threads screen is
`display: grid; grid-template-columns: 1fr 400px; gap: 16px`. The left cell is the card that holds
the tab strip and the thread list - what ships today. The right cell is a stack of two cards:
`Add a to-do` and `My to-dos`.

The rail belongs to the **Threads** tab. The mock-up's Inbox artboard (`Intake.dc.html`) is a
full-width list with no rail; leave the Inbox tab full width.

**2. The `Add a to-do` composer.** Mock-up fields, in order: a title input, then a two-column row of
`Assign to` (showing an avatar and the word `Me`) and `Due` (a date), then a right-aligned `Add`
button.

Today **you cannot create a to-do from this screen at all.** `createTask` returns early unless
`anchored` is true, and the composer that calls it is only rendered in the anchored view. Build the
composer in the rail and give it an anchor:

- `POST /crm/comms/tasks` requires `entityType` and `entityId` (`CreateTaskDto` in
  `comms.controller.ts`), so the composer must know what the to-do hangs off.
- This screen already holds an `AnchorPicker` selection in `pickerSelection`. Use it. Disable `Add`
  until the selection is `kind: "entity"`, and say so in the composer's helper text rather than
  leaving a dead button.
- Reuse `buildCreateTaskBody` exactly as it is. It already pins `assigneeId` to the creating user,
  which is the fix the mock-up's amber strip demands: *"Assign to defaults to you: today every to-do
  is created unassigned, which is why 'My to-dos' is empty for everyone."* Do not add a second body
  builder.
- `Assign to` renders `Me` and only `Me`. It is not a picker. See Do NOT.

**3. Make the to-do rows tickable.** The mock-up's `My to-dos` rows are a 16px square checkbox, the
title, and one line underneath reading `Overdue by 3 days . Hansen Yuncken` in red or
`Due in 2 days . Tender T-2418` in grey. Shipped rows are read-only: title, entity label, a status
badge and a due date, with no control.

The call already exists. `toggleTask` PATCHes `/crm/comms/tasks/:id` with the flipped status and
reloads - it is wired only to the anchored view's checkbox. Lift it so one row component serves
both the rail's `My to-dos` and the To-dos tab list, and both get the checkbox.

`PATCH /crm/comms/tasks/:id` gates on `crm.manage` while `GET /crm/comms/tasks` gates on `crm.view`
(`comms.controller.ts`). Render the checkbox disabled for a user without `crm.manage` rather than
firing a request that will 403.

**4. The `1 overdue` chip.** Mock-up: a red pill on the `My to-dos` card header. Derive it from the
rows already in state - `dueAt` in the past and `status` in `OPEN` / `IN_PROGRESS` - and render
nothing at zero. Do not add a second request for it.

**5. Thicken the thread rows.** The mock-up's row is: a circular avatar with the author's initials,
the subject, an anchor chip (`Tender T-2418`, `Account . Hansen Yuncken`, `Job J-1187`), the
last-message preview prefixed with its author (`R. Silva: Sent the revised transport rates through,
waiting on their QS.`), and a footer reading `4 messages . 6 days ago`. Shipped is subject, entity
chip, and `Updated <date>` - the list tells you nothing without opening every thread.

Build the avatar from `createdBy` initials, keep the anchor chip, and render the relative age from
`updatedAt`.

**The last-message preview and the message count are not available.** `listThreads` returns rows
through `threadInclude()`, which is `createdBy` and nothing else - no messages, no `_count`. Do not
add an API route, and do not fetch each thread individually to synthesise them: that is 25 requests
per page. Render what the payload carries and **name the two missing fields in the PR body as a gap
needing an API slice.**

**6. Export the row and chip logic as pure functions and test those.** The web workspace has no
`@testing-library` or jsdom setup - every existing web test is pure logic, and
`LeadsTriageList.archive.test.tsx` says so in its header comment. So export, and test:

- a builder that turns a task row plus a clock into `{ overdue, dueLabel }`, covering overdue, due
  soon, due later, and no due date.
- the overdue count over a set of rows, including the zero case and a `DONE` row with a past due
  date (which must not count).
- a builder that turns a thread row into `{ initials, subject, anchorLabel, ageLabel }`, including a
  thread with a null subject and a null `createdBy`.
- `buildCreateTaskBody` (it already exists) asserting `assigneeId` equals the creating user.

Mark the component with `CRM_COMMS_RAIL_V1`.

## Do NOT

- **Do not touch the architecture that already landed.** The three CRM nav items and their order
  (Accounts, Tenders, Comms hub), the tab sets and their order (List / Relationships,
  Register / Follow-ups, Inbox / Threads / To-dos), and the `?tab=` URL contracts are Marco's
  decisions 1-8 in `docs/plans/crm-build-order-plan.md` and they shipped correctly.
- **Do not restore an inner tab bar.** `CommsPage.tsx` owns the tab bar and passes the active tab
  down as a prop; the file's own comment records that two tab bars once rendered on `/crm/comms`.
  One tab bar per page. Do not reintroduce local tab state.
- **Do not touch the anchor picker's six types or their order** - `Lead . Tender . Job . Account .
  Contract . Other`, the mock-up's exact list, and a genuine two-step control (type, then record).
  `Other` stays selectable and stays disabled downstream: the server's `COMM_ENTITY_TYPES` has no
  `OTHER`, so `canCreate` requires `kind: "entity"` and the picker shows a note saying so. Keep both
  halves of that behaviour.
- **Do not build an assignee picker.** `assigneeId` always defaults to the creator. The programme-wide
  Do NOT in `docs/plans/crm-build-order-plan.md` forbids building one on `/users` or `/admin/users` -
  both require `users.view` and `/admin/users` 403s non-admins, so a CRM user could not populate it.
  Do not make `assigneeId` nullable in the body builder.
- Do not change the anchored view's `?entityType=&entityId=` links or the anchored screen's layout.
  This slice is the unanchored inbox.
- **Do not add, change or remove any API route, service method, DTO or schema field.**
- Do not touch `CommsInboxTriage.tsx`, the tab labels or the tab counts - those are the
  `crm-chrome` slice. Do not touch the bulk-link preview-then-confirm flow, the
  log-and-set-next-action single write, `/sot/`, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] State the grid used on the Threads tab and the rail width (`1fr 400px`). State how many
      columns the Threads screen has before and after (1 -> 2).
- [ ] Create a to-do from the rail. State the anchor type and id it was created against, the
      `assigneeId` that was sent, and confirm the row then appears in `My to-dos`.
- [ ] Tick a to-do in the rail. State its status before and after and the request that was sent.
- [ ] State the overdue count the chip renders and the number of rows in the list, and confirm a
      `DONE` row with a past due date is excluded. Give both figures.
- [ ] State what a thread row renders after the change, field by field, and name the two mock-up
      fields you could not render and why.
- [ ] Confirm exactly one tab bar renders on `/crm/comms?tab=threads`.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
