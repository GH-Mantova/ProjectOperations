# Station 00 — Supervisor | 2026-08-31T06:08:57Z–06:35Z

## GROUND

```
UTC            2026-08-31T06:08:57Z
origin/main    0a581ac6            (fetched, then rev-parse)
dev tree       main @ 000ee2f1     C:\ProjectOperations2  (4 commits BEHIND origin/main)
doc version    1
bootstrap      1
```

Versions agree (1 = 1), so this run was **not** read-only. The three binding docs
(`00-supervisor.md`, `DOCTRINE.md`, `STATION-CAPABILITIES.md`) were read from the working copy
**after proving they are byte-identical to `origin/main`** —
`git diff --stat 000ee2f1 origin/main -- <the three paths>` returned **empty** while the same
command without a pathspec returned 12 changed files. [MEASURED]

## WHAT I MEASURED

- **Sighted.** `start_process` shell `powershell.exe` on `LAPTOP-E6NHU4E4` returned
  `2026-08-31T16:08:57.9868034+10:00`. This was a **sighted** run, not a blind one. [MEASURED]
- **Sweep** `scripts/pipeline/status-sweep.ps1` @06:09:34Z: both instrument positive controls
  green; verdict **CAUTION** (no local lock, but `#1431` was touched on GitHub inside 2 min).
  watcher node **pid 6388**, wrapper alive (1), heartbeat 0 min, orphaned worktrees **none**,
  clone `dirty=40`. [MEASURED]
- **Collect.** `node scripts/pipeline/check-breadcrumb.mjs` → `structure: 1 checked, 0 malformed`,
  **CLEAN exit 0**; `--freshness` → `00` 2.0h · `03` 7.2h · `04` 4.0h · `05` 16.0h, every station
  **ok**, **CLEAN exit 0**. The only breadcrumb in the queue root was my own `0408`. **No station
  breadcrumb has been filed since my last run, so there was nothing new to disposition.** [MEASURED]
- **Index.** `git diff --cached --name-status` in the dev tree returned **empty** — no staged
  `R100 HOLD→ready` this run. [MEASURED]
- **Arm census, by filesystem** (`Get-ChildItem docs\pr-prompts -Filter *-ready.md`):
  `pr-estpricing-s2-cutting-rate-corrections-b-ready.md` and `rev-1433-ready.md`. Excluding the
  auto-generated review job (DOCTRINE §9.5) that is **ARMED = 1**, so RULE 4 one-at-a-time is
  satisfied and I armed nothing. [MEASURED]
- **Board.** 2 open PRs, both `BLOCKED`, both `labels=[]`:
  `#1433` head `26f031d3` (12 of 13 green, `tendering-e2e` IN_PROGRESS) and
  `#1431` head `8ad8b3a0` (`tendering-e2e` IN_PROGRESS, API job **CANCELLED**). [MEASURED]
- **RULE 2 probe** over `docs/pr-prompts/processed/*.log`, newest 25, with its positive control:
  **10 of 25 are marco-routed**, so a negative would have meant something. `#1431`'s prompt log
  reads `{"ok":false,"marco":true,"reason":"escalates:true — held for Marco, labelled
  do-not-merge"}`. **`#1431` is Marco's.** [MEASURED]

## WHAT CHANGED

1. **Re-ran the cancelled CI run on `#1431`** — `gh run rerun 33362832456 --failed`. Read back
   from the API, not from the command's silence: `run_attempt` **1 → 2**, `status`
   `completed/cancelled` → **`in_progress`**. [MEASURED]
2. **This board PR** — archived my own `0408` breadcrumb, removed four consumed prompts that are
   still tracked on `origin/main`, and landed this breadcrumb. Nothing else.

## FINDINGS

### F1 — `#1431`'s red was a CANCELLED job, not a failing one

`gh pr checks 1431` prints `API — lint, test, compliance smoke  fail`. The job API says
`conclusion=cancelled`, cancelled `06:09:01Z` after **11 of 14 steps had passed** — `lint` green,
`test:api:serial` **cancelled mid-step**, the two after it `skipped`. `gh` renders *cancelled* as
*fail*: reading the PR page would have produced a defect that does not exist. [MEASURED]

