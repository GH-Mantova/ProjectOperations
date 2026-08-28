/**
 * check-sot-refs.mjs — walk every sot/**\/*.md and verify every path-shaped
 * backtick reference resolves against one of the declared SEARCH_ROOTS
 * (repo root first, then the api/web source prefixes sot/ writes paths against —
 * see the SEARCH_ROOTS block below for the measurement that put them there).
 *
 * POLARITY — this is the ORDINARY direction (unlike check-lessons.mjs which is inverted):
 *   exit 0  = every extracted reference resolved, was explicitly allowlisted, was baselined,
 *             or fell under a declared path-class exclusion
 *   exit 1  = at least one reference dangled (not in baseline, not excluded)
 *   exit 1  = broken instrument: zero sot/ files found, OR zero references extracted
 *
 * The broken-instrument guard exists because a checker that reads clean because it
 * saw nothing is the exact failure mode this cluster exists to prevent (DOCTRINE §7).
 *
 * Extraction rule: backtick-quoted strings that:
 *   - contain a "/"
 *   - end with one of: .md .mjs .ts .tsx .js .ps1 .yaml .yml .sql .json
 *   - contain no spaces (ruling out command snippets like "node scripts/foo.mjs arg")
 *   - contain no glob metacharacters (* ?)
 *   - contain no shell metacharacters ($ { })
 *   - do not start with a URL scheme (http:// etc.) or GitHub web path (blob/)
 *
 * The total count of extracted references is always printed so a regex that silently
 * matches zero is visible as broken, not as a pass.
 *
 * Allowlist (inline): a reference on a line containing the inline HTML comment
 *   <!-- sot-ref-allow: <reason> -->
 * is exempted. Every exemption is printed with its reason — silent allowlists rot.
 *
 * Baseline: docs/qa/sot-refs-baseline.json records references that are genuinely
 * dangling but whose repair belongs to Station 05. Every baselined exemption is
 * printed on every run with its count — silent allowlists rot. This file may only
 * SHRINK. The CI ratchet rejects any PR that adds an entry.
 *
 * Path-class exclusions: certain structural path patterns are excluded by design
 * rather than per-entry, because they will always dangle. See EXCLUDED_PATH_CLASSES
 * below. Each exclusion is printed on every run.
 *
 * Usage:  node scripts/pipeline/check-sot-refs.mjs [--root <repoRoot>]
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// Support --root flag for tests that need a custom repo root
const rootArgIdx = process.argv.indexOf("--root");
const repoRoot = rootArgIdx !== -1 && process.argv[rootArgIdx + 1]
  ? path.resolve(process.argv[rootArgIdx + 1])
  : process.cwd();

// ---------------------------------------------------------------------------
// Walk sot/**/*.md recursively
// ---------------------------------------------------------------------------
function walkSot(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    let st;
    try {
      st = statSync(fullPath);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      results.push(...walkSot(fullPath));
    } else if (entry.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

const sotDir = path.join(repoRoot, "sot");
const sotFiles = walkSot(sotDir);

if (sotFiles.length === 0) {
  console.error("BROKEN: no sot/*.md files found under " + sotDir + " — instrument cannot read the input");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// BASELINE — docs/qa/sot-refs-baseline.json
//
// Records references that are genuinely dangling but whose repair belongs to
// Station 05 (sot/ is its exclusive domain). Every baselined exemption is
// printed on every run — silent allowlists rot.
//
// This file may ONLY SHRINK. The CI ratchet rejects any PR that adds an entry.
// Burn-down: fix the reference in sot/, delete its entry here, same PR.
// ---------------------------------------------------------------------------
const BASELINE_PATH = path.join(repoRoot, "docs", "qa", "sot-refs-baseline.json");
let baselineEntries = [];
if (existsSync(BASELINE_PATH)) {
  try {
    const raw = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
    baselineEntries = Array.isArray(raw.entries) ? raw.entries : [];
  } catch (err) {
    console.error("BROKEN: could not parse " + BASELINE_PATH + " — " + err.message);
    process.exit(1);
  }
}

function isBaselined(relFile, lineNum, refPath) {
  // Normalise Windows backslashes so baseline keys match on any OS
  const normFile = relFile.replace(/\\/g, "/");
  return baselineEntries.some(
    (e) => e.sot_file === normFile && e.line === lineNum && e.missing_path === refPath,
  );
}

// ---------------------------------------------------------------------------
// PATH-CLASS EXCLUSIONS — patterns excluded by design, not per-entry baseline.
//
// docs/pr-prompts/*-ready.md: armed prompts that the watcher consumes into
// docs/pr-prompts/processed/ by design. These files are guaranteed to be absent
// once the queue drains, and re-baselining them forever would make the baseline
// a noise source rather than a burn-down list. Exclude the whole pattern here.
// ---------------------------------------------------------------------------
const EXCLUDED_PATH_CLASSES = [
  {
    pattern: /^docs\/pr-prompts\/.*-ready\.md$/,
    reason: "armed prompts consumed by the watcher into processed/ by design — always absent after queue drains",
  },
];

function isPathClassExcluded(refPath) {
  const normalised = refPath.replace(/\\/g, "/").replace(/^\.\//, "");
  return EXCLUDED_PATH_CLASSES.find((cls) => cls.pattern.test(normalised)) || null;
}

// ---------------------------------------------------------------------------
// Extract path-shaped backtick references.
//
// A candidate must:
//   1. Be backtick-delimited
//   2. Contain a "/" (it is path-shaped)
//   3. End with an allowed extension
//   4. Contain no space (distinguishes file paths from command snippets)
//   5. Contain no glob chars (* ?) — globs are patterns, not real paths
//   6. Contain no shell metacharacters ($ { }) — these are expressions/templates
//   7. Not start with "http", "blob/", or "C:\" (URL/Windows-abs/GitHub web path)
// ---------------------------------------------------------------------------
const ALLOWED_EXT_RE = /\.(md|mjs|ts|tsx|js|ps1|yaml|yml|sql|json)$/;
// Outer: backtick-delimited string containing "/" and ending with an allowed ext
const RAW_REF_REGEX = /`([^`]*)\/([^`]*\.(md|mjs|ts|tsx|js|ps1|yaml|yml|sql|json))`/g;
// Allowlist comment pattern
const ALLOW_COMMENT_RE = /<!--\s*sot-ref-allow:\s*(.+?)\s*-->/;

function isSkippableRef(ref) {
  // Skip if contains space (command snippet)
  if (/\s/.test(ref)) return true;
  // Skip glob patterns
  if (/[*?]/.test(ref)) return true;
  // Skip shell metacharacters (template expressions, variable expansions)
  if (/[${}]/.test(ref)) return true;
  // Skip URL schemes and GitHub web paths
  if (/^https?:\/\//.test(ref)) return true;
  if (/^blob\//.test(ref)) return true;
  // Skip Windows absolute paths (C:\...)
  if (/^[A-Za-z]:\\/.test(ref)) return true;
  // Skip extension-slash-extension patterns like ".tsx/.ts" or ".ts/.tsx"
  // (these are Vite/TypeScript extension ordering notation, not file paths)
  if (/^\.[a-z]+\/\.[a-z]+$/.test(ref)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// SEARCH ROOTS — the conventions sot/ actually uses, declared explicitly.
//
// MEASURED 2026-08-27 against 115 "dangling" references: 87 of them (76%) were
// real files that the checker could not see because it only ever resolved from
// the repo root. sot/ writes source paths in three conventions, all deliberate:
//
//   sot/06-active-specs.md  "### `modules/permissions/permissions.controller.ts`"
//                           -> relative to apps/api/src            (68 refs)
//   sot/04-data-model.md    "exposed by `tendering/tender-convert.controller.ts`"
//                           -> relative to apps/api/src/modules    (17 refs)
//   assorted web refs       -> relative to apps/web/src            ( 2 refs)
//
// A resolver that does not know the convention reports a working document as
// broken, which is DOCTRINE §7's failure mode exactly: a confident, coherent,
// WRONG verdict about a healthy system. Order matters — first hit wins — and
// every hit under a non-repo-root prefix is COUNTED and PRINTED below, so this
// list can widen the search but can never widen it silently.
//
// Do NOT add a root to make a single stubborn reference pass. A path that only
// resolves under a module-local prefix (e.g. `builders/quote-html.builder.ts`,
// which is relative to whichever module the surrounding prose names) is prose,
// not a path — fix it in sot/, or allowlist it with a reason.
// ---------------------------------------------------------------------------
const SEARCH_ROOTS = ["", "apps/api/src", "apps/api/src/modules", "apps/web/src"];

let totalExtracted = 0;
const failures = [];
const exemptions = [];
const baselinedExemptions = [];
const pathClassExclusions = [];
const viaSearchRoot = new Map();

for (const filePath of sotFiles) {
  const relFile = path.relative(repoRoot, filePath);
  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (err) {
    console.error("BROKEN: could not read " + relFile + " — " + err.message);
    process.exit(1);
  }

  const lines = content.split(/\r?\n/);
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNum = lineIdx + 1;

    RAW_REF_REGEX.lastIndex = 0;
    let match;
    while ((match = RAW_REF_REGEX.exec(line)) !== null) {
      // Full matched content inside backticks: prefix + "/" + suffix
      const refPath = match[1] + "/" + match[2];

      // Apply skippable filter
      if (isSkippableRef(refPath)) continue;

      totalExtracted++;

      // Check for inline allowlist marker on this same line
      const allowMatch = ALLOW_COMMENT_RE.exec(line);
      if (allowMatch) {
        const reason = allowMatch[1].trim();
        exemptions.push({ file: relFile, line: lineNum, path: refPath, reason });
        continue;
      }

      // Check for path-class exclusion
      const excludedClass = isPathClassExcluded(refPath);
      if (excludedClass) {
        pathClassExclusions.push({ file: relFile, line: lineNum, path: refPath, reason: excludedClass.reason });
        continue;
      }

      // Strip leading "./" if present
      const normalized = refPath.startsWith("./") ? refPath.slice(2) : refPath;
      // Strip anchor fragment (#section-name) before checking existence
      const withoutFragment = normalized.replace(/#[^/]*$/, "");

      // Resolve against each declared search root, in order. The FIRST hit wins,
      // and any hit under a non-repo-root prefix is counted and reported so that
      // widening the search can never be silent.
      let resolvedRoot = null;
      for (const searchRoot of SEARCH_ROOTS) {
        if (existsSync(path.resolve(repoRoot, searchRoot, withoutFragment))) {
          resolvedRoot = searchRoot;
          break;
        }
      }

      if (resolvedRoot === null) {
        // Check baseline before counting as a failure
        if (isBaselined(relFile, lineNum, refPath)) {
          baselinedExemptions.push({ file: relFile, line: lineNum, path: refPath });
        } else {
          failures.push({ file: relFile, line: lineNum, path: refPath });
        }
      } else if (resolvedRoot !== "") {
        viaSearchRoot.set(resolvedRoot, (viaSearchRoot.get(resolvedRoot) || 0) + 1);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Broken-instrument guard: zero references is a broken regex, not a clean pass
// ---------------------------------------------------------------------------
if (totalExtracted === 0) {
  console.error(
    "BROKEN: extracted 0 references across " + sotFiles.length + " sot/ file(s) — " +
    "regex matched nothing; this is a broken instrument, not a clean result",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log("=== SOT-REF CHECK --- " + sotFiles.length + " sot/ file(s) scanned, " + totalExtracted + " reference(s) extracted");
console.log("");

if (exemptions.length > 0) {
  console.log("--- ALLOWLISTED (" + exemptions.length + ") --- every exemption printed so silent allowlists don't rot:");
  for (const ex of exemptions) {
    console.log("  EXEMPT  " + ex.file + ":" + ex.line + "  " + ex.path);
    console.log("          reason: " + ex.reason);
  }
  console.log("");
}

// Always print path-class exclusions so the exclusion list cannot silently grow without notice
if (pathClassExclusions.length > 0) {
  console.log("--- PATH-CLASS EXCLUDED (" + pathClassExclusions.length + ") --- consumed-prompt churn or other structural exclusions:");
  for (const ex of pathClassExclusions) {
    console.log("  EXCLUDED  " + ex.file + ":" + ex.line + "  " + ex.path);
    console.log("            reason: " + ex.reason);
  }
  console.log("");
}

// Always print baseline exemptions — silent allowlists rot.
// The count is the burn-down metric: Station 05 shrinks it one entry at a time.
if (baselinedExemptions.length > 0) {
  console.log("--- BASELINED EXEMPTIONS (" + baselinedExemptions.length + ") --- recorded in " + BASELINE_PATH.replace(repoRoot + path.sep, "").replace(repoRoot + "/", "") + " — may only SHRINK:");
  for (const ex of baselinedExemptions) {
    console.log("  BASELINED  " + ex.file + ":" + ex.line + "  " + ex.path);
  }
  console.log("");
  console.log("sot-refs: " + baselinedExemptions.length + " baselined exemptions remain (docs/qa/sot-refs-baseline.json) — may only shrink");
  console.log("");
}

if (viaSearchRoot.size > 0) {
  const viaTotal = [...viaSearchRoot.values()].reduce((a, b) => a + b, 0);
  console.log("--- RESOLVED VIA A NON-ROOT SEARCH PATH (" + viaTotal + ") --- printed so widening is never silent:");
  for (const [root, count] of [...viaSearchRoot.entries()].sort((a, b) => b[1] - a[1])) {
    console.log("  VIA  " + root + "/  = " + count + " reference(s)");
  }
  console.log("");
}

if (failures.length > 0) {
  console.log("!!! DANGLING REFERENCES (" + failures.length + ") --- these paths resolve under NONE of " +
    SEARCH_ROOTS.map((r) => (r === "" ? "<repoRoot>" : r + "/")).join(", ") + ":");
  for (const fail of failures) {
    console.log("  FAIL  " + fail.file + ":" + fail.line + "  " + fail.path);
  }
  console.log("");
  console.log("total=" + totalExtracted + "  dangling=" + failures.length + "  exempt=" + exemptions.length + "  baselined=" + baselinedExemptions.length + "  excluded=" + pathClassExclusions.length);
  process.exit(1);
}

console.log("total=" + totalExtracted + "  dangling=0  exempt=" + exemptions.length + "  baselined=" + baselinedExemptions.length + "  excluded=" + pathClassExclusions.length);
console.log("All sot/ references resolve. This is the boring, correct outcome.");
process.exit(0);
