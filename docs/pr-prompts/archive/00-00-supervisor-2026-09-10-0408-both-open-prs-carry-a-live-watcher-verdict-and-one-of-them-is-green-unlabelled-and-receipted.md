# Station 00 — Supervisor | 2026-09-10T04:08Z–2026-09-10T04:25Z

## GROUND

```
UTC            2026-09-10T04:08:51Z   (lastRunAt, scheduled-tasks MCP; first shell 04:09:22Z)
origin/main    d0bfb30c               (fetch --prune, then rev-parse)
dev tree       main @ d0bfb30c        C:\ProjectOperations2   (0 ahead, 0 behind)
doc version    1                      (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                      (station_doc_version in the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — this run was READ-WRITE.

**This run was SIGHTED.** Desktop Commander reached the box on the first call
(`start_process`, `powershell.exe`, pid 12908 then 2300). Saying so loudly because a blind run and
a healthy quiet run both produce "no news", and this run's headline IS "no news".

## WHAT I MEASURED

**Binding documents — read in full, from a working copy PROVED identical to `origin/main`.**
[MEASURED] `git diff --numstat origin/main -- <path>` returned EMPTY for all three
(`00-supervisor.md`, `DOCTRINE.md`, `STATION-CAPABILITIES.md`). NEGATIVE control against
`origin/main~40` returned `94 0` and `26 0` on two of them, so the probe can say DIFF and the
EMPTY is a real answer, not a dead query. No piped hash was used anywhere (PREFLIGHT step 2).

**The VM/bash transport is DOWN; Desktop Commander is UP.** [MEASURED] two honest attempts, both
`RPC error -1 … Plan9 share "c" which is not mounted`. `vm-git-guard.sh` therefore **could not be
installed** — a FINDING, not a stop, and this run's exposure to what the guard prevents is nil,
because no VM-side call is possible at all. This is the mirror of the usual blindness: the
transport that matters (Desktop Commander) is the one that works.

**`status-sweep.ps1`** — captured to a FILE (`C:\po-sup-fix-scripts\sweep-20260910-0410.txt`,
131,240 B) because it returns early and hides its own §7 verdict when streamed. Written UTF-16LE by
PowerShell redirection (BOM `ff fe` — §9.3), so it was read back with node as `utf16le`, never as
utf8. §0 instrument controls both PASS. **§7 VERDICT: `SAFE TO ACT`.**

**Condition 3, re-measured at 04:19:28Z immediately before the only mutation this run made** —
`index.lock` dev=False clone=False · `git` processes 0 · `git diff --cached --name-status` EMPTY
(the dev-tree index is shared, so this is checked, not assumed) · armed=0 · newest PR `updatedAt`
03:29Z, i.e. 50 min cold.

**Watcher — the sanctioned verdict, not my reasoning.**
`scripts\restart-watcher-if-wedged.ps1` (no `-Fix`): `VERDICT: OK - nothing armed and the watcher
is alive. An idle watcher is correct, not wedged.` node pid 13352, wrapper alive (1), restart churn
0 cycles in 20 min. Heartbeat 90 min old, which with armed=0 is idle and not wedged. The script
printed `14:18:23` local against my 04:18Z — the Brisbane UTC+10 offset behaving exactly as
documented, not a ten-hour outage.

**COLLECT.** `check-breadcrumb.mjs --freshness` → `structure: 29 checked, 0 malformed`, `CLEAN`,
exit 0, all five stations `ok`. Because `ok` is not an all-clear (a 529 on turn one consumes a whole
cadence and still updates `lastRunAt`, and `CADENCE['00']` is still `2` when the live cron is
hourly), it was crossed against `lastRunAt` from the scheduled-tasks MCP:

| station | `lastRunAt` | newest breadcrumb | read |
|---|---|---|---|
| 00 | 2026-09-10T04:08:51Z (this run) | 2026-09-10T03:08Z | aligned |
| 03 | 2026-09-09T23:01:42Z | 2026-09-09T23:01Z | aligned |
| 04 | 2026-09-10T02:10:29Z | 2026-09-10T02:10Z | aligned |
| 05 | 2026-09-09T22:01:58Z | 2026-09-09T22:02Z | aligned |
| `weekly-security-audit` | 2026-09-06T21:32:44Z | n/a (not a station) | on cadence, next 09-13 |

All five enabled tasks are fresh and aligned. **No station is SILENT, and none fired-without-
reporting.** `00-supervisor` is ENABLED and firing hourly (`5 * * * *`, next 05:07:52Z).

**The collect window is EMPTY.** Newest breadcrumb from any station is 04's `2026-09-10-0210`,
which my own 03:08Z run already collected — its F1 is on `origin/main` inside DOCTRINE §9.1 as
*"Found by Station 04 2026-09-10T02:2xZ (F1), landed by Station 00 at 03:3xZ"*, shipped as **#1839**
(merged 03:26Z). Nothing has been written since. [MEASURED] `git status --porcelain` in the dev tree
shows **no untracked breadcrumb** — so there is also nothing unpublished, and I did not need the
tracked-set-vs-dev-tree check that caught a near-duplicate last run.

**Board — Q1, verbatim.** `gh pr list --state open` → **2 open, 0 DIRTY.** Both `CLEAN`, both
15 pass / 0 fail / 0 pending, both **unlabelled**. `main` CI on `d0bfb30c`: 5 success / 0 failed.

**Lane classification — §10.1 step 1 ran first and answered for both, so no hand-classification was
needed.** Probe pinned to `C:\ProjectOperations2\docs\pr-prompts\processed` (the LIVE directory,
never the clone's 21-log decoy). Controls: **2105** logs; newest `rev-1836-ready.md.log`
`2026-09-10T02:35:47Z`, which is younger than the oldest open PR (#1823, created 09-09T00:05Z) —
that age control, not POS>0, is what separates the live directory from the corpse. POS
`marco.:true` → **627** (written without a quote character, as required). NEG, a **freshly minted**
needle → **0**. Per-PR discriminator over `pr-*.log` only, excluding the `rev-*` review jobs:

| PR | prompt-log hits | watcher verdict |
|---|---|---|
| #1832 | 2 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh"}` |
| #1823 | 2 | `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` |
| #999999 — NEG control | 0 | — |
| #1814 — POS control | 1 | — |

