# Station 00 — Supervisor | 2026-09-02T02:09Z–2026-09-02T02:3xZ

## GROUND

```
UTC            2026-09-02T02:09:09Z
origin/main    70da03eb            (fetched, then rev-parse)
dev tree       main @ 70da03eb      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only.
Desktop Commander answered on the first call: **this run was SIGHTED**, not blind.
Station docs in the dev tree are byte-identical to `origin/main`
(`git diff --stat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → empty), so the working-copy reads were safe.

## WHAT I MEASURED

**Board.** `status-sweep.ps1` 02:10:13Z. [MEASURED]
- OPEN PRs: **1** — `#1483` BLOCKED, CI **13 pass / 1 fail**, labels `[]`, head `f85f11cf`.
  The single red is **`tendering-e2e`** (`gh pr checks 1483`, run 33575755396, 13m38s).
- Trunk: `main CI on 70da03eb: 4 success / 0 failed / 0 running` — **green**.
- armed (`*-ready.md`): **0**. needs-marco: 8 · no-pr-opened: 107 · failed: 41 · blocked: 60.

**RULE 2 on `#1483`.** Its live watcher verdict is `marco:true`. Green does not clear it, the
CP-26 receipt does not clear it, and the empty label set does not clear it. **Not merged.** [MEASURED]

**A station is live RIGHT NOW.** [MEASURED]
`git worktree list` → `C:/po-1483-fix f85f11cf [fix1483]`, and its newest file mtime is
**2026-09-02T02:11:36Z — inside this run's window**. Branch `fix1483` is local only
(`git ls-remote --heads origin fix1483` → empty). Sweep verdict was **CAUTION** for exactly this
reason. Everything below was therefore done in an **isolated worktree on a NEW branch**, and
nothing was armed.

**COLLECT.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`,
`structure: 6 checked, 0 malformed`. Freshness: 00 2.0h · 03 3.1h · 04 4.0h · 05 12.0h — **no
station is SILENT**. **No breadcrumb has been filed since my predecessor's 00:08Z run**, so there
was nothing new to disposition; all five older ones were already dispositioned in `#1503`. [MEASURED]

**The identity prompt could not have been armed by anybody.** [MEASURED]
- `lint-prompt.mjs docs/pr-prompts/pr-watcher-identity-app-auth-HOLD.md` → exit 0,
  **`PROMOTE`**, `GATE_RELEASED requires_file_on_main: docs/approvals/watcher-identity-approved-by-marco.md`.
- But `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` returns **no match** for it
  (positive control: the same query returns **2** hits for `cardui-s2`, so the query works).
- `arm-prompt.ps1:193-196` — `git ls-files --error-unmatch` then `Write-Fail "HOLD file is not
  tracked by git"`. **An untracked HOLD is refused by the only sanctioned arming primitive.**
- So the prompt memory recorded as *"STAGED with its gate OPEN — Station 00 arms it"* was, for its
  whole life, **unarmable**. That is not a judgement call that was pending; it was a dead end.

**Tracking it is inert.** [MEASURED] The watcher globs `*-ready.md` only
(`index.mjs:4,33`); nothing in `scripts/pr-watcher/**` or `scripts/pipeline/**` promotes a
`-HOLD.md` automatically — `arm-prompt.ps1` is the only writer of that rename. Committing the
HOLD arms nothing.

**Who released that gate.** [INFERRED, and it cannot be measured — that is the point]
`#1502` was opened 23:47:15Z on branch **`GH-Mantova-patch-1`** and merged 23:48:31Z — a
**76-second** lifetime on the GitHub web UI's default patch-branch name, with one file and no
local branch trace. Every agent lane in this pipeline pushes a named branch (`docs/…`, `feat/…`,
`board/…`) via `gh pr create`. So this reads as **Marco editing in the browser**, consistent with
his ruleset edit ~00:06Z the same window. **I cannot prove it**, because the watcher, Station 00,
Station 06 and Marco all authenticate as `GH-Mantova` — which is the exact defect the prompt this
run just unblocked exists to remove.

