/**
 * SEED_GRANT_UNDELIVERABLE — the regression guard for a prompt that can never produce a
 * green PR under CP-23.
 *
 * BACKGROUND. The CP-23 diff-check gate (scripts/pr-gates/pr-gates.mjs) fails any PR that
 * touches apps/api/prisma/seed* without ALSO adding a folder under apps/api/prisma/migrations/
 * — unless the PR body carries a column-0 `SEED-ONLY: dev` line declaring the data dev-only.
 * A prompt that scopes the seed, forbids a migration in its body, does not declare
 * `gate_allow: migrations`, and never emits `SEED-ONLY: dev` is therefore unsatisfiable:
 * every build it produces fails CP-23.
 *
 * MEASURED 2026-10-02 at origin/main c145476c: PR #1823 (2026-09-09) burned a full
 * arm/build/review cycle on exactly this shape. A report-only probe of this exact rule
 * over the 36 depth-1 HOLDs then fired on 1 (the real defect) with 0 false positives.
 * Source: needs-marco/prompt-declared-seed-only-false-while-forbidding-a-migration-2026-09-09.md.
 *
 * MARCO'S RULING (2026-10-02): REJECT the contradiction only. A prompt that scopes the
 * seed AND permits/includes a migration must still ADMIT. Warn-only was explicitly ruled
 * out. All four conditions must hold to fire — the forbid wording alone, with no seed in
 * scope, is not this code.
 *
 * Runs with: node --test scripts/pipeline/__tests__/lint-prompt.seed-grant-undeliverable.test.mjs
 * ci.yml runs: node --test "scripts/pipeline/__tests__/*.mjs" on Ubuntu.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const LINT = join(HERE, "..", "lint-prompt.mjs");

function runLint(fileText, opts) {
  opts = opts || {};
  const isoDir = mkdtempSync(join(tmpdir(), "lint-sgu-"));
  const file = join(isoDir, (opts.name || "pr-test-seed-grant") + (opts.hold ? "-HOLD.md" : "-ready.md"));
  writeFileSync(file, fileText, "utf8");
  const res = spawnSync("node", [LINT, file], { cwd: REPO_ROOT, encoding: "utf8" });
  rmSync(isoDir, { recursive: true, force: true });
  return {
    code: res.status != null ? res.status : 1,
    out: String(res.stdout || "") + String(res.stderr || ""),
  };
}

/**
 * Build a prompt string from parts. `scope` is an array of paths. `gateAllow` goes into
 * front-matter verbatim. `body` is appended after the front-matter block. The STANDING
 * AUTHORITY grant and a satisfiable `premise: 'true'` are included so the prompt reaches
 * the SEED_GRANT_UNDELIVERABLE check (which runs after HUMAN_GATE / UNKNOWN_KEY / SIZE
 * / GATE_ALLOW_MISMATCH but before premise execution — so the premise command is immaterial
 * to this test's assertions beyond the REQUIRED-field check).
 */
function prompt({ scope, gateAllow = "none", body = "" } = {}) {
  const scopeLines = scope.map((s) => "  - " + s + "\n").join("");
  return (
    "---\n" +
    "premise: 'true'\n" +
    "premise_means: always-true sentinel for tests\n" +
    "scope:\n" + scopeLines +
    "done_when: pnpm build\n" +
    "size: 3\n" +
    "gate_allow: " + gateAllow + "\n" +
    "backfill: false\n" +
    "rollback_strategy: revert the one file\n" +
    "---\n\n" +
    "# Test prompt\n\n" +
    body + "\n\n" +
    "## STANDING AUTHORITY\n\n" +
    "> You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.\n"
  );
}

