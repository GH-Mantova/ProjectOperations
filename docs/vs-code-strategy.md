# VS Code Strategy — ProjectOperations

> Consolidates `vs-code-integration-strategy.md` (Cowork deep-research, 2026-06-08) and
> `vscode-max-strategy.md` (Cowork operational distillation, 2026-06-11). Both originals
> were merged here on 2026-06-19 — Part A is the operational cockpit guide (lead doc), Part B
> retains the full research detail for provenance.
>
> **Companion:** `docs/lessons-learned/incident-ledger.md` — the knowledge source the operational
> strategy is built on. Read it first.

**Stack reminder:** NestJS API + React/Vite web + PostgreSQL + Prisma, pnpm monorepo,
Azure-hosted (Web App / Static Web Apps / Azure DB for PostgreSQL), Windows 11.
**Audience:** Marco (WHS & Commercial Compliance officer, coordinator role).

---

# Part A — VS Code Maximum-Capacity Strategy (operational)

**Prime directive:** no claim without an artifact. Every "it works" must trace to a log, a test run, a diff, or a check — produced by a tool, not asserted by a model. VS Code's job is to put every artifact one click away, and the pipeline's job is to refuse merges until the artifacts exist.

## A1. The verification pipeline (what guards what)

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

## A2. VS Code cockpit — panel-by-panel configuration

### A2.1 GitHub Pull Requests (the merge cockpit) — ACTION NEEDED
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

### A2.2 GitHub Actions (the CI radar) — configured; one habit
- Pin the panel; it already surfaced LL-11 (deploy.yml red on every main push). Habit: red runs in "Current branch = main" are environment issues, not PR issues — diagnose per LL-10.

### A2.3 Playwright Test (the e2e bench) — ready after Phase 5
- Test Explorer runs any `pr-acceptance` spec from the gutter; **Pick locator** and **Record new** are the human escape hatch when an agent's selector triage says "testid-blocked". firefox/webkit rows disabled = correct (chromium-only by design).
- Add settings: `"playwright.reuseBrowser": true` for fast local iteration.

### A2.4 Testing panel (Jest) — optional add
- Install `Orta.vscode-jest` ONLY if you want gutter-run unit tests; it can be noisy on a monorepo. Alternative: keep using the `test: api (serial)` task. Decision: skip for now (bloat rule), revisit if unit-test iteration becomes a daily activity.

### A2.5 Containers / Prisma / Azure — configured
- Containers: postgres view is live. Don't update the 16-alpine image mid-chain; do it with the next quiet window, then `pnpm prisma:migrate` + `pnpm seed` + `pnpm test:canonical` to revalidate (LL-06 doctrine: after any DB-env change, run the canonical suite).
- Prisma panel: ignore the cloud CTAs; the extension's value is schema tooling. Local DB = Docker.
- Azure panel: signed in; becomes active duty when LL-11 (deploy.yml) is diagnosed — App Service / Static Web Apps views show what the red deploys did.

### A2.6 MCP servers (the agent nervous system) — ACTION NEEDED, highest leverage
Wire these so in-editor agents ground themselves in live data instead of recall:
- **GitHub MCP** → the reviewer reads PRs/checks/logs through the API rather than parsing `gh` text. Auth with the existing gh token.
- **DBHub/Postgres MCP** → point at `project-operations-postgres` (dev DB). Agents verify seed/migration claims with real queries (LL-06/07 class). READ-ONLY credentials if the server supports it.
- **Playwright MCP** → lets a reviewing agent actually drive the app when a verdict needs visual confirmation ("does the empty state render?") instead of asserting from the diff.
- **Azure MCP** → deploy diagnostics for LL-11 and S2 work.
- Configure each via the MCP panel gear; agents that should use them: `pr-fix-reviewer` (GitHub, DBHub, Playwright), future deploy-diagnostic agent (Azure, GitHub).

### A2.7 Extensions to ADD (small, justified)
| Extension | Why | Bloat check |
|---|---|---|
| GitLens (`eamodio.gitlens`) | inline blame + file history — instant "which PR touched this line", complements the ledger when tracing regressions | universally safe |
| markdownlint (`DavidAnson.vscode-markdownlint`) | the project runs on .md (prompts, ledger, roadmaps) — catch broken docs before agents consume them | lint-only |

**Do NOT install** (re-affirmed): Cline, Continue, Codeium, Tabnine (Claude Code conflicts); hold off on Copilot agent-mode anything beyond what's installed — one agent pipeline is the product, don't fork it.

### A2.8 Editor + extension updates
- VS Code "Update" badge + Claude Code extension update: apply only between chains (a restart kills the watcher pane). Add to the restart ritual: update → reopen folder → watcher task auto-starts → check banner.

## A3. Branch hygiene (the pruning routine)

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

## A4. Knowledge-source maintenance (anti-double-handling)

