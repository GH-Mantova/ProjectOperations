---
premise: '! test -f apps/api/testing/synthetic-fixtures/xero/synthetic-xero.ts'
premise_means: The synthetic-fixtures test area and its Xero synthetic provider do not exist yet — slice 1 of the synthetic integration fixtures has not been built.
scope:
  - apps/api/testing/synthetic-fixtures/**
done_when: pnpm build && pnpm lint && cd apps/api && pnpm test -- synthetic-xero
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# Synthetic integration fixtures — SLICE 1: Xero synthetic provider + idempotency pattern reference

This is the FIRST, deliberately de-risked slice of the `synthetic-integration-fixtures` backlog
item. Its blocker cleared when the idempotency audit shipped (`docs/qa/integration-idempotency-audit.md`
on main). Read that audit and `docs/architecture/drafts/idempotency-pattern.md` (Case A / Case B /
"Degrade, never crash") before starting — they define exactly what these fixtures must model.

Integration code cannot be CI-tested against real tenants (Azure/tenant hard stop; no sandbox
accounts in CI), so retry / idempotency / degrade paths currently ship unexercised. This slice
stands up a reusable synthetic-fixtures area and proves the house idempotency pattern end-to-end
against ONE surface (Xero), with a green CI spec. The Graph-mail and native-forms surfaces, and
HTTP-level wire mocking (msw/nock), are SEPARATE follow-up slices — do not attempt them here.

## Why in-memory, and why no new dependency (read this — it is the whole design)

The API test runner is `ts-jest` with **no `transformIgnorePatterns`** (see `apps/api/jest.config.ts`),
so an ESM-only wire-mock library (msw v2) would break the jest run out of the box, and neither `msw`
nor `nock` is actually installed (the lockfile only references `msw` as a transitive *peer* dep). A
headless one-attempt run must not be spent fighting ESM-in-jest config. So slice 1 uses a plain
in-memory synthetic provider — pure TypeScript, zero new dependencies, compiled by the existing
ts-jest — and is near-certain to land green. Faithful HTTP-level mocking is a later slice, once the
per-integration HTTP client layer is inventoried and a jest-compatible tool is chosen.

## What to build (4 files, all NEW, under `apps/api/testing/synthetic-fixtures/`)

1. `apps/api/testing/synthetic-fixtures/README.md` — explains the area: purpose (exercise
   idempotency/retry/degrade paths from `idempotency-pattern.md` against synthetic providers because
   real tenants are off-limits in CI), the slice-1 scope (Xero, in-memory), and the roadmap
   (HTTP-level mocks + Graph-mail + native-forms surfaces are follow-up slices, gated on this landing).

2. `apps/api/testing/synthetic-fixtures/xero/synthetic-xero.ts` — an in-memory synthetic Xero
   provider modelling the surfaces the audit's X-rows touch: `createContact`, `createInvoice` (ACCREC,
   keyed by a `reference` string), `createBill` (ACCPAY). It records created entities keyed by their
   natural reference so a caller can detect duplicates, and exposes deterministic fault injection:
   `failNextCall()` (throw once, mid-call), `openCircuit()` / `closeCircuit()` (reject while open),
   and a `probe(reference)` method that answers "did the entity with this reference land?" for the
   Case B reaper. No real HTTP, no timers.

3. `apps/api/testing/synthetic-fixtures/idempotency-reference.ts` — a small, reusable reference
   implementation of the three flows from `idempotency-pattern.md`, backed by an in-memory
   `IdempotencyRecord` store (Map): Case A (create-key-first in one logical tx, replay stored payload
   on duplicate, key vanishes on failure), Case B (phase-1 committed PROCESSING row → external call →
   phase-2 COMPLETED; a mid-call failure leaves PROCESSING and the reaper resolves it by PROBING the
   provider, never by assumption — [[LL-39]]), and a `withDegrade` wrapper (circuit-open ⇒ log a
   delivery-audit entry and return, never throw, so the primary action survives).

4. `apps/api/testing/synthetic-fixtures/xero/synthetic-xero.spec.ts` — a jest spec (`*.spec.ts`, so
   the existing api jest `testRegex` runs it automatically) that exercises, against the synthetic Xero
   provider + reference helpers: (A) a retried call with the same key replays the stored result and
   creates exactly ONE Xero entity; (B) a mid-call failure leaves a PROCESSING record, and the reaper
   probes the provider and completes it iff the entity actually landed — asserting NO blind
   re-fire; (D) circuit-open degrades — the primary action returns success, a delivery-audit row is
   written, and nothing throws. Assert on entity counts and record states, not on log text.

## Do NOT
- Do NOT add `msw`, `nock`, or ANY new dependency, and do NOT edit `apps/api/package.json` or
  `pnpm-lock.yaml`. Slice 1 is dependency-free (keeps `gate_allow: none` honest and CI green).
- Do NOT touch any production code under `apps/api/src/modules/**` — this is test-fixture code only.
  Do NOT import the real `xero.service.ts`; the reference implementation is self-contained.
- Do NOT add a Prisma model, migration, or schema change. The `IdempotencyRecord` store here is an
  in-memory test double, NOT the eventual production table.
- Do NOT build the Graph-mail or native-forms fixtures, and do NOT add wire/HTTP mocking — those are
  separate follow-up slices.
- Do NOT touch `sot/**` (CP-24 hard-fails any PR mixing code and sot/).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

This PR is `escalates: false` (test-only, no prod code, no deps, no data): open it; the board may
merge it like any other slice.

## Guardrails
- One attempt. Never exit silently -- if `apps/api/testing/synthetic-fixtures/xero/synthetic-xero.ts`
  is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the CI job log before diagnosing any failure -- never from the diff.
- `pnpm build` + `pnpm lint` must pass, and the new `synthetic-xero` spec must be green, before you
  open the PR.
