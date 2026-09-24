# Station 00 — Supervisor | 2026-09-24T16:14:10Z–2026-09-24T16:50Z

## GROUND

```
UTC            2026-09-24T16:14:10Z
origin/main    65e5d1bc
dev tree       main @ 65e5d1bc  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** (both `1`) — this run was not read-only-by-mismatch.

Binding documents read **in full**: `docs/pipeline/stations/00-supervisor.md` (1659 lines),
`docs/pipeline/DOCTRINE.md` (2842 lines), `docs/pipeline/STATION-CAPABILITIES.md` (593 lines).
Read from the working copy, which PREFLIGHT permits only once the tree is proved equal to
`origin/main` — and it was, by the §9.3-sanctioned forms, with **no piped hash** taken:

```
git rev-list --left-right --count HEAD...origin/main  ->  0	0
git diff --numstat                                    ->  EMPTY
git diff --cached --name-status                       ->  EMPTY
git status --porcelain --untracked-files=no           ->  EMPTY
```

All four, not the first three — the fourth is the only one that catches the dirty-tree shape this
station has recorded three times. So the §9.2 behind-HEAD caveat does not apply to any `git status`
reading below.

## WHAT I MEASURED

**Host reachable — NOT a blind run.** [MEASURED] Desktop Commander ids were loaded via `ToolSearch`
**before** any call, so no `InputValidationError` was available to be misread as blindness.
`start_process` shell `powershell.exe` then returned on the first call: `main`,
`65e5d1bc 2026-09-24 15:34:15 +0000`, `Get-Date` → `2026-09-25 02:14` local (Brisbane, UTC+10 —
= `2026-09-24T16:14Z`, which is the timebase every line below is written in).

**Device-bridge git guard.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
exit read from the **installer** and not from a pipeline appended to it. Headline and last line,
verbatim:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
...
   PATH="/sessions/loving-festive-feynman/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

[MEASURED] **exit 2** — the station doc's expected middle outcome for a non-interactive non-login
shell. The ban was therefore **remembered, not mechanical**, and it was kept: every `git` call below
ran through Desktop Commander on the Windows host, and no `git` ran against a mounted folder. See F5.

### COLLECT — freshness, then the `lastRunAt` cross-check

`node scripts/pipeline/check-breadcrumb.mjs --freshness`, **exit 0**, verbatim:

```
ADMIT   00-00-supervisor-2026-09-24-1514-…-nobody-re-reads.md

structure: 1 checked, 0 malformed, 0 skipped as pre-contract (before 2026-08-25T0000)

  00  last 2026-09-24T15:14:00Z  1.1h ago  (cadence 1h)  ok
  02  dispatch-only — no cadence to miss
  03  last 2026-09-23T23:04:00Z  17.3h ago  (cadence 24h)  ok
  04  last 2026-09-24T14:10:00Z  2.2h ago  (cadence 4h)  ok
  05  last 2026-09-24T14:23:00Z  2.0h ago  (cadence 24h)  ok

