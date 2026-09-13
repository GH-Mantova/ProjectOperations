---
premise: "git fetch -q origin worktree-agent-ab8ed118705aa1958 && git show origin/worktree-agent-ab8ed118705aa1958:apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx | grep -qi 'status-warning-bg, #FFF8E6'"
premise_means: >-
  PR #1891 adds four hex literals as CSS-variable FALLBACKS - ScopeCardEmptyState.tsx goes from
  5 to 7 (var(--surface-muted, F6F6F6), var(--border, e5e7eb)) and ScopeCardsTab.tsx from 0 to 2
  (var(--status-warning-bg, FFF8E6), var(--status-warning, F59E0B)) - and the hex ratchet counts a
  literal inside var() exactly like any other, so the Pipeline job fails on every head (run
  34753125940, job 103718260098). The spec-arity fix (d0fbebc5) and the retitle already landed;
  this is the last red. Some of the tokens named do not exist in tokens.css (surface-muted,
  status-warning-bg, border), which is why the author reached for fallbacks.
fixes_pr: 1891
scope:
  - apps/web/src/pages/tendering/scope-cards/ScopeCardEmptyState.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
done_when: >-
  node scripts/pipeline/check-hex-ratchet.mjs && pnpm --filter @project-ops/web lint && pnpm
  --filter @project-ops/web test -- rates-gate && pnpm --filter @project-ops/web build
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: tendering
---

# Repair PR 1891 - four literal fallbacks in the scope-cards gate trip the hex ratchet

**Do this ON PR #1891's existing branch `worktree-agent-ab8ed118705aa1958`. Do NOT open a new PR.**
The defect is inside that PR's own diff. main is green.

## FIRST: re-verify against the CURRENT head

Run `node scripts/pipeline/check-hex-ratchet.mjs` on the branch and read the `Pipeline - watcher
+ linter tests` job of the **latest** CI run: confirm the red step is still the hex ratchet and it
names the two scope-cards files. If anything else is red, fix what the log shows and say so.

## What to change

Only the lines this PR ADDED (the file's pre-existing 5 literals in ScopeCardEmptyState.tsx are
baselined and are not yours to touch - the ratchet only forbids the count RISING):

- `var(--surface-muted, F6F6F6)` -> `var(--surface-subtle)` (the token that exists in tokens.css)
- `var(--border, e5e7eb)` -> `var(--border-subtle)`
- `var(--status-warning-bg, FFF8E6)` -> the warning-badge background technique the app already
  uses for `--status-warning` (read an existing warning banner/badge and copy it; do not invent
  a token and do not add one to tokens.css)
- `var(--status-warning, F59E0B)` -> `var(--status-warning)` with NO fallback

A fallback literal is exactly what the ratchet counts; the tokens exist, so no fallback is needed.
No behaviour, copy, layout or test changes.

## Verify, then push

1. `node scripts/pipeline/check-hex-ratchet.mjs` -> exit 0 (ScopeCardEmptyState.tsx back at 5, ScopeCardsTab.tsx at 0).
2. `pnpm --filter @project-ops/web lint && pnpm --filter @project-ops/web test -- rates-gate && pnpm --filter @project-ops/web build`.
3. Commit on the branch with a message that describes the change and does NOT put the words
   fix/fixes/close/closes/resolve/resolves immediately before `#1891`.
4. Push. Do not open a PR - #1891 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1891 is the PR** - push to its branch and
do not open another. There is no human in this run. **Finishing the work and then asking for
permission is indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already repaired` and exit.
- Touch only the two files in `scope`.
- Never add or remove a label; never merge.
