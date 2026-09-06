# Station 00 — Supervisor | 2026-09-06T06:08Z–06:3xZ | SIGHTED — board empty, collected, retired 4 spent prompts, armed 1

## GROUND

```
UTC            2026-09-06T06:08:11Z  (lastRunAt, scheduled-tasks MCP)
origin/main    42aae6be   (#1690, 05:46Z)   fetched --prune, then rev-parse
dev tree       main @ 42aae6be   C:\ProjectOperations2   (opened at bc8ca0e8, behind 1; fast-forwarded)
doc version    1   docs/pipeline/stations/00-supervisor.md front matter
bootstrap      1   the scheduled-task file's station_doc_version
transport      SIGHTED — Desktop Commander start_process, powershell.exe
```

Doc version and bootstrap **AGREE** — this run was not restricted.

The three binding documents were read **in full** from the dev tree **after** the fast-forward, with
the tree proved equal to `origin/main`: `git rev-list --left-right --count HEAD...origin/main` →
`0	0`, `git diff --numstat` → EMPTY, `git diff --cached --name-status` → EMPTY. No piped hash was
used anywhere (PREFLIGHT step 2 / §9.1).

⚠️ **The transport mangled `$` on the very first call, exactly as §9.1 describes.**
`start_process` with `-Command "... + $env:COMPUTERNAME)"` arrived as `... + )` and died as a parser
error. Every subsequent command went through `interact_with_process` or `-File`. Recorded because
this is the trap firing in the first instruction of the run, not a new finding.

## WHAT I MEASURED

- **[MEASURED] The board was EMPTY.** `status-sweep.ps1` (06:09:39Z, captured through `cmd /c`
  redirection so the §9.3 UTF-16LE trap cannot eat it; 264 lines read back in full):
  `OPEN PRs: 0` · `armed (*-ready.md): 0` · `main CI on 42aae6be: 4 success / 0 failed` (trunk
  green) · §0 instrument controls both `[LIVE]` PASS · §7 `SAFE TO ACT`.
  **Nothing to merge, nothing to fix, nothing red.** The four PRs the 05:08Z run left open or
  driving (`#1687 #1689 #1690 #1691`) are all merged; `#1690`, which that run drove green and
  correctly refused to merge as Marco's, merged at `05:46Z`.

- **[MEASURED] Watcher healthy, and the 05:40Z recovery held.** `watcher node: RUNNING pid 17944`
  — the pid `-Fix` produced at 05:40Z, still alive 29 minutes later — wrapper alive (3), heartbeat
  27 min (ticks only mid-run; empty queue ⇒ idle, not wedged). `restart-watcher-if-wedged.ps1` was
  **not** run: there was no WEDGED/DOWN verdict to act on and an idle watcher with an empty queue is
  CORRECT.

- **[MEASURED] COLLECT.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**,
  `CLEAN`, every station `ok` (00 0.5 h · 03 7.2 h · 04 4.0 h · 05 16.0 h). Cross-checked against
  `list_scheduled_tasks` per the contract's table: `00 lastRunAt 06:08:11Z` · `03 2026-09-05T23:01:01Z`
  · `04 06:09:51Z` · `05 2026-09-05T14:10:49Z` — all fresh and aligned with their newest breadcrumbs,
  so none of the three failure rows applies and no station is SILENT. The known weakness is **not**
  re-raised: `check-breadcrumb.mjs`'s `CADENCE` map still reads `'00': 2` against a live cron of
  `5 * * * *`, which is escalation #23's territory and already filed.
  The queue root held exactly **two** breadcrumbs, both Station 00's; 03/04/05's newest were archived
  by earlier runs, so the only uncollected file was the 05:40Z addendum.

- **[MEASURED] Four prompts on the board are SPENT — the work already shipped.**
  `triage-holds.ps1` over **78** depth-1 `-HOLD.md`: `spent=4  gates-satisfied=36  still-gated=38
  unreadable=0`, with the tool's own two controls PASS (`git` can read `origin/main`, and the SPENT
  bucket was proved reachable on a fixture). Each of the four re-linted individually, exit **3**:

  | prompt | lint | the PR that shipped it | merged |
  |---|---|---|---|
  | `pr-cardui-s7-cutting-section-HOLD.md` | STALE / exit 3 | `#1682` cutting take-off on the card | `4a0209db` |
  | `pr-cardui-s8-waste-section-HOLD.md` | STALE / exit 3 | `#1689` the Waste section on the card | 04:36Z |
  | `pr-scopesub-s5-sub-tab-ui-HOLD.md` | STALE / exit 3 | `#1690` the SUB tab | 05:46Z |
  | `pr-stages-s2-cards-can-share-a-stage-HOLD.md` | STALE / exit 3 | `#1687` two cards can share a stage | 03:14Z |

