# Station 00 — Supervisor | 2026-09-10T19:08:15Z–2026-09-10T20:0xZ

**SIGHTED RUN.** Desktop Commander reached the box on the first call after a `ToolSearch` load, so
this is the run the two blind predecessors named as the one that would land their deferred work.
It did: five findings collected, four dispatched clauses landed, three breadcrumbs tracked or
archived, one red re-run, nothing armed, nothing merged.

Fresh negative-control needle minted this run: `zzQq00Needle20260910T1908`. It is written down here
and is therefore spent.

## GROUND

```
UTC            2026-09-10T19:08:15Z
origin/main    77137033              (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 77137033       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** — this run was not read-only-gated.

`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` returned **EMPTY**, so the working copies of the three
binding documents are not different from `origin/main` and reading them there was sound. Both were
read in full, 2010 and 485 lines, plus this station's own 1299-line doc.

⚠️ **The host clock and the session's declared date disagree by ten hours, and only UTC is used
here.** `(Get-Date).ToUniversalTime()` on the box returned `2026-09-10T19:08:57Z` while the session
environment declares "Friday, September 11, 2026". Brisbane is UTC+10; both are right, and the local
one cannot name a run. Every timestamp below is UTC and the file is named `2026-09-10-1908`.

## WHAT I MEASURED

**[MEASURED] Host reachable — NOT blind.** Desktop Commander schemas loaded via `ToolSearch` first
(a validation error is not blindness), then `start_process` shell `powershell.exe` → PID 3116, and a
second shell PID 1812 after the first exited mid-command. This matters because the two runs before
me were blind: `00` at 18:08Z (`CONNECT_TIMEOUT`) had no shell at all.

**[CANNOT MEASURE] `scripts/pipeline/vm-git-guard.sh` was NOT installed this run — sixth
consecutive station run.** PREFLIGHT step 1 asks for the installer's last line quoted, pass or fail.
It cannot be quoted: the Cowork Linux workspace refused to start, verbatim — `bash failed on resume,
create, and re-resume … source path … is under Plan9 share "c" which is not mounted; create: RPC
error -1: ensure user: user optimistic-bold-knuth already exists unexpectedly (attempt 1 of 5)`.
**Exposure is nil: with no VM there was no VM-side `git` to guard**, and every probe below ran
through Desktop Commander on the Windows host. Already open — see F4.

**[MEASURED] `status-sweep.ps1` — captured to a file, decoded from UTF-16LE, not read from the early
return.** Exit 0, 399 lines. Section 0 controls both `[LIVE]` PASS (`gh` saw merged `#1858`; `node`
runs), so no `[BROKEN]`. **Section 7 verdict: SAFE TO ACT** — no board mutation in progress, no
remote activity in two minutes, no live station worktrees. `index.lock` false / false, git processes
**0**, main CI on `77137033` **4 success / 0 failed** (trunk green), watcher node RUNNING pid
**18228** with its wrapper alive, heartbeat 159 min (stale + empty queue = idle, not wedged),
armed **0**.

**[MEASURED] Q1 — the open board, verbatim, and every one of the five is Marco's.**

| PR | created | state | CI | labels | lane verdict |
|---|---|---|---|---|---|
| `#1852` | 09-10T13:21:20Z | CLEAN | 15/0/0 green | none | **`NO LOG` — hand-classified MARCO'S** |
| `#1850` | 09-10T12:02:05Z | CLEAN | 15/0/0 green | none | `marco:true` — `outside tests/ or docs/: scripts/pipeline/triage-holds.ps1` |
| `#1845` | 09-10T09:37:57Z | CLEAN | 15/0/0 green | none | `marco:true` — `outside tests/ or docs/: scripts/pipeline/status-sweep.ps1` |
| `#1832` | 09-10T00:12:33Z | BLOCKED → re-run | 14/1/0 → 14/0/1 | none | `marco:true` — `outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh` |
| `#1823` | 09-09T00:05:42Z | CLEAN | 15/0/0 green | none | `marco:true` — `escalates:true - held for Marco, labelled do-not-merge` |

**Q1 answer: ZERO are DIRTY.** No PR on this board has frozen CI.

