---
title: Scope Cards reconciliation plan
stamped_utc: 2026-09-15T01:05Z
origin_main_sha: 4ea0c1b6
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
spec_ref: https://claude.ai/code/artifact/fe418fc1-9fe1-46c6-a94b-5403336a5c74
quote_ref: https://claude.ai/code/artifact/ecf96dc3-7515-4398-ba2c-5cd7ffa1b8dd
source_of_truth: The Claude artifacts above are the source. This file is the on-main copy so an agent can act on the decisions without reading a private chat.
reconciled: 2026-09-15 — one merging chain, slices renumbered S1-S9, old S10a retired as already shipped, old S8 folded into S3; see section 5. (2026-09-14 — S10 rewritten and split to the quote model Marco ruled on 2026-09-11.)
---

# Scope Cards reconciliation plan (SLICE-0)

**Stamped:** 2026-09-11T01:26Z against `origin/main` SHA `7b1ba03a`; **reconciled**
2026-09-14 against `a6ee23b3` and 2026-09-15 against `4ea0c1b6` (section 5).
**Design ref:** the Discipline Cards mock-up (version 26) at
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035` — mock-up **and**
spec. Its output side — the Quote tab receiving the four destinations and the printed page
— is the Quote Destinations mock-up (2026-09-11) at
`https://claude.ai/code/artifact/ecf96dc3-7515-4398-ba2c-5cd7ffa1b8dd`. The slice-by-slice
spec both are reconciled through is
`https://claude.ai/code/artifact/fe418fc1-9fe1-46c6-a94b-5403336a5c74`.
**Source of truth:** the Claude artifacts above **are** the source. Neither this file nor
the slice prompts under `docs/pr-prompts/` re-open their decisions; they carry them onto
`main` in a form an agent can act on.

This slice writes no code. Nine code slices chain behind it, in one merging order (Marco,
2026-09-15). Once this file is on `main`, S1-S9 are authored from it in that order — each
prompt gated on the previous slice's marker being on `main` — never from a conversation
that no other station can read.

## 1. The governing rule

> The mock-up is the standard. Where the repo and the mock-up disagree, the work is to
> bring the repo to the mock-up — not to defend what shipped. The one exception is where
> the mock-up is SILENT: it has no stage/concurrency model, so the shipped stage rule in
> `packages/.../discipline-rollup.ts` stands (peak crew MAX across cards, durations SUM).

Silence is a decision only where the mock-up is silent. Where it disagrees with the repo,
the repo moves.

## 2. The decisions already taken (Marco, 2026-09-10 and 2026-09-11)

| Decision | Ruling |
|---|---|
| Subcontracted work | Nothing is auto-zeroed. A subbie quote may be extra work or a price comparison, so every line keeps pricing. |
| Where a line goes | Not a tick — a **destination**. One of four: In the price, Provisional, Cost option, Internal only. Default: In the price. Every line prices whatever its destination; the destination decides only where the money lands. |
| Internal only | Leaves the money AND the programme. Its crew, plant, person-days and duration are excluded from the card and discipline figures, and it never reaches the quote. The "we do it but don't itemise it" case is *In the price*, printed as **one line with its group** on the quote (Marco, 2026-09-11) — **not** a hidden line: on the quote an unticked line is out of the sum, so hiding is no longer a way to keep money in the total. One meaning per control. *(Corrected 2026-09-14; the 2026-09-11 text said "hidden on the quote via `QuoteCostLine.isVisible`".)* |
| The quote tick (2026-09-11) | Every priced line arrives on the quote **one for one**, grouped by discipline — SUB included, a cutting line inside the discipline that owns its card, the per-discipline aggregate seed gone. The estimator decides, from everything priced, what stays in this quote and what it is called. **An unticked line is not part of the sum**: `QuoteCostLine.isVisible` removes the amount from `clientFacingTotal` (closes finding W5). The estimator's `displayDescription` is never overwritten by a re-push. |
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

These sixteen rulings are Marco's. This plan records them as given; it does not re-decide
them. Any station that finds one of them wrong opens a labelled `OPEN QUESTION` heading
in this file and carries on — the ruling stands until it is replaced by another one from
Marco.

## 3. The nine slices, in one merging chain

```
S1 -> S2 -> S3 -> S4 -> S5 -> S6 -> S7 -> S8 -> S9
```

One chain (Marco, 2026-09-15): each slice is gated on the previous slice's marker being on
`main`, whether or not it needs it functionally. The order keeps every arrow the 2026-09-10
plan drew — money (S1 → S2 → S3 → S4), then cutting with the steps wired first (S5 → S6 →
S7), then haulage (S8 → S9). Renumbered 2026-09-15; the *was* column maps to the 2026-09-10
numbers that the mock-up, the spec artifact and older receipts still use. Old S10a is
retired (section 5); old S8 (card-name affordance, size 2) is folded into S3 because both
touch the card chrome.

