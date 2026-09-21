# Station 04 — Scanner | 2026-09-21T10:10:09Z–2026-09-21T10:24Z

## GROUND

```
UTC            2026-09-21T10:10:09Z
origin/main    1ea3eb7a            (fetched, then rev-parse)
dev tree       main @ 76ed975a     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`). Full authority this run; no read-only downgrade.

Sweep this run: **gate-liveness** — `node scripts/pipeline/next-sweep.mjs` → `SWEEP: gate-liveness`,
rotation position 1 of 4, previous run `2026-09-21T06:11:39Z`.

## WHAT I MEASURED

**Reachability.** `[MEASURED]` Desktop Commander `start_process`, shell `powershell.exe`, returned
`2026-09-21 20:09` (Brisbane) and `True` for `Test-Path docs\pipeline\stations\04-scanner.md`. **Not
blind.** Stated loudly because two Station 00 breadcrumbs dated *this morning* record the opposite
(finding F3).

**VM git guard.** `[MEASURED]` `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
last line quoted verbatim per the contract:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
(preceded by `vm-git-guard installed at /sessions/sharp-gifted-bell/.local/bin/git - refuses mounted
paths and mounted cwd, allows everything else (three controls passed)`). Exit 0. **Install PASSED.**

**Binding-document freshness.** `[MEASURED]` Per the preflight, using `git diff --numstat origin/main -- <path>`
(never the piped-hash form, which §9.1 records as unsound in `powershell.exe`), run in the DEV TREE
after `git fetch origin`:

| path | `git diff --numstat origin/main` | reading |
|---|---|---|
| `docs/pipeline/stations/04-scanner.md` | EMPTY | not different |
| `docs/pipeline/DOCTRINE.md` | EMPTY | not different |
| `docs/pipeline/STATION-CAPABILITIES.md` | EMPTY | not different |

All three working copies are byte-identical to `origin/main`, so reading them from disk this run was
safe. `[INFERRED]` The dev tree's HEAD (`76ed975a`) is behind `origin/main` (`1ea3eb7a`), so this is a
property of these three paths, not of the tree.

**§9.1 nested-`-Command` expansion reproduced, first try.** `[MEASURED]` A heading-extraction call
issued as `powershell.exe -NoProfile -Command "... | ForEach-Object { \"$($_.LineNumber): ...\" }"`
through `start_process` died with `The string is missing the terminator: ".` — `ParserError`,
`TerminatorExpectedAtEndOfString`. That is the NESTED form, and it is the exact signature §9.1's
2026-09-14 correction predicts. The same work, sent as direct statements to the `powershell.exe`
shell, ran clean all run. **No change to §9.1 is warranted — this is the bullet working.** Recorded
because §9.1 asks for the transport to be stamped whenever the trap is met: Desktop Commander
`start_process`, host PS 5.1, nested form.

**Board trap (tracked `*-ready.md` at depth 1).** `[MEASURED]`
`git ls-tree -r --name-only origin/main -- docs/pr-prompts` filtered to `(-ready\.md|-HOLD\.md)$`:
**zero** `*-ready.md` tracked at depth 1; 22 `*-HOLD.md` tracked at depth 1. Positive control is
built into the same output — the filter DID return `-ready.md` files under `superseded/` (many) and
one under `processed/` — so the zero is a real absence, not a broken pattern. **No board trap.**

**Arming state, read from the dev tree** (the only thing this station reads there). `[MEASURED]`
`Get-ChildItem docs\pr-prompts -File` at depth 1 returned the 22 HOLDs plus **`rev-2040-ready.md`**
and **`rev-2042-ready.md`**, neither of which is tracked on `origin/main`. `git status --porcelain --
docs/pr-prompts` shows them among the untracked/modified set. These are live review jobs matching the
two open PRs; expected, not a defect.

**HOLD triage — the gate-liveness instrument.** `[MEASURED]`
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\pipeline\triage-holds.ps1`,
`MARKER_TRIAGE_EXIT=0`. Its own two controls passed and are quoted from its output:
`GIT control: PASS -- git read origin/main:docs/pipeline/DOCTRINE.md (206579 chars)` and
`SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture`.

```
TOTALS  spent=1 of 22 evaluated  gates-satisfied=4  still-gated=17  unreadable=0
        0 spent behind a REJECT, 17 still needed, 0 UNMEASURABLE
        READ-ONLY: nothing was armed, renamed, moved or staged.
