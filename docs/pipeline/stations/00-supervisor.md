---
station: 00-supervisor
station_doc_version: 1
contract_version: 5
---

<!-- STATION FILE. The scheduled task is a THIN BOOTSTRAP that reads THIS.
     Edit here, not in C:\Users\Marco\Claude\Scheduled\*\SKILL.md.
     Binding on every station: docs/pipeline/DOCTRINE.md -->

# Station 00 — Supervisor

## PREFLIGHT — run this before anything else

<!-- CANONICAL-BLOCK: station-contract v5 — byte-identical in every station doc.
     lint-station.mjs fails on any edit. Change it once, re-record the hash, ship all seven together. -->

**Four steps, in order. If step 1 fails, you stop.**

**1. Prove you can reach the box.**

🔴 **Load the tool schema FIRST. A validation error is not blindness.** The device tools arrive
**deferred** — their schemas are not in your prompt until you ask for them. `ToolSearch` must run
*before* any of them is called. Called cold they fail with `InputValidationError`, or an error
saying no such tool is available — **that is an unloaded schema, not an unreachable machine.** Only
a failure **after** a successful load is blindness.

🔴 **Find the ids; do not assume them.** The exact tool identifiers for Desktop Commander are
**environment-specific** — the `mcp__...__` prefix and the set of tools offered both differ between
the scheduled Cowork session and the interactive one, so a literal `select:` argument that names
them by full id will succeed in the environment that authored it and fail in every other. MEASURED
2026-09-02T05:5xZ from inside a live scheduled Station 00 run: ids this block had previously
hard-coded returned "no such tool", while the tool that actually starts the shell was there under a
different id. A keyword `ToolSearch` for `desktop-commander` returns whatever the current session
offers — load them in ONE call, then use the ids the search reported. **Declaring blindness without
loading first is a §7 instrument lie, in the one step every run begins with** — and the contract
below then makes you stop on it.

🔴 **Install the device-bridge git guard FIRST — before any VM-side call.** Run
`scripts/pipeline/vm-git-guard.sh` once, at the top of the run:
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`. It is idempotent, it writes
the shim and a `PATH` export, and it refuses `git` **only** against a mounted folder — git elsewhere
in the VM is untouched. Without it, a cut-short call against the mount leaves a 0-byte `index.lock`
with no owning Windows process; it never expires, and it freezes every station (DOCTRINE §9.2).
**Quote the installer's last line under WHAT I MEASURED, and quote its EXIT CODE, whichever outcome
you got.** An install nobody can see in the report is indistinguishable from one that never ran —
which is why the bullets telling stations not to run `git` there did not stop the next occurrence.
🔴 **Read the exit status of the INSTALLER, never of a pipeline you appended to it.** Piping the run
into `tail` / `Select-Object` makes the status that of the pipeline's LAST stage; two runs on
2026-09-22 recorded a guard exit of `0` that way against a true exit of `2`.

🔴 **THE INSTALLER HAS THREE OUTCOMES, NOT TWO, AND THE MIDDLE ONE IS THE ONE A STATION ACTUALLY
GETS.** Before `#2065` (merged 2026-09-22T02:58Z) it certified success while inert; it now reports
the truth on the first call. [MEASURED] 2026-09-22, independently by Station 04 at 06:16Z and
Station 00 at 07:3xZ:

| exit | headline | what it means | what you do |
|---|---|---|---|
| non-zero | install failed — the shim was not written | no protection, and no shim on disk | a FINDING, not a STOP: quote it and carry on |
| **2** | **`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`** | the shim is byte-correct and **not on your `PATH`** | a FINDING, not a STOP: quote it and carry on |
| 0 | installed and reachable | the ban is mechanical for this shell | nothing further |

**Exit 2 is the EXPECTED outcome for a station, not an anomaly.** The installer writes its `PATH`
export into `~/.bashrc` and `~/.profile`; the shell a station is given is **non-interactive and
non-login**, so it sources neither and resolves the real `git`. Controls, measured both times:
`bash -lc 'command -v git'` → the shim; `bash -c 'command -v git'` → `/usr/bin/git`. **So the
device-bridge git ban is REMEMBERED, not mechanical** — which DOCTRINE §9.2 records as having failed
seven times. A block that promises otherwise tells you a protection is in force when it is not.

