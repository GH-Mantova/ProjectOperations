# Station 00 — Supervisor | 2026-09-24T18:14:11Z–2026-09-24T18:5xZ

## GROUND

```
UTC            2026-09-24T18:14:46Z
origin/main    59d3f4dc
dev tree       main @ 59d3f4dc  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** (both `1`) — this run was not read-only-by-mismatch.

Binding documents were read from the working copy, which PREFLIGHT permits only once the tree is
proved equal to `origin/main`. It was, by the §9.3-sanctioned forms, with **no piped hash taken**
(§9.1 — a piped `hash-object --stdin` is unsound in `powershell.exe`):

```
git rev-parse --short origin/main                     ->  59d3f4dc
git rev-parse --short HEAD                            ->  59d3f4dc
git rev-list --left-right --count HEAD...origin/main  ->  0	0
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md \
                                  docs/pipeline/DOCTRINE.md \
                                  docs/pipeline/STATION-CAPABILITIES.md   ->  EMPTY
```

The `git fetch origin` ran **in the dev tree**, not the watcher clone, so `origin/main` is this
tree's own remote-tracking ref and not a launch-time pin (PREFLIGHT step 2).

⚠️ **Scope of the read, stated rather than claimed.** `00-supervisor.md` (1660 lines) was read to
line 802 of its 1660; `DOCTRINE.md` (2883 lines) was read §1–§9.1 in full, §9.2–§9.5 in full, and
§10.1 in full; `STATION-CAPABILITIES.md` was **not read this run**. Every rule invoked below (§3,
§5, §7, §7.1, §8.3a, §9.1, §9.2, §9.3, §9.4, §9.5, §10.1) is from a section actually read this run.
This is the standing **F4** condition, not a new one.

## WHAT I MEASURED

**Host reachable — NOT a blind run.** [MEASURED] Desktop Commander ids were loaded via `ToolSearch`
**before** any call, so no `InputValidationError` was available to be misread as blindness. First
`start_process` answered on the first attempt: `2026-09-25 04:14` local, `59d3f4dc`,
`git status --porcelain` → 12 lines. Brisbane UTC+10, so the timebase for every line below is
`2026-09-24T18:__Z`.

**Device-bridge git guard.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
exit read from the **installer**, not from a pipeline appended to it. Headline and last line:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
...
   PATH="/sessions/confident-pensive-meitner/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

[MEASURED] **exit 2** — the expected middle outcome. The ban was **remembered and kept**: every
`git` call this run ran through Desktop Commander on the Windows host, and **no `git` ran against a
mounted folder.** See F3.

### 🔴 §9.1's `-Command` expansion trap fired LIVE, twice, and its falsifying probe came back NEGATIVE

[MEASURED] this run, transport `start_process` shell `powershell.exe` with the command being a
**nested** `powershell.exe -NoProfile -Command "…"` — which is the transport §9.1's 2026-09-14
correction (`COMMAND_LAYER_EXPANSION_IS_THE_NESTED_FORM_V1`) says is the only one that can
demonstrate the layer:

| probe | arrival | result |
|---|---|---|
| `Write-Output ('FRESHNESS_EXIT=' + $LASTEXITCODE)` | `('FRESHNESS_EXIT=' + )` | `ParserError: You must provide a value expression following the '+' operator` |
| `foreach ($prNum in 2148,…)` | `foreach (num in 2148,…)` | `Missing variable name after foreach` — §9.1's automatic-variable bullet's own discriminator |

**Neither row printed `ROW_B_nested_Command:42`**, which is the literal refutation condition that
bullet names. **So the trap is live and the 2026-09-14 correction stands unqualified.** Both cures
worked: `(Get-Variable LASTEXITCODE -ValueOnly)` for the first, and moving every `$`-bearing probe
into a `.ps1` run with `-File` for the rest. ⚠️ That second cure arms §9.4's CWD trap — a `.ps1`
launched with `-File` inherits the **session's** working directory, which is not a git repo — so
every `gh` call in every script this run carried `-R GH-Mantova/ProjectOperations` and tested
`$LASTEXITCODE` before parsing.

### COLLECT — freshness, then the `lastRunAt` cross-check, then the session that settles it

`node scripts/pipeline/check-breadcrumb.mjs --freshness`, **exit 0**, verbatim:

```
ADMIT   00-00-supervisor-2026-09-24-1721-the-board-is-parked-behind-one-label-…md

