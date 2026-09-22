# Station 00 — Supervisor | 2026-09-22T09:14Z–2026-09-22T09:40Z

## GROUND

```
UTC            2026-09-22T09:15:11Z
origin/main    3be7587a            (fetched, then rev-parse)
dev tree       main @ c2511054 -> 3be7587a  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** (both `1`), so this run was not read-only. The station doc also
declares `contract_version: 5`, which is the version that landed in `#2075` at 07:31Z.

**Which tree I read my binding documents in:** the dev tree `C:\ProjectOperations2`, never the
watcher clone — and I proved currency rather than assuming it (PREFLIGHT step 2). This run is
**SIGHTED**: Desktop Commander answered on the first call, so nothing here is a blind-run report.

## WHAT I MEASURED

**[MEASURED] Host reachable — this is a sighted run.** `start_process`, shell `powershell.exe`,
after a successful `ToolSearch` load: `PROOF <host> 2026-09-22T19:14:36` (local, Brisbane UTC+10).
A second persistent shell (PID 28052) carried every subsequent call. **No `git` and no `gh` in this
run went through the device bridge**; all of them ran in PowerShell on the Windows host.

**[MEASURED] `vm-git-guard.sh` exit 2 — INSTALLED BUT INERT, the expected station outcome.** Quoted
headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
`===GUARD_EXIT=2===`, read off the **installer** and not off a pipeline appended to it. Both of the
installer's own controls printed: `bash -lc 'command -v git'` -> the shim,
`bash -c 'command -v git'` -> `/usr/bin/git`. Per contract v5 this is a FINDING, not a STOP (F4).

**[MEASURED] The three binding documents are byte-current with `origin/main`.**
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** — the real answer per PREFLIGHT step 2.
No piped hash was taken or compared (§9.1: the piped form is unsound in `powershell.exe`).

**[MEASURED] Every statement in every chain ran.** Each `interact_with_process` chain carried a
literal marker after each statement (§9.1 guard 1) and every marker is present in the transcript:
`MARKER_A`–`MARKER_D`, `MARKER_E`–`MARKER_N`, `MARKER_P1`–`MARKER_P4`, `MARKER_Q1`–`MARKER_Q2`,
`MARKER_R1`–`MARKER_R3`, `MARKER_W1`–`MARKER_W3`, `MARKER_X1`–`MARKER_X2`, `MARKER_Y1`–`MARKER_Y3`.
**No read-back in this run sits after a command that can fail without a marker between them.**

**[MEASURED] One `interact_with_process` call hit the 180 s MCP cap during `status-sweep.ps1`, and
guard (2) of §9.1 decided it in one call.** `read_process_output` on PID 28052 returned the full
169-line buffer with the shell alive and its working directory intact; the sweep then completed and
printed `ENC=utf16le BYTES=151618 LINES=431`. **The shell was never abandoned.** This is a transport
timeout rather than the `Process has finished execution` message, so it narrows nothing and refutes
nothing — it is recorded only because the cure was the same one and it cost one call.

**[MEASURED] The sweep capture is UTF-16LE, exactly as §9.3 warns.** `*> sweep.txt` produced a
151,618-byte file opening `FF FE`; decoded `utf16le` in node it is 431 lines with all ten sections
present. The same applies to `triage-holds.ps1` (78 lines, `ENC=utf16le`). Neither was read as
UTF-8 and neither section header was lost.

**[MEASURED] Board and machinery, from the sweep's `[LIVE]` lines only.**

| | reading |
|---|---|
| OPEN PRs | **0** |
| `main` CI on `3be7587a` | 4 success / 0 failed — **(trunk green)** |
| watcher node | RUNNING pid **9744**, auto-restart wrapper alive (1) |
| heartbeat age | 43 min (ticks only mid-run; stale + empty queue = idle) |
| `index.lock`, dev tree / clone | **False / False** |
| git processes touching our trees (scoped) | **0** |
| no PR touched on GitHub in the last 2 min | yes |
| armed `*-ready.md` | **0** |
| `needs-marco/` | **62** |
| section 7 verdict | **SAFE TO ACT** |

**[MEASURED] I re-derived the two `[LIVE]` verdicts I was going to act on, per §9.5 — provenance is
not correctness.**

