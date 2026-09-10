# Station 00 — Supervisor | 2026-09-10T21:08:39Z–2026-09-10T21:3xZ

**SIGHTED RUN.** Desktop Commander reached the box on the first call after a `ToolSearch` load.
One breadcrumb collected and archived, **eleven dead escalations discharged out of Marco's queue**
after individually re-verifying every PR they name, the recurrence gated in this station's own doc,
nothing armed, nothing merged but this run's own docs PR, no label touched.

Fresh negative-control needles minted this run: `zzQq00Needle20260910T2115`,
`zzQq00Needle20260910T2118`, `zzQq00Needle20260910T2130`. They are written down here and are
therefore SPENT — mint new ones.

## GROUND

```
UTC            2026-09-10T21:08:39Z
origin/main    72684fb0              (git fetch origin +refs/heads/main:..., then git rev-parse --short)
dev tree       main @ 72684fb0       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** — this run was not read-only-gated.

`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` returned **EMPTY** on all three, and
`git rev-list --left-right --count HEAD...origin/main` returned `0 0`, so reading the working copy
was sound this run. All three were read in full: DOCTRINE **2064** lines, STATION-CAPABILITIES
**514**, this station's doc **1300**.

⚠️ **The host clock and the session's declared date disagree by ten hours, and only UTC is used
here.** The box is Brisbane (UTC+10); the session declares "Friday, September 11, 2026" while UTC is
`2026-09-10T21:08Z`. Every timestamp below is UTC and this file is named `2026-09-10-2108`.

## WHAT I MEASURED

**[MEASURED] Host reachable — NOT blind.** Schemas loaded via `ToolSearch` first (a validation error
is not blindness), then `start_process` shell `powershell.exe` → PID **28132**, which answered
`2026-09-10T21:08:39Z` and `git rev-parse --abbrev-ref HEAD` → `main`.

**[CANNOT MEASURE] `scripts/pipeline/vm-git-guard.sh` was NOT installed — eighth consecutive station
run.** PREFLIGHT step 1 asks for the installer's last line quoted, pass or fail. It cannot be quoted:
the Cowork Linux workspace refused to start, verbatim — `bash failed on resume, create, and
re-resume … source path … is under Plan9 share "c" which is not mounted; create: RPC error -1:
ensure user: user eloquent-wonderful-wright already exists unexpectedly`. **Exposure is nil: with no
VM there was no VM-side `git` to guard**, and every probe below ran through Desktop Commander on the
Windows host. Already carried by three `needs-marco/` files — see F3.

**[MEASURED] `status-sweep.ps1` — run TWICE, captured to a file both times, decoded from UTF-16LE,
never read from the early return.** 21:09:40Z raw **136,376** bytes → **402** lines; 21:17:30Z raw →
**384** lines. Section 0 instrument controls `[LIVE]` PASS on both (`gh` saw merged `#1860`; `node`
runs), so no `[BROKEN]`. **Section 7 verdict SAFE TO ACT on both**, the second taken minutes before
this run's only board mutation, as PREFLIGHT step 4 requires. `index.lock` interactive/clone
**False / False**, git processes **0**, no PR touched in the last 2 min, main CI on `72684fb0`
**5 success / 0 failed** (trunk green).