```

- SPENT (lint exit 3): `pr-crmvis-s6-bulk-link-HOLD.md`
- GATES SATISFIED (lint exit 0, candidates only): `pr-crmvis-s8-comms-threads`,
  `pr-lintstation-contract-version-compare`, `pr-permission-role-reconciler`, `pr-queue-layout-sot-entry`
- STILL GATED (exit 1): 17, of which 11 `HUMAN_GATE_PRESENT`, 4 `FILE_GATE_NOT_RELEASED`,
  2 `GATE_NOT_RELEASED`

**Gate-artifact liveness, probed directly against `origin/main` at `1ea3eb7a`.** `[MEASURED]`
`git cat-file -e 1ea3eb7a:<path>`:

| prompt | gate artifact | on main |
|---|---|---|
| `pr-fv2-ai-digests-HOLD.md` | `apps/api/src/modules/forms/ai-form-import.service.ts` | **ABSENT** |
| `pr-fv2-output-channels-HOLD.md` | `apps/api/src/modules/forms/form-digests.service.ts` | **ABSENT** |
| `pr-rates-s11c-drop-legacy-tables-HOLD.md` | `docs/approvals/rates-s11c-…-approved-by-marco.md` | **ABSENT** |
| `pr-tenant-mt4-s2-ownership-migration-HOLD.md` | `docs/approvals/tenant-mt4-s2-…-approved-by-marco.md` | **ABSENT** |
| `pr-scopecards-s5-…-HOLD.md` | `apps/web/src/pages/tendering/ClientQuotesPanel.tsx` | PRESENT (token absent) |
| `pr-scopecards-s6-…-HOLD.md` | `apps/api/src/modules/rates/charge-step-pricing.service.ts` | **ABSENT** |

Controls on that probe: POSITIVE `1ea3eb7a:docs/pipeline/DOCTRINE.md` → exit 0; NEGATIVE, a needle
minted this run and therefore now spent, `1ea3eb7a:zzQq04Needle20260921T1010.md` → exit 128. The
instrument discriminates.

**Token probes.** `[MEASURED]` `git grep -l '<token>' origin/main` (POSITIVE control
`NESTED_TEST_PATHS` → `scripts/pr-watcher/index.mjs`, exit 0):

- `QUOTE_PUSH_PANEL_V1` → 4 hits, **all of them prompts, breadcrumbs or merge-approval docs; ZERO in
  source.** Not in `ClientQuotesPanel.tsx`.
- `CHARGE_STEPS_PRICE_CUTTING_V1` → 3 hits, same shape, zero in source.

**Open board.** `[MEASURED]` `gh pr list --state open` → exactly two, both unlabelled:
**#2042** *"feat(client-quotes): scopecards S4b — push panel + diff + grouped Cost Summary
(QUOTE_PUSH_PANEL_V1)"* and **#2040** *"feat(web): SLICE 17 S2 - swap final AdminOnly route guard for
company.manage"*. `gh pr view` → **#1970 MERGED** 2026-09-15T11:23:18Z and **#1974 MERGED**
2026-09-15T23:17:13Z, both titled `docs(pr-prompts): stage scopecards S5 …` — i.e. both merged the
PROMPT, not the fix (DOCTRINE §2's #674 shape).

**History (angle 4).** `[MEASURED]` `git show origin/main:docs/pr-prompts/archive/00-04-scanner-2026-09-15-1010-a-file-gate-outlived-the-prompt-that-was-retired-for-being-stale.md`
contains the identical table rows for both fv2 prompts, names commit `017ca0a2` as the one that moved
`pr-fv2-ai-import-HOLD.md` to `superseded/`, and closes them
`DISPOSITION: ESCALATED` (Marco) and `DISPOSITION: DISPATCHED` (Station 00 — retire both).

## WHAT CHANGED

**Nothing on the board.** No prompt was armed, disarmed, renamed, moved, staged or deleted; no PR was
merged, labelled or touched; no tracked file was edited. `triage-holds.ps1` reports its own
read-only status in the output quoted above.

Two working-copy changes, both left DIRTY in the dev tree for Station 00 to commit, because 04 may not:

1. This breadcrumb, at `docs/pr-prompts/00-04-scanner-2026-09-21-1010-…md` (tracked path, untracked file).
2. `docs/pipeline/sweep-rotation.json`, advanced with
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-21T10:10:09Z`. **Station 00 must
   commit this file** — if it is not committed the next run repeats gate-liveness and the rotation
   silently stops.

