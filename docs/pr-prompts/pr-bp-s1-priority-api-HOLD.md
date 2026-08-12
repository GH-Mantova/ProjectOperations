---
premise: '! test -f apps/api/src/modules/bid-prioritisation/bid-prioritisation.service.ts'
premise_means: No bid-prioritisation service exists on main yet — BP-1 (priority API + expected-value compute) has not run.
scope:
  - apps/api/src/modules/bid-prioritisation/**
  - apps/api/src/modules/tendering/tendering.controller.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/api/src/app.module.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/bid-prioritisation/bid-prioritisation.service.ts && grep -q "bid-prioritisation\|BidPrioritisation" apps/api/src/modules/tendering/tendering.controller.ts
size: 7
gate_allow: none
seed_only: false
escalates: false
---

# BP-1 — Bid-prioritisation priority API + expected-value compute

**Binding plan:** `docs/plans/bid-prioritisation-plan.md` (read it in full before starting).
This is **BP-1**, the first slice of the bid-prioritisation program. It extends WL3-S1
(`apps/api/src/modules/win-likelihood/` — already merged) by computing an expected-value score
across ALL open tenders and returning them ranked. No UI in this slice.

**ADVISORY ONLY.** This endpoint MUST NEVER feed pricing, auto-accept, or auto-reject. It ranks
and surfaces; humans decide. This guardrail is non-negotiable and must appear in the endpoint's
JSDoc/comment.

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

---

## Grounded state on main (verified 2026-08-12)

- **WL3-S1 is merged.** `apps/api/src/modules/win-likelihood/win-likelihood.service.ts` exports
  `WinLikelihoodService` (returns `pointEstimate: number | null`, `interval`, `confidence`,
  `whyFactors`, `captureGaps`, `cohortSize`).
  `apps/api/src/modules/win-likelihood/win-likelihood-features.service.ts` exports
  `VALUE_BAND_EDGES`, `TenderFeatures`, `WinLikelihoodFeaturesService`.
- **Tendering controller** lives at `apps/api/src/modules/tendering/tendering.controller.ts` and
  uses `JwtAuthGuard` + `PermissionsGuard` + `@RequirePermissions('tenders.view')` for all
  tender-read routes. Do NOT invent a new permission.
- **Reporting framework** exists at `apps/api/src/modules/reporting/` (service + controller +
  `tender-winloss-report.definitions.ts`). The BP-1 endpoint may be expressed as a tenders route
  (preferred for consistency) or as a `ReportDefinition`. Read the reporting module before
  deciding; if the existing report infra is a clean fit, use it. Otherwise, add a dedicated GET
  route on the tendering controller.

## What to build

### 1. New module — `apps/api/src/modules/bid-prioritisation/`

Create a standalone NestJS module with:

#### `bid-prioritisation.service.ts`

```typescript
@Injectable()
export class BidPrioritisationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly winLikelihood: WinLikelihoodService,
  ) {}

  async getRankedOpenTenders(): Promise<BidPriorityItem[]>
}
```

The service MUST:

1. Fetch all open tenders in ONE query (status `OPEN` or equivalent — verify the actual status
   value used in schema.prisma before hardcoding). Include `id`, `title`, `estimatedValue`,
   `dueDate`, `tenderClients` (with client name). Do NOT issue a per-tender DB query in a loop.

2. For each open tender, call `WinLikelihoodService.computeForTender(tenderId)` (or the correct
   method name — read the service before calling). Because win-likelihood computes a cohort from
   the DB, batch these calls appropriately: either (a) call them in parallel with
   `Promise.all(tenders.map(...))` so N individual queries run concurrently, or (b) if the
   service supports a batch input, use that. Do NOT call them in a sequential `for…await` loop
   (that is the N+1 pattern this slice must avoid).

3. Compute the expected-value score for each tender:
   ```typescript
   const BID_PRIORITY_WEIGHT = 1.0; // Admin-configurable in future; constant for now.

   score = pointEstimate !== null && estimatedValue !== null
     ? pointEstimate * Number(estimatedValue) * BID_PRIORITY_WEIGHT
     : null;
   ```
   Export `BID_PRIORITY_WEIGHT` as a named constant so BP-2 and future admin-config slices can
   reference it.

4. Return a `BidPriorityItem[]` sorted descending by `score` (nulls / `insufficientData: true`
   items sorted to the end).

#### `BidPriorityItem` interface (export from the service file or a types file)

```typescript
export interface BidPriorityItem {
  tenderId: string;
  title: string;
  client: string | null;         // primary client name; null if no tenderClient rows
  estimatedValue: number | null; // Decimal.toNumber() — handle Decimal explicitly
  dueDate: Date | null;
  pointEstimate: number | null;  // null → insufficientData
  confidence: ConfidenceLabel;
  expectedValueScore: number | null; // null → insufficientData
  whyFactors: WhyFactor[];
  insufficientData: boolean;     // true when pointEstimate is null OR valueBand is UNKNOWN
}
```

`Decimal.toNumber()` handling: `estimatedValue` on Tender is `Decimal?`. Convert with
`.toNumber()` where it is not null. Never pass a raw `Decimal` to JSON serialisation — it will
render as an object.

#### `bid-prioritisation.module.ts`

Standard NestJS module. Import `WinLikelihoodModule` (check its export in
`win-likelihood.module.ts` before importing). Register in `apps/api/src/app.module.ts`.

### 2. Route on the tendering controller

Add to `apps/api/src/modules/tendering/tendering.controller.ts`:

```
GET /tenders/priority-ranking
```

Guard: same `JwtAuthGuard` + `PermissionsGuard` + `@RequirePermissions('tenders.view')` as every
other tender-read route. Inject `BidPrioritisationService` and call `getRankedOpenTenders()`.

Add the JSDoc advisory note on the handler:

```typescript
/**
 * ADVISORY ONLY — this ranking MUST NOT feed pricing, auto-accept, or auto-reject.
 * It is a decision-support surface only.
 */
