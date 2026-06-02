# Pre-deploy checklist — Tendering Azure launch

Operational checklist to run before flipping the Tendering module to Azure for
Sean (visual / quote sign-off) and Raj (workflow walkthrough). Work top-to-bottom.
Do not skip a category. If a box can't be ticked, stop and resolve before deploy.

> Companion docs: [`onboarding-sean-raj.md`](./onboarding-sean-raj.md) and
> [`tendering-smoke-test-plan.md`](./tendering-smoke-test-plan.md).

> Dependencies: this checklist assumes **PR-50 (migration drift fix)** and
> **PR-51 (Azure Mail.Send)** are merged into `main`. If either is still open,
> stop and merge them first.

---

## 1. Code state

- [ ] `main` is green on CI — latest `ci.yml` run passes lint, build, API serial
      tests, web logic tests
- [ ] No open PRs blocking the launch (anything tagged `blocks-launch` or
      `tendering-deploy` is merged or explicitly deferred)
- [ ] No stale or unapplied migrations — `prisma/migrations/` matches what's been
      applied to the target DB (verify PR-50 migration-drift fix is on `main`)
- [ ] Pre-launch tag cut: `git tag pre-tendering-launch-<YYYYMMDD>` and pushed
      to origin (used for rollback — see section 8)
- [ ] `pnpm build` and `pnpm lint` pass locally against `main`

## 2. Azure App Service — API environment variables

Set in **App Service → Configuration → Application settings**. After saving,
restart the App Service so values take effect.

### Core

- [ ] `DATABASE_URL` — points at the Azure Postgres flexible server, includes
      `?sslmode=require`
- [ ] `JWT_ACCESS_SECRET` — 32-byte random (`openssl rand -base64 32`)
- [ ] `JWT_REFRESH_SECRET` — 32-byte random, **different from access secret**
- [ ] `BYOK_ENCRYPTION_KEY` — 64-hex-character key
      (`openssl rand -hex 32`). `KeyEncryptionService` throws on App Service
      startup if this is unset, so the API won't boot without it.
- [ ] `NODE_ENV=production`
- [ ] `API_PORT=8080` — the API reads `process.env.API_PORT` (not `PORT`)
      in `apps/api/src/config/app.config.ts`. Azure App Service injects
      `PORT` automatically; **the app does not consume it**, so leaving only
      `PORT` would leave the API listening on the default `3000` while the
      platform expects `8080`. Set `API_PORT=8080` explicitly.

### CORS

- [ ] `CORS_ORIGIN` — set to the Static Web Apps URL of the web app
      (no trailing slash)

### SharePoint (live mode)

- [ ] `SHAREPOINT_MODE=live`
- [ ] `SHAREPOINT_TENANT_ID` — `<placeholder — Marco to fill>`
- [ ] `SHAREPOINT_CLIENT_ID` — `<placeholder — Marco to fill>`
- [ ] `SHAREPOINT_CLIENT_SECRET` — `<placeholder — Marco to fill>`
      (stored as App Service setting, **not** committed)

### M365 SSO

- [ ] `SSO_ENABLED=true`
- [ ] `ENTRA_TENANT_ID` — `<placeholder — Marco to fill>`
- [ ] `ENTRA_CLIENT_ID` — `<placeholder — Marco to fill>`

### Mail (per PR-51)

- [ ] `MAIL_PROVIDER=azure`
- [ ] `AZURE_MAIL_TENANT_ID` — `<placeholder — Marco to fill>`
- [ ] `AZURE_MAIL_CLIENT_ID` — `<placeholder — Marco to fill>`
- [ ] `AZURE_MAIL_CLIENT_SECRET` — `<placeholder — Marco to fill>`
- [ ] `AZURE_MAIL_FROM` — the sender mailbox (e.g. `noreply@initialservices.net`)

## 3. Web build-time environment variables (deploy.yml, not Static Web Apps portal)

**Important:** Vite bakes `VITE_*` environment variables into the JS bundle at
**build time**, not at runtime. `apps/web/src/auth/msal.config.ts` reads
`import.meta.env.VITE_SSO_ENABLED` / `VITE_ENTRA_CLIENT_ID` /
`VITE_ENTRA_TENANT_ID` at build time and disables SSO entirely if any are
missing. Putting these in the Static Web Apps portal `Application settings`
does **NOT** make them available to the bundle — the portal only injects them
into the (separate) Azure Functions runtime, which the SPA never sees.

The build runs in `.github/workflows/deploy.yml` via `pnpm build:azure`, so
these must be set in the workflow's `env:` block (or sourced from repo
secrets) so they're present when Vite compiles. Example workflow snippet:

```yaml
- name: Build web app
  working-directory: apps/web
  env:
    VITE_API_BASE_URL: ${{ secrets.PROD_API_BASE_URL }}
    VITE_SSO_ENABLED: "true"
    VITE_ENTRA_CLIENT_ID: ${{ secrets.PROD_ENTRA_CLIENT_ID }}
    VITE_ENTRA_TENANT_ID: ${{ secrets.PROD_ENTRA_TENANT_ID }}
  run: pnpm build
```

Checklist:

- [ ] `deploy.yml` `Build web app` step injects all four `VITE_*` vars via
      `env:` (or `pnpm build:azure` is updated to read them from repo secrets)
