# Station 00 — Supervisor | 2026-09-24T14:14:09Z–2026-09-24T14:40Z

## GROUND

```
UTC            2026-09-24T14:14:09Z
origin/main    11c07025
dev tree       main @ 11c07025  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`) — this run was not read-only-by-mismatch.

Binding documents read in full this run: `docs/pipeline/stations/00-supervisor.md`,
`docs/pipeline/DOCTRINE.md`, `docs/pipeline/STATION-CAPABILITIES.md`. Read from the working copy,
then proved current against `origin/main` by the 9.3-sanctioned form (no piped hash, per PREFLIGHT):

```
git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md
  -> EMPTY output
git rev-list --left-right --count HEAD...origin/main  ->  0	0
```

So the working copy is byte-equivalent to `origin/main` for all three, and the 9.2 behind-HEAD
caveat does not apply to any `git status` reading below.

## WHAT I MEASURED

**Host reachable — NOT a blind run.** `start_process` shell `powershell.exe` returned
`2026-09-25T00:14:29.4139428+10:00`, branch `main`, `11c07025` on the first call. Desktop Commander
tool ids were loaded via `ToolSearch` BEFORE any call, so no `InputValidationError` was available to
be misread as blindness.

**Device-bridge git guard.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
exit code read from the INSTALLER and not from a pipeline appended to it:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
...
   PATH="/sessions/exciting-relaxed-johnson/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

[MEASURED] **EXIT CODE 2** — the station doc's expected middle outcome for a non-interactive
non-login shell. The ban was REMEMBERED, not mechanical, for this entire run, and it was kept: every
`git` call below ran through Desktop Commander on the Windows host, and no `git` was run against a
mounted folder from the VM.

### Freshness and the COLLECT cross-check

`node scripts/pipeline/check-breadcrumb.mjs --freshness`, **exit 0**, verbatim:

```
structure: 2 checked, 0 malformed, 0 skipped as pre-contract
  00  last 2026-09-24T13:14:00Z  1.1h ago  (cadence 1h)  ok
  02  dispatch-only — no cadence to miss
  03  last 2026-09-23T23:04:00Z  15.3h ago  (cadence 24h)  ok
  04  last 2026-09-24T14:10:00Z  0.2h ago  (cadence 4h)  ok
  05  last 2026-09-23T14:23:00Z  23.9h ago  (cadence 24h)  ok
CLEAN
```

Crossed against `lastRunAt` from the scheduled-tasks MCP, per the station doc's four-row table. Three
rows aligned. The fourth did not, and it is F1 below.

### The board — every open PR, with its lane

