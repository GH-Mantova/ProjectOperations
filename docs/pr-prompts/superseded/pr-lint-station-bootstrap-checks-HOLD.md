---
premise: '! grep -q "BOOTSTRAP_PREFLIGHT_CHECK_V1" scripts/pipeline/lint-station.mjs'
premise_means: >-
  The scheduled-task bootstraps (C:\Users\Marco\Claude\Scheduled\<station>\SKILL.md) are the layer
  that governs STEP 1 of every scheduled run. No gate reads them: lint-station.mjs lints only the
  repo station docs and .claude/agents. That is how four load-bearing preflight steps were missing
  from every bootstrap, and four of them cited a .gitignore line range that had moved. The steps:
  load the tool schema before declaring blindness; install vm-git-guard; read the binding docs
  from origin/main; stamp GROUND. MEASURED 2026-10-02 at origin/main c145476c: 0 of 5 bootstraps
  named ToolSearch, vm-git-guard or `show origin/main`, and 4 of 5 cited `.gitignore:107-111`
  (the QA sinks are now at 115-119). Station 06 corrected all five files on Marco's PC on
  2026-10-02 with Marco's approval (marker BOOTSTRAP_PREFLIGHT_V1, backups in
  Scheduled\_backup-2026-10-02\). Nothing stops them drifting again.
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pipeline/__tests__/*.mjs" &&
  grep -q "BOOTSTRAP_PREFLIGHT_CHECK_V1" scripts/pipeline/lint-station.mjs &&
  test -f scripts/pipeline/__tests__/lint-station.bootstrap-check.test.mjs &&
  node scripts/pipeline/lint-station.mjs
scope:
  - scripts/pipeline/lint-station.mjs
  - scripts/pipeline/__tests__/lint-station.bootstrap-check.test.mjs
size: 2
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  One additional check in a linter. Reverting removes it; the bootstraps themselves are untouched.
escalates: false
module: pipeline
---

# lint-station: check the scheduled-task bootstraps when they are on this machine

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-02)

Station 06 fixes the bootstraps directly (done, with backups), **plus a check** so they cannot
silently drift again.

**Be honest about where it runs.** GitHub CI cannot see Marco's PC, so in CI this check skips.
It runs wherever `lint-station.mjs` runs on the Windows host, which is every station run that
follows its doc. Say exactly that in the PR body; never describe it as a CI gate.

Tag the new code with `BOOTSTRAP_PREFLIGHT_CHECK_V1`.

## What to build in `scripts/pipeline/lint-station.mjs`

1. **Find the folder.** `process.env.PO_BOOTSTRAP_DIR` if set, else
   `join(process.env.USERPROFILE ?? '', 'Claude', 'Scheduled')`. If it does not exist, print one
   line, `bootstraps: SKIP (no bootstrap folder on this machine - checked <path>)`, and continue.
   **A skip is not a pass.** Print it in yellow and never count it as ADMIT evidence.
2. **Which files.** Every `<dir>/<name>/SKILL.md` where `<name>` does **not** start with `_`
   (that skips `_retired-*` and `_backup-*`) **and** the file contains a line starting
   `## STEP 1`. A task with no STEP block, such as `weekly-security-audit`, is reported as
   `bootstraps: <name> has no STEP block - not checked` and is not a failure.
3. **What each must contain** (literal substring checks):
   - `ToolSearch`
   - `vm-git-guard`
   - `show origin/main`
   - `GROUND block`
4. **What none may contain:** a `.gitignore` line citation, regex `/\.gitignore:\d+/`. Cite the
   comment anchor instead.
5. Each missing or forbidden item is a REJECT line naming the file and the item. The overall exit
   code follows the existing ADMIT/REJECT convention.

Keep every existing check unchanged. Do not read or print the bootstraps' content beyond the
failing item: they are Marco's files.

## Tests: `scripts/pipeline/__tests__/lint-station.bootstrap-check.test.mjs`

Point `PO_BOOTSTRAP_DIR` at a temp folder:

1. A complete bootstrap: no bootstrap REJECT.
2. One missing `vm-git-guard`: REJECT naming that file and item.
3. One containing `.gitignore:107-111`: REJECT.
4. `_backup-x/a/SKILL.md` with nothing in it: ignored.
5. A folder with no `## STEP 1`: reported as not checked, no REJECT.
6. **Negative control:** `PO_BOOTSTRAP_DIR` pointing at a path that does not exist: prints SKIP,
   no REJECT, and the SKIP line is present in the output.

Run `node scripts/pipeline/lint-station.mjs` on the Windows host before opening the PR and paste the
bootstrap lines into the PR body. All five corrected bootstraps should pass.
