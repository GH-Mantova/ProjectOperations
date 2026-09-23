# Station 00 to Station 06 - draft the pipeline-defect cluster, and here is what Marco answered

**From** `station-00.interactive-0004` (supervised interactive lane, DOCTRINE section 10.2.1),
2026-09-24, at `origin/main` `9ff1327b`.
**To** Station 06 - PR Master.
**Why you** the board split Marco set stands: 00i and scheduled 00 drive PRs to green and merge;
05 owns its own `sot/` PRs; **06 stages and arms its own PRs**. This cluster is drafting work, so
it is yours. Marco asked for this handover by name.

**Read this file as the dispatch of record.** `docs/pr-prompts/needs-marco/` is gitignored
(`.gitignore:82`, measured), so the twenty-odd escalation files summarised below reach nobody
through git. That is not incidental - it is item 21 in the list, and this document is the
workaround for the defect it describes. Every item below carries enough to draft from without
opening the ignored file; open the local copy for the full measurement when you draft.

---

## The ask

Draft prompts for the cluster below. Stage them as `-HOLD.md` and arm your own, one at a time, as
the split allows. **Spec first, always** - that is Marco's standing rule, and several of these
items are one honest paragraph away from a spec and three paragraphs away from a guess.

**Do not draft a prompt that embeds a guess about Marco's intent.** Six of these carry an open
question that is his, marked **RULING NEEDED** below. For those, write the spec up to the decision
point, state the options with their consequences, and stop. A prompt that silently picks one is
worse than no prompt, because it looks decided.

## Constraints that bit real PRs in the last twelve hours - build them into every draft

1. **`module:` is not optional.** Fifteen of twenty-two staged prompts carry no `module:`, so the
   build agent invents a PR-title scope and `check-pr-title.mjs` fails a required check. It cost
   three PRs last night alone - 2071, 2093 and 2108 all opened as `feat(scopecards-...)`, which
   resolves to nothing this repo can point at, and each had to be retitled by hand to
   `feat(tendering)`. Put a real `module:` in the front matter of every prompt you draft, and make
   it one the checker's vocabulary already knows.
2. **New web files must carry zero colour literals.** `check-hex-ratchet.mjs` treats a file absent
   from the baseline as required-clean. S9's new admin panel arrived with ten, two of them behind
   token names that do not exist (`--border`, `--surface-raised`), so the hex fallback was doing
   the work and the theme could never override it. Name the real tokens from
   `apps/web/src/styles/tokens.css` in the prompt body.
3. **A required field added to a shared type breaks every hand-built fixture.** S9 made
   `extraValues` required on `ListedRate` and two spec suites stopped compiling. If a slice widens
   a shared type, say so in the prompt and name the fixtures that will need the field.
4. **`escalates: true` means the PR stops for Marco** - the watcher labels it `do-not-merge` and
   CP-26 requires a receipt at `docs/decisions/merge-approvals/<N>.md` once it has ever been
   labelled. It is NOT the human arming gate; do not conflate them.
5. **Never remove a `do-not-merge` label.** Only Marco releases.
6. **Never touch `sot/`.** CP-24 hard-fails a PR mixing code and `sot/`. If a fix needs a `sot/`
   row, say so and hand that half to Station 05.
7. **The D-register checker is in ENFORCE on `main` as of 2026-09-23.** Any unregistered `D<n>`
   citation now fails CI - including in prose files. It caught its own approval receipt on the
   night it landed. Do not cite a decision id in a prompt unless it is in the register.
8. **Azure, Entra and SharePoint: write the code and the runbook, then stop.** No portal, no
   `az`, no `Connect-MgGraph` that writes. This is absolute.

---

## The cluster

Each row names the finding, where the full measurement lives, and what a prompt has to settle.
File paths are under `docs/pr-prompts/needs-marco/` unless stated. Sizes are my estimate, not a
ruling.

### A. Clean slices - draft and arm these first, no ruling needed

**1. The sweep's clone-dirty flag counts untracked files; the watcher does not.**
`sweep-clone-dirty-flag-counts-untracked-files-2026-09-10.md`. One condition in
`status-sweep.ps1`. The two instruments disagree about what "dirty" means, so the sweep reports a
clone as dirty when the watcher would run on it happily. **Worked instance from last night:** the
watcher clone read dirty on three untracked files that were never tracked on `main`; the cure was
three lines in `.git/info/exclude`, not a repair. Size 1-2, `scripts/pipeline/`.

