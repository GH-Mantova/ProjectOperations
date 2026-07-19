---
premise: '! grep -rqi "RecordHistory\|AuditHistory\|history-tab" apps/web/src 2>/dev/null'
premise_means: The existing AuditLog is not surfaced as a per-record change-history view.
scope:
  - apps/api/src/modules/audit/**
  - apps/web/src/components/**
done_when: pnpm build && pnpm lint && grep -rqi "RecordHistory\|AuditHistory\|history-tab" apps/web/src
size: 6
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | UX-parity (D365 record audit history) | surface the existing AuditLog -->
# HOLD — UX: record audit history (surface AuditLog)

STATUS: DRAFTED, STAGED, arm-eligible. D365 parity: a per-record change-history ("who changed what,
when"). The `AuditLog` model + `audit` module ALREADY EXIST — this SURFACES them, no new store.

## What to build
Branch: `feat/ux-record-audit-history`. Reviewer: `GH-Mantova`. No migration.
1. API: a read endpoint in the `audit` module — `GET /audit/:entityType/:entityId` returning that
   record's change entries (field, old→new, actor, timestamp), permission-filtered to viewers of the
   record.
2. Web: a reusable `<RecordHistory>` tab/panel any detail page can drop in; wire it onto 1–2 reference
   records (e.g. Tender, Contract).
3. If a key entity isn't being written to AuditLog on mutation, add the audit write in that service
   (small, targeted) — but keep the PR focused on surfacing, not re-architecting audit.

## Do NOT
- Do NOT build a new audit store — AuditLog exists. Do NOT expose entries to users who can't see the
  record. Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
