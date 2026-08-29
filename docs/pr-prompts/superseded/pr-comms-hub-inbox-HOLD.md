---
premise: '! test -f apps/web/src/pages/crm/comms-inbox.helpers.ts'
premise_means: >-
  The Comms hub nav entry points at /crm/comms with no query string, and
  CommsHubPage renders only an error - "Missing entityType and entityId query
  parameters" - because all 438 of its lines assume an anchor. There is no
  unanchored inbox and no helper that turns a polymorphic (entityType, entityId)
  pair into a display label, so the nav item cannot work at all.
scope:
  - apps/web/src/pages/crm/comms-inbox.helpers.ts
  - apps/web/src/pages/crm/CommsHubPage.tsx
  - apps/web/src/pages/crm/__tests__/comms-inbox.helpers.test.ts
done_when: >-
  pnpm build && pnpm lint && pnpm test:web:logic && test -f
  apps/web/src/pages/crm/comms-inbox.helpers.ts && grep -q "deleted"
  apps/web/src/pages/crm/comms-inbox.helpers.ts && grep -q "comms-inbox.helpers"
  apps/web/src/pages/crm/CommsHubPage.tsx
size: 3
gate_allow: none
escalates: false
backfill: false
rollback_strategy: >-
  Three web files, one of them new, no API and no schema touched. Revert is a git
  revert of one commit and returns the page to today's anchored-only behaviour.
  The nav entry is not added or removed by this slice, so a revert cannot leave
  the nav pointing somewhere that did not exist before.
---

# Comms hub — give the nav entry a working unanchored inbox

## The defect, measured at `origin/main 956428bf`

`ShellLayout.tsx:259` puts **Comms hub** in the CRM nav pointing at `/crm/comms`
with no query string. `App.tsx:672` routes that to `CommsHubPage`. And
`CommsHubPage.tsx:7` states its own contract:

> `// Anchored to a CRM record via ?entityType=ACCOUNT|TENDER|JOB|CONTRACT&entityId=…`

`:106` defaults `entityId` to `""`, `:120` computes
`anchored = Boolean(entityType && entityId)`, and `:237` early-returns

> *Missing `entityType` and `entityId` query parameters. Open this page from a
> record page (Account / Tender / Job / Contract) that anchors the conversation.*

**The nav link can never work.** CRM-4 built the page as a polymorphic panel;
NAV-4 then wired it into the nav on the grounds that "route already exists".
Neither is wrong on its own — nobody reconciled them.

## The API already serves this. Do not change it.

- `comms.service.ts:114 listThreads()` — `const where = {}`, narrowed **only if**
  `entityType` / `entityId` arrive. The DTO marks both `@IsOptional()`.
- `comms.service.ts listTasks()` — same shape, and it **already** supports
  `assigneeId`, `status` and `overdueOnly`, with `@@index([assigneeId, status])`
  on the model.
- Both page at `limit` capped to 100.

So `GET /crm/comms/threads` and `GET /crm/comms/tasks` with no anchor already
return everything, paged. **This is a web-only slice. No API, DTO, schema or
migration change — if you find yourself editing `apps/api`, stop.**

## Why an inbox rather than removing the nav entry

`CommThread` and `CommTask` link to Account/Tender/Job/Contract **polymorphically
with no foreign key** — `comms.service.ts:82` says so and explains the reason
(the sub-module can branch into its own product later). The consequence is that
**deleting an Account/Tender/Job/Contract leaves its threads and tasks behind as
orphans, with no cascade and nothing to detect them.**

Every other entry point into comms is anchored to a record. For an orphan that
record no longer exists, so removing the nav entry would make those rows
permanently invisible while they keep accumulating. **The inbox is the only
surface that can ever show them.** That is the point of this slice, not a side
effect of it.

## What to build

### 1. `comms-inbox.helpers.ts` — the primary new artifact

Pure, testable functions. No React, no fetch.

- `entityLabel(entityType, entityId, resolved?)` → a display string.
  - resolved name available → `"Northshore Demolition"` with the type as a chip.
  - **not resolvable → a visible, explicit label such as `Account (deleted)`
    carrying the raw id.** Never blank, never dropped, never thrown.
  - unknown `entityType` → label it as unknown and keep the row. The field is a
    free String in the schema; do not assume it is one of the four.
- grouping / sorting helpers for the inbox list.

### 2. `CommsHubPage.tsx` — add the unanchored branch

Keep the anchored behaviour **exactly** as it is. Replace only the `:237`
early-return with an inbox:

- **Threads** — all threads, newest-activity first, each showing its entity label,
  subject, last message and time. Clicking one navigates to the existing anchored
  view via `?entityType=…&entityId=…`, so there is one conversation UI, not two.
- **My to-dos** — `listTasks` filtered to the current user via `assigneeId`, with
  the existing `status` / `overdueOnly` filters exposed.
- Paging, because the API caps at 100 per call and this is an all-records view.

### 3. The test

`apps/web/src/pages/crm/__tests__/comms-inbox.helpers.test.ts`, alongside the two
existing precedents in that directory, run by `pnpm test:web:logic`.

**It must include a fixture whose `entityId` resolves to nothing.** Assert the row
is still returned and still labelled. This is the acceptance criterion, not an
edge case: if the resolver assumes every id resolves, the inbox will crash or
silently drop rows on exactly the orphaned data it exists to surface — an
instrument reporting success while showing less than the truth, which is the
failure this codebase keeps paying for.

## Reuse, do not invent

The app already resolves polymorphic entities to labels. **Read these before
writing a resolver:** `components/RecordHistory.tsx` (takes `entityType` +
`entityId`, `:106`, `:116`), `components/Timeline.tsx`,
`components/GlobalSearch.tsx` and `components/CommandPalette.tsx` — the global
search already spans tenders, jobs and clients. Follow the established pattern.
Two resolvers for one concept is how they drift.

## What NOT to do

- Do **not** touch `apps/api`. The endpoints already do what is needed.
- Do **not** change `ShellLayout.tsx` or `App.tsx`. The nav entry and route are
  already correct; it is the page that cannot render.
- Do **not** alter the anchored path. A record page opening
  `/crm/comms?entityType=ACCOUNT&entityId=…` must behave identically after this.
- Do **not** delete, archive or "clean up" orphaned threads or tasks. Making them
  visible is this slice; deciding their fate is a separate, destructive question
  that is Marco's.
- Do **not** add a second conversation UI. The inbox lists and links; the anchored
  view remains the only place a thread is read and replied to.

## Verification

State in the PR body:

1. a screenshot of `/crm/comms` with no query string, showing the inbox;
2. a screenshot of `/crm/comms?entityType=ACCOUNT&entityId=…` proving the anchored
   view is unchanged;
3. the helper test output including the unresolvable-anchor case, quoted;
4. `git diff --name-only` showing no path under `apps/api`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
