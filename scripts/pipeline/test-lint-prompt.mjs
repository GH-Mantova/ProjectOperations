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
import { join } from "node:path";

const LINT = "C:\\ProjectOperations2\\scripts\\pipeline\\lint-prompt.mjs";
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
console.log("=== exit 0 ADMIT: premise true (the test-id really is absent from main)");
run("admit",
  "premise: '! grep -q \"sidebar-collapse-toggle\" apps/web/src/components/ShellLayout.tsx'\n" +
  "premise_means: testid absent\nscope:\n  - apps/web/src/**\n" +
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

rmSync(dir, { recursive: true, force: true });
console.log("\n=== " + pass + " passed, " + fail + " failed");
process.exit(fail > 0 ? 1 : 0);
