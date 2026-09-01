// Tests for approval-receipt.mjs -- the pure decision module for CP-26 extension.
//
// Coverage:
//   - wasEverEscalated: label present, not present, malformed/null/empty rows
//   - decideApprovalReceipt: all decision-table branches
//   - Malformed receipt cases: missing pr, wrong pr number, missing approved_by,
//     missing approved_at (including unparseable date), empty body
//   - Receipt on main but absent from diff (receiptInDiff=false)
//
// Negative-control: one block deletes the `everLabeled` guard from the predicate
// inline (by simulating everLabeled=false on escalation inputs), confirms exactly
// the escalation cases flip from FAIL to PASS (proving the rule is load-bearing),
// and ordinary cases still pass. Both counts are reported in test assertions.
//
// Prompt: docs/pr-prompts/pr-gates-approval-receipt-HOLD.md

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { wasEverEscalated, decideApprovalReceipt } from "../approval-receipt.mjs";

// ---------------------------------------------------------------------------
// wasEverEscalated
// ---------------------------------------------------------------------------

describe("wasEverEscalated", () => {
  test("returns false for empty array", () => {
    assert.equal(wasEverEscalated([]), false);
  });

  test("returns false for null", () => {
    assert.equal(wasEverEscalated(null), false);
  });

  test("returns false for undefined", () => {
    assert.equal(wasEverEscalated(undefined), false);
  });

  test("returns false for non-array (string)", () => {
    assert.equal(wasEverEscalated("string"), false);
  });

  test("returns false for non-array (number)", () => {
    assert.equal(wasEverEscalated(42), false);
  });

  test("returns false for non-array (plain object)", () => {
    assert.equal(wasEverEscalated({}), false);
  });

  test("returns true when an event has event=labeled and label.name=do-not-merge", () => {
    const events = [
      { event: "labeled", label: { name: "do-not-merge" } },
    ];
    assert.equal(wasEverEscalated(events), true);
  });

  test("returns false when only non-do-not-merge labeled events exist", () => {
    const events = [
      { event: "labeled", label: { name: "enhancement" } },
      { event: "unlabeled", label: { name: "do-not-merge" } },
    ];
    assert.equal(wasEverEscalated(events), false);
  });

  test("returns true even if the label was subsequently removed (unlabeled row present too)", () => {
    // This is the key case: wasEverEscalated looks at HISTORY, not current state.
    // PR #1431's events: labeled then unlabeled -- both from GH-Mantova, unattributable.
    const events = [
      { event: "labeled", label: { name: "do-not-merge" } },
      { event: "unlabeled", label: { name: "do-not-merge" } },
    ];
    assert.equal(wasEverEscalated(events), true);
  });

  test("does not throw on null element in array -- returns correct value for rest", () => {
    const events = [null, { event: "labeled", label: { name: "do-not-merge" } }];
    assert.doesNotThrow(() => wasEverEscalated(events));
    assert.equal(wasEverEscalated(events), true);
  });

  test("does not throw on undefined element in array", () => {
    const events = [undefined, { event: "assigned" }];
    assert.doesNotThrow(() => wasEverEscalated(events));
    assert.equal(wasEverEscalated(events), false);
  });

  test("does not throw on partial row missing label field", () => {
    const events = [{ event: "labeled" }];
    assert.doesNotThrow(() => wasEverEscalated(events));
    assert.equal(wasEverEscalated(events), false);
  });

  test("does not throw on partial row with null label", () => {
    const events = [{ event: "labeled", label: null }];
    assert.doesNotThrow(() => wasEverEscalated(events));
    assert.equal(wasEverEscalated(events), false);
  });

  test("does not throw on row that is a primitive string", () => {
    const events = ["garbage"];
    assert.doesNotThrow(() => wasEverEscalated(events));
    assert.equal(wasEverEscalated(events), false);
  });

  test("does not throw on row that is a number", () => {
    const events = [42, { event: "labeled", label: { name: "do-not-merge" } }];
    assert.doesNotThrow(() => wasEverEscalated(events));
    assert.equal(wasEverEscalated(events), true);
  });

  test("mixed malformed and valid rows -- returns true if any valid escalation found", () => {
    const events = [
      null,
      undefined,
      { event: "assigned" },
      { event: "labeled" },
      { event: "labeled", label: { name: "wip" } },
      { event: "labeled", label: { name: "do-not-merge" } },
    ];
    assert.doesNotThrow(() => wasEverEscalated(events));
    assert.equal(wasEverEscalated(events), true);
  });
});

