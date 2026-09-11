---
premise: '! grep -q "deriveDraftCompleteness" apps/web/src/pages/tendering/newTenderWizard.helpers.ts'
premise_means: A DRAFT tender has no completeness panel and no way back into the wizard from its own page - the only door is the list-page picker, which always lands on step 1.
scope:
  - apps/web/src/pages/tendering/newTenderWizard.helpers.ts
  - apps/web/src/pages/tendering/__tests__/draft-completeness.test.ts
  - apps/web/src/pages/tendering/DraftProgressPanel.tsx
  - apps/web/src/pages/tendering/__tests__/draft-progress-panel.test.tsx
  - apps/web/src/pages/tendering/TenderDetailPage.tsx
  - apps/web/src/pages/tendering/NewTenderWizard.tsx
done_when: pnpm build && grep -q "deriveDraftCompleteness" apps/web/src/pages/tendering/newTenderWizard.helpers.ts && grep -q "DraftProgressPanel" apps/web/src/pages/tendering/TenderDetailPage.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
module: tendering
cluster: draftpanel
cluster_order: 2
requires_on_main: apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx :: scope-cards-rates-gate
design_ref: https://claude.ai/code/artifact/4b84db67-140c-41cc-a803-08851e77d246
---

# Finish this draft, from inside the draft

> "would be nice to have the resume draft or resume tender wizard inside each individual
> tender still marked as draft." - Marco

The mock-up (`design_ref`) is the standard: states 1-4 are what to build here. State 5b (the
carry-over strip) and state 6 (re-pointing the list-page picker) are **S3**, authored once this
lands. S1 (the rates-lock gate) is already on `main` when this dispatches - the panel's Rates
row reads a real gate, not a proposal.

## Grounding [INFERRED from the mock-up's own grounding on origin/main, 2026-09-10 - re-verify every line number before you edit; main has moved]

- The wizard stores no current step. Opening dispatches `reset` (`NewTenderWizard.tsx:184`),
  `initialFlowState()` visits only `project` (`helpers.ts:42-56`), the rail button is
  `disabled={!visited}` (`:968`) and `jumpToStep` refuses unvisited targets
  (`helpers.ts:110-113`). So "where was I" is unanswerable and the panel shows **completeness,
  not position**.
- `NewTenderWizard` is mounted only on `TenderingPage.tsx:868`. `TenderDetailPage.tsx` does not
  import it. Any version of this ships a new mount.
- `flow.ratesLocked` resets to `false` on open and is never read back from the server
  (`:826`); `ratesVersionLabel` is cleared (`:183`) and never rehydrated. Review lies on a
  locked draft.
- Rehydration already restores title, project name, estimator, site, builders, packages,
  matrix and documents (`:233-293`) through four parallel fetches (`:238-243`, `:280-286`).
- `detectIncompleteBuilders` (`helpers.ts:191-206`) and `deriveDocumentBuckets`
  (`helpers.ts:149-176`) are the seams the derivation reuses.
- Two of seven steps have no completable state: AI scope is a hard-disabled stub
  (`:1702-1717`) and Review persists nothing (`:1719-1775`). The meter counts **5 checkable
  steps**, never 7.

## What to build

### 1. The derivation - `newTenderWizard.helpers.ts`

One pure function, beside `detectIncompleteBuilders`:

```ts
deriveDraftCompleteness(tender, packages, matrix, documents, rateSet): DraftCompleteness
```

Returns one entry per `WIZARD_STEP_KEYS` with `state: "ready" | "partial" | "outstanding" |
"not-checkable"`, a short `why`, and the `counts` the panel prints. Rules, per the mock-up's
state 2 table:

| Step | ready when |
|---|---|
| project | `title`, a resolved `siteId` (not free text), and `estimatorUserId` all present |
| builders | at least one, and `detectIncompleteBuilders()` returns none |
| packages | at least one package and at least one matrix cell per builder |
| documents | every derived bucket has a file; zero files anywhere is outstanding |
| rates | `rateSet` is non-null - the S1 gate, read the same way |
| ai | always `not-checkable` |
| review | always `not-checkable` |

