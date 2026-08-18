#!/usr/bin/env node
/**
 * TFM-S9 -- capture-tender-folder-cleanup.mjs
 *
 * One-shot ESM script. Lists the children of the destination tendersRoot
 * (`1. Operations/1. Tenders/`) via the SharePoint listFolderChildrenByPath
 * seam, joins each returned folder against the ERP Tender rows using the
 * derived folder-name pattern (T{YYMMDD} prefix), and identifies stub folders
 * that have no matching live tender.
 *
 * Writes docs/migration-runs/tender-folder-cleanup-list.md.
 *
 * DESIGN NOTE -- how the tenders-root listing is accessed:
 *   There is no admin HTTP endpoint that directly lists the tendersRoot
 *   children. The SharePointService.listFolderChildrenByPath method is
 *   accessible through the legacy-copy plan endpoint response, which surfaces
 *   the legacy folder listing. However, we need the DESTINATION (tenders root)
 *   listing, not the legacy source.
 *
 *   Since no HTTP endpoint exposes this, the script calls:
 *     GET /api/v1/sharepoint/test-connection  (to verify connectivity)
 *   and then falls back to a hard-coded known-entries list when the live
 *   listing is unavailable. The two known pre-model-era stubs are always
 *   written to the table:
 *     - T260814-XXXX-Rev1   (pre-model-era stub)
 *     - __connection_probe__ (SharePoint connection probe folder)
 *
 *   Marco manually reviews and deletes these stub folders via the SharePoint UI.
 *   Nothing in this PR or any automation deletes anything.
 *
 * STANDING RULES (verbatim -- do NOT edit):
 *   1. Marco deletes stub folders by hand.
 *   2. Nothing on the live library is deleted by this PR or any automation.
 *   3. The PR stays open until Marco confirms the tenders root holds only real
 *      tenders.
 *
 * Usage:
 *   node scripts/migration-runs/capture-tender-folder-cleanup.mjs \
 *     [--api-url http://localhost:3000] \
 *     [--token <jwt>] \
 *     [--email admin@projectops.local] \
 *     [--password Password123!]
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Known pre-model-era stub folders (always written to the report)
// These are included whether or not the live API call succeeds.
// ---------------------------------------------------------------------------

const KNOWN_STUBS = [
  {
    name: "T260814-XXXX-Rev1",
    itemId: null, // unknown if API unreachable
    reason: "pre-model-era stub",
    marcoAction: "delete via SharePoint UI",
  },
  {
    name: "__connection_probe__",
    itemId: null, // unknown if API unreachable
    reason: "pre-model-era stub (SharePoint connection probe)",
    marcoAction: "delete via SharePoint UI",
  },
];

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    apiUrl: process.env.API_URL ?? "http://localhost:3000",
    token: null,
    email: null,
    password: null,
  };

  for (let idx = 0; idx < argv.length; idx++) {
    const arg = argv[idx];
    if (arg === "--api-url" && argv[idx + 1]) {
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
 * Call GET /api/v1/sharepoint/test-connection to verify the SP adapter is live.
 * Returns the connection test result or throws on failure.
 */
async function testSharePointConnection(apiUrl, token) {
  const url = `${apiUrl}/api/v1/sharepoint/test-connection`;
  return fetchJson(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/**
 * Fetch all tenders from the ERP and extract their expected folder name prefix
 * (T{YYMMDD} from tenderNumber).
 * Returns a Set<string> of expected folder name prefixes.
 */
async function fetchExpectedFolderPrefixes(apiUrl, token) {
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const prefixes = new Set();
  let page = 1;
  const pageSize = 100;

  while (true) {
    const url = `${apiUrl}/api/v1/tenders?pageSize=${pageSize}&page=${page}`;
    const result = await fetchJson(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeader },
    });

    const items = Array.isArray(result) ? result : (result.data ?? []);

    for (const tender of items) {
      const tNum = tender.tenderNumber ?? "";
      // deriveTenderFolderName uses tenderNumber.slice(0, 7) as the prefix
      // e.g. "T260817-XXXX-Rev1" -> "T260817"
      if (tNum.length >= 7) {
        prefixes.add(tNum.slice(0, 7));
      }
    }

    if (items.length < pageSize) break;
    page++;

    // Safety cap
    if (page > 50) {
      console.warn(`[cleanup] WARN: reached 50-page cap on tender listing; stopping.`);
      break;
    }
  }

  return prefixes;
}

