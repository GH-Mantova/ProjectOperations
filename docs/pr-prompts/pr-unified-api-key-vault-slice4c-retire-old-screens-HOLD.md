---
premise: '! grep -rq "ApiKeyVaultPage" apps/web/src/App.tsx'
premise_means: The old key screens have not yet been retired/redirected to the unified API Keys page.
scope:
  - apps/web/src/**
done_when: pnpm --filter @project-ops/web build
size: 6
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: 'UI-only retirement: no schema, no data. Revert the PR to restore the old screens and their routes; the unified vault page (PR #1111) is untouched either way.'
requires_merged: 1111
---

# SLICE-4c: Retire AI-Settings-keys + Admin Integrations screens, six-month redirects  (HOLD)

> **HOLD — do not arm until SLICE-4b (the unified API Keys page) is merged AND verified.** Retiring the old
> screens before the new one is proven strands operators mid-cutover (End-User Advocate ruling). Rename
> `-HOLD.md` → `-ready.md` and set requires_merged to the real SLICE-4b PR number after 4b lands.

## What to build
Now that the unified API Keys page (SLICE-4b) manages every key, retire the legacy surfaces:
- Retire the company-keys + my-keys sections of apps/web/src/personas/pages/AiSettingsPage.tsx and the
  Admin → Settings → Integrations keys tab.
- Add six-month route redirects from the retired routes to the new Admin → Settings → API Keys page so
  bookmarks land correctly (plan §4d).
- Leave the AI PERSONA/model settings that are NOT key-management intact — only the KEY entry surfaces move.

## Binding spec
Plan §4d (retire + redirect). The vault (SLICE-4a API) is the single write path; the old screens wrote to
the legacy PlatformConfig / IntegrationCredential stores whose values were backfilled into the vault
(SLICE-3) and still work as legacy fallback until these screens are gone.

## Do NOT
- Do NOT arm while HOLD. Do NOT delete the legacy PlatformConfig / IntegrationCredential DB rows or columns
  (that is a later data-retirement decision, not this slice — the resolve() legacy fallback still reads
  them). Do NOT change the API. Do NOT edit /sot/ or touch Azure/Entra/SharePoint.

## Guardrails
- pnpm --filter @project-ops/web build + lint must pass. Redirects must not 404. No key value rendered.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
