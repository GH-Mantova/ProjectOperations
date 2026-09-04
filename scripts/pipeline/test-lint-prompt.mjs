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
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve lint-prompt.mjs relative to this file so the tests run against whichever
// checkout (worktree or main) this test file lives in. The old hardcoded path broke
// when run from a worktree — it would test the main-tree lint instead of the local one.
const LINT = join(dirname(fileURLToPath(import.meta.url)), "lint-prompt.mjs");
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = mkdtempSync(join(tmpdir(), "lint-test-"));

let pass = 0;
let fail = 0;

// Every fixture body carries the standing-authority grant. As of 2026-09-03 a body
// without it is a hard REJECT (MISSING_STANDING_AUTHORITY), so a fixture that omits it
// would be testing the grant check rather than whatever it means to test. The three
// tests that DO exercise the grant check build their bodies inline, below.
const BODY = "\n# body\n\n## STANDING AUTHORITY\n\n" + "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n";

function run(name, frontMatter, expectedExit) {
  const file = join(dir, name + "-ready.md");
  writeFileSync(file, "---\n" + frontMatter + "\n---\n" + BODY, "utf8");

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
  "premise_means: always-true sentinel\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none", 0);

console.log("\n=== exit 3 STALE: premise false (shell__collapse-toggle DOES exist -> work done)");
run("stale",
  "premise: '! grep -q \"shell__collapse-toggle\" apps/web/src/components/ShellLayout.tsx'\n" +
  "premise_means: the toggle class does not exist yet\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none", 3);

console.log("\n=== exit 1 REJECT (NOT 3!): premise is BROKEN, not false. Must never be binned.");
run("broken-cmd",
  "premise: 'thiscommanddoesnotexist --wat'\n" +
  "premise_means: nonsense\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none", 1);

run("broken-file",
  "premise: 'grep -q \"x\" apps/web/src/NoSuchFile.tsx'\n" +
  "premise_means: file that does not exist\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none", 1);

