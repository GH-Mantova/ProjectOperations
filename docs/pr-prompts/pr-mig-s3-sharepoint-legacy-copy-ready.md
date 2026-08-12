---
premise: '! test -f apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts'
premise_means: The SharePoint legacy-folder copy service does not exist on main yet — MIG-3 has not shipped.
scope:
  - apps/api/src/modules/admin-imports/**
requires_file_on_main: apps/api/src/modules/admin-imports/tender-tracker-import.service.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts
size: 6
gate_allow: none
seed_only: false
escalates: true
---

# MIG-3 — SharePoint legacy-folder copy job (matches by T-number, uses existing Graph seam)

**Binding plan:** `docs/plans/tender-tracker-migration-plan.md` (read it in full before starting).
This is **MIG-3**, the final slice of the legacy estimating-tracker migration program. For each
tender imported by MIG-2, it locates the legacy SharePoint folder by matching on the T-number
in the tender title and copies its contents into the ERP-created folder (already provisioned by
tender-create through the existing Graph integration).

This slice chains on MIG-2's import service file via `requires_file_on_main` — the watcher will
not dequeue MIG-3 until MIG-2 has landed on main.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails

One attempt. Never exit silently — say `NO-OP: <reason>` if the work is already on main. Never
ask a question or "stand by" for approval. Read the CI job log before diagnosing any failure.
`pnpm build` and `pnpm lint` must pass.

**Azure/Entra/SharePoint config is out of scope (D8).** Use ONLY the existing Graph seam the
ERP uses for tender-create folder provisioning. If the seam is missing a needed capability
(e.g. cross-drive copy that the current wrapper does not expose), STOP and emit
`NO-OP: <reason>` — a config change is escalated to Marco separately, not smuggled into this
slice.

---

## Grounded state on main (verified 2026-08-12)

- MIG-2 has landed (this slice's `requires_file_on_main` guarantees it):
  `apps/api/src/modules/admin-imports/tender-tracker-import.service.ts` exists, and imported
  tenders carry a `T####` in `title` (D3 in the plan).
- `SharePointFolderLink` model (`apps/api/prisma/schema.prisma` ~line 458) links a Tender / Job
  / Project to its provisioned SharePoint folder. Tender-create already provisions the
  destination folder via the Graph seam — use this record to locate the destination for each
  imported tender.
- Legacy folders live in the tenant's existing SharePoint under the same site collection as the
  ERP-created folders; the folder NAME embeds the same `T####` used in the imported tender
  titles. Matching is by that number.

## What to build

### 1. New service — `apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts`

Add to the existing `AdminImportsModule` (created by MIG-2). Do not spin up a new module.

```typescript
@Injectable()
export class SharepointLegacyCopyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sharepoint: <ExistingGraphSeam>, // use whatever tender-create injects
  ) {}

  async plan(): Promise<LegacyCopyPlan>              // dry-run: match table + gaps
  async execute(): Promise<LegacyCopyExecutionReport> // commit: perform copies
}
```

- `<ExistingGraphSeam>` — before writing, grep the tender-create path to find the exact
  service/token used to provision folders on tender-create. Inject that. Do NOT construct a
  new Graph client; do NOT read `process.env` for Azure credentials.

### 2. Matching

For every Tender whose title matches `/T\d{3,5}/` and that has a `SharePointFolderLink`
destination:

- Extract the `T####` from the title.
- Ask the Graph seam to look up the legacy folder whose name matches that `T####` in the
  legacy root (root path is configuration the existing seam already knows — do NOT hardcode).
- If found → the pair is a match candidate.
- If not found → record in the report under `unmatchedTenders`.

Also produce `unmatchedLegacyFolders`: legacy folders whose T-number does not appear in any
imported tender's title. These flag data-quality issues for Marco to reconcile.

### 3. Endpoint / trigger

Extend the MIG-2 controller (`tender-tracker-import.controller.ts`) with two additional routes,
same super-user guard:

```
POST /admin/imports/sharepoint-legacy-copy/plan     -> dry-run (no writes)
POST /admin/imports/sharepoint-legacy-copy/execute  -> commit
```

Both return a structured report. `plan` writes nothing; `execute` performs the copies.

### 4. Idempotency

Re-running `execute` MUST NOT re-copy files that are already present in the destination folder.
For each legacy file, before copying, ask the seam whether a file of the same name (and, if the
seam surfaces it, the same size or ETag) already exists at the destination. If yes → skip and
count in `alreadyPresent`. If no → copy and count in `copied`.

### 5. Unit tests — `sharepoint-legacy-copy.service.spec.ts`

Mock the Graph seam. Cover:

- `plan()` — returns match candidates, `unmatchedTenders`, and `unmatchedLegacyFolders`; writes
  nothing (the mocked seam records zero copy calls).
- `plan()` — a Tender without a `T####` in title is silently ignored (defensive; MIG-2 rejects
  those at import, but MIG-3 should not crash if one slips through).
- `execute()` — happy path: N legacy files → N copy calls to the seam.
- `execute()` — idempotency: a file already at destination is skipped, not re-copied.
- `execute()` — a Tender with no `SharePointFolderLink` destination is skipped and surfaced in
  the report under `noDestination`.

All fixtures synthetic. No real folder names or client data.

## Do NOT

- Do NOT construct a new Graph / MSAL client. Reuse the seam tender-create uses.
- Do NOT touch Azure/Entra/SharePoint config, tenant IDs, secrets, or any `.env` example.
- Do NOT add any package dependency for HTTP / Graph in this slice.
- Do NOT change `schema.prisma`, `Tender`, `Client`, `Site`, `TenderClientNote`, or
  `SharePointFolderLink`. Reuse only.
- Do NOT re-copy files that already exist at destination (idempotency is required).
- Do NOT create a new module — extend the `AdminImportsModule` created by MIG-2.
- Do NOT commit any real folder listing or file name — mocked fixtures only.
- Do NOT touch `/sot/`, seed data, or any file outside declared scope.
- Do NOT use `requires_merged` — this slice already chains via `requires_file_on_main`.
