# API permission matrix — route × role expected authorization

Generated from controller source (`@Controller`, `@UseGuards`, `@RequirePermissions` decorators) on the
`test/permission-matrix` branch. This is the **expected** behaviour contract; the serial suite
`apps/api/src/common/auth/__tests__/permission-matrix.spec.ts` asserts the high-value route groups live
against a seeded database. Cells marked KNOWN-FAIL document divergence between intent and current behaviour
— see `docs/pr-prompts/needs-marco/pr-188-authz-findings.md`.

## Roles used

| Column | User | Grants |
|---|---|---|
| Admin | `admin@projectops.local` (Admin role) | Every permission in the registry |
| Viewer | `viewer@projectops.local` (Viewer role) | Exactly 17 `.view` codes (narrowed by `seed-initial-services.ts`): users, roles, permissions, dashboards, masterdata, resources, assets, maintenance, forms, documents, tenders, tenderdocuments, jobs, scheduler, search, notifications, directory. **Not** granted: audit, estimates, projects, compliance, safety, finance, field, sharepoint `.view` codes |
| Anon | no Authorization header | — |

## Cell legend

- **200** — request passes both guards (actual status may be 2xx/400/404 depending on payload/ids; never 401/403)
- **403** — `PermissionsGuard` (or service-level tier check) rejects
- **401** — `JwtAuthGuard` rejects (missing/invalid token)
- **public** — no auth required
- **portal** — separate portal identity pool (`PortalJwtGuard`); staff JWTs are rejected there and portal JWTs are rejected on staff routes
- ✎ — write verb intentionally gated by a `.view` permission (per-user/self-service semantics)

## Enforcement conventions

- Guards are **not global**: every protected controller opts in with class-level
  `@UseGuards(JwtAuthGuard, PermissionsGuard)` plus per-route `@RequirePermissions("...")`.
- `PermissionsGuard` lets SuperUsers bypass all permission checks.
- `admin/users` and `personas/global-settings` enforce tiers in the service/handler instead of decorators.
- A route with guards but **no** `@RequirePermissions` metadata is auth-only (any valid staff JWT passes).

## Matrix

### `health/health.controller.ts` — guards: (none at class level)

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/health` | — | public | public | public |  |

### `modules/admin-settings/admin-settings.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/admin/settings/notifications` | `platform.admin` | 200 | 403 | 401 |  |
| PATCH | `/admin/settings/notifications/:trigger` | `platform.admin` | 200 | 403 | 401 |  |
| GET | `/admin/settings/email` | `platform.admin` | 200 | 403 | 401 |  |
| PATCH | `/admin/settings/email` | `platform.admin` | 200 | 403 | 401 |  |
| GET | `/admin/settings/email/test` | `platform.admin` | 200 | 403 | 401 |  |
| GET | `/admin/settings/users` | `platform.admin` | 200 | 403 | 401 |  |

### `modules/admin-users/admin-users.controller.ts` — guards: JwtAuthGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/admin/users` | — | 200 | 403 | 401 | Tier-based in service: SuperUser/Admin only; everyone else 403. |
| POST | `/admin/users` | — | 200 | 403 | 401 | Tier-based in service (Admin+); Admins cannot create Admins/SuperUsers. |
| PATCH | `/admin/users/:userId` | — | 200 | 403 | 401 | Tier-based in service (Admin+). |
| DELETE | `/admin/users/:userId` | — | 200 | 403 | 401 | Tier-based in service (Admin+). |
| POST | `/admin/users/:userId/reset-password` | — | 200 | 403 | 401 | Tier-based in service (Admin+). |

### `modules/ai-settings/ai-settings.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/ai-settings/company/keys` | `platform.admin` | 200 | 403 | 401 |  |
| POST | `/ai-settings/company/keys/:provider` | `platform.admin` | 200 | 403 | 401 |  |
| DELETE | `/ai-settings/company/keys/:provider` | `platform.admin` | 200 | 403 | 401 |  |
| GET | `/ai-settings/me/keys` | `ai.persona.tendering` | 200 | 403 | 401 |  |
| POST | `/ai-settings/me/keys/:provider` | `ai.persona.tendering` | 200 | 403 | 401 |  |
| DELETE | `/ai-settings/me/keys/:provider` | `ai.persona.tendering` | 200 | 403 | 401 |  |

### `modules/allocations/allocations.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/projects/:projectId/allocations` | `projects.view` | 200 | 403 | 401 |  |
| POST | `/projects/:projectId/allocations` | `resources.manage` | 200 | 403 | 401 |  |
| PATCH | `/projects/:projectId/allocations/:allocId` | `resources.manage` | 200 | 403 | 401 |  |
| DELETE | `/projects/:projectId/allocations/:allocId` | `resources.manage` | 200 | 403 | 401 |  |

### `modules/archive/archive.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/archive` | `jobs.view` | 200 | 200 | 401 |  |
| GET | `/archive/:jobId/export` | `jobs.view` | 200 | 200 | 401 |  |

### `modules/assets/assets.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/assets/categories` | `assets.view` | 200 | 200 | 401 |  |
| POST | `/assets/categories` | `assets.manage` | 200 | 403 | 401 |  |
| PATCH | `/assets/categories/:id` | `assets.manage` | 200 | 403 | 401 |  |
| GET | `/assets` | `assets.view` | 200 | 200 | 401 |  |
| GET | `/assets/:id` | `assets.view` | 200 | 200 | 401 |  |
| POST | `/assets` | `assets.manage` | 200 | 403 | 401 |  |
| PATCH | `/assets/:id` | `assets.manage` | 200 | 403 | 401 |  |

