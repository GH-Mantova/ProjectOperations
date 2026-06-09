# X4. Admin Settings

## Purpose

The admin control surface — user management, role / permission management,
audit log, AI settings (Company + My Settings), email provider config,
rates admin, global lists. Sean owns Company AI; Marco owns Compliance
and security; admin role owns user / role / permission CRUD.

## Surface area

**Routes (frontend):**
- `/admin` — admin landing (under `pages/admin/`)
- `/admin/users` (`UsersPage`)
- `/admin/roles` (`RolesPage`)
- `/admin/permissions` (`PermissionsPage`)
- `/admin/audit` (`AuditLogsPage`)
- `/admin/ai-settings` — AI Settings (Company + My Settings)
- `/admin/rates` (`EstimateRatesAdminPage`)
- `/admin/global-lists`
- `/admin/email` — email provider config (PR #57)
- `/admin/settings` — `AdminSettingsPage`
- `/account` — current user settings (under `pages/account/`)

**API endpoints (key):**
- Users / Roles / Permissions / Audit — covered in Module 2
- `GET/POST/DELETE /api/v1/admin-settings/email`
- `POST /api/v1/admin-settings/email/test` — send test email
- `GET/POST/DELETE /api/v1/ai-settings/company/*`
- `GET/POST/DELETE /api/v1/ai-settings/my/*`
- `GET/POST/DELETE /api/v1/estimate-rates/*`
- `GET/POST/DELETE /api/v1/global-lists`

**DB entities:**
- `EmailProviderConfig`
- `PlatformConfig` (singleton — model overrides, default models)
- `User`, `Role`, `Permission`, `RolePermission`, `AuditLog`

## What should work (functional checklist)

### Email provider (PR #57)
- [ ] Configure Outlook / Azure Mail provider (PR #51 Azure Mail
      adapter, PR #292 categorised errors)
- [ ] AZURE_MAIL_TENANT_ID, _CLIENT_ID, _CLIENT_SECRET, _FROM env vars
      drive live mode
- [ ] Test email button sends and reports success / categorised error
- [ ] Audit log on every email send (provider, recipient, subject,
      status)
- [ ] Outlook email sanitiser doesn't leak provider error text
      (PR #61 CodeQL)

### AI Settings (PR #134, see X1)
- [ ] Company tab (Sean only)
- [ ] My Settings tab (every user with persona permission)
- [ ] BYOK encryption at rest (AES-256-GCM, BYOK_ENCRYPTION_KEY env)
- [ ] Audit log on key save/delete/use (never logs the key itself)
- [ ] Per-persona configuration UI
- [ ] Global "allow user instruction overrides" toggle

### Rates admin (covers all 8 rate types)
- [ ] CRUD on cutting / core hole / labour / plant / waste / fuel /
      enclosure / other rates
- [ ] Cutting matrix: Floor / Wall × Equipment × Material × Depth
- [ ] Toggle isActive — affects `lookup_rate` tool visibility
- [ ] Density list with 29+ rows (PR #244 expansion)
- [ ] CenteredModal usage (PR #300 sweep)

### Global lists
- [ ] Status enums, dropdown values, discipline codes
- [ ] Edit with version preservation
- [ ] Lists used consistently across modules

### Audit log
- [ ] Filterable by actor, action, entity, date
- [ ] Date filter precision (lessons-learned
      2026-05-17-migration-date-filter-precision — end-of-day boundary)
- [ ] CSV export
- [ ] Pagination

### Users / Roles / Permissions
- Covered in Module 2

### Account (current user)
- [ ] My Profile
- [ ] Change password
- [ ] My Settings (AI persona)
- [ ] No "AI providers" section (removed in PR #132 — legacy
      UserAiProvidersService deletion)

## Recent PRs that shaped it (last ~100 merged)

- #57 — Admin settings email
- #44 — Scope of works tab (not admin, but date)
- #51 — Azure Mail.Send adapter (PR #51, mail backend)
- #54 — Outlook email categorised errors (PR #292 / #54)
- #61 — CodeQL fix Outlook sanitiser
- #62 — Quote system redesign (not admin)
- #134 — BYOK encryption + Company key UI — **functional**
- #138 — AI provider three-tier fallback
- #139 — Drop 8 dead PlatformConfig columns
- #142 — Drawing tools
- #149 — lookup_rate binding + rate-fabrication prohibition
- #161 — Rate-fabrication override precedence hardening
- #214 — lookup_rate all 8 rate types (admin: rates admin already has
  all 8)
- #244 — Material density seed expansion
- #291 — Admin reset-password endpoint scaffold
- #292 — OutlookEmailProvider categorised errors + AZURE_MAIL_* env
- #295 — Roadmap + progress catchup
- #297 — JSDoc directory module
- #298 — FormsService unit tests
- #300 — CenteredModal sweep 24 modals (UX)
- #301 — Admin reset password complete — **functional**

## What to watch for during sanity check

- **Admin reset password (PR #301)** — modal opens, temporary password
  generated, audit log entry, force-reset on next login (see Module 2)
- **Email test send** — categorised error if provider misconfigured
  (PR #292)
- **AI Settings encryption** — keys never appear in logs / audit / UI
  after save; only metadata (provider, source, userId)
- **Rates admin isActive** — deactivating a rate should make
  `lookup_rate` no longer surface it (cross-check with X1 persona)
- **Density list (PR #244)** — verify dual-unit sheet variants render
- **CenteredModal consistency (PR #300)** — every modal here uses the
  shared component; backdrop click, Esc, × all consistent
- **Global lists** — discipline codes are 4-code DEM/CIV/ASB/Other only;
  no SO/Str/Prv leaks (PR A1)
- **Account "AI providers" section absence** — PR #132 deleted it; verify
  it's not reappeared

## Edge cases worth probing

- **Save BYOK key with whitespace** — trim, validate
- **Test email to bad address** — categorised error, not raw provider
  output
- **Deactivate last labour rate** — what happens to estimates that
  reference it? (rates are line-item owned per PR #148 CHECK 0.5)
- **Audit log filter spanning a month** — performance
- **Two admins editing same role** — last write wins + audit
- **Mobile width** — admin pages can degrade more aggressively, but no
  data loss
- **Permission revoked mid-session on the editor** — next API call 403s
  cleanly
- **Concurrent rate edit** — last write wins; what does the persona
  smoke see?
- **PlatformConfig model override (PHASE 6 ⏸️)** — *_model columns
  retained but unused (NULL for all 4 providers); decision pending
- **Delete a role with users assigned** — should block or reassign
