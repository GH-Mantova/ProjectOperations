# Station 00 — Supervisor | 2026-09-23T03:15:26Z–2026-09-23T03:40Z

## GROUND

```
UTC            2026-09-23T03:15:26Z
origin/main    4563cf8c              (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 4563cf8c       C:\ProjectOperations2
doc version    1                     (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE. This run was **sighted** — `start_process` shell `powershell.exe`
returned a live shell (PID 36560) and every probe below ran on the Windows host.

`git rev-list --left-right --count HEAD...origin/main` → `0	0`, and
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
was **EMPTY**, so the working copy of all three binding documents is byte-equal to `origin/main` and
reading them from the dev tree was sound this run (PREFLIGHT step 2).

## WHAT I MEASURED

**[MEASURED] The device-bridge git guard is INSTALLED BUT INERT — exit 2.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → `GUARD_EXIT=2`, last line
verbatim: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Its own controls: `bash -lc 'command -v git'` → the shim; `bash -c 'command -v git'` → `/usr/bin/git`.
This is the **expected** outcome for a station (PREFLIGHT's three-outcome table), not an anomaly. The
device-bridge git ban was REMEMBERED, not mechanical, for this run. No `git` was run through the
bridge against the Windows `.git`.

**[MEASURED] Sweep: SAFE TO ACT.** `status-sweep.ps1` captured with `*>` and decoded `utf16le` from
node (§9.3 — the capture really was UTF-16LE, `FF FE`, 366 lines). Section 0 controls both PASS.
Section 7: `[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live
station worktrees.` Section 3: `index.lock` False/False, scoped git processes 0, no PR touched in the
last 2 min.

**[MEASURED] Section 5 carried ZERO `[STALE]` escalation rows this run** — `SEC5_LINES=243
STALE_ROWS=0`. The eleven-row backlog that AUTHORITY names is clear; the 00:16Z run discharged the
last of it. `needs-marco/` holds 44 files and none of them is PR-tagged stale.

**[MEASURED] The board: 3 open PRs, all three parked on Marco, none of them work.**

| PR | merge | checks | labels | verdict token |
|---|---|---|---|---|
| `#2107` D-namespace S5 checker flip | BLOCKED | 13/15 green, 2 FAIL | `do-not-merge` | `[LABEL_PRESENT]` |
| `#2108` scopecards S7b cutting fold | BLOCKED | 13/15 green, 2 FAIL | `do-not-merge` | `[LABEL_PRESENT]` |
| `#2109` scopecards S8a travel time | BLOCKED | 13/15 green, 2 FAIL | `do-not-merge` | `[LABEL_PRESENT]` |

The two failures on each are the same pair every time — `Approval receipt (CP-26)` and
`PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)` — which DOCTRINE §9.4 records as **two reds
with one cause**. Read from column 3 of each CP-26 job log per §9.1 (split on the tab, search the LAST
column; grepping the whole line matches all 226 lines because the job name is column 1), the verdict
is identical on all three, quoted verbatim from `#2107` run `35811833098`:

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

**There is no agent-side action behind `[LABEL_PRESENT]`.** All three are green on every check an
agent can move.

**[MEASURED] Trunk is green.** `main CI on 4563cf8c: 4 success / 0 failed / 0 running`.

**[MEASURED] Watcher healthy and correctly idle.** `watcher node: RUNNING pid 9744`; auto-restart
wrapper alive (1); heartbeat 40 min old; `armed (*-ready.md): 0`. A stale heartbeat with an empty
queue is idle, **not** wedged — `restart-watcher-if-wedged.ps1` was not run with `-Fix` and nothing
was restarted.

**[MEASURED] Freshness CLEAN, and it agrees with `lastRunAt`.** `check-breadcrumb.mjs --freshness`
exit **0**, `structure: 5 checked, 0 malformed`. Crossed against `list_scheduled_tasks` per AUTHORITY's
table — every row is the healthy "both fresh and aligned" case:

| station | `lastRunAt` (MCP) | newest breadcrumb | reading |
|---|---|---|---|
| 00 | 2026-09-23T03:14:51Z (this run) | 02:48Z | fresh + aligned |
| 03 | 2026-09-22T23:28:57Z | 2026-09-22 23:29Z | fresh + aligned |
| 04 | 2026-09-23T02:29:58Z | 02:30Z | fresh + aligned |
| 05 | 2026-09-22T14:23:04Z | 2026-09-22 14:23Z | fresh + aligned |

00's live cron is `5 * * * *` (hourly) — read from the MCP, never from a pasted cadence.

**[MEASURED] Queue triage: 15 HOLD at depth 1, 0 armed, 0 LOOPING, 0 SPENT, exactly ONE ADMIT.**
`triage-holds.ps1` (read-only), both its controls PASS: GIT control read 215,487 chars of
`origin/main:DOCTRINE.md`, SPENT control emitted exit 3 on the fixture. 14 REJECT, 1 ADMIT —
`pr-scopecards-s9-transport-capacity-matrix-HOLD.md`, flagged **POSSIBLE DUPLICATE of open #2109
(5 of 8 scope entries)**.

**[MEASURED] It is NOT a duplicate — settled on the MARKER, per DOCTRINE §10.6.**

| probe | result |
|---|---|
| `TRANSPORT_CAPACITY_MATRIX_V1` in `#2109` title+body | **0** |
| POSITIVE control — marker-shaped tokens in `#2109` title+body | **1**, and it is `TRAVEL_TIME_PORT_V1` |
| NEGATIVE control — a freshly minted needle | **0** |
| corroboration — `#2109`'s 12 files | carry `travel-time.ts`, **not** `transport-capacity.ts` |

The marker instrument works (it returned a marker) and the marker it returned is a different slice's.
The 5-of-8 overlap is the shared-file class §10.6 already names — `schema.prisma`,
`prisma/migrations/**`, `scope-waste.service.ts`, `ScopeWasteTab.tsx`, `admin/**` — where precision is
low by construction.

**[MEASURED] But the prompt's only gate was already satisfied, so it would have kept reading ADMIT.**
Its front matter carried a single `requires_on_main:
'apps/web/src/pages/tendering/ScopeCuttingSheet.tsx :: CUTTING_ONE_SURFACE_V1'` — a gate on S7, which
is already on `main` (`git rev-parse --verify origin/main:<that path>` → `ef5efd5e`, exit 0). Its real
predecessor is `#2109`, and that gate was encoded nowhere:

| probe | result |
|---|---|
| `TRAVEL_TIME_PORT_V1` in `travel-time.ts` at `#2109` head `a5b33eae` | **2** |
| POSITIVE control — `export` in the same file | **7** |
| NEGATIVE control — freshly minted needle | **0** |
| `git rev-parse --verify origin/main:apps/api/src/modules/tendering/travel-time.ts` | **exit 128**, not on main |
| POSITIVE control — same probe on `ScopeCuttingSheet.tsx` | exit 0, `ef5efd5e` |

So the needle exists in the predecessor and does not exist on `main` — the gate can be written, and it
will release the moment `#2109` lands.

**[MEASURED] `requires_on_main` LIST entries must be UNQUOTED. A quoted list entry parses with its
quote characters INSIDE the path, and the resulting gate can never release.** `lint-prompt.mjs`
accepts a list or a scalar (`const LEGAL_DEP_KEYS`, and the `Array.isArray(fm.requires_on_main)`
branch). Writing the list with single-quoted entries — the form the original scalar used, and the
obvious thing to copy — produced this REJECT, quoted verbatim:

```
GATE_NOT_RELEASED: requires_on_main: "'apps/web/src/pages/tendering/ScopeCuttingSheet.tsx :: CUTTING_ONE_SURFACE_V1'"
— the file "'apps/web/src/pages/tendering/ScopeCuttingSheet.tsx" is not on origin/main yet
```

The leading `'` is part of the path. That file cannot exist, so the gate would never have released and
the prompt would have been **parked forever** — and the REJECT it produced looks exactly like a healthy
"waiting for its predecessor" REJECT, which is the reading that would have let it stand. It was caught
only because the read-back asserted *which* gate fired, not merely that the linter rejected. Re-written
unquoted, the same probe names the intended gate and the S7 entry passes silently:

```
GATE_NOT_RELEASED: requires_on_main: "apps/api/src/modules/tendering/travel-time.ts :: TRAVEL_TIME_PORT_V1"
— the file "apps/api/src/modules/tendering/travel-time.ts" is not on origin/main yet
```

Byte-delta asserted on both edits (§9.3): expected 81 / actual 81, then expected −4 / actual −4.

**[MEASURED] Three non-main worktrees, two of them this station's own leftovers.**
`C:/po-wt/s00-ci-edited-trigger` (branch `chore/ci-rerun-on-pr-edited`, shipped as `#2110`, MERGED
02:40Z) and `C:/po-wt/s00-collect-04` (branch `chore/collect-04-repo-hygiene`, shipped as `#2111`,
MERGED 02:47Z), both `dirty=0` — BOARD DRIVING condition 2 says tear a smoke/board worktree down
always, and two consecutive runs did not. `C:/po-wt/dns-s5` (detached `d6552de1`, 151 min, dirty=0)
belongs to the still-open `#2107`.

## WHAT CHANGED

1. **`docs/pr-prompts/pr-scopecards-s9-transport-capacity-matrix-HOLD.md`** — `requires_on_main`
   converted from a scalar to a two-entry **unquoted** list, adding
   `apps/api/src/modules/tendering/travel-time.ts :: TRAVEL_TIME_PORT_V1`. Nothing else in the file is
   touched (byte delta asserted, 8996 → 9073, exactly the inserted text). Read back with
   `lint-prompt.mjs`: **exit 1, `[GATE_NOT_RELEASED]` naming the travel-time gate** — the intended
   verdict, not the quoting artefact.
2. **Four dispositioned breadcrumbs `git mv`'d to `docs/pr-prompts/archive/`** — the 00 runs at 0016,
   0115 and 0215, and Station 04's 0230 repo-hygiene report, which the 02:48Z run collected and
   landed as `#2111`. The 0248 breadcrumb stays at the root as the current cycle. Archiving is safe
   for freshness: `check-breadcrumb.mjs` builds `trackedSet` from `git ls-tree -r` and matches by
   trailing path segment.
3. **Two stale worktrees removed** — `git worktree remove C:\po-wt\s00-ci-edited-trigger` and
   `...\s00-collect-04`, both exit 0, both measured `dirty=0` immediately before. Read back:
   `git worktree list` now returns three rows — the dev tree, `dns-s5`, and this run's own.
4. **The dev tree was left CLEAN.** The s9 edit was made in the dev tree first, then restored
   byte-exactly and this PR's copy re-made inside an isolated worktree off `origin/main`. The raw
   Buffer restore left `git update-index --refresh` at **exit 1** with `--porcelain` ` M` while
   `--numstat` read EMPTY — the documented trap. The discriminator was measured rather than assumed:
   blob **8861 B, CRLF=0, bare LF=135**; checkout **8996 B** = 8861 + 135, i.e. **blob LF / checkout
   CRLF**, so convert-on-write, not `--renormalize`. Result: disk 8996 B (expected 8996),
   `update-index --refresh` **exit 0**, and all four read-backs green —
   `HEAD...origin/main` `0	0`, `--numstat` EMPTY, `--cached` EMPTY, `--porcelain` (tracked) EMPTY.

Nothing was armed. Nothing was merged. No label was removed. `sot/` was not touched.

## FINDINGS

**F1 — Every open PR on the board is `[LABEL_PRESENT]`, so the board cannot move without Marco, and
the queue has nothing else to build.** Three PRs, 13 of 15 checks green on each, the only two reds
being the CP-26 pair that the `do-not-merge` label makes unavoidable. `armed = 0`, and after F2 the
queue has zero ADMITs. This is not a defect anywhere — it is the design working — but it does mean the
whole board is one action of Marco's away from moving: **removing the `do-not-merge` label on `#2107`,
`#2108` or `#2109` is what releases it.** `#2108` and `#2109` are the S7b→S8a→S9 chain, so releasing
`#2109` also un-gates the S9 prompt this run just gated.
**DISPOSITION: DEFERRED** — real, and not mine. It becomes urgent the moment a label is removed and a
PR needs driving to merge; until then there is no agent-side action behind the verdict token.

**F2 — The one armable prompt in the queue had no gate on its actual predecessor, and would have been
armed into a live conflict with an open migration-bearing PR.**
`pr-scopecards-s9-transport-capacity-matrix-HOLD.md` linted ADMIT while `#2109` — which it overlaps on
five scope entries including `schema.prisma` and `prisma/migrations/**`, and which is itself
Marco-gated and unmerged — sits open. Its only gate named S7, which landed days ago. The marker test
proves it is not a *duplicate* of `#2109`; it does not make it independent of it, and nothing in the
front matter said so, so this reasoning would have been re-derived by hand on every future run until
one of them armed it. `#2109` adds migration `20260923100000_scopecards_s8a_travel_time`; S9 adds its
own additive migration, and building S9 against a `main` that lacks S8a produces a sibling that
conflicts on `schema.prisma`, `scope-waste.service.ts` and `ScopeWasteTab.tsx`.
**DISPOSITION: ACTIONED** — the dependency is now encoded as
`requires_on_main: apps/api/src/modules/tendering/travel-time.ts :: TRAVEL_TIME_PORT_V1`, verified by
re-linting: exit 1, `[GATE_NOT_RELEASED]` naming that exact gate. The failure direction is safe — a
gate can only delay an arm, never cause a wrong one — and it releases mechanically when `#2109` merges,
so no future run has to re-derive it. The alternative, arming S9 now, fails RULE 1's *future* half: it
buys one busy watcher cycle and guarantees a conflict resolution against an unmerged sibling.

**F3 — A quoted `requires_on_main` LIST entry keeps its quote characters inside the path, producing a
gate that can never release — and the REJECT it produces is indistinguishable from a healthy one.**
Measured above, verbatim from `lint-prompt.mjs`. The scalar form IS quoted in every prompt that uses
it, so copying that quoting into a list is the natural move, and the resulting prompt is parked
permanently while reading exactly like a prompt correctly waiting on its predecessor. Only a read-back
that asserts *which* path the gate names can tell the two apart. This belongs in DOCTRINE §9.5 beside
the other lint-instrument bullets.
**DISPOSITION: DEFERRED** — the prompt itself is fixed and verified in this PR, so nothing is at risk
today. The DOCTRINE landing is deferred because §9.5 sits inside the hash-gated
`CANONICAL-BLOCK: instruments v2`, and changing it requires re-recording the block hash and shipping
all seven station docs in one PR — more than a collect run should carry. It becomes urgent the moment
a second prompt is written with a list-form `requires_on_main`; the falsifying probe is the pair of
REJECT lines quoted above, re-run against any prompt with a quoted list entry.

**F4 — Station 00 left two of its own worktrees standing after their PRs merged.**
`s00-ci-edited-trigger` (`#2110`, merged 02:40Z) and `s00-collect-04` (`#2111`, merged 02:47Z), both
clean, 51 and 33 minutes old, both reported by the sweep as *"orphaned worktree (aborted run
leftover)"* — which is the wrong diagnosis for them and would send someone hunting an aborted run.
BOARD DRIVING condition 2 is *"Tear it down always"*, and two consecutive runs did not.
**DISPOSITION: ACTIONED** — both removed after measuring `dirty=0`, read back with `git worktree list`
(three rows remain: the dev tree, `dns-s5`, and this run's). `C:/po-wt/dns-s5` was deliberately left
alone: it is detached at `d6552de1` and belongs to the still-open `#2107`.

**F5 — `vm-git-guard` reports INSTALLED BUT INERT (exit 2) in this shell.** Quoted in full under WHAT
I MEASURED. The shim is byte-correct and not on the `PATH` of a non-interactive non-login shell, so the
device-bridge git ban is remembered rather than mechanical — the state DOCTRINE §9.2 records as having
failed seven times.
**DISPOSITION: DEFERRED** — PREFLIGHT's own table calls exit 2 the expected station outcome and says to
quote it and carry on. It becomes urgent if a run ever needs `git` against a mounted folder; the
one-call form `PATH="<session>/.local/bin:$PATH" git <args>` is the available protection and was not
needed this run, because every git command ran on the Windows host.

## WHAT I DID NOT DO

- **Did not arm anything.** After F2 the queue holds 15 HOLDs and zero ADMITs, so there is nothing
  armable. `armed (*-ready.md)` was 0 before this run and is 0 after it.
- **Did not touch `#2107`, `#2108` or `#2109`.** All three are `[LABEL_PRESENT]`; only Marco removes a
  `do-not-merge` label, and a station that meets that token has finished.
- **Did not re-run any CI.** No red on this board is a failing test — the reds are the CP-26 pair, and
  re-running them changes nothing while the label stands.
- **Did not fast-forward the dev tree.** It is clean at `4563cf8c` = `origin/main`; the fast-forward
  belongs after this PR merges, and this PR's four `git mv`s plus the modified prompt will be the paths
  that block it. The raw-Buffer-then-EOL-branch cure measured above is what clears them.
- **Did not remove `C:/po-wt/dns-s5`.** Its PR `#2107` is open.
- **Did not land F3 in DOCTRINE §9.5** — canonical block, see the disposition.
- **Did not do 03/04/05's work.** The watcher is healthy and self-supervised, nothing is rotting that
  04's 02:30Z sweep did not already report and `#2111` did not already land, and `sot/` was not opened.

---

*Written by Station 00 (scheduled, sighted) at `4563cf8c`. Untracked in the dev tree until this PR
lands it.*
