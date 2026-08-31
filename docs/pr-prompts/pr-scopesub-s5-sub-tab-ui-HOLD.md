---
premise: '! grep -q "SubQuotePicker" apps/web/src/pages/tendering/scope-cards'
premise_means: The SUB tab has no way to link a WBS item or record the quotes received, so the model shipped in slice 4 is unreachable from the screen.
scope:
  - apps/web/src/pages/tendering/scope-cards/SubQuotePicker.tsx
  - apps/web/src/pages/tendering/scope-cards/SubLinkPicker.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCard.tsx
  - apps/web/src/pages/tendering/scope-cards/utils/card-display.ts
  - apps/web/src/pages/tendering/scope-cards/__tests__/sub-tab.test.tsx
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -rq "SubQuotePicker" apps/web/src/pages/tendering/scope-cards
size: 5
gate_allow: none
seed_only: false
escalates: true
cluster: scope-subcontracted
cluster_order: 5
requires_on_main: 'apps/api/src/modules/tendering/scope-redesign.service.ts :: SUB_LINE_PRICES_LINKED_ITEM'
---

# The SUB tab — link the work, list the quotes

Slice 4 shipped the link field, the quote table, the double-count guard and the endpoints, all
proven by tests and all unreachable from the screen. This is the screen. **Web-only — do not add or
change any API route, service method or DTO.**

Approved mock-up: `https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

## What to build

1. **`SubLinkPicker`** — on a SUB line, a control that either leaves the line describing its own
   scope or links it to WBS items on the other tabs. The picker lists items from the same tender
   grouped by discipline, shows each item's current price so the estimator can see what they are
   about to move, and excludes items already linked to another SUB line.

   **A linked item must announce itself on its own tab, not only here.** On the DEM/CIV/ASB tab the
   covered row renders its manpower and plant greyed with **"priced on SUB1.1"** in their place, and
   its line total reads `$0.00`, not blank. An estimator looking at the DEM tab must be able to see
   why the number moved without going to find the SUB tab. This is the single most important piece
   of this slice: the guard is invisible otherwise, and an invisible guard reads as a bug.

2. **`SubQuotePicker`** — the quotes received against a SUB line. Each row: supplier (from the
   subcontractor directory, or a typed name when the vendor is not in it yet), amount, received
   date, notes, and a magnifier that attaches an existing tender document as the quote file. One
   row is selected; the rest show their **delta against the selected one** (`+$4,200`, `−$1,150`),
   because the reason to keep losing quotes is to see the spread.

3. **A SUB line with quotes but none selected is visibly incomplete** — it prices at `$0.00` by
   slice 4's rule, so the UI must say so rather than let a zero read as free. Surface it the same
   way the card surfaces other incomplete state; do not invent a new alert pattern.

4. **The SUB summary bar**, as in the mock: *in the quote $59,800 · provisional $16,120 · SUB total
   $75,920*. The provisional split comes from slice 3's per-line flag — read it, do not recompute it.

5. **Test** at `.../scope-cards/__tests__/sub-tab.test.tsx`: linking an item renders "priced on
   SUB1.1" on the covered row and zeroes its total; unlinking restores it; selecting a different
   quote changes the line price and re-bases every delta; a line with unselected quotes renders its
   incomplete state.

## Do NOT

- Do not add, change or remove any API route, service method or DTO — slice 4 finished the server.
- Do not recompute prices in the client. Every figure comes from the API. A second implementation of
  the double-count guard in TypeScript is exactly how the two drift.
- Do not build an upload control. The magnifier picks an existing `TenderDocumentLink`.
- Do not change the Waste, Cutting or Other operational costs sections.
- Do not touch `/sot/`.

## VERIFY

- `pnpm --filter @project-ops/web test` green.
- Brand tokens only — sot/01 SECTION 5 is permanent. No hardcoded colour values, and the greyed
  "priced on SUB1.1" state must stay legible in both themes.
- Tables and fields size fit-to-contents then fit-to-window, per Marco's standing layout rule: the
  column must not resize as quotes are added, and no text may overflow its box.
- State in the PR body what a covered row looks like on its own discipline tab. If it looks the same
  as an unpriced row, the slice is not done.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if you cannot proceed, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the job log before diagnosing any CI failure.
- `escalates: true` gates the MERGE, not the RUN. Open the PR; Marco removes `do-not-merge`.
