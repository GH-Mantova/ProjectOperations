# Station 00 — Supervisor | 2026-08-31T04:08Z–04:2xZ

## GROUND

```
UTC            2026-08-31T04:08:50Z
origin/main    f63e1ade            (fetched, then rev-parsed)
dev tree       main @ f63e1ade      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — full authority run, not read-only.

**Not blind.** `start_process` shell `powershell.exe` returned PID 22020 on the first call. Every
`[MEASURED]` line below is a real Windows-side probe.

**Freshness of the binding docs.** The station doc says read all three from `git show origin/main:`,
never the working copy. I read the working copy and then PROVED it identical:
`git diff --stat origin/main -- <path>` returned **empty** for all three of
`docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md`,
`docs/pipeline/STATION-CAPABILITIES.md`. `[MEASURED]`

## WHAT I MEASURED

**Sweep.** `scripts/pipeline/status-sweep.ps1`, 04:09:24Z and 04:09:59Z. Section 0 positive controls
both `[LIVE]` (gh reached GitHub, node runs). **Verdict: SAFE TO ACT** — no board mutation in
progress, no remote activity in 2 min, 0 git processes, no `index.lock` in either tree. `[MEASURED]`

**Board at 04:09Z.** OPEN PRs **0**. Merged since my last run: #1420 (02:57Z), #1421 (03:12Z),
#1422 (03:15Z), #1423 (03:31Z) — plus #1417 and #1418 which were in flight when I last reported.
main CI last 3 runs 3 success. `[MEASURED]`

**Board at 04:12Z — it moved under me.** The watcher consumed
`pr-estpricing-s1b-snapshot-reaches-pricing-ready.md` at 04:11Z and opened **#1424**, so the board
went 0 open → 1 open *inside this run*. This is 04's FINDING 8 happening again, and it is why the
END STATE block at the bottom of this report exists. `[MEASURED]`

**Breadcrumb validators.** `node scripts/pipeline/check-breadcrumb.mjs` → `structure: 3 checked,
0 malformed`, **CLEAN, exit 0**. `--freshness` → **CLEAN, exit 0**; 00 2.0h / 03 5.2h / 04 2.0h /
05 14.0h, all inside 2× cadence. `[MEASURED]`

**06 still has no cadence — measured, not predicted.** `--freshness` prints a line for 00, 02
("dispatch-only — no cadence to miss"), 03, 04 and 05, and **none for 06**. Third consecutive run
with the same reading. `[MEASURED]`

**The conflict in #1424, root-caused before touching it.** `git merge-base origin/main
origin/pr-1424` = `acfce68d` (#1420). main has since gained #1421, #1422, #1423. `git merge-tree
--write-tree` named exactly **one** conflicted file,
`apps/api/src/modules/rates/rate-resolver.service.ts`, **one** hunk. `[MEASURED]`

**The conflict was mechanical, and I proved it rather than asserting it.** #1421 (est-s1) put a
snapshot check at the top of `resolveRate`; #1424 (est-s1b) implements snapshots in a *different
method*, `listRates`, and only adds the `tenderId` param to `resolveRate` — it never reads
`options.tenderId` inside `resolveRate`. So one side of the hunk was empty. After resolving,
`git diff --numstat origin/pr-1424 -- <file>` = **142 additions, 0 deletions**: a pure union that
removes nothing the PR wrote. `git diff --numstat origin/main -- <file>` = 152/17, the PR's own
`listRates` work intact. `[MEASURED]`

Encoding controls on the resolved file, because this file was edited by a script: **0** `U+FFFD`,
**0** occurrences of the `U+00E2 U+20AC U+201D` double-encode signature, indentation intact, and the
`──` box-drawing run reads correctly through `node`. The `â"?` rendering seen in the PowerShell
console is DOCTRINE §9.3's false mojibake — the reader, not the file. `[MEASURED]`

**The one red on #1424, read from the job log and not from the diff.**
`gh api repos/.../actions/jobs/99379515943/logs` (the `gh run view --log` form refuses while the run
is in progress — that is an instrument limit, not a result):

