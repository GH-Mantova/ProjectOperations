#!/usr/bin/env node
// =============================================================================
// scripts/crm/recompute-client-stats.mjs
// =============================================================================
// One-shot recompute of three cached counters on the clients table:
//   tender_count, win_count, win_rate
//
// Derived from the tender graph only. Does NOT read TenderOutcome or
// TenderClient.isAwarded (see Recompute Rules in --help).
//
// Usage:
//   node scripts/crm/recompute-client-stats.mjs              # dry run (default)
//   node scripts/crm/recompute-client-stats.mjs --dry-run    # dry run (explicit)
//   node scripts/crm/recompute-client-stats.mjs --snapshot <path> --dry-run
//   node scripts/crm/recompute-client-stats.mjs --snapshot <path> --apply
//   node scripts/crm/recompute-client-stats.mjs --help       # print help, exit 0
//   node scripts/crm/recompute-client-stats.mjs -h           # same
//
// Exit codes:
//   0 - success (dry run or apply completed without error)
//   1 - fatal error (DB connection failed, refused to run, unexpected exception)
//   2 - bad usage (unknown flag, missing argument)
// =============================================================================

import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WIN_STATUSES = new Set(["AWARDED", "CONTRACT_ISSUED", "CONVERTED"]);

// Batch size for transactional updates in --apply mode.
const BATCH_SIZE = 50;

const HELP_TEXT = `
recompute-client-stats.mjs -- restate tender_count / win_count / win_rate on clients

USAGE
  node scripts/crm/recompute-client-stats.mjs [flags]

FLAGS
  (no flags)            Dry run. Print per-client before/after/delta, no writes.
  --dry-run             Dry run (explicit, same as default).
  --snapshot <path>     Write a CSV of current values BEFORE any changes.
                        Required when using --apply.
  --apply               Perform the restatement in transactional batches.
                        Refused unless --snapshot <path> was given and written
                        successfully (exit 1 with a clear message if missing).
  --help, -h            Print this message and exit 0.

RECOMPUTE RULES
  tender_count = COUNT of TenderClient rows joined to a Tender where
                 tenderScoreCounted = true, for this client.

  win_count    = COUNT of the same join where ADDITIONALLY:
                 tender.wonAt IS NOT NULL
                 OR tender.status IN ('AWARDED', 'CONTRACT_ISSUED', 'CONVERTED')

  win_rate     = ROUND(win_count * 100.0 / tender_count, 2)
                 When tender_count = 0, win_rate = 0 (never divide-by-zero).

  By construction win_count <= tender_count and win_rate <= 100.

WHAT THIS SCRIPT CANNOT RECOVER
  1. Which clients were linked to a tender at the moment it was scored.
     The link set (tender_clients rows) is rebuilt on every tender edit
     (tendering.service.ts:1205). Clients added after scoring, or removed
     before scoring, are invisible to this recompute.

  2. Hard-deleted tenders. When a tender is deleted
     (tendering.service.ts:656) nothing decrements the cached counters, and
     the tender_clients rows cascade-delete with it. There is no tombstone.
     Affected clients will have their counts lowered here if the tender was
     never scored (tenderScoreCounted = false), but if it WAS scored the
     gap is unrecoverable.

  3. The sequence of increments itself. There is no event log for these
     columns. This script can restate the current graph-derived value; it
     cannot prove the graph is complete.

SNAPSHOT CSV FORMAT
  client_id,name,tender_count,win_count,win_rate
  One row per client. This is your undo reference. Store it before --apply.

DATABASE
  Reads DATABASE_URL from environment (defaults to local dev DB).
  Uses transactional batches of ${BATCH_SIZE} rows in --apply mode.
`.trim();

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

/**
 * @param {string[]} argv  process.argv
 * @returns {{ mode: 'help'|'dry-run'|'apply'|'error', snapshotPath?: string, unknown?: string[] }}
 */
export function parseArgs(argv) {
  const args = argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    return { mode: "help" };
  }

  let snapshotPath = null;
  let apply = false;
  let dryRun = false;
  const unknown = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--snapshot") {
      if (i + 1 >= args.length) {
        return { mode: "error", unknown: ["--snapshot requires a path argument"] };
      }
      snapshotPath = args[++i];
    } else if (arg === "--apply") {
      apply = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else {
      unknown.push(arg);
    }
  }

  if (unknown.length > 0) {
    return { mode: "error", unknown };
  }

  if (apply && dryRun) {
    return { mode: "error", unknown: ["--apply and --dry-run are mutually exclusive"] };
  }

  return {
    mode: apply ? "apply" : "dry-run",
    snapshotPath,
  };
}

// ---------------------------------------------------------------------------
// Core computation (pure -- exported for tests)
// ---------------------------------------------------------------------------