### `modules/audit/audit.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/audit-logs` | `audit.view` | 200 | 403 | 401 |  |

### `modules/auth/auth.controller.ts` — guards: (none at class level)

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/auth/login` | — | public | public | public |  |
| POST | `/auth/entra` | — | public | public | public |  |
| POST | `/auth/sso` | — | public | public | public |  |
| POST | `/auth/refresh` | — | public | public | public |  |
| POST | `/auth/reset-password` | — | public | public | public |  |
| GET | `/auth/config` | — | public | public | public |  |
| GET | `/auth/me` | — | 200 | 200 | 401 | Auth-only; returns the JWT principal. |

### `modules/client-quotes/client-quotes.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/quotes` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId` | `tenders.view` | 200 | 200 | 401 |  |
| PATCH | `/tenders/:tenderId/quotes/:quoteId` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/quotes/:quoteId` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId/summary` | `tenders.view` | 200 | 200 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId/cost-lines` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/cost-lines` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/quotes/:quoteId/cost-lines/:lineId` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/quotes/:quoteId/cost-lines/:lineId` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/cost-lines/reorder` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId/provisional-lines` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/provisional-lines` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/quotes/:quoteId/provisional-lines/:lineId` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/quotes/:quoteId/provisional-lines/:lineId` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId/cost-options` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/cost-options` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/quotes/:quoteId/cost-options/:lineId` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/quotes/:quoteId/cost-options/:lineId` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId/assumptions` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/assumptions` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/quotes/:quoteId/assumptions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/quotes/:quoteId/assumptions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/assumptions/copy-from-tender` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId/exclusions` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/exclusions` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/quotes/:quoteId/exclusions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/quotes/:quoteId/exclusions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/exclusions/copy-from-tender` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/quotes/client-suggestion/:clientId` | `tenders.view` | 200 | 200 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId/pdf` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/send` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/client-quotes/quote-scope-items.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/quotes/:quoteId/scope-items` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/scope-items` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/quotes/:quoteId/scope-items/:itemId` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/quotes/:quoteId/scope-items/:itemId` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/scope-items/reorder` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/scope-items/reset` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/scope-items/push-from-scope` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/compliance/compliance.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/compliance/dashboard` | `compliance.view` | 200 | 403 | 401 |  |
| GET | `/compliance/expiring` | `compliance.view` | 200 | 403 | 401 |  |
| GET | `/compliance/blocked-subcontractors` | `compliance.view` | 200 | 403 | 401 |  |
| GET | `/compliance/workers/:workerProfileId/qualifications` | `compliance.view` | 200 | 403 | 401 |  |
| POST | `/compliance/workers/:workerProfileId/qualifications` | `compliance.manage` | 200 | 403 | 401 |  |
| PATCH | `/compliance/workers/:workerProfileId/qualifications/:qualId` | `compliance.manage` | 200 | 403 | 401 |  |
| DELETE | `/compliance/workers/:workerProfileId/qualifications/:qualId` | `compliance.manage` | 200 | 403 | 401 |  |
| GET | `/compliance/workers/:workerId/competency-check` | `compliance.view` | 200 | 403 | 401 |  |
| POST | `/compliance/alerts/send-now` | `compliance.admin` | 200 | 403 | 401 |  |
| PATCH | `/compliance/subcontractors/:id/block` | `compliance.admin` | 200 | 403 | 401 |  |

### `modules/contacts/contacts.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/contacts` | `directory.view` | 200 | 200 | 401 |  |
| GET | `/contacts/:id` | `directory.view` | 200 | 200 | 401 |  |
| POST | `/contacts` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/contacts/:id` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/contacts/:id` | `directory.manage` | 200 | 403 | 401 |  |

### `modules/contracts/contracts.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/contracts` | `finance.view` | 200 | 403 | 401 |  |
| GET | `/contracts/:id` | `finance.view` | 200 | 403 | 401 |  |
| POST | `/contracts` | `finance.manage` | 200 | 403 | 401 |  |
| PATCH | `/contracts/:id` | `finance.manage` | 200 | 403 | 401 |  |
| GET | `/contracts/:id/variations` | `finance.view` | 200 | 403 | 401 |  |
| POST | `/contracts/:id/variations` | `finance.manage` | 200 | 403 | 401 |  |
| PATCH | `/contracts/:id/variations/:variationId` | `finance.manage` | 200 | 403 | 401 |  |
| GET | `/contracts/:id/claims` | `finance.view` | 200 | 403 | 401 |  |
| GET | `/contracts/:id/claims/:claimId` | `finance.view` | 200 | 403 | 401 |  |
| POST | `/contracts/:id/claims` | `finance.manage` | 200 | 403 | 401 |  |
| PATCH | `/contracts/:id/claims/:claimId/items/:itemId` | `finance.manage` | 200 | 403 | 401 |  |
| POST | `/contracts/:id/claims/:claimId/submit` | `finance.manage` | 200 | 403 | 401 |  |
| POST | `/contracts/:id/claims/:claimId/approve` | `finance.admin` | 200 | 403 | 401 |  |
| POST | `/contracts/:id/claims/:claimId/pay` | `finance.admin` | 200 | 403 | 401 |  |

