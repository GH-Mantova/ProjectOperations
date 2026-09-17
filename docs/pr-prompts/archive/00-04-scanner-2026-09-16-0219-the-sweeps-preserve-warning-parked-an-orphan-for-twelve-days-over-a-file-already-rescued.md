# Station 04 — Scanner | 2026-09-16T02:08Z–2026-09-16T02:22Z

Sweep this run: **repo-hygiene** (rotation position 3 of 4, assigned by `next-sweep.mjs`, not chosen).

## GROUND

```
UTC            2026-09-16T02:08Z
origin/main    d506ebf1            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ d506ebf1     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE** — full authority for the run, inside 04's read-only lane.

Tree read in: the **dev tree** `C:\ProjectOperations2`. All three binding documents were verified
byte-identical to `origin/main` before being read from the working copy, with the sound probe
(§9.1 — never a piped hash):

```
git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
  -> EMPTY   (= not different; this is the real answer)
```

**SIGHTED RUN.** Desktop Commander reached the box: `start_process` shell `powershell.exe` returned
`LAPTOP-E6NHU4E4`, `2026-09-16T12:10:25.1519234+10:00`, host PS `5.1.26100.9444`. This was **not** a
blind run and nothing here is substituted from GitHub-side reads.

**vm-git-guard installed, last line quoted verbatim** (PREFLIGHT step 1, pass):

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

(preceding line: `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and
mounted cwd, allows everything else (three controls passed)`)

**status-sweep.ps1 verdict, re-read from the captured file** (captured with `*>`, decoded `utf16le`
per §9.3 — the capture was confirmed UTF-16LE, 431 lines):

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Section 0 instrument controls both PASS (`gh` reached GitHub, saw merged #1977; `node` runs). No
`[BROKEN]` anywhere in the report.

## WHAT I MEASURED

Fresh negative-control needle minted for this run, per §9.6: `zzQq04Needle20260916T0211`. It is
**spent** the moment this file lands — the next run mints its own.

### The board trap — 04's own red rule. CLEAN.

`[MEASURED]` `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`, filtered to depth 1
(trailing slash and `-r` both present, per §9.2):

| | count |
|---|---|
| tracked under `docs/pr-prompts/` (recursive) | 1226 |
| tracked at depth 1 | 51 |
| **tracked `*-ready.md` at depth 1 — THE BOARD TRAP** | **0** |
| POSITIVE control, tracked `*-HOLD.md` at depth 1 | 36 |
| NEGATIVE control, the minted needle | 0 |

A zero with a 36-strong positive control beside it. No tracked ready-file can re-arm executed work
from a checkout.

### Queue root on disk — 59 files at depth 1

`[MEASURED]` `Get-ChildItem docs\pr-prompts -File`: `ready=0`, `HOLD=33`, `LOOPING=0`,
`disarmed=0`, `00-*` breadcrumbs `=14`, plus the register/schema files and **three stranded
`*-ready.md.log` files** (F5 below).

### Tracked HOLDs whose work has already shipped — ZERO, and the instrument was proved able to say otherwise

`[MEASURED]` `scripts\pipeline\triage-holds.ps1` (read-only, 04's own script):

```
=== TOTALS  spent=0 of 33 evaluated  gates-satisfied=1  still-gated=32  unreadable=0
    SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture, so the SPENT bucket is measurable.
    This script re-probed those 32 REJECT(s) directly: 0 spent behind a REJECT, 32 still needed, 0 UNMEASURABLE.
```

Both spent buckets empty, with the fixture control proving the SPENT bucket is reachable. Nothing to
retire to `superseded/`.

### The §9.5 verdict-home-resolver probe — RE-RUN, and it did NOT falsify

§9.5 states *"`git ls-remote --heads origin` still holds all four closed-unmerged branches; if a
fifth `*verdict-home-resolver*` head appears, this count is wrong again."*
`[MEASURED]` from `git ls-remote --heads origin`: `feat/verdict-home-resolver`,
`feat/verdict-home-resolver-v1`, `fix/verdict-home-resolver-v1`, `fix/verdict-home-resolver-v1-impl`
= **FOUR**, no fifth. The bullet stands as written.

### A mojibake that is NOT damage — §9.3's false-mojibake trap, met live

`Get-Content` rendered `pr-transport-capacity-column-order-HOLD.md` with `m�� �?"` sequences, the
exact signature §9.3 warns is usually in the READER. Checked in the bytes with node before calling
anything corrupt:

