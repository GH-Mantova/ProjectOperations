/**
 * check-escalations.mjs - run every escalation's `resolved_when` gate against the CURRENT
 * checkout and report which are genuinely still open.
 *
 * Replaces the question "which PR closed this?" (wrong - arming PRs, doc PRs and revert PRs all
 * merge) with "is the artifact on main?" (right - it is a command, not a judgement).
 *
 * Exit codes:
 *   0 - ran cleanly; findings are on stdout
 *   1 - the register is malformed, or the evaluator failed its own self-test. NO readings are
 *       reported in that case, because a checker that cannot prove it works must not be believed.
 *
 * Usage:  node scripts/pipeline/check-escalations.mjs [--path docs/pr-prompts/ESCALATIONS.yaml]
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { runGate, selfTest, parseItems, assertUniformItemIndent } from "./gate-eval.mjs";

const repoRoot = process.cwd();
const argIdx = process.argv.indexOf("--path");
const registerPath = argIdx !== -1 && process.argv[argIdx + 1]
  ? process.argv[argIdx + 1]
  : path.join("docs", "pr-prompts", "ESCALATIONS.yaml");

const abs = path.resolve(repoRoot, registerPath);
if (!existsSync(abs)) {
  console.error("BROKEN: escalation register not found at " + registerPath);
  process.exit(1);
}

// Prove the instrument before trusting a single reading.
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
if (items.length === 0) {
  console.log("=== ESCALATIONS --- register is empty (nothing waiting on Marco)");
  process.exit(0);
}

const open = [];
const resolved = [];
const broken = [];

for (const it of items) {
  if (!it.resolved_when) {
    broken.push({ it, detail: "no resolved_when gate - it cannot be closed by evidence" });
    continue;
  }
  const r = runGate(it.resolved_when, repoRoot);
  if (r.state === "PASS") resolved.push(it);
  else if (r.state === "FAIL") open.push(it);
  else broken.push({ it, detail: r.detail });
}

console.log("=== ESCALATIONS --- " + items.length + " registered");
console.log("");

if (open.length) {
  console.log(">>> STILL OPEN --- the fix is NOT on main, whatever any PR says. Keep reporting these.");
  for (const it of open) {
    console.log("  [" + it.id + "] " + (it.title || ""));
    if (it.decision) console.log("        decision: " + it.decision.trim());
    console.log("        gate (still failing): " + it.resolved_when);
  }
  console.log("");
}

if (resolved.length) {
  console.log(">>> RESOLVED --- artifact verified on main. Stop reporting these; clear the note.");
  for (const it of resolved) console.log("  [" + it.id + "] " + (it.title || ""));
  console.log("");
}

if (broken.length) {
  console.log(">>> BROKEN GATES --- the INSTRUMENT failed, NOT the escalation. Never read these as");
  console.log(">>> resolved: silently discarding a real escalation is the worst outcome here.");
  for (const b of broken) console.log("  [" + b.it.id + "] " + b.detail);
  console.log("");
}

console.log("open=" + open.length + "  resolved=" + resolved.length + "  broken=" + broken.length);
process.exit(0);
