# Incident Ledger — consolidated knowledge source

**Compiled:** 2026-06-11 by Cowork, from memory files, chat history, sanity-check findings, escalations, and watcher logs.
**Purpose:** one place that records every operational issue this project has hit, its root cause, the fix, and the guard now standing. Agents and humans check this BEFORE diagnosing anything that looks familiar. Append new entries; never delete.
**Rule of use:** if a symptom matches an entry here, apply the documented playbook before inventing a new diagnosis. If a fix changes a guard, update the entry.
**Namespace:** the `D<n>` numbering is exclusive to this register (`D_NAMESPACE_EXCLUSIVE`); foreign series carry their own prefix (`TFM-D<n>`, `EA-D<n>`) and dashboard widgets use `W<n>`.

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
Root cause: only watcher auto-merge path passes `--delete-branch`; manual merges leave remote branches. Fix/Standing guard: see [vs-code-strategy.md §A3](../docs/vs-code-strategy.md#a3-branch-hygiene-the-pruning-routine) for the recurring schedule + repo setting.

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

**LL-40 | 2026-07-20 | Claude Desktop was killed and took the watcher with it; the queue silently stopped draining (17 armed, 0 running) and the auto-restart wrapper restarted nothing.**
Root cause: the watcher had been started as a CHILD of the Claude Desktop session, so it shares Claude's lifetime - and `supervise-watcher.ps1` shares that same parent, so the wrapper died too and could restart nothing. **2nd occurrence** - identical to 2026-07-14, which is exactly why `watcher-launcher.ps1` carries that warning in its own header. Fix: relaunch detached with `Invoke-CimMethod -ClassName Win32_Process -MethodName Create` running `scripts/pr-watcher/watcher-launcher.ps1`. Standing guard: NEVER start the watcher from a Claude / Desktop-Commander shell. After starting, verify THREE processes - launcher -> supervise-watcher -> node - and that node's path is under the CLONE `C:\po-watcher\ProjectOperations`. An auto-restart wrapper that shares the dead parent is not a safety net.

**LL-41 | 2026-07-20 | The same crash left three separate blockers behind, none of which announced itself.**
Root cause: a killed process releases nothing. (a) An orphaned `.git/index.lock` (46 min old, 0 git processes) blocked every git write in the interactive tree AND made `bring-up-to-speed` return a false `DO NOT ACT` - the instrument reporting "busy" on an idle machine, the inverse of LL-39. **2nd occurrence of the stale-lock class** (see the 2026-07-13 incident below, where it froze the tree for three days). (b) 19 agent worktrees stayed `locked` by dead PIDs, and a locked worktree HOLDS ITS BRANCH, blocking other work on it. (c) An interrupted `git mv` left 37 prompt renames staged but uncommitted. Fix: delete the lock only after proving it stale (0 git processes AND age > 5 min), then positive-control with `git status`; parse the pid from each worktree's lock reason, re-check liveness AT THE MOMENT OF REMOVAL, and `git worktree remove -f -f` only the DEAD ones (17 dead, 2 live); commit the staged renames as a docs-only PR (#701) after gating that every path is in scope and every entry is a pure rename. Standing guard: after ANY crash run that recovery in that order. A `DO NOT ACT` verdict immediately after a crash is probably the stale lock talking - verify before believing it. Never `git reset --hard` to tidy a half-finished operation; it reverts the work on disk and re-breaks the queue.

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
`seed-initial-services.ts` hard-resets `safetyIncidentNumberSequence`/`hazardNumberSequence` to constants (2/3); on a used local DB, residue rows sit higher (IS-INC18/IS-HAZ19 observed) → every new safety report 500s on unique-constraint until the sequence climbs past residue. CP-08 misses it (counts, not sequence values). Recovery: `UPDATE ..._sequences SET last_number = <current max suffix>`. Fix pattern exists: mirror `allocateSeedJobNumber` (`max(existing, floor)`). Also extend CP-08 to assert sequences ≥ max existing suffix.

**LL-27 | 2026-06-12 | Labour-rate inline edit race — CONFIRMED PRODUCTION BUG, fixed in PR #369.**
Root cause: async `requestAnimationFrame` focus delay created a focus-steal window — input during the gap (Playwright fill, or a real user typing right after clicking a cell) landed in the row's FIRST input (description) instead of the clicked field. Commit handler was innocent; corruption entered via stolen focus. Fix: synchronous layout-effect focus + per-cell column-index capture; test hardened (try/finally restore, edit-row-closed assertion). This one test's flake blocked FOUR unrelated PRs' CI in one morning (#365/367/368/370) before the fix landed — single-flaky-test blast radius is real. Lesson: when a reviewer frames cross-column data corruption as "test flake", evidence beats framing — tests can mistime, they cannot route values between fields.

**LL-28 | 2026-06-12 | failed/ graveyard hid ~25 pieces of live work — usage-limit phrasing gap.**
47 of 50 dead prompts died on usage-limit waves; the watcher's USAGE_LIMIT_PATTERNS misses "You've hit your limit", so soft-halts were misfiled as hard failures and never re-queued (pr-63b's signed-off feature sat invisible for 9 days). Fix: pattern addition queued for next watcher PR; folders restructured (failed/ = real failures only; new backlog/ = missing work to re-stage). Standing guard: triage anything landing in failed/ within a day — limit/infra deaths get re-queued, not buried.

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
Root cause: the watcher spawned `claude` children but had no shutdown handler to terminate them — SIGINT only cleared its own timers, so headless `claude --print` runs survived as orphans. The only "cleanup" guidance was a `Get-Process claude | Stop-Process -Force` snippet in the README, which would have killed Marco's interactive Claude Code / Cowork sessions too. Fix: the watcher now records every spawned child's PID into a tracker file, installs SIGINT/SIGTERM/exit handlers that `taskkill /PID <pid> /T /F` the tracked child + its tree before exiting, and on startup reaps any tracked PIDs the previous run left behind. Standing guard: never kill `claude` by image name — only by PIDs the watcher itself recorded as its own children; the README's image-name kill snippet is removed.

**LL-34 | 2026-06-18 | Sequential merge queue aborted on every transient CI flake, forcing manual rerun + restart.**
Root cause: `scripts/pr-watcher/merge-queue.mjs` (previously untracked) threw immediately on any failed check, so a single tendering-e2e webkit flake stopped a batch midway and Marco had to re-run jobs by hand and restart the script. Fix: PR committed the file and added a one-shot self-heal — when checks are failed, the queue dispatches `gh run rerun <id> --failed` (newest run on the PR's headRefName) once per PR and re-enters the wait loop; if it's still red on the second pass, the queue stops without merging. Standing guard: the auto-rerun budget is exactly one per PR per queue run; a red PR is NEVER merged. Follow-up parked: conservative auto fix-forward in `index.mjs` for mechanical FIX-FORWARD verdicts (missing column-0 GATE-ALLOW marker; stale placeholder-text e2e assertion already replaced by the diff). Deferred from this PR to keep the tooling change scope-tight.

**LL-35 | 2026-07-13 | Seed-only changes silently miss production (SECOND occurrence — same trap as #504).**
Root cause: production runs `prisma migrate deploy`, which does NOT run the TypeScript seed. Any change that lives only in a seed file therefore never reaches prod — silently, with no error, no warning, no failing test. First occurrence: **PR #504** (`tender-package-disciplines` GlobalList added only to seed → New Tender wizard 404'd in prod; fixed with an insert-if-absent migration). Second occurrence: **PR #506** (commit `6b4f165`, "grant marco@initialservices.net super-user in seed (parity with Sean)") changed only `apps/api/prisma/seed-users-prod.ts` and no migration sets `isSuperUser` — Marco and Sean **were never actually super-users in production**. Undetected for weeks; surfaced 2026-07-13 only because Marco was mysteriously bounced out of Rates & Lists. Cost: two rounds of user reports, one wrong root-cause theory, and hours of agent time. Fix: repaired via a per-user idempotent `UPDATE "User" SET "isSuperUser" = TRUE WHERE email IN (...)` migration on the follow-up PR. Standing guard: **CP-23 `seed-without-migration`** in `scripts/pr-gates/pr-gates.mjs` — if a PR touches `apps/api/prisma/seed*` (or `apps/api/prisma/seed/**`) but adds no new folder under `apps/api/prisma/migrations/`, the gate FAILS with the "prisma migrate deploy does not run the TS seed" explanation. Escape hatch (mirrors GATE-ALLOW): a column-0 `SEED-ONLY: dev -- <reason>` line in the PR body, which makes the author consciously state that prod does not need the change. Silence is the enemy; explicit dev-only acknowledgement is fine.

## Open items (check before starting related work)

- LL-11 deploy.yml failing on every main push — diagnosed 2026-06-12 (secrets-in-if validation failure); fix PR open from `fix/deploy-workflow`, close this item when merged + next main push shows no phantom run.
- LL-07 parked decision: disposable DB for smoke runs vs CP-G5 post-smoke check.
- F2-02 documents access-rule test — `test.todo` marker in CP-18 spec (parked by Marco).
- Offline/PWA e2e items — candidate batch 9 (skipped in batch 7 by design).


---

<!-- ============================================================
     MERGED SOURCES  (sot-consolidation, 2026-07-08)
     Primary (above): docs/lessons-learned/incident-ledger.md
     Merged below from:
       - docs/adr/0001-unified-tender-comms-panel.md
       - docs/lessons-learned/README.md
       - docs/migration-history-audit.md
       - docs/legacy-ai-providers-investigation.md
       - docs/audits/2026-05-02-system-audit.md
     ============================================================ -->

## Lessons-learned methodology & directory conventions

*(Source: `docs/lessons-learned/README.md`. The ledger above is the canonical,
append-only record; this section documents the conventions that govern it and
the standalone per-incident files.)*

Lessons learned capture **concrete incidents** where a real issue surfaced — a
Codex review finding, a regression caught in smoke, a near-miss in a destructive
operation — so future work doesn't repeat them.

One markdown file per incident, named with the date and a short slug. Each entry
follows this structure:

1. **What happened** — concrete description, with PR / commit references where
   applicable.
2. **Why it matters** — what the realistic blast radius could have been.
3. **Lesson** — the rule to apply going forward.
4. **References** — links to PRs, Codex review URLs, commit SHAs, related files.

These are **not architecture rules** (those live in `sot/01-charter-and-architecture.md` §6).
These are **war stories** — pointed enough to learn from, narrow enough not to
over-generalise.

The canonical, append-only record of every incident lives in
the incident ledger above (this document, `sot/05`) — start there. Standalone per-incident files are kept only
when their detail exceeds what fits a ledger row; right now the ledger absorbs
everything, including the 2026-05-17 migration date-filter precision case (see
entry `LL-07a`).

---

## Architecture Decision Records (ADRs)

### ADR-0001 — moved to [../docs/adr/0001-unified-tender-comms-panel.md](../docs/adr/0001-unified-tender-comms-panel.md)

### Decision register — Marco's `D<n>` series (D1–D55)

*Registered 2026-08-20, at `origin/main` `1bf4aab5`, by Station 05 (SoT Keeper) on Marco's
instruction. This subsection is the **only** place a `D<n>` decision becomes citable.*

#### What this register is, and what it is not

Marco's design decisions have been recorded since 2026-08-17 in a **contemporaneous decision log
held outside this repository** — the "ERP ideas decision log", maintained in Supervisor project
memory and written at decision time. That log is real and it is dated, but it is **not the source
of truth**, because `sot/README.md` reserves that role for `/sot/` alone. Until now the two
documents each claimed authority over decisions and neither referenced the other. **Landing this
register is what resolves that collision.**

Every row below is transcribed verbatim from that log. Rows are **not** improved, merged or
paraphrased; where the log carries an inline ⚠️ correction it is preserved, because those
corrections are the audit trail.

Each row carries a status:

- **`REGISTERED`** — an artifact *in this repository* independently corroborates the decision, and
  a human has read that artifact and confirmed it means the same thing. The anchor is named.
- **`QUARANTINED`** — **recorded, but NOT binding.** No repo anchor exists. A quarantined row is
  a faithful transcription of what the log says, awaiting Marco's confirmation.
  **Citing a `QUARANTINED` row as authority is an error.**

Of the 55 decisions: **20 REGISTERED, 35 QUARANTINED.**

#### ⚠️ The `D<n>` identifier is not unique in this repository

This was discovered while building the register and it is load-bearing. **At least four independent
`D<n>` series coexist**, and a bare `grep -E '\bD[0-9]+\b'` conflates all of them:

| Series | Example | Not to be confused with |
|---|---|---|
| **Marco's master log** (this register) | `D48` — explicit owner + share grants | — |
| `tender-tracker-migration-plan.md` local list | `D3` *T-number is the idempotency key*, `D8`, `D9` — cited in `apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts:12-16` | Marco's D3 (payroll), D8 (branding), D9 (rate aggregator) |
| `estimating-analytics-plan.md` local list | `D3`/`D4`/`D5` in `apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts:7-10` | Marco's D3, D4, D5 |
| `sot/06-active-specs.md` dashboard catalogue | `D1`–`D5` are **widget IDs** (`D1` = "Milestones due / overdue"), `:1223-1227` | not decisions at all |

Incidental false positives also exist and are not decisions of any kind: `mergeCells("A1:D1")`
(`estimate-excel.builder.ts:62`), the test fixture `ZZTEST-BP0A3-D1`, and `PRs C1-D1`
(`sot/06:1346`).

**Consequences, both of which matter:**

1. A corroboration sweep by bare identifier match is worthless. Every `REGISTERED` row below was
   confirmed by *reading the cited text*, not by counting grep hits.
2. **A checker that fails on any `D<n>` present in the repo but absent from this register would be
   wrong**, not merely noisy — it would demand that a spreadsheet cell reference and three unrelated
   plan-local decision lists be registered as Marco's decisions. Any such checker must first
   disambiguate the namespace. This is a stronger objection than the volume concern.

**Proposed remedy — needs Marco, not actioned here:** plan-local decision lists should be renamed to
a plan-scoped prefix (e.g. `TFM-D3`, `EA-D3`) so that `D<n>` unambiguously means "Marco's register".
Allocation of `D` numbers is Marco's alone, so this register does not renumber anything.

#### Intake rule (binding once this register lands)

1. A decision is **not citable** until it appears in this register.
2. New `D<n>` numbers are **allocated by Marco only.**
3. A `QUARANTINED` row is recorded, not binding. Citing one as authority is an error.

#### The register

| # | Brief | Decision | Status | Anchor |
|---|---|---|---|---|
| D1 | method | Decisions first, then build in document order 1→8 | QUARANTINED | — |
| D2 | 2.8.3 | Rates/SoR prompts **split backend vs UI**; backend may ship; screen changes wait for the redesign, with mock-ups for visual approval | QUARANTINED | — |
| D3 | 4.2.5 | Payroll = prepare & export to Xero. ⚠️ **Contracts are on the Building & Construction Award** (corrected 08-17). Marco supplies a Xero payslip template. We never assert a pay rate. | QUARANTINED | — |
| D4 | 2.4.1/.2 | Administration keeps 3 sections; kill duplicated entries only | QUARANTINED | — |
| D5 | 1.2.1 | Colour/density **themes**, not layouts | QUARANTINED | — |
| D6 | 2.4.4 | Automations: leave as-is, improve later; add explanatory copy on the page | QUARANTINED | — |
| D7 | 2.5.1 | Only sysadmin/superuser can untick a permission; users get read-only "what I'm missing" + request | QUARANTINED | — |
| D8 | 2.6.7.1 | Branding on **system-generated** docs only; uploaded docs untouched | QUARANTINED | — |
| D9 | 2.8.2 | Rate aggregator: one canonical rate line, each subbie/supplier hangs a price off it | QUARANTINED | — |
| D10 | 3.1 | Merge Safety + Cases + Compliance into one Issue register. KB excluded | QUARANTINED | — |
| D11 | 3.1.1 | **KB becomes the IMS** — Explorer-style folder tree, curated by compliance/super admin | QUARANTINED | — |
| D12 | 3.2.1 | Rename Documents → **"System Archives"**; extend "Ensure Folder" so every module gets folders | QUARANTINED | — |
| D13 | 4.1.1f | Assignar-style skills model — see D30 for the confirmed shape | QUARANTINED | — |
| D14 | 4.2.4 | Medical info: HR role/skill only, **access logged** | QUARANTINED | — |
| D15 | 4.5.1 | **Dockets unchanged**; Expenses gain Company-expense vs Personal-reimbursement | QUARANTINED | — |
| D16 | 6.1.1 | "Fold Jobs and Sites" = **site dissolution**. Stage that plan | QUARANTINED | — |
| D17 | 7.1.2 | Merged duplicate clients kept as **alias**, never hard-deleted | QUARANTINED | — |
| D18 | 7.2.2 | Per-tender CRM portal = **workspace**. Mock-up round owed | QUARANTINED | — |
| D19 | 7.3.2 | Communicator: all three behaviours eventually; not now | QUARANTINED | — |
| D20 | 8.2.1 | **Release S2a** (bidStatus schema) so Submitted is real | QUARANTINED | — |
| D21 | 8.2.5.4 | Material-density editing waits inside the Rates & Lists redesign | QUARANTINED | — |
| D22 | 8.2.7 | Shift Period **pulls** the rate; all SoW fields editable; edits never push back | QUARANTINED | — |
| D23 | 2.6.5 | Fuel/Operations → Tendering (pricing) + Projects (driver-facing fuel/tip routing) | QUARANTINED | — |
| D24 | 1.2.1 | Theme sequencing **option C** — token cleanup on the most-used screens first | REGISTERED | `docs/plans/theme-system-plan.md:4` |
| D25 | 2.1 | Every data domain **can** be shared between companies, **nothing by default**, plus an **Import** option to copy between companies | REGISTERED | `docs/plans/multi-tenant-plan.md:15` |
| D26 | 2.6.6 | **Finish the Job/Project fold properly** (B-P0a-5…-9); schedule when the board is quiet | REGISTERED | `docs/pr-prompts/BACKLOG.yaml:428` |
| D27 | 2.8.2 | A missing rate is **"No rate" / "N/A"**, never 0; empty or 0 auto-display as N/A and are excluded from cheapest-source comparison | QUARANTINED | — |
| D28 | 3.1.1 | IMS permissions: folder-level with inheritance + role grants, **documents require read acknowledgement** | QUARANTINED | — |
| D29 | 4.1.1 | **Hard-block on qualifications; warn-with-logged-override on age and tenure** | QUARANTINED | — |
| D30 | 4.1.1f | Requirement = qualification \| training \| age min \| tenure min \| **another skill**; Skill = named bundle (nesting falls out); JobRole requires skills + carries base hourly cost (sysadmin/payroll/superadmin only); eligibility is **computed, never manually ticked**; scheduler filters on it; profile shows what's missing | QUARANTINED | — |
| D31 | 4.2.5.2 | ERP computes **hours + allowances + penalty FLAGS**; Xero applies the rates | QUARANTINED | — |
| D32 | 4.4.5.1 | Geofence: **last fence entered wins**; overlaps flagged for supervisor allocation | QUARANTINED | — |
| D33 | 4.5.2.2 | Expenses ex-GST on screen; Xero push uses a **per-category GST default** | QUARANTINED | — |
| D34 | 5.1.2 | Deployed seed data: cleanup script **+** delete UI. ⚠️ **Marco runs the script, not an agent.** Also find out how demo seed reached production | REGISTERED | `docs/plans/tender-folder-model-plan.md:6,48` |
| D35 | 8.2.4 | **Rewrite existing tender numbers** — all came from an import, nothing was ever issued from the ERP, so there is no risk | REGISTERED | `docs/plans/tender-folder-model-plan.md:6,41` |
| D36 | 8.2.4/8.2.5 | SharePoint decides naming and **supersedes the client filename suffix**: folder `T260817 – Northshore` with shared tender subfolders plus a `Quotes` folder holding one subfolder per client | REGISTERED | `docs/plans/tender-folder-model-plan.md:6` |
| D37 | 8.5.1 | Dashboard reports = **named report views with saved filters, pinnable as tabs**; `/reports` redirects | QUARANTINED | — |
| D38 | 1.2.1 | **All four schemes approved** — IS Teal, Initial, Graphite, Harbour. Mock-up round CLOSED | QUARANTINED | — |
| D39 | 2.6.7 | **Theme builder replaces Settings › Company › Branding**, folded into SLICE 17 | QUARANTINED | — |
| D40 | 1.2 | Themes change colour/type/spacing/radius/component styling **only** — never layout or menu positions | REGISTERED | `docs/plans/settings-home-plan.md:314` |
| D41 | 1.2.1 | Cleanup areas = tendering + CRM + jobs/projects/scheduler **+ shared components** | QUARANTINED | — |
| D42 | process | ~~**Leave SLICE 0 gate PRs open; never merge them.**~~ **RESCINDED — Marco, 2026-08-20.** Do NOT cite this as authority. Evidence it was rescinded on: #1146 / #1149 / #1150 were all merged 2026-08-17 and their SLICE 0 prompts then ran, i.e. the practice had already diverged from the rule and the merged outcome was the intended one. Recorded by Station 05 on 2026-08-24 from the standing-instruction set; the ruling itself is Marco's, dated 2026-08-20 | RESCINDED | `docs/plans/tender-folder-model-plan.md:6,46` · merged PRs #1146, #1149, #1150 (2026-08-17) |
| D43 | 2.2 | Settings Home = **flat by default, Grouped toggle** | REGISTERED | `apps/web/src/pages/settings/SettingsHomePage.tsx:12` |
| D44 | 2.2 | Search covers **name + description + tab name**, deep-links to the tab | REGISTERED | `apps/web/src/pages/settings/settings-search.ts:5` |
| D45 | 2.2 | Permission-locked settings **SHOWN, not hidden** — greyed, lock, permission named, working **Request access** | REGISTERED | `apps/web/src/components/SettingsShell.tsx:74` |
| D46 | 2.2 | Locked grouped at the **BOTTOM** under "Needs access · N" in BOTH views | REGISTERED | `apps/web/src/components/SettingsShell.tsx:74` |
| D47 | 2.3 | PR Master drafts all §2.3 descriptions from code for one Marco review pass, flagging guesses | REGISTERED | `apps/web/src/components/settings-nav-items.ts:10` |
| D48 | 2.1 | **Explicit owner + explicit share grants.** Blank `tenantId` is not a valid state (supersedes the 2026-08-04 "null = shared" mechanism; Model A itself unchanged) | REGISTERED | `apps/api/prisma/schema.prisma:45`; `apps/api/prisma/migrations/20260819160000_mt4_slice1_share_tables/migration.sql:1` |
| D49 | 2.1 | **Master data and reference data only.** Transactions stay company-owned | REGISTERED | `docs/plans/multi-tenant-plan.md:17` |
| D50 | 2.1 | **Import = a fully independent copy.** No link back, no sync. Import is NOT sharing | REGISTERED | `docs/plans/multi-tenant-plan.md:15` |
| D51 | 2.1 | **Super admin / system owner only** may grant a share or run an Import | REGISTERED | `docs/plans/multi-tenant-plan.md:19` |
| D52 | tender-full-export | **Permission = SUPER-USER ONLY, for now.** Deliberately *not* the archive `jobs.view` precedent: that was set when this was framed as a backup, and it is now **information disclosure** — a whole tender including internal notes and a document index leaving the system. Ship it restricted; widen later. | REGISTERED | `docs/plans/tender-full-export-plan.md:15` |
| D53 | tender-full-export | **Scope = BULK over the filtered register only.** One entry point, mirroring the CSV export fixed in #1146 (respects active filter chips, ignores selection). **No single-tender button on `TenderDetailPage`** — one code path, one permission check. | REGISTERED | `docs/plans/tender-full-export-plan.md:16` |
| D54 | rates s11c | **Build the PR now, held.** `pr-rates-s11c-drop-legacy-tables` gets `backfill: false` **with an explicit note that this is a DROP, not a data transform** — the field must not read as "harmless". `escalates: true` means arming builds a reviewable PR and applies `do-not-merge`; **the DROP happens at MERGE, and Marco takes a database backup first.** | REGISTERED | `docs/pr-prompts/BACKLOG.yaml:569` |
| D55 | settings-restructure | **Station 05 drafts the `sot/01` §9 prose**, Marco reviews the PR rather than a blank page. The marker `docs/audits/settings-restructure-sot-reconcile.md` rides in the **same** doc-reconcile PR — CP-24 explicitly permits `sot/ + docs/` (`pr-gates.mjs:326-327`; `docs/**` is absent from `codeRe` by design). The "marker can't ride a sot-only PR" claim is **FALSE** and must stop being repeated. | QUARANTINED | — |

#### Rows needing Marco's attention beyond simple confirmation

- **D48 is the most important row in this register.** It is cited as the stated justification for
  **live production schema** (`schema.prisma:45` and the SLICE 1 migration). Until today that
  justification pointed at nothing in the repository.
- **D42 — RESOLVED 2026-08-20 (Marco): RESCINDED.** It contradicted observed history: #1146 / #1149
  / #1150 were all merged on 2026-08-17 and their SLICE 0 prompts then ran, which is the opposite of
  "never merge them". Marco ruled the merged outcome was the intended one. The row is now marked
  RESCINDED and **must not be cited as authority**. Recorded by Station 05, 2026-08-24.
- **D55 is QUARANTINED** and is the decision that authorised this register's sibling work. It has no
  repo anchor. It is transcribed faithfully and awaits confirmation like any other quarantined row.

---

> Migration History Audit — 2026-06-19 moved to [../docs/migration-history-audit.md](../docs/migration-history-audit.md).

> Investigation — Legacy "My Account → AI providers" section (2026-05-02) moved to [../docs/legacy-ai-providers-investigation.md](../docs/legacy-ai-providers-investigation.md).

> System Audit — 2026-05-02 moved to [../docs/audits/2026-05-02-system-audit.md](../docs/audits/2026-05-02-system-audit.md).

## Incident — CRLF/LF schema-hash bug in the data-model drift gate (2026-07-13)

**Severity:** blocked the entire PR board for ~3 days. Two independent diagnoses were wrong
before anyone read the CI log.

### What happened

`scripts/data-model/build-relationship-map.mjs` computed the schema fingerprint by hashing the
**raw bytes** of `apps/api/prisma/schema.prisma`:

```js
const schemaSha = createHash('sha256').update(text).digest('hex');   // BUG
```

Windows checks the file out with CRLF line endings; Linux CI checks it out with LF. **Identical
content, different sha256.** So `build-relationship-map.mjs --check` passed on whichever platform
generated the committed `relationship-map.json` and failed on the other. The `data-model-drift`
CI job (PR #536) therefore self-failed on a branch whose map was perfectly correct.

### Fix (PR #536)

Normalise line endings before hashing:

```js
const normalized = text.replace(/\r\n/g, '\n');
const schemaSha = createHash('sha256').update(normalized).digest('hex');
```

Canonical schema sha changed `454906b95970` → `b31c4217323d`. Any branch carrying data-model
artifacts generated before this fix must regenerate them or the gate will fail.

### Why it took three days — two wrong diagnoses, both from inference

1. ❌ *"The gate self-fails on the per-run `Last updated` timestamp."* Plausible, wrong.
2. ❌ *"`main`'s map is stale after #539's domain reclassification."* Also plausible, also wrong —
   the counts and content were correct all along; only the **sha comparison** was broken.

Both were derived from reading artifacts (PR diffs, sweep output) instead of the failing job log.
The agent that ran `gh run view <run> --job <job> --log` and reproduced `--check` locally on both
platforms found the real cause in one pass.

**Lesson (this is the existing rule, and it was broken):** *never diagnose a CI failure without
the job log.* Artifact-based inference produces confident, coherent, wrong answers. If you catch
yourself reasoning about *why* a check might be failing, stop and go read the log.

### The second failure — the SoT sweep and CI disagreed, and nobody noticed

The daily SoT sweep reported **"schema -> map: clean"** every single day while CI was red on the
same check. It was not a false-negative in the sweep's *method*: the sweep DOES run
`build-relationship-map.mjs --check` (its step 1). It is a **platform** disagreement:

- The sweep runs against the **Windows working tree** (`C:\ProjectOperations2`, checked out
  **CRLF**). The committed `relationship-map.json` sha was also generated on Windows, from CRLF
  bytes. They matched -> `--check` printed **OK**.
- GitHub Actions checks the repo out with **LF**. Hashing LF bytes produced a different sha ->
  `--check` printed **DRIFT**.

**The same command gave opposite answers on the two platforms, and the sweep only ever saw one of
them.** Four sweeps in a row confidently reported clean while the board was blocked.

**Required hardening of the sweep:**
- A local `--check` PASS is NOT sufficient evidence of health. The sweep MUST also read the
  **actual CI check-run conclusion** for `data-model-drift` on `main` and on open PRs, and treat
  local-PASS + CI-FAIL as a first-class finding ("environment disagreement"), not as clean.
- It MUST assert `docs/data-model/metadata-catalog.json` parses as valid JSON. It reported that
  file as invalid (unterminated string @ offset 407816) for four consecutive sweeps and nothing
  ever acted on it.
- It MUST NOT run `build-toc.mjs --check` against `sot/` files: none carry `TOC:START`/`TOC:END`
  markers, so the check reports drift unconditionally and cries wolf daily. Either add markers to
  `sot/` or exclude `sot/` from that check.

### Generalised lesson — line endings on a Windows dev box + Linux CI

Any tool that fingerprints file *content* must normalise line endings first. Check
`.gitattributes` before adding a new content-hash or checksum gate. This is now the second
Windows/Linux parity class of bug in this repo (see also the PS 5.1 encoding rule).

---

## Incident — a 3-day-old `.git/index.lock` silently froze the local tree (2026-07-13)

### What happened

`C:\ProjectOperations2\.git\index.lock` was left behind by an interrupted git operation on
**2026-07-10 16:05**. Nothing cleaned it up. For **three days**:

- every `git pull` / `checkout` / `merge` in that tree failed with
  `fatal: Unable to create '.../index.lock': File exists`,
- local `main` stayed pinned at `e1d1197` while `origin/main` moved on by 5 commits,
- and — the expensive part — **every tool and every agent reading that working tree was reading
  three-day-old source code without knowing it.**

### The damage

A Cowork chat grepped the frozen tree, found no `apps/web/src/auth/permissions.ts`, and concluded
that **PR #537 had over-claimed and never landed its `can()` / `isAdminUser()` helper**. That
accusation was **false**. #537 had landed correctly; the file simply did not exist in the stale
snapshot. A PR prompt was armed on that false premise and had to be rewritten before it ran.

The same stale tree also reported the old `schemaSha256` and a missing CRLF fix, muddying the #536
diagnosis.

### Lessons

1. **A stale lock is silent by design.** Git only complains when you *write*. Every *read* — grep,
   cat, an agent's `Read` tool — happily returns frozen content with no warning at all. This is the
   most dangerous failure mode a source of truth can have: confidently wrong, never noisy.
2. **Before drawing any conclusion from the working tree, confirm the tree is current.**
   `git status` (is it behind?) and `git log --oneline -1` cost nothing. A conclusion drawn from an
   unverified tree is worth nothing.
3. **Never accuse a PR of over-claiming without checking against `origin/main`, not your local
   tree.** The "watcher agents over-claim done" pattern is real (#476, #478) — which makes it
   *easier* to jump to it, and therefore more important to verify. Use
   `git fetch && git show origin/main:<path>` or the GitHub API, never a local checkout you have not
   verified.
4. **If git behaves oddly at all, check for `.git/index.lock` FIRST.** Check its age
   (`Get-Item .git\index.lock | Select CreationTime`) and whether a real `git` process is running
   (`Get-Process git`). No process + an old lock = stale, safe to delete. This is now the third
   local-git wedge in this repo (see also the dev-start.bat and dirty-tree recovery entries) —
   assume it before assuming anything cleverer.

### Preventative

Add a stale-lock check to the local dev-start / doctor path: if `.git/index.lock` exists and no
`git` process is running, warn loudly (or clear it) rather than letting the tree silently rot.

---

## Incident — a seed-only change never reaches production (2nd occurrence, 2026-07-13)

**This is the same trap as #504. It has now happened twice. A CI gate is the only reliable cure.**

### The rule being broken

Production runs `prisma migrate deploy`. **It does not run the TypeScript seed.** A change that
lives only in a seed file therefore never reaches production — with no error, no failing test, and
no warning of any kind. It is a completely silent failure.

### Occurrence 1 — PR #504

`tender-package-disciplines` GlobalList added to the seed. Prod never received it → the New Tender
wizard 404'd in production. Fixed with an insert-if-absent migration.

### Occurrence 2 — PR #506 (`6b4f165`)

"grant marco@initialservices.net super-user in seed (parity with Sean)". It changed **only**
`apps/api/prisma/seed-users-prod.ts`. No migration sets `isSuperUser` anywhere in the repo.
**Result: Marco and Sean were never actually super-users in production.**

Detected on 2026-07-13 only because Marco was mysteriously bounced out of Rates & Lists. The
diagnosis path was expensive and went wrong twice before landing:

- First theory: "PR #537 over-claimed and never landed its `can()` helper." **False** — derived from
  a working tree frozen for 3 days by a stale `.git/index.lock` (see that incident above).
- Second theory: "stale JWT — the flag was set after the token was issued." **False** — a freshly
  issued token (`iat` = 11:12 that morning) still carried `isSuperUser: false`.
- Actual cause: the flag had never been written to the production database at all.

The decisive evidence took 30 seconds once someone thought to look: decode the JWT in the browser
and read the claim.

### Lessons

1. **"It's in the seed" is not the same as "it's in production."** Ask, every time: *does prod
   actually need this data, and if so, what migration puts it there?*
2. **A silent failure is more expensive than a loud one.** Nothing failed. No test went red. The
   only symptom surfaced weeks later as a confusing UI bug, and cost two wrong theories to reach.
3. **Check the claim before the code.** When an authorization guard misbehaves, decode the token
   and read the actual claim FIRST. The guard is rarely the bug; the data behind it usually is.

### The backstop (now built)

CI gate: any PR that modifies `apps/api/prisma/seed*` **without adding a migration** fails, unless
the PR body explicitly declares `SEED-ONLY: dev — <reason>`. The point is not to block seed changes
but to force the author to consciously state whether production needs the data. See
`pr-ci-guard-seed-never-reaches-prod-ready.md`.

---

## Shared company infrastructure (Azure / Entra / SharePoint)

**LL-36 | 2026-07-13 | An agent walked Marco through deleting a live production secret BEFORE
verifying everything that depended on it. Two systems shared the credential; only one was tested.**

**What happened.** Production SharePoint was migrated from an Entra client secret to a system-assigned
managed identity (#547). The proof was sound: delete `AZURE_CLIENT_SECRET` from App Service, confirm
SharePoint upload+open still works — with no secret present, only the MI can be authenticating.

The instruction Cowork gave was, in effect, *"delete the secret, and also test email."* Those two steps
were issued in the same breath and **in the wrong order**. Marco deleted both secrets from the app
registration (revoking them tenant-wide) before email was ever tested.

**What saved it was luck, not process.** `outlook.provider.ts` builds its own `ClientSecretCredential`
and resolves creds via `resolveMailCreds()`, which reads ONLY `AZURE_MAIL_*` ?? `SHAREPOINT_*` — never
`AZURE_CLIENT_SECRET`. None of those six env vars had ever existed in production, so Outlook email had
**never worked at all**. There was nothing to break. Had mail been correctly configured on the same app
registration, deleting those secrets would have taken down all outbound email with no rollback (Azure
never shows a secret value twice).

**Two distinct failures, two distinct guards.**

1. **Ordering.** A verification step that gates an irreversible action must be issued, and completed,
   BEFORE the irreversible step — never alongside it. This is the same rule as
   "steps in strict execution order," but the stakes are higher: an irreversible step whose gate is
   listed *after* it is not a gate at all. When one credential serves N systems, enumerate all N and
   verify each **before** revoking anything. Grep for every consumer of the credential
   (`grep -rn "ClientSecretCredential\|AZURE_CLIENT_SECRET" apps/`) — do not assume one adapter owns it.

2. **Authority.** Marco (2026-07-13): *"no one should touch azure/entra/sharepoint without my
   supervision."* Standing guard, now written into `sot/README.md` (Execution Authority section), all
   five scheduled-agent `SKILL.md` files, and the Cowork project instructions: **no agent mutates Azure,
   Entra, or SharePoint tenant state — ever.** Agents write the code, the migration, the runbook and the
   exact steps; a human executes them. These are shared company systems and the blast radius reaches
   real staff and real documents, far outside this repo.

**Side finding (still open):** Outlook email has never worked in production. Fix armed as
`pr-zz-mail-managed-identity-ready.md` — gives mail a `MAIL_AUTH_MODE` managed-identity path mirroring
#547 (the MI already holds the `Mail.Send` app role, granted 2026-07-13 and currently unused), and makes
the failure loud instead of silently swallowed. **Do not "restore a secret" to fix it.**

**LL-37 | 2026-07-13 | The new supervisor agent declared "WATCHER IS DOWN — QUEUE FROZEN" and
escalated an emergency. The watcher was alive the whole time, actively consuming the queue.**

Two independent bugs, same shape — **one weak signal, believed instantly, with no cross-check:**

1. **Cross-OS process check.** It ran `ps aux | grep watcher` in the **Linux sandbox**. The watcher
   is a **Windows** process. That search can never succeed, however healthy the watcher is. The
   "no process found" evidence was guaranteed empty before it ran.
2. **Timezone.** It read a log stamped `07:30:27 UTC`, compared it against the local clock (~17:30
   Brisbane, UTC+10), and computed "last run 10+ hours ago." **07:30 UTC IS 17:30 local — the run
   was six minutes old.** A ten-hour outage manufactured out of a units error. Note the tell: the
   phantom gap was *exactly* the UTC offset.

**The near-miss.** It was one step from running `restart-watcher-if-wedged.ps1 -Fix`, which would
have killed a healthy watcher mid-run. Defence-in-depth held only by luck: that script checks the
live heartbeat and would have returned HEALTHY and refused. **The agent's real error was bypassing
the deterministic script and reasoning from raw `ps` output instead.**

**Standing guards (now in the supervisor's SKILL.md):**
- **Liveness is decided ONLY by `restart-watcher-if-wedged.ps1`** (armed work + queue movement +
  live heartbeat + the real Windows process table). Never by bash/`ps`/the sandbox.
- **If the script cannot run, the verdict is `CANNOT VERIFY` — never `DOWN`.** An unverified
  watcher is not an outage. Do not escalate, do not restart.
- **Logs are UTC; the machine is AEST. Never subtract one from the other.** Let the scripts compute
  ages — they work in one timebase and print "N min ago" for exactly this reason.
- **A real outage shows ALL signals dead at once.** If signals disagree, the diagnosis is wrong, not
  the system. Here the queue had just moved, the heartbeat was fresh, and prompts were being
  consumed — any one of those refutes "down."

**Why this matters beyond the near-miss:** a false emergency trains the human to ignore the agent.
Cry wolf once and the next real outage gets shrugged at. An alert that is wrong is worse than no
alert.

**LL-38 | 2026-07-13 | The supervisor agent tried to do the WATCHER's job, abandoned a merge
half-finished in the watcher's git repo, and then reported "no supervisor intervention needed."**

Its SKILL said *"Default is DO IT"* and listed fixes. It read that as authorisation to **execute an
armed queue prompt itself.** It ran `git merge origin/main` on #538's branch inside
`C:\po-watcher\ProjectOperations`, hit a conflict in `apps/web/src/pages/AdminSettingsPage.tsx`,
walked away mid-merge, and wrote a report saying the system was nominal.

It left `MERGE_HEAD` in place on a feature branch. **Every watcher prompt begins with
`git checkout`.** All 10 armed prompts would have failed on a dirty index. **The entire overnight
queue was dead, and the agent's own report said everything was healthy.** Marco caught it by eye.

**Root cause is the instruction, not the agent.** "Default is DO IT" was written to stop it filing
status notes asking Marco to run commands. It never said *which* actions were its own. An agent given
a broad mandate and a shared resource will use both.

**Standing guards:**
- **The supervisor NEVER runs `checkout` / `merge` / `rebase` / `commit` / `push` / `pull` in the
  watcher's repo.** Read-only git (`status`, `log`, `diff`) and `gh` reads are fine and expected.
- **The supervisor NEVER executes an armed queue prompt.** If a fix is armed, the finding is *"the
  fix is armed and will run"* — not *"I'll do it now."* Its entire fix set is: restart a WEDGED/DOWN
  watcher, rename a LOOPING prompt, report. Nothing else.
- **Why:** the supervisor and the watcher share one working tree, and the watcher is a live daemon
  that can start a prompt at any moment. **Two agents, one git index, no locking.** That is precisely
  why supervision and execution must be separate roles.
- **`watcher-loop-check.ps1` now hard-checks repo integrity** (MERGE_HEAD / rebase-in-progress /
  unmerged paths / not-on-main) and prints a blocking banner: *"THE QUEUE IS DEAD."* Recovery:
  `scripts/rescue-watcher-repo.ps1` (aborts the merge, clears stale locks, returns to clean main —
  fully reversible, nothing lost).

**The meta-lesson, and the reason this is logged rather than quietly fixed:** the agent wrote *"no
supervisor intervention needed"* in the same run in which it broke the system. **Its report described
its intentions, not its effects.** Any agent must re-check the state it touched before writing a
verdict. A supervisor that damages the thing it watches and then reports "nominal" is worse than no
supervisor at all — it actively suppresses the alarm.


---

**LL-39 | 2026-07-14 | YOUR INSTRUMENT LIES. Six times a broken TOOL produced a confident, coherent, WRONG verdict about a perfectly healthy system.**

This is the most dangerous failure class in this repo, and it now has its own doctrine section:
**`docs/pipeline/DOCTRINE.md` §7** — read it. A broken *system* fails loudly. A broken *measurement*
hands you a plausible answer and you act on it.

Twice it nearly caused real damage: one agent almost "repaired" clean UTF-8 files **into** corruption;
another declared a live watcher dead and killed the overnight queue.

| # | The lie | The truth | The cause |
|---|---|---|---|
| 1 | "WATCHER IS DOWN — QUEUE FROZEN" | It had run **6 minutes ago** | Linux `ps \| grep` in a sandbox against a **Windows** process; then a UTC log line compared to a local clock. **Logs are UTC; the machine is Brisbane (UTC+10).** |
| 2 | "`sot/` files are corrupted — em-dashes eaten, `?` everywhere" | Files were **clean UTF-8**, zero replacement chars | **PS 5.1 `Get-Content` decodes BOM-less UTF-8 as Windows-1252.** The mojibake was in the READER. The proposed "fix" (`-Encoding ascii`) would have caused the corruption **for real**. |
| 3 | "premise satisfied — work already done" → **BINNED THE PROMPT** | The premise never **ran** | `shell: "/bin/bash"` — **Windows has no `/bin/bash`.** Spawn failure gives `err.status === undefined` → `-1`, which was not in the broken-list, so it was misread as "premise false". **It would have silently discarded the entire backlog while printing green.** |
| 4 | "NOT IDEMPOTENT / ADMIN EDIT OVERWRITTEN" | The migration was perfectly idempotent | Wrong DB role → **every psql call failed** → empty strings compared unequal. A connection failure wearing a finding's clothes. |
| 5 | "No such container: 35" | The container was fine | **PowerShell variables are CASE-INSENSITIVE.** A local `$c` (column count) silently clobbered `$C` (container name). |
| 6 | "NOT IDEMPOTENT" — while printing two **identical** row counts | It was idempotent | **A PowerShell function returns ALL its output**, not just `return`. `Write-Output` inside the function was captured into the return value. |

Note the shape: **four of the six were a failed call being read as a meaningful answer.**

**A seventh, same week, same class:** the evidence-gate self-test printed **PASS while the library was
not even loaded** — it dot-sourced a hardcoded path, every function was undefined, and `Should-Throw`
accepted *"the term Assert-Mergeable is not recognized"* as a successful refusal. **A guard test that
goes green while the guard does not exist is worse than no test.**

**THE RULE.** Before believing a **negative** result — *"it's broken", "it's missing", "it's already
done", "it's down"* — **prove your instrument can produce a POSITIVE one.** A check never observed to
succeed is not a check. And **a tool that cannot run must FAIL LOUD, never fail quiet**: *"I could not
measure it"* must never silently become *"it measured false"*.

**Standing guards** (full list in DOCTRINE §7): positive control first · connect-then-assert (abort on
a failed connection; never let it flow into a comparison) · verify file bytes with `node`, not
`Get-Content` · liveness ONLY via `scripts/restart-watcher-if-wedged.ps1` · no single-letter PowerShell
variables · no `Write-Output` inside a function whose value you capture · `$ErrorActionPreference =
"Continue"` in git scripts (git warns on stderr, and `"Stop"` aborts you *before* your commit while the
log still looks clean) · never pass `-q '<jq>'` to `gh` from PS 5.1, and **assign-then-foreach** —
piping a JSON array into `Where-Object` collapses it to ONE object, which is the bug that once let the
merge queue select **#552, the production-data PR**.

**If your instrument breaks mid-task, say so.** `NO-OP: my check was broken; here is what I could not
measure.` That is a **success**. Reporting a verdict obtained from a broken instrument is the worst
outcome available — worse than doing nothing, because someone will act on it.


## Lessons LL-42 to LL-56 -- migrated from Cowork chat memory (2026-07-23)

These lessons existed only in Cowork chat memory files, which NO agent in a worktree can read
(the exact failure mode LL-38-era audits found in the backlog). Migrated here so every station,
watcher run and chat sees them. Format unchanged: symptom -> root cause -> fix -> standing guard.

### Tooling / shell (Windows dev box)

**LL-42 | 2026-07 | Global `npx prisma` is v7 and false-fails the repo's v6 schema.**
Root cause: version skew between the global binary and the repo pin. Fix/Standing guard: always run
the REPO binary (`pnpm exec prisma` / `node_modules\.bin\prisma`) for validate/migrate; a validation
failure from the global binary is the instrument lying (LL-39), not a schema bug.

**LL-43 | 2026-07 | PowerShell `>` redirection writes UTF-16; node/git apply then choke on the BOM. The DC shell layer also EATS `$` in inline commands.**
Root cause: PS 5.1 default encoding + MCP shell quoting. Fix: byte-exact writes go through cmd
redirection (`cmd /c "... > file"`) or `git diff --output=<file>`; anything using `$` variables is
written to a `.ps1` file and run with `-File`, never inlined. Standing guard: scripts stay pure
ASCII (LL-22 companion); a mojibake em-dash in output is usually the READER, not the file.

### CI / gates / GitHub behaviours

**LL-44 | 2026-07-20 | Spinner-absence is a FAKE WAIT: an e2e spec waiting for "Loading..." to vanish read an empty list and blamed "fixture drift" (PR #707).**
Root cause: the panel renders BEFORE the fetch is issued, so the loading text is legitimately
absent at t=0 -- absence means "finished" OR "not started". Fix/Standing guard: wait for a POSITIVE
end state (expected row, explicit empty-state text, or waitForResponse armed before navigation);
a test that depends on pre-existing rows must CREATE them via apiFetch, not inherit seed state; and
never write a failure message asserting a cause you have not proven.

**LL-45 | 2026-07-20 | Permission-registry coverage guard is blind to object-literal permission maps; unregistered codes ship as permanently-false gates with CI green (4th occurrence: workers.manage #658, clients.* #655, clients/contacts.view #672).**
Root cause: the guard extracts only `@RequirePermissions(` decorators; PermissionsService upserts
only registered codes and PermissionsGuard is fail-closed. Second trap: `user.permissions` is NEVER
expanded for super-users (isSuperUser is a separate JWT claim), so hand-rolled
`permissions.includes(...)` checks deny super-users. Standing guard: audits grep BOTH
`@RequirePermissions(` and bare "module.action" string literals, with a positive control
(jobs.view must resolve); hand-rolled checks follow the house pattern in
workers/leave-request.service.ts (isSuperUser ||).

**LL-46 | 2026-07-20 | `gh pr view` can serve a STALE head sha right after a push.**
Fix/Standing guard: `git ls-remote` is the truth for the current head; run it before reasoning
about whether CI ran on the latest commit. Related: CodeQL required-context non-dispatch -- a PR
BLOCKED with every visible check green usually needs a NEW sha pushed, not a rerun.

### Watcher / automation pipeline

**LL-47 | 2026-07-20 | Get-Board renders EMPTY labels for every PR; filtering do-not-merge off its output would have merged #705/#708/#717, all labelled.**
Root cause: labels do not survive into the rendered rows -- "no labels" is indistinguishable from
"labels not retrieved" (LL-39 shape #4). Standing guard: before any merge decision, re-read labels
per-PR with `gh pr view <n> --json labels`. Also: `[datetime]$pr.updatedAt` localises UTC -- call
.ToUniversalTime() before age arithmetic or Brisbane offsets go ~600 min negative.

**LL-48 | 2026-07-20 | Set-PrBody THREW "marker NOT bare at column 0" after a write that had SUCCEEDED (PR #721); the natural retry would have churned the body.**
Root cause: GitHub read-after-write lag inside the primitive's own read-back. Standing guard: on a
Set-PrBody throw, verify independently (dump body via cmd redirection, regex-check in node) before
any re-write; only re-write if the marker is genuinely absent.

**LL-49 | 2026-07-20 | A prompt quarantined to failed/ or no-pr-opened/ usually stays COMMITTED as armed on origin/main -- restoring the FS copy re-arms it with NO new PR.**
Root cause: the watcher moves only the filesystem copy (armed by COMMIT, consumed by FILESYSTEM).
Standing guard: `git ls-tree origin/main -- docs/pr-prompts` before re-arming; before restoring,
lint must ADMIT, the premise must re-pass live with a positive control, and the BODY must be
re-read for gates. A transient API-error failure is infrastructure, not a code verdict -- the
prompt is a re-arm candidate.

**LL-50 | 2026-07-20 | The watcher's queuePaused flag is IN-MEMORY with no reset path; PAUSED_SUMMARY.md's "move the prompts back" remedy is a NO-OP against the live paused process. A single transient API error froze 20 unrelated prompts.**
Root cause: pauseQueue() fires on ANY agent exit != 0; nothing persists or expires the flag.
Standing guard: the ONLY recovery is restarting the watcher DETACHED, then restoring
paused/*-ready.md. Diagnose via heartbeat.log LastWriteTime far in the past with node still alive.

**LL-51 | 2026-07-21 | Watcher ALIVE with a fresh-ish heartbeat but frozen N commits behind main: another chat left uncommitted changes in the live clone, tripping the do-not-pull-over-local-changes guard.**
Root cause: work done directly in C:\po-watcher\ProjectOperations (the LL-38 never-touch rule,
violated). Fix order: preserve the work read-only (git diff --output + copy untracked out), stop
the WRAPPER before the node, `git reset --hard origin/main`, relaunch DETACHED via
watcher-launcher + Win32_Process.Create, verify node+wrapper survive >40s and clone is 0-behind.
Standing guard: other chats work in throwaway worktrees, never in the clone. (Recurred 2026-07-22/23;
recovered same way, rescued reviews landed as PR #768.)

**LL-52 | 2026-07-20 | enable-automerge.ps1 ignores the do-not-merge LABEL -- run blanket, it would arm auto-merge on the very PRs Marco parks.**
Root cause: the script excludes only DIRTY and the hardcoded NEVER list (552, 538). Standing guard:
enable GitHub native auto-merge SELECTIVELY per-PR after reading labels per LL-47; GitHub auto-merge
enforces required checks only, NOT an unticked in-body acceptance checklist, so confirm intent
before arming UI PRs.

**LL-57 | 2026-07-31 | A PR body note "do NOT auto-merge / leave for review" does NOT park a PR — only the `do-not-merge` LABEL does. #817 carried the body note but no label, so the watcher auto-merged it the moment CI went green.**
Root cause: both the watcher's merge path and `enable-automerge` key on the `do-not-merge` LABEL (LL-52), never on prose in the PR body. A "leave unmerged for review" / "STANDING AUTHORITY: do not auto-merge" instruction written only in the body is invisible to the automation.
Standing guard: to actually hold a PR for human review, apply the `do-not-merge` label at open time (escalates:true prompts get it automatically per DOCTRINE 5b). Treat body text as documentation, not a gate. If a green PR must wait, the label is the only thing that stops native auto-merge.

### Prompt-writing lessons (for PR prompt authors)

**LL-53 | 2026-07-20 | A 15-file batch arming sweep armed an IRREVERSIBLE table-drop prompt whose "Arm ONLY when..." gate lived in the BODY, below the STATUS block the transform touched.**
Standing guard: before arming, Select-String the WHOLE file for Arm ONLY / DO NOT ARM / irreversible
/ drop / Marco; check each predecessor by grepping its ARTIFACT on a clean origin/main worktree with
a positive control; anything irreversible or Marco-gated is an ESCALATE, never an arm; re-run the
residual sweep after arming and require 0 hits.

**LL-54 | 2026-07-15 | A premise grepped for a line the fix KEPT (wrapped, not deleted) -- lint said ADMIT forever on shipped work. Mirror bug: MustContain needles naming PRE-EXISTING symbols false-fail healthy PRs.**
Standing guard: write premises against the ABSENCE of the fix ("would this command fail if the fix
landed exactly as described?"); choose MustContain needles that name only what the diff ADDS.

**LL-55 | 2026-07-20 | lint-prompt.mjs SILENTLY DROPS column-0 list items in frontmatter ("MISSING_FIELD: scope" on a prompt that visibly has one); watcher dependency comments and lint frontmatter both demand line 1, so they are mutually exclusive.**
Standing guard: indent all frontmatter list items; run lint-prompt.mjs and require exit 0 before
arming; do not chain prompts with the HTML-comment dependency form (use the frontmatter keys from
PR #760).

**LL-56 | 2026-07-16 | check-backlog "READY" is necessary, NOT sufficient: a 12-ready scan contained ZERO clean auto-stages (open design questions, stale duplicates of staged/ prompts, escalates items, already-shipped work).**
Standing guard: before staging a READY item confirm (1) no open decision in BACKLOG-DECISIONS.md,
(2) no staged/ prompt already exists for it, (3) no escalates / production / Azure hard-stop.
Absence-gates on big items read READY until the whole workstream ships -- treat them as "not done",
never as "stage me now".

**LL-58 | 2026-08-04 | Smart Wizard 503'd in production ("repo root not found from API process"): MetadataService resolved docs/data-model/metadata-catalog.json only by walking parent dirs for a repo root, but the deployed App Service artifact ships only apps/api/ (no docs/, no scripts/), so the walk always returned null. A green CI build proved nothing about the deployed filesystem shape.**
Standing guard: a runtime disk read in a deployed service MUST resolve via a __dirname-relative **metadata-catalog bundled asset** (nest build copies it into dist), in order env override -> bundle -> repo-root walk (dev-only fallback). Never rely on a repo-root walk in production; bundle the file into the build artifact and add a unit test that proves the production shape (bundle present, no repo tree). Fixed via docs/plans/smart-wizard-catalog-deploy-plan.md (#874) + PRs #896 (bundle) / #904 (resolver+test) / #910 (runbook+log). Verified live 2026-08-04.
