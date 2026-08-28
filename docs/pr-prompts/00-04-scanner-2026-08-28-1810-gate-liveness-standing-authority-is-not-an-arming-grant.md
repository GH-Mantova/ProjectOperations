# Station 04 — Scanner | 2026-08-28T18:10Z–2026-08-28T18:22Z

## GROUND

```
UTC            2026-08-28T18:10:36Z
origin/main    1032afba            (fetched, then rev-parse)
dev tree       main @ 82ba8538      C:\ProjectOperations2   (5 behind, 0 ahead)
doc version    1
bootstrap      1
```

Versions AGREE — full-authority run. Sweep taken: **`gate-liveness`** (rotation position 1 of 4,
`node scripts/pipeline/next-sweep.mjs`; previous run 2026-08-28T14:10:58Z = instruction-drift).

---

## WHAT I MEASURED

**Instrument.** `C:\po-sup-fix-scripts\gate-liveness-scan.mjs` — written this run, OUTSIDE the repo,
read-only. It parses depth-1 prompt front matter with its own folder (lint-prompt.mjs collapses
block scalars to the bare `>-`, 04 @2026-08-28T10:10Z), evaluates every `requires_merged` /
`requires_file_on_main` / `requires_on_main` gate against **origin/main @ 1032afba by name**
(`git cat-file -e <SHA>:path`, `git show <SHA>:path`, `gh pr view N --json state,mergedAt`), and
executes every `premise` under Git-for-Windows bash. BROKEN is kept as a third state (DOCTRINE §7).

`[MEASURED]` **Positive AND negative controls, all seven, before any reading was believed:**

```
file_present  CLAUDE.md                  => PRESENT
file_absent   no/such/file-zzz.md        => ABSENT
needle_present CLAUDE.md :: ProjectOperations   => PRESENT
needle_absent  CLAUDE.md :: ZZZ-NOT-IN-FILE-ZZZ => ABSENT_NEEDLE
premise_pass  `exit 0`                   => PASS
premise_fail  `exit 1`                   => FAIL
pr_merged     #1384                      => MERGED
```

`[MEASURED]` **Reproduced twice.** Run 1 (18:12Z) and run 2 (18:16Z) produced byte-identical
reports (`Compare-Object` → no differences). 2 of 2.

`[MEASURED]` **81 depth-1 prompts** (`*-HOLD.md` 81, `*-ready.md` **0**). **52 gate evaluations:**

| result | n |
|---|---|
| `requires_on_main` => PRESENT | 15 |
| `requires_on_main` => ABSENT_NEEDLE | 15 |
| `requires_on_main` => ABSENT_FILE | 1 |
| `requires_file_on_main` => ABSENT | 11 |
| `requires_file_on_main` => PRESENT | 2 |
| `requires_merged` => MERGED | 8 |
| **BROKEN** | **0** |
| **PR CLOSED-not-merged (dead gate)** | **0** |

`[MEASURED]` **gate verdict × premise matrix, 81 prompts:**

| | premise PASS (work still needed) | premise FAIL (work already done) |
|---|---|---|
| **gate SATISFIED** | **11** | **14** |
| **gate HELD** | 27 | **0** |
| **NO_GATE** | 22 | **7** |
| **gate BROKEN/DEAD** | 0 | 0 |

