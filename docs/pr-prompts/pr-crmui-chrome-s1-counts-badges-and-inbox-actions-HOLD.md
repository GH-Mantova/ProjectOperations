---
premise: '! grep -q "CRM_CHROME_V1" apps/web/src/components/ShellLayout.tsx'
premise_means: >-
  The sidebar renders the three CRM items as bare labels - no count badges and no tab rows beneath
  them - because NavItem types badge as only "safety" or "compliance". The six CRM tabs render bare
  labels with no counts. And the Comms Inbox offers only Price it and Don't pursue, while Archive
  with a governed reason and Delete-when-empty already ship on /tenders/leads.
scope:
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/pages/crm/AccountsPage.tsx
  - apps/web/src/pages/crm/TendersPage.tsx
  - apps/web/src/pages/crm/CommsPage.tsx
  - apps/web/src/pages/crm/CommsInboxTriage.tsx
  - apps/web/src/components/__tests__/ShellLayout.crm-chrome.test.ts
done_when: pnpm build && pnpm lint && grep -q "CRM_CHROME_V1" apps/web/src/components/ShellLayout.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
cluster: crm-chrome
cluster_order: 1
rollback_strategy: >-
  Web-only: the shell, the three CRM tab shells, one triage list and a test. No API route, no DTO,
  no schema, no migration, no new dependency. The archive and delete work is a mount of components
  and client functions that already exist and are already used on /tenders/leads. Revert and the
  sidebar, the tabs and the Inbox render exactly as today.
---

# The chrome around the CRM screens: counts, badges, and the two missing Inbox actions

First slice of the CRM chrome corrections. Approved mock-up:
`https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c` - artboards `Nav.dc.html`
("Nav - three items, tabs inside") and `Intake.dc.html` ("Comms hub . Inbox").

Measured 2026-09-04 against the working tree, mock-up read artboard by artboard. Three things that
look unrelated are all the same thing - the chrome around the screens, which
`docs/plans/crm-build-order-plan.md` never described because it distilled the mock-up to eight
architectural decisions and stopped there. **The mock-up is the specification.**

## What to build

**1. Nav count badges and in-sidebar tab rows.** The mock-up's whole nav artboard is those two
things. Under `CRM` it draws:

| item | badge | tab row beneath |
|---|---|---|
| Accounts | none | List, Relationships |
| Tenders | `7` on `#F59E0B`, black text | Register, Follow-ups |
| Comms hub | `15` on `#EF4444`, white text | Inbox, Threads, To-dos |

Shipped renders neither. `NavItem.badge` is typed `"safety" | "compliance"`, so the type has to
widen before a CRM badge can exist at all.

Everything else is already built and must be reused, not rebuilt:

- `SidebarPill` already takes `tone: "danger" | "warning"` - `warning` is `#f97316`, `danger` is
  `#dc2626`. Tenders uses `warning`, Comms hub uses `danger`, matching the mock-up's amber and red.
  `SidebarPill` already renders nothing at zero.
- `SidebarSafetyBadge` is the pattern for the fetcher: gate on the permission with `can(user, ...)`,
  poll every 5 minutes, swallow fetch errors, render nothing when not allowed. Follow it exactly.
  The CRM gate is `crm.view` - the single read gate across the module.

The mock-up states what each badge counts. **Comms hub = untriaged + overdue to-dos**: the `total`
from `GET /crm/intake/open?limit=1` plus the `total` from
`GET /crm/comms/tasks?assigneeId=<current user>&overdueOnly=true&limit=1`. `overdueOnly` already
exists on that route (`comms.controller.ts`; `comms.service.ts` applies `dueAt < now` with status in
`OPEN`/`IN_PROGRESS`). **Tenders = overdue count**: the register classifies a tender as overdue from
the earliest open `TENDER`-anchored task, so count the DISTINCT `entityId` values among
`GET /crm/comms/tasks?entityType=TENDER&status=OPEN&limit=200` whose `dueAt` is in the past - the
same request and the same 200-row cap `TendersRegisterPage.tsx` already uses, so the badge and the
page cannot disagree.

