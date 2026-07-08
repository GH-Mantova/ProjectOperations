# 01 — Charter & Architecture

**The single canonical charter for ProjectOperations.** Company context, staff, permission
roles, environment + env-vars, tech stack, brand/design tokens, architecture rules, code
conventions, git/PR discipline, business logic (estimating / Cutrite schedule / densities),
module registry, and integration detail. Read this before writing any code.

> **Merged from** (sot-consolidation, 2026-07-08): primary `project_instructions.md` §1–§16,
> plus the conventions of root `CLAUDE.md` and `docs/architecture-overview.md`,
> `docs/sharepoint-local-workflow.md`, `docs/sso-entra-setup.md`, `docs/dev-to-prod-workflow.md`
> (folded into the appendix below §16). The old chat-routing header and §17 (support-chat
> roles) / §18 (main-chat operating rules) now live in **`sot/README.md`**; §19 (Cowork local
> diagnostic agent) now lives in **`docs/diagnostics/README.md`**. Full `.env` reference with
> descriptions remains authoritative in **`.env.example`**.

---

## TABLE OF CONTENTS

| Section | Title | Key content |
|---------|-------|-------------|
| §1 | Company | Staff roster, permission roles |
| §2 | Vision | ERP goals and scope |
| §3 | Environment | Repo, local path, DB, URLs |
| §4 | Tech Stack | API, frontend, CI/CD, integrations |
| §5 | Brand | Colours, fonts, rules |
| §6 | Architecture Rules | Code rules, CI checklist, PR rules, token budget |
| §7 | Environment Variables | Key `.env` keys (full reference in `.env.example`) |
| §8 | User Types | InternalUser, WorkerProfile, portal users, JWT rules |
| §9 | Sidebar Navigation | Definitive sidebar structure |
| §10 | Estimating Domain | Scope codes, cost sections, scope/quote structure, waste, densities, cutting, core holes |
| §11 | Business Logic Sanity Checks | Quick-reference verification table |
| §12 | Dashboard System | Widget categories, grid rules, custom builder |
| §13 | Module Registry | All live modules, known issues, next priorities |
| §14 | Integrations Detail | SharePoint, Xero, MYOB specifics |
| §15 | Autonomous PR Chain | progress-log format, bypass actor, audit schedule |
| §16 | Planned Integrations | Not yet built |
| — Appendix | Conventions & Architecture | Workspace/aliases, commands, TypeScript rules, code conventions, git/PR workflow, Prisma/seed/pnpm discipline, architecture overview, V2 architecture delta, SharePoint+local workflow, M365 SSO/Entra setup, dev-to-prod workflow |

**Quick navigation for common tasks:**
- "What modules are live?" → §13
- "How does cutting work?" → §10
- "What are the brand colours?" → §5
- "How do I run a PR chain?" → §15
- "What's the sidebar structure?" → §9
- "What field types does Forms support?" → §13 Forms Engine
- "How does the quote PDF work?" → §10 Quote structure
- "What env vars are needed?" → §7 (+ `.env.example`)

---

## SECTION 1 — COMPANY

**Initial Services Pty Ltd** — Brisbane contractor.
Disciplines: demolition, Class A+B asbestos removal, civil works.

### Key Staff

| Name | Role | Email | Phone |
|------|------|-------|-------|
| Sean Lattin | Company Director | sean@initialservices.net | 0400 850 723 |
| Colin Hanlon | Operations Manager | colin@initialservices.net | 0447 803 617 |
| Beau Murphy | Project Manager | beau.m@initialservices.net | 0400 083 565 |
| Marco Mantovaninni | WHS & Commercial Compliance | marco@initialservices.net | 0487 373 415 |
| Raj Pudasaini | Senior Estimator | estimating@initialservices.net | 0421 140 248 |
| Amy Russian | Accounts Payable/Receivable | admin@initialservices.net | (07) 3888 0539 |
| Matthew Knox | Warehouse Manager | warehouse@initialservices.net | 0407 923 006 |

### Permission Roles
- Sean Lattin: Super User (bypasses all permission checks via isSuperUser in JWT)
- Colin Hanlon: Admin
- Marco Mantovaninni: Admin + WHS officer + safety.admin + compliance.admin
- Beau Murphy: Project Manager
- Raj Pudasaini: Senior Estimator
- Amy Russian: Accounts (finance.manage)
- Matthew Knox: Warehouse Manager

---

## SECTION 2 — VISION

A full company ERP replacing all Excel, paper, and disconnected SaaS tools.
Equivalent to: Assignar + Buildertrend + Hammertech + Procore + Simpro +
SiteDocs + AssetTiger + Monday CRM + Pipedrive — tailored to IS workflows.

One platform. One source of truth. Desktop for office, mobile web for field.

---

## SECTION 3 — ENVIRONMENT

| Item | Value |
|------|-------|
| Repo | https://github.com/GH-Mantova/ProjectOperations |
| Local path | C:\ProjectOperations2 |
| Database | Docker — project-operations-postgres / project_operations |
| Dev login | admin@projectops.local / Password123! |
| Claude Code flag | always use --dangerously-skip-permissions |
| CLAUDE.md | Repo root — Claude Code reads automatically each session |
| project_instructions.md | Repo root — fetch via blob URL |
| progress.md | Repo root — fetch via blob URL |
| roadmap.md | Repo root — fetch via blob URL |

### Key URLs (use blob URL — raw CDN has delays)
- Instructions: https://github.com/GH-Mantova/ProjectOperations/blob/main/project_instructions.md
- Progress: https://github.com/GH-Mantova/ProjectOperations/blob/main/progress.md
- Roadmap: https://github.com/GH-Mantova/ProjectOperations/blob/main/roadmap.md

---

## SECTION 4 — TECH STACK

| Layer | Technology |
|-------|-----------|
| API | NestJS + Prisma + PostgreSQL |
| Frontend | React + Vite + Recharts + @dnd-kit |
| Monorepo | pnpm workspaces |
| CI/CD | GitHub Actions → Azure |
| Auth | JWT (local) + M365 SSO |
| Documents | SharePoint via Microsoft Graph API |
| Accounting | Xero (OAuth2) + MYOB (CSV export) |
| Mobile | PWA + IndexedDB offline |
| Planned | WebSockets, Web Push notifications |

---

## SECTION 5 — BRAND (permanent — never change without explicit instruction)

| Token | Value | Usage |
|-------|-------|-------|
| Black | #000000 | Primary text, dark backgrounds |
| Teal | #005B61 | Primary brand, sidebar, headers |
| White | #FFFFFF | Light backgrounds, text on dark |
| Orange | #FEAA6D | ALL interactive elements (buttons, links, CTAs) |
| Dark Grey | #242424 | Secondary backgrounds |
| Light Grey | #F6F6F6 | Page backgrounds, card backgrounds |
| Font — body | Outfit | All body text, labels, inputs |
| Font — headings | Syne | h1, h2, h3 only |

Rules:
- Dark background → light text. Always.
- Always use CSS variables — never hardcode colour values.
- Orange is reserved for interactive elements only — never decorative use.

---

## SECTION 6 — ARCHITECTURE RULES (always apply, no exceptions)

