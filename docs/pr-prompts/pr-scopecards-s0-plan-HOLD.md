---
premise: '! git cat-file -e origin/main:docs/plans/scope-cards-reconciliation-plan.md'
premise_means: The Scope Cards reconciliation plan does not exist on main, so no station can author the slices behind it.
scope:
  - docs/plans/scope-cards-reconciliation-plan.md
done_when: grep -q "quoteDestination" docs/plans/scope-cards-reconciliation-plan.md && grep -q "S10" docs/plans/scope-cards-reconciliation-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
module: docs
cluster: scope-cards
cluster_order: 1
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
---

# SLICE-0 - the Scope Cards reconciliation plan

**This slice writes a plan, not code.** Ten code slices chain behind it. The design it
reconciles to lives in two Claude artifacts that no station can read, so the plan is how
the decisions reach `main` in a form an agent can act on.

## Why this exists

Marco built a Discipline Cards mock-up (`design_ref` above, version 24) and approved it as
the standard - **its UI/UX and its logic**. The repo disagrees with it in ten separable
places. Until those are written down on `main`, every slice would be authored from a
conversation nobody else can see.

## What to build

Create **one file**: `docs/plans/scope-cards-reconciliation-plan.md`.

Stamp it at the top with the UTC date and the `origin/main` SHA it was written against,
and cite the mock-up and spec artifact URLs (both are in this prompt). State plainly that
the artifacts are the source and that this file is the on-main copy.

The file must carry, verbatim in substance, all four sections below.

### 1. The governing rule

> The mock-up is the standard. Where the repo and the mock-up disagree, the work is to
> bring the repo to the mock-up - not to defend what shipped. The one exception is where
> the mock-up is SILENT: it has no stage/concurrency model, so the shipped stage rule in
> `packages/.../discipline-rollup.ts` stands (peak crew MAX across cards, durations SUM).

### 2. The decisions already taken (Marco, 2026-09-10)

| Decision | Ruling |
|---|---|
| Subcontracted work | Nothing is auto-zeroed. A subbie quote may be extra work or a price comparison, so every line keeps pricing. |
| Where a line goes | Not a tick - a **destination**. One of four: In the price, Provisional, Cost option, Internal only. Default: In the price. Every line prices whatever its destination; the destination decides only where the money lands. |
| Internal only | Leaves the money AND the programme. Its crew, plant, person-days and duration are excluded from the card and discipline figures. The "we do it but don't itemise it" case is *In the price* with the line hidden on the quote (`QuoteCostLine.isVisible`, already shipped). One meaning per control. |
| Hiding a line | Never in a drawer. Whatever its destination the row stays in place on the card, greyed and railed - a comparison you cannot see is not a comparison. |
| Existing tenders | Reprice on merge. No pre-flight list. |
| Operational costs | Must count toward the tender price. `days` multiplies into the line total. |
| Charge-step formulas | Authored in Rates & Lists; the tender **embeds the copy it used**. A catalogue edit can never move a locked tender. |
| Card name | Stays one field. The name is the description. |
| Markup | Per line on all four line types, not just card level. |
| Truck cycle | 30 min at the tip. `cycle = (travel x 2) + 0.5h`; `loads/day = floor(8h / cycle)`. A 45-min drive gives 4 loads. |
| Distance | Actual truck travel time, averaged normal vs peak. Straight-line survives only as an automatic fallback, badged - never as a control. |
| Shift length | 8 h, job site to tip, **for loads-per-day only**. This figure must not reach any other calculation. |
| Transport capacity | Matrix by (material class x transport type). A per-line override stays local and never writes back to the table. |
| Night / weekend cutting | Entered under *other-rate* - those rows already exist. The Shift column comes out regardless; the mock-up sets the column set. |
| Discipline duration | Keeps the shipped stage rule. The mock-up is silent on concurrency. |

### 3. The ten slices, in three independent chains

```
money    S1 -> S2 -> S3 -> S10
haulage  S5 -> S7
cutting  S9 -> S4 -> S6
anytime  S8
```

| Slice | Title | Size | Depends on | One line |
|---|---|---|---|---|
| S1 | Operational costs become money | 6 | - | `tenderPrice` gains an operational-costs bucket; `qty x days x rate`; new `wbsRef`, `markupOverride`, `notes` columns. |
| S2 | Where a line goes - one destination, four values | 7 | S1 | New `quoteDestination` enum on the four line types; Rule A deleted; `isProvisional` migrates into it; Internal only also leaves the resource roll-up. |
| S3 | Per-line markup on every line type | 5 | S1 | `markupOverride` on waste and cutting lines; one resolution order per stream; a stored `0` is a real override. |
| S4 | Cutting aligned to the mock-up | 5 | S9 | The mock-up's column set; the Shift column comes out. |
| S5 | Haulage on real travel time | 8 | - | Cycle from routing travel time; loads/day derived; straight-line only as a badged automatic fallback. |
| S6 | One cutting surface, one cutting total | 7 | S4 | Three components currently compute three different cutting totals; they become one. |
| S7 | Transport capacity matrix wired up | 4 | S5 | Rate table `rt-tc` is seeded and read by nothing; wire it, per-line override stays local. |
| S8 | Card name affordance | 2 | - | The card description becomes editable in place. |
| S9 | Charge steps reach the price | 7 | - | `RateTable.chargeSteps` + `rate-step-evaluator.ts` exist and are unplugged; plug them in and have the tender embed the formula it used. **Do this before S4 and S6.** |
| S10 | The push to the quote routes by destination | 6 | S2 | Source pointers added to `QuoteProvisionalLine` and `QuoteCostOption`; the push routes by destination and re-push moves a line between tables instead of duplicating it. |