- **[MEASURED] RULE 4's arming detector on the one prompt armed, all three markers, with controls.**
  Marker sources read from `origin/main:scripts/pipeline/lint-prompt.mjs` by symbol, not line number:
  `DO_NOT_ARM_COMMENT = /<!--\s*watcher:\s*do-not-arm\s*-->/i`, `DO_NOT_ARM_CAPS = /DO NOT ARM/`
  (case-**sensitive**), `ARM_ONLY = /Arm ONLY/i` — **`ARM_ONLY` is now case-INsensitive**, changed by
  `#1667` (`a84048d8`), so a case-sensitive grep on all three under-reports and this run used the
  right case per marker.
  Target `pr-artifactregister-s2-name-what-is-missing-HOLD.md` → **0 / 0 / 0**.
  POSITIVE control `pr-524-rates-b-slice2-canonical-HOLD.md` → 0 / **1** / **1**.
  NEGATIVE control, freshly minted this run, `zzQq00Needle20260906T0615` → **0**.
  Body read in full: the "Do NOT" list is scope limits, `## STANDING AUTHORITY` is the boilerplate
  that sits on ~51 of 61 prompts, and **no prose human gate is present**.

- **[MEASURED] §10.6 duplicate test, and it is vacuous today.** `gh pr list --state open` → **0**, so
  no open PR's file list can collide with the prompt's `scope:` (`docs/design/ARTIFACT-REGISTER.md`,
  one path). Prior-arm history: `.arming-log.txt` names only `pr-artifactregister-s1` (2026-09-03),
  never s2; `processed/` holds `s1`'s two files and nothing for s2; s2 appears in no `superseded/`,
  `blocked/`, `failed/`, `no-pr-opened/` or `needs-marco/`. **Never armed, never built.**

- **[MEASURED] The watcher clone is 11 commits behind `main` and carries two untracked files.**
  Read-only git only — nothing was written in `C:\po-watcher`.
  `git -C C:\po-watcher\ProjectOperations rev-parse HEAD` → `90a32d95` (`#1662`), on `main`;
  `git -C C:\ProjectOperations2 merge-base --is-ancestor 90a32d95 origin/main` → exit 0
  (POSITIVE control on `42aae6be` → exit 0); `git rev-list --count 90a32d95..origin/main` → **11**.
  🟢 **None of the 11 touches `scripts/pr-watcher/`** — `git log --oneline 90a32d95..origin/main --
  scripts/pr-watcher` → EMPTY — so the running watcher is **not** executing stale watcher code, and
  §9.5's *"a restart adopts nothing"* has no bite here today. Untracked: `.conflict-notified-prs.json`
  (300 B, 2026-09-04T22:53Z) and a file literally named **`C:<U+F03A>temppr-1648.diff`** (8260 B,
  2026-09-05T07:42Z) in the clone ROOT — a Windows path written as a filename. `git stash list` in
  the clone → **66**.

## WHAT CHANGED

1. **Dev tree fast-forwarded** `bc8ca0e8` → `42aae6be`. Read back all three:
   `0	0`, `--numstat` EMPTY, `--cached --name-status` EMPTY. Neither FF cure was needed — the tree
   was clean going in, because the 05:08Z run used cure 1 and wrote its breadcrumb into its own PR.
2. **ONE prompt armed** — `pr-artifactregister-s2-name-what-is-missing`, via `arm-prompt.ps1`
   (`-WhatIf` first, exit 0; then for real), **never a bare `git mv`**.
   Actor recorded as `station-00-scheduled-0608Z`. Read back: the queue holds exactly one
   `*-ready.md` and it is this one; `.arming-log.txt` gained
   `2026-09-06T06:16:17Z  ARMED  pr-artifactregister-s2-name-what-is-missing  escalates=false
   actor=station-00-scheduled-0608Z  by=Marco@LAPTOP-E6NHU4E4  pid=28372`.
   `status-sweep.ps1` was **re-run immediately before the arm** (06:13:58Z) and still read
   `SAFE TO ACT` with 0 in-progress prompts, no `index.lock` in either tree and 0 git processes.
