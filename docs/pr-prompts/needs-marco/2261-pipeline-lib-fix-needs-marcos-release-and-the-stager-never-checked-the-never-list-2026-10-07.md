# #2261 needs your release, and the thing that staged it never checked whether a station could ever merge it

**Raised by** Station 00 (scheduled), 2026-10-07T03:3xZ, at `origin/main` **83470c08**.
**Subject PR: #2261** — `fix(pipeline): make Invoke-GitPush -WorkTree mandatory and fail loud
(GITPUSH_WORKTREE_MANDATORY_V1)`. Head `a5a3d9bc`. One file: `scripts/pipeline/pipeline-lib.ps1`,
+19 −1. Now labelled `do-not-merge` by Station 00 so your queue line counts it.

## The question, in one line

**Do you want to release #2261 yourself, and do you want the never-list consulted before a prompt
like it is ever staged again?**

## What is true

[MEASURED] `gh pr checks 2261` → 13 pass, 2 fail. The CP-26 job log names its own cause:

```
FAIL - CP-26 approval-receipt [RECEIPT_REQUIRED_BY_DIFF] PR #2261 touches files that require an
approval receipt (outside tests/ or docs/: scripts/pipeline/pipeline-lib.ps1), but
docs/decisions/merge-approvals/2261.md is not in this PR's diff against merge-base with origin/main.
```

[MEASURED] `scripts/pr-gates/standing-lanes.json` on `origin/main` has exactly two lanes, `sot`
and `instrument`. [MEASURED] `scripts/pipeline/instrument-lane.json` on `origin/main` lists
`pipeline-lib.ps1` as the **first entry on its NEVER-LIST**, with the reason written beside it:
*"the core library all scripts depend on"*.

So neither receipt form is open to a station: `authority: standing` has no lane that admits this
file, and `authority: personal` requires that you released it — the label removed, or "release this"
said in chat. **This is the gate working as designed.** A station writing either receipt would be
forging its own release past a CI check built to make that impossible.

The second red, `tendering-e2e`, is a separate matter and is **not** what is blocking this PR: four
tests in `pr-acceptance-batch1-dashboards` failed, the nine previous real e2e runs (#2240–#2251) all
passed, and #2261's one PowerShell file cannot reach that suite. It is written up as F2 in this
run's breadcrumb with its falsifying probe. Station 00 deliberately did not re-drive #2261's CI: a
13-minute e2e rebuild buys nothing while the merge is blocked on a human.

## Question 1 — #2261 itself

**RULE 1, complete-and-additive first.**

**(a) Review it and release it, and keep the never-list as it is.** Remove the `do-not-merge` label
and the next Station 00 run commits `docs/decisions/merge-approvals/2261.md` with
`authority: personal` and merges it through `Assert-SmokedOrEscalate` → `Merge-Pr`.
*Solves it immediately* — the fix lands. *Solves it for the future* — the never-list keeps doing its
job, which is to make sure the core library every script depends on is never changed without you
looking. *Damages nothing* — no data entry, existing or future, is touched; the change is 19 lines
in a PowerShell helper. **This is the option that passes both halves.**

**(b) Close it unmerged and have the fix re-staged against a file that is in the lane.** Fails the
*complete* half: the defect F10 recorded — `Invoke-GitPush` defaulting to a non-existent worktree
and still printing a plausible SHA — lives in `pipeline-lib.ps1`, so there is nowhere else to fix
it. It would also leave the prompt needing an explicit `superseded/` home (F6 in the breadcrumb).
Nothing about it is additive; it is the same work deferred.

**(c) Add `pipeline-lib.ps1` to `instrument-lane.json` so stations can merge it in future.** Fails
the *without damaging the future* half, and badly. The never-list exists because that file is the
one every board operation runs through; putting it in the lane means a station could change the
merge primitive and then merge its own change with it. `instrument-lane.json` is yours by its own
terms — any change to it places a PR outside the lane. Listed only so the trade-off is on the record,
not as a recommendation.

## Question 2 — the staging gap (`STAGING_DID_NOT_CONSULT_THE_NEVER_LIST_V1`)

#2261 is here because an earlier cycle staged `pr-gitpush-worktree-mandatory-HOLD.md` (#2257) and
Station 00 armed it. The prompt was admissible, the watcher built it, 13 of 15 checks went green —
and **no station could ever have merged it**, because nothing in the staging or arming path reads
`instrument-lane.json`'s never-list.

Per occurrence the cost is small: one build, one 13-minute e2e, one PR in your queue. But it is
silent, and it will recur for every self-repair that touches `pipeline-lib.ps1`, `arm-prompt.ps1`,
`retire-escalation.mjs`, `dispatch.mjs`, or anything under `scripts/pr-watcher/` or
`scripts/pr-gates/` — which is the class of fix this pipeline writes about itself most often.

Station 00 has **already done the additive half** in the same PR as this file: one line in the ARM
bullet of `docs/pipeline/stations/00-supervisor.md` telling the arming station to read the
never-list first and to say in its breadcrumb that the resulting PR will need you. That is a
remembered rule, and DOCTRINE §9.2 records remembered rules as having failed seven times.

**The mechanical half is yours to choose:**

**(a) Gate it at `lint-prompt.mjs`: a prompt whose stated target files are all on the never-list is
REJECTed at admission, with a message saying it needs Marco's release and should be staged as an
escalation rather than armed.** *Complete now* — no such prompt reaches the board again.
*Complete in future* — it is mechanical, not remembered, and it reads the never-list rather than a
copy of it, so the two cannot drift. *Additive* — it adds a reject path; it changes no existing
admission, arms nothing differently, and touches no data. **This is the option that passes both
halves.** It needs your word because `lint-prompt.mjs` and the gate boundary are yours, and because
a new reject code changes what the watcher admits.

**(b) Leave it at the documented rule Station 00 just landed, and accept the occasional wasted
build.** Fails the *future* half for the reason above: it is a remembered rule in a pipeline whose
own doctrine records that remembered rules fail. Honest cost if you pick it: roughly one wasted
build plus one queue item each time an instrument fix lands on a never-listed file.

**(c) Make the never-list advisory and let stations merge with a new lane key.** Fails *without
damaging the future* for the same reason as Question 1(c), and it moves the question from "was this
reviewed" to "which list was current". Listed for completeness only.

## What Station 00 did and did not do about this

Did: labelled #2261 `do-not-merge` under the board lease, read back `labels=do-not-merge`, released
the lease; landed the documented ARM-bullet line; filed this.
Did not: write a receipt of either kind; remove any label; re-run or update-branch #2261; touch
`instrument-lane.json`, `standing-lanes.json`, `lint-prompt.mjs`, or anything under `scripts/pr-gates/`.

Full measurements, with commands and controls, are in this run's breadcrumb:
`docs/pr-prompts/00-00-supervisor-2026-10-07-0314-2261-targets-a-never-listed-file-so-no-station-can-ever-clear-its-cp26-gate.md`
(F1 and F4).
