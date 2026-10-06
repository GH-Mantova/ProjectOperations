#!/usr/bin/env node
// check-instrument-lane.mjs — INSTRUMENT_LANE_V1
//
// Checks whether every changed file in a git range falls within the instrument-lane allowlist.
//
// USAGE
//   node scripts/pipeline/check-instrument-lane.mjs --range <base>...<head>
//
// EXIT CODES
//   0  verdict produced (IN_LANE or OUT_OF_LANE) — being out of lane is normal, not a failure
//   2  [CANNOT MEASURE] — git range could not be read, or controls failed
//      NEVER 0 when nothing was read. A lane check that silently passes when it cannot see the
//      diff is worse than no check: it reports IN_LANE forever.
//
// VERDICT LINE
//   The last line printed is always one of:
//     INSTRUMENT_LANE: IN_LANE
//     INSTRUMENT_LANE: OUT_OF_LANE
//   (except on exit 2, where [CANNOT MEASURE] is printed instead)
//
// CONTROLS (DOCTRINE §7)
//   Printed before any verdict. One in-lane path and one out-of-lane path are classified and
//   the checker exits 2 if either misclassifies — a lane checker that cannot detect an
//   out-of-lane path is no check at all.
//
// DOCTRINE section 7 — an instrument that cannot fail is not evidence.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Minimal glob matching (no external dependencies)
// ---------------------------------------------------------------------------

/**
 * Match a path against a glob pattern using only built-in string operations.
 * Supports `**` (any path segment or segments) and `*` (any characters within one segment).
 * This is sufficient for the tests pattern `scripts/pipeline/__tests__/**`.
 *
 * Converts the glob to a regex for matching.
 */
function globMatch(filePath, pattern) {
  // Escape regex metacharacters except * which we handle specially
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")  // escape regex specials (not *)
    .replace(/\*\*/g, "\x00")               // temporarily replace **
    .replace(/\*/g, "[^/]*")               // * = any chars except /
    .replace(/\x00/g, ".*");               // ** = any chars including /
  const regex = new RegExp("^" + regexStr + "$");
  return regex.test(filePath);
}

// ---------------------------------------------------------------------------
// Allowlist loading
// ---------------------------------------------------------------------------

/**
 * Load instrument-lane.json from the repo root.
 * Returns { files: string[], tests: string[], _allowlistPath: string }.
 */
function loadAllowlist(repoRoot) {
  const path = join(repoRoot, "scripts", "pipeline", "instrument-lane.json");
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error("[CANNOT MEASURE] instrument-lane.json could not be read: " + err.message);
  }
  if (!parsed || !Array.isArray(parsed.files) || !Array.isArray(parsed.tests)) {
    throw new Error("[CANNOT MEASURE] instrument-lane.json is malformed — needs `files` and `tests` arrays");
  }
  return { files: parsed.files, tests: parsed.tests, _allowlistPath: path };
}

// ---------------------------------------------------------------------------
// Path classification
// ---------------------------------------------------------------------------

const ALLOWLIST_RELATIVE = "scripts/pipeline/instrument-lane.json";

/**
 * Classify a single changed path against the allowlist.
 * Returns "in-lane" | "out-of-lane".
 *
 * Rules:
 *   - If the path IS instrument-lane.json itself -> out-of-lane (changing the allowlist is
 *     always Marco's decision, even if it's in the files list).
 *   - If the path matches a file in `files` (exact, case-sensitive) -> in-lane.
 *   - If the path matches a `tests` glob -> in-lane.
 *   - Otherwise -> out-of-lane.
 */
export function classifyPath(filePath, allowlist) {
  const { files, tests } = allowlist;

  // Normalise separators to forward slash for consistent matching
  const normalised = filePath.replace(/\\/g, "/");

  // The allowlist file itself is always out of lane — changing it is Marco's call
  if (normalised === ALLOWLIST_RELATIVE) return "out-of-lane";

  // Exact file match
  if (files.includes(normalised)) return "in-lane";

  // Glob match against tests patterns
  for (const pattern of tests) {
    if (globMatch(normalised, pattern)) return "in-lane";
  }

  return "out-of-lane";
}

// ---------------------------------------------------------------------------
// Git diff
// ---------------------------------------------------------------------------

/**
 * Get the list of changed paths for a git range.
 * Includes both sides of renames, deletes, and adds.
 * Returns string[] of relative paths (forward-slash separated).
 * Throws if the range cannot be read.
 */
