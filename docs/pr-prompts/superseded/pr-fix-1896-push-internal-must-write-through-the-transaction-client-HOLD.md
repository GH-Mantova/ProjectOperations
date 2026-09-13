---
premise: "git fetch -q origin feat/ratehub-s6a-push-back-api && git show origin/feat/ratehub-s6a-push-back-api:apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts | grep -q 'this.prisma.rateRow.update'"
premise_means: >-
  PR #1896's own frozen-guarantee spec fails on the current head (ad57c7e1; API job 103722922440,
  1 failed / 4216 passed): "calls rateRow.update with the same id, never rateRow.create" sees
  rateRow.update called 0 times. Cause: _pushInternal uses the ARRAY form of $transaction with
  writes built on the OUTER client (this.prisma.rateRow.update, this.prisma.sorChangeLogEntry
  .createMany), while the spec hands the transaction a sub-client and asserts the write went
  through it (subPrisma.rateRow.update). The rateSet-relation fix (previous fix-lane run) already
  landed; this is the last red on the branch besides CP-26.
fixes_pr: 1896
scope:
  - apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts
  - apps/api/src/modules/schedule-of-rates/__tests__/sor-push-back.service.spec.ts
done_when: >-
  ! grep -q 'this.prisma.rateRow.update' apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts
  && pnpm --filter api build && pnpm --filter api test -- sor-push-back
size: 2
gate_allow: none
seed_only: false
escalates: true
backfill: false
module: schedule-of-rates
---

# Repair PR 1896 - the push-back writes must go through the transaction client the spec hands in

**Do this ON PR #1896's existing branch `feat/ratehub-s6a-push-back-api`. Do NOT open a new PR.**
The defect is inside that PR's own diff. main is green.

## FIRST: re-verify against the CURRENT head

Read the API job of the **latest** CI run on the branch and confirm the only failing test is
still `SorPushBackService.pushBack (INTERNAL - frozen guarantee) > calls rateRow.update with the
same id ...` with `Number of calls: 0` at spec :162. If anything else is red, fix what the log
shows and say so plainly.

## What to change

In `_pushInternal` (and `_pushVendor` if it has the same shape), replace

    await this.prisma.$transaction([
      this.prisma.rateRow.update({ ... }),
      this.prisma.sorChangeLogEntry.createMany({ ... }),
    ]);

with the interactive form the spec models and the rest of the module uses:

    await this.prisma.$transaction(async (tx) => {
      await tx.rateRow.update({ where: { id: rateRowId }, data: { cells: ..., updatedById: actorId } });
      await tx.sorChangeLogEntry.createMany({ data: changeLogEntries });
    });

Keep every guarantee the comment above that block states: the SAME rateRow.id is updated, no
create, `isActive` absent from the update data. Do not change the figures logic, the preview
path, the conflict checks or the audit write. If the spec's `makePrisma()` sub-client lacks a
method the callback now touches, add that mock in the spec - nothing else in the spec changes.

## Verify, then push

1. `pnpm --filter api build` -> 0 errors.
2. `pnpm --filter api test -- sor-push-back` -> every test green, including the frozen guarantee.
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
