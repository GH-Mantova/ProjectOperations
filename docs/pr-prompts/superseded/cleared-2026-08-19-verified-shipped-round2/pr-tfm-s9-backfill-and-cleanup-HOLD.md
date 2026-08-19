---
premise: '! test -f docs/migration-runs/tender-folder-cleanup-list.md'
premise_means: The one-shot re-provisioning run for existing tenders and the cleanup list for T260814-XXXX-Rev1 and __connection_probe__ have not been captured; there is no committed record of which tenders were re-provisioned or which stub folders Marco is asked to delete by hand.
scope:
  - docs/migration-runs/tender-folder-cleanup-list.md
  - docs/migration-runs/tender-folder-reprovision-2026.md
  - scripts/migration-runs/capture-tender-folder-cleanup.mjs
  - scripts/migration-runs/capture-tender-folder-reprovision.mjs
done_when: pnpm lint && test -f docs/migration-runs/tender-folder-cleanup-list.md && grep -q "T260814-XXXX-Rev1" docs/migration-runs/tender-folder-cleanup-list.md && grep -q "__connection_probe__" docs/migration-runs/tender-folder-cleanup-list.md
size: 4
gate_allow: none
seed_only: false
escalates: true
requires_file_on_main: docs/migration-runs/tender-folder-copy-2026.md
cluster: tender-folder-model
---

# TFM-S9: Re-provision existing tenders + cleanup list

**Binding plan:** `docs/plans/tender-folder-model-plan.md` (section 6 TFM-S9). Gated on
TFM-S8 (the 2026 copy plan captured on `origin/main`).

## Standing rules for this slice (READ FIRST)

> - **Marco deletes stub folders by hand.** This slice produces the list, not the action.
> - **The re-provision endpoint is called by this PR's script** (it is a Graph-level
>   idempotent create-if-missing walk — safe to run and re-run against 2026 tenders).
> - **Nothing on the live library is deleted by this PR or any automation.**
> - **`escalates: true`.** The PR opens, stays open until Marco has (a) reviewed the
>   re-provision report and (b) deleted the stub folders named in the cleanup list.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- The `admin-imports/tender-folders/backfill` endpoint (shipped by MIG-3) walks every
  tender and calls `ensureTenderFolderStructure`. After TFM-S3/S4/S5 land, that call now
  produces the new nested structure with per-client `Quotes/{Client}/` subfolders and
  writes `folderProvisioningStatus` on each tender.
- `1. Operations/1. Tenders/` currently holds exactly two entries — `T260814-XXXX-Rev1`
  and `__connection_probe__` — from the pre-model era. Both must be surfaced for Marco to
  delete by hand.

## What to build

### 1. `scripts/migration-runs/capture-tender-folder-reprovision.mjs`

A one-shot Node script that:

- Calls `POST /admin-imports/tender-folders/backfill` (the existing MIG-3 endpoint) scoped
  to 2026 tenders.
- Serialises the response to `docs/migration-runs/tender-folder-reprovision-2026.md`
  as a Markdown table: `Tender T-number`, `Project name`, `Final status`,
  `Failed subfolders (if any)`.
- Header block: run timestamp, API URL, total tenders processed, count by final status.

### 2. `scripts/migration-runs/capture-tender-folder-cleanup.mjs`

A one-shot Node script that:

- Calls `SharePointService.listFolderChildren(...)` against the destination
  `tendersRoot` (`1. Operations/1. Tenders/`).
- Filters to folders that do not correspond to a `Tender` row in the DB (join by the
  derived folder name from TFM-S2's helper).
- Writes `docs/migration-runs/tender-folder-cleanup-list.md` as a Markdown table listing
  each orphan folder with columns: `Folder name`, `Graph itemId`, `Reason`,
  `Marco action`.
- The two known entries (`T260814-XXXX-Rev1` and `__connection_probe__`) MUST appear in
  the output. They are documented in the header block explicitly so a reviewer sees them
  even if the API call fails and produces a shorter list.

### 3. `docs/migration-runs/tender-folder-reprovision-2026.md`

The captured re-provision report from step 1.

### 4. `docs/migration-runs/tender-folder-cleanup-list.md`

The cleanup list from step 2. Include a header block that names the two known entries
inline (so the file has a stable minimum content even if the API call was mocked out) and
carries the standing rules verbatim.

### 5. PR body must include, at column 0

```
DO-NOT-MERGE: escalates true; Marco reviews the reprovision report AND deletes the stub folders by hand; nothing here deletes anything on the live library.
```

State clearly in the PR body:

1. The re-provision run is idempotent (it only creates missing folders).
2. The cleanup list is a list, not an action — Marco deletes each named folder by hand
   from the SharePoint UI.
3. The PR stays open until Marco confirms the tenders root holds only real tenders.

## Do NOT

- Do NOT delete anything from the SharePoint library, from any script, endpoint, or test.
  The cleanup path is Marco-only.
- Do NOT change the T-number matcher, `folderProvisioningStatus` semantics, or the copy
  precondition — all fixed by earlier slices.
- Do NOT run the re-provision against non-2026 tenders. Scope it explicitly.
- Do NOT edit `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not
> ask.** `escalates: true` so the merge queue will not touch it.

## Guardrails

- One attempt. If `docs/migration-runs/tender-folder-cleanup-list.md` already exists on
  main, say `NO-OP: cleanup list already captured` and stop.
- `pnpm lint` must pass before pushing.
- If the API is not reachable at capture time, write both Markdown files with the error
  clearly stated in the header and the two known cleanup entries listed inline. Marco can
  re-run the captures and amend the files before merging.
