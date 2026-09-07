#!/usr/bin/env node
// Ratchet for docs/qa/hex-baseline.json: no file may gain a hard-coded colour literal.
//
// WHY THIS EXISTS. `sot/01` SECTION 5 mandates "Always use CSS variables - never
// hardcode colour values". MEASURED 2026-09-07 @9826b552: apps/web/src violates
// that rule 4,353 times across 263 tracked files, and nothing in ci.yml counted
// them. Between 2026-08-18 (aaa2213) and 2026-09-01 the count rose from 3,792 to
// ~4,32x - roughly 39 new literals a day, concentrated in the areas where lanes
// are actively building.
//
// The registered migration campaign (docs/plans/theme-system-plan.md, decision
// D24) proposes retiring ~3,800 literals across eleven serialised slices. It
// cannot outrun its own target: the board merges one PR at a time and the debt
// grows faster than the slices retire it. This gate does not migrate anything.
// It stops the inflow, so opportunistic conversion can actually converge.
//
// WHAT A "HARD-CODED COLOUR" IS HERE. `#` followed by 3, 4, 6 or 8 hex digits at
// a word boundary, in tracked .ts/.tsx/.css files under apps/web/src. Each rule
// is measured, not assumed:
//
//   * 3/4/6/8 only. 5 and 7 digits cannot be a CSS colour. MEASURED 2026-09-07:
//     of 4,353 matches for {3,8} digits, ZERO have 5 or 7 digits, so this rule
//     currently drops nothing - it is here so that a future `#abcde` typo is not
//     silently counted as debt the gate then defends.
//   * Exclude `&#`. MEASURED 2026-09-07: 10 HTML entities (`&#8593;`, `&#10003;`,
//     `&#9888;` ...) in apps/web/src match the colour pattern on their digits.
//     Requiring the character before `#` not to be `&` drops exactly those 10.
//   * Comments are NOT excluded. A hex in a comment is a colour someone will
//     copy. Counting it costs nothing and a simple counter is a trustworthy one.
//   * tokens.css is NOT excluded. It is the one file where hex literals are
//     correct, and its count is simply baselined like any other file's. Special
//     cases are how a gate acquires a hole.
//
// KEY ON PATH, NEVER ON POSITION. The sot-refs ratchet
// (check-sot-baseline-ratchet.mjs) excludes `line` from its key, because editing
// a sot/ file shifts every line below it and burning an entry down REQUIRES
// editing sot/. Measured on PR #1405: a burn-down taking the baseline 23 -> 13
// was REJECTED because one byte-identical entry was re-emitted at a different
// array position - the gate fired hardest on exactly the work it existed to
// encourage. The equivalent trap here is line and column. Moving a component
// within a file, reformatting, or extracting a helper changes every position and
// no counts. So the baseline is a map of `path -> count` and nothing else.
//
// THE RULE, applied to a base map and a head map:
//   1. No file's count may increase.  Reported as `path  before -> after`.
//   2. A file ABSENT from the base map must have a count of 0. New files start
//      clean. This is the rule that turns the curve - without it the +20 new
//      files of the last fortnight would all have been waved through.
//   3. A file whose count decreased, or which was deleted, is fine. Always.
//   4. The total is not checked. Per-file is strictly stronger and gives a
//      usable error message.
//
// TWO COMPARISONS, NOT ONE - and this is the load-bearing design choice.
// `--check` runs the SAME rule twice, mirroring how sot-refs is actually
// enforced (check-sot-refs.mjs measures reality; check-sot-baseline-ratchet.mjs
// stops you buying your way out by editing the JSON):
//
//   A. REALITY:  base baseline  vs  counts scanned from the working tree.
//      This is what stops a new literal. Nothing about it can be argued with by
//      editing a file in docs/.
//   B. RATCHET:  base baseline  vs  the committed docs/qa/hex-baseline.json.
//      This is what stops you raising a file's baselined number to make (A)
//      pass. Without (B) the gate is decoration; with (B) alone it is a
//      self-referential file check that never looks at the code.
//
// Together they give exactly the behaviour the rule describes. Adding one
// literal to a file baselined at 12 fails (A) with `12 -> 13`; bumping the
// baseline to 13 to silence it then fails (B) with `12 -> 13`. There is no door.
//
// Usage:
//   node scripts/pipeline/check-hex-ratchet.mjs --self-test
//   node scripts/pipeline/check-hex-ratchet.mjs --generate [--root <dir>]
//   node scripts/pipeline/check-hex-ratchet.mjs --check --base <base.json>
//                                               [--head <head.json>] [--root <dir>]
//   node scripts/pipeline/check-hex-ratchet.mjs --compare <base.json> <head.json>
//
// Exit 0 = no file gained a literal.  Exit 1 = one did.  Exit 2 = broken
// instrument (unparseable baseline, self-test failure, git unavailable) - a
// crash is NEVER a silent pass.

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const SCAN_ROOT = 'apps/web/src';
export const SCAN_EXTENSIONS = ['.ts', '.tsx', '.css'];

