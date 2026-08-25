---
premise: '! grep -q "tenderTotal" apps/api/src/modules/crm/accounts/accounts.service.ts'
premise_means: The account 360 payload carries no true count of linked tenders, so the detail page shows two different numbers both labelled "Tenders".
scope:
  - apps/api/src/modules/crm/accounts/accounts.service.ts
  - apps/api/src/modules/crm/accounts/__tests__/accounts.service.spec.ts
  - apps/web/src/pages/crm/AccountDetailPage.tsx
done_when: pnpm lint && pnpm --filter api test -- accounts.service && grep -q "tenderTotal" apps/api/src/modules/crm/accounts/accounts.service.ts
size: 3
gate_allow: none
seed_only: false
escalates: false
cluster: crm-defects
cluster_order: 2
requires_on_main: apps/web/src/pages/crm/AccountDetailPage.tsx :: formatWinRate
---

# One account page, two numbers, both labelled "Tenders"

## The defect, measured

`AccountDetailPage.tsx` renders a tender count in two places, from two different sources that answer
two different questions:

```
:351   <div>{client.tenderCount}</div>        // stat tile — cached counter
:397   <span>({rollUps[tab].length})</span>   // tab badge — live join, capped
```

- `client.tenderCount` is **not** a count of linked tenders. It increments only on an outcome
  transition — `client-stats.service.ts:36`, `mode === "first-count"`, called from four sites in
  `tendering.service.ts`. A linked tender that is still open contributes **0**.
- `rollUps.tenders` is a live join on `TenderClient` — but `accounts.service.ts:293` carries
  `take: 20`, so its `.length` **silently understates any client with more than twenty tenders**.

So neither number is a count of tenders for this account, and the page presents both under the same
word. Marco has a screenshot showing `Tenders 0` and `Tenders (2)` on one screen.

## What to build

### API — `accounts.service.ts`, inside `getAccount360`

Add a real total alongside the existing capped page of rows. **Additive only** — no existing field
changes shape or meaning:

```ts
rollUps: {
  contacts: […],
  tenders:  […],          // unchanged, still take: 20
  tenderTotal: <number>,  // NEW — prisma.tenderClient.count({ where: { clientId } })
  jobs:     […]
}
```

Use `prisma.tenderClient.count`, not `findMany(...).length` — the point is to be uncapped.
Guard the `account.clientId == null` case the same way the existing `tenders` query does (line 272)
and return `0`.

### Web — `AccountDetailPage.tsx`

1. Tab badge (line 397) reads `rollUps.tenderTotal` for the tenders tab, not `rollUps[tab].length`.
   Leave the contacts and jobs tabs reading their array lengths — they are not capped.
2. Below the tenders table, when `rollUps.tenders.length < rollUps.tenderTotal`, render a plain line:
   `Showing 20 of 22`. The cap must be **visible**, never silent.
3. Relabel the stat tile at line 350 from `Tenders` to **`Outcomes recorded`**. That is what
   `client.tenderCount` has always counted, and naming it honestly is the actual fix for the
   contradiction. Leave the value expression alone.

### Tests

In `accounts.service.spec.ts`, assert `tenderTotal` is present and is the uncapped count for an
account with more linked tenders than the page size, and that it is `0` when `clientId` is null.
**Update any existing `toHaveBeenCalledWith` assertions** the new `count` call disturbs.

## Do NOT

- Do NOT remove or raise the `take: 20` on `rollUps.tenders`. Paging is deliberate; the fix is to
  report the total beside it, not to fetch everything.
- Do NOT change `client.tenderCount`, `client-stats.service.ts`, or any stored counter. A separate
  slice owns that.
- Do NOT change the shape of `rollUps.tenders`, `rollUps.contacts` or `rollUps.jobs`.
- Do NOT restyle the page.

## Guardrails

- One attempt. If `tenderTotal` already exists, say `NO-OP: <reason>`.
- `pnpm lint` and the API tests must pass.
- Never exit silently. Never ask a question or stand by for approval — there is no human in this run.
- Read the job log before diagnosing any CI failure.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

