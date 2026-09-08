#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/rates/backfill-waste-map-location-ids.mjs — TIP-ID-S2
// ---------------------------------------------------------------------------
// Fill in `mapLocationId` on the rows of the two waste rate tables
// (slug `waste-per-tonne` = rt-wst-t, slug `waste-per-m3` = rt-wst-m3) by
// matching each row's stored facility string against a MapLocation of
// kind = "TIP" on the EXACT, TRIMMED string. No fuzzy matching, ever.
//
// TIP-ID-S1 added the cell and a resolver (apps/api/src/modules/rates/
// waste-facility.ts) but shipped every row null. This script is the one-off
// that fills the rows that already exist; MapLocationsService keeps rows
// created later true.
//
// DRY RUN BY DEFAULT. Nothing is written unless --apply is passed.
//
// ---------------------------------------------------------------------------
// WHAT THE DATA ACTUALLY LOOKS LIKE  (measured 2026-09-07, not assumed)
// ---------------------------------------------------------------------------
// 1. `RateRow.cells` is a JSON object keyed by **RateColumn id**, not by the
//    human column name and not by the seed's short key. Evidence:
//      - apps/api/prisma/migrations/20260713140000_seed_baseline_rate_tables/
//        migration.sql inserts rows such as
//        {"rt-wst-t-c-facility":"BMI Acacia Ridge","rt-wst-t-c-type":...}
//      - seed-initial-services.ts:3663-3673 (`upsertTable`) rewrites every
//        cell key to `${tableId}-c-${columnKey}` before writing.
//      - every reader in apps/api uses `cells[col.id]` (rate-resolver.service
//        .ts:296/386/627, rate-validation.service.ts:79, rate-xlsm-export
//        .service.ts:79), some with a `?? cells[col.name]` fallback.
//    So this script resolves the cell key from the table's RateColumn rows
//    and only falls back to the bare `facility` / `Facility` spellings when
//    the column-id key is genuinely absent from that row.
//
// 2. The `Map location` column (cell key `<tableId>-c-mapLocationId`) exists
//    ONLY in the TypeScript seed projection (seed-initial-services.ts, added
//    by TIP-ID-S1 a7730d01). No migration creates it, and TIP-ID-S2 is
//    `gate_allow: none` so this slice adds none either. A database that was
//    built by `prisma migrate deploy` and never re-seeded therefore has the
//    rate rows but NOT the column. That is not fatal — the id lives in the
//    JSON cell and `cells` is free-form — but the Rates admin screen renders
//    by column, so the value is invisible there until the column exists.
//    The script says so loudly and keeps going; it never invents a column.
//
// 3. `resolveWasteFacility` (S1) reads the BARE keys `cells.mapLocationId`
//    and `cells.facility`, which is not the convention above. Until that is
//    reconciled (S3), this script writes the id under BOTH the canonical
//    column-id key and the bare `mapLocationId` alias, so the shipped
//    resolver can actually see what was backfilled. `--no-alias` turns the
//    second write off. Extra cell keys are inert for every other reader:
//    RateValidationService iterates columns and ignores unknown keys.
//
// ---------------------------------------------------------------------------
// SAFETY / WHAT A WRONG INVOCATION COSTS
// ---------------------------------------------------------------------------
//   * No flags            → reads only. Zero writes. Worst case: wasted time.
//   * --apply             → UPDATEs RateRow.cells for matched rows only, adding
//                           one (or two) keys. Every other cell is copied
//                           through unchanged; no key is ever deleted and no
//                           row is ever created or deleted. Re-running is a
//                           no-op (written: 0).
//   * --allow-partial     → lets --apply proceed while some rows still have no
//                           TIP. Leaves a mixed population that S3's integrity
//                           check cannot tell apart from a regression. The
//                           receipt records BACKFILL_UNMATCHED_NONZERO, which
//                           keeps S3 gated shut. This is the flag to think
//                           twice about.
//   * --force             → overwrites an EXISTING, DIFFERENT mapLocationId.
//                           This is the only flag that can lose information.
//                           Without it a differing id is a refusal, not a
//                           re-decision.
//   * EstimateWasteRate is never touched. RateRow.cells is the only target.
//
// KNOWN CLOBBER RISKS (report them to Marco, they are not this script's bug):
//   * `pnpm seed` / `pnpm seed:reference` re-run `seedRateTableProjections`,
//     which REPLACES RateRow.cells wholesale from EstimateWasteRate and sets
//     mapLocationId back to null. Re-seeding after a backfill undoes it.
//     Correct order is: seed (creates the column), then backfill.
//   * The Rates admin row editor (rate-tables.service.ts:271 updateRow)
//     replaces `cells` with the payload the screen sends. Editing a waste row
//     by hand drops any cell key the screen does not know about.
//
// ---------------------------------------------------------------------------
// USAGE
//   pnpm rates:backfill-tip-ids                    # dry run (default)
//   node scripts/rates/backfill-waste-map-location-ids.mjs
//   node scripts/rates/backfill-waste-map-location-ids.mjs --apply
//   node scripts/rates/backfill-waste-map-location-ids.mjs --apply --allow-partial
//   node scripts/rates/backfill-waste-map-location-ids.mjs --apply --force
//   node scripts/rates/backfill-waste-map-location-ids.mjs --help
//
// EXIT CODES
//   0 — ran, and every examined row matched exactly one active TIP.
//   1 — refused to apply, a write failed, nothing was examined, or one or
//       more rows did not match. A dry run that finds unmatched rows exits 1
//       ON PURPOSE: "matched nothing" must never look like success.
//   2 — bad usage (unknown flag).
// ---------------------------------------------------------------------------

