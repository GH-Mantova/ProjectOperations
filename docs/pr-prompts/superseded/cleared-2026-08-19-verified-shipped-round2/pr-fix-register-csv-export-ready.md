---
premise: grep -q "exportSelectedCsv" apps/web/src/pages/tendering/TenderingPage.tsx
premise_means: The Tendering register's CSV export is still the selection-scoped, hard-coded seven-column `exportSelectedCsv`. It cannot emit Probability, Days until due or Created, and it does nothing at all - silently - when no rows are ticked.
scope:
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/tendering/tenderingPage.helpers.ts
  - apps/web/src/pages/tendering/__tests__/tenderingPageHelpers.test.ts
done_when: pnpm build && pnpm lint && pnpm --filter web test && ! grep -q "exportSelectedCsv" apps/web/src/pages/tendering/TenderingPage.tsx && grep -q "buildRegisterCsv" apps/web/src/pages/tendering/tenderingPage.helpers.ts
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# Fix the Tendering register CSV export - all columns, all loaded rows

The register renders up to ten columns (`ColumnKey`, `TenderingPage.tsx:124`) but
`exportSelectedCsv` (`TenderingPage.tsx:599`) writes a hard-coded seven-column header:

    ["Tender #", "Name", "Client", "Status", "Value", "Estimator", "Due date"]

**Probability**, **Days until due** and **Created** therefore can never be exported, even when a
user has ticked them in the Columns popover. The export also requires rows to be selected, and
`if (!selected.length) return;` makes the button a silent no-op when none are.

Marco's decisions (2026-08-17, PR Master run 4) - implement these exactly, do not re-open them:

| Question | Decision |
|---|---|
| Which columns | **All ten, always**, in `ALL_COLUMNS` order. The Columns popover is a screen-space concern; it must NOT influence the file. |
| Which rows | **All loaded rows**, respecting the active filter chips. Selection is ignored entirely. |
| Sort order | **Default (server) order.** The on-screen sort must NOT be applied to the file. |
| Value | **Raw number** (`3469650`), so Excel parses it numerically. |
| Dates | **AU format** (`dd/mm/yyyy`), matching the screen. |
| Row-cap overflow | **Warn, then export what is loaded** - see "The 5,000-row ceiling" below. |

## What to build

### 1. A pure `buildRegisterCsv` in `tenderingPage.helpers.ts`

Extract the file-building logic out of the component into `tenderingPage.helpers.ts` and export
`buildRegisterCsv(rows)` returning the CSV string. This is the module's established pattern -
pure helpers tested without jsdom, exactly as `activityClientFilter.ts` and
`tenderEntriesFilters.ts` are. Keep the existing quote-escaping (`"` doubled, CRLF line endings).

Header order and cell rules, all ten columns:

| Column | Cell |
|---|---|
| Tender # | `tenderNumber` |
| Name | `title` |
| Client | `tenderClients` names joined with `"; "` |
| Estimator | `firstName lastName`, empty when unset |
| Status | `status` |
| Probability | the raw value, empty when null - do NOT emit the bucket label |
| Value | `estimatedValue` as a bare number, empty when null. No `$`, no thousands separator. |
| Due date | `dd/mm/yyyy`, empty when null |
| Days until due | the **same display string the register shows** - `1019d overdue`, `today`, `1 day`, `14 days` - and an EMPTY cell where the table shows the em-dash placeholder |
| Created | `createdAt` as `dd/mm/yyyy` |

**Days until due - Marco's explicit decision (2026-08-17): the CSV carries the display string, not
a number.** He was offered a signed integer (`-1019`) on the grounds that a spreadsheet cannot sort
or filter `"1019d overdue"`, and chose the string so the file reads exactly like the screen. Do not
re-litigate this and do not "improve" it into a number.

