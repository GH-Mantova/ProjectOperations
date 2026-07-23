---
premise: '! grep -q "verdicts-archive" scripts/pr-watcher/index.mjs'
premise_means: >
  The watcher has no verdict-archival sweep yet - review verdict files accumulate untracked in
  the live clone forever. Dies the moment the archival code lands on main.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/README.md
  - scripts/pr-watcher/__tests__/verdict-archival.spec.mjs
size: 3
escalates: false
done_when: >
  grep -q "verdicts-archive" scripts/pr-watcher/index.mjs AND
  scripts/pr-watcher/__tests__/verdict-archival.spec.mjs exists and passes under node --test AND
  the PR is open with all required checks green.
---

# Watcher: archive settled review verdicts out of the clone tree

## STATUS

The reviewer writes `docs/pr-reviews/pr-{N}-review.md` as an UNTRACKED file in the live watcher
clone and nothing ever removes it. Consequences, all observed on 2026-07-23: the clone
permanently reads dirty (status-sweep flags "NOT clean-on-main" after every review cycle), every
crash or clean-tree operation risks silently deleting verdicts (31 of them had to be rescued by
hand into PR #768), and recovery resets must stop to triage them.

The verdict files CANNOT simply be relocated at write time: the tests-docs auto-merge path and
`mirrorVerdictToPr` both read `docs/pr-reviews/pr-{N}-review.md` for OPEN PRs. The fix is
archival AFTER a verdict's PR is settled.

## THE WORK

In `scripts/pr-watcher/index.mjs`:

1. Add `archiveSettledVerdicts()`: for each file matching `docs/pr-reviews/pr-(\d+)-review.md`
   in the clone, query `gh pr view <N> --json state`. If state is MERGED or CLOSED, move the
   file to `path.join(REPO_ROOT, "..", "verdicts-archive")` (create the dir if absent; it sits
   OUTSIDE the repo tree so git never sees it). If the state query fails, leave the file in
   place and log - never delete on a failed read (a failed call is not a meaningful answer).
   Files for OPEN PRs stay exactly where they are.
2. Call it once at watcher startup and once per idle poll cycle. It must never throw into the
   main loop - catch, log, continue.
3. In `mirrorVerdictToPr`, keep the existing best-effort behaviour but upgrade the failure log
   line to include the PR number and gh stderr so a silent mirror gap is diagnosable later.

Add `scripts/pr-watcher/__tests__/verdict-archival.spec.mjs` covering: merged-PR verdict moves;
open-PR verdict stays; failed state query leaves the file and does not throw.

Update `scripts/pr-watcher/README.md`: document the archival sweep and the
`..\verdicts-archive` location in the review-flow section.

## DO NOT

- Do NOT touch how or where verdicts are WRITTEN, the tests-docs auto-merge logic, or the
  dispatch loop.
- Do NOT add `docs/pr-reviews/` to any gitignore - PR #768 tracks review files on main and
  gitignoring a tracked path re-conflicts (LL: gitignored-but-tracked).
- Do NOT delete any verdict file. Archival is a MOVE, always.
- Spec-and-watcher-code only; no app code, no `sot/`.

## VERIFY

- `node --test scripts/pr-watcher/__tests__/verdict-archival.spec.mjs` exits 0.
- `pnpm lint` passes for the touched files.
- `grep -q "verdicts-archive" scripts/pr-watcher/index.mjs` exits 0 (the premise above now dies).

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED. It does not mean "wait for
approval before starting". There is no human in this run. Finishing the work and then asking
for permission is indistinguishable from failing - the work is discarded either way.
