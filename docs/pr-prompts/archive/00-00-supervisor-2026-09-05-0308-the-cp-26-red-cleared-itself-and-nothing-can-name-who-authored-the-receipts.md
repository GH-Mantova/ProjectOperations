# Station 00 — Supervisor | 2026-09-05T03:08Z–2026-09-05T03:33Z

## GROUND

```
UTC            2026-09-05T03:08:20Z
origin/main    2ac3cbf2            (git fetch --prune, then git log --oneline -1 origin/main)
dev tree       main @ 2ac3cbf2      C:\ProjectOperations2   (fast-forwarded this run from 8b7bb319; 0 ahead / 0 behind)
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE. Run proceeded with full authority.

**NOT a blind run.** [MEASURED] Desktop Commander tools loaded via `ToolSearch` first (PREFLIGHT step 1
— a validation error is not blindness), then `start_process` shell `powershell.exe` returned a live
prompt; PID 27144 and PID 10256 both served commands on the Windows host for the whole run.

Binding documents read **in full** this run: `docs/pipeline/stations/00-supervisor.md`,
`docs/pipeline/DOCTRINE.md`, `docs/pipeline/STATION-CAPABILITIES.md`.
[MEASURED] All three byte-identical to `origin/main` — `git diff --numstat origin/main -- <path>`
returned **empty** for each (the sanctioned form; the piped `hash-object --stdin` comparison is
unsound under PowerShell, PREFLIGHT step 2). Read in the **dev tree**, not the watcher clone.

## WHAT I MEASURED

**1. The dev tree was 2 behind and was fast-forwarded before any triage.**
[MEASURED] `git rev-list --left-right --count HEAD...origin/main` → `0	2` at open;
`git merge --ff-only origin/main` → `Updating 8b7bb319..2ac3cbf2`; read back → `0	0`.
The FF succeeded with 32 untracked/modified paths present — this run did not hit the untracked-breadcrumb
FF blocker, because the two 00 breadcrumbs it would have named had already landed in #1625/#1630.

**2. `status-sweep.ps1`, run whole, twice.** [MEASURED] 03:09:30Z → `SWEEP COMPLETE 03:10:10Z`.
Section 0 both positive controls PASS. Verdict **`CAUTION`**: 1 LIVE STATION WORKTREE, `C:/po-vg`,
`dirty=1 age=1156 min`. Section 3 safe-to-act: in-progress prompts 0, `index.lock` False/False,
git processes 0, no PR touched in 2 min.
🔴 **The first invocation returned EARLY with output still pending** (DOCTRINE §9.1) — it stopped at
section 4B and reported the process finished, hiding sections 5–7 **including the verdict**. It was
re-run capturing to a file (`$sw.Count` = **221** lines) and read from there. A run that had trusted
the first read would have reported no verdict at all.

**3. Breadcrumb freshness — no station is SILENT.** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`,
`structure: 6 checked, 0 malformed`:
`00` 1.1h ago (cadence 2h) ok · `03` 4.2h (24h) ok · `04` 1.0h (4h) ok · `05` 13.0h (24h) ok.
Each is inside **one** cadence, not merely inside 2×, so escalation #23's blind spot (2× hides exactly
one missed occurrence) does not bite this run and no `lastRunAt` / session-directory cross-check was
needed to clear any station.

**4. Six spent HOLD prompts re-verified independently of Station 04's report** (§7.1 re-read rule),
against `origin/main` **and** the now-current tree, per prompt's own `premise` token:

| prompt | token | main | tree |
|---|---|---|---|
| `pr-cardpersist-s1-manpower-rows-persist-HOLD.md` | `SCOPE_MANPOWER_PERSIST_V1` | 17 | 17 |
| `pr-crmui-register-s2-followups-kpis-and-toggles-HOLD.md` | `CRM_FOLLOWUPS_V2` | 12 | 12 |
| `pr-cardapi-s1-scope-item-labour-and-markup-store-HOLD.md` | `SCOPE_ITEM_LABOUR_STORE_V1` | 1 | 1 |
| `pr-cardfix-s1-table-chrome-and-column-placement-HOLD.md` | `SCOPE_WBS_GROUPRULES_V1` | 14 | 14 |
| `pr-cardfix-s2-inputs-money-and-inheritance-HOLD.md` | `SCOPE_WBS_INPUTS_V2` | 27 | 27 |
| `pr-crmui-register-s1-value-and-last-interaction-HOLD.md` | `CRM_REGISTER_V3` | 9 | 9 |