The usual explanation is refuted: **`concurrency` / `cancel-in-progress` appears in none of the
four workflow files** (`ci.yml`, `deploy.yml`, `playwright.yml`,
`playwright-container-trial.yml`), and the head SHA did not move (`8ad8b3a0` before and after), so
this was not a push superseding its own run. Something cancelled it deliberately at `06:09:01Z`.
**Who cancelled it is `[CANNOT MEASURE]` from here** — every actor on this board authenticates as
`GH-Mantova`.

**DISPOSITION: ACTIONED** — re-run, attempt 2 in flight, read back as above.

### F2 — the `do-not-merge` label on `#1431` was applied by the watcher and then REMOVED, 14 minutes later, by an actor I cannot identify

`gh api repos/GH-Mantova/ProjectOperations/issues/1431/events` returns exactly two events:

```
2026-08-31T05:40:02Z  LABELED    'do-not-merge'  by GH-Mantova
2026-08-31T05:53:54Z  UNLABELED  'do-not-merge'  by GH-Mantova
```

[MEASURED] This matters because **removing that label is not vandalism — it is the documented
release mechanism.** `scripts/pr-gates/pr-gates.mjs:483` says so in as many words: *"Removing the
label IS the human's approval: CI re-runs, this gate passes, the PR can merge."* CP-26 reads the
**live label** (`:498`), not the prompt's `escalates` flag. So at `05:40:02Z` `#1431` was gated and
at `05:53:54Z` it was released, and the release is indistinguishable, in the audit trail, from
Marco doing it himself.

`docs/pr-reviews/pr-1431-review.md` (untracked, written `06:03:29Z`) corroborates the *before*
state — it reports `**FAIL (gate)** CP-26 do-not-merge` — while the live board reports
`PR gates — diff checks … pass` on head `8ad8b3a0`. Both readings are correct; they are 13 minutes
apart. [MEASURED]

I did **not** re-apply the label. Re-applying would overrule what may have been Marco's own
approval, and his intent is the one thing no station may guess (DOCTRINE §5.5). **RULE 2 is
untouched by any of it**: the watcher routed this PR to Marco, and that gate is cleared only by
Marco in chat — not by green, not by an absent label. `#1431` will not be merged by me.

**DISPOSITION: ESCALATED.** Marco — **did you remove `do-not-merge` from `#1431` at 05:53:54Z?**
If yes, nothing is wrong and this line dies. If no, an agent forged your approval on an
`escalates: true` PR carrying a Prisma migration, and the only machine-enforced human gate in this
pipeline can be cleared by the machines it exists to stop. Options, RULE 1 order:

- **(A) Make the gate read something an agent cannot quietly rewrite — complete and additive.**
  CP-26 keeps failing on the label *and* additionally fails when the watcher's own merge log for
  that PR's prompt says `"marco": true`, unless a `docs/decisions/merge-approvals/<pr>.md` file
  signed off in the repo says otherwise. The label stays exactly as visible as it is now; the
  approval becomes a reviewable commit instead of a click nobody can attribute. Solves it
  immediately (the next `escalates` PR) and in future, and damages no existing or future data.
- **(B) Separate the identities.** Give the watcher its own GitHub App or machine account so
  `LABELED by watcher` and `UNLABELED by Marco` are distinguishable. Fixes attribution
  permanently, but not the gate — an agent holding that token could still clear it. Fails the
  "solves it completely" half.
- **(C) Alarm only.** Have `status-sweep.ps1` flag any PR whose prompt log says `"marco": true` and
  whose `do-not-merge` label is absent. Cheapest; fails the "immediately" half — it reports the
  breach after the release, which is exactly the window that matters.

### F3 — RETRACTION: "every `escalates: true` PR wears a permanently red gate check nobody may clear" is FALSE

I wrote that on 2026-08-31T04:16Z from a job log, and carried it forward as a live three-way
escalation. `scripts/pr-gates/pr-gates.mjs:472-512` refutes the second half: the check is keyed on
the **label**, and removing the label is the intended, documented clearance. The half that
survives is narrower and still worth fixing: **CP-26 is a step inside `PR gates — diff checks`, so
its failure reddens the whole shared gate job** rather than a check run of its own, which is why a
CP-26 red is easy to mistake for a real gate failure — as `pr-1431-review.md` did when it reported
CP-11 and CP-26 failing together.

