/**
 * check-lessons.mjs - run every lesson's `regressed_when` gate and shout if a lesson we already
 * paid for has come back.
 *
 * POLARITY WARNING - this is the OPPOSITE of check-backlog / check-escalations:
 *   exit 0 from the gate  -> the BAD state is back  -> REGRESSED (alarm)
 *   non-zero from the gate -> the fix is holding    -> fine, boring, expected
 * Getting this backwards turns the alarm into a klaxon that fires on every healthy repo and gets
 * muted within a week. If you touch this file, re-read the header of LESSONS.yaml first.
 *
 * Exit codes:
 *   0 - ran cleanly, no regressions
 *   1 - malformed register, or the evaluator failed self-test (NO readings reported)
 *   2 - AT LEAST ONE LESSON HAS REGRESSED. Non-zero on purpose so a scheduled station or CI job
 *       cannot quietly ignore it.
 *
 * Usage:  node scripts/pipeline/check-lessons.mjs [--path docs/pipeline/LESSONS.yaml]
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { runGate, selfTest, parseItems, assertUniformItemIndent } from "./gate-eval.mjs";

const repoRoot = process.cwd();
const argIdx = process.argv.indexOf("--path");
const registerPath = argIdx !== -1 && process.argv[argIdx + 1]
  ? process.argv[argIdx + 1]
  : path.join("docs", "pipeline", "LESSONS.yaml");

const abs = path.resolve(repoRoot, registerPath);
if (!existsSync(abs)) {
  console.error("BROKEN: lessons ledger not found at " + registerPath);
  process.exit(1);
}

const st = selfTest(repoRoot);
if (!st.ok) {
  console.error("BROKEN: gate evaluator failed self-test (" + st.detail + "). Reporting nothing.");
  process.exit(1);
}

const text = readFileSync(abs, "utf8");
const indent = assertUniformItemIndent(text);
if (!indent.ok) {
  console.error("BROKEN: " + registerPath + " - " + indent.detail + ". Reporting nothing.");
  process.exit(1);
}

const items = parseItems(text);
const regressed = [];
const holding = [];
const broken = [];

for (const it of items) {
  if (!it.regressed_when) {
    broken.push({ it, detail: "no regressed_when gate - this lesson cannot be kept, only remembered" });
    continue;
  }
  const r = runGate(it.regressed_when, repoRoot);
  if (r.state === "PASS") regressed.push(it);        // bad state present
  else if (r.state === "FAIL") holding.push(it);     // fix still in place
  else broken.push({ it, detail: r.detail });
}

console.log("=== LESSONS --- " + items.length + " lesson(s) with executable regression tests");
console.log("");

if (regressed.length) {
  console.log("!!! REGRESSED --- a lesson we already paid for has come back. Fix before shipping.");
  for (const it of regressed) {
    console.log("  [" + it.id + "] " + (it.title || ""));
    if (it.cost) console.log("        what it cost last time: " + it.cost.trim());
    if (it.fix_ref) console.log("        original fix: " + it.fix_ref);
    console.log("        regression test that just fired: " + it.regressed_when);
  }
  console.log("");
}

if (broken.length) {
  console.log(">>> BROKEN GATES --- instrument failure, NOT an all-clear. A regression can hide here.");
  for (const b of broken) console.log("  [" + b.it.id + "] " + b.detail);
  console.log("");
}

console.log("holding=" + holding.length + "  regressed=" + regressed.length + "  broken=" + broken.length);
if (regressed.length === 0 && broken.length === 0) {
  console.log("All lessons holding. This is the boring, correct outcome.");
}

process.exit(regressed.length > 0 ? 2 : 0);
