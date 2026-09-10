PR #1067 — CRM S3 Unified Entry CRUD — Blocking TypeScript Compilation Error

The PR does not compile. In `apps/api/src/modules/crm/crm.service.ts::createEntry` (lines 559–561), three Prisma FK fields are assigned `?? null` (e.g., `clientId: dto.clientId ?? null`), but Prisma's OpportunityCreateInput type expects optional fields to be `undefined`, not `null`. This breaks TypeScript compilation and cascades to all CRM tests and tendering-e2e.

**Fix:** Remove the `?? null` coercion from lines 559–561. Prisma handles undefined correctly. Change to: `clientId: dto.clientId, contactId: dto.contactId, ownerId: dto.ownerId`.

**Secondary:** PR title must start with `[CRM-PRIORITY]` and PR body must have `PRIORITY: CRM program...` line at column 0 (prompt requirement, currently missing).

**Action:** Either fix locally and re-push (or close/reopen to re-trigger CI), or re-fire the prompt with the agent if additional issues surface after the TS fix.
