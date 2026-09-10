# PR #787 Escalation — sharp@0.35.0 Type Definitions Blocking Merge

## Issue

PR #787 (Dependabot bump of sharp from 0.33.5 to 0.35.0) cannot merge because sharp 0.35.0 **removed TypeScript type definitions**, causing `TS7016` compilation errors in two handler files (`read-asbestos-register.handler.ts`, `read-tender-drawing.handler.ts`). Both `pnpm build` (API) and e2e build steps fail with implicit `any` type errors.

## Action Required

Before this can be re-fired or merged:

1. Confirm whether `@types/sharp` exists and is compatible with sharp 0.35.0 in npm registry.
2. If yes: create a separate PR to add `pnpm add -D @types/sharp` to `apps/api/package.json`, merge it to main, then re-fire Dependabot.
3. If no: either downgrade sharp back to 0.33.5 or wait for sharp maintainers to re-publish type definitions.

## CI Evidence

- **API build failed:** TS7016 error in src/modules/personas/tools/handlers/{read-asbestos-register,read-tender-drawing}.handler.ts line 3 (sharp import)
- **E2E build failed:** same TypeScript error before tests run
- **Web & data-model:** green (no sharp usage)

Do not manually merge this PR. Block until types are resolved.
