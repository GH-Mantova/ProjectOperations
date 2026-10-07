# Station 00 — Supervisor | 2026-10-07T01:13Z–2026-10-07T02:0xZ

## GROUND

```
UTC            2026-10-07T01:14:20Z
origin/main    d4c26df4            (fetch first, then rev-parse)
dev tree       main @ d4c26df4      C:\ProjectOperations2
doc version    1                    (station_doc_version, 00-supervisor.md on origin/main)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE** (1 = 1). This run was READ-WRITE.

Not blind. Desktop Commander reached the box on the first call after one keyword `ToolSearch` for
`desktop-commander`; `hostname` -> `LAPTOP-E6NHU4E4`, UTC `2026-10-07T01:14:20.3928040Z`.

## WHAT I MEASURED

### The git guard — quoted verbatim, with the INSTALLER's own exit code

`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, run before any VM-side call.
Last line and exit code, read from the installer itself and **not** from a pipeline appended to it:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/trusting-sweet-dirac/.local/bin:$PATH" git <args>
EXIT=2
```

[MEASURED] Exit **2** — `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from
your shell.` Its own controls, printed in the same output: `bash -lc 'command -v git'` ->
`/sessions/trusting-sweet-dirac/.local/bin/git` (the shim); `bash -c 'command -v git'` ->
`/usr/bin/git` (the real git). This is the station doc's documented **expected** station outcome, not
a regression, and it is the **seventh** consecutive run to record it. **No `git` ran against any
mount in this run** — every git call went through a PowerShell shell on the Windows host.

### The three binding documents, read from `origin/main` and not the working copy

`git show origin/main:<path>` into `$env:TEMP`, run in the **dev tree** `C:\ProjectOperations2`
(not the watcher clone), after `git fetch origin --prune`:

| file | bytes | read in full |
|---|---|---|
| `docs/pipeline/stations/00-supervisor.md` | 60780 | yes (443 lines) |
| `docs/pipeline/DOCTRINE.md` | 60566 | yes (508 lines) |
| `docs/pipeline/STATION-CAPABILITIES.md` | 91310 | yes (645 lines) |

No REFERENCE section was opened: no core line sent me to one, and the one §9 trap I acted on
(§9.1, below) I hit live rather than reasoned about.

`git rev-parse origin/main` -> `d4c26df4830e8afc27c4029404de799314608d17`; `git rev-parse HEAD` ->
the same. **No piped `git show … | git hash-object --stdin` was used anywhere** (DOCTRINE §9.2 —
unsound in `powershell.exe`).

### §9.1 fired live, in this run, and cost one call

My first attempt at the freshness check was
`powershell.exe -NoProfile -Command "… Write-Host \"FRESHNESS_EXIT=$LASTEXITCODE\""` and it died with
`The string is missing the terminator: ".` — the `$` expanded by the `-Command` layer before
PowerShell parsed it. Cure applied as written: every subsequent multi-step command in this run went
into a `.ps1` under `C:\po-sup-fix-scripts\` and ran with `-File`. Recording it because §9.1 is a
list of things that *will* happen to you, and this is the measurement that it still does.

### Sweep — SAFE TO ACT, re-read immediately before the mutation

`scripts/pipeline/status-sweep.ps1`, generated `2026-10-07 01:15:03Z`, exit 0, read to completion
(459 lines, `SWEEP COMPLETE`). Section 0 positive controls both `[LIVE]`: `gh CAN reach GitHub (saw
merged PR #2256)`, `node runs`. **No `[BROKEN]` anywhere.**

```
[LIVE] OPEN PRs: 0
[LIVE] WAITING ON MARCO: 0 open PR(s) labelled do-not-merge
[LIVE] ALL OPEN (non-draft): 0
[LIVE] main CI on d4c26df4: 4 success / 0 failed / 0 running  (trunk green)
[LIVE] armed (*-ready.md): 0
[LIVE] watcher node: RUNNING pid 39052 ; auto-restart wrapper: alive (1)
[LIVE] git index.lock  interactive/clone: False / False
[LIVE] git processes touching our trees (scoped): 0
[LIVE] watcher build: no build in flight (newest tick is 34.5 min old)
[LIVE] board lease: free
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

**MARCO_QUEUE_LINE_V1, both figures, copied as the station doc requires:** `WAITING ON MARCO: 0` and
`ALL OPEN (non-draft): 0`. **Marco's queue was empty when this run started.** That is the evidence
for the arming decision in F1 and for any future limit.

### Section 5 produced NO `[STALE]` row

All 52 `needs-marco/` files were cross-checked. Every line is of the form *"cites #N (MERGED) as
**evidence** — not its premise; does not clear the escalation"*, plus *"names no subject PR … section
5 CANNOT decide"*. **Zero `[STALE]` tags**, so there was nothing for `retire-escalation.mjs` to
retire on a sweep reading this run. [INFERRED] from the absence of the tag the sweep exists to
produce, not from reading all 52 bodies.

### Freshness, and the live task list crossed against it

`node scripts/pipeline/check-breadcrumb.mjs --freshness` — run on the Windows host through Desktop
Commander, **not** from a mount (STATION-CAPABILITIES §3: it shells `git ls-tree` / `git ls-files` /
`gh pr list`, so a mount-only run may claim no verdict from it):

```
structure: 5 checked, 0 malformed, 0 skipped as pre-contract
  00  last 2026-10-07T00:14:00Z    1.0h ago  (cadence 1h + grace 0.5h)   ok
  02  dispatch-only — no cadence to miss
  03  last 2026-10-06T23:03:00Z    2.2h ago  (cadence 24h + grace 3h)    ok
  04  last 2026-10-06T22:10:00Z    3.1h ago  (cadence 4h + grace 1h)     ok
  05  last 2026-09-24T14:23:00Z  298.9h ago  (cadence 24h + grace 3h)    MISSED
MISSED: 1 station(s) past cadence + grace
FRESHNESS_EXIT=2
```

`list_scheduled_tasks` (scheduled-tasks MCP) — the live schedule, never this file:

| task | cron | enabled | lastRunAt | nextRunAt |
|---|---|---|---|---|
| 00-supervisor | `5 * * * *` | true | **2026-10-07T01:14:03Z — this run** | 2026-10-07T02:13:52Z |
| 03-machine-minder | `0 9 * * *` | true | 2026-10-06T23:02:55Z | 2026-10-07T23:02:45Z |
| 04-scanner | `0 */4 * * *` | true | 2026-10-06T22:09:40Z | 2026-10-07T02:09:31Z |
| 05-sot-keeper | `10 0 * * *` | **true** | **2026-09-27T21:38:18Z** | 2026-10-07T14:22:37Z |
| weekly-security-audit | `30 7 * * 1` | **false** | 2026-09-06T21:32:44Z | — |

**My own cadence, read from the MCP and not from the bootstrap: hourly, `5 * * * *`.** The live
enabled count is **four**, as STATION-CAPABILITIES §1's 2026-09-15 correction records — not five.

### `pipeline-lib.ps1` is on the instrument lane's NEVER-LIST

`scripts/pipeline/instrument-lane.json`, read in full. Its `files` allowlist has 13 entries and
`pipeline-lib.ps1` is **not** among them; its `_readme` NEVER-LIST names it first: *"`pipeline-lib.ps1`
— the core library all scripts depend on"*. [MEASURED] So INSTRUMENT_LANE_V1 can never authorise
Station 00 to merge a change to it. This is the measurement that decided F1's route.

## WHAT CHANGED

One board PR, docs-only, built in the isolated worktree `C:\po-wt\sup-0113` off `origin/main`
`d4c26df4` on branch `board/collect-0113-gitpush-worktree-mandatory`.

1. **Staged** `docs/pr-prompts/pr-gitpush-worktree-mandatory-HOLD.md` — the F10 fix, `ADMIT`, not
   armed. See F1.
2. **Archived** the five collected breadcrumbs of the 22:14Z / 23:14Z / 00:14Z cycles by `git mv`
   into `docs/pr-prompts/archive/`. All five were confirmed **tracked** first
   (`git ls-files -- "docs/pr-prompts/00-*.md"` -> 5 paths). `check-breadcrumb.mjs` matches by
   basename and its freshness scan reads `archive/`, so archiving does not make a station look silent.
3. **This breadcrumb**, written inside the PR worktree — cure 1 of the station doc's two homes, so it
   lands with the change it describes and needs nobody to sweep it up.

**Board lease:** taken before any mutation via `Enter-BoardLease -Actor station-00` -> `True`;
released after the merge landed. The dev tree's shared index was checked first —
`git diff --cached --name-status` -> **empty** — so no other chat was mid-`git mv` (DOCTRINE §9.2).

**Nothing was armed. Nothing was merged except this board PR. No scheduled task was touched.**

## FINDINGS

### F1 — F10 was DISPATCHED to a station that has no cadence, so the fix had no actor; 00 staged it

My predecessor (00:14Z, #2256) found that `Invoke-GitPush` defaults `-WorkTree` to `C:\po-fix`, which
does not exist, and **DISPATCHED** the fix to **Station 06**. [MEASURED] Station 06 has no schedule —
STATION-CAPABILITIES §6 lists it *"on demand"*, and
`needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md` is an open escalation
saying exactly this. **A dispatch to 06 is a dispatch to nobody.** That is the circular failure the
breadcrumb channel exists to close, and it closes only if someone acts.

I re-verified the defect myself rather than inheriting the claim (DOCTRINE §7.1 re-read rule).
`pipeline-lib.ps1:363` is `param([string]$Branch, [string]$WorkTree = $script:WORKTREE)`; line 37 sets
`$script:WORKTREE = "C:\po-fix"`; `Test-Path C:\po-fix` -> **False**; line 365 is
`Push-Location $WorkTree`, and under the `$ErrorActionPreference = "Continue"` that DOCTRINE §7 guard 7
*requires*, a failed `Push-Location` does not stop the function — so lines 366-370 run against the
ambient cwd and still return a 40-hex SHA and exit 0.
`Select-String -Path scripts/pipeline/*.ps1 -Pattern 'Invoke-GitPush'` -> **1** hit, the definition
itself, so every caller is an agent typing it by hand.

So I staged the prompt. **The route was forced by measurement, not preference:** `pipeline-lib.ps1`
is on `instrument-lane.json`'s NEVER-LIST, so 00 can never merge the fix, and writing the fix myself
unsmoked at the end of a run is not authority 00 has. What 00 *does* have is
`docs/pr-prompts/` (STATION-CAPABILITIES §5) and a watcher that is RUNNING and idle with an empty
board. Staging a prompt is the sanctioned way to get a `scripts/` change built and reviewed
(DOCTRINE §10.3: *"Prefer: write a prompt, let the watcher open the PR"*).

**RULE 1 on the fix the prompt orders.** Complete-and-additive **first**: make `-WorkTree`
`[Parameter(Mandatory)]`, drop the default, and `throw` on a missing path *before* `Push-Location`.
*Solves it immediately* — this call shape can no longer half-succeed — *and in future* — no caller can
inherit a dead default — and it *damages no data entry*: it removes a default that resolves to a
non-existent path, so no invocation that works today changes behaviour. The alternative, pointing the
default at a directory that exists, fails the **future** half: it keeps a hidden default that silently
pushes a tree the caller did not name, which is the defect itself. A `-RepoPath` alias fails the same
half — accepting the wrong name silently is the same class of bug.

`escalates: true` deliberately, so CP-26 labels it `do-not-merge` and **only Marco** can merge the
core library. The prompt's body says so three times, including in the `Do NOT` list.

`node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-gitpush-worktree-mandatory-HOLD.md` ->
`ADMIT pr-gitpush-worktree-mandatory-HOLD.md (size 2)`, exit **0**. Its premise was executed as
written: marker `GITPUSH_WORKTREE_MANDATORY_V1` **absent** from `pipeline-lib.ps1` -> premise TRUE.
POSITIVE control `function Invoke-GitPush` -> 1 hit; NEGATIVE control, a needle minted for this run,
`ZZQ7X_NEEDLE_20261007_0113` -> **0** hits (DOCTRINE §9.6).

**ACTIONED** — staged, linted ADMIT, and merged to `main` as a tracked `-HOLD.md`. Verified by
reading the path back on `origin/main` after the merge (see WHAT CHANGED and the read-back below).
⚠️ **It is NOT armed, and could not be this run:** arming is a `git mv` of a **tracked** `-HOLD.md`,
and the file only became tracked when this PR merged. **Arming it is the next run's first board
action** — Marco's queue was empty at `0/0`, so there is room for the one PR it will add.

### F2 — I nearly staged a prompt that nothing could ever arm, and the linter caught it

Recording this against myself because the failure mode is invisible by construction. I built the
prompt's front matter from an existing staged prompt, `pr-queue-layout-sot-entry-HOLD.md`, and copied
its line 2 along with it: `<!-- watcher: do-not-arm -->`. First lint:

```
REJECT  pr-gitpush-worktree-mandatory-HOLD.md  [HUMAN_GATE_PRESENT]
        HUMAN_GATE_PRESENT: line 2 contains <!-- watcher: do-not-arm --> marker.
        A person explicitly marked this prompt do-not-arm. The only thing that clears
        this gate is a human removing the marker from the prompt body.
LINT_EXIT=1
```

That marker is correct on the file I copied from — it is a Station-05-only `/sot/` prompt, gated on
purpose. Carried onto mine it would have produced a prompt that lints REJECT forever and that **no
station may clear**, since only a human can remove it. Had I staged without linting, the next run
would have tried to arm it, failed, and had no obvious reason why.

**The general lesson is the one STATION-CAPABILITIES §1 keeps making about layers: a template carries
its own gates with it.** The cure is cheap and I used it — lint before commit, never after.

**ACTIONED** — marker removed, re-linted `ADMIT` exit 0, quoted above. No further change needed; the
linter already enforces this and did.

### F3 — `05-sot-keeper` is still the only silent station, and its probe is not due until 14:22Z

[MEASURED] `05-sot-keeper` is `enabled: true` on `10 0 * * *` with a valid `nextRunAt`, and
`lastRunAt` has not moved from **2026-09-27T21:38:18Z** — 9.8 days and nine daily occurrences.
`--freshness` agrees from the other instrument at 298.9h. Classification under
FRESHNESS_ONE_CADENCE_V1: **never fired** — a session-folder scan of
`local-agent-mode-sessions` for anything created since 2026-09-24 returned **no** 05 session.

This is already open with Marco as
`needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`, which the 00:14Z
run narrowed from three stations to one. I re-read that file in full. **Its next falsifying probe is
05's next occurrence, `2026-10-07T14:22:37Z`, which is ~13 hours in the future** — so there is nothing
this run could measure that would move it, and nothing to add.

**ESCALATED** — already open, correctly scoped, and left untouched. One open question, one file
(§10.5). I did **not** re-escalate it, did **not** open a second file, and did **not** rename the
existing one despite its filename naming three stations when only one remains. The remedy is the
scheduled-task store, which is Marco's alone and on the station doc's forbidden list for a MISSED
reading.

### F4 — The guard reported INERT for the seventh consecutive run

Exit 2, quoted verbatim above with the installer's own exit code rather than a pipeline's. Documented
expected outcome for a station, because the shell a station is given is non-interactive and
non-login and sources neither `~/.bashrc` nor `~/.profile`.

**DEFERRED** — trigger adopted unchanged from 04 and my predecessors: it becomes urgent on an eighth
`index.lock` freeze, or the moment any station report quotes a guard exit of `0` from a piped command
(the 2026-09-22 false-pass shape). Neither holds — the sweep read `index.lock interactive/clone:
False / False` and `git processes touching our trees (scoped): 0`.

### F5 — 30 non-`main` worktrees, 10 holding commits on no remote branch, 2 registry escapees

Unchanged in shape from the previous two runs. The sweep names them all with `dirty` counts and ages;
`C:/po-wt/fv2drop` holds **21** commits at age 18275 min, `C:/po-wt/rcpt-2183` holds 15 at 6918 min,
`C:/po-wt/s8h` holds 16 at 17576 min. Two hold uncommitted work
(`C:/po-worktrees/sup-cwd-paths`, `C:/PR-Master/worktrees/sweep-dirty-untracked-v1`).

**DEFERRED** — the authority matrix gives Station 00 `❌ repair the machines`; this is 03's lane, and
03 is **healthy and on cadence** (`lastRunAt 2026-10-06T23:02:55Z`), so it will see this. The prune
decision is already ESCALATED by an earlier run with counts and I did not re-escalate it. It becomes
urgent if a worktree holding unpushed commits is about to be force-pruned, or if the count starts
growing per-run rather than holding flat.

### F6 — This run's own worktree is the 31st, and I left it behind

`C:\po-wt\sup-0113` still exists at the time of writing, because the breadcrumb describing the run
lives inside it until the PR merges. It will appear in the next sweep as an orphan.

**ACTIONED** — torn down after the merge was read back; see WHAT I DID NOT DO for the one I could not
remove. Naming it so the next run does not spend a measurement deciding whether an `sup-0113` tree is
a live station.

## WHAT I DID NOT DO

- **Did not arm anything**, including the prompt I just staged — it was untracked until this PR
  merged, and arming requires a tracked `-HOLD.md`. `armed (*-ready.md): 0` at run start and at run
  end. **Arming `pr-gitpush-worktree-mandatory-HOLD.md` is the next run's first board action.**
- **Did not write the `pipeline-lib.ps1` fix myself.** `scripts/pipeline/**` is outside 00's
  docs/`sot`/queue merge lane, `pipeline-lib.ps1` is on the instrument lane's NEVER-LIST, and
  INSTRUMENT_LANE_V1 governs *merging* a narrow instrument fix — it is not authority to author one
  unsmoked at the end of a run.
- **Did not merge any other PR**: there were none. `OPEN PRs: 0` at run start, re-read before the
  mutation.
- **Did not touch any scheduled task** — not enabled, disabled, run, re-run or edited, including
  `05-sot-keeper`. That is the station doc's forbidden list on a MISSED reading, DOCTRINE §7, and
  Marco's alone.
- **Did not retire any escalation.** Section 5 produced zero `[STALE]` rows, so
  `retire-escalation.mjs` had nothing to act on. I did not clear anything on the strength of a
  *"cites #N as evidence"* line — the sweep says in terms that such a line does not clear an
  escalation.
- **Did not rename or delete** the three-station escalation file whose title is now two-thirds
  answered — §10.5, one identity for an artifact's whole life.
- **Did not prune any worktree** other than my own, and did not `--force` anything (F5, F6).
- **Did not edit `/sot/`** — Station 05's lane, and CP-24 hard-fails any PR mixing code and `sot/`.
  This PR is `docs/pr-prompts/` only.
- **Did not commit on `main` in the dev tree.** Every mutation is in `C:\po-wt\sup-0113` off
  `origin/main`.
- **Did not run `git` against a mount** — not through the inert shim, not through the one-call
  `PATH=` form, not at all. Every git call ran in a PowerShell shell on the Windows host.
- **Did not use a piped `git show … | git hash-object --stdin`** anywhere (DOCTRINE §9.2).
- **Did not touch Azure, Entra or SharePoint.** Absolute, and nothing in this run came near them.
- **Did not write to any of the five gitignored `docs/qa/` sinks**, and did not leave this report in
  the Cowork session's `outputs` folder.

## FOR MARCO

Two things, shortest first. **Nothing new is being asked of you.**

1. **`05-sot-keeper` is still the only silent station** — `lastRunAt` still 2026-09-27T21:38Z, nine
   missed daily occurrences, `enabled: true` throughout. Its next occurrence is
   **2026-10-07T14:22:37Z**. If it fires, the whole three-station escalation can be discharged; if it
   does not, that file is down to one station and one question, and the remedy is the task store,
   which only you can touch. `/sot/` has now had no keeper for nine days.

2. **A fix to `pipeline-lib.ps1` is staged and waiting for you to arm-and-release, not for a
   decision.** `Invoke-GitPush` defaults `-WorkTree` to `C:\po-fix`, which does not exist; a caller
   who mistypes the parameter gets a push against whatever directory they happened to be in, plus a
   well-formed SHA and exit 0. It is the helper whose own docstring says it exists to stop exactly
   that. I staged `pr-gitpush-worktree-mandatory-HOLD.md` (lints ADMIT) rather than fixing it,
   because `pipeline-lib.ps1` is on the instrument lane's NEVER-LIST — your rule, working as
   intended. Next run arms it; the watcher builds it; it opens labelled `do-not-merge` and
   **you** merge it. Your queue is at **0 open PRs** right now, so it will be the only thing in it.

---

## AMENDMENT 2026-10-07T01:28Z — F7, found during this run's own merge

Added by Station 00 in the same run, at `origin/main` `e9414bae` (this breadcrumb's own PR #2257
merged at `2026-10-07T01:28:01Z`). Recorded by amendment rather than left for the next run, because a
finding that lives only in a chat transcript reaches nobody (STATION-CAPABILITIES §7) — the same
reason my predecessor amended F10 into its breadcrumb.

### F7 — `Merge-Pr` defaults `-Actor` to a random name, so the station holding the board lease is refused by its own lease

[MEASURED] With the board lease legitimately held by `station-00` (taken by this run,
`Enter-BoardLease -Actor "station-00"` -> `True`), I called `Merge-Pr -Pr 2257`. Output, verbatim:

```
WARNING: Merge-Pr: -Actor not set and $env:PO_ACTOR empty; using 'pwsh-36532' for the board lease.
[board-lease] REFUSED: station-00 holds the board (8 min ago, reason=collect 0113: stage
  GITPUSH_WORKTREE_MANDATORY_V1 prompt, archive 5 collected breadcrumbs)
Merge-Pr: #2257 refused -- another lane holds the board lease. Stand down; COLLECT only.
    at C:\ProjectOperations2\scripts\pipeline\pipeline-lib.ps1:515
```

🔴 **"another lane" was me.** `Merge-Pr` has no `-Actor` default, so with `$env:PO_ACTOR` empty it
synthesises one from the process id — `pwsh-36532` — and then asks the lease whether `pwsh-36532` may
act. The lease correctly answers no, because `station-00` holds it. **BOARD_LEASE_V1's load-bearing
protection turned into a self-deadlock for the only station that is supposed to hold the lease.**

The cure was one parameter: `Merge-Pr -Pr 2257 -Actor "station-00"` -> `State MERGED, PR 2257`, read
back from GitHub as `{"number":2257,"state":"MERGED","mergedAt":"2026-10-07T01:28:01Z"}`.

**Why this is worse than it looks, and why it is not just my mistake.** The refusal message is
*indistinguishable from a real LL-38 collision*. Board-driving condition 3 says: *"If it is refused,
COLLECT only and say WHO held it (the refusal line names the actor and its reason)."* A station that
obeys that instruction literally — as it should — reads `station-00 holds the board`, concludes
another Station 00 lane is mid-mutation, stands down, and **abandons a green PR it was entitled to
merge**. It would then report a collision that never happened. The instruction is right; the
instrument hands it a false premise.

This is DOCTRINE §7 in its exact shape — *a broken MEASUREMENT of a working system*, handing back a
confident, coherent, wrong verdict. Nothing is red: `Enter-BoardLease` worked, the lease file is
correct, `Merge-Pr` worked, and the refusal is the lease doing its job. The defect is only that the
two calls disagree about who the caller is.

[MEASURED] It is the **same class as F10**, in the same file, one function apart: a parameter whose
unset value resolves to something that is not what the caller meant, with nothing warning loudly
enough to stop the run. F10's default pointed at a directory that does not exist; F7's points at an
actor that does not hold the lease. `Enter-BoardLease` takes `-Actor` as a required argument;
`Merge-Pr` does not.

**DISPATCHED — Station 06, to stage, and it should be staged alongside
`pr-gitpush-worktree-mandatory-HOLD.md`** because it is the same file, the same class, and the same
review. ⚠️ Station 06 has no cadence (F1), so **if 06 has not acted by the next run, Station 00
should stage this one too, exactly as F1 did.** I did not stage it this run: the fix is a
`scripts/pipeline/pipeline-lib.ps1` change, `pipeline-lib.ps1` is on the instrument lane's
NEVER-LIST, and writing a second prompt after my board PR had already merged would have meant a
second lease cycle and a second PR for a queue I had just measured at 0.

**RULE 1 on the fix.** Complete-and-additive **first**: give `Merge-Pr` — and every other
`pipeline-lib.ps1` function that takes the board lease — the **same mandatory `-Actor` contract
`Enter-BoardLease` already has**, and **delete the pid-synthesised fallback**. *Solves it immediately*
(the station that holds the lease can merge) *and in future* (no lease-taking primitive can ever
disagree with another about the caller's identity), and it *damages no data entry*: it removes a
fallback that can only ever produce a wrong answer, so no call that works today changes behaviour.

Two alternatives, and which half of RULE 1 each fails:

- **Have `Merge-Pr` default `-Actor` to `station-00`.** Fails the *future* half. It makes the common
  case work while leaving a silent default that mis-attributes every non-00 caller — and
  mis-attribution is the defect, not the refusal.
- **Set `$env:PO_ACTOR` in each station's bootstrap.** Fails *both* halves. It is a fix in the one
  layer an agent cannot version (STATION-CAPABILITIES §1: the scheduled-task file is Marco's, by
  pasting), it leaves the fallback in place for anything that forgets, and a station reading
  `pipeline-lib.ps1` would still see a parameter that looks optional.

⚠️ **I did not write the fix.** `scripts/pipeline/**` is outside Station 00's docs/`sot`/queue merge
lane, and `pipeline-lib.ps1` is on `instrument-lane.json`'s NEVER-LIST — only Marco may merge it.

⚠️ **Falsifying probe:** with the board lease held as `station-00`, call `Merge-Pr -Pr <n>` with no
`-Actor` and `$env:PO_ACTOR` empty. If it does **not** print the `using 'pwsh-<pid>'` warning and does
**not** refuse, this finding is wrong and must be re-measured.

### Amendment to F1's disposition — the read-backs that close it

All four read against `origin/main` `e9414bae` **after** #2257 merged, via
`git ls-tree -r --name-only origin/main -- <path>`:

- `docs/pr-prompts/pr-gitpush-worktree-mandatory-HOLD.md` — **present and tracked.** It is now
  armable by a `git mv`, which it was not when the run started.
- All **five** collected breadcrumbs — present under `docs/pr-prompts/archive/`.
- `docs/pr-prompts/` depth-1 `00-*` — exactly **one** file, this breadcrumb. The queue root holds only
  the current cycle, as the station doc requires.
- `gh pr view 2257` — `state MERGED`, `mergedAt 2026-10-07T01:28:01Z`.

### Amendment to F6 — teardown

The board lease was released and `C:\po-wt\sup-0113` removed after this amendment's PR merged. The
dev tree was fast-forwarded to `origin/main` and all four of the station doc's readings taken. Results
are in this amendment's PR body rather than re-amended here, to avoid a third round trip.

---

## CORRECTION 2026-10-07T01:35Z — the "armed 0 at run end" claim above is WRONG, and the reason is a §9.5 trap

Added by Station 00 in the same run, at `origin/main` `35cca04d`. **WHAT I DID NOT DO above says
`armed (*-ready.md): 0` at run start and at run end. The second half is false** and is corrected here
rather than left to be re-derived, because the next run measures the same glob and would have to
decide whether its predecessor armed something or simply lied.

[MEASURED] At run end, `Get-ChildItem docs\pr-prompts\*-ready.md` returned **1**, not 0:

```
rev-2258-ready.md
  CreationTimeUtc  : 2026-10-07T01:33:34.1274689Z
  LastWriteTimeUtc : 2026-10-07T01:33:34.1280632Z
  bytes            : 2986
  tracked?         : (empty - untracked)
  gitignored by    : .gitignore:75:docs/pr-prompts/*-ready.md
  first line       : "Use the pr-fix-reviewer agent to review PR #2258 (...) on GH-Mantova/ProjectOperations."
```

**It is a watcher-generated REVIEW JOB for this run's own amendment PR, not an armed prompt.**
DOCTRINE §9.5 names exactly this: *"`rev-<n>-ready.md` are auto-generated REVIEW JOBS, not prompts —
they have no YAML front matter by design."* The watcher created it 50 seconds before #2258 merged,
which is normal behaviour and not a defect.

### F8 — `armed (*-ready.md)` counts review jobs and armed prompts in one number, and the two have opposite meanings

The sweep's section 4 line and my glob are the **same** `*-ready.md` pattern, so neither can
distinguish *"a prompt is armed and the watcher is about to build it"* — a board state Station 00 owns
and limits to one at a time — from *"the watcher queued a review of a PR that just merged"*, which is
routine and which no station arms. The watcher's own log already separates them and shows the
distinction mattering:

```
[2026-10-07T11:35:11.6722125+10:00] WATCHDOG[pid=36020] armed=1 runnable=0 -- nothing this node
  can dequeue; a stale heartbeat is legitimate idle. Source: node-published (state age 4 min).
```

`armed=1 runnable=0`. The watchdog has the richer reading and uses it to decide a stale heartbeat is
*legitimate idle* rather than a hang — but the number a station reads from the sweep is the bare
`armed` count, and `runnable` is exactly the field that separates the two cases.

⚠️ **The failure mode is a false ARMING LIMIT, not a false alarm.** The station doc tells 00 to ARM
ONE AT A TIME and to copy the armed figure into its breadcrumb as the evidence for any future limit
(MARCO_QUEUE_LINE_V1). A run that reads `armed: 1` from a leftover review job concludes the board
already has work in flight and **declines to arm the prompt it was supposed to arm** — which is
precisely what the next run is scheduled to do with
`pr-gitpush-worktree-mandatory-HOLD.md`. The arming limit would be enforced against a number that is
not measuring arming.

⚠️ And the figures I copied into WHAT I MEASURED are themselves affected: `armed (*-ready.md): 0` was
true at 01:15:03Z and is the honest reading for that moment, but it is **not** a claim that survives
to run end, and §7's `[LIVE]` rule — *"true when measured, not true now"* — is the reason.

**DEFERRED** — real, and not urgent tonight. The cheap complete-and-additive fix, RULE 1 first:
have `status-sweep.ps1` section 4 report the two populations separately, e.g.
`armed prompts: N (rev review jobs: M)`, by excluding the `rev-<digits>-ready.md` shape from the
armed count and reporting it on its own line. *Solves it immediately* (a station reads the number it
actually needs) *and in future* (the two populations can never be conflated again), and it *damages
no data entry* — it is a reporting change that reads the same files and writes nothing. The
alternative, teaching every station to subtract review jobs by eye, fails the future half: it is the
remembered-not-mechanical shape DOCTRINE §9.2 records as having failed seven times.

🟢 **`status-sweep.ps1` IS in the instrument lane** (`instrument-lane.json` `files[0]`), unlike
`pipeline-lib.ps1` — so unlike F7 and F10 this one is a fix Station 00 could stage **and** merge
itself under INSTRUMENT_LANE_V1, once CI is green and a fresh MERGE verdict exists for the head.
Naming that here so the next run does not re-derive it.

It becomes urgent the moment a run declines to arm on the strength of an `armed` count it did not
decompose — so **the next run must check whether its `armed` reading is review jobs before treating
it as an arming limit.** That is the one thing this correction exists to prevent.

### Teardown, read back rather than asserted

- **Board lease released**: `Exit-BoardLease -Actor "station-00"` completed without throwing.
- **Worktree removed**: `git worktree remove C:\po-wt\sup-0113` exit 0;
  `Test-Path C:\po-wt\sup-0113` -> **False**. F6 is closed.
- **Dev tree fast-forwarded** `d4c26df4` -> `35cca04d`, exit 0, and **all four** of the station doc's
  readings taken, not three:
  - `git rev-list --left-right --count HEAD...origin/main` -> `0	0`
  - `git diff --numstat origin/main` -> **EMPTY**
  - `git diff --cached --name-status` -> **EMPTY**
  - `git status --porcelain --untracked-files=no` -> **EMPTY** (the only one that catches a dirty
    tracked file; the first three pass on a dirty tree)
- **Board**: `gh pr list --state open` -> `[]`. Zero open PRs. Marco's queue is empty.
- **The staged prompt is tracked**: `git ls-files -- docs/pr-prompts/pr-gitpush-worktree-mandatory-HOLD.md`
  -> the path. It is armable by `git mv` next run.
- **PRs this run**: #2257 `MERGED 2026-10-07T01:28:01Z`, #2258 `MERGED 2026-10-07T01:34:24Z`, both
  read back from GitHub with `gh pr view --json state,mergedAt`.
