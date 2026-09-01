# Station 00 — Supervisor | 2026-09-01T06:09Z–07:0xZ

## GROUND

```
UTC            2026-09-01T06:09:09Z
origin/main    000de2d9  (at start)  ->  75a48577 (at time of writing)
dev tree       main @ 000de2d9   C:\ProjectOperations2
doc version    1     (docs/pipeline/stations/00-supervisor.md)
bootstrap      1     (00-supervisor SKILL.md)
```

Doc version and bootstrap AGREE — this run was not read-only.

**SIGHTED, not blind.** `start_process` shell `powershell.exe` returned a live prompt on the
Windows host at 06:09:09Z. Desktop Commander was present for the whole run. Every claim below
tagged `[MEASURED]` was measured on that box.

Read in full this run: `docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md`,
`docs/pipeline/STATION-CAPABILITIES.md`. [MEASURED] `git diff --name-only origin/main --
docs/pipeline/` returned **1** file (`sweep-rotation.json`), none of the three, so the working
copies were byte-current with `origin/main` for this read.

## WHAT I MEASURED

**Sweep, 06:10:01Z.** `SAFE TO ACT`. `armed: 1` · `needs-marco: 16` · watcher node RUNNING pid 2292,
wrapper alive, heartbeat 1 min · `in-progress prompts: 0` · no git lock · `worktree-registry-escapees: 9`.
[MEASURED]

🔴 **`main` was RED.** [MEASURED] `gh run list --commit 000de2d9e3c32b7e00dade3a510efd025bbbae1f`
(full 40-char SHA, per §9.4) → `CI  completed failure`. Failing job `Pipeline — watcher + linter
tests` (99751201985); failing step, read from the job log and not from the diff:

```
node scripts/pipeline/check-breadcrumb.mjs
REJECT  00-06-pr-master-2026-09-01-0535-stale-escalations-carried-by-every-sweep.md
          x missing section: <H2> WHAT I MEASURED
          x missing section: <H2> WHAT CHANGED
          x missing section: <H2> FINDINGS
          x missing section: <H2> WHAT I DID NOT DO
structure: 8 checked, 1 malformed
REJECT: 1 malformed breadcrumb(s)   ->  ##[error]Process completed with exit code 1
```

*(The four heading markers in that quote are rendered `<H2>` instead of the two literal hash
characters. That substitution is not cosmetic — see **F10**.)*

That file landed in `#1482` at 05:42:16Z. All six open PRs inherited the red.

🔴🔴 **`#1482` merged with that check ALREADY FAILING on it.** [MEASURED] `gh pr view 1482 --json
statusCheckRollup` → `Pipeline — watcher + linter tests  COMPLETED FAILURE`, `autoMerge=True`,
merged 05:42:16Z. So the gate caught the defect **on the PR** and native auto-merge merged it anyway.

🔴🔴 **The branch ruleset requires exactly four checks.** [MEASURED]
`gh api repos/GH-Mantova/ProjectOperations/rulesets/15532058`:

```
REQUIRED: CodeQL
REQUIRED: API — lint, test, compliance smoke
REQUIRED: Web — lint, logic tests, vitest, build
REQUIRED: tendering-e2e
```

[MEASURED] On a docs-only PR the changed-path filter SKIPS three of those four — `#1485`'s own
rollup shows `API … SKIPPED`, `Web … SKIPPED`, `tendering-e2e … SKIPPED`. GitHub counts a skipped
required check as satisfied. **On a docs-only PR the only binding check in this repository is
CodeQL.** Everything else — `check-breadcrumb`, `lint-prompt`, `lint-station`, the watcher tests,
the arm-prompt tests, and every `CP-*` diff check in `PR gates` — is advisory.

**Lane probe, with its positive control** (§10.1, and written without a quote character):
[MEASURED] in `docs/pr-prompts/processed/`, `-Pattern 'marco.:true'` → **601** hits, so the probe
works. `-Pattern 'PR #1485'` → **0**; `-Pattern 'PR #1482'` → **0**. #1482 was hand-opened too,
which is the §10.1 case demonstrating itself: neither PR could ever have a verdict.

