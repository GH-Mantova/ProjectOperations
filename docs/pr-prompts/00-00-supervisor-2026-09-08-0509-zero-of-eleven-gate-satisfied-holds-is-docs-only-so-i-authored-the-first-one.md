# Station 00 — Supervisor | 2026-09-08T05:09Z–2026-09-08T05:5xZ

**SIGHTED RUN.** Desktop Commander reached the box on the first call. Everything below that is
tagged `[MEASURED]` was measured on the Windows host in this session.

## GROUND

```
UTC            2026-09-08T05:09:39Z
origin/main    400560d0            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 400560d0     C:\ProjectOperations2   (was e185e244, 4 behind; fast-forwarded this run)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — full authority, not read-only.

**Which tree the binding documents were read in, and why the working copy was safe to read.**
All three were read from `C:\ProjectOperations2` after the fast-forward, and the freshness claim is
`git diff --numstat origin/main -- <path>` returning EMPTY for each of
`docs/pipeline/stations/00-supervisor.md` (1299 lines), `docs/pipeline/DOCTRINE.md` (1751) and
`docs/pipeline/STATION-CAPABILITIES.md` (459). EMPTY output is the real answer (PREFLIGHT step 2);
no piped hash was taken, in either direction.

**Device-bridge git guard, installer's last line quoted verbatim, pass:**

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

## WHAT I MEASURED

**[MEASURED] Sweep verdict — `SAFE TO ACT`.** `status-sweep.ps1` captured to a file
(`C:\po-sup-fix-scripts\sweep-0508.txt`, 58,874 chars as read back with
`[IO.File]::ReadAllText`). Its section 7 line, verbatim: *"SAFE TO ACT: no board mutation in
progress, no recent remote activity, no live station worktrees."* Section 3: `index.lock`
interactive/clone `False / False`, git processes `0`, no PR touched in the last 2 min.
⚠️ **The file is UTF-16LE** — `*>` redirection in PS 5.1, DOCTRINE section 9.3 — so Desktop
Commander's `read_file` line count is roughly double the truth and reports the file as ending
mid-section 5. It does not. Read it with `[IO.File]::ReadAllText`, and never conclude the sweep
returned early from a line count taken off that file.

**[MEASURED] Watcher.** node RUNNING pid 31660, auto-restart wrapper alive (1), heartbeat 21 min
(ticks only mid-run; stale + empty queue = idle, not wedged). Clone `branch=main dirty=4`.
Non-main worktrees: 1 — `C:/po-vg` at `23c91ba9 [fix/no-rebase-while-checks-run]`, dirty=1,
age 5597 min. That orphan is already escalated and already carries Station 04's measurement; not
re-raised.

**[MEASURED] Freshness, crossed against `lastRunAt`.** `check-breadcrumb.mjs --freshness` run
unpiped, exit **0**, `CLEAN`: `00` 1.1 h · `03` 6.2 h · `04` 3.1 h · `05` 15.0 h, all `ok`.
Crossed against the scheduled-tasks MCP, which is the instrument the breadcrumb cannot replace:
`00` lastRunAt `05:08:37Z` (this run) · `03` `2026-09-07T23:01:27Z` against a 23:03Z breadcrumb ·
`04` `02:10:15Z` against 02:10 · `05` `2026-09-07T14:11:15Z` against 14:12. Every station's
`lastRunAt` and newest breadcrumb are aligned to the minute. **No station is SILENT and none has a
fresh `lastRunAt` with no report.** `weekly-security-audit` is enabled, lastRun `2026-09-06T21:32Z`,
next `2026-09-13` — on cadence, nothing owed.

**[MEASURED] Board — three open PRs, all three PARKED ON MARCO'S LABEL.**

| PR | created | head | files | labels | classification |
|---|---|---|---|---|---|
| `#1809` | 04:36:50Z | `claude-github-action-workflow` | `.github/workflows/claude.yml` | `do-not-merge` | MARCO'S |
| `#1810` | 04:36:58Z | `sot-01-nav5-reconcile` | `sot/01-charter-and-architecture.md` | `do-not-merge` | MARCO'S |
| `#1811` | 04:37:07Z | `sot-05-d24-theme-sequencing` | `docs/plans/theme-system-plan.md`, `sot/05-decisions-and-lessons.md` | `do-not-merge` | MARCO'S |

