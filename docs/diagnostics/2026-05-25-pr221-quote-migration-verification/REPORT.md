# PR #221 — Quote PDF Migration Verification

- **Date:** 2026-05-25 (AEST)
- **Author:** Cowork (local diagnostic agent)
- **PR:** #221 — `[5A.2] Quote PDF — HTML template + migration`
- **Method:** code review of the PR branch + visual smoke-test of both sample
  PDFs in `docs/samples/`.

---

## §1 — Verdict

**PR #221 verified — clean migration, professional output, ready for Sean's
visual sign-off.** Both consumers render correct, complete quote PDFs through
the new HTML renderer; the two-column T&C — the headline PDFKit bug class —
lays out cleanly; the brand fonts render. No defects found. The one thing
outside Cowork's reach is pixel-fidelity against Sean's reference `Quote.docx`
(not accessible to the sandbox) — that sign-off stays with Sean.

## §2 — Structural review

- `apps/api/src/modules/estimate-export/pdf/quote-pdf.builder.ts` (the PDFKit
  builder) is **deleted**. `tc-text.const.ts` correctly kept (shared by other
  modules).
- `grep` for `buildQuotePdf` / `quote-pdf.builder` across `apps/api/src` →
  **no dangling references**.
- Both consumers rewired to the new path:
  - `QuotePdfService.generate()` → `buildQuoteHtml(base, overlay)` →
    `PdfRendererService.renderHtmlToPdf` (with overlay).
  - `EstimateExportService.exportPdf()` → `buildQuoteHtml(payload)` →
    `renderHtmlToPdf` (no overlay).
- `pdfkit` dependency kept — still used by the persona test fixtures and the
  seed.

## §3 — PDF smoke test (both samples)

`sample-quote-with-overlay.pdf` (per-ClientQuote) and
`sample-quote-tender-level.pdf` (tender-level, no overlay) — both 4 pages,
both render cleanly:

- **Two-column Terms & Conditions** (pages 3–4) lays out correctly with no
  column-flow breakage, text overlap, or font drift — the exact PDFKit bug
  class this migration set out to eliminate.
- **Fonts** — headings render in Syne, body in Outfit, as real fonts (not a
  fallback). This is the live confirmation of the PR #220 font fix that CI
  cannot see.
- **Brand** — teal section headers, orange accent rules, IS logo in the
  repeating header band; per-page footer with address line + "Page X of 4";
  "Electronic document / Uncontrolled when printed / Printed on" block.
- **Overlay path** (with-overlay sample) correctly applied: per-quote ref
  `IS-Q020-A`, lettered cost lines A–D, cost options (X1/X2), provisional
  sums (P1/P2), assumptions grouped by item (`assumptionMode: linked`),
  acceptance block addressed to the quote's client.
- **No-overlay path** (tender-level sample) correctly differs: discipline-coded
  cost summary (DEM/CIV/ASB/Cutting), WBS-grouped scope table, site details,
  flat assumptions (`free` mode). The two consumers produce appropriately
  different documents.
- Every expected section is present: cover letter, cost summary, cost options,
  provisional sums, preliminary works, referenced drawings, scope table,
  allowances, assumptions, exclusions, full T&C, acceptance/signature block.

## §4 — Builder code review

`quote-html.builder.ts` (873 lines) — assembles the HTML programmatically
(helpers + `coverPage` / `scopePage` / `assumptionsPage` / `acceptanceBlock`
+ a `css()` block), as specified. The `esc()` helper (line 59) escapes
`&`, `<`, `>` and is applied **63 times** across the builder — dynamic quote
and client data is HTML-escaped (verification finding 3 from PR #220
addressed). Output confirms it: em-dashes, ampersands, and `&` in headings all
render correctly with no broken or injected markup.

## §5 — Notes (none blocking)

1. **Watermark** — project_instructions §11 calls for a centred IS watermark
   at 5% opacity. It is not clearly visible in the rendered samples; it may be
   present and simply too faint to register at this resolution (which is the
   intent), or absent. Worth a quick confirm with Claude Code / Sean. Cosmetic,
   low priority.
2. **`esc()` scope** — escapes `&<>`, which is correct for HTML *text content*
   (where all quote data goes). If any dynamic value is ever placed inside an
   HTML *attribute* in future template work, attribute-quote escaping (`"` /
   `'`) should be added. Advisory only — not an issue in the current builder.
3. **Reference fidelity** — Cowork cannot open Sean's reference `Quote.docx`
   (`C:\ProjectOperations-Reference\`, outside the mounted folder), so
   pixel-level letterhead/layout fidelity was not checked. The rendered output
   is correct, complete, and clean — it is worth putting in front of Sean for
   the §5A.2 visual sign-off.

## §6 — Recommendation

Let #221 merge. The migration is sound and the rendered quotes are
production-quality. Next: Sean reviews the two sample PDFs against his
reference for the visual sign-off; once that lands, §5A.2 PRs 3 (Variation)
and 4 (Schedule of Rates) follow the same pattern.

*Report produced by Cowork. Not committed by Cowork.*
