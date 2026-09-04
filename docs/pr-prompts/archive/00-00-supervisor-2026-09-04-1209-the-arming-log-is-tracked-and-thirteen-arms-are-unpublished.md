# Station 00 — Supervisor | 2026-09-04T12:09Z–2026-09-04T12:4xZ

## GROUND

```
UTC            2026-09-04T12:09:15Z
origin/main    6c7e94c5            (git fetch origin --prune, then rev-parse)
dev tree       main @ 6c7e94c5     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE (both 1) — full authority, not read-only.
**NOT BLIND.** Desktop Commander loaded via keyword `ToolSearch` (ids not assumed, per PREFLIGHT
step 1 as corrected by #1580); `start_process` shell `powershell.exe` → PID 33340.

All three binding documents read from the dev tree **after proving them identical to `origin/main`
with the sound probe**: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` → **EMPTY**.
No piped `hash-object` form was used (PREFLIGHT step 2, the #1578 correction).

## WHAT I MEASURED

- [MEASURED] `status-sweep.ps1` 12:10:09Z. Section 0 controls both PASS (`gh` reached GitHub, saw
  merged #1588; `node` runs). **OPEN PRs 2** — #1589 CLEAN 14/0/0 green, #1585 CLEAN 14/0/0 green.
  **armed `*-ready.md` 0.** main CI on `6c7e94c5` 4 success / 0 failed (trunk green). Watcher node
  RUNNING pid 20000, wrapper alive (1), heartbeat 28 min (ticks only mid-run; empty queue ⇒ idle,
  not wedged). needs-marco 13 · no-pr-opened 109 · failed 41 · blocked 117.
  VERDICT **CAUTION** — one live station worktree `C:/po-vg`.
- [MEASURED] Single-actor gate (DOCTRINE §9.5: `status-sweep` §3 answers this, **not**
  `list_sessions`), re-measured immediately before the only mutation of this run at 12:2xZ:
  in-progress prompts **0** · `index.lock` dev **False** / clone **False** · running `git`
  processes **0** · no PR touched in the last 2 min. Safe to act.
- [MEASURED] Dev tree index is CLEAN: `git diff --cached --name-status` → **EMPTY**. No staged
  `R100 HOLD→ready` residue (the standing trap; probe was `--cached --name-status`, not a trimmed
  `--porcelain`).
- [MEASURED] RULE 2 probe, on the **pinned live tree** `C:\ProjectOperations2\docs\pr-prompts\processed`
  and never the clone: **1889** logs, newest `2026-09-04T11:43:16Z` — younger than the oldest open PR
  (#1585, opened 11:15:26Z), which is the AGE control that separates the live directory from the
  decoy. POS `marco.:true` → **609**; NEG `zzzNoSuchZzz` → **0**. Written without a quote character.
- [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN, exit 0**.
  structure 3 checked / 0 malformed. 00 1.0h · 03 13.2h · 04 2.0h · 05 14.3h — all `ok`.
  ⚠️ Recorded with escalation #23's standing caveat: `ok` is not an all-clear, and 03's real cadence
  is still open with Marco (bootstrap 4h vs cron daily).
- [MEASURED] `git ls-remote --heads origin` → `refs/heads/preserve/pipeline-heartbeat`
  `74528743`, `refs/heads/fix/lint-gate-path-space` `18c4c0b3`. **The standing "confirm
  `preserve/pipeline-heartbeat` still exists before anyone prunes `po-vg`" condition is SATISFIED.**
  `git -C C:\po-vg status --porcelain` still shows the untracked
  `scripts/pipeline/check-pipeline-heartbeat.mjs` on `fix/no-rebase-while-checks-run`.
- [MEASURED] Watcher clone dirty=2, and both are benign runtime artifacts, not damage:
  ` M docs/data-model/metadata-catalog.json` and `?? scripts/pr-watcher/.conflict-notified-prs.json`.
  No `MERGE_HEAD`, no rebase, no unmerged paths — **NOT `*** CORRUPT`**, so no rescue script.
- [MEASURED] 13 `docs/pr-reviews/pr-*-review.md` are untracked on disk (1535, 1536, 1537, 1550,
  1554, 1559, 1562, 1566, 1568, 1569, 1579, 1585, 1589) while **59** are tracked on `origin/main`
  (`git ls-tree -r --name-only origin/main -- docs/pr-reviews/`). The directory is **not** ignored:
  `git check-ignore -v docs/pr-reviews/pr-1589-review.md` → exit 1, against the POS control
  `docs/pr-prompts/processed/…log` → exit 0 `.gitignore:76`. See F3.

## WHAT CHANGED

One board PR, **docs-only**, hand-landed. Everything below is inside `docs/`.

1. **Corrected the arming-log bullet in DOCTRINE §9.5** (`instruments v2`, a hash-gated canonical
   block) and **re-recorded both canonical hashes**:
   `node scripts/pipeline/lint-station.mjs --write-canonical` →
   `instruments v2 7ab89207dac0765c` · `station-contract v2 2f28f0f2460937c3`, exit 0.
   Read back: `node scripts/pipeline/lint-station.mjs` → **`ADMIT: all 8 docs clean`, exit 0**
   (it read `REJECT: 1 of 8` before the re-record — the expected shape for a §9-only edit).
   `git diff --numstat` on DOCTRINE = `18 3`, i.e. the intended edit and no CRLF rewrite. The file
   was edited **with node** (`readFileSync`/`writeFileSync`, utf8), never PowerShell (§9.3).
2. **Committed `docs/pr-prompts/.arming-log.txt`** — publishing the 13 arms that existed only on
   this box (F1).
3. **Deleted the spent `docs/pr-prompts/pr-lint-gate-path-space-HOLD.md`** from `main`. It was
   armed 11:29:24Z, consumed, and produced #1589; its `-HOLD` twin was still tracked, which is the
   "stays armable forever" defect. Same treatment #1584 gave the approval-receipt twin 90 minutes
   earlier.
4. **Archived two fully-dispositioned breadcrumbs** to `docs/pr-prompts/archive/`:
   `00-00-supervisor-2026-09-04-1009-*` and `00-04-scanner-2026-09-04-1011-*`. Safe for freshness —
   `check-breadcrumb.mjs` builds `trackedSet` with `git ls-tree -r` and matches by basename (§9.5).
5. This breadcrumb.

**No prompt armed. No PR merged. No label touched. No `/sot/` edit. No watcher restart.**

## FINDINGS

### F1 — S2 — The arming log is TRACKED, DOCTRINE says it is not, and 13 arms are published nowhere

DOCTRINE §9.5 has told every station since 2026-08-31 that `.arming-log.txt` is *"itself
**UNTRACKED**, so it exists on the box that armed and nowhere else; a clone, CI and any cloud-fired
station are blind to it and **must not infer arm age at all**."*

**[MEASURED] Both halves are false.** `git ls-files --error-unmatch docs/pr-prompts/.arming-log.txt`
→ exit 0 (negative control, a nonexistent path → exit 1). `git cat-file -e
origin/main:docs/pr-prompts/.arming-log.txt` → exit 0. `git log --diff-filter=A` names the commit
that added it: **`d3b603e4`, 2026-09-02, "docs(stations): retire the three untracked state files;
add vm-git-guard; **track the arming log**" (#1512)** — i.e. it was tracked deliberately, two days
before this run, and the bullet was never updated.

**And the rows already carry the actor fields.** Every line reads
`<UTC>  ARMED  <prompt>  escalates=<bool>  by=Marco@  pid=<n>  caller=powershell.exe:<ppid>`.
That is escalation **#22 option (A)** — *"make `arm-prompt.ps1` write `ARM_ACTOR` + parent cmdline
and TRACK the log"* — **already built and merged.** #22 has been carrying (A) as an open choice for
Marco; what actually remains of it is narrower (see F2).

**The live defect is worse than the one the bullet described, because it wears the same symptom.**
[MEASURED] `git show origin/main:docs/pr-prompts/.arming-log.txt` = **37 lines**, newest
`2026-09-03T03:40:31Z`; the working copy = **50 lines**, newest `2026-09-04T11:29:24Z`.
**13 arms exist on this box and nowhere else** — including all four of today's. Nothing commits the
file; the four commits that ever carried it were board PRs that happened to sweep it in. So a clone,
CI or cloud station reading it gets a **STALE** answer rather than no answer, which is the more
dangerous shape: it answers confidently, and its answer is a day and a half old. That is §9.6 with
the sign flipped — not an empty result read as an empty world, but a **partial** result read as a
complete one.

**DISPOSITION: ACTIONED.** The bullet is corrected in this PR and names its own falsifying probe
(the two-line-count comparison), as §9.5's closing rule requires. The 13 arms are committed here.
The *permanent* half — making the publish automatic — is F2.

### F2 — S3 — Nothing makes the arming log publish itself, and that is a `scripts/` change

Committing the log by hand, as this run did, fixes today and not tomorrow. RULE 1 options, complete-
and-additive first:

- **(a) `arm-prompt.ps1` commits the log line it just wrote, as part of the arm.** COMPLETE (every
  future arm publishes itself, on every box, with no run remembering to) and ADDITIVE (it writes one
  more line to a file it already writes; no prompt, gate or datum changes). Cost: the arm becomes a
  git write in the shared dev tree, so it must take the same pathspec-commit discipline every station
  already uses (`git commit -- docs/pr-prompts/.arming-log.txt`), or it will sweep in another chat's
  staged work.
- **(b) Make it a standing rule that any board PR must include the arming log.** Fails the FUTURE
  half: it is a rule in a document, and the bullet this finding corrects is the proof that a rule in
  a document goes stale in silence. It is what this run did, and it is why 13 arms accumulated.
- **(c) Do nothing; treat `origin/main`'s copy as a lower bound.** Fails the COMPLETE half. Also
  keeps escalation #22 (unattributed arms) permanently unanswerable from any tree but this one.

**DISPOSITION: ESCALATED → Marco.** (a) touches `scripts/pipeline/arm-prompt.ps1`, outside
`tests|docs`, so its PR would be his to merge in any case — and it changes what an arm *does*, which
is his call, not mine. Written to `docs/pr-prompts/needs-marco/`.

### F3 — S3 — 13 review verdicts exist only on this box, and the watcher owns that directory

[MEASURED] above: 13 untracked `docs/pr-reviews/pr-*-review.md` against 59 tracked on `origin/main`,
directory not ignored (controls quoted). DOCTRINE's own standard is *"evidence a reviewer cannot
re-open is not evidence"*, so 13 review verdicts — including #1589's **MERGE** and #1585's
**MERGE** — are currently unreadable to anyone but this machine.

**I did not commit them, deliberately.** `scripts/pr-watcher/index.mjs:706` reads
*"Move settled review verdicts (`docs/pr-reviews/pr-N-review.md` for PRs that …"* and `:617`/`:628`
state in comments that *"the verdict file in `docs/pr-reviews/` is local-only"*. The watcher
actively manages that directory's lifecycle on the assumption these files are local. Committing 13
of them is a change to an instrument's environment dressed as tidying, and the mixed regime — 59
tracked, 13 not — means I cannot tell from outside which state the watcher expects.

**DISPOSITION: DEFERRED.** What would make it urgent: any run that needs a past review verdict and
cannot find it, or a decision to make `verdictApproves` (`index.mjs:1425-1430`) read from
`origin/main` rather than the local tree. The right owner is a `scripts/pr-watcher/**` change, and
that is Marco's to merge; the question to settle first is whether `docs/pr-reviews/` is meant to be
durable evidence or a scratch area, because today it is silently both.

### F4 — INFO — Both open PRs are Marco's, and the board cannot move without him

- **#1589** `fix/lint-gate-path-space`, files `scripts/pipeline/lint-prompt.mjs` +
  `scripts/pipeline/__tests__/lint-prompt.file-gate-not-released.test.mjs`. Lane: **watcher**.
  [MEASURED] `processed/pr-lint-gate-path-space-ready.md.log` →
  `[watcher] merge result for PR #1589: {"ok":false,"marco":true,"reason":"outside tests/ or docs/:
  scripts/pipeline/lint-prompt.mjs"}`. **RULE 2 step 1 applies and binds. Not merged.** The reason
  is a genuine policy routing, not the byte-identical timeout string §10.3 warns about.
  Its review job ran and returned **MERGE** (`rev-1589-ready.md.log`) — the review-job starvation
  seen on #1580 did **not** recur.
- **#1585** `preserve/pipeline-heartbeat`, file `scripts/pipeline/check-pipeline-heartbeat.mjs`.
  Lane: **Station 00's own board PR from the 11:09Z run** — second lane, no watcher merge verdict.
  `[NO LANE VERDICT — hand-classified]`: the path is outside `^(tests|docs)/` and 00's recorded lane
  (STATION-CAPABILITIES §5) is `docs/`, so the §10.1 step-3 station-lane exception does **not**
  cover it and it falls through to step 2: **Marco's.** Not merged.

**DISPOSITION: ESCALATED → Marco** (both are already his by the rules above; recorded here so the
next run does not re-derive the classification). This is the throughput constraint stated exactly:
00 can arm, the watcher can build, CI can green — and every PR touching anything outside `tests/` or
`docs/` then stops. **Arming more now makes the queue longer, not shorter**, which is why this run
armed nothing.

### F5 — INFO — `po-vg`'s preservation condition is satisfied, but the standing rule needs tightening

[MEASURED] `preserve/pipeline-heartbeat` exists on the remote at `74528743`; `po-vg` still holds the
untracked `check-pipeline-heartbeat.mjs`. The standing memory rule — *"nobody prunes `po-vg` until
`preserve/pipeline-heartbeat` is confirmed to still exist"* — is **satisfied as written**.

**But as written it is not enough.** If #1585 is ever CLOSED UNMERGED and its branch deleted, the
branch and the worktree both go and the file is gone again — which is escalation #14's shape exactly
(*the branch IS the only copy*). **The correct condition is stronger: prune `po-vg` only once
`scripts/pipeline/check-pipeline-heartbeat.mjs` is on `origin/main`** (probe:
`git cat-file -e origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs`, control `CLAUDE.md`).

**DISPOSITION: DISPATCHED → Station 03.** Worktree hygiene is 03's lane. Along with it: the three
orphaned worktrees (`C:/po-1483-fix` 3470 min, `C:/po-guard` 725 min, `C:/po-sa-fix` 1832 min,
`C:/po-work/s2-e2e` 3598 min, all `dirty=0`) and the two registry escapees
(`C:\po-worktrees\fix-1523`, `C:\po-worktrees\vs-s2-durable-smoke`, both 0KB, no `.lock`).
**`git status --porcelain` inside each before pruning** — that is the probe four runs named and
none ran, and it is how `po-vg` nearly lost the outage detector.

### F6 — INFO — Station 04's 10:11Z breadcrumb is fully collected

- **F1 (spaced gate path reported ABSENT)** — **ACTIONED** by the 11:09Z run: staged prompt armed
  11:29:24Z, consumed, PR **#1589** open and green. Option (a), the complete-and-additive one 04
  recommended, is what shipped.
- **F1a (RULE 1 options)** — carried into #1589's own body; nothing left to do.
- **F2 (`pr-claudedesign-s2-spec-regeneration-plan-HOLD.md` masked by the broken gate)** —
  **DEFERRED** until #1589 is on `main`. 04 explicitly forbade hand-promoting it, and it is right:
  promoting it now substitutes my reading for the instrument the fix exists to repair. What makes it
  actionable: `git cat-file -e origin/main:scripts/pipeline/__tests__/lint-prompt.file-gate-not-released.test.mjs`
  → exit 0, then re-lint that prompt.
- **F3 (the other 13 `requires_*` gates honest)** — **ACTIONED** by 04; verified clean, nothing owed.

Archived to `docs/pr-prompts/archive/` in this PR.

## WHAT I DID NOT DO

- **Armed nothing.** armed=0 was true at 12:10Z and at 12:2xZ. With two green PRs already parked on
  Marco and the watcher idle, another `scripts/` arm adds a third (F4). The one prompt whose gate is
  genuinely satisfied — `pr-claudedesign-s2` — is held by 04's explicit instruction until #1589 lands.
- **Merged nothing.** #1589 carries a live `marco:true` verdict (RULE 2); #1585 hand-classifies to
  Marco. Neither is mine, whatever their colour.
- **Did not commit the 13 untracked `docs/pr-reviews/` files** (F3) — the watcher owns that
  directory's lifecycle and I could not establish from outside which regime it expects.
- **Did not touch `C:/po-vg`, the three orphaned worktrees or the two registry escapees** — 03's
  lane, and the sweep's CAUTION names `po-vg` live.
- **Did not clear the `[STALE]` `needs-marco/` lines** the sweep flagged. The standing instruction
  not to is deliberate: §5 tags a file DEAD merely for CITING a merged PR, and it currently tags
  `station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md` — escalation #23 itself, which
  is open and unanswered.
- **Did not touch** `/sot/`, Azure / Entra / SharePoint, production data, the watcher process, the
  watcher clone's git, or any `*-ready.md`.
- **Did not restart the watcher.** pid 20000 alive, wrapper alive, queue empty — an idle watcher
  with 0 armed prompts is CORRECT, not wedged.