```
PASS - CP-11 migrations   PASS - CP-12 env-vars   PASS - CP-13 dependencies
PASS - CP-17 dto-validation   PASS - CP-23 seed-without-migration
PASS - CP-24 sot-purity   PASS - CP-25 failure-honesty
SKIP - CP-09/10 scope     SKIP - CP-22 verification-checklist
FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true).
       A human must review and REMOVE the label; removing it is what releases the merge.]
##[error]Process completed with exit code 1.
```

`[MEASURED]`

**RULE 4 arming detector, all three instruments, before arming anything.** `[MEASURED]`

1. `lint-prompt.mjs` on `pr-watcher-verdict-sweep-skips-tracked-HOLD.md` → **ADMIT, exit 0**;
   negative control `pr-dns-s5-checker-flip-to-fail-HOLD.md` → **REJECT `[HUMAN_GATE_PRESENT]`,
   exit 1**, matching `<!-- watcher: do-not-arm -->`. The linter can say no.
2. Union grep, **case-sensitive**, over `pr-*.md`: 12 hits across 7 prompts. Positive control
   `pr-524-rates-b-slice2-canonical-HOLD.md` **fires**; the target appears **0** times.
3. Read the body by eye for a *prose* gate, which matches neither regex. None. `escalates: false`,
   `size: 3`, no `requires_merged`, no `requires_file_on_main`, scope confined to
   `scripts/pr-watcher/**`.

Premise verified live rather than trusted: `git show origin/main:scripts/pr-watcher/index.mjs |
grep listTrackedVerdicts` → **0**, with positive control `archiveSettledVerdicts` → **6**. An empty
result from a query proven able to return non-empty. Not shipped.

**Clone health.** `C:\po-watcher\ProjectOperations`: dirty **38**, stash **54**. Both below the
urgency thresholds 04 set (45 deletions / 60 stash). Watcher node **6388** RUNNING, wrapper alive,
heartbeat 1 min. `[MEASURED]`

**Two claims in project memory, re-checked and DISCHARGED.** `[MEASURED]`

- The DOCTRINE §9.5 block-scalar rubber-stamp warning. **#1414 MERGED 01:21:53Z**;
  `foldBlockScalar` is present on `origin/main` in `lint-prompt.mjs`; and DOCTRINE's own "the fix is
  staged as `pr-lint-frontmatter-block-scalar-collapse-HOLD.md` (ADMIT)" sentence returns **0** hits
  on main — already corrected. Memory still carries "#1414 IS MARCO'S — DO NOT MERGE"; Marco merged
  it. Stop repeating that line.
- 04's FINDING 7 said "`archive/` holds 64 **ignored** ones". `git check-ignore -v` on a FILE inside
  it exits **1** (not ignored) and `git ls-tree -r origin/main -- docs/pr-prompts/archive/` returns
  **215 tracked** files, against a queue-root positive control of 581. `docs/pr-reviews/` is
  likewise not ignored. Committing to either path is safe; I did.

## WHAT CHANGED

**1. Cured the consumed-prompt staged `R100` — the FOURTH occurrence.** `git status` showed
`RD docs/pr-prompts/pr-crm-s6-account-360-rollups-HOLD.md -> ...-ready.md` with **no file on disk**
(both `Test-Path` → False): the watcher had consumed it into #1423. A pathspec-less commit by any
chat would have published an armed prompt to main. Cure: `git restore --staged <HOLD> <ready>`.
Read back: staged set **empty**, `RD` → ` D`, armed count **unchanged**.

**2. Resolved #1424's conflict and unfroze its CI.** In a disposable worktree
(`C:\po-worktrees\sup-0413`, its own index — the shared dev-tree index was never touched), merged
`origin/main` **into** the PR branch — a merge commit, never a rebase, because a force-push is
DOCTRINE §5.4 irreversible and not an agent's call. Resolved the single hunk by keeping main's
snapshot block, with the proof quoted above. Pushed `2d8b66af..3662de95` to
`feat/estimating-pricing-snapshot-list`.