### `modules/directory/directory.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/directory` | `directory.view` | 200 | 200 | 401 |  |
| GET | `/directory/expiry-alerts` | `directory.view` | 200 | 200 | 401 |  |
| GET | `/directory/:id` | `directory.view` | 200 | 200 | 401 |  |
| POST | `/directory` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/directory/:id` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/directory/:id` | `directory.admin` | 200 | 403 | 401 |  |
| PATCH | `/directory/:id/prequal` | `directory.admin` | 200 | 403 | 401 |  |
| POST | `/directory/:id/contacts` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/directory/:id/contacts/:contactId` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/directory/:id/contacts/:contactId` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/directory/:id/licences` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/directory/:id/licences/:licenceId` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/directory/:id/licences/:licenceId` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/directory/:id/insurances` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/directory/:id/insurances/:insuranceId` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/directory/:id/insurances/:insuranceId` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/directory/:id/credit-applications` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/directory/:id/credit-applications/:appId` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/directory/:id/documents` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/directory/:id/documents/:docId` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/directory/:id/documents/:docId` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/clients/:clientId/licences` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/clients/:clientId/licences/:licenceId` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/clients/:clientId/licences/:licenceId` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/clients/:clientId/insurances` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/clients/:clientId/insurances/:insuranceId` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/clients/:clientId/insurances/:insuranceId` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/clients/:clientId/credit-applications` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/clients/:clientId/credit-applications/:appId` | `directory.manage` | 200 | 403 | 401 |  |

### `modules/documents/documents.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/documents` | `documents.view` | 200 | 200 | 401 |  |
| GET | `/documents/entity/:linkedEntityType/:linkedEntityId` | `documents.view` | 200 | 200 | 401 |  |
| GET | `/documents/sites/:siteId/documents` | `documents.view` | 200 | 200 | 401 |  |
| GET | `/documents/:id` | `documents.view` | 200 | 200 | 401 |  |
| GET | `/documents/:id/open-link` | `documents.view` | 200 | 200 | 401 |  |
| GET | `/documents/:id/download` | `documents.view` | 200 | 200 | 401 |  |
| POST | `/documents` | `documents.manage` | 200 | 403 | 401 |  |
| POST | `/documents/:id/versions` | `documents.manage` | 200 | 403 | 401 |  |

### `modules/estimate-export/estimate-export.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:id/export/pdf` | `tenders.view` | 200 | 200 | 401 |  |
| GET | `/tenders/:id/export/excel` | `tenders.view` | 200 | 200 | 401 |  |

### `modules/estimates/estimates.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/estimate-rates/labour` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/labour` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/labour/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/labour/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/plant` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/plant` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/plant/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/plant/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/waste` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/waste` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/waste/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/waste/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/cutting` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/cutting` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/cutting/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/cutting/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/core-holes` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/core-holes` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/core-holes/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/core-holes/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/fuel` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/fuel` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/fuel/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/fuel/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/enclosure` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/enclosure` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/enclosure/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/enclosure/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/other-rates` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/other-rates` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/other-rates/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/other-rates/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/material-densities` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/material-densities` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/material-densities/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/material-densities/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/estimate` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/lock` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/unlock` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/estimate/summary` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/items` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate/items/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/estimate/items/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/items/:itemId/labour` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate/items/:itemId/labour/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/estimate/items/:itemId/labour/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/items/:itemId/plant` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate/items/:itemId/plant/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/estimate/items/:itemId/plant/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/items/:itemId/equip` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate/items/:itemId/equip/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/estimate/items/:itemId/equip/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/items/:itemId/waste` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate/items/:itemId/waste/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/estimate/items/:itemId/waste/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/items/:itemId/cutting` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate/items/:itemId/cutting/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/estimate/items/:itemId/cutting/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/items/:itemId/assumptions` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate/items/:itemId/assumptions/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/estimate/items/:itemId/assumptions/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |

### `modules/field/field.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/field/my-allocations` | `field.view` | 200 | 403 | 401 |  |
| GET | `/field/my-allocations/:allocationId/documents` | `field.view` | 200 | 403 | 401 |  |
| GET | `/field/pre-starts` | `field.view` | 200 | 403 | 401 |  |
| POST | `/field/pre-starts` | `field.view` | 200 | 403 ✎ | 401 |  |
| GET | `/field/pre-starts/:id` | `field.view` | 200 | 403 | 401 |  |
| PATCH | `/field/pre-starts/:id` | `field.view` | 200 | 403 ✎ | 401 |  |
| POST | `/field/pre-starts/:id/submit` | `field.view` | 200 | 403 ✎ | 401 |  |
| GET | `/field/timesheets` | `field.view` | 200 | 403 | 401 |  |
| GET | `/field/timesheets/pending` | `field.manage` | 200 | 403 | 401 |  |
| GET | `/field/timesheets/all` | `field.manage` | 200 | 403 | 401 |  |
| GET | `/field/timesheets/payroll-export.csv` | `field.manage` | 200 | 403 | 401 |  |
| GET | `/field/timesheets/summary` | `field.manage` | 200 | 403 | 401 |  |
| POST | `/field/timesheets/bulk-approve` | `field.manage` | 200 | 403 | 401 |  |
| GET | `/field/location-consent` | `field.view` | 200 | 403 | 401 |  |
| POST | `/field/location-consent` | `field.view` | 200 | 403 ✎ | 401 |  |
| POST | `/field/timesheets` | `field.view` | 200 | 403 ✎ | 401 |  |
| PATCH | `/field/timesheets/:id` | `field.view` | 200 | 403 ✎ | 401 |  |
| POST | `/field/timesheets/:id/submit` | `field.view` | 200 | 403 ✎ | 401 |  |
| POST | `/field/timesheets/:id/approve` | `field.manage` | 200 | 403 | 401 |  |
| POST | `/field/timesheets/:id/reject` | `field.manage` | 200 | 403 | 401 |  |

### `modules/forms/forms-engine.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/forms/submissions` | `forms.submit` | 200 | 403 | 401 |  |
| PATCH | `/forms/submissions/:id/values` | `forms.submit` | 200 | 403 | 401 |  |
| POST | `/forms/submissions/:id/submit` | `forms.submit` | 200 | 403 | 401 |  |
| POST | `/forms/submissions/:id/approve` | `forms.approve` | 200 | 403 | 401 |  |
| POST | `/forms/submissions/:id/reject` | `forms.approve` | 200 | 403 | 401 |  |
| POST | `/forms/submissions/:id/resubmit` | `forms.submit` | 200 | 403 | 401 |  |
| GET | `/forms/my-submissions` | `forms.submit` | 200 | 403 | 401 |  |
| GET | `/forms/pending-approvals` | `forms.approve` | 200 | 403 | 401 |  |
| GET | `/forms/analytics` | `forms.manage` | 200 | 403 | 401 |  |

### `modules/forms/forms.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/forms/templates` | `forms.view` | 200 | 200 | 401 |  |
| GET | `/forms/templates/:id` | `forms.view` | 200 | 200 | 401 |  |
| POST | `/forms/templates` | `forms.manage` | 200 | 403 | 401 |  |
| POST | `/forms/templates/:id/versions` | `forms.manage` | 200 | 403 | 401 |  |
| GET | `/forms/submissions` | `forms.view` | 200 | 200 | 401 |  |
| GET | `/forms/submissions/:id` | `forms.view` | 200 | 200 | 401 |  |
| POST | `/forms/versions/:versionId/submissions` | `forms.manage` | 200 | 403 | 401 |  |

### `modules/global-lists/global-lists.controller.ts` — guards: JwtAuthGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/lists` | — | 200 | 200 | 401 |  |
| GET | `/lists/:slug` | — | 200 | 200 | 401 |  |
| GET | `/lists/:slug/items` | — | 200 | 200 | 401 |  |
| POST | `/lists` | — | 200 | 200 (KNOWN-FAIL) | 401 | KNOWN-FAIL — any authenticated user may create a global list (intentional 'free-for-all' per code comment; conflicts with read-only Viewer intent). See pr-188-authz-findings.md. |
| POST | `/lists/:slug/items` | — | 200 | 200 (KNOWN-FAIL) | 401 | KNOWN-FAIL — any authenticated user may add items. See pr-188-authz-findings.md. |
| PATCH | `/lists/:slug/items/:itemId` | — | 200 | 200 | 401 | Creator-or-admin enforced in service. |
| DELETE | `/lists/:slug/items/:itemId` | — | 200 | 200 | 401 | Creator-or-admin enforced in service. |
| POST | `/lists/:slug/items/reorder` | — | 200 | 200 | 401 | System lists require platform.admin (service check); user lists free-for-all. |

