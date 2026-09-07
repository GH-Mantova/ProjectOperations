# Station 00 — Supervisor | 2026-09-07T18:08Z–2026-09-07T18:55Z

## GROUND

```
UTC            2026-09-07T18:09:50Z
origin/main    62eab8af            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 62eab8af      C:\ProjectOperations2   (0 0 ahead/behind, --numstat EMPTY, --cached EMPTY)
doc version    1                    (station_doc_version in docs/pipeline/stations/00-supervisor.md)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not read-only.

**SIGHTED.** `start_process` (shell `powershell.exe`) returned pid 29860 on the first call, after a
keyword `ToolSearch` for `desktop-commander`. This was not a blind run.

Device-bridge git guard, installed first per PREFLIGHT step 1, last line quoted verbatim:
`vm-git-guard installed at /sessions/blissful-fervent-ramanujan/.local/bin/git - refuses mounted
paths, allows everything else (both controls passed)` — exit 0.

All three binding documents were read IN FULL this run, and
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, so the working copies I read are
byte-identical to `origin/main` (the sound form — no piped hash, PREFLIGHT step 2).

## WHAT I MEASURED

- **[MEASURED] `status-sweep.ps1` §7 verdict: `SAFE TO ACT`.** Captured to a FILE
  (`status-sweep.ps1 *> C:\po-sup-fix-scripts\sweep-2026-09-07-1810.txt`, 111,032 B, exit 0) because
  the script returns early and hides its own §7 line when read from the pipe. §0 controls both
  `[LIVE]`: `gh CAN reach GitHub (saw merged PR #1785)`, `node runs`. §3: `index.lock False / False`,
  `git processes running: 0`, `no PR touched on GitHub in the last 2 min`.
- **[MEASURED] Board: 4 open, 0 DIRTY.** `gh pr list --state open --json
  number,title,headRefName,mergeStateStatus,isDraft,labels,createdAt,author --limit 50`, assigned
  then iterated (never piped — §9.4):
  `#1777 CLEAN labels=[] created 09:33:10Z` · `#1775 BLOCKED labels=[do-not-merge]` ·
  `#1774 BLOCKED labels=[]` · `#1767 BLOCKED labels=[do-not-merge]`. CI from the sweep:
  `#1777 15 pass / 0 fail / 0 pending (green)`; the other three `13 pass / 2 fail`.
  `main CI on 62eab8af: 4 success / 0 failed (trunk green)`.
- **[MEASURED] RULE 2 probe, live tree, controls passed.** Directory pinned to
  `C:\ProjectOperations2\docs\pr-prompts\processed` (never the clone): **2057** logs, newest
  `2026-09-07T15:35:17Z rev-1784-ready.md.log` — younger than the oldest open PR (`#1767`,
  `06:43:58Z`), which is the control that separates the live directory from the 17-day-stale decoy.
  POSITIVE `marco.:true` → **620**. NEGATIVE, freshly minted needle `zzQq00N20260907T1815` → **0**.
  Per-PR over `pr-*.log` only (excluding `rev-*`, §9.5): `#1777 → 0`, `#1775 → 0`, `#1774 → 0`,
  `#1767 → 0`; negative control `PR #999999` → **0**.
- **[MEASURED] Hand-classification, `[NO LANE VERDICT — hand-classified]` for all four**, from
  `gh pr view <n> --json files` against `classifyPolicyFiles` (three `NESTED_TEST_PATHS` forms;
  any `(^|/)migrations/` refused):
  - `#1777` — `scripts/pipeline/sweep-breadcrumbs.ps1`. Not tests-or-docs, and `scripts/` is not
    00's recorded lane (§10.1 step 3 defers to the authority matrix; 00's lane is `docs/`).
    **MARCO'S.**
  - `#1775` — `apps/api/...`, `package.json`, `scripts/rates/...`. **MARCO'S**, and labelled.
  - `#1774` — `.github/workflows/ci.yml` + `scripts/pipeline/check-hex-ratchet.mjs` are outside all
    three forms. **MARCO'S.**
  - `#1767` — carries `apps/api/prisma/migrations/20260907100000_.../migration.sql`, refused on the
    migration clause before any other test. **MARCO'S**, and labelled.
- **[MEASURED] Queue: armed = 0** — I counted it myself,
  `Get-ChildItem docs\pr-prompts -Filter '*-ready.md'` → **0**; `*-HOLD.md` → **45**.
  `.arming-log.txt` newest row `2026-09-07T07:20:53Z ARMED pr-triageholds-s2-env-os-is-empty-in-a-station-shell`
  — no arm since, and the dev tree's copy is not ahead of `origin/main` (`--numstat` EMPTY), so the
  append-only-superset hazard does not apply this run.
- **[MEASURED] Watcher: RUNNING, idle, not wedged.** `watcher node: RUNNING pid 31660`,
  `auto-restart wrapper: alive (1)`, `heartbeat age: 156 min`. Heartbeat ticks only mid-run, and
  armed = 0, so a stale heartbeat here is IDLE by definition, not WEDGED.
