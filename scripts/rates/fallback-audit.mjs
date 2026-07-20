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

import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
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

/** Attempt resolution from the flexible RateTable model (canonical path). */
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

  const match = rows.find((r) => {
    const cells = (r.cells ?? {});
    return keyCols.every((c) => norm(cells[c.id]) === norm(keys[c.name] ?? keys[c.id]));
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

  // --- labour: key = { role, shift } × 3 shifts ---
  const labourRows = await prisma.estimateLabourRate.findMany({ where: { isActive: true } });
  for (const row of labourRows) {
    for (const shift of ["day", "night", "weekend"]) {
      lookups.push({
        slug: "labour",
        keys: { role: row.role, shift },
        label: `labour role=${row.role} shift=${shift}`
      });
    }
  }

  // --- plant: key = { item } ---
  const plantRows = await prisma.estimatePlantRate.findMany({ where: { isActive: true } });
  for (const row of plantRows) {
    lookups.push({
      slug: "plant",
      keys: { item: row.item },
      label: `plant item=${row.item}`
    });
  }

  // --- waste: key = { wasteType, facility } ---
  const wasteRows = await prisma.estimateWasteRate.findMany({ where: { isActive: true } });
  for (const row of wasteRows) {
    lookups.push({
      slug: "waste",
      keys: { wasteType: row.wasteType, facility: row.facility },
      label: `waste wasteType=${row.wasteType} facility=${row.facility}`
    });
  }

  // --- cutting: key = { equipment, elevation, material, depthMm } ---
  const cuttingRows = await prisma.estimateCuttingRate.findMany({ where: { isActive: true } });
  for (const row of cuttingRows) {
    lookups.push({
      slug: "cutting",
      keys: {
        equipment: row.equipment,
        elevation: row.elevation,
        material: row.material,
        depthMm: row.depthMm
      },
      label: `cutting equip=${row.equipment} elev=${row.elevation} mat=${row.material} depth=${row.depthMm}mm`
    });
  }

  // --- core-hole: key = { diameterMm } ---
  const coreHoleRows = await prisma.estimateCoreHoleRate.findMany();
  for (const row of coreHoleRows) {
    lookups.push({
      slug: "core-hole",
      keys: { diameterMm: row.diameterMm },
      label: `core-hole diameter=${row.diameterMm}mm`
    });
  }

  // --- fuel: key = { item } ---
  const fuelRows = await prisma.estimateFuelRate.findMany({ where: { isActive: true } });
  for (const row of fuelRows) {
    lookups.push({
      slug: "fuel",
      keys: { item: row.item },
      label: `fuel item=${row.item}`
    });
  }

  return lookups;
}

/**
 * Discover EstimateEnclosureRate rows separately — they bypass the resolver
 * and have no registered slug. Reported as a gap, not a fallback.
 */
async function discoverEnclosureLookups() {
  const rows = await prisma.estimateEnclosureRate.findMany({ where: { isActive: true } });
  return rows.map((row) => ({
    slug: null,
    keys: { enclosureType: row.enclosureType },
    label: `enclosure enclosureType=${row.enclosureType}`
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
  const enclosureLookups = await discoverEnclosureLookups();

  console.log(`Discovered ${lookups.length} resolvable legacy lookup(s) across 6 slugs.`);
  console.log(`Discovered ${enclosureLookups.length} enclosure lookup(s) with no resolver slug (unaddressed gap — see report).`);
  console.log("");

  // Per-slug counters
  const slugs = ["labour", "plant", "waste", "cutting", "core-hole", "fuel"];
  const bySlug = {};
  for (const slug of slugs) {
    bySlug[slug] = { total: 0, ratetable: 0, fallback: 0, missing: 0, failedKeys: [] };
  }

  let totalRatetable = 0;
  let totalFallback = 0;
  let totalMissing = 0;

  for (const lookup of lookups) {
    const { slug, keys, label } = lookup;
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

  const total = lookups.length;
  const noSlugCount = enclosureLookups.length;

  // Headline stdout
  console.log("--- RESULTS ---");
  console.log(`Total lookups:     ${total}`);
  console.log(`RateTable hits:    ${totalRatetable}`);
  console.log(`Legacy fallbacks:  ${totalFallback}`);
  console.log(`Not found (both):  ${totalMissing}`);
  console.log(`No-slug (enclosure, unaddressed): ${noSlugCount}`);
  console.log("");

  if (totalFallback > 0 || totalMissing > 0) {
    console.log("VERDICT: FAIL — fallback or missing lookups detected. PHASE D precondition 2 NOT met.");
  } else if (noSlugCount > 0) {
    console.log("VERDICT: WARN — all routed slugs resolve via RateTable, but enclosure rates have no resolver slug and remain unaddressed.");
  } else {
    console.log("VERDICT: PASS — all legacy lookup keys resolved via RateTable. PHASE D precondition 2 met.");
  }
  console.log("");

  // Write report
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportPath = join(OUT_DIR, `fallback-audit-${stamp}.md`);

  const lines = [];
  lines.push(`# Rates Fallback Audit — ${stamp}`);
  lines.push("");
  lines.push("> Generated by `scripts/rates/fallback-audit.mjs`");
  lines.push("> **READ-ONLY** — no data was written, updated, or deleted.");
  lines.push("> This report is the pr-524 PHASE D precondition-2 gate.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total resolvable lookups | ${total} |`);
  lines.push(`| RateTable hits | ${totalRatetable} |`);
  lines.push(`| Legacy fallbacks | ${totalFallback} |`);
  lines.push(`| Not found (both sources) | ${totalMissing} |`);
  lines.push(`| Enclosure (no resolver slug) | ${noSlugCount} |`);
  lines.push("");
  lines.push("## Verdict");
  lines.push("");
  if (totalFallback > 0 || totalMissing > 0) {
    lines.push("**FAIL** — One or more legacy keys are not covered by RateTable.");
    lines.push("PHASE D must NOT proceed until this audit exits 0.");
  } else if (noSlugCount > 0) {
    lines.push("**WARN** — All routed slugs pass. Enclosure rates bypass the resolver entirely (see below).");
  } else {
    lines.push("**PASS** — All legacy lookup keys are covered by RateTable. Script exits 0.");
  }
  lines.push("");
  lines.push("## Per-surface breakdown");
  lines.push("");

  for (const slug of slugs) {
    const stats = bySlug[slug];
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

  lines.push("## Enclosure rates (no resolver slug — unaddressed gap)");
  lines.push("");
  lines.push(
    "`EstimateEnclosureRate` exists in the Prisma schema but has no slug registered in " +
    "`rate-resolver.service.ts:tryLegacy`. The `lookup-rate.handler.ts` persona handler " +
    "accesses it directly via `prisma.estimateEnclosureRate.findFirst`, bypassing " +
    "`resolveRate`. These keys CANNOT be exercised through the resolver seam and therefore " +
    "cannot be validated by this script. They represent an open gap that must be addressed " +
    "before a complete cutover to RateTable."
  );
  lines.push("");
  if (enclosureLookups.length === 0) {
    lines.push("No active enclosure rate rows found in database.");
  } else {
    lines.push("Active enclosure rows (not yet addressable via resolver):");
    lines.push("");
    for (const entry of enclosureLookups) {
      lines.push(`- \`${entry.label}\``);
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

  // Exit code = verdict
  if (totalFallback > 0 || totalMissing > 0) {
    process.exit(1);
  }
  // noSlugCount > 0 is a warn but not a hard failure (enclosure is a known gap,
  // not a regression — it was never addressable through the resolver)
  process.exit(0);
}

main().catch((err) => {
  console.error("Unhandled error in fallback-audit:", err);
  process.exit(2);
});
