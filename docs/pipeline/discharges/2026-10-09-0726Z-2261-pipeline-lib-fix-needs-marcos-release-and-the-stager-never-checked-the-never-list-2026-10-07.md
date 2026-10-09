---
item: 2261-pipeline-lib-fix-needs-marcos-release-and-the-stager-never-checked-the-never-list-2026-10-07.md
title: #2261 needs your release, and the thing that staged it never checked whether a station could ever merge it
retired_at: 2026-10-09T07:26:17Z
actor: station-00
moved_to: docs/pr-prompts/needs-marco/discharged/2261-pipeline-lib-fix-needs-marcos-release-and-the-stager-never-checked-the-never-list-2026-10-07.md
---

## Evidence
gh pr view 2261 --json state,mergedAt -> state=MERGED mergedAt=2026-10-09T06:26:23Z (asked individually, never from a LIST response - DOCTRINE 9.4)
