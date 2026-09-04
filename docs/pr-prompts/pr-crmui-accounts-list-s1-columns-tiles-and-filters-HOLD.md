---
premise: '! grep -q "CRM_ACCOUNTS_LIST_V2" apps/web/src/pages/crm/AccountsListPage.tsx'
premise_means: >-
  The Accounts list ships eight columns in an order the approved mock-up does not have. The Owner
  column is missing entirely and the API summary query does not even read an owner, so it cannot be
  rendered without an API read change. Two of the four stat tiles measure something the mock-up does
  not ask for, and the two that were replaced are the two that say there is work to do. There is no
  filter row and no search box over an unpaginated table of every non-archived account.
scope:
  - apps/web/src/pages/crm/AccountsListPage.tsx
  - apps/api/src/modules/crm/accounts/accounts.service.ts
  - apps/web/src/pages/crm/__tests__/crmui-accounts-list-s1.test.ts
done_when: pnpm build && pnpm lint && grep -q "CRM_ACCOUNTS_LIST_V2" apps/web/src/pages/crm/AccountsListPage.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
cluster: crm-accounts-list
cluster_order: 1
rollback_strategy: >-
  One web page, one API read method, one test. The API change is additive to a read-only SELECT
  (listAccountSummaries) - no write path, no schema, no migration, no new dependency. Revert and the
  list renders exactly as it does today.
---

# The Accounts list is a different screen from the one Marco approved

First slice of the Accounts-list cluster. Approved mock-up:
`https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c` ("CRM Module Mock-up")

Measured 2026-09-04 against `origin/main`, mock-up read in full and compared cell by cell. The
architecture under this screen is correct and must not move: the CRM nav group is three flat items
(Accounts, Tenders, Comms hub), the Accounts tab bar is List / Relationships driven by `?tab=`, and
each row links to the Account 360 page. What was never in scope for any of the seventeen CRM slices
is the composition of the screen itself. `docs/plans/crm-build-order-plan.md` distilled the mock-up
to eight architectural decisions and called itself "the last mile"; the words column, tile, panel and
layout appear in it only as database columns and as the filename `ShellLayout.tsx`. This slice puts
screen composition in scope. The mock-up is the specification.

## What to build

**1. Put the columns in the mock-up's sequence.**

    MOCK-UP:  Account (name + ABN sub-line) | Lifecycle | Owner | Open opps | Win rate |
              Last contact (GOING COLD chip inside this cell) | [Log contact]
    SHIPPED:  Name | Type | Lifecycle | Win rate | Open opps | Last contact | Status | [Log contact]

The shipped header cells are `AccountsListPage.tsx:732-739`. Five things are wrong at once:

- **Owner is missing entirely.** See item 2 - it needs an API read change first.
- **Type** and **Status** are extra. The mock-up carries neither as a column. Remove both header
  cells and both body cells. Type is not lost information: it is on the Account 360 page.
- **Win rate and Open opps are swapped.** The mock-up puts Open opps first.
- **The GOING COLD chip has been given its own `Status` column.** The mock-up puts the chip
  *inside* the Last-contact cell, under the relative date, because the chip is a statement about
  that date. Move it there and remove the `Status` column that exists only to hold it. The
  going-cold rule itself is settled and must not be re-derived: `CRM_COLD_V2` in `crm-cold.ts`
  (60 days, null counts as cold).
- **The ABN sub-line under the account name is missing.** See item 2.

**2. Two additive reads in `listAccountSummaries`, and a `NO-OP:` stop if either is absent.**

`accounts.service.ts:550` `listAccountSummaries()` builds the row the page renders. Its
`account.findMany` select (`:552` onward) reads `id`, `lifecycleStatus`, `accountType`, a
`client` sub-select of `name` and `winRate` only, an opportunity `_count`, contact
`lastContactedAt` and the newest relationship note. It reads **no owner and no ABN**. Add exactly
two things to that select and to the `AccountSummary` return type, and mirror them on
`AccountSummaryRow` (`AccountsListPage.tsx:29`):

- `owner: { select: { id: true, firstName: true, lastName: true } }` - the same shape
  `accountInclude()` already uses at `accounts.service.ts:629`, so this is a copy, not a design.
  `Account.ownerId` is on the model (`schema.prisma:7642`) with an index at `:7663`.
- `abn: true` inside the existing `client` sub-select. `Client.abn` is on the model
  (`schema.prisma:819`).

If either field is genuinely absent from the Prisma model when you look, do not invent it: say
`NO-OP: Account owner / Client.abn not on the model - needs a schema slice first` and stop. This is
a read-only addition to one SELECT. **No write path, no DTO change, no new route.**

**3. Replace the stat tiles with the mock-up's four, each with its sub-line.**

    MOCK-UP:  Accounts | Open opportunities | Going cold (no contact in 60 days) |
              Unlinked clients (no account row yet)
    SHIPPED:  Total accounts | Active | Prospects | Going cold          (AccountsListPage.tsx:645-648)

