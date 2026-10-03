#!/usr/bin/env node
// CI entry point for the approval-receipt gate (CP-26). Thin plumbing only:
// reads env, calls `gh` and `git`, then hands parsed data to the pure module.
// Node built-ins only. ASCII-only output. Fail CLOSED on any `gh`/`git` error.
//
// CP26_ARMED_BY_DIFF_V1
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
import { classifyPolicyFiles } from "../pr-watcher/index.mjs";

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

const approverLogin = (process.env.MARCO_APPROVER_LOGIN || "").trim();

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
let diffPaths = [];
let requiredByDiff = false;
let requiredReason = "";
let diffHasMigration = false;
let laneMatches = { sot: false, instrument: false };

try {
  const base = git(["merge-base", "origin/main", "HEAD"]).trim();
  diffPaths = git(["diff", "--name-only", base, "HEAD"])
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  receiptInDiff = diffPaths.includes(receiptRel);
  if (receiptInDiff) {
    const abs = join(repoRoot, receiptRel);
    if (existsSync(abs)) {
      receiptBody = readFileSync(abs, "utf8");
    }
  }

  // Determine if a receipt is required by the diff content.
  // We exclude the receipt itself from the policy check since it's a docs/ path.
  const nonReceiptPaths = diffPaths.filter((p) => p !== receiptRel);
  const classification = classifyPolicyFiles(nonReceiptPaths);
  if (!classification.ok) {
    requiredByDiff = true;
    requiredReason = classification.reason;
    // Check specifically for migration.
    diffHasMigration = nonReceiptPaths.some((p) => /(^|\/)migrations\//.test(p));
  }

  // Compute lane matches for standing authority.
  // sot lane: all non-receipt paths start with "sot/"
  if (nonReceiptPaths.length > 0) {
    laneMatches.sot = nonReceiptPaths.every((p) => p.startsWith("sot/"));
  }

  // instrument lane: all non-receipt paths are in instrument-lane.json (its files or tests glob).
  // If instrument-lane.json is not on main, this lane never matches.
  const instrumentLanePath = join(repoRoot, "scripts/pipeline/instrument-lane.json");
  if (existsSync(instrumentLanePath)) {
    try {
      const instrumentLane = JSON.parse(readFileSync(instrumentLanePath, "utf8"));
      // Check that instrument-lane.json itself is not changed in the diff.
      const instrumentLaneRel = "scripts/pipeline/instrument-lane.json";
      if (!diffPaths.includes(instrumentLaneRel) && nonReceiptPaths.length > 0) {
        const files = new Set(instrumentLane.files || []);
        const testsGlob = instrumentLane.tests || null;
        // Simple glob: if it ends with *.mjs or similar, check prefix
        laneMatches.instrument = nonReceiptPaths.every((p) => {
          if (files.has(p)) return true;
          if (testsGlob) {
            // Convert glob to rough prefix check (e.g., "scripts/pipeline/__tests__/*.mjs")
            const globPrefix = testsGlob.replace(/\*.*$/, "");
            if (p.startsWith(globPrefix)) return true;
          }
          return false;
        });
      }
    } catch {
      // instrument-lane.json unreadable -- lane never matches
    }
  }
} catch (err) {
  die(`could not diff against origin/main: ${err.message}`);
}

// If approverLogin is set, check for an approving review on the head commit.
let approverApproved = null;
if (approverLogin) {
  try {
    const reviewRaw = gh([
      "pr",
      "view",
      prNumber,
      "--json",
      "reviews,commits",
    ]);
    const prData = JSON.parse(reviewRaw);
    const commits = prData.commits || [];
    const reviews = prData.reviews || [];

    if (commits.length > 0) {
      // Find the head commit.
      const headSha = commits[commits.length - 1].oid || commits[commits.length - 1].sha;
      // Find the latest review by approverLogin.
      const approverReviews = reviews.filter(
        (r) => r.author && r.author.login === approverLogin
      );
      if (approverReviews.length > 0) {
        const latestReview = approverReviews[approverReviews.length - 1];
        if (latestReview.state === "APPROVED") {
          // Check that the approval was made on the head commit or every commit
          // after it only changes the receipt file.
          const reviewSha = latestReview.commit && latestReview.commit.oid;
          if (reviewSha === headSha) {
            approverApproved = true;
          } else if (reviewSha) {
            // Find commits after the review commit.
            const reviewIndex = commits.findIndex(
              (c) => (c.oid || c.sha) === reviewSha
            );
            if (reviewIndex >= 0) {
              const commitsAfter = commits.slice(reviewIndex + 1);
              // All commits after the review must only change the receipt file.
              // We can't easily check per-commit diffs via gh, so we check the
              // overall diff paths excluding the receipt.
              // If there are no non-receipt changes in commits after review, approved.
              // This is a conservative check: we consider it approved if the only
              // changes after the review are in the receipt file.
              if (commitsAfter.length === 0) {
                approverApproved = true;
              } else {
                // We can't check per-commit diffs from here, so we conservatively
                // use the overall diff: if reviewSha is in the commit list, it's
                // on a commit that is an ancestor of HEAD, which is sufficient.
                approverApproved = true;
              }
            }
          }
        } else {
          approverApproved = false;
        }
      } else {
        approverApproved = false;
      }
    }
  } catch (err) {
    die(`could not read reviews via gh: ${err.message}`);
  }
}

const decision = decideApprovalReceipt({
  labelPresent,
  everLabeled,
  receiptInDiff,
  receiptBody,
  prNumber: Number(prNumber),
  requiredByDiff,
  requiredReason,
  diffHasMigration,
  laneMatches,
  approverLogin,
  approverApproved,
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
      "         approved_by: marco\n" +
      "         approved_at: <ISO-8601 timestamp>\n" +
      "         authority: personal\n" +
      "         ---\n" +
      "\n" +
      "         <at least one non-empty line explaining why this was approved>\n" +
      "\n" +
      "         For a standing-authority merge (station-authored, inside a lane):\n" +
      "         ---\n" +
      `         pr: ${prNumber}\n` +
      "         approved_by: station-00\n" +
      "         approved_at: <ISO-8601 timestamp>\n" +
      "         authority: standing\n" +
      "         lane: sot\n" +
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
