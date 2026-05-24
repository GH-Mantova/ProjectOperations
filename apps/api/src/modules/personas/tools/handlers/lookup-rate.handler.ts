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

type LabourShift = "day" | "night" | "weekend";

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

type LabourInput = {
  role?: unknown;
  shift?: unknown;
};

type PlantInput = {
  item?: unknown;
};

type WasteInput = {
  wasteType?: unknown;
  facility?: unknown;
};

type FuelInput = {
  item?: unknown;
};

type EnclosureInput = {
  enclosureType?: unknown;
};

type OtherInput = {
  description?: unknown;
};

type Input = {
  rateType?: unknown;
  cutting?: CuttingInput;
  coreHole?: CoreHoleInput;
  labour?: LabourInput;
  plant?: PlantInput;
  waste?: WasteInput;
  fuel?: FuelInput;
  enclosure?: EnclosureInput;
  other?: OtherInput;
};

// Normalised inputs after validation.
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

type LabourArgs = {
  role: string;
  shift: LabourShift;
};

type PlantArgs = {
  item: string;
};

type WasteArgs = {
  wasteType: string;
  facility: string;
};

type FuelArgs = {
  item: string;
};

type EnclosureArgs = {
  enclosureType: string;
};

type OtherArgs = {
  description: string;
};

