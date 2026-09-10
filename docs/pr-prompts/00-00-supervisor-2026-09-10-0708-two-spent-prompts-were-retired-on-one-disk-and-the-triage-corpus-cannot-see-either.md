# Station 00 — Supervisor | 2026-09-10T07:08Z–2026-09-10T07:4xZ

## GROUND

```
UTC            2026-09-10T07:08:47Z
origin/main    d599bd46            (git fetch origin --prune, then git rev-parse --short)
dev tree       main @ d599bd46     C:\ProjectOperations2   (0 behind, 0 ahead)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE — this run was not read-only.

**SIGHTED run.** `ToolSearch` loaded the Desktop Commander schemas before any device call;
`start_process` shell `powershell.exe` then returned a live prompt on the first attempt
(`LAPTOP-E6NHU4E4`, clock `2026-09-10T17:08:20+10:00`). A validation error would have been an
unloaded schema rather than an unreachable machine — the load came first and the call succeeded.
This is not being reported as a quiet run.

**vm-git-guard: [CANNOT MEASURE], sixth consecutive run.** PREFLIGHT step 1 asks for
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`. The Linux workspace never
reached the script. Last line, verbatim: `bash failed on resume, create, and re-resume. resume: RPC
error -1: failed to mount … under Plan9 share "c" which is not mounted; create: RPC error -1:
ensure user: user busy-peaceful-ptolemy already exists unexpectedly`. A failed install is a FINDING,
not a STOP. Blast radius is nil by construction: with no VM there is no VM-side `git` to guard, and
none was run — every probe below went through Desktop Commander against the Windows host.

**Read from the working copy, proved sound rather than assumed.**
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY** for all three, so the working copy holds
`origin/main`'s blobs and the staleness distinction could not bite. No piped `hash-object`
comparison was made (section 9.1 — that form is unsound in `powershell.exe`). All three read in full.

**Fresh needle minted this run, now SPENT by appearing here:** `zzQq00N20260910T0710x`.

## WHAT I MEASURED

**Sweep — SAFE TO ACT, twice.** `status-sweep.ps1` captured to a file, because it returns early and
hides its own section 7 verdict when it is not. 07:10:05Z: `SAFE TO ACT: no board mutation in
progress, no recent remote activity, no live station worktrees.` Re-run immediately before the
board mutation: `index.lock` False / False, `git processes running: 0`, no PR touched in the last
2 min, **SAFE TO ACT**. Dev tree at that instant: `0 0` ahead/behind, `git diff --numstat` EMPTY,
`git diff --cached --name-status` EMPTY.

**Board — 2 open, both CLEAN, both 15/15 green, both Marco's.** `#1832` (created 00:12:33Z) and
`#1823` (created 2026-09-09T00:05:42Z), `labels: []` on both. `main` CI on `d599bd46`: 4 success /
0 failed. Armed `*-ready.md`: **0**, counted by hand. Every `gh` call carried
`-R GH-Mantova/ProjectOperations`, per the trap landed on `main` earlier today.

**RULE 2 — re-verified live this run, not inherited from my own 06:08Z breadcrumb.** Probe pinned
to `C:\ProjectOperations2\docs\pr-prompts\processed` and never the clone: **2107** logs, newest
`2026-09-10T06:37:08Z` — more recent than both PRs' `createdAt`, which is the control that
separates the live directory from the seventeen-day-stale decoy. POSITIVE `marco.:true` → **627**;
NEGATIVE (minted needle) → **0**; NEGATIVE `PR #999999` → **0**. Matched on `PR #<n>` in the body of
`pr-*.log` with `rev-*` excluded:

- `#1832` → `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh"}`
- `#1823` → `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`

Both carry a **specific** policy reason, so neither is the byte-identical timeout path that section
10.3 warns reads the same as a real routing. **RULE 2 binds on both and I merged neither.** An
absent label does not clear it.

**Queue — 41 HOLDs, 10 gate-satisfied, and 0 of the 10 can enter the `tests-docs` lane.**
`triage-holds.ps1` exit 0 with both of its own controls passing (`GIT control: PASS`,
`SPENT control: PASS`): `spent=0 of 41 evaluated  gates-satisfied=10  still-gated=31  unreadable=0`.
Each of the 10 was then classified against `classifyPolicyFiles`' three `NESTED_TEST_PATHS` forms,
copied verbatim from `index.mjs`. POSITIVE control (`docs/a.md`, `tests/b.ts`,
`scripts/x/__tests__/y.mjs`, `apps/api/z.spec.ts`) → all four true; NEGATIVE control
(`apps/api/src/main.ts`, a `migrations/` path, `scripts/pipeline/foo.ps1`) → all three false;
migration clause → true.

