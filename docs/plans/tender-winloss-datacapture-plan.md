# SLICE-0 plan — Tender win/loss: data-capture foundation (ML deferred)

**Status:** PLAN ONLY (Marco 2026-08-04: "build it, but it will take a long time to have solid data").
Near-term = capture clean win/loss data now; the ML model lands later once there's a year+ of it. No
sub-slice armed.

## Problem / goal

Predict win likelihood / suggest pricing on a new tender from historical won-vs-lost data. That needs
**structured outcome data captured consistently first** — the model is worthless without it. So the near
-term deliverable is the capture layer + a plain descriptive report; ML is a later, separate program.

## Current state (grounded on origin/main) — extend, don't rebuild

- A **`TenderOutcome`** model already exists (`schema.prisma` ~1318, related from `Tender.outcomes`).
- **Client-level win/loss counters** exist (`Client.winCount`, from #486).
So outcomes are partly modelled already. **Verify `TenderOutcome`'s current fields at build time** and
extend only what's missing — do not create a parallel outcome table.

## Sub-slices (ordered)

- **WL-1 — outcome capture completeness** (`feat/tender-outcome-capture`). Ensure every closed tender
  records the ML-relevant features on `TenderOutcome` (extend the model only if fields are missing;
  escalates if a migration is needed): result (won/lost/no-bid), tender value, client, scope summary/codes,
  our price, competitor/winner if known, and a structured **loss/decline reason** (a bounded list, not free
  text, so it's analysable). Make capture mandatory at tender-close so data doesn't rot. Append-only
  (house style — supersede, don't overwrite a recorded outcome). Premise: a closed tender can be saved
  without a structured outcome/reason.
- **WL-2 — descriptive win/loss report** (`feat/tender-winloss-report`). A plain dashboard/report: win
  rate by client / scope / value band / reason over time. No ML — just the truth in the data. Dep: WL-1.
- **WL-3 (LATER, separate program) — the model.** Only once WL-1 has accrued enough history. Out of scope
  here; flagged so we don't pretend it's imminent.

## Risks

- **Garbage in → garbage out:** WL-1's structured, mandatory-at-close reason list is the whole value.
  Free-text reasons kill the future model — keep it a bounded enum.
- Do not over-build the ML now — no data, no model. Resist scope creep past WL-1/WL-2.

## Start

Arm **WL-1** first (may be escalates if `TenderOutcome` needs a migration). WL-3 (ML) stays parked until
the data is real.
