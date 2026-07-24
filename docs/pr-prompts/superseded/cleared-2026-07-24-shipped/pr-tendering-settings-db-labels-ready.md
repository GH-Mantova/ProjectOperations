---
premise: '! grep -q "model TenderingLabel" apps/api/prisma/schema.prisma'
premise_means: Tendering label overrides are still browser-localStorage only (per-user, stale key list) — no org-wide, DB-backed label settings exist.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/tendering/**
  - apps/web/src/pages/TenderingSettingsPage.tsx
  - apps/web/src/tendering-labels.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model TenderingLabel" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: false
---

# Rebuild Tender Settings: DB-backed, org-wide labels matching the CURRENT schema

Marco (2026-07-23): the Tender Settings page does not match the system schema — decision:
**rebuild properly**. Today it renames a FROZEN label list (keys for routes retired in PR #78:
Pipeline / Create Tender / Tender Workspace / Clients / Contacts) and saves to the browser's
localStorage, so nothing is shared between users.

Branch: `feat/tendering-settings-db-labels`. Reviewer: `GH-Mantova`. Migration: YES — additive.
Bare `GATE-ALLOW: migrations` at column 0 of the PR body.

## What to build

1. Schema: `model TenderingLabel { key @unique, label, updatedAt, updatedById? }` — one row per
   OVERRIDDEN key only (defaults live in code).
2. Refresh the canonical key list in `apps/web/src/tendering-labels.ts` to the CURRENT surface:
   drop the retired nav.* keys; cover the real tender register/detail labels — tender fields
   (number, title, status, probability, estimated value, due date, proposed start, lead time,
   estimator, linked clients/contacts, site), the detail tabs (Scope, Quote, Rates, History) and
   the status display names (DRAFT, SUBMITTED, AWARDED, CONTRACT_ISSUED, CONVERTED, LOST).
   Key set lives in ONE exported record so the settings page and consumers can never drift.
3. API in the tendering module: `GET /tenders/labels` (public to signed-in users, returns
   overrides merged over defaults) and `PUT /tenders/labels` (admin-permission-guarded, upserts/
   deletes override rows; deleting an override restores the default).
4. Web: rebuild `TenderingSettingsPage.tsx` on the API — same rename-form UX, plus a "reset"
   per row and the existing safe-rename notice. Replace `readTenderingLabels` localStorage reads
   with the API (fetch once, cache in memory); ignore any old localStorage payload.
5. Consumers that already call `readTenderingLabels()` keep working via the same helper —
   swap its backing store, not its callers.

## Schema change → REGENERATE the data-model map (MANDATORY)
After editing `apps/api/prisma/schema.prisma`, run
`node scripts/data-model/build-relationship-map.mjs` and COMMIT the regenerated
`docs/data-model/*` artifacts, or the CI drift check FAILS.

## Do NOT
- Do NOT rename any database keys, enum values, routes or permission codes — labels are display
  text ONLY (keep the page's "safe rename surface" contract).
- Do NOT build a generic all-modules label engine — Tendering only, keyed record as today.
- Do NOT migrate users' old localStorage values server-side.
- Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never stand by for approval.
- Update affected unit specs in the same PR; add specs for the new endpoints.
- If size would exceed 10 files, split (schema+API / web) and say so.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
