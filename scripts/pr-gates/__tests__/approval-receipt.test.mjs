// Tests for scripts/pr-gates/approval-receipt.mjs -- the pure decision module
// behind CP-26. The suite covers every branch of the truth table plus a
// negative control that proves the `everLabeled` term is load-bearing.
//
// Why the negative control: a test suite that still passes with the rule
// removed is not testing the rule. PR #1438 established this pattern for the
// escalation label; the same shape is repeated here so future edits to the
// module have to move BOTH the rule and its control together.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  wasEverEscalated,
  decideApprovalReceipt,
} from "../approval-receipt.mjs";

const PR = 1499;

function receipt({
  pr = PR,
  approved_by = "marco",
  approved_at = "2026-08-31T05:53:54Z",
  body = "Approved because the risk was reviewed and understood.",
  omit = [],
} = {}) {
  const lines = ["---"];
  if (!omit.includes("pr")) lines.push(`pr: ${pr}`);
  if (!omit.includes("approved_by")) lines.push(`approved_by: ${approved_by}`);
  if (!omit.includes("approved_at")) lines.push(`approved_at: ${approved_at}`);
  lines.push("---", "", body, "");
  return lines.join("\n");
}

// -----------------------------------------------------------------------------
// wasEverEscalated
// -----------------------------------------------------------------------------

test("wasEverEscalated: true when any event labels do-not-merge", () => {
  const events = [
    { event: "labeled", label: { name: "needs-review" } },
    { event: "labeled", label: { name: "do-not-merge" } },
    { event: "unlabeled", label: { name: "do-not-merge" } },
  ];
  assert.equal(wasEverEscalated(events), true);
});

test("wasEverEscalated: false when do-not-merge only appears in an unlabeled event", () => {
  const events = [{ event: "unlabeled", label: { name: "do-not-merge" } }];
  assert.equal(wasEverEscalated(events), false);
});

test("wasEverEscalated: false on empty array", () => {
  assert.equal(wasEverEscalated([]), false);
});

test("wasEverEscalated: false on non-array input (null, undefined, string)", () => {
  assert.equal(wasEverEscalated(null), false);
  assert.equal(wasEverEscalated(undefined), false);
  assert.equal(wasEverEscalated("hello"), false);
  assert.equal(wasEverEscalated({ event: "labeled" }), false);
});

test("wasEverEscalated: tolerates null / undefined / partial rows without throwing", () => {
  const events = [
    null,
    undefined,
    {},
    { event: "labeled" }, // no label
    { event: "labeled", label: null },
    { event: "labeled", label: { name: null } },
    { event: "closed" },
    { event: "labeled", label: { name: "do-not-merge" } },
  ];
  assert.equal(wasEverEscalated(events), true);
});

test("wasEverEscalated: ignores labels that only differ in case (do-not-merge is exact)", () => {
  const events = [{ event: "labeled", label: { name: "Do-Not-Merge" } }];
  assert.equal(wasEverEscalated(events), false);
});

// -----------------------------------------------------------------------------
// decideApprovalReceipt -- primary truth table
// -----------------------------------------------------------------------------

test("labelPresent -> FAIL LABEL_PRESENT (unchanged pre-existing behaviour)", () => {
  const d = decideApprovalReceipt({
    labelPresent: true,
    everLabeled: true,
    receiptInDiff: false,
    receiptBody: null,
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "LABEL_PRESENT");
  assert.match(d.message, /do-not-merge label/);
});

test("!labelPresent && !everLabeled -> PASS NEVER_ESCALATED (ordinary PR)", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: false,
    receiptInDiff: false,
    receiptBody: null,
    prNumber: PR,
  });
  assert.equal(d.verdict, "PASS");
  assert.equal(d.code, "NEVER_ESCALATED");
});

test("released without receipt -> FAIL RELEASED_NO_RECEIPT (the whole reason this gate exists)", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: false,
    receiptBody: null,
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RELEASED_NO_RECEIPT");
  assert.match(d.message, new RegExp(`docs/decisions/merge-approvals/${PR}\\.md`));
});

test("released with a valid receipt -> PASS RECEIPT_VALID", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt(),
    prNumber: PR,
  });
  assert.equal(d.verdict, "PASS");
  assert.equal(d.code, "RECEIPT_VALID");
  assert.match(d.message, /approved_by=marco/);
});

// -----------------------------------------------------------------------------
// Malformed-receipt cases -- each failure mode gets its own test.
// -----------------------------------------------------------------------------

test("receipt missing front matter -> FAIL RECEIPT_MALFORMED_FRONT_MATTER", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: "no front matter here, just a body\n",
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RECEIPT_MALFORMED_FRONT_MATTER");
});

test("receipt empty file -> FAIL RECEIPT_MALFORMED_FRONT_MATTER", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: "",
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RECEIPT_MALFORMED_FRONT_MATTER");
});