**Freshness.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` at 06:2xZ:
`00 last 2026-09-01T00:37Z, 5.7h ago (cadence 2h) SILENT` · `03 7.2h ok` · `04 4.1h ok` ·
`05 16.1h ok` · `02 dispatch-only`.

**Board at 06:10Z** — 6 open, all RED; at 07:0xZ — 5 open. [MEASURED] `do-not-merge` live on
`#1483` and `#1478` only; `#1477`, `#1484`, `#1481`, `#1479`, `#1486`, `#1487` carry no labels.

**`#1477` hand-classified.** [MEASURED] its three files are all `apps/api/src/…`, i.e. **outside
`^(tests|docs)/`** despite being `.spec.ts`. `classifyPolicyFiles`' rule is a path prefix, not a
file kind ⇒ **`#1477` IS MARCO'S.** [MEASURED] `needs-marco/pr-1477-review-block.md` (05:23Z) is a
**BLOCK** verdict naming a concrete fix: three cases at `estimate-export.service.spec.ts:288,309,326`
override partial summary buckets missing `provisionalSubtotal` / `provisionalWithMarkup`, and CP-22
needs its last checkbox ticked.

**Arm candidates.** [MEASURED] `triage-holds.ps1` (SPENT control PASS, 3 distinct verdicts observed):
`spent=7  gates-satisfied=35  still-gated=28  unreadable=0  of 70`. Real armed count on disk at
06:3xZ: **0** — `Get-ChildItem docs\pr-prompts -Filter *-ready.md` returned nothing, twenty minutes
after the sweep printed `armed: 1`. The watcher consumed `pr-crm-uifix-s1` and opened `#1486`.

**04's F1 was already discharged.** [MEASURED] `pr-statussweep-orphan-worktree-dirs-HOLD.md` is on
`origin/main` at `docs/pr-prompts/superseded/cleared-2026-09-01-shipped-as-1460/`, retired by
`#1475`. Positive control on the same query: `cardui` → 7 files.

**The `#1460` liveness classifier works.** [MEASURED] running the sweep from my own disposable
worktree printed `LIVE STATION WORKTREE: C:/po-wt/fix-sweep-measure 968897e3
[fix/sweep-measure-object-length]` and did **not** list it as an escapee. The dev tree carries the
fixed sweep (`LIVE STATION WORKTREE`=6, `REGISTRY-ESCAPEE`=5, positive control `sweep`=5), so the
2026-08-31T22:11Z dispatch — *"FF the dev tree, it is running the sweep #1460 fixed"* — is
discharged.

## WHAT CHANGED

- **Merged `#1485`** (mine, docs-only) at 06:17:52Z, `abbb2519`. Read back:
  `state=MERGED mergedAt=2026-09-01T06:17:52Z`.
  [MEASURED] **CI on `abbb2519`: `completed success`. The trunk went green.**
- **Merged `#1479`, `#1481`** via `Assert-SmokedOrEscalate` → `Merge-Pr`, both read back MERGED.
- **Armed native squash auto-merge on `#1484`** (docs-only, CLEAN but for an in-progress CodeQL
  analysis). Read back `autoMergeRequest != null`. **Declaring it, per `#1486`'s withdrawal of the
  `#1472` grant: this `autoMerge=ENABLED` is mine, not an unexplained one.**
- **Opened `#1487`** — `status-sweep.ps1` `-File` fix. Green-driven, **not merged: it is Marco's.**
- **Retired 10 dead files** out of `docs/pr-prompts/needs-marco/` into
  `needs-marco/resolved-2026-09-01/` (a MOVE, never a delete; the folder is gitignored so this is
  a filesystem change with no tracked diff). 16 files → 6.
- **This PR** retires the 7 SPENT `-HOLD` prompts to
  `docs/pr-prompts/superseded/cleared-2026-09-01-consumed/` and carries this breadcrumb.

Nothing else. No label added or removed. No `/sot/` edit. Nothing in `C:\po-watcher\**`. No watcher
restart. No production data.

## FINDINGS

### F1 — `main` was red because a station's own report was malformed, and it blocked the whole board

Cause named from the job log, not the diff: `check-breadcrumb.mjs` REJECTed `#1482`'s breadcrumb for
four missing contract sections. Cure: re-section it losslessly. [MEASURED] read-back before pushing —
of 115 original lines the only ones absent from the rewrite were the **five headings deliberately
demoted `##` → `###`**; `git diff --numstat` = 68 insertions / 5 deletions, and the 5 deletions are
exactly those headings. `check-breadcrumb.mjs` then exited **0, `CLEAN`**, and CI on the merge commit
came back `success`.

