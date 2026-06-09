# X2. Portal (Client-facing)

## Purpose

Read-only-ish window for IS clients to see their own tenders, quotes,
contracts, progress claims, and documents. Separate JWT auth (type:
`client_portal`), invite-only. Hardened in PR #83.1 / #84 after audit #2
findings.

Subcontractor portal (`/portal/sub`) is in Phase 7 — not built yet, so
NOT in scope for this sanity check.

## Surface area

**Routes (frontend):**
- `/portal/client` — portal home / login
- `/portal/client/tenders` — client's tenders
- `/portal/client/quotes` — client's quotes
- `/portal/client/contracts` — client's contracts
- `/portal/client/claims` — progress claims
- `/portal/client/documents` — shared documents
- 6 portal pages total per PR #83

**API endpoints (key):**
- `POST /api/v1/portal/auth/login` — portal-scoped JWT
- `POST /api/v1/portal/auth/invite/accept` — invite flow
- `POST /api/v1/portal/auth/reset-password`
- `GET /api/v1/portal/me`
- `GET /api/v1/portal/tenders` (scoped to client)
- `GET /api/v1/portal/quotes` (scoped to client)
- `GET /api/v1/portal/contracts` (scoped to client)
- `GET /api/v1/portal/claims`
- `GET /api/v1/portal/documents`

**DB entities:**
- `PortalUser` (separate from `User`) — type `client_portal`
- `ClientPortalInvite`

## What should work (functional checklist)

### Auth
- [ ] Portal login uses separate JWT — does NOT share session with
      admin app (PR #83.1 / #84 token isolation)
- [ ] Portal token has type `client_portal` claim
- [ ] Admin user can't authenticate as portal user (vice versa)
- [ ] Invite flow: IS admin → invite email → portal user accepts →
      sets password
- [ ] Password reset works
- [ ] Audit log on every portal login

### Data scoping
- [ ] Portal user sees ONLY their own client's records
- [ ] Cannot enumerate other clients' tenders by ID guessing
- [ ] No path leaks (try `/api/v1/tenders/{otherClientTenderId}` should
      403 not 404)

### Read flows
- [ ] Tenders list shows only this client's tenders
- [ ] Quote view (read-only) with PDF download
- [ ] Contract view (read-only)
- [ ] Progress claims with status (Draft / Sent / Paid)
- [ ] Documents shared (client-permitted only)

### Write flows
- [ ] Accept / reject quote (if that's part of portal — verify)
- [ ] Upload documents (if permitted)
- [ ] Send message (if comms integration done)

## Recent PRs that shaped it (last ~100 merged)

- #83 — Client portal — separate JWT, scoped data API, invite flow,
  6 portal pages — **functional / big**
- #84 / PR #83.1 — Portal auth security hotfix (token isolation,
  password reset, Gantt scope) — **functional / security**

Audit #2 hardening followed PR #83.

## What to watch for during sanity check

- **Token isolation (PR #83.1)** — sign in to admin app and portal in
  two tabs; verify no cross-contamination. Sign out of one shouldn't
  sign out of the other.
- **Data scoping** — log in as a portal user for Client A, try to fetch
  Client B's tender by direct API call. Must 403.
- **Invite flow** — admin invites, email sent (verify in mock email
  provider), portal user accepts, sets password, can log in.
- **Read-only enforcement** — try to PATCH a tender via portal token;
  should 403.
- **Gantt scope (PR #83.1)** — portal users shouldn't see internal
  scheduling Gantt; verify the scoping fix.
- **PDF download** — quote PDF downloads cleanly (PR #105 watermark +
  register header).

## Edge cases worth probing

- **Portal user account disabled** — clean error on login
- **Expired portal token** — refresh or re-auth?
- **Mobile width** — portal users WILL use phones; should be solid
- **Multiple clients on one portal user** — supported? Test
- **Concurrent admin edit while portal user views** — portal user sees
  fresh data on next refresh
- **Portal user trying to access admin URL** — clean redirect or 403
- **Permission gates on documents** — only documents marked
  `clientVisible: true` (or equivalent) surface to portal
- **Subcontractor portal (PHASE 7 ⏸️)** — not built; verify no /portal/sub
  routes leak