- `docs/lessons-learned/incident-ledger.md` is the single ledger. Rule: symptom looks familiar → ledger first, diagnosis second.
- **Append discipline:** every new incident gets an LL entry when closed (what/cause/fix/guard). Cowork maintains it; Marco can demand an entry for anything that cost more than 15 minutes.
- **Make agents read it (pr-165):** add one line to `CLAUDE.md` — "Before diagnosing any operational/CI/git issue, check `docs/lessons-learned/incident-ledger.md` for a matching entry." That single pointer puts the ledger in every agent session repo-wide.
- Cowork's own memory mirrors the high-frequency entries (migration ordering, smoke drift, CI-from-logs, HEAD corruption) — the ledger is the authoritative superset.

## A5. Action list (chronological)

> **IMPLEMENTED 2026-06-12.** Items 1–2 done: settings.json (queries, pullBranch:never, reuseBrowser, markdownlint rules), GitLens + markdownlint installed and verified, MCP servers running (GitHub: 44 tools; DBHub: read-only `execute_sql` against project_operations via `~\.dbhub\dbhub.toml`; Playwright started; Azure parked for pr-166), repo auto-delete-branches toggled, branch backlog pruned (remote was already clean via watcher `--delete-branch`; local squash-merged branches swept via gone-upstream check). Known fixes for next tooling PR: tasks.json prune task `pwsh`→`powershell` + replace `--merged` sweep with gone-upstream sweep; watcher USAGE_LIMIT_PATTERNS += /hit your limit/i. Acceptance test in progress: pr-63b through the full cockpit.

1. **Now (no repo changes):** sign into GitHub PR extension; add the two settings.json blocks (A2.1, A2.3); flip the GitHub repo setting "Automatically delete head branches"; install GitLens + markdownlint.
2. **When the Phase 5 chain finishes:** apply VS Code + Claude Code updates (A2.8 ritual); run `scripts/branch-prune.ps1` + the local sweep; configure MCP servers (A2.6).
3. **pr-165 (Cowork drafts on request):** gates Verification-checkbox check + tasks.json prune task + CLAUDE.md ledger pointer + LL-19 one-line reviewer fix. One small tooling PR.
4. **pr-166 (after pr-165):** LL-11 deploy.yml diagnosis — pull a failing run log, fix per evidence. Azure panel + MCP support the investigation.
5. **Standing cadence:** monthly branch prune; ledger entry per closed incident; canonical suite re-run after any DB-environment change.

*Everything in Part A serves the same goal: the model never gets to be the source of truth — the artifact does. VS Code is where all the artifacts live within one click of the merge button.*

---

# Part B — VS Code Integration Strategy (research detail / provenance)

**Author:** Cowork deep-research run
**Date:** 2026-06-08

## B1. Executive summary

- **Install the Claude Code for VS Code extension and the Azure Tools extension pack — these are the two highest-impact items.** The Claude Code extension is free, published by Anthropic (verified publisher, ~15.8M installs as of June 2026), works against your existing Pro/Max/API subscription, and ships the same CLI you already use for the watcher. It does not duplicate the watcher — it replaces the manual ad-hoc Claude sessions you currently run on the side.
- **Add a `.vscode/` folder to the repo with `tasks.json`, `launch.json` and `extensions.json`.** Right now, every script Marco runs is typed into a terminal. `tasks.json` turns `pnpm dev`, `pnpm compliance:smoke`, `pnpm prisma:migrate` etc. into one-key commands. `launch.json` lets you debug the NestJS API with breakpoints and step through Playwright tests. This is the "configure once and forget" win.
- **VS Code can be a third autonomous worker — but only weakly, and only in ways that overlap with the watcher.** The Claude Code extension exposes a `vscode://anthropic.claude-code/open?prompt=...` URI handler that opens (but does not auto-submit) a pre-filled prompt. There is no first-party "fire-and-forget headless" mode from inside the extension UI. Anything truly autonomous still goes through `claude --print` (which is exactly what the watcher already does). **Do not rebuild the watcher inside VS Code.**
- **GitHub Copilot Free is worth keeping enabled alongside Claude Code, not as a replacement.** Copilot Free gives you 2,000 completions plus 50 premium requests per month at $0, and inline tab-completion is a genuinely different workflow from Claude Code's chat/agent paradigm. Copilot Free now includes Claude Sonnet 4.6 in Chat. Agent mode is supported on Free but eats the 50-request cap fast. [Source: github.com/features/copilot/plans]
- **The autonomous loop you already have is the right one.** The watcher is producing PRs. Cowork scheduled tasks handle recurring jobs. VS Code's job is to make the *human-in-the-loop* parts (debugging, deploying, reviewing diffs, exploratory edits) frictionless — not to spawn a third agent. Optimise for that.

## B2. Layer-by-layer recommendations

### B2.1 Workspace config — commit a `.vscode/` folder

