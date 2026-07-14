import type { ToolDefinition } from "./types";

// §5A.1 PR E — quote sub-mode content-creation tool. Parallel to
// propose_estimate_items but writes into a ClientQuote rather than a
// TenderEstimate.
//
// Three content blocks the model can propose for an existing quote:
//   - costLines  → QuoteCostLine rows (label + description; the user
//                   sets the price unless they explicitly named it in
//                   the conversation)
//   - exclusions → QuoteExclusion rows (text)
//   - assumptions → QuoteAssumption rows (text, optionally linked to
//                    a costLineId — only valid when referencing an
//                    EXISTING cost-line id; the AI cannot link to a
//                    cost-line proposed in the same call, since that
//                    cost-line's id only exists after acceptance.)
//
// The model proposes STRUCTURE, not pricing. `price` on costLines is
// included ONLY if the user explicitly stated a figure; if the AI
// omits price, the line is created at 0 and the user edits it in.
// GLOBAL_RATE_FABRICATION_PROHIBITION applies in full — the model
// must not guess at line totals.
export const proposeQuoteContentTool: ToolDefinition = {
  name: "propose_quote_content",
  description: [
    "Propose CONTENT into a ClientQuote — cost-line structure,",
    "exclusions, and assumptions. The estimator creates the ClientQuote",
    "in the Quote tab; you propose what goes IN it. Use",
    "list_tender_quotes first to discover the target quote ID and",
    "confirm which quote the user means before calling this tool. Each",
    "proposal is reviewed by the user as a card with Accept / Edit /",
    "Reject buttons. Propose ONLY cost-line LABELS and DESCRIPTIONS;",
    "do NOT invent a price. Include `price` only when the user stated",
    "a specific figure — otherwise omit it, and the line will be",
    "created at $0 for the user to edit."
  ].join(" "),
  inputSchema: {
    type: "object",
    properties: {
      quoteId: {
        type: "string",
        description:
          "The target ClientQuote id (from list_tender_quotes). The quote MUST belong to the active tender and MUST be in DRAFT status — proposing into a SENT or SUPERSEDED quote will be rejected at accept time."
      },
      sourceTenderEstimateId: {
        type: "string",
        description:
          "OPTIONAL traceability pointer. If set, the ClientQuote is stamped with this TenderEstimate id at accept time so downstream reporting can trace the quote back to the internal estimate it was derived from. Must belong to the same tender as the quote."
      },
      costLines: {
        type: "array",
        description: "Proposed quote cost-line structure (label + description).",
        items: {
          type: "object",
          properties: {
            label: {
              type: "string",
              maxLength: 200,
              description: "Short cost-line label, e.g. 'Internal demolition', 'Asbestos removal'."
            },
            description: {
              type: "string",
              maxLength: 2000,
              description: "Detailed description shown on the quote PDF for this line."
            },
            price: {
              type: "number",
              minimum: 0,
              description:
                "OPTIONAL. Include ONLY when the user explicitly stated a specific figure. Never invent or estimate a price — the line will be created at 0 if omitted."
            },
            sourceEstimateLineType: {
              type: "string",
              enum: [
                "EstimateLabourLine",
                "EstimatePlantLine",
                "EstimateEquipLine",
                "EstimateWasteLine",
                "EstimateCuttingLine"
              ],
              description:
                "OPTIONAL traceability tag naming the Estimate*Line model this quote line was derived from. Must be paired with sourceEstimateLineId; either both are supplied or neither. Read-only reference — no pricing is inherited."
            },
            sourceEstimateLineId: {
              type: "string",
              description:
                "OPTIONAL id of the Estimate*Line row this quote line was derived from. Must be paired with sourceEstimateLineType."
            }
          },
          required: ["label", "description"]
        },
        maxItems: 30
      },
      exclusions: {
        type: "array",
        description: "Proposed exclusion clauses for the quote.",
        items: {
          type: "object",
          properties: {
            text: {
              type: "string",
              maxLength: 1000,
              description: "Exclusion clause text, e.g. 'Excludes any encountered asbestos not noted in the asbestos register.'"
            }
          },
          required: ["text"]
        },
        maxItems: 30
      },
      assumptions: {
        type: "array",
        description: "Proposed assumption clauses for the quote.",
        items: {
          type: "object",
          properties: {
            text: {
              type: "string",
              maxLength: 1000,
              description: "Assumption clause text, e.g. 'Assumes 24/7 site access during demolition phase.'"
            }
          },
          required: ["text"]
        },
        maxItems: 30
      }
    },
    required: ["quoteId"]
  }
};

/** Estimate*Line variants a quote cost line may point back to. Kept as a
 *  TS union rather than a Prisma enum because the pointer stays polymorphic —
 *  five distinct tables with no shared parent. Adding a value here should
 *  match the enum in the tool JSON schema above. */
export type EstimateLineType =
  | "EstimateLabourLine"
  | "EstimatePlantLine"
  | "EstimateEquipLine"
  | "EstimateWasteLine"
  | "EstimateCuttingLine";

export type QuoteCostLineProposal = {
  label: string;
  description: string;
  price?: number;
  // Both traceability fields are optional but must be set together — enforced
  // at accept time in QuoteProposalsService.
  sourceEstimateLineType?: EstimateLineType;
  sourceEstimateLineId?: string;
};

export type QuoteExclusionProposal = {
  text: string;
};

export type QuoteAssumptionProposal = {
  text: string;
};

export type ProposeQuoteContentArgs = {
  quoteId: string;
  sourceTenderEstimateId?: string;
  costLines?: QuoteCostLineProposal[];
  exclusions?: QuoteExclusionProposal[];
  assumptions?: QuoteAssumptionProposal[];
};
