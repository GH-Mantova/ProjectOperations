// Tests for scripts/pr-gates/approval-receipt.mjs -- the pure decision module
// behind CP-26. The suite covers every branch of the truth table plus a
// negative control that proves the `everLabeled` term is load-bearing.
//
// Why the negative control: a test suite that still passes with the rule
// removed is not testing the rule. PR #1438 established this pattern for the
// escalation label; the same shape is repeated here so future edits to the
// module have to move BOTH the rule and its control together.
//
// CP26_ARMED_BY_DIFF_V1

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
  authority = "personal",
  lane = undefined,
  body = "Approved because the risk was reviewed and understood.",
  omit = [],
} = {}) {
  const lines = ["---"];
  if (!omit.includes("pr")) lines.push(`pr: ${pr}`);
  if (!omit.includes("approved_by")) lines.push(`approved_by: ${approved_by}`);
  if (!omit.includes("approved_at")) lines.push(`approved_at: ${approved_at}`);
  if (!omit.includes("authority")) lines.push(`authority: ${authority}`);
  if (lane !== undefined && !omit.includes("lane")) lines.push(`lane: ${lane}`);
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

test("wasEverEscalated: tolerates primitive rows (bare string / number) without throwing", () => {
  // Main's existing tolerance test uses object/nullish rows; a bare string or
  // number takes a different path through the `typeof e !== "object"` guard.
  const events = [
    "garbage",
    42,
    { event: "labeled", label: { name: "do-not-merge" } },
  ];
  assert.equal(wasEverEscalated(events), true);
});

test("wasEverEscalated: plain object (not array) with a matching-looking label still returns false", () => {
  // Distinct from the existing `{ event: "labeled" }` non-array fixture: that
  // one has no matching label, so it does not actually prove the Array.isArray
  // guard is what stops the traversal. This fixture WOULD register as an
  // escalation if the guard were removed and iteration somehow succeeded, so
  // it isolates the array-guard rule specifically.
  const notAnArray = { event: "labeled", label: { name: "do-not-merge" } };
  assert.equal(wasEverEscalated(notAnArray), false);
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

test("labelPresent: label present overrides a valid receipt (short-circuits ahead of everything else)", () => {
  // Nothing else in the suite proves a valid receipt cannot release a PR whose
  // label is still on. The label check must short-circuit at the top of the
  // decision so a receipt cannot pre-clear the escalation before the label is
  // removed.
  const d = decideApprovalReceipt({
    labelPresent: true,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt(),
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "LABEL_PRESENT");
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

// New test 1: unlabelled, docs/tests-only diff -> PASS NEVER_ESCALATED
test("unlabelled PR with docs/tests-only diff -> PASS NEVER_ESCALATED", () => {
  // requiredByDiff=false means classifyPolicyFiles returned ok:true
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: false,
    receiptInDiff: false,
    receiptBody: null,
    prNumber: PR,
    requiredByDiff: false,
    requiredReason: "",
  });
  assert.equal(d.verdict, "PASS");
  assert.equal(d.code, "NEVER_ESCALATED");
});

// New test 2: unlabelled, migrations/ path, no receipt -> FAIL RECEIPT_REQUIRED_BY_DIFF (#1662/#1687 case)
test("unlabelled PR with migration file, no receipt -> FAIL RECEIPT_REQUIRED_BY_DIFF", () => {
  const migrationFile = "apps/api/prisma/migrations/20261003_add_thing/migration.sql";
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: false,
    receiptInDiff: false,
    receiptBody: null,
    prNumber: PR,
    requiredByDiff: true,
    requiredReason: `migration file: ${migrationFile}`,
    diffHasMigration: true,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RECEIPT_REQUIRED_BY_DIFF");
  assert.match(d.message, /migration file/);
});

// New test 3: unlabelled, apps/ path, no receipt -> FAIL RECEIPT_REQUIRED_BY_DIFF (#1827 case)
test("unlabelled PR with apps/ source file, no receipt -> FAIL RECEIPT_REQUIRED_BY_DIFF", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: false,
    receiptInDiff: false,
    receiptBody: null,
    prNumber: PR,
    requiredByDiff: true,
    requiredReason: "outside tests/ or docs/: apps/api/src/foo/bar.ts",
    diffHasMigration: false,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RECEIPT_REQUIRED_BY_DIFF");
  assert.match(d.message, /outside tests\/ or docs\//);
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

test("released with a valid personal receipt -> PASS RECEIPT_VALID_UNCORROBORATED (no approver configured)", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt(),
    prNumber: PR,
    approverLogin: "",
    approverApproved: null,
  });
  assert.equal(d.verdict, "PASS");
  assert.equal(d.code, "RECEIPT_VALID_UNCORROBORATED");
  assert.match(d.message, /approved_by=marco/);
  assert.match(d.message, /station's statement/);
});

// -----------------------------------------------------------------------------
// Malformed-receipt cases -- each failure mode gets its own test.
// -----------------------------------------------------------------------------

test("receiptInDiff=true with receiptBody=null (unreadable file) -> FAIL RECEIPT_MALFORMED_FRONT_MATTER", () => {
  // Callers set receiptInDiff=true when the receipt path appears in the diff
  // but pass receiptBody=null when the file could not be read (e.g. deleted in
  // this PR, or a read error). This must reach the empty/missing branch of
  // parseReceipt rather than short-circuiting elsewhere.
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: null,
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RECEIPT_MALFORMED_FRONT_MATTER");
});

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
    "\napproved_by: marco\napproved_at: 2026-08-31T05:53:54Z\nautority: personal\n---\n\n\n";
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

// New test 4: receipt without authority -> FAIL RECEIPT_MISSING_AUTHORITY
test("receipt missing authority field -> FAIL RECEIPT_MISSING_AUTHORITY", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt({ omit: ["authority"] }),
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RECEIPT_MISSING_AUTHORITY");
});

test("receipt with authority: maybe -> FAIL RECEIPT_INVALID_AUTHORITY", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt({ authority: "maybe" }),
    prNumber: PR,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "RECEIPT_INVALID_AUTHORITY");
  assert.match(d.message, /maybe/);
});

// New test 5a: standing, lane:sot, match true -> PASS RECEIPT_VALID_STANDING
test("standing receipt, lane:sot, sot match true -> PASS RECEIPT_VALID_STANDING", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: false,
    receiptInDiff: true,
    receiptBody: receipt({ authority: "standing", approved_by: "station-00", lane: "sot" }),
    prNumber: PR,
    requiredByDiff: true,
    requiredReason: "outside tests/ or docs/: sot/02-progress.md",
    diffHasMigration: false,
    laneMatches: { sot: true, instrument: false },
  });
  assert.equal(d.verdict, "PASS");
  assert.equal(d.code, "RECEIPT_VALID_STANDING");
  assert.match(d.message, /lane=sot/);
});

