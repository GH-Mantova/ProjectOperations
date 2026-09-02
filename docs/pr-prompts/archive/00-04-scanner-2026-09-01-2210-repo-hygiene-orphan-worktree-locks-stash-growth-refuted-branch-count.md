# Station 04 — Scanner | 2026-09-01T22:10Z–2026-09-01T22:25Z

Sweep: **repo-hygiene** (rotation position 3 of 4, assigned by `next-sweep.mjs`; previous run
2026-09-01T18:10:46Z). Covered completely: orphaned worktrees and their locks · stash growth in the
watcher clone · superseded prompt files in the queue root · tracked `*-ready.md` at depth 1 (the
board trap) · branches merged but not deleted · HOLD files tracked on main whose work has shipped.

## GROUND

```
UTC            2026-09-01T22:10:48Z
origin/main    6583a220            (git fetch origin --quiet; exit 0; then rev-parse)
dev tree       main @ 6583a220     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** — full authority this run. Station was **SIGHTED**: Desktop
Commander `start_process` (shell `powershell.exe`) returned on the first call. `git diff --name-only
origin/main -- docs/pipeline/` returned **empty**, so the working copies of DOCTRINE,
STATION-CAPABILITIES and this station's doc are byte-current with `origin/main` and the preflight
read was valid.

## WHAT I MEASURED

**Locks first, as standing protocol requires.** [MEASURED]
`Get-ChildItem .git\index.lock,.git\MERGE_HEAD,.git\REBASE_HEAD,.git\CHERRY_PICK_HEAD` → **none**.
`Test-Path C:\ProjectOperations2\.git\index.lock` → **False**; same for the watcher clone → **False**.
`(Get-Process git).Count` → **0**. Neither shared tree is frozen.

**Board trap — CLEAN.** [MEASURED]
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` → **641** paths (positive control: the
query is not returning a false zero; §9.2's no-glob, always-`-r` rules were obeyed and the pathspec
carries a trailing slash). Filtering to depth 1: **76** tracked files, of which **0** are
`*-ready.md` and **69** are `*-HOLD.md`. On disk at depth 1: **76** `.md`, **0** ready, **69** HOLD.
Tracked set and disk set agree exactly. No armed prompt is tracked on `main`; a checkout cannot
re-arm executed work today.

**HOLD files whose work has already shipped — NONE.** [MEASURED]
`triage-holds.ps1` → `TOTALS spent=0 gates-satisfied=39 still-gated=30 unreadable=0 of 69`, exit 0,
and it reported both controls: two distinct verdicts observed on the live board (ADMIT, REJECT) and
`SPENT` additionally proved reachable by its fixture control. So `spent=0` is a measured absence,
not a blind one. (Prior reading was 0/40/30 of **70** — the delta is
`pr-station-docs-wrong-wrapper-and-false-gitignore-claim`, armed 20:15Z and consumed into #1500.
These are STATE: re-measure, never quote.)

