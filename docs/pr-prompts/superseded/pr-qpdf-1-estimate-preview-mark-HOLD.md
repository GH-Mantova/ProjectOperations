---
premise: '! grep -q "ESTIMATE_PREVIEW_MARK_V1" apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts'
premise_means: >-
  GET /tenders/:id/export/pdf still streams a live-priced, brand-headed document that is
  indistinguishable from an issued client quote. estimate-export.service.ts:436 calls
  buildQuoteHtml(payload) with no overlay; the payload's money comes from
  ScopeRedesignService.summary(tenderId) (:246), recomputed from the rate library on every call;
  estimateExport.create() (:443-445) records that an export happened and never what was in it. The
  document prints "Quote No. <tenderNumber>" (quote-html.builder.ts:354, :370, :837, :861-862) -
  byte-identical to the ref ClientQuote revision 1 is minted with (client-quotes.service.ts:168-170).
  Nothing in the builder distinguishes the two paths.
scope:
  - apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts
  - apps/api/src/modules/pdf-rendering/builders/__tests__/quote-html.builder.spec.ts
  - apps/api/src/modules/estimate-export/estimate-export.service.ts
  - apps/api/src/modules/estimate-export/estimate-export.service.spec.ts
  - apps/api/src/modules/estimate-export/estimate-export.controller.ts
  - apps/web/src/pages/tendering/QuoteTab.tsx
done_when: >-
  pnpm build && pnpm lint && grep -q "ESTIMATE_PREVIEW_MARK_V1"
  apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts && ! grep -q "Stream a
  client-facing IS quote PDF" apps/api/src/modules/estimate-export/estimate-export.controller.ts
size: 6
gate_allow: none
seed_only: false
escalates: true
backfill: false
module: estimate-export
design_ref: https://claude.ai/code/artifact/3020638f-054c-4e77-994e-1b6a3effff9b
cluster: quote-pdf-correctness
cluster_order: 1
---

# QPDF-1 - stop issuing a live-priced quote

**Grounded against `origin/main` = `e2804112`, every citation re-checked on disk 2026-09-10.**
First of two in the `quote-pdf-correctness` chain. `pr-qpdf-2-rate-basis-stamp-HOLD.md` waits on the
marker this slice introduces, because both slices edit the same two functions in
`quote-html.builder.ts`.

## The three documents this slice is built from

| What | Where |
|---|---|
| **The spec - the agreed decision, not a proposal** | https://claude.ai/code/artifact/3020638f-054c-4e77-994e-1b6a3effff9b |
| PDF as-built - what the document renders today | https://claude.ai/code/artifact/12b3266c-8148-4648-a782-90ec52dbfa76 |
| Screen as-built - the tab that generates it | https://claude.ai/code/artifact/757617c5-14db-439d-9a00-9576d4c26c42 |

Read the spec first. Marco chose **Option C** from its decision section: keep the endpoint, and
render its output as what it actually is - an internal estimate preview. Options A (point the
button at the per-client path) and B (persist the rendered buffer) were considered and rejected in
writing. **Do not re-open that choice, and do not implement half of A "while you are in there".**

## The exposure is the endpoint, not the button

`estimate-export.controller.ts:20` gates `GET /tenders/:id/export/pdf` on **`tenders.view`**, not
`tenders.manage`. The UI hides the section behind `canManage` (`QuoteTab.tsx:72`), but the route
does not. Anyone who can view a tender can call the endpoint from a bookmark, a script or the
Swagger UI and receive a live-priced, brand-headed, client-facing quote. **A UI-only change does
not close this**, which is why the builder and the service are the primary targets and
`QuoteTab.tsx` is the smallest part of this diff.

The endpoint's own Swagger contract admits the problem in one sentence
(`estimate-export.controller.ts:21-24`):

> "Stream a **client-facing** IS quote PDF for the tender. Totals are **recomputed from raw
> EstimateItem lines on every call**; stored totals are never trusted."