- **[MEASURED] COLLECT — `check-breadcrumb.mjs --freshness` exit 0, `CLEAN`**, structure
  `2 checked, 0 malformed`. `00 17:08Z 1.1h ok · 03 2026-09-06T23:02Z 19.2h ok · 04 14:10Z 4.1h ok ·
  05 14:12Z 4.0h ok`. It also printed the line this run exists to clear:
  `NOTE  …-1708-….md is UNTRACKED — it reaches nobody until a board PR commits it`.
- **[MEASURED] Freshness crossed against `lastRunAt` (scheduled-tasks MCP), as the contract
  requires — the breadcrumb is one instrument and cannot name a cause.** `00 18:08:32Z` (this run) ·
  `04 18:10:11Z` · `05 2026-09-07T14:11:15Z` · `03 2026-09-06T23:01:13Z` ·
  `weekly-security-audit 2026-09-06T21:32:44Z`. Every station aligns with its newest breadcrumb.
  04's fresh `lastRunAt` with no newer breadcrumb is **not** the "started and died" row of that
  table: 04 fired 99 seconds after me and was still in flight while I measured.
  **No station is SILENT and none is stopped.**
- **[MEASURED] Nothing new to collect from 03/04/05.** `Get-ChildItem docs\pr-prompts -Filter
  '00-*.md'` returns exactly two files, both mine (1608, tracked; 1708, untracked). Every other
  station's breadcrumb since my last run is already in the tracked set —
  `git ls-files docs/pr-prompts` matched by basename (the cheap check that stops a second tracked
  copy being committed at the root path).
- **[MEASURED] Doc edit read-backs.** `BEFORE_BYTES=29986 · AFTER_BYTES=31702 · DELTA=1716 ·
  EXPECTED=1716 · DELTA_OK=true`, plus `NEW_PRESENT=true`, `ANCHOR_HITS_AFTER=1`,
  `NEG_CONTROL=false`. Built by **concatenation**, never `String.replace` with a replacement string
  (§9.3 — a `$` in a replacement once injected 7,734 bytes and every read-back passed).

## WHAT CHANGED

1. `docs/pipeline/STATION-CAPABILITIES.md` §6 — an ADDITIVE correction after the cron-collision
   paragraph. Nothing was rewritten or removed; `ANCHOR_HITS_AFTER=1` proves the original paragraph
   is intact.
2. `docs/pr-prompts/00-00-supervisor-2026-09-07-1708-….md` — committed. It had been untracked since
   17:18Z and reached nobody.
3. `docs/pr-prompts/00-00-supervisor-2026-09-07-1608-….md` — `git mv`'d to `archive/`; every
   finding in it carries a disposition.
4. This breadcrumb, written INSIDE the PR worktree (cure 1), so no loose copy is left in the dev
   tree to block the next fast-forward.

**No PR was merged. No prompt was armed. No label was touched.**

## FINDINGS

### F1 — `STATION-CAPABILITIES.md` §6 under-states the station-collision by six times, and the remedy it names fixes one occurrence in six

That paragraph says 00, 04 and 05 *"all land within ten minutes of MIDNIGHT LOCAL, every night"*,
and concludes *"the one that must move is 05"*. The first half is a claim about a **midnight
event**; it is false, and its falseness is why the remedy is incomplete. **00 is HOURLY**, so it
collides with 04 on **every one of 04's six daily runs**.

[MEASURED] this run, from the MCP and from my own start time: `00-supervisor` `5 * * * *`,
`lastRunAt 2026-09-07T18:08:32Z` (jitter 172 s) against `04-scanner` `0 */4 * * *`,
`lastRunAt 2026-09-07T18:10:11Z` (jitter 571 s) — **99 seconds apart, at 04:10 Brisbane local**,
which is as far from midnight as this schedule allows. `0 */4 * * *` fires at 00/04/08/12/16/20
local, and an hourly `:05` is inside ten minutes of all six by construction. Moving 05 de-collides
only the three-station case; the two-station 00×04 overlap survives it and recurs six times a day.
The open cron-offset escalation therefore needs **two** offsets from Marco, not one.

**DISPOSITION: ACTIONED** — landed in this PR with the byte-delta read-back quoted above and a
falsifying probe attached (read both crons and both `lastRunAt` values at any 04 occurrence; more
than ten minutes apart refutes it). The cron changes themselves remain Marco's — they live in the
scheduled-tasks layer, not this repo — and this run did not touch them.

### F2 — my 17:08 run's breadcrumb was untracked and had reached nobody for 66 minutes

`check-breadcrumb.mjs --freshness` printed the `NOTE … is UNTRACKED` line, and
`git ls-files docs/pr-prompts` confirmed only the 1608 basename is in the tracked set. The 17:08 run
deliberately opened no board PR to avoid knocking `#1777` out of green, and left the instruction
*"the next run must commit it, or defer once more at most"*.