**The "43 phantom refs" figure was a PRUNE ARTIFACT, and its residual is not phantom at all.**
[MEASURED] `git fetch origin --prune` deleted **38** stale remote-tracking refs this run. After it:
`git branch -r` (excluding `HEAD ->`) = **30**; `git ls-remote --heads origin` = **25**. The five
that differ are **not** stale branch cache — set-differenced by name they are
`origin/pr/1477`, `origin/pr/1478`, `origin/pr/1483`, `origin/pr/1487` (refs `gh pr checkout`
writes under its own refspec) and a stray **`origin/origin`**. `Compare-Object` in the other
direction is empty: no real branch lacks a tracking ref.

## WHAT CHANGED

1. **`git fetch origin --prune` in the dev tree** — 38 stale remote-tracking refs deleted.
   Read back: `git branch -r` 44→30 against a truth of 25.
2. **`pr-watcher-identity-app-auth-HOLD.md` is now TRACKED** (added in this PR). It is still a
   `-HOLD.md`, still unarmed, and now for the first time *armable* by `arm-prompt.ps1`.
3. **Five dispositioned breadcrumbs `git mv`'d to `docs/pr-prompts/archive/`** (staged `R100`).
   Safe for freshness: `check-breadcrumb.mjs` builds `trackedSet` with `git ls-tree -r` and matches
   by basename (DOCTRINE §9.5), so archiving cannot make a station read SILENT.
4. This breadcrumb.

Nothing was armed. No PR was merged. `#1483` was not touched.

## FINDINGS

**F1 — The staged root-cause fix for nine unattributable merges was untracked, and therefore
unarmable, for its entire life.** `lint-prompt.mjs` said `PROMOTE`/`GATE_RELEASED`, which reads as
"ready", while `arm-prompt.ps1:194` would have refused it. Two instruments, opposite answers, and
the optimistic one is the one that gets quoted into memory. The general defect: **`lint-prompt.mjs`
does not check tracking, so a PROMOTE verdict is not an armability verdict.**
**DISPOSITION: ACTIONED** — the file is committed in this PR and is now armable. The *instrument*
gap (lint should refuse an untracked prompt, or say it cannot arm) is DEFERRED to F5.

**F2 — `#1483` is red on `tendering-e2e` and a station is actively fixing it in `C:/po-1483-fix`.**
RULE 2 bars me from merging it regardless of outcome. Its local branch `fix1483` is not yet pushed.
**DISPOSITION: DEFERRED** — it becomes urgent if `fix1483` is still unpushed and `C:/po-1483-fix`
has stopped changing at the next cadence; that would mean an abandoned fix worktree, and the seven
HOLD prompts transitively behind `#1483` stay behind it.

**F3 — `C:/po-work/s2-e2e` has flipped from LIVE to ORPHANED.** Detached HEAD at `f85f11cf`,
`dirty=0`, age 118 min, and the sweep's liveness classifier now calls it
`orphaned worktree (aborted run leftover)` where earlier runs read it as a live station worktree.
Station 06 has handed over, and a *different* worktree (`C:/po-1483-fix`) now holds that same sha.
Also still open: **11 registry escapees** under `C:\po-worktrees` / `C:\po-wt`, two of them 0KB and
15–16 days old, and the stray **`origin/origin`** remote-tracking ref.
**DISPOSITION: DISPATCHED → Station 03 (machine-minder).** Prune `C:/po-work/s2-e2e` only after
re-confirming `dirty=0` and that no process holds it; triage the 11 escapees per Station 04's
option (A) (annotated `abandoned/<name>@<sha>` tag, push tags, then delete — never a bare delete);
and delete `origin/origin`. **Do not touch `C:/po-1483-fix`.**

