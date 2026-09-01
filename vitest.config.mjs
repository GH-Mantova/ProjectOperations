// Root-level vitest config for running scripts-level test suites.
// Enables: pnpm vitest run scripts/crm/__tests__/recompute-client-stats.spec.mjs
//
// Scope is intentionally narrow: only *.spec.mjs and *.test.mjs under scripts/.
// Web/UI tests are handled by apps/web and packages/ui configs respectively.
//
// Uses plain object export (no defineConfig import) so this file resolves
// correctly even when vitest is hoisted to apps/web/node_modules.
export default {
  test: {
    include: ["scripts/**/*.{spec,test}.mjs"],
    environment: "node",
    globals: false,
  },
};
