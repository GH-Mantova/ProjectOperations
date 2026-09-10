# Station 00 — Supervisor | 2026-09-10T20:08:15Z–2026-09-10T20:5xZ

**SIGHTED RUN.** Desktop Commander reached the box on the first call after a `ToolSearch` load.
Three breadcrumbs collected and archived, one new instrument defect measured and landed, one
escalation filed, nothing armed, nothing merged, no label touched.

Fresh negative-control needles minted this run: `zzQq00Needle20260910T2008`,
`zzQq00Needle20260910T2020`, `zzQq00Needle20260910T2026`, `zzQq00Needle20260910T2033`. They are
written down here and are therefore SPENT — mint new ones.

## GROUND

```
UTC            2026-09-10T20:08:15Z
origin/main    2ea16157              (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 2ea16157       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** — this run was not read-only-gated.

`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` returned **EMPTY** on all three, so the working copies of
the binding documents are not different from `origin/main` and reading them there was sound. All
three were read in full: DOCTRINE 2029 lines, STATION-CAPABILITIES 514, this station's doc 1299.

⚠️ **The host clock and the session's declared date disagree by ten hours, and only UTC is used
here.** The box returned `2026-09-11T06:08:25+10:00` = `2026-09-10T20:08:25Z` while the session
declares "Friday, September 11, 2026". Brisbane is UTC+10; both are right and the local one cannot
name a run. Every timestamp below is UTC and this file is named `2026-09-10-2008`.

## WHAT I MEASURED

**[MEASURED] Host reachable — NOT blind.** Desktop Commander schemas loaded via `ToolSearch` first
(a validation error is not blindness), then `start_process` shell `powershell.exe` → PID 17560,
`2026-09-11T06:08:25.8129503+10:00`, host `LAPTOP-E6NHU4E4`.

**[CANNOT MEASURE] `scripts/pipeline/vm-git-guard.sh` was NOT installed this run — seventh
consecutive station run.** PREFLIGHT step 1 asks for the installer's last line quoted, pass or fail.
It cannot be quoted: the Cowork Linux workspace refused to start, verbatim — `bash failed on resume,
create, and re-resume … source path … is under Plan9 share "c" which is not mounted; create: RPC
error -1: ensure user: user brave-compassionate-pascal already exists unexpectedly (attempt 1 of 5)`.
**Exposure is nil: with no VM there was no VM-side `git` to guard**, and every probe below ran
through Desktop Commander on the Windows host. Already open — see F4.

**[MEASURED] `status-sweep.ps1` — captured to a file, decoded from UTF-16LE, not read from the early
return.** Exit 10, raw **137,434** bytes opening `FF FE`, decoding to **825** lines / 68,722 bytes —
the `*>` trap DOCTRINE 9.3 records, met exactly as written. Section 0 instrument controls both
`[LIVE]` PASS (`gh` saw merged `#1859`; `node` runs), so no `[BROKEN]`. **Section 7 verdict: SAFE TO
ACT** — no board mutation in progress, no remote activity in two minutes, no live station worktrees.
`index.lock` false / false, git processes **0**, main CI on `2ea16157` **4 success / 0 failed**
(trunk green), armed **0**.

**[MEASURED] Q1 — the open board, verbatim, and all five are Marco's.** `gh pr list` with `-R` on
every call and `$LASTEXITCODE` tested before parsing (9.4's CWD trap: this shell opens in the Cowork
`outputs` folder, which is not a git repository).

| PR | created | state | CI | labels | lane verdict |
|---|---|---|---|---|---|
| `#1852` | 09-10T13:21:20Z | CLEAN | 15/0/0 | none | **`NO LOG` — hand-classified MARCO'S** |
| `#1850` | 09-10T12:02:05Z | CLEAN | 15/0/0 | none | `marco:true` — `outside tests/ or docs/: scripts/pipeline/triage-holds.ps1` |
| `#1845` | 09-10T09:37:57Z | CLEAN | 15/0/0 | none | `marco:true` — `outside tests/ or docs/: scripts/pipeline/status-sweep.ps1` |
| `#1832` | 09-10T00:12:33Z | CLEAN | 15/0/0 | none | `marco:true` — `outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh` |
| `#1823` | 09-09T00:05:42Z | CLEAN | 15/0/0 | none | `marco:true` — `escalates:true - held for Marco, labelled do-not-merge` |

