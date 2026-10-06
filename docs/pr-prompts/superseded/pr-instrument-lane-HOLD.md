---
premise: '! test -f scripts/pipeline/check-instrument-lane.mjs'
premise_means: >-
  Every PR that repairs the pipeline's own reporting and checking tools waits for Marco to release
  it, however small and green, and some of those tools kept misreporting to every station while the
  fix waited (e.g. status-sweep's false "TRUNK IS RED", fixed in #1852, which sat green for days).
  DOCTRINE section 10.1 step 3 says a new merge lane outside tests/docs needs a CI gate that proves
  its boundary: "a lane with no such gate is self-declaration". MEASURED 2026-10-03 at origin/main
  8ed747e0: no lane allowlist, no boundary checker, no CI step. Source:
  needs-marco/instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md.
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pipeline/__tests__/*.mjs" &&
  test -f scripts/pipeline/instrument-lane.json &&
  test -f scripts/pipeline/check-instrument-lane.mjs &&
  grep -q "check-instrument-lane.mjs" .github/workflows/ci.yml &&
  grep -q "INSTRUMENT_LANE_V1" docs/pipeline/stations/00-supervisor.md &&
  node scripts/pipeline/lint-station.mjs
scope:
  - scripts/pipeline/instrument-lane.json
  - scripts/pipeline/check-instrument-lane.mjs
  - scripts/pipeline/__tests__/check-instrument-lane.test.mjs
  - .github/workflows/ci.yml
  - docs/pipeline/stations/00-supervisor.md
  - docs/pipeline/DOCTRINE.md
  - docs/pipeline/stations/_canonical-blocks.json
size: 3
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  An allowlist, a checker, one CI step and two doc paragraphs. Reverting removes the lane; every
  pipeline PR goes back to needing Marco. No merged code changes.
escalates: true
module: pipeline
---

# An instrument lane: Station 00 may merge narrow fixes to reporting and checking tools

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-03)

**A narrow lane for instrument fixes.** Station 00 may merge a PR on its own only when **all** of
these hold:

1. a CI check proves every changed file is in an allowlist of reporting and checking tools;
2. CI is green;
3. a fresh MERGE verdict exists for that exact commit.

**Never in the lane, so always Marco's:** the watcher, the merge and arm scripts, CI workflows,
DOCTRINE and station instructions, anything under `apps/` or the database. Each lane merge leaves a
written note for Marco.

**Go/no-go, check first:** `git grep -q VERDICT_HEAD_SHA_ANCHOR_V1 origin/main -- scripts/pr-watcher/index.mjs`.
If it is absent (#2221 not merged), stop with NO-OP: condition 3 needs verdicts tied to a commit.

Tag the new code and doc paragraphs with `INSTRUMENT_LANE_V1`.

## 1. The allowlist: `scripts/pipeline/instrument-lane.json`

Exact paths, no broad globs except for tests:

```json
{ "files": [
    "scripts/pipeline/status-sweep.ps1",
    "scripts/pipeline/check-breadcrumb.mjs",
    "scripts/pipeline/lint-prompt.mjs",
    "scripts/pipeline/lint-station.mjs",
    "scripts/pipeline/check-queue-layout.mjs",
    "scripts/pipeline/queue-layout.mjs",
    "scripts/pipeline/triage-holds.ps1",
    "scripts/pipeline/check-escalations.mjs",
    "scripts/pipeline/check-backlog.mjs",
    "scripts/pipeline/check-d-register.mjs",
    "scripts/pipeline/check-sot-refs.mjs",
    "scripts/pipeline/check-hex-ratchet.mjs",
    "scripts/pipeline/module-baseline.json"
  ],
  "tests": [ "scripts/pipeline/__tests__/**" ],
  "_readme": "..." }
```

Include only files that exist on main; drop any that do not, and say which in the PR body. The
`_readme` states the ruling, the never-list, and that **this file is not in the lane**: changing the
allowlist always needs Marco.

**Explicitly not listed** (name them in `_readme`): `pipeline-lib.ps1`, `arm-prompt.ps1`,
`new-worktree.ps1`, `retire-escalation.mjs`, `dispatch.mjs`, everything under `scripts/pr-watcher/`,
`scripts/pr-gates/`, `.github/`, `docs/`, `sot/`, `apps/`, `prisma`.

## 2. The checker: `scripts/pipeline/check-instrument-lane.mjs`

`node scripts/pipeline/check-instrument-lane.mjs --range <base>...<head>`

- Lists changed paths with `git diff --name-only <range>` (all statuses, including deletes and
  renames on both sides).
- **IN_LANE** when every path is in `files` or matches `tests`, there is at least one path, and
  `instrument-lane.json` itself is unchanged. Otherwise **OUT_OF_LANE**, naming every offending path.
- Prints the verdict as the last line (`INSTRUMENT_LANE: IN_LANE` or `INSTRUMENT_LANE: OUT_OF_LANE`).
  Exit 0 either way, because being out of lane is normal and not a CI failure.
- Exits 2 with `[CANNOT MEASURE]` when the range cannot be read. Never print IN_LANE when nothing was
  read.
- Prints controls first (one in-lane path, one out-of-lane path) and exits 2 if either misclassifies,
  following `check-pr-title.mjs`.

## 3. CI: `.github/workflows/ci.yml`

In the `pipeline-tests` job (already `fetch-depth: 0`), add a PR-only step running the checker
against `origin/${{ github.base_ref }}...HEAD`. Write its last line to the job summary
(`$GITHUB_STEP_SUMMARY`) so it is readable from the PR. This step is evidence, not a required check.
Do not change any other step or job.

## 4. `docs/pipeline/stations/00-supervisor.md`: the merge rule

Add an INSTRUMENT LANE paragraph to the merge section. Station 00 may merge a PR **without Marco
removing a label** only when all of these hold:

- the PR carries **no** `do-not-merge` label (a labelled PR is always Marco's to release; the lane
  never removes a label);
- the CI job summary for the **current head** says `INSTRUMENT_LANE: IN_LANE`;
- all required checks are green on the current head;
- the review verdict reads MERGE **and** its `REVIEWED-SHA` equals the current head.

Then merge through `Merge-Pr` as usual, and post this comment on the PR:
`Merged via the instrument lane (INSTRUMENT_LANE_V1): files <list>; verdict reviewed <sha>; CI green.`
Name it in the run's breadcrumb under a heading **Instrument-lane merges**. If any condition fails,
the PR stays for Marco, as today.

## 5. `docs/pipeline/DOCTRINE.md`, section 10.1

Add one paragraph: the instrument lane exists from 2026-10-03, its boundary is
`instrument-lane.json` enforced by `check-instrument-lane.mjs`, it never applies to a labelled PR,
and the allowlist itself is Marco's. Run `lint-station.mjs` and re-record canonical hashes if it
asks.

## Staging note (put this in the PR body)

Prompts that only touch in-lane files can now be staged with `escalates: false`, so no label is
applied and the lane can take them. Prompts already staged with `escalates: true` keep their label
and stay Marco's.

## Tests: `scripts/pipeline/__tests__/check-instrument-lane.test.mjs`

A temp `git init` repo with commits:

1. Change only `status-sweep.ps1` and a test file: `IN_LANE`.
2. Also change `pipeline-lib.ps1`: `OUT_OF_LANE`, naming it.
3. Change `instrument-lane.json` (even adding an entry): `OUT_OF_LANE`.
4. Delete an in-lane file: still checked (`IN_LANE`). A rename to an out-of-lane path:
   `OUT_OF_LANE`.
5. An empty diff: `OUT_OF_LANE`, because nothing was proven.
6. An unreadable range: exit 2, never `IN_LANE`.
7. **Negative control:** a change under `apps/` alone: `OUT_OF_LANE`.

`escalates: true`: it creates a merge path without Marco. The PR opens labelled `do-not-merge`, and
Marco releases it.
