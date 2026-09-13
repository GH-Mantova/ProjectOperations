---
premise: "git fetch -q origin feat/ratehub-s6a-push-back-api && git show origin/feat/ratehub-s6a-push-back-api:apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts | grep -q 'tenderRateSet: null'"
premise_means: >-
  PR #1896's SorPushBackService._futureLocks queries `prisma.tender.findMany({ where: {
  tenderRateSet: null, ... } })`, but on the Prisma schema the back-relation from Tender to
  TenderRateSet is named `rateSet` (schema.prisma, model Tender: `rateSet TenderRateSet?`). The
  API build fails with TS2353 "Object literal may only specify known properties, and
  'tenderRateSet' does not exist" at sor-push-back.service.ts:438 (run 34751976411, job
  103716980193), which takes the API job and tendering-e2e down with it. One identifier.
fixes_pr: 1896
scope:
  - apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts
  - apps/api/src/modules/schedule-of-rates/__tests__/sor-push-back.service.spec.ts
done_when: >-
  ! grep -q 'tenderRateSet: null' apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts
  && grep -q 'rateSet: null' apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts &&
  pnpm --filter api build && pnpm --filter api test -- sor-push-back
size: 2
gate_allow: none
seed_only: false
escalates: true
backfill: false
module: schedule-of-rates
---

# Repair PR 1896 - the push-back service names the Tender to TenderRateSet relation wrong

**Do this ON PR #1896's existing branch `feat/ratehub-s6a-push-back-api`. Do NOT open a new PR.**
The defect is inside that PR's own diff. main is green.

## FIRST: re-verify against the CURRENT head

Read the `Validate API build` step of the **latest** tendering-e2e run (or the API job) on the
branch and confirm the error is still the single TS2353 below. If it has changed, fix what the
log shows and say so plainly.

    src/modules/schedule-of-rates/sor-push-back.service.ts:438:9 - error TS2353: Object literal may
      only specify known properties, and 'tenderRateSet' does not exist in type 'TenderWhereInput'.

## What to change

In `_futureLocks`, the `where` clause selects tenders that have NO locked rate set yet. The
relation field on `model Tender` is `rateSet` (schema.prisma: `rateSet TenderRateSet?`), so:

    where: { rateSet: null, status: { notIn: [...TERMINAL_STATUSES] } }

If the spec's Prisma mock stubs `tender.findMany` with a `where` expectation that names
`tenderRateSet`, rename it there too; otherwise leave the spec alone. Nothing else changes -
not the controller, module, markup service or registry.

## Verify, then push

1. `pnpm --filter api build` -> 0 errors.
2. `pnpm --filter api test -- sor-push-back` -> green.
3. Commit on the branch with a message that describes the change and does NOT put the words
   fix/fixes/close/closes/resolve/resolves immediately before `#1896`.
4. Push. Do not open a PR - #1896 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1896 is the PR** - push to its branch and
do not open another. There is no human in this run. **Finishing the work and then asking for
permission is indistinguishable from failing** - the work is discarded either way.

`escalates: true` is inherited from #1896 - it gates the MERGE, not the RUN.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already repaired` and exit.
- Touch only the files in `scope`.
- Never add or remove a label; never merge.