/**
 * Compute the three counters for a single client from raw tender data.
 *
 * @param {Array<{ tenderScoreCounted: boolean, wonAt: Date|null, status: string }>} tenders
 *   All tenders linked to this client (may include un-scored ones; function
 *   filters to tenderScoreCounted = true internally).
 * @returns {{ tenderCount: number, winCount: number, winRate: number }}
 */
export function computeStats(tenders) {
  let tenderCount = 0;
  let winCount = 0;

  for (const t of tenders) {
    if (!t.tenderScoreCounted) continue;
    tenderCount++;
    if (t.wonAt != null || WIN_STATUSES.has(t.status)) {
      winCount++;
    }
  }

  const winRate =
    tenderCount === 0
      ? 0
      : Math.round((winCount * 100.0 * 100) / tenderCount) / 100;

  return { tenderCount, winCount, winRate };
}

// ---------------------------------------------------------------------------
// Snapshot writer
// ---------------------------------------------------------------------------

/**
 * Write a CSV snapshot of current client stats to path.
 * Returns true on success, false on error (also logs the error).
 *
 * @param {string} path
 * @param {Array<{ id: string, name: string, tenderCount: number, winCount: number, winRate: number|null }>} rows
 * @param {(msg: string) => void} log
 * @returns {boolean}
 */