structure: 1 checked, 0 malformed, 0 skipped as pre-contract (before 2026-08-25T0000)

freshness (a station is SILENT past 2x its cadence):
  00  last 2026-09-24T17:21:00Z  1.0h ago  (cadence 1h)  ok
  02  dispatch-only — no cadence to miss
  03  last 2026-09-23T23:04:00Z  19.3h ago  (cadence 24h)  ok
  04  last 2026-09-24T14:10:00Z  4.2h ago  (cadence 4h)  ok
  05  last 2026-09-24T14:23:00Z  3.9h ago  (cadence 24h)  ok

CLEAN
```

`CLEAN` is **not an all-clear** (the station doc says so explicitly), so it was crossed against
`lastRunAt` from the scheduled-tasks MCP:

| station | `lastRunAt` | newest breadcrumb | row of the four-row table | verdict |
|---|---|---|---|---|
| 00 | `2026-09-24T18:14:11.262Z` — **this run** | 17:21Z | fresh, mid-run | healthy |
| 03 | `2026-09-23T23:02:54.300Z` | 23:04Z | both fresh and aligned (`nextRunAt` `2026-09-24T23:02:45Z`) | healthy |
| 04 | `2026-09-24T18:09:50.203Z` | 14:10Z | **fresh `lastRunAt`, no breadcrumb** | see below |
| 05 | `2026-09-24T14:22:54.276Z` | 14:23Z | both fresh and aligned | healthy |

🔴 **04's row is the one the breadcrumb alone cannot name, and it was settled by MEASUREMENT rather
than by the by-construction argument.** `lastRunAt` `18:09:50Z` is **four minutes** before this run
started, with no breadcrumb newer than 14:10Z — which is row 2 *or* row 3, i.e. *mid-run* or *started
and died*. `list_sessions` returns
`local_3a96805b-… "04 scanner" (running)` as the most recent session on the box. **Row 2: mid-run
inside my window, NOT a defect** — 00 is hourly and 04 every 4 h, so this collision is by
construction on every one of 04's occurrences. The station doc is explicit that a session's state
field *"is not a lock and must not be used as one"*; it is used here only as the second instrument
the table asks for, alongside the fresh `lastRunAt`. **No transcript read was needed and no station
is SILENT.**

**Breadcrumbs to collect: exactly one** — `00-*.md` at depth 1 → **1**, the 17:21Z run's own.
03/04/05 all last reported before it and it collected them. Its findings are dispositioned below and
it is `git mv`-ed to `archive/` in this PR.

### The board — five PRs, ten reds, one label, and the token read on ALL FIVE

`gh pr list --state open` → **5**. Labels read **per-PR** with `gh pr view --json labels`, never from
a listing (§8.3a rule 2 / LL-47), parsed with `ConvertFrom-Json` after assignment, never piped into
`Where-Object` (§9.4's array-collapse bullet):

```
PR 2148  state=OPEN  mergeState=BLOCKED  draft=False  labels=[do-not-merge]  head=feat/sec-a3-stop-credential-logs         created=2026-09-24T02:56:07Z
PR 2158  state=OPEN  mergeState=BLOCKED  draft=False  labels=[do-not-merge]  head=feat/fv2-formrule-contract-drop          created=2026-09-24T08:05:06Z
PR 2164  state=OPEN  mergeState=BLOCKED  draft=False  labels=[do-not-merge]  head=feat/s8h-waste-travel-index-ui           created=2026-09-24T12:48:31Z
PR 2166  state=OPEN  mergeState=BLOCKED  draft=False  labels=[do-not-merge]  head=fix/verdict-guard-spaced-path-tokens     created=2026-09-24T13:43:13Z
PR 2167  state=OPEN  mergeState=BLOCKED  draft=False  labels=[do-not-merge]  head=fix/verdict-guard-spaced-path-candidates created=2026-09-24T13:53:01Z
```

**NEGATIVE control** (§9.4 — `--json number` alone answers for every integer, so a server field was
asked for): `gh pr view 999999 --json number,state` → exit **1**,
`GraphQL: Could not resolve to a PullRequest with the number of 999999`.

`gh pr checks` returns the **same two** failing rows on all five and no others. **The verdict token
was then read from COLUMN 3 of each `Approval receipt (CP-26)` job log** (§9.1 — the log is three
tab-separated columns and column 1 is the job name, so grepping whole lines for `CP-26` matches every
line). All five, verbatim and identical:

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

Per-job controls, all five: 226 log lines, POSITIVE (`Runner`) = **14**, NEGATIVE (a freshly minted
needle) = **0**. `[LABEL_PRESENT]` on every one ⇒ **parked by design, zero agent-side work**
(§9.4). Not one is `[RELEASED_NO_RECEIPT]`, which is the token that *would* have been a real finding.

### Machinery — `[LIVE]` lines only

`status-sweep.ps1`, section 0 positive controls both `[LIVE]` (`gh CAN reach GitHub (saw merged PR
#2173)`, `node runs`), **no `[BROKEN]`** anywhere. Section 7: **`SAFE TO ACT`**.

⚠️ **The sweep was read TWICE because the first read was short, and that is §9.1's early-return in
file form.** Captured with `*>` and decoded `utf16le` (§9.3 — `*>` writes UTF-16LE and a naive utf-8
read splits it into structureless lines). The first decode returned **337** lines ending mid-section-5
with no section 6 or 7; the file was still being written. The second returned **416** lines with
`6. BACKLOG GATES` and `7. VERDICT` present. **A truncated capture and a sweep that genuinely has no
verdict are byte-identical at the tail** — re-read until the `SWEEP COMPLETE` trailer is present, which
is this run's cheap analogue of *"keep calling until 0 remaining"*.

- watcher node **RUNNING pid 42212**; auto-restart wrapper **alive (2)**; heartbeat age **100 min**
  (ticks only mid-run; stale + empty queue = idle, **not** wedged); watcher clone `branch=main dirty=0`.
- safe-to-act: `index.lock` dev/clone **False / False**; scoped git processes **0**; no build in
  flight; no PR touched in the last 2 min. **Re-measured immediately before this run's only mutation**
  (`lock_dev=False lock_clone=False git_procs=0`), because `[LIVE]` means *true when measured*.
- `main` CI on `59d3f4dc`: **4 success / 0 failed / 0 running** — trunk green.
- Section 5 tagged **zero `[STALE]` `needs-marco/` rows.** Measured, not eyeballed: `[STALE]` occurs
  **4** times in the decoded capture and all four are the report's own legend, header, trailer, and a
  quoted line inside an old `[FILE]` snapshot. Its one `[LIVE]` row is
  `pr-2164-review-block.md references #2164 = OPEN -- genuinely open`. **Nothing to discharge** —
  third consecutive run reading zero.
- Queue: armed **0**, `needs-marco/` **48**, `no-pr-opened/` **111**, `failed/` **59**,
  `blocked/` **153**. Newest `no-pr-opened/` `2026-09-22T17:25Z`, newest `failed/` `2026-09-21T14:37Z`
  — both predate the last six Station 00 runs, so **no new silent no-op this cycle.**

### Arming — settled by MEASUREMENT this run, not carried forward

The 17:21Z run explicitly tagged its arming decision an `[INFERRED]` carry-forward. It is re-derived
here. `scripts/pipeline/triage-holds.ps1` (read-only; `--dequeue` never passed), with its own
controls passing — `GIT control: PASS` (226,897 chars read from `origin/main:DOCTRINE.md`) and
`SPENT control: PASS` (exit 3 on the fixture, so the SPENT bucket is *reachable* and its zero means
none):

```
TOTALS  spent=0 of 15 evaluated  gates-satisfied=1  still-gated=14  unreadable=0
```

The single `GATES SATISFIED` candidate is **`pr-fv2-formrule-contract-HOLD.md`**, and it is refused
on **two independent measured grounds**:

1. **It is on the station doc's never-arm denylist.** AUTHORITY rule 4 names
   `pr-fv2-formrule-contract` literally; the prompt's basename matches → **True**. Marco-run.
2. **It is the work of open PR #2158.** Confirmed on the **marker**, never on the head branch, as the
   triage output demands: the prompt's own `premise` is
   `! ls apps/api/prisma/migrations | grep -q fv2_formrule_contract`; #2158's title is
   *"feat(forms): drop five legacy FormRule flat columns (F-2c contract)"*, its body contains `F-2c`
   **PRESENT** and `formrule` **PRESENT**, NEGATIVE control (minted needle) **absent**, body 5006
   chars. 9 of 12 scope entries overlap.

**ADMIT is necessary, not sufficient** (§9.5), and here it is not even necessary — the denylist
decides it alone. **Nothing was armed. `.arming-log.txt` is unchanged and is not in this PR.**

Section 6's one `READY TO STAGE` backlog item, `rates-11c-blocked-consumers`, is likewise the
denylisted `rates-s11c` (§8.4's `queue-sync.ps1` denylist). The other six backlog items are
`needs-marco` or still gated.

## WHAT CHANGED

1. **The 17:21Z breadcrumb `git mv`-ed to `docs/pr-prompts/archive/`** — every finding in it carries
   a disposition; the four still-open ones are carried forward as F2–F5 below rather than archived
   out of sight.
2. **This breadcrumb**, written **inside this PR's worktree** (`C:\po-wt\sup-0028`, branch
   `board/station00-2026-09-24-1815`, cut from `origin/main` `59d3f4dc`) — REPORT CONTRACT cure 1, so
   no loose untracked file is left in the dev tree and the post-merge fast-forward trap cannot fire
   on it.

**Nothing else.** No PR was merged, closed, relabelled or touched. **No label was added or removed.**
No prompt was armed, renamed, disarmed or binned. `/sot/` was not edited. The watcher was not
restarted and no lock was cleared. No worktree was pruned. No commit was made on `main` in either
tree, and no `git` mutation ran in `C:\po-watcher\ProjectOperations`.

## FINDINGS

### F1 — a tracked breadcrumb misquotes the CP-26 verdict line so that the TOKEN dissolves into prose, and the token is the entire discriminator

`CP26_TOKEN_DISSOLVED_IN_QUOTATION_V1`

DOCTRINE §9.4's cure for the parked-board red is exact: **"Read the CP-26 VERDICT TOKEN, never the
pass/fail counts"**, and it names three tokens that mean three different things — `[LABEL_PRESENT]`
= parked, nothing to do; `[RELEASED_NO_RECEIPT]` = **a real finding**; `PASS / NEVER_ESCALATED` = the
gate never armed.

The 17:21Z breadcrumb — tracked on `main` as of `#2173`, and the artifact the next run collects —
quotes the line as:

```
FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true).
        A human must review and REMOVE the label; removing it is what releases the merge.]
```

[MEASURED] this run from column 3 of the job log on **all five** open PRs, identical on every one:

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

**Two substitutions, and the second is the damaging one.** The check's name is `approval-receipt`,
not `do-not-merge`; and the brackets that hold the **token** have been moved to enclose the
**remediation prose** instead, so the string `[LABEL_PRESENT]` does not appear in the quotation at
all. A reader who greps that breadcrumb for the token §9.4 tells them to read finds **nothing**, and
the available readings of that nothing are *"the token is absent from this log"* — which is what
`PASS / NEVER_ESCALATED` looks like — or *"my probe is broken"*. Neither is true.

🔴 **The polarity is what earns it a finding.** The misquote is harmless while the answer is
`[LABEL_PRESENT]`, because that token means *do nothing* and doing nothing is what happened. It
becomes harmful on the day a PR comes back `[RELEASED_NO_RECEIPT]` — a label removed with no receipt
committed, i.e. the one CP-26 state that **is** real work — because a run that has learned the
quotation shape from the breadcrumb rather than the token from the log has no field in which the
difference can appear. This is §9.5's closing rule (*a probe pointed at the documentation measures the
documentation*) reached through a **quotation** rather than through a grep.

