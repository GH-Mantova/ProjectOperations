# Station 00 — Supervisor | 2026-09-22T12:14Z–2026-09-22T12:35Z

## GROUND

```
UTC            2026-09-22T12:14:47Z
origin/main    2a9e6b42  (at preflight)  ->  9a48ab3d  (re-measured 12:2xZ, after #2082 merged mid-run)
dev tree       main @ 2a9e6b42  C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE** (1 == 1), so this run was not restricted to READ-ONLY.

**NOT BLIND.** `start_process` on `powershell.exe` returned PID 28236 at 12:14Z (and PID 17404 at
12:26Z after the first shell exited on a PS 5.1 quoting fault — §9.4, see M7). Desktop Commander
tool ids were resolved by keyword `ToolSearch` for `desktop-commander`, not assumed.

**Binding documents.** `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, i.e. the working copy
is byte-equal to `origin/main` for all three, so reading the working copy was sound this run.
⚠️ **Scope limit, stated rather than implied:** `00-supervisor.md` was read **in full** (1570
lines). `DOCTRINE.md` (214 264 B) was read at §1–§8.5 in full plus §9's heading index, §9.6 and
§10.1; `STATION-CAPABILITIES.md` (103 835 B) at §5 and §6 in full plus its heading index. That is a
deliberate call under the token-budget rule (station brief §7), not an omission — and it is the
subject of the already-open escalation
`needs-marco/binding-read-contract-exceeds-what-a-run-can-carry-2026-09-14.md`, not re-filed here.

