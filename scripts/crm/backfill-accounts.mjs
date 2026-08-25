#!/usr/bin/env node
// =============================================================================
// scripts/crm/backfill-accounts.mjs
// =============================================================================
// Idempotent backfill: creates one Account row per distinct client_id found
// in tender_clients where no Account yet links to that clientId.
//
// This script NEVER updates or deletes existing rows. If an Account already
// exists for a given clientId it is silently skipped.
//
// Usage:
//   node scripts/crm/backfill-accounts.mjs          # dry run (default)
//   node scripts/crm/backfill-accounts.mjs --dry-run # dry run (explicit)
//   node scripts/crm/backfill-accounts.mjs --apply   # write to DB
//   node scripts/crm/backfill-accounts.mjs --help    # print help, exit 0
//   node scripts/crm/backfill-accounts.mjs -h        # same
//
// Exit codes:
//   0 - success (dry run or apply completed without error)
//   1 - fatal error (DB connection failed, unexpected exception)
//   2 - bad usage (unknown flag)
// =============================================================================

import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Judgement call, not a measurement -- change this if the business defines
// "active" differently. A tender updated within this many months is "recent".
const ACTIVE_WINDOW_MONTHS = 12;

const LIFECYCLE = {
  ACTIVE: "ACTIVE",
  PAST: "PAST",
  PROSPECT: "PROSPECT",
};

const HELP_TEXT = `
backfill-accounts.mjs -- idempotent Account backfill from tender_clients

USAGE
  node scripts/crm/backfill-accounts.mjs [flags]

FLAGS
  (no flags)   Dry run. Print what would be created, nothing written.
  --dry-run    Dry run (explicit, same as default).
  --apply      Write Account rows to the database.
  --help, -h   Print this message and exit 0.

BEHAVIOUR
  For each distinct client_id in tender_clients that has no Account row yet,
  a new Account is created with:
    accountType:     CLIENT
    source:          OTHER
    ownerId:         null
    notes:           null
    lifecycleStatus: derived (see below)

LIFECYCLE DERIVATION
  ACTIVE   -- client has a TenderClient on a tender whose updatedAt is within
              the last ${ACTIVE_WINDOW_MONTHS} months (boundary: >= cutoff, not >)
  PAST     -- client has TenderClient rows but none within ${ACTIVE_WINDOW_MONTHS} months
  PROSPECT -- client has no TenderClient rows at all

SAFETY
  This script NEVER updates or deletes any existing row.
  Clients that already have an Account are skipped silently.
  Run without --apply to preview before writing.

DATABASE
  Reads DATABASE_URL from environment (defaults to local dev DB).
`.trim();

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    return { mode: "help" };
  }
  if (args.includes("--apply")) {
    return { mode: "apply" };
  }
  const unknown = args.filter((a) => a !== "--dry-run");
  if (unknown.length > 0) {
    return { mode: "error", unknown };
  }
  return { mode: "dry-run" };
}

// ---------------------------------------------------------------------------
// lifecycleStatus derivation (pure -- no DB access, exported for tests)
// ---------------------------------------------------------------------------

/**
 * Derive AccountLifecycleStatus from a client's TenderClient records.
 *
 * @param {Array<{ tenderUpdatedAt: Date }>} tenderClients
 *   Each element must have a `tenderUpdatedAt` Date (the updatedAt of the
 *   linked Tender). An empty array means no TenderClient rows exist.
 * @param {Date} [now]  Injection point for tests (defaults to new Date()).
 * @returns {"ACTIVE" | "PAST" | "PROSPECT"}
 */
export function deriveLifecycleStatus(tenderClients, now) {
  if (!tenderClients || tenderClients.length === 0) {
    return LIFECYCLE.PROSPECT;
  }

  const cutoff = computeCutoff(now ?? new Date(), ACTIVE_WINDOW_MONTHS);

  const hasRecent = tenderClients.some(
    (tc) => tc.tenderUpdatedAt >= cutoff
  );

  return hasRecent ? LIFECYCLE.ACTIVE : LIFECYCLE.PAST;
}

/**
 * Compute the cutoff Date for the active window.
 * Exported for tests.
 *
 * @param {Date} now
 * @param {number} months
 * @returns {Date}
 */