*Trunk.* `gh run list -R GH-Mantova/ProjectOperations --commit 3be7587a49e3a94f42202a98cdd42d86d6d7c120
--json databaseId,conclusion,workflowName,event` (full 40-char SHA per §9.4; `-R` and
`$LASTEXITCODE` tested per the CWD bullet; **assign-then-count with a null guard**). `GHEXIT=0
CHARS=476`, `ROWCOUNT=5`:

| workflow | event | conclusion |
|---|---|---|
| `Claude Code` | `issue_comment` | skipped |
| `CI` | push | success |
| `CodeQL` | dynamic | success |
| `Deploy` | push | success |
| **`Tendering Browser Smoke`** | push | **success** |

No `Dependabot Updates` row and no `schedule` event, so §9.5's denylist changes nothing here. **The
sweep's `(trunk green)` survived re-derivation.**

*Watcher liveness.* Not taken from the sweep and not reasoned from a process list.
`restart-watcher-if-wedged.ps1` (the ONLY sanctioned liveness authority), quoted verbatim:
`VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.`
`armed prompts waiting: 0`, `watcher process: ALIVE (pid 9744)`,
`restart churn: 0 cycle(s) in 20 min`. **No restart was licensed and none was performed.**

**[MEASURED] The watcher clone is NOT corrupt, and its `dirty=4` is only PARTLY the documented false
warning.** In `C:\po-watcher\ProjectOperations`: `git status --short` -> **4**,
`git status --porcelain --untracked-files=no` -> **1**. The two forms disagree exactly as §9.5
records, so three of the four are untracked (`?? .codex/`, `?? AGENTS.md`,
`?? scripts/pr-watcher/.conflict-notified-prs.json`) and `start-watcher.ps1` ignores them. **The
fourth is real and is a tracked modification:** ` M docs/data-model/metadata-catalog.json`, and
`git diff --numstat origin/main -- <that path>` reads **`0 36`** — zero insertions, 36 deletions, so
it is not the append-only superset shape. Corruption test, which is the one that decides:
`MERGE_HEAD` -> **False**, `git diff --diff-filter=U` -> **0** unmerged paths, branch `main`,
**11 behind** `origin/main`. **Not corrupt. `rescue-watcher-repo.ps1` was NOT run and must not be.**
A tracked-dirty clone auto-stashes rather than refusing (§9.5), and the receipts are visible:
**`git stash list` -> 77**, against the 71 §9.5 records. ⚠️ **That count is STATE — re-measure it,
never quote it.**

**[MEASURED] Queue triage, `triage-holds.ps1`, exit 0.** Both of its own controls PASS at the top of
its output: `GIT control: PASS -- git read origin/main:docs/pipeline/DOCTRINE.md (214264 chars)` and
`SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture`. **15 of 15** depth-1 prompts
are `STILL GATED`, in **two distinct reject codes** — `[HUMAN_GATE_PRESENT]` x 11 and
`[FILE_GATE_NOT_RELEASED]` x 4. `SPENT`, `GATES SATISFIED`, `SPENT BEHIND A REJECT` and
`POSSIBLE DUPLICATES` are all **(none)**. Disk census, counted directly rather than quoted from the
script: `ARMED=0`, `HOLDS=15`, root `00-*.md` = **1**.

**[MEASURED] `lastRunAt` crossed against every station's newest breadcrumb — no station is SILENT
and none is mid-run unreported.** `check-breadcrumb.mjs --freshness` -> `CLEAN`, exit 0. The
scheduled-tasks MCP gives the live crons and last runs:

| station | cron (MCP) | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|---|
| `00-supervisor` | `5 * * * *` | 2026-09-22T09:14:16Z (**this run**) | 08:20Z | aligned |
| `03-machine-minder` | `0 9 * * *` | 2026-09-21T23:02:53Z | 2026-09-21T23:04Z | aligned |
| `04-scanner` | `0 */4 * * *` | 2026-09-22T06:09:53Z | 06:10Z | aligned |
| `05-sot-keeper` | `10 0 * * *` | 2026-09-21T14:10:40Z | 2026-09-21T14:11Z | aligned, not yet due (next 14:22Z) |
| `weekly-security-audit` | `30 7 * * 1` | **`enabled: false`** | n/a | off, as `STATION-CAPABILITIES.md` §1 records |

