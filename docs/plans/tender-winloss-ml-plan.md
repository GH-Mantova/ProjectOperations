# Tender Win/Loss ML Program — Plan

**Status:** WL3-S1 in progress (2026-08-11).

## Background

WL-1 (TenderOutcome capture, append-only) and WL-2 (win/loss descriptive reports) are merged.
This document governs the WL-3 program: bid-time feature extraction, baseline win-likelihood
API, and the future trained model (deferred until enough outcome history exists).

## Sub-slices

### WL3-S1 — Bid-time feature view + baseline win-likelihood API + capture-gap audit (THIS SLICE)

**API-only, read-only, no schema change.**

Produces:
- `GET /tenders/:id/win-likelihood` — baseline win-likelihood (point estimate + Wilson CI +
  confidence label + top "why" factors + per-tender capture gaps).
- `GET /tenders/win-likelihood/capture-gaps` — aggregate capture-gap audit across recent tenders
  (coverage % per desired feature + why it matters).

New module: `apps/api/src/modules/win-likelihood/`
- `win-likelihood-features.service.ts` — feature extraction (client, valueBand, leadTimeDays,
  season/month, clientHistoryWinRate). No new DB columns — works from existing rows.
- `win-likelihood.service.ts` — baseline computation: cohort matching, Wilson CI, why-factors,
  capture-gap collection.

Wired onto `tendering.controller.ts` (existing `tenders.view` permission). No UI.

**Capture gaps identified in WL3-S1 (record here, act in WL3-S1b):**
- `discipline/work-type` — no column on Tender; cohort cannot match on this dimension today.
- `estimatedValue` — present on some tenders only; missing → UNKNOWN band.

### WL3-S1b — Targeted capture additions (FUTURE)

Act on the WL3-S1 capture-gap report. Add columns or pick-lists identified by the audit.
Do NOT start until WL3-S1 is merged and the gap report has been reviewed by Marco.

### WL3-S2 — Web UI for bid-time likelihood (FUTURE, dep: WL3-S1 merged)

Display the win-likelihood panel on the tender detail page. Read-only advisory widget.

### WL3-S3 — Trained model swap-in (FUTURE, dep: 12+ months outcome history)

Replace the cohort-frequency baseline with a trained model behind the same `TenderFeatures`
interface. Model selection deferred.

## Guardrails (all slices)

- Win-likelihood is ADVISORY ONLY. It MUST NEVER feed pricing, auto-accept, or auto-reject.
- Do NOT add stats/ML library dependencies — Wilson CI is a few lines of arithmetic.
- Reuse existing `tenders.view` permission — do not invent new permissions.
- Do NOT change schema until WL3-S1b gap report is reviewed.
