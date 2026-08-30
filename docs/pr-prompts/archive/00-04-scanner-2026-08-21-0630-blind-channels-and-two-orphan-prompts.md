# 00-04-SCANNER — 2026-08-21 06:30Z — @ `c17373121b7330dc48c3cbf114faa3ffa019576d`

**Breadcrumb, not a prompt.** Read-only run. Nothing armed, disarmed, renamed, moved, merged or
repaired. Standing arming hold observed.

Measured on the Windows host via Desktop Commander PowerShell, in a clean detached worktree off
`origin/main` (`C:\po-scan-jimz45`, created and removed this run). Dev tree, watcher clone and
`origin/main` all at `c1737312`; 0 open PRs; 0 armed; watcher pid 13372 alive.

⚠️ **This file is UNTRACKED and therefore, by Finding 1 below, is not actually a report.** It is
here because the brief says to put it here. The durable copy is in project memory. Landing these
notices needs a docs PR — Station 00/05 lane.

---

## FINDING 1 — S2 — The cross-station breadcrumb channel does not reach any other station

`docs/pr-prompts/00-*.md` notices are **not tracked on `origin/main`**. They exist only as untracked
files in the single dev tree on this laptop. Every station whose brief mandates measuring from a
clean worktree off `origin/main` (including this one, STEP 0) **cannot see any of them**.

`[MEASURED]`

```
git -C C:\ProjectOperations2 ls-tree -r --name-only origin/main -- docs/ | grep 'pr-prompts/00-'
  -> 0 hits
POSITIVE CONTROL, same command, 'pr-prompts/pr-'          -> 81 hits
POSITIVE CONTROL, '/00-' anywhere on main                 -> 2 hits
     (.claude/agents/00-supervisor.md, docs/pipeline/stations/00-supervisor.md)
     => the pattern and the path filter both work; the files are genuinely absent
git check-ignore -v on all 13 local 00-*.md               -> exit 1 for every one
     => NOT gitignored. They were simply never committed.
files named 00-*.md in the clean worktree                 -> 0
POSITIVE CONTROL, *-HOLD.md in the clean worktree         -> 69
```

13 notices are affected, including
`00-supervisor-2026-08-21-0115-THREE-FAILURE-MODES-for-06.md` — the document this station's own
standing hold instructs it to read — and
`00-supervisor-2026-08-21-0610-DC-ABSENT-run-blind.md`, written 20 minutes before this run.

**This is the `qa-findings.md` defect in a second channel.** That one was gitignored; this one is
merely uncommitted. The consequence is identical: a finding written only here has not been reported.
The BREADCRUMB RULE as practised does not satisfy the BREADCRUMB RULE as written.

**Not fixed here** — committing to `main` is a hard stop for this station.

---

## FINDING 2 — S2 — `pr-smoke-share-worker-tokens.md`: its blocker cleared, and no instrument can notice

Two prompts are tracked on `origin/main` in `docs/pr-prompts/` with **neither** a `-ready` nor a
`-HOLD` suffix. They are outside the watcher glob, outside HOLD triage, and outside the backlog
register — so nothing ever re-tests their premises.

`[MEASURED]` watcher glob is `(pr|rev)-*-ready.md` (`scripts/pr-watcher/index.mjs:2512`);
`triage-holds.ps1` globs `*-HOLD.md`. Neither matches these filenames.

### `pr-smoke-share-worker-tokens.md` — READY, unnoticed

| Claim | Result | Control |
|---|---|---|
| Own premise alive: `api-tokens` absent from `tests/e2e/pr-acceptance/api-helpers.ts` | **0 hits → ALIVE** | file exists and is readable; probe returns hits on other tokens |
| Its stated arm-gate: `AUTH_THROTTLE_LIMIT` present in `scripts/pipeline/smoke-pr.ps1` | **3 hits (L116, L121, L125) → SATISFIED** | same probe, `param` → 2 hits (L22, L23) |
| The prompt it waits on, `pr-smoke-relax-auth-throttle` | **absent from all of `origin/main`** → shipped and retired | `ls-tree -r` over the whole tree |

The prompt says *"Arm this only AFTER that prompt's PR has merged."* **It has.** The work is
armable and has been sitting invisible.

### `pr-permission-role-reconciler.md` — correctly parked, but equally invisible

Premise alive: `syncRolePermissions` → **0 hits** across `apps/api/src`
(POSITIVE CONTROL: `permissionRegistry` → 16 hits, so the recursive probe is live).
It is deliberately suffix-less pending Marco's sign-off on an **authorization-architecture** change —
that parking is correct. The defect is that nothing re-surfaces it either.

**Recommendation (report, not act):** either give the suffix-less state a real name that an
instrument globs, or register both in `BACKLOG.yaml` so `check-backlog.mjs` re-tests them.

---