**The live ENABLED count is FOUR**, which is what §1's 2026-09-15 correction predicts. ⚠️ `00`'s
`ok` is the weakest row here and I did not lean on it: `check-breadcrumb.mjs`'s own `CADENCE` map
still carries `'00': 2` against a live hourly cron, so `--freshness` would not call `00` SILENT
until three consecutive hourly runs were missed. **The `lastRunAt` cross-check above is what
actually settles `00`**, and it is the instrument that defect does not touch.

**[CANNOT MEASURE] nothing this run needed.** Every probe I reached for answered.

## WHAT CHANGED

**1. The dev tree was fast-forwarded `c2511054` -> `3be7587a`, after clearing eighteen untracked
FF blockers that were proved redundant first.** This is the mutation this run exists for, and it is
the predicted consequence of the previous run's F6 landing.

The first `git merge --ff-only origin/main` **REFUSED**: `error: The following untracked working
tree files would be overwritten by merge:` naming all eighteen `docs/pr-reviews/pr-<N>-review.md`
paths that `#2078` had just published. **Every instrument that looks for a modification read clean
at that moment** — `git diff --numstat` EMPTY and `git diff --cached --name-status` EMPTY — which is
the documented PASS reading and exactly the trap my station doc records.

**I proved each file redundant before deleting any of it.** For all eighteen,
`git rev-parse origin/main:<path>` against `git hash-object <path>` (no pipe — §9.1):
`SUMMARY identical=18 differs=0 notOnMain=0 total=18`. Sample rows, quoted:
`IDENTICAL docs/pr-reviews/pr-2027-review.md blob=7063f77a… disk=7063f77a… bytes=5726` and
`IDENTICAL docs/pr-reviews/pr-2077-review.md blob=00958610… disk=00958610… bytes=1754`.
**Nothing local-only existed to lose**, so removing the disk copies was a no-op against content.

Then `Remove-Item` on the eighteen (`MARKER_H removed=18 of 18`) and
`git merge --ff-only origin/main` -> `Fast-forward`, **exit 0**, 20 files changed, 1021 insertions.
**No `git checkout -- <path>`, no `git clean`, no `reset`** (§9.2 — consumed prompts come back
armed).

**Read back, all four, because the first three pass on a dirty tree:**

```
git rev-list --left-right --count HEAD...origin/main  ->  0	0
git diff --numstat                                    ->  EMPTY
git diff --cached --name-status                       ->  EMPTY
git status --porcelain --untracked-files=no           ->  EMPTY
```

**Content proof, not just ref proof:** 19 `pr-20*-review.md` files present on disk,
`git ls-files docs/pr-reviews/pr-2077-review.md` -> tracked, and
`git rev-parse origin/main:docs/pr-reviews/pr-2077-review.md` -> `00958610`, the same blob the disk
copy hashed to before deletion. **The working copy really does carry the merged content.**

**2. The predecessor's breadcrumb is archived and this report is added, both inside this run's own
PR worktree** (`C:\po-wt\s00-0922-0930`, cut from `origin/main` at `3be7587a`). Cure 1 of my station
doc's REPORT CONTRACT: no loose copy is left in the dev tree, so this run creates **no new
fast-forward blocker for the next one** — which is the failure it spent its first ten minutes
clearing.

**Nothing else changed.** No prompt was armed, no PR was merged, no label was touched, no watcher
was restarted, no escalation was discharged.

## FINDINGS

### F1 — the eighteen published review verdicts blocked the dev-tree fast-forward EXACTLY as the previous run predicted, the prescribed cure worked unmodified, and the prediction is what made it cheap. `PREDICTED_FF_BLOCK_CLEARED_ON_FIRST_ATTEMPT_V1`

The 08:20Z run's F6 published eighteen dev-tree-only review verdicts and stated the consequence in
its own report: *"the dev tree still holds its untracked copies, so the dev tree's next
`git merge --ff-only` will refuse on these eighteen paths once this PR merges"*, with the safe order
spelled out — **merge first, then confirm each path's hash, then remove and fast-forward**.

**It refused, on exactly those eighteen paths, on the first attempt.** I followed the order as
written and it worked with no improvisation and no second try. Measurements are in WHAT CHANGED
above: `identical=18 differs=0`, FF exit 0, all four read-backs clean, content proof green.

