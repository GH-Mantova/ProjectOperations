---
premise: '! grep -q "P2002" apps/api/src/modules/client-quotes/client-quotes.service.ts'
premise_means: >-
  A second client cannot be quoted off a tender, and the failure is a bare 500. ClientQuote.quoteRef
  is globally @unique (schema.prisma:4654) but minted per client - revision is counted over
  tenderId + clientId (client-quotes.service.ts:163-168) and the ref is built at :169-170 as
  tenderNumber for revision 1, tenderNumber-R{n} thereafter. Client B's first quote is revision 1,
  so its ref is byte-identical to client A's and Prisma raises P2002 at the create on :181-189.
  Nothing in the module catches it, so it surfaces as HTTP 500 "An unexpected error occurred."
scope:
  - apps/api/src/modules/client-quotes/client-quotes.service.ts
  - apps/api/src/modules/client-quotes/__tests__/quote-ref-collision.spec.ts
  - docs/pr-prompts/needs-marco/qpdf-3-quote-ref-format-decision.md
done_when: >-
  pnpm build && pnpm lint && grep -q "P2002"
  apps/api/src/modules/client-quotes/client-quotes.service.ts && grep -q "ConflictException"
  apps/api/src/modules/client-quotes/client-quotes.service.ts && test -f
  docs/pr-prompts/needs-marco/qpdf-3-quote-ref-format-decision.md
size: 3
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: client-quotes
design_ref: https://claude.ai/code/artifact/3020638f-054c-4e77-994e-1b6a3effff9b
---

# QPDF-3 - the quote-reference collision: stop the 500, and hand the format question to Marco

**Grounded against `origin/main` = `e2804112`, every citation re-checked on disk 2026-09-10.**
Independent of the `quote-pdf-correctness` chain (QPDF-1 / QPDF-2) and of QPDF-4. It shares no file
with any of them. It can run at any point.

## The three documents this slice is built from

| What | Where |
|---|---|
| **The spec - the agreed decision, not a proposal** | https://claude.ai/code/artifact/3020638f-054c-4e77-994e-1b6a3effff9b |
| PDF as-built - what the document renders today | https://claude.ai/code/artifact/12b3266c-8148-4648-a782-90ec52dbfa76 |
| Screen as-built - the panel that 500s | https://claude.ai/code/artifact/757617c5-14db-439d-9a00-9576d4c26c42 |

## The defect

`client-quotes.service.ts:163-168` counts the next revision over `tenderId + clientId`:

* Client A, first quote → `revision = 1` → `quoteRef = tender.tenderNumber` (`:169-170`).
* Client B, first quote → `revision = 1` → `quoteRef = tender.tenderNumber`. **The same string.**

`ClientQuote.quoteRef` is `@unique` **globally** (`schema.prisma:4654`), so the `create` at
`:181-189` raises Prisma `P2002`. The composite `@@unique([tenderId, clientId, revision])` that
would have made this legal already exists at `schema.prisma:4690` - it is simply not the constraint
that fires first.

The per-client quotes panel exists **specifically** to quote several clients off one tender
(`ClientQuotesPanel.tsx`, mounted first and always by `QuoteTab.tsx:66-70`). It cannot.

### Correction to the spec, verified 2026-09-10

The spec says there is "no global exception filter (`useGlobalFilters` absent from `main.ts`)".
**That is stale.** `apps/api/src/bootstrap/create-app.ts:28` registers
`app.useGlobalFilters(new ApiExceptionFilter())`. The filter is `@Catch()`-all
(`apps/api/src/common/filters/api-exception.filter.ts:24-45`) but it only unwraps `HttpException`;
a `PrismaClientKnownRequestError` is not one, so it falls through to the default branch at `:84-90`
and the caller receives:

```
500  { "error": "Internal Server Error", "message": "An unexpected error occurred." }
```

The **outcome** the spec describes is exactly right - an unusable 500. The **reason** has moved. Do
not go looking for a missing global filter; there is one, and it is behaving correctly. The fix
belongs at the service boundary.

## ⛔ WHAT THIS SLICE DELIBERATELY DOES NOT DO

**The quote-reference format is a product decision Marco has not made, and this prompt will not
guess at it.** There are exactly two shapes, and they are not interchangeable:

| Shape | What it costs | What it leaves behind |
|---|---|---|
| **Scope the DB constraint.** Remove the global `@unique` on `quoteRef` and rely on the composite `@@unique([tenderId, clientId, revision])` already at `schema.prisma:4690`. | A migration. `apps/api/prisma/**` scope, a forced `escalates: true`, a `rollback_strategy`, and a Gate-A declaration. | The reference format is unchanged - **and two different clients hold two different documents, at two different prices, bearing the same reference string.** Ambiguous to the clients, not merely to the database. |
| **Make the ref unique by construction.** Add a per-client discriminator to the minted ref. | Service-only, no migration. | The global constraint survives and the reference actually identifies a document - **but it changes a client-visible reference format**, and revision 2 of an existing quote would carry a differently-shaped ref to the revision 1 already sitting in a client's inbox. |

**The trade-off, stated once:** shape 1 is cheap in code and expensive on paper; shape 2 is cheap on
paper and changes something clients have already seen. Nobody in a headless run is entitled to pick
between those. **This slice implements neither.**

## What to build

### 1. Translate `P2002` into a 409 at the service boundary