// New test 5a continued: standing, lane:sot, match false -> FAIL STANDING_OUTSIDE_LANE
test("standing receipt, lane:sot, sot match false -> FAIL STANDING_OUTSIDE_LANE", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: false,
    receiptInDiff: true,
    receiptBody: receipt({ authority: "standing", approved_by: "station-00", lane: "sot" }),
    prNumber: PR,
    requiredByDiff: true,
    requiredReason: "outside tests/ or docs/: scripts/something.mjs",
    diffHasMigration: false,
    laneMatches: { sot: false, instrument: false },
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "STANDING_OUTSIDE_LANE");
});

// New test 6a: standing on a PR that was ever labelled -> FAIL STANDING_ON_LABELLED_PR
test("standing receipt on a PR that was ever labelled -> FAIL STANDING_ON_LABELLED_PR", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt({ authority: "standing", approved_by: "station-00", lane: "sot" }),
    prNumber: PR,
    diffHasMigration: false,
    laneMatches: { sot: true, instrument: false },
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "STANDING_ON_LABELLED_PR");
});

// New test 6b: standing with a migration -> FAIL STANDING_NOT_ALLOWED_FOR_MIGRATION
test("standing receipt with migration in diff -> FAIL STANDING_NOT_ALLOWED_FOR_MIGRATION", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: false,
    receiptInDiff: true,
    receiptBody: receipt({ authority: "standing", approved_by: "station-00", lane: "sot" }),
    prNumber: PR,
    requiredByDiff: true,
    requiredReason: "migration file: apps/api/prisma/migrations/x/migration.sql",
    diffHasMigration: true,
    laneMatches: { sot: true, instrument: false },
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "STANDING_NOT_ALLOWED_FOR_MIGRATION");
});

