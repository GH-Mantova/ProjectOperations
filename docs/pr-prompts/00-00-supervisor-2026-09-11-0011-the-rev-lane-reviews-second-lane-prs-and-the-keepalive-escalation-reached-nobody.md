# Station 00 — Supervisor | 2026-09-11T00:08:47Z–2026-09-11T00:3xZ

## GROUND

```
UTC            2026-09-11T00:08:47Z
origin/main    e6e11370  (at start)  ->  f134efe6  (after merging #1866)
dev tree       main @ e6e11370       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (station_doc_version declared by the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE. This run was NOT read-only-forced.

**Sighted run.** Desktop Commander tools were loaded by keyword `ToolSearch` first (never by
hard-coded id), then `start_process` shell `powershell.exe` succeeded. Every probe below ran on the
Windows host.

**Which tree I read in.** All three binding documents were read from the dev-tree working copy,
`C:\ProjectOperations2`, after the sound equivalence check passed:
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` returned **EMPTY**, and `HEAD` was `origin/main` exactly.
No piped hash was taken (DOCTRINE section 9.1 — the `git show | git hash-object --stdin` form is
unsound under `powershell.exe`).

**Negative control minted for this run:** `zzQq00N` + `0911T0025`. It returned **0** against every
corpus searched below, and it is spent the moment this file is tracked.

## WHAT I MEASURED

