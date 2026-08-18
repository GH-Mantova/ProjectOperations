# Runbook — recover estimating-tracker "Follow Up Notes" into Activity & communications

**Who runs this: Marco.** Every pass below writes production data. Run each stage as a dry-run
first, read the sample, and only then commit.

## Why this exists

The tracker importer wrote Column O "Follow Up Notes" to `TenderClientNote`. The Activity &
communications panel renders two feeds — `TenderEntry` (`/tenders/:id/entries`) and
`TenderClarificationNote` (`/tenders/:id/clarification-notes`) — and `TenderClientNote` is neither.
The notes were stored and unrenderable on every tender, so the panel showed
`Showing 0 entries (all clients)`.

The importer now writes `TenderClarificationNote`, and two recovery paths bring the historical notes
across.

| Stage | What it reads | What it writes |
|---|---|---|
| A — migrate | existing `TenderClientNote` rows | `TenderClarificationNote` |
| B — notes-only import | `Tender Database.xlsx` Column O | `TenderClarificationNote` |

Stage A was completed 2026-08-17 (118 rows migrated, 9 collapsed). **Only Stage B remains
runnable.** B tops up anything Column O has that the database never received. Both stages are/were
idempotent by trimmed note text, so Stage B cannot duplicate what Stage A already wrote.

**Nothing is deleted.** The source `TenderClientNote` rows are read and left exactly as they are.

## Prerequisites

- The PR carrying this runbook is **merged and deployed**. The endpoints do not exist until the API
  has redeployed — check the deploy finished before starting.
- A **super-user** bearer token. Both endpoints are gated on `users.create` plus an explicit
  `isSuperUser` check. Tokens are short-lived (~15 min) and a deploy rotates the JWT secret, so log
  in again if a call returns 401.
- The API can be slow to wake — allow for a 60–120s cold start (`--max-time 280`).

Set these once per session:

```bash
API=https://<the-api-host>
TOKEN=<paste a fresh super-user token>
```

## Stage A — migrate the existing rows [COMPLETED AND RETIRED]

> **Stage A was completed on 2026-08-17.** 118 `TenderClientNote` rows were migrated to
> `TenderClarificationNote` (9 rows collapsed as duplicates). The migration endpoint
> (`POST /admin/imports/tender-followup-notes/migrate`) has been removed from the API as part of
> the `TenderClientNote` code-surface retirement (slice 1, 2026-08-18). **This route no longer
> exists and cannot be re-run.**
>
> Only Stage B remains runnable. If you need to recover additional notes, use Stage B with the
> spreadsheet file.

## Stage B — notes-only spreadsheet top-up

`notesOnly=true` writes follow-up notes and nothing else: no tender create or update, no status, no
tender numbers, no dates, no client upsert, no site create, no tender/client link.

> **Do NOT run the full import (`notesOnly` absent or `false`) to do this.** A full commit re-run
> re-asserts the spreadsheet's status onto every tender, overwriting any status a user has since set
> in the ERP.

Dry run:

```bash
curl -sS --max-time 280 -X POST "$API/admin/imports/tender-tracker" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@Tender Database.xlsx" \
  -F "notesOnly=true" \
  -F "dryRun=true"
```

Expect `"mode": "notesOnly"`. After Stage A has committed, most rows should report as
`notesSkippedDuplicate` — that is the idempotency working, not an error. `notesCreated` here is what
Column O has that the database did not.

`notesSkippedNoTenderMatch` counts rows whose T-number matches no tender; each one is also listed in
`badRows`. Notes-only mode deliberately will not create a tender to hold an orphan note.

Then commit:

```bash
curl -sS --max-time 280 -X POST "$API/admin/imports/tender-tracker" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@Tender Database.xlsx" \
  -F "notesOnly=true" \
  -F "dryRun=false"
```

## Verify in the UI

1. Open a tender you know carries Column O text — e.g. **T1683 — 10 Gretty lane Lower Beechmont**
   ("Gave a stupidly high price…") or **T1565 — Gympie Hospital** ("Demex won it").
2. Go to **Activity & communications**. The entry should be listed, and the subtitle should no longer
   read `Showing 0 entries (all clients)`.
3. Click the **Notes** chip — imported notes are logged as note type `note`, so they must survive
   that filter.
4. Each row shows **Internal** as its direction and the estimator's name as author.
5. Use the **FILTER BY CLIENT** sidebar: a note attached to a client should appear under that client;
   a note with no client resolved appears only under "All clients".

## If something looks wrong

- Nothing appeared → confirm the deploy actually shipped this code, and that the commit run (not just
  the dry run) returned `notesCreated > 0`.
- A note shows the wrong author → the tender had no estimator set, so it fell back to the source
  author and then to you. Fix the tender's estimator and re-run; the note itself is editable in the UI.
- A note is on the wrong client → open it in the UI and reassign. The importer only ever matches
  against a tender's existing client links; it never invents one.
- Everything reports `notesSkippedDuplicate` and `notesCreated: 0` → the work is already done. Both
  stages are safe to re-run and this is the expected result the second time.

## Not part of this runbook

The `TenderClientNote` code surface (the REST endpoints and service) was removed in the
`feat/retire-tenderclientnote-s1` PR (slice 1, 2026-08-18). The table and its 127 rows remain in
the database as a rollback copy. Slice 2 will drop the table after Marco confirms the migrated
notes in `TenderClarificationNote` look correct.
