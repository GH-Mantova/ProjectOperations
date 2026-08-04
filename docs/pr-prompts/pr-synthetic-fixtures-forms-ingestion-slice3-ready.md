---
premise: '! test -d apps/api/testing/synthetic-fixtures/forms'
premise_means: The forms-ingestion synthetic-fixtures directory does not exist yet -- slice 3 has not shipped.
scope:
  - apps/api/testing/synthetic-fixtures/**
done_when: pnpm --filter @project-ops/api test synthetic-forms && test -f apps/api/testing/synthetic-fixtures/forms/synthetic-forms.ts
size: 3
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/api/testing/synthetic-fixtures/xero/synthetic-xero.ts
---

# Synthetic fixtures slice 3 -- native forms-ingestion surface + idempotency spec

Follow-on to the Xero synthetic-fixtures slice (slice 1, already on `main`). The idempotency audit
found NO live Jotform code; the honest in-repo analogue is the **native forms-ingestion** submit
surface. Model those submit surfaces as an in-memory synthetic ingest fixture, reusing the slice-1
reference, plus a green jest spec. Test-only -- no production forms code, no migration.

Read first, and MIRROR its shape exactly:

- `apps/api/testing/synthetic-fixtures/xero/synthetic-xero.ts` -- the slice-1 in-memory provider and
  its fault-injection / probe / call-count pattern. Your forms ingest fixture follows the same shape.
- `apps/api/testing/synthetic-fixtures/idempotency-reference.ts` -- REUSE this. Do NOT copy or
  re-implement it. Import `runCaseA`, `runCaseB`, `reapCaseB`, `withDegrade`, `IdempotencyStore`,
  `DeliveryAuditEntry` from `../idempotency-reference`.
- `apps/api/testing/synthetic-fixtures/README.md` -- see "Roadmap -- later slices -> Native forms
  ingestion synthetic driver". Update the README to move it from Roadmap into a "Slice 3" section
  mirroring the "Slice 1" section.
- `docs/qa/integration-idempotency-audit.md` -- the F-rows this models (F1 public/kiosk submit and
  F3 legacy raw submit -- both have NO idempotency; F2 engine submit is already covered, do not
  re-model it). Read it to get the surface names and the `clientSubmissionId`-replay and
  partial-write posture right.

## What to build

1. `apps/api/testing/synthetic-fixtures/forms/synthetic-forms.ts`
   - An in-memory `SyntheticFormIngest` modelling the F1 (public/kiosk submit) and F3 (legacy raw
     submit) surfaces. A submit records a stored submission keyed by a caller-supplied
     `clientSubmissionId` where present; a submit with NO `clientSubmissionId` (the F1/F3 gap) lands
     a duplicate on replay -- that non-dedupe is the whole reason the guard is needed, exactly like
     slice-1's `createInvoice`.
   - Deterministic fault injection matching slice 1: `failNextCall({afterCommit})`, `openCircuit()`
     / `closeCircuit()`, a `probe(clientSubmissionId)` the Case B reaper can call ("did the
     submission with this id land?"), `getCallCount()`, and a count helper
     (e.g. `countSubmissionsWith(clientSubmissionId)`).
   - Reuse slice-1's error pattern for a `SyntheticFormsError` with
     `"circuit-open" | "injected-fault"` codes and the same private `execute(commit)` before/after
     -commit fault gate.

2. `apps/api/testing/synthetic-fixtures/forms/synthetic-forms.spec.ts`
   - A jest spec (ts-jest picks up `*.spec.ts` automatically -- no config change) exercising:
     - **F1 duplicate submit (clientSubmissionId replay)**: two submits sharing a
       `clientSubmissionId`, guarded by `runCaseA`/`runCaseB`, yield exactly ONE stored submission
       (assert count == 1, second returns the stored payload); the SAME two submits WITHOUT the
       guard land TWO (assert count == 2) -- demonstrating the F1/F3 gap.
     - **Partial-write posture (Case B PROCESSING + probe)**: `failNextCall({afterCommit:true})`
       leaves a PROCESSING record; `reapCaseB` with the provider `probe` resolves it by asking the
       source whether the submission landed -- never by assuming, never by blind re-fire.
     - **Graceful degrade**: with the circuit open, `withDegrade` writes a delivery-audit entry and
       does NOT throw -- the primary action survives (Forms v2 section 4.4 bar).

3. Update `apps/api/testing/synthetic-fixtures/README.md` -- add a "Slice 3 -- native forms
   ingestion, in-memory" section (mirroring the Slice 1 section) and remove it from the Roadmap list.

## Do NOT

- Do NOT add any dependency. Stay pure in-memory TypeScript (msw v2 is ESM-only and breaks this
  ts-jest run; neither msw nor nock is installed).
- Do NOT import from `apps/api/src/**`. The fixture tree is self-contained by design.
- Do NOT touch `apps/api/src/**`, `schema.prisma`, any migration, or seed data. Test-only.
- Do NOT model F2 engine submit -- the audit records it as already covered.
- Do NOT re-implement the idempotency reference -- import it from `../idempotency-reference`.
- Do NOT add HTTP/wire-level mocking -- that is a separately-gated later slice.

## Note in the PR body

State plainly that you chose the **in-memory (zero-dependency)** approach, matching slice 1 -- not a
wire mock -- and why (ts-jest has no `transformIgnorePatterns`; msw v2 ESM would break the run).

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED. It does not mean "wait for
approval before starting", and it does not mean "do the work then ask permission to push".
There is no human in this run. Finishing the work and then asking for permission is
indistinguishable from failing -- the work is discarded either way.

## Guardrails

- One attempt. Never exit silently -- if the work is already done say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval -- there is no human in a headless run.
- Read the job log before diagnosing any CI failure.
- Before you finish, ask: is there a PR number in my output? If yes, done. If the work was already
  on `main`, say `NO-OP: <reason>`.
