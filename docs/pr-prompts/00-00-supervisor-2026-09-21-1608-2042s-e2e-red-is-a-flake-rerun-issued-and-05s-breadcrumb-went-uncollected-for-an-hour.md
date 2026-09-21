# Station 00 — Supervisor | 2026-09-21T16:08:17Z–2026-09-21T16:3xZ

## GROUND

```
UTC            2026-09-21T16:08:17Z
origin/main    3466bf46            (git fetch origin +refs/heads/main:... then rev-parse)
dev tree       main @ 3466bf46      C:\ProjectOperations2   (0 ahead / 0 behind)
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** (both `1`). No read-only downgrade — **full authority run.**

🟢 **SIGHTED RUN**, stated in the first line because a blind run and a healthy quiet run both
produce "no news". Desktop Commander loaded on the prescribed keyword `ToolSearch`; `start_process`
shell `powershell.exe` returned a live shell (PID 10024) on the first call and printed
`2026-09-22T02:08:17.0267096+10:00` / `LAPTOP-E6NHU4E4`. Every measurement below was taken through
that transport.

**Device-bridge git guard installed FIRST, before any VM-side call. Last line, verbatim, exit 0:**

```
vm-git-guard installed at /sessions/epic-cool-darwin/.local/bin/git - refuses mounted paths and
mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

**Install PASSED.** No `git` was run through the device bridge against the Windows `.git` at any
point; every git call went through the Windows shell.

**Binding-document freshness PROVED, not assumed**, in the dev tree, after an explicit fetch, using
the sound form (§9.1 — never a piped `hash-object`):

```
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md \
                                  docs/pipeline/DOCTRINE.md \
                                  docs/pipeline/STATION-CAPABILITIES.md   -> EMPTY
```

**EMPTY is the real answer**: the working copies are byte-identical to `origin/main`, so the
working-copy reads are sound. All three were then read **in full** — `00-supervisor.md` (1350
lines), `STATION-CAPABILITIES.md` (545 lines), `DOCTRINE.md` (2629 lines, §1 through §10.6, across
four paged reads).

## WHAT I MEASURED

### The sweep — SAFE TO ACT, and ZERO `[STALE]` escalation rows for the second run running

`[MEASURED]` `status-sweep.ps1`, exit **0**, 464 lines, all ten sections present, generated
`2026-09-21 16:08:40Z`. Section 0 positive controls both `[LIVE]`: `gh CAN reach GitHub (saw merged
PR #2053)`, `node runs`. **No `[BROKEN]`.** §7 verdict, verbatim:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Section 3, the condition-3 inputs: `git index.lock interactive/clone: False / False`, `git processes
touching our trees (scoped): 0`, `no PR touched on GitHub in the last 2 min`.

🔴 **Section 5 returned ZERO `[STALE]` rows again.** Every row is the `[FILE]` form *"cites #N
(MERGED) as evidence — not its premise; does not clear the escalation"*, which is the sweep
explicitly declining to discharge. **There was no `needs-marco/` discharge work to do and I did not
manufacture any.** `needs-marco/` census: **63**, unchanged from 15:09Z.

Queue census `[LIVE]`: **armed 0** · needs-marco 63 · no-pr-opened 109 · failed 59 · blocked 147.
Backlog gates: `ready=1 needs-marco=2 blocked=4 broken=0` — the one `ready` is
`rates-11c-blocked-consumers`, which is 06's to stage and carries a live never-arm denylist entry.

### The board — five open PRs, and **all five** carry a REAL watcher `marco:true` verdict

§10.1 makes a lane verdict **non-monotonic and valid only as of the minute it was taken**, so the
predecessor's classification was treated as a lead and **re-taken in full**. Probe: the prompt logs
alone, `rev-*` excluded (§10.1 / §9.5), pinned to the LIVE tree `C:\ProjectOperations2` and never
the clone decoy (§9.5). Freshness precondition asserted: newest `processed/*.log` is
`rev-2053-ready.md.log` at **2026-09-21T15:34:18Z**, younger than every open PR. NEGATIVE control
`PR #999995` → **0**.

