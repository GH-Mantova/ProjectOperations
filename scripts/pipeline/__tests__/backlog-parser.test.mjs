// Tests for the BACKLOG.yaml parser in check-backlog.mjs.
//
// What is tested here:
//   1. A folded block containing a key-shaped prose line (e.g. "    cluster: x") throws
//      FoldKeyGuardError — the block is NOT silently truncated.
//   2. A folded block containing "      gate: rm -rf /" (at fold-content indent) throws
//      rather than replacing the item's real gate value.
//   3. A well-formed entry (including a multi-paragraph folded note) parses with all keys intact.
//   4. The real docs/pr-prompts/BACKLOG.yaml parses cleanly (zero errors).
//
// Indent convention in BACKLOG.yaml (load-bearing for the parser):
//   - Item keys are at EXACTLY 4-space indent:  "    gate: '...'"
//   - Folded block content is at 6-space indent: "      prose line"
// The guard uses this distinction to separate real key-transitions (4-space) from
// key-shaped prose inside folds (6-space, must throw).
//
// Run with:
//   node --test "scripts/pipeline/__tests__/*.mjs"
// (quotes required — a bare directory argument silently discovers nothing on Node 22)

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { parseItems, FoldKeyGuardError, KNOWN_KEYS } from "../check-backlog.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal BACKLOG.yaml text from a list of item blocks.
 * Each block is the body text that goes after "  - id: <id>" — the caller
 * is responsible for indentation (4-space keys, 6-space fold content).
 */