I checked the tracked set **before** committing it, not the dev tree's `git status`, because an
archived breadcrumb is already reported and a `git status` read cannot see that — the exact mistake
that put `00-04-scanner-2026-09-07-0610-….md` on `main` twice.

**DISPOSITION: ACTIONED** — committed in this PR.

### F3 — every open PR is Marco's; the board has not moved in an hour and cannot

`#1777` has been **CLEAN and fully green (15/0/0)** since well before this run and is nine hours
old. It is not blocked by CI, by a conflict, by a label or by a stale check. It is blocked by RULE 2
hand-classification: it touches `scripts/`, which is outside `tests|docs` and outside 00's recorded
lane. `#1775` and `#1767` carry `do-not-merge` and therefore can never be green (CP-26 reports
`[LABEL_PRESENT]`, and CP-26 also runs as a step inside `PR gates — diff checks`, so one cause shows
as two reds — parked by design, not a defect). `#1774` is the already-escalated
`[RELEASED_NO_RECEIPT]` case from 12:31Z.

This is the standing throughput constraint stated exactly: 00 can arm, the watcher can build, CI can
green — and every PR outside `tests/` or `docs/` then stops. Arming faster makes the queue longer,
not shorter.

**DISPOSITION: DEFERRED** — real, and not mine to clear. It becomes urgent only if `#1777` starts
**losing** green (it has not: the 17:08 run measured the post-merge `pollForBehindPrs` rebuild at
13 m 54 s to fully green again, and refuted the "livelock" reading). One sentence from Marco in chat
releasing `#1777` clears it; nothing an agent may do does. **Not re-escalated** — the constraint is
already on file and duplicating it adds noise, not signal.

### F4 — no arm again this run, and the reason is supply, not caution

Armed = 0, 45 `-HOLD.md`. `origin/main` is at `62eab8af`, **the identical SHA the 17:08 run measured**,
so the prompt corpus on `main` has not changed by a single byte since that run enumerated it:
45 HOLD → 17 ADMIT → of the 14 non-never-arm ones, **zero** are all-tests-or-docs. Re-running
`triage-holds.ps1` against an unchanged tree would spend a station's budget to re-derive a number I
can prove is unchanged. Any arm now would only add a fifth Marco-gated PR to a board where four
already wait.

**DISPOSITION: DEFERRED** — the fix is already dispatched. The 17:08 run dispatched Station 06 to
stage one tests-docs-only prompt; re-dispatching the same ask an hour later would duplicate it.
This becomes urgent the moment `origin/main` moves, because the SHA identity is the whole basis for
not re-measuring. Never-arm names unchanged: `pr-tr-s1-reminder-policy` (migration) and both
`pr-sot-*` (05's lane).

### F5 — `C:\po-vg` is still orphaned at 4,937 minutes holding one uncommitted file

`[LIVE]` from the sweep: `orphaned worktree … C:/po-vg 23c91ba9 [fix/no-rebase-while-checks-run],
dirty=1 files, age=4937 min`, with the sweep's own warning that `git worktree remove` will refuse
and `--force` would discard the file. Separately, `watcher clone: branch=main dirty=5`.

**DISPOSITION: DEFERRED** — both are Station 03's lane (`03` owns the watcher process, queue files
and local trees; 00 dispatches, and doing 03's job is LL-38). 03 has already escalated `C:\po-vg`
and its next occurrence is `2026-09-07T23:00:45Z`, inside six hours. I did not open a second
dispatch for work already dispatched. It becomes urgent if the age keeps climbing past 03's next
run with the file still uncommitted — at that point the right move is to preserve the file's
contents somewhere tracked before anything prunes anything.

## WHAT I DID NOT DO

- **Merged nothing.** All four open PRs hand-classified as Marco's; RULE 2 binds and no green,
  unlabelled, CLEAN reading overrides it.
- **Removed no label**, from `#1775` or `#1767` or anything else. Only Marco does that.
- **Armed nothing** — see F4. `arm-prompt.ps1` was not called; the arming log is unchanged since
  07:20:53Z.
- **Authored no approval receipt.** A scheduled run may never author one, and `#1774`'s missing
  receipt is Marco's to supply. I did not touch `docs/decisions/merge-approvals/`.
- **Did not re-run `triage-holds.ps1`** — justified by the unchanged `origin/main` SHA, and said so
  rather than implying I measured it.
- **Did not touch `/sot/`** (05's, CP-24), the watcher process or clone, `C:\po-vg`, or any cron.
- **Did not touch Azure, Entra or SharePoint.** Absolute.
- **Did not run `git` against the mount** — the guard was installed at the top of the run and this
  was a sighted run throughout, so every git call went through Desktop Commander on the Windows host.

---

**Needle discipline:** `zzQq00N20260907T1815` is now written into a tracked file and is **spent**.
The next run mints a fresh one.
