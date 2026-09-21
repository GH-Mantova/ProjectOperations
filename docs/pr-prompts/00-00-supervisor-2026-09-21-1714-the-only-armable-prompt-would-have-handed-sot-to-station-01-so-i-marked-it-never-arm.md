# Station 00 — Supervisor | 2026-09-21T17:13:57Z–2026-09-21T17:4xZ

## GROUND

```
UTC            2026-09-21T17:13:57Z
origin/main    87e22199            (git fetch origin +refs/heads/main:... then rev-parse)
dev tree       main @ 87e22199      C:\ProjectOperations2   (0 ahead / 0 behind)
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** (both `1`). No read-only downgrade — **full authority run.**

🟢 **SIGHTED RUN**, said in the first line because a blind run and a healthy quiet run both produce
"no news". Desktop Commander was loaded on the prescribed keyword `ToolSearch` and `start_process`
shell `powershell.exe` returned a live shell on the first call, printing `main` and
`87e22199 2026-09-22 docs(pr-prompts): station 00 collect …`. Every measurement below came through
that transport except where a line says otherwise.

**Device-bridge git guard installed FIRST, before any VM-side call. Last line, verbatim:**

```
vm-git-guard installed at /sessions/funny-eloquent-maxwell/.local/bin/git - refuses mounted paths
and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

**Install PASSED.** No `git` ran through the device bridge against the Windows `.git` at any point.

**Binding-document freshness PROVED, not assumed** — in the dev tree, after an explicit fetch, using
the sound form (§9.1: never a piped `hash-object`):

```
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md \
                                  docs/pipeline/DOCTRINE.md \
                                  docs/pipeline/STATION-CAPABILITIES.md   -> EMPTY
```

All three read from a working copy proved identical to `origin/main`.

## WHAT I MEASURED

**Sweep, and the early-return trap fired exactly as DOCTRINE §9.3 predicts.** Streamed through
`read_process_output` the sweep reported `0 remaining` at **131 lines**, ending inside section 5 —
no section 6, no section 7, no verdict. Captured to a file instead (`*>` from a `.ps1`, decoded
`utf16le` per §9.3) it is **951 lines / 159,328 bytes** and complete. `[MEASURED]` — this is the
prescribed cure working, quoted because PREFLIGHT step 4 exists for it.

**Section 7 verdict, verbatim:**

```
SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

**Board, re-measured live at ~17:2xZ (not carried from the 17:14Z sweep).** `gh pr list -R
<owner>/<repo>`, exit 0, `OPEN_COUNT=5`:

| PR | mergeState | labels | CI |
|---|---|---|---|
| `#2051` | BLOCKED | `do-not-merge` | 13 pass / **2 fail** |
| `#2049` | UNKNOWN | — | **15 pass / 0 fail** |
| `#2047` | BLOCKED | `do-not-merge` | 13 pass / **2 fail** |
| `#2044` | BLOCKED | `do-not-merge` | 13 pass / **2 fail** |
| `#2042` | **CLEAN** | — | **15 pass / 0 fail** |