| PR | merge state | labels | prompt-log hits | watcher verdict (re-taken 16:2xZ) |
|---|---|---|---|---|
| #2051 | BLOCKED | `do-not-merge` | 2 | `marco:true` — *escalates:true - held for Marco, labelled do-not-merge* |
| #2049 | UNKNOWN | — | 1 | `marco:true` — *outside tests/ or docs/: scripts/pipeline/lint-station.mjs* |
| #2047 | BLOCKED | `do-not-merge` | 2 | `marco:true` — *escalates:true - PR already carries `do-not-merge`* |
| #2044 | BLOCKED | `do-not-merge` | 2 | `marco:true` — *escalates:true - held for Marco, labelled do-not-merge* |
| #2042 | BLOCKED | — | 3 | `marco:true` — *outside tests/ or docs/: apps/web/src/pages/tendering/ClientQuotesPanel.tsx* |

Every verdict was cross-checked against **its own log's prompt** per §10.1's
`PRNUMBER_SCRAPED_FROM_PROSE_V1` rule — the log carrying each verdict is that prompt's own
`processed/pr-<slug>-ready.md.log` and the slug matches the PR's head branch in all five cases.
**None is a prose scrape.** The probe was written `marco.:true` (regex, no quote character) per
§10.1's closing note.

🔴 **So RULE 2 binds on all five and I merged nothing.** The three `do-not-merge` PRs read 13 pass /
2 fail, which is §9.4's `[LABEL_PRESENT]` signature — `approval-receipt-check.mjs` runs twice, so one
label makes two reds. **Parked by design, not work.** Only Marco removes the label.

### #2042 — a REAL red appeared since the last run, and it is a flake

`[MEASURED]` `gh pr checks 2042`: **14 pass, 1 fail** — `tendering-e2e` (`Tendering Browser Smoke`),
run `35620526953`, job `106402217989`, 14m52s. `Approval receipt (CP-26)` **passes**, so this is not
the label artifact; it is a genuine failing check on an unlabelled PR.

**Job log read before any diagnosis** (YOUR LIMITS 6), `--log-failed`, reading the LAST tab-separated
column per §9.1:

```
1 failed
  [chromium] › tests/e2e/pr-acceptance/batch4-tender-documents.spec.ts:95:7 ›
  Batch 4 — Tender documents (PRs #22, #341) ›
  mock SharePoint mode: Open shows the connection-required toast instead of navigating
1 skipped
165 passed (10.5m)
```

Failure mode: `expect(getByText('Document preview requires SharePoint connection…')).toBeVisible()`
timed out at 10000 ms, `element(s) not found`.

**Three measurements say flake, not defect, and none of them is the diff:**

1. `[MEASURED]` **the same job passed on the immediately preceding head.** Run history on
   `feat/scopecards-s4b-push-panel-ui`, `Tendering Browser Smoke`:
   `4ca87716` 15:22Z **success** → `ddf39667` 15:40Z **failure**. The same workflow also flapped
   three times earlier on this branch (`42820e01` 11:00 fail · `7108942b` 11:18 fail ·
   `c96514d7` 11:32 fail · `63a4dbbb` 12:22 pass · `8d3692e4` 12:38 pass · `5fddcee8` 13:36 pass).
2. `[MEASURED]` **no code changed between the green head and the red one.** The only commit between
   `4ca87716` and `ddf39667` is `Merge branch 'main' into feat/scopecards-s4b-push-panel-ui`
   (`ddf39667`, 15:40:19Z, `GH-Mantova`), and the only things on `main` in that window are **#2052**
   (`sot/` + one breadcrumb) and **#2053** (`docs/pipeline/` + breadcrumbs). **Neither diff contains
   a line of code.** A docs/sot-only main advance cannot break a Playwright spec.
3. `[INFERRED]` the failing spec — the tender-documents mock-SharePoint toast — is in a different
   area of the app from this PR's diff (`ClientQuotesPanel.tsx`, the scopecards push panel and Cost
   Summary). 165 of 166 specs pass.