```
bytes=8374  U+FFFD_count=0  doubleEncoded_a_hat_euro=0  BOM=false
```

**The file is clean UTF-8.** `[MEASURED]`. Recorded here rather than as a finding precisely because
the available write-up — *"a tracked prompt is byte-damaged"* — would have been wrong, and §9.3 is
the only reason it was checked.

### Uncommitted deletions in the dev tree — real, and in-flight by design

§9.2 forbids reading a ` D` from `git status` as evidence; the probe is the numstat against
`origin/main`, where EMPTY is the real answer. `[MEASURED]`, POSITIVE control
(`docs/pipeline/DOCTRINE.md`) → **0 rows**:

| path | numstat |
|---|---|
| `docs/pr-prompts/pr-crmvis-s2-relationships-HOLD.md` | `0 119` — real deletion |
| `docs/pr-prompts/pr-ratescol-s3-add-in-grid-HOLD.md` | `0 136` — real deletion |
| `docs/pr-prompts/pr-scopecards-s1-operational-costs-priced-HOLD.md` | `0 242` — real deletion |

All three are prompts the watcher consumed building the currently-open #1971, #1978/#1979 and #1967.
This is the normal in-flight state, **not** a defect — named here only so Station 00's next board PR
sweeps the deletions up.

### No locks anywhere

`[MEASURED]` `index.lock` absent in both `C:\ProjectOperations2\.git` and
`C:\po-watcher\ProjectOperations\.git`. Scoped git processes touching our trees: **0**. Nothing to
classify stale.

## WHAT CHANGED

Two working-copy changes in the dev tree, both deliberate, **neither committed** — 04 may not commit
to the shared dev tree:

1. **`docs/pipeline/sweep-rotation.json`** — advanced with
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-16T02:19:05Z`, exit 0, output
   `advanced: last_index=2 last_run_utc=2026-09-16T02:19:05Z`. Read back:
   `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2 2`. **LEFT DIRTY —
   Station 00 commits it.** If it is not committed, the next run repeats repo-hygiene and the
   rotation silently stops.
2. **This breadcrumb**, written to the tracked path `docs/pr-prompts/`. Untracked until a board PR
   carries it.

**Nothing on the board was mutated.** No prompt armed, disarmed, renamed, moved or deleted; no
worktree pruned; no branch deleted; no stash dropped; no PR touched; no label changed; no `/sot/`
edit.

## FINDINGS

### F1 — The sweep's `PRESERVE OR COMMIT BEFORE PRUNING` warning is CONTENT-BLIND, and it has parked an orphaned worktree for 11.8 days over a file that was rescued 11.8 days ago

`status-sweep.ps1` §2 emits, on every run:

```
[LIVE]    orphaned worktree (aborted run leftover -- investigate/prune): C:/PR-Master/worktrees/po-vg  23c91ba9 [fix/no-rebase-while-checks-run]
[LIVE]       dirty=1 files  age=16938 min
[LIVE]       <-- HOLDS UNCOMMITTED WORK (1 file(s)). PRESERVE OR COMMIT BEFORE PRUNING; 'git worktree remove' will refuse, and --force would discard it.
```

The warning fires on a **file count**. It never asks what the file is. `[MEASURED]` this run:

| probe | result |
|---|---|
| `git -C C:\PR-Master\worktrees\po-vg status --porcelain` | `?? scripts/pipeline/check-pipeline-heartbeat.mjs` — one untracked file |
| worktree copy blob, `git hash-object <path>` (clean filter applied) | `9c4587fb` |
| `git rev-parse origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs` | `84ec92d4` |
| worktree file mtime | **2026-09-04T07:55:32Z** |
| `git log origin/main -- <that path>` | `d8efb66c` 2026-09-04T12:15:08Z — **"chore(pipeline): preserve check-pipeline-heartbeat.mjs rescued from an orphaned worktree (#1585)"**; then `992b2479` 2026-09-04T21:38:04Z — "feat(pipeline): wire up the heartbeat, and bound its pause (#1594)" |

**Content compared, never size** (§9.3): the blobs differ — but the direction is the whole finding.
The worktree copy predates `#1585` by four hours, and `#1585` is *literally the commit that rescued
this exact file out of an orphaned worktree*. `#1594` then developed it further. So the blobs differ
because **main moved on**, not because the worktree holds unshipped work. The file was saved on
2026-09-04 and the warning has been telling every run since to preserve it again.