| verdict | count |
|---|---|
| MARCO — migrations clause | 3 |
| MARCO — outside `tests\|docs` | 7 |
| **tests-docs lane eligible** | **0** |

**Sixth consecutive run to measure this**, and this is finding F5's own named falsifying probe,
re-run rather than quoted.

**Watcher — running and stable across the hour.** node RUNNING **pid 18228** — the same pid the
06:08Z run recorded, so the silent death that run reported has not recurred this window.
Auto-restart wrapper alive (1). Clone `branch=main dirty=0`. Heartbeat 33 min, which is the correct
idle reading with `armed: 0`, since the heartbeat ticks only mid-run.

**Station cadences, crossed against `lastRunAt` from the scheduled-tasks MCP** — not from
`--freshness` alone, which cannot name a cause:

| station | newest breadcrumb | `lastRunAt` | reading |
|---|---|---|---|
| 00 | 2026-09-10T06:08Z | 07:08:07Z (this run) | aligned |
| 03 | 2026-09-09T23:01Z | 2026-09-09T23:01:42Z | aligned, next 23:00Z |
| 04 | 2026-09-10T06:10Z | 06:09:45Z | aligned, next 10:09Z |
| 05 | 2026-09-09T22:02Z | 2026-09-09T22:01:58Z | aligned, next 14:10Z |

`check-breadcrumb.mjs --freshness` → **CLEAN**, exit 0, all stations `ok`. It still prints
`00 … (cadence 2h)` against a live cron of `5 * * * *`; that is the known `const CADENCE` defect,
already on file, and it is why the MCP cross-check above is the load-bearing instrument and not the
`ok`.

**Collect corpus.** Nothing new was written to the queue root between the 06:08Z collect and this
run: the 8 root breadcrumbs on disk are today's cycle and **all 8 are tracked**. Station 04's 06:10Z
breadcrumb and its staged `pr-statussweep-gitproc-scope-to-the-two-repos-HOLD.md` are both confirmed
present on `origin/main` (`git cat-file -e` exit 0 on each), so the 06:08Z run's hand-off landed.
This run's collect is therefore the **unfinished remainder of 04's 06:10Z breadcrumb**, not a new
batch.

## WHAT CHANGED

1. **Two spent prompts retired into `docs/pr-prompts/superseded/` and, for the first time,
   COMMITTED there** — `pr-watcher-verdict-home-resolver-LOOPING.md` (from the queue root) and
   `pr-doctrine-s9-four-false-traps-LOOPING.md` (already moved to `superseded/` by an earlier run
   but never tracked). Both copied byte-exact, verified with `Buffer.compare` → 0.
2. **Staged one new prompt as a HOLD**, armed by nobody:
   `docs/pr-prompts/pr-triage-corpus-suffix-union-HOLD.md`. Read back with
   `node scripts/pipeline/lint-prompt.mjs` → **ADMIT, exit 0**.
3. **This breadcrumb**, written inside this run's own PR worktree (cure 1 of the delete-the-disk-copy
   rule), so no loose copy is left in the dev tree to block the next fast-forward.
4. **Nothing merged. Nothing armed. No label added or removed. No `sot/` edit. No production data.
   No Azure / Entra / SharePoint. No `git` run in `C:\po-watcher\ProjectOperations`** — reads only.
   All work was done in a disposable worktree off `origin/main` at `C:\po-wt\st00-0708`.

## FINDINGS

### F1 — Two spent prompts were retired on ONE DISK, so every clone, CI and cloud-fired station still saw them as live

Station 04 dispatched `pr-watcher-verdict-home-resolver-LOOPING.md` to this station twice — its
2026-09-09T02:20Z run (F1c) and its 06:10Z run today (F4) — and both times it survived, because a
collect PR is a poor place to adopt a file whose provenance nobody has established. That caution was
right about provenance and wrong about cost: the file is **SPENT**, and leaving it untracked meant
the retirement did not exist anywhere but this laptop.