## FINDING 3 — S3 — `superuser-parity.guard.test.ts` guards the two files that were already fixed

`apps/web/src/auth/__tests__/superuser-parity.guard.test.ts` hard-codes
`GUARDED_FILES = ["pages/directory/SubcontractorsPage.tsx", "pages/projects/ProjectDetailPage.tsx"]`.

`[MEASURED]` both files have since been fully migrated to the `can()` helper (Subcontractors: 3
`can(` call sites, 0 raw `permissions?.includes(`; ProjectDetail: 7 and 0). Meanwhile **7 other
non-test files** carry the raw `user?.permissions?.includes(...)` pattern the guard exists to
police — `WorkerDetailPage.tsx`, `CorrectiveActionsPage.tsx`, `CorrectiveActionDetailPage.tsx`,
`FormSubmissionDetailPage.tsx`, `FormsListPage.tsx`.

All 7 currently pair the raw check with `isSuperUser` **by hand**, so there is no live defect. But
the guard's allowlist is inverted relative to risk: it watches the files that cannot regress and
ignores the files that can. Its regex is also `permissions\?\.includes\(` only — a non-optional
`user.permissions.includes(` would slip past it even inside a guarded file.

Contrast `permission-registry-coverage.guard.spec.ts` and `migration-naming.guard.spec.ts`, which
scan the whole tree with an empty allowlist and an anti-rot test. Same house, two standards.

---

## Part 0 sub-checks run this cycle: (a), (b), (e) — all CLEAN

- **(a) authorization parity** — `can()` / `canAny()` / `isAdminUser()`
  (`apps/web/src/auth/permissions.ts`) all short-circuit on `isSuperUser`. Every `<Navigate>`
  permission guard routes through `can()`; `RequirePermissions` (`SettingsShell.tsx:194`) uses
  `can()`. ShellLayout nav gating (`:636-637`) honours `superUserOnly` and `can()`.
  **No super-user lockout found.**
- **(b) permission-code integrity, FRONTEND direction** — 54 distinct gate codes extracted from
  156 gate-bearing lines across 373 web source files; **0 absent from `permission-registry.ts`**
  (100 registered codes). Negative control: `users.view` registered and not flagged. Positive
  control: synthetic `zzz.bogus` would be flagged. Backend direction is already covered by
  `permission-registry-coverage.guard.spec.ts` (repo-wide, empty allowlist, two positive controls).
- **(e) migration ordering** — 227 folders under `apps/api/prisma/migrations`: 58 bare
  `YYYYMMDD_`, 150 full `YYYYMMDDHHMMSS_`, 19 legacy 12-digit. **NEW bare offenders = 0**,
  **stale allowlist entries = 0**. Negative control: synthetic `20260821_synthetic_probe` would be
  flagged. Route-shadowing guard boots the real `AppModule` and walks the live Express router — it
  calls the deciding tool rather than mirroring it.

## Re-measured, unchanged — do not re-discover

`check-backlog.mjs` exit 10, ready=2, both known permanent false-READYs
(`settings-restructure-sot-nav-reconcile` = Station 05 only; `rates-11c-blocked-consumers` = slices
already staged). needs-marco=1 (`map-locations-waste-rate-coupling`). `check-escalations.mjs`
open=0 resolved=3. `check-lessons.mjs` holding=5 regressed=0. `origin/main` still tracks **9**
`-ready.md` files at depth 1 while 0 are armed on disk — arming commits, consuming does not.

## Two instruments of mine lied this run — both caught by controls

1. **My first frontend permission extractor was a placebo.** It found 11 codes across 373 files and
   **aborted on its own floor** rather than reporting "0 offenders". Its successor's gate regex then
   matched `requiredPermission` but **not `requiresPermission`** — the actual ShellLayout nav key —
   so it ran blind over all 33 nav codes. Fixing the alternation took gate-bearing lines 87 → 156
   and codes 37 → 54. **The clean result is only trustworthy because the blind version was caught.**
2. **The Grep tool's `-C` context lines are not byte-faithful.** It rendered `ShellLayout.tsx:34` as
   `\ Stricter than adminOnly…` — a syntax error that would have been an S1 "main is broken" report.
   The raw bytes at that offset are `20 20 2F 2F 20 53 74 …` = `  // Stricter`. **The file is fine;
   the display corrupted `//` into `\`.** Verify any anomaly against bytes before reporting it.

## Left alone deliberately

`.git/worktrees/po-scan-0CwZSs/` — gitdir points at `/tmp/po-scan-0CwZSs/.git` (a destroyed Linux
VM), `locked`, 0-byte `HEAD.lock` + `index.lock` from 2026-08-20 ~22:11Z. Under
`.git/worktrees/<name>/`, not `.git/` root, so not blocking. Station 03's lane. Also
`.git/objects/maintenance.lock` (0 bytes, 2026-08-18). No locks at `.git/` root at run end.
