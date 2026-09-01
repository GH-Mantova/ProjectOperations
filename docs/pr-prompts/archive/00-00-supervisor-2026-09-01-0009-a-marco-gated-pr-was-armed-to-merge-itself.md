# Station 00 — Supervisor | 2026-09-01T00:09Z–2026-09-01T00:25Z

## GROUND

```
UTC            2026-09-01T00:09:06Z
origin/main    e57fd6d4            (fetched, then rev-parse)
dev tree       main @ 5b7e9a63     C:\ProjectOperations2   (2 commits behind origin/main)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE. This was a **SIGHTED** run — Desktop Commander reached the box on
the first call. Not a blind run.

⚠️ **The working copy's `DOCTRINE.md` was 81 lines behind `origin/main` at run start** — it was
missing all of §10 SECOND LANES (#1462) — so the preflight rule *"read all three from
`git show origin/main:<path>`, never from the working copy"* was load-bearing this run, not
ceremonial. §10 is the section this run's headline finding is an instance of.

## WHAT I MEASURED

**The board — 4 open, and every one of them is Marco's.** [MEASURED]
`gh pr list --state open --json ... --limit 100` at 00:11Z, assigned-then-foreach (§9.4):

| PR | mergeState (per-PR) | labels | lane verdict |
|---|---|---|---|
| #1443 scope SUB discipline | BLOCKED | `[]` | `marco:true` — *"escalates:true — PR already carries `do-not-merge`"* |
| #1457 lint NOT_A_PROMPT | **CLEAN** | `[]` | `marco:true` — *"outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs"* |
| #1463 syncMain starvation | BLOCKED | `[]` | **NO LANE VERDICT — hand-classified** |
| #1464 crm-s11 archive reason | BLOCKED | `[]` | `marco:true` — *"escalates:true — held for Marco, labelled do-not-merge"* |

**RULE 2 probe calibrated before use** [MEASURED], per §10.1 and the quote-character rule:
`Select-String -Path 'docs\pr-prompts\processed\*.log' -Pattern 'marco.:true'` → **595**;
negative control `zzzNoSuchTokenZzz` → **0**. Opposite questions, opposite answers, so the probe
speaks.

**#1463 has no verdict because the watcher did not open it** — DOCTRINE §10.1 case 2.
Hand-classified with `classifyPolicyFiles`' own rule [MEASURED]: its two files are `CLAUDE.md` and
`scripts/pr-watcher/index.mjs`. `scripts/` is outside `^(tests|docs)/` ⇒ **it is MARCO'S**.
Recorded as `[NO LANE VERDICT — hand-classified]`, never as "not routed to Marco".

**Sweep** [MEASURED] `scripts/pipeline/status-sweep.ps1`, complete 00:09:58Z:
armed **0** · in-progress prompts **0** · git index.lock interactive/clone **False/False** · git
processes **0** · needs-marco **15** · no-pr-opened **107** · failed **41** · blocked **33** ·
backlog ready=1 needs-marco=2 blocked=4 broken=0. Verdict **CAUTION**: 1 live station worktree
(`C:/po-worktrees/trunk-verdict`).

🟢 The sweep now prints the `LIVE STATION WORKTREE` classifier, which means **the dev tree was
fast-forwarded past #1460 since the 22:11Z run** — the dispatch that run raised is discharged. Its
`orphaned worktrees: none` blindness is cured.

**Breadcrumb freshness** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit
**0**, `CLEAN`, structure 4 checked / 0 malformed. 00 2.1h · 03 1.2h · 04 2.1h · 05 10.1h — **no
station is silent.**

**Watcher clone** [MEASURED] `C:\po-watcher\ProjectOperations` on `main` @ `3985d74f`, its
`origin/main` at `ece17649`, FETCH_HEAD 2026-08-31T23:35Z — **still behind the real `origin/main`
(`e57fd6d4`)**. 03's F1 stands.

**A second actor is driving this board, and it was mid-mutation while I ran.** [MEASURED]

| UTC | event | source |
|---|---|---|
| 22:16:43Z | ARMED `pr-crm-s10-comms-inbox-tab` | `.arming-log.txt` |
| 22:58:27Z | #1461 (crm-s10) **MERGED** | `gh pr view` |
| 22:58:55Z | ARMED `pr-crm-s11-archive-reason-delete-empty` | `.arming-log.txt` |
| 23:12:03Z | #1462 **MERGED** | `gh pr view` |
| 23:32:57Z | #1464 **labeled** `do-not-merge` by GH-Mantova | issue timeline |
| 23:43:16Z | commit `1d1f2cde` *"the delete guard queried the wrong case"* pushed to #1464 | `git log` |
| 00:01:07Z | #1465 **MERGED** | `gh pr view` |
| **00:02:59Z** | **#1464 UNLABELED `do-not-merge`** by GH-Mantova | issue timeline |
| 00:03:43Z | `main` merged into `feat/crm-s11-archive-reason`, CI re-fired | `git log` |
| 00:09Z | **this run starts** | — |

Every actor is `GH-Mantova`, the shared token, so **the API cannot tell Marco from an agent** — that
is why six previous occurrences of this were filed as "unattributable". This one is not attributable
either, but for the first time the removal sits **44 seconds before that same PR's next push**, so
whatever removed the label is the same thing driving the PR.

**#1464's CI red is a real defect, and it is already fixed.** [MEASURED] `gh pr checks 1464`:
`API — lint, test, compliance smoke` FAILURE, 12 others pass. The reviewer named it exactly —
`deleteDropReason` counted `opportunities` but not `archivedOpportunities`, so a `DropReason` in use
as an archive reason could be deleted and orphan the new FK; `crm.service.drop-reason.spec.ts:146`
fails. Commit `1d1f2cde` at 23:43Z applies that fix. **I did not touch it** (see WHAT I DID NOT DO).

## WHAT CHANGED

**One board mutation, and it is a de-arming, not a merge.**

- **`gh pr merge 1457 --disable-auto`.** Read back immediately [MEASURED]:
  `state=OPEN mergedAt= mergeState=CLEAN autoMerge=DISABLED`. #1457 is still open and unmerged.

Nothing else. **No PR merged. No prompt armed. No label removed, and none re-applied. No `/sot/`
edit. Nothing touched in `C:\po-watcher\ProjectOperations`.**

## FINDINGS

### F1 — A PR the watcher routed to Marco was armed to merge itself, with every check green (S1)

[MEASURED] at 00:14:30Z, immediately before acting:

```
#1457  state=OPEN  mergeState=CLEAN  head=80ff93d7
       autoMerge=ENABLED by GH-Mantova method=SQUASH
       labels=[]
       gh pr checks 1457 -> 13 of 13 pass
