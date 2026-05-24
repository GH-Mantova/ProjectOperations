import type { ToolDefinition } from "./types";
import { IS_DISCIPLINE_CODES, type IsDisciplineCode } from "../../personas/definitions/disciplines";

// §5A.1 PR D — estimate sub-mode tool. Produces an array of proposed
// estimate items, each with a header (code/title/etc) and optional cost
// lines (labour / plant / cutting / waste). The user reviews each as a
// card and accepts / edits / rejects. EstimateEquipLine and
// EstimateAssumption are intentionally OUT of scope here — they're not
// part of the model the persona is reasoning about and can be added
// manually after acceptance if needed.
//
// Rate fields (rate, tonRate, loadRate) are model-supplied — the system
// prompt mandates the model call lookup_rate first and quote the
// returned rate verbatim. The GLOBAL_RATE_FABRICATION_PROHIBITION and
// RATE_LOOKUP MANDATORY POLICY blocks apply in full.
export const proposeEstimateItemsTool: ToolDefinition = {
  name: "propose_estimate_items",
  description: [
    "Propose estimate items for the current tender. Each proposal is a",
    "whole estimate-item header (code, title, description, markup, optional",
    "provisional amount) plus optional cost-line groups: labour, plant,",
    "cutting, and waste. The user reviews each proposal as a card and",
    "accepts / edits / rejects. Before proposing, you MUST call lookup_rate",
    "for every rate you intend to include — never invent a rate. Initial",
    "Services works in four disciplines (DEM, CIV, ASB, Other); never propose",
    "items outside these codes. Each accepted proposal writes one EstimateItem",
    "row plus its labour/plant/cutting/waste lines into the tender's estimate."
  ].join(" "),
  inputSchema: {
    type: "object",
    properties: {
      proposals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            code: {
              type: "string",
              enum: [...IS_DISCIPLINE_CODES],
              description:
                "IS discipline code — DEM (demolition incl. strip-outs and structural), " +
                "CIV (civil works), ASB (asbestos removal), Other (provisional sums, " +
                "cost options, adjustments)."
            },
            title: {
              type: "string",
              maxLength: 200,
              description: "Short estimate item title, e.g. 'Internal demolition — Level 2'."
            },
            description: {
              type: "string",
              maxLength: 2000,
              description: "Optional detailed description for the estimate item header."
            },
            markup: {
              type: "number",
              minimum: 0,
              description: "Markup percentage applied to this item. Defaults to 30 if omitted."
            },
            isProvisional: {
              type: "boolean",
              description: "Mark as a provisional sum / cost option. Defaults to false."
            },
            provisionalAmount: {
              type: "number",
              minimum: 0,
              description: "When isProvisional is true, the allowance amount in AUD ex-GST."
            },
            labourLines: {
              type: "array",
              description: "Optional labour cost lines. Each line: role, qty, days, shift, rate.",
              items: {
                type: "object",
                properties: {
                  role: { type: "string", description: "Labour role — must match an EstimateLabourRate.role." },
                  qty: { type: "number", minimum: 0, description: "Number of resources." },
                  days: { type: "number", minimum: 0, description: "Days of work." },
                  shift: {
                    type: "string",
                    enum: ["Day", "Night", "Weekend"],
                    description: "Shift the rate is being quoted for."
                  },
                  rate: {
                    type: "number",
                    minimum: 0,
                    description: "AUD per hour for the chosen shift. MUST come from lookup_rate(labour)."
                  }
                },
                required: ["role", "qty", "days", "shift", "rate"]
              }
            },
            plantLines: {
              type: "array",
              description: "Optional plant cost lines. Each line: plantItem, qty, days, rate, optional comment.",
              items: {
                type: "object",
                properties: {
                  plantItem: { type: "string", description: "Plant item — must match an EstimatePlantRate.item." },
                  qty: { type: "number", minimum: 0, description: "Number of plant units." },
                  days: { type: "number", minimum: 0, description: "Hire duration in days." },
                  comment: { type: "string", description: "Optional inline comment (e.g. operator-included)." },
                  rate: {
                    type: "number",
                    minimum: 0,
                    description: "AUD per day. MUST come from lookup_rate(plant)."
                  }
                },
                required: ["plantItem", "qty", "days", "rate"]
              }
            },
            cuttingLines: {
              type: "array",
              description:
                "Optional cutting cost lines. cuttingType is 'Saw cut' (uses " +
                "equipment + elevation + material + depthMm) or 'Core hole' (uses diameterMm).",
              items: {
                type: "object",
                properties: {
                  cuttingType: { type: "string", description: "Free-text cutting type, e.g. 'Saw cut', 'Core hole'." },
                  equipment: { type: "string", description: "Equipment (saw-cut rows only)." },
                  elevation: { type: "string", description: "Elevation (saw-cut: Wall/Floor; core-hole: Floor/Wall/Inverted)." },
                  material: { type: "string", description: "Material (saw-cut rows only)." },
                  depthMm: { type: "integer", minimum: 1, description: "Cut depth in mm (saw-cut rows only)." },
                  diameterMm: { type: "integer", minimum: 1, description: "Core diameter in mm (core-hole rows only)." },
                  qty: { type: "number", minimum: 0, description: "Quantity (linear metres or hole count)." },
                  unit: { type: "string", description: "Billing unit, e.g. 'lm' (saw cut) or 'each' (core hole)." },
                  comment: { type: "string", description: "Optional inline comment." },
                  rate: {
                    type: "number",
                    minimum: 0,
                    description: "AUD per unit. MUST come from lookup_rate(cutting|core_hole)."
                  }
                },
                required: ["cuttingType", "qty", "unit", "rate"]
              }
            },
            wasteLines: {
              type: "array",
              description: "Optional waste cost lines. Each line: wasteType, facility, qtyTonnes, tonRate, loads, loadRate.",
              items: {
                type: "object",
                properties: {
                  wasteGroup: { type: "string", description: "Optional waste-group classification (e.g. 'Inert')." },
                  wasteType: { type: "string", description: "Waste type — must match an EstimateWasteRate.wasteType." },
                  facility: { type: "string", description: "Receiving facility — must match an EstimateWasteRate.facility." },
                  qtyTonnes: { type: "number", minimum: 0, description: "Tonnes to dispose." },
                  tonRate: {
                    type: "number",
                    minimum: 0,
                    description: "AUD per tonne. MUST come from lookup_rate(waste)."
                  },
                  loads: { type: "integer", minimum: 0, description: "Number of truck loads (separate per-load fee)." },
                  loadRate: {
                    type: "number",
                    minimum: 0,
                    description: "AUD per load. MUST come from lookup_rate(waste)."
                  }
                },
                required: ["wasteType", "facility", "qtyTonnes", "tonRate", "loads", "loadRate"]
              }
            }
          },
          required: ["code", "title"]
        },
        minItems: 1,
        maxItems: 30
      }
    },
    required: ["proposals"]
  }
};

