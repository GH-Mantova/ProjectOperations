# Stations 00, 03 and 05 have not fired for nine to eleven days — 04 is the only station still on its cadence

- **Raised by:** Station 00 (scheduled), run 2026-10-06T22:14Z
- **SHA it was true at:** `origin/main` ef8634d4 (9b7e1b8b at run start; #2252 merged mid-run)
- **Instruments:** scheduled-tasks MCP `list_scheduled_tasks`; `node scripts/pipeline/check-breadcrumb.mjs --freshness`; session-folder `CreationTimeUtc` scan

## What was measured

`--freshness` (exit 2) at 22:17Z:

```
00  last 2026-09-25T04:15:00Z  282.1h ago  (cadence 1h + grace 0.5h)  MISSED
03  last 2026-09-27T21:44:00Z  216.6h ago  (cadence 24h + grace 3h)   MISSED
04  last 2026-10-06T22:10:00Z    0.2h ago  (cadence 4h + grace 1h)    ok
05  last 2026-09-24T14:23:00Z  296.0h ago  (cadence 24h + grace 3h)   MISSED
MISSED: 3 station(s) past cadence + grace
```

`list_scheduled_tasks` — all three are **`enabled: true`** with a valid `nextRunAt`:

| task | cron | lastRunAt | gap |
|---|---|---|---|
| 00-supervisor | `5 * * * *` (hourly) | 2026-10-06T22:14:01Z — **this run** | ~280 hourly occurrences since the last breadcrumb |
| 03-machine-minder | `0 9 * * *` (daily) | 2026-09-27T21:42:40Z | 9 daily occurrences |
| 04-scanner | `0 */4 * * *` | 2026-10-06T22:09:40Z | none — healthy |
| 05-sot-keeper | `10 0 * * *` (daily) | 2026-09-27T21:38:18Z | 9 daily occurrences |

**Classification (FRESHNESS_ONE_CADENCE_V1): `never fired`, not `fired and died`.** Session-folder
scan of `local-agent-mode-sessions` at depth 3, 7460 directories, cutoff 3 days:

```
RECENT_3D=2 station sessions
  3b3abd4d  2026-10-06T22:14:01Z   <- this run (00)
  2712b3b4  2026-10-06T22:09:40Z   <- 04-scanner
```

No other station session folder exists in three days. A depth-1 scan of the same root returned
**0 folders in 7 days** — refuted on the spot by this run's own folder, so the depth-1 reading was a
§9.6 false negative and is not the basis of anything here. Positive controls: this run's folder and
04's folder, both found. Negative control: no folder at any 00 hourly slot between 2026-10-03 and
2026-10-06.

**So the occurrences did not execute.** `lastRunAt` for 03 and 05 has not advanced in nine days
while `nextRunAt` keeps being recomputed, and no session folder was created at any of those slots.

## Why this is yours and not mine

The station doc is explicit on what a MISSED reading does and does not authorise:

> **Allowed on a MISSED reading: report the classification in your breadcrumb.** If a station has
> **never fired** on two consecutive occurrences, escalate to Marco. **Forbidden on this reading
> alone:** disabling, enabling, running, re-running or editing any scheduled task (DOCTRINE §7).

03 and 05 are at nine consecutive never-fired occurrences; 00 is at roughly 280. That is far past
the two-occurrence escalation trigger, and the remedy — anything that touches the scheduled-task
store — is on the forbidden list for this reading. **I have changed no scheduled task.**

## What it has already cost

- **The board ran for eleven days with no supervisor.** PRs #2244–#2252 all merged on 2026-10-06
  with no Station 00 breadcrumb anywhere in that window — i.e. by hand.
- **`/sot/` has had no keeper for nine days** (05 is the only station that may edit it).
- **No machine-minder for nine days**, across seven `WATCHER-CRASH-LOOP-*` snapshots dated
  2026-10-03 to 2026-10-06 sitting unread in `needs-marco/`.
- 03's own last breadcrumb (2026-09-27T21:44Z, still untracked) is titled *"the keepalive was
  disabled one second before the watcher stopped and nothing has run since"* — same date as 03's and
  05's last run, and a likely common cause worth reading first.

## Options — RULE 1 applied

**Option A — complete and additive, and it is the one I recommend.** Find out why the scheduler
stops firing some tasks while 04 keeps running, fix that, and add a detector that cannot itself go
quiet. Start from 03's 2026-09-27 breadcrumb on the keepalive, since 03 and 05 died within four
minutes of each other on that date. Then add a check that alarms on `lastRunAt` not advancing past
cadence — `--freshness` reads *breadcrumbs*, so a station that never fires is invisible to it until
someone runs 00 by hand, which is exactly the circular failure that hid this for eleven days.
*Solves it immediately* (the tasks fire again) *and in future* (the silence is detected next time),
and *damages no data entry* — nothing is deleted and no prompt state changes.

**Option B — re-enable or recreate the three tasks and watch them.** Toggle 00/03/05 off and on, or
delete and recreate them, then confirm `lastRunAt` advances. Fails the *future* half of RULE 1: if
the cause is the keepalive or the interactive-logon dependency, the same silence returns and nothing
detects it. It also needs your hands either way — a station may not touch the task store.

**Option C — leave the cadence and drive the board by hand.** This is the status quo of the last
eleven days. Fails the *immediate* half: `/sot/` stays unkept, crash-loop snapshots stay unread, and
the breadcrumb channel — the only one that closes — stays open-circuit.

## What I need from you

1. Is the eleven-day 00 silence news to you, or did you stop the schedule deliberately?
2. If not deliberate: may I open a diagnostic prompt against the keepalive / scheduler chain
   (Option A's first half), reading only, no task-store writes?
3. The task store itself is yours — a station may not enable, disable, run or edit a scheduled task.

**Falsifying probe:** read `lastRunAt` for 00, 03 and 05 from the scheduled-tasks MCP after the next
occurrence of each. If any has advanced without a human intervening, this escalation is wrong and
must be re-measured.