For the tab rows, add an optional list of `{ label, to }` to `NavItem` and render it indented under
the item, pointing at the exact `?tab=` URLs the three shells already accept
(`/crm/accounts`, `/crm/accounts?tab=relationships`, `/crm/register`, `/crm/register?tab=follow-ups`,
`/crm/comms`, `/crm/comms?tab=threads`, `/crm/comms?tab=todos`). The active tab takes the accent
colour. Hide the tab rows when the sidebar is collapsed.

**2. Tab counts on the three shells.** The mock-up paints six, in two treatments:

- plain grey figures: `List 214`, `Register 183`, `Threads 12`, `To-dos 18`
- coloured pills for the attention counts: `Follow-ups 7` amber on black text, `Inbox 15` red on
  white text

`Relationships` carries no count in the mock-up. Do not invent one.

Every source is an existing route that already returns a `total`:

| tab | source |
|---|---|
| List | `GET /crm/accounts?limit=1` |
| Register | `GET /tenders?pageSize=1` |
| Follow-ups | the distinct-overdue-tender derivation from item 1 |
| Inbox | `GET /crm/intake/open?limit=1` |
| Threads | `GET /crm/comms/threads?limit=1` |
| To-dos | `GET /crm/comms/tasks?assigneeId=<current user>&limit=1` |

Render the label alone while the count is loading or if the request fails. A tab must never break
because a count did not arrive.

**3. Archive and Delete in the Comms Inbox - a reuse, not a build.** The mock-up puts
`[Archive] [Don't pursue] [Price it]` on every untriaged row in that order, `[Delete]` alone on an
empty lead, and two explanatory panels: *"Archive - needs a reason ... Same governed list as 'Don't
pursue', so the reasons stay reportable. Restorable at any time"* and *"Delete - only when empty ...
Offered only on a lead with no description, contact, account, value, thread or drop reason"*. This is
Marco's decision 8. Shipped renders `Price it` and `Don't pursue` only.

**The functionality already exists. It shipped on `/tenders/leads` instead.** Every piece is on
main:

- `LeadsTriageList.tsx` renders `Archive` on a triage row and `Delete` on an archived row behind an
  `isEntryEmpty` predicate.
- `ArchiveEntryModal.tsx` collects the governed reason from `listDropReasons` - the same list
  `Don't pursue` uses - plus an optional detail.
- `crm-api.ts` exposes `archiveEntry` (`POST /crm/entries/:id/archive`), `restoreEntry` and
  `deleteEntry` (`DELETE /crm/entries/:id`).
- The reason is stored end to end: `schema.prisma` carries `archiveReasonId` on `Opportunity` with
  the `OpportunityArchiveReason` relation to `DropReason`.
- The Inbox lists the very same rows: `lead-intake.service.ts` `listOpenLeads` queries
  `prisma.opportunity` with `isLead: true`, so an `IntakeLead.id` **is** an entry id and
  `/crm/entries/:id/...` addresses it.

So the work is: mount `ArchiveEntryModal` from `CommsInboxTriage.tsx`, add the two buttons in the
mock-up's order, and call the `crm-api` functions that are already there. **Do not build a second
archive path.** No new modal, no new reason list, no new route, no second copy of the empty-entry
rule.

The server owns the delete guard: `DELETE /crm/entries/:id` returns 400 and names the blocking field
when the entry has a description, contact, account, `estimatedValue`, `dropReason`,
`convertedTender` or any anchored comms thread. `IntakeLead` does not carry all of those fields -
it has `notes`, `contact`, `account` and `dropReason` but no `estimatedValue` and no
`convertedTender`. So offer `Delete` only when every field you can see is empty, and surface the
server's 400 message on the row when it refuses. The server is the final word; the client is a hint.

**4. The Inbox list header, and the sort promise.** The header reads `Open leads - page N of M`. The
mock-up reads `Untriaged . oldest first`. Change the wording **and keep the promise**: today the
order is not oldest-first. `listOpenLeads` sorts
`[{ nextActionAt: asc, nulls last }, { createdAt: "desc" }]` - newest first on the tiebreak. This
slice is web-only and must not change the service, so sort the page's rows oldest-`createdAt`-first
before rendering and **say plainly in the PR body that the sort is within the page, not across
pages, until an API slice adds an order parameter.** A promise in a header that the data does not
keep is worse than no header.