```

#1457's watcher verdict is
`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs"}`.
**RULE 2 says it must not merge without Marco.** It carried no `do-not-merge` label, it was CLEAN,
all 13 checks were green, and **native squash auto-merge was armed on it.** The only reason it had
not already merged is that its head was behind `main`; the next branch update would have merged it.

This is a *new shape* of the same failure §10.1 describes. §10.1 protects against **reading** an
absent verdict as clearance. This is the **write** side: a `marco:true` PR with an auto-merge
request on it needs no reader at all — GitHub merges it, unattended, and the first anyone knows is
the merge commit. The `ACTIVE DRIVE MANDATE` is explicit that an `escalates`/`needs-marco` PR is
*"OPENED and driven green but NOT auto-merged — it is left for Marco"*, so **auto-merge on #1457 is
a state this station's own doctrine says must not exist.**

Disabling it is not a merge, not a label removal, and is reversible by Marco in one click — so it
is inside my authority and it fails neither half of RULE 1.

**DISPOSITION: ACTIONED.** `gh pr merge 1457 --disable-auto`, read back `autoMerge=DISABLED`,
`state=OPEN`, `mergedAt=` empty. I also checked the other three: #1443, #1463, #1464 all
`autoMerge=none` [MEASURED]. **The board carries no other armed auto-merge.**

### F2 — The `do-not-merge` removal recurred, 6 minutes before this run, on #1464 (S1)

[MEASURED] `gh api repos/GH-Mantova/ProjectOperations/issues/1464/timeline?per_page=100`:
`23:32:57Z labeled do-not-merge` → `2026-09-01T00:02:59Z unlabeled do-not-merge`, actor
`GH-Mantova`. Same query on #1443: `08:22:23Z labeled` → `09:35:36Z unlabeled`.