import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

// The two tables this slice owns, by RateTable.slug.
export const WASTE_TABLE_SLUGS = ["waste-per-tonne", "waste-per-m3"];

// Receipt path — tracked, and gated on by TIP-ID-S3.
export const RECEIPT_REL_PATH = join("docs", "audits", "waste-map-location-backfill.md");

// Cell-key spellings, in resolution order. `<tableId>-c-<key>` is the
// convention every writer in the repo uses; the bare spellings are only a
// fallback for rows written by something else.
const FACILITY_COLUMN_NAME = "Facility";
const MAP_LOCATION_COLUMN_NAME = "Map location";
const FACILITY_BARE_KEYS = ["facility", "Facility"];
const MAP_LOCATION_ALIAS_KEY = "mapLocationId";

const BATCH_SIZE = 25;

const HELP_TEXT = `
backfill-waste-map-location-ids.mjs -- link waste rate rows to MapLocation TIPs

USAGE
  node scripts/rates/backfill-waste-map-location-ids.mjs [flags]

FLAGS
  (no flags)        Dry run. Prints the plan, writes NOTHING.
  --dry-run         Dry run (explicit, same as default).
  --apply           Write mapLocationId onto matched rows.
  --allow-partial   Permit --apply while some rows have no TIP. Leaves a mixed
                    population; the receipt then records the NONZERO token and
                    TIP-ID-S3 stays gated shut.
  --force           Permit --apply to overwrite an existing, DIFFERENT
                    mapLocationId. The only flag that can lose information.
  --no-alias        Write only the canonical <tableId>-c-mapLocationId cell key
                    and skip the bare "mapLocationId" alias that S1's
                    resolveWasteFacility() reads.
  --help, -h        Print this and exit 0.

MATCHING RULE
  cells.facility  ===  MapLocation.facility   (exact, both trimmed)
  restricted to MapLocation.kind = "TIP" AND isActive = true.
  No case folding. No punctuation stripping. No fuzzy matching. A near miss is
  reported as NO MATCH and is a finding, not something to guess at.
  A facility string matched by two or more active TIPs is AMBIGUOUS and is
  never guessed either.

ON --apply
  Writes docs/audits/waste-map-location-backfill.md (tracked). THAT RECEIPT
  MUST BE COMMITTED -- TIP-ID-S3's gate reads it, and a receipt that only ever
  existed on one laptop gates nothing.

EXIT CODES
  0 success (everything matched)   1 refused / unmatched / write failed   2 usage
`.trim();

