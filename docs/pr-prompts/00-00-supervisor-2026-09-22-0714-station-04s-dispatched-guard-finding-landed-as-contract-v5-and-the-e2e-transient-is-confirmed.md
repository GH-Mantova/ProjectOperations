# Station 00 — Supervisor | 2026-09-22T07:14:15Z–2026-09-22T08:0xZ

## GROUND

```
UTC            2026-09-22T07:14:15Z
origin/main    125f5c5c            (git fetch origin +refs/heads/main:..., then git rev-parse)
dev tree       main @ 125f5c5c     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE**, so this run was not read-only.

**Which tree I read the binding documents in.** PREFLIGHT step 2 requires `git show
origin/main:<path>`. I read the working copy in `C:\ProjectOperations2` having first proved it is
the same bytes: `HEAD == origin/main == 125f5c5c`, `git rev-list --left-right --count
HEAD...origin/main` → `0	0`, and `git diff --numstat origin/main --
docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, which §9.3 names as the sound comparison (no
pipe, no length comparison, no `hash-object` across the boundary). All three were read **in full**
— 1538, 2722 and 571 lines.

## WHAT I MEASURED

**Reachability — SIGHTED.** [MEASURED] Desktop Commander loaded by keyword `ToolSearch` for
`desktop-commander` (never by hard-coded ids), then `start_process` shell `powershell.exe` → PID
9788, which carried the whole run from `C:\ProjectOperations2`. Not a blind run.

**vm-git-guard — exit 2, `INSTALLED BUT INERT`, and my FIRST reading of its exit code was wrong.**
[MEASURED] 2026-09-22T07:3xZ, `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`.
Last line, quoted as PREFLIGHT requires:

```
   PATH="/sessions/<id>/.local/bin:$PATH" git <args>
```

under the headline `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from
your shell.` **Exit 2.** Controls in the same call: `bash -lc 'command -v git'` →
`<session>/.local/bin/git`; `bash -c 'command -v git'` → `/usr/bin/git`.

🔴 **My first call read the exit code as `0`, and it was an instrument error of exactly the §7
shape.** I ran the installer piped into `tail -5` and then echoed `$?` — which is `tail`'s status,
not the installer's. The true exit is **2**. ⚠️ **The 06:14Z run recorded `exit 0` for the same
guard on the same box one hour earlier**, while Station 04 recorded **exit 2** at 06:16Z; the two
tracked reports disagree, and this is the mechanism that explains the disagreement in 00's
direction. **I re-ran the installer with its status captured directly before writing anything
above.** This is F1's item (d) and it is now in the contract.

**Sweep — SAFE TO ACT.** [MEASURED] `status-sweep.ps1` captured with `*>` and decoded `utf16le` in
node (§9.3 — the raw capture is **152,322 B opening `FF FE`**, 435 lines; read as UTF-8 it is
structureless). Section 0 controls both pass, **no `[BROKEN]`**. Section 3: `index.lock`
interactive/clone **False / False**, scoped git processes **0**, `no PR touched on GitHub in the
last 2 min`. Section 7: **`SAFE TO ACT`**. Section 4: `armed (*-ready.md): 0`. No lock existed, so
there was no stale-lock age/size call to make. **Re-measured immediately before mutating** (§7's
`[LIVE]` rule): `index.lock` False/False, `git.exe` processes **0**, dev-tree index `--cached`
EMPTY, armed **0**.

**`[STALE]` escalation rows — NONE to clear.** [MEASURED] exactly **one** `[STALE]` line in the
whole report and it is not PR-scoped (*"no station summary younger than 3 days"*). The eleven
PR-scoped discharge rows my station doc was written for are absent. The rest of section 5 is
`[FILE]` lines of the *"cites #N (MERGED) as evidence — not its premise"* shape, which the sweep
itself says decide nothing. **Nothing discharged, correctly.**

**Watcher — HEALTHY; idle is correct.** [MEASURED] node RUNNING pid 9744, auto-restart wrapper
alive (1), heartbeat 33 min, armed **0**. An idle watcher with an empty queue is the correct state,
not wedged. I did not run `-Fix`; no verdict licensed it.

