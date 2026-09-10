# PR #967 Fix Required

PR has 2 commits instead of the required single commit. First commit adds the SLICE 14 prompt with 3 tabs (geofences, client-versions, map-locations). Second commit (01:19:50 UTC) narrows scope to 2 tabs only (geofences deliberately excluded as it's being redesigned separately as a per-job feature).

The scope change is substantively correct and well-justified (noted explicitly in the prompt), but house style requires single-commit PRs. Squash the two commits and force-push to re-trigger CI. The prompt substance is ready to merge once the form is fixed.