**vm-git-guard install: FAILED, and no VM-side call was made.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` never ran; the Linux workspace
would not start: *"failed to mount ... is under Plan9 share \"c\" which is not mounted"*, plus
*"ensure user: user inspiring-fervent-fermi already exists unexpectedly"*. **There is no installer
last line to quote because the installer never executed.** Per the PREFLIGHT block a failed install
is a FINDING, not a STOP — see F6. Exposure this run was **zero**: every `git` call was PowerShell on
the Windows host through Desktop Commander, none through the bridge, and both `index.lock` probes read
False at the start and the end. **Third consecutive run with this exact mount error** (03 recorded it
on 09-09 and 09-10).

**status-sweep.ps1 ran, section 0 controls PASSED, section 7 said SAFE TO ACT.** [MEASURED] captured
with `*>` to `C:\po-sup-fix-scripts\sweep-0011.txt`, **134,276 bytes**, decoded **utf16le** in node
per DOCTRINE section 9.3 — read as UTF-8 the 397-line report is structureless and its `====` section
headers match nothing. Generated `2026-09-11 00:10:19Z`. Section 0: `gh CAN reach GitHub (saw merged
PR #1864)`, `node runs`. No `[BROKEN]`.
⚠️ The first capture attempt was refused — `Access to the path 'C:\sweep-0011.txt' is denied` — and
`$LASTEXITCODE` still read **0**, because the exit code belonged to the child `powershell.exe` and not
to the redirection that failed around it. The file simply did not exist. Re-run to
`C:\po-sup-fix-scripts\`, which is the mapped scratch directory.

**Section 5 carries ZERO `[STALE]` rows, and that is the falsifying probe for yesterday's discharge
passing.** [MEASURED] section 5 is **244** non-blank lines, every one tagged `[FILE]`; a filter for
`[STALE]` over those lines returned **0**. The 21:1xZ run on 09-10 discharged **eleven** dead
PR-scoped escalations into `needs-marco/discharged/` and its own station doc names the check —
*"re-run the sweep and read section 5; if a name you moved is still tagged, the move did not take"*.
**It took.** No new `[STALE]` row appeared either.

**The trunk is GREEN and the sweep's `TRUNK IS RED` headline is the known derived-verdict defect.**
[MEASURED] the sweep printed `main CI on e6e11370: 4 success / 2 failed  <-- TRUNK IS RED`. Re-derived
from its own source per DOCTRINE section 9.5's *"before you ACT on a `[LIVE]` line, re-derive it"*:
`gh run list -R <owner>/<repo> --commit <full 40-char sha> --json conclusion,workflowName,event`,
exit 0 → **9** runs. Both failures are **`Dependabot Updates`** (`dynamic`); three `Claude Code`
(`issue_comment`) are `skipped`; and `Deploy` · `CodeQL` · `CI` · `Tendering Browser Smoke` are
**every one `success`**. The fix is `#1852`, open and green, and it is Marco's.

**Station freshness is CLEAN and crosses cleanly against `lastRunAt`.** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`, `structure: 2 checked,
0 malformed`. Against the scheduled-tasks MCP:

| station | newest breadcrumb | `lastRunAt` | reading |
|---|---|---|---|
| 00 | 2026-09-10T23:08Z | 2026-09-11T00:08:47Z | this run — aligned |
| 03 | 2026-09-10T23:10Z | 2026-09-10T23:01:10Z | aligned |
| 04 | 2026-09-10T22:10Z | 2026-09-10T22:09:55Z | aligned |
| 05 | 2026-09-10T14:11Z | 2026-09-10T14:10:55Z | aligned |

Five enabled tasks, the fifth being `weekly-security-audit` (`30 7 * * 1`, last `2026-09-06T21:32:44Z`)
which is not a station. **No station is SILENT and none needs a transcript read.**
⚠️ `check-breadcrumb.mjs`'s `CADENCE` map still reads `2` for `00` against a live cron of `5 * * * *`;
that is the known open defect in `STATION-CAPABILITIES.md` section 6 and is not re-filed.

**Both loose breadcrumbs were ALREADY TRACKED — asking the tracked set stopped a duplicate commit.**
[MEASURED] `git ls-files docs/pr-prompts` → **1127** paths; matched by trailing path segment, both
`00-00-supervisor-…-2308-…` and `00-03-machine-minder-…-2310-…` resolve to **1** tracked path each, at
the ROOT. NEGATIVE control over the same list → **0**. A dev-tree `git status` reads them as loose and
the available move is to commit them, which is the duplicate-basename trap the 2026-09-07 rule in this
station's doc records. They needed **archiving**, not committing.

**RULE 2 probe, pinned to the live tree, with both controls.** [MEASURED] over
`C:\ProjectOperations2\docs\pr-prompts\processed` — never the watcher clone:
**2126** logs; newest `2026-09-11T00:10:48Z`, i.e. **younger than every open PR**, which is the control
that separates the live directory from the clone's dead decoy; POSITIVE `marco.:true` (regex, written
without a quote character) → **629**; NEGATIVE, the minted needle → **0**; NEGATIVE, `PR #999999` over
`pr-*.log` → **0**.

**Lane and verdict for all seven open PRs.**

| PR | files | prompt-log hits | lane | verdict / classification |
|---|---|---|---|---|
| `#1866` | `docs/pr-prompts/pr-scopecards-s0-plan-HOLD.md` | **0** | second lane | `[NO LANE VERDICT — hand-classified]` → `^(tests\|docs)/` MATCH ⇒ **tests-docs, not Marco's** |
| `#1865` | `apps/web/package.json`, `packages/ui/package.json`, `pnpm-lock.yaml` | **0** | second lane (`app/dependabot`) | `[NO LANE VERDICT — hand-classified]` → outside ⇒ **MARCO'S** |
| `#1852` | `scripts/pipeline/status-sweep.ps1` | **0** | second lane | `[NO LANE VERDICT — hand-classified]` → outside ⇒ **MARCO'S** |
| `#1850` | `scripts/pipeline/triage-holds.ps1` | 2 | watcher | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/triage-holds.ps1"}` ⇒ **RULE 2** |
| `#1845` | `scripts/pipeline/status-sweep.ps1` | 2 | watcher | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/status-sweep.ps1"}` ⇒ **RULE 2** |
| `#1832` | `scripts/pipeline/vm-git-guard.sh` | 2 | watcher | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh"}` ⇒ **RULE 2** |
| `#1823` | 5 × `apps/api/**` + `docs/decisions/merge-approvals/1823.md` | 2 | watcher | `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` ⇒ **RULE 2** |

**All seven carry ZERO labels.** Four are watcher-routed `marco:true`; `#1823`'s `do-not-merge` has
been removed by Marco and **that does not clear RULE 2**. **Six of seven are Marco's. Exactly one —
`#1866` — was mine.**

**The second-lane classification for `#1866` and `#1852` is corroborated, not inferred from silence.**
[MEASURED] the live daily clone log was FOUND by name shape then mtime, never constructed (DOCTRINE
section 9.5): of the daily-shaped `*.log` in
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs`, the newest is `2026-09-10.log`, mtime
`2026-09-11T00:14:53Z` — **younger than `#1866`'s `createdAt` `00:05:32Z`**, so the freshness
precondition is satisfied and the read is not `[CANNOT MEASURE]`. Its four `opened PR #` lines name
`#1827` · `#1832` · `#1845` · `#1850` and neither `#1866` nor `#1852`; POSITIVE control `[merge]` →
**8**, NEGATIVE → **0**. Because ABSENT ⇒ `[CANNOT MEASURE]` and never ⇒ second lane, this was crossed
against `.arming-log.txt`, whose newest six arms are `09-08T12:29`, `09-08T23:43`, `09-09T22:24`,
`09-10T00:07`, `09-10T09:12` and `09-10T11:50` — the last four accounted for by `#1827`/`#1832`/
`#1845`/`#1850`. **No arm exists inside either PR's window, so no watcher build could have started.**

**`#1866` was independently reviewed before I merged it.** [MEASURED] `rev-1866` completed during
this run (2 entries in `processed/`, **0** in `failed/`); its log reads `Exit: 0` and
`Verdict: **MERGE**`; the verdict file exists in the clone at
`docs/pr-reviews/pr-1866-review.md`, first line `VERDICT: MERGE`, and is absent from the dev tree and
from `verdicts-archive` — all three homes checked. Its risk section reads *"None identified."*

**The merge, through the sanctioned primitives only.** [MEASURED] `. .\scripts\pipeline\pipeline-lib.ps1`,
then `Assert-SmokedOrEscalate -PR 1866` → `True` (NEVER-MERGE list, checks green from GitHub), then
`Merge-Pr -PR 1866` → `True`. **Read back from GitHub, not from the primitive's return value:**
`gh pr view 1866 --json number,state,mergedAt,mergeCommit` → `state=MERGED`,
`mergedAt=2026-09-11T00:16:33Z`, `sha=f134efe687bcb158404322ff3903637feff8f755`. Then read back that
it reached `main`: after `git fetch origin +refs/heads/main:refs/remotes/origin/main`,
`git rev-parse --short origin/main` → **`f134efe6`**, and
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` contains `pr-scopecards-s0-plan-HOLD.md`
(**1** match). No hand-merge, no `gh pr merge`, nothing in the watcher repo.

**Board-busy gate, measured before the merge and again after.** dev-tree `index.lock` **False**, clone
`index.lock` **False**, `git` processes **0**, no PR touched on GitHub in the last 2 minutes, and the
watcher's only build in flight was `rev-1866`, which had **completed** before the merge was issued
(`failed/rev-1866*` → 0). Armed `*-ready.md` at depth 1: **0** at the time of merging (POSITIVE
control that the glob works: **40** `*-HOLD.md` at the same level).

**Watcher liveness — not re-derived, taken from the sweep's `[LIVE]` process read.** node pid **18228**
running, auto-restart wrapper alive (1), heartbeat age **0 min**. `restart-watcher-if-wedged.ps1` was
NOT run and no WEDGED/DOWN verdict is claimed: nothing in this run's signals suggested one, and 03
measured the full chain 70 minutes earlier.

**The keepalive escalation exists nowhere Marco can see it.** [MEASURED] `Select-String` over
`docs/pr-prompts/needs-marco/*.md` for `Keepalive` → **0** files; for `logon` → **0** files. POSITIVE
control, `Marco` over the same 48 files → **198** hits. NEGATIVE control → **0**. See F1.

**`verdictApproves` has exactly one call site.** [MEASURED] `Select-String` over
`scripts/pr-watcher/index.mjs` → **1** functional reference, inside `waitForPolicyMerge` at the anchor
`if (!mergeEnabled && allGreen && (await verdictApproves(`; the other four hits are its own
declaration and three comments. POSITIVE control `classifyPolicyFiles` → **2**; NEGATIVE → **0**.
See F2.

**Queue and escalation census.** [MEASURED] `-HOLD.md` at depth 1: **40**; armed after the merge: **0**;
`needs-marco/` **48** (now 50 — see WHAT CHANGED); `no-pr-opened/` **109**; `failed/` **45**;
`blocked/` **132**.

## WHAT CHANGED

1. **`#1866` MERGED** — `f134efe6` on `origin/main` at `00:16:33Z`, via `Assert-SmokedOrEscalate` →
   `Merge-Pr`, read back from GitHub and confirmed present in `origin/main`'s tree. Second lane,
   hand-classified tests-docs, independently reviewed `VERDICT: MERGE`, zero labels, no watcher
   verdict to override.
2. **`DOCTRINE.md` section 10.3 gained one bullet** (`REV_LANE_UNCONSUMED_ON_SECOND_LANE_V1`), in this
   PR. Edited in node by **concatenation**, never `String.replace` with a replacement string
   (DOCTRINE section 9.3's `$`-injection trap), and the **byte delta was asserted**: before
   **168,701** → after **172,801**, delta **4,100**, expected **4,100** — exact, so nothing spilled.
   Anchor uniqueness checked before splicing (**1** occurrence) and the new marker appears **once**.
   The edit is OUTSIDE the `instruments v2` canonical block, so it costs one document and no
   re-recording.
3. **Two new `needs-marco/` files written** (in the dev tree, where the sweep reads them —
   the folder is gitignored, so they reach nobody through this PR and are named here instead):
   `watcher-keepalive-is-gated-on-an-interactive-logon-2026-09-11.md` and
   `rev-lane-reviews-second-lane-prs-that-nothing-reads-2026-09-11.md`.
4. **Two collected breadcrumbs archived** — `git mv` to `docs/pr-prompts/archive/` in this PR, every
   finding in both now carrying a disposition.
5. **Nothing was armed.** See WHAT I DID NOT DO for why that is a decision and not an omission.

## FINDINGS

### F1 — Station 03 marked the keepalive defect ESCALATED on two consecutive runs, and it reached nobody, because its subject is outside the repo and no file existed in the one queue Marco reads. ACTIONED.

The defect itself is 03's and is not re-derived here: `PO Watcher Keepalive` has an `Interactive`
principal and no boot trigger, so after an unattended restart nothing can relaunch the watcher until a
human signs in. It cost **8 h 26 m 54 s** of absent watcher on 2026-09-09. On 2026-09-10 the same
configuration cost **68 s** — purely because a logon happened to arrive 59 seconds after boot.

**What is new, and it is mine:** [MEASURED] `Keepalive` → **0** files and `logon` → **0** files across
all 48 `needs-marco/*.md`, against a POSITIVE control of **198** `Marco` hits and a NEGATIVE control
of 0. 03 is report-only; a breadcrumb is collected and archived; and the subject is a Windows
Scheduled Task, which no PR, prompt or station lane can touch. **"ESCALATED" in a breadcrumb, for a
subject outside the repo, is escalated to nobody** — the standing rule, reproduced live, twice, on a
defect that has already caused a measured multi-hour outage.

**DISPOSITION: ACTIONED.** Written to
`docs/pr-prompts/needs-marco/watcher-keepalive-is-gated-on-an-interactive-logon-2026-09-11.md`,
carrying 03's measurements, the two-reboot comparison, RULE 1 options with (a) first, the two things
only Marco can settle (the stored password, and whether the launcher chain needs an interactive
desktop), and a falsifying probe. **Verified:** the file is on disk and the same `Keepalive` search now
returns it. ⚠️ `needs-marco/` is gitignored, so this PR does not carry it — which is exactly why it is
named here.

### F2 — The two review jobs that wrote no verdict were reviewing PRs the WATCHER NEVER OPENED, so no merge gate was bypassed. The gate is intact; the `rev-` lane is doing work nobody reads. ACTIONED.

Station 03 dispatched this as a question it could not answer: *does anything gate a `tests-docs` merge
on a verdict file that these two runs never produced?*

**Answered from the source.** `verdictApproves` has **one** call site, inside `waitForPolicyMerge`,
which runs only for a PR the watcher opened. Both PRs 03 named return **0** prompt-log hits
(`processed/pr-*.log`, excluding `rev-*`) against POSITIVE controls of **2** hits each on the four
watcher-opened PRs and a NEGATIVE control of 0 — **both were second lane.** `waitForPolicyMerge` never
ran for either, `verdictApproves` was never called, and nothing was bypassed.

**So 03's second disjunct is the true one, and it is live this minute:** `#1866` had a full review
written at `00:1xZ` — `VERDICT: MERGE`, into the clone — that no code path would ever have read. Of
the seven PRs open at the start of this run, **three** were second lane. The residual cost is real:
each such review occupies the **single** review lane, whose occupancy is the named cause in the open
`tests-docs-lane-starves-its-own-review-job-2026-09-04.md`.

⚠️ **Why it earns a DOCTRINE bullet rather than a note:** the observable is byte-identical between the
two cases — `rev-<N>` in `failed/`, exit 0, no verdict in any of the three homes — and the two readings
prescribe **opposite** actions. On a watcher-opened PR it is a live RULE-2-affecting defect and the PR
is stuck; on a second-lane PR it is a review nobody commissioned and the PR is unaffected. A run
meeting the signature with only the existing section 10.3 to hand reaches for the merge gate.

**DISPOSITION: ACTIONED.** Landed in `DOCTRINE.md` section 10.3 in this PR with the measurement table,
both controls and a falsifying probe. The part that is NOT mine — whether the review lane should skip
second-lane PRs, which turns on whether Marco reads those verdicts — is escalated separately as
`needs-marco/rev-lane-reviews-second-lane-prs-that-nothing-reads-2026-09-11.md` rather than decided
here.

### F3 — Six of the seven open PRs are Marco's, and every arm available today would make that seven. DEFERRED.

[MEASURED] four are watcher-routed `marco:true`; `#1852` and `#1865` are second-lane and
hand-classify outside `tests|docs`. Only `#1866` was mine, and it is merged. There are **40**
`-HOLD.md` prompts at depth 1 and **0** armed.

Arming is available and it is deliberately not exercised. The throughput constraint is not the queue
— 00 can arm, the watcher can build, CI can green — it is that **every prompt touching anything
outside `tests/` or `docs/` stops at Marco**, and six of his are already waiting, two of them
(`#1845`, `#1852`) repairs to the very sweep this station runs every hour. Arming a seventh lengthens
his queue without shortening anything.

**DISPOSITION: DEFERRED.** It becomes urgent the moment Marco's board drains below roughly two PRs, or
the moment a gate-satisfied HOLD is found whose `scope:` is confined to `tests/` or `docs/` — that one
can merge without him and should be armed immediately. ⚠️ Checking for that class costs a
`classifyPolicyFiles` pass over all 40 with the CRLF-explicit front-matter parser (DOCTRINE section
9.3 — the `\s*\n` form returns null on every prompt in this queue and scores them all `scope=0`), and
that was not run this cycle.

### F4 — Station 03's F5: the sweep calls an OPEN PR's checked-out worktree an "aborted run leftover — investigate/prune". DEFERRED, with the reason it is not staged now.

[MEASURED] this run reproduced it: section 2 printed
`orphaned worktree (aborted run leftover -- investigate/prune): C:/po-worktrees/pr1823  9664f95a
[feat/ea-gate-reporting-team-permission]`, `dirty=0  age=1559 min`, while `#1823` is **OPEN and CLEAN**
on that exact head branch. The classifier reaches "orphaned" from **age alone** and never asks whether
the branch is on the board. Same family as the `dirty=` and `TRUNK IS RED` rows: a fresh `[LIVE]` line
that is wrongly derived.

03 correctly declined to stage a third `status-sweep.ps1` prompt and handed the decision here.
**The decision is: not now.** `#1845` and `#1852` are both open, both green, both Marco's, and **both
modify `scripts/pipeline/status-sweep.ps1` — the same single file.** A third prompt against it would
be a guaranteed three-way conflict on a file whose two pending repairs already cannot merge without
Marco. DOCTRINE section 10.6 is explicit that staging in parallel is how duplicates get built.

**DISPOSITION: DEFERRED.** The trigger is named: **stage it the moment `#1845` and `#1852` are both on
`main`.** The fix itself is settled and complete-and-additive — before classifying a non-main worktree
as orphaned, cross its branch against `gh pr list --state open --json headRefName` and label a match
`live — open PR #N`; it removes the false label permanently, cannot hide a genuine orphan, and adds no
new instrument since the sweep already calls `gh` in section 1. Blast radius today is zero: the
worktree is clean and its branch is pushed.

### F5 — Station 03's F3: the watcher clone is 12 commits behind `origin/main` and none of them touch `scripts/pr-watcher/**`. DEFERRED, agreed, and the discriminator is recorded.

[MEASURED] by 03: clone HEAD `e4ecd9a5`, 12 commits and 10 h 42 m behind; `git diff --name-only
e4ecd9a5..origin/main` → 178 files, `docs=177` / `sot=1`; the same query scoped
`-- scripts/pr-watcher` → **0**. The running watcher's code is current and the clone re-fetches at
launch, so it self-corrects on the next restart.

I am recording 03's negative deliberately, because it is the useful half: *"clone 12 behind"* read
alone is a plausible case for a restart, and restarting a healthy watcher to adopt 177 docs commits is
pure downside.

**DISPOSITION: DEFERRED.** The discriminator that would make a restart a real proposal is
`git diff --name-only <cloneHEAD>..origin/main -- scripts/pr-watcher`, and a non-zero answer there is
the trigger. ⚠️ This run merged `#1866`, a `docs/` PR, so the drift grew and the discriminator is
unchanged at **0**.

### F6 — The device-bridge git guard could not be installed, for the third consecutive station run, because the Linux workspace would not start. DEFERRED.

Recorded explicitly rather than left silent, because the PREFLIGHT block asks every station to quote
the installer's last line pass or fail, and there is no last line to quote. The script is present in
the repo; this is an environment failure.

**Exposure this run was zero** — with the bridge down no VM-side `git` call was possible, every `git`
was PowerShell on the host, and both `index.lock` probes read False at the end. It is not a STOP, per
the PREFLIGHT block's own instruction, and a guard I could not install is never a licence to run `git`
against the mount.

**DISPOSITION: DEFERRED.** It matters on the next run where the bridge IS up and the guard is skipped
for a different reason. `#1832` — a `vm-git-guard` self-test repair — is open and green and is Marco's,
so the guard is already under active repair by another lane and a second prompt would duplicate it.
⚠️ The open escalation `cowork-vm-mount-unreachable-two-stations-2026-09-10.md` already covers the
mount itself; this is a third occurrence of it and is not re-filed.

### F7 — `C:/po-vg` still holds the only copy of one unpushed file, now 6.7 days old. DEFERRED.

[MEASURED] this run's sweep: `C:/po-vg  23c91ba9 [fix/no-rebase-while-checks-run]`, `dirty=1 files`,
`age=9617 min`. 03 measured the file as `?? scripts/pipeline/check-pipeline-heartbeat.mjs` and the
branch as absent from the remote (POSITIVE control: `main` resolves).

**DISPOSITION: DEFERRED.** Already escalated as
`po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`, still true, nothing new. Pruning
would discard the only copy — `git worktree remove` refuses on a dirty tree and `--force` destroys it.
It becomes URGENT if anyone proposes a worktree cleanup pass.

## WHAT I DID NOT DO

- **Did not merge any of the six PRs that are Marco's.** Four carry live watcher `marco:true` verdicts
  quoted verbatim above; `#1852` and `#1865` hand-classify outside `tests|docs`. **`#1823` carries no
  label because Marco removed it, and removing `do-not-merge` does not clear RULE 2.**
- **Did not remove or add a label on any PR.** Only Marco removes `do-not-merge`.
- **Did not arm anything** (F3). 40 HOLDs available, 0 armed, and every arm on this board today lands
  on Marco's already-congested queue.
- **Did not run `classifyPolicyFiles` over the 40 HOLDs** to look for a `tests`/`docs`-only candidate.
  Named in F3 as the thing that would change the arming answer, with the CRLF parser caveat, rather
  than left as a silent gap.
- **Did not stage a third `status-sweep.ps1` prompt** alongside `#1845` and `#1852` (F4), and did not
  stage a second `vm-git-guard` prompt alongside `#1832` (F6).
- **Did not run `restart-watcher-if-wedged.ps1`, and claim no WEDGED/DOWN verdict.** The watcher node,
  wrapper and heartbeat all read healthy in the sweep's `[LIVE]` process section and 03 measured the
  full chain 70 minutes earlier. An unverified watcher would have been reported as unverified.
- **Did not touch the `PO Watcher Keepalive` scheduled task** (F1). That layer is Marco's and option
  (a) turns on a credential decision.
- **Did not `git` the watcher clone beyond reads.** Every clone command was `Test-Path`, a file copy,
  or a read of its logs; the daily log was copied before reading because the live file is held open.
- **Did not commit a second copy of either loose breadcrumb.** Both were already tracked at the root;
  asking `git ls-files` by basename before committing is what caught it.
- **Did not edit `/sot/`, touch Azure / Entra / SharePoint, write production data, commit on `main`,
  or hand-merge anything.**
- **This breadcrumb was written INSIDE this run's PR worktree**, which is the preferred home in the
  REPORT CONTRACT, so no untracked copy is left in the dev tree to block the next fast-forward.