**RULE 2 probe, with the controls the standing rule requires.** Pinned to the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed` and never the clone: **2119** logs, newest
`2026-09-10T14:38:19Z`. `Select-String -Pattern 'marco.:true'` (regex, the dot matches the quote —
the `-SimpleMatch` form returns 0 **and so does its negative control**) → **POSITIVE 629**.
NEGATIVE control, this run's minted needle → **0**. **Freshness precondition asserted:** the newest
log is younger than the newest open PR (`#1852`, 13:21Z), so `NO LOG` is not a staleness artefact.
Per-PR, matched on `PR #<n>` in the BODY of `pr-*.log` only — `rev-*.log` excluded, because a review
job names PRs from both lanes and carries zero lane information: `#1850 → 2`, `#1845 → 2`,
`#1832 → 2`, `#1823 → 2`, **`#1852` → 0**.

**`#1852` hand-classified under DOCTRINE §10.1 step 2, recorded as `[NO LANE VERDICT —
hand-classified]`.** Its diff is exactly one file, `scripts/pipeline/status-sweep.ps1` — no
`(^|/)migrations/` path, and outside all three `NESTED_TEST_PATHS` forms. **MARCO'S.** ⚠️ **Note
what the labels column does NOT mean:** all five read `labels=[]`, and `#1823`'s own watcher verdict
records that it *was* labelled `do-not-merge`. **Marco removing the label does not clear RULE 2.**

**[MEASURED] Q3 — armed prompts counted by hand, not quoted from a note.**
`Get-ChildItem docs\pr-prompts -Filter *-ready.md` → **0**, at the start of the run and at the end.
`-HOLD.md` at depth 1 → **40**, unchanged from the 1708 and 1808 runs.

**[MEASURED] Every arm available today still lands on Marco — 0 of 9 are `tests-docs` eligible.**
`triage-holds.ps1` (GIT control PASS, SPENT-fixture control PASS): `spent=0  gates-satisfied=9
still-gated=31  unreadable=0  of 40`. Each of the nine parsed with the CRLF-explicit `scope:`
regex and classified against `NESTED_TEST_PATHS` + the `migrations/` clause:

```
MARCO  pr-brandtheme-s3-full-palette-columns          scope=8 migration=Y  apps/api/prisma/schema.prisma
MARCO  pr-brandtheme-s6-live-preview-contrast         scope=6 migration=n  apps/web/src/lib/contrast.ts
MARCO  pr-company-manage-s1-permission-and-grant      scope=4 migration=Y  apps/api/src/common/permissions/permission-registry.ts
MARCO  pr-e2e-container-s2-swap-required-job          scope=2 migration=n  .github/workflows/playwright.yml
MARCO  pr-fv2-maintenance-usage-intervals             scope=5 migration=Y  apps/api/prisma/schema.prisma
MARCO  pr-qpdf-1-estimate-preview-mark                scope=6 migration=n  apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts
MARCO  pr-qpdf-3-quoteref-collision-409               scope=3 migration=n  apps/api/src/modules/client-quotes/client-quotes.service.ts
MARCO  pr-qpdf-4-freeze-issued-terms                  scope=6 migration=n  apps/api/src/modules/client-quotes/quote-pdf.service.ts
MARCO  pr-rateparity-s1-harness                       scope=4 migration=n  apps/api/src/modules/rates/charge-step-parity.service.ts
TESTS-DOCS ELIGIBLE = 0 of 9
```

🔧 **The EXTRACTION step was controlled separately from the DECISION step, which is what DOCTRINE
§9.3's newest bullet demands.** PARSER control: the `\s*\n` list-form matcher matched **0 of 9**
(every prompt is CRLF) while the CRLF-explicit form matched **9 of 9** — the broken parser would
have produced the identical headline `0 of 9` off nine scope counts of zero. CLASSIFIER controls:
`tests/e2e/foo.spec.ts` → true, `apps/api/src/main.ts` → false.

**[MEASURED] Q4 — the one inherited claim I re-verified rather than repeated.** `triage-holds.ps1`
again flags `pr-company-manage-s1-permission-and-grant-HOLD.md` as a POSSIBLE DUPLICATE of open
`#1823`, overlap **1 of 4**, on the shared registry file. That flag was settled NOT-a-duplicate by
the 1708 run's premise-at-head probe and the settlement landed in DOCTRINE §10.6 as `#1858`; the
prompt carries no marker token, which is the case that correction exists for. **It stays unarmed and
the flag stays open — nothing new was measured about it this run.**