// ---------------------------------------------------------------------------
// CLI parsing (pure)
// ---------------------------------------------------------------------------

/**
 * @param {string[]} argv process.argv
 * @returns {{ mode: 'help'|'dry-run'|'apply'|'error', allowPartial?: boolean,
 *             force?: boolean, writeAlias?: boolean, unknown?: string[] }}
 */
export function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) return { mode: "help" };

  let apply = false;
  let dryRun = false;
  let allowPartial = false;
  let force = false;
  let writeAlias = true;
  const unknown = [];

  for (const arg of args) {
    if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--allow-partial") allowPartial = true;
    else if (arg === "--force") force = true;
    else if (arg === "--no-alias") writeAlias = false;
    else unknown.push(arg);
  }

  if (unknown.length > 0) return { mode: "error", unknown };
  if (apply && dryRun) {
    return { mode: "error", unknown: ["--apply and --dry-run are mutually exclusive"] };
  }
  return { mode: apply ? "apply" : "dry-run", allowPartial, force, writeAlias };
}

// ---------------------------------------------------------------------------
// Planning (pure -- no Prisma, so the decision logic is inspectable)
// ---------------------------------------------------------------------------

/** Trim for comparison. null/undefined/non-string -> null (never ""). */
export function normaliseFacility(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Work out which cell key holds the facility string for one row.
 * @returns {string|null} the key, or null when the row has no facility cell.
 */
export function facilityCellKey(table, cells) {
  const col = table.columns.find((c) => c.name === FACILITY_COLUMN_NAME);
  const candidates = [
    col ? col.id : null,
    `${table.id}-c-facility`,
    ...FACILITY_BARE_KEYS
  ].filter(Boolean);
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(cells, key)) return key;
  }
  return null;
}

/**
 * The cell key(s) the id is written to for one table.
 * `primary` is the canonical column-id key. When the "Map location" column
 * has not been created yet we still use the deterministic id the seed would
 * stamp, so a later re-seed lines up on the same key.
 */
export function mapLocationCellKeys(table, writeAlias) {
  const col = table.columns.find((c) => c.name === MAP_LOCATION_COLUMN_NAME);
  const primary = col ? col.id : `${table.id}-c-mapLocationId`;
  const keys = [primary];
  if (writeAlias && primary !== MAP_LOCATION_ALIAS_KEY) keys.push(MAP_LOCATION_ALIAS_KEY);
  return { primary, keys, columnExists: Boolean(col) };
}

/**
 * Build the per-row plan.
 *
 * @param {Array<{id:string,slug:string,columns:Array<{id:string,name:string}>,rows:Array<{id:string,cells:object,isActive:boolean}>}>} tables
 * @param {Array<{id:string,name:string,facility:string|null,isActive:boolean}>} tips  MapLocations of kind TIP (active AND inactive)
 * @param {{ writeAlias: boolean }} opts
 * @returns {{ plans: Array<object>, counts: object, unmatchedFacilities: Array<{facility:string,rows:number,reason:string}> }}
 */
