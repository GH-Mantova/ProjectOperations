# Investigation — legacy "My Account → AI providers" section

**Date:** 2026-05-02
**Branch:** `chore/remove-legacy-ai-providers-section`
**Outcome:** **Verdict C — fully wired to working AI features. Removal paused, awaiting decision.**

## Summary

The legacy "AI providers" section on the user account page (`/account`,
component `UserProfilePage.tsx`) is not just a UI artifact. It is the
front-end of a full vertical slice — UI + REST endpoints + database
tables + an active runtime consumer — that powers **AI scope drafting**,
a Phase 1 feature (roadmap.md §1: "AI scope drafting (IS disciplines
only)" — ✅ COMPLETE).

Removing the section without first migrating the consumer would break
AI scope drafting end-to-end:

- Estimators triggering "Draft scope from documents" on a tender would
  no longer be able to pick or use a personal AI provider.
- The "remember my last-used provider" UX would lose its store.
- The fallback to a company-managed key would still work, but only if
  the company has any provider configured in `PlatformConfig` —
  otherwise the request errors out.

This is therefore not a UI-only deletion. It is an entanglement
spanning two modules that needs an explicit product decision before
proceeding.

## Files and surface area

### Frontend — UI layer

| File | Role |
|---|---|
| `apps/web/src/pages/account/UserProfilePage.tsx` | Renders the "My AI providers" card with Company + Personal sub-sections. Calls `GET /user/ai-providers`, `PATCH /user/ai-providers/:id`, `DELETE /user/ai-providers/:id`. |
| `apps/web/src/pages/account/AddPersonalProviderModal.tsx` | Modal launched from the "Add personal key" button. Calls `POST /user/ai-providers/list-models` and `POST /user/ai-providers`. |
| `apps/web/src/components/ai/AiProviderSelector.tsx` | **Point-of-use picker** rendered inside the tendering UI. Lists available providers, lets the user pick one, optionally remembers the choice. Calls `GET /user/ai-providers/available` and `PATCH /user/ai-providers/preference`. |

### Frontend — consumers of the picker

| File | Where the picker is used |
|---|---|
| `apps/web/src/pages/tendering/TenderDetailPage.tsx` (around line 965) | "Draft scope from documents" trigger in the Tender detail view. |
| `apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx` (around line 412) | Same picker inside the scope table flow. |

### Backend — API layer

| File | Role |
|---|---|
| `apps/api/src/modules/user-ai-providers/user-ai-providers.controller.ts` | `Controller("user/ai-providers")` exposing `GET /`, `GET /available`, `POST /`, `PATCH /preference`, `POST /list-models`, `PATCH /:id`, `DELETE /:id`. |
| `apps/api/src/modules/user-ai-providers/user-ai-providers.service.ts` | `UserAiProvidersService` — encrypts (`aes-256-gcm`) and stores personal keys, builds the merged company+personal "available" list, manages last-used preference. |
| `apps/api/src/modules/user-ai-providers/user-ai-providers.module.ts` | NestJS module wiring; **exported** so other modules can inject the service. |
| `apps/api/src/modules/tendering/tendering.module.ts` (line 21) | Imports `UserAiProvidersModule` so `TenderScopeDraftingService` can use the service. |

### Backend — runtime consumer

| File | What it does with the legacy storage |
|---|---|
| `apps/api/src/modules/tendering/tender-scope-drafting.service.ts` | **The blocker.** Imports `UserAiProvidersService`. In `resolveProviderForUser` (~line 301) it: (1) reads `prisma.userAiPreference.findUnique({ where: { userId } })` to recall the user's last-used provider, (2) calls `userAiProviders.getPersonalKey(userId, id)` (~line 334) to decrypt and use a personal key when the chosen provider is personal, (3) calls `userAiProviders.setPreference(actorId, providerMeta.id)` (~line 217) after a successful draft to remember the choice. |

### Database — tables

| Table | Schema location | Purpose |
|---|---|---|
| `user_ai_providers` (`UserAiProvider`) | `apps/api/prisma/schema.prisma` lines 1786–1801 | Per-user encrypted personal AI keys. `userId, provider, label, apiKey (encrypted), model, isActive`. Indexed on `(userId)` and `(userId, provider)`. |
| `user_ai_preferences` (`UserAiPreference`) | `apps/api/prisma/schema.prisma` lines 1805–1813 | Per-user `lastUsedProviderId`. Stores the most recently picked provider so the selector can skip the modal on repeat use. |