console.log("\n=== exit 1 REJECT: oversized (pr-replace-native-browser-dialogs = 48 files, 240 turns)");
run("too-big",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 48\ngate_allow: none", 1);

console.log("\n=== exit 1 REJECT: gate_allow declares migrations but scope has none (CP-11 would fail)");
run("gate-mismatch",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: migrations", 1);

console.log("\n=== exit 1 REJECT: missing required field");
run("missing-field",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\ngate_allow: none", 1);

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
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
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
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nescalates: false", 0);

console.log("\n=== exit 0 ADMIT: prompt containing 'delete' inside a longer identifier (no false-positive)");
run("delete-in-identifier-no-false-positive",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/SoftDeletePage.tsx\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nescalates: false", 0);

// ── Tier 2 scope-gating (2026-08-17) ────────────────────────────────────────
// Intent words are TOPIC words. They appear in prompt file names, in prose about other prompts,
// and in text explaining this rule. A prompt that cannot reach apps/api/prisma cannot perform the
// hazard, so the intent words must not reject it. Three real prompts were rejected on one day for
// exactly this — two of them sat armed in the queue, unable to ever dequeue, and nobody noticed.

console.log("\n=== exit 0 ADMIT: docs-only prompt mentioning 'backfill' (topic word, cannot reach the DB)");
run("docs-only-mentions-backfill",
  "premise: 'true'\npremise_means: names another prompt whose filename contains backfill\n" +
  "scope:\n  - docs/plans/**\ndone_when: pnpm lint\nsize: 1\ngate_allow: none\nescalates: false", 0);

console.log("\n=== exit 0 ADMIT: scripts-only prompt explaining the rule (says 'destructive' and 'NOT NULL')");
run("scripts-only-explains-the-rule",
  "premise: 'true'\npremise_means: describes the destructive NOT NULL signal this rule matches\n" +
  "scope:\n  - scripts/pipeline/**\ndone_when: node scripts/pipeline/test-lint-prompt.mjs\n" +
  "size: 2\ngate_allow: none\nescalates: false", 0);

console.log("\n=== exit 1 REJECT: tier-1 literal SQL still fires with NO prisma scope (safety net intact)");
run("docs-only-with-literal-drop-table",
  "premise: 'true'\npremise_means: always\nscope:\n  - docs/plans/**\n" +
  "done_when: DROP TABLE legacy_rates\nsize: 1\ngate_allow: none\nescalates: false", 1);

console.log("\n=== exit 1 REJECT: migration-scoped 'backfill' still caught (the OPS-6 case)");
run("migration-scoped-backfill-still-caught",
  "premise: 'true'\npremise_means: backfill site ids then enforce\nscope:\n  - apps/api/prisma/migrations/**\n" +
  "  - apps/api/test/site.spec.ts\ndone_when: pnpm build\nsize: 3\ngate_allow: migrations\n" +
  "rollback_strategy: 'revert migration'\nescalates: false", 1);

// ── Cluster-chaining SLICE 1: dependency key recognition and validation ─────
// Each negative test was RED before this PR and must be GREEN after.
// The final positive tests (no dep keys at all, well-formed dep keys) must
// remain ADMIT — they are the regression guard for existing queue prompts.

console.log("\n=== exit 1 REJECT: requires-merged (hyphen) → UNKNOWN_KEY");
run("dep-hyphen-merged",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires-merged: 42", 1);

console.log("\n=== exit 1 REJECT: requires_files_on_main (plural) → UNKNOWN_KEY, suggests singular");
run("dep-plural-files-on-main",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires_files_on_main: apps/foo.ts", 1);

console.log("\n=== exit 1 REJECT: requires_merged: 0 → REQUIRES_MERGED_INVALID");
run("dep-merged-zero",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires_merged: 0", 1);

console.log("\n=== exit 1 REJECT: requires_merged: -1 → REQUIRES_MERGED_INVALID");
run("dep-merged-negative",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires_merged: -1", 1);

console.log("\n=== exit 1 REJECT: requires_merged: abc → REQUIRES_MERGED_INVALID");
run("dep-merged-abc",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires_merged: abc", 1);

console.log("\n=== exit 1 REJECT: requires_merged: (empty) → REQUIRES_MERGED_INVALID");
run("dep-merged-empty",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires_merged:", 1);

console.log("\n=== exit 1 REJECT: requires_file_on_main: (empty) → REQUIRES_PATH_EMPTY");
run("dep-file-on-main-empty",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires_file_on_main:", 1);

console.log("\n=== exit 1 REJECT: requires_on_main: (empty) → REQUIRES_PATH_EMPTY");
run("dep-on-main-empty",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires_on_main:", 1);

console.log("\n=== exit 0 ADMIT: requires_merged well-formed → admitted (no path-gate check)");
run("dep-all-keys-well-formed",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "requires_merged: 42", 0);

// requires_on_main / requires_file_on_main with paths ABSENT from origin/main REJECT under the
// ARMED_GATE_STILL_CHECKED fix (the whole point of the gate is that the prompt cannot run yet).
// To test that the SLICE 1 parser accepts well-formed values, we defeat the gate probe with a
// broken git binary so it warns-and-skips fail-safe. The parser-shape check still runs and admits.
console.log("\n=== exit 0 ADMIT: requires_on_main path-only shape accepted (git broken -> gate probe skipped)");
runIsolated("dep-on-main-path-only",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "requires_on_main: apps/foo.ts",
  0,
  { env: { LINT_GIT_BIN: "this-git-binary-does-not-exist-shape-check-9876543210" } });

console.log("\n=== exit 0 ADMIT: requires_on_main path :: fixed-string shape accepted (git broken -> gate probe skipped)");
runIsolated("dep-on-main-path-and-string",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "requires_on_main: apps/foo.ts :: some fixed string",
  0,
  { env: { LINT_GIT_BIN: "this-git-binary-does-not-exist-shape-check-9876543210" } });

console.log("\n=== exit 0 ADMIT: prompt with NONE of the dep keys → unchanged behaviour (MOST important)");
run("dep-none-present",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none", 0);

// ── Cluster-chaining SLICE 3: cluster metadata + graph rules ────────────────
// Each negative test is RED before the rule lands and GREEN after.
// The final positive is the regression guard: a prompt with none of the
// cluster keys must behave exactly as it did before.

// Helper: run one prompt in a dedicated tempdir with optional sibling files
// laid down beforehand. Needed for CLUSTER_CYCLE (two prompts, one directory)
// and for the fail-safe "malformed sibling" test. Also accepts extra env vars
// so we can simulate git unavailability for the DEAD_GATE fail-safe test.
function runIsolated(name, frontMatter, expectedExit, opts) {
  opts = opts || {};
  const isoDir = mkdtempSync(join(tmpdir(), "lint-iso-"));
  const siblings = opts.siblings || {};
  for (const sibName of Object.keys(siblings)) {
    writeFileSync(join(isoDir, sibName), siblings[sibName], "utf8");
  }
  // Prompts parked waiting for a gate use the -HOLD.md suffix. The linter
  // decides GATE_RELEASED vs FILE_GATE_DEAD / CLUSTER_DEAD_GATE off this suffix,
  // so the test harness must be able to write either.
  const suffix = opts.hold ? "-HOLD.md" : "-ready.md";
  const file = join(isoDir, name + suffix);
  writeFileSync(file, "---\n" + frontMatter + "\n---\n" + BODY, "utf8");

  const env = Object.assign({}, process.env, opts.env || {});
  let code = 0;
  let out = "";
  try {
    out = execFileSync("node", [LINT, file], { cwd: REPO, encoding: "utf8", env });
  } catch (e) {
    code = e.status;
    out = String(e.stdout || "") + String(e.stderr || "");
  }

  const ok = code === expectedExit;
  console.log((ok ? "PASS " : "FAIL ") + name + "  (exit " + code + ", wanted " + expectedExit + ")");
  if (!ok) console.log("      " + out.trim().split("\n").join("\n      "));
  ok ? pass++ : fail++;
  rmSync(isoDir, { recursive: true, force: true });
  return out;
}

console.log("\n=== exit 0 ADMIT: cluster + cluster_order:1, no dep key -> first slice legal");
run("cluster-first-slice",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: my-cluster\ncluster_order: 1", 0);

console.log("\n=== exit 1 REJECT: cluster_order:2 with NO dep key -> CLUSTER_NO_DEP");
run("cluster-order-2-no-dep",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: my-cluster\ncluster_order: 2", 1);

console.log("\n=== exit 0 ADMIT: HOLD cluster_order:2 with unmet dep (git broken -> gate probe skipped, shape legal)");
// Post-ARMED_GATE_STILL_CHECKED: an armed cluster_order:2 with an unmet needle correctly REJECTS
// with GATE_NOT_RELEASED. To keep this test focused on cluster+dep SHAPE legality (SLICE 3), it
// runs on a HOLD (which historically admitted this shape as "parked, waiting for the needle") and
// with a broken git binary so the gate probe warns-and-skips fail-safe.
runIsolated("cluster-order-2-with-dep",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: my-cluster\ncluster_order: 2\n" +
  "requires_on_main: scripts/pipeline/lint-prompt.mjs :: NEEDLE_DEFINITELY_NOT_ON_MAIN_XYZ_1234567890",
  0,
  { hold: true, env: { LINT_GIT_BIN: "this-git-binary-does-not-exist-shape-check-9876543210" } });

console.log("\n=== exit 1 REJECT: cluster_order:0 -> CLUSTER_ORDER_INVALID");
run("cluster-order-zero",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: my-cluster\ncluster_order: 0", 1);

console.log("\n=== exit 1 REJECT: cluster_order:-1 -> CLUSTER_ORDER_INVALID");
run("cluster-order-negative",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: my-cluster\ncluster_order: -1", 1);

console.log("\n=== exit 1 REJECT: cluster_order:two -> CLUSTER_ORDER_INVALID");
run("cluster-order-nonnumeric",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: my-cluster\ncluster_order: two", 1);

console.log("\n=== exit 1 REJECT: cluster slug Bad_Slug (uppercase + underscore) -> CLUSTER_BAD_SLUG");
run("cluster-slug-bad-uppercase",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: Bad_Slug\ncluster_order: 1", 1);

console.log("\n=== exit 1 REJECT: cluster slug 'ab' (too short) -> CLUSTER_BAD_SLUG");
run("cluster-slug-too-short",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: ab\ncluster_order: 1", 1);

console.log("\n=== exit 1 REJECT: cluster slug 42 chars (over 41-char cap) -> CLUSTER_BAD_SLUG");
run("cluster-slug-too-long",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: aaaaaaaaaa-aaaaaaaaaa-aaaaaaaaaa-aaaaaaaaaa1\ncluster_order: 1", 1);

console.log("\n=== exit 1 REJECT: cluster_order present, cluster absent -> CLUSTER_ORDER_NO_CLUSTER");
run("cluster-order-without-cluster",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster_order: 1", 1);

// Cycle: two prompts in the same directory reference each other by file basename
// via requires_file_on_main. buildClusterGraph resolves prereqs by basename
// matching against other prompt files in the same directory.
console.log("\n=== exit 1 REJECT: two-prompt cycle -> CLUSTER_CYCLE names both");
{
  const cycleOtherFm =
    "---\npremise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "cluster: cycle-test\ncluster_order: 2\n" +
    "requires_file_on_main: cycle-b-ready.md\n---\n" + BODY;
  const out = runIsolated("cycle-b",
    "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "cluster: cycle-test\ncluster_order: 2\n" +
    "requires_file_on_main: cycle-a-ready.md",
    1,
    { siblings: { "cycle-a-ready.md": cycleOtherFm } });
  if (!/cycle-[ab]-ready\.md.*cycle-[ab]-ready\.md/.test(out)) {
    console.log("      FAIL cycle path not printed as expected. output was:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++;
    pass--;
  }
}

console.log("\n=== exit 0 ADMIT: malformed sibling in same dir -> warning, good prompt still admitted");
runIsolated("good-with-bad-sibling",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: sibling-test\ncluster_order: 1",
  0,
  { siblings: { "malformed-ready.md": "no front-matter here, just garbage text\n" } });

console.log("\n=== exit 1 REJECT: requires_on_main needle already on origin/main, cluster_order:1 -> CLUSTER_DEAD_GATE");
// UNKNOWN_KEY is on origin/main:scripts/pipeline/lint-prompt.mjs (SLICE 1).
// Only cluster_order:1 (no predecessor) still emits CLUSTER_DEAD_GATE. A cluster_order > 1
// is a chain successor whose satisfied gate means the predecessor landed — that is GATE_RELEASED,
// not a dead gate. See the cluster-order-3-successor-satisfied test below.
runIsolated("cluster-dead-gate",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: dead-gate-test\ncluster_order: 1\n" +
  "requires_on_main: scripts/pipeline/lint-prompt.mjs :: UNKNOWN_KEY", 1);

console.log("\n=== exit 0 ADMIT: git unavailable during dead-gate probe -> warning, admitted");
runIsolated("cluster-dead-gate-git-broken",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: dead-gate-safe\ncluster_order: 1\n" +
  "requires_on_main: scripts/pipeline/lint-prompt.mjs :: UNKNOWN_KEY",
  0,
  { env: { LINT_GIT_BIN: "this-git-binary-does-not-exist-xyz-1234567890" } });

console.log("\n=== exit 0 ADMIT: prompt with NONE of the cluster keys -> unchanged behaviour");
// Regression guard: every existing queue prompt must still pass.
run("cluster-none-present",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none", 0);

// ── Regression: foreign-cwd premise resolution (fix: queue-sync-pin-lint-repo-root) ──────────
// Before the fix, queue-sync never set LINT_REPO_ROOT and lint-prompt.mjs fell back to
// process.cwd(). When queue-sync ran from a foreign cwd (e.g. a worktree or a temp dir),
// repo-relative premise commands resolved against that cwd and 8 of 11 armed prompts flipped
// verdict. This test verifies that a run from an alien cwd (no LINT_REPO_ROOT set) produces the
// same verdict as a run with cwd:REPO -- the auto-detect fallback in lint-prompt.mjs makes it so.
console.log("\n=== exit 0 ADMIT: foreign-cwd, no LINT_REPO_ROOT -> premise auto-resolves from repo (regression guard)");
{
  // Pick a needle that IS present in lint-prompt.mjs so the premise is truthy (work still needed).
  const NEEDLE = "UNKNOWN_KEY";
  const premiseCmd = "grep -q \"" + NEEDLE + "\" scripts/pipeline/lint-prompt.mjs";
  const foreignDir = mkdtempSync(join(tmpdir(), "lint-foreign-"));
  const fixtureFm =
    "premise: '" + premiseCmd + "'\n" +
    "premise_means: " + NEEDLE + " is present in lint-prompt.mjs (work still needed)\n" +
    "scope:\n  - scripts/pipeline/**\n" +
    "done_when: node scripts/pipeline/test-lint-prompt.mjs\n" +
    "size: 2\ngate_allow: none";

  // Run from foreign cwd with NO LINT_REPO_ROOT -- should ADMIT (exit 0) via auto-detect.
  const fileInForeign = join(foreignDir, "foreign-cwd-ready.md");
  writeFileSync(fileInForeign, "---\n" + fixtureFm + "\n---\n" + BODY, "utf8");

  const envWithoutPin = Object.assign({}, process.env);
  delete envWithoutPin.LINT_REPO_ROOT;

  let codeForeign = 0;
  let outForeign = "";
  try {
    outForeign = execFileSync("node", [LINT, fileInForeign],
      { cwd: foreignDir, encoding: "utf8", env: envWithoutPin });
  } catch (ef) {
    codeForeign = ef.status;
    outForeign = String(ef.stdout || "") + String(ef.stderr || "");
  }

  const ok = codeForeign === 0;
  console.log((ok ? "PASS " : "FAIL ") + "foreign-cwd-no-pin  (exit " + codeForeign + ", wanted 0)");
  if (!ok) console.log("      " + outForeign.trim().split("\n").join("\n      "));
  ok ? pass++ : fail++;

  rmSync(foreignDir, { recursive: true, force: true });
}
// ── FILE_GATE_DEAD: requires_file_on_main path already on origin/main ────────
// Same class of hole as CLUSTER_DEAD_GATE, one gate type over. A path that
// can never be absent can never fail, so the slice would dispatch ungated.
// Applies to ALL prompts, not just cluster ones.

console.log("\n=== exit 1 REJECT: requires_file_on_main path already on origin/main -> FILE_GATE_DEAD");
// scripts/pipeline/lint-prompt.mjs has been on origin/main since long before this test file.
runIsolated("file-gate-dead-scalar",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "requires_file_on_main: scripts/pipeline/lint-prompt.mjs", 1);

console.log("\n=== exit 1 REJECT: armed requires_file_on_main path NOT on origin/main -> FILE_GATE_NOT_RELEASED");
// Post-ARMED_GATE_STILL_CHECKED: an armed prompt whose existence gate is unmet REJECTS. Under the
// previous behavior this admitted as a bare ADMIT because checkGateNotReleased was HOLD-only.
runIsolated("file-gate-live",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "requires_file_on_main: apps/api/src/does-not-exist-abcxyz-1234567890.ts", 1);

console.log("\n=== exit 1 REJECT: list form with one dead entry among live ones -> FILE_GATE_DEAD");
runIsolated("file-gate-dead-list",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "requires_file_on_main:\n" +
  "  - apps/api/src/does-not-exist-abcxyz-1234567890.ts\n" +
  "  - scripts/pipeline/lint-prompt.mjs\n" +
  "  - apps/api/src/also-not-there-qqqzzz-0987654321.ts", 1);

console.log("\n=== exit 0 ADMIT: git unavailable during file-gate probe -> warning, admitted (fail-safe)");
// Mirrors the CLUSTER_DEAD_GATE fail-safe test: an unreachable git binary
// must WARN and SKIP, never reject. One broken tool must not bin the queue.
runIsolated("file-gate-dead-git-broken",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "requires_file_on_main: scripts/pipeline/lint-prompt.mjs",
  0,
  { env: { LINT_GIT_BIN: "this-git-binary-does-not-exist-xyz-1234567890" } });

// ── GATE_RELEASED: a HOLD whose gate has landed on origin/main promotes. ─────
// The two dead-gate probes have a two-way verdict: on a -ready.md prompt the
// gate-satisfied state is a REJECT (authoring hole), on a -HOLD.md prompt it
// is an ADMIT + PROMOTE (the parked slice is ready to arm). Cover both cells
// for both gate types; the two non-HOLD cells (released -> REJECT, unmet ->
// ADMIT) are already covered by the tests just above.
//
// The five in-tree HOLDs Marco measured (2026-08-25T22:10Z) were rejected on
// exactly this: 4 x CLUSTER_DEAD_GATE + 1 x FILE_GATE_DEAD. Under the fix
// they must all ADMIT with GATE_RELEASED, and non-HOLD prompts with the same
// front-matter must continue to REJECT.

console.log("\n=== exit 0 ADMIT: HOLD + requires_file_on_main released -> GATE_RELEASED (PROMOTE)");
{
  const out = runIsolated("hold-file-gate-released",
    "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "requires_file_on_main: scripts/pipeline/lint-prompt.mjs",
    0, { hold: true });
  if (!/GATE_RELEASED/.test(out) || !/PROMOTE/.test(out)) {
    console.log("      FAIL expected PROMOTE + GATE_RELEASED in output. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

// Pipeline Guard 3 inverted this expectation. It previously asserted the DEFECT:
// a HOLD whose requires_file_on_main path is ABSENT from origin/main admitted as a
// bare ADMIT, indistinguishable from a satisfied gate. That is precisely what this
// slice removes, so the fixture now expects exit 1 + FILE_GATE_NOT_RELEASED.
console.log("\n=== exit 1 REJECT: HOLD + requires_file_on_main unmet -> FILE_GATE_NOT_RELEASED");
{
  const out = runIsolated("hold-file-gate-unmet",
    "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "requires_file_on_main: apps/api/src/does-not-exist-hold-xyz-9876543210.ts",
    1, { hold: true });
  if (!/FILE_GATE_NOT_RELEASED/.test(out) || /PROMOTE/.test(out)) {
    console.log("      FAIL expected FILE_GATE_NOT_RELEASED and no PROMOTE line. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

console.log("\n=== exit 0 ADMIT: HOLD + requires_on_main :: needle released -> GATE_RELEASED (PROMOTE)");
{
  // GATE_RELEASED is the constant the fix introduces into lint-prompt.mjs, so
  // it is on origin/main only AFTER this PR merges. Use a needle that is
  // present on origin/main today, else the test is a chicken-and-egg problem.
  // UNKNOWN_KEY has been on origin/main since cluster-chaining SLICE 1.
  const out = runIsolated("hold-content-gate-released",
    "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "cluster: hold-released-test\ncluster_order: 2\n" +
    "requires_on_main: scripts/pipeline/lint-prompt.mjs :: UNKNOWN_KEY",
    0, { hold: true });
  if (!/GATE_RELEASED/.test(out) || !/PROMOTE/.test(out)) {
    console.log("      FAIL expected PROMOTE + GATE_RELEASED in output. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

// NOTE: behavior changed by feat/lint-human-gate-blindness (GATE_NOT_RELEASED).
// A HOLD with an unmet requires_on_main :: needle now REJECTs with GATE_NOT_RELEASED
// instead of plain ADMIT. This ensures "bare ADMIT means all declared gates are satisfied."
console.log("\n=== exit 1 REJECT: HOLD + requires_on_main :: needle unmet -> GATE_NOT_RELEASED (not bare ADMIT)");
{
  const out = runIsolated("hold-content-gate-unmet",
    "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "cluster: hold-unmet-test\ncluster_order: 2\n" +
    "requires_on_main: scripts/pipeline/lint-prompt.mjs :: NEEDLE_DEFINITELY_NOT_ON_MAIN_HOLD_XYZ_1234567890",
    1, { hold: true });
  if (!/GATE_NOT_RELEASED/.test(out)) {
    console.log("      FAIL expected GATE_NOT_RELEASED in output. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

// ── ARMED_GATE_STILL_CHECKED ────────────────────────────────────────────────
// The linter used to gate `checkGateNotReleased` behind `isHold`, so the moment
// a prompt was armed (renamed `-HOLD.md` → `-ready.md`) its gate check
// evaporated. The check now runs for every prompt regardless of filename, and
// `checkDeadGate` treats a satisfied gate on a chain successor (cluster_order
// > 1) as GATE_RELEASED rather than CLUSTER_DEAD_GATE. Both directions covered
// here — armed prompts with unmet gates REJECT, armed chain successors with
// satisfied gates ADMIT with GATE_RELEASED.

console.log("\n=== exit 1 REJECT: ARMED requires_file_on_main path absent -> FILE_GATE_NOT_RELEASED (the fix)");
{
  const out = runIsolated("armed-file-gate-unmet",
    "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "requires_file_on_main: apps/api/src/does-not-exist-armed-xyz-1234567890.ts",
    1);
  if (!/FILE_GATE_NOT_RELEASED/.test(out)) {
    console.log("      FAIL expected FILE_GATE_NOT_RELEASED. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

console.log("\n=== exit 1 REJECT: ARMED requires_on_main :: needle absent -> GATE_NOT_RELEASED (the fix)");
{
  const out = runIsolated("armed-content-gate-unmet",
    "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "cluster: armed-unmet-test\ncluster_order: 2\n" +
    "requires_on_main: scripts/pipeline/lint-prompt.mjs :: NEEDLE_DEFINITELY_NOT_ON_MAIN_ARMED_XYZ_1234567890",
    1);
  if (!/GATE_NOT_RELEASED/.test(out)) {
    console.log("      FAIL expected GATE_NOT_RELEASED. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

console.log("\n=== exit 1 REJECT: HOLD version of same body still rejects (regression guard)");
{
  const out = runIsolated("held-file-gate-unmet-symmetry",
    "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "requires_file_on_main: apps/api/src/does-not-exist-symmetry-xyz-1234567890.ts",
    1, { hold: true });
  if (!/FILE_GATE_NOT_RELEASED/.test(out)) {
    console.log("      FAIL expected FILE_GATE_NOT_RELEASED. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

console.log("\n=== exit 1 REJECT: HOLD version of unmet content gate still rejects (regression guard)");
{
  const out = runIsolated("held-content-gate-unmet-symmetry",
    "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "cluster: held-unmet-symmetry\ncluster_order: 2\n" +
    "requires_on_main: scripts/pipeline/lint-prompt.mjs :: NEEDLE_DEFINITELY_NOT_ON_MAIN_SYMMETRY_XYZ_1234567890",
    1, { hold: true });
  if (!/GATE_NOT_RELEASED/.test(out)) {
    console.log("      FAIL expected GATE_NOT_RELEASED. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

console.log("\n=== exit 0 ADMIT: armed prompt with satisfied requires_merged only, no clusters (regression guard)");
// The ARMED_GATE_STILL_CHECKED fix must not regress the plain armed-with-no-content-gate case.
run("armed-no-content-gate-admits",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "requires_merged: 42", 0);

console.log("\n=== exit 1 REJECT: ARMED cluster_order:1 needle already on main -> CLUSTER_DEAD_GATE (decorative-gate case survives)");
{
  const out = runIsolated("armed-cluster-order-1-dead-gate",
    "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "cluster: armed-order-1-dead\ncluster_order: 1\n" +
    "requires_on_main: scripts/pipeline/lint-prompt.mjs :: UNKNOWN_KEY",
    1);
  if (!/CLUSTER_DEAD_GATE/.test(out)) {
    console.log("      FAIL expected CLUSTER_DEAD_GATE. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

console.log("\n=== exit 0 ADMIT: ARMED cluster_order:3 chain successor with satisfied gate -> GATE_RELEASED (the checkDeadGate fix)");
{
  // Real fixture reasoning per the prompt: pr-crm-s3-account-on-client-create shape.
  // A chain successor's satisfied gate means the predecessor SHIPPED — precondition for arming,
  // not a defect. UNKNOWN_KEY is on origin/main:scripts/pipeline/lint-prompt.mjs.
  const out = runIsolated("armed-cluster-order-3-successor-satisfied",
    "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "cluster: armed-order-3-satisfied\ncluster_order: 3\n" +
    "requires_on_main: scripts/pipeline/lint-prompt.mjs :: UNKNOWN_KEY",
    0);
  if (!/GATE_RELEASED/.test(out)) {
    console.log("      FAIL expected GATE_RELEASED. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
  if (/CLUSTER_DEAD_GATE/.test(out)) {
    console.log("      FAIL should not emit CLUSTER_DEAD_GATE. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

console.log("\n=== exit 1 REJECT: ARMED cluster_order:3 requires_file_on_main path present -> FILE_GATE_DEAD (carve-out intact)");
// Step 5 in the fix: `requires_file_on_main` carries no ordering semantics, so a path present at
// author-time is still a dead gate regardless of cluster position.
runIsolated("armed-cluster-order-3-file-gate-dead",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: armed-order-3-file-dead\ncluster_order: 3\n" +
  "requires_on_main: scripts/pipeline/lint-prompt.mjs :: UNKNOWN_KEY\n" +
  "requires_file_on_main: scripts/pipeline/lint-prompt.mjs", 1);

// ── MISSING_STANDING_AUTHORITY (REJECT since 2026-09-03) ──────────────────
// A prompt whose body does not grant push authority now REJECTS (exit 1). It was
// WARN-only from 2026-08-20 because flipping it would have malformed 38 of 75 live
// prompts at once and stalled the queue. Re-measured 2026-09-03 over the whole live
// corpus — 76 top-level HOLDs plus 54 parked, 130 files — it had 2 hits, and neither
// was a prompt that should arm. Net newly-blocked work: zero.
//
// Three directions to cover: absent grant rejects, imposter heading rejects and says
// which class it is, and a body carrying the grant still admits silently.

function runCaptureStderr(fileText, name) {
  const file = join(dir, name + "-ready.md");
  writeFileSync(file, fileText, "utf8");
  const r = spawnSync("node", [LINT, file], { cwd: REPO, encoding: "utf8" });
  return { code: r.status, stdout: String(r.stdout || ""), stderr: String(r.stderr || "") };
}

const SA_FM =
  "---\npremise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n---\n\n";

console.log("\n=== exit 1 REJECT: body without the grant -> MISSING_STANDING_AUTHORITY");
{
  const r = runCaptureStderr(
    SA_FM + "# body\n\nno standing-authority text of any kind here.\n", "no-authority-reject");
  const all = r.stdout + r.stderr;
  const okExit = r.code === 1;
  const okCode = all.includes("MISSING_STANDING_AUTHORITY");
  const okDetail = all.includes("no standing-authority text at all");
  const ok = okExit && okCode && okDetail;
  console.log((ok ? "PASS " : "FAIL ") + "no-authority-reject  (exit " + r.code +
    ", code=" + okCode + ", detail=" + okDetail + ")");
  if (!ok) console.log("      " + all.trim().split("\n").join("\n      "));
  ok ? pass++ : fail++;
}

console.log("\n=== exit 1 REJECT: heading present but grant absent -> names the imposter class");
{
  const r = runCaptureStderr(
    SA_FM + "## STANDING AUTHORITY\n\nDocumentation corrections only. Stop and report rather than widening scope.\n",
    "imposter-heading");
  const all = r.stdout + r.stderr;
  const okExit = r.code === 1;
  const okCode = all.includes("MISSING_STANDING_AUTHORITY");
  const okDetail = all.includes("heading is present");
  const ok = okExit && okCode && okDetail;
  console.log((ok ? "PASS " : "FAIL ") + "imposter-heading  (exit " + r.code +
    ", code=" + okCode + ", detail=" + okDetail + ")");
  if (!ok) console.log("      " + all.trim().split("\n").join("\n      "));
  ok ? pass++ : fail++;
}

console.log("\n=== exit 0 ADMIT: body with the grant -> admits, and says nothing about authority");
{
  const r = runCaptureStderr(
    SA_FM + "## STANDING AUTHORITY\n\n" +
    "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n",
    "with-authority-quiet");
  const all = r.stdout + r.stderr;
  const ok = r.code === 0 && !all.includes("MISSING_STANDING_AUTHORITY");
  console.log((ok ? "PASS " : "FAIL ") + "with-authority-quiet  (exit " + r.code + ")");
  if (!ok) console.log("      " + all.trim().split("\n").join("\n      "));
  ok ? pass++ : fail++;
}

// ── ORPHANED_DISCHARGE guard ────────────────────────────────────────────────
// A prompt going STALE is normally binned quietly. But if BACKLOG.yaml has
// discharged a backlog item into this prompt — the register's only pointer to
// the work is this file — binning it destroys the last record. On 2026-07-23
// twelve B-P0a/B-P0b slices were lost this way (found by hand 2026-08-20).
// The guard escalates STALE → REJECT (exit 1) on that single case; all other
// STALE paths must remain exit 3, because 34 historical agent runs were saved
// by the quiet-bin path and it must not regress.
//
// Helper points the linter at a synthetic BACKLOG.yaml via LINT_BACKLOG_PATH,
// so we do not need to fake a whole repo root.
function runWithBacklog(name, frontMatter, backlogText, expectedExit) {
  const isoDir = mkdtempSync(join(tmpdir(), "lint-orph-"));
  const backlogPath = join(isoDir, "BACKLOG.yaml");
  writeFileSync(backlogPath, backlogText, "utf8");
  const file = join(isoDir, name + "-ready.md");
  writeFileSync(file, "---\n" + frontMatter + "\n---\n" + BODY, "utf8");
  const env = Object.assign({}, process.env, { LINT_BACKLOG_PATH: backlogPath });
  let code = 0;
  let out = "";
  try {
    out = execFileSync("node", [LINT, file], { cwd: REPO, encoding: "utf8", env });
  } catch (e) {
    code = e.status;
    out = String(e.stdout || "") + String(e.stderr || "");
  }
  const ok = code === expectedExit;
  console.log((ok ? "PASS " : "FAIL ") + name + "  (exit " + code + ", wanted " + expectedExit + ")");
  if (!ok) console.log("      " + out.trim().split("\n").join("\n      "));
  ok ? pass++ : fail++;
  rmSync(isoDir, { recursive: true, force: true });
  return out;
}

console.log("\n=== exit 1 REJECT: stale prompt whose basename appears in a BACKLOG.yaml discharge line -> ORPHANED_DISCHARGE");
{
  const out = runWithBacklog("pr-orphan-example",
    "premise: 'false'\npremise_means: forces stale (premise always false)\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none",
    "items:\n  # DISCHARGED 2026-07-23 (04-scanner): STAGED as pr-orphan-example-ready.md\n",
    1);
  if (!/ORPHANED_DISCHARGE/.test(out)) {
    console.log("      FAIL code ORPHANED_DISCHARGE not in output:\n      " + out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

console.log("\n=== exit 3 STALE: ordinary stale, basename appears nowhere in BACKLOG.yaml (34 historical runs saved)");
runWithBacklog("pr-ordinary-stale",
  "premise: 'false'\npremise_means: forces stale\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none",
  "items:\n  # nothing named here mentions the linted prompt\n",
  3);

console.log("\n=== exit 0 ADMIT: live prompt named in a discharge line -> guard only fires on the stale path");
runWithBacklog("pr-live-and-discharged",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none",
  "items:\n  # DISCHARGED 2026-07-23 (04-scanner): STAGED as pr-live-and-discharged-ready.md\n",
  0);

console.log("\n=== exit 3 STALE: substring safety - pr-foo-HOLD-ready.md must not match pr-foo-extended-HOLD-ready.md");
runWithBacklog("pr-foo-HOLD",
  "premise: 'false'\npremise_means: forces stale\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none",
  "items:\n  # DISCHARGED 2026-07-23 (04-scanner): STAGED as pr-foo-extended-HOLD-ready.md\n",
  3);

// ── YAML block scalar folding (foldBlockScalar) ────────────────────────────
// parseFrontMatter used to return the raw indicator string (">-", "|", etc.)
// instead of the folded body.  That made the LL-29 rollback gate rubber-stamp
// ">-" as non-empty, the destructive-pattern corpus receive ">-" instead of
// the acceptance command, and STALE verdict render "Premise no longer holds: ">-"".
// foldBlockScalar() is the fix; the tests below are its acceptance harness.
// At least one test must contain the literal string "block scalar" so the
// done_when gate in the prompt that ships this fix can self-verify.
// [block scalar folding tests follow]

console.log("\n=== block scalar: exit 0 ADMIT: folded >- rollback_strategy on migration prompt is read as real text");
// Before the fix, fm.rollback_strategy === ">-" (non-empty string) so the LL-29
// gate passed. After the fix it returns the real body, still non-empty, so it
// still admits — but now for the right reason.
run("block-scalar-rollback-folded",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/api/prisma/migrations/**\n" +
  "  - apps/api/test/backfill.spec.ts\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: migrations\n" +
  "rollback_strategy: >-\n" +
  "  additive; safe to leave, re-run drops nothing;\n" +
  "  revert migration X if needed", 0);

console.log("\n=== block scalar: exit 1 REJECT: empty folded >- rollback_strategy is caught by LL-29 gate");
// Before the fix, ">-" was a non-empty string and the gate passed silently.
// After the fix, the body lines are blank/absent, foldBlockScalar returns "",
// out[key] becomes [], and the LL-29 empty check correctly rejects.
run("block-scalar-rollback-empty",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/api/prisma/migrations/**\n" +
  "  - apps/api/test/backfill.spec.ts\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: migrations\n" +
  "rollback_strategy: >-\n", 1);

console.log("\n=== block scalar: exit 1 REJECT: folded done_when with DROP TABLE reaches destructive-pattern corpus");
// Before the fix the corpus received ">-" which does not match DROP TABLE.
// After the fix the real body text reaches the corpus and DESTRUCTIVE_MUST_ESCALATE fires.
run("block-scalar-done-when-drop-table",
  "premise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: >-\n" +
  "  pnpm build && DROP TABLE legacy_rates\nsize: 3\ngate_allow: none\nescalates: false", 1);

console.log("\n=== block scalar: exit 0 ADMIT: literal | block preserves newlines, rollback_strategy is non-empty");
// The "|" style must preserve newlines (literal block scalar).
// We verify this admits (non-empty value reaches LL-29 gate correctly).
run("block-scalar-literal-pipe",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/api/prisma/migrations/**\n" +
  "  - apps/api/test/migration.spec.ts\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: migrations\n" +
  "rollback_strategy: |\n" +
  "  Step 1: revert the migration\n" +
  "  Step 2: re-deploy the previous release", 0);

// ── NOT_A_PROMPT: breadcrumb files (00-*.md) get their own verdict ──────────
// A station breadcrumb is not a prompt missing its front matter; it is a
// different kind of document with its own validator, check-breadcrumb.mjs.
// Answering NO_FRONT_MATTER on a breadcrumb told the reader a lie and let a
// false lint-pass be reported on the strength of the wrong instrument.
// Contract: single-file mode REJECTs (exit 1) so arm-prompt.ps1 keeps refusing;
// --all sweep tallies the breadcrumbs separately and does NOT let them mask a
// genuine REJECT nor manufacture one when no real prompt is broken.

// Small helper: write a raw file (no auto front-matter wrap) then run linter.
function runRaw(name, rawContent, expectedExit, opts) {
  opts = opts || {};
  const file = join(dir, name);
  writeFileSync(file, rawContent, "utf8");
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
  return out;
}

console.log("\n=== exit 1 REJECT: single breadcrumb (00-*.md) -> NOT_A_PROMPT (not NO_FRONT_MATTER)");
{
  const out = runRaw("00-04-scanner-2026-08-31-example.md",
    "# 04-scanner breadcrumb\n\nno front matter, five sections instead.\n", 1);
  if (!/NOT_A_PROMPT/.test(out)) {
    console.log("      FAIL expected NOT_A_PROMPT in output. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
  if (/NO_FRONT_MATTER/.test(out)) {
    console.log("      FAIL must NOT emit NO_FRONT_MATTER on a breadcrumb. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
  if (!/check-breadcrumb\.mjs/.test(out)) {
    console.log("      FAIL message must name check-breadcrumb.mjs as the correct validator. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

console.log("\n=== exit 1 REJECT: DISARMED pr-* file with no front matter -> still NO_FRONT_MATTER (path-class scope)");
// The one non-breadcrumb file in the queue lacking front matter is
// pr-settings-home-slice0-DISARMED-premise-dead-2026-08-18.md. It must keep
// answering NO_FRONT_MATTER — the new NOT_A_PROMPT branch must not widen.
{
  const out = runRaw("pr-settings-home-slice0-DISARMED-premise-dead-2026-08-18.md",
    "# disarmed\n\nno front matter here either.\n", 1);
  if (!/NO_FRONT_MATTER/.test(out)) {
    console.log("      FAIL expected NO_FRONT_MATTER on DISARMED pr-* file. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
  if (/NOT_A_PROMPT/.test(out)) {
    console.log("      FAIL must NOT widen NOT_A_PROMPT beyond 00-*.md. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

// Helper: run --all against a sweep dir with a bag of pre-written files.
// Returns { code, out } so callers can assert on both.
function runAllSweep(name, files, expectedExit) {
  const isoDir = mkdtempSync(join(tmpdir(), "lint-sweep-"));
  for (const fname of Object.keys(files)) {
    writeFileSync(join(isoDir, fname), files[fname], "utf8");
  }
  let code = 0;
  let out = "";
  try {
    out = execFileSync("node", [LINT, "--all", isoDir], { cwd: REPO, encoding: "utf8" });
  } catch (e) {
    code = e.status;
    out = String(e.stdout || "") + String(e.stderr || "");
  }
  const ok = code === expectedExit;
  console.log((ok ? "PASS " : "FAIL ") + name + "  (exit " + code + ", wanted " + expectedExit + ")");
  if (!ok) console.log("      " + out.trim().split("\n").join("\n      "));
  ok ? pass++ : fail++;
  rmSync(isoDir, { recursive: true, force: true });
  return out;
}

console.log("\n=== exit 0 ADMIT: --all sweep of clean prompts + breadcrumbs -> breadcrumbs tallied separately, real prompts still admit");
{
  const cleanFm =
    "---\npremise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n---\n" + BODY;
  const crumb = "# breadcrumb\n\nno front matter, five sections.\n";
  const out = runAllSweep("sweep-clean-plus-breadcrumbs", {
    "pr-a-ready.md": cleanFm,
    "pr-b-ready.md": cleanFm,
    "00-04-scanner-2026-08-31-a.md": crumb,
    "00-00-supervisor-2026-08-31-b.md": crumb,
  }, 0);
  if (!/NOT_A_PROMPT/.test(out)) {
    console.log("      FAIL expected NOT_A_PROMPT lines in sweep output. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
  if (!/not-a-prompt\s+.*2/.test(out)) {
    console.log("      FAIL expected 'not-a-prompt 2' in tally. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
  // Breadcrumbs must NOT be counted in rejected — the tally line must show rejected 0.
  if (!/rejected\s+.*0/.test(out)) {
    console.log("      FAIL breadcrumbs must not inflate rejected count. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

console.log("\n=== exit 1 REJECT: --all sweep with one genuinely broken pr-* alongside breadcrumbs -> breadcrumbs cannot mask the real failure");
{
  const cleanFm =
    "---\npremise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n---\n" + BODY;
  // Broken: size exceeds MAX_SIZE — deterministic REJECT with no dependency on git.
  const brokenFm =
    "---\npremise: 'true'\npremise_means: always\nscope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\nsize: 48\ngate_allow: none\n---\n" + BODY;
  const crumb = "# breadcrumb\n";
  const out = runAllSweep("sweep-broken-plus-breadcrumbs", {
    "pr-good-ready.md": cleanFm,
    "pr-oversize-ready.md": brokenFm,
    "00-04-scanner-2026-08-31-c.md": crumb,
    "00-00-supervisor-2026-08-31-d.md": crumb,
  }, 1);
  if (!/NOT_A_PROMPT/.test(out)) {
    console.log("      FAIL breadcrumbs still expected as NOT_A_PROMPT lines. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
  if (!/SIZE_TOO_LARGE/.test(out)) {
    console.log("      FAIL real REJECT must still surface. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

console.log("\n=== exit 0 ADMIT: --all sweep of only breadcrumbs -> tallied, does NOT manufacture exit 1");
// The alternative "skip breadcrumbs to exit 0" shape was rejected because it
// makes safety depend on arm-prompt.ps1 and lint-prompt.mjs staying in agreement
// across two languages. This test guards the sweep-mode invariant: in --all,
// breadcrumbs alone do not drive exit 1 (only rejected does).
{
  const crumb = "# breadcrumb\n";
  const out = runAllSweep("sweep-breadcrumbs-only", {
    "00-04-scanner-2026-08-31-e.md": crumb,
    "00-00-supervisor-2026-08-31-f.md": crumb,
  }, 0);
  if (!/not-a-prompt\s+.*2/.test(out)) {
    console.log("      FAIL expected 'not-a-prompt 2' in tally. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

// Regression guard: a single stale prompt still exits 3. Existing test at the
// top of this file already covers this; re-asserted here to prove the exit-line
// mode-dependency did not regress under the new (rejected || (notPrompt &&
// single-file)) shape.
console.log("\n=== exit 3 STALE: single stale prompt regression guard (mode-dependency intact)");
run("stale-mode-regression",
  "premise: 'false'\npremise_means: forces stale\nscope:\n  - scripts/pipeline/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none", 3);

rmSync(dir, { recursive: true, force: true });
console.log("\n=== " + pass + " passed, " + fail + " failed");
process.exit(fail > 0 ? 1 : 0);
