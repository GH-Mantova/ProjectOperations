---
premise: '! grep -q "SUB_LINE_PRICES_LINKED_ITEM" apps/api/src/modules/tendering/scope-redesign.service.ts'
premise_means: A SUB line cannot link to the WBS item it covers, so the same work is priced twice - once in-house and once in the subcontractor's quote.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/tendering/dto/scope-of-works.dto.ts
  - apps/api/src/modules/tendering/scope/scope-cards.controller.ts
  - apps/api/src/modules/estimate-export/excel/estimate-excel.builder.ts
  - apps/api/src/modules/tendering/__tests__/sub-linked-item.spec.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "SUB_LINE_PRICES_LINKED_ITEM" apps/api/src/modules/tendering/scope-redesign.service.ts && node scripts/data-model/build-relationship-map.mjs --check
size: 9
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: 'Additive only - adds one nullable self-FK (priced_by_sub_item_id) to scope_of_works_items and creates one new table (sub_line_quotes). No data is written or transformed. Safe to leave applied if the run dies mid-flight: every existing row has the FK null, which is exactly current behaviour, and an empty table is inert. To revert: drop the table and the column, in that order.'
cluster: scope-subcontracted
cluster_order: 4
requires_on_main: 'apps/api/src/modules/tendering/scope-redesign.service.ts :: isProvisional'
---

# A SUB line links to the work it covers — and that work stops being priced twice

## The problem this exists to prevent

Slices 2 and 3 give you a SUB discipline and a per-line priced/provisional flag. Neither stops the
same work being counted twice. Today an estimator would build the demolition scope on the DEM tab
with its manpower and plant, then add a SUB line for the subcontractor who is actually doing it —
and the tender would carry both. **The error is silent, plausible, and always in the same direction:
overpricing.**

The approved mock-up (`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`) solves
it by making a SUB line either describe its own scope **or** link to a WBS item on another tab. A
linked item stops contributing its manpower and plant to the price and shows "priced on SUB1.1" in
their place. That guard is the point of this slice; the quotes are what make the SUB line's own
number real.

## What is and is not already there — measured on `origin/main`

- **`ScopeOfWorksItem` has no link field of any kind.** No `pricedBy`, no `linkedItem`, no self-FK.
- **There is no inbound-quote model.** `ClientQuote`, `QuoteCostLine`, `QuoteProvisionalLine` and
  their siblings are all **outbound** quotes to the client. `SubcontractorRate` (`schema.prisma:4689`)
  is a rate card — supplier, discipline, unit, rate, validity window — not a priced quote against
  one tender's scope. Nothing here can be reused; a new table is required.
- **`TenderDocumentLink` (`schema.prisma:1646`) already does the document half.** It carries
  `tenderId`, `category`, `title` and a nullable `fileLinkId` to `SharePointFileLink`. The magnifier
  picker attaches an existing tender document; it does not need a new upload path.

## What to build