// `#` not preceded by `&` (HTML entity), then 3-8 hex digits ending at a word
// boundary. Greedy with a trailing \b so `#1234567890` matches nothing at all
// rather than yielding a bogus 8-digit hit. Lengths are filtered to 3/4/6/8
// after the match so the "wrong length" case is countable rather than invisible.
const HEX_RE = /(?<!&)#([0-9a-fA-F]{3,8})\b/g;
const VALID_LENGTHS = new Set([3, 4, 6, 8]);

/** Count hard-coded colour literals in one file's text. Pure. */
export function countHex(text) {
  let n = 0;
  HEX_RE.lastIndex = 0;
  let m;
  while ((m = HEX_RE.exec(text)) !== null) {
    if (VALID_LENGTHS.has(m[1].length)) n += 1;
  }
  return n;
}

/** Tracked, in-scope files under SCAN_ROOT, relative to `root`. */
export function scanFiles(root = '.') {
  let out;
  try {
    out = execFileSync('git', ['ls-files', '--', SCAN_ROOT], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    });
  } catch (err) {
    throw new Error(`git ls-files failed in ${root}: ${err.message}`);
  }
  return out
    .split('\n')
    .filter((f) => f && SCAN_EXTENSIONS.some((e) => f.endsWith(e)))
    .sort();
}

/**
 * Scan the working tree into a `path -> count` map.
 * Files with zero literals are OMITTED: a map entry means "this file carries
 * debt", and absent means "clean". Rule 2 depends on that distinction.
 */
export function scanTree(root = '.') {
  const counts = {};
  for (const f of scanFiles(root)) {
    let text;
    try {
      text = readFileSync(join(root, f), 'utf8');
    } catch {
      continue; // deleted between ls-files and read; nothing to count
    }
    const n = countHex(text);
    if (n > 0) counts[f] = n;
  }
  return counts;
}

/**
 * Parse a baseline document into a `path -> count` map.
 * Accepts either a bare map, or `{ _readme, files: { path: count } }`.
 * Throws (=> exit 2) on anything it cannot read as counts. A baseline that will
 * not parse must never be treated as an empty baseline, because an empty
 * baseline passes everything.
 */
