---
premise: "git fetch -q origin feat/sor-s9b-register-page && git show origin/feat/sor-s9b-register-page:apps/web/src/pages/JobSorRegisterPage.tsx | grep -Eq '#[0-9a-fA-F]{6}'"
premise_means: >-
  PR #1905 (sor-s9b) adds apps/web/src/pages/JobSorRegisterPage.tsx with 62 hard-coded colour
  literals. The hex ratchet (check-hex-ratchet.mjs --check, run 34793553563) fails: a file absent
  from docs/qa/hex-baseline.json must be clean. Every other check on the branch is green after
  the lane retitled it feat(schedule-of-rates) (the title gate was the first red; it passes on
  7908e665).
fixes_pr: 1905
scope:
  - apps/web/src/pages/JobSorRegisterPage.tsx
done_when: >-
  git merge-base --is-ancestor origin/main HEAD && pnpm --filter @project-ops/web lint && node
  scripts/pipeline/check-hex-ratchet.mjs && pnpm --filter @project-ops/web test -- JobSorRegister
  && pnpm --filter @project-ops/web build
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: schedule-of-rates
---

# Repair PR 1905 - JobSorRegisterPage colours must come from tokens.css, not hex literals

**Do this ON PR #1905's existing branch `feat/sor-s9b-register-page`. Do NOT open a new PR.**

## FIRST: re-verify against the CURRENT head

`git fetch origin && git checkout feat/sor-s9b-register-page`, then
`node scripts/pipeline/check-hex-ratchet.mjs`. Expect
`NEW apps/web/src/pages/JobSorRegisterPage.tsx 0 -> 62`. If the number differs, work from the
number you see.

## The fix

Map every literal in `JobSorRegisterPage.tsx` onto a token from
`apps/web/src/styles/tokens.css` BY ROLE, exactly as the CapacityBoardPage (#1895, e695dc7a)
and BidPriorityRankingPage (#1894, f0d852bf) fixes did: text colours -> `--text-*`, surfaces ->
`--surface-*`, borders -> `--border-*`, state colours -> `--status-active` / `--status-warning`
/ `--status-danger` / `--status-info` / `--status-neutral`. Read those two pages on main for
the mapping already in use and stay consistent with it.

- `var(--x, #hex)` FALLBACKS COUNT as literals - do not use them.
- Comments count too: no hex anywhere in the file.
- Do not add the file to `docs/qa/hex-baseline.json`; the baseline may only shrink.
- Nothing else changes: no behaviour, no layout, no test edits beyond what a renamed class
  needs.

## Verify, then push

1. `node scripts/pipeline/check-hex-ratchet.mjs` - exit 0, the file no longer listed.
2. `pnpm --filter @project-ops/web lint`, `pnpm --filter @project-ops/web test -- JobSorRegister`,
   `pnpm --filter @project-ops/web build`.
3. The commit message must not put fix/fixes/close/closes/resolve/resolves immediately before
   `#1905` (the squash message is built from every commit message).
4. Push. Do not open a PR - #1905 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1905 is the PR** - push to its branch and
do not open another. There is no human in this run. **Finishing the work and then asking for
permission is indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already clean` and exit.
- Touch only `apps/web/src/pages/JobSorRegisterPage.tsx`; that file is the ceiling.
- Never add or remove a label; never merge the PR.