export function computeCutoff(now, months) {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff;
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
// Main runner (exported for tests -- thin CLI wrapper at the bottom calls it)
// ---------------------------------------------------------------------------

/**
 * Backfill runner. Accepts an injected prisma instance so tests can pass a
 * mock without touching the real DB.
 *
 * @param {{
 *   mode: "dry-run" | "apply",
 *   prisma: object,
 *   now?: Date,
 *   log?: (msg: string) => void
 * }} opts
 * @returns {Promise<{ wouldCreate: number, alreadyExists: number, failed: number }>}
 */
export async function run({ mode, prisma, now, log = console.log }) {
  // Fetch all distinct clientIds from tender_clients along with the max
  // updatedAt of the linked tender.  We do this in a single query:
  //   For each clientId, gather all TenderClient rows and the updatedAt of
  //   their linked Tender so we can compute lifecycleStatus.
  //
  // Note: TenderClient.updatedAt is the row's own timestamp; we want the
  // Tender's updatedAt to know if the tender itself was recently active.
  // The task spec says "tender whose updatedAt is within last N months".

  const tenderClientRows = await prisma.tenderClient.findMany({
    select: {
      clientId: true,
      client: { select: { name: true } },
      tender: { select: { updatedAt: true } },
    },
    orderBy: { clientId: "asc" },
  });

  // Group by clientId
  const byClient = new Map();
  for (const row of tenderClientRows) {
    if (!byClient.has(row.clientId)) {
      byClient.set(row.clientId, {
        clientId: row.clientId,
        clientName: row.client?.name ?? row.clientId,
        tenderDates: [],
      });
    }
    byClient.get(row.clientId).tenderDates.push(row.tender.updatedAt);
  }

  // Also pick up any clients that have an existing Account -- we need to
  // check these to implement the "skip if already exists" rule.
  const existingAccounts = await prisma.account.findMany({
    where: { clientId: { not: null } },
    select: { clientId: true },
  });
  const existingClientIds = new Set(
    existingAccounts.map((a) => a.clientId)
  );

  const nowDate = now ?? new Date();
  let wouldCreate = 0;
  let alreadyExists = 0;
  let failed = 0;

  for (const [clientId, info] of byClient) {
    if (existingClientIds.has(clientId)) {
      log(
        `SKIP  [already exists] clientId=${clientId} name="${info.clientName}"`
      );
      alreadyExists++;
      continue;
    }

    const tenderClients = info.tenderDates.map((d) => ({
      tenderUpdatedAt: d,
    }));
    const lifecycleStatus = deriveLifecycleStatus(tenderClients, nowDate);

    if (mode === "dry-run") {
      log(
        `DRY   [would create] clientId=${clientId} name="${info.clientName}" ` +
          `lifecycle=${lifecycleStatus} ` +
          `(most_recent_tender=${
            info.tenderDates.length > 0
              ? new Date(Math.max(...info.tenderDates.map((d) => d.getTime()))).toISOString().slice(0, 10)
              : "none"
          })`
      );
      wouldCreate++;
    } else {
      // --apply: write the row
      try {
        await prisma.account.create({
          data: {
            clientId,
            lifecycleStatus,
            accountType: "CLIENT",
            source: "OTHER",
            ownerId: null,
            notes: null,
          },
        });
        log(
          `WRITE [created] clientId=${clientId} name="${info.clientName}" ` +
            `lifecycle=${lifecycleStatus}`
        );
        wouldCreate++;
      } catch (err) {
        // If the row appeared between our read and our write (race / concurrent
        // run) the unique constraint fires. Treat this as "already exists".
        if (err?.code === "P2002") {
          log(
            `SKIP  [conflict -- already created] clientId=${clientId}`
          );
          alreadyExists++;
        } else {
          log(
            `ERROR [failed] clientId=${clientId}: ${err?.message ?? err}`
          );
          failed++;
        }
      }
    }
  }

  log("");
  log(
    `Summary (${mode}): would_create=${wouldCreate} already_exists=${alreadyExists} failed=${failed}`
  );

  return { wouldCreate, alreadyExists, failed };
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
    `ERROR: unknown flag(s): ${parsed.unknown.join(", ")}\n` +
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

  console.log(
    `backfill-accounts.mjs -- mode=${parsed.mode} -- ${new Date().toISOString()}`
  );

  run({ mode: parsed.mode, prisma })
    .then(({ failed }) => {
      prisma.$disconnect();
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("FATAL:", err);
      prisma.$disconnect();
      process.exit(1);
    });
}
