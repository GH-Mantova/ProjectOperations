# ProjectOperations System Audit — 2026-05-02

**Generated:** 2026-05-02 11:04 AEST
**Audit type:** comprehensive (Sections 1 + 2 + 3)
**Mode:** read-only (no autonomous fixes)
**Trigger:** end-of-day sanity check after the §5A.1 PR chain (PRs #117–#132)
**Branch:** `audit/2026-05-02-system-snapshot`
**Main HEAD at audit time:** PR #132 merged

---

## Executive Summary

- **Total checks run:** 11 health + 5 drift sub-sections + 5 security sub-sections
- **Critical findings:** 0
- **Major findings:** 1 (M1 — Xero error reflection to client)
- **Minor findings:** 3 (m1–m3)
- **Observations:** 6 (o1–o6)

**Overall verdict: HEALTHY.** All 11 health checks pass. No accidentally exposed endpoints. No privilege escalation vectors. Zero open CodeQL or Dependabot alerts. The §5A.1 chain delivered the persona system end-to-end, migrated the legacy AI scope drafting cleanly (PR #132), and left the codebase in a coherent state.

The only Major finding is **M1: Xero service surfaces raw API error text to the client** — recommended for a small follow-up PR. Nothing requires action before the next feature PR.

---

## Section 1 — Health Checks

| Check | Result | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile` | ✅ pass | Lockfile resolves clean, no dep drift |
| `prisma migrate status` (local DB) | ✅ pass | "Database schema is up to date!" — 68 migrations applied |
| Fresh shadow-DB replay | ⚠️ deferred | Not run — would require destructive local DB reset (audit forbids). CI on PR #132 (most recent merge) replays migrations from scratch on a fresh DB and was green. |
| `pnpm seed` (run 1) | ✅ pass | Clean exit |
| `pnpm seed` (run 2 — idempotent) | ✅ pass | Clean exit, no errors on repeat |
| `pnpm --filter @project-ops/api lint` | ✅ pass | Zero warnings |
| `pnpm --filter @project-ops/web lint` | ✅ pass | Zero warnings |
| `pnpm --filter @project-ops/api test` | ✅ pass | **209/209** — 26 test suites |
| `pnpm --filter @project-ops/web test` | ✅ pass | **192/192** — 10 test files |
| `pnpm build` (recursive) | ✅ pass | Both packages built; web bundle 1,890 kB / 491 kB gzipped |
| `pnpm compliance:smoke` | ✅ pass | `"status": "passed"` |
| `npx playwright test tests/e2e/tendering.spec.ts --project=chromium` | ✅ pass | **5/5** in 18.9s |

**Section 1 verdict: 11/11 functional checks pass.** Shadow-DB replay deferred to CI per audit constraints (no destructive operations).

---

## Section 2 — Drift and Consistency

### 2.1 — Permission registry consistency

**Declared permissions:** 64 in `apps/api/src/common/permissions/permission-registry.ts`.

**Usage breakdown:**
- Decorator usages: 458 across 52 controller files
- Inline `hasPermission(...)` usages: 8 across 1 file (`directory.controller.ts`)
- Custom guards reading `permissionRequired`: 1 (`PersonaPermissionGuard` reading `tendering.persona.ts`)

**Findings:**

| Status | Count | Permissions |
|---|---|---|
| USED via decorator | 60 | (most of the registry) |
| USED via inline only | 1 | `directory.finance` (intentional — gated inline for granular bank-detail access; documented behaviour since PR #75) |
| USED via custom guard | 1 | `ai.persona.tendering` (read by `PersonaPermissionGuard` from `persona.permissionRequired`; this is the persona-system pattern, intentional from PR #117) |
| USED both decorator + inline | 3 | `directory.admin`, `finance.manage`, plus the `directory.finance` mentioned above (cross-checked) |
| **UNUSED** | **1** | **`forms.admin`** — declared in PR #97 (Forms Engine) for "Delete templates, view all submissions, manage schedules" but no `@RequirePermissions("forms.admin")` decorator and no `hasPermission("forms.admin")` call exists anywhere |

**No undeclared permission strings** — every string used by `@RequirePermissions(...)` and `hasPermission(...)` matches a registry entry. 100% clean on that side.

→ Finding **m1** below.

### 2.2 — §5A.1 cleanup verification (post PR #132)

| Check | Result |
|---|---|
| No imports of `UserAiProvidersService` | ✅ — zero matches |
| No imports of `UserAiPreferenceService` | ✅ — zero matches (never existed; was a single service) |
| No imports of `AiProviderSelector` | ✅ — zero matches |
| No references to `user_ai_providers` table | ✅ — zero matches in `.ts` |
| No references to `user_ai_preferences` table | ✅ — zero matches in `.ts` |
| No `/user/ai-providers/*` endpoint clients | ✅ — zero matches |
| `schema.prisma` has no `UserAiProvider`/`UserAiPreference`/relations | ✅ — only a memorial comment at line 1780 |
| Migration history clean | ✅ — `20260421_feat_user_ai_providers` (creation) bracketed by `20260502101544_chore_remove_legacy_ai_provider_tables` (drop). No leftover migrations. |

**Sole remnant:** one comment-only mention in `tender-scope-drafting.service.ts:20` documenting the historical "personal" source (intentional audit trail).

**§5A.1 cleanup verdict: clean.** PR #132 left no leakage.

### 2.3 — Provider implementation consolidation status

**Two `ai-providers/` directories exist** by design (one new, one legacy bridging to `draftScope`). Inventory:

**`apps/api/src/modules/tendering/ai-providers/` (legacy):**
| File | Imported by | Status |
|---|---|---|
| `ai-provider.interface.ts` | `tender-scope-drafting.service.ts` | ✅ ACTIVE |
| `claude.provider.ts` (`ClaudeProvider`) | `tender-scope-drafting.service.ts` | ✅ ACTIVE — used by scope drafting `draftScope()` |
| `openai.provider.ts` (`OpenAiProvider` + `MockAiProvider`) | `tender-scope-drafting.service.ts` | ✅ ACTIVE — Mock for the no-key fallback, OpenAi for instantiate |
| **`gemini.provider.ts` (`GeminiProvider`)** | nothing | ❌ **DEAD** — no imports anywhere |
| **`groq.provider.ts` (`GroqProvider`)** | nothing | ❌ **DEAD** — no imports anywhere |

**`apps/api/src/modules/ai-providers/providers/` (new — PR #123/#124):**
| File | Imported by | Status |
|---|---|---|
| `anthropic.provider.ts` (`streamAnthropicChat`) | `ai-providers.service.ts` | ✅ ACTIVE — chat endpoint streaming |
| `openai.provider.ts` (`streamOpenAIChat`) | `ai-providers.service.ts` | ✅ ACTIVE — chat endpoint streaming |

**Duplication intent:** the two implementations exist because the new module does **streaming chat** (used by the floating window) while the legacy module does **one-shot JSON responses** (used by scope drafting's `draftScope()` → returns a parsed array of scope items). Different APIs, different needs. Not a duplication bug.

→ Finding **m2** below (dead Gemini/Groq classes).

### 2.4 — Pre-existing migration drift (workers.employmentType)

**Local DB (this audit's machine):** `workers` has `employment_type` only — no stray `employmentType` column. Schema matches Prisma's `@map`.

**`schema.prisma`:** declares `employmentType String? @map("employment_type")` (line 552).

**CI / fresh-DB-replay state (theoretical):** migration `202604020004_worker_employmenttype_compat` runs `ALTER TABLE workers ADD COLUMN IF NOT EXISTS "employmentType" TEXT` and no later migration drops it. So a CI/fresh DB has both `employment_type` AND `employmentType` columns; `schema.prisma` declares only the former. The Prisma client never queries `employmentType` so nothing breaks at runtime, but the DB is structurally divergent from the schema.

**Why the local audit machine is clean:** PRs #117, #126, and #132 each ran `prisma migrate dev` which auto-generated drift-cleanup migrations. Those drift cleanups got applied to the local DB even when the migration file was trimmed on disk (per the consistent PR #117 protocol). The local DB has been progressively cleaned; CI's fresh DB has not.

→ Already tracked under PHASE 6 entry "Audit migration history vs current schema". No new finding.

### 2.5 — Test count regressions and skipped tests

**Tests:** 209 API + 192 web — matches PR #132's reported numbers exactly. **No silent regression.**

**Skipped tests:** zero. `grep -E "\.skip\(|xit\(|xtest\(|test\.skip|it\.skip|describe\.skip"` returns nothing.

**Test files in place:** 26 `.spec.ts` in API, 10 `.test.ts`/`.test.js` pairs in web (the legacy `.js` siblings double-count via vitest's auto-pickup).

---

## Section 3 — Security and Architectural Review

### 3.1 — Authentication coverage

**Public endpoints (no auth, by design):**
- `/api/v1/health` — health check
- `/api/v1/auth/login`, `/auth/refresh`, `/auth/reset-password`, `/auth/sso`, `/auth/entra`, `/auth/config` — staff auth flow
- `/api/v1/portal/auth/login`, `/portal/auth/refresh`, `/portal/auth/logout`, `/portal/auth/accept-invite`, `/portal/auth/request-reset`, `/portal/auth/reset-password` — portal auth flow

All 13 are appropriate.

**Authenticated but un-permissioned (intentional):**
- `/api/v1/admin/users/*` — gating happens in the service layer via `tierOf(viewer)` (admin/super-user only). PR #84 rationale: tier model is more granular than permission codes for user-management ops.
- `/api/v1/auth/me` — read-only self-query for current user identity.

Both are designed-this-way, not gaps.

**Custom guards properly gated:**
- `PersonaPermissionGuard` — reads `persona.permissionRequired` from the registry, validates against `req.user.permissions` OR `req.user.isSuperUser`. Returns 404 for unknown slugs (no existence leak). Verified during PR #118.
- `PortalJwtGuard` — separate JWT secret + payload type check (`payload.type !== "portal"` rejected). Re-validates `clientId` against DB on every request to catch deactivated portal users + stale tokens.

**Verdict: no accidentally exposed endpoints found.** All non-public endpoints have either JwtAuthGuard or PortalJwtGuard.

### 3.2 — Privilege escalation patterns

Searched for the bug class fixed in PR #85.1: endpoints accepting `userId`/`workerProfileId`/`personaId` from request body when they should derive identity from `req.user.sub`.

**Findings:**

| Module | Pattern | Verdict |
|---|---|---|
| `admin-users` | `tierOf(viewer)` validates the actor's tier before allowing super-user promotion (line 105). No body-spoofable identity. | ✅ safe |
| `notifications` | `AssignFollowUpNotificationDto.userId` accepts a user id, but this is the **assignee** (intentional admin reassignment), not the actor identity. Permission `notifications.manage` gates the endpoint. | ✅ safe by design |
| `field` | All endpoints derive identity via `ctx(user)` helper from `req.user.sub` (lines 32–34 of `field.controller.ts`). Workers can only operate on their own allocations/timesheets. | ✅ safe |
| `workers` | No body `userId` or `workerProfileId` parameters. All mutations use path parameters validated server-side. | ✅ safe |
| `users` | Mutations pass `actor.sub` to service; no user-supplied identity fields in DTOs. | ✅ safe |
| `safety` | `createIncident` / `createHazard` record `actor.sub` server-side, not from DTO. | ✅ safe |
| `personas` (chat) | System prompt resolution uses `actor.sub` exclusively (`personas.controller.ts:214`). User cannot spoof which persona settings to read. | ✅ safe |
| `portal` | `PortalJwtGuard` extracts `clientId` from the portal token; all portal operations are auto-scoped to that client. Staff JWT and portal JWT use different secrets and payload shapes. | ✅ safe |

**Verdict: no privilege escalation vectors identified.** PR #85.1's bug class is not present in any current endpoint.

### 3.3 — Error handling consistency

**Sanitised paths (PR #131 pattern via `sanitiseProviderError`):**
- `/personas/:slug/chat` ✅ (PR #131)
- `/tenders/:id/draft-scope` ✅ (PR #132)

**Un-sanitised paths reflecting upstream errors to client:**
- **Xero service** (`xero.service.ts` lines 220, 282, 309, 378) — catches Xero API errors, throws `BadRequestException(\`Xero sync failed: ${message}\`)` with raw upstream text. Affects `POST /xero/sync-contacts` and `POST /xero/push-invoice`. → **Finding M1.**
- **SharePoint** `testConnection()` (`sharepoint.service.ts:112`) — surfaces error in response body. Restricted to `sharepoint.view` (super-user-only via Admin role). Low-risk because the endpoint is admin-debugging-only and the error text comes from Microsoft Graph (not user-controlled). Acceptable for now.
- **Email** test endpoint (`email.service.ts:177–178, 248–249`) — returns `{ success: false, message: err.message }`. Test-endpoint only, auth-gated. Low-risk.

→ Finding **M1** for Xero. SharePoint + Email noted as o5 / o6.

### 3.4 — Dead code audit

**Method:** manual grep + import-tracing (no `ts-prune` or `knip` available).

**Confirmed dead code:**
- `apps/api/src/modules/tendering/ai-providers/gemini.provider.ts` — `GeminiProvider` class, zero imports. (See 2.3 — m2.)
- `apps/api/src/modules/tendering/ai-providers/groq.provider.ts` — `GroqProvider` class, zero imports. (See 2.3 — m2.)

**No other dead code surfaced** by import scans. The post-§5A.1 cleanup PRs (#119, #120, #126, #132) already deleted everything orphaned.

**TODO/FIXME/HACK/XXX comments:** **zero** in `apps/api/src` and `apps/web/src`. Codebase has no leftover sticky-note comments.

**`.legacy.ts` / `.deprecated.ts` files:** none.

**Commented-out code blocks > 5 lines:** none found in sample reads.

### 3.5 — CodeQL / Dependabot status

**CodeQL alerts** (`gh api repos/.../code-scanning/alerts`):

| # | Rule | State | Notes |
|---|---|---|---|
| 1 | actions/missing-workflow-permissions | fixed | Closed by PR #128 |
| 2 | js/incomplete-sanitization | fixed | Pre-existing, closed prior |
| 3 | actions/missing-workflow-permissions | fixed | PR #128 |
| 4 | actions/missing-workflow-permissions | fixed | PR #128 |
| 5 | actions/missing-workflow-permissions | fixed | PR #128 |
| 6 | js/xss-through-dom | dismissed (false positive) | PR #128 dismissed |
| 9 | js/xss-through-exception | fixed | PR #131 — sanitiser |
| 10 | js/xss-through-dom | dismissed (false positive) | PR #131 dismissed |

**Open CodeQL alerts: 0** ✅

**Dependabot alerts:** 13 total — 12 fixed, 1 dismissed (`uuid` re-bump deferred per PR #128 deviation). **Open: 0** ✅

**Verdict: zero open security alerts.** All historical alerts either closed via fix or dismissed with explanation.

---

## Findings (consolidated, severity-ranked)

### Critical
None.

### Major

**M1 — Xero service reflects raw upstream API errors to client**

- **Files:** `apps/api/src/modules/xero/xero.service.ts` lines 220, 282, 309, 378
- **What:** Catch blocks like `err instanceof Error ? err.message : String(err)` produce a `message` that's then thrown as `BadRequestException(\`Xero sync failed: ${message}\`)`. The raw Xero API error text — including details like "Invalid authentication credentials", internal endpoint paths, OAuth state diagnostics — reaches the client.
- **Why major:** Same risk class as CodeQL #9 (which we fixed for AI providers via `sanitiseProviderError`). Xero error messages can include account-specific or upstream-implementation-specific text that shouldn't be reflected back. Not currently exploitable (frontend renders via JSX, auto-escaped) but defence-in-depth at the API boundary is the pattern we've adopted elsewhere.
- **Affected endpoints:** `POST /xero/sync-contacts`, `POST /xero/push-invoice` (called from contracts).
- **Suggested fix shape:** Apply `sanitiseProviderError` (or a Xero-specific sanitiser with similar categories) at each catch block. Same pattern PR #131 + PR #132 used. Estimated 1–2 hours.

### Minor

**m1 — `forms.admin` permission declared but unused**

- **File:** `apps/api/src/common/permissions/permission-registry.ts:33`
- **What:** Permission code `forms.admin` declared with description "Delete templates, view all submissions, manage schedules" but never enforced anywhere — no `@RequirePermissions("forms.admin")`, no `hasPermission("forms.admin")` call.
- **Why minor:** Likely intentional placeholder for Phase 2 of Forms Engine (PR #97 ship + scope decisions). No security impact — just unused metadata. Suggested fix: either delete the entry, or wire it up in Forms admin endpoints if/when those tighten gating.

**m2 — Dead `GeminiProvider` and `GroqProvider` classes in `tendering/ai-providers/`**

- **Files:** `apps/api/src/modules/tendering/ai-providers/gemini.provider.ts`, `groq.provider.ts`
- **What:** Both classes implement `AiProvider` interface but have zero imports anywhere post-PR #132. The new ai-providers module (PR #124) doesn't have Gemini/Groq either — only Anthropic and OpenAI are wired into the persona system.
- **Why minor:** ~150 LOC of dead code, no functional impact. Cleaner to delete in a small follow-up. Adding Gemini/Groq back later would happen as new files in `apps/api/src/modules/ai-providers/providers/` (the new pattern), not by reviving these legacy classes.
- **Suggested fix shape:** Delete both files in a small follow-up chore PR.

**m3 — Migration drift: `workers.employmentType` stray column on CI / fresh DBs**

- **Files:** `apps/api/prisma/migrations/202604020004_worker_employmenttype_compat/migration.sql`
- **What:** That migration adds `employmentType` column; no later migration drops it. `schema.prisma` declares `employment_type` only. Local audit machine has the stray column dropped (via auto-generated drift cleanup applied during prior `migrate dev` runs); fresh CI DBs don't.
- **Why minor:** Not exploitable, not user-visible. Prisma client never queries `employmentType` so runtime isn't affected. Captured as long-running PHASE 6 entry "Audit migration history vs current schema" — no new tracking needed.

### Observations

- **o1 — Codebase has zero TODO/FIXME/HACK/XXX comments.** Either disciplined hygiene or tracked-elsewhere. No action needed.
- **o2 — `directory.finance` permission gated inline (not via decorator)**, by design since PR #75. Documented behaviour. Continues to work; flagged for visibility only.
- **o3 — `ai.persona.tendering` gated via `PersonaPermissionGuard`** (custom guard reading `persona.permissionRequired`), not via decorator. Same design pattern as `directory.finance` — registry permission used at runtime, not at decorator time.
- **o4 — Two `ai-providers/` directories** (legacy `tendering/ai-providers/` for one-shot scope drafting, new `ai-providers/providers/` for streaming chat). Not duplication — different APIs and use cases. Future provider consolidation could collapse them, but it's a refactor not a fix.
- **o5 — SharePoint `testConnection()` reflects Microsoft Graph errors to admin caller** at `sharepoint.service.ts:112`. Admin-only endpoint; error text is upstream Graph API. Low-risk; acceptable for admin debugging UX.
- **o6 — Email test endpoint reflects mail-provider SDK errors to admin caller** at `email.service.ts:177–178`. Admin-only test path; err.message comes from OAuth/SMTP libs. Low-risk; acceptable.

---

## Recommendations (priority order)

| # | Action | Disposition |
|---|---|---|
| 1 | **M1 — Apply `sanitiseProviderError` (or Xero-specific equivalent) to Xero service catch blocks** | Fix in dedicated PR. ~1–2 hours. Same pattern as PRs #131/#132. |
| 2 | **m2 — Delete dead `GeminiProvider` and `GroqProvider` classes** | Add to PHASE 6 OR fix in a tiny follow-up chore PR (~15 min). |
| 3 | **m1 — Resolve `forms.admin` aspirational entry** | Add to PHASE 6 with a note linking to Forms Engine Phase 2 items. Decide at that time whether to wire up or delete. |
| 4 | **m3 — Migration history audit** | Already tracked in PHASE 6 ("Audit migration history vs current schema"). Confirm tracking, no new entry. |
| 5 | **o5 / o6 — SharePoint and Email error reflection** | No action needed. Admin-only paths, low risk. Document as acceptable in code comments if/when M1 lands so future readers know the pattern was deliberately scoped. |

---

## Audit metadata

- **Sections completed:** all (1, 2, 3)
- **Time taken:** ~25 minutes
- **Files touched by audit:** only this report (`docs/audits/2026-05-02-system-audit.md`)
- **No code changes, no migrations, no DB writes, no PRs opened.**

The audit branch `audit/2026-05-02-system-snapshot` contains exactly one commit: this report file. Marco can read, then either merge to capture the snapshot in main's history, or leave the branch unmerged as a point-in-time artefact.