export function buildPlan(tables, tips, { writeAlias }) {
  const activeByFacility = new Map();
  const inactiveFacilities = new Set();
  for (const tip of tips) {
    const facility = normaliseFacility(tip.facility);
    if (facility === null) continue;
    if (!tip.isActive) {
      inactiveFacilities.add(facility);
      continue;
    }
    if (!activeByFacility.has(facility)) activeByFacility.set(facility, []);
    activeByFacility.get(facility).push(tip);
  }

  const plans = [];
  const unmatched = new Map();

  for (const table of tables) {
    const { primary, keys, columnExists } = mapLocationCellKeys(table, writeAlias);
    for (const row of table.rows) {
      const cells = (row.cells && typeof row.cells === "object") ? row.cells : {};
      const key = facilityCellKey(table, cells);
      const facility = key === null ? null : normaliseFacility(cells[key]);

      const base = {
        tableSlug: table.slug,
        rowId: row.id,
        rowActive: row.isActive !== false,
        facility,
        primary,
        keys,
        columnExists,
        cells
      };

      if (facility === null) {
        plans.push({ ...base, status: "NO_FACILITY_CELL", mapLocationId: null, note: key === null ? "no facility cell on this row" : "facility cell is empty" });
        continue;
      }

      const candidates = activeByFacility.get(facility) ?? [];
      if (candidates.length === 0) {
        const reason = inactiveFacilities.has(facility)
          ? "only an INACTIVE TIP carries this facility string"
          : "no MapLocation of kind TIP carries this facility string";
        plans.push({ ...base, status: "NO_MATCH", mapLocationId: null, note: reason });
        const seen = unmatched.get(facility) ?? { facility, rows: 0, reason };
        seen.rows += 1;
        unmatched.set(facility, seen);
        continue;
      }
      if (candidates.length > 1) {
        const reason = `${candidates.length} active TIPs share this facility string (${candidates.map((t) => t.id).join(", ")})`;
        plans.push({ ...base, status: "AMBIGUOUS", mapLocationId: null, note: reason });
        const seen = unmatched.get(facility) ?? { facility, rows: 0, reason };
        seen.rows += 1;
        unmatched.set(facility, seen);
        continue;
      }

      const tip = candidates[0];
      const existing = keys
        .map((k) => (Object.prototype.hasOwnProperty.call(cells, k) ? cells[k] : null))
        .map((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null));
      const conflicting = existing.filter((v) => v !== null && v !== tip.id);

      if (conflicting.length > 0) {
        plans.push({
          ...base,
          status: "CONFLICT",
          mapLocationId: tip.id,
          existingId: conflicting[0],
          note: `already linked to ${conflicting[0]} -- refusing to re-decide without --force`
        });
        continue;
      }
      if (existing.every((v) => v === tip.id)) {
        plans.push({ ...base, status: "ALREADY_LINKED", mapLocationId: tip.id, note: "no change" });
        continue;
      }
      plans.push({ ...base, status: "WRITE", mapLocationId: tip.id, note: `-> ${tip.name}` });
    }
  }

  const counts = {
    examined: plans.length,
    matched: plans.filter((p) => p.mapLocationId !== null).length,
    unmatched: plans.filter((p) => p.mapLocationId === null).length,
    toWrite: plans.filter((p) => p.status === "WRITE").length,
    alreadyLinked: plans.filter((p) => p.status === "ALREADY_LINKED").length,
    conflicts: plans.filter((p) => p.status === "CONFLICT").length,
    ambiguous: plans.filter((p) => p.status === "AMBIGUOUS").length,
    noFacilityCell: plans.filter((p) => p.status === "NO_FACILITY_CELL").length,
    noMatch: plans.filter((p) => p.status === "NO_MATCH").length
  };

  return {
    plans,
    counts,
    unmatchedFacilities: [...unmatched.values()].sort((a, b) => a.facility.localeCompare(b.facility))
  };
}

// ---------------------------------------------------------------------------
// Receipt (pure)
// ---------------------------------------------------------------------------

/**
 * Render the tracked receipt. The token on its own line IS the assertion --
 * TIP-ID-S3 greps for it. The prose deliberately never spells the ZERO token
 * out, so an unmatched run cannot accidentally contain it.
 */
