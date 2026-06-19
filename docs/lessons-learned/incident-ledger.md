# Incident Ledger — consolidated knowledge source

**Compiled:** 2026-06-11 by Cowork, from memory files, chat history, sanity-check findings, escalations, and watcher logs.
**Purpose:** one place that records every operational issue this project has hit, its root cause, the fix, and the guard now standing. Agents and humans check this BEFORE diagnosing anything that looks familiar. Append new entries; never delete.
**Rule of use:** if a symptom matches an entry here, apply the documented playbook before inventing a new diagnosis. If a fix changes a guard, update the entry.

---

## Format

`LL-NN | date | symptom → root cause → fix → standing guard`

---

## Git / repo integrity

**LL-01 | pre-2026-06 | Local repo HEAD broken after dev-start.bat / dirty-tree pulls.**
Root cause: dev-start.bat auto-checkouts main after a clean-tree check; dirty pulls have corrupted refs twice. Fix: PowerShell recovery playbook (memory: local-repo-corruption-recovery). Standing guard: use `pnpm dev` (not dev-start.bat) on feature branches.

**LL-02 | 2026-06-11 | `fatal: Failed to resolve HEAD` — HEAD file 49 bytes with trailing NULs.**
Root cause variant of LL-01: interrupted/unflushed write left NUL padding. Fix: rewrite HEAD with exactly `ref: refs/heads/<branch>\n`. Standing guard: check `wc -c .git/HEAD` / hexdump before assuming deeper corruption.

**LL-03 | 2026-06-11 | Cowork sandbox mount showed broken HEAD / truncated files while Windows-side git was healthy.**
Root cause: mount cache staleness during active Windows-side git operations. Fix: verify on the Windows side (`git status`, `git fsck`) before trusting sandbox reads; restart the Cowork session to remount. Standing guard: sandbox observations of `.git` internals during agent runs are advisory only — never "repair" through the mount without Windows-side confirmation. (One benign exception logged: the LL-02 rewrite was byte-identical to the valid ref.)

