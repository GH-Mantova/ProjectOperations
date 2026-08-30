# Station 06 - PR Master (interactive, with Marco) | 2026-08-28T03:00Z-04:20Z

Corrections to Station 00's 2026-08-28T02:08Z run. Written from the interactive Cowork session Marco
has been running through the night. I am the "another actor" in that run's finding 2. Everything
below is either [MEASURED] against the live API or [STATED] by Marco in session; nothing here is
inference dressed as fact.

## GROUND

```
UTC            2026-08-28T03:00Z - 04:20Z
origin/main    e8dd43f1                    (at open of this breadcrumb's PR)
dev tree       main @ 00921aff             C:\ProjectOperations2   (behind origin/main)
watcher        C:\po-watcher\ProjectOperations   pid 12656 -> died 04:07:12Z -> relaunched pid 24960 04:08:07Z
station role   06 is NOT arming this cycle - Marco set the role at 02:45Z: stations arm, 06 verifies and merges
```

Station 06 has no scheduled task; it runs only when Marco is in session. This breadcrumb is
therefore interactive-lane, not cadence-lane, and 06 has no cadence to miss.

## WHAT I MEASURED

- **[MEASURED 03:00Z]** `gh api repos/.../pulls/1361` carries
  `auto_merge: { enabled_by: GH-Mantova, merge_method: squash }`, `merged_at 2026-08-28T01:15:21Z`.
  The `auto_merge` object survives on the merged PR.
- **[MEASURED]** `pulls/1353`: `auto_merge: null`, `merged_at 2026-08-28T01:01:03Z`.
- **[MEASURED]** #1362 merged as `e8dd43f1` at 02:46:00Z. It deletes the non-blocking `::warning::`
  wrapper, restores `check-sot-refs` to a plain blocking step, adds `docs/qa/sot-refs-baseline.json`,
  and adds a ratchet step that rejects any PR adding a `missing_path` entry while permitting removals.
- **[MEASURED]** The baseline carries **26** entries, not 28, and **zero** entries match `*-ready.md`.
- **[MEASURED]** `docs/qa/sot-refs-baseline.json` shipped as a tracked file and CI ran the ratchet
  against it on the same PR, so `docs/qa/` is demonstrably not gitignored.
- **[MEASURED 04:06Z]** `pr-crm-s2-nav-three-items-tabs-HOLD.md` is tracked on `origin/main` and the
  dev-tree copy is byte-identical to main's (empty `git diff`, 3420 bytes).
- **[MEASURED 04:06Z]** The dev-tree index still carries the stale staged rename from the original
  arm: `git status` reports `D ` **and** `??` for that one path.
- **[MEASURED 02:11:30Z, watcher log]**
  `[merge] pr-crm-s2-nav-three-items-tabs-ready.md: PR #1251 stays for Marco`. #1251 is from
  2026-08-19, unrelated, merged nine days earlier. The prompt's own run log says it opened nothing.
- **[MEASURED 04:07:12Z]** `Watcher exited with code 1 (raw node exit: -1)`, 39 seconds into the
  review of PR #1363. `ensure-watcher` had logged "watcher alive, pid(s) 12656" at 04:05:03Z. A new
  process, pid 24960, started 04:08:07Z.
- **[MEASURED 04:04Z]** `check-breadcrumb.mjs` runs in CI inside "Pipeline - watcher + linter tests"
  and prints `ADMIT` / `REJECT` per breadcrumb against a five-section structure contract.
- **[CANNOT MEASURE]** Whether Station 00's 02:08Z breadcrumb passes that contract: it is untracked,
  so it was not in the CI checkout and I have no CI result for it.

## WHAT CHANGED

1. **Opened PR #1363** (docs-only, two pure additions under `docs/pr-prompts/`): the no-drift guard
   prompt `pr-pipeline-nodrift-agents-write-sweep-commits-HOLD.md`, held and not armed, and this
   breadcrumb.
2. **Rewrote this breadcrumb** to the report contract after CI rejected the first draft for five
   missing sections, and corrected F8 below, which the same CI run proved wrong.
3. **Nothing else.** No PR merged, no prompt armed, no rename, no index write, no `/sot/` edit,
   nothing touching Azure / Entra / SharePoint.

## FINDINGS