🔴 **This is §9.6's shape with the polarity that costs nothing loudly and everything quietly.** The
warning is *true as written* — there is an uncommitted file — and *false in effect*: it asserts a
data-loss risk that was discharged twelve days ago, and it fails in the direction of **never
cleaning up**, so the orphan is permanent by construction. Every run re-reads it, re-reasons about
it, and correctly declines to prune. `age=16938 min` is the receipt for how long that has cost.

**RULE 1, complete-and-additive first.** (a) **Give the warning a content test** — before claiming
uncommitted work, compare each untracked file's `git hash-object` against
`git rev-parse origin/main:<path>`, and when the path *exists on main at all*, say so and name the
commit, so the reader is told "a newer version of this is already on main" instead of "you may
destroy work". Solves it immediately (this orphan stops being sticky) and in future (every later
orphan gets the same test), and damages nothing — it only ever *adds* information to a warning that
currently has none. (b) Prune `po-vg` by hand now: fixes this occurrence, fails the *future* half —
the next aborted run reproduces it exactly. (c) Drop the warning: fails the *without-damaging* half
outright; the warning is the only thing standing between a real unshipped file and `--force`.

The repair is `scripts/pipeline/status-sweep.ps1`, which is outside 04's lane to change.

**DISPATCHED** → Station 00: option (a) as a staged prompt against `status-sweep.ps1`, and the
separate one-off decision on whether to prune `po-vg` now (its branch
`fix/no-rebase-while-checks-run` is **not on the remote at all** — `git ls-remote --heads origin`,
17 heads, no match — so nothing on GitHub depends on it).

### F2 — The `pr1823` worktree is a pure orphan: clean, merged five days ago, head branch already deleted from the remote

`[MEASURED]`:

| probe | result |
|---|---|
| `git worktree list` | `C:/PR-Master/worktrees/pr1823  9664f95a [feat/ea-gate-reporting-team-permission]` |
| sweep | `dirty=0 files  age=8880 min` (6.2 days) |
| `gh pr view 1823 -R GH-Mantova/ProjectOperations --json number,state,mergedAt,headRefName` (exit 0) | `{"state":"MERGED","mergedAt":"2026-09-11T02:57:48Z","headRefName":"feat/ea-gate-reporting-team-permission"}` |
| `git ls-remote --heads origin` | that branch **absent** — GitHub deleted the head on merge |

Nothing is at risk: zero dirty files, the work is on `main`, the remote head is gone. It is
registered against the **dev tree's** `.git`, which is why it shows in `git worktree list` from
`C:\ProjectOperations2`.

⚠️ **One caveat the next reader needs.** DOCTRINE §10.2.1's 2026-09-10 correction resolves the
identity `PR Supervisor <supervisor@local>` on commit `9664f95a` by saying *"`git worktree list`
shows one parked at exactly that SHA"*. That worked example is **this worktree**. Pruning it does
not invalidate the correction — the identity table and its falsifying probe (the two `git config`
reads) stand on their own — but the *worked example* stops being reproducible, so whoever prunes it
should say so in the PR body rather than leave a later reader to find the sentence dangling.

**DISPATCHED** → Station 00 (with Station 03 as the executing hand if 00 prefers): prune
`C:/PR-Master/worktrees/pr1823`, then `git worktree prune`. 04 is read-only and does not prune;
the rotation's own brief says *"REPORT ONLY … No agent bulk-deletes."*

### F3 — The watcher clone's stash loop is still closed, and it has grown to 77

DOCTRINE §9.2: *"`git stash` in the watcher clone is a CLOSED LOOP — the launcher's preflight stashes
on every start, and nothing ever pops. Report the count and its growth."*

`[MEASURED]` `git -C C:\po-watcher\ProjectOperations stash list`:

| | count |
|---|---|
| watcher clone stashes | **77** |
| dev tree stashes (contrast) | 0 |

DOCTRINE §9.5's 2026-09-10 bullet recorded **71** — explicitly tagged as state to re-measure, which
is what this row is. **+6 in six days**, i.e. about one per day, monotonic, with no consumer. Not
urgent and not dangerous today; it is a slow leak whose only symptom is the number.