**[MEASURED] Q5 — silent no-ops.** `no-pr-opened/` holds **109**, newest **2026-09-02T03:47Z**, more
than eight days old; `failed/` holds **45**, newest `rev-1837-ready.md.log` at 09-10T02:41Z, which
is a REVIEW JOB and not a prompt. **No NEW silent no-op since the last collect.** Nothing here was
waved away as expected; there is simply nothing new in either folder.

**[MEASURED] `#1832`'s red is a webkit e2e timeout on a diff that cannot reach the web app — read
from the JOB LOG, never the diff or the PR page.** `gh run view 34508200558 --job 102975531431
--log`, 2708 lines, split on the tab and searched in the LAST column per §9.1: **19 passed, 1
failed** — `[webkit] tests/e2e/tendering.spec.ts:44 /tenders renders the redesigned register page`,
`Test timeout of 60000ms exceeded while running "beforeEach" hook` inside `loginWithStoredState`
waiting for `getByRole('heading', { name: 'Home' })`. The same test passed on chromium (4.1 s) and
firefox (6.9 s), and the webkit worker's other four tests all passed. `#1832`'s diff is **one file**,
`scripts/pipeline/vm-git-guard.sh`, and `main` CI on `77137033` is green — so this is neither a main
regression nor a defect in the change. Transient, per the station doc's rule 5.

**[MEASURED] COLLECT corpus and the freshness cross-check.** `check-breadcrumb.mjs --freshness`:
`structure: 3 checked, 0 malformed`, `CLEAN`, exit 0 — `00` 1.1h, `03` 20.2h, `04` 1.1h, `05` 5.0h,
all `ok`. Crossed against `lastRunAt` from the scheduled-tasks MCP, which is the instrument the
`00` row needs because `check-breadcrumb.mjs`'s own `CADENCE` map still reads `'00': 2` against a
live cron of `5 * * * *`:

| station | cron | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|---|
| `00` | `5 * * * *` | 2026-09-10T19:08:15Z — this run | 18:08Z | firing hourly, aligned |
| `03` | `0 9 * * *` | 2026-09-09T23:01:42Z | 09-09T23:01Z | aligned; daily |
| `04` | `0 */4 * * *` | 2026-09-10T18:09:53Z | 18:10Z | aligned |
| `05` | `10 0 * * *` | 2026-09-10T14:10:55Z | 14:11Z | aligned; daily |
| `weekly-security-audit` | `30 7 * * 1` | 2026-09-06T21:32:44Z | n/a | not a station; healthy |

**All five ENABLED, none SILENT, and no station's `lastRunAt` is fresh with a missing breadcrumb.**

**[MEASURED] Two uncollected breadcrumbs, and both are now tracked.** `00`'s blind 18:08Z run and
`04`'s 18:10Z run were both UNTRACKED in the dev tree. The 1708 breadcrumb was already tracked at
depth 1 with all six of its findings disposed, which by the archiving rule made it this run's to
archive. **Before treating any of the three as unreported I asked the TRACKED SET, not the dev
tree** — `git ls-files docs/pr-prompts` matched by basename — so no duplicate root copy was created,
which is the failure `#1766`/`#1768` recorded.

## WHAT CHANGED

**One board PR, one CI re-run, two gitignored dev-tree writes. Nothing armed. Nothing merged.**

1. **Board PR — six tracked-file edits, each with its byte delta asserted in node with a FUNCTION
   replacer (§9.3, never a replacement string):**

   | file | before → after | what |
   |---|---|---|
   | `docs/pipeline/stations/05-sot-keeper.md` | 34785 → 34923 | three raw line citations → symbol anchors |
   | `docs/pipeline/stations/03-machine-minder.md` | 25972 → 26005 | `ensure-watcher.ps1:10` → `$Launcher =` anchor |
   | `docs/pipeline/DOCTRINE.md` | 157812 → 159582 | §9.5's anchor-by-symbol rule widened to every binding document |
   | `docs/pipeline/STATION-CAPABILITIES.md` | 34373 → 36844 | §3 gains the third READ transport |
   | `docs/pipeline/stations/_canonical-blocks.json` | re-recorded | `instruments v2 e539bf680412d5c5` |
   | `docs/pipeline/sweep-rotation.json` | 2837 → 2837 | Station 04's advance, `last_index` 2 → 3 |

   Every one of the six read back: expected byte count equalled actual in all six.
   `lint-station.mjs` → **`ADMIT: all 8 docs clean`, exit 0** after the canonical re-record.
   `check-breadcrumb.mjs` → **`CLEAN`, exit 0**.

