---
premise: grep -q "to=\"/notifications\"" apps/web/src/layouts/FieldLayout.tsx
premise_means: The field bell still ejects field workers into the desktop shell with no route back.
scope:
  - apps/web/src/layouts/FieldLayout.tsx
  - apps/web/src/pages/field/FieldNotificationsPage.tsx
  - apps/web/src/App.tsx
done_when: pnpm build && pnpm lint && ! grep -q "to=\"/notifications\"" apps/web/src/layouts/FieldLayout.tsx
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# Field-native notifications list (Marco 2026-08-03) — the bell stops ejecting field users

Audit finding: `FieldLayout.tsx:93` bell -> `/notifications` -> redirect ->
`/settings/notifications` inside the DESKTOP ShellLayout, outside OfflineProvider, with zero
routes back to /field/*. Marco's ruling: a small field-native notifications screen inside
FieldLayout.

## What to build

1. New `apps/web/src/pages/field/FieldNotificationsPage.tsx`: a mobile-styled, read-focused
   list of the user's notifications — reuse the same data source the desktop dropdown uses
   (`/notifications/me`; ground it in NotificationsDropdown.tsx). Mark-as-read on tap;
   follow each notification's `linkUrl` ONLY if it targets a /field/* route — otherwise show
   the content inline (never navigate a field user into the desktop shell). Match
   FieldLayout's existing visual language (its token constants), 44px+ touch targets.
2. Route `/field/notifications` inside the FieldLayout children in App.tsx.
3. `FieldLayout.tsx`: bell -> `/field/notifications`; PAGE_TITLES entry "Notifications".
   Do NOT add it to the bottom NAV_ITEMS (bell is the entry point).
4. This is field UI, explicitly Marco-approved — the "FIELD nav untouched" rule is lifted
   for the bell target + this page only.

## Do NOT
- Do NOT touch the desktop NotificationsPage/inbox (Settings plan slice 4 owns that).
- Do NOT build preferences, triage actions, or offline queueing here.

## VERIFY
- `pnpm build && pnpm lint`; bell targets /field/notifications; page renders the list.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
