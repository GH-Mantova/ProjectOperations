---
premise: '! test -f docs/migration-runs/tender-folder-copy-2026.md'
premise_means: The 2026 legacy-copy plan has not been captured to docs/migration-runs/ yet; there is no committed audit trail of which tenders are queued for the one-time 2026 copy or their destination readiness.
scope:
  - docs/migration-runs/tender-folder-copy-2026.md
  - docs/migration-runs/README.md
  - scripts/migration-runs/capture-tender-folder-copy-2026.mjs
done_when: pnpm lint && test -f docs/migration-runs/tender-folder-copy-2026.md && grep -q "do-not-merge" docs/migration-runs/tender-folder-copy-2026.md
size: 3
gate_allow: none
seed_only: false
escalates: true
requires_on_main:
  - apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts :: assertDestinationExists
  - apps/api/prisma/schema.prisma :: projectName
cluster: tender-folder-model
---

# TFM-S8: The 2026 copy

**Binding plan:** `docs/plans/tender-folder-model-plan.md` (section 6 TFM-S8). Gated on
TFM-S7 (`assertDestinationExists`) AND TFM-S2 (`projectName`) — both must be on
`origin/main` before this slice arms. Naming and precondition MUST land first; otherwise
the copy runs into either wrongly-named destinations or unready folders.

## Standing rules for this slice (READ FIRST)

> - **COPY ONLY. NEVER MOVE. NEVER DELETE.**
> - **2026 tenders ONLY.**
> - **Marco runs `execute` by hand. Automation does NOT execute the copy.**
> - **Automation MUST NEVER remove the `do-not-merge` label from this PR.**
> - **The PR opens and stays open.** `escalates: true`. The merge queue must not touch it.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- MIG-3 shipped the plan/execute endpoints under `admin-imports/sharepoint-legacy-copy/`.
- TFM-S6 delivered the separate `legacyTendersRoot` (`2. Quotes/Quotes 2026`) and the
  two-level month walk.
- TFM-S7 delivered `assertDestinationExists`, so the plan endpoint now returns a
  `destinationReady` verdict per tender and an `unreadyCount` at the top.
- TFM-S5 delivered `folderProvisioningStatus`, so tenders whose destination tree is not
  fully provisioned are visible up front.

## What to build

### 1. `scripts/migration-runs/capture-tender-folder-copy-2026.mjs`

A one-shot Node script that:

- Calls the `admin-imports/sharepoint-legacy-copy/plan` endpoint against the running API,
  scoping to 2026 tenders (accept a `--year 2026` flag; hard-code the default).
- Serialises the returned plan into a Markdown table under
  `docs/migration-runs/tender-folder-copy-2026.md`. Columns: `Tender T-number`,
  `Project name`, `Destination path`, `Destination ready?`, `Reason (if unready)`,
  `# source files`, `Total size (MB)`.
- Includes a header block that names: the run timestamp, the API URL, the plan endpoint's
  reported `unreadyCount`, and the total file count.
- Includes a footer with the **standing rules** verbatim from the section above so the
  audit trail carries the constraints.

The script never calls `execute`. It only reads the plan.

### 2. `docs/migration-runs/tender-folder-copy-2026.md`

The captured Markdown from step 1. Commit it. Every tender in the plan appears as a row
whether or not it is ready — Marco needs to see which rows need remediation before he runs
`execute`.

### 3. `docs/migration-runs/README.md`

Short index page describing what `docs/migration-runs/` holds and the discipline it
enforces:

- Every one-shot data migration lands its plan output here as a Markdown table.
- The Marco-runs-it operations (D34) are documented here so the audit trail is in the
  repository, not in a shell scrollback.
- Files here are append-only history; do not rewrite past migration-run tables.

### 4. PR body must include, at column 0

```
DO-NOT-MERGE: escalates true; Marco executes the copy by hand; automation MUST NOT remove this label.
```

State clearly in the PR body that:

1. The copy is **not** executed by this PR or any automation. This PR captures the plan
   only.
2. Marco runs `POST /admin-imports/sharepoint-legacy-copy/execute` from his workstation
   after reviewing the captured plan.
3. The PR remains open and unmerged until Marco has executed the copy and confirmed the
   destination library state.

## Do NOT

- Do NOT call the `execute` endpoint from anywhere in this PR — not the script, not a
  test, not a docs example. The Marco-runs-it discipline is enforced by omission.
- Do NOT remove, move, or delete anything on the SharePoint library. Copy only.
- Do NOT include tenders outside 2026. If the plan endpoint returns any, filter them out
  in the script before writing the Markdown.
- Do NOT set `auto-merge` on this PR. The `do-not-merge` label stays for the life of the
  PR.
- Do NOT edit `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not
> ask.** "Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED. `escalates: true`
> so the merge queue will not touch it.

## Guardrails

- One attempt. If `docs/migration-runs/tender-folder-copy-2026.md` already exists on main,
  say `NO-OP: 2026 plan already captured` and stop.
- `pnpm lint` must pass before pushing (there is no code compilation surface — this slice
  is docs + a script).
- If the API is not reachable at capture time, write a placeholder Markdown file with the
  error clearly stated and open the PR anyway — Marco can re-run the capture and amend the
  file before merging.