2. **Three breadcrumbs given a tracked home in that same PR** — `00`'s 1808 and `04`'s 1810 added at
   depth 1 byte-exact (`Buffer.compare` = 0 on both), and `00`'s 1708 `git mv`-ed into
   `docs/pr-prompts/archive/`.

3. **`#1832`: `gh run rerun 34508200558 --failed`.** Read back at 20 s: `status=in_progress
   attempt=2`, and `gh pr checks 1832` moved from `14 pass / 1 fail` to `14 pass / 0 fail /
   1 pending`. **This is not a merge and is not a label change** — it is the transient rule.

4. **Two writes under `docs/pr-prompts/needs-marco/`, which is gitignored and therefore lives in the
   dev tree only:** the denominator correction on
   `bootstrap-preflight-omits-four-preconditions-2026-09-10.md` (6952 → 8162 B, delta asserted,
   original table left intact) and the new
   `dispatched-findings-have-no-file-backed-home-2026-09-10.md`.

**Nothing else.** No prompt armed, disarmed, renamed, moved or deleted. No label added or removed.
No PR merged. No `sot/` file touched. No watcher restart, no worktree pruned, no stash dropped, no
branch deleted. `git diff --cached --name-status` in the dev tree was EMPTY before I started, so no
other chat's staged work could be swept into my commit.

## FINDINGS

### F1 — S2 · THE ANCHOR-BY-SYMBOL RULE WAS SCOPED TO ONE DOCUMENT, AND THAT IS EXACTLY WHERE THE ROT WAS NOT

Station 04's F1 and F2, collected and landed together, because they are one defect seen from two
sides. F1 is the symptom: four consecutive `instruction-drift` sweeps (09-02, 09-04, 09-07, 09-10)
each re-found `pr-gates.mjs:327` and `CLAUDE.md:19` in `05-sot-keeper.md`, each dispositioned it
correctly, and neither was ever fixed. F2 is the cause: DOCTRINE §9.5 says *"anchor by symbol, never
by line number"*, §10.3 restates it as *"every citation into another file in **THIS DOCUMENT**"* —
and **THIS DOCUMENT was doing load-bearing work in that sentence that nobody read as a limit.**
`DOCTRINE.md` swept itself (18 anchors, 19 of 19 resolving, 1 correct line citation left); the nine
documents that never got the rule held **all four** survivors.

**ACTIONED, both halves.** All four raw citations are now symbol anchors —
`const sotRe = /^sot\//`, `SOT reference baseline:`, `The --check mode does NOT compare`, and
`$Launcher =` — and §9.5's opening bullet now binds every binding document rather than only
DOCTRINE, with the measurement, the controls and a falsifying probe attached. RULE 1 shape:
complete (it removes the surface the citations rot on, not just today's four) and additive (it adds
an anchor form and removes no instruction, no authority and no data).

⚠️ **One survivor is beyond any rule and any CI check: `C:\po-watcher\ensure-watcher.ps1` is not in
this repository.** It is now anchored by symbol rather than by line, which is strictly better, but
nothing in CI can verify it. That is already ESCALATED as
`needs-marco/watcher-launcher-chain-unversioned-2026-09-04.md` and is **not re-raised**.

**DISPOSITION: ACTIONED** — landed in this run's board PR, `lint-station.mjs` ADMIT exit 0 read back
after the canonical-block re-record.

### F2 — S2 · ESCALATED HAS A FOLDER; DISPATCHED HAS NOTHING, SO AN OUTSTANDING DISPATCH IS INVISIBLE TO EVERY INSTRUMENT

The second half of Station 04's F1, and the half a station cannot fix. `status-sweep.ps1` section 5
reads `needs-marco/` and does not read `archive/`; stations do not read each other's chats. So a
DISPATCHED finding survives exactly as long as the next collect run's memory of it. Measured by 04
over 607 files with controls: `CLAUDE.md:19` appears in **0** `needs-marco/` files and **8**
archived breadcrumbs; `pr-gates.mjs:327` in **1** — as a passing sub-item of another subject — and
**12**. Both dispatches lived only where no instrument looks, for nine days.

The aggravating half is the routing: both were one-clause edits to a `docs/` file, which is Station
00's own lane and runs hourly, routed to the daily station whose lane is `sot/` because the subject
matter was 05's.

