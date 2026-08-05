---
premise: '! grep -q "model NotificationPreference" apps/api/prisma/schema.prisma'
premise_means: There is no per-user NotificationPreference model yet, so SLICE 5 (user notification preferences API + UI) has not landed.
scope:
  - apps/api/src/**
  - apps/api/prisma/**
  - apps/api/prisma/migrations/**
  - apps/web/src/**
  - tests/e2e/**
  - docs/data-model/**
done_when: pnpm build && grep -q "model NotificationPreference" apps/api/prisma/schema.prisma && test -f apps/web/src/pages/settings/NotificationPreferencesPage.tsx
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: 'Additive only: new NotificationPreference table + new module + a UI page + one route swap. Rollback = DROP TABLE notification_preferences and revert the web route to the /inbox redirect; no existing table/column altered.'
requires_merged:
  - 922
  - 927
---

# SLICE-5: User Notification Preferences — API + migration + UI (per-trigger x channel, mute-only)

## Premise
`docs/plans/settings-restructure-plan.md` §3 SLICE 5. Today notification routing is ADMIN-configured only:
`NotificationTriggerConfig` (per trigger: `isEnabled`, `deliveryMethod` in {both,email,inapp},
`recipientRoles[]`, `recipientUserIds[]`). There is NO per-user preference. This slice adds one, plus the
`/settings/notifications` UI to manage it. Marco's LOCKED design decisions (build to these EXACTLY):
- **Granularity: per-trigger x channel.** A user chooses email / in-app / both / off for EACH trigger they
  are eligible for. No stored row for a (user,trigger) = inherit the admin default.
- **Semantics: MUTE-ONLY / NARROW.** A user preference can only REDUCE channels, never add. Effective
  channels for a user+trigger = adminChannels INTERSECT userChannels. A user can never receive a channel
  the admin did not route to them, and can never become a recipient of a trigger they are not already
  eligible for (admin `recipientRoles`/`recipientUserIds` remain the eligibility gate).

## Binding spec — read it
`docs/plans/settings-restructure-plan.md` §3 SLICE 5. Verified against main:
- Prisma: `model NotificationTriggerConfig { trigger @unique, label, description, isEnabled,
  deliveryMethod ("both"|"email"|"inapp"), recipientRoles[], recipientUserIds[] }` and `model Notification`.
- Dispatch/routing lives in per-trigger senders — notably `apps/api/src/modules/compliance/compliance.service.ts`
  (resolves recipients via recipientUserIds/recipientRoles + uses deliveryMethod) and
  `apps/api/src/modules/platform/notifications.service.ts` (+ email.service.ts, scope-waste.service.ts touch triggers).
- Web: `App.tsx` currently has `<Route path="notifications" element={<Navigate to="/inbox" replace />} />`
  under `<SettingsShell />` (the SLICE-4 redirect); `SettingsShell.tsx` Personal item
  `{ to: "/settings/notifications", label: "Notifications" }`.

## What to build

### 5b — API + migration (apps/api)
1. **Prisma model** `NotificationPreference` in `apps/api/prisma/schema.prisma`:
   `id String @id @default(cuid())`, `userId String @map("user_id")` (relation to `User`, onDelete Cascade),
   `trigger String` (matches `NotificationTriggerConfig.trigger`), `channel String` (one of
   `both|email|inapp|off`), `createdAt`, `updatedAt`. `@@unique([userId, trigger])`, `@@map("notification_preferences")`.
   Add the back-relation field on `User`. NO change to any existing model/column.
2. **Migration** `apps/api/prisma/migrations/<YYYYMMDD>_notification_preferences/migration.sql`: `CREATE TABLE`
   only (additive; idempotent-safe). Follow the repo's existing migration conventions. Regenerate
   `docs/data-model/metadata-catalog.json` if the repo tracks it.
3. **Module** `apps/api/src/modules/notification-preferences/` (controller + service + DTOs), registered in the
   app module:
   - `GET /notification-preferences/me` → for the CALLER, list the triggers they are ELIGIBLE for (a trigger
     whose `isEnabled` is true AND the caller matches `recipientRoles` or `recipientUserIds`), each with:
     `trigger`, `label`, `description`, `adminDeliveryMethod`, the caller's stored `channel` (or null = inherit),
     and the computed `effectiveChannel`.
   - `PUT /notification-preferences/me/:trigger` (body `{ channel }`) → upsert the caller's preference for that
     trigger. Validate `channel` in {both,email,inapp,off}; validate the trigger exists and the caller is
     eligible for it (else 400/403). Setting `channel` to the admin default is allowed (still just narrows).
   - (Optional) `DELETE /notification-preferences/me/:trigger` → clear override (back to inherit).
4. **Narrowing helper — CENTRALISE IT.** Add ONE exported function/service method, e.g.
   `resolveEffectiveChannel(userId, trigger, adminDeliveryMethod): "both"|"email"|"inapp"|"off"` implementing the
   INTERSECTION rule: treat each of adminDeliveryMethod and the user's channel as a set over {email,inapp}
   (both = {email,inapp}, off = {}); effective = admin ∩ user; no stored pref = admin unchanged. Map the empty
   set back to "off". Call this helper at the per-recipient fan-out in the existing dispatch sites
   (compliance digests, platform notifications.service, email.service where a trigger's deliveryMethod is
   consulted) so a recipient's channel is narrowed by their preference. Do NOT change WHO is eligible — only
   which channel(s) each already-eligible recipient gets. If a dispatch site can't be cleanly reached, leave a
   clear `// TODO(SLICE-5): narrow via resolveEffectiveChannel` and note it in the PR body.
5. **Tests**: service unit tests for the intersection table (admin×user → effective, incl. off/empty and
   inherit); controller tests for eligibility validation + upsert; a dispatch test proving a muted user is
   dropped from the channel they muted while an un-preferenced user is unaffected.

### 5a — UI (apps/web)
6. **New page** `apps/web/src/pages/settings/NotificationPreferencesPage.tsx`: fetch `GET
   /notification-preferences/me`; render a list — one row per eligible trigger (label + description) with a
   channel control (both / email / in-app / off) showing the current effective/stored value; on change call
   `PUT .../me/:trigger`. Make clear in copy that this can only reduce what admins route to you (mute-only).
   Plain and functional — NO re-skin (SLICE 18/19).
7. **App.tsx**: change the SettingsShell child `path="notifications"` from the `<Navigate to="/inbox">` redirect
   to `element={<NotificationPreferencesPage />}`. Keep top-level `/notifications` and `/inbox` as they are
   (the Inbox stays at /inbox). Import the new page.
8. **SettingsShell.tsx**: relabel the Personal item `{ to: "/settings/notifications", label: "Notifications" }`
   → `label: "Notification preferences"`.
9. **E2E** `tests/e2e/pr-acceptance/batch1-auth-shell.spec.ts`: swap the assertion so `/settings/notifications`
   renders the preferences page (not a redirect to /inbox). Keep other assertions intact; keep tendering-e2e green.

## Do NOT
- Do NOT alter `NotificationTriggerConfig` or any existing model/column; this slice is purely additive.
- Do NOT let a user preference ADD channels or make a user a recipient of a trigger they aren't eligible for.
- Do NOT touch the Inbox (`InboxPage`/`/inbox`), Azure/Entra/SharePoint, /sot/, or read/print/rotate secrets.
- Do NOT re-skin. Do NOT pull in other slices.

## STANDING AUTHORITY
> You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
> This is a schema/escalates slice: OPEN the PR and LEAVE IT for Marco to review + merge. Do NOT self-merge.

## Guardrails
- `pnpm build` (incl. prisma generate + migration deploy in CI) and the API + web test suites must pass; keep
  tendering-e2e green. Read the CI job log before diagnosing any failure.
- Additive migration only — the rollback is DROP TABLE notification_preferences.
- Effective-channel semantics MUST be the intersection (mute-only). Cover it with the unit table tests above.