Record for each slice: premise, scope paths, acceptance, and the dependency above. The
authoring station reads this table to write the per-slice prompts; it must not invent a
different order.

### 4. Where following the mock-up literally would break something

Marco asked for this check to be owned and reported before any PR. Carry all nine rows:

| Mock-up shows | Why it breaks the ERP | What gets built |
|---|---|---|
| A road / straight-line **toggle** on the waste panel | Puts a straight-line button in front of the estimator - the option Marco asked to remove. | Straight-line survives only as an automatic fallback, badged. No control. |
| `FUEL_PRICE = 2.09` as a constant | The ERP resolves fuel from `OperationsSettings.fuelPricePerLitre`, fed by a price integration. A constant would silently override a live feed. | Read the settings value. The mock-up's number is sample data, never a default. |
| Distance read straight off the tip, no per-day km | `dailyKm` is a typed column and rows already hold values estimators entered by hand. | Derive it, but treat a typed value as an override - suggest, never overwrite. |
| Cutting priced through the mock-up's step engine | Looked like two rival engines. It is one engine plus an unplugged feature. | Settled - S9. |
| Subbies as a flat list of names | The ERP has `SubcontractorSupplier` records with real grouping and links. | Use the real records. |
| Enclosure rates noted as "orphaned from pricing" | They are not - the rate resolver and the AI lookup handler both reach `EstimateEnclosureRate`. They are only absent from the scope card. | Wire them onto the card as an addition, not a repair. |
| **Internal only** excluded from the resource roll-up | `discipline-rollup.ts` carries `peakCrewOverride`, `labourDaysOverride` and `durationOverride`. A tender where a planner typed an override keeps that number, so the exclusion would look like it did nothing. | Filter before the override is applied, not after, and leave a typed override winning. The header states how many lines were left out, so a stale override is visible rather than silent. |
| Cost options lettered **Opt A, B, C** by position on the card | The letter is a label, not an identity. Removing Option A silently renames B to A on a quote that has already gone out. | Letter the card from position, but write the letter into `QuoteCostOption.label` at push time so an issued quote keeps the letter it was issued with. |
| The tender header showing one total with provisional and options beside it | Right for the estimating screen. On the quote it is `ClientQuote.showProvisional` / `showCostOptions` that decide whether the client sees them. | Build the header as drawn. The destination decides the money exists; those two decide whether it prints. |

## Do NOT

- Do NOT write any code. This slice creates one Markdown file under `docs/plans/` and
  nothing else. No schema, no service, no component, no migration.
- Do NOT author the S1-S10 prompt files in this PR. They are authored from the plan once
  it is on `main`.
- Do NOT touch `sot/**`. A PR mixing `docs/` with `sot/` or code hard-fails CP-24.
- Do NOT change `discipline-rollup.ts`, the quote models, or anything under
  `apps/api/prisma/`. Every one of those belongs to a later slice.
- Do NOT re-decide anything in section 2. Those are Marco's rulings; record them as given.
  If one of them looks wrong to you, write the concern into the plan under a clearly
  labelled OPEN QUESTION heading and carry on - do not silently change the ruling.

## VERIFY before opening the PR

```
git diff --name-only origin/main            # exactly one path, under docs/plans/
grep -q "quoteDestination" docs/plans/scope-cards-reconciliation-plan.md
grep -q "S10" docs/plans/scope-cards-reconciliation-plan.md
grep -c "^|" docs/plans/scope-cards-reconciliation-plan.md   # the three tables are present
node scripts/pipeline/check-sot-refs.mjs
```

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>` and why.
- Never ask a question or "stand by" for approval. There is no human in this run; a dismissed
  or unanswered question is the absence of a human, not a stop signal. Proceed on best
  judgement and record the assumption in the PR body.
- Read the job log before diagnosing any CI failure. Chase the log, not the diagnosis.
- Hard stop, report and exit: anything touching Azure / Entra / SharePoint, production auth
  or secrets, or any irreversible action. Say `NO-OP: <reason>` and describe what you would
  have done.
- The completion test: is there a PR number in your output? If no, and the reason is "I am
  waiting for someone" - there is nobody. Open the PR.

## STATUS

Armed by Station 00 on Marco's instruction (chat, 2026-09-11). While this file carries the
`-HOLD.md` suffix it is a record of an approved plan. Once it carries the `-ready.md` suffix,
that rename IS the dispatch: build the plan file and open the PR. This section is never a
reason to wait - the 2026-09-11T00:57Z run read the previous wording as a hold, refused to
act, and the watcher consumed the prompt on a PR number the refusal happened to mention.
