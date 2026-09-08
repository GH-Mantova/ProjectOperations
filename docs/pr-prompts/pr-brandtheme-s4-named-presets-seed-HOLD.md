---
premise: '! grep -rq "Harbour" apps/api/prisma'
premise_means: >-
  The mockup's named presets do not exist as data. MEASURED 2026-09-08 - `grep -ril Harbour` and
  `grep -ril Graphite` over apps/web/src and apps/api/src both return 0 files. The seeding machinery
  they need is already there and working - `seed-company-profile.ts:103` defines
  `seedDefaultBrandColorScheme()` which `prisma.brandColorScheme.upsert()`s a single row named for
  the house palette (`primaryColorHex: "#005B61"` at :110), `:24` calls it, `:33-36` wires
  `activeColorSchemeId` when the profile has none, and `seed.ts:3762` calls `seedCompanyProfile`.
  Only the extra rows are missing.
requires_on_main: 'apps/api/prisma/schema.prisma :: sidebarBgHex'
scope:
  - apps/api/prisma/seed-company-profile.ts
  - apps/api/src/modules/branding/__tests__/branding.service.spec.ts
done_when: >-
  grep -q "Harbour" apps/api/prisma/seed-company-profile.ts && grep -q "Graphite"
  apps/api/prisma/seed-company-profile.ts && pnpm --filter api test
size: 2
gate_allow: none
seed_only: true
escalates: false
backfill: false
module: branding
---

# Brand & theme S4: Harbour and Graphite as seeded schemes, not as CSS blocks

`theme-system-plan.md` SECTION 7: **S4 - named presets (Harbour, Graphite) as seeded
`BrandColorScheme` rows. Schema: seed only. Gate: S3.**

## Why rows and not `[data-theme="..."]` blocks

The plan settles this and the reasoning is worth carrying into the code: *"Presets are seeded rows
rather than `[data-theme="..."]` CSS blocks - the approved mockup is a **builder**, so a preset the
company cannot then edit would contradict it. This supersedes SLICE 3's and SLICE 16's
`[data-theme]` approach."*

A preset in CSS is a thing Marco can look at. A preset in a row is a thing his company can open,
adjust and save. Build the second one.

## What to do

Extend `seed-company-profile.ts` with two more `prisma.brandColorScheme.upsert()` calls, following
`seedDefaultBrandColorScheme()` at `:103` exactly - same upsert shape, same `where: { name }`
uniqueness (the model has `name @unique` at `schema.prisma:6432`), same idempotence.

Each preset fills **all fifteen** colour fields - `primaryColorHex`, `secondaryColorHex` and the
thirteen S3 added. A preset with NULLs is a half-preset: it would inherit tokens.css for whatever it
omitted, and two presets that differ only in the fields someone bothered to fill are not presets,
they are accidents. Take the values from the approved mockup.

## TRAP 1 - do NOT change the active scheme

`seed-company-profile.ts:33-36` sets `activeColorSchemeId` **only when it is null**, which is what
makes re-seeding safe on a live database. Adding presets must not touch that logic and must not
point the profile at Harbour or Graphite. A seed run that silently repaints a live company's ERP is
the worst possible outcome of a slice whose whole job is to offer choices.

The comment at `:30` explains why the null-check is there. Read it before editing anything near it.

## TRAP 2 - idempotence is the whole contract

`seed.ts` is run against real data. `upsert` on `name` gives you idempotence for free, but only if
you key on `name` and nothing else. Do not generate ids. Do not delete-then-create. Running the seed
twice must leave exactly two extra rows, and running it after someone has EDITED Harbour must not
silently revert their edit - so use `create` for the insert and an `update` payload that is either
empty or deliberately minimal, and say in the PR body which you chose and why.

This is a real fork and it is worth a sentence: `update: {}` means "seed once, never overwrite a
human's edit" - probably right for a builder. A full `update` payload means "the seed is the source
of truth and re-seeding resets presets" - defensible, but it will surprise someone.

## TRAP 3 - CP-08 asserts seed idempotency and it is a required check

`CP-08-seed-idempotency.spec.ts` exists and is enforced. A seed that is not idempotent fails it.
Run the seed twice locally before opening the PR.

## Not in scope

- Any UI for choosing a preset. That surface is **S6**.
- `apps/api/prisma/seed-initial-services.ts` and the other seed files - untouched.
- `schema.prisma` - S3 added the columns; this slice only writes rows. **No migration.** If you find
  yourself needing one, stop: the gate has misfired and S3 did not land what this slice expects.

## Test

**`apps/api/src/modules/branding/__tests__/branding.service.spec.ts`** - assert `listColorSchemes()`
returns the two presets alongside the default, and that each preset has all fifteen colour fields
non-null. The second half is the guard against a half-filled preset shipping unnoticed.

## Findings for Marco - report, do not act

1. **The mockup names two presets. If it names more, this slice under-delivers** - it was written
   from SECTION 7's table, which lists Harbour and Graphite only. Say so in the PR body if the design
   shows others, and do not invent extras.
2. **Whether a re-seed should overwrite an edited preset is a product decision**, not a code one.
   Pick the conservative option (`update: {}`, never overwrite), state it plainly, and let Marco
   reverse it if he wants the other behaviour.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting". There is no human in this run. **Finishing the work and then asking for
> permission is indistinguishable from failing** - the work is discarded either way.
