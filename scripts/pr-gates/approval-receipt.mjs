// Approval-receipt logic for CP-26 (part of the pr-gates suite). Pure module:
// no I/O, no imports beyond Node built-ins, ASCII-only strings. Node built-ins
// are only used for types; nothing is actually imported here.
//
// CP26_ARMED_BY_DIFF_V1
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
//   labelPresent       boolean  -- is `do-not-merge` currently on the PR
//   everLabeled        boolean  -- has `do-not-merge` ever been applied (from
//                                  wasEverEscalated over the events API)
//   receiptInDiff      boolean  -- is docs/decisions/merge-approvals/<pr>.md
//                                  present in this PR's diff against merge-base
//   receiptBody        string   -- the file's contents (null/undefined if absent)
//   prNumber           number|string -- the PR number under test
//   requiredByDiff     boolean  -- is a receipt required by what the PR changes
//                                  (migration file or path outside tests/docs)
//   requiredReason     string   -- why requiredByDiff is true (e.g. "migration file: ...")
//   diffHasMigration   boolean  -- at least one diff path is under migrations/
//   laneMatches        object   -- { sot: boolean, instrument: boolean }
//   approverLogin      string   -- MARCO_APPROVER_LOGIN env var (empty if not configured)
//   approverApproved   boolean|null -- true/false when login is set; null when not configured
//
// Verdicts (in order of evaluation):
//   labelPresent                                                -> FAIL LABEL_PRESENT
//   !everLabeled && !requiredByDiff                             -> PASS NEVER_ESCALATED
//   receiptRequired (everLabeled || requiredByDiff) && !receiptInDiff:
//     if everLabeled:                                           -> FAIL RELEASED_NO_RECEIPT
//     else:                                                     -> FAIL RECEIPT_REQUIRED_BY_DIFF
//   receipt present, malformed front matter                     -> FAIL RECEIPT_MALFORMED_FRONT_MATTER
//   receipt present, missing pr / approved_by / approved_at    -> FAIL RECEIPT_MISSING_<FIELD>
//   receipt present, approved_at unparseable                   -> FAIL RECEIPT_INVALID_APPROVED_AT
//   receipt present, pr != this PR                             -> FAIL RECEIPT_WRONG_PR
//   receipt present, no body content                           -> FAIL RECEIPT_EMPTY_BODY
//   receipt present, no authority field                        -> FAIL RECEIPT_MISSING_AUTHORITY
//   receipt present, authority not personal|standing           -> FAIL RECEIPT_INVALID_AUTHORITY
//   authority: standing, PR was ever labelled                  -> FAIL STANDING_ON_LABELLED_PR
//   authority: standing, diff has a migration                  -> FAIL STANDING_NOT_ALLOWED_FOR_MIGRATION
//   authority: standing, lane missing/unknown/not matched      -> FAIL STANDING_OUTSIDE_LANE
//   authority: standing, approved_by is marco                  -> FAIL STANDING_CLAIMS_MARCO
//   authority: standing (all checks pass)                      -> PASS RECEIPT_VALID_STANDING
//   authority: personal, approved_by != marco                  -> FAIL PERSONAL_NOT_MARCO
//   authority: personal, approverApproved === false            -> FAIL PERSONAL_NOT_CORROBORATED
//   authority: personal, approverApproved === true             -> PASS RECEIPT_VALID_CORROBORATED
//   authority: personal, approverLogin empty                   -> PASS RECEIPT_VALID_UNCORROBORATED

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

// Check whether the diff's non-receipt paths all fall under standing-lanes.json's
// lane definition for laneKey. Returns true/false.
// laneMatches is pre-computed by the caller (approval-receipt-check.mjs) and passed in.
function checkLane(lane, laneMatches) {
  if (!laneMatches || typeof laneMatches !== "object") return false;
  return laneMatches[lane] === true;
}

