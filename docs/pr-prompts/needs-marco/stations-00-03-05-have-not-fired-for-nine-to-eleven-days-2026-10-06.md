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

---

## UPDATE 2026-10-07T00:21Z — the falsifying probe above has FIRED, and it narrows this to ONE station

Added by Station 00 (scheduled), run 2026-10-07T00:14Z, `origin/main` `f88f8e37`. The probe this
file names was run exactly as written: `lastRunAt` read from the scheduled-tasks MCP after the next
occurrence of each.

| task | cron | `lastRunAt` at 00:21Z | verdict against this escalation |
|---|---|---|---|
| 00-supervisor | `5 * * * *` | **2026-10-07T00:14:02Z** — this run | **ADVANCED** — firing hourly again (22:14Z, 23:14Z, 00:14Z) |
| 03-machine-minder | `0 9 * * *` | **2026-10-06T23:02:55Z** | **ADVANCED** — fired on its next occurrence |
| 04-scanner | `0 */4 * * *` | 2026-10-06T22:09:40Z | never in question; still healthy |
| 05-sot-keeper | `10 0 * * *` | **2026-09-27T21:38:18Z** | **NOT ADVANCED** — its 2026-10-06T14:22Z occurrence did not fire |

**So two thirds of this escalation is answered and the remaining third is `05-sot-keeper` alone.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` (exit 2) agrees from the other instrument:
`00 ... 1.0h ago ok`, `03 ... 1.2h ago ok`, `04 ... 2.1h ago ok`, `05 last 2026-09-24T14:23:00Z
297.9h ago MISSED`, `MISSED: 1 station(s)`.

⚠️ **I cannot tell you WHY 00 and 03 recovered, and that matters more than the recovery.** The probe
asks whether `lastRunAt` advanced "without a human intervening" and I have no instrument that
answers the human half — `lastRunAt` records that a run happened, never who caused it. So this is
**[MEASURED]** that they advanced and **[CANNOT MEASURE]** whether you did something on 2026-10-06
to make that happen. If you did not touch them, then two tasks resumed on their own after nine and
eleven days of silence, which makes the cause intermittent rather than fixed, and Option A's second
half — a detector that alarms on `lastRunAt` not advancing — is the only thing that would catch the
next occurrence.

**Nothing in the task store was touched by this run.** Not enabled, not disabled, not run, not
edited — the forbidden list in the station doc is unchanged and was obeyed.

**Questions 1–3 above are narrowed, not withdrawn:**

1. Still open, and now specifically: did you restart 00 and 03 on 2026-10-06, or did they resume by
   themselves?
2. Still open and unchanged — may a diagnostic prompt read the keepalive / scheduler chain?
3. Unchanged: the task store is yours. **05 is still silent and only you can restart it.**

**Next falsifying probe, same shape:** read `lastRunAt` for `05-sot-keeper` after its next
occurrence, **2026-10-07T14:22:37Z** (`nextRunAt`, measured this run). If it advances, the last third
of this escalation is answered too and the whole file can be discharged.
