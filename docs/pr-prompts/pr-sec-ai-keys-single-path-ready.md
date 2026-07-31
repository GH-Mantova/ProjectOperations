---
premise: grep -q "anthropicApiKey" apps/web/src/pages/PlatformPage.tsx
premise_means: The Platform admin page still exposes AI provider API-key fields, so keys are writable via two surfaces with different guards and no validation on this one.
scope:
  - apps/web/src/pages/PlatformPage.tsx
  - apps/api/src/modules/platform/platform-config.controller.ts
  - apps/api/src/modules/platform/*.spec.ts
  - apps/web/src/pages/AdminSettingsPage.tsx
done_when: pnpm build && pnpm lint && ! grep -q "anthropicApiKey" apps/web/src/pages/PlatformPage.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# SECURITY: one write path for AI provider keys — /settings/ai only

## The defect (audit 2026-07-31, verified on origin/main)

AI provider API keys (Anthropic/Gemini/Groq/OpenAI) are writable from TWO surfaces with different
guards and different rigour, mutating the same PlatformConfig singleton:

- `/settings/ai` -> `personas/pages/ProviderKeyManager.tsx` -> `/ai-settings/company/keys`:
  requires `platform.admin` AND super-user (`ai-settings.controller.ts:41-52,123-125`), validates
  the key live against the provider. This is the CORRECT path.
- `/settings/administration/platform` -> `pages/PlatformPage.tsx` (patchField "anthropicApiKey"
  etc., :46-93) -> `PATCH /admin/platform-config`
  (`platform-config.controller.ts:20-26,60-70`): requires only `platform.admin`, NO validation,
  NO super-user check. A platform-admin non-super-user is blocked on one screen and unrestricted
  on the other.

Marco's ruling (Settings audit): /settings/ai is the single home for AI configuration.

## What to build

1. **Backend (`platform-config.controller.ts`):** remove the AI provider fields
   (`anthropicApiKey`, `anthropicModel`, `geminiApiKey`, `geminiModel`, `groqApiKey`,
   `groqModel`, `openaiApiKey`, `openaiModel` — whatever of these the DTO carries) from the PATCH
   DTO and handler. If a request still sends one, respond 400 with a message pointing at the
   `/ai-settings` endpoints. Non-AI platform config fields keep working unchanged.
2. **Specs:** update the platform-config specs — drop/replace assertions that PATCH sets AI keys;
   add one asserting the 400 rejection.
3. **Frontend (`PlatformPage.tsx`):** remove the AI provider key/model fields from the
   "AI & Integrations" card; replace with a short pointer card linking to `/settings/ai`
   ("AI providers are configured in Settings -> AI settings"). Use router Link, s7 classes,
   CSS vars — no raw hex.
4. **Stale pointer fix (`AdminSettingsPage.tsx:103-105`):** the AI tab links `/admin/platform`
   while describing AI provider config — point it at `/settings/ai` and delete the stale
   "Personal AI keys live on each user's /account page" sentence.

## Do NOT

- Do NOT touch `/ai-settings` endpoints, ProviderKeyManager, or key validation logic.
- Do NOT read, print, rotate, or otherwise handle any actual key VALUES — this PR moves code, not
  secrets. No Azure/portal work.
- Do NOT touch schema, migrations, or seeds (PlatformConfig row untouched).
- Do NOT dissolve the AdminSettingsPage mega-page (separate approved restructure slice) — only
  the one stale link/text fix named above.

## VERIFY

- `pnpm build && pnpm lint`
- `! grep -q "ApiKey" apps/web/src/pages/PlatformPage.tsx`
- `! grep -q "anthropicApiKey" apps/api/src/modules/platform/platform-config.controller.ts` (field
  gone from DTO/handler; the 400 rejection may name fields in a string constant — that is fine,
  adjust this check to the implementation and say so in the PR body)
- API unit tests for the module pass.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.
