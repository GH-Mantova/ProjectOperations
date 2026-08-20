---
premise: '! grep -q "COUNT_ONLY_STAGES" apps/web/src/pages/tendering/tenderingPage.helpers.ts'
premise_means: The Pipeline board still has no Submitted column and renders cards in every column. A submitted tender disappears from Tendering entirely the moment it is submitted.
scope:
  - apps/web/src/pages/tendering/tenderingPage.helpers.ts
  - apps/web/src/pages/tendering/__tests__/tenderingPageHelpers.test.ts
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/tendering/__tests__/TenderingPage.board.test.tsx
done_when: pnpm build && pnpm lint && grep -q "COUNT_ONLY_STAGES" apps/web/src/pages/tendering/tenderingPage.helpers.ts && grep -q "SUBMITTED" apps/web/src/pages/tendering/tenderingPage.helpers.ts
size: 4
gate_allow: none
seed_only: false
escalates: false
cluster: tendering-board-fix
cluster_order: 1
---

# Restore the Submitted column, and make Submitted + Withdrawn count-only

Marco, 2026-08-20, from the screen. Two changes, one board.

## What went wrong — read this, because the fix looks like a revert and is not

`docs/architecture/drafts/tender-pipeline-register-plan.md:20` (his brief, 2026-08-13):

> *"**Pipeline** = the submission board. Only four columns: DRAFT, ESTIMATING, **SUBMITTED**,
> WITHDRAWN. Its job is to drive tenders to submission."*

and `:16` — a SUBMITTED tender *"Shows in"* **Pipeline · CRM · Register**.

**PR #1106 built exactly that** on 2026-08-14 at 04:57 — `PIPELINE_STAGES` with four stages, and a
test asserting the four. **PR #1122 undid it** at 20:01 the same day, cutting it to three, and cited
as its authority the very document quoted above — which specifies four.

The sentence that flipped it is `docs/plans/crm-tendering-nav-remodel-plan.md:29-30`:

> *"Submitted and confirmed-Withdrawn **exit the Pipeline** to the CRM Tenders register."*

In the brief, the Pipeline's job *"is to drive tenders to submission"* — so Submitted is the finish
line, the terminal column. Downstream that was read as *disappear from the board*, and the follow-on
prompt hardened the misreading by inserting one word: *"leave the Pipeline **board**"*.

**So this is not "put back what #1122 removed".** Marco's 2026-08-20 decision is a third thing:
Submitted returns as a column, **and both Submitted and Withdrawn become count-only**. That
card-less shape has never existed and is not written down anywhere before this prompt.

## What to build

### 1. `tenderingPage.helpers.ts` — four stages, and a count-only set

Current, at `:12` (with a comment block at `:6-11` that must be rewritten, not left contradicting
the code):

```ts
export const PIPELINE_STAGES = ["DRAFT", "IN_PROGRESS", "WITHDRAWN"] as const;
```

Restore **SUBMITTED in position 3, immediately before WITHDRAWN** — the order Marco named and the
order #1106 shipped:

```ts
export const PIPELINE_STAGES = ["DRAFT", "IN_PROGRESS", "SUBMITTED", "WITHDRAWN"] as const;
export const COUNT_ONLY_STAGES = ["SUBMITTED", "WITHDRAWN"] as const;
```

`groupByPipelineStage` (`:152-167`) needs `SUBMITTED: []` added to its `groups` literal (`:155-159`).
**Leave the confirmed-withdrawal filter at `:163` exactly as it is** — `WITHDRAWN` +
`withdrawalState === "CONFIRMED"` still exits the board. Marco confirmed on 2026-08-20 that
*confirmed* withdrawal is what "archived" means, and that the review workflow survives.

### 2. `TenderingPage.tsx` — count-only rendering

`KanbanColumn` (`:2246-2295`) currently renders identically for every stage: header with label +
`items.length` + currency total, then `items.map(...)` → `<TenderCard>`.