**Documents is the one row that guesses.** Buckets key on `disciplineItemId`; uploads carry a
`category` string from `UploadCategoryPicker`. If you cannot find code that maps one to the
other, the row degrades honestly to a file count ("6 files uploaded", `partial` when > 0,
`outstanding` when 0) and you say so in the PR body. Do not invent the mapping.

Test it with no jsdom (`draft-completeness.test.ts`): barely-started draft (state 4a) gives
1 of 5; the finished draft (state 4b) gives 5 of 5; a draft with a locked rate set but a
missing submission date gives `builders: partial` and `rates: ready`.

### 2. The panel - `DraftProgressPanel.tsx`

Rendered as the **first section of Overview, only while `tender.status === "DRAFT"`**. Header:
title *Finish this draft*, the meter (*N of 5 checkable steps ready*, seven segments coloured
by state, the two not-checkable ones hatched), **Resume wizard** primary and **Discard draft**
secondary. Then the seven rows exactly as drawn: index disc, name, state badge, the `why`
line, and one action per row (*Open* / *Fix builder* / *Upload* / *Lock rates* / *Review*),
AI scope's button disabled. Footer: created-by / last-touched line and the note that the panel
renders only while DRAFT. Ready rows collapse to one line; outstanding rows keep their detail
(state 4). When all five are ready the header reads *Ready to move on* and the primary action
becomes **Move to Estimating** (state 4b).

Use the tokens and components the page already uses. No new colours, no new font. No progress
ring, no percentage - the mock-up's "Deliberately not drawn" list is binding.

### 3. Re-entry - `TenderDetailPage.tsx` + `NewTenderWizard.tsx`

- Mount `NewTenderWizard` on the detail page with `existingDraftId={tender.id}` and `onClose`
  wired to the page's `reload()` so the panel re-derives when the wizard closes.
- Add a **Resume wizard** button to the title row, rendered only while DRAFT, so the affordance
  survives on the Scope / Rates / Quote / History tabs.
- Add a `resume` action to the flow reducer that sets `currentStep` to the clicked row's step
  and seeds `visited` from the derivation (every step the panel found data for). Without it,
  every row's button lands on Project.
- **Fix `ratesLocked` on rehydrate**: read the rate set alongside the four existing fetches and
  set `flow.ratesLocked` / the version label from it. The Review step stops lying.
- Change the subtitle at `:989` - it says "resume this tender from the drafts list at any
  time", which stops being true here. New copy: *Draft saved - you can close and resume this
  tender from the tender itself at any time.*

## Do NOT

- Do NOT store a current-step column, flag or localStorage key. The derivation is the feature.
- Do NOT block the status select until the panel is green. Estimators leave DRAFT for reasons
  the system does not model (state 5b is S3's answer to that).
- Do NOT build the carry-over strip (5b) or touch `ResumeDraftPicker` / `TenderingPage.tsx`
  (state 6). S3.
- Do NOT change wizard step order or make any step unskippable (S1 ruling 3 still stands).
- Do NOT touch `sot/**`, `schema.prisma`, migrations or any API file. Everything here reads
  endpoints that exist.
- Do NOT draw a percentage or a ring.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/web test -- draft-completeness draft-progress-panel
pnpm build
grep -n "from the drafts list" apps/web/src/pages/tendering/NewTenderWizard.tsx   # must be empty
grep -n "NewTenderWizard" apps/web/src/pages/tendering/TenderDetailPage.tsx        # the new mount
```

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>` and why.
- Never ask a question or "stand by" for approval. A dismissed or unanswered question is the
  absence of a human, not a stop signal. Proceed on best judgement and record the assumption in
  the PR body.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action. Say `NO-OP: <reason>`.
- The completion test: is there a PR number in your output? If the reason for "no" is "I am
  waiting for someone" - there is nobody. Open the PR.

## STATUS

**HOLD.** Marco arms this. Second in the `draftpanel` cluster; dispatches only once S1's
`scope-cards-rates-gate` is on `main`. S3 (carry-over strip + picker re-point) is authored
after this lands.