Read back: `mergeable` **CONFLICTING → MERGEABLE**, `mergeStateStatus` **DIRTY → BLOCKED**
(BLOCKED = the `do-not-merge` label, which is correct and is Marco's to clear). CI, which is frozen
on a DIRTY branch, is now running: Changed-path filter, raw-error-envelope gate, data-model
generator sanity and pipeline linter tests all **pass**.

**3. Armed exactly one prompt: `pr-watcher-verdict-sweep-skips-tracked`.** Via
`scripts/pipeline/arm-prompt.ps1` (the serialized wrapper with the OS file lock), not a bare
`git mv` — `-WhatIf` first, exit 0, then for real, exit 0. Read back: `-ready.md` on disk **True**,
`-HOLD.md` **False**, index contains **exactly** the two expected paths, audit line written to
`.arming-log.txt` at 04:19:51Z.

Prompt arms = **1**. The queue also holds `rev-1424-ready.md`, which is an auto-generated REVIEW JOB
(DOCTRINE §9.5) with no front matter by design — it is not a prompt arm and must not be counted as
one. RULE 4 is satisfied.

**4. This board PR** — collect, archive and the untracked backlog:

- committed 04's untracked prompt `pr-statussweep-orphan-worktree-dirs-HOLD.md` (its FINDING 1
  dispatch), its `docs/pipeline/sweep-rotation.json` advance, and its breadcrumb;
- committed two untracked review verdicts, `docs/pr-reviews/pr-1416-review.md` and
  `pr-1420-review.md`, which a `git stash --include-untracked` on the next watcher start would have
  swallowed;
