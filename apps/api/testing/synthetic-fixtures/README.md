# Synthetic integration fixtures

Test fixtures that let CI exercise the retry / idempotency / degrade paths from
`docs/architecture/drafts/idempotency-pattern.md` against **synthetic** providers.

## Why this exists

The audit in `docs/qa/integration-idempotency-audit.md` inventoried every outbound
integration in `apps/api/src` (Xero, Graph mail, forms ingestion, SharePoint) and
graded each against the Forms v2 §4.4 bar (submission survives, delivery is
logged, primary action never fails on a downstream hiccup). The fixes rely on
the three-part house pattern: Case A (single-tx create-key-first), Case B
(phase-1 PROCESSING → external call → phase-2 COMPLETED with a probing reaper),
and "degrade, never crash" for outbound side-effects.

None of that can be tested against real tenants — Azure tenant hard-stop, no
Xero sandbox in CI. So these fixtures stand in for the external world: they
model the surfaces the audit's call sites touch, expose deterministic fault
injection (throw once, open a circuit, probe for landed entities), and let a
jest spec assert on entity counts and record states.

## Slice 1 (this slice) — Xero, in-memory

Contains:

- `xero/synthetic-xero.ts` — in-memory Xero provider modelling `createContact`,
  `createInvoice` (ACCREC, keyed by `reference`), `createBill` (ACCPAY, keyed
  by `reference`). Exposes `failNextCall()`, `openCircuit()` / `closeCircuit()`,
  and `probe(reference)` for the Case B reaper.
- `idempotency-reference.ts` — small reusable reference implementation of the
  three flows (Case A, Case B, `withDegrade`) backed by an in-memory
  `IdempotencyRecord` store. **This is a test double, NOT the eventual
  production table.**
- `xero/synthetic-xero.spec.ts` — jest spec that exercises Case A replay,
  Case B PROCESSING + probe, and degrade-on-circuit-open against the synthetic
  provider.

### Deliberate design choices

- **In-memory, zero new dependencies.** The api test runner is `ts-jest`
  with no `transformIgnorePatterns`; the ESM-only wire-mock libraries (msw v2)
  break the jest run out of the box, and neither `msw` nor `nock` is installed.
  A slice that had to fight ESM-in-jest config would land red. This slice ships
  pure TypeScript that the existing `ts-jest` compiles.
- **No production imports.** Nothing here imports from `apps/api/src/**`. The
  reference implementation is self-contained so this can never become a
  parallel copy of `xero.service.ts` that has to be kept in sync.
- **Not linted.** `apps/api/eslint.config.js` only globs `src/**/*.ts`; this
  tree is intentionally outside the lint scope so test-only patterns
  (unused-import for illustrative types, `any` for fault-injection callbacks,
  etc.) don't need suppression comments.

## Slice 2 — Graph mail, in-memory

Contains:

- `graph-mail/synthetic-graph-mail.ts` — in-memory Graph-mail provider
  modelling a `sendMail`-style surface, keyed by a caller-supplied
  `reference` (e.g. `notify:<eventId>`, `po-issued:<purchaseOrderId>`,
  `quote-send:<quoteId>`, `access-request-notify:<id>`,
  `tender-assign:<id>`). Exposes `failNextCall()`, `openCircuit()` /
  `closeCircuit()`, and `probe(reference)` for the Case B reaper. Like
  slice 1, the provider does NOT dedupe on its own — a second send with
  the same reference lands a second message (that non-dedupe is the whole
  point of the audit's M1 finding).
- `graph-mail/synthetic-graph-mail.spec.ts` — jest spec covering the M-row
  shapes: (M1) raw double-send vs Case A guarded send, (M2/M3) Case B
  PROCESSING + probing reaper with no wire re-fire, and (M4) `withDegrade`
  on circuit-open leaving the primary action intact.

Reuses `../idempotency-reference.ts` unchanged — no duplication.

Same deliberate design choices as slice 1 apply: pure in-memory
TypeScript (no msw/nock — ESM breaks the ts-jest run), no imports from
`apps/api/src/**`, not linted.

## Roadmap — later slices

These are separately-gated and will land as their own PRs:

- **HTTP-level wire mocks.** Replace the in-memory provider with a
  jest-compatible HTTP fake (msw-node with a jest-side ESM workaround, or
  nock) so the real `apps/api/src/modules/xero/xero.service.ts` and the
  Graph-mail callsites can be tested end-to-end. Requires an inventory of
  the per-integration HTTP client layer first.
- **Native forms ingestion synthetic driver.** For the F-rows (public/kiosk
  submit, engine submit, legacy submit) — a synthetic form-source that can
  replay retries with and without `clientSubmissionId`.