3. **The arming log is committed in this PR**, per §9.5 — the bullet whose defect is that nothing
   commits it on purpose.
4. **Four SPENT prompts retired** to `docs/pr-prompts/superseded/` (F1).
5. **The 05:40Z addendum breadcrumb committed** to `docs/pr-prompts/archive/` (F2). It was untracked;
   byte-identity of the copy asserted with `Buffer.compare` → `identical=true`, 8291 B.
6. **The 05:08Z breadcrumb archived** — every finding in it carries a disposition.
7. **The `#19` escalation thread gained an addendum** carrying the 05:40Z measurements (F3).
   `needs-marco/watcher-launcher-chain-unversioned-2026-09-04.md`, 6522 → 10514 B, byte delta
   asserted (`added=3992`, `DELTA_MATCH=true`, `HEAD_INTACT=true`, prior tail intact, negative
   control false). Written to the dev tree, not this PR — the folder is gitignored (05:08Z F1).
8. **This breadcrumb was written inside this PR's worktree** (cure 1), so no loose copy exists in the
   dev tree and no post-merge fast-forward blocker is created by it.

**Not changed:** no label added or removed, no `sot/` edit, no production data, no Azure / Entra /
SharePoint, no watcher restart, **no write of any kind in `C:\po-watcher`**, nothing in `C:\po-vg`,
no `.gitignore` change, and no merge of anything that is not this station's own docs lane.

## FINDINGS

### F1 — FOUR prompts were left armable by second-lane merges at once, the largest count recorded. DOCTRINE §10.6 reproducing four times in one night. **S2 — ACTIONED.**

§10.6 says it plainly: *"The watcher deletes a prompt when it builds it. A second lane does not,
because it never reads the queue."* It was written on 2026-09-05 off **two** simultaneous instances.
Twenty-four hours later there are **four**, and all four are the same shape — a feature PR opened by
the second lane, merged, and its `-HOLD.md` still sitting at depth 1 of the queue with its premise
now false.

What makes this worth recording rather than just fixing: **the four sat in the SPENT bucket, not the
ADMIT bucket.** §10.6's danger case is the prompt whose PR is still OPEN — the premise is intact, the
prompt reads ADMIT, and arming it opens a second PR for work already in flight. These four had merged
already, so the premise had died and `lint-prompt.mjs` caught every one at exit 3. **The linter is the
backstop and it worked.** But it only works *after* the PR merges, and `triage-holds.ps1` is the only
thing that looks — nothing sweeps the SPENT bucket on a schedule, so the count grows until a 00 run
happens to run the triage. This run found four; the run before it did not look.

**ACTIONED** — all four `git mv`d to `docs/pr-prompts/superseded/` in this PR, which is exactly what
`triage-holds.ps1` prints as the instruction for its SPENT bucket. Verified: `git status --porcelain`
shows four `R ` renames into `superseded/`, and depth-1 `-HOLD.md` drops 78 → 73 (four retired, one
armed).

⚠️ **Deliberately NOT proposed as an automation.** A sweep that retires prompts on a lint verdict is
a destructive action driven by an instrument, and §7's whole subject is instruments that lie in the
confident direction. The four here were each re-linted individually and cross-checked against the
merged PR that shipped them; that cross-check is the part a cron would not do.

### F2 — the 05:40Z addendum was UNTRACKED, so the dispatch inside it could not reach the station it was addressed to. **S2 — ACTIONED.**

The 05:40Z addendum carries **F8, DISPATCHED → Station 03** (`raw node exit: -1` on a review job, the
second recorded occurrence). Station 03 runs daily at 23:00Z and reads breadcrumbs from the repo —
**it does not read chats and it cannot read an untracked file in a tree it has to be told about.**
The addendum said so itself in its own header: *"This file is UNTRACKED in the dev tree — the next
sighted 00 run must sweep it into a board PR."*

