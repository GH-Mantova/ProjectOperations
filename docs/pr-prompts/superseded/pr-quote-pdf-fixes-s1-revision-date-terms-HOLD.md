---
premise: '! grep -rq "QUOTE_PDF_FIXES_V1" apps/api/src'
premise_means: >-
  Five defects on the client quote PDF, all inside the signed-off design. MEASURED 2026-10-02 at
  origin/main 7d9926ae in apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts:
  (1) The cover "Date" prints fmtDate(new Date()) at render time (:398), so an issued quote re-dates
      itself every time it is downloaded. ClientQuote.sentAt exists and is never passed to the builder.
  (2) overlay.revision is carried (:42) and printed nowhere: not in the meta grid, and not in
      headerTemplate, which shows quoteRef only.
  (3) Terms-and-conditions clause bodies print as <p>${esc(clause.body)}</p> (:857) with no
      white-space rule, so the line breaks already in the terms text (clauses 1-4: definitions and the
      a)/b)/c) acceptance list) collapse into run-on paragraphs.
  (4) The cost-options header style tr.cost-opt-header td (:258) never matches, because the row's
      cells are <th> (:521). The intended grey header has never rendered.
  (5) acceptanceBlock uppercases the client name (:873), and with no client it prints the literal
      "[CLIENT COMPANY NAME]" (:868) on a signable page.
  The defects were catalogued in the "Quote PDF As Built" artifact (10 Sep), annotations 6, 10, 11,
  21 and 28.
  POSITIVE CONTROL: grep -n "fmtDate(new Date())" apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts
  returns a hit.
design_ref: Claude Design/proposed/quote-pdf-fixes/quote-pdf-fixes-mockup.html
done_when: >-
  pnpm build && pnpm lint && pnpm --filter api test &&
  grep -q "QUOTE_PDF_FIXES_V1" apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts &&
  ! grep -q "CLIENT COMPANY NAME" apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts &&
  ! grep -q "clientName.toUpperCase()" apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts
scope:
  - apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts
  - apps/api/src/modules/pdf-rendering/builders/__tests__/quote-html.builder.spec.ts
  - apps/api/src/modules/client-quotes/quote-pdf.service.ts
  - apps/api/src/modules/client-quotes/__tests__/quote-pdf-sent-date.spec.ts
size: 3
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Code only. No schema, migration, seed or env var. Reverting restores today's rendering; no stored
  data is read differently or written.
escalates: false
module: pdf-rendering
---

# Quote PDF: the date it was sent, the revision, terms that keep their line breaks, the client's real name

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Build to the mock-up at the `design_ref`, approved by Marco on 2026-10-02.

## Marco's decisions, 2026-10-02: build to these

1. **The cover "Date" is the date the quote was sent.** While the quote is unsent (draft), it is
   today's date, exactly as now.
2. **Cost options get NO total row.** Options are separate choices. Fix only the header style.
3. The revision prints, the terms keep their line breaks, and the client name prints as stored. All
   approved as drawn.

## What to build

Marker in the builder: `export const QUOTE_PDF_FIXES_V1 = "quote-pdf-fixes-s1";`

### 1. Sent date

- `QuoteOverlay` gains `sentAt: Date | null`.
- `quote-pdf.service.ts` sets it from `quote.sentAt`.
- `coverPage` prints `fmtDate(overlay?.sentAt ?? new Date())`. The estimate preview (overlay null)
  keeps today's date.
- **Do not touch the header strip's "Printed on" stamp.** That is document control and must stay the
  print date.

### 2. Revision

- Meta grid "Quote No:" becomes `<quoteRef> Rev <n>` for a real quote. Always print it, revision 1
  included.
- `headerTemplate` gains an optional `revision` in `HeaderTemplateOptions`. When set, the teal band
  reads `Quote No. <quoteRef> · Rev <n>`. `quote-pdf.service.ts` passes `quote.revision`.
- The estimate preview passes none and is unchanged.

### 3. Terms line breaks

- `.tc-clause p` gains `white-space: pre-line`, so the line breaks already in clause bodies render.
- Keep `esc()`. Do not convert to `<br>`, and do not change the terms text, the parser, the column
  layout or the font size.

### 4. Cost options header

- Change the selector to `tr.cost-opt-header th`, so the header renders BRAND light grey with dark
  grey text, as intended.
- **No total row.**

### 5. Acceptance block

- Print the client name **as stored**. Remove `.toUpperCase()`.
- With no client, print a blank ruled line with the field label "Client name". It is filled in by
  hand. Remove the "[CLIENT COMPANY NAME]" literal.
- The page-1 "Company:" field is unchanged.

## Tests

1. Builder:
   - With `sentAt = 2026-09-10` and the render clock set to 2026-10-02, the cover Date reads
     `10/09/2026`.
   - With `sentAt = null`, it reads the render date.
   - The estimate preview reads the render date.
   - Pin the clock with fake timers; do not depend on today.
2. Builder:
   - Revision 2 renders `IS-2609-0412 Rev 2` in the meta grid, and `headerTemplate(..., { revision: 2 })`
     contains `Rev 2`.
   - Revision 1 also prints `Rev 1`.
   - The estimate preview contains no `Rev`.
3. Builder:
   - A clause body `"a) one\nb) two"` survives into the HTML with its newline.
   - The stylesheet carries `white-space: pre-line` for `.tc-clause p`.
4. Builder:
   - The stylesheet selector is `tr.cost-opt-header th`.
   - The cost-options table has **no** total row.
5. Builder:
   - The client `"Wattlebank Constructions Pty Ltd"` appears verbatim in the acceptance block, with no
     uppercase copy.
   - With no client, the output contains `Client name` and no `[`/`]` placeholder.
6. `quote-pdf-sent-date.spec.ts`: the service passes `sentAt` and `revision` from the quote record into
   the overlay and the header options.
7. Update existing builder snapshots or assertions that encoded the old output, and list each one in
   the PR body.
8. Tests 1, 2, 3 and 5 **fail on `origin/main`**. Prove it by reverting the production hunk once.

## DO NOT

- Do not change `detailLevel` or its default. That decision is still Marco's (punch list 1.5.4).
- Do not change the terms text, their 6pt size, the page breaks or the acceptance block's
  `break-inside`.
- Do not change totals, cost-line amounts, `costOptionsTotal`, or the quote screen.
- No schema change. Do not touch `sot/` (CP-24).

## PR body

Render one real quote PDF before and after, from a seeded sent quote at revision 2. Attach page 1,
the terms page and the acceptance page.