// New test 6c: standing with approved_by: marco -> FAIL STANDING_CLAIMS_MARCO
test("standing receipt with approved_by: marco -> FAIL STANDING_CLAIMS_MARCO", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: false,
    receiptInDiff: true,
    receiptBody: receipt({ authority: "standing", approved_by: "marco", lane: "sot" }),
    prNumber: PR,
    requiredByDiff: true,
    requiredReason: "outside tests/ or docs/: sot/02-progress.md",
    diffHasMigration: false,
    laneMatches: { sot: true, instrument: false },
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "STANDING_CLAIMS_MARCO");
});

// New test 7: personal, no approver configured -> PASS RECEIPT_VALID_UNCORROBORATED with "station's statement" wording
test("personal receipt, no approver configured -> PASS RECEIPT_VALID_UNCORROBORATED with station's statement wording", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt({ authority: "personal" }),
    prNumber: PR,
    approverLogin: "",
    approverApproved: null,
  });
  assert.equal(d.verdict, "PASS");
  assert.equal(d.code, "RECEIPT_VALID_UNCORROBORATED");
  assert.match(d.message, /station's statement/);
  assert.match(d.message, /no approver identity is configured/);
});

// New test 8a: personal, approver configured, not approved -> FAIL PERSONAL_NOT_CORROBORATED
test("personal receipt, approver configured, not approved -> FAIL PERSONAL_NOT_CORROBORATED", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt({ authority: "personal" }),
    prNumber: PR,
    approverLogin: "marco-approver",
    approverApproved: false,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "PERSONAL_NOT_CORROBORATED");
  assert.match(d.message, /marco-approver/);
});

// New test 8b: personal, approver configured, approved -> PASS RECEIPT_VALID_CORROBORATED
test("personal receipt, approver configured and approved -> PASS RECEIPT_VALID_CORROBORATED", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt({ authority: "personal" }),
    prNumber: PR,
    approverLogin: "marco-approver",
    approverApproved: true,
  });
  assert.equal(d.verdict, "PASS");
  assert.equal(d.code, "RECEIPT_VALID_CORROBORATED");
  assert.match(d.message, /marco-approver/);
});

// New test 8c: personal, approved_by: station-00 -> FAIL PERSONAL_NOT_MARCO
test("personal receipt with approved_by: station-00 -> FAIL PERSONAL_NOT_MARCO", () => {
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: true,
    receiptInDiff: true,
    receiptBody: receipt({ authority: "personal", approved_by: "station-00" }),
    prNumber: PR,
    approverLogin: "",
    approverApproved: null,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "PERSONAL_NOT_MARCO");
  assert.match(d.message, /station-00/);
});

