// Approval-receipt logic for CP-26 (part of the pr-gates suite). Pure module:
// no I/O, no imports beyond Node built-ins, ASCII-only strings. Node built-ins
// are only used for types; nothing is actually imported here.
//
// Context (why this file exists): CP-26's original mechanism read the live
// `do-not-merge` label and passed the gate when the label was absent. Both the
// watcher (which applied the label) and Marco (who released it) authenticated
// as `GH-Mantova`, so a released escalation was indistinguishable in the audit
// trail from an agent clearing its own gate. This module adds a second piece of
// evidence -- a committed receipt file in the PR diff -- so the approval leaves
// an authored, timestamped artefact instead of a click that no one can
// attribute. It does NOT make forgery impossible; it makes forgery visible.
//
// Two exported functions and nothing else:
//   wasEverEscalated(events)         -> boolean
//   decideApprovalReceipt(input)     -> { verdict, code, message }
//
// Input to decideApprovalReceipt:
//   labelPresent   boolean  -- is `do-not-merge` currently on the PR
//   everLabeled    boolean  -- has `do-not-merge` ever been applied (from
//                              wasEverEscalated over the events API)
//   receiptInDiff  boolean  -- is docs/decisions/merge-approvals/<pr>.md
//                              present in this PR's diff against merge-base
//   receiptBody    string   -- the file's contents (null/undefined if absent)
//   prNumber       number|string -- the PR number under test
//
// Verdicts:
//   labelPresent                                            -> FAIL LABEL_PRESENT
//   !labelPresent && !everLabeled                           -> PASS NEVER_ESCALATED
//   !labelPresent && everLabeled && !receiptInDiff          -> FAIL RELEASED_NO_RECEIPT
//   receipt present, malformed front matter                 -> FAIL RECEIPT_MALFORMED_FRONT_MATTER
//   receipt present, missing pr / approved_by / approved_at -> FAIL RECEIPT_MISSING_<FIELD>
//   receipt present, approved_at unparseable                -> FAIL RECEIPT_INVALID_APPROVED_AT
//   receipt present, pr != this PR                          -> FAIL RECEIPT_WRONG_PR
//   receipt present, no body content                        -> FAIL RECEIPT_EMPTY_BODY
//   otherwise                                               -> PASS RECEIPT_VALID

export function wasEverEscalated(events) {
  if (!Array.isArray(events)) return false;
  for (const e of events) {
    if (!e || typeof e !== "object") continue;
    if (e.event !== "labeled") continue;
    const label = e.label;
    if (!label || typeof label !== "object") continue;
    if (label.name === "do-not-merge") return true;
  }
  return false;
}

// Minimal YAML front-matter parser -- three scalar fields only. Anything more
// invites a real YAML dep and this module MUST stay Node-built-ins-only.
// Returns { fields, bodyHasContent } on success, or { error } on shape failure.
function parseReceipt(body) {
  if (typeof body !== "string" || body.length === 0) {
    return { error: "file is empty or missing" };
  }
  const m = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) {
    return { error: "missing YAML front matter delimited by --- lines" };
  }
  const front = m[1];
  const rest = m[2];
  const fields = {};
  for (const line of front.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const fm = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*?)\s*$/);
    if (!fm) continue;
    fields[fm[1]] = fm[2];
  }
  const bodyHasContent = rest.split(/\r?\n/).some((l) => l.trim().length > 0);
  return { fields, bodyHasContent };
}

export function decideApprovalReceipt(input) {
  const {
    labelPresent,
    everLabeled,
    receiptInDiff,
    receiptBody,
    prNumber,
  } = input || {};

  if (labelPresent) {
    return {
      verdict: "FAIL",
      code: "LABEL_PRESENT",
      message:
        "PR carries the do-not-merge label (escalates:true). A human must review " +
        "and REMOVE the label; removing it is what releases the merge.",
    };
  }

  if (!everLabeled) {
    return {
      verdict: "PASS",
      code: "NEVER_ESCALATED",
      message: "label absent and never applied; no approval receipt required.",
    };
  }

  if (!receiptInDiff) {
    return {
      verdict: "FAIL",
      code: "RELEASED_NO_RECEIPT",
      message:
        `PR #${prNumber} was labelled do-not-merge and released, but ` +
        `docs/decisions/merge-approvals/${prNumber}.md is not in this PR's ` +
        `diff against merge-base with origin/main. Commit the receipt on the ` +
        `PR branch so the approval leaves an authored, reviewable artefact.`,
    };
  }

  const parsed = parseReceipt(receiptBody);
  if (parsed.error) {
    return {
      verdict: "FAIL",
      code: "RECEIPT_MALFORMED_FRONT_MATTER",
      message: `receipt ${parsed.error}`,
    };
  }

  const { fields, bodyHasContent } = parsed;

  if (fields.pr === undefined || fields.pr === "") {
    return {
      verdict: "FAIL",
      code: "RECEIPT_MISSING_PR",
      message: 'receipt front matter missing required field "pr"',
    };
  }
  const prAsNum = Number(fields.pr);
  const targetPr = Number(prNumber);
  if (
    !Number.isInteger(prAsNum) ||
    !Number.isInteger(targetPr) ||
    prAsNum !== targetPr
  ) {
    return {
      verdict: "FAIL",
      code: "RECEIPT_WRONG_PR",
      message:
        `receipt "pr: ${fields.pr}" does not match this PR #${prNumber}. ` +
        `A receipt copied from another PR does not count.`,
    };
  }

  if (fields.approved_by === undefined || fields.approved_by === "") {
    return {
      verdict: "FAIL",
      code: "RECEIPT_MISSING_APPROVED_BY",
      message: 'receipt front matter missing required field "approved_by"',
    };
  }

  if (fields.approved_at === undefined || fields.approved_at === "") {
    return {
      verdict: "FAIL",
      code: "RECEIPT_MISSING_APPROVED_AT",
      message: 'receipt front matter missing required field "approved_at"',
    };
  }
  if (Number.isNaN(Date.parse(fields.approved_at))) {
    return {
      verdict: "FAIL",
      code: "RECEIPT_INVALID_APPROVED_AT",
      message:
        `receipt "approved_at: ${fields.approved_at}" does not parse as a date`,
    };
  }

  if (!bodyHasContent) {
    return {
      verdict: "FAIL",
      code: "RECEIPT_EMPTY_BODY",
      message:
        "receipt has no body content after the front matter; add at least " +
        "one non-empty line saying why this was approved",
    };
  }

  return {
    verdict: "PASS",
    code: "RECEIPT_VALID",
    message:
      `approved_by=${fields.approved_by} approved_at=${fields.approved_at}`,
  };
}
