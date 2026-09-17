# Station 04 — Scanner | 2026-09-15T10:10:55Z–2026-09-15T10:42:00Z

## GROUND

```
UTC            2026-09-15T10:10:55Z
origin/main    4b271100            (fetched first, then rev-parse)
dev tree       main @ 4b271100      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                    (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE. Run proceeded at full authority (read-only on the board, as 04 always is).

Sweep this run: **gate-liveness** (rotation position 1 of 4), from `node scripts/pipeline/next-sweep.mjs`.

## WHAT I MEASURED

**Reachability.** `[MEASURED]` Desktop Commander tool ids were loaded via keyword `ToolSearch` for
`desktop-commander` before any call (the ids are environment-specific; a literal `select:` list would
have failed). `start_process` shell `powershell.exe` → `PROBE-ALIVE`, `2026-09-15T10:10:55Z`, PS
`5.1.26100.9444`. **Not a blind run.**

**Freshness of my own instructions.** `[MEASURED]`
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/04-scanner.md`
→ **EMPTY**, in the dev tree `C:\ProjectOperations2`, after
`git fetch origin +refs/heads/main:refs/remotes/origin/main`. Per the station contract's own
prescription, empty `--numstat` is the real answer — no piped `hash-object` was used or compared.
So the working copies I read ARE `origin/main`'s blobs at `4b271100`.