🔴 **The reason this is a finding rather than housekeeping is what it cost, and what it would have
cost.** Every read-back my station doc's earlier cures prescribe — `--numstat` and `--cached` — was
**EMPTY while git was refusing**, which is the documented PASS reading. A run without the
prediction would have met a clean tree that could not fast-forward and re-diagnosed it from first
principles, which my station doc records four consecutive runs doing. **The prediction, not the
cure, is what made this ten minutes instead of an hour** — and the cure's own precondition
(hash-equality per path) is what made deleting eighteen files a safe act rather than a hopeful one.

🟢 **F6's falsifying probe, run from the other side and PASSED.** It asked that after the merge the
dev tree read 18 untracked and `origin/main` hold all eighteen names. Measured now, after the cure:
`git ls-files --others --exclude-standard -- docs/pr-reviews` -> **0** (was 18), and
`git ls-tree -r --name-only origin/main -- docs/pr-reviews/` -> **165** (was 147 tracked; +18).
Both halves of the publish landed and the hazard is discharged.

**DISPOSITION: ACTIONED** — dev tree converged at `3be7587a`, four read-backs plus a content proof
quoted above. ⚠️ **Falsifying probe for the next run:** `git rev-list --left-right --count
HEAD...origin/main` in `C:\ProjectOperations2` must read `0 0` before this run's own PR merges, and
`git ls-files --others --exclude-standard -- docs/pr-reviews` must read **0**. If the second is
non-zero, the review lane has begun accumulating again and F2 below is live rather than dormant.

### F2 — THREE untracked-but-trackable files survive in the dev tree, each a dormant instance of the same FF blocker F1 just cleared, and none has a staged fix. `DEVTREE_UNTRACKED_FF_HAZARD_SURVIVORS_V1`

F1 cleared the eighteen that were actively accumulating. [MEASURED] this run at `3be7587a`,
`git ls-files --others --exclude-standard` in the dev tree -> **3**, and each one is untracked, NOT
gitignored, absent from `origin/main`, and sitting in a directory whose siblings are tracked as a
class — which is precisely what turns an untidy file into a hazard:

| path | siblings tracked | on `origin/main` | mtime (UTC) | bytes |
|---|---|---|---|---|
| `Claude Design/docs/index.html` | **7** | 0 | 2026-06-26T01:15 | 5,326 |
| `docs/pr-prompts/.queue-sync-ledger.txt` | **1312** | 0 | 2026-08-19T23:19 | 889 |
| `docs/pr-prompts/queue-watch-state.md` | **1312** | 0 | 2026-08-31T20:26 | 38,757 |

NEGATIVE control, a freshly minted needle through the same `ls-tree` query
(`docs/zzQq00Needle20260922T0922.md`) -> **0**, so the zeroes in the `on_main` column are real
absences and not a broken query. ⚠️ **That needle is spent the moment this file is tracked.**

⚠️ **The difference from F1, and it is the whole reason this is DEFERRED rather than ACTIONED: these
three are DORMANT.** The eighteen were growing — the newest was 32 minutes old when the previous run
measured them. Nothing has written any of these three in **22 to 88 days**. The hazard fires only if
some PR lands one of those exact paths, and nothing is heading for them.

🔴 **And publishing them is NOT the right cure, which is where this parts company with F6.**
RULE 1 on the three options:

- **(a) publish all three, as F6 did** — fails the FUTURE half on at least one file.
  `queue-watch-state.md` is 21.5-day-stale **station state**, and the sweep already tags it
  `[STALE]` in section 4C. My station doc's NO-DRIFT section says station notes are left untracked
  and not committed at all, and DOCTRINE's recurring lesson is that *"every stale instruction this
  pipeline has tripped over began as a true statement of state pasted into an instruction
  document."* Committing it would make a three-week-old claim readable from a clean checkout. That
  is a cost, not a benefit.
- **(b) delete them** — fails the COMPLETE half and is not mine to do. `Claude Design/` is Marco's
  design folder; deleting an 88-day-old artefact of his to tidy a hazard that has not fired is
  destructive for no measured gain.