### `modules/jobs/jobs.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/jobs` | `jobs.view` | 200 | 200 | 401 |  |
| GET | `/jobs/archive` | `jobs.view` | 200 | 200 | 401 |  |
| POST | `/jobs` | `jobs.manage` | 200 | 403 | 401 |  |
| GET | `/jobs/:id` | `jobs.view` | 200 | 200 | 401 |  |
| PATCH | `/jobs/:id` | `jobs.manage` | 200 | 403 | 401 |  |
| PATCH | `/jobs/:id/status` | `jobs.manage` | 200 | 403 | 401 |  |
| POST | `/jobs/:id/stages` | `jobs.manage` | 200 | 403 | 401 |  |
| PATCH | `/jobs/:id/stages/:stageId` | `jobs.manage` | 200 | 403 | 401 |  |
| POST | `/jobs/:id/activities` | `jobs.manage` | 200 | 403 | 401 |  |
| PATCH | `/jobs/:id/activities/:activityId` | `jobs.manage` | 200 | 403 | 401 |  |
| POST | `/jobs/:id/issues` | `jobs.manage` | 200 | 403 | 401 |  |
| PATCH | `/jobs/:id/issues/:issueId` | `jobs.manage` | 200 | 403 | 401 |  |
| POST | `/jobs/:id/variations` | `jobs.manage` | 200 | 403 | 401 |  |
| PATCH | `/jobs/:id/variations/:variationId` | `jobs.manage` | 200 | 403 | 401 |  |
| POST | `/jobs/:id/progress-entries` | `jobs.manage` | 200 | 403 | 401 |  |
| PATCH | `/jobs/:id/closeout` | `jobs.manage` | 200 | 403 | 401 |  |

### `modules/jobs/tender-conversion.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| PATCH | `/tenders/:tenderId/award` | `tenderconversion.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/contract` | `tenderconversion.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/convert-to-job` | `tenderconversion.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/convert-to-job/reuse-archived` | `tenderconversion.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/rollback-lifecycle` | `tenderconversion.manage` | 200 | 403 | 401 |  |