export type EstimateLabourLineProposal = {
  role: string;
  qty: number;
  days: number;
  shift: "Day" | "Night" | "Weekend";
  rate: number;
};

export type EstimatePlantLineProposal = {
  plantItem: string;
  qty: number;
  days: number;
  comment?: string;
  rate: number;
};

export type EstimateCuttingLineProposal = {
  cuttingType: string;
  equipment?: string;
  elevation?: string;
  material?: string;
  depthMm?: number;
  diameterMm?: number;
  qty: number;
  unit: string;
  comment?: string;
  rate: number;
};

export type EstimateWasteLineProposal = {
  wasteGroup?: string;
  wasteType: string;
  facility: string;
  qtyTonnes: number;
  tonRate: number;
  loads: number;
  loadRate: number;
};

export type EstimateItemProposal = {
  code: IsDisciplineCode;
  title: string;
  description?: string;
  markup?: number;
  isProvisional?: boolean;
  provisionalAmount?: number;
  labourLines?: EstimateLabourLineProposal[];
  plantLines?: EstimatePlantLineProposal[];
  cuttingLines?: EstimateCuttingLineProposal[];
  wasteLines?: EstimateWasteLineProposal[];
};

export type ProposeEstimateItemsArgs = {
  proposals: EstimateItemProposal[];
};
