---
premise: '! test -f apps/web/src/pages/admin/ApiKeyVaultPanel.tsx'
premise_means: The unified API Keys vault panel does not exist yet; the AdminSettingsPage Integrations tab still renders the legacy IntegrationsKeysTab.
scope:
  - apps/web/src/**
done_when: pnpm --filter @project-ops/web build && test -f apps/web/src/pages/admin/ApiKeyVaultPanel.tsx && grep -q "ApiKeyVaultPanel" apps/web/src/pages/AdminSettingsPage.tsx
size: 10
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 917
---

# SLICE-4b: Unified "API Keys" vault UI — replaces the AdminSettingsPage "Integrations / API keys" tab

> **Reconciled 2026-08-13 (PR Master + Marco).** SLICE-4a vault API is shipped (#917). Decision: build the
> unified vault UI and mount it AS the existing AdminSettingsPage "Integrations / API keys" tab (replace
> `IntegrationsKeysTab` in place) — NOT a new page under a new IA folder. The originally-assumed
> `apps/web/src/pages/admin/settings/` path never shipped; the settings restructure kept this tab
> first-class (plan amendment 2026-08-06, SLICE 14 narrowed via #967). requires_merged reduced to the one
> true build dependency: #917.

## What to build (consumes the SLICE-4a vault API — #917)
Create `apps/web/src/pages/admin/ApiKeyVaultPanel.tsx` and render it as the `integrations` tab content in
`apps/web/src/pages/AdminSettingsPage.tsx` (replace `<IntegrationsKeysTab />`; keep the tab id
`integrations`). Single Name / Type / Key table backed by the vault (`/api-keys/**`), NOT the legacy
`/admin/settings/integrations` store:
- Scope filter **Company** | **Personal** → `GET /api-keys/credentials?scope=company` / `?scope=user`
  (personal rows: owner sees own; super-user may audit others' STATUS-ONLY).
- Row actions: enable/disable, edit name/type, reorder → `PATCH /api-keys/credentials/:id`
  (enabled/name/typeId/order/config); company-chain drag/numeric reorder may also use
  `POST /api-keys/credentials/reorder` ({ ids }); delete → `DELETE /api-keys/credentials/:id`;
  **Test now** → `POST /api-keys/credentials/:id/test` → green/red + reason + validatedAt.
- **Add key** → Name + Type (dropdown) + Key → `POST /api-keys/credentials`. Key is write-only; UI only ever
  shows hasKey / validatedAt / updatedBy / updatedAt — NEVER a value (§6.2). Rotation = `PATCH …/:id` with
  `key` (clears validatedAt).
- **Manage Types** modal → `GET /api-keys/types` (list w/ credentialCount); create `POST /api-keys/types`;
  rename / edit description `PATCH /api-keys/types/:id` (rename cascades — credentials reference typeId);
  delete `DELETE /api-keys/types/:id` — blocked with the 409 "N keys use this type — reassign first"
  affordance.
- For geocoding types the order column IS the failover chain order; show the advisory cost-tier badge
  (ADAPTER_COST_TIERS: free / paid-metered).

## Binding spec
`docs/architecture/plans/unified-api-key-vault-and-geocoding-failover.md` §4d (page), §2 (fields),
§1d/§6 (permission/compliance — no plaintext to browser, ever), §5 (Test). Consume ONLY the SLICE-4a
`/api-keys/**` endpoints (see #917 `api-keys.controller.ts`); do NOT add new API routes here.

## Do NOT
- Do NOT retire the AI-keys surface or add redirects here — that is SLICE-4c (follow-on).
- Do NOT change the API (SLICE-4a owns it); do NOT alter the legacy `/admin/settings/integrations` backend
  — just stop the panel reading from it.
- Do NOT edit /sot/ or touch Azure/Entra/SharePoint.

## Guardrails
- `pnpm --filter @project-ops/web build` + lint must pass. No key value is ever rendered. Match the existing
  AdminSettingsPage tab/card conventions (s7 tokens).