**Their reds are the documented one-cause pair, and there is no work behind them.** Each shows
`Approval receipt (CP-26)=FAILURE` and `PR gates — diff checks=FAILURE`. Read from **column 3** of
the CP-26 job log for `#1811` (run `34189305348`, job `101943890670`, 219 lines, split on tab, last
field), verbatim:

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

POSITIVE control on the same column-3 projection: `approval` matched 7 lines. NEGATIVE control, a
freshly minted needle, matched 0. `[LABEL_PRESENT]` is PARKED BY DESIGN — not
`[RELEASED_NO_RECEIPT]`, which would be a real finding. Only Marco removes the label. **There is no
agent-side action behind any of these three reds, and this run took none.**

**[MEASURED] RULE 2, live tree, pinned, prompt logs only.** `docs/pr-prompts/processed\pr-*.log` in
`C:\ProjectOperations2` — never the clone. `PR #1809` → **0**, `PR #1810` → **0**, `PR #1811` → **0**.
POSITIVE control `marco.:true` over the same corpus → **620**. NEGATIVE control
`zzQq00N20260908T0522` → **0**. Control that `NO LOG` is not a broken probe: `PR #999999` → **0**.
Corpus freshness: newest log in that directory is `rev-1809-ready.md.log`, written `04:49:47`
local — younger than every open PR. Recorded as `[NO LANE VERDICT — hand-classified]`.

**[MEASURED] And the lane is not a hand-classification this time — the authoring commits name it.**
Per DOCTRINE section 10.2.1, read from the PR's own commit list rather than from `main`:

| PR | first commit | `author.name` |
|---|---|---|
| `#1809` | `c076d52e` 04:36:44Z | **`Claude Opus 5 (station-00 cloud lane)`** |
| `#1810` | `8d9f289b` 04:36:52Z | **`Claude Opus 5 (station-00 cloud lane)`** |
| `#1811` | `62fd4bba` 04:37:01Z | **`Claude Opus 5 (station-00 cloud lane)`** |

Corroborated by the instrument the watchdog kill loop cannot erase: `.arming-log.txt`'s last row is
`2026-09-07T23:32:16Z ARMED pr-doctrine-s9-powershell-readonly-automatic-variables`, **no arm inside
any of the three PRs' windows**, and the single-lane watcher cannot open three PRs seventeen seconds
apart. Second lane, positively identified.

**[MEASURED] `pollForBehindPrs` again, twice, on PRs nothing can merge.** Both later commits on each
of the three PRs are `Merge branch 'main' into <head>` as `GH-Mantova`, at **04:49:19–04:51:20Z** and
again at **05:05:19–05:05:24Z** — six rebuilds across three PRs, every one of which carries
`do-not-merge` and therefore cannot merge whatever the rebuild achieves. One more datapoint on the
standing escalation; not re-raised.

**[MEASURED] Queue.** `armed: 0`. 39 `-HOLD.md` at depth 1. `triage-holds.ps1` (read-only, exit 0,
both its own controls PASS — git read of DOCTRINE 136,688 chars, and the SPENT fixture emitting
exit 3): **spent=4 · gates-satisfied=11 · still-gated=24 · unreadable=0**, and 3 of the 11 flagged
as possible duplicates of an open PR by the check that landed in `#1805` two hours ago.

## WHAT CHANGED

**One board PR, `docs/pr-prompts/` only, opened from a disposable worktree off `origin/main` at
`400560d0` (`C:\po-wt\board-0508`, `git status --porcelain` empty at creation).** Five changes:

1. **Swept the 04:09Z blind run's breadcrumb** into the repo. It was untracked in the dev tree and
   said so; a blind run cannot open the PR that tracks it. Copy verified byte-identical before
   staging: `git hash-object` in both trees → `e0959be0` on each side.
2. **Retired the four SPENT prompts** `triage-holds.ps1` measured, by `git mv` into
   `docs/pr-prompts/superseded/`: `pr-ci-gate-dead-queue-dir-reads`, `pr-linefields-s4-scenario-picker`,
   `pr-triage-holds-open-pr-duplicate-bucket`, `pr-tr-s3-manager-escalation`. All four are lint
   exit 3 — premise already satisfied, work shipped, in `#1804 · #1803 · #1805 · #1802` respectively.
