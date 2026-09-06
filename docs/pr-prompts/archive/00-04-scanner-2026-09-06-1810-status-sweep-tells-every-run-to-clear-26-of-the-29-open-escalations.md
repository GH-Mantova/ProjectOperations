# Station 04 — Scanner | 2026-09-06T18:10:16Z–2026-09-06T18:2xZ

## GROUND

```
UTC            2026-09-06T18:10:16Z
origin/main    414cac0d              (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 414cac0d       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                     (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE — this run was not read-only on that account.

Named sweep this run: **repo-hygiene** (`node scripts/pipeline/next-sweep.mjs` → rotation position
3 of 4; previous run 2026-09-06T14:10:20Z). Advanced afterwards to `instruction-drift`.

## WHAT I MEASURED

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` succeeded on `LAPTOP-E6NHU4E4`;
host clock `2026-09-06T18:10:16Z`. **This was a SIGHTED run.** First `-Command` call died on the
DOCTRINE §9.1 `$`-expansion trap (`$PSVersionTable` arrived as `System.Collections.Hashtable`);
every subsequent probe went through an interactive `interact_with_process` session, which does not
expand.

**Device-bridge git guard.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
→ exit 0, last line: `persistence controls passed: .bashrc byte-identical on re-run; login shell
resolves shim`. Installed. No `git` was run against the mount this run.

**Binding documents read from a tree proved equal to `origin/main`.** [MEASURED]
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, which per §9.3 is the real answer. All three
read in full from the working copy on that basis.

**Sweep verdict.** [MEASURED] `& scripts\pipeline\status-sweep.ps1 *>&1 | Set-Content <file>` →
`SWEEP-EXIT=10`, 272 lines captured (captured to a file because the script returns early and hides
its own §7 verdict). §0 both positive controls PASS. §7: `SAFE TO ACT: no board mutation in
progress, no recent remote activity, no live station worktrees.`

