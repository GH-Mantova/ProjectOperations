---
premise: '! grep -rq "EmailConnectionDiagnosis" apps/api/src'
premise_means: The email connection test still returns only { success, message } with no structured diagnosis (no EmailConnectionDiagnosis type exists yet).
scope:
  - apps/api/src/modules/email/**
  - apps/api/src/modules/admin-settings/**
done_when: pnpm build && pnpm lint && grep -rq "EmailConnectionDiagnosis" apps/api/src
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# Richer diagnosis for the admin email-connection test

Follow-up to #602 (mail managed-identity). #602 made mail credential resolution *fail honestly*
(naming the exact missing env var and the resolved MAIL_AUTH_MODE), but the admin email-test
endpoint still surfaces only a flat `{ success, message }`. When an admin clicks "Test" and it
fails, they get a bare error string and cannot tell WHY. Mail has never worked in prod, so this
test is the primary diagnostic — it must explain itself.

## What to build (API only)

1. Add an exported `EmailConnectionDiagnosis` type in `apps/api/src/modules/email` with, at
   minimum: `authMode` (the resolved `MAIL_AUTH_MODE`, e.g. `managed-identity` | `client-secret`),
   `provider` (`outlook` | `gmail`), `senderAddress` (the address the provider would send from, or
   null if unresolved), `credentialResolved` (boolean — could the credential actually be built),
   and `detail` (a human-readable, secret-free explanation).
2. Enrich `EmailService.verifyConnection()` to return
   `{ success: boolean; message: string; diagnosis: EmailConnectionDiagnosis }`. On failure,
   populate `diagnosis` with the resolved mode, which config/env was missing (name the exact
   variable, mirroring #602's failure-honesty), the sender that would be used, and whether the
   managed-identity / client-secret credential could be constructed. NEVER include a secret value —
   only names and booleans.
3. Surface the diagnosis through `AdminSettingsService.testEmailConnection()` and its controller
   route so the admin UI receives the structured object, not just a string.
4. Update / extend the unit spec(s) covering `verifyConnection()` and `testEmailConnection()` to
   assert the new diagnosis shape for both a success and a failure path.

## Do NOT

- Do NOT change auth behaviour or the credential-resolution logic itself — that shipped in #602.
  This PR only ADDS diagnostic reporting on top of it.
- Do NOT touch Azure / Entra / SharePoint, secrets, App Service config, `az`, or any Graph write.
- Do NOT add a migration or edit `apps/api/prisma/schema.prisma`.
- Do NOT expose any secret value in the diagnosis (names and booleans only).
- Do NOT change the web/front-end in this PR (API + its specs only).

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED. It does not mean "wait for approval
before starting", and it does not mean "do the work then ask permission to push". There is no human
in this run. Finishing the work and then asking for permission is indistinguishable from failing —
the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if you produce no PR, say `NO-OP: <reason>` loudly.
- Never ask a question or "stand by" for approval — there is no human in a headless run.
- Read the CI job log before diagnosing any CI failure; do not reason a failure out of the diff.
- `pnpm build` + `pnpm lint` must pass before you open the PR.
- The completion test: is there a PR number in your output? If not and the work is done, that is a
  failure — open the PR.