Both tables back-reference `User` (`personalAiProviders`, `aiPreference`
relations on `User` at lines 77–78). Removing them requires also dropping
those back-relations.

### Permissions

No `ai.providers.*` permission strings. The legacy endpoints are gated
purely by `JwtAuthGuard` (any authenticated user). Removal would not
require permission registry changes.

## Categorisation

| Test | Result |
|---|---|
| UI section present | ✅ `UserProfilePage.tsx` — "My AI providers" card |
| Backend endpoints present | ✅ Full CRUD under `Controller("user/ai-providers")` |
| DB tables present | ✅ `user_ai_providers`, `user_ai_preferences` |
| **Working AI feature reads from this storage** | ✅ **Yes** — `TenderScopeDraftingService.resolveProviderForUser` reads `userAiPreference.lastUsedProviderId` and calls `userAiProviders.getPersonalKey` / `setPreference` |

→ **Verdict C — fully wired.**

## What would break if we deleted blindly

If we deleted the UI section, the controller, the service, the DB
tables, and the User back-relations without touching anything else:

1. **TenderScopeDraftingService fails to compile.** `resolveProviderForUser`
   imports `UserAiProvidersService` and references `prisma.userAiPreference`.
   API build breaks.
2. **AiProviderSelector fetches 404s.** The selector hits
   `/user/ai-providers/available`. With the controller removed, the
   route returns 404, the selector renders an error, and "Draft scope
   from documents" can't proceed.
3. **TenderDetailPage / ScopeQuantitiesTable would need rework.** Both
   import the selector — they need an alternative provider-resolution
   path or the picker stays out.
4. **AI scope drafting silently degrades to company-key-only.** If the
   company hasn't configured any provider in `PlatformConfig`,
   `pickCompanyProvider()` returns the mock provider — the feature
   stops doing real AI work.

## Recommended paths forward (for main chat to choose)

These are **not** decisions for this PR — listing them so the next
session has a clear menu of options.

### Option 1: Migrate to the new AI Settings page first

- Build BYOK on the new `/admin/ai-settings` page (PR currently deferred
  pending the encryption PR — `UserPersonaSettings.bringYourOwnKey`
  column already exists from PR #117).
- Add a service method on the new persona system that resolves a
  provider for a user (mirrors the legacy `resolveProviderForUser`).
- Migrate `TenderScopeDraftingService` to use the new resolver.
- Migrate `AiProviderSelector` to read from new endpoints (or remove
  entirely if the persona system handles selection differently).
- Then remove the legacy section in a follow-up PR.

This is the cleanest path. ~2–3 PRs of work.

### Option 2: Accept the breakage temporarily

- Remove the legacy section now.
- Mark "AI scope drafting" as paused in roadmap.md (move from PHASE 1
  ✅ to a temporary "🔧 paused — restoring under new persona system"
  state).
- Restore once Option 1's migration lands.

This is faster but breaks a working feature for some unknown number of
days. Raj uses AI scope drafting — this would impact him directly.

### Option 3: Defer removal until after the AI integration PR

- Keep the legacy section live until §5A.1 PR 6 (the actual AI
  integration PR for the persona system) lands.
- In that PR, replace `TenderScopeDraftingService.resolveProviderForUser`
  with a persona-system-aware resolver, retire the legacy endpoints,
  drop the tables.
- The legacy "My Account" UI section can be removed in the same PR or
  immediately after.

This keeps `main` working at every step. Probably the most honest path
given the AI integration PR is the next one in the §5A.1 sub-phase
anyway.

## Conclusion

The "duplicates and fragments AI configuration UI" framing is correct —
the legacy section IS redundant from a user-facing perspective with the
new AI Settings page. But it's load-bearing under the hood for an
already-shipped feature. We should not remove it in isolation.

Recommended: **Option 3** (defer to the AI integration PR), since the
new persona system is the natural replacement for the legacy
`UserAiProvidersService` and the migration is least risky when done
inside the PR that introduces the replacement. No code change in this
PR — investigation report only.
