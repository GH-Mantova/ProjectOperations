---
premise: "git fetch -q origin worktree-agent-a6ee2a5a958bea8d0 && git show origin/worktree-agent-a6ee2a5a958bea8d0:apps/web/src/pages/tendering/BidPriorityRankingPage.tsx | grep -qi '#1E40AF'"
premise_means: >-
  PR #1894's new BidPriorityRankingPage.tsx carries seventeen hard-coded hex colour literals
  (confidence badge pairs FEF9C3/854D0E, DBEAFE/1E40AF, DCFCE7/166534, the F3F4F6/374151 fallback,
  a 1F2937/F9FAFB header, 9CA3AF muted text, and var(--color-teal, 005B61) fallbacks), so the hex
  ratchet ("no file may gain a hard-coded colour literal") fails the Pipeline job on every head.
  The nav-test red was repaired by the previous fix-lane run (a828f70d); the ratchet is the last red
  standing between this PR and green. The other files the PR touches are unchanged in hex count.
fixes_pr: 1894
scope:
  - apps/web/src/pages/tendering/BidPriorityRankingPage.tsx
done_when: >-
  ! grep -qiE '#[0-9a-f]{6}' apps/web/src/pages/tendering/BidPriorityRankingPage.tsx && node
  scripts/pipeline/check-hex-ratchet.mjs && pnpm --filter @project-ops/web lint && pnpm --filter
  @project-ops/web build
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: tendering
---

# Repair PR 1894 - the priority-ranking page must take its colours from tokens.css

**Do this ON PR #1894's existing branch `worktree-agent-a6ee2a5a958bea8d0`. Do NOT open a new PR.**
The defect is inside that PR's own diff. main is green.

## FIRST: re-verify against the CURRENT head

Run `node scripts/pipeline/check-hex-ratchet.mjs` on the branch and read the `Pipeline - watcher
+ linter tests` job of the **latest** CI run: confirm the red step is still the hex ratchet and it
names `BidPriorityRankingPage.tsx`. If anything else is red, fix what the log shows and say so.

## What to change - `BidPriorityRankingPage.tsx` only

Replace every literal with a token from `apps/web/src/styles/tokens.css` via `var(--token)`, by
ROLE:

- confidence badges LOW / MEDIUM / HIGH -> `--status-warning` / `--status-info` / `--status-active`
  (badge background at the opacity the app's other status badges use - read an existing status
  badge and copy its technique; do not invent one); the fallback pair -> `--status-neutral`
- header block 1F2937 / F9FAFB -> `--surface-sidebar` / `--text-inverse`
- muted text 9CA3AF -> `--text-muted`; body greys -> `--text-primary` / `--text-secondary`
- `var(--color-teal, 005B61)` -> `var(--color-teal)` with NO literal fallback (the token exists;
  a fallback literal is exactly what the ratchet counts)

Do NOT add tokens to `tokens.css`, do NOT regenerate `docs/qa/hex-baseline.json`, and change no
behaviour, layout, copy or test.

## Verify, then push

1. `grep -ciE '#[0-9a-f]{6}' apps/web/src/pages/tendering/BidPriorityRankingPage.tsx` -> 0.
2. `node scripts/pipeline/check-hex-ratchet.mjs` -> exit 0.
3. `pnpm --filter @project-ops/web lint && pnpm --filter @project-ops/web build` -> green.
4. Commit on the branch with a message that describes the change and does NOT put the words
   fix/fixes/close/closes/resolve/resolves immediately before `#1894`.
5. Push. Do not open a PR - #1894 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1894 is the PR** - push to its branch and
do not open another. There is no human in this run. **Finishing the work and then asking for
permission is indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already repaired` and exit.
- Touch only the file in `scope`.
- Never add or remove a label; never merge.