That is mandate rule 5's signature exactly — a CODE check failing on a diff that cannot have caused
it, while nothing code-bearing landed on `main`. **Re-run issued** (see WHAT CHANGED).

⚠️ **`needs-marco/pr-2042-review-reject.md` describes a DIFFERENT, already-fixed failure** — the hex
ratchet on a bare `#000`. `[MEASURED]` that was fixed on this branch at `8d1b5a0a` 10:31Z
(*"fix(client-quotes): drop hex fallbacks on defined brand tokens (hex ratchet)"*) and the
compliance checks are green now. The escalation file is a **lead, not a finding** (§7.1 re-read
rule) — I did not discharge it, because the sweep tagged it no `[STALE]` and discharging on anything
weaker is how a live escalation gets retired.

### #2049 is fully green and waiting on nothing but Marco

`[MEASURED]` `gh pr checks 2049`: **15 of 15 pass**, `tendering-e2e` included (13m44s).
`mergeStateStatus` `UNKNOWN` is GitHub's mergeability rollup not yet recomputed, not a failure. Its
watcher verdict is `marco:true` on `scripts/pipeline/lint-station.mjs`, so it is Marco's and I did
not merge it.

### COLLECT — freshness CLEAN, `lastRunAt` aligned, and one breadcrumb that nobody had collected