- **(c) the complete-and-additive class fix: make the FF blocker VISIBLE BEFORE it fires** — a
  preflight that lists untracked-but-trackable paths in the dev tree and names them as blockers, so
  the next run meets a named list instead of a refusal whose every read-back says CLEAN. It removes
  the blind spot permanently for all three and for whatever lands next, and it deletes and publishes
  nothing. **It is `scripts/`, outside Station 00's recorded `docs/` lane to merge**
  (`STATION-CAPABILITIES.md` §5, as narrowed 2026-09-22), so it needs a prompt and an arm, and
  nothing is armable this hour (F3).

⚠️ **I checked whether a fix was already staged rather than assuming one was not.**
`pr-devtree-sync-ff-only-guard-HOLD.md` is the obvious candidate by name and **it is not this
defect**: its premise is `! grep -q "DEVTREE_RESET" .claude/hooks/guard.mjs` and its subject is
blocking `git reset` in the dev tree, a different failure (a mixed reset cannot materialise a new
file). Its line 67 reads *"Arm only after he answers"* — a genuine `ARM_ONLY` human gate, correctly
held, and not mine to release.

**DISPOSITION: DEFERRED** — real, measured, dormant, and its cure is outside this station's lane to
merge. ⚠️ **What would make it urgent:** any PR that lands one of those three exact paths on `main`,
or `git ls-files --others --exclude-standard` in the dev tree climbing back above three. Either one
turns a dormant hazard into the next run's blocked fast-forward.
⚠️ **Falsifying probe:** re-run `git ls-files --others --exclude-standard` in `C:\ProjectOperations2`
with the `ls-tree` negative control above. If it returns 0, something published or removed them and
this finding is discharged; if it returns more than three, the accumulation has restarted.

### F3 — nothing is armable, and that is a measured verdict rather than an omission

[MEASURED] `triage-holds.ps1` exit 0, both controls PASS: **15 of 15** depth-1 prompts `STILL
GATED`, in two distinct reject codes — `[HUMAN_GATE_PRESENT]` x 11
(`pr-524-rates-b-slice2-canonical`, `pr-devtree-sync-ff-only-guard`, `pr-dns-s5-checker-flip-to-fail`,
`pr-e2e-container-s2-swap-required-job`, `pr-fv2-formrule-contract`, `pr-nav-jobs-projects-merge`,
`pr-queue-layout-sot-entry`, `pr-retire-tenderclientnote-s2`, `pr-siteid-notnull-backfill`,
`pr-tipid-s3-retire-the-name-guard-for-an-id-check`, `pr-vendor-invoice-ocr`) and
`[FILE_GATE_NOT_RELEASED]` x 4 (`pr-fv2-ai-digests`, `pr-fv2-output-channels`,
`pr-rates-s11c-drop-legacy-tables`, `pr-tenant-mt4-s2-ownership-migration`).
`GATES SATISFIED`, `SPENT`, `SPENT BEHIND A REJECT` and `POSSIBLE DUPLICATES` are all **(none)**.

The board is **EMPTY (0 open PRs)**, so the duplicate bucket has nothing to be a duplicate of and
DOCTRINE §10.6's open-PR cross-check is vacuous this hour rather than skipped.

The sweep's section 6 lists `rates-11c-blocked-consumers` as `READY TO STAGE`. **I left it**, for
the reason its own NOTE gives and that two previous runs gave: the consumers are *"staged but not
yet merged"*, the chain head `pr-rates-s11c-drop-legacy-tables-HOLD.md` is itself
`[FILE_GATE_NOT_RELEASED]`, and the chain **drops legacy rate tables**. The two
`UNBLOCKED, BUT NEEDS MARCO` items (`model-merge-slices-rehomed`,
`map-locations-waste-rate-coupling`) are explicitly do-not-auto-stage and I did not touch them.

**DISPOSITION: ACTIONED** — arming nothing was the correct action, and the measurement is what makes
it a decision rather than an oversight. `*-ready.md` = **0** before and after.

### F4 — the device-bridge git ban is still REMEMBERED, not mechanical; re-measured rather than repeated

[MEASURED] this run: `GUARD_EXIT=2`, headline `vm-git-guard INSTALLED BUT INERT`, both installer
controls printed. Unchanged in substance from the 06:14Z, 07:14Z and 08:20Z runs — and contract v5
is still doing its job: exit 2 has a bucket, it is named as the EXPECTED station outcome, and the
report cost one call with no re-run and no retraction.

