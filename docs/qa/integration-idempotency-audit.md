# AUDIT — idempotency + retry/degrade behaviour across external-integration call sites

**Scope:** every outbound or ingest surface in `apps/api/src` that leaves the process boundary
(Xero, Microsoft Graph mail, forms ingestion, OTP delivery, SharePoint Graph). Measures each
call site against the Forms v2 §4.4 bar (submission survives; delivery is logged; primary user
action never fails on a downstream integration hiccup) and the house pattern in
`docs/architecture/drafts/idempotency-pattern.md` (fingerprint the request BEFORE the external
call, degrade instead of crashing, prove the provider state before assuming — [[LL-39]]).

**Method:** grep for every call site of the outbound integrations, read the source, record what
protection exists TODAY. This is a docs/qa deliverable — no code was touched. Fixes surface as
separately-gated backlog items at the bottom.

**Scope note on Jotform.** Repo-wide grep of `apps/**` turned up **zero** live Jotform
integration code. The only references are:
- inline comments in `assets.service.ts` / `assets.controller.ts` that name the retired
  "Grice Office Key Checkout" Jotform, replaced by the native asset checkout flow;
- design-time analysis docs in `docs/architecture/drafts/` (jotform-forms-gap-analysis.md,
  idempotency-pattern.md, form-inspection-engine-spec.md) that treat Jotform as an aspirational
  bridge, not an implemented one.

The living "form ingestion" surface is the **native** forms engine — public/kiosk submits and
authenticated engine submits. That is what §"Forms ingestion" below audits, and it is the honest
in-repo analogue to the "Jotform submission ingestion" mentioned in the source prompt.

---

## 1. Call-site inventory

| # | Surface | Call site | Notes |
|---|---|---|---|
| X1 | Xero — contact upsert | `apps/api/src/modules/xero/xero.service.ts:262` `syncContact()` and `328` `syncAllContacts()` | On-demand from `xero.controller.ts:41` and admin bulk endpoint. |
| X2 | Xero — ACCREC invoice from progress claim | `apps/api/src/modules/xero/xero.service.ts:357` `createInvoiceFromProgressClaim()` | On-demand from `xero.controller.ts:59`. |
| X3 | Xero — ACCPAY bill from Expense | `apps/api/src/modules/xero/xero.service.ts:615` `pushBill()`; called fire-and-forget from `apps/api/src/modules/expenses/expenses.service.ts:253` on APPROVE. |  |
| X4 | Xero — ACCPAY bill from VendorInvoice | `apps/api/src/modules/xero/xero.service.ts:735` `pushVendorInvoiceBill()`; called fire-and-forget from `apps/api/src/modules/procurement/vendor-invoice.service.ts:198` on 3-way match and `:278` on variance-approve. |  |
| X5 | Xero — payment status pull | `apps/api/src/modules/xero/xero.service.ts:889` `syncPaymentStatus()` — cron every 6h. |  |
| X6 | Xero — supplier contact create-on-first-push | `apps/api/src/modules/xero/xero.service.ts:500` `resolveOrCreateSupplierContact()` — called from `pushVendorInvoiceBill`. |  |
| X7 | Xero — employee/reimbursement contact create-on-first-push | `apps/api/src/modules/xero/xero.service.ts:663-681` inline inside `pushBill()`. |  |
| X8 | Xero — retry cron | `apps/api/src/modules/xero/xero.service.ts:1034` `replayFailedBillPushes()` — every 30 min. |  |
| M1 | Graph mail — notification send (in-process fire-and-forget) | `apps/api/src/modules/email/email.service.ts:70` `sendNotificationEmail()` — used by contracts, projects, allocations, safety, compliance, tendering, forms notifyApprover. |  |
| M2 | Graph mail — Purchase Order issued email | `apps/api/src/modules/procurement/procurement.service.ts:348` inside `issuePurchaseOrder()`. |  |
| M3 | Graph mail — Client Quote send with PDF attachment | `apps/api/src/modules/client-quotes/quote-send.service.ts:58` `QuoteSendService.send()`. |  |
| M4 | Graph mail — Access request "please approve" | `apps/api/src/modules/access-requests/access-requests.service.ts:287`. |  |
| M5 | Graph mail — Tender entry task-assign notification | `apps/api/src/modules/tendering/tender-entries.service.ts:244`. |  |
| M6 | Graph mail — OTP code delivery | `apps/api/src/modules/auth/otp-delivery.port.ts` — port only, production adapter not yet wired (dev stub logs the code). |  |
| M7 | Graph mail — Live correspondence adapter | `apps/api/src/modules/correspondence/adapters/live-correspondence.adapter.ts:23` — STUB, throws `ServiceUnavailableException`. |  |
| S1 | Graph SharePoint — folder ensure / file upload | `apps/api/src/modules/platform/graph-sharepoint.adapter.ts:122` `ensureFolder()` and `:187` `uploadFile()`. |  |
| F1 | Forms ingestion — public/kiosk unauthenticated submit | `apps/api/src/modules/forms/public-link.service.ts:205` `publicSubmit()`; route `POST /forms/public/:token`. |  |
| F2 | Forms ingestion — authenticated engine submit | `apps/api/src/modules/forms/forms-engine.service.ts:439` `submitForm()`; route `POST /forms/engine/:id/submit`. |  |
| F3 | Forms ingestion — legacy raw submit | `apps/api/src/modules/forms/forms.service.ts:320` `submit()`. |  |
| P1 | Procurement — VendorInvoice ingest (invoice number → PO natural key) | `apps/api/src/modules/procurement/vendor-invoice.service.ts:156` `createInvoice()`. |  |