@Injectable()
export class LookupRateHandler implements ToolHandler<Input> {
  name = "lookup_rate";
  description =
    "Look up an Initial Services schedule rate from the live rate library. " +
    "Supports eight rate types: cutting (schedule lookup by equipment/elevation/material/depth), " +
    "core_hole (base rate by diameter with elevation multiplier Floor=1.0x, Wall=1.1x, Inverted=2.0x), " +
    "labour (day/night/weekend rate by role), plant (rate + fuel by item), " +
    "waste (ton+load rate by wasteType+facility), fuel (rate by item), " +
    "enclosure (rate by enclosureType), and other (description-matched cutting-sheet catalogue rate). " +
    "Read-only — does not write to estimate items or scope items. " +
    "Use proactively when proposing scope items so the user sees both the proposal and the live rate together.";
  inputSchema = {
    type: "object" as const,
    properties: {
      rateType: {
        type: "string",
        enum: ["cutting", "core_hole", "labour", "plant", "waste", "fuel", "enclosure", "other"],
        description:
          "Which rate type to look up. All eight IS rate types are supported."
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
      },
      labour: {
        type: "object",
        description:
          "Required when rateType is 'labour'. Labour rates are keyed by role and have three shift columns (day/night/weekend); the lookup returns the requested shift's rate plus all three for context.",
        properties: {
          role: {
            type: "string",
            description:
              "Labour role (matched case-insensitive). Common values: Demolition labourer, Asbestos labourer, Machine operator, Project manager, Supervisor."
          },
          shift: {
            type: "string",
            enum: ["day", "night", "weekend"],
            description: "Shift the rate is being quoted for."
          }
        },
        required: ["role", "shift"]
      },
      plant: {
        type: "object",
        description:
          "Required when rateType is 'plant'. Plant rates are keyed by item; the lookup returns the rate, unit, and fuel rate (the running fuel cost when the item is operated).",
        properties: {
          item: {
            type: "string",
            description: "Plant item (matched case-insensitive). Common values: 5T excavator, 13T excavator, Bobcat, Skid steer, EWP, Scissor lift."
          }
        },
        required: ["item"]
      },
      waste: {
        type: "object",
        description:
          "Required when rateType is 'waste'. Waste rates are keyed by (wasteType, facility); the lookup returns the ton rate, load rate, billing unit, and waste group.",
        properties: {
          wasteType: {
            type: "string",
            description: "Waste type as classified by the receiving facility (matched case-insensitive). Common values: General waste, Concrete, Asbestos friable, Asbestos non-friable, Mixed C&D."
          },
          facility: {
            type: "string",
            description: "Receiving facility name (matched case-insensitive). e.g. Cleanaway Willawong, BMI Swanbank."
          }
        },
        required: ["wasteType", "facility"]
      },
      fuel: {
        type: "object",
        description:
          "Required when rateType is 'fuel'. Fuel rates are keyed by item; the lookup returns the rate and its billing unit.",
        properties: {
          item: {
            type: "string",
            description: "Fuel item (matched case-insensitive). Common values: Diesel, Unleaded, AdBlue."
          }
        },
        required: ["item"]
      },
      enclosure: {
        type: "object",
        description:
          "Required when rateType is 'enclosure'. Enclosure rates are keyed by enclosure type; the lookup returns the rate and its billing unit.",
        properties: {
          enclosureType: {
            type: "string",
            description: "Enclosure type (matched case-insensitive). Common values: Class A enclosure, Class B enclosure, Negative-pressure decon unit."
          }
        },
        required: ["enclosureType"]
      },
      other: {
        type: "object",
        description:
          "Required when rateType is 'other'. The 'Other' catalogue holds flat-fee or unit-priced cutting-sheet line items (establishment fees, saw-blade changes, etc.). description is NOT a unique key — when multiple active rows match, all of them are returned.",
        properties: {
          description: {
            type: "string",
            description: "Description text to match (case-insensitive substring). e.g. 'establishment', 'saw blade'."
          }
        },
        required: ["description"]
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

    if (input.rateType === "labour") {
      const args = parseLabourInput(input.labour);
      if (typeof args === "string") return errorResult(args);
      try {
        return await this.lookupLabour(args);
      } catch {
        return errorResult("Failed to look up labour rate due to an internal error.");
      }
    }

    if (input.rateType === "plant") {
      const args = parsePlantInput(input.plant);
      if (typeof args === "string") return errorResult(args);
      try {
        return await this.lookupPlant(args);
      } catch {
        return errorResult("Failed to look up plant rate due to an internal error.");
      }
    }

    if (input.rateType === "waste") {
      const args = parseWasteInput(input.waste);
      if (typeof args === "string") return errorResult(args);
      try {
        return await this.lookupWaste(args);
      } catch {
        return errorResult("Failed to look up waste rate due to an internal error.");
      }
    }

    if (input.rateType === "fuel") {
      const args = parseFuelInput(input.fuel);
      if (typeof args === "string") return errorResult(args);
      try {
        return await this.lookupFuel(args);
      } catch {
        return errorResult("Failed to look up fuel rate due to an internal error.");
      }
    }

    if (input.rateType === "enclosure") {
      const args = parseEnclosureInput(input.enclosure);
      if (typeof args === "string") return errorResult(args);
      try {
        return await this.lookupEnclosure(args);
      } catch {
        return errorResult("Failed to look up enclosure rate due to an internal error.");
      }
    }

    if (input.rateType === "other") {
      const args = parseOtherInput(input.other);
      if (typeof args === "string") return errorResult(args);
      try {
        return await this.lookupOther(args);
      } catch {
        return errorResult("Failed to look up other rate due to an internal error.");
      }
    }

    return errorResult(
      `Invalid lookup_rate input: rateType must be one of 'cutting', 'core_hole', 'labour', 'plant', 'waste', 'fuel', 'enclosure', or 'other'.`
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

  // Labour: role is @unique on EstimateLabourRate. Match case-insensitive.
  // Return the requested shift's rate as the primary value, plus all
  // three shift rates for context.
  private async lookupLabour(args: LabourArgs): Promise<ToolHandlerExecuteResult> {
    const row = await this.prisma.estimateLabourRate.findFirst({
      where: {
        role: { equals: args.role, mode: "insensitive" },
        isActive: true
      }
    });
    if (!row) {
      const available = await this.availableLabourRoles();
      return errorResult(
        `No active labour rate found for role="${args.role}". ` +
          `Available roles: ${available || "none seeded"}.`
      );
    }
    const dayRate = decimalToNumber(row.dayRate);
    const nightRate = decimalToNumber(row.nightRate);
    const weekendRate = decimalToNumber(row.weekendRate);
    const shiftRate =
      args.shift === "day" ? dayRate : args.shift === "night" ? nightRate : weekendRate;
    return jsonResult({
      rateType: "labour",
      role: row.role,
      shift: args.shift,
      rateAud: shiftRate,
      dayRateAud: dayRate,
      nightRateAud: nightRate,
      weekendRateAud: weekendRate,
      unit: "AUD per day",
      currency: "AUD",
      lookupSource: "live rates (estimate_labour_rates table)"
    });
  }

  // Plant: item is @unique on EstimatePlantRate. Match case-insensitive.
  // Return rate, billing unit, and fuelRate (the running fuel cost the
  // estimator adds on top of the hire rate when the item is operated).
  private async lookupPlant(args: PlantArgs): Promise<ToolHandlerExecuteResult> {
    const row = await this.prisma.estimatePlantRate.findFirst({
      where: {
        item: { equals: args.item, mode: "insensitive" },
        isActive: true
      }
    });
    if (!row) {
      const available = await this.availablePlantItems();
      return errorResult(
        `No active plant rate found for item="${args.item}". ` +
          `Available items: ${available || "none seeded"}.`
      );
    }
    return jsonResult({
      rateType: "plant",
      item: row.item,
      rateAud: decimalToNumber(row.rate),
      unit: `AUD per ${row.unit}`,
      fuelRateAud: decimalToNumber(row.fuelRate),
      currency: "AUD",
      lookupSource: "live rates (estimate_plant_rates table)"
    });
  }

  // Waste: (wasteType, facility) is @@unique on EstimateWasteRate. Both
  // matched case-insensitive. Return ton rate, load rate, billing unit,
  // and waste group classification.
  private async lookupWaste(args: WasteArgs): Promise<ToolHandlerExecuteResult> {
    const row = await this.prisma.estimateWasteRate.findFirst({
      where: {
        wasteType: { equals: args.wasteType, mode: "insensitive" },
        facility: { equals: args.facility, mode: "insensitive" },
        isActive: true
      }
    });
    if (!row) {
      const available = await this.availableWasteCombinations();
      return errorResult(
        `No active waste rate found for wasteType="${args.wasteType}", facility="${args.facility}". ` +
          `Available combinations: ${available || "none seeded"}.`
      );
    }
    return jsonResult({
      rateType: "waste",
      wasteType: row.wasteType,
      facility: row.facility,
      wasteGroup: row.wasteGroup,
      tonRateAud: decimalToNumber(row.tonRate),
      loadRateAud: decimalToNumber(row.loadRate),
      unit: row.unit,
      currency: "AUD",
      lookupSource: "live rates (estimate_waste_rates table)"
    });
  }

  // Fuel: item is @unique on EstimateFuelRate. Match case-insensitive.
  // Return rate and its billing unit (typically per litre).
  private async lookupFuel(args: FuelArgs): Promise<ToolHandlerExecuteResult> {
    const row = await this.prisma.estimateFuelRate.findFirst({
      where: {
        item: { equals: args.item, mode: "insensitive" },
        isActive: true
      }
    });
    if (!row) {
      const available = await this.availableFuelItems();
      return errorResult(
        `No active fuel rate found for item="${args.item}". ` +
          `Available items: ${available || "none seeded"}.`
      );
    }
    return jsonResult({
      rateType: "fuel",
      item: row.item,
      rateAud: decimalToNumber(row.rate),
      unit: `AUD per ${row.unit}`,
      currency: "AUD",
      lookupSource: "live rates (estimate_fuel_rates table)"
    });
  }

  // Enclosure: enclosureType is @unique on EstimateEnclosureRate. Match
  // case-insensitive. Return rate and its billing unit.
  private async lookupEnclosure(args: EnclosureArgs): Promise<ToolHandlerExecuteResult> {
    const row = await this.prisma.estimateEnclosureRate.findFirst({
      where: {
        enclosureType: { equals: args.enclosureType, mode: "insensitive" },
        isActive: true
      }
    });
    if (!row) {
      const available = await this.availableEnclosureTypes();
      return errorResult(
        `No active enclosure rate found for enclosureType="${args.enclosureType}". ` +
          `Available types: ${available || "none seeded"}.`
      );
    }
    return jsonResult({
      rateType: "enclosure",
      enclosureType: row.enclosureType,
      rateAud: decimalToNumber(row.rate),
      unit: `AUD per ${row.unit}`,
      currency: "AUD",
      lookupSource: "live rates (estimate_enclosure_rates table)"
    });
  }

  // Other: CuttingOtherRate.description is NOT a unique key — multiple
  // active rows can match. Use a case-insensitive substring match (the
  // model often won't know the exact catalogue wording) and return all
  // matches so the user can pick.
  private async lookupOther(args: OtherArgs): Promise<ToolHandlerExecuteResult> {
    const rows = await this.prisma.cuttingOtherRate.findMany({
      where: {
        description: { contains: args.description, mode: "insensitive" },
        isActive: true
      },
      orderBy: [{ sortOrder: "asc" }, { description: "asc" }]
    });
    if (rows.length === 0) {
      const available = await this.availableOtherDescriptions();
      return errorResult(
        `No active other rate found matching description="${args.description}". ` +
          `Available descriptions: ${available || "none seeded"}.`
      );
    }
    return jsonResult({
      rateType: "other",
      searchDescription: args.description,
      matches: rows.map((r) => ({
        description: r.description,
        rateAud: decimalToNumber(r.rate),
        unit: `AUD per ${r.unit}`
      })),
      currency: "AUD",
      lookupSource: "live rates (cutting_other_rates table)"
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

  private async availableLabourRoles(): Promise<string> {
    const rows = await this.prisma.estimateLabourRate.findMany({
      where: { isActive: true },
      select: { role: true },
      orderBy: [{ sortOrder: "asc" }, { role: "asc" }],
      take: 50
    });
    return rows.map((r) => r.role).join(", ");
  }

  private async availablePlantItems(): Promise<string> {
    const rows = await this.prisma.estimatePlantRate.findMany({
      where: { isActive: true },
      select: { item: true },
      orderBy: [{ sortOrder: "asc" }, { item: "asc" }],
      take: 50
    });
    return rows.map((r) => r.item).join(", ");
  }

  private async availableWasteCombinations(): Promise<string> {
    const rows = await this.prisma.estimateWasteRate.findMany({
      where: { isActive: true },
      select: { wasteType: true, facility: true },
      orderBy: [{ sortOrder: "asc" }, { wasteType: "asc" }, { facility: "asc" }],
      take: 50
    });
    return rows.map((r) => `${r.wasteType} @ ${r.facility}`).join(", ");
  }

  private async availableFuelItems(): Promise<string> {
    const rows = await this.prisma.estimateFuelRate.findMany({
      where: { isActive: true },
      select: { item: true },
      orderBy: [{ sortOrder: "asc" }, { item: "asc" }],
      take: 50
    });
    return rows.map((r) => r.item).join(", ");
  }

  private async availableEnclosureTypes(): Promise<string> {
    const rows = await this.prisma.estimateEnclosureRate.findMany({
      where: { isActive: true },
      select: { enclosureType: true },
      orderBy: [{ sortOrder: "asc" }, { enclosureType: "asc" }],
      take: 50
    });
    return rows.map((r) => r.enclosureType).join(", ");
  }

  private async availableOtherDescriptions(): Promise<string> {
    const rows = await this.prisma.cuttingOtherRate.findMany({
      where: { isActive: true },
      select: { description: true },
      orderBy: [{ sortOrder: "asc" }, { description: "asc" }],
      take: 50
    });
    return rows.map((r) => r.description).join(", ");
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

function parseLabourInput(raw: LabourInput | undefined): LabourArgs | string {
  if (!raw || typeof raw !== "object") {
    return "Invalid lookup_rate input: labour block is required when rateType is 'labour'.";
  }
  const { role, shift } = raw;
  if (typeof role !== "string" || role.trim().length === 0) {
    return "Invalid lookup_rate input: labour.role must be a non-empty string.";
  }
  if (shift !== "day" && shift !== "night" && shift !== "weekend") {
    return "Invalid lookup_rate input: labour.shift must be 'day', 'night', or 'weekend'.";
  }
  return { role: role.trim(), shift };
}

function parsePlantInput(raw: PlantInput | undefined): PlantArgs | string {
  if (!raw || typeof raw !== "object") {
    return "Invalid lookup_rate input: plant block is required when rateType is 'plant'.";
  }
  const { item } = raw;
  if (typeof item !== "string" || item.trim().length === 0) {
    return "Invalid lookup_rate input: plant.item must be a non-empty string.";
  }
  return { item: item.trim() };
}

function parseWasteInput(raw: WasteInput | undefined): WasteArgs | string {
  if (!raw || typeof raw !== "object") {
    return "Invalid lookup_rate input: waste block is required when rateType is 'waste'.";
  }
  const { wasteType, facility } = raw;
  if (typeof wasteType !== "string" || wasteType.trim().length === 0) {
    return "Invalid lookup_rate input: waste.wasteType must be a non-empty string.";
  }
  if (typeof facility !== "string" || facility.trim().length === 0) {
    return "Invalid lookup_rate input: waste.facility must be a non-empty string.";
  }
  return { wasteType: wasteType.trim(), facility: facility.trim() };
}

function parseFuelInput(raw: FuelInput | undefined): FuelArgs | string {
  if (!raw || typeof raw !== "object") {
    return "Invalid lookup_rate input: fuel block is required when rateType is 'fuel'.";
  }
  const { item } = raw;
  if (typeof item !== "string" || item.trim().length === 0) {
    return "Invalid lookup_rate input: fuel.item must be a non-empty string.";
  }
  return { item: item.trim() };
}

function parseEnclosureInput(raw: EnclosureInput | undefined): EnclosureArgs | string {
  if (!raw || typeof raw !== "object") {
    return "Invalid lookup_rate input: enclosure block is required when rateType is 'enclosure'.";
  }
  const { enclosureType } = raw;
  if (typeof enclosureType !== "string" || enclosureType.trim().length === 0) {
    return "Invalid lookup_rate input: enclosure.enclosureType must be a non-empty string.";
  }
  return { enclosureType: enclosureType.trim() };
}

function parseOtherInput(raw: OtherInput | undefined): OtherArgs | string {
  if (!raw || typeof raw !== "object") {
    return "Invalid lookup_rate input: other block is required when rateType is 'other'.";
  }
  const { description } = raw;
  if (typeof description !== "string" || description.trim().length === 0) {
    return "Invalid lookup_rate input: other.description must be a non-empty string.";
  }
  return { description: description.trim() };
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
