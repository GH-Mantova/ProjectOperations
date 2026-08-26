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
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires-merged: 42", 1);

console.log("\n=== exit 1 REJECT: requires_files_on_main (plural) → UNKNOWN_KEY, suggests singular");
run("dep-plural-files-on-main",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires_files_on_main: apps/foo.ts", 1);

console.log("\n=== exit 1 REJECT: requires_merged: 0 → REQUIRES_MERGED_INVALID");
run("dep-merged-zero",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires_merged: 0", 1);

console.log("\n=== exit 1 REJECT: requires_merged: -1 → REQUIRES_MERGED_INVALID");
run("dep-merged-negative",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires_merged: -1", 1);

console.log("\n=== exit 1 REJECT: requires_merged: abc → REQUIRES_MERGED_INVALID");
run("dep-merged-abc",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires_merged: abc", 1);

console.log("\n=== exit 1 REJECT: requires_merged: (empty) → REQUIRES_MERGED_INVALID");
run("dep-merged-empty",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires_merged:", 1);

console.log("\n=== exit 1 REJECT: requires_file_on_main: (empty) → REQUIRES_PATH_EMPTY");
run("dep-file-on-main-empty",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires_file_on_main:", 1);

console.log("\n=== exit 1 REJECT: requires_on_main: (empty) → REQUIRES_PATH_EMPTY");
run("dep-on-main-empty",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\nrequires_on_main:", 1);

console.log("\n=== exit 0 ADMIT: all three keys well-formed (inline scalar form)");
run("dep-all-keys-well-formed",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "requires_merged: 42\n" +
  "requires_file_on_main: apps/api/src/foo.ts\n" +
  "requires_on_main: apps/api/src/bar.ts", 0);

console.log("\n=== exit 0 ADMIT: requires_on_main path-only → admitted (honoured by watcher since SLICE 2)");
run("dep-on-main-path-only",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "requires_on_main: apps/foo.ts", 0);

console.log("\n=== exit 0 ADMIT: requires_on_main path :: fixed-string → admitted (honoured by watcher since SLICE 2)");
run("dep-on-main-path-and-string",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "requires_on_main: apps/foo.ts :: some fixed string", 0);

console.log("\n=== exit 0 ADMIT: prompt with NONE of the dep keys → unchanged behaviour (MOST important)");
run("dep-none-present",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
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
  writeFileSync(file, "---\n" + frontMatter + "\n---\n\n# body\n", "utf8");

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
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: my-cluster\ncluster_order: 1", 0);

console.log("\n=== exit 1 REJECT: cluster_order:2 with NO dep key -> CLUSTER_NO_DEP");
run("cluster-order-2-no-dep",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: my-cluster\ncluster_order: 2", 1);

console.log("\n=== exit 0 ADMIT: cluster_order:2 with requires_on_main (non-dead) -> legal");
runIsolated("cluster-order-2-with-dep",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: my-cluster\ncluster_order: 2\n" +
  "requires_on_main: scripts/pipeline/lint-prompt.mjs :: NEEDLE_DEFINITELY_NOT_ON_MAIN_XYZ_1234567890", 0);

console.log("\n=== exit 1 REJECT: cluster_order:0 -> CLUSTER_ORDER_INVALID");
run("cluster-order-zero",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: my-cluster\ncluster_order: 0", 1);

console.log("\n=== exit 1 REJECT: cluster_order:-1 -> CLUSTER_ORDER_INVALID");
run("cluster-order-negative",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: my-cluster\ncluster_order: -1", 1);

console.log("\n=== exit 1 REJECT: cluster_order:two -> CLUSTER_ORDER_INVALID");
run("cluster-order-nonnumeric",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: my-cluster\ncluster_order: two", 1);

console.log("\n=== exit 1 REJECT: cluster slug Bad_Slug (uppercase + underscore) -> CLUSTER_BAD_SLUG");
run("cluster-slug-bad-uppercase",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: Bad_Slug\ncluster_order: 1", 1);

console.log("\n=== exit 1 REJECT: cluster slug 'ab' (too short) -> CLUSTER_BAD_SLUG");
run("cluster-slug-too-short",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: ab\ncluster_order: 1", 1);

console.log("\n=== exit 1 REJECT: cluster slug 42 chars (over 41-char cap) -> CLUSTER_BAD_SLUG");
run("cluster-slug-too-long",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: aaaaaaaaaa-aaaaaaaaaa-aaaaaaaaaa-aaaaaaaaaa1\ncluster_order: 1", 1);

console.log("\n=== exit 1 REJECT: cluster_order present, cluster absent -> CLUSTER_ORDER_NO_CLUSTER");
run("cluster-order-without-cluster",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster_order: 1", 1);

// Cycle: two prompts in the same directory reference each other by file basename
// via requires_file_on_main. buildClusterGraph resolves prereqs by basename
// matching against other prompt files in the same directory.
console.log("\n=== exit 1 REJECT: two-prompt cycle -> CLUSTER_CYCLE names both");
{
  const cycleOtherFm =
    "---\npremise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "cluster: cycle-test\ncluster_order: 2\n" +
    "requires_file_on_main: cycle-b-ready.md\n---\n# body\n";
  const out = runIsolated("cycle-b",
    "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
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
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: sibling-test\ncluster_order: 1",
  0,
  { siblings: { "malformed-ready.md": "no front-matter here, just garbage text\n" } });

console.log("\n=== exit 1 REJECT: requires_on_main needle already on origin/main -> CLUSTER_DEAD_GATE");
// UNKNOWN_KEY is on origin/main:scripts/pipeline/lint-prompt.mjs (SLICE 1).
runIsolated("cluster-dead-gate",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: dead-gate-test\ncluster_order: 2\n" +
  "requires_on_main: scripts/pipeline/lint-prompt.mjs :: UNKNOWN_KEY", 1);

console.log("\n=== exit 0 ADMIT: git unavailable during dead-gate probe -> warning, admitted");
runIsolated("cluster-dead-gate-git-broken",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "cluster: dead-gate-safe\ncluster_order: 2\n" +
  "requires_on_main: scripts/pipeline/lint-prompt.mjs :: UNKNOWN_KEY",
  0,
  { env: { LINT_GIT_BIN: "this-git-binary-does-not-exist-xyz-1234567890" } });

console.log("\n=== exit 0 ADMIT: prompt with NONE of the cluster keys -> unchanged behaviour");
// Regression guard: every existing queue prompt must still pass.
run("cluster-none-present",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
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
  writeFileSync(fileInForeign, "---\n" + fixtureFm + "\n---\n\n# body\n", "utf8");

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
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "requires_file_on_main: scripts/pipeline/lint-prompt.mjs", 1);

console.log("\n=== exit 0 ADMIT: requires_file_on_main path NOT on origin/main -> gate legitimately unmet");
runIsolated("file-gate-live",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "requires_file_on_main: apps/api/src/does-not-exist-abcxyz-1234567890.ts", 0);

console.log("\n=== exit 1 REJECT: list form with one dead entry among live ones -> FILE_GATE_DEAD");
runIsolated("file-gate-dead-list",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
  "requires_file_on_main:\n" +
  "  - apps/api/src/does-not-exist-abcxyz-1234567890.ts\n" +
  "  - scripts/pipeline/lint-prompt.mjs\n" +
  "  - apps/api/src/also-not-there-qqqzzz-0987654321.ts", 1);

console.log("\n=== exit 0 ADMIT: git unavailable during file-gate probe -> warning, admitted (fail-safe)");
// Mirrors the CLUSTER_DEAD_GATE fail-safe test: an unreachable git binary
// must WARN and SKIP, never reject. One broken tool must not bin the queue.
runIsolated("file-gate-dead-git-broken",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
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
    "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "requires_file_on_main: scripts/pipeline/lint-prompt.mjs",
    0, { hold: true });
  if (!/GATE_RELEASED/.test(out) || !/PROMOTE/.test(out)) {
    console.log("      FAIL expected PROMOTE + GATE_RELEASED in output. got:\n      " +
      out.trim().split("\n").join("\n      "));
    fail++; pass--;
  }
}

console.log("\n=== exit 0 ADMIT: HOLD + requires_file_on_main unmet -> plain ADMIT (no PROMOTE)");
{
  const out = runIsolated("hold-file-gate-unmet",
    "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n" +
    "requires_file_on_main: apps/api/src/does-not-exist-hold-xyz-9876543210.ts",
    0, { hold: true });
  if (/GATE_RELEASED/.test(out) || /PROMOTE/.test(out)) {
    console.log("      FAIL expected plain ADMIT with no PROMOTE line. got:\n      " +
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
    "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
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
    "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
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

// ── MISSING_STANDING_AUTHORITY (WARN-ONLY) ──────────────────────────────────
// A prompt whose body does not grant push authority still lints ADMIT (exit 0),
// but a diagnostic line goes to stderr. The rule is WARN-only on purpose:
// flipping to REJECT would MALFORM 38 of 75 live prompts at once and stall the
// queue. Two directions to cover: warns when the grant is absent, silent when
// the grant is present. `spawnSync` because the existing `run()` helper only
// captures stderr on non-zero exit, and this check must not change exit code.

function runCaptureStderr(fileText, name) {
  const file = join(dir, name + "-ready.md");
  writeFileSync(file, fileText, "utf8");
  const r = spawnSync("node", [LINT, file], { cwd: REPO, encoding: "utf8" });
  return { code: r.status, stdout: String(r.stdout || ""), stderr: String(r.stderr || "") };
}

console.log("\n=== WARN: body without the grant -> exit 0 (warn-only) AND stderr contains MISSING_STANDING_AUTHORITY");
{
  const fm =
    "---\npremise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n---\n\n" +
    "# body\n\nno standing-authority text of any kind here.\n";
  const r = runCaptureStderr(fm, "no-authority-warn");
  const okExit = r.code === 0;
  const okWarn = r.stderr.includes("MISSING_STANDING_AUTHORITY");
  const okDetail = r.stderr.includes("(no standing-authority text)");
  const ok = okExit && okWarn && okDetail;
  console.log((ok ? "PASS " : "FAIL ") + "no-authority-warn  (exit " + r.code +
    ", warned=" + okWarn + ", detail=" + okDetail + ")");
  if (!ok) console.log("      stderr: " + r.stderr.trim().split("\n").join("\n      "));
  ok ? pass++ : fail++;
}

console.log("\n=== WARN: heading present but grant absent -> stderr distinguishes the imposter class");
{
  const fm =
    "---\npremise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n---\n\n" +
    "## STANDING AUTHORITY\n\nDocumentation corrections only. Stop and report rather than widening scope.\n";
  const r = runCaptureStderr(fm, "imposter-heading");
  const okExit = r.code === 0;
  const okWarn = r.stderr.includes("MISSING_STANDING_AUTHORITY");
  const okDetail = r.stderr.includes("(heading present, grant absent)");
  const ok = okExit && okWarn && okDetail;
  console.log((ok ? "PASS " : "FAIL ") + "imposter-heading  (exit " + r.code +
    ", warned=" + okWarn + ", detail=" + okDetail + ")");
  if (!ok) console.log("      stderr: " + r.stderr.trim().split("\n").join("\n      "));
  ok ? pass++ : fail++;
}

console.log("\n=== quiet: body with the grant -> exit 0 AND stderr must not contain MISSING_STANDING_AUTHORITY");
{
  const fm =
    "---\npremise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
    "done_when: pnpm build\nsize: 3\ngate_allow: none\n---\n\n" +
    "## STANDING AUTHORITY\n\n" +
    "> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**\n";
  const r = runCaptureStderr(fm, "with-authority-quiet");
  const okExit = r.code === 0;
  const okQuiet = !r.stderr.includes("MISSING_STANDING_AUTHORITY");
  const ok = okExit && okQuiet;
  console.log((ok ? "PASS " : "FAIL ") + "with-authority-quiet  (exit " + r.code +
    ", quiet=" + okQuiet + ")");
  if (!ok) console.log("      stderr: " + r.stderr.trim().split("\n").join("\n      "));
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
  writeFileSync(file, "---\n" + frontMatter + "\n---\n\n# body\n", "utf8");
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
    "premise: 'false'\npremise_means: forces stale (premise always false)\nscope:\n  - apps/web/src/**\n" +
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
  "premise: 'false'\npremise_means: forces stale\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none",
  "items:\n  # nothing named here mentions the linted prompt\n",
  3);

console.log("\n=== exit 0 ADMIT: live prompt named in a discharge line -> guard only fires on the stale path");
runWithBacklog("pr-live-and-discharged",
  "premise: 'true'\npremise_means: always\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none",
  "items:\n  # DISCHARGED 2026-07-23 (04-scanner): STAGED as pr-live-and-discharged-ready.md\n",
  0);

console.log("\n=== exit 3 STALE: substring safety - pr-foo-HOLD-ready.md must not match pr-foo-extended-HOLD-ready.md");
runWithBacklog("pr-foo-HOLD",
  "premise: 'false'\npremise_means: forces stale\nscope:\n  - apps/web/src/**\n" +
  "done_when: pnpm build\nsize: 3\ngate_allow: none",
  "items:\n  # DISCHARGED 2026-07-23 (04-scanner): STAGED as pr-foo-extended-HOLD-ready.md\n",
  3);

rmSync(dir, { recursive: true, force: true });
console.log("\n=== " + pass + " passed, " + fail + " failed");
process.exit(fail > 0 ? 1 : 0);