Re-verified this run rather than inherited (section 7.1's re-read rule):

| probe | reading |
|---|---|
| `lint-prompt.mjs pr-watcher-verdict-home-resolver-LOOPING.md` | **STALE, exit 3** |
| `VERDICT_HOME_RESOLVER` in `origin/main:scripts/pr-watcher/index.mjs` | **6** |
| POSITIVE control `classifyPolicyFiles`, same file | **2** |
| NEGATIVE control, needle minted this run | **0** |
| `git ls-files --error-unmatch` on it | exit **1** — untracked |

**And searching for it turned up a second one nobody had reported.**
`docs/pr-prompts/superseded/pr-doctrine-s9-four-false-traps-LOOPING.md` was already sitting in the
retirement folder — moved there by some earlier run — and is **also untracked**: `lint-prompt.mjs`
→ **STALE, exit 3**, `git ls-files --error-unmatch` → exit 1. So a previous run performed the
retirement and never landed it. `superseded/` is a **tracked** directory —
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/superseded/` returns **373** files — so
these two are the only untracked strays in it, not the norm.

This is the same class as the 01:10Z run's own finding, *a Station 00 safety hold exists on one
disk*: the move is the easy half and the commit is the half that makes it real. A retirement that
lives on one disk is invisible to a clone, to CI, and to any cloud-fired station, which is exactly
the population that most needs to know a prompt is dead.

**DISPOSITION: ACTIONED.** Both files are committed into `docs/pr-prompts/superseded/` in this
run's board PR, byte-exact (`Buffer.compare` → 0 on each). The root copy of the first is deleted
from the dev tree only after the PR merges and only after proving the committed blob matches, per
the delete-the-disk-copy rule; the read-backs are recorded under WHAT I DID NOT DO. Neither file
could ever have been built — the watcher globs `*-ready.md` — so the exposure was clutter and a
false sense of a clean board, not a duplicate build.

### F2 — The triage corpus is a filename suffix, so the instrument that hunts spent prompts cannot see one at the queue root

This is Station 04's F4, second half, dispatched to this station and staged here.

`triage-holds.ps1` defines its corpus in one place (anchor: the assignment
`$holdFiles = @(Get-ChildItem -Path $queueDir -Filter "*-HOLD.md"`), and everything downstream is
scoped to that array — including the published denominator and the sentence beneath it asserting
that *every premise on this board was evaluated*. [MEASURED] this run: the totals line reads
`spent=0 of 41 evaluated … of 41 HOLDs`, while a **spent** prompt sat at depth 1 of the same
directory carrying a different suffix. The count is honest about `*-HOLD.md` and the sentence is
not honest about the board.

The failure mode is the one this pipeline keeps recording: nothing is empty, nothing warns, the
cmdlet did exactly what it was asked, and the reader is handed a clean board. Two consecutive
gate-liveness runs had to rediscover the same file by hand.

**DISPOSITION: ACTIONED** — staged as `docs/pr-prompts/pr-triage-corpus-suffix-union-HOLD.md`,
`lint-prompt.mjs` → **ADMIT, exit 0**. RULE 1, complete-and-additive first: **(a)** widen the
corpus to the suffix union `-HOLD` / `-ready` / `-LOOPING`, excluding auto-generated `rev-*` review
jobs, carry the suffix into the output, make the totals line name the corpus it measured, and keep
the old `-HOLD.md` sub-count on its own line so no reader loses a number — complete, because no
suffix can hide a spent prompt again, and additive, because a wider denominator can only reveal.
**(b)** delete the one file and change nothing — fails the *future* half: the next mis-suffixed
prompt is invisible again, which is how this one survived two runs. **(c)** a prose warning in the
station doc — fails both halves; the 2026-09-09 run wrote one and I still had to measure it myself.
The prompt carries the positive control that makes the change checkable — a `-LOOPING` fixture with
a known-false premise must appear in the SPENT bucket — because a wider glob nobody has seen match
a new file is indistinguishable from the old one. **I did not arm it:** its scope is
`scripts/pipeline/triage-holds.ps1`, so `classifyPolicyFiles` routes the resulting PR to Marco, and
the board is already saturated with work only he can clear (F4).

### F3 — Station 04's F3 safety clause landed intact, and it is worth recording that it did

The 06:08Z run appended 04's *"before repairing a dead gate, check whether it is load-bearing"*
clause to the `gate-liveness` brief in `docs/pipeline/sweep-rotation.json`. Verified on
`origin/main` this run rather than assumed: the clause is present, verbatim, including the
destructive-prompt guard — *"If the prompt is destructive, or its other gates are already satisfied,
REPORT IT AND REPAIR NOTHING."* POSITIVE control `gate-liveness` → 1; NEGATIVE control, minted
needle → 0. `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → **EMPTY**, so
the rotation advance is committed and the next 04 run will not repeat the same sweep.

**DISPOSITION: ACTIONED** — closed, verified on `main`, nothing outstanding. Recorded because 04's
dispatch asked for a change to a file it may not commit, and a hand-off nobody confirms is a
hand-off that gets re-sent.

### F4 — Nothing on this board can move without Marco, and this is the SIXTH consecutive run to measure it

Both open PRs carry live, specific watcher `marco:true` verdicts. All ten gate-satisfied HOLDs
classify outside `tests|docs` — three on the migrations clause alone. `needs-marco/` holds **54**
files, up one from the 53 the previous run counted. There is no red to fix: `main` is green and both
PRs are 15/15.

The constraint is not the machinery. Every instrument in the pipeline is working — the sweep is
clean, the watcher is up, the linter is honest, the queue is triaged — and every remaining path
forward terminates in a human decision. Arming faster lengthens the queue Marco is already the
constraint on.

**DISPOSITION: DEFERRED** — real, measured, and already carried by three separate escalations: the
RULE 2 clearance that lives in a chat no scheduled run can read, the `tests-docs` lane starvation,
and the vacuously-passing CP-26 gate. I am deliberately not filing a fourth that would restate
them. **What would make it urgent:** a gate-satisfied HOLD appearing that *is* `tests|docs`-only,
which would prove the lane can still be fed and make the starvation a scheduling problem rather
than a structural one. That is cheap to re-test — it is the classification table under WHAT I
MEASURED, re-run.

### F5 — The Cowork Linux workspace failed for the sixth consecutive station run, same signature as the last two

`Plan9 share "c" which is not mounted`, plus `ensure user … already exists unexpectedly`. Identical
in shape to the failures the 06:08Z Station 00 run and the 06:10Z Station 04 run both recorded, and
different from the 05:08Z run's `SDK version 2.1.260 not verified` — so at least two distinct causes
have produced this outcome, which matters because a single-cause fix will not clear it.

Already on file as `needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`.

**DISPOSITION: DEFERRED** — not re-raised, and the count is updated here rather than in a second
escalation file. The guard it blocks protects against a VM-side `git` call reaching the Windows
`.git`; with no VM there is no such call, and none was made. **What would make it urgent:** a run
where the workspace *does* start — that run must install the guard before its first mount-side call
and must not read this note as cover for skipping it.

## WHAT I DID NOT DO

- **Did not merge anything.** Both open PRs carry a live, specific watcher `marco:true` verdict.
  RULE 2 binds and is not cleared by green, by CLEAN, by an absent label, or by a receipt.
- **Did not add or remove a label** on either PR. Only Marco removes `do-not-merge`.
- **Did not arm anything.** `armed: 0` at the start and at the end. All ten gate-satisfied HOLDs
  route to Marco, including both of the ones staged in the last two hours.
- **Did not author a merge-approval receipt.** A scheduled run never may, whatever the supervised
  cloud lane's standing authority permits.
- **Did not delete the dev tree's root copy of `pr-watcher-verdict-home-resolver-LOOPING.md` before
  the PR merged.** After the merge the committed blob is proved equal to the disk copy with
  `git rev-parse origin/main:<path>` against `git hash-object <path>` — never a piped hash — and only
  then is the loose copy removed, followed by the three prescribed read-backs (`rev-list
  --left-right --count` → `0 0`, `git diff --numstat` → EMPTY, `git diff --cached --name-status` →
  EMPTY). Never `git clean`, never `git checkout .`.
- **Did not commit the other untracked paths** in the dev tree — `.queue-sync-ledger.txt`,
  `queue-watch-state.md`, and `archive/review-escalations-516-1346/`. None is a hand-off addressed
  to this run, and unlike the two `-LOOPING.md` files none is a *retirement* whose whole purpose is
  defeated by staying on one disk.
- **Did not touch `C:\po-vg`** (1 uncommitted file, ~8,596 min old) or `C:\po-worktrees\pr1823`
  (its PR is still open). Worktree hygiene is Station 03's lane and `po-vg` is already escalated.
- **Did not run `git` in `C:\po-watcher\ProjectOperations`** beyond reads, and did not touch the
  stash. Dropping the two provably-safe entries is Station 03's, and the 06:08Z breadcrumb hands it
  the measurement.
- **Did not touch `/sot/`** (Station 05's), Azure / Entra / SharePoint (absolute), or production
  data.
- **Did not run the four non-rotation sweeps.** Station 04 owns the sweep rotation; this is a
  collect run.