There is no `.vscode/` folder in `C:\ProjectOperations2` today. Add one with three files:

1. `extensions.json` — recommended extensions, so any future contributor (or a fresh laptop) gets a one-click install prompt.
2. `tasks.json` — every `pnpm` script turned into a VS Code task. Run with `Ctrl+Shift+P → Tasks: Run Task` or `Ctrl+Shift+B` for the default build.
3. `launch.json` — debug configurations for the NestJS API, Vite, and Playwright.

Concrete snippets in section B3.

**Workspace trust:** VS Code refuses to auto-run tasks in untrusted folders. After cloning, click "Trust this folder" or the extension panel and tasks file will be silent. [Source: code.visualstudio.com/docs/editing/workspaces/workspace-trust]

**Auto-run tasks on folder open** is possible (`"runOptions": { "runOn": "folderOpen" }`) but **explicitly do not enable this for `pnpm dev`** — the watcher already has automation jobs, and a build process auto-spawning every time you open VS Code makes log triage miserable. Reserve it for cheap things (e.g., a "validate `.env`" task). [Source: VS Code Tasks docs, last reviewed 2026-05-28]

### B2.2 Recommended extensions

These all run on Windows. Pin to these and resist installing more — the Claude Code troubleshooting docs explicitly call out other AI extensions (Cline, Continue) as causing icon-visibility conflicts. [Source: code.claude.com/docs/en/vs-code troubleshooting section]

| Extension | Publisher | Why it earns its place |
|---|---|---|
| `anthropic.claude-code` | Anthropic | The whole point. Spark icon, inline diffs, plan-mode review, `@file#5-10` mentions, plugin manager, MCP via `/mcp`. v2.1.159+ as of June 2026. |
| `ms-vscode.vscode-node-azure-pack` | Microsoft | Azure Tools extension pack — bundles App Service, Static Web Apps, Functions, Storage, Cosmos DB, Container Apps, Resources view. One install, all the Azure portals you'd otherwise tab-switch to. [Source: marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-node-azure-pack] |
| `ms-azuretools.vscode-azurestaticwebapps` | Microsoft | Standalone if you don't want the full pack. Deploy `apps/web` straight from the Static Web Apps view. Already included in `vscode-node-azure-pack`. |
| `Prisma.prisma` | Prisma | Schema syntax highlighting, format-on-save, jump to model. Mandatory for a Prisma project. |
| `dbaeumer.vscode-eslint` | Microsoft | Runs your existing ESLint config in-editor. `pnpm lint` becomes redundant for the inner loop. |
| `esbenp.prettier-vscode` | Prettier | Format-on-save. |
| `ms-playwright.playwright` | Microsoft | The Test Explorer integration: run a single Playwright spec from the gutter, record traces, view the HTML report. Replaces remembering the right `pnpm test:tendering:e2e` flag. |
| `humao.rest-client` | Huachao Mao | Send `.http` files against `http://localhost:3000/api/v1` without leaving the editor — cheaper than Postman. Optional. |
| `github.vscode-github-actions` | GitHub | Inline YAML validation for `.github/workflows/`, plus run status without leaving VS Code. |
| `ms-azuretools.vscode-bicep` | Microsoft | Only if/when you move infra-as-code to Bicep. Not needed today. |
| `GitHub.copilot` + `GitHub.copilot-chat` | GitHub | Free tier. Inline tab completion. **Disable agent mode** in settings to avoid burning the 50 premium-request cap on background activity. |

**Do NOT install:** Cline, Continue, Codeium, Tabnine — they all overlap with Claude Code and Copilot, and Anthropic explicitly lists them as known cause of the Claude spark icon not appearing. [Source: code.claude.com/docs/en/vs-code troubleshooting]

### B2.3 Claude Code extension setup

Verified primary-source facts (from the Anthropic docs page fetched 2026-06-08):

- **Prerequisite:** VS Code 1.98.0 or higher.
- **Permission modes** are settable per-conversation and globally via `claudeCode.initialPermissionMode`: `default` (asks each action), `plan` (writes a markdown plan you comment on first), `acceptEdits` (writes without asking), `bypassPermissions` (sandbox only, opt-in via `allowDangerouslySkipPermissions`).
- **Settings split into two locations:**
  - VS Code workspace settings (`Cmd+,` → Extensions → Claude Code) for VS Code-specific behaviour.
  - `~/.claude/settings.json` shared with the CLI — this is where you put allowed commands, env vars, hooks, MCP servers.
  - Add `"$schema": "https://json.schemastore.org/claude-code-settings.json"` to `settings.json` for autocomplete.
