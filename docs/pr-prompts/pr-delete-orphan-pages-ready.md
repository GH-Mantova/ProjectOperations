---
premise: test -f apps/web/src/pages/tendering/TenderingReportsPage.tsx
premise_means: The orphaned duplicate report page (and the other Marco-condemned orphans) still exist on main.
scope:
  - apps/web/src/pages/tendering/TenderingReportsPage.tsx
  - apps/web/src/pages/ResourcesPage.tsx
  - apps/web/src/pages/surveys/**
  - apps/web/src/App.tsx
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/dashboards/widgets/surveys.tsx
  - tests/e2e/pr-acceptance/**
done_when: pnpm build && pnpm lint && ! test -f apps/web/src/pages/tendering/TenderingReportsPage.tsx
size: 9
gate_allow: none
seed_only: false
escalates: false
---

# Delete the condemned orphan pages (Marco-ruled 2026-08-03)

Rulings: DELETE `/tenders/reports` (orphaned duplicate of /reports), `/resources` (legacy
Workers page whose content renders inside /workers tabs), and both `/surveys/*` pages
(unstyled — they target CSS classes that don't exist — and unreachable).

## What to build

1. **/tenders/reports:** delete route + `TenderingReportsPage.tsx`; simplify the Tenders nav
   match rule (drop the /tenders/reports exclusion); remove its BREADCRUMBS entry; sweep
   `grep -rn "tenders/reports" apps/web/src tests/e2e` and retarget/remove.
2. **/resources:** PARITY CHECK FIRST — diff ResourcesPage's standalone rendering against
   what /workers tabs render via the same component. The component itself is REUSED by
   WorkersListPage — delete only the standalone ROUTE + the "Workers (legacy)" breadcrumb,
   NOT the component file, unless you prove the standalone page is the only consumer of some
   code path (state findings in the PR body). Retarget the batch5 spec asserting
   "Workers strip navigates to /resources" and the master-data-tab-helpers legacy deep-link.
3. **/surveys:** delete both routes + `SurveyCaptureFormPage.tsx` +
   `ClientSatisfactionPage.tsx`; update `dashboards/widgets/surveys.tsx` (its link targets a
   deleted page — either remove the link or the widget's CTA; keep the widget's data display
   if it renders survey stats; state the choice). Sweep remaining references. The surveys
   API stays (data collection may return re-specced later).
4. Remove any BREADCRUMBS/CommandPalette/search-emitter references to all deleted routes.

## Do NOT
- Do NOT touch the surveys API module, /reports, or /workers.
- Do NOT delete shared components consumed elsewhere — routes and page shells only.

## VERIFY
- `pnpm build && pnpm lint`; deleted files absent; `grep -rn "tenders/reports\|/resources\"\|surveys/capture" apps/web/src` clean.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
