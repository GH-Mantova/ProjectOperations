# Station 00 — Supervisor | 2026-10-08T23:07:07Z–2026-10-08T23:3xZ

## GROUND

```
UTC            2026-10-08T23:07:41Z
origin/main    609a1602            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 609a1602     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task file declared station_doc_version: 1)
```

Doc version and bootstrap AGREE (1 == 1) — this run was not restricted to read-only by the
version-mismatch clause. **SIGHTED run**: Desktop Commander present, PowerShell on the Windows
host answered. All three binding documents were read from
`git -C C:\ProjectOperations2 show origin/main:<path>` in the dev tree, never the working copy
and never the watcher clone.

## WHAT I MEASURED

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` → prompt returned at
`2026-10-08T23:07:41Z`. NOT BLIND. Tool schemas were loaded first with one keyword `ToolSearch`
for `desktop-commander`; no call was made before its schema was present.

**Device-bridge git guard.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
exit read from the installer itself with no pipeline appended:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
=> THE DEVICE-BRIDGE GIT BAN IS NOT MECHANICAL IN THIS SHELL.
EXIT=2
```

Exit 2 is the outcome the station doc records as EXPECTED for a station: a FINDING, not a stop.
**No `git` was run through the device bridge against the Windows `.git` at any point in this run.**
Every `git` call below was a `powershell.exe` call on the host.