- **MCP servers are added via the CLI, then managed graphically with `/mcp` in the chat panel.** Example: `claude mcp add --transport http github https://api.githubcopilot.com/mcp/ --header "Authorization: Bearer YOUR_PAT"`. Importantly, your `~/.claude` MCP servers are shared with the watcher — adding a new MCP server in the extension immediately affects watcher runs.
- **Checkpoints** ("Rewind code to here") are supported in the extension. This is genuinely useful for exploratory edits — you can let Claude make a sweeping change, decide you hate it, and rewind file changes without losing the conversation context.
- **The extension installs the CLI too.** You do not need to keep a separate `npm i -g @anthropic-ai/claude-code` if the extension is installed.
- **The `useTerminal` setting (default `false`)** flips the panel into terminal-style mode if you prefer the previous experience. Recommend leaving as `false` — the graphical panel is where the new features (inline diffs, plan editing, checkpoint rewind) live.

**Recommended workspace settings** (drop into `.vscode/settings.json`):

```json
{
  "claudeCode.initialPermissionMode": "plan",
  "claudeCode.autosave": true,
  "claudeCode.respectGitIgnore": true,
  "claudeCode.preferredLocation": "sidebar",
  "github.copilot.chat.agent.enabled": false
}
```

`"plan"` is a deliberate choice for Marco. As coordinator-not-developer, you want Claude to write the plan, you read it, and then you say "do it". `acceptEdits` is faster but is the wrong default when you don't trust yourself to catch a bad edit in real time.

### B2.4 Azure tooling for the ProjectOperations stack

The Azure Tools extension pack (`ms-vscode.vscode-node-azure-pack`) bundles everything you need:

- **App Service** — deploy `apps/api` (NestJS). Right-click your subscription → Create Web App, select Linux + Node 22, then right-click the project → Deploy to Web App. The extension handles `azure-webapps-deploy@v3` equivalents locally and uses Oryx for build. Compatible with the existing GitHub Actions workflow you have.
- **Static Web Apps** — deploy `apps/web` (Vite). Same flow: select the SWA in the sidebar, right-click → Deploy. The extension generates the `staticwebapp.config.json` on first deploy.
- **Resources view** — your full Azure subscription tree (Web Apps, SWAs, PostgreSQL flexible servers, Storage accounts, Key Vaults) in the left activity bar. You can stream logs from the Web App by right-clicking → Start Streaming Logs. This is the fastest way to triage a 500 from a recently-deployed API.
- **Remote debugging for Node.js** is supported against an Azure Web App. Microsoft Learn documents the flow at `code.visualstudio.com/docs/azure/remote-debugging`. The Web App must be in Linux + Standard tier (S1) or higher — Basic/Free won't attach.

Worth installing separately:

- **PostgreSQL VS Code extension by Microsoft** (`ms-ossdata.vscode-postgresql`) — connect directly to Azure Database for PostgreSQL Flexible Server. Lets you run ad-hoc SQL against prod read-replica without leaving the editor. Combine with `claudeCode.respectGitIgnore: true` so secrets in `.env` don't leak into prompts.
- **Bicep** — only if you adopt IaC. For now you're using portal + GitHub Actions, so skip.

Worth knowing but **not** worth installing:

- Azure Functions extension — you don't run Functions today. The "GitHub webhook → Azure Function → kick autonomous task" pattern is technically possible but the watcher already covers this with zero Azure billing. Don't add a Function for triggering reasons alone.

### B2.5 Copilot vs Claude Code — honest verdict

| Capability | Copilot Free | Claude Code extension | Notes |
|---|---|---|---|
| Inline tab completion | Yes, 2,000/mo | No (not its model) | Copilot wins. Tab completion is its strongest feature. |
| Multi-file agent edits | Yes, but eats 50-req cap fast | Yes, primary feature | Claude wins. Plan mode + checkpoints are state of the art. |
| Long-context (1M tokens) | No (32K-128K) | Yes (Opus 4.7 on the right plan) | Claude wins for repo-wide tasks. |
| Cost | $0 | $20/mo Pro or API | Copilot Free is free. Your Anthropic plan covers Claude. |
| Headless / CLI | `copilot` CLI (GA Feb 25, 2026) | `claude --print` (mature) | Both work. You already use `claude --print` in the watcher. |
| Third-party Claude agent inside Copilot | Pro+ and Enterprise only | n/a | Free tier does not get this. Don't pay for Pro+ just for this — install the extension instead. [Source: code.visualstudio.com/docs/copilot/agents/third-party-agents] |

**Recommendation:** keep Copilot Free installed, leave inline suggestions on, **turn off agent mode** in the Copilot Chat settings. Use Claude Code for everything agentic. They cohabit cleanly because Claude is invoked via Spark icon / Cmd+Esc and Copilot is invoked via Tab.

### B2.6 Integration with watcher and Cowork scheduled tasks

The watcher (`scripts/pr-watcher/index.mjs`) shells out to `claude --print` against `docs/pr-prompts/pr-NN-*-ready.md`. The Claude Code VS Code extension shells out to the same `claude` binary. They share `~/.claude/settings.json`, MCP servers, hooks, and plugins — confirmed by Anthropic's docs. [Source: code.claude.com/docs/en/vs-code]

