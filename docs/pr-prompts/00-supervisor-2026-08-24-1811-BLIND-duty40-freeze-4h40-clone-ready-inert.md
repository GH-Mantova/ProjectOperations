# 00-SUPERVISOR — 2026-08-24 18:11Z — **BLIND RUN** · duty cycle 40 % · a 4 h 40 m freeze · nothing acted on

🔴 **THIS RUN WAS BLIND.** Desktop Commander / PowerShell were **absent for the entire run** (ToolSearch
retried 4× over ~90 s; `plugin:desktop-commander:desktop-commander` never finished connecting).
**Third blind scheduled run.** Everything below is mount-side `ls`/`cat`/`tail` over
`C:\ProjectOperations2` and `C:\po-watcher`. **No git was run from the VM.** This is **not** host coverage.

Merged nothing · armed nothing · disarmed nothing · moved nothing · touched no `/sot/`.

---

## 1. Freeze is far worse than "~60-minute blocks" [MEASURED]

Instrument: **`[review] verdict-archive sweep` in `C:\po-watcher\watcher-launch.log` — a FIXED 5-MINUTE
tick.** This is the fixed-interval tick the doctrine asks for. 80 ticks, 01:43:45Z → 18:08:25Z:

```
GAP   25.0 min  02:42:15Z -> 03:07:17Z
GAP   60.0 min  04:24:35Z -> 05:24:35Z
GAP  279.9 min  05:35:31Z -> 10:15:25Z     <-- 4 h 40 m
GAP   63.0 min  11:05:25Z -> 12:08:24Z
GAP   60.0 min  13:08:26Z -> 14:08:25Z
GAP   65.2 min  15:03:20Z -> 16:08:33Z
GAP   23.0 min  17:03:19Z -> 17:26:20Z
GAP   42.1 min  17:26:20Z -> 18:08:25Z
window 984.7 min · lost-to-freeze 591.5 min · DUTY CYCLE 40 %
```

The 05:35:31Z boundary is the watcher's own launch (pid 29024, up 05:35:04Z) — **it slept 4 h 40 m
immediately after starting.** Duty cycle **40 %** supersedes 49 %, which superseded 33 %.
⇒ **ARMING STAYS DEFERRED.**

⚠️ **Never derive duty cycle from `ensure-watcher.log`.** Its `PT10M` keepalive shows a 70-min gap
16:58:16Z → 18:08:33Z, but the node's 5-min sweep ticked at **17:03:19Z and 17:26:20Z inside it**.
The scheduled task misses fires the node survives; the keepalive log **over-states** the freeze.

## 2. The two clone-side `*-ready.md` are INERT — do not "fix" them [MEASURED]

`C:\po-watcher\ProjectOperations\docs\pr-prompts\` holds `pr-sot-ll36-sot-purity-ready.md` (2026-07-13)
and `rev-1162-ready.md` (2026-08-18) while the dev tree holds **zero** depth-1 `*-ready.md`. That looks
like armed work. It is not:

- `watcher-launcher-singlelane.ps1:23`, `watcher-launcher.ps1:5`, `supervise-watcher.ps1:55` all set
  `PR_WATCHER_PROMPT_DIR = C:\ProjectOperations2\docs\pr-prompts` — **the queue is the dev tree.**
- `start-watcher.ps1:177` **REFUSES to start** when the prompt dir sits inside the clone.
- `.queue-state.json` agrees: `armed: 0`.

🔴 **Do not delete them and do not count them in a board census.** A grep of the clone will re-raise
this false alarm.

## 3. Arming hazard is LIVE and larger — heartbeat 225 min stale [MEASURED]

`heartbeat.log` last write **14:25:50Z** (`rev-1306-ready.md elapsed=240s`); now 18:11Z ⇒ **225 min**.
Re-read `supervise-watcher.ps1` this run: `$wdHungMin = 15` (L76); L523 `if ($armed.Count -eq 0) { continue }`;
L577 `if ($runnable -le 0) { … legitimate idle }`. The kill needs **stale > 15 min AND armed > 0 AND
runnable > 0**. `runnable: 0` is the only thing keeping pid 29024 alive.
⇒ **arming without refreshing `heartbeat.log` in the same breath kills the node within one poll cycle.**
`.watchdog-kill.flag` **absent** — no kill has fired. The watchdog is **live**, not dormant.

## 4. Board & machine [MEASURED 18:08–18:11Z]

- Watcher **ALIVE, pid 29024**, unchanged since ≥14:38Z. `.queue-state.json` written **18:08:25.496Z**:
  `armed 0, runnable 0, owned 0, lane null, lanes 2` ⇒ **IDLE, not wedged.**
  `ensure-watcher.log` 18:08:33Z — "watcher alive, pid(s) 29024".
- **`index.lock` ABSENT** in both trees. No `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` /
  `rebase-merge` / `rebase-apply` in the dev tree.
- **2 open PRs, unchanged since 16:11Z** — **#1305** `feat/lessons-learned-restore-slice1` (updated
  10:14:10Z) and **#1306** `docs/sot-03-merged-pr-ledger-2026-08-24` (updated 14:25:56Z). No new PRs,
  nothing merged in ~3 h 45 m. **Both stay held**: #1305 by RULE 2 (watcher-routed), #1306 by the
  human-read gate authored in its own body.
- `docs/pr-prompts/` depth 1: **102 `.md`, 59 `-HOLD.md`, 0 `-ready.md`, 0 `rev-*`.**
- `needs-marco/`: the **4 dead sweep-`[STALE]` escalations** are still present, still awaiting a
  hygiene PR.

## 5. Dispositions

| Finding | Disposition |
|---|---|
| Merge-wait / review lane deadlock (16:11Z) | **DEFERRED** — permanent fix is the monotonic-clock work for **Station 06**; it cannot be tested while the box sleeps 40 % of the time |
| "Watchdog dormant" | **REFUTED again** — source re-read this run, live at `wdHungMin=15` |
| Clone-side `*-ready.md` | **ACTIONED — closed as a non-issue**, recorded here so it is not re-raised |
| 4 dead `needs-marco` escalations | **DEFERRED** — needs a docs hygiene PR; no station has picked it up |
| Desktop Commander absent on a scheduled run | **ESCALATED to Marco** — third occurrence; Station 00's cron is a coin flip until it is reliable |

Durable copy in project memory:
`project_supervisor_2026_08_24_1811_blind_duty40_freeze_4h40_clone_ready_inert.md`
