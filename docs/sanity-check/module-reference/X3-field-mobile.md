# X3. Field / Mobile

## Purpose

Field worker experience — mobile shell for allocation visibility, pre-
start checklists, timesheet capture + approval, GPS clock-on, safety
forms. PWA-installable with offline support (IndexedDB outbox, auto-sync).

Below 768px the entire app collapses to a bottom tab bar; FieldLayout
adds a more field-specific shell on top.

## Surface area

**Routes (frontend):**
- `/field` — field worker shell entry (under `pages/field/`)
- `/field/allocations` — assigned shifts
- `/field/timesheets` — timesheet capture
- `/field/safety` — IS-INC / IS-HAZ entry
- `/field/forms` — assigned forms to fill
- `/safety` — incident / hazard create (under `pages/safety/`)
- `/timesheets` — timesheet workspace (under `pages/timesheets/`)

**API endpoints (key):**
- `GET/POST/PATCH /api/v1/field/allocations` (PR #41)
- `GET/POST/PATCH /api/v1/field/timesheets`
- `POST /api/v1/field/timesheets/:id/clock-on` — GPS optional (PR #85)
- `POST /api/v1/field/pre-start/:allocationId`
- `POST /api/v1/safety/incidents`, `POST /api/v1/safety/hazards`

**DB entities:**
- `Allocation`, `Shift` (shared with Scheduler)
- `Timesheet` (approver, rejecter workflow)
- `PreStartChecklist`
- `IncidentReport`, `HazardObservation`
- `GpsLocationLog` (90-day auto-delete per Phase 2)

## What should work (functional checklist)

### Mobile shell
- [ ] Below 768px: sidebar collapses to bottom tab bar
- [ ] FieldLayout on field routes — simplified nav
- [ ] All touch targets ≥ 44×44px (per CLAUDE.md design tokens)
- [ ] No horizontal scroll at 375px
- [ ] Top bar shrinks but stays usable

### Allocations
- [ ] Field worker sees only their own shifts (today + upcoming)
- [ ] Click → allocation detail
- [ ] Pre-start checklist available before shift starts
- [ ] Clock-on starts the shift

### Timesheets
- [ ] Daily capture with start / end / break
- [ ] Save draft (backend draft per PHASE 6 — not IDB)
- [ ] Submit triggers approval workflow (PR #42)
- [ ] Supervisor sees pending approvals
- [ ] Approved timesheets → CSV export to payroll (PR #274)

### GPS clock-on (PR #85, hardened PR #87)
- [ ] Opt-in consent flow
- [ ] Captures location at clock-on only (not continuous tracking)
- [ ] 90-day auto-delete (per Phase 2)
- [ ] Self-approval blocked (PR #87)
- [ ] Audit trail for every clock event

### Safety forms
- [ ] IS-INC + IS-HAZ render on mobile + desktop (PR #81)
- [ ] Notifications to Marco on submit
- [ ] Photo upload from camera
- [ ] Submit even if offline (queued for sync)

### PWA / offline (PR #89, polish PR #108)
- [ ] Install prompt appears on iOS / Android browsers
- [ ] Service worker registers
- [ ] IndexedDB outbox queues writes when offline
- [ ] Auto-sync on reconnect
- [ ] Dead-letter UX for irrecoverable failures (PR #108)
- [ ] OfflineProvider scope correct (PR #108)
- [ ] Service worker autoUpdate race fixed (PR #108)
- [ ] NetworkFirst 24h cache (PHASE 6 known risk on shared devices)

### Form drafts (PR #111)
- [ ] IndexedDB persistence for 6 Phase-1 forms
- [ ] DraftBanner / SaveDraftButton wired
- [ ] Auto-save on backgrounding

## Recent PRs that shaped it (last ~100 merged)

- #41 — Field worker experience — **functional / foundational**
- #42 — Timesheet approval
- #81 — Safety forms — **functional**
- #85 — GPS clock-on — **functional**
- #87 — Availability + GPS hardening (self-approval block, audit) —
  **functional / security**
- #89 — PWA / offline (service worker, outbox, sync, install prompt) —
  **functional / big**
- #91 — Audit #4 criticals (PWA icons, env documentation)
- #100 — Forms fill UI: mobile-first (also covers field surface)
- #108 — PWA OfflineProvider scope, SW autoUpdate race, dead-letter UX —
  **functional**
- #111 — Form drafts (IndexedDB) — **functional**

## What to watch for during sanity check

- **iPad / iPhone install** — install prompt actually fires on iOS Safari
  (notoriously finicky)
- **OfflineProvider scope (PR #108)** — verify the provider wraps the
  right subtree (not double-mounted, not missing on some routes)
- **Service worker autoUpdate race (PR #108)** — install old version,
  deploy new version, verify upgrade UX
- **NetworkFirst 24h cache risk** — shared devices showing stale data
  for a different user
- **GPS consent flow** — clean revoke flow; user can disable later
- **Self-approval block** — supervisor can't approve own timesheet /
  leave
- **Touch targets ≥ 44×44px** — measure with DevTools on suspect buttons
- **Bottom tab bar** — visible below 768px, accessible, doesn't overlap
  content
- **44×44 + safe-area-inset-bottom on iOS** — bottom tab bar shouldn't
  hide behind the iOS home indicator
- **Camera permission** — graceful denied state for safety form photos
- **Offline submit (form / timesheet)** — verify outbox queues, syncs
  automatically when network returns

## Edge cases worth probing

- **375px width** — primary target; nothing should overflow
- **iPad portrait + landscape** — both work
- **Offline for 24+ hours** — outbox grows; sync handles backlog
- **Outbox failure (e.g. validation error server-side)** — dead-letter
  UX surfaces, user can retry / inspect
- **Camera unavailable** — fallback to file picker
- **GPS denied by browser** — clock-on still works, no GPS logged
- **Concurrent timesheet edit on multiple devices** — last write wins
- **Permission revoked while offline** — sync fails cleanly, dead-letter
- **App backgrounded mid-form** — auto-save on background fires (PR #111)
- **Worker offline allocated to a job in the future** — display correct
  even without server
- **Service worker stale across deploy** — see PR #108 dead-letter UX
- **44×44 violations on dense lists** — every clickable element
