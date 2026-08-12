#!/usr/bin/env node
/**
 * Self-test for the intake lint.
 *
 * WHY THIS EXISTS: the linter shipped with `shell: "/bin/bash"` hardcoded. On Windows that shell
 * does not exist, every premise failed to SPAWN, and the spawn failure was misread as "premise
 * false => work already done" — so the linter BINNED VALID PROMPTS while printing a green message.
 * A linter that silently discards real work is far worse than no linter.
 *
 * The single most important assertion here is BROKEN != STALE.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve lint-prompt.mjs relative to this file so the tests run against whichever
// checkout (worktree or main) this test file lives in. The old hardcoded path broke
// when run from a worktree — it would test the main-tree lint instead of the local one.
const LINT = join(dirname(fileURLToPath(import.meta.url)), "lint-prompt.mjs");
const REPO = "C:\\po-watcher\\ProjectOperations";
const dir = mkdtempSync(join(tmpdir(), "lint-test-"));

let pass = 0;
let fail = 0;

function run(name, frontMatter, expectedExit) {
  const file = join(dir, name + "-ready.md");
  writeFileSync(file, "---\n" + frontMatter + "\n---\n\n# body\n", "utf8");

  let code = 0;
  let out = "";
  try {
    out = execFileSync("node", [LINT, file], { cwd: REPO, encoding: "utf8" });
  } catch (e) {
    code = e.status;
    out = String(e.stdout || "") + String(e.stderr || "");
  }

  const ok = code === expectedExit;
  console.log((ok ? "PASS " : "FAIL ") + name + "  (exit " + code + ", wanted " + expectedExit + ")");
  if (!ok) console.log("      " + out.trim().split("\n").join("\n      "));
  ok ? pass++ : fail++;
}

// 0 = admit, 1 = reject, 3 = stale
// Use `true` so the premise is always satisfied (work is always "needed") regardless of the
// live-file state. The original premise used a hardcoded path that later became stale when
// sidebar-collapse-toggle was added to ShellLayout.tsx, turning a green test red.
console.log("=== exit 0 ADMIT: premise always-true (well-formed prompt is admitted)");
run("admit",
  "premise: 'true'\n" +
  "premise_means: always-true sentinel\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none", 0);

console.log("\n=== exit 3 STALE: premise false (shell__collapse-toggle DOES exist -> work done)");
run("stale",
  "premise: '! grep -q \"shell__collapse-toggle\" apps/web/src/components/ShellLayout.tsx'\n" +
  "premise_means: the toggle class does not exist yet\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none", 3);

console.log("\n=== exit 1 REJECT (NOT 3!): premise is BROKEN, not false. Must never be binned.");
run("broken-cmd",
  "premise: 'thiscommanddoesnotexist --wat'\n" +
  "premise_means: nonsense\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none", 1);

run("broken-file",
  "premise: 'grep -q \"x\" apps/web/src/NoSuchFile.tsx'\n" +
  "premise_means: file that does not exist\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none", 1);

console.log("\n=== exit 1 REJECT: oversized (pr-replace-native-browser-dialogs = 48 files, 240 turns)");
run("too-big",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 48\ngate_allow: none", 1);

console.log("\n=== exit 1 REJECT: gate_allow declares migrations but scope has none (CP-11 would fail)");
run("gate-mismatch",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: migrations", 1);

console.log("\n=== exit 1 REJECT: missing required field");
run("missing-field",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\ngate_allow: none", 1);

console.log("\n=== exit 1 REJECT: migration scope with no rollback_strategy (LL-29)");
run("migration-no-rollback",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/api/prisma/migrations/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: migrations", 1);

console.log("\n=== exit 1 REJECT: migration scope with empty rollback_strategy");
run("migration-empty-rollback",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/api/prisma/migrations/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: migrations\nrollback_strategy: ''", 1);

console.log("\n=== exit 0 ADMIT: migration scope WITH rollback_strategy AND a test file (Gate A satisfied)");
run("migration-with-rollback",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/api/prisma/migrations/**\n" +
  "  - apps/api/test/backfill.spec.ts\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: migrations\n" +
  "rollback_strategy: 'additive; safe to leave, re-run drops nothing'", 0);

console.log("\n=== exit 0 ADMIT: non-migration prompt without rollback_strategy (still optional)");
run("non-migration-no-rollback",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none", 0);

console.log("\n=== exit 1 REJECT: migration scope, no test file in scope, no backfill:false (BACKFILL_TEST_REQUIRED)");
run("migration-no-test-no-backfill-flag",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/api/prisma/migrations/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: migrations\n" +
  "rollback_strategy: 'additive; safe to leave'", 1);

console.log("\n=== exit 0 ADMIT: migration scope with backfill:false (author asserts no backfill)");
run("migration-backfill-false",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/api/prisma/migrations/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: migrations\n" +
  "rollback_strategy: 'additive; safe to leave'\nbackfill: false", 0);

console.log("\n=== exit 0 ADMIT: migration scope with a *.test.ts file (also satisfies Gate A)");
run("migration-with-test-ts",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/api/prisma/migrations/**\n" +
  "  - apps/api/test/foo.test.ts\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: migrations\n" +
  "rollback_strategy: 'additive; safe to leave'", 0);

console.log("\n=== exit 1 REJECT: destructive signal (backfill) with escalates: false (DESTRUCTIVE_MUST_ESCALATE)");
run("destructive-backfill-no-escalate",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/api/prisma/migrations/**\n" +
  "  - apps/api/test/backfill.spec.ts\n" +
  "done_when: pnpm build && run backfill script\nsize: 3\ngate_allow: migrations\n" +
  "rollback_strategy: 'revert migration'\nescalates: false", 1);

console.log("\n=== exit 0 ADMIT: same destructive prompt with escalates: true (gate satisfied)");
run("destructive-backfill-with-escalate",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/api/prisma/migrations/**\n" +
  "  - apps/api/test/backfill.spec.ts\n" +
  "done_when: pnpm build && run backfill script\nsize: 3\ngate_allow: migrations\n" +
  "rollback_strategy: 'revert migration'\nescalates: true", 0);

console.log("\n=== exit 0 ADMIT: NOT NULL signal with escalates: true (gate satisfied)");
run("not-null-with-escalate",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/api/prisma/migrations/**\n" +
  "  - apps/api/test/notnull.spec.ts\n" +
  "done_when: pnpm build && enforce SET NOT NULL\nsize: 3\ngate_allow: migrations\n" +
  "rollback_strategy: 'revert migration'\nescalates: true", 0);

console.log("\n=== exit 1 REJECT: NOT NULL signal with escalates: false (DESTRUCTIVE_MUST_ESCALATE)");
run("not-null-no-escalate",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/api/prisma/migrations/**\n" +
  "  - apps/api/test/notnull.spec.ts\n" +
  "done_when: pnpm build && enforce SET NOT NULL\nsize: 3\ngate_allow: migrations\n" +
  "rollback_strategy: 'revert migration'\nescalates: false", 1);

console.log("\n=== exit 0 ADMIT: ordinary non-destructive prompt (no destructive signal, no escalation needed)");
run("ordinary-prompt-no-destructive",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/components/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nescalates: false", 0);

console.log("\n=== exit 0 ADMIT: prompt containing 'delete' inside a longer identifier (no false-positive)");
run("delete-in-identifier-no-false-positive",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/pages/SoftDeletePage.tsx\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nescalates: false", 0);

rmSync(dir, { recursive: true, force: true });
console.log("\n=== " + pass + " passed, " + fail + " failed");
process.exit(fail > 0 ? 1 : 0);
