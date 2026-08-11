---
premise: ! test -f apps/web/src/components/tenancy/TenantAssignmentField.tsx
premise_means: There is no shared UI control letting a user mark a mixed-classification record (Client/Worker/Contact) as group-wide shared or assigned to one company, and none of those three modules' write DTOs accept tenantId.
scope:
  - apps/web/src/components/tenancy/**
  - apps/web/src/pages/tendering/ClientDetailDrawer.tsx
  - apps/api/src/modules/directory/directory.controller.ts
  - apps/api/src/modules/directory/directory.service.ts
  - apps/api/src/modules/workers/workers.controller.ts
  - apps/api/src/modules/workers/workers.service.ts
  - apps/api/src/modules/contacts/contacts.controller.ts
  - apps/api/src/modules/contacts/contacts.service.ts
done_when: pnpm build && pnpm lint && test -f apps/web/src/components/tenancy/TenantAssignmentField.tsx && grep -q "tenantId" apps/api/src/modules/directory/directory.service.ts
size: 8
gate_allow: none
seed_only: false
escalates: true
---

# MT-4: Apply the group-wide / company-owned / mixed classification (UI for the mixed tables)

**Do NOT auto-merge — escalates. Leave the PR open, unmerged, for Marco. Do NOT touch
Azure/Entra/SharePoint.**

`docs/plans/multi-tenant-plan.md` classifies `Client`, `Worker`, and `Contact` as "mixed" — some records
are shared across the group (`tenantId = NULL`), some belong to exactly one company (`tenantId = <id>`).
By this point in the chain, the `tenantId` column exists on all three (MT-0), reads/writes are scoped by
the fail-closed extension (MT-1), and the active tenant is carried on every authenticated request (MT-2).
This slice is the missing piece: letting a user actually SET that flag when creating or editing a
Client/Worker/Contact record. `Tender` and `Job` (company-owned, already enforced NOT NULL by MT-3) are
NOT touched here — they are never user-editable for tenant assignment; they inherit the creator's active
tenant automatically and that plumbing already exists from MT-2/MT-3.

## What to build

### 1. `apps/web/src/components/tenancy/TenantAssignmentField.tsx` (new — primary artifact)
A reusable form control: a toggle/select with two states — "Shared across the group" (maps to
`tenantId: null`) and "This company only" (maps to `tenantId: <selected Tenant id>`, defaulting to the
current user's active tenant). Fetches the tenant list from whatever the existing pattern for small
reference lookups is in this codebase (follow the convention already used by a similar picker in
`apps/web/src/pages/admin/AdminCompanyPage.tsx` or `apps/web/src/pages/admin/RatesListsAdminPage.tsx` for
how simple admin-scoped GET endpoints are called from the web app — reuse that pattern, do not invent a
new fetch layer). Props: `value: string | null`, `onChange(v: string | null)`, `disabled?: boolean`.

### 2. Wire it into the Client edit surface
In `apps/web/src/pages/tendering/ClientDetailDrawer.tsx`, add the `TenantAssignmentField` to the
edit form, wired to the client's `tenantId`. Only render/enable it for users who can manage clients
(reuse the existing `canManage` prop already threaded through this component).

### 3. Backend: accept `tenantId` on create/update for the three mixed models
- `apps/api/src/modules/directory/directory.controller.ts` / `directory.service.ts` — accept an optional
  `tenantId: string | null` on the Client create/update DTO and pass it through to
  `prisma.client.create`/`update`.
- `apps/api/src/modules/workers/workers.controller.ts` / `workers.service.ts` — same, for `Worker`.
- `apps/api/src/modules/contacts/contacts.controller.ts` / `contacts.service.ts` — same, for `Contact`.
In each case, validate the incoming `tenantId` (when not null) against active `Tenant` rows before
writing — do not trust the client blindly.

## Do NOT
- Do NOT add a Worker or Contact edit-form wiring beyond what's listed — if those forms live in files not
  discovered here, note it in the PR description as a follow-up rather than guessing a path; the Client
  wiring (step 2) plus the three backend DTOs (step 3) are the required minimum for this slice.
- Do NOT touch `Tender` or `Job` tenant assignment — those are company-owned and already enforced;
  out of scope here.
- Do NOT change the MT-1 scoping extension's filtering logic.
- Do NOT touch Azure/Entra/SharePoint.
- Do NOT edit anything under `/sot/`.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if this is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must pass. Update any affected `*.spec.ts`
  `toHaveBeenCalledWith(...)` expectations in `directory.service.spec.ts`, workers, and contacts specs
  touched by the new `tenantId` field on the write payload.
