#!/usr/bin/env node
/**
 * TFM-S8 -- capture-tender-folder-copy-2026.mjs
 *
 * One-shot ESM script. Calls the MIG-3 plan endpoint and writes the
 * per-tender copy plan to docs/migration-runs/tender-folder-copy-2026.md.
 *
 * STANDING RULES (verbatim -- do NOT edit):
 *   1. COPY ONLY. NEVER MOVE. NEVER DELETE.
 *   2. 2026 tenders ONLY.
 *   3. Marco runs `execute` by hand. Automation does NOT execute the copy.
 *   4. Automation MUST NEVER remove the `do-not-merge` label from this PR.
 *   5. The PR opens and stays open. escalates: true. Merge queue must not touch it.
 *
 * Usage:
 *   node scripts/migration-runs/capture-tender-folder-copy-2026.mjs \
 *     [--year 2026] \
 *     [--api-url http://localhost:3000] \
 *     [--token <jwt>] \
 *     [--email admin@projectops.local] \
 *     [--password Password123!]
 *
 * Auth: pass --token directly, or --email + --password to auto-login.
 * If neither is supplied the script attempts an unauthenticated request
 * (will fail against a live API) and falls back to placeholder output.
 *
 * IMPORTANT: This script MUST NOT reference or call the execute endpoint.
 * Marco runs execute by hand after reviewing the captured plan.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    year: 2026,
    apiUrl: "http://localhost:3000",
    token: null,
    email: null,
    password: null,
  };

  for (let idx = 0; idx < argv.length; idx++) {
    const arg = argv[idx];
    if (arg === "--year" && argv[idx + 1]) {
      const parsed = parseInt(argv[++idx], 10);
      if (!isNaN(parsed)) args.year = parsed;
    } else if (arg === "--api-url" && argv[idx + 1]) {
      args.apiUrl = argv[++idx].replace(/\/$/, "");
    } else if (arg === "--token" && argv[idx + 1]) {
      args.token = argv[++idx];
    } else if (arg === "--email" && argv[idx + 1]) {
      args.email = argv[++idx];
    } else if (arg === "--password" && argv[idx + 1]) {
      args.password = argv[++idx];
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchJson(url, options = {}) {
  const { default: nodeFetch } = await import("node:http").then(() =>
    // Use native fetch (Node 18+) or fall back gracefully.
    Promise.resolve({ default: globalThis.fetch })
  );

  const fetchFn = nodeFetch ?? globalThis.fetch;
  if (!fetchFn) throw new Error("No fetch implementation available (Node 18+ required).");

  const resp = await fetchFn(url, options);
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status} ${resp.statusText} from ${url}: ${body}`);
  }
  return resp.json();
}

async function login(apiUrl, email, password) {
  const url = `${apiUrl}/api/v1/auth/login`;
  const data = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!data.accessToken) {
    throw new Error(`Login succeeded but no accessToken in response: ${JSON.stringify(data)}`);
  }
  return data.accessToken;
}

async function fetchPlan(apiUrl, token) {
  const url = `${apiUrl}/api/v1/admin/imports/sharepoint-legacy-copy/plan`;
  return fetchJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // The plan endpoint takes no body; POST with empty body is correct.
    body: "{}",
  });
}

// ---------------------------------------------------------------------------
// Year-filter: T-number format is T{YYMMDD} so 2026 => T26xxxx
// ---------------------------------------------------------------------------

function extractYearFromTNumber(tNumber) {
  // tNumber is like "T260814" -- first two digits after T are YY
  const match = /^T(\d{2})\d+$/.exec(tNumber);
  if (!match) return null;
  return 2000 + parseInt(match[1], 10);
}

function isYear(entry, year) {
  const entryYear = extractYearFromTNumber(entry.tNumber);
  return entryYear === year;
}

// ---------------------------------------------------------------------------
// Size formatting
// ---------------------------------------------------------------------------

function bytesToMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

const STANDING_RULES = `\
## Standing rules (do-not-merge)

1. COPY ONLY. NEVER MOVE. NEVER DELETE.
2. 2026 tenders ONLY.
3. Marco runs \`execute\` by hand. Automation does NOT execute the copy.
4. Automation MUST NEVER remove the \`do-not-merge\` label from this PR.
5. The PR opens and stays open. escalates: true. Merge queue must not touch it.
`;

function buildMarkdown({ runTimestamp, apiUrl, plan, year, filteredMatched, error }) {
  const lines = [];

  lines.push(`# Tender folder copy plan -- ${year} tenders`);
  lines.push("");

  if (error) {
    lines.push("<!-- PLACEHOLDER: API was unreachable at capture time -->");
    lines.push("");
    lines.push("## Capture error");
    lines.push("");
    lines.push(`**Run timestamp:** ${runTimestamp}  `);
    lines.push(`**API URL:** ${apiUrl}  `);
    lines.push(`**Status:** UNREACHABLE -- Marco must re-run capture before merging.`);
    lines.push("");
    lines.push("```");
    lines.push(String(error));
    lines.push("```");
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(STANDING_RULES);
    return lines.join("\n");
  }

  const totalFiles = filteredMatched.reduce((sum, e) => sum + e.wouldCopy.length, 0);
  const totalBytes = filteredMatched.reduce(
    (sum, e) => sum + e.wouldCopy.reduce((s, f) => s + f.sizeBytes, 0),
    0
  );

  lines.push("## Header");
  lines.push("");
  lines.push(`| Field | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Run timestamp | ${runTimestamp} |`);
  lines.push(`| API URL | ${apiUrl} |`);
  lines.push(`| Unready tenders (destination missing) | ${plan.unreadyCount} |`);
  lines.push(`| Total files to copy (ready tenders) | ${totalFiles} |`);
  lines.push(`| Total size (MB) | ${bytesToMB(totalBytes)} |`);
  lines.push(`| Year filter | ${year} |`);
  lines.push("");

  lines.push("## Per-tender plan");
  lines.push("");
  lines.push(
    "| Tender T-number | Project name | Destination path | Destination ready? | Reason (if unready) | # source files | Total size (MB) |"
  );
  lines.push("|---|---|---|---|---|---|---|");

  for (const entry of filteredMatched) {
    const projectName = entry.tenderTitle ?? "";
    const destPath = entry.destinationFolderPath ?? "";
    const ready = entry.destinationReady ? "Yes" : "No";
    const reason = entry.destinationReason ?? "";
    const fileCount = entry.wouldCopy.length;
    const sizeMB = bytesToMB(
      entry.wouldCopy.reduce((sum, f) => sum + f.sizeBytes, 0)
    );

    lines.push(
      `| ${entry.tNumber} | ${projectName} | ${destPath} | ${ready} | ${reason} | ${fileCount} | ${sizeMB} |`
    );
  }

  lines.push("");

  if (plan.unmatchedTenders && plan.unmatchedTenders.length > 0) {
    const yearUnmatched = plan.unmatchedTenders.filter((t) => isYear(t, year));
    if (yearUnmatched.length > 0) {
      lines.push("## Unmatched tenders (no legacy folder found)");
      lines.push("");
      lines.push("| T-number | Tender title |");
      lines.push("|---|---|");
      for (const t of yearUnmatched) {
        lines.push(`| ${t.tNumber} | ${t.tenderTitle} |`);
      }
      lines.push("");
    }
  }

  if (plan.noDestination && plan.noDestination.length > 0) {
    const yearNoDestination = plan.noDestination.filter((t) => isYear(t, year));
    if (yearNoDestination.length > 0) {
      lines.push("## Tenders with no destination folder link");
      lines.push("");
      lines.push("| T-number | Tender title |");
      lines.push("|---|---|");
      for (const t of yearNoDestination) {
        lines.push(`| ${t.tNumber} | ${t.tenderTitle} |`);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push(STANDING_RULES);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Output path (relative to repo root)
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// scripts/migration-runs/ -> repo root is two levels up
const repoRoot = resolve(__dirname, "../..");
const outputPath = resolve(repoRoot, "docs/migration-runs/tender-folder-copy-2026.md");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runTimestamp = new Date().toISOString();

  console.log(`[capture] TFM-S8 -- tender folder copy plan capture`);
  console.log(`[capture] Year: ${args.year}`);
  console.log(`[capture] API URL: ${args.apiUrl}`);
  console.log(`[capture] Output: ${outputPath}`);

  let token = args.token;
  let plan = null;
  let captureError = null;

  try {
    // Obtain JWT if not supplied directly
    if (!token && args.email && args.password) {
      console.log(`[capture] Logging in as ${args.email}...`);
      token = await login(args.apiUrl, args.email, args.password);
      console.log(`[capture] Login succeeded.`);
    }

    if (!token) {
      console.warn(
        `[capture] WARN: No --token, --email, or --password supplied. ` +
          `Request will likely be rejected by the API with 401.`
      );
    }

    console.log(`[capture] Calling plan endpoint...`);
    plan = await fetchPlan(args.apiUrl, token);
    console.log(
      `[capture] Plan received: ${plan.matched?.length ?? 0} matched, ` +
        `${plan.unreadyCount ?? 0} unready`
    );
  } catch (err) {
    console.error(`[capture] ERROR: ${err.message}`);
    captureError = err.message;
  }

  // Filter to the requested year only
  const filteredMatched = plan
    ? (plan.matched ?? []).filter((entry) => isYear(entry, args.year))
    : [];

  console.log(
    `[capture] ${filteredMatched.length} tender(s) match year=${args.year} after filtering.`
  );

  // Ensure output directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  const markdown = buildMarkdown({
    runTimestamp,
    apiUrl: args.apiUrl,
    plan: plan ?? {},
    year: args.year,
    filteredMatched,
    error: captureError,
  });

  writeFileSync(outputPath, markdown, "utf8");
  console.log(`[capture] Written: ${outputPath}`);

  // Verify the file was written (read-back rule)
  const written = readFileSync(outputPath, "utf8");
  if (!written.includes("do-not-merge")) {
    throw new Error(
      "BUG: written file does not contain 'do-not-merge'. Standing-rules footer missing."
    );
  }
  console.log(`[capture] Read-back OK -- 'do-not-merge' confirmed present.`);

  if (captureError) {
    console.warn(
      `[capture] PLACEHOLDER written -- API was unreachable. Marco must re-run capture before merging.`
    );
  } else {
    console.log(`[capture] Done.`);
  }
}

main().catch((err) => {
  console.error(`[capture] FATAL: ${err.message}`);
  process.exit(1);
});