export function writeSnapshot(path, rows, log) {
  try {
    const lines = ["client_id,name,tender_count,win_count,win_rate"];
    for (const r of rows) {
      // Escape name: quote if it contains comma or double-quote
      const safeName = r.name.includes(",") || r.name.includes('"')
        ? `"${r.name.replace(/"/g, '""')}"`
        : r.name;
      const wr = r.winRate == null ? "0" : String(r.winRate);
      lines.push(`${r.id},${safeName},${r.tenderCount},${r.winCount},${wr}`);
    }
    writeFileSync(path, lines.join("\n") + "\n", "utf8");
    log(`SNAPSHOT written: ${path} (${rows.length} rows)`);
    return true;
  } catch (err) {
    log(`ERROR: could not write snapshot to ${path}: ${err?.message ?? err}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main runner (exported for tests -- thin CLI wrapper at the bottom calls it)
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   mode: 'dry-run' | 'apply',
 *   snapshotPath?: string | null,
 *   prisma: object,
 *   log?: (msg: string) => void,
 *   snapshotWritten?: boolean,
 * }} opts
 *
 * snapshotWritten: when true, the caller already wrote the snapshot and we
 *   skip the guard check (used in tests to inject mock state).
 *
 * @returns {Promise<{
 *   wouldChange: number,
 *   wouldIncrease: number,
 *   wouldDecrease: number,
 *   failed: number,
 *   refusedNoSnapshot: boolean,
 * }>}
 */
export async function run({
  mode,
  snapshotPath,
  prisma,
  log = console.log,
  snapshotWritten = false,
}) {
  // --apply guard: refuse without a successfully-written snapshot
  if (mode === "apply" && !snapshotPath && !snapshotWritten) {
    log(
      "ERROR: --apply requires --snapshot <path>. Provide a snapshot path so " +
        "you have an undo CSV before any rows are changed."
    );
    return {
      wouldChange: 0,
      wouldIncrease: 0,
      wouldDecrease: 0,
      failed: 0,
      refusedNoSnapshot: true,
    };
  }

  // Load all clients with their current cached stats.
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      tenderCount: true,
      winCount: true,
      winRate: true,
    },
    orderBy: { name: "asc" },
  });

  // If --apply is requested and a snapshot path was given, write snapshot first.
  if (mode === "apply" && snapshotPath && !snapshotWritten) {
    const ok = writeSnapshot(snapshotPath, clients, log);
    if (!ok) {
      log(
        "ERROR: snapshot write failed -- refusing to --apply without a " +
          "valid snapshot on disk. Fix the path and retry."
      );
      return {
        wouldChange: 0,
        wouldIncrease: 0,
        wouldDecrease: 0,
        failed: 0,
        refusedNoSnapshot: true,
      };
    }
  }

  // Load all scored tender links in one query.
  // We do NOT read TenderOutcome or TenderClient.isAwarded.
  const tenderClientRows = await prisma.tenderClient.findMany({
    where: {
      tender: { tenderScoreCounted: true },
    },
    select: {
      clientId: true,
      tender: {
        select: {
          tenderScoreCounted: true,
          wonAt: true,
          status: true,
        },
      },
    },
  });

  // Build a map: clientId -> array of tenders
  const byClient = new Map();
  for (const row of tenderClientRows) {
    if (!byClient.has(row.clientId)) {
      byClient.set(row.clientId, []);
    }
    byClient.get(row.clientId).push(row.tender);
  }

  let wouldChange = 0;
  let wouldIncrease = 0;
  let wouldDecrease = 0;
  let failed = 0;

  // Collect updates for batching
  const updates = [];

  for (const client of clients) {
    const tenders = byClient.get(client.id) ?? [];
    const computed = computeStats(tenders);

    const currentWinRate =
      client.winRate == null ? 0 : Number(client.winRate);

    const tcChanged = computed.tenderCount !== client.tenderCount;
    const wcChanged = computed.winCount !== client.winCount;
    // Compare win_rate with 2dp rounding
    const wrChanged =
      Math.round(currentWinRate * 100) !== Math.round(computed.winRate * 100);

    const changed = tcChanged || wcChanged || wrChanged;

    if (!changed) {
      log(
        `OK    clientId=${client.id} name="${client.name}" ` +
          `tender_count=${computed.tenderCount} win_count=${computed.winCount} ` +
          `win_rate=${computed.winRate} (no change)`
      );
      continue;
    }

    wouldChange++;

    // Determine direction of win_count delta (the primary business metric)
    const delta = computed.winCount - client.winCount;
    if (delta > 0) wouldIncrease++;
    else if (delta < 0) wouldDecrease++;
    // A zero win_count delta with a tender_count or win_rate change counts in
    // neither bucket -- it's a correction but not a directional win-count move.

    log(
      `DELTA clientId=${client.id} name="${client.name}"\n` +
        `      tender_count: ${client.tenderCount} -> ${computed.tenderCount}` +
        (tcChanged ? " **" : "") +
        `\n` +
        `      win_count:    ${client.winCount} -> ${computed.winCount}` +
        (wcChanged ? ` ** (delta ${delta > 0 ? "+" : ""}${delta})` : "") +
        `\n` +
        `      win_rate:     ${currentWinRate} -> ${computed.winRate}` +
        (wrChanged ? " **" : "")
    );

    if (mode === "apply") {
      updates.push({
        id: client.id,
        tenderCount: computed.tenderCount,
        winCount: computed.winCount,
        winRate: computed.winRate,
      });
    }
  }

  // Apply in transactional batches
  if (mode === "apply" && updates.length > 0) {
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      try {
        await prisma.$transaction(
          batch.map((u) =>
            prisma.client.update({
              where: { id: u.id },
              data: {
                tenderCount: u.tenderCount,
                winCount: u.winCount,
                winRate: u.winRate,
              },
            })
          )
        );
        for (const u of batch) {
          log(`WRITE clientId=${u.id} tender_count=${u.tenderCount} win_count=${u.winCount} win_rate=${u.winRate}`);
        }
      } catch (err) {
        for (const u of batch) {
          log(`ERROR clientId=${u.id}: ${err?.message ?? err}`);
          failed++;
        }
      }
    }
  }

  log("");
  log(
    `Summary (${mode}): would_change=${wouldChange} ` +
      `up=${wouldIncrease} down=${wouldDecrease} failed=${failed}`
  );

  return { wouldChange, wouldIncrease, wouldDecrease, failed, refusedNoSnapshot: false };
}

// ---------------------------------------------------------------------------
// Prisma resolution
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

/**
 * Load PrismaClient from the API app's node_modules.
 * Probes several candidate bases so the script works from the main checkout,
 * a git worktree, or CI (where the canonical path is C:\ProjectOperations2).
 */
function loadPrismaClient() {
  const probeBases = [
    process.env.REPO_BASE,
    REPO_ROOT,
    process.cwd(),
    "C:\\ProjectOperations2",
  ].filter(Boolean);

  for (const base of probeBases) {
    const pkgPath = join(
      base,
      "apps",
      "api",
      "node_modules",
      "@prisma",
      "client",
      "package.json"
    );
    try {
      const req = createRequire(pkgPath);
      return req("@prisma/client").PrismaClient;
    } catch {
      // try next candidate
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const parsed = parseArgs(process.argv);

if (parsed.mode === "help") {
  console.log(HELP_TEXT);
  process.exit(0);
}

if (parsed.mode === "error") {
  console.error(
    `ERROR: ${parsed.unknown.join("; ")}\n` +
      `Run with --help for usage.`
  );
  process.exit(2);
}

// Guard: only wire up Prisma when actually running (not when imported in tests)
const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const PrismaClient = loadPrismaClient();
  if (!PrismaClient) {
    console.error(
      "FATAL: could not resolve @prisma/client.\n" +
        "Run `pnpm install` from the repo root, or set REPO_BASE to the repo root."
    );
    process.exit(1);
  }

  const DATABASE_URL =
    process.env.DATABASE_URL ??
    "postgresql://project_ops:project_ops@localhost:5432/project_operations?schema=public";

  const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
  });

  const mode = parsed.mode;
  const snapshotPath = parsed.snapshotPath ?? null;

  console.log(
    `recompute-client-stats.mjs -- mode=${mode} snapshot=${snapshotPath ?? "(none)"} -- ${new Date().toISOString()}`
  );

  run({ mode, snapshotPath, prisma })
    .then(({ failed, refusedNoSnapshot }) => {
      prisma.$disconnect();
      if (refusedNoSnapshot) {
        process.exit(1);
      }
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("FATAL:", err);
      prisma.$disconnect();
      process.exit(1);
    });
}
