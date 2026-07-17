---
premise: '! grep -q "waste.price_review_due" apps/api/prisma/seed-reference.ts'
premise_means: The tipping-spend tab and the half-yearly price-review reminder are not built yet.
scope:
  - apps/api/prisma/seed-reference.ts
  - apps/api/src/modules/waste-facilities/**
  - apps/web/src/pages/projects/ProjectDetailPage.tsx
  - apps/web/src/pages/ops/**
done_when: pnpm build && pnpm lint && grep -q "waste.price_review_due" apps/api/prisma/seed-reference.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | GATED: arm after pr-ops-m2-tip-finder MERGED (TipRecommendationLog exists) -->
# HOLD — Ops-Map M-2b: tipping-spend tab + price-review reminder

STATUS: DRAFTED, STAGED, **DO NOT ARM YET**. Finishes M-2. Read
`ops-map-waste-facilities-DRAFT.md` §2.3 (job-detail tab) and §2.8 (reminder) + decision 9
(Admin role recipients). **ARM ONLY** after `pr-ops-m2-tip-finder` merged.

## What to build
Branch: `feat/ops-m2b-tipping-tab-reminder`. Reviewer: `GH-Mantova`. No migration.

1. A **"Tipping"** tab on the project/job detail page (`ProjectDetailPage.tsx`, following the
   Contracts-tab precedent) showing this project's `TipRecommendationLog` rows + a running total
   (tipping spend per job). Read endpoint in `waste-facilities`, guarded `waste.view`.
2. **`waste.price_review_due`** notification trigger seeded into the catalogue exactly like the
   existing triggers (`seed-reference.ts`), recipient = **Admin role** (decision 9), idempotent
   upsert.
3. A daily `@Cron` in `waste-facilities` (precedent: compliance-expiry-alerts) that flags any
   active `WasteFacility` whose `pricesReviewedAt` is older than ~182 days (or null), with
   per-facility dedup, delivering via the existing `Notification` + `EmailService` path. A
   "confirm review" action on the facility register stamps `pricesReviewedAt` (resets the clock).

## Do NOT
- Do NOT add new price storage — this only reminds; prices stay in the rate tables.
- Do NOT touch the finder/costing (M-2) or the map (M-1b). Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP: <reason>`. Never stand by for approval.
- If `TipRecommendationLog` is not on `main`, STOP with `NO-OP: predecessor pr-ops-m2 not merged`.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge — open the PR and leave it for Marco.