// New test 9: Lane matching (pure helper tests)
// 9a: all-sot/ diff plus the receipt matches sot
test("lane matching: all sot/ diff plus receipt -> sot lane matches", () => {
  // Simulate what approval-receipt-check.mjs computes for laneMatches.
  // nonReceiptPaths = ["sot/02-progress.md", "sot/03-roadmap.md"]
  // All start with "sot/" -> sot lane matches
  const nonReceiptPaths = ["sot/02-progress.md", "sot/03-roadmap.md"];
  const sotMatches = nonReceiptPaths.every((p) => p.startsWith("sot/"));
  assert.equal(sotMatches, true);

  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: false,
    receiptInDiff: true,
    receiptBody: receipt({ authority: "standing", approved_by: "station-00", lane: "sot" }),
    prNumber: PR,
    requiredByDiff: true,
    requiredReason: "outside tests/ or docs/: sot/02-progress.md",
    diffHasMigration: false,
    laneMatches: { sot: sotMatches, instrument: false },
  });
  assert.equal(d.verdict, "PASS");
  assert.equal(d.code, "RECEIPT_VALID_STANDING");
});

// 9b: one scripts/ path breaks the sot match
test("lane matching: one scripts/ path breaks sot match", () => {
  const nonReceiptPaths = ["sot/02-progress.md", "scripts/pipeline/something.mjs"];
  const sotMatches = nonReceiptPaths.every((p) => p.startsWith("sot/"));
  assert.equal(sotMatches, false);

  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: false,
    receiptInDiff: true,
    receiptBody: receipt({ authority: "standing", approved_by: "station-00", lane: "sot" }),
    prNumber: PR,
    requiredByDiff: true,
    requiredReason: "outside tests/ or docs/: scripts/pipeline/something.mjs",
    diffHasMigration: false,
    laneMatches: { sot: sotMatches, instrument: false },
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "STANDING_OUTSIDE_LANE");
});

// 9c: missing instrument-lane.json means instrument never matches
test("lane matching: missing instrument-lane.json -> instrument lane never matches", () => {
  // When instrument-lane.json is not present, instrument is always false.
  const laneMatches = { sot: false, instrument: false };
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: false,
    receiptInDiff: true,
    receiptBody: receipt({ authority: "standing", approved_by: "station-00", lane: "instrument" }),
    prNumber: PR,
    requiredByDiff: true,
    requiredReason: "outside tests/ or docs/: scripts/pipeline/something.mjs",
    diffHasMigration: false,
    laneMatches,
  });
  assert.equal(d.verdict, "FAIL");
  assert.equal(d.code, "STANDING_OUTSIDE_LANE");
});

// New test 10: Negative control -- requiredByDiff=false with apps/ diff does NOT turn red
test("negative control: requiredByDiff=false with apps/ diff -> PASS NEVER_ESCALATED (the requiredByDiff term is what arms case 3)", () => {
  // With requiredByDiff=false and not everLabeled, the gate passes regardless of what
  // the diff contains. This mirrors the existing everLabeled negative control: the test
  // must show that it IS requiredByDiff=true that turns the apps/-path case red.
  const d = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: false,
    receiptInDiff: false,
    receiptBody: null,
    prNumber: PR,
    requiredByDiff: false,   // the term under test -- set false
    requiredReason: "outside tests/ or docs/: apps/api/src/foo/bar.ts",
  });
  assert.equal(d.verdict, "PASS");
  assert.equal(d.code, "NEVER_ESCALATED");

  // Confirm: with requiredByDiff=true and no receipt, the same diff turns red.
  const d2 = decideApprovalReceipt({
    labelPresent: false,
    everLabeled: false,
    receiptInDiff: false,
    receiptBody: null,
    prNumber: PR,
    requiredByDiff: true,   // the term under test -- set true
    requiredReason: "outside tests/ or docs/: apps/api/src/foo/bar.ts",
  });
  assert.equal(d2.verdict, "FAIL");
  assert.equal(d2.code, "RECEIPT_REQUIRED_BY_DIFF");

  console.log("negative control: requiredByDiff=false -> PASS, requiredByDiff=true -> FAIL -- the term is load-bearing");
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
