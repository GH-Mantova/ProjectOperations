---
premise: '! grep -q "RATE_BASIS_STAMP_V1" apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts'
premise_means: >-
  The client-facing quote PDF still carries no rate basis, and the column that would supply one
  means two different things. quote-html.builder.ts mentions ratesSnapshotAt zero times and the
  cover prints fmtDate(new Date()) at :372; the header prints Puppeteer's own print date at :840.
  Meanwhile ratesSnapshotAt has two writers - a real lock at tender-rate-set.service.ts:83, which
  materialises a TenderRateSet, and three status-transition writes at tendering.service.ts:1013,
  :1019, :1026 plus the bulk path at :303, :309, :316, which create nothing. The comment at
  tendering.service.ts:1008-1010 claims a status change "freezes the rate snapshot"; it does not.
scope:
  - apps/api/src/modules/tendering/tendering.service.ts
  - apps/api/src/modules/tendering/tendering.service.spec.ts
  - apps/api/src/modules/estimate-export/estimate-export.service.ts
  - apps/api/src/modules/estimate-export/estimate-export.service.spec.ts
  - apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts
  - apps/api/src/modules/pdf-rendering/builders/__tests__/quote-html.builder.spec.ts
  - apps/api/src/modules/client-quotes/quote-pdf.service.ts
done_when: >-
  pnpm build && pnpm lint && grep -q "RATE_BASIS_STAMP_V1"
  apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts && ! grep -q "if
  (!existing.ratesSnapshotAt) data.ratesSnapshotAt = now;"
  apps/api/src/modules/tendering/tendering.service.ts
size: 7
gate_allow: none
seed_only: false
escalates: true
backfill: false
module: estimate-export
design_ref: https://claude.ai/code/artifact/3020638f-054c-4e77-994e-1b6a3effff9b
cluster: quote-pdf-correctness
cluster_order: 2
requires_on_main: 'apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts :: ESTIMATE_PREVIEW_MARK_V1'
---

# QPDF-2 - put the rate basis on the document, and make the stamp mean something

**Grounded against `origin/main` = `e2804112`, every citation re-checked on disk 2026-09-10.**
Second of two in the `quote-pdf-correctness` chain. The gate above waits for QPDF-1's
`ESTIMATE_PREVIEW_MARK_V1` marker to reach `origin/main`, because both slices edit `coverPage()` and
`headerTemplate()` in the same file. A `GATE_NOT_RELEASED` verdict from the linter while QPDF-1 is
unmerged is the chain working, not a defect in this prompt.

## The three documents this slice is built from

| What | Where |
|---|---|
| **The spec - the agreed decision, not a proposal** | https://claude.ai/code/artifact/3020638f-054c-4e77-994e-1b6a3effff9b |
| PDF as-built - what the document renders today | https://claude.ai/code/artifact/12b3266c-8148-4648-a782-90ec52dbfa76 |
| Screen as-built - the tab that generates it | https://claude.ai/code/artifact/757617c5-14db-439d-9a00-9576d4c26c42 |

## ⛔ THE INTERNAL ORDER IS MANDATORY - (a) BEFORE (b)

This slice has two halves and **they must be done in this order inside the branch**:

**(a) Make the stamp honest. (b) Only then render it.**

Rendering the basis before fixing the writer prints *"someone picked Submitted from a dropdown"*
onto a client-facing document under the words "rates as of". That is strictly worse than the
current silence, and it is the single way this slice can do net harm. If you run out of budget after
(a), ship (a) alone and say so - do **not** ship (b) alone.

## (a) Stop the status transitions writing `ratesSnapshotAt`

`ratesSnapshotAt` currently means two different things:

* **A real lock.** `TenderRateSetService.lock()` materialises a `TenderRateSet` with every rate
  copied onto it, then stamps the tender at `tender-rate-set.service.ts:83`. Note the write is
  **unconditional** - a later lock silently overwrites whatever a status transition put there.