---

## 2. Per-site mechanism × retry × failure posture

Legend: **Idempotency** = what prevents a retried CALL from creating a duplicate downstream
effect. **Retry** = what the code itself does on failure. **Failure posture** = whether a
downstream failure fails the user's primary write.

### X1 — Xero contact upsert (`syncContact` / `syncAllContacts`)
- **Idempotency:** natural key via `Client.xeroContactId`. If already set → `updateContact` on
  the known id; if null → `createContacts` and persist the returned id back to the row. A
  RETRY of the very first sync BEFORE the id was persisted CAN create a duplicate Xero
  contact — the persist step happens after the API call and there is no `IdempotencyRecord`
  fingerprint (`xero.service.ts:285-294`). **Medium risk** — duplicate contact rows are cheap
  to reconcile, not a money-movement.
- **Retry:** none. Failure throws `BadRequestException` back to the caller (single admin
  action, not queued).
- **Failure posture:** DEGRADED — the local `Client` row is not affected, error is surfaced to
  the admin with sanitised text and written to `XeroSyncLog` (status=failed). `syncAllContacts`
  never throws; collects per-client failures into the result payload.

### X2 — Xero ACCREC invoice from ProgressClaim (`createInvoiceFromProgressClaim`)
- **Idempotency:** **NONE.** Unlike the ACCPAY bill path (X3/X4), there is no
  `findExistingBillLog("ProgressClaim", ...)` short-circuit before
  `xero.accountingApi.createInvoices` is called. If an operator hits the endpoint twice, or
  the browser retries a slow response, TWO Xero DRAFT invoices are created for the same
  progress claim. Reference is `claim.claimNumber` — Xero does not dedupe on reference. The
  success gets logged to `XeroSyncLog` but the guard is a WRITE, not a READ, so it cannot
  prevent the second call.
- **Retry:** none.
- **Failure posture:** DEGRADED — the ProgressClaim row is untouched; a failed push writes
  status=failed to `XeroSyncLog` and surfaces sanitised error text.
- **HIGH SEVERITY** — this is money movement (client-facing invoice) with no dedupe.

### X3 — Xero ACCPAY bill from Expense (`pushBill`)
- **Idempotency:** COVERED. `findExistingBillLog("Expense", expenseId)` reads the most-recent
  success row from `XeroSyncLog` and short-circuits with the stored `xeroId` before any Xero
  call (`xero.service.ts:617-623`). The design comment (`:436-446`) is explicit about the
  SKIP-not-UPDATE choice: bills may already be paid, updating is destructive.
- **Retry:** durable. Failures write `status="pending_retry"` + are added to an in-memory
  `retryQueue`. `replayFailedBillPushes` cron (every 30 min, X8) also picks up any
  `pending_retry` rows the in-memory map lost across a restart. Max 3 attempts, then
  `status="failed"`.
- **Failure posture:** GRACEFUL. Expense stays APPROVED; result signals `queued=true`. Caller
  in `expenses.service.ts:253` is fire-and-forget with `.catch()` logging — expense approval
  cannot fail on Xero.
- **Note:** the *contact-create* step embedded inside `pushBill` (X7 below) has its OWN
  idempotency gap — see there.

### X4 — Xero ACCPAY bill from VendorInvoice (`pushVendorInvoiceBill`)
- **Idempotency:** COVERED. Same `findExistingBillLog("VendorInvoice", ...)` short-circuit as
  X3 (`xero.service.ts:740-746`).