**Both open PRs carry a REAL watcher `marco:true` verdict.** Not an absence, not a timeout I had to
interpret: the verdict lines exist and name their reason.

**Arming — the question my 03:08Z run deferred, re-measured.** `triage-holds.ps1` (read-only; GIT
control PASS, SPENT-fixture control PASS): 41 HOLDs at depth 1 → **1 SPENT · 9 gates-satisfied ·
31 still-gated · 0 unreadable**. Each of the 9 candidates' `scope:` was classified against
`classifyPolicyFiles`' three `NESTED_TEST_PATHS` forms:

| prompt | verdict |
|---|---|
| `pr-brandtheme-s3-full-palette-columns` | Marco's — **migration** |
| `pr-brandtheme-s6-live-preview-contrast-and-override` | Marco's |
| `pr-company-manage-s1-permission-and-grant` | Marco's — **migration** |
| `pr-e2e-container-s2-swap-required-job` | Marco's (`.github/workflows/**`) |
| `pr-fv2-maintenance-usage-intervals` | Marco's — **migration** |
| `pr-qpdf-1-estimate-preview-mark` | Marco's |
| `pr-qpdf-3-quoteref-collision-409` | Marco's |
| `pr-qpdf-4-freeze-issued-terms` | Marco's |
| `pr-rateparity-s1-harness` | Marco's |

**TESTS-DOCS-ELIGIBLE = 0 of 9.** Every one carries at least one path outside `^(tests|docs)/`,
`(^|/)__tests__/` and `\.(test|spec)\.[cm]?[jt]sx?$`; three carry `apps/api/prisma/migrations/**`.

## WHAT CHANGED

One mutation, in an isolated worktree off `origin/main` (`C:\po-worktrees\collect-0408`, created at
`d0bfb30c`), never in the dev tree and never in the watcher clone:

- `git mv docs/pr-prompts/pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md
  docs/pr-prompts/superseded/` — read back as `R  <old> -> <new>` in `git status --porcelain`.

This breadcrumb was written **inside the worktree**, which is cure 1 of the post-merge fast-forward
rule — no loose untracked copy is left in the dev tree, so the blocker that has cost four
consecutive runs cannot arise from this run at all.

Nothing was armed. Nothing was merged. No label was touched. No `/sot/` file was read-modified. The
watcher was not restarted.

## FINDINGS

### F1 — the board cannot move: both open PRs carry a live watcher `marco:true`, and 0 of 9 armable HOLDs can enter the tests-docs lane (S2)

