---
premise: '! grep -q "jobConversion" apps/api/src/modules/tender-clients/tender-clients.service.ts'
premise_means: TenderClientsService.removeClient still hard-deletes a TenderClient with no check for a linked JobConversion, so the cascade data-loss hazard is still live.
scope:
  - apps/api/src/modules/tender-clients/tender-clients.service.ts
  - apps/api/src/modules/tender-clients/tender-clients.module.ts
  - apps/api/src/modules/tender-clients/__tests__/tender-clients.service.spec.ts
done_when: pnpm build && pnpm lint && grep -q "jobConversion" apps/api/src/modules/tender-clients/tender-clients.service.ts && grep -q "AuditService" apps/api/src/modules/tender-clients/tender-clients.service.ts
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# Guard TenderClient removal against silent JobConversion cascade loss

## The defect (04-scanner, 2026-07-20, Part 0 sub-check (c) DESTRUCTIVE-DELETE HAZARD)

`apps/api/src/modules/tender-clients/tender-clients.service.ts:36` performs a **whole-entity hard
delete** with no soft-delete and no audit write:

```ts
await this.prisma.tenderClient.delete({ where: { id: existing.id } });
```

`apps/api/prisma/schema.prisma` declares two **cascading** children of `TenderClient`:

```prisma
model JobConversion {
  tenderClientId String       @unique @map("tender_client_id")
  tenderClient   TenderClient @relation(fields: [tenderClientId], references: [id], onDelete: Cascade)
}

model TenderClientPackage {
  tenderClientId String       @map("tender_client_id")
  tenderClient   TenderClient @relation(fields: [tenderClientId], references: [id], onDelete: Cascade)
}
```

So calling `removeClient()` on a tender client that has already been **converted to a Job** silently
destroys the `JobConversion` row — the record that ties a won tender to the Job it became — plus every
`TenderClientPackage` assignment. The only existing guard is the "a tender must have at least one
client" invariant, which does not consider conversion state at all. `TenderClient.isAwarded` exists,
and an awarded/converted client is removable today.

### Five-angle evidence

1. **Reproduce** — static scan run twice from a clean worktree off `origin/main` @ `60dea01`; both
   passes report `tenderClient.delete@36` in a service file with no `AuditService` and no
   soft-delete field.
2. **Source** — the call site is quoted above; `removeClient` is lines 28-38 of that file. The
   service constructor injects `PrismaService` only.
3. **Ground truth** — `docs/pipeline/stations/04-scanner.md` sub-check (c): "FLAG whole-entity hard
   deletes with no soft-delete and no AuditLog write ... as S3 data-loss-risk."
4. **History** — not previously filed. `tenderClient` / `JobConversion` / `TenderClientPackage` /
   `removeClient` return **0** hits across `docs/qa/qa-findings.md`, `docs/qa/qa-checklist.md`,
   `sot/05-decisions-and-lessons.md` and all 50 files in `docs/pr-prompts/`. Positive control:
   `S3-015` returns 26 hits in the same findings file, so the search instrument is not blind.
5. **Blast radius** — the sibling hard deletes in the same sweep were checked and are NOT this bug:
   `tenderRateSet.delete` **does** write audit (`this.audit.write`, `tenders.rate-set.unlock`);
   `conversation.delete` is an owner-checked delete of the user's own conversation with a deliberate
   documented cascade. `TenderClient` is the only user-facing hard delete found whose cascade reaches
   a **business record** rather than its own detail rows.

## What to build

In `tender-clients.service.ts`:

1. In `removeClient`, **before** the delete, look up whether a `JobConversion` exists for this
   `TenderClient` (`this.prisma.jobConversion.findUnique({ where: { tenderClientId: existing.id } })`).
   If one exists, throw a `BadRequestException` explaining that the client has been converted to a job
   and must not be removed. Follow the wording style of the existing
   `"A tender must have at least one client."` guard in the same method.
2. Inject `AuditService` into the constructor (same pattern as
   `apps/api/src/modules/tendering/tender-rate-set.service.ts`) and write an audit entry after a
   successful delete: action `tenders.client.remove`, entityType `TenderClient`,
   entityId `existing.id`, metadata `{ tenderId, clientId }`. `removeClient` currently takes no actor
   id — thread an `actorId: string` parameter through from `tender-clients.controller.ts` **only if**
   the controller already has the authenticated user in hand; if it does not, pass the audit entry
   without an actor rather than expanding scope.
3. In `tender-clients.module.ts`, add whatever import is required for `AuditService` to resolve
   (mirror the module that provides it to `TenderRateSetService`).
4. Update `__tests__/tender-clients.service.spec.ts`: add the `jobConversion.findUnique` and audit
   mocks to the existing Prisma mock object, add a case asserting `removeClient` **throws** when a
   `JobConversion` exists, and fix any `toHaveBeenCalledWith` assertions the constructor change breaks.

## Do NOT

- Do NOT change `schema.prisma`, and do NOT write a migration. The `onDelete: Cascade` relations stay
  as they are — this PR adds an application-level guard, nothing more.
- Do NOT add soft-delete columns to `TenderClient`.
- Do NOT touch `tender-packages.service.ts` or any other module's delete paths.
- Do NOT audit or guard the other 28 hard-delete call sites found in the sweep. They are a separate,
  larger question and are deliberately out of scope.

## Open question for Marco (note in the PR body, do not block on it)

Blocking removal outright is the conservative reading. Marco may prefer that a converted client be
removable by a sufficiently privileged user with an audit trail instead. Implement the **block**
(it matches the precedent already in this method) and raise the alternative in the PR description.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if you cannot proceed, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the job log before diagnosing any CI failure. PR-body edits do not retrigger checks.
- Do NOT auto-merge. Open the PR and leave it for the shepherd/Marco.