export function filesOf(json, label) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label}: expected an object of path -> count`);
  }
  const map = parsed.files && typeof parsed.files === 'object' ? parsed.files : parsed;
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    if (k.startsWith('_')) continue; // `_readme` and friends are documentation
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      throw new Error(`${label}: ${k} has a non-integer count (${JSON.stringify(v)})`);
    }
    out[k] = v;
  }
  return out;
}

/**
 * THE RULE. Pure, and the single place the policy is expressed - `--check` runs
 * it twice (reality and ratchet) so both comparisons obey exactly one rule.
 */
export function ratchet(baseJson, headJson) {
  const base = filesOf(baseJson, 'base');
  const head = filesOf(headJson, 'head');
  const grew = [];
  const added = [];
  for (const [path, after] of Object.entries(head)) {
    if (after === 0) continue; // an explicit zero is clean, wherever it appears
    if (!(path in base)) {
      added.push({ path, count: after }); // rule 2
    } else if (after > base[path]) {
      grew.push({ path, before: base[path], after }); // rule 1
    }
    // rule 3: after < base[path], or path missing from head entirely -> fine
  }
  const baseTotal = Object.values(base).reduce((a, b) => a + b, 0);
  const headTotal = Object.values(head).reduce((a, b) => a + b, 0);
  return {
    ok: grew.length === 0 && added.length === 0,
    grew,
    added,
    baseTotal,
    headTotal, // rule 4: reported, never enforced
    baseFiles: Object.keys(base).length,
    headFiles: Object.keys(head).length,
  };
}

// POSITIVE CONTROL. DOCTRINE section 7 guard 1: prove the check CAN fail before
// believing it passed. Runs on EVERY invocation - it is a handful of object
// comparisons. Four of the eight cases are FAIL-cases; a self-test with only
// pass-cases proves nothing.
function selfTest() {
  const cases = [
    ['unchanged baseline passes', { 'a.tsx': 12 }, { 'a.tsx': 12 }, true],
    ['a burn-down 40 -> 12 passes', { 'a.tsx': 40 }, { 'a.tsx': 12 }, true],
    ['a deleted file passes', { 'a.tsx': 40, 'b.tsx': 3 }, { 'a.tsx': 40 }, true],
    ['a NEW file with count 0 passes', { 'a.tsx': 5 }, { 'a.tsx': 5, 'new.tsx': 0 }, true],
    ['a file rising 12 -> 13 FAILS', { 'a.tsx': 12 }, { 'a.tsx': 13 }, false],
    ['a NEW file with count 1 FAILS', { 'a.tsx': 5 }, { 'a.tsx': 5, 'new.tsx': 1 }, false],
    ['a rise masked by a fall elsewhere FAILS', { 'a.tsx': 12, 'b.tsx': 40 }, { 'a.tsx': 13, 'b.tsx': 1 }, false],
    ['{files:{...}} envelope reads the same as a bare map', { 'a.tsx': 12 }, { _readme: 'x', files: { 'a.tsx': 13 } }, false],
  ];
  for (const [name, b, h, want] of cases) {
    let got;
    try {
      got = ratchet(b, h).ok;
    } catch (err) {
      console.error(`SELF-TEST FAILED: ${name} - threw ${err.message}`);
      process.exit(2);
    }
    if (got !== want) {
      console.error(`SELF-TEST FAILED: ${name} - wanted ok=${want}, got ok=${got}`);
      process.exit(2);
    }
  }
  // The 12 -> 13 case must NAME the file and the transition, or the error message
  // is unusable and the gate gets routed around.
  const detail = ratchet({ 'a.tsx': 12 }, { 'a.tsx': 13 }).grew[0];
  if (!detail || detail.path !== 'a.tsx' || detail.before !== 12 || detail.after !== 13) {
    console.error('SELF-TEST FAILED: a growing file did not report path/before/after');
    process.exit(2);
  }
  // Unparseable input must THROW, so the CLI can exit 2. Silent-empty would pass
  // everything, which is the one failure mode a ratchet must not have.
  for (const [name, bad] of [['not JSON', '{oops'], ['an array', '[]'], ['a null', 'null'], ['a non-integer count', '{"a.tsx":"12"}']]) {
    let threw = false;
    try {
      ratchet('{}', bad);
    } catch {
      threw = true;
    }
    if (!threw) {
      console.error(`SELF-TEST FAILED: ${name} did not throw`);
      process.exit(2);
    }
  }
  // The counter itself, on the four rules it encodes.
  const counterCases = [
    ['a six-digit hex counts', 'color: #E5E7EB;', 1],
    ['a three-digit hex counts', 'color: #fff;', 1],
    ['a four-digit hex counts', 'color: #fff8;', 1],
    ['an eight-digit hex counts', 'color: #E5E7EB80;', 1],
    ['a five-digit run does not count (not a CSS colour length)', 'x = "#abcde";', 0],
    ['a seven-digit run does not count', 'x = "#abcdef0";', 0],
    ['an HTML entity does not count', 'return <span>&#8593;</span>;', 0],
    ['a decimal entity that looks like a hex does not count', '&#160;', 0],
    ['a hex in a comment DOES count', '/* was #ff0000 */', 1],
    ['a var() fallback counts', 'border: 1px solid var(--border, #e5e7eb);', 1],
    ['two on one line count twice', 'a:#fff;b:#000;', 2],
    ['a nine-digit run counts nothing', '#0123456789', 0],
    ['a bare hash counts nothing', 'const id = "#";', 0],
  ];
  for (const [name, text, want] of counterCases) {
    const got = countHex(text);
    if (got !== want) {
      console.error(`SELF-TEST FAILED (counter): ${name} - wanted ${want}, got ${got}`);
      process.exit(2);
    }
  }
  return { rule: cases.length, counter: counterCases.length };
}

// ---------------------------------------------------------------- CLI

function readBaseline(path, label) {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`could not read ${label} baseline ${path}: ${err.message}`);
  }
}

function report(result, heading) {
  for (const g of result.grew) {
    console.error(`  GREW   ${g.path}  ${g.before} -> ${g.after}`);
  }
  for (const a of result.added) {
    console.error(`  NEW    ${a.path}  0 -> ${a.count}  (a file absent from the baseline must be clean)`);
  }
  console.error(`::error::${heading}`);
}

// Run the CLI only when INVOKED, never on import. The test suite imports the
// pure functions above; without this guard that import would execute the arg
// parser, hit the usage branch and process.exit(2) mid-suite.
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main(process.argv.slice(2));
}

function main(args) {
// The positive control runs on EVERY invocation, before anything else can
// report a pass. A broken instrument must go red at the commit that broke it.
const selfTestCounts = selfTest();

function flag(name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}

if (args[0] === '--self-test') {
  console.log(
    `hex ratchet self-test: ${selfTestCounts.rule} rule cases (4 pass, 4 fail) + ` +
    `4 broken-input cases + ${selfTestCounts.counter} counter cases passed.`,
  );
  process.exit(0);
}

const root = flag('--root', '.');

if (args[0] === '--generate') {
  let counts;
  try {
    counts = scanTree(root);
  } catch (err) {
    console.error(`::error::hex ratchet could not scan the tree: ${err.message}`);
    process.exit(2);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  let commit = 'unknown';
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch { /* not fatal for a generate */ }
  const doc = {
    _readme:
      `Hard-coded colour literals per file in ${SCAN_ROOT}, recorded ${new Date().toISOString().slice(0, 10)} @${commit}: ` +
      `${total} literals across ${Object.keys(counts).length} tracked .ts/.tsx/.css files. ` +
      'THIS FILE MAY ONLY SHRINK. CI rejects any PR in which a file gains a literal, or in which a file ' +
      'absent from this baseline carries one - new files start clean. A file that loses literals, or is ' +
      'deleted, is always fine. The total is not checked; per-file is strictly stronger and names the offender. ' +
      'BURN-DOWN is the job of whoever happens to open one of these files: replace the literals with the ' +
      'tokens in apps/web/src/styles/tokens.css, then regenerate this file in the SAME PR with ' +
      '`node scripts/pipeline/check-hex-ratchet.mjs --generate > docs/qa/hex-baseline.json`. That mirrors how ' +
      'Station 05 burns down docs/qa/sot-refs-baseline.json. THE COUNT IS NOT A TODO LIST. A large share of ' +
      'these literals are fallbacks in `var(--token, #hex)` where the token is defined NOWHERE, so the hex is ' +
      'what actually renders, in BOTH themes - MEASURED 2026-09-07: 590 such literals across 120 distinct ' +
      'token->hex pairs, led by `--border` (174 uses, 50+ files; the real token is `--border-default`) and ' +
      '`--surface-muted` (116 uses; the real token is `--surface-subtle`). Those are live theme defects, not ' +
      'style debt, and are the first thing to burn down. Keyed on path only, NEVER on line or column: moving ' +
      'a component within a file, reformatting, or extracting a helper changes every position and no counts - ' +
      'see the #1405 lesson in the header of scripts/pipeline/check-sot-baseline-ratchet.mjs. ' +
      'See scripts/pipeline/check-hex-ratchet.mjs for the counter rules and their measured justifications.',
    generated: new Date().toISOString().slice(0, 10),
    commit,
    total,
    files: counts,
  };
  process.stdout.write(JSON.stringify(doc, null, 2) + '\n');
  process.exit(0);
}