3. **Published the uncommitted amendment to `pr-ea-s2-dashboard-preset-HOLD.md`.** See F2.
4. **Authored one new `docs/`-only prompt**, `pr-stationcaps-blind-run-names-one-mount-HOLD.md`
   (lint **ADMIT**, size 1). See F1.
5. **This breadcrumb**, written inside the PR worktree — cure 1 of the station doc's
   delete-the-disk-copy rule, so no loose copy of it is ever left in the dev tree.

**Nothing else.** No arm, no merge of anyone else's PR, no label added or removed, no watcher
action, no `sot/` edit, no production data, no Azure/Entra/SharePoint, and no `git` of any kind in
`C:\po-watcher\ProjectOperations`.

## FINDINGS

### F1 — 0 of 11 gate-satisfied holds is `tests|docs`-only, so I stopped reporting the starvation and wrote the first prompt that ends it

The 02:08Z run measured **0 of 39** holds able to enter the auto-merge lane. This run measured the
tighter and more useful number: of the **11** prompts `lint-prompt.mjs` currently ADMITs, **0** have
a scope confined to `tests/` or `docs/`. [MEASURED] by parsing each prompt's `scope:` block:

| ADMIT prompt | a scope entry that decides it |
|---|---|
| `pr-brandtheme-s1-apply-the-saved-scheme` | `apps/api/src/modules/branding/branding.controller.ts` |
| `pr-company-manage-s1-permission-and-grant` | `apps/api/prisma/migrations/**` |
| `pr-e2e-container-s2-swap-required-job` | `.github/workflows/playwright.yml` |
| `pr-ea-s2-dashboard-preset` | `apps/api/prisma/seed.ts` |
| `pr-fv2-maintenance-usage-intervals` | `apps/api/prisma/schema.prisma` |
| `pr-rateparity-s1-harness` | `apps/api/src/modules/rates/charge-step-parity.service.ts` |
| `pr-rates-consumers-s3-persona-export` | `apps/api/src/modules/personas/tools/handlers/lookup-rate.handler.ts` |
| `pr-tfm-s11-copy-recursive-preserve` | `apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts` |
| `pr-claude-github-action-workflow` | `.github/workflows/claude.yml` — and a duplicate of `#1809` |
| `pr-sot-01-nav5-reconcile-2026-08-20` | `sot/01-charter-and-architecture.md` — and a duplicate of `#1810` |
| `pr-sot-05-d24-theme-sequencing-reconcile` | `sot/05-decisions-and-lessons.md` — and a duplicate of `#1811` |

Six of the eight non-duplicates also carry `escalates: true`, so their PR is labelled `do-not-merge`
on open and parks on Marco a second way. **Every arm available on this board today lands on Marco,
and arming faster makes his queue longer rather than shorter.**

🔧 **So the useful act was to create eligible work, not to report its absence for a fourth
consecutive run.** `pr-stationcaps-blind-run-names-one-mount-HOLD.md` is in this PR: scope is
`docs/pipeline/STATION-CAPABILITIES.md` alone, `size: 1`, `escalates: false`, `gate_allow: none`,
lint **ADMIT**. Its content is the 04:09Z run's F3 — the blind-run ceiling names one mount while the
session has eleven, which costs a blind run the `opened PR #<n>` lane discriminator and two of the
three verdict homes DOCTRINE section 9.5 requires. It is `docs/`-only, so `classifyPolicyFiles`
admits it and the `tests-docs` lane can carry it with no human.

⚠️ **It is not armed yet, deliberately.** `arm-prompt.ps1` moves a **tracked** `-HOLD.md`, and this
one is tracked only once this PR merges. The arming decision must then be re-taken at the moment of
the `git mv` — never inherited from this breadcrumb — including a fresh `triage-holds.ps1` duplicate
sweep, because the 03:08Z run measured a prompt becoming a duplicate *between* its duplicate check
and its arming window.

⚠️ **Falsifying probe for the starvation claim, and it is cheap:** re-run `triage-holds.ps1` and
parse the `scope:` block of every prompt in its GATES SATISFIED bucket. If any scope is confined to
`tests/` or `docs/`, the lane is not starved and this finding is wrong.

**DISPOSITION: ACTIONED** — the prompt is authored, linted ADMIT and in this PR. The arm is the next
sighted run's, or mine after this PR merges.

