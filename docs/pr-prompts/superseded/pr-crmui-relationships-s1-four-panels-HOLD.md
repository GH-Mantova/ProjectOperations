---
premise: '! grep -q "CRM_RELATIONSHIPS_V2" apps/web/src/pages/crm/RelationshipsPage.tsx'
premise_means: >-
  The Relationships screen draws its own tab bar and shows one panel at a time, so a second tab bar
  stacks under the Accounts tab bar on /crm/accounts?tab=relationships and the approved mock-up's
  four-panel dashboard does not exist. The log form has no contact picker, going cold is a
  five-column table with no win rate, and repeat business is a seven-column table with no visual
  ranking.
scope:
  - apps/web/src/pages/crm/RelationshipsPage.tsx
  - apps/web/src/pages/crm/__tests__/crm-relationships-panels.test.ts
done_when: pnpm build && pnpm lint && grep -q "CRM_RELATIONSHIPS_V2" apps/web/src/pages/crm/RelationshipsPage.tsx
size: 7
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
cluster: crm-relationships
cluster_order: 1
rollback_strategy: >-
  Web-only, one page component plus its test. No API route, no DTO, no schema, no migration, no new
  dependency. Every call it makes is a GET or POST that already exists and is already used by this
  page or by the Accounts index. Revert and the page renders its three tabs exactly as today.
---

# Relationships is four panels on one screen, not three tabs

First slice of the CRM screen-composition corrections. Approved mock-up:
`https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c` - artboard
`Relationships.dc.html`, titled "Accounts . Relationships".

Measured 2026-09-04 against the working tree, mock-up read artboard by artboard. All seventeen CRM
slices landed and the architecture is right: three nav items, tabs inside the page, one URL contract
per tab. What did not land is the screen composition, because `docs/plans/crm-build-order-plan.md`
distilled the mock-up to eight architectural decisions and never mentioned columns, tiles, panels or
layout. **The mock-up is the specification.** This is the largest single divergence in the module.

The mock-up draws ONE screen: a two-column grid, four panels, all visible at once. Shipped is a
second tab bar with three mutually exclusive tabs, so two tab bars stack on
`/crm/accounts?tab=relationships` (the outer one in `AccountsPage.tsx`, the inner one at
`RelationshipsPage.tsx`) and you can only see one panel at a time. The at-a-glance dashboard is
gone.

## What to build

**1. One screen, four panels.** The mock-up's container is
`display: grid; grid-template-columns: 1fr 1fr`, each column a vertical stack of two cards:

| | left column | right column |
|---|---|---|
| top | Log a contact | Going cold |
| bottom | Recent notes | Repeat business |

Delete the `Tab` type, the `activeTab` state, the `tabStyle` helper and the three tab buttons.
`NotesPanel` splits into the log form (top-left) and the notes list (bottom-left); `GoingColdPanel`
and `RepeatBusinessPanel` keep their data loading and become the two right-hand cards. All four
fetch on mount, not on tab change.

**2. Make the title agree with the tab that opens it.** The page `<h1>` reads
"Relationship intelligence" while the tab in `AccountsPage.tsx` says "Relationships" - the tab and
the page disagree about which page you are on. The mock-up's heading is `Accounts` with the sub
"Who we've spoken to, who's drifting, and who keeps coming back." Use exactly that.

**3. Add the contact picker to the log form, marked optional.** The mock-up puts `Account *` and
`Contact  optional` side by side above the note body. Today there is an account `<select>` and a
textarea and nothing else, so you can record which company you spoke to but never who.

Nothing on the server needs to change for this:

- `POST /crm/relationships/notes` already accepts an optional `contactId`
  (`relationships.controller.ts`, the create DTO; `relationships.service.ts`, `CreateNoteInput`).
- `buildCreateNoteBody` in this file already takes `contactId` and defaults it to `null`. The call
  site simply never passes one.
- Contacts for the picker come from `GET /crm/accounts/:id/360`, gated on `crm.view` like this page
  (`accounts.controller.ts`), which returns each contact's `id`, `firstName`, `lastName`, `role` and
  `email`. Fetch it when an account is chosen; clear the contact when the account changes.

**This is not cosmetic.** `createNote` writes `contact.lastContactedAt` **only** when a `contactId`
is supplied - the service's own comment says "Update lastContactedAt on the contact if provided" -
and the going-cold query selects accounts by `contacts.lastContactedAt` older than the threshold.
So today, logging a note against an account can never take it off the going-cold list. Adding the
picker is what makes the mock-up's helper line - "Logging a contact advances **Last contact** on the
account" - true.

**4. Going cold becomes cards.** Shipped is a five-column table:
`Account | Status | Owner | Cold contacts | Cold since`. The mock-up draws one row per account:
account name on the left, a second line reading `18% win rate . 3 tenders`, and a days chip on the
right (`8 months`, `71 days`, `64 days`). The win-rate figure is the "is this worth chasing?"
number and it is absent today.

