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

---

## UPDATE 2026-10-07T02:3xZ — a SECOND station confirms 05 independently, and the 14:22Z probe has not fired yet

Added by Station 00 (scheduled), run 2026-10-07T02:14Z, `origin/main` `500e07f3`. **Nothing is
discharged by this update** — the probe the section above names (`lastRunAt` for `05-sot-keeper`
after its next occurrence, `2026-10-07T14:22:37Z`) is still ~12 hours in the future at the time of
writing. This update exists because a different station reached the same verdict on different
instruments, which is worth recording before the probe fires.

**[MEASURED] Station 04's own run at 2026-10-07T02:10Z** (breadcrumb
`00-04-scanner-2026-10-07-0210-station-05-has-not-reported-for-twelve-days-and-capabilities-claims-the-bootstraps-are-unsplit-when-they-are-not.md`,
F1) read the scheduled-tasks MCP independently and got `05-sot-keeper` `enabled: true`,
cron `10 0 * * *`, **`lastRunAt 2026-09-27T21:38:18Z`** — byte-identical to the value this file
recorded at 00:21Z, i.e. the 2026-10-06T14:22Z occurrence still has not fired and nothing has moved
in the four hours between the two readings. 04 also confirmed from `--freshness` (exit 2) that
`00`, `03` and `04` all read `ok` while `05` alone reads `MISSED` at 299.9h.

**[MEASURED] Station 00's own reading this run, 02:15Z:** `--freshness` exit **2** —
`00 1.0h ago ok`, `03 3.2h ago ok`, `04 0.1h ago ok`,
`05 last 2026-09-24T14:23:00Z 299.9h ago MISSED`, `MISSED: 1 station(s)`. Three stations healthy in
the same output, so the validator can produce a positive and the single negative is meaningful.

🔧 **One new lead for you, and it is cheap to test first.** 04 points out that the open item
`needs-marco/weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md`
names, in its own title, a task store that **reverts verified writes**. That is a plausible mechanism
for exactly this failure — a task that reads back as `enabled: true` while the store has silently
discarded whatever makes it fire. If that is what is happening, then re-arming 05 will *appear* to
succeed and then quietly revert, so **confirm the re-arm by reading `lastRunAt` after 05's next
occurrence, not by reading `enabled` straight after the change.** This does not alter the options
above; Option A remains the recommendation, and the task store remains yours.

**[CANNOT MEASURE], unchanged from the 00:21Z update:** whether a human caused 00 and 03 to resume.
`lastRunAt` records that a run happened, never who caused it.

**Nothing in the task store was touched by this run** — not enabled, not disabled, not run, not
edited.

**Probe unchanged:** read `lastRunAt` for `05-sot-keeper` after `2026-10-07T14:22:37Z`. If it
advances, the last third of this file can be discharged via `retire-escalation.mjs`.


---

## UPDATE 2026-10-08T23:2xZ — the 14:22Z probe fired and ADVANCED, and it is still not discharged: ALL FOUR stations then lost 41 hours while the box stayed up for 72

Added by Station 00 (scheduled), run `2026-10-08T22:38:06Z`, `origin/main` `375f4386`. Breadcrumb
`00-00-supervisor-2026-10-08-2238-all-four-stations-never-fired-for-41h-while-the-box-stayed-up-and-no-hold-is-armable.md`,
F2. **Three things are new. None of them is a repeat of a measurement this file already holds, and
none of them discharges it.**

### 1. The named probe fired, and 05 moved

**[MEASURED]** scheduled-tasks MCP at `2026-10-08T22:38Z`: `05-sot-keeper`, `enabled: true`,
cron `10 0 * * *`, **`lastRunAt 2026-10-08T22:38:07.635Z`**. The value this file recorded five
times — `2026-09-27T21:38:18Z`, byte-identical at 00:21Z, 02:10Z (Station 04), 02:15Z, 02:3xZ and
05:16Z — **has advanced.** A session directory exists for it (`e8b11f9c`,
`CreationTimeUtc 2026-10-08T22:38:07.635Z`).

