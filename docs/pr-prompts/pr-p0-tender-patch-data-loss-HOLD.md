---
premise: 'grep -q "await tx.tenderNote.deleteMany({ where: { tenderId: id } });" apps/api/src/modules/tendering/tendering.service.ts'
premise_means: The unconditional deleteMany block is still in update() - the data-loss bug is live.
scope:
  - apps/api/src/modules/tendering/tendering.service.ts
  - apps/api/src/modules/tendering/__tests__/tendering.service.spec.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/api test
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# P0 — `PATCH /tenders/:id` silently DESTROYS notes, clarifications, pricing snapshots, follow-ups and outcomes

**This is live data loss in production. It is the highest-priority item in the backlog.**

## STANDING AUTHORITY - read this first

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run. Finishing the work and then asking for permission is
**indistinguishable from failing** - the work is discarded either way.
**Your run is complete only when your output contains a PR NUMBER** - or an honest `NO-OP: <reason>`.

## The bug — verified on `main`, not inferred

`apps/api/src/modules/tendering/tendering.controller.ts:332`

```ts
@Patch(":id")
update(@Param("id") id: string, @Body() dto: UpsertTenderDto, ...)
```

`apps/api/src/modules/tendering/dto/tender.dto.ts` — **every child array is OPTIONAL**:

```ts
tenderClients?: TenderClientInputDto[];        // :138
tenderNotes?: TenderNoteInputDto[];            // :144
clarifications?: TenderClarificationInputDto[];// :150
pricingSnapshots?: TenderPricingSnapshotInputDto[]; // :156
followUps?: TenderFollowUpInputDto[];          // :162
outcomes?: TenderOutcomeInputDto[];            // :168
```

`apps/api/src/modules/tendering/tendering.service.ts:1014-1025` — inside the transaction, **all six
are deleted UNCONDITIONALLY, on every single call**:

```ts
await this.prisma.$transaction(async (tx) => {
  await tx.tender.update({ where: { id }, data: this.toTenderUpdateInput(dto) });

  await tx.tenderClient.deleteMany({ where: { tenderId: id } });          // 1020
  await tx.tenderNote.deleteMany({ where: { tenderId: id } });            // 1021
  await tx.tenderClarification.deleteMany({ where: { tenderId: id } });   // 1022
  await tx.tenderPricingSnapshot.deleteMany({ where: { tenderId: id } }); // 1023
  await tx.tenderFollowUp.deleteMany({ where: { tenderId: id } });        // 1024
  await tx.tenderOutcome.deleteMany({ where: { tenderId: id } });         // 1025
```

…and each is then re-created **only if the payload happens to carry it** (`if (dto.tenderClients?.length)`,
`if (dto.pricingSnapshots?.length)`, …).

**The consequence:** a `PATCH` that sends only `{ tenderClients: [...] }` — exactly what a partial
update is *supposed* to look like — **permanently deletes every note, clarification, pricing snapshot,
follow-up and outcome on that tender.**

The HTTP verb promises *partial*. The implementation performs *full replace*. **That gap is the bug.**

## The fix

**Only touch a child collection if the caller explicitly sent that key.**

The distinction that matters — and do not collapse it:

| payload | meaning | behaviour |
|---|---|---|
| key **absent** (`undefined`) | "I am not changing this" | **leave the rows alone** |
| key **present but `[]`** | "clear this collection" | delete the rows |
| key present with items | "replace with these" | delete, then re-create |

So the guard is `dto.X !== undefined` — **NOT** `dto.X?.length`. `?.length` cannot tell *absent* from
*explicitly emptied*, and conflating them is how the bug got written in the first place.

Apply it to all six, each independently:

```ts
if (dto.tenderClients !== undefined) {
  await tx.tenderClient.deleteMany({ where: { tenderId: id } });
  if (dto.tenderClients.length) {
    await tx.tenderClient.createMany({ /* unchanged */ });
  }
}
```

…and the same shape for `tenderNotes`, `clarifications`, `pricingSnapshots`, `followUps`, `outcomes`.

**Do NOT change the re-create logic itself.** Only the delete must become conditional. Keep everything
inside the existing `$transaction`.

## Tests — these must FAIL on current `main`

In `apps/api/src/modules/tendering/__tests__/tendering.service.spec.ts`:

1. **The headline case.** Seed a tender with a note, a clarification, a pricing snapshot, a follow-up
   and an outcome. `update()` with **only** `{ tenderClients: [...] }`. Assert **all five survive**.
   *(On current `main` this test fails — all five are gone. That is the proof the bug is real.)*
2. **Explicit clear still works.** `update()` with `{ tenderNotes: [] }` → notes are deleted.
   *(Absent must not be conflated with empty.)*
3. **Replace still works.** `update()` with `{ tenderNotes: [one note] }` → exactly one note remains.
4. **Full payload is unchanged.** A full-shape update behaves exactly as before — no regression.

> Write the tests so that **they fail before your change and pass after it.** A test that passes on
> `main` is testing nothing. #544 shipped with two tests that asserted the very bug it existed to
> remove — the tests encoded the bug. Do not repeat that.

## Do NOT

- Do not change the HTTP verb. `@Patch` is correct; the *implementation* was wrong.
- Do not touch `create()` — full-replace is correct there.
- Do not touch the DTO. The optional fields are correct; the service was misreading them.
- Do not add a migration. No schema change.
- Do not touch `sot/`. CP-24 hard-fails any PR mixing code and `sot/`.

## Guardrails

- **ONE ATTEMPT.** If it does not work, `NO-OP: <reason>` and stop.
- **NEVER ask a question. NEVER "stand by".** There is nobody to answer.
- **CI failures: read the job log** (`gh run view <run> --job <job> --log`) before diagnosing.
- Open the PR. Do not merge it — this touches how tenders are written; Marco reads the diff.
