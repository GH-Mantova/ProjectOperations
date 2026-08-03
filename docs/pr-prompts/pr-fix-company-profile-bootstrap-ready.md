---
premise: ! grep -qF '@Post("profile")' apps/api/src/modules/company-profile/company-profile.controller.ts
premise_means: The company-profile controller exposes GET and PATCH /admin/company/profile but no POST bootstrap route, so the "Create company profile" button (and the service's own "POST /admin/company/profile to bootstrap" hint) 404s with "Cannot POST /api/v1/admin/company/profile" and a fresh environment can never create its company profile from the UI.
scope:
  - apps/api/src/modules/company-profile/company-profile.controller.ts
  - apps/api/src/modules/company-profile/company-profile.service.ts
  - apps/api/src/modules/company-profile/__tests__/**
done_when: pnpm build && pnpm lint && grep -qF '@Post("profile")' apps/api/src/modules/company-profile/company-profile.controller.ts
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# Fix: add the missing POST bootstrap for the company-profile singleton

## Context (verified on origin/main)
`apps/api/src/modules/company-profile/company-profile.controller.ts` (`@Controller("admin/company")`)
has `@Get("profile")` and `@Patch("profile")` but **no `@Post("profile")`**. The web empty-state
("No company profile yet" → "Create company profile", `apps/web/src/pages/admin/AdminCompanyPage.tsx:211`)
calls `authFetch("/admin/company/profile", { method: "POST" })`, and
`company-profile.service.ts:137` itself tells the user to "POST /admin/company/profile to bootstrap".
Because the route does not exist, NestJS returns `Cannot POST /api/v1/admin/company/profile`.

## What to build
1. Add an **idempotent** service method on `CompanyProfileService` (e.g. `bootstrapProfile()`) that
   creates the CompanyProfile singleton if it does not already exist and returns it. If the singleton
   already exists it must return the existing one — never create a second, never throw. Reuse the same
   default field values the seed uses so a UI-created profile matches a seeded one.
2. Add `@Post("profile")` to `CompanyProfileController`, guarded by `@RequirePermissions("platform.admin")`
   exactly like the existing GET/PATCH, calling the new service method and returning the profile.
3. Add or extend the unit spec under `company-profile/__tests__/` to cover both paths: POST with no
   existing profile creates and returns it; POST when one already exists returns the existing singleton
   without creating a duplicate.

## Do NOT
- Do NOT change the CompanyProfile Prisma model or add a migration — the singleton model already
  exists (PR #549). This is API-route-only; `scope` deliberately excludes `prisma/`.
- Do NOT weaken the permission guard — POST must require `platform.admin`, enforced server-side.
- Do NOT touch the web app — the client already calls POST correctly; the route is what is missing.

## VERIFY
- `pnpm build && pnpm lint`
- `pnpm --filter @project-ops/api test -- company-profile` (the new/extended spec passes)
- `grep -qF '@Post("profile")' apps/api/src/modules/company-profile/company-profile.controller.ts`

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — if the work is already on `main`, say `NO-OP: <reason>`.
Never ask a question or "stand by" for approval; there is no human in a headless run.
Read the CI job log before diagnosing any failure.
