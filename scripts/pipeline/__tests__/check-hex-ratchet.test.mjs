/**
 * Tests for check-hex-ratchet.mjs
 *
 * The gate stops apps/web/src gaining hard-coded colour literals. These tests
 * prove it fires in BOTH directions, because a gate that cannot fail is
 * decoration (DOCTRINE section 7 guard 1) and a gate that fires on burn-down
 * work is worse than none (the #1405 lesson recorded in the header of
 * check-sot-baseline-ratchet.mjs).
 *
 * Two layers are tested, deliberately:
 *   1. The PURE functions (countHex, ratchet, filesOf) - imported directly, so
 *      a policy change has to break an assertion about the policy.
 *   2. The CLI end-to-end - spawned against real git fixtures with --root, so
 *      the exit codes CI actually keys on are the thing under test. A pure-unit
 *      suite would not have caught a checker that computes the right verdict and
 *      then exits 0 regardless.
 *
 * Polarity (see the file header of check-hex-ratchet.mjs):
 *   exit 0 = no file gained a literal
 *   exit 1 = one did
 *   exit 2 = broken instrument - NEVER a silent pass
 *
 * Run with:
 *   node --test "scripts/pipeline/__tests__/*.mjs"
 * (quotes required - a bare directory argument silently discovers nothing on Node 22)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { countHex, ratchet, filesOf, scanTree, SCAN_ROOT } from "../check-hex-ratchet.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHECKER = join(__dirname, "..", "check-hex-ratchet.mjs");

/**
 * A throwaway git repo with files under apps/web/src. The checker uses
 * `git ls-files`, so the fixture has to be a real repo with the files STAGED -
 * an untracked file is deliberately invisible to the counter.
 */
function createFixture(files) {
  const root = mkdtempSync(join(tmpdir(), "hex-ratchet-test-"));
  // Point git at config paths that do not exist rather than at /dev/null: git
  // reads a missing config file as empty on every platform, and this suite also
  // runs on the windows-latest `pipeline-tests-windows` job, where /dev/null and
  // an inherited core.autocrlf would both be hazards.
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: join(root, "no-such-gitconfig"),
    GIT_CONFIG_SYSTEM: join(root, "no-such-gitconfig"),
  };
  const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8", env });
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  const rels = Object.keys(files);
  for (const rel of rels) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, files[rel]);
  }
  // Explicit paths, never `git add -A`.
  git("add", "--", ...rels);
  return { root, git, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function writeJson(root, rel, obj) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, typeof obj === "string" ? obj : JSON.stringify(obj, null, 2));
  return abs;
}

const run = (args, cwd) => spawnSync(process.execPath, [CHECKER, ...args], { cwd, encoding: "utf8" });

// ---------------------------------------------------------------- the counter

test("countHex: counts the four valid CSS colour lengths", () => {
  assert.equal(countHex("color: #fff;"), 1, "3 digits");
  assert.equal(countHex("color: #fff8;"), 1, "4 digits");
  assert.equal(countHex("color: #E5E7EB;"), 1, "6 digits");
  assert.equal(countHex("color: #E5E7EB80;"), 1, "8 digits");
});

test("countHex: 5 and 7 digit runs are not colours and are not counted", () => {
  // MEASURED 2026-09-07: apps/web/src currently contains ZERO of these. The rule
  // is here so a future `#abcde` typo is not silently counted as debt the gate
  // then defends at that number.
  assert.equal(countHex('x = "#abcde";'), 0);
  assert.equal(countHex('x = "#abcdef0";'), 0);
});

test("countHex: HTML entities are excluded - the `&#` rule", () => {
  // MEASURED 2026-09-07: 10 entities in apps/web/src match on their digits.
  // Without this rule they are counted as colours and baselined forever.
  assert.equal(countHex("return <span>&#8593;</span>;"), 0);
  assert.equal(countHex("&#160;"), 0);
  assert.equal(countHex("&#10003;"), 0);
  // But a real hex immediately after an entity still counts.
  assert.equal(countHex("&#160; color: #fff;"), 1);
});