**RULE 1 options are written out in full in the escalation file**, complete-and-additive first:
(a) a `docs/pr-prompts/dispatched/` register read by `status-sweep.ps1` §5 alongside
`needs-marco/` — fixes the class, adds a folder and one read, removes nothing; (b) fold DISPATCHED
into `needs-marco/` — fails "without damaging", because that queue means *Marco* must act and
already holds 55 files; (c) a convention with no instrument — which is what DISPATCHED already is;
(d) rely on 00 catching them in collect — which is what happened here, after four sweeps.

**DISPOSITION: ESCALATED** →
`docs/pr-prompts/needs-marco/dispatched-findings-have-no-file-backed-home-2026-09-10.md`. It needs
Marco because the sweep is `scripts/pipeline/status-sweep.ps1`, which RULE 2 routes to him — the
same reason four `scripts/` PRs are open on the board right now. The repair half is already done and
he is not being asked to authorise it.

### F3 — S3 · A SCHEDULED RUN'S ONLY BOARD LEVER TODAY IS A CI RE-RUN, AND THE ARITHMETIC SAYS ARMING WOULD MAKE THINGS WORSE

Not a defect — a measured statement about what this station can accomplish right now, recorded
because three consecutive runs have reached it independently and the temptation is to arm anyway.

**Five PRs open, five waiting on Marco, four with a live `marco:true` verdict and one
hand-classified.** **Nine gate-satisfied HOLDs, and 0 of 9 can enter the `tests-docs` lane** — every
one names `apps/`, `.github/` or a `migrations/` path. So the only arm available today opens a
sixth PR that Marco must also merge, and the queue grows monotonically. The `tests-docs` lane is not
broken; it is **starved of eligible work**, which is a different problem with a different owner.

⚠️ **This is a stronger claim than the earlier runs could make, because the parser was controlled
this time.** The broken `\s*\n` scope matcher — the one DOCTRINE §9.3 records as producing a
byte-identical headline off nine zero counts — was run side by side with the CRLF-explicit form:
**0 of 9 against 9 of 9**. The answer `0 eligible` is the same either way, and now it is known to be
the same for the right reason.

**DISPOSITION: DEFERRED.** It becomes urgent if the board ever holds a PR that is NOT Marco's and is
not moving, or if a gate-satisfied HOLD ever appears whose scope is `tests/` or `docs/` only — at
which point arming resumes with no further question. Neither was true this run.

### F4 — S3 · THE LINUX WORKSPACE HAS NOW FAILED FOR SIX CONSECUTIVE STATION RUNS, AND THE SIXTH IS THE FIRST SIGHTED ONE

The Cowork Linux workspace refused to start again, with the same RPC error naming an unmounted
Plan9 share and a session user that "already exists unexpectedly". This run adds one datum the
others could not: **the previous five occurrences were all on runs that also lost or nearly lost
Desktop Commander, and this one was not.** Desktop Commander was healthy throughout; the mount was
still gone. So the two outages are independent, which narrows the cause — it is not one host-level
event taking both transports down.

Cost this run: nil. There was no VM-side `git` for the uninstalled guard to protect, and every probe
ran on the Windows host.

**DISPOSITION: DEFERRED, not re-escalated.** Three files already carry it —
`linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md`,
`cowork-vm-mount-unreachable-two-stations-2026-09-10.md` and
`station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` — and a fourth would split
one question across four homes. It becomes urgent for a **blind** run, for which
`STATION-CAPABILITIES.md` §3 makes the mount the whole of COLLECT; the third-transport block landed
this run is precisely what stops that being fatal. ⚠️ **The consecutive-run count is STATE —
re-measure it, never quote it.**

### F5 — S4 · AN OPEN ESCALATION'S DENOMINATORS WERE ONE TASK OUT OF DATE, AND THE SUBSTANCE WAS NOT

Station 04's F4, collected. `bootstrap-preflight-omits-four-preconditions-2026-09-10.md` measures
over *"the 6 live bootstrap `SKILL.md`"* and reports *"5 of 6 bootstraps still cite 107-111"*, while
its own falsifying probe prescribes *"every `SKILL.md` behind an ENABLED task in the scheduled-tasks
MCP, never 'the five'"*. The MCP reports **5** enabled tasks; the sixth file counted is
`02-board-driver`, which has a bootstrap folder and no live task. Over the correct corpus the four
rows read `0 of 5`, the positive control `4 of 5`, and the `.gitignore` line `4 of 5`.

