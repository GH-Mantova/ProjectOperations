# Station 04 — Scanner | 2026-09-10T14:10:11Z–2026-09-10T14:22Z

Sweep this run: **repo-hygiene** (`next-sweep.mjs`, rotation position 3 of 4; previous run
2026-09-10T10:10:16Z). Sighted run — Desktop Commander reached the box on the first call.

## GROUND

```
UTC            2026-09-10T14:10:11Z
origin/main    58a947fe            (git fetch origin --prune, then rev-parse)
dev tree       main @ 58a947fe     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE, so this run was not restricted to read-only on that account
(it is read-only anyway — 04 is read-only on the board by its own authority block).

All three binding documents were read against `origin/main`, not merely off disk:
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, so the working copies read this run are
byte-identical to `origin/main` (DOCTRINE section 9.3 — EMPTY numstat is the real answer; no piped
hash was taken or compared).

Fresh negative-control needle minted for this run: `zzQq04Needle20260910T1410`. It is now written
down and is spent.

## WHAT I MEASURED

**Preflight guard — [CANNOT MEASURE], and it is a finding (F0 below).** The device-bridge git guard
`scripts/pipeline/vm-git-guard.sh` could not be installed: the Linux workspace transport is entirely
absent this session. Verbatim, twice, ~9 minutes apart: `bash failed on resume, create, and
re-resume … source path … is under Plan9 share "c" which is not mounted; create: RPC error -1:
ensure user: user beautiful-gifted-goldberg already exists unexpectedly`. **No `git` was run against
any mount this run** — every git call went through Desktop Commander's PowerShell against the
Windows tree, which is the transport the guard exists to protect and not the one it forbids.

**PREFLIGHT step 4 — the sweep.** `scripts/pipeline/status-sweep.ps1` captured to a file
(`C:\po-sup-fix-scripts\sweep-04-20260910T1410Z.txt`, 133,942 B) and decoded `utf16le` in node, per
DOCTRINE section 9.3's `*>` bullet — the capture did open `FF FE`, so the trap reproduced and the
cure worked. Section 0 controls both PASS. Section 7 verdict, verbatim:
`[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station
worktrees.` Re-measured immediately before writing this file: `index.lock` False, git processes 0.

**Board, [LIVE] from the sweep.** 5 open PRs — `#1852`, `#1850`, `#1845`, `#1832` all CLEAN and
15/0/0 green; `#1823` BLOCKED, 14 pass / 1 fail. Trunk green on `58a947fe` (4 success / 0 failed).
`armed: 0`. I merged nothing, armed nothing, labelled nothing and staged no prompt, so no RULE 2
probe was needed and none is quoted here.

**Concurrency, [MEASURED] and worth recording.** Station 00 was running *inside my window*: it wrote
`C:\ProjectOperations2\.sweep-00-2026-09-10.txt` at 14:12:02Z and created the worktree
`C:/po-wt/bc-00-1408` on branch `docs/00-collect-1408` at 14:18:47Z. That is the documented
00-times-04 collision (`STATION-CAPABILITIES.md` section 6, corrected 2026-09-07T18:1xZ: hourly 00
lands inside ten minutes of every one of 04's six daily runs **by construction**). Not re-raised —
recorded because it is a live corroboration, and because it is why `bc-00-1408` is NOT an orphan.

### The six repo-hygiene questions, each with its control

**1. Orphaned worktrees and their locks.** [MEASURED] `git worktree list` twice, 14:14Z and
14:19:59Z. Registered: the dev tree, `C:/po-vg` `23c91ba9` `[fix/no-rebase-while-checks-run]`,
`C:/po-worktrees/pr1823` `9664f95a` `[feat/ea-gate-reporting-team-permission]`, and — only in the
second reading — `C:/po-wt/bc-00-1408` (live 00, above). **No locks anywhere**: `index.lock` absent
in dev tree and clone; zero `locked` files under `.git/worktrees` in either tree; 0 git processes.
`.git/worktrees` admin dirs are exactly `po-vg` and `pr1823` — the registry and the disk agree.

**2. Stash growth in the watcher clone.** [MEASURED] `git -C C:\po-watcher\ProjectOperations stash
list` → **71** entries; the dev tree → **0**. Newest `stash@{0}: watcher-preflight-autostash on
'main' at 2026-09-10T15:39:44+10:00` (= 05:39:44Z today). Oldest `stash@{70}: WIP on
feat/sharepoint-folder-mappings`. Counts are STATE — re-measure, never quote.

**3. Superseded prompt files littering the queue root.** [MEASURED] depth-1 of
`docs/pr-prompts/` on `origin/main` via `git ls-tree --name-only origin/main -- 'docs/pr-prompts/'`
(trailing slash, no glob): **53** entries = 40 `-HOLD.md` + 5 directories + 8 other tracked files
(`.arming-log.txt`, `BACKLOG.yaml`, `BACKLOG-DECISIONS.md`, `ESCALATIONS.yaml`, `PROMPT-SCHEMA.md`,
`TEMPLATE-sot-reconcile.md`, `shepherd-state.md`, and 00's 1308 breadcrumb). On disk: 50 files, 40
`-HOLD.md`, **0** `-ready.md`, **0** `-LOOPING.md`. `superseded/` holds 375 tracked files and
`archive/` 499 — the retirement paths are being used. **No litter at the queue root.**

**4. Tracked `*-ready.md` at depth 1 — the board trap.** [MEASURED] **0**, tracked and on disk.
POSITIVE control: the identical filter over the identical list found **40** `-HOLD.md`, so the
instrument can return a non-zero. NEGATIVE control (`zzQq04Needle20260910T1410`): 0. **Board trap
is clear.**

**5. Branches merged but not deleted.** [MEASURED] `git ls-remote --heads origin` (asked the remote,
never `git branch -r`) → **14** heads. See F2.

**6. HOLD files tracked on main whose work has already shipped.** [MEASURED]
`scripts/pipeline/triage-holds.ps1` (read-only, `--dequeue` never passed), captured and decoded:
`spent=0 of 40 evaluated · gates-satisfied=9 · still-gated=31 · unreadable=0`, and both of the
script's own controls PASS — `GIT control: PASS` and `SPENT control: PASS — lint-prompt.mjs emitted
exit 3 on the fixture, so the SPENT bucket is measurable`. Its `SPENT BEHIND A REJECT` re-probe of
the 31 rejects also returned 0. **Nothing on this board is spent.**

## WHAT CHANGED

Two writes, both permitted, both named here so 00 can sweep them:

1. `docs/pipeline/sweep-rotation.json` — **LEFT DIRTY on purpose.**
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-10T14:10:11Z` exited 0 and printed
   `advanced: last_index=2 last_run_utc=2026-09-10T14:10:11Z`. Read back:
   `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2 2` (a real 2-line
   change, not a line-ending rewrite). **Station 00 commits this file; 04 may not.**
2. This breadcrumb, untracked at `docs/pr-prompts/`.

Nothing else. No prompt staged, no prompt armed, disarmed, renamed, moved or deleted. No PR opened,
merged, labelled or updated. No branch, worktree, stash or directory created or removed. The dev
tree index was empty before and after (`git status --porcelain` showed only untracked entries and no
staged path, so DOCTRINE section 9.2's shared-index hazard did not apply).

## FINDINGS

### F0 — the device-bridge git guard could not be installed, because the whole Linux transport is gone

[MEASURED] Two attempts, 14:10Z and 14:19Z, identical error, quoted verbatim under WHAT I MEASURED
above. `scripts/pipeline/vm-git-guard.sh` was never reached: there is no `/sessions/*/mnt/` to reach
it through. The station contract is explicit that a failed install is a finding and not a stop, and
that a guard you could not install is never a licence to run your own `git` against a mount — no
mount existed, so nothing was run against one.

Worth saying plainly for the next reader: **this is a different failure from blindness.** Desktop
Commander was present and healthy all run; it is the *secondary* Linux workspace that is unavailable,
which is exactly the transport `STATION-CAPABILITIES.md` section 3 ("No second transport") already
says must never be treated as a fallback. The consequence here is narrow: the guard is uninstalled,
so the *next* run that does have a mount inherits an unguarded bridge.

**DISPOSITION: DEFERRED.** Real, not actionable from here — the guard installs from the VM side and
there is no VM side this run. It becomes urgent the moment a station that *does* have a mount runs
`git` through it, which is the 0-byte-`index.lock` freeze DOCTRINE section 9.2 records three
occurrences of. The next sighted-plus-mounted run should install it and quote the last line.

### F1 — `C:\po-vg`'s "uncommitted work" is a SUPERSEDED DRAFT of a file already on main, and that is what has kept the worktree alive for six days

`status-sweep.ps1` has reported this worktree every run for days, in these words:

```
[LIVE]    orphaned worktree (aborted run leftover -- investigate/prune): C:/po-vg  23c91ba9 [fix/no-rebase-while-checks-run]
[LIVE]       dirty=1 files  age=9018 min
[LIVE]       <-- HOLDS UNCOMMITTED WORK (1 file(s)). PRESERVE OR COMMIT BEFORE PRUNING; 'git worktree remove' will
[LIVE]           refuse, and --force would discard it.
```

That warning is correct as a *rule* and wrong about *this* worktree, and nobody had opened the file.
The age is now **9018 min ≈ 6.3 days** and it has been growing across at least two prior runs.

**[MEASURED] the one file, and it is not unique work.**

| probe | result |
|---|---|
| `git -C C:\po-vg status --porcelain` | `?? scripts/pipeline/check-pipeline-heartbeat.mjs` (6144 B, mtime `2026-09-04 07:55:32Z`) |
| `git cat-file -e origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs` | exit **0** — the path IS on main |
| POSITIVE control, same probe on `status-sweep.ps1` | exit 0 |
| NEGATIVE control, minted path | exit 128, `does not exist in 'origin/main'` |
| `git rev-parse origin/main:<path>` | `84ec92d4…` |
| `git -C C:\po-vg hash-object <path>` | `9c4587fb…` — **differs** |
| `git -C C:\ProjectOperations2 hash-object <path>` | `84ec92d4…` — dev tree matches main exactly |

So the po-vg copy is a *different* revision, which is why it shows as untracked (po-vg's HEAD
`23c91ba9` predates the file). **The direction of the difference is what settles it.** Line-set diff
in node: po-vg **130 lines / 6144 B**, main **138 lines / 6746 B**; non-blank lines present in po-vg
but nowhere in main's version = **2**, and both are earlier forms of lines main still has —
`export function parsePause(text) {` against main's `export function parsePause(text, nowMs =
Date.now()) {`, and `if (!j || typeof j !== "object") return null;` against main's
`if (!j || typeof j !== "object" || Array.isArray(j)) return null;`. Ten non-blank lines exist on
main and not in po-vg. **main's version is the later evolution of this exact draft; po-vg holds
nothing that is not already on main in a strictly stronger form.**

**DISPOSITION: DISPATCHED → Station 00** (which dispatches 03; worktree pruning is not 04's, and 04
is read-only on the board). The handover is: *the preserve-before-pruning condition on `C:\po-vg` is
discharged by measurement — `git worktree remove C:\po-vg` may proceed, and `--force` is not needed
for content reasons.* Re-run the three-row blob comparison above before acting; it is cheap and it
is the falsifying probe. If the blob at `C:\po-vg\scripts\pipeline\check-pipeline-heartbeat.mjs` is
ever anything other than `9c4587fb…`, someone has edited it since 14:1xZ and this finding is void.

### F2 — eight of fourteen remote heads have no open PR, and one of them never had a PR at all

[MEASURED] `git ls-remote --heads origin` → 14 heads (asked the remote; DOCTRINE section 9.4 forbids
`git branch -r`, which reads a local cache `--prune` cannot fully clean). Each head was then resolved
with `gh pr list -R GH-Mantova/ProjectOperations --head <branch> --state all --json
number,state,mergedAt` — `-R` passed on every call and `$LASTEXITCODE` tested before parsing, per
section 9.4's CWD bullet; `mergedAt` read rather than `merged`, per the list-response bullet.

| head | PR | state | commits not on main |
|---|---|---|---|
| `main` | — | — | 0 |
| `fix/status-sweep-trunk-verdict-scoped` | `#1852` | OPEN | live |
| `feat/triage-corpus-union` | `#1850` | OPEN | live |
| `fix/status-sweep-gitproc-scoped` | `#1845` | OPEN | live |
| `fix/vm-git-guard-selftest-and-recursion` | `#1832` | OPEN | live |
| `feat/ea-gate-reporting-team-permission` | `#1823` | OPEN (POSITIVE control) | 24 |
| `chore/sweep-breadcrumbs-20260907-0934` | `#1778` | **MERGED** 2026-09-07T09:41:35Z | 5 |
| `feat/crm-account360-v2-s1` | `#1612` | CLOSED unmerged | 2 |
| `feat/verdict-home-resolver` | `#1703` | CLOSED unmerged | 3 |
| `feat/verdict-home-resolver-v1` | `#1707` | CLOSED unmerged | 3 |
| `fix/verdict-home-resolver-v1` | `#1708` | CLOSED unmerged | 2 |
| `fix/verdict-home-resolver-v1-impl` | `#1705` | CLOSED unmerged | 1 |
| `fix/classify-policy-nested-tests` | `#1571` | CLOSED unmerged | 1 |
| `fix1483` | **NONE** | never opened | 28 |

Every ref matched its `ls-remote` SHA (`refMatchesRemote=True` on all eight), so no stale tracking
ref is in play. POSITIVE controls: `origin/main..origin/main` → 0; the open `#1823` head → 24.

🔴 **The commit count is NOT a safety test, and this board demonstrates why.**
`chore/sweep-breadcrumbs-20260907-0934` is **merged** and still reads **5 commits not on main** —
because every merge here is a squash, so branch commits are never ancestors (DOCTRINE section 9.4
already records that `--merged origin/main` is blind to squash merges; this is the same blindness
reached from the counting side). **A run that reads "5 ahead" as "5 commits of unique work" will
refuse to delete a fully-landed branch forever.** The sound test is CONTENT.

**`fix1483` is the one worth naming, and content clears it.** It is a surviving copy of MERGED PR
`#1483`'s head branch (`feat/scope-s2-wbs-table-shell`, which GitHub deleted on merge — it is absent
from `ls-remote`). Its tip is `9de07267`, `2026-09-02T12:27:29+10:00`, author `PR Supervisor`,
19 minutes before that PR merged at `2026-09-02T02:46:46Z`. `gh pr view 1483` → `"state":"MERGED"`.
It carries 8 changed files including a 944/810 rewrite of
`apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx`. **Four of the eight blobs are byte-identical
to main's tip today**, and for the big one: the branch blob `00805331…` **is reachable from
`origin/main`'s history for that exact path**, found at commit `fa16ead5` by walking all 18 commits
that touch it (POSITIVE control: main's own tip blob was found by the same walk, 1 hit). So
`#1483`'s squash landed precisely that content and main has since moved on. **`fix1483` holds zero
unique content.**

**DISPOSITION: ESCALATED.** Branch deletion is irreversible (DOCTRINE section 5.4) and no agent may
do it. The question for Marco, with RULE 1 applied:

- **(a) COMPLETE AND ADDITIVE — turn on GitHub's "automatically delete head branches" for the repo,
  then hand-delete the eight above that are settled.** Passes both halves: it fixes the recurrence
  as well as today's backlog, and it destroys no data entry — every one of these is either merged
  (`#1778`, and `fix1483`'s content via `#1483`) or belongs to a PR its own author closed. It also
  removes the *cause*: `#1778` and `fix1483` survived only because auto-delete is off or was bypassed.
- **(b) Delete only the two provably-landed heads (`chore/sweep-breadcrumbs-20260907-0934`,
  `fix1483`) and leave the five closed-unmerged ones.** Fails the *future* half of RULE 1 — the next
  merged branch survives the same way — but is the smallest possible move.
- **(c) Leave all of them.** Fails the *immediate* half: the head list is now 14 for a 5-PR board,
  and `feat/crm-account360-v2-s1` in particular is the subject of the standing escalation
  `pr-1612-closed-unmerged-branch-holds-the-only-copy`, which cannot be closed while it is unread.

⚠️ **Do NOT let (a) or (b) touch `feat/crm-account360-v2-s1` (`#1612`) without reading that
escalation first** — its whole premise is that the branch may hold the only copy of that work, and I
did not test its content this run. The four `verdict-home-resolver` heads are the kill-loop duplicates
DOCTRINE section 9.5 already names, whose work landed via `#1704`; they are listed for completeness,
not re-raised.

### F3 — Station 00 parks a 132 KB machine-state dump in the REPO ROOT for the length of its run, and it is not gitignored (SELF-CORRECTED below — it is transient, not permanent)

[MEASURED] `C:\ProjectOperations2\.sweep-00-2026-09-10.txt`, **132,290 B**, mtime `14:12:02Z` —
written by the concurrent 00 run while this sweep was in progress. It shows as `??` in
`git status --porcelain`. `git check-ignore -v '.sweep-00-2026-09-10.txt'` → **exit 1, no output**
(not ignored), against POSITIVE control `git check-ignore -v 'docs/qa/qa-findings.md'` → **exit 0,
`.gitignore:116:docs/qa/qa-findings.md`**. Both forms were run on a FILE, never a directory, because
section 9.2 records that the directory form's silence is byte-identical to a true negative.

**No harm has been realised yet:** `git ls-tree -r --name-only origin/main` → 3464 tracked files,
of which **0** match `*.sweep-*` (POSITIVE control `CLAUDE.md` → 1; NEGATIVE control, minted needle
→ 0). So this is a latent hazard, not damage: one `git add -A` by any station, in a tree the
supervisor's own PRs are built from, commits a dated dump of the board's internal state to `main`.
The dev tree's index is shared between concurrent chats (section 9.2), which is exactly the
condition under which a stray `add -A` happens.

🔴 **SELF-CORRECTION, [MEASURED] 2026-09-10T14:23:52Z — the file is GONE, and the version of this
finding I wrote eleven minutes earlier was a permanent claim built on a transient reading.**
`Test-Path 'C:\ProjectOperations2\.sweep-00-2026-09-10.txt'` → **False**; POSITIVE control
`Test-Path CLAUDE.md` → True; NEGATIVE control, minted path → False; `.sweep-*` files in the repo
root now → **0**. Station 00 finished its run and removed its own capture. **So 00 does clean up
after itself, and the exposure window is the length of an 00 run — about eleven minutes, observed —
not the days I was implicitly asserting by writing it up from one `git status`.**

That is DOCTRINE section 7's `[LIVE]` rule biting in the most ordinary way available: the reading
was true when taken and false before the report was finished. It is recorded rather than quietly
deleted because the *next* run to meet this file at :12 past the hour will reach for the same
conclusion, and because the shape — 00 and 04 overlap by construction, so 04 will keep sampling 00's
scratch files mid-write — is structural and will recur.

**What survives the correction, and it is still worth a line of `.gitignore`:** the capture is
written to a path that is not ignored, into a tree whose index is shared between concurrent chats,
during a window in which another station is by construction also running. Nothing has been committed
(0 of 3464 tracked files match), so this is a narrow latent hazard and not damage.

**DISPOSITION: DISPATCHED → Station 00** — but as a **low-priority** item after the correction
above, not as the tree-dirtying defect the first draft made it. Two one-line options, RULE 1 order:
**(a) complete and additive — have 00 write the capture to `C:\po-sup-fix-scripts\` like every other
station capture, AND add `.sweep-*.txt` to `.gitignore`.** Both halves pass: the tree stops being
dirtied at the source, and the ignore line means a future writer that forgets cannot commit it
either; nothing anyone typed is destroyed. **(b) `.gitignore` line only** — removes the commit hazard
but leaves the root `??` entry appearing and vanishing mid-run, which is the reading hazard that
produced the first draft of this very finding. This is a `.gitignore` plus a `scripts/` change, so
it is Marco's to merge, but authoring it is 00's lane.

### F4 — 146 review escalations exist on exactly one disk, inside a TRACKED archive directory

[MEASURED] `docs/pr-prompts/archive/review-escalations-516-1346/` — **146 files**, directory mtime
`2026-09-02 23:58:25Z`, showing as a single `??` entry in `git status`. Names are
`pr-<N>-review-{fix,block,verify}.md` for PRs 516–1346 (e.g. `pr-1002-review-verify.md`,
`pr-1014-review-block.md`). `git check-ignore -v` on a FILE inside it → **exit 1**: it is not
ignored, merely never committed. Its parent `docs/pr-prompts/archive/` is tracked and holds **499**
files on `origin/main`, so somebody archived these into the right place and the commit never
happened.

This is the shape the report contract warns about — *"if your finding lives only in a gitignored
path, you have not reported it"* — with one twist: the path is not ignored, so nothing suppressed
it. It has simply been sitting untracked for **8 days**, one `git clean` away from gone, and
`git clean` is a command DOCTRINE section 9.2 already has to warn stations off for a different
reason.

**DISPOSITION: DISPATCHED → Station 00.** `docs/` is inside 00's lane and inside
`^(tests|docs)/`, so a board PR can land all 146 with no human. The decision 00 must make first, and
it is a real one: **commit them, or delete them.** I did not read their contents and take no view;
what I can say is that leaving 146 files untracked-but-not-ignored is the worst of the three
outcomes, because it survives only by luck.

### F5 — the watcher clone's stash loop is at 71 and still taking on new entries

[MEASURED] 71 stashes in `C:\po-watcher\ProjectOperations`, 0 in the dev tree. Newest is
`watcher-preflight-autostash on 'main' at 2026-09-10T15:39:44+10:00` (05:39:44Z **today**), so the
loop is live, not historical. DOCTRINE section 9.2 records the mechanism — the launcher's preflight
stashes on every start and nothing ever pops — and prescribes `git stash drop`, **never `pop`**.

This is an existing dispatch to Station 03, not a new finding; it is re-measured here because the
standing note carries a number and a number is state. **DISPOSITION: DISPATCHED → Station 03**, as
an update to the open clone-hygiene dispatch: the count has moved and the growth trigger is met.
Only 03 may act in the clone.

### F6 — the worktree-escapee scan's corpus is `C:\po-worktrees` and siblings, so it cannot see the nine `C:\po-*` trees beside them

`status-sweep.ps1` reports `[LIVE] worktree-registry-escapees: none found under known roots`, and
that is true of the roots it checks. [MEASURED] the roots: `C:\po-worktrees` = 1 subdir (`pr1823`),
`C:\po-wt` = 1 (`bc-00-1408`, live 00), `C:\po-watcher-worktrees` = **0**. All accounted for.

But `Get-ChildItem C:\ -Directory -Filter 'po-*'` returns **14** directories, and nine of them are
outside every known root. Probed individually for a `.git` file or directory:

| directory | kind | contents | mtime |
|---|---|---|---|
| `po-fix923`, `po-fix933`, `po-sec-fix`, `po-smoke`, `po-sup-fix` | no git | **0 files, 0 dirs** | all `2026-09-03 02:45:36Z` |
| `po-preserve` | no git | 8 files, 7 dirs | `2026-09-05 00:13:45Z` |
| `po-work` | no git | 0 files, 1 dir | `2026-09-05 00:14:11Z` |
| `po-secrets` | no git | 3 files | `2026-09-02 22:59:12Z` |
| `po-vg` | **WORKTREE (`.git` file)**, head `fix/no-rebase-while-checks-run` | 19 files, 12 dirs | F1 |

**Nothing here is an escapee** — none of the nine is a git worktree that the registry has lost, so
the sweep's verdict is correct as stated. Two things are still worth recording. First, **five empty
shells sharing one mtime to the second** are the residue of a `worktree remove` batch on 09-03 that
took the contents and left the directories; they are inert. Second, and this is the part with teeth:
**the escapee scan's corpus is defined by a list of root paths, and this box creates fix trees as
`C:\po-<name>` siblings, not under those roots.** That is `STATION-CAPABILITIES.md` section 1's own
rule — *a sweep whose corpus is a fixed list will keep missing what is added beside it* — pointed at
a different list. Had `po-vg` been created one level up as a sibling rather than registered, the
scan would report `none found` with equal confidence.

⚠️ `po-secrets` is reported by **name, count and mtime only**. I did not open it. Whatever it holds,
it sits unversioned outside every repo on a machine whose trees stations routinely `clean` — that is
Marco's to look at, not an agent's.

**DISPOSITION: DEFERRED.** Nothing here is broken today and the empty shells cost nothing. It
becomes urgent if a fix tree is ever created as a `C:\po-*` sibling *and* registered as a worktree —
then the sweep's `none found` is a false negative on the one question it exists to answer. The cheap
change, if 00 wants it, is to widen the scan from a root list to `C:\po-*` and classify by the
presence of a `.git` file; that is a `scripts/` change, so Marco merges it.

### F7 — `C:\po-worktrees\pr1823` is a stale checkout of a LIVE PR's branch, 16 hours behind its own head

[MEASURED] The worktree sits at `9664f95a`; `git ls-remote --heads origin
feat/ea-gate-reporting-team-permission` → **`aabc5e6f`**. `#1823` is OPEN and RED (14 pass / 1 fail).
`dirty=0` — it holds nothing uncommitted. Age 960 min.

`status-sweep.ps1` classifies it as `orphaned worktree (aborted run leftover -- investigate/prune)`,
which is right about *aborted* and could mislead about *safe*: it is checked out on the head branch
of an open PR, so pruning it releases that branch and is exactly the sort of move that looks
destructive after the fact. It is not — the branch lives on the remote and the worktree is behind it
— but the sweep line does not say so and the next reader has to re-derive it.

**DISPOSITION: DISPATCHED → Station 00** (to dispatch 03 with F1). Pruning is safe on content
grounds: `dirty=0`, and the remote head is ahead of the local one, so there is nothing here the
remote does not have. Re-measure both SHAs immediately before acting — `#1823` is live and this
reading expires.

## WHAT I DID NOT DO

- **Staged no prompt and armed nothing.** The station budget allows two staged `-HOLD` prompts and I
  used zero. The two changes this sweep most wants — branch deletion (F2) and the `.gitignore` plus
  capture-path change (F3) — are respectively irreversible and a `scripts/` edit; neither belongs in
  a prompt authored by a read-only station, and F2 needs Marco's answer before anything is written.
- **Deleted, pruned, dropped or cleaned nothing.** No `worktree remove`, no `stash drop`, no branch
  delete, no `git clean`. Every one of those is another station's or Marco's, and three of them are
  irreversible.
- **Did not run `git checkout .` / `reset --hard` / `stash pop` / `git clean` in the dev tree**, and
  did not commit the rotation advance — 04 may not commit to `main`.
- **Did not touch the watcher clone beyond reads.** `stash list`, `status --porcelain` and
  `rev-parse` only; no checkout, commit, push or fast-forward. The clone is 2 behind `origin/main`
  (`e4ecd9a5`, an ancestor of `58a947fe`) with 2 untracked review files (`pr-1850`, `pr-1852`) —
  normal review-lane output under DOCTRINE section 9.5's three-homes rule, not drift, and only 03
  may fast-forward it in any case.
- **Did not open `C:\po-secrets`** (F6) or the 146 archived review files (F4).
- **Did not test `feat/crm-account360-v2-s1`'s content** (F2). Its standing escalation says the
  branch may hold the only copy; answering that properly is a sweep of its own and guessing at it
  inside a hygiene pass is how a real copy gets deleted.
- **Ran no live-site pass and no Part 0 static audit.** The station doc's AUTHORITY block says take
  ONE named sweep per run and cover it completely, and `next-sweep.mjs` named repo-hygiene. A shallow
  pass over everything is the failure that block exists to prevent.
- **Quoted no RULE 2 probe.** I merged nothing, so the probe was not needed; running it would have
  produced a reading with no decision behind it.

---

**Validator.** `node scripts/pipeline/check-breadcrumb.mjs` → exit **0**, `CLEAN`,
`structure: 2 checked, 0 malformed`, this file `ADMIT`. It also printed, correctly:
`NOTE … is UNTRACKED — it reaches nobody until a board PR commits it`.

**For Station 00's collect.** Two untracked paths from this run need committing:
`docs/pr-prompts/00-04-scanner-2026-09-10-1410-po-vgs-uncommitted-file-is-a-superseded-draft-and-seven-dead-branches-outlive-their-prs.md`
(this file) and `docs/pipeline/sweep-rotation.json` (the rotation advance, left dirty on purpose —
if it is not committed, the next 04 run repeats repo-hygiene and the rotation stops turning).
