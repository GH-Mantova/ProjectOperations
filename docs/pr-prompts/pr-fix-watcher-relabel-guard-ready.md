---
premise: ! grep -q unlabeled scripts/pr-watcher/index.mjs
premise_means: The watcher's merge step still applies the `do-not-merge` label unconditionally whenever an escalates:true prompt reaches it. It does not check whether the PR already exists, and it does not check whether a human has already removed that label. Re-running such a prompt silently reverses Marco's review decision.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/escalation-label.test.mjs
done_when: grep -q unlabeled scripts/pr-watcher/index.mjs && pnpm lint
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# FIX: the watcher re-applies `do-not-merge` after Marco removed it

## The incident (measured, 2026-08-18)

Marco reviewed PR #1158 and removed its `do-not-merge` label at **00:26:53Z** - the one action that
releases an escalated PR. The watcher was restarted at 01:11Z with 7 armed prompts. At **01:45:05Z**
it re-processed `pr-sor-s8-ar-office-review-lane-ready.md`, whose PR (#1158) had been open since
2026-08-17, and logged:

    [merge] PR #1158: escalates:true - NOT enabling auto-merge; labelling do-not-merge

GitHub's own event log confirms the reversal:

    2026-08-17T09:40:49Z  labeled    do-not-merge   GH-Mantova
    2026-08-18T00:26:53Z  unlabeled  do-not-merge   GH-Mantova   <- Marco's review decision
    2026-08-18T01:45:08Z  labeled    do-not-merge   GH-Mantova   <- the watcher, undoing it

**A human decision was silently reversed by automation 78 minutes later.** The PR went back to
CP-26 red and stopped merging. Nobody was told.

## Why this matters more than it looks

The standing rule is "`escalates: true` means MARCO removes the `do-not-merge` label; automation
must not." That rule was written about *removal*. Re-application was never considered, and it has
exactly the same effect: automation, not Marco, decides whether the gate is open. A rule that only
guards one direction does not guard the gate.

## Two defects, one code path

**1. The prompt should not have re-run at all.** `pr-sor-s8-ar-office-review-lane-ready.md` was
still armed even though PR #1158 had existed since the previous morning. Consuming a prompt on PR
creation is what should have prevented this; it did not happen. Before doing ANY merge-step work,
check whether an open PR already exists for this prompt's branch. If it does, the prompt is spent -
move it to `processed/` and do nothing else. Do not re-label, do not re-comment, do not re-open.

**2. `do-not-merge` must never be re-applied over a human removal.** Before applying the label,
read the PR's label event history (`gh api repos/:owner/:repo/issues/:n/events`). If the most
recent `do-not-merge` event is an `unlabeled` one, a human has already made the call. **Do not
re-apply.** Log loudly that you are declining to, and why.

Apply the label only when the PR does not already carry it AND it has never been removed.

## Also fix the broken comment while you are in here

Every one of these attempts fails identically:

    [merge] PR #1158: comment failed (non-fatal): gh pr comment 1158 --body Held for Marco: ...
                      exited 1: accepts at most 1 arg(s), received 42

The body is unquoted, so the shell splits it into 42 arguments. **The one message that would tell
Marco why the PR is held has never once been delivered** - it has failed on #1158, #1165 and #1166
at minimum. Pass the body via a temp file (`--body-file`) rather than trying to quote it.

## Tests

In `__tests__/escalation-label.test.mjs`:

- prompt whose branch already has an open PR -> moved to `processed/`, no label call, no comment.
- escalates PR with no label history -> label applied, comment posted (body-file path exercised).
- escalates PR whose last `do-not-merge` event is `unlabeled` -> **label NOT applied**, decline
  logged.
- escalates PR that still carries the label -> no duplicate apply.
- the comment body survives with spaces and backticks intact.

Do not weaken an existing assertion to go green.

## Verification

State in your output the exact sequence you drove and what the label ended up as. A unit test alone
is not sufficient - this defect existed underneath passing tests.

Do NOT remove the `do-not-merge` label from #1158 or any other PR as part of this work. That is
Marco's, and this prompt exists precisely to protect that.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