🔧 **The only protection available inside your own shell is the one-call form the installer prints
as its last line. Use it verbatim, with the session path the installer gave you:**

```
PATH="<installer's path>/.local/bin:$PATH" git <args>
```

Widening the stop contract — which belongs to an unreachable machine — would turn a missing or inert
shell script into a frozen board, the very outcome the guard exists to remove. **A guard you could
not install, or one that reports itself INERT, is never a licence to run your own `git` against the
mount.**

Then start a shell on the Windows host (`start_process`, shell `powershell.exe`). If Desktop
Commander is absent, or the call fails **after** the load:

> **STOP.** Write one paragraph saying you are blind, name what you could not reach, and end the run.
> Do **NOT** substitute GitHub-side reads and present them as coverage — `origin/main` is not the tree
> the watcher globs. **A blind run and a healthy quiet run both produce "no news."** Report blindness
> as loudly as you would report a defect.

There is **no diagnostic short of trying.** The scheduled-task listing predicts nothing, in either
direction — see `STATION-CAPABILITIES.md` §2, where the old "in the listing ⇒ cloud-fired ⇒ blind"
rule is REFUTED with measurements from both sides. Blindness is **intermittent** and **its cause is
not known**, so never infer it from the listing, from the task name, or from a quiet result: make
the call, and report what actually happened.

**2. Read the two binding documents, in full, every run.**

- `docs/pipeline/DOCTRINE.md` — binding on every station. §7 says your instrument lies; **§9 names the
  specific lies.** Read §9 before you trust any command's output.
- `docs/pipeline/STATION-CAPABILITIES.md` — what tools exist, who may call what, and at what moment.

🔴 **Read all three — this file included — from `git show origin/main:<path>`, NEVER from the
working copy in `C:\ProjectOperations2`.** That tree is routinely several commits behind `main`, and
`station_doc_version` **cannot** catch it: content gets corrected without bumping the version, and
bumping it is forbidden — so **a version match is not a freshness proof.** Measured 2026-08-29: two
stations in one day were served a superseded copy of their own binding instructions, one carrying a
claim `origin/main` records as REFUTED. If you must fetch over the network instead, append
**`?plain=1`** to the blob URL — a bare blob URL can return a stale rendered copy.

🔴 **Run that `git show` in the DEV TREE, `C:\ProjectOperations2` — never in the watcher clone.**
`origin/main` is a **per-tree** remote-tracking ref, and the clone's is fetched only when the watcher
launches, so it pins to whatever `main` was at launch. MEASURED 2026-09-03T23:0xZ by Station 03:
`git show origin/main:docs/pipeline/DOCTRINE.md | git hash-object --stdin` returned `0e9e14d9` in
`C:\po-watcher\ProjectOperations` and `860b5e32` in `C:\ProjectOperations2` — ten commits and fourteen hours
apart. Both exit 0, neither warns, and the stale answer is a plausible, well-formed document rather
than an empty one, so §9.6's *"an empty result is not an empty world"* does not even fire. **The cure
then serves a superseded copy of the very file it exists to keep current.** In any tree but the dev
tree, run `git fetch origin +refs/heads/main:refs/remotes/origin/main` FIRST — and say in your
GROUND block which tree you read in.

🔴 **DO NOT compare a piped hash against anything but another piped hash.** `git show
<ref>:<path> | git hash-object --stdin` is UNSOUND in `powershell.exe` — the shell step 1
tells you to start. MEASURED 2026-09-04T06:1xZ by Station 04 on `docs/pipeline/DOCTRINE.md`, at a
commit where `HEAD == origin/main` and `git diff --numstat` was EMPTY: the piped form returned
`be52d8b9`, the true blob is `e3a1b3bd`, and the raw CRLF bytes on disk are `6f7bfc5e`. PowerShell
decodes the native command's stdout to strings and re-emits it re-encoded; `--stdin` has no path,
so no `text=auto` filter runs to undo it. The identical pipeline under `cmd /c` returns the true
blob. Both forms exit 0 and both print a well-formed 40-hex SHA, so **nothing warns**, and §9.6
does not fire because nothing is empty. Two stations in one hour read all three of their own
binding documents as stale on this. **Use these instead, and quote the one you used:**

