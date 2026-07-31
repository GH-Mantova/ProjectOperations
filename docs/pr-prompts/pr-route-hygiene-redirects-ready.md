---
premise: grep -q "path=\"/archive\" element={<ArchivePage" apps/web/src/App.tsx
premise_means: The legacy /archive route still renders a live orphan duplicate of the Documents Archived tab instead of redirecting like every other consolidation.
scope:
  - apps/web/src/App.tsx
  - apps/web/src/pages/sites/MusterPage.tsx
  - apps/web/src/pages/scheduler/SchedulerHomePage.tsx
  - apps/web/src/components/NotificationsDropdown.tsx
  - apps/web/src/pages/account/UserProfilePage.tsx
  - apps/web/src/pages/dashboards/GlobalDashboardPage.tsx
  - apps/web/src/personas/PersonaWindow.tsx
  - apps/web/src/pages/AdminSettingsPage.tsx
done_when: pnpm build && pnpm lint && ! grep -q "path=\"/archive\" element={<ArchivePage" apps/web/src/App.tsx
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# Route hygiene: orphan /archive redirect, query-preserving redirects, dead-end and double-hop fixes

All findings from the system audit 2026-07-31, verified on origin/main. Mechanical, no behaviour
redesign.

## What to build

1. **`/archive` → redirect.** `App.tsx` — replace the `/archive` list route with
   `<Navigate to="/documents?tab=archived" replace />` (mirroring the app's other
   consolidations). `/archive/:jobId` STAYS (linked from Job detail).
2. **Query-preserving redirects.** The `/directory/contacts`, `/directory/subcontractors` and
   `/tenders/clients|contacts` redirects are literal strings that drop inbound query params
   (QuickCreate's `?new=1`, search's `?highlight=`). Introduce one tiny redirect component that
   merges the current location.search into the target (keeping `tab` from the target), and use
   it for these. Same for `/account/calendar-sync`.
3. **Muster dead-end.** `MusterPage.tsx:202,225` — both back affordances are `navigate(-1)`,
   which strands deep-linked users (fresh tab = no history). Use the `siteId` route param
   (currently never read) for an explicit `Link` to `/sites/:siteId`; keep `navigate(-1)` only
   as a secondary affordance if history exists.
4. **Scheduler legacy segment swallow.** `SchedulerHomePage.tsx:15-18` — unknown
   `:legacyView` values currently render the Board at a bogus URL. Unknown segment → redirect to
   `/scheduler` (replace), so stale bookmarks land somewhere honest.
5. **Double-hop / raw-anchor links → direct targets:** `NotificationsDropdown.tsx:194`
   (`/notifications` → `/settings/notifications`), `UserProfilePage.tsx:35`
   (`/account/calendar-sync` → `/settings/calendar-sync`), `GlobalDashboardPage.tsx:123`
   (`/account` → `/settings/account`), `PersonaWindow.tsx:408` (`/admin/ai-settings` →
   `/settings/ai`), `AdminSettingsPage.tsx:103,112` (raw `<a href="/admin/platform">` full-reload
   → router `Link` to `/settings/administration/platform`; the :103 AI link is being retargeted
   by the queued AI-keys prompt — if already changed, leave it).
   DO NOT touch `FieldLayout.tsx:93` — the field bell destination is a Marco design decision.

## Do NOT

- Do NOT delete `ArchivePage`/`ArchiveDetailPage` components (the Archived tab renders them).
- Do NOT change FieldLayout, the mobile tab bar, or any nav entries.
- Do NOT implement `?new=1` / `?highlight=` consumption here (separate prompt).

## VERIFY

- `pnpm build && pnpm lint`
- `! grep -q "path=\"/archive\" element={<ArchivePage" apps/web/src/App.tsx`
- `grep -q "siteId" apps/web/src/pages/sites/MusterPage.tsx`
- `grep -rn "navigate(\"/notifications\")\|to=\"/notifications\"" apps/web/src/components/NotificationsDropdown.tsx` returns nothing.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
