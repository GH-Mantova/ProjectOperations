---
premise: '! ls apps/api/src/modules 2>/dev/null | grep -qx "reporting"'
premise_means: There is no cross-module reporting/BI module (analytics are per-module widgets only).
scope:
  - apps/api/src/modules/reporting/**
  - apps/web/src/pages/reports/**
  - apps/web/src/App.tsx
done_when: pnpm build && pnpm lint && ls apps/api/src/modules | grep -qx "reporting"
size: 10
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | D365-parity Tier 3 (Power BI-class reporting) | slice 1 -->
# HOLD — BI / reporting layer (slice 1)

STATUS: DRAFTED, STAGED, arm-eligible. Tier 3. Today analytics are per-module dashboard widgets;
this adds a cross-module reporting surface (the Power-BI-class gap), slice 1.

## What to build
Branch: `feat/reporting-layer`. Reviewer: `GH-Mantova`. No migration (read-only over existing tables).
1. A new read-only `reporting` module: a small set of **cross-module report definitions** (start with
   the highest-value few — e.g. tender pipeline & win-rate, job cost vs quote, WHS/compliance expiry
   summary, plant/asset utilisation) exposed as parameterised query endpoints (date range, project,
   client). Read via the service layer; guard `reporting.view`. No new tables — aggregate existing.
2. Web: a **Reports** page (`apps/web/src/pages/reports/`, route + nav): pick a report + filters →
   table + chart, with **Export to Excel/CSV and PDF** (reuse the existing HTML→PDF renderer and any
   xlsx/CSV helper). Keep it composable so more report definitions drop in later.

## Do NOT
- Do NOT stand up an external warehouse or Power BI embed in slice 1 (future). Do NOT duplicate the
  dashboard widget system — this is the tabular/exportable reporting surface beside it. Do NOT touch
  Azure/prod. If >10 files, split (API report defs / web) and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