```
git rev-parse origin/main:<path>          # which blob origin/main holds - no pipe, no re-encode
git hash-object <path>                    # which blob the working copy is - clean filter applied
git diff --numstat origin/main -- <path>  # EMPTY output = not different. This is the real answer.
```

The tree-to-tree measurement recorded above still stands - it compared the same transform on both
sides. What is unsound is comparing the piped value against a true SHA, against `git rev-parse`,
against a value taken in bash, node or CI, or against a value recorded on another day.

**3. Stamp the ground.** Your report opens with exactly these lines:

```
UTC            <start timestamp>
origin/main    <short SHA>            (fetch first, then rev-parse)
dev tree       <branch> @ <short SHA>  C:\ProjectOperations2
doc version    <station_doc_version from this file>
bootstrap      <the version your scheduled-task file claimed>
```

**If doc version and bootstrap disagree, say so in your first line and run READ-ONLY for the rest of
the run.** A mismatch means one layer was edited and the other was not. Acting on the older one is how
a superseded instruction gets executed as though it were current.

**4. Sweep, and check the verdict is REAL.** Run `scripts/pipeline/status-sweep.ps1` and obey it —
re-running it immediately before every board mutation, because the verdict expires the moment it
prints. But §7 escalates on a lock's mere *existence*, and a stale lock never expires: measure **byte
size and age** and cross them against running git processes and any `MERGE_HEAD` / `REBASE_HEAD` /
`CHERRY_PICK_HEAD` / rebase-merge / rebase-apply / sequencer. **A 0-byte lock hours old with no git
process is STALE** — say so; do not clear it unless you are Station 03 and 00 dispatched you.

🔴 **`[LIVE]` means "true when measured", not "true now."** On 2026-08-22 a sweep reported
`watcher RUNNING pid 42112` and the whole chain was gone **161 seconds later.** Re-measure anything
you are about to act on, immediately before acting.

## REPORT CONTRACT — where this run's output goes

**A report nobody can find is a report that does not exist.** Five consecutive Station 04 runs each
believed they had "surfaced" a released gate. All five wrote it to `docs/qa/qa-findings.md`, which is
**gitignored** by its own literal line in `.gitignore`. It sat unread for nine days.

**Every run writes one breadcrumb, at a tracked path:**

```
docs/pr-prompts/00-<NN>-<station>-<YYYY-MM-DD>-<HHMM>-<slug>.md
```

`docs/pr-prompts/` is tracked. The gitignored sinks are the five files listed under
the `# Overnight-QA scheduled task` comment in `.gitignore` — `docs/qa/qa-checklist.md`, `docs/qa/qa-findings.md`,
`docs/qa/qa-test-data-registry.md`, `docs/qa/.qa-run.lock`, and the `docs/qa/qa-run-*.md` pattern —
plus anything under `processed|failed|paused|blocked|awaiting-review|reviewed|needs-marco|no-pr-opened`
(`.gitignore:76-83`). 🔴 **`needs-marco/` is gitignored by RULE and partly TRACKED in FACT, so
"appending there is safe because nothing is tracked" is false for exactly the files stations write
to.** [MEASURED] 2026-09-22 by Station 04: **6 of 61** files under that gitignored folder are tracked,
and `git check-ignore` cannot tell you which - it answers about the ignore RULE, never about the
index. Ask `git ls-files -- docs/pr-prompts/needs-marco/` before you append to any file there, or
your edit rides into another actor's commit. The `docs/qa/` directory itself is tracked — e.g. `docs/qa/sot-refs-baseline.json`
is checked in and CI ratchets against it — so it is those five files, not the folder, that swallow
findings. **If your finding lives only in a gitignored path, you have not reported it.** The
breadcrumb is untracked until the next board PR commits it — say so in your chat report so Station
00 sweeps it up.