### Code rules
- Read existing files before writing any code — always
- All $ calculations server-side — never trust or compute on frontend
- Prisma: `migrate deploy` on main — never `migrate dev` on main
- `pnpm build` + lint must pass before any PR
- `pnpm compliance:smoke` after every migration
- `pnpm seed` must run without errors after every migration (idempotent)
- Swagger decorators on ALL new API endpoints
- Migration names: `YYYYMMDD_feat_description`
- New pages: ShellLayout (desktop) or FieldLayout (mobile) — never create new shells
- Permissions pattern: `module.view` / `module.manage` / `module.admin`
- Dashboard widgets: always register in `widgetRegistry.ts`
- Drag and drop: `@dnd-kit` only, `PointerSensor` with `distance: 8`
- Notifications: always go through `NotificationsService` — never send directly
- GPS/location: always capture with user consent, store with timestamp + accuracy
- Documentation updates — **charter vs. roadmap/progress split** (doc-reconcile model, 2026-07-08): the **charter** (this file, `sot/01`) is updated inline in the same PR that changes a module, rule, or architecture decision. **Roadmap (`sot/02`) and progress (`sot/03`) are owned by a dedicated doc-reconcile PR** — feature/fix PRs must NOT edit their `Last updated:` headers, restate phase status, or append per-PR status blocks. (This kills the recurring header merge conflict that arose when parallel PRs each bumped the timestamp; see `sot/README.md` → SoT sweep policy.) The pre-commit hook auto-stamps `Last updated:` — never edit that line manually.
- PDF generation uses HTML→PDF renderer (Phase 5A.2 onwards). New PDF outputs are HTML templates, rendered via the shared renderer service. Do not add new PDFKit code — that engine is being retired.
- AI features integrate via the persona registry (Phase 5A.1 onwards). Do not add ad-hoc AI calls in modules. New AI capabilities belong inside a persona's sub-mode tool list. New personas register in the persona module, not in the consuming module.
- AI provider resolution always uses the three-tier fallback in `AiProvidersService.resolveChosenProvider`: explicit user persona choice → `PlatformConfig.preferredProvider` → first provider with a saved company `*KeyEncrypted` column. Never call provider clients with a null/undefined provider; never default to a hardcoded provider literal in new code paths. When no key is available throw `ProviderNotConfiguredError(provider)` so the user-facing message names which provider failed.
- Persona tools register via `ToolHandlerRegistry`. New tool handlers implement `ToolHandler` from `apps/api/src/modules/personas/tools/tool-handler.types.ts`, are registered as NestJS providers in their owning module, and call `registry.register(...)` + `registry.bindToSubMode(...)` in `onModuleInit`. The multi-turn dispatcher (`PersonaDispatcherService`) handles the call-model → run-tools → feed-results-back loop with a 10-turn cap and 8-parallel-call cap. Do not add ad-hoc tool dispatch in controllers or services — every tool flows through the registry so behaviour stays consistent (parallel execution, error-as-tool-result, persistence with USER/INTERNAL visibility, side-effect SSE forwarding).
- **No compiled output in source directories** (PR #156). `apps/web/src/` contains TypeScript sources (`.tsx`, `.ts`) only. Vite is responsible for compilation; `.js` files alongside `.tsx`/`.ts` sources are stale tsc output and must not be tracked. The `.gitignore` lines `apps/web/src/**/*.js` and `apps/web/src/**/*.js.map` enforce this. `apps/web/tsconfig.tsbuildinfo` is also gitignored — TypeScript's incremental build cache is machine-specific. If `.js` files reappear in `apps/web/src/` locally (e.g., from a stray `tsc --build`), they're safe to delete with `find apps/web/src -name "*.js" -type f -delete`; the existing `.gitignore` keeps them out of commits. The Vite resolver in `apps/web/vite.config.ts` lists `.tsx` before `.js` in `resolve.extensions`, so `.tsx` is unambiguously authoritative — `.js` siblings are never bundled. The original leak source (identified in PR #157, 2026-05-16) was
apps/web/package.json's `build` script using `tsc -b` (TypeScript build mode). Build mode inherently emits compiled output for any composite project in the reference chain, regardless of `--noEmit` config or CLI flag. **Never use `tsc -b` in this project for build gating** — use `tsc --noEmit -p <config>` instead, which respects the no-emit intent. The `-b` flag is only correct if you actually want emission to a designated `outDir` (e.g. the `tsconfig.tendering-smoke.json` flow which intentionally emits to `.tmp-smoke/`).
- **Avoid mirror tests for prompt assembly** (PR #160). When testing system-prompt shape or LLM behaviour, call the production assembly function directly (e.g., `intrinsicPrompt(persona, subMode)` from `apps/api/src/modules/ai-providers/ai-providers.service.ts`) rather than reimplementing the concatenation logic in-test. Reconstructions diverge silently when the production function changes — a class of false-confidence bug we were bitten by between PR #152 (added `GLOBAL_RATE_FABRICATION_PROHIBITION` prefix to `intrinsicPrompt()`) and PR #160 (fixed the divergence in `tendering-assistant.system-prompt.regression.spec.ts`). Exception: tests asserting structural properties of persona or sub-mode *definitions* (e.g., "this sub-mode description contains the RATE_LOOKUP policy block") correctly inspect those definitions directly; that's narrower than full prompt assembly and is the right unit for those assertions.
- **Hierarchical wbsCode shape** (PR B1 backend, 2026-05-16). Item wbsCodes are dotted: `${discipline}${cardNumber}.${itemNumber}` (e.g. `DEM1.1`, `DEM1.2`, `CIV2.5`). `cardNumber` is per-(tenderId, discipline) and **never reused** — deleted card numbers stay burned. The combo `(tenderId, discipline, cardNumber)` is `@@unique` on ScopeCard. `itemNumber` is per-card (NOT per-discipline as in legacy code). When creating items via the new API, use `POST /tenders/:tenderId/scope/cards/:cardId/items` and let the service compute the wbsCode. Legacy `POST /scope/items` and the proposals.acceptProposal flow still work via `getOrCreateCardForDiscipline` — they reuse the first card for the discipline. Discipline-change cascade: `PATCH /scope/cards/:cardId { discipline: "XXX" }` reissues `cardNumber` in the new discipline and rewrites every linked item's `wbsCode` plus cutting/waste `wbsRef` atomically in a `$transaction`. Card deletion is blocked (409) when the card has items — caller must move or delete items first.
- **Scope cards own discipline** (PRs A2 + A2.5, 2026-05-16). `ScopeCard.discipline` is the **SOLE authoritative** discipline field for scope items. `ScopeOfWorksItem.discipline` was dropped in PR A2.5; reading discipline from a scope item requires loading the related card (`include: { card: true }` or `select: { card: { select: { discipline: true } } }` in Prisma queries, then `item.card?.discipline`). Filtering and ordering by discipline use nested Prisma syntax: `where: { card: { discipline: ... } }`, `orderBy: { card: { discipline: ... } }`. Writing a new scope item: look up or create the parent card via `getOrCreateCardForDiscipline(tenderId, discipline, actorId)` (helper in `ScopeOfWorksService`) and pass `cardId` to the create — do NOT try to pass `discipline:`, the column no longer exists. The discipline → card-name + sortOrder defaults live in `apps/api/src/modules/tendering/scope/card-defaults.ts` (`SCOPE_CARD_DEFAULTS`, `getScopeCardDefault`) — both the seed and the A2 data migration use the same mapping. Cascade behaviour: deleting a tender deletes its cards (CASCADE on tenderId); deleting a card sets `card_id = NULL` on linked items (SetNull, preserves child data). `ScopeWasteItem.discipline`, `ScopeViewConfig.discipline`, `ClaimLineItem.discipline`, and `gantt_tasks.discipline` are separate columns and unaffected — may be migrated in future cleanup PRs.
- **IS discipline codes — canonical 4-code system** (PR A1, 2026-05-16). The single source of truth is `apps/api/src/modules/personas/definitions/disciplines.ts`. The canonical codes are `DEM` (Demolition — covers both strip-outs and structural demolition), `CIV` (Civil works), `ASB` (Asbestos removal), and `Other` (provisional sums, cost options, adjustments — broader than just PS). Every consumer imports `IS_DISCIPLINE_CODES`, `IS_DISCIPLINE_LABELS`, or `IS_DISCIPLINE_DESCRIPTIONS` from there — do not inline literal arrays. The legacy 5-code system (SO/Str/Asb/Civ/Prv) is migrated via the `20260516000000_chore_discipline_code_migration` Prisma migration; the `LEGACY_DISCIPLINE_MIGRATION_MAP` is for historical reference only, not for new code. Strip-out vs fit-out disambiguation lives inside the unified DEM description and is regression-tested. Discipline display order is always `DEM → CIV → ASB → Other`. Test coverage in `discipline-codes.spec.ts`.
- **Scope item dimensions — frontend-is-source-of-truth contract** (PR B4a + B4a.5, 2026-05-17). Scope items carry seven dimension fields: four raw inputs (`length`, `height`, `depth`, `density`) and three derived-or-override slots (`sqm`, `m3`, `tonnes`). The pure helper `computeDerivedDimensions` lives in **two synchronised files**: `apps/api/src/modules/tendering/scope-item-dimensions.ts` (canonical) and `apps/web/src/pages/tendering/scopeItemDimensions.ts` (frontend mirror for live preview). Keep them byte-equivalent. Math: `sqm = explicit ?? length × height`; `m3 = explicit ?? sqm × depth`; `tonnes = explicit ?? (m3 × density when m3 > 0) ?? (sqm × density / 1000 when sqm > 0)`. The sqm-fallback divides by 1000 because density is treated as kg/m² for sheet materials. **The frontend is the source of truth for what each dimension field should hold** (PR B4a.5 — the earlier B4a hybrid-derive backend was removed because the DB can't distinguish a stored override from a stored derivation, leaking the wrong behaviour in either direction). The frontend uses controlled inputs and tracks per-field `dirty` state for sqm/m3/tonnes — only currently-dirty fields count as overrides; persisted-but-not-edited values are treated as null (= derive) so cascading recompute fires when a raw input changes. On blur, the frontend ships **all 7 dimension values** in a single PATCH (raw inputs + the value currently shown for each derived field — override if dirty, derived otherwise). The backend persists what arrives — `deriveDimensionFields` in `scope-of-works.service.ts` is a passthrough. Legacy `ScopeOfWorksItem.unit` + `value` are `@deprecated PR B4a` (retained for backward compat; cleanup PR drops them). `chargeBy` is a stored column but NOT surfaced on the scope item card UI — it's set by the waste subtable based on the facility's rate.unit (PR B4a.5 design decision).
- **Authorization is a config layer — not hard-coded policy** (PR #479, 2026-07-04). All approval/authority ceilings resolve through `AuthorityService` against the `AuthorityRule` model. Rules are Director-configurable at runtime; do NOT add hard-coded role→limit tables in feature modules. New approval flows call the service with `(subjectType, subjectId, action, amount?)` and consume the returned decision (allow / route-to / block) — feature code never inspects roles directly to decide authority. The default rule set ships "config-open" (permissive) so that the seam is exercised end-to-end before the Director locks ceilings; feature work must not rely on the default staying permissive.
- **Org reporting hierarchy is `User.managerId`** (PR #478, 2026-07-04). The single source of truth for who reports to whom is the `User.managerId` self-relation, guarded against cycles at write time. Consumers (authority routing, notifications, approvals) traverse `managerId` upward — do not introduce parallel org-graph tables. The admin surface for editing hierarchy lives in the users admin screens.
- **Forms Engine v2 — plan of record** (PR #482, 2026-07-05). Forms Engine v2 is the authoritative design for post-Authoring-v1 forms work. New forms features build on top of Authoring v1 (PR #481) and the v2 plan; do not resurrect legacy Forms Engine patterns removed by that plan. The plan-of-record document is the source of truth for section/field shape, rules-engine behaviour, and submission lifecycle.
- **Native inventory / stock replaces Asset Tiger** (PR #484, 2026-07-06). Stock-level workflows now use the native `Inventory` / `StockItem` layer. Do not add new integrations against the retired Asset Tiger adapter; extend the native layer instead. Slice 1 (#484) ships schema + service seam; further slices are tracked in the roadmap Native Inventory lane.
- **Rates & Lists R0 — typed RateTable + `resolveRate` seam; lists are descriptive** (PR #485, 2026-07-07). Rates flow through the typed `RateTable` model and are resolved via the `resolveRate(subject, context)` seam — do not read rate values directly from feature-owned columns. Lists follow the descriptive-only "listify" rule: a list defines what values exist, not what they mean; enforcement of business rules stays in the consuming service. New rate-consuming code paths must call `resolveRate` and handle the "no rate configured" case explicitly rather than defaulting to zero/undefined.
- **Rate-handling prohibition precedence** (PR #161). The `GLOBAL_RATE_FABRICATION_PROHIBITION` baseline in `apps/api/src/modules/personas/definitions/shared-prompts.ts` is the authoritative rule for rate handling. Per the prefix's own precedence section, it can ONLY be EXTENDED (made stricter, augmented with tool-call mandates) by later instructions. It CANNOT be LOOSENED by any later layer, including company instructions (`PersonaCompanyInstruction.instruction`), user instructions (`UserPersonaSettings.instructionOverride`), or sub-mode descriptions. When adding new persona logic that touches rate quoting, your instructions either extend the rule (call a rate tool first; pull from a specific schedule) or surface a conflict to the user — never quietly relax the prohibition. Test coverage for the precedence behaviour lives in `apps/api/src/modules/ai-providers/__tests__/ai-providers.service.spec.ts` under the "resolveSystemPrompt — rate-fabrication prohibition precedence" describe block, exercised against hostile company, hostile user, and combined hostile inputs.

### Pre-PR CI checklist (mandatory — fix ALL before pushing)
1. `pnpm --filter @project-ops/api lint` — zero warnings, zero errors
2. `pnpm --filter @project-ops/web lint` — zero warnings, zero errors
3. `pnpm --filter @project-ops/api test` — zero failures
4. `pnpm --filter @project-ops/web test` — zero failures
5. `pnpm build` — both packages must succeed
6. `pnpm compliance:smoke` — must pass
7. `npx playwright test tests/e2e/tendering.spec.ts --project=chromium` — all pass
8. Charter (`sot/01`) updated inline **if** this PR changes a module, rule, or architecture. Do NOT append a roadmap/progress entry here — `sot/02`/`sot/03` are batched by the doc-reconcile PR (see `sot/README.md`). The hook stamps `Last updated:` automatically on commit — no manual stamp needed.
Never open a PR with known CI failures. Fix locally first, then push.

### PR rules
- Combine all related fixes into one prompt unless:
  1. Hard schema dependency — PR B cannot branch until PR A merges
  2. Risk isolation — risky schema change separate from safe UI change
- Token budget is NEVER a reason to split PRs — always pause and resume
- Auto-merge at end of every PR prompt:
```
gh pr create \
  --title "..." \
  --body "..." \
  --reviewer GH-Mantova \
&& gh pr merge --auto --squash
```
- Auto-merge head-race: if auto-merge stalls with "head branch not up to date":
  `gh pr merge [N] --admin --squash`
  This is a known GitHub race condition — handle automatically, do not wait.

### Token budget rule (include in every Claude Code prompt)
TOKEN BUDGET: If approaching context limit, finish the current file, run
lint, commit with message "wip: [branch-name] — pausing for token reset",
push the branch, then STOP and wait. Do not open the PR yet. When resumed,
continue from where you left off and complete all remaining tasks before
opening the PR.

### PR numbering convention
Chain PRs have conceptual numbers (#83.1) that may differ from GitHub's
sequential numbers when hotfixes are inserted. Always record BOTH in progress.md:
  Chain PR: #83.1 (conceptual)
  GitHub PR: #84 (actual GitHub number)

---

## SECTION 7 — KEY ENVIRONMENT VARIABLES

These must exist in `.env` for the system to function correctly.
See `.env.example` for full reference with descriptions.

```
# SharePoint
SHAREPOINT_MODE=live|mock
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
SHAREPOINT_SITE_ID=
SHAREPOINT_DRIVE_ID=
SHAREPOINT_ROOT_FOLDER=Project Operations

# Xero
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=
XERO_REDIRECT_URI=
XERO_SCOPES=

# Portal
PORTAL_JWT_SECRET=
PORTAL_JWT_EXPIRY=
PORTAL_PUBLIC_URL=
```

---

## SECTION 8 — USER TYPES

| Type | Model | Auth | Access |
|------|-------|------|--------|
| InternalUser | User | JWT (local) + M365 SSO | Full ERP (ShellLayout) |
| WorkerProfile | WorkerProfile | JWT or mobile-only | Field routes (FieldLayout) |
| ClientPortalUser | ClientPortalUser | Separate portal JWT | /portal/client only (PortalLayout) |
| SubcontractorContact | (planned) | Separate portal JWT | /portal/sub only (planned) |

### JWT rules
- Staff JWT payload: `{ sub, email, role, isSuperUser, permissions[] }`
- Portal JWT payload: `{ sub, email, type: 'client_portal', contactId, clientId }`
- `JwtAuthGuard` rejects any token where `type === 'client_portal'`
- `PortalAuthGuard` accepts ONLY tokens where `type === 'client_portal'`
- `isSuperUser: true` bypasses ALL permission checks — no guard can block Sean

### Layouts
- `ShellLayout` — desktop, sidebar nav, internal users
- `FieldLayout` — mobile-optimised, bottom nav, field workers (`/field/*`)
- `PortalLayout` — minimal IS-branded, no sidebar, external users (`/portal/*`)

---

## SECTION 9 — SIDEBAR NAVIGATION (definitive — do not deviate)

```
COMMERCIAL
  Tendering          → /tenders/pipeline
  Contracts          → /contracts

OPERATIONS
  Projects           → /projects
  Jobs               → /jobs
  Scheduler          → /scheduler
  Sites              → /sites
  Assets             → /assets
  Maintenance        → /maintenance
  Forms              → /forms
  Safety             → /safety

FIELD (FieldLayout, mobile only — bottom nav)
  Allocations        → /field/allocations
  Pre-start          → /field/pre-start
  Timesheet          → /field/timesheet
  Safety             → /field/safety

DIRECTORY
  Clients            → /clients
  Subcontractors     → /directory/subcontractors
                       (label: "Subcontractors & Suppliers" — truncate to "Subcontractors"
                        in sidebar if needed, full label in page header)
  Contacts           → /directory/contacts

PLATFORM
  Dashboard          → /dashboards  (+ button creates new dashboard)
  Compliance         → /compliance
  Documents          → /documents
  Archive            → /archive

ADMIN (Admin + Super User only — hidden for all other roles)
  Admin Settings     → /admin/settings
  Rates & Lists      → /admin/estimate-rates
```

---

## SECTION 10 — ESTIMATING DOMAIN (permanent business logic)

### Scope codes (canonical 4-code system)

Canonical source: `apps/api/src/modules/personas/definitions/disciplines.ts`

| Code  | Discipline |
| ---   | --- |
| DEM   | Demolition |
| CIV   | Civil works |
| ASB   | Asbestos removal |
| Other | Provisional, cost options, adjustments, and anything that doesn't fit DEM/CIV/ASB |

### Migration history

PR A1 (2026-05-16) migrated from a legacy 5-code system to the
current 4-code system. Old code references in pre-2026-05-16
progress.md entries, persona regression specs, and commit
messages map as follows:

| Legacy code                   | Current code |
| ---                           | ---          |
| SO  (Strip-outs)              | DEM          |
| Str (Structural demolition)   | DEM          |
| Asb (Asbestos removal)        | ASB          |
| Civ (Civil works)             | CIV          |
| Prv (Provisional sums)        | Other        |

Both Strip-outs and Structural demolition collapsed into Demolition
(DEM). Provisional sums moved into Other because the
discipline-tagging system shouldn't be polluted by line-item types
(provisional, cost-option, adjustment) that aren't actually
disciplines.

### Cost sections (display order)
Labour → Equip & Sub → Plant → Disposal → Cutting

### General estimating rules
- Default markup: 30% per item (editable per job)
- Labour formula: Qty × Days × Rate (Day / Night / Weekend)
- Plant: wet hire (operator included) vs dry hire (separate operator cost line)
- Payment terms default: 25 days EoM (editable per client)
- All prices ex-GST. GST added at invoice stage.
- Quote validity: 30 days from issue or end of financial year (whichever first)
- AI scope drafting: IS disciplines only — never MEP, fit-out, painting,
  or new construction

### Waste
- Cascade: Group → Type → Facility
- Unit: per tonne OR per m³ (user selects per line item)
- Truck days: user-defined inputs per job:
  - Waste volume or tonnage
  - Truck capacity (m³ or T per load)
  - Expected loads per day (based on job location + tip site distance)
  - Number of trucks allocated
  All inputs user-editable. No fixed formula.

### Scope item structure (3 linked components per WBS)

Each WBS item (SO1, Str1, Asb1 etc.) has up to 3 linked components:

**Component 1 — Resource (primary):**
  The main scope line. Contains:
  - WBS code (e.g. SO1, Str1, Asb1)
  - Description (user-written)
  - Measurements: qty + unit — documents pricing basis (e.g. "285 m²
    of plasterboard wall, 2.7m high, 13mm thick"). Multiple
    measurements allowed (display as pills). Purpose is to explain
    and calculate Lm/area/volume of the item being priced.
  - Labour: Days × Rate (Day/Night/Weekend)
  - Plant items: multiple allowed per row (JSON array, pill display).
    User can add new plant columns — each column has equipment name,
    qty, days, rate. No limit on plant columns per WBS item.
    ⚠️ Plant items APPEND to array — never replace existing items.

**Component 2 — Waste (linked via WBS code):**
  Separate component linked to the resource via matching WBS code.
  NO labour or resource data on waste component.
  Captures: Group → Type → Facility cascade, **tonnes AND m³** (both
  persisted per row since PR B4a), loads, rate per billing unit,
  rate/load. Truck days: user-defined per job (not a formula).
  Billing-unit selection: each row's `unit` mirrors the chosen
  facility's `rate.unit` (read-only "Billed by" badge in the UI). The
  line total bills against whichever side matches: `unit === "m³"`
  uses `m3 × ratePerTonne`; else `wasteTonnes × ratePerTonne`. The
  facility filter is (group, type) only — picking a facility writes
  its rate unit forward.
  Displayed in Waste tab of Scope of Works editor.

**Component 3 — Cutting/Coring (linked via WBS code):**
  Separate component linked to the resource via matching WBS code.
  Captures: equipment, elevation, material, depth, method, area/count.
  Displayed in Cutting tab of Scope of Works editor.

### Quote structure

- Cost lines: per-quote, user-named (A, B, C etc.), editable labels
  and values. Each line has isVisible toggle — hidden lines are
  excluded from PDF but preserved in the editor.
  ⚠️ Cost line labels are editable — never assume fixed names.
- Section visibility: each section independently toggleable:
  showScopeTable | showAssumptions | showExclusions |
  showReferencedDrawings | showProvisionalSums | showCostOptions
- Simple mode: cost summary + assumptions + exclusions + T&C only
- Detailed mode: simple + full scope of works table
- Simple↔Detailed toggle shows toast confirming scope items preserved
- Reset button: returns quote to default layout from scope data
  (requires confirmation dialog — destructive action)
- "Copy IS template exclusions": populates IS standard exclusion
  clauses (7 standard clauses). Copies from IS template, not from
  the tender's scope.

### Material densities (reference Australian Standards)
Always allow user to override per job. Add new materials citing source.

| Material | Density | Reference |
|----------|---------|-----------|
| Concrete (normal) | 2.40 T/m³ | AS 1379 |
| Concrete (reinforced) | 2.45 T/m³ | AS 1379 |
| Concrete (heavy/high density) | 2.70–3.00 T/m³ | AS 1379 |
| Asphalt (dense graded) | 2.30 T/m³ | Austroads |
| Brick/masonry (clay) | 1.80–2.00 T/m³ | AS 3700 |
| Brick/masonry (concrete block) | 2.00–2.20 T/m³ | AS 3700 |
| Timber (structural hardwood) | 0.80–1.10 T/m³ | AS 1720 |
| Steel | 7.85 T/m³ | AS 4100 |
| Soil (general fill) | 1.60–1.80 T/m³ | AS 1289 |
| Soil (compacted) | 1.80–2.10 T/m³ | AS 1289 |
| Gravel/crushed rock | 1.50–1.80 T/m³ | AS 1289 |

### Cutting (Cutrite schedule of rates)

**CRITICAL: Cutting uses a schedule rate lookup — NOT a formula with multipliers.**

Rate = look up from schedule: Equipment × Elevation × Material × Depth → discrete $ rate

**Elevations for cutting (two only):**
- Floor — has its own rate column in schedule
- Wall — has its own SEPARATE rate column in schedule
- ⚠️ Wall is NOT a multiplier on Floor — it is a completely different rate
- ⚠️ Inverted elevation does NOT exist for cutting — core holes only

**Method multiplier (applied ON TOP of schedule rate):**
- Petrol = 1.0× (no change to schedule rate)
- High-frequency / Low-emission = 1.25× (25% premium)

**Equipment rules:**
| Equipment | Allowed elevations | Allowed methods |
|-----------|-------------------|-----------------|
| Roadsaw | Floor only | Petrol, Low-emission |
| Demosaw | Floor, Wall | High-freq, Petrol, N/A |
| Ringsaw | Floor, Wall | High-freq, Petrol, N/A |
| Flush-cut saw | Floor, Wall | High-freq, Petrol, N/A |
| Tracksaw | Floor, Wall | Petrol, N/A |

**Materials:** Asphalt | Concrete | Masonry

### Core holes (separate schedule from cutting)

Rate = look up from core hole schedule by diameter (32mm to 650mm)

**Elevation multipliers for core holes:**
| Elevation | Multiplier |
|-----------|-----------|
| Floor | 1.0× (base rate, no change) |
| Wall | 1.1× |
| Inverted | 2.0× |

⚠️ Inverted elevation exists for CORE HOLES ONLY — never for cutting.

---

## SECTION 11 — BUSINESS LOGIC SANITY CHECKS

**Verify these before writing ANY estimating code. If anything seems wrong: STOP and confirm with user.**

| Rule | Correct behaviour |
|------|------------------|
| Cutting rate model | Schedule lookup (Equipment × Elevation × Material × Depth) — NOT base × multiplier |
| Wall elevation (cutting) | Separate rate column — NOT 1.1× multiplier on floor rate |
| Inverted elevation | Core holes ONLY — never applies to cutting |
| Core hole Wall multiplier | 1.1× applied to core hole schedule rate |
| Core hole Inverted multiplier | 2.0× applied to core hole schedule rate |
| Cutting method multiplier | Petrol=1.0× HF/LE=1.25× — applied after schedule rate lookup |
| Truck days | User-defined inputs per job — no fixed formula |
| Default markup | 30% per item — editable per job |
| Payment terms | 25 days EoM — editable per client |
| Material densities | Reference Australian Standards — always allow user override |
| Safety sidebar location | OPERATIONS section (not Platform, not Forms) |
| Compliance sidebar location | PLATFORM section |
| Dashboard entry | PLATFORM — single "Dashboard" item with "+" to create new |
| Duplicate dashboard | Must not exist — only one dashboard entry in sidebar |
| Portal token on staff endpoints | Must be REJECTED — JwtAuthGuard blocks type=client_portal |
| isSuperUser | Bypasses ALL permission checks — Sean Lattin only |
| Scope item components | 3 per WBS: resource (primary), waste (linked via WBS), cutting (linked via WBS) |
| Waste data location | Waste component is SEPARATE — no waste data on resource component |
| Multiple plant per WBS | JSON array — APPEND not replace. User adds new columns. |
| Measurements on resource | For pricing basis only — Lm/area/vol. Multiple measurements as pills. |
| Quote cost line visibility | isVisible toggle per line — hidden = excluded from PDF, not deleted |
| Quote section show/hide | Each section independently toggleable |
| Quote reset | Requires confirmation dialog — destructive action |
| IS template exclusions | "Copy IS template exclusions" — copies IS standard clauses, NOT tender exclusions |
| Field workers | Separate mobile-only module — deferred. Do NOT consolidate WorkerProfile into User model. |
| PDF margins | 15mm left/right (42.52pt), 25mm top below header, 20mm bottom above footer |
| PDF font | Outfit (body) + Syne (headings) — variable TTFs, OFL-licensed. Bundled in pdf-rendering/templates/assets/fonts/ |
| PDF watermark | IS logo at 5% opacity centred — if no logo: "IS" text Syne 120pt teal rotated 45° |

---

## SECTION 12 — DASHBOARD SYSTEM

### Architecture
- Single "Dashboard" entry in PLATFORM sidebar with "+" button to create new
- All dashboards are fully user-customisable widget grids
- Each user's dashboard configuration is unique to their login
- No shared/global dashboards — each user owns their own set

### Dashboard creation flow
1. User clicks "+" next to Dashboard in sidebar
2. Modal opens: name the dashboard, optionally start from a system template
3. Widget picker: browse by category, select widgets to include
4. Dashboard created and added to user's personal dashboard list
5. User can rename, reorder, or delete their dashboards at any time

### Widget categories (currently available)
- **Operations:** Active jobs, Active projects, Timesheets pending,
  Tender pipeline value, Open issues, Upcoming maintenance, Jobs by status,
  Tender pipeline by stage, Monthly revenue, Form submissions by week,
  Upcoming maintenance by asset, Project timeline
- **Tendering:** Active contracts, Active pipeline, Submitted MTD,
  Win rate YTD, Avg lead time, Due this week, Follow-up queue,
  Win rate last 6 months, Pipeline by estimator, Recent wins
- **Jobs:** Active jobs, Completion rate, Open issues, Jobs by stage
- **Maintenance:** Overdue maintenance, Upcoming maintenance, Open breakdowns
- **Forms:** Form submissions, Submissions by template
- **Safety (live — PR #96):** Open incidents (KPI, red if >0),
  Open hazards (KPI, orange if >0), Overdue hazards (KPI, red if >0),
  Recent incidents (half-width list with severity badge + date)
- **Compliance (live — PR #96):** Expiring items within 30 days (KPI,
  orange if >0), Expired items (KPI, red if >0), Blocked subcontractors
  (KPI, red if >0), Expiry alerts table (full-width, sorted by urgency)

### Widget display types (pre-built widgets)
KPI card | Bar chart | Line chart | Donut/pie chart | Data table | List

### Custom widget builder (planned — not yet built)
Users will be able to create free-form widgets by:
1. Selecting a data source (any entity: Tenders, Jobs, Projects, Contracts,
   Safety Incidents, Hazards, Workers, Assets, Timesheets, Compliance etc.)
2. Selecting fields to display
3. Choosing display type (table, pivot, bar chart, line chart, pie etc.)
4. Applying filters and groupings
Similar to Excel pivot tables / Power BI — scoped to IS's own data.

### Widget grid rules
- All widgets: register in `widgetRegistry.ts`
- Widget sizes: kpi (span 1) | half (span 2) | full (span 4)
- Grid: 4 columns desktop, 2 columns tablet, 1 column mobile
- Drag-to-reorder via @dnd-kit (PointerSensor, distance: 8)
- Per-widget period override available (shown as orange pill when overridden)

---

## SECTION 13 — MODULE REGISTRY

### ✅ LIVE (merged to main through PR #102)

**COMMERCIAL**
- Tendering — pipeline, register, estimates, Cutrite rates, AI scope drafting
- Scope of Works — waste tab, multi-plant/measurement pills, cutting discipline filter
- Per-card cutting subtable (saw-cut / core-hole / other-rate) with Copy
  from above auto-population from cuttingIncluded scope items (B4b).
  Replace semantics: regeneration replaces autoCopied=true saw-cut rows
  only; manual rows + core-hole + other-rate rows survive. Material
  inference returns null on no-match (NOT default-Concrete); UI flags
  with an amber border so the estimator picks manually.
- Quote system — per-client quotes, revisions, cost lines A/B/C, provisional sums,
  cost options, send via Outlook, client scoring (5 stars, win rate)
- Quote PDF — IS logo, ABN, T&C two-column font 6, estimator-aware,
  simple/detailed modes
- Rates admin — all 7 rate types including full Cutrite matrix + Other rates
- Tender dashboard + reports — KPIs, follow-up queue, scorecard
- Clarifications — unified section, 6 types with colour badges, edit/complete
- Dashboard builder — user-owned, drag-to-reorder, widget categories
- Contracts module — variations, progress claims, retention, cut-off reminders

**OPERATIONS**
- Projects — live job management + Gantt scheduling (Schedule tab)
- Jobs, Scheduler, Forms, Assets, Maintenance (baseline)
  - Job numbers follow canonical format `J-YYYY-NNN` (zero-padded
    3-digit per-year sequence, Brisbane TZ). Server-generated via
    `JobNumberService` when caller omits `jobNumber`; supplied
    values are validated and rejected if non-canonical. Per-year
    sequence backed by `JobNumberSequence` row-lock. PR B05.
- Resource allocation — assign workers/plant to jobs
- Sites — standalone site register, linked to tenders/projects
- Worker availability — leave calendar, unavailability, scheduler overlay

**SAFETY**
- Safety incident register (IS-INC auto-numbering, desktop + mobile)
- Hazard observation register (IS-HAZ auto-numbering, desktop + mobile)
- Safety dashboard widget
- Notifications to Marco + safety.admin on new incidents/extreme hazards

**FIELD (mobile web)**
- FieldLayout + mobile shell
- Worker allocations, pre-start checklists, timesheet capture + approval
- GPS clock-on — optional, explicit consent, clock events only
- Safety reporting — incident + hazard forms (mobile)
- Offline support — PWA, IndexedDB, auto-sync on reconnect

**DIRECTORY**
- Extended Client model (ABN, ACN, address, bank details, finance tabs)
- Business types: Company | Sole Trader | Partnership | Trust | Private Person
  (Private Person: ABN/ACN hidden, auto-creates primary contact)
- Subcontractor/Supplier module with prequalification (approved/pending/
  suspended/rejected) + trade categories
- Unified Contact model — polymorphic (CLIENT | SUBCONTRACTOR | SUPPLIER)
  Fields: firstName, lastName, role, email, phone, mobile, isPrimary,
  isAccountsContact, hasPortalAccess
- EntityLicence + EntityInsurance — polymorphic (clientId or subcontractorId),
  expiry tracking, document upload
  Licence types: qbcc | asbestos_a | asbestos_b | electrical | plumbing |
    labour_hire | demolition | waste_transport | other
  Insurance types: public_liability | professional_indemnity |
    workers_compensation | plant_equipment | contract_works | cyber | other
- CreditApplication workflow — outgoing (IS grants credit to client) and
  incoming (IS receives credit from supplier)
  Status flow: draft → submitted → under_review → approved | rejected
- Xero/MYOB export endpoints

**COMPLIANCE**
- Compliance dashboard (/compliance) — expiry alerts, blocked entities
- Worker qualification register (per worker, expiry tracking)
  Qual types: white_card | asbestos_a | asbestos_b | forklift | ewp |
    rigger | scaffolder | first_aid | warden | dogman | crane |
    electrical | plumbing | other
- Daily cron (7am AEST): 30-day + 7-day expiry alerts to compliance.admin users
- Auto-block expired subcontractors on critical licences/insurance
- ComplianceAlert model tracks sent alerts (prevents duplicates)

**PLATFORM**
- Auth — M365 SSO + local JWT, Super User tier (isSuperUser in JWT payload)
- Portal auth — separate JWT strategy for client portal users
- Notifications bell (in-app)
- Document upload — SharePoint live via Graph API + mock fallback
- AI integration (Anthropic/Gemini/Groq/OpenAI) — configurable in Admin Settings
- Admin Settings — notifications, email, AI, platform, users, integrations
- Global Lists system
- PWA — offline field worker support, install prompt, IndexedDB outbox,
  auto-sync on reconnect, 5-attempt retry with dead-letter handling
- Form drafts — IndexedDB-backed (separate DB from PWA outbox), manual
  Save draft button + auto-save on visibilitychange, one draft per
  (userId, formType), 30-day purge, scoped by userId so other users on
  the same device can't see drafts. Hardcoded denylist guards
  password/secret/token/otp/cvv/card-number fields. Foundation +
  6 forms wired (FormFillPage migrated from localStorage; field safety
  incident/hazard; contact create; tender clarifications; worker
  leave/unavailability). Admin CRUD wiring deferred to follow-up.

**INTEGRATIONS**
- SharePoint — Microsoft Graph API (SHAREPOINT_MODE=live|mock)
  Endpoints: ensureFolder, uploadFile, getFileUrl, deleteFile, listFolder
  Fallback: graceful degradation if Graph API unavailable
- Xero — OAuth2 via xero-node, XeroConnection model, token auto-refresh
  Endpoints: connect, callback, status, disconnect, sync contacts, create invoice
  CSRF protection: HMAC-signed state tokens with 10-minute TTL
- MYOB — manual CSV export (CustomerImport + SupplierImport formats)

**PORTALS**
- Client portal (/portal/client) — tender/project visibility, invite flow
  Pages: login, set-password, dashboard, tenders, tenders/:id, projects,
    projects/:id, documents, profile
  Security: separate JWT (type: client_portal), JwtAuthGuard rejects portal
    tokens on all staff endpoints, rate limiting, CSRF protection,
    data scoped to contactId's client only — NEVER exposes internal rates,
    adjustments, scope details, or cutting rates

**DASHBOARD IMPROVEMENTS (PRs #96 + #102)**
- Safety + Compliance widget categories added to picker
- 4 new Safety widgets + 4 new Compliance widgets
- Period override pill (orange when overridden from default)
- Dashboard name editable inline (click to edit, Enter to save)
- Drag handle baseline opacity visible in edit mode
- Avg lead time data fix (uses invitedDate → submittedDate)
- Scheduler workers panel labelled
- Simple↔Detailed mode toast

**TENDERING IMPROVEMENTS (PRs #95 + #101 + #102)**
- Pipeline column totals (count + $ value per stage column)
- Status change dropdown on tender detail header
- Clarification type badges: 6 types with distinct colours
  RFI=#005B61, Call=#3498DB, Email=#8E44AD, Meeting=#F39C12,
  Note=#95A5A6, Response=#27AE60
- IS-T020 demo tender fully seeded: 7 scope items × 5 disciplines,
  assumptions, IS standard exclusions, ClientQuote with cost lines
- Asb1 (285 m²) and Asb2 (48 Lm) have correct QTY/UNIT
- Quote PDF: 15mm margins, signature/acceptance block on final page
- "Copy IS template exclusions" button on quote Exclusions tab
- Cost Options help text
- Simple↔Detailed mode toast notification

**FORMS ENGINE (PRs #97 + #100)**
- FormTemplate model (8 categories: safety, asbestos, plant,
  induction, environmental, permits, quality, daily, custom)
- FormSection + FormField (30+ field types, isSystemTemplate flag)
- Rules engine: 11 operators (equals, not_equals, contains,
  not_contains, greater_than, less_than, between, is_empty,
  is_not_empty, is_one_of, is_not_one_of), AND/OR nested groups
- 3-layer rules: field visibility/required, section conditions,
  form on_submit actions
- FormSubmission pipeline:
  validate → compliance gates → server actions → approval chains
- 8 IS system templates seeded (isSystemTemplate=true):
  1. Daily Pre-Start Safety Meeting (category: daily)
  2. Take 5 — Stop Think Act (category: safety)
  3. Plant Pre-Start Inspection (category: plant)
  4. Site Induction (category: induction)
  5. Near Miss Report (category: safety)
  6. Incident Report (category: safety)
  7. Asbestos Work Plan (category: asbestos)
  8. Environmental Incident Report (category: environmental)
- Auto-record creation on submission:
  Incident Report → IS-INC-#### SafetyIncident
  Near Miss → IS-HAZ-#### HazardObservation
  Plant Pre-Start (safe_to_operate=No) → AssetBreakdown
- Compliance gate: Asbestos Work Plan blocked if submitter lacks
  current asbestos_a or asbestos_b qualification on WorkerProfile
- Approval chains per template (configurable in settings JSON):
  Near Miss: PM → Marco | Incident: PM → Marco (Sean if Critical)
  Asbestos Work Plan: Marco only (due 4 hours)
- Permissions: forms.view | forms.submit | forms.manage |
  forms.approve | forms.admin
- Forms list page: 4 tabs (Templates, My submissions,
  Pending approvals, Analytics placeholder)
- Category filter chips (Safety/Asbestos/Plant/Induction/etc.)
- Form fill page (/forms/fill/:submissionId):
  Mobile-first, 22 field types rendered, live rule evaluation
  client-side, GPS auto-capture, photo/signature fields,
  700ms debounced auto-save, localStorage offline fallback
- Submission detail (/forms/submissions/:id):
  Status banner, triggered records, approval chain timeline,
  inline approve/reject
- Deferred to follow-up PRs:
  Form builder UI (drag-and-drop canvas)
  Full PDF (photos embedded, signatures rendered)
  Analytics charts
  7 advanced field types (matrix, lookup, barcode, slider,
    NPS, likert, calculation)
  True IndexedDB outbox (currently localStorage fallback)

**UI + NAVIGATION FIXES (PR #99)**
- Scheduler month view: timezone key bug fixed (events now render)
- Scheduler week view: column width scaling fixed
- Maintenance calendar: viewport scaling fixed
- Compliance sidebar item: badge showing expiring count
- Safety sidebar item: badge showing open incidents count
- Safety under OPERATIONS in sidebar (confirmed)
- Safety page: [+ Report Incident] [+ Log Hazard] quick-action buttons

### 🔲 PLANNED — PHASE 5A.1 (AI Persona System)

AI Persona System (planned — Phase 5A.1)
- Persona registry architecture: Persona, PersonaCompanyInstruction,
  UserPersonaSettings tables. Each persona has: name, system prompt,
  route patterns where active, sub-modes with tool lists per sub-mode.
- Floating window shell: bottom-right, expand/collapse, only present
  on routes where a persona matches. Cog icon deep-links to AI Settings.
- Permission model: ai.persona.<name> per persona from day one.
  Future personas register their own permissions.
- Global "allow user instruction overrides" toggle: Sean controls
  whether users can append personal instructions to any persona's
  system prompt.
- Conversation persistence: per persona per user (or per persona per
  tender for tender-scoped personas like Tendering Assistant).
- Provider abstraction: Anthropic default. User-changeable per
  persona. Bring-your-own-key supported with encrypted storage.
- First persona: Tendering Assistant (Phase 5A.1, before sign-off).
  Live tools (PR #137 + #141 + #142 + #143 + #148):
  - Drawing tools — list_tender_drawings,
    extract_drawing_titleblock, read_tender_drawing — bound to ALL
    six sub-modes (register, tender-detail, scope, estimate, quote,
    clarifications). Drawings are reference material; useful from
    any context.
  - read_asbestos_register — bound to ALL six sub-modes
    (PR G, 2026-05-24). Read-only tool that auto-detects and
    reads the asbestos register / hazmat survey attached to a
    tender, then extracts its content for the cross-reference
    step the system prompt mandates before any ASB scope item is
    proposed. Filename auto-detection via case-insensitive
    keyword set (`asbestos register`, `asbestos survey`,
    `asbestos report`, `hazmat`, `hazardous material`,
    `acm survey`, `acm register`, `division 6`, `div 6`) matched
    against both fileLink.name AND TenderDocumentLink.title.
    Format-aware extraction: PDF text layer with
    `isEvalSupported: false` (Dependabot #14/#15 CVE
    mitigation), with a scanned-PDF vision fallback rendering
    up to the first 3 pages and a hint pointing at
    read_tender_drawing for further pages; image normalised
    through sharp (≤1568px, JPEG q85); XLSX every sheet's
    non-empty rows tab-delimited via exceljs; DOCX raw text via
    mammoth (new dependency). 0/1/2+ candidate outcomes diverge:
    0 returns a non-error "raise a clarification" message;
    1 reads it; 2+ returns a candidate list and asks the model
    to call again with a specific documentId. Cross-tender
    documentId rejected with a clean error. Output capped at
    MAX_EXTRACTED_CHARS = 60_000 with an explicit truncation
    marker. Permission gate: tenderdocuments.view (super-users
    bypass). Bound to all six sub-modes — register
    cross-reference is reference material like the drawing
    tools: scope (proposing ASB items), estimate (pricing),
    quote (the standard "asbestos not noted in the asbestos
    register" exclusion), tender-detail / clarifications
    (drafting RFIs about the register). With PR G, the
    Tendering Assistant sub-mode tooling is **complete**.
  - propose_scope_items — bound to the scope sub-mode only.
    Scope creation is sub-mode-specific work.
  - propose_estimate_items — bound to the estimate sub-mode only
    (PR D, 2026-05-24). Estimate-creation parallel to
    propose_scope_items: proposes whole estimate items
    (EstimateItem header + optional labour/plant/cutting/waste
    cost-line groups) for Accept/Edit/Reject. The estimate
    sub-mode is NO LONGER read-only as of PR D. Backing models:
    TenderEstimate (GET-OR-CREATE per tender), EstimateItem,
    EstimateLabourLine, EstimatePlantLine, EstimateCuttingLine,
    EstimateWasteLine. EstimateEquipLine and EstimateAssumption
    are intentionally NOT part of the proposal shape — the
    estimator adds them manually post-accept if needed. The
    tool_result row's metadata carries a
    toolName="propose_estimate_items" discriminator so the
    frontend's rebuildMessagesFromHistory distinguishes it from
    the legacy scope-proposal rows. The system prompt mandates
    that the model call lookup_rate for every rate
    (rate / tonRate / loadRate) BEFORE proposing — never invent
    a rate; the GLOBAL_RATE_FABRICATION_PROHIBITION and
    RATE_LOOKUP MANDATORY POLICY blocks apply in full. SSE
    event name is "estimate_proposals" (distinct from the
    scope-proposal "proposals" event).
  - list_tender_quotes — bound to the quote sub-mode only
    (PR E, 2026-05-24). Read-only discovery: lists the
    ClientQuotes attached to the active tender so the model
    can confirm the target quote with the user before
    proposing content into it. Falls back to the
    contextKey-resolved tender when input.tenderId is omitted.
    Permission gate: tenders.view (super-users bypass).
  - propose_quote_content — bound to the quote sub-mode only
    (PR E, 2026-05-24). Quote-content parallel to
    propose_scope_items / propose_estimate_items: proposes
    cost-line STRUCTURE (label + description; price is
    user-supplied unless the user explicitly stated a figure),
    exclusion clauses, and assumption clauses, INTO a target
    ClientQuote. The quote sub-mode is NO LONGER advisory-only
    as of PR E. Backing models: ClientQuote (resolved from the
    input quoteId; must belong to the conversation's tender
    AND status === DRAFT — SENT and SUPERSEDED quotes are
    immutable), QuoteCostLine, QuoteExclusion, QuoteAssumption.
    Accept-time integrity checks reject cross-tender quoteIds
    (400) and non-DRAFT statuses (400). The tool_result row's
    metadata carries a toolName="propose_quote_content"
    discriminator so the service AND the frontend's
    rebuildMessagesFromHistory distinguish it from scope and
    estimate proposal rows; the three flows stay strictly
    isolated. The system prompt mandates that the model
    propose STRUCTURE only and NEVER invent a cost-line price
    — `price` is included only when the user explicitly
    stated a figure. The GLOBAL_RATE_FABRICATION_PROHIBITION
    and RATE_LOOKUP MANDATORY POLICY blocks apply in full.
    SSE event name is "quote_proposals" (distinct from the
    scope-proposal "proposals" event and the estimate-proposal
    "estimate_proposals" event).
  - list_tender_clarifications — bound to the clarifications
    sub-mode only (PR F, 2026-05-24). Read-only discovery: lists
    the tender's formal RFIs (TenderClarification — id, subject,
    status, dueDate, hasResponse) and the last 50 comms-log
    entries (TenderClarificationNote — id, noteType, direction,
    text, occurredAt). Lets the model identify OPEN RFIs to draft
    responses for and avoid raising duplicates. Permission gate:
    tenders.view (super-users bypass).
  - propose_clarifications — bound to the clarifications
    sub-mode only (PR F, 2026-05-24). Clarifications-content
    parallel to propose_scope_items / propose_estimate_items /
    propose_quote_content. The clarifications sub-mode is NO
    LONGER advisory-only as of PR F. Three discriminated proposal
    kinds: new_rfi (creates a TenderClarification status=OPEN),
    new_note (creates a TenderClarificationNote with
    createdById = authenticated user; occurredAt defaults to now),
    rfi_response (updates an existing TenderClarification with a
    response and flips status to CLOSED). Accept-time integrity
    checks on rfi_response: 404 missing RFI, 400 cross-tender, 400
    already-responded. The tool_result row's metadata carries a
    toolName="propose_clarifications" discriminator so the service
    AND the frontend's rebuildMessagesFromHistory distinguish it
    from scope / estimate / quote proposal rows; the four flows
    stay strictly isolated. The system prompt mandates the model
    call list_tender_clarifications first, target existing RFIs
    via rfi_response rather than raising duplicates, and use the
    IS tender voice on drafts. The GLOBAL_RATE_FABRICATION_PROHIBITION
    and RATE_LOOKUP MANDATORY POLICY blocks apply in full. SSE
    event name is "clarification_proposals" (distinct from
    proposals / estimate_proposals / quote_proposals events).
  - lookup_rate — bound to ALL FIVE tender-scoped Tendering
    sub-modes (tender-detail, scope, estimate, quote,
    clarifications) since PR #149. Register sub-mode (tender
    list / pipeline view) is excluded — no specific tender from
    which to ask for rates. As of PR H (2026-05-24) lookup_rate
    covers all eight IS rate types: cutting (exact-schedule
    lookup by equipment / elevation / material / depthMm), core
    holes (per-diameter base rate × IS elevation multiplier
    Floor=1.0× / Wall=1.1× / Inverted=2.0×), labour
    (EstimateLabourRate, role @unique, returns dayRate /
    nightRate / weekendRate plus the requested shift's rate),
    plant (EstimatePlantRate, item @unique, returns rate + unit
    + fuelRate), waste (EstimateWasteRate, (wasteType, facility)
    @@unique, returns tonRate + loadRate + unit + wasteGroup),
    fuel (EstimateFuelRate, item @unique), enclosure
    (EstimateEnclosureRate, enclosureType @unique), and other
    (CuttingOtherRate — description is NOT unique; case-
    insensitive substring match returns ALL active matches so
    the user can pick from the catalogue). All queries filter
    isActive: true; case-insensitive matching uses Prisma's
    `mode: "insensitive"`. No-match paths list the available
    options for that table so the user gets a useful error
    rather than a bare not-found. Read-only — returns the rate
    as JSON in chat output, does not write to estimate items or
    scope items (estimate-creation tool is the next sub-task).
    **Labour unit correction (PR F, 2026-05-24).** The labour
    result returned `unit: "AUD per hour"`; corrected to
    `unit: "AUD per day"` per §10 (the IS labour formula is
    Qty × Days × Rate). The rate-table rows themselves were
    always per-day; the unit string was just wrong. A unit
    assertion in lookup-rate.handler.spec.ts locks the new
    value in.

    Rate fabrication risk (discovered via PR #149 smoke testing
    of PR #148): models will invent plausible market rates with
    fake citations (e.g. "$35-$65 per linear metre, SEQ
    2024-25") when a rate-lookup tool exists but isn't bound to
    the active sub-mode, or when the system prompt's prohibition
    against market-knowledge estimates is implicit rather than
    explicit. Two safeguards are mandatory for any future
    rate-lookup-style tool: (1) bind the tool to ALL sub-modes
    within a relevant persona where a rate question can
    plausibly arise — not just the obvious estimate-builder
    sub-modes; (2) include explicit "MUST NOT estimate from
    market knowledge / MUST NOT quote ranges / MUST NOT
    reference year-stamped market figures" prohibitions in the
    system prompt, with the policy block carried into every
    bound sub-mode's description. The PR #149 RATE_LOOKUP_
    CONVENTIONS block is the canonical shape — mirror it for
    future rate types and other lookup tools.

    Sub-mode field separation (PR #150). `PersonaSubMode.description`
    is the system prompt block sent to the model — may be
    multi-line, contain markdown headers, contain policy
    directives (e.g. RATE_LOOKUP_CONVENTIONS). NEVER render it in
    the UI. `PersonaSubMode.label` is the UI-facing string — one
    line, no markdown, suitable for subtitles, dropdowns, badges.
    The `GET /api/v1/personas/active-for-route` endpoint exposes
    `label` only; `description` is intentionally server-side. When
    adding new persona sub-modes or strengthening existing
    prompts, both fields are required. Discovered via PR #150
    after PR #149 widened `description` into a prompt block and
    the persona-window subtitle leaked the entire RATE LOOKUP —
    MANDATORY POLICY block into the teal panel header.

    Global rate-fabrication prefix (PR #152). The PR #149
    prohibition was scoped to five tender-scoped sub-modes via
    RATE_LOOKUP_CONVENTIONS. The register sub-mode was excluded
    and leaked a fabricated SEQ-region range during PR #151 smoke.
    The fix lifts a baseline prohibition to the persona-system
    assembly layer: GLOBAL_RATE_FABRICATION_PROHIBITION in
    apps/api/src/modules/personas/definitions/shared-prompts.ts is
    prepended to every system prompt. Two scope levels: (1)
    baseline — every persona × every sub-mode forbids
    market-knowledge rates, ranges, region/year stamps. (2) Strong
    override — tendering's tender-scoped sub-modes additionally
    mandate lookup_rate tool calls via RATE_LOOKUP_CONVENTIONS.
    The override appears later in the assembled prompt so it wins
    over the baseline naturally. One runtime assembly site exists:
    intrinsicPrompt() in ai-providers.service.ts (the persona chat
    path). It receives GLOBAL_RATE_FABRICATION_PROHIBITION as a
    prefix. (PR #152 originally had a second site — the file-local
    SYSTEM_PROMPT in tender-scope-drafting.service.ts on the legacy
    POST /api/v1/tenders/:id/draft-scope path — but the entire
    legacy path was deleted in §5A.1 PR B; scope drafting now flows
    through the Tendering Assistant persona's propose_scope_items
    tool, which assembles its system prompt via intrinsicPrompt.)
    Future cross-cutting prompt rules land at intrinsicPrompt; if a
    new assembly site is added it must receive the same prefix.
    shared-prompts.ts is the canonical home for new cross-cutting
    blocks (safety, IP confidentiality, etc.) — define there,
    prepend at every assembly site.
  System prompt enumerates the five IS scope codes
  (SO/Str/Asb/Civ/Prv) with strip-out vs fit-out / civil drainage
  vs MEP / civil concrete demolition vs new construction
  disambiguations, plus drawing-reading conventions (legend →
  notes → keyword annotations → hatching → options/stages →
  schedules → asbestos register cross-reference). Asbestos line
  items require asbestos register cross-reference before being
  proposed.
  PR #144 added tender-context injection: when the sub-mode is
  tender-scoped (tender-detail / scope / estimate / quote /
  clarifications) and the chat request has a contextKey, the
  prompt is prefixed with the tender's display code (tenderNumber)
  + database CUID + an explicit instruction to pass the CUID
  (not the display code) to tools that take a tenderId parameter.
  PR #146 completed the SharePoint adapter abstraction so drawing
  tools can actually retrieve uploaded file bytes. The
  SharePointAdapter interface (Mock + Graph implementations) has
  uploadFile/downloadFileBytes/getDownloadUrl/ensureFolder. The
  mock adapter persists bytes to apps/api/.local-storage/
  sharepoint-mock/ (gitignored, configurable via
  SHAREPOINT_MOCK_STORAGE_PATH); the seed writes a synthetic
  IS-T020 demo PDF to that path. SHAREPOINT_MODE env var picks
  the adapter at module init (mock vs live/graph). Production
  Graph adapter implementation is a separate PHASE 6 task.
  PDF parsing security (PR #154 — Dependabot alerts #14 + #15).
  `isEvalSupported: false` is REQUIRED at every
  `pdfjs.getDocument()` call site. pdfjs-dist 3.11.174 is vulnerable
  to arbitrary JavaScript execution upon opening a malicious PDF
  (HIGH severity). Patched upstream in 4.2.67; the repo is pinned
  to ^3.11 because Jest's CommonJS runtime can't load v4 ESM
  without transformer gymnastics (see roadmap.md §6). Setting
  `isEvalSupported: false` is Mozilla's recommended mitigation
  when the version can't be upgraded — it defangs the eval-based
  execution path. Two runtime call sites today: the
  `pdfjsLib.getDocument(...)` invocations in
  apps/api/src/modules/personas/tools/handlers/read-tender-drawing.handler.ts
  (`renderPdfPageToJpeg`) and
  apps/api/src/modules/personas/tools/handlers/extract-drawing-titleblock.handler.ts.
  Any new code that calls `pdfjs.getDocument` MUST pass
  `isEvalSupported: false` in the options object. Removing the
  option from an existing call site is a security regression — the
  inline comment at each site documents the CVE and the Phase 6
  removal trigger (pdfjs-dist past 4.2.67). The option becomes
  redundant once that upgrade lands.
  PR #147 finished the multi-turn image round-trip. The
  PersonaDispatcherService persists tool_result rows with image
  content stripped (DB stays lean — base64 image bytes are
  massive); the rebuild path on every subsequent turn substitutes
  a "[image not replayed — call the tool again to refresh]" text
  marker. To make the just-executed image actually reach the
  model on the immediate next turn, the dispatcher captures
  full-content tool_result blocks in memory after tool execution
  and splices them into the next turn's messages array, replacing
  the DB-rebuilt versions for matching toolUseIds. Cleared after
  the API call — older turns from then on use DB rebuild with
  the marker (correct: the model already saw the image when new).
  If a tool needs to RE-SEE an older image, the documented
  escape hatch is to call the tool again.
- Future personas: Dashboard Master, Captain Operations, Captain
  Scheduler, etc. Added one at a time post-sign-off as each module
  stabilises.

### ✅ LIVE — PHASE 5A.2 PR 1 (HTML→PDF Renderer Infrastructure)

PDF Rendering Module (`apps/api/src/modules/pdf-rendering/`)
- `PdfRendererService` — shared service for HTML→PDF rendering via Puppeteer.
  API: `renderHtmlToPdf(html, options?)`, `loadTemplate(name)`,
  `renderTemplateToPdf(name, data, options?)`.
- Engine: Puppeteer 23.x with bundled Chromium. Lazy-launched single
  shared browser instance, auto-reconnect on crash, 4-concurrent-render
  guard. Launch args: `--no-sandbox`, `--disable-setuid-sandbox`,
  `--disable-dev-shm-usage`.
- Templates: HTML/CSS files at `pdf-rendering/templates/`. Brand fonts
  (Outfit body, Syne headings — OFL-licensed variable TTFs) bundled
  under `templates/assets/fonts/`. `{{key}}` interpolation helper.
- `PdfRenderOptions` defaults: A4, 15mm L/R + 25mm top + 20mm bottom
  margins, printBackground=true, 30s timeout.
- `PdfRenderError` typed error class.
- `nest-cli.json` `compilerOptions.assets` copies templates to dist.

### ✅ LIVE — PHASE 5A.2 PR 2 (Quote PDF — HTML Template + Migration)

Quote PDF generation (`pdf-rendering/builders/quote-html.builder.ts`)
- `buildQuoteHtml(payload, overlay?)` — programmatic HTML builder that
  produces a full IS-branded quote document. Rendered via
  `PdfRendererService.renderHtmlToPdf`.
- Both consumers migrated:
  - `EstimateExportService.exportPdf()` — tender-level quote, no overlay.
  - `QuotePdfService.generate()` — per-ClientQuote with QuoteOverlay.
- `QuoteOverlay` type re-exported from the HTML builder (was in the
  deleted PDFKit builder).
- PDFKit `quote-pdf.builder.ts` (1,174 lines) deleted. `pdfkit` dep
  kept for persona test fixtures + seed.
- All dynamic values HTML-escaped via `esc()` helper.
- Sections: cover page, cost summary, cost options, provisional sums,
  scope table (simple/detailed/tender-level), preliminary works,
  referenced drawings, allowances, assumptions (free/linked), exclusions,
  two-column T&C (CSS columns), acceptance/signature block, IS watermark,
  Puppeteer page footers with page numbers.
- pnpm 10 note: `pnpm.onlyBuiltDependencies: ["puppeteer"]` in root
  package.json ensures puppeteer's install script runs and downloads
  Chromium locally. Without this, `pnpm install` skips the script.
- CI/deploy Chrome provisioning: in CI and Azure deploy workflows,
  always run `pnpm --filter @project-ops/api exec puppeteer browsers
  install chrome` as an explicit step after `pnpm install`. The pnpm
  store cache may suppress the postinstall, and Puppeteer downloads
  Chrome to `~/.cache/puppeteer` (outside `node_modules`), so the
  cached store never restores it. Never rely on the postinstall alone
  for CI or deploy — use the explicit install step.

### 🔲 PLANNED — PHASE 5A.2 PRs 3–4 (Remaining Document Migrations)

- Two documents remaining: variation, schedule of rates.
  Sean signs off visual fidelity per document.
- Templates designed to match Sean's reference templates (stored
  outside repo at C:\ProjectOperations-Reference\ for sensitivity
  reasons — real client data).
- Forward-compatible with future rich-text-editor / template-editor
  work — editors output HTML, renderer consumes HTML, no impedance
  mismatch.

### 🔲 NEXT PRIORITIES
See roadmap.md §5A.1 + 5A.2 for the expanded Phase 5A scope. AI
persona infrastructure and HTML→PDF renderer migration are now
critical-path before tendering sign-off.

See roadmap.md for full prioritised list.
https://github.com/GH-Mantova/ProjectOperations/blob/main/roadmap.md

---

## SECTION 14 — INTEGRATIONS DETAIL

### SharePoint
- Mode: `SHAREPOINT_MODE=live|mock`
- Live: Microsoft Graph API via `@azure/identity` + `@microsoft/microsoft-graph-client`
- Mock: returns fake folder paths and document URLs (for dev without Azure)
- Folder structure: `SHAREPOINT_ROOT_FOLDER/[tender-or-project-id]/[document-name]`
- Test connection: `GET /api/v1/admin/platform/sharepoint/test`

### Xero
- OAuth2 flow: `/integrations/xero/connect` → Xero consent → `/integrations/xero/callback`
- Scopes: `accounting.contacts accounting.transactions.read accounting.settings.read offline_access`
- Token auto-refresh: 60 seconds before expiry
- Contact sync: creates/updates Xero Contacts for clients, Xero Suppliers for subcontractors
- Invoice creation: from IS progress claims → Xero invoice line items
- CSRF: HMAC-signed state param, 10-min TTL, one-shot delete on use

### MYOB
- Manual CSV export only (live integration planned)
- CustomerImport format for clients
- SupplierImport format for subcontractors

---

## SECTION 15 — AUTONOMOUS PR CHAIN INFRASTRUCTURE

### progress.md
Maintained at repo root. Append-only. Never delete entries.
Fetch (full file): https://raw.githubusercontent.com/GH-Mantova/ProjectOperations/main/progress.md
Fetch (navigation): https://github.com/GH-Mantova/ProjectOperations/blob/main/progress.md
Note: always use the raw URL for reading file contents — the blob URL
serves a truncated HTML page that cuts off long files.

Format:
```
[YYYY-MM-DD HH:MM AEST] — [action type]
Type: PR | AUDIT | FIX | PAUSE
Detail: [what happened]
Status: COMPLETE | FAILED | PAUSED
[PR number, branch, commit, CI status, files changed, issues found]
```

Update after: PR opens, PR merges, audit completes, fix applied, chain pauses.

### Doc updates within a PR

Every PR includes its documentation updates as part of the PR itself, not as a follow-up. This is non-negotiable — follow-up doc PRs have historically been forgotten (see PR #111 → PR #112 cleanup), causing stale-doc drift that breaks the routing-instructions trust model.

Per-file rules:
- progress.md — append a merge entry on EVERY PR. Format matches existing entries: ## YYYY-MM-DD HH:MM AEST — PR #N MERGED — <title>, followed by Type / Status / Detail / files changed / CI summary.
- roadmap.md — edit when phases shift, items complete, items added, or items deferred. Use the changelog at the bottom to record the change. No edit needed for PRs that don't move roadmap state.
- project_instructions.md — edit when modules go live, business rules change, sidebar changes, env vars change, architecture patterns change. §13 module registry should always reflect what's on main.

The pre-commit hook stamps "Last updated:" on any of these three files when they're staged. Never edit that line by hand — the hook will overwrite it.

### Bypass actor pattern
Ruleset ID: 15532058

Add bypass (before chain starts):
```bash
gh api --method PUT repos/GH-Mantova/ProjectOperations/rulesets/15532058 \
  --field 'bypass_actors=[{"actor_id":5,"actor_type":"RepositoryRole","bypass_mode":"always"}]'
```

Remove bypass (after chain complete or on pause):
```bash
gh api --method PUT repos/GH-Mantova/ProjectOperations/rulesets/15532058 \
  --field 'bypass_actors=[]'
```

Always verify removal: `current_user_can_bypass` must show `"never"`.
Always remove bypass before pausing or finishing a session.

### Final progress.md entry (after chain complete)
Bypass is removed before final commit, so direct push to main is blocked.
Always use a PR for the final chain-complete log entry:
```bash
git checkout -b chore/chain-complete-log
# append final entry to progress.md
git add progress.md
git commit -m "chore: progress — CHAIN COMPLETE"
git push origin chore/chain-complete-log
gh pr create --title "chore: chain complete log" \
  --body "Final progress.md entry." --reviewer GH-Mantova \
&& gh pr merge --auto --squash
```

### When to pause the chain
- Audit finds CRITICAL or HIGH issues
- CI fails on any PR
- Token budget approaching (commit wip first, then stop)

Pause message format:
```
⏸️  CHAIN PAUSED
URL: https://raw.githubusercontent.com/GH-Mantova/ProjectOperations/main/progress.md
Reason: [why]
Waiting for: [what's needed]
Type CONTINUE or paste fix instructions to resume.
```

### Audit schedule
- Run after every 2 PRs minimum
- Always run after portal/auth PRs (security-critical)
- Always run after schema migrations (integrity check)
- Audit checks: API health (all endpoints 200), permission registry alignment,
  migration replay on shadow DB, dead code scan, calculation integrity

---

## SECTION 16 — PLANNED INTEGRATIONS (not yet built)

- Calendar sync: Google Calendar + Microsoft Calendar
- Two-way email reply parsing: Outlook/Gmail
- MYOB live integration (OAuth2)
- Web Push notifications (field worker alerts)
- Subcontractor portal: /portal/sub
- Custom widget builder (free-form data source selection)
- WebSockets (real-time field updates)
- Field worker mobile module — separate PWA-only app for field workers
  covering timesheets, pre-start, allocations, safety. WorkerProfile
  model exists. Full field worker module deferred — do NOT consolidate
  WorkerProfile into User model.

---



---

<!-- ============================================================
     MERGED SOURCES  (sot-consolidation, 2026-07-08)
     Primary (above): project_instructions.md
     Merged below from:
       - CLAUDE.md            (code/git/prisma/seed/pnpm/TS conventions only — file stays as a pointer stub)
       - docs/architecture-overview.md
       - docs/sharepoint-local-workflow.md
       - docs/sso-entra-setup.md
       - docs/dev-to-prod-workflow.md
     ============================================================ -->

## Workspace Structure & Path Aliases

```
ProjectOperations/
├── apps/
│   ├── api/          # NestJS backend (@project-ops/api)
│   └── web/          # React + Vite frontend (@project-ops/web)
├── packages/
│   ├── config/       # Shared runtime config helpers (@project-ops/config)
│   └── ui/           # Shared UI components (@project-ops/ui)
├── docs/             # Architecture, setup, deployment, module notes
├── e2e/              # Legacy E2E location
├── tests/e2e/        # Active Playwright E2E specs
├── scripts/          # PowerShell sync scripts (SharePoint ↔ local)
├── .github/workflows/
├── docker-compose.yml
├── package.json      # Root workspace
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── playwright.config.ts
└── playwright.reuse.config.ts
```

**Package scopes and path aliases:**

- `@project-ops/api` → `apps/api`
- `@project-ops/web` → `apps/web`
- `@project-ops/ui` → `packages/ui/src/*`
- `@project-ops/config` → `packages/config/src/*`

---

## Commands Reference

### Development
```bash
pnpm dev                  # Start API + web in parallel
pnpm dev:api              # API only
pnpm dev:web              # Web only
```

### Build
```bash
pnpm build                # Full monorepo build
pnpm build:azure          # Web build + API build for Azure deploy
```

### Database
```bash
pnpm prisma:generate      # Generate Prisma client
pnpm prisma:migrate       # Apply migrations (dev)
pnpm seed                 # Seed database
```

### Testing
```bash
pnpm lint                 # Lint all packages
pnpm test                 # All tests
pnpm test:api:serial      # API tests (serial — required for DB tests)
pnpm test:web:logic       # Web unit/logic tests
pnpm compliance:smoke     # Full compliance smoke runner
```

### E2E
```bash
pnpm test:tendering:e2e           # Tendering E2E
pnpm test:tendering:e2e:reuse     # Tendering E2E (reuse server)
```

---

## TypeScript Rules

- `strict: true` is enforced globally — no exceptions.
- `moduleResolution`: `NodeNext` for API (`apps/api/tsconfig.json`), `Bundler` for
  web app (`apps/web/tsconfig.json`); base sets no `moduleResolution` — apps pin
  their own.
- `baseUrl` is not set; `paths` in `tsconfig.base.json` resolve relative to repo root.
- No `any` types on component props or function signatures in new code.
- `forceConsistentCasingInFileNames: true` — honour this on all new files.
- Path aliases are defined in `tsconfig.base.json` — use them, don't use relative `../../`.

---

## Code Conventions

### API conventions (NestJS)

- Every new endpoint must have Swagger decorators: `@ApiOperation`, `@ApiResponse`,
  and `@ApiQuery` (where applicable).
- Use DTOs with `class-validator` for all request bodies.
- Inject config — never hardcode values.
- SharePoint adapter is injected by token — use `SHAREPOINT_MODE` to switch mock/live.
- All Prisma access goes through the service layer, not directly in controllers.

### Frontend conventions (React)

- Recharts for all chart components (installed in `@project-ops/web`).
- Shared UI components live in `packages/ui` — re-export from `packages/ui/src/index.ts`.
- Chart components: `KpiCard`, `BarChartWidget`, `LineChartWidget`, `DonutChartWidget`.
- Design tokens in `apps/web/src/styles/tokens.css`.
- CSS variable naming: `--brand-primary`, `--surface-*`, `--text-*`, `--status-*`, `--radius-*`.
- Skeleton loaders on all data-fetching areas — never a blank screen.
- Empty states on all lists/tables with icon + heading + CTA.
- All touch targets minimum 44×44px.
- Sidebar collapses to bottom tab bar below 768px.

---

## Git & Branch Workflow

**Never commit directly to `main`.**

### Branch naming
```
improvement/s{N}-{short-slug}    # for master prompt sections
fix/{short-slug}                  # for bug fixes
feat/{short-slug}                 # for standalone features
```
One change per branch; combine related fixes into one prompt unless there's a hard
schema dependency or a risky-vs-safe split (see also the PR rules in the primary).

### Pre-work conflict check (before any branch)
1. `git fetch origin`
2. Check for conflicts: `git log --oneline --all -- <file>` for each planned file.
3. If a conflict is found — stop and report, do not proceed.

### Pull request requirements (body shape)
Every PR to `main` must include:
- **Title**: `[Section N] Short description`
- **Body**:
  - Summary of changes
  - Files added / modified
  - New dependencies (if any)
  - New env vars (if any)
  - Migration files (if any)
  - Checklist: `pnpm build` ✓, `pnpm lint` ✓, `pnpm compliance:smoke` ✓
- **Reviewer**: `GH-Mantova`

---

## Prisma Discipline (additions)

- All schema changes happen on a section/feature branch — never `prisma migrate dev`
  on `main`.
- Check `prisma/migrations/` for unapplied migrations from other branches **before**
  running a migration locally.
- Migration files are committed in the same commit as the schema change (see the
  primary's migration-naming rule).

---

## Seed Data Rules (additions)

- Seed must be **idempotent** — use upserts, not inserts.
- Use stable deterministic IDs: `'client-001'`, `'worker-001'`, `'job-001'`, etc.
- Running `pnpm seed` multiple times against the same database must produce the same
  result.

---

## pnpm Discipline

- Always use `--frozen-lockfile` unless intentionally adding a dependency.
- Add new deps in a single `pnpm add` call — not incrementally.
- Commit updated `pnpm-lock.yaml` in the same commit as `package.json` changes.
- Never edit `pnpm-lock.yaml` manually.
- `cross-env` is the standard for env vars in npm scripts — no `set VAR=val&&` syntax.

---

## Architecture Overview

The platform is a **modular monolith**: one backend codebase, one frontend codebase,
one PostgreSQL database, with clear module boundaries for later expansion.

### Current foundations

- `apps/api` contains transport, configuration, health, authentication, RBAC, audit,
  SharePoint service abstraction, notifications, search, dashboards/reporting, assets,
  maintenance, forms, documents, closeout/archive, and API-documentation bootstrap
  layers.
- `apps/web` contains the responsive shell, login flow, admin routes for
  users/roles/permissions/audit, platform foundation screens, the master data
  workspace, tendering screens with tender-document integration, the jobs-and-delivery
  workspace with closeout/archive visibility, the scheduler planning workspace, the
  resources/competencies workspace, the assets register/detail workspace, the
  maintenance workspace, the forms/compliance workspace, the documents workspace, and
  the rendered dashboards/reporting workspace.
- `packages/config` contains shared environment helpers used by both apps.
- `packages/ui` contains shared UI primitives for consistent presentation.

### Planned module sequence (canonical build order)

The implementation sequence follows the master build pack:

1. Platform Foundation
2. Auth / Users / Roles / Permissions / Audit
3. SharePoint Integration + Platform Services Foundation
4. Master Data
5. Tendering and Estimating
6. Tender Documents
7. Award / Contract / Job Conversion
8. Jobs and Delivery
9. Scheduler and Work Planning
10. Resources and Competencies
11. Assets and Equipment
12. Maintenance
13. Forms and Compliance
14. Documents
15. Dashboards and Reporting
16. Closeout and Archive
17. Hardening and Consolidation

### Persistence split

- PostgreSQL holds transactional and operational data.
- SharePoint holds files and folders once the live SharePoint integration layer
  replaces the current mock foundation.

### Current rollout posture

- Tendering is in a strong, pilot-ready state.
- Recommended deployment shape: hosted web + hosted API + PostgreSQL.
- SharePoint is currently best treated as: launch surface via the Intranet site, and
  document/backup repository via the Initialservices documents site.
- The app-side SharePoint integration is still mock-backed and has not yet been fully
  replaced with live Microsoft Graph folder/file operations.

### API conventions (platform-wide)

- Base prefix: `/api/v1`.
- DTO validation at module boundaries.
- Paginated list shape: `items`, `total`, `page`, `pageSize`.
- Swagger/OpenAPI published from the API bootstrap.
- Shared bootstrap configuration is reused by both runtime startup and automated
  compliance verification.
- Consistent JSON error envelope from the global API exception filter.

### Operational verification

- `pnpm compliance:smoke` runs a repeatable backend smoke flow across the core
  lifecycle: login, tender creation, tender award/contract, job conversion, scheduler
  planning, maintenance visibility, forms, documents, dashboards, and closeout/archive.
- Tendering also has local browser verification coverage via Playwright. In the managed
  Windows environment, the most reliable browser-validation path is the manual
  reuse-runtime flow (see the SharePoint + Local Development Workflow section below).

---

## V2 Improvement Cycle — Architecture Delta

The v2 cycle (sections S1–S9 in `codex_master_prompt.md`) refined the platform along
four axes: developer ergonomics, adapter patterns, UI/UX coverage, and observability.
The baseline architecture above remains accurate; this section captures what changed.

### New / reshaped routes (`apps/web`)

All legacy routes are preserved under `/{route}/legacy` so existing deep links, tests,
and seed data continue to work.

| Path | Component | Notes |
|---|---|---|
| `/` | `DashboardPlaceholderPage` | Spec-compliant Operations dashboard — 4 KPI grid + 2-col chart grid + "Customise" slide-over with localStorage widget toggles |
| `/tenders` | `TenderingPage` | Kanban pipeline (default) + Register toggle + "New tender" slide-over |
| `/tenders/:id` | `TenderDetailPage` | 60/40 split with sticky rail, activity timeline, inline note/clarification/follow-up forms |
| `/jobs` | `JobsListPage` | Card grid (default) + table toggle + 7 filters + "New job" slide-over |
| `/jobs/:id` | `JobDetailPage` | 7 tabs with clickable activity completion toggle |
| `/scheduler` | `SchedulerWorkspacePage` | 3-pane layout (hierarchy \| timeline \| resource panel) with week/month views |
| `/resources` | `WorkersListPage` | Worker card grid with search + role + availability filters |
| `/resources/:id` | `WorkerDetailPage` | 5 tabs (Profile / Competencies / Availability / Assigned shifts / Documents) |
| `/assets` | `AssetsListPage` | Card grid with 4 filters |
| `/assets/:id` | `AssetDetailPage` | 4 tabs with derived last/next service + total downtime KPIs |
| `/maintenance` | `MaintenancePage` (v2) | Upcoming/overdue list + month calendar + "Log event" slide-over |
| `/forms` | `FormsListPage` | Tabs: Templates (card grid) + Submissions (filterable table) |
| `/forms/designer/:templateId` | `FormDesignerPage` | 3-pane designer with draggable field chips, property editor, rules editor, Preview modal |
| `/forms/submit/:templateId` | `FormSubmitPage` | Distraction-free wizard with signature canvas + photo upload |
| `/documents` | `DocumentsWorkspacePage` | Context tree + list with drag-and-drop upload zone |
| `/master-data` | `MasterDataWorkspacePage` | Clients + Sites tabs with cards/table toggle and slide-over forms |
| `/archive` | `ArchivePage` | Standalone archive register with CSV export |
| `/archive/:jobId` | `ArchiveDetailPage` | Read-only with 7 collapsible panels + JSON record export |
| `/login` | `LoginPage` (v2) | Dark full-screen background, centred card, conditional Microsoft SSO button |

The sidebar (`ShellLayout`) is a dark 240px / 64px-collapsed rail with five role-gated
nav groups, a 56px top bar with breadcrumb / notifications bell / Cmd-Ctrl-K search /
user avatar, and a bottom tab bar below 768px.

### New API endpoints (v2 cycle)

| Method + path | Module | Notes |
|---|---|---|
| `POST /api/v1/auth/sso` | `auth` | Microsoft 365 SSO with auto-provision |
| `PATCH /api/v1/notifications/read-all` | `platform/notifications` | Bulk-mark-read for current user |
| `GET /api/v1/archive` | `archive` | Paginated archive list |
| `GET /api/v1/archive/:jobId/export` | `archive` | Full read-only archive snapshot |
| `PATCH /api/v1/tenders/:id/status` | `tendering` | Lightweight stage update used by Kanban drag-drop |
| `GET /api/v1/resources/workers/:id` | `resources` | Worker detail with eager-loaded relations |
| `POST /api/v1/documents` (multipart) | `documents` | Optional multipart file upload via `FileInterceptor('file')` |
| `POST /api/v1/documents/:id/versions` (multipart) | `documents` | Same as above for new versions |
| `POST /api/v1/tenders/:tenderId/documents` (multipart) | `tender-documents` | Same pattern for tender documents |

Every new endpoint carries `@ApiOperation` + `@ApiResponse` (and `@ApiQuery` where
applicable) for Swagger coverage.

### SharePoint adapter pattern

The `SharePointAdapter` interface (`apps/api/src/modules/platform/sharepoint.adapter.ts`)
is selected by `platform.module.ts` based on `SHAREPOINT_MODE`:
- `"mock"` (default) → `MockSharePointAdapter`
- `"live"` (canonical) or `"graph"` (legacy alias) → `GraphSharePointAdapter`

`GraphSharePointAdapter` is no longer a stub — it uses
`@microsoft/microsoft-graph-client` with a `TokenCredentialAuthenticationProvider`
backed by `ClientSecretCredential` from `@azure/identity`. `MockSharePointAdapter`
preserves the mock behaviour and persists bytes to
`apps/api/.local-storage/sharepoint-mock/` (gitignored, configurable via
`SHAREPOINT_MOCK_STORAGE_PATH`).

> Interface surface: per the primary (§13, PR #146) the adapter interface exposes
> **four** methods — `uploadFile`, `downloadFileBytes`, `getDownloadUrl`, `ensureFolder`.
> (`downloadFileBytes` was added in PR #146 so the drawing tools can retrieve uploaded
> file bytes; earlier docs listing only three methods are superseded.)

### Authentication adapter (SSO auto-provision)

The existing `EntraTokenValidatorService` is unchanged and is used by both the legacy
`POST /auth/entra` path and the new `POST /auth/sso` path. `EntraAuthService` gained an
`authenticateWithSso` method that either returns an existing active user or
auto-provisions a new one with the lowest-privilege available role
(Viewer → Field → Planner → Admin), `ssoOnly: true`, and an empty password hash
(blocking local login for that user).

### New packages / dependencies (v2 cycle)

- **`@project-ops/api`** — `@microsoft/microsoft-graph-client`, `@azure/identity`,
  `@types/multer`, `jwks-rsa`, `jsonwebtoken`, `@types/jsonwebtoken`, `eslint` +
  `@typescript-eslint/*`.
- **`@project-ops/web`** — `recharts`, `@azure/msal-browser`, `@azure/msal-react`,
  `eslint` + `@typescript-eslint/*` + `eslint-plugin-react-hooks`.
- **`@project-ops/ui`** — `recharts` (so `KpiCard` / `BarChartWidget` /
  `LineChartWidget` / `DonutChartWidget` can import it directly).
- **Root workspace** — `cross-env` (root dev dep for cross-platform scripts).

Chart components (`packages/ui/src/charts/`) and feedback primitives
(`packages/ui/src/feedback/EmptyState.tsx`, `Skeleton.tsx`) are re-exported from
`packages/ui/src/index.ts`.

### SSO / SharePoint-live environment variables

The primary (§7) is authoritative for the `.env` key list; these are the SSO and
Graph-integration keys that layer on top. SharePoint and SSO are **opt-in**: when the
required vars are absent, the mock adapter / local-login flow remain active and nothing
in the UI changes.

| Var | Mode required | Purpose |
|---|---|---|
| `AZURE_TENANT_ID` *(legacy alias: `SHAREPOINT_TENANT_ID`)* | SharePoint live | Entra tenant for Graph auth |
| `AZURE_CLIENT_ID` *(legacy alias: `SHAREPOINT_CLIENT_ID`)* | SharePoint live | Entra app registration client id |
| `AZURE_CLIENT_SECRET` *(legacy alias: `SHAREPOINT_CLIENT_SECRET`)* | SharePoint live | Entra app registration secret |
| `ENTRA_TENANT_ID` | SSO enabled | SSO tenant for backend token validation |
| `ENTRA_CLIENT_ID` | SSO enabled | SSO client id for backend token validation |
| `SSO_ENABLED` | optional | Backend feature flag |
| `VITE_SSO_ENABLED` | SSO enabled | Frontend MSAL bootstrap flag |
| `VITE_ENTRA_CLIENT_ID` | SSO enabled | Frontend MSAL client id |
| `VITE_ENTRA_TENANT_ID` | SSO enabled | Frontend MSAL tenant |

> The Graph adapter reads `AZURE_TENANT_ID ?? SHAREPOINT_TENANT_ID` etc. — `AZURE_*`
> is the preferred name and `SHAREPOINT_*` is the accepted legacy equivalent (the
> adapter throws `"requires AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET
> (or the legacy SHAREPOINT_* equivalents)"`). Site resolution prefers
> `SHAREPOINT_SITE_HOSTNAME` / `SHAREPOINT_SITE_PATH` / `SHAREPOINT_LIBRARY_NAME`
> (plus `SHAREPOINT_TENDERS_ROOT`, `SHAREPOINT_ROOT_FOLDER`), falling back to the legacy
> `SHAREPOINT_SITE_ID` + `SHAREPOINT_LIBRARY_ID` overrides. See `.env.example` for the
> full annotated key list.

### Schema change (v2)

One migration in the v2 cycle:
- `apps/api/prisma/migrations/20260418_s4_sso_user_flag/migration.sql` — adds
  `sso_only BOOLEAN NOT NULL DEFAULT false` to `users` (`User.ssoOnly` in Prisma).

### Dev tooling (v2)

- `pnpm lint` works across the monorepo. Each of `@project-ops/api` and
  `@project-ops/web` has a flat-config `eslint.config.(js|cjs)` with a conservative
  ruleset (parses TS/TSX correctly, no style enforcement that would require bulk
  refactors).
- `.github/workflows/ci.yml` runs the API job (Postgres 16 service + prisma migrate +
  seed + lint + tests + compliance smoke) and the web job (lint + logic tests + build)
  on every PR and push to `main`.
- `.github/workflows/deploy.yml` runs `pnpm build:azure` and pushes to Azure App
  Service (API) and Azure Static Web Apps (web) on merges to `main`, gated by the four
  `AZURE_*` / `PROD_API_BASE_URL` repo secrets.
- The root `packageManager` field pins pnpm to `10.0.0`; the pnpm GitHub Action reads
  that directly so the workflows and the repo can never disagree.

---

## SharePoint + Local Development Workflow

Use SharePoint as the synced storage location, but run the app from a normal local
folder on each computer.

**Why.** The workspace runs into Windows `esbuild` / `vite` `spawn EPERM` errors when
build tools run directly inside the SharePoint-synced path. Keeping the project on
SharePoint is fine; *running the build* from the SharePoint-synced folder is the part
that causes trouble.

### Recommended pattern
1. Keep the master copy in the SharePoint-synced folder.
2. Create a local working folder on each machine, e.g. `C:\Dev\ProjectOperations`.
3. Copy the project from SharePoint to the local working folder before development.
4. Run Docker, Node, Prisma, and Vite from the local working folder only.
5. Sync source changes back to SharePoint when finished.

### Sync scripts
```powershell
# SharePoint → local
.\scripts\sync-from-sharepoint.ps1 `
  -SharePointPath "C:\Users\marco\Initial Services Pty Ltd\Initial Services Office - Documents\4. Reports\App Dev\Project Operations" `
  -LocalPath "C:\Dev\ProjectOperations"

# local → SharePoint
.\scripts\sync-to-sharepoint.ps1 `
  -LocalPath "C:\Dev\ProjectOperations" `
  -SharePointPath "C:\Users\marco\Initial Services Pty Ltd\Initial Services Office - Documents\4. Reports\App Dev\Project Operations"
```

The sync scripts intentionally exclude runtime/build artifacts: `node_modules`, `dist`,
`build`, `.vite`, `.next`, logs, and local-only env files. This keeps SharePoint cleaner
and reduces sync conflicts.

### Daily workflow
1. Sync from SharePoint to local.
2. Open the local folder in your terminal/editor.
3. Run:
   ```powershell
   docker compose up -d postgres
   pnpm install
   pnpm prisma:generate
   pnpm prisma:migrate
   pnpm dev
   ```
4. Work normally from the local folder.
5. Sync local changes back to SharePoint.

> If switching between multiple computers, **always sync from SharePoint first** before
> starting work on a machine so you don't overwrite newer changes.

### Managed-Windows validation note
This environment has recurring `spawn EPERM` issues. For reliable verification, prefer
the local safe validation path over generic frontend tooling:
```powershell
pnpm --filter @project-ops/api build
pnpm test:api:serial
pnpm --filter @project-ops/web exec -- tsc -p . --noEmit
pnpm test:web:logic
```
For Tendering browser verification, prefer:
```powershell
pnpm dev:api:e2e
pnpm dev:web:e2e
pnpm test:tendering:e2e:reuse
```

### Operational SharePoint note
SharePoint currently serves two purposes around this project:
1. Sync/storage for the source tree when using the local-workflow pattern above.
2. Future operational environment support for the live app, where the Intranet site can
   act as the launch surface and the Initialservices site as the document/backups
   repository.

The app-side SharePoint integration is still mock-backed, so this workflow is
specifically about source/workspace sync rather than full live document integration
inside the app.

---

## Microsoft 365 SSO / Entra Setup

How Microsoft 365 single sign-on is wired for the ERP, and how to add users
(set up 2026-06-15).

### How auth works here
- **Web (React SPA):** MSAL signs the user in (`loginPopup`, scopes
  `openid profile email User.Read`) and uses the returned **ID token**.
  `redirectUri = window.location.origin`.
- **API (NestJS):** validates that ID token — issuer
  `https://login.microsoftonline.com/{tenant}/v2.0`, audience = `ENTRA_CLIENT_ID`.
- Both sides use the **same app registration / client ID**. The API consumes the ID
  token directly, so there is **one** app registration (no exposed API scope, no second
  app).

### The app registration
- **Name:** `projectops-erp-sso` (Microsoft Entra admin center → App registrations).
- **Account types:** single tenant — *Accounts in this organizational directory only
  (INITIAL SERVICES)*. This alone restricts sign-in to `@initialservices.net` accounts.
- **Platform:** Single-page application (SPA), with redirect URIs:
  - `https://<prod-web-origin>` — production Static Web App origin, **no trailing slash**
    (MSAL sends the bare origin; a trailing-slash-only entry causes `AADSTS50011`).
  - `https://<prod-web-origin>/` — kept as belt-and-braces.
  - `http://localhost:5173` — local dev.
  - Confirm the exact prod origin in Azure Portal → Static Web App → Overview → URL.
- **API permissions:** Microsoft Graph → `User.Read` (Delegated) + **admin consent
  granted** for Initial Services.
- **Token configuration:** optional ID-token claims **`email`** and **`upn`** added (the
  API matches users by email).
- Do **not** enable implicit/hybrid flows — SPA uses auth-code + PKCE.

### Where the IDs are wired (3 places, same two GUIDs)
From the app's Overview: **Application (client) ID** and **Directory (tenant) ID**.
1. **GitHub repo secrets** (baked into the web bundle by the deploy):
   `PROD_ENTRA_CLIENT_ID` = Application (client) ID, `PROD_ENTRA_TENANT_ID` = Directory
   (tenant) ID. `gh secret set <NAME>` from the repo dir.
2. **Production API** (Azure Portal → App Service `operations-api` → Settings →
   Environment variables): `ENTRA_CLIENT_ID`, `ENTRA_TENANT_ID`, and `SSO_ENABLED = true`.
   (Issuer/JWKS auto-derive from the tenant.)
3. **Web build vars** `VITE_SSO_ENABLED` / `VITE_ENTRA_CLIENT_ID` / `VITE_ENTRA_TENANT_ID`
   are injected from the GitHub secrets during `build:azure` (deploy.yml, enabled by
   PR #384).

### Enterprise application — assignment
Registering the app auto-creates an Enterprise application of the same name.
Entra → Enterprise applications → `projectops-erp-sso` → Properties → **Assignment
required?**
- **No:** any tenant account can authenticate; ProjectOps still gates access by user
  record.
- **Yes:** users must also be assigned (Users and groups → Add) — tighter. If Yes,
  assigning a new person is an extra step.

### Who can actually log in
A person needs **both**:
1. An Initial Services Microsoft account (single-tenant app), **and**
2. A **user record in ProjectOps** (Admin → User Access) whose email matches their
   Microsoft UPN.
3. (If assignment required = Yes) also assigned to the Enterprise app.

An IS email alone is **not** enough — no user record means they authenticate with
Microsoft but the app bounces them. Pilot is provisioned for Marco, Sean, Raj (pr-173).

### Login experience
User opens the app → **Sign in with Microsoft** → if already signed into their IS
Microsoft account in that browser, usually a one-click account pick (no password) → app
matches their email to their record and routes them to their role's pages. No separate
ProjectOps password. (Optional enhancement pr-203 adds silent auto-login so
already-signed-in staff skip even that click.)

### Adding a new user later
Not an Entra change (they're already in the tenant):
1. Admin → User Access → create their user record, set role, email = their Microsoft UPN.
2. If assignment required = Yes: also assign them in Entra → Enterprise applications →
   `projectops-erp-sso` → Users and groups.
No code, no redeploy.

### Troubleshooting
- **`AADSTS50011` redirect mismatch:** the registered SPA redirect URI doesn't exactly
  match `window.location.origin` (usually a trailing-slash issue). Fix the URI.
- **Authenticates with Microsoft but ProjectOps denies access:** the ID-token email
  doesn't match a user record. Check the record's email vs their actual UPN (watch shared
  mailboxes like `estimating@`).
- **SSO not appearing at all:** confirm `SSO_ENABLED=true` (API) and
  `VITE_SSO_ENABLED=true` baked into the deployed web bundle.

### Azure Static Web Apps + PWA gotchas (learned at go-live)
Captured 2026-06-16 after the SSO production cut-over. Each item cost a deploy cycle to
diagnose; keep them in this order — they form a dependency chain.
1. **Use `loginRedirect`, not `loginPopup`.** On Static Web Apps the popup → opener
   handoff is severed (cross-origin / PWA service-worker scope) and `loginPopup` hangs
   until it times out. Switch to `loginRedirect` + `handleRedirectPromise()`. (PR #397.)
2. **Do not call `ssoSilent`.** Its hidden sandboxed iframe attempts a top-level
   navigation back to the app origin and is blocked with `frame is sandboxed …
   allow-top-navigation not set`, which kills the sign-in flow. Interactive redirect only
   — no silent iframe path. (PR #398.)
3. **Await `handleRedirectPromise()` before the router renders.** If the router mounts
   first, the protected route immediately redirects to `/login` and strips the auth
   response off the URL before MSAL processes it — the user lands silently back on
   `/login` with no error. Gate app render on the promise resolving. (PR #406.)
4. **Set `staticwebapp.config.json` `navigationFallback` → `/index.html`.** Without an
   explicit fallback, a hard GET or browser refresh of any deep route (including `/login`
   and the SSO redirect landing) returns Azure's default 404 page instead of the SPA.
   SWA's implicit SPA fallback was unreliable across action versions — make it explicit.
   (PR #409.)
5. **MSAL config that works on SWA + PWA:**
   - `navigateToLoginRequestUrl: false` — we control post-login routing.
   - `cacheLocation: "localStorage"` — survives the service-worker-controlled reload.
   - `storeAuthStateInCookie: true` — covers Safari/WebKit ITP and PWA storage
     partitioning.
   - `redirectUri: window.location.origin` — must match a registered SPA redirect URI
     exactly (see `AADSTS50011` note above).
6. **Pin `Azure/static-web-apps-deploy` to a SHA.** The floating `@v1` tag shipped a
   release that broke deploys with `Build container for action … Docker build failed`,
   and the same floating tag silently changed SPA-fallback defaulting. Pin Docker-based
   actions to a known-good SHA and bump deliberately. (PR #407.)
7. **Deploy model is full-`main` per merge.** Every merge to `main` triggers a deploy of
   the entire current `main` (health-gated). A fix merged but not deployed (gate failure,
   action break) goes live on the next successful deploy — there is no per-PR deploy slice.

Referenced PRs: #397 (redirect + PWA-safe), #398 (remove silent iframe), #406 (await
before router), #407 (pin deploy action), #409 (navigationFallback).

---

## Dev-to-Prod Workflow

How a change goes from idea to live on Azure.

### Who does what

| Role | Who | Responsibility |
|---|---|---|
| Product / ideas | Marco | Pitches changes, makes the call on priorities, clicks merge on production PRs, does Azure/Entra portal steps |
| Architect / dev | Cowork main chat (this assistant) | Turns ideas into self-contained PR prompts, diagnoses failures, stages `rev-` fix prompts, writes/maintains docs |
| Implementer | PR-watcher + headless Claude Code agents | Branch, write code, run local checks, open the PR |
| Reviewer | Watcher auto-review (verdict) + Marco (final click) | Posts MERGE/FIX/BLOCK verdict; Marco approves production changes |

### The lifecycle

**1. Create the PR.**
- *Automated (normal path):* Marco describes the change → main chat writes a
  self-contained prompt → dropped as `docs/pr-prompts/<name>-ready.md` → the watcher
  picks it up and an agent branches, implements, and opens the PR (body + reviewer
  `GH-Mantova`).
- *Manual:* branch off `main`, make changes, open the PR yourself. Same rules apply.

**2. Test locally (pre-PR gate).** The agent runs this before opening a PR; run the same
by hand for manual work:
```
pnpm install
pnpm dev            # web at localhost:5173, API at localhost:3000 — click through
pnpm lint
pnpm build
pnpm test:api:serial
pnpm test:web:logic
pnpm compliance:smoke
```
Seed/login for local testing: `pnpm seed`, then `admin@projectops.local` /
`Password123!`. Never open a PR with known-failing checks.

**3. Test on GitHub (CI = the authoritative gate).** Opening the PR triggers GitHub
Actions: API lint/test/smoke, web lint/logic/build, PR diff gates, tendering E2E, CodeQL.
Green CI here is what counts. If CI goes red, the PR stays unmerged — paste the failing
job log to the main chat and a `rev-` fix prompt is staged for the watcher. (CI can't be
diagnosed without the job log; PR-body edits don't retrigger workflows.)

**4. Review & approve.** The watcher's auto-review posts a **VERDICT** (MERGE / FIX /
BLOCK) as a PR comment (mirrored from `docs/pr-reviews/`). Merge policy:
- **Tests/docs-only** PRs with green CI + approving verdict → **auto-merge**.
- **Production code, migrations, env vars, or workflows** → **stop for Marco's click**.
  Marco reads the verdict + CI (phone is fine) and merges.

**5. Deploy to Azure (automatic).** A merge to `main` triggers `deploy.yml`:
```
prisma migrate deploy (prod DB)
  → build:azure (web bundle, SSO vars baked in)
  → deploy API (App Service: operations-api)
  → API HEALTH GATE   (polls /api/v1/health; red ⇒ run fails)
  → deploy web (Static Web App)
  → SWA REACHABILITY GATE (root must return 200; red ⇒ run fails)
```
Merge = deploy, health-checked end to end. A red gate fails the run loudly — never a
silent bad deploy.

### When things fail
Everything is built to **fail safe and wait** — nothing loops or merges/ships broken.
- Failure *during* an agent's run (build/lint/test/visual) → the agent fixes it before
  opening the PR.
- Transient infra (cache, runner, "workspace starting") → watcher retries once.
- A PR going stale behind main → watcher auto-updates the branch (content conflicts it
  can't fix → see below).
- Hard failure (turn cap, usage limit, real bug, merge conflict) → quarantined; Marco
  pastes the log/report, main chat stages a `rev-` fix prompt, watcher runs it.

### Merge conflicts
Auto-update-branch only handles fast-forwards. **Content conflicts** need resolution:
small/doc conflicts in GitHub's web conflict editor; code conflicts via a `rev-` prompt
(agent rebases + resolves + reverifies). For append-only logs (`progress.md`), keep both
sides; for single header lines keep the later value.

### Rollback
Current deploy is **direct-to-production** (no slot/swap yet — pending a Standard App
Service tier upgrade). A bad deploy is live until rolled back; see the runbook §8
rollback steps. Upgrading to slot+swap (deploy → health-gate → swap) is the planned
hardening.

### Quick reference
- Repo: `GH-Mantova/ProjectOperations` · Local: `C:\ProjectOperations2`
- Prompts in: `docs/pr-prompts/` (`*-ready.md` = picked up by watcher)
- Verdicts: PR comments + `docs/pr-reviews/`
- Failures: `docs/pr-prompts/failed/` · Escalations: `docs/pr-prompts/needs-marco/`
- Prod web: the Static Web App URL · Prod API: `https://operations-api.azurewebsites.net/api/v1`
