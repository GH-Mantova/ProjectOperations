import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import type {
  ToolHandler,
  ToolHandlerContext,
  ToolHandlerExecuteResult
} from "../tool-handler.types";

// IS business rule (Marco confirmed) — core hole rate is per-diameter,
// elevation multiplier is applied at lookup time. Floor=base, Wall has
// 10% premium, Inverted (overhead drilling) is 2x because it's
// significantly harder. The rate table itself stores diameter→rate;
// elevation is not a column.
const CORE_HOLE_ELEVATION_MULTIPLIERS = {
  floor: 1.0,
  wall: 1.1,
  inverted: 2.0
} as const;

type CoreHoleElevation = keyof typeof CORE_HOLE_ELEVATION_MULTIPLIERS;

// Cutting elevation values stored in the rate table. "Any" is a
// wildcard used for equipment that's elevation-agnostic (Flush-cut,
// Ringsaw, Tracksaw — they apply to wall and floor alike). Lookups
// pass the specific elevation the user is in; the handler matches
// either that elevation OR "Any" so wildcard rows still hit.
const CUTTING_ELEVATIONS_DB = ["Wall", "Floor", "Any"] as const;
type CuttingElevationInput = "wall" | "floor";

type CuttingInput = {
  equipment?: unknown;
  elevation?: unknown;
  material?: unknown;
  depthMm?: unknown;
};

type CoreHoleInput = {
  elevation?: unknown;
  diameterMm?: unknown;
};

type Input = {
  rateType?: unknown;
  cutting?: CuttingInput;
  coreHole?: CoreHoleInput;
};

// Normalised cutting input after validation.
type CuttingArgs = {
  equipment: string;
  elevation: CuttingElevationInput;
  material: string;
  depthMm: number;
};

type CoreHoleArgs = {
  elevation: CoreHoleElevation;
  diameterMm: number;
};

@Injectable()
export class LookupRateHandler implements ToolHandler<Input> {
  name = "lookup_rate";
  description =
    "Look up an Initial Services schedule rate from the live rate library. " +
    "Currently supports two rate types: cutting (schedule lookup by equipment, elevation, material, and depth) " +
    "and core_hole (base rate by diameter with the elevation multiplier applied: Floor=1.0x, Wall=1.1x, Inverted=2.0x). " +
    "Read-only — does not write to estimate items or scope items. " +
    "Use proactively when proposing cutting or core hole scope items so the user sees both the proposal and the live rate together.";
  inputSchema = {
    type: "object" as const,
    properties: {
      rateType: {
        type: "string",
        enum: ["cutting", "core_hole"],
        description:
          "Which rate type to look up. Other types (labour/plant/fuel/waste/enclosure/other) are not yet supported."
      },
      cutting: {
        type: "object",
        description:
          "Required when rateType is 'cutting'. Cutting uses schedule lookup; the rate row is identified by equipment, elevation, material, and depth.",
        properties: {
          equipment: {
            type: "string",
            description:
              "Cutting equipment. Common values: Roadsaw (floor concrete/asphalt), Demosaw (wall and floor), Ringsaw (any-elevation deep cuts), Flush-cut, Tracksaw."
          },
          elevation: {
            type: "string",
            enum: ["wall", "floor"],
            description:
              "Cutting elevation. Inverted is NOT supported for cutting. Equipment with 'Any' elevation in the schedule (Flush-cut, Ringsaw, Tracksaw) will match either."
          },
          material: {
            type: "string",
            description:
              "Material being cut. Common values: Concrete, Asphalt, Brick/Block, Any. Equipment-material combinations are not all valid (e.g. Roadsaw doesn't cut Brick/Block)."
          },
          depthMm: {
            type: "number",
            description: "Cut depth in millimetres. Must match a stored depth value exactly."
          }
        },
        required: ["equipment", "elevation", "material", "depthMm"]
      },
      coreHole: {
        type: "object",
        description:
          "Required when rateType is 'core_hole'. Core holes use a base rate per diameter; the elevation multiplier is applied at lookup time.",
        properties: {
          elevation: {
            type: "string",
            enum: ["floor", "wall", "inverted"],
            description:
              "Core hole elevation. Floor=1.0x, Wall=1.1x (10% overhead premium), Inverted=2.0x (overhead drilling, significantly harder)."
          },
          diameterMm: {
            type: "number",
            description: "Core hole diameter in millimetres (e.g. 50, 75, 100, 150, 200)."
          }
        },
        required: ["elevation", "diameterMm"]
      }
    },
    required: ["rateType"]
  };