## FINDINGS

### F1 — A dead file gate, ESCALATED and DISPATCHED six days ago, is still on the board unchanged. It masks a second prompt. (S2)

`pr-fv2-ai-digests-HOLD.md` declares `requires_file_on_main:
apps/api/src/modules/forms/ai-form-import.service.ts`. That file is ABSENT from `origin/main` at
`1ea3eb7a` (measured above). The only prompts that would ever have produced it —
`pr-fv2-ai-import-HOLD.md`, `pr-fv2-ai-describe-HOLD.md`, `pr-fv2-import-s1-docx-and-persona-HOLD.md`
— are **all three in `superseded/`**. No depth-1 prompt names that path except the gated prompt
itself. **The gate cannot release.**

It masks the prompt behind it: `pr-fv2-output-channels-HOLD.md` is gated on
`form-digests.service.ts`, which only `pr-fv2-ai-digests` produces. Both are parked permanently, and
`triage-holds` cannot see it — lint REJECTs both before reaching a premise, so they sit in
`still-gated=17` looking healthy.

**What is NEW is not the defect — it is that the channel did not close.** The 2026-09-15 Station 04
run measured this exact pair, ESCALATED the cluster question to Marco and DISPATCHED retirement to
Station 00. Six days and roughly 36 scheduled runs later, both prompts are still at depth 1, both
gates still dead, the escalation still unanswered.

I repaired nothing, which the sweep brief requires independently: for `pr-fv2-ai-digests` the dead
file gate is the **only** gate (`escalates: false`, no other `requires_*`), so repairing it would not
unblock a prompt — it would immediately release one whose cluster Marco has not confirmed is still
wanted. That is precisely the `docs/approvals/README.md` failure mode.

**DISPOSITION: ESCALATED** — Marco, one question, unchanged from 2026-09-15 and now six days old:
**is the fv2 AI-import / digests / output-channels cluster still wanted?**

- **(A) Retire all three to `superseded/` in a board PR** — complete and additive: it removes two
  permanently-parked prompts and the dead gate together, ends the masking, and destroys no work
  (nothing is deleted; `superseded/` is recoverable, and the prompts stay readable on main). Passes
  both halves of RULE 1. **Recommended.**
- **(B) Re-stage a replacement producer for `ai-form-import.service.ts`, then leave both gates as
  they are** — also complete, but only if the cluster is genuinely still wanted; it fails the
  *immediate* half of RULE 1, since the board carries two dead prompts until the producer ships.
- **(C) Repair the gate to point at something that exists** — fails the *future* half of RULE 1: it
  releases `pr-fv2-ai-digests` to arm on the strength of an edit nobody asked for, against a cluster
  whose status is the open question. Not recommended.

### F2 — The scopecards S5/S6 gates are ALIVE, and the 2026-09-17 finding that called them dead is superseded (S4, information)

The 2026-09-17 breadcrumb is titled *"four scopecards holds are gated on a pr that closed unmerged"*.
That is no longer true. **PR #2042 is OPEN right now and its title carries the very token
`QUOTE_PUSH_PANEL_V1` that `pr-scopecards-s5` is gated on.** The chain is intact and correctly
waiting: #2042 → s5 (`QUOTE_PUSH_PANEL_V1`) → s6 (`CHARGE_STEPS_PRICE_CUTTING_V1`).

Filed because a reader who finds the 09-17 breadcrumb and acts on it would retire two prompts whose
producer is on the board today. The token measurement that looks alarming in isolation — zero hits in
source for either token — is the *expected* reading for work that has not landed yet, and is only
distinguishable from a dead gate by checking the open board, which the 09-17 run could not have seen.

**DISPOSITION: DEFERRED** — real, not now. Nothing to fix while #2042 is open. It becomes F1's
problem the moment #2042 closes unmerged; re-run this probe then.

