# 00-SUPERVISOR — 2026-08-24 02:35Z

Sweep at 02:08:36Z. Verdict **SAFE TO ACT**. `origin/main = ed26083a`. Watcher **ALIVE pid 30932**
(exact cmdline match `pr-watcher[\\/]index\.mjs`, 1 of 13 node.exe), started 00:33:15 local,
ancestry L1/L2 powershell, L3 GONE → detached, not job-object-bound.

## ARMED (one, per the one-at-a-time rule)

`pr-nopr-s1-dismissed-means-proceed-HOLD.md` → `-ready.md` by `git mv` (tracked rename, staged).
**armed depth-1 went 0 → 1**, confirmed on disk.

Pre-arm checks, all measured against `origin/main ed26083a`:

- lint `ADMIT` (necessary, not sufficient — so also:)
- `<!-- watcher: do-not-arm -->` **absent**; prose `DO NOT ARM` **absent**; no `docs/approvals/` gate
- premise `! grep -q "DISMISSED_MEANS_PROCEED" docs/pr-prompts/PROMPT-SCHEMA.md` → **0 occurrences =
  ALIVE**. Positive control on the same instrument: `premise` → 15 occurrences, so the grep works.
- claim-grep: 15 files reference `PROMPT-SCHEMA`, but the only **live** ones are s1 and s2 themselves
  (rest are breadcrumbs and `superseded/`). No open PR touches the file.
- s2 (`pr-nopr-s2-hard-failure-bounded-restage-HOLD.md`) left on HOLD — its
  `requires_on_main: PROMPT-SCHEMA.md :: DISMISSED_MEANS_PROCEED` gate is correctly **unsatisfied**.
  Arm it only after s1 lands.

This closes ITEM 3 of the old standing hold (`[NO-PR]` silent success). Scope is
`docs/pr-prompts/PROMPT-SCHEMA.md` only → docs-class, so the watcher may auto-merge it.

## 🟢 TWO SURFACING CHANNELS ARE REPAIRED — PR #1300 (merged 01:24Z)

- **Breadcrumbs: 21 of 22 tracked on main** (was 0 of 20). Writing a breadcrumb is reporting again.
  The 1 untracked is `00-machine-minder-2026-08-24-0123-...`, written after #1300 was cut.
- **`docs/approvals/README.md` is now tracked** (1 file). Per-slug approval markers still 0, which is
  expected — they only exist when a human lands one.
- **The resurrection trap is DEFUSED: depth-1 tracked `*-ready.md` = 0** (was 9).
  Control: depth-1 tracked `*-HOLD.md` = 61, so the pathspec instrument is not lying.
  ⚠️ `git ls-files 'docs/pr-prompts/*-ready.md'` returns **167** — the pathspec `*` crosses
  directories. Filter `-notmatch '^docs/pr-prompts/[^/]+/'` or the count is meaningless.
- ❌ **Still broken:** `docs/qa/qa-findings.md` is gitignored (`.gitignore:107`, check-ignore exit 0).
  Anything found only there is UNREPORTED. mtime 2026-08-21 — no scanner run has written it since.

## RED — RESTARTER STILL ABSENT (Marco only)

`Get-ScheduledTask` → **207 tasks, 0 match `atcher`.** Five watcher deaths in four days and nothing
on the box restarts it. `C:\po-watcher\ensure-watcher.log` **does not exist**, which is consistent
with the keepalive never having run. See `docs/runbooks/watcher-restarter-scheduled-task.md`.

## DISPATCHED → 03 machine-minder (manual-only task; must be fired)

1. **Watcher clone is 3 commits behind and dirty.** `C:\po-watcher\ProjectOperations` HEAD
   `6ec80638` vs main `ed26083a`; `git status --porcelain` = 35 lines (34 ` D docs/pr-reviews/pr-*.md`
   from its own verdict-archive sweep + 1 untracked `pr-1296-review.md`). **Do not `git checkout`
   those deletions back** — that is the board trap. Fast-forward with the watcher **STOPPED**, then
   relaunch via `Invoke-CimMethod Win32_Process Create`.
   **DEFERRED, condition stated:** none of #1298/#1299/#1300 touched `scripts/`, so no merged fix is
   currently inert. Do it at the next restart, or the moment a `scripts/pr-watcher/**` PR merges
   (that is #1294 or nopr-s2).
2. **4 orphaned worktrees.** `/tmp/po-scan-0CwZSs` (locked, gitdir in a destroyed VM) ·
   `C:/po-worktrees/sot-d-register` · `C:/po-worktrees/sot-readme-fetch` (**#1299 is merged — safe to
   prune**) · `C:/po-wt-h` [hygiene] (owner unknown).
3. **`C:\ProjectOperations2\.git\objects\maintenance.lock`** — 0 bytes, age 8398 min (~5.8 days).
   Stale, not a mutation: 0 git processes, no index.lock in either tree.

## ESCALATED → Marco

- **The restarter** (above). Only he can register the scheduled task.
- **PR #1296 is UNSTABLE on `FAIL - CP-12 env-vars [undeclared: FUELPRICE_QLD_BASE_URL,
  FUELPRICE_QLD_TOKEN, FUELPRICE_QLD_REGION_LEVEL, FUELPRICE_QLD_REGION_ID, FUELPRICE_QLD_FUEL,
  FUELPRICE_QLD_BRAND]`** (read from the job log, run 32680076092). The one-line unblock is a bare
  `GATE-ALLOW: env-vars` at column 0 of the PR body — no code change. It is **his call**: the gate
  exists to stop undeclared env vars, and waiving it is a decision, not a repair.

## LEFT ALONE, deliberately

- **PR #1294** (CLEAN, 11/11 green) and **PR #1296** — both watcher-routed to Marco, measured from
  `watcher-launch.log`: `PR #1294 stays for Marco (outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs)`
  and `PR #1296 stays for Marco (outside tests/ or docs/: .env.example)`. **RULE 2 — never merge
  what the watcher routed to Marco.** Not when green, not when unlabelled.
- **`rates-11c-blocked-consumers`** — backlog `READY TO STAGE`, but staging is Station 06's lane and
  the item's own note says 11c must not merge until the parity proof has RUN clean. Not staged here.
- **`map-locations-waste-rate-coupling`** — `UNBLOCKED, BUT NEEDS MARCO`. Not auto-staged.
- **`/sot/`** — untouched, as always.

## DISCHARGED (was a 9-day-old rotting finding)

`settings-restructure-sot-nav-reconcile` now prints under **still blocked**, not `READY TO STAGE` —
#1298 landed its marker `docs/audits/settings-restructure-sot-reconcile.md`. The work shipped; the
finding is closed, not carried forward.