test("countHex: comments and var() fallbacks are counted, not excused", () => {
  // A hex in a comment is a colour someone will copy.
  assert.equal(countHex("/* was #ff0000 */"), 1);
  // The var() fallback case is the bulk of the live theme defects: where the
  // token does not exist, the fallback is what actually renders in BOTH themes.
  assert.equal(countHex("border: 1px solid var(--border, #e5e7eb);"), 1);
});

test("countHex: an over-long hex run counts nothing at all", () => {
  // Greedy {3,8} with a trailing \b must not fall back to a bogus 8-digit hit.
  assert.equal(countHex("#0123456789"), 0);
  assert.equal(countHex('const id = "#";'), 0);
  assert.equal(countHex("#abcdefgh"), 0, "letters past f are not hex digits");
});

test("countHex: multiple literals on one line each count", () => {
  assert.equal(countHex("a:#fff;b:#000;c:#123456;"), 3);
});

// ---------------------------------------------------------------- the rule

test("ratchet rule 1: no file's count may increase", () => {
  const r = ratchet({ "a.tsx": 12 }, { "a.tsx": 13 });
  assert.equal(r.ok, false);
  assert.deepEqual(r.grew, [{ path: "a.tsx", before: 12, after: 13 }]);
});

test("ratchet rule 1: the failure NAMES the file and the transition", () => {
  // An unusable error message is how a gate gets routed around within a month.
  const g = ratchet({ "apps/web/src/App.tsx": 12 }, { "apps/web/src/App.tsx": 13 }).grew[0];
  assert.equal(g.path, "apps/web/src/App.tsx");
  assert.equal(g.before, 12);
  assert.equal(g.after, 13);
});

test("ratchet rule 2: a file absent from the base baseline must be clean", () => {
  // This is the rule that turns the curve. +20 new files arrived in the fortnight
  // before this gate; without rule 2 every one of them is waved through.
  const bad = ratchet({ "a.tsx": 5 }, { "a.tsx": 5, "new.tsx": 1 });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.added, [{ path: "new.tsx", count: 1 }]);

  const good = ratchet({ "a.tsx": 5 }, { "a.tsx": 5, "new.tsx": 0 });
  assert.equal(good.ok, true, "a NEW file with count 0 is fine");
});

test("ratchet rule 3: burn-down and deletion are always allowed", () => {
  assert.equal(ratchet({ "a.tsx": 40 }, { "a.tsx": 12 }).ok, true, "40 -> 12");
  assert.equal(ratchet({ "a.tsx": 40, "b.tsx": 3 }, { "a.tsx": 40 }).ok, true, "b.tsx deleted");
  assert.equal(ratchet({ "a.tsx": 12 }, { "a.tsx": 12 }).ok, true, "unchanged");
  assert.equal(ratchet({ "a.tsx": 40 }, { "a.tsx": 0 }).ok, true, "fully burned down");
});

test("ratchet rule 4: the total is reported but never enforced", () => {
  // A PR may legitimately raise the total: delete a 1-literal file and add a
  // 0-literal one, or split a file. Per-file is strictly stronger anyway.
  const r = ratchet({ "a.tsx": 1 }, { "a.tsx": 1, "b.tsx": 0 });
  assert.equal(r.ok, true);
  assert.equal(r.baseTotal, 1);
  assert.equal(r.headTotal, 1);
});

test("ratchet: a rise is NOT cancelled by a fall elsewhere", () => {
  // The whole reason the rule is per-file rather than on the total.
  const r = ratchet({ "a.tsx": 12, "b.tsx": 40 }, { "a.tsx": 13, "b.tsx": 1 });
  assert.equal(r.ok, false);
  assert.equal(r.headTotal < r.baseTotal, true, "total fell, and the gate still fires");
  assert.deepEqual(r.grew, [{ path: "a.tsx", before: 12, after: 13 }]);
});

