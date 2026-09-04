---
premise: '! grep -q "CRM_REGISTER_V3" apps/web/src/pages/crm/TendersRegisterPage.tsx'
premise_means: >-
  A tender register with no money in it. `estimatedValue` is on the row type and comes back on every
  fetch, and no cell ever renders it. The Last-interaction column prints a bare date where the
  approved mock-up shows the channel and the one-line summary, so the column says only "someone
  touched this once", which the adjacent Updated column already said. The channel is never captured
  on this write path at all - the word does not appear in the page or its helpers.
scope:
  - apps/web/src/pages/crm/TendersRegisterPage.tsx
  - apps/web/src/pages/crm/tendersRegisterPage.helpers.ts
  - apps/web/src/pages/crm/__tests__/crmui-register-s1.test.ts
done_when: pnpm build && pnpm lint && grep -q "CRM_REGISTER_V3" apps/web/src/pages/crm/TendersRegisterPage.tsx
size: 7
gate_allow: none
seed_only: false
escalates: true
backfill: false
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
cluster: crm-register
cluster_order: 1
rollback_strategy: >-
  Web-only: one page, one pure-helper module, one test. The money column and the submitted-date
  sub-line are pure presentation over fields already on the wire. The channel half is gated behind a
  NO-OP stop precisely so this slice can never invent a store for it. Revert and the register renders
  exactly as it does today.
---

# The tender register has no money column, and Last interaction is a bare date

First slice of the register cluster. Approved mock-up:
`https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c` ("CRM Module Mock-up")

Measured 2026-09-04 against `origin/main`, mock-up read in full and compared cell by cell. The
architecture is right and stays: Register and Follow-ups are genuinely one screen over one list, the
outer tab bar drives `?tab=`, and the log-to-next-action write is atomic. What was never in any
prompt's scope is the composition of the row. This slice puts it in scope. The mock-up is the
specification.

## What to build

**1. Put the columns in the mock-up's sequence.**

    MOCK-UP:  Tender (T-2418 + title, "Submitted 12 Aug" sub-line) | Client | Status | Value |
              Last interaction (channel - relative time, over the summary) |
              Logged by (avatar + name) | Next action (+ chip) | [Log]
    SHIPPED:  Tender # | Title | Client | Status | Updated | Last interaction | Logged by |
              Next action | Actions

The shipped header is the literal array at `TendersRegisterPage.tsx:1014-1025`; the body cells are
`:1092-1160`. Four structural differences, in order of how much they cost the reader.

**2. Add the Value column. This is the most conspicuous omission on the screen.**

`estimatedValue?: string | null` is already on `TenderRow` (`:40`). `GET /tenders` fetches with
`include: tenderInclude` (`tendering.service.ts:163`), so the Decimal comes back as a string on every
row of every page. The register even filters on it - `valueMin` / `valueMax` are in `EMPTY_FILTERS`
at `:94-95`. It is simply never rendered: the only three hits for `estimatedValue` in the whole file
are those three lines.

Render it right-aligned between Status and Last interaction. There is no money formatter in this page
or its helpers - add one to `tendersRegisterPage.helpers.ts` so the test can pin it, matching the
house format already used at `AccountDetailPage.tsx:947`:
`Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })`.
A null value renders as the same em-rule the other columns use for absent data, never as `$0`.

**3. Make Last interaction say what the mock-up says, or stop.**

Today the cell is `new Date(interaction.lastMessageAt).toLocaleDateString()` (`:1076-1077`, rendered
at `:1110-1112`). The mock-up shows two lines: `Phone - 4 days ago` over `Chased addendum 3`. The
channel and the summary are the entire point of the column; without them it is a second Updated
column.

Build the relative-time half unconditionally: a pure `formatRelativeTime` in the helpers, tested
against a fixed instant the way `classifyNextAction` already is. That half needs nothing new.

The other two halves need data the API does not send. **Check before you build, and stop if either
is absent:**

- **The summary.** `POST /crm/comms/last-interaction/batch` returns `LastInteractionResult` -
  `entityType`, `entityId`, `lastMessageAt`, `loggedBy`, and nothing else
  (`comms.service.ts:486-491`; the web mirror is the `LastInteraction` type at `:48-53`).
  `CommMessage.body` and `CommThread.subject` both exist on the models but neither is selected into
  that result. If the batch response still carries no message text when you look, say
  `NO-OP: last-interaction batch returns no message body - needs an API read slice first` and stop.
- **The channel.** `InteractionChannel` is on the schema (`schema.prisma:7677`) and
  `relationships.controller.ts:47` accepts it - but that is the *relationship-note* path. This
  register's Log modal posts to `/crm/comms/log-contact` (`:617`), whose `LogContactDto`
  (`comms.controller.ts:96-105`) has no channel field, and the rows it writes - `CommThread` and
  `CommMessage` (`schema.prisma:7772-7813`) - carry no channel column at all. `channel` appears zero
  times in `TendersRegisterPage.tsx` and zero times in `tendersRegisterPage.helpers.ts`. So the Log
  modal cannot start recording a channel without somewhere to put it. If the comms write path still
  has no channel field when you look, say
  `NO-OP: no channel on the comms log-contact path - needs an API slice first` and stop on that half
  only. Do not invent a column, a route or a DTO field to hold it. A picker that silently discards
  what the estimator chose is worse than no picker.

