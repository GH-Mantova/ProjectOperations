# Station 04 - Scanner | 2026-09-21T02:10:59Z-2026-09-21T02:35Z

Sweep this run: **repo-hygiene** (rotation position 3 of 4, per `node scripts/pipeline/next-sweep.mjs`;
previous run 2026-09-21T00:04:59Z). READ-ONLY on the board: nothing armed, renamed, moved, staged,
merged or committed.

## GROUND

```
UTC            2026-09-21T02:10:59Z
origin/main    8c651574              (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ 8c651574       C:\ProjectOperations2
doc version    1                     (station_doc_version, docs/pipeline/stations/04-scanner.md)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE, so this run is not restricted to read-only by the mismatch clause
(it is read-only by 04's own authority row instead).

Binding documents were read from the working copy after proving it is byte-identical to `origin/main`
by the sound form (DOCTRINE 9.1: no piped hash):
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/04-scanner.md`
returned **EMPTY** for all three. Read in the dev tree, never the watcher clone (per PREFLIGHT 2).

Device-bridge git guard installed at the top of the run, last line quoted verbatim:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
(and `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and mounted cwd,
allows everything else (three controls passed)`).

## WHAT I MEASURED

**Reachability.** [MEASURED] Desktop Commander `start_process` shell `powershell.exe` answered on the
first call after a keyword `ToolSearch` load. This run was SIGHTED. `powershell -File` was used for
every multi-statement probe (DOCTRINE 9.1), each script doing `Set-Location C:\ProjectOperations2`
first so the `gh` CWD trap (9.4) cannot fire, and every `gh` call in my own probes carries
`-R GH-Mantova/ProjectOperations` and tests `$LASTEXITCODE` before parsing.

