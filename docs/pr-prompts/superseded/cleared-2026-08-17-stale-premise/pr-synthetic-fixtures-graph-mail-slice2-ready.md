---
premise: '! test -d apps/api/testing/synthetic-fixtures/graph-mail'
premise_means: The graph-mail synthetic-fixtures directory does not exist yet -- slice 2 has not shipped.
scope:
  - apps/api/testing/synthetic-fixtures/**
done_when: pnpm --filter @project-ops/api test synthetic-graph-mail && test -f apps/api/testing/synthetic-fixtures/graph-mail/synthetic-graph-mail.ts
size: 3
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/api/testing/synthetic-fixtures/xero/synthetic-xero.ts
---

# Synthetic fixtures slice 2 -- Graph-mail surface + idempotency/degrade spec

Follow-on to the Xero synthetic-fixtures slice (slice 1, already on `main`). Model the **Graph-mail
send surface** the idempotency audit's M-rows touch as an in-memory synthetic provider, reusing the
Case A / Case B / degrade reference from slice 1, plus a green jest spec.

Read first, and MIRROR its shape exactly:

- `apps/api/testing/synthetic-fixtures/xero/synthetic-xero.ts` -- the slice-1 in-memory provider
  (fault injection: `failNextCall({afterCommit})`, `openCircuit()`/`closeCircuit()`, `probe(...)`,
  `getCallCount()`). Your graph-mail provider follows this same pattern.
- `apps/api/testing/synthetic-fixtures/idempotency-reference.ts` -- REUSE this. Do NOT copy or
  re-implement it. Import `runCaseA`, `runCaseB`, `reapCaseB`, `withDegrade`, `IdempotencyStore`,
  `DeliveryAuditEntry` from `../idempotency-reference`.
- `apps/api/testing/synthetic-fixtures/README.md` -- see "Roadmap -- later slices -> Graph mail
  synthetic provider". Update the README to move Graph-mail from Roadmap into a "Slice 2" section
  mirroring the "Slice 1" section.
- `docs/qa/integration-idempotency-audit.md` -- the M-rows this models (M1 sendNotificationEmail,
  M2 PO email, M3 quote send, M4 access-request, M5 tender task-assign). Read it to get the surface
  names and the "no-dedupe M1 double-send" and graceful-degrade posture right.

## What to build

1. `apps/api/testing/synthetic-fixtures/graph-mail/synthetic-graph-mail.ts`
   - An in-memory `SyntheticGraphMailProvider` modelling a Graph `sendMail`-style surface. It records
     each accepted send (by a natural key -- e.g. a `messageReference` / dedupe key the caller would
     pass) so a caller can detect duplicates, and -- critically -- it **does NOT dedupe on its own**
     (a second send with the same reference lands a SECOND message), exactly like slice-1's
     `createInvoice`. That non-dedupe is the whole reason the caller needs the idempotency guard.
   - Deterministic fault injection matching slice 1: `failNextCall({afterCommit})`, `openCircuit()`
     / `closeCircuit()`, a `probe(reference)` the Case B reaper can call ("did the message with this
     reference land?"), `getCallCount()`, and a count helper (e.g. `countSendsWithReference(ref)`).
   - Reuse slice-1's `SyntheticXeroError` pattern for a `SyntheticGraphMailError` with
     `"circuit-open" | "injected-fault"` codes, and the same private `execute(commit)` before/after
     -commit fault gate.

2. `apps/api/testing/synthetic-fixtures/graph-mail/synthetic-graph-mail.spec.ts`
   - A jest spec (ts-jest picks up `*.spec.ts` automatically -- no config change) exercising:
     - **M1 no-dedupe double-send**: without an idempotency guard, two identical sends produce TWO
       messages (assert the provider count == 2); WITH `runCaseA`/`runCaseB` around it, a replay
       produces exactly ONE (assert count == 1 and the second call returns the stored payload).
     - **Case B PROCESSING + probe**: `failNextCall({afterCommit:true})` leaves a PROCESSING record;
       `reapCaseB` with the provider `probe` completes it WITHOUT re-firing the send (assert call
       count did not double-fire the wire).
     - **Graceful degrade**: with the circuit open, `withDegrade` writes a delivery-audit entry and
       does NOT throw -- the primary action survives (Forms v2 section 4.4 bar).

3. Update `apps/api/testing/synthetic-fixtures/README.md` -- add a "Slice 2 -- Graph mail, in-memory"
   section (mirroring the Slice 1 section) and remove Graph mail from the Roadmap list.

## Do NOT

- Do NOT add any dependency. Stay pure in-memory TypeScript (msw v2 is ESM-only and breaks this
  ts-jest run; neither msw nor nock is installed). This is why slice 1 is in-memory -- keep it that way.
- Do NOT import from `apps/api/src/**`. The fixture tree is self-contained by design (README
  "No production imports").
- Do NOT touch `apps/api/src/**`, `schema.prisma`, any migration, or seed data. Test-only.
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
