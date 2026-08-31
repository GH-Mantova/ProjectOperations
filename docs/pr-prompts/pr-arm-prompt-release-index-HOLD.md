---
premise: '! grep -q "ARM_INDEX_RELEASED" scripts/pipeline/arm-prompt.ps1'
premise_means: >-
  arm-prompt.ps1 exits leaving its own HOLD->ready rename staged in a shared index. That is the exact
  defect its docstring says it exists to prevent, and it is also why the next wrapper arm refuses
  Assert-CleanIndex for the 20-40 minutes until the watcher consumes the prompt - which is why actors
  arm by bare git mv instead, producing the unlogged arms Station 00 reported as F10.
scope:
  - scripts/pipeline/arm-prompt.ps1
  - scripts/pipeline/__tests__/arm-prompt.test.mjs
done_when: >-
  grep -q "ARM_INDEX_RELEASED" scripts/pipeline/arm-prompt.ps1 && node --test
  scripts/pipeline/__tests__/arm-prompt.test.mjs
size: 3
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: pipeline-hygiene
cluster_order: 2
requires_on_main: scripts/pr-watcher/index.mjs :: hasDeclaredDependencies
rollback_strategy: >-
  Single script plus its test file. No repo content, no schema, no CI change. Revert the commit and
  arming returns to leaving the rename staged.
---

# Arming must not leave a staged rename behind

## Why this is gated

Slice 2 of cluster `pipeline-hygiene`. The gate needle `hasDeclaredDependencies` is introduced
by slice 1 (`pr-watcher-onmain-dispatch-gate`), which repairs the watcher's dispatch-time
enforcement of `requires_on_main`. Until that lands, a `requires_on_main` gate is honoured only
by the intake linter and this slice would dispatch alongside slice 1 rather than after it.
Gating on the fix means the gate that orders this cluster is itself proven by opening.

## The defect, in the script's own words

`arm-prompt.ps1`'s docstring is unusually clear about why it exists:

> Before this script existed, arming was a bare `git mv <name>-HOLD.md <name>-ready.md` typed by
> whichever chat happened to be running at the time. **That is a defect: any chat that commits
> afterwards picks up the staged rename silently.**
>
> Three real collisions on 2026-08-24 proved this is not theoretical:
> commit `488f138a` swept HOLD->ready renames of pr-nopr-s1 and pr-nopr-s2 into a docs commit;
> `pr-lessons-folder-s1-restore` was staged by another chat and had to be committed around;
> four CRM arming renames sat staged across three unrelated commits.

The script guards the arming *window* — lock, `Assert-CleanIndex` before, `Assert-IndexExactlyTwoPaths`
after — and then **exits leaving the rename staged**. The hazard it was built to remove survives the
run. Its own rollback path already understands this: on failure it proves the index is clean before
claiming it changed nothing, because "a silently-failed rollback leaves the rename staged in a tree
several chats share, which is the exact defect this script exists to prevent."

## The second consequence, which is what actually broke

A staged rename makes the NEXT `Assert-CleanIndex` fail. Measured tonight:

```
00:51:25Z  ARMED pr-crm-s5-accounts-crud-wiring        (rename left staged)
01:48:31Z  arm of pr-crm-s4-no-history-proposal REFUSED:
           "Index is not clean. The following paths are already staged:
              docs/pr-prompts/pr-crm-s5-accounts-crud-wiring-HOLD.md
              docs/pr-prompts/pr-crm-s5-accounts-crud-wiring-ready.md"
```

57 minutes during which the only way to arm was outside the wrapper. That is the incentive that
produces the unlogged arms in Station 00's F10 — `pr-scopesub-s1-one-discipline-list` was armed by
bare `git mv` at 04:26Z and appears nowhere in `.arming-log.txt`.

**Fix the incentive and the bypass loses its reason to exist.** A guard hook that refuses unlogged
renames is worth having, but it is a backstop; it belongs in its own slice and is gated on this one.

## Do

1. **Add Step 7, inside the lock, after the audit block.** Once arming has succeeded and the audit
   line is written, un-stage exactly the two paths this run staged:

   ```
   git restore --staged <HOLD_REL> <READY_REL>
   ```

   The literal token `ARM_INDEX_RELEASED` must appear in the script — the premise and `done_when`
   grep for it. Put it in the step's comment banner.

2. **Verify, do not assume.** Read the index back with the existing `Get-StagedPaths` helper and
   confirm it is empty. The rollback path at lines 335-350 already sets this precedent: prove the
   index state before reporting it.

3. **Report honestly on failure.** If the release or its verification fails, the arming still STANDS
   (the rename is on disk, the audit line is written, the watcher will consume it). Print a WARN in
   the shape the rollback path uses — name the residual paths and the exact
   `git -C <root> restore --staged <path>` commands a human needs — and exit 0, not a failure code.
   An arming that worked must not be reported as broken.

4. **Order matters.** The release runs AFTER `Assert-IndexExactlyTwoPaths` and AFTER the audit line,
   and BEFORE the `finally` that drops the lock. Doing it inside the lock is the point: no other
   actor can stage something into the window between the check and the release.

5. **Add a header line to `.arming-log.txt`** when the file is created, and only then:

   ```
   # WRAPPER ARMS ONLY - this file is NOT an arm census. A bare `git mv` writes nothing here.
   # The only sound census is the filesystem: docs/pr-prompts/*-ready.md
   ```

   Station 00's F10 is precisely that this log gets read as the census. Say so where it is read.

## Do NOT

- Do **not** commit the rename. The HOLD deletion is queue bookkeeping that Station 06 lands on a
  board PR with an explicit `git add`; committing here would sweep the shared tree, which is the
  defect in a new coat.
- Do **not** weaken or remove `Assert-CleanIndex`, `Assert-IndexExactlyTwoPaths`, the lock, or the
  rollback proof. Every one of them is load-bearing and this change is additive to all of them.
- Do **not** touch the `-WhatIf` path's promise to change nothing.
- Do **not** add the pre-commit hook here. That is a separate slice, gated on this one.
- Do **not** make a release failure fail the run. See item 3.

## Verification

Extend `scripts/pipeline/__tests__/arm-prompt.test.mjs`:

- **index clean after a successful arm** — arm a fixture prompt, then assert
  `git diff --cached --name-status` is empty. This is the test the whole prompt exists for.
- **the ready file survives** — the renamed file is on disk after the release; the HOLD is gone.
  The watcher reads the filesystem, so this is what "still armed" means.
- **audit line still written** — the release must not cost the trace.
- **back-to-back arming** — arm A, then arm B with no intervening commit, and assert B succeeds.
  Today B fails `Assert-CleanIndex`; this is the regression that reopens the bypass.
- **unexpected-stage path unchanged** — with a foreign path staged during the window, the run still
  restores it, undoes the rename, and exits 3 with a clean index.
- **release failure is not an arming failure** — simulate the restore failing; assert exit 0, a WARN
  naming the residual paths, and the ready file still on disk.

Negative control, recorded in the PR body: with Step 7 removed, the "index clean after a successful
arm" and "back-to-back arming" tests must both fail. A test that passes either way is not a test.

## STANDING AUTHORITY

You have **STANDING AUTHORITY to finish the work, commit, push** the branch and open the pull
request. Do not stop to ask. If a step in "Do" turns out to be wrong, fix it and say so in the PR
body — but do not exit 0 without a PR. An agent that exits without opening a PR has failed this
prompt, whatever its reasoning was.
