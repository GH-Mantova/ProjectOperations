# SLICE-0 plan — Forms Engine v2, F-2 (rules engine)

**Status:** PLAN ONLY (Marco 2026-08-04). No sub-slice is armed yet. This breaks the single F-2 line
in `sot/06 §8` into buildable, lint-sized (<=10 files) sub-slices, because F-2 as one PR is too big.

## Problem / goal

Forms need conditional logic: show/hide/require fields based on answers, and WARN or BLOCK on submit
with an acknowledgement trail. F-1 (builder shell, #499) shipped. A `RulesEngineService`
(`apps/api/src/modules/forms/rules-engine.service.ts`, ~432 lines) already evaluates field
visibility / required / compliance gates, and `FormRule` + `FormField` models exist. But there are
**two evaluators that can drift** — the server (`rules-engine.service.ts`) and the fill page
(`FormFillPage.tsx`) — which sot/06 flags as risk R5.

## Current state (grounded on origin/main)

- `FormRule` model exists (schema ~1887); `FormField` exists (~1851).
- `forms-engine.service.ts` already calls `rules.evaluateFieldVisibility / evaluateFieldRequired /
  validateValues / checkComplianceGates / collectOnSubmitActions`.
- No shared rule-definition format between server and client yet; no full-screen rules builder UI.

## Proposed sub-slices (ordered; each its own armed prompt later)

- **F-2a — rule storage + shared definition format** (`feat/fv2-rules-storage`).
  Expand `FormRule` with a `definition` JSON column (migration `fv2_formrule_expand`, escalates:schema);
  inline-backfill legacy rows into `definition`; define ONE shared rule-definition TypeScript type used
  by both evaluators. Regenerate the data-model map in-PR (CP data-model gate). ~6-8 files.
  Premise: `! grep -q "definition" <FormRule block in schema.prisma>`.
- **F-2b — one evaluator, contract-tested** (`feat/fv2-rules-eval-unify`).
  Make server (`rules-engine.service.ts`) and fill page (`FormFillPage.tsx`) read the shared format;
  add contract tests running the same fixtures through both so they can never drift (closes R5).
  No schema. ~5-7 files. Premise: two evaluators still diverge (a fixture that passes one, fails the other).
- **F-2c — rules builder UI + WARN/BLOCK + acknowledgement** (`feat/fv2-rules-builder`).
  Full-screen visual rule builder (form-value conditions only, per sot/06 — system-value conditions are
  F-10, out of scope here); WARN/BLOCK submit actions; acknowledgement recording; timing field.
  Web-heavy. ~6-9 files. Premise: no rules-builder route/component on main.

## Key decisions (locked in sot/06)

- Form-value conditions ONLY in F-2 (system-value conditions deferred to F-10).
- F-2 lands BEFORE F-3 (repeating sections) so there is one evaluator to teach repeating operators.

## Risks

- **Legacy-row backfill** (F-2a): backfill must be idempotent and reversible; keep the old columns until
  a later contract slice (`fv2_formrule_contract`) drops them after soak.
- **Evaluator drift** during the transition (F-2b): the contract tests are the guard; do not ship F-2c
  until F-2b's tests are green.

## Sequencing

F-2a -> F-2b -> F-2c, each armed only after its predecessor is on main. F-2a is escalates:true
(schema migration + backfill) -> Marco reviews. Arm F-2a first when ready.
