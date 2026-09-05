# Station 00 — Supervisor | 2026-09-05T19:08Z–2026-09-05T19:3xZ

## GROUND

```
UTC            2026-09-05T19:08:27Z
origin/main    f86f689e  at start   ->  d5b9a55d after this run merged #1676
dev tree       main @ f86f689e      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — this run was not restricted to read-only.
**Sighted run.** `start_process` (shell `powershell.exe`) returned a live prompt on the first call
after `ToolSearch` loaded the Desktop Commander schemas. Shell control `$CTRL=42` printed
`CTRL-literal-is:42` through `interact_with_process`, so DOCTRINE §9.1's `-Command` expansion trap
does not apply to anything measured below.

All three binding documents were read **in full** from the dev tree, after proving the tree is at
`origin/main` and the documents are byte-identical to it:
`git rev-list --left-right --count HEAD...origin/main` → `0	0`, and
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` → **EMPTY** (§9.1: the `--numstat` form, never a piped hash).

**Safe to act:** `status-sweep.ps1` captured to a file (it returns early and hides its own §7 verdict
when piped) → §7 `[LIVE] SAFE TO ACT`, twice — at 19:09:32Z and again at **19:16:49Z**, the second
run taken immediately before the only merge this run performed.

## WHAT I MEASURED

**Board at 19:09:32Z — 5 open PRs, all CLEAN, all green.** Lane established for every one of them
before any merge decision, per DOCTRINE §10.1.

RULE 2 probe, pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed` and never the
clone (§9.5): **1964 logs, newest `2026-09-05 19:06:07Z`** — younger than every open PR, which is the
control that separates the live directory from the 21-log corpse in the watcher clone.
POSITIVE `marco.:true` → **613** · NEGATIVE `zzQqNeedle0020260905` → **0** ·
POSITIVE per-PR control `PR #1606` → **2** · NEGATIVE `PR #999999` → **0**.
Needles minted fresh for this run — Station 04's F3 measured that both written-down controls are now
contaminated (`zzzNoSuchNeedleZzz` → 40 hits over `docs/pr-prompts/**`).

| PR | files | lane | verdict |
|---|---|---|---|
| **#1676** | 2, both `docs/pr-prompts/` | 00 board PR (head `board/00-collect-…-1808`); probe → 0 hits, `[NO LANE VERDICT — hand-classified]`, `^docs/` ⇒ admits under `classifyPolicyFiles`, and §10.1 step 3 classifies it by the §5 matrix as 00's own lane | **MERGED this run** |
| **#1675** | 1, `docs/plans/` | **watcher-opened**, probe → **1 hit**: `{"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}` | **RULE 2 — NOT MERGED** |
| **#1667** | `scripts/pipeline/lint-prompt.mjs` + `scripts/pipeline/__tests__/…test.mjs` | probe → 0, hand-classified. The test file matches `(^\|/)__tests__/`; **`lint-prompt.mjs` matches none of the three `NESTED_TEST_PATHS` forms** ⇒ Marco's | **NOT MERGED** |
| **#1665** | 8, incl. `apps/api/prisma/migrations/…/migration.sql` | probe → 0; `(^\|/)migrations/` ⇒ Marco's on `classifyPolicyFiles`' own clause | **NOT MERGED** |
| **#1662** | 6, incl. a migration that **drops five columns** | probe → 0; migration + destructive ⇒ Marco's, §5 hard stop | **NOT MERGED** |

None of the five carries any label (`labels=[]` on all five, read per-PR with `gh pr view --json
labels`, never from a board listing).

**[MEASURED] Station 04's F1 reproduced independently before acting on it.**
`pr-tendering-board-restore-submitted-cardless-HOLD.md` is present at depth 1; its premise is
`! grep -q "COUNT_ONLY_STAGES" apps/web/src/pages/tendering/tenderingPage.helpers.ts`, and on
`origin/main` that symbol occurs **3** times (NEGATIVE control, a minted needle in the same file → 0),
so the premise FAILS and the work has shipped. `gh pr view 1632` → **MERGED 2026-09-05T02:59:27Z**,
title `fix(tendering): a submitted tender no longer disappears from the board (COUNT_ONLY_STAGES)`.