This is the whole state of the board in one sentence, and it is the third consecutive run to measure
it. #1832 and #1823 are both green, both clean, both unlabelled — and both are routed to Marco by a
verdict that exists and says so. Arming is no relief: every one of the 9 gate-satisfied HOLDs lands
outside `tests|docs`, so arming any of them adds a **third** PR to a pile of two that only Marco can
clear. Three of the nine additionally carry migrations.

The underlying constraint is already open as
`needs-marco/tests-docs-lane-starves-its-own-review-job-2026-09-04.md` and as the throughput note in
`00-00-supervisor-2026-09-08-0208`. What this run adds is that the starvation is now **total** on the
merge side too, not just the review side: there is no eligible arm AND no eligible merge.

**DISPOSITION: DEFERRED** — deliberately, not by omission. It becomes actionable the moment either
(a) Marco merges or releases one of the two, or (b) a HOLD appears whose scope is tests-or-docs only.
Neither is mine to cause. Arming an ineligible HOLD to look busy would make the queue longer, not
shorter — that is the measured lesson already on record, and I am obeying it rather than re-testing it.

### F2 — #1823 is green, unlabelled, CP-26-passing and carries an agent-authored receipt, while its watcher `marco:true` verdict is still live (S1 — a merge hazard aimed at the NEXT reader)

Every visible signal on #1823 reads "cleared": `mergeStateStatus CLEAN`, 15/15 checks green, `labels:
[]`, and a merge-approval receipt present in its own diff at
`docs/decisions/merge-approvals/1823.md` with front matter `approved_by: marco`. CP-26 passes on it.

[MEASURED] the receipt's **authoring commit** — never the squash commit, per §10.2.1 —
`9664f95a  2026-09-09T22:42:26Z  author=PR Supervisor <supervisor@local>;Claude Opus 5
<noreply@anthropic.com>  :: docs(approvals): merge-approval receipt for #1823`. An **agent** wrote
it. That is permitted for the supervised cloud lane under Marco's 2026-09-07 ruling, and the receipt
body is unusually honest — it records the label-removal timeline, quotes Marco's chat words *"1823
label removed"*, and flags in its own text that the watcher verdict was REJECT-and-redo and has not
been re-run against the fix.

**The hazard is not the receipt. It is the composition.** `approved_by: marco` records *whose
authority*, not who looked; label removal does not clear RULE 2; and a receipt satisfies CP-26 by
*existing*, not by being verified — `nothing-verifies-a-merge-approval-receipt-2026-09-07.md` is
already open on exactly that. So a PR touching `apps/api` permission code now presents, to any
instrument a future run is likely to reach for, as fully released — while §10.1 step 1 says it is
not. The one thing standing between #1823 and an automated merge is a log line in a **gitignored**
directory.

**A scheduled run cannot clear this and must not try.** RULE 2 is cleared by Marco in chat, for that
batch only; I am headless and heard nothing. The release this receipt describes belongs to the
supervised lane that held it.

**DISPOSITION: ACTIONED (as a safety record) + DEFERRED (as a fix)** — actioned in that the
composition is now written down against SHA `d0bfb30c` with its measurement, so the next run meets
it as a known hazard instead of re-deriving "green + unlabelled + receipt ⇒ merge it". Not escalated
as new: both halves are already open (`nothing-verifies-a-merge-approval-receipt-2026-09-07.md`,
`label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md`) and re-raising them would
add noise to a queue of 52. **I did not merge #1823 and no scheduled run should.**

### F3 — a SPENT prompt was still tracked on `main` and armable-in-principle (S3)

`pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md` — `lint-prompt.mjs` exit **3**, `STALE`, *"Premise no
longer holds … NAV-1..NAV-4 are all merged. The charter describes a sidebar that no longer exists."*
The work shipped weeks ago. [MEASURED] still tracked: `git ls-tree -r --name-only origin/main --
docs/pr-prompts/` lists it. This is the stays-armable-forever class my 03:08Z run also found one
instance of.

**DISPOSITION: ACTIONED** — `git mv`-ed to `docs/pr-prompts/superseded/` in this run's board PR,
read back as `R` in `git status --porcelain`. Retiring is not arming, and the file is queue hygiene
under `docs/pr-prompts/` (00's lane) rather than `/sot/` content (05's), despite the `pr-sot-` name.

### F4 — `pr-vmgitguard-selftest-and-recursion-HOLD.md` is a duplicate of OPEN PR #1832, and I deliberately did NOT retire it (S3)

The HOLD is still tracked on `origin/main` while the same work sits in open PR #1832 — its own
consumed `-ready.md.log` in `processed/` is what opened that PR. It currently lints `REJECT
[HUMAN_GATE_PRESENT]`, so it cannot be armed today and is not an immediate duplication hazard.