**Board.** `[MEASURED]` `gh pr list --state open --json number,title,isDraft,labels` (raw JSON,
`ConvertFrom-Json` — no `-q` passed to `gh`, per DOCTRINE §7 guard 8, which bit once this run and is
recorded under F5's note):

```
#1969 draft=False labels=dependencies,javascript :: build(deps): Bump sharp 0.35.3 -> 0.35.4
#1967 draft=False labels=do-not-merge            :: feat(tendering): scopecards S1 - operational costs become money (SCOPE_OPERATIONAL_COSTS_PRICED_V1)
#1960 draft=False labels=                        :: feat(rates): S2 - column settings, move and delete from the grid header (handleUpdateColumn)
```

**THE BOARD TRAP.** `[MEASURED]` `git ls-files docs/pr-prompts/*-ready.md` — every tracked match sits
under `processed/` or `superseded/`; **zero tracked `*-ready.md` at depth 1**. On disk,
`Get-ChildItem docs\pr-prompts -Filter '*-ready.md' -File` → **empty**. The board is unarmed and the
trap is clean.

**Gate liveness — the sweep.** `[MEASURED]` `scripts\pipeline\triage-holds.ps1` (read-only,
`--dequeue` never passed), full output retained at `%TEMP%\triage-holds-20260915.txt`, 130 lines.
Its own two controls passed first: GIT control PASS (read `origin/main:docs/pipeline/DOCTRINE.md`,
201130 chars, so gate probes can run) and SPENT control PASS (`lint-prompt.mjs` exit 3 on the
fixture, so the SPENT bucket is measurable — a bucket never seen to fill is not a bucket).

```
TOTALS  spent=2 of 37 evaluated  gates-satisfied=4  still-gated=31  unreadable=0
        (HOLD=37, ready=0, LOOPING=0)
        31 REJECTs re-probed directly: 0 spent behind a REJECT, 31 still needed, 0 UNMEASURABLE.
```

**File gates, probed individually.** `[MEASURED]` `git cat-file -e origin/main:<path>` for each of the
four `requires_file_on_main` targets — **all four exit 128 (absent from main)**:

| prompt | gate file | on main? |
|---|---|---|
| `pr-fv2-ai-digests-HOLD.md` | `apps/api/src/modules/forms/ai-form-import.service.ts` | **no** |
| `pr-fv2-output-channels-HOLD.md` | `apps/api/src/modules/forms/form-digests.service.ts` | **no** |
| `pr-rates-s11c-drop-legacy-tables-HOLD.md` | `docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md` | **no** |
| `pr-tenant-mt4-s2-ownership-migration-HOLD.md` | `docs/approvals/tenant-mt4-s2-ownership-migration-approved-by-marco.md` | **no** |

`[MEASURED]` `git ls-files docs/approvals/` → `README.md`, `watcher-identity-approved-by-marco.md`.
The last two rows are the Marco-approval class the sweep brief names explicitly. **Repaired nothing
there** — see WHAT I DID NOT DO.

`[MEASURED]` `git ls-tree -r --name-only origin/main apps/api/src/modules/forms` filtered for
`ai-`/`digest` → `ai-form-describe.service.ts`, `ai-form-fill-assist.service.ts`,
`ai-rule-draft.service.ts`. The sibling AI services shipped; the two gate files did not.

`[MEASURED]` `git log --oneline -1 -- docs/pr-prompts/superseded/pr-fv2-ai-import-HOLD.md` →
`017ca0a2 docs(pr-prompts): stage the fv2-import cluster, retire the stale ai-import prompt, classify two artifacts (#1879)`.

**Duplicate confirmations.** `[MEASURED]` `gh pr view 1967 --json title,body` — title and body carry
`SCOPE_OPERATIONAL_COSTS_PRICED_V1` and **only** that marker; no `DRAFTPANEL_S3_V1`, no transport
marker. `gh pr view 1960 --json title,body` — title `feat(rates): S2 - column settings, move and
delete from the grid header (handleUpdateColumn)`, body carries **no** `RATESCOL_S*_V1` marker.

**Instrument note, §9.4, and it fired repeatedly.** `[MEASURED]` `interact_with_process` returned
`timed out after 180s` on five separate calls against shell PID 18344. Every time,
`read_process_output` on the same PID returned the **complete** buffer with every marker present —
`M1`…`M6` — and the shell answered the next command normally. Nothing terminated and nothing was
unrun. The marker-after-every-statement guard (§9.4 guard 1) is what made that decidable; without it
a late reader and an unrun statement are byte-identical.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced via
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-15T10:38:29Z`.
  **Read back** `[MEASURED]`: `git diff` shows `last_index` `3` → `0` and `last_run_utc`
  `2026-09-15T02:10:31Z` → `2026-09-15T10:38:29Z`; a fresh `node scripts/pipeline/next-sweep.mjs`
  now names **`instrument-honesty` (position 2 of 4)**. **LEFT DIRTY IN THE DEV TREE — Station 00
  must commit it**, because 04 may not (authority matrix: *Create a PR: NO*, *Mutate the board: NO*),
  and the dev tree is on `main`.
  ⚠️ The `--advance` invocation prints the **pre-advance** banner (`gate-liveness`, `position 1 of 4`)
  and, when its stdout is truncated by a `| Select-Object -First N`, leaves `$LASTEXITCODE = -1`.
  Both are cosmetic: the diff and the follow-up plain run (exit 0) are the evidence the advance landed.
- This breadcrumb, at `docs/pr-prompts/00-04-scanner-2026-09-15-1010-...md` — **untracked** until a
  board PR commits it. Station 00 sweeps it up.
- **Nothing else.** No prompt armed, disarmed, renamed, moved, staged or deleted. No gate repaired.
  No label touched. No merge. No push. No write to any `sot/` path.

## FINDINGS

### F1 — A file gate outlived the prompt that was retired for being stale, and it parks a chain of two

`pr-fv2-ai-digests-HOLD.md` declares `requires_file_on_main:
apps/api/src/modules/forms/ai-form-import.service.ts`. That file is **absent from `origin/main`**
(`git cat-file -e` exit 128), and the only prompt that would ever have written it,
`pr-fv2-ai-import-HOLD.md`, was moved to `superseded/` by commit `017ca0a2` whose own message says
*"retire the stale ai-import prompt"*. **Nothing on the board can now release this gate: it is dead
by construction, not waiting.**

The cost compounds one link down. `pr-fv2-output-channels-HOLD.md` declares
`requires_file_on_main: apps/api/src/modules/forms/form-digests.service.ts` — the file
`pr-fv2-ai-digests` would produce. So the dead gate MASKS the premise behind it, exactly as the
sweep brief warns: two prompts are parked permanently and `triage-holds` reports both as
*"correctly on hold"*, which is a statement about gates only and says nothing about whether the work
is outstanding.

**Why I repaired nothing.** Re-pointing the gate needs a target, and the evidence points two
incompatible ways: the sibling AI services (`ai-form-describe`, `ai-form-fill-assist`,
`ai-rule-draft`) DID ship, so the import work may have landed under a different filename and the
gate merely names the wrong path — or the cluster was deliberately dropped when `#1879` retired its
head. Which of those is true is Marco's intent, and DOCTRINE §5.5 says never guess it. Guessing
wrong in the permissive direction arms two unbuilt prompts against a chain that no longer exists.

**RULE 1 options, complete-and-additive first:**

1. **Re-point both gates at the symbols that actually shipped, and re-run the premises.** Solves it
   immediately and permanently, damages no data, and the re-run tells us whether the work is
   outstanding or spent. *Requires Marco to confirm the fv2 AI-import/digests cluster is still
   wanted.*
2. **Retire both prompts to `superseded/` alongside their producer.** Complete and additive if the
   cluster was intentionally dropped — but fails the "immediately and future" half if it was not,
   because it silently discards wanted work, which is the failure mode DOCTRINE §5b records from
   2026-07-20.
3. **Leave as-is.** Fails both halves: the prompts stay invisible-but-live forever and every future
   `gate-liveness` sweep re-discovers them.

**DISPOSITION: ESCALATED** — Marco: is the fv2 AI-import / digests / output-channels cluster still
wanted? Option 1 if yes, option 2 if no. No agent should pick.

### F2 — Two SPENT holds are still tracked on main

`triage-holds` bucket *SPENT — premise already satisfied, the work has SHIPPED (lint exit 3)*:

- `pr-crmvis-s1-accounts-list-HOLD.md` — STALE
- `pr-ratescol-s2-header-menu-edit-HOLD.md` — STALE

`pr-ratescol-s2`'s shipped work is visible as open PR **#1960** (*"S2 - column settings, move and
delete from the grid header"*), which is why its premise now reads false. Both should be retired to
`docs/pr-prompts/superseded/` in a board PR. They are HOLDs, so no watcher glob matches them today —
the exposure is a future promotion re-running finished work.

**DISPOSITION: DISPATCHED** — Station 00: retire both to `superseded/` in the next board PR. 04 is
read-only and moves no prompt.

### F3 — A consumed HOLD is still tracked on main while its work is live in an open PR

`docs/pr-prompts/pr-scopecards-s1-operational-costs-priced-HOLD.md` is **tracked on `origin/main`**
(`git cat-file -e` exit 0) and **deleted in the dev tree working copy** (`git status --porcelain`
→ ` D`, an unstaged deletion nobody has committed). Its work is open PR **#1967**, whose title and
body both carry this prompt's marker `SCOPE_OPERATIONAL_COSTS_PRICED_V1`.

This is the recurring shape the archive already records twice — *"four arms since 0320z left their
hold tracked on main"* (04, 2026-09-14) and *"two consumed holds stayed armable on main"* (00,
2026-09-03). The arm consumes the file on disk; the removal is never committed; `main` still carries
it; any checkout brings it back. It is a HOLD rather than a `-ready.md`, so the immediate blast
radius is bounded — but the deletion sitting uncommitted in a shared tree is also how it silently
reverts.