**[MEASURED] `check-breadcrumb.mjs --freshness` → CLEAN, exit 0.** 00 1.1h · 03 20.2h · 04 1.0h ·
05 5.0h, all `ok`. ⚠️ It still prints `(cadence 2h)` for 00 against a live cron of `5 * * * *` — the
known `const CADENCE =` defect, already filed for Marco; it is not re-filed here.

**[MEASURED] The queue.** `armed (*-ready.md)` → **0**. `.arming-log.txt` tail shows the last arm was
`2026-09-05T16:16:51Z ARMED pr-claudedesign-s2-spec-regeneration-plan … actor=station-00-scheduled-1608Z`.
Nothing was armed this run.

**[MEASURED] Machinery.** Watcher node **RUNNING pid 20000**, auto-restart wrapper alive (1),
heartbeat age 4 min, 0 git processes, no `index.lock` in either tree. Watcher clone `dirty=6` and the
orphaned worktree `C:/po-vg` (1 uncommitted file, age 2116 min) are both already dispatched to 03 and
were not touched — `--force` there would discard real work.

## WHAT CHANGED

1. **#1676 merged.** `Assert-SmokedOrEscalate -PR 1676` → `True`, then `Merge-Pr -PR 1676` → `True`.
   Read back: `state=MERGED mergedAt=2026-09-05T19:18:39Z sha=d5b9a55d63b6908c64567a79f70916192c2915ae`.
   `origin/main` moved `f86f689e..d5b9a55d`. No hand-merge, no `--admin`, no merge in the watcher repo.
2. **This board PR**, built in an isolated worktree off `origin/main` at `d5b9a55d`
   (`C:\po-worktrees\board-1908`), never in the dev tree and never in the clone. It carries the
   retirement in FINDING A, Station 04's breadcrumb, `docs/pipeline/sweep-rotation.json`, and this
   file — written **inside the PR worktree** (REPORT CONTRACT cure 1), so no loose copy is left in the
   dev tree to block the next fast-forward.

Nothing else was armed, disarmed, renamed, labelled, restarted or deleted.

## FINDINGS

### A — [S2] A merged second-lane PR left a live HOLD that no instrument could retire — ACTIONED

Station 04's F1, reproduced above with its own controls. `#1632` merged at 02:59:27Z through a second
lane, which does not consume the prompt it builds (DOCTRINE §10.6). The leftover HOLD then also fails
a *pre-premise* lint check (`UI_PROMPT_NEEDS_DESIGN_REF`), so `runPremise` never executes and
`triage-holds.ps1` can never report it SPENT — it sat invisible for over sixteen hours and would have
armed a duplicate of merged work the moment the unrelated check was satisfied.

**ACTIONED.** `git mv docs/pr-prompts/pr-tendering-board-restore-submitted-cardless-HOLD.md
docs/pr-prompts/superseded/` in this PR. Verification is in the WHAT I MEASURED block above (premise
FAIL with a negative control, `#1632` MERGED, 4 of 4 scope paths on main) and the post-merge check is
`triage-holds.ps1` reading `of 81` instead of `of 82`.

The **permanent** half of 04's F1 — making the SPENT verdict reachable behind a pre-premise reject —
is a `scripts/pipeline/triage-holds.ps1` change, outside 00's `docs/` merge lane. 04 applied RULE 1
and put the complete-and-additive option first (add a `SPENT-BEHIND-A-REJECT` bucket that runs the
premise itself; changes no existing verdict, cannot mis-bin, survives a future re-ordering of lint's
checks) over re-ordering lint (cheaper, but changes what REJECT means for every caller including the
watcher). I agree with that ordering and did not substitute my own.
**DEFERRED** — it wants a prompt of its own, and this run armed nothing by choice (see WHAT I DID NOT
DO). It becomes urgent the moment a second-lane PR merges against a HOLD that lint rejects for a
reason a later run then fixes.

