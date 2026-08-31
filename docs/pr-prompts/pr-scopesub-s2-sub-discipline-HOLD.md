---
premise: '! grep -q "\"Other\", \"SUB\"" apps/api/src/modules/personas/definitions/disciplines.ts'
premise_means: There is no Subcontracted-price discipline; work handed to a subcontractor has nowhere to live.
scope:
  - apps/api/src/modules/personas/definitions/disciplines.ts
  - apps/api/src/modules/tendering/scope-item-pricing.ts
  - apps/api/src/modules/tendering/scope/card-defaults.ts
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/estimate-export/excel/estimate-excel.builder.ts
  - apps/web/src/constants/disciplines.ts
  - apps/api/src/modules/personas/definitions/__tests__/disciplines-single-source.spec.ts
  - apps/api/src/modules/tendering/__tests__/sub-discipline.spec.ts
done_when: pnpm build && pnpm lint && grep -q "\"Other\", \"SUB\"" apps/api/src/modules/personas/definitions/disciplines.ts && grep -q "\"Other\", \"SUB\"" apps/web/src/constants/disciplines.ts
size: 8
gate_allow: none
seed_only: false
escalates: true
cluster: scope-subcontracted
cluster_order: 2
requires_on_main: 'apps/api/src/modules/personas/definitions/__tests__/disciplines-single-source.spec.ts :: disciplines-single-source'
---

# SUB — the Subcontracted price discipline

## What it is

A fifth discipline holding scope handed to a subcontractor, priced against the quote received.
Approved mock-up: `https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

A subcontracted line either **describes its own scope** or **links to a WBS item on another tab**.
A linked item stops carrying its own manpower and plant into the price and shows "priced on
SUB1.1" in its place — so the same work is never counted twice. A line holds every quote received,
one selected, the rest visible with their delta.

**No database migration is needed.** `ScopeCard.discipline` is `TEXT NOT NULL` with no enum and no
CHECK constraint, and the only index is `UNIQUE(tender_id, discipline, card_number)`, which is
additive — SUB cards get their own numbering space.

## The two silent failures — write the failing test first for both

Adding the code makes these fire. Neither errors; both produce plausible, wrong output.

1. **`scope-item-pricing.ts:25`** — `DEFAULT_ROLE_BY_DISCIPLINE` is a `Record<Discipline, string>`.
   `buildRateMaps` does `const role = DEFAULT_ROLE_BY_DISCIPLINE[d]`, so an unmapped code yields
   `undefined`, `labourRateByDiscipline` gets no entry, and **every SUB line prices labour at $0
   with no error.** SUB lines carry no in-house labour by design, so the correct fix is an explicit
   entry that makes that intent readable — not a silent gap.
2. **`estimate-excel.builder.ts:104`** — the summary loop iterates `DISCIPLINE_ORDER` and
   accumulates `grandTotal`. A code absent from that tuple has its rows printed in Scope Detail but
   **excluded from the total**, so the export shows line items that do not add up to the printed
   figure.

Note `estimate-excel.builder.ts:105`'s `if (disc === "Other") continue;` is **deliberate** — Other
is a provisional sum and prints below the total in its own block. Marco ruled (31 Aug) that
subcontracted work is **not** provisional by default, so SUB belongs inside `grandTotal`. Whether an
individual line is provisional is the next slice; this one places SUB in the total.

## What to build

1. `IS_DISCIPLINE_CODES` gains `"SUB"`, with its label and description. The compiler will name
   every `Record<IsDisciplineCode, …>` that now needs an entry — that is the point of the type.
2. `card-defaults.ts` gains a SUB default; its import-time guard loops the canonical codes and will
   otherwise fail the API at boot, which is the intended loud failure.
3. `ROW_TYPES_BY_DISCIPLINE` gains a SUB entry.
4. `DEFAULT_ROLE_BY_DISCIPLINE` gains an explicit SUB entry.
5. `DISCIPLINE_ORDER` gains SUB so it reaches the Excel summary and `grandTotal`.

6. **`apps/web/src/constants/disciplines.ts` gains `"SUB"` too — this is the one the compiler
   cannot catch for you.** Slice 1 could not make the web import from the API module (no shared
   runtime package), so it created a second canonical tuple for the web app and said so in that
   file's header. There are therefore **two** tuples, not one, and TypeScript cannot see across the
   package boundary. Add SUB to the API tuple alone and the build stays green, the API prices SUB
   correctly, and **the tab never appears in the UI** — a silent half-landing with no error
   anywhere. Add its label to `IS_DISCIPLINE_LABELS` in the same file.

7. **Close the hole rather than stepping around it.** Extend
   `apps/api/src/modules/personas/definitions/__tests__/disciplines-single-source.spec.ts` with an
   assertion that the API and web tuples contain **exactly the same codes in the same order**. That
   spec already reads both files from the repo root and already names both as canonical in its
   header; it just never checks they agree. Without this, the next code added to one and not the
   other repeats this exact bug, and nothing fails.

8. Spec at `apps/api/src/modules/tendering/__tests__/sub-discipline.spec.ts` with a failing-first
   case for each of the two silent failures above, plus one asserting a SUB card round-trips.

## Do NOT

- Do not add a migration; the column already accepts any string.
- Do not build the linked-item or multi-quote UI in this slice — this is the discipline itself.
- Do not add the priced/provisional flag; that is the next slice.
- Do not change how Other is treated.
- Do not touch `/sot/`.

## VERIFY

- Both new specs fail on the current head and pass after — state both in the PR body.
- An export of a tender with a SUB card: its rows appear in Scope Detail AND its money is inside
  the Summary total. Quote the two figures in the PR body.
- **Confirm in the PR body that SUB is present in BOTH tuples**, naming both file paths, and that
  the parity assertion fails when you remove SUB from either one. A build that passes with SUB in
  only one of them is the exact defect this slice was amended to prevent.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if you cannot proceed, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the job log before diagnosing any CI failure.
- `escalates: true` gates the MERGE, not the RUN. Open the PR; Marco removes `do-not-merge`.
