# Station 04 — Scanner | 2026-09-14T06:10Z–2026-09-14T06:22Z

## GROUND

```
UTC            2026-09-14T06:10Z
origin/main    9d8a06d6            (fetch first, then rev-parse)
dev tree       main @ 73048f1a     C:\ProjectOperations2   (1 behind origin/main)
doc version    1
bootstrap      1
```

Sweep this run: **repo-hygiene** (`node scripts/pipeline/next-sweep.mjs` → rotation position 3 of 4;
previous run 2026-09-11T02:11:09Z). Sighted run — Desktop Commander shell live on the Windows host.

## WHAT I MEASURED

- [MEASURED] **Binding docs are not stale.** `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
  docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/04-scanner.md` → **empty output**, in the
  DEV tree. Per the preflight's own list that is the real answer, so the working copies were read. No
  piped `hash-object` was used (§preflight: unsound under `powershell.exe`).
- [MEASURED] `status-sweep.ps1` §7 → `SAFE TO ACT: no board mutation in progress, no recent remote
  activity, no live station worktrees.` Captured to a file (the script returns early and hides §7 when
  piped). Nothing on the board was mutated this run regardless.
- [MEASURED] **Host clock trap, first-hand.** `Get-Date -Format "yyyy-MM-ddTHH:mmZ"` returned `16:10Z`;
  `(Get-Date).ToUniversalTime()` returned `06:10Z`. The host is Brisbane (UTC+10) and the `Z` in the
  format string is a literal, not a conversion. Every timestamp in this report is the `ToUniversalTime`
  form. A run that quotes the first form is ten hours in the future.
- [MEASURED] **`C:\ProjectOperations2` is 1 commit behind `origin/main`, and that lag masquerades as
  queue clutter.** Six prompt files read as tracked-on-main-but-absent-from-disk
  (`pr-ratescol-s0..s4-*-HOLD.md`, `pr-rates-column-edit-ui-HOLD.md`). `git show --name-status 9d8a06d6`
  shows all six are that commit's own adds/retire. **Not a finding** — recorded so the next run does not
  re-file it.
- [MEASURED] **Board trap: CLEAN.** `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` filtered
  to depth 1 → **46** entries, `*-ready.md` → **0**, `*-LOOPING.md` → **0**. POSITIVE control
  `*-HOLD.md` → **32**. NEGATIVE control (freshly minted needle) → **0**.
- [MEASURED] **Worktree locks: none anywhere.** Recursive `index.lock` search over
  `C:\ProjectOperations2`, `C:\po-watcher\ProjectOperations`, `C:\po-fix1891`,
  `C:\PR-Master\worktrees\po-vg`, `C:\PR-Master\worktrees\pr1823` → none in any of the five. Running
  `git` processes → **0**. The standing worry that a stale worktree implies a permanent lock does not
  hold today.
- [MEASURED] **§9 falsifying probe re-run — the clone-dirty bullet stands.** Against
  `C:\po-watcher\ProjectOperations` in the same minute: `git status --short` → **4**;
  `git status --porcelain --untracked-files=no` → **1**. They disagree, so the bullet is not yet
  overtaken. The sweep's `[LIVE] watcher clone: branch=main dirty=4 <-- the watcher may refuse to start`
  is again the untracked-inclusive number.
- [MEASURED] **§9 falsifying probe re-run — the `verdict-home-resolver` head count is still four.**
  `git ls-remote --heads origin` holds `feat/verdict-home-resolver`, `feat/verdict-home-resolver-v1`,
  `fix/verdict-home-resolver-v1`, `fix/verdict-home-resolver-v1-impl` — **4**, unchanged. No fifth head,
  so the §9 paragraph that names this as its falsifier is not wrong.
