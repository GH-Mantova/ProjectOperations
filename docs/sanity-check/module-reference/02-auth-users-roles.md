# 2. Auth / Users / Roles / Permissions / Audit

## Purpose

Authentication (local JWT + Microsoft 365 SSO) and the full RBAC stack:
users, roles, permissions, audit. Marco's admin domain — he creates
users, assigns roles, and audits actions. Compliance gate for nearly
every other module.

## Surface area

**Routes (frontend):**
- `/login` — dark full-screen background, centred card, conditional
  Microsoft SSO button (PR #13)
- `/users` — `UsersPage`
- `/roles` — `RolesPage`
- `/permissions` — `PermissionsPage`
- `/admin/*` — admin sub-routes (under `pages/admin/`)
- `/account` — current user's settings (under `pages/account/`)
- `/admin/audit` — audit log viewer (`AuditLogsPage`)
- `/admin/ai-settings` — AI Settings tab (Company + My Settings)

**API endpoints (key):**
- `POST /api/v1/auth/login` — local JWT
- `POST /api/v1/auth/sso` — M365 SSO with auto-provision
- `POST /api/v1/auth/entra` — legacy SSO endpoint
- `POST /api/v1/auth/refresh` — access-token rotation
- `GET/POST/PATCH/DELETE /api/v1/users` — CRUD
- `POST /api/v1/users/:id/reset-password` — admin reset (PR #301)
- `GET /api/v1/roles`, `GET /api/v1/permissions`
- `GET /api/v1/audit` — paginated audit log

**DB entities:**
- `User` (+ `ssoOnly`, `forcePasswordReset`, `isSuperUser` flags)
- `UserRole`, `Role`, `RolePermission`, `Permission`
- `RefreshToken`
- `AuditLog`

## What should work (functional checklist)

- [ ] Local login with `admin@projectops.local` / `Password123!` succeeds
- [ ] Bad password returns a clean error message — no stack trace, no
      info leak
- [ ] Refresh token rotation: stay idle past access TTL, next call
      transparently refreshes
- [ ] Sign out clears both tokens and bounces to /login
- [ ] M365 SSO button only renders when `VITE_SSO_ENABLED=true`
- [ ] M365 SSO flow auto-provisions a new user with `ssoOnly=true` and an
      empty password hash (blocks local login for that user) — see PR #8
- [ ] Admin can create a user with first/last/email/role assignments
- [ ] Admin reset password — clicking it generates a temporary password,
      sets `forcePasswordReset=true`, audit log entry written (PR #301)
- [ ] On next login, that user is forced through a password change
- [ ] Roles page lists all roles with their permission counts
- [ ] Permissions page lists every permission (scoped: `tenders.view`,
      `ai.persona.tendering`, `directory.finance`, etc.)
- [ ] Editing a role updates permission membership immediately
- [ ] Audit log page filters by actor, action, entity type, date range
- [ ] Audit log entries include actor + action + entity + timestamp +
      diff payload where applicable
- [ ] Super User tier bypasses individual permission checks but still
      gets audit-logged
- [ ] Role-gated sidebar items hide for users without the relevant
      permission (Field worker shouldn't see Admin section)
- [ ] AI Settings — Company tab visible only to Sean / Super User
- [ ] AI Settings — My Settings tab available to any user with
      `ai.persona.tendering` permission

## Recent PRs that shaped it (last ~100 merged)

- #2 — Auth foundations (S2 CI/CD)
- #8 — M365 SSO improvement chain
- #13 — Login page redesign (dark full-screen, conditional SSO button)
- #84 — Portal auth security hotfix (token isolation)
- #87 — Availability + GPS hardening (actor scope, self-approval block,
  audit trail)
- #117 — Persona registry foundation (added `ai.persona.<name>`
  permission convention)
- #118 — Persona controller slug-driven permission check
- #134 — BYOK encryption + Company key UI
- #136 — Conversation persistence (per user / persona / sub-mode)
- #291 — Admin reset-password endpoint scaffold (backend only)
- #301 — Admin reset password complete (UI + integration tests + audit
  verification) — **functional / fully shipped**

Test-only:
- Various JSDoc passes (#45, #57) — doc-only, no UI

## What to watch for during sanity check

- **Admin reset-password** — PR #301 is recent and full-stack. Verify:
  modal opens, generates a temporary password, copy-to-clipboard works,
  audit log gains the entry, the target user is forced through password
  reset on next login.
- **Refresh token rotation** — silent token refresh is the gold-standard
  UX. If you see surprise re-login prompts, log it.
- **SSO env vars absence** — when `VITE_SSO_ENABLED=false`, the SSO
  button must NOT render. When true but `VITE_ENTRA_CLIENT_ID` is empty,
  it should render but fail gracefully (clear error, not a white screen).
- **Persona permission gating** — `ai.persona.tendering` is the canonical
  pattern. Users without it should not see the floating bubble at all.
- **Audit log completeness** — every write-side action should appear.
  Spot-check after create/update/delete on a couple of entities; if any
  module isn't audit-logged that's a finding.
- **Super User behaviour** — should bypass permission checks but still
  produce audit log entries with a `super_user_override: true` flag (if
  not, that's an audit gap).
- **Force-password-reset bypass** — try to navigate around the forced
  reset on first login; user shouldn't be able to use the app until they
  change.

## Edge cases worth probing

- **Disabled user login attempt** — should return a clean "account
  inactive" message, not a generic 401
- **SSO-only user trying local login** — empty password hash should
  cleanly reject without revealing that the account exists
- **Permission revoked mid-session** — admin revokes a role's permission
  while a user has the page open; next API call should 403 cleanly
- **Audit log with 10,000+ rows** — pagination should work, filters
  shouldn't time out
- **Audit log filter by date** — verify the date filter precision
  (lesson-learned `2026-05-17-migration-date-filter-precision.md` —
  end-of-day boundary)
- **Mobile width** — login page must work on a phone; admin pages can
  degrade more aggressively
- **Concurrent admin edits** — two admins editing the same user; last
  write wins is acceptable but data must not corrupt
- **Audit log entry for failed login** — should we log failures? Verify
  current behaviour (audit `login_failed` actions for brute-force
  visibility)
