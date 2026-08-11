# SLICE-0 plan — WL-3 Tender win/loss: win-likelihood (baseline now, model later)

**Status:** PLAN. Design LOCKED by Marco 2026-08-11 (brainstorm + mockup `wl3-win-likelihood-mockup`;
memory `project_tender_winloss_program`). Builds on WL-1 (outcome capture, merged) + WL-2 (reports, merged).

## Goal & principle
Give estimators a **win-likelihood** on a tender that is **honest about its own accuracy**. The model is a
year away; the value NOW is (a) capturing every bid-time feature so the future dataset is complete, and
(b) a transparent baseline that works with thin data and shows its confidence. Real ML swaps in later
behind the same interface. **Advisory only — never auto-prices.**

## How the number works
- **Baseline (now):** conditional historical win-rate over the cohort of similar closed tenders
  (client / work-type / value-band) = wins / total, with a **Wilson confidence interval** from sample size.
  Thin cohort -> wide interval -> UI shows "low confidence". Bid-time features only (known before outcome).
- **Model (later):** logistic-regression / GBM across all features, calibrated probability. Same card.
- **Accuracy is measured, not asserted:** confidence/sample-size on every prediction; a **calibration**
  view (predicted band vs actual win-rate) + **backtest** (predicted vs actual, hit-rate/Brier) so the
  team relies on it only where it's earned trust. Decision-support, not a guarantee.

## Slices
- **WL3-S1 — feature view + baseline win-likelihood API + capture-gap audit** (`feat/wl3-baseline`).
  API-only (no schema change). A feature-extraction service that derives bid-time features from EXISTING
  data — Tender (client, value->band, discipline/work-type, issue/due dates->lead-time & season) + WL-1
  `TenderOutcome` (result, competitorOrWinner->competitorPresent) + client historical win-rate. A baseline
  service computing cohort win-rate + Wilson interval + top "why" factors, exposed at
  `GET /tenders/:id/win-likelihood`. It also EMITS a **capture-gap report** listing any desired bid-time
  feature not reliably present, so we can add capture deliberately (no blind migration). escalates:false.
- **WL3-S1b — capture-completeness (only if S1's gap report shows real gaps)** (`feat/wl3-capture-fields`).
  Additive fields on Tender/TenderOutcome for whatever S1 flagged as missing (escalates: migration).
  Authored AFTER S1's gap report, targeted — not speculative.
- **WL3-S2 — win-likelihood card on the tender** (`feat/wl3-tender-card`). The UI: point estimate +
  confidence band + why factors + honest low-confidence state, per the mockup. Depends S1.
- **WL3-S3 — calibration + backtest view** (`feat/wl3-accuracy`). Extends the WL-2 reporting engine with
  calibration (predicted vs actual bands) + backtest hit-rate/Brier. Depends S1 + accrued outcomes.

## LATER (separate, data-hungry)
- Trained model swap (behind the same API). Price-to-win guidance with a **margin floor** (needs competitor
  price data — weakest early). No-bid / likely-loss triage flag.

## Start
Arm **WL3-S1** now (baseline + gap audit; no schema, safe). It starts producing win-likelihood immediately
(low-confidence honestly) and tells us exactly what capture to add via S1b. Separate from tender PRICING.
