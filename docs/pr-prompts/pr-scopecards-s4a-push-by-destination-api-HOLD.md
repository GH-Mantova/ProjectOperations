---
premise: '! grep -q "push-from-estimate" apps/api/src/modules/client-quotes/client-quotes.controller.ts'
premise_means: The estimate reaches the quote once, at quote creation, as one aggregate cost line per discipline plus one for cutting, read from summary() and never again - there is no push, no re-push, no diff, no pointer on provisional lines or cost options, no way for a line to land anywhere but the Cost Summary, and a New revision silently drops the estimator's wording, overrides and ticks.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/tendering/scope-redesign.controller.ts
  - apps/api/src/modules/client-quotes/client-quotes.service.ts
  - apps/api/src/modules/client-quotes/client-quotes.controller.ts
  - apps/api/src/modules/client-quotes/client-quotes.module.ts
  - apps/api/src/modules/client-quotes/dto/client-quotes.dto.ts
  - apps/api/src/modules/client-quotes/quote-push.service.ts
  - apps/api/src/modules/client-quotes/quote-pdf.service.ts
  - apps/api/src/modules/client-quotes/__tests__/quote-push.spec.ts
  - apps/api/src/modules/client-quotes/__tests__/quote-push-groups.spec.ts
  - apps/api/src/modules/client-quotes/__tests__/quote-estimate-traceability.spec.ts
  - apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts
  - apps/api/src/modules/pdf-rendering/builders/__tests__/quote-html.builder.spec.ts
  - apps/api/src/modules/tendering/__tests__/pushable-lines.spec.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/api test -- quote-push quote-push-groups quote-estimate-traceability pushable-lines quote-html.builder quote-destination line-markup-all-types && grep -q "QUOTE_PUSH_BY_DESTINATION_V1" apps/api/src/modules/client-quotes/quote-push.service.ts && grep -q "push-from-estimate" apps/api/src/modules/client-quotes/client-quotes.controller.ts && grep -q "model QuoteCostGroup" apps/api/prisma/schema.prisma && grep -q "sourceEstimateLineId" apps/api/prisma/schema.prisma && test "$(grep -c 'seedSuggestedCostLines' apps/api/src/modules/client-quotes/client-quotes.service.ts)" = "0" && test -f docs/data-model/relationship-map.json && node scripts/data-model/build-relationship-map.mjs --check
size: 7
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: Additive only - one new table (quote_cost_groups), one nullable FK on quote_cost_lines (group_id), two nullable pointer columns on quote_provisional_lines and on quote_cost_options mirroring the ones quote_cost_lines already has, three nullable push-stamp columns on client_quotes. No UPDATE ... SET, no default that rewrites a row, no drop. Existing quotes keep every row they have; nothing changes on them until someone presses Re-push. To revert, drop the columns and the table; the code revert restores the creation-time seed.
module: client-quotes
cluster: scopecards
cluster_order: 5
requires_on_main: 'apps/api/src/modules/tendering/scope-redesign.service.ts :: SCOPE_LINE_MARKUP_ALL_TYPES_V1'
design_ref: https://claude.ai/code/artifact/ecf96dc3-7515-4398-ba2c-5cd7ffa1b8dd
---

# Scope Cards S4a - the push routes by destination, one row per line (API + PDF)

**Fourth of nine**, one merging chain (`docs/plans/scope-cards-reconciliation-plan.md`, section 3;
plan row S4, was S10b), split at the API/web seam like S2: **S4a** is the schema, the push, the diff,
the endpoints and the PDF builder; **S4b** is the Cost Summary editor (push panel, diff modal, group
headers, chips, the *Left off this quote* strip, the *In this quote / Priced on the estimate* line)
and arms only when this slice's marker is on `main`. The Quote Destinations mock-up (`design_ref`,
states 1-6) is the standard; this slice builds what its states *compute*.

> Marco, 2026-09-11: *On the client quote, the estimator decides from all the items they priced what
> stays in or out, and how each is named on the quote. An unticked line is not part of the sum. The
> "we do it but don't itemise it" case is In the price, printed as one line with its group.*

