VERDICT: MERGE

## Scope compliance

Scope is docs-only:
- In scope: PR-prompt HOLD rewrite (`pr-ops-m2b-tipping-tab-reminder-HOLD.md`) and design mock-up (`Claude Design/proposed/ops-m2b-tipping/m2b-tipping-mockup.html`)
- Out of scope: None; correctly contains zero code/schema changes

## Content verification

**Prompt rewrite:**
- Corrects old HOLD's fatal errors: premise named non-existent `waste-facilities` module and `WasteFacility` model; old prompt said "no migration" (wrong). Rewritten against actual structure (`MapLocation` in `map-locations` module on a9751066).
- Frontmatter expanded and fixed: `premise_means` narrowed to actual problem; `scope` lists real files (`map-locations/**`, `ProjectTippingTab.tsx`, `MapLocationsTab.tsx`, `schema.prisma`, `migrations/**`); `done_when` added OPS_M2B_TIPPING_V1 marker.
- New metadata fields: `gate_allow: migrations` (allows Prisma migration changes), `backfill: false`, `rollback_strategy` (additive only), `requires_on_main`, `design_ref`, `escalates: true`.
- Detailed spec: API endpoints (GET /waste/recommendations, PATCH /map-locations/:id/prices-reviewed) with Decimal server-side totals, Cron logic (182-day cycle, per-tip dedup, once-per-cycle notif), seed row insertion (idempotent), web tabs and UI (matches mock-up copy/columns/chips), test requirements.
- Guardrails updated; standing authority and do-not-auto-merge preserved.

**Mock-up file:**
- Complete HTML spec (109 lines) with inline CSS, rendering three sections: (1) job-page Tipping tab with tiles and table; (2) Admin map-locations register with price-review dates and action; (3) in-app + email notification samples.
- Matches the prompt's specified labels, columns, chips, dialog copy, and empty state exactly.
- Cites a9751066 as baseline and notes key deviations from old prompt (planned vs. spend, tender-time plans now tracked via tenderId, migration needed).

**PR body:**
- Clearly states "Docs-only: the prompt + the mock-up."
- Cites Marco approval ("Marco: 'do as you suggested', approved 2026-09-21").
- Lists corrections and scope (tipping tab, tenderId on log, pricesReviewedAt on MapLocation, waste.price_review_due trigger).
- Notes "Stale do-not-arm markers removed" and "Staged as HOLD - not armed."
- Lint report: ADMIT (size 6).

## CI status

- All checks passed or skipped (docs-only path filter).
- CodeQL, PR gates, pipeline linter all green.
- No build/lint/smoke required (no code changes).

## Risks

None identified.
- Prompt is HOLD (not yet armed), so it will not generate work until Marco arms it.
- Mock-up is reference documentation; no runtime code.
- Rewrite corrects the old prompt's errors and grounds spec on actual codebase state.

## Recommendation

Merge. This is a complete, thorough rewrite of a HOLD prompt that corrects fatal errors in the old version and provides a detailed, grounded spec ready for the next implementation run. Mock-up is comprehensive and matches the spec. No code risk.
