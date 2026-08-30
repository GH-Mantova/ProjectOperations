# Station 00 — Supervisor | 2026-08-30T22:08Z–2026-08-30T22:2xZ

## GROUND

```
UTC            2026-08-30T22:08:46Z
origin/main    009a83b1            (fetch first, then rev-parse)
dev tree       main @ 009a83b1     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run had full authority, not read-only.
SIGHTED: `start_process` on `powershell.exe` returned at 22:08:46Z. This was not a blind run.

## WHAT I MEASURED

- **[MEASURED] The OAuth block is OVER.** `ConvertFrom-Json` on
  `C:\Users\Marco\.claude\.credentials.json`: `claudeAiOauth.expiresAt` = `1788153436577` =
  **2026-08-31T05:17:16Z**, i.e. **7.12 hours in the FUTURE**; file `LastWriteTimeUtc` =
  **2026-08-30T21:17:21.76Z**. The standing probe's whole test is *"has the mtime moved off
  `2026-08-28T16:13:26.909Z`"* — **it has.** Marco re-authed at 21:17Z. Eighteen consecutive
  readings said expired; this is the nineteenth and it says restored.
- **[MEASURED] The agent lane proved itself on a real prompt, not on the probe.**
  `docs/pr-prompts/processed/pr-crm-s3-account-on-client-create-ready.md.log`:
  `Started 2026-08-30T21:25:31Z / Ended 21:45:43Z / Exit 0`, and it shipped **PR #1409**
  (`feat/crm-s3-account-backfill`). The prompt the 401 burned in 16 s on 08-28 ran to completion
  8 minutes after the re-auth.
- **[MEASURED] #1409 is Marco-gated on BOTH gates.** Watcher log line 18:
  `[watcher] merge result for PR #1409: {"ok":false,"marco":true,"reason":"escalates:true - held
  for Marco, labelled do-not-merge"}` — the RULE-2 `"marco":true` literal AND the `do-not-merge`
  label (`gh pr view 1409 --json labels`). Positive control: the same probe run against `1410`
  returned only a substring false positive inside a migration timestamp
  (`20260814100000` contains `1410`) and no routing line.
- **[MEASURED] The staged half-arm was still there, three days on.**
  `git diff --cached --name-status` →
  `R100 docs/pr-prompts/pr-crm-s3-account-on-client-create-HOLD.md -> ...-ready.md`,
  with **neither file on disk** (`Test-Path` False for both). This is the exact hazard recorded on
  08-28: any pathspec-less commit publishes a tracked, ARMED prompt to `main`.
- **[MEASURED] Triage bucket = CONSUMED, branch 1 of 3.** `processed/` holds 2 crm-s3 entries
  (the prompt, plus a `.log` rewritten at 21:45:48Z by the successful run); `failed/` holds the 3
  artefacts of the 08-28 burn; `no-pr-opened/` = 0. Consumed ⇒ *unstage and leave the ` D`*.
- **[MEASURED] `--freshness` CLEAN, exit 0.** 18 breadcrumbs checked, 0 malformed.
  00 2.0h/2 · 02 dispatch-only · 03 23.1h/24 · 04 4.0h/4 · 05 8.0h/24. **06 still has no cadence
  key at all** — it does not appear in the freshness table in either direction.
- **[MEASURED] `status-sweep.ps1` 22:12:44Z = SAFE TO ACT.** Both instrument positive controls
  passed. Trunk green (3/3). Watcher node **RUNNING pid 6388**, wrapper alive (1), heartbeat 21 min,
  0 orphaned worktrees. Watcher clone `dirty=36` — the standing amber, 03's lane, not news.
- **[MEASURED] The board moved under me mid-run, twice.** #1410 was created at **22:10:18Z** by
  `GH-Mantova` from branch `docs/watcher-verdict-sweep-skips-tracked` — the untracked HOLD file I
  saw in my own 22:08 `git status` had been swept into a PR by another actor two minutes later.
  Then at **22:13:34Z** `rev-1410-ready.md` appeared in the queue root: **ARMED went 0 → 1** between
  the 22:12 sweep and my 22:14 re-measure. That is the watcher's review lane waking up — a
  second, independent confirmation that the OAuth lane is alive.
