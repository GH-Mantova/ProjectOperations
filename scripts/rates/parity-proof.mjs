#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/rates/parity-proof.mjs
// ---------------------------------------------------------------------------
// Read-only parity instrument: for every legacy rate key in the database,
// does the RateTable path return the SAME value AND the SAME unit as the
// legacy path? This is the value-and-unit equality gate that fallback-audit
// does NOT check. fallback-audit proves resolvability; this proves identity.
//
// This is a SLICE 11b2-c deliverable. It is the precondition for 11c, which
// removes the legacy fallback. Once tryLegacy is gone, any key the RateTable
// cannot serve identically fails at runtime — silently, in pricing.
//
// Counting rule: tryLegacy covers 8 slugs — labour, plant, waste, cutting,
// core-hole, fuel, enclosure, other-rates. fallback-audit and the migration
// plan both say "6 priced slugs" and "6 legacy slug handlers" — both
// undercount. SLICE 11a registered enclosure (-> EstimateEnclosureRate) and
// other-rates (-> CuttingOtherRate) in the resolver at :425 and :437 of
// rate-resolver.service.ts. The canonical count is the number of case
// branches in tryLegacy, which is 8.
//
// This script calls the REAL assertRateParity from the compiled API dist.
// It does NOT re-implement the comparison logic. A proof that mirrors the
// thing it is proving proves nothing.
//
// Exit codes:
//   0 — every key matched (value AND unit identical in both paths).
//   1 — at least one divergence. Report lists every divergence.
//   2 — DB unreachable / import failed / infrastructure error.
//
// A NO DATA slug (zero active legacy rows) is neither a pass nor a fail
// and must not be silently counted as a pass. It is listed in the summary
// with a NO DATA label.
//
// Usage:
//   pnpm rates:parity-proof
//   node scripts/rates/parity-proof.mjs
//
// Read-only: this script NEVER writes, updates, or deletes any data.
// Do NOT point this at production. The PR delivers the instrument; Marco runs it.
// ---------------------------------------------------------------------------

// Force canonical source to ratetable — same as fallback-audit. assertRateParity
// calls both tryLegacy and tryRateTable regardless of canonical source; this env
// var is set for consistency and to ensure getCanonicalSource() resolves correctly
// in any branch of the resolver that might read it.
process.env.RATES_CANONICAL_SOURCE = "ratetable";

import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

// Report output goes to docs/rates/ (same directory as fallback-audit reports).
const OUT_DIR = join(REPO_ROOT, "docs", "rates");

// ---------------------------------------------------------------------------
// STEP 1: Resolve @prisma/client — same probe order as fallback-audit.mjs
// ---------------------------------------------------------------------------

const probeBases = [
  process.env.REPO_BASE,   // explicit override
  REPO_ROOT,               // relative to the script (works in main checkout)
  process.cwd(),           // cwd (works when run from repo root directly)
  "C:\\ProjectOperations2" // canonical local path (CI / deploy)
].filter(Boolean);

let PrismaClient;
for (const base of probeBases) {
  const pkgPath = join(base, "apps", "api", "node_modules", "@prisma", "client", "package.json");
  try {
    const rr = createRequire(pkgPath);
    ({ PrismaClient } = rr("@prisma/client"));
    break;
  } catch {
    // try next candidate
  }
}
if (!PrismaClient) {
  console.error(
    "FATAL: could not resolve @prisma/client.\n" +
    `Tried bases: ${probeBases.join(", ")}\n` +
    "Run `pnpm install` from the repo root, or set REPO_BASE to the repo root."
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------
// STEP 2: Import the compiled RateResolverService from apps/api/dist
//
// The dist is a CommonJS module. We use createRequire from the API's
// node_modules so that @nestjs/common, @nestjs/config, etc. resolve correctly.
// reflect-metadata must be loaded before the NestJS decorators execute.
//
// We probe the same base candidates for the dist location.
// ---------------------------------------------------------------------------

let RateResolverService;
let distBase;
for (const base of probeBases) {
  const apiNodeModulesPkg = join(
    base, "apps", "api", "node_modules", "@nestjs", "common", "package.json"
  );
  try {
    // Load reflect-metadata via the API's node_modules so Reflect.metadata is
    // available when the compiled module runs its __metadata() calls.
    const rReflect = createRequire(
      join(base, "apps", "api", "node_modules", "reflect-metadata", "package.json")
    );
    rReflect("reflect-metadata");

    // Now load the compiled service. createRequire from the api node_modules pkg
    // so that its internal requires (@nestjs/common, @nestjs/config, etc.) resolve
    // from there.
    const rService = createRequire(apiNodeModulesPkg);
    const servicePath = join(
      base, "apps", "api", "dist", "src", "modules", "rates", "rate-resolver.service.js"
    );
    ({ RateResolverService } = rService(servicePath));
    distBase = base;
    break;
  } catch {
    // try next candidate
  }
}

if (!RateResolverService) {
  console.error(
    "FATAL: could not import RateResolverService from apps/api/dist.\n" +
    `Tried bases: ${probeBases.join(", ")}\n` +
    "Ensure `pnpm build` has been run (or the API has been compiled) and\n" +
    "that apps/api/dist/src/modules/rates/rate-resolver.service.js exists.\n" +
    "Do NOT modify apps/api/src/ to work around this — report instead."
  );
  process.exit(2);
}

console.log(`[MEASURED] Loaded RateResolverService from dist at base: ${distBase}`);

// ---------------------------------------------------------------------------
// STEP 3: Prisma client — read-only usage throughout
// ---------------------------------------------------------------------------

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://project_ops:project_ops@localhost:5432/project_operations?schema=public";

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } }
});