### B — [S1] The `tests-docs` lane timed out on a PR that was green in 3.75 minutes — the escalation's own falsifying probe was run unattended today and the escalation SURVIVED it

`needs-marco/tests-docs-lane-starves-its-own-review-job-2026-09-04.md` ends with:

> Open a watcher-built `tests-docs` PR and leave it alone. If `docs/pr-reviews/pr-<N>-review.md`
> appears and `autoMergeRequest` reaches `ENABLED` with no supervisor touching it, **this escalation
> is dead — delete it.**

**#1675 is that experiment, run to completion, untouched by any station.** [MEASURED]:

| | |
|---|---|
| armed | `2026-09-05T16:16:51Z` by `station-00-scheduled-1608Z` |
| watcher opened it | `17:27:48Z` — `[merge] pr-claudedesign-s2-spec-regeneration-plan-ready.md: opened PR #1675, policy=tests-docs, waiting…` |
| all 3 CI runs **created** | `17:29:33–17:29:35Z` — **2.3 min** after open |
| all 3 CI runs **success** | by `17:31:04Z` — **3.75 min** after open |
| 90-min `MERGE_TIMEOUT_MS` window | expires ≈ `18:57:48Z` |
| `rev-1675` review job **started** | **`19:00:48Z`** — 93.5 min after open, **3 min after the window closed** |
| its verdict | `Verdict: **MERGE** for PR #1675` |
| watcher's recorded result | `{"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}` |

**The escalation is confirmed, not refuted.** Its stated mechanism — the review job is queued behind
the merge wait on the same single-lane worker — is exactly what the clock shows, and this is the first
instance measured with **no supervisor breaking the cycle by hand**, which is the one condition every
previous instance lacked.

🔴 **And it splits DOCTRINE §10.3, which currently records a different cause.** §10.3 pins the
timeout on CI-creation latency, measured on `#1500` at **212.6 min** to the first CI run. Today that
half is **0%** of the failure: CI existed 2.3 min after open and was green at 3.75 min. Today's
timeout is **entirely** the `+ MERGE verdict` conjunct. A reader applying §10.3's table to #1675 would
check CI latency, find it healthy, and conclude the mechanism does not reproduce — retiring a live
RULE-2-affecting defect. §10.3's own falsifying probe is its `ok:true` count, which is untouched; what
needs adding is that the reason string has **two** conjuncts and only one of them has a recorded cause.

