# VS Code Maximum-Capacity Strategy — ProjectOperations

**Author:** Cowork, 2026-06-11. Supersedes the operational parts of `vs-code-integration-strategy.md` (keep that doc for its research detail).
**Companion:** `docs/lessons-learned/incident-ledger.md` — the knowledge source this strategy is built on. Read it first.

**Prime directive:** no claim without an artifact. Every "it works" must trace to a log, a test run, a diff, or a check — produced by a tool, not asserted by a model. VS Code's job is to put every artifact one click away, and the pipeline's job is to refuse merges until the artifacts exist.

---

## 1. The verification pipeline (what guards what)

A PR cannot reach main without passing, in order:

| Layer | Mechanism | Catches | Ledger refs |
|---|---|---|---|
| 1. Prompt pre-flight | dependency-existence checks, force-clean | firing out of order, dirty base | LL-14 |
| 2. Agent self-verification | per-prompt matrix (build/lint/serial/canonical/e2e/boot) | broken work before a PR exists | LL-23 |
| 3. CI — build/lint/tests | existing `ci.yml` jobs | compile + unit regressions | — |
| 4. CI — canonical suite | `test:canonical` vs seeded service DB | schema drift, seed health, API contracts, Swagger coverage, permission 403s | LL-06, LL-07 |
| 5. CI — pr-gates | `pr-gates.mjs` (live body fetch, anchored) | undeclared migrations/env/deps, DTO validation, scope | LL-08, LL-09 |
| 6. CI — pr-acceptance e2e | Playwright chromium suite (growing, Phase 5) | UI regressions on real flows | LL-23 |
| 7. Auto-review | rev- job → pr-fix-reviewer → verdict file + evidence | scope creep, lying checklists, deferred local verification | LL-10, LL-19 |
| 8. Human merge | Marco in the VS Code PR panel: verdict + checks green | final judgement | LL-12 |

**Anti-hallucination doctrine embedded in layers 7–8:**
- The reviewer must reproduce failures locally and cite the failing-step log (its CI-failure protocol section) — narrative without evidence is not a verdict (LL-10, LL-19).
- Reviewer cross-PR narrative (status tables etc.) is advisory; only evidence-backed findings on the PR under review count.
- Marco merges only on BOTH signals: verdict file says MERGE *and* the checks box is green. One human click per PR, by design (LL-12).

### Gap to close (new): machine-check the checklist
Today nothing verifies the PR body's "Verification" checkboxes are actually ticked. **pr-165 (proposed):** extend `pr-gates.mjs` — FAIL if the `## Verification` section contains unchecked `- [ ]` items (Test-plan sections may stay unchecked; scope it to the Verification heading). This turns "all checklist items assessed" from convention into a gate.

---

## 2. VS Code cockpit — panel-by-panel configuration

### 2.1 GitHub Pull Requests (the merge cockpit) — ACTION NEEDED
- Sign in (account menu → the extension prompts), then add to settings.json:
  ```json
  "githubPullRequests.queries": [
    { "label": "Watcher PRs", "query": "repo:GH-Mantova/ProjectOperations is:open is:pr" },
    { "label": "Needs my merge", "query": "repo:GH-Mantova/ProjectOperations is:open is:pr status:success" }
  ],
  "githubPullRequests.pullBranch": "never"
  ```
  (`pullBranch: never` stops the extension from checking out PR branches under the watcher's feet — the working tree belongs to the agents.)
- Workflow becomes: `rev-` verdict lands → PR panel → checks green → Merge button. Browser eliminated.

### 2.2 GitHub Actions (the CI radar) — configured; one habit
- Pin the panel; it already surfaced LL-11 (deploy.yml red on every main push). Habit: red runs in "Current branch = main" are environment issues, not PR issues — diagnose per LL-10.

### 2.3 Playwright Test (the e2e bench) — ready after Phase 5
- Test Explorer runs any `pr-acceptance` spec from the gutter; **Pick locator** and **Record new** are the human escape hatch when an agent's selector triage says "testid-blocked". firefox/webkit rows disabled = correct (chromium-only by design).
- Add settings: `"playwright.reuseBrowser": true` for fast local iteration.

### 2.4 Testing panel (Jest) — optional add
- Install `Orta.vscode-jest` ONLY if you want gutter-run unit tests; it can be noisy on a monorepo. Alternative: keep using the `test: api (serial)` task. Decision: skip for now (bloat rule), revisit if unit-test iteration becomes a daily activity.

### 2.5 Containers / Prisma / Azure — configured
- Containers: postgres view is live. Don't update the 16-alpine image mid-chain; do it with the next quiet window, then `pnpm prisma:migrate` + `pnpm seed` + `pnpm test:canonical` to revalidate (LL-06 doctrine: after any DB-env change, run the canonical suite).
- Prisma panel: ignore the cloud CTAs; the extension's value is schema tooling. Local DB = Docker.
- Azure panel: signed in; becomes active duty when LL-11 (deploy.yml) is diagnosed — App Service / Static Web Apps views show what the red deploys did.

### 2.6 MCP servers (the agent nervous system) — ACTION NEEDED, highest leverage
Wire these so in-editor agents ground themselves in live data instead of recall:
- **GitHub MCP** → the reviewer reads PRs/checks/logs through the API rather than parsing `gh` text. Auth with the existing gh token.
- **DBHub/Postgres MCP** → point at `project-operations-postgres` (dev DB). Agents verify seed/migration claims with real queries (LL-06/07 class). READ-ONLY credentials if the server supports it.
- **Playwright MCP** → lets a reviewing agent actually drive the app when a verdict needs visual confirmation ("does the empty state render?") instead of asserting from the diff.
- **Azure MCP** → deploy diagnostics for LL-11 and S2 work.
- Configure each via the MCP panel gear; agents that should use them: `pr-fix-reviewer` (GitHub, DBHub, Playwright), future deploy-diagnostic agent (Azure, GitHub).

### 2.7 Extensions to ADD (small, justified)
| Extension | Why | Bloat check |
|---|---|---|
| GitLens (`eamodio.gitlens`) | inline blame + file history — instant "which PR touched this line", complements the ledger when tracing regressions | universally safe |
| markdownlint (`DavidAnson.vscode-markdownlint`) | the project runs on .md (prompts, ledger, roadmaps) — catch broken docs before agents consume them | lint-only |

**Do NOT install** (re-affirmed): Cline, Continue, Codeium, Tabnine (Claude Code conflicts); hold off on Copilot agent-mode anything beyond what's installed — one agent pipeline is the product, don't fork it.

### 2.8 Editor + extension updates
- VS Code "Update" badge + Claude Code extension update: apply only between chains (a restart kills the watcher pane). Add to the restart ritual: update → reopen folder → watcher task auto-starts → check banner.

---

## 3. Branch hygiene (the pruning routine)

Three layers, least to most effort:
1. **Repo setting (do once, biggest win):** GitHub → Settings → General → check **"Automatically delete head branches"**. Every merged PR's remote branch vanishes — watcher and manual merges alike. (The watcher's `--delete-branch` flag becomes redundant insurance.)
2. **Remote sweep for the backlog:** `scripts/branch-prune.ps1` already does this correctly (skips main + open-PR branches, deletes merged ones). Run once now to clear the ~30 accumulated branches, then monthly.
3. **Local sweep:** after the remote prune:
   ```powershell
   git fetch --prune
   git branch --merged main | Select-String -NotMatch "main" | ForEach-Object { git branch -d $_.ToString().Trim() }
   ```