⚠️ **It did NOT advance on its cron, and that is why this is not a discharge.** 05's occurrence is
`10 0 * * *`. `00-supervisor` (`5 * * * *`) and `04-scanner` (`0 */4 * * *`) recorded `lastRunAt`
`2026-10-08T22:38:06.925Z` and `2026-10-08T22:38:07.297Z` — **all three inside 710 milliseconds.**
An hourly, a four-hourly and a daily cron cannot coincide to the millisecond. 05 fired inside a
**batch catch-up on resume**, not because its schedule started working.

The lead this file recorded at 02:3xZ — that
`needs-marco/weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md`
describes a store that reverts verified writes — is **neither confirmed nor refuted** by this. The
store did eventually fire 05; it did so 11 days and ~11 occurrences late, in a batch with two other
tasks.

### 2. It is no longer 00/03/05. It is all four, and the title's number is now wrong twice over

**[MEASURED]** `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit **2**, at 22:4xZ:

```
00  last 2026-10-07T05:14:00Z  41.5h ago   (cadence 1h + grace 0.5h)  MISSED
02  dispatch-only — no cadence to miss
03  last 2026-10-06T23:03:00Z  47.7h ago   (cadence 24h + grace 3h)   MISSED
04  last 2026-10-07T02:10:00Z  44.6h ago   (cadence 4h + grace 1h)    MISSED
05  last 2026-09-24T14:23:00Z  344.4h ago  (cadence 24h + grace 3h)   MISSED
MISSED: 4 station(s) past cadence + grace
```

**Every station on the board, including the two this file previously recorded as healthy.** At the
02:15Z reading above, `00`, `03` and `04` all read `ok` — that was the positive control then, and it
is gone now.

### 3. THE CONTROL THAT NAMES THE CAUSE: the box was up the entire time

This is the measurement that turns "never fired" from an inference into a reading, and it is the one
thing none of the three occurrences of this defect had before.

**[MEASURED]** the session store, scanned at the directory level with no name filter (1722
directories), newest first:

```
2026-10-08T22:38:07.635Z  e8b11f9c   <- 05  | three tasks,
2026-10-08T22:38:07.297Z  92b2ce5f   <- 04  | 710 ms apart
2026-10-08T22:38:06.924Z  2aba14e5   <- 00  |
          ---- 41.40 HOURS, ZERO SESSIONS CREATED ----