**5. The anchor filter that silently does nothing.** `accountIdFilter` is set only when the picked
type is `ACCOUNT`; picking Tender, Job or Contract leaves it `undefined`, so the list does not
filter and the "Filtered by account" chip does not appear - the user gets no signal either way.
`listOpenLeads` accepts `ownerId`, `accountId`, `captureChannel` and `search` and nothing else, so
there is no parameter to call for the other types. Say so in the filter row when a non-account type
is picked. Do not invent a query parameter.

**6. Export the count and row-action logic as pure functions and test those.** The web workspace has
no `@testing-library` or jsdom setup - every existing web test is pure logic, and
`LeadsTriageList.archive.test.tsx` says so in its header comment. So export, and test:

- the distinct-overdue-tender count over a set of task rows, including two overdue tasks on one
  tender counting once, and a task with a null `dueAt` counting zero.
- the Comms badge sum, including the zero case.
- the predicate that decides whether a lead row shows `[Archive] [Don't pursue] [Price it]` or
  `[Delete]`, covering a lead with notes only, with a contact only, and with nothing at all.
- the oldest-first sort over rows with equal and null timestamps.

Mark `ShellLayout.tsx` with `CRM_CHROME_V1`.

## Do NOT

- **Do not touch the architecture that already landed.** The three CRM nav items and their order
  (Accounts, Tenders, Comms hub), the tab sets and their order (List / Relationships,
  Register / Follow-ups, Inbox / Threads / To-dos), and the `?tab=` URL contracts are Marco's
  decisions 1-8 in `docs/plans/crm-build-order-plan.md` and they shipped correctly. Add no fourth
  item, reorder nothing, rename nothing.
- **Do not turn a CRM nav item into a collapsible parent.** `NavSubGroup` exists for other groups;
  decision 2 and the mock-up both say nesting happens as tabs inside the page, never as a
  collapsible sidebar parent. The tab rows are labels beneath a flat item, not children of a toggle.
- **Do not change anything on `/tenders/leads`.** `LeadsTriageList.tsx`,
  `LeadsTriageList.helpers.ts`, `CrmBoardPage.tsx` and `ArchiveEntryModal.tsx` are reused exactly as
  they are - not moved, not renamed, not edited, and none of them is in `scope:`. If a component
  seems to need a prop it does not have, mount it differently; do not edit it.
- Do not fold intake's triage actions into the comms module (decision 3). `CommsInboxTriage.tsx`
  keeps calling `/crm/intake/*` for `Price it` and `Don't pursue`. Archive and delete are entries
  calls made from intake's own screen, which does not cross that boundary - comms still imports
  nothing from Tender or Job.
- **Do not add, change or remove any API route, service method, DTO or schema field.** If a count
  you want has no existing source, render the label without it and name the gap in the PR body.
- Do not touch the anchor picker's six types, the log-and-set-next-action single write, or the
  bulk-link preview-then-confirm flow.
- Do not touch `/sot/`, the API, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] State the `NavItem.badge` type before and after, and confirm the safety and compliance badges
      still render unchanged.
- [ ] Give both CRM badge figures as rendered, and for each name the request or requests they came
      from. Confirm each renders nothing at zero.
- [ ] List all six tab labels with the count each renders, and say which two are pills and which
      four are plain figures. Confirm `Relationships` has no count.
- [ ] Archive a lead from the Inbox. State the reason label chosen, and confirm the row is gone from
      the Inbox and the reason is readable back on the entry.
- [ ] Attempt `Delete` on a lead that has notes. State the server's message verbatim and confirm it
      is shown on the row.
- [ ] State the Inbox header text before and after, and the `createdAt` of the first and last row on
      page 1 after the change, to show the page is oldest-first.
- [ ] Pick a Tender in the anchor picker on the Inbox tab. State what the filter row now says.
- [ ] Confirm no file under `/tenders/leads`' component set was modified: name the files you touched
      and check them against `scope:`.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