### F3 — Station 00 filed two blind-run breadcrumbs this morning, one 60 seconds before this run got a shell (S3)

`[MEASURED]` Untracked in the dev tree, from `git status --porcelain -- docs/pr-prompts`:

```
?? docs/pr-prompts/00-00-supervisor-2026-09-21-0710-blind-run-desktop-commander-connect-timeout-no-windows-shell.md
?? docs/pr-prompts/00-00-supervisor-2026-09-21-1009-blind-run-desktop-commander-connect-timeout-watcher-fired-twice-so-i-mutated-nothing.md
```

The second is stamped **10:09**; this run's first successful `start_process` was **10:10:09Z**. Same
machine, same Desktop Commander, sixty seconds apart — one blind, one not. This is
`STATION-CAPABILITIES.md` §2's *intermittent, cause unknown* with an unusually tight bracket on it,
and it is evidence the listing/task identity predicts nothing.

The operational cost is specific and falls on F1: **Station 00 is the only channel that closes a
finding**, and it has been degraded at least twice today. That is a live candidate explanation for
why a six-day-old DISPATCHED item has not moved — worth weighing before anyone concludes 00 is
ignoring breadcrumbs.

**DISPOSITION: DISPATCHED** — Station 00: both blind-run breadcrumbs, this breadcrumb, and the
advanced `sweep-rotation.json` are sitting UNTRACKED/DIRTY in the dev tree and need sweeping into a
board PR. 04 may not commit them. Also worth 00's attention: `docs/pr-prompts/.arming-log.txt` is
modified and four HOLD files show as deleted (`pr-company-manage-s2-retire-adminonly`,
`pr-crmvis-s7-comms-inbox`, `pr-scopecards-s4a-push-by-destination-api`,
`pr-scopecards-s4b-push-panel-ui`) against a HEAD that is behind `origin/main` — consistent with
normal watcher consumption, not flagged as a defect, but named so the sweep is not surprised by them.

### F4 — One SPENT prompt on the board (S3)

`pr-crmvis-s6-bulk-link-HOLD.md` — `lint-prompt.mjs` exit 3, the strongest sense of *already
satisfied*: the work has SHIPPED. It is finished work still occupying depth 1.

**DISPOSITION: DISPATCHED** — Station 00: retire to `docs/pr-prompts/superseded/` in a board PR. Do
not arm. 04 is read-only on the board and moved nothing.

## WHAT I DID NOT DO

- **Armed, staged or moved nothing.** 04 is read-only on the board; arming is 00's on Marco's
  authority. I staged no `-HOLD` prompt this run — none of the four findings is fixed by a new
  prompt, and F1's correct output is a question to Marco, not a prompt.
- **Repaired no gate**, including the two genuinely dead ones. Both destructive-class gates
  (`pr-rates-s11c-drop-legacy-tables`, which DROPS TABLES and is on the never-arm denylist, and
  `pr-tenant-mt4-s2-ownership-migration`, which writes PRODUCTION DATA) are gated on a
  `docs/approvals/…-approved-by-marco.md` file that is absent by design. Those are Marco's signature,
  functioning exactly as intended — reported, untouched, and explicitly NOT a dead gate to repair.
- **Did not commit `sweep-rotation.json` or this breadcrumb.** The authority matrix gives 04 *Create
  a PR: NO*; the dev tree is on `main`, which nobody commits to directly. Left dirty and named above.
- **Did not mint a worktree.** Read `origin/main` at the named SHA `1ea3eb7a` with `git show` /
  `git cat-file` / `git grep`, per the AUTHORITY section.
- **Did not run Part 0, Part 1 or the live-site visual pass.** The station doc mandates ONE named
  sweep per run, covered completely; `next-sweep.mjs` named gate-liveness and this run spent its
  budget there. The other sub-checks rotate.
- **Touched no Azure / Entra / SharePoint surface**, and wrote no production data.
- **Did not write to any gitignored sink.** No write to `docs/qa/qa-findings.md`,
  `docs/qa/qa-checklist.md`, `docs/qa/qa-test-data-registry.md`, `.qa-run.lock`, or `qa-run-*.md`.
  Every finding above lives only in this tracked-path breadcrumb.
