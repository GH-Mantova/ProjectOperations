---
premise: '! grep -q "HEARTBEAT_ALARM_TEXT_V1" scripts/pipeline/status-sweep.ps1'
premise_means: status-sweep.ps1 still reports a failing "Pipeline heartbeat" run as a COUNT only, so the one workflow whose entire payload is the sentence "NO station has reported for Nh" contributes no words to the 467-line report every station reads.
scope:
  - scripts/pipeline/status-sweep.ps1
done_when: pnpm build && pnpm lint && grep -q "HEARTBEAT_ALARM_TEXT_V1" scripts/pipeline/status-sweep.ps1 && grep -q "log-failed" scripts/pipeline/status-sweep.ps1
size: 1
gate_allow: none
seed_only: false
escalates: false
module: pipeline
station: '01'
---

# Quote the CI heartbeat's alarm sentence in the sweep, not just its failure count

Staged by Station 00, 2026-10-08T23:2xZ, against `origin/main` `375f4386`. Raised as **F3** in
breadcrumb
`00-00-supervisor-2026-10-08-2238-all-four-stations-never-fired-for-41h-while-the-box-stayed-up-and-no-hold-is-armable.md`.

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

**Scope is one file, and that file is the FIRST entry in `scripts/pipeline/instrument-lane.json`'s
`files` list**, so the resulting PR is `IN_LANE` under INSTRUMENT_LANE_V1 and Station 00 may merge
it on green CI plus a fresh MERGE verdict for the head. Do not widen the scope: adding any second
file, and in particular touching `instrument-lane.json` itself, routes the PR to Marco.

## The defect, as measured

[MEASURED] 2026-10-08T22:5xZ by Station 00, in a live run. `check-pipeline-heartbeat.mjs` had
failed four consecutive scheduled runs on head `375f4386`, each carrying the real alarm:

```
gh run view 37826381004 --log-failed
node scripts/pipeline/check-pipeline-heartbeat.mjs --hours "6"
[heartbeat] SILENT: NO station has reported for 37.5h (threshold 6h). Newest is station 00 at
2026-10-07T05:14:00Z. Either the scheduler is off, the machine is down, or the app is not running.
If this was deliberate, declare it in docs/pipeline/pause.json.
##[error]Process completed with exit code 1.
```

POSITIVE control on the detector itself: `run=37604836905`, **same head `375f4386`**, four hours
before the first failure, concluded `success`. So it reads both ways and is not stuck.

[MEASURED] everything `status-sweep.ps1` said about those four runs, in a 467-line report:

```
[LIVE]    NOT trunk CI on this commit, excluded from the verdict above: 5 run(s), 4 failing
[LIVE]       Pipeline heartbeat: 5 run(s), 4 failing
```

[MEASURED] `git grep -n -i heartbeat origin/main -- scripts/pipeline/status-sweep.ps1` returns 14
hits, **every one of them about the watcher's `scripts/pr-watcher/heartbeat.log`** (the mid-run
build tick). None is about the CI workflow. The words `NO station has reported` appear nowhere in
the report.

## What this is NOT — read this before changing anything

`scripts/pipeline/status-sweep.ps1:201-204` already carries the fix for the 2026-09-09 version of
this problem, and its comment must not be reverted or duplicated:

```
# Reported on their OWN line, never folded into the verdict above. The genuine signal inside
# these is easy to lose in an aggregate: on 2026-09-09 five failing "Pipeline heartbeat" runs
# were carrying a real SILENT-stations alarm, and the aggregate count hid it rather than
# surfaced it. Excluding them from the verdict must not mean hiding them.
```

That fix is why the per-workflow `Pipeline heartbeat: 5 run(s), 4 failing` line exists at all. The
remaining gap is one notch narrower: **the fix made the count visible, and this alarm's payload is
not a count.** Do not re-litigate the exclusion from the trunk verdict — a scheduled cron run is
genuinely not trunk CI, and folding it back in is the 2026-09-09 defect in reverse.

## The change

In `scripts/pipeline/status-sweep.ps1`, inside the `foreach ($wfKey in $onames.Keys)` loop that
prints the per-workflow excluded-run lines (around line 216), add: when `$wfKey` is
`Pipeline heartbeat` **and** its failing count is greater than zero, resolve the newest failing run
for that workflow and print its alarm sentence as its own `[LIVE]` line, directly beneath the
count.

Required properties, all of them:

1. **Additive only.** The existing `NOT trunk CI …` line and every per-workflow count line keep
   their exact current wording and position. A reader who relies on the count loses nothing. No
   line is removed, re-ordered or re-worded.
2. **Carry the marker `HEARTBEAT_ALARM_TEXT_V1`** in a comment next to the new block, so the
   premise above can never be satisfied by an unrelated edit.
3. **Tag the new line correctly.** It quotes a GitHub-side read, so it is `Line "LIVE"`. If the
   run's log cannot be fetched, print `[CANNOT MEASURE]` naming the run id and why — never omit
   the line silently, and never let a failed fetch print as "no alarm". DOCTRINE section 7: a tool
   that cannot run must fail loud, never fail quiet.
4. **Bound the cost.** Fetch at most ONE run's log — the newest failing one for that workflow —
   and nothing when the failing count is zero. The sweep already takes ~190 s; this must not add a
   second GitHub round trip per run.
5. **Do not trust a pipe into `Where-Object`.** DOCTRINE section 7 standing guard 8 and section 9.4:
   take raw `--json` and `ConvertFrom-Json`, then **assign to a variable and `foreach`** over it.
   A JSON array piped straight into `Where-Object` collapses to one object, which is the bug that
   once let the merge queue select #552.
6. **Extract the sentence, not the whole log.** Match lines beginning `[heartbeat]` out of
   `gh run view <id> --log-failed` and print the first one, trimmed. The log is tens of kilobytes;
   printing it would bury the thing this change exists to surface.
7. **No `$` in any `-Command` string** if you shell out at all (DOCTRINE section 9.1), and do not
   use `>` or `Out-File` to stage intermediate text — both write UTF-16LE and `Select-String`
   then silently matches nothing (section 9.3).

## Prove it with a POSITIVE control, not with an opinion

DOCTRINE section 7: a check never seen to succeed is not a check, and this change exists because a
negative reading was indistinguishable from silence.

- **Positive:** run the sweep (or a scoped harness around the new block) against a commit whose
  `Pipeline heartbeat` runs include a failure, and show the alarm sentence appearing in the output.
  `run=37826381004` on head `375f4386f3c1d7fd8fa6dc2cf8a01839b5772f8e` is a real failing run with a
  real `[heartbeat] SILENT:` line; `run=37604836905` on the same head is a real `success`.
- **Negative:** against a workflow with zero failures, show that **no** alarm line is printed and
  **no** log fetch is made.
- Quote both readings in the PR body. `Assert-BodyClaimsAreReal` greps the diff for what the body
  claims.

## Do NOT

- Do not touch `scripts/pipeline/instrument-lane.json`. Changing the allowlist is Marco's and
  immediately puts the PR outside the lane.
- Do not touch `check-pipeline-heartbeat.mjs`. It is correct — it was right and loud for 28 hours.
  This prompt is about the reader, not the detector.
- Do not change the heartbeat threshold, the cron, or `docs/pipeline/pause.json`.
- Do not fold the heartbeat runs back into the trunk-CI verdict (see "What this is NOT").
- Do not add a second file to the scope.