**DISPOSITION: DEFERRED, and the reason is a rule worth stating: §10.6 says a second-lane prompt's
premise dies on MERGE, not on OPEN.** Retiring a prompt whose PR is still open would destroy the
queue's only copy of that work if #1832 is ever closed unmerged. It becomes a one-line retirement
the moment #1832 merges — and if #1832 closes unmerged instead, the HOLD is exactly what should
survive.

### F5 — the Cowork VM/bash transport failed again; this is the third consecutive station run (S3, environmental)

[MEASURED] two attempts, identical `RPC error -1 … Plan9 share "c" which is not mounted`. Already
escalated twice over — `needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md` (my own
03:08Z F4) and `needs-marco/linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md`.

**DISPOSITION: DEFERRED — deliberately NOT re-escalated.** Two open files already carry it and a
third would be noise. The datapoint that matters and is recorded here: the failure is **consistent,
not intermittent**, and it costs a sighted run nothing except `vm-git-guard.sh`, which has no work to
do when no VM-side call is possible. It would cost a **blind** run its entire COLLECT, because the
mount is that run's only transport.

### F6 — `pollForBehindPrs` rebuilt #1823 eleven times in three hours (S3, measured datapoint on an open escalation)

[MEASURED] from `gh pr view 1823 --json commits`: **11** consecutive `Merge branch 'main' into
feat/ea-gate-reporting-team-permission` commits authored `GH-Mantova`, from 00:21:25Z to 03:29:12Z —
one after each board PR merge. Each re-runs 15 CI checks on a PR no automation is permitted to merge.

**DISPOSITION: DEFERRED** — already open as
`needs-marco/hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md`, whose own note says the counts
are STATE and must be re-measured rather than quoted. This is that re-measurement: the rate is now
~1 rebuild per board PR per waiting PR, and with 00 hourly it scales with my own cadence.

## WHAT I DID NOT DO

- **Did not merge either open PR.** Both carry a live watcher `marco:true`. RULE 2 is not overridden
  by green, by CLEAN, by an absent label, by a passing CP-26, or by a receipt — and a scheduled run
  cannot receive the chat clearance that would lift it.
- **Did not arm anything.** 0 of 9 gate-satisfied HOLDs is tests-or-docs only; arming would have
  lengthened Marco's queue, which is the failure this pipeline has already paid for.
- **Did not touch the `do-not-merge` label** on anything, in either direction.
- **Did not author a merge-approval receipt.** A scheduled run never may.
- **Did not clear the 10 `[STALE]` dead escalations** the sweep §5 names
  (`pr-1532-review-fix`, `pr-1593-review-block`, `pr-1633-review-block`, `pr-1646-review-block`,
  `pr-1662-destructive-migration…`, `pr-1685-review-fix`, `pr-1740-released-with-no-receipt`,
  `pr-1756-review-block`, `pr-1774-released-but-cp26-demands-a-receipt`,
  `pr-1777-is-green-…` / `pr-1777-review-fix`). `needs-marco/` is gitignored, so this cannot travel
  in a PR and helps no other reader; it is already **DISPATCHED to 03** as clone/queue hygiene and
  re-doing it here would be LL-38. Discharge by MOVING to `needs-marco/discharged/`, never deleting.
  ⚠️ `agent-authored-rule-2-clearance-2026-09-04.md` is **not** in that list and must not be swept
  with it.
- **Did not archive collected breadcrumbs.** Every breadcrumb in the queue root is from the current
  cycle (last ~24 h), which the contract says to leave in place; and archiving leaves an untracked
  root copy that the next run can mis-read as unreported.
- **Did not prune the 8 non-main worktrees**, including `C:/po-vg` (8418 min old, **1 uncommitted
  file**). It holds unpushed work for an open escalation and `git worktree remove` will refuse while
  `--force` would discard it. 03's lane, already escalated.
- **Did not fast-forward the watcher clone** (`branch=main dirty=2`). 00's own ABSOLUTE forbids
  `git merge` there; it is 03's, and `nobody-may-fast-forward-the-watcher-clone-2026-09-07.md` is
  open on the fact that this belongs to nobody.
- **Did not run `bring-up-to-speed.ps1`** in addition to `status-sweep.ps1`. The PREFLIGHT-mandated
  sweep already returned a `[LIVE]` picture and a §7 verdict; running the second entry point would
  have re-derived the same state at real token cost, which §7 of my own station doc tells me not to do.
