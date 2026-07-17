---
premise: '! grep -q "model KbArticle" apps/api/prisma/schema.prisma'
premise_means: There is no internal knowledge base / SOP library.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/cases/**
  - apps/web/src/pages/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model KbArticle" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | GATED: arm after pr-cases-slice1 MERGED -->
# HOLD — Knowledge base / SOP library (case management slice 2)

STATUS: DRAFTED, STAGED, DO NOT ARM YET. D365 Customer Service KB parity. **ARM ONLY** after
`pr-cases-slice1` merged.

## What to build
Branch: `feat/cases-knowledge-base`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `KbArticle` (`title`, `body` (rich/markdown), `category`, `tags`, `status` draft/published,
   `authorId`, versioned or `updatedAt`). An internal SOP/knowledge library (asbestos procedures, safe
   work methods, common defect fixes, how-tos).
2. API in `cases` (or a `knowledge` sub-module): CRUD + search + publish; guard `knowledge.view`/`.manage`.
3. Web: a KB browse/search page + article view; a "link/suggest article" affordance from a Case.

## Schema change → REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs` and COMMIT `docs/data-model/relationship-map.json`
+ `relationship-map.md` + `metadata-catalog.json`. The CI data-model drift check FAILS otherwise (#593).

## Do NOT
- Do NOT build public-facing/portal KB in this slice (internal first). Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. If `model Case` not on main, STOP `NO-OP: predecessor not merged`.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge — leave the PR for Marco.
