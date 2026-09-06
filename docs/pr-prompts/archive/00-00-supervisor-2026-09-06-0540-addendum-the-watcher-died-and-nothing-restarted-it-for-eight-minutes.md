# Station 00 — Supervisor | 2026-09-06T05:27Z–05:45Z | **ADDENDUM to the 05:08Z run**

> This is the SECOND file for one run, and that is deliberate. The run's breadcrumb merged as
> **`#1691`** at `05:27:33Z`. The watcher died **two seconds earlier**, at `05:27:31Z`, so none of
> what follows could be in it. This file is UNTRACKED in the dev tree — **the next sighted 00 run
> must sweep it into a board PR.**

## GROUND

```
UTC            2026-09-06T05:27Z–05:45Z
origin/main    bc8ca0e8   (#1691, 05:27:33Z)
dev tree       main @ bc8ca0e8   C:\ProjectOperations2   clean (0 0 / EMPTY / EMPTY)
doc version    1     bootstrap 1     (agree)
transport      SIGHTED — Desktop Commander throughout
```

## WHAT I MEASURED

| | [MEASURED] |
|---|---|
| watcher alive, sweep | `05:10:36Z` — `watcher node: RUNNING pid 20000`, wrapper alive (1) |
| review job enqueued for this run's own PR | `05:27:03.120Z` — `[review] enqueued review for PR #1691 → rev-1691-ready.md` |
| job started | `05:27:04.113Z` — `[start] rev-1691-ready.md (max-turns=240)` |
| **watcher exited** | `05:27:31.250Z` — `Watcher exited with code 1 (raw node exit: -1)` — **27 s after the start** |
| independent confirmation | `Get-CimInstance Win32_Process` on `node.exe` filtered by `pr-watcher[\\/]index\.mjs` → **0**, against **23** `node.exe` running in total (§9.5: never count by image name) |
| the wrapper was NOT absent | `watcher-launcher-singlelane.ps1` pid 35328, alive since `2026-09-04T09:37:11Z` |
| documented 60 s auto-restart | **did not fire.** No node and no new log line at `+98 s`, `+3 m 22 s`, `+7 m 06 s` |
| the net that DID fire | `ensure-watcher.log` `05:35:03Z RELAUNCHED - wrapper pid 24952`; `05:35:24Z VERIFIED node pid 14744 ... detached=True` — **7 m 32 s after the exit**, on a 10-minute tick |
| and it did not hold | pid 14744 **GONE** by `05:37:07Z`; a stale `.watcher.lock` naming pid **33244** was written `05:38:12Z` with no such process alive |
| sanctioned verdict | `restart-watcher-if-wedged.ps1` → **`VERDICT: DOWN - no watcher process, but 1 prompts are armed`** |
| recovery | `-Fix` at `05:40:07Z` — killed nothing (nothing to kill, stated before acting per LIMITS 5), `removing stale .watcher.lock`, relaunched, `OK - watcher back up` |
| read back at `05:44:43Z` | **`VERDICT: OK`** — `watcher process: ALIVE (pid 17944)`, `armed prompts waiting: 0`, churn `3 cycle(s) in 20 min (threshold 4)` |
| the queue drained | `rev-1691-ready.md` consumed; `C:\po-watcher\verdicts-archive\pr-1691-review.md` written `05:40:18Z` |

**Total time with no watcher: about 13 minutes** (`05:27:31Z` → `05:40:5xZ`), of which **7.5 minutes**
were before anything at all reacted.

## WHAT CHANGED

`restart-watcher-if-wedged.ps1 -Fix`, once, on a DOWN verdict from the script itself — which is
Station 00's fix-set item 1 and the only sanctioned recovery. It removed one stale
`.watcher.lock` and launched `supervise-watcher.ps1`. Nothing else. No arm, no merge, no label, no
`sot/` edit, nothing in the watcher clone's git.

## FINDINGS

### F7 — the 60-second auto-restart in `supervise-watcher.ps1` DID NOT FIRE, and the only thing that recovered the watcher was `ensure-watcher.ps1`, which is NOT IN THE REPO. **S1 — ESCALATED.**

`00-supervisor.md` §3a states the design plainly: *"`supervise-watcher.ps1` runs already and
**auto-restarts the watcher when it EXITS** (exit 1 crash → 60 s ...). **Do not duplicate that.**"*
The exit here was exactly that case — code 1, wrapper present and alive the whole time — and at
`+7 m 06 s` there was still no node and not one new line in `watcher-launch.log`.