### `modules/maintenance/maintenance.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/maintenance/assets` | `maintenance.view` | 200 | 200 | 401 |  |
| GET | `/maintenance/assets/utilisation` | `maintenance.view` | 200 | 200 | 401 |  |
| GET | `/maintenance/assets/:assetId` | `maintenance.view` | 200 | 200 | 401 |  |
| GET | `/maintenance/plans` | `maintenance.view` | 200 | 200 | 401 |  |
| POST | `/maintenance/plans` | `maintenance.manage` | 200 | 403 | 401 |  |
| PATCH | `/maintenance/plans/:id` | `maintenance.manage` | 200 | 403 | 401 |  |
| POST | `/maintenance/events` | `maintenance.manage` | 200 | 403 | 401 |  |
| PATCH | `/maintenance/events/:id` | `maintenance.manage` | 200 | 403 | 401 |  |
| POST | `/maintenance/inspections` | `maintenance.manage` | 200 | 403 | 401 |  |
| PATCH | `/maintenance/inspections/:id` | `maintenance.manage` | 200 | 403 | 401 |  |
| POST | `/maintenance/breakdowns` | `maintenance.manage` | 200 | 403 | 401 |  |
| PATCH | `/maintenance/breakdowns/:id` | `maintenance.manage` | 200 | 403 | 401 |  |
| PATCH | `/maintenance/assets/:assetId/status` | `maintenance.manage` | 200 | 403 | 401 |  |

### `modules/master-data/master-data.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/master-data/clients` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/clients` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/clients/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/contacts` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/contacts` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/contacts/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/sites` | `masterdata.view` | 200 | 200 | 401 |  |
| GET | `/master-data/sites/:id` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/sites` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/sites/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| DELETE | `/master-data/sites/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/resource-types` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/resource-types` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/resource-types/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/competencies` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/competencies` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/competencies/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/workers` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/workers` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/workers/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/crews` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/crews` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/crews/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/assets` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/assets` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/assets/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/worker-competencies` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/worker-competencies` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/worker-competencies/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/lookup-values` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/lookup-values` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/lookup-values/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/references` | `masterdata.view` | 200 | 200 | 401 |  |

### `modules/permissions/permissions.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/permissions` | `permissions.view` | 200 | 200 | 401 |  |

### `modules/personas/personas.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/personas/global-settings` | — | 200 | 200 | 401 | isSuperUser enforced in handler. |
| PUT | `/personas/global-settings` | — | 200 | 200 | 401 | isSuperUser enforced in handler. |
| GET | `/personas` | — | 200 | 200 | 401 |  |
| GET | `/personas/active-for-route` | — | 200 | 200 | 401 |  |
| GET | `/personas/:slug` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| PUT | `/personas/:slug/company-instruction` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| GET | `/personas/:slug/my-settings` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| PUT | `/personas/:slug/my-settings` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| POST | `/personas/:slug/chat` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| GET | `/personas/:slug/conversations` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| GET | `/personas/:slug/conversations/:id` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| POST | `/personas/:slug/conversations/new` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| DELETE | `/personas/:slug/conversations/:id` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |

### `modules/platform/dashboards.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/dashboards` | `dashboards.view` | 200 | 200 | 401 |  |
| GET | `/dashboards/:id/render` | `dashboards.view` | 200 | 200 | 401 |  |
| POST | `/dashboards` | `dashboards.manage` | 200 | 403 | 401 |  |
| PATCH | `/dashboards/:id` | `dashboards.manage` | 200 | 403 | 401 |  |

### `modules/platform/notifications.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/notifications/me` | `notifications.view` | 200 | 200 | 401 |  |
| POST | `/notifications` | `notifications.manage` | 200 | 403 | 401 |  |
| POST | `/notifications/follow-ups/manual` | `notifications.manage` | 200 | 403 | 401 |  |
| GET | `/notifications/follow-ups/shared` | `notifications.view` | 200 | 200 | 401 |  |
| POST | `/notifications/follow-ups/sync` | `notifications.manage` | 200 | 403 | 401 |  |
| PATCH | `/notifications/follow-ups/:id/triage` | `notifications.manage` | 200 | 403 | 401 |  |
| PATCH | `/notifications/follow-ups/:id/assign` | `notifications.manage` | 200 | 403 | 401 |  |
| PATCH | `/notifications/follow-ups/:id/resolve` | `notifications.manage` | 200 | 403 | 401 |  |
| PATCH | `/notifications/follow-ups/:id/accept-handoff` | `notifications.manage` | 200 | 403 | 401 |  |
| PATCH | `/notifications/follow-ups/:id/accept-escalation` | `notifications.manage` | 200 | 403 | 401 |  |
| PATCH | `/notifications/:id/read` | `notifications.manage` | 200 | 403 | 401 |  |
| PATCH | `/notifications/read-all` | `notifications.manage` | 200 | 403 | 401 |  |

### `modules/platform/platform-config.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/admin/platform-config` | `platform.admin` | 200 | 403 | 401 |  |
| PATCH | `/admin/platform-config` | `platform.admin` | 200 | 403 | 401 |  |
| POST | `/admin/platform-config/test-anthropic` | `platform.admin` | 200 | 403 | 401 |  |
| POST | `/admin/platform-config/test-gemini` | `platform.admin` | 200 | 403 | 401 |  |
| POST | `/admin/platform-config/test-groq` | `platform.admin` | 200 | 403 | 401 |  |
| POST | `/admin/platform-config/test-openai` | `platform.admin` | 200 | 403 | 401 |  |

### `modules/platform/platform-config.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/admin/ai-providers/:provider/models` | `platform.admin` | 200 | 403 | 401 |  |

### `modules/platform/platform.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/platform/config` | `sharepoint.view` | 200 | 403 | 401 |  |

### `modules/platform/search.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/search` | `search.view` | 200 | 200 | 401 |  |
| POST | `/search/entries` | `search.view` | 200 | 200 ✎ | 401 |  |

### `modules/platform/sharepoint.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/sharepoint/folders` | `sharepoint.view` | 200 | 403 | 401 |  |
| POST | `/sharepoint/folders/ensure` | `sharepoint.manage` | 200 | 403 | 401 |  |
| GET | `/sharepoint/test` | `sharepoint.manage` | 200 | 403 | 401 |  |

### `modules/platform/user-dashboards.controller.ts` — guards: JwtAuthGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/user-dashboards` | — | 200 | 200 | 401 |  |
| POST | `/user-dashboards` | — | 200 | 200 | 401 |  |
| GET | `/user-dashboards/:id` | — | 200 | 200 | 401 |  |
| PATCH | `/user-dashboards/:id` | — | 200 | 200 | 401 |  |
| DELETE | `/user-dashboards/:id` | — | 200 | 200 | 401 |  |
| POST | `/user-dashboards/:id/default` | — | 200 | 200 | 401 |  |