Reuse `daysUntil` (`TenderingPage.tsx:210`) directly - do NOT write a second day-difference
calculation. One exception: `daysUntil` returns the em-dash `"—"` when there is no due date, which
must NOT reach the file. Emit an empty cell instead, so the column is blank rather than carrying a
typographic character that spreadsheet tools will treat as text.

### 2. Rewire the button

Rename `exportSelectedCsv` to `exportRegisterCsv` and change what it feeds in:

- **Rows:** the filtered-but-unsorted set. `registerRows` (line 470) does two things - it applies
  the client-side probability multi-select filter, then applies the client-side sort when
  `sortBy` is set and there are <= 100 rows. The export needs the **first** step and **not** the
  second. Split those two steps so both the table and the export can take what they need; do not
  duplicate the probability filter.
- **Selection:** `selectedIds` is no longer consulted. Ticking rows changes nothing about the file.
- **Empty state:** when there are zero rows to export, do not fail silently. Surface the same
  user-visible message pattern the page already uses for its other empty/error states.

Update the button's affordance so it no longer implies selection - the label and any tooltip must
say it exports the current filtered register, not the ticked rows.

### 3. The 5,000-row ceiling

`fetchAllPages` caps at `MAX_PAGES = 50` x 100 rows (`tenderingPage.helpers.ts:15`) and returns
`truncated`, which the page already surfaces as *"Showing first N of {total} tenders (safety limit
reached)"*. A CSV written while `truncated` is true is a partial file that looks complete, and
somebody will treat it as a full record.

When `truncated` is true: warn the user **before** the file is written, stating how many rows of
the total will be included, and let them proceed. Then make the shortfall legible in the artifact
itself - put the row count and the total in the filename (keep the `IS_Tenders_<date>` stem) so a
partial file is identifiable after it has been emailed on and detached from the screen that
produced it. Do not add a comment row inside the CSV; it breaks the header contract for anything
parsing the file.

### 4. Tests in `__tests__/tenderingPageHelpers.test.ts`

`buildRegisterCsv` is pure, so test it directly - no jsdom, no component render:

- All ten headers are present, in `ALL_COLUMNS` order.
- A fully-populated row maps every column to the right cell, with Value bare-numeric and both
  dates `dd/mm/yyyy`.
- Nulls (no estimator, no value, no due date, no probability, no clients) emit empty cells, never
  the strings `"null"` or `"undefined"`.
- Multiple clients join with `"; "`.
- A value containing a double quote and a value containing a comma both round-trip correctly.
- The output uses CRLF line endings.

Do not weaken an existing assertion to go green. If a test fails, fix the code, not the test.

## Explicitly out of scope - do NOT do these here

- **Do NOT touch `apps/api/`.** No new endpoint, no server-side export. Everything needed is
  already in memory on the client.
- **Do NOT touch `schema.prisma`, migrations, or any data.** This PR reads what the page already
  fetched and writes a file in the browser. Nothing is written to or removed from the database.
- Do NOT change the Columns popover, `ALL_COLUMNS`, `DEFAULT_COLUMNS`, `ALWAYS_VISIBLE`, the
  `tenders-register-columns:v1` localStorage key, the filter chips, the sort behaviour of the
  table itself, or `MAX_PAGES`.
- Do NOT change the three other CSV exports in the app (`ContactsPage.tsx:117`,
  `ArchivePage.tsx:91`, `DocketsRegisterPage.tsx`). They share this hard-coded-header shape and a
  shared helper is worth doing, but it is a separate PR against separate pages - keep this one to
  the register Marco reported.
- Do NOT add Activity & communications, documents, scope, quote or outcome data to this file.
  A full-tender export is a separate brief with its own permission questions.

## Verification

    pnpm build
    pnpm lint
    pnpm --filter web test

Then confirm by inspection that `exportSelectedCsv` no longer exists, that `buildRegisterCsv` is
exported from `tenderingPage.helpers.ts`, and that the probability filter has exactly one
implementation shared by the table and the export.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
