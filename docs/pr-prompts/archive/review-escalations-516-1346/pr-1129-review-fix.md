# PR #1129 — Follow-up seed/test fix

The feature code is solid (all unit + integration tests pass), but E2E tests fail because no Account records exist in the test seed. The page correctly renders empty state; the issue is that tests 3-4 assert ≥1 row without gracefully handling the empty case. Before merging, either: (1) expand CRM-1 seed to create at least one test account (preferred), or (2) update nav2-accounts-index.spec.ts tests to skip row assertions if the empty state renders. The going-cold test (test 5) passed, confirming the feature works.