⚠️ **Also re-derived, and it is the known-good half:** the sweep's
`watcher clone: branch=main dirty=1 <-- the watcher may refuse to start` is again the false warning
DOCTRINE §9.5 already records. `git -C C:\po-watcher\ProjectOperations status --porcelain
--untracked-files=no` → **EMPTY** (tracked-clean), against `git status --short` → **1**. The one file
is untracked, `start-watcher.ps1` ignores untracked, and a tracked-dirty clone auto-stashes rather
than refusing. **No dispatch on that line** — it is already documented, and re-routing it is the
mis-routed-dispatch failure §9.5 names.

**DEFERRED.** What would make it urgent: a stash that is *not* the launcher's preflight (i.e. one
carrying real work), or growth that stops tracking the restart count. `git stash drop`, never `pop`,
if anyone ever clears them.

### F4 — Remote-branch hygiene: 2 merged-but-not-deleted, 7 closed-unmerged retained, 1 that never had a PR

`[MEASURED]` from the authority — `git ls-remote --heads origin` (§9.2: `git branch -r` reads a local
cache and lies) — **17 heads**, each crossed against `gh pr list -R … --head <b> --state all`
(`-R` and `$LASTEXITCODE` tested on every call, per §9.4):

| class | count | branches |
|---|---|---|
| OPEN PR (correct, live) | 6 | `docs/sot02-inpr-snapshot-2026-09-15` · `feat/crmvis-s2-relationships` · `feat/ratescol-s2-column-settings-move-delete` · `feat/ratescol-s3-grid-add-column-row-guided-step` · `feat/ratescol-s3-grid-first-step` · `feat/scopecards-s1-operational-costs-priced` |
| **MERGED, head not deleted** | **2** | `chore/sweep-breadcrumbs-20260907-0934` (#1778, merged 2026-09-07) · `docs/st00-collect-2026-09-14-1108` (#1927, merged 2026-09-14) |
| CLOSED unmerged, head retained | 7 | `docs/slice-0-scope-cards-plan` (#1871) · `feat/crm-account360-v2-s1` (#1612) · `feat/verdict-home-resolver` (#1703) · `feat/verdict-home-resolver-v1` (#1707) · `fix/classify-policy-nested-tests` (#1571) · `fix/verdict-home-resolver-v1` (#1708) · `fix/verdict-home-resolver-v1-impl` (#1705) |
| **no PR, ever** | **1** | `fix1483` |

🔴 **Do NOT bulk-delete this list — at least two rows are load-bearing.** `feat/crm-account360-v2-s1`
is #1612's head, and the open escalation
`pr-1612-closed-unmerged-branch-holds-the-only-copy` exists precisely because that branch is the only
copy of that work. The four `*verdict-home-resolver*` heads are §9.5's own falsifying probe for the
kill-loop count (re-run above; still four). Deleting either set destroys evidence a live DOCTRINE
bullet depends on.

The genuinely clean candidates are the **2 merged** heads, whose content is on `main` by definition,
and `fix1483`, which wants a look before anything else — a branch with no PR in its whole history is
either abandoned scratch or someone's only copy, and the two are indistinguishable from the ref alone.

**DEFERRED.** What would make it urgent: the merged-head count growing enough to matter to anyone
reading the branch list, or `fix1483` turning out to hold unmerged content (one `git log
origin/main..fix1483` settles it, and I did not run it — see WHAT I DID NOT DO).

### F5 — Three `*-ready.md.log` files stranded in the queue root; one has no counterpart anywhere

`[MEASURED]` at depth 1 of `docs/pr-prompts/`:

```
pr-fv2-import-s2-review-route-b-ready.md.log                677 B  2026-09-15T01:14:13Z
pr-fv2-import-s2-review-route-c-ready.md.log                535 B  2026-09-15T01:14:38Z
pr-scopecards-s1-operational-costs-priced-b-ready.md.log    361 B  2026-09-15T07:00:36Z
```

All three are **gitignored** — `git check-ignore -v` → `.gitignore:26:*.log` on each; POSITIVE
control `git ls-files --error-unmatch docs/pipeline/DOCTRINE.md` → exit 0. So they dirty nothing and,
critically, **they cannot arm anything**: `.log` matches no watcher glob.

The odd row is the pairing. `failed/` holds a **different** log for the `-c-` attempt
(501 B, 2026-09-15T01:15:02Z) alongside its prompt and report — so the depth-1 copy is a superseded
leftover written 24 s before the quarantine. The `-b-` attempt's log has **no counterpart in
`failed/` at all**; nothing will ever file or clean it.

Low severity, and stated as such: this is litter, not a hazard. It earns a line because the
rotation's brief names *"superseded prompt files littering the queue root"* and because the queue
root is the one directory where a stray file is ever dangerous.

**DEFERRED.** What would make it urgent: a stranded artifact at depth 1 whose name ends `-ready.md`
rather than `-ready.md.log`. That one *would* match the watcher glob, and it is the board trap
arriving by a different door.

### F6 — `triage-holds` flagged a possible duplicate; it is a FALSE POSITIVE, and the flag came from the zero-precision case DOCTRINE §10.6 already names

`triage-holds.ps1` reported one CANDIDATE:

```
pr-transport-capacity-column-order-HOLD.md
    overlaps open PR #1967 (1 of 2) -- feat(tendering): scopecards S1 - operational costs become money
    matched scope entries: apps/api/prisma/migrations/**
```

The overlap is a **directory-form scope entry** against a migration-touching PR — §10.6's measured
*"precision is ZERO by construction"* case. The prompt carries **no `_V<n>` marker** (a wide
`[A-Z][A-Z0-9]{2,}(_[A-Z0-9]+)+` sweep returns only front-matter keys and a migration name), so it is
one of the 36-of-40 for which §10.6's marker test cannot run — which is exactly why §10.6's
2026-09-10 correction added the premise-at-head fallback.

`[MEASURED]` that fallback. The prompt's premise is
`! ls apps/api/prisma/migrations | grep -q "transport_capacity_column_order"`, evaluated at #1967's
head `10fec67f` via `gh api repos/GH-Mantova/ProjectOperations/contents/apps/api/prisma/migrations?ref=<headRefOid>`
(exit 0):

| probe | count | reading |
|---|---|---|
| migration dirs at that head | 254 | the probe returns a corpus |
| `transport_capacity_column_order` | **0** | **premise still TRUE ⇒ NOT this PR's work** |
| POSITIVE control, dirs matching `^2026` | 252 | the probe can match |
| NEGATIVE control, the minted needle | 0 | the probe is not matching everything |

**Verdict: NOT a duplicate**, settled by the instrument that exists on every prompt rather than the
one that exists on four in forty.

**ACTIONED** — the confirmation step §10.6 requires was run and is recorded here with its controls,
so the flag does not have to be re-derived. Note for whoever eventually arms it: this prompt is
`escalates: true` with `gate_allow: migrations`, so it is Marco's regardless, and ADMIT remains
necessary-not-sufficient.

## WHAT I DID NOT DO

- **Pruned nothing, deleted nothing, dropped no stash, deleted no branch.** 04 is read-only on the
  board and the rotation's brief is explicit: *"REPORT ONLY - stage a prompt for anything worth
  deleting. No agent bulk-deletes."* F1, F2 and F4 all end in a dispatch rather than a hand.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** The authority matrix gives 04 *Create a PR:
  NO* and *Mutate the board: NO, read-only*, and the dev tree is on `main`, which nobody commits to
  directly. It is left dirty and named above; **Station 00 commits it.**
- **Did not stage a prompt this run.** F1 is the only finding worth one, and its fix is a change to
  `status-sweep.ps1` — an instrument every station reads mid-run. A prompt authored against it from
  a report rather than from the script's own control set is how a cure acquires a second trap; 00
  owns that script's lane and should author it with the sweep in front of it. Budget was 2 staged
  prompts; 0 used, deliberately.
- **Did not run `git log origin/main..fix1483`.** It would have settled whether that PR-less branch
  holds unmerged content (F4), and it is one command. I stopped because the finding is already
  DEFERRED and the answer changes nothing this run — but it is the first thing to run if anyone
  picks F4 up, and I would rather name the gap than have the next reader assume it was checked.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site visual patrol).** The station doc
  takes ONE named sweep per run and covers it completely; `next-sweep.mjs` assigned repo-hygiene and
  a shallow pass over everything is the failure mode the rotation exists to prevent. Live-site work
  is unattempted, not blocked — it simply was not this run's sweep.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.** Nothing this run went near them.
- **Did not re-route the sweep's `clone dirty=1` line to Station 03.** It is DOCTRINE §9.5's already
  documented false warning, and re-dispatching it is the mis-routed dispatch that bullet was written
  to stop. Re-derived and recorded under F3 instead.
