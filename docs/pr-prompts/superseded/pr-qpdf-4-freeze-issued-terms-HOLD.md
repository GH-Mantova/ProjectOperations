---
premise: '! grep -q "issuedTerms" apps/api/src/modules/client-quotes/quote-pdf.service.ts'
premise_means: >-
  ClientQuote.issuedTermsDocumentId is stamped at send and never read. It is written at
  quote-send.service.ts:85 (and for contracts at contracts.service.ts:177); a repo-wide search of
  apps/api/src and apps/web/src returns those two writes and no read at all. The PDF still takes its
  clauses from the live per-tender copy at estimate-export.service.ts:252-257, so editing the T&Cs
  silently re-renders every historical quote under the new terms. The rider defect is live too - the
  PreviewTab map at ClientQuotesPanel.tsx:1748-1752 ignores isVisible, prints raw l.price instead of
  the appropriated displayedAmount, and ignores displayDescription, all three of which the PDF
  honours at quote-pdf.service.ts:88-99.
scope:
  - apps/api/src/modules/client-quotes/quote-pdf.service.ts
  - apps/api/src/modules/estimate-export/estimate-export.service.ts
  - apps/api/src/modules/quote/tc-parser.ts
  - apps/api/src/modules/client-quotes/__tests__/quote-issued-terms.spec.ts
  - apps/web/src/pages/tendering/ClientQuotesPanel.tsx
  - apps/web/src/pages/tendering/__tests__/quotePreviewParity.test.tsx
done_when: >-
  pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "issuedTerms"
  apps/api/src/modules/client-quotes/quote-pdf.service.ts && grep -q "parseClauses"
  apps/api/src/modules/quote/tc-parser.ts
size: 6
gate_allow: none
seed_only: false
escalates: true
backfill: false
module: client-quotes
design_ref: https://claude.ai/code/artifact/3020638f-054c-4e77-994e-1b6a3effff9b
---

# QPDF-4 - freeze the terms at issue, and make the preview show what the PDF sends

**Grounded against `origin/main` = `e2804112`, every citation re-checked on disk 2026-09-10.**
Independent of the `quote-pdf-correctness` chain (QPDF-1 / QPDF-2) and of QPDF-3. It shares
`estimate-export.service.ts` with QPDF-1 and QPDF-2, but at `:252-257` - 15 lines below the end of
the `include` block QPDF-2 edits (`:237`) and ~180 lines above the `exportPdf` body QPDF-1 edits
(`:433-448`). No overlapping hunk, so **no ordering gate is declared.** If you find yourself editing
either of those regions, you have gone outside this slice.

## The three documents this slice is built from

| What | Where |
|---|---|
| **The spec - the agreed decision, not a proposal** | https://claude.ai/code/artifact/3020638f-054c-4e77-994e-1b6a3effff9b |
| PDF as-built - what the document renders today | https://claude.ai/code/artifact/12b3266c-8148-4648-a782-90ec52dbfa76 |
| Screen as-built - the panel whose preview lies | https://claude.ai/code/artifact/757617c5-14db-439d-9a00-9576d4c26c42 |

## Part 1 - read the pin that PR #549 wrote and nobody ever read

PR #549 built effective-dated legal documents and pinned the active T&C version onto every issued
quote, for a stated contractual reason. The schema comment at `schema.prisma:4670-4674` spells it
out: *"Editing T&Cs later creates a new version; this FK still points at the old one, so the
historical PDF renders the legal terms actually agreed to."*

The write happens (`quote-send.service.ts:73-86`: resolve the active `TERMS_AND_CONDITIONS`, stamp
`issuedTermsDocumentId` inside the send transaction). **The read was never wired.** Money frozen,
terms not - which is the more dangerous half to get wrong.

### MEASURED 2026-09-10 - the spec's open risk resolves cleanly

The spec flagged a real unknown: *"the pinned document's clause payload has to be shape-compatible
with `TcClause[]`; if it is stored as prose rather than as structured clauses, the two-column T&C
layout has nothing to lay out."* Checked, and the answer is good news:

* `CompanyLegalDocument.content` is a plain `String` (`schema.prisma:6490`) - **it is prose, not
  structured clauses.**
* The seeded `TERMS_AND_CONDITIONS` v1 row is `TC_TEXT` **verbatim**
  (`apps/api/prisma/seed-company-profile.ts:131`).
* `TC_TEXT` (`estimate-export/pdf/tc-text.const.ts:4`) is exactly the string
  `parseDefaultClauses()` already parses into `TcClause[]` (`quote/tc-parser.ts:11-36`, heading
  regex `/^(\d+A?)\.\s+(.+)$/` at `:13`).

So the parser you need already exists and already handles this text. **Do not write a second
parser, and do not add a JSON column.**

### What to build

1. **`quote/tc-parser.ts`** - generalise. Export `parseClauses(text: string): TcClause[]` carrying
   the existing body, and keep `parseDefaultClauses()` as a one-line wrapper over
   `parseClauses(TC_TEXT)` so every current caller (`quote.service.ts:4`, `:103`,
   `estimate-export.service.ts:256`, `quote.controller.ts:9`) is unaffected.

2. **`estimate-export.service.ts`** - make the clause resolution at `:252-257` reusable. Today it is
   inline: `tender.tandC && isClauseArray(tender.tandC.clauses)` → use them, else
   `parseDefaultClauses()`. Extract it so `quote-pdf.service.ts` can share one code path instead of
   growing a second. **Do not change what the tender-level path resolves to** - the tender-level
   export has no `ClientQuote` and must keep rendering live clauses.

3. **`quote-pdf.service.ts`** - add `issuedTerms: { select: { content: true } }` to the
   `clientQuote.findUnique` include at `:42-53`, and override `base.clauses` before the
   `buildQuoteHtml(base, overlay)` call at `:137`.

### The fallback ladder - get this exactly right

Render pinned clauses **only** when all of these hold; otherwise fall back to live clauses:

| Condition | What renders | Why |
|---|---|---|
| `quote.sentAt` is `null` (quote not sent) | **Live** clauses | A draft should reflect current terms. This is deliberate, not a gap. |
| Sent, but `issuedTermsDocumentId` is `NULL` | **Live** clauses | The column is nullable and is `NULL` for every quote sent before #549 landed, and for any send that found no active `TERMS_AND_CONDITIONS` row (`quote-send.service.ts:73-77` resolves `activeTerms?.id ?? null`). |
| Pinned row found, but `parseClauses(content)` returns an empty array | **Live** clauses, plus a `logger.warn` naming the document id | `company-profile.service.ts:283-320` lets a human author any `content` for v2+. If it does not follow the `N. HEADING` convention the parser yields nothing. |
| Pinned row found and parses to one or more clauses | **Pinned** clauses | The behaviour #549 specified. |

**A quote PDF with no terms is worse than one with the wrong terms.** The empty-parse case is not
theoretical and it must never reach the renderer.

## Part 2 (rider) - preview parity

Carried here per the spec's recommendation: this slice is the smallest and has the headroom, and
leaving the orphan unassigned means the next defect on this document goes unnoticed the same way
these six did.

`PreviewTab` (`ClientQuotesPanel.tsx:1713`) is the screen an estimator checks **before sending**. Its
cost-line map at `:1748-1752` diverges from the PDF on **three** axes:

| Axis | Preview today | PDF (`quote-pdf.service.ts:88-99`) |
|---|---|---|
| Hidden lines | ignores `isVisible` - renders everything | `.filter((l) => l.isVisible)` (`:91`) |
| Amount | raw `l.price` (`:1750`) | `approp ? approp.displayedAmount : toNum(l.price)` (`:99`) |
| Description | `l.description` (`:1750`) | `l.displayDescription` (`:98`) |

Bring the preview onto the PDF's rules. Everything it needs is already in scope on the web side:
`LineAppropriation` is declared at `ClientQuotesPanel.tsx:102` and `summary.lineAppropriations` at
`:111`, and the editor rows already use it at `:995-1012`. Use the same
`summary.lineAppropriations?.find((a) => a.lineId === l.id)` lookup so the preview and the editor
cannot drift either.

