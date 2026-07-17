---
premise: '! grep -q "model AutomationRule" apps/api/prisma/schema.prisma'
premise_means: There is no configurable when-X-do-Y automation engine (only the forms rules engine).
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/platform/**
  - apps/web/src/pages/admin/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model AutomationRule" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | UX-parity (Power Automate-style automation) | MVP slice 1 -->
# HOLD — UX: configurable automation engine (MVP, slice 1)

STATUS: DRAFTED, STAGED, arm-eligible. Power-Automate parity: admin-configurable "when X, do Y"
automation beyond the forms rules engine. MVP = a small, safe set of triggers + actions, config-driven.

## What to build
Branch: `feat/ux-automation-engine`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `AutomationRule` (`name`, `trigger` {entity, event: created/updated/status-changed},
   `conditions` JSON, `actions` JSON, `enabled`) + a run log. Data-driven; no code per rule.
2. Engine in `platform`: on the supported domain events, evaluate enabled rules and run a **whitelisted**
   action set for the MVP — **notify** (via the existing NotificationTrigger machinery), **create a
   task/note**, **set a field**. Reuse existing services; do NOT let a rule run arbitrary code.
3. Web: an admin "Automations" page (list/create/enable) under admin settings.

## Schema change → REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs` and COMMIT `docs/data-model/relationship-map.json`
+ `relationship-map.md` + `metadata-catalog.json`. The CI data-model drift check FAILS otherwise (#593).

## Do NOT
- Do NOT allow arbitrary code/webhooks in the MVP (whitelisted actions only). Do NOT duplicate the
  forms rules engine — this is cross-module. Do NOT touch Azure/prod. If >10 files, split and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
