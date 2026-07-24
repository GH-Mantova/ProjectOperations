---
premise: 'grep -lqE "window\.(confirm|alert|prompt)" apps/web/src/pages/projects/GanttChart.tsx apps/web/src/pages/projects/ProjectDetailPage.tsx apps/web/src/pages/scheduler/SchedulerGridPage.tsx apps/web/src/pages/workers/QualificationsSection.tsx apps/web/src/pages/workers/WorkerDetailPage.tsx'
premise_means: The projects, scheduler and workers pages still call native window.confirm/alert/prompt.
scope:
  - apps/web/src/pages/projects/**
  - apps/web/src/pages/scheduler/**
  - apps/web/src/pages/workers/**
done_when: pnpm build && pnpm lint && test -z "$(grep -lE 'window\.(confirm|alert|prompt)' apps/web/src/pages/projects/GanttChart.tsx apps/web/src/pages/projects/ProjectDetailPage.tsx apps/web/src/pages/scheduler/SchedulerGridPage.tsx apps/web/src/pages/workers/QualificationsSection.tsx apps/web/src/pages/workers/WorkerDetailPage.tsx)"
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# Migrate native dialogs -> useConfirm (projects + scheduler + workers)

**GATED: arm this only AFTER `pr-dialogs-foundation` has merged to main.**
Do not rename to `-ready` until `grep -rq "useConfirm" apps/web/src` returns true on main.

Replace every `window.confirm` / `window.alert` / `window.prompt` in these 5 files with the shared
`useConfirm()` hook (danger variant for destructive confirms; `alert({title,message})` for alerts).
Mechanical swap, preserve existing behaviour and messages.

## Do NOT
- Do NOT touch files outside this list.
- Do NOT change dialog wording or the actions guarded.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- say `NO-OP: <reason>` if already migrated.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.