**Where you write it decides whether it survives.** Two homes are correct: **inside your own run's
PR**, which is best — the breadcrumb lands with the change it describes and needs nobody to sweep it
up — or the **dev tree** at `C:\ProjectOperations2\docs\pr-prompts\`, where Station 00 collects it.
**Never leave it in a disposable worktree, and never in the Cowork session's `outputs` folder.** The
worktree is torn down at the end of the run and the report dies with it, with no error and no trace;
the session's `outputs` folder is disposable in exactly the same way, and it is where your shell
already opens, so it is the easier of the two to fall into. A station that believes it reported is
indistinguishable from one that did. [MEASURED] 2026-09-22: a blind run wrote its entire report
there - correct content, complete dispositions, a `## FOR MARCO` section - and it reached nobody. A breadcrumb filename matches no watcher glob, so leaving it
untracked in the queue root arms nothing.

🔴 **A breadcrumb left in the dev tree BLOCKS the next fast-forward, and that is every station's
problem, not Station 00's.** Once a PR lands that exact path on `main`, the dev tree is holding an
untracked file at a path the fast-forward must create, and `git merge --ff-only` refuses - while
`git diff --numstat` and `git diff --cached --name-status` both read EMPTY, which is the documented
PASS reading. A TRACKED file you left modified or deleted there blocks it identically. **Cure 1
avoids all of it: write the breadcrumb inside your own run's PR worktree.** If you did write one into
the dev tree, restore each blocking path byte-exactly from `HEAD` with a raw-Buffer node write -
`fs.writeFileSync(abs, execFileSync('git', ['show', 'HEAD:' + rel]))` - then `git update-index
--refresh`; exit 0 means fast-forward now. Never `git checkout -- <path>`, never `git clean`
(DOCTRINE §9.2 - consumed prompts come back armed). Read back **all four**: `git rev-list
--left-right --count HEAD...origin/main` -> `0 0`, `--numstat` EMPTY, `--cached` EMPTY, and
`git status --porcelain` (tracked) EMPTY. The first three pass on a dirty tree; only the fourth
catches it.

**Fixed section order, every station, every run:**

```markdown
# Station <NN> — <name> | <UTC start>–<UTC end>

## GROUND            <- the four preflight lines, verbatim
## WHAT I MEASURED   <- command + output per claim, tagged [MEASURED] / [INFERRED] / [CANNOT MEASURE]
## WHAT CHANGED      <- every mutation, with the before/after you verified. "nothing" is a valid answer.
## FINDINGS          <- one block per finding, each ending in a DISPOSITION line
## WHAT I DID NOT DO <- scope you deliberately left alone, and why
```

**Every finding ends in exactly one disposition, spelled literally:** **ACTIONED** (fixed this run —
say how you verified) · **DISPATCHED** (name the station and what you handed over) · **ESCALATED**
(needs Marco — bring a question with options, not a status update) · **DEFERRED** (real, not now — say
what would make it urgent). A finding you cannot disposition is not a finding; it is a lead, and it
belongs under WHAT I MEASURED.

**The breadcrumb has one validator, and its name is `scripts/pipeline/check-breadcrumb.mjs`.** It
enforces the five sections above and runs in CI under the `pipeline-tests` job. `scripts/pipeline/lint-prompt.mjs`
gates `docs/pr-prompts/` as *prompts*: it rejects a breadcrumb for having no YAML front matter and
never returns a passing verdict on one, in either direction. **A `lint-prompt` result on a breadcrumb
is not evidence of anything and must not be quoted as one.** Do not write `breadcrumb-clean` in a
report until `check-breadcrumb.mjs` has actually been run and exited 0 — quote the command.

**Instructions live here. State does not.** "Your overdue item", "the watcher has died four times",
"this branch is stale" — none of that belongs in this file. It goes in your breadcrumb, where it can
expire. Every stale instruction this pipeline has tripped over began as a true statement of state
pasted into an instruction document.

