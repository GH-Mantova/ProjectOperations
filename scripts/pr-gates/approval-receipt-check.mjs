#!/usr/bin/env node
// approval-receipt-check: the CI entrypoint for the CP-26 approval-receipt gate.
// Thin plumbing only - reads env vars, runs gh + git, calls the pure module in
// ./approval-receipt.mjs. All decision logic lives there so the tests test the
// decision, not the shell-out.
//
// Contract:
//   Env:  PR_NUMBER  (integer)   - required
//         GH_TOKEN   (opaque)    - required for `gh api`
//   Exit: 0 on PASS, 1 on FAIL, 2 on infrastructure failure (gh/git broken).
//
// This job MUST be safe to require: it runs unconditionally on every pull
// request (no `if:` beyond the event guard, no `needs:` on the changes-filter
// job, no path filters) and completes in seconds for the ordinary case
// (no label ever applied -> two API calls and an early PASS). A required
// check that skips leaves the PR pending forever - see the comment on the
// pipeline-tests job in .github/workflows/ci.yml.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  wasEverEscalated,
  decideApprovalReceipt,
} from "./approval-receipt.mjs";

const prNumber = process.env.PR_NUMBER;
if (!prNumber) {
  process.stderr.write("approval-receipt: PR_NUMBER is not set - this job must run in a pull_request context\n");
  process.exit(2);
}

function ghJson(args) {
  return execFileSync("gh", args, { encoding: "utf8" });
}
function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

// 1. Owner/repo - derive from `gh repo view` so this works regardless of
//    remote name.
let owner;
let repo;
try {
  const raw = ghJson(["repo", "view", "--json", "owner,name", "-q", ".owner.login + \"/\" + .name"]);
  const [o, r] = raw.trim().split("/");
  owner = o;
  repo = r;
  if (!owner || !repo) throw new Error("could not parse owner/repo from: " + raw);
} catch (err) {
  process.stderr.write("approval-receipt: could not resolve repo: " + err.message + "\n");
  process.exit(2);
}

// 2. Current label state.
let labels = [];
try {
  const raw = ghJson(["pr", "view", prNumber, "--json", "labels", "-q", ".labels[].name"]);
  labels = raw.split("\n").map((s) => s.trim()).filter(Boolean);
} catch (err) {
  process.stderr.write("approval-receipt: could not read labels for #" + prNumber + ": " + err.message + "\n");
  process.exit(2);
}
const labelPresent = labels.includes("do-not-merge");

// 3. Was the label EVER applied?
let events;
try {
  const raw = ghJson([
    "api",
    "-H", "Accept: application/vnd.github+json",
    "/repos/" + owner + "/" + repo + "/issues/" + prNumber + "/events",
    "--paginate",
  ]);
  events = JSON.parse(raw);
} catch (err) {
  process.stderr.write("approval-receipt: could not fetch issue events for #" + prNumber + ": " + err.message + "\n");
  process.exit(2);
}
const everLabeled = wasEverEscalated(events);

// 4. Is docs/decisions/merge-approvals/<pr>.md in the diff against the merge-base?
//    Uses origin/main as the base - matches pr-gates.mjs. `fetch-depth: 0` in
//    the CI job is REQUIRED for merge-base to exist.
const receiptPath = "docs/decisions/merge-approvals/" + prNumber + ".md";
let receiptInDiff = false;
let receiptBody = null;
try {
  const base = git("merge-base", "origin/main", "HEAD").trim();
  const changed = git("diff", "--name-only", base, "HEAD").split("\n").filter(Boolean);
  receiptInDiff = changed.includes(receiptPath);
  if (receiptInDiff && existsSync(receiptPath)) {
    receiptBody = readFileSync(receiptPath, "utf8");
  }
} catch (err) {
  process.stderr.write("approval-receipt: git failed while checking diff: " + err.message + "\n");
  process.exit(2);
}

// 5. Decide.
const decision = decideApprovalReceipt({
  labelPresent,
  everLabeled,
  receiptInDiff,
  receiptBody,
  prNumber: Number(prNumber),
});

// 6. Report - human-readable to stdout, GitHub annotation on FAIL.
process.stdout.write(
  decision.verdict + " - CP-26 approval-receipt [" + decision.code + "] " + decision.message + "\n"
);
if (decision.verdict === "FAIL") {
  process.stdout.write("::error title=CP-26 approval-receipt::" + decision.message + "\n");
  process.exit(1);
}
process.exit(0);
