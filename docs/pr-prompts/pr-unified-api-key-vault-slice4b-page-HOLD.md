---
premise: '! test -f apps/web/src/pages/admin/settings/ApiKeyVaultPage.tsx'
premise_means: The unified API Keys admin page does not exist yet.
scope:
  - apps/web/src/**
done_when: pnpm --filter @project-ops/web build && test -f apps/web/src/pages/admin/settings/ApiKeyVaultPage.tsx
size: 10
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - SLICE-4a-mgmt-api
  - AdminSettingsPage-restructure
---

# SLICE-4b: Unified "API Keys" admin page + Manage Types modal  (HOLD)

> **HOLD — do not arm until BOTH land on main:** (1) SLICE-4a (the vault management API — the PR that adds
> apps/api/src/modules/api-keys/api-keys.controller.ts), and (2) the AdminSettingsPage restructure
> (docs/plans/settings-restructure-plan.md — NOT built on main yet; the new Settings IA is this page's
> slot). Rename this file `-HOLD.md` → `-ready.md` and set requires_merged to the two real PR numbers only
> after both are merged. Building against the old Settings IA would fight for the same routes.

## What to build (consumes the SLICE-4a API)
Single Name/Type/Key table page (apps/web/src/pages/admin/settings/ApiKeyVaultPage.tsx) inside the
restructured Settings IA:
- Scope filter Company | Personal (personal rows: owner sees own; super-user sees others STATUS-ONLY).
- Row actions: enable/disable, reorder (drag or numeric order → POST /api-keys/credentials/reorder),
  edit name/type, delete, "Test now" (POST /api-keys/credentials/:id/test → green/red + reason + validatedAt).
- "Add key" → Name + Type (dropdown) + Key entry (POST /api-keys/credentials). Key is write-only; the UI
  only ever shows hasKey / validatedAt / updatedBy / updatedAt — NEVER a value (§6.2).
- "Manage Types" modal → list types with credentialCount; create / rename (instant cascade) / edit
  description; delete blocked with the 409 "N keys use this type — reassign first" affordance.
- For geocoding types, the order column IS the failover chain order; show the advisory cost-tier badge
  (ADAPTER_COST_TIERS: free / paid-metered).

## Binding spec
Plan §4d (page), §2 (fields), §1d/§6 (permission/compliance — no plaintext to browser, ever), §5 (Test).
Consume ONLY the SLICE-4a endpoints; do not add new API routes here.

## Do NOT
- Do NOT arm while HOLD. Do NOT change the API (SLICE-4a owns it). Do NOT retire the old screens or add
  redirects here — that is SLICE-4c. Do NOT edit /sot/ or touch Azure/Entra/SharePoint.

## Guardrails
- pnpm --filter @project-ops/web build + lint must pass. No key value is ever rendered. Match the
  restructured Settings IA's page/layout conventions.