### F2 — a 116-line amendment to a held prompt sat uncommitted in the shared dev tree, so its ADMIT was computed against text no clone could see

[MEASURED] at the top of this run, before the fast-forward:
`git diff --numstat -- docs/pr-prompts/pr-ea-s2-dashboard-preset-HOLD.md` → **`116  0`**. Insertions
with **zero** deletions — DOCTRINE section 9.2's discriminator for *"the working copy is a strict
superset of `main` and something in it has not landed yet"*, which is exactly the shape on which
restoring to HEAD is a **deletion, not a repair**.

The uncommitted text is an `AMENDMENT 2026-09-08` recording that **Marco reviewed and approved the
mock-up at the prompt's `design_ref` and asked that the staged PR reflect it**, quoted in his own
words inside the prompt. That is a design decision — the one class DOCTRINE section 10.4 says must
be settled *before* the prompt is armed — and it was living in one working tree.

🔴 **The consequence is the stale/ahead-dev-tree trap in its second direction.** `lint-prompt.mjs`
greps `premise:` against the **working tree**; only the `requires_*` gates read `origin/main`. So
`pr-ea-s2-dashboard-preset` has been reading ADMIT on this box against a body **no clone, no CI and
no other station could see** — and had it been armed from any other tree, the agent would have built
the pre-amendment prompt and shipped a screen Marco had already replaced.

🔧 **Cured the additive way: published it.** The file is committed in this PR unchanged.
**Committing a `-HOLD.md` cannot start work** — the watcher globs `-ready.md` — so publishing costs
nothing and removes the divergence. Restoring to HEAD would have destroyed Marco's amendment
silently, and every read-back would still have passed.

⚠️ **Falsifying probe:** `git diff --numstat origin/main -- docs/pr-prompts/pr-ea-s2-dashboard-preset-HOLD.md`
after this PR merges. EMPTY is the real answer; anything else means a second actor has edited it
again and the same trap is live.

**DISPOSITION: ACTIONED** — verified byte-identical into the worktree (`0aa3413b` both sides) and
committed.

### F3 — four prompts whose work shipped hours ago were still ADMIT-able, and all four shipped in PRs that did not delete them

[MEASURED] `triage-holds.ps1`, SPENT bucket, lint exit 3 on each:
`pr-ci-gate-dead-queue-dir-reads` · `pr-linefields-s4-scenario-picker` ·
`pr-triage-holds-open-pr-duplicate-bucket` · `pr-tr-s3-manager-escalation`. Their work is on `main`
as `#1804` (03:25Z), `#1803` (04:10Z), `#1805` (05:03Z) and `#1802` (04:27Z) — every one of them
merged within the last two hours.

This is the **stays-armable-forever** defect, which is on file as unstaged: a prompt whose PR does
not delete it stays in the queue with its gates open. Here the mechanism is sharper than usual —
all four were built by the second lane, and DOCTRINE section 10.6 records that a second lane does
not consume the prompt it builds. The SPENT check caught all four unaided, which is the part of the
system working.

🔧 **Retired all four to `docs/pr-prompts/superseded/` in this PR** by `git mv`, which is the
disposition `triage-holds.ps1` itself prescribes for the SPENT bucket.

**DISPOSITION: ACTIONED.**

### F4 — the second lane opened three more PRs and consumed none of their prompts, and the new duplicate check caught all three

`#1809 · #1810 · #1811` were opened by `Claude Opus 5 (station-00 cloud lane)` within 17 seconds at
04:36–04:37Z. `triage-holds.ps1`'s POSSIBLE DUPLICATES bucket — the feature that merged as `#1805`
at 05:03Z, roughly ninety minutes after those PRs opened — flagged all three of their prompts:
`pr-claude-github-action-workflow` (1 of 1 against `#1809`), `pr-sot-01-nav5-reconcile-2026-08-20`
(1 of 1 against `#1810`), `pr-sot-05-d24-theme-sequencing-reconcile` (2 of 2 against `#1811`).

**This is the same shape the 03:08Z run reported for four PRs, one cycle later and with an
instrument that now sees it.** The check is doing its job on its first live board. The **defect** is
unchanged and is not the check's: a second lane does not consume its prompt, so every PR it opens
leaves an armable duplicate behind.

