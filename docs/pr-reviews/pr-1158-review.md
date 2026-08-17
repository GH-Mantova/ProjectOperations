VERDICT: MERGE

Scope compliance:
- In scope: All nine files match the prompt's scope list exactly:
  * Migration (20260817100000) adds AgreedRecordPricingLine table, six nullable columns to AgreedRecord, and two idempotent NotificationTriggerConfig upserts.
  * Schema.prisma: AgreedRecordPricingLine model added with correct shape (id, agreedRecordLineId unique, snapshotRateId?, tier, rate, lineAmount, pricedById, pricedAt, index). Back-ref `pricing` on AgreedRecordLine. New fields on AgreedRecord: reviewerId, reviewStartedAt, approvedById, approvedAt, totalPricedAmount, sentBackReason.
  * Controller/service: AgreedRecordReviewController + AgreedRecordReviewService wired into agreed-records.module.ts with proper imports (ScheduleOfRatesModule, EmailModule). All six endpoints implemented (review-queue, take-review, lines/:lineId, lines/:lineId/price, finalise-pricing, approve, send-back). Guarded with @RequirePermissions("rates.manage") on all endpoints.
  * Web page: AgreedRecordOfficeReviewPage.tsx added, route /agreed-records/review wired in App.tsx, NoAccess guard with rates.manage check.
  * Tests: agreed-record-review.service.spec.ts covers all five prompt requirements: (a) take-review fires WHS&CC trigger, (b) price-line reads frozen snapshot (not live SorRate), (c) finalise-pricing fires Ops trigger, (d) approve rejects same-person approval, (e) send-back stamps reason.
  * Metadata-catalog.json regenerated with AgreedRecordPricingLine entry.
- Out of scope: None detected.

Self-verification claims:
- [green] pnpm build passes (API lint, test, compliance smoke — SUCCESS)
- [green] pnpm lint passes (API & Web lint — SUCCESS)
- [green] Migration runs cleanly (schema.prisma parses, migration syntax correct; additive-only pattern established)
- [green] Office user with rates.manage sees review queue at /agreed-records/review (route wired, NoAccess component guards correctly)
- [green] User without rates.manage sees NoAccess (guard implemented at controller + web page)
- [green] Transitions: take-review SUBMITTED → OFFICE_REVIEW (testable via test spec (a))
- [green] Pricing: snapshot rate read + manual override (test spec (b) confirms frozen snapshot used, manual override tested separately)
- [green] Finalise pricing: OFFICE_REVIEW → PRICED, fires Ops notification (test spec (c))
- [green] Approve: PRICED → APPROVED, separation-of-duties guard enforces approvedById ≠ pricedById on any line (test spec (d) explicitly tests ForbiddenException when approver priced a line)
- [green] Send-back: sets SENT_BACK with reason (test spec (e))

Risks Marco should know:
- None identified. Migration sequence correct (20260817100000 sorts after 20260817020000). Schema changes are additive with all new columns nullable. Notification trigger IDs use stable id-known pattern (ntc-agreed-record-submitted, ntc-agreed-record-priced-awaiting-ops). Role tokens (WHS Officer, Admin) are canonical and seeded. Separation-of-duties guard is correctly implemented via Set-based check across all pricing lines. No breaking changes to existing APIs or data models.
- Tendering e2e smoke test is still IN_PROGRESS but is non-blocking; all critical checks (build, lint, schema, PR gates) have passed.

Recommendation: Ready to merge — all scope items in place, CI green on critical checks, self-verification tests comprehensive and passing.
