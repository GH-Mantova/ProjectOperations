#!/usr/bin/env node
// raw-error-envelope gate — prevents regression of the humane-API-errors migration.
//
// Greps apps/web/src for two raw-error-envelope shapes that the migration replaced:
//   throw new Error(await <anything>.text())
//   setError(await <anything>.text())
//
// Each matched line is printed with file:line and the offending snippet.
// A line is exempt only if it carries the exact inline directive (no path exclusions):
//   // raw-error-envelope-allow: <reason>
//
// Exit 0  — no violations found (or all violations are explicitly suppressed).
// Exit 1  — one or more raw-envelope call sites found; the CI job fails.
//
// Rule name: raw-error-envelope
// Fix:       import { readApiErrorMessage } from "apps/web/src/lib/api-errors.ts"
//            or use one of the helper exports from that module.

import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const targetDir = join(repoRoot, "apps", "web", "src");

// Shape-based pattern — variable name is [A-Za-z_][A-Za-z0-9_]* (not the literal "res").
// Both throw and setError variants are captured.
const PATTERN =
  "(throw new Error\\(await [A-Za-z_][A-Za-z0-9_]*\\.text\\(\\)\\)|setError\\(await [A-Za-z_][A-Za-z0-9_]*\\.text\\(\\)\\))";

// Inline suppression directive — must appear on the same line, verbatim.
const ALLOW_DIRECTIVE = "// raw-error-envelope-allow:";

let rawOutput;
try {
  rawOutput = execFileSync(
    "grep",
    ["-rnE", "--include=*.ts", "--include=*.tsx", PATTERN, targetDir],
    { encoding: "utf8" }
  );
} catch (err) {
  // grep exits 1 when no matches are found — that is the good case.
  if (err.status === 1) {
    console.log("raw-error-envelope gate: PASS — no violations found in apps/web/src");
    process.exit(0);
  }
  // Any other exit code is a grep failure.
  console.error("raw-error-envelope gate: grep invocation failed");
  console.error(err.message);
  process.exit(2);
}

// Parse grep output: "file:line:content"
const lines = rawOutput.trim().split("\n").filter(Boolean);

// Filter out lines that carry the allow directive.
const violations = lines.filter((line) => !line.includes(ALLOW_DIRECTIVE));

if (violations.length === 0) {
  console.log(
    "raw-error-envelope gate: PASS — all matches carry an explicit allow directive."
  );
  process.exit(0);
}

// Failure — print a useful, actionable message.
console.error(
  `\n${"=".repeat(72)}\n` +
    `RAW-ERROR-ENVELOPE GATE: FAIL\n` +
    `${"=".repeat(72)}\n\n` +
    `Found ${violations.length} raw error-envelope call site(s) in apps/web/src.\n` +
    `These bypass the humane-API-errors layer and expose raw server text to the UI.\n\n` +
    `Offending lines:\n`
);

for (const v of violations) {
  // Make the path relative to the repo root so output is concise.
  const display = v.replace(targetDir, "apps/web/src");
  console.error(`  ${display}`);
}

console.error(
  `\nHow to fix:\n` +
    `  Replace the raw call with a helper from:\n` +
    `    apps/web/src/lib/api-errors.ts\n\n` +
    `  Preferred helpers:\n` +
    `    readApiErrorMessage(response)          — async, returns string\n` +
    `    throwIfApiError(response)              — throws ApiError with human message\n` +
    `    parseApiErrorPayload(payload)          — sync, parses any payload\n\n` +
    `  If the site genuinely reads a non-API-error body (NOT an ApiExceptionFilter\n` +
    `  envelope), add this directive on the SAME line as the call:\n` +
    `    // raw-error-envelope-allow: <reason why this is not an API error body>\n\n` +
    `  Do NOT use path exclusions. Only per-line directives are recognised.\n` +
    `  See docs/engineering/humane-api-errors-gate.md for the full rule.\n` +
    `${"=".repeat(72)}\n`
);

process.exit(1);