- **Retry:** same DB-backed queue + cron as X3.
- **Failure posture:** GRACEFUL. VendorInvoice stays MATCHED/APPROVED; callers in
  `vendor-invoice.service.ts:198` and `:278` are `void ... .catch(log)`.

### X5 — Xero payment status pull (`syncPaymentStatus` cron)
- **Idempotency:** APPEND-ONLY log rows keyed on `(entityType, entityId, direction="pull")`.
  Every 6h run writes a new row; the read side (`getPaymentStatus`) takes `orderBy: createdAt
  desc`. Because it's a READ from Xero, duplicate log rows only cost storage, not money. The
  writeback to `ProgressClaim.totalPaid` uses `updateMany({ where: { id, totalPaid: null } })`
  — a natural idempotency guard: only unpaid rows are updated (`xero.service.ts:973-979`).
- **Retry:** implicit — next cron tick retries any per-item failure. No exponential backoff.
- **Failure posture:** per-item try/catch increments an error counter; the cron logs the
  summary and returns. Never throws.

### X6 — Xero supplier contact create-on-first-push (`resolveOrCreateSupplierContact`)
- **Idempotency:** natural key via `SubcontractorSupplier.xeroContactId`. If null,
  `createContacts` is called and the returned id is persisted (`xero.service.ts:512-540`).
  Same gap as X1: between the API call and the persist step a retry can create a duplicate
  supplier contact in Xero.
- **Retry:** none at this layer; the wrapping `pushVendorInvoiceBill` will re-run the whole
  path on retry, which re-enters this create.
- **Failure posture:** propagates via the wrapping try/catch which converts to
  `handleBillPushFailure` (X4 queue).
- **Medium risk** — Xero-side supplier deduplication is manual cleanup, not a money event.

### X7 — Xero employee/reimbursement contact create-on-first-push (inline in `pushBill`)
- **Idempotency:** **NONE at our layer.** `pushBill` unconditionally calls
  `createContacts({ name: submitterName, ... })` on EVERY reimbursable expense approval
  (`xero.service.ts:665-673`). The code comment claims "Xero returns the existing contact if
  the name already exists" and relies on Xero server-side name dedupe — this is UNVERIFIED
  from the Xero SDK docs and is fragile (case-sensitivity, trailing whitespace, name changes
  after marriage/legal name updates all defeat it).
- **Retry:** none at this layer.
- **Failure posture:** wrapped by X3's retry queue.
- **Medium risk** — could create employee-contact duplicates in Xero. Not a money event, but
  operationally noisy.

### X8 — Xero retry cron (`replayFailedBillPushes`)
- **Idempotency:** COVERED — replays go through X3/X4's `findExistingBillLog` guard, so a
  retry that succeeded server-side but crashed before the log update will short-circuit next
  tick.
- **Retry:** BLIND retry, no backoff, capped at 3 attempts. Rows past the cap are marked
  `status="failed"` (dropped from queue) — requires manual re-push.
- **Failure posture:** cron itself never throws; per-item failures stay in the queue for the
  next tick.
- **Note:** no exponential backoff means a persistent Xero outage will hammer the API every
  30 min × 3 attempts before giving up. Low-severity — the interval is already conservative.

### M1 — Graph mail notification send (`EmailService.sendNotificationEmail`)
- **Idempotency:** **NONE.** No Graph `internetMessageId` seeding, no `IdempotencyRecord`
  fingerprint, no send-log dedupe check. Two invocations for the same trigger send two emails.
  In practice this is mitigated by the callers being domain events (contract signed, tender
  submitted, worker allocated) that fire once per state transition, but a retried transition
  or a duplicate handler invocation WILL double-send.
