---
premise: '! grep -q "^AUTH_MODE=" .env.example'
premise_means: .env.example does not document AUTH_MODE, the switch that selects the API auth mode (apps/api/src/config/auth.config.ts reads process.env.AUTH_MODE ?? "local"), so an operator configuring SSO from .env.example has no way to know the variable exists.
scope:
  - .env.example
done_when: 'grep -q "^AUTH_MODE=local" .env.example && grep -q "ENTRA_ISSUER" .env.example'
size: 1
gate_allow: env-vars
seed_only: false
escalates: false
---

# PR prompt: document AUTH_MODE (+ optional ENTRA_* overrides) in .env.example

Branch: `docs/qa-envexample-auth-mode`. New PR.

## Why this PR exists (Station 04 Part-0 sub-check (f), env drift, S4)

Sweep of every non-test `process.env.X` reference in `apps/api/src` against `.env.example`
(run twice, identical both times: 31 referenced vars, 9 undocumented) found one that is real
application configuration and is **completely absent** from `.env.example`:

```ts
// apps/api/src/config/auth.config.ts:27
mode: process.env.AUTH_MODE ?? "local",
```

`.env.example` already documents the sibling switches `SHAREPOINT_AUTH_MODE=client-secret` and
`MAIL_AUTH_MODE=client-secret`, and documents `ENTRA_TENANT_ID` / `ENTRA_CLIENT_ID` under an
`# SSO (Microsoft 365 / Entra)` heading. `AUTH_MODE` — the switch that actually selects the auth
mode — is documented nowhere. That is the drift.

Three further Entra vars are also undocumented, but they are **optional overrides** that derive
from `ENTRA_TENANT_ID` when unset (`auth.config.ts:52-64`), so they are a documentation nicety
rather than a gap:

- `ENTRA_ISSUER` -> defaults to `https://login.microsoftonline.com/$ENTRA_TENANT_ID/v2.0`
- `ENTRA_JWKS_URI` -> defaults to `.../discovery/v2.0/keys`
- `ENTRA_AUTHORITY` -> defaults to `https://login.microsoftonline.com/$ENTRA_TENANT_ID`

The other five undocumented vars (`PORT`, `GIT_SHA`, `PRISMA_CLIENT_ENGINE_TYPE`,
`PUPPETEER_CACHE_DIR`, `PUPPETEER_EXECUTABLE_PATH`) are platform/build-injected and are
**deliberately** absent — `app.config.ts:33` even carries the comment "Azure App Service injects
PORT". Leave all five alone.

## What to do

Edit **`.env.example` only.**

1. Under the existing `# SSO (Microsoft 365 / Entra)` section, add a documented `AUTH_MODE` entry
   whose value is the code default:

   ```
   # Auth mode for the staff API. "local" (default) authenticates against the internal
   # user table. Read by apps/api/src/config/auth.config.ts.
   AUTH_MODE=local
   ```

   The line `AUTH_MODE=local` must be bare at column 0 (the `done_when` greps `^AUTH_MODE=local`).

2. Immediately below `ENTRA_CLIENT_ID=`, add the three optional overrides as **commented-out**
   lines with a one-line note that each is derived from `ENTRA_TENANT_ID` when unset:

   ```
   # Optional overrides. Each is derived from ENTRA_TENANT_ID when left unset.
   # ENTRA_ISSUER=
   # ENTRA_JWKS_URI=
   # ENTRA_AUTHORITY=
   ```

3. Read the file back and confirm both `done_when` greps match before you open the PR.

## Do NOT

- Do NOT change any code. `.env.example` is the entire scope. Touching `auth.config.ts` (for
  example to "validate" AUTH_MODE, or to add an `entra` mode) is out of scope and is a design
  question for Marco.
- Do NOT add `PORT`, `GIT_SHA`, `PRISMA_CLIENT_ENGINE_TYPE`, `PUPPETEER_CACHE_DIR` or
  `PUPPETEER_EXECUTABLE_PATH` — they are platform-injected on purpose.
- Do NOT touch Azure, Entra, SharePoint, App Service settings, or any real secret value. Every
  value you add is either the literal code default or an empty commented-out placeholder.
- Do NOT put a real tenant id, client id, or secret anywhere in this file.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails

- One attempt. If blocked, say `NO-OP: <reason>` loudly -- never exit silently, never "stand by"
  for approval (there is no human in this run).
- Put `GATE-ALLOW: env-vars` bare at column 0 of the PR body (a `##` heading does NOT match the
  gate regex).
- `pnpm build` + `pnpm lint` must pass before you open the PR.
- Read the CI job log before diagnosing any CI failure; never re-run hoping for green.
- The completion test: is there a PR number in your output? If not because the work was already on
  main, say `NO-OP`. If not because you are waiting for someone -- there is nobody. Open the PR.