Follow the pattern the repo already has. `jobs.service.ts:261-275` defines
`isJobNumberUniqueViolation(err)` - it checks `err instanceof Prisma.PrismaClientKnownRequestError`,
then `err.code !== "P2002"`, then reads `err.meta?.target`, handling **both** the string and the
string-array encodings Prisma uses across providers. `jobs.service.ts:516-520` catches the create
and re-throws a `ConflictException`.

Mirror it: a `isQuoteRefUniqueViolation(err)` helper matching on the `quote_ref` column, wrapped
around the `clientQuote.create` at `client-quotes.service.ts:181-189`.

### 2. The 409 message must explain the real cause

A generic "conflict" is barely better than the 500. The message must name what actually happened and
what the operator can do about it, because **the feature is still blocked** - see below. Something an
estimator can act on: that this tender already has a quote carrying this reference for another
client, that reference numbers are currently unique across the whole system, and that a second
client cannot be quoted on this tender until the reference format is settled.

Include the colliding `quoteRef` in the message. Do not include client names or ids of records the
caller may not be entitled to see.

### 3. A spec that proves both halves

`apps/api/src/modules/client-quotes/__tests__/quote-ref-collision.spec.ts` (new):

* A `create` that raises a `P2002` on `quote_ref` produces a `ConflictException`, not a leaked
  Prisma error. Assert on the status and on the message text.
* `meta.target` in **both** shapes - `"quote_ref"` and `["quote_ref"]` - is recognised.
* A `P2002` on some **other** column is **not** swallowed into a 409.
* A non-Prisma error is re-thrown untouched.

### 4. Write the decision memo to `needs-marco/`

Create `docs/pr-prompts/needs-marco/qpdf-3-quote-ref-format-decision.md`. That folder is the only
real stop in this pipeline - location is the contract, front-matter is a note - so the open question
belongs there and nowhere else.

The memo states, in Marco's own decision vocabulary:

* The one-line question: **do two clients get to hold documents bearing the same reference?**
* Both shapes from the table above, with their true costs, and the file:line evidence
  (`schema.prisma:4654`, `:4690`; `client-quotes.service.ts:163-170`).
* What is now true after this slice: the 500 is gone, the failure is legible, and **the feature is
  still blocked** - a second client still cannot be quoted.
* That the answer also settles what the "Quote No." field prints on the document, which QPDF-1 and
  QPDF-2 both render.
* That whichever shape is chosen becomes a follow-up slice: shape 1 is migration-scoped and escalates
  by rule; shape 2 is service-only and escalates on judgement because it alters a client-visible
  reference.

**Do not recommend one in the memo. State both and stop.**

## Be honest about what did not get fixed

The spec's headline for QPDF-3 is *"a second client can be quoted"*. **After this slice, it still
cannot.** Say so plainly in the PR body and in the memo. A PR that claims to have fixed the
collision because the error code changed is worse than one that says "I converted an unreadable
crash into a readable refusal and escalated the decision", which is what this is.

## Verification - put these in the PR body

- [ ] `pnpm build` and `pnpm lint` green; API test suite green with before/after counts.
- [ ] The new spec file green; quote each of the four assertions.
- [ ] Quote the exact 409 message an estimator will see.
- [ ] Confirm the memo exists at `docs/pr-prompts/needs-marco/qpdf-3-quote-ref-format-decision.md`
      and that it names both shapes without recommending either.
- [ ] State plainly that a second client still cannot be quoted, and why.
- [ ] Confirm `apps/api/prisma/**` is absent from the diff.

## Do NOT

- Do **NOT** change `ClientQuote.quoteRef`'s uniqueness in `schema.prisma`, and do **NOT** add a
  migration. That is the decision this slice is escalating.
- Do **NOT** change how the ref is minted at `client-quotes.service.ts:169-170`. Not a suffix, not a
  client code, not a sequence. The format is Marco's call.
- Do **NOT** work around the collision by silently bumping `revision` past an existing ref. That
  invents a revision number that means nothing and it is a format change wearing a disguise.
- Do **NOT** add a global Prisma exception filter. `ApiExceptionFilter` already exists and is
  correct; widening it to map every `P2002` to a 409 would give the wrong answer for constraints
  where a conflict is not the right story.
- Do **NOT** touch the PDF builders, the four duplicated PDF stylesheets, the visual design of the
  quote document, or the rates catalogue model. All four are out of scope for every QPDF slice.
- Do **NOT** touch `/sot/`, Azure/Entra/SharePoint, `apps/web/**`, or any file outside `scope`.

Title the PR `fix(client-quotes): translate the quoteRef unique violation into a 409`.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

The open product decision does **not** make this prompt blocked. Writing the memo to
`needs-marco/` **is** the escalation, and it is part of the work. Finish it and open the PR.

## Guardrails

- One attempt. If the premise is already satisfied on main, say `NO-OP: premise already satisfied`
  and exit.
- Never exit silently. Say `NO-OP: <reason>` loudly if you cannot finish - a silent exit is read as
  success by the watcher, which is the worst outcome.
- **Never ask a question or "stand by" for approval.** There is no human in this run. A dismissed or
  unanswered question is the absence of a human, not a stop signal: proceed on best judgement and
  record the assumption in the PR body.
- Read the CI job log (`gh run view <run-id> --log`) before diagnosing any failure.