// ---------------------------------------------------------------------------
// decideApprovalReceipt -- decision table
// ---------------------------------------------------------------------------

const VALID_RECEIPT = `---
pr: 1234
approved_by: marco
approved_at: 2026-08-31T05:53:54Z
---

The PR was reviewed and approved for merge. The migration is additive and safe.
`;

const PR = 1234;

describe("decideApprovalReceipt - label present", () => {
  test("returns FAIL with code label-present when labelPresent=true", () => {
    const result = decideApprovalReceipt({
      labelPresent: true,
      everLabeled: true,
      receiptInDiff: false,
      receiptBody: null,
      prNumber: PR,
    });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.code, "LABEL_PRESENT");
    assert.ok(result.message.includes("do-not-merge"));
  });

  test("label present overrides everything -- even with a valid receipt", () => {
    const result = decideApprovalReceipt({
      labelPresent: true,
      everLabeled: true,
      receiptInDiff: true,
      receiptBody: VALID_RECEIPT,
      prNumber: PR,
    });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.code, "LABEL_PRESENT");
  });
});

describe("decideApprovalReceipt - never escalated", () => {
  test("returns PASS with code never-escalated when not labeled and never escalated", () => {
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: false,
      receiptInDiff: false,
      receiptBody: null,
      prNumber: PR,
    });
    assert.equal(result.verdict, "PASS");
    assert.equal(result.code, "NEVER_ESCALATED");
  });

  test("never-escalated pass does not require a receipt", () => {
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: false,
      receiptInDiff: false,
      receiptBody: null,
      prNumber: 9999,
    });
    assert.equal(result.verdict, "PASS");
    assert.equal(result.code, "NEVER_ESCALATED");
  });
});

describe("decideApprovalReceipt - escalated without receipt", () => {
  test("returns FAIL with code receipt-missing when escalated and no receipt in diff", () => {
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: true,
      receiptInDiff: false,
      receiptBody: null,
      prNumber: PR,
    });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.code, "RECEIPT_MISSING");
    assert.ok(result.message.includes(String(PR)));
  });

  test("receipt present on main but absent from diff -> FAIL receipt-missing", () => {
    // receiptInDiff=false means the file is not in THIS PR's diff.
    // A receipt committed in a previous PR (on main) does not count.
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: true,
      receiptInDiff: false,
      receiptBody: VALID_RECEIPT, // body present but receiptInDiff=false
      prNumber: PR,
    });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.code, "RECEIPT_MISSING");
  });
});

describe("decideApprovalReceipt - escalated with valid receipt", () => {
  test("returns PASS with code receipt-valid when receipt is valid", () => {
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: true,
      receiptInDiff: true,
      receiptBody: VALID_RECEIPT,
      prNumber: PR,
    });
    assert.equal(result.verdict, "PASS");
    assert.equal(result.code, "RECEIPT_VALID");
    assert.ok(result.message.includes("marco"));
  });
});

// ---------------------------------------------------------------------------
// Malformed receipt cases -- each tested separately per the HOLD prompt
// ---------------------------------------------------------------------------

describe("decideApprovalReceipt - malformed receipt: missing pr field", () => {
  test("returns FAIL receipt-malformed naming 'pr' when field absent", () => {
    const receipt = `---
approved_by: marco
approved_at: 2026-08-31T05:53:54Z
---

Some reason.
`;
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: true,
      receiptInDiff: true,
      receiptBody: receipt,
      prNumber: PR,
    });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.code, "RECEIPT_MALFORMED");
    assert.ok(result.message.toLowerCase().includes("pr"), `message: ${result.message}`);
  });
});

