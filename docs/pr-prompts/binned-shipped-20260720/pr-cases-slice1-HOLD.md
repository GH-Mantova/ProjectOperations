---
premise: '! grep -q "model Case" apps/api/prisma/schema.prisma'
premise_means: There is no case management (defect/warranty/RFI/complaint tracking).
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/cases/**
  - apps/api/src/common/permissions/**
  - apps/web/src/pages/cases/**
  - apps/web/src/App.tsx
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model Case" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | D365 Customer Service parity | case management slice 1 -->
# HOLD — Case management, slice 1 (defects / warranty / RFI / complaints)

STATUS: DRAFTED, STAGED, arm-eligible. D365 Customer Service parity, shaped for construction:
track **defects, warranty items, RFIs and complaints** as cases through to resolution (today these
live in ad-hoc correspondence). Knowledge base is slice 2.

## What to build
Branch: `feat/cases-slice1`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `Case` (`number` `CASE-YYYY-NNN`, `type` defect/warranty/rfi/complaint/other, `title`,
   `description`, `status` open/in-progress/waiting/resolved/closed, `priority`, `clientId?`,
   `projectId?`/`jobId?`, `raisedById`, `assignedToId?`, `dueAt?` (SLA), `resolvedAt?`, `resolution?`)
   + `CaseComment` (thread). Optionally an `slaHours` on config.
2. API `cases` module: CRUD + assign + status transitions + comments; guard `cases.view`/`.manage`.
   Reuse the timeline/correspondence pattern for the comment thread.
3. Web: a Cases list (filter by type/status/assignee/SLA-breach) + case detail (route + nav); a
   "raise case" action linkable from a Project/Job/Client.

## Schema change → REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs` and COMMIT `docs/data-model/relationship-map.json`
+ `relationship-map.md` + `metadata-catalog.json`. The CI data-model drift check FAILS otherwise (#593).

## Do NOT
- Do NOT build the knowledge base here (slice 2). Do NOT build omnichannel/chat. Do NOT touch Azure/prod.
  If >10 files, split (schema+API / web) and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