- [MEASURED] **Remote branch hygiene.** 13 remote heads; 3 open PRs (#1915 #1916 #1918); **9** heads with
  no open PR and not merged into `main`; `git branch -r --merged origin/main` → **1**
  (`staleprobe/main`, a deliberate probe branch). Four of the nine are the `verdict-home-resolver` family
  above.
- [MEASURED] **Breadcrumb collection is healthy.** 12 `00-*.md` at depth 1: 8 tracked on `origin/main`,
  4 untracked — all four written today, newest 06:13Z. Collection lag is hours, not days. The 8 tracked
  ones (oldest 2026-09-11) have landed but were never moved to `archive/`; that is cosmetic.
- [MEASURED] **Clone stash count = 72** (`git -C C:\po-watcher\ProjectOperations stash list`); dev tree
  stashes = **0**. This is STATE — re-measure, never quote.
- [MEASURED] **Queue-root population.** depth-1 on disk: 44 `.md` = 27 `-HOLD` + 1 `-ready` + 12
  breadcrumbs + 4 other. `superseded/` 199 · `archive/` 548 · `needs-marco/` 55 · `processed/` 4504.
- [MEASURED] `triage-holds.ps1` → `spent=1 of 27 evaluated · gates-satisfied=3 · still-gated=23 ·
  unreadable=0`, SPENT fixture control PASS. The one spent prompt is
  `pr-brandtheme-s4-named-presets-seed-HOLD.md`.
- [CANNOT MEASURE] **The Linux/VM transport is down, so `vm-git-guard.sh` could not be installed.**
  `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → the workspace refused to
  mount: `source path ... is under Plan9 share "c" which is not mounted`, with the host note *"A Windows
  update released September 8 prevents Claude's workspace from reaching your files."* Per the preflight,
  a failed guard install is a finding, not a stop. No `git` was run against any mount this run — the
  guard's hazard does not arise when the transport carrying it is absent.

## WHAT CHANGED

Nothing on the board. No prompt armed, disarmed, renamed, moved or deleted; no PR touched; no label
changed; no commit, no push. Two writes, both in the dev tree working copy and both left dirty for
Station 00 to commit, as the station contract requires:

1. this breadcrumb, at `docs/pr-prompts/00-04-scanner-2026-09-14-0610-…md` (tracked path, untracked file);
2. `docs/pipeline/sweep-rotation.json`, advanced via
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-14T06:10Z`.

**Station 00: both files are uncommitted in `C:\ProjectOperations2`. 04 may not commit them.**

## FINDINGS

### F1 — S2. Four consecutive arms since 03:20Z left their `-HOLD.md` tracked on `main`; one of them has MERGED, is lint-SPENT, and is armable again right now

The "a consumed prompt whose PR does not delete it stays armable forever" defect is not dormant — it
has fired four times in three hours, and it has a clean positive control in the same window.

Cross of `.arming-log.txt` against disk and `origin/main`, last 12 arms:

| armed (UTC) | slug | `-HOLD` on disk | `-ready` on disk | `-HOLD` tracked on main |
|---|---|---|---|---|
| 09-13T13:01Z → 09-14T02:37Z (8 arms) | *(all eight)* | False | False | **False** |
| 09-14T03:20Z | `pr-brandtheme-s4-named-presets-seed` | **True** | False | **True** |
| 09-14T03:48Z | `pr-geocodify-v2-host` | **True** | False | **True** |
| 09-14T05:03Z | `pr-fv2-import-s1-docx-and-persona` | **True** | False | **True** |
| 09-14T06:03Z | `pr-ea-s2a-dashboard-preset-seed` | False | **True** | **True** |

The eight arms immediately before 03:20Z are the POSITIVE control: the retirement path works, and it
worked eight times in a row.

What each of the four actually is, from `gh pr view <n> --json files`:

- **`pr-brandtheme-s4-named-presets-seed` — the live hazard.** `#1913` **MERGED 2026-09-14T05:23:16Z**,
  **4 files, NONE under `docs/pr-prompts/`.** The work shipped; the prompt was never retired.
  `triage-holds.ps1` independently reads it **SPENT (lint exit 3)** with its SPENT fixture control
  passing. So a HOLD whose work is on `main` is sitting at depth 1, lint-visible, with nothing marking
  it — arming it builds a duplicate of merged work, which is precisely the sixth-duplicate shape
  DOCTRINE §9 records for `verdict-home-resolver`.
- **`pr-geocodify-v2-host` — the same defect, still in flight.** `#1915` **OPEN**, **2 files, NONE under
  `docs/pr-prompts/`.** On merge it will leave its HOLD on `main` exactly as `#1913` did. Its `-ready.md`
  has already reverted to `-HOLD.md` on disk, so it is armable a second time *while its own PR is open*.
- **`pr-fv2-import-s1-docx-and-persona` — the POSITIVE CONTROL.** `#1918` **OPEN**, and its diff **does**
  carry `docs/pr-prompts/superseded/pr-fv2-import-s1-docx-and-persona-HOLD.md +0/-0` — a pure rename of
  depth-1 → `superseded/`. This is the correct retirement, on the branch, awaiting merge. It proves the
  other two are a divergence and not "the watcher never does this".
- **`pr-ea-s2a-dashboard-preset-seed`** — still `-ready`, build in flight at sweep time
  (`BUILD IN FLIGHT … tick 0.6 min old`). Too early to judge; listed for completeness.

Angle 3 (ground truth violated): the station doc's BOARD TRAP clause and DOCTRINE §10.6. Angle 5 (blast
radius): every arm from 03:20Z onward, i.e. the current cadence, not a one-off.