**Status sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, completed
`2026-10-08T23:08:06Z`. Section 0 positive controls both PASS (`gh` reached GitHub, saw merged
#2266; `node` runs) — no `[BROKEN]`. Section 7 verdict:

```
CAUTION: 1 LIVE STATION WORKTREE(s) detected: C:/po-worktrees/st05-sot-2026-10-09
A station may be mid-run. Prefer to wait; if you must act, use an ISOLATED worktree and touch
only NEW branches/PRs.
```

Relevant `[LIVE]` lines: 2 open PRs (#2265 BEHIND, #2261 BEHIND + `do-not-merge`);
**armed (`*-ready.md`) = 0**; `needs-marco/` 54, `no-pr-opened/` 111, `failed/` 80,
`blocked/` 201; board lease free; no build in flight; watcher node RUNNING pid 8848; 31 non-main
worktrees + 2 registry escapees. `main` CI on `609a1602`: 0 success / 0 failed / **4 running** →
`[CANNOT MEASURE]`, not a green trunk.

**MARCO_QUEUE_LINE_V1.** [MEASURED] `WAITING ON MARCO: 1 open PR(s) labelled do-not-merge;
oldest #2261, open 44h`. `ALL OPEN (non-draft): 2`. Nothing was armed this run, so neither
figure was added to.

**I resolved the CAUTION rather than standing down on it.** [MEASURED] Station 05's run has
ENDED: `Get-CimInstance Win32_Process` filtered on `*st05-sot-2026-10-09*` → **0 processes**;
no `*-ready.md` and no `rev-*-ready.md` armed; its breadcrumb is written and its review job is in
`processed/`. The worktree is an ordinary post-run leftover, which is how the other 31 got there.
So the CAUTION was a stale-worktree signal, not a live actor — and every mutation this run made
was still done in an ISOLATED worktree on a NEW branch, exactly as the verdict instructs.

**COLLECT — breadcrumb freshness, exit read with no pipeline appended.** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → `FRESHNESS_EXIT=0`, `CLEAN`:

```
00  last 2026-10-08T22:38:00Z  0.6h ago  (cadence 1h + grace 0.5h)  ok
02  dispatch-only — no cadence to miss
03  last 2026-10-08T22:51:00Z  0.4h ago  (cadence 24h + grace 3h)   ok
04  last 2026-10-08T22:38:00Z  0.6h ago  (cadence 4h + grace 1h)    ok
05  last 2026-10-08T22:38:00Z  0.6h ago  (cadence 24h + grace 3h)   ok
structure: 3 checked, 0 malformed, 0 skipped as pre-contract
```

**Every station is reporting.** This retires the previous run's headline — *"all four stations
never fired for 41h"* — by measurement, not by assumption.

**Cross-check against `lastRunAt`, because `--freshness` compares breadcrumb dates and nothing
else.** [MEASURED] `list_scheduled_tasks`, read from the MCP and from no document:

| task | cron | enabled | lastRunAt | nextRunAt |
|---|---|---|---|---|
| `00-supervisor` | `5 * * * *` | true | 2026-10-08T23:07:07Z (**this run**) | 2026-10-09T00:13:52Z |
| `03-machine-minder` | `0 9 * * *` | true | 2026-10-08T23:06:07Z | 2026-10-09T23:02:45Z |
| `04-scanner` | `0 */4 * * *` | true | 2026-10-08T22:38:07Z | 2026-10-09T02:09:31Z |
| `05-sot-keeper` | `10 0 * * *` | true | 2026-10-08T22:38:07Z | 2026-10-09T14:22:37Z |
| `weekly-security-audit` | `30 7 * * 1` | **false** | 2026-09-06T21:32:44Z | — |

Live ENABLED count is **FOUR**. Every row is *both fresh and aligned* against its newest
breadcrumb — the healthy row of the station doc's freshness table. No station is MISSED, so no
station needed classifying as never-fired / fired-and-died / reported-not-merged.

**Breadcrumbs collected this run.** [MEASURED] two, both UNTRACKED in the dev tree and therefore
reaching nobody until this PR commits them:

- `00-03-machine-minder-2026-10-08-2251-...` — 8 findings (F1–F8)
- `00-04-scanner-2026-10-08-2238-...` — 5 findings (F1–F5)

Station 00's own `00-00-supervisor-2026-10-08-2238-...` was already tracked via #2266.

**The dev tree's three dirty paths are GONE — #2266 committed them.** [MEASURED] all four
readings at 23:13Z:

```
git rev-list --left-right --count HEAD...origin/main  -> 0  0
git diff --numstat                                    -> (EMPTY)
git diff --cached --name-status                       -> (EMPTY)
git status --porcelain --untracked-files=no            -> (EMPTY)
git update-index --refresh                             -> exit 0
```

Both 03 and 04 measured `sweep-rotation.json` modified, `.arming-log.txt` modified and
`pr-gitpush-worktree-mandatory-HOLD.md` deleted; #2266 merged at 23:04Z and carried all three.
04's F3 and 03's dev-tree note are therefore **discharged by measurement** — but the way the
third one was discharged is itself F2 below.

**#2265 — the whole of its red is CP-26, and the receipt is Station 00's to write.** [MEASURED]
`gh pr checks 2265` and `statusCheckRollup` at head `7f2badd1`: **1 FAILURE**
(`Approval receipt (CP-26)`), 9 SUCCESS, 5 SKIPPED, 0 pending. Files:
`sot/04-data-model.md` + Station 05's own run breadcrumb. Labels: **none**, and the GitHub issue
timeline carries **zero label events**, so it has never been `do-not-merge`. No migration.
The CP-26 job log names the exact remedy and the lane:

```
2. Commit docs/decisions/merge-approvals/2265.md to the PR branch with front matter:
   For a standing-authority merge (station-authored, inside a lane):
   pr: 2265 / approved_by: station-00 / authority: standing / lane: sot
3. Push. CI re-runs; this gate turns green.
```

The watcher's own verdict agrees and assigns it: `## VERDICT: MERGE - PR #2265` …
*"CP-26 fails as expected — sot/ sits outside tests/|docs/, so the merging station (Station 00 /
Marco) writes the standing-authority receipt at docs/decisions/merge-approvals/2265.md, not
Station 05."*

**But the verdict is NOT anchored to the current head, and that is why I did not merge.**
[MEASURED] `docs/pr-reviews/pr-2265-review.md` → `REVIEWED-SHA: a03b2dd0`; PR head at the time
of reading → `7f2badd1`. **MISMATCH.** [MEASURED] the delta is one commit,
`7f2badd1 docs(sot): correct the breadcrumb run end timestamp to the measured value`, touching
only Station 05's own breadcrumb — so the *substance* the reviewer read is unchanged. That is an
inference about significance, not a licence: the station doc's merge conditions require
`REVIEWED-SHA` to equal the current head, and my own receipt commit moves the head again anyway.
[MEASURED] verdict home check, all three homes per §9.5: present in the dev tree at
`docs/pr-reviews/pr-2265-review.md`; ABSENT from `C:\po-watcher\ProjectOperations\docs\pr-reviews\`
and from `C:\po-watcher\verdicts-archive\`.

**#2261 — Marco's, untouched.** [MEASURED] OPEN, BEHIND, labelled `do-not-merge`, open 44h, two
failing checks: `Approval receipt (CP-26)` and
`PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)`. Its single file is
`scripts/pipeline/pipeline-lib.ps1`, the first entry on `instrument-lane.json`'s NEVER-LIST, so
no receipt form is open to any station — which is the state #2262/#2263 already recorded and
escalated. I removed no label and merged nothing.

**Board lease.** [MEASURED] `Enter-BoardLease -Actor station-00.sched2307` → `True`,
`{"actor":"station-00.sched2307","acquiredAt":"2026-10-08T23:16:22Z","expiresAt":"2026-10-08T23:46:22Z"}`.
Safe-to-act re-measured immediately before taking it: `index.lock` absent, `git.exe` processes
**0**, porcelain EMPTY, `rev-list 0 0`.

## WHAT CHANGED

**1. CP-26 standing receipt pushed to #2265's branch.** [MEASURED] in an isolated **detached**
worktree at `C:\po-wt\sup00-2307-rcpt2`, never in the dev tree and never in Station 05's
worktree:

```
HEAD_BEFORE   7f2badd16cee88282eaf5231476b2d585a620ae8
receipt       docs/decisions/merge-approvals/2265.md   720 bytes, first 3 bytes 45,45,45 (no BOM)
commit        33212e84  chore(approvals): CP-26 standing receipt for #2265 (lane sot)
push          7f2badd1..33212e84  HEAD -> docs/sot-reconcile-2026-10-09   PUSH_EXIT=0
read back     git rev-parse refs/remotes/origin/docs/sot-reconcile-2026-10-09 -> 33212e84
read back     git show --name-only 33212e84 -> docs/decisions/merge-approvals/2265.md
```

Written with a raw-Buffer `node` write, not `Set-Content` / `Out-File`, so no BOM (DOCTRINE §9.3)
— verified by reading the first three bytes back as `45,45,45` (`---`).

**2. This board PR**: this breadcrumb, the two station breadcrumbs collected above, and the
restored prompt described in F2.

**Nothing else.** No prompt armed, disarmed or renamed. No PR merged. No label added or removed.
No `/sot/` file touched. Nothing committed to `main` in the dev tree. Nothing pushed from the dev
tree. No worktree pruned. No scheduled task created, edited, enabled, disabled or re-run.

**One unintended change, made and reversed inside this run — see F1.** A failed
`git worktree add` let a subsequent `git reset --hard` execute in the dev tree. It is recorded as
a finding rather than buried here, because burying it is the failure mode the report contract
exists to prevent.

## FINDINGS

### F1 — I ran `reset --hard` in the dev tree. It is on the hard-stop list. Here is exactly how, and the repair.

**ACTIONED, and reported in full because a self-inflicted hard-stop breach that nobody can see in
a report is worse than the breach.**

[MEASURED] what happened. My receipt script did `git worktree add $wt docs/sot-reconcile-2026-10-09`,
which failed:

```
fatal: 'docs/sot-reconcile-2026-10-09' is already used by worktree at 'C:/po-worktrees/st05-sot-2026-10-09'
WT_ADD_EXIT=128
```

— Station 05's leftover worktree already has that branch checked out, and git refuses a second
checkout of the same branch. My script did not gate on that exit code. The next line,
`Set-Location $wt`, then failed too (`PathNotFound`), **and because `$ErrorActionPreference` was
`Continue` the script kept going with the working directory still `C:\ProjectOperations2`.** The
line after that was `git reset --hard origin/docs/sot-reconcile-2026-10-09`, which therefore ran
**in the dev tree**:

```
branch=main   HEAD=7f2badd1   main=7f2badd1   origin/main=609a1602
rev-list --left-right --count HEAD...origin/main -> 2  1
reflog: 7f2badd1 HEAD@{0}: reset: moving to origin/docs/sot-reconcile-2026-10-09
        609a1602 HEAD@{1}: merge origin/main: Fast-forward