### F1 - Breaches 11 and 12 are MISATTRIBUTED. Both merges were Marco's own.

#1361's auto-merge **was** pre-armed, by Marco. The 02:08Z run concluded "auto-merge was not
pre-armed" from `issues/1361/timeline` alone. That endpoint paginates at 30 events by default and
did not surface an `auto_merge_enabled` event, but the PR object carries the record - so the
conclusion is refuted by a second instrument on the same PR.

#1353 was merged directly by Marco (`auto_merge: null`), [STATED by Marco in session immediately
afterwards: "1353 merged by me"]. He also stated he had set #1361 to automerge, which the
measurement independently confirms.

Both are the human doing exactly what RULE 2 requires. **RULE 2 was not breached on 2026-08-28.**
The count of twelve should be reduced to ten.

**Instrument note:** do not infer "no auto-merge" from the timeline alone. Read `pulls/<N> ->
.auto_merge` as well, and treat disagreement between the two as unresolved rather than as evidence
for either side.

**DISPOSITION: DISPATCHED - Station 00.** Correct the count and adopt the two-instrument read.

### F2 - The counting method cannot support the count, so breaches 1-10 are unverified in both directions

The 02:08Z run states the problem correctly - "`mergedBy=GH-Mantova` identifies nothing" - and then
counts breaches using exactly that signal plus a timeline read now shown to be incomplete. The same
method produced F1's two wrong findings. **Breaches 1-10 were produced by that method and are
therefore unverified in BOTH directions:** some may be real, some may be Marco. Re-deriving them
needs a signal that distinguishes Marco from an agent, which does not currently exist.

**DISPOSITION: ESCALATED - Marco.** Creating that signal is an identity/authentication change, not a
pipeline change.

### F3 - Option (A) inherits the attribution problem it is meant to solve

A required check that fails while `marco:true` is set will block the Marco-gated PR from merging,
including when Marco merges it. Something must clear that check, and whatever clears it is
performable by anyone authenticating as `GH-Mantova` - which is every actor on this repo. **Two
questions need answers before the ruleset is touched: what clears the check, and who can perform
that?** If the answer to the second is "anyone as GH-Mantova", (A) relocates the breach rather than
preventing it, and adds a step that can deadlock a legitimate merge.

This is not an argument against (A). It is the gap that must be closed for (A) to do what it claims.

**DISPOSITION: DISPATCHED - Station 00**, as input to the A/B/C authorization decision.

### F4 - The withdrawn decision was mine to answer for

I pushed `15dfd84c` to #1353 at 23:33:40Z. Marco approved the change in session and the decision was
his to make. But I did not read this station's breadcrumbs before reversing a call in its domain,
and the 20:08Z run had recorded "non-blocking = WITHDRAWN, keep it BLOCKING". Neither of us knew we
were reversing a recorded decision. Reading 00's open findings before acting inside 00's domain is
the correction, and it is mine to carry.

**DISPOSITION: ACTIONED - Station 06.** Adopted as standing practice for this station.

### F5 - Finding 2's consequence is CLOSED; do not re-litigate it next cycle

The 02:08Z run described `origin/main` emitting a `::warning::` where a gate should be, with 28
dangling refs on a green main. That state ended at 02:46:00Z, eleven minutes after the run finished
writing, when #1362 merged. The green-main window ran 01:01Z to 02:46Z and is over.

**Correction to that run's arming note:** the baseline carries **26** entries, not 28. The two
`docs/pr-prompts/*-ready.md` citations from `sot/06-active-specs.md:27` and `:643` were excluded as a
path-class RULE, not baselined as entries - armed prompts are consumed by design, so baselining them
would regrow the list every time the queue drains.

**DISPOSITION: ACTIONED - closed, no further work.**

### F6 - `docs/qa/` is not gitignored, confirmed independently

#1362 shipped `docs/qa/sot-refs-baseline.json` as a tracked file and CI ran the ratchet against it on
the same PR. The four docs claiming otherwise are wrong and the six-doc correction shipment is right.

**DISPOSITION: ACTIONED - confirmed; the correction shipment stands.**

### F7 - The merge lane has no PR-existence check, and it filed a phantom win

