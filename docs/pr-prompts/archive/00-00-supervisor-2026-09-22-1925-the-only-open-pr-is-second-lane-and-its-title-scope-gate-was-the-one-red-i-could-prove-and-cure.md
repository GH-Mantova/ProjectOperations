# Station 00 — Supervisor | 2026-09-22T18:15:34Z–2026-09-22T19:30Z

## GROUND

```
UTC            2026-09-22T18:15:34Z
origin/main    25aa3115            (fetched first, then rev-parse)
dev tree       main @ 25aa3115      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE** — this run was not forced read-only by a version mismatch.

**SIGHTED RUN.** Desktop Commander present; `start_process` shell `powershell.exe` answered on the
first call (PID 6828, later PID 12848). This was not a blind run and nothing below is a GitHub-side
substitute for a local read.

Tree read: **the dev tree `C:\ProjectOperations2`**, never the watcher clone (PREFLIGHT step 2's
per-tree `origin/main` rule). `-R GH-Mantova/ProjectOperations` was passed on every `gh` call and
CWD was pinned to the dev tree on every batch (§9.4 CWD bullet).

**Binding documents read IN FULL this run:** `docs/pipeline/DOCTRINE.md` (all 2723 lines, §1–§10.6),
`docs/pipeline/STATION-CAPABILITIES.md` (whole file), `docs/pipeline/stations/00-supervisor.md`
(all 1570 lines). **Freshness proved, not assumed** — `git diff --numstat origin/main -- <each>`
returned **EMPTY** for all three, and `git rev-list --left-right --count HEAD...origin/main` → `0 0`,
so the working copy is byte-identical to `origin/main` for all three (§9.3's compare-content rule;
no piped hash was used — §9.1 forbids it in `powershell.exe`).

`git show origin/main:docs/pipeline/stations/00-supervisor.md` front matter read directly:
`station_doc_version: 1`, `contract_version: 5`.

## WHAT I MEASURED

### vm-git-guard — installer exit code, quoted

[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, run before any
other VM-side call, read directly from the installer and **not** from a pipeline appended to it:

- headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
- last line: `   PATH="/sessions/ecstatic-relaxed-wright/.local/bin:$PATH" git <args>`
- **exit code: 2**

Its own controls, printed by the installer: `bash -lc 'command -v git'` → the shim;
`bash -c 'command -v git'` → `/usr/bin/git`. This is the **middle** outcome the station contract
names as EXPECTED for a station — a FINDING, not a STOP. **No `git` was run against the mount at
any point in this run;** every git call went through the Windows shell via Desktop Commander.

### Breadcrumb freshness — `check-breadcrumb.mjs --freshness`

[MEASURED] exit **0**, verdict `CLEAN`, `structure: 2 checked, 0 malformed`:

```
00  last 2026-09-22T17:25:00Z  0.9h ago  (cadence 1h)  ok
02  dispatch-only — no cadence to miss
03  last 2026-09-21T23:04:00Z  19.3h ago  (cadence 24h)  ok
04  last 2026-09-22T18:10:00Z  0.2h ago  (cadence 4h)  ok
05  last 2026-09-22T14:23:00Z  4.0h ago  (cadence 24h)  ok
```

**No station is SILENT.** The tool also emitted
`NOTE 00-04-scanner-2026-09-22-1810-… is UNTRACKED — it reaches nobody until a board PR commits it`,
which this PR does.

⚠️ The `'00': 2` cadence defect recorded in `STATION-CAPABILITIES.md` §6 is **fixed** — `#2090`
(*"silence detector had station 00 at a 2h cadence against an hourly cron"*) merged 2026-09-22
16:44Z and the table above prints `(cadence 1h)`. That paragraph in `STATION-CAPABILITIES.md` is
now stale; see F6.

### `status-sweep.ps1` — verdict and the LIVE lines I acted on

[MEASURED] captured with `*>` to a file and decoded **utf16le** in node (§9.3 — a `utf8` read of
that capture is structureless). `ENC=utf16le`, 432 lines.