CLEAN
```

Legitimate here because this run is **sighted** — `STATION-CAPABILITIES.md` §3 forbids the validator
to a blind run only, since it shells `git ls-tree` / `git ls-files` **and** `gh pr list`.

Crossed against `lastRunAt` from the scheduled-tasks MCP, per the station doc's four-row table —
because the breadcrumb is one instrument and cannot name the cause:

| station | `lastRunAt` | newest breadcrumb | row | verdict |
|---|---|---|---|---|
| 00 | `2026-09-24T16:14:10.190Z` — **this run** | 15:14Z | fresh, mid-run, its session live | healthy |
| 03 | `2026-09-23T23:02:54.300Z` | 23:04Z | both fresh and aligned (cadence 24 h; `nextRunAt` `2026-09-24T23:02:45Z`) | healthy |
| 04 | `2026-09-24T14:09:48.251Z` | 14:10Z | both fresh and aligned | healthy |
| 05 | `2026-09-24T14:22:54.276Z` | 14:23Z | both fresh and aligned | healthy |

**No station is SILENT and none needed a transcript read.** Live enabled count is **four**;
`weekly-security-audit` remains `enabled: false` (`lastRunAt 2026-09-06T21:32:44Z`), unchanged and
already open with Marco. That is what `STATION-CAPABILITIES.md` §1's 2026-09-15 correction says to
expect, so the count is confirming the rule rather than quoting this file for it.

**Breadcrumbs to collect: exactly one.** Depth-1 `00-*.md` on disk → **1**, the 15:14Z run's own,
landed by `#2171`. Both 04 (14:09Z) and 05 (14:22Z) last ran **before** that run, which collected and
archived them — so no station breadcrumb has arrived since the last collect. Every finding in the
15:14Z breadcrumb already carries a disposition; it is `git mv`-ed to `archive/` in this PR, and its
four still-open dispositions are carried forward as F3/F4/F5/F6 below rather than being archived out
of sight.

### The board — every open PR, with its lane

`gh pr list --state open --json number,mergeStateStatus` → **5**, and the count and every status are
read per-field from a `--json` payload parsed with `ConvertFrom-Json` after assignment, never from a
piped `Where-Object` (§9.4's collapse bullet):

```
#2167 BLOCKED   #2166 BLOCKED   #2164 BLOCKED   #2158 BLOCKED   #2148 BLOCKED
DIRTY_COUNT=0
```

**All five carry the `do-not-merge` label** (`escalates:true - Marco merges this, not automation`),
read from the per-PR `labels` field. Lane classification is unchanged from the 15:14Z run and was not
re-derived, because nothing on the board changed: `origin/main` is at the same `65e5d1bc` that run
left, and no PR was opened, closed or touched in the interval.

### The reds — ten of them, one cause, and it is not work

CP-26's verdict **TOKEN** read from **column 3** of the job log after splitting on the tab (§9.1's
three-column bullet), for **all five** PRs, never from the PR page (`YOUR LIMITS` item 6):

| PR | run / job | column-3 verdict |
|---|---|---|
| #2148 | `36022750062` / `107711488019` | `FAIL - CP-26 approval-receipt [LABEL_PRESENT]` |
| #2158 | `36022508601` / `107710669300` | `FAIL - CP-26 approval-receipt [LABEL_PRESENT]` |
| #2164 | `36022743336` / `107711464229` | `FAIL - CP-26 approval-receipt [LABEL_PRESENT]` |
| #2166 | `36022497620` / `107710634130` | `FAIL - CP-26 approval-receipt [LABEL_PRESENT]` |
| #2167 | `36022007353` / `107708979381` | `FAIL - CP-26 approval-receipt [LABEL_PRESENT]` |

Each job log is **226** lines; the verdict is one of them. The full text on every PR:
*"PR carries the do-not-merge label (escalates:true). A human must review and REMOVE the label;
removing it is what releases the merge."*

`[LABEL_PRESENT]` is **PARKED BY DESIGN** (§9.4), and that one cause produces **two** red rows per PR
— the required check `Approval receipt (CP-26)` plus the same check as a step inside `PR gates — diff
checks` — which is exactly the `13 pass / 2 fail` the sweep prints five times. **Ten reds, one label,
zero agent-side action.** Counting them as work is the mistake three consecutive collect runs made;
they are not counted as work here.

### Machinery — `[LIVE]` lines only, from `status-sweep.ps1`

`scripts/pipeline/status-sweep.ps1`, exit **0**, captured with `*>` and decoded **utf16le** — the
capture read back `ENC=utf16le BYTES=142964`, which is §9.3's all-streams redirection trap confirmed
in passing rather than assumed:

- watcher node **RUNNING pid 42212**; auto-restart wrapper **alive (2)**; heartbeat 87 min (ticks only
  mid-run; stale + empty queue = idle, **not** wedged); watcher clone `branch=main dirty=0`.
