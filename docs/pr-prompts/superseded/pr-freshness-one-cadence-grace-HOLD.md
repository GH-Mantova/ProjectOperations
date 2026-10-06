---
premise: '! grep -q "FRESHNESS_ONE_CADENCE_V1" scripts/pipeline/check-breadcrumb.mjs'
premise_means: >-
  check-breadcrumb.mjs --freshness calls a station SILENT only past 2x its cadence
  (`const over = ageH > hrs * 2;`), so a daily station can miss one whole occurrence and still print
  `ok`. MEASURED 2026-10-03 at origin/main 8ed747e0: CADENCE = { '00': 1, '02': null, '03': 24,
  '04': 4, '05': 24 }, and the threshold multiplier is 2. Station 00's cadence was already
  corrected to hourly in #2090. Worked instances: 03-machine-minder printed `40.1h ago (cadence 24h)
  ok` on 2026-09-03 after never firing on 09-02, and 03 and 05 did the same on 09-02. Source:
  needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md (escalation #23).
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pipeline/__tests__/*.mjs" &&
  grep -q "FRESHNESS_ONE_CADENCE_V1" scripts/pipeline/check-breadcrumb.mjs &&
  grep -q "FRESHNESS_ONE_CADENCE_V1" docs/pipeline/stations/00-supervisor.md &&
  test -f scripts/pipeline/__tests__/check-breadcrumb.freshness-grace.test.mjs &&
  node scripts/pipeline/lint-station.mjs
scope:
  - scripts/pipeline/check-breadcrumb.mjs
  - scripts/pipeline/__tests__/check-breadcrumb.freshness-grace.test.mjs
  - docs/pipeline/stations/00-supervisor.md
  - docs/pipeline/stations/_canonical-blocks.json
size: 2
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  A threshold and a label in one checker plus one station-doc paragraph. Reverting restores the
  2x rule. Nothing acts on the reading except reports.
escalates: true
module: pipeline
---

# Freshness: one missed run alarms; a station only reports and investigates on it

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's rulings (2026-10-03)

1. **Alarm at 1x cadence plus a grace.** The grace absorbs schedule jitter: station 00 (hourly)
   +30 min, 04 (4-hourly) +1 h, 03 and 05 (daily) +3 h. The word becomes **MISSED**, because the
   checker cannot tell "never fired" from "fired and died before reporting".
2. **Report and investigate only.** On a MISSED reading, Station 00 cross-checks, names the cause,
   and escalates if a station is actually stopped. It **never** disables, re-enables, re-runs or edits
   a scheduled task on this reading alone.

Tag the changes with `FRESHNESS_ONE_CADENCE_V1`.

## 1. `scripts/pipeline/check-breadcrumb.mjs`

- Keep `CADENCE` as it is. Add `GRACE_HOURS = { '00': 0.5, '04': 1, '03': 3, '05': 3 }` beside it,
  with a comment carrying the ruling's date.
- The threshold becomes `ageH > hrs + GRACE_HOURS[nn]`, replacing `hrs * 2`.
- The over-threshold label changes from `SILENT` to `MISSED`. Change the explanatory line to:
  `A MISSED station either never fired, fired and died before reporting (e.g. a turn-one API error),
  or reported in a PR not yet merged. Cross-check lastRunAt and the session folder before acting.`
  Update the header comment (`A station is SILENT past 2x its cadence`) and the summary line
  (`SILENT: n station(s) past cadence` → `MISSED: n station(s) past cadence + grace`).
- **Exit codes are unchanged** (2 still means a station is past threshold), so callers keep working.
- `NO BREADCRUMB EVER` and the dispatch-only `02` row are unchanged.
- The existing protections stay exactly as they are: reading `origin/main`, and counting a
  breadcrumb still inside an open PR (#1568, #1554). They are what stops merge latency reading as
  MISSED, and the tighter threshold depends on them more, not less.
- Search the repo for scripts or docs that **parse** the word `SILENT` from this output (for example
  `status-sweep.ps1`, station docs). Update any machine parsing to accept `MISSED`, and list every
  place in the PR body. Prose mentions in archived breadcrumbs stay as they are.

## 2. `docs/pipeline/stations/00-supervisor.md`

In the freshness step (the paragraph that already requires crossing `--freshness` against
`list_scheduled_tasks`' `lastRunAt`), add:

- **MISSED is a lead, not a verdict.** Classify each MISSED station as one of:
  - **never fired**: no session folder created at the expected time, and `lastRunAt` older than one
    cadence;
  - **fired and died**: a session folder exists, `lastRunAt` is fresh, and there is no breadcrumb.
    Read the transcript's first assistant turn;
  - **reported, not merged**: the breadcrumb is in an open PR.
- **Allowed action:** report the classification. If a station has **never fired** for two
  consecutive occurrences, escalate to Marco.
- **Forbidden on this reading alone:** disabling, enabling, running, re-running or editing any
  scheduled task.

Run `node scripts/pipeline/lint-station.mjs`. If it reports a canonical-hash change, re-record with
`--write-canonical` and commit `_canonical-blocks.json`.

## Tests: `scripts/pipeline/__tests__/check-breadcrumb.freshness-grace.test.mjs`

Export the threshold decision as a pure function (for example
`freshnessVerdict(station, ageHours)`) so it is testable without git. Then:

1. Station 03 at 26.9 h: `ok`. At 27.1 h: `MISSED`. Daily cadence 24 + grace 3.
2. Station 00 at 1.4 h: `ok`. At 1.6 h: `MISSED`.
3. Station 04 at 5.1 h: `MISSED`.
4. Station 02: `dispatch-only`, never MISSED.
5. **Negative control:** station 05 at 40 h. The old rule said `ok` (40 < 48); the new rule must say
   `MISSED`. This is the 2026-09-03 instance, and the test proves the blind spot is closed.

Existing `check-breadcrumb.*.test.mjs` suites stay green. Update an assertion on the word `SILENT`
only where it checks this output, and name it in the PR body.

`escalates: true`: it changes the only instrument that notices a stopped station. The PR opens
labelled `do-not-merge`, and Marco releases it.
