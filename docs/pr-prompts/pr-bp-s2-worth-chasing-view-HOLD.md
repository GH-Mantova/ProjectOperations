---
premise: '! test -f apps/web/src/pages/tenders/BidPriorityPage.tsx'
premise_means: The "Worth Chasing" ranked view page does not exist yet; BP-2 has not landed.
scope:
  - apps/web/src/pages/tenders/**
  - apps/web/src/routes/**
  - apps/web/src/components/tenders/**
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/tenders/BidPriorityPage.tsx && grep -rq "BidPriorityPage" apps/web/src/routes
size: 6
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main:
  - apps/api/src/modules/bid-prioritisation/bid-prioritisation.service.ts
---

# HOLD — BP-2: Web "worth chasing" ranked view (advisory)

STATUS: DRAFTED, STAGED, HOLD. Arm by renaming to
`pr-bp-s2-worth-chasing-view-ready.md`. Chained behind BP-1 via `requires_file_on_main`; the
watcher will DEFER this until BP-1 has landed on `origin/main`.

Ships the frontend for the bid-prioritisation program
(`docs/plans/bid-prioritisation-plan.md`). Consumes BP-1's `bid-priority-worth-chasing`
ReportDefinition via the existing report-runner plumbing. **No API changes in this slice.**

## ADVISORY ONLY — non-negotiable

The ranking this slice surfaces MUST NEVER feed pricing, auto-accept, or auto-reject. The
page and the priority column are read-only advisory surfaces; humans decide. This is the
WL-3 guardrail inherited unchanged, and the plan's Locked Decision #1. Render the advisory
banner (verbatim from the WL-3 guardrail) at the top of `BidPriorityPage.tsx`.

## What to build

1. **`apps/web/src/pages/tenders/BidPriorityPage.tsx`** — new page.
   - Fetches via the existing report-runner call for key `bid-priority-worth-chasing`.
   - Sortable table columns: tender number, title, client, `estimatedValue`,
     `pointEstimate` (with a small "why" tooltip listing `whyTopFactors`), `expectedValue`.
   - **Two sections**: the ranked cohort first (rows with `dataStatus: "OK"`, sorted by
     `expectedValue DESC`), then a separately-headed "Insufficient data" section pinned
     BELOW containing rows with `dataStatus: "INSUFFICIENT_DATA"`. Do NOT show `$0` or `—`
     in the expected-value column for those rows; label them "insufficient data" so the
     reason is legible.
   - Advisory banner at the top: *"Advisory only — this ranking does not feed pricing,
     auto-accept, or auto-reject."*
   - Uses `tenders.view` for RBAC — REUSE the existing permission; do NOT invent a new one.

2. **Priority column on the tender pipeline list** — additive column in
   `apps/web/src/pages/tenders/**` (whichever component renders the pipeline list; locate
   with `grep -r "pipeline" apps/web/src/pages/tenders`). The column shows
   `pointEstimate` + `expectedValue` (or "insufficient data"), links through to
   `BidPriorityPage` for context. Existing default sort is unchanged; users opt in by
   clicking the column header. **Do NOT render a second copy of the win-likelihood detail
   panel** — clicking through to a tender should route to the existing tender detail page
   where the WL3-S2 widget lives (once WL3-S2 lands).

3. **Route + nav** — register `BidPriorityPage` at `/tenders/priority` (or the pattern the
   existing tender routes follow) in `apps/web/src/routes/**`, and add a nav entry under
   the Tenders section next to "Pipeline".

4. **Unit tests** — cover:
   - sort direction toggle;
   - null-bucket rendering (rows with `dataStatus: "INSUFFICIENT_DATA"` are rendered in
     the separate section, never in the ranked cohort);
   - RBAC gate (page renders forbidden UI when `tenders.view` is missing).

## Do NOT

- Do NOT change the API — this slice is frontend only. If BP-1's output shape needs a
  change, stop, `NO-OP: bp-1 shape wrong`, and re-author BP-1.
- Do NOT duplicate WL3-S2's single-tender detail widget. Link through to the tender detail
  page; do not re-render the win-likelihood panel on the ranked list.
- Do NOT show `$0` or `—` for null `expectedValue` — use the explicit "insufficient data"
  section per plan Locked Decision #3.
- Do NOT invent a new permission — reuse `tenders.view`.
- Do NOT let anything on this page or column feed pricing, auto-accept, or auto-reject.
- Do NOT touch `/sot/`. Do NOT change `schema.prisma`. Do NOT add API endpoints.
- Do NOT use `requires_merged`; the dependency is expressed via `requires_file_on_main`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if this is already on main, say `NO-OP: <reason>`.
- **Never ask a question or "stand by" for a go/no-go.** The go was given when this prompt
  was armed.
- Read the CI job log before diagnosing a failure. `pnpm build` and `pnpm lint` must pass.

## VERIFY

- `pnpm build && pnpm lint` green.
- `pnpm --filter @project-ops/web test` green including new unit tests.
- `apps/web/src/pages/tenders/BidPriorityPage.tsx` exists.
- Route registered in `apps/web/src/routes/**` (grep-verifiable).
- Nav entry visible under the Tenders section.
- No API file (`apps/api/**`) is modified in the diff.
