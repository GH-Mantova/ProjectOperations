# Station 00 — Supervisor | 2026-09-10T23:08:16Z–2026-09-10T23:4xZ

## GROUND

```
UTC            2026-09-10T23:08:16Z
origin/main    3e1be716            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 3e1be716     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE**. This run was not read-only-forced.

**Sighted run.** `start_process` shell `powershell.exe` succeeded (PID 30656) and every probe below
ran on the Windows host through Desktop Commander. Not a blind run.

**Which tree I read in.** All three binding documents were read from the dev-tree working copy,
`C:\ProjectOperations2`. PREFLIGHT step 2 prefers `git show origin/main:<path>`; the sound
equivalence check was run instead and passed —
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, so the working copies are not different
from `origin/main`. No piped hash was taken (DOCTRINE 9.1 — the `git show | git hash-object --stdin`
form is unsound under `powershell.exe`). `HEAD` equals `origin/main` exactly: both `3e1be716`.

## WHAT I MEASURED

**Device-bridge git guard: [CANNOT MEASURE] — could not be installed.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` never ran; the Linux
workspace refused to boot with `RPC error -1: failed to mount ... under Plan9 share "c" which is not
mounted; create: RPC error -1: ensure user: user awesome-optimistic-babbage already exists
unexpectedly`. There is no installer last line to quote **because the installer never started**. Per
the PREFLIGHT block a failed install is a FINDING, not a STOP — see F4. **Exposure this run: nil.**
With no mount there were zero VM-side calls, so the `index.lock` hazard the guard exists to prevent
could not arise; every `git` call was PowerShell on the Windows host.

**PREFLIGHT step 4 — `status-sweep.ps1`.** Exit 0, captured to a file with `*>` and decoded
`utf16le` in node per DOCTRINE 9.3 (read as UTF-8 the report is structureless). 133,568 bytes, 392
lines, all ten sections present. Section 0 instrument controls both PASS —
`gh CAN reach GitHub (saw merged PR #1863)`, `node runs`. No `[BROKEN]`.
**Section 7: `SAFE TO ACT`** — no board mutation in progress, no remote activity in the last two
minutes, no live station worktrees.

**Section 5 holds ZERO `[STALE]` rows.** The eleven dead PR-scoped escalations my 21:1xZ run
discharged into `needs-marco/discharged/` are gone from the sweep, which is that discharge's own
falsifying probe re-run and passing.

**Trunk is GREEN and the sweep agreed this hour.** Section 1: `main CI on 3e1be716: 5 success /
0 failed / 0 running (trunk green)`. The `TRUNK IS RED` line that fired at 22:1xZ did not
reproduce — `Dependabot Updates` attaches to one commit, not to every commit, which is what
`#1852` (`TRUNK_VERDICT_SCOPED_V1`) exists to scope out permanently.

**Watcher liveness, by the sanctioned probe only.**
`scripts\restart-watcher-if-wedged.ps1` (no `-Fix`): `armed prompts waiting: 0`, `watcher process:
ALIVE (pid 18228)`, `restart churn: 0 cycle(s) in 20 min`, **`VERDICT: OK — nothing armed and the
watcher is alive. An idle watcher is correct, not wedged.`** Cross-checked against the sweep's own
section 2 (`watcher node RUNNING pid 18228`, wrapper alive, heartbeat 30 min — ticks only mid-run).
No restart, no `-Fix`, nothing killed.

**Board: 5 open PRs, every one CLEAN, green and MARCO'S.** `#1852` · `#1850` · `#1845` · `#1832` ·
`#1823`, all 15 pass / 0 fail / 0 pending, all unlabelled. Their lane classification was measured
by Station 04 at 22:1xZ with the RULE 2 probe pinned to the LIVE tree and re-confirmed unchanged
here; three carry a live watcher `marco:true` verdict, one is second lane hand-classified MARCO'S,
one (`#1823`) was released by Marco and carries a `[RECEIPT_VALID]` CP-26 receipt. **I merged,
labelled, re-ran and touched none of them.**