export function renderReceipt({ runUtc, counts, written, forced, unmatchedFacilities, databaseLabel }) {
  const token = counts.unmatched === 0 ? "BACKFILL_UNMATCHED_ZERO" : "BACKFILL_UNMATCHED_NONZERO";
  const lines = [
    "# Waste rate rows -> MapLocation backfill receipt",
    "",
    "Written by `node scripts/rates/backfill-waste-map-location-ids.mjs --apply`.",
    "Machine-generated; do not hand-edit. TIP-ID-S3 gates on the token at the",
    "bottom of this file, so editing it by hand releases a gate that nothing",
    "has actually satisfied.",
    "",
    `- run_utc: ${runUtc}`,
    `- database: ${databaseLabel}`,
    `- examined: ${counts.examined}`,
    `- matched: ${counts.matched}`,
    `- unmatched: ${counts.unmatched}`,
    `- written: ${written}`,
    `- already_linked: ${counts.alreadyLinked}`,
    `- overwritten_with_force: ${forced}`,
    "",
    "## Facilities with no TIP",
    ""
  ];
  if (unmatchedFacilities.length === 0) {
    lines.push("None. Every examined row matched exactly one active TIP by exact, trimmed name.");
  } else {
    for (const u of unmatchedFacilities) {
      lines.push(`- "${u.facility}" — ${u.rows} row(s) — ${u.reason}`);
    }
  }
  lines.push("", token, "");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const pad = (s, n) => String(s).padEnd(n).slice(0, n);

/**
 * @param {{ mode:'dry-run'|'apply', allowPartial:boolean, force:boolean,
 *           writeAlias:boolean, prisma:object, log?:Function,
 *           receiptPath?:string, databaseLabel?:string, now?:Date }} opts
 * @returns {Promise<{ examined:number, matched:number, unmatched:number,
 *                     written:number, refused:boolean, exitCode:number }>}
 */
export async function run({
  mode,
  allowPartial = false,
  force = false,
  writeAlias = true,
  prisma,
  log = console.log,
  receiptPath = join(REPO_ROOT, RECEIPT_REL_PATH),
  databaseLabel = "(unknown)",
  now = new Date()
}) {
  const tables = await prisma.rateTable.findMany({
    where: { slug: { in: WASTE_TABLE_SLUGS } },
    include: { columns: true, rows: true }
  });

  const foundSlugs = new Set(tables.map((t) => t.slug));
  const missingSlugs = WASTE_TABLE_SLUGS.filter((s) => !foundSlugs.has(s));
  for (const slug of missingSlugs) {
    log(`ERROR: rate table "${slug}" does not exist in this database. Nothing to back fill for it.`);
  }

  const tips = await prisma.mapLocation.findMany({
    where: { kind: "TIP" },
    select: { id: true, name: true, facility: true, isActive: true }
  });
  const activeTips = tips.filter((t) => t.isActive && normaliseFacility(t.facility) !== null);
  log(
    `MapLocation TIPs: ${tips.length} total, ${activeTips.length} active with a facility string.`
  );
  if (activeTips.length === 0) {
    log(
      "WARNING: not one active TIP carries a facility string. Every row below will " +
        "report NO MATCH. MapLocation is seeded nowhere, so this is what an " +
        "un-populated database looks like -- fix the data, do not loosen the match."
    );
  }

  const { plans, counts, unmatchedFacilities } = buildPlan(tables, tips, { writeAlias });

  // --- the table ----------------------------------------------------------
  log("");
  log(
    `${pad("ROW ID", 56)} ${pad("FACILITY", 26)} ${pad("MAP LOCATION", 28)} WOULD WRITE`
  );
  log("-".repeat(130));
  for (const p of plans) {
    const matchCol =
      p.status === "NO_MATCH" || p.status === "NO_FACILITY_CELL"
        ? "NO MATCH"
        : p.status === "AMBIGUOUS"
          ? "NO MATCH (ambiguous)"
          : p.mapLocationId;
    const wouldWrite =
      p.status === "WRITE"
        ? mode === "apply"
          ? `write ${p.mapLocationId}`
          : `would write ${p.mapLocationId}`
        : p.status === "CONFLICT"
          ? `CONFLICT ${p.existingId} -> ${p.mapLocationId} (needs --force)`
          : p.status === "ALREADY_LINKED"
            ? "no change"
            : `skip (${p.note})`;
    log(`${pad(p.rowId, 56)} ${pad(p.facility ?? "(none)", 26)} ${pad(matchCol, 28)} ${wouldWrite}`);
  }

  // --- facilities with no TIP --------------------------------------------
  log("");
  if (unmatchedFacilities.length === 0) {
    log("Facilities with no TIP: none.");
  } else {
    log(`🔴 Facilities with NO TIP (${unmatchedFacilities.length}) — each one renders nowhere on Settings > Map locations:`);
    for (const u of unmatchedFacilities) {
      log(`   - "${u.facility}" — ${u.rows} row(s) — ${u.reason}`);
    }
  }

  // --- column presence ----------------------------------------------------
  for (const table of tables) {
    const { primary, columnExists } = mapLocationCellKeys(table, writeAlias);
    if (!columnExists) {
      log(
        `WARNING: table "${table.slug}" has no "${MAP_LOCATION_COLUMN_NAME}" RateColumn. ` +
          `The id will be stored in the JSON cell under "${primary}", which every ` +
          `cells[col.id] reader will find only once that column exists. Run ` +
          `\`pnpm seed\` (seedRateTableProjections) BEFORE this backfill to create it — ` +
          `re-seeding AFTERWARDS rewrites cells from EstimateWasteRate and undoes the backfill.`
      );
    }
  }

  let written = 0;
  let forced = 0;
  let refused = false;
  let failed = 0;

  // --- refusals -----------------------------------------------------------
  if (mode === "apply") {
    if (counts.unmatched > 0 && !allowPartial) {
      log("");
      log(
        `REFUSED: ${counts.unmatched} of ${counts.examined} row(s) did not match exactly one active TIP. ` +
          "A partial backfill leaves a mixed population that TIP-ID-S3's integrity check cannot " +
          "tell apart from a regression. Fix the facilities named above, or pass --allow-partial " +
          "if a mixed population is genuinely what you want."
      );
      refused = true;
    }
    if (counts.conflicts > 0 && !force) {
      log("");
      log(
        `REFUSED: ${counts.conflicts} row(s) already carry a DIFFERENT mapLocationId. ` +
          "A second run must be a no-op, not a re-decision. Pass --force only if you " +
          "have decided the stored id is wrong."
      );
      refused = true;
    }
  }

  // --- writes -------------------------------------------------------------
  if (mode === "apply" && !refused) {
    const writable = plans.filter(
      (p) => p.status === "WRITE" || (p.status === "CONFLICT" && force)
    );
    for (let i = 0; i < writable.length; i += BATCH_SIZE) {
      const batch = writable.slice(i, i + BATCH_SIZE);
      try {
        await prisma.$transaction(
          batch.map((p) => {
            // Copy every existing cell through untouched and add ours. No key
            // is ever removed: this must not damage existing data entry.
            const next = { ...p.cells };
            for (const k of p.keys) next[k] = p.mapLocationId;
            return prisma.rateRow.update({ where: { id: p.rowId }, data: { cells: next } });
          })
        );
        for (const p of batch) {
          written += 1;
          if (p.status === "CONFLICT") forced += 1;
          log(`WROTE rowId=${p.rowId} ${p.keys.join(" + ")} = ${p.mapLocationId}`);
        }
      } catch (err) {
        failed += batch.length;
        log(`ERROR writing batch starting at ${batch[0].rowId}: ${err?.message ?? err}`);
      }
    }
  }

  // --- receipt ------------------------------------------------------------
  if (mode === "apply" && !refused && failed === 0) {
    const runUtc = now.toISOString();
    const body = renderReceipt({
      runUtc,
      counts,
      written,
      forced,
      unmatchedFacilities,
      databaseLabel
    });
    try {
      mkdirSync(dirname(receiptPath), { recursive: true });
      writeFileSync(receiptPath, body, "utf8");
      log("");
      log(`RECEIPT written: ${receiptPath}`);
    } catch (err) {
      log(`ERROR: could not write the receipt to ${receiptPath}: ${err?.message ?? err}`);
      failed += 1;
    }
  }

  // --- summary ------------------------------------------------------------
  log("");
  log(
    `detail: toWrite=${counts.toWrite} alreadyLinked=${counts.alreadyLinked} ` +
      `conflicts=${counts.conflicts} ambiguous=${counts.ambiguous} ` +
      `noMatch=${counts.noMatch} noFacilityCell=${counts.noFacilityCell} ` +
      `missingTables=${missingSlugs.length} failedWrites=${failed}`
  );
  log(
    JSON.stringify({
      mode,
      examined: counts.examined,
      matched: counts.matched,
      unmatched: counts.unmatched,
      written,
      wouldWrite: mode === "apply" ? 0 : counts.toWrite
    })
  );

  // --- the loud bits ------------------------------------------------------
  let exitCode = 0;
  if (counts.examined === 0) {
    log("");
    log(
      "🔴 EXAMINED ZERO ROWS. This did not succeed — it found nothing to look at. " +
        `Either the waste rate tables do not exist in this database (missing: ` +
        `${missingSlugs.length ? missingSlugs.join(", ") : "none"}), or they have no rows. ` +
        "Check DATABASE_URL and that the rate table projections have been seeded."
    );
    exitCode = 1;
  } else if (counts.matched === 0) {
    log("");
    log(
      `🔴 MATCHED ZERO of ${counts.examined} rows. Nothing was linked. This is a finding, ` +
        "not a success: either no TIP carries these facility strings, or the strings differ. " +
        "Do NOT loosen the match to make this go away."
    );
    exitCode = 1;
  } else if (counts.unmatched > 0) {
    exitCode = 1;
  }
  if (refused || failed > 0) exitCode = 1;

  if (mode === "apply" && !refused && failed === 0) {
    log("");
    log(
      `NEXT STEP: \`git add ${RECEIPT_REL_PATH}\` and COMMIT IT. TIP-ID-S3 reads that file; ` +
        "a receipt written and never committed gates nothing."
    );
  } else if (mode !== "apply") {
    log("");
    log("Dry run — nothing was written. Re-run with --apply to write.");
  }

  return {
    examined: counts.examined,
    matched: counts.matched,
    unmatched: counts.unmatched,
    written,
    refused,
    exitCode
  };
}

// ---------------------------------------------------------------------------
// Prisma resolution (same probe order as the sibling rates scripts)
// ---------------------------------------------------------------------------

function loadPrismaClient() {
  const probeBases = [process.env.REPO_BASE, REPO_ROOT, process.cwd(), "C:\\ProjectOperations2"].filter(Boolean);
  for (const base of probeBases) {
    const pkgPath = join(base, "apps", "api", "node_modules", "@prisma", "client", "package.json");
    try {
      return createRequire(pkgPath)("@prisma/client").PrismaClient;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** Strip credentials so the receipt and the log never carry a password. */
export function maskDatabaseUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
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
  console.error(`ERROR: ${parsed.unknown.join("; ")}\nRun with --help for usage.`);
  process.exit(2);
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

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

  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  const databaseLabel = maskDatabaseUrl(DATABASE_URL);

  console.log(
    `backfill-waste-map-location-ids.mjs — mode=${parsed.mode} ` +
      `allowPartial=${parsed.allowPartial} force=${parsed.force} alias=${parsed.writeAlias} ` +
      `db=${databaseLabel} — ${new Date().toISOString()}`
  );

  run({
    mode: parsed.mode,
    allowPartial: parsed.allowPartial,
    force: parsed.force,
    writeAlias: parsed.writeAlias,
    prisma,
    databaseLabel
  })
    .then((result) => {
      prisma.$disconnect();
      process.exit(result.exitCode);
    })
    .catch((err) => {
      console.error("FATAL:", err);
      prisma.$disconnect();
      process.exit(1);
    });
}