test("ratchet: keyed on PATH ONLY - position is never part of the key", () => {
  // The #1405 trap, transposed. Reformatting a file, moving a component within
  // it, or extracting a helper changes every line and column and no counts. A
  // ratchet that fires on that fires hardest on the work it exists to encourage.
  const before = { "a.tsx": 3, "b.tsx": 3 };
  const afterReordered = { "b.tsx": 3, "a.tsx": 3 };
  assert.equal(ratchet(before, afterReordered).ok, true);
});

// ---------------------------------------------------------------- broken input

test("filesOf: reads a bare map and a {files:{...}} envelope identically", () => {
  assert.deepEqual(filesOf({ "a.tsx": 3 }, "x"), { "a.tsx": 3 });
  assert.deepEqual(filesOf({ _readme: "doc", total: 3, files: { "a.tsx": 3 } }, "x"), { "a.tsx": 3 });
});

test("filesOf: underscore-prefixed keys are documentation, not counts", () => {
  assert.deepEqual(filesOf({ _readme: "doc", "a.tsx": 3 }, "x"), { "a.tsx": 3 });
});

test("filesOf: unreadable input THROWS - it must never read as an empty baseline", () => {
  // An empty baseline passes everything. Degrading to one on bad input is the
  // single failure mode a ratchet must not have.
  for (const bad of ["{oops", "[]", "null", '{"a.tsx":"12"}', '{"a.tsx":-1}', '{"a.tsx":1.5}']) {
    assert.throws(() => filesOf(bad, "head"), undefined, `expected ${bad} to throw`);
  }
});

// ---------------------------------------------------------------- the scanner

test("scanTree: counts tracked in-scope files and omits clean ones", () => {
  const fx = createFixture({
    "apps/web/src/A.tsx": 'const a = "#ffffff";\nconst b = "#000";\n',
    "apps/web/src/B.css": ".x { color: var(--border-default); }\n", // clean -> omitted
    "apps/web/src/styles/tokens.css": "--border-default: #E5E7EB;\n", // NOT excused
  });
  try {
    const counts = scanTree(fx.root);
    assert.equal(counts["apps/web/src/A.tsx"], 2);
    assert.equal("apps/web/src/B.css" in counts, false, "a clean file has no entry");
    assert.equal(counts["apps/web/src/styles/tokens.css"], 1, "tokens.css is baselined like any other file");
  } finally {
    fx.cleanup();
  }
});

test("scanTree: ignores out-of-scope extensions and paths outside apps/web/src", () => {
  const fx = createFixture({
    "apps/web/src/A.tsx": 'const a = "#ffffff";\n',
    "apps/web/src/notes.md": "# heading with #ffffff in it\n",
    "apps/api/src/B.ts": 'const b = "#ffffff";\n',
  });
  try {
    const counts = scanTree(fx.root);
    assert.deepEqual(Object.keys(counts), ["apps/web/src/A.tsx"]);
  } finally {
    fx.cleanup();
  }
});

test("scanTree: an UNTRACKED file is invisible - the counter follows git, not the disk", () => {
  // Matters in CI, and matters more on a dev box where a gitignored artifact
  // would otherwise inflate the count. The sot-refs baseline records the same
  // trap from the other direction (working-tree existsSync vs a clean worktree).
  const fx = createFixture({ "apps/web/src/A.tsx": 'const a = "#ffffff";\n' });
  try {
    writeFileSync(join(fx.root, "apps/web/src/Untracked.tsx"), 'const u = "#123456";\n');
    const counts = scanTree(fx.root);
    assert.equal("apps/web/src/Untracked.tsx" in counts, false);
    assert.equal(counts["apps/web/src/A.tsx"], 1);
  } finally {
    fx.cleanup();
  }
});

// ---------------------------------------------------------------- the CLI

