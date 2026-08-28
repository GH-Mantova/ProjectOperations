#!/usr/bin/env node
/**
 * check-d-register.mjs
 *
 * Scans the repository for D<n> citations and warns about any that are NOT
 * defined as rows in the decision register in sot/05-decisions-and-lessons.md.
 *
 * MODE: WARN_ONLY — prints findings, exits 0. Slice 5 will flip this to FAIL.
 *
 * Usage:
 *   node scripts/pipeline/check-d-register.mjs
 *
 * Exit codes:
 *   0 — always (WARN_ONLY mode). Findings are printed but do not block.
 *
 * Exclusions (measured false positives — do not add without justifying in PR body):
 *   - docs/pr-prompts/superseded/**          archived history, not live citations
 *   - sot/05-decisions-and-lessons.md        defines the register rows
 *   - scripts/workflows/vendor/**            vendored third-party minified JS
 *   - TFM-D* / EA-D*                         plan-scoped prefixed series
 *   - W<n>                                   dashboard widget IDs (W1, W2 ...)
 *   - "PR D<n>"                              sot/06 work-breakdown chain labels
 *   - mergeCells("A1:D1") context            spreadsheet cell range, not a decision
 *   - ZZTEST-BP0A3-D1 / ZZTEST-BP0A3-D2     test fixture project numbers
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// ---------------------------------------------------------------------------
// The symbol slice 5 looks for to flip behaviour
// ---------------------------------------------------------------------------
export const D_REGISTER_MODE = "WARN_ONLY";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RESET  = "\x1b[0m";
const YELLOW = "\x1b[33m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";

function warn(msg) {
  process.stderr.write(YELLOW + "[WARN] " + RESET + msg + "\n");
}

// ---------------------------------------------------------------------------
// Parse the register from sot/05-decisions-and-lessons.md
//
// The register table rows look like:
//   | D1 | ... |
//   | D48 | ... |
//
// We also accept rows with status RESCINDED — those D-numbers still exist in
// the register (they just must not be cited as authority).
// ---------------------------------------------------------------------------

/**
 * @param {string} repoRoot
 * @returns {Set<string>} e.g. {"D1","D2",...,"D55"}
 */
function parseRegister(repoRoot) {
  const sot05Path = join(repoRoot, "sot", "05-decisions-and-lessons.md");
  const text = readFileSync(sot05Path, "utf8");
  const registered = new Set();
  // Match table rows: | D<n> | ... |
  // The row must start with | D followed by digits then |
  const rowRe = /^\|\s*(D\d+)\s*\|/gm;
  let match;
  while ((match = rowRe.exec(text)) !== null) {
    registered.add(match[1]);
  }
  return registered;
}

// ---------------------------------------------------------------------------
// File-walk (synchronous, recursive)
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
]);

const SCAN_EXTENSIONS = new Set([
  ".ts", ".tsx", ".mjs", ".js", ".cjs",
  ".md", ".yaml", ".yml", ".json",
]);

/**
 * Walk a directory and yield file paths.
 * @param {string} dir absolute path
 * @param {string[]} acc collector
 */