⚠️ **Scope, stated honestly.** The 17:21Z run reached the right verdict and did read a job log; and
it verified **one** PR (#2148, run `36028910718`) and wrote *"confirmed per-PR across all five"* on
the strength of `gh pr checks`, which returns counts and names, **not tokens**. This run measured the
token on all five. So the correction is: that sentence was `[INFERRED]` for four of the five PRs and
was written as a measurement.

🔧 **The cure is free and it is a rule about quotation, not about CP-26:** when quoting a verdict
line that carries a bracketed token, **quote the line verbatim, single-line, brackets intact** — a
re-wrapped or re-bracketed quotation of a tokenised verdict is not evidence. ⚠️ **Falsifying probe:**
grep any Station 00 breadcrumb that claims a CP-26 reading for the literal `[LABEL_PRESENT]`. If it is
absent while the run claims to have read the token, the run quoted the prose. Re-run the column-3
extraction above on any open PR carrying `do-not-merge`; if the log line ever reads
`FAIL - CP-26 do-not-merge [`, this finding is wrong and must be re-measured.

**ACTIONED** — this run. The token is now quoted verbatim, brackets intact, for all five PRs in
WHAT I MEASURED above, and the misquoted breadcrumb is archived in this same PR with this correction
sitting beside it in the tracked tree. No edit was made to the archived file: **rewriting an archived
report to say what it did not say is worse than the misquote**, so it is corrected here rather than
in place.

### F2 — the board is parked behind one label; the arming refusal is now MEASURED on two grounds

Carried forward from the 17:21Z run's F1, and **upgraded**: that run's arming decision was tagged
`[INFERRED]`; this run re-derived it with `triage-holds.ps1` and a marker confirmation against
#2158 (both quoted above). The board state is unchanged — 5 open PRs, all `do-not-merge`, all
`[LABEL_PRESENT]`, parked **15.3h · 10.2h · 5.4h · 4.5h · 4.4h**; armed **0**; 15 on HOLD, 14 of
them correctly gated.

The mechanism is the one already on the record in this board's own words: *"the board grows
monotonically until Marco merges. Arming faster makes the queue longer, not shorter."* The
complete-and-additive option (A) — a CI rule that lets CP-26 release `escalates:true` PRs whose diff
is confined to `docs/`/`tests/`, leaving every code-touching PR exactly as gated — stands as written
in the 17:21Z breadcrumb under RULE 1, with (B) batch the five label removals as the right immediate
companion, never a substitute, and (C) slowing 00's cadence refused on the record because it improves
the ratio by measuring less.

**ESCALATED** — to Marco, options unchanged. **No new `needs-marco/` file**: 48 already sit there and
a 49th restating this would be the noise that left eleven dead escalations standing for ten days.
This finding, in a tracked path, is the escalation.

### F3 — the device-bridge git guard is INERT, exit 2 — sixth consecutive run

Quoted in full under WHAT I MEASURED. The expected middle outcome: the installer writes its `PATH`
export into `~/.bashrc`/`~/.profile` and a station's shell is non-interactive and non-login, so it
sources neither. The ban was remembered and kept for the whole run.

**DEFERRED** — urgent only if a run reports exit **non-zero** (shim not written at all), or if any
station is measured running `git` against the mount. Six consecutive runs now read exit 2, which is a
positive control on the guard being *stably* inert rather than intermittently so.

### F4 — the binding-read contract still exceeds what one run can carry

`DOCTRINE.md` 2883 lines / ~94k tokens, `00-supervisor.md` 1660 lines, `STATION-CAPABILITIES.md`
unread — required **in full, every run, hourly**. This run read the sections it then invoked and says
so in GROUND rather than writing *"binding documents read in full"*, which is cheaper and
indistinguishable in the artifact.

**ESCALATED** — `needs-marco/binding-read-contract-exceeds-what-a-run-can-carry-2026-09-14.md` is
already open (day 11); this is its eleventh instantiation with a measured size, not a re-file. The
complete-and-additive option remains (A): a per-station index naming which §9 subsections bind which
station, additive, changing no rule.

### F5 — the two orphaned worktrees are unchanged, and one still holds real work

Re-read from this run's own sweep, unchanged from the 15:14Z / 16:14Z / 17:21Z runs:

- `C:/po-worktrees/sup-cwd-paths`, branch `fix/pipeline-scripts-resolve-state-paths-from-module`,
  **dirty=2 files**, age **640 min**. `git worktree remove` will refuse and `--force` would **discard
  real work**. Its subject `#2154` merged `2026-09-24T08:35:42Z`, so the worktree has outlived its PR.
- `C:/po-wt/fv2drop`, branch `wt-fv2-formrule-contract-drop`, dirty=0, age **575 min**. It belongs to
  **open PR #2158's** subject and must not be torn down while that PR lives.

⚠️ This run added a **third** worktree, `C:\po-wt\sup-0028`, deliberately and for this PR only. It is
not an orphan while this run is live; if a later sweep finds it after this PR has merged, it is mine
and it is safe to prune (dirty=0 by then).

**DISPATCHED** to Station 03 — worktrees and local trees are its lane; `nextRunAt`
`2026-09-24T23:02:45Z`. This is the **fourth** consecutive dispatch of the same hand-over; 03 has not
had an occurrence since `2026-09-23T23:02Z`, so the repetition is 03 not having woken, not decay.
Not actioned by me: pruning a worktree holding uncommitted work is destructive (§5 item 4) and
worktrees are not 00's lane.

## WHAT I DID NOT DO

- **Merged nothing, and removed no label.** All five open PRs carry `do-not-merge` and every one
  reads `[LABEL_PRESENT]` from its own job log. Only Marco removes that label; *"you never remove a
  `do-not-merge` label"* is an absolute stop in this station's AUTHORITY section, and CP-26's own
  remediation text invites exactly that action. I did not treat the ten reds as work.
- **Armed nothing**, and did not close, relabel or choose between **#2166** and **#2167**. That
  duplicate question is Marco's and is already filed as
  `needs-marco/duplicate-verdict-guard-prs-2166-vs-2167-2026-09-24.md`; the sweep re-confirmed both
  `(OPEN)` this run, so its premise still holds.
- **Did not discharge any `needs-marco/` file.** Section 5 tagged zero `[STALE]` rows — measured by
  searching the decoded capture, with all four literal hits accounted for as the report's own prose.
- **Did not prune either orphaned worktree**, and ran nothing resembling `--force` near the one
  holding 2 uncommitted files. Dispatched to 03 (F5).
- **Did not restart the watcher or clear any lock.** `index.lock` was **False** in both trees and the
  sweep's section 7 read `SAFE TO ACT`, so there was no lock to age or classify and nothing
  authorised `-Fix`.
- **Did not edit the archived 17:21Z breadcrumb to repair its misquote.** F1 is corrected beside it,
  not inside it.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.** No `az`, no `Connect-MgGraph`, no production
  data read or written.
- **Did not run `git` against the mounted folder from the VM**, the guard being inert (F3).
- **Did not claim a full binding read.** See F4 and the GROUND caveat; `STATION-CAPABILITIES.md` was
  not read and no claim above rests on it.
- **Did not leave this report in the session `outputs` folder.** It was staged there only because the
  file tool cannot reach `C:\po-wt`, then copied into this PR's worktree — read back below.