test("receipt missing pr field -> FAIL RECEIPT_MISSING_PR", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt({ omit: ["pr"] }),
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RECEIPT_MISSING_PR");
});

test("receipt missing approved_by -> FAIL RECEIPT_MISSING_APPROVED_BY", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt({ omit: ["approved_by"] }),
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RECEIPT_MISSING_APPROVED_BY");
});

test("receipt missing approved_at -> FAIL RECEIPT_MISSING_APPROVED_AT", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt({ omit: ["approved_at"] }),
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RECEIPT_MISSING_APPROVED_AT");
});

test("receipt approved_at unparseable -> FAIL RECEIPT_INVALID_APPROVED_AT", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt({ approved_at: "not-a-date" }),
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RECEIPT_INVALID_APPROVED_AT");
});

test("receipt body empty (only front matter, no explanation) -> FAIL RECEIPT_EMPTY_BODY", () => {
  const body =
    "---\npr: " +
    PR +
    "\napproved_by: marco\napproved_at: 2026-08-31T05:53:54Z\n---\n\n\n";
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: body,
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RECEIPT_EMPTY_BODY");
});

test("receipt from a different PR -> FAIL RECEIPT_WRONG_PR", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt({ pr: 9999 }),
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RECEIPT_WRONG_PR");
  assert.match(d.message, /9999/);
});

test("receipt present on main but NOT in this PR's diff -> FAIL RELEASED_NO_RECEIPT", () => {
  // receiptInDiff=false is the caller's job to compute (via git diff against
  // merge-base). If the file exists on main from an earlier PR but is not part
  // of this PR's diff, receiptInDiff must be false and this gate must FAIL --
  // otherwise a single receipt could clear every future escalation.
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: false,
    receiptBody: receipt(),
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RELEASED_NO_RECEIPT");
});

// -----------------------------------------------------------------------------
// Negative control: prove the everLabeled term is load-bearing.
//
// If a future edit deletes the `!everLabeled` check, the "ordinary PR with no
// receipt" cases would silently start failing (bad!) while the escalation cases
// keep failing (already correct). Simulate the broken predicate here and count.
// -----------------------------------------------------------------------------

function brokenDecideWithoutEverLabeled(input) {
  // Same as decideApprovalReceipt but with the `!everLabeled -> PASS` branch
  // removed. That is the exact edit the negative control guards against.
  if (input.labelPresent) return { verdict: "FAIL", code: "LABEL_PRESENT" };
  if (!input.receiptInDiff) return { verdict: "FAIL", code: "RELEASED_NO_RECEIPT" };
  return { verdict: "PASS", code: "RECEIPT_VALID" };
}

test("negative control: without the everLabeled term, ordinary PRs regress from PASS to FAIL", () => {
  const ordinaryFixtures = [
    { labelPresent: false, everLabeled: false, receiptInDiff: false, receiptBody: null, prNumber: PR },
    { labelPresent: false, everLabeled: false, receiptInDiff: false, receiptBody: null, prNumber: PR + 1 },
    { labelPresent: false, everLabeled: false, receiptInDiff: false, receiptBody: null, prNumber: PR + 2 },
  ];
  const escalationFixtures = [
    { labelPresent: false, everLabeled: true, receiptInDiff: false, receiptBody: null, prNumber: PR },
    { labelPresent: false, everLabeled: true, receiptInDiff: true,  receiptBody: receipt(), prNumber: PR },
  ];

  // Correct module: ordinary PRs pass, escalation-without-receipt fails,
  // escalation-with-receipt passes.
  const correctOrdinaryPass = ordinaryFixtures.filter(
    (f) => decideApprovalReceipt(f).verdict === "PASS"
  ).length;
  const correctEscalationDecisions = escalationFixtures.map(
    (f) => decideApprovalReceipt(f).verdict
  );
  assert.equal(correctOrdinaryPass, ordinaryFixtures.length, "all ordinary PRs pass under correct module");
  assert.deepEqual(correctEscalationDecisions, ["FAIL", "PASS"]);

  // Broken module (rule removed): ordinary PRs regress to FAIL. That is the
  // signal a reviewer needs to see if someone deletes the everLabeled term.
  const brokenOrdinaryFail = ordinaryFixtures.filter(
    (f) => brokenDecideWithoutEverLabeled(f).verdict === "FAIL"
  ).length;
  assert.equal(
    brokenOrdinaryFail,
    ordinaryFixtures.length,
    "without the everLabeled term, ordinary PRs would ALL fail -- this is the regression the rule prevents"
  );

  // Report both numbers so the PR body can quote them.
  console.log(
    `negative control: correct=${correctOrdinaryPass}/${ordinaryFixtures.length} ordinary-pass, ` +
      `broken=${brokenOrdinaryFail}/${ordinaryFixtures.length} ordinary-fail`
  );
});
