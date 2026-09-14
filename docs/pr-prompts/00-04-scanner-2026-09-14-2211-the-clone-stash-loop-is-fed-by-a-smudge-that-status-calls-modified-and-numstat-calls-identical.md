# Station 04 — Scanner | 2026-09-14T22:08Z–2026-09-14T22:25Z

## GROUND

```
UTC            2026-09-14T22:08:00Z
origin/main    a3e94700            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ a3e94700     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE, so this run was not restricted to read-only on that account.
04 is read-only on the board regardless.

Sweep taken this run: **repo-hygiene** (rotation position 3 of 4), from
`node scripts/pipeline/next-sweep.mjs`. Advanced with
`--advance --utc 2026-09-14T22:11:34Z`; `docs/pipeline/sweep-rotation.json` is LEFT DIRTY in the
dev tree and is named here for Station 00 to commit, because 04 may not commit to the shared tree.

## WHAT I MEASURED

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` →
`2026-09-15T08:10:24.7426414+10:00` / `LAPTOP-E6NHU4E4`. Sighted run. Desktop Commander tools were
loaded by keyword `ToolSearch` first, per PREFLIGHT step 1.

**Device-bridge git guard.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
FAILED to run at all — the workspace VM refused to start, quoting
`source path ... is under Plan9 share "c" which is not mounted` and
`A Windows update released September 8 prevents Claude's workspace from reaching your files.`
The installer's last line is therefore that error, quoted here as the contract requires. Per the
station contract this is a FINDING, not a STOP. No VM-side call was made this run, so no `git`
touched the Windows `.git` through the bridge.

**Binding documents.** [MEASURED] `git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned EMPTY, so the working
copies I read are byte-identical to `origin/main` at `a3e94700`. All three read in full in the dev
tree, never in the clone.

**Sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1` captured with `*>` and decoded `utf16le`
in node (144,924 bytes, UTF16LE=true, 865 lines — the documented `*>` trap). Section 0 controls
both PASS. Section 7: `SAFE TO ACT`.

**Board trap — tracked `*-ready.md` at depth 1.** [MEASURED] `git ls-tree -r --name-only origin/main
-- docs/pr-prompts/` → 1202 tracked paths, 46 at depth 1: **37 `-HOLD.md`, 0 `-ready.md`, 0
`-LOOPING.md`, 9 other** (the arming log, two breadcrumbs, BACKLOG.yaml, BACKLOG-DECISIONS.md,
ESCALATIONS.yaml, PROMPT-SCHEMA.md, TEMPLATE-sot-reconcile.md, shepherd-state.md). POSITIVE control
`holds > 0` = true; NEGATIVE control, the needle minted for this run
(`zzQq04HygieneNeedle20260914T2211`) → 0. **The board trap is CLEAR.**

**Spent HOLDs.** [MEASURED] `scripts/pipeline/triage-holds.ps1` (read-only): GIT control PASS,
SPENT fixture control PASS. `spent=0 of 37 evaluated · gates-satisfied=4 · still-gated=33 ·
unreadable=0`, and `0 spent behind a REJECT` from the direct re-probe of all 33 rejects. **No HOLD
on main describes work that has already shipped.** Two of the four ADMITs are annotated POSSIBLE
DUPLICATE of the two open PRs (`pr-ea-s2a-dashboard-preset-seed-HOLD.md` ↔ `#1920`,
`pr-ratescol-s0-column-api-hygiene-HOLD.md` ↔ `#1923`, 2 of 2 each) — a candidate, never a verdict,
and arming is 00's call, not mine.

**Worktrees.** [MEASURED] `git worktree list` in the dev tree returns four entries: the dev tree
itself at `a3e94700`, plus `C:/po-fix1891` (`1dc31858`, detached HEAD), `C:/PR-Master/worktrees/po-vg`
(`23c91ba9`, `fix/no-rebase-while-checks-run`) and `C:/PR-Master/worktrees/pr1823` (`9664f95a`,
`feat/ea-gate-reporting-team-permission`). The clone has exactly one worktree, itself. **No `locked`
file exists in any of the three admin dirs under `.git/worktrees`, and `index.lock` is ABSENT in
both trees** — so there is no stale lock to escalate this run. `po-fix1891` and `pr1823` are
`status --porcelain` EMPTY; only `po-vg` is dirty, with one untracked file.

