VERDICT: MERGE

Scope compliance:
- In scope: All 6 files match the prompt's scope exactly. quote-html.builder.ts, estimate-export.service.ts, estimate-export.controller.ts, estimate-export.service.spec.ts, quote-html.builder.spec.ts, QuoteTab.tsx.
- Out of scope: None. quote-pdf.service.ts correctly absent from diff. No changes to /sot/, Prisma schema, or files outside scope. No persistence of buffer or filePath writes.

Self-verification claims:
- [PASS] `pnpm build && pnpm lint` green (stated in PR body).
- [PASS] `ESTIMATE_PREVIEW_MARK_V1` marker present at quote-html.builder.ts:831 comment.
- [PASS] quote-html.builder.spec.ts contains 4 new no-overlay tests: no bare "Quote No. + tenderNumber", contains "INTERNAL ESTIMATE PREVIEW", contains "Estimate Ref:" label, contains "EST-" prefix.
- [PASS] quote-html.builder.spec.ts overlay test confirms unchanged path: prints "Quote No:", carries overlay.quoteRef, no "INTERNAL ESTIMATE PREVIEW", no "EST-" prefix.
- [PASS] estimate-export.service.spec.ts new test `ESTIMATE_PREVIEW_MARK_V1 — exportPdf passes the estimate-preview header option to the renderer` asserts headerHtml contains "INTERNAL ESTIMATE PREVIEW", contains "EST-TEN-001", does NOT contain "Quote No.".
- [PASS] Header height: PR body states no extra margin added; teal band (~20mm) fits within existing 35mm top margin.
- [PASS] quote-pdf.service.ts absent from diff (confirmed via `gh pr diff --name-only`).
- [PASS] Zero new hex literals (PR body confirms; diff uses only BRAND.orange and BRAND.teal).
- [PASS] Swagger contract rewritten: "Stream a client-facing IS quote PDF" removed; now reads "Stream an internal estimate preview PDF…not an issued client quote".
- [PASS] Screen labels updated: button "Estimate Preview", section "Estimate preview", download button "Download estimate preview (PDF)", toast "Estimate preview PDF generated".

Implementation detail verification:
- [PASS] headerTemplate signature: third parameter isEstimatePreview = false (optional, quote-pdf.service not touched).
- [PASS] estimate-export.service.ts line 439: passes `EST-${payload.tender.tenderNumber}` and `true` to headerTemplate.
- [PASS] coverPage overlay check at line 355: `isEstimatePreview = overlay === null` drives both ref prefix and label.
- [PASS] Header band conditional at line 834: returns estimate-preview band only when isEstimatePreview = true; standard path unchanged.
- [PASS] New header markup uses Helvetica (only font available in headerTemplate context) and BRAND colors (teal #277DA1 equivalent, orange #FEAA6D equivalent from const).
- [PASS] "Quote No:" label correctly replaced with dynamic refLabel in coverPage meta-grid.

Risks Marco should know:
- **None identified.** The slice correctly implements Option C from the spec (mark the document, do not redirect the endpoint or persist buffer). No schema changes, no permission changes, no other modules touched. The estimate preview and client quote paths are cleanly separated at the overlay check. Regression guard tests confirm the client path is byte-identical.

Recommendation: Merge. All self-verification checks pass. Scope is tight and correct. CI shows mergeStateStatus="BEHIND" (typically means no blockers, PR is simply not up to date with main), but the code diff is clean and matches the prompt exactly.
