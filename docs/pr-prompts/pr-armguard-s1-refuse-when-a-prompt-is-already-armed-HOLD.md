---
premise: '! grep -q ALREADY_ARMED scripts/pipeline/arm-prompt.ps1'
premise_means: >-
  RULE 4 - arm ONE prompt at a time - is enforced by whoever is typing, and by nothing else.
  MEASURED 2026-09-06 - arm-prompt.ps1 guards a great deal (an exclusive OS lock on
  .git\po-arm.lock, a lint gate, an index guard before and after the rename, ARM_INDEX_RELEASED,
  and an audit line) but it never asks whether another prompt is ALREADY armed. Its lock serialises
  arming against other arming; it does not tell one arming path that another has work in flight.
  The two paths that collide in practice - an interactive chat and station 00's scheduled run - see
  each other only through a directory listing. This fired for real on 2026-09-06 - station 00 armed
  pr-scopesub-s6 at 08:17:13Z and a chat armed pr-jobroles-s1 at 08:22:53Z, five minutes later,
  having PRINTED "already armed = 1" and proceeded anyway.
scope:
  - scripts/pipeline/arm-prompt.ps1
  - scripts/pipeline/__tests__/arm-prompt.test.mjs
done_when: >-
  grep -q ALREADY_ARMED scripts/pipeline/arm-prompt.ps1 && grep -q 'Force' scripts/pipeline/arm-prompt.ps1 && grep -q ALREADY_ARMED scripts/pipeline/__tests__/arm-prompt.test.mjs
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# ARMGUARD-S1: arm-prompt refuses when a prompt is already armed

**Grounded against `origin/main` = `734ff8c9`, measured 2026-09-06 by station 06.**

Two files. A new pre-flight check in the arming wrapper, and tests for it. No behaviour changes
anywhere else in the pipeline.

## What this fixes, precisely

RULE 4 says arm one at a time. The wrapper enforces every other arming rule mechanically and leaves
this one to human attention — and human attention failed on 2026-09-06 with the count on screen.
**A rule worth having is worth enforcing in the tool that performs the action.**

## Do

1. **Add a `[switch]$Force` parameter** to the `param()` block (`arm-prompt.ps1:51-63`), beside the
   existing `$WhatIf` and `$LockTimeoutSeconds`.

2. **Add an already-armed pre-flight check.** Place it **after the lock is acquired and after the
   index-clean check, and before `Assert-TargetValid`** (`:223`) — inside the lock, so the check and
   the rename are atomic with respect to another arming run. On refusal, use the existing
   `Write-Fail` helper (`:89`), emit the literal token `ALREADY_ARMED`, name every offending file,
   and exit non-zero **without renaming anything and without writing an audit line**. Release the
   lock on the way out, exactly as the existing `git mv` failure path does.

3. 🔴 **Count `docs/pr-prompts/pr-*-ready.md` at depth 1 ONLY.** Two exclusions, both load-bearing:
   - **`rev-<n>-ready.md` MUST NOT count.** DOCTRINE §9.5: *"`rev-<n>-ready.md` are auto-generated
     REVIEW JOBS, not prompts. They have no front matter by design. Exclude them from prompt audits."*
     Counting them would refuse legitimate arms — two were sitting armed on 2026-09-06 while the
     real armed-prompt count was zero.
   - **Subdirectories MUST NOT count.** `processed/`, `failed/`, `blocked/`, `no-pr-opened/` and
     `needs-marco/` are full of `*-ready.md`. A recursive count would refuse every arm forever.

4. **`-Force` waives the refusal, and says so in the audit trail.** When `-Force` is passed the arm
   proceeds, and the `.arming-log.txt` line **must record that it was forced and what it was forced
   past** — the names of the prompts already armed. A waiver that leaves no trace is the same
   blindness in a different place. Marco waives RULE 4 deliberately and that must stay possible;
   what must not stay possible is waiving it by accident.

5. **The check runs in `-WhatIf` too.** The dry run must report the refusal rather than reporting
   "all checks pass" and failing on the real run. `-WhatIf` still touches nothing.

## Tests — `scripts/pipeline/__tests__/arm-prompt.test.mjs`

The file holds **19 tests today**; add to it, do not restructure it. A dedicated Windows CI job runs
this suite and asserts `pass >= 8`; more tests keep passing. **Do not lower that threshold.**

Four new cases, each asserting the filesystem afterwards, not just the exit code:

- One `pr-*-ready.md` present → refuses, exit non-zero, output contains `ALREADY_ARMED`, and the
  target is **still `-HOLD.md`**.
- Only `rev-<n>-ready.md` present → **arms normally.** This is the regression guard for the
  DOCTRINE §9.5 exclusion and the reason this slice is not a one-line change.
- A `*-ready.md` in `processed/` only → **arms normally** (depth-1 guard).
- `-Force` with one already armed → arms, and `.arming-log.txt` records the waiver and the name it
  was forced past.

## Do NOT

- Do NOT edit `DOCTRINE.md` or any station contract in this slice. The doc line is a separate slice;
  changing governance text and tool behaviour in one PR makes both harder to review.
- Do NOT count recursively, and do NOT count `rev-*`. Both would refuse arms that are legitimate.
- Do NOT touch the lock, the lint gate, the index guards, `ARM_INDEX_RELEASED`, or the existing
  audit-line format beyond adding the forced-waiver detail.
- Do NOT make `-Force` the default, and do NOT let any station pass it automatically. It exists for
  a human who means it.
- Do NOT touch `sot/`, `apps/`, or `prisma/`.
- Do NOT run `git checkout .`, `reset --hard`, `stash pop` or `git clean`.

## Verify

```
grep -q ALREADY_ARMED scripts/pipeline/arm-prompt.ps1
grep -q 'Force' scripts/pipeline/arm-prompt.ps1
node --test scripts/pipeline/__tests__/arm-prompt.test.mjs
git diff --name-only   # exactly the two paths in scope
```

Paste into the PR body: the refusal output for the already-armed case, and proof that the
`rev-*`-only case still arms. The second is the one a reviewer cannot take on trust.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop before
pushing.
