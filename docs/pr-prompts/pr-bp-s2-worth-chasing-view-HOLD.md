---
premise: '! grep -rq "bid-prioritisation\|bidPrioritisation\|worth-chasing" apps/web/src'
premise_means: The BP-2 "worth chasing" ranked view and pipeline column do not exist in the web app yet.
scope:
  - apps/web/src/pages/tendering/BidPrioritisationPage.tsx
  - apps/web/src/pages/tendering/BidPrioritisationPage.test.tsx
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/api/bid-prioritisation.ts
  - apps/web/src/App.tsx
requires_file_on_main:
  - apps/api/src/modules/win-likelihood/bid-prioritisation.service.ts
done_when: pnpm build && pnpm lint && grep -rq "BidPrioritisation\|worth-chasing" apps/web/src
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# feat(web): BP-2 — "worth chasing" ranked view + pipeline column (WL3 extension, advisory only)

Implement **SLICE BP-2** of `docs/plans/bid-prioritisation-plan.md`. Read that plan and the
BP-1 slice prompt/PR before writing any code — BP-1 defines the API contract this consumes.

## ADVISORY ONLY
The ranking and the pipeline column MUST NEVER feed pricing, auto-accept, or auto-reject.
They surface information; humans decide. The page and column MUST include a visible
"Advisory only — human decides" strapline / tooltip.

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

### 1. `apps/web/src/api/bid-prioritisation.ts` (new)

Typed fetcher for `GET /tenders/bid-prioritisation` (the BP-1 endpoint). Mirror the
existing web-api client conventions in `apps/web/src/api/` — do NOT introduce a new HTTP
layer or React-Query alternative. Export:

- The `RankedTender` row type (matches the BP-1 response shape:
  `tenderId, name, clientId, dueDate, estimatedValue, pointEstimate, ciLow, ciHigh,
  valueBand, whyFactors, expectedValue, insufficientData, weightApplied`).
- A `listBidPrioritisation({ limit })` function.

### 2. `apps/web/src/pages/tendering/BidPrioritisationPage.tsx` (new)

A sorted table (or list) with columns:

- Tender (link to detail)
- Client
- Estimated value (currency)
- Win-likelihood (percentage + CI in a tooltip, using the `ciLow` / `ciHigh` from the API)
- **Expected value** (currency; primary sort key)
- Top 3 why-factors (chips or compact text)
- "Insufficient data" badge where the API returns `insufficientData: true`

Behaviour:

- Rows with `insufficientData: true` render in a clearly-labelled bottom bucket
  ("Insufficient data — not ranked") and MUST NOT render a fake `0` expected value.
- Include the ADVISORY-ONLY strapline at the top of the page.
- Reuse the existing loading / empty / error patterns from a neighbouring tendering page
  (e.g. `TenderingPage.tsx`) — do NOT introduce a new state-management library.

### 3. `apps/web/src/pages/tendering/TenderingPage.tsx` (edit)

Add a **win-likelihood / expected-value column** to the existing tender pipeline list, and
make it sortable. The column reads from the same BP-1 endpoint (call once for the visible
cohort; join into the existing rows client-side by `tenderId`). If the join has no match,
render "—" (never `0`).

Coordinate with — do NOT duplicate — WL3-S2's per-tender detail widget (planned in
`docs/plans/tender-winloss-ml-plan.md`). If WL3-S2 has already merged and exposes a shared
`<WinLikelihoodChip />` component, reuse it; otherwise render a lean inline chip and leave
a `TODO(WL3-S2)` marker so the widget slice can consolidate later.

### 4. `apps/web/src/App.tsx` (edit)

Register the new `BidPrioritisationPage` route (e.g. `/tendering/priorities` or the closest
sibling to the existing tendering routes — mirror what neighbouring pages register). Do NOT
restructure the router.

### 5. `apps/web/src/pages/tendering/BidPrioritisationPage.test.tsx` (new)

Vitest + React Testing Library (the pattern already used in `apps/web/src/pages/`). Cover:

- Renders the ranked rows in DESC expected-value order.
- Rows with `insufficientData: true` render in the bottom bucket, show the badge, and do
  NOT render a `0` in the expected-value cell.
- The ADVISORY-ONLY strapline is present.
- Error / empty states render without throwing.

## Do NOT

- Do NOT re-implement the ranking on the web side — always consume BP-1's endpoint.
- Do NOT render `0` for `insufficientData` rows — render an explicit badge.
- Do NOT duplicate WL3-S2's per-tender detail widget. Coordinate; do not overlap.
- Do NOT invent a new permission — the endpoint is already `tenders.view`-gated.
- Do NOT let the column or page feed pricing / auto-accept / auto-reject flows.
- Do NOT touch `/sot/`, Azure/Entra/SharePoint, or files outside `scope`.
- Do NOT exceed 10 files.
