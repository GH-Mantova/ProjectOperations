# SSO / Microsoft Entra Setup — ProjectOperations

How Microsoft 365 single sign-on is wired for the ERP, and how to add users. Set up 2026-06-15.

## How auth works here
- **Web (React SPA):** MSAL signs the user in (`loginPopup`, scopes `openid profile email User.Read`) and uses the returned **ID token**. `redirectUri = window.location.origin`.
- **API (NestJS):** validates that ID token — issuer `https://login.microsoftonline.com/{tenant}/v2.0`, audience = `ENTRA_CLIENT_ID`.
- Both sides use the **same app registration / client ID**. The API consumes the ID token directly, so there is **one** app registration (no exposed API scope, no second app).

## The app registration
- **Name:** `projectops-erp-sso` (Microsoft Entra admin center → App registrations).
- **Account types:** single tenant — *Accounts in this organizational directory only (INITIAL SERVICES)*. This alone restricts sign-in to `@initialservices.net` accounts.
- **Platform:** Single-page application (SPA), with redirect URIs:
  - `https://<prod-web-origin>` — production Static Web App origin, **no trailing slash** (MSAL sends the bare origin; a trailing-slash-only entry causes `AADSTS50011`).
  - `https://<prod-web-origin>/` — kept as belt-and-braces.
  - `http://localhost:5173` — local dev.
  - Confirm the exact prod origin in Azure Portal → Static Web App → Overview → URL.
- **API permissions:** Microsoft Graph → `User.Read` (Delegated) + **admin consent granted** for Initial Services.
- **Token configuration:** optional ID-token claims **`email`** and **`upn`** added (the API matches users by email).
- Do **not** enable implicit/hybrid flows — SPA uses auth-code + PKCE.

## Where the IDs are wired (3 places, same two GUIDs)
From the app's Overview: **Application (client) ID** and **Directory (tenant) ID**.

1. **GitHub repo secrets** (baked into the web bundle by the deploy):
   - `PROD_ENTRA_CLIENT_ID` = Application (client) ID
   - `PROD_ENTRA_TENANT_ID` = Directory (tenant) ID
   - `gh secret set <NAME>` from the repo dir.
2. **Production API** (Azure Portal → App Service `operations-api` → Settings → Environment variables):
   - `ENTRA_CLIENT_ID`, `ENTRA_TENANT_ID`, and `SSO_ENABLED = true`. (Issuer/JWKS auto-derive from the tenant.)
3. **Web build vars** `VITE_SSO_ENABLED` / `VITE_ENTRA_CLIENT_ID` / `VITE_ENTRA_TENANT_ID` are injected from the GitHub secrets during `build:azure` (deploy.yml, enabled by PR #384).

## Enterprise application — assignment
Registering the app auto-creates an Enterprise application of the same name. Entra → Enterprise applications → `projectops-erp-sso` → Properties → **Assignment required?**
- **No:** any tenant account can authenticate; ProjectOps still gates access by user record.
- **Yes:** users must also be assigned (Users and groups → Add) — tighter. If Yes, assigning a new person is an extra step.

## Who can actually log in
A person needs **both**:
1. An Initial Services Microsoft account (single-tenant app), **and**
2. A **user record in ProjectOps** (Admin → User Access) whose email matches their Microsoft UPN.
3. (If assignment required = Yes) also assigned to the Enterprise app.

An IS email alone is **not** enough — no user record means they authenticate with Microsoft but the app bounces them. Pilot is provisioned for Marco, Sean, Raj (pr-173).

## Login experience
User opens the app → **Sign in with Microsoft** → if already signed into their IS Microsoft account in that browser, usually a one-click account pick (no password) → app matches their email to their record and routes them to their role's pages. No separate ProjectOps password. (Optional enhancement pr-203 adds silent auto-login so already-signed-in staff skip even that click.)

## Adding a new user later
Not an Entra change (they're already in the tenant):
1. Admin → User Access → create their user record, set role, email = their Microsoft UPN.
2. If assignment required = Yes: also assign them in Entra → Enterprise applications → `projectops-erp-sso` → Users and groups.
No code, no redeploy.

## Troubleshooting
- **`AADSTS50011` redirect mismatch:** the registered SPA redirect URI doesn't exactly match `window.location.origin` (usually a trailing-slash issue). Fix the URI.
- **Authenticates with Microsoft but ProjectOps denies access:** the ID-token email doesn't match a user record. Check the record's email vs their actual UPN (watch shared mailboxes like `estimating@`).
- **SSO not appearing at all:** confirm `SSO_ENABLED=true` (API) and `VITE_SSO_ENABLED=true` baked into the deployed web bundle.

## Azure Static Web Apps + PWA gotchas (learned at go-live)

Captured 2026-06-16 after the SSO production cut-over. Each item below cost a deploy cycle to diagnose; keep them in this order — they form a dependency chain.

1. **Use `loginRedirect`, not `loginPopup`.** On Static Web Apps, the popup → opener handoff is severed (cross-origin / PWA service worker scope) and `loginPopup` hangs until it times out. Switch to `loginRedirect` + `handleRedirectPromise()`. (PR #397.)
2. **Do not call `ssoSilent`.** Its hidden sandboxed iframe attempts a top-level navigation back to the app origin and is blocked with `frame is sandboxed … allow-top-navigation not set`, which kills the sign-in flow. Interactive redirect only — no silent iframe path. (PR #398.)
3. **Await `handleRedirectPromise()` before the router renders.** If the router mounts first, the protected route immediately redirects to `/login` and strips the auth response off the URL before MSAL processes it — the user lands silently back on `/login` with no error. Gate app render on the promise resolving. (PR #406.)
4. **Set `staticwebapp.config.json` `navigationFallback` → `/index.html`.** Without an explicit fallback, a hard GET or browser refresh of any deep route (including `/login` and the SSO redirect landing) returns Azure's default 404 page instead of the SPA. SWA's implicit SPA fallback was unreliable across action versions — make it explicit. (PR #409.)
5. **MSAL config that works on SWA + PWA:**
   - `navigateToLoginRequestUrl: false` — we control post-login routing.
   - `cacheLocation: "localStorage"` — survives the service-worker-controlled reload.
   - `storeAuthStateInCookie: true` — covers Safari/WebKit ITP and PWA storage partitioning.
   - `redirectUri: window.location.origin` — must match a registered SPA redirect URI exactly (see `AADSTS50011` note above).
6. **Pin `Azure/static-web-apps-deploy` to a SHA.** The floating `@v1` tag shipped a release that broke deploys with `Build container for action … Docker build failed`, and the same floating tag silently changed SPA-fallback defaulting. Pin Docker-based actions to a known-good SHA and bump deliberately. (PR #407.)
7. **Deploy model is full-`main` per merge.** Every merge to `main` triggers a deploy of the entire current `main` (health-gated). A fix that is merged but doesn't deploy (gate failure, action break) will go live on the next successful deploy — there is no per-PR deploy slice.

Referenced PRs: #397 (redirect + PWA-safe), #398 (remove silent iframe), #406 (await before router), #407 (pin deploy action), #409 (navigationFallback).
