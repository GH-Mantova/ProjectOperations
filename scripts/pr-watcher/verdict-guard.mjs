// verdict-guard.mjs — pure guard that validates a review verdict against the
// actual list of files in the PR it claims to review.
//
// A stale watcher clone can cause the review agent to describe files that are
// in its local main but not in the PR under review. This guard catches those
// phantom references before the verdict is mirrored to GitHub and before it
// can arm auto-merge.
//
// Pure: no I/O, no fs, no child_process. All state is passed in.

/**
 * Normalize a path string to forward-slash form, stripping any leading `./`.
 * @param {string} p
 * @returns {string}
 */
function normPath(p) {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Strip a trailing line-number or line-range suffix of the form `:N` or `:N-M`,
 * then strip any trailing punctuation characters `.,;:)]`.
 * @param {string} raw
 * @returns {string}
 */
function stripSuffix(raw) {
  // Strip :line or :line-range at the end (e.g. foo.ts:1601 or foo.ts:12-34)
  let s = raw.replace(/:\d+(-\d+)?$/, "");
  // Strip trailing punctuation
  s = s.replace(/[.,;:)\]]+$/, "");
  return s;
}

// Matches a path-like token: must contain at least one `/`, must have a
// file extension (dot followed by 1–10 non-dot, non-space word chars at end,
// optionally followed by the line-number suffix we strip).
const PATH_TOKEN_RE = /[^\s`'"<>()[\]{}|,;]+\/[^\s`'"<>()[\]{}|,;]+\.[a-zA-Z0-9]{1,10}(:\d+(-\d+)?)?/g;

// Prefix for paths that are legitimately absent from prFiles (they are the
// review/prompt files themselves, written by the watcher).
const IGNORED_PREFIXES = ["docs/pr-reviews/", "docs/pr-prompts/"];

/**
 * Extract every path-shaped token from a verdict text.
 *
 * Two extraction modes:
 *  1. Backtick-quoted spans that look like paths (e.g. `apps/api/src/foo.ts`)
 *  2. Bare path-like tokens with at least one `/` and a file extension.
 *
 * Results are normalised (forward slashes, no leading `./`).
 * Line-number suffixes and trailing punctuation are stripped.
 *
 * @param {string} text
 * @returns {string[]} unique, sorted extracted paths
 */
function extractPaths(text) {
  const found = new Set();

  // Pass 1: backtick spans
  const btRe = /`([^`\n]+)`/g;
  let btMatch;
  while ((btMatch = btRe.exec(text)) !== null) {
    const inner = btMatch[1].trim();
    // Must look path-like: contains `/` and has an extension
    if (/\//.test(inner) && /\.[a-zA-Z0-9]{1,10}(:\d+(-\d+)?)?$/.test(inner)) {
      const stripped = normPath(stripSuffix(inner));
      if (stripped) found.add(stripped);
    }
  }

  // Pass 2: bare path tokens (avoid re-extracting what's already in backticks
  // by searching a copy with backtick spans blanked out)
  const blanked = text.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
  let tokenMatch;
  PATH_TOKEN_RE.lastIndex = 0;
  while ((tokenMatch = PATH_TOKEN_RE.exec(blanked)) !== null) {
    const raw = tokenMatch[0];
    const stripped = normPath(stripSuffix(raw));
    if (stripped && /\//.test(stripped)) {
      found.add(stripped);
    }
  }

  return [...found].sort();
}

/**
 * Decide whether a single extracted path matches the PR's file list.
 *
 * A path "matches" if it:
 *  - appears verbatim in prFiles (after normalisation), OR
 *  - is a suffix of a prFiles entry (to tolerate future repo-prefix changes).
 *
 * @param {string} candidate  normalised extracted path
 * @param {Set<string>} prSet  normalised prFiles as a Set for O(1) lookup
 * @param {string[]} prArr    normalised prFiles as an array for suffix check
 * @returns {boolean}
 */
function pathMatches(candidate, prSet, prArr) {
  if (prSet.has(candidate)) return true;
  // Suffix match: the PR file ends with /candidate or equals candidate
  return prArr.some((pf) => pf === candidate || pf.endsWith("/" + candidate));
}

// WHICH LINES ASSERT WHAT THE PR CHANGED.
//
// A verdict cites paths for two different reasons, and only one of them is a claim
// about the diff:
//
//   - "In scope: scripts/pr-watcher/index.mjs"  <- an ASSERTION. If that file is not
//     in the PR the reviewer is describing work it did not review, which is the whole
//     reason this guard exists.
//   - "Test case PR #1374 (scripts/pipeline/__tests__/check-breadcrumb...)"  <- EVIDENCE.
//     The reviewer is naming what it exercised. Those files are SUPPOSED to be absent
//     from the diff.
//
// Scanning the whole document conflates the two, and the incentive runs backwards: a
// verdict that says only "looks fine" passes, while one that shows its work is blocked.
// MEASURED 2026-09-04: eight PRs blocked this way - #1542 #1543 #1544 #1545 #1561 #1563
// #1564 #1572 - and #1543/#1544 then sat ~15 h waiting for a human. #1572's verdict was
// correct: it cited index.mjs (in the PR) plus a test case, a substring trap and its
// originating prompt (all correctly absent).
//
// FAILS CLOSED. A verdict with no in-scope line is scanned WHOLE, exactly as before, so
// free-prose verdicts keep their existing protection. Narrowing only ever applies where
// the verdict has explicitly stated its claim.
const IN_SCOPE_LINE_RE = /^[\s>*+-]*(?:\*\*)?in[ _-]?scope(?:\*\*)?\s*:(.*)$/gim;

/**
 * Return only the text of the verdict's in-scope assertions, or null when the
 * verdict makes none (in which case the caller scans the whole document).
 *
 * `Out of scope:` lines are deliberately NOT collected: a path named there is being
 * declared ABSENT from the diff, so requiring it to be present would invert the check.
 *
 * @param {string} text
 * @returns {string|null}
 */
function inScopeAssertions(text) {
  const lines = [];
  let m;
  IN_SCOPE_LINE_RE.lastIndex = 0;
  while ((m = IN_SCOPE_LINE_RE.exec(text)) !== null) {
    if (/^[\s>*+-]*(?:\*\*)?out[ _-]?of[ _-]?scope/i.test(m[0])) continue;
    lines.push(m[1]);
  }
  return lines.length ? lines.join("\n") : null;
}

/**
 * Validate a review verdict against the actual list of files in the PR.
 *
 * @param {object} opts
 * @param {string}   opts.verdictText  Raw review markdown (the full file body).
 * @param {string[]} opts.prFiles      Path strings from `gh pr view --json files`.
 *
 * @returns {{ ok: true } | { ok: false, unmatched: string[] }}
 */
export function validateVerdict({ verdictText, prFiles }) {
  const prNorm = (prFiles ?? []).map(normPath);
  const prSet = new Set(prNorm);

  // Narrow to the verdict's own claim when it makes one; otherwise scan it all.
  const claims = inScopeAssertions(verdictText ?? "");
  const candidates = extractPaths(claims ?? verdictText ?? "");

  // Filter out paths that are legitimately not in prFiles (review/prompt files
  // written by the watcher itself — the agent won't have touched those).
  const checked = candidates.filter(
    (p) => !IGNORED_PREFIXES.some((prefix) => p.startsWith(prefix)),
  );

  if (checked.length === 0) {
    // Either no paths at all, or all paths were in the ignored-prefix list.
    // Both cases are valid: not every verdict cites file paths.
    return { ok: true };
  }

  const unmatched = checked
    .filter((p) => !pathMatches(p, prSet, prNorm))
    .sort();

  // Deduplicate (extractPaths already returns unique, but keep it explicit)
  const uniqueUnmatched = [...new Set(unmatched)].sort();

  if (uniqueUnmatched.length === 0) {
    return { ok: true };
  }
  return { ok: false, unmatched: uniqueUnmatched };
}