**Freshness, crossed against `lastRunAt`.** [MEASURED] `check-breadcrumb.mjs --freshness` →
`CLEAN`, exit **0**, `structure: 2 checked, 0 malformed`.

| station | newest breadcrumb | `lastRunAt` (MCP) | reading |
|---|---|---|---|
| 00 | 2026-09-22T06:14Z | 2026-09-22T07:14:15Z | this run; aligned |
| 03 | 2026-09-21T23:04Z | 2026-09-21T23:02:53Z | aligned; cron `0 9 * * *`, `nextRunAt` 23:02Z, not due |
| 04 | 2026-09-22T06:10Z | 2026-09-22T06:09:53Z | aligned; `nextRunAt` 10:09Z, not due |
| 05 | 2026-09-21T14:11Z | 2026-09-21T14:10:40Z | aligned; `nextRunAt` 14:22Z, not due |

**No station is SILENT and none needed a transcript read.** ⚠️ The known weakness stands and I am
not quoting `ok` as if it were strong: `check-breadcrumb.mjs`'s `CADENCE` map still records `00` as
**2** against a live cron of `5 * * * *`, so `ok` for my own row tolerates three consecutive missed
hourly runs. The `lastRunAt` cross-check above is what actually settles it, and it is aligned.

**The answer sheet.**

- **Q1 — every open PR and its `mergeStateStatus`.** [MEASURED] `gh pr list -R
  GH-Mantova/ProjectOperations --state open --limit 100 --json
  number,title,mergeStateStatus,isDraft,labels,headRefName` (exit 0): **exactly one**, `#2071`
  `feat(tendering): scopecards S6 - one cutting surface, mock-up column set
  (CUTTING_ONE_SURFACE_V1)`, head `feat/scopecards-s6-one-cutting-surface`, `BLOCKED`, carrying
  **`do-not-merge`** (*"escalates:true - Marco merges this, not automation (DOCTRINE 5b)"*).
  **DIRTY: zero.** No PR on this board has frozen CI, so nothing is blocked on a conflict.
