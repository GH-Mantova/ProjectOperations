---
premise: '! grep -rqi "otp" apps/api/src/modules/auth'
premise_means: No OTP / personal-email auth path exists in the auth module yet.
scope:
  - apps/api/src/modules/auth/**
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -rqi "otp" apps/api/src/modules/auth
size: 10
gate_allow: migrations
seed_only: false
escalates: true
---

# FIELD worker auth track — personal-email / OTP (alongside OFFICE / Entra)

Marco's decision (BACKLOG-DECISIONS.md #6): IN SCOPE this quarter. FIELD workers authenticate via
personal email + one-time code; OFFICE staff keep Entra. The `kind` discriminator already exists on
`AccessRequest` (baked in by #538) — reuse it, do not re-invent user classification.

## What to build

1. **OTP auth provider** mirroring the existing `local-auth.provider.ts` pattern: a `request-otp`
   endpoint (issue a short-lived, HASHED code bound to a FIELD-kind personal email) and a `verify-otp`
   endpoint (on a valid, unexpired, unused code, issue the same JWT the other providers issue). Wire
   into `auth.controller.ts` / `auth.service.ts` / `auth.module.ts` with a `dto/otp-login.dto.ts`.
2. **Storage**: a new Prisma model for the OTP challenge (hashed code, email, expiresAt, attempts,
   consumedAt). Add the migration.
3. **Delivery is a PLUGGABLE PORT** (`OtpDeliveryPort` interface). Provide a dev/CI implementation that
   LOGS the code. **Do NOT wire production email, Microsoft Graph, or any Azure/Entra call** — prod mail
   is Marco-supervised and currently unverified; the real delivery adapter is a separate, later step.
4. Rate-limit / throttle `request-otp` (reuse `auth-throttle.config.ts`).
5. **Regenerate the data-model map**: run `node scripts/data-model/build-relationship-map.mjs` and
   commit `docs/data-model/relationship-map.json` + `.md` + `metadata-catalog.json`.

## PR body MUST include
- `GATE-ALLOW: migrations` as a bare line at column 0 (CP-11).

## Do NOT
- Do NOT wire production email / Microsoft Graph / Azure / Entra delivery. Delivery stays a mock/log
  port in this PR. (Real delivery depends on the Marco-supervised, currently-unverified mail path.)
- Do NOT change the OFFICE / Entra login path.
- Do NOT store OTP codes in plaintext — hash them, enforce expiry + attempt limits.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

This PR is `escalates: true` (auth surface): open it and LEAVE IT UNMERGED for Marco's review.

## Guardrails
- One attempt. Never exit silently -- if an OTP path already exists, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` + the data-model drift check must pass.