**Every row is still zero, so the escalation is LIVE and its question to Marco is unchanged.** Only
the denominators move, and they move in the harmless direction.

**DISPOSITION: ACTIONED** — a correction block appended to that file in the dev tree, original table
left intact, byte delta asserted (6952 → 8162), read back for both the new text and the four
untouched `0 of 6` cells. Recorded so the next run to re-measure does not read a mismatch as the
escalation having moved.

### F6 — S3 · `#1832`'s RED IS A WEBKIT TIMEOUT ON A ONE-FILE SHELL-SCRIPT DIFF, AND IT WAS RE-RUN RATHER THAN DIAGNOSED AS A DEFECT

19 of 20 e2e tests passed; the one failure is `beforeEach` → `loginWithStoredState` waiting 60 s for
the `Home` heading, on webkit only, for a test that passed on chromium in 4.1 s and firefox in
6.9 s. `#1832` changes exactly one file — `scripts/pipeline/vm-git-guard.sh` — which cannot reach
`apps/web`, and `main` CI on `77137033` is green, so this is neither a main regression nor a defect
in the change.

⚠️ **The verdict was taken from the job log's LAST tab-separated column, not from a grep of the raw
lines** — §9.1 records that column 1 is the job name, so grepping whole lines for anything in the
job's own title matches every line of the log.

**DISPOSITION: ACTIONED** — `gh run rerun 34508200558 --failed`, read back as `attempt=2,
in_progress`, and `gh pr checks 1832` now reads `14 pass / 0 fail / 1 pending`. ⚠️ **A re-run is not
a merge and not a clearance:** `#1832` carries a live `marco:true` verdict and stays for Marco
whatever the second attempt returns. If attempt 2 fails on the same webkit test this is no longer a
flake and belongs to whoever owns the e2e harness — that is the falsifying probe for this finding.

## WHAT I DID NOT DO

- **Merged nothing, and cleared no RULE 2 verdict.** Four of the five open PRs carry a live
  `marco:true` line and the fifth hand-classifies as Marco's on a one-file `scripts/` diff.
  `labels=[]` on all five is not a clearance — `#1823`'s own verdict records the label it once
  carried, and Marco removing a label does not clear RULE 2.
- **Removed no `do-not-merge` label, and authored no `merge-approvals/<N>.md` receipt.** A scheduled
  run never may; Marco's 2026-09-07 ruling covers the supervised cloud lane only, and this is the
  scheduled one.
- **Armed nothing.** Measured, not assumed: 0 of 9 gate-satisfied HOLDs can enter the `tests-docs`
  lane, so every available arm adds a sixth PR to a board where five already wait on one person.
  The `#1823` duplicate flag on `pr-company-manage-s1` was settled by an earlier run and was not
  re-derived.
- **Did not touch `scripts/`.** The dispatch register that F2 asks for is a `status-sweep.ps1`
  change; writing it would open a PR only Marco can merge, which is the very bottleneck F3 measures.
  It went to him as a question with options instead.
- **Did not edit `/sot/`, and did not go near Azure, Entra or SharePoint.** No `sot/` file was read
  for edit or written.
- **Did not restart the watcher, prune a worktree, drop a stash or delete a branch.** All are
  Station 03's. Two orphaned worktrees are still on the box — `C:/po-vg` at 9317 min holding **one
  uncommitted file**, and `C:/po-worktrees/pr1823` at 1259 min clean — both already dispatched to 03
  by earlier runs and neither touched here. The watcher clone reads `dirty=2`, likewise 03's.
- **Did not diagnose `#1832` from the diff or the PR page**, and did not re-run anything else hoping
  for green: the other four PRs are green already.
- **Left the three untracked non-ignored dev-tree files alone** — `Claude Design/docs/index.html`,
  `docs/pr-prompts/.queue-sync-ledger.txt` and `docs/pr-prompts/queue-watch-state.md`. None is a
  breadcrumb and none is mine to commit.
- **Did not run `git` against any mount** — there was no mount — and did not run `git checkout .`,
  `reset --hard`, `stash pop` or `git clean` anywhere. All board-PR work happened in a disposable
  worktree at `C:\po-wt\00-collect-1908`, off `origin/main`, and this breadcrumb was written INSIDE
  it so no loose untracked copy is left in the dev tree to block the next fast-forward.
