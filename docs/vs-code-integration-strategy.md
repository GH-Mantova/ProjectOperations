# VS Code Integration Strategy for ProjectOperations

> **Superseded by [vscode-max-strategy.md](vscode-max-strategy.md)** — retained for provenance.

**Author:** Cowork deep-research run
**Date:** 2026-06-08
**Audience:** Marco (WHS & Commercial Compliance officer, coordinator role)
**Stack reminder:** NestJS API + React/Vite web + PostgreSQL + Prisma, pnpm monorepo, Azure-hosted (Web App / Static Web Apps / Azure DB for PostgreSQL), Windows 11.

---

## 1. Executive summary

- **Install the Claude Code for VS Code extension and the Azure Tools extension pack — these are the two highest-impact items.** The Claude Code extension is free, published by Anthropic (verified publisher, ~15.8M installs as of June 2026), works against your existing Pro/Max/API subscription, and ships the same CLI you already use for the watcher. It does not duplicate the watcher — it replaces the manual ad-hoc Claude sessions you currently run on the side.
- **Add a `.vscode/` folder to the repo with `tasks.json`, `launch.json` and `extensions.json`.** Right now, every script Marco runs is typed into a terminal. `tasks.json` turns `pnpm dev`, `pnpm compliance:smoke`, `pnpm prisma:migrate` etc. into one-key commands. `launch.json` lets you debug the NestJS API with breakpoints and step through Playwright tests. This is the "configure once and forget" win.
- **VS Code can be a third autonomous worker — but only weakly, and only in ways that overlap with the watcher.** The Claude Code extension exposes a `vscode://anthropic.claude-code/open?prompt=...` URI handler that opens (but does not auto-submit) a pre-filled prompt. There is no first-party "fire-and-forget headless" mode from inside the extension UI. Anything truly autonomous still goes through `claude --print` (which is exactly what the watcher already does). **Do not rebuild the watcher inside VS Code.**
- **GitHub Copilot Free is worth keeping enabled alongside Claude Code, not as a replacement.** Copilot Free gives you 2,000 completions plus 50 premium requests per month at $0, and inline tab-completion is a genuinely different workflow from Claude Code's chat/agent paradigm. Copilot Free now includes Claude Sonnet 4.6 in Chat. Agent mode is supported on Free but eats the 50-request cap fast. [Source: github.com/features/copilot/plans]
- **The autonomous loop you already have is the right one.** The watcher is producing PRs. Cowork scheduled tasks handle recurring jobs. VS Code's job is to make the *human-in-the-loop* parts (debugging, deploying, reviewing diffs, exploratory edits) frictionless — not to spawn a third agent. Optimise for that.

---

## 2. Layer-by-layer recommendations

### 2.1 Workspace config — commit a `.vscode/` folder

There is no `.vscode/` folder in `C:\ProjectOperations2` today. Add one with three files:

1. `extensions.json` — recommended extensions, so any future contributor (or a fresh laptop) gets a one-click install prompt.
2. `tasks.json` — every `pnpm` script turned into a VS Code task. Run with `Ctrl+Shift+P → Tasks: Run Task` or `Ctrl+Shift+B` for the default build.
3. `launch.json` — debug configurations for the NestJS API, Vite, and Playwright.

Concrete snippets in section 3.

**Workspace trust:** VS Code refuses to auto-run tasks in untrusted folders. After cloning, click "Trust this folder" or the extension panel and tasks file will be silent. [Source: code.visualstudio.com/docs/editing/workspaces/workspace-trust]

**Auto-run tasks on folder open** is possible (`"runOptions": { "runOn": "folderOpen" }`) but **explicitly do not enable this for `pnpm dev`** — the watcher already has automation jobs, and a build process auto-spawning every time you open VS Code makes log triage miserable. Reserve it for cheap things (e.g., a "validate `.env`" task). [Source: VS Code Tasks docs, last reviewed 2026-05-28]

### 2.2 Recommended extensions

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

### 2.3 Claude Code extension setup

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

### 2.4 Azure tooling for the ProjectOperations stack

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