2026-10-07T05:14:05.513Z  651a203c   <- 00, on the hour
2026-10-07T04:14:04.980Z  66bece4f   <- 00, on the hour
2026-10-07T03:14:04.601Z  5c341624   <- 00, on the hour
2026-10-07T02:14:03.263Z  f40a42e7   <- 00, on the hour
2026-10-07T02:09:42.490Z  fca545bf   <- 04
2026-10-07T01:14:03.036Z  a29d014b
2026-10-07T00:14:02.637Z  d8485034
2026-10-06T23:14:02.134Z  63ed70d5
2026-10-06T23:02:55.016Z  30aa0612   <- 03, its last run to date
2026-10-06T22:14:01.315Z  3b3abd4d
2026-10-06T22:09:40.950Z  2712b3b4   <- 04
2026-09-27T21:42:40.253Z  485bd7fb   <- and the PREVIOUS hole, 8.9 days wide
```

Before the hole, 00 fired **on the hour, every hour**, exactly as its cron says.

**[MEASURED]** `(Get-CimInstance Win32_OperatingSystem).LastBootUpTime` →
**`2026-10-05T22:18:52.682Z`** UTC; `UPTIME_HOURS = 72.47` measured at `2026-10-08T22:46:58Z`.

🔴 **Your machine did not reboot, and did not restart Windows, at any point in the 41-hour hole —
it was up for the whole of it and for 31 hours before it.** So the FRESHNESS_ONE_CADENCE_V1
classification for all four stations is **never fired**, and "the machine was down" is ruled out by
measurement rather than assumed away:

| station | cron | occurrences lost in the hole |
|---|---|---|
| 00-supervisor | `5 * * * *` | **41** |
| 04-scanner | `0 */4 * * *` | **10** |
| 03-machine-minder | `0 9 * * *` | **1** (2026-10-07T23:02) |
| 05-sot-keeper | `10 0 * * *` | **1**, on top of the 11 this file already records |

**52 scheduled occurrences lost.** **[CANNOT MEASURE]** from a station which component holds the
queue — the task store is your layer (STATION-CAPABILITIES §1), and no station may enable, disable,
run, re-run or edit a scheduled task on a MISSED reading.

### 4. The alarm for exactly this has been ringing for 28 hours, in a place with no reader

**[MEASURED]** `gh run list --workflow "Pipeline heartbeat" --limit 10`, all on head `375f4386`:
`2026-10-07T18:44Z` failure, `2026-10-08T00:52Z` failure, `2026-10-08T10:17Z` failure,
`2026-10-08T18:42Z` failure — and **`2026-10-07T10:03Z` SUCCESS on the identical head**, which is
the positive control proving the detector reads both ways.

**[MEASURED]** `gh run view 37826381004 --log-failed`:

```
[heartbeat] SILENT: NO station has reported for 37.5h (threshold 6h). Newest is station 00 at
2026-10-07T05:14:00Z. Either the scheduler is off, the machine is down, or the app is not running.
If this was deliberate, declare it in docs/pipeline/pause.json.
```

**`check-pipeline-heartbeat.mjs` was correct, specific and loud, four times, for 28 hours.** It
named the right hour and the right station. It reached nobody, because its only channel is a red
scheduled GitHub Actions run, and the sweep every station reads renders it as
`Pipeline heartbeat: 5 run(s), 4 failing` under a heading that says *excluded from the verdict
above*. Station 00's F3 this run stages a one-file, in-lane fix to pull that sentence into the
sweep; see the breadcrumb.

### What this changes about the question put to you

**Nothing is retired and no option above is withdrawn.** Option A remains the recommendation, for
the same RULE 1 reason. What the three occurrences together now establish, and what the earlier
updates could not:

> **This is not one task that got stuck. It is the dispatcher stopping and resuming, three times
> now — 77 h on 2026-09-21, 9–11 days ending 2026-10-08, and 41 h inside that same window — on a
> machine that was demonstrably up throughout.** Re-arming or re-enabling an individual task
> therefore cannot be the whole remedy, because the two occurrences before this one both ended with
> the tasks firing again on their own and the defect returning.

🔧 **And the cheapest half of the complete-and-additive option is already built and already
correct.** `check-pipeline-heartbeat.mjs` catches this inside 6 hours, every time, with no new
instrument needed. What it lacks is a channel you read. **A notification you actually see — email,
a phone alert, anything outside a GitHub Actions log — turns 41 hours of silence into 6.** That is
additive, removes no gate, writes no data, and is the only part of this that solves the *future*
half of RULE 1. Waiting and watching `lastRunAt` is what the previous two occurrences did.

**Nothing in the task store was touched by this run** — not enabled, not disabled, not run, not
re-run, not edited.

**PROBE, replacing the discharged 14:22Z one:** read all four `lastRunAt` values from the
scheduled-tasks MCP, and the newest session-directory `CreationTimeUtc`, at the next run. 00's next
two hourly occurrences are `2026-10-08T23:13:52Z` and roughly `00:13Z`.

- **Both produce a session directory** → the dispatcher resumed; this is an intermittent stall and
  the remedy is the detection channel above, not a per-task repair.
- **Neither does** → it stalled again within the hour of resuming. Update the hours in this file's
  title; do **not** open a fourth file (DOCTRINE §10.5).

⚠️ **Note on the session census instrument.** DOCTRINE §9.5 tells a station to scan the session
store *"at the directory level with no name filter"*. [MEASURED] this run: the path is now
`local-agent-mode-sessions\<project-uuid>\<uuid>\<8hex>`, **two levels deeper than when that bullet
was written**, and a correct-by-the-letter scan returned **zero** rows while 1722 session
directories existed — no error, nothing empty enough for §9.6 to fire. Whoever reads this probe next
must verify the scan against a known-present session id from their own run before believing a
"no sessions" answer. Filed as F6 in this run's breadcrumb.
