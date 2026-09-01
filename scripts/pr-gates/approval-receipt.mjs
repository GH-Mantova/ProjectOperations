// approval-receipt: pure predicates for the CP-26 human-approval receipt.
// Node built-ins only. ASCII-only output. NO filesystem, NO network, NO child_process.
// All I/O (gh, git, fs) lives in the sibling entrypoint approval-receipt-check.mjs
// and in pr-gates.mjs; this module is imported by both AND by node --test.
//
// The problem this module encodes:
//
// CP-26 today reads the LIVE do-not-merge label on a PR. Removing the label is
// documented in pr-gates.mjs as "the human's approval". The watcher and Marco
// both authenticate as GH-Mantova, so `UNLABELED by GH-Mantova` in the events
// stream is indistinguishable between "Marco released the gate" and "an agent
// cleared its own gate". This module adds a second, in-diff artefact: a
// receipt file docs/decisions/merge-approvals/<pr>.md, authored and committed
// as part of the PR. It does NOT make forgery impossible - a receipt is still
// a commit anyone with write access can make - but it converts the approval
// from a click that leaves no trace into a commit that is authored,
// timestamped and reviewable in the PR diff.
//
// Truth table implemented by decideApprovalReceipt (in evaluation order):
//   1. labelPresent                              -> FAIL LABEL_PRESENT
//   2. !labelPresent && !everLabeled             -> PASS NEVER_ESCALATED
//   3. !labelPresent && everLabeled && !receiptInDiff
//                                                -> FAIL RECEIPT_MISSING
//   4. receipt present but malformed             -> FAIL RECEIPT_MALFORMED
//   5. receipt present and valid                 -> PASS RECEIPT_VALID
//
// A receipt sitting on origin/main from an earlier PR does NOT count for this
// PR: receiptInDiff must reflect "this file appears in the diff against the
// merge-base", not "this file exists in the tree". That check happens in the
// entrypoint - this module just receives the boolean.

// ---------------------------------------------------------------------------
// wasEverEscalated - was the do-not-merge label ever applied to this PR?
//
// Takes the parsed array returned by `gh api repos/{owner}/{repo}/issues/<pr>/events`.
// Returns true iff any row is { event: "labeled", label: { name: "do-not-merge" } }.
//
// Tolerates null / undefined / partial rows the way hasDeclaredDependencies
// (scripts/pr-watcher/index.mjs) does: this runs on the hot path of a
// required check and a throw here fails the whole PR check for a malformed
// row that has nothing to do with the approval flow.
// ---------------------------------------------------------------------------
export function wasEverEscalated(events) {
  if (!Array.isArray(events)) return false;
  for (const row of events) {
    if (!row || typeof row !== "object") continue;
    if (row.event !== "labeled") continue;
    const label = row.label;
    if (!label || typeof label !== "object") continue;
    if (label.name === "do-not-merge") return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// parseReceipt - parse a receipt markdown file into { front, body }.
//
// Deliberately narrow: recognises exactly the shape documented in
// docs/decisions/merge-approvals/README.md:
//
//   ---
//   pr: 1431
//   approved_by: marco
//   approved_at: 2026-08-31T05:53:54Z
//   ---
//
//   Free-form justification, at least one non-empty line.
//
// Returns:
//   { ok: true, front: { pr, approved_by, approved_at }, body: string }
//   { ok: false, reason: <short human-readable string> }
//
// No YAML library - this is a fixed four-key document, and adding a
// dependency to parse four lines is exactly the kind of drift the pipeline
// tests exist to prevent. Values are trimmed. Quotes around string values
// are stripped if present on both ends.
// ---------------------------------------------------------------------------
function parseReceipt(text) {
  if (typeof text !== "string" || text.length === 0) {
    return { ok: false, reason: "receipt is empty" };
  }
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== "---") {
    return { ok: false, reason: "missing opening --- front-matter fence" };
  }
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") { closeIdx = i; break; }
  }
  if (closeIdx === -1) {
    return { ok: false, reason: "missing closing --- front-matter fence" };
  }
  const front = {};
  for (let i = 1; i < closeIdx; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) {
      return { ok: false, reason: "unparseable front-matter line: " + JSON.stringify(line) };
    }
    let value = m[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    front[m[1]] = value;
  }
  const body = lines.slice(closeIdx + 1).join("\n");
  return { ok: true, front, body };
}

