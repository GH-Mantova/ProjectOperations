---
premise: "git fetch -q origin main feat/ew5-capacity-board-ui && git merge-tree $(git merge-base origin/main origin/feat/ew5-capacity-board-ui) origin/main origin/feat/ew5-capacity-board-ui | grep -q '^+<<<<<<<'"
premise_means: >-
  PR #1895 (EW-5 capacity board UI) branched before BP-2 (#1894, merged 2026-09-13 13:58Z,
  f0d852bf) added its /tenders/priority-ranking route in apps/web/src/App.tsx at the same spot
  where EW-5 adds /tenders/capacity. One conflict hunk, one file; git cannot auto-merge it
  (mergeStateStatus DIRTY) and the watcher's update-branch cannot rebase a conflicting PR.
  Every check on the branch was green before main moved; its approval receipt is already on
  the branch (d6f991c5).
fixes_pr: 1895
scope:
  - apps/web/src/App.tsx
done_when: >-
  git merge-base --is-ancestor origin/main HEAD && pnpm --filter @project-ops/web lint && pnpm
  --filter @project-ops/web test -- App ShellLayout && node scripts/pipeline/check-hex-ratchet.mjs
  && pnpm --filter @project-ops/web build
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: tendering
---

# Repair PR 1895 - merge main (BP-2's priority-ranking route) into the EW-5 branch

**Do this ON PR #1895's existing branch `feat/ew5-capacity-board-ui`. Do NOT open a new PR.**
Nothing is wrong with either side; two routes were added at the same line.

## FIRST: re-verify against the CURRENT head

`git fetch origin && git merge origin/main` on the branch. Confirm the only conflict is in
`apps/web/src/App.tsx`. If any other file conflicts, resolve it the same way and say so plainly.

## How to resolve - keep BOTH routes

- main (BP-2) added, with its comment:
  `<Route path="/tenders/priority-ranking" element={<BidPriorityRankingPage />} />`
- the branch (EW-5) added, with its comment:
  `<Route path="/tenders/capacity" element={<CapacityBoardPage />} />`
- The resolved block contains BOTH routes, each with its own comment, and BOTH stay registered
  BEFORE the `/tenders/:id` route so neither static segment is captured as an id by
  TenderDetailPage. Keep both imports (`BidPriorityRankingPage`, `CapacityBoardPage`).
- Use a MERGE commit (`git merge origin/main`), not a rebase.

Hex literals: none may be introduced (the ratchet counts the whole file).

## Verify, then push

1. `pnpm --filter @project-ops/web lint`.
2. `pnpm --filter @project-ops/web test -- App ShellLayout` - green.
3. `node scripts/pipeline/check-hex-ratchet.mjs` - exit 0.
4. `pnpm --filter @project-ops/web build`.
5. The merge commit's message must not put fix/fixes/close/closes/resolve/resolves immediately
   before `#1895` (the squash message is built from every commit message).
6. Push. Do not open a PR - #1895 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1895 is the PR** - push to its branch and
do not open another. There is no human in this run. **Finishing the work and then asking for
permission is indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already merged` and exit.
- Touch only what the merge requires; `apps/web/src/App.tsx` is the ceiling.
- Never add or remove a label; never merge the PR.