The going-cold payload does not carry it: `relationships.service.ts` includes
`client: { id, name, code, isActive }` and nothing else. Do **not** add a field to that route. Get
it web-side instead - this page already fetches `GET /crm/accounts/summary` for the account picker,
and that response carries `winRate` and `openOpportunitiesCount` per account id
(`accounts.service.ts`, `listAccountSummaries`). Lift that fetch to page level, key it by account
id, and render `<win rate> win rate . <n> open opps`, which is the wording two of the mock-up's
three cards use. Render win rate through the shared `formatWinRate` helper - the file's own comment
records that a private copy once rendered 20000%; do not introduce a second one. Where an account is
absent from the summary response, render the name and the days chip alone.

The mock-up's third figure on the first card reads `3 tenders`. There is no list-shaped source for a
per-account tender count today (`GET /crm/accounts/:id/360` has one, but only one account at a
time). Do not add a route and do not fire one request per row. Render the open-opportunity count
and **name the missing tender count in the PR body as a gap needing an API slice.**

**5. Repeat business becomes bars.** Shipped is a seven-column table:
`Account | Status | Owner | Wins | Tenders | Win rate | Last won`. The mock-up draws a horizontal
bar chart - a fixed-width name, a proportional bar, and a right-aligned `24 won` figure. Width is
the account's `winCount` as a percentage of the largest `winCount` in the set. Every figure is
already on the `/crm/relationships/repeat-business` payload. Use `var(--color-teal, #005B61)` for
the bar fill, as `CrmBoardPage.tsx` already does.

**6. Keep the threshold selector where it is.** The mock-up puts `60 days` with a chevron in the
Going cold card header, right-aligned against the title. That is what shipped, with 30/60/90
options. Move it into the card header; change nothing about its behaviour.

**7. Export the layout decisions as pure functions and test those.** The web workspace has no
`@testing-library` or jsdom setup - every existing web test is pure logic, and
`LeadsTriageList.archive.test.tsx` says so in its header comment. So export, and test:

- `buildCreateNoteBody` with a contact id supplied (it already exists; add the case).
- a builder that turns a going-cold row plus the summary map into the card's three fields, including
  the case where the account is missing from the summary map.
- a builder that turns the repeat-business rows into `{ name, winCount, barPercent }`, including the
  single-row case and the all-zero case (no division by zero).

Mark the component with `CRM_RELATIONSHIPS_V2`.

## Do NOT

- **Do not touch the architecture that already landed.** The three CRM nav items and their order
  (Accounts, Tenders, Comms hub), the tab sets and their order (List / Relationships,
  Register / Follow-ups, Inbox / Threads / To-dos), and the `?tab=` URL contracts are Marco's
  decisions 1-8 in `docs/plans/crm-build-order-plan.md` and they shipped correctly. This slice
  removes the page's OWN inner tab bar and nothing else about navigation.
- **Do not make the account optional.** The picker is required today because the service rejects a
  note with both `accountId` and `contactId` null, and the mock-up's amber strip asked for exactly
  this fix. `canSubmit` must keep requiring a selected account. The contact is the optional one.
- Do not drop or narrow the 30/60/90 threshold options, and do not redeclare the default - it comes
  from `CRM_COLD_V2.THRESHOLD_DAYS` so the tab and the KPI tile agree.
- **Do not add, change or remove any API route, service method, DTO or schema field.** If you find
  yourself wanting a field the payload does not carry, name it in the PR body and render without it.
- Do not re-point the log form at `POST /crm/comms/log-contact`. That is the Tenders register's
  log-and-set-next-action single write (decision 7) and it anchors on a tender or opportunity, not
  an account. Two different writes, two different screens.
- Do not touch the anchor picker's six types, the bulk-link preview-then-confirm flow, or any file
  outside `scope:`. Do not touch `/sot/`.
- Do not add a second win-rate formatter, a second going-cold threshold constant, or a second note
  body builder.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] State the number of tab bars rendered on `/crm/accounts?tab=relationships` before and after
      (2 -> 1), and the number of panels visible at once before and after (1 -> 4).
- [ ] Save a note with a contact selected. State the contact's `lastContactedAt` before and after
      the save, and state the account's going-cold status before and after.
- [ ] Give one going-cold card's rendered figures verbatim: account name, win rate as displayed,
      the count and its label, and the days chip. Confirm the win rate is not multiplied twice.
- [ ] Give the repeat-business bar figures for the top two accounts: `winCount` and `barPercent` for
      each, and confirm the top bar is 100%.
- [ ] State the page `<h1>` text after the change and confirm it matches the tab label's subject.
- [ ] Report every hex literal you added and what it is for. The bar fill must be
      `var(--color-teal, #005B61)`.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
