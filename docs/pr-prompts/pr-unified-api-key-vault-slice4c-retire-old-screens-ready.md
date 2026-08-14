---
premise: 'grep -q "ProviderKeyManager" apps/web/src/personas/pages/CompanySettingsTab.tsx apps/web/src/personas/pages/MySettingsTab.tsx'
premise_means: The AI-keys management surface (ProviderKeyManager in the Company / My-Settings tabs) still exists and has not been retired onto the shipped vault panel.
scope:
  - apps/web/src/**
done_when: pnpm --filter @project-ops/web build
size: 6
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
requires_merged:
  - 1111
---

# SLICE-4c: Retire the AI-keys surface onto the shipped vault panel + redirects

> **Reconciled 2026-08-14 (PR Master + Marco).** SLICE-4b shipped as **#1111** — it replaced the
> AdminSettingsPage "Integrations / API keys" tab **in place** with the vault-backed `ApiKeyVaultPanel`
> (not a new `ApiKeyVaultPage` route; the original premise was stale). So the *Integrations* keys screen is
> already retired. This slice retires the remaining **AI-keys** surface and adds redirects. requires_merged
> set to the real SLICE-4b PR (#1111).

## What to build
- Retire the **key-entry** sections of the AI settings tabs: remove `ProviderKeyManager` (Anthropic / Gemini /
  Groq / OpenAI key entry) from `apps/web/src/personas/pages/CompanySettingsTab.tsx` and
  `apps/web/src/personas/pages/MySettingsTab.tsx` (rendered by `AiSettingsPage.tsx`). Point users to the
  unified vault: **AdminSettings → "Integrations / API keys"** (the `ApiKeyVaultPanel` shipped in #1111).
- Add **six-month route redirects** from the old AI-keys entry points to the vault panel so bookmarks land
  correctly (no 404).
- **Leave the AI persona / model / preference settings intact** — only the KEY-management surfaces move.

## Binding spec
`docs/architecture/plans/unified-api-key-vault-and-geocoding-failover.md` §4d (retire + redirect). The vault
(SLICE-4a API) is the single write path; the old screens wrote to the legacy PlatformConfig /
IntegrationCredential stores, which were backfilled into the vault (SLICE-3) and remain as a read-only
`resolve()` fallback until a later data-retirement decision.

## Do NOT
- Do NOT delete the legacy PlatformConfig / IntegrationCredential DB rows/columns (later decision — the
  `resolve()` fallback still reads them). Do NOT change the API. Do NOT edit /sot/ or touch Azure/Entra/SharePoint.
- Do NOT remove the AI persona/model settings — only the key-entry surfaces.

## Guardrails
- `pnpm --filter @project-ops/web build` + lint pass. Redirects must not 404. No key value ever rendered.
  `escalates:false` — auto-merges on green.