1. **Schema — one nullable self-FK on `ScopeOfWorksItem`:**

   ```prisma
   pricedBySubItemId String?            @map("priced_by_sub_item_id")
   pricedBySubItem   ScopeOfWorksItem?  @relation("SubCovers", fields: [pricedBySubItemId], references: [id], onDelete: SetNull)
   covers            ScopeOfWorksItem[] @relation("SubCovers")
   ```

   The FK lives on the **covered** item and points at the SUB line, so one SUB line can cover
   several WBS items — which is the real shape of the work (a subcontractor takes "all the asbestos
   removal", not one row). `onDelete: SetNull` so deleting a SUB line un-links rather than deleting
   someone's scope.

2. **Schema — a new `SubLineQuote` table**, mapped `sub_line_quotes`: `scopeItemId` (the SUB line,
   cascade), `subcontractorSupplierId` (nullable FK to `SubcontractorSupplier`, `SetNull` — a quote
   can arrive before the vendor is in the directory), `supplierNameFallback String?` for that case,
   `amount Decimal @db.Decimal(12,2)`, `isSelected Boolean @default(false)`, `receivedAt DateTime?`,
   `notes String?`, `tenderDocumentLinkId String?` (nullable FK, `SetNull`) for the attached quote
   document, plus the usual timestamps and `@@index([scopeItemId])`.

   **Exactly one quote per SUB line may be selected.** Enforce it in the service on write, and add a
   partial unique index in the migration SQL:
   `CREATE UNIQUE INDEX ... ON sub_line_quotes (scope_item_id) WHERE is_selected;`
   Prisma cannot express a partial unique index, so it goes in the migration by hand and the schema
   carries a comment saying so — otherwise the next `prisma migrate dev` will not know it exists.

   Regenerate the data-model map with `node scripts/data-model/build-relationship-map.mjs` and commit
   the refreshed `relationship-map.json`, `relationship-map.md` and `metadata-catalog.json` in this
   PR. The CI drift check hard-fails a stale map and you will have exited before CI runs.

3. **The double-count guard, in `scope-redesign.service.ts`.** An item with `pricedBySubItemId` set
   contributes **zero** labour, plant, equipment and materials to its discipline's bucket. It still
   appears in the scope, still carries its description and measurements, still counts in
   `itemCount`. Only its money goes to zero. Mark the block with the literal token
   `SUB_LINE_PRICES_LINKED_ITEM` — it is this slice's proof-of-landing marker and slice 5 gates on it.

   **Waste and cutting are NOT zeroed.** They are separate cost streams with their own markup
   (`cuttingMarkupOverride`, the waste aggregation at `:880+`), and a subcontractor's quote for
   demolition labour does not usually include your tipping. Zeroing them would move the error from
   over- to under-pricing, which is worse. If Marco wants them included that is a per-line decision
   and a later slice.

4. **A SUB line's own price is its selected quote.** `amount` from the row where `isSelected`, and
   zero when no quote is selected — a SUB line with quotes received but none chosen prices at zero
   and must be visibly incomplete, not silently free. Respect `isProvisional` from slice 3 exactly
   as any other line.

5. **Endpoints on the scope-cards controller** — link and unlink an item to a SUB line; add, update,
   delete and select a quote. Reject a link whose target is not a SUB-discipline item, whose target
   and source are the same item, or which is in a different tender. Reject selecting a quote on a
   line that has none.

6. **Export.** Scope Detail prints `priced on <SUB wbs code>` in the Notes column of a linked item,
   so the reader can see why a row with real scope carries no money. The Summary total needs no
   change: the guard already removed the double count upstream.

7. **Spec** at `apps/api/src/modules/tendering/__tests__/sub-linked-item.spec.ts`, failing-first:
   - a DEM item with manpower and plant, linked to a SUB line, contributes **0** to the DEM bucket;
   - the same item unlinked contributes its full amount again — the guard is reversible;
   - **the tender total with (in-house item + SUB quote, linked) equals the SUB quote alone** — this
     is the assertion the whole slice exists for; state its two figures in the PR body;
   - waste and cutting on a linked item are still charged;
   - a second `isSelected` quote on one line is rejected by the service AND by the index;
   - a SUB line with quotes but none selected prices at 0.

## Do NOT

- Do not build any UI. Slice 5 is the picker, the quote list and the magnifier.
- Do not zero waste or cutting on a linked item — see step 3.
- Do not touch `SubcontractorRate`. It is a rate card and is not involved. (Its `discipline` comment
  at `schema.prisma:4693` still says "DEM / CIV / ASB / Other" and is stale after slice 2 — leave it;
  correcting it here would widen this slice for no behaviour change.)
- Do not add an upload path for quote documents; `TenderDocumentLink` already covers it.
- Do not retro-link anything. Every existing row keeps `pricedBySubItemId` null.
- Do not touch `/sot/`.

## PR body must contain

`GATE-ALLOW: migrations` as a bare line at column 0.

## VERIFY

- `node scripts/data-model/build-relationship-map.mjs --check` prints OK on your branch.
- Quote the two figures from the double-count test. A slice that adds a link field but leaves the
  total unchanged has done nothing.
- Confirm the partial unique index exists in the migration SQL, by quoting the statement.

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
