# Station 00 — Supervisor | 2026-09-07T19:08Z–2026-09-07T19:30Z

## GROUND

```
UTC            2026-09-07T19:08:55Z
origin/main    ba5774a4            (fetch --prune, then rev-parse)
dev tree       main @ ba5774a4     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run is read-write.

## WHAT I MEASURED

- [MEASURED] Reached the box. `start_process` shell `powershell.exe` -> pid 4220, prompt returned.
  **This is a SIGHTED run**, not a quiet one.
- [MEASURED] `bash scripts/pipeline/vm-git-guard.sh`, last line:
  `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths, allows everything
  else (both controls passed)`.
- [MEASURED] The three binding documents were read from the DEV TREE, and that is sound this run:
  `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
  docs/pipeline/STATION-CAPABILITIES.md` -> EMPTY, with `HEAD == origin/main == ba5774a4` and
  `git rev-list --left-right --count origin/main...HEAD` -> `0 0`.
- [MEASURED] `status-sweep.ps1` captured to a file (it returns early and hides its own section 7
  otherwise), exit 0, 330 lines. Section 7: `SAFE TO ACT: no board mutation in progress, no recent
  remote activity, no live station worktrees.` Section 3: `index.lock interactive/clone: False /
  False`, `git processes running: 0`, `no PR touched on GitHub in the last 2 min`.
- [MEASURED] `restart-watcher-if-wedged.ps1` (report-only): `armed prompts waiting: 0`,
  `watcher process: ALIVE (pid 31660)`, `restart churn: 0 cycle(s) in 20 min`,
  `VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.`
  Auto-restart wrapper alive (1) per sweep section 2.
- [MEASURED] `check-breadcrumb.mjs --freshness` -> `CLEAN`, exit 0. `00` 0.7h ago ok · `03` 20.2h ok ·
  `04` 1.1h ok · `05` 5.0h ok. Crossed against the cadence caveat: `00`'s CADENCE entry is still `2`
  in that script while the live cron is hourly, so a green `ok` for `00` is the weakest row in the
  table — but `00`'s own newest breadcrumb is 18:30Z and this run is 19:08Z, so nothing is hidden here.
- [MEASURED] Queue root holds exactly FOUR `00-*.md` breadcrumbs, all four TRACKED
  (`git ls-files` returns all four), and every finding in all four carries a disposition
  (5 · 5 · 6 · 5 dispositions). **Nothing has been written since the 18:30Z collect** — no station
  reported in the interval.
- [MEASURED] Board, live: 4 open PRs. `#1777` CLEAN labels=[] · `#1775` BLOCKED labels=[do-not-merge] ·
  `#1774` BLOCKED labels=[] · `#1767` BLOCKED labels=[do-not-merge]. Counted with assign-then-foreach
  (`count=4`), never by piping the JSON array into a filter.
- [MEASURED] All four were `updated` 18:57:18Z–18:59:18Z — 14 to 16 minutes after this station merged
  `#1788` at 18:43Z. That is `pollForBehindPrs` rebuilding every open PR after a board merge, the
  already-escalated behaviour, observed again unchanged.
- [MEASURED] RULE 2 probe, pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed`:
  2057 logs, newest `2026-09-07T15:35Z` — younger than the oldest open PR's `createdAt`
  (`#1767`, 06:43:58Z), which is the control that separates this directory from the dead decoy in the
  clone. POSITIVE `marco.:true` -> 620. NEGATIVE, freshly minted needle -> 0.
  Per-PR over `processed\pr-*.log` (excluding `rev-*`): `#1777` 0 · `#1775` 0 · `#1774` 0 · `#1767` 0.
- [MEASURED] `#1777` at head `2c7e3fe4`: `mergeStateStatus CLEAN`, 15 checks, **zero non-SUCCESS**,
  title `fix(sweep): git stderr is not a failure, and a real failure must still abort`.
