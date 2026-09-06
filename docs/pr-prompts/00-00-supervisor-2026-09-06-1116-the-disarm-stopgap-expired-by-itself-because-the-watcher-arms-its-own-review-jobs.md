# Station 00 — Supervisor | 2026-09-06T11:08:14Z–2026-09-06T11:25Z

## GROUND

```
UTC            2026-09-06T11:08:14Z   (lastRunAt, scheduled-tasks MCP; VM clock agrees)
origin/main    16ddb58b               (.git/refs/remotes/origin/main, read as a FILE — no git run)
dev tree       main @ 16ddb58b        C:\ProjectOperations2  (loose ref; FF'd 10:30:20Z per reflog)
doc version    1                      (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                      (scheduled-task SKILL.md) — MATCH
```

**BLIND RUN.** `ToolSearch` for the Desktop Commander tools was run FIRST, twice, 45 s apart —
the schema-load rule in the station-contract preflight was obeyed, so this is not an
`InputValidationError` misread as blindness. The second attempt returned, from the harness itself:
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): connection timed out after 30000ms`.
No shell was started on the Windows host. **No `.ps1` ran: no `status-sweep.ps1`, no
`bring-up-to-speed.ps1`, no `smoke-pr.ps1`, no `arm-prompt.ps1`. This run therefore carries NO
liveness verdict, NO smoke verdict, NO safe-to-act verdict and NO merge verdict, and it mutated
nothing.** Per STATION-CAPABILITIES §3 it COLLECTED through the Cowork mount first and then stopped:
this is "I was blind, so I read everything readable and acted on none of it", not "I was blind, so I
did nothing."

## WHAT I MEASURED

**The box was ALIVE for the whole blind window — the fault is the transport, not the host.**
[MEASURED] `C:\po-watcher\ensure-watcher.log` advanced `11:05:03Z watcher alive, pid(s) 15336`; the
live watcher's `heartbeat.log` (in the CLONE, `C:\po-watcher\ProjectOperations\scripts\pr-watcher\`)
advanced 11:13Z → 11:15Z during the run; and the watcher consumed a queue item at 11:17Z (below).
A Windows host writing three files a minute is not an unreachable host. This corroborates the
04:1xZ transport/host split already on main in #1641 — it does not re-derive it.

**Freshness table, crossed against `lastRunAt` (scheduled-tasks MCP). No station is SILENT.**
[MEASURED] `check-breadcrumb.mjs --freshness` was **NOT** run: it shells out to `git ls-tree` /
`git ls-files` (`:98`) and `gh pr list` (`:149`), and running `git` against the Windows `.git`
through the mount is forbidden (§9.2 / the §3 ceiling). Done by hand instead:

| station | lastRunAt | newest breadcrumb | verdict |
|---|---|---|---|
| 00 supervisor | 2026-09-06T11:08:14Z (this run) | 2026-09-06-1008 | aligned |
| 04 scanner | 2026-09-06T10:09:52Z | 2026-09-06-1010 | aligned |
| 03 machine-minder | 2026-09-05T23:01:01Z | archive/…2026-09-05-2301 | aligned; next **23:00:45Z** |
| 05 sot-keeper | 2026-09-05T14:10:49Z | archive/…2026-09-05-1411 | aligned; next 14:10:37Z |

00's live cron is `5 * * * *` — **hourly**, re-confirming escalation #23 again.

**The armed count moved twice with nobody arming anything.** [MEASURED] `docs/pr-prompts/*-ready.md`:
**2** at 11:14Z (`rev-1711-ready.md`, `rev-1712-ready.md`) → **1** at 11:18Z (`rev-1711` only).
`.arming-log.txt` newest entry is `2026-09-06T09:20:50Z ARMED pr-watcher-verdict-home-resolver` —
**nothing has been armed since**, and no station acted this run. The two `rev-*` files are the
watcher's own review jobs, and `processed/rev-1712-ready.md.log` was written at **11:17Z**, i.e. the
node dequeued one while this report was being measured.

**The watchdog's kill condition, read from source rather than from memory.**
[MEASURED] `scripts/pr-watcher/supervise-watcher.ps1:515-600`. The kill fires only when **all five**
hold: node running · `$armed.Count > 0` where `$armed = Get-ChildItem '*-ready.md'` (a bare glob) ·
`runnable > 0` · `0 in-progress` · heartbeat age `> $wdHungMin` (**default 15 min**, poll 120 s).
`.queue-state.json` is absent in both trees, so `runnable` falls back to the lane-classified on-disk
count. `.watchdog-kill.flag` is **absent** in both trees.

**RULE 2 probe: WORKING and FRESH through the mount** — a change from the 10:08Z run, which had to
report `[CANNOT MEASURE]`. [MEASURED] in `docs/pr-prompts/processed/` (the LIVE tree — 1993 logs;
the `C:\po-watcher` decoy was not read): POS control `marco.:true` → **617 files**; NEG control
`zzzNoSuchNeedleZzz` → **0**; newest log **11:17Z**. The field is written by the watcher as
`[watcher] merge result for PR #N: {"ok":false,"marco":true,"reason":…}`, and its counterpart is
`{"ok":true}` = auto-merged on the tests-docs lane. Twenty newest non-`rev` logs:

| PR | verdict |
|---|---|
| #1700 `pr-jobroles-s1` | **marco:true — ROUTED TO MARCO, RULE 2 BINDS** |
| #1698 `pr-scopesub-s6` | **marco:true — ROUTED TO MARCO, RULE 2 BINDS** |
| #1685 `pr-tipid-s1` | **marco:true — ROUTED TO MARCO, RULE 2 BINDS** |
| #1692 `pr-artifactregister-s2` | `{"ok":true}` — watcher auto-merged, not routed |
| #1680, #1675, #1612, #1609, #1606, #1589, #1573, #1567, #1543, #1541, #1536 | marco:true |

⚠️ **NO processed log exists for #1699, #1703, #1704, #1705 or #1706.** For those the probe is
silent, and silence is **not** "not routed to Marco" — #1703/#1704 are the kill loop's duplicates
whose prompt never reached `processed/`, and #1706 was a board PR. They must be hand-classified by
`classifyPolicyFiles` per DOCTRINE §10.1.

**Refs.** [MEASURED] `.git/packed-refs` still reads `refs/heads/main 4ea28d6d` /
`refs/remotes/origin/main 66194af6`; the loose refs read `16ddb58b` for both. `.git/logs/HEAD`
resolves the ordering the 04 breadcrumb left ambiguous: `b9c1dd5d → 16ddb58b`, fetched 10:30:12Z,
fast-forwarded 10:30:20Z. `index.lock` **absent**. `docs/pr-prompts/in-progress/` **empty**.

## WHAT CHANGED

**Nothing.** No arm, no merge, no label, no rename, no commit, no PR, no file in the repo other than
this breadcrumb. Blind runs may not mutate the board, and the GitHub MCP token is write-403 in any
case. **This breadcrumb is UNTRACKED in the dev tree at `C:\ProjectOperations2\docs\pr-prompts\` and
needs the next sighted Station 00 run to sweep it into a board PR.**

## FINDINGS

### F1 [S1] The disarm stopgap has already expired, and no station did it — the watcher arms itself

The 10:08Z run stopped the kill loop by renaming the one armed prompt to `-LOOPING.md`, taking
`armed` 1 → 0, and its F2 predicted the cure "expires the moment **anyone arms anything**". Measured
above: `armed` was back to **2** within the hour with the arming log untouched since 09:20:50Z.
The watchdog counts a bare `*-ready.md` glob, and the watcher's own `rev-<N>-ready.md` review jobs
match it. So `armed = 0` is not a state any station can hold, and F3's "arm nothing" discipline —
correct as far as it goes — **cannot** protect the machine: the queue re-arms itself as a normal
consequence of the watcher working. The stopgap bought a window, not a fix.

**Falsifying probe:** if `supervise-watcher.ps1`'s `$armed` ever excludes `rev-*`, or the count sits
at 0 for a full hour while the watcher is processing PRs, this finding is dead.

**DISPOSITION: DISPATCHED → Station 03 (Machine Minder)**, folded into F7/F8 of the 0930 breadcrumb
— same file, same PR. It sharpens the fix rather than adding one: gating the kill on the node's own
`Win32_Process.CreationDate` fixes this too, and it is the only fix that can, because holding
`armed` at 0 is not available.

### F2 [S1] `armed >= 1` is NECESSARY, not SUFFICIENT — and the standing note that says otherwise would mislead the next run

The board is healthy **right now with `armed >= 1`**: node pid 15336 alive since 10:36Z, heartbeat
age ~1 min, no kill flag, queue draining (rev-1707…1712 consumed 10:41Z–11:17Z). That is not luck
and it is not a contradiction — the kill needs a **stale heartbeat** as well, and a healthy node
beats. The 09:25–09:51Z loop happened because a *relaunched* node was judged by the *dead* node's
heartbeat, which is exactly F7 of the 0930 run.

The distinction is operational, not pedantic. A run carrying "armed >= 1 IS THE KILL CONDITION" will
either (a) see `armed = 2` and report an outage that is not happening, or (b) meet a real outage and
"cure" it by disarming, leaving F7 untouched and the next restart to die again — which is precisely
what has now happened twice. **The correct one-line statement is: the kill fires when a node with
work to do has not beaten in 15 minutes; F7 is why a *young* node satisfies that test.**

**DISPOSITION: ACTIONED** — the correction is recorded here with its source lines, and this
breadcrumb is the artefact the next run reads. **Also DISPATCHED → Station 03** with F1, since it
changes what F7's fix must cover, not merely how it is described.

### F3 [S2] 03 does not run for another ~12 hours, so every watcher restart until then re-enters the kill loop

`lastRunAt 2026-09-05T23:01:01Z`, `nextRunAt 2026-09-06T23:00:45Z`, cadence daily. F7 was dispatched
to 03 at 09:30Z, after 03's last run. So the one defect that turns a routine restart into an outage
sits unfixed through the whole of Sunday, on a queue that is live and self-arming (F1). The exposure
is not "if someone arms something" — it is "if the node exits for any reason".

**DISPOSITION: DEFERRED**, pointing at the already-open 03-cadence escalation (bootstrap 4 h vs cron
daily). This run is its second measured cost in one day and should be cited when it is next put to
Marco; it is not a new question and must not be raised as one.

### F4 [S2] Three open-lane PRs are routed to Marco, and five recent PRs cannot be spoken for at all

Measured above. **#1700, #1698, #1685 carry `marco:true` — RULE 2 binds, and no green check, absent
label or clean diff clears them.** #1692 was auto-merged by the watcher on the tests-docs lane.
**#1699, #1703, #1704, #1705, #1706 have no processed log**, so the probe is silent on them and that
silence must be recorded as `[NO LANE VERDICT — hand-classified]`, never as "not routed to Marco".

**DISPOSITION: ACTIONED** as a measurement — the probe was restored from last run's
`[CANNOT MEASURE]`, with both controls (POS 617, NEG 0) and the live tree pinned. Nothing was
merged; this run cannot merge. The table stands for the next sighted run.

### F5 [S2] Mount file mtimes are Windows local time surfaced as UTC — every age a blind run computes is 10 hours wrong

[MEASURED] The clone's `heartbeat.log` mtime prints `2026-09-06T21:15` under `TZ=UTC` while its own
content, `ensure-watcher.log` and the VM clock all read `11:15Z`. Marco's host is UTC+10 (the
`+10:00` offsets in the 2026-08-18 launcher log). So a blind run doing the obvious thing — `stat`
the heartbeat, subtract from `date -u`, compare to `$wdHungMin` — gets a file **ten hours in the
future**, i.e. a negative age, and **nothing warns**: no error, no empty result, so §9.6 never fires.
Every timestamp in this report was therefore taken from log *content* or converted by hand, and the
mtimes above are labelled mount-clock.

This is a §9-class instrument lie that only blind runs can hit, and the §3 blind-run block — which
tells a blind run to read exactly these files — does not mention it.

**DISPOSITION: DISPATCHED → the next sighted Station 00**, to stage a docs-only prompt adding one
clause to `STATION-CAPABILITIES.md` §3 ("No second transport", blind-run paragraph): *mount mtimes
are host-local, not UTC; take times from log content, never from `stat`*. It is docs-only, so it
rides the tests-docs lane. This run cannot stage it: staging is a `git mv` of a tracked file.

### F6 [S3] `packed-refs` is still stale at the values the standing note records

`refs/heads/main 4ea28d6d`, `refs/remotes/origin/main 66194af6`, against loose refs at `16ddb58b`.
Confirmed again, unchanged, and the §9 fix remains parked on an event trigger that has never fired.
Nothing read it this run — every ref above came from the loose files.

**DISPOSITION: DEFERRED.** What would make it urgent: any tool that resolves `origin/main` through
`packed-refs` rather than the loose ref, which would silently read a 2026-08 tree.

### F7 [S3] Station 04's F1 and F2 arrived for routing and cannot be routed by a blind run

04's 10:10Z breadcrumb dispatched two findings to this station: **F1**, the dead
`STEP-11C-DONE :: ESTIMATE_WASTE_RATES_DROPPED` gate that parks `pr-tipid-s3` permanently because no
prompt is told to write the marker; and **F2**, `pr-tipid-s2`'s missing `scope:`/`done_when` entry
for the receipt its successor gates on. Both are one-clause edits to tracked `-HOLD.md` files in the
rates-11c / tipid chain.

They are **not** actioned here. Editing a `-HOLD.md` in the working tree without committing is the
"dev tree ahead in a way only it knows about" trap: the edit would be invisible to every clone, to
CI and to the watcher, and arming would then be computed against prompt text nobody else can see.
A blind run cannot commit, so the correct move is to carry them, not to start them.

**DISPOSITION: DISPATCHED → the next sighted Station 00**, to route both to Station 06 (PR Master)
as chain owner, as one edit — 04's own recommendation. Carried verbatim above so the handover
survives this run rather than expiring with it.

## WHAT I DID NOT DO

- **No board mutation of any kind** — no arm, no merge, no label, no close, no comment. Blind.
- **Did not arm.** Correct twice over: blind, and F1/F2 above mean the machine is one node-exit away
  from the kill loop until 03 lands the age gate tonight.
- **Did not run `check-breadcrumb.mjs`,** so this report is **not** `breadcrumb-clean` — it shells
  out to `git` and `gh`, and `git` against the Windows `.git` through the mount is forbidden. The
  next sighted run must validate it before quoting it.
- **Did not substitute GitHub-side reads for coverage.** No `list_pull_requests`, no PR/check/label
  reads. The open-PR set, trunk colour, check states and labels are **[CANNOT MEASURE]** this run.
- **Did not read the `C:\po-watcher` processed-log decoy** — the RULE 2 probe was pinned to the live
  dev tree, per the standing discriminator (log age, not POS>0).
- **Did not touch `/sot/`** — Station 05's lane.