- [ ] `VITE_API_BASE_URL` — public URL of the API App Service, including
      `/api/v1` suffix (sourced from `PROD_API_BASE_URL` secret)
- [ ] `VITE_SSO_ENABLED=true`
- [ ] `VITE_ENTRA_CLIENT_ID` — same value as the API's `ENTRA_CLIENT_ID`
- [ ] `VITE_ENTRA_TENANT_ID` — same value as the API's `ENTRA_TENANT_ID`
- [ ] After any value changes, **trigger a fresh deploy** so the bundle is
      rebuilt — values changed in the portal alone will NOT take effect

## 4. Azure App Registration — Microsoft Graph permissions

Single App Registration covers SSO, SharePoint, and Mail.Send.

- [ ] `Sites.ReadWrite.All` (Application) — SharePoint access for the live
      adapter
- [ ] `Mail.Send` (Application) — Tendering notification emails via PR-51
- [ ] `User.Read` (Delegated) — SSO sign-in
- [ ] **Admin consent granted** for all three permissions (visible as green
      check in the Entra portal)
- [ ] Redirect URI registered: `<Static Web Apps URL>/auth/callback`
- [ ] Client secret created with documented expiry — record expiry date in the
      team password manager so it's rotated before it lapses

## 5. Database

- [ ] Azure Postgres flexible server provisioned, firewall rule allowing the
      App Service outbound IP set added
- [ ] `prisma migrate deploy` runs clean against the Azure DB (no drift,
      no pending migrations — PR-50 dependency)
- [ ] Database seeded with **real Initial Services data** — NOT the dev seed.
      Marco prepares and runs the production seed against the Azure DB
      separately. The dev `pnpm seed` is for local only and seeds fake names
      that must not ship.
- [ ] Backup policy confirmed (Azure Postgres automated backups enabled,
      retention ≥ 7 days)

## 6. GitHub Actions

- [ ] `.github/workflows/deploy.yml` re-enabled to `on: push: main`
      (currently `workflow_dispatch` only — per roadmap §6 line 986).
      Switch back to `workflow_dispatch` if a hot rollback is needed mid-test.
- [ ] Repository secrets present and current — `.github/workflows/deploy.yml`
      reads these exact names; using any other name = silent build/deploy
      failure:
      - `AZURE_API_APP_NAME` — name of the Azure App Service hosting the API
      - `AZURE_API_PUBLISH_PROFILE` — XML publish profile downloaded from the
        API App Service
      - `AZURE_STATIC_WEB_APPS_TOKEN` — deployment token from the Static Web
        Apps resource
      - `PROD_DATABASE_URL` — production Postgres connection string (used by
        the `prisma migrate deploy` step)
      - `PROD_API_BASE_URL` — public URL of the API including `/api/v1`
        (used as the build-time value of `VITE_API_BASE_URL`)
- [ ] If SSO build-time env vars are added per section 3, also create the
      corresponding repo secrets (e.g. `PROD_ENTRA_CLIENT_ID`,
      `PROD_ENTRA_TENANT_ID`) and reference them in the workflow
- [ ] Branch protection on `main` confirms reviewer required and CI must pass

## 7. Smoke test (post-deploy, pre-handoff)

Run these against the live URLs before sending the invite to Sean and Raj.

- [ ] `GET <API_URL>/api/v1/health` → returns `200 OK`
- [ ] `GET <API_URL>/api/docs` → Swagger UI renders, lists Tendering endpoints
- [ ] Login flow works end-to-end for a seeded user (SSO path —
      Sign in with Microsoft → redirect → dashboard loads)
- [ ] Tendering list page loads with seeded tenders visible
- [ ] One full happy-path quote PDF generation completes — file downloads, opens
      without error, has the Initial Services branding
- [ ] Run the full smoke from
      [`tendering-smoke-test-plan.md`](./tendering-smoke-test-plan.md)
      Phase 1 against the live URL

## 8. Rollback plan

If Sean or Raj hit a showstopper:

- [ ] Pre-launch tag noted in section 1 (`pre-tendering-launch-<YYYYMMDD>`)
- [ ] Rollback command sequence ready:

  ```bash
  git checkout pre-tendering-launch-<YYYYMMDD>
  git push origin HEAD:main --force-with-lease
  ```

  Then either let `deploy.yml` redeploy on push (if re-enabled in section 6),
  or trigger it manually via `workflow_dispatch`.

- [ ] DB rollback path documented: Azure Postgres point-in-time restore from
      backup, target time = just before the cutover. Confirm with Marco before
      running — destructive on any data Sean/Raj entered.
- [ ] Communication plan: who tells Sean and Raj that testing is paused while
      rollback runs — Marco direct via the channel agreed in
      [`onboarding-sean-raj.md`](./onboarding-sean-raj.md)

## 9. Final sign-off

- [ ] Marco has personally ticked every box above
- [ ] Pre-launch tag pushed
- [ ] Onboarding doc ([`onboarding-sean-raj.md`](./onboarding-sean-raj.md)) ready
      to send
- [ ] Smoke-test plan
      ([`tendering-smoke-test-plan.md`](./tendering-smoke-test-plan.md))
      attached to the invite
- [ ] Go / no-go decision recorded in the continuation log