This has three implications:

1. **Any MCP server you add in VS Code (via `claude mcp add` in the integrated terminal) is immediately available to the watcher.** Don't double-configure.
2. **Any hook you add to `~/.claude/settings.json`** (e.g., a `PreToolUse` hook to block destructive bash commands) **applies to watcher runs.** That's a feature if you want a safety net, a footgun if you write a noisy hook.
3. **The extension's internal "ide" MCP server** (which exposes `mcp__ide__getDiagnostics` and `mcp__ide__executeCode`) is **per-VS-Code-instance** and bound to 127.0.0.1 on a random port. The watcher does not benefit from this. Don't try to wire it in.

**Cowork scheduled tasks** are completely orthogonal to VS Code. They run via the Claude.ai harness on Anthropic's infrastructure, not your machine. There is no integration with VS Code, and there shouldn't be — keep these for recurring "check Asana, summarise Slack" type jobs. VS Code is for the IDE; the watcher is for queue-processing PRs; scheduled tasks are for time-based off-machine work. Three layers, distinct jobs.

## B3. Concrete config snippets

Drop these in `C:\ProjectOperations2\.vscode\`. All verified against the VS Code Tasks docs (last revised 2026-05-28) and the VS Code variable reference. None use Mac/Linux-only syntax — every one of these will run unchanged on Windows 11 with PowerShell as the default shell.

### B3.1 `.vscode/extensions.json`

```json
{
  "recommendations": [
    "anthropic.claude-code",
    "ms-vscode.vscode-node-azure-pack",
    "Prisma.prisma",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-playwright.playwright",
    "github.vscode-github-actions",
    "ms-ossdata.vscode-postgresql",
    "github.copilot",
    "github.copilot-chat"
  ],
  "unwantedRecommendations": [
    "saoudrizwan.claude-dev",
    "continue.continue",
    "codeium.codeium"
  ]
}
```

### B3.2 `.vscode/tasks.json`

Every entry uses `npm` task type (which works for `pnpm` in VS Code 1.98+ via the script field). The `cross-env` discipline from `CLAUDE.md` is honoured — no `set VAR=val&&` syntax. `presentation.panel: "dedicated"` keeps output windows from cannibalising each other.

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev: all (api + web)",
      "type": "npm",
      "script": "dev",
      "problemMatcher": [],
      "isBackground": true,
      "presentation": { "panel": "dedicated", "reveal": "always", "clear": true },
      "detail": "pnpm dev — starts NestJS API and Vite web in parallel."
    },
    {
      "label": "dev: api only",
      "type": "npm",
      "script": "dev:api",
      "problemMatcher": [],
      "isBackground": true,
      "presentation": { "panel": "dedicated", "reveal": "always" },
      "detail": "pnpm dev:api"
    },
    {
      "label": "dev: web only",
      "type": "npm",
      "script": "dev:web",
      "problemMatcher": [],
      "isBackground": true,
      "presentation": { "panel": "dedicated", "reveal": "always" },
      "detail": "pnpm dev:web"
    },
    {
      "label": "build",
      "type": "npm",
      "script": "build",
      "problemMatcher": ["$tsc"],
      "group": { "kind": "build", "isDefault": true },
      "presentation": { "panel": "dedicated", "reveal": "silent" },
      "detail": "pnpm build — full monorepo build."
    },
    {
      "label": "lint",
      "type": "npm",
      "script": "lint",
      "problemMatcher": ["$eslint-stylish"],
      "presentation": { "panel": "dedicated", "reveal": "silent" },
      "detail": "pnpm lint"
    },
    {
      "label": "test: api (serial)",
      "type": "npm",
      "script": "test:api:serial",
      "problemMatcher": [],
      "group": "test",
      "presentation": { "panel": "dedicated", "reveal": "always" },
      "detail": "pnpm test:api:serial — required for DB-touching tests."
    },
    {
      "label": "test: web (logic)",
      "type": "npm",
      "script": "test:web:logic",
      "problemMatcher": [],
      "group": "test",
      "presentation": { "panel": "dedicated", "reveal": "silent" },
      "detail": "pnpm test:web:logic"
    },
    {
      "label": "compliance: smoke",
      "type": "npm",
      "script": "compliance:smoke",
      "problemMatcher": [],
      "presentation": { "panel": "dedicated", "reveal": "always", "clear": true },
      "detail": "Full compliance smoke runner — run before opening any PR."
    },
    {
      "label": "prisma: generate",
      "type": "npm",
      "script": "prisma:generate",
      "problemMatcher": [],
      "presentation": { "panel": "dedicated", "reveal": "silent" },
      "detail": "pnpm prisma:generate"
    },
    {
      "label": "prisma: migrate (dev)",
      "type": "npm",
      "script": "prisma:migrate",
      "problemMatcher": [],
      "presentation": { "panel": "dedicated", "reveal": "always" },
      "detail": "DANGER on main — only run on a section branch."
    },
    {
      "label": "seed",
      "type": "npm",
      "script": "seed",
      "problemMatcher": [],
      "presentation": { "panel": "dedicated", "reveal": "always" },
      "detail": "pnpm seed — idempotent, safe to re-run."
    },
    {
      "label": "ship checklist (build + lint + smoke)",
      "dependsOn": ["build", "lint", "compliance: smoke"],
      "dependsOrder": "sequence",
      "problemMatcher": [],
      "detail": "The PR-checklist tasks chained — run this before merging."
    }
  ]
}
```