function collectFiles(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, acc);
    } else if (entry.isFile()) {
      const dot = entry.name.lastIndexOf(".");
      if (dot !== -1) {
        const ext = entry.name.slice(dot);
        if (SCAN_EXTENSIONS.has(ext)) acc.push(full);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Per-line exclusion logic
//
// A line that matches \bD\d+\b may still be a false positive if:
//   1. The D<n> is preceded by a word char (e.g. "D365-parity", "TFM-D3", "EA-D5")
//   2. The D<n> is followed by a word char (e.g. "D365", "D0a", "D9b")
//   3. The line contains "mergeCells" and the match is "D1" (spreadsheet range)
//   4. The match appears inside a ZZTEST-BP0A3-D* fixture string
//   5. The token is preceded by "PR " (sot/06 work-breakdown chain: "PR D1", "PR D2")
//   6. The number is >= 100 (D100, D365, D35400 etc. — not in Marco's 1-55 register range)
//
// Note: "W<n>" is handled by the word-char guard — W1/W2 are \bW\d+\b tokens,
// not D<n> tokens, so they never reach this check.
// ---------------------------------------------------------------------------

/**
 * Given a line and a candidate D<n> match with its index, decide if this is
 * a genuine unregistered citation (true) or a known false positive (false).
 *
 * @param {string} line
 * @param {number} matchIndex  index of the 'D' in `line`
 * @param {string} token       e.g. "D9" or "D48"
 * @param {Set<string>} registered
 * @returns {{ isCitation: boolean, reason?: string }}
 */
function classify(line, matchIndex, token, registered) {
  const num = parseInt(token.slice(1), 10);

  // Numbers >= 100 are never in Marco's 1-55 register range
  if (num >= 100) {
    return { isCitation: false, reason: "number >= 100 (not Marco's register range)" };
  }

  // Check for named plan-scoped prefixes: TFM-D* and EA-D*
  // These are the ONLY dash-prefixed series that are explicitly excluded.
  // A generic "any letter before dash" rule would be too broad.
  const charBefore = matchIndex > 0 ? line[matchIndex - 1] : "";
  if (charBefore === "-") {
    // Extract the token immediately before the dash
    const beforeDash = line.slice(0, matchIndex - 1);
    const prefixMatch = /([A-Z]+)$/.exec(beforeDash);
    const prefix = prefixMatch ? prefixMatch[1] : "";
    // Only exclude known plan-scoped prefixes
    if (prefix === "TFM" || prefix === "EA") {
      return { isCitation: false, reason: "plan-scoped prefix (" + prefix + "-D*)" };
    }
    // Other dash-prefixed patterns (e.g. ZZTEST-BP0A3-D1 handled separately) fall through
  }

  // Word-char after the token's last digit — e.g. "D365x" or "D9b"
  const afterIndex = matchIndex + token.length;
  const charAfter = afterIndex < line.length ? line[afterIndex] : "";
  if (/[a-zA-Z_]/.test(charAfter)) {
    return { isCitation: false, reason: "token followed by letter (not a standalone ID)" };
  }

  // mergeCells("A1:D1") context — spreadsheet range
  if (line.includes("mergeCells") && token === "D1") {
    return { isCitation: false, reason: "spreadsheet cell range in mergeCells()" };
  }

  // ZZTEST-BP0A3-D* test fixture
  if (line.includes("ZZTEST-BP0A3-D")) {
    return { isCitation: false, reason: "ZZTEST-BP0A3 test fixture" };
  }

  // "PR D<n>" — sot/06 work-breakdown chain labels
  // Match "PR D" immediately before the token (with at most one space)
  const prPrefix = line.slice(0, matchIndex);
  if (/\bPR\s+$/.test(prPrefix)) {
    return { isCitation: false, reason: "PR D<n> work-breakdown chain label" };
  }

  // If it IS registered, it's a valid known citation
  if (registered.has(token)) {
    return { isCitation: false, reason: "registered" };
  }

  // Unregistered citation — this is the warning case
  return { isCitation: true };
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

/**
 * Run the checker against a real repo on disk.
 *
 * Exported so tests can call it with temp directories.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot   absolute path to repo root
 * @param {Set<string>} [opts.registered]  pre-parsed register (for tests)
 * @returns {{ findings: Array<{file:string, line:number, token:string, text:string}> }}
 */
export function runChecker({ repoRoot, registered } = {}) {
  const root = repoRoot ?? resolve(process.cwd());
  const reg = registered ?? parseRegister(root);

  // Paths to exclude entirely (relative to repo root, normalised to forward slashes)
  const EXCLUDED_REL_PREFIXES = [
    "docs/pr-prompts/superseded/",
    "sot/05-decisions-and-lessons.md",
    "scripts/workflows/vendor/",
  ];

  const files = [];
  collectFiles(root, files);

  const findings = [];

  for (const file of files) {
    const rel = relative(root, file).replace(/\\/g, "/");

    // Whole-file exclusions
    if (EXCLUDED_REL_PREFIXES.some((prefix) => rel === prefix || rel.startsWith(prefix))) {
      continue;
    }

    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const lines = text.split("\n");
    // We re-build the token regex per-file scan (stateless, no lastIndex issues)
    const tokenRe = /\bD(\d+)\b/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineText = lines[lineIdx];
      tokenRe.lastIndex = 0;
      let match;
      while ((match = tokenRe.exec(lineText)) !== null) {
        const token = match[0];    // e.g. "D48"
        const matchIdx = match.index;

        const { isCitation } = classify(lineText, matchIdx, token, reg);
        if (isCitation) {
          findings.push({
            file: rel,
            line: lineIdx + 1,
            token,
            text: lineText.trim(),
          });
        }
      }
    }
  }

  return { findings };
}

// ---------------------------------------------------------------------------
// CLI entry point (only runs when executed directly, not when imported)
// ---------------------------------------------------------------------------

const isMain =
  // node check-d-register.mjs (process.argv[1] is the script path)
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.url.replace(/^file:\/\/\/?/, "").replace(/^\/([A-Za-z]:)/, "$1"));

if (isMain) {
  const repoRoot = resolve(process.cwd());
  let registered;
  try {
    registered = parseRegister(repoRoot);
  } catch (err) {
    process.stderr.write("BROKEN: could not parse sot/05-decisions-and-lessons.md: " + err.message + "\n");
    process.exit(0); // WARN_ONLY: even parse failures don't block
  }

  console.log("=== D-register checker (mode: " + D_REGISTER_MODE + ") ===");
  console.log("Register loaded: " + registered.size + " D-IDs (" +
    [...registered].sort((aVal, bVal) => parseInt(aVal.slice(1)) - parseInt(bVal.slice(1))).join(", ") + ")");
  console.log("");

  const { findings } = runChecker({ repoRoot, registered });

  if (findings.length === 0) {
    console.log("OK — no unregistered D<n> citations found.");
  } else {
    console.log(YELLOW + BOLD + "WARN — " + findings.length + " unregistered D<n> citation(s) found:" + RESET);
    console.log("");
    for (const finding of findings) {
      console.log(
        "  " + BOLD + finding.file + ":" + finding.line + RESET +
        "  " + YELLOW + finding.token + RESET
      );
      console.log("  " + DIM + finding.text + RESET);
      console.log("");
    }
    console.log(
      "These are WARNINGS only (" + D_REGISTER_MODE + "). " +
      "Slice 5 will flip D_REGISTER_MODE to FAIL after triage."
    );
  }

  // WARN_ONLY: always exit 0
  process.exit(0);
}
