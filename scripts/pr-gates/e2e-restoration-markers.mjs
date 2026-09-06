#!/usr/bin/env node
// E2E restoration-markers ratchet.
//
// Slice 2 of the scope-card redesign migrated the acceptance suite onto the
// WBS table and could not keep every assertion, because the affordances they
// exercised had not been built yet. Each dropped assertion was left marked
// with the plant constant of the slice that would restore it:
//
//   // TODO(SCOPE_WBS_PLANT_V1): restore the plant-pill assertions when
//   // slice 4 lands the column group.
//
// SCOPE_WASTE_SECTION_V1 is the LAST slice in that chain. Once it is on
// origin/main every affordance exists, so every marker is restorable and a
// remaining marker is coverage debt nobody is going to pay. This script is
// the ratchet that stops one being left behind.
//
// CONTRACT
//   exit 0  while SCOPE_WASTE_SECTION_V1 is NOT yet on origin/main
//           (the chain is still running - outstanding markers are expected
//           and correct);
//   exit 1  once it IS, listing every file and line still carrying a
//           `TODO(SCOPE_` marker.
//
// It is deliberately its OWN CI job and not a line inside pr-gates.mjs.
// CP-26 already demonstrated that folding a new assertion into that script
// makes one failure surface as two red checks and obscures which one broke.
//
// It has no label gate, no front-matter opt-in and no changed-path filter.
// A ratchet that only runs when someone remembers to run it is not a ratchet.
//
// Node built-ins only. ASCII-only output.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

const SCAN_DIR = join(repoRoot, "tests", "e2e", "pr-acceptance");
const MARKER = "TODO(SCOPE_";
const ARMING_CONSTANT = "SCOPE_WASTE_SECTION_V1";
const ARMING_PATHSPEC = "apps/web/src/pages/tendering";

function out(msg) {
  process.stdout.write(`e2e-restoration-markers: ${msg}\n`);
}

/** Every file under `dir`, recursively. */
function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

/** Every `TODO(SCOPE_` occurrence, as {file, line, text}. */
function findMarkers() {
  if (!existsSync(SCAN_DIR)) return [];
  const hits = [];
  for (const file of walk(SCAN_DIR)) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      // Unreadable (binary, permissions). Nothing to assert about it.
      continue;
    }
    if (!content.includes(MARKER)) continue;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(MARKER)) {
        hits.push({
          file: relative(repoRoot, file).split(sep).join("/"),
          line: i + 1,
          text: lines[i].trim(),
        });
      }
    }
  }
  return hits;
}

/**
 * Is the arming constant on origin/main yet?
 *
 * Returns true / false, or null when git cannot answer (no origin/main ref,
 * shallow checkout with no such object, git missing). The caller decides what
 * an unknown answer means - it only matters when markers actually exist.
 */
function armedOnMain() {
  try {
    // Does the ref exist at all? `git rev-parse --verify` is quiet and cheap.
    execFileSync("git", ["rev-parse", "--verify", "--quiet", "origin/main"], {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    return null;
  }
  try {
    // grep the tree of origin/main, not the working copy. Exit 0 = found,
    // exit 1 = not found, anything else = a real error.
    execFileSync(
      "git",
      ["grep", "-q", ARMING_CONSTANT, "origin/main", "--", ARMING_PATHSPEC],
      { cwd: repoRoot, stdio: ["ignore", "ignore", "ignore"] }
    );
    return true;
  } catch (err) {
    if (err && err.status === 1) return false;
    return null;
  }
}

const markers = findMarkers();

// No markers is the terminal state this ratchet exists to reach and hold. It
// is green regardless of whether the chain has landed, and it can never fail
// spuriously on a checkout where origin/main is unavailable.
if (markers.length === 0) {
  out(`no ${MARKER} markers under tests/e2e/pr-acceptance - coverage debt is zero.`);
  process.exit(0);
}

const armed = armedOnMain();

if (armed === false) {
  out(
    `${markers.length} outstanding ${MARKER} marker(s), but ${ARMING_CONSTANT} is not on ` +
      `origin/main yet - the redesign chain is still running, so these are expected.`
  );
  for (const m of markers) out(`  ${m.file}:${m.line}: ${m.text}`);
  out("PASS (ratchet not yet armed).");
  process.exit(0);
}

if (armed === null) {
  // Markers exist AND we cannot prove the chain is still running. Fail closed:
  // the alternative is a ratchet that quietly stops ratcheting whenever git is
  // unhappy, which is the failure mode this whole mechanism exists to prevent.
  out(
    `cannot determine whether ${ARMING_CONSTANT} is on origin/main (no origin/main ref, ` +
      `or git unavailable), and ${markers.length} marker(s) are outstanding. Failing closed.`
  );
  out("Fix: fetch origin/main (actions/checkout with fetch-depth: 0) and re-run.");
  for (const m of markers) out(`  ${m.file}:${m.line}: ${m.text}`);
  process.exit(1);
}

out(
  `${ARMING_CONSTANT} is on origin/main - every affordance the migrated assertions need now ` +
    `exists, so ${markers.length} outstanding ${MARKER} marker(s) are unpaid coverage debt:`
);
for (const m of markers) out(`  ${m.file}:${m.line}: ${m.text}`);
out("");
out("Restore each assertion against the finished UI. If one is genuinely obsolete because");
out("the redesign removed the behaviour it tested, delete it WITH a one-line reason in the");
out("PR body - silent deletion is what this ratchet exists to prevent.");
process.exit(1);