`Ctrl+Shift+B` will run the default build task (`build`). The composite `ship checklist` task runs the three things you need before any PR.

### B3.3 `.vscode/launch.json`

Three debug configs: NestJS API with breakpoints, Vite web, and Playwright tests.

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug: NestJS API",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@project-ops/api", "dev"],
      "skipFiles": ["<node_internals>/**"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "env": { "NODE_ENV": "development" },
      "windows": { "runtimeExecutable": "pnpm.cmd" }
    },
    {
      "name": "Debug: Web (Vite — Chrome)",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/apps/web/src",
      "preLaunchTask": "dev: web only",
      "sourceMaps": true
    },
    {
      "name": "Debug: Playwright (current file)",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/@playwright/test/cli.js",
      "args": ["test", "${relativeFile}", "--headed"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "windows": { "runtimeExecutable": "node.exe" }
    },
    {
      "name": "Attach: NestJS API (already running)",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    }
  ],
  "compounds": [
    {
      "name": "Dev: API + Web (debug)",
      "configurations": ["Debug: NestJS API", "Debug: Web (Vite — Chrome)"],
      "stopAll": true
    }
  ]
}
```

The `windows.runtimeExecutable: "pnpm.cmd"` override is required on Windows because PowerShell will not resolve `pnpm` (a `.ps1` shim) the same way as Linux's PATH lookup. This is the single most common Windows-specific debug gotcha. The `Attach` config is for the case where you started the API yourself with `--inspect` and just want VS Code to hook in.

### B3.4 `.vscode/settings.json`

Workspace settings — committed to repo so every developer (and the watcher's runtime, if they happen to open VS Code) gets the same defaults.

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "typescript.tsdk": "node_modules/typescript/lib",
  "claudeCode.initialPermissionMode": "plan",
  "claudeCode.preferredLocation": "sidebar",
  "claudeCode.respectGitIgnore": true,
  "github.copilot.chat.agent.enabled": false,
  "github.copilot.enable": {
    "*": true,
    "markdown": true,
    "yaml": true
  },
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[prisma]": { "editor.defaultFormatter": "Prisma.prisma" }
}
```

`files.eol: "\n"` is important on Windows — without it, Git keeps re-flagging line-ending changes whenever a Linux teammate or CI runner touches a file.

### B3.5 `.devcontainer/devcontainer.json` (optional, new-laptop onboarding)

Only worth committing if you ever onboard another person, or if you want a reproducible environment that survives Windows reinstalls. Skip if you're the sole dev.

```json
{
  "name": "ProjectOperations dev",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:22-bookworm",
  "features": {
    "ghcr.io/devcontainers/features/git:1": {},
    "ghcr.io/devcontainers/features/github-cli:1": {},
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  },
  "postCreateCommand": "npm i -g pnpm@10 && pnpm install --frozen-lockfile",
  "forwardPorts": [3000, 5173, 5432],
  "customizations": {
    "vscode": {
      "extensions": [
        "anthropic.claude-code",
        "Prisma.prisma",
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "ms-playwright.playwright"
      ],
      "settings": {
        "claudeCode.initialPermissionMode": "plan"
      }
    }
  },
  "remoteUser": "node"
}
```

CAVEAT-UNVERIFIED: the exact image tag (`typescript-node:22-bookworm`) is the current Microsoft-published convention as of mid-2026, but Microsoft refreshes these images quarterly. Pin to a tag, not `latest`, and check `mcr.microsoft.com/devcontainers/typescript-node:22` ships with Node 22 LTS when you adopt this.

## B4. Top 3 wins ranked by impact-per-effort

If you do nothing else this week, do these three things, in this order.

### B4.1 Install the Azure Tools extension pack + Claude Code extension (15 minutes, immediate payoff)

Open VS Code, hit `Ctrl+Shift+X`, search "Azure Tools" and "Claude Code", install both. Sign into Anthropic in the Claude panel, sign into Azure in the Azure activity bar. That's it. You now have:

- The full Azure portal tree in your sidebar, with one-click log streaming from your Web App.
- A persistent Claude Code chat in your sidebar that knows about your selected text and respects `.gitignore`.
- A `claude` CLI available in the integrated terminal (`Ctrl+\``) for ad-hoc one-shots without leaving VS Code.

