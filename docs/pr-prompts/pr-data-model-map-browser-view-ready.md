---
premise: '! grep -rqi "data-model.html|DataModelMapPage" apps/web/src'
premise_means: There is no way to view the data-model relationship graph from the deployed web app.
scope:
  - apps/web/**
done_when: pnpm build && pnpm lint && grep -rqi "data-model.html|DataModelMapPage" apps/web/src
size: 6
gate_allow: none
seed_only: false
escalates: false
---
# Data-model map - viewable from the deployed web app (super-user)

STATUS: ARMED - RUN NOW.
docs/pr-prompts/needs-marco/generated-map-conflict-treadmill-20260716.md. Independent of the untrack
prompt - can build in either order. The relationship-graph.html is gitignored (generated locally),
so today the map is NOT viewable at the deployed URL; this gives Marco a real link.

## Why
The Azure Static Web App publishes apps/web/dist (deploy.yml). The data-model graph lives in
docs/data-model/relationship-graph.html, which is never bundled into the app, so it cannot be opened
at the deployed URL. Generate it at build time and surface it behind the super-user guard.

## What to build
Branch: `feat/data-model-map-view`. Reviewer: `GH-Mantova`. No migration.
1. At web build time, generate the graph HTML fresh (call the existing
   scripts/data-model/build-graph-html.mjs / `pnpm data-model:build`) and copy the resulting
   relationship-graph.html into the published web output so it ships in apps/web/dist.
2. Surface it behind the existing super-user guard (match the isSuperUser / can() pattern used by the
   Rates & Lists / Branding admin pages). PREFER a guarded in-app admin page (e.g. DataModelMapPage)
   that renders the generated HTML in an iframe; a raw internal static path is acceptable only if the
   guarded page is disproportionately expensive - note which you chose in the PR body and why.
3. Add a nav/admin entry to reach it (super-user only).

## Do NOT
- Do NOT commit the generated relationship-graph.html (it stays gitignored - generate at build).
- Do NOT touch Azure/prod config, schema.prisma, or migrations. Do NOT expose it to non-super-users.
  If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing any failure.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge - leave the PR for Marco; never exit
  silently (say `NO-OP: <reason>`); never ask a question or stand by for approval.