`gh pr list --state open` -> **5**. Per-PR `gh pr view <n> --json labels,files,mergeStateStatus`
(never a list response — 9.4's `merged`-field bullet), `-R GH-Mantova/ProjectOperations` on every
call, `$LASTEXITCODE` tested before every parse:

| PR | title scope | files | label | 10.1 lane | verdict |
|---|---|---|---|---|---|
| #2167 | `verdict-guard` | 3 x `scripts/pr-watcher/**` | `do-not-merge` | watcher-opened, **`marco:true`** | RULE 2 binds |
| #2166 | `verdict-guard` | the SAME 3 files | `do-not-merge` | **NO LOG — second lane, hand-classified** | Marco's (10.1 step 2) |
| #2164 | `tendering` | 4 x `apps/web/**` | `do-not-merge` | watcher-opened, **`marco:true`** | RULE 2 binds |
| #2158 | `forms` | 10, incl. `apps/api/prisma/migrations/` | `do-not-merge` | watcher-opened, **`marco:true`** | RULE 2 binds + migration |
| #2148 | `auth` | 7 x `apps/api/**` | `do-not-merge` | watcher-opened, **`marco:true`** | RULE 2 binds |

**RULE 2 probe, controls stated.** `Select-String -Path docs\pr-prompts\processed\pr-*.log` (the LIVE
tree `C:\ProjectOperations2`, never the clone decoy — 9.5), `rev-*` excluded, pattern written
without a quote character and without a backslash escape (9.1's
`NODE_E_REGEX_BACKSLASH_DOUBLES_THROUGH_POWERSHELL_V1`), as `'PR #<n>(?![0-9])'`:

- POSITIVE: #2167 -> 1 hit, a real
  `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`;
  #2164 -> 2; #2158 -> 2; #2148 -> 2, each carrying a real `marco:true` verdict.
- NEGATIVE: `PR #999997` -> **0**; and **`PR #2165` -> 0** — this run's own predecessor board PR,
  which the watcher never opened. That is the control 9.5 requires: it proves `NO LOG` means
  *second lane* and not *probe broken*.
- FRESHNESS PRECONDITION: newest `processed/pr-*.log` is
  `pr-verdictguard-spaced-path-candidates-ready.md.log` at **2026-09-24T13:53:36Z**, younger than
  every open PR's `createdAt`. So a `NO LOG` here is a real absence, not a frozen corpus.

**So the merge lane is EMPTY, and correctly so.** All five carry `do-not-merge`, which only Marco
removes; four carry a live watcher `marco:true`, which 10.1 step 1 says binds and runs first; the
fifth is second lane touching `scripts/pr-watcher/**`, i.e. outside `tests|docs` AND outside 00's
recorded `docs/` lane, which `STATION-CAPABILITIES.md` section 5 settled on 2026-09-22 is **Marco's**
(`NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1`). Nothing on this board was mine to merge.

### The reds, separated into parked and real

Read from the job logs, never from the PR page, and split on the tab with the LAST column taken
(9.1's three-column bullet).

**Parked by design — no agent-side action.** CP-26's verdict TOKEN, quoted verbatim from column 3:

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

`[LABEL_PRESENT]` on both #2166 and #2167. That single cause produces **two** red rows on every one
of the five PRs — the required check `Approval receipt (CP-26)` and the same check run as a step
inside `PR gates — diff checks` — exactly as 9.4 records. Counting those as work is the mistake
three consecutive collect runs made; they are not counted as work here.

**Real, and fixed — see F2.** `Pipeline — watcher + linter tests` failed on BOTH #2166 and #2167.
`# fail 0` on every test file and **no `not ok` line anywhere in 5454 log lines**, with
`##[error]Process completed with exit code 1` at the end — so it was never a test assertion. The tail
names the cause:

```
[TITLE_SCOPE_UNRESOLVED] scope "verdict-guard" names nothing this repo can point at.
FAIL    "fix(verdict-guard): rescue bare paths under spaced top-level directories ..."
        Do NOT add this scope to scripts/pipeline/title-scope-baseline.json. That file
        may only SHRINK; adding to it is the gate failing open.
```

### Machinery

From `status-sweep.ps1`, `[LIVE]` lines only, re-run immediately before the board mutation below:

- watcher node **RUNNING pid 42212**, auto-restart wrapper **alive (2)**, heartbeat 24 min (ticks
  only mid-run; stale + empty queue = idle, NOT wedged), watcher clone `branch=main dirty=0`.
- safe-to-act gate at the moment of mutation: `index.lock` interactive/clone **False / False**,
  scoped git processes **0**, machine-wide git processes **0**, **no PR touched in the last 2 min**,
  no build in flight.
- armed `*-ready.md` on disk: **0** — counted directly with `Get-ChildItem`, not quoted from a note.
- `main` CI on `11c07025`: **4 success / 0 failed** (trunk green).
- Two non-main worktrees, both aged (404 min / 344 min); `C:/po-worktrees/sup-cwd-paths` holds
  **2 dirty files**. Left alone — see WHAT I DID NOT DO.
- No `MERGE_HEAD`, no rebase state, no unmerged paths in either tree. `restart-watcher-if-wedged.ps1`
  was NOT needed: the watcher is alive with an empty queue, which the station doc records as CORRECT
  rather than wedged.

## WHAT CHANGED

1. **PR #2166 renamed** `fix(verdict-guard): ...` -> **`fix(pr-watcher): recover paths whose
   top-level dir contains a space`**. `gh pr edit` exit 0, title read back from
   `gh pr view --json title`.
2. **PR #2167 renamed** `fix(verdict-guard): ...` -> **`fix(pr-watcher): rescue bare paths under
   spaced top-level directories (SPACED_PATH_CANDIDATES_V1)`**. Same read-back.
3. **`gh run rerun 36009510958 --failed`** on #2166's stale `tendering-e2e`, exit 0.
4. **This board PR**: this breadcrumb, Station 04's 14:10Z breadcrumb, Station 04's
   `sweep-rotation.json` advance, the F3 deletion, and the archiving of this station's 13:14Z
   breadcrumb.

**Nothing was merged. Nothing was armed. No label was added or removed. No prompt was renamed,
disarmed or binned. `/sot/` was not touched.**

## FINDINGS

### F1 — `nextRunAt` had ALREADY skipped 05's 2026-09-24 occurrence EIGHT MINUTES BEFORE that occurrence fired, and the pair of fields reads as a 48-hour outage on the only station that may edit `/sot/`

⚠️ **CORRECTED IN THE SAME RUN THAT WROTE IT.** The first version of this finding claimed the two
fields *"disagreed for at least 13 minutes"* and printed a three-row table with read times of
`~14:14Z`, `~14:35Z` and `~14:55Z`. **Only the first of those was measured.** This run began at
`14:14:09Z` and its board PR merged at `14:35:14Z`, so the whole run is ~22 minutes and the other two
stamps could not have happened. They were inferred and written with the confidence of a measurement —
DOCTRINE 7.1's exact failure, in the report that section governs. The claim below is the part that
survives being checked.

[MEASURED] at this run's start, `2026-09-24T14:14:09Z` — a hard stamp, being this session's own
directory creation time and its own `lastRunAt` to the millisecond. The scheduled-tasks MCP reported
for `05-sot-keeper`:

```
lastRunAt   2026-09-23T14:22:41Z
nextRunAt   2026-09-25T14:22:37Z
```

**05 then fired at `2026-09-24T14:22:54Z`** — eight minutes AFTER that reading, and on a date
`nextRunAt` had already declared finished. So at `14:14:09Z` the payload was announcing that the next
run was a full day away while the 09-24 occurrence had not yet happened and was about to.

**POSITIVE CONTROL that the payload's arithmetic is otherwise sound**, same read: `00` `lastRunAt` +
1 h = `nextRunAt`; `04` + 4 h = `nextRunAt`; `03` + 24 h = `nextRunAt`. Only `05` showed **+48 h**.

**[CANNOT MEASURE] how long `lastRunAt` stayed stale after 05 fired.** A later read in this run showed
it still at `2026-09-23`, and a later one still showed it corrected to `2026-09-24T14:22:54.276Z`, but
those two calls carry no timestamp of their own and the first of them may well have preceded
`14:22:54Z` entirely — in which case it was simply correct. The lag is therefore **not** part of this
finding.

**The available conclusion from the first two reads was false and expensive:** *"05 missed its
2026-09-24 occurrence and the scheduler has already rolled past it — a 48-hour coverage gap on the
only station that may edit `/sot/`"*. It is internally consistent, it survives the station doc's own
four-row cross-check table (whose FIRST row is *"`lastRunAt` older than one cadence => the occurrence
never fired"*), and `--freshness` cannot contradict it — it printed `05 ... 23.9h ago ok`, because it
compares breadcrumb dates and nothing else.

**The discriminator is the third instrument the station doc already names, and it settled it in one
call.** Scanning `...\local-agent-mode-sessions` for a directory of ANY name at that depth (never the
retired `local_*` filter — the 2026-09-15 rename correction) and reading `CreationTimeUtc`:

| directory | `CreationTimeUtc` | whose |
|---|---|---|
| `50f717fe` | **2026-09-24T14:22:54.2759161Z** | **05's occurrence — it FIRED** |
| `b3a496a4` | 2026-09-24T14:14:09.3460713Z | this run, = its own `lastRunAt` to the millisecond |
| `b1aab07d` | 2026-09-24T14:09:48.2511937Z | 04's run, = its `lastRunAt` to the millisecond |

Two of the three rows are a positive control calibrating the instrument against `lastRunAt` values
that were never in doubt. The later MCP read then agreed with the directory to the millisecond
(`14:22:54.276` vs `14:22:54.2759161`), which closes it: **05 ran on schedule; there is no gap.**

**Why this earns a finding rather than a note.** The station doc's cross-check table treats
`lastRunAt` as answering *"did the occurrence fire?"*. Against `nextRunAt` it cannot, because
`nextRunAt` rolls forward **before** the occurrence it is skipping past, so the two fields compose —
for some window before a daily station's run — into a confident, coherent, wrong outage. The doc already names the session
directory as a third instrument, but scopes it to a *different* question — *"did an EARLIER
occurrence fire?"* — so a run meeting this shape has no instruction telling it to reach for the one
probe that answers. And 00 is HOURLY while 03 and 05 are daily, so 00 lands inside that window
routinely by construction, exactly as `STATION-CAPABILITIES.md` section 6 records for the 00x04
overlap. A false outage on 05 is the shape DOCTRINE section 7 warns costs most: a false alarm
licenses action.

**ACTIONED** — refuted inside this run before it was written down as a defect, by the measurements
above; and recorded here so the next run that meets the same two-field disagreement reaches for the
session directory instead of filing the outage. **Falsifying probe: read the MCP at a stamped moment
shortly BEFORE a daily station's next occurrence** — stamp it with something independent, such as
`(Get-Date).ToUniversalTime()`, rather than with an estimate — **and compare `nextRunAt` against that
station's session-directory creation time afterwards.** If `nextRunAt` ever names the occurrence that
is about to fire rather than the one after it, this finding is wrong and must be re-measured.

### F2 — both verdict-guard PRs were red on the PR TITLE, not on their code, and the gate's own remedy fixed both

[MEASURED] at `11c07025`. `Pipeline — watcher + linter tests` failed on #2166 (`13:59:37Z`) and
#2167 (`14:05:42Z`). Quoted above: every test file reported `# fail 0`, no `not ok` line exists in
either log, and the job still exited 1 — the failing step is
`node scripts/pipeline/check-pr-title.mjs`, raising `[TITLE_SCOPE_UNRESOLVED]` on the scope
`verdict-guard`.

**Candidate scopes tested against the real gate**, by running `check-pr-title.mjs` locally with
`PR_TITLE` set and reading its EXIT CODE rather than its output:

| scope | exit |
|---|---|
| `pr-watcher` | **0** |
| `pipeline` | 0 |
| `watcher` | 0 |
| `scripts` | **1** |

`pr-watcher` is both resolvable and *true*: all three changed files live in `scripts/pr-watcher/`.

**RULE 1 — the fix chosen is the complete-and-additive one.** Renaming the PR to the scope the gate
resolves is the remedy the gate itself prints, it changes no code, and it damages no data entry. The
fast alternative the gate explicitly forbids — adding `verdict-guard` to
`scripts/pipeline/title-scope-baseline.json` — is a **mask**, not an unblock (DOCTRINE section 8.2:
*no GATE-ALLOW / SEED-ONLY marker that is not actually true*; the file's own contract is that it may
only SHRINK). It was not used.

**READ BACK — the fix is proved, not asserted.** After both renames, fresh runs `36012591322` (#2166)
and `36012596473` (#2167):

| check | #2166 before -> after | #2167 before -> after |
|---|---|---|
| `Pipeline — watcher + linter tests` | fail -> **pass (14s)** | fail -> **pass (35s)** |
| `tendering-e2e` | fail (stale run) -> re-run issued | **pass (16m14s)** |
| `Approval receipt (CP-26)` | fail `[LABEL_PRESENT]` -> unchanged | fail `[LABEL_PRESENT]` -> unchanged |
| `PR gates — diff checks` | fail (same CP-26 cause) -> unchanged | fail (same CP-26 cause) -> unchanged |

So **#2167 is now green on everything except the label**, and #2166 is green on everything except the
label and an e2e whose re-run was issued at exit 0. Neither was merged and neither had auto-merge
armed: both carry `do-not-merge`, and #2167 additionally carries a live watcher `marco:true`.

**A title edit DID retrigger the gating workflow here** — worth recording, because
`00-supervisor.md` warns that a PR **body** edit does not, and a reader could generalise that to
titles and reach for `gh run rerun` unnecessarily. The e2e workflow is separate and did **not**
retrigger, which is why the rerun above was issued for it specifically.

**ACTIONED** — both PRs renamed, both read back, the real red cleared on both and verified green.

### F3 — Station 04's F2: a consumed `-ready.md` is still armed on `origin/main`

Handed over by Station 04's 14:10Z breadcrumb, finding F2, and re-verified here rather than repeated
from the note (`00-supervisor.md` Q4):

| probe | result |
|---|---|
| `git status --porcelain` in the dev tree | ` D docs/pr-prompts/pr-verdictguard-spaced-path-candidates-ready.md` |
| tracked `*-ready.md` at depth 1 on `origin/main` | that same path, still present |
| armed `*-ready.md` on disk | **0** |
| `.arming-log.txt` | `2026-09-24T13:35:34Z ARMED pr-verdictguard-spaced-path-candidates escalates=true actor=station-00` |
| where it went | `docs/pr-prompts/processed/` — **gitignored**, so nothing will ever commit the removal |
| did the work run? | **yes** — PR **#2167**, open, on `fix/verdict-guard-spaced-path-candidates` |

04's option **(A)** is the complete-and-additive one and its immediate half is executed here: this PR
commits the removal, restoring the invariant that `origin/main` carries no armed prompt, and clearing
the ` D` that would otherwise refuse the next `git merge --ff-only` while `--numstat` and `--cached`
both read the documented PASS.

**ACTIONED (immediate half) / DEFERRED (future half).** The future half of (A) — *stop committing
`*-ready.md` in its armed state* — is a change to the arming step itself, not to this board, and it
must land as its own reviewed change rather than be improvised inside a collect PR. It becomes urgent
the next time an arm is committed to `main`, which is every arming run.

### F4 — Station 04's F1: a THIRD arrival shape for the `-Command` / `--jq` trap, in which `gh` is never invoked

04 measured `& powershell.exe -NoProfile -Command $str` issued from inside a `.ps1`: the quotes are
stripped and the `|` inside a jq expression is re-parsed as a **PowerShell pipeline operator**, so the
error is raised by the CALLER (`CommandNotFoundException: The term 'join' is not recognized`) and
never by `gh`. Both recorded shapes in DOCTRINE sections 9.1/9.4 attribute the failure to `gh`, so a
run greping for a `gh`-side fingerprint finds nothing and has *"the jq trap no longer reproduces"*
available — retiring a live trap.

The claim is sound and belongs in DOCTRINE. **DEFERRED**, with the reason stated rather than implied:
sections 9.1 and 9.4 both sit inside the hash-gated `CANONICAL-BLOCK: instruments v2`, so the edit
requires re-recording the block hash and shipping it consistently — which is a change of its own, not
a rider on a collect PR. It becomes urgent the moment a run reports the jq trap as non-reproducing.
04's finding is preserved verbatim in its breadcrumb, which this PR lands, so the evidence is on
`main` either way.

### F5 — Station 04's F3 (its breadcrumb reaches nobody until committed) and the rotation advance

Both are the standing hand-over: 04 may not commit to the dev tree, so its breadcrumb and its
`docs/pipeline/sweep-rotation.json` advance (`last_index=1`, `instrument-honesty` completed) sit
untracked/modified until 00 sweeps them. If the rotation advance is not committed, the next 04 run
repeats `instrument-honesty` and the rotation silently stops.

**ACTIONED** — both are in this PR.

### F6 — #2166 and #2167 are two competing implementations of the same defect, and only one of them came from this pipeline

[MEASURED] at `11c07025`. This is Station 04's lead L2, which 04 recorded as **[CANNOT MEASURE]** from
the board alone. It is measurable from the queue, and the answer is that they are duplicates:

| | #2166 | #2167 |
|---|---|---|
| head | `fix/verdict-guard-spaced-path-tokens` | `fix/verdict-guard-spaced-path-candidates` |
| created | 13:43:13Z | 13:53:01Z |
| files | `verdict-guard.mjs`, `index.mjs`, `verdict-guard.spec.mjs` | **the same three** |
| hunks | `extractPaths` x2, `validateVerdict`, `drain` x2 | `stripSuffix`, `looksLikeCommand`, `extractPaths` x2, `validateVerdict` x2, `drain` x2 |
| `.arming-log.txt` entry | **none, ever** | `13:35:34Z ARMED pr-verdictguard-spaced-path-candidates` |
| prompt artefact in `processed/` | **none** | the prompt and its `.log`, both present |
| RULE 2 prompt-log probe | **0 hits — second lane** | 1 hit, real `marco:true` |

Three independent instruments agree that **#2166 came from no prompt and no arm**. Both PRs rewrite
the same two functions and both append tests at the same anchor in the same spec file, so they are
alternative fixes for one defect, not two halves of one — they will conflict with each other, and
whichever lands second will not merge clean.

**The question of which survives is NOT mine.** Both carry `do-not-merge`, which only Marco
removes; #2167 carries a live watcher `marco:true`; and #2166 may well be Marco's own supervised-lane
work, which `DOCTRINE.md` section 10.2.1 expressly permits and which leaves no queue trace by
construction. Closing either would be guessing his intent (section 5.5) on a PR that is his. Both
have been driven green apart from the label, which is exactly what the station doc prescribes for an
escalating PR: *opened and driven green but NOT auto-merged — left for Marco.*

**ESCALATED** — the question and its options are in `## FOR MARCO` below.

### F7 — the device-bridge git guard is INERT, exit 2

Quoted in full under WHAT I MEASURED. This is the station doc's **expected** middle outcome, not an
anomaly: the installer writes its `PATH` export into `~/.bashrc` and `~/.profile`, neither of which a
station's non-interactive non-login shell sources. The ban was remembered and kept for this whole run.

**DEFERRED** — it becomes urgent if a run ever reports exit **non-zero** (shim not written at all),
or if a station is measured running `git` against the mount. Same disposition Station 04 reached
independently four minutes earlier, which is itself a small positive control on the guard's behaviour
being stable rather than intermittent.

## FOR MARCO

**Two open PRs fix the same verdict-guard defect, and I cannot choose between them.**

- **#2167** `fix(pr-watcher): rescue bare paths under spaced top-level directories
  (SPACED_PATH_CANDIDATES_V1)` — built by the watcher from the prompt this station armed at
  13:35:34Z. The larger change: it also touches `stripSuffix` and `looksLikeCommand`. Now **green
  except the label**, e2e included.
- **#2166** `fix(pr-watcher): recover paths whose top-level dir contains a space` — no prompt, no
  arm, no watcher log. Second lane. The smaller change. Green except the label and an e2e re-run in
  flight.

**RULE 1 — complete-and-additive FIRST:**

1. **Release #2167 (remove its `do-not-merge`), close #2166 as superseded.** Solves it immediately
   and for the future: the surviving fix is the one with a prompt, an arm and an audit trail, so the
   pipeline's own record explains why the code on `main` looks the way it does. Damages no data entry
   — #2166's diff is preserved on its branch and in the PR. **Both halves of RULE 1 pass.** This is
   only right if #2167's superset genuinely covers #2166's case; I have not diffed them line-by-line
   against a shared test corpus, and say so rather than imply I have.
2. **Release #2166, close #2167 as superseded.** Fails the "future" half: it lands a fix with no
   prompt, no arm and no queue trace, so the next reader of `main` has nothing explaining it, and the
   prompt that produced #2167 stays spent in `processed/` describing work that never landed.
3. **Release both, in order.** Fails the immediate half: they rewrite the same two functions, so the
   second will conflict and needs a manual resolution before it can merge.

Either way, **only you can remove the labels** — CP-26 reads `[LABEL_PRESENT]` on all five open PRs,
so the board cannot move at all until you do. That is the single most important thing blocking
progress right now, and it is not a defect: it is the design working. Five PRs are queued on it
(#2148, #2158, #2164, #2166, #2167), the oldest since 02:56Z.

## WHAT I DID NOT DO

- **Merged nothing.** All five open PRs carry `do-not-merge` and four carry a live watcher
  `marco:true`; the fifth is second-lane code outside `tests|docs` and outside 00's `docs/` lane. The
  merge lane was genuinely empty — this is not a run that found nothing to merge, it is a board where
  merging is Marco's alone.
- **Armed nothing.** `0` armed prompts on disk and `0` after this run. No `-HOLD.md` had its gates
  newly cleared by anything that merged this cycle, and arming a prompt whose work is already open as
  #2166/#2167 is the 10.6 duplicate this pipeline records. `.arming-log.txt` is therefore unchanged
  and is not in this PR.
- **Did not close or relabel either duplicate PR**, for the reason in F6.
- **Did not touch `scripts/pipeline/title-scope-baseline.json`** — the gate forbids it by name and it
  would have been a mask (F2).
- **Did not edit DOCTRINE section 9** for 04's F1, for the canonical-block reason in F4.
- **Did not prune the two orphaned worktrees.** `C:/po-worktrees/sup-cwd-paths` (404 min) holds **2
  dirty files** and `git worktree remove` would refuse while `--force` would discard them;
  `C:/po-wt/fv2drop` (344 min) is clean but belongs to open PR #2158's branch
  (`wt-fv2-formrule-contract-drop`) and tearing it down mid-PR is not mine. Worktrees are Station
  03's lane and 03 runs at 23:02Z.
- **Did not restart the watcher.** It is alive (pid 42212) with a wrapper and an empty queue, which
  the station doc records as CORRECT, not wedged. `restart-watcher-if-wedged.ps1 -Fix` was not run and
  had no verdict authorising it.
- **Did not clear any `needs-marco/` `[STALE]` row.** The sweep's section 5 tagged only
  `agent-authored-rule-2-clearance-2026-09-04.md`, and it tags it as citing merged PRs **as evidence,
  not as its premise** — the sweep's own line says it *"does not clear the escalation"*. Discharging
  it on the tag alone is the error the station doc's COLLECT section records; its premise is a general
  claim, not PR-scoped, so it survives those merges and stays.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.** Ran no `az`, no `Connect-MgGraph`, no
  production data read or written. Station 05 was running concurrently (fired 14:22:54Z) and `/sot/`
  is its lane exclusively; nothing in this PR is under `sot/`.
- **Did not commit to `main`** in either tree, and ran no `git` mutation in
  `C:\po-watcher\ProjectOperations`. All work here is in a disposable worktree cut from `origin/main`.
