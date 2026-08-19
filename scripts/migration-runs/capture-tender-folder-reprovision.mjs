#!/usr/bin/env node
/**
 * TFM-S9 -- capture-tender-folder-reprovision.mjs
 *
 * One-shot ESM script. Scopes to 2026 tenders (T26xxxx), calls the MIG-3.1
 * backfill endpoint (POST /api/v1/admin/imports/tender-folders/backfill), and
 * writes the per-tender result to docs/migration-runs/tender-folder-reprovision-2026.md.
 *
 * IMPORTANT DESIGN NOTE -- year scoping:
 *   The backfill endpoint accepts an explicit list of T-numbers (body.tNumbers[]).
 *   It does NOT accept a year/scope filter. Scoping is done client-side in two
 *   steps:
 *     1. Fetch all tenders from GET /api/v1/tenders (paginated) and extract
 *        tenderNumber values whose T-prefix starts with T26 (i.e. year 2026).
 *     2. Pass only those T-numbers to the backfill endpoint.
 *   This is documented in the header block of the output Markdown file.
 *
 * The run is idempotent: ensureTenderFolderStructure upserts folder links, so
 * re-running the script (with dryRun=false) is always safe.
 *
 * STANDING RULES (verbatim -- do NOT edit):
 *   1. REPROVISION ONLY. NEVER DELETE.
 *   2. 2026 tenders ONLY.
 *   3. Marco reviews the report. The PR opens and stays open. escalates: true.
 *   4. Automation MUST NEVER remove the `do-not-merge` label from this PR.
 *
 * Usage:
 *   node scripts/migration-runs/capture-tender-folder-reprovision.mjs \
 *     [--year 2026] \
 *     [--dry-run true|false] \
 *     [--api-url http://localhost:3000] \
 *     [--token <jwt>] \
 *     [--email admin@projectops.local] \
 *     [--password Password123!]
 *
 * Auth: pass --token directly, or --email + --password to auto-login.
 * If neither is supplied the script falls back to placeholder output
 * (API unreachable / unauthenticated path).
 *
 * --dry-run defaults to true (no folders created); pass --dry-run false to
 * actually provision folders.
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
    dryRun: true,
    apiUrl: process.env.API_URL ?? "http://localhost:3000",
    token: null,
    email: null,
    password: null,
  };

  for (let idx = 0; idx < argv.length; idx++) {
    const arg = argv[idx];
    if (arg === "--year" && argv[idx + 1]) {
      const parsed = parseInt(argv[++idx], 10);
      if (!isNaN(parsed)) args.year = parsed;
    } else if (arg === "--dry-run" && argv[idx + 1]) {
      args.dryRun = argv[++idx].toLowerCase() !== "false";
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
  const fetchFn = globalThis.fetch;
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

/**
 * Fetch all tenders (paginated) and return those matching the given year prefix.
 * T-number format: T{YY}{MMDD}-... where YY=26 -> year 2026.
 * The tenders list endpoint is GET /api/v1/tenders?pageSize=100&page=N.
 */
async function fetch2026TenderNumbers(apiUrl, token, year) {
  const yearSuffix = String(year).slice(2); // "2026" -> "26"
  const prefix = `T${yearSuffix}`;
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const tenderNumbers = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const url = `${apiUrl}/api/v1/tenders?pageSize=${pageSize}&page=${page}`;
    const result = await fetchJson(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeader },
    });

    // The list endpoint returns { data: [...], total: N } or just an array.
    const items = Array.isArray(result) ? result : (result.data ?? []);

    for (const tender of items) {
      const tNum = tender.tenderNumber ?? "";
      if (tNum.startsWith(prefix)) {
        tenderNumbers.push(tNum);
      }
    }

    // Pagination: if we got a full page, there may be more.
    if (items.length < pageSize) break;
    page++;

    // Safety: cap at 50 pages (5000 tenders) to avoid infinite loops.
    if (page > 50) {
      console.warn(`[reprovision] WARN: reached 50-page cap; stopping pagination.`);
      break;
    }
  }

  return tenderNumbers;
}

/**
 * Call POST /api/v1/admin/imports/tender-folders/backfill with the given T-numbers.
 * Returns the TenderFolderBackfillReport.
 */
async function callBackfill(apiUrl, token, tNumbers, dryRun) {
  const url = `${apiUrl}/api/v1/admin/imports/tender-folders/backfill`;
  return fetchJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ tNumbers, dryRun }),
  });
}

// ---------------------------------------------------------------------------
// Year-filter helper for T-number strings (used to double-check results)
// ---------------------------------------------------------------------------

function extractYearFromTenderNumber(tenderNumber) {
  // tenderNumber is like "T260814-XXXX-Rev1" -- first two digits after T are YY
  const match = /^T(\d{2})\d+/.exec(tenderNumber);
  if (!match) return null;
  return 2000 + parseInt(match[1], 10);
}

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

const STANDING_RULES = `\
## Standing rules (do-not-merge)

1. REPROVISION ONLY. NEVER DELETE.
2. 2026 tenders ONLY.
3. Marco reviews the report. The PR opens and stays open. escalates: true.
4. Automation MUST NEVER remove the \`do-not-merge\` label from this PR.
`;