This is the single highest-impact change. Everything else is polish.

### B4.2 Commit the `.vscode/` folder (30 minutes, payoff forever)

Copy the four files from section B3 into `.vscode/`, commit on a branch named `improvement/devx-vscode-config`, open a PR. The PR is mechanical — no functional code change — but the moment it merges, every script in the monorepo becomes a one-key command (`Ctrl+Shift+P → Run Task`), debugging the API gets a real breakpoint UI, and any new contributor (or future-you on a fresh laptop) sees the extension-recommendations popup.

The reason this is #2 not #1: it only pays off if you've already installed the extensions in #1.

### B4.3 Add the GitHub MCP server to Claude Code (10 minutes, big payoff for repo-aware sessions)

Open the integrated terminal and run:

```powershell
claude mcp add --transport http github https://api.githubcopilot.com/mcp/ `
  --header "Authorization: Bearer YOUR_GITHUB_PAT"
```

(Use a fine-grained PAT scoped to `GH-Mantova/ProjectOperations`.) From this point, in *either* the extension *or* the watcher, you can ask Claude "look at PR #42 and tell me if the migration is safe" and it will. This MCP server is shared between the extension and the CLI, so the watcher gets it free.

CAVEAT: this MCP server is GitHub's official one (`api.githubcopilot.com/mcp/`) — it works without a paid Copilot subscription, but I'd verify the auth requirement is still PAT-only when you adopt it (GitHub has been migrating MCP auth flows to OAuth-only on the consumer plan). [Source: code.claude.com/docs/en/vs-code — confirmed PAT usage as of June 2026]

## B5. Autonomous integration verdict

**Can VS Code be a third autonomous worker?** Sort-of. Honest answer in three parts.

### B5.1 What the extension cannot do

The Claude Code VS Code extension has no first-party "run this prompt on a schedule" or "run this prompt unattended" feature. It is a chat UI. Even with `acceptEdits` permission mode, somebody still has to type the prompt into the chat box. The extension's URI handler (`vscode://anthropic.claude-code/open?prompt=...`) **pre-fills but does not auto-submit** the prompt — Anthropic explicitly notes "The prompt is pre-filled but not submitted automatically." [Source: code.claude.com/docs/en/vs-code, URI handler section]

So you cannot point Task Scheduler at VS Code and expect it to grind through prompts unattended.

### B5.2 What you could rig

If you really wanted VS Code to "drive" autonomous runs, the path is:

- Use Task Scheduler (or PowerShell `Register-ScheduledTask`) to fire a script
- The script calls `claude --bare -p "..." --allowedTools "Read,Edit,Bash"`
- Optionally, after the run, the script opens the result file in VS Code with `code "C:\path\to\result.md"`

But this is **exactly what the watcher already does**, with better queueing semantics, auto-merge polling, pause-on-failure, and structured logging. Rebuilding it inside VS Code with worse ergonomics is not a win.

### B5.3 What VS Code *should* do for you

Treat the Claude Code extension as the **interactive, human-in-the-loop** Claude surface. Use it for:

- Exploratory edits where you want to read the plan before committing.
- Debugging — "why is this Playwright test flaky on Firefox?" with `@test/file#42-80` mentions.
- Quick code review of an in-flight branch — open Claude in the editor area, paste the diff, ask for second opinions.
- Talking to the GitHub MCP about PRs, issues, runs.

Keep the watcher for **non-interactive PR generation** from your queue of `pr-NNN-ready.md` files. Keep Cowork scheduled tasks for **off-machine, time-based** automation. Three lanes. Don't try to merge them.

**The verdict: VS Code is a powerful third surface, but not a third autonomous worker.** And you should be glad — adding a third unattended agent loop is a maintenance burden you don't need.

## B6. Gaps, caveats, and what NOT to do

### B6.1 Do NOT

- **Do NOT enable `allowDangerouslySkipPermissions`** in the extension. It bypasses *every* permission check. Anthropic explicitly says "Use it only in sandboxes with no internet access." Your dev machine has internet. [Source: code.claude.com/docs/en/vs-code, settings reference]
- **Do NOT auto-run `pnpm dev` on folder open.** Tempting, but conflicts with the watcher's expectations and clogs the terminal panel.
- **Do NOT install Cline, Continue, Codeium, or Tabnine** alongside Claude Code and Copilot. Documented conflict with the Claude spark icon.
- **Do NOT pay for Copilot Pro+ just to get Claude inside Copilot.** That feature exists (third-party agents in Copilot), but you already have Claude via the free extension — same model access, same agent loop, none of the Copilot subscription cost.
- **Do NOT migrate the watcher into a VS Code task.** It runs headlessly without a VS Code window. Moving it to VS Code couples your nightly autonomous loop to your editor being open.
- **Do NOT use code-server / VS Code Server for the autonomous loop.** Adds a process-supervision layer you don't need. The watcher already handles this with `node` + Task Scheduler.

