---
premise: '! grep -rq "bid-prioritisation\|bidPrioritisation\|priority-bids" apps/api/src'
premise_means: The BP-1 bid-prioritisation priority API / report has not been built yet.
scope:
  - apps/api/src/modules/tendering/tendering.controller.ts
  - apps/api/src/modules/win-likelihood/bid-prioritisation.service.ts
  - apps/api/src/modules/win-likelihood/bid-prioritisation.service.spec.ts
  - apps/api/src/modules/win-likelihood/win-likelihood.module.ts
done_when: pnpm build && pnpm lint && grep -rq "bid-prioritisation\|bidPrioritisation" apps/api/src/modules/win-likelihood
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# feat(api): BP-1 — cross-tender bid-prioritisation priority API (WL3 extension, advisory only)

Implement **SLICE BP-1** of `docs/plans/bid-prioritisation-plan.md`. Read that plan in full
before writing any code — the "Locked decisions" section is binding.

## ADVISORY ONLY
The bid-prioritisation ranking MUST NEVER feed pricing, auto-accept, or auto-reject.
It ranks and surfaces; humans decide. State this in a doc-comment on the new service and
on the endpoint's `@ApiOperation` summary.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if this is already on main, say `NO-OP: <reason>`.
- **Never ask a question or "stand by" for a go/no-go.** The go was given when this prompt was armed.
- Read the CI job log before diagnosing any failure. `pnpm build` and `pnpm lint` must pass.

## What to build

### 1. `apps/api/src/modules/win-likelihood/bid-prioritisation.service.ts` (new)

`@Injectable()` service exposing a single method, e.g.:

```typescript
async listRankedOpenTenders(options?: { limit?: number; weight?: number }): Promise<RankedTender[]>
```

Behaviour:

1. Load OPEN tenders (exclude tenders whose current outcome is WON/LOST/WITHDRAWN via
   `resolveCurrentOutcome` — reuse from `win-likelihood-features.service.ts`; a tender is
   "open" if it has no settled outcome and its `status` is not a terminal internal state).
   Select only the fields you need (id, name, dueDate, estimatedValue, clientId).
2. For each tender, call `WinLikelihoodService` (already registered in `win-likelihood.module.ts`)
   to obtain `{ pointEstimate, ciLow, ciHigh, whyFactors, valueBand }`. Do NOT recompute the
   scorer inline. Batch the calls (e.g. `Promise.all` over the cohort) so the response is a
   single round-trip cost, not N+1.
3. Compute `expectedValue`:
   - If `pointEstimate == null` OR `estimatedValue == null` OR `valueBand === "UNKNOWN"`:
     `expectedValue = null` and `insufficientData: true`.
   - Otherwise: `expectedValue = pointEstimate * Number(estimatedValue) * weight`,
     using `Decimal.toNumber()` on `estimatedValue` (mirror WL3-S1's Decimal handling).
4. Read `weight` from an admin-configurable setting; default `1`. **Prefer an existing
   `SystemSetting`/`AdminSetting`-shaped table**: read a JSON blob under a stable key
   (e.g. `bidPrioritisation.weight`). If no suitable table exists on `main`, default the
   weight to `1` and leave a `TODO(BP-1b)` comment naming the setting key — do NOT invent a
   new schema in this slice (that would trigger `gate_allow: migrations` and expand blast
   radius; the plan explicitly rules that out unless unavoidable).
5. Sort DESC by `expectedValue`; tenders with `insufficientData: true` sort last, grouped
   under a stable secondary sort by `dueDate` ASC.
6. Return the top `limit` rows (default e.g. 50; hard cap 200) with the shape:
   `{ tenderId, name, clientId, dueDate, estimatedValue, pointEstimate, ciLow, ciHigh,
   valueBand, whyFactors, expectedValue, insufficientData, weightApplied }`.

Add a doc-comment on the class that begins with:
`ADVISORY ONLY — this ranking MUST NEVER feed pricing, auto-accept, or auto-reject.`

### 2. `apps/api/src/modules/win-likelihood/win-likelihood.module.ts` (edit)

Register `BidPrioritisationService` as a provider AND export it, so the tendering module
(which already imports `WinLikelihoodModule` and consumes `WinLikelihoodService`) can inject
it. Do NOT restructure the module.

### 3. `apps/api/src/modules/tendering/tendering.controller.ts` (edit)

Add a new endpoint alongside the existing `win-likelihood/capture-gaps` and
`:id/win-likelihood` routes:

```typescript
@Get("bid-prioritisation")
@RequirePermissions("tenders.view")
@ApiOperation({ summary: "BP-1 — Ranked OPEN tenders by expected value (ADVISORY ONLY, MUST NEVER feed pricing or auto-accept/reject)" })
listBidPrioritisation(@Query("limit") limitStr?: string) { ... }
```

- Route MUST be declared BEFORE the `:id` route (same reason the existing win-likelihood
  routes are — see the comment above the `:id` route in this controller).
- Reuse the `tenders.view` permission — do NOT invent a new one.
- Parse/clamp `limit` (integer, 1..200, default 50).
- Inject `BidPrioritisationService` via the constructor (extend the constructor arg list;
  do NOT re-order existing args).

### 4. `apps/api/src/modules/win-likelihood/bid-prioritisation.service.spec.ts` (new)

Unit tests using the standard Prisma-mock pattern already used by
`win-likelihood.service.spec.ts` in the same folder. Cover:

- Ranks two tenders correctly by `pointEstimate x estimatedValue` (higher first).
- `weight` is applied (weight=2 doubles the score; ordering preserved).
- Null `pointEstimate` → `insufficientData: true`, `expectedValue: null`, sorted LAST.
- Null `estimatedValue` (or `valueBand: "UNKNOWN"`) → `insufficientData: true`, sorted LAST.
- Two `insufficientData` rows sort by `dueDate` ASC.
- `limit` clamps to 200 and defaults to 50.
- Terminal-outcome tenders are excluded from the cohort.

Do NOT introduce a new testing library. Mock `WinLikelihoodService` — do NOT rebuild it in
the test.

## Do NOT

- Do NOT recompute win-likelihood inline. Call `WinLikelihoodService`.
- Do NOT add ML/stats library dependencies.
- Do NOT invent a new permission — reuse `tenders.view`.
- Do NOT surface a fake `0` for null/UNKNOWN inputs — set `insufficientData: true` and
  `expectedValue: null`.
- Do NOT modify `schema.prisma` or add a migration in this slice. If you genuinely cannot
  find any admin-config surface to hang the weight off, default to `1` and leave a TODO —
  a schema change is a separate slice (BP-1b) with its own gate declaration.
- Do NOT build any UI here — the ranked view is BP-2.
- Do NOT touch `/sot/`, Azure/Entra/SharePoint, or files outside `scope`.
- Do NOT exceed 10 files.
