---
premise: '! grep -q "CRM_ACCOUNT360_V2" apps/web/src/pages/crm/AccountDetailPage.tsx'
premise_means: >-
  The Account 360 page opens with no KPI tile row. The five metrics it does show are different
  metrics, buried inside the Client-identity card below the fold, and Value, Jobs, Contracts and Last
  contact are not shown at all. There is no Next-action card anywhere on the page - the words appear
  zero times in the file - so the account has no answer to "what do I owe this client", which is the
  thing the whole Follow-ups concept rests on.
scope:
  - apps/web/src/pages/crm/AccountDetailPage.tsx
  - apps/web/src/pages/crm/__tests__/crmui-account360-s1.test.ts
done_when: pnpm build && pnpm lint && grep -q "CRM_ACCOUNT360_V2" apps/web/src/pages/crm/AccountDetailPage.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
cluster: crm-account-360
cluster_order: 1
rollback_strategy: >-
  Web-only, one page plus its test. Every figure is derived from the Account 360 payload the page
  already fetches - no API, no schema, no migration, no new dependency. Revert and the page renders
  exactly as it does today.
---

# The Account 360 page has the right skeleton and none of the mock-up's furniture

First slice of the Account-360 cluster. Approved mock-up:
`https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c` ("CRM Module Mock-up")

Measured 2026-09-04 against `origin/main`, mock-up read in full and compared region by region.

**Start with what is right, because it is the closest match in the module.** The six roll-up tabs -
`Activity | Contacts | Tenders | Jobs | Contracts | Opportunities` - are an **exact match** to the
mock-up, in the mock-up's order, each carrying a count (`AccountDetailPage.tsx:661-698`). Say so in
the PR body. This slice adds furniture around that skeleton and must not disturb it.

## What to build

**1. The KPI tile row, directly under the account name.**

    MOCK-UP:  Tenders 47 | Value $18.4M | Win rate 41% | Jobs 12 | Contracts 5 | Last contact 4d
    SHIPPED:  a five-metric strip inside the Client-identity card, below the fold -
              Outcomes recorded | Wins | Win rate | Last tender | Last won   (:628-654)

Only `Win rate` is common to both. Value, Jobs, Contracts and Last contact are not shown anywhere on
the page. Build the six tiles as a row under the header, in the mock-up's order. Four of the six are
exact from the payload the page already has; two need care, and one of those has a stop:

- **Tenders** = `rollUps.tenderTotal`. This is an uncapped count (`accounts.service.ts:388-391`) -
  use it, **not** `rollUps.tenders.length`, which is capped at 20.
- **Win rate** = `client.winRate` through the existing `formatWinRate` import.
- **Jobs** = `rollUps.jobs.length`, but the server takes only 20 (`accounts.service.ts:372-386`), so
  the tile silently reads 20 for an account with 40 jobs. **Do not print a wrong number.** Either
  label the tile as capped when the array is at the cap, or say
  `NO-OP: no uncapped job count on the Account 360 payload - needs an API read slice first` and leave
  that one tile out. Same rule for **Contracts** = `rollUps.contracts.length`, capped at 50
  (`accounts.service.ts:496-497`). State which of the two options you took, per tile.
- **Last contact** = the newest of `rollUps.relationshipNotes[0].createdAt` and
  `rollUps.commThreads[0].createdAt`. Both lists are ordered `createdAt desc` server-side
  (`accounts.service.ts:424`, `:444`), so the first element of each is the true newest even though
  the lists are capped - this figure is exact. Render it as the mock-up does, a short relative age
  (`4d`), not a date. Do not invent a second going-cold rule here; if you need the threshold, import
  `CRM_COLD_V2` from `./crm-cold`.
- **Value** has no source. The tender roll-up selects `id, tenderNumber, title, status, dueDate,
  createdAt` and no money (`accounts.service.ts:356-364`). `contractValue` and the opportunity
  `estimatedValue` are on the payload but neither is the tender value the mock-up names. Say
  `NO-OP: no tender value on the Account 360 payload - needs an API read slice first` and leave the
  tile out rather than substituting a different number under the mock-up's label.

**Leave the five-metric strip at `:628-654` where it is.** It is a different set of facts about the
client's history, it is correct, and removing it loses `Outcomes recorded`, `Wins`, `Last tender` and
`Last won`, none of which the tile row carries.

**2. The Next-action card in the right rail.**

The mock-up puts a card on the right rail reading, for example, "Re-price Northshore once addendum 3
lands", with a due chip and an owner. **The string `Next action` appears zero times in
`AccountDetailPage.tsx`.** The account can tell you everything that has happened to it and nothing
about what is owed - and the register's whole Follow-ups concept rests on that one answer.

