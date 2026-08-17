---
premise: 'grep -qF "[filters, setFilters] = useState" apps/web/src/pages/tendering/TenderingPage.tsx'
premise_means: The tendering page still uses ONE shared filter state for both views and a single hard-100-capped fetch (independent per-view filters, the 4-stage board, and full-dataset render are not implemented).
scope:
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/tendering/__tests__/**
done_when: pnpm build && pnpm lint && ! grep -qF "buildQueryString(withFilters, 100)" apps/web/src/pages/tendering/TenderingPage.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# tender-lifecycle S1 — Pipeline/Register fix (4-stage board + independent per-view filters + full-dataset render)

## Why
At 534 tenders the tendering page has three linked defects, all in `apps/web/src/pages/tendering/TenderingPage.tsx`:
1. The kanban and the header `$`/win-rate stats only ever see the first 100 rows — `reload` issues a single `buildQueryString(withFilters, 100)` fetch (~line 395), and the API's shared `PaginationQueryDto` hard-caps `pageSize` at 100 (so raising the number is NOT an option — page client-side).
2. One shared `filters` state (~line 349) drives BOTH views, so filters set in the Register silently constrain the Pipeline, which has no filter bar to show or clear them.
3. The board shows all 7 statuses as columns; per the agreed model the Pipeline is a submission board of only four stages.

This slice fixes all three. **Frontend only — no API, DTO, or schema change.** (SLICE-0 plan: `docs/architecture/drafts/tender-pipeline-register-plan.md`.)

## What to build
1. **Four-stage Pipeline board.** Add a `PIPELINE_STAGES = ["DRAFT", "IN_PROGRESS", "SUBMITTED", "WITHDRAWN"]` const and use it for the kanban `byStage` grouping (~line 458) and the pipeline render branch's `STAGES.map` (~line 780). Tenders whose status is an outcome (AWARDED / CONTRACT_ISSUED / LOST / CONVERTED) are simply NOT board cards — do not add columns for them and do not fold them in. Leave `TENDER_STATUSES` and the tender-detail status dropdown untouched (they keep all statuses).
2. **Independent per-view filters.** Replace the single `[filters, setFilters]` with two independent states, `pipelineFilters` and `registerFilters` (each defaulting to `EMPTY_FILTERS`). The active view fetches with its own filters; switching views must NOT carry one view's filters into the other. Lift the existing filter bar so BOTH view branches render it, each wired to its own view's filters + change handler (the Pipeline branch currently has no filter bar — give it one driving `pipelineFilters`). Keep the default-preset behaviour applying to the Register; the Pipeline starts unfiltered.
3. **Full-dataset render via client-side loop-pagination.** Replace the single capped fetch in `reload` with a helper that pages `/tenders` at `pageSize=100` — page 1..N until all `total` rows are collected — passing the SAME filters + sort on every page so the concatenation stays in server-sort order. Derive `byStage`, `registerRows` and `stats` from the FULL set so the columns, per-column `$` totals, and the header pipeline `$`/win-rate are correct. Add a safety ceiling (stop at ~50 pages / 5000 rows) and surface a small "showing first N of total" note if it is ever hit, rather than silently truncating.

## Do NOT
- Do NOT change any API: no edits to `/tenders`, the tendering controller/service, `TenderQueryDto`, or `PaginationQueryDto`. Page client-side within the existing 100 cap.
- Do NOT change the Prisma schema or add a migration.
- Do NOT shrink `TENDER_STATUSES` or the tender-detail status dropdown — only the KANBAN COLUMNS reduce to the four submission stages.
- Do NOT add a CONVERTED column or move outcome statuses onto the board.
- Do NOT rework the RegisterView columns, presets, or bulk actions beyond wiring it to `registerFilters` and the full dataset.
- Keep server-side sort as the source of row order for the register (it is already sent in `buildQueryString`).

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. If the work is already on `main`, say `NO-OP: <reason>` and stop. Never exit silently.
- Never ask a question or "stand by" for approval — there is no human in this run. Open the PR.
- If a CI check fails, read the job log before diagnosing.
- Do NOT auto-merge — open the PR and leave it unmerged (Marco reviews the diff).

## VERIFY
- `pnpm build`
- `pnpm lint`
- The web test suite, including new unit tests: `byStage` buckets ONLY the four submission stages; the loop-paginate helper accumulates every page for a >100-row dataset; setting `registerFilters` does not change `pipelineFilters` (and vice-versa).
- `! grep -qF "buildQueryString(withFilters, 100)" apps/web/src/pages/tendering/TenderingPage.tsx` (the single capped fetch is gone).
- Manual check the acceptance suite / smoke for the tendering page still passes.