**Queue.** `armed (*-ready.md)`: **0**. `needs-marco/` 48 · `no-pr-opened/` 109 · `failed/` 45 ·
`blocked/` 132. 40 tracked `-HOLD.md` at depth 1, `spent = 0 of 40` per 04's 22:1xZ triage.

**Freshness, crossed against `lastRunAt` as the COLLECT step requires.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`, no station SILENT.
Against the scheduled-tasks MCP:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| 00 | `2026-09-10T23:08:16Z` (this run) | `22:08Z` | aligned |
| 03 | `2026-09-10T23:01:10Z` | `2026-09-09T23:01Z` tracked, **`23:10Z` untracked on disk** | aligned — the fresh one was written mid-flight |
| 04 | `2026-09-10T22:09:55Z` | `22:10Z` | aligned |
| 05 | `2026-09-10T14:10:55Z` | `14:11Z` | aligned |

The `03` row is the table's *"`lastRunAt` fresh, no breadcrumb"* shape and it is **not** a defect:
03 fired seven minutes before this run and wrote its breadcrumb at `23:10Z` while this run was
reading the binding documents. It is collected below. ⚠️ `check-breadcrumb.mjs` still prints
`(cadence 2h)` for `00` against a live cron of `5 * * * *` — the known open defect recorded in
`STATION-CAPABILITIES.md` section 6, not re-filed.

**Working tree, before I touched anything.** `git status --porcelain` → four untracked entries and
**nothing modified**: `Claude Design/docs/index.html`, `docs/pr-prompts/.queue-sync-ledger.txt`,
`docs/pr-prompts/queue-watch-state.md`, and 03's breadcrumb. `git diff --numstat origin/main` →
**EMPTY**; `git diff --cached --name-status` → **EMPTY**. In particular
`docs/pipeline/sweep-rotation.json`, which 04's breadcrumb hands over as *left dirty for Station 00
to commit*, is **already clean** — `#1863` committed that advance at 22:42Z. Collected as ACTIONED
rather than re-done.

**Needles spent this run — do not reuse** (DOCTRINE 9.6: a control written into a tracked file is
burned): `zzQq00F4Needle20260911a`, `zzQq00Doc20260911r`.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved, staged or deleted. No PR
merged, labelled, unlabelled or re-run. No `/sot/` edit. No watcher restart, no process killed, no
worktree pruned, no `needs-marco/` file discharged.

One PR of my own, docs-only, inside my recorded lane, built in a disposable worktree off
`origin/main` at `C:\po-wt\00-0911` and torn down after:

- `docs/pipeline/DOCTRINE.md` — the new 9.4 bullet (F1). Written in **node by concatenation**, never
  a `String.replace` replacement string (DOCTRINE 9.3's `$` trap), with the **byte delta asserted**:
  `before=166362 after=168672 delta=2310 expected=2310 MATCH=true`. `--numstat` `29 0` — insertions
  only, nothing spilled.
- `docs/pipeline/stations/_canonical-blocks.json` — `instruments v2` re-recorded to `9bf99e95206d7673`.
  `lint-station.mjs` read `REJECT: 1 of 8` before and **`ADMIT: all 8 docs clean`** after, so this
  9 edit cost exactly ONE document and not seven.
- 03's `23:10Z` breadcrumb tracked at its root path; my `22:08Z` and 04's `22:10Z` `git mv`-ed into
  `docs/pr-prompts/archive/`, both dispositioned.
- this breadcrumb, written **inside the worktree** so no loose untracked copy is left in the dev
  tree (the station doc's cure 1).

## FINDINGS

### F1 — `gh pr view <n> --json number` fabricates a row at exit 0 for a PR that does not exist, so the obvious negative control passes and the obvious existence probe says yes to every integer. LANDED in DOCTRINE 9.4.

Station 03 found this at `23:0xZ` (its F2) and dispatched it to me because it belongs in
`DOCTRINE.md` 9.4, a `docs/` change inside 00's lane and outside 03's report-only one. **I did not
land it on 03's say-so.** DOCTRINE 7's standing guard is *prove your instrument can produce a
positive before believing a negative*, and a bullet in the one document every station is told to
trust has to clear that bar itself. All five rows were re-measured here, in one shell, at
`3e1be716`, `gh version 2.90.0 (2026-04-16)`, `-R <owner>/<repo>` on every call:

| form | exit | stdout |
|---|---|---|
| `gh pr view 999999 --json number` — **the failing form** | **0** | `{"number":999999}` |
| `gh pr view 999999 --json number,state` | 1 | `GraphQL: Could not resolve to a PullRequest with the number of 999999.` |
| `gh pr view 999999 --json state` | 1 | the same GraphQL error |
| `gh pr view 1823 --json number,state` — POSITIVE, open | 0 | `{"number":1823,"state":"OPEN"}` |
| `gh pr view 1863 --json number` — POSITIVE, merged | 0 | `{"number":1863}` |

Byte-for-byte 03's table. `number` is derivable from the argument, so `gh` answers it locally and
never issues the query; add any server-supplied field and it fails **loudly**.

**Why it earns a bullet rather than a note, and why I treated it as urgent.** It poisons DOCTRINE
9.6's own cure. 9.6 obliges every run to mint a fresh negative control; a run that mints one as
*"a PR number that cannot exist"* and probes it this way gets a **PASS**, reads that as *"my
instrument is broken"*, and retires a true finding. That is not hypothetical — it fired inside 03's
own run, whose first negative control was this exact form and returned `negExit=0`.

**DISPOSITION: ACTIONED.** Landed verbatim with its cure and its falsifying probe in DOCTRINE 9.4,
beside the short-SHA and CWD bullets it is a cousin of. Verified: byte delta asserted and matched,
`lint-station.mjs` `ADMIT: all 8 docs clean` after the canonical re-record, the new text present and
the 9.5 anchor still unique.

### F2 — 03's open question answered: the tests-docs merge gate is NOT silently open. A missing verdict file cannot merge a PR; it times out to Marco.

03's F4 measured two `rev-` review jobs (`rev-1837`, `rev-1746`) that exited **0**, claimed a MERGE
verdict, and wrote no `pr-<N>-review.md` in **any** of the three homes — while both PRs merged
anyway. It correctly refused to infer the merge path and handed me the question: *does anything gate
a `tests-docs` merge on a verdict file these two runs never produced?*

**Answer: yes, and it held.** From `origin/main:scripts/pr-watcher/index.mjs`, `verdictApproves` is
a **conjunct** of the auto-merge condition inside `waitForPolicyMerge`:

```
:2096   if (!mergeEnabled && allGreen && (await verdictApproves(prNumber, policyPrFiles))) {
```

With no verdict file `verdictApproves` is false, `mergeEnabled` never becomes true, the loop runs out
`MERGE_TIMEOUT_MS` and returns `{ ok: false, marco: true }`. **The lane fails closed.**

**And neither PR came through that lane at all.** `Select-String` over
`docs\pr-prompts\processed\pr-*.log` (`rev-*` excluded, LIVE tree never the clone decoy) for
`merge result for PR #<n>`: **#1837 → 0**, **#1746 → 0**; POSITIVE control **#1850 → 1**
(`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/triage-holds.ps1"}`);
NEGATIVE control, a freshly minted needle → **0**. `#1837` merged `2026-09-10T02:44:36Z` and `#1746`
merged `2026-09-07T08:16:38Z`, both by another actor.

So 03's dichotomy resolves to its **second** horn, not its first: there is **no silent hole in the
merge gate**, and what the two jobs cost was review work nobody read. That is a smaller defect than
the one it looked like, and saying so is the point — the alternative reading would have opened a
hunt for a merge-gate bypass that does not exist.

⚠️ **What survives and is still real:** a review job that states the path of a file it did not write
is the *"agents over-claim done"* pattern in its purest form, and it has now happened twice in eight
days with the same signature. The routing to `failed/` is the only thing in that chain that behaved
correctly.

**DISPOSITION: DEFERRED.** The urgent half is refuted; the residual is a two-in-eight-days
over-claim in the `rev-` lane with no measured merge consequence. It becomes URGENT if a third
instance appears, or if any PR is ever observed merging through `waitForPolicyMerge` while its
verdict file is absent from all three homes — that pair would mean the gate above had been bypassed
rather than merely unused.

### F3 — Every open PR is Marco's, `armed = 0`, and nothing in the queue can reach main without him. I deliberately armed nothing.

Five PRs, all green, all Marco's, aged 9 h to 46 h; four of the five repair the pipeline's own
instruments (`status-sweep.ps1` twice, `triage-holds.ps1`, `vm-git-guard.sh`) and are structurally
barred from the `tests-docs` auto-merge lane because `scripts/` is outside `tests|docs`. That is
Station 04's F3 escalation, and it already has a file: `needs-marco/instrument-repair-prs-cannot-
reach-main-without-you-2026-09-10.md`, written by my 22:1xZ run.

**The arming question, asked before arming rather than after.** With 0 armed and 40 HOLDs, the
tempting move is to arm one. Measured 2026-09-10T08:5xZ and unchanged: **no gate-satisfied HOLD is
`tests-docs` eligible**, so every arm available today opens a PR that lands on the same wall these
five are stacked against. Arming would make the queue longer, not shorter, and would put a sixth
item in front of a man who has not cleared the first five.

**DISPOSITION: DEFERRED — armed nothing, deliberately.** It becomes actionable the moment either
(a) Marco merges some of the five, or (b) a gate-satisfied HOLD appears whose `scope:` is confined
to `tests/**` + `docs/**`, at which point the `tests-docs` lane can carry it end to end with no
human. Both are checkable in one command each.

### F4 — The Linux sandbox would not boot, for the third consecutive station run. Already escalated; recording the count, not a new file.

Byte-identical `RPC error -1 ... Plan9 share "c" which is not mounted` on this run, on 04's
`22:1xZ` run (its F5) and on 03's `23:0xZ` run (its F7), which itself records the same error on
09-09. 04's F5 asked me to open a `needs-marco/` file if it appeared in a second consecutive
breadcrumb. **Two already exist** —
`needs-marco/linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md` and
`needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md` — so opening a third would
split one subject across three files, which is the failure mode `needs-marco/` already suffers from
at 48 entries.

**Exposure this run: nil**, and the reason matters. With the bridge down no VM-side call is
possible, so the hazard the guard covers cannot arise. The real exposure is a **partly** degraded
run — one that loses Desktop Commander but keeps the mount — which would take
`STATION-CAPABILITIES.md` section 3's blind-run COLLECT path with no guard installed.

**DISPOSITION: DEFERRED.** Escalated already, still true, count updated here rather than re-filed.
It becomes URGENT on the first run that is blind-with-a-mount, because that is the only shape in
which the missing guard can cost anything.

### F5 — The sweep labels an open PR's checked-out head an "aborted run leftover — investigate/prune". Real, and I am NOT staging a third status-sweep fix in parallel.

03's F5: `status-sweep.ps1` section 2 printed `orphaned worktree (aborted run leftover --
investigate/prune): C:/po-worktrees/pr1823 9664f95a [feat/ea-gate-reporting-team-permission]` —
a branch that is **open PR #1823's head**. The classifier reaches "orphaned" from **age alone**
(24.9 h) and never asks whether the branch is on the board. 03 handed me the call on whether it
rides with the two open sweep fixes or takes its own prompt.

**It takes neither, this hour.** `#1845` and `#1852` both touch `scripts/pipeline/status-sweep.ps1`
and both are open, green and waiting on Marco. A third change to the same file staged now would
conflict with whichever of the two merges second, and DOCTRINE 10.6 is explicit that staging in
parallel is how duplicates get built. The blast radius today is one misleading word against a clean,
pushed worktree — a prune would lose nothing.

The cure, recorded so the next run does not re-derive it and in the complete-and-additive form:
**before classifying a non-main worktree as orphaned, cross its branch against `gh pr list --state
open --json headRefName` and label a match `live — open PR #N`.** It cannot hide a genuine orphan
(a branch on no open PR is unaffected) and adds no new instrument — the sweep already calls `gh` in
section 1.

**DISPOSITION: DEFERRED.** It becomes actionable the moment `#1845` and `#1852` are both on `main`,
at which point it is one prompt against a file nobody else is holding.

### F6 — Collected and dispositioned without re-doing: 04's sweep-rotation hand-over was already actioned, and four findings across two stations are correctly parked.

Closing the loop on every finding in the two breadcrumbs collected this run, so none is left
dangling:

- **04 F1** (`TRUNK IS RED` false alarm) — **ACTIONED**, landed at 22:1xZ in DOCTRINE 9.5 by my own
  run, independently and from the other side. Did not reproduce this hour.
- **04 F2** (gate liveness clean, Marco-approval class parked) — **DEFERRED**, accepted as measured.
- **04 F3** (instrument-repair PRs cannot reach main) — **ESCALATED**, file already open. See F3.
- **04 F4** (CP-26 vacuous on four PRs) — **DEFERRED**, corroboration of a standing escalation,
  deliberately not re-raised.
- **04 F6** (`triage-holds.ps1` corpus is one suffix) — **DEFERRED**, inert while `armed = 0`, cure
  is `#1850` and already open.
- **04's sweep-rotation hand-over** (*"left DIRTY, Station 00 must commit it"*) — **ACTIONED
  ALREADY**: `git diff --numstat origin/main` is EMPTY on that path and `#1863` carries the advance.
  Re-committing it would have been a no-op PR built on an unverified note; the station doc's Q4 is
  exactly this.
- **03 F1** (keepalive gated on interactive logon) — **ESCALATED**, unchanged since 09-09 and the
  scheduled-task layer is Marco's. Today's reboot cost 68 s instead of 8 h 27 m only because a logon
  happened to arrive a minute later; a defect that did not fire is not a defect that was fixed.
- **03 F3** (clone 12 commits behind, none under `scripts/pr-watcher/**`) — **DEFERRED**, and the
  negative is the valuable half: a restart would adopt 177 docs commits and measure nothing. Its
  discriminator, `git diff --name-only <cloneHEAD>..origin/main -- scripts/pr-watcher`, returned 0.
- **03 F6** (`C:/po-vg` holds one unpushed file, 6.6 days) — **DEFERRED**, already escalated;
  pruning would destroy the only copy.

**DISPOSITION: ACTIONED** — every finding in both collected breadcrumbs now carries a disposition,
and both breadcrumbs are archived in this PR.

## WHAT I DID NOT DO

- **Armed nothing**, deliberately and with the reasoning stated in F3 rather than by omission.
- **Merged, labelled, unlabelled and re-ran nothing on the five open PRs.** RULE 2 binds on the
  three carrying a watcher `marco:true` verdict; `#1852` is second lane hand-classified MARCO'S; and
  `#1823` is Marco's own released PR. Green, CLEAN and unlabelled is not a clearance.
- **Did not restart, kill or wedge-fix the watcher.** The sanctioned probe returned `OK` and an idle
  watcher with 0 armed is correct, not wedged. No `-Fix`, on any verdict.
- **Did not prune either worktree.** `C:/po-vg` holds the only copy of an unpushed file;
  `C:/po-worktrees/pr1823` is an open PR's head (F5).
- **Did not stage a third `status-sweep.ps1` prompt** alongside `#1845` and `#1852` — F5.
- **Did not re-commit `docs/pipeline/sweep-rotation.json`.** The hand-over was real when written and
  had already been actioned; I measured the path rather than trusting either the note or my memory.
- **Did not open a third `needs-marco/` file for the sandbox failure** — F4.
- **Did not touch `Claude Design/docs/index.html`**, an untracked file from another lane sitting in
  the dev tree. It is outside every station's scope and I have not read it; naming it here is the
  whole of my action on it.
- **Did not diagnose the `Dependabot Updates` failure**, or 03's `PO Watcher Keepalive`
  `STATUS_CONTROL_C_EXIT` lead — 03 correctly filed the latter under WHAT I MEASURED rather than as a
  finding, and one occurrence inside its own run window cannot be separated from the run.
- **Did not touch Azure, Entra or SharePoint**, ran no `git` against the mount, wrote no production
  data, and made no commit on `main` in the dev tree.

---

*Written inside this run's own PR worktree, never the dev tree and never a disposable scratch path,
so no untracked copy is left behind for the next fast-forward to trip over. All facts stamped
against `origin/main = 3e1be716`; a claim that outlives its SHA is a lead, not a finding.*
