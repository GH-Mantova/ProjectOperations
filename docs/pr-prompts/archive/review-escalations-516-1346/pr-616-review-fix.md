## PR #616 CI fixes required (FIX-FORWARD)

The substantive work is complete and correct: BrandColorScheme + BrandAsset landed, migration backfills correctly, seed is idempotent, service mirrors legacy columns, controller enforces super-user, frontend fallback works. Build and linting both pass.

Two mechanical CI failures block merge:

1. **PR gates CP-11** (undeclared migration): The PR body lacks the `GATE-ALLOW: migrations` marker. Add this line at column 0 before the ## Summary section:
   ```
   GATE-ALLOW: migrations
   ```
   The marker enables the CP-11 gate to recognize that a migration file is legitimate and not accidental.

2. **Schema drift** (relationship-map.json): The generated data-model map is stale. Run:
   ```
   node scripts/data-model/build-relationship-map.mjs
   ```
   Then commit the updated `docs/data-model/relationship-map.json` to the branch.

Both are no-logic changes. Once fixed, CI will pass and the PR is ready to merge.