```
7. VERDICT
  [LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Section 0 positive controls both passed (`gh CAN reach GitHub (saw merged PR #2092)`, `node runs`).

| `[LIVE]` line | value |
|---|---|
| OPEN PRs | **1** — `#2093`, `BLOCKED` |
| main CI on `25aa3115` | **7 success / 0 failed** — trunk green |
| watcher node | RUNNING **pid 9744**; auto-restart wrapper alive (1) |
| heartbeat age | 12 min — **idle with an empty queue, which is CORRECT, not wedged** |
| armed (`*-ready.md`) | **0** |
| `index.lock` interactive / clone | `False / False` |
| git processes touching our trees | **0** |
| PR touched in the last 2 min | none |

**Section 5 carried ZERO `[STALE]` rows this run** — every row is `[FILE]`, i.e. *"section 5 CANNOT
decide; read the file"*. So there were **no dead PR-scoped escalations to discharge** on the tag,
and nothing was moved into `needs-marco/discharged/`. `needs-marco/` stands at **61**.

**I did NOT repeat the sweep's `watcher clone: branch=main dirty=5` line as a defect.** DOCTRINE
§9.5 records that flag as untracked-inclusive while `start-watcher.ps1` counts only tracked files
and auto-stashes anyway; it is a known sweep defect, not clone damage.

### Q1–Q6 — the mandatory answer sheet

**Q1. Every open PR, verbatim.** `gh pr view 2093 --json …` → `PR=2093 STATE=OPEN MSS=BLOCKED
DRAFT=False HEAD=feat/scopecards-s7-cutting-one-total OID=d9a69d0080f8b46e9a47727076b172aa51739459
CREATED=2026-09-22T17:58:44Z`, `LABELS=do-not-merge`.
**DIRTY count: 0.** `BLOCKED` is not `DIRTY` — no PR on this board has frozen CI, so the
conflicted-branch blocker does not apply this run.

**Q2. Is a conflict Marco's to direct?** No conflict exists. Not applicable.

**Q3. Armed prompts, counted myself.** `Get-ChildItem docs\pr-prompts -Filter *-ready.md` at
depth 1 → **0**. The sweep agrees (`armed: 0`). Station 04 independently measured 0 tracked
depth-1 ready-files at 18:10Z.

**Q4. Every claim taken from a note, re-verified.** The one claim that mattered was my own previous
run's — that it armed `pr-scopecards-s7-one-cutting-total` and then disarmed it. Verified LIVE from
`.arming-log.txt`, not from the breadcrumb: see the two rows quoted under F1.

**Q5. Silent no-ops.** One new entry since my last run, and it is **not** waved away — F1.

**Q6. The single most important thing blocking progress.** Nothing is blocking the *pipeline*: the
queue is empty, the watcher is healthy and trunk is green. The single most important thing on the
*board* is that `#2093` — the only open PR — carries a **real test regression** in
`estimates.service.spec.ts` (F3) that must be fixed before Marco can release it, and it is the one
red on that PR that I could neither prove transient nor cure inside this slot.

### `#2093` — the lane, established before anything else (§10.1)

[MEASURED] §10.1 step 1 probe, **prompt logs only, `rev-*` excluded**:

| probe | hits |
|---|---|
| `Select-String docs\pr-prompts\processed\pr-*.log -Pattern 'PR #2093\b'` | **0** |
| POSITIVE control `PR #2040` | **1**, carrying a real `merge result` verdict |
| POSITIVE control `PR #2082` | 0 |
| NEGATIVE control `PR #999412` | **0** |

The instrument answers (the `#2040` control returns a real verdict) and answers **zero** for
`#2093`. Corroborated by `.arming-log.txt`, whose newest row is the **17:26:49Z DISARM** — there is
**no arm anywhere in `#2093`'s window** (created 17:58:44Z), so no watcher build could have started.

**`[NO LANE VERDICT — hand-classified]` → SECOND LANE.** Hand-classified under §10.1 step 2 with
`classifyPolicyFiles` as the definition: its file list includes
`apps/api/prisma/migrations/20260923000002_…/migration.sql` (and two more), which matches
`(^|/)migrations/` and is **refused on that clause alone**; it also touches seven
`apps/api/src/modules/**` files outside `tests|docs`. **It is Marco's.** Step 3's station-lane
exception does not apply — no station lane covers `apps/api` or migrations.

That is **two independent gates**, either of which is sufficient: the `do-not-merge` label (only
Marco removes it) and the step-2 classification. **I did not merge it and could not have.**

### `#2093` — the five reds, each root-caused from the JOB LOG (§3), never from the diff

`gh pr checks 2093 --json name,state,link` → TOTAL **15**, five not-SUCCESS. Job logs were read
with the **last tab-separated column** extracted (§9.1 — column 1 is the job name and grepping the
whole line matches every line).

| # | check | root cause, from the log | class |
|---|---|---|---|
| 1 | `Approval receipt (CP-26)` | `FAIL - CP-26 approval-receipt **[LABEL_PRESENT]** PR carries the do-not-merge label (escalates:true). A human must review and REMOVE the label` | **PARKED BY DESIGN** |
| 2 | `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)` | the **only** FAIL line in that job is `FAIL - CP-26 do-not-merge [PR carries the do-not-merge label …]` | **same single cause as #1** |
| 3 | `Pipeline — watcher + linter tests` | every test suite reported `# fail 0`; the exit-1 came from the **PR-title scope gate** | **REAL — cured this run** |
| 4 | `API — lint, test, compliance smoke` | `Tests: 1 failed, 6 skipped, 4924 passed, 4931 total` — one assertion | **REAL — not cured, F3** |
| 5 | `tendering-e2e` | `1 failed, 165 passed`, in an unrelated area | **TRANSIENT candidate — re-run, F4** |

Reading the CP-26 **verdict token** rather than the pass/fail counts is what separates rows 1–2 from
real work (§9.4). `[LABEL_PRESENT]` means parked; there is no agent-side action behind it, and
**a PR carrying `do-not-merge` can never be green.** Three consecutive collect runs in this
pipeline's history listed such rows as "reds to fix"; these two are not work.

### Row 3 — the PR-title scope gate, and its cure proved locally before I touched the board

[MEASURED] from the job log, with the gate printing **its own controls** as all-true
(`positive(slice-1 module vocabulary live)=true … negative(no scope at all)=true`), so the
instrument is sound in §7's sense:

```
[TITLE_SCOPE_UNRESOLVED] scope "scopecards" names nothing this repo can point at.
seen:       scopecards
normalised: scopecards   (no slice suffix to strip)
FAIL    "feat(scopecards): S7 - one cutting total on the server (CUTTING_ONE_TOTAL_V1)"
nearest 5:  board, contacts, contracts, dashboards, projects
Do NOT add this scope to scripts/pipeline/title-scope-baseline.json. That file
may only SHRINK; adding to it is the gate failing open.
```

The gate names its own cure: rename the PR to a scope in the vocabulary. **`tendering` is the
correct one, and that is measured rather than chosen** — eight of the PR's fifteen files sit under
`apps/api/src/modules/tendering/`, and `Test-Path apps\api\src\modules\tendering` → **True**.

I ran the gate's own script locally **before** editing anything, both directions:

| `PR_TITLE` | result | exit |
|---|---|---|
| `feat(tendering): S7 - one cutting total on the server (CUTTING_ONE_TOTAL_V1)` | `PASS  scope=tendering  normalised=tendering  via=vocabulary` | **0** |
| `feat(scopecards): …` — NEGATIVE control, the live title | FAIL, same `may only SHRINK` text | **1** |

**I did not touch `title-scope-baseline.json`.** The gate says adding to it is the gate failing
open, and the complete-and-additive fix is the rename.

### Row 4 — the one real regression, named exactly

[MEASURED] from the `API — lint, test, compliance smoke` job log:

```
FAIL src/modules/estimates/__tests__/estimates.service.spec.ts
  ● EstimatesService — summary › computes per-line costs, applies item markup, and rolls up totals + markupAmount
    expect(received).toBe(expected) // Object.is equality
    Expected: 800
    Received: 0
    > 619 |     expect(a.cutting).toBe(800);
  at Object.<anonymous> (src/modules/estimates/__tests__/estimates.service.spec.ts:619:23)
Test Suites: 1 failed, 1 skipped, 312 passed, 313 of 314 total
Tests:       1 failed, 6 skipped, 4924 passed, 4931 total
```

**One assertion out of 4931.** See F3 for the cause and the cure — both are named there rather than
here, because a finding must carry a disposition and a measurement must not.

### Row 5 — the e2e failure, and why it is a transient candidate

[MEASURED] `1 failed, 165 passed (8.8m)`, the single failure being
`batch4-tender-documents.spec.ts:95:7 › Batch 4 — Tender documents (PRs #22, #341) › mock
SharePoint mode: Open shows the connection-required toast instead of navigating`, failing on
`expect(locator).toBeVisible() … element(s) not found`.

**Tender documents / a mock-SharePoint toast has no causal path to a concrete-cutting pricing
change.** Trunk is green on `25aa3115` (7 success / 0 failed), so this is not a main regression
showing through. Station doc rule 5 governs: re-run before diagnosing a defect.

### Station 04's dispatches to me, re-verified rather than taken on trust (§7.1 re-read rule)

04's 18:10Z breadcrumb is at `25aa3115`, the current head, so its SHA is current.

- **F2** (§9.4's escaped-`--jq` bullet quotes `join(,\)` while the measured arrival is `join(",\)`):
  I did not re-measure it this run and have not edited DOCTRINE on it. Carried forward — F5.
- **F3** (`git branch -r` → 147 vs `git ls-remote --heads origin` → 16): carried forward — F6 is a
  different item; the prune decision is F7.
- **F7** (a drained buffer that may be CAPPED at 12 lines): **I met the sibling shape myself this
  run and it went the other way.** `interact_with_process` reported
  `✅ Process 6828 has finished execution`; per §9.1's
  `FALSE_TERMINATION_IS_AN_EARLY_READ_NOT_AN_UNRUN_STATEMENT_V1` I drained the buffer rather than
  believing it, and `read_process_output` returned **630 lines** — the output was **pending, not
  absent**, and the shell was alive. Guard (2)-as-strengthened cost one call and decided it. That
  is a POSITIVE control for the existing correction and **does not** settle 04's line-cap question.

## WHAT CHANGED

1. **`#2093` PR title renamed** — the only board mutation this run.
   `gh pr edit 2093 -R GH-Mantova/ProjectOperations --title "feat(tendering): S7 - one cutting
   total on the server (CUTTING_ONE_TOTAL_V1)"`, exit **0**.
   **Read back** (`gh pr view 2093 --json title,headRefOid`):
   `READBACK_TITLE=feat(tendering): S7 - one cutting total on the server (CUTTING_ONE_TOTAL_V1)`,
   `READBACK_OID=d9a69d0080f8b46e9a47727076b172aa51739459` — **the head OID is unchanged**, so the
   diff was not touched and the `CUTTING_ONE_TOTAL_V1` marker other instruments key on survives.
2. **`tendering-e2e` failed jobs re-run** — `gh run rerun 35765653116 --failed`, exit **0**.
3. **This breadcrumb**, written **inside this run's PR worktree** (`C:\po-wt\sup-20260922-1925`),
   which is REPORT CONTRACT cure 1 — no loose untracked copy is left in the dev tree, so it cannot
   block the next fast-forward.
4. **Station 04's 2026-09-22T18:10Z breadcrumb committed** at its tracked root path. It was
   untracked in the dev tree and reached nobody until this PR.
5. **`docs/pipeline/sweep-rotation.json` swept in** — 04 advanced it to `last_index=1`,
   `last_run_utc=2026-09-22T18:10:25Z` and may not commit it. Without this the rotation silently
   stops and 04 repeats the `instrument-honesty` sweep.

**Nothing else.** No prompt armed, disarmed, renamed, staged, moved or deleted. No PR merged. No
`/sot/` file touched. No `git` against the mount. No Azure / Entra / SharePoint contact of any kind.

## FINDINGS

### F1 — my own previous run armed a prose-gated prompt, the code-writer refused it, and the disarm worked exactly as intended

[MEASURED] from `.arming-log.txt`, the only clock that dates an arm (§9.5 — a `-ready.md`'s mtime
dates its authorship, not its arming):

```
2026-09-22T17:25:14Z  ARMED     pr-scopecards-s7-one-cutting-total  escalates=true  actor=station-00.sched  pid=33416
2026-09-22T17:26:49Z  DISARMED  pr-scopecards-s7-one-cutting-total  reason=prose-human-gate-'Arming is Marco''s'-missed-at-arm-time  actor=station-00.sched  restage-b-moved-to=no-pr-opened/  HOLD-restored-byte-exact-from-HEAD
```

And from the new `no-pr-opened/` entry — **read, not waved away** (Q5):

```
# pr-scopecards-s7-one-cutting-total-ready.md
Started: 2026-09-22T17:25:17.016Z   Ended: 2026-09-22T17:25:40.503Z   Exit: 0
… the S7 cutting-total prompt at the bottom is marked `STATUS: Staged HOLD ... Arming is Marco's`
— I won't dispatch it without your say-so.
```

**The real reason it produced nothing:** the prompt carries a **prose** human gate. `lint-prompt.mjs`
ADMITs it, because a prose gate matches none of the three literal markers (§9.5 — *"a prose human
gate matches neither regex … so still read the BODY before arming"*). The code-writer read the body
and refused. **That is the gate working at the last line of defence, after the linter and after me.**

The prompt is **still valid and still must not be armed**: `pr-scopecards-s7-one-cutting-total-HOLD.md`
is tracked on `origin/main` and present at depth 1, restored byte-exact from `HEAD` by the disarm.
Depth-1 `*-ready.md` on disk is **0**, so nothing is armed and nothing will reprocess.

🔴 **But it is now also a §10.6 duplicate hazard, which the disarm could not have known.** A second
lane opened `#2093` for **the same work** 32 minutes after the disarm. §10.6: *"the premise dies on
MERGE, not on OPEN"* — so while `#2093` sits open and unmerged, this HOLD's premise
(`grep -q "cuttingLines.reduce" apps/api/src/modules/tendering/scope-of-works.service.ts`) is still
TRUE on `main`, it lints ADMIT, and it will surface under `triage-holds.ps1`'s
**GATES SATISFIED — CANDIDATES**, which is exactly where an arming decision goes looking. Arming it
would build a **second PR for work already open**.

**ACTIONED** — verified by: the two arming-log rows above (the disarm is recorded, not inferred),
`git ls-tree -r origin/main -- docs/pr-prompts/` confirming the HOLD is tracked, and a depth-1
`*-ready.md` count of **0** on disk. The prompt is parked correctly and this breadcrumb is now the
durable record of **both** reasons it must not be armed — the prose gate *and* the open duplicate.

### F2 — the only open PR is SECOND LANE, is Marco's on two independent gates, and I said so rather than letting an empty probe read as "cleared"

[MEASURED] the step-1 probe returned **0** for `#2093` against a POSITIVE control of 1 on `#2040`
and a NEGATIVE control of 0, with no arm anywhere in the PR's window. §10.1 step 4 forbids recording
"no verdict found" as "not routed to Marco", so: **`[NO LANE VERDICT — hand-classified]`**, and the
hand-classification under step 2 is **Marco's** — three `migrations/` files refuse
`classifyPolicyFiles` on their own clause, and seven `apps/api/src/modules/**` files sit outside
`tests|docs`. The `do-not-merge` label is a second, independent gate that only Marco removes.

This matters beyond this PR because `STATION-CAPABILITIES.md` §5 carried *"and anything not
watcher-routed"* until 2026-09-22 — the clause narrowed that same day by
`NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1` after it licensed two out-of-lane merges.
**`#2093` is precisely the shape that clause used to authorise**, and the narrowed rule held.

**ACTIONED** — verified by: the probe with both controls, the arming-log window check, the file list
read from `gh pr view --json files`, and the label read from `gh pr view --json labels`
(`LABELS=do-not-merge`). Nothing was merged; the classification is recorded here so the next run
does not re-derive it from an empty probe.

### F3 — `#2093` carries one real test regression, the cause is a fixture that predates the slice's own contract, and I did NOT fix it

[MEASURED] `expect(a.cutting).toBe(800)` → **Received: 0**, in
`src/modules/estimates/__tests__/estimates.service.spec.ts:619`, 1 failed of 4931.

**The cause, read from the prompt that specifies this work** (`pr-scopecards-s7-one-cutting-total-HOLD.md`),
not guessed. Its `premise_means` states that an estimate cutting line *"has nowhere to store a total,
so six readers each re-multiply qty × rate for themselves"*, and it names
`estimates.service.ts:1405  round2(item.cuttingLines.reduce(... toNumber(l.qty) * toNumber(l.rate) ...))`
as one of the six folds the slice replaces with a stored `lineTotal`. Its `rollback_strategy`
describes three migrations: add nullable `line_total`, `UPDATE … SET line_total = ROUND(qty * rate, 2)`,
then `NOT NULL` — and says in as many words that the backfill *"moves no figure"*.

So after the change `estimates.service.ts` reads the stored `lineTotal`, the spec's fixture rows
carry `qty` and `rate` but no `lineTotal`, and the roll-up correctly reports **0** for a fixture that
no longer describes a real row. **The migration guarantees every real row has `line_total = ROUND(qty
× rate, 2)`, which for this fixture is exactly the 800 the test already asserts.**

🔧 **The complete-and-additive cure is to give the fixture the field the migration guarantees —
`lineTotal: 800` — and leave `expect(a.cutting).toBe(800)` untouched.** That is RULE 1's first half
(it fixes the immediate red and the future one, because every later fixture inherits the real row
shape) and it damages no data entry. **It is explicitly NOT a weakened assertion** — DOCTRINE §8.2
forbids that, and the assertion is the one thing that must not move. ⚠️ **The next run must still
open the spec at the PR head and confirm the fixture is the only thing missing the field** before
pushing; I read the prompt's contract, not the spec's source, so the cure is `[INFERRED]` from a
document and the fixture shape itself is **[CANNOT MEASURE]** from the job log alone.

**DEFERRED** — real, and deliberately not now. Three reasons, stated plainly rather than dressed up:
the PR is a **second lane's** branch whose head commit is a `Merge branch 'main' into …`
update-branch from within the last ninety minutes, so pushing to it risks the LL-38 collision that
BOARD DRIVING condition 3 exists to prevent; the PR **cannot merge either way** while `do-not-merge`
is on it, so nothing is unblocked by fixing it this minute; and this run is already past its hourly
slot, and station doc rule 7 says to land what is in flight and write a crisp handover rather than
start work I cannot finish.

**What would make it urgent, and it is a date, not a feeling:** if `#2093` is still red on this
assertion at the next collect **and** its head OID is still `d9a69d00` (i.e. the second lane has
stopped working it), the next Station 00 run fixes it directly — isolated worktree off the PR head,
add `lineTotal` to the fixture, `pnpm --filter @project-ops/api test -- estimates.service`, push,
read back the check. If the OID has moved, re-measure first: the lane may have fixed it.

### F4 — the e2e red is an unrelated-area failure on a green trunk; re-run dispatched

[MEASURED] `1 failed, 165 passed`; the failure is a mock-SharePoint toast in
`batch4-tender-documents.spec.ts`, which has no causal path to a concrete-cutting pricing change,
while `main` CI on `25aa3115` is **7 success / 0 failed**.

**ACTIONED** this run — `gh run rerun 35765653116 -R GH-Mantova/ProjectOperations --failed`,
exit **0**. ⚠️ **The re-run's result is not yet known and I am not claiming it passed.** Station doc
rule 5 is explicit that a red is only a real defect *after* a clean re-run still fails, so the
verdict belongs to whoever reads it next. If it fails again on the same toast locator it is a real
defect and should be treated as one — and if it fails again on a *different* test, that is a flaky
suite and a finding in its own right.

### F5 — DOCTRINE §9.4's escaped-`--jq` bullet quotes an arrival string that no longer matches the measurement (Station 04, F2, dispatched to me)

04 measured at `25aa3115` that `join(\",\")` arrives as **`join(",\)`** — the first double quote
survives — against the bullet's text, which says it *"arrives as `join(,\)`"*. The **headline rule
was confirmed in both directions** by 04 and again incidentally by me: my own first `--jq` attempt
this run used escaped double quotes and failed **LOUDLY** with
`failed to parse jq expression (line 1, column 92) … unexpected token "|"`, exit non-zero, never
silently. Illustration drift, not a rule defect — the same shape §9.2's `ls-tree` bullet records
being corrected for in 2026-08-31.

**DEFERRED** — real, not now. It is a one-line `docs/`-only correction squarely inside my lane, and
it was dispatched to me, so deferring needs a reason: a DOCTRINE edit must be hand-landed and exact
(§10.3 — *"hand-land when the content must be exact — binding law, a canonical block, a correction
to DOCTRINE itself"*), and §9.4 sits inside the **hash-gated `instruments v2` canonical block**, so
editing it means re-recording the block hash and shipping that change on its own rather than riding
it into a collect PR. **What makes it urgent:** a run reporting that the §9.4 bullet "does not
reproduce" because it hunted for the literal `join(,\)` — that is the retirement-of-a-live-trap
failure this correction exists to prevent, and it costs a whole run when it happens.

### F6 — `STATION-CAPABILITIES.md` §6 still says the silence detector has station 00 at a 2h cadence; that defect is FIXED and the paragraph now misleads in the safe-looking direction

[MEASURED] `check-breadcrumb.mjs --freshness` printed `00  last 2026-09-22T17:25:00Z  0.9h ago
**(cadence 1h)**  ok` — the `'00': 2` value is gone, landed by `#2090` (*"silence detector had
station 00 at a 2h cadence against an hourly cron"*), merged 2026-09-22T16:44Z.

`STATION-CAPABILITIES.md` §6's closing red paragraph still reads *"`00` in it still reads **2**"*
and instructs every reader that *"a green `ok` from `--freshness` is a weaker statement about `00`
than about any other station"*. That is now false, and its own stated falsifying probe — *"the
`const CADENCE =` line itself"* — is what refutes it. It fails in the direction of a station
distrusting a correct instrument, which is §7's shape applied to a document.

**DEFERRED** — real, not now, and for the same reason as F5: it is `docs/`-only and inside my lane,
but the correction should be verified against the `const CADENCE =` symbol in
`scripts/pipeline/check-breadcrumb.mjs` before being written, and hand-landed exactly. I read the
freshness **output**, not the source line, so the source is `[INFERRED]` this run. **What makes it
urgent:** it already had one job — to stop a missed hourly 00 run going unnoticed — and a reader who
believes it will discount a `--freshness` `ok` that is now fully trustworthy.

### F7 — the dev tree's remote-tracking cache over-reports the remote 9.2×, and the prune decision was dispatched to me (Station 04, F3)

04 measured `git branch -r` → **147** against `git ls-remote --heads origin` → **16** at
`25aa3115`; documented history is 54 vs 21 (2026-08-29) and 12 vs 7 (2026-09-03). The doctrine rule
is unchanged and was never in doubt — **ask the remote** — so nothing about this makes a correct
probe wrong. What 04 handed me is the **decision**, not the finding: whether to run
`git fetch origin --prune` in the dev tree, and whether to clear the leftover `refs/remotes/pr/*`
refs that no refspec owns and that `--prune` therefore cannot remove (§9.2).

**DEFERRED** — real, not now. `--prune` is a mutation of a tree shared with concurrent chats and
the watcher, and this run's remaining budget was spent on the board. It is also **not** urgent on
its own terms: 147 stale tracking refs cost nothing until something counts them, and the cure for
that is the doctrine rule, which already says never to. **What would make it urgent:** any run
filing a stranded-branch or worktree-teardown finding sourced from `git branch -r` — at that point
the over-count has produced a false finding and the prune should be done in the same run that
catches it, with `git ls-remote --heads origin` as the read-back.

### F8 — the guard is INERT in this run's shell, so the device-bridge git ban is remembered, not mechanical

[MEASURED] installer exit **2**, headline and controls quoted verbatim under WHAT I MEASURED. This
is the middle outcome the station contract names as EXPECTED, and it is a FINDING rather than a STOP
by that contract's own table. No `git` was run against the mount at any point this run.

**DEFERRED** — real, not now; it is the documented expected outcome and the contract already tells
every station to carry on. **What would make it urgent:** an installer exit **other than 0 or 2**
(meaning the shim was not written at all), or any station reporting a 0-byte `index.lock` with no
owning Windows process — which is the damage the guard exists to prevent (§9.2, seven occurrences).

## WHAT I DID NOT DO

- **Did not merge anything.** The only open PR is second-lane, carries `do-not-merge`, and
  hand-classifies as Marco's under §10.1 step 2 (F2). Both gates bind independently.
- **Did not remove the `do-not-merge` label** from `#2093`, and did not treat its two CP-26 reds as
  work. Only Marco removes that label; `[LABEL_PRESENT]` means parked, not broken.
- **Did not push a commit to `#2093`'s branch** (F3). The cause and the cure are written down with a
  dated trigger instead, because the second lane's own update-branch commit is the head and
  BOARD DRIVING condition 3 forbids acting alongside another actor.
- **Did not touch `scripts/pipeline/title-scope-baseline.json`.** The gate states that adding a
  scope to it is the gate failing open; the rename is the additive cure.
- **Did not arm anything.** Zero prompts armed — `pr-scopecards-s7-one-cutting-total-HOLD.md` is
  ADMIT and gate-satisfied and is a **never-arm** for two independent reasons (F1), which is exactly
  the trap §10.6 describes and this breadcrumb now records.
- **Did not edit `DOCTRINE.md`** for F5, and did not retire, narrow or reword any §9 bullet. Nothing
  in it failed to reproduce this run.
- **Did not run `git fetch --prune`** (F7), and did not clear `refs/remotes/pr/*`.
- **Did not discharge any `needs-marco/` file.** Section 5 of the sweep carried zero `[STALE]` rows;
  every row was `[FILE]`, i.e. undecidable on the tag, and the standing rule is never to clear on the
  tag alone.
- **Did not restart, kill or otherwise touch the watcher.** It is RUNNING (pid 9744) with its
  wrapper alive; a 12-minute heartbeat against an empty queue is **idle, which is correct** — the
  BUSY/idle distinction that once nearly killed a healthy watcher.
- **Did not do 03's, 04's or 05's work.** 04's dispatches are dispositioned above, not executed.
- **No Azure / Entra / SharePoint contact of any kind**, read or write.

## FOR MARCO

**One thing needs you, and only when you want it.** `#2093` (*S7 — one cutting total on the server*)
is the only open PR. It is a **second-lane** PR touching three migrations and seven `apps/api`
files, so it is yours to release and yours to merge — I classified it, drove what I could, and
merged nothing.

Its reds are now four, not five, and they sort cleanly:

- **two are the `do-not-merge` label itself** (CP-26, twice, from one cause) — they disappear the
  moment you remove the label and not before;
- **one was the PR-title gate**, which I fixed: the title now reads `feat(tendering): …` instead of
  `feat(scopecards): …`, proved PASS against the gate's own script before I touched the board. The
  diff and the `CUTTING_ONE_TOTAL_V1` marker are untouched. ⚠️ **No workflow on this repo triggers
  on a title edit**, so that check stays red on the board until the next push to the branch —
  the fix is in, the re-evaluation is not;
- **one is a real regression I did not fix, on purpose.** `estimates.service.spec.ts:619` expects
  `a.cutting` to be 800 and gets 0, because the slice moves that number to a stored `lineTotal` and
  the test's fixture predates it. The fix is to give the fixture the `lineTotal` the migration
  guarantees — *not* to change the assertion. I left it because the branch is another actor's and
  was being pushed to this hour, and because the PR cannot merge while the label is on regardless.

Nothing else is waiting. The queue is empty, nothing is armed, the watcher is healthy, trunk is
green, and no station is silent.
