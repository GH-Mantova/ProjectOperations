---
premise: '! grep -q "PUPPETEER_EXECUTABLE_PATH" .env.example'
premise_means: .env.example does not yet document PUPPETEER_EXECUTABLE_PATH, so the runtime env vars read by apps/api are still undocumented.
scope:
  - .env.example
done_when: grep -q "PUPPETEER_EXECUTABLE_PATH" .env.example && grep -q "PRISMA_CLIENT_ENGINE_TYPE" .env.example && grep -q "PUPPETEER_CACHE_DIR" .env.example && grep -q "GIT_SHA" .env.example
size: 1
gate_allow: env-vars
seed_only: false
escalates: false
---

# Document the 4 runtime env vars that `apps/api` reads but `.env.example` never mentions

## Premise evidence (Part 0 sub-check (f), scanner run 2026-07-20, clean worktree off origin/main @ 497e09c)

A scan of every `process.env.X` reference under `apps/api/src` (31 distinct vars, positive control
passed) against `.env.example` (66 declared vars, positive control passed) found **4 vars read at
runtime but documented nowhere in `.env.example`**:

| Var | Read at | Set in deploy.yml? |
|---|---|---|
| `PUPPETEER_EXECUTABLE_PATH` | `apps/api/src/modules/pdf-rendering/pdf-renderer.service.ts:128` | **NO — set nowhere** |
| `PRISMA_CLIENT_ENGINE_TYPE` | `apps/api/src/prisma/prisma.service.ts` | **NO — set nowhere** |
| `PUPPETEER_CACHE_DIR` | `apps/api/src/modules/pdf-rendering/pdf-renderer.service.ts:152` | yes |
| `GIT_SHA` | `apps/api/src/health/health.service.ts`, `apps/api/src/modules/client-versions/client-versions.service.ts` | yes |

`PUPPETEER_EXECUTABLE_PATH` matters most: it is the **documented escape hatch for the known quote-PDF
500** (`sot/05` — "Chrome for PDF rendering is not installed"). `pdf-renderer.service.ts:128-140` reads
it, validates the path exists, and throws a specific error if it does not — but no developer would ever
learn the var exists, because it appears in no example file and no workflow.

Not previously filed: no prompt under `docs/pr-prompts/` matches these vars, no open PR touches
`.env.example`, and **#682** (`docs(env): document AUTH_MODE and optional ENTRA_* overrides`) merged
covering only the auth vars.

## What to build

Append a clearly-commented block to `.env.example`. All four are **optional overrides** — do NOT
present them as required, and do NOT set real values. Use empty/commented defaults so a developer
copying `.env.example` to `.env` gets identical behaviour to today.

Suggested content (adapt to the file's existing comment style):

```
# --- Optional runtime overrides (all unset by default) ---

# Absolute path to a Chrome/Chromium binary for quote-PDF rendering.
# Leave unset to use the Chrome that `npx puppeteer browsers install chrome` provides.
# If set to a path that does not exist, PDF rendering fails fast with an explicit error.
PUPPETEER_EXECUTABLE_PATH=

# Where puppeteer looks for its downloaded browsers. Set by the deploy workflow;
# leave unset locally to use puppeteer's default cache directory.
PUPPETEER_CACHE_DIR=

# Prisma query-engine type override (e.g. "binary"). Leave unset for the default.
PRISMA_CLIENT_ENGINE_TYPE=

# Commit sha surfaced by /health and the client-version endpoint.
# Injected by the deploy workflow; unset locally means "unknown".
GIT_SHA=
```

## Do NOT

- Do NOT change any source file, workflow, Dockerfile, or `sot/*`. **`.env.example` is the only file in scope.**
- Do NOT add real secrets or real paths — every value stays empty.
- Do NOT remove, reorder, or reword any existing line in `.env.example`; this change is **purely additive**.
- Do NOT add vars beyond the four listed.
- Do NOT touch `.env` (untracked, machine-local).

## PR body requirement

Include this as a **bare line at column 0** of the PR body (CP-12 hard-fails an undeclared env-var change):

```
GATE-ALLOW: env-vars
```

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if you cannot proceed, say `NO-OP: <reason>` and why.
- **Never ask a question or "stand by" for approval.** There is no human in a headless run.
- If CI fails, **read the job log before diagnosing**. Do not infer the cause from the check name.
- Do NOT auto-merge — open the PR and leave it for the supervisor.
- Completion test: **is there a PR number in my output?** If no, and the work was already on `main`,
  say `NO-OP: already documented`. If no because you are waiting for someone — wrong, open the PR.