### 2.5 Copilot vs Claude Code — honest verdict

| Capability | Copilot Free | Claude Code extension | Notes |
|---|---|---|---|
| Inline tab completion | Yes, 2,000/mo | No (not its model) | Copilot wins. Tab completion is its strongest feature. |
| Multi-file agent edits | Yes, but eats 50-req cap fast | Yes, primary feature | Claude wins. Plan mode + checkpoints are state of the art. |
| Long-context (1M tokens) | No (32K-128K) | Yes (Opus 4.7 on the right plan) | Claude wins for repo-wide tasks. |
| Cost | $0 | $20/mo Pro or API | Copilot Free is free. Your Anthropic plan covers Claude. |
| Headless / CLI | `copilot` CLI (GA Feb 25, 2026) | `claude --print` (mature) | Both work. You already use `claude --print` in the watcher. |
| Third-party Claude agent inside Copilot | Pro+ and Enterprise only | n/a | Free tier does not get this. Don't pay for Pro+ just for this — install the extension instead. [Source: code.visualstudio.com/docs/copilot/agents/third-party-agents] |

**Recommendation:** keep Copilot Free installed, leave inline suggestions on, **turn off agent mode** in the Copilot Chat settings. Use Claude Code for everything agentic. They cohabit cleanly because Claude is invoked via Spark icon / Cmd+Esc and Copilot is invoked via Tab.

### 2.6 Integration with watcher and Cowork scheduled tasks

The watcher (`scripts/pr-watcher/index.mjs`) shells out to `claude --print` against `docs/pr-prompts/pr-NN-*-ready.md`. The Claude Code VS Code extension shells out to the same `claude` binary. They share `~/.claude/settings.json`, MCP servers, hooks, and plugins — confirmed by Anthropic's docs. [Source: code.claude.com/docs/en/vs-code]

This has three implications:

1. **Any MCP server you add in VS Code (via `claude mcp add` in the integrated terminal) is immediately available to the watcher.** Don't double-configure.
2. **Any hook you add to `~/.claude/settings.json`** (e.g., a `PreToolUse` hook to block destructive bash commands) **applies to watcher runs.** That's a feature if you want a safety net, a footgun if you write a noisy hook.
3. **The extension's internal "ide" MCP server** (which exposes `mcp__ide__getDiagnostics` and `mcp__ide__executeCode`) is **per-VS-Code-instance** and bound to 127.0.0.1 on a random port. The watcher does not benefit from this. Don't try to wire it in.

**Cowork scheduled tasks** are completely orthogonal to VS Code. They run via the Claude.ai harness on Anthropic's infrastructure, not your machine. There is no integration with VS Code, and there shouldn't be — keep these for recurring "check Asana, summarise Slack" type jobs. VS Code is for the IDE; the watcher is for queue-processing PRs; scheduled tasks are for time-based off-machine work. Three layers, distinct jobs.

---

## 3. Concrete config snippets

Drop these in `C:\ProjectOperations2\.vscode\`. All verified against the VS Code Tasks docs (last revised 2026-05-28) and the VS Code variable reference. None use Mac/Linux-only syntax — every one of these will run unchanged on Windows 11 with PowerShell as the default shell.

### 3.1 `.vscode/extensions.json`

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

### 3.2 `.vscode/tasks.json`

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

### 3.3 `.vscode/launch.json`

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

### 3.4 `.vscode/settings.json`

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

### 3.5 `.devcontainer/devcontainer.json` (optional, new-laptop onboarding)

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

---

## 4. Top 3 wins ranked by impact-per-effort

If you do nothing else this week, do these three things, in this order.

### 4.1 Install the Azure Tools extension pack + Claude Code extension (15 minutes, immediate payoff)

Open VS Code, hit `Ctrl+Shift+X`, search "Azure Tools" and "Claude Code", install both. Sign into Anthropic in the Claude panel, sign into Azure in the Azure activity bar. That's it. You now have:

- The full Azure portal tree in your sidebar, with one-click log streaming from your Web App.
- A persistent Claude Code chat in your sidebar that knows about your selected text and respects `.gitignore`.
- A `claude` CLI available in the integrated terminal (`Ctrl+\``) for ad-hoc one-shots without leaving VS Code.