**DISPOSITION: DEFERRED** — the residual cure is a change to how the VM shell is launched (a login
shell, or the shim installed where a non-login shell reads), which is neither `docs/` nor inside
this station's lane to merge. ⚠️ **What makes it urgent:** the next 0-byte `index.lock` with no
owning Windows process. That freezes every station. ⚠️ **This run did not run `git` through the
bridge at any point** — an inert guard is never a licence, and every `git`/`gh` call above ran in
PowerShell on the Windows host.

### F5 — `triage-holds.ps1`'s `SUSPECT: broken probe` banner fired again on a correct board — SECOND consecutive hour, and its trigger has still not fired

The 08:20Z run's F4 recorded this and DEFERRED it with the trigger *"a run that reports
`GATES SATISFIED` as unreliable, or skips arming, **citing this banner**."*

[MEASURED] this run: the banner fired again, and again its own precondition is answered two lines
into the same output file (`GIT control: PASS`, `SPENT control: PASS`). And again the bucketing
claim is false on its own terms — the 15 landed in **two** distinct reject codes, which a skipped
gate cannot manufacture, because §9.5's *"a missing git makes every gate skip"* failure produces a
uniform **ADMIT**, not a split between a human-gate code and a file-gate code.

**The trigger did NOT fire.** I did not skip arming because of the banner and I do not report
`GATES SATISFIED` as unreliable — F3 is a verdict from the two reject codes, reached independently
of it. What is new is only the **recurrence**: two consecutive hours on a quiet board, which is the
mechanism the previous run predicted (*"a warning that always fires is a warning nobody reads"*).

**DISPOSITION: DEFERRED** — unchanged disposition, unchanged owner. The fix is
`scripts/pipeline/triage-holds.ps1`, outside 00's recorded lane to merge. ⚠️ **What would make it
urgent** is unchanged and deliberately not widened: a run citing this banner to skip arming or to
distrust a correct `GATES SATISFIED`. ⚠️ **Falsifying probe** is unchanged: run `triage-holds.ps1`
on an hour when at least one prompt ADMITs.

### F6 — COLLECT: the one breadcrumb since my last run is fully dispositioned, and BOTH of its open probes are discharged by measurement

Exactly one breadcrumb sat at depth 1 of `docs/pr-prompts` (`ROOTCRUMBS=1`):
`00-00-supervisor-2026-09-22-0820-…-eighteen-review-verdicts-were-never-published.md`, tracked on
`main` via `#2078`. No other station filed since 08:20Z — 03, 04 and 05 are all aligned on
`lastRunAt` and none is due (table under WHAT I MEASURED).

Its nine findings, each re-verified against the live system rather than carried forward:

| its finding | its disposition | mine, this run |
|---|---|---|
| F1 `#2071` merged by the supervised lane with a receipt | ACTIONED | **confirmed** — `gh pr view 2071` reads `MERGED`; `docs/decisions/merge-approvals/2071.md` is on `origin/main`. Its own falsifying probe passes |
| F2 trunk red was a WebKit transient; re-run issued | ACTIONED, probe left open | **DISCHARGED.** `gh run view 35701400793` -> `attempt 2, conclusion success, completed`. And the second half of its probe is answered too: on the NEW head `3be7587a`, `Tendering Browser Smoke` is `success` on a `push` event. **Two greens, two heads — transient, confirmed, and the "third spec" escalation condition did NOT fire** |
| F3 nothing armable, 15/15 gated | ACTIONED | **re-measured identical** — my F3 |
| F4 `triage-holds` SUSPECT banner | DEFERRED | **re-DEFERRED as my F5**, with the recurrence measured and the trigger re-checked as NOT fired |
| F5 git ban remembered not mechanical | DEFERRED | **re-DEFERRED as my F4**, condition re-measured (exit 2) rather than repeated |
| F6 eighteen review verdicts published; FF will refuse next | ACTIONED, consequence predicted | **DISCHARGED — my F1.** It refused on exactly those paths; the prescribed order worked first time; both halves of its falsifying probe pass (18 -> 0 untracked, 147 -> 165 tracked) |
| F7 third instance of a false `finished execution` | ACTIONED | **not re-met in that form.** I hit a transport *timeout* during the sweep and applied the same guard — read the buffer, do not abandon the shell — and the shell was alive with its CWD intact. Recorded under WHAT I MEASURED; it narrows nothing |
| F8 COLLECT of the 07:14Z breadcrumb | ACTIONED | confirmed — that file is in `archive/`, brought in by the fast-forward as a rename |
| F9 `gh pr edit` clears native auto-merge, a push does not | ACTIONED | **its own PR is the confirming trial: `#2078` reads `MERGED`, `mergedAt 2026-09-22T08:35:22Z`.** The re-armed auto-merge held to completion, so the re-arm-after-`gh pr edit` rule is now backed by a landed merge and not only by two `autoMergeRequest` readings |