`[MEASURED]` `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit **0**, `CLEAN`:

```
structure: 6 checked, 0 malformed, 0 skipped as pre-contract
00  last 2026-09-21T15:09:00Z  1.1h ago  (cadence 2h)  ok
02  dispatch-only — no cadence to miss
03  last 2026-09-21T00:21:00Z  15.9h ago  (cadence 24h)  ok
04  last 2026-09-21T14:10:00Z  2.0h ago   (cadence 4h)   ok
05  last 2026-09-21T14:11:00Z  2.0h ago   (cadence 24h)  ok
```

**No station is SILENT.** ⚠️ `ok` for `00` remains the weakest row — `check-breadcrumb.mjs` still
carries `'00': 2` against a live cron of `5 * * * *` — so it was crossed against the third
instrument the contract requires, `list_scheduled_tasks`, which that defect does not touch:

| task | cron | `lastRunAt` (UTC) | enabled |
|---|---|---|---|
| `00-supervisor` | `5 * * * *` | **2026-09-21T16:07:57Z** *(this run)* | true |
| `04-scanner` | `0 */4 * * *` | 2026-09-21T14:09:34Z (next 18:09:31Z) | true |
| `05-sot-keeper` | `10 0 * * *` | 2026-09-21T14:10:40Z | true |
| `03-machine-minder` | `0 9 * * *` | 2026-09-21T00:20:35Z (next 23:00:45Z) | true |
| `weekly-security-audit` | `30 7 * * 1` | 2026-09-06T21:32:44Z | **false** |

`lastRunAt` and newest breadcrumb are fresh and aligned for every enabled station. **Four enabled
tasks**, which is `STATION-CAPABILITIES.md` §1's 2026-09-15 correction still current.

🔴 **The tracked set holds six breadcrumbs at the queue root and one of them had never been
collected.** `[MEASURED]` `git ls-files docs/pr-prompts/00-*.md` → six, all tracked on `main`, none
duplicated into `archive/`. `git status --porcelain docs/pr-prompts` → **no untracked breadcrumb**
(the 15:09Z run wrote its own inside its PR worktree — cure 1). Of the six:

| breadcrumb | collected by | evidence |
|---|---|---|
| `00-00-…-1308` | the 14:07Z run | that run names it |
| `00-04-scanner-…-1010` | substantively, by the 15:09Z run | its F4 (blindness) and F8 (fv2) carry 04's findings forward, though the file is not named |
| `00-00-…-1407` | the 15:09Z run | named in as many words |
| `00-04-scanner-…-1410` | the 15:09Z run | named; its F1/F2/F3 became that run's F1/F2/F3 |
| **`00-05-sot-keeper-…-1411`** | **NOBODY, until this run** | see below |
| `00-00-…-1509` | this run (its own findings are carried below) | — |

`[MEASURED]` over the 15:09Z breadcrumb: hits for `sot-keeper-2026-09-21-1411` → **0**; hits for
`sot/02` → **2**, both of them naming the file as part of #2052's diff or a prompt's `scope:`, never
05's finding about it; hits for `1010` → **0**. POSITIVE control `DISPOSITION` → **10**; NEGATIVE
control, a freshly minted needle → **0**. Its own text says *"**Both** breadcrumbs since my
predecessor's collect were read in full"* and names the 1407 and 1410 files — while its **own**
freshness table one paragraph earlier printed `05 last 2026-09-21T14:11:00Z`.

### The arming log — unchanged, and the two missing rows have still not returned

`[MEASURED]` `git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` → **EMPTY**: disk
and `origin/main` agree exactly. Newest row is still
`2026-09-21T13:19:01Z ARMED pr-ops-m2b-tipping-tab-reminder`. The tail carries arms for
`pr-scopecards-s4b-push-panel-ui` (09:09:59Z → #2042) and `pr-crmvis-s8-comms-threads`
(10:33:00Z → #2044). **`permission-role-reconciler` (#2047) and `lintstation-contract-version-compare`
(#2049) still have no row at all** — the predecessor's falsifying probe (*"if the row ever returns,
this finding is wrong"*) has now failed to falsify three times. No further row has been lost, because
nothing has been armed since 13:19Z. I did **not** reconstruct either row: I never observed those
bytes, and forging an audit row converts a visible gap into an invisible fabrication.

### Machines — everything enabled is alive

`[MEASURED]` from the sweep, by command line and never by image name: watcher node **RUNNING pid
9744**; auto-restart wrapper **alive (1)**; no build in flight (newest heartbeat tick 35.1 min old,
which is the idle reading — ticks are 60 s apart only *while* a build runs); `main` CI on `3466bf46`
**4 success / 0 failed / 0 running (trunk green)**. I did not run `restart-watcher-if-wedged.ps1`
because nothing in the sweep suggested WEDGED or DOWN and **armed = 0**, which is the state that
script correctly calls "OK — nothing armed".

## WHAT CHANGED

**One CI re-run, one board PR, four breadcrumbs archived. Nothing merged, nothing armed, no label
touched.**

1. **`gh run rerun 35620526953 --failed` on #2042**, exit **0**. Read back independently, per §1:

   ```
   BEFORE  {"conclusion":"failure","databaseId":35620526953,"status":"completed"}
   AFTER   {"conclusion":"",       "databaseId":35620526953,"status":"in_progress"}
   ```

   ⚠️ **The re-run is the mutation; its OUTCOME is not yet a measurement.** At the close of this run
   (`16:3xZ`) the job is still `in_progress` — the suite takes ~14 min — so the green/red result is
   **[CANNOT MEASURE] this run** and belongs to the next occurrence (`17:07:52Z`). That is stated
   rather than papered over: §2's *"never re-run hoping for green"* is satisfied by the three
   measurements above naming the cause, not by the outcome.
2. **This board PR**, opened from a clean isolated worktree off `origin/main` `3466bf46`
   (`C:\po-wt\board-20260921-1608`, branch `docs/station00-collect-2026-09-21-1608`), carrying:
   - **this breadcrumb**, written inside the worktree — cure 1 of the post-merge fast-forward rule,
     so no untracked copy is left in the dev tree to block the next FF;
   - `git mv` of the **four fully-dispositioned breadcrumbs** into `docs/pr-prompts/archive/`:
     `00-00-…-1308`, `00-04-scanner-…-1010`, `00-00-…-1407`, `00-04-scanner-…-1410`.
     **Left in the root deliberately:** `00-05-sot-keeper-…-1411` (this cycle) and `00-00-…-1509`
     (it carries a live DISPATCH to Station 05, which next wakes `2026-09-22T14:10Z`).
3. **Nothing else.** No prompt armed, disarmed, renamed, moved or staged. No `do-not-merge` label
   added or removed. No `sot/` file touched. No watcher restart. No production data. No Azure /
   Entra / SharePoint surface. No commit on `main` in the dev tree. `git diff --cached
   --name-status` in the shared dev-tree index was read **EMPTY** before any worktree work, so no
   other chat had anything staged.

## FINDINGS

### F1 — Station 05's 14:11Z breadcrumb was never collected, and the one thing it dispatched to 00 sat undone for an hour (S3)

`COLLECT_MISSED_A_BREADCRUMB_IN_ITS_OWN_FRESHNESS_TABLE_V1`

The measurements are in COLLECT above: the 15:09Z run names the 1407 and 1410 breadcrumbs as *"both
breadcrumbs since my predecessor's collect"*, has **zero** textual trace of
`00-05-sot-keeper-…-1411`, and printed `05 last 2026-09-21T14:11:00Z` in its own freshness table one
paragraph earlier. 05's F1 was ACTIONED by 05 itself and F3 was DEFERRED by 05, so the only thing
owed to 00 was **05's F2 — and it was owed to nobody for an hour.** 00 is the only channel that
closes a finding; a finding 00 does not read is a finding nobody reads.

🔴 **The structural cause is that the root/`archive/` split — which the station doc already defines
as the collect ledger — was not being used.** All six breadcrumbs, four of them long since
dispositioned, were sitting at the queue root, so *"what is new since my last run"* had to be
re-derived from the prose of the previous breadcrumb every cycle, which is exactly the instrument
that failed here. `[MEASURED]` `archive/` already holds **775** tracked files, so the mechanism
works and was simply not applied to this cycle.

**DISPOSITION: ACTIONED.** Two halves, both in this PR. (i) 05's 1411 breadcrumb is collected and
its F2 is dispositioned as **F2** below. (ii) The four dispositioned breadcrumbs are `git mv`-ed into
`archive/`, leaving the root holding only the live cycle — so the next run's *"what is new"* is a
directory listing rather than a re-reading. **This is safe for freshness and that was proved rather
than assumed:** `check-breadcrumb.mjs` builds `trackedSet` with `git ls-tree -r` and matches by
trailing path segment (§9.5), so an archived breadcrumb still counts and cannot make a station read
SILENT. ⚠️ **Falsifying probe: run `--freshness` before and after this PR merges.** If any station
goes SILENT, this disposition is wrong.

### F2 — `sot/02` §2 cannot be kept true by a daily station, and the fix is a `scripts/` change only Marco can land (S2)

**Station 05's F2, dispatched to 00, collected here.** `[MEASURED]` by 05 at `524158cd`: §2 read
`open right now (1)` and named **#2017**, which `gh pr view 2017 --json number,state,mergedAt`
returns `MERGED 2026-09-21T06:09:36Z`, while five PRs were actually open. That snapshot was written
by 05's **own** run **14 hours** earlier, and it is the **fourth** refresh of the same table in
sixteen days (09-06, 09-17, 09-21T00:20Z, 09-21T14:1xZ). **The refresh interval the table needs is
shorter than the cadence of the only station allowed to edit the file.** Re-measured live this run:
§2's snapshot is already behind again — #2042 has gone from CLEAN to BLOCKED since 05 wrote it.

Refreshing is the additive half of RULE 1 and it does not solve the future half. 05 cannot do more:
the complete fix is a generator plus a CI check, both `scripts/`, and CP-24 hard-blocks `scripts/`
from a `sot/` PR.

🔴 **Nor is it mine to land.** A `scripts/pipeline/` + `.github/` change opened by 00 is outside
`tests|docs`, so it becomes a sixth PR on a board where five already wait only on Marco — motion,
not progress — and `needs-marco/instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md`
already names this exact class.

**DISPOSITION: ESCALATED** — Marco. One question, options ordered by RULE 1:

- **(A) A `scripts/pipeline/` generator that rewrites `sot/02` §2 from `gh pr list`, plus a CI check
  that fails when §2 names a PR that is not open.** *Complete and additive* — it fixes the table
  now and stops it rotting for good, it destroys no existing or future content, it removes a
  hand-maintained artifact rather than adding one, and it ends the four-refreshes-in-sixteen-days
  loop. Passes both halves. **Recommended.** It is a `scripts/` change, so it is yours to merge.
- **(B) Replace the §2 table with a one-line pointer to `bring-up-to-speed.ps1`.** Solves the future
  half; **fails the immediate half** for anyone who wants the roadmap to carry board state at all,
  and loses the per-PR blocker prose §2 currently supplies. It is also a `sot/` edit and therefore
  05's, not mine.
- **(C) Leave it and keep refreshing daily.** Fails the future half outright — that is the status
  quo, measured wrong within 14 hours on its own last attempt.

### F3 — #2042's `tendering-e2e` red is a flake on a docs-only main advance, not a defect (S3)

The three measurements are in WHAT I MEASURED: the same job passed on the immediately preceding head
`4ca87716`; the only commit between that head and the failing one is a `Merge branch 'main'` whose
entire content is #2052 (`sot/`) and #2053 (`docs/pipeline/`); and the single failing spec is the
tender-documents mock-SharePoint toast, a different area of the app from this PR's diff, with 165 of
166 specs passing. The same job also flapped three times earlier on this branch.

**DISPOSITION: ACTIONED** — `gh run rerun 35620526953 --failed`, exit 0, read back
`completed/failure` → `in_progress/(cleared)`. ⚠️ **The outcome is [CANNOT MEASURE] this run** and is
handed to the `17:07:52Z` occurrence: if the re-run comes back green, #2042 is green and waiting on
Marco alone; **if it fails again on the same spec, this disposition is wrong** — it is then a real
defect in `batch4-tender-documents.spec.ts:95` or in the toast it asserts, and the next run should
root-cause it rather than re-run a third time (§2 — never re-run hoping for green). That sentence is
the falsifying probe.

### F4 — Five of five open PRs are `marco:true`, re-taken this run, and four of them need no work from anyone (S2)

`[MEASURED]` this run, not carried: all five open PRs carry a real watcher `marco:true` verdict in
their own prompt's log, freshness precondition asserted, negative control 0. **Armed prompts: 0.**
This is the throughput constraint stated exactly — every PR touching anything outside `tests/` or
`docs/` stops at the same place by design, RULE 2 forbids any station from clearing it, and the
board therefore grows monotonically until Marco merges. **That is why I armed nothing** even though
the sweep said SAFE TO ACT.

**DISPOSITION: ESCALATED** — Marco, one question with a number attached, and it has *changed* since
the 15:09Z report rather than being repeated:

- **#2049** is **15 of 15 green**, unlabelled, `tendering-e2e` included. It needs a merge and
  nothing else.
- **#2044, #2047, #2051** are green apart from the two CP-26 reds their own `do-not-merge` label
  creates. **Removing the label is the entire remaining action** on each, and only you can do it.
- **#2042** is the one that is genuinely not ready: its e2e is re-running as of `16:15Z` (F3).

I am not asking which to merge — that is your call. I am reporting that four of the five are waiting
on a human action that takes seconds and that no agent is permitted to take.

### F5 — Carried unchanged from the 15:09Z run, each re-measured or explicitly not (S2/S3)

These were escalated an hour ago and none has moved. They are listed rather than re-argued, so the
open set is visible in one place without re-litigating it:

| carried finding | state this run |
|---|---|
| `.gitignore:107-111` is stale in all four enabled bootstraps, 15 days on (`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`, ITEM 1 + the ITEM 2 regex amendment) | unchanged — the bootstrap that opened THIS run still carries it |
| Station 00 blindness, intermittent, cause unknown (14:07Z blind, 15:07Z and this 16:07Z sighted) | **no new instance** — this run was sighted on the first call |
| The two vanished `.arming-log.txt` rows for #2047 and #2049 | **re-measured**: still absent, `numstat` vs `origin/main` EMPTY, no further row lost |
| The fv2 AI-import / digests / output-channels cluster, unanswered since 2026-09-15 | unchanged — not re-probed this run, the 15:09Z measurement at `d39d5abb` stands and its gate file is still absent |

**DISPOSITION: ESCALATED** — Marco, all four carried without change. Each already has its own
`needs-marco/` file and its own options written out in the 15:09Z breadcrumb; nothing here supersedes
them.

## WHAT I DID NOT DO

- **Merged nothing.** All five open PRs carry a live, cross-checked watcher `marco:true` verdict and
  RULE 2 binds absolutely — *not overridden by green, unlabelled, or a verified diff*. #2049 is
  15/15 green and unlabelled and I still did not merge it, because "green" is not the gate.
- **Removed no `do-not-merge` label**, from #2044, #2047, #2051 or anything else. Only Marco does. I
  did not treat their two CP-26 reds as failures to chase (§9.4 — `[LABEL_PRESENT]` is parked by
  design), and I enabled auto-merge on nothing.
- **Armed nothing** — 0 prompts, deliberately (F4). I did not stage the sweep's `ready=1` backlog
  item `rates-11c-blocked-consumers`, which is 06's to stage and carries a live never-arm denylist
  entry; and I did not arm `pr-queue-layout-sot-entry-HOLD.md`, which the 15:09Z run DISPATCHED to
  Station 05 and whose own body says *"Station 05 only"*.
- **Discharged no `needs-marco/` file.** The sweep tagged **zero** `[STALE]` rows, and discharging on
  anything weaker than that tag plus a per-PR `gh pr view --json state,mergedAt` re-ask is how a live
  escalation gets retired. In particular I did **not** discharge `pr-2042-review-reject.md` even
  though the hex-ratchet defect it names is fixed on the branch — it is a lead, and closing it is a
  decision with a re-ask behind it, not a tidy-up.
- **Did no 03/04/05 work.** The orphaned worktree `C:/PR-Master/worktrees/po-vg`
  (`fix/no-rebase-while-checks-run`, **dirty=1, age ~24,975 min — it holds uncommitted work and a
  `--force` prune would discard it**) and the registry escapee `C:\po-worktrees\po-fix-2005` are
  **Station 03's** and were left untouched, not even inspected for pruning. I edited no `sot/` file.
- **Did not act on the sweep's `watcher clone: branch=main dirty=5` line.** It is a known false alarm
  (§9.5): that flag counts untracked files while `start-watcher.ps1` explicitly ignores them, and a
  tracked-dirty clone auto-stashes rather than refusing. Thirteen verbatim quotations of that line
  already sit in `archive/` as mis-routed dispatches; I did not add a fourteenth.
- **Did not sweep the dev tree's 11 untracked `docs/pr-reviews/pr-*-review.md` files** or
  `queue-watch-state.md` / `.queue-sync-ledger.txt` into this PR. Per §9.5 the dev tree is one of the
  three legitimate homes for a review verdict; they are the review lane's artifacts, not breadcrumbs,
  and `sweep-breadcrumbs.ps1` is what batches loose station output.
- **Ran no `git` against the Windows `.git` through the device bridge**, and installed the guard
  before any VM-side call rather than after. Used no `git checkout`, `checkout -- <path>`,
  `reset --hard`, `stash pop` or `git clean` anywhere, in any tree, at any point.
- **Touched git in the watcher clone only through `gh`** — read-only `gh pr list` / `pr checks` /
  `run view` / `run rerun`. No `git checkout`, `merge`, `rebase`, `commit`, `push` or `pull` there.
- **Wrote to no gitignored sink.** Nothing went to `docs/qa/qa-findings.md`, `qa-checklist.md`,
  `qa-test-data-registry.md`, `.qa-run.lock` or `qa-run-*.md`.
- **Touched no Azure / Entra / SharePoint surface and wrote no production data.** No `az`, no
  `Connect-MgGraph`, no portal, no migration, no seed.
