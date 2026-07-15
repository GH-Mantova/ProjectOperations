---
premise: '! grep -q "model BrandColorScheme" apps/api/prisma/schema.prisma'
premise_means: The BrandColorScheme model does not exist yet; branding still lives as loose string columns on CompanyProfile with a TODO to move to FKs.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/prisma/seed/**
  - apps/api/src/modules/branding/**
  - apps/web/src/pages/admin/AdminCompanyPage.tsx
  - apps/web/src/api/**
done_when: pnpm build && pnpm lint && grep -q "model BrandColorScheme" apps/api/prisma/schema.prisma && grep -q "model BrandAsset" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: false
---

# PR prompt: Branding manager -- land BrandColorScheme + BrandAsset (DB-stored, isSuperUser)

Branch: `feat/branding-manager`. New PR.

## Why this PR exists

The branding fields on `CompanyProfile` (apps/api/prisma/schema.prisma, the `- Branding -` block
near line 4701) are loose strings and carry an explicit TODO naming THIS prompt:

```
// TODO: when BrandColorScheme + BrandAsset land (staged in pr-branding-manager),
// replace these string fields with FKs. Until then, plain strings so the
// profile is usable without a second migration.
primaryColorHex / secondaryColorHex / logoLightUrl / logoDarkUrl / faviconUrl / pdfLetterheadUrl
```

`apps/web/src/pages/admin/AdminCompanyPage.tsx:507` carries the mirror comment
("Will move to BrandColorScheme / BrandAsset FKs once those tables land.").

This was HOLD-gated on the quote-PDF crash fix. **That fix merged (PUPPETEER_EXECUTABLE_PATH is on
main in apps/api/src/modules/pdf-rendering/pdf-renderer.service.ts).** The blocker is gone; the
tables were never landed. This PR lands them.

## What to build -- ADDITIVE ONLY (expand/contract; do NOT drop the legacy columns in this PR)

The design is already fixed by the existing fields. Mirror them 1:1 -- do NOT invent new brand
dimensions.

1. **Schema** (apps/api/prisma/schema.prisma):
   - `model BrandColorScheme` -- an id, a human `name`, and the color roles that already exist:
     `primaryColorHex`, `secondaryColorHex` (keep the `@db`/hex conventions used today). Timestamps.
   - `model BrandAsset` -- an id, a `kind` enum `BrandAssetKind { LOGO_LIGHT LOGO_DARK FAVICON
     PDF_LETTERHEAD }`, and a `url String`. Timestamps. `@@unique` on the singleton scope + kind so
     there is one asset per kind.
   - On `CompanyProfile`, ADD nullable FK relations only: `activeColorSchemeId String?` ->
     `BrandColorScheme`, and let `BrandAsset` rows hang off the singleton. **Leave the existing
     string columns in place** (primaryColorHex, logoLightUrl, ...). They are the fallback until a
     later contract PR removes them.

2. **Migration** (apps/api/prisma/migrations/**): create the two tables + enum + the nullable FK
   column, then **backfill**: insert one BrandColorScheme row from the current
   CompanyProfile.primaryColorHex/secondaryColorHex values and point activeColorSchemeId at it;
   insert BrandAsset rows for whichever of logoLightUrl/logoDarkUrl/faviconUrl/pdfLetterheadUrl are
   non-null. Purely additive -- no `DROP COLUMN`, no data loss.

3. **Seed** (apps/api/prisma/seed/**): seed a default BrandColorScheme (the current
   #005B61 / #FEAA6D defaults) and wire the singleton CompanyProfile.activeColorSchemeId to it so a
   fresh seed is coherent. Idempotent (upsert; never deleteMany-then-create).

4. **Backend module** (apps/api/src/modules/branding/**): a `BrandingModule` with a service +
   controller exposing read + update of the color scheme and assets, **guarded so only
   `isSuperUser` (or the existing admin-config permission) can mutate** -- match the guard pattern
   already used by the company-profile/admin-config endpoints. DTOs with class-validator. Register
   the module in the API app module.

5. **Frontend** (apps/web/src/pages/admin/AdminCompanyPage.tsx + apps/web/src/api/**): repoint the
   existing branding inputs to read from the new relations when present, falling back to the legacy
   string fields when the FK is null. Remove ONLY the stale "Will move to ..." comment. Keep the
   page working for a super-user exactly as it does today.

## Do NOT

- Do NOT drop or rename the existing CompanyProfile string columns -- additive only this PR.
- Do NOT invent brand dimensions beyond the six fields that exist today.
- Do NOT build file upload / blob storage -- assets are URLs, exactly as now.
- Do NOT touch the PDF renderer, Azure, Entra, SharePoint, or any auth/secret/deploy config.
- Do NOT gate the color scheme behind anything a super-user cannot pass (frontend guard MUST honor
  `isSuperUser`, per the 2026-07-10 RatesListsAdminPage lockout lesson).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails

- One attempt. If blocked, say `NO-OP: <reason>` loudly -- never exit silently, never "stand by"
  for approval (there is no human in this run).
- `pnpm build` + `pnpm lint` must pass before you open the PR.
- This PR adds a migration: the pipeline writes the bare `GATE-ALLOW: migrations` marker at column 0
  from the `gate_allow` front-matter -- do not hand-write it.
- Read the CI job log before diagnosing any CI failure; never re-run hoping for green.
- The completion test: is there a PR number in your output? If not because the work was already on
  main, say `NO-OP`. If not because you are waiting for someone -- there is nobody. Open the PR.