function buildMarkdown({ runTimestamp, apiUrl, year, dryRun, report, tenderNumbers, error }) {
  const lines = [];

  lines.push(`# Tender folder re-provision report -- ${year} tenders`);
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

  // Scope note: endpoint has no year filter, scoped client-side
  const statusCounts = {};
  for (const row of report.results ?? []) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  }
  const statusSummary = Object.entries(statusCounts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ") || "none";

  lines.push("## Header");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  lines.push(`| Run timestamp | ${runTimestamp} |`);
  lines.push(`| API URL | ${apiUrl} |`);
  lines.push(`| Year filter | ${year} (client-side — endpoint has no year param; T-numbers fetched from GET /api/v1/tenders and filtered to T${String(year).slice(2)}xxxx before calling backfill) |`);
  lines.push(`| Dry run | ${dryRun} |`);
  lines.push(`| Total tenders processed | ${report.requested ?? 0} |`);
  lines.push(`| Matched | ${report.matched ?? 0} |`);
  lines.push(`| Created / would-create | ${(report.created ?? 0) + (statusCounts["would-create"] ?? 0)} |`);
  lines.push(`| Not found | ${report.notFound ?? 0} |`);
  lines.push(`| Errors | ${report.errors ?? 0} |`);
  lines.push(`| Status counts | ${statusSummary} |`);
  lines.push(`| Idempotency note | This run is idempotent — ensureTenderFolderStructure is a create-if-missing walk; re-running is safe. |`);
  lines.push("");

  lines.push("## Per-tender results");
  lines.push("");
  lines.push("| Tender T-number | Project name | Final status | Failed subfolders (if any) |");
  lines.push("|---|---|---|---|");

  for (const row of report.results ?? []) {
    // Project name: tenderNumber is the canonical number; we don't have
    // projectName from the backfill response, so leave blank (script scoped
    // to T-numbers only; full names can be looked up in the ERP).
    const projectName = "";
    const failedSubfolders = row.status === "error" ? (row.reason ?? "") : "";
    lines.push(`| ${row.tNumber} | ${projectName} | ${row.status} | ${failedSubfolders} |`);
  }

  lines.push("");
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
const outputPath = resolve(repoRoot, "docs/migration-runs/tender-folder-reprovision-2026.md");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runTimestamp = new Date().toISOString();

  console.log(`[reprovision] TFM-S9 -- tender folder re-provision capture`);
  console.log(`[reprovision] Year: ${args.year}`);
  console.log(`[reprovision] Dry run: ${args.dryRun}`);
  console.log(`[reprovision] API URL: ${args.apiUrl}`);
  console.log(`[reprovision] Output: ${outputPath}`);

  let token = args.token;
  let report = null;
  let tenderNumbers = [];
  let captureError = null;

  try {
    // Obtain JWT if not supplied directly
    if (!token && args.email && args.password) {
      console.log(`[reprovision] Logging in as ${args.email}...`);
      token = await login(args.apiUrl, args.email, args.password);
      console.log(`[reprovision] Login succeeded.`);
    }

    if (!token) {
      console.warn(
        `[reprovision] WARN: No --token, --email, or --password supplied. ` +
          `Request will likely be rejected by the API with 401.`
      );
    }

    // Step 1: fetch 2026 tender numbers
    console.log(`[reprovision] Fetching ${args.year} tender numbers from GET /api/v1/tenders...`);
    tenderNumbers = await fetch2026TenderNumbers(args.apiUrl, token, args.year);
    console.log(`[reprovision] Found ${tenderNumbers.length} tender(s) with year=${args.year} prefix.`);

    if (tenderNumbers.length === 0) {
      console.warn(`[reprovision] WARN: No tenders found for year ${args.year}. Writing report with zero rows.`);
      report = {
        dryRun: args.dryRun,
        requested: 0,
        matched: 0,
        created: 0,
        notFound: 0,
        errors: 0,
        results: [],
      };
    } else {
      // Step 2: call backfill with 2026 T-numbers only
      console.log(
        `[reprovision] Calling backfill endpoint (dryRun=${args.dryRun}) ` +
          `with ${tenderNumbers.length} T-number(s)...`
      );
      report = await callBackfill(args.apiUrl, token, tenderNumbers, args.dryRun);
      console.log(
        `[reprovision] Backfill complete: matched=${report.matched ?? 0} ` +
          `created=${report.created ?? 0} notFound=${report.notFound ?? 0} ` +
          `errors=${report.errors ?? 0}`
      );
    }
  } catch (err) {
    console.error(`[reprovision] ERROR: ${err.message}`);
    captureError = err.message;
  }

  // Ensure output directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  const markdown = buildMarkdown({
    runTimestamp,
    apiUrl: args.apiUrl,
    year: args.year,
    dryRun: args.dryRun,
    report: report ?? {},
    tenderNumbers,
    error: captureError,
  });

  writeFileSync(outputPath, markdown, "utf8");
  console.log(`[reprovision] Written: ${outputPath}`);

  // Read-back verification
  const written = readFileSync(outputPath, "utf8");
  if (!written.includes("do-not-merge")) {
    throw new Error(
      "BUG: written file does not contain 'do-not-merge'. Standing-rules footer missing."
    );
  }
  console.log(`[reprovision] Read-back OK -- 'do-not-merge' confirmed present.`);

  if (captureError) {
    console.warn(
      `[reprovision] PLACEHOLDER written -- API was unreachable. Marco must re-run capture before merging.`
    );
  } else {
    console.log(`[reprovision] Done.`);
  }
}

main().catch((err) => {
  console.error(`[reprovision] FATAL: ${err.message}`);
  process.exit(1);
});
