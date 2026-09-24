# Station 00 — Supervisor | 2026-09-24T20:14:12Z–2026-09-24T20:40Z

## GROUND

```
UTC            2026-09-24T20:15:14Z
origin/main    755f3440            (fetch first, then rev-parse)
dev tree       main @ 755f3440      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** (both `1`), so this run was not restricted to read-only.

**This run was SIGHTED.** Named explicitly, because a blind run and a healthy quiet run produce the
same "no news". Desktop Commander ids arrive **deferred**; a keyword `ToolSearch` loaded them first,
so a cold-call failure would have been an unloaded schema, not blindness.

⚠️ **`origin/main` moved under this run, and that is this run's headline.** The GROUND stamp above is
the preflight reading. By 20:22Z `origin/main` was **a63bd1cb** (#2148's merge, 20:16:30Z); the board
PR this report ships was cut from that commit. Every verdict below carries the time it was taken,
because §7's `[LIVE]` rule fired on this run rather than being quoted at it.

---

## WHAT I MEASURED

### Reachability, guard, binding-read contract

- [MEASURED] Windows host reachable. `start_process` shell `powershell.exe` → PID 1384, then
  `2026-09-25T06:14:39.2094794+10:00` and `Test-Path …\stations\00-supervisor.md` → `True`.
- [MEASURED] **`vm-git-guard.sh` exit code: `2`**, read from the installer itself with no pipeline
  appended. Headline verbatim:
  `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
  Last line verbatim: `PATH="/sessions/cool-friendly-einstein/.local/bin:$PATH" git <args>`.
  Its own controls, quoted: `bash -lc 'command -v git'` →
  `/sessions/cool-friendly-einstein/.local/bin/git`; `bash -c 'command -v git'` → `/usr/bin/git`.
  **Eighth consecutive run at exit 2** — the PREFLIGHT-documented expected outcome, not an anomaly.
- [MEASURED] **All three binding docs in the dev tree are byte-identical to `origin/main`** at the
  preflight commit, so reading the working copy was sound. Sanctioned probe, no piped hash
  (PREFLIGHT step 2): `git diff --numstat origin/main -- <each of the three>` → **EMPTY** on all
  three, and `git rev-list --left-right --count HEAD...origin/main` → `0	0`. Read in the **dev
  tree**, never the watcher clone.
- [MEASURED] All three read **in full** this run: `00-supervisor.md` (1660 lines), `DOCTRINE.md`
  (2961 lines), `STATION-CAPABILITIES.md` (593 lines).

### The sweep — and it expired in eight seconds

- [MEASURED] `status-sweep.ps1` run 1, generated **20:16:22Z**, captured with `*>` and decoded
  **`utf16le`** (§9.3 — a `utf8` read splits it into unparseable sections; `BOM_UTF16LE=true`,
  146,782 B, 428 lines). Section 0 positive controls both `[LIVE]` PASS. **Section 7 VERDICT: `SAFE
  TO ACT`.** No `[BROKEN]`. `[STALE]` escalation rows: **0** — the three `[STALE]` string hits are
  the header legend and one quoted `[FILE]` line, not rows.
- 🔴 [MEASURED] **That verdict was false eight seconds after it printed.** `#2148` merged at
  **20:16:30Z**. The sweep's own §3 gate reads *local* mutation signals — `index.lock`, scoped `git`
  processes, "no PR touched in the last 2 min" — and a remote merge by another lane touches none of
  them. This is `SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1` and the `[LIVE]`-expiry rule, reproduced
  together on one reading. See F3.
- [MEASURED] `status-sweep.ps1` run 2, generated **20:23:16Z**, launched detached. Section 0 controls
  PASS, no `[BROKEN]`, `[STALE]` escalation rows **0**. Its live readings are quoted below.
  ⚠️ Worth recording separately: run 1 exceeded the 180 s MCP tool-call cap and the tool returned a
  timeout **while the process kept running and kept writing** — the file went 0 B at 20:16:22Z to
  146,782 B, and `Get-CimInstance Win32_Process` found the sweep still alive. **A tool-call timeout
  is not a killed process**, and reading the partial file as the whole report would have been §9.6.

### COLLECT