**Preflight sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1` exit 0, captured to a file and
decoded `utf16le` in node (9.3: `*>` writes UTF-16LE). 435 lines. Section 0 positive controls both
PASS (`gh CAN reach GitHub (saw merged PR #2023)`, `node runs`). No `[BROKEN]` and no `[STALE]` line
anywhere in the report. Section 7 verdict, verbatim:
`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`
I read every `[LIVE]` line in the report; section 5 (lines 109-404) is entirely `[FILE]` and I read
it in part, not in full - stated because a partial read must not be reported as a full one.

**Board trap - tracked `*-ready.md` at depth 1.** [MEASURED]
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` (with `-r` and the trailing slash, 9.2)
returns **1274** tracked paths, **36** of them at depth 1. Of the 36: **27** `-HOLD.md`, **0**
`-ready.md`, **0** `-LOOPING.md`, 9 non-prompt files. POSITIVE control
`git ls-files --error-unmatch docs/pipeline/DOCTRINE.md` -> prints the path, exit 0. NEGATIVE control,
a freshly minted path under the same directory -> `error: pathspec ... did not match any file(s)`,
loud. **The board trap is CLEAN with both controls.**

**Depth-1 census, the 9 non-HOLD files.** [MEASURED] `.arming-log.txt`, `BACKLOG-DECISIONS.md`,
`BACKLOG.yaml`, `ESCALATIONS.yaml`, `PROMPT-SCHEMA.md`, `README.md`, `TEMPLATE-sot-reconcile.md`,
`shepherd-state.md`, and one loose breadcrumb
`00-00-supervisor-2026-09-21-0110-the-thrice-deferred-doctrine-correction-landed-...md`. No superseded,
merged or consumed prompt files are loose in the queue root.

**Tracked subfolder census.** [MEASURED] `archive` 758, `superseded` 436, `binned-shipped-20260720` 37,
`needs-marco` 6, `processed` 1, depth-1 36. `docs/pr-prompts/reports/` does **not** exist: `Test-Path`
-> False on disk, and `git ls-tree -r ... -- docs/pr-prompts/reports/` -> 0 tracked paths.

**HOLD files whose work has already shipped.** [MEASURED] `scripts/pipeline/triage-holds.ps1`
(read-only, `--dequeue` never passed) exit 0 over the 27 depth-1 HOLDs:
`TOTALS spent=0 of 27 evaluated  gates-satisfied=2  still-gated=25  unreadable=0`. Both of its own
controls PASS and are quoted in its output: `GIT control: PASS -- git read origin/main:DOCTRINE.md
(206579 chars)` and `SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture`. It also
re-probed the 25 REJECTs directly: `0 spent behind a REJECT, 25 still needed, 0 UNMEASURABLE`. **So
spent=0 means none, not "this instrument cannot say".** Gates-satisfied: `pr-crmvis-s6-bulk-link-HOLD.md`
(flagged POSSIBLE DUPLICATE of open #2017, 3 of 3 scope entries) and `pr-queue-layout-sot-entry-HOLD.md`.
Arming is 00's; I neither armed nor confirmed the duplicate.

**Worktrees and locks.** [MEASURED] `git worktree list --porcelain` in both trees.
Clone: itself only. Dev tree at 02:17:09Z: `C:/ProjectOperations2` @ 8c651574 and
`C:/PR-Master/worktrees/po-vg` @ 23c91ba9 on `fix/no-rebase-while-checks-run`.
No `index.lock` in either tree (`NOLOCK` both). Zero `locked` files under
`C:\ProjectOperations2\.git\worktrees`. Roots on disk: `C:\po-worktrees` 1 child, `C:\po-wt` 0
children at 02:17, `C:\po-watcher-worktrees` MISSING, `C:\PR-Master\worktrees` 1 child.

**po-vg content, the part that decides whether a prune is safe.** [MEASURED]
`git -C C:\PR-Master\worktrees\po-vg status --porcelain` -> one row,
`?? scripts/pipeline/check-pipeline-heartbeat.mjs`. The path DOES exist on main
(`git rev-parse origin/main:<path>` -> `84ec92d4...`, exit 0), and the content does NOT match it:
`git -C <po-vg> hash-object <path>` -> `9c4587fb...`. NEGATIVE control, a third file's blob ->
`b5343904...`, so the instrument discriminates. **"The path is on main" is not "the content is on
main"** - I nearly filed the opposite from the `rev-parse` exit 0 alone, which is 9.6's shape.
Directory age 24143 min (about 16.8 days); `dotgit=True`.

**The registry escapee.** [MEASURED] `C:\po-worktrees\po-fix-2005`, age 4958 min, `.git` present ->
**False**, and it appears in **no** worktree registry (neither tree lists it). Depth-1 children:
`apps`, `node_modules`, `packages`. Recursive content, using the sound bare-directory form
(9.1, the 2026-09-10 table's row 1): `-Recurse -File -Force` -> **0 files, 0 bytes**;
`-Recurse -Directory -Force` -> **6079 directories**. POSITIVE control for that exact form on
`scripts\pipeline` -> **91** files, so the zero is a real zero. **The sweep's `size=0KB` is ACCURATE**
- I set out to refute it and the measurement upheld it.

**Stashes.** [MEASURED] dev tree **1**; watcher clone **77**, counted with the null guard
`@($x | Where-Object { $null -ne $_ }).Count` (9.4: `@($null).Count` is 1). Newest is a preflight
autostash dated `2026-09-16T10:53:28+10:00` (= 2026-09-16T00:53Z) on
`feat/ratescol-s3-grid-add-column-row-guided-step`; oldest is `stash@{76}`, a WIP on
`feat/sharepoint-folder-mappings`. DOCTRINE 9.5's own last recorded figure for this clone is **71**
(2026-09-10), so the closed loop has grown by **6** in 11 days.

**Clone dirty flag - the falsifying probe in 9.5, run.** [MEASURED] both forms against the clone in
the same minute, with an untracked file present: `git status --short` -> **1**;
`git status --porcelain --untracked-files=no` -> **0**. The one file is
`?? scripts/pr-watcher/.conflict-notified-prs.json`. They disagree, so **the bullet STANDS** and the
sweep's `watcher clone: branch=main dirty=1 <-- the watcher may refuse to start` is again
untracked-inclusive and again does not describe a condition the watcher refuses on.

**Clone drift.** [MEASURED] clone HEAD `895bdefc`; dev `origin/main` `8c651574`;
`git rev-list --count 895bdefc..8c651574` -> **7**. Against the clone's OWN `origin/main` ref it reads
`1 0` (1 behind, 0 ahead) - that ref is pinned at watcher launch and is not the answer (9.5).

**Remote heads.** [MEASURED] `git ls-remote --heads origin` (ask the remote, 9.2) -> **15** heads,
14 non-main. Local cache for contrast: `git branch -r` -> **75**, five times the remote, which is
9.2's stale-tracking-cache trap measured again today. Per-branch board state via
`gh pr list -R <repo> --head <branch> --state all --json number,state,mergedAt`, exit code tested on
every call; POSITIVE control `--state merged --limit 3` -> exit 0, 151 chars; NEGATIVE control, a
minted branch name -> `[]`, exit 0:

| head | PR | state |
|---|---|---|
| `worktree-agent-aaf983d607db97815` | #2017 | OPEN (the only live head) |
| `chore/sweep-breadcrumbs-20260907-0934` | #1778 | MERGED 2026-09-07 |
| `docs/st00-collect-2026-09-14-1108` | #1927 | MERGED 2026-09-14 |
| `fix/no-rebase-while-checks-run` | #1577 | MERGED 2026-09-04 |
| `docs/slice-0-scope-cards-plan` | #1871 | CLOSED unmerged |
| `feat/crm-account360-v2-s1` | #1612 | CLOSED unmerged |
| `feat/ratescol-s2-column-settings-move-delete` | #1960 | CLOSED unmerged |
| `feat/ratescol-s3-grid-add-column-row-guided-step` | #1978 | CLOSED unmerged |
| `feat/scopecards-s3-line-markup-all-types` | #2005 | CLOSED unmerged |
| `feat/verdict-home-resolver` | #1703 | CLOSED unmerged |
| `feat/verdict-home-resolver-v1` | #1707 | CLOSED unmerged |
| `fix/verdict-home-resolver-v1` | #1708 | CLOSED unmerged |
| `fix/verdict-home-resolver-v1-impl` | #1705 | CLOSED unmerged |
| `fix/classify-policy-nested-tests` | #1571 | CLOSED unmerged |
| `fix1483` | none | NO PR EVER ON THE BOARD |

**[MEASURED] INSTRUMENT NOTE, and it is why the table above is built from `gh` and not from git:**
`git merge-base --is-ancestor origin/<head> origin/main` answered **NOT-in-main for all 15 heads,
including the three whose PRs are MERGED**. Every merge in this repo is a squash (9.2), so that probe
returns a uniform answer across a heterogeneous set - 9.6's signature - and it carries zero
information here. I did not use it as evidence for anything.

**Trunk verdict, re-derived from its own source (9.5: provenance is not correctness).** The sweep
printed `main CI on 8c651574: 3 success / 1 failed / 0 running <-- TRUNK IS RED` at 02:12:09Z.
[MEASURED] at 02:22:53Z, `gh run list -R <repo> --commit <full 40-char sha> --json
databaseId,workflowName,status,conclusion,attempt,startedAt` (full SHA per 9.4), exit 0:
`CI`/push/success attempt 1, `Deploy`/push/success attempt 1, `CodeQL`/dynamic/success attempt 1, and
`Tendering Browser Smoke` **attempt 2, status `in_progress`, started 02:16:27Z**. Applying
`TRUNK_VERDICT_SCOPED_V1`'s denylist (which IS landed - `status-sweep.ps1` anchor
`if ($r.workflowName -eq "Dependabot Updates" -or $r.event -eq "schedule")`) gives `trunkOnly=4
trunkFailures=0`. No Dependabot run is attributed to this commit at all, so the 2026-09-10 cause does
not apply here. [MEASURED] the missing half, via
`gh api repos/<repo>/actions/runs/35551077706/attempts/1`: **attempt 1 concluded `failure`**, created
01:29:50Z. NEGATIVE control, `--commit 000...0` -> `[]`, exit 0.
**So the sweep was CORRECT when it printed, and a retry started four minutes later.** The sweep's own
pending bucket is sound (`if (-not $r.conclusion) { $mpend++ }`); nothing is wrong with the
instrument. What is wrong is carrying the line forward.

**`status-sweep.ps1` and the 9.4 CWD cure.** [MEASURED] `Select-String '\bgh\s'` over the script ->
14 matching lines, of which **7 are real invocations** (at the anchors `gh pr list --state merged
--limit 1`, `gh pr list --state open --limit 50`, `gh pr checks`, `gh pr list --state merged --limit 8`,
`gh run list --commit $mainSha`, `gh pr list --state all --limit 10`, `gh pr view $n --json state`) and
the other 7 are comments or output strings. **`-R` appears on 0 of the 7.** POSITIVE control, a token
known present in that file (`TRUNK IS RED`) -> 3 hits; NEGATIVE control, a minted needle -> 0.
Mitigation, measured in the same read: the script's FIRST `gh` call is a positive control that prints
`[BROKEN] gh returned NO merged PRs` and skips the GitHub sections, so a non-repo CWD fails LOUD here
rather than returning a well-formed empty board.

**Escalation corpus.** [MEASURED] `docs/pr-prompts/needs-marco` holds **60** `.md` on disk;
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/needs-marco/` returns **6**. So 54
escalations exist only on the box.

**Angle 4 (history) before filing anything.** [MEASURED] `Select-String` over
`needs-marco\*.md`, POSITIVE control `ESCALATION` -> 122 lines, NEGATIVE control a freshly minted
needle -> 0 lines. Files already owning subjects I measured: `po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`,
`remote-branches-outlive-their-prs-2026-09-05.md`, `stale-remote-heads-and-auto-delete-2026-09-08.md`,
`stale-remote-heads-need-auto-delete-on-merge-2026-09-10.md`,
`pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md`,
`pr-2005-closed-unmerged-one-second-after-a-board-merge-2026-09-17.md`,
`nobody-may-fast-forward-the-watcher-clone-2026-09-07.md`,
`escalations-live-only-in-the-watcher-clone-2026-09-14.md`,
`sweep-clone-dirty-flag-counts-untracked-files-2026-09-10.md`,
`status-sweep-prune-warning-ignores-unpushed-commits-2026-09-17.md`,
`two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`.
No file in that corpus carries the `reports/` home contradiction or the missing `-R` in its FILENAME;
I matched on terms and did not read all 21 term-matching files, so "not previously filed" is
[INFERRED] for F7 and F8, not measured.

## WHAT CHANGED

Nothing on the board. No prompt armed, disarmed, renamed, moved, staged or deleted; no PR opened,
updated, labelled or merged; no branch, worktree, stash or lock touched; `/sot/` untouched; no Azure,
Entra or SharePoint call of any kind.

Three writes, all in the dev tree, all left DIRTY and named here because Station 00 commits them and
04 may not:

1. **This breadcrumb**, at the tracked path
   `docs/pr-prompts/00-04-scanner-2026-09-21-0210-thirteen-of-fourteen-remote-heads-are-dead-and-three-escalations-own-the-question.md`.
   It is UNTRACKED until a board PR commits it.
2. **`docs/pipeline/sweep-rotation.json`**, advanced by
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-21T02:10:59Z`. Left dirty on `main`.
   If this is not committed, the next run repeats `repo-hygiene` and the rotation stops turning.
3. Scratch probe scripts under `C:\po-sup-fix-scripts\` (`s04-hygiene-A..L-20260921.ps1`) and two
   captures (`sweep-04-20260921-0211.txt`, `triage-04-20260921.txt`). That folder is outside both
   repos and dirties nothing.

[MEASURED] before writing: `git diff --cached --name-status` in the dev tree -> **0** staged rows, so
nothing another chat staged is at risk from these writes (9.2, the shared index).

## FINDINGS

### F1 - Two dead worktree artefacts, and only one of them is safe to remove without care

`C:/PR-Master/worktrees/po-vg` is registered in the DEV TREE's worktree list, 16.8 days old, sitting
on `fix/no-rebase-while-checks-run`, whose PR **#1577 merged 2026-09-04**. Its one uncommitted item is
an untracked `scripts/pipeline/check-pipeline-heartbeat.mjs` whose blob `9c4587fb` **differs** from
main's `84ec92d4`. So the sweep's `PRESERVE OR COMMIT BEFORE PRUNING` warning is correct and
`git worktree remove --force` would silently discard real content. This is already owned by
`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`, open 16 days; the new
fact is that the divergence is still live and now measured by blob rather than by size.
**DISPOSITION: DEFERRED** - to that escalation rather than re-filed. It becomes urgent the moment any
run reaches for `--force`, or if 03 is dispatched to prune worktrees; the content must be captured
first (`git -C C:\PR-Master\worktrees\po-vg show :0:` is not available for an untracked file, so copy
the file out, or `git add` + `git stash create` inside that worktree).

`C:\po-worktrees\po-fix-2005` is a different thing and it is unambiguously dead: no `.git` file, in no
worktree registry, **0 files and 0 bytes** recursively (positive control on the same query form
returned 91), and **6079 empty directories** - the skeleton of a half-deleted `node_modules` tree,
3.4 days old. Nothing can be lost by removing it. Deleting directories on the box is not 04's.
**DISPOSITION: DISPATCHED** - to Station 03 (machine/worktree hygiene), as a plain
`Remove-Item -Recurse` on that one path, with the measurement above as the evidence that it holds no
files. 04 removed nothing.

### F2 - Thirteen of fourteen non-main remote heads are dead, and THREE open escalations already own the question

Of 14 non-main heads on the remote: 3 whose PR merged (#1778, #1927, #1577), 10 closed-unmerged
(#1871, #1612, #1960, #1978, #2005, #1703, #1707, #1708, #1705, #1571), 1 with no PR on the board
ever (`fix1483`), and exactly 1 live (#2017). The closed-unmerged class is the dangerous one: two of
those heads are the subject of their own escalations precisely because a closed-unmerged branch can
hold the only copy of work (#1612, #2005). Branch deletion is irreversible, which is DOCTRINE 5.4, so
04 reports and nothing more.

The finding that is new is not the population - it is that **`remote-branches-outlive-their-prs-2026-09-05.md`,
`stale-remote-heads-and-auto-delete-2026-09-08.md` and `stale-remote-heads-need-auto-delete-on-merge-2026-09-10.md`
are three separate escalations on one subject**, filed over five days, and 16 days after the first one
the heads are still there. A fourth filing is the failure mode, not the remedy.
**DISPOSITION: DISPATCHED** - to Station 00, to consolidate those three into one escalation and put a
single question to Marco. RULE 1 ordering for that question:
**(a) complete and additive** - turn on GitHub's repo-level "Automatically delete head branches", which
removes the merged class permanently and for all future merges and cannot touch an unmerged branch;
then hand-triage the 10 closed-unmerged heads one at a time against their escalations. Passes both
halves: it solves it now and in future, and it cannot destroy unmerged work.
**(b)** delete the 3 merged heads by hand now - solves today only, so it fails the "future" half; the
same three-escalation backlog regrows on the next merge.
**(c)** bulk-delete all 13 dead heads - fails the "without damaging existing work" half outright,
because two of the ten are already escalated as possibly the only copy.

### F3 - The sweep's TRUNK IS RED on 8c651574 was true, and must not be carried forward

Attempt 1 of `Tendering Browser Smoke` on `8c651574` genuinely concluded `failure` (measured via
`gh api .../attempts/1`). Attempt 2 started 02:16:27Z, four minutes after the sweep read, and was
`in_progress` at 02:22:53Z with `trunkFailures=0` across the other three runs. `00-supervisor.md`
rule 5 reads a red trunk under a docs diff as instant proof of a MAIN regression, so a run that
inherits the 02:12 line hunts a regression whose evidence is a retry in flight; a run that inherits
only my `trunkFailures=0` concludes trunk is green while a browser smoke is still deciding. Neither
is the answer.
**DISPOSITION: ACTIONED** - re-derived here from the source with the attempt number and both
controls, so the line is superseded rather than repeated. The one probe that settles it, for whoever
reads this next: `gh run list -R GH-Mantova/ProjectOperations --commit
8c6515740f2d9f2ca9db9532ca7b5caea68ed2ce --json workflowName,status,conclusion,attempt`. If attempt 2
also fails, the browser smoke on trunk is a real finding and belongs to 00; if it passes, trunk is
green and the failure was a retryable flake worth counting.

### F4 - A concurrent actor appeared mid-run, and the sweep's own safe-to-act line had expired

At 02:17:09Z the dev tree's worktree list held two entries and `C:\po-wt` had **0** children. At
02:20:14Z it held three: `C:/po-wt/sup-20260921-0215` @ 8c651574 on branch
`docs/station-00-2026-09-21-0215`, directory mtime 02:18:47Z, carrying an untracked
`docs/pr-prompts/pr-sotinpr-freshness-gate-HOLD.md`. That is Station 00 working inside its own
authority (the matrix gives 00 `docs/pr-prompts/` and a disposable worktree), so this is not a
collision - but the 02:12:09Z verdict `no live station worktrees` was false within eight minutes,
which is DOCTRINE 7's `[LIVE]` rule in its cheapest form. It is also the 00-times-04 overlap
`STATION-CAPABILITIES.md` section 6 says recurs on every one of 04's six daily runs, measured again:
04 started 02:10:59Z, 00's worktree was created 02:18:47Z.
**DISPOSITION: ACTIONED** - I re-measured the registry immediately before writing, confirmed the dev
tree index has 0 staged rows, and committed nothing, so 00's staging cannot be swept into anything of
mine. Recorded so 00's collect knows 04 was running alongside it and that its 02:15 worktree is mine
to report, not to prune.

### F5 - The watcher is running code seven commits behind main

Clone HEAD `895bdefc` against `origin/main` `8c651574` is **7** commits. The watcher runs
`index.mjs` from the clone and a restart adopts nothing (9.5), so every `scripts/pr-watcher/**` fix
merged in those 7 commits is on main and not in the running process. Owned by
`needs-marco/nobody-may-fast-forward-the-watcher-clone-2026-09-07.md`.
**DISPOSITION: DISPATCHED** - to Station 03 as the measured drift figure for its clone-hygiene lane
(03 is report-only on repairs, so the fast-forward itself remains whoever that escalation settles on).
Not re-filed as an escalation; the question of who may fast-forward it is already Marco's.

### F6 - Clone stash count 77, up 6 since the last figure in DOCTRINE

`git stash` in the watcher clone is a closed loop by design: the launcher preflight auto-stashes and
nothing ever pops. 9.5 asks for the count and its growth; the count is **77** (dev tree 1), against
**71** recorded 2026-09-10, newest 2026-09-16T00:53Z. Nothing is failing: the auto-stash path is what
keeps a tracked-dirty clone from refusing to start, and its receipts are these stashes.
**DISPOSITION: DEFERRED** - real, not now. It becomes urgent if a preflight auto-stash ever FAILS,
because that is the only remaining path by which a dirty clone refuses to start; the trigger to watch
is `start-watcher.ps1`'s anchor
`# --- Self-heal: AUTO-STASH a dirty tree instead of exiting 1 ---` reporting a stash failure. When
it is cleared, `git stash drop`, never `pop` (9.2).

### F7 - DOCTRINE 8.5 sends breadcrumbs to a directory that does not exist, and honouring it would blind check-breadcrumb's structure pass

8.5 says *"Reports are not prompts. Breadcrumbs and run reports go in `docs/pr-prompts/reports/`"*.
That directory is absent from disk (`Test-Path` -> False) and has 0 tracked paths. Meanwhile the
station contract every station doc carries mandates depth 1
(`docs/pr-prompts/00-<NN>-<station>-<date>-<time>-<slug>.md`), and
`scripts/pipeline/check-breadcrumb.mjs` does its structure pass over `readdirSync(DIR)` (anchor:
`const onDisk = readdirSync(DIR).filter((f) => NAME_RE.test(f))`) - depth 1 only, exactly as 9.5
records. So the S4 implementation as written would move every breadcrumb out of the validator's
structure pass while the freshness pass, which matches on trailing path segment, kept working - the
half-blind outcome 9.5 already measured for `archive/`. 8.5 says of itself "Not yet enforced ...
written in S1 and enforced in S4", so nothing is broken today; the drift is that the two binding
documents give different homes for one artefact and the unimplemented one carries a cost its own text
does not mention.
**DISPOSITION: DISPATCHED** - to Station 00, which owns cross-document reconciliation and can check
its own archive for prior filings (my angle-4 search was by term, so "not previously filed" is
inferred here, not measured). RULE 1 ordering: **(a) complete and additive** - if reports do move to
`reports/`, widen `check-breadcrumb.mjs`'s structure pass to that subdirectory in the SAME PR, so no
window exists in which breadcrumbs are unvalidated; **(b)** leave breadcrumbs at depth 1 and strike
the `reports/` sentence from 8.5 - solves the contradiction but fails the "future" half, since the
31-loose-reports problem 8.5 was written for returns; **(c)** move them and fix the validator later -
fails both halves and is the shape that produced the nine-day gitignored-findings incident.

### F8 - Seven `gh` invocations in status-sweep.ps1, none carrying `-R`

9.4's CWD bullet prescribes `-R <owner>/<repo>` on every `gh` call inside a script and a
`$LASTEXITCODE` test before parsing, because a `.ps1` launched with `-File` inherits the session's
working directory - and Desktop Commander opens its shell in the Cowork `outputs` folder, which is not
a git repository. `status-sweep.ps1` is the one instrument every station's PREFLIGHT is required to
run and obey, and 0 of its 7 `gh` invocations pass `-R`. It is not currently silent, and that matters
for the severity: its first `gh` call is a positive control that prints
`[BROKEN] gh returned NO merged PRs -- gh is not authenticated/reachable` and skips the GitHub
sections, so a non-repo CWD fails loudly. The residual is that the loud failure costs the whole
GitHub half of the report, when one flag per call would keep it.
**DISPOSITION: DEFERRED** - real, not now, and `scripts/` is outside 04's lane to change. It becomes
urgent the first time a station's report shows `[BROKEN] gh returned NO merged PRs` while `gh` is
demonstrably healthy from the repo, because that is this trap and not an auth failure. The fix is
7 edits plus an exit-code test; the falsifying probe is 9.4's own four-row table rebuilt against this
script.

### F9 - Clean, with controls: the board trap and the HOLD corpus

Two of the six repo-hygiene items came back clean and the zeros are controlled, which is worth
recording so the next run does not re-derive them: **0** tracked `*-ready.md` at depth 1 of
`docs/pr-prompts` on `origin/main` (positive control returned a tracked path, negative control failed
loudly), and **0 of 27** tracked depth-1 HOLDs spent, from `triage-holds.ps1` whose SPENT bucket and
SPENT-BEHIND-A-REJECT probe were both proved reachable by fixture in the same run. No superseded,
merged or consumed prompt files are loose in the queue root either.
**DISPOSITION: ACTIONED** - measured, controlled, and stated; nothing outstanding.

## WHAT I DID NOT DO

- **Armed, disarmed, renamed, moved or deleted nothing** in `docs/pr-prompts/`, and staged no prompt.
  04's authority row is `Mutate the board: NO, read-only` and `Arm a prompt: NO`. In particular I did
  not confirm or dismiss `triage-holds.ps1`'s POSSIBLE DUPLICATE flag on
  `pr-crmvis-s6-bulk-link-HOLD.md` against open #2017 - that confirmation belongs with the arming
  decision, which is 00's on Marco's authority.
- **Did not commit anything, including this breadcrumb and the advanced
  `docs/pipeline/sweep-rotation.json`.** The dev tree is on `main`, which nobody commits to directly,
  and 04 may not open a PR. Both are named under WHAT CHANGED for 00 to sweep up. If they are not
  committed, this report is untracked and the rotation stops turning.
- **Deleted no branch, no worktree and no stash**, and ran no `--force`. Branch and worktree deletion
  is irreversible (DOCTRINE 5.4) and the closed-unmerged heads may hold the only copy of real work.
  I also did not prune `C:\po-worktrees\po-fix-2005` even though I measured it as holding zero files;
  removing directories on the box is 03's.
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard was installed
  first and every git command in this run went through Desktop Commander PowerShell on the host.
- **Did not touch `/sot/`** (05's, CP-24) and did not read or write anything in Azure, Entra or
  SharePoint - absolute, all stations.
- **Did not use `git merge-base --is-ancestor` as evidence** about which branches are merged, because
  I measured it returning NOT-in-main for three heads whose PRs are merged. Squash merges make it
  uninformative on this board.
- **Did not run the other three sweeps** - gate liveness, instrument honesty, instruction drift. One
  named sweep per run, chosen by `next-sweep.mjs`, is the rule; a shallow pass over everything is why
  findings rot.
- **Did not read section 5 of the status sweep in full** (lines 109-404, every row `[FILE]`), and did
  not read all 21 `needs-marco` files whose text mentions `status-sweep` or `check-breadcrumb`. Both
  are stated rather than glossed, and they are why F7 and F8 carry `[INFERRED]` on the
  "not previously filed" half.
- **Did not re-file any subject an open escalation already owns** - po-vg, the stale remote heads, the
  clone fast-forward, the clone-dirty flag and the untracked escalation corpus are all deferred or
  dispatched to their existing files rather than duplicated.
