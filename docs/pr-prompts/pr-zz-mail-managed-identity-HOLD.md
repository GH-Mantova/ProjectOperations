---
premise: '! grep -rq "MAIL_AUTH_MODE" apps/api/src .env.example'
premise_means: The Outlook mail provider still has no MAIL_AUTH_MODE switch; it can only use ClientSecretCredential.
scope:
  - apps/api/src/modules/email/**
  - apps/api/src/modules/admin/**
  - .env.example
done_when: pnpm build && pnpm lint && grep -rq "MAIL_AUTH_MODE" apps/api/src && grep -q "MAIL_AUTH_MODE" .env.example
size: 7
gate_allow: env-vars
seed_only: false
escalates: true
---
# pr-zz - Outlook email: managed-identity auth (mirror #547) + fail loudly when unconfigured

Branch: `feat/mail-managed-identity`. New PR. API only.

## The finding (verified on origin/main, 2026-07-13)

`apps/api/src/modules/email/providers/outlook.provider.ts` builds its credential with:

    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

and resolves those creds via `resolveMailCreds(process.env)`, which reads ONLY:

    tenantId:     AZURE_MAIL_TENANT_ID     ?? SHAREPOINT_TENANT_ID
    clientId:     AZURE_MAIL_CLIENT_ID     ?? SHAREPOINT_CLIENT_ID
    clientSecret: AZURE_MAIL_CLIENT_SECRET ?? SHAREPOINT_CLIENT_SECRET

**Marco confirmed NONE of those six env vars have ever existed in the production App Service.**
It reads neither `AZURE_CLIENT_ID` nor `AZURE_CLIENT_SECRET` (the SharePoint ones).

Therefore `clientSecret` is always `null` in prod and `getClient()` throws
`ServiceUnavailableException` every time. **Outlook email has NEVER worked in production.**
Access-request and notification emails have been failing silently since the feature shipped.

This is NOT a regression from deleting the Azure client secret today. It predates it. Do not
"restore" a secret to fix this - that is the wrong fix.

## What to build

### 1. `MAIL_AUTH_MODE` - mirror #547 exactly

PR #547 already did this for SharePoint in
`apps/api/src/modules/platform/graph-sharepoint.adapter.ts`. **Read it first and copy its shape.**
Do not invent a second pattern.

- `MAIL_AUTH_MODE` = `managed-identity` | `client-secret`.
- Default `client-secret` so local dev and CI are unaffected (there is no MI on a laptop).
- `managed-identity` -> `new ManagedIdentityCredential()` (system-assigned), or
  `new ManagedIdentityCredential({ clientId })` when `AZURE_MANAGED_IDENTITY_CLIENT_ID` is set.
- Explicit selection. Do NOT use `DefaultAzureCredential` - no silent fallback chains.
- Log the resolved mode once at startup, same as #547.
- **Production will run `managed-identity`.** The App Service system-assigned identity
  (object principal id `6bd36633-dad6-4460-8fa2-a279f85cb8df`) was granted the `Mail.Send`
  Graph app role on 2026-07-13 and is currently unused. No secret is needed and none should be added.

### 2. Fail LOUDLY when unconfigured - this is the actual bug

The reason nobody noticed is that a `ServiceUnavailableException` deep in a provider gets
swallowed on the notification path. Per the failure-honesty rule in `sot/01` SECTION 6:

- The email provider must surface a health/config state that names the problem: which mode is
  active, which specific env var is missing, and that mail is NOT being delivered.
- `GET /api/v1/admin/settings/email/test` must return a clear, specific diagnosis - not a
  generic 500 and not a success.
- A send failure must NEVER be swallowed by the caller. If an access-request email cannot be
  sent, the AccessRequest record must still be created AND the failure must be visible to an
  admin. A silently-dropped access request is a user locked out with nobody knowing.

### 3. Do NOT

- Do NOT add `AZURE_MAIL_CLIENT_SECRET` or any new secret. The MI is the answer.
- Do NOT remove the `client-secret` path - local dev and CI need it.
- Do NOT touch the SharePoint adapter. It works; it is live in prod.
- Do NOT touch `sot/`.

## Test plan

- [ ] Unit: mode defaults to `client-secret` when `MAIL_AUTH_MODE` unset (no regression).
- [ ] Unit: `managed-identity` returns a `ManagedIdentityCredential`; user-assigned honoured when
      `AZURE_MANAGED_IDENTITY_CLIENT_ID` set.
- [ ] Unit: `managed-identity` with no IMDS (local/CI) throws an error that NAMES the mode and
      tells the operator to use `client-secret` - not a generic Graph failure.
- [ ] Unit: `client-secret` mode with missing creds produces a message naming the EXACT missing
      env var, not "requires A, B and C".
- [ ] Unit: an access-request email failure still persists the AccessRequest and surfaces the error.
- [ ] Marco post-deploy: set `MAIL_AUTH_MODE=managed-identity`, restart, hit
      `/api/v1/admin/settings/email/test`, confirm a real email ARRIVES. **This is the only proof
      that counts** - the feature has never once worked in prod.

## Gates

`pnpm --filter @project-ops/api build lint test:serial`, `pnpm build`, `pnpm compliance:smoke`.

## GATE-ALLOW note

Adds `MAIL_AUTH_MODE` to `.env.example` -> the PR body MUST carry a column-0 line:

    GATE-ALLOW: env-vars

A body edit alone does NOT retrigger CI; push a commit.

## Do NOT auto-merge

Changes production auth for an external system. Marco reviews, deploys, and verifies the email
actually arrives.

---

## NIGHT-RUN GUARDRAILS (2026-07-13 - these override anything above that conflicts)

Marco is asleep. Nobody will rescue you. A clean, honest failure is worth far more than a messy
half-fix, and infinitely more than a silent no-op.

1. ONE ATTEMPT. Do the task once. If it does not work, STOP. Do not retry, do not loop.
2. NEVER EXIT SILENTLY. If you finish without pushing a commit or opening a PR, say so plainly:
   `NO-OP: <one-line reason>`. An honest no-op is a success; a silent one is the worst outcome.
3. TIME BOX: abort any step that runs past 20 minutes with no progress.
4. Conflicts you cannot resolve: stop and report. No force-push. No branch reset.
5. NEVER commit to `main`. NEVER touch `sot/`.
6. DO NOT MERGE. Marco merges this one.
7. DO NOT create, rename, or re-arm any prompt file in docs/pr-prompts/.
8. CI failures: read the job log before diagnosing. Never guess from the diff.
