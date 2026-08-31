---
premise: '! grep -q "conflictNotified" scripts/pr-watcher/index.mjs'
premise_means: >-
  A PR whose mergeStateStatus is DIRTY is logged once every 120 seconds forever and escalated to
  nobody. pollForBehindPrs skips it with a log line whose own comment says "those need a human
  rebase", and then no human is told. PR #1424 emitted that line for roughly forty minutes; it
  cleared only because somebody happened to look at the board.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/**
done_when: >-
  grep -q "conflictNotified" scripts/pr-watcher/index.mjs && node --test
  scripts/pr-watcher/__tests__/
size: 3
gate_allow: none
seed_only: false
escalates: false
backfill: false
requires_on_main: scripts/pr-watcher/index.mjs :: hasDeclaredDependencies
rollback_strategy: >-
  One watcher module plus tests. No schema, no migration, no repo content. Revert the commit and a
  conflicted PR goes back to being logged silently every poll.
---

# A conflicted PR must tell somebody, once

## Why this is gated, and why it is not in the cluster

This slice edits `scripts/pr-watcher/index.mjs`, the same file slice 1 of cluster
`pipeline-hygiene` (`pr-watcher-onmain-dispatch-gate`) edits. It is gated on that slice's
needle so the two never have branches open against the same file at the same time.

It carries no `cluster` key on purpose. Slice 2 of that cluster gates on `index.mjs`; adding
this prompt to the cluster would make `index.mjs` the target of two members' gates and the
source of two members' scopes, which is the back-edge shape `CLUSTER_CYCLE` exists to catch.
A gate without a cluster is legal and is the right shape here: this work is ordered after
slice 1, but it is not part of that chain.

## The defect

`pollForBehindPrs`, `scripts/pr-watcher/index.mjs:2084`:

```js
for (const pr of prs) {
  if (pr.mergeStateStatus === "DIRTY") {
    log("update", `PR #${pr.number} has conflicts — skipping update-branch`);
    continue;
  }
```

The comment above the function is explicit — *"Conflicting PRs (mergeStateStatus DIRTY) are skipped —
update-branch can't resolve conflicts; those need a human rebase."* The code then tells no human. The
poll runs every 120 seconds, so the line repeats indefinitely into a log nobody tails, and the PR is
counted nowhere: not in `.queue-state.json`, not in an escalation file, not as a comment on the PR
itself.

Measured on 2026-08-31: **#1424** logged `has conflicts — skipping update-branch` at 04:11:35,
04:13:35, 04:23:35, 04:27:38 and onward. It merged at 04:51:17Z only because a person noticed.

## Do

1. **Confirm before acting.** Track consecutive DIRTY observations per PR and act only on the second
   one. `mergeStateStatus` is briefly `UNKNOWN` or stale immediately after a push, and GitHub
   recomputes mergeability asynchronously — acting on a single sample will produce false alarms on
   healthy PRs. Reset the counter the moment the PR is seen non-DIRTY.

2. **Say it once, where the problem is.** On confirmation, post ONE comment on the PR naming the
   conflict and what is needed (a human rebase — `update-branch` cannot resolve it). Key the record
   on `(PR number, head sha)` so a new push re-arms the notification but the poll loop never repeats
   it. Persist it the way the reviewer set already is: a JSON file beside `.reviewed-prs.json`, same
   load/save shape. The identifier `conflictNotified` must appear in the source — the premise and
   `done_when` grep for it.

3. **Count it where the board is read.** Add the confirmed-conflicted PR numbers to
   `.queue-state.json` so the watchdog and any status sweep can surface "N PRs blocked on conflicts"
   instead of that fact living only in a log. This is the half that makes it visible without anyone
   remembering to look.

4. **Log on transition, not on every poll.** Emit the `has conflicts` line when a PR ENTERS the
   conflicted state and when it leaves, not once per tick. The repetition is what trained readers to
   scroll past it.

## Do NOT

- Do **not** attempt to resolve the conflict, rebase, force-push, or close the PR. The whole point is
  that a human is needed; an agent guessing at a merge resolution is how work gets silently lost.
- Do **not** write to `docs/pr-prompts/needs-marco/`. That directory is gitignored, and an escalation
  nobody can see is the defect this prompt is fixing, not the fix.
- Do **not** touch `pollForNewPrs`, the dependency gate, `holdForMarco`, or any merge-policy code.
  Those work. This is one branch of one poller.
- Do **not** comment more than once per head sha. A long-lived conflicted PR must not accumulate a
  comment per poll — that is the same noise in a louder place.
- Do **not** make a notification failure stop the poll loop. Log it and continue; the poller is
  best-effort housekeeping and must not stall the queue.

## Verification

Add tests under `scripts/pr-watcher/__tests__/`, following the injected-dependency style that
`verdict-archival.spec.mjs` established — pure functions over injected `gh`/state so no network is
needed:

- **one observation does not notify** — a single DIRTY sample produces no comment and no state entry.
  This is the false-positive guard and the most important test here.
- **two consecutive observations notify exactly once** — and a third, fourth and fifth poll add
  nothing.
- **a new head sha re-arms** — same PR, new sha, still DIRTY twice -> one further comment.
- **recovery clears** — a PR seen non-DIRTY resets its counter and drops out of the queue-state list.
- **notification failure is swallowed** — a throwing comment call logs and continues; the poller
  still processes the remaining PRs.
- **BEHIND is unaffected** — a BEHIND PR still gets `update-branch` exactly as today.

Negative control, recorded in the PR body: with the two-observation rule reduced to one, the "one
observation does not notify" test must fail.

## STANDING AUTHORITY

You have **STANDING AUTHORITY to finish the work, commit, push** the branch and open the pull
request. Do not stop to ask. If a step in "Do" turns out to be wrong, fix it and say so in the PR
body — but do not exit 0 without a PR. An agent that exits without opening a PR has failed this
prompt, whatever its reasoning was.