Ship items 1, 2, 4 and 5 either way. Say in the PR body which halves of item 3 shipped and which
stopped, and why.

**4. One Tender cell, not two columns; remove the Updated column.** The mock-up puts the tender
number and the title in a single cell with a `Submitted 12 Aug` sub-line under them. `Tender.submittedAt`
is on the model (`schema.prisma:1324`) and rides back on the same `include`; add it to `TenderRow`
and render it as the sub-line. Then remove the `Updated` column (`:1018`, body cell `:1109`) - it
sits directly beside Last interaction, both print a bare `toLocaleDateString()`, and no reader can
tell from the screen which one means "we spoke" and which means "a field changed". Keep `updatedAt`
on the row type and keep it sortable if it is already; it is the *column* that goes.

**5. Add the `Columns` picker.** The mock-up has a `Columns` control on the filter bar that toggles
column visibility. Persist the choice the way the page already persists saved views - the
`localStorage` helpers at `:103-132` are the pattern; use a sibling key, do not overload
`crm-register-saved-views:v1`.

**6. The Estimator ID box stays a free-text box.** The filter at `:852-864` is a bare text input
labelled `Estimator ID` with placeholder `User ID`, where the mock-up has an Owner picker. This is
not an oversight: `crm-build-order-plan.md:127-129` rules that an assignee picker on `/users` or
`/admin/users` cannot be built, because both require `users.view` and `/admin/users` returns 403 to
a non-admin, so a CRM user could never populate it. **State that constraint in the PR body and leave
the box**, or propose - in the PR body, not in code - the smallest change that does not need that
permission. Do not "fix" it by adding a user fetch.

Mark the component with `CRM_REGISTER_V3`.

## Do NOT

- **Do not touch the architecture that already landed.** It is Marco's decisions 1-8 from
  `crm-build-order-plan.md` and every one of them shipped correctly:
  - the three CRM nav items and their order - Accounts, Tenders, Comms hub
    (`ShellLayout.tsx:250-277`);
  - the tab sets and their order, and the `?tab=` URL contracts that drive them - in particular
    `TendersPage.tsx` owning the Register / Follow-ups tab bar and passing `activeTab` in as a prop
    (`TendersRegisterPage.tsx:66-75`, `:342`, `:704`). This page renders no tab bar of its own and
    must not grow one back;
  - the anchor picker's six types and their order - Lead, Tender, Job, Account, Contract, Other
    (`AnchorPicker.tsx:28-33`);
  - log-to-next-action as a single write - `logContact` creates the thread, the message and the
    `CommTask` in one transaction (`comms.service.ts:403-448`). Do not split it, do not add a second
    call, do not make the next action a typed field on the row;
  - preview-then-confirm on bulk client linking.
- **Do not add, change or remove any API route, service method, DTO or schema field.** Both halves
  of item 3 that need one are gated behind an explicit `NO-OP:` stop for exactly this reason.
- Do not touch the four next-action toggles, their order or their defaults
  (`FOLLOWUPS_DEFAULT_TOGGLES` in the helpers) - those are correct and belong to slice 2 of this
  cluster.
- Do not add the entity-type toggle group or the KPI cards - slice 2.
- Do not touch `AccountsListPage.tsx`, `AccountDetailPage.tsx` or any other CRM page.
- Do not touch `/sot/`, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] State the header row as one line, before and after. Give the column count before and after and
      name the column that went (Updated) and the column that arrived (Value).
- [ ] Give three rendered Value cells verbatim, including one null row, and the raw
      `estimatedValue` string each came from.
- [ ] State, per half of item 3, SHIPPED or `NO-OP:` with the reason: relative time, summary,
      channel. If the channel half stopped, quote the `LogContactDto` field list you checked.
- [ ] Paste one rendered Tender cell showing the number, the title and the submitted sub-line, and
      the raw `submittedAt` it came from.
- [ ] Toggle a column off, reload the page, and state that it is still off and which storage key
      holds it. Confirm `crm-register-saved-views:v1` is unchanged.
- [ ] State in the PR body why the Estimator ID box is still a free-text box, citing
      `crm-build-order-plan.md:127-129`. Grep the diff for `/users` and `/admin/users` and report
      zero.
- [ ] State that `TendersRegisterPage.tsx` still renders no inner tab bar and still takes
      `activeTab` as a prop.
- [ ] Grep the diff for hex colour literals and report zero. Both themes checked.
- [ ] `git diff --name-only` lists only the three files in `scope:`.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco.