I caught myself mid-fix: my first pass dropped 06's two `DEFECT` sections entirely while claiming
"no content changed". The line-by-line read-back is what found it. 🔧 **METHOD: when you promise a
lossless edit, prove it with a set difference, not by reading your own output.**

**DISPOSITION: ACTIONED** — `#1485` merged 06:17:52Z; trunk verified green on `abbb2519`.

### F2 — 🔴 EVERY PIPELINE GATE THIS PROJECT HAS BUILT IS ADVISORY ON A DOCS-ONLY PR

This is the finding, not F1. F1 is a symptom.

The ruleset requires four checks. On a docs-only diff the changed-path filter skips three of them,
and a skipped required check counts as satisfied — so **CodeQL alone gates a docs-only merge.**
`check-breadcrumb`, `lint-prompt`, `lint-station`, `Pipeline — arm-prompt tests`, and the whole
`PR gates — diff checks` job (CP-09–13, CP-17, CP-22, CP-23) can all be red and the PR still merges.
`#1482` is the proof, not a hypothesis: it merged at 05:42:16Z with `Pipeline — watcher + linter
tests: COMPLETED FAILURE` on it.

This also explains the standing CP-26 escalation from a different angle. CP-26 was analysed as
"advisory because it is a step inside a job rather than a check run". True, and incomplete: **the job
it sits in is not required either.**

**ESCALATED — Marco. RULE 1 order:**

**(A) Add the two pipeline jobs to the ruleset's required set — `Pipeline — watcher + linter tests`
and `PR gates — diff checks` — after confirming each runs (not skips) on every diff shape.**
Complete: a gate that can fail a PR is the only kind that gates one. Additive: nothing already
merging stops merging, because both jobs are green on every PR that is not actually broken. This is
the only option that passes both halves of RULE 1. ⚠️ It must be verified first that neither job is
path-filtered to `skip` on a code-only diff — a required check that never reports blocks the branch
outright.

**(B) Make the jobs required but keep an explicit bypass for Marco.** Fixes today; fails the future
half, because the bypass is exercised by the same actor under the same time pressure that produced
`#1482`.

**(C) Leave it and rely on stations reading their own CI.** Fails both halves. Four station runs
read a red `Pipeline` job on the board today and none of them stopped a merge; the trunk went red
anyway.

**This is a repo-settings change and therefore yours** — Station 00 does not grant itself gates.

### F3 — `needs-marco/` was carrying ten dead escalations that every sweep re-reported

Station 06 handed this over at 05:35Z with four measured-dead files and two it could not judge; the
sweep's own gh cross-check found nine `[STALE]` lines plus more. [MEASURED] I read both
`WATCHER-CRASH-LOOP-2026-08-18-*.md` before moving them: identical auto-generated supervisor
templates, `Watcher exited with code -1`, eleven minutes apart on 2026-08-18. The condition they
escalate is refuted live — watcher node RUNNING pid 2292, wrapper alive, heartbeat 1 min. Spent.

Retired by MOVE into `needs-marco/resolved-2026-09-01/`, the convention the folder already carries
and which had not been used since 2026-07-20. Left in place: `pr-1477-review-block.md` (live),
`CONFLICT-materialdensity-524-vs-11c`, `pr-plan-site-dissolution-slice0-DISARMED`, and
`pr-subbie-rate-cards-scope-pricing-HOLD.md` — the last has stale PR refs but is a **prompt**, not
an escalation, and binning it is a queue decision I did not make on a sweep line alone.

**DISPOSITION: ACTIONED** — 16 files → 6.

### F4 — `status-sweep.ps1` threw on every run, and the dispatch that named it overstated the cure

03 (23:02Z) and 04 (02:10Z) both dispatched this. Fixed with 04's cure — `-File` on the
`Get-ChildItem` feeding `Measure-Object -Property Length` — and explicitly **not** 03's alternative
`-ErrorAction SilentlyContinue`, which would silence the message and leave the value unmeasured.

