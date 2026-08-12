---
premise: '! test -f apps/web/src/pages/tendering/BidPriorityRankingPage.tsx'
premise_means: No bid-priority ranked view page exists on main yet — BP-2 (worth-chasing view) has not run.
requires_file_on_main: apps/api/src/modules/bid-prioritisation/bid-prioritisation.service.ts
scope:
  - apps/web/src/pages/tendering/BidPriorityRankingPage.tsx
  - apps/web/src/hooks/useBidPriorityRanking.ts
  - apps/web/src/components/tendering/**
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/tendering/BidPriorityRankingPage.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# BP-2 — Web "worth chasing" ranked view

**Binding plan:** `docs/plans/bid-prioritisation-plan.md` (read it in full before starting).
This is **BP-2**, the second and final slice of the bid-prioritisation program. It builds the
frontend ranked "worth chasing" view on top of the `GET /tenders/priority-ranking` endpoint
shipped in BP-1.

**ADVISORY ONLY.** The rankings displayed by this view MUST NEVER be presented as a pricing
recommendation, acceptance decision, or auto-reject signal. The page MUST carry a visible advisory
label. This guardrail is non-negotiable.

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

## Grounded state on main (read before coding)

- **BP-1 is merged** (gated by `requires_file_on_main` above). The endpoint is:
  `GET /tenders/priority-ranking` — returns `BidPriorityItem[]` (fields: `tenderId`, `title`,
  `client`, `estimatedValue`, `dueDate`, `pointEstimate`, `confidence`, `expectedValueScore`,
  `whyFactors`, `insufficientData`).
- **WL3-S2** (single-tender detail widget) may or may not be merged by the time this runs. Before
  adding a win-likelihood column to the tender pipeline list, **check whether WL3-S2 already added
  one**. If it did, coordinate (do not duplicate the column). If it did not, add the column once.
- **Existing web app structure:** read `apps/web/src/pages/tendering/` before creating the new
  page to follow the exact naming and routing conventions already in use.

## What to build

### 1. `apps/web/src/hooks/useBidPriorityRanking.ts`

A React hook that calls `GET /tenders/priority-ranking` via the existing API client (match the
pattern of other tendering hooks — do not hand-roll fetch). Returns `{ data, isLoading, error }`.

### 2. `apps/web/src/pages/tendering/BidPriorityRankingPage.tsx`

A page component rendering the ranked list as a sortable table with columns:

| Column | Source field | Notes |
|---|---|---|
| Tender | `title` | Link to tender detail |
| Client | `client` | — |
| Est. Value | `estimatedValue` | Formatted as currency; null → "—" |
| Due Date | `dueDate` | Formatted date; null → "—" |
| Win-likelihood | `pointEstimate` | As %; null → "Insufficient data" |
| Confidence | `confidence` | LOW / MEDIUM / HIGH badge |
| Priority Score | `expectedValueScore` | Formatted currency × % result; null → "Insufficient data" |
| Why | `whyFactors` | Expandable or tooltip showing top 2 factors |

Behaviour:
- Default sort: `expectedValueScore` descending; `insufficientData: true` rows sorted to the
  bottom, never mixed with scored rows.
- Tenders with `insufficientData: true` show "Insufficient data" in the Win-likelihood and
  Priority Score columns — never a fake 0 or empty cell.
- **Advisory label** (non-removable, visible at top of page):
  > "Rankings are advisory only and do not feed pricing or acceptance decisions."
- Loading state and empty state handled.
- Use existing UI component library patterns (match other tendering pages for table, badge, etc.).

### 3. Route registration

Wire `BidPriorityRankingPage` into the app router. Follow the pattern of other tendering pages
for the route path (e.g. `/tenders/priority-ranking` or `/tendering/priority`) — read the router
before deciding; do not invent a new routing pattern.

Add a navigation entry (sidebar or sub-nav) following the existing tendering navigation
conventions. Check `apps/web/src/` for the nav definition file before editing.

### 4. Win-likelihood column on the tender pipeline list

Before adding this column: **check whether WL3-S2 already added a win-likelihood column to the
tender pipeline list.** If WL3-S2 is merged and the column exists, do NOT add it again. If the
column does not exist yet, add a "Win-likelihood" column showing `pointEstimate` as a % (or
"—" for null) to the existing pipeline list page.

## Do NOT

- Do NOT build the API endpoint — that is BP-1 (already merged by the time this runs).
- Do NOT re-implement win-likelihood computation in the frontend.
- Do NOT duplicate WL3-S2 (the single-tender detail widget on the detail page).
- Do NOT remove the advisory-only label from the page under any circumstances.
- Do NOT show a fake score of 0 for null/UNKNOWN inputs — show "Insufficient data".
- Do NOT touch `/sot/`, Azure/Entra/SharePoint, `schema.prisma`, or any API-layer file.
- Do NOT exceed 5 files.
- Do NOT use `requires_merged` — dependency is declared via `requires_file_on_main` above.