`check-breadcrumb.mjs` prints the same thing as a `NOTE` line rather than a failure, which is right —
it is a warning, not a malformed report — but it means an uncollected dispatch is exactly as loud as
a healthy one to anything that only reads the exit code.

**ACTIONED** — committed to `docs/pr-prompts/archive/` in this PR, byte-identical to the dev-tree
copy (`Buffer.compare` → 0). Archiving does **not** make it read SILENT: §9.5 records that
`--freshness` builds its tracked set with `git ls-tree -r` and matches by trailing path segment, and
this run's own `--freshness` (run before the move) already read `00 … 0.5h ago ok` off that file.

Both of its findings are now dispositioned by this collect: **F7 → ESCALATED** (see F3 below),
**F8 → DISPATCHED → 03**, carried forward here so it survives in a tracked file.

### F3 — the closing sentence of escalation `#19` is refuted, and it now has a measured cost. **S1 — ESCALATED (appended to the existing thread, not raised as new).**

`needs-marco/watcher-launcher-chain-unversioned-2026-09-04.md` ends: *"What is missing is not
reliability — it is reviewability."* The 05:40Z run measured the opposite. The watcher exited code 1
at `05:27:31Z` with its wrapper present and alive; the 60-second auto-restart in
`supervise-watcher.ps1` that `00-supervisor.md` §3a describes — and tells every run **not to
duplicate** — did not fire at +98 s, +3 m 22 s or +7 m 06 s. What recovered it was
`ensure-watcher.ps1`, on a 10-minute tick, **7 m 32 s later** — and that file is not in this
repository, which is what `#19` is about. Total downtime about 13 minutes.

🔴 **The third consequence is the one that outlives the outage:** a watcher relaunched by
`ensure-watcher.ps1` writes nothing to `watcher-launch.log` — no line from `05:27:31Z` through two
relaunches, a completed review job and an archived verdict at `05:40:18Z` — and
`restart-watcher-if-wedged.ps1` reads its churn counter from that log. It reported `1 cycle in
20 min` while at least three starts had occurred. **Every liveness reading this pipeline takes is
taken through that log**, so this is a §7 instrument defect with an outage attached, not just a
missing file.

**ESCALATED**, appended to the existing `#19` thread rather than opened as a new escalation — a new
file would split the evidence from the question. RULE 1 options are unchanged from the 05:40Z run's
F7 and are Marco's: **(a)** bring the three launcher scripts into `scripts/pr-watcher/` and point
`C:\po-watcher\*` at them, *then* diagnose the exit-1 path — complete (the outage becomes diagnosable
immediately) and additive (the chain becomes reviewable, testable and fixable permanently, and `#19`
closes with it), touching no queue, prompt, schema or gate; **(b)** fix only the logging — fails the
complete half, makes the fault visible rather than absent; **(c)** shorten the tick to 2 minutes —
fails both halves, caps the outage without touching either cause and multiplies the relaunch churn
`restart-watcher-if-wedged.ps1` counts toward its threshold of 4.

⚠️ **The append reaches this machine and nothing else.** `needs-marco/` is gitignored
(`.gitignore:82`, measured by the 05:08Z run with both controls), and whether to track it is
question F1 of that run — still open, still Marco's, **not re-raised here**.

### F4 — the watcher clone is 11 commits behind and holds a file named after a Windows path. **S3 — DISPATCHED → 03.**

Measured above, read-only. The two halves matter differently:

- **The staleness is currently harmless and should not be chased as urgent** — none of the 11
  commits touches `scripts/pr-watcher/`, so the running watcher is executing current code. Stated
  explicitly because §9.5's *"a restart adopts nothing"* invites the opposite conclusion from the
  count alone, and a run that reads `11 behind` without the path filter files a false S1.
- **`C:<U+F03A>temppr-1648.diff` in the clone root is a real defect.** 8260 bytes, written
  `2026-09-05T07:42:10Z`, name containing U+F03A (the private-use colon Windows substitutes when a
  literal `C:\temp\...` is used as a filename). Something wrote a PR diff to a path it believed was
  `C:\temp\pr-1648.diff` and got a file in the repository root instead. It also keeps the clone
  permanently dirty, which `status-sweep.ps1` flags as *"NOT clean-on-main; the watcher may refuse to
  start"* every single run — a standing false-ish alarm on the one tree the queue depends on.

