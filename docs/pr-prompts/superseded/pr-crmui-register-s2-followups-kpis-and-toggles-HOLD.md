---
premise: '! grep -q "CRM_FOLLOWUPS_V2" apps/web/src/pages/crm/TendersRegisterPage.tsx'
premise_means: >-
  Follow-ups opens with no summary of the pile it exists to clear - the mock-up's four KPI cards are
  absent. The entity-type toggle group is absent too, and you can see exactly where the slice
  stopped: the five status Sets that back those toggles are declared in the page and referenced
  nowhere but their own declarations. And because Follow-ups renders the identical Register columns,
  a Lead row is indistinguishable from a Tender row on a list that deliberately spans both.
scope:
  - apps/web/src/pages/crm/TendersRegisterPage.tsx
  - apps/web/src/pages/crm/tendersRegisterPage.helpers.ts
  - apps/web/src/pages/crm/__tests__/crmui-register-s2.test.ts
done_when: pnpm build && pnpm lint && grep -q "CRM_FOLLOWUPS_V2" apps/web/src/pages/crm/TendersRegisterPage.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
cluster: crm-register
cluster_order: 2
requires_on_main: 'apps/web/src/pages/crm/TendersRegisterPage.tsx :: CRM_REGISTER_V3'
rollback_strategy: >-
  Web-only: one page, one pure-helper module, one test. Every figure is derived in the browser from
  rows already loaded - no API call, no route, no schema, no migration. Revert and Follow-ups renders
  exactly as it does today.
---

# Follow-ups opens with no summary, and half its controls are already in the file as dead code

Second slice of the register cluster, behind `CRM_REGISTER_V3`. Same file as slice 1, so it is
chained rather than parallel. Approved mock-up:
`https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c` ("CRM Module Mock-up")

Measured 2026-09-04 against `origin/main`, mock-up read in full. Read the "already landed" section
below before you write anything: this screen's data model is correct and the failure is entirely one
of composition.

## What already landed, and must NOT be undone

- **Register and Follow-ups are genuinely one screen over one list with toggleable filters** -
  Marco's decision 6. There is one `<table className="s7-table">` and one row pipeline; `tab` only
  decides whether the next-action filter applies (`TendersRegisterPage.tsx:536-549`). It is not two
  data sources and must not become two.
- **The four next-action toggles ship in the right order with the right defaults** -
  `Overdue`, `Due soon`, `No next action`, `On track` at `:725-728`, seeded from
  `FOLLOWUPS_DEFAULT_TOGGLES` (the first three on, `On track` off) in `tendersRegisterPage.helpers.ts`.
  Do not reorder them, do not change the defaults, do not change `DUE_SOON_MS`.

## What to build

**1. The four KPI cards, above the toggle row.**

    MOCK-UP:  Overdue 7 | Due this week 11 | Never logged 23 | Value at risk $4.2M
    SHIPPED:  nothing

The screen opens straight onto the list with no summary of the pile. `Value at risk`,
`Never logged` and `Due this week` each appear zero times in the file today. Every figure is derived
in the browser from `enrichedRows` (`:488-501`) - no fetch, no endpoint:

- **Overdue** = rows whose `classifyNextAction(nextActionAt, now)` is `"overdue"`.
- **Due this week** = a seven-day window. `DUE_SOON_MS` in the helpers is three days and belongs to
  the `Due soon` toggle - **do not change it**. Add a separate pure predicate with its own exported
  constant so the test can pin both windows independently.
- **Never logged** = rows whose `lastInteractionAt` is null, i.e. absent from the
  last-interaction batch map.
- **Value at risk** = the sum of `estimatedValue` over the overdue rows, formatted with the money
  helper slice 1 added. This card is the reason this slice is chained behind `CRM_REGISTER_V3`
  rather than run beside it.

Every card counts the rows currently in scope for the active filters, so the cards and the list can
never disagree. Put the four derivations in the helpers as pure functions and test them against a
fixed instant, the way `classifyNextAction` already is.

**2. The entity-type toggle group. The constants for it are already in the file and dead.**

    MOCK-UP:  Submitted tenders  |  Opportunities  |  Leads  |  Won & lost
    SHIPPED:  nothing