- **[MEASURED] The CLAUDE.md:19 item is already discharged.** Line 19 now reads *"the count lives
  in that file, never here"* and states no number; `sot-refs-baseline.json` has `entries 14`.
  The RULE-1 fix (stop restating a number that has a machine-readable home) landed in **#1408**
  at 20:49Z, which is *after* the 18:07Z breadcrumb that labelled it DEFERRED.
- **[MEASURED] Arming candidate is clean but I did not use it.**
  `pr-lint-frontmatter-block-scalar-collapse-HOLD.md`: lint **ADMIT exit 0**; front matter
  `gate_allow: none`, `escalates: false`, `seed_only: false`, `backfill: false`, `size: 2`, no
  `requires_*`; scope is two script files, no schema/migration/seed. Premise
  `! grep -q "foldBlockScalar" scripts/pipeline/lint-prompt.mjs` re-measured **TRUE** against
  `origin/main` (0 occurrences), with the positive control `parseFrontMatter` returning 5 — so the
  read itself worked. Union-grep for the ten don't-arm markers: **no marker**, and the positive
  control `pr-524-rates-b-slice2-canonical-HOLD.md` returned 2 hits, so the grep is calibrated
  rather than silently under-matching.

## WHAT CHANGED

- **Cured the staged half-arm.** `git restore --staged docs/pr-prompts/pr-crm-s3-account-on-client-create-HOLD.md docs/pr-prompts/pr-crm-s3-account-on-client-create-ready.md`, exit 0.
  Verified after: `git diff --cached --name-status` prints **nothing** (staged index empty), and
  `git status --porcelain` for those paths prints ` D` — a **single-space** D, not `RD`. Armed count
  unchanged across the operation (`rev-1410-ready.md` before and after). The command writes,
  deletes and checks out nothing.
- **Nothing else in the dev tree was mutated.** No arm, no merge, no label, no restart, no commit.

## FINDINGS

**F1 — The OAuth block, which governed nine consecutive supervisor runs, is LIFTED.**
Measured at source and corroborated by two independent live behaviours: a work prompt ran to exit 0
and opened #1409, and the review lane auto-armed `rev-1410`. The standing instruction *"ARM
NOTHING"* and its `STOP-WATCHER` trigger are both discharged. Nothing was armed **on this run** for
an unrelated reason (F4), and that distinction matters — the block is gone, the queue discipline is
not.
**DISPOSITION: ACTIONED** — verified by the credentials probe plus two live lane behaviours.

**F2 — The 08-28 staged half-arm survived three days and two supervisor runs.**
Every intervening run correctly reported it; none cured it, because the runs that could see it were
blind and the ones that were sighted read `[CANNOT MEASURE]` from memory rather than probing. It is
now cured. The residual ` D` on the HOLD is correct and deliberate: the prompt genuinely shipped as
#1409, so its deletion from `main` is true — but it is **left uncommitted** until #1409 merges,
because committing the deletion while a Marco-gated PR is still open would erase a live chain prompt
from `main` if Marco declines it.
**DISPOSITION: ACTIONED** — staged index empty, ` D` not `RD`, both read back.

**F3 — #1409 is CLEAN, green (13/13) and mergeable, and I did not merge it and will not.**
Two independent gates both say Marco: the watcher's `"marco":true` routing (RULE 2) and the
`do-not-merge` label (`escalates: true`). Auto-merge is confirmed **null** — nothing is armed to
merge it behind anyone's back. It wires `ensureAccountForClient` into client-create and carries two
backfill migrations, so it is production code and exactly what RULE 2 exists for.
**DISPOSITION: ESCALATED** — Marco: #1409 is ready for your review and merge. It is the first
prompt to complete since the 08-28 token expiry, so it is also the proof that the lane is healthy.

**F4 — I did not arm, and the reason is queue discipline, not the old block.**
`pr-lint-frontmatter-block-scalar-collapse-HOLD.md` is the strongest candidate on the board — it
fixes the parser whose block-scalar collapse rubber-stamps the LL-29 rollback gate on 7 of 17
migration-scoped prompts, two of which are irreversible table drops. It passes every arming test I
can run. But `rev-1410-ready.md` armed itself at 22:13:34Z, so ARMED is 1, and RULE 4 is **one at a
time**. Independently, another actor was mid-mutation on the dev tree during this run (F6), which is
the LL-38 condition.
**DISPOSITION: DEFERRED** — trigger: the next 00 run that measures ARMED back to 0 **and** no
concurrent station mid-mutation arms this prompt first, ahead of `project_next_arm_order.md`.