## Grounded on origin/main c1094ced, 2026-09-15 - re-verify line numbers before you edit

- **The seed.** `ClientQuotesService.create()` (`client-quotes.service.ts:164-229`) mints the
  revision, marks the prior one SUPERSEDED (`:186-193`), then either `deepCopyFrom` (`:222-223`) or
  `seedSuggestedCostLines` (`:819-853`): walks `["DEM","CIV","ASB"]` over `summary()`'s
  `withMarkup`, one `QuoteCostLine` per discipline lettered A, B, C (`:826-838`), plus *Concrete
  cutting* at `cutting.subtotal` - **at cost, not with markup** (`:841-851`); SUB is skipped; nothing
  writes `sourceEstimateLineType / Id`. That is the only time the estimate reaches the quote.
- **The letter is the group.** `QuoteCostLine.label` is that letter (`nextLabel` on the web,
  `ClientQuotesPanel.tsx:876`); the PDF prints it in the SCOPE column (`quote-html.builder.ts:396-441`,
  `code: line.label`) and the linked-assumptions block reads *"— Item A"* from it (`:731-734`);
  `QuoteAssumption.costLineId` links to a cost line. With no overlay the builder falls back to
  per-discipline `summary()` rows (`:409-429`).
- **Two of three tables cannot say where a row came from.** `QuoteCostLine` has
  `sourceEstimateLineType / sourceEstimateLineId` + index (`schema.prisma:4715-4725`);
  `QuoteProvisionalLine` (`:4729-4740`) and `QuoteCostOption` (`:4742-4754`) have `description,
  price, notes, sortOrder` (+ `label` on options) and nothing else.
- **The money on the quote.** `summary()` (`client-quotes.service.ts:290-373`): visible cost lines
  only (`:303-305`, since #805), proportional adjustment over allocatable lines, `overrideAmount`
  fixed (`:316-360`), `clientFacingTotal` (`:370`). `quote-pdf.service.ts:71-107` builds the overlay
  from it, `isVisible` filtered (`:86, :96`), `displayDescription ?? description`, `ratesLockedAt`
  from `tender.rateSet?.lockedAt` (`:174`). `quotePreviewParity.test.tsx` (QPDF-4) pins preview = PDF.
- **New revision drops the estimator's work.** `deepCopyFrom` (`:736-800`) copies cost lines as
  `label, description, price, sortOrder` only - **no `displayDescription`, `overrideAmount`,
  `isVisible`, no source pointers** - and provisional / option rows likewise. A re-push into a fresh
  revision would therefore find no pointers and create twins of everything.
- **Status.** `ClientQuoteStatus { DRAFT SENT SUPERSEDED }` (`:4641-4645`); `quote-send.service.ts:82`
  writes SENT; the web already swaps *Edit* for *View* on a SENT row (`ClientQuotesPanel.tsx:489-590`).
  `AuditService` is injected (`client-quotes.service.ts:9, 86`).
- **`push-from-scope` is a different feature.** `quote-scope-items.controller.ts:105` pushes
  scope *descriptions* into `QuoteScopeItem` (the client-facing scope table, `schema.prisma:3986-4005`,
  keyed by `sourceItemId / sourceItemType` `"scope" | "cutting" | "waste"`). Leave it alone; the new
  endpoint is `push-from-estimate` and pushes *money*.
- **What the estimate can say after S1-S3.** Every line of the four types carries
  `quoteDestination` (S2a), `lineTotalWithMarkup` and `effectiveMarkup` (S1, S3); `summary()` splits
  four ways; a SUB line prices at its selected quote (Rule B); INTERNAL lines are priced on the card
  and nowhere else. The Discipline Cards mock-up's state 3 *cannot price* row (a line with no
  quantity) prices to 0 with a reason.

## The model

```
PRICE       -> QuoteCostLine        in a QuoteCostGroup (one per discipline, SUB its own; cutting
                                    inside the discipline that owns its card)
PROVISIONAL -> QuoteProvisionalLine
OPTION      -> QuoteCostOption      lettered on the quote, frozen
INTERNAL    -> nothing crosses
```