`[MEASURED]` **The dev-tree lag cannot have skewed a premise.** `git diff --name-only HEAD
origin/main` = 13 paths, ALL under `docs/`, `sot/` or `docs/qa/` — **zero source files**. No premise
greps any of them. (This is the check that makes "premise run in the dev tree" ≠ "premise run
against a stale tree".)

`[MEASURED]` **Index CLEAN.** `git diff --cached --name-status` → empty. Two plain ` D` entries in
the working tree, **no `RD` half-arm** — the 2026-08-28T16:21Z half-arm class has **not** recurred:

```
 D docs/pr-prompts/pr-lint-armed-gate-inversion-HOLD.md                       -> consumed, built #1377
 D docs/pr-prompts/pr-station-contract-breadcrumb-validator-and-qa-claim-HOLD.md -> consumed, built #1382+#1383
```

Both are **consumed** (each has an open PR). Per the ` D` triage rule: **LEAVE them.**

`[MEASURED]` `status-sweep.ps1` @18:10:52Z: SAFE TO ACT · armed 0 · `index.lock` false/false ·
0 git processes · watcher node RUNNING pid 26364, wrapper alive, heartbeat 118 min (idle, empty
queue — not wedged) · 4 orphaned worktrees, unchanged · OPEN PRs 3.

`[MEASURED]` **#1377's red is the label, and nothing else.** `gh run view 33189647324 --job
98911553779 --log`: every CP passes — CP-12, CP-13, CP-17, CP-23, CP-24, CP-25 PASS; CP-09/10 and
CP-22 SKIP — and the single failure is

> `FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true). A human must
> review and REMOVE the label; removing it is what releases the merge.]`

`mergeStateStatus: UNSTABLE`, label `do-not-merge`. **The RED is CP-26 doing its job, not a defect.**

`[MEASURED]` `scripts/pipeline/check-d-register.mjs` **exists on origin/main** and carries
`export const D_REGISTER_MODE = "WARN_ONLY";` — D-namespace slice 4 has landed.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved or deleted. No PR touched. No
`sot/` file read-modified. Two files written, both OUTSIDE the repo except where noted:

- `C:\po-sup-fix-scripts\*.mjs` — this run's instruments (scratch, not the repo).
- **this breadcrumb** — `docs/pr-prompts/00-04-scanner-2026-08-28-1810-…md`, **UNTRACKED**.
- `docs/pipeline/sweep-rotation.json` — advanced via
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-08-28T18:10:36Z`. **Uncommitted.**
  🔴 **Station 00: commit the rotation file WITH this breadcrumb, or the next 04 run repeats
  `gate-liveness` and the rotation silently stops.**

---

## FINDINGS

### F1 — The sweep's named target comes back CLEAN: there are no dead gates. `[MEASURED]`

