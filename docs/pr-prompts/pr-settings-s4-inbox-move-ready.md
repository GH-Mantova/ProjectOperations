---
premise: '! test -f apps/web/src/pages/InboxPage.tsx'
premise_means: The Notifications inbox has not yet been moved out to a top-level /inbox page, so SLICE 4 has not landed.
scope:
  - apps/web/src/**
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && test -f apps/web/src/pages/InboxPage.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 922
---

# Settings restructure SLICE 4 — Move Notifications inbox out to /inbox; wire topbar bell

## Premise
Per `docs/plans/settings-restructure-plan.md` §3 SLICE 4 (+ §2 target IA, §4 redirect map, §5.1 e2e).
SLICE 3 (#922, Settings visible + per-item gates) is merged. The `/settings/notifications` route today
renders the Notifications *inbox* (766-line follow-up-triage page) — a triage inbox, not a settings
screen. This slice moves that inbox OUT to a new top-level `/inbox` and retargets the topbar bell to it.
This FREES `/settings/notifications` so SLICE 5 can put the real Notification-preferences screen there.
NO behaviour change to the inbox internals. No schema, no API, no new features.

## Binding spec — READ IT
Read `docs/plans/settings-restructure-plan.md` on main (UTF-16): §3 SLICE 4 (file list), §2 (the
"Moved OUT of Settings → Notifications inbox → new top-level /inbox" note), §4 redirect map, §5.1 (e2e
specs asserting the old bell target/label). Implement exactly to §3 SLICE 4.

## What to build (~5 files)

### 1. Rename the page
Rename `apps/web/src/pages/NotificationsPage.tsx` → `apps/web/src/pages/InboxPage.tsx`. Rename the
exported component to `InboxPage` (update its internal display name / any self-references). This is a
MOVE ONLY — do NOT refactor the inbox internals (SharedFollowUpItem shapes, ACK/WATCH state, urgency
labels all stay byte-for-byte). Update every import of the old path/name across the app.

### 2. Routes in App.tsx
- Add a new top-level route `/inbox` rendering `InboxPage`.
- Convert `/notifications` and `/settings/notifications` to `Navigate` REDIRECTS to `/inbox` (replace),
  per the §4 redirect map. Keep the redirects (do not delete the old paths) so bookmarks/links resolve.

### 3. Topbar bell
In `apps/web/src/components/ShellLayout.tsx` retarget the topbar notification bell to `/inbox` (it
currently points at the notifications route). Label/aria unchanged unless the plan says otherwise.

### 4. e2e updates (§5.1)
Update `tests/e2e/pr-acceptance/batch1-auth-shell.spec.ts` (and any other spec that hard-asserts the old
bell target `/notifications` or `/settings/notifications`, or the inbox living under Settings) to assert
the bell now routes to `/inbox`. List every spec + assertion you changed in the PR body.

## Do NOT
- Do NOT refactor the inbox internals, add features, or change its data/queries (move only).
- Do NOT add the Notification-preferences screen (that is SLICE 5) — just FREE the /settings/notifications
  route via the redirect.
- Do NOT change schema/API/`/sot/`. Do NOT touch Azure/Entra/SharePoint. Do NOT pull other slices' work.
- Do NOT remove the old routes outright — they become Navigate redirects (§4 redirect map).

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does not mean "wait for approval
> before starting". There is no human in this run — finishing then asking permission = failing.

## Guardrails
- One attempt. If `apps/web/src/pages/InboxPage.tsx` already exists on main, say `NO-OP`.
- Never ask a question or "stand by". Read the CI job log before diagnosing a failure.
- `pnpm --filter @project-ops/web build` + `pnpm --filter @project-ops/web lint` must pass, and the web
  vitest suite must be green. Update every nav/e2e assertion this move invalidates; list them in the PR
  body (§5.1). The inbox must render identically at /inbox as it did at /settings/notifications.