**The 2 fails on #2044/#2047/#2051 are the label, not a defect** — §9.4's `[LABEL_PRESENT]` shape.
Read from **column 3** of the CP-26 job log (§9.1's tab-column trap), spot-checked on `#2044`,
job `106420542225`, `VERDICT_LINES=1`, verbatim:

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

`[LABEL_PRESENT]` = **parked by design, nothing to fix, only Marco clears it.**

**RULE 2 lane verdicts, RE-TAKEN this run and not carried** (§10.1 — a lane verdict is
non-monotonic and is only as of the minute it was taken). Prompt logs only, `rev-*` excluded:

- corpus **2345** logs; newest `rev-2054-ready.md.log` at **2026-09-21T16:28:22Z**, younger than
  every open PR's `createdAt` (oldest `#2042`, `10:02:39Z`) — **freshness precondition PASSES**;
- POSITIVE calibration `marco.:true` (regex, quote-free per §10.1) → **697**;
- NEGATIVE control `PR #999995` → **0**; `gh pr view 999997 --json number,state` → exit **1**.

| PR | prompt-log hits | verdict, verbatim reason |
|---|---|---|
| `#2042` | 3 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/tendering/ClientQuotesPanel.tsx"}` |
| `#2049` | 1 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/lint-station.mjs"}` |
| `#2044` | 2 | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` |
| `#2047` | 2 | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - PR already carries \`do-not-merge\` - no duplicate apply"}` |
| `#2051` | 2 | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` |

Every verdict sits in the log of the prompt that **opened that PR**, alongside that prompt's own
`PR #<n>` line for the **same** number — so none of these is §10.1's prose-scrape
(`PRNUMBER_SCRAPED_FROM_PROSE_V1`). Every reason names a **real policy path or the escalates flag**,
none is the `timeout waiting for green checks + MERGE verdict` string — so none is a §10.3 timeout
wearing a routing's clothes. **Five of five are genuine routings. RULE 2 binds on all five.**

**Watcher — the sanctioned verdict, not my reasoning** (`restart-watcher-if-wedged.ps1`, report-only):

```
armed prompts waiting: 0
watcher process:       ALIVE (pid 9744)
restart churn:         0 cycle(s) in 20 min  (starts=0 exits=0, threshold 4)
VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.
```

Sweep agrees independently: node RUNNING pid 9744, auto-restart wrapper **alive (1)** — so §3b's
`wrapper=0` question does not arise this run and nothing was relaunched.

**Queue census, counted myself** (Q3): `-ready.md` → **0**; `-HOLD.md` → **20**; `LOOPING` → 0.
`triage-holds.ps1` (read-only, both its controls PASS): `spent=0 of 20`, `gates-satisfied=4`,
`still-gated=16`, `unreadable=0`.

**Three of the four ADMITs are confirmed duplicates of an open PR, on the MARKER and not the head
branch** (§10.6's corrected rule):

| ADMIT prompt | overlap | open PR | marker in the PR title |
|---|---|---|---|
| `pr-crmvis-s8-comms-threads-HOLD.md` | 3 of 3 | `#2044` | `CRM_PARITY_THREADS_V1` ✅ |
| `pr-permission-role-reconciler-HOLD.md` | 7 of 7 | `#2047` | `role-grant registry v1` ✅ |
| `pr-lintstation-contract-version-compare-HOLD.md` | 9 of 9 | `#2049` | title matches, and the PR's own scope list includes `docs/pr-prompts/superseded/pr-lintstation-contract-version-compare-HOLD.md` — **#2049 retires this file itself on merge** |

**That leaves exactly ONE genuine arming candidate, and it is F1 below.**

**Freshness + `lastRunAt` crossed, per the COLLECT table.** `check-breadcrumb.mjs --freshness`:
`structure: 3 checked, 0 malformed`, `CLEAN`, exit **0**. Against the scheduled-tasks MCP:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| 00 | `17:13:57Z` (this run) | `16:08Z` | aligned |
| 03 | `2026-09-21T00:20:35Z` | `00:21Z` | aligned; next `23:02:45Z` |
| 04 | `2026-09-21T14:09:34Z` | `14:10Z` | aligned; next `18:09:31Z` |
| 05 | `2026-09-21T14:10:40Z` | `14:11Z` | aligned; next `2026-09-22T14:22:37Z` |

**No station is SILENT and none is in the "fresh `lastRunAt`, no breadcrumb" row**, so no transcript
read was needed. `weekly-security-audit` remains `enabled: false` — unchanged, already filed.

**Sweep section 5 carries ZERO genuine `[STALE]` escalation rows this run.** A raw `[STALE]` grep
over the captured report returns 4 lines and **all four are the legend or a quotation** — the HOW TO
READ header, its `[LIVE]=…` bullet, a `[FILE]` line quoting an old breadcrumb, and the closing
"never repeat a `[STALE]` line as current". **So there is nothing for the COLLECT discharge step to
clear**, against the eleven the station doc records from 2026-09-10. Section 5's live content is
entirely `cites #N (MERGED) as evidence -- not its premise; does not clear the escalation`, which by
its own wording is not a discharge signal.

**Dev tree clean before I touched anything:** `git rev-list --left-right --count HEAD...origin/main`
→ `0 0`; `git diff --numstat` → EMPTY; `git diff --cached --name-status` → EMPTY (so nothing another
chat staged would ride along on my commit — §9.2).

## WHAT CHANGED

1. **`docs/pr-prompts/pr-queue-layout-sot-entry-HOLD.md` now carries the literal
   `<!-- watcher: do-not-arm -->` marker** and a measured explanation of why (F1). Four read-backs,
   all quoted in F1.
2. **Three fully-dispositioned breadcrumbs `git mv`-ed into `docs/pr-prompts/archive/`** — the
   1509 and 1608 Station 00 runs and Station 05's 1411 — leaving the queue root holding only this
   run's report, so the next run's "what is new" is a directory listing rather than a re-reading of
   prose. Safe for freshness (§9.5: `trackedSet` is `git ls-tree -r`, matched by trailing path
   segment).
3. **Nothing else.** No merge, no arm, no label touched, no watcher restart, no `sot/` edit, no
   worktree pruned.

## FINDINGS

### F1 — The queue's ONLY armable prompt would have handed `sot/` to Station 01, and nothing in the build path stops it (S1)

`SOT_LANE_PROMPT_IS_ARMABLE_BY_THE_WATCHER_V1`

`pr-queue-layout-sot-entry-HOLD.md` is the one ADMIT with no open-PR overlap, so it is the single
prompt this run could legitimately have armed. Its front matter reads `station: '05'` and
`scope: - sot/02-roadmap-and-status.md`, and its body opens **"Station 05 only. `sot/` belongs to
the SoT Keeper and to nobody else."**

🔴 **But arming routes work to the WATCHER, which builds it through Station 01 — and the watcher
does not read the `station:` field.** `[MEASURED]` this run against
`scripts/pr-watcher/index.mjs`: `Select-String 'station'` returns **3** hits and **all three are a
comment or a message string** (`// invisible to worktree stations …`, a BEHIND-branch comment, and
an untracked-prompts warning string). **None is a front-matter read.** POSITIVE control
`classifyPolicyFiles` → **2**; NEGATIVE control, a freshly minted needle → **0**. So `station: '05'`
is documentation, not routing, and `git mv`-ing this file to `-ready.md` hands a `sot/`-only build
to Station 01 — which `STATION-CAPABILITIES.md` §5 records as **`Edit /sot/` → ✅ only 05**.

🔴 **Nothing in the toolchain flagged it.** `lint-prompt.mjs` ADMITted it at exit 0 (its gate
`docs/pipeline/QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1` is genuinely met and its premise
`! grep -rq "QUEUE_LAYOUT_V1" sot/` is genuinely TRUE, so the work really is outstanding), and
`triage-holds.ps1` listed it under **GATES SATISFIED — CANDIDATES** with no annotation at all,
directly beneath the three it *did* annotate as possible duplicates. The station-only constraint
lived in **prose**, which DOCTRINE §9.5 records as invisible to both the linter and any grep built
on it — *"exactly that burned an arm on 2026-08-28T14:09Z"*.

⚠️ **The exposure is exactly one file, not systemic.** `Select-String '^\s*-\s*sot/'` over every
depth-1 `-HOLD.md`, taken with `-ExpandProperty Path -Unique` and never `Filename` (§9.3's
`FILENAME_UNIQUE_COLLAPSES_SAME_NAMED_CORPUS_V1`), returns **1** — this prompt.

⚠️ **And it has been dispatched to 05 without being executed for five days.** `queue-layout-sot-entry`
appears **35** times across `archive/`, including breadcrumbs of 2026-09-17 titled
*"a dispatch to 05 survived an 05 occurrence unread"*. 05 has run daily since. A dispatch that five
occurrences have not consumed is not a dispatch; it is a file waiting to be armed by the next run
that reads `ADMIT` and stops there.

**DISPOSITION: ACTIONED**, by the cure DOCTRINE §9.5 names for precisely this case — *"Adding the
literal marker is the cure for any future never-arm prompt, and it fires at the `DO_NOT_ARM_COMMENT`
test before the premise is ever evaluated."* This is a `docs/pr-prompts/` edit, squarely inside 00's
lane. **Four read-backs, all passing:**

```
lint-prompt.mjs  -> REJECT  [HUMAN_GATE_PRESENT]  exit 1
                    "line 2 contains <!-- watcher: do-not-arm --> marker."
git diff --numstat origin/main -- <path>  ->  12   0   (twelve insertions, ZERO deletions)
Select-String 'watcher: do-not-arm'       ->  1 hit, line 16, column 0
git diff --cached --name-status           ->  EMPTY   (nothing else rode along)
```

The `12 0` is §9.3's byte-delta assertion: the edit is exactly additive and nothing spilled, which
is the read-back that the node `String.replace` `$`-substitution trap defeats and a
present/absent check cannot see.

🔴 **RULE 1, and why this is the complete-and-additive option.** It solves the immediate half —
the prompt can no longer be armed by accident — and the future half, because the marker is a
property of the file rather than of one run's vigilance, and it survives every later reader. It
damages nothing: the work is **not** cancelled, the premise is untouched, and 05 removing the
marker is a one-line edit whenever it executes. The alternatives both fail a half: *keep
dispatching to 05 each run* fails the future half and is measured to have failed five times
already; *arm it* fails the immediate half by violating the authority matrix.

**DISPATCHED in the same breath → Station 05.** The work is real and is yours: add the
`QUEUE_LAYOUT_V1` entry to `sot/02-roadmap-and-status.md` per the prompt body, **by hand in a
doc-reconcile PR, not by arming this file**, and remove the marker in that same PR. ⚠️ **Falsifying
probe: re-run `lint-prompt.mjs` on this prompt.** If it ever returns ADMIT again while the
`sot/` entry is still absent, the marker was removed without the work being done.

### F2 — #2042's e2e re-run came back GREEN: the 16:08Z run's F3 was right, and that probe is now closed (S3)

The 16:08Z run re-ran `tendering-e2e` on `#2042` as a suspected flake and wrote its own falsifying
probe: *"if it fails again on the same spec, this disposition is wrong."* **`[MEASURED]` this run:
`gh pr checks 2042` returns 15 of 15 `pass`, `tendering-e2e pass 9m52s`, run `35626051008`, and the
PR's `mergeStateStatus` has moved BLOCKED → `CLEAN`.**

The probe is answered in the disposition's favour: it was a flake on a docs-only `main` advance, not
a defect in `batch4-tender-documents.spec.ts`. No further re-run was issued and none is warranted
(§2 — never re-run hoping for green).

**DISPOSITION: ACTIONED** — the predecessor's open probe is discharged and needs no successor.
`#2042` is now green, unlabelled and waiting on Marco alone, which folds it into F3.

### F3 — All five open PRs are `marco:true`, two of them are fully green, and the board is parked (S2)

Re-taken live, not carried — the table and controls are in WHAT I MEASURED. **Armed prompts: 0.**
This is the throughput constraint stated exactly: every PR touching anything outside `tests/` or
`docs/` stops at the same place by design, RULE 2 forbids any station from clearing it, and the
board grows monotonically until Marco merges. **That is why I armed nothing even though the sweep
said SAFE TO ACT** — and why F1's single candidate would have been the wrong thing to arm anyway.

**DISPOSITION: ESCALATED** — Marco. The set has *changed* since the 16:08Z report rather than being
repeated, so it is worth re-reading:

- **`#2042` is now 15/15 green and unlabelled** (it was the one genuinely-not-ready PR an hour ago).
  It needs a merge and nothing else.
- **`#2049` is 15/15 green and unlabelled**, unchanged. Same.
- **`#2044`, `#2047`, `#2051`** are green apart from the two CP-26 reds their own `do-not-merge`
  label creates. **Removing the label is the entire remaining action** on each, and only you can
  take it.

**So all five are now waiting on a human action that takes seconds, and none is waiting on work.**
An hour ago that was four of five. I am not asking which to merge — that is yours — only reporting
that the agent-side queue on this board is empty.

### F4 — Both worktree findings are REAL, and my first reading of each was wrong until I measured it (S3)

The sweep flags two things under section 2. I set out to show both were instrument artefacts. **Both
survived, and one of my hypotheses was refuted outright.**

**(a) `C:/PR-Master/worktrees/po-vg` — the uncommitted file is genuinely divergent.** On
`fix/no-rebase-while-checks-run`, age **25,041 min (17.4 days)**, holding one untracked file,
`scripts/pipeline/check-pipeline-heartbeat.mjs`. That path **does** exist on `origin/main` and in
the dev tree, which invited *"it is a duplicate, safe to prune"*. `[MEASURED]` with the sound form
(§9.3 — content, never size, and no piped hash):

```
git hash-object <worktree copy>                                        -> 9c4587fb…
git rev-parse origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs -> 84ec92d4…
IDENTICAL = False
```

**The sweep's warning — *"HOLDS UNCOMMITTED WORK. PRESERVE OR COMMIT BEFORE PRUNING; `--force`
would discard it"* — is CORRECT.** `git worktree remove` will refuse and must be allowed to.

**(b) `C:\po-worktrees\po-fix-2005` — `size=0KB` is CORRECT, and is NOT the §9.1 wildcard trap.**
It holds three depth-1 entries (`apps`, `node_modules`, `packages`), which looked exactly like
§9.1's `"$dir\*" -Recurse -File` container trap — a directory with zero files at depth 1 reporting
zero. I checked the sweep's source rather than assuming: it uses the **bare** form
(`Get-ChildItem $subdir.FullName -Recurse -File`), which that trap does not touch. Run both forms
side by side:

| form | result |
|---|---|
| `FILES_AT_DEPTH1` | **0** |
| `"$dir\*" -Recurse -File` | 0 |
| bare `$dir -Recurse -File` | **0** |
| POSITIVE control (`scripts\pipeline`, 68 files at depth 1) | 68 / 91 / **91** — both forms agree, instrument sound |

**The directory is an empty skeleton**, age 5,856 min (4.1 days), `.lock=False`. My trap hypothesis
is **REFUTED** and the sweep's number is right.

**DISPOSITION: DISPATCHED → Station 03** (worktrees and local trees are its lane; `Repair the
machines` is ❌ for 00 and ⚠️ report-only for 03, so this is a report for it to act on, not an
instruction to me). Two items, opposite handling, both measured above:

- **`po-fix-2005` — prune it.** Zero files at any depth, no lock, 4 days old. Nothing is at risk.
- **`po-vg` — do NOT `--force`.** Preserve `check-pipeline-heartbeat.mjs` first; the blob differs
  from `origin/main` and this is its only copy. 17 days is long enough that Marco may simply not
  want it, but that is a question, not a `--force`.

### F5 — `check-breadcrumb.mjs` still reads 00's cadence as 2h against a live HOURLY cron (S3)

`[MEASURED]` at `87e22199`, anchor `const CADENCE =`:
`{ '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }`, against the scheduled-tasks MCP's
`00-supervisor  cronExpression: "5 * * * *"` — **hourly**. `03` (24), `04` (4) and `05` (24) all
match their live crons; **00 is the only wrong row**, and it is wrong in escalation #23's exact
direction: `--freshness` will not call 00 SILENT until **4 h**, i.e. only after **three**
consecutive missed hourly runs. This run's `ok` for 00 is therefore a weaker statement than the same
word about any other station — which is why the `lastRunAt` cross in WHAT I MEASURED is not
optional.

**DISPOSITION: DEFERRED.** The fix is one character (`'00': 1`) and it is a `scripts/` change, so a
PR carrying it is outside `tests|docs` and becomes a **sixth** PR on a board where five already wait
only on Marco — motion, not progress. It is already filed, and
`needs-marco/instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md` names this whole
class. **What would make it urgent:** a missed 00 occurrence that `--freshness` reports `ok`. The
`lastRunAt` cross is the compensating control and it ran clean this cycle.

### F6 — The four carried escalations, each re-measured or explicitly not (S2/S3)

Listed rather than re-argued, so the open set is visible in one place:

| carried finding | state this run |
|---|---|
| `.gitignore:107-111` stale in all four enabled bootstraps, 15 days on (`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`, ITEM 1 + the ITEM 2 regex amendment) | unchanged — the bootstrap that opened THIS run still carries it |
| `sot/02` §2 cannot be kept true by a daily station; needs a generator + CI check (`scripts/`) | unchanged — escalated at 16:08Z with options A/B/C, no movement |
| Station 00 blindness, intermittent, cause unknown | **no new instance** — this run was sighted on the first call |
| The fv2 AI-import / digests / output-channels cluster, unanswered since 2026-09-15 | unchanged — `pr-fv2-ai-digests-HOLD` and `pr-fv2-output-channels-HOLD` both still `[FILE_GATE_NOT_RELEASED]` this run, so the gate file is still absent |

**DISPOSITION: ESCALATED** — Marco, all four carried without change. Each has its own `needs-marco/`
file and its options already written out; nothing here supersedes them.

## WHAT I DID NOT DO

- **Merged nothing.** All five open PRs carry a live, re-taken, cross-checked watcher `marco:true`
  verdict, and RULE 2 binds *"not overridden by green, unlabelled, or a verified diff"*. `#2042` and
  `#2049` are both 15/15 green and unlabelled and I still did not merge them, because green is not
  the gate.
- **Armed nothing.** Three of the four ADMITs are confirmed duplicates of an open PR on their own
  marker; the fourth is F1 and is now correctly gated. Armed count in = 0, out = 0.
- **Removed no label.** Only Marco does that — it is the entire remaining action on three PRs.
- **Touched no `sot/` file.** That is 05's lane and CP-24 enforces it; F1 exists precisely to keep
  it that way.
- **Pruned no worktree and killed no process.** Both worktree items are 03's (F4), and the
  `po-vg` one holds work that `--force` would destroy.
- **Restarted nothing.** The sanctioned verdict is `OK`, the wrapper is alive (1), and §3b's
  `wrapper=0` question never arose.
- **Did not re-run #2042's e2e a second time.** It came back green; re-running a green check to
  see it again is the failure §2 names.
- **Left Azure / Entra / SharePoint entirely alone**, as always — absolute.
- **Did not chase sweep section 5.** Its live rows are all `cites #N (MERGED) as evidence — not its
  premise`, which by its own wording does not clear an escalation; there were zero genuine `[STALE]`
  rows to discharge.

---

## ADDENDUM 2026-09-21T17:3xZ — same run, later measurement

### F7 — 00's OWN board worktree trips the CAUTION that 00's OWN merge gate reads, on every run that opens a board PR (S2)

`BOARD_WORKTREE_BLOCKS_ITS_OWN_MERGE_GATE_V1`

PREFLIGHT step 4 requires the sweep to be re-run **immediately before every board mutation**,
because *"the verdict expires the moment it prints"*. I did that before merging `#2055`, with the
gate written into the script so it could refuse without my opinion entering it. **It refused:**

```
--- VERDICT ROWS ---
  [LIVE] CAUTION: 1 LIVE STATION WORKTREE(s) detected (section 2):
SAFE_ROWS=0  STOP_ROWS=0
REFUSING TO MERGE: the re-measured verdict is not SAFE TO ACT.
```

🔴 **The live station worktree is MINE**, and section 2 names it outright:

```
[LIVE] non-main worktrees found: 2 -- classifying by liveness...
[LIVE]    LIVE STATION WORKTREE: C:/po-worktrees/s00-board-20260921-1714 da6099b2
          [docs/station-00-collect-20260921-1714]
[LIVE]       dirty=0 files  age=6 min  -- do NOT prune; a station is working here
```

`da6099b2` is this run's own commit, on this run's own branch, in the worktree this run created six
minutes earlier to satisfy **BOARD DRIVING condition 2** (*"clean isolated worktree only"*). The
first sweep, taken at `17:14:47Z` **before** the worktree existed, read `SAFE TO ACT`. The second,
at `17:30:35Z`, reads CAUTION **because of the worktree the first one authorised me to create.**

🔴 **This is a loop, not a one-off, and it fires on every run that opens a board PR.** The sequence
is forced by the instructions themselves: condition 2 requires an isolated worktree to produce the
PR; PREFLIGHT step 4 requires a fresh sweep before merging it; and the fresh sweep classifies that
worktree as a live station at work. **A run that obeys both rules in order cannot reach its own
merge on a clean verdict.** The two preceding collect runs merged their board PRs without meeting
this, which is itself informative — the re-measure appears to have been skipped or taken before the
worktree was made.

🔴 **And the failure direction is the safe-looking one, which is why it can persist unnoticed.** A
run that reads CAUTION and stops leaves its own breadcrumb unmerged — the report reaches nobody, the
untracked copy stays in the dev tree, and the NEXT run meets the fast-forward blocker the station
doc says has already cost four consecutive runs. A run that reasons past it (*"that one is mine"*)
merges correctly but has just taught itself to argue with a safety verdict, which is precisely how
LL-38 happened.

⚠️ **The sweep is not wrong.** Its own wording is *"A station may be mid-run"* — `may`, and it has
no way to know the worktree is the caller's. BOARD DRIVING condition 3 says *"first confirm nothing
**else** is mid-mutation"*, and `else` is the whole distinction the instrument cannot draw.

**DISPOSITION: ACTIONED this run, by removing the ambiguity rather than reasoning past it.** My
work was committed and pushed and the worktree read `dirty=0`, so it had no further purpose: I tore
it down, re-ran the gate, and merged only on a clean `SAFE TO ACT`. Read-backs are in WHAT CHANGED.
**That is the correct general procedure and it is written here so the next run does not re-derive
it: finish in the worktree, push, tear the worktree down, THEN re-measure and merge.** It costs one
extra sweep and it keeps the safety verdict something a station obeys rather than something a
station explains.

**DISPATCHED → Station 04.** The durable half is an instrument question I should not answer by
editing `status-sweep.ps1` myself — that is a `scripts/` change, outside my lane to merge, and the
board already carries five PRs waiting only on Marco. **The question for 04 to measure:** can
section 2's liveness classifier exclude the *calling* run's own worktree — by PID ownership, by the
branch matching the caller's, or by an explicit `-ExcludeWorktree <path>` parameter the caller
passes? ⚠️ **Falsifying probe: create a worktree off `origin/main`, run the sweep, and read
section 7.** If it returns `SAFE TO ACT` with a live non-main worktree present, this finding is
wrong and must be re-measured.