The next action for an entity is an open `CommTask`. The register reads them from
`GET /crm/comms/tasks?entityType=...&status=OPEN` and keeps the earliest-due one per entity
(`TendersRegisterPage.tsx:426-460`) - follow that exact shape with `entityType=ACCOUNT` and this
account's id. Render the task title, a due chip classified the same way the register classifies it,
and the owner. **Reuse the classification, do not re-implement it**: `classifyNextAction` and
`DUE_SOON_MS` are exported from `tendersRegisterPage.helpers.ts`, and a second copy of that rule is
how the two screens start disagreeing. If that endpoint or its `entityType=ACCOUNT` filter turns out
not to exist, say `NO-OP: no open-task read for an account anchor - needs an API slice first` and
render nothing rather than a card that is always empty.

**3. The two-column layout.** The mock-up is a main column plus a 320px right rail; the page today is
a single stacked column of cards (`s.page`, `s.card`). Put the Next-action card in the rail. The
layout collapses to one column on a narrow viewport.

**4. Header actions and header identity.**

    MOCK-UP header actions:  Log contact  |  New thread  |  Edit account
    SHIPPED:                 Open comms ->  |  Edit        (:385-400, and on the Account card,
                                                            not the page header)

`Log contact` exists on every row of the Accounts list (`AccountsListPage.tsx:815-839`, posting to
`/crm/relationships/notes`) and does not exist on the 360 page for the same account. Add it here,
posting through the same `buildCreateNoteBody` the list uses - one body builder, not two. Map
`New thread` onto the existing anchored deep link (`Open comms ->` at `:387-392`) rather than
building a second way into the Comms hub, and relabel it to match the mock-up. Relabel `Edit` to
`Edit account`. Move all three into the page header (`:354-369`) where the mock-up has them.

The header identity is thin: the h1 carries the client name and a lifecycle badge and nothing else -
no avatar, no account type, no ABN. All three are already on the payload: `accountType` with its
label map at `:159-166`, and `client.abn` (rendered today only inside the identity card at
`:572-576`). Add them to the header. The avatar is initials from the client name; do not add an image
upload or a new dependency for it.

Mark the component with `CRM_ACCOUNT360_V2`.

## Do NOT

- **Do not touch the six roll-up tabs.** Not their set, not their order, not their counts, not their
  panels (`:658-859`). They are the exact match in this module and the reference the rest of the
  screen is being brought up to.
- **Do not touch the architecture that already landed.** It is Marco's decisions 1-8 from
  `crm-build-order-plan.md` and every one of them shipped correctly:
  - the three CRM nav items and their order - Accounts, Tenders, Comms hub
    (`ShellLayout.tsx:250-277`);
  - the tab sets and their order on the three CRM pages, and the `?tab=` URL contracts that drive
    them (all marked `CRM_NAV_TABS`);
  - the anchor picker's six types and their order - Lead, Tender, Job, Account, Contract, Other
    (`AnchorPicker.tsx:28-33`). The `Open comms` deep link anchors on `entityType=ACCOUNT` through
    that contract - relabel the control, never the contract;
  - log-to-next-action as a single write (`comms.service.ts:403-448`);
  - preview-then-confirm on bulk client linking.
- **Do not add, change or remove any API route, service method, DTO or schema field.** Every figure
  that needs one is gated behind an explicit `NO-OP:` stop above.
- Do not change the inline edit form, the archive / unarchive verbs, or the governed archive reason
  (decision 8).
- Do not remove the five-metric strip or any field on the Client-identity card.
- Do not re-implement `classifyNextAction`, `DUE_SOON_MS`, `formatWinRate` or `CRM_COLD_V2` - import
  them.
- Do not touch `AccountsListPage.tsx`, `TendersRegisterPage.tsx` or any other CRM page.
- Do not touch `/sot/`, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] Paste the tile row as rendered: each label and each figure, in order. For every tile you did
      not build, give the `NO-OP:` line and the select you checked. State for Jobs and Contracts
      which of the two options you took.
- [ ] For a seeded account, state `rollUps.tenderTotal` and `rollUps.tenders.length` side by side and
      confirm the Tenders tile shows the first.
- [ ] State the Last contact figure and the two timestamps it was derived from.
- [ ] State the six tab labels and their six counts, before and after, and confirm they are
      byte-identical.
- [ ] Paste the Next-action card as rendered - title, due chip class, owner - and the `CommTask` it
      came from. Grep the diff for a second copy of the overdue / due-soon thresholds and report
      zero.
- [ ] State that the layout is main + 320px rail at desktop width and one column at narrow width.
- [ ] State the three header actions as rendered, and confirm Log contact posts through
      `buildCreateNoteBody`. Grep the diff for a second note-body builder and report zero.
- [ ] State the header identity line as rendered: name, avatar initials, account type, ABN,
      lifecycle badge.
- [ ] Grep the diff for hex colour literals and report zero. Both themes checked.
- [ ] `git diff --name-only` lists only the two files in `scope:`.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
