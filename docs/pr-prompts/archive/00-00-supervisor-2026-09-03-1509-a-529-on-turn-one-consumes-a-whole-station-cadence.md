# Station 00 — Supervisor | 2026-09-03T15:09Z–2026-09-03T15:4xZ

## GROUND

```
UTC            2026-09-03T15:09:24Z
origin/main    033a1f8d            (fetched, then rev-parse)
dev tree       main @ 033a1f8d     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (station_doc_version in the scheduled-task file)
```

Version match, so this run is READ-WRITE. **SIGHTED** — `start_process` shell `powershell.exe`
returned PID 28776 on the first call. This was not a blind run.

`git diff --name-only origin/main` over all three binding docs returned **empty**, so the working
copy IS `origin/main` for `00-supervisor.md`, `DOCTRINE.md` and `STATION-CAPABILITIES.md`. All three
read in full from that verified-clean tree.

## WHAT I MEASURED

- `[MEASURED]` **Sweep verdict: SAFE TO ACT.** `status-sweep.ps1` at 15:11:35Z–15:12:54Z. Instrument
  positive controls both `[LIVE]`: `gh` reached GitHub (saw merged #1547); `node` runs.
- `[MEASURED]` **Board: 4 open, and ZERO DIRTY.** `#1544 UNKNOWN` (14 pass/0 fail), `#1543 CLEAN`
  (14/0), `#1541 CLEAN` (14/0), `#1536 BLOCKED` (12 pass/**2 fail**). Unchanged since the 12:18Z run.
  `main` CI on `033a1f8d`: 4 success / 0 failed — trunk green.
- `[MEASURED]` **`#1544`'s `UNKNOWN` is a stuck GitHub cache, NOT a conflict.** `git fetch origin
  pull/1544/head:refs/temp/pr1544` then `git merge-tree --write-tree origin/main refs/temp/pr1544`
  → **exit 0**; positive control on `#1543` → **exit 0**. Both temp refs deleted. Q1's script wants
  `UNKNOWN ⇒ CI frozen ⇒ biggest blocker`; here that is **false** and its 14 checks are current.
- `[MEASURED]` **All four PRs are human-gated.** RULE-2 probe `Select-String -Path *.log -Pattern
  'marco.:true'` in `docs/pr-prompts/processed` → **606** hits; negative control
  `zzzNoSuchTokenZzz` → **0**, so the probe is calibrated. Verdicts read per-PR:
  - `#1543` `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/__tests__/lint-prompt.design-ref.test.mjs"}`
  - `#1541` `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/visual-smoke.mjs"}`
  - `#1536` `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`
  - `#1544` **no verdict in any log → SECOND LANE. `[NO LANE VERDICT — hand-classified]`**: its 9
    files are `.claude/agents/*.md` (6), `docs/pipeline/STATION-CAPABILITIES.md`,
    `scripts/pipeline/lint-station.mjs`, `scripts/pipeline/next-sweep.mjs`. Paths outside
    `^(tests|docs)/` ⇒ **MARCO'S** by `classifyPolicyFiles` (DOCTRINE §10.1).
- `[MEASURED]` **armed = 0**, counted by hand: `Get-ChildItem docs\pr-prompts -Filter *-ready.md
  -File` → 0 names, 0 count. Dev-tree index clean (`git diff --cached --name-status` empty).
- `[MEASURED]` **Machinery healthy.** `restart-watcher-if-wedged.ps1` → `VERDICT: OK - nothing armed
  and the watcher is alive`; node PID **24744**, wrapper alive (1), restart churn 0 in 20 min,
  0 in-progress prompts, `index.lock` False/False, 0 git processes, no PR touched in 2 min. Clone
  `branch=main dirty=3` — untracked review files, **not** a mid-merge; no rescue script run.
  Local clock 2026-09-04 01:14 Brisbane = 15:14Z, i.e. UTC+10 exactly (RULE 2 timezone check).
- `[MEASURED]` **Left for 03:** 3 orphaned worktrees (`C:/po-1483-fix`, `C:/po-sa-fix`,
  `C:/po-work/s2-e2e`) all `dirty=0`, plus 2 registry escapees (`fix-1523`, `vs-s2-durable-smoke`),
  both `size=0KB`, `.lock=False`.
- `[MEASURED]` **`check-breadcrumb.mjs --freshness` → exit 2.** `structure: 4 checked, 0 malformed`.
  `00` 2.0h ok · `03` **40.1h ok** · `04` 5.0h ok · `05` **49.0h SILENT**.
- `[MEASURED]` **`list_scheduled_tasks` (the live schedule, checklist item 4).** All five tasks
  **enabled**. `00` cron `5 * * * *` lastRun 15:08:42Z · `04` `0 */4 * * *` lastRun **14:10:20Z** ·
  `05` `10 0 * * *` lastRun **14:11:26Z** · `03` `0 9 * * *` lastRun **2026-09-01T23:01:43Z**,
  nextRun 2026-09-03T23:00:45Z · `weekly-security-audit` lastRun 09-02T23:58Z.
- `[MEASURED]` **No breadcrumb exists for either 14:1xZ run, by three instruments.** Nothing in
  `docs\pr-prompts\00-*.md` with `LastWriteTimeUtc > 13:30Z`; `git status --porcelain --
  docs/pr-prompts` shows no untracked breadcrumb; no open PR contains a `pr-prompts/00-0[45]` path.
- `[MEASURED]` **THE CAUSE.** `read_transcript` on the newest `05 sot keeper` session
  (`local_57274869…`) and the newest `04 scanner` session (`local_f5f47c05…`): each transcript is
  the inlined `SKILL.md` user turn followed by exactly one assistant message —
  **`API Error: 529 Overloaded`**. Both died on the FIRST assistant turn, before STEP 1.
- `[MEASURED]` §5 stale-claim cross-check again marks `tests-docs-lane-deadlock-2026-09-03.md`
  `[STALE]` on six merged PR refs. That cross-check was already proved to call live escalations dead
  (breadcrumb 0909, `#1540`); the escalation is LIVE. Not acted on.

## WHAT CHANGED

**One docs-only edit, strictly additive.** `docs/pipeline/stations/00-supervisor.md`, a new bullet in
the AUTHORITY list immediately before `ARCHIVE WHAT YOU HAVE COLLECTED`: 00 must now cross the
`--freshness` table against `list_scheduled_tasks`' `lastRunAt`, with a three-row table separating
*never fired* from *fired and died* from *healthy*, and must read the session transcript before
dispositioning any station as SILENT.

- `git diff --numstat` → **`23  0`** — 23 insertions, **zero** deletions.
- Read-back: `patch_present=true`, `mojibake=false`, `replacement_char=false`, `anchor_count=1`
  (the splice script aborts unless the anchor occurs exactly once and refuses to double-apply).
- Written with node `readFileSync`/`writeFileSync` utf8, never PowerShell (DOCTRINE §9.3).
- The bullet sits **outside** `CANONICAL-BLOCK: station-contract v2`, so no hash is touched:
  `node scripts/pipeline/lint-station.mjs` → `ADMIT: all 8 docs clean`, **exit 0**.

Nothing else. **No merge, no arm, no label change, no worktree pruned.**

## FINDINGS

### 1. A 529 on turn one consumes a station's whole cadence, and every instrument reads it as something else

`04` and `05` each fired on schedule and each died on `API Error: 529 Overloaded` before executing a
single instruction. The consequences compose into a false picture from three directions at once:
`lastRunAt` updates, so the MCP reads **healthy**; no breadcrumb can exist, so `--freshness` reads
**`05 … SILENT`**, which the contract defines as *"either it did not run, or it ran and did not
report"* — and **neither is what happened**. The cron does not retry, so a daily station loses a
full 24 h of coverage with no defect anywhere to find. Escalation **#23's trigger fired on 05, and
its premise — a STOPPED station — is REFUTED for 05**: the task is enabled, fired on time, and was
killed by infrastructure. Reporting 05 as stopped would have been a §7 false alarm.

**DISPOSITION: ACTIONED.** The detector cannot be fixed in CI (the MCP is unreachable from there,
per #23 option (c)), but 00 *does* have the MCP and the transcripts every run, so the cross-check
belongs in 00's own contract — which is where I put it, additively, verified by read-back and
`lint-station.mjs` exit 0. This satisfies RULE 1 on both halves: it is complete (it separates all
three causes, not just 05's) and it damages nothing (adds an instrument, removes none).

### 2. `03-machine-minder` genuinely did not run on 2026-09-02, and `--freshness` still prints `ok`

`03`'s `lastRunAt` is `2026-09-01T23:01:43Z` — 40.2 h before this run — and its newest breadcrumb is
`2026-09-01T23:02Z`. Those agree, so unlike 04/05 this is not a died-on-turn-one case: **the 09-02
occurrence never fired at all.** Because `CADENCE['03'] = 24` and the alarm is `2×`, 40.1 h prints
`ok`. This is escalation #23's second half reproduced live for the second consecutive day. Probable
cause is the known one: `scheduled-tasks.json` is rewritten from memory when Claude Desktop exits,
so an occurrence is lost if the app was down at 23:00Z — I could not confirm the app's uptime.

**DISPOSITION: ESCALATED — amends #23, does NOT open a new item.** #23 already asks Marco to choose
a threshold, and today supplies the evidence its option list was missing: option **(c)** (drive it
off `lastRunAt`) is the only one of the three that could have separated 03's *never fired* from 05's
*fired and died*, so it should be read as **necessary alongside (a)**, not as the weak third choice.
The threshold itself stays Marco's call, unchanged, because a false SILENT licenses destructive
action.

### 3. `#1544` is second-lane and carries no RULE-2 verdict

No log names it, so the probe returns empty — which DOCTRINE §10.1 warns is byte-identical to
"checked, and not Marco's". Hand-classified **MARCO'S** on `.claude/agents/**` and
`scripts/pipeline/**`. Its `UNKNOWN` merge state is a stuck cache (`merge-tree` exit 0, control
exit 0), not a conflict, and its 14 checks are green and current.

**DISPOSITION: DEFERRED.** Correctly held. It becomes urgent only if Marco clears it or if
`merge-tree` starts returning 1, which would mean a real conflict has appeared.

### 4. Station 04's 10:10Z finding is on the board and closed out

`00-04-scanner-2026-09-03-1010-six-station-agent-definitions-are-double-encoded-on-main.md` was
taken up at 11:09Z and is now `#1544`, open and green.

**DISPOSITION: ACTIONED** — collected, dispositioned, and archived to `docs/pr-prompts/archive/` in
this run's PR along with the 1109 and 1220 breadcrumbs. Safe for freshness: `--freshness` builds its
tracked set with `git ls-tree -r` and matches by **basename**, so archiving cannot make a station
read SILENT (DOCTRINE §9.5).

### 5. The board is entirely Marco-gated, so arming more work would lengthen the queue

Four open PRs, four human gates, `armed = 0`, backlog offering `rates-11c-blocked-consumers` as
READY TO STAGE.

**DISPOSITION: DEFERRED, deliberately.** Arming is a decision, not a default; with every lane out of
the board blocked on one person, arming adds to a queue that cannot drain. It becomes urgent the
moment Marco clears any of the four.

## WHAT I DID NOT DO

- **Merged nothing.** All four open PRs are human-gated — three genuine `marco:true` verdicts and one
  hand-classified second-lane PR. RULE 2 bars all four and green does not clear it.
- **Armed nothing** (finding 5). No prompt renamed, no `arm-prompt.ps1` call, arming log untouched.
- **Did not run `rescue-watcher-repo.ps1`** despite the clone reading `dirty=3`: `MERGE_HEAD` absent,
  0 unmerged paths, the 3 are untracked review files. Running it here would tear a tree out from
  under a healthy watcher.
- **Did not prune the 3 orphaned worktrees or the 2 registry escapees** — Station 03's lane, and
  03 is the station I have just reported as having missed an occurrence.
- **Did not restart or touch the watcher.** Verdict was `OK`; heartbeat staleness with an empty queue
  is idle, not wedged.
- **Did not act on the six `[STALE]` lines** against `tests-docs-lane-deadlock-2026-09-03.md`. That
  cross-check is known to mark live escalations dead; the escalation stands.
- **Did not edit `DOCTRINE.md` §9**, where this finding also belongs. §9 is a hash-gated canonical
  block requiring all seven station docs re-recorded and shipped together — too wide for this run,
  and mixing it with a station-doc fix would have made both harder to review. Left for 04/05/06.
- **Did not touch `/sot/`** (Station 05's lane, CP-24) and did not go near Azure/Entra/SharePoint.
