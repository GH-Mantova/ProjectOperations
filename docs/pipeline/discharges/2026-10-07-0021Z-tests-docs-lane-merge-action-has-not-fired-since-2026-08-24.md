---
item: tests-docs-lane-merge-action-has-not-fired-since-2026-08-24.md
title: The tests-docs lane enters the wait 172 times and has executed a merge 4 times, none since 2026-08-24
retired_at: 2026-10-07T00:21:55Z
actor: station-00-scheduled
moved_to: docs/pr-prompts/needs-marco/discharged/tests-docs-lane-merge-action-has-not-fired-since-2026-08-24.md
---

## Evidence
Premise retired by Marco: RETIRE_TESTS_DOCS_LANE_V1 merged in #2249 (2026-10-06T07:48:10Z). Default PR_WATCHER_AUTO_MERGE_POLICY is off (index.mjs:4113); the lane no longer enters a merge wait, so the 172-waits-4-merges ratio has no mechanism. DOCTRINE 10.3 states the defect is retired with the lane.
