# SLICE-0 plan — Automated progress-claim generation (with manual edit)

**Status:** PLAN ONLY (Marco 2026-08-04: "yes, with option to manually edit"). Small — most of the
engine already exists. No sub-slice armed.

## Problem / goal

Auto-draft a monthly progress claim instead of building each by hand, then let the user **edit before
issuing**. Never auto-issue — explicit human step (house style: explicit, not automatic).

## Current state (grounded on origin/main) — reuse, don't rebuild

The pro-forma engine already exists in the contracts module:
- `POST /contracts/:id/claims/pro-forma/preview` — builds the line items for a month WITHOUT persisting.
- `POST /contracts/:id/claims/pro-forma` — creates a pro-forma DRAFT claim (`isProForma=true`) for review
  before issuing; one per contract+month.
- `ProgressClaim` + `ClaimLineItem` models exist; `contracts.service.ts` already does the line-item build.

So "auto-generate" = surface + trigger the existing draft builder; the gap is UX + (optionally) a nudge,
not a new engine.

## Sub-slices (ordered)

- **PC-1 — "Generate this month's claim" action + editable draft review** (`feat/claim-autogen-ui`).
  A button on the contract/claims surface that calls the existing pro-forma DRAFT endpoint, then opens the
  draft for **manual edit** (adjust line quantities/%, add/remove lines, notes) before the user issues it.
  Mostly web + wiring; likely no schema. Premise: no "generate claim" action wired to the pro-forma draft
  endpoint on main. ~4-6 files.
- **PC-2 (optional) — month-end reminder** (`feat/claim-autogen-reminder`). A notification to the
  responsible role at month-end "draft progress claims are ready to review" (reuse the existing
  notification-trigger machinery; do not invent a new one). Dep: PC-1.

## Risks

- **Never auto-issue.** PC-1 must stop at a DRAFT the human reviews and issues — the pro-forma/isProForma
  path already enforces this; keep it.
- The one-claim-per-contract+month guard already exists — the UI must handle "already drafted this month"
  gracefully (edit the existing draft, don't error).

## Start

Arm **PC-1** first. Small, low-risk, high daily value; no escalation expected (no schema).