Text only - **do not restyle, re-order or re-lay-out the preview.** The screen as-built mock-up is
the reference for everything you are not changing.

## Verification - put these in the PR body

- [ ] `pnpm build`, `pnpm lint`, and `pnpm --filter @project-ops/web test` green, with before/after
      test counts.
- [ ] `quote-issued-terms.spec.ts` covers **all four** rows of the fallback ladder. Quote each
      assertion.
- [ ] One test proves the round trip end to end: pin document A, edit the T&Cs to create version B,
      re-render the sent quote, assert the PDF HTML still contains a clause heading unique to A.
- [ ] `parseDefaultClauses()` output is byte-identical before and after the refactor. Assert it.
- [ ] The **tender-level** export still resolves live clauses - `estimate-export.service.ts` behaviour
      unchanged for the no-quote path. Say how you proved it.
- [ ] `quotePreviewParity.test.tsx`: a hidden line is absent from the preview; an appropriated line
      shows `displayedAmount` and not `price`; a line with a `displayDescription` shows it.
- [ ] Both themes checked for the preview change. Every colour comes from a token; grep the diff for
      hex literals and report the count. `var(--token, #fallback)` counts as a hex literal.

## Do NOT

- Do **NOT** change `quote-send.service.ts`. The write side is correct and already shipped; this
  slice is the read side.
- Do **NOT** make an unsent quote render pinned terms. A draft reflects current terms, on purpose.
- Do **NOT** render an empty T&C section under any circumstance. See the fallback ladder.
- Do **NOT** add a JSON clauses column to `CompanyLegalDocument` or otherwise touch
  `apps/api/prisma/**`. The prose column parses; that is the whole point of Part 1.
- Do **NOT** wire `Contract.issuedTermsDocumentId` (`schema.prisma:4385`, written at
  `contracts.service.ts:177`). Same defect, different document, different slice.
- Do **NOT** redesign the quote PDF, and do **NOT** re-introduce an in-page header - PR #223
  (`d3cf0851`) removed one because it doubled against Puppeteer's `headerTemplate`, and the scar
  comment is still at `quote-html.builder.ts:157`. If you touch the header or footer templates at
  all, remember they render in an isolated context that cannot see the page's `@font-face` rules
  (`:122-133`), which is why they are already Helvetica (`:832`, `:846`) - **no Outfit, no Syne**.
- Do **NOT** consolidate the four duplicated PDF stylesheets (`quote-html.builder.ts`,
  `sor-client-pdf.builder.ts`, `forms/pdf/submission-html.builder.ts`,
  `reporting/reporting-export.service.ts`). Out of scope for every QPDF slice.
- Do **NOT** touch the rates catalogue model.
- Do **NOT** touch `/sot/`, Azure/Entra/SharePoint, or any file outside `scope`.

Title the PR `fix(client-quotes): render the T&C version pinned at issue, and fix preview parity`.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

`escalates: true` - this changes which legal terms print on a document that leaves the company. The
spec proposed `false` on the grounds that it completes a signed-off decision (#549); the standing
rule that anything altering what a client-facing document says is Marco's to merge is the stronger
one. It gates the MERGE, not the RUN. Open the PR and leave it unmerged.

## Guardrails

- One attempt. If the premise is already satisfied on main, say `NO-OP: premise already satisfied`
  and exit.
- **Check the clause-payload shape in your first ten minutes, not your last.** Part 1 above says what
  is on disk today; verify it still holds before building on it.
- Never exit silently. Say `NO-OP: <reason>` loudly if you cannot finish - a silent exit is read as
  success by the watcher, which is the worst outcome.
- **Never ask a question or "stand by" for approval.** There is no human in this run. A dismissed or
  unanswered question is the absence of a human, not a stop signal: proceed on best judgement and
  record the assumption in the PR body.
- Read the CI job log (`gh run view <run-id> --log`) before diagnosing any failure.
