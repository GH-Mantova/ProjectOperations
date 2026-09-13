---
premise: "git fetch -q origin worktree-agent-a6ee2a5a958bea8d0 && git show origin/worktree-agent-a6ee2a5a958bea8d0:apps/web/src/components/__tests__/ShellLayout.nav.test.ts | grep -q '6-item funnel'"
premise_means: >-
  PR #1894 adds "Priority ranking" to the Tendering nav group (ShellLayout.tsx) but
  ShellLayout.nav.test.ts still asserts the group is exactly the six labels of the 2026-08-14
  NAV-1 restructure, so the Web job fails one test out of 2994 (run 34749726984, job
  103703929679: "expected [ 'Leads & opportunities', ...(6) ] to deeply equal [ ..., ...(5) ]").
  The PR title has already been corrected to feat(tendering); the title gate re-runs on push.
fixes_pr: 1894
scope:
  - apps/web/src/components/__tests__/ShellLayout.nav.test.ts
done_when: >-
  ! grep -q '6-item funnel' apps/web/src/components/__tests__/ShellLayout.nav.test.ts && grep -q
  'Priority ranking' apps/web/src/components/__tests__/ShellLayout.nav.test.ts && pnpm --filter
  @project-ops/web test -- ShellLayout.nav
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: tendering
---

# Repair PR 1894 - the nav test still asserts a six-item Tendering group

**Do this ON PR #1894's existing branch `worktree-agent-a6ee2a5a958bea8d0`. Do NOT open a new PR.**
The defect is a test the PR's own nav change invalidated. main is green.

## FIRST: re-verify against the CURRENT head

Read the Web job log of the **latest** CI run on the branch and confirm the only failing test is
still `ShellLayout nav - NAV-1 restructure > Tendering carries the 6-item funnel in order`. If
anything else is red, fix what the log shows and say so plainly.

## What to change

In `apps/web/src/components/__tests__/ShellLayout.nav.test.ts` (around :100): the test that
asserts the Tendering group's labels. Read `ShellLayout.tsx` on the branch and put "Priority
ranking" at the position the PR inserted it (the review measured: after Tenders, before
Pipeline). Rename the test to say seven items. Keep the per-item permission-gating test as it
is - it iterates the live list and already passes with seven.

Nothing else. Not `ShellLayout.tsx`, not the page, not the hook.

## Verify, then push

1. `pnpm --filter @project-ops/web test -- ShellLayout.nav` - all green.
2. `pnpm --filter @project-ops/web lint`.
3. Commit on the branch with a message that describes the change and does NOT put the words
   fix/fixes/close/closes/resolve/resolves immediately before `#1894`.
4. Push. Do not open a PR - #1894 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1894 is the PR** - push to its branch and
do not open another. There is no human in this run. **Finishing the work and then asking for
permission is indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already repaired` and exit.
- Touch only the file in `scope`.
- Never add or remove a label; never merge.