- safe-to-act: `index.lock` interactive/clone **False / False**; scoped git processes **0**;
  machine-wide **0**; no build in flight; **no PR touched in the last 2 min**. Verdict line:
  `SAFE TO ACT`. Re-measured immediately before this run's only mutation (`lock_dev=False`,
  `lock_clone=False`, `scoped_git_procs=0`) — because `[LIVE]` means *true when measured*.
- `main` CI on `65e5d1bc`: **4 success / 0 failed** (trunk green).
- `restart-watcher-if-wedged.ps1` was **not** run: an alive watcher with an empty queue is what the
  station doc records as CORRECT, and there was no verdict authorising `-Fix`.
- Section 5 tagged **no `[STALE]` row**. Measured rather than eyeballed: a node scan of the decoded
  capture for the literal `[STALE]` returned **4** lines, and all four are the report's own header and
  footer prose explaining the tag — **zero** `needs-marco/` rows. Nothing to discharge.
- Two non-main worktrees, unchanged from the 15:14Z run. See F6.

### The queue — nothing is armable, re-verified rather than repeated

`triage-holds.ps1`, exit 0, **both of its own controls PASS** (`GIT control: PASS — git read
origin/main:docs/pipeline/DOCTRINE.md (223526 chars)`, `SPENT control: PASS`):

```
=== queue triage  --  15 prompt(s) at depth 1: HOLD=15, ready=0, LOOPING=0
=== TOTALS  spent=0 of 15 evaluated  gates-satisfied=1  still-gated=14  unreadable=0
```

Armed `*-ready.md` counted **by me** with `Get-ChildItem`, not quoted from a note (Q3): **0**.

The single `GATES SATISFIED` candidate is `pr-fv2-formrule-contract-HOLD.md`, flagged
`POSSIBLE DUPLICATE of open PR #2158 (9 of 12)`. §10.6 says a flag is a CANDIDATE, never a verdict, so
it was confirmed — and confirmed **from the prompt logs**, not from the flag:

| probe | result |
|---|---|
| corpus `docs/pr-prompts/processed/pr-*.log` (the LIVE dev tree, never the clone decoy — §9.5) | **952** |
| logs naming `PR #2158`, matched with `indexOf` + an explicit next-character digit guard | **2**, both in `pr-fv2-formrule-contract-ready.md.log` |
| NEGATIVE control, freshly minted `PR #999412` | **0** |
| logs whose name contains `fv2-formrule-contract` | **1** — the same file |

No backslash crosses a PowerShell layer into `node` anywhere in that probe
(§9.1 `NODE_E_REGEX_BACKSLASH_DOUBLES_THROUGH_POWERSHELL_V1`, whose whole point is that a `\b`
written for `node -e` arrives doubled and answers a uniform zero).

So that prompt was **armed, consumed and built into open #2158** — its premise still ADMITs only
because §10.6's headline holds: the premise dies on MERGE, not on OPEN. It is **additionally** on the
never-arm denylist named in this station's own binding doc, alongside `pr-siteid-notnull-backfill` and
the prod-data MT prompts. Armable in neither direction. **`armed` was 0 before this run and 0 after.**

### Silent no-ops (Q5) — none are new

Newest `no-pr-opened/` entry is `2026-09-22T17:25Z`; newest `failed/` entry is `2026-09-21T14:37Z`.
Both predate the last four Station 00 runs, so **no new silent no-op appeared this cycle**. They are
not waved away as "expected" — they are simply not new, and the standing ones already carry
dispositions in earlier breadcrumbs.

## WHAT CHANGED

