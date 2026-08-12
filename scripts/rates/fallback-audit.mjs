#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/rates/fallback-audit.mjs
// ---------------------------------------------------------------------------
// Read-only audit: checks whether every legacy rate lookup key is resolvable
// from the canonical RateTable model when RATES_CANONICAL_SOURCE=ratetable.
//
// Purpose: pr-524-rates-b-slice2-canonical PHASE D precondition 2 gate.
//   PHASE D (irreversible legacy table drop) may only proceed after a full
//   live pricing cycle ran with RATES_CANONICAL_SOURCE=ratetable AND this
//   script exits 0 (zero fallback events).
//
// Exit codes:
//   0 — all legacy lookup keys are covered by RateTable; safe to cut over.
//   1 — one or more keys fell back to legacy source; NOT safe to cut over.
//
// Usage:
//   pnpm rates:fallback-audit
//   node scripts/rates/fallback-audit.mjs
//
// Read-only: this script NEVER writes, updates, or deletes any rate data.
// ---------------------------------------------------------------------------

// Force canonical source to ratetable so the resolver path we audit is the
// one that matters for PHASE D — the path where RateTable is primary and
// legacy is the unwanted fallback.
process.env.RATES_CANONICAL_SOURCE = "ratetable";

import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

// @prisma/client lives in apps/api/node_modules. We probe several candidate
// base directories in priority order so the script works from:
//   - the main checkout (C:\ProjectOperations2)
//   - a git worktree (which shares the object store but not node_modules)
//   - any absolute path set via REPO_BASE env var
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
    const r = createRequire(pkgPath);
    ({ PrismaClient } = r("@prisma/client"));
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
const OUT_DIR = join(REPO_ROOT, "docs", "rates");

// ---------------------------------------------------------------------------
// Prisma client — read-only usage throughout
// ---------------------------------------------------------------------------

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://project_ops:project_ops@localhost:5432/project_operations?schema=public";

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } }
});

// ---------------------------------------------------------------------------
// Resolution helpers
// These mirror rate-resolver.service.ts tryRateTable() and tryLegacy()
// EXACTLY. Any change to those private methods must be reflected here.
// The canonical source is always "ratetable" in this script — we try
// RateTable first, and a legacy result here means a fallback event.
// ---------------------------------------------------------------------------

/** Attempt resolution from the flexible RateTable model (canonical path).
 * Mirrors rate-resolver.service.ts:tryRateTable — keep in sync.
 * Key matching is case-insensitive: column "Role" matches key "role". */
async function tryRateTable(slug, keys) {
  const table = await prisma.rateTable.findUnique({
    where: { slug },
    include: { columns: true }
  });
  if (!table) return null;

  const keyCols = table.columns.filter((c) => c.role === "KEY");
  const valueCols = table.columns.filter((c) => c.role === "VALUE");
  if (valueCols.length === 0) return null;

  const rows = await prisma.rateRow.findMany({
    where: { rateTableId: table.id, isActive: true }
  });

  // Build normalised-key index so "Role" column matches key "role".
  const keysLower = {};
  for (const [k, v] of Object.entries(keys)) {
    keysLower[k.trim().toLowerCase()] = v;
  }

  const match = rows.find((r) => {
    const cells = (r.cells ?? {});
    return keyCols.every((c) => {
      const colNameLower = c.name.trim().toLowerCase();
      const callerVal = keys[c.name] ?? keysLower[colNameLower] ?? keys[c.id];
      return norm(cells[c.id]) === norm(callerVal);
    });
  });
  if (!match) return null;

  const value = Number((match.cells ?? {})[valueCols[0].id]);
  return {
    rowId: match.id,
    value,
    unit: valueCols[0].unit ?? "",
    source: "ratetable"
  };
}

