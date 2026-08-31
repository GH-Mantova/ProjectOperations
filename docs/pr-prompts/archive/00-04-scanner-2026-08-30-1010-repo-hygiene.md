# Station 04 — Scanner | 2026-08-30T10:10:48Z–2026-08-30T10:36Z

## GROUND

```
UTC            2026-08-30T10:10:48Z
origin/main    62fd27f1              (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ 62fd27f1       C:\ProjectOperations2   (converged, 0 ahead / 0 behind)
doc version    1                     (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                     (scheduled-task SKILL.md station_doc_version)
```

Doc version and bootstrap AGREE — full authority, not read-only-degraded.

SIGHTED run. `start_process` shell `powershell.exe` succeeded (PID 36628). Desktop Commander
present. This was **not** a blind run.

Sweep this run, from `node scripts/pipeline/next-sweep.mjs`: **repo-hygiene** (rotation position
3 of 4; previous run 2026-08-30T06:11:04Z). Advanced on completion to `instruction-drift`.

Binding docs read in full this run: `DOCTRINE.md`, `STATION-CAPABILITIES.md`, `04-scanner.md`.
`git diff --stat origin/main --` over all three returned **empty, exit 0** — the working copies
are byte-equal to `origin/main`, so reading them from disk was equivalent to `git show`.

## WHAT I MEASURED

**Board gate.** `status-sweep.ps1` → `SAFE TO ACT`, exit 0, `SWEEP COMPLETE 2026-08-30 10:11:36Z`.
[MEASURED]

🔴 **Station 00 was running CONCURRENTLY with this run.** [MEASURED] `git worktree list` shows
`C:/po-worktrees/sup-1009` at `62fd27f1` (detached), admin dir `.git/worktrees/sup-1009` created
`2026-08-30 20:11:45` local = **10:11:45Z — 9 seconds AFTER the sweep printed SAFE TO ACT, 57
seconds into my run.** `gh pr list --state open` → **#1402 `docs/sup-1009-gh-run-short-sha`**, open.
This is the §7 "[LIVE] means true when measured" case, caught live: the verdict was already stale
when it printed. No collision occurred — I took no board mutation and staged nothing — but the
shared dev-tree index was checked before and after every step (`staged=0` at both ends).

**Arming state.** `-ready.md` on disk at depth 1 = **0**. [MEASURED] The OAuth block holds.

**Board trap — tracked `*-ready.md` at depth 1 on `origin/main` = 0.** [MEASURED]
`git ls-tree -r --name-only origin/main -- "docs/pr-prompts/"` → 558 paths; 228 at depth 1;
**0** ending `-ready.md`. Positive controls on the same query, same run: depth-1 `-HOLD.md` = **59**
(matches the independently-recorded 59), `superseded/*` = **250**. The zero is a real zero, not
§9.2's trailing-slash blindness.

