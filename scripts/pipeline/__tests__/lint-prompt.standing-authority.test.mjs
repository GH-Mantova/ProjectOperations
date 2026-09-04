/**
 * Tests for MISSING_STANDING_AUTHORITY as a hard REJECT.
 *
 * Runs with: node --test scripts/pipeline/__tests__/lint-prompt.standing-authority.test.mjs
 * ci.yml runs: node --test "scripts/pipeline/__tests__/*.mjs" on Ubuntu.
 *
 * The check was WARN-only from 2026-08-20 to 2026-09-03 because flipping it would have
 * malformed 38 of 75 live prompts. Re-measured 2026-09-03 across the whole live corpus
 * (76 top-level HOLDs + 54 parked) it had 2 hits, both prompts that must not arm silently.
 *
 * The ordering test is the one that matters most: a STALE prompt must keep reporting STALE.
 * "The work is already done, bin it" is better information than "your body is malformed",
 * and putting this check early would have silently downgraded that signal.
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
  const isoDir = mkdtempSync(join(tmpdir(), "lint-sa-"));
  const file = join(isoDir, (opts.name || "test") + (opts.hold ? "-HOLD.md" : "-ready.md"));
  writeFileSync(file, fileText, "utf8");
  const res = spawnSync("node", [LINT, file], { cwd: REPO_ROOT, encoding: "utf8" });
  rmSync(isoDir, { recursive: true, force: true });
  return {
    code: res.status != null ? res.status : 1,
    out: String(res.stdout || "") + String(res.stderr || ""),
  };
}

const GRANT = "STANDING AUTHORITY to finish the work, commit, push";

/** Front-matter whose premise HOLDS (exit 0) — the prompt is live work, not stale. */
function fm(premise) {
  return "---\n" +
    "premise: '" + (premise || "true") + "'\n" +
    "premise_means: always-true sentinel for tests\n" +
    "scope:\n  - scripts/pipeline/**\n" +
    "done_when: pnpm build\n" +
    "size: 3\n" +
    "gate_allow: none\n" +
    "---\n";
}

const BODY_HEAD = "\n# Test prompt\n\nDo the thing.\n";

describe("MISSING_STANDING_AUTHORITY", () => {
  test("a body carrying the grant sentence ADMITs", () => {
    const r = runLint(fm() + BODY_HEAD + "\n## STANDING AUTHORITY\n\n> You have " + GRANT +
      ", and OPEN THE PR. Do not ask.\n");
    assert.equal(r.code, 0, "expected exit 0, got " + r.code + "\n" + r.out);
    assert.ok(!r.out.includes("MISSING_STANDING_AUTHORITY"), r.out);
  });

  test("no standing-authority text at all is a REJECT, not a warning", () => {
    const r = runLint(fm() + BODY_HEAD);
    assert.equal(r.code, 1, "expected exit 1, got " + r.code + "\n" + r.out);
    assert.ok(r.out.includes("MISSING_STANDING_AUTHORITY"), r.out);
    assert.ok(r.out.includes("no standing-authority text at all"), r.out);
  });

  test("an imposter heading with no grant sentence is a REJECT and says so", () => {
    const r = runLint(fm() + BODY_HEAD +
      "\n## STANDING AUTHORITY\n\nDrive the PR to green and stop.\n");
    assert.equal(r.code, 1, "expected exit 1, got " + r.code + "\n" + r.out);
    assert.ok(r.out.includes("MISSING_STANDING_AUTHORITY"), r.out);
    assert.ok(r.out.includes("heading is present"), r.out);
  });

  test("the rejection quotes the exact sentence to add", () => {
    const r = runLint(fm() + BODY_HEAD);
    assert.ok(r.out.includes(GRANT), "message must quote the grant verbatim\n" + r.out);
  });

  test("ORDERING: a STALE prompt still reports STALE, not a missing grant", () => {
    // premise 'false' → exit 1 → needed:false, broken:false → PREMISE_ALREADY_SATISFIED.
    // This body also has no grant. STALE must win: exit 3, "already done, BIN IT".
    const r = runLint(fm("false") + BODY_HEAD, { name: "stale-no-grant" });
    assert.equal(r.code, 3, "expected exit 3 (stale), got " + r.code + "\n" + r.out);
    assert.ok(!r.out.includes("MISSING_STANDING_AUTHORITY"),
      "a stale prompt must not be masked by the grant check\n" + r.out);
  });

  test("ORDERING: a HOLD with an unreleased gate keeps its gate verdict", () => {
    // A -HOLD whose gate is unsatisfied must report the gate, not the missing grant:
    // the gate is the actionable state, and the body may not be finished yet.
    const body = fm() + BODY_HEAD;
    const withGate = body.replace("gate_allow: none\n",
      "gate_allow: none\nrequires_on_main: 'scripts/pipeline/lint-prompt.mjs :: __NEEDLE_THAT_DOES_NOT_EXIST__'\n");
    const r = runLint(withGate, { hold: true, name: "gated-no-grant" });
    assert.ok(!r.out.includes("MISSING_STANDING_AUTHORITY"),
      "an unreleased gate must win over the grant check\n" + r.out);
  });
});