One row per estimate line, keyed by `(sourceEstimateLineType, sourceEstimateLineId)`. A re-push is
an **upsert on that key**, never an append; a line that changed destination is deleted from the
table it was on and created on the table it now belongs to in one transaction. Rows with no pointer
were typed on the quote and are never touched. Destination decides existence; the tick decides the
money; `showProvisional` / `showCostOptions` decide whether a section prints.

## Build this

`export const QUOTE_PUSH_BY_DESTINATION_V1 = "scopecards-s4a"` in `quote-push.service.ts`.

### 1. Schema (one additive migration `<ts>_scopecards_s4a_push_by_destination`)

- **`QuoteCostGroup`** - `id`, `quoteId` (cascade), `code String` (the discipline: `DEM`, `CIV`,
  `ASB`, `SUB`, …), `label String` (the letter, frozen), `name String` (the client-facing group
  name, seeded from `DISCIPLINE_LABEL[code]`, editable), `printMode String @default("ITEMISED")`
  (`ITEMISED | ONE_LINE`), `sortOrder Int`, `@@unique([quoteId, code])`, `@@map("quote_cost_groups")`.
  This is Marco's per-group print mode, as a **row** (the alternative was a `ClientQuote.groupPrintModes
  Json`; a row is chosen because the letter and the name need a home too, and `deepCopyFrom` can copy it).
- **`QuoteCostLine.groupId String? @map("group_id")`** → `QuoteCostGroup` (SetNull). Nullable: rows
  typed by hand before this slice have no group and keep printing exactly as today.
- **`sourceEstimateLineType String?` + `sourceEstimateLineId String?` + `@@index` on
  `QuoteProvisionalLine` and `QuoteCostOption`**, mirroring `QuoteCostLine:4720-4725` exactly (same
  names, same nullability, same index, same *both set or both NULL* comment). Types are
  `"scope" | "waste" | "cutting" | "operational"`.
- **`ClientQuote.pushedAt DateTime?`, `pushedById String?` (→ User, SetNull),
  `pushedFingerprint String?`** - the push stamp. The fingerprint is a sha256 over the pushable lines
  (`type:id:destination:price:description`, sorted) at the moment of the push; *"the estimate has
  changed since"* is `fingerprint(now) !== pushedFingerprint`. (The mock-up prints the change *time*;
  the estimate does not record one, so the panel says *changed since* without a time - S4b wording.)

Regenerate `docs/data-model/`.

### 2. What can be pushed - `ScopeRedesignService.listPushableLines(tenderId)`

In `scope-redesign.service.ts`, next to `summary()`, reusing its reads and pricing (no second
pricing path): every non-excluded line of the four types as
`{ type, id, code, description, cardId, cardCode, discipline, quoteDestination, price,
priceable, priceReason }` where `price` is the line's `lineTotalWithMarkup` (a SUB line: its selected
quote with markup, Rule B), `code` is the WBS / row code the card shows (`DEM1.2`, `DEM1 waste`,
`DEM1 cutting`, `DEM1 op`), `discipline` is the card's, and `priceable` is `false` with a reason
(*"no quantity"*, *"no rate"*, *"no quote selected"*) when the estimate cannot price it - the row
arrives, cannot be ticked, and says where to fix it. Exposed as
`GET /tenders/:tenderId/scope/pushable-lines` for S4b's *Left off this quote* strip and the four-count
strip. `summary()` itself is untouched.

### 3. The push - `quote-push.service.ts`

`QuotePushService` (new, registered in the module), with two public methods on one private plan:

- **`plan(tenderId, quoteId)`** → the diff, computed and never applied. Reads `listPushableLines`
  and the quote's three tables with pointers. For every pushable line: **create** (no row anywhere
  yet, destination ≠ INTERNAL), **update** (row on the right table: price changes to the estimate's,
  `description` changes to the estimate's wording, `displayDescription` untouched, `overrideAmount`
  untouched → the row is reported *kept at your figure* with both amounts), **move** (row on another
  table: delete there, create here; a PRICE→OPTION move gets *the next unused letter on this quote*),
  **withdraw** (row exists, line is now INTERNAL or no longer exists on the estimate: delete, reported
  with its amount), **unchanged**. Groups: one `QuoteCostGroup` per discipline present among PRICE
  lines, lettered A, B, C … in `DISCIPLINE_ORDER` (SUB last) **only when first created**; a group's
  letter never changes and a group whose lines all leave is kept, empty, until the estimator deletes
  it. Group recomputes are reported (*A · Demolition $123,937.08 → $115,097.08*). Rows with no
  pointer are never in the plan. The plan carries `counts { create, update, move, withdraw, unchanged }`,
  `groups[]`, `changes[]` (typed), `fingerprint`, `estimateChangedSincePush`, `quoteStatus`.
- **`apply(tenderId, quoteId, actorId)`** → recomputes the plan and applies it in **one
  `$transaction`**, then stamps `pushedAt / pushedById / pushedFingerprint` and writes an audit entry
  (`quote.push`, with the counts). Returns the applied plan. **`quote.status !== "DRAFT"` → 409**
  with the mock-up's sentence: *"This quote was sent on <date> and cannot be changed by a push. Create
  a new revision and push into that."* The push never creates a revision.
- Pushed rows: `QuoteCostLine { groupId, label: code, description, price, sortOrder (card order,
  then row order), isVisible: true on create, sourceEstimateLineType/Id }`; `QuoteProvisionalLine
  { description, price, sortOrder, pointers }`; `QuoteCostOption { label: letter, description, price,
  sortOrder, pointers }`. Non-priceable PRICE lines are created with `price 0` and `isVisible: false`
  (they cannot be ticked - S4b enforces the affordance; the server refuses `isVisible: true` on a
  line whose estimate line is not priceable with a 400 naming the reason).
- Option letters: at push, a new OPTION row gets the first letter not used by any `QuoteCostOption`
  on this quote (pushed or typed); `sortOrder` follows the letter. Never re-lettered.

### 4. Creation and revision use the same path

- `create()` without `copyFromQuoteId` calls `apply()` instead of `seedSuggestedCostLines`; delete
  the seed and `DISCIPLINE_LABEL`'s only remaining use moves to group naming.
- **`deepCopyFrom` copies everything**: groups (new ids, mapped onto `groupId`), cost lines with
  `displayDescription, overrideAmount, isVisible, baseValue, sourceEstimateLineType/Id`, provisional
  lines and options with their pointers, assumptions re-linked as today. A New revision then re-pushes
  cleanly. This is a bug fix the slice cannot avoid.

### 5. Endpoints - `client-quotes.controller.ts`

- `POST :quoteId/push-from-estimate/plan` → the diff (any status; read-only).
- `POST :quoteId/push-from-estimate` → apply (DRAFT only; 409 otherwise). Permission `estimates.manage`
  like the other quote writes.
- `PATCH :quoteId/cost-groups/:groupId` `{ name?, printMode? }`; `GET :quoteId/cost-groups`.
- `getOne` includes `costGroups` and the three tables' pointers; the summary payload gains
  `pricedOnEstimate` (Σ `price` of the PRICE-destined pushable lines) so S4b can print *In this quote
  $X · Priced on the estimate $Y − unticked*. `clientFacingTotal` is untouched.

### 6. The printed page - `quote-html.builder.ts` + `quote-pdf.service.ts`

Overlay gains `costGroups[]` and each cost line its `groupId`. Cost Summary renders **grouped**:
a group heading row (letter · name), then, `ITEMISED`: its visible lines as today (SCOPE = the line's
code, DESCRIPTION = `displayDescription ?? description`, AMOUNT = the appropriated amount); `ONE_LINE`:
one row - the group's name and the sum of its visible lines' appropriated amounts. Ungrouped lines
(no `groupId`) print after the groups exactly as today. TOTAL is `clientFacingTotal` either way -
**the money does not change with the print mode**. Options and provisional sections unchanged. The
no-overlay fallback (`:409-429`) is unchanged. `quote-pdf.service.ts` passes groups through.

### 7. Tests

- **`pushable-lines.spec.ts`**: four line types arrive with the right `code`, `discipline` (a cutting
  line takes its card's), `price` = `lineTotalWithMarkup`, a SUB line = its selected quote with markup,
  an item with no quantity is `priceable: false` with a reason, INTERNAL lines are included (S4b needs
  them) with their destination.
- **`quote-push.spec.ts`** (the spec's acceptance, mocked prisma with a `$transaction` that runs the
  callback): a card holding one line of each destination pushes to **exactly three rows across three
  tables**, each with a pointer; flipping the OPTION line to PROVISIONAL and re-pushing leaves **one**
  row, in `QuoteProvisionalLine`; flipping it to INTERNAL and re-pushing leaves **none** and the plan
  listed a withdrawal with its amount; a re-push changes neither a typed `displayDescription` nor an
  `overrideAmount` and reports *kept*; a row with no pointer survives every push; a re-push against a
  SENT quote returns 409 and writes nothing (transaction never opened); the fingerprint changes when a
  line's price, description or destination changes and not otherwise; a non-priceable line is created
  hidden and `isVisible: true` on it is refused.
- **`quote-push-groups.spec.ts`**: groups are lettered A, B, C in discipline order with SUB last;
  deleting Option A on the card and re-pushing leaves Option B lettered B and a new option becomes C;
  a group's letter survives every line leaving it; `deepCopyFrom` copies groups, pointers,
  `displayDescription`, `overrideAmount`, `isVisible`, and a re-push into the copy creates no twins.
- **`quote-html.builder.spec.ts`**: a `ONE_LINE` group prints its name and one amount equal to the
  sum of its visible lines; an `ITEMISED` group prints each line; TOTAL is identical in both modes;
  ungrouped lines still print.
- **`quote-estimate-traceability.spec.ts`**: extend for the two new pointer pairs.

## Do NOT

- Do NOT touch `push-from-scope`, `QuoteScopeItem`, or the Scope items tab.
- Do NOT change `summary()`'s arithmetic, `clientFacingTotal`, the allocation, or the visible-only rule.
- Do NOT create a revision from the push, and do NOT push into anything but DRAFT.
- Do NOT overwrite `displayDescription`, `overrideAmount` or `isVisible` on an existing row, and do
  NOT touch a row without a pointer.
- Do NOT re-letter groups or options, ever.
- Do NOT put a web change in this slice (`ClientQuotesPanel.tsx` is S4b); `quotePreviewParity` keeps
  passing because the preview's line map is unchanged until S4b.
- Do NOT touch `/sot/`, `tokens.css`, or the estimating screens.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/api test -- quote-push quote-push-groups quote-estimate-traceability pushable-lines quote-html.builder quote-destination line-markup-all-types
pnpm build && pnpm lint
node scripts/data-model/build-relationship-map.mjs --check
grep -c "CREATE TABLE" apps/api/prisma/migrations/*scopecards_s4a*/migration.sql     # exactly 1
grep -c "UPDATE" apps/api/prisma/migrations/*scopecards_s4a*/migration.sql           # 0
grep -n "seedSuggestedCostLines" apps/api/src/modules/client-quotes/client-quotes.service.ts   # must be empty
grep -n "QUOTE_PUSH_BY_DESTINATION_V1\|\$transaction\|ConflictException" apps/api/src/modules/client-quotes/quote-push.service.ts
```

PR body: `GATE-ALLOW: migrations` bare at column 0; quote the migration SQL, the three-rows test, the
one-row-after-move test, the withdrawal test, the 409 test, and the `deepCopyFrom` before / after.

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
- `escalates: true` - this slice writes to the client quote, adds a table and changes what a new
  quote is born with. Marco merges, not automation.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action. Say `NO-OP: <reason>`.
- The completion test: is there a PR number in your output? If the reason for "no" is "I am
  waiting for someone" - there is nobody. Open the PR.

## STATUS

Armed by Station 00 under Marco's direction. Once this file carries the `-ready.md` suffix that
rename IS the dispatch - build it and open the PR; this section is never a reason to wait. Fourth
of the `scopecards` chain; dispatches once `SCOPE_LINE_MARKUP_ALL_TYPES_V1` (S3) is on `main`.
S4b is authored once `QUOTE_PUSH_BY_DESTINATION_V1` is on `main`.
