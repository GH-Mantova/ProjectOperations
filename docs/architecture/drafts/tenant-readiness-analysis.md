# Tenant readiness — could a second company set this up themselves?

**Investigation-only draft. No schema changes, no code, no locked decisions.**
Author: Claude (night run, 2026-07-14) — for Marco's review.
Scope: Model A only (one deployment per company). Model B (multi-tenant SaaS) is out of scope;
one paragraph at the end notes what B would additionally require.

---

## Verdict (one line)

**A second construction company COULD get 60–70% of the way there through the existing admin
screens today, but they would still end up sending clients PDFs that say "Initial Services"
and cover letters written verbatim by Sean — because ~10 files still bake the company in below
the admin surface.** The good news: much of the plumbing (`CompanyProfile` singleton, admin page,
`LegalDocument` model, `PersonaCompanyInstruction` wiring, rate tables in DB) already exists.
The missing work is closing the last mile: making the remaining hardcoded strings and text
consts read from that plumbing, and building a first-run wizard so a new admin isn't left to
discover the gaps by shipping a wrong PDF.

---

## Executive summary — what's already solved, what isn't

The prompt was written on the assumption that "Initial Services is threaded through the code, the
seed, the legal text, and the business logic." That was true a few months ago. Between the
`CompanyProfile` singleton, the admin page, the `LegalDocument` model, per-tender editable T&Cs,
`PersonaCompanyInstruction`, `RateTable` / `GlobalList` / `RateResolverService`, and the
`SharePointFolderMapping` config data (PR #556) — most of the structural work is already done.

What's actually left divides cleanly into three groups, and only one of them is real work:

| Group | Weight | Status |
|---|---|---|
| **Data a new admin must supply** (identity, licences, T&Cs, cover letter, logo, rates, staff) | Big list, small effort | Model + admin surface exists for most; a **first-run wizard** and a **health screen** would make it discoverable rather than surprise-discovered |
| **Fallback strings that hardcode "10 Grice St / Initial Services" as defaults** in ~4 places | ~1 day | Delete the fallbacks or drive them from `CompanyProfile` unconditionally |
| **Legal / commercial text that isn't in `LegalDocument` yet** (cover letter, project assumptions, discipline copy, portal headings, AI persona description) | ~2–3 days | Route these last few consts through `LegalDocument` (or a new `CompanyContent` table) — this is the real remaining work |

There is one **red-flag risk** that dominates all of the above: **shipping Initial Services' actual
Terms & Conditions to a competitor.** `tc-text.const.ts` is 21 clauses of real legal text — clause
2 is a licence claim, clause 3 is a liability position, clause 17 is a payment position. If a new
company deployed today and never edited them, they would be quoting under Initial Services' legal
terms without knowing it. The per-tender T&C editing helps (`quote.controller.ts:59` seeds each
tender from the const and lets it be edited), but nobody prompts them to change the source of
truth for future tenders. This must be **blanked, not seeded, and enforced by the setup wizard.**

---

## Full inventory (findings from a night's grep)

Every hit was cross-checked. Line numbers are as-of `origin/main` at 483f3f3.

### 1. Company identity strings — mostly wired, a few fallbacks

| File | Line | Value | Status |
|---|---|---|---|
| `apps/api/src/modules/estimate-export/estimate-export.service.ts` | 417–423 | Reads `companyProfile.tradingName`, falls back to `"Initial Services"` | ✅ wired, ⚠️ hardcoded fallback |
| `apps/api/src/modules/estimate-export/estimate-export.service.ts` | 432–476 | `resolvePdfCompanyContext()` reads `CompanyProfile` + licences | ✅ wired |
| `apps/api/src/modules/estimate-export/estimate-export.service.ts` | 444–448, 465 | Fallback strings when profile is null: `"INITIAL SERVICES"`, `"10 Grice St, Clontarf Q 4019 \| P: (07) 3888 0539 \| E: admin@initialservices.net \| A.B.N: 75 631 222 556"`, `"Demolition Licence: 2328018 \| Class A Asbestos Licence: 2320431"` | ⚠️ hardcoded fallback — the profile is never null in normal ops, but if a fresh deployment forgets to seed it, a new tenant would ship IS's address on their first PDF |
| `apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts` | 811 | Reads `CompanyProfile` for header/footer context | ✅ wired |
| `apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts` | 359, 820, 823 | Same hardcoded fallbacks as above | ⚠️ hardcoded fallback |
| `apps/api/src/modules/calendar/calendar.service.ts` | 167, 173 | ICS `PRODID` uses resolved `tradingName` | ✅ wired |
| `apps/api/src/modules/email/email.service.ts` | 41 | Default sender `"marco@initialservices.net"` when admin settings unset | ⚠️ default → should be blank + prompt on first run |
| `apps/api/src/modules/ai-providers/ai-providers.service.ts` | 213–221, 349 | Reads `CompanyProfile.tradingName`, `DEFAULT_COMPANY_CONTEXT = { tradingName: "Initial Services" }` fallback | ⚠️ hardcoded fallback |
| `apps/api/src/modules/company-profile/company-profile.service.ts` | 430–441 | `computeCompleteness()` explicitly flags `usingDefaultIdentity` when `legalName === "Initial Services Group Pty Ltd"` | ✅ this is already the seed of a "is this configured?" indicator — surfaced in `AdminCompanyPage` |
| `apps/api/prisma/schema.prisma` | 3084–3085 | Default `senderAddress`/`senderName` in `AdminSettings` model default to Initial Services | ⚠️ schema-level default; a new tenant inherits it |
| `apps/api/src/modules/workers/workers.service.ts` | 243 | Error message: `"Re-run the Initial Services seed to create it."` | ⚠️ user-visible copy — should say "re-run the operational seed" |

### 2. UI strings — the visible ones a new tenant would see immediately

These render in the browser without any admin having a chance to edit them. Every one is a code
change today.

| File | Line | Value |
|---|---|---|
| `apps/web/src/pages/LoginPage.tsx` | 119 | `"Initial Services platform"` (login subtitle) |
| `apps/web/src/portal/PortalLayout.tsx` | 30 | `"Initial Services — Client Portal"` (client-facing header) |
| `apps/web/src/portal/pages/PortalLoginPage.tsx` | 48 | `"Initial Services"` (client-facing login heading) |
| `apps/web/src/portal/pages/PortalDashboardPage.tsx` | 25 | `"Snapshot of your projects, jobs, and documents with Initial Services."` |
| `apps/web/src/pages/SendQuoteModal.tsx` | 57, 59, 62 | Quote email subject: `"Quote ${ref} — Initial Services"`; signature footer: `"Initial Services"` |
| `apps/web/src/pages/AdminSettingsPage.tsx` | 507, 516 | Input placeholders — harmless (placeholders, not defaults) |
| `apps/web/vite.config.ts` | 62, 65 | PWA manifest: `"Initial Services Project Operations"`, `"Project Operations Platform for Initial Services…"` (visible when a user installs the PWA) |

**Classification:** all seven should read from `CompanyProfile.tradingName` (and one for the PWA
manifest needs a build-time env-var flow, because `vite.config.ts` runs at build).

### 3. Legal / commercial content — the highest-risk bucket

`apps/api/src/modules/estimate-export/pdf/tc-text.const.ts` exports 5 consts that are all rendered
onto client-facing PDFs:

| Export | Length | What it is | Currently editable? |
|---|---|---|---|
| `TC_TEXT` | 21 clauses, ~2.5KB | Full terms & conditions | ✅ **Per-tender editable** — `quote/tc-parser.ts` parses this into clauses that are copied into a per-tender `TenderTermsAndConditions`, and each tender can edit them before send. But the source-of-truth default is still IS's legal text. |
| `PROJECT_ALLOWANCES_TEXT` | ~200 chars | Working hours, plant, safety standards | ❌ Rendered verbatim from the const on every quote |
| `PROJECT_ASSUMPTIONS_TEXT` | ~500 chars | `"Assumed Initial Services will have dedicated lift…"` — actual assumed site conditions | ❌ Rendered verbatim from the const on every quote |
| `PRELIMINARY_WORKS` | Small array | Project management, SWMS, Form 65, mobilization | ❌ Rendered verbatim |
| `COVER_LETTER_TEXT` | ~600 chars | `"Thank you for giving Initial Services the opportunity… Initial Services holds an unrestricted licence for both demolition and asbestos removal…"` — includes a **licence claim** and a **WHS position** that are specifically Initial Services' | ❌ Rendered verbatim (`quote-html.builder.ts:380`) |
| `BRAND` (colours) | Palette object | Teal, orange, dark grey | ⚠️ Wired to `CompanyProfile.primaryColorHex` / `secondaryColorHex` via the admin page, but the fallback comes from this const — verify which side actually reaches the PDF renderer |

The `LegalDocument` model already exists in the schema (found via `AdminCompanyPage.tsx:63–77`)
with types `TERMS_AND_CONDITIONS | COVER_LETTER | STANDARD_ASSUMPTIONS | STANDARD_EXCLUSIONS |
PROJECT_ALLOWANCES | PRIVACY_NOTICE`, versioning, `effectiveFrom` / `effectiveTo`, and `isActive`.
**Everything needed to store per-tenant legal content is already modelled.** What's missing is the
renderer reading from it. Today the code path is `TC_TEXT` const → parse → per-tender copy → PDF,
and for cover letter / assumptions there is no per-tender copy — the const goes straight to PDF.

**Risk restated bluntly:** Shipping the cover letter as-is to a competitor company would have them
telling their clients that *they* hold "an unrestricted licence for both demolition and asbestos
removal" — a specific licence claim. This must be blanked, not seeded.

### 4. Business logic / taxonomy — mostly data, some hardcoded

**Data-driven (safe to ship as empty tables and let the tenant fill in):**
- `RateTable` (categories `INITIAL_SERVICES | SUBCONTRACTOR` — enum values are the only IS-specific naming there)
- `EstimateLabourRates`, `EstimatePlantRates`, `EstimateCuttingRates`, `EstimateMaterialDensity`, `EstimateEnclosureRate` — all DB-backed via `RateResolverService`
- `GlobalList` (vocabulary)
- `Competencies`, `ResourceTypes`, `Workers` — all DB-backed
- `SharePointFolderMapping` — config data (PR #556, already landed)

**Hardcoded (would need code change or new schema):**
- `apps/api/src/modules/personas/definitions/disciplines.ts:21` — `IS_DISCIPLINE_CODES = ["DEM", "CIV", "ASB", "Other"]` plus `IS_DISCIPLINE_LABELS` (Demolition / Civil / Asbestos / Other) plus `IS_DISCIPLINE_DESCRIPTIONS` (long descriptions). This is imported everywhere. The four codes are also mentioned in the AI tool descriptions (`propose-scope-items.tool.ts:17`, `propose-estimate-items.tool.ts:25`) and in the tendering persona (`tendering.persona.ts`). This is the single largest hardcoded taxonomy — it would need a `Discipline` table to move to data.
- `apps/api/src/modules/ai-providers/ai-providers.service.ts:359` — persona system prompt template contains `"a South East Queensland construction company"` (geographic, hardcoded)
- `apps/api/src/modules/personas/definitions/tendering.persona.ts:15–17, 188` — hardcoded description: `"Initial Services Pty Ltd (Brisbane) is a demolition, asbestos removal, [...] company"` plus base-scope quoting rules

**Ambiguous — needs Marco:**
- Material densities in the rate tables (concrete, steel, brick densities) — probably genuinely industry-standard (Australian Standards), OK to ship as defaults. But confirmation needed.
- The four-discipline model itself — is that Initial Services' specific practice, or genuinely how demolition contractors in AU are structured? If the latter, ship as defaults. If the former, must be blanked.
- Core-hole / enclosure rates — currently in seed as hardcoded numbers. Are these market rates or IS's negotiated rates?

### 5. Integrations — mostly config, one code stub

| Integration | Where | Status |
|---|---|---|
| Azure / Entra tenant IDs | `.env.example` lines 91–122 | ✅ env-driven, no code hardcoding found |
| Xero | `.env.example` 128–133, `xero.service.ts` | ✅ generic OAuth wrapper, `XeroConnection` model stores encrypted per-tenant |
| SharePoint site + folders | `.env.example` 59–75 for hostname; `SharePointFolderMapping` table for paths | ✅ solved by PR #556 |
| Outlook / Graph mail | `.env.example` 106–109, `email.service.ts:41` | ⚠️ fallback default sender `"marco@initialservices.net"` |
| MYOB | Not found in code | N/A — either not integrated yet or in a branch |
| ICS Calendar (`PRODID`) | `calendar.service.ts:173` | ✅ uses `tradingName` at runtime |
| SSO / Entra single-tenant | `docs/sso-entra-setup.md` | ℹ️ Documented as single-tenant. A second company would register their own app — this is fine for Model A, but Marco should decide whether the docs get "replace INITIAL SERVICES with your org" instructions |

### 6. Seed data — clean separation exists, needs one more split

Seed files today:
- `seed-reference.ts` — generic reference data (safe to ship to any tenant)
- `seed-company-profile.ts` — the singleton `CompanyProfile` row (currently IS's identity)
- `seed-initial-services.ts` — IS staff, IS clients, IS workers, IS tenders (T260512-BRIS-Rev1 etc.), IS jobs, IS rate tables
- `seed-users-prod.ts` — production user roster (guards against `@projectops.local` demo emails)
- `seed-form-templates.ts` — WHS/plant form definitions (references `marco@initialservices.net`)
- `seed-prod.ts` — production entry, imports from `seed-initial-services`
- Wrappers: `seed-reference-run.ts`, `seed-users-prod-run.ts`

**Classification:**
- `seed-reference.ts` — ✅ ship as-is (generic vocabulary)
- `seed-company-profile.ts` — ⚠️ **should ship as blank profile** (id `"singleton"`, all other fields `NULL`) rather than IS's actual identity. Fresh deployments would trigger the "usingDefaultIdentity" flag immediately and be routed to the setup wizard.
- `seed-form-templates.ts` — the form structures are generic (SWMS, hazard log, timesheet templates) but the `marco@initialservices.net` references in template metadata should be blanked
- `seed-initial-services.ts` — ✅ this is IS's operational data; a new tenant simply doesn't run it. It should be renamed `seed-demo.ts` or moved to `seed-tenants/initial-services/` to make its optional nature explicit.
- `seed-users-prod.ts` — needs blanking (currently seeds specific staff users); the pattern (an "AdminUser" seeded first) is fine.

### 7. Portal / client-facing branding

Every string in the client portal (which the tenant's own customers see) currently says "Initial
Services" — see section 2. This is arguably the highest-visibility problem: a competitor's clients
would see "Initial Services — Client Portal" on their login page.

### 8. Documentation and `sot/`

Out of scope (do not touch). But for the record: `sot/01-charter-and-architecture.md` bakes IS's
staff, phone numbers, and address into the charter (lines 54–67). If the platform is ever handed
over, `sot/` will need a "how to fork this for your own company" section — but that's Marco's
call, and this PR must not touch it (CP-24 hard-fails mixed paths).

---

## Classification summary — the six buckets, with a fix per bucket

**Bucket 1 — Company identity (name, ABN, address, logo, colours, contact).** Model already exists
(`CompanyProfile` singleton, 40+ fields including `primaryColorHex`, `secondaryColorHex`,
`logoLightUrl`, `logoDarkUrl`, `faviconUrl`, `pdfLetterheadUrl`, and per-document-type number
prefixes). Admin page exists (`AdminCompanyPage.tsx`). Completeness banner exists. **Fix:** blank
the seed defaults, delete the hardcoded fallbacks in the ~4 PDF/render sites, make the completeness
banner block outbound PDF generation until minimum fields are set.

**Bucket 2 — Legal / commercial text.** `LegalDocument` model exists with versioning; the T&Cs
are per-tender editable via `tc-parser.ts`. The **cover letter and project assumptions are not**
— they render straight from the const. **Fix:** wire the cover letter and project assumptions
through `LegalDocument` (types already exist: `COVER_LETTER`, `STANDARD_ASSUMPTIONS`), blank the
consts, force the wizard to prompt.

**Bucket 3 — Business logic / rates.** Rates are already data (`RateTable`, `RateResolverService`).
Densities probably shippable as industry defaults. **The four disciplines are the sticking point**
— `IS_DISCIPLINE_CODES` is imported by ~20 files including AI tool descriptions and persona
definitions. **Fix (if disciplines must be tenant-configurable):** introduce a `Discipline` model,
migrate imports to a resolver, seed IS with its four. This is a bigger job than everything else
combined — and it may not be needed if disciplines are genuinely industry-standard for AU demolition.
**Ask Marco before doing it.**

**Bucket 4 — AI persona instructions.** `PersonaCompanyInstruction` model exists and IS wired
(`ai-providers.service.ts:226` reads it into every prompt as layer 2). **Fix:** move the hardcoded
`"a South East Queensland construction company"` and `"Initial Services works in four disciplines"`
strings into per-tenant `PersonaCompanyInstruction.instruction` rows. Seed with sensible defaults;
let each tenant override.

**Bucket 5 — Integrations.** Mostly done. **Fix:** blank the `email.service.ts:41` fallback and
the `AdminSettings` schema-level defaults for `senderAddress`/`senderName`.

**Bucket 6 — Seed / reference data.** Clean separation already exists between `seed-reference` and
`seed-initial-services`. **Fix:** rename `seed-initial-services.ts` → `seed-demo.ts` (or
`seed-tenants/initial-services/`) to signal it's optional; make `seed-company-profile.ts` write a
blank singleton; adjust `seed-prod.ts` to not import IS's operational data.

---

## Proposal — the minimum setup path for a new company

### What the wizard MUST ask (blocking; without these, the system cannot generate a valid PDF)
1. Legal name, trading name, ABN
2. Primary email + phone
3. Registered address (line 1, suburb, state, postcode)
4. Terms & Conditions text (paste in — do NOT show any default; explain why not)
5. Cover letter text (paste in)
6. Project assumptions text (paste in — or acknowledge "we don't use standard assumptions")
7. Logo upload (light + dark) + primary/secondary colour hex
8. First admin user (email, name, password)
9. GST rate, currency, timezone, financial-year start month (defaults offered: 10%, AUD, Australia/Brisbane, July — but adjustable)
10. Number prefixes for tender/quote/job (defaults offered: T/Q/J — adjustable)

### What the wizard SHOULD ask (soft; can skip and add later)
- Secondary logo, favicon, PDF letterhead image
- Postal address (defaults to same as registered)
- WHS officer, emergency contact
- Licences (demolition, asbestos, other)
- Insurance details
- Email sender (defaults to admin's email)
- Integration credentials (SharePoint, Xero, Entra) — dev/mock mode until supplied

### What ships as sensible defaults (no need to ask)
- Material densities (Australian Standards) — **subject to Marco's confirmation**
- Form templates (SWMS, hazard log, timesheet structures — generic)
- Role permission overlays (Viewer / PM / Estimator / Supervisor / Field Worker — generic)
- Vocabulary (`GlobalList` entries that aren't tenant-specific)
- ICS calendar `PRODID` (built from `tradingName` at runtime)

### What must be blanked (never shipped)
- Cover letter, project assumptions, T&Cs — **legally dangerous to ship**
- Staff roster, worker roster, client list, tender/job history
- Rate table values (the structure ships; the numbers must be entered)
- Email sender defaults

### The "is this configured?" health screen
`AdminCompanyPage.tsx` already has `CompletenessBanner` (`AdminCompanyPage.tsx:236`) — this is the
seed. Extend it to:
- Show a red banner across the top of every page while `usingDefaultIdentity` is true
- Enumerate the unset legal-document types (`LegalDocument` where `isActive = false` for that type)
- Block quote PDF generation with a clear error when critical fields are unset ("You cannot send
  a quote until you set your trading name and T&Cs — go to Admin → Company")
- Show the "green tick" state only when ALL blocking fields are set

---

## Phased plan — each phase independently shippable

**Phase 1 — Blank the defaults, kill the fallbacks (~1 day)**
- Change `seed-company-profile.ts` to write a blank singleton
- Rename `seed-initial-services.ts` → `seed-demo.ts`, remove from `seed-prod.ts`
- Delete hardcoded fallback strings in `estimate-export.service.ts` (444–448, 465),
  `quote-html.builder.ts` (359, 820, 823), `email.service.ts` (41), `ai-providers.service.ts` (349),
  `estimate-excel.builder.ts` (50) — throw a clear error instead
- Extend `CompletenessBanner` to block PDF gen when critical fields are unset
- Fix the AdminSettings schema defaults for `senderAddress`/`senderName`
- ✅ Ship: IS themselves are unaffected (their `CompanyProfile` is already populated); a fresh
  deployment now fails loudly on missing config instead of shipping "10 Grice St" quietly

**Phase 2 — Legal content into data (~2 days)**
- Wire `COVER_LETTER_TEXT` and `PROJECT_ASSUMPTIONS_TEXT` through `LegalDocument` (types exist)
- Update `quote-html.builder.ts:380` to read the active `LegalDocument` of each type
- Add the "you must publish a cover letter before sending your first quote" enforcement
- Migrate IS's existing text into `LegalDocument` rows for their tenant
- Blank the consts (keep the file as a fallback that throws if `LegalDocument` isn't seeded, or
  delete it and let the loader fail loudly)
- ✅ Ship: no more const-driven legal text; IS unchanged (their `LegalDocument` rows now hold it)

**Phase 3 — AI persona strings into `PersonaCompanyInstruction` (~1 day)**
- Move `"a South East Queensland construction company"` and `"Initial Services works in four
  disciplines"` out of `ai-providers.service.ts:359` and the tool constants
- Seed IS's `PersonaCompanyInstruction` rows with these values (migration)
- The template becomes `"You are the ${persona.displayName} for ${companyContext.tradingName}."`
  — the rest comes from the instruction row
- ✅ Ship: IS unchanged (their instruction rows now carry the extra sentence); a new tenant edits
  a text field instead of a `.ts` file

**Phase 4 — UI strings + setup wizard + health screen (~3 days)**
- Route all 7 hardcoded UI strings (section 2) through a `useCompanyProfile()` hook / `tradingName`
  from a context provider
- Build the first-run wizard: detect `usingDefaultIdentity && no admin has ever logged in` → redirect
- Extend the completeness banner to be a full page: "3 of 8 required items complete"
- Fix `vite.config.ts` PWA manifest via env vars at build time (`VITE_APP_NAME`, `VITE_APP_DESCRIPTION`)
- ✅ Ship: a second company can now click through setup instead of asking a developer

**Phase 5 (OPTIONAL, needs Marco's call) — Disciplines to data (~4–5 days)**
- Only if disciplines are genuinely tenant-configurable
- New `Discipline` model, `DisciplineCode` unique per company, migrate imports
- Rewrite the AI tool descriptions to read from data
- **Risk:** touches ~20 files including the tendering persona; largest single migration in the plan
- If Marco says "disciplines are industry-standard for AU demolition contractors" → **skip this phase**

---

## What CANNOT be made configurable (honest list)

- **PWA install name / description** — `vite.config.ts` is build-time; a new tenant must edit env
  vars at build. Cannot be a runtime setting. Acceptable for Model A (one deployment per company).
- **Entra SSO app registration** — each tenant registers their own Azure AD app. Documented,
  but not automatable from within the platform. This is standard for Azure-hosted apps.
- **Database schema / prisma migrations** — code changes; per-tenant schema divergence is not
  supported. Any bespoke fields a tenant wants become a code change.
- **The four-discipline model itself, if left in code** — see phase 5. If Marco decides
  disciplines stay hardcoded, other verticals (e.g. an electrical contractor) simply cannot use
  the platform without a fork.
- **The tendering persona's business rules** — clauses like "quotes base scope as X, Y, Z" in
  `tendering.persona.ts` encode Initial Services' actual quoting practice. A new company would
  have different rules. Making this configurable means moving the persona definitions out of `.ts`
  files into `PersonaDefinition` DB rows — much bigger scope, likely a whole workstream by itself,
  and probably not phase-1 stuff.

---

## Model B (multi-tenant SaaS) — one paragraph as promised

Everything above is a **prerequisite** for Model B, not a competitor to it. Moving legal text into
`LegalDocument`, identity into `CompanyProfile`, persona overrides into `PersonaCompanyInstruction`,
and disciplines into a `Discipline` table are exactly the changes B would need too. What B would
additionally require, that A does not: (1) a `tenantId` foreign key on every single row across all
~190 models — this is the enormous piece; (2) tenant-scoped Prisma middleware for filtering; (3)
tenant-scoped auth (JWT carries `tenantId`); (4) an isolation model (per-schema, per-DB, or row-level
with hard Postgres RLS); (5) tenant-aware background jobs, seeds, backups, migrations. B is a
6–12 month project; A is a 2-week project on top of what's already done. Marco's call, but if the
goal is "hand this to one other company", A is the right answer, and A moves toward B without
throwing anything away.

---

## Open questions for Marco (see `docs/pr-prompts/needs-marco/tenant-readiness-decisions.md`)

The unclassified items (material densities, four-discipline model, whether this is a product) are
not answerable from the code. They're in the decisions doc as a short list for you to answer when
you're back.