The watcher logged a merge decision for **PR #1251** against
`pr-crm-s2-nav-three-items-tabs-ready.md` at 02:11:30Z and filed the prompt to `processed/`. #1251 is
from 2026-08-19 and merged nine days earlier; the agent's own output said it opened nothing. The
review lane's equivalent defect was fixed by tonight's guard cluster. **This one is unfixed.** A
merge lane that can name a PR the run never opened can also report a merge that never happened.

Station 04's 02:10Z run independently found the cause of the empty board: the S2 agent read its
`requires_on_main` needle with a bare `grep` against a stale dev tree and got a false negative, when
`buildCreateNoteBody` has been on `origin/main` since #1356 merged at 2026-08-27T19:05Z. Ten HOLDs
(`pr-crm-s3` through `s12`) are gated behind S2 and were left with no producer.

**DISPOSITION: DISPATCHED - Station 00.** Two items: (a) a PR-existence check in the merge lane is
worth its own slice; (b) 04's re-arm instruction for S2 stands - `git add` the restored `-HOLD.md`
first to collapse the stale staged rename, then `git mv` to arm. **Do not `git reset`; the index is
shared.**

### F8 - I was wrong about breadcrumbs and ADMIT. Withdrawing the accusation.

My first draft of this file said "no breadcrumb can be ADMIT-clean" and inferred from that that
Station 00's self-report carried an unverified pass. **That was measured with the wrong instrument.**
I ran `lint-prompt.mjs`, which treats every file in `docs/pr-prompts/` as a prompt and rejects
`NO_FRONT_MATTER`. But breadcrumbs are checked by `check-breadcrumb.mjs`, which is a different
instrument with its own five-section contract, runs in CI, and prints `ADMIT` for a conforming
breadcrumb. "Breadcrumb written and ADMIT-clean" is a legitimate claim about that checker.

I found this out because CI rejected this very file for missing all five required sections. The
accusation was mine, it was wrong, and the instrument I used to make it was the wrong one for the
file class. What remains true and worth recording is only the narrow part: a `lint-prompt.mjs` result
should never be quoted for a breadcrumb, in either direction.

**DISPOSITION: ACTIONED - withdrawn.** Station 00: disregard the accusation; no action needed.

### F9 - The watcher died mid-review of #1363 and the liveness probe did not notice

`ensure-watcher` reported "watcher alive, pid(s) 12656" at 04:05:03Z. The watcher exited code 1 (raw
node exit -1) at 04:07:12Z, 39 seconds after starting the review of #1363. A relaunch at 04:08:07Z
brought up pid 24960, so the supervisor recovered - but the recovery is what makes the gap visible,
not the probe. A 10-minute PID poll cannot see a crash-and-restart between ticks, and it cannot see a
process that is alive but wedged.

`rev-1363-ready.md` was still in the queue after the restart, so the review should be re-picked up;
whether it actually is, is the test.

**DISPOSITION: DISPATCHED - Station 03 (machine minder).** Arm-to-pickup, which Station 04 already
uses, is the probe that does not lie. A PID poll should not be reported as watcher liveness.

## WHAT I DID NOT DO

- **Did not arm anything.** Marco set this station's role at 02:45Z: stations arm, 06 verifies and
  merges. S2's re-arm is 00's, per Station 04's dispatch.
- **Did not touch the dev-tree git index**, and specifically did not `git reset` the stale staged
  rename on `pr-crm-s2-nav-three-items-tabs-HOLD.md`. I had drafted exactly that command before
  reading 04's breadcrumb, which forbids it because the index is shared. Recording the near-miss.
- **Did not fast-forward `C:\ProjectOperations2`** to `origin/main`, which is 04's F1 dispatch to 00
  and remains the live hazard: eight HOLDs falsely ADMIT against the stale linter, two of them
  destructive.
- **Did not merge PR #1363**, and will not merge it on the strength of labels alone. The watcher's
  routing line is the authority.
- **Did not re-run or re-file** Station 00's breaches 1-10. F2 says they are unverified, not that
  they are wrong.
- **Did not touch** `/sot/`, production data, or anything Azure / Entra / SharePoint.

---

**Station 00: sweep this up.** It ships tracked via PR #1363 rather than waiting for a sweep job,
because F7 and F9 are time-sensitive and an untracked breadcrumb reaches nobody.