**DISPOSITION: ACTIONED** — retracted here and in project memory; the CP-26 escalation is
re-scoped to the visibility half only (give CP-26 its own check run), and the "nobody may clear it"
clause is withdrawn.

### F4 — `#1433`'s prompt was armed by CREATING a gitignored `-ready.md`, so no git-side census can see it

`pr-estpricing-s2-cutting-rate-corrections-b-ready.md` is on disk (mtime `03:31:39Z`), the watcher
consumed it into `#1433`, and it is **absent from `origin/main`** and **absent from `git status`**.
`git check-ignore -v` on the **file** names the rule: `.gitignore:75:docs/pr-prompts/*-ready.md`;
the control, a tracked `-HOLD.md`, prints nothing. [MEASURED]

This is the anti-pattern the arming rule exists to prevent — arming must be a `git mv` of a
**tracked** `-HOLD.md`. Armed this way the prompt works (the watcher globs the filesystem) but is
invisible to `git status`, to `origin/main`, and to any reconciliation built on either.

It is the **third** distinct way a prompt can be armed without leaving a git trace, alongside the
bare `git mv` that writes no `.arming-log.txt` line (recorded 04:26Z). Both point the same way:
**the only sound arm census is the filesystem.**

**DISPOSITION: ESCALATED** — folded into the open `.arming-log.txt` escalation rather than opened
as a second one. The guard-hook option there (refuse a staged `HOLD→ready` with no matching log
line) does **not** catch this case, because there is no rename to refuse. A guard that covers both
has to compare the filesystem `*-ready.md` set against the tracked one.

### F5 — four consumed prompts were still tracked on `origin/main`, and my own last breadcrumb was still undispositioned in the queue root

`pr-crm-s7-interaction-log-HOLD.md`, `pr-estpricing-s2-cutting-rate-corrections-HOLD.md`,
`pr-scopesub-s1-one-discipline-list-HOLD.md` and `pr-watcher-verdict-sweep-skips-tracked-ready.md`
are deleted in the dev tree's worktree and **present on `origin/main`** (`git cat-file -e` on each,
exit 0). Each has a matching `docs/pr-prompts/processed/*.log`, so each is genuinely consumed.
[MEASURED] Left tracked, they are what a `git checkout` resurrects, armed.

**DISPOSITION: ACTIONED** — removed in this PR, together with `git mv` of the `0408` breadcrumb to
`docs/pr-prompts/archive/`.

### F6 — a concurrent actor was staging work while I ran

Four untracked artefacts, all written inside a 2-minute window: `pr-arm-prompt-release-index-HOLD.md`
(`06:02:21Z`), `pr-watcher-conflict-escalation-HOLD.md` (`06:02:53Z`), `pr-arm-guard-hook-HOLD.md`
(`06:03:23Z`) and `docs/pr-reviews/pr-1431-review.md` (`06:03:29Z`) — none of them on
`origin/main`. [MEASURED] Same window as the branch push to `8ad8b3a0` (`06:05Z`) and the run
cancellation (`06:09:01Z`).

**DISPOSITION: DEFERRED** — they are another actor's in-flight work and LL-38 says I do not sweep
them into my PR mid-build. It becomes urgent if they are **still untracked at the next 00 run**:
an untracked `-HOLD.md` cannot be armed by a `git mv` and is one `git clean` from gone, and an
untracked review verdict is the exact loss `needs-marco/REVIEW-VERDICTS-AND-ESCALATIONS-ARE-BEING-LOST-2026-08-26.md`
was filed about.

### F7 — Station 06 still has no cadence

`check-breadcrumb.mjs --freshness` lists `00/02/03/04/05` and no `06`;
`STATION-CAPABILITIES.md` §6 gives 06 "on demand". A station with no cadence can never read
SILENT, so nothing will ever notice if it stops. Measured for the fourth consecutive run.

**DISPOSITION: ESCALATED** (unchanged) — recommendation stands: **(A) give 06 a 12 h cadence**,
which is complete and additive; (B) leave it on demand and accept the blind spot.

## WHAT I DID NOT DO

- **Did not merge anything.** `#1431` is watcher-routed to Marco (RULE 2) and its CI is mid-flight;
  `#1433` has `tendering-e2e` still running. Neither was mergeable, and neither is mine to merge.
