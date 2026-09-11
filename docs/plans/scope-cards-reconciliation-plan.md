---
title: Scope Cards reconciliation plan
stamped_utc: 2026-09-11T01:26Z
origin_main_sha: 7b1ba03a
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
spec_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
source_of_truth: The Claude artifacts above are the source. This file is the on-main copy so an agent can act on the decisions without reading a private chat.
---

# Scope Cards reconciliation plan (SLICE-0)

**Stamped:** 2026-09-11T01:26Z against `origin/main` SHA `7b1ba03a`.
**Design ref:** the Discipline Cards mock-up (version 24) at
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035` — mock-up **and**
spec.
**Source of truth:** the Claude artifact above **is** the source. Neither this file nor
the ten slice prompts under `docs/pr-prompts/` re-open its decisions; they carry them onto
`main` in a form an agent can act on.

This slice writes no code. Ten code slices chain behind it. Once this file is on `main`,
S1-S10 are authored from it in order — never from a conversation that no other station can
read.

## 1. The governing rule

> The mock-up is the standard. Where the repo and the mock-up disagree, the work is to
> bring the repo to the mock-up — not to defend what shipped. The one exception is where
> the mock-up is SILENT: it has no stage/concurrency model, so the shipped stage rule in
> `packages/.../discipline-rollup.ts` stands (peak crew MAX across cards, durations SUM).

Silence is a decision only where the mock-up is silent. Where it disagrees with the repo,
the repo moves.

## 2. The decisions already taken (Marco, 2026-09-10)

| Decision | Ruling |
|---|---|
| Subcontracted work | Nothing is auto-zeroed. A subbie quote may be extra work or a price comparison, so every line keeps pricing. |
| Where a line goes | Not a tick — a **destination**. One of four: In the price, Provisional, Cost option, Internal only. Default: In the price. Every line prices whatever its destination; the destination decides only where the money lands. |
| Internal only | Leaves the money AND the programme. Its crew, plant, person-days and duration are excluded from the card and discipline figures. The "we do it but don't itemise it" case is *In the price* with the line hidden on the quote (`QuoteCostLine.isVisible`, already shipped). One meaning per control. |
| Hiding a line | Never in a drawer. Whatever its destination the row stays in place on the card, greyed and railed — a comparison you cannot see is not a comparison. |
| Existing tenders | Reprice on merge. No pre-flight list. |
| Operational costs | Must count toward the tender price. `days` multiplies into the line total. |
| Charge-step formulas | Authored in Rates & Lists; the tender **embeds the copy it used**. A catalogue edit can never move a locked tender. |
| Card name | Stays one field. The name is the description. |
| Markup | Per line on all four line types, not just card level. |
| Truck cycle | 30 min at the tip. `cycle = (travel x 2) + 0.5h`; `loads/day = floor(8h / cycle)`. A 45-min drive gives 4 loads. |
| Distance | Actual truck travel time, averaged normal vs peak. Straight-line survives only as an automatic fallback, badged — never as a control. |
| Shift length | 8 h, job site to tip, **for loads-per-day only**. This figure must not reach any other calculation. |
| Transport capacity | Matrix by (material class x transport type). A per-line override stays local and never writes back to the table. |
| Night / weekend cutting | Entered under *other-rate* — those rows already exist. The Shift column comes out regardless; the mock-up sets the column set. |
| Discipline duration | Keeps the shipped stage rule. The mock-up is silent on concurrency. |

These fifteen rulings are Marco's. This plan records them as given; it does not re-decide
them. Any station that finds one of them wrong opens a labelled `OPEN QUESTION` heading
in this file and carries on — the ruling stands until it is replaced by another one from
Marco.

## 3. The ten slices, in three independent chains

```
money    S1 -> S2 -> S3 -> S10
haulage  S5 -> S7
cutting  S9 -> S4 -> S6
anytime  S8
```

The three chains are independent — no arrow crosses between them. `S8` sits outside all
three and can be authored at any point. The authoring station picks up S1, S5, S9 and S8
first (no predecessors); the rest arm only when the arrow above them has landed.

| Slice | Title | Size | Depends on | Premise | Scope | Acceptance |
|---|---|---|---|---|---|---|
| S1 | Operational costs become money | 6 | — | `apps/api/src/modules/estimating/tender-price.service.ts` has no operational-costs bucket, so `days` never multiplies into the line total. | `apps/api/src/modules/estimating/**`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, `apps/api/src/modules/estimating/__tests__/**` | New `operationalCosts` bucket on `tenderPrice`; line total = `qty * days * rate`; `wbsRef`, `markupOverride`, `notes` columns land on the model; migration named for the slice; unit test covers `days > 1` and the null-`days` fallback (`1`). |
| S2 | Where a line goes — one destination, four values | 7 | S1 | `isProvisional: boolean` on the four line types cannot express Internal only or Cost option, and Rule A ("subbie quotes zero out") still fires. | `apps/api/prisma/schema.prisma`, `apps/api/src/modules/estimating/**`, `apps/api/src/modules/discipline-rollup/**`, `apps/web/src/features/estimating/**` | New `quoteDestination` enum (`IN_PRICE`, `PROVISIONAL`, `COST_OPTION`, `INTERNAL_ONLY`) on all four line types; `isProvisional` migrated into it; Rule A deleted with its tests; `INTERNAL_ONLY` filtered **before** override resolution in `discipline-rollup.ts`; the card header reports how many lines were left out. |
| S3 | Per-line markup on every line type | 5 | S1 | `markupOverride` exists only on labour and plant lines, so waste and cutting lines cannot be marked up per-line. | `apps/api/prisma/schema.prisma`, `apps/api/src/modules/estimating/pricing/**`, `apps/api/src/modules/estimating/__tests__/**` | `markupOverride` column on waste and cutting lines; one resolution order documented and enforced (`line override` -> `card override` -> `discipline default` -> `company default`); a stored `0` is a real override (not "no override"); test asserts `0` overrides a non-zero default. |
| S4 | Cutting aligned to the mock-up | 5 | S9 | The cutting scope card carries a `Shift` column the mock-up does not, and the mock-up's column set (blade, depth, linear metres) is missing. | `apps/web/src/features/estimating/scope-cards/CuttingCard.tsx`, its stories, and the read-side query that feeds it | Column set matches the mock-up; the `Shift` column is removed from `CuttingCard.tsx`; night/weekend cutting continues to be entered as an *other-rate* row (untouched); storybook covers the mock-up's five column variants. |
| S5 | Haulage on real travel time | 8 | — | The waste panel derives `loads/day` from straight-line distance, which the mock-up removes. Routing travel time exists (`apps/api/src/modules/routing/**`) and is unread by the estimator. | `apps/api/src/modules/estimating/waste/**`, `apps/api/src/modules/routing/**`, `apps/web/src/features/estimating/waste/**` | Cycle time from the routing service; `cycle = (travel x 2) + 0.5h`; `loads/day = floor(8h / cycle)`; straight-line only when routing returns no result, badged in the UI; test covers the 45-minute drive → 4 loads case; no straight-line **toggle** anywhere in the UI. |
| S6 | One cutting surface, one cutting total | 7 | S4 | Three components (`CuttingCard.tsx`, `TenderSummary.tsx`, the pricing service) compute cutting total three different ways. | `apps/web/src/features/estimating/**`, `apps/api/src/modules/estimating/**` | One source of truth for the cutting total (the pricing service); the card and summary read from it; a unit test asserts the three surfaces agree for a fixture with two cutting lines. |
| S7 | Transport capacity matrix wired up | 4 | S5 | Rate table `rt-tc` is seeded (`apps/api/prisma/seed/**`) and read by nothing. | `apps/api/src/modules/estimating/waste/**`, `apps/api/prisma/seed/**` | The waste service resolves capacity from `rt-tc` keyed by `(materialClass, transportType)`; a per-line override applies to the line only and never writes back to the table; a test asserts the write-back does not happen. |
| S8 | Card name affordance | 2 | — | The card description is a read-only heading. | `apps/web/src/features/estimating/scope-cards/**` | The card name is an inline-editable field; still one field; edit persists via the existing update mutation; storybook covers the editing and saved states. |
| S9 | Charge steps reach the price | 7 | — | `RateTable.chargeSteps` and `apps/api/src/modules/rates/rate-step-evaluator.ts` exist and are unplugged. | `apps/api/src/modules/estimating/pricing/**`, `apps/api/src/modules/rates/**` | Cutting price resolves through the step evaluator; the tender **embeds** the formula copy it used at price time (`QuoteCostLine.formulaSnapshot` or equivalent already-planned column); a catalogue edit made after price time does not move the tender; test locks a tender, edits the catalogue, re-reads and asserts the number holds. **Must land before S4 and S6.** |
| S10 | The push to the quote routes by destination | 6 | S2 | `QuoteProvisionalLine` and `QuoteCostOption` have no back-pointer to the source card line, so re-pushing duplicates instead of moving. | `apps/api/prisma/schema.prisma`, `apps/api/src/modules/quoting/**`, `apps/api/src/modules/estimating/**` | Source pointer column (`sourceLineId`, `sourceLineType`) on both quote tables; the push routes by `quoteDestination`; a re-push moves the row between tables (not duplicates); the letter (`Opt A`, `B`, `C`) is written into `QuoteCostOption.label` at push time; a test asserts issuing a quote after removing Option A leaves the client-facing letter unchanged. |

The authoring station reads this table to write the per-slice prompts. It must not invent
a different order. It must not merge two slices into one prompt. Cross-chain parallel
work is fine; within a chain, the arrow is binding.

## 4. Where following the mock-up literally would break something

Marco asked for this check to be owned and reported before any PR. Nine rows.

| Mock-up shows | Why it breaks the ERP | What gets built |
|---|---|---|
| A road / straight-line **toggle** on the waste panel | Puts a straight-line button in front of the estimator — the option Marco asked to remove. | Straight-line survives only as an automatic fallback, badged. No control. |
| `FUEL_PRICE = 2.09` as a constant | The ERP resolves fuel from `OperationsSettings.fuelPricePerLitre`, fed by a price integration. A constant would silently override a live feed. | Read the settings value. The mock-up's number is sample data, never a default. |
| Distance read straight off the tip, no per-day km | `dailyKm` is a typed column and rows already hold values estimators entered by hand. | Derive it, but treat a typed value as an override — suggest, never overwrite. |
| Cutting priced through the mock-up's step engine | Looked like two rival engines. It is one engine plus an unplugged feature. | Settled — S9. |
| Subbies as a flat list of names | The ERP has `SubcontractorSupplier` records with real grouping and links. | Use the real records. |
| Enclosure rates noted as "orphaned from pricing" | They are not — the rate resolver and the AI lookup handler both reach `EstimateEnclosureRate`. They are only absent from the scope card. | Wire them onto the card as an addition, not a repair. |
| **Internal only** excluded from the resource roll-up | `discipline-rollup.ts` carries `peakCrewOverride`, `labourDaysOverride` and `durationOverride`. A tender where a planner typed an override keeps that number, so the exclusion would look like it did nothing. | Filter before the override is applied, not after, and leave a typed override winning. The header states how many lines were left out, so a stale override is visible rather than silent. |
| Cost options lettered **Opt A, B, C** by position on the card | The letter is a label, not an identity. Removing Option A silently renames B to A on a quote that has already gone out. | Letter the card from position, but write the letter into `QuoteCostOption.label` at push time so an issued quote keeps the letter it was issued with. |
| The tender header showing one total with provisional and options beside it | Right for the estimating screen. On the quote it is `ClientQuote.showProvisional` / `showCostOptions` that decide whether the client sees them. | Build the header as drawn. The destination decides the money exists; those two decide whether it prints. |

Each row is a claim about the repo. If a slice author finds the claim wrong — the field
name has drifted, the module has moved — they record the drift in the slice PR body and
adjust the scope, but they do not re-decide the row.

## What this plan is not

- It is not a schema. Column names above are the current ones as of `7b1ba03a`; a slice
  author confirms them at author time and adjusts if the repo has moved.
- It is not a promise about ordering across chains. The three chains are independent by
  design; only the arrow inside a chain is binding.
- It is not editable by anyone except the SoT keeper. If a decision here needs to change,
  the change lands as a doc-reconcile PR that also updates whichever slice prompts are
  still open — never as an in-flight amendment inside a code slice.