describe("decideApprovalReceipt - malformed receipt: wrong pr number", () => {
  test("returns FAIL receipt-malformed when pr field does not match prNumber", () => {
    const receipt = `---
pr: 9999
approved_by: marco
approved_at: 2026-08-31T05:53:54Z
---

Approved for a different PR.
`;
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: true,
      receiptInDiff: true,
      receiptBody: receipt,
      prNumber: PR, // 1234 != 9999
    });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.code, "RECEIPT_MALFORMED");
    assert.ok(result.message.includes("9999"), `message: ${result.message}`);
    assert.ok(result.message.includes(String(PR)), `message: ${result.message}`);
  });
});

describe("decideApprovalReceipt - malformed receipt: missing approved_by", () => {
  test("returns FAIL receipt-malformed naming 'approved_by'", () => {
    const receipt = `---
pr: 1234
approved_at: 2026-08-31T05:53:54Z
---

Some reason.
`;
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: true,
      receiptInDiff: true,
      receiptBody: receipt,
      prNumber: PR,
    });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.code, "RECEIPT_MALFORMED");
    assert.ok(result.message.includes("approved_by"), `message: ${result.message}`);
  });
});

describe("decideApprovalReceipt - malformed receipt: missing approved_at", () => {
  test("returns FAIL receipt-malformed naming 'approved_at' when field absent", () => {
    const receipt = `---
pr: 1234
approved_by: marco
---

Some reason.
`;
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: true,
      receiptInDiff: true,
      receiptBody: receipt,
      prNumber: PR,
    });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.code, "RECEIPT_MALFORMED");
    assert.ok(result.message.includes("approved_at"), `message: ${result.message}`);
  });

  test("returns FAIL receipt-malformed naming 'approved_at' when date is unparseable", () => {
    const receipt = `---
pr: 1234
approved_by: marco
approved_at: not-a-date
---

Some reason.
`;
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: true,
      receiptInDiff: true,
      receiptBody: receipt,
      prNumber: PR,
    });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.code, "RECEIPT_MALFORMED");
    assert.ok(result.message.includes("approved_at"), `message: ${result.message}`);
  });
});

describe("decideApprovalReceipt - malformed receipt: empty body", () => {
  test("returns FAIL receipt-malformed when no body lines after front matter", () => {
    const receipt = `---
pr: 1234
approved_by: marco
approved_at: 2026-08-31T05:53:54Z
---
`;
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: true,
      receiptInDiff: true,
      receiptBody: receipt,
      prNumber: PR,
    });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.code, "RECEIPT_MALFORMED");
    assert.ok(result.message.includes("body"), `message: ${result.message}`);
  });

  test("returns FAIL receipt-malformed when body has only whitespace lines", () => {
    const receipt = `---
pr: 1234
approved_by: marco
approved_at: 2026-08-31T05:53:54Z
---



`;
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: true,
      receiptInDiff: true,
      receiptBody: receipt,
      prNumber: PR,
    });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.code, "RECEIPT_MALFORMED");
  });
});

describe("decideApprovalReceipt - malformed receipt: no front matter at all", () => {
  test("returns FAIL receipt-malformed when receipt body has no front-matter delimiters", () => {
    const receipt = "This is not a valid receipt - no front matter.";
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: true,
      receiptInDiff: true,
      receiptBody: receipt,
      prNumber: PR,
    });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.code, "RECEIPT_MALFORMED");
  });

  test("returns FAIL receipt-malformed when receiptBody is null", () => {
    // receiptInDiff=true but body couldn't be read (e.g. read error)
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: true,
      receiptInDiff: true,
      receiptBody: null,
      prNumber: PR,
    });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.code, "RECEIPT_MALFORMED");
  });

  test("returns FAIL receipt-malformed when receiptBody is empty string", () => {
    const result = decideApprovalReceipt({
      labelPresent: false,
      everLabeled: true,
      receiptInDiff: true,
      receiptBody: "",
      prNumber: PR,
    });
    assert.equal(result.verdict, "FAIL");
    assert.equal(result.code, "RECEIPT_MALFORMED");
  });
});