- **Did not re-apply the `do-not-merge` label** — see F2. Guessing Marco's intent in either
  direction is the hard stop.
- **Did not arm anything.** ARMED is already 1 (RULE 4).
- **Did not touch `#1431`'s branch** — a concurrent actor pushed to it 4 minutes before my sweep.
- **Did not fast-forward the dev tree** (4 commits behind) or the watcher clone (`dirty=40`, below
  Station 04's 45-deletion / 60-stash thresholds). Both are 03's lane and neither is blocking.
- **Did not commit** `docs/data-model/metadata-catalog.json` (line-ending noise, not mine),
  `scripts/pipeline/hooks/` (untracked since 08-27), the `superseded/` `LOOPING` rename, or the
  four artefacts in F6.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**


---

## CORRECTION — filed 2026-08-31T06:30Z by the same run, before anyone could quote it

**F2 above overstates the mechanism, and the overstatement is in its title.** I wrote that at
05:40:02Z `#1431` "was gated" and at 05:53:54Z it "was released". Both halves assume CP-26 can
refuse a merge. **It cannot**, and I had the means to check that before I wrote it and did not.

Measured after the fact, at `20bc699e` [MEASURED]:

```
gh api repos/GH-Mantova/ProjectOperations/rules/branches/main
  required_status_checks =
    CodeQL
    API — lint, test, compliance smoke
    Web — lint, logic tests, vitest, build
    tendering-e2e
```

**Exactly four, and `PR gates — diff checks` — the job CP-26 runs inside — is not one of them.**
So CP-26 is *advisory*: it colours a non-required check and nothing at GitHub will refuse a merge
on it. Station 00 measured this on 2026-08-28 and `#1369` proved it by merging while still wearing
the label. I re-derived the label's *code* path today (`scripts/pr-gates/pr-gates.mjs:472-512`,
which reads the live label at `:498`) and let the code's own comment — *"Removing the label IS the
human's approval"* — carry me into describing an enforcement that does not exist. **The comment
describes the intent; the ruleset decides the effect.**

One thing that finding did fix: on 2026-08-28 a `Select-String` over `.github/workflows/*`
returned zero hits for `CP-26` and was written up as *"there is no CP-26 workflow in this repo at
all"*. CP-26 **does** exist — in `scripts/pr-gates/pr-gates.mjs`, which a workflow calls. The
search was scoped to the workflow files and the conclusion was stated about the repo. **Scope the
claim to the population you actually searched** — the same lesson this station recorded on
2026-08-30 and has now paid for twice.

### What survives, restated correctly

- The label was **applied at 05:40:02Z and removed at 05:53:54Z**, both by `GH-Mantova`. That is
  measured and unchanged.
- What the removal destroyed was not a gate but **the only visible marker of one**. `#1431` now
  presents to any reader — human or agent — as green, CLEAN, unlabelled and mergeable, while the
  watcher's own log routes it to Marco. The human gate now exists only in a gitignored
  `processed/*.log` and in RULE 2, which is agent discipline on a board with several concurrent
  actors.
- `reference_do_not_merge_label` already rules on the attribution half: `GH-Mantova` is shared by
  Marco and every agent, so a label change under that account is **not** evidence of automation
  acting. **Do not read this as a breach. Ask Marco.** My question to him stands unchanged; my
  claim about what his answer would mean does not.

### The escalation, merged into the one already open

This is not a new escalation. It is a second symptom of the one Station 00 raised on
2026-08-28T10:09Z, and option (A) there covers it unchanged: **add an always-running `label-gate`
job to `ci.yml`** that passes with no hold label and fails while `do-not-merge` / `needs-marco` /
`hold` is present, merge that job first, **then add it to the ruleset**. Complete and additive: it
makes the gate real for every future PR and changes no existing data. (B) ruleset-only fails the
future half — the required check would not exist yet and every PR would block on it. (C)
discipline-only is the state that produced `#1369`, and now also the state in which a human gate
can be un-marked without attribution.

**The workflow half is mine to write. The ruleset edit is an authorization change and is Marco's.**

**DISPOSITION: ACTIONED** (this correction) **and ESCALATED** (folded into the 2026-08-28 label-gate
escalation, not opened as a second one).
