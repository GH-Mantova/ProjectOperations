---
premise: '! grep -q "push-from-estimate" apps/web/src/pages/tendering/ClientQuotesPanel.tsx'
premise_means: The server (S4a) can push the estimate to the quote by destination and compute a re-push diff, but the Quote screen cannot ask it to - there is no push panel, no diff, no group headers or print-mode toggle on the Cost Summary, no chip telling a pushed row from a typed one, no strip for the lines left off the quote, and the preview still lists cost lines flat while the PDF now prints them grouped.
scope:
  - apps/web/src/pages/tendering/ClientQuotesPanel.tsx
  - apps/web/src/pages/tendering/quotePush.helpers.ts
  - apps/web/src/pages/tendering/QuotePushPanel.tsx
  - apps/web/src/pages/tendering/QuotePushDiffModal.tsx
  - apps/web/src/pages/tendering/__tests__/quotePush.helpers.test.ts
  - apps/web/src/pages/tendering/__tests__/quotePushPanel.test.tsx
  - apps/web/src/pages/tendering/__tests__/quotePreviewParity.test.tsx
  - apps/web/src/pages/tendering/__tests__/quoteVersionRowActions.test.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test -- quotePush quotePushPanel quotePreviewParity quoteVersionRowActions quoteScopeGroupedReorder && grep -q "QUOTE_PUSH_PANEL_V1" apps/web/src/pages/tendering/ClientQuotesPanel.tsx && grep -q "push-from-estimate" apps/web/src/pages/tendering/ClientQuotesPanel.tsx && test -f apps/web/src/pages/tendering/QuotePushPanel.tsx && test -f apps/web/src/pages/tendering/QuotePushDiffModal.tsx && test -f apps/web/src/pages/tendering/quotePush.helpers.ts && grep -q "Left off this quote" apps/web/src/pages/tendering/ClientQuotesPanel.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
module: tendering
cluster: scopecards
cluster_order: 6
requires_on_main: 'apps/api/src/modules/client-quotes/quote-push.service.ts :: QUOTE_PUSH_BY_DESTINATION_V1'
design_ref: https://claude.ai/code/artifact/ecf96dc3-7515-4398-ba2c-5cd7ffa1b8dd
---

# Scope Cards S4b - the push, on the Quote screen

**Fourth of nine, second half.** S4a put the push, the diff, the groups and the pointers on the
server; this slice puts them on the Quote screen. Web only - no API, no schema. The Quote
Destinations mock-up (`design_ref`) is the standard, state by state: **1** the push panel and the
Cost Summary with groups, **2** the Provisional Sums tab with source chips, **3** Cost Options with
frozen letters, **4** the Re-push diff, **5** the SENT strip, **6** the printed page (S4a). S5 arms
only when this slice's marker is on `main`.

> Marco, 2026-09-11: *An unticked line is not part of the sum. Every ticked row carries the
> estimator's own wording in "On the quote"; the estimate's wording stays beside it, read-only.*
> Marco, 2026-09-14 (S10a → S4): *the editor line "In this quote $X · Priced on the estimate $Y −
> unticked" belongs here.*

## Grounded on origin/main 49586724, 2026-09-15 - re-verify line numbers before you edit

- **One file, many tabs.** `ClientQuotesPanel.tsx` holds the version list (`ClientRow` `:439-600`,
  *Edit* / *View* swap at `:489-590`, *New revision* `:523`), the editor (`QuoteEditor` `:660-855`:
  header `:731-736`, `QuoteContentsPanel` `:738` with the *Provisional sums* / *Cost options* ticks
  `:624-625`, tabs `:711-720`, `post / patch / del` helpers `:690-709`), `CostTab` (`:857-1150`: the
  flat table, tick `:906-921`, *Label* input `:922-931` with a *from estimate* pill when a pointer
  exists `:932-949`, description / `displayDescription` `:951-977`, price `:978-992`, *Adjusted*
  with `OverrideField` `:993-1019`, delete `:1020-1030`, `nextLabel` A/B/C `:876-878`),
  `ProvisionalTab` (`:1153-1256`), `OptionsTab` (`:1258-1392`, `nextLabel` numeric `:1273`),
  `PreviewTab` (`:1713-1790`: visible lines flat as `label) desc — amount` `:1748-1757`, then
  provisional / options `:1763-1786`). Types at `:32-112`: `CostLine` already declares the pointer
  pair (`:69-70`); `ProvisionalLine` / `CostOption` do not; `SummaryResult` `:104-112`.
  `fmtCurrency` / `fmtDate` `:114-126`. `CenteredModal` from `@project-ops/ui` is imported (`:17`)
  and used (`:2359`); `components/ConfirmDialog.tsx` wraps it.
