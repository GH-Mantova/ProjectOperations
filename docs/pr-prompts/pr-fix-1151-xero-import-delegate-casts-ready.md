---
premise: git fetch -q origin feat/cfx-5-xero-file-import && git show origin/feat/cfx-5-xero-file-import:apps/api/src/modules/xero/xero-contact-import.service.ts | grep -q "create as (args:"
premise_means: PR #1151's branch still casts the Prisma `create`/`update` delegates to a loose `(args: { data: Record<string, unknown> }) => Promise<unknown>` shape. TypeScript rejects the cast with TS2352 in four places, which fails the API job and the tendering-e2e build.
fixes_pr: 1151
scope:
  - apps/api/src/modules/xero/xero-contact-import.service.ts
  - apps/api/src/modules/xero/__tests__/xero-contact-import.service.spec.ts
done_when: pnpm --filter api build && pnpm --filter api lint && pnpm --filter api test && ! grep -q "create as (args:" apps/api/src/modules/xero/xero-contact-import.service.ts && ! grep -q "update as (args:" apps/api/src/modules/xero/xero-contact-import.service.ts
size: 2
gate_allow: none
seed_only: false
escalates: true
---

# FIX #1151 - Xero contact import: stop casting the Prisma delegates

**Fix this ON PR #1151's existing branch `feat/cfx-5-xero-file-import`. Do NOT open a new PR.**
The defect is inside that PR's own diff, not on main - main is green.

## FIRST: re-verify against the CURRENT head

Errors drift. Before changing anything, read the job log for the **latest** run on
`feat/cfx-5-xero-file-import` and confirm the failure is still what is described below. If it has
changed, fix what the log actually shows and say so plainly in your output.

At the time of writing (run 32006559402):

    xero-contact-import.service.ts:609, 614, 622, 627
    TS2352: Conversion of type '<T extends ClientCreateArgs>(args: ...) => Prisma__ClientClient<...>'
            to type '(args: { data: Record<string, unknown> }) => Promise<unknown>'
            may be a mistake because neither type sufficiently overlaps with the other.

    Found 4 error(s).

**One defect, four occurrences, three red checks.** The API job and `tendering-e2e` both die on the
same four errors - e2e never reaches a browser. The fourth red check is **CP-26 (`do-not-merge`) and
it is SUPPOSED to fail**: #1151 came from an `escalates: true` prompt. Do NOT remove that label and
do NOT try to make CP-26 pass. Only Marco removes it.

## The actual code

Four sites follow this shape:

    await (tx.client.create as (args: { data: Record<string, unknown> }) => Promise<unknown>)({
      data: finalData
    });

The cast exists because `finalData` is assembled dynamically from the CSV column mapping, so it is a
`Record<string, unknown>` and does not fit `Prisma.ClientCreateInput`. The author loosened the
**delegate** to accept the loose data. TypeScript refuses, correctly.

## Why the one-line "fix" is not acceptable here

`as unknown as (...)` would compile. Do NOT do that.

The cast is hiding a real problem, not just a type problem: **whatever keys the CSV mapper produces
are spread straight into a `create`/`update` on `client` and `subcontractorSupplier`.** Nothing
constrains which columns an uploaded file can write. Silencing the compiler keeps that. This is the
Xero import - a wrong write here is a finance problem.

## What to build

1. **Remove all four delegate casts.** Call `tx.client.create`, `tx.client.update`,
   `tx.subcontractorSupplier.create` and `tx.subcontractorSupplier.update` with their real types.

2. **Constrain `finalData` before it reaches Prisma.** Introduce an explicit allow-list of writable
   fields per entity - one for `Client`, one for `SubcontractorSupplier` - and build the write
   payload by picking only those keys. A key that is not on the list must be dropped and counted,
   not written.

3. **Narrow once, at the boundary.** After the allow-list filter, a single assertion to the Prisma
   input type is acceptable, because the shape is now known. Four scattered assertions on the
   delegates are not.

4. **Report what was dropped.** If the mapper offered keys that are not writable, surface the count
   and the key names in the existing confirm-step result rather than discarding them silently. A
   silent drop is how an import appears to succeed while doing nothing.

Keep the dry-run/confirm flow, the `previewCache` behaviour, the bank-detail overwrite guard and the
`inserted / updated / skipped` counters exactly as they are. This is a type-safety and write-safety
fix, not a redesign.

## Tests

In `__tests__/xero-contact-import.service.spec.ts`:

- A payload carrying a field that is NOT on the allow-list does not reach `create`/`update`, and the
  result reports it as dropped.
- A normal client row still inserts, and a normal update still updates, with the same counters.
- The existing bank-detail overwrite guard still holds - do not weaken that assertion.

Do not weaken an existing assertion to go green. If a test fails, fix the code, not the test.

## Verification

    pnpm --filter api build
    pnpm --filter api lint
    pnpm --filter api test

The build must report zero TypeScript errors. Then confirm on the PR that the **API** and
**tendering-e2e** checks have gone green. **CP-26 will still be red - that is correct and expected.**

## Escalation

`escalates: true`. #1151 is held for Marco by its `do-not-merge` label and stays held. Pushing this
fix does not release it - Marco removes the label when he is satisfied. Do not merge.

You have STANDING AUTHORITY to finish the work, commit and push to the EXISTING branch. Do not open
a new PR. Do not merge.