### `modules/portal/portal-auth.controller.ts` — guards: (none at class level)

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/portal/auth/login` | — | public | public | public |  |
| POST | `/portal/auth/refresh` | — | public | public | public |  |
| POST | `/portal/auth/logout` | — | public | public | public |  |
| POST | `/portal/auth/accept-invite` | — | public | public | public |  |
| POST | `/portal/auth/request-reset` | — | public | public | public |  |
| POST | `/portal/auth/reset-password` | — | public | public | public |  |
| GET | `/portal/auth/me` | — | 200 | 200 | 401 | Portal token endpoint (separate identity pool). |
| POST | `/portal/invites` | — | portal | portal | 401 | PortalJwtGuard + portal.invite (method-level). |

### `modules/portal/portal-client.controller.ts` — guards: PortalJwtGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/portal/client/dashboard` | — | portal | portal | 401 |  |
| GET | `/portal/client/projects` | — | portal | portal | 401 |  |
| GET | `/portal/client/projects/:id` | — | portal | portal | 401 |  |
| GET | `/portal/client/jobs` | — | portal | portal | 401 |  |
| GET | `/portal/client/quotes` | — | portal | portal | 401 |  |
| GET | `/portal/client/documents` | — | portal | portal | 401 |  |
| GET | `/portal/client/account` | — | portal | portal | 401 |  |

### `modules/projects/gantt.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/projects/:projectId/gantt` | `projects.view` | 200 | 403 | 401 |  |
| POST | `/projects/:projectId/gantt` | `projects.manage` | 200 | 403 | 401 |  |
| PATCH | `/projects/:projectId/gantt/:taskId` | `projects.manage` | 200 | 403 | 401 |  |
| DELETE | `/projects/:projectId/gantt/:taskId` | `projects.manage` | 200 | 403 | 401 |  |
| POST | `/projects/:projectId/gantt/generate` | `projects.manage` | 200 | 403 | 401 |  |

### `modules/projects/projects-timeline.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/projects-timeline` | `projects.view` | 200 | 403 | 401 |  |