**2. The prune warning ignores unpushed commits.**
`status-sweep-prune-warning-ignores-unpushed-commits-2026-09-17.md`. `dirty=0` reads "safe to
prune" on an orphaned worktree that holds commits existing nowhere else. The fix is to count
`git log @{u}..` as well as the working tree. Size 1-2, same file. Pairs naturally with item 1 -
consider one prompt for both, since they are the same function.

**3. The watcher scrapes the PR number out of the agent's prose.**
`watcher-scrapes-the-pr-number-out-of-agent-prose-2026-09-11.md`. Any PR the agent merely
*mentions* can be adopted as the one it opened. The cure is to read the number from the `gh pr
create` result rather than from text. Size 2-3, `scripts/pr-watcher/`. This one is a correctness
defect with a real blast radius: a wrong number means a verdict lands on a stranger's PR.

**4. A verdict is not anchored to a head SHA.**
`verdict-is-not-anchored-to-a-head-sha-2026-09-09.md`. A MERGE written for commit A authorises
commit B. Measured twice in two days (#1823, #1824 - the second went stale inside four minutes).
Record the head SHA in the verdict and refuse to consume a verdict whose SHA is not the current
head. Size 2-3. **This is the one I would draft first** - it is the gate that every other merge
decision rests on, and it fires silently.

**5. `seed_only: false` can coexist with "do not write a migration", and nothing detects it.**
`prompt-declared-seed-only-false-while-forbidding-a-migration-2026-09-09.md`. CP-23 then makes the
prompt unsatisfiable and `lint-prompt.mjs` cannot see the contradiction. Found via #1823. Add the
cross-field check to the linter. Size 2, `scripts/pipeline/lint-prompt.mjs` + its spec.

**6. Fifteen of twenty-two staged prompts carry no `module:`.**
`prompts-carry-no-module-and-the-title-gate-fails-the-pr-2026-09-21.md`. Worked instance #2040,
and three more last night. Two halves: a linter WARN (or REJECT, your call to propose) on a
prompt with no `module:`, and a backfill pass over the staged shelf. Size 2-3. Draft the linter
half; the backfill is mechanical and can ride along.

**7. Bootstrap preflight omits four load-bearing preconditions.**
`bootstrap-preflight-omits-four-preconditions-2026-09-10.md`, S2, raised by 04 as F2. No CI gate
reaches the bootstrap layer at all. Note the five bootstraps ARE writable - that was measured on
2026-08-29 and the "no agent may edit them" premise is refuted, so this is draftable work.

**8. The five bootstraps cite a `.gitignore` line that now says the opposite.**
`gitignore-citations-in-the-five-bootstraps-2026-09-06.md`. Rotted twice. Cite the token, not the
line number - the same lesson `lint-station.mjs` already encodes for repo paths. Size 1.

**9. A DISPATCHED finding has no file-backed home.**
`dispatched-findings-have-no-file-backed-home-2026-09-10.md`. Nothing can surface an outstanding
dispatch, so findings routed between stations are only as durable as the next run's memory. This
is the sibling of item 21 and the two should probably share a design: one folder, one naming
convention, one instrument that lists what is open.

**10. The rev- lane reviews PRs the watcher never opened, and nothing reads those verdicts.**
`rev-lane-reviews-second-lane-prs-that-nothing-reads-2026-09-11.md`, marker
`REV_LANE_UNCONSUMED_ON_SECOND_LANE_V1`, measurement landed in `DOCTRINE.md` section 10.3. It
burns the single review lane for the length of a full review on output nobody consumes. Observed
again last night on 2106. The *measurement* is settled; what to DO about it has a Marco half -
see item 16.

### B. Tonight's two - both fresh, both with evidence attached

**11. The `IS kanban stage columns` WebKit e2e test is flaky.** NEW, filed by this run.
[MEASURED] 2026-09-23, two failures on two unrelated branches within five hours:
`tendering-e2e` on 2108 at 02:42Z and on 2107 at 05:19Z, both
`Error: page.goto: WebKit encountered an internal error`, both **19 of 20 tests passing**, both
green on a plain re-run with no code change. Same test, same browser, different branches, so it
is the test or the WebKit launch, not either slice. It cost two full CI cycles and a re-run
decision that a human had to make twice. Draft a prompt to stabilise it - a retry-on-launch, a
longer `page.goto` timeout for WebKit specifically, or a documented quarantine with an owner. Do
NOT simply delete the assertion. Size 2, `tests/e2e/`.

**12. Retiring a needs-marco escalation leaves no TRACKED record.** NEW, filed by this run, and
it is half of an S1 that a scheduled Station 00 raised the same night.
[MEASURED] 2026-09-23: 18 of 62 escalations were retired into
`needs-marco/_resolved-2026-09-23/` with a README recording the evidence per file. Because the
whole folder is gitignored, that README reaches nobody through git, and
`needs-marco/discharged/`'s newest `_DISCHARGE-NOTE-*` is from 2026-09-10. The scheduled run,
finding the files gone and no note anywhere, filed **"18 escalations deleted from the dev tree by
an actor I cannot identify", severity S1** - a false alarm that cost it most of a run and needed
a correction PR (2106) to keep off `main`. The cure is a tracked discharge record: a note in a
tracked path, written by whatever retires an item, naming the item, the date, the actor and the
evidence. Size 2-3. This is the highest-value item on the list, because it is the one that makes
every other escalation legible.

### C. RULING NEEDED - spec up to the decision, then stop

**13. Two Station 00s on one board, and the SAFE-TO-ACT gate read SAFE between arms.**
`two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`.
Happened again last night: a scheduled 00 and this interactive lane worked the same board in the
same minutes and only timing kept them apart. The gate's instrument cannot see a concurrent actor
between arms. **Marco's call:** a lock that makes the second occurrence stand down, or a
documented rule that the interactive lane owns the board while it is live. Draft both shapes.

**14. Station 00 is blind on roughly 40% of its runs** - Desktop Commander times out connecting.
`station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`. Three more blind runs
last night alone (0115Z, 0414Z, 0713Z, by their own breadcrumbs). **Marco's call:** this is an
environment decision, not a code one.

**15. The station-freshness detector cannot see a missed run, or a dead one.**
`station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`, escalation #23, amended with
a measured third cause. **Marco's call** on what "missed" should mean before anyone builds it.

**16. The tests-docs auto-merge lane: 172 waits, 4 merges, none since 2026-08-24**, and it
starves its own review job. `tests-docs-lane-merge-action-has-not-fired-since-2026-08-24.md` and
`tests-docs-lane-starves-its-own-review-job-2026-09-04.md` (worked instance #1583). Re-measure
the counts before quoting them. **Marco's call:** retire the lane, or fix the starvation. Both are
defensible; the prompt depends entirely on which.

**17. Every hourly board PR rebases all of Marco's waiting PRs and burns a full CI cycle on each.**
`hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md`. Confirmed again last night: three
parked PRs went BEHIND repeatedly while collect runs merged, and each needed an update-branch and
a fresh cycle before it could merge. **Marco's call:** cadence, or batching, or leaving parked PRs
un-rebased until release.

**18. The collect cycle rebuilds the one PR it cannot merge** - 24 times in 9.4 hours.
`collect-cycle-rebuilds-the-pr-it-cannot-merge-2026-09-06.md`. Same family as item 17.

**19. The binding-read contract exceeds what one run can carry**, so every run reads a different
part of it. `binding-read-contract-exceeds-what-a-run-can-carry-2026-09-14.md`. **Marco's call:**
what gets cut. This one is a scoping decision about the pipeline's own doctrine, and no station
should propose the cut unilaterally.

**20. RULE 4 throttles the wrong stage: the merge gate is ungated and unmeasured.**
`arming-throughput-rule-b-is-ungated-2026-09-06.md`. **The analysis is already yours** - Station
06 wrote `docs/plans/arming-throughput-brief.md`, landed in #1741. Read the brief; the queue entry
is only the pointer. **Marco's call** on the throughput target before anyone rewrites the rule.

**21. 181 escalations exist only in the watcher clone**, where no instrument can see them.
`escalations-live-only-in-the-watcher-clone-2026-09-14.md`. Sibling of items 9 and 12. Design one
answer for all three rather than three answers.

**22. CP-26 passes vacuously on an unlabelled destructive migration**, and label removal is the
release path but leaves no signature.
`cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05.md`,
`label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md`,
`nothing-verifies-a-merge-approval-receipt-2026-09-07.md`. **Read the retraction at the top of the
third file before drafting anything** - an earlier draft of that finding accused a scheduled build
of forging a receipt, and the accusation was withdrawn after a falsifying probe. The honest
residue is narrow: a receipt says `approved_by: marco` because a station wrote it, and nothing
verifies he saw it. **Marco's call** on what evidence would count.

**23. Instrument-repair PRs can only reach `main` through Marco.**
`instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md`, raised on behalf of Station
04, which is report-only and cannot file to `needs-marco/` itself. **Marco's call** on whether a
pipeline-repair PR may merge on a station's own verdict.

**24. #1612 was closed without merging and its branch holds the only copy of the code.**
`pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md`. **Marco's call:** revive or
let it go. Time-sensitive only insofar as branches get pruned - and item 2 above is the reason
that pruning is currently unsafe.

---

## Suggested order

Items **4, 3, 12, 1+2** first: a stale verdict authorising the wrong commit, a PR number read out
of prose, and a retirement that leaves no record are the three that produce *wrong* outcomes
rather than slow ones, and 1+2 is an afternoon. Then **5, 6, 8** - small linter work with an
immediate payoff in fewer failed PRs. Then **11**, because it is costing a re-run decision per
occurrence. Leave section C until Marco has answered; drafting those without his ruling is how a
guess acquires a filename.

## What changed on the gates today, so you are not working from a stale shelf

Marco answered the human-gated shelf on 2026-09-24. Three prompts were released and the records
are in this same PR:

| prompt | before | after |
|---|---|---|
| `pr-devtree-sync-ff-only-guard` | `HUMAN_GATE_PRESENT` | **ADMIT** (size 2) - armable now |
| `pr-fv2-formrule-contract` | `HUMAN_GATE_PRESENT` | **ADMIT** (size 10) - armable now |
| `pr-tipid-s3-retire-the-name-guard-for-an-id-check` | `HUMAN_GATE_PRESENT` | **GATE_NOT_RELEASED** |

The third is the interesting one and it is working exactly as its author intended: the human layer
is now released, and the three `requires_on_main` gates underneath still hold it, because they are
checked even after arming (`lint-prompt.mjs:808`, `ARMED_GATE_STILL_CHECKED`). Human intent and
measured reality are separate layers and only one of them has cleared.

**Seven prompts were NOT released, each for a stated reason** - do not treat them as available:
`pr-queue-layout-sot-entry` is never-arm by construction and belongs to Station 05 by hand;
`pr-nav-jobs-projects-merge` is gated on the B-P0a model merge, and both `model Job` and
`model Project` are still in `schema.prisma` on `main`, so it stays shut;
`pr-524-rates-b-slice2-canonical` and `pr-siteid-notnull-backfill` are both waiting on approval
documents that do not exist on `main` (measured) plus, for the second, an open backfill-source
decision; `pr-retire-tenderclientnote-s2` destroys production rows and its second precondition is
Marco opening the app; `pr-scopecards-s8b-azure-maps-travel` and `pr-vendor-invoice-ocr` each wait
on a fact only Marco has - whether the Azure Maps account exists and how it authenticates, and
whether the doc-AI key is entered in Integration settings. Those two questions are with him now.

## Report back

Breadcrumb your run as usual. If you draft a prompt for an item in section C without a ruling,
say so loudly in the prompt body and keep it `-HOLD` with a human gate on it - the shelf is
already full of prompts nobody can tell the status of, and that is half of what this cluster is
about.

---

## GROUND

`origin/main` `9ff1327b`. Dev tree `C:\ProjectOperations2` fast-forwarded and clean apart from two
known untracked files. Board empty: 0 open PRs at the time of writing. Watcher node running,
queue empty, nothing armed. Actor `station-00.interactive-0004`, supervised - Marco in chat.

## WHAT I MEASURED

| probe | result |
|---|---|
| `lint-prompt.mjs` over every `*-HOLD.md` at depth 1, before | 14 REJECT: 10 `HUMAN_GATE_PRESENT`, 4 `FILE_GATE_NOT_RELEASED` |
| the same sweep, after the three releases | 2 ADMIT, 1 `GATE_NOT_RELEASED`, 11 unchanged |
| `docs/approvals/rates-b-slice2-canonical-approved-by-marco.md` on `main` | **absent** |
| `docs/approvals/siteid-notnull-backfill-approved-by-marco.md` on `main` | **absent** |
| `model Job` / `model Project` in `schema.prisma` on `main` | **both still present** - B-P0a has not landed |
| TenderClientNote slice 1 (#1165) | **MERGED** - precondition 1 of 2 satisfied |
| `tendering-e2e` WebKit failures, 2026-09-23 | **2** on 2 branches in 5 h, same test, 19/20 passing each time, green on re-run |
| `needs-marco/*.md` at root / in `_resolved-2026-09-23/` | **44** / **19** (18 retired + README) |
| newest `needs-marco/discharged/_DISCHARGE-NOTE-*` | **2026-09-10**, 14 days stale |
| `check-d-register.mjs` over this tree, ENFORCE | exit 0, no unregistered citations |

The ten-item count corrects the figure I gave Marco in chat, which said nine while listing ten.

## WHAT CHANGED

Three human-gate markers removed, each replaced by a dated release record naming Marco and the
wording of his release, in `pr-devtree-sync-ff-only-guard-HOLD.md`,
`pr-fv2-formrule-contract-HOLD.md` and
`pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md`. Two stale paragraphs in the third
were rewritten so the file no longer describes a marker that is gone. This dispatch was filed.
Nothing was armed, nothing was merged, no label was touched.

## FINDINGS

**F1 - the `IS kanban stage columns` WebKit e2e test is flaky, twice in five hours.** S3. Detail
and measurement in item 11 above. Dispatched to Station 06 for drafting. Not fixed here: it is a
test-suite change and this run's lane was the board, not the suite.

**F2 - retiring a needs-marco item leaves no tracked record, and that gap manufactured an S1.**
S2. Detail in item 12. This is the surviving half of a scheduled Station 00 finding that opened
at S1 as "18 escalations deleted by an actor I cannot identify"; the deletion half was false - the
files were moved, intact, by this lane - and was corrected on `main` in #2106. The record half is
real and open. Dispatched to Station 06.

**F3 - seven of the ten human-gated prompts must not be released on a blanket instruction, and
each has a stated reason.** S2, reported not acted on. `pr-queue-layout-sot-entry` is never-arm by
construction: arming it would hand a `sot/`-only build to Station 01, the watcher's code-writer,
while `STATION-CAPABILITIES.md` records `Edit /sot/` as 05 only - it is handed to 05 by hand, not
armed. `pr-nav-jobs-projects-merge` is gated on a model merge that has not landed (measured
above). `pr-524-rates-b-slice2-canonical` drops tables irreversibly and its second precondition is
an operational check only Marco can run. `pr-siteid-notnull-backfill` carries an open
backfill-source decision. `pr-retire-tenderclientnote-s2` destroys production rows. The last two
wait on a fact only Marco holds, and both questions are with him. Releasing a gate whose stated
precondition is unmet would convert a safety layer into paperwork.

**F4 - the release of `pr-tipid-s3` is the two-layer design working, and worth recording as
evidence.** Informational. Its own body predicted the outcome: remove the human marker in a
reviewable PR and the three `requires_on_main` gates still hold. That is exactly what the linter
now reports - `GATE_NOT_RELEASED`, not ADMIT.

**DISPOSITION.** F1 **DISPATCHED** to Station 06 with its measurement, inside this dispatch.
F2 **DISPATCHED** to Station 06, same. F3 **ESCALATED** to Marco - two of the seven carry a
question only he can answer and both were put to him in chat in this run; the other five are
blocked on preconditions that are measured, not opinions. F4 **ACTIONED** - recorded here as
evidence and nothing further is owed on it.

## WHAT I DID NOT DO

- **Did not release the seven prompts in F3**, and did not silently narrow any of their gates.
- **Did not arm anything.** Two prompts are armable now; arming is a separate deliberate act, one
  at a time, and the record should land before the arm.
- **Did not touch `sot/`** - not one file, in any worktree.
- **Did not go near Azure, Entra or SharePoint**, including for the two prompts whose gates name
  Azure Maps and Azure Document Intelligence.
- **Did not remove or add a label**, and did not merge anything in this run.
- **Did not draft the cluster prompts myself** - that is 06's lane under Marco's board split, and
  this dispatch is the handover rather than a head start.
- **Did not leave this dispatch untracked in the dev tree.** It was written inside this PR's
  worktree, so no loose copy exists to block the next fast-forward.

<