- **Q2 — conflicts.** None exist. Nothing to fix and nothing to escalate.
- **Q3 — armed prompts, counted myself.** [MEASURED] `Get-ChildItem docs\pr-prompts -Filter
  *-ready.md -File`, counted with a null guard (§9.4's `@($null).Count` trap) → **0**. No LOOP is
  possible with nothing armed; no prompt was renamed.
- **Q4 — every claim re-verified.** The two root breadcrumbs were re-read from disk this run, and
  Station 04's dispatched finding was re-measured against `origin/main` rather than believed from
  its report (see F1). The sweep's `[LIVE]` trunk line was cross-checked: `main CI on 125f5c5c: 4
  success / 0 failed (trunk green)`.
- **Q5 — silent no-ops.** `no-pr-opened/` newest entry is still **2026-09-02T03:47Z**, twenty days
  old. Nothing new: nothing was armed this cycle, so no prompt could run and produce nothing.
- **Q6 — the single most important thing blocking progress.** **Nothing on the board is blocked.**
  `#2071` is parked on Marco by design and is now green apart from its label (F2); the queue is
  empty. The binding constraint was the finding Station 04 dispatched to me four hours ago, which
  is what I spent the run on.

**`#2071` — the transient reading is CONFIRMED, closing my predecessor's named trigger.** The
06:14Z run re-ran the e2e job and explicitly refused to claim it went green, leaving the probe for
me: *"read `gh run view 35690967578 --json conclusion`. `success` ⇒ transient, confirmed."*
[MEASURED] `gh run view 35690967578 -R GH-Mantova/ProjectOperations --json
conclusion,status,headSha,workflowName`, exit 0:

```
{"conclusion":"success","headSha":"643609e14512ac80f1e21af33be49afb13ebdc98",
 "status":"completed","workflowName":"Tendering Browser Smoke"}
```

**`batch4-tender-documents.spec.ts` passed on re-run, on the same head that failed.** [MEASURED]
`gh pr checks 2071` now reports exactly **two** failures and they are the **one** `do-not-merge`
cause rendered twice (§9.4): `Approval receipt (CP-26)` and `PR gates — diff checks`. **There is no
agent-side action behind `[LABEL_PRESENT]`** — only Marco removes the label. So `#2071` is waiting
on nothing but Marco, and the second re-run §5.6 would have forbidden was never needed.

**Negative control minted this run:** `zqSup00Needle20260922T0730` → `git grep` exit **1** (no
match) across `docs/pipeline/stations/`. It is now written down and is spent.

## WHAT CHANGED

All work happened in an **isolated worktree off `origin/main`** — `C:\po-wt\contract-v5` on branch
`collect/00-20260922-0730` — never the shared dev tree, never `C:\po-watcher`. The dev tree's index
was verified clean (`git diff --cached --name-status` EMPTY) before the worktree was created.

1. **`station-contract` canonical block v4 → v5, in all seven station docs plus
   `_canonical-blocks.json`** — the guard bullet, F1 below.
   - **Byte-delta assertion (§9.3):** each of the seven files moved by exactly **+1990 bytes**,
     equal to `NEW − OLD` computed on the file's own CRLF form. The replacement was passed as a
     **function**, never a string, so `$&` / `` $` `` substitution was disabled.
   - **Read-back 1:** `node scripts/pipeline/lint-station.mjs` → exit **0**, `ADMIT: all 8 docs
     clean`.
   - **Read-back 2, independent of the linter:** my own re-extraction and SHA-256 of the block in
     each of the seven gives `v5 81ddf31ac807132b`, `blockBytes=16870`, **DISTINCT_SHAS=1** — and
     that value matches the sha `--write-canonical` recorded, derived two different ways.
   - **`instruments` sha is UNCHANGED at `10ec46a02e70a2b3`** — DOCTRINE was not touched.
   - **The first attempt failed safe and wrote nothing.** The anchor matched **0** times in all
     seven, because the station docs are stored **CRLF** and my anchor was LF. The uniqueness guard
     aborted before any write; the fix was to match on the file's own line ending rather than on a
     normalised copy (which would have rewritten every line ending in the file).
   - `contract_version:` in each doc's front matter bumped `4` → `5`, delta **0** bytes each. The
     linter had emitted `NOTE canonical station-contract is v5; these declare a different
     contract_version:` and this clears it.
2. **`00-supervisor.md` — one row added to the `lastRunAt` cross-check table** (F3 below, my
   predecessor's deferred F5). Byte delta **+503**, equal to intent. Outside the canonical block,
   so it does not touch the seven-file hash.
3. **`pr-preflight-guard-claim-outlives-its-own-fix-HOLD.md` → `docs/pr-prompts/superseded/`**, by
   `git mv`, exit 0 — step 3 of that prompt's own instructions, now that the work it describes has
   landed by the other route.
4. **Two fully-dispositioned breadcrumbs archived** — `git mv` into `docs/pr-prompts/archive/`,
   exit 0 both. Root `00-*.md` after the move is **0**, plus this report.
5. This breadcrumb, written **inside the PR worktree** (Cure 1 — the rule v4 itself put in the
   contract), so no untracked copy exists in the dev tree to block the next fast-forward.

**Nothing else was mutated.** No prompt armed, disarmed or renamed. **No merge.** No label touched.
No watcher restart. No `sot/` edit. Nothing committed on `main` in the dev tree.

## FINDINGS

### F1 — Station 04's dispatched finding was live four hours after it was filed: the PREFLIGHT block still promised a mechanical git ban that its own fix reports as inert. Landed as contract v5. `PREFLIGHT_GUARD_THREE_OUTCOMES_V1`

**The dispatch, and why it survived a collect run.** Station 04's 06:10Z breadcrumb filed F1
`PREFLIGHT_GUARD_CLAIM_OUTLIVED_ITS_OWN_FIX_V1` and **DISPATCHED it to Station 00**, staging the
fix as `pr-preflight-guard-claim-outlives-its-own-fix-HOLD.md`. The 06:14Z collect run shipped
contract **v4** twenty-one minutes later carrying three *different* changes, and `#2074` swept 04's
breadcrumb and staged prompt into the repo at 06:41Z — so the hand-off was committed but **not
dispositioned**, and the defect rode through a canonical-block ship that could have carried it.

**I re-measured the premise rather than believing the report** (§7.1's re-read rule). [MEASURED] at
`125f5c5c`: `git grep -c "persists itself onto" origin/main -- docs/pipeline/stations/` returns
**1 in each of the seven** station docs. NEGATIVE control, a needle minted this run → exit 1, no
match. **The claim was still there in v4, and v4 is what every station read this morning.**

**Four separable defects in one sentence-pair, each failing toward action rather than caution:**

- **(a) The claim is true only of a login shell.** *"It persists itself onto `PATH`"* — a station's
  shell is non-interactive and non-login, sources neither `~/.bashrc` nor `~/.profile`, and
  resolves `/usr/bin/git`. The block's very next sentence — *"Without it … it freezes every
  station"* — is what makes believing it expensive.
- **(b) The vocabulary had no bucket for what the guard now says.** The block knew
  install-passed and *"a failed install"*. Exit 2 is neither: the install **succeeded**, the shim is
  byte-correct, and the guard's own headline says `INSTALLED`. A station matching the block's words
  against the tool's output reached **no verdict at all** — §7's shape, a well-formed reading with
  nowhere to go.
- **(c) The one-call cure the guard prints was absent from the block.**
  `PATH="…/.local/bin:$PATH" git <args>` is the only protection available inside a station's own
  shell, and a station had to read it out of stderr rather than out of its binding instructions.
- **(d) NEW THIS RUN, and not in 04's report: the prescribed quoting habit hides the exit code.**
  PREFLIGHT says *"quote the installer's last line"*, and the natural way to get a last line is a
  pipe — which makes `$?` / `$LASTEXITCODE` the status of `tail` or `Select-Object`, not of the
  installer. **I made this error myself on my first call and read `exit 0`.** The 06:14Z run
  recorded `exit 0` and Station 04 recorded `exit 2` for the same guard on the same box six minutes
  apart; this is the mechanism that accounts for the disagreement, and it runs in the direction of
  reporting a protection as working.

**RULE 1 applied.** The complete-and-additive option — and the one taken — is **state all three
outcomes, name exit 2 as the EXPECTED one for a station, carry the one-call cure verbatim, and
require the exit code to be read from the installer rather than from a pipeline**. It fixes the
present reading; it describes **states rather than a promise**, so it cannot rot the next time the
guard's behaviour changes; and it removes nothing — the ban itself, the rule never to run `git`
against a mount, and *"a guard you could not install is never a licence"* are all preserved and the
last is widened to cover an INERT one. The alternatives both fail the future half: *delete the
clause and say no more* fixes (a) and leaves (b), (c) and (d), so the next run meeting exit 2 still
has no instruction; *change nothing* is the failure §9.5 records for a claim that outlives its own
truth in a document every station is told it can trust.

**Why hand-landed rather than armed.** My station doc says to prefer arming a docs change, and
names the exception: *"Hand-land when the content must be exact — binding law, a canonical block, a
correction to DOCTRINE itself."* This is a canonical block, byte-identical across seven files and
hash-gated; a botched edit breaks `lint-station.mjs` for every station doc at once. 04's prompt
also describes the block as **v3**, which was already two versions stale by the time it could have
run. The prompt has been `git mv`'d to `superseded/` per its own step 3.

**DISPOSITION: ACTIONED** — v5 in this run's PR. Verified by `lint-station.mjs` exit **0**, by an
independent per-document re-extraction and re-hash (`DISTINCT_SHAS=1`, `81ddf31ac807132b`, matching
the recorded sha by a second derivation), and by a byte-delta assertion (+1990) on every file.
⚠️ **Falsifying probe:** `git grep -c "persists itself onto" origin/main --
docs/pipeline/stations/` must return **0 files** once this merges, and `grep -c "INSTALLED BUT
INERT"` must return 1 per station doc. If either disagrees, the ship did not land byte-identically
and v5 must be re-recorded.

### F2 — `#2071`'s e2e red was transient, confirmed, and the PR is now waiting on nothing but Marco

My predecessor diagnosed the red as a spec the diff cannot reach, dispatched one re-run, and
correctly refused to claim it went green while it was still `in_progress` — leaving both readings
named for this run. [MEASURED] `conclusion: success` on head `643609e1`. **`gh pr checks 2071` now
shows exactly two failures, and they are one cause rendered twice** (§9.4): CP-26
`[LABEL_PRESENT]`, i.e. the `do-not-merge` label, as the required check and again as a step inside
`PR gates — diff checks`.

**There is no agent-side action behind `[LABEL_PRESENT]`.** Only Marco removes the label; §5.6's
two-attempt limit was never reached because the first attempt settled it.

**DISPOSITION: ACTIONED** — the trigger my predecessor left is discharged with the measurement it
asked for, and the refuted branch (check `batch4` on `main`, treat `643609e1` as having broken a
spec it does not touch) is **not** taken, because the re-run passed on that exact head.

### F3 — the `lastRunAt` cross-check table had no row for "still running", and 00 meets a live 04 by construction on every one of 04's occurrences

Carried from the 06:14Z run's F5, which DEFERRED it with the trigger *"the next collect run should
land it, and it is one table row."* This is that run.

The table in my own station doc reads `lastRunAt` fresh + no breadcrumb as *"it started and died,
or ran and did not report"* — a defect in both readings. But 00 runs `5 * * * *` and 04 runs
`0 */4 * * *`, and `STATION-CAPABILITIES.md` §6 already records that these land within ten minutes
of each other on **every one of 04's six daily occurrences**. So a sixth of my runs meet a live 04,
and the prescribed reading of that row is wrong every time. The 06:14Z run hit it and was saved
only by checking `list_sessions` on its own initiative.

**DISPOSITION: ACTIONED** — the row is split in two in `00-supervisor.md`: *fresh, no breadcrumb,
**session still running*** ⇒ mid-run, not a defect; *fresh, no breadcrumb, session **not** running*
⇒ the original reading, unchanged. The new row says in-line that `list_sessions`' state field is
**not a lock** (§9.5) and must not be used as one — it is the `lastRunAt` and the running session
**together** that settle the row. Byte delta **+503**, equal to intent; `lint-station.mjs` exit 0
afterwards.

### F4 — `C:/po-wt/s6fix` is still orphaned, now 232 minutes old, and the authority to prune it is still unowned

[MEASURED] from this run's sweep: `orphaned worktree (aborted run leftover): C:/po-wt/s6fix
5b6ab08c (detached HEAD), dirty=0 files, age=232 min`. `dirty=0` means **no work can be lost**. It
sits at `5b6ab08c`, which is the head whose `Tendering Browser Smoke` went green at 04:43Z — a
leftover from the second lane's work on `#2071`.

**DISPOSITION: DEFERRED**, on the same reason the 06:14Z run gave and which I re-verified rather
than repeated: **`#2071` is still OPEN** ([MEASURED] this run), so the worktree may still be in use
by the lane that created it, and pruning a worktree at an open PR's head while a second lane pushes
to that branch is the LL-38 shape. ⚠️ **What makes it urgent:** `#2071` merging or closing. At that
point it is unambiguously dead — and the authority question underneath it (03 is **report-only**
and 00 dispatches machine repair rather than doing it, so **no row in the §5 matrix owns worktree
pruning**) is Marco's to settle, not a station's to assume. This is the third consecutive run to
defer it on a condition outside its control, which is itself the argument for putting the authority
question to Marco rather than re-deferring a fourth time.

### F5 — the device-bridge git ban is still REMEMBERED rather than mechanical

[MEASURED] this run, exit 2, with both controls. Unchanged from the 06:14Z run's F3 in substance;
what changed is that the contract now **says so** rather than promising the opposite (F1).

**DISPOSITION: DEFERRED** — the residual cure is a change to how the VM shell is launched (a login
shell, or the shim installed where a non-login shell reads), which is neither `docs/` nor inside
this station's lane to merge. ⚠️ **What makes it urgent:** the next 0-byte `index.lock` with no
owning Windows process. That freezes every station, and it is the exact outcome the guard exists to
prevent. **The documentation half is now closed**, so a future run meeting exit 2 has an
instruction; only the mechanism is outstanding.

### F6 — COLLECT: both root breadcrumbs are now fully dispositioned and archived

[MEASURED] `check-breadcrumb.mjs` `structure: 2 checked, 0 malformed`, and both files are tracked
on `origin/main` (`git ls-files docs/pr-prompts`, matched by basename — the tracked set, not the
dev tree's `git status`, which cannot see an archived copy). Station 04's single finding is F1
above, **ACTIONED**. My predecessor's six carry dispositions: F1 (v4) and F4 (archive) ACTIONED by
it; F2 ACTIONED here; F5 ACTIONED here as F3; F3 and F6 re-verified and re-DEFERRED here as F5 and
F4 with their conditions re-measured rather than repeated.

**DISPOSITION: ACTIONED** — both `git mv`'d to `docs/pr-prompts/archive/` in this run's PR, root
`00-*.md` after the move **0** plus this report. Freshness is unaffected: `--freshness` builds its
tracked set with `git ls-tree -r` and matches by trailing path segment, so an archived breadcrumb
still counts and no station can be made to read SILENT by the move (§9.5).

## WHAT I DID NOT DO

- **I did not merge anything, and I did not touch `#2071` at all this run.** It carries
  `do-not-merge`; only Marco removes that label and only Marco merges it. I did not remove the
  label, did not enable auto-merge, did not push to its branch, and did not re-run its CI a second
  time — the first re-run passed and §5.6 names two honest attempts as the limit.
- **I did not merge my own PR.** `scripts/`-touching and out-of-lane merges are not mine; this PR
  is `docs/` only and inside 00's recorded lane, but it is opened for the board to take, not
  self-merged in the same breath as the contract edit it carries.
- **I did not arm anything.** `*-ready.md` = 0 before and after. The sweep's section 6 lists
  `rates-11c-blocked-consumers` as READY TO STAGE; I left it — its own note says the consumers are
  *"staged but not yet merged"*, and arming a destructive rates chain is not something to start in
  a run that has just shipped a canonical-block change. The two `UNBLOCKED, BUT NEEDS MARCO` items
  (`model-merge-slices-rehomed`, `map-locations-waste-rate-coupling`) are explicitly
  do-not-auto-stage and I did not touch them.
- **I did not arm 04's staged prompt either** — I superseded it, because the work it describes
  landed by the hand-land route its own subject matter requires (F1).
- **I did not clear any `needs-marco/` escalation.** Exactly one `[STALE]` row existed and it was
  not PR-scoped; discharging on a `[FILE]` line alone is what my station doc forbids.
- **I did not prune `C:/po-wt/s6fix`** — see F4; its PR is still open.
- **I did not restart the watcher.** RUNNING with its wrapper alive, queue empty; idle is correct,
  not wedged, and no verdict licensed `-Fix`.
- **I did not do 03's, 04's or 05's work.** None was due; all three are aligned on `lastRunAt`.
- **I did not run `git` through the device bridge**, guard inert or not. The guard being
  unavailable is never licence to run it. Every `git` and `gh` call in this run went through
  PowerShell on the Windows host.
- **I did not edit `/sot/`** — Station 05's, CP-24. The `instruments` canonical sha is unchanged,
  so **DOCTRINE was not touched** either.
- **I did not touch Azure, Entra or SharePoint**, and wrote no production data.
- **I did not commit in the dev tree or on `main`.** All work is in an isolated worktree off
  `origin/main`; the dev tree's index was EMPTY before and is unchanged.
- **I did not put the worktree-pruning authority gap to Marco this run.** F4 names it as the thing
  that should go to him once `#2071` settles; raising it while the PR is open would ask him to rule
  on a worktree that may still be in use.

---

**Breadcrumb validation.** `node scripts/pipeline/check-breadcrumb.mjs` result is quoted in the PR
body. `lint-prompt.mjs` is not an instrument for a breadcrumb and no verdict from it is quoted here
(REPORT CONTRACT).

**This report is UNTRACKED until this run's PR merges.** It is inside that PR, so no sweep is
needed to pick it up.