### `modules/projects/projects.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/projects/next-number` | — | 200 | 200 | 401 | Auth-only — no permission metadata. See findings doc. |
| GET | `/projects` | `projects.view` | 200 | 403 | 401 |  |
| GET | `/projects/:id` | `projects.view` | 200 | 403 | 401 |  |
| POST | `/projects` | `projects.admin` | 200 | 403 | 401 |  |
| PATCH | `/projects/:id` | `projects.manage` | 200 | 403 | 401 |  |
| POST | `/projects/:id/status` | `projects.manage` | 200 | 403 | 401 |  |
| GET | `/projects/:id/activity` | `projects.view` | 200 | 403 | 401 |  |
| GET | `/projects/:id/revert-to-tender/preflight` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/projects/:id/revert-to-tender` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/quote/quote.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/tandc` | `tenders.view` | 200 | 200 | 401 |  |
| PATCH | `/tenders/:tenderId/tandc` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/tandc/reset` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/tandc/reset/:clauseNumber` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/assumptions` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/assumptions` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/assumptions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/assumptions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/assumptions/reorder` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/exclusions` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/exclusions` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/exclusions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/exclusions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/exclusions/reorder` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/exports` | `tenders.view` | 200 | 200 | 401 |  |

### `modules/resources/resources.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/resources/workers` | `resources.view` | 200 | 200 | 401 |  |
| GET | `/resources/workers/:id` | `resources.view` | 200 | 200 | 401 |  |
| POST | `/resources/availability-windows` | `resources.manage` | 200 | 403 | 401 |  |
| PATCH | `/resources/availability-windows/:id` | `resources.manage` | 200 | 403 | 401 |  |
| POST | `/resources/role-suitabilities` | `resources.manage` | 200 | 403 | 401 |  |
| PATCH | `/resources/role-suitabilities/:id` | `resources.manage` | 200 | 403 | 401 |  |
| GET | `/resources/shifts/:shiftId/requirements` | `resources.view` | 200 | 200 | 401 |  |
| POST | `/resources/shifts/:shiftId/requirements` | `resources.manage` | 200 | 403 | 401 |  |
| PATCH | `/resources/shifts/:shiftId/requirements/:id` | `resources.manage` | 200 | 403 | 401 |  |

### `modules/roles/roles.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/roles` | `roles.view` | 200 | 200 | 401 |  |
| POST | `/roles` | `roles.create` | 200 | 403 | 401 |  |
| PATCH | `/roles/:id` | `roles.update` | 200 | 403 | 401 |  |

### `modules/safety/safety.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/safety/dashboard` | `safety.view` | 200 | 403 | 401 |  |
| GET | `/safety/incidents` | `safety.view` | 200 | 403 | 401 |  |
| GET | `/safety/incidents/:id` | `safety.view` | 200 | 403 | 401 |  |
| POST | `/safety/incidents` | `safety.manage` | 200 | 403 | 401 |  |
| PATCH | `/safety/incidents/:id` | `safety.manage` | 200 | 403 | 401 |  |
| POST | `/safety/incidents/:id/close` | `safety.admin` | 200 | 403 | 401 |  |
| GET | `/safety/hazards` | `safety.view` | 200 | 403 | 401 |  |
| GET | `/safety/hazards/:id` | `safety.view` | 200 | 403 | 401 |  |
| POST | `/safety/hazards` | `safety.manage` | 200 | 403 | 401 |  |
| PATCH | `/safety/hazards/:id` | `safety.manage` | 200 | 403 | 401 |  |
| POST | `/safety/hazards/:id/close` | `safety.admin` | 200 | 403 | 401 |  |

### `modules/scheduler/scheduler.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/scheduler/workspace` | `scheduler.view` | 200 | 200 | 401 |  |
| POST | `/scheduler/shifts` | `scheduler.manage` | 200 | 403 | 401 |  |
| PATCH | `/scheduler/shifts/:shiftId` | `scheduler.manage` | 200 | 403 | 401 |  |
| POST | `/scheduler/shifts/:shiftId/workers` | `scheduler.manage` | 200 | 403 | 401 |  |
| DELETE | `/scheduler/shifts/:shiftId/workers/:workerId` | `scheduler.manage` | 200 | 403 | 401 |  |
| POST | `/scheduler/shifts/:shiftId/assets` | `scheduler.manage` | 200 | 403 | 401 |  |
| DELETE | `/scheduler/shifts/:shiftId/assets/:assetId` | `scheduler.manage` | 200 | 403 | 401 |  |

### `modules/tender-clarifications/tender-clarifications.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/clarification-notes` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/clarification-notes` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/clarification-notes/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/clarification-notes/:id` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/tender-clients/tender-clients.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/clients` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/clients` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/clients/:clientId` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/tender-clients/tender-clients.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tendering/clients/search` | `tenders.view` | 200 | 200 | 401 |  |

### `modules/tender-documents/tender-documents.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/documents` | `tenderdocuments.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/documents` | `tenderdocuments.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/documents/:documentId` | `tenderdocuments.manage` | 200 | 403 | 401 |  |

### `modules/tendering/scope-of-works.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/scope/header` | `estimates.view` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/scope/header` | `estimates.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/scope/items` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/items` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/scope/items/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/scope/items/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/items/reorder` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/items/:itemId/confirm` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/items/:itemId/exclude` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/items/confirm-all` | `estimates.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/scope/cards` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/cards` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/scope/cards/:cardId` | `estimates.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/scope/cards/:cardId/summary` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/markup/reset-all` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/scope/cards/:cardId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/cards/reorder` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/cards/:cardId/items` | `estimates.manage` | 200 | 403 | 401 |  |

### `modules/tendering/scope-redesign.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/scope/columns` | `estimates.view` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/scope/view-config` | `estimates.view` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/scope/view-config` | `estimates.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/scope/cutting-items` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/cutting-items` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/scope/cutting-items/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/scope/cutting-items/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/scope/summary` | `estimates.view` | 200 | 403 | 401 |  |

### `modules/tendering/scope-redesign.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/tenders/:tenderId/scope/cards/:cardId/cutting/copy-from-above` | `estimates.manage` | 200 | 403 | 401 |  |

### `modules/tendering/scope-waste.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/scope/waste` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/waste` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/scope/waste/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/scope/waste/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/waste/reorder` | `estimates.manage` | 200 | 403 | 401 |  |

### `modules/tendering/scope-waste.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/tenders/:tenderId/scope/cards/:cardId/waste/sum-from-above` | `estimates.manage` | 200 | 403 | 401 |  |

### `modules/tendering/scope/clarification-proposals.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/personas/tendering/clarification-proposals/:messageId/accept` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/clarification-proposals/:messageId/reject` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/clarification-proposals/:messageId/accept-all` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/clarification-proposals/:messageId/reject-all` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |

### `modules/tendering/scope/estimate-proposals.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/personas/tendering/estimate-proposals/:messageId/accept` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/estimate-proposals/:messageId/reject` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/estimate-proposals/:messageId/accept-all` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/estimate-proposals/:messageId/reject-all` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |

### `modules/tendering/scope/proposals.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/personas/tendering/proposals/:messageId/accept` | — | 200 | 200 | 401 |  |
| POST | `/personas/tendering/proposals/:messageId/reject` | — | 200 | 200 | 401 |  |
| POST | `/personas/tendering/proposals/:messageId/accept-all` | — | 200 | 200 | 401 |  |
| POST | `/personas/tendering/proposals/:messageId/reject-all` | — | 200 | 200 | 401 |  |

### `modules/tendering/scope/quote-proposals.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/personas/tendering/quote-proposals/:messageId/accept` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/quote-proposals/:messageId/reject` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/quote-proposals/:messageId/accept-all` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/quote-proposals/:messageId/reject-all` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |

### `modules/tendering/tender-client-notes.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/clients/:clientId/notes` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/clients/:clientId/notes` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/clients/:clientId/notes/:noteId` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/tendering/tender-convert.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/tenders/:id/convert` | `tenderconversion.manage` | 200 | 403 | 401 |  |

### `modules/tendering/tender-entries.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/entries` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/entries` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/entries/:entryId` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/entries/:entryId` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/tendering/tendering.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/bulk-status` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/filter-presets` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/filter-presets` | `tenders.view` | 200 | 200 ✎ | 401 |  |
| PATCH | `/tenders/filter-presets/:id` | `tenders.view` | 200 | 200 ✎ | 401 |  |
| DELETE | `/tenders/filter-presets/:id` | `tenders.view` | 200 | 200 ✎ | 401 |  |
| POST | `/tenders` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:id/notes` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:id/clarifications` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:id/follow-ups` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:id/activities` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:id/activities` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:id/activities/:activityId` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/import/preview` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/import/commit` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:id` | `tenders.view` | 200 | 200 | 401 |  |
| PATCH | `/tenders/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:id/delete-preflight` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:id/bump-revision` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:id/duplicate` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:id/status` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:id/probability` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:id/assigned-estimator` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:id/quick-edit` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/users/users.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/users` | `users.view` | 200 | 200 | 401 |  |
| POST | `/users` | `users.create` | 200 | 403 | 401 |  |
| PATCH | `/users/:id` | `users.update` | 200 | 403 | 401 |  |

### `modules/workers/availability.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/workers/availability/overlay` | `scheduler.view` | 200 | 200 | 401 |  |
| GET | `/workers/leaves` | `resources.view` | 200 | 200 | 401 |  |
| POST | `/workers/leaves` | `resources.view` | 200 | 200 ✎ | 401 |  |
| PATCH | `/workers/leaves/:id/status` | `resources.manage` | 200 | 403 | 401 |  |
| DELETE | `/workers/leaves/:id` | `resources.manage` | 200 | 403 | 401 |  |
| GET | `/workers/unavailability` | `resources.view` | 200 | 200 | 401 |  |
| POST | `/workers/unavailability` | `resources.view` | 200 | 200 ✎ | 401 |  |
| DELETE | `/workers/unavailability/:id` | `resources.manage` | 200 | 403 | 401 |  |

### `modules/workers/workers.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/workers` | `resources.view` | 200 | 200 | 401 |  |
| GET | `/workers/:id` | `resources.view` | 200 | 200 | 401 |  |
| POST | `/workers` | `resources.manage` | 200 | 403 | 401 |  |
| PATCH | `/workers/:id` | `resources.manage` | 200 | 403 | 401 |  |
| DELETE | `/workers/:id` | `resources.manage` | 200 | 403 | 401 |  |
| GET | `/workers/:id/allocations` | `resources.view` | 200 | 200 | 401 |  |
| POST | `/workers/:id/provision-mobile-access` | `resources.manage` | 200 | 403 | 401 |  |

### `modules/xero/xero.controller.ts` — guards: (none at class level)

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/xero/connect` | `platform.admin` | 200 | 403 | 401 |  |
| GET | `/xero/callback` | — | public | public | public | OAuth redirect callback (public by necessity). |
| POST | `/xero/callback` | `platform.admin` | 200 | 403 | 401 |  |
| GET | `/xero/status` | `platform.admin` | 200 | 403 | 401 |  |
| POST | `/xero/disconnect` | `platform.admin` | 200 | 403 | 401 |  |
| POST | `/xero/contacts/:clientId/sync` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/xero/contacts/sync-all` | `directory.admin` | 200 | 403 | 401 |  |
| POST | `/xero/invoices/from-progress-claim/:claimId` | `finance.admin` | 200 | 403 | 401 |  |
| GET | `/xero/sync-logs` | `platform.admin` | 200 | 403 | 401 |  |

## Live assertion coverage (`permission-matrix.spec.ts`)

| Route group | Rows asserted | Roles asserted |
|---|---|---|
| Tenders CRUD | 5 | admin (pass), viewer (200/403), anon (401) |
| Client quotes | 4 | admin, viewer, anon |
| Users admin (`/users` + `/admin/users`) | 5 | admin, viewer, anon |
| Roles / permissions admin | 4 | admin, viewer, anon |
| Master data writes | 4 | admin, viewer, anon |
| Archive | 2 | admin, viewer, anon |
| Long tail (one row per module × 20) | 20 | viewer (403/200), anon (401) |
| KNOWN-FAIL (global lists creation) | 2 | skipped — documented in pr-188-authz-findings.md |

Admin write assertions never mutate seeded data: POST rows send empty bodies (DTO validation rejects with 400
after the guards pass — all four top-level create DTOs have required fields), PATCH/DELETE rows target
non-existent ids (404 after the guards pass).

