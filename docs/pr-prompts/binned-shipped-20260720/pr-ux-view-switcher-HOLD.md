---
premise: '! grep -rqi "ViewSwitcher" apps/web/src 2>/dev/null'
premise_means: Lists cannot switch between grid/kanban/calendar/map/gantt view types.
scope:
  - apps/web/src/components/**
  - apps/web/src/pages/**
done_when: pnpm build && pnpm lint && grep -rqi "ViewSwitcher" apps/web/src
size: 8
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | UX-parity (D365 interchangeable view types) | MVP framework + one list -->
# HOLD — UX: interchangeable view switcher (MVP)

STATUS: DRAFTED, STAGED, arm-eligible. D365 parity: the same list rendered as grid / kanban / calendar
/ map / gantt via a view-type toggle. We already have kanban (tenders), gantt (projects), and a map is
coming — this MVP adds the reusable **switcher framework** and applies it to ONE list.

## What to build
Branch: `feat/ux-view-switcher`. Reviewer: `GH-Mantova`. No migration.
1. A reusable `<ViewSwitcher>` component + a small view-type registry (grid, kanban, calendar, map,
   gantt) so a list page declares which view types it supports and the user toggles between them;
   remember the choice per list (localStorage or SavedView if present).
2. Apply it to ONE reference list that benefits (e.g. Jobs: grid ↔ kanban ↔ calendar), reusing the
   existing kanban/gantt/calendar building blocks — do NOT rebuild them.

## Do NOT
- Do NOT rebuild the existing kanban/gantt/map components — compose them. Do NOT wire every list in the
  MVP (one). Do NOT touch Azure/prod. If >10 files, split and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