- **Retry:** none — a single attempt inside a try/catch.
- **Failure posture:** GRACEFUL by contract (`email.service.ts:98-102`, "Defensive catch —
  email is a side-effect that must never propagate"). All callers use `void this.email.
  sendNotificationEmail(...)` fire-and-forget, so the user's primary write is never blocked
  on mail. Failure is logged at warn.
- **Medium severity** — duplicated notifications are annoying, not dangerous. Move to LOW if
  the domain-event dedupe on the calling side is proven end-to-end (UNVERIFIED in this pass).

### M2 — Graph mail — Purchase Order issued email (`procurement.service.ts:348`)
- **Idempotency:** partial. The email is sent *before* `PurchaseOrder.emailSentAt` is
  stamped. If the send succeeds but the DB update at `:370-374` fails, a subsequent retry of
  the whole endpoint would re-send. There is no early check on
  `PurchaseOrder.emailSentAt != null` before calling `provider.sendMail`. The endpoint
  requires status=APPROVED and transitions to ISSUED atomically after the send, which is the
  de-facto dedupe — but the transition happens AFTER the send, not before.
- **Retry:** none.
- **Failure posture:** GRACEFUL — try/catch around the mail call; PO record still moves to
  ISSUED even if the mail failed (comment at `:340` "Email is a side-effect — never let a
  mail failure roll back the PO"). Which is correct for the PO but leaves the supplier
  without an email until an operator re-triggers, and there's no visible integration-health
  state for that.
- **Medium severity** — duplicate POs going to a supplier is legally awkward.

### M3 — Graph mail — Client Quote send with PDF attachment (`quote-send.service.ts:58`)
- **Idempotency:** **NONE.** The quote can be re-sent at will — every call writes a new
  `QuoteEmail` row (no unique key), transitions the quote to SENT (idempotent on the
  ClientQuote row) and hits Graph again with a fresh PDF. This is arguably CORRECT behaviour
  (operators often re-send quotes when the client can't find the email) but there is no guard
  against an accidental double-submit from the SPA producing two identical emails to the
  client with a legally-binding T&C attachment.
- **Retry:** none.
- **Failure posture:** GRACEFUL — the outer try/catch returns `{ success: false, error }`
  without touching quote status when the mail path throws.
- **Medium severity** — legally-anchored T&C snapshots make duplicate sends confusing but not
  dangerous.

### M4 — Graph mail — Access request notify-admin (`access-requests.service.ts:287`)
- **Idempotency:** NONE at the mail layer. The upstream `access_request` row IS created inside
  a transaction with a unique-on-email guard, so the domain-level dedupe holds — but a retried
  HTTP request that succeeds server-side after we sent the mail will re-send.
- **Retry:** none.
- **Failure posture:** UNVERIFIED — need to confirm the callsite wraps in try/catch and does
  not roll back the request row on mail failure. Left as a fix-item.

### M5 — Graph mail — Tender entry task-assign notification (`tender-entries.service.ts:244`)
- **Idempotency:** **NONE.** Same as M1 — plain send. Every assignment event fires. The domain
  event (assignment happens once when created, never on updates) is the de-facto guard.
- **Retry:** none.
- **Failure posture:** GRACEFUL — try/catch, warn-log, no throw (`:250-253`).

### M6 — OTP email delivery (`otp-delivery.port.ts` + `otp-auth.provider.ts:47`)
- **Idempotency:** **NONE — INTENTIONALLY.** Each `requestCode` creates a NEW `OtpChallenge`
  row and sends a NEW code. That is the correct security posture (rate-limits and TTL live on
  the challenge row) but note that a retried HTTP `POST /auth/otp/request` will spam the
  user's inbox with N codes. No throttle at the request layer besides `AuthThrottleConfig`.
- **Retry:** none.
- **Failure posture:** GRACEFUL — the whole `try { deliver } catch { log }` block is silent
  by design (`otp-auth.provider.ts:48-55`) so a delivery failure cannot become an
  enumeration oracle. Same-shape response either way.
- **Note:** production delivery adapter is not yet wired; current default is the dev-only
  `LoggingOtpDelivery` that prints the plaintext code. NOT a prod-ready posture, but that is
  out of scope for THIS audit (it's an "adapter not built" gap, not an idempotency gap).

### M7 — Live correspondence adapter (`live-correspondence.adapter.ts`)
- **Idempotency:** N/A — throws `ServiceUnavailableException` on every call. Placeholder.
- **Follow-up:** when implemented, the phase-1/phase-2 pattern from
  `docs/architecture/drafts/idempotency-pattern.md` §"Case B" must be applied (fingerprint,
  probe Graph on stale PROCESSING, degrade).

### S1 — Graph SharePoint upload / ensureFolder (`graph-sharepoint.adapter.ts`)
- **Idempotency:** partial by nature — `ensureFolder` uses conflictBehavior semantics on
  create; upload replaces by path. But there is no `IdempotencyRecord` fingerprint, so a
  retried upload for the SAME logical document at a different derived path (e.g. a filename
  built with a `Date.now()` prefix) creates a duplicate blob. Whether upstream callers derive
  stable filenames is UNVERIFIED here.
- **Retry:** none in the adapter.
- **Failure posture:** throws — callers decide. Need a downstream audit of every S1 caller to
  confirm each one degrades vs fails the primary write.

### F1 — Forms public/kiosk submit (`PublicLinkService.publicSubmit`)
- **Idempotency:** **NONE.** No `clientSubmissionId`, no `Idempotency-Key` header, no
  fingerprint on `values`. A retried POST from a kiosk with a flaky uplink creates N
  submissions. `submissionCount` is incremented per row (`public-link.service.ts:289-291`) so
  a cap of 1 does provide de facto dedupe for single-use kiosk tokens — but a public link
  with maxSubmissions=null or >1 is exposed.
- **Retry:** none server-side.
- **Failure posture:** the write is a single Prisma transaction — either the submission +
  values land together or the row rolls back. Values are inserted one-per-row in a loop
  AFTER the parent create (`:274-286`), so a mid-loop failure leaves a partial submission.
- **HIGH SEVERITY** — public/kiosk is the exact surface the Forms v2 §4.4 idempotency
  requirement was written for. Fix: `clientSubmissionId` on the DTO + `@@unique([publicLinkId,
  clientSubmissionId])` on `FormSubmission`.

### F2 — Forms authenticated engine submit (`FormsEngineService.submitForm`)
- **Idempotency:** natural key via `submissionId` — the endpoint operates on an EXISTING draft
  row (`requireOwnedDraft`) and flips its `status` to "submitted". A retry sees status already
  = "submitted" and (per `requireOwnedDraft`) rejects with a ForbiddenException/BadRequest. So
  a retried submit is *safe* — but a retried draft-CREATE that precedes it is not audited here
  and may leave orphan drafts.
- **Retry:** none in the submit path.
- **Failure posture:** primary state flip is one Prisma update; downstream on_submit actions
  (createRecord, notifications) run AFTER the status change and are `void`-fired with
  try/catch inside `executeServerActions`. Submission survives even if the notification or
  linked-record creation fails. Matches the v2 §4.4 bar for this surface. **Already covered.**

### F3 — Forms legacy raw submit (`FormsService.submit`)
- **Idempotency:** **NONE.** Direct `formSubmission.create` with no fingerprint. Retries
  duplicate.
- **Retry:** none.
- **Failure posture:** whole write is one Prisma create with nested values — atomic per call.
- **Medium severity** — this surface is used by non-engine callers; needs to be inventoried
  before deciding whether to lock it down or deprecate.

### P1 — VendorInvoice ingest (`vendor-invoice.service.ts:156` `createInvoice`)
- **Idempotency:** COVERED by the schema. `@@unique([purchaseOrderId, invoiceNumber])` on
  `VendorInvoice` (schema.prisma:5431). A duplicate ingest raises Prisma P2002 which surfaces
  to the caller — not a graceful handle-and-return-existing, but it does prevent double-post.
  **Already covered, with a rough edge:** the P2002 becomes a 500 unless caught, so the UX on
  a legitimate double-submit is worse than it needs to be. Left as a POLISH item, not a
  severity item.
- **Retry:** N/A (single write).
- **Failure posture:** the downstream `pushVendorInvoiceBill` is fire-and-forget with .catch
  — invoice ingest is not blocked on Xero.

---

## 3. Severity-ranked fix list

**HIGH** — retry can duplicate money movement / a sent email / an imported record

1. **X2 — Xero ACCREC progress-claim invoices are not idempotent.**
   Duplicate DRAFT invoices go to the customer on any retry.
   Fix outline: add `findExistingInvoiceLog("ProgressClaim", claimId)` mirror of
   `findExistingBillLog`, or use Xero's own idempotency (invoice number `Reference` field with
   the claim number is already stable — the missing piece is our read-before-write guard).
2. **F1 — public/kiosk form submits accept unlimited retries.**
   A kiosk hitting Retry submits the same values N times.
   Fix outline: DTO `clientSubmissionId` (uuid minted by the SPA/kiosk once per user action),
   partial-unique index `[publicLinkId, clientSubmissionId]` on `FormSubmission`, return the
   existing submission on duplicate.

**MEDIUM** — duplicate downstream side-effect that is operationally awkward, legally noisy, or
undermines the "delivery is logged" bar

3. **M3 — Client quote send has no double-submit guard.**
   Two SPA clicks in one second → two identical T&C-anchored emails to the client.
   Fix outline: mint an idempotency key on the SPA per "Send" click, `QuoteEmail`
   `@@unique([quoteId, clientRequestId])`, dedupe on the server before hitting Graph.
4. **M2 — PO issue can duplicate the supplier email on a retried endpoint call.**
   Fix outline: `if (po.emailSentAt) return early;` before the send; move the transition to
   ISSUED into the same tx as the emailSentAt stamp.
5. **X1 / X6 / X7 — Xero contact create-on-first-push races.**
   The window between `createContacts` and persisting the returned id is a create-duplicate
   window.
   Fix outline: use Xero's `SummarizeErrors=true` with a lookup-by-name pre-check, OR wrap the
   create in an `IdempotencyRecord` fingerprint of `(entityType, entityId)` so a retry finds
   the earlier PROCESSING row and reads the persisted id back (Case B pattern).
6. **M1 — notification emails have no dedupe.**
   Domain-event dedupe on the calling side is the de-facto guard; it should be MADE explicit
   (`IdempotencyRecord` fingerprint of `(trigger, entityType, entityId, transitionKey)`) so a
   retried transition on ANY caller is safe by construction.
7. **F3 — legacy raw form submit path has no fingerprint.**
   Fix outline: either add `clientSubmissionId` symmetry with F1, or deprecate the surface
   with a migration plan.
8. **S1 — SharePoint uploads are only partially natural-key idempotent.**
   Follow-up audit needed: enumerate every caller and confirm each derives a stable filename
   (not `Date.now()` / random-suffix) OR wraps the upload in an `IdempotencyRecord`.
9. **P1 (POLISH, not severity)** — VendorInvoice P2002 on duplicate ingest should be caught
   and returned as a friendly 409 with the existing row's id, not a raw 500.

**LOW** — degrade-vs-crash gaps

10. **X8 retry cron has no exponential backoff.**
    A persistent Xero outage burns 3 attempts × items every 30 min. Move to
    30m → 2h → 6h backoff before the "failed" terminal state.
11. **X5 payment-status pull has no per-provider circuit breaker.**
    Every 6h it re-tries every logged bill even if Xero has been down all day.
12. **M4 — access-request admin notify.** UNVERIFIED whether the callsite currently rolls back
    the access_request row when mail fails. Confirm the "request survives; mail is logged"
    posture holds and, if not, wrap the callsite.
13. **M6 — OTP request has no per-email rate ceiling below the throttle**, so a caller within
    the auth-throttle budget can burn ~N codes into a user's inbox. Add a per-email
    per-minute cap on top of the existing throttle.
14. **M7 — LiveCorrespondenceAdapter is a stub.** When implemented it MUST follow the Case B
    pattern from `docs/architecture/drafts/idempotency-pattern.md` — not covered here beyond
    naming the future guard.

---

## 4. Already covered — evidence

- **X3 pushBill (Expense)** and **X4 pushVendorInvoiceBill (VendorInvoice)** — read guard
  `findExistingBillLog` at `xero.service.ts:447-462`; DB-backed retry queue with cap-3 and
  cross-restart replay at `:1034-1119`; callsite in expenses is `void ... .catch(log)` at
  `expenses.service.ts:253`; callsite in procurement is same shape at
  `vendor-invoice.service.ts:198` and `:278`. Matches Forms v2 §4.4 (primary write survives,
  delivery is logged and retried).
- **X5 syncPaymentStatus writeback** — `updateMany({ where: { id, totalPaid: null } })` is a
  natural-key idempotency guard against double-crediting a ProgressClaim as paid
  (`xero.service.ts:973-979`).
- **F2 authenticated engine submit** — the retry is naturally safe because the submit is a
  status flip on an existing draft row; a second call is rejected by `requireOwnedDraft`. On-
  submit side-effects (records, notifications) run AFTER the status flip and are inside a
  try/catch — submission always survives.
- **P1 VendorInvoice ingest** — `@@unique([purchaseOrderId, invoiceNumber])` at
  `schema.prisma:5431` prevents double-post at the DB layer.
- **M6 OTP** — silent-log on delivery failure at `otp-auth.provider.ts:48-55` is CORRECT (no
  enumeration oracle); TTL + attempt cap on the challenge row is the primary defence.
- **EmailService.sendNotificationEmail wrapper** — the top-level defensive catch at
  `email.service.ts:98-102` guarantees that no notification callsite can propagate a mail
  failure back to the user's primary write. Combined with `void ...` at every callsite this
  is the delivery-log-and-degrade posture the audit was measuring for. What is MISSING at
  this layer is the dedupe (M1 above), not the graceful-failure posture.
