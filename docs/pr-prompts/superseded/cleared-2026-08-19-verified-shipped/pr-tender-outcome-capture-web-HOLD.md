---
premise: '! test -f apps/web/src/pages/tendering/OutcomeCaptureModal.tsx'
premise_means: There is no web surface to record a tender outcome on close, and no way to see or backfill closed tenders that have no recorded outcome.
requires_file_on_main: apps/api/src/modules/tendering/tender-outcome-capture.service.ts
scope:
  - apps/web/src/pages/tendering/OutcomeCaptureModal.tsx
  - apps/web/src/pages/tendering/TenderKanbanBoard.tsx
  - apps/web/src/pages/tendering/outcomeApi.ts
  - apps/web/src/pages/tendering/NeedsOutcomePanel.tsx
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/tendering/OutcomeCaptureModal.tsx && test -f apps/web/src/pages/tendering/NeedsOutcomePanel.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
---

# WL-1b — Tender outcome capture (web): prompted-but-skippable modal + "needs outcome" surface

Slice WL-1b of the tender win/loss program (`docs/plans/tender-winloss-datacapture-plan.md`).
Depends on WL-1a (`feat/tender-outcome-capture-api`), which adds `TenderOutcome.resultType`
(`WON`/`LOST`/`NO_BID`), `.reason` (bounded `TenderOutcomeReason` enum), `.tenderValue`, `.ourPrice`,
`.clientId`, `.scopeSummary`, `.competitorOrWinner`, the append-only supersede chain, the outcome
payload on `PATCH /tenders/:id/status`, and the standalone `POST /tenders/:id/outcome` backfill
endpoint. **Verify those exist on `main` before building** (the `requires_file_on_main` gate holds
this prompt until WL-1a lands).

Marco's decision (2026-08-10): capture is **prompted but SKIPPABLE**. The modal must never block the
close; the "needs outcome" panel is the safety net that keeps skippable from silently rotting the data.

## What to build

1. **`apps/web/src/pages/tendering/outcomeApi.ts` (new)** — a tiny typed client: `recordOutcome(tenderId, payload)` → `POST /tenders/:id/outcome`, and the `TenderOutcomeResult` / `TenderOutcomeReason` union types + human labels (mirror the API enum values exactly). Also a `listTendersNeedingOutcome()` helper if a dedicated endpoint exists; otherwise derive from the existing tenders list (closed status + no current outcome) — check the tenders API client first and reuse it.

2. **`apps/web/src/pages/tendering/OutcomeCaptureModal.tsx` (new)** — the capture form: result (WON/LOST/NO_BID; **pre-filled from the target/close context** — LOST column → LOST, awarded/converted → WON), reason (a `<select>` of the bounded enum, **shown only when result !== WON**), tender value, our price, competitor/winner, scope summary, optional note. Two EQUALLY-weighted actions: **Save** and **Skip** (no dark-pattern nudging; Skip closes the modal and does nothing). Reason is not required by the UI (skippable) but if result is LOST/NO_BID the reason `<select>` defaults to a visible unselected state so the user is nudged, not forced.

3. **`apps/web/src/pages/tendering/TenderKanbanBoard.tsx`** — when a card is dragged to a terminal column (AWARDED / CONTRACT_ISSUED / CONVERTED / LOST / WITHDRAWN), perform the status change **optimistically** (do not revert/hold the card animation), then open `OutcomeCaptureModal`. On Save, call the outcome path (either the outcome payload on the status PATCH, or `outcomeApi.recordOutcome` after) and show a success toast; on Skip, leave the card closed with no outcome. Locate the existing drag-drop close handler and extend it — do not rewrite the board.

4. **`apps/web/src/pages/tendering/NeedsOutcomePanel.tsx` (new)** — a compact list/panel of **closed tenders with no current recorded outcome** (terminal status + no non-superseded `TenderOutcome`). Each row has a "Record outcome" action that opens the same `OutcomeCaptureModal` and calls the backfill endpoint. Surface this panel where estimators will see it (e.g. a collapsible section on the Tenders page or its CRM tab — reuse the existing tenders page layout; do not build a new route). This is the gap-visibility safety net for skippable capture.

## Do NOT

- Do **not** block, delay, or revert the close if the user Skips — skippable is the whole point.
- Do **not** add a new top-level route or nav item — mount the panel inside the existing Tenders page/tab.
- Do **not** change the tender status lifecycle, the API, the schema, or any file outside `apps/web/src/pages/tendering/**`.
- Do **not** touch Azure/Entra/SharePoint or `sot/`.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. If something is genuinely impossible given the stated scope, do not exit silently —
  say `NO-OP: <reason>` and explain what blocked it.
- Never stand by for approval; there is no human to approve mid-run.
- If CI fails, read the actual job log before diagnosing.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
