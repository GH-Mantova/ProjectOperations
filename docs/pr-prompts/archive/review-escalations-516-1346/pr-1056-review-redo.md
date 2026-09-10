# PR #1056 — Re-fire reason

PR #1056 (feat(api): CRM S2 — DropReason CRUD API) has a one-line bug in `UpdateDropReasonDto`: imports `PartialType` from `@nestjs/mapped-types` (not installed) instead of `@nestjs/swagger` (project standard). This breaks the build — both `pnpm build` and `pnpm lint` fail with "module not found" and property access errors. Fix is trivial (change line 1 of `apps/api/src/modules/crm/dto/update-drop-reason.dto.ts`), but re-fire the prompt to regenerate the PR branch cleanly with correct imports and ensure all CI passes.
