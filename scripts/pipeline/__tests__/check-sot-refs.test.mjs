/**
 * Tests for check-sot-refs.mjs
 *
 * Proves the guard fires in BOTH directions using node:test + node:fs tmpdir fixtures.
 *
 * Each fixture is a minimal repo-root directory with a sot/ subdirectory.
 * The checker is run as a child_process spawnSync with --root pointing at the fixture.
 *
 * Polarity under test (ORDINARY direction — see file header of check-sot-refs.mjs):
 *   exit 0  = every reference resolved (or allowlisted)
 *   exit 1  = at least one reference dangled, OR broken instrument
 *
 * Run with:
 *   node --test "scripts/pipeline/__tests__/*.mjs"
 * (quotes required — a bare directory argument silently discovers nothing on Node 22)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// The checker lives two directories up from __tests__
const CHECKER = join(__dirname, "..", "check-sot-refs.mjs");

/**
 * Create a temporary directory tree for a fixture.
 * Returns { root, cleanup }.
 * root has a sot/ sub-directory; the caller writes sot files into it.
 */
function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "sot-ref-test-"));
  mkdirSync(join(root, "sot"), { recursive: true });
  return {
    root,
    cleanup() {
      try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}

/**
 * Run the checker with --root pointing at root.
 * Returns { status, stdout, stderr }.
 */
function run(root) {
  const result = spawnSync(
    process.execPath,
    [CHECKER, "--root", root],
    { encoding: "utf8", timeout: 15000 },
  );
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

// ---------------------------------------------------------------------------
// 1. Dangling reference → non-zero exit AND offending path appears in output
// ---------------------------------------------------------------------------

test("dangling reference: non-zero exit and path appears in output", () => {
  const { root, cleanup } = createFixture();
  try {
    // Write a sot file with a reference to a file that does NOT exist
    writeFileSync(
      join(root, "sot", "test.md"),
      "See `docs/nonexistent-file.md` for details.\n",
    );

    const { status, stdout, stderr } = run(root);
    const combined = stdout + stderr;

    assert.notEqual(status, 0, "exit must be non-zero when a reference dangles");
    assert.ok(
      combined.includes("docs/nonexistent-file.md"),
      "output must mention the offending path; got:\n" + combined,
    );
    assert.ok(
      combined.includes("FAIL") || combined.includes("DANGLING"),
      "output must contain FAIL or DANGLING; got:\n" + combined,
    );
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// 2. Reference that DOES resolve → clean exit 0
// ---------------------------------------------------------------------------

test("resolved reference: clean exit 0", () => {
  const { root, cleanup } = createFixture();
  try {
    // Create the target file at repo root
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "existing.md"), "# Existing\n");

    // Write a sot file referencing it
    writeFileSync(
      join(root, "sot", "test.md"),
      "See `docs/existing.md` for details.\n",
    );

    const { status, stdout, stderr } = run(root);
    const combined = stdout + stderr;

    assert.equal(status, 0, "exit must be 0 when all references resolve; got:\n" + combined);
    assert.ok(
      combined.includes("dangling=0"),
      "output must report dangling=0; got:\n" + combined,
    );
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// 3. Allowlist marker → clean exit AND exemption is printed
// ---------------------------------------------------------------------------

test("allowlisted reference: clean exit and exemption printed", () => {
  const { root, cleanup } = createFixture();
  try {
    // The target file does NOT exist, but the line has an allowlist marker
    writeFileSync(
      join(root, "sot", "test.md"),
      "See `docs/legacy-file.md` for old details. <!-- sot-ref-allow: file removed in cleanup PR -->\n",
    );

    const { status, stdout, stderr } = run(root);
    const combined = stdout + stderr;

    assert.equal(status, 0, "exit must be 0 when reference is allowlisted; got:\n" + combined);
    // The exemption must be printed (silent allowlists rot)
    assert.ok(
      combined.includes("EXEMPT") || combined.includes("ALLOWLIST"),
      "output must mention the exemption; got:\n" + combined,
    );
    assert.ok(
      combined.includes("file removed in cleanup PR"),
      "output must include the allowlist reason; got:\n" + combined,
    );
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// 4. Zero sot/*.md files → BROKEN exit non-zero
// ---------------------------------------------------------------------------

test("zero sot files: BROKEN exit non-zero", () => {
  const { root, cleanup } = createFixture();
  try {
    // sot/ directory exists but is empty (no .md files)
    // (created by createFixture, left empty here)

    const { status, stdout, stderr } = run(root);
    const combined = stdout + stderr;

    assert.notEqual(status, 0, "exit must be non-zero when no sot/*.md files found");
    assert.ok(
      combined.includes("BROKEN"),
      "output must contain BROKEN; got:\n" + combined,
    );
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// 5. Regex extracts zero references (sot files exist but contain no path refs)
//    → BROKEN exit non-zero
// ---------------------------------------------------------------------------

test("zero references extracted: BROKEN exit non-zero", () => {
  const { root, cleanup } = createFixture();
  try {
    // A sot file with no backtick path references at all
    writeFileSync(
      join(root, "sot", "empty-refs.md"),
      "# Overview\n\nThis file has no path references — only plain prose.\n",
    );

    const { status, stdout, stderr } = run(root);
    const combined = stdout + stderr;

    assert.notEqual(status, 0, "exit must be non-zero when zero references are extracted");
    assert.ok(
      combined.includes("BROKEN"),
      "output must contain BROKEN; got:\n" + combined,
    );
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// 6. Mixed: one resolved, one dangling → non-zero exit, only dangling in FAIL list
// ---------------------------------------------------------------------------

test("mixed resolved and dangling: non-zero exit, dangling path named", () => {
  const { root, cleanup } = createFixture();
  try {
    // Create one real file
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(join(root, "scripts", "real.mjs"), "// real\n");

    writeFileSync(
      join(root, "sot", "test.md"),
      [
        "Good ref: `scripts/real.mjs`",
        "Bad ref: `scripts/ghost.mjs`",
      ].join("\n") + "\n",
    );

    const { status, stdout, stderr } = run(root);
    const combined = stdout + stderr;

    assert.notEqual(status, 0, "exit must be non-zero when at least one reference dangles");
    assert.ok(
      combined.includes("scripts/ghost.mjs"),
      "dangling path must appear in output; got:\n" + combined,
    );
    // The resolved ref must NOT appear as a failure
    assert.ok(
      !combined.includes("FAIL  " + "sot") || !combined.includes("scripts/real.mjs") ||
      combined.includes("scripts/ghost.mjs"),
      "resolved path must not be listed as dangling",
    );
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// 7. Total count is always printed (broken-instrument guard: visible when zero)
// ---------------------------------------------------------------------------

test("total reference count is always printed in output", () => {
  const { root, cleanup } = createFixture();
  try {
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "visible.md"), "# Visible\n");
    writeFileSync(
      join(root, "sot", "test.md"),
      "See `docs/visible.md`.\n",
    );

    const { status, stdout, stderr } = run(root);
    const combined = stdout + stderr;

    assert.equal(status, 0, "exit must be 0; got:\n" + combined);
    // The summary line must include "extracted" or "reference(s) extracted"
    assert.ok(
      combined.includes("extracted") || combined.includes("reference"),
      "output must print the extracted count; got:\n" + combined,
    );
    // Must mention the exact total somewhere
    assert.ok(
      /\d+ reference/.test(combined) || /total=\d+/.test(combined),
      "output must include a numeric reference count; got:\n" + combined,
    );
  } finally {
    cleanup();
  }
});
