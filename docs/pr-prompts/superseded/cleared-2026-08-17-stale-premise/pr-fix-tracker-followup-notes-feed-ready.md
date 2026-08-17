---
premise: '! grep -q "notesOnly" apps/api/src/modules/admin-imports/tender-tracker-import.service.ts'
premise_means: The tender-tracker importer still has no notes-only mode and still writes Column O "Follow Up Notes" to TenderClientNote — a model the Activity & communications panel never reads — so every imported follow-up note is invisible on every tender.
scope:
  - apps/api/src/modules/admin-imports/tender-tracker-import.service.ts
  - apps/api/src/modules/admin-imports/tender-tracker-import.controller.ts
  - apps/api/src/modules/admin-imports/tender-tracker-import.service.spec.ts
  - apps/api/src/modules/tender-clarifications/tender-clarifications.service.ts
  - apps/api/src/modules/tender-clarifications/tender-clarifications.controller.ts
  - apps/api/src/modules/tender-clarifications/__tests__/tender-clarifications.service.spec.ts
  - docs/runbooks/tracker-followup-notes-recovery.md
done_when: pnpm build && pnpm lint && grep -q "notesOnly" apps/api/src/modules/admin-imports/tender-tracker-import.service.ts && grep -q "migrateFollowUpNotes" apps/api/src/modules/admin-imports/tender-tracker-import.service.ts && grep -q '"internal"' apps/api/src/modules/tender-clarifications/tender-clarifications.service.ts && test -f docs/runbooks/tracker-followup-notes-recovery.md
size: 7
gate_allow: none
seed_only: false
escalates: true
---

# Fix — estimating-tracker "Follow Up Notes" never reach Activity & communications

Marco, 2026-08-17: *"when importing the estimating tracker (Tender Database.xlsx), the system failed
to populate the information existing under Column O: Follow-up Notes inside each and every tender
(that had information within this column) under Activity & Communications."*

## Confirmed diagnosis — do NOT re-litigate this, it is read off main @ b8ef1fbe

There are **three** note models on a tender. The Activity & communications panel reads **two** of
them. The importer wrote to the **third**.

| Model | Table | Endpoint | Read by the panel? |
|---|---|---|---|
| `TenderEntry` | `tender_entries` | `GET /tenders/:id/entries` | ✅ feed 1 |
| `TenderClarificationNote` | `tender_clarification_notes` | `GET /tenders/:id/clarification-notes` | ✅ feed 2 |
| `TenderClientNote` | `tender_client_notes` | `GET /tenders/:tid/clients/:cid/notes` | ❌ **never** |

Evidence:

- `apps/web/src/pages/tendering/activityClientFilter.ts:6-12` names the panel's two feeds in a
  comment, and `TenderEntriesPanel.tsx` fetches only `/entries` and `/clarification-notes`.
  `TenderClientNote` appears nowhere under `apps/web/src`.
- `apps/api/src/modules/admin-imports/tender-tracker-import.service.ts:561-574` maps
  `row.followUpNotes` to `this.prisma.tenderClientNote.create(...)`.
- Result: the rows are real and unrenderable. The panel renders
  `Showing 0 entries (all clients)` on every tender that has follow-up notes.

`TenderClarificationNote.clientId` is **nullable by design** (schema.prisma:3753-3757 — "optional
client link so the Activity sidebar can filter entries to a single client") and `direction` is a
free `String` column, so this whole fix needs **no migration**.

## The two sources, and why there are two

**Source A — the database.** Roughly 119 `TenderClientNote` rows are believed to already exist in
production. Reasoning: 119 of 556 spreadsheet rows carry Column O text; the 13 Aug run reported
`notesCreated: 5` with `badRows: 10` fully accounted for by 4 unparseable prices and 6 missing
project names — i.e. **no note-creation errors** — so the other 114 were skipped by the importer's
dedupe as already-existing from the earlier #1100 run. This is a deduction, not a row count. The
migration must therefore report what it actually finds and must behave correctly if the answer is 5,
119, or 0.

**Source B — the spreadsheet.** Column O text that never reached the database at all, plus anything
added to the tracker since the last import.

Stage A runs first because the database rows are already client-linked, already dated and already
deduped. Stage B then tops up only what Stage A did not produce.

## Marco's approved design (2026-08-17 — all decided, build exactly this)

### Stage A — migrate the existing rows (non-destructive)

Add a public method `migrateFollowUpNotes(actorId: string, dryRun: boolean)` to
`TenderTrackerImportService`, exposed as
`POST /admin/imports/tender-followup-notes/migrate` on the existing controller, with the same
`users.create` guard and the same super-user defence-in-depth check, and the same
`dryRun !== false` default-to-safe parsing.

For every `TenderClientNote` row, create a `TenderClarificationNote`:

- `tenderId` — unchanged.
- `clientId` — unchanged (it is non-null on the source model).
- `noteType` — `note`, `call`, `email` and `meeting` pass through unchanged; `site_visit` and any
  unrecognised value become `"note"`. `TenderClarificationNote` only accepts
  `call | email | meeting | note | response`, so an unmapped value would be unrenderable — the exact
  class of bug this PR exists to fix.
- `direction` — `"internal"`. This is team commentary, not client correspondence.
- `text` — the source `body`, **trimmed**. If the source row has a `subject`, fold it in as
  `` `${subject} — ${body}` ``, matching the existing convention in
  `activityClientFilter.ts` `buildCommCreateBody`. No provenance marker, no appended tag.
- `occurredAt` — the source `occurredAt`, unchanged. **Never `new Date()`.**
- `createdById` — the tender's `estimatorUserId`, falling back to the source row's `createdById`,
  falling back to `actorId`. This column is **NOT NULL** on the target model and **nullable** on the
  source, so the fallback chain is mandatory, not optional.

**Nothing is deleted, updated or emptied.** The source rows stay exactly as they are. Retiring
`TenderClientNote` is a separate slice that Marco has not yet commissioned — do not start it, do not
drop the model, the endpoint or the table, and do not add a deprecation shim.

### Stage B — notes-only spreadsheet top-up

Add a `notesOnly` body field to `POST /admin/imports/tender-tracker`, parsed exactly like `dryRun`
(`notesOnlyRaw === "true"`, default **false**). When `notesOnly` is true the import writes **ONLY**
notes: no Tender create/update, no status, no tender numbers, no dates, no Client upsert, no Site
create, no TenderClient link. This is deliberate — re-running the full import in commit mode
re-asserts the spreadsheet's status over user-set status, a known hazard recorded on 2026-08-13.

Resolve each row to an **existing** tender using the same `title startsWith "<T-number> "` lookup the
main path uses at line 460. Rows with no matching tender increment `notesSkippedNoTenderMatch` and are
reported, never thrown. Then write a `TenderClarificationNote` per §Stage A's field rules, except:

- `text` — the Column O value, trimmed (4 rows begin with a stray newline).
- `clientId` — resolve by looking up the tender's **existing** `TenderClient` links and taking the one
  whose client name matches the row's Client Company Name under the importer's existing
  normalisation. If the tender has no links, or several and none match, or the name is blank →
  **`null`**. In notes-only mode you must **never create or upsert a Client, a Site or a TenderClient
  link** to force a match. A note with `clientId: null` still renders under "All clients", which is
  exactly what Marco asked for.
- `createdById` — the tender's resolved estimator via the existing `resolveEstimatorId` (including
  the Russel/Russell Cummings → Sean Lattin mapping), falling back to `actorId`.
