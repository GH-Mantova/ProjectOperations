---
premise: 'grep -q "DISCIPLINES = \\[\"DEM\", \"CIV\", \"ASB\", \"Other\"\\]" apps/api/src/modules/tendering/dto/scope-of-works.dto.ts'
premise_means: The discipline list is duplicated across five files that do not import from the canonical one.
scope:
  - apps/api/src/modules/tendering/dto/scope-of-works.dto.ts
  - apps/api/src/modules/estimate-export/estimate-export.service.ts
  - apps/web/src/pages/tendering/scope-cards/utils/card-display.ts
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/directory/SubcontractorRatesTab.tsx
  - apps/api/src/modules/personas/definitions/__tests__/disciplines-single-source.spec.ts
done_when: pnpm build && pnpm lint && grep -q "disciplines-single-source" apps/api/src/modules/personas/definitions/__tests__/disciplines-single-source.spec.ts
size: 6
gate_allow: none
seed_only: false
escalates: true
cluster: scope-subcontracted
cluster_order: 1
---

# One discipline list, not five

## The problem, precisely

`IS_DISCIPLINE_CODES` in `apps/api/src/modules/personas/definitions/disciplines.ts` declares itself
the source of truth, and its own header tells every consumer to import from it. Four other files
declare the same tuple independently and do not:

| File | Declaration |
|---|---|
| `tendering/dto/scope-of-works.dto.ts` | `DISCIPLINES` — drives DTO validation |
| `estimate-export/estimate-export.service.ts` | `DISCIPLINE_ORDER` — drives the Excel summary |
| `web .../scope-cards/utils/card-display.ts` | `DISCIPLINE_CODES` — header concedes the drift |
| `web .../directory/SubcontractorRatesTab.tsx` | a fifth copy, commented "four codes only" |

Adding a fifth code to one and not the others is the trap this slice removes. It ships **before**
the code is added, so the next slice is a one-line change instead of a five-file hunt.

## What to build

1. Point all four duplicates at `IS_DISCIPLINE_CODES`. Where a file needs a different shape
   (an ordering, a label map, a colour map), derive it from the canonical tuple rather than
   restating the codes.
2. **`estimate-export.service.ts:18`** — `DISCIPLINE_LABEL` is typed `Record<string, string>`, so a
   missing key yields `undefined` with no compile error and the Excel Scope column renders blank.
   Retype it against the canonical union so a missing label is a build failure.
3. **A guard spec** at
   `apps/api/src/modules/personas/definitions/__tests__/disciplines-single-source.spec.ts` that
   fails if any of the four files reintroduces a literal discipline tuple. Assert the invariant, so
   the sixth copy is caught rather than the fifth.

## Do NOT

- Do not add a new discipline code in this slice. Consolidation only.
- Do not change any discipline's behaviour, ordering, label text or colour.
- Do not touch `schema.prisma` — `discipline` is a plain string column and stays one.
- Do not touch `/sot/`.

## VERIFY

- `pnpm build`, `pnpm lint`, `pnpm --filter @project-ops/api test:serial`,
  `pnpm --filter @project-ops/web test` all green.
- State in the PR body that no behaviour changed: the same four codes, in the same order.

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