1. **DOCTRINE §9.4 gained the jq trap's third arrival shape** —
   `JQ_TRAP_THIRD_TRANSPORT_IS_CALLER_SIDE_V1`, Station 04's 14:10Z F1, dispatched to 00 and deferred
   twice before this run. Edited **with node**, by **concatenation** and never
   `String.replace(OLD, NEW_STRING)` (§9.3's `$`-in-replacement trap), and the **byte delta asserted**:

   ```
   BEFORE_BYTES=223526  AFTER_BYTES=226856  DELTA_BYTES=3330  EXPECTED_DELTA=3330  DELTA_MATCHES=true
   git diff --numstat  ->  41  0  docs/pipeline/DOCTRINE.md
   ```

   41 insertions, **0 deletions** — the intended change and nothing spilled. A read-back that only
   looks for what you wrote cannot see what you spilled, which is why the byte delta is quoted.
2. **The `instruments v2` canonical hash re-recorded**, deliberately and by the sanctioned route:
   `node scripts/pipeline/lint-station.mjs --write-canonical` → `WROTE` `instruments v2
   6ac6d53e81f4cef7` (was `9831c31ff3ea8fa5`). **`station-contract v5` is byte-unchanged at
   `81ddf31ac807132b`** — which is the measurement that settles F4. `git diff --numstat` on that file
   is `1 1`.
3. **Read-back, not assertion:** `lint-station.mjs` with no flags then exited **0** with
   `ADMIT` on `docs/pipeline/DOCTRINE.md` and on all **seven** station docs. The falsifying baseline
   was taken in the same minute: with the edit stashed the lint ADMITs DOCTRINE at exit 0, and with it
   applied and the hash **not** yet re-recorded the lint REJECTs with exactly one line —
   `canonical block 'instruments' has been EDITED (sha 6ac6d53e81f4cef7, expected 9831c31ff3ea8fa5)`.
   So the hash was the only failure, and the gate was seen to both fail and pass.
4. **This board PR**: the DOCTRINE change, the re-recorded hash, this breadcrumb, and the `git mv` of
   the 15:14Z breadcrumb into `archive/`.

**Nothing was armed** — `.arming-log.txt` is unchanged and is **not** in this PR. **No label was added
or removed. No PR was merged, closed or relabelled. No prompt was renamed, disarmed or binned.
`/sot/` was not edited. The watcher was not restarted and no lock was cleared.**

## FINDINGS

### F1 — the twice-deferred canonical-block fix was deferred on a reason that does not apply to the block in question: `instruments` lives in ONE file, not seven

[MEASURED] at `65e5d1bc`. The 15:14Z run's F4 deferred 04's DOCTRINE correction with this reason,
quoted verbatim: *"§9.1 and §9.4 both sit inside the hash-gated `CANONICAL-BLOCK: instruments v2`,
whose comment requires the hash to be re-recorded **and the block shipped byte-identically across all
seven station docs in one PR**."* The second conjunct is false, and it is the whole cost of the
deferral.

| probe | result |
|---|---|
| tracked `.md` under `docs/` + `.claude/` on `origin/main` carrying `CANONICAL-BLOCK: instruments` | **27**, of which exactly **one** is a governance file: `docs/pipeline/DOCTRINE.md`. The other 26 are breadcrumbs in `archive/` and one superseded prompt, i.e. documents **quoting** the block |
| the same scan for `CANONICAL-BLOCK: station-contract` | **20**, of which **7** are governance files — `docs/pipeline/stations/00`–`06` |
| what `lint-station.mjs` actually checks, read from source (anchor: `const blocks = isDoctrine ? ['instruments'] : ['station-contract']`) | `instruments` **only in DOCTRINE**; `station-contract` only in station docs |
| the block's own opening comment | *"the shared trap list. **Stations POINT here; they do not copy it.**"* |
| `station-contract` hash before and after this run's edit | `81ddf31ac807132b` → `81ddf31ac807132b`, **unchanged** |

**So the seven-doc requirement belongs to `station-contract`, and had been transplanted onto
`instruments`.** The real cost of editing `instruments` is: edit one file, run `--write-canonical`,
commit two files. That is ordinary collect-run work, not "a change of its own" — and it had been
declining for two consecutive runs on a size estimate that was wrong by a factor of seven.

🔴 **Why this is a finding and not a tidy-up.** The 15:14Z run wrote, correctly and in its own words,
*"a third deferral should carry a plan for who ships the canonical-block PR, not just the same reason
again"* — it had already spotted the accretion and could not see the cause, because the cause was a
sentence it had inherited rather than measured. DOCTRINE §9.5 records a bullet that went on asserting
a staged fix for thirteen hours after it merged and draws exactly this lesson: **a claim with no probe
outlives its truth.** A deferral reason is a claim, and until this run it had no probe.

🔧 **RULE 1 — complete-and-additive first.** Option **(A)**, applied: land 04's correction now, and
record the corpus measurement above so the next run that meets a hash-gated block knows which of the
two blocks it is holding. Immediate — the trap is in DOCTRINE this run; future — the deferral reason
cannot be re-inherited, because the table above names the probe that refutes it. Damages no data
entry. Option **(B)**, *"defer again and file an escalation asking Marco who ships it"*, fails the
immediate half outright and the future half too: it would put a question to Marco whose answer is a
`git` command a station is already authorised to run.

⚠️ **Falsifying probe: the first two rows of the table.** Scan `origin/main` for each
`CANONICAL-BLOCK: <id>` marker among the linted files. If `instruments` ever appears in a station doc,
the seven-doc reason becomes true for it and this finding is wrong.

**ACTIONED** — landed in this PR; lint exit 0 read back on all eight documents, with the REJECT
observed first so the gate is not a check nobody has seen fail.

### F2 — 04's third jq transport reproduces, and the discriminator is NOT the exception type its own write-up names

Re-verified live rather than repeated (§7.1's re-read rule: an artifact's central claim is checked
against the live system before it is acted on). [MEASURED] 2026-09-24T16:3xZ at `65e5d1bc`,
PS 5.1.26100.9444, from a `.ps1` run with `-File`, every statement followed by a literal marker so an
unrun statement could not be read as a statement that found nothing:

| row | result |
|---|---|
| the failing form — `& powershell.exe -NoProfile -Command $str` carrying a jq payload | exit **1**; the argument arrived as `--jq .labels[] \| join(",")` — quotes **gone**, `\|` re-parsed as a PowerShell pipeline operator |
| who raised it | the **child PowerShell** at `line:1`: `CommandNotFoundException: The term 'join' is not recognized` |
| `gh`-side jq fingerprint (`failed to parse jq expression` / `invalid escape sequence`) | **ABSENT** — `ROW1_HAS_GH_SIDE_JQ_ERROR=False` |
| POSITIVE control — plain single-quoted `--jq '.labels[].name'`, issued directly | exit **0**, `do-not-merge` on open `#2167` |
| NEGATIVE control — a freshly minted needle over the same output | **0** |
| **my added row** — the same `& powershell.exe -Command` with **no `gh` at all** | still mangled, but dies `ParserError: Missing expression after unary operator ','` — **not** `CommandNotFoundException` |

**04's claim is confirmed. The last row is mine and it narrows the write-up in the direction that
matters.** 04's evidence names `CommandNotFoundException` as the caller-side signature; change the
payload and the class changes. A run told to look for `CommandNotFoundException` and finding a
`ParserError` has *"the third transport does not reproduce"* available — which is the same
non-reproduction trap §9.4 already warns about for the arrival STRING, reached one level down through
the error CLASS. The landed text therefore states the fingerprint as **the absence of a `gh`-side jq
error plus an error raised by a PowerShell**, and never as a particular exception type.

⚠️ **A fourth arrival was observed incidentally this run and is NOT landed**, because one observation
is not a measurement: `gh pr list … --jq '.[] | "\(.number) \(.mergeStateStatus)"'` sent through the
direct Desktop Commander shell failed **`gh`-side** with `unknown argument "\(.mergeStateStatus)";
please quote all values that have spaces` at exit 1. That is loud, the sound `--json` +
`ConvertFrom-Json` form was used instead, and it is recorded here as a lead rather than written into
DOCTRINE. **DEFERRED to 04's next `instrument-honesty` sweep**, which is the station that builds
control pairs for this class.

**ACTIONED** — landed as `JQ_TRAP_THIRD_TRANSPORT_IS_CALLER_SIDE_V1` with both controls and the
narrowing.

### F3 — the future half of 04's consumed-`-ready.md` finding is still open, and still did not become urgent

Re-verified live at `65e5d1bc`, not repeated from the 15:14Z note (Q4):

| probe | result | reading |
|---|---|---|
| armed `*-ready.md` on disk, counted by me | **0** | the invariant holds |
| `git status --porcelain --untracked-files=no` in the dev tree | **EMPTY** | the ` D` that once refused the fast-forward is gone |
| `triage-holds.ps1` | `HOLD=15, ready=0, LOOPING=0` | agrees, from a second instrument |

The open half is option (A)'s **future** half: *stop committing `*-ready.md` in its armed state*, so a
clean tree cut from `main` can never re-arm executed work. It is a change to the arming step, not to
this board.

**DEFERRED** — it becomes urgent the next time an arm is committed to `main`, which is every arming
run. It did not become urgent this run because **nothing was armed**. ⚠️ Unlike F4-as-inherited, this
deferral now carries a size: it is a change to `arm-prompt.ps1` and the commit step, **not** a
canonical-block change, so F1's correction does not shrink it. **Falsifying probe:** tracked
`*-ready.md` at depth 1 on `origin/main`; if it is ever non-zero, the future half has bitten and is no
longer deferrable.

### F4 — the device-bridge git guard is INERT, exit 2 — fourth consecutive run

Quoted in full under WHAT I MEASURED. This is the station doc's **expected** middle outcome, not an
anomaly: the installer writes its `PATH` export into `~/.bashrc` and `~/.profile`, neither of which a
station's non-interactive non-login shell sources. The ban was remembered and kept for this whole run.

**DEFERRED** — it becomes urgent only if a run reports exit **non-zero** (the shim not written at
all), or if a station is ever measured running `git` against the mount. Four consecutive runs now read
exit 2 (04 at 14:1xZ, 00 at 14:1xZ, 00 at 15:1xZ, 00 here), which is a small positive control on the
guard being stably inert rather than intermittently so.

### F5 — the two orphaned worktrees are unchanged, and one still holds real work

Unchanged from the 15:14Z run's F6 and re-read from this run's own sweep:

- `C:/po-worktrees/sup-cwd-paths`, branch `fix/pipeline-scripts-resolve-state-paths-from-module`,
  **dirty=2 files**, age **521 min**. `git worktree remove` will refuse and `--force` would
  **discard real work**, so it must be listed (`git -C <path> status --porcelain`) and preserved or
  committed before any prune.
- `C:/po-wt/fv2drop`, branch `wt-fv2-formrule-contract-drop`, dirty=0, age 456 min. It belongs to
  **open PR #2158's** subject and must not be torn down while that PR lives.

**DISPATCHED** to Station 03 — worktrees are its lane and it fires at `2026-09-24T23:02:45Z`. This is
a **re-dispatch**: the same hand-over was made by the 15:14Z run and 03 has not run since
`2026-09-23T23:02Z`, so it has not yet had an occurrence in which to read it. Named again here so the
hand-over does not decay by being assumed delivered. ⚠️ Not escalated and not actioned by me:
pruning a worktree holding uncommitted work is destructive, and worktrees are not 00's lane.

### F6 — the one thing blocking progress is Marco's label, and everything upstream of it is healthy

[MEASURED] this run: **five of five** open PRs carry `do-not-merge`; CP-26 reads `[LABEL_PRESENT]` on
every one, verified from column 3 of all five job logs; **only Marco removes that label** (CP-26 gate
1, restated for both of 00's modes in §10.2.1). The oldest has waited since `2026-09-24T02:56Z`.

Everything upstream is healthy and was measured, not assumed: watcher alive with an empty queue,
trunk green on `65e5d1bc`, `--freshness` CLEAN with all four enabled stations aligned against
`lastRunAt`, zero DIRTY PRs, zero armed prompts, and the only gates-satisfied prompt a confirmed
duplicate of an open PR. **This is the design working, not a defect** — but it is named as the blocker
because a report that lists ten red checks without saying they are one label reads as a broken board.

**ESCALATED** — and the actionable half is **already in the queue**, filed by the 15:14Z run as
`docs/pr-prompts/needs-marco/duplicate-verdict-guard-prs-2166-vs-2167-2026-09-24.md`. Re-verified
present and live this run: `status-sweep.ps1` section 5 cross-checked it against GitHub and reports
`#2166 (OPEN)` and `#2167 (OPEN)`, so its premise — two open PRs fixing the same verdict-guard defect
— still holds. **No new escalation is filed**, because a second file asking the same question would be
noise, and the remaining four PRs need no question from me: they are green apart from the label.

## WHAT I DID NOT DO

- **Merged nothing.** All five open PRs carry `do-not-merge`, and CP-26 `[LABEL_PRESENT]` was read
  from the job log on every one. Only Marco removes that label. I did not reason past it, and I did
  not treat the ten reds as work.
- **Armed nothing.** `.arming-log.txt` is unchanged and is **not** in this PR. The only
  `GATES SATISFIED` candidate is a confirmed duplicate of open #2158 *and* on the never-arm denylist —
  measured above from the prompt logs with both controls, not assumed from the triage flag.
- **Did not close, relabel or choose between #2166 and #2167.** That question is Marco's and is
  already in `needs-marco/`. #2166 may be his own supervised-lane work, which §10.2.1 permits and
  which leaves no queue trace by construction; closing either would be guessing his intent (§5.5).
- **Did not discharge any `needs-marco/` file.** Section 5 tagged **no `[STALE]` row** — measured by
  scanning the decoded capture, not eyeballed — and every line is `[FILE]` saying on its face that it
  *"does not clear the escalation"*. Discharging on the tag alone, let alone on its absence, is the
  error the COLLECT section records.
- **Did not prune either orphaned worktree**, and ran nothing resembling `--force` near the one
  holding 2 uncommitted files. Dispatched to 03 (F5).
- **Did not restart the watcher or clear any lock.** It is alive (pid 42212) with a wrapper and an
  empty queue, which the station doc records as CORRECT, not wedged. `index.lock` was **False** in
  both trees, so there was no lock to age or classify, and `restart-watcher-if-wedged.ps1 -Fix` had no
  verdict authorising it.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.** No `az`, no `Connect-MgGraph`, no production
  data read or written.
- **Did not commit to `main`** in either tree, and ran no `git` mutation in
  `C:\po-watcher\ProjectOperations`. All work in this PR is in a disposable worktree cut from
  `origin/main` (`C:\po-wt\sup-0026`, branch `board/station00-2026-09-24-1614`), torn down at the end
  of the run.
- **Did not run `git` against the mounted folder from the VM**, the guard being inert (F4). Every
  `git` call went through Desktop Commander on the Windows host.
- **Did not land the fourth jq arrival shape** observed in F2. One observation with no control pair is
  a lead, not a finding, and DOCTRINE is the one document every station is told it can trust.
- **Did not write this report to the session `outputs` folder.** It is in this PR's worktree — the
  REPORT CONTRACT's preferred home — so no loose untracked copy is left in the dev tree and the
  post-merge fast-forward trap cannot fire on it.
- **Spent needles, recorded so the next run does not reuse them:** `PR #999412` and
  `zzQq00Needle20260924T1630`. Both returned 0 this run and are now in a tracked file, which spends
  them permanently (§9.6).