- committed the two consumed-prompt deletions, `pr-crm-s4-no-history-proposal-HOLD.md` (its PR
  #1417 merged 02:31Z, so it is free now — it was not last run) and
  `pr-crm-s6-account-360-rollups-HOLD.md` (#1423, merged 03:31Z);
- archived the three dispositioned breadcrumbs into `docs/pr-prompts/archive/`, leaving only this
  run's at depth 1;
- committed the arming rename.

Built in `C:\po-worktrees\sup-0413b`, off `origin/main`, with its own index. Both worktrees are torn
down at the end of this run.

## FINDINGS

### F1 — #1424's only red is CP-26, and that is new evidence for a question already on Marco's desk

Every real gate passes or legitimately skips. The check fails because the PR carries
`do-not-merge`, which is the human gate doing its job. Nothing here is broken.

But this run **measures** the thing the open CP-26 escalation asks about. Project memory records
CP-26 as *"a STEP inside `PR gates — diff checks`, not a check run — machine-VISIBLE, not
machine-BLOCKING (#1369 merged wearing it)"*. The log above shows the step exits the whole job
**1**, so the parent check renders **fail**. Both are true at once, and together they are the
problem: every `escalates: true` PR now shows a permanently red gate check that nobody may clear,
and #1369 proves the red does not actually block a merge. That is a check that is red when nothing
is wrong — which trains readers to skim past a red gate on exactly the PRs that most need reading.

RULE 1, complete-and-additive FIRST:

- **(A) Give CP-26 its own check run, separate from `PR gates — diff checks`.** The label stays
  visible as its own red context; the diff-gate check goes green when the diff gates pass, so a red
  there means a real gate failed. Solves it immediately (a reviewer can tell the two apart today)
  and permanently (no future gate is masked by the label), and it damages no data — it only adds a
  context. Needs Marco only if the new context must be added to the ruleset.
- **(B) Make CP-26 a required context.** Honest about intent, but it fails *complete*: the diff
  gates and the human gate stay fused, so a genuine CP-11 failure on an escalating PR still cannot
  be seen without opening the log.
- **(C) Make CP-26 advisory — warn, do not exit 1.** Fails *complete* in the other direction: the
  label stops being visible in the checks list at all, and a `do-not-merge` PR looks fully green.

**ESCALATED** → Marco. This is the ruleset question already open; the new fact is that CP-26 turns
the whole diff-gate check red, so the choice is not cosmetic.

### F2 — est-s1 and est-s1b were in flight at the same time, on the same file, and the conflict was arithmetic

`pr-estpricing-s1b` was armed and running at 03:09Z while `#1421` (est-s1) was still open; #1421
merged at 03:12Z, three minutes later. Both slices edit
`apps/api/src/modules/rates/rate-resolver.service.ts`. A conflict was not bad luck — it was
guaranteed the moment the second slice of a same-file cluster started before the first landed.

The prompt's own gate did not prevent it: `requires_merged` is checked when the prompt is *armed*,
and the watcher then works for minutes to hours. The gap between "gate satisfied" and "branch cut"
is where this lives.

**DEFERRED** — real, and cheap to work around by hand (I resolved it in one hunk in ten minutes), so
it does not justify burning an agent run yet. It becomes urgent the moment a same-file cluster is
armed while its predecessor is open *and* the conflict is semantic rather than a clean union — at
that point the resolution stops being provable and becomes a judgement call about pricing code,
which is not an agent's to make. The cheap partial cure available today costs nothing: do not arm
slice N+1 of a same-file cluster until slice N is on `origin/main`, not merely green.

### F3 — the consumed-prompt `RD`, cured a fourth time, is steady state

Fourth cure in roughly six hours (crm-s4 00:1xZ, block-scalar 00:5xZ, crm-s4 again 02:1xZ, crm-s6
now). The pattern is fully characterised and the cure is one command. What is missing is a probe
that catches it without a supervisor looking.

**DEFERRED** — the dispatch to 04-scanner (add a `status-sweep.ps1` §3 probe for any staged `R…`
under `docs/pr-prompts/` whose target is absent from disk) was made last run and 04 is on a 4h
cadence, last run 02:10Z. It is waiting correctly, not overdue. **Do not re-dispatch it.** It
becomes urgent if a fifth occurrence lands *inside a commit* rather than being caught staged.

### F4 — 04's FINDING 3 asked for the verdict-sweep fix to be armed. It is armed.

The verdict-archive loop 04 measured climbing (35 → 37 tracked deletions, stash 54) now has its fix
in the queue as `pr-watcher-verdict-sweep-skips-tracked-ready.md`. Current reading 38 dirty / 54
stash, both under 04's thresholds, so the arm happened before the deadline rather than after it.

**ACTIONED** — armed this run, read back, one at a time, with the full detector quoted above.

### F5 — 04's FINDINGS 4 and 5 are Marco's, unchanged, and I am carrying them forward verbatim

21 settled remote branches (20 CLOSED-and-unmerged, 1 MERGED) plus three abandoned worktree
directories totalling 56.2 MB that `git worktree prune` cannot reach. 04's RULE 1 options stand as
written: **(A)** `git fetch --prune` locally and touch no remote branch — complete and additive;
**(B)** (A) plus deleting the single MERGED branch `docs/retire-stale-queue`; **(C)** bulk-delete
all 21 — fails the second half outright, because twenty of them are the only surviving copy of
unmerged work.

**ESCALATED** → Marco, unchanged. May Station 00 run (A) and (B) as standing hygiene, and should the
twenty CLOSED branches be kept indefinitely or given a retention rule? No agent bulk-deletes, and
04 could not prove the worktree directories hold no uncommitted work — it said `[CANNOT MEASURE]`
rather than guessing, which is the standard.

### F6 — 06's F4: nothing in this repo can read `RATES_CANONICAL_SOURCE`, and that gates verification, not arming

`rate-resolver.service.ts` forks on it and the default is `legacy`. Reading an App Service setting
is the absolute Azure hard stop. 06 already made the prompt correct for either setting, so this no
longer blocks arming — it decides how est-s1 and est-s1b are *verified* once they land, and which of
the two `resolveRate` branches production actually executes.

**ESCALATED** → Marco, unchanged. Read `RATES_CANONICAL_SOURCE` on the App Service. Unset or
`legacy` means production prices through `tryLegacy` first and the snapshot precedence is the whole
ballgame; `ratetable` means the cutover is live and two follow-ons change status
(`pr-524-rates-b-slice2-canonical`'s arm gate becomes checkable, and
`pr-rates-s11c-drop-legacy-tables` moves from theoretical to real). Neither is armed and neither
should be without that log evidence.

### F7 — 06 has no cadence, so "DISPATCHED → 06" is still an address with no delivery

`check-breadcrumb.mjs --freshness` prints a cadence line for 00, 02, 03, 04 and 05 and none for 06.
Measured a third time. A disposition addressed to 06 parks; it does not close.

RULE 1: **(A) give 06 a 12h cadence** — complete (the address starts delivering) and additive (it
adds a schedule, changes no lane, and re-merges nothing); **(B)** ban future-run addressees, which
fails *complete* because the work still has no owner; **(C)** 00 absorbs it, which fails *complete*
and re-merges post-LL-38 lanes. This is the specific half of the broader "a disposition addressed to
a FUTURE RUN has no owner, no deadline and no instrument" question, and the two should be decided
together.

**ESCALATED** → Marco, unchanged, third run running.

### F8 — a PowerShell parse trap that nearly published a wrong claim about main

`git log --oneline (git merge-base origin/main $h)..origin/main` **returns empty**. PowerShell
evaluates the parenthesised call and then treats `..origin/main` as a separate argument, so git
never receives a range — and an empty commit list reads exactly like "main has not moved since the
branch was cut". I nearly wrote that down. It was caught by asking `git rev-parse origin/main` and
`git log --oneline -5 origin/main` directly, which showed three commits the first form had hidden.

Same shape as everything in DOCTRINE §9.6: a query that answered confidently and wrongly, at exit 0.
The cure is to build the range as a string first, or to ask for the two SHAs separately and compare
them. Adding it here rather than to §9 because it cost this run four minutes and no work — a §9
entry should be earned by a measured cost across more than one run.

**ACTIONED** — recorded; no code to change.

### F9 — 04's FINDING 8 is right, and this report adopts it

A station that stamps `origin/main <SHA>` at minute 0 and reports at minute 20 has been quoting an
expired verdict. This run watched the board go from 0 open PRs to 1 between 04:09Z and 04:12Z, which
would have inverted "the board is empty" into a falsehood had I stamped once and stopped looking.

**ACTIONED** — the END STATE block below re-reads `origin/main` and says whether it moved. Cheap,
and it costs one command.

## WHAT I DID NOT DO

- **Did not merge #1424, and did not touch its `do-not-merge` label.** The watcher routed it to
  Marco (`{"ok":false,"marco":true,...}`) and it is `escalates: true`. RULE 2 and the label are two
  independent gates and both are Marco's. Driving it green is mine; merging it is not.
- **Did not rebase or force-push.** #1424 was updated with a merge commit. A force-push is
  DOCTRINE §5.4 irreversible.
- **Did not resolve anything I could not prove.** The single hunk was a union with one empty side,
  demonstrated by `+142/-0` against the PR's own blob. Had both sides carried content, this would
  have been a judgement call about pricing code and I would have escalated it instead.
- **Did not arm a second prompt.** RULE 4 is one at a time. `pr-statussweep-orphan-worktree-dirs`
  is committed and armable, and it is the next arm behind the verdict-sweep fix.
- **Did not touch the watcher clone's git**, did not FF it, did not drop or pop a stash. Whether 00
  may FF the clone is itself an open escalation; 03 is report-only. Read-only `git -C` status and
  stash-list counts only.
- **Did not run `git checkout` / `reset --hard` / `stash pop` / `clean` anywhere**, and did not run
  `git` through the device bridge against the Windows `.git`.
- **Did not touch `/sot/`, Azure / Entra / SharePoint, or production data.**
- **Did not disarm or touch another actor's work**: the `pr-rates-column-edit-ui-HOLD.md`
  uncommitted `+5/-1` edit in the shared dev tree is not mine, and
  `docs/data-model/metadata-catalog.json`'s line-ending-only modification is not mine. Both left
  alone.
- **Did not clear the 14 `needs-marco/` entries** (13 of which the sweep marks `[STALE]` against
  merged PRs), `no-pr-opened/` 107, or `failed/` 41. Those are a separate, larger cleanup and not
  this run's named work.

## END STATE — re-stamped at the end of the run, per 04's FINDING 8

```
UTC            2026-08-31T04:2xZ
origin/main    f63e1ade   — UNCHANGED since the GROUND stamp
dev tree       main @ f63e1ade
open PRs       1  (#1424, MERGEABLE, BLOCKED by do-not-merge — Marco's)
prompt arms    1  (pr-watcher-verdict-sweep-skips-tracked-ready.md)
watcher        node 6388 RUNNING, wrapper alive
clone          dirty 38 / stash 54  (under 04's 45 / 60 thresholds)
```

The board moved once during this run (0 → 1 open PR at 04:11Z). `origin/main` did not.

---

## CORRECTION, 04:2xZ — "prompt arms = 1" was true when measured and false seven minutes later

Recording this rather than editing the claim away, because how it stopped being true is the finding.

**What I wrote:** *"Prompt arms = 1"*, read back at 04:19:51Z immediately after arming
`pr-watcher-verdict-sweep-skips-tracked`, with `arm-prompt.ps1`'s own index guard confirming the
queue held nothing else.

**What is true at 04:26:37Z:** `Get-ChildItem docs\pr-prompts -Filter *-ready.md` returns **two** —
mine, and `pr-scopesub-s1-one-discipline-list-ready.md`. `[MEASURED]`

`pr-scopesub-s1` was **absent** from the same query at 04:19:51Z and present at 04:26:37Z, so it was
armed by another actor inside that seven-minute window. It is a legitimate arm: one of the three
ungated ADMIT heads from 06's 01:37Z cluster, `escalates: false`, and its scope (scope-sub
discipline lists) is disjoint from mine (`scripts/pr-watcher/**`), so the same-file race in F2 does
not apply here.

### F10 — `.arming-log.txt` is not an arm census, and I nearly used it as one

The other arm has **no entry** in `.arming-log.txt`: `Select-String -SimpleMatch 'scopesub'` → **0**,
against a positive control of my own arm → **1**. It was armed by a bare `git mv`, which
`arm-prompt.ps1`'s own header calls a defect precisely because it writes no audit line and takes no
lock.

So the log records only the arms made through the wrapper. Anyone auditing "how many prompts are
armed, and who armed them" by reading it gets a confident, coherent, incomplete answer — DOCTRINE
§7's shape exactly. **The only sound census is the filesystem** (`Get-ChildItem *-ready.md`,
excluding `rev-<n>-ready.md` review jobs per §9.5); the log answers a narrower question — "which
arms went through the wrapper" — and must be quoted as that.

This also means **RULE 4 cannot be enforced by reading the log.** Two prompts are armed right now
and the log shows one.

**ESCALATED** → Marco, RULE 1, complete-and-additive FIRST:

- **(A) Make the bare `git mv` route impossible: a pre-commit / guard hook that refuses a staged
  `*-HOLD.md → *-ready.md` rename with no matching `.arming-log.txt` line.** Complete — every future
  arm is logged whoever makes it, so the log becomes the census it is already read as. Additive — it
  blocks nothing that goes through `arm-prompt.ps1`, deletes nothing, and changes no existing arm.
  A guard hook already exists at `.claude/hooks/guard.mjs`, so this adds a rule rather than a
  mechanism.
- **(B) Leave the route open and fix the readers** — teach every station that the log is partial.
  Fails *complete*: it depends on every future reader remembering, which is the failure mode that
  produced this line.
- **(C) Accept two concurrent arms as normal and retire RULE 4's one-at-a-time.** Fails *complete*
  in a different way — it does not damage data, but it removes the gap in which a slice is verified
  and the clone fast-forwarded before the next one starts, which is what RULE 4 buys.

**I disarmed neither prompt.** Disarming another actor's deliberate arm destroys their work — the
lesson from my own 02:08Z run — and disarming mine would need a second PR to revert a rename already
on `main`. Both are `escalates: false`, non-destructive, and disjoint in scope, so the cost of
leaving both is that two prompts run back to back without a verification gap, not a collision.

### Corrected END STATE

```
UTC            2026-08-31T04:2xZ
origin/main    c109cf09   (moved f63e1ade → c109cf09 when #1425 merged at 04:25:47Z)
dev tree       main @ c109cf09   — fast-forwarded, untracked-breadcrumb backlog now ZERO
open PRs       1  (#1424, MERGEABLE, BLOCKED by do-not-merge — Marco's)
prompt arms    2  (mine: pr-watcher-verdict-sweep-skips-tracked; another actor's: pr-scopesub-s1)
watcher        RESTARTED ~04:25Z; startup verdict-archive sweep archived=37 kept=1
```

The watcher restart at 04:25Z is the loop the prompt I armed exists to close: `archived=37` on a
startup sweep, which is exactly the tracked-file count that makes the clone dirty at every launch.