For a stage in `COUNT_ONLY_STAGES`: render the header **exactly as now** (label, count, total — the
count is the whole point) and **suppress the card list**. Put something deliberate in its place —
a single muted line stating the tenders are on the Register, ideally a link to it. An empty box
reads as a bug; "3 tenders · view on the Register" reads as a decision.

Keep both columns as **drop targets**. Dropping still works and still routes exactly as it does
today: `:510-526` for the withdraw path (which stamps `PENDING_REVIEW` — do not change it), and the
normal status write for Submitted.

### ⚠️ 3. Name the one-way exit in the PR body

A count-only column has no card to drag **out** of. So Submitted and Withdrawn become one-way exits
from the board. That is intended — Marco: *"once they move to submitted, this is where the CRM part
of the estimating kicks off with intensive follow-ups, etc, until the tender is won or lost by us."*
The board is the submission funnel; life after submission belongs elsewhere.

But it must be true that a mis-drop is recoverable. **Before you finish, establish and state in the
PR body where a tender goes Submitted → back to Estimating.** Withdrawn already has one — the
reviewer `reopen` endpoint. If Submitted has no equivalent path anywhere in the app, **say so
plainly under a heading `KNOWN GAP — no un-submit path`** rather than inventing one here. Flagging
it loudly is the correct outcome; discovering it later from a support call is not.

## Tests

### `tenderingPageHelpers.test.ts` — two existing tests assert the current wrong shape

Both are at roughly `:327-337` and **must be rewritten, not deleted**:

- `"PIPELINE_STAGES contains exactly the three in-flight stages"` → four, in order, Submitted third.
  Its comment currently explains why Submitted left the board; replace it with why it is back, citing
  Marco 2026-08-20. A stale comment above a corrected assertion is how this went wrong the first time.
- `"PIPELINE_STAGES does NOT include outcome or Register-only statuses"` → its `nonBoardStatuses`
  array still lists `SUBMITTED`. Remove `SUBMITTED` from it and **leave `AWARDED`,
  `CONTRACT_ISSUED`, `LOST`, `CONVERTED`** — those genuinely are not board columns.

Add: `groupByPipelineStage` puts a `SUBMITTED` tender in the `SUBMITTED` group, and **still** drops a
`WITHDRAWN` + `CONFIRMED` one. That second half is the regression guard on the review workflow.

### `TenderingPage.board.test.tsx` — new

1. Four columns render, labelled Draft / Estimating / Submitted / Withdrawn **in that order**.
2. Draft and Estimating render tender cards.
3. **Submitted and Withdrawn render their count in the header but no tender card** — assert the
   count text is present *and* that no card is queryable. Both halves; a test that only checks the
   card is absent would pass on a column that failed to render at all.
4. **Negative control:** a confirmed-withdrawn tender is not counted in the Withdrawn header. If the
   count silently includes tenders that exited the board, the number is a lie and the column is worse
   than useless.

## Do NOT

- Do NOT touch the Register view, its columns, presets, bulk actions or CSV export. Nothing is being
  removed from the Tendering page — Marco was explicit: *"We are NOT deleting the tender from the
  tendering, it will remain there."*
- Do NOT change the withdraw drop handler or `withdrawalState` semantics. The review workflow stays.
- Do NOT add `AWARDED` / `CONTRACT_ISSUED` / `LOST` columns. The board ends at Submitted.
- Do NOT touch the nav. The Tendering "Pipeline" nav item points at the CRM dashboard rather than
  this board — that is real, and it is slice 2 of this cluster, not this PR.
- Do NOT touch `docs/` or `sot/`.

## Guardrails

- One attempt. If `COUNT_ONLY_STAGES` already exists, say `NO-OP: <reason>`.
- `pnpm build`, `pnpm lint`, and both spec files must pass.
- Four files. The stale comment at `TenderingPage.tsx:806` claiming "4 submission-stage columns only"
  is a leftover from #1106 — it becomes true again, but re-read it and make sure it says what the
  code now does.