**DISPOSITION: DISPATCHED** — Station 00: commit the deletion (or retire the file to `superseded/`)
in the same board PR as F2. Worth noting the pattern has now recurred three times and the cure is
still per-incident, not systemic.

### F4 — All three POSSIBLE-DUPLICATE flags are false positives, confirmed on markers

`triage-holds` flagged three of its four gate-satisfied candidates as possible duplicates of an open
PR. Its own instruction is to confirm on the MARKER, never the head branch. I did:

| prompt | flagged against | verdict |
|---|---|---|
| `pr-draftpanel-s3-carry-over-and-picker-HOLD.md` | #1967 (3 of 12 scope entries) | **NOT a duplicate** — #1967 carries only `SCOPE_OPERATIONAL_COSTS_PRICED_V1`; no `DRAFTPANEL_S3_V1` anywhere in title or body. The 3 matched entries are `schema.prisma`, `prisma/migrations/**`, `docs/data-model/**` — the three entries almost every migration-touching prompt lists. |
| `pr-transport-capacity-column-order-HOLD.md` | #1967 (1 of 2) | **NOT a duplicate** — the single matched entry is `apps/api/prisma/migrations/**`. Over a one-entry scope the test's precision is zero by construction, as the tool itself states. |
| `pr-ratescol-s3-add-in-grid-HOLD.md` | #1960 (4 of 5) | **NOT a duplicate** — #1960 is `pr-ratescol-**s2**`'s PR (`handleUpdateColumn`), which is why s2 lands in the SPENT bucket. s3's premise is `! grep -q "structureAdding" .../FilterableRateGrid.tsx` plus a new `EmptyTableFirstStep.tsx`; #1960 touches neither symbol. The 4 overlapping paths are the same four files any rates-grid slice edits. |

So the gate-satisfied candidate list for Station 00 is **four clean candidates**, not one clean and
three suspect: `pr-crmvis-s2-relationships`, `pr-draftpanel-s3-carry-over-and-picker`,
`pr-ratescol-s3-add-in-grid`, `pr-transport-capacity-column-order`. ADMIT remains necessary and not
sufficient — each still needs its body read for a prose human gate before anyone arms it, and
`pr-ratescol-s3` declares `escalates: true` and `size: 5`.