- `occurredAt` — `dateSubmitted ?? quoteDueDate ?? startedQuoting ?? <the tender row's createdAt>`.
  **Never `new Date()`** — an invented "today" would sort the undated notes above genuine recent
  activity on every feed.

### Both stages — idempotency

Before writing, skip when a `TenderClarificationNote` already exists on that tender whose trimmed
`text` equals this note's trimmed text. This is what makes Stage B a top-up rather than a duplicator,
and it is what makes either stage safe to re-run.

### Permanent mapping fix

Replace the `tenderClientNote.create` call in the importer's normal path (line 569) so full imports
write `TenderClarificationNote` under the same field rules. **Replace it — do not write both.**

### Direction allow-list

`tender-clarifications.service.ts:5` is `const DIRECTIONS = ["sent", "received"] as const` and
`tender-clarifications.controller.ts:13,21` both carry `@IsIn(["sent", "received"])`. Add
`"internal"` in all three places, or any user editing an imported note through the UI gets a 400.
**API only: do NOT touch the Add-entry UI or any file under `apps/web/`.** Marco explicitly chose
allow-list-only.

### Reports

Both endpoints report, at minimum: `rowsRead`, `notesCreated`, `notesSkippedDuplicate`,
`notesSkippedNoTenderMatch` (Stage B), `notesWithoutClient`, `notesWithoutEstimator`, `badRows`.
Dry-run returns the identical shape with **zero** writes and includes a **sample of up to 10 notes**
it would write — tender title, client name or `null`, author, date, first 80 chars of text — so
Marco can eyeball it before committing.

## Explicitly out of scope

- Any file under `apps/web/` — no UI change of any kind.
- Any migration. If you find yourself editing `schema.prisma`, stop: the design is wrong.
- Deleting, updating or emptying any `TenderClientNote` row.
- Retiring the `TenderClientNote` model, endpoint or table — a separate, not-yet-commissioned slice.
- Running either stage against production. The PR ships the capability; **Marco runs every pass.**

## Verification

`pnpm build && pnpm lint && pnpm --filter api test` must pass. Tests must cover: the dedupe skip on
both stages; the `noteType` mapping including `site_visit` → `note`; the `createdById` fallback chain
where the source is null and the estimator is unmatched; the Stage B `occurredAt` fallback including
the no-date-at-all case resolving to the tender's `createdAt`; the null-client path; that
`notesOnly: true` and the migrate endpoint each perform **zero** tender/client/site writes and **zero**
`TenderClientNote` writes or deletes; that dry-run writes nothing; and that `"internal"` is accepted
as a direction while a junk value is still rejected. Do not weaken an existing assertion to go green.
If a test fails, fix the code, not the test.

## Runbook

`docs/runbooks/tracker-followup-notes-recovery.md` — the pass sequence **Marco runs himself**: obtain
a super-user token; Stage A dry-run, read the sample, Stage A commit; Stage B dry-run with
`notesOnly=true`, read the sample, Stage B commit. Exact curl for every pass, the expected report
shape, and how to verify in the UI afterwards (open a tender known to carry Column O text, confirm
entries appear under Activity & communications and under the Notes chip).

## Escalation

`escalates: true`. This ships code paths that write production data when Marco runs them. Label the
PR `do-not-merge` for Marco and do not merge it. Report honestly if verification is exhausted — do
not loop.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
