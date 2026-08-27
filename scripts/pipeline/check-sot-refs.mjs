/**
 * check-sot-refs.mjs — walk every sot/**\/*.md and verify every path-shaped
 * backtick reference resolves against the repo root.
 *
 * POLARITY — this is the ORDINARY direction (unlike check-lessons.mjs which is inverted):
 *   exit 0  = every extracted reference resolved (or was explicitly allowlisted)
 *   exit 1  = at least one reference dangled (printed with file + line + path)
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
 * Allowlist: a reference on a line containing the inline HTML comment
 *   <!-- sot-ref-allow: <reason> -->
 * is exempted. Every exemption is printed with its reason — silent allowlists rot.
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

let totalExtracted = 0;
const failures = [];
const exemptions = [];

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

      // Check for allowlist marker on this same line
      const allowMatch = ALLOW_COMMENT_RE.exec(line);
      if (allowMatch) {
        const reason = allowMatch[1].trim();
        exemptions.push({ file: relFile, line: lineNum, path: refPath, reason });
        continue;
      }

      // Strip leading "./" if present
      const normalized = refPath.startsWith("./") ? refPath.slice(2) : refPath;
      // Strip anchor fragment (#section-name) before checking existence
      const withoutFragment = normalized.replace(/#[^/]*$/, "");
      const absPath = path.resolve(repoRoot, withoutFragment);

      if (!existsSync(absPath)) {
        failures.push({ file: relFile, line: lineNum, path: refPath });
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

if (failures.length > 0) {
  console.log("!!! DANGLING REFERENCES (" + failures.length + ") --- these paths do not exist at repo root:");
  for (const fail of failures) {
    console.log("  FAIL  " + fail.file + ":" + fail.line + "  " + fail.path);
  }
  console.log("");
  console.log("total=" + totalExtracted + "  dangling=" + failures.length + "  exempt=" + exemptions.length);
  process.exit(1);
}

console.log("total=" + totalExtracted + "  dangling=0  exempt=" + exemptions.length);
console.log("All sot/ references resolve. This is the boring, correct outcome.");
process.exit(0);