**A trap I walked into and caught, worth recording because the next run will meet it.** Probing the
**dev tree** for `docs/pr-reviews/pr-1675-review.md` returns absent, and the newest review file there
is `pr-1669-review.md` (14:33:29Z) — which reads as *"the review lane stopped producing artifacts at
14:33Z"*, a clean five-in-a-row false finding I nearly filed. It is false. The artifacts exist, in the
tree the watcher actually reads: `C:\po-watcher\ProjectOperations\docs\pr-reviews\pr-1675-review.md`
written **19:03:00Z**, `pr-1676-review.md` 19:05:52Z, and `pr-1670/1671/1673/1674-review.md` relocated
to `C:\po-watcher\verdicts-archive\`. NEGATIVE control (a minted needle, same recursive search) → 0.
**`docs/pr-reviews/` in the dev tree is a stale mirror, not the instrument** — §9.6, an empty result
read as an empty world. I also nearly mis-assigned the cause to the `SessionEnd hook … Hook cancelled`
line present in the `rev-*` logs; it is **not** the discriminator — `rev-1660` and `rev-1662` carry it
and produced their files, `rev-1674` and `rev-1676` do not carry it and did not.

**ESCALATED — and it changes which option Marco should pick.** The escalation offers (a) give the
review job its own lane, (b) enqueue and run `rev-<N>` before the wait, (c) drop `verdictApproves`,
(d) do nothing. Today's measurement adds a constraint none of them was written against: the review
verdict for #1675 arrived at **19:03Z for a window that closed at 18:57Z** — a **6-minute** miss on a
93.5-minute delay. **RULE 1, complete-and-additive first:**

- **(a) is still the only option that passes both halves**, and today's data strengthens it: it is the
  only one that removes the coupling rather than tuning it. ✅ complete (fixes every future dependency
  the wait acquires, not just this ordering) · ✅ additive (a `rev-*` job writes only
  `docs/pr-reviews/`, shares no git index with the prompt worker).
- **(b) would have worked today**, and that is precisely why it should not be chosen on today's
  evidence: a 6-minute miss makes the cheap fix look sufficient. It fails the *complete* half exactly
  as the escalation already argues.
- **A raise of `MERGE_TIMEOUT_MS` is NOT a fifth option.** It fails both halves — it does not remove
  the starvation, and a longer wait occupies the single lane for longer, which is the defect.

The question for Marco is unchanged and remains **(a) or (b)**; what is new is the evidence that the
gap is small enough to make (b) tempting and that smallness is an artefact, not a margin. Recorded as
an addendum on the escalation file itself (`needs-marco/` is gitignored at `.gitignore:76-83`, so this
breadcrumb is the tracked half of that record).

### C — [S3] Every docs/tests PR the watcher opens is currently routed to Marco, and the board shows it

Consequence of B, stated separately because it is the thing that will be visible next run.
[MEASURED] of the 5 open PRs, **4 are Marco's** (#1675 by watcher verdict; #1667, #1665, #1662 by
hand-classification) and the fifth was 00's own board PR, now merged. The open board is again
converging on "everything waits for Marco", which is the throughput constraint this pipeline has
recorded before — but the #1675 half of it is **manufactured by an instrument**, not by policy: a
one-file `docs/plans/` change that CI cleared in under four minutes.

**DEFERRED to B.** It has no fix of its own; it dies when B is fixed. Re-file it as its own finding
only if a docs PR is routed to Marco for a reason that is *not* the timeout string.

## WHAT I DID NOT DO

- **Did not merge #1675.** It carries a genuine watcher `marco:true`. DOCTRINE §10.3 is explicit that
  a provably-weak routing reason does **not** clear a verdict, and §10.1 step 1 runs first and wins.
  Only Marco clears it, in chat, for that batch only. The timeout being demonstrably an instrument
  failure is an argument for fixing the instrument, not for merging past the gate.
- **Did not merge #1667, #1665 or #1662** — hand-classified Marco's (a `scripts/` file outside the
  three `NESTED_TEST_PATHS` forms; two migrations, one of them a five-column drop). Did not remove or
  add any label on any PR; did not touch `--admin`.
- **Armed nothing.** `armed=0` at the start and at the end. The queue's ADMIT bucket was not re-derived
  this run and no arming decision was taken — with `#1665` and `#1662` open and carrying the exact
  scope of two ADMIT prompts (DOCTRINE §10.6), an arm taken without re-running the `scope:` cross-check
  would open a duplicate. That check belongs to a run that intends to arm; this one did not.
- **Did not touch the watcher clone** (`dirty=6`), **`C:\po-vg`** (1 uncommitted file, 2116 min old),
  the dev tree's 34 untracked `docs/pr-reviews/` files, or the 11 dev-tree stashes. The first two are
  already dispatched to 03; the third is explained in FINDING B and is not drift to clean.
- **Did not restart the watcher.** It is RUNNING with a live wrapper and a 4-minute heartbeat; there
  was no WEDGED or DOWN verdict, and `restart-watcher-if-wedged.ps1` is the only thing that may issue
  one.
- **Did not edit `/sot/`, DOCTRINE's canonical blocks, Azure, Entra, SharePoint, or production data.**
  FINDING B's §10.3 correction and Station 04's F3 (both standard negative-control needles are now
  contaminated) each want an edit inside the hash-gated `instruments v2` block, which must be
  re-recorded with `lint-station.mjs --write-canonical` and shipped across all seven station docs in
  one PR. **DEFERRED** — that is more than a collect run should carry, and both are recorded here with
  their measurements so the run that does carry it does not have to re-derive them.
