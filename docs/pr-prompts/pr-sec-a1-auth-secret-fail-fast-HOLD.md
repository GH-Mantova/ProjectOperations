---
premise: 'grep -rq "replace-me-access" apps/api/src/modules/auth/auth.service.ts'
premise_means: Production signs and checks staff and portal tokens with secrets that silently fall back to values published in this repo, so a missing or mistyped Azure setting would let anyone forge a login.
scope:
  - apps/api/src/config/auth.config.ts
  - apps/api/src/config/auth.config.spec.ts
  - apps/api/src/common/auth/jwt-auth.guard.ts
  - apps/api/src/modules/auth/auth.module.ts
  - apps/api/src/modules/auth/auth.service.ts
  - apps/api/src/modules/portal/portal-auth.service.ts
  - apps/api/src/modules/portal/portal-jwt.guard.ts
  - apps/api/src/modules/portal/portal.module.ts
  - apps/api/src/modules/safety/realtime/safety-realtime.guard.ts
  - apps/api/src/modules/security/security.module.ts
  - apps/api/src/modules/xero/xero.service.ts
done_when: pnpm build && pnpm lint && ! grep -rq "replace-me" apps/api/src && grep -q "SEC_A1_AUTH_FAIL_FAST_V1" apps/api/src/config/auth.config.ts
size: 3
gate_allow: none
seed_only: false
escalates: true
module: auth
cluster: sec-auth
cluster_order: 2
requires_on_main: apps/api/src/modules/auth/otp-delivery.port.ts :: SEC_A3_NO_CREDENTIAL_LOGS_V1
---

<!-- watcher: do-not-arm | MARCO GATE: arm only after Marco confirms in Azure that the API App Service has JWT_ACCESS_SECRET and JWT_REFRESH_SECRET set, each 32+ characters, different from each other, not a placeholder. Only Marco removes this line. -->

# Security A1: refuse to start in production on a missing or published JWT secret

**Requested by Marco 2026-09-21** after an external review; re-verified on main `ff46a3b3` (2026-09-24, Wave 1) - 20 `replace-me` occurrences across the same 10 files.
Second of three (A3 logs -> **A1 this** -> A2 email). Per the 2026-09-24 handover, A1 is also the prerequisite for the later `authsession` (F02) cluster. **Code only**: it never reads, sets or changes
an Azure setting. Held by Marco's gate above because a wrong Azure setting turns this PR into a
production outage.

## Grounded on origin/main a138460e - re-verify before you edit

- `auth.config.ts:24-25` - `JWT_ACCESS_SECRET ?? "replace-me-access"`,
  `JWT_REFRESH_SECRET ?? "replace-me-refresh"`. No production check. Portal secrets are derived
  from these by `derivePortalSecret` (SHA-256) and only *warn* in production when `PORTAL_JWT_*`
  is unset - leave the derivation as it is.
- The same literals are repeated as `configService.get(..., "replace-me-...")` second defaults in
  10 files / 20 occurrences (`jwt-auth.guard.ts`, `auth.module.ts`, `auth.service.ts` x5,
  `portal-auth.service.ts` x5, `portal-jwt.guard.ts`, `portal.module.ts`,
  `safety-realtime.guard.ts`, `security.module.ts`, `xero.service.ts` x2, `auth.config.ts` x2).
  `git grep -n "replace-me" -- apps/api/src` for the live list.
- `isProductionRuntime()` lives in `apps/api/src/config/runtime-env.ts` (shipped by A3). Reuse it.
- CI sets `JWT_*_SECRET: ci-access-secret`; `playwright*.yml` set the `replace-me-*` values. None may
  run as production - check each workflow's `NODE_ENV` and report what you found in the PR body.

## What to build

1. **`auth.config.ts`**
   - `export const SEC_A1_AUTH_FAIL_FAST_V1 = "sec-a1";`
   - `export function assertProductionAuthSecrets(env: NodeJS.ProcessEnv = process.env): void` -
     when `isProductionRuntime(env)`, throw **one** `Error` listing every problem:
     `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` missing; shorter than 32 characters; starting with
     `replace-me`, `dev-only`, `ci-` or `change`; or the two identical. The message names the
     variable and the rule broken, **never the value**. Outside production it does nothing.
   - Call it first thing in the `registerAs("auth", ...)` factory, so the API refuses to boot.
   - Non-production fallbacks become `"dev-only-access-secret"` / `"dev-only-refresh-secret"`.
2. **Every `configService.get(..., "replace-me-...")`** becomes
   `configService.getOrThrow<string>("auth.accessSecret")` (or `refreshSecret` /
   `portalResetSecret`, matching the key already used). The config factory always supplies a
   value, so the second default was only ever another copy of the published secret.

## Tests (`auth.config.spec.ts`)
- Production + missing / short / each placeholder prefix / identical secrets each throw, and the
  message never contains the secret value.
- `WEBSITE_SITE_NAME` alone counts as production.
- Two distinct 32+ character secrets pass. Non-production never throws.

## Do NOT
- Do NOT touch Azure, App Service settings, Key Vault, Entra, SharePoint, Graph or SMTP.
- Do NOT change token lifetimes, claims, portal derivation or `AUTH_MODE` behaviour.
- Do NOT edit any workflow or `.env.example`.

## PR body must open with, bare
```
BEFORE MERGE (Marco): the API App Service must have JWT_ACCESS_SECRET and JWT_REFRESH_SECRET set,
each 32+ characters, different from each other, not a placeholder. Otherwise the API refuses to
start after the next deploy and production is down until the setting is fixed or rolled back.
```

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never ask a question or stand by.
- If `SEC_A3_NO_CREDENTIAL_LOGS_V1` is not on main, STOP with `NO-OP: predecessor sec-a3 not merged`.
- Read the CI job log before diagnosing a failure. `pnpm build` + `pnpm lint` must pass.
- Authentication change: label the PR `do-not-merge`.