**F4 — The "43 phantom refs / 176% overcount" line is retired and replaced by a measurement.**
`git branch -r` overcounts only until `--prune` runs; after it the residual is `gh pr checkout`
refs, which are legitimate. The DOCTRINE §9.2 bullet ("`git branch -r` reads the LOCAL cache …
ask the remote") is **still correct** and needs no edit; what needs retiring is the *state* figure
that was being carried in memory as though it were a standing fact.
**DISPOSITION: ACTIONED** — pruned, re-measured, and the residual is explained by name above.

**F5 — `lint-prompt.mjs` reports PROMOTE on a prompt no sanctioned tool can arm.** F1 is the first
measured instance. The complete-and-additive fix (RULE 1: fixes it now and forever, damages no
data) is for `lint-prompt.mjs` to run the same `git ls-files --error-unmatch` check
`arm-prompt.ps1:194` already runs and emit a distinct verdict — `UNTRACKED_CANNOT_ARM` — rather
than `PROMOTE`. It is additive, touches one file, and cannot mis-bin a prompt because it changes
no premise. The alternative (leave it, and rely on the arming step to fail loudly) fails the
"future" half of RULE 1: the failure surfaces only at arm time, after a run has already been
planned around a false PROMOTE.
**DISPOSITION: DEFERRED** — it is a `scripts/pipeline/**` change, so it routes to Marco and cannot
auto-merge; and the board is under CAUTION with a live station worktree. It should be staged as a
prompt at the next quiet cadence.

**F6 — Escalation #15's headline number is wrong and its file says so now.** The ruleset requires
**five** checks, not four: `Approval receipt (CP-26)` was promoted by Marco ~00:06Z. But the two
jobs whose failure *created* #15 were not promoted — `Pipeline — watcher + linter tests` is still
advisory, and that is the exact job that was `COMPLETED FAILURE` on `#1482` when it auto-merged and
took `main` red for 32 minutes. **The incident that created #15 would still happen today.**
**DISPOSITION: ESCALATED (amended, not re-raised)** — `needs-marco/ruleset-requires-four-checks-…`
amended in place with the corrected count and the narrowed ask. The sweep tags that file `[STALE]`
because its `#1482`/`#1485`/`#1488` references are merged; **the file is not stale, its citations
are.** Do not discharge it.

## WHAT I DID NOT DO

- **Did not arm anything.** Sweep verdict was CAUTION with a confirmed live station worktree
  writing files during my run; `bring-up-to-speed.ps1`'s checklist item 6 forbids arming on CAUTION,
  and RULE 4 is one-at-a-time regardless. `pr-watcher-identity-app-auth-HOLD.md` is now tracked and
  is the obvious next arm — but it is `escalates: true` and touches `scripts/pr-watcher/**`, so its
  PR will be labelled `do-not-merge` and left for Marco. That is correct, not a problem.
- **Did not touch `#1483`, `C:/po-1483-fix`, or the branch `fix1483`.** Another actor owns it.
- **Did not prune any worktree or escapee myself** — that is Station 03's lane (LL-38).
- **Did not commit the dev tree's four modified tracked files**
  (`docs/data-model/metadata-catalog.json`, `docs/pipeline/sweep-rotation.json`, and the two
  `pr-cardui-s*-HOLD.md`). They are another actor's working state in a shared index; I committed
  from a separate worktree with its own index instead.
- **Did not arm `pr-cardui-s2-wbs-table-shell-HOLD.md`** — arming it while `#1483` is open opens a
  second PR for work `#1483` already carries.
- **Did not edit DOCTRINE §9.2.** The bullet is correct as written; only the state figure attached
  to it in memory was wrong, and state does not belong in an instruction document.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**

## ADDENDUM — same run, 02:2x–02:4xZ: Station 04 filed MID-RUN and I collected it

At 02:09Z `check-breadcrumb.mjs --freshness` said `CLEAN` and no breadcrumb was newer than my
predecessor's 00:08Z run. **Station 04 then wrote
`00-04-scanner-2026-09-02-0210-instruction-drift-sweep.md` at 02:20Z, inside my own window** — the
second consecutive cadence in which 04 has filed mid-run. **A COLLECT taken at the top of the run is
not final; re-check the queue root before you close.** I would have shipped a run reporting "nothing
new to collect" while a seven-finding breadcrumb sat one directory away.

### 04's seven findings, dispositioned

**04-F1 — `SCRIPT-REGISTRY.md` names a launcher that is not the one running.** Re-measured by me
independently, not inherited: `Get-CimInstance Win32_Process` filtered to command lines containing
`watcher` returns `30600 powershell -File "C:\po-watcher\watcher-launcher-singlelane.ps1"` →
`34332 start-watcher.ps1` → `28400 node index.mjs`. `SCRIPT-REGISTRY.md:94` and `:120` both name
`pr-watcher\watcher-launcher.ps1` and call it the thing that starts the watcher. Every station doc
tells the reader to trust the registry **over** the filename, so the registry was actively steering
stations to the wrong file.
**DISPOSITION: ACTIONED** — both sites corrected in this PR: the Watcher-internal note now names
`C:\po-watcher\watcher-launcher-singlelane.ps1` and marks it UNTRACKED, and the table carries the
live launcher plus a struck-through SUPERSEDED row for the tracked one.

**04-F6 — the rotation advance is documented but structurally cannot land.** `04-scanner.md:149`
told 04 to *"commit that file with your breadcrumb"*, but the authority matrix gives 04
*Create a PR: NO* / *Mutate the board: read-only*, and the dev tree sits on `main`. The instruction
asked 04 to do the one thing 04 is forbidden to do, so the advance survived only because a working
copy happened to persist — and **two consecutive advances were sitting uncommitted** when I arrived
(`git diff --numstat` = `2 2`, 04's advance written over the 22:10Z run's).
**DISPOSITION: ACTIONED, both halves.** (1) `docs/pipeline/sweep-rotation.json` is committed in this
PR — `last_index` 1→3, `last_run_utc` → `2026-09-02T02:10:25Z`, carrying both runs forward.
(2) `04-scanner.md` now reads *"LEAVE IT DIRTY … Station 00 commits it, because you may not"*, which
matches the authority matrix and what actually happens.
⚠️ Recorded, not fixed: `next-sweep.mjs --advance` rewrites those two lines at **column 0**, losing
the file's 2-space indent. Valid JSON, cosmetic only, and re-fixing it would just be undone by the
next advance — a lead for whoever next touches `next-sweep.mjs`, not a finding.

**04-F5 — `weekly-security-audit` has been `enabled: false` for 15 days** (`lastRunAt`
2026-08-18T08:18:52Z), its bootstrap and `scripts/security-audit.ps1` both present and healthy, and
it appears in no cadence table so nothing would ever notice.
**DISPOSITION: ESCALATED → Marco** (04 raised it; I am carrying it, not re-raising it). Its option
(A) — re-enable **and** add a row to `STATION-CAPABILITIES.md` §6 so a disabled schedule becomes
visible to the next drift sweep — is the one that passes both halves of RULE 1, and I agree with
04's framing. The question is whether it was switched off deliberately, which is RULE 3 and is his.

**04-F3 — 05's bootstrap cites `pr-gates.mjs:327` with no directory, and understates CP-24's
`codeRe`.** Not my lane: 04 dispatched it to Station 05, whose own doc is the durable place for the
full path (`scripts/pr-gates/pr-gates.mjs`) and the complete prefix list.
**DISPOSITION: DISPATCHED → Station 05** (confirmed, not re-routed). 05's cadence is daily and it
last filed 12h ago, so it will pick this up on its next run without further action from me.

**04-F2 (`ensure-watcher.ps1` not in the repo) and 04-F4 (three untracked-and-un-ignored state
files)** are second, independent measurements of open escalations **#19** and **#18**. 04 correctly
declined to re-open either. F4 adds one fact worth keeping: the population is **three** files
(`queue-watch-state.md`, `AWAITING-MARCO-DECISION.md`, `triage-state.md`), not one.
**DISPOSITION: DEFERRED** to #19 and #18, which already carry Marco's A/B/C options.

**04-F7 — the instruction-drift sweep's own premise is satisfied.** Five bootstraps byte-identical
but for five station-specific lines each, one batch, zero disproved advice, `U+FFFD=0` on all five.
**DISPOSITION: DEFERRED** to the next `instruction-drift` rotation, as 04 proposed. The `_why` text
should describe what it now watches for rather than a cured incident, but rewriting it now would
churn a file two stations are already writing to this hour.

### One more instrument lesson, mine, measured this run

**Never print `Win32_Process.CommandLine` unfiltered.** Verifying 04-F1 I dumped every command line
matching `watcher`; a Teams WebView2 process and this session's own `claude.exe` invocation matched
incidentally and cost roughly ten thousand tokens of context for a three-line answer. The correct
probe filters the *output*, not just the process set:
`... | Where-Object { $_.CommandLine -match 'pr-watcher|watcher-launcher|start-watcher' } |
Select-Object ProcessId, @{n='Cmd';e={ $_.CommandLine.Substring(0, [Math]::Min(120, $_.CommandLine.Length)) }}`.
This is DOCTRINE §7's shape with the sign flipped — not a lying instrument, an honest one aimed too
wide, which costs a scheduled run its budget just as effectively.

## ADDENDUM 2 — 03:03–03:15Z: `#1483` merged, the board is EMPTY, and a stale dev tree nearly armed a duplicate

**`#1483` MERGED 2026-09-02T02:46:46Z**, merge commit `fa16ead5`, `mergedBy=GH-Mantova`,
`autoMergeRequest=false`, labels `[]`. Timeline: `do-not-merge` applied 09-01T05:46:45Z, removed
09-01T08:51:48Z (the seventh occurrence already on record — the one CP-26 caught), merged 34 hours
later with no auto-merge. **[INFERRED]** that is Marco merging by hand, and he confirmed it in chat,
which is the RULE-2 clearance the rule asks for — *cleared by Marco, in chat, for that PR*. It is
**not** a tenth unattributable merge. I still cannot **prove** the actor, for the same shared-identity
reason as every previous case. `docs/decisions/merge-approvals/1483.md` landed with it.

**[MEASURED 03:06:40Z] The board is EMPTY and the sweep says `SAFE TO ACT`:**
0 open PRs · armed 0 · in-progress prompts 0 · no `index.lock` · 0 git processes · no PR touched in
2 min · watcher node 28400 alive, wrapper alive, clone `main` dirty=0. Trunk CI on the full 40-char
`fa16ead5`: **Push on main / CI / Deploy / Tendering Browser Smoke — all four `success`.** The
acceptance-suite migration `#1483` carried in-chain landed clean.

### 🔴 NEW INSTRUMENT TRAP, measured with a before/after — a STALE DEV TREE REPORTS A SPENT PROMPT AS ARMABLE

`lint-prompt.mjs` evaluates a `premise:` like
`! grep -q "SCOPE_WBS_TABLE_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx` against the
**working tree**, not against `origin/main`. The `requires_*` gates read `origin/main`; the premise
does not. So with the dev tree at `1239c33a` and `origin/main` at `fa16ead5`:

| | dev tree `1239c33a` | after `--ff-only` to `fa16ead5` |
|---|---|---|
| `pr-cardui-s2-wbs-table-shell-HOLD.md` | **ADMIT** (exit 0) — listed under *GATES SATISFIED* | **STALE / SPENT** (exit 3) — *"The work is ALREADY DONE. Binned before spawning an agent."* |
| `triage-holds.ps1` totals | `spent=1  gates-satisfied=40` | `spent=2  gates-satisfied=39` |

**Arming from the stale reading would have opened a second PR for the work `#1483` had just merged** —
the exact duplicate-run failure the lint exists to prevent, reintroduced by a stale checkout rather
than by a bad prompt. Memory had flagged this prompt as *"must not be armed while `#1483` is open"*;
the reason has now inverted — it must not be armed because `#1483` is **closed**.

🔴 **THE RULE: `git fetch --prune` AND `git merge --ff-only origin/main` BEFORE any HOLD triage or
arming decision. A `triage-holds.ps1` / `lint-prompt.mjs` verdict taken against a dev tree behind
`origin/main` is not a verdict about the board.** This is the second armability instrument in one run
to give a confident wrong answer — the first was `PROMOTE` on an untracked file.

### FINDINGS

**F7 — `pr-cardui-s2-wbs-table-shell-HOLD.md` is SPENT and was sitting armable on an empty board.**
**DISPOSITION: ACTIONED** — `git mv`'d to `docs/pr-prompts/superseded/` in this PR, per
`triage-holds.ps1`'s own instruction (*"Retire them to docs/pr-prompts/superseded/ in a board PR. Do
NOT arm."*). ⚠️ An uncommitted 56-line local amendment to it existed in the dev tree (Station 06
adding the three `tests/e2e/pr-acceptance/*.spec.ts` files to `scope` and `size: 8`→`10`). It is
**moot, not lost**: `#1483` shipped exactly that acceptance-suite move in-chain. `pr-cardui-s8`'s
uncommitted +41 is a different case — s8 is still `GATE_NOT_RELEASED`, so I left it untouched.