Two of the four are different metrics, and the two that were replaced - Active and Prospects - are
counts of a steady state, while the two the mock-up asks for tell an estimator there is work to do.
None of the shipped tiles carries a sub-line; all four of the mock-up's do. Every figure is already
in the component:

- Accounts = `rows.length`.
- Open opportunities = sum of `row.openOpportunitiesCount`.
- Going cold = the existing `goingColdCount`, sub-line "no contact in 60 days" taken from
  `CRM_COLD_V2.THRESHOLD_DAYS`, never as a literal 60.
- Unlinked clients = the existing `unlinkedCount` state, already fetched from
  `/crm/accounts/link-preview` at `:519`.

**Leave the unlinked-clients banner at `:653` exactly as it is.** It is the call to action; the tile
is the count. They are not duplicates and the banner is not this slice's to touch.

**4. Add the filter row the mock-up has above the table.** Three controls, left to right:
`Search accounts` (free text over account name), `Lifecycle: All`, `Owner: All`. Filter client-side
over the rows already loaded - `listAccountSummaries` returns every non-archived account in one
unpaginated query, so the whole list is in memory and a server round-trip would be a second source
of truth. Today the screen has no search input at all: the only `placeholder` attributes in the file
are on the new-account notes box (`:262`) and the log-contact notes box (`:461`).

The Owner filter is populated from the owners now present on the rows - it is a distinct-values list
off data the page holds, **not** a user directory. Do not fetch `/users` or `/admin/users` for it:
both require `users.view`, which a CRM user does not have, and `crm-build-order-plan.md:127-129`
rules that out programme-wide.

**5. Header actions.** The mock-up has `Export`. The shipped header has `Refresh` (`:601`), which
the mock-up does not have, beside `+ New account`, which it does. Add `Export` - a client-side CSV
of the currently filtered rows, in the rendered column order - and remove `Refresh`.

Mark the component with `CRM_ACCOUNTS_LIST_V2`.

## Do NOT

- **Do not touch the architecture that already landed.** It is Marco's decisions 1-8 from
  `crm-build-order-plan.md` and every one of them shipped correctly:
  - the three CRM nav items and their order - Accounts, Tenders, Comms hub
    (`ShellLayout.tsx:250-277`);
  - the tab sets and their order on all three pages, and the `?tab=` URL contracts that drive them
    (`AccountsPage.tsx`, `TendersPage.tsx`, `CommsPage.tsx`, all marked `CRM_NAV_TABS`);
  - the anchor picker's six types and their order - Lead, Tender, Job, Account, Contract, Other
    (`AnchorPicker.tsx:28-33`);
  - log-to-next-action as a single write;
  - preview-then-confirm on bulk client linking (`AccountLinkPreview.tsx`, reached from the banner).
- **Do not change any write path.** No POST, PATCH or DELETE route may be added, changed or
  re-pointed. The Log-contact modal on this page posts to `/crm/relationships/notes` (`:398`);
  leave that call and its body builder alone.
- Do not add a route, a DTO or a schema field. Item 2 is two field names inside one existing
  read-only SELECT and nothing else.
- Do not re-derive the going-cold rule. Import `CRM_COLD_V2`; do not write 60 anywhere.
- Do not touch `AccountDetailPage.tsx`, `TendersRegisterPage.tsx`, `RelationshipsPage.tsx` or any
  other CRM page - those are separate clusters.
- Do not touch `/sot/`, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` and `pnpm --filter @project-ops/api test` green.
- [ ] State the header row as one line, before and after. The "after" line must read exactly:
      `Account | Lifecycle | Owner | Open opps | Win rate | Last contact | (log)`. State the column
      count before and after (8 -> 7) and name the two that went (Type, Status).
- [ ] State that the GOING COLD chip now renders inside the Last-contact cell, and that the page no
      longer has a `Status` column. Give the `<th>` line numbers before and after.
- [ ] Paste the four tile labels and their four sub-lines as rendered. Give the four figures for a
      seeded account set, and say which two tiles replaced which two.
- [ ] Show the diff of the `listAccountSummaries` select. It must add `owner` and `client.abn` and
      change nothing else. State that no write path, route or DTO changed.
- [ ] Type "north" into Search accounts against a seeded list; state the row count before and after.
      Set Lifecycle and Owner each away from All; state the row count each time.
- [ ] Export downloads a CSV whose header line matches the rendered column order. Paste that line.
- [ ] Grep the diff for the literal `60` and report zero; grep it for hex colour literals and
      report zero.
- [ ] State that the three CRM nav items, the Accounts tab bar and the `?tab=` contract are
      untouched, and that `git diff --name-only` lists only the three files in `scope:`.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