**DISPOSITION: DISPATCHED** — Station 00: the three duplicate annotations are cleared; arm decisions
are yours and Marco's, one at a time.

### F5 — `triage-holds`' "confirm on the MARKER" instruction is unexecutable for a prompt that declares no marker

For `pr-ratescol-s3-add-in-grid-HOLD.md` the tool prints *"read this prompt's own marker string and
look for it in #1960's TITLE or BODY"*. `[MEASURED]` `git show origin/main:<that file> | Select-String '_V1'`
→ **zero matches**: the prompt declares no `_V1` marker at all. Its identity lives only in its
`premise` grep (`structureAdding`). A reader who follows the instruction literally finds nothing to
search for, and the honest available readings are *"no marker found, therefore not a duplicate"* and
*"I could not perform this check"* — which are different, and only the second is true.

I resolved this one on the premise symbols instead (F4), so nothing was blocked. The gap is in the
instruction, not the board: it assumes every prompt carries a marker, and not all do.

**DISPOSITION: DEFERRED** — real, not urgent. It becomes urgent the first time a markerless prompt
genuinely IS a duplicate and the check is read as clearing it. The fix is a one-line branch in
`triage-holds.ps1`: when the prompt declares no marker, say so and name the premise symbols as the
fallback discriminator, rather than printing an instruction that cannot be carried out.

### F6 — The Linux VM mount is down, so the device-bridge git guard could not be installed

`[MEASURED]` The first `bash` call of this run failed:
`failed to mount ... under Plan9 share "c" which is not mounted`, with the host's own note that *"A
Windows update released September 8 prevents Claude's workspace from reaching your files."* The
station preflight requires `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` at
the top of the run and the quoting of its last line **pass or fail** — so, quoting the failure
verbatim in place of an installer line: **the guard was not installed, because the VM cannot see the
repo at all.**

Per the station contract this is a **FINDING, not a STOP**, and the run continued — correctly, since
widening the stop contract to cover a missing shell script is how a frozen board gets manufactured.
The risk the guard exists to prevent (a cut-short VM-side `git` leaving a 0-byte `index.lock` with no
owning Windows process) is **structurally absent this run**: with no mount there is no VM-side path
to the repo's `.git` at all. Every command in this run went through Desktop Commander on the Windows
host.

**DISPOSITION: DEFERRED** — nothing to fix in this repo; the cause is outside it. It becomes a
finding for Marco only if it persists across many runs, because a permanently blind VM changes which
probes stations can offer at all. Worth Station 00 noting how many consecutive runs report it.

## WHAT I DID NOT DO

- **Repaired no dead gate, including the one in F1.** The sweep brief is explicit that repairing a
  dead gate can silently remove the only protection on a prompt, and that a destructive prompt gets
  reported and never repaired. F1 is not destructive but it IS an intent question, which is the other
  half of the same rule.
- **Touched neither Marco-approval gate.** `pr-rates-s11c-drop-legacy-tables-HOLD.md` **drops
  database tables** and `pr-tenant-mt4-s2-ownership-migration-HOLD.md` is an ownership migration;
  both are `escalates: true` and both are gated solely on an approval file that does not exist in
  `docs/approvals/`. **That is the gate working, not a defect** — repairing it would have removed the
  protection on exactly the class `docs/approvals/README.md` records. Reported, repaired nothing.
- **Armed nothing, and staged no prompt.** The board is unarmed (ready=0) and 04 arms nothing; I had
  no fix-prompt worth the staging budget this run, and the one finding that could justify a prompt
  (F1) is an escalation, not a buildable change.
- **Did not commit `sweep-rotation.json`.** 04 may not create a PR or mutate the board, and the dev
  tree is on `main`. It is named in WHAT CHANGED for Station 00.
- **No Part 2 live-site pass, and no Part 0 static audit.** The station takes ONE named sweep per run
  and covers it completely; `next-sweep.mjs` named `gate-liveness` and the HOLD corpus is 37 prompts.
  A shallow pass over everything else is what the rotation exists to prevent.
- **Did not re-enumerate the 31 correctly-gated holds** beyond their reject reasons, and did not
  touch anything 05-owned.
- **No `git` through the device bridge, no worktree minted, no `git checkout .` / `reset` / `stash` /
  `clean` in `C:\ProjectOperations2`.** The dev tree carried 31 dirty entries when I arrived; I left
  all of them alone except the one file I was instructed to advance.