* **A dropdown change.** Picking "Submitted" in the header stamps the same column
  (`tendering.service.ts:1013`, and `:1019` / `:1026` for the AWARDED / LOST paths that back-fill
  `submittedAt`), and creates nothing. The bulk path repeats it at `:303`, `:309`, `:316`.
  `unlock()` then nulls the column at `tender-rate-set.service.ts:155`, so unlocking erases whichever
  meaning was in there. (`unlock()` returns early at `:149` when no `TenderRateSet` exists, so a
  status-only stamp is not erasable on its own - the erasure needs status → lock → unlock.)

**Remove all six status-path writes** and correct the comment at `tendering.service.ts:1008-1010`
that asserts the transition freezes the rate snapshot. `submittedAt` / `wonAt` / `lostAt` keep their
existing behaviour untouched - only the `ratesSnapshotAt` lines go.

**MEASURED 2026-09-10, and it makes this cheaper than the spec expected.** The spec warned that
"two spec files currently assert" the side-effect. They do not. Every occurrence of
`ratesSnapshotAt` in `tendering.service.spec.ts` (`:155`, `:197`, `:241`, `:315`, `:356`) and in
`__tests__/tendering-win-counted.spec.ts` (`:74`, `:111`) is **fixture data on a `findUnique` mock**,
not an assertion on the `update` payload. Nothing asserts the write. Your job in
`tendering.service.spec.ts` is therefore to **add** the missing assertion - that a
`DRAFT → SUBMITTED` transition on a tender with `ratesSnapshotAt: null` writes `submittedAt` and
does **not** write `ratesSnapshotAt` - rather than to repair a broken one.

## (b) Print the rate basis, sourced from `TenderRateSet.lockedAt`

**Take the no-migration path.** Read the printed date from `TenderRateSet.lockedAt`
(`schema.prisma:6048`), not from the `Tender.ratesSnapshotAt` column.

* `Tender.rateSet` is already a relation (`schema.prisma:1391`), so this is **one line added to the
  existing `include` block** in `fetchTenderForExport` - the block runs to `tandC: true` at
  `estimate-export.service.ts:237`. Add `rateSet: { select: { lockedAt: true } }` and surface it on
  the `ExportPayload` type (the tender block is `:120-135`; `ratesSnapshotAt` is already on it at
  `:128` and populated at `:392`).
* **This is a builder-only render.** `quote-pdf.service.ts:40` builds its base payload by calling the
  same `fetchTenderForExport`, and `:137` calls the same `buildQuoteHtml`, so the per-client path
  inherits the new field with no extra plumbing. The only reason `quote-pdf.service.ts` is in
  `scope` is the `headerTemplate` call at `:141` - see the signature note below.
* Print it on the cover meta grid next to the existing `Date:` row (`quote-html.builder.ts:372`) and
  in the header document-control strip (`:840`), which today reads *"Electronic document |
  Uncontrolled when printed | Printed on: `<date>`"* - the document asserts when it was **printed**
  and never when it was **priced**.
* Mark the file with the literal token `RATE_BASIS_STAMP_V1`.

### A tender with no `TenderRateSet` has no honest basis to print