Both halves are true and they contradict each other. That is the cleanest single piece of evidence
for this slice.

## What to build

### 1. The builder learns that a no-overlay render is an estimate preview

`buildQuoteHtml(payload, overlay = null)` (`quote-html.builder.ts:856-882`) is shared by both paths.
`quote-pdf.service.ts:137` passes a real `QuoteOverlay`; `estimate-export.service.ts:436` passes
nothing. **Drive the preview treatment from `overlay === null` and nothing else.** A naive "always
draft" edit marks genuine issued client quotes as drafts, which is a worse defect than the one
being fixed.

Inside the builder, when `overlay === null`:

* **The reference stops being a mintable quote ref.** Today `coverPage()` computes
  `const quoteRef = overlay?.quoteRef ?? p.tender.tenderNumber` (`:354`) and prints it under the
  label `Quote No:` (`:370`); `buildQuoteHtml` repeats the same fallback at `:861-862`. On the
  no-overlay path the label must not read `Quote No` and the value must not be the bare
  `tenderNumber`. Prefix it so it can never collide with a `ClientQuote.quoteRef`
  (`client-quotes.service.ts:168-170` mints `<tenderNumber>` or `<tenderNumber>-R{n}`), and label it
  as an estimate reference.
* **The cover carries a visible internal-estimate mark.** The cover page is page body, so it may use
  Outfit/Syne like the rest of the document.
* Leave `overlay !== null` byte-identical. Prove it in the test (see Verification).

Mark the file with the literal token `ESTIMATE_PREVIEW_MARK_V1` in a comment next to the branch, so
the premise, the `done_when` and QPDF-2's chain gate all have one fixed string to reference.

### 2. The draft mark goes in the Puppeteer header band, not in the page

**HARD CONSTRAINT - PR #223 (`d3cf0851`).** The repeating header lives in Puppeteer's
`headerTemplate` and nowhere else. #223 removed an in-page header precisely because it doubled
against the Puppeteer one, and the scar comment is still on line 157 of the builder:
`/* Header is rendered via Puppeteer headerTemplate - no in-body header CSS needed */`.
**Do not re-introduce an in-body header.**

**HARD CONSTRAINT - fonts.** `headerTemplate` (`:826-842`) and `footerTemplate` (`:844-852`) render
in an isolated context that cannot see the page's `@font-face` rules (`:122-133`). That is why both
templates already hard-code `font-family:Helvetica,Arial,sans-serif` (`:832`, `:846`). Anything you
add to the header band is Helvetica. This is not a preference and it cannot be "fixed" by adding
the font.

`headerTemplate` already interpolates the reference at `:837` and already renders a document-control
strip at `:840` reading *"Electronic document | Uncontrolled when printed | Printed on: `<date>`"*.
So the document already asserts when it was **printed** and never when it was **priced**. Put the
draft mark in that band.

**Signature.** `headerTemplate(quoteRef, ctx)` is called from two places:
`estimate-export.service.ts:440` and `quote-pdf.service.ts:141`. Add an **optional** third parameter
so only the estimate-export caller has to change - `quote-pdf.service.ts` is deliberately outside
this slice's `scope` and must stay out of the diff.

**Height.** The render sets `margin: { top: "35mm" }` (`estimate-export.service.ts:441`). Adding
height to the header band without adding margin overlaps the body on every page. Either fit the mark
into the existing band or raise the top margin on the estimate-preview call only - and say in the PR
body which you did and why.

### 3. Correct the Swagger contract

Rewrite the `@ApiOperation` summary at `estimate-export.controller.ts:21-24` so it describes what
the endpoint actually produces: an internal estimate preview, priced from the current rate library
at request time, not an issuable client quote. The literal string
`Stream a client-facing IS quote PDF` must be gone - `done_when` checks for its absence.

### 4. Relabel the screen honestly