test("CLI --self-test exits 0 and says how many cases ran", () => {
  const r = run(["--self-test"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /hex ratchet self-test: \d+ rule cases/);
  assert.match(r.stdout, /4 fail/, "the fail-cases are the point; say so");
});

test("CLI --generate emits a parseable, ratchet-ready baseline", () => {
  const fx = createFixture({ "apps/web/src/A.tsx": 'const a = "#ffffff";\nconst b="#000";\n' });
  try {
    fx.git("commit", "-qm", "init");
    const r = run(["--generate", "--root", fx.root], fx.root);
    assert.equal(r.status, 0, r.stderr);
    const doc = JSON.parse(r.stdout);
    assert.equal(doc.files["apps/web/src/A.tsx"], 2);
    assert.equal(doc.total, 2);
    assert.match(doc._readme, /may only SHRINK/i, "the readme must state the ratchet direction");
    assert.match(doc._readme, /--generate/, "the readme must say how to burn down");
    // Its own output must be a valid input to its own rule.
    assert.equal(ratchet(doc, doc).ok, true);
  } finally {
    fx.cleanup();
  }
});

test("CLI --check: PASSES when the tree matches its baseline", () => {
  const fx = createFixture({ "apps/web/src/A.tsx": 'const a = "#ffffff";\n' });
  try {
    const base = writeJson(fx.root, "base.json", { files: { "apps/web/src/A.tsx": 1 } });
    writeJson(fx.root, "docs/qa/hex-baseline.json", { files: { "apps/web/src/A.tsx": 1 } });
    const r = run(["--check", "--base", base, "--root", fx.root], fx.root);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /hex ratchet: OK/);
  } finally {
    fx.cleanup();
  }
});

test("CLI --check: PASSES a burn-down that regenerates the baseline", () => {
  // The single most important pass-case. The #1405 lesson is that a ratchet
  // which rejects burn-down work destroys the behaviour it exists to create.
  const fx = createFixture({ "apps/web/src/A.tsx": 'const a = "#ffffff";\n' });
  try {
    const base = writeJson(fx.root, "base.json", { files: { "apps/web/src/A.tsx": 40 } });
    writeJson(fx.root, "docs/qa/hex-baseline.json", { files: { "apps/web/src/A.tsx": 1 } });
    const r = run(["--check", "--base", base, "--root", fx.root], fx.root);
    assert.equal(r.status, 0, r.stderr);
  } finally {
    fx.cleanup();
  }
});

test("CLI --check: FAILS (exit 1) when a tracked file gains a literal", () => {
  const fx = createFixture({ "apps/web/src/A.tsx": 'const a = "#ffffff";\nconst b = "#000000";\n' });
  try {
    const base = writeJson(fx.root, "base.json", { files: { "apps/web/src/A.tsx": 1 } });
    writeJson(fx.root, "docs/qa/hex-baseline.json", { files: { "apps/web/src/A.tsx": 1 } });
    const r = run(["--check", "--base", base, "--root", fx.root], fx.root);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stderr, /GREW\s+apps\/web\/src\/A\.tsx\s+1 -> 2/);
    assert.match(r.stderr, /tokens\.css/, "the error must point at the fix, not just the sin");
  } finally {
    fx.cleanup();
  }
});

test("CLI --check: FAILS (exit 1) when a NEW file carries a literal", () => {
  const fx = createFixture({
    "apps/web/src/A.tsx": 'const a = "#ffffff";\n',
    "apps/web/src/New.tsx": 'const n = "#123456";\n',
  });
  try {
    const base = writeJson(fx.root, "base.json", { files: { "apps/web/src/A.tsx": 1 } });
    writeJson(fx.root, "docs/qa/hex-baseline.json", { files: { "apps/web/src/A.tsx": 1 } });
    const r = run(["--check", "--base", base, "--root", fx.root], fx.root);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stderr, /NEW\s+apps\/web\/src\/New\.tsx\s+0 -> 1/);
  } finally {
    fx.cleanup();
  }
});

