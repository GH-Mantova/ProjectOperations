---
premise: grep -q 'LastWriteTime.ToString("MM-dd HH:mm")' scripts/pipeline/status-sweep.ps1
premise_means: status-sweep.ps1 still renders file timestamps in machine-local time inside a report whose other timestamps are UTC.
scope:
  - scripts/pipeline/status-sweep.ps1
done_when: pwsh -NoProfile -File scripts/pipeline/status-sweep.ps1 > /dev/null && ! grep -q 'LastWriteTime.ToString("MM-dd HH:mm")' scripts/pipeline/status-sweep.ps1
size: 1
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# status-sweep prints two timestamps in local time, unmarked, in a UTC report

## The defect

`scripts/pipeline/status-sweep.ps1` renders file mtimes with
`$f.LastWriteTime.ToString("MM-dd HH:mm")` — **local** time, and **no `Z`** — at two sites, inside a
report whose GitHub section and closing line both carry explicit `Z`. The host runs
`E. Australia Standard Time` (UTC+10), so every file timestamp in the sweep reads **ten hours
fresher than it is**, and reads that way next to UTC lines that invite direct comparison.

- **`:279`** — the recent-failures / queue-reason list (`[LIVE] MM-dd HH:mm  <file>  ::  <reason>`).
- **`:302`** — `[FILE] freshest station summary: <name>  (MM-dd HH:mm)`.

Both feed freshness judgements. `:302` is the line a station reads to decide whether the last
station summary is worth trusting.

## Evidence [MEASURED] 2026-09-01T10:1xZ @ origin/main 605aca10

```
(Get-TimeZone).Id                                         -> E. Australia Standard Time  (UTC+10)
(Get-Item docs/pr-prompts/queue-watch-state.md).LastWriteTimeUtc -> 2026-08-31 20:26:21Z
status-sweep.ps1 §4C printed                              -> "queue-watch-state.md  (09-01 06:26)"
status-sweep.ps1 closing line printed                     -> "SWEEP COMPLETE 2026-09-01 10:11:36Z"
```

The same file is 13.8 h old; the sweep presents it as 3.8 h old, in a report stamped `Z`.

Positive control that the UTC lines really are UTC, so the mismatch is in these two sites and not
in the whole report:

```
gh pr view 1487 --json mergedAt  ->  2026-09-01T09:38..Z    (matches §1's "#1487  2026-09-01 09:38Z")
```

Negative control — the two offending sites are the only local-time renders:

```
Select-String -Path scripts/pipeline/status-sweep.ps1 -Pattern 'LastWriteTime\b'
  -> :143 (age arithmetic only, no render)  :269 (Sort-Object)  :279 (RENDER)
     :299 (Sort-Object)  :302 (RENDER)
```

`:143` computes an age in minutes from `LastWriteTime` against `Get-Date` — both local, so the
subtraction is correct and must **not** be changed to a mixed pair.

## The work

At `:279` and `:302` only, render UTC and say so:

```powershell
$f.LastWriteTimeUtc.ToString("MM-dd HH:mm") + "Z"
```

Leave `:143`, `:269` and `:299` alone — `:143` is arithmetic between two local values, and the two
`Sort-Object` calls are ordering, not display.

Re-run the sweep and confirm §4C's freshest-summary timestamp now matches
`(Get-Item <that file>).LastWriteTimeUtc` to the minute. That readback is the acceptance test; a
green build is not.

## Lane note

`scope` is `scripts/pipeline/**`, which is outside `^(tests|docs)/`, so `classifyPolicyFiles` routes
the resulting PR to **Marco** and the watcher will not auto-merge it. That is correct and expected —
do not try to widen the lane to get it merged.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**Marco's lane means: open the PR and LEAVE IT UNMERGED.** It does not mean "wait for approval
before starting". There is no human in this run. **Finishing the work and then asking for
permission is indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