describe("SEED_GRANT_UNDELIVERABLE", () => {
  test("seed in scope + 'Do NOT add a migration' + no gate_allow:migrations → REJECT", () => {
    const r = runLint(prompt({
      scope: ["apps/api/prisma/seed-initial-services.ts"],
      gateAllow: "none",
      body: "Add two rows to the seed. Do NOT add a migration — the data is harmless.",
    }), { name: "pr-seed-forbids-migration" });
    assert.equal(r.code, 1, "expected exit 1, got " + r.code + "\n" + r.out);
    assert.ok(r.out.includes("SEED_GRANT_UNDELIVERABLE"),
      "expected SEED_GRANT_UNDELIVERABLE in output:\n" + r.out);
    assert.match(r.out, /CP-23/,
      "message should mention CP-23 — got:\n" + r.out);
  });

  test("every forbid phrasing fires the code", () => {
    const phrasings = [
      "Do NOT add a migration here.",
      "No migration is needed for this change.",
      "No migration required — the seed is dev-only in spirit.",
      "No migration is required.",
      "Add the row without a migration.",
    ];
    for (const body of phrasings) {
      const r = runLint(prompt({
        scope: ["apps/api/prisma/seed-initial-services.ts"],
        gateAllow: "none",
        body,
      }), { name: "pr-seed-phrasing" });
      assert.equal(r.code, 1,
        "phrase " + JSON.stringify(body) + " should REJECT, got exit " + r.code + "\n" + r.out);
      assert.ok(r.out.includes("SEED_GRANT_UNDELIVERABLE"),
        "phrase " + JSON.stringify(body) + " should fire SEED_GRANT_UNDELIVERABLE:\n" + r.out);
    }
  });

  test("same shape + gate_allow:migrations + migrations path in scope → not this code", () => {
    const r = runLint(prompt({
      scope: [
        "apps/api/prisma/seed-initial-services.ts",
        "apps/api/prisma/migrations/20261003_sgu_test/migration.sql",
      ],
      gateAllow: "migrations",
      body: "Add the seed row AND the delivering migration. Do NOT add a migration without the seed.",
    }), { name: "pr-seed-with-migration" });
    assert.ok(!r.out.includes("SEED_GRANT_UNDELIVERABLE"),
      "a prompt that permits the migration must not fire SEED_GRANT_UNDELIVERABLE:\n" + r.out);
  });

  test("same shape but body carries `SEED-ONLY: dev` → not this code", () => {
    const r = runLint(prompt({
      scope: ["apps/api/prisma/seed-initial-services.ts"],
      gateAllow: "none",
      body:
        "Add the dev-only seed row. Do NOT add a migration — prod does not need it.\n\n" +
        "SEED-ONLY: dev  -- dev-only fixture; prod has no equivalent concept yet.\n",
    }), { name: "pr-seed-only-dev" });
    assert.ok(!r.out.includes("SEED_GRANT_UNDELIVERABLE"),
      "a `SEED-ONLY: dev` body must clear the rule:\n" + r.out);
  });

  test("seed in scope, no forbid-migration wording → not this code", () => {
    const r = runLint(prompt({
      scope: ["apps/api/prisma/seed-initial-services.ts"],
      gateAllow: "none",
      body: "Add two more seed rows for the test fixture.",
    }), { name: "pr-seed-quiet" });
    assert.ok(!r.out.includes("SEED_GRANT_UNDELIVERABLE"),
      "a seed prompt that does not forbid a migration must not fire this code:\n" + r.out);
  });

  test("NEGATIVE CONTROL: forbid-migration wording with no seed path → not this code", () => {
    // A prompt that discusses migrations elsewhere must not be caught just for mentioning
    // 'do not add a migration'. The anchor is the SEED path, not the prose.
    const r = runLint(prompt({
      scope: ["scripts/pipeline/lint-prompt.mjs"],
      gateAllow: "none",
      body:
        "Document the rule: a seed-only prompt that says 'do not add a migration' and lacks\n" +
        "`gate_allow: migrations` is unsatisfiable under CP-23.",
    }), { name: "pr-docs-about-rule" });
    assert.ok(!r.out.includes("SEED_GRANT_UNDELIVERABLE"),
      "a non-seed prompt must not fire SEED_GRANT_UNDELIVERABLE even when it quotes the rule:\n" + r.out);
  });

  test("gate_allow:migrations alone (no migrations path) is caught by GATE_ALLOW_MISMATCH, not this code", () => {
    // Precedence check: the pre-existing GATE_ALLOW_MISMATCH guard fires first when
    // gate_allow declares migrations but scope has no migrations/ path. That is a
    // separate contradiction and must not be mis-attributed to this new code.
    const r = runLint(prompt({
      scope: ["apps/api/prisma/seed-initial-services.ts"],
      gateAllow: "migrations",
      body: "Add two seed rows. Do NOT add a migration — this is just an example.",
    }), { name: "pr-seed-mismatched-gate" });
    assert.equal(r.code, 1, "expected exit 1, got " + r.code + "\n" + r.out);
    assert.ok(r.out.includes("GATE_ALLOW_MISMATCH"),
      "expected GATE_ALLOW_MISMATCH to fire first:\n" + r.out);
    assert.ok(!r.out.includes("SEED_GRANT_UNDELIVERABLE"),
      "SEED_GRANT_UNDELIVERABLE must not fire when gate_allow already declares migrations:\n" + r.out);
  });
});