**DISPATCHED → Station 03 (machine-minder)** — clone hygiene, locks and worktrees are its lane and
none of it is mine to write. What to bring back: which code path constructs that `C:\temp` filename
(`pr-1648` dates it to 2026-09-05); whether `.conflict-notified-prs.json` is runtime state that
belongs in `.gitignore`; and the clone's `git stash list` count of **66**, which is §9.2's recorded
closed loop (`drop`, **never `pop`**) — report the count and its growth, do not clear it blind.

### F5 — the prompt this run armed disagrees with itself about its own acceptance number. **S3 — DEFERRED.**

`pr-artifactregister-s2`'s executable `done_when` requires
`grep -c 'claude.ai/code/artifact/' … -ge 35`. Its prose **Verify** section says *"returns 34 or more
(it was 32 before AR-S2; the two new rows take it to 34)"* — but its **Do** section specifies
**three** rows, and 32 + 3 = 35. The gate is right and the prose is wrong, off by the third row.

This is the recorded failure family — a prose claim drifting from the executable gate beside it —
and it is why `PROMPT-SCHEMA.md` requires the premise to be executable. The risk here is bounded:
an agent following **Do** produces 35 and `done_when` passes.

**DEFERRED, not fixed.** The prompt is armed and gitignored as `-ready.md`; editing a prompt the
watcher may already be reading is a worse defect than the one it corrects. **What would make it
urgent:** the resulting PR coming back with 34 occurrences and a failing `done_when` — in which case
this is a fix-forward on that PR, not a prompt edit. Recorded here so the next reader does not
diagnose it from scratch.

## WHAT I DID NOT DO

- **Did not merge anything that was not this station's own docs lane.** There was nothing to merge:
  `OPEN PRs: 0` at 06:09Z and again at 06:14Z.
- **Did not arm a second prompt.** 36 prompts read ADMIT; **one** was armed, per the one-at-a-time
  rule. Of the 36, only two are confined to `tests|docs` and could therefore ride the auto-merge lane
  — this one and `pr-smoke-share-worker-tokens` (`tests/e2e/**`) — and the smaller, single-file one
  was chosen. Everything else in the bucket routes to Marco by `classifyPolicyFiles`, and the memory
  of this board is explicit that arming those faster lengthens his queue rather than shortening it.
- **Did not arm any prompt on the standing never-arm list**, and did not arm
  `pr-verdict-anchor-heading-form-HOLD.md` or `pr-watcher-verdict-home-resolver-HOLD.md` (both staged
  deliberately, both ask Marco first), `pr-tr-s1-reminder-policy-HOLD.md` (a schema migration),
  `pr-watcher-app-auth-switch-on-HOLD.md` (production auth), `pr-hygiene-s1-guarded-branch-prune-HOLD.md`
  (branch deletion is irreversible), or `pr-vmguard-s2-preflight-installs-guard-HOLD.md` (it rewrites
  all seven station docs and `_canonical-blocks.json` — DOCTRINE §10.3 says hand-land a canonical
  block, never route it through the auto lane).
- **Did not touch `C:\po-watcher` with any write** — every clone reading in F4 was `git status`,
  `rev-parse`, `log`, `stash list` or a file stat.
- **Did not prune or touch `C:\po-vg`.** Its single dirty file is the 05:08Z run's F6, already
  DEFERRED and DISPATCHED → 03; the "never pushed" half was refuted on 2026-09-06T03:3xZ and is not
  re-litigated.
- **Did not restart the watcher**, and did not run `restart-watcher-if-wedged.ps1 -Fix` — pid 17944
  is alive, the wrapper is alive, and there was no WEDGED/DOWN verdict.
- **Did not change `.gitignore`** (the 05:08Z F1 option (a)) — Marco's, unanswered, and landing the
  weaker option while the stronger one is open would close the question badly.
- **Did not re-raise** escalation #23's `'00': 2` cadence row, the CP-26 label-release path, the
  hourly poller cadence, the three-homes verdict defect, or `#1635`. All are live and already filed.
- **Did not run a smoke.** This PR is docs-only and opens no code; `Assert-SmokedOrEscalate` is
  reached at merge, not here.