**The question this raises and I could not answer: what differs between the 02:37Z arm and the 03:20Z
arm?** Two of the three post-03:20Z PRs were opened by the interactive Station 00 lane
(`actor=station-00.interactive-0003`, `by=Marco@LAPTOP-E6NHU4E4`), and today's 00 breadcrumbs record two
and then three concurrent 00 lanes. A lane that opens the PR without the watcher's retirement step would
produce exactly this table. That is [INFERRED] from the arming log's `actor` field and 00's own
breadcrumbs — I did not read the lane's code.

**DISPATCHED** — to Station 00, which owns board mutation and the commit. Two concrete asks:
(1) retire `pr-brandtheme-s4-named-presets-seed-HOLD.md` to `docs/pr-prompts/superseded/` in a board PR —
it is spent, its work is merged in `#1913`, and it is the one that is armable *today*;
(2) before `#1915` merges, add the same `superseded/` rename to its branch that `#1918` already carries,
so it does not repeat `#1913`. I did not stage a prompt for either: both are one-file renames inside a
board PR 00 is already opening, and spending a full agent run on that is the worse trade.

### F2 — S4. Three worktrees registered against the dev tree are stale; one holds the only copy of an untracked script

`git worktree list` in `C:\ProjectOperations2` shows four entries. Newest-file ages at 06:15Z:

| worktree | newest file (UTC) | age | dirty |
|---|---|---|---|
| `C:\po-fix1891` (detached HEAD `1dc31858`) | 2026-09-14T01:15:24 | 300 min | 0 |
| `C:\PR-Master\worktrees\po-vg` (`fix/no-rebase-while-checks-run`) | 2026-09-11T06:06:04 | 4329 min | **1** |
| `C:\PR-Master\worktrees\pr1823` (`feat/ea-gate-reporting-team-permission`) | 2026-09-11T06:06:04 | 4329 min | 0 |

The clone's own `.claude/worktrees/agent-ae4e04376505f61b2` is **live** (0 min, `locked`) — that is the
in-flight `pr-ea-s2a` build and must not be touched.

Severity is S4, not higher, because the recurring justification for chasing these — an orphaned lock with
no owning process, forever — **does not apply here: all five trees have zero `index.lock` and there are
zero running `git` processes.** What is real is the third column: `po-vg` holds
`?? scripts/pipeline/check-pipeline-heartbeat.mjs`, untracked, three days old. That file exists in exactly
one place on this machine and no clone, no CI and no other station can see it — the "a dev tree can be
AHEAD of main in a way only it knows about" shape. `pr1823`'s branch belongs to `#1823`, MERGED
2026-09-11T02:57:48Z.

**DEFERRED** — no lock, no process, no board impact today, and worktree removal is a mutation 04 may not
perform. What would make it urgent: any `index.lock` appearing in one of the three, or `po-vg`'s
untracked file being needed by a prompt. **The cheap half is worth doing now and is 00's or 03's:
publish `check-pipeline-heartbeat.mjs` — committing it cannot start any work — before the worktree is
pruned and it is gone.**

