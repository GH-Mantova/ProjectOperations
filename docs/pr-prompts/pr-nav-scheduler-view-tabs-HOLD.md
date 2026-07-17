---
premise: grep -q "/scheduler/grid" apps/web/src/App.tsx
premise_means: Scheduler still has separate top-level routes (grid, availability-report) instead of view tabs in one page.
scope:
  - apps/web/src/**
done_when: pnpm build && pnpm lint && ! grep -q "/scheduler/grid" apps/web/src/App.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
---

# Scheduler: one page with Board / Grid / Availability view tabs

Per Marco 2026-07-17: collapse `/scheduler`, `/scheduler/grid`, `/scheduler/availability-report`
into ONE Scheduler page with view tabs (Board | Grid | Availability). Keep the old paths working as
redirects to `/scheduler?view=grid` / `?view=availability`.

Also: the "Calendar sync" item (`/account/calendar-sync`) is a personal setting, not a scheduler
view — remove it from the Operations/Scheduler nav cluster and surface it under Settings > Personal.
The route `/account/calendar-sync` stays; only its nav placement changes.

## Do NOT
- Do NOT change scheduling business logic or the allocation API. This is a view-consolidation PR.
- Do NOT touch the FIELD (mobile) nav.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
Finishing the work and then asking for permission is indistinguishable from failing.

## Guardrails
One attempt. Never exit silently (`NO-OP: <reason>`). Never ask or stand by. `pnpm build` +
`pnpm lint` must pass. Read the CI job log before diagnosing any failure.
