# Station 00 — Supervisor | 2026-09-10T13:08Z–2026-09-10T13:4xZ

## GROUND

```
UTC            2026-09-10T13:08:30Z
origin/main    b1841a9c            (fetch first, then rev-parse)
dev tree       main @ b1841a9c     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE, so this run was not read-only.

**Which tree the binding documents were read in.** `C:\ProjectOperations2`, the dev tree, per
PREFLIGHT step 2. The tree was already at `origin/main` — `git rev-parse --short origin/main` and
`--short HEAD` both `b1841a9c`, `git rev-list --left-right --count HEAD...origin/main` = `0 0` — and
`git diff --numstat origin/main --` over `00-supervisor.md`, `DOCTRINE.md` and
`STATION-CAPABILITIES.md` returned **EMPTY**, which is the sound form (§9.1: never a piped hash).
So the working copies read this run ARE `origin/main`'s content.

**Device-bridge git guard: NOT INSTALLED — a FINDING, not a stop (F4).**

## WHAT I MEASURED

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` → PID 27412, prompt returned.
**SIGHTED**, not blind. Desktop Commander tool ids were resolved by a keyword `ToolSearch` for
`desktop-commander` and used as reported, per PREFLIGHT's "find the ids; do not assume them".

**The sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, captured to a file with `*>` and
decoded **`utf16le`** (§9.3 — the all-streams redirect is the same UTF-16LE trap as `>`; the raw
capture opens `FF FE`, 131,852 bytes, and a `utf8` read splits it into section headers that match no
regex). Section 7 verdict at 13:09:41Z: **SAFE TO ACT**. Re-run at 13:17:21Z it read
`CAUTION: 1 LIVE STATION WORKTREE(s)` naming `C:/po-wt/sstrunk` — **my own**, created by this run
three minutes earlier. Section 3's real mutation signals were clear on both runs: no `index.lock` in
either tree, **0** git processes, no PR touched in the last 2 min.

**Board.** [MEASURED] 4 open PRs, every one `CLEAN` with `15 pass / 0 fail / 0 pending`:
`#1850` · `#1845` · `#1832` · `#1823`. Armed prompts: **0**. `needs-marco/` 54 · `no-pr-opened/` 109
· `failed/` 45 · `blocked/` 129.

**RULE 2 — all four open PRs are Marco's, and the probe was fully controlled.** [MEASURED] over
`C:\ProjectOperations2\docs\pr-prompts\processed` (the LIVE tree, never the clone decoy, §9.5),
matching `PR #<n>\b` in the **body** of `pr-*.log` only — `rev-*` excluded, because a review job
names a PR in both lanes and carries zero lane information:

| probe | result |
|---|---|
| logs in the directory | **2116** |
| newest log | `2026-09-10T12:11:44Z` — younger than every open PR |
| POSITIVE control `marco.:true` (regex; the `-SimpleMatch` form returns 0 **and so does its negative control**) | **629** |
| NEGATIVE control, freshly minted needle `zzQq00Needle20260910T1310` | **0** |
| NEGATIVE control `PR #999999` | **0** |

| PR | watcher verdict, quoted |
|---|---|
| `#1850` | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/triage-holds.ps1"}` |
| `#1845` | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/status-sweep.ps1"}` |
| `#1832` | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh"}` |
| `#1823` | `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` |

All four are **watcher-opened** with a real verdict — this is §10.1 step 1, not a hand
classification, and none of the `NO LOG` ambiguity applies. **Nothing on this board was mergeable by
me.**

**COLLECT.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, **exit
0**, `structure: 1 checked, 0 malformed`. Crossed against `lastRunAt` from the scheduled-tasks MCP,
which the breadcrumb instrument cannot substitute for:

| station | newest breadcrumb | `lastRunAt` | verdict |
|---|---|---|---|
| 00 | 2026-09-10T12:08Z (1.1h) | `13:08:09Z` (this run) | aligned |
| 03 | 2026-09-09T23:01Z (14.2h) | `2026-09-09T23:01:42Z` | aligned |
| 04 | 2026-09-10T10:10Z (3.1h) | `2026-09-10T10:09:47Z` | aligned |
| 05 | 2026-09-09T22:02Z (15.2h) | `2026-09-09T22:01:58Z` | aligned |
| `weekly-security-audit` | not a station | `2026-09-06T21:32:44Z`, next `09-13` | healthy |

Both instruments fresh and aligned on every station — the "healthy" row of the freshness table.
**No station is SILENT and none is being reported as stopped.** ⚠️ The known weakness stands and is
stated rather than papered over: `check-breadcrumb.mjs`'s `CADENCE` map still holds `'00': 2` against
a live cron of `5 * * * *`, so an `ok` for **00** tolerates three consecutive missed hourly runs. The
`lastRunAt` cross-check above is what closes that, and it is why it was run.

**The queue root held exactly one breadcrumb**, this station's own 12:08Z one, and it is already
**tracked** on `main` via `#1851` — checked against the tracked set by basename, never against the
dev tree's `git status`, which cannot see that.

**Dev tree hygiene.** [MEASURED] `git status --porcelain` — no ` M`, no ` D`, nothing staged
(`git diff --cached --name-status` EMPTY), `0 0` against `origin/main`. Nine untracked files, all
expected: five `docs/pr-reviews/pr-*.md`, the queue-sync ledger, `queue-watch-state.md`, an archive
subfolder and a Claude Design page. No FF-blocker was created or left behind by this run.

## WHAT CHANGED

1. **PR `#1852` opened** — `fix(pipeline): status-sweep trunk verdict excludes dependabot and
   scheduled runs (TRUNK_VERDICT_SCOPED_V1)`, one file, `41` insertions / `3` deletions. Built in an
   isolated worktree `C:\po-wt\sstrunk` off `origin/main`, edited with **node by concatenation**
   (never a `String.replace` replacement string — this block is nothing but PowerShell `$`
   variables, which is exactly the §9.3 injection shape), with the **byte delta asserted**: before
   `39241`, after `41939`, expected `41939`, equal. **Not auto-merged** — it is outside
   `tests|docs` and belongs to Marco.
2. **This breadcrumb**, and the 12:08Z breadcrumb `git mv`-ed to `docs/pr-prompts/archive/`, in this
   run's own board PR.
3. **Nothing else.** No merge, no arm, no label, no queue mutation, no watcher action.

## FINDINGS

### F1 — the false `TRUNK IS RED` was deferred on 09-09 with a trigger, the trigger fired, and this run paid it before noticing

[MEASURED] the sweep's own section 1 at 13:09:41Z:
`main CI on b1841a9c: 4 success / 6 failed / 0 running  <-- TRUNK IS RED`. Against
`gh run list --commit <full 40-char sha> --json conclusion,name,event,workflowName`,
assign-then-foreach, **10** runs:

| event | workflowName | conclusion | n |
|---|---|---|---|
| `push` | CI · Deploy · Tendering Browser Smoke | success | 3 |
| `dynamic` | CodeQL (run name `Push on main`) | success | 1 |
| `dynamic` | **Dependabot Updates** | **failure** | **6** |

**The trunk is green.** All six failures are Dependabot security-update runs, confirmed per-run by
`gh run view 34479721528 --json workflowName,event` → `Dependabot Updates` / `dynamic`. They are
attributed to `main`'s HEAD without testing this commit's code.

This was already found by **three stations across two days** — 00 (09-09T23:08Z, F3), 03
(09-09T23:01Z), 04 (09-09T10:10Z) — and F3 **DEFERRED** it with an explicit trigger: *"It becomes
urgent the moment a station acts on the false red."* **This run is that trigger.** It opened on
`TRUNK IS RED` as its headline and spent its first four probes chasing a regression that does not
exist. A disposition addressed to a future run outlived its own fix and billed that run to
re-discover it, which is the shape DOCTRINE keeps recording.

