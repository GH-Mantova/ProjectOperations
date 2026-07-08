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
Root cause: only watcher auto-merge path passes `--delete-branch`; manual merges leave remote branches. Fix/Standing guard: `scripts/branch-prune.ps1` (deletes remote branches whose PR merged, skips open PRs + main); see [vs-code-strategy.md §A3](../docs/vs-code-strategy.md#a3-branch-hygiene-the-pruning-routine) for the recurring schedule + repo setting.

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

### ADR-0001 — Unified tender communications panel

*(Source: `docs/adr/0001-unified-tender-comms-panel.md`)*

#### Status
Accepted — shipped in PR #260 (2026-05-29).

#### Context
The Tender Detail → Overview tab previously had three separate panels for
communications-style entries: Activity timeline (notes), Clarifications &
Communications (RFIs / emails / calls / meetings / notes), and Follow-ups
(tasks with due dates + optional assignees). The split caused:
- Inconsistent author/timestamp display per panel
- No cross-cutting filter (e.g. "show me all entries for client X")
- Duplicate code for create-form modals
- No assignment notifications for follow-up tasks

#### Decision
Introduce a single `TenderEntry` row type with a discriminating `type` field
(`note` | `rfi` | `email` | `call` | `meeting` | `follow_up` | `self_reminder`
| `task`). All three legacy panels collapse to one feed; users filter by
type-group via chips or grouped tabs.

#### Consequences

Positive:
- Single create-form modal with type-conditional fields (due date, assignee)
- Filter chips work uniformly across all types
- Task assignment fires in-app notification + email
- Pre-existing data backfilled idempotently from legacy tables

Negative:
- Schema migration + data backfill required (handled in PR #260 phases 1-2)
- Legacy tables (`tender_notes`, `tender_clarifications`, `tender_follow_ups`)
  retained for one release cycle for safety — adds storage cost short-term
- Future PR (deferred) will drop legacy tables once the new flow is proven

#### Alternatives considered

- Keep the three panels and add cross-panel filters → rejected, doubles
  maintenance surface
- Migrate to a third-party comms platform (e.g. Intercom) → out of scope;
  this is internal tender workflow

#### References
- PR #260 — implementation
- PR-29 — deprecation markers on legacy endpoints
- PR-31 — JSDoc on the new module's public exports

---

## Migration History Audit — 2026-06-19

*(Source: `docs/migration-history-audit.md`. Point-in-time findings document —
report only, no migrations or schema changes made. Preserved verbatim.)*

**Date:** 2026-06-19
**Scope:** `apps/api/prisma/migrations/` vs `apps/api/prisma/schema.prisma`
**Status:** Report only — no migrations or schema changes made.

This audit catalogues sort-order risk and obvious drift signals in the
existing Prisma migration history. It is a findings document for Marco to
action later; remediation belongs in a separate PR.

Related lesson: **LL-05 (2026-05/06)** — Prisma sorts migration folders
alphabetically, so bare `YYYYMMDD_*` folders sort *before* any same-day
`YYYYMMDDHHMMSS_*` folders, but *after* same-day folders that include
HHMMSS digits because `_` (0x5F) sorts higher than the digit characters
`0–9` (0x30–0x39). The standing reviewer guard is: *never merge a
migration that doesn't sort AFTER all existing same-day migrations.*
This audit lists the historical folders that violate that guard.

### 1. Inventory by timestamp shape

| Shape | Count | Example |
|---|---|---|
| `YYYYMMDD_…` (8-digit, bare date) | 50 | `20260418_s4_sso_user_flag` |
| `YYYYMMDDHHMM_…` (12-digit, no seconds) | 19 | `202604020001_auth_foundation` |
| `YYYYMMDDHHMMSS_…` (14-digit, full timestamp) | 38 | `20260502011757_feat_persona_registry_foundation` |
| **Total** | **107** | + `migration_lock.toml`, `reconciliation-notes.md` |

`pnpm prisma migrate deploy` applies these in pure lexicographic order,
which is the underlying risk: only the 14-digit form is unambiguous.

### 2. Sort-order risk findings

#### 2.1 Bare `YYYYMMDD_` folders co-located with HHMMSS folders on the same date

These are the cases where a bare-date folder must sort *after* every
same-day full-timestamp folder, by virtue of `_ > 0-9`. Today this still
applies cleanly because all known same-day siblings authored earlier in
the day chronologically also have lower lex order. But the trap is that
**any future PR landing a 14-digit migration on the same date will sort
before the bare-date sibling, regardless of when it was authored**:

| Bare-date folder | Same-day 14-digit siblings (lex < bare) |
|---|---|
| `20260528_rename_person_days_to_labour_days_override` | `20260528033535_plant_rate_category`, `20260528151542_quote_scope_redesign` |

Walk-through for 20260528:

| Order applied | Folder | Effect |
|---|---|---|
| 1 | `20260527045615_scope_card_header_overrides` | ADD `scope_cards.total_person_days_override` |
| 2 | `20260528033535_plant_rate_category` | unrelated |
| 3 | `20260528151542_quote_scope_redesign` | unrelated |
| 4 | `20260528_rename_person_days_to_labour_days_override` | RENAME → `labour_days_override` |

Today this works. A future 14-digit migration dated `20260528*` that
expects `labour_days_override` to already exist would sort *before* step
4 and fail.

#### 2.2 Bare-date folders with no same-day siblings (lower direct risk)

Most of the 50 bare-date folders are isolated on their date and pose no
*current* ordering hazard, but every one of them is a future trap because
any later PR on the same calendar date with a 14-digit prefix will sort
before them. Densely-populated dates:

- **20260420** — 6 folders, all bare-date
- **20260421** — 10 folders, all bare-date
- **20260422** — 8 folders, all bare-date
- **20260426** — 16 folders, all bare-date

Within these same-date clusters, apply order is dictated by the slug
suffix (alphabetical), not by authored order. If any pair has a
producer/consumer relationship, replay-from-empty may diverge from the
dev-DB history.

#### 2.3 12-digit `YYYYMMDDHHMM_NNNN_…` folders (April 2026 init batch)

The 19 folders `202604010001_…` through `202604160001_…` use a
`YYYYMMDDHHMM` prefix with a 4-digit run-number tail. They sort cleanly
among themselves (the explicit run-numbers preserve intent) and sort
*before* the bare-date `20260418_*` folders. No active hazard, but they
are inconsistent with the 14-digit standard and should not be used as a
template for new migrations.

### 3. Drift signals (cross-checked against `schema.prisma`)

`schema.prisma` declares 165 models and 10 enums. A full
`prisma migrate diff --from-migrations … --to-schema-datamodel …` run is
out of scope for this report (would require a shadow DB), so the
findings here are limited to what is visible in the static files plus
the existing reconciliation note.

#### 3.1 Resolved drift — `20260602084115_chore_reconcile_drift`

`apps/api/prisma/migrations/reconciliation-notes.md` documents that this
migration folded in:
- **39 foreign-key constraint refreshes** across 21 tables (cascade-rule
  alignment).
- **5 `ALTER COLUMN` corrections** (stale defaults, `TIMESTAMP(6) → (3)`).
- **1 index rename** (`…_depth_mm_ke` → `…_depth_m_key`).
- **Stale-bucket cleanup**: dropped `workers.employmentType` orphan
  column and `tender_clients_contract_issued_idx` orphan index.

The note's `## Scope` section explicitly states no schema edits, no
source/seed/DTO edits, and no in-place migration edits. **No
outstanding follow-ups identified in the note itself.**

#### 3.2 Migrations layered after the reconcile point

13 migration folders sort after `20260602084115_chore_reconcile_drift`.
None have a known associated reconciliation gap; spot-checking the most
recent (`20260617090000_pr_competency_gate_enforce`) shows it landed on
14-digit cadence cleanly. No re-reconciliation triggered.

#### 3.3 Migrations whose folder name encodes a duplicated date prefix

- `20260527040627_20260527_estimate_material_density` — the slug
  redundantly repeats `20260527`. Cosmetic only; the leading 14-digit
  prefix still sorts correctly.

#### 3.4 Backfill / data-only migrations adjacent to schema migrations

- `20260527040628_backfill_material_density` follows
  `20260527040627_20260527_estimate_material_density` by 1 second.
- `20260529020810_backfill_tender_entries` follows
  `20260529020234_tender_entries` by ~6 minutes.

Both pairs sort correctly. Mentioned only because LL-05's standing fix
calls out "full timestamps + inline data for backfills" — these are the
opposite pattern (separate backfill folders), which is fine as long as
the timestamps stay distinct.

#### 3.5 Schema models / columns not visible in migration grep — not audited

A static keyword scan from `schema.prisma` model names against migration
SQL is unreliable (rename-via-`@map`, model split across multiple
migrations, etc.). The authoritative check is a shadow-DB
`prisma migrate diff` run; that is **out of scope** for this report-only
audit and is the recommended next step before any cleanup PR.

### 4. Recommended next steps (not done in this PR)

1. Run `prisma migrate diff --shadow-database-url … --from-migrations
   apps/api/prisma/migrations --to-schema-datamodel
   apps/api/prisma/schema.prisma --script` and attach the output.
   Expected: empty (per `reconciliation-notes.md`). Any output is the
   audit's true drift surface.
2. For new migrations going forward: enforce 14-digit
   `YYYYMMDDHHMMSS_` prefixes in CI (e.g. a lint check on
   `apps/api/prisma/migrations/*/`).
3. Decide whether to rename existing bare-date and 12-digit folders.
   **Strongly biased against** — renaming applied migrations breaks
   every deployed environment's `_prisma_migrations` row. The pragmatic
   posture is "leave history alone, gate the future."
4. Add a reviewer-checklist item referencing LL-05.

### 5. Verification

- `git diff --name-only origin/main…HEAD` shows only
  `docs/migration-history-audit.md` (single new doc, per LL-30 explicit
  staging discipline).
- No files under `apps/api/prisma/`, `apps/api/src/`, `apps/web/src/`,
  or `packages/` were modified.
- No migrations added, renamed, or deleted.
- No `schema.prisma` edits.

### 6. Source data

- Migration folder inventory: `ls apps/api/prisma/migrations/` at HEAD
  (107 migration folders + `migration_lock.toml` +
  `reconciliation-notes.md`).
- Schema reference: `apps/api/prisma/schema.prisma` (3813 lines, 165
  models, 10 enums).
- Reconciliation context: `apps/api/prisma/migrations/reconciliation-notes.md`.
- Lesson cross-ref: `docs/lessons-learned/incident-ledger.md` LL-05.

---

## Investigation — Legacy "My Account → AI providers" section (2026-05-02)

*(Source: `docs/legacy-ai-providers-investigation.md`. Investigation report —
no code change in this PR. Preserved with conclusions intact.)*

> **Status note (reconciled against the same-day system audit below):** this
> investigation's live verdict was **"Removal paused, awaiting decision."** The
> 2026-05-02 system audit records that the recommended migration path was
> subsequently executed in **PR #132**, which migrated the legacy AI scope
> drafting cleanly and dropped the `user_ai_providers` / `user_ai_preferences`
> tables. The investigation below is preserved as the point-in-time analysis; the
> **current codebase-true state is that the legacy section was removed** (see
> System Audit §2.2).

**Date:** 2026-05-02
**Branch:** `chore/remove-legacy-ai-providers-section`
**Outcome:** **Verdict C — fully wired to working AI features. Removal paused, awaiting decision.**

### Summary

The legacy "AI providers" section on the user account page (`/account`,
component `UserProfilePage.tsx`) is not just a UI artifact. It is the
front-end of a full vertical slice — UI + REST endpoints + database
tables + an active runtime consumer — that powers **AI scope drafting**,
a Phase 1 feature (roadmap.md §1: "AI scope drafting (IS disciplines
only)" — ✅ COMPLETE).

Removing the section without first migrating the consumer would break
AI scope drafting end-to-end:

- Estimators triggering "Draft scope from documents" on a tender would
  no longer be able to pick or use a personal AI provider.
- The "remember my last-used provider" UX would lose its store.
- The fallback to a company-managed key would still work, but only if
  the company has any provider configured in `PlatformConfig` —
  otherwise the request errors out.

This is therefore not a UI-only deletion. It is an entanglement
spanning two modules that needs an explicit product decision before
proceeding.

### Files and surface area

#### Frontend — UI layer

| File | Role |
|---|---|
| `apps/web/src/pages/account/UserProfilePage.tsx` | Renders the "My AI providers" card with Company + Personal sub-sections. Calls `GET /user/ai-providers`, `PATCH /user/ai-providers/:id`, `DELETE /user/ai-providers/:id`. |
| `apps/web/src/pages/account/AddPersonalProviderModal.tsx` | Modal launched from the "Add personal key" button. Calls `POST /user/ai-providers/list-models` and `POST /user/ai-providers`. |
| `apps/web/src/components/ai/AiProviderSelector.tsx` | **Point-of-use picker** rendered inside the tendering UI. Lists available providers, lets the user pick one, optionally remembers the choice. Calls `GET /user/ai-providers/available` and `PATCH /user/ai-providers/preference`. |

#### Frontend — consumers of the picker

| File | Where the picker is used |
|---|---|
| `apps/web/src/pages/tendering/TenderDetailPage.tsx` (around line 965) | "Draft scope from documents" trigger in the Tender detail view. |
| `apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx` (around line 412) | Same picker inside the scope table flow. |

#### Backend — API layer

| File | Role |
|---|---|
| `apps/api/src/modules/user-ai-providers/user-ai-providers.controller.ts` | `Controller("user/ai-providers")` exposing `GET /`, `GET /available`, `POST /`, `PATCH /preference`, `POST /list-models`, `PATCH /:id`, `DELETE /:id`. |
| `apps/api/src/modules/user-ai-providers/user-ai-providers.service.ts` | `UserAiProvidersService` — encrypts (`aes-256-gcm`) and stores personal keys, builds the merged company+personal "available" list, manages last-used preference. |
| `apps/api/src/modules/user-ai-providers/user-ai-providers.module.ts` | NestJS module wiring; **exported** so other modules can inject the service. |
| `apps/api/src/modules/tendering/tendering.module.ts` (line 21) | Imports `UserAiProvidersModule` so `TenderScopeDraftingService` can use the service. |

#### Backend — runtime consumer

| File | What it does with the legacy storage |
|---|---|
| `apps/api/src/modules/tendering/tender-scope-drafting.service.ts` | **The blocker.** Imports `UserAiProvidersService`. In `resolveProviderForUser` (~line 301) it: (1) reads `prisma.userAiPreference.findUnique({ where: { userId } })` to recall the user's last-used provider, (2) calls `userAiProviders.getPersonalKey(userId, id)` (~line 334) to decrypt and use a personal key when the chosen provider is personal, (3) calls `userAiProviders.setPreference(actorId, providerMeta.id)` (~line 217) after a successful draft to remember the choice. |

#### Database — tables

| Table | Schema location | Purpose |
|---|---|---|
| `user_ai_providers` (`UserAiProvider`) | `apps/api/prisma/schema.prisma` lines 1786–1801 | Per-user encrypted personal AI keys. `userId, provider, label, apiKey (encrypted), model, isActive`. Indexed on `(userId)` and `(userId, provider)`. |
| `user_ai_preferences` (`UserAiPreference`) | `apps/api/prisma/schema.prisma` lines 1805–1813 | Per-user `lastUsedProviderId`. Stores the most recently picked provider so the selector can skip the modal on repeat use. |

Both tables back-reference `User` (`personalAiProviders`, `aiPreference`
relations on `User` at lines 77–78). Removing them requires also dropping
those back-relations.

#### Permissions

No `ai.providers.*` permission strings. The legacy endpoints are gated
purely by `JwtAuthGuard` (any authenticated user). Removal would not
require permission registry changes.

### Categorisation

| Test | Result |
|---|---|
| UI section present | ✅ `UserProfilePage.tsx` — "My AI providers" card |
| Backend endpoints present | ✅ Full CRUD under `Controller("user/ai-providers")` |
| DB tables present | ✅ `user_ai_providers`, `user_ai_preferences` |
| **Working AI feature reads from this storage** | ✅ **Yes** — `TenderScopeDraftingService.resolveProviderForUser` reads `userAiPreference.lastUsedProviderId` and calls `userAiProviders.getPersonalKey` / `setPreference` |

→ **Verdict C — fully wired.**

### What would break if we deleted blindly

If we deleted the UI section, the controller, the service, the DB
tables, and the User back-relations without touching anything else:

1. **TenderScopeDraftingService fails to compile.** `resolveProviderForUser`
   imports `UserAiProvidersService` and references `prisma.userAiPreference`.
   API build breaks.
2. **AiProviderSelector fetches 404s.** The selector hits
   `/user/ai-providers/available`. With the controller removed, the
   route returns 404, the selector renders an error, and "Draft scope
   from documents" can't proceed.
3. **TenderDetailPage / ScopeQuantitiesTable would need rework.** Both
   import the selector — they need an alternative provider-resolution
   path or the picker stays out.
4. **AI scope drafting silently degrades to company-key-only.** If the
   company hasn't configured any provider in `PlatformConfig`,
   `pickCompanyProvider()` returns the mock provider — the feature
   stops doing real AI work.

### Recommended paths forward (for main chat to choose)

These are **not** decisions for this PR — listing them so the next
session has a clear menu of options.

#### Option 1: Migrate to the new AI Settings page first

- Build BYOK on the new `/admin/ai-settings` page (PR currently deferred
  pending the encryption PR — `UserPersonaSettings.bringYourOwnKey`
  column already exists from PR #117).
- Add a service method on the new persona system that resolves a
  provider for a user (mirrors the legacy `resolveProviderForUser`).
- Migrate `TenderScopeDraftingService` to use the new resolver.
- Migrate `AiProviderSelector` to read from new endpoints (or remove
  entirely if the persona system handles selection differently).
- Then remove the legacy section in a follow-up PR.

This is the cleanest path. ~2–3 PRs of work.

#### Option 2: Accept the breakage temporarily

- Remove the legacy section now.
- Mark "AI scope drafting" as paused in roadmap.md (move from PHASE 1
  ✅ to a temporary "🔧 paused — restoring under new persona system"
  state).
- Restore once Option 1's migration lands.

This is faster but breaks a working feature for some unknown number of
days. Raj uses AI scope drafting — this would impact him directly.

#### Option 3: Defer removal until after the AI integration PR

- Keep the legacy section live until §5A.1 PR 6 (the actual AI
  integration PR for the persona system) lands.
- In that PR, replace `TenderScopeDraftingService.resolveProviderForUser`
  with a persona-system-aware resolver, retire the legacy endpoints,
  drop the tables.
- The legacy "My Account" UI section can be removed in the same PR or
  immediately after.

This keeps `main` working at every step. Probably the most honest path
given the AI integration PR is the next one in the §5A.1 sub-phase
anyway.

### Conclusion

The "duplicates and fragments AI configuration UI" framing is correct —
the legacy section IS redundant from a user-facing perspective with the
new AI Settings page. But it's load-bearing under the hood for an
already-shipped feature. We should not remove it in isolation.

Recommended: **Option 3** (defer to the AI integration PR), since the
new persona system is the natural replacement for the legacy
`UserAiProvidersService` and the migration is least risky when done
inside the PR that introduces the replacement. No code change in this
PR — investigation report only.

---

## System Audit — 2026-05-02

*(Source: `docs/audits/2026-05-02-system-audit.md`. Point-in-time comprehensive
audit, read-only mode. Findings preserved verbatim.)*

**Generated:** 2026-05-02 11:04 AEST
**Audit type:** comprehensive (Sections 1 + 2 + 3)
**Mode:** read-only (no autonomous fixes)
**Trigger:** end-of-day sanity check after the §5A.1 PR chain (PRs #117–#132)
**Branch:** `audit/2026-05-02-system-snapshot`
**Main HEAD at audit time:** PR #132 merged

### Executive Summary

- **Total checks run:** 11 health + 5 drift sub-sections + 5 security sub-sections
- **Critical findings:** 0
- **Major findings:** 1 (M1 — Xero error reflection to client)
- **Minor findings:** 3 (m1–m3)
- **Observations:** 6 (o1–o6)

**Overall verdict: HEALTHY.** All 11 health checks pass. No accidentally exposed endpoints. No privilege escalation vectors. Zero open CodeQL or Dependabot alerts. The §5A.1 chain delivered the persona system end-to-end, migrated the legacy AI scope drafting cleanly (PR #132), and left the codebase in a coherent state.

The only Major finding is **M1: Xero service surfaces raw API error text to the client** — recommended for a small follow-up PR. Nothing requires action before the next feature PR.

### Section 1 — Health Checks

| Check | Result | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile` | ✅ pass | Lockfile resolves clean, no dep drift |
| `prisma migrate status` (local DB) | ✅ pass | "Database schema is up to date!" — 68 migrations applied |
| Fresh shadow-DB replay | ⚠️ deferred | Not run — would require destructive local DB reset (audit forbids). CI on PR #132 (most recent merge) replays migrations from scratch on a fresh DB and was green. |
| `pnpm seed` (run 1) | ✅ pass | Clean exit |
| `pnpm seed` (run 2 — idempotent) | ✅ pass | Clean exit, no errors on repeat |
| `pnpm --filter @project-ops/api lint` | ✅ pass | Zero warnings |
| `pnpm --filter @project-ops/web lint` | ✅ pass | Zero warnings |
| `pnpm --filter @project-ops/api test` | ✅ pass | **209/209** — 26 test suites |
| `pnpm --filter @project-ops/web test` | ✅ pass | **192/192** — 10 test files |
| `pnpm build` (recursive) | ✅ pass | Both packages built; web bundle 1,890 kB / 491 kB gzipped |
| `pnpm compliance:smoke` | ✅ pass | `"status": "passed"` |
| `npx playwright test tests/e2e/tendering.spec.ts --project=chromium` | ✅ pass | **5/5** in 18.9s |

**Section 1 verdict: 11/11 functional checks pass.** Shadow-DB replay deferred to CI per audit constraints (no destructive operations).

### Section 2 — Drift and Consistency

#### 2.1 — Permission registry consistency

**Declared permissions:** 64 in `apps/api/src/common/permissions/permission-registry.ts`.

**Usage breakdown:**
- Decorator usages: 458 across 52 controller files
- Inline `hasPermission(...)` usages: 8 across 1 file (`directory.controller.ts`)
- Custom guards reading `permissionRequired`: 1 (`PersonaPermissionGuard` reading `tendering.persona.ts`)

**Findings:**

| Status | Count | Permissions |
|---|---|---|
| USED via decorator | 60 | (most of the registry) |
| USED via inline only | 1 | `directory.finance` (intentional — gated inline for granular bank-detail access; documented behaviour since PR #75) |
| USED via custom guard | 1 | `ai.persona.tendering` (read by `PersonaPermissionGuard` from `persona.permissionRequired`; this is the persona-system pattern, intentional from PR #117) |
| USED both decorator + inline | 3 | `directory.admin`, `finance.manage`, plus the `directory.finance` mentioned above (cross-checked) |
| **UNUSED** | **1** | **`forms.admin`** — declared in PR #97 (Forms Engine) for "Delete templates, view all submissions, manage schedules" but no `@RequirePermissions("forms.admin")` decorator and no `hasPermission("forms.admin")` call exists anywhere |

**No undeclared permission strings** — every string used by `@RequirePermissions(...)` and `hasPermission(...)` matches a registry entry. 100% clean on that side.

→ Finding **m1** below.

#### 2.2 — §5A.1 cleanup verification (post PR #132)

| Check | Result |
|---|---|
| No imports of `UserAiProvidersService` | ✅ — zero matches |
| No imports of `UserAiPreferenceService` | ✅ — zero matches (never existed; was a single service) |
| No imports of `AiProviderSelector` | ✅ — zero matches |
| No references to `user_ai_providers` table | ✅ — zero matches in `.ts` |
| No references to `user_ai_preferences` table | ✅ — zero matches in `.ts` |
| No `/user/ai-providers/*` endpoint clients | ✅ — zero matches |
| `schema.prisma` has no `UserAiProvider`/`UserAiPreference`/relations | ✅ — only a memorial comment at line 1780 |
| Migration history clean | ✅ — `20260421_feat_user_ai_providers` (creation) bracketed by `20260502101544_chore_remove_legacy_ai_provider_tables` (drop). No leftover migrations. |

**Sole remnant:** one comment-only mention in `tender-scope-drafting.service.ts:20` documenting the historical "personal" source (intentional audit trail).

**§5A.1 cleanup verdict: clean.** PR #132 left no leakage.

#### 2.3 — Provider implementation consolidation status

**Two `ai-providers/` directories exist** by design (one new, one legacy bridging to `draftScope`). Inventory:

**`apps/api/src/modules/tendering/ai-providers/` (legacy):**
| File | Imported by | Status |
|---|---|---|
| `ai-provider.interface.ts` | `tender-scope-drafting.service.ts` | ✅ ACTIVE |
| `claude.provider.ts` (`ClaudeProvider`) | `tender-scope-drafting.service.ts` | ✅ ACTIVE — used by scope drafting `draftScope()` |
| `openai.provider.ts` (`OpenAiProvider` + `MockAiProvider`) | `tender-scope-drafting.service.ts` | ✅ ACTIVE — Mock for the no-key fallback, OpenAi for instantiate |
| **`gemini.provider.ts` (`GeminiProvider`)** | nothing | ❌ **DEAD** — no imports anywhere |
| **`groq.provider.ts` (`GroqProvider`)** | nothing | ❌ **DEAD** — no imports anywhere |

**`apps/api/src/modules/ai-providers/providers/` (new — PR #123/#124):**
| File | Imported by | Status |
|---|---|---|
| `anthropic.provider.ts` (`streamAnthropicChat`) | `ai-providers.service.ts` | ✅ ACTIVE — chat endpoint streaming |
| `openai.provider.ts` (`streamOpenAIChat`) | `ai-providers.service.ts` | ✅ ACTIVE — chat endpoint streaming |

**Duplication intent:** the two implementations exist because the new module does **streaming chat** (used by the floating window) while the legacy module does **one-shot JSON responses** (used by scope drafting's `draftScope()` → returns a parsed array of scope items). Different APIs, different needs. Not a duplication bug.

→ Finding **m2** below (dead Gemini/Groq classes).

#### 2.4 — Pre-existing migration drift (workers.employmentType)

**Local DB (this audit's machine):** `workers` has `employment_type` only — no stray `employmentType` column. Schema matches Prisma's `@map`.

**`schema.prisma`:** declares `employmentType String? @map("employment_type")` (line 552).

**CI / fresh-DB-replay state (theoretical):** migration `202604020004_worker_employmenttype_compat` runs `ALTER TABLE workers ADD COLUMN IF NOT EXISTS "employmentType" TEXT` and no later migration drops it. So a CI/fresh DB has both `employment_type` AND `employmentType` columns; `schema.prisma` declares only the former. The Prisma client never queries `employmentType` so nothing breaks at runtime, but the DB is structurally divergent from the schema.

**Why the local audit machine is clean:** PRs #117, #126, and #132 each ran `prisma migrate dev` which auto-generated drift-cleanup migrations. Those drift cleanups got applied to the local DB even when the migration file was trimmed on disk (per the consistent PR #117 protocol). The local DB has been progressively cleaned; CI's fresh DB has not.

→ Already tracked under PHASE 6 entry "Audit migration history vs current schema". No new finding. *(This is the pre-existing drift the 2026-06-19 Migration History Audit §3.1 later confirmed resolved via `20260602084115_chore_reconcile_drift`, which dropped the `workers.employmentType` orphan column.)*

#### 2.5 — Test count regressions and skipped tests

**Tests:** 209 API + 192 web — matches PR #132's reported numbers exactly. **No silent regression.**

**Skipped tests:** zero. `grep -E "\.skip\(|xit\(|xtest\(|test\.skip|it\.skip|describe\.skip"` returns nothing.

**Test files in place:** 26 `.spec.ts` in API, 10 `.test.ts`/`.test.js` pairs in web (the legacy `.js` siblings double-count via vitest's auto-pickup).

### Section 3 — Security and Architectural Review

#### 3.1 — Authentication coverage

**Public endpoints (no auth, by design):**
- `/api/v1/health` — health check
- `/api/v1/auth/login`, `/auth/refresh`, `/auth/reset-password`, `/auth/sso`, `/auth/entra`, `/auth/config` — staff auth flow
- `/api/v1/portal/auth/login`, `/portal/auth/refresh`, `/portal/auth/logout`, `/portal/auth/accept-invite`, `/portal/auth/request-reset`, `/portal/auth/reset-password` — portal auth flow

All 13 are appropriate.

**Authenticated but un-permissioned (intentional):**
- `/api/v1/admin/users/*` — gating happens in the service layer via `tierOf(viewer)` (admin/super-user only). PR #84 rationale: tier model is more granular than permission codes for user-management ops.
- `/api/v1/auth/me` — read-only self-query for current user identity.

Both are designed-this-way, not gaps.

**Custom guards properly gated:**
- `PersonaPermissionGuard` — reads `persona.permissionRequired` from the registry, validates against `req.user.permissions` OR `req.user.isSuperUser`. Returns 404 for unknown slugs (no existence leak). Verified during PR #118.
- `PortalJwtGuard` — separate JWT secret + payload type check (`payload.type !== "portal"` rejected). Re-validates `clientId` against DB on every request to catch deactivated portal users + stale tokens.

**Verdict: no accidentally exposed endpoints found.** All non-public endpoints have either JwtAuthGuard or PortalJwtGuard.

#### 3.2 — Privilege escalation patterns

Searched for the bug class fixed in PR #85.1: endpoints accepting `userId`/`workerProfileId`/`personaId` from request body when they should derive identity from `req.user.sub`.

**Findings:**

| Module | Pattern | Verdict |
|---|---|---|
| `admin-users` | `tierOf(viewer)` validates the actor's tier before allowing super-user promotion (line 105). No body-spoofable identity. | ✅ safe |
| `notifications` | `AssignFollowUpNotificationDto.userId` accepts a user id, but this is the **assignee** (intentional admin reassignment), not the actor identity. Permission `notifications.manage` gates the endpoint. | ✅ safe by design |
| `field` | All endpoints derive identity via `ctx(user)` helper from `req.user.sub` (lines 32–34 of `field.controller.ts`). Workers can only operate on their own allocations/timesheets. | ✅ safe |
| `workers` | No body `userId` or `workerProfileId` parameters. All mutations use path parameters validated server-side. | ✅ safe |
| `users` | Mutations pass `actor.sub` to service; no user-supplied identity fields in DTOs. | ✅ safe |
| `safety` | `createIncident` / `createHazard` record `actor.sub` server-side, not from DTO. | ✅ safe |
| `personas` (chat) | System prompt resolution uses `actor.sub` exclusively (`personas.controller.ts:214`). User cannot spoof which persona settings to read. | ✅ safe |
| `portal` | `PortalJwtGuard` extracts `clientId` from the portal token; all portal operations are auto-scoped to that client. Staff JWT and portal JWT use different secrets and payload shapes. | ✅ safe |

**Verdict: no privilege escalation vectors identified.** PR #85.1's bug class is not present in any current endpoint.

#### 3.3 — Error handling consistency

**Sanitised paths (PR #131 pattern via `sanitiseProviderError`):**
- `/personas/:slug/chat` ✅ (PR #131)
- `/tenders/:id/draft-scope` ✅ (PR #132)

**Un-sanitised paths reflecting upstream errors to client:**
- **Xero service** (`xero.service.ts` lines 220, 282, 309, 378) — catches Xero API errors, throws `BadRequestException(\`Xero sync failed: ${message}\`)` with raw upstream text. Affects `POST /xero/sync-contacts` and `POST /xero/push-invoice`. → **Finding M1.**
- **SharePoint** `testConnection()` (`sharepoint.service.ts:112`) — surfaces error in response body. Restricted to `sharepoint.view` (super-user-only via Admin role). Low-risk because the endpoint is admin-debugging-only and the error text comes from Microsoft Graph (not user-controlled). Acceptable for now.
- **Email** test endpoint (`email.service.ts:177–178, 248–249`) — returns `{ success: false, message: err.message }`. Test-endpoint only, auth-gated. Low-risk.

→ Finding **M1** for Xero. SharePoint + Email noted as o5 / o6.

#### 3.4 — Dead code audit

**Method:** manual grep + import-tracing (no `ts-prune` or `knip` available).

**Confirmed dead code:**
- `apps/api/src/modules/tendering/ai-providers/gemini.provider.ts` — `GeminiProvider` class, zero imports. (See 2.3 — m2.)
- `apps/api/src/modules/tendering/ai-providers/groq.provider.ts` — `GroqProvider` class, zero imports. (See 2.3 — m2.)

**No other dead code surfaced** by import scans. The post-§5A.1 cleanup PRs (#119, #120, #126, #132) already deleted everything orphaned.

**TODO/FIXME/HACK/XXX comments:** **zero** in `apps/api/src` and `apps/web/src`. Codebase has no leftover sticky-note comments.

**`.legacy.ts` / `.deprecated.ts` files:** none.

**Commented-out code blocks > 5 lines:** none found in sample reads.

#### 3.5 — CodeQL / Dependabot status

**CodeQL alerts** (`gh api repos/.../code-scanning/alerts`):

| # | Rule | State | Notes |
|---|---|---|---|
| 1 | actions/missing-workflow-permissions | fixed | Closed by PR #128 |
| 2 | js/incomplete-sanitization | fixed | Pre-existing, closed prior |
| 3 | actions/missing-workflow-permissions | fixed | PR #128 |
| 4 | actions/missing-workflow-permissions | fixed | PR #128 |
| 5 | actions/missing-workflow-permissions | fixed | PR #128 |
| 6 | js/xss-through-dom | dismissed (false positive) | PR #128 dismissed |
| 9 | js/xss-through-exception | fixed | PR #131 — sanitiser |
| 10 | js/xss-through-dom | dismissed (false positive) | PR #131 dismissed |

**Open CodeQL alerts: 0** ✅

**Dependabot alerts:** 13 total — 12 fixed, 1 dismissed (`uuid` re-bump deferred per PR #128 deviation). **Open: 0** ✅

**Verdict: zero open security alerts.** All historical alerts either closed via fix or dismissed with explanation.

### Findings (consolidated, severity-ranked)

#### Critical
None.

#### Major

**M1 — Xero service reflects raw upstream API errors to client**

- **Files:** `apps/api/src/modules/xero/xero.service.ts` lines 220, 282, 309, 378
- **What:** Catch blocks like `err instanceof Error ? err.message : String(err)` produce a `message` that's then thrown as `BadRequestException(\`Xero sync failed: ${message}\`)`. The raw Xero API error text — including details like "Invalid authentication credentials", internal endpoint paths, OAuth state diagnostics — reaches the client.
- **Why major:** Same risk class as CodeQL #9 (which we fixed for AI providers via `sanitiseProviderError`). Xero error messages can include account-specific or upstream-implementation-specific text that shouldn't be reflected back. Not currently exploitable (frontend renders via JSX, auto-escaped) but defence-in-depth at the API boundary is the pattern we've adopted elsewhere.
- **Affected endpoints:** `POST /xero/sync-contacts`, `POST /xero/push-invoice` (called from contracts).
- **Suggested fix shape:** Apply `sanitiseProviderError` (or a Xero-specific sanitiser with similar categories) at each catch block. Same pattern PR #131 + PR #132 used. Estimated 1–2 hours.

#### Minor

**m1 — `forms.admin` permission declared but unused**

- **File:** `apps/api/src/common/permissions/permission-registry.ts:33`
- **What:** Permission code `forms.admin` declared with description "Delete templates, view all submissions, manage schedules" but never enforced anywhere — no `@RequirePermissions("forms.admin")`, no `hasPermission("forms.admin")` call.
- **Why minor:** Likely intentional placeholder for Phase 2 of Forms Engine (PR #97 ship + scope decisions). No security impact — just unused metadata. Suggested fix: either delete the entry, or wire it up in Forms admin endpoints if/when those tighten gating.

**m2 — Dead `GeminiProvider` and `GroqProvider` classes in `tendering/ai-providers/`**

- **Files:** `apps/api/src/modules/tendering/ai-providers/gemini.provider.ts`, `groq.provider.ts`
- **What:** Both classes implement `AiProvider` interface but have zero imports anywhere post-PR #132. The new ai-providers module (PR #124) doesn't have Gemini/Groq either — only Anthropic and OpenAI are wired into the persona system.
- **Why minor:** ~150 LOC of dead code, no functional impact. Cleaner to delete in a small follow-up. Adding Gemini/Groq back later would happen as new files in `apps/api/src/modules/ai-providers/providers/` (the new pattern), not by reviving these legacy classes.
- **Suggested fix shape:** Delete both files in a small follow-up chore PR.

**m3 — Migration drift: `workers.employmentType` stray column on CI / fresh DBs**

- **Files:** `apps/api/prisma/migrations/202604020004_worker_employmenttype_compat/migration.sql`
- **What:** That migration adds `employmentType` column; no later migration drops it. `schema.prisma` declares `employment_type` only. Local audit machine has the stray column dropped (via auto-generated drift cleanup applied during prior `migrate dev` runs); fresh CI DBs don't.
- **Why minor:** Not exploitable, not user-visible. Prisma client never queries `employmentType` so runtime isn't affected. Captured as long-running PHASE 6 entry "Audit migration history vs current schema" — no new tracking needed.

#### Observations

- **o1 — Codebase has zero TODO/FIXME/HACK/XXX comments.** Either disciplined hygiene or tracked-elsewhere. No action needed.
- **o2 — `directory.finance` permission gated inline (not via decorator)**, by design since PR #75. Documented behaviour. Continues to work; flagged for visibility only.
- **o3 — `ai.persona.tendering` gated via `PersonaPermissionGuard`** (custom guard reading `persona.permissionRequired`), not via decorator. Same design pattern as `directory.finance` — registry permission used at runtime, not at decorator time.
- **o4 — Two `ai-providers/` directories** (legacy `tendering/ai-providers/` for one-shot scope drafting, new `ai-providers/providers/` for streaming chat). Not duplication — different APIs and use cases. Future provider consolidation could collapse them, but it's a refactor not a fix.
- **o5 — SharePoint `testConnection()` reflects Microsoft Graph errors to admin caller** at `sharepoint.service.ts:112`. Admin-only endpoint; error text is upstream Graph API. Low-risk; acceptable for admin debugging UX.
- **o6 — Email test endpoint reflects mail-provider SDK errors to admin caller** at `email.service.ts:177–178`. Admin-only test path; err.message comes from OAuth/SMTP libs. Low-risk; acceptable.

### Recommendations (priority order)

| # | Action | Disposition |
|---|---|---|
| 1 | **M1 — Apply `sanitiseProviderError` (or Xero-specific equivalent) to Xero service catch blocks** | Fix in dedicated PR. ~1–2 hours. Same pattern as PRs #131/#132. |
| 2 | **m2 — Delete dead `GeminiProvider` and `GroqProvider` classes** | Add to PHASE 6 OR fix in a tiny follow-up chore PR (~15 min). |
| 3 | **m1 — Resolve `forms.admin` aspirational entry** | Add to PHASE 6 with a note linking to Forms Engine Phase 2 items. Decide at that time whether to wire up or delete. |
| 4 | **m3 — Migration history audit** | Already tracked in PHASE 6 ("Audit migration history vs current schema"). Confirm tracking, no new entry. |
| 5 | **o5 / o6 — SharePoint and Email error reflection** | No action needed. Admin-only paths, low risk. Document as acceptable in code comments if/when M1 lands so future readers know the pattern was deliberately scoped. |

### Audit metadata

- **Sections completed:** all (1, 2, 3)
- **Time taken:** ~25 minutes
- **Files touched by audit:** only this report (`docs/audits/2026-05-02-system-audit.md`)
- **No code changes, no migrations, no DB writes, no PRs opened.**

The audit branch `audit/2026-05-02-system-snapshot` contains exactly one commit: this report file. Marco can read, then either merge to capture the snapshot in main's history, or leave the branch unmerged as a point-in-time artefact.