`QuoteTab.tsx` renders `ClientQuotesPanel` first and always (`:66-70`); the tender-level export sits
in a `GenerateQuoteSection` (defined `:273`) that is collapsed by default behind a "Generate Quote"
toggle (`:72-82`, state at `:56`) and mounted at `:84-91`. The button label is at `:344`
("Download PDF quote") and the fetch at `:308`.

Rename the section, the toggle and the button so an estimator reading the screen knows the output is
an internal estimate preview and the per-client panel above is where an issuable quote comes from.
Text only. **Do not move, restyle or re-order anything** - the screen as-built mock-up is the
reference for everything you are not changing.

## Verification - put these in the PR body

- [ ] `pnpm build` and `pnpm lint` green.
- [ ] `quote-html.builder.spec.ts`: a no-overlay render contains the estimate-preview mark and does
      **not** contain a bare `Quote No.` + `tenderNumber` pair.
- [ ] `quote-html.builder.spec.ts`: **an overlay render is unchanged** - it carries no draft mark and
      still prints `overlay.quoteRef`. This is the regression guard for the real client path.
- [ ] `estimate-export.service.spec.ts`: `exportPdf` passes the estimate-preview header option;
      quote the assertion.
- [ ] State the rendered header height before and after, and confirm `margin.top` still clears it.
- [ ] Confirm `quote-pdf.service.ts` is absent from the diff.
- [ ] Both themes are irrelevant here (PDF is light-only), but any colour you touch must come from
      `BRAND` in `estimate-export/pdf/tc-text.const.ts:91-98`. Grep the diff for new hex literals and
      report the count.

## Do NOT

- Do **NOT** redesign the document. #220-#225 designed it deliberately and #234 signed it off on
  2026-05-27. No font, colour, margin or section-order change. The visual redesign is explicitly out
  of scope for all four QPDF slices.
- Do **NOT** consolidate the four duplicated PDF stylesheets (`quote-html.builder.ts`,
  `sor-client-pdf.builder.ts`, `forms/pdf/submission-html.builder.ts`,
  `reporting/reporting-export.service.ts`). Out of scope - touching a shared copy while three sibling
  slices are in flight against one of them is how merge conflicts get made.
- Do **NOT** touch the rates catalogue model. Out of scope; a separate cluster owns it.
- Do **NOT** re-introduce an in-page header (#223), and do **NOT** put Outfit or Syne in
  `headerTemplate` / `footerTemplate`.
- Do **NOT** change the per-client overlay path's output in any way.
- Do **NOT** change `@RequirePermissions("tenders.view")` on the route. Aligning the route with the
  UI's `canManage` is a real question and it is **not this slice's** - marking the document is the
  fix Marco chose. Note the observation in the PR body and move on.
- Do **NOT** persist the rendered buffer or write `EstimateExport.filePath` /
  `ClientQuote.generatedPdfPath`. That is Option B, deferred pending a storage convention.
- Do **NOT** touch `/sot/`, Azure/Entra/SharePoint, `apps/api/prisma/**`, or any file outside
  `scope`.

Title the PR `fix(estimate-export): mark the tender-level PDF as an internal estimate preview`.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

`escalates: true` on this slice changes the face of a signed-off client-facing document. It gates
the MERGE, not the RUN. Open the PR and leave it unmerged for Marco.

## Guardrails

- One attempt. If the premise is already satisfied on main, say `NO-OP: premise already satisfied`
  and exit.
- Never exit silently. Say `NO-OP: <reason>` loudly if you cannot finish - a silent exit is read as
  success by the watcher, which is the worst outcome.
- **Never ask a question or "stand by" for approval.** There is no human in this run. A dismissed or
  unanswered question is the absence of a human, not a stop signal: proceed on best judgement and
  record the assumption in the PR body.
- Read the CI job log (`gh run view <run-id> --log`) before diagnosing any failure.