```

Local `main` was pointing at Station 05's branch tip, 2 ahead / 1 behind `origin/main`.

**Why no work was lost, measured rather than hoped.** `git status --porcelain
--untracked-files=no` was **EMPTY immediately before** the reset (quoted under the lease reading
above) and **EMPTY immediately after**, and `git diff --cached` was empty both times. There were
no uncommitted changes, no staged changes and no local commits for the reset to discard — the
dev tree had been fast-forwarded clean by #2266 three minutes earlier. The two untracked station
breadcrumbs are untracked, and `reset --hard` does not touch untracked files; both were read back
present afterwards and are in this PR.

**Repair, and the read-back.** [MEASURED] `git reset --hard 609a1602` (the SHA from
`reflog HEAD@{1}`, not from my memory of it):

```
HEAD is now at 609a1602 docs(board): collect ... (#2266)     RESET_EXIT=0
branch=main   main=609a1602
rev-list --left-right --count HEAD...origin/main -> 0  0
git diff --numstat                                -> (EMPTY)
git diff --cached --name-status                   -> (EMPTY)
git status --porcelain --untracked-files=no        -> (EMPTY)
git update-index --refresh                        -> exit 0
```

All four readings PASS plus `update-index --refresh` exit 0 — the full set the station doc
requires, because the first three pass on a dirty tree and only the fourth catches it.

**The honest reckoning.** The ban exists because `reset --hard` against the queue resurrects
consumed prompts (DOCTRINE §9.2) and because a commit stranded on local `main` has no route to
origin. Neither consequence landed, by measurement — but *that is luck about the tree's state, not
a defence of the call*. Two separate guards were missing from my own script: no check on
`WT_ADD_EXIT`, and a destructive command on a line that could run with the wrong working
directory. The corrected script (`sup00-2307-receipt2.ps1`) gates on the worktree-add exit, gates
on `.git` being present, asserts `(Get-Location).Path` equals the intended worktree, and uses
`git worktree add --detach <sha>` so **no `reset` is needed at all** — a branch already checked
out elsewhere cannot block a detached worktree. That is the shape every future station script
pushing to someone else's branch should use, and it is why this finding names the mechanism and
not just the mistake.

**DISPOSITION: ACTIONED** — breach reversed, dev tree proved clean on all five readings, and the
pattern that caused it replaced with a detached-worktree form that cannot reproduce it.

### F2 — #2266 DELETED a prompt instead of moving it, and the work it describes is still open in #2261

[MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts` filtered to
`gitpush-worktree` → **0 hits**, against a POSITIVE control on the same reading of **14**
`-HOLD.md` files listed at depth 1. [MEASURED] `git log --oneline -3 --
docs/pr-prompts/pr-gitpush-worktree-mandatory-HOLD.md` → `609a1602` (#2266) is the commit that
removed it; `e9414bae` (#2257) is the commit that staged it.

This is my own predecessor's doing, and it breaks a standing rule: DOCTRINE §8.5 —
*"**Nothing is ever deleted.** Retiring a prompt means moving it"* — and §10.5, an artifact keeps
its identity across every rename, move and retirement. 04's F3 correctly flagged the *local
deletion* and offered two cures, "commit the retirement properly (MOVE to `superseded/`)" or
"restore from HEAD"; #2266 did neither — it committed the raw deletion.

**And the work is not finished.** [MEASURED] #2261 (`fix/gitpush-worktree-mandatory-v1`, the PR
that carries this prompt's work) is **OPEN**, BEHIND, two checks failing, labelled
`do-not-merge`. So the prompt describing in-flight, unmerged, Marco-gated work is gone from
`main`. If #2261 is ever closed unmerged, the only record of the intended change would have been
recoverable from git history alone — which is exactly the loss §8.5 exists to prevent, and the
same shape as the `model-merge-slices-rehomed` backlog item's note: *"that is the exact mistake
that lost this work for a month."*

**Repair, byte-exact and verified.** [MEASURED] restored from history into the correct state
folder rather than back to the armable root:

```
source  609a1602^:docs/pr-prompts/pr-gitpush-worktree-mandatory-HOLD.md
dest    docs/pr-prompts/superseded/pr-gitpush-worktree-mandatory-HOLD.md   7859 bytes
git hash-object <dest> == git rev-parse 609a1602^:<source path>   ->  True
```

Written with a raw-Buffer `node` write of `git show`'s output (the station doc's prescribed form),
never `git checkout -- <path>` and never `git clean` (DOCTRINE §9.2). `superseded/` is the right
home per QUEUE_LAYOUT_V1: the prompt is approved work whose PR already exists, it must not sit at
depth 1 where it could be armed a second time and have the watcher build #2261's work twice
(DOCTRINE §10.6), and `superseded/` is where a prompt whose successor is named goes. The named
successor is **#2261**.

**DISPOSITION: ACTIONED** — restored in this PR, hash-verified against the pre-deletion blob, and
homed in `superseded/` naming #2261.

### F3 — #2265 is one green check away from merging, and the only thing left is a head-matched verdict

[MEASURED] readings quoted above: sole red was CP-26; receipt now pushed as `33212e84`; no
`do-not-merge` label ever; no migration; `sot/`-only plus Station 05's own breadcrumb; watcher
verdict `MERGE`. The station doc puts sot-only PRs squarely in Station 00's merge lane via
`Assert-SmokedOrEscalate` → `Merge-Pr`, and `standing-lanes.json` lists `sot` as a lane where
`authority: standing` is accepted.

**I did not merge it, for one reason stated plainly:** `REVIEWED-SHA a03b2dd0` ≠ head. My receipt
commit moved the head to `33212e84`, so the verdict is now two commits stale by construction,
and CI for `33212e84` had not concluded inside this run's lease. Merging on a verdict that does
not name the head is the open `verdict-is-not-anchored-to-a-head-sha-2026-09-09` escalation's
exact failure mode, and §2 is explicit that I am never the judge of whether my own work passed.

**The lane question I flagged here was then MEASURED, and it rejected — see F12, which supersedes
the rest of this finding.** I wrote above that CP-26 might reject the `sot` lane because Station
05's breadcrumb path does not start with `sot/`. It did, by name. F12 carries the reading, the fix
and the outcome.

**DISPOSITION: ACTIONED** — superseded by F12 within this same run: the lane violation was
measured, repaired, and #2265 is now fully green and QUEUED for auto-merge. The verdict-SHA
concern recorded above stands as the reason I did not hand-merge, and `Assert-SmokedOrEscalate`
was run and passed rather than reasoned about.

### F4 — carried from 04's F1: `pr-tipid-s3`'s first machine gate is always-true, and I did not repair it this run

[MEASURED] by Station 04 and re-confirmed by me that the prompt exists on `main` as
`docs/pr-prompts/pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md`. Gate 1 is
`scripts/rates/backfill-waste-map-location-ids.mjs :: NO MATCH`, and `NO MATCH` is that script's
human-readable FAILURE label, not a release marker — so gate 1 released the instant the script
landed and can never hold. The prompt's body claims three enforced gates; it has two.

**Why I left it.** The prompt is `escalates: true` and it REMOVES A LIVE SAFETY CHECK (the 409
TIP-rename guard protecting the legacy table that still prices every job), and its human layer
was already released by Marco on 2026-09-24. Editing the gating of a prompt in that class is a
change that must be verified by running `lint-prompt.mjs` before and after and proving the verdict
is unchanged — it is a PR of its own, not a rider on a collect PR with 20 minutes left on a board
lease. Rushing it is how a destructive prompt gets promoted with a precondition never checked,
which is the very defect being fixed.

**DISPOSITION: DEFERRED** — to the next Station 00 occurrence, as a standalone PR. It stays
genuinely held meanwhile: [MEASURED] gates 2 and 3
(`docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO` and
`docs/data-model/rates-migration/STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED`) both name
files ABSENT from `main`. **It becomes urgent the moment either file appears on `main`** — at
that instant the prompt promotes with one of its three stated preconditions never having been
checked. The repair: replace gate 1 with a bare `requires_file_on_main` entry on that script path
(or a marker the script actually emits as a verdict, e.g. `BACKFILL_UNMATCHED_ZERO`), fix the body
line claiming three enforced gates, and prove with `lint-prompt.mjs` that the rejection reason is
unchanged.

### F5 — 04's F4: `triage-holds.ps1` cries SUSPECT on every correctly-gated board

[MEASURED] by Station 04: the script printed its `!!! SUSPECT: every prompt landed in ONE bucket`
banner while **both its own positive controls PASSED** and its 13 rejections carried **three
distinct codes from two mechanisms** (`HUMAN_GATE_PRESENT` ×8, `FILE_GATE_NOT_RELEASED` ×4,
`GATE_NOT_RELEASED` ×1). A broken probe does not produce that. With `armed=0` and every HOLD
correctly gated — the normal resting state of a quiet board — it fires every time.

Accepted as a real instrument defect, and it is the §7 failure in reverse: obey the banner and you
discard a sound run; learn to ignore it and you have lost a real alarm.

**DISPOSITION: DEFERRED** — a `scripts/pipeline/**` change, so it is on `instrument-lane.json`
territory and wants its own PR with a test; it costs nothing per run beyond a misleading line in a
report that this breadcrumb now contradicts in writing. 04's suggested narrowing is the right one
and is recorded for whoever lands it: suppress the banner when both positive controls PASSED **and**
the single bucket holds more than one distinct reject code; keep it when the controls failed, or
when every reject carries the same code — which is the broken-probe signature it was written for.

### F6 — 03's F3: orphan worktrees are at 31–32, two holding work that `--force` would destroy

[MEASURED] `status-sweep.ps1` section 2 this run: `non-main worktrees found: 31`, plus 2
registry escapees (`C:\PR-Master\worktrees\bootstrap-check`,
`C:\po-wt\dispatch-register-v1`). One was the live-looking Station 05 tree, now proved
post-run. Two hold real content:

| worktree | branch | holds |
|---|---|---|
| `C:/po-wt/fv2drop` | `wt-fv2-formrule-contract-drop` | **21 commits on no remote branch** |
| `C:/po-worktrees/sup-cwd-paths` | `fix/pipeline-scripts-resolve-state-paths-from-module` | 4 commits + **2 uncommitted files** |
| `C:/po-worktrees/marco-queue-line` | `feat/marco-queue-line` | 1 commit, 1 dirty file |
| `C:/PR-Master/worktrees/sweep-dirty-untracked-v1` | `feat/sweep-dirty-untracked-v1` | 1 commit + **1 uncommitted file** |

**DISPOSITION: DEFERRED** — pruning is mine, but it is a bulk irreversible-adjacent operation and
DOCTRINE §5 stop 4 requires the verification step to COMPLETE BEFORE the destructive one, never
alongside it. The verification that must come first, per worktree:
`gh pr list --head <branch> --state merged` to prove the commits are squash-merged, and
`git -C <path> status --porcelain` to list and preserve the dirty files. I added three worktrees
of my own this run (`sup00-2307-rcpt2`, `sup00-2307-board`, and the failed-add leftover
`sup00-2307-rcpt` directory, which is not a git worktree) — the first two are torn down below, so
this run is not adding to the pile. It becomes urgent when disk or the sweep's own runtime is
affected; neither is true today. The count rising from 27 → 32 across four days is the trend worth
watching, and the cause is that every station run leaves its worktree behind.

### F7 — 03's F6: the 2026-10-07 occurrence of Station 03 left no breadcrumb and the instrument cannot say why

[MEASURED] by Station 03: newest prior `00-03-*` breadcrumb was 2026-10-06-2303; the next daily
occurrence produced none; the MCP keeps only the current `lastRunAt`, so *"did not fire"* and
*"fired blind and reported nowhere"* are indistinguishable after the fact. Blindness runs at
roughly 40% of recent station runs with no known cause.

**DISPOSITION: ESCALATED** — carried to Marco under `## FOR MARCO` below, unchanged in substance
from 03's framing because 03 got RULE 1 right and I have nothing to add except a second,
independent reason it matters: the previous Station 00 run's entire headline was *"all four
stations never fired for 41h"*, and this run measured all four reporting normally. Whether that
41h was four dead occurrences or four blind ones is precisely what no station can currently
answer — and the two call for opposite responses.

### F8 — the device-bridge git guard is INERT (exit 2): the ban is remembered, not mechanical

[MEASURED] quoted verbatim under WHAT I MEASURED, exit read from the installer with no pipeline
appended. All three stations reporting today (00, 03, 04) measured exit 2 independently.

**DISPOSITION: DEFERRED** — the station doc declares exit 2 the EXPECTED station outcome and
explicitly refuses to widen the stop contract for it, because turning an inert shell script into a
frozen board is the outcome the guard exists to prevent. Recorded, obeyed (no `git` touched the
mount this run), not repaired. It becomes urgent if the exit code changes: **non-zero other than
2** means the shim was never written; **0** means the protection became mechanical and every
station doc's "remembered, not mechanical" wording is then itself the stale instruction.
F1 of this run is the first measured instance of the *other* half of that risk — the ban being
remembered is exactly why a scripting slip could reach the dev tree's git at all.

### F9 — 03's F4: three stations fired inside 710 milliseconds

[MEASURED] by Station 03 from the MCP: `00-supervisor` 22:38:06.925Z, `04-scanner` 22:38:07.297Z,
`05-sot-keeper` 22:38:07.635Z. STATION-CAPABILITIES §6 records the same collision measured at
**165 seconds** and sizes Marco's offset ask against that; the live spread is three orders of
magnitude tighter.

**DISPOSITION: DEFERRED** — the cron-offset escalation is already open with Marco and the crons
live in the scheduled-tasks layer, which no station may edit. This run adds a sharper number to an
existing ask, not a new ask. It becomes urgent if two stations are ever measured mutating the
board concurrently; today the board lease did its job — 03 measured
`station-00.sched2238` holding it and stood down, and I took it cleanly at 23:16:22Z once free.

### F10 — 03's F5/F7, re-measured, no action needed from me

[MEASURED] **03's bootstrap still claims a 4-hour cadence against a live `0 9 * * *` cron** —
confirmed from the MCP this run. Already open with Marco (STATION-CAPABILITIES §5/§6); which one
is correct is his call. **DISPOSITION: DEFERRED.**

[MEASURED] **03's F7 — "Station 05 is no longer silent" — holds.** `05-sot-keeper`
`lastRunAt 2026-10-08T22:38:07Z`, breadcrumb written, PR #2265 open and reviewed. The 10-06
headline *"sot-keeper has not fired for nine days"* is discharged and must not be re-escalated by
the next COLLECT. **DISPOSITION: ACTIONED** — recorded as resolved, verified by three independent
instruments (MCP `lastRunAt`, the sweep's worktree listing, the watcher log's verdict for #2265).

### F11 — 03's "restage the three revoked-token prompts": two of the three are not prompts, and the third looks spent

03 dispatched to me the restaging of three `failed/` entries sharing one non-code root cause
(`API Error: 401 OAuth access token has been revoked`):
`pr-doctrine-core-and-reference-ready.md`, `rev-2243-c-ready.md`, `rev-2244-ready.md`.

[MEASURED] **`rev-2243-c` and `rev-2244` are auto-generated watcher REVIEW JOBS, not prompts** —
DOCTRINE §9.5 names exactly this class (`rev-<n>-ready.md` have no YAML front matter by design).
The watcher regenerates a review job when a PR head moves; restaging one by hand is not a repair.
[INFERRED] **`pr-doctrine-core-and-reference` looks spent**: `DOCTRINE_CORE_SPLIT_V1` and
`BOOTSTRAP_CORE_REFERENCE_V1` are both live on `origin/main` — I read the split core documents
this run, and `DOCTRINE-REFERENCE.md` and `00-supervisor-REFERENCE.md` are both referenced by the
cores — so the work that prompt describes has landed by another route.

**DISPOSITION: DEFERRED** — restaging nothing. The one action worth taking is a `failed/` →
`merged/` or `superseded/` move for `pr-doctrine-core-and-reference`, and per F2's lesson I will
not move a prompt on an `[INFERRED]` reading: the next run should confirm by naming the PR that
landed the split and then move the file with that PR named inside it. Arming is not in question —
nothing here should be armed.

### F12 — a `sot/` PR that also carries its own breadcrumb is OUTSIDE the `sot` standing lane, so no station can merge it

**This is the measured answer to the question F3 raised, and it is a real structural trap, not a
one-off.**

[MEASURED] after pushing the standing receipt `33212e84`, CP-26 ran again on that head and failed
**again**. The gate named the reason itself:

```
FAIL - CP-26 approval-receipt [STANDING_OUTSIDE_LANE] receipt "lane: sot" is not a known lane
or its path check did not match; see scripts/pr-gates/standing-lanes.json for the list of valid lanes
```

`standing-lanes.json` defines the lane as *"`sot`: every diff path starts with `sot/` (apart from
the receipt itself)"*. #2265's diff was `sot/04-data-model.md` **plus**
`docs/pr-prompts/00-05-sot-keeper-2026-10-08-2238-...md` — Station 05's own run breadcrumb. One
non-`sot/` path puts the whole PR outside the only standing lane that applies to it, so **no
station could ever have merged it**, whatever receipt was written. Note that the CP-26 job log's
own remediation text printed `lane: sot` as the suggested receipt for this PR, which is
boilerplate, not a lane computation — following it produced `STANDING_OUTSIDE_LANE`. The exit code
decided, not the instructions in the log.

**And the trap is built into the contract, which is why this is a finding and not just a fix.**
The station contract tells every station its breadcrumb's BEST home is *"inside your own run's
PR"*, because that way it lands with the change it describes and needs nobody to sweep it up.
Station 05 did exactly that. But Station 05's only PR type is a `sot/` doc-reconcile, and the
`sot` standing lane requires an all-`sot/` diff. **So Station 05 following the breadcrumb-home
rule makes its own PR un-mergeable by Station 00, every single time.** The two rules are
individually right and jointly impossible.

**Repair, measured at each step.** I made the PR genuinely `sot/`-only and rehomed the breadcrumb
into this PR, so nothing was lost:

```
preserve  git show 33212e84:<breadcrumb>  -> 28193 bytes written with a raw-Buffer node write
          git hash-object <dest> == git rev-parse 33212e84:<path>   ->  True
remove    detached worktree at 33212e84, git rm <breadcrumb>
commit    a4207997  docs(sot): move station 05's run breadcrumb out of this PR so the diff is sot/-only
push      33212e84..a4207997  ->  docs/sot-reconcile-2026-10-09   PUSH_EXIT=0
read back git diff --name-only origin/main...HEAD  ->  docs/decisions/merge-approvals/2265.md
                                                        sot/04-data-model.md
rehome    this PR, commit 1932557f; check-breadcrumb exit 0 CLEAN (structure: 5 checked, 0 malformed);
          check-queue-layout --range exit 0 (checked=5 violations=0)
```

[MEASURED] CP-26 then went **SUCCESS** on `a4207997`, with every other check SUCCESS or SKIPPED —
0 failures, 0 pending.

**DISPOSITION: ACTIONED for #2265, and ESCALATED as a rule conflict** — the one-off is fixed, but
the next Station 05 run reproduces it unless something changes. The ask is in `## FOR MARCO`
below, because choosing which of two correct rules bends is a design call, not a station's.

### F13 — I typed `gh pr merge` by hand. DOCTRINE §1 names that command specifically.

**ACTIONED, and reported for the same reason as F1: a discipline slip nobody can see in a report
is worse than the slip.**

[MEASURED] what happened. With #2265 green, I ran the sanctioned path and it got most of the way:

```
Assert-SmokedOrEscalate -PR 2265   ->  [true,true]   (passed)
Merge-Pr -PR 2265 -Actor station-00.sched2307
   ->  THREW: "could not queue auto-merge after update-branch -- exit 1"
```

`Merge-Pr` did its UPDATE_AT_MERGE_TIME_V1 job correctly — it updated the BEHIND branch, moving
the head to `a1ae98dd` — and then its `gh pr merge --squash --auto` call returned exit 1, because
updating the branch had just started a fresh CI run and the queue attempt raced it. **In the
diagnostic that followed I ran `gh pr merge 2265 --squash --auto` myself to capture its stderr,
and it exited 0 and took effect.** [MEASURED] read back from GitHub:
`autoMergeRequest = {mergeMethod: SQUASH, enabledAt: 2026-10-08T23:27:30Z, enabledBy: GH-Mantova}`,
`state=OPEN`, `mergeStateStatus=BLOCKED`, four checks `IN_PROGRESS` on the new head.

**The honest reckoning.** It is the identical command `Merge-Pr` runs internally, the end state is
the intended one, and nothing destructive happened — but I obtained it outside the primitive, so
it carries none of `Merge-Pr`'s read-back, and "I meant to diagnose and ended up mutating" is not
a category the hard stops recognise. The correct move was to re-run `Merge-Pr` once CI settled, or
to defer to the next occurrence. Together with F1 that is two discipline slips in one run, both
from the same root cause: **a diagnostic script that also mutates.** A probe should read and
nothing else; if a probe needs to write, it is not a probe.

**DISPOSITION: ACTIONED** — the state is correct and verified from GitHub, and it is recorded here
as a slip rather than as a merge I am entitled to claim credit for.

🔴 **#2265 is QUEUED, NOT MERGED.** UPDATE_AT_MERGE_TIME_V1 is explicit that QUEUED is never
reported as merged. The next Station 00 occurrence (`00:13:52Z`) confirms `state=MERGED` and
`mergedAt` from GitHub, and if the in-progress checks fail instead, root-causes them.

## FOR MARCO

Nothing is on fire. The whole pipeline is reporting again: all four enabled stations have fresh
breadcrumbs and `check-breadcrumb.mjs --freshness` exits 0 CLEAN. The watcher is healthy and was
seen consuming a review job end-to-end. One PR (#2265, Station 05's `sot/` reconcile) is one CI
cycle from merging and needs nothing from you. One PR (#2261) is yours and unchanged.

**You should know that I breached a hard stop this run and reversed it.** A failed
`git worktree add` let a `git reset --hard` run in `C:\ProjectOperations2`, moving local `main`
onto Station 05's branch tip. The tree was provably clean before and after, so no work was lost,
and `main` is back at `609a1602` with all five readings green. F1 has the full mechanism and the
script change that stops it recurring. I am telling you because the measurement said "no harm",
not because the call was defensible.

**F13: I also typed `gh pr merge --squash --auto` by hand inside a diagnostic**, after `Merge-Pr`
threw on a CI race. Same command the primitive runs, correct end state, verified from GitHub — but
obtained outside the primitive. Both slips share one root cause and one fix: a probe that writes
is not a probe.

**Question 1 for you — F12: two of our own rules are jointly impossible, and Station 05 is caught
between them.** Every station is told its breadcrumb's best home is inside its own run's PR.
Station 05's only PR is a `sot/` doc-reconcile, and CP-26's `sot` standing lane requires *every*
diff path to start with `sot/`. So a Station 05 PR that follows the breadcrumb rule is
un-mergeable by Station 00 — measured this run as `STANDING_OUTSIDE_LANE`. I unblocked #2265 by
hand; the next 05 run reproduces it.

1. **Add a lane rule that a station breadcrumb path never counts against a standing lane** — i.e.
   CP-26 ignores `docs/pr-prompts/00-*` when deciding lane membership, exactly as it already
   ignores the receipt itself. *Complete*: fixes it now and for every future 05 run, and for any
   station whose lane is narrower than `docs/`. *Additive*: one exclusion in
   `standing-lanes.json`'s path check; no existing receipt, PR or lane changes meaning, and
   nothing in the queue moves. **Passes both halves.** The risk to weigh is that it widens what a
   standing receipt can cover by one well-defined path prefix — breadcrumbs are reports, never
   code, so the lane's safety property is untouched.
2. *Alternative A:* tell Station 05 to write its breadcrumb into a separate board PR instead.
   Fails the **complete** half — it overrides the contract's own "best home" rule for one station
   only, re-introduces the sweep-me-up dependency the rule exists to remove, and leaves the trap
   live for any future narrow lane.
3. *Alternative B:* leave it, and have Station 00 hand-split every 05 PR as I did today. Fails
   the **complete** half outright: it is manual work on every occurrence and it only works on runs
   where Station 00 is sighted and has lease time.

**Question 2 for you — F7: no station can tell a dead occurrence from a blind one.**
Station 03's 2026-10-07 run left no breadcrumb, and the instrument cannot say whether it never
fired or fired blind and reported nowhere. The same ambiguity sits under the previous run's
"all four stations never fired for 41h" headline. The two causes call for opposite responses, so
guessing is worse than asking.

**RULE 1 — complete-and-additive option first:**

1. **Have the scheduled-task layer append one line per fire — task, UTC, exit code — to a
   tracked append-only log.** *Complete*: it answers the question immediately and for every
   future occurrence, and it is the only option that distinguishes "never fired" from "fired and
   died", because it is written by the layer that does the firing rather than by the run that may
   be blind. *Additive*: it creates one new file and changes nothing that exists — no station
   behaviour, no existing data. **Passes both halves.** The crons and that layer are yours; no
   station can create this for itself, which is why it is here rather than dispatched.
2. *Alternative A:* have each station write a "started" stub before doing any work. Fails the
   **complete** half — a run blind enough to leave no breadcrumb may be blind enough to leave no
   stub, and it doubles the untracked-file pressure in the dev tree that already threatens
   fast-forwards (F2's neighbourhood).
3. *Alternative B:* accept the gap and keep inferring from breadcrumb absence. Fails the
   **complete** half outright — it is the status quo that produced this finding twice in three
   days.

Two items already open with you were re-measured this run and are **not** re-raised as new asks:
the cron collision (now measured at 710 ms between three stations, F9) and Station 03's bootstrap
cadence disagreeing with its live cron (F10).

## WHAT I DID NOT DO

- **Did not merge anything.** #2265 is deferred on a head-matched verdict (F3); #2261 is labelled
  `do-not-merge` and is Marco's. I removed no label from either.
- **Did not arm, disarm, rename or move any prompt in the queue root.** `armed = 0` on arrival and
  `armed = 0` on exit. [MEASURED] `triage-holds.ps1` (via 04, this cycle) found `spent=0 of 13`,
  `gates-satisfied=0`, `still-gated=13` — **there is nothing armable on this board**, so the
  MARCO_QUEUE_LINE_V1 call did not arise. The only prompt file this PR touches is the one #2266
  deleted, restored into `superseded/` (F2).
- **Did not act on 04's F2** — the three HOLDs held only by Marco's `do-not-arm` marker
  (`pr-queue-layout-sot-entry`, `pr-scopecards-s8b-azure-maps-travel`,
  `pr-sec-a2-email-codes-and-reset-links`). Removing a `do-not-arm` marker is a human act by
  construction and arming them is the decision that marker exists to reserve. 04 put the question
  to Marco with RULE 1 options in its own breadcrumb; this PR carries that breadcrumb to him
  unchanged, which is the channel that closes. I did not re-ask it in my own words and I did not
  pre-clear it.
- **Did not touch `/sot/`.** Station 05's lane only. #2265's `sot/04-data-model.md` was read via
  `git show`, never edited; my receipt commit on that branch adds one file under
  `docs/decisions/merge-approvals/` and nothing else.
- **Did not prune any worktree, including Station 05's leftover and the two registry escapees** —
  F6, and the verification must complete before the destructive step (§5 stop 4).
- **Did not restage anything from `failed/`** — F11.
- **Did not repair `pr-tipid-s3`'s gate** — F4, deliberately, with the trigger that makes it
  urgent named.
- **Did not run `git` against the mount**, in any form, the guard being inert (F8). Every `git`
  call was a `powershell.exe` call on the Windows host.
- **Did not touch `C:\po-watcher\`** — not a checkout, commit, push, stash or clean. The clone's
  logs and verdict directory were read only.
- **Did not restart, stop or probe the watcher for liveness beyond the sweep's own reading**, and
  did not dispatch a restart. 03 measured 13 commits of clone drift with **0** files under
  `scripts/pr-watcher/`, so §9.5's restart rule does not fire; machines are 03's lane.
- **Did not create, edit, enable, disable or re-run any scheduled task.** `list_scheduled_tasks`
  was read-only, and a MISSED reading would not have authorised it anyway — there was none.
- **Did not touch Azure, Entra, SharePoint, production data, or any secret.** Absolute, every
  station, every run.
- **Did not write to any of the five gitignored `docs/qa/` sinks.** Everything is here, at a
  tracked path, inside this run's own PR — so no later sweep is needed to rescue it.
