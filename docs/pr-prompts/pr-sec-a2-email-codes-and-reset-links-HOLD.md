---
premise: '! grep -q "EmailOtpDelivery" apps/api/src/modules/auth/otp-delivery.port.ts'
premise_means: Field-worker sign-in codes and client-portal reset links have no delivery channel in production, so neither sign-in path can be used there.
scope:
  - apps/api/src/modules/auth/otp-delivery.port.ts
  - apps/api/src/modules/auth/otp-delivery.port.spec.ts
  - apps/api/src/modules/auth/auth.module.ts
  - apps/api/src/modules/portal/portal-auth.service.ts
  - apps/api/src/modules/portal/portal-auth.service.spec.ts
  - apps/api/src/modules/portal/portal.module.ts
done_when: pnpm build && pnpm lint && grep -q "SEC_A2_EMAIL_DELIVERY_V1" apps/api/src/modules/auth/otp-delivery.port.ts
size: 3
gate_allow: none
seed_only: false
escalates: true
module: auth
cluster: sec-auth
cluster_order: 3
requires_on_main: apps/api/src/modules/auth/otp-delivery.port.ts :: SEC_A3_NO_CREDENTIAL_LOGS_V1
---

<!-- watcher: do-not-arm | MARCO GATE: arm only after Marco has switched production email on (API App Service: MAIL_AUTH_MODE=managed-identity and AZURE_MAIL_SENDER_USER_ID set) and the ERP's email Test connection passes. Only Marco removes this line. -->

# Security A2: email the sign-in code and the portal reset link

**Requested by Marco 2026-09-21**; re-verified on main `ff46a3b3` (2026-09-24, Wave 1). Third of
three (A3 logs -> A1 secrets -> **A2 this**). **Ordering rule, 2026-09-24 handover: A2 gates nothing
outside itself** - the later `authsession` (F02) cluster depends on A1 only and must not wait for
this slice or for its production-email prerequisite. **Code only**: it sends through the ERP's existing `EmailService` and adds
no Azure setting, Graph permission or mail library. Held by Marco's gate above because, per
`sot/05` (2026-07-13), production email has never been switched on.

## Grounded on origin/main ff46a3b3 - re-verify before you edit

- `email/email.module.ts` exports `EmailService`. `EmailService.resolveProvider()` returns an
  `EmailProvider` with `sendMail({ to, cc?, subject, html, text, attachments? })`.
  Precedent for a system email: `access-requests.service.ts:~270-295` (build `html` with
  `escapeHtml`, build `text`, `resolveProvider()`, `sendMail`).
- After A3: `auth.module.ts` binds `DisabledOtpDelivery` in production, `LoggingOtpDelivery`
  elsewhere, via `isProductionRuntime()` (`config/runtime-env.ts`).
- `otp-auth.provider.ts` catches any `deliverCode` error, logs `otp delivery failed for <email>:
  <message>` (no code) and still answers "sent". **Do not change that file.**
- `portal-auth.service.ts` `requestPasswordReset` builds `resetUrl` (with token) and, after A3,
  logs only the user id in production. `RESET_TTL_MS` is the link lifetime.

## What to build

1. **`otp-delivery.port.ts`** - `export const SEC_A2_EMAIL_DELIVERY_V1 = "sec-a2";` and
   `EmailOtpDelivery implements OtpDeliveryPort` (injects `EmailService`). `deliverCode` sends:
   - Subject: `Your Project Ops sign-in code`
   - Text: `Your sign-in code is <code>. It expires at <h:mm am/pm> (Brisbane time). If you didn't
     ask for this code, ignore this email.` HTML is the same, with the code in bold.
   - It never logs the code. Send errors propagate (the provider already catches and logs them).
   - `DisabledOtpDelivery` stays in the file, unused, for the next person who needs to switch
     delivery off.
2. **`auth.module.ts`** - import `EmailModule`; bind `EmailOtpDelivery` in production,
   `LoggingOtpDelivery` elsewhere.
3. **`portal-auth.service.ts` + `portal.module.ts`** - inject `EmailService` (import `EmailModule`).
   In production, after building `resetUrl`, send:
   - Subject: `Reset your client portal password`
   - Text: `We received a request to reset the password for this client portal account. Open this
     link to choose a new password: <resetUrl>. The link expires in 60 minutes. If you didn't ask
     for this, ignore this email - your password has not changed.`
   - Wrap the send in try/catch; on failure log `Portal reset email failed for user <user.id>:
     <message>` (no email, no URL). The HTTP response stays the same generic answer either way.
   - Outside production keep A3's behaviour (log the full line, send nothing).
   - Escape every interpolated value in the HTML with the same `escapeHtml` pattern as the precedent.

## Tests
- `otp-delivery.port.spec.ts`: `EmailOtpDelivery` calls `sendMail` once with the code in `text`, and
  no logger call contains the code.
- `portal-auth.service.spec.ts`: in production the reset request calls `sendMail` with the URL in
  the body, a send failure still returns the generic response, and no log line contains the URL or
  the email.

## Do NOT
- Do NOT touch Azure, App Service settings, Entra, Graph permissions, or add mail libraries.
- Do NOT change `otp-auth.provider.ts`, token secrets, TTLs, or the generic responses.

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