**F5 — The `CLAUDE.md:19` item labelled DEFERRED at 18:07Z was already fixed at 20:49Z.**
It was re-labelled from "DISPATCHED → next sighted 00" to DEFERRED with trigger *"the first 00 run
with a Windows shell"*. I am that run — and I found the work already done by #1408. No harm was
done, but this is the second half of the same defect the 1807 breadcrumb named: a disposition whose
addressee is a **future run** cannot be closed by the ledger, so it survives its own fix and bills a
later run to re-discover it. It cost this run a measurement, not a mistake.
**DISPOSITION: ACTIONED** — closed by measurement; do not re-raise.

**F6 — Two concurrent actors touched the board inside a six-minute window of this run.**
The untracked `pr-watcher-verdict-sweep-skips-tracked-HOLD.md` present in my 22:08 `git status` was
gone by 22:14, having become #1410 at 22:10:18Z; and the review lane armed `rev-1410` at 22:13:34Z.
Both are legitimate — #1410 is 03's verdict-archive fix reaching the board, and the review lane is
doing its job. But it means the sweep's `SAFE TO ACT` verdict at 22:12 was **already stale when it
printed**, which is DOCTRINE §7's point stated in miniature. I re-measured before every write and
scoped every write to explicit paths.
**DISPOSITION: DEFERRED** — #1410 is CLEAN and green with a review prompt armed against it; the
review lane owns it and merging it from here would burn `rev-1410` mid-flight. Trigger: if #1410 is
still open and unreviewed at the next 00 run, 00 drives it.

**F7 — 06 still has no cadence key, so "DISPATCHED → 06" still parks silently.**
`CADENCE` at `check-breadcrumb.mjs:36` has no `'06'` key — not `null` like `'02'`, absent — and
today's `--freshness` again printed five stations and no 06. Unchanged and re-confirmed, not new.
**DISPOSITION: ESCALATED** — standing, unanswered. RULE-1 options unchanged: **(A) give 06 a
cadence key AND a real scheduled task, together** (complete + additive; the two halves are
inseparable, since `'06': <n>` without a task makes `--freshness` exit 2 forever and `'06': null`
prints a reassurance that is false of 06) · (B) 00 actions 06's items itself (fails *complete*) ·
(C) leave it (fails *complete*; it is how an 08-26 defect stayed live for three days). The
scheduled task is Marco's box to create.

**F8 — The watcher restarted, and its wrapper count fell 3 → 1.**
Node is now **pid 6388**, started 21:25:04 local (21:25Z run start), against pid 26364 with 3
wrappers at 14:08Z. One wrapper is the correct number; three was the historical oddity. ENSURE-UP
therefore reports *wrapper present, no action* — this is a return to normal, not a fault, and it
lines up with the re-auth at 21:17Z.
**DISPOSITION: DEFERRED** — nothing to fix; recorded so a later run does not read "3 → 1" as a loss.

## WHAT I DID NOT DO

- **Did not merge #1409** — RULE 2 and `do-not-merge`, both live. Marco's.
- **Did not merge or touch #1410** — another station's PR with a review prompt armed against it.
- **Did not arm anything** — ARMED was 1 from 22:13:34Z (F4).
- **Did not commit the ` D`** on the crm-s3 HOLD — correct but premature while #1409 is unmerged.
- **Did not run `git` in `C:\po-watcher\ProjectOperations`**, and did not restart the watcher: it is
  running, the queue is being consumed, and an idle watcher with work in flight is not wedged.
- **Did not re-dispatch the `sot-refs-baseline.json` `_readme` TRAP-2 item to 05.** 05 last ran
  14:11Z on a 24 h cadence — it is waiting correctly, not overdue. Still DISPATCHED, still open.
- **Left alone:** `/sot/`, Azure/Entra/SharePoint, the watcher clone's standing `dirty=36`, the 14
  `needs-marco/` escalations, and the `rates-11c-blocked-consumers` backlog item the sweep reports
  READY TO STAGE — it is a chain arm, and this run's arming slot was taken.
