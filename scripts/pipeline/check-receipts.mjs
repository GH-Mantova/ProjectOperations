#!/usr/bin/env node
// RECEIPT_SHAPE_GUARD_V1
//
// Every file in docs/decisions/merge-approvals/ except README.md is a CP-26 merge
// approval receipt. CP-26 reads it with ONE regex, in scripts/pr-gates/approval-receipt.mjs:
//
//     body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
//
// There is no /m flag, so `^` means START OF STRING. A UTF-8 BOM therefore makes the
// match fail outright and CP-26 returns RECEIPT_MALFORMED_FRONT_MATTER. Measured
// 2026-09-15: 26 committed receipts (1736..1799) carry a BOM and fail that parser as
// committed. They never failed a build only because CP-26 runs on the ONE receipt
// belonging to the PR being merged, and only while the do-not-merge label is on - so a
// defect in a receipt lies dormant until the day someone needs it.
//
// This guard applies the REAL parser to EVERY receipt, on every CI run, so the defect
// cannot lie dormant again. It re-implements nothing: the regex below is copied from
// approval-receipt.mjs and the two must stay identical.
//
// Exit 0 = every receipt would parse. Exit 1 = at least one would not.

import fs from "node:fs";
import path from "node:path";

// argv[2] lets the test point the guard at a fixture directory; CI passes nothing.
const DIR = process.argv[2] || "docs/decisions/merge-approvals";
const SKIP = new Set(["README.md"]);

// copied verbatim from scripts/pr-gates/approval-receipt.mjs (parseReceipt)
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function fields(front) {
  const out = {};
  for (const line of front.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

if (!fs.existsSync(DIR)) {
  console.error(`check-receipts: ${DIR} does not exist - run from the repo root`);
  process.exit(2);
}

const problems = [];
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".md") && !SKIP.has(f)).sort();

for (const f of files) {
  const rel = path.posix.join(DIR, f);
  const buf = fs.readFileSync(path.join(DIR, f));
  const raw = buf.toString("utf8");

  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    problems.push(`${rel}: UTF-8 BOM - CP-26's parser anchors at string start, so this receipt reads as having no front matter`);
    continue; // every later check would be reported against a string CP-26 cannot read
  }
  if (raw.includes("�")) {
    problems.push(`${rel}: contains U+FFFD (replacement character) - the text was decoded with the wrong encoding before it was written`);
  }

  const m = raw.match(FRONT_MATTER);
  if (!m) {
    problems.push(`${rel}: no YAML front matter delimited by --- lines (CP-26 would FAIL this receipt)`);
    continue;
  }

  const body = raw.replace(/\r\n/g, "\n");
  const blocks = (body.match(/^---\n[\s\S]*?\n---\n/gm) || []).length;
  if (blocks !== 1) {
    problems.push(`${rel}: ${blocks} front-matter blocks, expected exactly 1 - CP-26 reads the first and the rest print as literal --- rules in the document`);
  }

  const fm = fields(m[1]);
  const stem = f.replace(/\.md$/, "");
  if (fm.pr === undefined) problems.push(`${rel}: front matter has no "pr" field`);
  else if (fm.pr !== stem) problems.push(`${rel}: front matter says "pr: ${fm.pr}" but the file is named ${f}`);
  if (!fm.approved_by) problems.push(`${rel}: front matter has no "approved_by" field`);
  if (!fm.approved_at) problems.push(`${rel}: front matter has no "approved_at" field`);
  else if (Number.isNaN(Date.parse(fm.approved_at))) problems.push(`${rel}: "approved_at: ${fm.approved_at}" does not parse as a date`);
  if (m[2].trim() === "") problems.push(`${rel}: no body content after the front matter`);
}

if (problems.length === 0) {
  console.log(`check-receipts: ${files.length} receipt(s) parse under CP-26's own front-matter regex. OK`);
  process.exit(0);
}

console.error(`check-receipts: ${problems.length} problem(s) across ${files.length} receipt(s):\n`);
for (const p of problems) console.error("  " + p);
console.error(
  "\nA receipt is the record that a human approved a merge. If CP-26 cannot read it, the\n" +
  "record does not exist as far as the gate is concerned. Fix the file, not this check."
);
process.exit(1);