/** Attempt resolution from the legacy Estimate* tables (fallback path). */
async function tryLegacy(slug, keys) {
  switch (slug) {
    case "labour": {
      const role = String(keys.role ?? "");
      const shift = String(keys.shift ?? "day");
      const row = await prisma.estimateLabourRate.findUnique({ where: { role } });
      if (!row) return null;
      const rate =
        shift === "night" ? row.nightRate : shift === "weekend" ? row.weekendRate : row.dayRate;
      return { rowId: row.id, value: Number(rate), unit: "day", source: "legacy" };
    }
    case "plant": {
      const item = String(keys.item ?? "");
      const row = await prisma.estimatePlantRate.findUnique({ where: { item } });
      if (!row) return null;
      return { rowId: row.id, value: Number(row.rate), unit: row.unit, source: "legacy" };
    }
    case "waste": {
      const wasteType = String(keys.wasteType ?? "");
      const facility = String(keys.facility ?? "");
      const row = await prisma.estimateWasteRate.findUnique({
        where: { wasteType_facility: { wasteType, facility } }
      });
      if (!row) return null;
      return { rowId: row.id, value: Number(row.tonRate), unit: row.unit, source: "legacy" };
    }
    case "cutting": {
      const equipment = String(keys.equipment ?? "");
      const elevation = String(keys.elevation ?? "");
      const material = String(keys.material ?? "");
      const depthMm = Number(keys.depthMm ?? 0);
      const row = await prisma.estimateCuttingRate.findUnique({
        where: {
          equipment_elevation_material_depthMm: { equipment, elevation, material, depthMm }
        }
      });
      if (!row) return null;
      return { rowId: row.id, value: Number(row.ratePerM), unit: "m", source: "legacy" };
    }
    case "core-hole": {
      const diameterMm = Number(keys.diameterMm ?? 0);
      const row = await prisma.estimateCoreHoleRate.findUnique({ where: { diameterMm } });
      if (!row) return null;
      return { rowId: row.id, value: Number(row.ratePerHole), unit: "hole", source: "legacy" };
    }
    case "fuel": {
      const item = String(keys.item ?? "");
      const row = await prisma.estimateFuelRate.findUnique({ where: { item } });
      if (!row) return null;
      return { rowId: row.id, value: Number(row.rate), unit: row.unit, source: "legacy" };
    }
    case "enclosure": {
      // SLICE 11a: enclosure now registered in the resolver seam.
      const enclosureType = String(keys.enclosureType ?? "");
      const row = await prisma.estimateEnclosureRate.findFirst({
        where: { enclosureType, isActive: true }
      });
      if (!row) return null;
      return { rowId: row.id, value: Number(row.rate), unit: row.unit, source: "legacy" };
    }
    case "other-rates": {
      // SLICE 11a: other-rates maps to CuttingOtherRate.
      const description = String(keys.description ?? "");
      const row = await prisma.cuttingOtherRate.findFirst({
        where: { description, isActive: true }
      });
      if (!row) return null;
      return { rowId: row.id, value: Number(row.rate), unit: row.unit, source: "legacy" };
    }
    default:
      return null;
  }
}

/** Resolve a single (slug, keys) pair: RateTable-first, legacy-fallback. */
async function resolveRate(slug, keys) {
  const rt = await tryRateTable(slug, keys);
  if (rt) return { ...rt, source: "ratetable" };
  const leg = await tryLegacy(slug, keys);
  if (leg) return { ...leg, source: "legacy" };
  return null;
}

/**
 * Resolve a material density from the material-densities RateTable.
 * Mirrors RateResolverService.resolveMaterialDensityFromRateTable.
 * Returns { density, source } or null.
 */
async function resolveDensityFromRateTable(materialName) {
  const table = await prisma.rateTable.findUnique({
    where: { slug: "material-densities" },
    include: { columns: true }
  });
  if (!table) return null;
  const byKey = new Map(table.columns.map((c) => [c.name.toLowerCase(), c]));
  const materialCol = byKey.get("material");
  const densityCol = byKey.get("density");
  if (!materialCol || !densityCol) return null;

  const rows = await prisma.rateRow.findMany({
    where: { rateTableId: table.id, isActive: true }
  });
  const wanted = materialName.trim().toLowerCase();
  const match = rows.find((r) => {
    const cells = (r.cells ?? {});
    const v = cells[materialCol.id] ?? cells[materialCol.name];
    return String(v ?? "").trim().toLowerCase() === wanted;
  });
  if (!match) return null;
  const cells = (match.cells ?? {});
  const density = Number(cells[densityCol.id]);
  if (!Number.isFinite(density)) return null;
  return { density, source: "ratetable" };
}

