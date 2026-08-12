---
premise: ! grep -q "UNALLOCATED_TENDER\|resolveAllocatorRecipients" apps/api/src/modules/tendering/allocation.service.ts
premise_means: The allocation alert dispatch (UNALLOCATED_TENDER, TENDER_REJECTED, ESTIMATOR_OVERLOADED) and the allocator-recipient resolver have not been added to AllocationService yet.
scope:
  - apps/api/src/modules/tendering/allocation.service.ts
  - apps/api/src/modules/tendering/allocation-alerts.service.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/api/src/modules/tendering/__tests__/allocation-alerts.service.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/tendering/allocation-alerts.service.ts && grep -q "resolveAllocatorRecipients" apps/api/src/modules/tendering/allocation-alerts.service.ts
size: 5
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/api/src/modules/tendering/allocation.service.ts
---

# EW-3: Allocation alerts via NotificationsService

**Binding plan:** `docs/plans/estimator-allocation-workload-plan.md` (read sections 3.6, 3.8, and 6
in full before starting). This is the third slice of the estimator allocation workflow cluster.

**Gate:** EW-2 (allocation engine) must be on main. Verify that `allocation.service.ts` exists in
`apps/api/src/modules/tendering/` before starting.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- `NotificationsService` is already used in `tender-entries.service.ts` (import line 5) and
  `scope-waste.service.ts` (import line 4). Import it the same way.
- `AllocationService` (EW-2) has `reject()`, `selfClaim()`, `pushBack()`, `detectUnallocated()`,
  and `allocateSingle()`/`allocatePool()`. This slice adds alert dispatch calls into those methods
  OR into a new `AllocationAlertsService` that wraps them — prefer the wrapper pattern to keep
  EW-2's service testable in isolation.
- `AllocatorDelegate` model (EW-1) holds delegate rows with `startDate` and `endDate`.
- The permission registry has `tenders.allocate` (added in EW-2). To find all users holding this
  capability, query the existing permission assignment tables — read the roles/permissions schema
  (`model Role`, `model UserRole`, `model Permission`, `model RolePermission` or equivalent) to
  understand the query shape before writing it.
- Anti-fatigue rule: if >3 `UNALLOCATED_TENDER` alerts would fire in one call, aggregate into a
  single notification. If >1 overload alert for the same estimator in the same check, send one.

## What to build

### 1. `AllocationAlertsService` — `apps/api/src/modules/tendering/allocation-alerts.service.ts`

An `@Injectable()` service. Inject `PrismaService`, `NotificationsService`, `CapacityService`.

**Core helper — `resolveAllocatorRecipients(): Promise<string[]>`**

Returns a deduplicated list of user IDs who should receive allocator-level alerts:
1. Query all users who hold the `tenders.allocate` capability. Find this by looking up the
   permission by action string, then traversing role → user assignments for active roles.
2. Query all `AllocatorDelegate` rows where `startDate <= now() AND endDate >= now()`.
3. Return a deduplicated union of both sets.

If neither set is populated (no-one holds `tenders.allocate`, no active delegate), log a warning
via `Logger` but do NOT throw — alerts are best-effort and must not fail the allocation action.

**Alert methods:**

- `alertUnallocated(tenderIds: string[]): Promise<void>`
  - If `tenderIds.length === 0`: no-op.
  - If `tenderIds.length === 1`: send one notification to each recipient with the tender title.
  - If `tenderIds.length > 3` (anti-fatigue): send a single aggregated notification:
    `"${tenderIds.length} tenders are waiting for an estimator assignment."` to each recipient.
  - If `2 <= length <= 3`: one notification per tender (small enough to be actionable individually).
  - Use the `NotificationsService.create()` pattern already used in `tender-entries.service.ts`.
    Look up the exact call signature before writing. Do NOT invent a new notification type —
    use the existing entity/message pattern.

- `alertRejected(tenderId: string, reason: string, rejectedBy: string): Promise<void>`
  - Sends one notification to each recipient in `resolveAllocatorRecipients()` with the tender ID,
    the rejector's name (resolve from Prisma), and the rejection reason.

- `alertOverloaded(estimatorId: string): Promise<void>`
  - Sends one notification to:
    - Each recipient in `resolveAllocatorRecipients()`.
    - The overloaded estimator themselves.
  - If the estimator IS already an allocator-recipient, they still get one notification (dedup).
  - Anti-fatigue: within a single call to `alertOverloaded`, never send more than one notification
    per recipient regardless of how many overload conditions triggered simultaneously.

### 2. Hook alert calls into `AllocationService`

After verifying `AllocationAlertsService` is wired (step 3), add calls in `AllocationService`:

- After `allocateSingle()` / `allocatePool()` transitions a tender to `UNALLOCATED`: call
  `alertUnallocated([tenderId])`.
- After `reject()`: call `alertRejected(tenderId, reason, estimatorId)`.
- After any assignment that may push the estimator over capacity: call
  `isOverloaded(estimatorId)` and if true call `alertOverloaded(estimatorId)`.
- After `pushBack()`: call `alertUnallocated([tenderId])`.

Inject `AllocationAlertsService` into `AllocationService` (or use an event emitter if you prefer
to avoid a circular dep — prefer direct injection since the dependency is one-way).

### 3. Wire into `tendering.module.ts`

Register `AllocationAlertsService` in `tendering.module.ts`. Ensure `NotificationsService` is
importable (check whether `NotificationsModule` is already imported in `tendering.module.ts` —
if so, nothing to change; if not, add the import).

### 4. Unit tests — `apps/api/src/modules/tendering/__tests__/allocation-alerts.service.spec.ts`

Mirror the existing spec style. Key assertions:
- `resolveAllocatorRecipients()` returns the union of tenders.allocate holders and active delegates.
- `resolveAllocatorRecipients()` returns an empty array (and logs a warning) when neither set has
  members.
- `alertUnallocated([id1, id2, id3, id4])` (length > 3) calls `NotificationsService.create` once
  per recipient with the aggregated message.
- `alertUnallocated([id1])` (length 1) calls `NotificationsService.create` once per recipient with
  the individual tender message.
- `alertRejected()` calls `NotificationsService.create` for each recipient.
- `alertOverloaded()` calls `NotificationsService.create` for each recipient AND for the estimator,
  with deduplication when the estimator is also a recipient.

## Do NOT

- Do NOT build the capacity board endpoints — that is EW-4.
- Do NOT build any UI — that is EW-5.
- Do NOT create a new notification channel or notification model — use `NotificationsService` as-is.
- Do NOT hardcode a user ID or role name for the allocator — use `resolveAllocatorRecipients()`.
- Do NOT touch Azure/Entra/SharePoint or `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if `resolveAllocatorRecipients` already exists in
  `allocation.service.ts`, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
