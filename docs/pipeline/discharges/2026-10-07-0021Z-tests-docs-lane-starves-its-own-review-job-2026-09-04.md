---
item: tests-docs-lane-starves-its-own-review-job-2026-09-04.md
title: The `tests-docs` auto-merge lane starves the review job that gates it
retired_at: 2026-10-07T00:21:55Z
actor: station-00-scheduled
moved_to: docs/pr-prompts/needs-marco/discharged/tests-docs-lane-starves-its-own-review-job-2026-09-04.md
---

## Evidence
Premise retired by Marco: RETIRE_TESTS_DOCS_LANE_V1 merged in #2249 (2026-10-06T07:48:10Z). The 90-minute merge wait that occupied the single-lane worker no longer runs - with policy off the watcher opens the PR and moves on (index.mjs:3803). No wait, no starvation.