**Q1 answer: ZERO are DIRTY.** No PR on this board has frozen CI, and every one is fully green.

**RULE 2 probe, with the controls the standing rule requires.** Pinned to the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed`, never the clone: **2120** logs, newest
`rev-1859-ready.md.log` at `2026-09-10T19:30:07Z`. `-Pattern 'marco.:true'` (regex, the dot matches
the quote — the `-SimpleMatch` form returns 0 **and so does its negative control**) → **POSITIVE
629**; NEGATIVE control, this run's minted needle → **0**. **Freshness precondition asserted:** the
newest log (19:30Z) is younger than the newest open PR (`#1852`, 13:21Z), so `NO LOG` is not a
staleness artefact. Per-PR on `PR #<n>` in the BODY of `pr-*.log` only, `rev-*.log` excluded because
a review job names PRs from both lanes and carries zero lane information: `#1850` → 2, `#1845` → 2,
`#1832` → 2, `#1823` → 2, **`#1852` → 0**.

**`#1852` hand-classified under 10.1 step 2 and recorded as `[NO LANE VERDICT — hand-classified]`.**
Re-measured this run rather than inherited from my predecessor: `gh pr view 1852 --json files` →
**one** file, `scripts/pipeline/status-sweep.ps1`, head `9f5c4fad`. No `(^|/)migrations/` path and
outside all three `NESTED_TEST_PATHS` forms. **MARCO'S.** ⚠️ All five read `labels=[]`, and `#1823`'s
own watcher verdict records that it *was* labelled `do-not-merge`. **Marco removing a label does not
clear RULE 2.**

**[MEASURED] Q3 — armed prompts counted by hand, not quoted from a note.**
`Get-ChildItem docs\pr-prompts -Filter *-ready.md` → **0**, at the start of the run and at the end.
`-HOLD.md` at depth 1 → **40**, unchanged across the 1708, 1808, 1908 and this run.

