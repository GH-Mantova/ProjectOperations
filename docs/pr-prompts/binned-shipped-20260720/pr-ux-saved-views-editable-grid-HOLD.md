---
premise: '! grep -q "model SavedView" apps/api/prisma/schema.prisma'
premise_means: There are no personal saved views / editable data grid across lists.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/platform/**
  - apps/web/src/components/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model SavedView" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | UX-parity (D365 personal views + editable grid) | MVP -->
# HOLD — UX: saved views + editable grid (MVP)

STATUS: DRAFTED, STAGED, arm-eligible. D365 model-driven-app parity: personal saved views + an
inline-editable data grid. Generalises the existing `FilterableRateGrid` pattern to any list.

## What to build
Branch: `feat/ux-saved-views-grid`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `SavedView` (`ownerId`, `entityType`, `name`, `filters` JSON, `columns` JSON, `sort`,
   `isDefault`). Per-user list personalisation.
2. API in `platform`: CRUD for the caller's saved views.
3. Web — a reusable `<DataGrid>` upgrade: column show/hide + reorder + width, inline cell edit (where
   the row's PATCH endpoint allows), and a **Views** dropdown (save current filter/columns as a
   personal view, switch, set default). Apply it to ONE reference list (e.g. Clients or Jobs) as proof;
   keep it drop-in for others.

## Schema change → REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs` and COMMIT `docs/data-model/relationship-map.json`
+ `relationship-map.md` + `metadata-catalog.json`. The CI data-model drift check FAILS otherwise (#593).

## Do NOT
- Do NOT build a new grid library — extend the existing grid/FilterableRateGrid patterns. Do NOT wire
  every list in the MVP. Do NOT touch Azure/prod. If >10 files, split and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
