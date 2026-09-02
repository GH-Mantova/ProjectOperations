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