**DISPOSITION: ACTIONED** — `git mv`'d to `docs/pr-prompts/archive/` in this run's PR. Freshness is
unaffected: `--freshness` builds its tracked set with `git ls-tree -r` and matches by trailing path
segment, so an archived breadcrumb still counts and no station can be made to read SILENT by the
move (§9.5).

### F7 — the watcher clone carries a TRACKED modification, not only the documented untracked false warning, and its stash count has grown 71 -> 77

DOCTRINE §9.5 records that `status-sweep.ps1`'s `watcher clone: … dirty=N … the watcher may refuse
to start` is a false warning on two counts: it counts untracked files that `start-watcher.ps1`
ignores, and a tracked-dirty clone **auto-stashes** rather than refusing. **Both halves still
hold and I did not dispatch the line to Station 03** — mis-routing it is the measured cost §9.5
names.

⚠️ **But the reading is not purely the documented one this hour, and the distinction matters.**
`git status --short` -> 4 against `--untracked-files=no` -> **1**. Three are untracked (`.codex/`,
`AGENTS.md`, `scripts/pr-watcher/.conflict-notified-prs.json`); **the fourth is a genuine tracked
modification**, ` M docs/data-model/metadata-catalog.json`, at `0 36` against `origin/main` — a
deletion shape, so not the append-only superset case. **The clone is 11 behind `origin/main` on
`main`, with `MERGE_HEAD` False and 0 unmerged paths: NOT CORRUPT**, which is the only reading that
licenses `rescue-watcher-repo.ps1`, and it was not run.

The consequence is bounded and is the one §9.2 asks to be reported: the next watcher restart
auto-stashes that file, and `git stash list` is now **77** against the **71** §9.5 records — *"a
closed loop: the launcher's preflight stashes on every start, and nothing ever pops."* Six more
stashes, nothing lost, nothing recoverable by itself.

**DISPOSITION: DEFERRED** — the clone is healthy on every test that decides (branch, corruption,
liveness), the file is generated, and clone hygiene is Station 03's lane, whose authority row in
`STATION-CAPABILITIES.md` §5 is **report-only**, so dispatching a mutation there is a dispatch to
nobody. ⚠️ **What would make it urgent:** a stash whose creation FAILS — that is the only path by
which a dirty clone still refuses to start — or `MERGE_HEAD` appearing, which is an emergency and
takes `rescue-watcher-repo.ps1` immediately. ⚠️ **Falsifying probe:** run both `git status` forms
against the clone in the same minute. If they ever agree, §9.5's bullet is wrong; if
`--untracked-files=no` reads 0, this finding is discharged.

### F8 — the sweep's only `[STALE]` row is not PR-scoped, so it is NOT mine to discharge, and the file behind it is one of F2's three survivors

My station doc requires section 5's `[STALE]` escalation rows to be cleared during COLLECT, and
requires that they never be cleared on the tag alone. [MEASURED] this run: the whole sweep contains
exactly **one** `[STALE]` line, in section 4C, and it is **not** a `needs-marco/` escalation and
names **no PR**:

```
[STALE] no station summary younger than 3 days -- freshest is queue-watch-state.md
        (08-31 20:26Z, 21.5 days old); body deliberately NOT quoted.