**Device-bridge git guard.** `bash scripts/pipeline/vm-git-guard.sh` → headline
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`, last line
`PATH="/sessions/dazzling-trusting-shannon/.local/bin:$PATH" git <args>`, **EXIT CODE 2** — read
from the installer itself, not from a pipeline appended to it. That is the middle row of the
three-outcome table: a FINDING, not a STOP. **No `git` was run through the device bridge against
the mount at any point in this run** — every git call went through the Windows shell.

---

## WHAT I MEASURED

**M1 — the sweep, and its verdict.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, complete
12:15:24Z. Section 0 positive controls both PASS (`gh` reached GitHub; `node` runs). **Section 7
verdict: `SAFE TO ACT`.** Board at that moment: **2 open PRs, both CLEAN, both green** — #2082
15/15, #2080 10/10 — **zero DIRTY**; `main` CI on `2a9e6b42` 4 success / 0 failed. Queue: **armed
= 0**, needs-marco 62, no-pr-opened 109, failed 59, blocked 150. Watcher node RUNNING pid 9744,
wrapper alive, heartbeat 81 min (stale + empty queue = idle, not wedged).

**M2 — COLLECT: nothing new to disposition, and I asked the TRACKED set, not `git status`.**
[MEASURED] `git ls-files docs/pr-prompts | Select-String '^docs/pr-prompts/00-\d\d-'` → **exactly
one** breadcrumb at depth 1, my own `…-1124-…`, already tracked on `main` (it landed in #2083).
On disk at depth 1: the same single file. No 03/04/05 breadcrumb has appeared since my last run.

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, **exit 0**;
`00` 0.9 h, `03` 13.3 h, `04` 2.1 h, `05` 22.1 h, all `ok`; structure 1 checked, 0 malformed.

[MEASURED] cross-checked against `lastRunAt` from the scheduled-tasks MCP, because the breadcrumb is
one instrument and cannot name a cause:

| station | `lastRunAt` | newest breadcrumb | row |
|---|---|---|---|
| 00 | 2026-09-22T12:14:17Z (this run) | 11:24Z | fresh, aligned |
| 03 | 2026-09-21T23:02:53Z | 2026-09-21T23:04Z | fresh, aligned (cron `0 9 * * *`, next 23:02Z) |
| 04 | 2026-09-22T10:09:55Z | 10:11Z | fresh, aligned |
| 05 | 2026-09-21T14:10:40Z | 2026-09-21T14:11Z | fresh, aligned (cron `10 0 * * *`, next 14:22Z) |

**No station is SILENT and none of the three failure rows fired.** `weekly-security-audit` remains
`enabled: false` — already filed for Marco, not re-filed here.

**M3 — §10.1 step 1, with both controls, on both open PRs.** [MEASURED] corpus
`docs/pr-prompts/processed/*.md.log`, **2370 logs**:

```
merge result for PR #2082   -> 0 hit(s)
merge result for PR #2080   -> 0 hit(s)
merge result for PR #2040   -> 1 hit(s)   {"ok":false,"marco":true,...}   <- POSITIVE control
zzzNoSuchNeedleZzz2026      -> 0 hit(s)                                   <- NEGATIVE control
```

Neither PR is watcher-routed, and **the absence proves nothing about risk** — both were
hand-classified under step 2. `[NO LANE VERDICT — hand-classified]` for each:

- **#2080** — one file, `docs/pr-prompts/pr-scopecards-s7-one-cutting-total-HOLD.md`. Matches
  `^(tests|docs)/` ⇒ passes `classifyPolicyFiles`. **In 00's lane.**
- **#2082** — one file, `.github/workflows/playwright-container-trial.yml`. Matches **none** of the
  three `NESTED_TEST_PATHS` forms, and `.github/` is covered by **no** station lane in
  `STATION-CAPABILITIES.md` §5 ⇒ **Marco's**, exactly as the 2026-09-22
  `NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1` narrowing requires.

**M4 — the alert instrument can no longer produce a non-zero answer on this repo, so its zero
refutes nothing.** [MEASURED] the escalation's own falsifying probe
`alerts?pr=2082&state=open` → **0**. But the attempted positive control `alerts?pr=2040&state=open`
also returned **0**, which is not a control. Widening: `alerts?per_page=100` (ANY state) → **11**
alerts, numbered **#1–#19**, `fixed=9` / `dismissed=4` / **open=0 repo-wide**. The four alerts the
11:24Z run measured were numbered **31–34** — absent from **every** state, not marked fixed. None
of the 11 carries rule `actions/cache-poisoning/poisonable-step`, and the 4 dismissed are May-2026
`js/type-confusion` and `js/xss-through-dom` findings in `scope-of-works.service.ts` and
`FormSubmitPage.tsx`, unrelated to this workflow. **Reading:** the analysis for the superseded head
`bf7e43a7` was deleted when the head moved to `fa1b03eb`; with zero open alerts repo-wide, no
positive control for this probe shape is constructible today. **[CANNOT MEASURE]** the four alerts'
fate by this instrument — which is why F1 rests on file content instead.

**M5 — the file content on `main`, which does not depend on that instrument.** [MEASURED]
`git show origin/main:.github/workflows/playwright-container-trial.yml` at `9a48ab3d`, 4320 chars;
NEGATIVE control `zzzNoSuchTokenZzz` → 0 hits on the same read. Lines 3–4 are
`permissions:` / `contents: read`. There is **no** `ref:` on `actions/checkout@v4.2.2` (line 55),
and lines 7–9 say verbatim *"it checks out the ref it was dispatched on; there is deliberately no
'ref' input - checking out a caller-chosen ref is the CodeQL cache-poisoning pattern, #2082"*.

**M6 — the board moved under me, twice, and both times I re-measured instead of acting on the
snapshot.** [MEASURED] `#2082 state=MERGED mergedAt=2026-09-22T12:20:20Z
mergeCommit=9a48ab3d22fdf28f44cf5be6274aea18e4dad66e`, i.e. **six minutes after the sweep printed it
OPEN**. Separately, `C:\po-wt\trialfix` — which the 12:15Z sweep classified an *orphaned worktree
(investigate/prune)* — **no longer existed** at 12:23Z (`fatal: cannot change to 'C:\po-wt\trialfix':
No such file or directory`). It was a **live** worktree on `fa1b03eb`, the then-current PR head,
torn down by its owner. This is §7's `[LIVE]`-means-when-measured, twice in one run. **Nothing was
dispatched about that worktree** — a dispatch to prune a directory that no longer exists is a
dispatch to nobody.

**M7 — my own instrument lied once, in the documented way.** [MEASURED] `gh … --jq '"…\(.field)…"'`
under PS 5.1 failed twice (`accepts 1 arg(s), received 6`; `failed to parse jq expression`) and the
second failure **killed the shell**. That is §7 standing guard 8 / §9.4 exactly: escaped double
quotes inside `--jq` do not survive PS 5.1. Recovered by taking raw `--json` and
`ConvertFrom-Json`. Recorded because the failure was *loud* — had it been quiet it would have
produced an empty answer I might have believed.

**M8 — Q3, counted myself, not quoted from a note.** [MEASURED]
`@(Get-ChildItem docs\pr-prompts -Filter *-ready.md).Count` → **0**; `*-HOLD.md` → **15**.

**M9 — nothing is armable, and that is a verdict rather than an omission.** [MEASURED]
`scripts/pipeline/triage-holds.ps1`, exit 0, READ-ONLY. Header controls both PASS (`GIT control:
PASS` — read `origin/main:docs/pipeline/DOCTRINE.md`, **214264 chars**, matching a byte count I took
independently; `SPENT control: PASS` — `lint-prompt.mjs` exit 3 on the fixture).
**`gates-satisfied = 0`, `spent = 0 of 15`, `still-gated = 15`, `unreadable = 0`.**

**M10 — the watcher clone is dirty but NOT corrupt.** [MEASURED] read-only git in
`C:\po-watcher\ProjectOperations`: `branch=main`, `MERGE_HEAD=False`, no `rebase-merge` /
`rebase-apply`, `git diff --diff-filter=U` → **empty**, `index.lock=False`. The six dirty entries
are one modified generated file (`docs/data-model/metadata-catalog.json`, with git's own
`LF will be replaced by CRLF` warning — §9.3) and five untracked: `.codex/`, `AGENTS.md`,
`docs/pr-reviews/pr-2080-review.md`, `docs/pr-reviews/pr-2082-review.md`,
`scripts/pr-watcher/.conflict-notified-prs.json`.

**M11 — the review verdicts DID reach GitHub, contrary to my first reading of them.** [MEASURED]
`gh api …/issues/2082/comments` → 3 comments; the first, at **10:54:42Z**, is
`[watcher verdict] PRE-MERGE REVIEW …` and says of itself *"Source: docs/pr-reviews/pr-2082-review.md
- local to the watcher clone and archived once the PR settles, so this comment is the …"*. The
substance was published. What is true is narrower: the **files** are untracked, while
`git ls-tree -r origin/main -- docs/pr-reviews` holds **165** tracked review files and neither
`pr-2080-review.md` nor `pr-2082-review.md` is among them.

**M12 — condition 3 (single actor), re-measured immediately before the only mutation.** [MEASURED]
at **12:23:43Z**: `index.lock` dev `False` / clone `False`; `Get-CimInstance Win32_Process -Filter
"Name='git.exe'"` → **0**; `C:\po-wt\trialfix` gone. Satisfied.

---

## WHAT CHANGED

1. **Published two review verdicts** into `docs/pr-reviews/` in this run's PR —
   `pr-2080-review.md` (2170 B) and `pr-2082-review.md` (1679 B), copied byte-for-byte out of the
   watcher clone where they were untracked. 165 tracked precedents make this the convention.
2. **Archived** `00-00-supervisor-2026-09-22-1124-…md` to `docs/pr-prompts/archive/`
   (`git mv`, exit 0) — every finding in it carries a disposition (see F6).
3. **Discharged** `needs-marco/container-trial-runs-a-caller-chosen-ref-in-a-privileged-context-2026-09-22.md`
   → `needs-marco/discharged/`, with `_DISCHARGE-NOTE-container-trial-ref-2026-09-22-1230.md`
   beside it. **Confirmed untracked first** (`git ls-files -- <path>` → empty; only 6 of the files
   under `needs-marco/` are tracked), so the move cannot ride into another actor's commit.
   ⚠️ **That folder is gitignored, so this line in this breadcrumb is the only way the discharge
   reaches anyone. Marco: one fewer question is waiting on you — see F1.**
4. **Armed nothing** (M9). **Merged nothing** (F2, F3). **Restarted nothing** (M1, M10).
5. This breadcrumb was written **inside the PR worktree** (`C:\po-wt\collect1223`), i.e. cure 1 —
   no loose copy exists in the dev tree, so the post-merge fast-forward cannot be blocked by it.

---

## FINDINGS

### F1 — the container-trial escalation is discharged by WHAT MERGED, and the instrument it named as its own falsifying probe can no longer refute anything. `TRIAL_REF_DISCHARGED_BY_CONTENT_NOT_ALERTS_V1`

The 11:24Z run put a design choice to Marco: the trial could not be made clean while it kept **both**
a caller-chosen `inputs.ref` **and** the default branch's privileged context. #2082 merged at
12:20:20Z (M6) and **both properties are gone on `main`** (M5): no `ref:` on the checkout, with the
file itself naming the cache-poisoning pattern as the reason, and workflow-level
`permissions: contents: read`. The author shipped the privilege-dropping half of option (a) *and*
removed the ref input — and dispatch is still by `gh workflow run --ref <branch>`, so the objection
the escalation raised against option (b) ("a trial that can only test `main` cannot qualify a PR
head") **does not apply to what actually shipped**.

🔴 **The part worth carrying forward is the instrument, not the outcome.** The escalation named
`alerts?pr=2082&state=open` as its falsifying probe. That probe now returns 0 — and **0 is
currently the only answer it can give**, because there are zero open alerts repo-wide and alerts
31–34 were deleted with the superseded head rather than marked fixed (M4). A run that had trusted
the named probe would have recorded "refuted" on an instrument with no reachable positive control.
**What discharges this is the file on `main`, which is checkable forever.** The re-open condition
and its two-row probe are written into the discharge note.

**DISPOSITION: ACTIONED** — moved to `needs-marco/discharged/` with a measured note; verified
`SOURCE_GONE=True`, `MOVED_EXISTS=True`. ⚠️ Re-opens if that workflow on `main` ever regains a
`ref:` input while holding write-scoped permissions.

### F2 — #2082 was Marco's by lane, I did not merge it, and something else did — a recurrence of an escalation already open, not a new one

[MEASURED] `.github/` is outside every lane in `STATION-CAPABILITIES.md` §5 and outside
`NESTED_TEST_PATHS`, with 0 watcher-routing hits under both controls (M3) — so #2082 was **Marco's**
and stayed Marco's for the whole time I could see it. It merged at 12:20:20Z with
`mergedBy=GH-Mantova`, which §5 records as reading that way for *every* merge on this board, human
and agent alike; the durable signature is the receipt, and `Approval receipt (CP-26) = SUCCESS`
passed **vacuously** here — the PR carried no labels and **0** receipt lines in its body. The
12:20:39Z PR comment ("Merged. Evidence for pr-e2e-container-s2 (criterion 4) …") is the actor's own
note and reads like the supervised lane, but a comment is not a signature.

This is precisely the class already filed as
`needs-marco/nothing-verifies-a-merge-approval-receipt-2026-09-07.md`. **I did not re-file it** —
one question in one place.

**DISPOSITION: DEFERRED** — recurrence recorded against an open escalation, not re-raised.
⚠️ **What would make it urgent:** an out-of-lane merge Marco says he did not authorise. That
distinction is exactly what the open escalation asks for and exactly what cannot be made today.

### F3 — #2080 is unchanged, still `escalates: true`, and its question is still the one already before Marco

[MEASURED] re-verified the prior run's central claim rather than repeating it (§7.1 re-read rule):
`gh pr diff 2080` on the live head → the staged prompt carries **`escalates: true`**. It is now the
only open PR, **CLEAN**, `labels: []` read per-PR (LL-47), one docs-only file. The ACTIVE DRIVE
MANDATE's standing exception therefore applies — driven green, **not** auto-merged — and its
drive-green half has nothing left to do.

The real question (does that exception attach to a *staging* PR landing an inert `-HOLD.md`, or
only to the *build* PR once the prompt is armed?) was put to Marco by the 10:40Z run. Not re-asked.

**DISPOSITION: DEFERRED** — waiting on an answer already requested, not on anything I can measure.
⚠️ **What would make it urgent:** #2080 going stale enough to conflict, or Marco ruling the
exception does not reach staging PRs — at which point it merges immediately.

### F4 — two review verdicts existed only as untracked files in the watcher clone; the substance HAD reached GitHub, the artifacts had not

My first reading of M10 was that these verdicts "reached nobody". **M11 refutes that** — the watcher
posts the verdict as a PR comment, and #2082's went up at 10:54:42Z. I record the correction because
the alarming version of this finding is the one a reader would remember. The accurate, narrower
fact: the **files** were untracked and the clone's own comment says they are *"archived once the PR
settles"*, while `origin/main` tracks **165** of them and held neither of these two.

**DISPOSITION: ACTIONED** — both published in this run's PR (M11, WHAT CHANGED 1).
⚠️ Published **as found, unedited**: `pr-2082-review.md` carries no SHA and was authored against
head `bf7e43a7` (it says the PR "is BEHIND main and needs rebase" and calls the CodeQL meta-check
"orphaned"), while the merged head was `fa1b03eb`. Per §7.1 it is a **lead, not a finding** — and it
is silent on the four alerts F1 is about. Published for the record, not as a verdict to act on.

### F5 — nothing is armable, FOURTH consecutive hour, and the `triage-holds.ps1` SUSPECT banner is explained rather than obeyed

[MEASURED] `gates-satisfied = 0` of 15 (M9), armed = 0 (M8). The script printed its
`!!! SUSPECT: every prompt landed in ONE bucket` banner for the fourth consecutive hour (08:20Z,
09:30Z, 11:24Z, now). Its own instruction is to prove node and git resolve before believing the run
— **and its own header controls already do**: `GIT control: PASS` read 214264 chars of DOCTRINE,
matching a byte count I took independently, and `SPENT control: PASS` got exit 3 from
`lint-prompt.mjs` on the fixture. The 15 rejects also split into **two distinct reasons** —
11 `HUMAN_GATE_PRESENT`, 4 `FILE_GATE_NOT_RELEASED` — which is evidence against a uniformly broken
probe. So "nothing armable" is a **measured verdict**, and arming nothing was the correct action.

**DISPOSITION: DEFERRED** — unchanged owner and trigger from the three prior runs: the banner's
heuristic fires on a board that is legitimately uniform, and narrowing it is a `scripts/` change
outside 00's merge lane. ⚠️ **What would make it urgent:** the banner firing while a header control
FAILS, or the reject reasons collapsing to a single value.

### F6 — COLLECT: one breadcrumb since my last run, mine, every finding already dispositioned

[MEASURED] the tracked set (M2), not the dev tree's `git status` — the cheap rule that stops a run
committing a second copy of a file `archive/` already holds.

| breadcrumb | its findings | my disposition |
|---|---|---|
| `00-00-supervisor-…-1124-…` (landed via #2083) | F1 ESCALATED, F2 ACTIONED, F3 DEFERRED, F4 ACTIONED, F5 ACTIONED, F6 DEFERRED, F7 DEFERRED, F8 DEFERRED | all confirmed; **F1 now ACTIONED/discharged (my F1)**, F3 re-affirmed (my F3), F6 re-affirmed (my F5), F7 re-measured (GROUND/F7), F8 unchanged |

No 03/04/05 breadcrumb has appeared since 11:24Z, and `--freshness` plus `lastRunAt` agree none is
missing (M2). **Nothing was dispatched this run except F8**, because nothing else arrived needing it.

**DISPOSITION: ACTIONED** — the 11:24Z breadcrumb is `git mv`'d to `archive/` in this run's PR.

### F7 — the device-bridge git ban is still REMEMBERED, not mechanical

[MEASURED] guard exit **2**, `INSTALLED BUT INERT`, with the installer's own controls showing
`bash -lc` resolving the shim and `bash -c` resolving `/usr/bin/git` (GROUND). The shell a station
is given is non-interactive and non-login, so the `PATH` export reaches nothing. Unchanged from the
11:24Z measurement; the cure is a change to how the VM shell is launched.

**DISPOSITION: DEFERRED** — already recorded; the remedy is outside this run's scope and no `git`
touched the mount this run. ⚠️ **What would make it urgent:** an `index.lock` with no owning Windows
process appearing in either tree.

### F8 — the watcher clone is dirty-but-sound, and a second lane has left tracks in it

[MEASURED] M10: not corrupt by any of the three CORRUPT tests, so `rescue-watcher-repo.ps1` is
**not** indicated — "off main"/"dirty" is not "broken", and a false alarm here licenses a
destructive `git checkout main` against a live tree. Two of the six entries are `.codex/` and
`AGENTS.md`, untracked — a second lane (Codex) has run in the watcher's own clone, which is the
§10 second-lane shape rather than a machine fault.

**DISPOSITION: DISPATCHED** — to **03 machine-minder**, whose lane is the watcher's trees and whose
next occurrence is 2026-09-22T23:02Z: *the clone carries a modified generated file
(`docs/data-model/metadata-catalog.json`, LF/CRLF) and, once this run's PR lands the two review
files, four untracked leftovers including `.codex/` and `AGENTS.md`. Sound, not urgent — armed = 0,
so nothing is waiting on it.* I did not clean it myself: read-only git in that repo is the standing
rule and 03 owns it.

---

## WHAT I DID NOT DO

- **Did not merge #2082**, and could not have: `.github/` is outside every station lane and outside
  `NESTED_TEST_PATHS`, with 0 watcher-routing hits under both controls (M3, F2). It merged anyway,
  by another actor, six minutes after I measured it open.
- **Did not merge #2080** — `escalates: true`, question already with Marco (F3).
- **Did not arm anything** — `gates-satisfied = 0`, verified against the script's own passing
  controls rather than assumed (M9, F5).
- **Did not touch `C:\po-wt\trialfix`, nor dispatch its pruning** — it was a live worktree on the
  then-current head and its owner removed it mid-run (M6). Dispatching work on a directory that no
  longer exists is a dispatch to nobody.
- **Did not run `rescue-watcher-repo.ps1`** — the clone fails every CORRUPT test (M10, F8).
- **Did not restart the watcher** — node RUNNING pid 9744, wrapper alive, heartbeat stale **with an
  empty queue**, which is idle rather than wedged. Nothing was killed.
- **Did not run `git` through the device bridge against the mount**, the guard being INERT rather
  than enforcing (GROUND, F7).
- **Did not re-file** the merge-receipt question (F2), the binding-read-budget question (GROUND) or
  the `check-breadcrumb` 00-cadence defect — each is already open with Marco.
- **Did not commit to `main`, did not edit `/sot/`, did not touch Azure / Entra / SharePoint, did
  not write production data.**

## FOR MARCO

One thing, and it is a subtraction: **the container-trial security question is off your plate.**
#2082 merged with both properties the escalation named removed — no caller-chosen `ref` input, and
explicit `contents: read` — so there is no design call left to make (F1). The escalation is moved to
`needs-marco/discharged/` with the measurement that discharges it.

The one thing I could not settle: **who merged #2082.** It sat outside every station's lane, and the
receipt that would say which lane took it passed vacuously (F2). That is the open escalation
`nothing-verifies-a-merge-approval-receipt-2026-09-07.md`, now with a concrete instance attached.
If that merge was yours or your supervised lane's, nothing is wrong — but today nothing on the board
can tell the difference, and that is the part worth fixing.