**[MEASURED] Q1 — the open board, verbatim, and all five are Marco's.** `gh` called with `-R` on
every invocation and `$LASTEXITCODE` tested before parsing (DOCTRINE §9.4's CWD trap).

| PR | created | mergeState | CI | labels | files | lane verdict |
|---|---|---|---|---|---|---|
| `#1852` | 09-10T13:21:20Z | CLEAN | 15/0/0 | `[]` | 1 | **`NO LOG` — hand-classified MARCO'S** |
| `#1850` | 09-10T12:02:05Z | CLEAN | 15/0/0 | `[]` | 1 | `marco:true` — `outside tests/ or docs/: scripts/pipeline/triage-holds.ps1` |
| `#1845` | 09-10T09:37:57Z | CLEAN | 15/0/0 | `[]` | 1 | `marco:true` — `outside tests/ or docs/: scripts/pipeline/status-sweep.ps1` |
| `#1832` | 09-10T00:12:33Z | CLEAN | 15/0/0 | `[]` | 1 | `marco:true` — `outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh` |
| `#1823` | 09-09T00:05:42Z | CLEAN | 15/0/0 | `[]` | 6 | `marco:true` — `escalates:true - held for Marco, labelled do-not-merge` |

**Q1 answer: ZERO are DIRTY.** No PR on this board has frozen CI; every one is fully green. Q2: no
conflict exists, so nothing to resolve and nothing to escalate as one.

**RULE 2 probe, with the controls the standing rule requires.** Pinned to the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed`, never the clone: **2120** logs, newest
`rev-1859-ready.md.log` at `2026-09-10T19:30:07Z`. `-Pattern 'marco.:true'` (regex, the dot matches
the quote — the `-SimpleMatch` form returns 0 **and so does its negative control**) → **POSITIVE
629**; NEGATIVE control, this run's minted needle → **0**. **Freshness precondition asserted:** the
newest log (19:30Z) is younger than the newest open PR (`#1852`, 13:21Z), so `NO LOG` is not a
staleness artefact. Per-PR on `PR #<n>` in the BODY of `pr-*.log` only, `rev-*.log` excluded because
a review job names PRs from both lanes and carries zero lane information: `#1850` → 2, `#1845` → 2,
`#1832` → 2, `#1823` → 2, **`#1852` → 0**; NEGATIVE control `PR #999999` → **0**. Each of the four
carries exactly **one** `merge result for PR #<n>:` verdict line, quoted in the table above.

**`#1852` hand-classified under DOCTRINE 10.1 step 2 and recorded as
`[NO LANE VERDICT — hand-classified]`.** Re-measured this run, not inherited: `gh pr view 1852 --json
files` → **one** file, `scripts/pipeline/status-sweep.ps1`. No `(^|/)migrations/` path, and outside
all three `NESTED_TEST_PATHS` forms. **MARCO'S.** ⚠️ All five read `labels=[]`, and `#1823`'s own
watcher verdict records the `do-not-merge` label it once carried. **Marco removing a label does not
clear RULE 2.**

**[MEASURED] Q3 — armed prompts counted by hand, not quoted from a note.**
`Get-ChildItem docs\pr-prompts -Filter *-ready.md` → **0**, at the start of the run and at the end.
`-HOLD.md` at depth 1 → **40**. `triage-holds.ps1`: `spent=0 gates-satisfied=9 still-gated=31
unreadable=0 of 40`.

**[MEASURED] Every arm available today still lands on Marco — 0 of 9, re-derived with the EXTRACTION
step controlled separately from the DECISION step** (DOCTRINE §9.3's CRLF front-matter bullet). The
`\s*\n` list-form scope matcher extracted **0** scope entries across the nine; the CRLF-explicit form
extracted **44**. So the broken parser would have produced the identical headline off nine zero
counts, and this one did not. Classifier controls: `tests/e2e/foo.spec.ts` → true,
`docs/pipeline/X.md` → true, `a/__tests__/b.mjs` → true, `apps/api/src/main.ts` → false,
`apps/api/prisma/migrations/x/migration.sql` → migration true.

```
MARCO  pr-brandtheme-s3-full-palette-columns               scope=8 migration=Y  apps/api/prisma/schema.prisma
MARCO  pr-brandtheme-s6-live-preview-contrast-and-override scope=6 migration=n  apps/web/src/lib/contrast.ts
MARCO  pr-company-manage-s1-permission-and-grant           scope=4 migration=Y  apps/api/src/common/permissions/permission-registry.ts
MARCO  pr-e2e-container-s2-swap-required-job               scope=2 migration=n  .github/workflows/playwright.yml
MARCO  pr-fv2-maintenance-usage-intervals                  scope=5 migration=Y  apps/api/prisma/schema.prisma
MARCO  pr-qpdf-1-estimate-preview-mark                     scope=6 migration=n  apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts
MARCO  pr-qpdf-3-quoteref-collision-409                    scope=3 migration=n  apps/api/src/modules/client-quotes/client-quotes.service.ts
MARCO  pr-qpdf-4-freeze-issued-terms                       scope=6 migration=n  apps/api/src/modules/client-quotes/quote-pdf.service.ts
MARCO  pr-rateparity-s1-harness                            scope=4 migration=n  apps/api/src/modules/rates/charge-step-parity.service.ts
TESTS-DOCS ELIGIBLE = 0 of 9
```

**[MEASURED] Watcher health from the ONE sanctioned probe, plus the parent chain.**
`restart-watcher-if-wedged.ps1` (no `-Fix`) → **`VERDICT: OK - nothing armed and the watcher is
alive. An idle watcher is correct, not wedged.`** — pid **18228**, `restart churn: 0 cycle(s) in
20 min`. ENSURE-UP resolved by PARENT CHAIN rather than by name, because a command-line probe cannot
see a supervisor invoked with the call operator: node **18228** ← `start-watcher.ps1` (**20704**) ←
`watcher-launcher-singlelane.ps1` (**19848**). **Supervised — no relaunch, and none attempted.**

**[MEASURED] Q5 — silent no-ops.** `no-pr-opened/` **109**, newest `2026-09-02T03:47Z`, over eight
days old; `failed/` **45**, newest `rev-1837-ready.md.log` at 09-10T02:41Z, which is a REVIEW JOB and
not a prompt. **No NEW silent no-op since the last collect.** Nothing was waved away as expected.

**[MEASURED] COLLECT corpus and the freshness cross-check.** `check-breadcrumb.mjs --freshness`:
`structure: 1 checked, 0 malformed, 0 skipped`, **`CLEAN`, exit 0**. Every breadcrumb written before
20:08Z is already in `archive/`; the ONLY uncollected one is my own 20:08Z report, and I asked the
TRACKED SET rather than the dev tree before treating it as anything (`git ls-files docs/pr-prompts`
matched by basename — it is tracked at the root path, landed by `#1860`). Freshness crossed against
`lastRunAt`, which the `00` row needs because `check-breadcrumb.mjs`'s own `CADENCE` map still reads
`'00': 2` against a live cron of `5 * * * *`:

| station | cron | newest breadcrumb | reading |
|---|---|---|---|
| `00` | `5 * * * *` | 2026-09-10T20:08Z | 1.1h ago, firing hourly, aligned |
| `03` | `0 9 * * *` | 2026-09-09T23:01Z | 22.2h ago (cadence 24h) ok |
| `04` | `0 */4 * * *` | 2026-09-10T18:10Z | 3.0h ago ok |
| `05` | `10 0 * * *` | 2026-09-10T14:11Z | 7.0h ago ok |

**None SILENT, and no station's newest breadcrumb is missing against a fresh run.**

**[MEASURED] Eleven `needs-marco/` files were dead, and neither the sweep's tag nor a list response
was trusted to say so.** See F1 for the table. Root count **57 → 46**, `discharged/` **45 → 56**,
read-backs both directions: **0** of the eleven left at the root, **11** of eleven present in
`discharged/`.

**[MEASURED] The watcher clone is NOT corrupt.** Read-only `git` only. Branch `main`, `dirty=2` in
the sweep — which is the false warning my own 20:08Z run measured and landed in DOCTRINE §9.5: the
sweep counts UNTRACKED files and `start-watcher.ps1` does not, and a tracked-dirty clone
auto-stashes rather than refusing. The two entries are review verdicts the `rev-<N>` job writes there
by design. `MERGE_HEAD`, rebase state and unmerged paths: the sweep's corruption test reported none,
so `rescue-watcher-repo.ps1` must not run.

## WHAT CHANGED

**One board PR, and one gitignored dev-tree cleanup. Nothing armed, nothing merged but my own docs
PR, no label touched, no watcher restart.**

1. **Board PR — one doc edit plus one archive move, in a disposable worktree at
   `C:\po-wt\00-collect-2108` off `origin/main`:**

   | file | before → after | what |
   |---|---|---|
   | `docs/pipeline/stations/00-supervisor.md` | 82556 → 84217 | F1's rule added to the COLLECT bullet |
   | `docs/pr-prompts/00-00-supervisor-…-2008-….md` | `git mv` | collected, moved into `archive/` |

   The doc edit was made in **node by concatenation with a byte-delta assertion** — never a
   `String.replace` replacement string, which DOCTRINE §9.3 records injecting an entire file into
   itself: `EXPECTED_DELTA=1661`, `ACTUAL_DELTA=1661`, **equal**; anchor still unique afterwards;
   negative control absent. The edit sits **outside** the `station-contract v3` canonical block, so
   no hash re-record was needed and `lint-station.mjs` read **`ADMIT: all 8 docs clean`, exit 0**
   without one — the confirming sample of "a station-doc edit outside the block costs zero
   re-records".

2. **This breadcrumb was written INSIDE the worktree**, which is cure 1 of the post-merge
   fast-forward rule: no loose untracked copy is left in the dev tree to block the next FF.

3. **Eleven files moved within `docs/pr-prompts/needs-marco/`**, which is gitignored and therefore
   lives in the dev tree only — plus one new
   `discharged/_DISCHARGE-NOTE-eleven-stale-pr-escalations-2026-09-10.md` recording every
   measurement. **Nothing was deleted.**

**Nothing else.** No prompt armed, disarmed, renamed or deleted. No label added or removed. No `sot/`
file touched. No watcher restart, no worktree pruned, no stash dropped, no branch deleted.
`git diff --cached --name-status` in the dev tree was **EMPTY** before I started, so no other chat's
staged work could be swept into my commit.

## FINDINGS

### F1 — S2 · ELEVEN DEAD ESCALATIONS SAT IN MARCO'S QUEUE FOR TEN DAYS BECAUSE THE HAND-OVER THAT WAS MEANT TO CLEAR THEM WAS ADDRESSED TO A STATION THAT CANNOT EXECUTE IT

`status-sweep.ps1` section 5 tags a `needs-marco/` file `[STALE]` once the PR it names has merged,
and prints its own instruction: *"escalation is DEAD, clear it. Do NOT report it as pending."* At
21:09Z there were **eleven** such rows, **11 of 57 files — 19% of Marco's escalation queue**, the
oldest naming a PR merged on **2026-09-03**.

**The reason they survived is a routing error, not neglect.** The standing hand-over reads
*"DISPATCHED -> 03: discharge the dead `needs-marco/` files the sweep tags `[STALE]` every run (MOVE
to `needs-marco/discharged/`, never delete)"* and has been carried since **2026-08-31** — it is still
quoted verbatim in the `[FILE]` snapshot the sweep prints every run. **Station 03 cannot do it.** Its
authority row in `STATION-CAPABILITIES.md` is **report-only**, and `needs-marco/` is an escalation
queue rather than a machine, so it is not 03's to mutate under any reading. A dispatch nobody may
execute is re-issued every run and never lands — which is exactly the shape DOCTRINE §9.5 records for
*"a disposition addressed to a FUTURE RUN outlives its own fix"*, one layer up: addressed to a future
**station**, which has no authority to answer.

**Nothing was discharged on the sweep's tag.** DOCTRINE §9.4 records that `merged` reads `false` on
every entry of a pull-request LIST response, so each PR was re-asked individually with
`gh pr view <n> -R GH-Mantova/ProjectOperations --json number,state,mergedAt`, `$LASTEXITCODE` tested
before parsing:

| PR | state | `mergedAt` | file |
|---|---|---|---|
| `#1532` | MERGED | 09-03T06:31:08Z | `pr-1532-review-fix.md` |
| `#1593` | MERGED | 09-04T21:17:22Z | `pr-1593-review-block.md` |
| `#1633` | MERGED | 09-05T04:11:37Z | `pr-1633-review-block.md` |
| `#1646` | MERGED | 09-05T08:50:16Z | `pr-1646-review-block.md` |
| `#1662` | MERGED | 09-06T01:52:40Z | `pr-1662-destructive-migration-open-on-the-board-2026-09-05.md` |
| `#1685` | MERGED | 09-06T03:47:00Z | `pr-1685-review-fix.md` |
| `#1740` | MERGED | 09-07T04:24:56Z | `pr-1740-released-with-no-receipt-2026-09-07.md` |
| `#1756` | MERGED | 09-07T03:47:11Z | `pr-1756-review-block.md` |
| `#1774` | MERGED | 09-07T19:50:20Z | `pr-1774-released-but-cp26-demands-a-receipt-2026-09-07.md` |
| `#1777` | MERGED | 09-07T20:07:35Z | `pr-1777-is-green-and-its-only-review-verdict-is-stale-2026-09-07.md`, `pr-1777-review-fix.md` |

**NEGATIVE control:** `gh pr view 999999` → exit **1**, **0** chars on stdout — so an answer here is
an answer, and not the empty-board reading §9.4's CWD bullet warns about.

**And every file was READ, not matched on its filename.** All eleven are review blocks, review fixes
or single-PR hand-overs whose entire subject is one merged PR.

🔴 **The one thing that could have been lost, and was not.** Two of the eleven (`pr-1740-…`,
`pr-1774-…`) also touch a GENERAL question — *who may write a `docs/decisions/merge-approvals/<N>.md`
receipt, and what verifies one*. That question is **not** discharged: it survives independently in
two live root files the sweep does not tag, both confirmed present at the moment of the move —
`nothing-verifies-a-merge-approval-receipt-2026-09-07.md` and
`cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05.md`. **A PR-scoped
escalation may only be discharged after checking that its general half has another home.**

**DISPOSITION: ACTIONED.** All eleven MOVED (never deleted) into
`docs/pr-prompts/needs-marco/discharged/` with a `_DISCHARGE-NOTE-…` carrying the table above and
both controls; root **57 → 46**, `discharged/` **45 → 56**, read-backs 0 and 11. The recurrence is
gated in this run's board PR by a new rule in this station's own COLLECT bullet, which puts the job
where the authority is and names the verification the tag does not justify. ⚠️ **Falsifying probe,
and it was RUN: re-run the sweep and read section 5.** At 21:17:30Z the eleven `[STALE]` escalation
rows are **GONE** — the only four `[STALE]` matches left in the whole report are the sweep's own
legend lines and the `[FILE]` snapshot quoting the dispatch — and `needs-marco/` reads **46**.

### F2 — S3 · A SCHEDULED RUN'S ONLY BOARD LEVER TODAY IS STILL ITS OWN DOCS PR, RE-DERIVED RATHER THAN INHERITED

Not a defect — the measured statement that governs whether I arm.

**Five PRs open, all five green, all five waiting on Marco** — four with a live `marco:true` verdict
and `#1852` hand-classified on a one-file `scripts/` diff. **Nine gate-satisfied HOLDs and 0 of 9 can
enter the `tests-docs` lane**: every one names `apps/`, `.github/` or a `migrations/` path. So the
only arm available today opens a **sixth** PR that Marco must also merge, and the queue grows
monotonically. The `tests-docs` lane is not broken — it is **starved of eligible work**, which is a
different problem with a different owner.

⚠️ The parser was controlled as well as the classifier this run: **0 scope entries against 44**. The
answer is the same either way, and now it is known to be the same for the right reason.

**DISPOSITION: DEFERRED.** It becomes urgent the moment the board holds a PR that is NOT Marco's and
is not moving, or a gate-satisfied HOLD appears whose scope is `tests/` or `docs/` only — at which
point arming resumes with no further question. Neither was true this run. ⚠️ **These are counts, i.e.
state — re-measure, never quote.**

### F3 — S3 · THE LINUX WORKSPACE HAS NOW FAILED FOR EIGHT CONSECUTIVE STATION RUNS, WITH DESKTOP COMMANDER HEALTHY FOR THE THIRD OF THEM

Same RPC error naming an unmounted Plan9 share and a session user that "already exists unexpectedly",
with a different session name — so the failure follows the workspace, not the session. This is the
**third** consecutive sighted run to meet it, which makes "Desktop Commander healthy, mount gone" a
pattern rather than a coincidence.

Cost this run: nil. There was no VM-side `git` for the uninstalled guard to protect, and every probe
ran on the Windows host through Desktop Commander.

**DISPOSITION: DEFERRED, not re-escalated.** Three files already carry it —
`linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md`,
`cowork-vm-mount-unreachable-two-stations-2026-09-10.md` and
`station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` — and a fourth would split one
question across four homes. It becomes urgent for a **blind** run; the third-transport block in
`STATION-CAPABILITIES.md` (`NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`) is what stops that being fatal.
⚠️ **The consecutive-run count is STATE — re-measure it, never quote it.**

## WHAT I DID NOT DO

- **Merged nothing but my own docs-only board PR, and cleared no RULE 2 verdict.** Four of the five
  open PRs carry a live `marco:true` line and the fifth hand-classifies as Marco's on a one-file
  `scripts/` diff. `labels=[]` on all five is not a clearance — `#1823`'s own verdict records the
  label it once carried, and Marco removing a label does not clear RULE 2.
- **Removed no `do-not-merge` label and authored no `merge-approvals/<N>.md` receipt.** A scheduled
  run never may; Marco's 2026-09-07 ruling covers the supervised cloud lane only, and this is the
  scheduled one.
- **Deleted nothing.** The eleven discharged escalations were MOVED and are recoverable from
  `needs-marco/discharged/`; the discharge note names every one.
- **Did not discharge any `[STALE]` row on the tag alone**, and did not touch the two live root
  escalations that carry the general receipt question.
- **Armed nothing.** Measured, not assumed: 0 of 9 gate-satisfied HOLDs can enter the `tests-docs`
  lane, with the extraction step controlled separately from the decision step.
- **Did not push to `#1852`.** My 20:08Z run's F1 fix belongs in that PR, and it went to Marco as an
  option rather than as a fait accompli; changing an open PR's contents changes what he is approving.
- **Did not touch `scripts/`, did not edit `/sot/`, and did not go near Azure, Entra or SharePoint.**
- **Did not restart the watcher, run `rescue-watcher-repo.ps1`, prune a worktree, drop a stash or
  delete a branch.** The clone is on `main` and not corrupt. Two orphaned worktrees remain —
  `C:/po-vg` at **9436** min holding one uncommitted file, and `C:/po-worktrees/pr1823` at **1378**
  min clean — both already dispatched to 03 and neither touched. The clone's stashes are likewise
  03's, and `git stash drop`, never `pop`.
- **Did not diagnose anything from the diff or a PR page**, and did not re-run anything hoping for
  green: all five PRs are green already.
- **Left the three untracked non-ignored dev-tree files alone** — `Claude Design/docs/index.html`,
  `docs/pr-prompts/.queue-sync-ledger.txt` and `docs/pr-prompts/queue-watch-state.md`. None is a
  breadcrumb and none is mine to commit.
- **Did not run `git` against any mount** — there was no mount — and did not run `git checkout .`,
  `reset --hard`, `stash pop` or `git clean` anywhere, in any tree.
