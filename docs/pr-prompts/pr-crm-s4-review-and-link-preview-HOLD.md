---
premise: '! grep -q "AccountLinkPreview" apps/web/src/pages/crm/AccountsListPage.tsx'
premise_means: >-
  There is no screen for reviewing and committing the client-to-account link. Marco's decision 7 requires
  preview-then-confirm with per-row editable lifecycle, never a one-click bulk write.
scope:
  - apps/web/src/pages/crm/AccountsListPage.tsx
  - apps/web/src/pages/crm/AccountLinkPreview.tsx
  - apps/api/src/modules/crm/accounts/**
  - apps/web/src/pages/crm/__tests__/**
done_when: >-
  pnpm build && pnpm lint && grep -q "AccountLinkPreview" apps/web/src/pages/crm/AccountsListPage.tsx
size: 4
gate_allow: none
seed_only: false
escalates: true
backfill: false
rollback_strategy: >-
  Creates Account rows only, through the existing POST /crm/accounts route. Reversible by archiving them.
cluster: crm-build
cluster_order: 4
requires_on_main: apps/api/src/modules/master-data/master-data.service.ts :: ensureAccountForClient
---

# CRM S4 — Review and link, not "link them all"

S3 stopped the drift forward and created PROSPECT accounts for the backlog. This slice is the screen
where Marco **reviews and corrects the lifecycle** on those rows.

## Do

1. `AccountLinkPreview` — opened from the "N clients have no account" banner on `AccountsListPage`,
   or from a link on any PROSPECT account created by the S3 backfill.
2. Show per row: client name, tender count, last tender date, won count, and a **proposed lifecycle**
   in an editable select. Proposal rule, stated on the screen:
   won a tender → **Active**; tendered but never won, or never tendered → **Prospect**;
   nothing in 24 months → **Past**.
3. A header control to bulk-set the whole filtered list, so 205 rows need not be read one at a time.
4. Nothing is written until **Commit**. Show the three counts up front: exact 1:1 matches, ambiguous
   (must be 0 — the relation is 1:1 by construction), already linked (skipped).
5. Say on the screen that this is a one-time catch-up and that the banner disappears once the count is 0.

## Do NOT

- **Do NOT write anything before Commit.** The preview must be safe to open and close.
- **Do NOT do fuzzy name matching.** `Account.clientId` is unique; the link is structural. If you find
  yourself writing a name-similarity comparison, stop — the design has gone wrong.
- Do NOT modify any Client, Tender or Job row.
- Do NOT re-implement the create path; use the existing `POST /crm/accounts` (`accounts.controller.ts:120`)
  and `PATCH /crm/accounts/:id` (`:128`), which have no web caller today.

## Tests

Pure helpers, per the `DropReasonAdminPage.test.ts` pattern (no jsdom in this workspace).
1. `proposeLifecycle` — won>0 → Active; tenders>0 & won=0 → Prospect; tenders=0 → Prospect;
   last tender >24 months → Past. One case each, plus the 24-month boundary.
2. A row whose lifecycle the user overrode keeps the override through a bulk-set of the others.
3. The commit payload contains no client, tender or job mutation — assert the shape.

## STOP AND REPORT

- The ambiguous count is not 0. That would mean the 1:1 assumption is wrong and the whole design needs
  re-thinking; do not proceed past reporting it.
- Tender counts per client are not reachable without a new endpoint.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> **Finishing the work and then asking for permission is indistinguishable from failing.**

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. STOP AND
REPORT means **open the PR, put the problem in the body, leave it unmerged** — never exit without a PR.
Report measurements, not conclusions.

Full programme context, decisions and ground truth: `docs/plans/crm-build-order-plan.md`.