// ---------------------------------------------------------------------------
// Folder name classification
// ---------------------------------------------------------------------------

/**
 * Classify a folder name found in the tenders root against known ERP tenders.
 * Returns { reason, marcoAction } describing what the folder is.
 */
function classifyFolder(folderName, expectedPrefixes) {
  // Known stubs by exact name
  if (folderName === "__connection_probe__") {
    return {
      reason: "pre-model-era stub (SharePoint connection probe)",
      marcoAction: "delete via SharePoint UI",
    };
  }

  // T-number shaped: T{YYMMDD} - {ProjectName}
  // The prefix is the first 7 chars if it matches T######
  const prefixMatch = /^(T\d{6})/.exec(folderName);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    if (expectedPrefixes.has(prefix)) {
      return {
        reason: "matches live ERP tender",
        marcoAction: "keep",
      };
    }
    return {
      reason: "pre-model-era stub (T-number not found in ERP)",
      marcoAction: "delete via SharePoint UI",
    };
  }

  // No T-number shape at all
  return {
    reason: "non-standard folder (no T-number prefix)",
    marcoAction: "review and delete via SharePoint UI if confirmed stub",
  };
}

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

const CLEANUP_STANDING_RULES = `\
## Standing rules (do-not-merge)

1. Marco deletes stub folders by hand.
2. Nothing on the live library is deleted by this PR or any automation.
3. The PR stays open until Marco confirms the tenders root holds only real tenders.
`;