This is the single highest-impact change. Everything else is polish.

### 4.2 Commit the `.vscode/` folder (30 minutes, payoff forever)

Copy the four files from section 3 into `.vscode/`, commit on a branch named `improvement/devx-vscode-config`, open a PR. The PR is mechanical — no functional code change — but the moment it merges, every script in the monorepo becomes a one-key command (`Ctrl+Shift+P → Run Task`), debugging the API gets a real breakpoint UI, and any new contributor (or future-you on a fresh laptop) sees the extension-recommendations popup.

The reason this is #2 not #1: it only pays off if you've already installed the extensions in #1.

### 4.3 Add the GitHub MCP server to Claude Code (10 minutes, big payoff for repo-aware sessions)

Open the integrated terminal and run:

```powershell
claude mcp add --transport http github https://api.githubcopilot.com/mcp/ `
  --header "Authorization: Bearer YOUR_GITHUB_PAT"
```

(Use a fine-grained PAT scoped to `GH-Mantova/ProjectOperations`.) From this point, in *either* the extension *or* the watcher, you can ask Claude "look at PR #42 and tell me if the migration is safe" and it will. This MCP server is shared between the extension and the CLI, so the watcher gets it free.

CAVEAT: this MCP server is GitHub's official one (`api.githubcopilot.com/mcp/`) — it works without a paid Copilot subscription, but I'd verify the auth requirement is still PAT-only when you adopt it (GitHub has been migrating MCP auth flows to OAuth-only on the consumer plan). [Source: code.claude.com/docs/en/vs-code — confirmed PAT usage as of June 2026]

---

## 5. Autonomous integration verdict

**Can VS Code be a third autonomous worker?** Sort-of. Honest answer in three parts.

### 5.1 What the extension cannot do

The Claude Code VS Code extension has no first-party "run this prompt on a schedule" or "run this prompt unattended" feature. It is a chat UI. Even with `acceptEdits` permission mode, somebody still has to type the prompt into the chat box. The extension's URI handler (`vscode://anthropic.claude-code/open?prompt=...`) **pre-fills but does not auto-submit** the prompt — Anthropic explicitly notes "The prompt is pre-filled but not submitted automatically." [Source: code.claude.com/docs/en/vs-code, URI handler section]

So you cannot point Task Scheduler at VS Code and expect it to grind through prompts unattended.

### 5.2 What you could rig

If you really wanted VS Code to "drive" autonomous runs, the path is:

- Use Task Scheduler (or PowerShell `Register-ScheduledTask`) to fire a script
- The script calls `claude --bare -p "..." --allowedTools "Read,Edit,Bash"`
- Optionally, after the run, the script opens the result file in VS Code with `code "C:\path\to\result.md"`

But this is **exactly what the watcher already does**, with better queueing semantics, auto-merge polling, pause-on-failure, and structured logging. Rebuilding it inside VS Code with worse ergonomics is not a win.

### 5.3 What VS Code *should* do for you

Treat the Claude Code extension as the **interactive, human-in-the-loop** Claude surface. Use it for:

- Exploratory edits where you want to read the plan before committing.
- Debugging — "why is this Playwright test flaky on Firefox?" with `@test/file#42-80` mentions.
- Quick code review of an in-flight branch — open Claude in the editor area, paste the diff, ask for second opinions.
- Talking to the GitHub MCP about PRs, issues, runs.

Keep the watcher for **non-interactive PR generation** from your queue of `pr-NNN-ready.md` files. Keep Cowork scheduled tasks for **off-machine, time-based** automation. Three lanes. Don't try to merge them.

**The verdict: VS Code is a powerful third surface, but not a third autonomous worker.** And you should be glad — adding a third unattended agent loop is a maintenance burden you don't need.

---

## 6. Gaps, caveats, and what NOT to do

### 6.1 Do NOT