// ---------------------------------------------------------------------------
// STEP 4: Instantiate RateResolverService with a raw PrismaClient.
//
// The compiled constructor is:
//   constructor(prisma) { this.prisma = prisma; }
// The __metadata call annotates types for NestJS DI but does not affect
// construction. A raw PrismaClient has all the methods assertRateParity needs.
// If this ever fails without touching apps/api/src/, this script exits 2
// and reports — it never forces compatibility.
// ---------------------------------------------------------------------------

let svc;
try {
  svc = new RateResolverService(prisma);
} catch (err) {
  console.error(
    "FATAL: could not instantiate RateResolverService with a raw PrismaClient.\n" +
    "The compiled service shape does not permit this pattern without changes to\n" +
    "apps/api/src/ — scope boundary violation. Reporting and stopping.\n" +
    String(err)
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------
// STEP 5: Discover legacy lookup keys from the database.
// Keys use BOTH the legacy field name AND the RateTable column name (title
// case with spaces) so that assertRateParity's tryRateTable path can match
// without camelCase heuristics — same pattern as fallback-audit.mjs:281-378.
// ---------------------------------------------------------------------------

async function discoverLegacyLookups() {
  const lookups = [];

  // --- labour: key = { role, shift } × 3 shifts ---
  // Column names in DB: "Role" (KEY), "Day rate", "Night rate", "Weekend rate" (VALUE)
  const labourRows = await prisma.estimateLabourRate.findMany({ where: { isActive: true } });
  for (const row of labourRows) {
    for (const shift of ["day", "night", "weekend"]) {
      lookups.push({
        slug: "labour",
        keys: { role: row.role, Role: row.role, shift },
        label: `labour role=${row.role} shift=${shift}`
      });
    }
  }

  // --- plant: key = { item } ---
  // Column name in DB: "Item" (KEY)
  const plantRows = await prisma.estimatePlantRate.findMany({ where: { isActive: true } });
  for (const row of plantRows) {
    lookups.push({
      slug: "plant",
      keys: { item: row.item, Item: row.item },
      label: `plant item=${row.item}`
    });
  }

  // --- waste: key = { wasteType, facility } ---
  // Column names in DB: "Facility" (KEY), "Waste type" (KEY)
  const wasteRows = await prisma.estimateWasteRate.findMany({ where: { isActive: true } });
  for (const row of wasteRows) {
    lookups.push({
      slug: "waste",
      keys: {
        wasteType: row.wasteType,
        "Waste type": row.wasteType,
        facility: row.facility,
        Facility: row.facility
      },
      label: `waste wasteType=${row.wasteType} facility=${row.facility}`
    });
  }

  // --- cutting: key = { equipment, elevation, material, depthMm } ---
  // Column names in DB: "Equipment" (KEY), "Elevation" (KEY), "Material" (KEY), "Depth (mm)" (KEY)
  const cuttingRows = await prisma.estimateCuttingRate.findMany({ where: { isActive: true } });
  for (const row of cuttingRows) {
    lookups.push({
      slug: "cutting",
      keys: {
        equipment: row.equipment,
        Equipment: row.equipment,
        elevation: row.elevation,
        Elevation: row.elevation,
        material: row.material,
        Material: row.material,
        depthMm: row.depthMm,
        "Depth (mm)": row.depthMm
      },
      label: `cutting equip=${row.equipment} elev=${row.elevation} mat=${row.material} depth=${row.depthMm}mm`
    });
  }

  // --- core-hole: key = { diameterMm } ---
  // Column name in DB: "Diameter (mm)" (KEY)
  const coreHoleRows = await prisma.estimateCoreHoleRate.findMany();
  for (const row of coreHoleRows) {
    lookups.push({
      slug: "core-hole",
      keys: { diameterMm: row.diameterMm, "Diameter (mm)": row.diameterMm },
      label: `core-hole diameter=${row.diameterMm}mm`
    });
  }

  // --- fuel: key = { item } ---
  // Column name in DB: "Item" (KEY)
  const fuelRows = await prisma.estimateFuelRate.findMany({ where: { isActive: true } });
  for (const row of fuelRows) {
    lookups.push({
      slug: "fuel",
      keys: { item: row.item, Item: row.item },
      label: `fuel item=${row.item}`
    });
  }

  // --- enclosure: key = { enclosureType } ---
  // SLICE 11a: enclosure registered in the resolver seam.
  // Column name in DB: "Enclosure type" (KEY)
  const enclosureRows = await prisma.estimateEnclosureRate.findMany({ where: { isActive: true } });
  for (const row of enclosureRows) {
    lookups.push({
      slug: "enclosure",
      keys: { enclosureType: row.enclosureType, "Enclosure type": row.enclosureType },
      label: `enclosure enclosureType=${row.enclosureType}`
    });
  }

  // --- other-rates: key = { description } ---
  // SLICE 11a: other-rates maps to CuttingOtherRate.
  // Column name in DB: "Description" (KEY)
  const otherRows = await prisma.cuttingOtherRate.findMany({ where: { isActive: true } });
  for (const row of otherRows) {
    lookups.push({
      slug: "other-rates",
      keys: { description: row.description, Description: row.description },
      label: `other-rates description=${row.description}`
    });
  }

  return lookups;
}

// ---------------------------------------------------------------------------
// STEP 6: Count rows per slug for the NO DATA callout. A slug with zero rows
// is reported separately — it is neither a pass nor a fail, and must not be
// silently counted as a pass.
// ---------------------------------------------------------------------------

async function countLegacyRowsPerSlug() {
  return {
    labour:      (await prisma.estimateLabourRate.count({ where: { isActive: true } })),
    plant:       (await prisma.estimatePlantRate.count({ where: { isActive: true } })),
    waste:       (await prisma.estimateWasteRate.count({ where: { isActive: true } })),
    cutting:     (await prisma.estimateCuttingRate.count({ where: { isActive: true } })),
    "core-hole": (await prisma.estimateCoreHoleRate.count()),
    fuel:        (await prisma.estimateFuelRate.count({ where: { isActive: true } })),
    enclosure:   (await prisma.estimateEnclosureRate.count({ where: { isActive: true } })),
    "other-rates": (await prisma.cuttingOtherRate.count({ where: { isActive: true } }))
  };
}

// ---------------------------------------------------------------------------
// STEP 7: Main
// ---------------------------------------------------------------------------

const SLUGS = ["labour", "plant", "waste", "cutting", "core-hole", "fuel", "enclosure", "other-rates"];

async function main() {
  console.log("=== rates parity-proof ===");
  console.log(`RATES_CANONICAL_SOURCE = ${process.env.RATES_CANONICAL_SOURCE}`);
  console.log(`DATABASE_URL prefix    = ${DATABASE_URL.replace(/:[^:@]*@/, ":***@")}`);
  console.log(`Counting rule: 8 slugs covered by tryLegacy in rate-resolver.service.ts`);
  console.log(`  labour | plant | waste | cutting | core-hole | fuel | enclosure | other-rates`);
  console.log(`  (fallback-audit and the migration plan both say 6 — they predate SLICE 11a)`);
  console.log("");

  // Probe connection — fail loud if DB is unreachable (Doctrine 7, §2: connect then assert)
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    console.error("FATAL: cannot connect to database.", err.message);
    process.exit(2);
  }

  const rowCounts = await countLegacyRowsPerSlug();
  const noDataSlugs = SLUGS.filter((s) => rowCounts[s] === 0);
  const dataSlugs = SLUGS.filter((s) => rowCounts[s] > 0);

  console.log("Row counts per slug (active rows only):");
  for (const slug of SLUGS) {
    const count = rowCounts[slug];
    console.log(`  ${slug}: ${count === 0 ? "NO DATA" : count}`);
  }
  console.log("");

  const lookups = await discoverLegacyLookups();
  console.log(`Discovered ${lookups.length} lookup key(s) across ${dataSlugs.length} slug(s) with data.`);
  if (noDataSlugs.length > 0) {
    console.log(`NO DATA (slug has zero active rows — neither pass nor fail): ${noDataSlugs.join(", ")}`);
  }
  console.log("");

  // Per-slug accumulators
  const bySlug = {};
  for (const slug of SLUGS) {
    bySlug[slug] = { total: 0, matched: 0, diverged: 0, divergences: [] };
  }

  // Run assertRateParity for each lookup key
  for (const { slug, keys, label } of lookups) {
    bySlug[slug].total++;
    let result;
    try {
      result = await svc.assertRateParity(slug, keys);
    } catch (err) {
      // Infrastructure / unexpected error — escalate with exit 2
      console.error(`FATAL: assertRateParity threw for ${label}: ${err.message}`);
      await prisma.$disconnect();
      process.exit(2);
    }

    if (result.matches) {
      bySlug[slug].matched++;
    } else {
      bySlug[slug].diverged++;
      bySlug[slug].divergences.push({
        label,
        slug: result.slug,
        keys: result.keys,
        legacy: result.legacy,
        ratetable: result.ratetable,
        divergence: result.divergence
      });
    }
  }

  // Tally
  let totalMatched = 0;
  let totalDiverged = 0;
  for (const slug of SLUGS) {
    totalMatched += bySlug[slug].matched;
    totalDiverged += bySlug[slug].diverged;
  }

  // Console summary
  console.log("--- RESULTS ---");
  console.log(`Total keys checked: ${lookups.length}`);
  console.log(`Matched (value + unit identical): ${totalMatched}`);
  console.log(`Diverged: ${totalDiverged}`);
  if (noDataSlugs.length > 0) {
    console.log(`NO DATA (not counted in pass/fail): ${noDataSlugs.join(", ")}`);
  }
  console.log("");

  for (const slug of SLUGS) {
    const stats = bySlug[slug];
    if (rowCounts[slug] === 0) {
      console.log(`  [NO DATA] ${slug}: 0 rows — not counted in pass/fail`);
    } else if (stats.diverged === 0) {
      console.log(`  [PASS]    ${slug}: ${stats.matched}/${stats.total} matched`);
    } else {
      console.log(`  [DIVERGE] ${slug}: ${stats.diverged} divergence(s) out of ${stats.total}`);
      for (const div of stats.divergences) {
        console.log(`            -> ${div.label}: ${div.divergence}`);
      }
    }
  }
  console.log("");

  const verdict = totalDiverged === 0 ? "PASS" : "FAIL";
  if (verdict === "PASS") {
    console.log("VERDICT: PASS — every legacy key returned the same value and unit from RateTable.");
  } else {
    console.log(`VERDICT: FAIL — ${totalDiverged} divergence(s) found. See report for details.`);
    console.log("A divergence is a real bug in the seed or the ratetable model (see assertRateParity doc-comment).");
    console.log("Report the finding — do not chase it in this slice.");
  }
  console.log("");

  // ---------------------------------------------------------------------------
  // Write markdown report to docs/rates/
  // ---------------------------------------------------------------------------
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportPath = join(OUT_DIR, `parity-proof-${stamp}.md`);

  const maskedUrl = DATABASE_URL.replace(/:[^:@]*@/, ":***@");
  const lines = [];
  lines.push(`# Rates Parity Proof — ${stamp}`);
  lines.push("");
  lines.push("> Generated by `scripts/rates/parity-proof.mjs` (SLICE 11b2-c)");
  lines.push("> **READ-ONLY** — no data was written, updated, or deleted.");
  lines.push("> This is the value-and-unit equality gate for SLICE 11c (remove tryLegacy).");
  lines.push("");
  lines.push("## Canonical source and counting rule");
  lines.push("");
  lines.push(`- \`RATES_CANONICAL_SOURCE\` forced to: \`ratetable\``);
  lines.push(`- Database: \`${maskedUrl}\``);
  lines.push(`- Run at: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("**Counting rule:** `tryLegacy` in `rate-resolver.service.ts` covers **8 slugs**:");
  lines.push("labour, plant, waste, cutting, core-hole, fuel, enclosure, other-rates.");
  lines.push("`fallback-audit.mjs` and `docs/plans/rates-migration-plan.md:35` both say");
  lines.push("\"6 priced slugs\" — they predate SLICE 11a, which registered `enclosure`");
  lines.push("(→ `EstimateEnclosureRate`) and `other-rates` (→ `CuttingOtherRate`) in the");
  lines.push("resolver at `:425` and `:437` of `rate-resolver.service.ts`.");
  lines.push("The canonical count is the number of `case` branches in `tryLegacy`, which is **8**.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("|--------|-------|");
  lines.push(`| Total legacy keys checked | ${lookups.length} |`);
  lines.push(`| Matched (value + unit identical) | ${totalMatched} |`);
  lines.push(`| Diverged | ${totalDiverged} |`);
  lines.push(`| NO DATA slugs (zero active rows) | ${noDataSlugs.length} |`);
  lines.push("");
  lines.push("## Verdict");
  lines.push("");
  if (verdict === "PASS") {
    lines.push("**PASS** — every legacy key returns the same value and unit from the RateTable path.");
    lines.push("11c's precondition (value+unit identity) is met for all slugs with data.");
    if (noDataSlugs.length > 0) {
      lines.push("");
      lines.push(`**NO DATA** slugs not counted: ${noDataSlugs.join(", ")}.`);
      lines.push("These must be verified separately before 11c proceeds — a slug with");
      lines.push("no legacy rows cannot be proven either way.");
    }
  } else {
    lines.push("**FAIL** — one or more divergences found. 11c must NOT proceed until these are resolved.");
    lines.push("");
    lines.push("A divergence is a real bug in the seed or the ratetable model");
    lines.push("(per `assertRateParity` doc-comment). It is a finding, not a test failure:");
    lines.push("report it to Marco rather than patching the script or the data here.");
  }
  lines.push("");
  lines.push("## Per-slug breakdown");
  lines.push("");

  for (const slug of SLUGS) {
    const stats = bySlug[slug];
    const rowCount = rowCounts[slug];
    lines.push(`### ${slug}`);
    lines.push("");
    if (rowCount === 0) {
      lines.push(`**NO DATA** — 0 active rows in the legacy table. Not counted in pass/fail.`);
      lines.push("A slug with no legacy rows cannot be proven — verify seeding before 11c.");
    } else {
      lines.push(`- Legacy rows (active): ${rowCount}`);
      // labour has 3 keys per row (day/night/weekend)
      lines.push(`- Keys checked: ${stats.total}`);
      lines.push(`- Matched: ${stats.matched}`);
      lines.push(`- Diverged: ${stats.diverged}`);
      if (stats.divergences.length > 0) {
        lines.push("");
        lines.push("**Divergences:**");
        lines.push("");
        for (const div of stats.divergences) {
          const legacyDesc =
            div.legacy === null
              ? "null (not found)"
              : "error" in div.legacy
              ? `error: ${div.legacy.error}`
              : `value=${div.legacy.value} unit="${div.legacy.unit}"`;
          const rtDesc =
            div.ratetable === null
              ? "null (not found)"
              : "error" in div.ratetable
              ? `error: ${div.ratetable.error}`
              : `value=${div.ratetable.value} unit="${div.ratetable.unit}"`;
          lines.push(`- \`${div.label}\``);
          lines.push(`  - Legacy:     ${legacyDesc}`);
          lines.push(`  - RateTable:  ${rtDesc}`);
          lines.push(`  - Divergence: ${div.divergence}`);
        }
      }
    }
    lines.push("");
  }

  lines.push("## Method note");
  lines.push("");
  lines.push("See `docs/data-model/rates-migration/PARITY-PROOF-METHOD.md` for what this");
  lines.push("instrument checks, what it does not check, and how to read each exit code.");

  writeFileSync(reportPath, lines.join("\n") + "\n", "utf8");
  console.log(`Report written to: ${reportPath}`);
  console.log("");

  await prisma.$disconnect();

  // Exit code: 0 = all matched, 1 = divergences found, 2 = infrastructure error
  process.exit(totalDiverged === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Unhandled error in parity-proof:", err);
  process.exit(2);
});