```

Import `BidPrioritisationModule` in `tendering.module.ts` so the service is injectable.

### 3. Unit tests — `bid-prioritisation.service.spec.ts`

Use the same Prisma-mock pattern as `win-likelihood.service.spec.ts` and the tendering module
specs. Tests must cover:

- Score is correctly computed: `pointEstimate × estimatedValue × BID_PRIORITY_WEIGHT`.
- Tender with null `pointEstimate` → `insufficientData: true`, score null, sorted last.
- Tender with null `estimatedValue` → `insufficientData: true`, score null, sorted last.
- Tenders with real scores sorted descending before null-score tenders.
- `Decimal` is converted to `number` (not left as a Prisma Decimal object).
- Advisory-only: the service has no write path (no Prisma create/update/delete call).

### 4. Import wiring

- Register `BidPrioritisationModule` in `apps/api/src/app.module.ts`.
- Import it into `apps/api/src/modules/tendering/tendering.module.ts`.
- Inject `BidPrioritisationService` into the tendering controller.

## Do NOT

- Do NOT change `schema.prisma` or add a migration in this slice. The weight constant is code,
  not data. If a future admin-config slice wants a DB row, that is a separate slice.
- Do NOT re-implement win-likelihood computation. Call `WinLikelihoodService` — do not copy its
  logic or add stats/ML dependencies.
- Do NOT invent a new permission — reuse `tenders.view`.
- Do NOT show a fake score of `0` for null/UNKNOWN inputs — use `null` + `insufficientData: true`.
- Do NOT build any UI — that is BP-2.
- Do NOT duplicate WL3-S2 (single-tender detail widget).
- Do NOT touch `/sot/`, Azure/Entra/SharePoint, or any file outside declared scope.
- Do NOT use `requires_merged` — use `requires_file_on_main` for dependencies.
