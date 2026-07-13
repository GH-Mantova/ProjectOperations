# Runbook — SharePoint / Graph on Managed Identity

**Scope:** production API on Azure App Service.
**Effect:** eliminates the SharePoint/Graph client secret entirely — nothing to rotate, nothing
to expire, no calendar reminder, no secret in App Service config.

**Local dev + CI keep using the client-secret path** (`SHAREPOINT_AUTH_MODE=client-secret`,
`.env.example`). Managed identity only exists inside Azure — running the API locally with
`SHAREPOINT_AUTH_MODE=managed-identity` will fail with a specific error naming the mode.

---

## Before you start

- **Who does step 1?** Marco (App Service Contributor is sufficient).
- **Who does step 2?** A **Microsoft Entra Global Administrator**. As of 2026-07-13 Marco is
  **not** a Global Admin — the tenant has one. There is **no portal UI** for granting Graph
  app roles to a managed identity; it must be done via PowerShell or the Graph REST API.
- **Who does steps 3–6?** Marco.

## Step 1 — Enable the managed identity on the App Service

1. Azure portal → resource group `projectoperations-prod` → App Service **`operations-api`**.
2. Left menu **Identity** → **System assigned** → **Status: On** → **Save**.
3. Copy the **Object (principal) ID** that appears. You will paste this into step 2.

> **User-assigned identity?** If the platform team standardises on user-assigned identities,
> create one and assign it to the App Service on the same **Identity** blade. Copy the identity's
> **Object (principal) ID** for step 2 *and* its **Client ID** — the latter goes into
> `AZURE_MANAGED_IDENTITY_CLIENT_ID` (step 3).

## Step 2 — Grant the Graph app roles (Global Admin, PowerShell)

**Verify these cmdlet names against the current Microsoft.Graph module docs before running.**
Cmdlet names shift between module versions — do not paste blind.

```powershell
Install-Module Microsoft.Graph -Scope CurrentUser
Connect-MgGraph -Scopes "AppRoleAssignment.ReadWrite.All","Application.Read.All"

$miObjectId = "<Object (principal) ID from step 1>"
$graphSp = Get-MgServicePrincipal -Filter "appId eq '00000003-0000-0000-c000-000000000000'"

foreach ($role in @("Sites.ReadWrite.All","Mail.Send")) {
  $appRole = $graphSp.AppRoles | Where-Object {
    $_.Value -eq $role -and $_.AllowedMemberTypes -contains "Application"
  }
  New-MgServicePrincipalAppRoleAssignment `
    -ServicePrincipalId $miObjectId `
    -PrincipalId $miObjectId `
    -ResourceId $graphSp.Id `
    -AppRoleId $appRole.Id
}
```

`00000003-0000-0000-c000-000000000000` is Microsoft Graph's fixed application ID.

## Step 3 — Configure App Service

1. Azure portal → App Service **`operations-api`** → **Configuration**.
2. Set `SHAREPOINT_AUTH_MODE=managed-identity`.
3. If you used a user-assigned identity in step 1, set `AZURE_MANAGED_IDENTITY_CLIENT_ID` to
   the identity's **Client ID**. Leave it unset for system-assigned.
4. **Do not remove `AZURE_CLIENT_SECRET` yet** — verify in step 5 first.

## Step 4 — Restart the App Service

`Configuration → Overview → Restart`. Watch the startup logs for the line:

```
SharePoint Graph auth: managed-identity (system-assigned)
```

(or `... (user-assigned clientId=...)`). This line is emitted once per process — its absence
means the credential resolver did not fire; the credential is not built until the first Graph
call.

## Step 5 — Verify BEFORE deleting anything

Run all of the following against production:

- SharePoint health check reports **connected / live**.
- Upload a document to a test tender folder. **Open** the uploaded document — an upload that
  succeeds but will not open is the signature of a missing `webUrl` (a symptom of a partial
  Graph response). Do not skip this check.
- Send an access-request email from the app; confirm it arrives.

## Step 6 — Only now: delete the client secret

1. Azure portal → Microsoft Entra ID → App registrations → `projectops-erp-sso` (or whichever
   registration currently holds the SharePoint / Mail.Send secret) → **Certificates & secrets**
   → delete the secret.
2. App Service Configuration → remove `AZURE_CLIENT_SECRET` (and any legacy
   `SHAREPOINT_CLIENT_SECRET`).
3. Cancel any calendar reminder tracking the secret expiry.

Local `.env` files and CI variables that still set `SHAREPOINT_AUTH_MODE=client-secret`
(explicitly or by omission) are unaffected — they keep working with a dev-scoped secret.

---

## Failure modes

- **Startup log says `client-secret` after step 4.** `SHAREPOINT_AUTH_MODE` did not stick — check
  App Service Configuration for a typo, and restart again.
- **`ServiceUnavailableException: SHAREPOINT_AUTH_MODE=managed-identity but no managed identity is
  available`.** The Identity blade shows Status: Off, or the App Service was cloned from a slot
  that did not inherit the identity. Repeat step 1.
- **`Insufficient privileges to complete the operation` from Graph after step 4.** The app-role
  assignment in step 2 did not include the role Graph is complaining about, or it was assigned
  to the wrong principal. Re-run step 2, confirming `$miObjectId` is the App Service identity's
  Object ID (not the app registration's).
- **Upload succeeds, document will not open.** As in step 5 — this is not a managed-identity
  issue; it is a `webUrl` issue in the Graph response and the file was already broken. Investigate
  separately.
