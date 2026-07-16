---
premise: '! grep -rqi "publicToken\|kiosk\|qrCode" apps/api/src/modules/forms'
premise_means: A form cannot be captured via a tokenised public link, kiosk mode, or a QR code (no login).
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/forms/**
  - apps/web/src/pages/forms/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -rqi "publicToken\|kiosk\|qrCode" apps/api/src/modules/forms
size: 9
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | Forms engine gap 4/6 | public link + kiosk + QR capture -->
# Forms engine — public link + kiosk mode + QR capture

STATUS: DRAFTED, STAGED, arm-eligible. Extends the EXISTING forms engine (PR #97). Enables no-login field
capture: site sign-in, muster, visitor/subcontractor induction, toolbox-talk sign-on — via a tokenised
public link, a kiosk (shared-device, auto-reset after submit) and a QR code.

## What to build
Branch: `feat/forms-public-kiosk-qr`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `FormPublicLink` (id, templateId, token unique, mode public|kiosk, isActive, expiresAt?,
   optional siteId/jobId context, maxSubmissions?). Public submissions land as normal `FormSubmission`
   rows flagged as public (no `submittedById`).
2. API — an UNAUTHENTICATED submit endpoint keyed by token (rate-limited, validates the token/active/
   expiry, honours the template's required fields); a QR-code payload/URL for a link; kiosk endpoints
   that return the blank template and accept repeated submits.
3. Web — a public/kiosk fill route (reuse `FormFillPage`), kiosk auto-reset after submit, and a "Share /
   QR" action on `FormsListPage` to mint a link + show its QR.

## Do NOT
- Do NOT expose any authenticated data on the public route (blank template + submit only). Do NOT build
  external customer-account auth here (that is the separate Power-Pages-style portal). Do NOT touch
  Azure/prod. Keep the public endpoint rate-limited. If >10 files, split.

## Schema change -> REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs`; COMMIT the three `docs/data-model/*` files
(#593). Bare `GATE-ALLOW: migrations` at column 0 of the PR body. Update affected `*.spec.ts` expectations.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