| Slice | was | Title | Size | Depends on | Premise | Scope | Acceptance |
|---|---|---|---|---|---|---|---|
| S1 | S1 | Operational costs become money | 6 | — | `apps/api/src/modules/estimating/tender-price.service.ts` has no operational-costs bucket, so `days` never multiplies into the line total. | `apps/api/src/modules/estimating/**`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, `apps/api/src/modules/estimating/__tests__/**` | New `operationalCosts` bucket on `tenderPrice`; line total = `qty * days * rate`; `wbsRef`, `markupOverride`, `notes` columns land on the model; migration named for the slice; unit test covers `days > 1` and the null-`days` fallback (`1`). |
| S2 | S2 | Where a line goes — one destination, four values | 7 | S1 | `isProvisional: boolean` on the four line types cannot express Internal only or Cost option, and Rule A ("subbie quotes zero out") still fires. | `apps/api/prisma/schema.prisma`, `apps/api/src/modules/estimating/**`, `apps/api/src/modules/discipline-rollup/**`, `apps/web/src/features/estimating/**` | New `quoteDestination` enum (`IN_PRICE`, `PROVISIONAL`, `COST_OPTION`, `INTERNAL_ONLY`) on all four line types; `isProvisional` migrated into it; Rule A deleted with its tests; `INTERNAL_ONLY` filtered **before** override resolution in `discipline-rollup.ts`; the card header reports how many lines were left out. |
| S3 | S3 + S8 | Per-line markup on every line type, and the card-name affordance | 6 | S2 (chain; needs S1) | `markupOverride` exists only on labour and plant lines, so waste and cutting lines cannot be marked up per-line. The card description is a read-only heading. | `apps/api/prisma/schema.prisma`, `apps/api/src/modules/estimating/pricing/**`, `apps/api/src/modules/estimating/__tests__/**`, `apps/web/src/features/estimating/scope-cards/**` | `markupOverride` column on waste and cutting lines; one resolution order documented and enforced (`line override` -> `card override` -> `discipline default` -> `company default`); a stored `0` is a real override (not "no override"); test asserts `0` overrides a non-zero default. Card name (old S8): The card name is an inline-editable field; still one field; edit persists via the existing update mutation; storybook covers the editing and saved states. |
| S4 | S10b | The push routes by destination, one row per line | 6 | S3 (chain; needs S2) | The push seeds once at quote creation, one cost line per discipline from `ScopeRedesignService.summary().withMarkup` (walks `["DEM","CIV","ASB"]` plus cutting, skips SUB); it cannot put a line anywhere but the cost summary; and `QuoteProvisionalLine` / `QuoteCostOption` have no back-pointer to the source line, so re-pushing appends twins instead of moving. | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`, `apps/api/src/modules/client-quotes/**`, `apps/api/src/modules/estimating/**`, the Quote tab editor (`ClientQuotesPanel.tsx`, `QuoteTab.tsx`) | `sourceEstimateLineType` + `sourceEstimateLineId` on `QuoteProvisionalLine` and `QuoteCostOption`, mirroring `QuoteCostLine` exactly (names, nullability, index); the push writes **one row per estimate line** routed by `quoteDestination` — in-the-price lines as `QuoteCostLine` in a discipline group (SUB included; a cutting line inside the discipline that owns its card; the per-discipline seed goes), provisional and option lines on their tabs, internal lines never cross; a re-push is an upsert on the pointer — a line that changed destination **moves** in one transaction, rows typed on the quote (no pointer) are never touched; a re-push never overwrites a typed `displayDescription` or an `overrideAmount` (amber "quote ≠ estimate" chip until cleared); `QuoteCostOption.label` frozen at push, a new option takes the **next unused letter on the quote**; per-group print mode itemised (default) / one line — `ClientQuote.groupPrintModes Json` or a `QuoteCostGroup` row, **shape is Marco's call** — read by the PDF builder, money unchanged; a push panel on the Cost Summary editor whose Re-push shows the diff (move / recompute / kept override / withdrawal) before Apply; a line gone `INTERNAL` or deleted on the estimate is **withdrawn** loudly with its amount; the *Left off this quote* strip is a live read of the estimate, never stored, never printed; `ClientQuote.status !== "DRAFT"` refuses with **409** and the push never mints a revision; `showProvisional` / `showCostOptions` still govern printing. Tests: one line per destination → three rows in three tables with pointers; option → provisional re-push leaves one row; → internal leaves none and reports it; delete Option A on the card → the quote's B stays B, a new option is C; re-push on SENT → 409, nothing written; a one-line SUB group prints $75,920.00 as one row with the total unchanged. The Cost Summary editor shows *In this quote* beside *Priced on the estimate − unticked* (moved here from retired S10a). |
| S5 | S9 | Charge steps reach the price | 7 | S4 (chain only) | `RateTable.chargeSteps` and `apps/api/src/modules/rates/rate-step-evaluator.ts` exist and are unplugged. | `apps/api/src/modules/estimating/pricing/**`, `apps/api/src/modules/rates/**` | Cutting price resolves through the step evaluator; the tender **embeds** the formula copy it used at price time (`QuoteCostLine.formulaSnapshot` or equivalent already-planned column); a catalogue edit made after price time does not move the tender; test locks a tender, edits the catalogue, re-reads and asserts the number holds. **Must land before S6 and S7 (cutting).** |
| S6 | S4 | Cutting aligned to the mock-up | 5 | S5 | The cutting scope card carries a `Shift` column the mock-up does not, and the mock-up's column set (blade, depth, linear metres) is missing. | `apps/web/src/features/estimating/scope-cards/CuttingCard.tsx`, its stories, and the read-side query that feeds it | Column set matches the mock-up; the `Shift` column is removed from `CuttingCard.tsx`; night/weekend cutting continues to be entered as an *other-rate* row (untouched); storybook covers the mock-up's five column variants. |
| S7 | S6 | One cutting surface, one cutting total | 7 | S6 | Three components (`CuttingCard.tsx`, `TenderSummary.tsx`, the pricing service) compute cutting total three different ways. | `apps/web/src/features/estimating/**`, `apps/api/src/modules/estimating/**` | One source of truth for the cutting total (the pricing service); the card and summary read from it; a unit test asserts the three surfaces agree for a fixture with two cutting lines. |
| S8 | S5 | Haulage on real travel time | 8 | S7 (chain only) | The waste panel derives `loads/day` from straight-line distance, which the mock-up removes. Routing travel time exists (`apps/api/src/modules/routing/**`) and is unread by the estimator. | `apps/api/src/modules/estimating/waste/**`, `apps/api/src/modules/routing/**`, `apps/web/src/features/estimating/waste/**` | Cycle time from the routing service; `cycle = (travel x 2) + 0.5h`; `loads/day = floor(8h / cycle)`; straight-line only when routing returns no result, badged in the UI; test covers the 45-minute drive → 4 loads case; no straight-line **toggle** anywhere in the UI. |
| S9 | S7 | Transport capacity matrix wired up | 4 | S8 | Rate table `rt-tc` is seeded (`apps/api/prisma/seed/**`) and read by nothing. | `apps/api/src/modules/estimating/waste/**`, `apps/api/prisma/seed/**` | The waste service resolves capacity from `rt-tc` keyed by `(materialClass, transportType)`; a per-line override applies to the line only and never writes back to the table; a test asserts the write-back does not happen. |

The authoring station reads this table to write the per-slice prompts, one at a time, in
this order. It must not invent a different order and must not merge two slices into one
prompt. Every prompt's `requires_on_main` is the previous slice's marker; the arrow is binding.

## 4. Where following the mock-up literally would break something

Marco asked for this check to be owned and reported before any PR. Thirteen rows — nine
from the cards (2026-09-10), four from drawing the quote side (2026-09-14).

| Mock-up shows | Why it breaks the ERP | What gets built |
|---|---|---|
| A road / straight-line **toggle** on the waste panel | Puts a straight-line button in front of the estimator — the option Marco asked to remove. | Straight-line survives only as an automatic fallback, badged. No control. |
| `FUEL_PRICE = 2.09` as a constant | The ERP resolves fuel from `OperationsSettings.fuelPricePerLitre`, fed by a price integration. A constant would silently override a live feed. | Read the settings value. The mock-up's number is sample data, never a default. |
| Distance read straight off the tip, no per-day km | `dailyKm` is a typed column and rows already hold values estimators entered by hand. | Derive it, but treat a typed value as an override — suggest, never overwrite. |
| Cutting priced through the mock-up's step engine | Looked like two rival engines. It is one engine plus an unplugged feature. | Settled — S5 (was S9). |
| Subbies as a flat list of names | The ERP has `SubcontractorSupplier` records with real grouping and links. | Use the real records. |
| Enclosure rates noted as "orphaned from pricing" | They are not — the rate resolver and the AI lookup handler both reach `EstimateEnclosureRate`. They are only absent from the scope card. | Wire them onto the card as an addition, not a repair. |
| **Internal only** excluded from the resource roll-up | `discipline-rollup.ts` carries `peakCrewOverride`, `labourDaysOverride` and `durationOverride`. A tender where a planner typed an override keeps that number, so the exclusion would look like it did nothing. | Filter before the override is applied, not after, and leave a typed override winning. The header states how many lines were left out, so a stale override is visible rather than silent. |
| Cost options lettered **Opt A, B, C** by position on the card | The letter is a label, not an identity. Removing Option A silently renames B to A on a quote that has already gone out. | Letter the card from position, but write the letter into `QuoteCostOption.label` at push time and freeze it; a new option takes the next unused letter on the quote, not the card's. |
| The tender header showing one total with provisional and options beside it | Right for the estimating screen. On the quote it is `ClientQuote.showProvisional` / `showCostOptions` that decide whether the client sees them. | Build the header as drawn. The destination decides the money exists; those two decide whether it prints. |
| An unticked line out of the sum *(2026-09-14)* | Today `isVisible = false` hides the row and keeps the amount in `clientFacingTotal` (finding W5). Every existing quote with a hidden line changes total when this lands. | **Already on main before it was authored** — the total and the adjustment allocation have summed visible lines only since #805 (24 Jul, `client-quotes.service.ts:300-322`); Preview parity landed in #1889 and the *Rate basis* meta row in #1892 (both 13 Sep). The middle cell was wrong when written. Old S10a retired 2026-09-15; its editor line moved to S4. |
| One cost line per estimate line, grouped by discipline *(2026-09-14)* | The seed writes one line per discipline and skips SUB; cutting is its own line. Existing quotes hold five rows, not seventeen. | S4 (was S10b) pushes one `QuoteCostLine` per estimate line keyed by its pointer, SUB included. Existing quotes keep their rows until someone presses Re-push and reads the diff — a push never runs on its own. |
| The *Left off this quote* strip naming an internal line *(2026-09-14)* | Stored on the quote it would be a fifth destination and could leak to the page. | A live read of the estimate filtered to `INTERNAL`, rendered only in the editor. No row, no column, never in Preview or the PDF. |
| Other1.1 named "Provisional sum — unforeseen services relocation" *(2026-09-14)* | Its name said provisional while its destination said *In the price*. The name must not decide. | Ruled 2026-09-11: flipped to *Provisional* on the cards mock-up (v25). In the price $274,163.46, provisional $7,280.00; Quote Destinations follows. |

Each row is a claim about the repo. If a slice author finds the claim wrong — the field
name has drifted, the module has moved — they record the drift in the slice PR body and
adjust the scope, but they do not re-decide the row.

## 5. Reconciliation log

Each entry is a doc-reconcile PR, as the last section requires. No slice prompt authored
from the previous version was open at the time of any entry.

| Date | Against | What changed | Why |
|---|---|---|---|
| 2026-09-14 | `a6ee23b3` | S10 rewritten and split into S10a (the tick decides the money, size 3, no predecessor) and S10b (the push routes by destination, one row per line, size 6, after S2 and S10a). The *Internal only* ruling corrected — the don't-itemise case prints as one line with its group, it is not a hidden line. New ruling row *The quote tick*. Four rows added to section 4. Design ref moved to mock-up v26; Quote Destinations added as the output-side reference; the slice spec artifact named in the front matter. | Marco's 2026-09-11 ruling that an unticked line is not part of the sum made the 2026-09-10 S10 wrong on its own terms (it kept `isVisible` meaning "in the price, not itemised", which is finding W5). Drawing the quote side showed the W5 fix owes nothing to the cards chain, so it ships first as S10a. Draftpanel S1 (rates-lock gate) had shipped, unblocking the *Rates locked* meta cell. |
| 2026-09-15 | `4ea0c1b6` | One merging chain, S1 → S9, each slice gated on the previous; renumbered with a *was* column. Old S10a retired: grounding on 4e57e0d2 found every substantive bullet already on main (#805 total, #1889 preview parity, #1892 rate basis) — its remaining editor line moved to S4 (was S10b). Old S8 (card-name affordance) folded into S3. Quoting module path corrected to `apps/api/src/modules/client-quotes/**`. Section 4 W5 row corrected. | Marco, 2026-09-15: author the slices in merging order so every prompt/cluster is gated on the previous one, and number the chain S1-S9. S10a was retired rather than authored as a no-op because a prompt whose premise is false on main cannot be linted or dispatched. |

## What this plan is not

- It is not a schema. Column names above are the current ones as of `7b1ba03a` (S4 row:
  as of `a6ee23b3`, quoting path corrected on `4ea0c1b6`); a slice author confirms them at
  author time and adjusts if the repo has moved.
- It is no longer three chains. Since 2026-09-15 the order in section 3 is one chain and
  every arrow is binding, functional dependency or not.
- It is not editable by anyone except the SoT keeper. If a decision here needs to change,
  the change lands as a doc-reconcile PR that also updates whichever slice prompts are
  still open — never as an in-flight amendment inside a code slice.