**Worktrees.** Dev tree: 2 (`C:\ProjectOperations2`, plus 00's live `sup-1009`).
`git worktree prune --dry-run -v` → empty. No `locked` files. Watcher clone: 1, prune empty.
**No orphans, no stale worktree locks.** [MEASURED]

**Locks / merge state.** Watcher clone `.git`: no `index.lock`, `MERGE_HEAD`, `REBASE_HEAD`,
`CHERRY_PICK_HEAD`. [MEASURED]

**Watcher-clone stash = 51.** [MEASURED] `git -C C:\po-watcher\ProjectOperations stash list`.
Newest entry `2026-08-29T00:42:55+10:00` = 2026-08-28T14:42Z — **no growth in ~44 h**, consistent
with the watcher not consuming prompts under the OAuth block. §9.2's closed loop; recording 51 as
the baseline the next hygiene sweep should difference against.

**Watcher-clone dirty = 35.** [MEASURED] Known permanent amber (verdict-archive moves tracked files
out without committing) — reported for continuity, not as news.

**`triage-holds.ps1` read in full (29 lines, its only revision).** [MEASURED] See F1.

**Instrument note.** §9.1 reproduced live: `-Command "... $LASTEXITCODE"` was stripped to
`... ` and died as `ExpectedValueExpression`. Every probe after that was run from a `.ps1`
via `-File`. §9.3 also reproduced: `git show <ref>:<path> > file` produced 69712 bytes for a
~34 KB blob and a hash that matched nothing — `git diff` was used instead.

## WHAT CHANGED

1. `docs/pipeline/sweep-rotation.json` — advanced. `node scripts/pipeline/next-sweep.mjs --advance
   --utc 2026-08-30T10:10:48Z`, exit 0, `advanced: last_index=2 last_run_utc=2026-08-30T10:10:48Z`.
   **Read back:** a fresh `next-sweep.mjs` now returns `SWEEP: instruction-drift (rotation position
   4 of 4; previous run: 2026-08-30T10:10:48Z)`. The rotation turned.
2. This breadcrumb, written to the dev tree at `docs/pr-prompts/`.

Both are **modified/untracked and deliberately NOT staged or committed** — Station 00 was mid-run
with an open PR on the shared index (see WHAT I MEASURED). `git diff --cached --name-only` = 0 lines
before and after. Station 00 sweeps both up.

Nothing else changed. No prompt armed, renamed, moved, deleted or staged. No merge. No push.

## FINDINGS

### F1 — `triage-holds.ps1` does not triage HOLDs. It checks two hardcoded PR numbers. S2.

The script's own first line reads: *"Triage the HOLD queue. Read-only. **Proves which HOLDs are
already satisfied.**"* It does nothing of the kind. [MEASURED — full source read, all 29 lines]

Its entire HOLD logic is:

```powershell
foreach ($n in 545, 548) { gh pr view $n --json "state,title" ... }
```

**Two hardcoded PR numbers.** Zero references to `docs/pr-prompts/`, zero `Get-ChildItem`, zero
glob, zero premise evaluation. It examines **0 of the 59** depth-1 HOLDs and **exits 0** — so it
cannot fail, and its green reads as "HOLD queue triaged, nothing satisfied that shouldn't be."
This is §7's exact shape: *a check never seen to fail is not a check.*

Corroborating measurements:
- `Select-String '#545|#548'` across `docs/pr-prompts/*-HOLD.md` → **no hits.** There is no HOLD
  file referencing either PR. The "shepherd-merge HOLDs" its header names do not exist. [MEASURED]
- Both PRs are long settled: #545 MERGED, #548 MERGED. [MEASURED, this run]
- Its second section asks "is there anything left for `pr-zzz-resolve-all-dirty-prs`?" — that
  prompt is **not present on `origin/main`.** Positive control on the identical query: `dns-s5` →
  1 hit, so the query works. [MEASURED]
- **It was never anything else.** `git log -- scripts/pipeline/triage-holds.ps1` returns exactly
  ONE commit, `d5bd4f58` (2026-07-24). Re-reading the file at that SHA: 27 lines,
  hold-enumeration-hits = **0**. It has been misnamed for **37 days**, not broken by a regression.
  [MEASURED]

**Blast radius — two documents vouch for it by name, in the words it does not earn:**
- `docs/pipeline/SCRIPT-REGISTRY.md:80` — *"Read-only HOLD triage — proves which HOLDs are already
  satisfied. | Periodically; pairs with the backlog check."*
- `docs/pipeline/stations/04-scanner.md:340` — *"read-only HOLD triage; proves which HOLDs are
  already satisfied. Pairs with the backlog check."* (my own station doc)

So the false assurance is not incidental — it is written into the registry that DOCTRINE calls the
source of truth for scripts, and into a station's instrument list, over the exact population
(59 HOLDs) that arm-order and never-arm decisions run against.

**RULE 1 options, complete-and-additive first:**

**(A) Make the script do what its name says** — enumerate `docs/pr-prompts/*-HOLD.md`, evaluate
each one's `premise` / `requires_on_main`, and report satisfied-but-still-held. Passes both halves:
fixes the false assurance now, and gives the 59-HOLD board the triage instrument it has never had.
Additive — no existing file changes meaning, nothing is deleted.

**(B) Rename it to what it is** (`check-shepherd-prs.ps1`) and correct both citations. Passes the
*immediately* half — nothing claims false coverage any more. **Fails the *future* half:** the 59
HOLDs still have no triage instrument, and the gap becomes invisible again because no document
mentions it.

**(C) Delete it and drop both citations.** Fails the *future* half harder than (B), and loses the
one thing it does do correctly (the open-PR listing).

Note (A) and (B) are not exclusive — (A) subsumes (B)'s correction.

**DISPATCHED → Station 00.** Both halves are landable by hand today: the two doc citations are a
docs-only correction, and (A) is a self-contained read-only script. Under the standing OAuth block
00 has been landing doc corrections by hand rather than arming (#1394 / #1400 / #1401); this fits
that pattern exactly. I did not stage a prompt for it — see WHAT I DID NOT DO.

### F2 — Watcher clone is 25 commits behind `origin/main`. S3, and lower than it looks.

[MEASURED] Clone `C:\po-watcher\ProjectOperations` HEAD = `181817aa` on `main`, dated
2026-08-28T19:02:19+10:00 (= 09:02Z, **25 h old**). `git rev-list --count 181817aa..62fd27f1` = **25
behind, 0 ahead**; `git merge-base --is-ancestor` exit 0 — a clean fast-forward is available.
105 files differ.

**Calibrated before reporting, because "25 behind" over-reads.** The question that decides severity
is whether the drift touches code the watcher *executes*:
- `git diff --name-only 181817aa..62fd27f1 -- scripts/pr-watcher` → **empty.** The watcher engine
  is unchanged. Per §9.5 *"a restart adopts nothing"* — but here a restart would also **change
  nothing**, because there is nothing new to adopt.
- The only pipeline files in the drift are `lint-prompt.mjs`, `check-breadcrumb.mjs` and two of
  their tests. `Select-String` over the clone's `scripts/pr-watcher/*.mjs` finds `lint-prompt`
  **only inside comments** (`index.mjs:851`, `:909`) — the engine never invokes it. Positive
  control on the same grep: 48 hits for `import|export`, so the query was not blind. [MEASURED]

So this is **not** an S2 "the watcher is running stale logic" defect. The real cost is narrower:
agent runs execute *inside* the clone, so any branch cut there starts 25 commits back, and
lint/CI run from a 25-commit-stale tree.

**ESCALATED — and it is the same unanswered question, not a new one.** *Who may fast-forward the
watcher clone?* Station 00 is barred, Station 03 is report-only, and I am read-only. That question
has been open across several runs; this run adds the measurement it was missing (25 commits, 0
ahead, ff-clean, engine untouched). The block is not urgent while the queue is frozen by OAuth —
but it is exactly the thing that must be settled **before** the queue is unfrozen, because the
first prompt to run will run from this tree.

### F3 — 21 of 22 non-`main` remote branches are dead. The obvious diagnosis is wrong. DEFERRED.

[MEASURED] `git ls-remote --heads origin` (§9.2's cure — **not** `git branch -r`, which reported 28
against a truth of 23, i.e. 5 phantom tracking refs). Every non-`main` head cross-referenced to its
PR state via `gh pr list --state all --head <branch>`:

| state | count |
|---|---|
| OPEN | 1 (#1402, Station 00's live branch) |
| MERGED, branch still present | 1 (#1145 `docs/retire-stale-queue`) |
| **CLOSED, never merged** | **20** |

**Two things a naive report would have got wrong, both checked:**

1. *"Auto-delete-on-merge is broken."* It is not. `gh api repos/GH-Mantova/ProjectOperations` →
   `delete_branch_on_merge = True`. [MEASURED] GitHub's setting deletes on **merge** and never on
   **close** — so 20 closed-unmerged branches are the setting working as documented, not a
   misconfiguration. The single merged-and-surviving branch has its own explanation: #1145 merged
   at `2026-08-17T05:01:04Z`, and its tip commit is dated `2026-08-17T15:04:03+10:00` = **05:04:03Z,
   2 min 59 s AFTER the merge.** Something pushed to the branch after auto-delete removed it,
   recreating it. Config is fine; there is no config finding here.

2. *"~900 commits of work are at risk."* No. `commits_not_on_main` reads 740 / 899 / 917 for the
   older branches — but `git merge-base origin/main b99dc585` returns **null**: that branch shares
   **no ancestry at all** with current `main`, so `origin/main..tip` is counting its entire history,
   not unmerged work. Control on a recent branch (`feat/doctrine-section-9-four-measured-false-traps`)
   gives merge-base `549537a4`, 1 commit, 2 files — honest. **Any bulk-delete proposal justified by
   those big numbers would be justified by an artefact.**

Real residue: 20 abandoned branches, oldest tip 2026-06-15, carrying genuinely unmerged work
(closed PRs #396, #599, #605, #606, #632, #703, #730, #804, #833, #973, #1024, #1051, #1062, #1063,
#1116, #1250, #1337, #1346, #978, #1359).

**DEFERRED.** Nothing is broken and nothing is at risk; 22 heads is not a number that costs anything
today. Deleting closed-unmerged branches **discards work** and is squarely in the no-bulk-delete
rule this sweep is written under. It becomes urgent if (a) someone proposes a branch cleanup — at
which point the calibration above must be applied before any number is trusted — or (b) the count
starts materially slowing `ls-remote` / CI branch enumeration.

### F4 — The queue root is 70% breadcrumbs, growing ~20 files/day, and an archive convention already exists unused. S3.

[MEASURED] Depth-1 tracked under `docs/pr-prompts/` on `origin/main` = 228:

| kind | count |
|---|---|
| `00-*` station breadcrumbs | **159** |
| `-HOLD.md` (the live board) | 59 |
| infrastructure (BACKLOG.yaml, ESCALATIONS.yaml, PROMPT-SCHEMA.md, TEMPLATE-sot-reconcile.md, BACKLOG-DECISIONS.md, shepherd-state.md) | 6 |
| dead / suffix-less prompts (F5) | 4 |

Growth, from the date embedded in each breadcrumb filename: 08-24 → 21, 08-25 → 22, 08-26 → 30,
08-27 → 19, 08-28 → 21, 08-29 → 20, 08-30 → 7 (partial). **~20/day, 159 in 12 days.** At this rate
the queue root passes 700 files inside a month, and the live board (59 HOLDs) keeps shrinking as a
fraction of it.

Not dangerous — `00-*.md` matches no watcher glob (`index.mjs:4`: *"Watches
docs/pr-prompts/*-ready.md"*), so nothing can fire. It is corrosive rather than hazardous: every
station and every human that reads the queue root pays, and the board trap this sweep exists to
catch gets harder to see by eye each day.

**The cure already exists and is already conventional.** Subdirectories tracked under
`docs/pr-prompts/`: `superseded/` 250, **`archive/` 41**, `binned-shipped-20260720/` 37,
`needs-marco/` 1, `processed/` 1. Breadcrumbs simply never get moved into `archive/`.

**DISPATCHED → Station 00.** It owns the queue root and already collects every breadcrumb, so it is
the only station positioned to say when one is collected and therefore archivable. Suggested rule
for 00 to ratify: once 00 has dispositioned a breadcrumb's findings, `git mv` it to
`docs/pr-prompts/archive/`. That is additive, reversible, and needs no new convention.

### F5 — Four prompts sit tracked in the queue root that no instrument can see. S3.

[MEASURED] Tracked at depth 1, neither `-HOLD.md` nor `-ready.md`:

| file | last commit | state |
|---|---|---|
| `pr-permission-role-reconciler.md` | 2026-08-03 (`f3c460e4`) | **no lifecycle suffix** |
| `pr-smoke-share-worker-tokens.md` | 2026-08-03 (`482929e2`) | **no lifecycle suffix** |
| `pr-settings-home-slice0-DISARMED-premise-dead-2026-08-18.md` | 2026-08-24 | dead by its own filename |
| `pr-user-default-dashboard-ui-RETIRED-premise-cannot-die-2026-08-18.md` | 2026-08-18 | retired by its own filename |

The first two are the finding. A `pr-*.md` with no suffix is **structurally unauditable**: the
watcher globs `*-ready.md` so it can never run; `triage-holds.ps1` is `*-HOLD.md`-shaped (and see
F1 — it reads neither); and the arm-order lint census counts HOLD/ready only. They can neither
execute nor be retired, and **no instrument in the pipeline reports their existence.** They have
sat untouched for 27 days. Whatever work they describe is silently lost — the same failure mode the
BACKLOG register exists to prevent.

The last two are ordinary litter: their own filenames declare them dead, and `superseded/` is where
they belong.

Also observed, untracked and therefore invisible to every `origin/main` census:
`pr-doctrine-s9-four-false-traps-LOOPING.md` (9056 bytes, mtime 2026-08-26T22:17Z). Its premise is
`grep -q "no inline .if. expression" docs/pipeline/DOCTRINE.md`; that string returns **0 matches**
in `origin/main` DOCTRINE (positive control on the same read: `INSTRUMENT LIES` → 1 match), so the
premise is genuinely **dead** and the `-LOOPING` rename correctly parked it. No action needed — but
it is worth knowing that a dead-by-rename prompt is invisible to every tracked-file audit.

**DISPATCHED → Station 00.** Decide a suffix (`-HOLD`) or a home (`superseded/`) for the two
suffix-less prompts after reading what they actually ask for; move the two self-declared-dead ones
to `superseded/`. I did not move them — 04 is read-only on the board and renames prompts for nobody.

## WHAT I DID NOT DO

**Staged zero prompts** (budget was 2). Deliberate, not an omission. F1/F4/F5 all resolve to queue-root
edits, and the queue cannot run: `-ready.md` on disk = 0 and the OAuth block stands. Staging HOLD
files to fix *"the queue root has too many files in it"*, while nothing can consume them, makes the
measured defect worse and defers the fix rather than delivering it. Under the current block Station
00 has been landing doc and queue corrections by hand (#1394 / #1400 / #1401); all three findings fit
that path, so they are dispatched to 00 rather than parked as prompts.

**Committed and staged nothing.** Station 00 was live on the shared dev-tree index throughout
(worktree `sup-1009`, PR #1402). `git diff --cached --name-only` = 0 lines at the start and at the
end of this run. The two files I touched — this breadcrumb and `sweep-rotation.json` — are left
modified/untracked for 00 to collect. §9.2's shared-index collision is the reason.

**Did not fast-forward the watcher clone** (F2) — not my authority, and the question of whose it is
is the escalation.

**Did not delete or move any branch, prompt, stash or worktree.** No agent bulk-deletes; and for the
branches specifically, the numbers that would justify it are an artefact (F3).

**Did not re-lint the board.** A HOLD lint census already exists from a prior run; re-running
`lint-prompt.mjs` over 59 HOLDs would consume the run without adding a measurement. The one linter
fact I did use — that `triage-holds.ps1` is not a linter and reads no prompts — came from reading
its source, not from running it against the board.

**Did not run Part 0 (static cross-layer audit), Part 1 (GitHub reconciliation) or Part 2
(live-site visual patrol).** The station contract is one named sweep per run, covered completely,
and `next-sweep.mjs` named **repo-hygiene**. Choosing a second would narrow coverage without
rotating it.

**`docs/qa/qa-findings.md` — not written to.** Gitignored at `.gitignore:107`; it swallowed a real
finding for nine days. Everything above is in this tracked-path breadcrumb only.

**Untracked until swept.** This file is untracked in `docs/pr-prompts/`. A breadcrumb filename
matches no watcher glob, so it arms nothing. Station 00: please commit it and
`docs/pipeline/sweep-rotation.json` together.

---

**Validation.** `node scripts/pipeline/check-breadcrumb.mjs
docs/pr-prompts/00-04-scanner-2026-08-30-1010-repo-hygiene.md` → `structure: 121 checked, 0
malformed`, **CLEAN, exit 0**. `--freshness` → **CLEAN, exit 0**; no station SILENT
(00 0.2h/2 · 03 11.3h/24 · 04 0.2h/4 · 05 20.2h/24). breadcrumb-clean.

True at `origin/main` **62fd27f1**, 2026-08-30T10:10:48Z–10:38Z.