  constructor(private readonly prisma: PrismaService) {}

  async execute(input: Input, ctx: ToolHandlerContext): Promise<ToolHandlerExecuteResult> {
    if (!this.hasViewPermission(ctx)) {
      return errorResult("You do not have permission to look up rates.");
    }

    if (input.rateType === "cutting") {
      const args = parseCuttingInput(input.cutting);
      if (typeof args === "string") return errorResult(args);
      try {
        return await this.lookupCutting(args);
      } catch {
        return errorResult("Failed to look up cutting rate due to an internal error.");
      }
    }

    if (input.rateType === "core_hole") {
      const args = parseCoreHoleInput(input.coreHole);
      if (typeof args === "string") return errorResult(args);
      try {
        return await this.lookupCoreHole(args);
      } catch {
        return errorResult("Failed to look up core hole rate due to an internal error.");
      }
    }

    return errorResult(
      `Invalid lookup_rate input: rateType must be 'cutting' or 'core_hole'. ` +
        `Other rate types (labour/plant/fuel/waste/enclosure/other) are not yet supported.`
    );
  }

  // Two-layer permission check: persona is gated by ai.persona.tendering
  // at the chat endpoint; data access is gated by estimates.view (matches
  // the existing /api/v1/estimate-rates endpoints). Super Users bypass.
  private hasViewPermission(ctx: ToolHandlerContext): boolean {
    const actor = ctx.actor as { permissions?: string[]; isSuperUser?: boolean };
    if (actor.isSuperUser) return true;
    return Array.isArray(actor.permissions) && actor.permissions.includes("estimates.view");
  }

  // Cutting: exact match on (equipment, depthMm) plus elevation/material
  // matching the requested value OR "Any". When multiple rows match,
  // prefer the most specific (exact elevation + exact material) over
  // "Any" wildcards. Returning the wildcard would still be correct but
  // less informative — the user wants to see "Floor + Asphalt" not "Any".
  private async lookupCutting(args: CuttingArgs): Promise<ToolHandlerExecuteResult> {
    const dbElevation = args.elevation === "wall" ? "Wall" : "Floor";
    const candidates = await this.prisma.estimateCuttingRate.findMany({
      where: {
        equipment: { equals: args.equipment, mode: "insensitive" },
        material: { in: [args.material, "Any"], mode: "insensitive" },
        elevation: { in: [dbElevation, "Any"] },
        depthMm: args.depthMm,
        isActive: true
      }
    });

    if (candidates.length === 0) {
      const available = await this.availableCuttingCombinations(args);
      return errorResult(
        `No active cutting rate found for equipment="${args.equipment}", elevation=${args.elevation}, material="${args.material}", depth=${args.depthMm}mm. ` +
          (available
            ? `Available combinations for that equipment: ${available}`
            : `No rates exist for equipment="${args.equipment}". Try one of: Roadsaw, Demosaw, Ringsaw, Flush-cut, Tracksaw.`)
      );
    }

    const best = pickMostSpecificCuttingRow(candidates, dbElevation, args.material);

    return jsonResult({
      rateType: "cutting",
      equipment: best.equipment,
      elevation: args.elevation,
      material: args.material,
      depthMm: args.depthMm,
      matchedRow: {
        equipment: best.equipment,
        elevation: best.elevation,
        material: best.material,
        depthMm: best.depthMm
      },
      ratePerMetreAud: decimalToNumber(best.ratePerM),
      unit: "AUD per linear metre",
      currency: "AUD",
      lookupSource: "live rates (estimate_cutting_rates table)"
    });
  }

  // Core hole: lookup base rate by exact diameter, then apply the
  // elevation multiplier in code. Return BOTH base and final so the
  // model can explain the calculation transparently.
  private async lookupCoreHole(args: CoreHoleArgs): Promise<ToolHandlerExecuteResult> {
    const row = await this.prisma.estimateCoreHoleRate.findUnique({
      where: { diameterMm: args.diameterMm }
    });
    if (!row || !row.isActive) {
      const available = await this.availableCoreHoleDiameters();
      return errorResult(
        `No active core hole rate found for diameter=${args.diameterMm}mm. ` +
          `Available diameters (mm): ${available || "none seeded"}.`
      );
    }
    const multiplier = CORE_HOLE_ELEVATION_MULTIPLIERS[args.elevation];
    const baseRate = decimalToNumber(row.ratePerHole);
    const finalRate = round2(baseRate * multiplier);

    return jsonResult({
      rateType: "core_hole",
      elevation: args.elevation,
      diameterMm: args.diameterMm,
      matchedRow: { diameterMm: row.diameterMm },
      baseRateAud: baseRate,
      elevationMultiplier: multiplier,
      finalRateAud: finalRate,
      unit: "AUD per hole",
      currency: "AUD",
      lookupSource: "live rates (estimate_core_hole_rates table) with IS elevation multiplier applied",
      multiplierExplanation:
        args.elevation === "floor"
          ? "Floor = 1.0x base"
          : args.elevation === "wall"
            ? "Wall = 1.1x base (10% overhead premium)"
            : "Inverted = 2.0x base (overhead drilling)"
    });
  }