test("CLI --check: FAILS when the baseline is raised to excuse a new literal", () => {
  // The door a file-only ratchet leaves open: pass the reality check by editing
  // the JSON. Comparison (B) closes it. Both halves are reported.
  const fx = createFixture({ "apps/web/src/A.tsx": 'const a = "#ffffff";\nconst b = "#000000";\n' });
  try {
    const base = writeJson(fx.root, "base.json", { files: { "apps/web/src/A.tsx": 1 } });
    writeJson(fx.root, "docs/qa/hex-baseline.json", { files: { "apps/web/src/A.tsx": 2 } });
    const r = run(["--check", "--base", base, "--root", fx.root], fx.root);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stderr, /may only SHRINK/i);
  } finally {
    fx.cleanup();
  }
});

test("CLI --check: EXIT 2, never 0, on a baseline that will not parse", () => {
  const fx = createFixture({ "apps/web/src/A.tsx": 'const a = "#ffffff";\n' });
  try {
    const base = writeJson(fx.root, "base.json", "{ not json at all");
    writeJson(fx.root, "docs/qa/hex-baseline.json", { files: { "apps/web/src/A.tsx": 1 } });
    const r = run(["--check", "--base", base, "--root", fx.root], fx.root);
    assert.equal(r.status, 2, `wanted a broken-instrument exit, got ${r.status}: ${r.stdout}`);
    assert.match(r.stderr, /broken, not passing/);
  } finally {
    fx.cleanup();
  }
});

test("CLI --check: EXIT 2 when the head baseline has been deleted", () => {
  // Deleting the baseline must not be a way to switch the gate off.
  const fx = createFixture({ "apps/web/src/A.tsx": 'const a = "#ffffff";\n' });
  try {
    const base = writeJson(fx.root, "base.json", { files: { "apps/web/src/A.tsx": 1 } });
    const r = run(["--check", "--base", base, "--root", fx.root], fx.root);
    assert.equal(r.status, 2, r.stdout);
    assert.match(r.stderr, /does not exist/);
  } finally {
    fx.cleanup();
  }
});

test("CLI --compare: exit 0 / 1 on two baseline files", () => {
  const fx = createFixture({ "apps/web/src/A.tsx": "x\n" });
  try {
    const a = writeJson(fx.root, "a.json", { files: { "x.tsx": 5 } });
    const shrunk = writeJson(fx.root, "b.json", { files: { "x.tsx": 4 } });
    const grown = writeJson(fx.root, "c.json", { files: { "x.tsx": 6 } });
    assert.equal(run(["--compare", a, shrunk], fx.root).status, 0);
    assert.equal(run(["--compare", a, grown], fx.root).status, 1);
  } finally {
    fx.cleanup();
  }
});

test("CLI: an unknown argument exits 2, not 0", () => {
  assert.equal(run(["--wat"]).status, 2);
  assert.equal(run([]).status, 2, "no arguments must not be a silent pass");
});

// -------------------------------------------------- the committed baseline

test("the committed docs/qa/hex-baseline.json is valid and self-consistent", () => {
  const repo = join(__dirname, "..", "..", "..");
  const doc = JSON.parse(readFileSync(join(repo, "docs/qa/hex-baseline.json"), "utf8"));
  const files = filesOf(doc, "committed");
  assert.equal(Object.keys(files).length > 0, true, "an empty baseline would pass everything");
  const summed = Object.values(files).reduce((a, b) => a + b, 0);
  assert.equal(doc.total, summed, "the recorded total must match the per-file counts");
  assert.equal(ratchet(doc, doc).ok, true, "the baseline must pass against itself");
  for (const p of Object.keys(files)) {
    assert.equal(p.startsWith(SCAN_ROOT + "/"), true, `${p} is outside ${SCAN_ROOT}`);
    assert.equal(files[p] > 0, true, `${p} is baselined at 0 - clean files are omitted, not recorded`);
  }
});
