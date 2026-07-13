# Runbook — Rotate the SharePoint / Graph client secret

> **Scope after `feat/graph-managed-identity`:** this runbook applies to **local development
> environments and CI only**. Production runs on managed identity
> (`SHAREPOINT_AUTH_MODE=managed-identity`) and has no client secret to rotate — see
> [`graph-managed-identity.md`](./graph-managed-identity.md).
>
> **If you are here to fix a prod outage where SharePoint / access-request emails died while
> login still works:** first confirm production is actually on managed identity
> (check the App Service startup log for `SharePoint Graph auth: managed-identity ...`).
> If it is, the client secret is not the problem — investigate the Graph app-role assignment
> on the managed identity instead. If it is not, this runbook does apply — proceed below and
> also schedule cutover to managed identity so this failure mode stops recurring.

---

## Why the failure is easy to misdiagnose

An expired client secret takes down SharePoint uploads and access-request emails **silently**
while user login keeps working. The login path uses a separate Entra flow that does not touch
the Graph token. First reports typically look like "SharePoint is down" rather than "the secret
expired 24 months to the day after the last rotation."

## When rotation is needed

- Local dev / CI environments where the `.env` still uses `SHAREPOINT_AUTH_MODE=client-secret`.
- Any prod environment that has not yet cut over to managed identity.
- A team member's `.env` where the secret expired (Entra client secrets max out at 24 months).

## Steps (local / dev / CI)

1. Azure portal → Microsoft Entra ID → **App registrations** → open the app registration used
   for SharePoint access (`projectops-erp-sso` at time of writing).
2. **Certificates & secrets** → **+ New client secret** → give it a name that includes the
   expiry month and target environment (e.g. `dev-2028-07`) → set the longest supported expiry.
3. Copy the secret **value** immediately (Azure will not show it again).
4. Paste into the target environment:
   - Local: `.env` → `AZURE_CLIENT_SECRET` (or legacy `SHAREPOINT_CLIENT_SECRET`).
   - CI: repository / org secret used by the workflow.
5. Restart the API. Watch startup logs for:

   ```
   SharePoint Graph auth: client-secret (clientId=...)
   ```

6. Smoke-test: upload a document; confirm it opens; send a test access-request email.
7. In the Entra app registration, delete the previous secret once the new one is verified.
8. Update the calendar reminder for the next rotation window.

## Long-term fix

Cut the environment over to managed identity following
[`graph-managed-identity.md`](./graph-managed-identity.md). Managed identity has no secret to
expire and no rotation runbook — this document then applies to that environment no longer.