```

My station doc's rule is explicit for this shape: *"if a NEW `[STALE]` row names a file that is not
PR-scoped, **read it rather than discharging it**."* I read it — and it is the same
`docs/pr-prompts/queue-watch-state.md` that F2 measures as untracked, absent from `origin/main`, and
38,757 bytes of three-week-old state. **So the `[STALE]` tag and the FF hazard are two readings of
one file**, which is worth saying because a future run could otherwise clear one and be surprised by
the other.

The `needs-marco/` count is **62**, unchanged, and **I discharged nothing**: no file was moved to
`discharged/` and no `_DISCHARGE-NOTE-*.md` was written, because no PR-scoped `[STALE]` row existed
to justify one.

**DISPOSITION: DEFERRED** — folded into F2's trigger rather than given its own, since the cure for
either reading is a decision about the same file. ⚠️ **What would make it urgent:** a station
summary going stale while a station is genuinely SILENT, at which point this row stops being noise
about a dead file and starts masking a real gap. The `lastRunAt` cross-check above is what currently
rules that out, and it is a different instrument.

## WHAT I DID NOT DO

- **I did not merge anything.** `OPEN PRs: 0` — there was nothing on the board to merge, green or
  otherwise. I ran no `Merge-Pr`, enabled no auto-merge on anything but my own board PR, and
  hand-merged nothing.
- **I did not arm anything.** `*-ready.md` = 0 before and after. All 15 depth-1 prompts are gated in
  two distinct reject codes (F3). I left `rates-11c-blocked-consumers` alone — its chain head is
  `[FILE_GATE_NOT_RELEASED]` and it drops legacy rate tables — and I did not touch the two
  `UNBLOCKED, BUT NEEDS MARCO` backlog items.
- **I did not arm `pr-devtree-sync-ff-only-guard-HOLD.md`**, although its subject is adjacent to
  F1/F2. It carries an `Arm ONLY` human gate at line 67 and its premise is a different defect
  (`DEVTREE_RESET`). A prose or literal human gate is Marco's to release, not mine.
- **I did not retire or supersede any prompt.** `SPENT` and `SPENT BEHIND A REJECT` were both
  `(none)`, so nothing had a dead premise to retire.
- **I did not clear any `needs-marco/` escalation.** The one `[STALE]` row is not PR-scoped (F8), and
  discharging on a `[FILE]` line alone is what my station doc forbids. The count is unchanged at 62.
- **I did not publish or delete the three untracked dev-tree files** (F2). Publishing 21-day-stale
  station state contradicts NO-DRIFT; deleting Marco's design artefact is destructive for no
  measured gain. The hazard is recorded with a trigger instead.
- **I did not restart the watcher.** The sanctioned verdict was `OK — an idle watcher is correct,
  not wedged`, with 0 armed and 0 restart churn in 20 min. Nothing licensed `-Fix`.
- **I did not run `rescue-watcher-repo.ps1`** and I did not dispatch the clone's `dirty=4` line to
  Station 03 (F7). The clone is on `main` with no `MERGE_HEAD` and no unmerged paths — `*** CORRUPT`
  is the only reading that licenses the rescue script, and it did not appear.
- **I did not run `git` through the device bridge**, guard inert or not (F4). Every `git` and `gh`
  call ran in PowerShell on the Windows host.
- **I did not use `git checkout -- <path>`, `git clean`, `git reset` or `git stash pop` anywhere.**
  The eighteen FF blockers were cleared with `Remove-Item` after a per-path hash proof, which is the
  §9.2-safe route.
- **I did not do 03's, 04's or 05's work.** None was due; all three are aligned on `lastRunAt`.
- **I did not edit `/sot/`** — Station 05's, CP-24. **DOCTRINE is unchanged by this run**; nothing
  here was added to the hash-gated `instruments` canonical block.
- **I did not touch Azure, Entra or SharePoint**, and wrote no production data.
- **I did not commit in the dev tree or on `main`.** All work is in an isolated worktree cut from
  `origin/main` at `3be7587a`; the dev tree's index was EMPTY before and after
  (`git diff --cached --name-status` -> EMPTY, twice).

---

**Breadcrumb validation.** `node scripts/pipeline/check-breadcrumb.mjs` — its result is quoted in
this run's PR body. `lint-prompt.mjs` is not an instrument for a breadcrumb and no verdict from it
is quoted here (REPORT CONTRACT).

**This report was written INSIDE this run's PR worktree** (cure 1), so no loose copy exists in the
dev tree and this run leaves **no fast-forward blocker** for the next one.
