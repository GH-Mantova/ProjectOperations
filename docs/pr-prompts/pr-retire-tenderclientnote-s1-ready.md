---
premise: test -f apps/api/src/modules/tendering/tender-client-notes.controller.ts
premise_means: The TenderClientNote REST surface still exists. Its data was fully migrated into TenderClarificationNote on 2026-08-17 (127 rows), nothing under apps/web/src has ever read it, and the model is now write-only dead weight.
scope:
  - apps/api/src/modules/tendering/tender-client-notes.controller.ts
  - apps/api/src/modules/tendering/tender-client-notes.service.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/api/src/modules/admin-imports/tender-tracker-import.service.ts
  - apps/api/src/modules/admin-imports/tender-tracker-import.controller.ts
  - apps/api/src/modules/admin-imports/tender-tracker-import.service.spec.ts
  - docs/runbooks/tracker-followup-notes-recovery.md
done_when: pnpm build && pnpm lint && test ! -f apps/api/src/modules/tendering/tender-client-notes.controller.ts && test ! -f apps/api/src/modules/tendering/tender-client-notes.service.ts && ! grep -q "migrateFollowUpNotes" apps/api/src/modules/admin-imports/tender-tracker-import.service.ts
size: 7
gate_allow: none
seed_only: false
escalates: true
---

# Retire TenderClientNote — SLICE 1: remove the code surface (table and rows UNTOUCHED)

Slice 1 of 2. **This slice deletes NO data and NO table.** It removes every way to reach
`TenderClientNote` from code, leaving the table and its 127 rows in place as a rollback copy.
Slice 2 (`pr-retire-tenderclientnote-s2-HOLD.md`) drops the table, and only after Marco has
confirmed the migrated notes look right in the app.

## Why this is safe (verified against main @ a46488fb — do not re-litigate)

- **0 references under `apps/web/src`.** Nothing in the UI has ever read this model. The Activity &
  communications panel renders `TenderEntry` (`/entries`) and `TenderClarificationNote`
  (`/clarification-notes`) only — see `apps/web/src/pages/tendering/activityClientFilter.ts:6-12`.
- **The data is already duplicated.** On 2026-08-17 all 127 `TenderClientNote` rows were migrated
  into `TenderClarificationNote` (118 written, 9 collapsed as identical text on the same tender).
  Verified by read-back: a repeat Stage A dry-run reports `notesCreated: 0`,
  `notesSkippedDuplicate: 127`.
- **The importer no longer writes it.** PR #1139 replaced the `tenderClientNote.create` call with a
  `TenderClarificationNote` write, so the row count is frozen and cannot grow.

## What to remove

1. **Delete** `apps/api/src/modules/tendering/tender-client-notes.controller.ts` — the whole
   `/tenders/:tenderId/clients/:clientId/notes` surface (GET, POST, DELETE).
2. **Delete** `apps/api/src/modules/tendering/tender-client-notes.service.ts`.
3. `tendering.module.ts` — remove both imports (lines ~15-16) and both registrations in
   `controllers` (~line 51) and `providers` (~line 71). Change nothing else in that module.
4. `tender-tracker-import.service.ts` — remove **Stage A**: the public `migrateFollowUpNotes`
   method, and the `FollowUpNotesReport.mode` union member `"migrate"` if it becomes unreachable.
   **Keep** `importFollowUpNotes` (Stage B / `notesOnly`), `writeFollowUpNote`, `describeUser`,
   `resolveNoteDate`, `pickLinkedClientId`, `composeNoteText` and `toClarificationNoteType` — Stage B
   still uses all of them and remains a supported path for future spreadsheet top-ups.
5. `tender-tracker-import.controller.ts` — remove the `POST tender-followup-notes/migrate` route and
   its entry from the file's header comment. **Do not touch** the `tender-tracker` route, the
   `notesOnly` flag, the SharePoint routes, the `users.create` guard or `assertSuperUser`.
6. `tender-tracker-import.service.spec.ts` — remove the `describe("migrateFollowUpNotes -- Stage A")`
   block and the now-unused `tenderClientNote.findMany` mock. **Keep** the regression assertions that
   prove the importer writes `TenderClarificationNote` and never `TenderClientNote` — that guard is
   the whole point and must survive. Keep the `tenderClientNote` mock object itself so those
   `not.toHaveBeenCalled()` assertions still mean something.
7. `docs/runbooks/tracker-followup-notes-recovery.md` — mark Stage A as **completed and retired**
   (ran 2026-08-17, 118 written), and state that only Stage B remains runnable. Do not delete the
   runbook; its history is the record of what was done.

## Explicitly out of scope — do NOT do these here

- **Do NOT touch `schema.prisma`.** `model TenderClientNote` and its three back-relations
  (`User.tenderClientNotes:102`, `Client.tenderClientNotes:790`, `Tender.clientNotes:1229`) stay
  exactly as they are. If you edit the schema, this slice is wrong.
- **Do NOT write a migration.** No `DELETE`, no `DROP`, no rename. `gate_allow: none` is deliberate.
- Do NOT touch `apps/web/` — there is nothing there to touch.
- Do NOT rewrite historical `audit_logs` rows carrying `entityType: "TenderClientNote"`. The log is
  append-only; references to a retired model are correct history, not debris.

## Verification

`pnpm build && pnpm lint && pnpm --filter api test` must pass. The Prisma client will still generate
`prisma.tenderClientNote` because the model remains — that is expected in this slice; nothing may
call it. Confirm with a grep that no `.ts` file under `apps/api/src` outside `schema.prisma` still
references `prisma.tenderClientNote` except the surviving spec assertions.

Do not weaken an existing assertion to go green. If a test fails, fix the code, not the test.

## Escalation

`escalates: true`. This removes a public API surface. Label the PR `do-not-merge` for Marco.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