🔧 **Fixed, and deliberately NOT the way F3 proposed.** F3 said *"filter to `event == "push"`"*.
[MEASURED] that would be wrong: **CodeQL runs as `event: dynamic`** under the run name
`Push on main` and **is** a genuine trunk check, so an allowlist trades a false RED for a false
GREEN — the worse direction. `#1852` uses a **denylist** (`Dependabot Updates`, or
`event -eq "schedule"`); anything unknown keeps counting toward the verdict rather than vanishing
from it. Excluded runs are printed on their own line, grouped by workflow with failure counts, so
they are removed from the verdict and **not hidden** — on 09-09 five failing `Pipeline heartbeat`
runs were carrying a real SILENT-stations alarm that the aggregate count buried.

Evidence, same commit, same minute, patched script:

```
[LIVE] main CI on b1841a9c: 4 success / 0 failed / 0 running  (trunk green)
[LIVE]    NOT trunk CI on this commit, excluded from the verdict above: 6 run(s), 6 failing
[LIVE]       Dependabot Updates: 6 run(s), 6 failing
```

**POSITIVE control — a check never seen to fire is not a check (§7).** No commit on `main` in the
last 60 runs carries a real trunk failure (`real-trunk-failures=0`), so the RED path was controlled
over fixtures whose truth is known by construction. All six agreed with expectation: a real `push`
failure → `TRUNK IS RED`; **a CodeQL failure → `TRUNK IS RED`** (the row an allowlist gets wrong); a
scheduled-only failure → `trunk green`; non-trunk runs only → `CANNOT-MEASURE-no-trunk-run` (a new
guard — previously such a commit could conclude green); a pending push check → `not yet green`.

⚠️ **Falsifying probe:** re-run the four-column table on any green commit that also carries a
failing Dependabot or scheduled run. If the sweep prints `TRUNK IS RED`, this has not landed. And if
a commit whose `CodeQL`/`Push on main` run failed ever prints `trunk green`, the denylist has been
narrowed to an allowlist and F1 is wrong.

**ACTIONED** — `#1852`, verified by running the patched sweep against the live commit and by the
six-fixture control. The merge is Marco's.

### F2 — every open PR is Marco's and nothing is armed, so this board cannot move without him

[MEASURED] the four-row verdict table above: `#1850`, `#1845`, `#1832` are each
`outside tests/ or docs/` on a `scripts/` path; `#1823` is `escalates:true`, labelled
`do-not-merge`. Armed prompts **0**. All four are green and `CLEAN` — **CI is not the constraint.**

This is the structural finding restated with today's numbers, not a new one: the `tests-docs`
auto-merge lane works and is starved, because every prompt currently arming touches `scripts/`.
`#1852`, opened by this run, makes it **five**. That is the honest cost of F1 and it is stated
rather than buried: the alternative was a sixth re-discovery.

⚠️ **This is not a request to relax RULE 2**, and no station may clear one of these verdicts. It is
the throughput fact: 00 can arm, the watcher can build, CI can green — and every PR touching
anything outside `tests/` or `docs/` then stops. The queue grows monotonically until Marco merges.
**Arming faster makes it longer, not shorter.**

**DEFERRED** — real, and not this run's to resolve. It becomes an escalation with options the
moment the open count passes what Marco can clear in one sitting, or if a genuine trunk regression
lands behind the queue.

### F3 — `C:\po-vg` has held one uncommitted file for six days and belongs to nobody

[MEASURED] sweep section 2: `C:/po-vg  23c91ba9 [fix/no-rebase-while-checks-run]`, **dirty=1 file**,
age **8956 min** ≈ **6.2 days**. The second worktree, `C:/po-worktrees/pr1823` (age 898 min), is
**clean** and is `#1823`'s own — not an orphan while that PR is open.

`git worktree remove` will refuse while it is dirty and `--force` would discard the file, which is
irreversible and therefore not mine (§5.4). Worktree hygiene is Station 03's lane and 03 has already
escalated this one; it is **report-only** for 03, so nobody currently holds the authority to
resolve it.