- [MEASURED] The watcher clone `C:\po-watcher\ProjectOperations` is dirty=5 and behind: HEAD
  `1ddf3fb4` with its own `origin/main` also `1ddf3fb4` (a per-tree ref, fetched at launch) against
  the real `origin/main` `ba5774a4`. The five: four untracked review verdicts
  (`pr-1767` 06:50Z · `pr-1774` 09:06Z · `pr-1775` 09:15Z · `pr-1777` 09:37Z) and one junk file,
  `C<U+F03A>po-watcherProjectOperations.._scratch_1740_log.txt`, **1,033,778 bytes**, mtime 09-07 01:24Z.
  `git stash list` in the clone -> **69**.
- [MEASURED] Verdicts on file, read from the clone: `#1767` MERGE · `#1774` MERGE · `#1775`
  `## VERDICT: MERGE` · `#1777` `**VERDICT: REJECT-AND-REDO**`.
- [INFERRED] The dev tree's own `docs/pr-reviews/` stops at `pr-1758-review.md`, so none of these four
  verdicts is visible from the tree every station reads first. That is the stale-mirror trap already
  recorded in DOCTRINE section 9.5, met again.

## WHAT CHANGED

- Archived the four dispositioned breadcrumbs from the queue root into `docs/pr-prompts/archive/`
  (`git mv`, inside this run's own PR worktree, so no untracked copy is left in the dev tree):
  `00-00-supervisor-…-1708-…`, `00-00-supervisor-…-1808-…`, `00-00-supervisor-…-1830-…`,
  `00-04-scanner-…-1810-…`. Freshness is matched by trailing path segment, so archiving cannot make
  a station read SILENT — re-checked below.
- Wrote one escalation into `docs/pr-prompts/needs-marco/`:
  `pr-1777-is-green-and-its-only-review-verdict-is-stale-2026-09-07.md`.
- **Merged nothing. Armed nothing. Removed no label. Touched neither `/sot/` nor the clone.**

## FINDINGS

### F1 — `#1777` is green, CLEAN and unlabelled, and the only review verdict on file REJECTS it for a cause that is already fixed

[MEASURED] `pr-1777-review.md` (clone, untracked, written 09-07 09:37Z) opens
`**VERDICT: REJECT-AND-REDO**`. Its diff verification passes all three fixes; the sole stated cause is
`FAILURE: "PR title names its module" (MODULE_PROVENANCE_S2)` against the title it quotes,
`fix(sweep-breadcrumbs): …`. The title today is `fix(sweep): …`, the PR is CLEAN, and **all 15 checks
are SUCCESS**. The rejecting cause no longer exists.

Nothing re-runs a review when a PR head changes, and the verdict carries no SHA, so it will read
REJECT-AND-REDO for the rest of the PR's life. It is also invisible from the dev tree. A reader who
consults the verdict — which is what it is for — is told to redo finished work; that is exactly the
`pr-1156-review-block.md` shape DOCTRINE section 7.1 exists to stop.

`#1777` touches `scripts/pipeline/`, so it is OUTSIDE `tests|docs` and hand-classifies as **Marco's**.
This station may not merge it, and a MERGE verdict would not have changed that. What is escalated is
the misleading verdict on a PR that is otherwise ready for him.

**DISPOSITION: ESCALATED** — `needs-marco/pr-1777-is-green-and-its-only-review-verdict-is-stale-2026-09-07.md`.

### F2 — All four open PRs are Marco's, `NO LOG` for all four, hand-classified

[MEASURED] The RULE 2 probe is live and controlled (2057 logs, newest 15:35Z, POS 620, NEG 0) and
returns **`NO LOG`** for all four. Per DOCTRINE section 10.1 step 4 that is recorded as
`[NO LANE VERDICT — hand-classified]`, never as "not routed to Marco". Hand-classification by
`classifyPolicyFiles`: `#1777` `scripts/pipeline/` · `#1775` `apps/api` + `migrations/` ·
`#1774` `apps/web` + `.github/` · `#1767` `apps/api` + `migrations/`. **All four are outside the three
`NESTED_TEST_PATHS` forms. MERGE NONE.** `#1775` and `#1767` additionally carry `do-not-merge`, which
only Marco removes; `#1774`'s red is the already-escalated `[RELEASED_NO_RECEIPT]` (12:31Z), not a label.

The board is therefore unchanged from the 18:30Z collect, and this is the throughput constraint stated
exactly: `armed=0`, 45 HOLD, nothing armable is `tests-docs`, and every open PR needs Marco.

**DISPOSITION: DEFERRED** — the escalations that would change it are already open
(`station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md` for the missing `tests-docs` supply;
`pr-1774-released-but-cp26-demands-a-receipt-2026-09-07.md`). It becomes urgent if a FIFTH Marco PR opens.

### F3 — A 1.0 MB junk file with a broken filename sits in the watcher clone root and keeps it permanently dirty

[MEASURED] `C<U+F03A>po-watcherProjectOperations.._scratch_1740_log.txt`, 1,033,778 bytes, mtime
09-07 01:24Z, untracked in `C:\po-watcher\ProjectOperations`. The name is a path concatenation that
lost both its separator and its drive colon — the colon survives as U+F03A, the private-use codepoint
Windows substitutes for an illegal `:`. Something wrote a scratch log for `#1740` to a joined string
instead of a path.

It is one of the five entries behind the sweep's `watcher clone: branch=main dirty=5 <-- NOT
clean-on-main; the watcher may refuse to start`. Same dispatch: the clone is at `1ddf3fb4` against
`origin/main` `ba5774a4`, and `git stash list` is at **69**, both already on 03's open dispatch.
**Only 03 may mutate the clone**, and the other four dirty entries are live review verdicts that must
be PRESERVED, not cleaned.

**DISPOSITION: DISPATCHED -> 03 (machine-minder)** — fold into the open clone-hygiene dispatch: delete
the junk scratch file by exact name (it is untracked and is nobody's output), fast-forward the clone,
`git stash drop` — never `pop`. Do not touch `docs/pr-reviews/pr-17*.md` in the clone.

### F4 — Nothing was written by any station in the interval, and the four collected breadcrumbs are now archived

[MEASURED] No `00-*.md` newer than 18:35Z on disk; `--freshness` `CLEAN` with every station `ok`.
`04`'s next occurrence is not due (cadence 4h, last 18:10Z), `03` is daily, `05` is daily. A quiet
interval on a sighted run is a real quiet interval — this run says so having reached the box, not
having failed to.

All four root breadcrumbs carried a full set of dispositions, so they are archived this run rather
than left to make the board harder to read.

**DISPOSITION: ACTIONED** — archived in this PR; `--freshness` re-run after the move must still read
`CLEAN` with all stations `ok`, and that is the falsifying probe for the archive being safe.

## WHAT I DID NOT DO

- **Merged nothing.** All four open PRs hand-classify as Marco's; two carry `do-not-merge`.
  `#1777` being green and unlabelled is not a licence — `scripts/pipeline/` is outside `tests|docs`.
- **Armed nothing.** `armed=0` and no `ADMIT` prompt is confined to `tests|docs`, so any arm would add
  a fifth Marco-blocked PR to a board that already needs him four times. Arming faster makes the queue
  longer, not shorter. The three prompts that duplicate open PRs — `pr-brandtheme-s2-hex-ratchet`,
  `pr-tr-s1-reminder-policy`, `pr-tipid-s2-write-the-ids-backfill-and-admin` — stay HOLD and stay
  un-retired: their premises are still true, so `superseded/` only once the PR MERGES.
- **Did not touch the watcher clone.** Read-only `git status` / `rev-parse` / `stash list` only. The
  junk file and the 69 stashes are 03's to clear.
- **Did not re-run or supersede `#1777`'s review verdict.** Authoring a review job is not this
  station's lane, and hand-writing a verdict into `docs/pr-reviews/` would forge the instrument
  `verdictApproves` reads.
- **Did not clear the `C:\po-vg` orphan worktree** (unchanged, still holding one uncommitted file) —
  already dispatched to 03 and it holds work.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