`Tender.rateSet` is optional. When it is absent the document must **say so explicitly** - print an
unambiguous "rates not locked" style statement. It must **not** silently fall back to the print date
or to `Tender.ratesSnapshotAt`, because that is the exact substitution this slice exists to stop.
Whether such a tender should be allowed to render a PDF at all is an open question for Marco
(spec, Open Questions #4); this slice renders and states the fact.

### Deliberately not doing: retiring the `ratesSnapshotAt` column

Deriving everything from `TenderRateSet.lockedAt` is the right end state, but the column is read by
`QuoteTab.tsx:89` / `:356-365`, by `TenderDetailPage.tsx`, by `estimate-excel.builder.ts:81-86`
("Rates snapshot") and by the export payload itself. Retiring it means a migration, a mandatory
escalation, and a question about the rows a status transition already stamped with a meaningless
date. That is a **fifth slice**, not a rider on this one, and it would push this slice past
`size > 10`. Reading `lockedAt` for the PDF sidesteps the column entirely without touching it.

## Hard constraints on anything you put in the header band

**PR #223 (`d3cf0851`) removed an in-page header because it doubled against the Puppeteer one.**
The scar comment is still on `quote-html.builder.ts:157`. The header stays in Puppeteer's
`headerTemplate` (`:826-842`); do **not** re-introduce an in-body header.

**`headerTemplate` and `footerTemplate` cannot use Outfit or Syne.** They render in an isolated
context that cannot see the page's `@font-face` rules (`:122-133`), which is why both already
hard-code `font-family:Helvetica,Arial,sans-serif` (`:832`, `:846`). Anything in the header band is
Helvetica. Anything that must be Outfit or Syne belongs in the page body.

**Signature note.** `headerTemplate` is called from `estimate-export.service.ts:440` and
`quote-pdf.service.ts:141`. QPDF-1 has already added an optional parameter for the estimate-preview
mark; extend that options object rather than adding a second positional argument, and update both
call sites.

**Height.** `estimate-export.service.ts:441` sets `margin: { top: "35mm" }`. If the band grows, the
margin must grow with it or the body overlaps on every page. State the before/after in the PR body.

## Verification - put these in the PR body

- [ ] `pnpm build` and `pnpm lint` green; API test suite green with before/after counts.
- [ ] Quote the six removed `ratesSnapshotAt` lines from `tendering.service.ts` and the corrected
      comment.
- [ ] `tendering.service.spec.ts`: the new assertion that `DRAFT → SUBMITTED` writes `submittedAt`
      and not `ratesSnapshotAt`. Quote it.
- [ ] `TenderRateSetService.lock()` still stamps `ratesSnapshotAt` at `tender-rate-set.service.ts:83`
      and is absent from the diff. The lock is the one honest writer; it stays.
- [ ] `quote-html.builder.spec.ts`: a payload **with** a locked rate set prints the lock date; a
      payload **without** one prints the explicit "not locked" statement and never the print date.
- [ ] Confirm the per-client overlay path renders the same basis - it must, both paths go through
      `buildQuoteHtml`.
- [ ] Rendered header height before and after, and the `margin.top` that clears it.
- [ ] Grep the diff for new hex literals and report the count; colours come from `BRAND` in
      `estimate-export/pdf/tc-text.const.ts:91-98`.

## Do NOT

- Do **NOT** ship (b) without (a). See the ordering block above.
- Do **NOT** add a migration, and do **NOT** remove `Tender.ratesSnapshotAt` or any of its readers.
- Do **NOT** redesign the document. #220-#225 designed it and #234 signed it off on 2026-05-27. No
  font, colour, margin or section-order change beyond the one line of new text.
- Do **NOT** consolidate the four duplicated PDF stylesheets (`quote-html.builder.ts`,
  `sor-client-pdf.builder.ts`, `forms/pdf/submission-html.builder.ts`,
  `reporting/reporting-export.service.ts`). Out of scope for every QPDF slice.
- Do **NOT** touch the rates catalogue model - how rates are sourced, modelled or versioned is a
  separate cluster. This slice reads `TenderRateSet.lockedAt` and changes nothing else about rates,
  deliberately, so the two do not have to land in a particular order.
- Do **NOT** re-introduce an in-page header (#223), and do **NOT** put Outfit or Syne in
  `headerTemplate` / `footerTemplate`.
- Do **NOT** change what the "Quote No." field prints for the per-client path - QPDF-1 settled the
  tender-level reference and the per-client format is an open product decision (see
  `pr-qpdf-3-quoteref-collision-409-HOLD.md`).
- Do **NOT** touch `/sot/`, Azure/Entra/SharePoint, `apps/api/prisma/**`, `apps/web/**`, or any file
  outside `scope`.

Title the PR `fix(estimate-export): print the rate basis and stop status transitions faking it`.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

`escalates: true` - this removes a lifecycle side-effect and puts new text on a client-facing
document. It gates the MERGE, not the RUN. Open the PR and leave it unmerged for Marco.

## Guardrails

- One attempt. If the premise is already satisfied on main, say `NO-OP: premise already satisfied`
  and exit.
- Never exit silently. Say `NO-OP: <reason>` loudly if you cannot finish - a silent exit is read as
  success by the watcher, which is the worst outcome.
- **Never ask a question or "stand by" for approval.** There is no human in this run. A dismissed or
  unanswered question is the absence of a human, not a stop signal: proceed on best judgement and
  record the assumption in the PR body.
- Read the CI job log (`gh run view <run-id> --log`) before diagnosing any failure.
