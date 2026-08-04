---
premise: '! test -f docs/plans/smart-wizard-intent-flow-plan.md'
premise_means: No plan exists yet for the intent-first Smart Wizard redesign; the wizard still opens on a single flat dropdown of ~240 raw Prisma models grouped by schema domain, which is overwhelming and speaks in schema terms rather than the user-facing modules.
scope:
  - docs/plans/**
done_when: pnpm build && pnpm lint && test -f docs/plans/smart-wizard-intent-flow-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# SLICE-0 plan: intent-first Smart Wizard (module -> intent -> widget)

## Context (verified on origin/main 2026-08-04)
The Smart Wizard ("build a widget from live metadata", Dashboard) currently opens on a single flat
`<select>` "— Select a model —" listing every wizard-visible Prisma model grouped by schema domain
(~24 domains: Assets, Authorization, Communications, Compliance, ... Estimating, Estimating (Legacy)).
It is overwhelming and speaks schema, not user, language. Grounded file/line evidence:
- `apps/web/src/dashboards/SmartWizardModal.tsx` (~254 lines) — react-query `authFetch("/meta/catalog")`,
  renders the flat `— Select a model —` dropdown (`{m.domain} > {m.label}`), then chart type + measure/grouping.
- `apps/web/src/dashboards/smartWizardCatalog.ts` (~210 lines) — types the catalog (`domains: string[]`,
  per-model `domain`), `visibleModels()` sorts by domain; wizard completes on model + chart type + (measure OR grouping).
- `docs/data-model/metadata-catalog.json` — self-described "Smart Wizard overlay: business meaning on top of
  the auto-derived graph. Edit this file, set reviewed:true to lock." Each model already carries `domain`,
  `wizardVisible`, `label`, `reviewed`; each field carries `role`, `label`, `filterable`, `aggregations`.
  Generated from `apps/api/prisma/schema.prisma` by `scripts/data-model/build-relationship-map.mjs`; served at
  `/meta/catalog` by `MetadataService` (env -> bundle -> dev-walker resolver, PRs #896/#904/#910; see sot/05 LL-58).
- Prior art (all shipped): widget builder #214, widget gallery, metadata-catalog-domain-classification,
  smart-wizard-runtime-catalog, wizard shell #750.
- Target module taxonomy is the sot/01 SECTION 9 sidebar IA (5 business modules); dashboard system is sot/01 SECTION 12.

## What to build (the plan document ONLY)
Author `docs/plans/smart-wizard-intent-flow-plan.md`: a binding SLICE-0 plan in the house style of
`docs/plans/smart-wizard-catalog-deploy-plan.md` (grounded audit -> ordered, independently shippable code
slices <= ~10 files each, `requires_merged` edges, CI-testable assertion per slice, rollback notes). The
plan MUST specify:

1. **Target UX** — a progressive, intent-first flow that replaces the flat dropdown:
   - Step 1: pick a **module** — the 5 sot/01 SECTION 9 business modules: Estimating, Projects, Operations,
     HR, Safety & Compliance (NOT the 24 raw schema domains).
   - Step 2 (one screen, three on-ramps): (a) an **AI free-text box** ("describe what you want to see") that
     prefills a build; (b) a shortlist of **ready-made report templates** for that module (reuse/extend the
     sot/01 SECTION 12 widget catalog, e.g. Estimating -> "pipeline value by stage", "win rate", "due this
     week"); (c) a **build-your-own** path: shape (KPI / trend / breakdown / list) -> subject -> fields/filters.
   - Step 3: configure + preview -> Add to dashboard (reuse existing chart-type/measure/grouping logic).

2. **Module taxonomy (curated, backend)** — extend the metadata-catalog OVERLAY with a `module` grouping +
   user-facing labels + templates, produced by `build-relationship-map.mjs` and served via `/meta/catalog`.
   The module->model map is CURATED (schema does not know "Estimating"): maintained as reviewed overlay
   entries, not auto-derived. Must survive the CI data-model drift gate (`build-relationship-map.mjs --check`)
   and the bundled-asset resolver. One source of truth the wizard renders.

3. **Permissions (BINDING, from day one)** — the wizard MUST filter the modules/models/fields it offers by the
   user's `module.view` permissions, so it never exposes data (e.g. Payroll, Authorization) a user cannot see.
   Bake this into the module-picker slice as a hard acceptance criterion; every later slice (templates,
   build-your-own, AI) inherits the same filter. Do NOT ship an unfiltered picker.

4. **Slice list** (ordered; value lands early). Suggested: SLICE 1 backend module layer + generator + catalog
   overlay; SLICE 2 module-first picker WITH permission filtering (this alone retires the flat dropdown);
   SLICE 3 report templates per module; SLICE 4 build-your-own shape->subject->fields; SLICE 5 AI free-text
   shortcut; SLICE 6 sot reconcile (sot/01 SECTION 12) via a doc-reconcile PR by the sot-keeper. Give each slice
   an executable premise, size, `requires_merged` edge, and a CI-testable assertion.

5. **AI slice guardrails** — the SLICE 5 AI step routes through the existing AI-provider seam
   (`AiProvidersService.resolveChosenProvider`, BYOK company keys), respects the
   GLOBAL_RATE_FABRICATION_PROHIBITION baseline, never fabricates fields/values, and degrades gracefully to the
   guided path if no provider/key is configured. It maps NL -> a prefilled build the user still confirms; it
   does not execute anything on its own. Note it is the riskiest/most-isolatable slice (ships last).

## Do NOT
- Do NOT write any application/build code in this slice — output is the plan document only (`scope: docs/plans/**`).
- Do NOT edit `/sot/` — the sot/01 SECTION 12 update is a later slice landed via the sot-keeper doc-reconcile PR.
- Do NOT change the `/meta/catalog` resolver behaviour (#904) or the deploy bundling (#896).
- Do NOT require any Azure / App Service / Entra / SharePoint change. Hard stop.
- Do NOT expand a raw-model dump behind the module cards — templates + permission-filtered, capped model lists.

## VERIFY
- `pnpm build && pnpm lint`
- `test -f docs/plans/smart-wizard-intent-flow-plan.md`

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails
One attempt. Never exit silently - if the plan already exists on `main`, say `NO-OP: <reason>`.
Never ask a question or "stand by" for approval; there is no human in a headless run.
Read the CI job log before diagnosing any failure.