  private async availableCuttingCombinations(args: CuttingArgs): Promise<string | null> {
    const rows = await this.prisma.estimateCuttingRate.findMany({
      where: {
        equipment: { equals: args.equipment, mode: "insensitive" },
        isActive: true
      },
      select: { elevation: true, material: true, depthMm: true },
      orderBy: [{ elevation: "asc" }, { material: "asc" }, { depthMm: "asc" }],
      take: 50
    });
    if (rows.length === 0) return null;
    return rows
      .map((r) => `${r.elevation}/${r.material}/${r.depthMm}mm`)
      .join(", ");
  }

  private async availableCoreHoleDiameters(): Promise<string> {
    const rows = await this.prisma.estimateCoreHoleRate.findMany({
      where: { isActive: true },
      select: { diameterMm: true },
      orderBy: { diameterMm: "asc" }
    });
    return rows.map((r) => r.diameterMm).join(", ");
  }
}

function parseCuttingInput(raw: CuttingInput | undefined): CuttingArgs | string {
  if (!raw || typeof raw !== "object") {
    return "Invalid lookup_rate input: cutting block is required when rateType is 'cutting'.";
  }
  const { equipment, elevation, material, depthMm } = raw;
  if (typeof equipment !== "string" || equipment.trim().length === 0) {
    return "Invalid lookup_rate input: cutting.equipment must be a non-empty string.";
  }
  if (elevation !== "wall" && elevation !== "floor") {
    return "Invalid lookup_rate input: cutting.elevation must be 'wall' or 'floor'. Inverted is not supported for cutting.";
  }
  if (typeof material !== "string" || material.trim().length === 0) {
    return "Invalid lookup_rate input: cutting.material must be a non-empty string.";
  }
  if (typeof depthMm !== "number" || !Number.isFinite(depthMm) || depthMm <= 0) {
    return "Invalid lookup_rate input: cutting.depthMm must be a positive number.";
  }
  return {
    equipment: equipment.trim(),
    elevation,
    material: material.trim(),
    depthMm: Math.round(depthMm)
  };
}

function parseCoreHoleInput(raw: CoreHoleInput | undefined): CoreHoleArgs | string {
  if (!raw || typeof raw !== "object") {
    return "Invalid lookup_rate input: coreHole block is required when rateType is 'core_hole'.";
  }
  const { elevation, diameterMm } = raw;
  if (elevation !== "floor" && elevation !== "wall" && elevation !== "inverted") {
    return "Invalid lookup_rate input: coreHole.elevation must be 'floor', 'wall', or 'inverted'.";
  }
  if (typeof diameterMm !== "number" || !Number.isFinite(diameterMm) || diameterMm <= 0) {
    return "Invalid lookup_rate input: coreHole.diameterMm must be a positive number.";
  }
  return { elevation, diameterMm: Math.round(diameterMm) };
}

function pickMostSpecificCuttingRow<
  T extends { elevation: string; material: string }
>(rows: T[], requestedElevation: string, requestedMaterial: string): T {
  const score = (r: T) => {
    let s = 0;
    if (r.elevation.toLowerCase() === requestedElevation.toLowerCase()) s += 2;
    if (r.material.toLowerCase() === requestedMaterial.toLowerCase()) s += 1;
    return s;
  };
  return rows.slice().sort((a, b) => score(b) - score(a))[0]!;
}

function decimalToNumber(value: Prisma.Decimal | number | string): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  return value.toNumber();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function jsonResult(payload: object): ToolHandlerExecuteResult {
  return {
    result: {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }]
    }
  };
}

function errorResult(message: string): ToolHandlerExecuteResult {
  return {
    result: { content: [{ type: "text", text: message }], isError: true }
  };
}

// Sanity export for tests — keeps the unused vars from being stripped
// at compile time and gives unit tests a way to assert against the
// canonical multiplier table without re-declaring it.
export const __test__ = {
  CORE_HOLE_ELEVATION_MULTIPLIERS,
  CUTTING_ELEVATIONS_DB
};