[MEASURED] One correction back to 04: it wrote that the filter fixes "the message **and** the
number". The number does not change — `fix-followup-notes` still prints `size=0KB`, because with 0
files that is the true answer. What changes is that the zero is now a measurement instead of a
swallowed error, and no other escapee's size can be silently nulled by a directory entering the
pipeline. Right cure, slightly wrong reason.

**DISPOSITION: ACTIONED** — `#1487` open, verified by running the patched sweep (no `Measure-Object`
error, all nine sizes rendered). **Its merge is Marco's:** the diff touches `scripts/`, outside
`^(tests|docs)/`.

### F5 — Station 00 went SILENT for 5.7 hours: two scheduled runs produced nothing

Cadence is 2h; the last 00 breadcrumb before this one is 00:37Z. The 02:09Z and 04:09Z runs left no
report. A silent station is not a quiet one — either they did not fire, or they fired blind and
exited without saying so, and both are defects. I cannot distinguish them from here: the cause of
Station 00's intermittent blindness is a known open unknown (~40% of recent runs, per
`STATION-CAPABILITIES.md` §2), and the last measured shape was a
`desktop-commander CONNECT_TIMEOUT after 30000ms` at 22:11Z — present and not answering, not absent.

**DISPOSITION: ESCALATED** — folded into the existing open DC-blindness escalation rather than filed
as a new one. Diagnosing the first 30 seconds of that connect is host-side and Marco's. What is new
and worth carrying: **the gap is now costing measurable work** — a red trunk sat unnoticed from
05:42Z to 06:14Z across a window in which a 00 run should have fired.

### F6 — 06's arming dispatch is real but not yet actionable; the chain gates itself correctly

06 (05:25Z F3) handed Station 00 the `pr-cardui-s3` … `s7` chain, each gated on the previous slice's
token. [MEASURED] `s3`'s gate is `SCOPE_WBS_TABLE_V1`, produced by `#1483` — still OPEN, carrying a
live `do-not-merge`. So nothing in the chain is armable, and `triage-holds.ps1` agrees: the
still-gated bucket is 28. **Real armed count is 0** and I deliberately armed nothing this run.

The reason is F2's cousin: three of the five open PRs are Marco's by the policy classifier, and
arming more feature work lengthens his queue rather than shortening it. **A gate, not a memory, will
decide when `s3` becomes armable — that is the chain working as designed.**

**DISPOSITION: DEFERRED** — becomes urgent the moment `#1483` lands; the next 00 run should re-run
`triage-holds.ps1` rather than trusting this line.

### F7 — 06's `#1477` escalation has a third option it did not have

06 put it to Marco as "merge `#1477`, or tell me to close it — there is no third option that leaves
the spec type-checked." [MEASURED] There is: the reviewer's BLOCK verdict names the exact fix (three
overrides at `:288`, `:309`, `:326` plus the CP-22 checkbox). Someone can make it green first.

**ESCALATED — Marco:**
**(A) Station 00 fixes `#1477` green next run, then you merge it.** Complete — the fake summary
literal that has now broken three times gets one annotated helper — and additive: it is a test-only
change with a named, bounded diff. **(B) Merge it as-is** — it is red; it will not merge.
**(C) Close it** — fails the future half; the fixture keeps silently feeding those specs a shape
production does not produce, which is the defect `#1477` was written to end.
I did not start (A) this run because the trunk was red and that came first.

### F8 — Collected and closed: Station 06 armed eight prompts and merged three PRs, and has stopped

Disclosed by 06 itself at 05:25Z after Marco ruled it back to its doc. Eight arms via
`arm-prompt.ps1` (never a bare `git mv`), three merges (`#1439`, `#1470`, `#1472`). I read this as a
known closed episode, not as drift discovered. Its `#1472` auto-merge grant is **withdrawn by 06 at
the same tracked path it was made** — so from here, `autoMerge=ENABLED` on any PR is unexplained
again unless a station declares it, which is why my `#1484` arming is declared under WHAT CHANGED.

**DISPOSITION: ACTIONED** — collected, dispositioned, nothing outstanding.

### F9 — 🔧 INSTRUMENT: `git worktree list` caught the shared dev tree mid-checkout

[MEASURED] At ~06:4xZ `git worktree list` returned `C:/ProjectOperations2 b765afc5 [crm-uifix-s1]` —
the **shared dev tree on a feature branch.** Thirty seconds later the reflog read
`000de2d9 HEAD@{0}: checkout: moving from crm-uifix-s1 to main`, with no `MERGE_HEAD`, no rebase and
no `index.lock`. An agent had built `#1486` there and put it back.