function makeYaml(items) {
  return "items:\n" + items.map(({ id, body }) =>
    `  - id: ${id}\n${body}`,
  ).join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// 1. FOLD_KEY_GUARD fires on an unrecognised key-shaped prose line
// ---------------------------------------------------------------------------

test("folded block with 'cluster: x' at item-key indent (4 spaces) throws FoldKeyGuardError", () => {
  // "    cluster: x" at 4-space indent inside a fold — the old code took this as a new key
  // (silently truncating the rest of the note). The new code checks KNOWN_KEYS and throws.
  const yaml = makeYaml([{
    id: "test-item-cluster",
    body: [
      "    title: 'Test item'",
      "    priority: P2",
      "    why: >",
      "      This is a note about the 2-slice",
      "    cluster: x",   // 4-space indent — unknown key-shaped line ending a fold
      "      rest of the note that must not silently vanish.",
      "    gate: 'false'",
      "    gate_means: 'never ready'",
      "    needs_marco: false",
      "    order: 99",
    ].join("\n"),
  }]);

  assert.throws(
    () => parseItems(yaml),
    (err) => {
      assert.ok(err instanceof FoldKeyGuardError, "must throw FoldKeyGuardError");
      assert.match(err.message, /FOLD_KEY_GUARD/, "message must contain FOLD_KEY_GUARD");
      assert.equal(err.itemId, "test-item-cluster", "itemId must be the item's id");
      assert.match(err.text, /cluster:/, "text must name the offending line");
      return true;
    },
  );
});

test("folded block with 'controlled: something' at item-key indent throws FoldKeyGuardError", () => {
  // "controlled" was one of the words that triggered the original bug (2026-08-19).
  const yaml = makeYaml([{
    id: "test-item-controlled",
    body: [
      "    title: 'Controlled test'",
      "    priority: P3",
      "    marco_note: >",
      "      This is carefully",
      "    controlled: yes",   // 4-space — unknown key while folding
      "    gate: 'false'",
      "    gate_means: 'blocked'",
      "    needs_marco: true",
      "    order: 100",
    ].join("\n"),
  }]);

  assert.throws(
    () => parseItems(yaml),
    (err) => {
      assert.ok(err instanceof FoldKeyGuardError);
      assert.equal(err.itemId, "test-item-controlled");
      return true;
    },
  );
});

test("FoldKeyGuardError carries the line number of the offending line", () => {
  // Verify the lineNumber field is populated so the human message can name the line.
  const yaml = [
    "items:",
    "  - id: lineno-test",
    "    title: 'Line number test'",
    "    priority: P2",
    "    why: >",
    "      Some prose here.",
    "    cluster: offending",   // 4-space, unknown key — must throw with a line number
    "    gate: 'false'",
    "    gate_means: 'blocked'",
    "    needs_marco: false",
    "    order: 99",
    "",
  ].join("\n");

  assert.throws(
    () => parseItems(yaml),
    (err) => {
      assert.ok(err instanceof FoldKeyGuardError);
      assert.ok(typeof err.lineNumber === "number", "lineNumber must be a number");
      assert.ok(err.lineNumber > 0, "lineNumber must be positive");
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// 2. A "gate: <evil>" line inside a folded block does NOT replace the real gate
// ---------------------------------------------------------------------------

test("'gate: rm -rf /' at fold-content indent (6 spaces) throws rather than overwriting the real gate", () => {
  // In BACKLOG.yaml, folded block content appears at 6-space indent:
  //   "    why: >"      <- 4-space key
  //   "      line 1"   <- 6-space fold content (normal prose)
  //   "      gate: rm -rf /"  <- 6-space fold content that looks like a key — MUST throw
  //   "    gate: '...' "      <- 4-space REAL gate key (after the fold)
  //
  // The old parser matched /^\s{4,}/ which caught both 4-space and 6-space lines,
  // so "      gate: rm -rf /" would silently overwrite the item's gate field.
  // The new parser treats 6+-space kv-shaped lines as prose and throws.
  const yaml = [
    "items:",
    "  - id: gate-overwrite-test",
    "    title: 'Gate overwrite test'",
    "    priority: P2",
    "    why: >",
    "      Prose about the issue. Consider the",
    "      gate: rm -rf /",   // 6-space fold content — key-shaped prose, must throw
    "    gate: '! grep -q FOLD_KEY_GUARD scripts/pipeline/check-backlog.mjs'",
    "    gate_means: 'blocked until guard lands'",
    "    needs_marco: false",
    "    order: 99",
    "",
  ].join("\n");

  assert.throws(
    () => parseItems(yaml),
    (err) => {
      assert.ok(err instanceof FoldKeyGuardError, "must throw FoldKeyGuardError");
      assert.equal(err.itemId, "gate-overwrite-test");
      assert.match(err.text, /gate:/, "error text must identify the offending line");
      return true;
    },
    "a 'gate:' line at 6-space fold-content indent must throw, not overwrite the real gate",
  );
});

test("unknown key at fold-content indent (6 spaces) throws FoldKeyGuardError", () => {
  // Same as above but with an unknown key name (cluster) at 6-space indent.
  const yaml = [
    "items:",
    "  - id: six-space-unknown",
    "    title: 'Six-space unknown'",
    "    priority: P2",
    "    marco_note: >",
    "      Analysis of the 2-slice",
    "      cluster: snapshot-waste",   // 6-space fold content — unknown key-shaped line
    "    gate: 'false'",
    "    gate_means: 'blocked'",
    "    needs_marco: false",
    "    order: 99",
    "",
  ].join("\n");

  assert.throws(
    () => parseItems(yaml),
    FoldKeyGuardError,
    "unknown key-shaped line at fold-content indent must throw FoldKeyGuardError",
  );
});

test("unknown key at item-key indent (4 spaces) inside a fold also throws", () => {
  // Belt-and-suspenders: even at 4-space indent, an unknown key while folding throws.
  const yaml = makeYaml([{
    id: "four-space-unknown",
    body: [
      "    title: 'Four-space unknown'",
      "    priority: P2",
      "    why: >",
      "      Analysis of the 2-slice",
      "    cluster: snapshot-waste",   // 4-space, unknown key while folding
      "    gate: 'false'",
      "    gate_means: 'test'",
      "    needs_marco: false",
      "    order: 99",
    ].join("\n"),
  }]);

  assert.throws(
    () => parseItems(yaml),
    FoldKeyGuardError,
    "unknown key-shaped line at 4-space indent inside fold must throw FoldKeyGuardError",
  );
});

// ---------------------------------------------------------------------------
// 3. Well-formed entries parse correctly — guard against over-correction
// ---------------------------------------------------------------------------

test("a well-formed item with a simple folded note parses with all keys intact", () => {
  const yaml = makeYaml([{
    id: "well-formed-simple",
    body: [
      "    title: 'A well-formed item'",
      "    priority: P1",
      "    why: >",
      "      This note wraps across",
      "      multiple lines and ends cleanly.",
      "    gate: '! grep -q SENTINEL scripts/foo.mjs'",
      "    gate_means: 'READY while sentinel is absent'",
      "    needs_marco: false",
      "    order: 5",
    ].join("\n"),
  }]);

  const items = parseItems(yaml);
  assert.equal(items.length, 1);
  const it = items[0];
  assert.equal(it.id, "well-formed-simple");
  assert.equal(it.title, "A well-formed item");
  assert.equal(it.priority, "P1");
  assert.ok(it.why.includes("wraps across"), "folded note content must be preserved");
  assert.ok(it.why.includes("ends cleanly"), "folded note must include both lines");
  assert.equal(it.gate, "! grep -q SENTINEL scripts/foo.mjs");
  assert.equal(it.gate_means, "READY while sentinel is absent");
  assert.equal(it.needs_marco, "false");
  assert.equal(it.order, "5");
});

test("a folded note spanning many lines keeps all content (no over-correction)", () => {
  const yaml = makeYaml([{
    id: "multi-line-note",
    body: [
      "    title: 'Multi-line note'",
      "    priority: P2",
      "    marco_note: >",
      "      Paragraph one of the note.",
      "      Still paragraph one, continued.",
      "      Third line of the note.",
      "      Fourth line with no word-colon trap.",
      "      Fifth line wraps safely.",
      "    gate: 'false'",
      "    gate_means: 'blocked indefinitely'",
      "    needs_marco: true",
      "    order: 7",
    ].join("\n"),
  }]);

  const items = parseItems(yaml);
  assert.equal(items.length, 1);
  const it = items[0];
  assert.ok(it.marco_note.includes("Paragraph one"), "first line preserved");
  assert.ok(it.marco_note.includes("Fifth line"), "fifth line preserved");
  assert.equal(it.gate, "false");
  assert.equal(it.needs_marco, "true");
});

test("multiple items in sequence all parse correctly", () => {
  const yaml = makeYaml([
    {
      id: "item-alpha",
      body: [
        "    title: 'Alpha item'",
        "    priority: P1",
        "    gate: 'true'",
        "    gate_means: 'always ready'",
        "    needs_marco: false",
        "    order: 1",
      ].join("\n"),
    },
    {
      id: "item-beta",
      body: [
        "    title: 'Beta item'",
        "    priority: P2",
        "    why: >",
        "      Beta has a folded why field",
        "      that continues here.",
        "    gate: 'false'",
        "    gate_means: 'never'",
        "    needs_marco: false",
        "    order: 2",
      ].join("\n"),
    },
  ]);

  const items = parseItems(yaml);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, "item-alpha");
  assert.equal(items[1].id, "item-beta");
  assert.ok(items[1].why.includes("continues here"), "beta's why must be complete");
});

test("KNOWN_KEYS contains exactly the expected schema keys", () => {
  // Regression guard: if someone adds a key to the schema, they must add it here too.
  const expected = ["id", "title", "priority", "why", "gate", "gate_means", "needs_marco", "marco_note", "order"];
  assert.equal(KNOWN_KEYS.size, expected.length, "KNOWN_KEYS size must match expected");
  for (const key of expected) {
    assert.ok(KNOWN_KEYS.has(key), `KNOWN_KEYS must contain '${key}'`);
  }
});

// ---------------------------------------------------------------------------
// 4. The real BACKLOG.yaml parses clean
// ---------------------------------------------------------------------------

test("real docs/pr-prompts/BACKLOG.yaml parses without errors", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // __tests__ is at scripts/pipeline/__tests__/
  // BACKLOG.yaml is at docs/pr-prompts/BACKLOG.yaml (repo root relative)
  const repoRoot = path.resolve(here, "..", "..", "..");
  const backlogPath = path.join(repoRoot, "docs", "pr-prompts", "BACKLOG.yaml");

  let text;
  try {
    text = readFileSync(backlogPath, "utf8");
  } catch (e) {
    // If the file can't be read in CI (e.g. wrong cwd), fail descriptively.
    throw new Error(`Could not read BACKLOG.yaml at ${backlogPath}: ${e.message}`);
  }

  // Must not throw.
  let items;
  assert.doesNotThrow(
    () => { items = parseItems(text); },
    "real BACKLOG.yaml must parse without FoldKeyGuardError",
  );

  // Sanity: there must be at least one item in the file.
  assert.ok(Array.isArray(items) && items.length > 0, "real BACKLOG.yaml must contain at least one item");

  // Every item must have id, gate, and gate_means (the core fields the runner uses).
  for (const it of items) {
    assert.ok(it.id, `every item must have an id (got: ${JSON.stringify(it)})`);
    assert.ok(it.gate !== undefined, `item '${it.id}' must have a gate`);
  }
});
