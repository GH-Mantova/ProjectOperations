---
premise: '! grep -q "model UserAppearancePreference" apps/api/prisma/schema.prisma'
premise_means: >-
  A person's display density and colour scheme have nowhere to live except their browser.
  MEASURED 2026-10-02 at origin/main 7d9926ae: density is localStorage "projectops.density"
  (apps/web/src/lib/density.ts:23). The per-user scheme override is localStorage
  "projectops.brand-override" (brand-scheme.ts:35), and BrandSchemeProvider deletes it on every
  logout, so a personal choice dies at sign-out and never follows the person to another device.
  Also, only company.manage can list colour schemes (GET /admin/branding/color-schemes,
  branding.controller.ts:70-71); the only route open to every user is GET /branding/active.
  Marco decided on 2026-10-02:
  - the choice is saved to the person's account;
  - a person may pick only from the company's saved schemes.
  POSITIVE CONTROL: grep -n "model BrandColorScheme" apps/api/prisma/schema.prisma returns a hit.
done_when: >-
  pnpm build && pnpm lint && pnpm --filter api test &&
  grep -q "model UserAppearancePreference" apps/api/prisma/schema.prisma &&
  grep -q "APPEARANCE_PREFERENCES_V1" apps/api/src/modules/appearance-preferences/appearance-preferences.service.ts &&
  node scripts/data-model/build-relationship-map.mjs --check
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/appearance-preferences/appearance-preferences.module.ts
  - apps/api/src/modules/appearance-preferences/appearance-preferences.controller.ts
  - apps/api/src/modules/appearance-preferences/appearance-preferences.service.ts
  - apps/api/src/modules/appearance-preferences/__tests__/appearance-preferences.service.spec.ts
  - apps/api/src/app.module.ts
  - apps/api/src/modules/branding/branding.controller.ts
  - apps/api/src/modules/branding/branding.service.ts
  - apps/api/src/modules/branding/__tests__/branding-viewer-schemes.spec.ts
size: 7
gate_allow: migrations
backfill: false
seed_only: false
rollback_strategy: >-
  Additive only. The migration creates one new table; no existing column or row changes. To roll
  back, revert the code: the table is unused and can be dropped later by Marco. A user with no row
  sees exactly today's behaviour.
escalates: true
module: appearance-preferences
---

**MIGRATION — `escalates: true`.** The built PR stops for Marco before merge, because `deploy.yml`
runs `migrate deploy` against production on merge.

# Brand & theme S7c-1: save each person's density and colour scheme to their account

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's decisions, 2026-10-02 — build to these

1. A person's appearance choice is **saved to their account** and follows them to any device.
2. A person may pick **only from the company's saved colour schemes**, never free colours.
3. (Standing, 2026-09-25) colour applies in **light mode only**, and the personal controls live in
   **Personal settings**. Both are enforced on the web side (separate slices).

## What to build

### Schema: one new table, additive

```prisma
model UserAppearancePreference {
  userId         String            @id @map("user_id")
  user           User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  density        String?           // "comfortable" | "compact"; null = default (comfortable)
  colourSchemeId String?           @map("colour_scheme_id")
  colourScheme   BrandColorScheme? @relation(fields: [colourSchemeId], references: [id], onDelete: SetNull)
  updatedAt      DateTime          @updatedAt @map("updated_at")
  @@map("user_appearance_preferences")
}
```

- Add the back-relations on `User` and `BrandColorScheme`.
- `onDelete: SetNull` on the scheme means that when an admin deletes a scheme, that person falls
  back to the company theme. No orphaned reference, and no code path needed for it.
- `null` for `colourSchemeId` means "use the company theme".
- Migration name `<timestamp>_brandtheme_s7c_appearance_preferences`, CREATE TABLE only.
- Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
  `docs/data-model/*`.

### Module: `appearance-preferences`

Marker in the service: `export const APPEARANCE_PREFERENCES_V1 = "brandtheme-s7c-1";`

- `GET /appearance-preferences/me` returns
  `{ density: "comfortable"|"compact", colourSchemeId: string|null, colourScheme: <15-colour palette + name>|null }`.
  With no row, return `{ density: "comfortable", colourSchemeId: null, colourScheme: null }`. Do
  **not** create a row on read.
- `PUT /appearance-preferences/me`:
  - Body is `{ density?, colourSchemeId? }`, upserted for the caller only.
  - `density` must be one of the two values.
  - `colourSchemeId` must be `null` or an existing `BrandColorScheme.id`. Anything else is a 400.
- **Self-only, any signed-in user.** Guard with `JwtAuthGuard`. Take the user from
  `@CurrentUser()`, never from the body or URL. No permission code, matching `BrandingViewerController`.
- If an authz or route-guard test enumerates permission-free routes, add both routes there with the
  reason "self-only, every user".
- Register the module in `app.module.ts`.

### Viewer route: `GET /branding/schemes`

- Lives on `BrandingViewerController` (`@Controller("branding")`, JWT only).
- Returns every saved scheme as `{ id, name, isCompanyDefault, <the 15 colour fields> }` and
  **nothing else**: no audit fields, no asset URLs.
- This is the list the personal picker shows. The admin route `GET /admin/branding/color-schemes` is
  unchanged.

## Tests

1. Service:
   - GET with no row returns the defaults and creates nothing.
   - PUT then GET round-trips both fields.
   - PUT for user A never changes user B's row.
2. Validation:
   - An unknown `colourSchemeId` is a 400, and so is a `density` outside the two values.
   - `colourSchemeId: null` is accepted and clears the choice.
3. Delete cascade (unit level, mocked Prisma): when the scheme is deleted, the preference reads as
   `colourSchemeId: null`. State the `SetNull` relation in the test name.
4. `GET /branding/schemes`:
   - It returns exactly the documented keys per scheme.
   - It requires only JWT, so a user without `company.manage` gets 200.
5. Update any existing spec whose Prisma payload assertions break.

## PR body

- `GATE-ALLOW: migrations` as a bare line at column 0.
- A "Migration" section with the SQL.

## DO NOT

- No change to `User` columns. No change to existing branding routes or to `/branding/active`.
- No web change. That is S7c-2.
- Do not touch `sot/` (CP-24).