NEGATIVE control `zzzNoSuchTokenZzz` on the same blob → **0**. Every premise is `! grep -q "TOKEN" PATH`,
so a non-zero count is a DEAD premise. All six are SPENT on both sides. F1's divergence is gone
because the tree was fast-forwarded first — which is exactly what 04 predicted.

**5. RULE 2 probe — well controlled, and it says NO LOG for every open PR.** [MEASURED] against the
**live** tree `C:\ProjectOperations2\docs\pr-prompts\processed` (never the clone, §9.5):
logs **1926**, newest **2026-09-05T02:44:00Z** — younger than the oldest open PR (#1614, 22:59Z),
which is the control that separates the live directory from the 2026-08-17 decoy.
POSITIVE `marco.:true` → **612**. NEGATIVE → **0**.
Per-PR, over `pr-*.log` only (excluding `rev-*`, §9.5): **#1614 · #1615 · #1616 · #1619 · #1621 · #1633
all → 0 hits, `NO LOG`.** NEGATIVE control `PR #999999` → **0**.

**6. `NO LOG` here means SECOND LANE, and it is measured, not assumed.** [MEASURED] no processed
prompt log exists under *any* name for any of the six head branches, and `.arming-log.txt`'s last
entry is `2026-09-04T22:03:13Z ARMED pr-crmui-account360-s1-tiles-and-next-action` — a different
prompt. **None of the six was armed and none was built by the watcher**, including #1633, whose branch
name (`pr-cardpersist-s3-item-markup-persists`) reads exactly like a prompt name. Hand-classified per
DOCTRINE §10.1 step 2 against all three `NESTED_TEST_PATHS` forms:

| PR | files | outside tests/docs | migrations | classification |
|---|---|---|---|---|
| #1614 | 7 | 5 (`apps/web/src/components/ShellLayout.tsx`, …) | 0 | **MARCO'S** |
| #1615 | 3 | 1 (`apps/web/src/pages/crm/CommsHubPage.tsx`) | 0 | **MARCO'S** |
| #1616 | 3 | 1 (`apps/web/src/pages/crm/RelationshipsPage.tsx`) | 0 | **MARCO'S** |
| #1619 | 8 | 5 (`apps/api/src/modules/rates/rate-step-evaluator.ts`, …) | 0 | **MARCO'S** |
| #1621 | 2 | 1 (`scripts/pipeline/status-sweep.ps1`) | 0 | **MARCO'S** |
| #1633 | 2 | 1 (`apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx`) | 0 | **MARCO'S** |

All six recorded `[NO LANE VERDICT — hand-classified]`.
⚠️ #1633 opened at **03:06:54Z**, *after* the newest processed log (02:44Z). Its `NO LOG` would also be
consistent with "verdict not yet written" — the §9.5 two-causes trap. The arming-log and
missing-prompt-log evidence above is what settles it as second lane, not the probe alone.

**7. The board is not red. It is waiting.** [MEASURED] all six open PRs: `failing=0`, `pending=1`,
and the one pending check is **`tendering-e2e`** on every one of them. `mergeStateStatus=BLOCKED`
on all six is that pending required check, not a failure. `main` CI on `2ac3cbf2`: 3 success / 0 failed
/ 1 running.

**8. CP-26 was RED on all five and is now GREEN on all five, and no station did it.**
[MEASURED] job log of the last failing run on #1614 (run `33939038486`, sha `52962409`, 02:25:41Z),
read per LIMIT 6 rather than diagnosed from the PR page:

```
FAIL - CP-26 approval-receipt [RELEASED_NO_RECEIPT] PR #1614 was labelled do-not-merge and released,
but docs/decisions/merge-approvals/1614.md is not in this PR's diff against merge-base with origin/main.
```

[MEASURED] job log of the current run (run `33940805109`, sha `f41e9a19`, 03:03:43Z):

```
PASS - CP-26 approval-receipt [RECEIPT_VALID] approved_by=GH-Mantova approved_at=2026-09-05T02:00:04Z
```

The receipt files now exist in the diffs of **all five** (`docs/decisions/merge-approvals/{1614,1615,1616,1619,1621}.md`).

**9. The head branches are being rebased continuously — 15 head SHAs in 4 hours on one PR.**
[MEASURED] `gh run list --branch pr-crmui-chrome-s1-counts-badges-and-inbox-actions --limit 40`
returned 30 runs across **15 distinct head SHAs** between 2026-09-04T23:00:02Z and 2026-09-05T03:03:43Z,
two of them `cancelled` mid-flight. This is escalation #24's `PR_WATCHER_AUTO_UPDATE` churn, measured
larger than any prior recording. **It is also the mechanism that erased the CP-26 red**: the failing
CP-26 check-run lived on a head SHA that no longer exists, and `.../commits/<branch>/check-runs`
returns **1** CP-26 run — the passing one. The red left no trace on the PR.

## WHAT CHANGED

- **Dev tree fast-forwarded** `8b7bb319` → `2ac3cbf2`. Read back `0	0`.
- **Six spent `-HOLD.md` retired** to `docs/pr-prompts/superseded/` via `git mv` **in a disposable
  worktree** (`C:\po-worktrees\board-0308`, branch `board/00-collect-2026-09-05-0308`, cut from
  `origin/main` at `2ac3cbf2`) — never in the dev tree, never in the watcher clone. Read back:
  six `R ` rename rows in `git status --porcelain`.
- **`docs/pipeline/sweep-rotation.json` committed** (04's uncommitted advance: `last_index 3 → 0`,
  `last_run_utc → 2026-09-05T02:09:57Z`). [MEASURED] `git diff --numstat` = `2	2`, exactly the
  intended change and nothing else.
- **Station 04's 02:09Z breadcrumb committed**, and this breadcrumb written **inside the PR worktree**
  (the station doc's cure 1), so no loose copy is left in the dev tree to block the next fast-forward.
- **Nothing armed. Nothing disarmed. No PR merged. No label added or removed. No receipt authored.**

## FINDINGS

### F1 — The CP-26 red that held five of Marco's PRs was cleared by approval receipts nobody can attribute

The five PRs #1614 #1615 #1616 #1619 #1621 all hand-classify as **Marco's** (§10.1 step 2, measurement 6).
All five had `do-not-merge` removed. All five went RED on `[RELEASED_NO_RECEIPT]` — the gate working
exactly as designed. Between **02:27Z and 02:46Z** the matching receipt files appeared on all five
branches and CP-26 flipped to `[RECEIPT_VALID]`.

[MEASURED] the receipt commits: `00c1fe3e` (#1614, 02:40:47Z), `88134490` (#1615, 02:40:51Z),
`0cc93a29` (#1619, 02:40:57Z), `d94d2a58` (#1621, 02:41:02Z) — four to six seconds apart, each
message `docs(merge-approvals): receipt for #N - Marco released the do-not-merge label`.
(#1616's fetch raced the auto-update force-push and returned `fatal: bad revision 'FETCH_HEAD'`;
its receipt is present in the PR diff, so the pattern is 5 of 5 by file and 4 of 5 by commit —
`[CANNOT MEASURE]` for the fifth commit object this run.)

Every one is authored `Marco <marco@initialservices.net>` — **and that proves nothing.**
🔴 [MEASURED] `git config user.email`: dev tree `C:\ProjectOperations2` = **`supervisor@local`**
(`user.name = PR Supervisor`); **`--global` = `marco@initialservices.net`**; watcher clone =
`marco@initialservices.net`. So `Marco <marco@…>` is the machine's **default** identity, produced by
any tree without a local override — the watcher clone, any disposable worktree, any second-lane
session on this box. It is the `GH-Mantova` identity collapse one layer down, and this run nearly
wrote "Marco released them himself" off it. **Who authored the receipts is `[CANNOT MEASURE]`.**

[MEASURED] no tracked code authors a receipt: `git grep -l merge-approvals origin/main -- scripts/ .github/ apps/`
returns four files, all of which are the CP-26 **checker** and its tests, and
`writeFileSync|appendFileSync|mkdirSync` occurs **0** times in each of `approval-receipt.mjs`,
`approval-receipt-check.mjs`, `pr-gates.mjs`. NEGATIVE control `qqrmp-not-a-real-needle-7731` → 0.
⚠️ My first negative control was `zzzNoSuchTokenZzz`, which returned **28** — that needle is written
into DOCTRINE and into breadcrumbs as documented example text, so it is *present in the corpus*.
A broken control, caught before it was believed (§7, guard 1).

So: the standing rule is **NO AGENT MAY EVER AUTHOR A `merge-approvals/<N>.md`**, five such files were
authored inside twenty minutes, and the instruments cannot say whether the author was Marco or an agent
using his box's default git identity. The gate built to make a release leave *"an authored, reviewable
artefact"* has been satisfied by an artefact whose author is unestablishable. Nothing now stands between
these five and `main` except `tendering-e2e` going green — and RULE 2, which is a rule I obey and CI does not.

**ESCALATED — Marco.** Question, not status: **did you remove those five `do-not-merge` labels and author
those five receipts?** And, whichever way that lands, **how should a run tell your receipt from an agent's?**
Options, RULE 1 applied:

**(a) Give the receipt an identity CI can verify, and make CP-26 require it — complete and additive.**
Require the receipt commit to be **signed** (or to carry a token only Marco holds) and have
`approval-receipt-check.mjs` verify that, not merely the file's presence. Additive: no existing receipt
is invalidated, no PR is blocked that was not already blocked, and every future release leaves an
attributable artefact. **Passes both halves of RULE 1** — it closes the hole now and for every future
release, and it damages no data entry. Cost: you sign, or you keep a token.

**(b) Set a distinct git identity in every non-Marco tree** (`user.email = supervisor@local` is already
set in the dev tree — extend it to the watcher clone and every worktree). Cheaper, and it makes the
*next* forgery legible. **Fails the COMPLETE half**: it is a convention, not a gate — a second-lane
session that sets its own config still reads as you, and it says nothing about the five receipts already
on the board.

**(c) Do nothing and treat the receipts as valid.** **Fails both halves.** It leaves five PRs of yours
one green check away from merging on an unattributable approval, and it teaches every later run that a
receipt is self-certifying.

Until you answer: **RULE 2 stands and I have merged nothing.** A removed label does not clear RULE 2,
and a receipt is not a clearance in chat.

### F2 — The board's six open PRs are ALL second lane, and the watcher built none of them

Measurement 6. This is the largest single-run count so far — the previous record in project memory was
"nine unattributable releases to date", and this run adds six open ones in one sitting, including one
(#1633) whose branch is named exactly like a queue prompt that was never armed. Two of the six touch
paths no station lane covers (`apps/api/**`, `apps/web/**`); one touches `scripts/pipeline/status-sweep.ps1`.

The board is being driven by an actor that leaves no arming-log row, no processed log, and no merge
verdict — so **RULE 2's only probe returns empty for the entire board**, and an empty result there is
indistinguishable from "checked, and not Marco's" (§10.1). Every one had to be hand-classified.

**ESCALATED — Marco**, folded into F1's question: the two are one thread. If the answer to F1 is
"that was me", then F2 is simply *how you work* and the pipeline should record that a Marco lane exists
and stop reporting it as an anomaly every two hours — three consecutive 00 runs have now spent
budget re-deriving it. If the answer is "that was not me", F2 is the incident and F1 is its cover.

### F3 — Six spent HOLD prompts retired (Station 04's F1 + F2, collected)

Both of 04's dispatches verified independently (measurement 4) and **ACTIONED** in this run's board PR.
Station 04's caveats were honoured: `pr-cardpersist-s2-plant-rows-persist-HOLD.md` and
`pr-cardfix-s3-plant-picker-HOLD.md` were **not** touched, and no `requires_on_main` line naming a
retired prompt's token was edited. The tokens those gates name live in the **code on `origin/main`**,
not in the retired prompt files, so retiring the files cannot release a gate.

**ACTIONED.** Verified by the six `R ` rename rows read back from `git status --porcelain` in the
worktree, and by the PR's own file list.

### F4 — Station 04's rotation advance landed (04's F4)

`docs/pipeline/sweep-rotation.json` sat modified-and-unstaged in the shared dev tree; 04 may not commit
it and nobody commits to `main`. It is in this run's board PR, committed with a **pathspec** because the
dev-tree index is shared (§9.2). Next Scanner run reads `instrument-honesty` rather than repeating
`gate-liveness`.

**ACTIONED.**

### F5 — `requires_merged` is a declared gate the linter never evaluates (04's F3)

Re-read, not re-derived: 04 measured no evaluation call site on `origin/main`, all seven target PRs
currently MERGED, so no live ADMIT is wrong on this account. The fix is staged and lint-clean as
`pr-lint-requires-merged-gate-unevaluated-HOLD.md`.

I did **not** arm it. Reasons, stated so the next run does not re-litigate them: its scope is
`scripts/**`, so its PR hand-classifies as **Marco's for merge** — it would become a **seventh** PR on a
board where six already sit unmergeable pending Marco; the sweep verdict this run was **CAUTION**; and
the standing arming rule prefers a `tests/`-or-`docs/`-only prompt when one is available. The defect is
**latent, not live**.

**DEFERRED.** It becomes urgent the moment any HOLD whose *only* dependency key is `requires_merged`
names a PR that is **open or nonexistent** — at that point the ADMIT is actively wrong and arming it
builds against an unmet gate. Until then, treat such an ADMIT as ungated and check the PR state by hand.

### F6 — `status-sweep.ps1` returned early and hid its own verdict

Measurement 2. The first invocation stopped after section 4B and Desktop Commander reported the process
finished; sections 5, 6 and **7 (THE VERDICT)** were never printed. `read_process_output` with an
explicit offset then reported `0 remaining` — so the standard cure for §9.1's early-return trap
*confirmed the truncation as complete output*. Only re-running it into a file and counting lines (**221**)
exposed it.

This is a sharper form of the §9.1 bullet than the one recorded there: not merely an early return, but
an early return whose own prescribed remedy returns a clean `0 remaining` on the truncated stream. A run
that followed §9.1 exactly would have reported this board with **no sweep verdict at all** and not known it.

**DISPATCHED — Station 04.** Reproduce it against `status-sweep.ps1` (long output, no `#` lines) and
establish whether `0 remaining` can be trusted after a process-finished signal, or whether every
long-output capture must go through a file. If it reproduces, DOCTRINE §9.1's second bullet needs the
"and its cure can lie too" clause, which is a canonical-block edit and therefore a deliberate PR, not a
side effect of a collect run.

### F7 — `C:/po-vg` has pinned the sweep to CAUTION for eight consecutive runs; the fix is #1621 and it is stuck behind F1

[MEASURED] `LIVE STATION WORKTREE: C:/po-vg  23c91ba9 [fix/no-rebase-while-checks-run]  dirty=1  age=1156 min`.
Nineteen hours is not a station mid-run; the classifier reads *dirty* as *live* and never expires it.
The cure is already written and open as **#1621** — *"a dirty worktree pinned LIVE forever and froze
the board safe-to-act gate"* — which is itself one of the five PRs held by F1. The gate that tells
stations whether it is safe to act is being degraded by a worktree whose fix cannot merge.

**DEFERRED** (blocked on F1, not on work). Not ACTIONED because removing another actor's worktree is
destructive and `C:/po-vg` is outside every path this run owns. It becomes urgent if a station stands
down on the CAUTION and skips real work — so far every run has correctly proceeded with an isolated
worktree, which is what CAUTION prescribes.

## WHAT I DID NOT DO

- **Did not merge anything.** All six open PRs hand-classify as **Marco's** and RULE 2 binds. They are
  also all `BLOCKED` on a pending `tendering-e2e`, so no merge was available this run in any case —
  but the classification, not the pending check, is the reason.
- **Did not remove, add or restore any label**, and **did not author, edit or delete any
  `merge-approvals/*.md`.** The five that appeared this morning are reported, not touched.
- **Did not arm anything.** `armed: 0` at open and at close. `pr-lint-requires-merged-gate-unevaluated-HOLD.md`
  was considered and DEFERRED with reasons (F5); no other prompt was evaluated for arming.
- **Did not touch `C:/po-vg`**, the watcher process, or the watcher clone's git. The watcher is
  `RUNNING pid 20000` with its wrapper alive and a 26-minute heartbeat against an empty queue — idle,
  not wedged, so `restart-watcher-if-wedged.ps1` was not run with `-Fix` and nothing was restarted.
- **Did not fix the `PR_WATCHER_AUTO_UPDATE` churn** (measurement 9). It is escalation #24, already
  dispatched to Station 03, and re-dispatching it would be noise. Recorded here only because this run
  measured it larger (15 head SHAs / 4 hours) than any prior reading, and because it is the mechanism
  that erased F1's evidence from the PR pages.
- **Did not commit the two `M` 00 breadcrumbs** in the dev tree. [MEASURED] `git diff --numstat` lists
  **only** `sweep-rotation.json`; both breadcrumbs are a CRLF smudge with no content change, so
  committing them would have been a diff nobody wrote.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, or production data.**