**Stashes.** [MEASURED] `git -C C:\po-watcher\ProjectOperations stash list` → **72**, counted with a
null guard. Newest `2026-09-14T07:55:03+10:00 watcher-preflight-autostash on 'main'`; oldest
`2026-07-14T08:44:31+10:00`. The dev tree has **0**. Three of the five newest are
`watcher-preflight-autostash`. That count is state — re-measure it, never quote it.

**Remote heads vs local branches.** [MEASURED] `git ls-remote --heads origin` (asking the remote,
never `git branch -r`) → **13 heads, 12 non-main**. The local remote-tracking cache reads **37**,
and `git branch` in the dev tree reads **414 local branches**. Per-branch PR state via
`gh -R GH-Mantova/ProjectOperations pr list --head <b> --state all`, POSITIVE control
`gh pr view 1939` → `{"state":"MERGED"}`, NEGATIVE control a minted branch name → `[]`:

| remote head | PR | state |
|---|---|---|
| `feat/ea-2a-estimating-analytics-preset` | #1920 | OPEN |
| `fix/ratescol-s0-column-server-messages` | #1923 | OPEN |
| `chore/sweep-breadcrumbs-20260907-0934` | #1778 | MERGED 2026-09-07 |
| `docs/st00-collect-2026-09-14-1108` | #1927 | MERGED 2026-09-14 |
| `docs/slice-0-scope-cards-plan` | #1871 | CLOSED unmerged |
| `feat/crm-account360-v2-s1` | #1612 | CLOSED unmerged |
| `feat/verdict-home-resolver` | #1703 | CLOSED unmerged |
| `feat/verdict-home-resolver-v1` | #1707 | CLOSED unmerged |
| `fix/verdict-home-resolver-v1` | #1708 | CLOSED unmerged |
| `fix/verdict-home-resolver-v1-impl` | #1705 | CLOSED unmerged |
| `fix/classify-policy-nested-tests` | #1571 | CLOSED unmerged |
| `fix1483` | — | **NO PR EVER** |

**Untracked under the queue.** [MEASURED] `git ls-files --others --exclude-standard -- docs/pr-prompts`
→ **4**: `docs/pr-prompts/.queue-sync-ledger.txt`, `docs/pr-prompts/queue-watch-state.md`,
`docs/pr-prompts/superseded/pr-fix-1891-scope-cards-literal-fallbacks-trip-the-ratchet-c-LOOPING.md`,
`docs/pr-prompts/superseded/pr-scopecards-s0-plan-b-LOOPING.md`.

**Queue root on disk.** [MEASURED] 48 depth-1 files, of which 37 are `-HOLD.md`; the 11 others are
the nine tracked support files plus the two untracked ones above. **No superseded prompt file is
littering the queue root** — the two `-LOOPING.md` retirement records are already inside
`superseded/`, they are simply not committed.

