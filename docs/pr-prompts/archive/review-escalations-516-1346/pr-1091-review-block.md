## PR #1091 (SLICE 11b — retire legacy estimate-rates admin page) — BLOCKED

Gate violation: `requires_file_on_main: docs/data-model/rates-migration/STEP-11A-DONE.md`
does not exist. PR #1087 (SLICE 11a) has not yet merged to main. The PR's code is
structurally correct (EstimateRatesAdminPage.tsx deleted, route redirects, tests updated),
but it was fired prematurely. Hold for re-fire after SLICE 11a lands. Also: tendering-e2e
CI job has been in_progress for ~24 hours (potential timeout/hang — verify).