**[MEASURED] Every arm available today still lands on Marco — 0 of 9, re-derived, not inherited.**
`triage-holds.ps1`: `spent=0 gates-satisfied=9 still-gated=31 unreadable=0 of 40`. The same nine
names as the 1908 run. **The EXTRACTION step was controlled separately from the DECISION step**
(9.3's newest bullet): the `\s*\n` list-form scope matcher matched **0 of 9** — every prompt is
CRLF — while the CRLF-explicit form matched **9 of 9**, so the broken parser would have produced the
identical headline off nine zero counts. Classifier controls: `tests/e2e/foo.spec.ts` → true,
`docs/pipeline/X.md` → true, `a/__tests__/b.mjs` → true, `apps/api/src/main.ts` → false,
`apps/api/prisma/migrations/x/migration.sql` → migration true.

```
MARCO  pr-brandtheme-s3-full-palette-columns             scope=8 migration=Y  apps/api/prisma/schema.prisma
MARCO  pr-brandtheme-s6-live-preview-contrast-and-override scope=6 migration=n apps/web/src/lib/contrast.ts
MARCO  pr-company-manage-s1-permission-and-grant         scope=4 migration=Y  apps/api/src/common/permissions/permission-registry.ts
MARCO  pr-e2e-container-s2-swap-required-job             scope=2 migration=n  .github/workflows/playwright.yml
MARCO  pr-fv2-maintenance-usage-intervals                scope=5 migration=Y  apps/api/prisma/schema.prisma
MARCO  pr-qpdf-1-estimate-preview-mark                   scope=6 migration=n  apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts
MARCO  pr-qpdf-3-quoteref-collision-409                  scope=3 migration=n  apps/api/src/modules/client-quotes/client-quotes.service.ts
MARCO  pr-qpdf-4-freeze-issued-terms                     scope=6 migration=n  apps/api/src/modules/client-quotes/quote-pdf.service.ts
MARCO  pr-rateparity-s1-harness                          scope=4 migration=n  apps/api/src/modules/rates/charge-step-parity.service.ts
TESTS-DOCS ELIGIBLE = 0 of 9
```

**[MEASURED] Watcher health from the ONE sanctioned probe, plus the parent chain.**
`restart-watcher-if-wedged.ps1` (no `-Fix`) → **`VERDICT: OK - nothing armed and the watcher is
alive. An idle watcher is correct, not wedged.`** — pid **18228**, `restart churn: 0 cycle(s) in
20 min`. ENSURE-UP resolved by PARENT CHAIN rather than by name, because a command-line probe cannot
see a supervisor invoked with `&`: node **18228** ← `start-watcher.ps1` (**20704**) ←
`watcher-launcher-singlelane.ps1` (**19848**). `WRAPPER_COUNT=1`. **Supervised — no relaunch, and
none attempted.**

**[MEASURED] Q5 — silent no-ops.** `no-pr-opened/` **109**, newest `2026-09-02T03:47Z`, over eight
days old; `failed/` **45**, newest `rev-1837-ready.md.log` at 09-10T02:41Z, which is a REVIEW JOB and
not a prompt. **No NEW silent no-op since the last collect.** Nothing was waved away as expected;
there is nothing new in either folder.

**[MEASURED] `#1832`'s red is GONE, which settles the previous run's falsifying probe in the flake
direction.** The 1908 run diagnosed the failure from the job log as a webkit-only `beforeEach`
timeout on a one-file shell-script diff, re-ran it, and named the probe: *"if attempt 2 fails on the
same webkit test this is no longer a flake"*. `gh pr checks 1832` now reads **15 pass / 0 fail /
0 pending**. **It was a flake.** `#1832` still carries a live `marco:true` verdict and stays for
Marco.

**[MEASURED] COLLECT corpus and the freshness cross-check.** `check-breadcrumb.mjs --freshness`:
`structure: 3 checked, 0 malformed, 0 skipped`, **`CLEAN`, exit 0**. Crossed against `lastRunAt` from
the scheduled-tasks MCP, which is the instrument the `00` row needs because `check-breadcrumb.mjs`'s
own `CADENCE` map still reads `'00': 2` against a live cron of `5 * * * *`:

| station | cron | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|---|
| `00` | `5 * * * *` | 2026-09-10T20:08:15Z — this run | 19:08Z | firing hourly, aligned |
| `03` | `0 9 * * *` | 2026-09-09T23:01:42Z | 09-09T23:01Z | aligned; daily, next 23:00Z |
| `04` | `0 */4 * * *` | 2026-09-10T18:09:53Z | 18:10Z | aligned |
| `05` | `10 0 * * *` | 2026-09-10T14:10:55Z | 14:11Z | aligned; daily |
| `weekly-security-audit` | `30 7 * * 1` | 2026-09-06T21:32:44Z | n/a | not a station; healthy |

**All five ENABLED, none SILENT, and no station's `lastRunAt` is fresh with a missing breadcrumb.**

**[MEASURED] Three uncollected breadcrumbs, all three already TRACKED on `origin/main`.** Before
treating any as unreported I asked the TRACKED SET and not the dev tree — `git ls-tree -r
--name-only origin/main -- docs/pr-prompts` matched by basename, **1121** entries — which is the
check `#1766`/`#1768` cost a run for skipping. `00` 1808, `00` 1908 and `04` 1810 were all present.
Every finding in all three already carries a disposition, so all three are this run's to archive.

**[MEASURED] The watcher clone is NOT corrupt, and its `dirty=2` is two untracked review files.**
Read-only `git` only. Branch `main`, head `e4ecd9a5`, `0 0` against its `origin/main`. `MERGE_HEAD`,
`REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply`, `index.lock` — **all absent**;
unmerged paths **0**. The two entries are `?? docs/pr-reviews/pr-1850-review.md` and
`?? docs/pr-reviews/pr-1852-review.md`. Stash count **71**. See F1.

**[MEASURED] The three review-verdict homes disagree again, and the leader is neither tree
consistently.** `#1850` (12:09:37Z) and `#1852` (13:24:50Z) exist ONLY in the clone; `#1845`
(16:30:39Z) exists ONLY in the dev tree; `verdicts-archive` holds none of the five. A fresh
confirming sample of 9.5's three-homes rule — *probe all three, take the newest* — and a reminder
that "no verdict for PR N" is UNMEASURED until all three have been checked.

**[MEASURED] I walked into 9.1's `$home` automatic-variable trap and its falsifying probe fired
exactly as written.** A `foreach ($home in @(<three review homes>))` loop produced **zero rows** and
threw `Cannot overwrite variable HOME because it is read-only or constant` to the error stream. Re-run
with `$reviewHome` it returned all fifteen rows (the table above). **The bullet is live and correct**;
recorded as a confirming sample, not as a new finding.

## WHAT CHANGED

**One board PR. Nothing armed, nothing merged, no label touched, no watcher restart.**

1. **Board PR — three tracked-file changes plus three archive moves, all in a disposable worktree at
   `C:\po-wt\00-collect-2008` off `origin/main`:**

   | file | before → after | what |
   |---|---|---|
   | `docs/pipeline/DOCTRINE.md` | 159582 → 162486 | F1's instrument bullet added to 9.5 |
   | `docs/pipeline/stations/_canonical-blocks.json` | re-recorded | `instruments v2 07c366698462be98` |
   | 3 × `docs/pr-prompts/00-*.md` | `git mv` | 1808, 1908 and 04's 1810 moved into `archive/` |

   The DOCTRINE edit was made in **node by concatenation with a byte-delta assertion** — never a
   `String.replace` replacement string, which 9.3 records injecting an entire file into itself:
   `EXPECTED_DELTA=2904`, `ACTUAL_DELTA=2904`, **equal**; anchor still unique; negative control absent.
   `lint-station.mjs` → **REJECT 1 of 8** before the re-record (`instruments` sha
   `07c366698462be98` vs expected `e539bf680412d5c5`) and **`ADMIT: all 8 docs clean`, exit 0**
   after — confirming a 9 edit costs ONE document, not seven. `check-breadcrumb.mjs` → **`CLEAN`,
   exit 0**.

2. **This breadcrumb was written INSIDE the worktree**, which is cure 1 of the station doc's
   post-merge fast-forward rule: no loose untracked copy is left in the dev tree to block the next FF.

3. **One write under `docs/pr-prompts/needs-marco/`**, which is gitignored and therefore lives in the
   dev tree only: `sweep-clone-dirty-flag-counts-untracked-files-2026-09-10.md` (F1's question).

**Nothing else.** No prompt armed, disarmed, renamed, moved or deleted. No label added or removed.
No PR merged other than this run's own board PR. No `sot/` file touched. No watcher restart, no
worktree pruned, no stash dropped, no branch deleted. `git diff --cached --name-status` in the dev
tree was **EMPTY** before I started, so no other chat's staged work could be swept into my commit.

## FINDINGS

### F1 — S2 · THE SWEEP'S CLONE-DIRTY FLAG COUNTS UNTRACKED FILES, THE WATCHER DOES NOT, AND FIVE RUNS HAVE MIS-ROUTED THE RESULT TO STATION 03

`status-sweep.ps1` prints `watcher clone: branch=main dirty=2  <-- NOT clean-on-main; the watcher
may refuse to start`. **Both halves of that warning are false, and they are false for two different
reasons.** [MEASURED] against `C:\po-watcher\ProjectOperations` in the same minute:

| form | where | result |
|---|---|---|
| `git status --short` | `status-sweep.ps1`, `$cdirty = @(git status --short` | **2** |
| `git status --porcelain --untracked-files=no` | `start-watcher.ps1` pre-flight | **0** |

The sweep counts untracked files; the watcher does not, and its own comment says so — *"Only TRACKED
modified/staged files count as 'dirty' -- untracked files"*. **And even a tracked-dirty clone does
not refuse: it AUTO-STASHES** (anchor `# --- Self-heal: AUTO-STASH a dirty tree instead of exiting
1 ---`, whose comment records that this *"used to be a hard PRE-FLIGHT FAIL (exit 1)"*). The clone's
**71** stashes are that path's receipts.

**What makes it recur rather than being a one-off:** the two files counted are
`docs/pr-reviews/pr-1850-review.md` and `pr-1852-review.md` — verdicts the `rev-<N>` review job
writes into the clone **by design**. So the false warning fires on every reviewed PR whose verdict
has not yet been mirrored, which on this board is routine.

**The cost is a MIS-ROUTED DISPATCH, and it is measurable.** [MEASURED] over
`docs/pr-prompts/archive/*.md`: `refuse to start` → **32** hits, **13** of them verbatim quotations
of the sweep's own output line; the rest are runs noticing in prose that the watcher *"has not"*
refused, or that the wording *"rides along"*, and then dispatching clone hygiene to Station 03.
**0** hits at depth 1 and **0** in `needs-marco/` — nobody has ever filed the cause. POSITIVE control
`CP-24` → 152 / 17 / 7; NEGATIVE control, a freshly minted needle → **0**. Station 03 has been sent a
hygiene job for a reporting bug at least five times.

**RULE 1 options, complete-and-additive first** — the fix is one condition in
`scripts/pipeline/status-sweep.ps1`, which RULE 2 routes to Marco:

- **(a) Fold the scoping fix into `#1852`, which is already open, already green, already touching
  that exact file, and already his.** *Complete:* scopes the flag to the condition the watcher
  actually reads, so the class cannot recur. *Additive:* it changes a reporting predicate, touches no
  data and no authority, and adds **zero** new PRs to a board where five already wait on one person.
  **Passes both halves — this is the recommendation.** It needs Marco because pushing to his open PR
  changes what he is approving.
- **(b) A standalone PR.** Complete and additive, but it makes the board six.
- **(c) Reword the flag without scoping the counter.** Fails "completely" — the number still measures
  something the sentence does not name.
- **(d) Leave it.** Fails both: five runs have re-noticed it and the dispatch went to the wrong
  station every time.

**DISPOSITION: ACTIONED (the instrument half) and ESCALATED (the script half).** The 9.5 bullet is
landed in this run's board PR with its measurements, both controls and a falsifying probe, so the
next run reads the cause instead of re-deriving it; the one-line script change went to
`needs-marco/sweep-clone-dirty-flag-counts-untracked-files-2026-09-10.md` with the options above.

### F2 — S3 · THREE BREADCRUMBS WERE FULLY DISPOSITIONED AND UNARCHIVED, INCLUDING THE ONE THAT NAMED THIS RUN AS ITS PAYMENT

The 1808 blind run deferred its F1 with an explicit named payment — *"the next sighted Station 00 run
lands the block above and archives this breadcrumb in the same PR"*. The 1908 run landed the block
(STATION-CAPABILITIES 3 now carries the native-file-tools third transport,
`NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`) and tracked the breadcrumb, but could not archive it in the
same PR that added it. `04`'s 1810 dispatched three findings to `00`; all three were actioned by the
1908 run (its F1 landed 04's F1+F2 as `#1859`, its F5 corrected 04's F4 denominators). **So every
finding in all three carries a disposition and all three are archivable.**

**DISPOSITION: ACTIONED** — all three `git mv`-ed into `docs/pr-prompts/archive/` in this run's board
PR. ⚠️ Archiving is safe for freshness and that was proved rather than assumed: `check-breadcrumb.mjs`
builds `trackedSet` with `git ls-tree -r` and matches by trailing path segment, so an archived
breadcrumb still counts — `--freshness` re-run after the move must still read `CLEAN` with no station
SILENT, and that is this finding's falsifying probe.

### F3 — S3 · A SCHEDULED RUN'S ONLY BOARD LEVER TODAY IS ITS OWN DOCS PR, AND THE ARITHMETIC STILL SAYS ARMING WOULD MAKE THINGS WORSE

Not a defect — a measured statement about what this station can accomplish, re-derived rather than
inherited because it is the decision that governs whether I arm.

**Five PRs open, all five green, all five waiting on Marco** — four with a live `marco:true` verdict
and `#1852` hand-classified on a one-file `scripts/` diff. **Nine gate-satisfied HOLDs and 0 of 9 can
enter the `tests-docs` lane**: every one names `apps/`, `.github/` or a `migrations/` path. So the
only arm available today opens a sixth PR that Marco must also merge, and the queue grows
monotonically. The `tests-docs` lane is not broken — it is **starved of eligible work**, which is a
different problem with a different owner.

⚠️ The parser was controlled this time as well as the classifier: **0 of 9 against 9 of 9**. The
answer is the same either way, and now it is known to be the same for the right reason.

**DISPOSITION: DEFERRED.** It becomes urgent the moment the board holds a PR that is NOT Marco's and
is not moving, or a gate-satisfied HOLD appears whose scope is `tests/` or `docs/` only — at which
point arming resumes with no further question. Neither was true this run. ⚠️ **These are counts, i.e.
state — re-measure, never quote.**

### F4 — S3 · THE LINUX WORKSPACE HAS NOW FAILED FOR SEVEN CONSECUTIVE STATION RUNS, AND DESKTOP COMMANDER WAS HEALTHY FOR THE SECOND OF THEM

The Cowork Linux workspace refused to start again with the same RPC error naming an unmounted Plan9
share and a session user that "already exists unexpectedly". The 1908 run established that the two
outages are independent by being the first sighted run to meet it; **this run is the second**, which
turns a single observation into a pattern: Desktop Commander healthy, mount gone, same error text.

Cost this run: nil. There was no VM-side `git` for the uninstalled guard to protect, and every probe
ran on the Windows host.

**DISPOSITION: DEFERRED, not re-escalated.** Three files already carry it —
`linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md`,
`cowork-vm-mount-unreachable-two-stations-2026-09-10.md` and
`station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` — and a fourth would split one
question across four homes. It becomes urgent for a **blind** run, and the third-transport block
landed by the 1908 run is precisely what stops that being fatal. ⚠️ **The consecutive-run count is
STATE — re-measure it, never quote it.**

## WHAT I DID NOT DO

- **Merged nothing but my own docs-only board PR, and cleared no RULE 2 verdict.** Four of the five
  open PRs carry a live `marco:true` line and the fifth hand-classifies as Marco's on a one-file
  `scripts/` diff. `labels=[]` on all five is not a clearance — `#1823`'s own verdict records the
  label it once carried, and Marco removing a label does not clear RULE 2.
- **Removed no `do-not-merge` label and authored no `merge-approvals/<N>.md` receipt.** A scheduled
  run never may; Marco's 2026-09-07 ruling covers the supervised cloud lane only, and this is the
  scheduled one.
- **Did not push to `#1852`**, although F1's fix belongs in it. Changing the contents of an open PR
  that is waiting on Marco changes what he is approving; that is his call, and it went to him as
  option (a) rather than as a fait accompli.
- **Armed nothing.** Measured, not assumed: 0 of 9 gate-satisfied HOLDs can enter the `tests-docs`
  lane. The `#1823` duplicate flag on `pr-company-manage-s1` was settled NOT-a-duplicate by the 1708
  run's premise-at-head probe and was not re-derived.
- **Did not touch `scripts/`.** F1's repair is a `status-sweep.ps1` change; writing it would open a
  PR only Marco can merge, which is the very bottleneck F3 measures.
- **Did not edit `/sot/`, and did not go near Azure, Entra or SharePoint.**
- **Did not restart the watcher, run `rescue-watcher-repo.ps1`, prune a worktree, drop a stash or
  delete a branch.** The clone is on `main` with no `MERGE_HEAD`, no rebase and no unmerged paths —
  **not corrupt**, so the rescue script must not run, and F1 is why its `dirty=2` is not evidence
  otherwise. Two orphaned worktrees remain — `C:/po-vg` at 9377 min holding **one uncommitted file**,
  and `C:/po-worktrees/pr1823` at 1319 min clean — both already dispatched to 03 and neither touched.
  The clone's **71** stashes are likewise 03's, and `git stash drop`, never `pop`.
- **Did not diagnose anything from the diff or a PR page**, and did not re-run anything hoping for
  green: all five PRs are green already.
- **Left the three untracked non-ignored dev-tree files alone** — `Claude Design/docs/index.html`,
  `docs/pr-prompts/.queue-sync-ledger.txt` and `docs/pr-prompts/queue-watch-state.md`. None is a
  breadcrumb and none is mine to commit.
- **Did not run `git` against any mount** — there was no mount — and did not run `git checkout .`,
  `reset --hard`, `stash pop` or `git clean` anywhere, in any tree.
