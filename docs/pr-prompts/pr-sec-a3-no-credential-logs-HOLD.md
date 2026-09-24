---
premise: '! grep -rq "SEC_A3_NO_CREDENTIAL_LOGS_V1" apps/api/src'
premise_means: In production the API writes live field-worker sign-in codes and client-portal password-reset links (with their token) into the application log, where anyone with log access can use them.
scope:
  - apps/api/src/config/runtime-env.ts
  - apps/api/src/config/runtime-env.spec.ts
  - apps/api/src/modules/auth/otp-delivery.port.ts
  - apps/api/src/modules/auth/otp-delivery.port.spec.ts
  - apps/api/src/modules/auth/auth.module.ts
  - apps/api/src/modules/portal/portal-auth.service.ts
  - apps/api/src/modules/portal/portal-auth.service.spec.ts
done_when: pnpm build && pnpm lint && grep -q "SEC_A3_NO_CREDENTIAL_LOGS_V1" apps/api/src/modules/auth/otp-delivery.port.ts && grep -q "DisabledOtpDelivery" apps/api/src/modules/auth/auth.module.ts
size: 2
gate_allow: none
seed_only: false
escalates: true
module: auth
cluster: sec-auth
cluster_order: 1
---

# Security A3: stop writing sign-in codes and reset links to the production log

**Requested by Marco 2026-09-21** after an external review; re-verified on main `ff46a3b3` (2026-09-24, Wave 1).
First of three (A3 this, then A1 secret check, A2 email delivery). Ships alone, no gate.
**Code only** - no Azure, no Graph / SMTP wiring, no mail sending (that is A2).

## Grounded on origin/main a138460e - re-verify before you edit

- `auth.module.ts:~50` always binds `{ provide: OTP_DELIVERY_PORT, useClass: LoggingOtpDelivery }`.
- `otp-delivery.port.ts` - `LoggingOtpDelivery.deliverCode` logs
  `[OTP-DEV-STUB] code for <email> = <code> (...)`. Its own comment: a production adapter "MUST NOT
  log the plaintext code".
- `otp-auth.provider.ts` `requestCode` already wraps `deliverCode` in try/catch, logs only
  `otp delivery failed for <email>: <message>` (no code) and still answers `{ status: "sent" }`.
  **Do not change that file.**
- `portal-auth.service.ts:262` - `this.logger.log(\`Portal password reset link generated for
  ${user.email}: ${resetUrl}\`)`; the URL carries the reset JWT.
- Re-grounded 2026-09-24: `auth.module.ts:50`, `otp-delivery.port.ts:23` and `portal-auth.service.ts:262` are unchanged. Production is read as `NODE_ENV === "production"` in `bootstrap/create-app.ts:39` and
  `personas.module.ts`. Azure App Service always sets `WEBSITE_SITE_NAME`.

## What to build

1. **`apps/api/src/config/runtime-env.ts`** (new) -
   `export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean` - true
   when `env.NODE_ENV === "production"` **or** `env.WEBSITE_SITE_NAME` is a non-empty string. A1 and
   A2 reuse it; do not move or rename it.
2. **`otp-delivery.port.ts`**
   - `export const SEC_A3_NO_CREDENTIAL_LOGS_V1 = "sec-a3";`
   - Add `DisabledOtpDelivery implements OtpDeliveryPort` - `deliverCode` throws
     `new Error("OTP email delivery is not configured in production")` and logs nothing.
   - `LoggingOtpDelivery` is unchanged (dev / CI / e2e read the code back from it).
3. **`auth.module.ts`** - bind with a factory:
   `{ provide: OTP_DELIVERY_PORT, useFactory: () => isProductionRuntime() ? new DisabledOtpDelivery() : new LoggingOtpDelivery() }`.
4. **`portal-auth.service.ts:~262`** - production logs
   `Portal password reset requested for user ${user.id}` only (no email, no URL, no token).
   Outside production keep today's line unchanged.

## Tests
- `runtime-env.spec.ts`: production by `NODE_ENV`; production by `WEBSITE_SITE_NAME` alone; neither
  -> false; empty `WEBSITE_SITE_NAME` -> false.
- `otp-delivery.port.spec.ts`: `DisabledOtpDelivery.deliverCode` rejects and never calls a logger.
- `portal-auth.service.spec.ts` (extend if it exists, else create): with production env the logged
  line contains neither the email nor `token=`; with dev env it is unchanged.

## Do NOT
- Do NOT touch `otp-auth.provider.ts`, token secrets, `auth.config.ts`, any workflow, or Azure.
- Do NOT send any email (A2 does that).

## What this changes for users (say it in the PR body)
In production, field-worker code sign-in and client-portal password reset stop producing a usable
code / link anywhere - today they only ever reached the server log. They come back as real emails
in A2, once Marco has switched production email on.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never ask a question or stand by.
- Read the CI job log before diagnosing a failure. `pnpm build` + `pnpm lint` must pass.
- Authentication change: label the PR `do-not-merge` for Marco's review.
