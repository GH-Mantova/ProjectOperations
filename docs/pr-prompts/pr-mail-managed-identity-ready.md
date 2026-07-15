---
premise: '! grep -rq "MAIL_AUTH_MODE" apps/api/src'
premise_means: The Outlook mail provider has no MAIL_AUTH_MODE switch yet; it can only authenticate with a client secret.
scope:
  - apps/api/src/modules/email/providers/outlook.provider.ts
  - apps/api/src/modules/email/providers/outlook.provider.spec.ts
  - .env.example
done_when: pnpm build && pnpm lint && grep -rq "MAIL_AUTH_MODE" apps/api/src
size: 3
gate_allow: env-vars
seed_only: false
escalates: true
---

# Outlook mail: add MAIL_AUTH_MODE managed-identity switch (mirror the SharePoint #547 pattern)

**Marco decided this on 2026-07-15:** *"BUILD THE CODE PR NOW, hold ops. Build the MAIL_AUTH_MODE
switch + managed-identity credential path (mirror #547). escalates:true — open the PR but DO NOT
auto-merge; Marco reviews. The code is safe: default behaviour is unchanged until MAIL_AUTH_MODE is
set."*

## Background — the pattern already exists on main

`apps/api/src/modules/platform/graph-sharepoint.adapter.ts` already implements exactly this
switch for SharePoint (shipped in #547). Study it and mirror it for mail:

- `resolveSharePointAuthMode(config)` → returns `"managed-identity" | "client-secret"`, reading
  `SHAREPOINT_AUTH_MODE`, defaulting to `client-secret` when unset/empty, and throwing a
  `ServiceUnavailableException` on any other value.
- `buildSharePointCredential(mode, config, logOnce)` → returns a `TokenCredential`. The
  `managed-identity` branch uses `ManagedIdentityCredential` (user-assigned when
  `AZURE_MANAGED_IDENTITY_CLIENT_ID` is set, else system-assigned) and wraps `getToken` so a
  `CredentialUnavailableError` (no IMDS in local/CI) surfaces an honest error that NAMES the mode.
  The `client-secret` branch builds `ClientSecretCredential`.

The Outlook provider currently hardcodes `ClientSecretCredential` in
`OutlookEmailProvider.getClient()`.

## What to build

1. In `apps/api/src/modules/email/providers/outlook.provider.ts`:
   - Add an exported `resolveMailAuthMode(config)` returning `"managed-identity" | "client-secret"`,
     reading `MAIL_AUTH_MODE`, defaulting to `client-secret` when unset/empty, throwing
     `ServiceUnavailableException` on any other value — mirror `resolveSharePointAuthMode` exactly.
   - Add an exported `buildMailCredential(mode, config, logOnce)` returning a `TokenCredential`,
     mirroring `buildSharePointCredential`: `managed-identity` branch uses `ManagedIdentityCredential`
     (user-assigned via `AZURE_MANAGED_IDENTITY_CLIENT_ID`, else system-assigned) with the same
     `CredentialUnavailableError` → honest ServiceUnavailableException wrapper that names
     `MAIL_AUTH_MODE=managed-identity`; `client-secret` branch keeps the existing
     `ClientSecretCredential` path (tenantId/clientId/clientSecret resolved exactly as today, incl.
     the AZURE_MAIL_* → SHAREPOINT_* fallback). In client-secret mode a missing tenant/client/secret
     must still throw the existing clear message.
   - Rewire `getClient()` to select the credential via these two functions instead of building
     `ClientSecretCredential` inline. Behaviour when `MAIL_AUTH_MODE` is unset MUST be byte-for-byte
     the current behaviour (client-secret).
2. Add unit tests in `outlook.provider.spec.ts` exercising BOTH branches without a live Graph
   client (mirror `graph-sharepoint.adapter.spec.ts`): client-secret default, explicit
   managed-identity (system + user-assigned), invalid value throws, and managed-identity
   CredentialUnavailableError → ServiceUnavailableException naming the mode.
3. In `.env.example`, add `MAIL_AUTH_MODE=client-secret` with a one-line comment mirroring the
   SHAREPOINT_AUTH_MODE entry.

## Do NOT

- Do NOT touch Azure, Entra, App Service config, or any secret. This is a CODE PR only.
- Do NOT deploy, do NOT trigger a real send, do NOT delete any app-registration secret. Those ops
  are Marco-supervised and are explicitly NOT part of this PR (LL-36: never delete a live secret and
  test it in the same breath).
- Do NOT change the default behaviour: with `MAIL_AUTH_MODE` unset, mail must still use
  client-secret exactly as it does today.
- Do NOT auto-merge. escalates:true — open the PR and LEAVE IT UNMERGED for Marco to review.

## ⛔ STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED. It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if the work is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval — there is no human in a headless run.
- `pnpm build` + `pnpm lint` must pass before you open the PR.
- Read the CI job log before diagnosing any CI failure; never reason it out of the diff.
- Completion test: is there a PR number in your output? If not because you are waiting for someone —
  WRONG, there is nobody, open the PR.
