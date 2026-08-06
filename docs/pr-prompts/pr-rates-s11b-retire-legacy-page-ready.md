---
premise: '! test -f docs/data-model/rates-migration/STEP-11B-DONE.md'
premise_means: >-
  The legacy EstimateRatesAdminPage (/admin/estimate-rates) has not yet been
  retired and redirected to the canonical reference-data screen.
scope:
  - apps/web/src/**
  - tests/e2e/**
  - docs/data-model/**
done_when: >-
  pnpm build && test -f docs/data-model/rates-migration/STEP-11B-DONE.md
  && ! test -f apps/web/src/pages/EstimateRatesAdminPage.tsx
size: 4
gate_allow: none
escalates: true
seed_only: false
requires_file_on_main:
  - docs/data-model/rates-migration/STEP-11A-DONE.md
rollback_strategy: >-
  Front-end only. Revert the PR: the legacy page and its route return. The
  /estimate-rates API and legacy tables are untouched by this slice.
---

# SLICE 11b — retire the legacy estimate-rates admin screen

Read `docs/plans/rates-migration-plan.md` (section "11b") first. Runs only after
11a is live (gated on STEP-11A-DONE.md on main), so every category the old
screen edited now lives on `/settings/reference-data`.

## Do
1. Change the `/admin/estimate-rates` route in `apps/web/src/App.tsx` to
   `<Navigate to="/settings/reference-data" replace />`.
2. Delete `apps/web/src/pages/EstimateRatesAdminPage.tsx` and remove any nav
   entry / link / import that pointed at it.
3. Update any e2e/unit test that visited the old page to assert the redirect
   and edit rates on `/settings/reference-data` instead.
4. Leave the `/estimate-rates/*` API and the legacy tables intact — slice 11c
   removes them.
5. FINAL step, after `pnpm build` and green suites: write
   `docs/data-model/rates-migration/STEP-11B-DONE.md` (one line: "11b landed").

## Escalates — do NOT auto-merge
Touches the live rates admin surface. Feature PR labelled **do-not-merge**,
opened for Marco's review.

## Do NOT
- Do NOT remove the `/estimate-rates` API or any DB table (that is 11c).
- Do NOT change rate values or the new screen's behaviour.

## Verify
- `pnpm build`; `/admin/estimate-rates` redirects to `/settings/reference-data`;
  no dead imports; e2e green.
