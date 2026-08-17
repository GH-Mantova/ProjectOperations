---
premise: grep -q "model TenderClientNote" apps/api/prisma/schema.prisma
premise_means: The TenderClientNote model and its tender_client_notes table still exist. Slice 1 removed every code path that reaches them, so the table is unreachable dead weight holding 127 rows already duplicated into TenderClarificationNote.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/admin-imports/export-tender-client-notes.ts
  - apps/api/src/modules/admin-imports/__tests__/export-tender-client-notes.spec.ts
  - docs/data-model/**
  - docs/runbooks/tracker-followup-notes-recovery.md
done_when: pnpm build && pnpm lint && ! grep -q "model TenderClientNote" apps/api/prisma/schema.prisma && ! grep -q "tender_client_notes" apps/api/prisma/schema.prisma
size: 6
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Destructive and forward-only — a dropped table cannot be restored by a down migration. The recovery path is the JSON export this slice produces BEFORE the drop (all 127 rows with ids, authors and timestamps), plus the fact that every note's content already exists in tender_clarification_notes. If the drop fails mid-flight the table is simply still present and the migration can be re-run; if it succeeds and was wrong, restore from the export plus a database point-in-time restore.
backfill: false
requires_file_on_main:
  - docs/runbooks/tracker-followup-notes-recovery.md
---

# Retire TenderClientNote — SLICE 2: export the rows, then drop the table

# 🛑 HOLD — DO NOT ARM. NEVER auto-arm this prompt.

This slice **permanently destroys production data**. It may only be armed when Marco says so, in
writing, after **both** of these are true:

1. **Slice 1 (`pr-retire-tenderclientnote-s1-ready.md`) has merged and deployed.**
2. **Marco has opened the app and confirmed the migrated notes are correct** — Activity &
   communications populated, notes surviving the Notes chip, right authors, right dates, right
   clients. Until he has, `tender_client_notes` is the only rollback for the 2026-08-17 migration
   and must not be touched.

A prompt that deletes production rows on a schedule is exactly the failure this pipeline exists to
prevent. If you are an automated station reading this file: stop here.

## Context (verified against main @ a46488fb)

All 127 `TenderClientNote` rows were migrated into `TenderClarificationNote` on 2026-08-17
(118 written, 9 collapsed as identical text on the same tender; verified by read-back —
a repeat Stage A dry-run reported `notesCreated: 0`, `notesSkippedDuplicate: 127`). Nothing under
`apps/web/src` has ever read the model. After Slice 1 no code reaches it at all.

## What to build

### 1. Export FIRST — this is not optional

`apps/api/src/modules/admin-imports/export-tender-client-notes.ts` — a standalone, **read-only**
script that writes every `tender_client_notes` row to JSON: `id`, `tenderId`, `clientId`,
`noteType`, `subject`, `body`, `occurredAt`, `createdById`, `createdAt`, plus the tender title and
client name resolved for human readability.

**Row-count guard — the script must exit non-zero unless it exported EXACTLY 127 rows.** Print the
expected count, the actual count, and which direction the mismatch runs:

- **More than 127** — rows were written to `tender_client_notes` AFTER the 2026-08-17 migration, so
  their content is **NOT** mirrored in `tender_clarification_notes` and the drop would destroy the
  only copy. This is a live possibility until Slice 1 merges: the REST surface
  `POST /tenders/:tenderId/clients/:clientId/notes` is still reachable today
  (`tender-client-notes.service.ts:65`). Nothing in `apps/web/src` calls it — verified, zero
  references — but a script, an integration or a manual API call could. **Stop and re-migrate the
  new rows before dropping anything.**
- **Fewer than 127** — rows have already been removed by something. Stop and find out what, because
  the 2026-08-17 read-back is no longer a valid description of the table.
- **Zero** — an empty export would silently make the drop unrecoverable. Stop.

Hard-code 127 as a named constant with a comment pointing at the 2026-08-17 migration, so the number
is auditable rather than magic. If Marco has consciously changed the row count he can update the
constant in the same PR that explains why — the guard exists to force that conversation, not to be
edited away quietly.

Marco runs this and keeps the file **before** the migration is applied. Document the exact command
in the runbook.

### 2. The migration

A single migration that, in order:

- `DELETE FROM "tender_client_notes";`
- `DROP TABLE "tender_client_notes";`

The table's foreign keys (`tender_id` → `tenders`, `client_id` → `clients`, `created_by_id` →
`users`) are all outbound, and **no other table references it**, so the drop needs no cascade and
breaks no constraint. Verify that claim against `schema.prisma` before writing the SQL rather than
trusting this sentence.

### 3. Schema

Remove `model TenderClientNote` (~line 2734) and all three back-relations:
`User.tenderClientNotes` (~102, `@relation("TenderClientNoteAuthor")`),
`Client.tenderClientNotes` (~790), `Tender.clientNotes` (~1229).

### 4. Regenerate the data-model map

`docs/data-model/relationship-map.md` is CI-gated and will fail if stale. Regenerate it with
`scripts/data-model/build-relationship-map.mjs` rather than hand-editing.

### 5. Tests

`__tests__/export-tender-client-notes.spec.ts` must prove the export includes every field named
above, and must cover all four row-count outcomes:

- exactly 127 → exit 0, export written
- more than 127 → exit non-zero, message names the after-migration-write risk
- fewer than 127 → exit non-zero
- zero → exit non-zero

A guard with no test for its failing branches is a guard nobody has proven works, and this one is
the last thing standing between a mistake and unrecoverable production data.

## Explicitly out of scope

- Any change under `apps/web/`.
- Rewriting historical `audit_logs` rows carrying `entityType: "TenderClientNote"` — the log is
  append-only and references to a retired model are correct history.
- Touching `TenderClarificationNote`, `TenderEntry`, or the Stage B `notesOnly` import path.
- Editing anything under `/sot/` — if the data-model doc needs reconciling, that is a separate
  doc-reconcile PR (CP-24 hard-fails a PR mixing code and `sot/`).

## Verification

`pnpm build && pnpm lint && pnpm --filter api test`, plus the data-model generator gate. Confirm
`prisma.tenderClientNote` no longer exists on the generated client and that nothing references it.

## Escalation

`escalates: true`, and stronger than usual: this is an **irreversible production data deletion**.
Label the PR `do-not-merge`. **Marco merges it himself, and Marco runs the export first.** Do not
merge it, do not run the migration against production, and do not arm this prompt.

You have STANDING AUTHORITY to write the code, commit, push, and OPEN THE PR — but only once this
prompt has been deliberately armed by Marco. Do not merge.
