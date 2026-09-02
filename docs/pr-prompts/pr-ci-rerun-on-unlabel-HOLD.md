---
premise: '! grep -q "unlabeled" .github/workflows/ci.yml'
premise_means: >-
  .github/workflows/ci.yml triggers on "pull_request: branches: [main]" with no "types:" key, so it
  uses the GitHub default set [opened, synchronize, reopened]. Removing the do-not-merge label
  therefore CANNOT re-run CI. Measured 2026-09-02T04:5xZ at origin/main eacf09ac. This is not
  cosmetic - CP-26 is a REQUIRED check whose verdict is keyed on the live label, so after a release
  the stale run keeps reporting FAIL - CP-26 [LABEL_PRESENT] and the PR stays BLOCKED on a fact that
  is no longer true. It happened twice in one hour on 2026-09-02, on PR #1510 and PR #1511, and both
  needed a human to notice and re-run by hand.
scope:
  - .github/workflows/ci.yml
done_when: >-
  grep -q "unlabeled" .github/workflows/ci.yml && grep -q "synchronize" .github/workflows/ci.yml
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# Removing `do-not-merge` must re-run CI, because CP-26's verdict depends on the label

## The defect, measured

`.github/workflows/ci.yml` on `origin/main` at `eacf09ac`:

    on:
      push:
        branches: [main]
      pull_request:
        branches: [main]

No `types:` key. GitHub's default for `pull_request` is `[opened, synchronize, reopened]`, so a
label change fires nothing.

CP-26 reads the **live label** and reports one of two verdicts:

- label present → `FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label
  (escalates:true). A human must review and REMOVE the label; removing it is what releases the merge.`
- label removed → it requires `docs/decisions/merge-approvals/<N>.md` in the PR's diff against the
  merge-base, and passes once that receipt is committed on the PR branch.

Both are correct verdicts. The bug is that **the transition between them is invisible until
something else happens to re-trigger the workflow.** On 2026-09-02:

| PR | label removed | what the board kept showing |
|---|---|---|
| #1510 | 04:06:19Z | stale `LABEL_PRESENT` until an unrelated push moved the head |
| #1511 | ~04:4xZ | stale `LABEL_PRESENT`; only the watcher's branch-update re-ran it |

Neither re-run was caused by the release. Both were luck.

## What to build

Add an explicit `types:` list to the `pull_request` trigger in `.github/workflows/ci.yml`:

    on:
      push:
        branches: [main]
      pull_request:
        branches: [main]
        types: [opened, synchronize, reopened, labeled, unlabeled]

## The trap that makes this a one-line change people still get wrong

**Specifying `types:` REPLACES the default set, it does not extend it.** Writing
`types: [labeled, unlabeled]` alone silently stops CI running on new commits - the single worst
outcome available here, because every PR would then go green on a stale run. The three defaults
`opened`, `synchronize` and `reopened` MUST be listed explicitly alongside the two new ones. That
is why `done_when` asserts `synchronize` is still present as well as `unlabeled`.

## Cost, stated honestly

Adding `labeled` and `unlabeled` means CI also runs when a label is ADDED, roughly doubling runs on
a PR that gets labelled once. The existing `concurrency` block in the same file already cancels a
PR's in-flight run when a newer event arrives for that PR, so the extra runs cancel each other
rather than queueing. This is accepted deliberately: a redundant run costs minutes, a stale required
check costs a human noticing.

`labeled` is included rather than only `unlabeled` so that RE-applying `do-not-merge` also refreshes
CP-26. Without it the reverse transition has the same blindness in mirror image - a PR could show a
released-and-green CP-26 while carrying the label again.

## Do NOT

- Do not change any job's `if:` condition, and do not make any check conditional on a label. The
  required checks must keep reporting on every event or the branch protection ruleset blocks
  forever on a missing context.
- Do not touch `.github/workflows/playwright.yml`. It carries the same default-types shape, but
  `tendering-e2e` does not read labels, so it has no stale-verdict failure mode. Out of scope.
- Do not add, remove, or edit any label on any PR.
- Do not author, edit, or delete any file under `docs/decisions/merge-approvals/`. Those are Marco's
  and only Marco's, in every circumstance, without exception.

## Verification

- [ ] `.github/workflows/ci.yml` lists all five types: `opened`, `synchronize`, `reopened`,
      `labeled`, `unlabeled`.
- [ ] `git show origin/main:.github/workflows/ci.yml` still differs only in the `types:` line -
      no job, step, `if:` or `concurrency` change.
- [ ] The PR's own CI run is green, proving `synchronize` still fires after the edit.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