if (args[0] === '--compare') {
  const [, basePath, headPath] = args;
  if (!basePath || !headPath) {
    console.error('usage: check-hex-ratchet.mjs --compare <base.json> <head.json>');
    process.exit(2);
  }
  let result;
  try {
    result = ratchet(readBaseline(basePath, 'base'), readBaseline(headPath, 'head'));
  } catch (err) {
    console.error(`::error::hex ratchet could not read a baseline: ${err.message}`);
    process.exit(2); // broken instrument - never silently a pass
  }
  if (!result.ok) {
    report(result, 'A file gained a hard-coded colour literal. See the lines above.');
    process.exit(1);
  }
  console.log(`hex ratchet (compare): OK - ${result.baseTotal} -> ${result.headTotal} literals.`);
  process.exit(0);
}

if (args[0] === '--check') {
  const basePath = flag('--base');
  const headPath = flag('--head', join(root, 'docs/qa/hex-baseline.json'));
  if (!basePath) {
    console.error('usage: check-hex-ratchet.mjs --check --base <base.json> [--head <head.json>] [--root <dir>]');
    process.exit(2);
  }

  let base, tree, headDoc;
  try {
    base = readBaseline(basePath, 'base');
    tree = scanTree(root);
    if (!existsSync(headPath)) {
      throw new Error(`the head baseline ${headPath} does not exist - it may not be deleted while the gate is on`);
    }
    headDoc = readBaseline(headPath, 'head');
    // Parse both up front so a malformed baseline is exit 2, not a comparison.
    filesOf(base, 'base');
    filesOf(headDoc, 'head');
  } catch (err) {
    console.error(`::error::hex ratchet is broken, not passing: ${err.message}`);
    process.exit(2);
  }

  // (A) REALITY. The base baseline against what is actually in the tree.
  const reality = ratchet(base, tree);
  // (B) RATCHET. The base baseline against the committed head baseline.
  const file = ratchet(base, headDoc);

  if (!reality.ok) {
    report(
      reality,
      'apps/web/src gained a hard-coded colour literal. Use a token from ' +
      'apps/web/src/styles/tokens.css instead of a hex - sot/01 SECTION 5. If you are BURNING DOWN, ' +
      'regenerate the baseline in this PR: node scripts/pipeline/check-hex-ratchet.mjs --generate > docs/qa/hex-baseline.json',
    );
  }
  if (!file.ok) {
    report(
      file,
      'docs/qa/hex-baseline.json raised a file\'s count. The baseline may only SHRINK. ' +
      'Remove the literal instead of baselining it.',
    );
  }
  if (!reality.ok || !file.ok) process.exit(1);

  console.log(
    `hex ratchet: OK - tree has ${reality.headTotal} literals in ${reality.headFiles} files ` +
    `(baseline allows ${reality.baseTotal} in ${reality.baseFiles}); no file grew, no new file carries one. ` +
    `Self-test: ${selfTestCounts.rule + selfTestCounts.counter + 4} cases passed.`,
  );
  process.exit(0);
}

console.error('usage: check-hex-ratchet.mjs --self-test | --generate | --check --base <f> | --compare <base> <head>');
process.exit(2);
}