- **Do NOT enable `allowDangerouslySkipPermissions`** in the extension. It bypasses *every* permission check. Anthropic explicitly says "Use it only in sandboxes with no internet access." Your dev machine has internet. [Source: code.claude.com/docs/en/vs-code, settings reference]
- **Do NOT auto-run `pnpm dev` on folder open.** Tempting, but conflicts with the watcher's expectations and clogs the terminal panel.
- **Do NOT install Cline, Continue, Codeium, or Tabnine** alongside Claude Code and Copilot. Documented conflict with the Claude spark icon.
- **Do NOT pay for Copilot Pro+ just to get Claude inside Copilot.** That feature exists (third-party agents in Copilot), but you already have Claude via the free extension — same model access, same agent loop, none of the Copilot subscription cost.
- **Do NOT migrate the watcher into a VS Code task.** It runs headlessly without a VS Code window. Moving it to VS Code couples your nightly autonomous loop to your editor being open.
- **Do NOT use code-server / VS Code Server for the autonomous loop.** Adds a process-supervision layer you don't need. The watcher already handles this with `node` + Task Scheduler.

### 6.2 Watch out for (Windows-specific)

- **PowerShell tasks:** the `npm` task type works with pnpm because VS Code resolves npm scripts by reading `package.json` directly, not by shelling out. If you fall back to `"type": "shell"` for a custom command, prefix the shell so PowerShell doesn't choke on `&&` chaining. Use PowerShell-native `;` or split into two tasks with `dependsOn`.
- **`pnpm` path resolution in `launch.json`:** always use the `windows.runtimeExecutable: "pnpm.cmd"` override (shown in section 3.3). Without it, the launch config silently fails on PowerShell.
- **Line endings:** `files.eol: "\n"` in workspace settings. Otherwise Git becomes a mess.
- **No Unix sockets:** code-server's IPC layer is built around Unix sockets. Don't try to port it to Windows.
- **The Claude Code extension's internal MCP server** binds to `127.0.0.1` on a random high port. Windows Firewall might prompt the first time. Allow it — local-only, low risk.

### 6.3 Caveats and unverified items

- **CAVEAT-UNVERIFIED:** Some 2026 third-party blog posts claim the Claude Code extension supports a `claudeCode.scheduledPrompts` setting for unattended runs. **No such setting exists in Anthropic's official docs as of June 2026.** Ignore those posts.
- **CAVEAT-UNVERIFIED:** The Anthropic docs note "Starting June 15, 2026, Agent SDK and `claude -p` usage on subscription plans will draw from a new monthly Agent SDK credit, separate from your interactive usage limits." This affects the watcher (which uses `claude --print`). Before that date arrives, check Anthropic's pricing page for the credit allotment on your plan tier. The watcher may need throttling, or you may need to move it to API-key billing if the credit is too thin. [Source: code.claude.com/docs/en/headless, top-of-page note dated June 2026]
- **Copilot Free's 50 premium requests/month** drains fast under agent mode. Disabling Copilot agent mode in settings is not just a tidiness choice — it actively prevents your tab-completion budget from being burned by background activity.
- **The Azure App Service VS Code "deploy from VS Code" flow** is fine for one-off pushes, but you already have GitHub Actions doing this on merge. Don't deploy from VS Code on a regular cadence — it bypasses CI. Use VS Code's Azure tree mainly for log streaming and resource inspection, not for deploys.

### 6.4 What to wait on

- **Microsoft Foundry / Copilot Workspaces / Agent HQ integrations** — moving rapidly in 2026. The "Pick your agent" Agent HQ flow (announced October 2025) is now GA and lets you delegate to Claude inside Copilot, but only on Pro+. Wait six months — if Anthropic and GitHub keep converging, the right play might shift. For now: extension + free Copilot is correct.
- **Local agents** (`code.visualstudio.com/docs/copilot/agents/local-agents`) — VS Code has a "Local Agents" concept where the agent runs on-device. Currently tied to Copilot. If/when this opens up to Claude as a "local third-party agent", revisit — it could be a cleaner way to do unattended work inside the editor. Today, it doesn't replace the watcher.

---

## Sources

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