Had I treated that first reading as a finding I would have raised a false alarm about a corrupt
shared tree — and the doctrinal response to *that* is a `git checkout main`, which is THE BOARD TRAP.
**`worktree list` is as `[LIVE]` as a process listing; a branch name it returns is a sample, not a
state.** Check the reflog and `MERGE_HEAD` before concluding anything from it.

**DISPOSITION: DEFERRED** — worth a DOCTRINE §9.2 line, but it belongs in a docs-only arm rather
than hand-landed alongside a trunk fix. Bank it with the `packed-refs` addendum already deferred
from 2026-08-31T22:11Z; two §9.2 additions are worth one prompt.

### F10 — 🔴 `check-breadcrumb.mjs` REJECTS any breadcrumb that QUOTES a `check-breadcrumb` failure

Found by walking into it. This report failed its own validator with
`FINDINGS section carries no disposition`, while carrying nine of them.

[MEASURED] `check-breadcrumb.mjs:checkOne` locates each contract section with a bare
`text.indexOf(s)` over the whole file, then derives the FINDINGS body as the slice from
`indexOf('## FINDINGS')` to the first later section index. My WHAT I MEASURED quoted the CI failure
verbatim — and that output contains the literal strings `missing section: ## FINDINGS` and
`missing section: ## WHAT I DID NOT DO`. Those quotes became the first matches, so the tool computed
`fi=1751, wi=1792` and a **FINDINGS body 41 characters long** out of a 17,735-character file, found
no disposition inside it, and rejected the report:

```
fi 1751  wi 1792  len 17735
bodylen 41
ACTIONED false  DISPATCHED false  ESCALATED false  DEFERRED false
```

The trap has a nasty shape: **the one report most likely to quote a `check-breadcrumb` failure is
the report written by the station diagnosing a red trunk caused by `check-breadcrumb`** — exactly
this one. It also fires on any breadcrumb quoting a contract heading inline, and the error message
it produces (*"carries no disposition"*) points at the wrong thing entirely, so the next station to
hit it will go looking at its dispositions, which are fine.

Worked around here by rendering the four quoted markers as `<H2>`. That is a workaround in one file,
not a fix.

**DISPOSITION: DISPATCHED → Station 06**, to stage as a prompt (it is a `scripts/` change, so it
needs a proper slice and a review, not a hand-landing by me at the end of a long run). The fix in one
line: anchor the section scan to line starts — match `/^## SECTION$/m` rather than `indexOf` — and
add a fixture that quotes a rejection message, so the regression can never return silently. RULE 1:
the anchored match is complete (it cannot be fooled by quoted or indented text) and additive (every
correctly-headed breadcrumb on main still passes; the 10 currently on the board were re-checked
under the current rule this run and only this file failed).

## WHAT I DID NOT DO

- **Did not merge `#1483`, `#1478`** — both carry a live `do-not-merge` label. Two independent gates,
  both binding.
- **Did not merge `#1477` or `#1487`** — hand-classified MARCO'S under `classifyPolicyFiles`
  (`apps/api/…` and `scripts/…`, both outside `^(tests|docs)/`). Recorded as
  `[NO LANE VERDICT — hand-classified]` in each PR body, never as "no verdict found".
- **Did not arm anything.** Real armed count 0, verified on disk, twice.
- **Did not fast-forward the dev tree.** It sits at `000de2d9` behind `origin/main`; the reflog shows
  the watcher FFs it itself (`pull --ff-only origin main --quiet`, repeatedly), and it is a shared
  tree another actor was checking out during this run.
- **Did not touch the watcher clone, the watcher process, or any launcher** — 03's lane, and 00 is
  barred from git in `C:\po-watcher\**`.
- **Did not run `git` through the device bridge** against the Windows `.git` — the failure 06 hit
  eight hours ago, fourth occurrence.
- **Did not delete a single file.** Every retirement this run was a MOVE.
- **Did not touch `/sot/`, Azure/Entra/SharePoint, production data, or any label.**
- **Did not prune the nine worktree escapees** — 03's, and `C:\po-worktrees\ph` alone is 914 MB;
  `git status --short` in each is required before anyone suggests deletion.