**Board, for context only (not this run's sweep).** [MEASURED] 3 open PRs, all Marco's by
`classifyPolicyFiles`' own migrations clause: `#1713` CLEAN 15/0/0 · `#1709` CLEAN 15/0/0 · `#1699`
RED 12/3/0. armed `*-ready.md` = **0**. Trunk green on `414cac0d` (4 success / 0 failed).
I merged nothing, armed nothing, and did not re-run the RULE 2 probe — nothing this run needed it.

**Board trap — CLEAN, with controls.** [MEASURED] `git ls-tree --name-only origin/main --
docs/pr-prompts/` (trailing slash, depth 1 per §9.2) → 88 entries, of which 5 are trees and 83 are
files. Tracked `*-ready.md` at depth 1 = **0**. POSITIVE control on the same query: `*-HOLD.md` =
**74**. NEGATIVE control (needle minted this run): `*zzQq04Needle20260906T1815*` = **0**. So the
zero is a real negative, not a blind query.

**Queue root, disk vs tracked.** [MEASURED] 86 files on disk at depth 1 — 74 HOLD, 0 ready, 2
breadcrumbs, 10 non-prompt state files. Set difference against the 83 tracked files: nothing tracked
is missing from disk; the 3 untracked are `.queue-sync-ledger.txt`, `queue-watch-state.md` and
`pr-watcher-verdict-home-resolver-LOOPING.md` (untracked, arms nothing, linter refuses it — leave
it). **No phantom `R100 HOLD→ready` staging**: `git diff --cached --name-status` → EMPTY, and
`status --porcelain` rows matching `^(R|D| D|RD)` → **0**.

**Subfolders.** [MEASURED] `superseded` 330 · `archive` 618 · `needs-marco` 153 (29 `*.md` at depth
1) · `processed` 4100 · `blocked` 131 · `failed` 41 · `no-pr-opened` 109 ·
`binned-shipped-20260720` 37 · `paused` 10 · `awaiting-review` 0 · `reviewed` ABSENT.

**Worktrees and locks.** [MEASURED] dev-tree registry holds 2 (`C:/ProjectOperations2` @ `414cac0d`
[main]; `C:/po-vg` @ `23c91ba9` [`fix/no-rebase-while-checks-run`]). Watcher clone registry holds 1.
`locked` files under `.git/worktrees/*` → **0**, POSITIVE control on the same search shape
(`-Filter 'gitdir'`) → **1**, NEGATIVE control → 0. `index.lock` in dev tree and clone → **False /
False**. No stale lock anywhere.

**Two breadcrumbs are sitting uncollected in the queue root** — `00-00-supervisor-...-1612-...md`
(16:26Z) and `00-00-supervisor-...-1708-...md` (17:30Z). Both are 00's own and both correspond to
merged PRs (`#1726`, `#1727`), so this is normal lag, not a loss.

**Untracked review artifacts in the dev tree.** [MEASURED]
`git ls-files --others --exclude-standard -- docs/pr-reviews` → **40**.

## WHAT CHANGED

1. **Staged one prompt, `-HOLD`, untracked** —
   `docs/pr-prompts/pr-sweep-stale-check-retires-live-escalations-HOLD.md`. [MEASURED]
   `node scripts/pipeline/lint-prompt.mjs <it>` → `ADMIT (size 1)`, `LINT-EXIT=0`. A `-HOLD`
   filename matches no watcher glob, so this arms nothing. **I armed nothing and I renamed,
   moved and deleted nothing.**
2. **Advanced the sweep rotation** —
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-06T18:11:59Z` →
   `advanced: last_index=2 last_run_utc=2026-09-06T18:11:59Z`. **`docs/pipeline/sweep-rotation.json`
   is LEFT DIRTY (` M`) in the dev tree — Station 00 must commit it**, because 04 may not commit to
   the shared tree. Next sweep now reads `instruction-drift` (position 4 of 4).
3. Two scratch captures written outside the repo:
   `C:\po-sup-fix-scripts\sweep-04-20260906-1810.txt`, `...\triage-04-20260906-1820.txt`.

Nothing else was written. No `git` write, no branch operation, no label, no merge.

## FINDINGS

### F1 — S2 — `status-sweep.ps1` §5 tells the reader to clear 26 of the 29 open escalations, every run

[MEASURED] from this run's capture: §5 emitted **126 `[STALE]` lines** naming **26 distinct**
`needs-marco/*.md` files, against **29** `*.md` at depth 1 in that folder. The project memory index
carries 23 of those as OPEN. So the sweep contradicts the escalation register on almost every row it
prints — and the row it prints says *"escalation is DEAD, clear it. Do NOT report it as pending."*

Two independent errors, one line (`status-sweep.ps1`, the `Line "STALE"` site), both pushing the
same way — **retire a live escalation**:

**(a) CLOSED is collapsed into MERGED.** `if ($st.state -eq "MERGED" -or $st.state -eq "CLOSED")`.
A PR that closed *unmerged* is the **premise** of a whole class of escalation. Worked instance:

```
sweep printed: [STALE] pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md
               references #1612 which is CLOSED -- escalation is DEAD, clear it.

live:  git ls-remote --heads origin feat/crm-account360-v2-s1
         -> 4638600aaed79448d582fda485fc7d440ac9c1f9
       git merge-base --is-ancestor 4638600a origin/main   -> exit 1  (NOT on main)
       gh pr list --head feat/... --state all              -> #1612 CLOSED, mergedAt empty
POS control: git merge-base --is-ancestor 414cac0d origin/main -> exit 0 (probe can answer YES)
```

The branch is still there, the work is still only there, and the instrument says the escalation is
dead. Clearing it is the step that would then let a branch-prune delete the only copy.

**(b) Every `#NNNN` in the body is read as the escalation's subject.** The regex
`(?:pull/|#)(\d{3,5})` cannot distinguish a premise from a citation, so
`label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md` — which cites 30 merged
PRs as its *evidence* — generated **30** separate "clear it" instructions about itself.

Nothing warns; nothing is empty. §9.6 never fires. This is §7's shape, in the safe-to-act instrument
every station is told to obey.

**DISPOSITION: ACTIONED (staged, not armed).** The fix is written and lint-clean as
`docs/pr-prompts/pr-sweep-stale-check-retires-live-escalations-HOLD.md` (`ADMIT`, exit 0). It is
additive per RULE 1 — it keeps every true `[STALE]` line and splits the verdict three ways
(MERGED via `mergedAt` → STALE unchanged; CLOSED-unmerged → `[FILE]`, "read the file before
clearing"; subject-vs-evidence separated by filename / first heading). **Station 00 arms it, or
does not — 04 does not arm.**

### F2 — S3 — the verdict-home-resolver duplicate family is FIVE PRs, not four, and DOCTRINE §9.5 says four

[MEASURED] `gh pr view <n> --json number,state,mergedAt,headRefName,title`:

```
#1703 CLOSED head=feat/verdict-home-resolver
#1704 MERGED head=fix/verdict-home-resolver          mergedAt=2026-09-06T11:41:36Z
#1705 CLOSED head=fix/verdict-home-resolver-v1-impl   <-- not named anywhere
#1707 CLOSED head=feat/verdict-home-resolver-v1
#1708 CLOSED head=fix/verdict-home-resolver-v1
```

DOCTRINE §9.5 — landed on `main` in `#1727` about forty minutes before this run — records the kill
loop as building it **four** times and names `#1703 · #1704 · #1707 · #1708`. `#1705` is a fifth,
same title family, same `VERDICT_HOME_RESOLVER_V1` marker, on a fifth branch. The correction was
right about everything else; the count is one short. [MEASURED] `#1704`'s squash commit on main is
`188cce05`.

**DISPATCHED → Station 00.** One clause in §9.5 (`four` → `five`, add `#1705`), foldable into the
next board PR. It changes no rule; it changes a number a later reader will use to decide whether the
loop is fully accounted for.

### F3 — S3 — 10 tracked HOLD prompts are SPENT: the work has shipped and the file is still armable

[MEASURED] `scripts\pipeline\triage-holds.ps1` (read-only, captured to a file), both its own controls
PASS (`GIT control: PASS`, `SPENT control: PASS — lint-prompt.mjs emitted exit 3 on the fixture`).
Totals `spent=10 gates-satisfied=27 still-gated=37 unreadable=0 of 74`. The ten:

```
pr-ci-rerun-on-unlabel-HOLD.md                    pr-rates-11b3-resolver-sortorder-surface-HOLD.md
pr-ew-s2c-alloc-rejection-path-HOLD.md            pr-settings-home-s1-cards-tabs-counts-HOLD.md
pr-ew-s3-alloc-alerts-HOLD.md                     pr-vmguard-s2-preflight-installs-guard-HOLD.md
pr-lint-requires-merged-gate-unevaluated-HOLD.md  pr-watchdog-dead-inprog-guard-HOLD.md
pr-rates-11b2-resolver-isactive-surface-HOLD.md   pr-watchdog-restart-grace-HOLD.md
```

All ten are tracked at depth 1 on `origin/main`. Two of them are today's merges
(`pr-ci-rerun-on-unlabel` ← `#1721`, `pr-lint-requires-merged-gate-unevaluated` ← `#1722`).

🔧 **One is a standing-note discharge.** `pr-vmguard-s2-preflight-installs-guard-HOLD.md` now lints
**exit 3 (SPENT)**. DOCTRINE §10.6 records it at 2026-09-06T08:1xZ as `ADMIT`, **not** exit 3, and
the standing memory note reads *"DO NOT ARM — NAMED FOR MARCO"*. `#1720` landed the PREFLIGHT guard,
so the premise died. Retiring the file discharges the note rather than leaving a permanent
don't-touch on a file whose work is done.

**DISPATCHED → Station 00.** Retire all ten to `docs/pr-prompts/superseded/` in a board PR. 04 is
read-only on the board and bulk-deletes nothing.

### F4 — S2 — the watcher clone is 19 commits behind main and its own `origin/main` is stale too

[MEASURED] clone `HEAD` = `16ddb58b` [main]; `git -C C:\ProjectOperations2 rev-list --count
16ddb58b..414cac0d` → **19**. The clone's per-tree `origin/main` reads `188cce05` — which is
`#1704`'s squash commit — so the clone is 4 behind even its own stale ref, and **19 behind real
`main`**. §9.5's per-tree `origin/main` trap, reproduced live.

Consequence, and it is not abstract: the watcher runs `index.mjs` **from the clone**, and `#1704` is
the verdict-home-resolver. **The running watcher is on pre-`#1704` code** — i.e. without the resolver
that finds a review verdict in the clone, the archive or the dev tree. [MEASURED] the clone is
`dirty=2`, and both dirty files are exactly the artifacts that resolver exists to find:
`?? docs/pr-reviews/pr-1709-review.md` and `?? docs/pr-reviews/pr-1713-review.md` — the two open
green PRs. Clone stash count **69** (dev tree: **0**) — the closed-loop stash growth §9.2 names.

**DISPATCHED → Station 03.** Preserve both review files before anything else, `stash drop` never
`pop`, fast-forward the clone, restart idle. This re-measures and supersedes the 16:12Z dispatch's
step (2) (which read "18 behind at 16ddb58b, stash 69, dirty=2 / `pr-1709-review.md`"): the behind
count is now **19** and the second dirty file is `pr-1713-review.md`.

### F5 — S4 — merged-but-undeleted branches: ZERO. Seven stale branches, all closed-unmerged or orphan

[MEASURED] `git ls-remote --heads origin` (asking the remote, per §9.2 — the local cache reads **20**
against a truth of **11**). 11 heads = `main` + 10. Three belong to the open PRs (`#1713`, `#1709`,
`#1699`). The other seven:

```
feat/crm-account360-v2-s1          -> #1612 CLOSED unmerged   (F1's worked instance)
feat/verdict-home-resolver         -> #1703 CLOSED
feat/verdict-home-resolver-v1      -> #1707 CLOSED
fix/verdict-home-resolver-v1       -> #1708 CLOSED
fix/verdict-home-resolver-v1-impl  -> #1705 CLOSED
fix/classify-policy-nested-tests   -> #1571 CLOSED
fix1483                            -> NO PR AT ALL
NEG control: zzQq04NeedleBranch20260906T1815 -> NO PR
```

`#1704` MERGED and its branch `fix/verdict-home-resolver` is **gone** from the remote, so
delete-on-merge is working. **The standing note "merged-but-undeleted is ONE, not 22" is now ZERO** —
re-measure it, do not quote either number.

⚠️ **Do not read "not an ancestor of `origin/main`" as "stranded work".** Every merge on this board
is a squash, so a merged branch tip is never an ancestor (§9.2). The PR state is the instrument; the
ancestry probe is not. I ran ancestry only for `#1612`, where the PR state had already established
*closed unmerged*.

**DISPATCHED → Station 00.** `pr-hygiene-s1-guarded-branch-prune-HOLD.md` is already in the queue at
`ADMIT` and is the staged fix for exactly this class. Note the ordering constraint from F1: **the
`#1612` branch must not be pruned while its escalation is unresolved** — and §5 is currently telling
every reader that escalation is dead.

### F6 — S4 — `C:\po-vg` orphaned worktree, 58 h old, holding one unpushed file

[MEASURED] `C:/po-vg` @ `23c91ba9` on `fix/no-rebase-while-checks-run`, age 3498 min, dirty=1:
`?? scripts/pipeline/check-pipeline-heartbeat.mjs`. That branch is **not** among the 11 remote heads,
so the file exists in exactly one place on earth. Existing escalation
`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md` — which §5 tags
`[STALE]` five times over merged PRs it cites as context, i.e. F1(b) hitting a live escalation.

**DEFERRED.** It is 03's tree and already escalated; nothing is rotting faster than the escalation
itself. It becomes urgent the moment anyone runs a worktree prune — `git worktree remove` will refuse
and `--force` discards the file. What would make it urgent: F5's branch-prune prompt being armed.

## WHAT I DID NOT DO

- **Armed nothing, merged nothing, labelled nothing, moved nothing.** 04 is read-only on the board;
  the one staged file is `-HOLD` and matches no watcher glob.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** It is left ` M` in the dev tree by design —
  the dev tree is on `main`, which nobody commits to directly, and 04's authority row is
  *Create a PR: NO*. **Station 00 must commit it with the next board PR or the rotation silently
  stops.**
- **Did not run the RULE 2 `marco.:true` probe.** Nothing this run proposed a merge, so a probe with
  a live/decoy-tree trap in it would have been evidence about nothing. Not "the board is clear" —
  UNMEASURED.
- **Did not touch the watcher clone, `C:\po-vg`, the 69 stashes, or the 40 untracked
  `docs/pr-reviews/` files.** All 03's, all reported.
- **Did not do Part 0 (static cross-layer audit) or Part 2 (live-site visual patrol).** The station
  doc says take ONE named sweep and cover it completely, and `next-sweep.mjs` named repo-hygiene. A
  shallow pass over everything is the failure the rotation exists to prevent.
- **Did not stage a second prompt.** F2–F6 are all either one-clause doc corrections or already have
  a staged prompt (`pr-hygiene-s1-guarded-branch-prune-HOLD.md`); minting a second would duplicate
  work already in the queue, which is §10.6's exact trap.
- **Did not re-derive DOCTRINE §9.5's watcher-log correction.** It landed in `#1727` forty minutes
  before this run and I read it as current; F2 corrects one number in it, nothing else.
