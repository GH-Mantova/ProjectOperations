---
premise: '! grep -rqi "duplicateCandidate\|findDuplicates" apps/api/src/modules/directory apps/api/src/modules/contacts 2>/dev/null'
premise_means: There is no duplicate detection on create for clients/contacts/suppliers.
scope:
  - apps/api/src/modules/directory/**
  - apps/api/src/modules/contacts/**
  - apps/web/src/pages/directory/**
  - apps/web/src/components/**
done_when: pnpm build && pnpm lint && grep -rqi "duplicateCandidate\|findDuplicates" apps/api/src/modules/directory apps/api/src/modules/contacts
size: 6
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | UX-parity (D365 duplicate detection) | MVP -->
# HOLD — UX: duplicate detection on create (MVP)

STATUS: DRAFTED, STAGED, arm-eligible. D365 parity: warn on likely duplicates when creating a Client,
Contact, or Subcontractor/Supplier.

## What to build
Branch: `feat/ux-duplicate-detection`. Reviewer: `GH-Mantova`. No migration.
1. API: a `duplicateCheck` helper for Client / Contact / SubcontractorSupplier — match on normalised
   name + ABN/ACN + email/phone; return candidate matches with a score. Expose a check endpoint (and
   optionally call it inside create to attach a soft warning; never hard-block).
2. Web: on the create form, show a non-blocking "possible duplicates" panel with links to the matches
   ("use existing" vs "create anyway").

## Do NOT
- Do NOT hard-block creation — this is an advisory warning. Do NOT auto-merge records. Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