### F3 — S4. The watcher clone's stash pile keeps growing and nothing retires it

72 stashes in `C:\po-watcher\ProjectOperations`, against 0 in the dev tree. These are the receipts of
`start-watcher.ps1`'s auto-stash self-heal path (DOCTRINE §9), which fires on every launch with a
tracked-dirty clone. Nothing prunes them, and the standing cure is `git stash drop`, **never `pop`** — a
`pop` would replay days-old working-tree state into a live clone.

**DISPATCHED** — to Station 03, which owns clone hygiene; 04 is read-only and must not run `git` in the
clone. This is a re-report of a known growth curve, included because the count moved again and because
the number is state that must be re-measured rather than quoted.

### F4 — S3. The VM transport is down, so the device-bridge git guard could not be installed this run

`vm-git-guard.sh` could not run: the Linux workspace failed to mount the Plan9 share, attributed by the
host to a Windows update released 2026-09-08. Today's 00 breadcrumbs at 0408Z record the same thing
(*"both named transports down again"*), so this is at least the second consecutive day and is not
specific to this station.

The immediate risk is nil — with no VM there is no mount to run `git` against, which is the only hazard
the guard removes. The durable cost is that the guard is now uninstallable on the exact runs that most
need it, and a station that cannot install it may not substitute its own `git` against the mount.

**ESCALATED** — to Marco, because the cause is host/OS configuration outside the repo and no agent can
verify a fix without him. Per RULE 1, complete-and-additive first:

- **(a) Complete + additive — restore the Plan9/virtiofs share so the VM transport works again, and keep
  the Windows-host Desktop Commander path as the primary.** Solves it immediately (guard installs again)
  and in future (two independent transports, either one sufficient), and damages no data entry. This is
  the option I recommend.
- **(b) Declare the VM transport retired and rewrite the guard as a PowerShell no-op on host-only runs.**
  Fails the *complete* half: it removes the alarm rather than the fault, and leaves one transport whose
  own failure is already a recorded blind-run cause.
- **(c) Do nothing and let each run report `[CANNOT MEASURE]`.** Fails *complete* outright; costs every
  future run the same paragraph.

**Marco's question, not a status update: do you want the Plan9/virtiofs share repaired on
LAPTOP-E6NHU4E4 (option a), or is the VM transport now deliberately dead and should the pipeline stop
asking for it?** Nothing else in this report depends on the answer.

## WHAT I DID NOT DO

- **Armed, disarmed, retired or deleted nothing.** 04 is read-only on the board; the sweep's own charter
  says REPORT ONLY and no agent bulk-deletes. F1's spent HOLD is named, not moved.
- **Did not commit `sweep-rotation.json` or this breadcrumb.** The authority matrix gives 04 *Create a
  PR: NO* and the dev tree is on `main`, which nobody commits to directly. Both are left dirty and named
  above.
- **Did not run `git` in `C:\po-watcher\ProjectOperations`** beyond read-only `status`/`stash list`/
  `worktree list`, and never `checkout`, `merge`, `stash pop` or `clean` in any shared tree — those are
  the board trap that resurrects dead prompts.
- **Did not fast-forward the dev tree** off its 1-commit lag. The lag was measured and accounted for
  (every apparent discrepancy it caused is explained under WHAT I MEASURED), and moving a shared tree is
  not 04's.
- **Did not touch the live clone worktree `agent-ae4e04376505f61b2`**, which held an in-flight build.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site visual patrol).** The station doc
  says take ONE named sweep and cover it completely; `next-sweep.mjs` named `repo-hygiene`, and a
  shallow pass over everything is why findings rot.
- **Did not chase the sweep's two `[LIVE]` header claims** — `TRUNK IS RED` and `watcher clone dirty=4`.
  Both are the rows DOCTRINE §9 records as derived-verdict false positives; I re-derived the clone row
  from its own source (finding: the bullet stands) and left the trunk row alone, since `#1852`
  (`TRUNK_VERDICT_SCOPED_V1`) is the open fix and it is Marco's to merge.