- **What S4a serves.** `POST :quoteId/push-from-estimate/plan` → `{ counts, groups[], changes[],
  fingerprint, estimateChangedSincePush, quoteStatus }`; `POST :quoteId/push-from-estimate` →
  applies (409 with the mock-up's sentence when not DRAFT); `GET /tenders/:id/scope/pushable-lines`
  → every estimate line with `quoteDestination`, `price`, `priceable`, `priceReason`;
  `PATCH :quoteId/cost-groups/:id { name?, printMode? }`; `getOne` includes `costGroups[]` and
  `costLines[].groupId`; `summary` gains `pricedOnEstimate`; the quote carries `pushedAt`,
  `pushedById`, `pushedFingerprint`. The server refuses `isVisible: true` on a non-priceable line.
- **Tests here are source-read + pure logic.** *"The web workspace has no jsdom / @testing-library"*
  (`quotePreviewParity.test.tsx` header): DOM claims grep the source; arithmetic runs as inline
  logic. `quoteVersionRowActions.ts` is the pattern for a pure helper with its own test.

## Build this

`export const QUOTE_PUSH_PANEL_V1 = "scopecards-s4b"` in `ClientQuotesPanel.tsx`.

### 1. Pure logic first - `quotePush.helpers.ts`

Everything the tests must execute lives here, DOM-free:
- `groupCostLines(lines, groups)` → ordered `[{ group | null, lines[] }]`: groups in `sortOrder`,
  each with its lines in `sortOrder`; ungrouped lines (no `groupId` - typed on this quote, or
  pre-S4a rows) last under `group: null`.
- `groupFigures(group, lines, appropriations)` → `{ subtotal, tickedCount, lineCount }` from the
  server's `displayedAmount` of the visible lines - never a recomputed price.
- `pushCounts(pushableLines, costLines)` → the four-count strip: `{ price: { lines, amount,
  ticked }, provisional: { lines, amount }, option: { lines, amount }, internal: { lines, amount } }`
  (`ticked` = pushed PRICE rows whose quote row is `isVisible`).
- `quoteLineFigures(summary)` → `{ inThisQuote: clientFacingTotal, pricedOnEstimate, unticked:
  pricedOnEstimate − baseTotalCostLines }` for the editor line.
- `pushPanelState(quote, plan)` → `"never-pushed" | "up-to-date" | "changed" | "frozen"`
  (`frozen` when `quote.status !== "DRAFT"`), with the panel's sentence assembled from
  `pushedAt / pushedBy / sentAt / estimateChangedSincePush / ratesLockedAt` in the mock-up's words
  (*"Pushed 11 Sep 2026, 09:12 by M. Perri · the estimate has not changed since · rates locked
  27 Aug 2026"*; *"… · the estimate has changed since · …"* - no time, per S4a's call 3).
- `sourceChip(row)` → `{ kind: "pushed" | "typed" | "kept", text }`: *pushed 11 Sep 09:12* when
  the row carries a pointer, *added on this quote · no estimate line* (dashed) when it does not,
  *quote $3,900.00 ≠ estimate $4,160.00* (amber) when `overrideAmount != null`.
- `nextOptionLabel(options)` → the first unused letter A… among existing `label`s (replaces the
  numeric `nextLabel` at `:1273`; the server letters pushed options the same way).

### 2. The push panel - `QuotePushPanel.tsx` (mock-up state 1, 4, 5)

Mounted at the top of the **Cost Summary** tab only, above the table. Heading *From the estimate*
with a `new` tag. One line of status from `pushPanelState`, a pill (*Up to date* teal · *Estimate
changed since push* amber · *Frozen at send* grey · *Never pushed* grey), and the four-count strip
from `pushCounts`: *In the price 16 lines · $274,163.46 · 15 ticked · Provisional 2 lines · $7,280.00
· Cost option 1 option · $1,850.00 · Internal only 1 left off · $15,561.00*. Button **Re-push from
estimate** (primary, `s7-btn s7-btn--primary`) opens the diff modal; on a non-DRAFT quote it is
rendered **disabled** with the state-5 strip under it, verbatim: *"This quote was sent on <date>
and cannot be changed by a push. Create a new revision and push into that — the current one becomes
SUPERSEDED, exactly as it does when you edit it by hand."* The panel loads the plan once when the
tab opens and again after every apply; it never applies on its own.

### 3. The diff - `QuotePushDiffModal.tsx` (mock-up state 4)

`CenteredModal` titled *What re-pushing will do · N changes, M withdrawn* (or *nothing withdrawn*).
One row per `changes[]` entry, iconed by kind: **→ move** (*Traffic control — two controllers moves
In the price → Cost option. Leaves cost line A · Demolition. Becomes Option B — the next unused
letter on this quote.* + amount), **Δ recompute** (*A · Demolition is recomputed from the lines still
in the price $123,937.08 → $115,097.08. The Adjusted column follows.* + delta), **= kept** (*Temporary
power connection is kept at your figure. Estimate says $4,160.00; this quote says $3,900.00.
Overrides survive a re-push. The chip stays amber until you clear it.*), **+ create**, **↻ update**
(price / wording), **− withdrawn** (*… leaves the quote — $8,840.00*; red rail; never folded into
"unchanged"). Footer line: *Provisional and options: 1 updated, 1 new. Internal only: nothing
crosses. Rows added on this quote are not touched.* Buttons **Cancel** / **Apply N changes**. Apply
POSTs `push-from-estimate`, closes, refreshes the quote; a 409 renders the state-5 strip inside the
modal instead of a toast.

### 4. The Cost Summary with groups - `CostTab`

- Rows render through `groupCostLines`: a **group header row** per group - letter pill, the
  editable name (blur → `PATCH cost-groups/:id { name }`), the **Itemised / One line** toggle
  (`PATCH { printMode }`), and on the right `groupFigures`: *$123,937.08 · 15 of 16 ticked*. A
  `ONE_LINE` group keeps its rows visible in the editor (greyed, still editable) with the note
  *prints as one line: <name> — <subtotal>* under the header. Ungrouped rows follow under a plain
  header *Added on this quote*.
- Each row gains the **source chip** from `sourceChip` in the Label cell (replacing the *from
  estimate* pill at `:932-949`), and the estimate's wording read-only beside the *On the quote*
  input when `displayDescription` differs from `description` (the mock-up: *"the estimate's wording
  stays beside it, read-only, so nobody loses the trail"*).
- A row whose estimate line is not priceable renders with the tick disabled and the chip *no
  quantity on the estimate — fix it there, then re-push* (S4a's `priceReason`, delivered on the
  plan / pushable lines); the server refuses the tick anyway.
- **The editor line** under the table, before the adjustment block: *In this quote $272,837.46 ·
  Priced on the estimate $274,163.46 − unticked $1,326.00* from `quoteLineFigures`. When nothing is
  unticked the third figure reads *− unticked $0.00*.
- **Left off this quote** strip below the table: a live read of `pushable-lines` filtered
  `INTERNAL` - *1 line · $15,561.00 · DEM1.4 In-house strip-out crew* - with the mock-up's note
  *never in Preview or the PDF*. No row, no column; it is text.
- *Add line* keeps working: an added row has no group and no pointer (chip *added on this quote*);
  its `label` is free text (the letter-per-line `nextLabel` at `:876` goes - letters belong to
  groups now). The Label input stays editable.

### 5. The other two tabs - `ProvisionalTab`, `OptionsTab` (states 2, 3)

`ProvisionalLine` / `CostOption` types gain the pointer pair. Every row shows the source chip
(*DEM1 Other operational costs · pushed 11 Sep 09:12* / dashed *added on this quote · no estimate
line*). Options: the label cell shows *Option A* with a *frozen at push* hint on pushed rows; the
label input stays editable on typed rows; `nextOptionLabel` replaces the numeric `nextLabel`.
Tab intros: *"Provisional sums print under the total, never inside it. Whether they print at all is
the Provisional sums tick in Quote contents — the destination decides the money exists, the tick
decides it shows."* and *"Cost options are alternative pricing that appears separately from the
main quote total. They print only while the Cost options tick is on."* No *accept this option*
control (state 3, *not drawn on purpose*).

### 6. Preview parity - `PreviewTab`

The preview's cost-summary list renders **grouped exactly as the PDF** (S4a §6): a group heading
line per group, itemised lines or one line with the group name and its visible subtotal, ungrouped
lines after, *Client-facing total* unchanged. `quotePreviewParity.test.tsx` gains the grouping axis.

### 7. Tests

- **`quotePush.helpers.test.ts`** (pure): `groupCostLines` orders groups then ungrouped;
  `groupFigures` sums `displayedAmount` of visible lines only; `pushCounts` on a fixture with one
  line of each destination gives 1/1/1/1 and the INTERNAL amount; `quoteLineFigures` on the mock-up's
  figures gives *272,837.46 · 274,163.46 · 1,326.00*; `pushPanelState` returns the four states and
  the exact sentences (no time in the changed case); `sourceChip` returns the three kinds;
  `nextOptionLabel(["A","C"])` is `"B"`.
- **`quotePushPanel.test.tsx`** (source-read): the panel mounts only inside `CostTab`; the button is
  `disabled` and the state-5 strip is present when `status !== "DRAFT"`; apply POSTs
  `push-from-estimate` and never `push-from-scope`; the modal lists a `withdrawn` kind; the *Left
  off this quote* strip filters `quoteDestination === "INTERNAL"`; the *from estimate* pill and the
  per-line `nextLabel` are gone; group header PATCHes `printMode`.
- **`quotePreviewParity.test.tsx`**: preview and PDF group identically (both read `groupId` /
  `printMode`; a ONE_LINE group yields one entry in both).
- **`quoteVersionRowActions.test.ts`**: unchanged behaviour pinned (the row actions do not move).

## Do NOT

- Do NOT compute a price, a diff or a letter in the browser - every figure is the server's
  (`displayedAmount`, `plan.changes`, `costGroups[].label`); the helpers sort and sum, only.
- Do NOT apply a push without the modal, and do NOT call `push-from-scope` for money.
- Do NOT add an *accept this option* control or a per-row *push this line* control.
- Do NOT change `clientFacingTotal`, the tick, `displayDescription` or `overrideAmount` semantics.
- Do NOT touch the Scope items tab, the API, `schema.prisma`, `tokens.css` or `/sot/`. Chips,
  pills and rails are page-local styles on brand tokens, as the mock-up draws them.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/web test -- quotePush quotePushPanel quotePreviewParity quoteVersionRowActions quoteScopeGroupedReorder
pnpm build && pnpm lint
grep -n "push-from-scope" apps/web/src/pages/tendering/QuotePushPanel.tsx apps/web/src/pages/tendering/QuotePushDiffModal.tsx   # must be empty
grep -n "String.fromCharCode(65 + quote.costLines.length)\|from estimate" apps/web/src/pages/tendering/ClientQuotesPanel.tsx      # must be empty
grep -n "QUOTE_PUSH_PANEL_V1\|Left off this quote\|Priced on the estimate" apps/web/src/pages/tendering/ClientQuotesPanel.tsx
```

PR body: screenshots of state 1 (panel + grouped Cost Summary with one group set to One line, the
editor line, the Left-off strip), state 4 (the diff with a move, a recompute, a kept override and a
withdrawal), and state 5 (the disabled button and strip on a SENT quote); the preview and the PDF of
the same quote side by side.

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

Armed by Station 00 under Marco's direction. Once this file carries the `-ready.md` suffix that
rename IS the dispatch - build it and open the PR; this section is never a reason to wait. Second
half of S4 in the `scopecards` chain; dispatches once `QUOTE_PUSH_BY_DESTINATION_V1` (S4a) is on
`main`. S5 is authored once `QUOTE_PUSH_PANEL_V1` is on `main`.