**LL-04 | ongoing | Branch accumulation after manual merges.**
Root cause: only watcher auto-merge path passes `--delete-branch`; manual merges leave remote branches. Fix/Standing guard: `scripts/branch-prune.ps1` (deletes remote branches whose PR merged, skips open PRs + main); see [vs-code-strategy.md §A3](../vs-code-strategy.md#a3-branch-hygiene-the-pruning-routine) for the recurring schedule + repo setting.

## Prisma / database

**LL-05 | 2026-05/06 | Prisma migrations applied out of order.**
Root cause: Prisma sorts migration folders alphabetically; bare `YYYYMMDD_*` sorts before `YYYYMMDDHHMMSS_*` same-day. Fix: full timestamps + inline data for backfills. Standing guard: reviewer rule — never merge a migration that doesn't sort AFTER all existing same-day migrations.

**LL-06 | 2026-06-09 | F0-01 CRITICAL: schema.prisma drifted from the 102 committed migration files.**
Root cause: schema changes committed without matching migrations over time. Fix: drift reconciled; canonical tests CP-07 (`migrate status`) + CP-G5 (applied rows == migration folders) added in PR #346 and wired into CI (#348). Standing guard: CP-07/CP-G5 run on every PR.

**LL-07 | 2026-06-11 | CP-G5 failed locally: orphan applied migration `20260603000000_team_and_comm_filter` not in git.**
Root cause: PR-smoke runs apply branch migrations to the shared dev DB; the branch's migration was renamed before merge, orphaning the dev-DB row + a real schema delta (`tender_entries.client_id`). Fix: dropped the orphan column/FK/index + `_prisma_migrations` row. Standing guard: when CP-G5/`migrate status` fails locally, suspect smoke-run orphans FIRST — compare `_prisma_migrations` rows vs `prisma/migrations/` folders and check git log for renamed migrations. Parked mitigation options: disposable smoke DB, or CP-G5 as post-smoke check.

**LL-07a | 2026-05-17 | Date-bounded delete migration cutoff was 39 s too early (PR #188, B-followup).**
Symptom: PR #188's migration to add `NOT NULL` on `cutting_sheet_items.card_id` first DELETEs pre-B4b orphan cutting rows, bounded by a date filter. The WHERE clause used `2026-05-17 07:30:00+00`; the actual B4b merge (SHA `fe39e27`) was `2026-05-17 07:30:39 UTC` — 39 seconds later. Root cause: cutoff timestamp rounded down to the minute instead of using the exact merge time. The whole point of the filter was to fail loud (via the subsequent NOT NULL ALTER) if any post-B4b orphan existed; the 39-second slack would have silently deleted any row created in that window, then let the ALTER succeed cleanly. Blast radius in this case: zero (dev DB orphans were all from 2026-05-16, CI shadow DB empty). In a parallel universe with an orphan in those 39 seconds: silent data loss. Fix: caught in Codex P2 review on PR #188; subsequent housekeeping in PR #190. Standing guard: for any date-bounded delete migration where the safety property is "delete X but only if X is older than timestamp T" — use the EXACT timestamp T (`git log --format=%cI <sha>` or the GitHub API), never a rounded minute/hour; state T's exact value in both the migration comment AND the WHERE clause and treat any mismatch as a bug. Refs: PR #188, PR #190, migration file `apps/api/prisma/migrations/20260517090000_b_followup_cardid_not_null/migration.sql`, B4b merge SHA `fe39e27`.

## CI / gates / GitHub behaviours

**LL-08 | 2026-06-11 | PR #348 gates job failed on the PR that introduced it.**
Root cause 1: gates regex matched a ` ```gate-scope ` fence ANYWHERE in the body — the PR's own documentation example went live. Root cause 2: example `GATE-ALLOW:` lines at column 0 also activated (silent blanket exemptions). Fix: body edited; pr-153/#350 anchored the fence to column 0 + live body fetch. Standing guard: **PR bodies must never contain a literal column-0 gate-scope fence or column-0 GATE-ALLOW lines as documentation — indent examples.** Contract docs live in the script header.

**LL-09 | 2026-06-11 | Gates still failed after the body was fixed.**
Root cause: editing a PR body does NOT re-trigger `pull_request` workflows, and "Re-run jobs" replays the ORIGINAL event payload — `github.event.pull_request.body` was frozen. Fix: close/reopen (or empty commit) forces a fresh event; pr-153 made the script fetch the body live by PR number. Standing guard: any payload-reading CI job should fetch live data by stable ID, not consume frozen event fields.

**LL-10 | 2026-06-11 | Diagnosed #348's failure from code reading (wrong: missing origin/main theory) while the log showed the real cause.**
Fix/Standing guard (memory: ci-diagnosis-from-logs + reviewer CI-failure protocol in `.claude/agents/pr-fix-reviewer.md`): never verdict a CI failure without the failing step's log; reproduce body-parsing failures locally (`PR_BODY="$(gh pr view N --json body -q .body)" node scripts/pr-gates/pr-gates.mjs`); enumerate causes with the log line that confirms/kills each.

**LL-11 | 2026-06-10 | deploy.yml fails on every push to main (runs #920–#938+ all red). DIAGNOSED 2026-06-12, fix on `fix/deploy-workflow` (pr-166).**
Surfaced by the VS Code GitHub Actions panel 2026-06-11. Root cause: `if: ${{ secrets.PROD_DATABASE_URL != '' }}` on the migrations step (added 82d8c83, 2026-04-21) — the `secrets` context is not allowed in step-level `if:` expressions, so GitHub fails workflow-file VALIDATION. Signature: 0s failed runs on every push to every branch, run `name` falls back to the file PATH (`.github/workflows/deploy.yml` instead of `Deploy`), `--log-failed` returns "log not found" / "workflow file issue", zero check-runs in the suite. PR #306's job-level `if` guard never helped because validation fails before any job is evaluated. Fix: evaluate the secret into a job-level env boolean (`HAS_PROD_DATABASE_URL: ${{ secrets.X != '' }}` — secrets IS allowed in `jobs.<id>.env`) and gate the step on `env.`. Standing guard: never reference `secrets` in any `if:`; a path-named 0s run = workflow validation failure — read the file, not the (nonexistent) logs.

## Watcher / automation pipeline

**LL-12 | 2026-06-11 | PR #350 self-merged without review.**
Root cause: watcher auto-merge defaulted ON (`!== "false"`); the VS Code task set only the auto-review env. Fix: pr-155/#351 — default flipped to opt-in (`=== "true"`) + explicit task env. Standing guard: auto-merge is opt-in; review-gated mode is the default everywhere.

**LL-13 | 2026-06-10 | PR #355 sat unmerged 120 min → watcher blocked it + paused the queue.**
Root cause: auto-merge stall (head-branch-not-up-to-date race and/or a required check stuck "Expected"). Fix: Update branch / `gh pr merge N --admin --squash` (the documented race-breaker), move paused prompts back. Standing guard: pause-on-timeout is working as designed — the queue freezing IS the safety feature; unstick the PR, then resume.

**LL-14 | 2026-06-10 | pr-148/149 fired before their dependency (#346) merged.**
Result: both pre-flight gates aborted cleanly, escalated, zero waste. Standing guard: every chain prompt carries a pre-flight existence check on its dependency; fire batches only under auto-merge mode (which serializes merge-then-next), or one at a time.

**LL-15 | 2026-06-10 | Review verdicts starved behind long authoring jobs; auto-review files confusable with hand-staged prompts.**
Fix: pr-156/#355 — review jobs renamed `rev-N-ready.md` + inserted at queue front (never interrupting a running job). Standing guard: prefix tells ownership at a glance; verdicts arrive before the next authoring slot.

**LL-16 | recurring | Orphan claude.exe processes accumulate from killed watcher runs.**
Fix: `Get-Process claude | Stop-Process -Force` — but ONLY when the watcher is idle (it kills in-flight agents too). Standing guard: watcher startup warns with PID list; clean during restarts.

**LL-17 | 2026-06-10 | Windows Update powered off the machine mid-night-run.**
Result: watcher had already paused safely (LL-13) — no damage, but the run was lost. Standing guard: before unattended runs, check Windows Update status (`Get-WindowsUpdate` or Settings) and pause updates for the window; STOP_AT remains the backstop.

**LL-18 | 2026-06-11 | `pnpm test:canonical` picks up untracked specs on a WIP branch.**
Standing guard: scope with `--testPathPattern` when verifying a specific PR's specs.

**LL-19 | 2026-06-11 | Reviewer context staleness: #348 status table outdated; #350 review hardcoded a wrong future PR number (one-line fix in `.claude/agents/pr-fix-reviewer.md` line ~89: "As of PR #352" → "#350" — RESOLVED, line now reads #350 on main); #351 review misattributed the originating prompt from an open IDE file.**
Standing guard: treat reviewer narrative context (status tables, cross-PR claims) as advisory; only its evidence-backed findings on THE PR under review are the verdict. Fold the line-89 fix into the next tooling PR.

## Prompt-writing lessons (for PR prompt authors)

**LL-20 | PR-16 era | Agent derived UI state from sibling state (`selectedId === latest.id`) instead of a named boolean → fix-forward burned.**
Standing guard: prompts that introduce state must NAME the variable and forbid derivations.

**LL-21 | recurring | Multi-step instructions executed out of order.**
Standing guard: instructions to Marco and agents are strictly top-to-bottom in execution order; no "before that" retrofits — restart the message instead.

**LL-22 | recurring | PowerShell 5.1 misreads UTF-8-without-BOM as Windows-1252 → em-dashes/emoji become parser errors.**
Standing guard: all `.ps1` files pure ASCII; grep `[^\x00-\x7F]` before saving.

**LL-23 | 2026-06-10 | Batch 1 e2e run found 4 strict-mode selector collisions + a re-runnability bug (UserDashboard `@@unique(userId, slug)` broke repeat runs).**
Standing guard (now in phase5-conventions.md): role-based selectors, unique `e2e-${Date.now()}` names, self-cleanup; specs must pass TWICE in a row locally.

**LL-24 | 2026-06-10 | Junk folder `C:ProjectOperations2docspr-reviews` at repo root (empty).**
Root cause: first auto-review run mangled an absolute Windows path in a headless shell (`:`/`\` collapsed into a literal folder name) while also creating the real `docs/pr-reviews/` correctly. Deleted 2026-06-11. Standing guard: agent prompts/templates use RELATIVE paths for file outputs; if a stray `C*` folder appears at repo root, it's this pattern — verify empty, delete.

**LL-25 | 2026-06-12 | Two productive agent runs killed as "wedged" — silence misread.**
Root cause: monitoring heuristic assumed zero CPU + no chromium = hung; a model mid-diagnosis is network-bound and process-invisible, and long suite runs buffer pane output. The killed runs had done a full green suite + deep two-bug diagnosis (LL-26/27). Fix: prompts now mandate progress echoes between phases + hard per-command timeouts + loud escalation on timeout (pr-164a v3 pattern — make it house style for long verification prompts). Standing guard: never kill on silence alone; kill on a missed heartbeat or timeout evidence.

**LL-26 | 2026-06-12 | Seed NOT idempotent for safety number sequences (OPEN — production seed bug).**
`seed-initial-services.ts` hard-resets `safetyIncidentNumberSequence`/`hazardNumberSequence` to constants (2/3); on a used local DB, residue rows sit higher (IS-INC18/IS-HAZ19 observed) → every new safety report 500s on unique-constraint until the sequence climbs past residue. CP-08 misses it (counts, not sequence values). Recovery: `UPDATE ..._sequences SET last_number = <current max suffix>`. Fix pattern exists: mirror `allocateSeedJobNumber` (`max(existing, floor)`). Also extend CP-08 to assert sequences ≥ max existing suffix. Evidence: `needs-marco/pr-164a-seed-safety-sequence-reset.md`.

**LL-27 | 2026-06-12 | Labour-rate inline edit race — CONFIRMED PRODUCTION BUG, fixed in PR #369.**
Root cause: async `requestAnimationFrame` focus delay created a focus-steal window — input during the gap (Playwright fill, or a real user typing right after clicking a cell) landed in the row's FIRST input (description) instead of the clicked field. Commit handler was innocent; corruption entered via stolen focus. Fix: synchronous layout-effect focus + per-cell column-index capture; test hardened (try/finally restore, edit-row-closed assertion). This one test's flake blocked FOUR unrelated PRs' CI in one morning (#365/367/368/370) before the fix landed — single-flaky-test blast radius is real. Lesson: when a reviewer frames cross-column data corruption as "test flake", evidence beats framing — tests can mistime, they cannot route values between fields.

**LL-28 | 2026-06-12 | failed/ graveyard hid ~25 pieces of live work — usage-limit phrasing gap.**
47 of 50 dead prompts died on usage-limit waves; the watcher's USAGE_LIMIT_PATTERNS misses "You've hit your limit", so soft-halts were misfiled as hard failures and never re-queued (pr-63b's signed-off feature sat invisible for 9 days). Fix: pattern addition queued for next watcher PR; folders restructured (failed/ = real failures only; new backlog/ = missing work to re-stage; full audit in `docs/pr-prompts/RECONCILIATION-2026-06-12.md`). Standing guard: triage anything landing in failed/ within a day — limit/infra deaths get re-queued, not buried.

**LL-29 | 2026-06-12 | Turn-capped agent left a live migration applied to the dev DB with all code uncommitted.**
pr-172 v1 died at max-turns AFTER applying its number-format migration to the shared dev DB (seed tenders renumbered) but BEFORE any commit — leaving DB and code in different universes. Discovered and repaired by the pr-180 agent mid-job (migration inverted per LL-07 playbook, sources stashed as `palette-deflake pre-flight 2026-06-12`, reseeded). Standing guards: (1) heavy prompts use checkpoint commits, and migrations are COMMITTED before being APPLIED (172a pattern); (2) after any max-turns/killed run, check `prisma migrate status` + `git status` before assuming a clean environment; (3) "stale watcher" calls have now been wrong three times (LL-25 ×3) — agents doing repair/composition are disk- and CPU-invisible; the only reliable signals are per-command timeouts, self-pause escalations, and completed-work artifacts. Patience beats process tables.

**LL-30 | 2026-06-12 | Agent scope contamination — three variants in one day.**
Variant A (PR #373): stash-harvest applied stashes created on an older main → dragged a stale `package.json`/`pnpm-lock.yaml` into the branch → unexplained react-router-dom downgrade. Variant B (PR #375): new e2e test asserted tender `IS-T005`, which existed only in the agent's local DB (live-smoke residue), not in the canonical seed → CI-only failure. Variant C (PR #380): broad `git add` swept five untracked operational docs belonging to another PR into the commit. Standing guards (now standard in every prompt): stage by explicit path, never `git add -A`; paste `git diff origin/main --name-only` in the PR body with every file accounted for; run a fresh `pnpm seed` before local e2e verification; stash-salvage prompts must diff dependency manifests against main and restore them before committing.

## Build / deploy

**LL-31 | 2026-06-12 | pnpm version double-pin breaks every pinning workflow (PR #380).**
Adding `"packageManager"` to package.json while `pnpm/action-setup` steps still pin `version:` makes the action fail at setup ("Multiple versions of pnpm specified") in EVERY workflow that pins. Fix: remove the `version:` keys. Standing guard: `packageManager` in package.json is the single source of truth; no `version:` keys in any `pnpm/action-setup` block; pnpm version bumps must be justified in the PR body.

**LL-32 | 2026-06-12 | Azure Postgres DSN host must be the FQDN (first deploy).**
`prisma migrate deploy` failed P1001 because the connection string used the resource/short name (`projectoperations-prod`) as host. Root cause: Flexible Server hosts are always `<server-name>.postgres.database.azure.com`, and `?sslmode=require` is mandatory. Symptom signature in CI: P1001 "Can't reach database server" failing at ~1s. Related signature: App Service shows `Application Error` and Log stream shows MODULE_NOT_FOUND = non-self-contained pnpm artifact (workspace deps missing — fixed by PR #380's self-contained bundle). Standing guard: prod `DATABASE_URL` host is the FQDN with `?sslmode=require`; a ~1s P1001 in CI means a malformed DSN, not a network outage.

---

**LL-33 | 2026-06-18 | Orphan `claude.exe` processes accumulated across watcher Ctrl+C / kill cycles.**
Root cause: the watcher spawned `claude` children but had no shutdown handler to terminate them — SIGINT only cleared its own timers, so headless `claude --print` runs survived as orphans. The only "cleanup" guidance was a `Get-Process claude | Stop-Process -Force` snippet in the README, which would have killed Marco's interactive Claude Code / Cowork sessions too. Fix: the watcher now records every spawned child's PID into `scripts/pr-watcher/.watcher-children.json`, installs SIGINT/SIGTERM/exit handlers that `taskkill /PID <pid> /T /F` the tracked child + its tree before exiting, and on startup reaps any tracked PIDs the previous run left behind. Standing guard: never kill `claude` by image name — only by PIDs the watcher itself recorded as its own children; the README's image-name kill snippet is removed.

**LL-34 | 2026-06-18 | Sequential merge queue aborted on every transient CI flake, forcing manual rerun + restart.**
Root cause: `scripts/pr-watcher/merge-queue.mjs` (previously untracked) threw immediately on any failed check, so a single tendering-e2e webkit flake stopped a batch midway and Marco had to re-run jobs by hand and restart the script. Fix: PR committed the file and added a one-shot self-heal — when checks are failed, the queue dispatches `gh run rerun <id> --failed` (newest run on the PR's headRefName) once per PR and re-enters the wait loop; if it's still red on the second pass, the queue stops without merging. Standing guard: the auto-rerun budget is exactly one per PR per queue run; a red PR is NEVER merged. Follow-up parked: conservative auto fix-forward in `index.mjs` for mechanical FIX-FORWARD verdicts (missing column-0 GATE-ALLOW marker; stale placeholder-text e2e assertion already replaced by the diff). Deferred from this PR to keep the tooling change scope-tight.

## Open items (check before starting related work)

- LL-11 deploy.yml failing on every main push — diagnosed 2026-06-12 (secrets-in-if validation failure); fix PR open from `fix/deploy-workflow`, close this item when merged + next main push shows no phantom run.
- LL-07 parked decision: disposable DB for smoke runs vs CP-G5 post-smoke check.
- F2-02 documents access-rule test — `test.todo` marker in CP-18 spec (parked by Marco).
- Offline/PWA e2e items — candidate batch 9 (skipped in batch 7 by design).