function getChangedPaths(range, repoRoot) {
  // --name-only with --diff-filter=ACDMRT covers adds, copies, deletes, modifications, renames (both sides)
  // For renames we need --name-status to get both the old and new names.
  // Use --name-status then parse it to get all path tokens.
  let output;
  try {
    output = execFileSync(
      "git",
      ["diff", "--name-status", range],
      { cwd: repoRoot, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
  } catch (err) {
    throw new Error("[CANNOT MEASURE] git diff failed for range " + JSON.stringify(range) + ": " +
      (err.stderr || err.message));
  }

  const paths = new Set();
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Each line is: STATUS\tpath  or  RNNNN\told\tnew
    const parts = trimmed.split("\t");
    if (parts.length >= 2) {
      // For renames: parts[0]=R100, parts[1]=old, parts[2]=new — include both
      for (let i = 1; i < parts.length; i++) {
        const p = parts[i].trim().replace(/\\/g, "/");
        if (p) paths.add(p);
      }
    }
  }
  return [...paths];
}

// ---------------------------------------------------------------------------
// Controls (DOCTRINE §7)
// ---------------------------------------------------------------------------

/**
 * Run two controls before producing any verdict:
 *   1. An in-lane path (status-sweep.ps1) must classify as in-lane.
 *   2. An out-of-lane path (scripts/pr-watcher/index.mjs) must classify as out-of-lane.
 *
 * These are paths known to exist in the allowlist (in-lane) and not exist (out-of-lane).
 * Returns true if both controls pass.
 */
export function runControls(allowlist) {
  const inLaneProbe = "scripts/pipeline/status-sweep.ps1";
  const outOfLaneProbe = "scripts/pr-watcher/index.mjs";

  const inLaneResult = classifyPath(inLaneProbe, allowlist);
  const outOfLaneResult = classifyPath(outOfLaneProbe, allowlist);

  const inLanePass = inLaneResult === "in-lane";
  const outOfLanePass = outOfLaneResult === "out-of-lane";

  console.log(
    "controls: positive(in-lane path classifies as in-lane)=" + inLanePass +
    "  negative(out-of-lane path classifies as out-of-lane)=" + outOfLanePass
  );

  if (!inLanePass) {
    console.error("  control MISBEHAVED: " + JSON.stringify(inLaneProbe) +
      " expected in-lane, got " + inLaneResult);
  }
  if (!outOfLanePass) {
    console.error("  control MISBEHAVED: " + JSON.stringify(outOfLaneProbe) +
      " expected out-of-lane, got " + outOfLaneResult);
  }

  return inLanePass && outOfLanePass;
}

// ---------------------------------------------------------------------------
// Main verdict
// ---------------------------------------------------------------------------

/**
 * Determine the lane verdict for a set of changed paths.
 * Returns { verdict: "IN_LANE" | "OUT_OF_LANE", offending: string[] }.
 *
 * IN_LANE requires:
 *   - At least one changed path (empty diff -> OUT_OF_LANE, nothing proven)
 *   - No path is instrument-lane.json
 *   - Every path classifies as in-lane
 */
export function computeVerdict(changedPaths, allowlist) {
  if (changedPaths.length === 0) {
    return { verdict: "OUT_OF_LANE", offending: [], reason: "empty diff — nothing proven" };
  }

  const offending = changedPaths.filter((p) => classifyPath(p, allowlist) === "out-of-lane");

  if (offending.length === 0) {
    return { verdict: "IN_LANE", offending: [] };
  }
  return { verdict: "OUT_OF_LANE", offending };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  const rangeIdx = args.indexOf("--range");
  const range = rangeIdx !== -1 ? args[rangeIdx + 1] : null;
  const repoRoot = args.find((a) => !a.startsWith("--") && a !== (range ?? "__no__")) ?? resolve(".");

  // Load allowlist
  let allowlist;
  try {
    allowlist = loadAllowlist(repoRoot);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  // Run controls FIRST — exit 2 if they fail
  if (!runControls(allowlist)) {
    console.error("[CANNOT MEASURE] check-instrument-lane failed its own controls — not reporting on the real diff.");
    process.exit(2);
  }

  // Require --range
  if (!range) {
    console.error("[CANNOT MEASURE] --range <base>...<head> is required");
    process.exit(2);
  }

  // Get changed paths
  let changedPaths;
  try {
    changedPaths = getChangedPaths(range, repoRoot);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  // Compute verdict
  const { verdict, offending, reason } = computeVerdict(changedPaths, allowlist);

  if (verdict === "IN_LANE") {
    console.log("All " + changedPaths.length + " changed path(s) are in the instrument lane:");
    for (const p of changedPaths) console.log("  IN_LANE: " + p);
  } else {
    if (reason) {
      console.log("OUT_OF_LANE: " + reason);
    }
    if (offending.length > 0) {
      console.log(offending.length + " path(s) are outside the instrument lane:");
      for (const p of offending) console.log("  OUT_OF_LANE: " + p);
    }
    const inLane = changedPaths.filter((p) => classifyPath(p, allowlist) === "in-lane");
    if (inLane.length > 0) {
      console.log(inLane.length + " path(s) are in the instrument lane:");
      for (const p of inLane) console.log("  IN_LANE: " + p);
    }
  }

  // VERDICT LINE — always the LAST line printed
  console.log("INSTRUMENT_LANE: " + verdict);
  process.exit(0);
}