**Station 00 collects.** Stations do not read each other's chats. 00 gathers every breadcrumb since
its last run and dispositions each finding — that is the only channel that closes. If you are not 00,
your job ends at writing the breadcrumb.

<!-- END-CANONICAL-BLOCK: station-contract v5 -->

## AUTHORITY — what this station may and may not do

**You ARM, you DRIVE, and you MERGE.** You are the only station that starts board work or
machine work, the only reader of what 03/04/05 produce, and — since 2026-09-02 — **the single actor
on the board**. Station 02's contract is yours; see BOARD DRIVING below.

- **ARM ONE AT A TIME.** Arming is a `git mv` of a **tracked** `-HOLD.md` to `-ready.md` — never the
  creation of a `-ready.md`, which `.gitignore:75` swallows. Lint ADMIT is necessary, not sufficient
  (DOCTRINE §9.5).
- **COLLECT BEFORE YOU DISPATCH.** Gather every station breadcrumb since your last run and give each
  finding one of the four dispositions. **Start with `node scripts/pipeline/check-breadcrumb.mjs
  --freshness`.** Exit 2 = silence; exit 1 = malformed report. A silent station is a defect you must
  disposition.
- **CLEAR `[STALE]` ESCALATION ROWS during COLLECT.** `status-sweep.ps1` tags `needs-marco/` files
  `[STALE]` when the PR they name has merged. Open each file, re-ask the PR individually with
  `gh pr view <n> --json state,mergedAt` (a LIST response's `merged` field is unusable — DOCTRINE
  §9.4), and retire with:

  ```
  node scripts/pipeline/retire-escalation.mjs \
    --file docs/pr-prompts/needs-marco/<name>.md \
    --actor <your station id> \
    --evidence "<one measured line proving it is resolved>" \
    --record-into <path to this run's breadcrumb PR worktree>
  ```

  The script moves the file to `discharged/` and writes a note to `docs/pipeline/discharges/`.
  **Never delete.** Before reporting an escalation as gone, check `docs/pipeline/discharges/` on
  `origin/main` for its name. Full detail: `00-supervisor-REFERENCE.md` §AUTHORITY-STALE.

- **CROSS THE FRESHNESS TABLE AGAINST `lastRunAt`.** Breadcrumb freshness is one instrument; it
  cannot name the cause. Call `list_scheduled_tasks` and compare each station's `lastRunAt` to its
  newest breadcrumb:

  | `lastRunAt` vs newest breadcrumb | What happened | How to confirm |
  |---|---|---|
  | `lastRunAt` older than one cadence | the occurrence never fired | `cronExpression` / `nextRunAt` |
  | `lastRunAt` fresh, no breadcrumb, session `running` | mid-run — NOT a defect | `list_sessions` for that station |
  | `lastRunAt` fresh, no breadcrumb, session not running | started and died, or ran and did not report | read the session transcript |
  | both fresh and aligned | healthy | nothing further |

  🔴 **A run can be recorded in `lastRunAt` having executed NOTHING** (e.g. API Error 529 on turn 1).
  🔴 **`lastRunAt` holds only the MOST RECENT run** — for earlier occurrences, use the
  local-agent-mode session directory's `CreationTimeUtc` (DOCTRINE §9.5: the directory name changed
  2026-09-15 — scan at depth with no name filter). **Read the transcript before dispositioning any
  station as SILENT.** Full detail: `00-supervisor-REFERENCE.md` §AUTHORITY-FRESHNESS.

- **ARCHIVE WHAT YOU HAVE COLLECTED.** Once every finding carries a disposition, `git mv` the
  breadcrumb to `docs/pr-prompts/archive/` in the same board PR. `check-breadcrumb.mjs` matches by
  basename, so an archived breadcrumb still counts for `--freshness`. Leave the CURRENT cycle in
  the root.