🔴 **So the documented safety net for the most common failure did not run, and the station doc tells
every future run not to duplicate it.** A run that believes §3a and stands down waits for a restart
that is not coming.

🔴 **What recovered it is worse for the map than the fault itself.** `ensure-watcher.ps1` — the
10-minute tick that relaunched at `05:35:03Z` — **is not in this repository**. It is already open
escalation **#19** for exactly that reason, and this run is the measured demonstration of what #19
costs: the pipeline's real recovery mechanism is a file no station can read, review, version or fix,
while the mechanism the docs describe is the one that failed.

⚠️ **And the relaunch it performs does not restore observability.** `watcher-launch.log` has had
**no line since `05:27:31Z`** — through two `ensure-watcher` relaunches, a completed review job, and
an archived verdict at `05:40:18Z`. Work was happening and the log said nothing, which is the
condition under which every liveness reading in this pipeline is taken. **A watcher relaunched by
`ensure-watcher.ps1` is invisible to `watcher-launch.log`**, and `restart-watcher-if-wedged.ps1`
reads its churn counter from that log — which is why it reported `1 cycle in 20 min` at `05:40` while
at least three starts had occurred.

**RULE 1 options — Marco's, because both touch files outside the repo.**

- **(a) COMPLETE AND ADDITIVE — bring the launcher chain into the repo, then fix the restart.** Move
  `ensure-watcher.ps1`, `watcher-launcher-singlelane.ps1` and `supervise-watcher.ps1` under
  `scripts/pr-watcher/` (or vendor copies with a CI check that the on-disk copies match), and point
  `C:\po-watcher\*` at them. Only then diagnose why the exit-1 path did not fire, because until the
  file is readable no station can. Solves it **immediately** — this outage is diagnosable the moment
  the source is in the tree — and **permanently**: the chain becomes reviewable, testable and fixable
  by any station, and #19 closes with it. Damages no data entry: it copies scripts into the repo and
  changes no queue, no prompt, no schema and no gate.
- **(b) Fix only the logging** — have `ensure-watcher.ps1` append its relaunches to
  `watcher-launch.log` so the churn counter is honest. Fails the **complete** half: the restart still
  does not fire and the launcher is still unreadable; it makes the fault *visible* rather than
  *absent*. It is a real improvement and it is not a substitute.
- **(c) Shorten the `ensure-watcher` tick from 10 minutes to 2.** Fails both halves — it caps the
  outage without touching either cause, and it multiplies the relaunch churn that
  `restart-watcher-if-wedged.ps1` already counts toward its threshold of 4.

I did **not** touch `C:\po-watcher\*.ps1`. Those are outside the repo, outside CI and outside any
station's lane; editing an unversioned launcher by hand is precisely the change that cannot be
reviewed or rolled back.

### F8 — `raw node exit: -1` on a review job, for the second recorded time. **S3 — DISPATCHED → 03.**

DOCTRINE §9.5 records the identical signature on `#1570` (2026-09-04): the watcher crashed with
`raw node exit: -1` between opening a PR and writing its merge verdict, and §9.1/§7 trap 3 identifies
`-1` as **a spawn failure read as a status** (`err.status === undefined`). Here it happened 27 s into
`rev-1691-ready.md`. The review itself later succeeded on a relaunched watcher, so the crash is
**intermittent at spawn**, not a property of the job.

**DISPATCHED → Station 03 (machine-minder), whose lane this is.** What to bring back: whether the
`-1` is a spawn failure of the agent child process, and where its stderr goes — `watcher-launch.log`
records the exit code and nothing else, which is why two occurrences have now been logged with no
cause attached. Pair it with F7; they are the same blind spot from two directions.

## WHAT I DID NOT DO

- **Did not run `-Fix` on the first DOWN reading.** The wrapper was present, so §3b's warning applied
  and a relaunch would have started a second supervisor family. I waited through two
  `ensure-watcher` ticks and re-measured three times before acting — and the wait is itself the
  measurement that F7 rests on.
- **Did not kill anything.** Stated the (empty) kill list before running `-Fix`, per LIMITS 5.
- **Did not edit `C:\po-watcher\*.ps1`**, and did not shorten the `ensure-watcher` tick.
- **Did not merge `#1690`** — it is hand-classified Marco's; all **15** of its checks now pass.
- **Did not re-raise #19**; F7 is filed as the measurement that gives it a cost.
