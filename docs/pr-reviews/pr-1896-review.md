VERDICT: REJECT-AND-REDO

Scope compliance:
- In scope: All 6 files match the prompt's scope exactly (sor-push-back.service.ts, sor-push-back.controller.ts, sor-source-markup.service.ts, schedule-of-rates.module.ts, permission-registry.ts, sor-push-back.service.spec.ts)
- Out of scope: None detected
- Permission registered: `rates.push-back` with `isHighRisk: true` matches spec
- Constant exported: `SOR_FIGURE_COLUMN_NAMES` correctly extracted from `sor-source-markup.service.ts` and reused in `sor-push-back.service.ts`
- Module registration: Controller and service registered in `schedule-of-rates.module.ts`

Self-verification claims:
- [FAILED] `pnpm build && pnpm lint` — TypeScript compilation error blocks the build
- [UNVERIFIED] Permission coverage guard passes
- [UNVERIFIED] Frozen guarantee spec passes
- [BLOCKED] API CI job green — blocked by compilation error

Critical failure:
- **TypeScript compilation error on line 438 of `sor-push-back.service.ts`:**
  ```
  error TS2353: Object literal may only specify known properties, and 'tenderRateSet' does not exist in type 'TenderWhereInput'.
  ```
  
  The code attempts to query tenders via `tenderRateSet: null`, but Prisma's `TenderWhereInput` type does not accept this syntax. The `TenderRateSet` model has a `@unique` FK `tenderId`, so querying for tenders with no `TenderRateSet` requires the Prisma relation-null syntax `tenderRateSet: { is: null }` instead.
  
  Location: Line 438 in the `_futureLocks` method. The query should be:
  ```ts
  const tenders = await this.prisma.tender.findMany({
    where: {
      tenderRateSet: { is: null },  // ← CORRECT Prisma syntax
      status: { notIn: [...TERMINAL_STATUSES] },
    },
  ```

Risks Marco should know:
- The spec asserts 7 describe blocks covering the frozen guarantee, EXPIRED periods, MANUAL sourceType, stale-detection, nothingToPush, vendor push, and futureLocks filtering. Because the service does not compile, none of these assertions have run.
- The prompt requires both a successful compile AND all verification steps to pass before opening. Opening with a compile error violates the guardrail: "pnpm build and pnpm lint must both pass, and the new spec must be green, before you open the PR."

Recommendation: Reject this PR and re-fire the prompt with the compilation error fixed. The agent needs to correct the Prisma where-clause syntax for querying null relations.
