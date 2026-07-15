---
premise: '! ls apps/api/prisma/migrations | grep -qiE "tender_site_id_not_null|tender_siteid_notnull"'
premise_means: No migration enforcing siteId NOT NULL on Tender exists yet.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/**
done_when: pnpm build && pnpm lint
size: 5
gate_allow: migrations
seed_only: false
escalates: true
---

# Enforce siteId NOT NULL on Tender (site required at tender time)

GATED: stage-only. Do NOT arm until `pr-tender-geoapify-site-autocomplete` is merged -- new tenders
must be able to capture a site in the wizard BEFORE the DB forbids null, or tender creation breaks.
Marco's decision (2026-07-15) reverses the earlier "Tender stays nullable": a Tender's site address
must be captured at tender time.

## What to build (one migration + backend validation)

1. Ensure the **"Unassigned"** Site exists (same one pr-siteid-notnull-job-project uses).
2. **Backfill** every existing Tender.siteId that is NULL to the Unassigned site. (New tenders get a
   real site via the Geoapify wizard; legacy tenders default to Unassigned and can be reassigned.)
3. Set `site_id` **NOT NULL** on Tender and make `Tender.site` required in schema.prisma.
4. Backend: the tender create/update DTO must require siteId (reject a tender with no site), matching
   the wizard's required field. Confirm existing tender e2e/tests still pass with a site supplied.

## Do NOT

- Do NOT arm this before the Geoapify wizard is on main (see GATED note).
- Do NOT touch Job/Project/FormSubmission here.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

This PR is `escalates: true` (PRODUCTION data + a locking constraint): open the PR, LEAVE IT UNMERGED
for Marco. State the backfill count in the PR body.

## Guardrails

- One attempt. Never exit silently -- if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass. Follow Prisma migration-ordering rules (full timestamp folders).