**Queue root — CLEAN.** [MEASURED] The 7 depth-1 files that are neither HOLD nor ready are all
legitimate residents: `BACKLOG.yaml`, `BACKLOG-DECISIONS.md`, `ESCALATIONS.yaml`,
`PROMPT-SCHEMA.md`, `TEMPLATE-sot-reconcile.md`, `shepherd-state.md`, and 00's 20:09Z breadcrumb
(landed in #1501, not yet archived — normal). No superseded prompt is littering the root.
`superseded/` holds 267 tracked files, `archive/` 259.

**Watcher clone.** [MEASURED] `rev-parse --short HEAD` → `6583a220`, identical to `origin/main`; not
behind. `git status --porcelain` → one line, `?? docs/pr-reviews/pr-1500-review.md` — an untracked
review artefact, benign, and incidental evidence that a review job did run against #1500.

**Crash-loop artefacts are historical, not live.** [MEASURED] The 30
`WATCHER-CRASH-LOOP-2026-09-01-*.md` files in `needs-marco/` span
`2026-09-01T09:55:49Z` (oldest) to `2026-09-01T12:14:10Z` (newest) by `LastWriteTimeUtc`. Now is
`2026-09-01T22:13:42Z` — **ten hours of quiet**. The loop escalation #19 describes has stopped; what
remains is its litter. The filenames read as `2026-09-01-221410` because they are stamped in
**local** Brisbane time (UTC+10), which is 12:14:10Z — a reader taking them as UTC would conclude the
loop was still running minutes ago.

**Instrument note.** `status-sweep.ps1` classifies a worktree whose path does not exist on this host
as `age=-1 min`, `dirty=0` ⇒ **orphaned**, not LIVE (`:170-178`). That is the honest reading and it
does **not** produce a false CAUTION verdict — the sweep printed `SAFE TO ACT` at 22:12:51Z with both
orphans present. `age=-1` is the signature of a registered path this host cannot see.

## WHAT CHANGED

**Nothing on the board.** Station 04 is read-only on the board and armed, disarmed, moved, renamed,
merged and deleted nothing. Two writes, both outside the board:

1. This breadcrumb, at the tracked path `docs/pr-prompts/00-04-…`. It is **untracked until a board
   PR commits it** — Station 00 sweeps it up.
2. `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-01T22:10:48Z`, which advances
   `docs/pipeline/sweep-rotation.json` to position 4. That file is **tracked and now dirty in the
   shared dev tree** — 00 should commit it alongside this breadcrumb. Flagged here deliberately
   because the dev-tree index is shared between concurrent chats (§9.2) and a stray dirty tracked
   file is exactly what gets swept into someone else's commit.

## FINDINGS

### F1 — Two orphaned worktree registrations, each holding a 0-byte `index.lock`, and `prune` cannot clear either

[MEASURED] `git worktree list` in the dev tree returns three entries. Two are not on this machine:

```
/sessions/rcw-019qxzb7xwsnipqvw9og12p9/mnt/po-worktrees/stage-brandtheme-083750  755255ab [stage/brandtheme-s1-s2]     locked
/sessions/rcw-019qxzb7xwsnipqvw9og12p9/mnt/po-worktrees/stage-bt-084105          755255ab [stage/brandtheme-s1-s2-v2]  locked
```

`Test-Path` on the first path → **False**. Both `gitdir` files point at `/sessions/rcw-…/.git`, a
**Linux** path: these were created by a second lane running `git worktree add` against the Windows
`.git` through a mount — the operation DOCTRINE §9.2 forbids outright.

[MEASURED] Each admin directory holds a **0-byte `index.lock`**:

```
C:\ProjectOperations2\.git\worktrees\stage-brandtheme-083750\index.lock  0 bytes  2026-09-01T08:37:52Z  (13.57 h old)
C:\ProjectOperations2\.git\worktrees\stage-bt-084105\index.lock          0 bytes  2026-09-01T08:41:08Z  (13.52 h old)
```

with `(Get-Process git).Count` = **0**. By the station contract's own test — 0 bytes, hours old, no
git process, and no `MERGE_HEAD`/`REBASE_HEAD`/`CHERRY_PICK_HEAD` — these are **STALE**. This is the
device-bridge signature that froze every station three times in two days, and §9.6 applies exactly:
the process that would have held them ran in a VM that no longer exists, so "no process is holding
it" will read true **forever**.

[MEASURED] Each `locked` file contains the single word `initializing` — `git worktree add` never
finished. [MEASURED] `git worktree prune --dry-run -v` returns **empty**. [INFERRED] git skips
locked worktrees during prune, so the routine cure is a no-op against these two and they will be
re-reported as "investigate/prune" by every sweep, every run, indefinitely.

**Blast radius, stated precisely.** These locks are in `.git\worktrees\<name>\`, **not** in
`.git\index.lock`, so they are **not** freezing the dev tree today (measured False/False above), and
`status-sweep.ps1` correctly reached `SAFE TO ACT`. But `status-sweep.ps1:233-234` tests only
`$Repo\.git\index.lock` and `$WatcherClone\.git\index.lock`, and `:214` tests `.git\index.lock` only
inside Windows registry-escapee directories — **nothing in the sweep looks at
`.git\worktrees\*\index.lock`.** These two were found by hand, not by an instrument, and the next
pair will be too.

**DISPATCHED → Station 03 (Machine-minder), folded into the existing clone-hygiene dispatch.**
The remediation is `git worktree unlock <path>` then `git worktree prune`, or
`git worktree remove --force <path>`, for both registrations; the working trees themselves do not
exist on this host so nothing on disk is lost. 03 is report-only on machines, so if this needs a
mutation it comes back to 00. The sweep's blind spot is a second, separate item: a one-line addition
to `status-sweep.ps1` §7's lock probe to recurse `.git\worktrees\*\index.lock` and report byte size
and age. I did not stage it as a prompt — it edits `scripts/`, which lands outside `tests/|docs/` and
so becomes another Marco-routed PR on an already-Marco-saturated board; 00 should decide whether it
is worth that cost.

### F2 — The watcher clone's stash pile is 64 and grew by 9 in the last 24 hours

[MEASURED] `git -C C:\po-watcher\ProjectOperations stash list` → **64** entries. Oldest
`2026-07-14T08:44:31+10:00`, newest `2026-09-01T21:25:04+10:00` (= 11:25Z). Counting by parsed date:
**9 in the last 24 h, 10 in the last 48 h.** Two of the newest are 80 seconds apart
(21:23:44 and 21:25:04 local), which is the preflight firing once per restart — the crash-loop
signature, and it matches F5's incident window.

This is DOCTRINE §9.2's named closed loop: `watcher-launcher` stashes on every start and nothing ever
pops. The average over the 49-day life of the pile is ~1.3/day; the last day ran at **9/day**. The
dev tree's own stash count is **11** (unchanged, and a working positive control that the command
reads a non-zero pile when one exists).

**DISPATCHED → Station 03.** `git stash drop`, **never `pop`** — popping replays 49 days of
abandoned working states into a clone the watcher builds from. Nothing here is urgent; it is growth
that should be measured every hygiene sweep so the rate stays visible.

### F3 — Escalation #14's "22 undeleted origin branches" is REFUTED as stated, and the real number is 1

[MEASURED] Asking the **remote** (`git ls-remote --heads origin`, per §9.2 — never `git branch -r`):
**26** branches exist on `origin`, 25 of them non-`main`.

[MEASURED] `gh pr list --state merged --limit 2000 --json number,headRefName,mergedAt` → **1467**
rows (well under the limit, so not truncated). Intersecting head-ref names against the 25 real
branches gives **merged-but-not-deleted = 1**:

```
#1145  2026-08-17T05:01:04Z  docs/retire-stale-queue
```

Positive control for the lookup, because a near-zero result demands one: of the 43 phantom local
refs (F4), **37 have a PR** in the same hashtable; the negative control `zzzNoSuchBranch` returns
False. The table is populated and the `1` is real.

[MEASURED] Classifying all 25 against `gh pr list --state all --limit 3000` (1501 rows, 1492 distinct
head refs): **22 CLOSED · 1 MERGED · 2 OPEN** (`feat/scope-s2-wbs-table-shell` = #1483,
`fix/station-docs-drift-launcher-and-qa-gitignore` = #1500).

So the "22" in the escalation is a real number attached to the **wrong category**. They are not
merged work whose branch was left behind; they are **22 branches whose PR was closed unmerged** —
abandoned work, some of it a year old (#396, #599, #605, #606, #632). Three are
`worktree-agent-<hex>` branches (#978, #1359, #1433), i.e. agent-lane leftovers. One is worth a
second look on its own: `feat/cp26-approval-receipt` = **#1493 CLOSED**, while the CP-26 receipt
actually shipped as **#1492** — two PRs for one piece of work, a second-lane duplicate.

**ESCALATED → Marco.** Branch deletion is irreversible (DOCTRINE §5.4) and for a closed-unmerged
branch the branch **is** the only remaining copy of that work. Options, complete-and-additive first:

- **(A) Tag, then delete.** For each of the 22, create an annotated tag
  `abandoned/<branch>@<sha>` on the current tip and push the tags, then delete the branches. Passes
  both halves of RULE 1: the queue stops carrying 22 dead heads (solves it now and for future
  sweeps), and **nothing is destroyed** — every commit stays reachable through its tag, so no
  existing or future work is damaged. Cost: 22 tags, one scripted pass, fully reversible.
- **(B) Delete outright.** Fails the *without damaging* half. Once the ref is gone the commits are
  unreferenced and a `gc` can collect them; #396 and the `docs/*` set from June/July would be
  unrecoverable.
- **(C) Leave them.** Fails the *solves it completely* half. Zero risk, but every future hygiene
  sweep re-reports the same 22 and the signal stays buried, which is how this one arrived wearing the
  wrong label.

I have not touched any branch. Only `docs/retire-stale-queue` (#1145) is unambiguously safe under any
option, since its content is already on `main`.

### F4 — 43 phantom remote-tracking refs in the dev tree, and the count is growing

[MEASURED] `git branch -r` → **69** entries; `git ls-remote --heads origin` → **26**. Difference:
**43 refs pointing at branches GitHub deleted on merge.** The watcher clone carries **44** by the
same query. A prior reading recorded 38; it is now 43, so this grows monotonically with every merge.

This is §9.2's named trap with a measured consequence: any station reading `git branch -r` sees 69
branches against a truth of 25 — a **176% overcount** — and any finding built on that list inherits
the error while looking like a measurement. It is also what makes an honest question ("how many
branches are we leaving behind?") produce the wrong answer, which is plausibly how F3's mislabelling
happened in the first place.

**DISPATCHED → Station 03.** `git fetch --prune` in both the dev tree and the watcher clone. This
touches **only the local cache** — it deletes nothing on `origin` and is not the irreversible action
in F3. It is safe, cheap, and should be standing behaviour rather than a finding; the fetch inside
`status-sweep.ps1` and the launcher preflight would both be better spelled `fetch --prune`.

### F5 — 30 of the 39 files in `needs-marco/` are one already-diagnosed incident

[MEASURED] `needs-marco/` holds **39** files. **30** are `WATCHER-CRASH-LOOP-2026-09-01-*.md` and
**1** is `WATCHER-CHURN-2026-09-01-221528.md` — all from a single loop that ran 09:55:49Z→12:14:10Z
and has been quiet for ten hours. The human escalation queue is therefore **8 items**, not 39, and
the "39" is quoted as a queue depth by the sweep and by memory.

`needs-marco/` is gitignored (`.gitignore:76-83`), so these exist on this box and nowhere else; a
clone, CI and any cloud-fired station cannot see them at all.

**DISPATCHED → Station 00**, on the same footing as the eight `[STALE]` discharges already in
flight: **move** the 31 machine-generated files to `needs-marco/discharged/`, never delete — the
incident is escalation #19's evidence and #19 is still open. Nothing about the underlying keepalive
defect is fixed by this; it only stops one incident's paperwork from dominating the count that tells
a reader how much is waiting on Marco.

### F6 — One untracked, non-ignored file will show as `??` in the dev tree forever

[MEASURED] `superseded/` holds 280 files on disk against 267 tracked. Twelve of the thirteen extras
are `*.md.log` watcher run logs from June/July, and `git check-ignore -v` returns
`.gitignore:26:*.log`, exit 0 — genuinely ignored, invisible, harmless. The thirteenth,
`docs/pr-prompts/superseded/pr-doctrine-s9-four-false-traps-LOOPING.md` (2026-08-26), returns
**exit 1, empty** — not ignored and not tracked. Per §9.2 the file form is the only form of this
query that answers, and its positive control fired on the `.log` case in the same call.

**DEFERRED.** It is one prompt-shaped file in a superseded folder; it costs a permanent `??` line in
`git status` and nothing else. It becomes urgent only if someone reads the queue's untracked set as
the arming set — which is the third trace-free arming path already on the board. The cure is one
line in a board PR: either `git add` it or delete it, whichever 00 judges. I did not do it, because
a prompt file is board state and this station does not move board state.

### F7 — A concurrent Station 00 was BLIND on this host at the same minute I was SIGHTED, and its breadcrumb is malformed

Found incidentally: `check-breadcrumb.mjs`, run to validate my own file, **exits 1** because a third
breadcrumb appeared during my run.

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs` →
`structure: 3 checked, 1 malformed, 0 skipped` · `REJECT: 1 malformed breadcrumb(s)` · exit **1**.
My file: `ADMIT`. 00's 20:09Z file: `ADMIT`. The rejected one is
`00-00-supervisor-2026-09-01-2210-blind-third-recurrence-local-stdio-narrowing.md`, missing **all
five** contract sections — it is organised as `## 1. Preflight` / `## 2. Findings` instead of
`## GROUND` / `## WHAT I MEASURED` / `## WHAT CHANGED` / `## FINDINGS` / `## WHAT I DID NOT DO`.
`check-breadcrumb.mjs` runs in CI under `pipeline-tests`, so **the next board PR that commits
`docs/pr-prompts/` will carry a red `pipeline-tests` job** until that file is either reshaped or left
out of the commit. Both untracked files were also flagged `is UNTRACKED — it reaches nobody until a
board PR commits it`.

**The blindness evidence is the more important half.** [MEASURED] That breadcrumb's own header reads
`2026-09-01T22:05–22:12Z — BLIND RUN (third of the day)`, with
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): … timed out after 30000ms`. My first
call this run — `start_process`, shell `powershell.exe` — **succeeded at 2026-09-01T22:10:48Z**,
which is *inside* that window, on the same box, against the same tree.

That is a cleaner instance of escalation #17's narrowing than the 10:05–10:12Z / 10:10:55Z pair
already on record: the two sessions did not merely overlap on the same host that hour, they were
**live in the same seven-minute window**, one blind and one sighted. The fault therefore cannot be a
property of the machine, of Desktop Commander being down, or of the hour — it is a property of the
**session's own MCP launch**, which is exactly what 00's F2 concludes from the other side. Two
independent stations, opposite results, same minute.

**DISPATCHED → Station 00** (its own artefact, and stations do not rewrite each other's): reshape
that breadcrumb to the five contract sections before committing it, or commit it with a pathspec that
excludes it. **ESCALATED → Marco** for the underlying item only in the sense that escalation #17 is
already his and this run adds evidence, not a new question — the A/B/C options in
`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` are unchanged, and
A and B are not exclusive. What is new and worth recording against them: a same-window sighted
control now exists, so any fix proposed for #17 can be tested against a reproducible discriminator
rather than a 40%-of-runs frequency.

## WHAT I DID NOT DO

- **Nothing on the board.** No arm, disarm, rename, move, delete, merge or label. `armed: 0` before
  and after; `triage-holds.ps1` confirms it mutated nothing either.
- **No throwaway worktree.** Every `origin/main` read was `git ls-tree` / `git show` against a named
  SHA, per the 2026-08-24 supersession of the CLEAN-TREE MANDATE. Minting one to "get a clean read"
  is precisely how F1's two orphans came to exist.
- **Cleared no lock.** The two stale `index.lock` files in F1 remain exactly as found. Clearing a
  lock is Station 03's, on 00's dispatch, and neither is freezing anything today.
- **Deleted no branch, dropped no stash, pruned no ref, moved no `needs-marco/` file.** All four are
  mutations owned by another station or by Marco; F1–F5 hand them over rather than performing them.
- **Did not stage a prompt.** My budget of two was unspent. The one candidate — the
  `status-sweep.ps1` lock-probe blind spot in F1 — edits `scripts/`, which lands outside
  `tests/|docs/` and becomes another Marco-routed PR on a board where that is already the binding
  constraint. That trade is 00's to make, not mine, so I described the change instead of arming a
  claim on Marco's queue.
- **Did not re-open #1483, #1500 or escalation #20.** They belong to 00's live stanza and to this
  run's sweep only incidentally; the one thing I can add is measured and recorded above — the watcher
  clone carries an untracked `docs/pr-reviews/pr-1500-review.md`, so #1500 was reviewed.
- **Did not repair 00's malformed breadcrumb (F7).** Reshaping another station's artefact would put
  my words under its name in the one channel that closes, and the run that wrote it is the run that
  knows what it measured. It is reported, not fixed.
- **Ran no Part 0 / Part 1 / Part 2 pass.** The rotation assigned repo-hygiene and the contract says
  cover one sweep completely rather than pass shallowly over everything.
