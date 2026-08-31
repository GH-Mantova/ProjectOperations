---
premise: '! grep -q "isProvisional" apps/api/src/modules/tendering/scope-redesign.service.ts'
premise_means: Provisional is a whole-discipline property, so a single line cannot be moved in or out of the tender price.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/tendering/dto/scope-of-works.dto.ts
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/estimate-export/estimate-export.service.ts
  - apps/api/src/modules/estimate-export/excel/estimate-excel.builder.ts
  - apps/api/src/modules/tendering/__tests__/priced-or-provisional.spec.ts
  - apps/api/src/modules/tendering/__tests__/summary-section-markup.spec.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "isProvisional" apps/api/src/modules/tendering/scope-redesign.service.ts && node scripts/data-model/build-relationship-map.mjs --check
size: 8
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: 'Additive only - adds one boolean column (is_provisional) to scope_of_works_items with DEFAULT false, and writes no data. Safe to leave applied if the run dies mid-flight; every existing row reads false, which is exactly current behaviour.'
cluster: scope-subcontracted
cluster_order: 3
requires_on_main: 'apps/api/src/modules/personas/definitions/disciplines.ts :: "SUB"'
---

# Priced or provisional, decided per line

## The decision this implements

Marco ruled on 31 Aug, when asked whether subcontracted work should sit inside the tender price or
below it as a provisional sum:

> "it is a mix between option 1 & 2. User should be able to move it to priced or to provisional on a
> case by case basis"

So provisional stops being a property of a *discipline* and becomes a property of a *line*. It
applies to every discipline, not only SUB — a DEM line the estimator is not yet willing to stand
behind can sit below the total too.

Approved mock-up: `https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035` — the
toggle on each line, the tender price beside `+ provisional $x`, and the SUB bar reading
*in the quote $59,800 · provisional $16,120 · SUB total $75,920*.

## What the code does today, precisely

`estimate-excel.builder.ts:104-105` iterates `DISCIPLINE_ORDER` and skips one hardcoded code:

```
for (const disc of DISCIPLINE_ORDER) {
  if (disc === "Other") continue;
```

Everything it skips is later reprinted, once, in a single orange block below `TOTAL (ex-GST)`, fed
by `payload.summary.Other` (`:129-155`). That is the entire provisional mechanism: **one
discipline, all or nothing.** `scope-redesign.service.ts:866` builds `perDiscipline` the same way —
one bucket per code, no notion of a line being treated differently from its neighbours.

## What to build

1. **Schema.** `ScopeOfWorksItem` gains
   `isProvisional Boolean @default(false) @map("is_provisional")`. Put it directly above the
   existing `provisionalAmount` field so the two read together. Name it `isProvisional` because
   `EstimateItem` (`schema.prisma:2710`) already uses exactly that name and mapping — follow the
   precedent rather than inventing a second spelling. The migration is
   `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT false`. Nothing else.

   Then regenerate the data-model map with `node scripts/data-model/build-relationship-map.mjs` and
   commit the refreshed `docs/data-model/relationship-map.json`, `relationship-map.md` and
   `metadata-catalog.json` **in this PR**. The CI drift check hard-fails a schema change that
   leaves the map stale, and you will have exited before CI runs — so do it up front, not
   fix-forward. Put `GATE-ALLOW: migrations` bare at column 0 of the PR body; CP-11 hard-fails an
   undeclared migration and does not match a heading form.

2. **Do not migrate the meaning of `Other`.** Existing Other-discipline rows keep printing in the
   provisional block. The rule the summary applies is: a line is provisional if
   `item.isProvisional === true` **or** its discipline is `Other`. That is why `backfill: false` is
   honest here — no row needs rewriting for the old behaviour to survive.

3. **Summary.** `perDiscipline` buckets gain `provisionalSubtotal` / `provisionalWithMarkup`
   alongside the existing pair, and a provisional line adds to those instead of to `subtotal` /
   `withMarkup`. `tenderPrice` keeps summing the priced side only. Add a sibling `provisionalTotal`.
   Markup still resolves per card exactly as it does now — provisional does not mean unmarked-up.

4. **Export payload.** `estimate-export.service.ts:333` hand-writes `summaryTyped` with four literal
   discipline keys, `:384` repeats them in the returned `summary` literal, and `discBucket` reads
   three fields. Extend all three. After cluster slice 1 the key list is derived, not literal — do
   not reintroduce a hardcoded tuple here.

5. **Excel.** The main loop prints `withMarkup` (priced only) and accumulates `grandTotal` from it.
   The block below the total prints the summed provisional side across **all** disciplines, keeping
   its orange fill and italic font. Relabel it `Provisional / Other` — it is no longer only Other.

6. **DTO.** `isProvisional` is an optional boolean on the scope-item create/update DTOs, defaulting
   false. No new endpoint; it rides the existing item save.

7. **Repair the spec the summary shape breaks.**
   `apps/api/src/modules/tendering/__tests__/summary-section-markup.spec.ts` asserts on the bucket
   objects `summary()` returns. Adding two fields to every bucket breaks its equality assertions.
   Update the expected objects in this PR — a service-shape change that leaves its own spec stale
   fails the API test job, and that is the failure mode that sank #595.

8. **New spec** at `apps/api/src/modules/tendering/__tests__/priced-or-provisional.spec.ts`, three
   cases:
   - a tender with one priced and one provisional DEM line — `tenderPrice` excludes the second,
     `provisionalTotal` equals it, and the two sum to the old single figure;
   - an Other-discipline row with `isProvisional` false still lands in the provisional block
     (the regression this slice most easily causes);
   - flipping one line changes `tenderPrice` and nothing else.

## Do NOT

- Do not remove the `if (disc === "Other") continue;` behaviour for Other rows; widen the rule, do
  not replace it.
- Do not touch `provisionalAmount` or its "discipline=Prv only" semantics — that is a separate
  legacy path and this slice does not adjudicate it.
- Do not apply a different markup to provisional lines.
- Do not add the flag to cutting or waste items; those are section streams with their own markup
  and are out of scope here.
- Do not touch `/sot/`.

## VERIFY

- `node scripts/data-model/build-relationship-map.mjs --check` prints OK on your branch before you
  open the PR.
- The three new cases fail on the current head and pass after — state that in the PR body.
- Export one tender twice, once with a line priced and once provisional, and quote both
  `TOTAL (ex-GST)` figures plus the provisional block figure in the PR body. The three must
  reconcile: priced total + provisional = the figure the same tender exported before this PR.

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