function buildMarkdown({ runTimestamp, apiUrl, rows, liveCallSucceeded, liveError, connectionMode }) {
  const lines = [];

  lines.push(`# Tender folder cleanup list`);
  lines.push("");

  lines.push("## Header");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  lines.push(`| Run timestamp | ${runTimestamp} |`);
  lines.push(`| API URL | ${apiUrl} |`);
  lines.push(`| SharePoint mode | ${connectionMode ?? "unknown"} |`);
  lines.push(
    `| Live folder listing | ${liveCallSucceeded ? "succeeded" : "unavailable (see below)"} |`
  );
  lines.push(`| Known stubs (always listed) | T260814-XXXX-Rev1, __connection_probe__ |`);
  lines.push("");

  if (liveError) {
    lines.push("### Live listing unavailable");
    lines.push("");
    lines.push(
      "The SharePoint listing endpoint was not reachable at capture time. " +
        "The table below contains the two hard-coded known stubs. " +
        "Marco must re-run capture against a live API to get the full listing."
    );
    lines.push("");
    lines.push("```");
    lines.push(String(liveError));
    lines.push("```");
    lines.push("");
  }

  lines.push("## Cleanup list");
  lines.push("");
  lines.push("| Folder name | Graph itemId | Reason | Marco action |");
  lines.push("|---|---|---|---|");

  for (const row of rows) {
    const itemId = row.itemId ?? "unknown (API unreachable)";
    lines.push(`| ${row.name} | ${itemId} | ${row.reason} | ${row.marcoAction} |`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(CLEANUP_STANDING_RULES);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Output path
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");
const outputPath = resolve(repoRoot, "docs/migration-runs/tender-folder-cleanup-list.md");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runTimestamp = new Date().toISOString();

  console.log(`[cleanup] TFM-S9 -- tender folder cleanup list capture`);
  console.log(`[cleanup] API URL: ${args.apiUrl}`);
  console.log(`[cleanup] Output: ${outputPath}`);

  let token = args.token;
  let liveCallSucceeded = false;
  let liveError = null;
  let connectionMode = "unknown";
  let rows = [];

  try {
    // Obtain JWT
    if (!token && args.email && args.password) {
      console.log(`[cleanup] Logging in as ${args.email}...`);
      token = await login(args.apiUrl, args.email, args.password);
      console.log(`[cleanup] Login succeeded.`);
    }

    if (!token) {
      console.warn(
        `[cleanup] WARN: No --token, --email, or --password supplied. ` +
          `Requests may be rejected by the API with 401.`
      );
    }

    // Step 1: Test SharePoint connection (to know if we're in mock mode)
    console.log(`[cleanup] Testing SharePoint connection...`);
    const connTest = await testSharePointConnection(args.apiUrl, token);
    connectionMode = connTest.mode ?? "unknown";
    console.log(`[cleanup] SharePoint mode: ${connectionMode}`);

    if (connectionMode === "mock") {
      console.warn(
        `[cleanup] SharePoint is in mock mode. No real folder listing available. ` +
          `Writing known stubs only.`
      );
      liveError = "SharePoint adapter is in mock mode; no live folder listing available.";
    } else {
      // Step 2: Fetch known ERP tender prefixes for join
      console.log(`[cleanup] Fetching ERP tender list to build expected-folder prefix set...`);
      const expectedPrefixes = await fetchExpectedFolderPrefixes(args.apiUrl, token);
      console.log(`[cleanup] ${expectedPrefixes.size} unique T-prefix(es) found in ERP.`);

      // Step 3: No direct HTTP endpoint lists the tenders root. The legacy-copy
      // plan endpoint lists LEGACY source folders, not the destination root.
      // Mark live listing as unavailable and use known stubs.
      //
      // IMPLEMENTATION NOTE: SharePointService.listFolderChildrenByPath exists
      // and could be called via a future admin endpoint. For this slice, no
      // such endpoint is registered. The script writes the known stubs and
      // documents this gap so Marco can manually verify the tenders root.
      console.warn(
        `[cleanup] No HTTP endpoint lists the tenders root folder children directly. ` +
          `Writing known stubs. A future admin endpoint can fill this gap.`
      );
      liveError =
        "No admin HTTP endpoint lists the tendersRoot children directly (SharePointService.listFolderChildrenByPath " +
        "is not exposed via HTTP in this slice). The known stubs below are hard-coded from pre-model-era evidence. " +
        "Marco must verify the full folder listing in the SharePoint UI.";

      liveCallSucceeded = false;
    }
  } catch (err) {
    console.error(`[cleanup] ERROR: ${err.message}`);
    liveError = err.message;
    liveCallSucceeded = false;
  }

  // Build the rows table. Always include the two known stubs.
  // If we had live data (in a future where the endpoint exists), we would
  // dedupe and add additional rows here.
  const knownNames = new Set(KNOWN_STUBS.map((s) => s.name));
  rows = [...KNOWN_STUBS].map((stub) => ({
    name: stub.name,
    itemId: stub.itemId,
    reason: stub.reason,
    marcoAction: stub.marcoAction,
  }));

  console.log(`[cleanup] Writing ${rows.length} row(s) to cleanup list.`);

  // Ensure output directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  const markdown = buildMarkdown({
    runTimestamp,
    apiUrl: args.apiUrl,
    rows,
    liveCallSucceeded,
    liveError,
    connectionMode,
  });

  writeFileSync(outputPath, markdown, "utf8");
  console.log(`[cleanup] Written: ${outputPath}`);

  // Read-back verification (Doctrine 1: every mutation must be read back)
  const written = readFileSync(outputPath, "utf8");

  if (!written.includes("T260814-XXXX-Rev1")) {
    throw new Error("BUG: written file does not contain 'T260814-XXXX-Rev1'. Known stub missing.");
  }
  if (!written.includes("__connection_probe__")) {
    throw new Error("BUG: written file does not contain '__connection_probe__'. Known stub missing.");
  }
  if (!written.includes("do-not-merge")) {
    throw new Error("BUG: written file does not contain 'do-not-merge'. Standing-rules footer missing.");
  }

  console.log(
    `[cleanup] Read-back OK -- 'T260814-XXXX-Rev1', '__connection_probe__', 'do-not-merge' all confirmed present.`
  );
  console.log(`[cleanup] Done.`);
}

main().catch((err) => {
  console.error(`[cleanup] FATAL: ${err.message}`);
  process.exit(1);
});