**F8 — `pr-cardui-s3-manpower-columns-HOLD.md`'s gate RELEASED when `#1483` merged.**
`requires_on_main: 'apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_WBS_TABLE_V1'` is
now satisfied on `fa16ead5`. `size: 6`, `gate_allow: none`, `escalates: true` — no migration, and its
PR would be labelled `do-not-merge` and left for Marco. It is the natural continuation of the chain.
**DISPOSITION: DEFERRED — put to Marco rather than armed.** The board is SAFE and armed is 0, so
arming is permitted; but the standing rule is to ask whether to arm at all, and he is present.

**F9 — `pr-tr-s1-reminder-policy-HOLD.md` is in the ADMIT list and would AUTO-MERGE A SCHEMA
MIGRATION UNATTENDED.** Re-measured this run: `size: 9`, `gate_allow: migrations`, **`escalates:
false`**, `backfill: false`. `escalates: false` means no `do-not-merge` label, so nothing would hold
its PR. Everything armed for Marco to date has been docs- or web-only.
**DISPOSITION: ESCALATED → Marco.** Do not arm it without him saying so explicitly. Under RULE 1 the
complete-and-additive correction is to set `escalates: true` on it so the human gate is structural
rather than dependent on whoever next reads the queue — it removes nothing and damages no data path.
Leaving it as-is fails the *future* half: the next SAFE-to-act window is one `git mv` away from an
unattended migration.

**F10 — both non-main worktrees are now ORPHANED.** `C:/po-1483-fix` (newest file 02:27:30Z,
`dirty=0`, branch `fix1483`, whose remote head was deleted when `#1483` merged) has flipped from
LIVE STATION WORKTREE to orphaned now that its PR has landed; `C:/po-work/s2-e2e` (newest 00:31:41Z,
`dirty=0`) was already orphaned. **DISPOSITION: DISPATCHED → Station 03**, folded into the existing
clone-hygiene dispatch alongside the 11 registry escapees and the stray `origin/origin` ref. Use
Station 04's option (A): annotated `abandoned/<name>@<sha>` tag, push tags, **then** delete. Both are
`dirty=0`, so nothing is at risk, but the tag costs nothing and the sweep has been wrong about
liveness in both directions today.