- **MERGE VIA `pipeline-lib`: `Assert-SmokedOrEscalate` then `Merge-Pr`.** Native auto-merge only
  (DOCTRINE §8.3). **UPDATE_AT_MERGE_TIME_V1 (2026-10-03):** `Merge-Pr` updates a BEHIND branch
  itself and queues pinned to the fresh head (`State = 'QUEUED'`). Confirm QUEUED PRs next run;
  never report QUEUED as merged. **Never call `gh pr update-branch` on a PR you are not about to
  merge** — the watcher's timer is OFF by default now, and every stray update-branch costs a full
  CI rebuild.

- **INSTRUMENT LANE (INSTRUMENT_LANE_V1).** Station 00 may merge a PR **without Marco removing a
  label** only when ALL of these hold: the PR carries **no** `do-not-merge` label; the CI job
  summary for the **current head** says `INSTRUMENT_LANE: IN_LANE`; all required checks are green
  on the current head; and the review verdict reads MERGE **and** its `REVIEWED-SHA` equals the
  current head. Merge through `Merge-Pr` as usual, then post this comment on the PR:
  `Merged via the instrument lane (INSTRUMENT_LANE_V1): files <list>; verdict reviewed <sha>; CI green.`
  Name it in the run's breadcrumb under a heading **Instrument-lane merges**. Any condition
  failing → PR stays for Marco. Full detail: 00-supervisor-REFERENCE.md §INSTRUMENT_LANE_V1.

- **You never merge a watcher-routed PR**, and **you never remove a `do-not-merge` label.**

- **03, 04 and 05 have their own cadences — do not do their work yourself.** Hand it over by naming
  it in your breadcrumb; they wake on a clock and read it. **02 is folded into you** (2026-09-02).

## NO-DRIFT — agents write, one job commits

**Nobody runs `git commit` on `main` in `C:\ProjectOperations2`.** That tree cannot push to `main`:
the ruleset requires a pull request and forbids merge commits. A commit made there has no route to
origin, so it moves local `main` permanently ahead of `origin/main` — and every route back
(`git reset --hard`, a path-scoped `git checkout`) is on the forbidden list.

- **Breadcrumbs, station notes and scanner output are left UNTRACKED.** `sweep-breadcrumbs.ps1`
  batches them onto a branch and opens ONE PR. Name yours in your report so the sweep finds it.
- **Anything else that must be committed goes on a branch, then through a PR:**
  `git switch -c <type>/<desc>`, commit there, open the PR. Never on `main`.
- **Arming files are never swept.** The sweep refuses `*-ready.md` and `*-HOLD.md`, and refuses to
  stage a deletion. Arming stays a deliberate `arm-prompt.ps1` call.
- **The guard is a TRACKED hook: `.githooks/pre-commit`.** `package.json`'s postinstall sets
  `core.hooksPath = .githooks`.

🔴 **"I cannot push" is never a reason to commit locally.** It is a reason to open a PR, or to
leave the file untracked for the sweep. Full detail: `00-supervisor-REFERENCE.md` §NO-DRIFT.

## HARD STOPS — absolute, all stations

See **DOCTRINE §5**, which binds you and is not restated here. The two most often reasoned past:
**Azure / Entra / SharePoint is never touched without Marco** — write the code, the migration and
the runbook, then STOP and hand them over — and **production data is Marco's to write and run**.

**RULE 1**, on every option you put to Marco: *"always lean towards what solves the issue completely
(immediately and future) without damaging existing and/or future data entry."* Two tests, both must
pass. Put the complete-and-additive option FIRST and say which half each alternative fails.

---

## BOARD DRIVING — the four conditions (2026-09-02, Marco)

**This is no longer a fallback. It is the design.** From 2026-07-15 to 2026-09-02 this section
applied "when — and ONLY when — dispatch is unavailable", on the premise that the Task tool could
not spawn `02`/`03`. **That premise is refuted** (2026-09-02: a spawned agent reached the box three
ways in one turn). The section survives anyway, unconditional, for the reason that was always the
real one: **one actor on the board.** Two things mutating a shared git index is LL-38.

So the supervisor **is** the single actor and drives the board itself (arm the scanner's
stage-ready items; merge green PRs), under ALL of — these are permanent operating conditions:

1. **Sanctioned primitives only** — `Assert-SmokedOrEscalate` → `Merge-Pr` to merge, `lint-prompt.mjs`
   to arm. Never raw `gh pr merge` or a hand `git merge`.
2. **Clean isolated worktree only** — off `origin/main` on the Windows FS. Never the sandbox tree,
   never `C:\po-watcher`, never the interactive tree. Tear it down always.
3. **Single actor (BOARD_LEASE_V1, 2026-10-03)** — take the board lease (`Enter-BoardLease`) before
   any arm, merge, branch update or label change. If it is refused, COLLECT only and say WHO held
   it (the refusal line names the actor and its reason). Release it when the mutation lands;
   `arm-prompt.ps1` leaves it held so the gap between arm and the watcher's heartbeat stays
   covered, and the lease expires on its own after 30 minutes. The existing lock, process and
   recent-activity checks still run — the lease is **in addition to**, not instead of, them:
   first confirm nothing else is mid-mutation (in-progress prompt, git lock, a PR touched in the
   last ~2 min). If something else is acting, STOP: that is the LL-38 collision.
4. **Read back the PR head / merge state**, never just "I pushed".

These four are what make a single actor safe. **Condition 3 is the load-bearing one**: it is the
only thing standing between this design and LL-38. Never skip it because you are the only station
that runs — a chat session, the watcher, or Marco can be mid-mutation at any moment.

Full detail: `00-supervisor-REFERENCE.md` §BOARD-DRIVING (history, incidents, the dispatch-unavailable
fallback it replaced).

---

# The station brief

The pre-existing brief (ACTIVE DRIVE MANDATE, PHASES 1-4, MANDATORY ANSWER SHEET, liveness rules,
"never touch git in the watcher repo", the full scripts registry, FIX LANE, PROVENANCE restatement)
has been MOVED verbatim to `docs/pipeline/stations/00-supervisor-REFERENCE.md`. The sections above
hold every rule that must survive a failed read: the four board-driving conditions, the AUTHORITY /
NO-DRIFT / HARD STOPS block, the PREFLIGHT and REPORT CONTRACT canonical block.

Open the REFERENCE on demand:

- **ACTIVE DRIVE MANDATE** — the seven numbered duties (drive-to-merge, fix any failed PR, smoke
  including vision review on `apps/web/**`, chained PRs, 4b merge ORDER, transient CI, reconcile
  after restart, token budget). The receipt step for merges (§8.3) is in `STATION-CAPABILITIES.md` §5
  and `docs/decisions/merge-approvals/README.md`.
- **YOUR ACCESS / YOUR LIMITS / ESCALATE** — the exact wording that binds you.
- **PHASE 1-4** — build the picture (1), synthesise (2), issue the fix (3a wedged/down, 3b ensure-up,
  3c LOOP, 3d HANG, 3e silent no-ops, 3f orphaned worktrees), report (4).
- **AFTER YOUR BOARD PR MERGES** — the four-step fast-forward unblock cure (incl. EOL rules).
- **MANDATORY ANSWER SHEET** — Q1 DIRTY PRs, Q2 conflicts are yours, Q3 count armed yourself, Q4
  re-verify every claim, Q5 silent no-ops are failures, Q6 the one biggest blocker.
- **HOW YOU DECIDE THE WATCHER IS DOWN** — RULE 1 (never from `ps`), RULE 2 (UTC vs AEST), RULE 3
  (what would make me wrong).
- **ABSOLUTE: YOU NEVER TOUCH GIT IN THE WATCHER'S REPO** — the one-sentence rule plus the ENTIRE
  fix set (then supersession note).
- **"OFF MAIN" IS NOT "BROKEN"** — the four repo verdicts and when to run `rescue-watcher-repo.ps1`.
- **YOUR SCRIPTS** — the SCRIPT-REGISTRY cross-reference.
- **FIX LANE** — fixes outrank everything else on the board.
- **PROVENANCE** — the DOCTRINE 7.1 restatement for this station.

**Open `docs/pipeline/stations/00-supervisor-REFERENCE.md` before touching any of the areas above.**
The core stops here.