function norm(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Legacy table discovery — enumerate every distinct lookup key from each
// legacy Estimate* rate table. Keys are NOT hardcoded; they come from the DB.
// ---------------------------------------------------------------------------

/**
 * Enumerate lookup keys from all six legacy tables that are registered in
 * rate-resolver.service.ts:tryLegacy. Each entry is { slug, keys, label }.
 *
 * NOTE: EstimateEnclosureRate exists in schema but has NO slug in tryLegacy
 * and is accessed directly (bypassing the resolver) in lookup-rate.handler.ts.
 * It is reported in the audit as "no-slug" entries — they cannot be
 * exercised through resolveRate and therefore represent an unaddressed gap.
 */
async function discoverLegacyLookups() {
  const lookups = [];

  // Keys use BOTH the legacy field name (for tryLegacy) AND the RateTable
  // column name (for tryRateTable). The tryRateTable key lookup is:
  //   keys[c.name] ?? keysLower[c.name.toLowerCase()] ?? keys[c.id]
  // So including both "role" and "Role" in the keys object means both paths resolve.
  // We include the column-name keys so tryRateTable can match without camelCase heuristics.

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

  // --- enclosure: key = { enclosureType } — SLICE 11a: now registered in the seam ---
  // Column name in DB: "Enclosure type" (KEY)
  const enclosureRows = await prisma.estimateEnclosureRate.findMany({ where: { isActive: true } });
  for (const row of enclosureRows) {
    lookups.push({
      slug: "enclosure",
      keys: { enclosureType: row.enclosureType, "Enclosure type": row.enclosureType },
      label: `enclosure enclosureType=${row.enclosureType}`
    });
  }

  // --- other-rates: key = { description } — SLICE 11a ---
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

/**
 * Discover EstimateMaterialDensity rows — SLICE 11a adds material-densities
 * as a reference RateTable. We verify each density resolves via the RateTable
 * rather than counting as a fallback (densities use a separate resolver path,
 * not resolveRate, so they are audited in their own section).
 */
async function discoverDensityLookups() {
  const rows = await prisma.estimateMaterialDensity.findMany({ where: { isActive: true } });
  return rows.map((row) => ({
    materialName: row.materialName,
    expectedDensity: Number(row.density),
    label: `material-densities materialName=${row.materialName}`
  }));
}

// ---------------------------------------------------------------------------
// Main audit
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== rates fallback-audit ===");
  console.log(`RATES_CANONICAL_SOURCE = ${process.env.RATES_CANONICAL_SOURCE}`);
  console.log(`DATABASE_URL prefix    = ${DATABASE_URL.replace(/:[^:@]*@/, ":***@")}`);
  console.log("");

  // Probe connection — fail loud if DB is unreachable.
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    console.error("FATAL: cannot connect to database.", err.message);
    process.exit(2);
  }

  const lookups = await discoverLegacyLookups();
  const densityLookups = await discoverDensityLookups();

  console.log(`Discovered ${lookups.length} resolvable legacy lookup(s) across 9 slugs (6 priced + enclosure + other-rates [SLICE 11a]).`);
  console.log(`Discovered ${densityLookups.length} material-density lookup(s) [SLICE 11a reference table].`);
  console.log("");

  // Per-slug counters for the 9 routed slugs
  const slugs = ["labour", "plant", "waste", "cutting", "core-hole", "fuel", "enclosure", "other-rates"];
  const bySlug = {};
  for (const slug of slugs) {
    bySlug[slug] = { total: 0, ratetable: 0, fallback: 0, missing: 0, failedKeys: [] };
  }

  let totalRatetable = 0;
  let totalFallback = 0;
  let totalMissing = 0;

  for (const lookup of lookups) {
    const { slug, keys, label } = lookup;
    if (!bySlug[slug]) {
      bySlug[slug] = { total: 0, ratetable: 0, fallback: 0, missing: 0, failedKeys: [] };
    }
    bySlug[slug].total++;

    const result = await resolveRate(slug, keys);
    if (result === null) {
      bySlug[slug].missing++;
      totalMissing++;
      bySlug[slug].failedKeys.push({ label, outcome: "not-found-in-either" });
    } else if (result.source === "ratetable") {
      bySlug[slug].ratetable++;
      totalRatetable++;
    } else {
      // source === "legacy" — this is the fallback event
      bySlug[slug].fallback++;
      totalFallback++;
      bySlug[slug].failedKeys.push({ label, outcome: "legacy-fallback" });
    }
  }

  // Density section — separate from the main resolveRate loop because
  // densities use a different resolver path (resolveMaterialDensity, not resolveRate).
  let densityRatetable = 0;
  let densityFallback = 0;
  let densityMissing = 0;
  const densityFailedKeys = [];
  for (const entry of densityLookups) {
    const result = await resolveDensityFromRateTable(entry.materialName);
    if (result === null) {
      densityMissing++;
      densityFailedKeys.push({ label: entry.label, outcome: "not-found-in-ratetable" });
    } else if (Math.abs(result.density - entry.expectedDensity) < 0.001) {
      densityRatetable++;
    } else {
      densityFallback++;
      densityFailedKeys.push({
        label: entry.label,
        outcome: `density-mismatch: legacy=${entry.expectedDensity} ratetable=${result.density}`
      });
    }
  }

  const total = lookups.length;

  // Headline stdout
  console.log("--- RESULTS (9 routed slugs) ---");
  console.log(`Total lookups:     ${total}`);
  console.log(`RateTable hits:    ${totalRatetable}`);
  console.log(`Legacy fallbacks:  ${totalFallback}`);
  console.log(`Not found (both):  ${totalMissing}`);
  console.log("");
  console.log("--- RESULTS (material-densities reference table) ---");
  console.log(`Total densities:   ${densityLookups.length}`);
  console.log(`RateTable matches: ${densityRatetable}`);
  console.log(`Mismatches:        ${densityFallback}`);
  console.log(`Not found:         ${densityMissing}`);
  console.log("");

  const anyFail = totalFallback > 0 || totalMissing > 0 || densityFallback > 0 || densityMissing > 0;

  if (anyFail) {
    console.log("VERDICT: FAIL — fallback or missing lookups detected. PHASE D precondition 2 NOT met.");
  } else {
    console.log("VERDICT: PASS — all 9 slug lookups + all density rows resolved via RateTable. PHASE D precondition 2 met.");
  }
  console.log("");

  // Write report
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportPath = join(OUT_DIR, `fallback-audit-${stamp}.md`);

  const lines = [];
  lines.push(`# Rates Fallback Audit — ${stamp}`);
  lines.push("");
  lines.push("> Generated by `scripts/rates/fallback-audit.mjs` (SLICE 11a extended)");
  lines.push("> **READ-ONLY** — no data was written, updated, or deleted.");
  lines.push("> This report is the pr-524 PHASE D precondition-2 gate.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total resolvable lookups (9 slugs) | ${total} |`);
  lines.push(`| RateTable hits | ${totalRatetable} |`);
  lines.push(`| Legacy fallbacks | ${totalFallback} |`);
  lines.push(`| Not found (both sources) | ${totalMissing} |`);
  lines.push(`| Total density lookups | ${densityLookups.length} |`);
  lines.push(`| Density RateTable matches | ${densityRatetable} |`);
  lines.push(`| Density mismatches / not found | ${densityFallback + densityMissing} |`);
  lines.push("");
  lines.push("## Verdict");
  lines.push("");
  if (anyFail) {
    lines.push("**FAIL** — One or more keys are not covered by RateTable.");
    lines.push("PHASE D must NOT proceed until this audit exits 0.");
  } else {
    lines.push("**PASS** — All legacy lookup keys and all density rows are covered by RateTable. Script exits 0.");
  }
  lines.push("");
  lines.push("## Per-surface breakdown (9 routed slugs)");
  lines.push("");

  for (const slug of slugs) {
    const stats = bySlug[slug] ?? { total: 0, ratetable: 0, fallback: 0, missing: 0, failedKeys: [] };
    lines.push(`### ${slug}`);
    lines.push("");
    lines.push(`- Total: ${stats.total}`);
    lines.push(`- RateTable hits: ${stats.ratetable}`);
    lines.push(`- Fallbacks: ${stats.fallback}`);
    lines.push(`- Not found: ${stats.missing}`);
    if (stats.failedKeys.length > 0) {
      lines.push("");
      lines.push("**Problem lookups:**");
      lines.push("");
      for (const entry of stats.failedKeys) {
        lines.push(`- \`${entry.label}\` → ${entry.outcome}`);
      }
    }
    lines.push("");
  }

  lines.push("## Material densities (reference table)");
  lines.push("");
  lines.push(`- Total: ${densityLookups.length}`);
  lines.push(`- RateTable matches: ${densityRatetable}`);
  lines.push(`- Mismatches: ${densityFallback}`);
  lines.push(`- Not found in RateTable: ${densityMissing}`);
  if (densityFailedKeys.length > 0) {
    lines.push("");
    lines.push("**Problem densities:**");
    lines.push("");
    for (const entry of densityFailedKeys) {
      lines.push(`- \`${entry.label}\` → ${entry.outcome}`);
    }
  }
  lines.push("");
  lines.push("## Environment");
  lines.push("");
  lines.push(`- \`RATES_CANONICAL_SOURCE\`: \`${process.env.RATES_CANONICAL_SOURCE}\``);
  lines.push(`- Run at: ${new Date().toISOString()}`);
  lines.push(`- Database: \`${DATABASE_URL.replace(/:[^:@]*@/, ":***@")}\``);

  writeFileSync(reportPath, lines.join("\n") + "\n", "utf8");
  console.log(`Report written to: ${reportPath}`);
  console.log("");

  await prisma.$disconnect();

  // Exit code: 0 = PASS, 1 = FAIL, 2 = fatal/infrastructure error
  process.exit(anyFail ? 1 : 0);
}

main().catch((err) => {
  console.error("Unhandled error in fallback-audit:", err);
  process.exit(2);
});
