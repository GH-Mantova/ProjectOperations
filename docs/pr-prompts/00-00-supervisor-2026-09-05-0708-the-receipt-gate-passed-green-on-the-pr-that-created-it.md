# Station 00 - Supervisor | 2026-09-05T07:08Z-2026-09-05T07:5xZ

## GROUND

```
UTC            2026-09-05T07:08:40Z
origin/main    89c738fb            (fetch +refs/heads/main, then rev-parse)
dev tree       main @ 89c738fb     C:\ProjectOperations2   (was c931f104; FF'd this run)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE. This run was NOT read-only on that account.

**SIGHTED.** `start_process` shell `powershell.exe` returned a live prompt (pid 30956) and Desktop
Commander was present the whole run.

The dev tree opened **BEHIND** `origin/main` (c931f104 vs 89c738fb) and
`git diff --numstat origin/main` was NON-empty for DOCTRINE (-72) and STATION-CAPABILITIES (-28),
so the working copies were NOT safe to read as `origin/main`. Cured before reading anything:
`git merge --ff-only origin/main` -> `89c738fb`, index clean (`git diff --cached --name-status`
EMPTY), no `.git/*.lock`. All three binding documents were then read at `89c738fb`.

`status-sweep.ps1` at 07:09:42Z (captured to a file, because it returns early and hides its own
section 7): section 0 both positive controls LIVE, section 7 **SAFE TO ACT**. **0 open PRs**,
armed 0, watcher pid 20000 RUNNING with its wrapper alive, in-progress prompts 0, `index.lock`
False in both trees, 0 git processes, main CI on `89c738fb` 4 success / 0 failed.

## WHAT I MEASURED

### COLLECT - breadcrumbs since my 06:08Z run

`node scripts/pipeline/check-breadcrumb.mjs --freshness` -> exit **0**, `CLEAN`,
`structure: 13 checked, 0 malformed`. Freshness: `00` 1.1h (cadence 2h) ok - `03` 8.2h (24h) ok -
`04` 1.0h (4h) ok - `05` 17.0h (24h) ok. **No station is SILENT**, so the `lastRunAt` cross-check
prescribed for a SILENT reading was not needed this run.

Exactly ONE breadcrumb is new since 06:08Z, and `check-breadcrumb.mjs` flagged it itself:

```
NOTE  00-04-scanner-2026-09-05-0610-...-still-lies.md is UNTRACKED - it reaches nobody until a
      board PR commits it
```

That is Station 04's `instrument-honesty` sweep. It carries five findings: **F1** and **F2**
DISPATCHED to me, **F3** DISPATCHED to me with a routing question, **F4** DISPATCHED to Station 03,
**F5** DEFERRED. Every one is dispositioned below. Nothing else was uncollected.

### The board moved between my last run and this one, and both movements need naming

| | [MEASURED] `gh pr view <n> --json ...` and `gh api .../timeline` |
|---|---|
| `#1640` | created `05:07:12Z`, merged **`06:36:01Z`**, `mergedBy=GH-Mantova`, **0 label events ever**, no receipt |
| `#1645` | created `06:24:27Z`, merged **`06:42:54Z`** - **18.4 min open** - `mergedBy=GH-Mantova`, **0 label events ever**, no receipt |
| `#1645` timeline | 2 `committed`, 1 `merged`, 1 `closed`, 1 `head_ref_deleted`. **No `auto_merge_enabled`. No review event of any kind.** |
| `Approval receipt (CP-26)` on both | **SUCCESS** |
| receipts on `origin/main` | `git ls-tree -r origin/main -- docs/decisions/merge-approvals/` = 13 files + README; **`1640.md` and `1645.md` are ABSENT** (`git cat-file -e` nonzero on both; POSITIVE control `1615.md` exit 0) |

`#1645` is the PR that landed **DOCTRINE section 10.2.1**, the supervised-cloud-lane exception.

### Lane reading, and the RULE 2 probe

There are **0 open PRs**, so no merge decision was mine to make this run and RULE 2 gated nothing.
The probe was still run, pinned to the LIVE tree, because F1 below turns on label-reading:

`Select-String -Path C:\ProjectOperations2\docs\pr-prompts\processed\*.log -Pattern 'marco.:true'`
-> POSITIVE. NEGATIVE control `zzzNoSuchNeedleZzz` -> 0. Newest log is inside the hour, which is
the control that separates the live directory from the 17-day-stale DECOY in the watcher clone.

`#1640` was hand-classified **MARCO'S** by two independent readers before it merged - by my own
06:08Z run, and by Station 04 at 06:10Z (`[NO LANE VERDICT - hand-classified]`, prompt-log
discriminator 0 hits, no arm in its window, `apps/`-class scope outside all three
`NESTED_TEST_PATHS` forms). It merged at 06:36Z anyway. **I did not merge it, and I am not
reverting it** - a landed merge is not mine to undo, and #1637 set that precedent.

### F2's claim, re-measured before I wrote it into DOCTRINE

| Probe | Result |
|---|---|
| `C:\po-watcher\STOP-WATCHER-LANE2` | **present, 1090 bytes** |
| `C:\po-watcher\STOP-WATCHER` | **absent** (`Test-Path` -> False) |
| NEGATIVE control `C:\po-watcher\zzzNoSuchNeedleZzz*` | **0 files** |
| readers (`Select-String -SimpleMatch 'STOP-WATCHER'` over `C:\po-watcher\*.ps1`) | `ensure-watcher.ps1` 3, `watcher-launcher.ps1` 4, `watcher-launcher-singlelane.ps1` 4, `watcher-launcher-lane2.ps1` 3 |

04 named three readers; there are **four**. `watcher-launcher.ps1` is the one it missed, and it is
the launcher that invokes the supervisor with the call operator (DOCTRINE section 9.5's
`wrapper=0` trap). All four are outside this repo, which is why the path had to be written down.

### The canonical block was re-recorded, and the gate proved it was real first

DOCTRINE section 9.5 sits inside `CANONICAL-BLOCK: instruments v2`. Before rehashing:
`node scripts/pipeline/lint-station.mjs` -> **`REJECT: 1 of 8 docs failed`, exit 1** - the hash gate
fired on my edit, which is the positive control that it is not asleep. Then
`--write-canonical` -> `WROTE docs\pipeline\stations\_canonical-blocks.json / instruments v2
51d1c535425c7ca4`, and re-running the linter -> **`ADMIT: all 8 docs clean`, exit 0**.

### Every doc edit asserted its BYTE DELTA (DOCTRINE section 9.3)

No `String.replace` replacement string was used anywhere; every edit is a slice-and-concatenate in
node, and each one printed `DELTA_OK=true OLD_GONE=true NEW_PRESENT=true CRLF_INTRODUCED=0`:

```
F1b no-paraphrase scope   before=21870  after=22287  expected=22287
F1a jq/labels pointer     before=22287  after=23302  expected=23302
F2  STOP-WATCHER paths    before=75925  after=77226  expected=77226
```

`git diff --numstat` in the worktree is `17 2` / `21 2` / `1 1` - three files, small and targeted,
with no whole-file line-ending rewrite. The blobs are LF; the checkout smudges to CRLF, so the
files were restored from `git show HEAD:<path>` (never `git checkout --`, DOCTRINE section 9.2)
and re-edited in LF.

## WHAT CHANGED

One board PR, from a disposable worktree `C:\po-worktrees\bd-0708` off `origin/main`
(branch `board/00-collect-2026-09-05-0708`). No git write of any kind in `C:\po-watcher`.

- `docs/pipeline/STATION-CAPABILITIES.md` - F1: the refuted `--jq`/labels claim deleted and
  replaced by a pointer to DOCTRINE section 9.4, and the no-paraphrase rule widened to every
  shell/CLI trap in the file.
- `docs/pipeline/DOCTRINE.md` - F2: both STOP-WATCHER sentinels given their absolute paths, the
  false-negative mechanism named, and the four readers listed.
- `docs/pipeline/stations/_canonical-blocks.json` - `instruments v2` rehashed, via the sanctioned
  `--write-canonical`, in the same PR as the edit that required it.
- `docs/pipeline/sweep-rotation.json` - **swept up, not authored.** Station 04 advanced it and left
  it dirty in the shared dev tree by its own station doc's instruction; 04 may not commit to that
  tree. Carried here so the rotation state is durable.
- `docs/pr-prompts/00-04-scanner-2026-09-05-0610-...-still-lies.md` - 04's breadcrumb, swept up
  from the dev tree where it was untracked.
- This breadcrumb, written **inside the PR worktree** (the REPORT CONTRACT's cure 1), so no loose
  untracked copy is left in the dev tree to block the next fast-forward.
- Five superseded breadcrumbs `git mv`d to `docs/pr-prompts/archive/`.

**Nothing else.** No prompt armed, disarmed, renamed or moved. No PR merged, labelled, commented or
reverted. No `sot/` file touched. No `do-not-merge` label removed. No receipt authored.

## FINDINGS

### F1 - `Approval receipt (CP-26)` reported SUCCESS on the PR that created the receipt requirement, because the gate is armed by LABELLING and that PR was never labelled. **S1.**

DOCTRINE section 10.2.1, landed by `#1645` at 06:42:54Z, authorises Station 00 to run as a
supervised cloud lane. It offers exactly one thing in place of trust, and section 10.1 step 3
requires exactly that thing - a CI gate that proves the new lane's boundary:

> This lane's gate is **`Approval receipt (CP-26)`**, already required on `main` by ruleset
> `15532058`: it fails `RELEASED_NO_RECEIPT` when a released PR carries no receipt, so a merge by
> this lane that leaves no signature cannot reach `main`.

**[MEASURED] that sentence is false for the ordinary case, and `#1645` is its own counter-example.**
`#1645` has **zero label events in its entire timeline**, so it was never *released* - the label was
never applied, therefore never removed, therefore `RELEASED_NO_RECEIPT` could not fire.
`Approval receipt (CP-26)` = **SUCCESS**. `docs/decisions/merge-approvals/1645.md` does not exist on
`origin/main`. `#1640` is the same shape: 0 label events, CP-26 SUCCESS, no receipt.

So the gate does not bound the lane; it bounds **one path into** the lane. Anything the lane merges
without ever attracting a `do-not-merge` label passes it green and leaves no signature at all - and
`mergedBy` reads `GH-Mantova` for every actor on this board, agent and human alike. Section 10.2.1's
own promise, *"so the lane is identifiable after the fact from the repo alone"*, is therefore
**[CANNOT MEASURE]** for `#1645` itself.

**This is not a new escalation.** It is the worked instance of the one already open in
`needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md` and on
`#1635` - *the hole is upstream: CP-26 is armed by labelling, not by the diff*. What is new is that
the instance is now the **doctrine change that installed the requirement**, which removes the last
way to read the hole as theoretical. I have appended the measurement to that file rather than
opening a second one.

I want to be precise about what I am NOT claiming. I am **not** claiming the lane acted in bad
faith, and I am not asking for #1645 to be reverted. Section 10.2.1 is strictly narrower than the
practice it records, it discloses its own conflict of interest, and Marco's quoted instructions are
checkable by him. The defect is in the **gate**, not in the ruling.

**RULE 1 options for Marco.**

**(a) Complete and additive - arm CP-26 off the DIFF, not off the label.** Trigger the receipt
requirement from `classifyPolicyFiles`: any PR whose diff falls outside `NESTED_TEST_PATHS` (i.e.
would hand-classify as Marco's) requires `docs/decisions/merge-approvals/<N>.md` before it can
merge, whether or not a label was ever applied. Solves it now (`#1640` and `#1645` would both have
been caught) and in future (a new lane cannot escape by never being labelled), and it damages no
data entry - it is a check, and it is additive to the existing label path, which keeps working.
Pairs with the already-open `#1635` question, whose answer is a **signed** receipt verified by
`approval-receipt-check.mjs` rather than mere file presence; **(a) here and (a) there are one
decision and should be taken together.**

**(b) Require the receipt on every merge, labelled or not.** Fails the *complete* half in the other
direction: it is heavier than the risk, it would fire on the watcher's own 50 `ok:true` tests-docs
auto-merges, and a gate that fires on everything is a gate people learn to bypass.

**(c) Leave it, and rely on the lane self-reporting in the PR body.** Fails both halves. A PR body
is not checkable by CI, it is exactly the self-declaration section 10.1 step 3 refuses
(*"a lane with no such gate is self-declaration, and self-declaration is not classification"*), and
five consecutive scheduled runs have already proved that the effects of an unattributable merge get
re-derived from first principles every cycle at real cost.

**DISPOSITION: ESCALATED.** Appended to the existing needs-marco file with the `#1645` measurement.
Marco's call - it changes a required CI gate and it is a decision about his own lane, which is
squarely RULE 3.

### F2 - The 06:08Z run's escalation "DOCTRINE section 10.2 forbids the lane that is driving the board" is ANSWERED and must not be re-derived a sixth time. **S3.**

My 06:08Z breadcrumb (`#1644`) F1 option **(a)** was *"declare the lane in section 10.2 and the
section 5 matrix"*. **[MEASURED] both halves are on `origin/main` at `89c738fb`:** DOCTRINE
section **10.2.1** (`#1645`) and the new *"Station 00 has TWO modes"* table in
`STATION-CAPABILITIES.md` section 5, which lists the supervised lane's permissions explicitly.

**DISPOSITION: ACTIONED (by `#1645`, not by me).** Recording it because the cost of this thread was
never the finding - it was that **five** consecutive runs re-derived it from first principles, one
of them as a suspected attack, because the ruling lived only in chat. The question is answered. What
survives it is F1 above, which is a different question about a different object: the ruling is
recorded, the **gate** that is supposed to bound it is not yet real.

### F3 - Station 04 F1: STATION-CAPABILITIES carried a refuted shell trap in the dangerous direction, four sections below the rule forbidding restatements. **S2.**

04's measurement reproduced in my own session and is quoted in WHAT I MEASURED. Fixed with 04's
option (a): the mechanism claim is deleted and replaced with a pointer to DOCTRINE section 9.4, and
- the half that stops the recurrence - the file's existing no-paraphrase rule is now scoped to
**every** shell/`git`/`gh`/CLI trap in the file, not only the two under the Desktop Commander
heading. That scoping is why this is a fix and not a patch: the same file has now drifted three
times, each time under a heading the previous sweep did not think to look under.

**DISPOSITION: ACTIONED** in this PR. Docs-only, `docs/pipeline/`, inside 00's own lane and inside
`^(tests|docs)/`. Verified by `git diff --numstat` (21 added / 2 removed) and by the byte-delta
assertion above.

### F4 - Station 04 F2: the STOP-WATCHER sentinels were documented without paths, and six runs over eleven days filed the identical one-clause fix without it ever landing. **S3.**

Re-measured independently before writing (table above), including the negative control and one
correction to 04's own report: there are **four** readers, not three. Fixed with option (a) - both
absolute paths, the false-negative mechanism spelled out so a station knows why its own
`STOP-WATCHER*` search returns 0, the four readers named so the **mechanism** can be checked instead
of the file, and a note that `03-machine-minder.md` still repeats the pathless form.

**DISPOSITION: ACTIONED** in this PR, canonical block re-recorded through the sanctioned
`--write-canonical` with the REJECT-then-ADMIT control quoted above.

**The residual, stated plainly:** I did **not** fix `03-machine-minder.md`'s copy in this PR. It is
the same class of defect as F3 - a restatement that will drift - and folding a fourth file into a
canonical-block PR widens the blast radius of an edit that must be exact. It is named in the new
DOCTRINE text so the next reader of either file finds it. **DEFERRED**, and it becomes urgent the
moment 03 acts on its pathless copy.

### F5 - Station 04 F3: `lint-station.mjs` compares the wrong two version fields, so its NOTE indicts all seven station docs permanently and the real contract-drift check fails OPEN. **S3.**

Reproduced this run - the NOTE printed in full during my own lint runs, naming all seven docs and
ending *"the scheduled-task bootstrap must declare the same number, or the run goes read-only"*,
which is a remedy for a **different** comparison than the one the code performs. 04's analysis by
line anchor is sound and I am not re-deriving it.

**I am not landing it, and the reason is the classifier, not the merits.** The fix touches
`scripts/pipeline/lint-station.mjs` plus seven docs' front matter. `scripts/` is outside 00's
recorded lane (`STATION-CAPABILITIES.md` section 5), so DOCTRINE section 10.1 step 3's exception
does not cover it and it falls through to step 2, where it hand-classifies as **MARCO'S**. It also
re-points a CI-gating instrument, which is precisely the class of change that should not ride in on
a docs PR.

**DISPOSITION: ESCALATED**, with 04's option (a) - compare `contract_version` against
`canon['station-contract'].version` (the check the code's own comment describes), keep
`station_doc_version` printed as information, correct the remedy line to name the comparison it
belongs to, and bump the seven `contract_version: 1` to `2` in the same PR. Written to
`needs-marco/` alongside F1. Note for whoever lands it: 04's option (c), bumping
`station_doc_version`, would send **all seven stations read-only** on their next run, because every
bootstrap still declares 1.

### F6 - Station 04 F4 (watcher-clone stash = 66) and the orphaned worktree `C:/po-vg`. **S4.**

`status-sweep.ps1` section 2 this run: watcher clone `branch=main dirty=2`, and one non-main
worktree `C:/po-vg` at `23c91ba9 [fix/no-rebase-while-checks-run]`, **dirty=1, age 1396 min**,
flagged `HOLDS UNCOMMITTED WORK ... --force would discard it`. 04 separately measured the clone's
stash list at **66**, oldest from mid-July, and correctly recorded the *growth* half of DOCTRINE
section 9.2's instruction as **[CANNOT MEASURE]** - no prior count is persisted anywhere, so an
instruction to report a delta can never be satisfied and each run that reports only the count looks
like it complied.

**DISPOSITION: DISPATCHED -> Station 03.** Machine health is 03's lane and I do not do another
station's work (LL-38). Handing over three things, unchanged from 04 plus my own sweep line:
(1) the clone is not clean on main, `dirty=2`; (2) `C:/po-vg` holds one uncommitted file and must be
preserved or committed before any prune - `--force` discards it; (3) 04's suggestion that
`status-sweep.ps1` section 2 carry `stash=<n>` so the baseline lands in a durable artifact every run
and the delta becomes computable without anyone remembering to write it down. I dropped no stash and
pruned no worktree.

### F7 - Station 04 F5: `pr-doctrine-s9-four-false-traps-LOOPING.md` is spent. **S4.**

Untracked, in `superseded/`, `-LOOPING.md` matches no watcher glob, premise string proven absent
from DOCTRINE with a positive control. It arms nothing.

**DISPOSITION: DEFERRED**, exactly as 04 proposed. Recorded so a future run does not spend a third
sweep re-reading it. It becomes urgent only if something moves it to depth 1 and renames it
`-ready.md`, and nothing does.

## WHAT I DID NOT DO

- **Did not merge, revert, label or comment on anything.** There were **0 open PRs** at 07:09Z, so
  there was no merge decision to take. `#1640` merged 32 minutes before this run started, after two
  independent readers had hand-classified it MARCO'S; it is landed, and unwinding a landed merge is
  not a supervisor action.
- **Did not author a receipt** for `#1640`, `#1645` or anything else, and did not remove a
  `do-not-merge` label. No agent may author an approval receipt; that is the standing rule F1 is
  about, and writing one to close my own finding would be the exact failure.
- **Did not arm anything.** Armed count is 0 and the queue was quiet. Arming is a decision to run
  work, and nothing in the queue needed to run more than the three doc corrections needed to land.
  The two named never-arm-right-now prompts were not touched.
- **Did not land F5** (`lint-station.mjs`), for the classifier reason given above, not because it is
  hard. Escalated with the full option set so it can be taken in one decision.
- **Did not fix `03-machine-minder.md`'s pathless STOP-WATCHER copy** - named in F4, deliberately
  out of scope of a canonical-block PR.
- **Did not touch the watcher clone or `C:/po-vg`** - no `git checkout/commit/push/merge/stash` in
  `C:\po-watcher\ProjectOperations`, no stash dropped, no worktree pruned. 03's lane, dispatched.
- **Did not run `git checkout .`, `reset --hard`, `stash pop` or `git clean`** in the dev tree. The
  two files I needed to restore in the worktree were restored with `git show HEAD:<path>` piped to a
  node write, per DOCTRINE section 9.2.
- **Did not run `git` against the workspace mount** and did not use the GitHub MCP for any write.
- **Did not touch Azure, Entra or SharePoint**, and did not read or write production data.

---

## ADDENDUM 2026-09-05T07:3xZ - F1 is now measured IN THE GATE'S SOURCE, and a third instance opened mid-run

Two things happened after the sections above were written. Both strengthen F1; neither changes a
disposition.

### 1. `#1646` opened at 07:16:23Z, 7 minutes after my sweep read `OPEN PRs: 0`

`feat(tendering): the WBS table gets an actions column and three expandables (SCOPE_WBS_ACTIONS_V1)`,
head `pr-cardui-s5-actions-and-expandables`, `mergeStateStatus=BLOCKED`, `tendering-e2e`
IN_PROGRESS since 07:18:51Z, **0 labels**.

**Lane: `[NO LANE VERDICT - hand-classified]`.** Prompt-log discriminator
`Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #1646\b'` -> **0**
(POSITIVE control `marco.:true` -> **612**; NEGATIVE control -> **0**; live-tree control: newest log
`2026-09-05T06:30:33Z`, i.e. inside the hour, not the 17-day-stale decoy). The newest row in
`.arming-log.txt` is `2026-09-04T22:03:13Z` for a **different** prompt, and armed was **0** at
07:09Z, so **no arm sits in this PR's window**. Its diff touches
`apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx` and three `scope-cards/*.tsx`, none of which
match any of the three `NESTED_TEST_PATHS` forms, so `classifyPolicyFiles` refuses at the first such
path -> **hand-classifies as MARCO'S. I did not merge, label or touch it.**

**One file in its diff is the point:** `docs/decisions/merge-approvals/1646.md` - a receipt, shipped
**inside its own PR's diff**, before the merge it approves. Its front matter reads
`approved_by: station-00-supervised-cloud-lane`, and its body says, in its own words, that
*"Marco did not release this PR individually and was not asked to"* and *"Nobody reviewed this diff
but the lane that wrote it. Read that as the weight this receipt carries."*

I am recording that as **evidence, not as authority** - it is a file in a PR, which DOCTRINE 7.1
makes a lead until re-verified. But it is candid, and it is the live instance of `#1635`'s question:
**a receipt authored by the actor it identifies is a self-declaration, and section 10.1 step 3 says
self-declaration is not classification.** It does not weaken F1's option (a); it is the reason (a)
must be taken together with `#1635`'s (a), a **signed** receipt verified by
`approval-receipt-check.mjs`.

### 2. F1's mechanism is no longer an inference from two PRs - it is in the gate's decision table

The `#1646` receipt asserts *"`approval-receipt.mjs` returns `PASS / NEVER_ESCALATED` before it
reads this file."* **A claim in a PR file is data, not a measurement, so I read the source.**
`git grep -n "NEVER_ESCALATED" origin/main -- scripts/ .github/`:

```
scripts/pr-gates/approval-receipt.mjs:29   //   !labelPresent && !everLabeled  -> PASS NEVER_ESCALATED
scripts/pr-gates/approval-receipt.mjs:96          code: "NEVER_ESCALATED",
scripts/pr-gates/pr-gates.mjs:568          } else if (decision.code === "NEVER_ESCALATED") {
scripts/pr-gates/__tests__/approval-receipt.test.mjs:137  test("!labelPresent && !everLabeled -> PASS NEVER_ESCALATED (ordinary PR)")
```

POSITIVE control `RELEASED_NO_RECEIPT` -> **2** hits under `scripts/`; NEGATIVE control
`zzzNoSuchNeedleZzz` -> **0**. **The claim is TRUE, and it is asserted by a unit test**, so it is
intended behaviour rather than a bug in the gate.

**That is what closes F1.** `Approval receipt (CP-26)` is not a weak boundary on the supervised
lane - for any PR that was never labelled it is **not a boundary at all**, by design, and it
short-circuits to PASS *before the receipt file is read*. DOCTRINE section 10.2.1's claim that this
check is the CI gate section 10.1 step 3 demands is therefore false for every unlabelled merge -
which, on the evidence of `#1640`, `#1645` and now `#1646`, is the normal case and not the edge one.

**No disposition changes.** F1 stays **ESCALATED** with option (a) - arm the receipt requirement off
`classifyPolicyFiles`, not off the label - and this measurement has been appended to the same
needs-marco file, not opened as a fourth escalation.

### 3. What I did about `#1647` in light of `#1646`

I held the merge of my own `#1647` until `#1646`'s in-flight `tendering-e2e` settled.
`PR_WATCHER_AUTO_UPDATE` is `"true"` and `pollForBehindPrs()` rebases every BEHIND PR on a timer, so
merging first would have moved `#1646`'s head and **cancelled a running e2e** on another lane's PR
for no reason. That is the churn already dispatched to Station 03; the cheap mitigation is to
sequence around it, which is what I did.
