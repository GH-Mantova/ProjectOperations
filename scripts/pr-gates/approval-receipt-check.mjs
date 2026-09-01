#!/usr/bin/env node
// CI entry point for the approval-receipt gate (CP-26). Thin plumbing only:
// reads env, calls `gh` and `git`, then hands parsed data to the pure module.
// Node built-ins only. ASCII-only output. Fail CLOSED on any `gh`/`git` error.
//
// This is the ENFORCEMENT point. CP-26 in pr-gates.mjs reports the same
// verdict, but that job bundles many checks under one name; making CP-26
// required would also require unrelated gates. This job carries CP-26 alone,
// so it can be added to the required-status-checks rule without dragging the
// rest of pr-gates along.
//
// IMPORTANT: this job has no path filter and no `needs:` in ci.yml. A required
// check that never reports leaves every PR pending forever. The check must run
// on every PR and pass in seconds for the ordinary case (never-escalated).
// See ci.yml `pipeline-tests` for the same pattern and why it is load-bearing.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { wasEverEscalated, decideApprovalReceipt } from "./approval-receipt.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

function die(msg) {
  process.stderr.write(`approval-receipt-check: ${msg}\n`);
  process.exit(1);
}

const prNumber = process.env.PR_NUMBER;
if (!prNumber) {
  // No PR context. This job is `if: github.event_name == 'pull_request'`, so
  // if we get here at all something is wrong. Fail closed.
  die("PR_NUMBER not set (expected in pull_request context)");
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8" });
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", cwd: repoRoot });
}

let labels;
try {
  const raw = gh([
    "pr",
    "view",
    prNumber,
    "--json",
    "labels",
    "-q",
    ".labels[].name",
  ]);
  labels = raw.split("\n").map((s) => s.trim()).filter(Boolean);
} catch (err) {
  die(`could not read labels via gh: ${err.message}`);
}
const labelPresent = labels.includes("do-not-merge");

let events;
try {
  // gh api --paginate --slurp gathers every page into one JSON array of pages,
  // each page itself an array of events. Flatten one level below.
  const raw = gh([
    "api",
    "--paginate",
    "--slurp",
    `repos/{owner}/{repo}/issues/${prNumber}/events`,
  ]);
  const pages = JSON.parse(raw);
  events = Array.isArray(pages) ? pages.flat() : [];
} catch (err) {
  die(`could not read events via gh: ${err.message}`);
}
const everLabeled = wasEverEscalated(events);

// receiptInDiff: docs/decisions/merge-approvals/<pr>.md present in this PR's
// diff against the merge-base with origin/main. A receipt sitting on `main`
// from an earlier PR (or copied over) does not count.
const receiptRel = `docs/decisions/merge-approvals/${prNumber}.md`;
let receiptInDiff = false;
let receiptBody = null;
try {
  const base = git(["merge-base", "origin/main", "HEAD"]).trim();
  const changed = git(["diff", "--name-only", base, "HEAD"])
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  receiptInDiff = changed.includes(receiptRel);
  if (receiptInDiff) {
    const abs = join(repoRoot, receiptRel);
    if (existsSync(abs)) {
      receiptBody = readFileSync(abs, "utf8");
    }
  }
} catch (err) {
  die(`could not diff against origin/main: ${err.message}`);
}

const decision = decideApprovalReceipt({
  labelPresent,
  everLabeled,
  receiptInDiff,
  receiptBody,
  prNumber: Number(prNumber),
});

// One-line CI-friendly summary, then exit code.
process.stdout.write(
  `${decision.verdict} - CP-26 approval-receipt [${decision.code}] ${decision.message}\n`
);

if (decision.verdict === "FAIL") {
  process.stdout.write(
    "\n" +
      "How to release this escalation:\n" +
      "  1. A human reviews the PR and, if approved, removes the `do-not-merge` label.\n" +
      `  2. Commit ${receiptRel} to the PR branch with front matter:\n` +
      "\n" +
      "         ---\n" +
      `         pr: ${prNumber}\n` +
      "         approved_by: <handle>\n" +
      "         approved_at: <ISO-8601 timestamp>\n" +
      "         ---\n" +
      "\n" +
      "         <at least one non-empty line explaining why this was approved>\n" +
      "\n" +
      "  3. Push. CI re-runs; this gate turns green.\n" +
      "\n" +
      "See docs/decisions/merge-approvals/README.md for the template.\n"
  );
  process.exit(1);
}

process.exit(0);