**Wire it into VS Code:** add a `branch: prune (remote + local)` task to tasks.json chaining both (needs a small PR since tasks.json is tracked — fold into pr-165 alongside the gates checklist check and the LL-19 one-line reviewer fix).
**Cadence:** monthly, or after any chain that merges 5+ PRs. Never prune while the watcher is mid-job (it works on branches).

---

## 4. Knowledge-source maintenance (anti-double-handling)

- `docs/lessons-learned/incident-ledger.md` is the single ledger. Rule: symptom looks familiar → ledger first, diagnosis second.
- **Append discipline:** every new incident gets an LL entry when closed (what/cause/fix/guard). Cowork maintains it; Marco can demand an entry for anything that cost more than 15 minutes.
- **Make agents read it (pr-165):** add one line to `CLAUDE.md` — "Before diagnosing any operational/CI/git issue, check `docs/lessons-learned/incident-ledger.md` for a matching entry." That single pointer puts the ledger in every agent session repo-wide.
- Cowork's own memory mirrors the high-frequency entries (migration ordering, smoke drift, CI-from-logs, HEAD corruption) — the ledger is the authoritative superset.

---

## 5. Action list (chronological)

> **IMPLEMENTED 2026-06-12.** Items 1–2 done: settings.json (queries, pullBranch:never, reuseBrowser, markdownlint rules), GitLens + markdownlint installed and verified, MCP servers running (GitHub: 44 tools; DBHub: read-only `execute_sql` against project_operations via `~\.dbhub\dbhub.toml`; Playwright started; Azure parked for pr-166), repo auto-delete-branches toggled, branch backlog pruned (remote was already clean via watcher `--delete-branch`; local squash-merged branches swept via gone-upstream check). Known fixes for next tooling PR: tasks.json prune task `pwsh`→`powershell` + replace `--merged` sweep with gone-upstream sweep; watcher USAGE_LIMIT_PATTERNS += /hit your limit/i. Acceptance test in progress: pr-63b through the full cockpit.

1. **Now (no repo changes):** sign into GitHub PR extension; add the two settings.json blocks (2.1, 2.3); flip the GitHub repo setting "Automatically delete head branches"; install GitLens + markdownlint.
2. **When the Phase 5 chain finishes:** apply VS Code + Claude Code updates (2.8 ritual); run `scripts/branch-prune.ps1` + the local sweep; configure MCP servers (2.6).
3. **pr-165 (Cowork drafts on request):** gates Verification-checkbox check + tasks.json prune task + CLAUDE.md ledger pointer + LL-19 one-line reviewer fix. One small tooling PR.
4. **pr-166 (after pr-165):** LL-11 deploy.yml diagnosis — pull a failing run log, fix per evidence. Azure panel + MCP support the investigation.
5. **Standing cadence:** monthly branch prune; ledger entry per closed incident; canonical suite re-run after any DB-environment change.

---

*Everything here serves the same goal: the model never gets to be the source of truth — the artifact does. VS Code is where all the artifacts live within one click of the merge button.*