- [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **`CLEAN`, exit 0.**
  Structure 2 checked, 0 malformed. Freshness: `00` 1.1h (cadence 1h) ok · `03` 21.3h (24h) ok ·
  `04` 2.2h (4h) ok · `05` 6.0h (24h) ok. **No station SILENT.**
- [MEASURED] Crossed against `lastRunAt` (scheduled-tasks MCP), because the breadcrumb is one
  instrument and cannot name a cause: `00` `2026-09-24T20:14:12Z` (this run) · `04` `18:09:50Z` ·
  `05` `14:22:54Z` · `03` `2026-09-23T23:02:54Z`, `nextRunAt 2026-09-24T23:02:45Z` ·
  `weekly-security-audit` **`enabled: false`**. Live enabled count **4**. Every enabled station's
  `lastRunAt` aligns with its newest breadcrumb. **No occurrence to chase, no transcript to read.**
- [MEASURED] Depth-1 tracked breadcrumbs on `origin/main`, asked of `origin/main` and never of the
  dev-tree index (`TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1`):
  `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` filtered to `docs/pr-prompts/00-`
  → **2**, both already tracked: 00's 1915Z and 04's 1810Z. Neither is unreported; both are
  archived by this run's PR.
- [MEASURED] Both carry a disposition on every finding — 04's five were dispositioned by the 1915Z
  run (its F4/F5/F7), and 1915Z dispositioned its own eight. That is the archive precondition.

### The board — measured twice, because it moved

- [MEASURED] **Q1 — three open PRs, all `BLOCKED`, none draft, ZERO DIRTY.** Raw `--json` plus
  `ConvertFrom-Json`, **no `--jq`** (§9.4's string-literal trap produces a blanket empty and is
  excluded by construction), then re-asked **per-PR** (LL-47 — never labels from a listing), with the
  negative control `gh pr view 999999 --json number,state` → exit **1**:

  | PR | state | labels | mergeStateStatus |
  |---|---|---|---|
  | #2167 | OPEN | **`do-not-merge`** | BLOCKED |
  | #2164 | OPEN | **`do-not-merge`** | BLOCKED |
  | #2158 | OPEN | **`do-not-merge`** | BLOCKED |

  **All three carry the label, so all three are `[LABEL_PRESENT]` — parked by design, nothing to do**
  (§9.4). The in-band positive control is that the same query returned `[]` for #2148 and a populated
  list for the other three, so the labels are a real reading and not a blanket empty.
- [MEASURED] The two PRs the 1915Z run reported as released-without-a-receipt are **gone from the
  board**: `gh pr view 2148 --json state,mergedAt` → **`MERGED`, `2026-09-24T20:16:30Z`**;
  `gh pr view 2166 --json state,mergedAt` → **`CLOSED`**, `mergedAt` empty, label `do-not-merge`
  re-applied. `#2167`'s full label history: `labeled 13:53:29Z` · `unlabeled 19:06:23Z` ·
  **`labeled 19:29:16Z`**, every event `by=GH-Mantova`.
- [MEASURED] **Trunk.** Sweep run 2, 20:23:16Z: `main CI on a63bd1cb: 2 success / 0 failed / 2
  running  (no failure so far, but 2 still running -- not yet green)`. Re-derived from its own source
  per `SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1` — `gh run list -R <owner>/<repo> --commit
  a63bd1cb59a9491f57e759c667cdf574a35adad7` (full 40-char SHA, §9.4) → 7 runs: `CI`, `Deploy`,
  `CodeQL`, `Tendering Browser Smoke` all `in_progress`; three `Claude Code` / `issue_comment` runs
  `skipped`. **No failure. Not yet green. `[CANNOT MEASURE]` a trunk verdict at this instant** — and
  the previous commit `755f3440` read `4 success / 0 failed (trunk green)` at 20:16:22Z.
- [MEASURED] **Q3 — armed prompts counted with my own eyes, twice.** At 20:15Z:
  `Get-ChildItem docs\pr-prompts -Filter *-ready.md` → **1**, `rev-2167-ready.md`, which is an
  auto-generated REVIEW JOB and not a prompt (§9.5). At 20:23:16Z the sweep read **2**:
  `rev-2167-ready.md` plus **`pr-formrule-legacy-payload-retire-ready.md`**. Not quoted from a note.
- [MEASURED] Watcher: node **RUNNING pid 42212**, auto-restart wrapper **alive (2)**, heartbeat
  **1 min**, clone `branch=main dirty=0`, and §3 reports **`BUILD IN FLIGHT: rev-2167-ready.md`
  (tick 0.7 min old)**. Judged **only** from `status-sweep`'s live process read — never `ps` across
  an OS boundary (RULE 1). Not wedged, not down, not idle-by-accident: it is working.
- [MEASURED] Safe-to-act signals immediately before this run touched anything, 20:26:05Z:
  `index.lock` dev/clone `False / False`; `git.exe` processes **2** (this run's own `fetch` and
  `worktree add`); `git diff --cached --name-status` in the dev tree **EMPTY**, so no concurrent
  chat's staged work was at risk (§9.2 — the dev-tree index is shared).

### The second lane, identified by measurement rather than inferred

- [MEASURED] `gh pr view 2148 --json commits` — the **authoring** commit list, never the squash
  (§10.2.1). Commit `07a85ef2`, `2026-09-24T19:29:57Z`, authors
  **`station-00.interactive-0004 <marco@initialservices.net>`** and
  `Claude Opus 5 <noreply@anthropic.com>`, headline
  `docs(merge-approvals): receipt for #2148 - Marco removed the label at…`. Its build commit
  `a121827e` reads `Marco <marco@initialservices.net>` — the watcher clone's own git config, the
  §10.2.1 row that makes the most human-looking identity the most automated actor.
- [MEASURED] `git show origin/main:docs/decisions/merge-approvals/2148.md` → exit 0. Front matter
  `approved_by: marco`, `approved_at: 2026-09-24T19:01:50Z`; the **body** names the lane
  (`actor station-00.interactive-0004`) and states *"Marco removed the `do-not-merge` label himself
  at 2026-09-24T19:01:50Z"*. Read the body, not the field (§10.2.1's closing rule) — and here the
  two agree.
- [MEASURED] `.arming-log.txt`, last line:
  `2026-09-24T20:21:20Z  ARMED  pr-formrule-legacy-payload-retire  escalates=false
  actor=station-00.interactive-0004  by=Marco@LAPTOP-E6NHU4E4  pid=33512`.
  **Armed six minutes into this run, by that lane.**
- [MEASURED] The sweep's worktree classifier, 20:23:16Z: `LIVE STATION WORKTREE: C:/po-wt/s8h
  0a890a49 [wt-s8h] dirty=0 age=4 min -- do NOT prune; a station is working here`.

### The armed prompt is a FIX, not a duplicate — checked before concluding

- [MEASURED] `pr-formrule-legacy-payload-retire-ready.md` front matter: `fixes_pr: 2158`,
  `escalates: false`, `gate_allow: none`, `seed_only: false`, `module: forms`, six `scope:` entries,
  all under `apps/web/src/pages/forms*` plus one `docs/pr-prompts/superseded/` retirement.
- [MEASURED] `gh pr view 2158 --json files` → ten files, every one under `apps/api/**` or
  `docs/data-model/`. **Scope overlap with the open PR it names: ZERO.** Under §10.6's corrected
  rule (prefix-match a `/`-terminated entry; any overlap ≥1 is a CANDIDATE, never a verdict) there
  is no candidate at all. The prompt's own body states the ordering reason: it must merge **before**
  #2158, because #2158 removes `rules` from `UpsertFormTemplateDto` while the web still sends it and
  `forbidNonWhitelisted` makes that a 400. That is §8 rule 4b's producer-before-consumer sequencing,
  applied correctly by the lane that armed it.

### A §9.1 trap reproduced live, twice, and the cure worked both times

- [MEASURED] `powershell.exe -NoProfile -Command "…$var…"` issued as a `start_process` command failed
  twice — `The string is missing the terminator: ".` and `Missing variable name after foreach` — the
  **nested** `-Command` form, which is the transport
  `COMMAND_LAYER_EXPANSION_IS_THE_NESTED_FORM_V1` says is the only one that demonstrates it. Moving
  the identical statements into a `.ps1` run with `-File` returned them correctly every time. The
  cure is free and it was needed.
- ⚠️ [MEASURED] And §9.4's CWD bullet composes with it exactly as written: Desktop Commander opens
  its shell in the Cowork session's `outputs` folder, which is **not a git repository**. Every `gh`
  call this run passed `-R GH-Mantova/ProjectOperations` and read `$LASTEXITCODE` before parsing.

---

## WHAT CHANGED

All work done in an **isolated worktree off `origin/main`** on the Windows FS
(`C:\po-wt\st00-collect-20260924-2015`, branch `board/station00-2026-09-24-2015`, cut at
`a63bd1cb`) — never the dev tree, never `C:\po-watcher`, never the interactive tree.

- **`docs/pr-prompts/00-00-supervisor-2026-09-24-1915-….md`** — `git mv` to
  `docs/pr-prompts/archive/`. Every finding in it carries a disposition.
- **`docs/pr-prompts/00-04-scanner-2026-09-24-1810-….md`** — `git mv` to
  `docs/pr-prompts/archive/`. Its five findings were dispositioned by the 1915Z run.
- **`docs/pr-prompts/needs-marco/three-prs-released-and-no-scheduled-run-can-write-their-receipts-2026-09-24.md`**
  — appended a second measured CORRECTION. The file is **TRACKED** (`git ls-files --error-unmatch`
  → exit 0; `git ls-files -- docs/pr-prompts/needs-marco/` → 10 tracked files), so this edit does
  not ride into another actor's commit. Written with **node, by concatenation** — never
  `String.replace` with a replacement string (§9.3) — with the insert converted to the working-copy
  CRLF and the byte delta asserted.
- **This breadcrumb**, written **inside the PR worktree** (REPORT CONTRACT cure 1), so no loose copy
  is left in the dev tree to block the next fast-forward.
- **Nothing merged. No label touched. No prompt armed, disarmed or renamed. No receipt authored.
  No worktree pruned. No stash dropped. No branch deleted. Nothing committed in the dev tree.**

---

## FINDINGS

### F1 — the receipt escalation is spent on all three PRs, and the lane that cleared it is now named

The 1915Z run escalated *"three PRs released at 19:01–19:06Z and no scheduled run can write their
CP-26 receipts"*, and its own correction at 19:42Z narrowed it to #2148 alone. **All three instances
are now closed**, measured on that file's own falsifying probe:

| PR | state now | why the instance is spent |
|---|---|---|
| #2148 | **MERGED 20:16:30Z** | receipt `2148.md` committed `19:29:57Z` by `station-00.interactive-0004`, on `origin/main` |
| #2166 | **CLOSED**, `do-not-merge` re-applied | closed unmerged as the duplicate of #2167; `[LABEL_PRESENT]` |
| #2167 | OPEN, `do-not-merge` re-applied `19:29:16Z` | `[LABEL_PRESENT]` — parked by design |

And the correction's one open question — *"If that lane is yours, the two re-parks are explained"* —
is **answered by measurement, not inference**: the receipt's authoring commit is
`station-00.interactive-0004 <marco@initialservices.net>` with `Claude Opus 5` as co-author, i.e.
the DOCTRINE §10.2.1 supervised interactive lane, live inside that exact window and still live now
(it armed a prompt at 20:21:20Z). The two 19:29Z re-labels, two seconds apart, fall inside that
lane's window and now have a named author.

**ACTIONED** — the escalation file is CORRECTED in this run's PR, not discharged. **It is not
discharged on purpose.** The station doc's clearing rule requires that *nothing GENERAL survives*,
and the general question does survive: *may a release carry a signature a scheduled run can read?*
Every one of the five label writes in that 28-minute window is `GH-Mantova`, so for a **headless**
run the answer is still no. What this run adds is that an **interactive** lane has the chat channel
and used it inside 28 minutes — which narrows the question to what happens when that lane is asleep,
which is exactly what option (A) in that file addresses. Marco's call, unchanged.

### F2 — a second lane is LIVE on the board right now, and this run stood off it deliberately

[MEASURED] `station-00.interactive-0004` merged #2148 at 20:16:30Z, wrote its receipt at 19:29:57Z,
re-labelled two PRs at 19:29:1xZ, and **armed `pr-formrule-legacy-payload-retire` at 20:21:20Z** —
six minutes into this run. A live station worktree `C:/po-wt/s8h` was 4 minutes old at 20:23:16Z.

BOARD DRIVING condition 3 is the load-bearing one and it says STOP when something else is acting.
This run therefore **armed nothing, merged nothing and renamed nothing**, and confined itself to
`docs/pr-prompts/` in its own disposable worktree — 00's recorded lane under §10.1 step 3, disjoint
from everything the other lane touched (`apps/web/**`, `docs/decisions/merge-approvals/`,
`scripts/**`). The dev tree's index was EMPTY before and after.

**ACTIONED** — the stand-off is the action, and it is recorded here so the next run does not read
"armed count went 0 → 2 with no 00 arm" as drift, and does not re-derive the actor from scratch.

### F3 — the sweep's `SAFE TO ACT` verdict was false eight seconds after it printed

[MEASURED] Sweep run 1 generated `20:16:22Z` and ended `SAFE TO ACT: no board mutation in progress,
no recent remote activity, no live station worktrees.` **#2148 merged at 20:16:30Z**, and sweep run 2
seven minutes later found a live station worktree, a build in flight and two armed prompts.

Nothing in §3 is wrong — its signals are `index.lock`, scoped `git` processes and "PR touched in the
last 2 min", and a **remote merge by another lane trips none of them**. The verdict is a correct
reading of local quiet, and it is read as a statement about the board. That is
`SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1`'s shape — provenance is not correctness — with a second
mechanism the existing bullet does not name: the gate is **local-only**, so a lane acting through
GitHub is invisible to it by construction, not by latency.

**DEFERRED** — real, and not worth widening a shared instrument mid-collision. What would make it
urgent: any run that arms or merges on a `SAFE TO ACT` line taken more than about sixty seconds
earlier. The complete-and-additive fix, for whoever takes it: have §3 also report the newest
`updatedAt` across open PRs **and** `.arming-log.txt`'s last line, so a remote-only actor appears in
the gate that exists to find one. Both quantities are already computed elsewhere in the same script,
so nothing new is instrumented and nothing existing is removed.

### F4 — `C:/po-worktrees/sup-cwd-paths` still holds the only copy of 2 files

[MEASURED] unchanged in sweep run 2 and now older: `dirty=2 files  age=768 min`, branch
`fix/pipeline-scripts-resolve-state-paths-from-module`. The sweep prints its own instruction —
*"HOLDS UNCOMMITTED WORK … `git worktree remove` will refuse, and `--force` would discard it."*
No lock files, so this is data-loss risk and **not** a wedged board.

**DISPATCHED → Station 03.** Worktrees and local trees are its lane; this is the fourth consecutive
report carrying it, and 03's `nextRunAt` is `2026-09-24T23:02:45Z`. I did not prune, force or commit.

### F5 — the device-bridge git guard is INERT, exit 2 — eighth consecutive run

[MEASURED] exit **2**, headline and both controls quoted under WHAT I MEASURED. Per PREFLIGHT this is
**the expected outcome for a station**: the installer writes its `PATH` export into `~/.bashrc` and
`~/.profile`, and a station's shell is non-interactive and non-login, so it sources neither.

**DEFERRED** — urgent only if a run ever reports a **non-zero-other-than-2** exit (the shim was not
written at all), or if any station runs `git` from the VM against the Windows `.git`. I ran none:
every `git` command this run was on the Windows host.

### F6 — Q6: the ONE thing blocking progress

**Nothing an agent is permitted to do.** All three open PRs carry `do-not-merge`, which only Marco
removes; zero are DIRTY; trunk has no failure; the watcher is healthy and building; the queue is
armed and moving; every station is fresh. The board's throughput constraint is the human label gate,
and the supervised interactive lane — which has the channel a headless run does not — is actively
working it.

**DEFERRED to F1's escalation.** It is the same question, and one answer clears the class rather
than these three instances.

---

## WHAT I DID NOT DO

- **Did not arm, disarm or rename a prompt.** A second lane armed one at 20:21:20Z and a watcher
  build was in flight; arming into that is BOARD DRIVING condition 3's collision and LL-38's shape.
- **Did not merge anything and did not touch a label.** All three open PRs are `[LABEL_PRESENT]`,
  which §9.4 classes as parked by design. Removing `do-not-merge` is an absolute stop for me.
- **Did not write a CP-26 receipt.** #2148's was written by the interactive lane from Marco's own
  words; a headless run has no such channel, and authoring one would certify what it cannot measure.
- **Did not discharge the receipt escalation**, although all three of its PR instances are spent —
  the general question survives, and the clearing rule requires that it not be cleared while one does.
- **Did not prune the two orphaned worktrees or `C:/po-wt/s8h`.** `sup-cwd-paths` holds the only copy
  of two files; `s8h` is a live station worktree the sweep explicitly says not to touch.
- **Did not commit in the dev tree, or on `main`.** Everything is in a disposable worktree on a
  branch. `git diff --cached --name-status` in the dev tree was EMPTY throughout.
- **Did not fast-forward the dev tree.** It is 1 behind `origin/main` and clean of anything I put
  there — I wrote no file into it, so I created no fast-forward blocker. With another lane working in
  that tree's worktrees, moving its `HEAD` mid-session is not mine to do.
- **Did not run `git` from the VM against the Windows `.git`.** The guard is INERT (exit 2), so that
  ban was remembered, not enforced — stated plainly, because an inert guard is not a licence.
- **Did not touch `/sot/`** (Station 05's), and did not do 03/04/05's work myself — F4 is dispatched,
  not performed.
- **Did not go near Azure, Entra or SharePoint.** Nothing this run came close.
- **Did not diagnose any red from the diff or the PR page.** The three open PRs' reds are the CP-26
  `[LABEL_PRESENT]` pair, read from the per-PR label state rather than from a checks rollup.