// ---------------------------------------------------------------------------
// validateReceipt - are the four required fields present, well-formed, and
// tied to THIS PR?
//
// Returns { ok: true } or { ok: false, reason: <string naming the field> }.
//
// The four required-field checks are separated so tests can name each one:
//   - pr must equal prNumber (a receipt copied from another PR fails)
//   - approved_by must be a non-empty string
//   - approved_at must parse as a date (Date.parse != NaN)
//   - at least one non-empty line after the front matter
// ---------------------------------------------------------------------------
function validateReceipt(parsed, prNumber) {
  if (!parsed || !parsed.ok) {
    return { ok: false, reason: parsed && parsed.reason ? parsed.reason : "receipt did not parse" };
  }
  const { front, body } = parsed;
  if (front.pr === undefined || front.pr === "") {
    return { ok: false, reason: "receipt missing required field: pr" };
  }
  const prAsNumber = Number(front.pr);
  if (!Number.isInteger(prAsNumber)) {
    return { ok: false, reason: "receipt field pr is not an integer: " + JSON.stringify(front.pr) };
  }
  if (prAsNumber !== Number(prNumber)) {
    return {
      ok: false,
      reason:
        "receipt field pr (" + prAsNumber + ") does not match this PR (" + prNumber + ") - " +
        "a receipt copied from another PR does not count",
    };
  }
  if (!front.approved_by || String(front.approved_by).trim() === "") {
    return { ok: false, reason: "receipt missing required field: approved_by" };
  }
  if (!front.approved_at || String(front.approved_at).trim() === "") {
    return { ok: false, reason: "receipt missing required field: approved_at" };
  }
  const ts = Date.parse(String(front.approved_at));
  if (Number.isNaN(ts)) {
    return {
      ok: false,
      reason: "receipt field approved_at does not parse as a date: " + JSON.stringify(front.approved_at),
    };
  }
  const bodyLines = String(body || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (bodyLines.length === 0) {
    return { ok: false, reason: "receipt body has no non-empty lines - the justification is required" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// decideApprovalReceipt - the single decision function CP-26 and the
// approval-receipt CI job both call.
//
// Input:
//   {
//     labelPresent:   boolean,   // do-not-merge label CURRENTLY on the PR?
//     everLabeled:    boolean,   // was do-not-merge EVER applied? (events log)
//     receiptInDiff:  boolean,   // is docs/decisions/merge-approvals/<pr>.md
//                                //   in the diff against the merge-base?
//     receiptBody:    string|null,  // its contents, or null if not in diff
//     prNumber:       number|string,
//   }
//
// Output:
//   { verdict: "PASS"|"FAIL", code: <string>, message: <string> }
//
// PASS strings for the label-present and never-escalated cases are
// byte-identical to what CP-26 emitted BEFORE this module existed. Other
// tooling greps that output. Do not "improve" those strings without also
// updating whatever grep breaks.
// ---------------------------------------------------------------------------
export function decideApprovalReceipt(input) {
  const labelPresent = !!(input && input.labelPresent);
  const everLabeled = !!(input && input.everLabeled);
  const receiptInDiff = !!(input && input.receiptInDiff);
  const receiptBody = input ? input.receiptBody : null;
  const prNumber = input ? input.prNumber : undefined;

  if (labelPresent) {
    return {
      verdict: "FAIL",
      code: "LABEL_PRESENT",
      message:
        "PR carries the do-not-merge label (escalates:true). A human must review and REMOVE " +
        "the label; removing it is what releases the merge.",
    };
  }
  if (!everLabeled) {
    return { verdict: "PASS", code: "NEVER_ESCALATED", message: "label absent" };
  }
  if (!receiptInDiff) {
    return {
      verdict: "FAIL",
      code: "RECEIPT_MISSING",
      message:
        "PR was escalated (do-not-merge label was applied and later removed) but this PR's diff " +
        "does not contain a receipt at docs/decisions/merge-approvals/" + prNumber + ".md. " +
        "Removing the label alone is no longer sufficient: commit a receipt (see " +
        "docs/decisions/merge-approvals/README.md) and push it to the branch. The push is what " +
        "re-runs CI on the release.",
    };
  }
  const parsed = parseReceipt(receiptBody || "");
  const validation = validateReceipt(parsed, prNumber);
  if (!validation.ok) {
    return {
      verdict: "FAIL",
      code: "RECEIPT_MALFORMED",
      message:
        "receipt at docs/decisions/merge-approvals/" + prNumber + ".md is malformed: " +
        validation.reason,
    };
  }
  return {
    verdict: "PASS",
    code: "RECEIPT_VALID",
    message:
      "receipt at docs/decisions/merge-approvals/" + prNumber + ".md is present and valid " +
      "(approved_by=" + parsed.front.approved_by + ", approved_at=" + parsed.front.approved_at + ")",
  };
}