export function decideApprovalReceipt(input) {
  const {
    labelPresent,
    everLabeled,
    receiptInDiff,
    receiptBody,
    prNumber,
    requiredByDiff = false,
    requiredReason = "",
    diffHasMigration = false,
    laneMatches = {},
    approverLogin = "",
    approverApproved = null,
  } = input || {};

  // 1. Label present -> always fail, no receipt can override this.
  if (labelPresent) {
    return {
      verdict: "FAIL",
      code: "LABEL_PRESENT",
      message:
        "PR carries the do-not-merge label (escalates:true). A human must review " +
        "and REMOVE the label; removing it is what releases the merge.",
    };
  }

  // 2. Not ever labeled AND not required by diff -> pass.
  if (!everLabeled && !requiredByDiff) {
    return {
      verdict: "PASS",
      code: "NEVER_ESCALATED",
      message: "label absent and never applied; no approval receipt required.",
    };
  }

  // 3. Receipt is required but not in diff.
  if (!receiptInDiff) {
    if (everLabeled) {
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
    return {
      verdict: "FAIL",
      code: "RECEIPT_REQUIRED_BY_DIFF",
      message:
        `PR #${prNumber} touches files that require an approval receipt ` +
        `(${requiredReason}), but ` +
        `docs/decisions/merge-approvals/${prNumber}.md is not in this PR's ` +
        `diff against merge-base with origin/main. Commit the receipt on the ` +
        `PR branch so the approval leaves an authored, reviewable artefact.`,
    };
  }

  // 4. Parse the receipt.
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

  // 4. Check authority field.
  const authority = fields.authority;
  if (authority === undefined || authority === "") {
    return {
      verdict: "FAIL",
      code: "RECEIPT_MISSING_AUTHORITY",
      message:
        'receipt front matter missing required field "authority"; ' +
        'set to "personal" (Marco released this PR himself) or ' +
        '"standing" (merged under Marco\'s standing instruction, inside a lane CI can check)',
    };
  }
  if (authority !== "personal" && authority !== "standing") {
    return {
      verdict: "FAIL",
      code: "RECEIPT_INVALID_AUTHORITY",
      message:
        `receipt "authority: ${authority}" is not valid; ` +
        'must be "personal" or "standing"',
    };
  }

  // 5. authority: standing checks.
  if (authority === "standing") {
    if (everLabeled) {
      return {
        verdict: "FAIL",
        code: "STANDING_ON_LABELLED_PR",
        message:
          "a PR that was ever labelled do-not-merge is always a personal release; " +
          'use authority: personal',
      };
    }
    if (diffHasMigration) {
      return {
        verdict: "FAIL",
        code: "STANDING_NOT_ALLOWED_FOR_MIGRATION",
        message:
          "standing authority is not permitted on a PR that contains a migration file; " +
          'use authority: personal',
      };
    }
    const lane = fields.lane;
    if (!lane || !checkLane(lane, laneMatches)) {
      const laneMsg = !lane
        ? 'receipt is missing the "lane" field (required for authority: standing)'
        : `receipt "lane: ${lane}" is not a known lane or its path check did not match`;
      return {
        verdict: "FAIL",
        code: "STANDING_OUTSIDE_LANE",
        message:
          laneMsg +
          "; see scripts/pr-gates/standing-lanes.json for the list of valid lanes",
      };
    }
    if (fields.approved_by === "marco") {
      return {
        verdict: "FAIL",
        code: "STANDING_CLAIMS_MARCO",
        message:
          'a standing receipt names the station that merged, never "marco"; ' +
          'set approved_by to the station name (e.g. station-00)',
      };
    }
    return {
      verdict: "PASS",
      code: "RECEIPT_VALID_STANDING",
      message:
        `approved_by=${fields.approved_by} approved_at=${fields.approved_at} lane=${lane}`,
    };
  }

  // 6. authority: personal checks.
  if (fields.approved_by !== "marco") {
    return {
      verdict: "FAIL",
      code: "PERSONAL_NOT_MARCO",
      message:
        `receipt "approved_by: ${fields.approved_by}" for authority: personal must be "marco"`,
    };
  }
  if (approverLogin && approverApproved === false) {
    return {
      verdict: "FAIL",
      code: "PERSONAL_NOT_CORROBORATED",
      message:
        `receipt claims approved_by=marco but the approver identity (${approverLogin}) ` +
        "has not submitted an approving review on the current head commit",
    };
  }
  if (approverLogin && approverApproved === true) {
    return {
      verdict: "PASS",
      code: "RECEIPT_VALID_CORROBORATED",
      message:
        `approved_by=${fields.approved_by} approved_at=${fields.approved_at} ` +
        `corroborated by approver identity ${approverLogin}`,
    };
  }
  // approverLogin is empty -- uncorroborated personal release.
  return {
    verdict: "PASS",
    code: "RECEIPT_VALID_UNCORROBORATED",
    message:
      `approved_by=${fields.approved_by} approved_at=${fields.approved_at}; ` +
      "approved_by=marco is a station's statement; no approver identity is configured to confirm it",
  };
}