`TendersRegisterPage.tsx:78-86` declares five status Sets, each with a comment naming the toggle it
backs:

    WON_LOST_STATUSES      :78   "Won & lost" toggle       AWARDED, CONTRACT_ISSUED, LOST
    SUBMITTED_STATUSES     :80   "Submitted tenders"       SUBMITTED
    OPPORTUNITY_STATUSES   :82   "Opportunities"           IN_PROGRESS
    LEAD_STATUSES          :84   (lead statuses)           DRAFT
    WITHDRAWN_STATUSES     :86   (withdrawn)               WITHDRAWN

**Verify this before you cite it**, then say what you found in the PR body: at measurement each of
the five had exactly one reference in the repo - its own declaration line - and
`DEFAULT_FOLLOWUP_TOGGLES` / `ALL_FOLLOWUP_TOGGLES` in the helpers had no production caller either,
only the two assertions in `crm-s8-register-helpers.test.ts`. Someone wrote the vocabulary for this
control and the control never arrived.

Build the group with the four labels in the mock-up's order, using those Sets as the predicate.
`WITHDRAWN_STATUSES` has no toggle in the mock-up; leave it declared and say in the PR body which
group, if any, it belongs to. This is a **status** filter and is independent of the four
next-action toggles - the two groups compose, they do not replace each other.

**3. The Type chip column, on Follow-ups only.**

Follow-ups renders the identical Register columns, so a Lead row and a Tender row are visually
identical on a list that deliberately spans tenders, opportunities and leads. The mock-up adds a
`Type` chip column for exactly that reason. Derive the chip from the same status Sets as item 2 -
one source of truth for "what kind of thing is this row", not two. Register keeps its own column
set; the chip is a Follow-ups column.

Mark the component with `CRM_FOLLOWUPS_V2`.

## Do NOT

- **Do not touch the architecture that already landed.** It is Marco's decisions 1-8 from
  `crm-build-order-plan.md` and every one of them shipped correctly:
  - the three CRM nav items and their order - Accounts, Tenders, Comms hub
    (`ShellLayout.tsx:250-277`);
  - the tab sets and their order, and the `?tab=` URL contracts that drive them. The outer
    `TendersPage.tsx` bar owns Register / Follow-ups and passes `activeTab` in as a prop; this page
    renders no tab bar of its own (`:704-709` records why) and must not grow one back;
  - the anchor picker's six types and their order - Lead, Tender, Job, Account, Contract, Other
    (`AnchorPicker.tsx:28-33`);
  - log-to-next-action as a single write (`comms.service.ts:403-448`);
  - preview-then-confirm on bulk client linking.
- **Do not split Register and Follow-ups into two lists, two fetches or two components.** One list,
  toggleable filters. That is decision 6 and it is the thing this screen got right.
- Do not reorder the four next-action toggles, change their defaults, or change `DUE_SOON_MS`.
- **Do not add, change or remove any API route, service method, DTO or schema field.** Every figure
  in this slice is derived client-side from rows already loaded. If you find yourself wanting an
  endpoint, say `NO-OP: <figure> cannot be derived from the loaded rows - needs an API slice first`
  and stop on that figure.
- Do not change the columns Register renders - that was slice 1 and is settled.
- Do not touch `AccountsListPage.tsx`, `AccountDetailPage.tsx` or any other CRM page.
- Do not touch `/sot/`, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] Paste the four KPI card labels and their four figures for a seeded set, and state the row count
      of the list beneath them. Change one filter and give both again, showing they moved together.
- [ ] State the two windows as figures: the `Due soon` toggle window and the `Due this week` card
      window. Confirm `DUE_SOON_MS` is byte-identical before and after.
- [ ] Report the reference count for each of `WON_LOST_STATUSES`, `SUBMITTED_STATUSES`,
      `OPPORTUNITY_STATUSES`, `LEAD_STATUSES`, `WITHDRAWN_STATUSES` before this slice and after.
      Paste the grep you ran.
- [ ] State the entity-type toggle labels in rendered order, and the row count with each one on
      alone. State which group `WITHDRAWN_STATUSES` belongs to, or that it belongs to none.
- [ ] Turn on one entity-type toggle and one next-action toggle together and give the row count,
      showing the two groups compose rather than override.
- [ ] State the Follow-ups header row as one line, and the Register header row as one line, and
      confirm the Type chip is on the first and not the second.
- [ ] State that the four next-action toggles are unchanged in order and default, and that the page
      still renders no inner tab bar.
- [ ] Grep the diff for hex colour literals and report zero. Both themes checked.
- [ ] `git diff --name-only` lists only the three files in `scope:`.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
