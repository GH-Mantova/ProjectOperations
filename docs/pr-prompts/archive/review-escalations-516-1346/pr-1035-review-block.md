PR #1035 blocked on API CI failure.

The API job (93930365229) in run 31537001549 concluded FAILURE at 2026-08-11T21:18:19Z. Scope is correct (6 files, 1034 insertions), all PR gates pass (CP-09–13, CP-17, CP-22, CP-23), but the "API — lint, test, compliance smoke" job failed so the build/test/lint assertions cannot be verified. Full CI logs are inaccessible from artifacts. Re-run the job with verbose logging or investigate the exact error (likely TS compilation, Jest spec resolution, or ESLint rule violation in the new builder/service/controller files). Do not merge until API job is green.