**DISPATCHED → 03** — re-stating it with today's age so the dispatch does not go stale: list it
first (`git -C C:/po-vg status --porcelain`), preserve or commit the file, and only then prune.
**Do not `--force`.**

### F4 — the device-bridge git guard could not be installed, because the Linux VM is unmounted

[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` failed twice, on
resume and on create, quoting its last line verbatim:

```
failed to mount ... under Plan9 share "c" which is not mounted;
create: RPC error -1: ensure user: user zealous-happy-archimedes already exists unexpectedly
```

Two honest attempts, identical failure, so it was not retried a third time.

PREFLIGHT is explicit that a failed install is a **finding, not a stop**, and it is quoted here
pass-or-fail because an install nobody can see in the report is indistinguishable from one that
never ran. ⚠️ **The guard's absence carried no risk this run, and the reason is the same failure:**
the guard exists to stop VM-side `git` reaching the Windows `.git` and leaving an ownerless 0-byte
`index.lock` (§9.2), and with **no VM at all** no VM-side call was possible. Section 3 confirmed it
from the other side — `index.lock` False in both trees, 0 git processes. Every command this run ran
went through Desktop Commander, which is the sanctioned transport.

⚠️ This also removes the whole blind-run mount corpus for a run in this state: a run that is
*sighted but VM-less* has Desktop Commander and therefore loses nothing, but a run that were
**blind AND VM-less** would have no transport at all — neither the host shell nor the
`/sessions/<id>/mnt/` reads `STATION-CAPABILITIES.md` §3 says a blind run still gets. That
combination is not covered by the capabilities doc, which treats the mount as always available to a
blind run.

**DEFERRED** — the mount is infrastructure, not a repo defect, and it cost this run nothing. It
becomes urgent if a **blind** run reports the same VM failure, because that run would have to stop
having collected nothing, and would currently have no wording for why.

## WHAT I DID NOT DO

- **Merged nothing.** All four open PRs carry a genuine watcher `marco:true` verdict; RULE 2 binds
  and is not cleared by green, by `CLEAN`, or by my agreeing with the diff. `#1823` additionally
  carries `do-not-merge`, which only Marco removes. **`#1852`, opened by this run, is left for him
  too** — I did not arm auto-merge on my own PR.
- **Armed nothing.** 0 armed at the start, 0 at the end. Every arm available today lands on Marco
  (F2), and no gate-cleared HOLD was eligible for the `tests-docs` lane. Arming to look busy would
  have lengthened the queue F2 describes.
- **Touched no `sot/`** — Station 05's, CP-24.
- **Touched no Azure / Entra / SharePoint** — absolute.
- **Did not restart, kill or probe the watcher beyond the sweep.** It reads RUNNING pid 18228 with
  its wrapper alive and 0 armed prompts; an idle watcher with an empty queue is **correct, not
  wedged**, and the 58-minute heartbeat age is the documented idle signature, not a stall. I did not
  run `restart-watcher-if-wedged.ps1 -Fix`, because nothing returned WEDGED or DOWN.
- **Did not clear the watcher clone's `dirty=1`.** That is 03's tree and 03's lane.
- **Did not prune either worktree** (F3), and did not `git worktree remove --force` anything.
- **Did not read `docs/qa/qa-findings.md` as evidence.** It is gitignored; its silence proves
  nothing.
- **Did not touch the 3 ADMIT prompts scoped to `scripts/pipeline/status-sweep.ps1`.** `#1852`
  edits section 1's verdict only and none of the three names that block, but they now overlap a live
  PR on a single-file scope — the shape §10.6 records as **precision zero by construction**. Whoever
  arms one next should confirm on the marker string, not the file overlap.
- **Left my two worktrees standing** (`C:\po-wt\sstrunk`, `C:\po-wt\collect1308`) until both PRs
  settle, then they are torn down. Neither holds this breadcrumb — it is written inside the board
  PR's worktree and committed, never left in a disposable tree, which is the one place the report
  contract says a breadcrumb dies silently.