**No repo script does this.** [MEASURED] `git grep -nE "remove-label|removeLabel|labels/do-not-merge"
origin/main -- scripts` → **0 hits**, with a passing positive control (`do-not-merge` appears 74
times across `scripts` + `docs/pipeline`). So it is a human or an agent acting through `gh`/the API.

🔴 **But the pipeline does INSTRUCT it, in tracked documents that any agent driving a PR will read.**
[MEASURED] `docs/pr-prompts/PROMPT-SCHEMA.md:186` — *"Removing the label is the human's act of
approval. Review the PR, remove `do-not-merge`…"*; `docs/pr-reviews/pr-1440-review.md:49` —
*"MERGE. … Remove the do-not-merge label to release for merge."*; `pr-1165-review.md:25` likewise.
An agent that reads a review file naming its own PR is being handed a directive to strip the gate,
in the same repo whose station docs call that an absolute prohibition. [INFERRED] That is the
*mechanism* the 08:09Z run was pointing at with *"stop hunting the ACTOR and find the INSTRUCTION"*.
⚠️ **It is not proven to be the cause of THESE two removals** — both #1443 and #1464 carry
`REJECT-AND-REDO` reviews, and a REJECT review does not say "remove the label". So the instruction
exists and is dangerous; it is not yet the demonstrated culprit. Two honest attempts; I am not
looping on it.

**DISPOSITION: ESCALATED** — folds into the open CP-26 A/B/C question and **strengthens option (A)**.
See the escalation block below.

### F3 — THE ESCALATION: the human gate is now failing OPEN in two independent ways (S1)

**Marco — this is a decision, not a status update.** Three things are now measured together:

1. A `marco:true` PR (#1457) sat CLEAN with **auto-merge armed** and would have merged unattended.
2. The `do-not-merge` label was stripped from a `marco:true` PR (#1464) **six minutes before this
   run**, by an actor the API records only as `GH-Mantova`.
3. The repo **contains written instructions telling a reader to remove that label** (F2).

Any one of these is survivable. Together they mean **the only thing that actually stopped a
Marco-gated PR from reaching `main` tonight was a scheduled station happening to look.**

Two questions, and they are the same question:

**(A) Complete and additive — an always-running `label-gate` job in `ci.yml`, merged FIRST and then
added to the ruleset as a required check.** It fails the PR while a `do-not-merge` label is present
*and* — the new half — while an auto-merge request exists on a PR whose watcher verdict is
`marco:true`. Solves it immediately (the gate is enforced by GitHub, not by an agent's discipline)
and in future (it cannot be "not read"), and damages no data entry: it only ever blocks a merge.
**Passes both halves of RULE 1.**

**(B) Ruleset-only — add the existing advisory CP-26 step as a required check.** Fixes today, fails
the future half: CP-26 is keyed on the live label, so anything that removes the label still releases
the PR, and it says nothing about auto-merge requests.

**(C) Discipline only — keep writing "never remove the label" in station docs.** This is what we have,
and it is what failed. It fails both halves. **Dead.**

Two sub-questions only you can answer:

- **Did you remove `do-not-merge` from `#1464` at `2026-09-01T00:02:59Z`, and from `#1443` at
  `2026-08-31T09:35:36Z`?** If yes, both are discharged and the pattern is six, not eight. If no,
  something with your token is releasing human gates unprompted, and (A) becomes urgent rather than
  merely correct.
- **Did you enable auto-merge on `#1457`?** I disabled it. If that was you clearing it, re-enable it
  and say so in chat and I will not touch it again — RULE 2 clearance is yours to give.

⚠️ Its *"did Marco remove #1431's label?"* half is **already ANSWERED (yes, #1439)** — that half is
closed and must not be re-asked. **(A)'s vehicle is BUILT and merged INERT in #1441; do not arm it
until A/B/C is answered.**

**DISPOSITION: ESCALATED.**

### F4 — 04's dispatched arm target cannot be armed: it is not tracked (S3)

04 dispatched → 00: *"arm `docs/pr-prompts/pr-doctrine-s95-cite-symbol-not-line-HOLD.md`"*.
[MEASURED] `git status --short` lists that file as `??` — **untracked**. Arming is a `git mv` of a
**tracked** `-HOLD.md`; `arm-prompt.ps1` cannot rename a file git does not know about, and creating
a `-ready.md` instead is swallowed by `.gitignore:75`. So the dispatch was correct in substance and
unexecutable as written.

**DISPOSITION: ACTIONED** — this PR commits the HOLD, which makes it armable by the sanctioned path
next run. **It is committed, NOT armed** (F5).

### F5 — I did not arm, and the reason is LL-38, not caution (S2)

Real armed count **0** [MEASURED]. The fallback rule in `00-supervisor.md` is explicit: *"first
confirm nothing else is mid-mutation (in-progress prompt, git lock, **a PR touched in the last ~2
min**). If something else is acting, STOP: that is the LL-38 collision."* A commit landed on #1464
at **00:03:43Z** and its CI was `IN_PROGRESS` while I measured. Something else is acting.

Two further reasons the answer would be "not yet" even without that: the board is **four PRs and all
four are Marco's**, so another code-touching arm only lengthens his queue; and the one docs-only
candidate was untracked until this PR (F4).

**DISPOSITION: DEFERRED.** **What makes it actionable:** the next SIGHTED run finds no PR touched in
the last ~2 min and no in-progress prompt. Then arm
`pr-doctrine-s95-cite-symbol-not-line-HOLD.md` — **docs-only, so the `tests-docs` auto-merge policy
can land it without consuming Marco** (DOCTRINE §10.3). Read its BODY for a prose human gate first
(RULE 4), and remember a §9 edit needs `lint-station.mjs --write-canonical`.

### F6 — COLLECTED: Station 03's breadcrumb (2026-08-31T23:02Z), five findings

- **F1 clone 11 commits behind.** Confirmed still true this run at `3985d74f` vs `e57fd6d4`
  [MEASURED]. **DISPOSITION: DISPATCHED → Station 03.** FF the clone **with the watcher stopped**,
  then relaunch. A restart adopts stale code otherwise (§9.5).
- **F2 `status-sweep.ps1:168` throws a red `NativeCommandError` on an empty escapee directory.**
  One-line fix, but it is `scripts/` — outside `tests|docs` — so it routes to Marco and would make
  this docs-only board PR his. **DISPOSITION: DEFERRED** — stage it as its own prompt so the
  watcher builds and reviews it. Urgent if the red ever masks a real sweep failure.
- **F3 two worktree escapees point at destroyed Linux-sandbox gitdirs.** Prune authority is 00's.
  **DISPOSITION: DEFERRED** — the sweep reports `C:/po-worktrees/trunk-verdict` as a **LIVE** station
  worktree and its verdict is CAUTION; pruning while a second actor drives the board is exactly the
  collision F5 avoids. Next quiet SIGHTED run.
- **F4 four documents name three different watcher-launcher paths, and
  `watcher-launcher-singlelane.ps1` exists at none of the repo paths.** This is a live trap: two of
  those paths are in *my* station doc. **DISPOSITION: DISPATCHED → next docs arm**, folded with F4's
  DOCTRINE §9.5 prompt so one PR carries both.
- **F5 clone stash pile at 55, still a closed loop.** **DISPOSITION: DEFERRED**, as 03 filed it.

### F7 — COLLECTED: Station 04's breadcrumb (2026-08-31T22:11Z), four findings

- **F1 DOCTRINE §9.5's `:1518` citation goes stale the moment #1457 merges.** #1457 is now held
  (F1), so this is not imminent. **DISPOSITION: DISPATCHED** — same docs arm as above; cite the
  symbol, not the line.
- **F2/F3 two method findings** (a PowerShell loop returning a confident wrong version at exit 0; a
  naive path-reference scan yielding 53 phantoms). **DISPOSITION: DEFERRED**, as 04 filed them —
  §9 is hash-gated and both belong in one re-record, not two.
- **F4 watcher clone parked on a feature branch and dirty.** Merges into 03's F1.
  **DISPOSITION: DISPATCHED → Station 03**, same clone-hygiene dispatch.

### F8 — `check-breadcrumb.mjs` and `STATION-CAPABILITIES.md` disagree about 03's cadence (S4)

[MEASURED] `--freshness` prints `03 … (cadence 24h)`; `STATION-CAPABILITIES.md` §6 says
*"03 Machine-minder — 4 h or manual"*. At 24h, 03 can be silent for two days before anything says so.
Neither is obviously right — 03 is partly dispatch-driven — so this is Marco's call about how long
machine blindness may last, not mine to reconcile silently.

**DISPOSITION: DEFERRED.** **What makes it urgent:** 03 going quiet during a watcher incident, when
a 24h threshold would hide it for a day. Fold into the next docs arm as a question, not a fix.

## WHAT I DID NOT DO

- **Did not merge anything.** All four open PRs are Marco's — three by watcher verdict, #1463 by
  hand-classification (§10.1 case 2). RULE 2 is not cleared by green, by CLEAN, by an empty label
  list, or by a reviewer's MERGE verdict.
- **Did not remove or re-apply any `do-not-merge` label**, on #1464 or anywhere. Removing one is an
  absolute prohibition. *Re-applying* one to #1464 was tempting and I rejected it: a second actor was
  mid-flight on that PR 6 minutes earlier (LL-38), and if that actor is Marco then re-applying it
  discards work he asked for — the exact failure DOCTRINE §5b records from 2026-07-20.
- **Did not fix #1464's red.** The reviewer's diagnosis is correct and specific, but commit
  `1d1f2cde` at 23:43Z already applies that fix and CI is re-running on it. Pushing my own fix into
  a branch someone else is actively driving is the collision, not the cure.
- **Did not arm.** See F5.
- **Did not prune the two dead worktree escapees**, or clear the 55 clone stashes. Sweep verdict is
  CAUTION with a live station worktree.
- **Did not run `git` in `C:\po-watcher\ProjectOperations`** beyond `rev-parse` (read-only), did not
  fast-forward the clone myself (that is 03's, and it needs the watcher stopped), did not restart the
  watcher — `restart-watcher-if-wedged.ps1` was not needed: armed 0, in-progress 0, no lock.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
- **Did not archive dispositioned breadcrumbs this run.** The three in the queue root are this
  cycle's and are being committed, not archived; archiving is for what is already dispositioned and
  landed.

---

**Untracked-breadcrumb note:** this file is untracked until this PR commits it. It is committed
inside its own run's PR, which is the preferred of the two correct homes.

**Breadcrumb validator:** run in the PR's own `pipeline-tests` job — `check-breadcrumb.mjs` reported
`CLEAN`, exit 0, on the three breadcrumbs already present at 00:2xZ. This one is validated by CI on
this PR, not by me quoting a pre-run result.

---

### ADDENDUM 2026-09-01T00:19Z — the board grew by one while this breadcrumb was being written

**"Four open PRs" above decayed inside this run.** [MEASURED] at 00:19:36Z the open board is **six**:
#1443, #1457, #1463, #1464, **#1466 (new)**, and #1467 (this PR).

**#1466** was created at **00:16:55Z** — during this run, minutes after #1464's 00:03Z push. It
touches exactly one file, `scripts/pipeline/status-sweep.ps1`, which is outside `^(tests|docs)/`, so
by `classifyPolicyFiles`' own rule it is **`[NO LANE VERDICT — hand-classified]` ⇒ MARCO'S**.
So the count changes and the conclusion does not: **every open PR except this one is Marco's, and
the queue grew again while a station watched.** That is F3's escalation restated with a fresh
data point, not a new finding.

⚠️ **Two instrument notes from the same minute, both §9.5:**

1. `Get-ChildItem -Filter *-ready.md` returned **1**, which reads as *"someone armed a prompt during
   this run."* It is `rev-1466-ready.md` — an **auto-generated REVIEW JOB, not a prompt**. **Real
   armed count is still 0.** Anyone quoting a raw `-ready.md` count as "armed" will file a false
   arming report; exclude `rev-*`.
2. `git worktree list` shows only the dev tree, while `status-sweep.ps1` reports
   `C:/po-worktrees/trunk-verdict` as a LIVE STATION WORKTREE. Both are correct: the registry cannot
   enumerate its own escapees. Do not resolve that disagreement by trusting the registry.

**DISPOSITION: ACTIONED** — recorded here so the next run does not re-derive a board count this run
already watched go stale.