// ---------------------------------------------------------------------------
// Negative-control run
//
// Purpose: confirm the test suite ACTUALLY tests the `everLabeled` rule.
// Per the HOLD prompt: "A test suite that passes with the rule removed is not
// testing the rule."
//
// Method: the `everLabeled` guard determines whether we require a receipt.
// The escalation cases (everLabeled=true, receiptInDiff=false or malformed) FAIL.
// If the guard were deleted (everLabeled treated as always false), those same
// inputs would fall into the "NEVER_ESCALATED" branch and PASS.
//
// We simulate this by passing everLabeled=false on the escalation inputs and
// confirming they now return PASS -- proving they were depending on the guard.
// Ordinary (never-escalated) cases are unaffected and still PASS.
//
// Negative-control numbers:
//   With rule intact (everLabeled=true):   2 escalation inputs -> FAIL  [correct]
//   Rule removed simulation (everLabeled=false): 2 inputs -> PASS       [proves rule is load-bearing]
//   Ordinary cases (everLabeled=false):    2 inputs -> PASS              [unaffected]
// ---------------------------------------------------------------------------

describe("negative-control: everLabeled guard is load-bearing", () => {
  const escalationInputs = [
    {
      name: "escalated without receipt",
      input: {
        labelPresent: false,
        everLabeled: true,
        receiptInDiff: false,
        receiptBody: null,
        prNumber: PR,
      },
    },
    {
      name: "escalated with malformed receipt (no front matter)",
      input: {
        labelPresent: false,
        everLabeled: true,
        receiptInDiff: true,
        receiptBody: "no front matter here",
        prNumber: PR,
      },
    },
  ];

  const ordinaryInputs = [
    {
      name: "ordinary PR, never escalated, no receipt",
      input: {
        labelPresent: false,
        everLabeled: false,
        receiptInDiff: false,
        receiptBody: null,
        prNumber: 9999,
      },
    },
    {
      name: "ordinary PR, never escalated, different PR number",
      input: {
        labelPresent: false,
        everLabeled: false,
        receiptInDiff: false,
        receiptBody: null,
        prNumber: 1,
      },
    },
  ];

  test("RULE INTACT: escalation inputs return FAIL (2 of 2 must fail)", () => {
    let failCount = 0;
    for (const { input } of escalationInputs) {
      const result = decideApprovalReceipt(input);
      if (result.verdict === "FAIL") failCount++;
    }
    assert.equal(
      failCount,
      2,
      `Expected 2 FAILs with rule intact, got ${failCount}. ` +
        "The escalation cases must fail when the do-not-merge history is present."
    );
  });

  test("RULE REMOVED (everLabeled=false): escalation inputs flip to PASS (2 of 2) -- proves rule is the cause", () => {
    // Simulate deleting the everLabeled guard by passing everLabeled=false.
    // The inputs that previously returned FAIL must now return PASS (never-escalated).
    // If they still returned FAIL, the rule wouldn't be the cause of the failure.
    let passCount = 0;
    for (const { input } of escalationInputs) {
      const simulatedNoRule = { ...input, everLabeled: false };
      const result = decideApprovalReceipt(simulatedNoRule);
      if (result.verdict === "PASS") passCount++;
    }
    assert.equal(
      passCount,
      2,
      `Expected 2 PASSes when everLabeled=false (rule removed simulation), got ${passCount}. ` +
        "This means escalation cases do NOT depend on everLabeled -- the guard is not being tested."
    );
  });

  test("ordinary (never-escalated) inputs still PASS regardless of rule presence", () => {
    let passCount = 0;
    for (const { input } of ordinaryInputs) {
      const result = decideApprovalReceipt(input);
      if (result.verdict === "PASS") passCount++;
    }
    assert.equal(
      passCount,
      2,
      `Expected ordinary inputs to PASS (2 of 2), got ${passCount}. ` +
        "Ordinary PRs must not be affected by changes to the escalation guard."
    );
  });
});