**This breadcrumb.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs` → `ADMIT` for this file,
`structure: 3 checked, 0 malformed`, `CLEAN`, and **exit 0** (captured from `$LASTEXITCODE` inside a
`.ps1` run with `-File`, because the `-Command` layer eats the variable). It is UNTRACKED, as the
tool itself notes, and reaches nobody until a board PR commits it.

## WHAT CHANGED

Nothing on the board. No prompt was armed, disarmed, renamed, moved, staged or deleted; no PR was
touched; no label changed; no `git` write ran against any tree.

One working-copy change, made by the instrument the station doc mandates and left deliberately
dirty for Station 00: `docs/pipeline/sweep-rotation.json`, advanced to
`last_index=2 last_run_utc=2026-09-14T22:11:34Z` and read back as ` M` by
`git status --porcelain`.

Scratch files were written outside the repo, under `C:\po-sup-fix-scripts\`.

## FINDINGS

### F1 — The clone's stash loop is fed by a file `git status` calls modified and `git diff` calls identical, and nothing clears it

`status-sweep.ps1` reports `watcher clone: branch=main dirty=2`. One of the two is untracked
(`?? docs/pr-reviews/pr-1920-review.md`, written by the `rev-<N>` job by design — DOCTRINE section 9.5).
The other is tracked, and it is not a real edit.

[MEASURED] in `C:\po-watcher\ProjectOperations`, same minute:

| probe | result |
|---|---|
| `git status --porcelain --untracked-files=no` | ` M docs/data-model/metadata-catalog.json` |
| `git diff --numstat` | **EMPTY**, with only `warning: ... LF will be replaced by CRLF the next time Git touches it` |
| `git rev-parse HEAD:docs/data-model/metadata-catalog.json` | `25dba2d48c09de09643e1c4852bbc0570bf127d0` |
| `git hash-object docs/data-model/metadata-catalog.json` | `25dba2d48c09de09643e1c4852bbc0570bf127d0` |

POSITIVE control, the same file in the dev tree: `git status --porcelain` EMPTY, and
`git rev-parse origin/main:<path>` and `git hash-object <path>` both `25dba2d4…`. **The content is
identical on both sides of the boundary; only the clone's index disagrees with its own working
copy.** That is the line-ending / stale-stat-cache smudge, not a modification.

Why it matters rather than being cosmetic: `start-watcher.ps1`'s preflight counts TRACKED dirt
(anchor: `# --- Self-heal: AUTO-STASH a dirty tree instead of exiting 1 ---`), so this permanent
phantom modification makes the launcher stash on launch. The stash list is a closed loop — the
preflight stashes and nothing ever pops — and it now stands at **72**, with the newest entry
`watcher-preflight-autostash on 'main' at 2026-09-14T07:55:03`. The file's own last commit on main
is `f748f6ed 2026-09-14 01:44:47 +1000` (#1890), six hours before that stash.

Both trees carry a `.gitattributes`, so this is a per-clone index artefact rather than a repo-wide
misconfiguration. The complete-and-additive cure is clone-side and one command
(`git -C <clone> add --renormalize <path>`, or `update-index --refresh`), which removes the trigger
permanently and cannot lose work because the blobs already match; the alternative — dropping
stashes periodically — treats the symptom and fails the "solves it for the future" half of RULE 1.

⚠️ This is a claim about the clone, and only Station 03 may touch it. **Falsifying probe:** re-run
the four rows above in the clone. If `git diff --numstat` ever returns a non-empty row for that
path, or the two hashes differ, this finding is wrong and the file really is edited.

**DISPATCHED** → Station 03 (machine-minder), whose lane the watcher clone is. Handing over: the
four-row table above, the cure, and the request to report the stash count again after the
renormalize so the loop's growth can be shown to have stopped rather than paused.

### F2 — A filename match on `origin/main` is NOT a content match, and the ten-day preservation block on `po-vg` is real

`status-sweep.ps1` has been warning for days that `C:/PR-Master/worktrees/po-vg` (age 15,258 min ≈
10.6 days, branch `fix/no-rebase-while-checks-run`) `HOLDS UNCOMMITTED WORK (1 file(s))` and that
`--force` would discard it. The obvious discharge is to show the file already shipped.

[MEASURED] the file is `?? scripts/pipeline/check-pipeline-heartbeat.mjs`, and that exact path **is**
tracked on `origin/main`: `git ls-tree -r --name-only origin/main -- scripts/pipeline/` returns
**1** match for it (POSITIVE control `lint-prompt` → 8; NEGATIVE control, the minted needle → 0).
Read no further and the available conclusion is *"already shipped, safe to prune"*.

It is false. [MEASURED] on content:

```
origin/main blob  84ec92d4720241431ca9e5d4ed53da5961e9a2fc
po-vg  file hash  9c4587fbf4e906fca096941f014de8ef4671ebee     IDENTICAL=false
git diff --numstat --no-index <main copy> <po-vg copy>   ->   2  10
```

POSITIVE control that `hash-object` discriminates at all: a different file under the same directory
hashes `dd405e04…`. So the worktree's copy is **10 lines shorter and 2 lines different** from the
version on `main` — on the numbers it is an earlier draft that `main` has since overtaken, but that
is an inference and the decision is not mine.

This is DOCTRINE section 9.6 inverted: not an empty result read as an empty world, but a *name*
match read as an *identity* match, on the one question that decides whether `--force` destroys
something. **The preservation warning stands.**

**DISPATCHED** → Station 03, with the measurement, so the ten-day-old blocker can be settled by
diffing the two copies rather than by sitting on the worktree. The actual `--force` prune is
irreversible and is Marco's under DOCTRINE section 5.4; nothing here should be read as clearing it.
⚠️ The project memory records an orphaned `C:\po-vg` at a different path; whether that is this
worktree relocated or a second tree is **[CANNOT MEASURE]** from this run — `git worktree list`
returns only the `C:/PR-Master/worktrees/po-vg` form.

### F3 — 414 local branches against 12 live remote heads, and the cache in between agrees with neither

[MEASURED] `git ls-remote --heads origin` → **13** (12 non-main). `git branch -r` in the dev tree →
**37**. `git branch` in the dev tree → **414**.

The 37-against-13 gap is the documented `--prune` limitation (`refs/remotes/pr/*` refs no refspec
owns), and it is not new. The **414** is the finding: the dev tree accumulates a local branch for
every board PR, every collect, every arm and every hand-fix, and nothing has ever removed one. The
concrete cost is not disk — it is that `git branch` output is now unreadable by eye, which is the
instrument a run reaches for when it needs to know whether a fix branch already exists, and an
unreadable instrument gets skipped. It also makes any future `--merged` sweep tempting, and
`--merged` is blind to squash merges, which is every merge in this repo.

**DEFERRED.** It becomes urgent the moment a run needs to answer "does a branch for this work
already exist?" from the local list, or if a name collision causes a checkout to pick up a stale
branch. The safe cure is not a bulk delete — it is a report that lists, for each local branch, its
remote counterpart (absent for all but 12) and its PR state, so deletion becomes a reviewed list
rather than a sweep. No agent bulk-deletes, per this sweep's own charter.

### F4 — Ten of the twelve non-main remote heads are dead, and four of them are one kill-loop's duplicates

From the table above: **2 OPEN** (legitimate), **2 MERGED with the branch never deleted** (#1778,
#1927), **7 CLOSED-unmerged**, and **1 with no PR that ever existed** (`fix1483`).

Four of the seven closed-unmerged are `feat/verdict-home-resolver`, `feat/verdict-home-resolver-v1`,
`fix/verdict-home-resolver-v1` and `fix/verdict-home-resolver-v1-impl` — #1703, #1707, #1708, #1705,
the four duplicate PRs the watchdog kill loop opened on 2026-09-06 for work that landed in #1704.
They are exactly the branches DOCTRINE section 9.5 names as the falsifying probe for that count
(*"if a fifth `*verdict-home-resolver*` head appears, this count is wrong again"*) — **no fifth head
exists; the count still reads four.** That probe is the reason not to delete them casually.

The two MERGED heads are unambiguous litter: GitHub's delete-on-merge did not fire, or was off.
`fix1483` never had a PR at all and its only record is the branch.

**ESCALATED** — branch deletion is irreversible (DOCTRINE section 5.4), and two of these branches are
load-bearing as evidence. The question for Marco, with the complete-and-additive option first:

- **(a)** Turn on GitHub's *automatically delete head branches* setting, and delete only the two
  heads whose PRs are MERGED (#1778, #1927). Complete — it stops new merged-branch litter forever —
  and additive, because it touches nothing unmerged and destroys no evidence. It leaves the seven
  closed-unmerged heads and `fix1483` exactly where they are.
- **(b)** Also delete the seven closed-unmerged heads. Fails the *future* half only mildly, but
  fails the *do not damage* half: `#1612`'s branch is already on record as possibly holding the only
  copy of its work, and the four verdict-home-resolver heads are DOCTRINE section 9.5's own
  falsifying probe. Deleting them destroys a probe a later run is instructed to re-run.
- **(c)** Do nothing. Fails the future half — the litter grows one branch per un-deleted merge.

`fix1483` is a separate, smaller question: it is a branch with no PR and no record, and confirming
whether it holds anything needs a diff against `main` before anyone decides.

### F5 — Two prompt-retirement records exist only on this disk

[MEASURED] `docs/pr-prompts/superseded/pr-fix-1891-scope-cards-literal-fallbacks-trip-the-ratchet-c-LOOPING.md`
and `docs/pr-prompts/superseded/pr-scopecards-s0-plan-b-LOOPING.md` are UNTRACKED. `superseded/` is
a tracked directory (it holds 252 tracked files), so these two are not gitignored — they were moved
there and never committed. A `-LOOPING.md` rename is Station 00's sanctioned cure for a build loop
(DOCTRINE section 10.1), so each of these is the *receipt* for a loop that was stopped, and neither
receipt is visible to a clone, to CI, or to any station that is not standing on this machine.

Also untracked: `docs/pr-prompts/.queue-sync-ledger.txt` (mtime 2026-08-19) and
`docs/pr-prompts/queue-watch-state.md` (mtime 2026-08-31, and the sweep's section 4C is still
quoting it as the *"freshest station summary"* — a three-week-old snapshot presented as the newest
one).

**DISPATCHED** → Station 00, which is the only station that may commit to the dev tree. Handing
over: commit the two `superseded/*-LOOPING.md` files with the next board PR, alongside
`docs/pipeline/sweep-rotation.json` which this run left dirty. Whether
`.queue-sync-ledger.txt` and `queue-watch-state.md` should be tracked or gitignored is 00's call —
what should not persist is the current third state, where the sweep reads a file no other tree has.

### F6 — The device-bridge git guard could not be installed, because the whole VM transport is down

[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` never reached the
script: the workspace refused to start with
`source path ... is under Plan9 share "c" which is not mounted` and the explicit note
`A Windows update released September 8 prevents Claude's workspace from reaching your files.`

Per the station contract a failed install is a FINDING, not a STOP, and it is never a licence to run
`git` against the mount — which this run did not do, having no mount to run it against. The
practical consequence is for **blind** runs, not for this one: `STATION-CAPABILITIES.md` section 3
tells a blind run that the mount `/sessions/<id>/mnt/ProjectOperations2/` carries the whole of
COLLECT. **On this machine that transport has been unavailable since at least 2026-09-08**, so a
blind run's documented fallback is currently the native Cowork file tools alone
(`NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`), and a run that reaches for the mount first will read its
absence as something new.

**ESCALATED** — the cause is a Windows update on Marco's machine and sits outside the repo entirely,
so no station can fix it and no prompt can be written for it. The question is narrow: does Marco
want this chased (it is his desktop app and his machine), or should the mount simply be treated as
gone until the vendor ships a fix? Until it is answered, every blind run loses one of its two read
transports and must say so rather than report "no news".

## WHAT I DID NOT DO

- **I did not arm, disarm, rename, move or delete any prompt.** Four HOLDs lint ADMIT and two of
  them are annotated as possible duplicates of the two open PRs; arming is Station 00's, on Marco's
  authority, and ADMIT is necessary and not sufficient.
- **I did not commit `docs/pipeline/sweep-rotation.json`.** 04 is read-only on the board and the dev
  tree is on `main`, which nobody commits to directly. It is named in this report for 00.
- **I did not delete, prune or force-prune any worktree or branch**, including the two whose PRs are
  merged. Both are irreversible and one class of them is a documented falsifying probe.
- **I did not touch the watcher clone.** F1's cure is one command and I did not run it: the clone is
  Station 03's lane, and a live agent may be working in it.
- **I did not run the Part 0 static cross-layer audit or the Part 2 live-site pass.** The station doc
  requires ONE named sweep per run, covered completely, and `next-sweep.mjs` named repo-hygiene.
  Spreading this run across Part 0 as well is the shallow pass the doc exists to prevent.
- **I did not re-run the DOCTRINE section 9 probes.** Those belong to the `instrument-honesty` sweep,
  and section 9.6's closing rule is that a section 9 probe run against the wrong corpus inverts its
  own answer.
- **I did not use any needle twice.** `zzQq04HygieneNeedle20260914T2211` and
  `zzQq04BranchNeedle20260914T2211` were minted for this run and are spent by appearing here.
