---
premise: grep -q "path=\"/projects\"" apps/web/src/App.tsx
premise_means: /jobs and /projects are still separate surfaces; not yet merged into one "Jobs" list.
scope:
  - apps/web/src/**
done_when: pnpm build && pnpm lint && ! grep -q "path=\"/projects\"" apps/web/src/App.tsx
size: 8
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | GATED: arm ONLY after the Job/Project model merge (B-P0a, job-project-model-merge) has MERGED to main. Merging the UI before the model is merged will fight the split data model. -->

# Merge Jobs + Projects into one "Jobs" surface

Per Marco 2026-07-17: `/jobs` and `/projects` are the same concept duplicated. Merge them into ONE
surface labelled **"Jobs"** (Job is the canonical model). Redirect `/projects` -> `/jobs` and
`/projects/:id` -> `/jobs/:id`. One list, one detail page. Sites (`/sites`) stays separate.

**GATED:** this is do-not-arm until the Job/Project *model* merge (backlog B-P0a) has landed on main.
Arming the UI merge before the model merge will conflict with the still-split data model.

## Do NOT
- Do NOT arm this before the model merge has merged. Do NOT change the data model here (that is B-P0a).
- Do NOT touch the FIELD (mobile) nav.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
Finishing the work and then asking for permission is indistinguishable from failing.

## Guardrails
One attempt. Never exit silently (`NO-OP: <reason>`). Never ask or stand by. `pnpm build` +
`pnpm lint` must pass. Read the CI job log before diagnosing any failure.
