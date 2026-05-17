# Branch prune — 2026-05-17

Housekeeping operation: deleted 162 branches from
github.com/GH-Mantova/ProjectOperations after confirming each
either:

- had at least one merged PR and zero open PRs (MERGED-AND-SAFE,
  160 branches), or
- was an orphan branch confirmed by MAIN to be safe to delete
  (2 branches — see analysis below).

## Trigger

After the B-chain (B4a / B4b / B4b.1 / B-followup) shipped, the
repo had 163 branches. Most were merged-but-not-deleted from
the long PR chain that built the scope-of-works redesign. Two
orphans had accumulated from earlier exploratory work.

## Files

- `branches.txt` — full branch list at audit time (163 names)
- `audit-classification.txt` — `branch | merged_PRs | open_PRs | bucket`.
  Source for the delete list.
- `to-delete.txt` — the 162 names targeted for deletion
  (everything except main).
- `delete-log.txt` — append-only log of every API delete call
  with timestamp, response status, and outcome.
- `branches-after.txt` — branch list after the prune ran
  (1 line: `main`).

## Bucket counts (pre-prune)

| Bucket            | Count |
|-------------------|-------|
| MAIN              | 1     |
| MERGED-AND-SAFE   | 160   |
| OPEN-PR           | 0     |
| ORPHAN            | 2     |
| **Total**         | 163   |

## Orphan analysis (recorded for future audits)

Both orphans were investigated before deletion. Conclusions:

### `audit/2026-05-02-system-snapshot`
- Single commit "docs: add 2026-05-02 system audit report" on
  2026-05-02, head SHA `95637ee`.
- Never opened as a PR. Pushed directly as an audit record.
- Audit findings were captured elsewhere (progress.md notes
  indicate this).
- Safe to delete: deletion removes only the ref. Commit `95637ee`
  remains reachable via the GitHub reflog for ~30 days, and
  can be cherry-picked back if ever needed.

### `feat/tendering-assistant-drawing-tools`
- Single commit "chore(blocked): document agent-loop gap
  discovered during drawing-tools investigation" on 2026-05-03,
  head SHA `62d0e5f`.
- This was a BLOCKED marker documenting that the persona chat
  dispatcher was single-turn and couldn't feed tool results
  back to the model — a prereq for vision-based drawing tools.
- The blocker was resolved by PR #141 ("multi-turn agent loop
  + tool result handling — foundation for remaining Item 5
  tools"), and PR #142 then shipped the drawing tools
  themselves. Subsequent PRs #143 and #146 cleaned up.
- As of 2026-05-17 the agent loop, drawing tools, and tool
  result handling are all live on main.
- Safe to delete: branch is a historical artefact of the
  moment the gap was discovered, not a live reminder of
  unfinished work.

## Method

- Batch size: 10 deletions per batch
- Pause between batches: 1 second
- Per-deletion failure: stop and report (never continue past
  an unexpected error)
- All read-only audit calls precede any destructive call
- Explicit defensive check that `main` is NOT in the delete
  list (Phase 0.3 guard) before any DELETE fires

## Result

- 162 / 162 succeeded (HTTP 204 No Content)
- 0 already-gone (HTTP 422)
- 0 failed
- Duration: 149 seconds
- Final GitHub state: 1 branch (`main`)

## Reproducibility

The audit classification is reproducible by re-running:

```bash
gh api repos/GH-Mantova/ProjectOperations/branches --paginate \
  --jq '.[] | .name'
```

and for each branch:

```bash
gh pr list --state merged --head "$branch" --json number --jq 'length'
gh pr list --state open   --head "$branch" --json number --jq 'length'
```

Future housekeeping operations should follow the same pattern:

1. Audit first (read-only)
2. Classify with explicit buckets
3. Build the delete list separately
4. Defensively verify `main` is NOT in the delete list
5. Delete in throttled batches
6. Verify post-state matches expectations