52 gate evaluations across 81 depth-1 prompts. **0 BROKEN, 0 pointing at a closed-not-merged PR,
and 0 prompts in the `HELD` × `premise FAIL` cell** — i.e. **no gate anywhere on the board is
masking finished work**, which is the specific failure this sweep exists to catch. All eight
`requires_merged` targets (#1111, #1257, #1317, #1348, #1350, #1351, #1356, #1361) are genuinely
MERGED with timestamps. Reported with the seven controls above, because a clean negative from an
uncalibrated instrument is worth nothing (DOCTRINE §7).

**DISPOSITION: ACTIONED** — sweep executed and answered; nothing to repair.

### F2 — 21 of 81 root HOLDs are SPENT: their premise is dead. `[MEASURED]`

Finished work still sitting on the board. **An independent instrument agrees with the 1010 run's
lint census (21 exit-3) exactly — 21 = 21**, arrived at by executing premises rather than by
reading lint exit codes. This run also splits them, which the lint census could not:

**Gate SATISFIED + premise DEAD (14)** — the gate released and the work landed anyway:
`pr-crm-lastmile-s1-unblank-todos-and-notes` · `pr-crm-s2-nav-three-items-tabs` ·
`pr-crm-tender-count-truth` · `pr-crm-wincount-s2-close-bypasses` · `pr-dns-s2-ea-series` ·
`pr-dns-s3-sot06-widgets-and-marker` · `pr-dns-s4-checker-warn-only` ·
`pr-ew-s2b-alloc-engine-core` · `pr-guard-s1-verdict-file-list` ·
`pr-guard-s2-prompt-search-by-branch` · `pr-guard-s3-file-gate-not-released` ·
`pr-lessons-folder-s2-unfold-sot05` · `pr-lessons-folder-s3-ref-checker` ·
`pr-pipeline-fold-s2-merged-page` (all `-HOLD.md`).

**Ungated + premise DEAD (7)**: `pr-breadcrumb-gitignore-gate-routing-not-mention` ·
`pr-ci-windows-pipeline-tests` · `pr-comms-hub-inbox` · `pr-dns-s1-tfm-series` ·
`pr-lint-human-gate-blindness` · `pr-queue-bin-guard-orphaned-discharge` ·
`pr-sot-02-reconcile-2026-08-19`.

Two spot-verified by hand against `origin/main`, not just by exit code:
`! grep -q "HUMAN_GATE" scripts/pipeline/lint-prompt.mjs` → **8 hits on main** (work shipped);
`! grep -q "ROUTING_VERBS" scripts/pipeline/check-breadcrumb.mjs` → **2 hits on main** (#1374).

`docs/pr-prompts/superseded/` exists and holds 24 files, so the destination is established.

**DISPOSITION: DISPATCHED → Station 00.** Move these 21 to `superseded/`, **never delete** — the
board trap is that a checkout re-arms a dead prompt. This is a queue-hygiene move, not an arm.

### F3 — 11 HOLDs are gate-SATISFIED **and** premise-ALIVE: this is the real arm-candidate list. `[MEASURED]`

| prompt (`-HOLD.md`) | gate | `## STANDING AUTHORITY` |
|---|---|---|
| `pr-crm-s3-account-on-client-create` | `ShellLayout.tsx :: CRM_NAV_TABS` PRESENT | granted |
| `pr-crm-wincount-s3-recompute` | #1350 MERGED | granted |
| **`pr-dns-s5-checker-flip-to-fail`** | #1361 MERGED | granted — **🔴 SEE F4, DO NOT ARM** |
| `pr-e2e-container-s2-swap-required-job` | #1317 MERGED | granted |
| `pr-ew-s2c-alloc-rejection-path` | `allocation.service.ts :: allocatePool` PRESENT | granted |
| `pr-fv2-maintenance-usage-intervals` | `schema.prisma :: model AssetUsageReading` PRESENT | **NOT granted** |
| `pr-pipeline-nodrift-agents-write-sweep-commits` | #1351 MERGED | granted |
| `pr-queue-armed-tracked-detector` | `ci.yml :: check-sot-refs` PRESENT | granted |
| `pr-rates-11b2-resolver-isactive-surface` | #1348 MERGED | granted |
| `pr-rates-consumers-s3-persona-export` | #1257 MERGED | granted |
| `pr-unified-api-key-vault-slice4c-retire-old-screens` | #1111 MERGED | granted |

None is on `queue-sync.ps1`'s `$Forbidden` denylist (`rates-s11c`, `site-dissolution`,
`b-p0a-4-ii`, `b-p0a-5..8`, `b-sd` — read from source, lines 79-84).

**DISPOSITION: DISPATCHED → Station 00.** RULE 4 still binds: **arm ONE AT A TIME**, and this list
is a gate+premise reading, **not** an armability verdict — F4 is why, and **F7 says arm none of
them until the agent lane is proven alive.**

### F4 — 🔴 `## STANDING AUTHORITY` IS NOT AN ARMING GRANT. 8 prompts carry both it and a human arming gate. `[MEASURED]`

The standing rule reads: *"THE RELIABLE TEST IS POSITIVE: a safe-to-arm prompt GRANTS `## STANDING
AUTHORITY`."* **That is falsified — measured, 8 counterexamples on the current board:**

`pr-524-rates-b-slice2-canonical` · **`pr-dns-s5-checker-flip-to-fail`** ·
`pr-guard-s3-file-gate-not-released` · `pr-lint-human-gate-blindness` ·
`pr-nav-jobs-projects-merge` · `pr-rates-s11c-drop-legacy-tables` · `pr-siteid-notnull-backfill` ·
`pr-tenant-mt4-s2-ownership-migration`.

**The two are answers to different questions and were being read as one.** `## STANDING AUTHORITY`
grants the *agent, once armed*, permission to finish, commit, push and open the PR without asking.
It says nothing about whether **00 may arm it**. Reading the grant as an arming licence is the exact
shape of the 2026-08-28 mis-arm.

**The sharpest instance — and it is currently the most armable-looking prompt on the board:**
`pr-dns-s5-checker-flip-to-fail-HOLD` has gate SATISFIED (#1361 MERGED), premise ALIVE, `##
STANDING AUTHORITY` granted, and **`lint-prompt.mjs`'s `HUMAN_GATE_PRESENT` does not fire on it at
all.** Its arming gate is a prose sentence at line 31:

> *"**No gate can assert that a human read something.** Station 00 enforces it by not arming this
> slice until it has happened"*

— the precondition being *one clean warn-only run of `check-d-register.mjs` on main, read by a
human*. `D_REGISTER_MODE = "WARN_ONLY"` is on main, so slice 4 has landed and **only the human read
is outstanding.**

**Coverage, read from `lint-prompt.mjs` source (not assumed):** `HUMAN_GATE_PRESENT` matches exactly
three markers — `<!-- watcher: do-not-arm -->`, `DO NOT ARM`, `Arm ONLY`. It **fires on 6** of 81
prompts and **misses 6** that carry a prose arming gate:

| missed prompt | the phrase lint cannot see |
|---|---|
| `pr-dns-s5-checker-flip-to-fail` | `not arming this` · `HUMAN PRECONDITION` |
| `pr-devtree-sync-ff-only-guard` | `Why this is a HOLD` · `Arm only after` · `to ratify` |
| `pr-nav-jobs-projects-merge` | `Arm only after` |
| `pr-tenant-mt4-s2-ownership-migration` | `Marco arms` · `docs/approvals/` |
| `pr-guard-s3-file-gate-not-released` | `docs/approvals/` |
| `pr-rates-s11c-drop-legacy-tables` | `docs/approvals/` (also on the `$Forbidden` denylist) |

Note `Arm only after` is missed even though `Arm ONLY` is matched — the check is **case-sensitive**.

**DISPOSITION: ESCALATED → Marco**, with RULE 1 applied.

> **Option A (complete + additive — recommended, passes both halves).** Extend
> `HUMAN_GATE_PRESENT` to a case-insensitive union — `arm only`, `do not arm`, `not arming`,
> `human precondition`, `marco arms`, `to ratify`, `why this is a hold`, `docs/approvals/` — **and**
> add a rule that a prompt granting `## STANDING AUTHORITY` while also matching any gate phrase is a
> hard REJECT with both line numbers quoted, so the contradiction can never again read as a grant.
> Purely additive: it rejects more, never fewer, and touches no prompt content or data.
>
> **Option B (narrow).** Add only the phrases measured above. Fails the *future* half of RULE 1 —
> the union of ways to say "don't arm this" is open-ended prose, and this is the third time it has
> been widened after a miss.
>
> **Option C (do nothing, rely on 00's discipline).** Fails the *complete* half. A fresh 00 run has
> no memory; a rule that lives only in project memory is one compaction from being lost, and F4's
> `pr-dns-s5` case shows the positive test actively pointing the wrong way.

**Also DISPATCHED → Station 06:** `pr-lint-human-gate-blindness-HOLD` was the prompt for this and it
is **SPENT** (F2) — the narrow three-marker version already shipped. The coverage gap needs a **new**
prompt, not that one.

### F5 — `pr-fv2-maintenance-usage-intervals-HOLD` is gate-open and premise-alive but grants nothing. `[MEASURED]`

The only one of the 11 in F3 with **no `## STANDING AUTHORITY` block**. Under the standing reading
that is "not safe to arm"; under F4 the grant proves nothing either way. Flagged so it is not swept
up with the other ten on either reading. Its gate is `schema.prisma :: model AssetUsageReading`
PRESENT and its premise is `! grep -q "intervalUsage" apps/api/prisma/schema.prisma`.

**DISPOSITION: DEFERRED** — becomes urgent the moment 00 works down the F3 list; decide the grant
question (F4 Option A) first.

### F6 — 🔴 Station 00's own 18:09Z breadcrumb is MALFORMED and will red-light `check-breadcrumb` in CI on main. `[MEASURED]`

`node scripts/pipeline/check-breadcrumb.mjs` @18:20Z: **83 checked, 1 malformed** — and the one is
**not mine** (mine ADMITs). It is
`docs/pr-prompts/00-00-supervisor-2026-08-28-1809-execution-lane-down-on-expired-oauth.md`, exit 1:

```
REJECT  ... x missing section: ## GROUND / ## WHAT I MEASURED / ## WHAT CHANGED
                              / ## FINDINGS / ## WHAT I DID NOT DO
```

Verified independently with node (not `Get-Content`): the file is **clean UTF-8, 5039 bytes, no BOM,
0 × U+FFFD, 0 × the `â€` double-encoding signature** — the mojibake PowerShell shows on it is the
DOCTRINE §9.3 reader lie, **not** damage. The defect is purely structural: it uses free-form
headings (`## What I could and could not reach`, `## FINDING 1`, `## Dispositions`, `## Note on this
file`) instead of the five contract sections.

`check-breadcrumb.mjs` runs in CI on main. **Committing this file in a board PR reddens Pipeline
board-wide until it is fixed** — and it is currently UNTRACKED, alongside 7 other untracked
breadcrumbs waiting to be swept.

**DISPOSITION: DISPATCHED → Station 00.** Rename its headings to the five contract sections
**before** including it in the sweep-up PR, or hold it back from that PR. Do not bulk-land the
untracked breadcrumbs without re-running `check-breadcrumb.mjs` first.

### F7 — the agent lane's OAuth outage is NOT proven ongoing, and that changes what arming costs. `[MEASURED]`

Station 00 escalated at 18:09Z that every watcher agent run since 2026-08-28T16:13Z died on
`401 OAuth access token has expired`. **I am not re-raising it — it is already in front of Marco.**
I add the one measurement 00 could not make, because it was blind and I have a shell:

- `[MEASURED]` The 401 string appears in **8 files, all under `failed/`** — `rev-1382`, `rev-1383`,
  `rev-1384` (2026-08-28T16:13Z–16:20Z) plus one isolated 2026-07-31 event. Confirms 00's count.
- `[MEASURED]` **armed = 0 right now**, and the newest entry in `processed/` is
  2026-08-28T16:13Z. **Nothing has been fired since the outage began, so the lane has never been
  re-tested.** The outage is neither proven ongoing nor proven cleared — it is *unmeasured*.
- `[INFERRED]` My own `gh` and shell calls work, but that proves nothing about the watcher's
  Claude OAuth token; different credential, different lane. Not evidence either way.

**The consequence binds F3.** Retries used = 0: a 401 burns the prompt straight into `failed/`.
**Arming any of the eleven releasable HOLDs before the lane is proven alive destroys that prompt**,
and three of them (`crm-wincount-s3`, `e2e-container-s2`, `dns-s5`) are the ones next in line.

**DISPOSITION: DISPATCHED → Station 00.** Before arming anything from F3, prove the lane with **one
cheap, already-spent prompt** — not with one of the eleven. If it 401s again, that is Marco's
re-authentication and nothing should be armed until he has done it.

---

## WHAT I DID NOT DO

- **Did not arm, disarm, rename, move or delete any prompt.** 04 is READ-ONLY on the board.
- **Did not restore or touch the two ` D` files.** Both are consumed with open PRs; the triage rule
  says LEAVE. Touching them is the resurrection class.
- **Did not stage a `-HOLD` prompt**, though my lane permits one and F4 is exactly the kind of
  finding that earns it. **#1377 is open and modifies `scripts/pipeline/lint-prompt.mjs`, and
  `pr-lint-not-a-prompt-HOLD` is already queued against the same file.** A third prompt on
  `lint-prompt.mjs` guarantees a conflict and would land *after* both anyway. The exact marker union
  is written out in F4 so 00's move is transcription, not re-diagnosis — and folding it into
  `pr-lint-not-a-prompt` is cheaper than a 82nd HOLD.
- **Did not re-lint the board.** The 1010 census (30 ADMIT / 30 exit-1 / 21 exit-3) stands; this run
  measured premises and gates directly instead, and the 21 agrees.
- **Did not quote a trunk colour from `status-sweep.ps1`.** I read the lock, the index, the armed
  count and #1377's job log directly.
- **Did not commit anything.** Both this breadcrumb and `docs/pipeline/sweep-rotation.json` are
  uncommitted, by design — the dev tree is where the watcher globs and its index is shared.
- **Did not repair Station 00's malformed 1809 breadcrumb (F6),** though it is a docs-only heading
  rename I could have made in seconds. It is another station's artifact and the station doc's
  report-not-run rule is explicit: flag it, never rewrite it. The exact five section names are in
  F6 so 00's fix is transcription.
- **Did not re-raise the OAuth outage as a new finding.** 00 escalated it 61 seconds before my run
  started; I added the one measurement it could not take (F7) and left the escalation with 00.
- **Did not touch `/sot/`, any PR, or anything Azure / Entra / SharePoint.**
- **Did not re-raise** the four findings 04 dispatched on 08-27T22:10Z, 06's missing bootstrap, or
  the `docs/qa`-gitignored false claim in the five `Scheduled\*\SKILL.md` bootstraps. All open,
  none new, all already in front of 00.

---

**This breadcrumb is UNTRACKED until a board PR commits it. Station 00: sweep it up, and commit
`docs/pipeline/sweep-rotation.json` in the same PR.**