### B6.2 Watch out for (Windows-specific)

- **PowerShell tasks:** the `npm` task type works with pnpm because VS Code resolves npm scripts by reading `package.json` directly, not by shelling out. If you fall back to `"type": "shell"` for a custom command, prefix the shell so PowerShell doesn't choke on `&&` chaining. Use PowerShell-native `;` or split into two tasks with `dependsOn`.
- **`pnpm` path resolution in `launch.json`:** always use the `windows.runtimeExecutable: "pnpm.cmd"` override (shown in section B3.3). Without it, the launch config silently fails on PowerShell.
- **Line endings:** `files.eol: "\n"` in workspace settings. Otherwise Git becomes a mess.
- **No Unix sockets:** code-server's IPC layer is built around Unix sockets. Don't try to port it to Windows.
- **The Claude Code extension's internal MCP server** binds to `127.0.0.1` on a random high port. Windows Firewall might prompt the first time. Allow it — local-only, low risk.

### B6.3 Caveats and unverified items

- **CAVEAT-UNVERIFIED:** Some 2026 third-party blog posts claim the Claude Code extension supports a `claudeCode.scheduledPrompts` setting for unattended runs. **No such setting exists in Anthropic's official docs as of June 2026.** Ignore those posts.
- **CAVEAT-UNVERIFIED:** The Anthropic docs note "Starting June 15, 2026, Agent SDK and `claude -p` usage on subscription plans will draw from a new monthly Agent SDK credit, separate from your interactive usage limits." This affects the watcher (which uses `claude --print`). Before that date arrives, check Anthropic's pricing page for the credit allotment on your plan tier. The watcher may need throttling, or you may need to move it to API-key billing if the credit is too thin. [Source: code.claude.com/docs/en/headless, top-of-page note dated June 2026]
- **Copilot Free's 50 premium requests/month** drains fast under agent mode. Disabling Copilot agent mode in settings is not just a tidiness choice — it actively prevents your tab-completion budget from being burned by background activity.
- **The Azure App Service VS Code "deploy from VS Code" flow** is fine for one-off pushes, but you already have GitHub Actions doing this on merge. Don't deploy from VS Code on a regular cadence — it bypasses CI. Use VS Code's Azure tree mainly for log streaming and resource inspection, not for deploys.

### B6.4 What to wait on

- **Microsoft Foundry / Copilot Workspaces / Agent HQ integrations** — moving rapidly in 2026. The "Pick your agent" Agent HQ flow (announced October 2025) is now GA and lets you delegate to Claude inside Copilot, but only on Pro+. Wait six months — if Anthropic and GitHub keep converging, the right play might shift. For now: extension + free Copilot is correct.
- **Local agents** (`code.visualstudio.com/docs/copilot/agents/local-agents`) — VS Code has a "Local Agents" concept where the agent runs on-device. Currently tied to Copilot. If/when this opens up to Claude as a "local third-party agent", revisit — it could be a cleaner way to do unattended work inside the editor. Today, it doesn't replace the watcher.

## B7. Sources

Primary sources, all fetched or searched 2026-06-08:

- **Claude Code VS Code docs** — `https://code.claude.com/docs/en/vs-code` (full fetch, June 2026 revision)
- **Claude Code headless docs** — `https://code.claude.com/docs/en/headless` (full fetch, June 2026 revision)
- **Claude Code extension marketplace listing** — `https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code` (verified publisher, ~15.8M installs, v2.1.159)
- **VS Code Third-party agents docs** — `https://code.visualstudio.com/docs/copilot/agents/third-party-agents` (revised 2026-04-22)
- **VS Code Tasks docs** — `https://code.visualstudio.com/docs/debugtest/tasks` (revised 2026-05-28)
- **Azure Tools extension pack** — `https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-node-azure-pack`
- **GitHub Copilot Plans & Pricing** — `https://github.com/features/copilot/plans` (June 2026)
- **VS Code Workspace Trust** — `https://code.visualstudio.com/docs/editing/workspaces/workspace-trust`
- **VS Code Azure Remote Debugging** — `https://code.visualstudio.com/docs/azure/remote-debugging`

Secondary sources cross-checked for consistency:

- GitHub blog "Pick your agent: Use Claude and Codex on Agent HQ" (Oct 2025)
- GitHub Copilot CLI GA announcement (Feb 25, 2026)
- Mykola Aleksandrov "VS Code launch.json & tasks.json — Ultimate Practical Guide" (2025-08)

Files in scope:

- `C:\ProjectOperations2\scripts\pr-watcher\index.mjs` — current watcher implementation
- `C:\ProjectOperations2\CLAUDE.md` — project conventions

---

*End of report.*