⚠️ **These three are NOT retired here.** The premise dies on MERGE, not on OPEN (section 10.6), and
all three PRs are open and parked on Marco's label. Retiring them now would discard live prompts if
he closes any of those PRs unmerged. They stay held, annotated by the instrument, and the next run
that finds those PRs merged should retire them the way F3's four were retired.

**DISPOSITION: DEFERRED** — with the trigger named: retire on merge, not before.

### F5 — the 04:09Z blind run's F1 is real, unlanded, and outside my lane to fix

The blind run measured `check-breadcrumb.mjs --freshness` reporting `03` and `05` as
`NO BREADCRUMB EVER` because `tracked()`'s two probes are both `git`, the device-bridge guard
correctly refuses `git` against the mount, and the function then computes freshness from
`readdirSync(DIR)` alone — depth 1 — so a station reads SILENT exactly when its newest breadcrumb
has been archived. Its fix is written out in full in that breadcrumb, and it is additive.

I re-ran the same instrument from the **sighted** side this run: exit 0, `CLEAN`, all four stations
dated. **That is the control the blind run could not take, and it confirms the failure is
transport-specific rather than a defect in the data.**

🔴 **It is `scripts/pipeline/check-breadcrumb.mjs`, so `classifyPolicyFiles` refuses it however many
test files ride along: it is Marco's.** Folding it into this docs-only PR would make this PR Marco's
too, and cost the board its one auto-merge-eligible change this cycle.

**DISPOSITION: DEFERRED** — successor named, scope known, and deliberately kept out of this PR so
that F1's prompt stays `docs/`-only. It should be staged as its own prompt with the 0409 run's F2
(breadcrumb filenames stamped for a slot the run never occupied) folded in as a second assertion in
the same file — same script, same PR.

### F6 — blindness recurred at 04:09Z; this run was sighted

The 02:08Z and 04:09Z runs were blind (`CONNECT_TIMEOUT after 30000ms` after a proper load); 03:08Z,
its 03:43Z addendum and this 05:09Z run were sighted. Four of the last five hourly occurrences are
therefore known, and two of them were blind. The cause remains unknown and the rate remains
unmeasurable from breadcrumbs alone, because a run's blind-or-sighted declaration is prose rather
than a field.

**DISPOSITION: ESCALATED** — already on file, **not re-raised**. One datapoint attached: sighted at
05:09Z, Desktop Commander available on the first call after a keyword `ToolSearch`.

## WHAT I DID NOT DO

- **Did not merge, or attempt to merge, any of `#1809 · #1810 · #1811`.** All three carry
  `do-not-merge`; only Marco removes it, and their CP-26 verdict token is `[LABEL_PRESENT]`, which
  is parked by design and not work.
- **Did not remove or add a label on anyone's PR**, and did not re-run their checks. A rerun on a
  `[LABEL_PRESENT]` failure cannot change the verdict.
- **Did not arm anything.** `armed: 0` on entry and on exit. The one prompt worth arming is in this
  PR and is not tracked until it merges; the decision belongs at the moment of the `git mv`.
- **Did not retire the three prompts duplicated by open PRs** — F4, the premise dies on merge.
- **Did not touch `C:\po-vg`.** It holds one uncommitted file, `git worktree remove` will refuse,
  and `--force` would discard it. Already dispatched to Station 03 with Station 04's measurement.
- **Did not restart, kill or otherwise touch the watcher.** It is RUNNING with a live wrapper and an
  empty queue; an idle watcher with 0 armed prompts is correct, not wedged.
- **Did not run `git` in the watcher clone**, did not run `git` against the mount, and did not
  work around the guard.
- **Did not touch `/sot/`, production data, Azure, Entra or SharePoint.**
- **Did not archive the four already-collected breadcrumbs** in the queue root. Archiving inside a
  worktree leaves the dev tree's own copy at the root path, which the next run then re-commits as a
  second tracked copy — measured 2026-09-07. Deferred until it can be done together with the
  dev-tree cleanup the station doc prescribes.

**Needle minted and spent:** `zzQq00N20260908T0522`. It is in a tracked file now and is unusable
again — mint a fresh one.

---

**Validator.** `node scripts/pipeline/check-breadcrumb.mjs` — quote its exit code in the PR body,
never a `lint-prompt.mjs` result, which returns no meaningful verdict on a breadcrumb in either
direction.
